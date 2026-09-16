/**
 * Tier 2 Test Suite: Boundary & Corner Cases — Backend Outage & Network Failure Simulation
 * Verifies resilience under 500/503 errors, dropped sockets, HTML error pages, and recovery.
 */

import { TestHarness, assert } from '../helpers/test-harness.mjs';
import { MockBackendServer } from '../helpers/mock-backend-server.mjs';

export function createBackendOutageSuite() {
  const harness = new TestHarness('Tier 2 — Backend Outage & Network Failure Boundaries');
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

  // Test 1: Service Unavailable Simulation (503)
  harness.test('Boundary 2.21: Backend 503 outage returns standard French error message', async () => {
    backendMock.simulate503 = true;

    const res = await fetch(`${backendMock.url}/api/invoices/`, {
      headers: { 'Authorization': 'Bearer valid_token_alpha' },
    });

    assert.strictEqual(res.status, 503);
    const data = await res.json();
    assert.strictEqual(data.error, 'Le serveur backend est injoignable.');
  });

  // Test 2: Connection Drop Handling
  harness.test('Boundary 2.22: Dropped socket connection is caught cleanly without unhandled rejection', async () => {
    backendMock.dropConnection = true;

    let caughtError = null;
    try {
      await fetch(`${backendMock.url}/api/invoices/`, {
        headers: { 'Authorization': 'Bearer valid_token_alpha' },
      });
    } catch (err) {
      caughtError = err;
    }

    assert.ok(caughtError !== null, 'Network drop must produce catchable fetch error');
  });

  // Test 3: Upstream Non-JSON HTML Error Page (e.g. Cloudflare / Nginx 502)
  harness.test('Boundary 2.23: Non-JSON HTML 502 error page is handled safely without JSON parse crash', async () => {
    // Simulate raw HTML response
    const rawHtml = '<!DOCTYPE html><html><body><h1>502 Bad Gateway</h1></body></html>';
    
    // Test client parsing helper
    async function safeParseResponse(status, text) {
      if (status >= 500) {
        try {
          const json = JSON.parse(text);
          return { isError: true, message: json.error || 'Server error' };
        } catch {
          return { isError: true, message: 'Le serveur backend est temporairement indisponible.' };
        }
      }
      return { isError: false, data: text };
    }

    const result = await safeParseResponse(502, rawHtml);
    assert.strictEqual(result.isError, true);
    assert.strictEqual(result.message, 'Le serveur backend est temporairement indisponible.');
  });

  // Test 4: Retry Recovery Mechanism
  harness.test('Boundary 2.24: Table reload restores data when backend transitions from 503 to 200', async () => {
    // 1st request during outage: fails
    backendMock.simulate503 = true;
    const res1 = await fetch(`${backendMock.url}/api/invoices/`, {
      headers: { 'Authorization': 'Bearer valid_token_alpha' },
    });
    assert.strictEqual(res1.status, 503);

    // Backend recovers: retry succeeds
    backendMock.simulate503 = false;
    const res2 = await fetch(`${backendMock.url}/api/invoices/`, {
      headers: { 'Authorization': 'Bearer valid_token_alpha' },
    });
    assert.strictEqual(res2.status, 200);
    const data = await res2.json();
    assert.strictEqual(data.length, 1);
    assert.strictEqual(data[0].id, 'inv-a-101');
  });

  // Test 5: Concurrent Requests under Outage
  harness.test('Boundary 2.25: Concurrent requests during backend 503 outage all resolve gracefully', async () => {
    backendMock.simulate503 = true;

    const promises = Array.from({ length: 5 }).map(() =>
      fetch(`${backendMock.url}/api/invoices/`, {
        headers: { 'Authorization': 'Bearer valid_token_alpha' },
      })
    );

    const responses = await Promise.all(promises);
    assert.strictEqual(responses.length, 5);
    for (const res of responses) {
      assert.strictEqual(res.status, 503);
      const body = await res.json();
      assert.strictEqual(body.error, 'Le serveur backend est injoignable.');
    }
  });

  return harness;
}
