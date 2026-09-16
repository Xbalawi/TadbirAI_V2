/**
 * Tier 3 Test Suite: Cross-Feature Combinations — Multi-Tenant Lifecycle & Composite Isolation
 * Validates concurrent tenant operations, shared document codes, and relationship isolation.
 */

import { TestHarness, assert } from '../helpers/test-harness.mjs';
import { MockBackendServer } from '../helpers/mock-backend-server.mjs';

export function createMultiTenantLifecycleSuite() {
  const harness = new TestHarness('Tier 3 — Multi-Tenant Lifecycle & Composite Isolation');
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

  harness.test('Scenario 3.2: Concurrent tenants create identically numbered invoices without cross-leakage', async () => {
    // 1. Tenant Alpha creates Invoice FAC-2026-999
    const resA = await fetch(`${backendMock.url}/api/invoices/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer valid_token_alpha',
      },
      body: JSON.stringify({
        invoice_number: 'FAC-2026-999',
        client_name: 'Client Alpha Maroc',
        total_amount: 10000.0,
      }),
    });
    assert.strictEqual(resA.status, 201);
    const invoiceA = await resA.json();
    assert.strictEqual(invoiceA.organisation, 'org-alpha');

    // 2. Tenant Beta creates Invoice with the exact same invoice_number FAC-2026-999
    const resB = await fetch(`${backendMock.url}/api/invoices/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer valid_token_beta',
      },
      body: JSON.stringify({
        invoice_number: 'FAC-2026-999',
        client_name: 'Client Beta Tanger',
        total_amount: 25000.0,
      }),
    });
    assert.strictEqual(resB.status, 201);
    const invoiceB = await resB.json();
    assert.strictEqual(invoiceB.organisation, 'org-beta');

    // 3. Add InvoiceItems to each
    const itemResA = await fetch(`${backendMock.url}/api/invoice-items/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer valid_token_alpha',
      },
      body: JSON.stringify({
        invoice: invoiceA.id,
        description: 'Alpha Service Line',
        unit_price: 10000.0,
      }),
    });
    assert.strictEqual(itemResA.status, 201);

    const itemResB = await fetch(`${backendMock.url}/api/invoice-items/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer valid_token_beta',
      },
      body: JSON.stringify({
        invoice: invoiceB.id,
        description: 'Beta Hardware Line',
        unit_price: 25000.0,
      }),
    });
    assert.strictEqual(itemResB.status, 201);

    // 4. Query from Tenant Alpha: MUST NOT see Beta's invoice or item
    const listA = await (
      await fetch(`${backendMock.url}/api/invoices/`, {
        headers: { 'Authorization': 'Bearer valid_token_alpha' },
      })
    ).json();
    assert.strictEqual(listA.filter(i => i.invoice_number === 'FAC-2026-999').length, 1);
    assert.strictEqual(listA.find(i => i.invoice_number === 'FAC-2026-999').organisation, 'org-alpha');

    const itemsA = await (
      await fetch(`${backendMock.url}/api/invoice-items/`, {
        headers: { 'Authorization': 'Bearer valid_token_alpha' },
      })
    ).json();
    assert.strictEqual(itemsA.some(item => item.description.includes('Beta')), false);
  });

  return harness;
}
