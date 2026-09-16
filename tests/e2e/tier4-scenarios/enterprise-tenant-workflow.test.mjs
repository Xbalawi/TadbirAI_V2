/**
 * Tier 4 Test Suite: Real-World Application Scenarios — Multi-Tenant Enterprise Workflow
 * Simulates realistic enterprise operations between two distinct corporate subsidiaries (Casablanca & Tangier).
 */

import { TestHarness, assert } from '../helpers/test-harness.mjs';
import { MockBackendServer } from '../helpers/mock-backend-server.mjs';

export function createEnterpriseTenantWorkflowSuite() {
  const harness = new TestHarness('Tier 4 — Enterprise Multi-Tenant Workflow');
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

  harness.test('Scenario 4.1: End-to-end enterprise lifecycle across two Moroccan corporate subsidiaries', async () => {
    // ----------------------------------------------------
    // Step 1: Subsidiary Casablanca (Alpha Corp) Operations
    // ----------------------------------------------------
    // 1a. Login Admin Alpha
    const loginAlpha = await (
      await fetch(`${backendMock.url}/api/auth/token/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'admin@alpha.com', password: 'secure_password_123' }),
      })
    ).json();
    const tokenAlpha = loginAlpha.access;

    // 1b. Invite commercial agent for Alpha
    const inviteAlpha = await (
      await fetch(`${backendMock.url}/api/auth/invite/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${tokenAlpha}`,
        },
        body: JSON.stringify({
          email: 'mehdi.commercial@alpha.com',
          nom: 'Mehdi Bennani',
          role: 'COMMERCIAL',
        }),
      })
    ).json();
    assert.strictEqual(inviteAlpha.organisation, 'org-alpha');

    // 1c. Create Invoice with Items
    const invAlpha = await (
      await fetch(`${backendMock.url}/api/invoices/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${tokenAlpha}`,
        },
        body: JSON.stringify({
          invoice_number: 'FAC-CASA-001',
          client_name: 'Maroc Telecom SA',
          total_amount: 48000.0,
        }),
      })
    ).json();

    await fetch(`${backendMock.url}/api/invoice-items/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${tokenAlpha}`,
      },
      body: JSON.stringify({
        invoice: invAlpha.id,
        description: 'Audit Réseau & Sécurité Casablanca',
        unit_price: 48000.0,
      }),
    });

    // ----------------------------------------------------
    // Step 2: Subsidiary Tangier (Beta Industries) Operations
    // ----------------------------------------------------
    // 2a. Login Admin Beta
    const loginBeta = await (
      await fetch(`${backendMock.url}/api/auth/token/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'admin@beta.com', password: 'secure_password_123' }),
      })
    ).json();
    const tokenBeta = loginBeta.access;

    // 2b. Create Invoice with identical number format
    const invBeta = await (
      await fetch(`${backendMock.url}/api/invoices/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${tokenBeta}`,
        },
        body: JSON.stringify({
          invoice_number: 'FAC-TNG-001',
          client_name: 'Tanger Med Port Authority',
          total_amount: 125000.0,
        }),
      })
    ).json();

    await fetch(`${backendMock.url}/api/invoice-items/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${tokenBeta}`,
      },
      body: JSON.stringify({
        invoice: invBeta.id,
        description: 'Logistique & Gestion Flux Portuaires',
        unit_price: 125000.0,
      }),
    });

    // ----------------------------------------------------
    // Step 3: Adversarial Cross-Tenant Boundary Auditing
    // ----------------------------------------------------
    // 3a. Tangier queries all invoices
    const betaInvoices = await (
      await fetch(`${backendMock.url}/api/invoices/`, {
        headers: { 'Authorization': `Bearer ${tokenBeta}` },
      })
    ).json();
    assert.ok(betaInvoices.every(i => i.organisation === 'org-beta'));
    assert.strictEqual(betaInvoices.some(i => i.id === invAlpha.id), false);

    // 3b. Tangier attempts IDOR read of Casablanca invoice
    const idorGet = await fetch(`${backendMock.url}/api/invoices/${invAlpha.id}/`, {
      headers: { 'Authorization': `Bearer ${tokenBeta}` },
    });
    assert.strictEqual(idorGet.status, 404);

    // 3c. Tangier attempts IDOR creation of child item under Casablanca invoice
    const idorPost = await fetch(`${backendMock.url}/api/invoice-items/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${tokenBeta}`,
      },
      body: JSON.stringify({
        invoice: invAlpha.id,
        description: 'Illegal Injected Item',
        unit_price: 1.0,
      }),
    });
    assert.strictEqual(idorPost.status, 400);

    // 3d. Check Casablanca child items
    const alphaItems = await (
      await fetch(`${backendMock.url}/api/invoice-items/`, {
        headers: { 'Authorization': `Bearer ${tokenAlpha}` },
      })
    ).json();
    assert.ok(alphaItems.some(i => i.description.includes('Casablanca')));
    assert.strictEqual(alphaItems.some(i => i.description.includes('Tanger')), false);
  });

  return harness;
}
