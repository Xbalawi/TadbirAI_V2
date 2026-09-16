/**
 * Tier 2 Test Suite: Boundary & Corner Cases — Empty & Nil Inputs
 * Verifies robust validation against empty strings, nulls, and missing fields.
 */

import { TestHarness, assert } from '../helpers/test-harness.mjs';
import { MockBackendServer } from '../helpers/mock-backend-server.mjs';
import { MockBrevoServer } from '../helpers/mock-brevo-server.mjs';

export function createEmptyInputsSuite() {
  const harness = new TestHarness('Tier 2 — Empty & Nil Input Boundaries');
  const backendMock = new MockBackendServer();
  const brevoMock = new MockBrevoServer();

  harness.beforeAll(async () => {
    await backendMock.start();
    await brevoMock.start();
  });

  harness.afterAll(async () => {
    await backendMock.stop();
    await brevoMock.stop();
  });

  harness.beforeEach(() => {
    backendMock.reset();
    brevoMock.reset();
  });

  // Test 1: Empty Recipient in Invitation
  harness.test('Boundary 2.1: Invite with empty email string "" is rejected with HTTP 400', async () => {
    const res = await fetch(`${backendMock.url}/api/auth/invite/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer valid_token_alpha',
      },
      body: JSON.stringify({ email: '', nom: 'Test User' }),
    });

    assert.strictEqual(res.status, 400, 'Empty email must return HTTP 400');
    const data = await res.json();
    assert.ok(data.email, 'Validation error must be returned for email');
  });

  // Test 2: Whitespace-Only Name and Email
  harness.test('Boundary 2.2: Invite with whitespace-only values is rejected', async () => {
    const res = await fetch(`${backendMock.url}/api/auth/invite/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer valid_token_alpha',
      },
      body: JSON.stringify({ email: '   ', nom: '   ' }),
    });

    assert.strictEqual(res.status, 400);
  });

  // Test 3: Brevo API Key Empty String
  harness.test('Boundary 2.3: Brevo API rejects empty string API key header with HTTP 401', async () => {
    const res = await fetch(`${brevoMock.url}/v3/smtp/email`, {
      method: 'POST',
      headers: {
        'api-key': '',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        sender: { email: 'valid@brevo.com' },
        to: [{ email: 'target@example.com' }],
      }),
    });

    assert.strictEqual(res.status, 401, 'Empty API key must return 401');
  });

  // Test 4: Bulk Delete with Empty Array
  harness.test('Boundary 2.4: Bulk delete endpoint with empty ids array handles safely', async () => {
    const res = await fetch(`${backendMock.url}/api/users/`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer valid_token_alpha',
      },
      body: JSON.stringify({ ids: [] }),
    });

    assert.strictEqual(res.status, 204, 'Empty delete list should succeed as no-op (204)');
  });

  // Test 5: Child InvoiceItem with Missing Parent FK
  harness.test('Boundary 2.5: Invoice item creation with null/empty invoice FK is rejected with HTTP 400', async () => {
    const res = await fetch(`${backendMock.url}/api/invoice-items/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer valid_token_alpha',
      },
      body: JSON.stringify({
        invoice: null,
        description: 'Orphan item',
        unit_price: 100.0,
      }),
    });

    assert.strictEqual(res.status, 400, 'Null parent FK must be rejected with HTTP 400');
  });

  return harness;
}
