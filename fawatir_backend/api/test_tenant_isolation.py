from django.contrib.auth.models import User as DjangoUser
from django.test import override_settings
from rest_framework.test import APITestCase, APIClient
from rest_framework import status
from api import models


class TenantIsolationSecurityTestCase(APITestCase):
    """
    TAD-3 (Subtask C) — Tenant Security & IDOR Quality Gate Test Suite.
    Validates strict cross-tenant data isolation and anti-tampering guards
    across Sales, Financial, and HR domains.
    """

    def setUp(self):
        self.client = APIClient()

        # 1. Setup Tenant Alpha
        self.org_alpha = models.Organization.objects.create(
            name="Alpha Corp",
            email="contact@alpha.com",
            currency="MAD",
            country="Maroc"
        )
        self.django_user_alpha = DjangoUser.objects.create_user(
            username="user_alpha",
            email="alpha@corp.com",
            password="SecurePassword123!"
        )
        self.role_alpha = models.Role.objects.create(
            organisation=self.org_alpha,
            display_name="Admin",
            system_name="admin"
        )
        self.api_user_alpha = models.User.objects.create(
            organisation=self.org_alpha,
            role=self.role_alpha,
            email="alpha@corp.com"
        )

        # 2. Setup Tenant Beta
        self.org_beta = models.Organization.objects.create(
            name="Beta Industries",
            email="contact@beta.com",
            currency="EUR",
            country="France"
        )
        self.django_user_beta = DjangoUser.objects.create_user(
            username="user_beta",
            email="beta@industries.com",
            password="SecurePassword123!"
        )
        self.role_beta = models.Role.objects.create(
            organisation=self.org_beta,
            display_name="Admin",
            system_name="admin"
        )
        self.api_user_beta = models.User.objects.create(
            organisation=self.org_beta,
            role=self.role_beta,
            email="beta@industries.com"
        )

        # 3. Seed Tenant Alpha Resources
        self.client_alpha = models.Client.objects.create(
            organisation=self.org_alpha,
            company_name="Client Alpha SA",
            customer_code="CLI-ALPHA-01",
            email="client@alpha.ma"
        )
        self.product_alpha = models.Product.objects.create(
            organisation=self.org_alpha,
            name="Product Alpha",
            sku="SKU-ALPHA-100",
            selling_price=150.00
        )
        self.invoice_alpha = models.Invoice.objects.create(
            organisation=self.org_alpha,
            client=self.client_alpha,
            invoice_number="FAC-ALPHA-001",
            subtotal=150.00,
            total_amount=150.00,
            status="Validée"
        )
        self.bank_alpha = models.BankAccount.objects.create(
            organisation=self.org_alpha,
            account_name="Compte BCP Alpha",
            account_number="RIB-ALPHA-001234",
            current_balance=50000.00
        )
        self.employee_alpha = models.Employee.objects.create(
            organisation=self.org_alpha,
            first_name="Ali",
            last_name="El Mansouri",
            employee_number="EMP-ALPHA-01",
            salary=8500.00
        )

        # 4. Seed Tenant Beta Resources (Target of unauthorized access)
        self.client_beta = models.Client.objects.create(
            organisation=self.org_beta,
            company_name="Client Beta SARL",
            customer_code="CLI-BETA-01",
            email="client@beta.fr"
        )
        self.product_beta = models.Product.objects.create(
            organisation=self.org_beta,
            name="Product Beta Confidential",
            sku="SKU-BETA-999",
            selling_price=999.00
        )
        self.invoice_beta = models.Invoice.objects.create(
            organisation=self.org_beta,
            client=self.client_beta,
            invoice_number="FAC-BETA-SECRET",
            subtotal=999.00,
            total_amount=999.00,
            status="Confidentiel"
        )
        self.bank_beta = models.BankAccount.objects.create(
            organisation=self.org_beta,
            account_name="Compte Attijari Beta",
            account_number="RIB-BETA-987654",
            current_balance=1200000.00
        )
        self.employee_beta = models.Employee.objects.create(
            organisation=self.org_beta,
            first_name="Brahim",
            last_name="Berrada",
            employee_number="EMP-BETA-01",
            salary=25000.00
        )

    # -------------------------------------------------------------
    # 1. SALES & CRM TENANT ISOLATION TESTS
    # -------------------------------------------------------------
    def test_sales_isolation_invoices_list(self):
        """UserAlpha listing invoices must only see Alpha invoices, never Beta."""
        self.client.force_authenticate(user=self.django_user_alpha)
        response = self.client.get('/api/invoices/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        data = response.json()
        invoice_ids = [str(item['id']) for item in (data if isinstance(data, list) else data.get('results', []))]
        self.assertIn(str(self.invoice_alpha.id), invoice_ids)
        self.assertNotIn(str(self.invoice_beta.id), invoice_ids)

    def test_sales_isolation_clients_list(self):
        """UserAlpha listing clients must only see Alpha clients, never Beta."""
        self.client.force_authenticate(user=self.django_user_alpha)
        response = self.client.get('/api/clients/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        data = response.json()
        client_ids = [str(item['id']) for item in (data if isinstance(data, list) else data.get('results', []))]
        self.assertIn(str(self.client_alpha.id), client_ids)
        self.assertNotIn(str(self.client_beta.id), client_ids)

    def test_sales_isolation_products_list(self):
        """UserAlpha listing products must only see Alpha products, never Beta."""
        self.client.force_authenticate(user=self.django_user_alpha)
        response = self.client.get('/api/products/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        data = response.json()
        product_ids = [str(item['id']) for item in (data if isinstance(data, list) else data.get('results', []))]
        self.assertIn(str(self.product_alpha.id), product_ids)
        self.assertNotIn(str(self.product_beta.id), product_ids)

    # -------------------------------------------------------------
    # 2. IDOR ACCESS PREVENTION TESTS (READ, UPDATE, DELETE)
    # -------------------------------------------------------------
    def test_idor_direct_get_beta_invoice_returns_404(self):
        """UserAlpha requesting OrgBeta invoice detail directly must receive 404 Not Found."""
        self.client.force_authenticate(user=self.django_user_alpha)
        response = self.client.get(f'/api/invoices/{self.invoice_beta.id}/')
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_idor_tampering_update_beta_invoice_returns_404(self):
        """UserAlpha attempting to PATCH OrgBeta invoice must receive 404 and not mutate DB."""
        self.client.force_authenticate(user=self.django_user_alpha)
        response = self.client.patch(
            f'/api/invoices/{self.invoice_beta.id}/',
            {'total_amount': 1.00, 'status': 'Compromised'},
            format='json'
        )
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

        # Verify DB remained untouched
        self.invoice_beta.refresh_from_db()
        self.assertEqual(self.invoice_beta.total_amount, 999.00)
        self.assertEqual(self.invoice_beta.status, 'Confidentiel')

    def test_idor_tampering_delete_beta_invoice_returns_404(self):
        """UserAlpha attempting to DELETE OrgBeta invoice must receive 404 and not delete."""
        self.client.force_authenticate(user=self.django_user_alpha)
        response = self.client.delete(f'/api/invoices/{self.invoice_beta.id}/')
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

        # Verify object still exists in DB
        self.assertTrue(models.Invoice.objects.filter(id=self.invoice_beta.id).exists())

    # -------------------------------------------------------------
    # 3. FINANCIAL TENANT ISOLATION TESTS
    # -------------------------------------------------------------
    def test_financial_isolation_bank_accounts(self):
        """UserAlpha must only see Alpha bank accounts, Beta accounts must return 404."""
        self.client.force_authenticate(user=self.django_user_alpha)
        response = self.client.get('/api/bank-accounts/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        data = response.json()
        bank_ids = [str(item['id']) for item in (data if isinstance(data, list) else data.get('results', []))]
        self.assertIn(str(self.bank_alpha.id), bank_ids)
        self.assertNotIn(str(self.bank_beta.id), bank_ids)

        # Direct access to Beta bank account
        detail_res = self.client.get(f'/api/bank-accounts/{self.bank_beta.id}/')
        self.assertEqual(detail_res.status_code, status.HTTP_404_NOT_FOUND)

    # -------------------------------------------------------------
    # 4. HR TENANT ISOLATION TESTS
    # -------------------------------------------------------------
    def test_hr_isolation_employees(self):
        """UserAlpha must only see Alpha employees, Beta employee records must return 404."""
        self.client.force_authenticate(user=self.django_user_alpha)
        response = self.client.get('/api/employees/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        data = response.json()
        emp_ids = [str(item['id']) for item in (data if isinstance(data, list) else data.get('results', []))]
        self.assertIn(str(self.employee_alpha.id), emp_ids)
        self.assertNotIn(str(self.employee_beta.id), emp_ids)

        # Direct access to Beta employee
        detail_res = self.client.get(f'/api/employees/{self.employee_beta.id}/')
        self.assertEqual(detail_res.status_code, status.HTTP_404_NOT_FOUND)

    # -------------------------------------------------------------
    # 5. IDOR PAYLOAD TAMPERING PREVENTION (POST INJECTION TEST)
    # -------------------------------------------------------------
    def test_idor_payload_tampering_injection_neutralized(self):
        """
        If UserAlpha attempts to create an invoice with payload 'organisation: OrgBeta',
        the server must ignore the injected tenant and assign OrgAlpha.
        """
        self.client.force_authenticate(user=self.django_user_alpha)
        payload = {
            'organisation': str(self.org_beta.id),  # Injected IDOR payload
            'client': str(self.client_alpha.id),
            'invoice_number': 'FAC-ALPHA-TAMPER-TEST',
            'subtotal': 500.00,
            'total_amount': 500.00,
            'status': 'Brouillon'
        }
        response = self.client.post('/api/invoices/', payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

        created_invoice_id = response.json()['id']
        created_invoice = models.Invoice.objects.get(id=created_invoice_id)

        # Firmly verify that the invoice belongs to OrgAlpha and NOT OrgBeta
        self.assertEqual(created_invoice.organisation_id, self.org_alpha.id)
        self.assertNotEqual(created_invoice.organisation_id, self.org_beta.id)

    # -------------------------------------------------------------
    # 6. CHILD ENTITY TENANT ISOLATION TESTS (23 CHILD MODELS)
    # -------------------------------------------------------------
    def test_child_isolation_invoice_items_list(self):
        """UserAlpha listing invoice items must only see Alpha items, never Beta."""
        item_alpha = models.InvoiceItem.objects.create(
            invoice=self.invoice_alpha,
            product=self.product_alpha,
            quantity=2,
            unit_price=150.00,
            line_total=300.00
        )
        item_beta = models.InvoiceItem.objects.create(
            invoice=self.invoice_beta,
            product=self.product_beta,
            quantity=1,
            unit_price=999.00,
            line_total=999.00
        )
        self.client.force_authenticate(user=self.django_user_alpha)
        response = self.client.get('/api/invoice-items/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        data = response.json()
        item_ids = [str(item['id']) for item in (data if isinstance(data, list) else data.get('results', []))]
        self.assertIn(str(item_alpha.id), item_ids)
        self.assertNotIn(str(item_beta.id), item_ids)

    def test_child_isolation_invoice_item_detail_beta_returns_404(self):
        """UserAlpha requesting detail of Beta invoice item must receive 404."""
        item_beta = models.InvoiceItem.objects.create(
            invoice=self.invoice_beta,
            product=self.product_beta,
            quantity=1,
            unit_price=999.00,
            line_total=999.00
        )
        self.client.force_authenticate(user=self.django_user_alpha)
        response = self.client.get(f'/api/invoice-items/{item_beta.id}/')
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_child_isolation_quotation_items(self):
        """UserAlpha listing quotation items must only see Alpha items."""
        quotation_alpha = models.Quotation.objects.create(
            organisation=self.org_alpha,
            client=self.client_alpha,
            quotation_number="DEV-ALPHA-01",
            total_amount=200.00
        )
        quotation_beta = models.Quotation.objects.create(
            organisation=self.org_beta,
            client=self.client_beta,
            quotation_number="DEV-BETA-01",
            total_amount=500.00
        )
        q_item_alpha = models.QuotationItem.objects.create(
            quotation=quotation_alpha,
            product=self.product_alpha,
            quantity=1,
            unit_price=200.00,
            line_total=200.00
        )
        q_item_beta = models.QuotationItem.objects.create(
            quotation=quotation_beta,
            product=self.product_beta,
            quantity=1,
            unit_price=500.00,
            line_total=500.00
        )
        self.client.force_authenticate(user=self.django_user_alpha)
        response = self.client.get('/api/quotation-items/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        data = response.json()
        item_ids = [str(item['id']) for item in (data if isinstance(data, list) else data.get('results', []))]
        self.assertIn(str(q_item_alpha.id), item_ids)
        self.assertNotIn(str(q_item_beta.id), item_ids)

    def test_child_isolation_client_contacts(self):
        """UserAlpha must only see Alpha client contacts, never Beta."""
        contact_alpha = models.ClientContact.objects.create(
            client=self.client_alpha,
            first_name="Sara",
            last_name="Alpha",
            email="sara@alpha.com"
        )
        contact_beta = models.ClientContact.objects.create(
            client=self.client_beta,
            first_name="Karim",
            last_name="Beta",
            email="karim@beta.com"
        )
        self.client.force_authenticate(user=self.django_user_alpha)
        response = self.client.get('/api/client-contacts/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        data = response.json()
        ids = [str(item['id']) for item in (data if isinstance(data, list) else data.get('results', []))]
        self.assertIn(str(contact_alpha.id), ids)
        self.assertNotIn(str(contact_beta.id), ids)

    def test_child_isolation_inventory(self):
        """UserAlpha must only see Alpha inventory, never Beta."""
        inv_alpha = models.Inventory.objects.create(
            product=self.product_alpha,
            quantity=50,
            available_quantity=50
        )
        inv_beta = models.Inventory.objects.create(
            product=self.product_beta,
            quantity=100,
            available_quantity=100
        )
        self.client.force_authenticate(user=self.django_user_alpha)
        response = self.client.get('/api/inventory/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        data = response.json()
        ids = [str(item['id']) for item in (data if isinstance(data, list) else data.get('results', []))]
        self.assertIn(str(inv_alpha.id), ids)
        self.assertNotIn(str(inv_beta.id), ids)

    def test_child_isolation_bank_transactions(self):
        """UserAlpha must only see Alpha bank transactions, never Beta."""
        tx_alpha = models.BankTransaction.objects.create(
            bank_account=self.bank_alpha,
            description="Alpha Deposit",
            amount=1000.00
        )
        tx_beta = models.BankTransaction.objects.create(
            bank_account=self.bank_beta,
            description="Beta Secret Wire",
            amount=50000.00
        )
        self.client.force_authenticate(user=self.django_user_alpha)
        response = self.client.get('/api/bank-transactions/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        data = response.json()
        ids = [str(item['id']) for item in (data if isinstance(data, list) else data.get('results', []))]
        self.assertIn(str(tx_alpha.id), ids)
        self.assertNotIn(str(tx_beta.id), ids)

    # -------------------------------------------------------------
    # 7. CROSS-TENANT FOREIGN KEY IDOR INJECTION PREVENTION TESTS
    # -------------------------------------------------------------
    def test_idor_prevent_invoice_item_injection_to_beta_invoice(self):
        """UserAlpha must NOT be allowed to insert InvoiceItem into Beta's invoice."""
        self.client.force_authenticate(user=self.django_user_alpha)
        payload = {
            'invoice': str(self.invoice_beta.id),
            'product': str(self.product_alpha.id),
            'quantity': 10,
            'unit_price': 100.00,
            'line_total': 1000.00
        }
        response = self.client.post('/api/invoice-items/', payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        # Verify no item was attached to Beta's invoice
        self.assertFalse(models.InvoiceItem.objects.filter(invoice=self.invoice_beta).exists())

    def test_idor_prevent_invoice_item_injection_with_beta_product(self):
        """UserAlpha must NOT be allowed to insert InvoiceItem referencing Beta's product."""
        self.client.force_authenticate(user=self.django_user_alpha)
        payload = {
            'invoice': str(self.invoice_alpha.id),
            'product': str(self.product_beta.id),
            'quantity': 1,
            'unit_price': 999.00,
            'line_total': 999.00
        }
        response = self.client.post('/api/invoice-items/', payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_idor_prevent_invoice_referencing_beta_client(self):
        """UserAlpha must NOT be allowed to create an Invoice billing Beta's client."""
        self.client.force_authenticate(user=self.django_user_alpha)
        payload = {
            'client': str(self.client_beta.id),
            'invoice_number': 'FAC-ALPHA-ILLEGAL-CLIENT',
            'subtotal': 100.00,
            'total_amount': 100.00
        }
        response = self.client.post('/api/invoices/', payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_idor_prevent_bank_transaction_injection_to_beta_bank(self):
        """UserAlpha must NOT be allowed to create BankTransaction on Beta's bank account."""
        self.client.force_authenticate(user=self.django_user_alpha)
        payload = {
            'bank_account': str(self.bank_beta.id),
            'description': 'Malicious transaction',
            'amount': 5000.00
        }
        response = self.client.post('/api/bank-transactions/', payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_idor_prevent_client_contact_injection_to_beta_client(self):
        """UserAlpha must NOT be allowed to create ClientContact on Beta's client."""
        self.client.force_authenticate(user=self.django_user_alpha)
        payload = {
            'client': str(self.client_beta.id),
            'contact_name': 'Injected Contact',
            'email': 'injected@bad.com'
        }
        response = self.client.post('/api/client-contacts/', payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    # -------------------------------------------------------------
    # 8. USER INVITATION ISOLATION & ANTI-HIJACKING TESTS
    # -------------------------------------------------------------
    def test_invite_user_prevents_account_hijacking(self):
        """
        Inviting an email that already belongs to another tenant must return 400 Bad Request
        and NOT reassign existing.organisation to inviter's organization.
        """
        self.client.force_authenticate(user=self.django_user_alpha)
        payload = {
            'email': 'beta@industries.com',
            'nom': 'Beta Admin Attempted Hijack',
            'role': 'Admin'
        }
        response = self.client.post('/api/auth/invite/', payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

        # Crucial check: verify that Beta user's organization was NOT hijacked
        self.api_user_beta.refresh_from_db()
        self.assertEqual(self.api_user_beta.organisation_id, self.org_beta.id)
        self.assertNotEqual(self.api_user_beta.organisation_id, self.org_alpha.id)

    def test_invite_user_success_in_same_tenant(self):
        """Inviting a brand new user into Tenant Alpha must succeed."""
        self.client.force_authenticate(user=self.django_user_alpha)
        payload = {
            'email': 'newcollaborator@alpha.com',
            'nom': 'Nouveau Collaborateur',
            'role': 'Commercial'
        }
        response = self.client.post('/api/auth/invite/', payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

        invited = models.User.objects.get(email='newcollaborator@alpha.com')
        self.assertEqual(invited.organisation_id, self.org_alpha.id)
        self.assertFalse(invited.is_active)
        self.assertFalse(invited.email_verified)

    # -------------------------------------------------------------
    # 9. USER SERIALIZER ROLE HANDLING & DESERIALIZATION
    # -------------------------------------------------------------
    def test_user_creation_with_role_string(self):
        """Creating a user via /api/users/ with role='Admin' must succeed without IntegrityError."""
        self.client.force_authenticate(user=self.django_user_alpha)
        payload = {
            'email': 'subadmin@alpha.com',
            'first_name': 'Sub',
            'last_name': 'Admin',
            'role': 'Admin'
        }
        response = self.client.post('/api/users/', payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

        created_user = models.User.objects.get(email='subadmin@alpha.com')
        self.assertEqual(created_user.organisation_id, self.org_alpha.id)
        self.assertIsNotNone(created_user.role_id)

    # -------------------------------------------------------------
    # 10. ROUTING ALIASES (/api/companies/ & /api/company-settings/)
    # -------------------------------------------------------------
    def test_companies_routing_alias(self):
        """Frontend requests to /api/companies/ must succeed (200 OK) and be tenant-scoped."""
        self.client.force_authenticate(user=self.django_user_alpha)
        response = self.client.get('/api/companies/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.json()
        ids = [str(item['id']) for item in (data if isinstance(data, list) else data.get('results', []))]
        self.assertIn(str(self.org_alpha.id), ids)
        self.assertNotIn(str(self.org_beta.id), ids)

    def test_company_settings_routing_alias(self):
        """Frontend requests to /api/company-settings/ must succeed (200 OK)."""
        self.client.force_authenticate(user=self.django_user_alpha)
        response = self.client.get('/api/company-settings/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    # -------------------------------------------------------------
    # 11. ADVERSARIAL STRESS TESTS (CHALLENGER TIER)
    # -------------------------------------------------------------
    @override_settings(DEBUG=True)
    def test_unauthenticated_access_with_debug_true_returns_401(self):
        """Unauthenticated requests when DEBUG=True must return 401 Unauthorized, never leak data."""
        self.client.logout()
        response = self.client.get('/api/invoices/')
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    @override_settings(DEBUG=True)
    def test_unauthenticated_access_with_injected_header_returns_401(self):
        """Unauthenticated requests spoofing X-Organization-Id when DEBUG=True must return 401."""
        self.client.logout()
        response = self.client.get('/api/invoices/', HTTP_X_ORGANIZATION_ID=str(self.org_beta.id))
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_authenticated_cross_tenant_header_override_ignored(self):
        """UserAlpha cannot spoof X-Organization-Id header to view OrgBeta invoices."""
        self.client.force_authenticate(user=self.django_user_alpha)
        response = self.client.get('/api/invoices/', HTTP_X_ORGANIZATION_ID=str(self.org_beta.id))
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.json()
        invoice_ids = [str(item['id']) for item in (data if isinstance(data, list) else data.get('results', []))]
        self.assertIn(str(self.invoice_alpha.id), invoice_ids)
        self.assertNotIn(str(self.invoice_beta.id), invoice_ids)

    def test_idor_prevent_invoice_item_update_cross_tenant_product(self):
        """UserAlpha cannot update an existing invoice item to reference Beta's product."""
        item_alpha = models.InvoiceItem.objects.create(
            invoice=self.invoice_alpha,
            product=self.product_alpha,
            quantity=1,
            unit_price=150.00,
            line_total=150.00
        )
        self.client.force_authenticate(user=self.django_user_alpha)
        response = self.client.patch(
            f'/api/invoice-items/{item_alpha.id}/',
            {'product': str(self.product_beta.id)},
            format='json'
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        item_alpha.refresh_from_db()
        self.assertEqual(item_alpha.product_id, self.product_alpha.id)

     # -------------------------------------------------------------
    # 5. IDOR PAYLOAD TAMPERING PREVENTION (POST INJECTION TEST)
    # -------------------------------------------------------------
    def test_idor_payload_tampering_injection_neutralized(self):
        """
        If UserAlpha attempts to create an invoice with payload 'organisation: OrgBeta',
        the server must ignore the injected tenant and assign OrgAlpha.
        """
        self.client.force_authenticate(user=self.django_user_alpha)
        payload = {
            'organisation': str(self.org_beta.id),  # Injected IDOR payload
            'client': str(self.client_alpha.id),
            'invoice_number': 'FAC-ALPHA-TAMPER-TEST',
            'subtotal': 500.00,
            'total_amount': 500.00,
            'status': 'Brouillon'
        }
        response = self.client.post('/api/invoices/', payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

        created_invoice_id = response.json()['id']
        created_invoice = models.Invoice.objects.get(id=created_invoice_id)

        # Firmly verify that the invoice belongs to OrgAlpha and NOT OrgBeta
        self.assertEqual(created_invoice.organisation_id, self.org_alpha.id)
        self.assertNotEqual(created_invoice.organisation_id, self.org_beta.id)