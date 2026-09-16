/**
 * Tier 2 Test Suite: Boundary & Corner Cases — Token Expiration & Auth Boundaries
 * Verifies JWT token lifecycle, expiration, tampering rejection, and header formats.
 */

import { TestHarness, assert } from '../helpers/test-harness.mjs';
import { MockBackendServer } from '../helpers/mock-backend-server.mjs';

export function createTokenExpirationSuite() {
  const harness = new TestHarness('Tier 2 — Token Expiration & Auth Boundaries');
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

  // Test 1: Expired Access Token
  harness.test('Boundary 2.11: Expired JWT access token returns HTTP 401 with token invalid error', async () => {
    const res = await fetch(`${backendMock.url}/api/invoices/`, {
      method: 'GET',
      headers: { 'Authorization': 'Bearer expired_token_alpha_9999' },
    });

    assert.strictEqual(res.status, 401, 'Expired token must return HTTP 401');
    const data = await res.json();
    assert.ok(data.detail, 'Response must include error detail');
  });

  // Test 2: Tampered Token Signature
  harness.test('Boundary 2.12: Tampered token signature is rejected immediately with HTTP 401', async () => {
    const res = await fetch(`${backendMock.url}/api/invoices/`, {
      method: 'GET',
      headers: { 'Authorization': 'Bearer valid_token_alpha_tampered_signature_xyz' },
    });

    // In mock backend, only exact valid tokens are accepted
    assert.strictEqual(res.status, 401);
  });

  // Test 3: Expired Refresh Token
  harness.test('Boundary 2.13: Expired or invalid refresh token returns HTTP 401 during refresh', async () => {
    const res = await fetch(`${backendMock.url}/api/auth/token/refresh/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh: 'expired_refresh_token_000' }),
    });

    assert.strictEqual(res.status, 401, 'Invalid refresh token must yield 401');
    const err = await res.json();
    assert.strictEqual(err.code, 'token_not_valid');
  });

  // Test 4: Malformed Authorization Header (No Token)
  harness.test('Boundary 2.14: Malformed header "Bearer " (missing token value) returns HTTP 401', async () => {
    const res = await fetch(`${backendMock.url}/api/invoices/`, {
      method: 'GET',
      headers: { 'Authorization': 'Bearer ' },
    });

    assert.strictEqual(res.status, 401);
  });

  // Test 5: Unsupported Auth Scheme
  harness.test('Boundary 2.15: Unsupported scheme (e.g. "Basic dXNlcjpwYXNz") returns HTTP 401', async () => {
    const res = await fetch(`${backendMock.url}/api/invoices/`, {
      method: 'GET',
      headers: { 'Authorization': 'Basic dXNlcjpwYXNz' },
    });

    assert.strictEqual(res.status, 401);
  });

  return harness;
}
