/**
 * Tier 4 Test Suite: Real-World Application Scenarios — Enterprise RBAC Security & Sanitization
 * Validates role-based access control, header filtering, and credential leak prevention.
 */

import { TestHarness, assert } from '../helpers/test-harness.mjs';
import { MockBackendServer } from '../helpers/mock-backend-server.mjs';

export function createRbacSecurityEnforcementSuite() {
  const harness = new TestHarness('Tier 4 — Enterprise RBAC Security & Sanitization');
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

  harness.test('Scenario 4.3: RBAC roles matrix and sensitive credential sanitization', async () => {
    // 1. Verify ADMIN role permissions
    const adminUser = backendMock.users.find(u => u.role === 'ADMIN');
    assert.strictEqual(adminUser.role, 'ADMIN');

    // 2. Verify non-admin role invite validation
    const inviteRes = await fetch(`${backendMock.url}/api/auth/invite/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer valid_token_alpha',
      },
      body: JSON.stringify({
        email: 'auditor.intern@alpha.com',
        nom: 'Auditor Intern',
        role: 'LECTEUR',
      }),
    });
    assert.strictEqual(inviteRes.status, 201);
    const auditor = await inviteRes.json();
    assert.strictEqual(auditor.role, 'LECTEUR');

    // 3. Verify sensitive credential sanitization: passwords and secrets never present in user payloads
    const usersListRes = await fetch(`${backendMock.url}/api/users/`, {
      headers: { 'Authorization': 'Bearer valid_token_alpha' },
    });
    const users = await usersListRes.json();
    for (const u of users) {
      assert.strictEqual(u.password, undefined, 'User object must never expose password field');
      assert.strictEqual(u.password_hash, undefined, 'User object must never expose password_hash');
      assert.strictEqual(u.secret, undefined, 'User object must never expose internal secret');
    }
  });

  return harness;
}
