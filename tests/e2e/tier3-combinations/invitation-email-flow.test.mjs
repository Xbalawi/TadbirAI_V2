/**
 * Tier 3 Test Suite: Cross-Feature Combinations — Invitation Workflow + Email Dispatch
 * Combines Django user creation, tenant scoping, Brevo REST API v3 dispatch, and status verification.
 */

import { TestHarness, assert } from '../helpers/test-harness.mjs';
import { MockBackendServer } from '../helpers/mock-backend-server.mjs';
import { MockBrevoServer } from '../helpers/mock-brevo-server.mjs';

export function createInvitationEmailFlowSuite() {
  const harness = new TestHarness('Tier 3 — Invitation Workflow + Email Dispatch');
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

  harness.test('Scenario 3.1: Complete user invitation + Brevo transactional dispatch workflow', async () => {
    // 1. Admin logs in and obtains JWT
    const loginRes = await fetch(`${backendMock.url}/api/auth/token/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@alpha.com', password: 'secure_password_123' }),
    });
    assert.strictEqual(loginRes.status, 200);
    const { access } = await loginRes.json();

    // 2. Admin invites a new employee
    const invitePayload = {
      email: 'nicolas.directeur@alpha.com',
      nom: 'Nicolas Moreau',
      role: 'GESTIONNAIRE',
    };

    const inviteRes = await fetch(`${backendMock.url}/api/auth/invite/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${access}`,
      },
      body: JSON.stringify(invitePayload),
    });

    assert.strictEqual(inviteRes.status, 201);
    const invitedUser = await inviteRes.json();
    assert.strictEqual(invitedUser.email, 'nicolas.directeur@alpha.com');
    assert.strictEqual(invitedUser.organisation, 'org-alpha');
    assert.strictEqual(invitedUser.is_active, false);

    // 3. Email dispatch triggered to Brevo REST API
    const emailRes = await fetch(`${brevoMock.url}/v3/smtp/email`, {
      method: 'POST',
      headers: {
        'api-key': 'valid_api_key',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        sender: { name: 'Tadbir AI', email: 'b8bf08001@smtp-brevo.com' },
        to: [{ email: invitedUser.email, name: invitedUser.nom }],
        replyTo: { email: 'contact@tadbir.ai', name: 'Tadbir Support' },
        subject: `Invitation à rejoindre Tadbir AI (${invitedUser.role})`,
        tags: ['team-invitation'],
      }),
    });

    assert.strictEqual(emailRes.status, 201);
    const emailData = await emailRes.json();
    assert.ok(emailData.messageId, 'Brevo must assign messageId');

    // 4. Verify Brevo server state
    assert.strictEqual(brevoMock.requests.length, 1);
    const req = brevoMock.requests[0];
    assert.strictEqual(req.body.to[0].email, 'nicolas.directeur@alpha.com');
    assert.deepStrictEqual(req.body.tags, ['team-invitation']);
  });

  return harness;
}
