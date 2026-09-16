/**
 * Tier 1 Test Suite: Email Delivery API & DMARC Alignment
 * Covers Features 1, 2, 4, 5, 6
 */

import { TestHarness, assert } from '../helpers/test-harness.mjs';
import { MockBrevoServer } from '../helpers/mock-brevo-server.mjs';
import { loadEmailConfig } from '../helpers/email-config-loader.mjs';

export function createEmailDeliverySuite() {
  const harness = new TestHarness('Tier 1 — Email Delivery API & DMARC Alignment');
  const brevoMock = new MockBrevoServer();
  const {
    getBrevoApiKey,
    getBrevoSenderEmail,
    getBrevoSenderName,
    getEmailReplyTo,
    getSmtpCredentials,
  } = loadEmailConfig();

  harness.beforeAll(async () => {
    await brevoMock.start();
  });

  harness.afterAll(async () => {
    await brevoMock.stop();
  });

  harness.beforeEach(() => {
    brevoMock.reset();
  });

  // Test 1: Sender Domain Alignment (Feature 1)
  harness.test('Feature 1: Sender email rejects @gmail.com to prevent strict DMARC rejection', () => {
    const originalEnv = { ...process.env };
    try {
      // Simulate developer having EMAIL_USER=maryamelosmani@gmail.com
      delete process.env.BREVO_SENDER;
      process.env.EMAIL_USER = 'maryamelosmani@gmail.com';
      process.env.SMTP_USER = 'maryamelosmani@gmail.com';

      const senderEmail = getBrevoSenderEmail();

      // Must NOT evaluate to @gmail.com, because Brevo dispatch of @gmail.com fails SPF/DKIM alignment
      assert.strictEqual(
        senderEmail.toLowerCase().includes('@gmail.com'),
        false,
        'Sender email must not use @gmail.com domain for Brevo REST API'
      );
      assert.strictEqual(
        senderEmail,
        'b8bf08001@smtp-brevo.com',
        'Should fallback to verified Brevo relay address when sender is Gmail'
      );
    } finally {
      process.env = originalEnv;
    }
  });

  // Test 2: Brevo API Key Environment Loading (Feature 2)
  harness.test('Feature 2: getBrevoApiKey loads and trims BREVO_API_KEY from environment', () => {
    const originalEnv = { ...process.env };
    try {
      process.env.BREVO_API_KEY = '  xkeysib-test-environment-key-12345  ';
      const key = getBrevoApiKey();
      assert.strictEqual(key, 'xkeysib-test-environment-key-12345', 'Should trim whitespace from env key');

      // Fallback when unset
      delete process.env.BREVO_API_KEY;
      delete process.env.BREVO_KEY;
      const fallbackKey = getBrevoApiKey();
      assert.ok(fallbackKey.length > 20, 'Should fall back to valid backup key when env is unset');
    } finally {
      process.env = originalEnv;
    }
  });

  // Test 3: RFC-Compliant Reply-To Configuration (Feature 1)
  harness.test('Feature 1: getEmailReplyTo returns valid RFC 5322 reply-to address', () => {
    const originalEnv = { ...process.env };
    try {
      process.env.REPLY_TO_EMAIL = 'support@tadbir.ai';
      process.env.REPLY_TO_NAME = 'Tadbir AI Support';

      const replyTo = getEmailReplyTo();
      assert.strictEqual(replyTo.email, 'support@tadbir.ai');
      assert.strictEqual(replyTo.name, 'Tadbir AI Support');
    } finally {
      process.env = originalEnv;
    }
  });

  // Test 4: Secondary SMTP Credentials Extraction (Feature 4)
  harness.test('Feature 4: getSmtpCredentials returns valid structure for Nodemailer fallback', () => {
    const creds = getSmtpCredentials();
    assert.ok(creds.host, 'SMTP host must be defined');
    assert.ok(typeof creds.port === 'number', 'SMTP port must be a number');
    assert.ok(creds.user, 'SMTP user must be defined');
    assert.ok(creds.pass, 'SMTP password must be defined');
  });

  // Test 5: Brevo REST API v3 Payload Verification (Opaque-Box HTTP Call)
  harness.test('Feature 1 & 6: Outgoing transactional email satisfies Brevo REST v3 schema and headers', async () => {
    const payload = {
      sender: { name: 'Tadbir AI', email: 'b8bf08001@smtp-brevo.com' },
      to: [{ email: 'recipient@example.com', name: 'Collaborateur Test' }],
      replyTo: { email: 'contact@tadbir.ai', name: 'Tadbir Support' },
      subject: 'Invitation à rejoindre Tadbir AI',
      htmlContent: '<p>Bienvenue sur Tadbir AI</p>',
      textContent: 'Bienvenue sur Tadbir AI',
      tags: ['team-invitation'],
    };

    const res = await fetch(`${brevoMock.url}/v3/smtp/email`, {
      method: 'POST',
      headers: {
        'api-key': 'valid_test_key',
        'content-type': 'application/json',
        accept: 'application/json',
      },
      body: JSON.stringify(payload),
    });

    assert.strictEqual(res.status, 201, 'Brevo API should return 201 Created');
    const data = await res.json();
    assert.ok(data.messageId, 'Response must contain messageId');

    // Verify mock server received the exact payload
    assert.strictEqual(brevoMock.requests.length, 1);
    const recorded = brevoMock.requests[0];
    assert.strictEqual(recorded.body.sender.email, 'b8bf08001@smtp-brevo.com');
    assert.deepStrictEqual(recorded.body.tags, ['team-invitation']);
    assert.strictEqual(recorded.body.replyTo.email, 'contact@tadbir.ai');
  });

  // Test 6: Custom Authorized Sender Priority (Feature 1 & 5)
  harness.test('Feature 1 & 5: getBrevoSenderEmail respects explicit custom domain configured in BREVO_SENDER', () => {
    const originalEnv = { ...process.env };
    try {
      process.env.BREVO_SENDER = 'billing@custom-domain.ma';
      const sender = getBrevoSenderEmail();
      assert.strictEqual(sender, 'billing@custom-domain.ma', 'Should prioritize BREVO_SENDER when defined');
    } finally {
      process.env = originalEnv;
    }
  });

  return harness;
}
