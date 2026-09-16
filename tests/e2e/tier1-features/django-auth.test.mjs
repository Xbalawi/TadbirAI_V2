/**
 * Tier 1 Test Suite: Django Authentication & JWT Security
 * Covers Features 9, 11, and 14
 */

import { TestHarness, assert } from '../helpers/test-harness.mjs';
import { MockBackendServer } from '../helpers/mock-backend-server.mjs';

export function createDjangoAuthSuite() {
  const harness = new TestHarness('Tier 1 — Django Authentication & JWT Security');
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

  // Test 1: Successful JWT Login
  harness.test('Feature 14: Valid user credentials return access and refresh JWT tokens', async () => {
    const res = await fetch(`${backendMock.url}/api/auth/token/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'admin@alpha.com',
        password: 'secure_password_123',
      }),
    });

    assert.strictEqual(res.status, 200, 'Login should succeed with HTTP 200');
    const data = await res.json();
    assert.ok(data.access, 'Response must include JWT access token');
    assert.ok(data.refresh, 'Response must include JWT refresh token');
    assert.strictEqual(data.user.email, 'admin@alpha.com');
  });

  // Test 2: Authentication Failure
  harness.test('Feature 14: Invalid credentials return HTTP 401 with standard error format', async () => {
    const res = await fetch(`${backendMock.url}/api/auth/token/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'admin@alpha.com',
        password: 'wrong_password',
      }),
    });

    assert.strictEqual(res.status, 401, 'Invalid password should yield HTTP 401');
    const data = await res.json();
    assert.ok(data.detail, 'Response must contain detail error message');
  });

  // Test 3: Dev Mode Auth Bypass Removal (Feature 9)
  harness.test('Feature 9: Unauthenticated requests to protected endpoints return HTTP 401 without bypass', async () => {
    const res = await fetch(`${backendMock.url}/api/invoices/`, {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
    });

    assert.strictEqual(
      res.status,
      401,
      'Protected endpoints must never return data to unauthenticated callers (no DEBUG bypass)'
    );
    const data = await res.json();
    assert.ok(data.detail, 'Must reject with token not valid');
  });

  // Test 4: Token Refresh Workflow
  harness.test('Feature 14: Valid refresh token issues a refreshed access token', async () => {
    const res = await fetch(`${backendMock.url}/api/auth/token/refresh/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        refresh: 'valid_refresh_usr-admin-alpha',
      }),
    });

    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.ok(data.access, 'Refreshed access token must be returned');
  });

  // Test 5: Role Deserialization & User Creation (Feature 11)
  harness.test('Feature 11: User creation / invite correctly deserializes role without database IntegrityError', async () => {
    const res = await fetch(`${backendMock.url}/api/auth/invite/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer valid_token_alpha',
      },
      body: JSON.stringify({
        email: 'newhire@alpha.com',
        nom: 'Nouveau Salarié',
        role: 'COMMERCIAL',
      }),
    });

    assert.strictEqual(res.status, 201, 'User invitation should succeed with HTTP 201');
    const user = await res.json();
    assert.strictEqual(user.role, 'COMMERCIAL', 'Role must be properly persisted');
    assert.strictEqual(user.is_active, false, 'Invited user must start as inactive');
    assert.strictEqual(user.organisation, 'org-alpha', 'User must be linked to caller tenant');
  });

  // Test 6: Invite User Payload Validation
  harness.test('Feature 10 & 14: InviteUserView rejects empty or invalid email address with HTTP 400', async () => {
    const res = await fetch(`${backendMock.url}/api/auth/invite/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer valid_token_alpha',
      },
      body: JSON.stringify({
        email: 'invalid-email-string',
        nom: 'Test',
      }),
    });

    assert.strictEqual(res.status, 400, 'Invalid email must produce HTTP 400');
    const err = await res.json();
    assert.ok(err.email, 'Validation error must be attached to email field');
  });

  return harness;
}
