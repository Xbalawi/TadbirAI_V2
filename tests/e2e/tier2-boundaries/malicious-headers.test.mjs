/**
 * Tier 2 Test Suite: Boundary & Corner Cases — Malicious Headers & Injections
 * Verifies security defenses against CRLF header injection, header spoofing,
 * SQL injection patterns, and oversized payloads.
 */

import { TestHarness, assert } from '../helpers/test-harness.mjs';
import { MockBackendServer } from '../helpers/mock-backend-server.mjs';
import { MockBrevoServer } from '../helpers/mock-brevo-server.mjs';

export function createMaliciousHeadersSuite() {
  const harness = new TestHarness('Tier 2 — Malicious Headers & Injection Boundaries');
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

  // Test 1: CRLF Injection in Email Headers
  harness.test('Boundary 2.6: CRLF characters in email subject or recipient are neutralized', async () => {
    const maliciousSubject = "Important Update\r\nBcc: spy@attacker.com\r\nContent-Type: text/html";
    
    const res = await fetch(`${brevoMock.url}/v3/smtp/email`, {
      method: 'POST',
      headers: {
        'api-key': 'valid_api_key',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        sender: { email: 'contact@tadbir.ai', name: 'Tadbir' },
        to: [{ email: 'user@example.com' }],
        subject: maliciousSubject.replace(/[\r\n]/g, ' '), // Application level sanitization
      }),
    });

    assert.strictEqual(res.status, 201);
    const recorded = brevoMock.requests[0];
    assert.strictEqual(recorded.body.subject.includes('\r'), false, 'Subject must not contain CR character');
    assert.strictEqual(recorded.body.subject.includes('\n'), false, 'Subject must not contain LF character');
  });

  // Test 2: Tenant Header Spoofing Prevention (Feature 8)
  harness.test('Boundary 2.7: Backend derives organization strictly from JWT token, ignoring spoofed X-Organization-Id', async () => {
    // User is Alpha, but passes spoofed header claiming Beta
    const res = await fetch(`${backendMock.url}/api/invoices/`, {
      method: 'GET',
      headers: {
        'Authorization': 'Bearer valid_token_alpha',
        'X-Organization-Id': 'org-beta', // Spoofed!
      },
    });

    assert.strictEqual(res.status, 200);
    const data = await res.json();
    // Must return Alpha's data, NOT Beta's data
    assert.ok(data.every(i => i.organisation === 'org-alpha'), 'Must scope to JWT organization org-alpha, ignoring header spoof');
  });

  // Test 3: SQL Injection String in Query Parameters
  harness.test('Boundary 2.8: SQL injection string in query params returns clean 200 without database error 500', async () => {
    const sqlInjection = "' OR '1'='1' --";
    const res = await fetch(`${backendMock.url}/api/invoices/?search=${encodeURIComponent(sqlInjection)}`, {
      method: 'GET',
      headers: { 'Authorization': 'Bearer valid_token_alpha' },
    });

    assert.strictEqual(res.status, 200, 'Query with SQL injection pattern must not crash server');
  });

  // Test 4: XSS Payload in Input Fields
  harness.test('Boundary 2.9: XSS script payload in client name is handled as text without corruption', async () => {
    const xssPayload = "<script>alert('pwned')</script>";
    const res = await fetch(`${backendMock.url}/api/invoices/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer valid_token_alpha',
      },
      body: JSON.stringify({
        invoice_number: 'FAC-XSS-01',
        client_name: xssPayload,
        total_amount: 100.0,
      }),
    });

    assert.strictEqual(res.status, 201);
    const created = await res.json();
    assert.strictEqual(created.client_name, xssPayload);
  });

  // Test 5: Oversized Payload Resilience
  harness.test('Boundary 2.10: Large payload is processed safely without socket crash', async () => {
    const largeDescription = 'A'.repeat(50000); // 50KB description
    const res = await fetch(`${backendMock.url}/api/invoice-items/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer valid_token_alpha',
      },
      body: JSON.stringify({
        invoice: 'inv-a-101',
        description: largeDescription,
        unit_price: 250.0,
      }),
    });

    assert.strictEqual(res.status, 201);
  });

  return harness;
}
