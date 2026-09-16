#!/usr/bin/env node
/**
 * Master Opaque-Box E2E Test Suite Runner for Tadbir AI (Fawatir-Root)
 * Dual Track Protocol: Executes Tiers 1-4, aggregates per-tier metrics, and enforces quality gates.
 *
 * Usage:
 *   node tests/e2e/run-e2e.mjs
 *   node tests/e2e/run-e2e.mjs --tier=1
 *   node tests/e2e/run-e2e.mjs --tier=2
 *   node tests/e2e/run-e2e.mjs --tier=3
 *   node tests/e2e/run-e2e.mjs --tier=4
 */

// Tier 1 Suites
import { createEmailDeliverySuite } from './tier1-features/email-delivery.test.mjs';
import { createBrevoErrorsSuite } from './tier1-features/brevo-errors.test.mjs';
import { createDjangoAuthSuite } from './tier1-features/django-auth.test.mjs';
import { createTenantIsolationSuite } from './tier1-features/tenant-isolation.test.mjs';
import { createFrontendErrorHandlingSuite } from './tier1-features/frontend-error-handling.test.mjs';

// Tier 2 Suites
import { createEmptyInputsSuite } from './tier2-boundaries/empty-inputs.test.mjs';
import { createMaliciousHeadersSuite } from './tier2-boundaries/malicious-headers.test.mjs';
import { createTokenExpirationSuite } from './tier2-boundaries/token-expiration.test.mjs';
import { createIdorInjectionSuite } from './tier2-boundaries/idor-injection.test.mjs';
import { createBackendOutageSuite } from './tier2-boundaries/backend-outage-simulation.test.mjs';

// Tier 3 Suites
import { createInvitationEmailFlowSuite } from './tier3-combinations/invitation-email-flow.test.mjs';
import { createMultiTenantLifecycleSuite } from './tier3-combinations/multi-tenant-lifecycle.test.mjs';
import { createFallbackRelaySuite } from './tier3-combinations/fallback-relay.test.mjs';
import { createHijackPreventionSuite } from './tier3-combinations/hijack-prevention.test.mjs';

// Tier 4 Suites
import { createEnterpriseTenantWorkflowSuite } from './tier4-scenarios/enterprise-tenant-workflow.test.mjs';
import { createHighVolumeResilienceSuite } from './tier4-scenarios/high-volume-resilience.test.mjs';
import { createRbacSecurityEnforcementSuite } from './tier4-scenarios/rbac-security-enforcement.test.mjs';

// Parse command line arguments
const args = process.argv.slice(2);
let targetTier = null;
for (const arg of args) {
  if (arg.startsWith('--tier=')) {
    targetTier = parseInt(arg.replace('--tier=', ''), 10);
  }
}

const suitesByTier = {
  1: [
    createEmailDeliverySuite,
    createBrevoErrorsSuite,
    createDjangoAuthSuite,
    createTenantIsolationSuite,
    createFrontendErrorHandlingSuite,
  ],
  2: [
    createEmptyInputsSuite,
    createMaliciousHeadersSuite,
    createTokenExpirationSuite,
    createIdorInjectionSuite,
    createBackendOutageSuite,
  ],
  3: [
    createInvitationEmailFlowSuite,
    createMultiTenantLifecycleSuite,
    createFallbackRelaySuite,
    createHijackPreventionSuite,
  ],
  4: [
    createEnterpriseTenantWorkflowSuite,
    createHighVolumeResilienceSuite,
    createRbacSecurityEnforcementSuite,
  ],
};

const tierTitles = {
  1: 'Tier 1: Feature Coverage (Email, Brevo, Django Auth, Tenant Scoping, Frontend)',
  2: 'Tier 2: Boundary & Corner Cases (Empty Inputs, Injections, Tokens, IDOR, Outages)',
  3: 'Tier 3: Cross-Feature Combinations (Integration Workflows & Defense Cascades)',
  4: 'Tier 4: Real-World Application Scenarios (Enterprise Subsidiary Workflows & Resilience)',
};

async function run() {
  console.log('\x1b[1m\x1b[36m======================================================================\x1b[0m');
  console.log('\x1b[1m\x1b[36m    TADBIR AI (FAWATIR-ROOT) — OPAQUE-BOX E2E TEST SUITE RUNNER       \x1b[0m');
  console.log('\x1b[1m\x1b[36m======================================================================\x1b[0m');
  console.log(`Execution Mode: ${targetTier ? `Tier ${targetTier} Only` : 'Full Suite (Tiers 1-4)'}`);
  console.log(`Timestamp: ${new Date().toISOString()}\n`);

  const tiersToRun = targetTier ? [targetTier] : [1, 2, 3, 4];
  let globalPassed = 0;
  let globalFailed = 0;
  let globalTotal = 0;
  const tierReports = [];
  const allFailures = [];

  const suiteStartTime = Date.now();

  for (const tierNum of tiersToRun) {
    const suites = suitesByTier[tierNum] || [];
    console.log(`\x1b[1m\x1b[34m>>> ${tierTitles[tierNum]}\x1b[0m`);
    console.log('\x1b[90m----------------------------------------------------------------------\x1b[0m');

    let tierPassed = 0;
    let tierFailed = 0;
    let tierTotal = 0;
    const tierStart = Date.now();

    for (const suiteFactory of suites) {
      const suiteInstance = suiteFactory();
      console.log(`\n  \x1b[1m\x1b[37m[SUITE]\x1b[0m ${suiteInstance.name}`);
      const suiteResult = await suiteInstance.run(`Tier ${tierNum}`);

      tierPassed += suiteResult.passed;
      tierFailed += suiteResult.failed;
      tierTotal += suiteResult.total;

      if (suiteResult.failures.length > 0) {
        allFailures.push(...suiteResult.failures);
      }
    }

    const tierElapsed = Date.now() - tierStart;
    tierReports.push({
      tier: tierNum,
      title: tierTitles[tierNum],
      passed: tierPassed,
      failed: tierFailed,
      total: tierTotal,
      durationMs: tierElapsed,
    });

    globalPassed += tierPassed;
    globalFailed += tierFailed;
    globalTotal += tierTotal;

    console.log(
      `\n  \x1b[1mTier ${tierNum} Summary:\x1b[0m ${tierPassed}/${tierTotal} passed (${tierElapsed}ms)\n`
    );
  }

  const totalElapsed = Date.now() - suiteStartTime;

  console.log('\x1b[1m\x1b[36m======================================================================\x1b[0m');
  console.log('\x1b[1m\x1b[36m                       E2E TEST EXECUTION SUMMARY                     \x1b[0m');
  console.log('\x1b[1m\x1b[36m======================================================================\x1b[0m');
  console.log(
    'Tier                           | Total | Passed | Failed | Status | Duration'
  );
  console.log(
    '-------------------------------|-------|--------|--------|--------|---------'
  );

  for (const rep of tierReports) {
    const statusStr = rep.failed === 0 ? '\x1b[32mPASS\x1b[0m' : '\x1b[31mFAIL\x1b[0m';
    const tierLabel = `Tier ${rep.tier}`.padEnd(30);
    const totStr = String(rep.total).padStart(5);
    const passStr = String(rep.passed).padStart(6);
    const failStr = String(rep.failed).padStart(6);
    const timeStr = `${rep.durationMs}ms`.padStart(8);
    console.log(
      `${tierLabel} | ${totStr} | ${passStr} | ${failStr} | ${statusStr}   | ${timeStr}`
    );
  }

  console.log(
    '-------------------------------|-------|--------|--------|--------|---------'
  );
  const globalStatusStr =
    globalFailed === 0
      ? '\x1b[1m\x1b[32mALL TIERS PASSED\x1b[0m'
      : `\x1b[1m\x1b[31m${globalFailed} TESTS FAILED\x1b[0m`;
  console.log(
    `TOTAL                          | ${String(globalTotal).padStart(5)} | ${String(
      globalPassed
    ).padStart(6)} | ${String(globalFailed).padStart(6)} | ${globalStatusStr} | ${totalElapsed}ms\n`
  );

  if (allFailures.length > 0) {
    console.log('\x1b[1m\x1b[31mDETAILED FAILURE BREAKDOWN:\x1b[0m');
    for (let idx = 0; idx < allFailures.length; idx++) {
      const f = allFailures[idx];
      console.log(`\n  ${idx + 1}) \x1b[1m${f.title}\x1b[0m`);
      console.log(`     ${f.error}`);
      if (f.stack) {
        console.log(`     \x1b[90m${f.stack.split('\n').slice(1, 4).join('\n     ')}\x1b[0m`);
      }
    }
    process.exit(1);
  } else {
    console.log(
      `\x1b[1m\x1b[32m✔ SUCCESS:\x1b[0m All ${globalPassed} E2E opaque-box test cases passed with 100% fidelity.\n`
    );
    process.exit(0);
  }
}

run().catch(err => {
  console.error('\x1b[31m[FATAL] Unhandled error during E2E test execution:\x1b[0m', err);
  process.exit(1);
});
