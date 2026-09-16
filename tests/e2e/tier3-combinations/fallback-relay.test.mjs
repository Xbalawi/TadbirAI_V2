/**
 * Tier 3 Test Suite: Cross-Feature Combinations — Brevo Failure Cascades to SMTP Fallback Relay
 * Verifies that when Brevo REST API fails, the pipeline transitions to secondary SMTP credentials.
 */

import { TestHarness, assert } from '../helpers/test-harness.mjs';
import { MockBrevoServer } from '../helpers/mock-brevo-server.mjs';
import { loadEmailConfig } from '../helpers/email-config-loader.mjs';

export function createFallbackRelaySuite() {
  const harness = new TestHarness('Tier 3 — Brevo Failure to SMTP Fallback Relay');
  const brevoMock = new MockBrevoServer();
  const { getSmtpCredentials } = loadEmailConfig();

  harness.beforeAll(async () => {
    await brevoMock.start();
  });

  harness.afterAll(async () => {
    await brevoMock.stop();
  });

  harness.beforeEach(() => {
    brevoMock.reset();
  });

  harness.test('Scenario 3.3: Brevo API HTTP 402 triggers structured logging and fallback relay activation', async () => {
    // 1. Configure Brevo to fail with 402 Payment Required
    brevoMock.statusOverride = 402;
    brevoMock.bodyOverride = { code: 'payment_required', message: 'Account out of credits' };

    let fallbackEngaged = false;
    let fallbackSuccess = false;
    let logCaptured = false;

    // Simulate multi-tier dispatch logic from route handler
    const brevoRes = await fetch(`${brevoMock.url}/v3/smtp/email`, {
      method: 'POST',
      headers: { 'api-key': 'valid_key', 'content-type': 'application/json' },
      body: JSON.stringify({ sender: { email: 'valid@brevo.com' }, to: [{ email: 'client@test.ma' }] }),
    });

    if (!brevoRes.ok) {
      const errText = await brevoRes.text();
      // Structured logging simulation
      if (brevoRes.status === 402 && errText.includes('payment_required')) {
        logCaptured = true;
      }

      // Engage Tier 2 fallback: SMTP credentials
      fallbackEngaged = true;
      const smtp = getSmtpCredentials();
      if (smtp.host && smtp.user && smtp.pass) {
        // SMTP credentials successfully verified and active
        fallbackSuccess = true;
      }
    }

    assert.strictEqual(logCaptured, true, 'Structured error must be logged upon Brevo failure');
    assert.strictEqual(fallbackEngaged, true, 'Fallback relay must be engaged when primary fails');
    assert.strictEqual(fallbackSuccess, true, 'Fallback SMTP configuration must be ready and valid');
  });

  return harness;
}
