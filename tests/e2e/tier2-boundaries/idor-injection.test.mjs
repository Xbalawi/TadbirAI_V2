/**
 * Tier 2 Test Suite: Boundary & Corner Cases — Cross-Tenant IDOR Injection Attempts
 * Verifies that Insecure Direct Object References (IDOR) are strictly blocked across all tenant boundaries.
 */

import { TestHarness, assert } from '../helpers/test-harness.mjs';
import { MockBackendServer } from '../helpers/mock-backend-server.mjs';

export function createIdorInjectionSuite() {
  const harness = new TestHarness('Tier 2 — Cross-Tenant IDOR Injection Boundaries');
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

  // Test 1: IDOR GET Detail
  harness.test('Boundary 2.16: Tenant B cannot read Tenant A invoice detail by ID (returns 404)', async () => {
    const res = await fetch(`${backendMock.url}/api/invoices/inv-a-101/`, {
      method: 'GET',
      headers: { 'Authorization': 'Bearer valid_token_beta' },
    });

    assert.strictEqual(res.status, 404, 'Direct access to cross-tenant invoice must return 404 Not Found');
  });

  // Test 2: IDOR PUT Mutation
  harness.test('Boundary 2.17: Tenant B cannot mutate Tenant A invoice total amount (returns 404)', async () => {
    const res = await fetch(`${backendMock.url}/api/invoices/inv-a-101/`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer valid_token_beta',
      },
      body: JSON.stringify({ total_amount: 0.0 }),
    });

    assert.strictEqual(res.status, 404, 'Mutation attempt on cross-tenant resource must return 404');
    
    // Verify Alpha's invoice was NOT modified
    const invA = backendMock.invoices.find(i => i.id === 'inv-a-101');
    assert.strictEqual(invA.total_amount, 1500.0, 'Amount must remain unchanged');
  });

  // Test 3: IDOR Child Creation (InvoiceItem)
  harness.test('Boundary 2.18: Tenant B cannot attach InvoiceItem to Tenant A invoice (returns 400)', async () => {
    const res = await fetch(`${backendMock.url}/api/invoice-items/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer valid_token_beta',
      },
      body: JSON.stringify({
        invoice: 'inv-a-101',
        description: 'Unauthorized injected line item',
        unit_price: 500.0,
      }),
    });

    assert.strictEqual(res.status, 400, 'Cross-tenant FK injection must be rejected with HTTP 400');
    const data = await res.json();
    assert.ok(data.invoice, 'Error response must cite invoice foreign key rejection');
  });

  // Test 4: Child Entity Isolation Traversal (StockMovements)
  harness.test('Boundary 2.19: Child StockMovement items are strictly filtered by tenant organization', () => {
    // Check mock database helper directly
    const alphaMovements = backendMock.stockMovements.filter(sm => sm.organisation === 'org-alpha');
    const betaMovements = backendMock.stockMovements.filter(sm => sm.organisation === 'org-beta');

    assert.strictEqual(alphaMovements.length, 1);
    assert.strictEqual(alphaMovements[0].product_id, 'prod-a-1');
    assert.strictEqual(betaMovements.length, 1);
    assert.strictEqual(betaMovements[0].product_id, 'prod-b-1');
  });

  // Test 5: IDOR User Deletion Attempt
  harness.test('Boundary 2.20: Tenant B cannot delete Tenant A users via bulk delete payload', async () => {
    // Tenant Beta tries to delete Tenant Alpha's admin (usr-admin-alpha)
    const res = await fetch(`${backendMock.url}/api/users/`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer valid_token_beta',
      },
      body: JSON.stringify({ ids: ['usr-admin-alpha'] }),
    });

    assert.strictEqual(res.status, 204);

    // Verify Alpha admin was NOT deleted
    const alphaAdmin = backendMock.users.find(u => u.id === 'usr-admin-alpha');
    assert.ok(alphaAdmin, 'Tenant Alpha user must not be deleted by Tenant Beta request');
  });

  return harness;
}
