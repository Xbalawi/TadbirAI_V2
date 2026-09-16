import { GoogleGenAI } from "@google/genai";
import { NextResponse } from "next/server";
import { 
  getClients, 
  getSuppliers, 
  getProducts, 
  getQuotations, 
  getInvoices, 
  addClient, 
  addProduct, 
  addQuotation, 
  addInvoice,
  updateInvoice
} from "@/lib/data-store";


// ==========================================================================
// FUZZY MATCHING UTILITIES
// ==========================================================================

/** Levenshtein distance between two strings */
function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[m][n];
}

/** Similarity score 0-1 between two strings (case-insensitive, accent-normalized) */
function similarity(a: string, b: string): number {
  const na = normalize(a);
  const nb = normalize(b);
  if (na === nb) return 1;
  const maxLen = Math.max(na.length, nb.length);
  if (maxLen === 0) return 1;
  return 1 - levenshtein(na, nb) / maxLen;
}

/** Normalize: lowercase, strip accents, remove extra whitespace */
function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, "")
    .trim()
    .replace(/\s+/g, " ");
}

/** Check if a word fuzzy-matches any word in a name */
function fuzzyWordMatch(query: string, target: string, threshold = 0.55): boolean {
  const qWords = normalize(query).split(" ");
  const tWords = normalize(target).split(" ");
  return qWords.some(q =>
    q.length >= 2 && tWords.some(t => t.length >= 2 && similarity(q, t) >= threshold)
  );
}

/** Check if user text contains any of the phrases (flexible matching) */
function containsAny(text: string, phrases: string[]): boolean {
  const n = normalize(text);
  return phrases.some(p => n.includes(normalize(p)));
}

/** Extract a name from user text (very flexible) */
function extractName(text: string): string | null {
  // Try quoted text first: "name" or «name»
  const quoted = text.match(/["«]([^"»]+)["»]/);
  if (quoted) return quoted[1].trim();

  // Try after keywords
  const afterKeyword = text.match(/(?:client|nommé|appelé|nommee|appele|pour)\s+(.+?)(?:\s+(?:de|avec|et|dans|sur|a|à|,|\.|$))/i);
  if (afterKeyword) return afterKeyword[1].trim();

  // Try to capture capitalized words (names)
  const caps = text.match(/(?:client|nommé|appelé|pour)\s+([A-ZÀ-ÿ][a-zà-ÿ]+(?:\s+[A-ZÀ-ÿ][a-zà-ÿ]+)*)/i);
  if (caps) return caps[1].trim();

  // Fallback: grab text after "client"
  const afterClient = text.match(/client\s+(.+)/i);
  if (afterClient) {
    const cleaned = afterClient[1].replace(/[.,!?]+$/, "").trim();
    if (cleaned.length > 1 && cleaned.length < 60) return cleaned;
  }

  return null;
}

/** Extract amount from text (e.g., "5000 MAD", "5000", "5 000") */
function extractAmount(text: string): number | null {
  const match = text.match(/(\d[\d\s]*(?:[.,]\d+)?)\s*(?:mad|dh|dirhams?|dhs?|€|eur)?/i);
  if (match) {
    const num = parseFloat(match[1].replace(/\s/g, "").replace(",", "."));
    if (!isNaN(num) && num > 0) return num;
  }
  return null;
}


export async function POST(req: Request) {
  try {
    const body = await req.json();
    const prompt = body.prompt || body.message;
    const langue = body.langue || "fr";

    if (!prompt || typeof prompt !== "string") {
      return NextResponse.json({ error: "Le message est vide." }, { status: 400 });
    }

    const roleHeader = req.headers.get("x-user-role");
    const userRole = roleHeader || body.role || body.userRole || "Lecteur";
    const lowerPrompt = prompt.toLowerCase().trim();

    // Role Permission Flags
    const isReadonly = userRole === "Lecteur";
    const isCommercial = userRole === "Commercial";
    const isComptable = userRole === "Comptable";
    const isAdmin = ["Administrateur", "Admin"].includes(userRole);

    // Intent detection
    const isCreateAction = containsAny(prompt, ["crée", "creer", "ajoute", "ajouter", "fais", "nouvel", "nouveau"]);
    const isClientAction = containsAny(prompt, ["client"]);
    const isInvoiceAction = containsAny(prompt, ["facture"]);
    const isQuotationAction = containsAny(prompt, ["devis"]);
    const isMarkPaidAction = containsAny(prompt, ["marque", "marquer", "regle", "régler", "payer"]) && containsAny(prompt, ["payée", "payee", "réglée", "reglee"]);
    const isExpenseAction = containsAny(prompt, ["dépense", "depense", "charge"]);
    const isStaffQuery = containsAny(prompt, ["employé", "employe", "salarié", "salarie", "paie", "salaire", "bulletin"]);
    const isBankQuery = containsAny(prompt, ["banque", "rapprochement", "relevé", "releve", "bancaire"]);
    const isTeamQuery = containsAny(prompt, ["equipe", "équipe", "rôle", "role", "permission", "inviter", "invitation"]);

    // -------------------------------------------------------------
    // STRICT RBAC GUARDFRAILS (Pre-Execution Permission Checks)
    // -------------------------------------------------------------

    // 1. Read-Only (Lecteur) Restriction for ANY mutation
    if (isReadonly && (isCreateAction || isMarkPaidAction)) {
      return NextResponse.json({
        reply: `### ⛔ Accès refusé (Rôle : Lecteur)\n\nVotre compte dispose d'un profil en **Lecture Seule (Lecteur)**.\n\nVous ne possédez pas les autorisations requises pour effectuer des créations ou des modifications en base de données (clients, factures, devis, etc.).\n\n👉 Seuls les rôles **Administrateur**, **Comptable** ou **Commercial** peuvent créer ou modifier des données.`
      });
    }

    // 2. Commercial Restrictions (No HR/Paie, No Bank, No Expenses)
    if (isCommercial) {
      if (isStaffQuery) {
        return NextResponse.json({
          reply: `### ⛔ Accès restreint (Rôle : Commercial)\n\nLa consultation des fiches de paie, salaires et données confidentielles RH est réservée aux rôles **Administrateur** et **Comptable**.`
        });
      }
      if (isBankQuery) {
        return NextResponse.json({
          reply: `### ⛔ Accès restreint (Rôle : Commercial)\n\nLa consultation et la gestion du **Rapprochement Bancaire** sont réservées aux rôles **Administrateur** et **Comptable**.`
        });
      }
      if (isCreateAction && isExpenseAction) {
        return NextResponse.json({
          reply: `### ⛔ Accès restreint (Rôle : Commercial)\n\nLe rôle **Commercial** permet la création de devis, factures et clients, mais ne permet pas d'enregistrer des dépenses d'entreprise.`
        });
      }
    }

    // 3. Comptable Restrictions (No Team/Role Management)
    if (isComptable && isTeamQuery && isCreateAction) {
      return NextResponse.json({
        reply: `### ⛔ Accès restreint (Rôle : Comptable)\n\nLa gestion de l'équipe et la modification des rôles d'accès sont réservées à l'**Administrateur**.`
      });
    }

    // 4. Non-Admin Team Management Restriction
    if (!isAdmin && isTeamQuery && containsAny(prompt, ["modifie", "modifier", "change", "changer", "supprime", "supprimer", "ajoute", "ajouter"])) {
      return NextResponse.json({
        reply: `### ⛔ Accès restreint (Rôle : ${userRole})\n\nLa modification des membres et des privilèges d'accès dans l'onglet **Équipe & Rôles** est réservée exclusivement à l'**Administrateur**.`
      });
    }

    // 1. Gather Live Database Context
    const storeClients = getClients();
    const storeSuppliers = getSuppliers();
    const storeProducts = getProducts();
    const storeQuotations = getQuotations();
    const storeInvoices = getInvoices();

    // 1. Create Client Action
    if (isCreateAction && isClientAction) {
      const clientName = extractName(prompt) || "Nouveau Client";
      const newCli = addClient({
        company_name: clientName,
        contact_name: "Contact " + clientName,
        phone: "+212 6" + Math.floor(10000000 + Math.random() * 90000000),
        city: "Casablanca"
      });

      return NextResponse.json({
        reply: `### ✅ Client créé avec succès en base de données !\n\n- **Code Client :** \`${newCli.customer_code}\`\n- **Entreprise :** **${newCli.company_name}**\n- **Ville :** Casablanca\n\n👉 Vos tables se synchronisent en temps réel. [Voir tous les Clients](/clients).`,
        event: "clients"
      });
    }

    // 2. Create Invoice Action
    if (isCreateAction && isInvoiceAction) {
      const amount = extractAmount(prompt) || 2500;
      const clientName = extractName(prompt) || (storeClients[0]?.company_name) || "Client";
      const newInv = addInvoice({
        client_name: clientName,
        total_amount: amount,
        status: "Brouillon",
        date: new Date().toISOString().split("T")[0],
        lignes: [{ description: "Prestation de service / Vente", quantite: 1, prix_unitaire: amount }]
      });

      return NextResponse.json({
        reply: `### ✅ Facture créée avec succès !\n\n- **Numéro :** **${newInv.invoice_number}**\n- **Client :** ${clientName}\n- **Montant Total :** **${amount.toLocaleString("fr-FR")} MAD**\n- **Statut :** Brouillon\n- **Date :** ${new Date().toLocaleDateString("fr-FR")}\n\n👉 [Voir les Factures](/factures)`,
        event: "invoices"
      });
    }

    // 3. Create Quotation Action
    if (isCreateAction && isQuotationAction) {
      const amount = extractAmount(prompt) || 1800;
      const clientName = extractName(prompt) || (storeClients[0]?.company_name) || "Client";
      const newQ = addQuotation({
        client_name: clientName,
        total_amount: amount,
        status: "Brouillon",
        date: new Date().toISOString().split("T")[0],
        lignes: [{ description: "Offre / Devis commercial", quantite: 1, prix_unitaire: amount }]
      });

      return NextResponse.json({
        reply: `### 📑 Devis créé avec succès !\n\n- **Numéro :** **${newQ.quotation_number}**\n- **Client :** ${clientName}\n- **Montant estimé :** **${amount.toLocaleString("fr-FR")} MAD**\n- **Statut :** Brouillon\n\n👉 [Consulter les Devis](/devis)`,
        event: "quotations"
      });
    }

    // 4. Mark Invoice Paid Action
    if (isMarkPaidAction || (containsAny(prompt, ["payée", "payee"]) && containsAny(prompt, ["facture"]))) {
      const unpaidInvs = storeInvoices.filter(i => i.status !== "Payée");
      if (unpaidInvs.length > 0) {
        const targetInv = unpaidInvs[0];
        updateInvoice(targetInv.id, { status: "Payée" });
        return NextResponse.json({
          reply: `### 💰 Facture marquée comme Payée avec succès !\n\n- **Facture N° :** **${targetInv.invoice_number}**\n- **Client :** ${targetInv.client_name}\n- **Montant encaissé :** **${targetInv.total_amount.toLocaleString("fr-FR")} MAD**\n- **Nouveau Statut :** ✅ Payée\n\n👉 Le chiffre d'affaires du tableau de bord a été mis à jour instantanément. [Voir les Factures](/factures)`,
          event: "invoices"
        });
      }
    }

    // Consolidated Clients
    const allClients = storeClients.map((c) => ({
      id: c.id,
      nom: c.company_name || c.contact_name || "Client",
      entreprise: c.company_name,
      contact: c.contact_name || "Inconnu",
      tel: c.phone || "Non renseigné",
      ville: c.city || "Maroc",
    }));

    // Consolidated Suppliers
    const allSuppliers = storeSuppliers.map((s) => ({
      id: s.id,
      nom: s.company_name || s.contact_name || "Fournisseur",
      entreprise: s.company_name,
      contact: s.contact_name || "Inconnu",
      tel: s.phone || "Non renseigné",
      ville: s.city || "Maroc",
    }));

    // Consolidated Products
    const allProducts = storeProducts.map((p) => ({
      id: p.id,
      nom: p.name,
      sku: p.sku,
      prix: p.selling_price,
      stock: p.quantity !== undefined ? p.quantity : "Non suivi",
      categorie: p.category_name,
    }));

    // Consolidated Invoices
    const allInvoices = storeInvoices.map((i) => ({
      numero: i.invoice_number,
      client: i.client_name,
      montant: i.total_amount,
      statut: i.status,
      date: i.date,
    }));

    // Consolidated Quotations
    const allQuotations = storeQuotations.map((q) => ({
      numero: q.quotation_number,
      client: q.client_name,
      montant: q.total_amount,
      statut: q.status,
      date: q.date,
    }));

    // Dynamic KPIs
    const totalRevenue = allInvoices.filter(i => i.statut === "Payée").reduce((sum, i) => sum + i.montant, 0);
    const paidInvoicesCount = allInvoices.filter(i => i.statut === "Payée").length;
    const allInvoicesCount = allInvoices.length;
    const dynamicKpis = {
      revenuTotal: totalRevenue,
      facturesPayeesCount: paidInvoicesCount,
      facturesTotalCount: allInvoicesCount,
      tauxRecouvrement: allInvoicesCount > 0 ? Math.round((paidInvoicesCount / allInvoicesCount) * 100) : 0,
      factureMoyenne: paidInvoicesCount > 0 ? Math.round(totalRevenue / paidInvoicesCount) : 0,
    };

    // Filter context data according to role privacy
    const dbContext = {
      userRole,
      kpis: dynamicKpis,
      clientsCount: allClients.length,
      clients: allClients,
      fournisseursCount: allSuppliers.length,
      fournisseurs: allSuppliers,
      produitsCount: allProducts.length,
      produits_et_stocks: allProducts,
      facturesCount: allInvoices.length,
      factures: allInvoices,
      devisCount: allQuotations.length,
      devis: allQuotations,
      depensesCount: (isAdmin || isComptable) ? 1 : 0,
      depenses: (isAdmin || isComptable) ? [] : [],
      employesCount: (isAdmin || isComptable) ? 1 : 0,
      employes: (isAdmin || isComptable) ? [] : []
    };

    // =========================================================
    // 2. CALL GEMINI API
    // =========================================================

    // Call Gemini API if Key is present
    const apiKey = process.env.GEMINI_API_KEY;
    if (apiKey) {
      try {
        const ai = new GoogleGenAI({
          apiKey,
          httpOptions: {
            headers: {
              'User-Agent': 'aistudio-build',
            }
          }
        });

        const systemInstruction = `Tu es Tadbir AI, l'assistant virtuel intelligent connecté à la base de données ERP Tadbir AI.

INFORMATIONS SUR L'UTILISATEUR ACTUEL :
- Rôle d'accès (RBAC) : "${userRole}"

DONNÉES EN TEMPS RÉEL ACCESSIBLES POUR CE RÔLE :
${JSON.stringify(dbContext, null, 2)}

INSTRUCTIONS DE SÉCURITÉ DE RÔLE STRICTES (MANDATORY RBAC) :
1. **Si le rôle est "Lecteur"** : L'utilisateur a un accès STRICTEMENT EN LECTURE SEULE. Tu ne dois JAMAIS accepter ou simuler une création ou modification de donnée (ex: créer un client, émettre une facture/devis). Refuse poliment en expliquant la restriction de son rôle Lecteur.
2. **Si le rôle est "Commercial"** : L'utilisateur n'a PAS LE DROIT d'accéder aux salaires des employés, à la paie, ni au rapprochement bancaire. Si la question porte sur ces sujets confidentiels, REFUSE POLIMENT en indiquant la restriction du rôle Commercial.
3. **Si le rôle est "Comptable"** : L'utilisateur gère la comptabilité mais ne peut pas modifier les rôles d'accès de l'équipe ni la configuration générale.
4. **Si le rôle est "Administrateur"** : Accès complet.

INSTRUCTIONS GÉNÉRALES :
5. Réponds aux questions en exploitant les données ci-dessus.
6. Sois précis, professionnel et courtois.
7. ${langue === "ar" ? "IMPORTANT: Tu DOIS répondre en Arabe الفصحى أو بالدارجة المغربية المكتوبة بصيغة مهنية ومحترفة." : langue === "en" ? "IMPORTANT: You MUST respond in clear, professional English." : "Tu parles en Français (avec un style marocain professionnel)."}`;

        const response = await ai.models.generateContent({
          model: "gemini-3.6-flash",
          contents: prompt,
          config: {
            systemInstruction,
          }
        });

        if (response.text) {
          return NextResponse.json({ reply: response.text });
        }
      } catch (err: any) {
        console.warn("Gemini Chat API call warning, falling back to smart DB parser:", err?.message);
      }
    }

    // ======================================================
    // SMART FALLBACK — Natural Language DB Parser with Fuzzy Matching
    // Runs when Gemini API is unavailable (quota/no key)
    // ======================================================
    let reply = "";

    // --- Extract all meaningful words from the question ---
    const words = lowerPrompt.replace(/[?.,!]/g, "").split(/\s+/).filter(w => w.length >= 2);

    // Reuse intent flags declared above or derive missing ones
    const isStockQuery = containsAny(prompt, ["stock", "disponible", "avez-vous", "avons", "reste", "quantité", "quantite", "inventaire"]);
    const isProductMention = containsAny(prompt, ["produit", "article", "inventaire"]);
    const isClientQuery = containsAny(prompt, ["client", "acheteur", "contact"]);
    const isInvoiceQuery = containsAny(prompt, ["facture", "chiffre", "vente", "impayé", "impaye", "retard"]);
    const isQuotationQuery = containsAny(prompt, ["devis", "proposition", "offre"]);
    const isExpenseQuery = containsAny(prompt, ["dépense", "depense", "fournisseur", "achat"]);
    const isWhatsAppQuery = containsAny(prompt, ["whatsapp", "message", "sms"]);

    // --- STOCK / PRODUCT QUERY (with fuzzy matching) ---
    if (isStockQuery || isProductMention) {
      const stopWords = ["est", "ce", "que", "les", "des", "une", "pour", "dans", "avec", "est", "sont", "vous", "avez", "stock", "produit", "article", "bien", "quel", "combien", "votre", "notre", "mon", "plus", "très", "tres"];
      const productKeywords = words.filter(w => !stopWords.includes(w) && w.length >= 2);

      // Exact substring match first
      let matches = dbContext.produits_et_stocks.filter(p =>
        productKeywords.some(k => normalize(p.nom).includes(normalize(k)))
      );

      // If no exact match, try fuzzy match
      if (matches.length === 0 && productKeywords.length > 0) {
        matches = dbContext.produits_et_stocks.filter(p =>
          productKeywords.some(k => fuzzyWordMatch(k, p.nom, 0.45))
        );
      }

      if (matches.length > 0) {
        const p = matches[0];
        const stockQty = typeof p.stock === "number" ? p.stock : "Non suivi";
        const stockStatus = typeof p.stock === "number" ? (p.stock > 0 ? `✅ **Oui, il en reste ${p.stock} unité(s) en stock.**` : "❌ **Rupture de stock — aucune unité disponible.**") : "ℹ️ Stock non suivi.";
        reply = `### 📦 ${p.nom}\n\n${stockStatus}\n\n- **SKU :** \`${p.sku}\`\n- **Prix unitaire :** ${p.prix} MAD\n- **Stock actuel :** ${stockQty}\n\n` +
          (matches.length > 1 ? `**Autres articles similaires :** ${matches.slice(1, 3).map(m => m.nom).join(", ")}\n\n` : "") +
          `👉 Voir tous les articles dans [Gestion des stocks](/stocks).`;
      } else {
        // No specific match — show all products
        const all = dbContext.produits_et_stocks.slice(0, 8);
        if (all.length === 0) {
          reply = `### 📦 Aucun article en stock\n\nVotre base de données produits est vide pour le moment.\n\n👉 [Ajouter un produit](/stocks)`;
        } else {
          reply = `### 📦 Résultats Stock (${dbContext.produitsCount} articles)\n\n` +
            `| Article | SKU | Prix | Stock |\n| :--- | :--- | :--- | :--- |\n` +
            all.map(p => `| ${p.nom} | \`${p.sku}\` | ${p.prix} MAD | ${p.stock} |`).join("\n") +
            `\n\n👉 [Gérer les stocks](/stocks)`;
        }
      }

    // --- CLIENT QUERY (with fuzzy matching) ---
    } else if (isClientQuery) {
      const clientKeywords = words.filter(w => w.length >= 2 && !["client", "liste", "tous", "voir", "mes", "les"].includes(w));
      
      // Exact match first
      let matches = clientKeywords.length > 0
        ? dbContext.clients.filter(c => clientKeywords.some(k => normalize(c.entreprise || c.nom || "").includes(normalize(k)) || normalize(c.contact || "").includes(normalize(k))))
        : [];

      // Fuzzy match fallback
      if (matches.length === 0 && clientKeywords.length > 0) {
        matches = dbContext.clients.filter(c =>
          clientKeywords.some(k => fuzzyWordMatch(k, c.entreprise || c.nom || "", 0.45) || fuzzyWordMatch(k, c.contact || "", 0.45))
        );
      }

      if (matches.length > 0) {
        reply = `### 👤 Client trouvé : ${matches[0].entreprise || matches[0].nom}\n\n` +
          `- **Contact :** ${matches[0].contact}\n- **Tél :** ${matches[0].tel}\n- **Ville :** ${matches[0].ville}` +
          (matches.length > 1 ? `\n\n**Autres correspondances :** ${matches.slice(1, 3).map(c => c.entreprise || c.nom).join(", ")}` : "") +
          `\n\n👉 Voir tous les [Clients](/clients).`;
      } else if (dbContext.clientsCount === 0) {
        reply = `### 👥 Aucun client enregistré\n\nVotre liste de clients est vide. Commencez par [ajouter un client](/clients).`;
      } else {
        const top5 = dbContext.clients.slice(0, 5);
        reply = `### 👥 Vos Clients (${dbContext.clientsCount} enregistrés)\n\n` +
          top5.map(c => `- **${c.entreprise || c.nom}** (${c.contact}) — 📞 ${c.tel} — 📍 ${c.ville}`).join("\n") +
          `\n\n👉 Liste complète : [Clients](/clients).`;
      }

    // --- INVOICE QUERY ---
    } else if (isInvoiceQuery) {
      const unpaid = dbContext.factures.filter(f => f.statut !== "Payée");
      const paid = dbContext.factures.filter(f => f.statut === "Payée");
      if (dbContext.facturesCount === 0) {
        reply = `### 📊 Aucune facture\n\nIl n'y a aucune facture dans votre base. Créez votre première [Facture](/factures).`;
      } else {
        reply = `### 📊 Synthèse Factures\n\n` +
          `- **Total émises :** ${dbContext.facturesCount} factures\n` +
          `- **Payées :** ${paid.length}\n` +
          `- **En attente / impayées :** ${unpaid.length}\n` +
          `- **CA encaissé :** ${dbContext.kpis.revenuTotal.toLocaleString("fr-FR")} MAD\n` +
          (unpaid.length > 0 ? `\n**Factures non réglées :**\n` + unpaid.slice(0, 5).map(f => `- **${f.numero}** — ${f.client} : **${f.montant} MAD** (${f.statut})`).join("\n") : "\n✅ Toutes vos factures sont payées.") +
          `\n\n👉 [Gérer les Factures](/factures)`;
      }

    // --- QUOTATION QUERY ---
    } else if (isQuotationQuery) {
      reply = `### 📑 Devis (${dbContext.devisCount})\n\n` +
        (dbContext.devisCount === 0 ? "Aucun devis trouvé. 👉 [Créer un devis](/devis)" :
          dbContext.devis.slice(0, 5).map(d => `- **${d.numero}** — ${d.client} : **${d.montant} MAD** — *${d.statut}*`).join("\n") +
          `\n\n👉 [Gérer les Devis](/devis)`);

    // --- EXPENSE QUERY ---
    } else if (isExpenseQuery) {
      const totalDep = dbContext.depenses.reduce((s, d) => s + ((d as any).montant || 0), 0);
      reply = `### 💸 Dépenses & Fournisseurs\n\n` +
        `- **Fournisseurs :** ${dbContext.fournisseursCount}\n` +
        `- **Total dépenses :** ${totalDep.toLocaleString("fr-FR")} MAD\n` +
        (dbContext.depenses.length > 0 ?
          "\n**Dernières dépenses :**\n" + dbContext.depenses.slice(0, 4).map(d => `- **(${(d as any).id})** ${(d as any).fournisseur} — ${(d as any).categorie} : **${(d as any).montant} MAD**`).join("\n") : "\nAucune dépense enregistrée.") +
        `\n\n👉 [Dépenses](/depenses) | [Fournisseurs](/fournisseurs)`;

    // --- STAFF QUERY ---
    } else if (isStaffQuery) {
      reply = `### 👥 Équipe & Paie (${dbContext.employes.length} employés)\n\n` +
        (dbContext.employes.length === 0 ? "Aucun employé enregistré. 👉 [Ajouter un employé](/employes)" :
          dbContext.employes.slice(0, 5).map(e => `- **${(e as any).nom}** — ${(e as any).poste} : ${(e as any).salaireBase} MAD`).join("\n") +
          `\n\n👉 [Bulletins de paie](/bulletins-de-paie)`);

    // --- WHATSAPP QUERY ---
    } else if (isWhatsAppQuery) {
      const unpaid = dbContext.factures.filter(f => f.statut !== "Payée");
      if (unpaid.length > 0 && unpaid[0].client) {
        const f = unpaid[0];
        const cleanPhone = "212600000000";
        const msg = encodeURIComponent(`Bonjour ${f.client}, rappel concernant la facture ${f.numero} de ${f.montant} MAD. Merci de régulariser. Tadbir AI`);
        reply = `### 💬 Message WhatsApp — Relance Facture\n\n**Pour :** ${f.client} — Facture **${f.numero}** (${f.montant} MAD)\n\n> Bonjour ${f.client}, rappel concernant la facture ${f.numero} de ${f.montant} MAD. Merci de régulariser. Tadbir AI\n\n[📱 Envoyer via WhatsApp](whatsapp://send?phone=${cleanPhone}&text=${msg})`;
      } else {
        reply = `### 💬 WhatsApp\n\nAucune facture impayée trouvée. Toutes vos relances sont à jour ! ✅\n\n👉 [Voir les factures](/factures)`;
      }

    // --- GREETING QUERY ---
    } else if (containsAny(prompt, ["bonjour", "salut", "hello", "coucou", "salam", "cv"])) {
      reply = `### 👋 Bonjour !\n\nJe suis Tadbir AI, votre assistant connecté à la base de données. \n\nQue puis-je faire pour vous aujourd'hui ? (Exemples : *Crée le client Hassan*, *Affiche mes factures*, *Cherche le clavier en stock*).`;
    // --- DEFAULT / GENERAL ---
    } else {
      const isEn = langue === "en";
      const isAr = langue === "ar";
      const fallbackReply = isEn 
        ? `### 🤖 Tadbir AI Assistant\n\nI am connected to your database in real time. Here is your dashboard:\n\n` +
          `| Module | Data |\n| :--- | :--- |\n` +
          `| 👥 Clients | ${dbContext.clientsCount} registered |\n` +
          `| 📦 Inventory | ${dbContext.produitsCount} items |\n` +
          `| 📊 Invoices | ${dbContext.facturesCount} (${dbContext.kpis.facturesPayeesCount} paid) |\n` +
          `| 📑 Quotes | ${dbContext.devisCount} |\n` +
          `| 👥 Employees | ${dbContext.employes.length} |\n\n` +
          `**Ask me a question** like:\n- *"Show my clients"*\n- *"Create an invoice for 5000 MAD"*`
        : isAr 
        ? `### 🤖 المساعد الذكي\n\nأنا متصل بقاعدة بياناتك في الوقت الفعلي. إليك لوحة القيادة الخاصة بك:\n\n` +
          `| الوحدة | البيانات |\n| :--- | :--- |\n` +
          `| 👥 العملاء | ${dbContext.clientsCount} مسجل |\n` +
          `| 📦 المخزون | ${dbContext.produitsCount} عنصر |\n` +
          `| 📊 الفواتير | ${dbContext.facturesCount} (${dbContext.kpis.facturesPayeesCount} مدفوعة) |\n` +
          `| 📑 عروض الأسعار | ${dbContext.devisCount} |\n` +
          `| 👥 الموظفين | ${dbContext.employes.length} |\n\n` +
          `**اسألني سؤالاً** مثل:\n- *"اعرض عملائي"*\n- *"أنشئ فاتورة بقيمة 5000 درهم"*`
        : `### 🤖 Assistant Tadbir AI\n\nJe suis connecté à votre base de données en temps réel. Voici votre tableau de bord :\n\n` +
          `| Module | Données |\n| :--- | :--- |\n` +
          `| 👥 Clients | ${dbContext.clientsCount} enregistrés |\n` +
          `| 📦 Produits / Stocks | ${dbContext.produitsCount} références |\n` +
          `| 📊 Factures | ${dbContext.facturesCount} (${dbContext.kpis.facturesPayeesCount} payées) |\n` +
          `| 📑 Devis | ${dbContext.devisCount} |\n` +
          `| 👥 Employés | ${dbContext.employes.length} |\n\n` +
          `**Posez-moi une question** du type :\n- *"Le clavier est-il en stock ?"*\n- *"Montre mes clients"*\n- *"Crée une facture pour Client X de 5000 MAD"*`;

      try {
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
          reply = fallbackReply;
        } else {
          const ai = new GoogleGenAI({ apiKey });
          let response;
          try {
            response = await ai.models.generateContent({
              model: 'gemini-3.6-flash',
              contents: `Tu es Tadbir AI, un assistant IA intelligent pour un logiciel ERP marocain (Facturation, CRM, Stock). 
Réponds de manière professionnelle et très concise. La langue de réponse DOIT être ${langue === "en" ? "Anglais" : langue === "ar" ? "Arabe" : "Français"}. Voici le contexte de la base de données de l'utilisateur:
- Clients: ${dbContext.clientsCount}
- Produits: ${dbContext.produitsCount}
- Factures: ${dbContext.facturesCount} (dont ${dbContext.kpis.facturesPayeesCount} payées)
- Devis: ${dbContext.devisCount}
- Chiffre d'affaires: ${dbContext.kpis.revenuTotal} MAD

L'utilisateur te dit : "${prompt}"`
            });
          } catch (e) {
            response = await ai.models.generateContent({
              model: 'gemini-1.5-flash-latest',
              contents: `Tu es Tadbir AI, un assistant IA intelligent pour un logiciel ERP marocain. Réponds brièvement à : "${prompt}"`
            });
          }
          reply = response.text || fallbackReply;
        }
      } catch (err) {
        console.error("Gemini AI API Error:", err);
        reply = fallbackReply;
      }
    }

    return NextResponse.json({ reply });


  } catch (error: any) {
    console.error("Fatal error in Chat API Route:", error);
    return NextResponse.json(
      { reply: "Je suis connecté à votre système Tadbir AI. Comment puis-je vous assister ?" },
      { status: 200 }
    );
  }
}
