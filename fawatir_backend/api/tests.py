from django.test import TestCase
from decimal import Decimal
from api.models import (
    Organization, Role, User, Client, Supplier,
    Category, Product, Invoice, Payment, BankAccount,
    Quotation, PurchaseOrder, PosSession, PosSale,
    Department, Employee, Payroll, Inventory, StockMovement, Ticket,
    Permission, AuditLog, Notification, ClientContact, CustomerAddress,
    SupplierAddress, MarketingCampaign, MarketingAd, MarketingMetric,
    ProductVariant, SupplierProduct, InvoiceItem, RecurringInvoice,
    BankTransaction, QuotationItem, PurchaseOrderItem, PosSaleItem,
    PayrollItem,
)


class BaseTestSetup(TestCase):
    """Classe de base : crée les objets communs (Organisation, Role, User)
    réutilisés par la majorité des tests ci-dessous."""

    def setUp(self):
        self.organisation = Organization.objects.create(name="Test Organisation")
        self.role = Role.objects.create(organisation=self.organisation, display_name="Admin")
        self.user = User.objects.create(
            organisation=self.organisation, role=self.role,
            email="test@example.com"
        )


class ClientModelTest(BaseTestSetup):
    def test_creation_client(self):
        client = Client.objects.create(
            organisation=self.organisation, company_name="Client Test",
            email="client@test.com",
        )
        self.assertEqual(client.company_name, "Client Test")
        self.assertEqual(client.organisation, self.organisation)

    def test_client_customer_code_unique(self):
        Client.objects.create(
            organisation=self.organisation, company_name="Client A",
            customer_code="CLI-001",
        )
        with self.assertRaises(Exception):
            Client.objects.create(
                organisation=self.organisation, company_name="Client B",
                customer_code="CLI-001",
            )


class SupplierModelTest(BaseTestSetup):
    def test_creation_fournisseur(self):
        supplier = Supplier.objects.create(
            organisation=self.organisation, company_name="Fournisseur Test",
            supplier_code="FOUR-001",
        )
        self.assertEqual(supplier.company_name, "Fournisseur Test")

    def test_supplier_code_unique(self):
        Supplier.objects.create(
            organisation=self.organisation, company_name="Four A", supplier_code="F-01",
        )
        with self.assertRaises(Exception):
            Supplier.objects.create(
                organisation=self.organisation, company_name="Four B", supplier_code="F-01",
            )


class ProductModelTest(BaseTestSetup):
    def setUp(self):
        super().setUp()
        self.category = Category.objects.create(
            organisation=self.organisation, name="Catégorie Test",
        )

    def test_creation_produit(self):
        product = Product.objects.create(
            organisation=self.organisation, category=self.category,
            name="Produit Test", sku="SKU-001",
            purchase_price=Decimal("50.00"), selling_price=Decimal("80.00"),
        )
        self.assertEqual(product.name, "Produit Test")
        self.assertEqual(product.selling_price, Decimal("80.00"))

    def test_produit_sku_unique(self):
        Product.objects.create(
            organisation=self.organisation, name="Produit A", sku="SKU-100",
        )
        with self.assertRaises(Exception):
            Product.objects.create(
                organisation=self.organisation, name="Produit B", sku="SKU-100",
            )

    def test_produit_lie_a_categorie(self):
        product = Product.objects.create(
            organisation=self.organisation, category=self.category, name="Produit C",
        )
        self.assertEqual(product.category.name, "Catégorie Test")


class InvoiceModelTest(BaseTestSetup):
    def setUp(self):
        super().setUp()
        self.client_obj = Client.objects.create(
            organisation=self.organisation, company_name="Client Test"
        )

    def test_creation_facture(self):
        facture = Invoice.objects.create(
            organisation=self.organisation,
            client=self.client_obj,
            invoice_number="FAC-001",
            subtotal=Decimal("1000.00"),
            tax_amount=Decimal("200.00"),
            total_amount=Decimal("1200.00"),
            balance_due=Decimal("1200.00"),
            created_by=self.user,
        )
        self.assertEqual(facture.invoice_number, "FAC-001")
        self.assertEqual(facture.total_amount, Decimal("1200.00"))

    def test_invoice_number_unique(self):
        Invoice.objects.create(
            organisation=self.organisation, client=self.client_obj,
            invoice_number="FAC-002", total_amount=500,
        )
        with self.assertRaises(Exception):
            Invoice.objects.create(
                organisation=self.organisation, client=self.client_obj,
                invoice_number="FAC-002", total_amount=300,
            )

    def test_facture_balance_due_par_defaut(self):
        facture = Invoice.objects.create(
            organisation=self.organisation, client=self.client_obj,
            invoice_number="FAC-003", total_amount=Decimal("750.00"),
        )
        self.assertEqual(facture.balance_due, Decimal("0.00"))


class PaymentModelTest(BaseTestSetup):
    def setUp(self):
        super().setUp()
        self.client_obj = Client.objects.create(
            organisation=self.organisation, company_name="Client Test"
        )
        self.invoice = Invoice.objects.create(
            organisation=self.organisation, client=self.client_obj,
            invoice_number="FAC-100", total_amount=Decimal("1000.00"),
            balance_due=Decimal("1000.00"),
        )

    def test_creation_paiement(self):
        payment = Payment.objects.create(
            invoice=self.invoice, organisation=self.organisation,
            amount=Decimal("400.00"), payment_method="virement",
            created_by=self.user,
        )
        self.assertEqual(payment.amount, Decimal("400.00"))
        self.assertEqual(payment.invoice, self.invoice)

    def test_paiement_lie_a_bonne_facture(self):
        payment = Payment.objects.create(
            invoice=self.invoice, organisation=self.organisation,
            amount=Decimal("1000.00"),
        )
        self.assertEqual(payment.invoice.invoice_number, "FAC-100")


class QuotationModelTest(BaseTestSetup):
    def setUp(self):
        super().setUp()
        self.client_obj = Client.objects.create(
            organisation=self.organisation, company_name="Client Devis"
        )

    def test_creation_devis(self):
        devis = Quotation.objects.create(
            organisation=self.organisation, client=self.client_obj,
            quotation_number="DEV-001", total_amount=Decimal("500.00"),
        )
        self.assertEqual(devis.quotation_number, "DEV-001")

    def test_quotation_number_unique(self):
        Quotation.objects.create(
            organisation=self.organisation, client=self.client_obj,
            quotation_number="DEV-002",
        )
        with self.assertRaises(Exception):
            Quotation.objects.create(
                organisation=self.organisation, client=self.client_obj,
                quotation_number="DEV-002",
            )


class PurchaseOrderModelTest(BaseTestSetup):
    def setUp(self):
        super().setUp()
        self.supplier = Supplier.objects.create(
            organisation=self.organisation, company_name="Fournisseur BC",
        )

    def test_creation_bon_de_commande(self):
        bc = PurchaseOrder.objects.create(
            organisation=self.organisation, supplier=self.supplier,
            purchase_order_number="BC-001", total_amount=Decimal("2000.00"),
        )
        self.assertEqual(bc.purchase_order_number, "BC-001")
        self.assertEqual(bc.supplier, self.supplier)

    def test_purchase_order_number_unique(self):
        PurchaseOrder.objects.create(
            organisation=self.organisation, supplier=self.supplier,
            purchase_order_number="BC-002",
        )
        with self.assertRaises(Exception):
            PurchaseOrder.objects.create(
                organisation=self.organisation, supplier=self.supplier,
                purchase_order_number="BC-002",
            )


class PosSessionSaleModelTest(BaseTestSetup):
    def test_creation_session_pos(self):
        session = PosSession.objects.create(
            organisation=self.organisation, session_number="POS-SESS-001",
            status="open", created_by=self.user,
        )
        self.assertEqual(session.status, "open")

    def test_creation_vente_pos_liee_a_session(self):
        session = PosSession.objects.create(
            organisation=self.organisation, session_number="POS-SESS-002",
        )
        sale = PosSale.objects.create(
            organisation=self.organisation, session=session,
            sale_number="POS-SALE-001", total_amount=Decimal("150.00"),
            created_by=self.user,
        )
        self.assertEqual(sale.session, session)
        self.assertEqual(sale.total_amount, Decimal("150.00"))


class HumanResourcesModelTest(BaseTestSetup):
    def test_creation_departement_et_employe(self):
        dept = Department.objects.create(
            organisation=self.organisation, name="Ressources Humaines",
        )
        employe = Employee.objects.create(
            organisation=self.organisation, department=dept,
            first_name="Ahmed", last_name="Test",
            employee_number="EMP-001", salary=Decimal("8000.00"),
        )
        self.assertEqual(employe.department.name, "Ressources Humaines")
        self.assertEqual(employe.salary, Decimal("8000.00"))

    def test_employee_number_unique(self):
        Employee.objects.create(
            organisation=self.organisation, employee_number="EMP-100",
        )
        with self.assertRaises(Exception):
            Employee.objects.create(
                organisation=self.organisation, employee_number="EMP-100",
            )

    def test_creation_bulletin_de_paie(self):
        employe = Employee.objects.create(
            organisation=self.organisation, employee_number="EMP-200",
            salary=Decimal("6000.00"),
        )
        payroll = Payroll.objects.create(
            organisation=self.organisation, employee=employe,
            payroll_number="PAY-001", net_salary=Decimal("5400.00"),
        )
        self.assertEqual(payroll.employee, employe)
        self.assertEqual(payroll.net_salary, Decimal("5400.00"))


class ValidationEdgeCaseTest(BaseTestSetup):
    """Tests supplémentaires : cas limites et valeurs par défaut."""

    def test_invoice_sans_montant_utilise_zero_par_defaut(self):
        client_obj = Client.objects.create(
            organisation=self.organisation, company_name="Client Edge",
        )
        facture = Invoice.objects.create(
            organisation=self.organisation, client=client_obj,
            invoice_number="FAC-EDGE-001",
        )
        self.assertEqual(facture.total_amount, Decimal("0.00"))

    def test_produit_inactif_par_defaut_est_actif(self):
        product = Product.objects.create(
            organisation=self.organisation, name="Produit Défaut",
        )
        self.assertTrue(product.is_active)

    def test_client_balance_par_defaut_zero(self):
        client_obj = Client.objects.create(
            organisation=self.organisation, company_name="Client Balance",
        )
        self.assertEqual(client_obj.balance, Decimal("0.00"))


class OrganisationUserModelTest(BaseTestSetup):
    def test_creation_organisation(self):
        self.assertEqual(self.organisation.name, "Test Organisation")

    def test_creation_utilisateur_lie_a_organisation_et_role(self):
        self.assertEqual(self.user.organisation, self.organisation)
        self.assertEqual(self.user.role, self.role)

    def test_email_utilisateur_unique(self):
        User.objects.create(
            organisation=self.organisation, role=self.role, email="unique1@test.com",
        )
        with self.assertRaises(Exception):
            User.objects.create(
                organisation=self.organisation, role=self.role, email="unique1@test.com",
            )


class BankAccountModelTest(BaseTestSetup):
    def test_creation_compte_bancaire(self):
        compte = BankAccount.objects.create(
            organisation=self.organisation, bank_name="Attijariwafa Bank",
            account_number="00112233", current_balance=Decimal("10000.00"),
        )
        self.assertEqual(compte.bank_name, "Attijariwafa Bank")
        self.assertEqual(compte.current_balance, Decimal("10000.00"))

    def test_compte_bancaire_actif_par_defaut(self):
        compte = BankAccount.objects.create(
            organisation=self.organisation, bank_name="Banque Test",
        )
        self.assertTrue(compte.is_active)


class StockModelTest(BaseTestSetup):
    def setUp(self):
        super().setUp()
        self.product = Product.objects.create(
            organisation=self.organisation, name="Produit Stock",
        )

    def test_creation_inventaire(self):
        inventaire = Inventory.objects.create(
            product=self.product, quantity=100,
            available_quantity=100, reorder_level=10,
        )
        self.assertEqual(inventaire.quantity, 100)
        self.assertEqual(inventaire.product, self.product)

    def test_mouvement_de_stock(self):
        mouvement = StockMovement.objects.create(
            product=self.product, movement_type="entree",
            quantity=50, previous_quantity=100, new_quantity=150,
            created_by=self.user,
        )
        self.assertEqual(mouvement.new_quantity, 150)
        self.assertEqual(mouvement.movement_type, "entree")


class TicketModelTest(BaseTestSetup):
    def test_creation_ticket_support(self):
        client_obj = Client.objects.create(
            organisation=self.organisation, company_name="Client Support",
        )
        ticket = Ticket.objects.create(
            organisation=self.organisation, client=client_obj,
            assigned_to=self.user, ticket_number="TCK-001",
            subject="Problème de facturation", priority="haute",
            status="ouvert",
        )
        self.assertEqual(ticket.subject, "Problème de facturation")
        self.assertEqual(ticket.assigned_to, self.user)

    def test_ticket_number_unique(self):
        Ticket.objects.create(organisation=self.organisation, ticket_number="TCK-100")
        with self.assertRaises(Exception):
            Ticket.objects.create(organisation=self.organisation, ticket_number="TCK-100")


class PermissionRoleModelTest(BaseTestSetup):
    def test_creation_permission(self):
        perm = Permission.objects.create(
            module="invoices", name="Créer facture", code="invoice.create",
        )
        self.assertEqual(perm.code, "invoice.create")

    def test_permission_code_unique(self):
        Permission.objects.create(code="perm.unique.test", module="x", name="X")
        with self.assertRaises(Exception):
            Permission.objects.create(code="perm.unique.test", module="y", name="Y")


class AuditLogModelTest(BaseTestSetup):
    def test_creation_audit_log(self):
        log = AuditLog.objects.create(
            organisation=self.organisation, user=self.user,
            module="invoices", action="create", entity="Invoice",
        )
        self.assertEqual(log.action, "create")
        self.assertEqual(log.user, self.user)


class NotificationModelTest(BaseTestSetup):
    def test_creation_notification(self):
        notif = Notification.objects.create(
            organisation=self.organisation, user=self.user,
            title="Nouvelle facture", notification_type="invoice",
        )
        self.assertFalse(notif.is_read)
        self.assertEqual(notif.title, "Nouvelle facture")


class ClientContactAddressModelTest(BaseTestSetup):
    def setUp(self):
        super().setUp()
        self.client_obj = Client.objects.create(
            organisation=self.organisation, company_name="Client Contact",
        )

    def test_creation_contact_client(self):
        contact = ClientContact.objects.create(
            client=self.client_obj, first_name="Sara", last_name="Test",
            email="sara@test.com", is_primary=True,
        )
        self.assertTrue(contact.is_primary)
        self.assertEqual(contact.client, self.client_obj)

    def test_creation_adresse_client(self):
        adresse = CustomerAddress.objects.create(
            client=self.client_obj, address_type="livraison",
            city="Meknès", country="Maroc",
        )
        self.assertEqual(adresse.city, "Meknès")


class SupplierAddressModelTest(BaseTestSetup):
    def test_creation_adresse_fournisseur(self):
        supplier = Supplier.objects.create(
            organisation=self.organisation, company_name="Fournisseur Adresse",
        )
        adresse = SupplierAddress.objects.create(
            supplier=supplier, address_type="facturation", city="Casablanca",
        )
        self.assertEqual(adresse.supplier, supplier)


class MarketingModelTest(BaseTestSetup):
    def test_creation_campagne_marketing(self):
        campagne = MarketingCampaign.objects.create(
            organisation=self.organisation, created_by=self.user,
            campaign_name="Promo Été", platform="facebook",
            budget=Decimal("5000.00"),
        )
        self.assertEqual(campagne.campaign_name, "Promo Été")

    def test_creation_publicite_liee_a_campagne(self):
        campagne = MarketingCampaign.objects.create(
            organisation=self.organisation, campaign_name="Campagne Test",
        )
        pub = MarketingAd.objects.create(
            campaign=campagne, title="Annonce Test", generated_by_ai=True,
        )
        self.assertEqual(pub.campaign, campagne)
        self.assertTrue(pub.generated_by_ai)

    def test_creation_metrique_publicite(self):
        campagne = MarketingCampaign.objects.create(
            organisation=self.organisation, campaign_name="Campagne Metric",
        )
        pub = MarketingAd.objects.create(campaign=campagne, title="Ad Metric")
        metric = MarketingMetric.objects.create(
            ad=pub, impressions=1000, clicks=50, conversions=5,
        )
        self.assertEqual(metric.clicks, 50)


class ProductVariantSupplierProductModelTest(BaseTestSetup):
    def setUp(self):
        super().setUp()
        self.product = Product.objects.create(
            organisation=self.organisation, name="Produit Variant",
        )

    def test_creation_variante_produit(self):
        variant = ProductVariant.objects.create(
            product=self.product, sku="VAR-001",
            variant_name="Taille L", selling_price=Decimal("120.00"),
        )
        self.assertEqual(variant.product, self.product)
        self.assertEqual(variant.sku, "VAR-001")

    def test_creation_produit_fournisseur(self):
        supplier = Supplier.objects.create(
            organisation=self.organisation, company_name="Fournisseur Produit",
        )
        sp = SupplierProduct.objects.create(
            supplier=supplier, product=self.product,
            purchase_price=Decimal("40.00"), preferred_supplier=True,
        )
        self.assertTrue(sp.preferred_supplier)


class InvoiceItemModelTest(BaseTestSetup):
    def test_creation_ligne_facture(self):
        client_obj = Client.objects.create(
            organisation=self.organisation, company_name="Client Ligne",
        )
        invoice = Invoice.objects.create(
            organisation=self.organisation, client=client_obj, invoice_number="FAC-ITEM-001",
        )
        product = Product.objects.create(organisation=self.organisation, name="Produit Ligne")
        item = InvoiceItem.objects.create(
            invoice=invoice, product=product, quantity=Decimal("3.00"),
            unit_price=Decimal("100.00"), line_total=Decimal("300.00"),
        )
        self.assertEqual(item.line_total, Decimal("300.00"))
        self.assertEqual(item.invoice, invoice)


class RecurringInvoiceBankTransactionModelTest(BaseTestSetup):
    def test_creation_facture_recurrente(self):
        client_obj = Client.objects.create(
            organisation=self.organisation, company_name="Client Recurrent",
        )
        recurrente = RecurringInvoice.objects.create(
            organisation=self.organisation, client=client_obj, frequency="mensuel",
        )
        self.assertEqual(recurrente.frequency, "mensuel")

    def test_creation_transaction_bancaire(self):
        compte = BankAccount.objects.create(
            organisation=self.organisation, bank_name="Banque Transaction",
        )
        transaction = BankTransaction.objects.create(
            bank_account=compte, amount=Decimal("500.00"),
            transaction_type="credit",
        )
        self.assertEqual(transaction.bank_account, compte)
        self.assertEqual(transaction.amount, Decimal("500.00"))


class QuotationPurchaseOrderItemModelTest(BaseTestSetup):
    def test_creation_ligne_devis(self):
        client_obj = Client.objects.create(
            organisation=self.organisation, company_name="Client Devis Ligne",
        )
        devis = Quotation.objects.create(
            organisation=self.organisation, client=client_obj, quotation_number="DEV-ITEM-001",
        )
        product = Product.objects.create(organisation=self.organisation, name="Produit Devis")
        ligne = QuotationItem.objects.create(
            quotation=devis, product=product,
            quantity=Decimal("2.00"), unit_price=Decimal("250.00"),
            line_total=Decimal("500.00"),
        )
        self.assertEqual(ligne.line_total, Decimal("500.00"))

    def test_creation_ligne_bon_de_commande(self):
        supplier = Supplier.objects.create(
            organisation=self.organisation, company_name="Fournisseur BC Ligne",
        )
        bc = PurchaseOrder.objects.create(
            organisation=self.organisation, supplier=supplier, purchase_order_number="BC-ITEM-001",
        )
        product = Product.objects.create(organisation=self.organisation, name="Produit BC")
        ligne = PurchaseOrderItem.objects.create(
            purchase_order=bc, product=product,
            quantity=Decimal("10.00"), unit_cost=Decimal("30.00"),
            line_total=Decimal("300.00"),
        )
        self.assertEqual(ligne.purchase_order, bc)


class PosSaleItemPayrollItemModelTest(BaseTestSetup):
    def test_creation_ligne_vente_pos(self):
        session = PosSession.objects.create(
            organisation=self.organisation, session_number="POS-ITEM-SESS",
        )
        sale = PosSale.objects.create(
            organisation=self.organisation, session=session, sale_number="POS-ITEM-001",
        )
        product = Product.objects.create(organisation=self.organisation, name="Produit POS")
        ligne = PosSaleItem.objects.create(
            sale=sale, product=product, quantity=Decimal("1.00"),
            unit_price=Decimal("50.00"), line_total=Decimal("50.00"),
        )
        self.assertEqual(ligne.sale, sale)

    def test_creation_ligne_bulletin_paie(self):
        employe = Employee.objects.create(
            organisation=self.organisation, employee_number="EMP-ITEM-001",
        )
        payroll = Payroll.objects.create(
            organisation=self.organisation, employee=employe, payroll_number="PAY-ITEM-001",
        )
        ligne = PayrollItem.objects.create(
            payroll=payroll, item_name="Prime transport",
            item_type="prime", amount=Decimal("300.00"),
        )
        self.assertEqual(ligne.payroll, payroll)
        self.assertEqual(ligne.amount, Decimal("300.00"))