/**
 * Tier 1 Test Suite: Multi-Tenant Scoping & Cross-Tenant IDOR Protection
 * Covers Features 7, 8, 10, 12, and 13
 */

import { TestHarness, assert } from '../helpers/test-harness.mjs';
import { MockBackendServer } from '../helpers/mock-backend-server.mjs';

export function createTenantIsolationSuite() {
  const harness = new TestHarness('Tier 1 — Multi-Tenant Scoping & IDOR Prevention');
  const backendMock = new MockBackendServer();

  harness.beforeAll(async () => {
    await backendMock.start();
  });

  harness.afterAll(async () => {
    await backendMock.stop();
  });

  harness.beforeEach(() => {
    backendMock.reset();
  });

  // Test 1: Parent Model Scoping (Invoices)
  harness.test('Feature 7: Tenant A and Tenant B retrieve strictly isolated parent invoice lists', async () => {
    // Request from Tenant Alpha
    const resA = await fetch(`${backendMock.url}/api/invoices/`, {
      method: 'GET',
      headers: { 'Authorization': 'Bearer valid_token_alpha' },
    });
    assert.strictEqual(resA.status, 200);
    const invoicesA = await resA.json();
    assert.ok(invoicesA.every(i => i.organisation === 'org-alpha'), 'Alpha must only see Alpha invoices');
    assert.strictEqual(invoicesA.length, 1);
    assert.strictEqual(invoicesA[0].id, 'inv-a-101');

    // Request from Tenant Beta
    const resB = await fetch(`${backendMock.url}/api/invoices/`, {
      method: 'GET',
      headers: { 'Authorization': 'Bearer valid_token_beta' },
    });
    assert.strictEqual(resB.status, 200);
    const invoicesB = await resB.json();
    assert.ok(invoicesB.every(i => i.organisation === 'org-beta'), 'Beta must only see Beta invoices');
    assert.strictEqual(invoicesB.length, 1);
    assert.strictEqual(invoicesB[0].id, 'inv-b-201');
  });

  // Test 2: Child Model Relationship Traversal Scoping (InvoiceItem)
  harness.test('Feature 7: Child entity InvoiceItem is scoped via parent invoice organization traversal', async () => {
    // Request child items from Tenant Beta
    const resB = await fetch(`${backendMock.url}/api/invoice-items/`, {
      method: 'GET',
      headers: { 'Authorization': 'Bearer valid_token_beta' },
    });
    assert.strictEqual(resB.status, 200);
    const itemsB = await resB.json();

    // Verify Beta only receives items belonging to Beta invoices
    assert.strictEqual(itemsB.length, 1);
    assert.strictEqual(itemsB[0].invoice, 'inv-b-201');
    assert.strictEqual(itemsB[0].description, 'Industrial Hardware Beta');

    // Verify Alpha item is completely hidden from Beta
    const hasAlphaItem = itemsB.some(item => item.id === 'item-a-1');
    assert.strictEqual(hasAlphaItem, false, 'Tenant Alpha child items must never leak to Tenant Beta');
  });

  // Test 3: Cross-Tenant Parent Foreign Key IDOR Prevention (Feature 8)
  harness.test('Feature 8: perform_create prevents creating child item linked to another tenant parent FK', async () => {
    // Tenant Beta tries to attach an InvoiceItem to Tenant Alpha's invoice (inv-a-101)
    const res = await fetch(`${backendMock.url}/api/invoice-items/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer valid_token_beta',
      },
      body: JSON.stringify({
        invoice: 'inv-a-101', // Alpha's invoice!
        description: 'Malicious Injected Item',
        unit_price: 9999.0,
      }),
    });

    assert.strictEqual(res.status, 400, 'Cross-tenant parent FK injection must be rejected with HTTP 400');
    const err = await res.json();
    assert.ok(err.invoice, 'Error must identify invalid parent object reference');
  });

  // Test 4: Single Item Direct ID Access Isolation (Feature 7)
  harness.test('Feature 7: Direct GET on another tenant invoice ID returns HTTP 404', async () => {
    // Tenant Beta tries to read Tenant Alpha's invoice inv-a-101
    const res = await fetch(`${backendMock.url}/api/invoices/inv-a-101/`, {
      method: 'GET',
      headers: { 'Authorization': 'Bearer valid_token_beta' },
    });

    assert.strictEqual(res.status, 404, 'Direct access to another tenant resource must yield 404');
    const data = await res.json();
    assert.strictEqual(data.detail, 'Not found.');
  });

  // Test 5: User Account Hijacking Prevention (Feature 10)
  harness.test('Feature 10: Inviting an email belonging to another tenant is blocked with HTTP 400', async () => {
    // Tenant Beta attempts to invite Alice (who already belongs to Tenant Alpha)
    const res = await fetch(`${backendMock.url}/api/auth/invite/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer valid_token_beta',
      },
      body: JSON.stringify({
        email: 'alice@alpha.com',
        nom: 'Alice Hijack Attempt',
        role: 'GESTIONNAIRE',
      }),
    });

    assert.strictEqual(
      res.status,
      400,
      'InviteUserView must reject cross-tenant user re-assignment with HTTP 400'
    );
    const err = await res.json();
    assert.ok(
      err.email[0].includes('autre organisation'),
      'Error message must state that user belongs to another organization'
    );
  });

  // Test 6: Organization API Endpoints Routing (Feature 13)
  harness.test('Feature 13: /api/companies/ and /api/company-settings/ are properly routed and tenant-scoped', async () => {
    const resCompanies = await fetch(`${backendMock.url}/api/companies/`, {
      method: 'GET',
      headers: { 'Authorization': 'Bearer valid_token_alpha' },
    });
    assert.strictEqual(resCompanies.status, 200, '/api/companies/ must return HTTP 200');
    const companies = await resCompanies.json();
    assert.strictEqual(companies[0].id, 'org-alpha');

    const resSettings = await fetch(`${backendMock.url}/api/company-settings/`, {
      method: 'GET',
      headers: { 'Authorization': 'Bearer valid_token_alpha' },
    });
    assert.strictEqual(resSettings.status, 200, '/api/company-settings/ must return HTTP 200');
    const settings = await resSettings.json();
    assert.strictEqual(settings.organisation, 'org-alpha');
  });

  return harness;
}
