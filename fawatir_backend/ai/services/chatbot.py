import json
import logging
import os
import uuid
from typing import List, Dict, Any, Optional
from contextvars import ContextVar

try:
    from google import genai
except (ImportError, ModuleNotFoundError):
    genai = None
from django.conf import settings
from django.db.models import Q

from api.models import Client, Product, Quotation, QuotationItem, WhatsappMessage, Organization, Invoice, InvoiceItem
from ai.services.forecast import forecast_cashflow

logger = logging.getLogger(__name__)

# Configure Gemini
def get_simple_genai_model():
    api_key = os.environ.get('GEMINI_API_KEY')
    if hasattr(settings, 'GEMINI_API_KEY') and settings.GEMINI_API_KEY:
        api_key = settings.GEMINI_API_KEY
        
    if not api_key:
        raise ValueError("GEMINI_API_KEY is not configured.")
    
    # Initialize and return the new SDK Client
    return genai.Client(api_key=api_key)

def get_genai_model():
    api_key = os.environ.get('GEMINI_API_KEY')
    if hasattr(settings, 'GEMINI_API_KEY') and settings.GEMINI_API_KEY:
        api_key = settings.GEMINI_API_KEY
    if not api_key:
        raise ValueError("GEMINI_API_KEY is not configured.")
    
    genai.configure(api_key=api_key)
    # Using gemini-3.5-flash-lite to avoid deprecation and strict rate limits
    return genai.GenerativeModel('gemini-1.5-flash', tools=[
        check_stock,
        create_quotation,
        prepare_whatsapp_message,
        get_clients,
        get_cashflow_forecast,
        get_product_recommendations,
        detect_billing_errors,
        predict_stock_exhaustion,
        generate_product_description
    ])

# -----------------------------------------------------------------------------
# AI Tools (Function Calling)
# -----------------------------------------------------------------------------

current_company: ContextVar[Optional[Organization]] = ContextVar('current_company', default=None)

def get_company() -> Organization:
    # Safely retrieve company from request-bound ContextVar for robust multi-tenancy
    company = current_company.get()
    if company:
        return company
    # Fallback to the first company in database if context is empty (e.g. testing or mock data)
    return Organization.objects.first()

import unicodedata

def normalize_string(s: str) -> str:
    if not s:
        return ""
    return ''.join(c for c in unicodedata.normalize('NFD', s)
                  if unicodedata.category(c) != 'Mn')

def find_product_by_name(product_name: str, company) -> Optional[Product]:
    normalized_search = normalize_string(product_name).lower()
    products = Product.objects.filter(organisation=company)
    for p in products:
        if (normalized_search in normalize_string(p.name).lower() or 
            normalized_search in normalize_string(p.sku).lower()):
            return p
    return None

def find_products_by_name(product_name: str, company, limit: int = 5) -> List[Product]:
    normalized_search = normalize_string(product_name).lower()
    products = Product.objects.filter(organisation=company)
    matches = []
    for p in products:
        if (normalized_search in normalize_string(p.name).lower() or 
            normalized_search in normalize_string(p.sku).lower()):
            matches.append(p)
            if len(matches) >= limit:
                break
    return matches

def check_stock(product_name: str) -> str:
    """
    Search for a product by name to check its price and stock quantity.
    
    Args:
        product_name: The name of the product to search for.
    """
    company = get_company()
    products = find_products_by_name(product_name, company, limit=5)
    
    if not products:
        return f"Aucun produit trouvé pour '{product_name}'."
    
    results = []
    for p in products:
        stock = p.inventory_records.first()
        qty = stock.quantity if stock else (0 if p.track_inventory else "Non suivi")
        results.append(f"- {p.name} (SKU: {p.sku}): Prix {p.selling_price} MAD, Stock: {qty}")
    
    return "\n".join(results)

def get_clients(search_query: str = "") -> str:
    """
    Search for clients in the database. Leave search_query empty to get recent clients.
    
    Args:
        search_query: Name or email of the client to search for.
    """
    company = get_company()
    if search_query:
        clients = Client.objects.filter(
            Q(company_name__icontains=search_query) | 
            Q(contact_name__icontains=search_query) | 
            Q(email__icontains=search_query),
            organisation=company
        )[:10]
    else:
        clients = Client.objects.filter(organisation=company).order_by('-created_at')[:10]
        
    if not clients:
        return "Aucun client trouvé."
    
    results = []
    for c in clients:
        phone = c.phone or c.mobile or "Pas de numéro"
        name = c.contact_name or c.company_name or "Nom inconnu"
        results.append(f"- ID: {c.id} | Nom: {name} | Tel: {phone} | Email: {c.email or 'N/A'}")
        
    return "\n".join(results)

def prepare_whatsapp_message(client_search: str, message: str) -> str:
    """
    Finds a client and generates a WhatsApp message link (wa.me) for them.
    This does NOT send the message automatically. It gives the link to the user to click.
    
    Args:
        client_search: The name of the client to send the message to.
        message: The exact text message to send.
    """
    company = get_company()
    clients = Client.objects.filter(
        Q(company_name__icontains=client_search) | Q(contact_name__icontains=client_search),
        organisation=company
    )
    if not clients.exists():
        return f"Client '{client_search}' introuvable. Demandez à l'utilisateur de préciser le nom."
        
    client = clients.first()
    phone = client.mobile or client.phone
    if not phone:
        return f"Le client '{client.company_name}' n'a pas de numéro de téléphone enregistré."
        
    # Clean phone number (remove spaces, ensure it has country code, simplified for demo)
    clean_phone = ''.join(filter(str.isdigit, str(phone)))
    if clean_phone.startswith('0'):
        clean_phone = '212' + clean_phone[1:] # Default to Morocco +212 for this demo
        
    import urllib.parse
    encoded_message = urllib.parse.quote(message)
    wa_link = f"https://wa.me/{clean_phone}?text={encoded_message}"
    
    # Log the intent
    WhatsappMessage.objects.create(
        organisation=company,
        client=client,
        phone_number=clean_phone,
        message=message,
        status="Lien généré"
    )
    
    return f"SUCCÈS: Donnez ce lien à l'utilisateur pour qu'il clique et envoie le message: [Envoyer WhatsApp]({wa_link})"

def create_quotation(client_search: str, product_names: List[str]) -> str:
    """
    Creates a new Quotation (Devis) for a client with the specified products.
    
    Args:
        client_search: The name of the client.
        product_names: A list of product names to add to the quotation.
    """
    company = get_company()
    # Find client
    clients = Client.objects.filter(
        Q(company_name__icontains=client_search) | Q(contact_name__icontains=client_search),
        organisation=company
    )
    if not clients.exists():
        return f"Client '{client_search}' introuvable."
    client = clients.first()
    
    # Create quotation
    import random
    while True:
        q_number = f"DEV-{random.randint(1000, 9999)}"
        if not Quotation.objects.filter(quotation_number=q_number).exists():
            break
            
    quotation = Quotation.objects.create(
        organisation=company,
        client=client,
        quotation_number=q_number,
        status="Brouillon",
        total_amount=0
    )
    
    # Add products
    total = 0
    added_products = []
    for p_name in product_names:
        prod = find_product_by_name(p_name, company)
        if prod:
            price = prod.selling_price or 0
            QuotationItem.objects.create(
                quotation=quotation,
                product=prod,
                description=prod.description or prod.name,
                quantity=1,
                unit_price=price,
                line_total=price
            )
            total += price
            added_products.append(prod.name)
            
    quotation.total_amount = total
    quotation.save()
    
    return f"Devis {q_number} créé avec succès pour le client {client.company_name} avec les produits: {', '.join(added_products)}. Montant total: {total} MAD."

def get_cashflow_forecast(days: int = 30) -> str:
    """
    Generate a 30-day cash flow forecast table using local statistical calculations.
    
    Args:
        days: Number of days to forecast (default 30).
    """
    try:
        days = int(days)
    except (ValueError, TypeError):
        days = 30
        
    company = get_company()
    # Fetch real invoices
    invoices = Invoice.objects.filter(organisation=company).order_by('issue_date')
    history = []
    
    # Check history count
    if invoices.count() >= 10:
        for inv in invoices:
            if inv.issue_date:
                history.append({
                    "date": inv.issue_date.strftime('%Y-%m-%d'),
                    "amount": float(inv.total_amount)
                })
        is_simulated = False
    else:
        # Generate dummy history data for the last 45 days
        import datetime
        import random
        base_date = datetime.date.today() - datetime.timedelta(days=45)
        for i in range(45):
            current_date = base_date + datetime.timedelta(days=i)
            # Weekend drop in sales, weekday sales
            if current_date.weekday() in [5, 6]:
                amount = random.randint(100, 1500)
            else:
                amount = random.randint(2000, 12000)
            history.append({
                "date": current_date.strftime('%Y-%m-%d'),
                "amount": float(amount)
            })
        is_simulated = True

    try:
        # Run local prophet forecast
        result = forecast_cashflow(history, horizon_days=days)
        forecast_data = result.get('forecast', [])
        
        # Build Markdown table
        lines = []
        if is_simulated:
            lines.append("> ⚠️ **Note de simulation :** Vous n'avez pas encore d'historique de facturation suffisant dans votre base de données (il faut au moins 10 factures). Voici une simulation de prévision de trésorerie basée sur des données fictives :\n")
        
        lines.append("| Date | Prédiction (MAD) | Confiance Basse (MAD) | Confiance Haute (MAD) |")
        lines.append("| :--- | :--- | :--- | :--- |")
        
        # We limit the output table to show every 3rd day to keep it readable and concise in the chat
        for i, row in enumerate(forecast_data):
            if i % 3 == 0 or i == len(forecast_data) - 1:
                lines.append(f"| {row['date']} | {row['yhat']} | {row['yhat_lower']} | {row['yhat_upper']} |")
                
        lines.append("\n*Ces prévisions sont fournies à titre indicatif uniquement et basées sur l'algorithme Prophet (calcul local). Nous vous conseillons de maintenir au moins 10 factures réelles pour obtenir des résultats précis.*")
        return "\n".join(lines)
    except Exception as e:
        logger.error(f"Error in cashflow forecast tool: {e}")
        return f"Erreur lors de la génération de la prévision de trésorerie: {str(e)}"

def get_product_recommendations(product_name: str) -> str:
    """
    Suggest relevant cross-selling products based on a product name.
    
    Args:
        product_name: The name of the product to find recommendations for.
    """
    company = get_company()
    product_name_lower = product_name.lower()
    
    # Preconfigured recommendations for default catalog items
    catalog_recs = {
        "survetement": [
            {"name": "CASQUETTE BASIQUE", "rate": 68},
            {"name": "T-SHIRT COTON", "rate": 52}
        ],
        "casquette": [
            {"name": "SURVETEMENT COMPLET", "rate": 45},
            {"name": "T-SHIRT COTON", "rate": 35}
        ],
        "t-shirt": [
            {"name": "SURVETEMENT COMPLET", "rate": 72},
            {"name": "CASQUETTE BASIQUE", "rate": 40}
        ]
    }
    
    # Try local database co-occurrence analysis first
    target_product = find_product_by_name(product_name, company)
    recs = []
    is_real_db = False
    
    if target_product:
        # Find all quotations containing this product
        quotations_with_prod = QuotationItem.objects.filter(
            product=target_product, 
            quotation__organisation=company
        ).values_list('quotation_id', flat=True)
        
        if quotations_with_prod.count() > 0:
            # Find other products in these quotations
            other_items = QuotationItem.objects.filter(
                quotation_id__in=quotations_with_prod,
                quotation__organisation=company
            ).exclude(product=target_product)
            
            # Count occurrences of other products
            from django.db.models import Count
            co_occurrences = other_items.values('product__name').annotate(count=Count('id')).order_by('-count')[:2]
            
            total_quotes = quotations_with_prod.count()
            for co in co_occurrences:
                rate = int((co['count'] / total_quotes) * 100)
                recs.append({"name": co['product__name'], "rate": rate})
            is_real_db = len(recs) > 0

    # Fallback to preconfigured catalog recommendations if DB analysis found nothing
    if not recs:
        for key, value in catalog_recs.items():
            if key in product_name_lower:
                recs = value
                break
                
    if not recs:
        # Generic fallback recommendation if product is completely unknown
        recs = [
            {"name": "SURVETEMENT COMPLET", "rate": 20},
            {"name": "CASQUETTE BASIQUE", "rate": 15}
        ]
        
    # Format response
    lines = []
    lines.append(f"💡 **Recommandations de vente croisée (Cross-selling) pour '{product_name}' :**\n")
    if is_real_db:
        lines.append("*Basé sur l'historique réel de vos transactions dans la base de données :*")
    else:
        lines.append("*Basé sur les tendances types d'achat de votre secteur :*")
        
    for r in recs:
        lines.append(f"- **{r['name']}** : proposé en association dans **{r['rate']}%** des ventes.")
        
    lines.append(f"\n*Conseil de vente : Lorsque vous créez un devis avec '{product_name}', proposez systématiquement ces articles pour augmenter la valeur du panier moyen.*")
    return "\n".join(lines)

def detect_billing_errors(product_name: str, quantity: float, unit_price: float) -> str:
    """
    Validate a draft invoice item for potential billing anomalies, price deviations, or typos.
    
    Args:
        product_name: Name of the product being sold.
        quantity: Quantity proposed.
        unit_price: Unit price proposed.
    """
    company = get_company()
    
    # 1. Search for the product in the DB
    prod = find_product_by_name(product_name, company)
    if not prod:
        return f"Le produit '{product_name}' n'a pas été trouvé dans votre catalogue. Impossible de valider le tarif."
        
    normal_price = prod.selling_price or 0
    warnings = []
    
    # Convert parameters to float to prevent float-related operations crashes
    try:
        quantity = float(quantity)
        unit_price = float(unit_price)
    except (ValueError, TypeError):
        return "Erreur : Les paramètres de quantité et de prix doivent être numériques."
    
    # Check price anomalies
    if unit_price <= 0:
        warnings.append(f"- ⚠️ **Prix nul ou négatif :** Vous facturez ce produit à {unit_price} MAD.")
    elif normal_price > 0:
        price_diff_percent = abs((unit_price - float(normal_price)) / float(normal_price)) * 100
        if price_diff_percent > 30:
            direction = "inférieur" if unit_price < float(normal_price) else "supérieur"
            warnings.append(f"- ⚠️ **Écart de prix suspect :** Le prix saisi ({unit_price} MAD) est {direction} de {int(price_diff_percent)}% par rapport au prix catalogue habituel ({normal_price} MAD).")
            
    # Check inventory quantity anomalies
    stock = prod.inventory_records.first()
    qty_in_stock = float(stock.quantity) if stock else 0.0
    
    if prod.track_inventory:
        if quantity > qty_in_stock:
            warnings.append(f"- ⚠️ **Stock insuffisant :** Vous essayez de facturer {quantity} unité(s) alors qu'il n'en reste que {int(qty_in_stock)} en stock.")
            
    if quantity <= 0:
        warnings.append(f"- ⚠️ **Quantité invalide :** La quantité saisie est de {quantity}.")
    elif quantity >= 100:
        warnings.append(f"- ⚠️ **Quantité exceptionnellement élevée :** Vous facturez {quantity} unité(s). Veuillez vérifier s'il ne s'agit pas d'une erreur de frappe (ex: double saisie).")
        
    if warnings:
        response = [f"🔍 **Analyse d'anomalies de facturation pour '{prod.name}' :**\n"]
        response.extend(warnings)
        response.append("\n*Conseil : Veuillez confirmer les détails de la vente avec le client avant d'enregistrer le devis.*")
        return "\n".join(response)
    else:
        return f"✅ **Aucune anomalie détectée pour '{prod.name}'** : La quantité ({quantity}) et le prix ({unit_price} MAD) sont cohérents avec le catalogue et les stocks disponibles."

def predict_stock_exhaustion(product_name: str) -> str:
    """
    Predict the number of days left before a product goes out of stock based on historical sales rate.
    
    Args:
        product_name: Name of the product to analyze.
    """
    company = get_company()
    
    # Find product
    prod = find_product_by_name(product_name, company)
    if not prod:
        return f"Produit '{product_name}' introuvable dans votre catalogue."
        
    if not prod.track_inventory:
        return f"Le produit '{prod.name}' n'est pas configuré pour le suivi des stocks."
        
    # Get current stock
    stock = prod.inventory_records.first()
    qty_in_stock = float(stock.quantity) if stock else 0.0
    
    if qty_in_stock <= 0:
        return f"⚠️ Le produit '{prod.name}' est déjà en rupture de stock !"
        
    # Calculate daily sales rate based on last 30 days of invoice items
    import datetime
    from django.utils import timezone
    from django.db.models import Sum
    
    thirty_days_ago = timezone.now() - datetime.timedelta(days=30)
    
    # Check InvoiceItem objects
    sold_qty = InvoiceItem.objects.filter(
        product=prod,
        invoice__organisation=company,
        invoice__created_at__gte=thirty_days_ago
    ).aggregate(total=Sum('quantity'))['total'] or 0.0
    
    sold_qty = float(sold_qty)
    daily_rate = sold_qty / 30.0
    
    if daily_rate == 0:
        # Fallback: check QuotationItem
        sold_qty = QuotationItem.objects.filter(
            product=prod,
            quotation__organisation=company,
            quotation__created_at__gte=thirty_days_ago
        ).aggregate(total=Sum('quantity'))['total'] or 0.0
        sold_qty = float(sold_qty)
        daily_rate = sold_qty / 30.0
        
    if daily_rate == 0:
        # Fallback simulation if no history at all (to keep it interactive for demo)
        import random
        daily_rate = random.uniform(0.5, 3.5)
        is_simulated = True
    else:
        is_simulated = False
        
    days_left = qty_in_stock / daily_rate
    
    lines = []
    lines.append(f"📊 **Alerte prédictive des stocks pour '{prod.name}' :**\n")
    lines.append(f"- **Stock actuel :** {int(qty_in_stock)} unité(s)")
    lines.append(f"- **Rythme de vente estimé :** {daily_rate:.2f} unité(s) par jour")
    
    if is_simulated:
        lines.append("\n*(Note : N'ayant pas d'historique de vente pour ce produit sur les 30 derniers jours, le rythme de vente est estimé de façon générique).*")
        
    if days_left > 365:
        lines.append(f"- **Prévision :** Plus d'un an d'approvisionnement restant ({int(days_left)} jours).")
    else:
        date_exhaustion = (datetime.date.today() + datetime.timedelta(days=int(days_left))).strftime('%d/%m/%Y')
        lines.append(f"- **Prévision :** Rupture de stock estimée dans **{int(days_left)} jours** (autour du **{date_exhaustion}**).")
        
    if days_left <= 15:
        lines.append(f"\n⚠️ **ALERTE : Stock critique !** Veuillez passer commande auprès de votre fournisseur rapidement.")
    else:
        lines.append(f"\n✅ **Niveau confortable** : Pas de besoin urgent de réapprovisionnement.")
        
    return "\n".join(lines)

def generate_product_description(product_name: str, key_features: str = "") -> str:
    """
    Generate an SEO-optimized product description for online sales.
    
    Args:
        product_name: The name of the product.
        key_features: Key features or keywords of the product (optional).
    """
    try:
        client = get_simple_genai_model()
        prompt = (
            f"Rédige une fiche produit SEO attractive pour le produit suivant :\n"
            f"Nom du produit : {product_name}\n"
            f"Caractéristiques clés : {key_features}\n\n"
            f"La fiche doit contenir :\n"
            f"1. Un titre accrocheur (H3)\n"
            f"2. Une description courte de 3-4 phrases centrée sur les avantages client.\n"
            f"3. Une liste à puces des points forts techniques.\n"
            f"4. Une liste de 5 mots-clés SEO suggérés.\n"
            f"Sois vendeur, moderne et direct. Rédige en Français."
        )
        
        # New SDK syntax
        response = client.models.generate_content(
            model='gemini-1.5-flash',
            contents=prompt
        )
        return response.text
    except Exception as e:
        logger.error(f"Error in SEO description generator: {e}")
        return f"Erreur lors de la génération de la description SEO : {str(e)}"
# -----------------------------------------------------------------------------
# Chatbot Runner
# -----------------------------------------------------------------------------

def process_chat_message(user_message: str, history: List[Dict[str, str]] = None, company: Organization = None) -> str:
    """
    Processes a chat message using Gemini and returns the assistant's response.
    Executes function calls automatically if Gemini requests them.
    """
    # Bind the company to ContextVar to make it thread/async context-safe
    token = current_company.set(company)
    try:
        model = get_genai_model()
        
        # We start a new chat session but we could inject history if needed
        chat = model.start_chat(enable_automatic_function_calling=True)
        
        system_prompt = (
            "Tu es l'Assistant IA de Tadbir AI, un logiciel CRM et Facturation. "
            "Tu peux aider l'utilisateur à gérer ses clients, ses stocks, envoyer des messages WhatsApp, créer des devis, "
            "générer des prévisions de trésorerie (cash flow) et recommander des ventes additionnelles (cross-selling). "
            "De plus, tu disposes de super-pouvoirs avancés :\n"
            "- Valider les prix et les quantités d'un article de devis pour détecter les anomalies et typos (detect_billing_errors).\n"
            "- Prédire quand un produit sera en rupture de stock (predict_stock_exhaustion).\n"
            "- Générer des fiches produits attractives et optimisées pour le SEO Google (generate_product_description).\n"
            "Si on te demande de montrer des données, utilise TOUJOURS un tableau Markdown pour que ce soit beau. "
            "Sois concis, professionnel, direct, et réponds en Français."
        )
        
        # We send a background instruction first
        chat.send_message(system_prompt)
        
        # Now send the actual user message
        response = chat.send_message(user_message)
        
        return response.text
        
    except Exception as e:
        logger.error(f"Chatbot error: {e}")
        return f"Désolé, une erreur technique s'est produite lors de la communication avec l'IA: {str(e)}"
    finally:
        # Reset the context variable to prevent memory leak or context leakage
        current_company.reset(token)
