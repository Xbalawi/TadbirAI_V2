/**
 * Lightweight, zero-dependency Test Harness for Opaque-Box E2E Testing.
 * Provides assertion primitives, test suite collectors, timing, and formatting.
 */

import assert from 'node:assert';

export class TestHarness {
  constructor(name = 'E2E Test Suite') {
    this.name = name;
    this.tests = [];
    this.beforeAllHooks = [];
    this.afterAllHooks = [];
    this.beforeEachHooks = [];
    this.afterEachHooks = [];
  }

  test(title, fn) {
    this.tests.push({ title, fn });
  }

  beforeAll(fn) {
    this.beforeAllHooks.push(fn);
  }

  afterAll(fn) {
    this.afterAllHooks.push(fn);
  }

  beforeEach(fn) {
    this.beforeEachHooks.push(fn);
  }

  afterEach(fn) {
    this.afterEachHooks.push(fn);
  }

  async run(tierName = '') {
    const results = {
      name: this.name,
      tier: tierName,
      passed: 0,
      failed: 0,
      total: this.tests.length,
      durationMs: 0,
      failures: [],
    };

    const startTime = Date.now();

    try {
      for (const hook of this.beforeAllHooks) {
        await hook();
      }

      for (const t of this.tests) {
        const testStart = Date.now();
        try {
          for (const hook of this.beforeEachHooks) {
            await hook();
          }

          await t.fn();

          for (const hook of this.afterEachHooks) {
            await hook();
          }

          const elapsed = Date.now() - testStart;
          results.passed++;
          console.log(`  \x1b[32m✔\x1b[0m [PASS] ${t.title} (${elapsed}ms)`);
        } catch (err) {
          const elapsed = Date.now() - testStart;
          results.failed++;
          results.failures.push({
            title: t.title,
            error: err.message,
            stack: err.stack,
          });
          console.error(`  \x1b[31m✖\x1b[0m [FAIL] ${t.title} (${elapsed}ms)`);
          console.error(`    \x1b[33mError:\x1b[0m ${err.message}`);
        }
      }
    } finally {
      for (const hook of this.afterAllHooks) {
        try {
          await hook();
        } catch (hookErr) {
          console.error(`[TestHarness] Error in afterAll hook:`, hookErr);
        }
      }
      results.durationMs = Date.now() - startTime;
    }

    return results;
  }
}

export { assert };
