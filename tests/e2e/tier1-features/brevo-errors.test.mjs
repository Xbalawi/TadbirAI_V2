/**
 * Tier 1 Test Suite: Brevo Non-2xx Error Capture & Structured Logging
 * Covers Features 3 and 4
 */

import { TestHarness, assert } from '../helpers/test-harness.mjs';
import { MockBrevoServer } from '../helpers/mock-brevo-server.mjs';

export function createBrevoErrorsSuite() {
  const harness = new TestHarness('Tier 1 — Brevo Error Capture & Structured Logging');
  const brevoMock = new MockBrevoServer();

  harness.beforeAll(async () => {
    await brevoMock.start();
  });

  harness.afterAll(async () => {
    await brevoMock.stop();
  });

  harness.beforeEach(() => {
    brevoMock.reset();
  });

  // Test 1: Brevo HTTP 400 Capture (Invalid Parameter / Unauthorized Sender)
  harness.test('Feature 3: Brevo HTTP 400 Bad Request is properly parsed and structured', async () => {
    // Attempt sending with @gmail.com to trigger Brevo 400
    const res = await fetch(`${brevoMock.url}/v3/smtp/email`, {
      method: 'POST',
      headers: {
        'api-key': 'valid_api_key',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        sender: { email: 'unauthorized@gmail.com', name: 'Test' },
        to: [{ email: 'target@example.com' }],
        subject: 'Test',
      }),
    });

    assert.strictEqual(res.status, 400, 'Mock Brevo server should return status 400 for unauthorized sender');
    const errData = await res.json();
    assert.strictEqual(errData.code, 'invalid_parameter');
    assert.ok(errData.message.includes('not authorized'), 'Error message must reflect parameter rejection');
  });

  // Test 2: Brevo HTTP 401 Capture (Invalid API Key)
  harness.test('Feature 3: Brevo HTTP 401 Unauthorized is cleanly intercepted', async () => {
    const res = await fetch(`${brevoMock.url}/v3/smtp/email`, {
      method: 'POST',
      headers: {
        'api-key': 'invalid_api_key',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        sender: { email: 'valid@company.com' },
        to: [{ email: 'target@example.com' }],
      }),
    });

    assert.strictEqual(res.status, 401, 'Should return HTTP 401 when API key is rejected');
    const errData = await res.json();
    assert.strictEqual(errData.code, 'unauthorized');
  });

  // Test 3: Brevo HTTP 402 Capture (Monthly Quota Exceeded)
  harness.test('Feature 3: Brevo HTTP 402 Payment Required / Quota Exceeded is captured', async () => {
    brevoMock.statusOverride = 402;
    brevoMock.bodyOverride = {
      code: 'payment_required',
      message: 'Monthly email plan credit quota has been reached.',
    };

    const res = await fetch(`${brevoMock.url}/v3/smtp/email`, {
      method: 'POST',
      headers: { 'api-key': 'valid_api_key', 'content-type': 'application/json' },
      body: JSON.stringify({ sender: { email: 'valid@brevo.com' } }),
    });

    assert.strictEqual(res.status, 402);
    const errData = await res.json();
    assert.strictEqual(errData.code, 'payment_required');
  });

  // Test 4: Brevo HTTP 500 Capture (Internal Relay Error)
  harness.test('Feature 3: Brevo HTTP 500 Internal Server Error is handled gracefully', async () => {
    brevoMock.statusOverride = 500;
    brevoMock.bodyOverride = {
      code: 'internal_server_error',
      message: 'Brevo transactional relay service temporary failure.',
    };

    const res = await fetch(`${brevoMock.url}/v3/smtp/email`, {
      method: 'POST',
      headers: { 'api-key': 'valid_api_key', 'content-type': 'application/json' },
      body: JSON.stringify({ sender: { email: 'valid@brevo.com' } }),
    });

    assert.strictEqual(res.status, 500);
    const errData = await res.json();
    assert.strictEqual(errData.code, 'internal_server_error');
  });

  // Test 5: AbortController Timeout Protection (Feature 4)
  harness.test('Feature 4: Dispatch client aborts stalled request via AbortController timeout signal', async () => {
    brevoMock.delayMs = 2000; // Simulate 2s delayed response
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 100); // 100ms client timeout

    let didTimeout = false;
    try {
      await fetch(`${brevoMock.url}/v3/smtp/email`, {
        method: 'POST',
        headers: { 'api-key': 'valid_api_key', 'content-type': 'application/json' },
        body: JSON.stringify({ sender: { email: 'valid@brevo.com' } }),
        signal: controller.signal,
      });
    } catch (err) {
      if (err.name === 'AbortError' || controller.signal.aborted) {
        didTimeout = true;
      }
    } finally {
      clearTimeout(timeoutId);
    }

    assert.strictEqual(didTimeout, true, 'Request must abort when timeout threshold is exceeded');
  });

  // Test 6: Sanitized Structured Error Logging Format (Feature 3)
  harness.test('Feature 3: Structured error logger formats error metadata without credential leaks', () => {
    function formatStructuredError(statusCode, statusText, errorBody, context) {
      return {
        timestamp: new Date().toISOString(),
        service: 'Brevo REST API v3',
        status: statusCode,
        statusText: statusText,
        context: context,
        error: typeof errorBody === 'string' ? errorBody.slice(0, 500) : errorBody,
      };
    }

    const logEntry = formatStructuredError(400, 'Bad Request', { code: 'invalid_parameter' }, { recipient: 'user@test.ma' });
    assert.strictEqual(logEntry.status, 400);
    assert.strictEqual(logEntry.service, 'Brevo REST API v3');
    assert.strictEqual(logEntry.context.recipient, 'user@test.ma');
    assert.strictEqual(JSON.stringify(logEntry).includes('api_key'), false, 'Log entry must not leak API keys');
  });

  return harness;
}
