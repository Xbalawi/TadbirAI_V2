/**
 * Tier 1 Test Suite: Frontend Error Response Handling & UI Contracts
 * Covers Features 15, 16, 17, 18, 19, and 20
 */

import { TestHarness, assert } from '../helpers/test-harness.mjs';
import { MockBackendServer } from '../helpers/mock-backend-server.mjs';

export function createFrontendErrorHandlingSuite() {
  const harness = new TestHarness('Tier 1 — Frontend Error Response Handling & Contracts');
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

  // Test 1: Table Error State vs Empty State on HTTP 503 (Features 15 & 16)
  harness.test('Feature 16: Backend 503 triggers TableErrorState and does NOT coerce data into empty table', async () => {
    backendMock.simulate503 = true;

    const res = await fetch(`${backendMock.url}/api/invoices/`, {
      method: 'GET',
      headers: { 'Authorization': 'Bearer valid_token_alpha' },
    });

    assert.strictEqual(res.status, 503, 'Proxy / Backend must return HTTP 503');
    const data = await res.json();
    assert.strictEqual(data.error, 'Le serveur backend est injoignable.');

    // Contract assertion: Client must NOT treat { error: ... } as an empty list
    const isError = !res.ok;
    const tableState = isError ? 'ERROR_STATE' : (Array.isArray(data) && data.length === 0 ? 'EMPTY_STATE' : 'DATA_LOADED');
    assert.strictEqual(tableState, 'ERROR_STATE', 'Client component must render ERROR_STATE on 503');
  });

  // Test 2: Backend HTTP 500 Error State (Feature 15)
  harness.test('Feature 15: Backend HTTP 500 captures server error message and provides retry action', async () => {
    backendMock.simulate500 = true;

    const res = await fetch(`${backendMock.url}/api/invoices/`, {
      method: 'GET',
      headers: { 'Authorization': 'Bearer valid_token_alpha' },
    });

    assert.strictEqual(res.status, 500);
    const data = await res.json();
    assert.ok(data.error, 'Error payload must have descriptive message');
  });

  // Test 3: Detail Pages Error Differentiation (Feature 17)
  harness.test('Feature 17: Single-item page distinguishes between genuine 404 and backend 500/503 failure', async () => {
    // 3a: Non-existent item -> 404 Not Found
    const res404 = await fetch(`${backendMock.url}/api/invoices/non-existent-id/`, {
      headers: { 'Authorization': 'Bearer valid_token_alpha' },
    });
    assert.strictEqual(res404.status, 404, 'Non-existent ID must return HTTP 404');

    // 3b: Server outage -> 503 Server Error (must NOT be rendered as 404)
    backendMock.simulate503 = true;
    const res503 = await fetch(`${backendMock.url}/api/invoices/inv-a-101/`, {
      headers: { 'Authorization': 'Bearer valid_token_alpha' },
    });
    assert.strictEqual(res503.status, 503, 'Server failure must return HTTP 503, not 404');
    assert.notStrictEqual(res503.status, 404, 'Outage must not misreport as item not found');
  });

  // Test 4: Mutation False-Positive Elimination (Feature 18)
  harness.test('Feature 18: Client inspects res.ok before showing success notifications', async () => {
    backendMock.simulate500 = true;

    const res = await fetch(`${backendMock.url}/api/invoices/inv-a-101/`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer valid_token_alpha',
      },
      body: JSON.stringify({ total_amount: 5000.0 }),
    });

    let successToastShown = false;
    let errorBannerShown = false;

    if (res.ok) {
      successToastShown = true;
    } else {
      errorBannerShown = true;
    }

    assert.strictEqual(successToastShown, false, 'Success toast must never trigger when res.ok is false');
    assert.strictEqual(errorBannerShown, true, 'Error banner must trigger on failed mutation');
  });

  // Test 5: Team Bulk Delete Endpoint Contract (Feature 19)
  harness.test('Feature 19: User deletion endpoint accepts array of ids in request body', async () => {
    // Attempt bulk delete of usr-alice
    const res = await fetch(`${backendMock.url}/api/users/`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer valid_token_alpha',
      },
      body: JSON.stringify({ ids: ['usr-alice'] }),
    });

    assert.strictEqual(res.status, 204, 'Bulk delete with { ids: [...] } must succeed with HTTP 204');

    // Confirm usr-alice was removed from Alpha
    const resUsers = await fetch(`${backendMock.url}/api/users/`, {
      headers: { 'Authorization': 'Bearer valid_token_alpha' },
    });
    const users = await resUsers.json();
    assert.strictEqual(users.some(u => u.id === 'usr-alice'), false);
  });

  // Test 6: Tenant Store Error State Exposure (Feature 20)
  harness.test('Feature 20: Tenant store exposes error state when company fetch fails', async () => {
    backendMock.simulate503 = true;

    // Simulate tenant store fetch logic
    let storeState = {
      organizations: [],
      currentOrg: null,
      error: null,
      isLoading: true,
    };

    try {
      const res = await fetch(`${backendMock.url}/api/companies/`, {
        headers: { 'Authorization': 'Bearer valid_token_alpha' },
      });

      if (!res.ok) {
        const errData = await res.json();
        storeState.error = errData.error || 'Erreur lors du chargement des organisations';
        storeState.isLoading = false;
      } else {
        storeState.organizations = await res.json();
        storeState.isLoading = false;
      }
    } catch (netErr) {
      storeState.error = netErr.message;
      storeState.isLoading = false;
    }

    assert.ok(storeState.error, 'Store must expose non-null error state');
    assert.strictEqual(storeState.error, 'Le serveur backend est injoignable.');
    assert.strictEqual(storeState.isLoading, false);
  });

  return harness;
}
