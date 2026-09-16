/**
 * Tier 4 Test Suite: Real-World Application Scenarios — High-Volume Resilience & Outage Recovery
 * Validates batch transaction handling under intermittent network drops and state reconciliation.
 */

import { TestHarness, assert } from '../helpers/test-harness.mjs';
import { MockBackendServer } from '../helpers/mock-backend-server.mjs';

export function createHighVolumeResilienceSuite() {
  const harness = new TestHarness('Tier 4 — High-Volume Invoicing & Outage Resilience');
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

  harness.test('Scenario 4.2: High-volume batch invoicing under transient 503 outage and client retry', async () => {
    const totalTransactions = 10;
    let completedCount = 0;
    let outageFailures = 0;

    // Simulate batch invoicing run
    for (let i = 1; i <= totalTransactions; i++) {
      // Simulate transient 503 on transaction #5 and #6
      if (i === 5 || i === 6) {
        backendMock.simulate503 = true;
      } else {
        backendMock.simulate503 = false;
      }

      const res = await fetch(`${backendMock.url}/api/invoices/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer valid_token_alpha',
        },
        body: JSON.stringify({
          invoice_number: `BATCH-FAC-${i}`,
          client_name: `Batch Client ${i}`,
          total_amount: i * 150.0,
        }),
      });

      if (res.ok) {
        completedCount++;
      } else if (res.status === 503) {
        outageFailures++;
        // Retry logic: retry once after outage cleared
        backendMock.simulate503 = false;
        const retryRes = await fetch(`${backendMock.url}/api/invoices/`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer valid_token_alpha',
          },
          body: JSON.stringify({
            invoice_number: `BATCH-FAC-${i}`,
            client_name: `Batch Client ${i}`,
            total_amount: i * 150.0,
          }),
        });
        if (retryRes.ok) {
          completedCount++;
        }
      }
    }

    assert.strictEqual(outageFailures, 2, 'Must correctly capture exactly 2 outage failures');
    assert.strictEqual(completedCount, 10, 'All 10 transactions must complete after resilient retry');

    // Verify all 10 are safely persisted in Alpha
    const allInvoices = await (
      await fetch(`${backendMock.url}/api/invoices/`, {
        headers: { 'Authorization': 'Bearer valid_token_alpha' },
      })
    ).json();
    const batchInvoices = allInvoices.filter(inv => inv.invoice_number.startsWith('BATCH-FAC-'));
    assert.strictEqual(batchInvoices.length, 10);
  });

  return harness;
}
