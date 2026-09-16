/**
 * Tier 3 Test Suite: Cross-Feature Combinations — User Account Hijacking Prevention
 * Verifies that invite endpoints reject cross-tenant collision attempts and preserve organization integrity.
 */

import { TestHarness, assert } from '../helpers/test-harness.mjs';
import { MockBackendServer } from '../helpers/mock-backend-server.mjs';
import { MockBrevoServer } from '../helpers/mock-brevo-server.mjs';

export function createHijackPreventionSuite() {
  const harness = new TestHarness('Tier 3 — Account Hijacking Prevention Across Tenants');
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

  harness.test('Scenario 3.4: Cross-tenant invitation collision rejects invite and skips email dispatch', async () => {
    // 1. Tenant Beta attempts to invite 'alice@alpha.com'
    const res = await fetch(`${backendMock.url}/api/auth/invite/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer valid_token_beta',
      },
      body: JSON.stringify({
        email: 'alice@alpha.com',
        nom: 'Alice Hijack Attempt',
        role: 'ADMIN',
      }),
    });

    assert.strictEqual(res.status, 400, 'Cross-tenant invite must be rejected with HTTP 400');
    const errData = await res.json();
    assert.ok(errData.email, 'Validation error must be returned');

    // 2. Verify Alice in database was NOT modified or moved to Beta
    const alice = backendMock.users.find(u => u.email === 'alice@alpha.com');
    assert.strictEqual(alice.organisation, 'org-alpha', 'Alice must remain in org-alpha');

    // 3. Confirm zero email requests reached Brevo
    assert.strictEqual(brevoMock.requests.length, 0, 'No email should be dispatched when invite is rejected');
  });

  return harness;
}
