# Test Infrastructure Specification: Opaque-Box E2E Testing Suite

## 1. Test Philosophy & Principles

The Tadbir AI (Fawatir-Root) End-to-End (E2E) testing harness is engineered under a strict **Opaque-Box Testing Philosophy**. 

### 1.1 Core Principles
1. **Opaque-Box Verification**: The test suite treats the system under test (Next.js frontend, API route handlers, Brevo transactional email subsystem, and Django REST backend) as an opaque system. Tests interact exclusively through documented public interfaces:
   - HTTP/REST endpoints (`/api/equipe`, `/api/auth/send-verification-email`, `/api/invoices`, `/api/clients`, `/api/companies`, etc.)
   - Standard authentication and tenant headers (`Authorization: Bearer <token>`, `X-Organization-Id: <uuid>`)
   - Observable HTTP responses, status codes, and error schemas
   - External protocol contracts (Brevo REST API v3, SMTP STARTTLS/SSL, JWT standard RFC 7519)
   - CLI tools and verification scripts (`scripts/test-email.mjs`, `python manage.py test`)
2. **Requirement-Driven**: Every test case is derived directly from the authoritative specifications in `PROJECT.md` and `ORIGINAL_REQUEST.md`. No test exists without an explicit requirement anchor.
3. **Progressive Testability & Zero Flakiness**: Tests are isolated, deterministic, and self-contained. Tests manage their own lifecycle, spin up ephemeral test services when running in standalone mode, clean up after execution, and do not rely on side-effects or test execution order.
4. **Adversarial & Defensive Hardening**: The suite rigorously tests boundary conditions, malformed payloads, injection vectors (CRLF email injection, tenant header spoofing, cross-tenant IDOR foreign key linking, SQL injection strings), token expiration/tampering, and upstream network failures (500/503 simulation).
5. **No Facade Implementations**: Tests perform genuine network exchanges, validate HTTP protocol headers, parse structured payloads, and assert real behavioral contracts.

---

## 2. Feature Inventory Mapping to Test Tiers

The 22 core features cataloged in `PROJECT.md` are systematically mapped to the 4 testing tiers:

| # | Feature Name | Milestone | Primary Test Tier | Secondary Test Tier | Target Test Suites |
|---|--------------|-----------|-------------------|---------------------|--------------------|
| 1 | Email Sender Alignment & DMARC Fix | M1 | Tier 1 (1.1, 1.3) | Tier 2 (2.2), Tier 3 (3.1) | `email-delivery.test.mjs`, `malicious-headers.test.mjs` |
| 2 | Brevo API Key Environment Loading | M1 | Tier 1 (1.2) | Tier 2 (2.3) | `email-delivery.test.mjs` |
| 3 | Brevo API Error Handling & Structured Logging | M1 | Tier 1 (2.1-2.5) | Tier 2 (2.5), Tier 3 (3.3) | `brevo-errors.test.mjs`, `backend-outage-simulation.test.mjs` |
| 4 | Email Dispatch Timeout & SMTP Fallback | M1 | Tier 1 (1.5, 2.5) | Tier 3 (3.3) | `brevo-errors.test.mjs`, `fallback-relay.test.mjs` |
| 5 | Email Environment Documentation | M1 | Tier 1 (1.2) | Tier 2 (2.1) | `email-delivery.test.mjs` |
| 6 | Automated Email Verification Script | M1 | Tier 1 (1.6) | Tier 3 (3.1) | `email-delivery.test.mjs`, `invitation-email-flow.test.mjs` |
| 7 | Tenant Isolation Relationship Traversal | M2 | Tier 1 (4.1-4.4) | Tier 2 (2.4), Tier 4 (4.1) | `tenant-isolation.test.mjs`, `idor-injection.test.mjs` |
| 8 | Cross-Tenant Foreign Key IDOR Prevention | M2 | Tier 1 (4.5) | Tier 2 (2.4), Tier 3 (3.2) | `tenant-isolation.test.mjs`, `idor-injection.test.mjs` |
| 9 | Development Mode Auth Bypass Removal | M2 | Tier 1 (3.3) | Tier 2 (2.3) | `django-auth.test.mjs`, `token-expiration.test.mjs` |
| 10 | Invite User Account Hijacking Fix | M2 | Tier 1 (4.6) | Tier 3 (3.4) | `tenant-isolation.test.mjs`, `hijack-prevention.test.mjs` |
| 11 | `UserSerializer` Role Deserialization Fix | M2 | Tier 1 (3.4) | Tier 2 (2.1) | `django-auth.test.mjs`, `empty-inputs.test.mjs` |
| 12 | Schema Alignment (`company` to `organisation`) | M2 | Tier 1 (4.1) | Tier 3 (3.2), Tier 4 (4.1) | `tenant-isolation.test.mjs`, `multi-tenant-lifecycle.test.mjs` |
| 13 | Organization API Endpoints Routing | M2 | Tier 1 (4.1) | Tier 2 (2.5) | `tenant-isolation.test.mjs`, `frontend-error-handling.test.mjs` |
| 14 | Django Automated Test Suite Pass | M2 | Tier 1 (3.1-3.5) | Tier 1 (4.1-4.6) | `django-auth.test.mjs`, `tenant-isolation.test.mjs` |
| 15 | Reusable Table Error Component | M3 | Tier 1 (5.1, 5.2) | Tier 2 (2.5) | `frontend-error-handling.test.mjs` |
| 16 | Table Empty-State vs Error-State Separation | M3 | Tier 1 (5.1) | Tier 2 (2.5), Tier 4 (4.2) | `frontend-error-handling.test.mjs`, `high-volume-resilience.test.mjs` |
| 17 | Detail Pages Accurate Error Reporting | M3 | Tier 1 (5.3) | Tier 2 (2.4) | `frontend-error-handling.test.mjs` |
| 18 | Mutation False-Positive Elimination | M3 | Tier 1 (5.4) | Tier 2 (2.5), Tier 4 (4.2) | `frontend-error-handling.test.mjs` |
| 19 | Team Bulk Delete & DRF Error Parsing | M3 | Tier 1 (5.5) | Tier 2 (2.1) | `frontend-error-handling.test.mjs`, `empty-inputs.test.mjs` |
| 20 | Tenant Store Error State Exposure | M3 | Tier 1 (5.6) | Tier 2 (2.5), Tier 4 (4.1) | `frontend-error-handling.test.mjs`, `enterprise-tenant-workflow.test.mjs` |
| 21 | Opaque-box E2E Test Suite (Tiers 1-4) | E2E | All Tiers (1-4) | Full Suite | `run-e2e.mjs`, `run_tests.py` |
| 22 | 100% E2E Suite Pass & Adversarial Hardening | M-Final| All Tiers | Tier 2, Tier 4 | Complete harness verification & security boundary checks |

---

## 3. Test Architecture & Runner Specification

### 3.1 Test Directory Structure
```
tests/
└── e2e/
    ├── helpers/
    │   ├── test-harness.mjs          # Lightweight test runner, assertions, and reporter
    │   ├── mock-brevo-server.mjs     # Standalone Brevo REST API v3 mock HTTP service
    │   └── mock-backend-server.mjs   # Standalone Django backend mock HTTP service
    ├── tier1-features/
    │   ├── email-delivery.test.mjs   # Features 1, 2, 4, 5, 6
    │   ├── brevo-errors.test.mjs     # Features 3, 4
    │   ├── django-auth.test.mjs      # Features 9, 11, 14
    │   ├── tenant-isolation.test.mjs # Features 7, 8, 10, 12, 13
    │   └── frontend-error-handling.test.mjs # Features 15, 16, 17, 18, 19, 20
    ├── tier2-boundaries/
    │   ├── empty-inputs.test.mjs     # Empty string, whitespace, null handling
    │   ├── malicious-headers.test.mjs# CRLF injection, header spoofing, SQL injection, XSS
    │   ├── token-expiration.test.mjs # JWT expired, forged, blacklisted tokens
    │   ├── idor-injection.test.mjs   # Cross-tenant IDOR access & foreign key injection
    │   └── backend-outage-simulation.test.mjs # 500, 503, connection drops, HTML error pages
    ├── tier3-combinations/
    │   ├── invitation-email-flow.test.mjs # Invitation + email dispatch + status tracking
    │   ├── multi-tenant-lifecycle.test.mjs# Tenant onboarding + product/invoice isolation
    │   ├── fallback-relay.test.mjs        # Brevo failure -> Nodemailer SMTP fallback relay
    │   └── hijack-prevention.test.mjs     # Cross-tenant user collision defense
    ├── tier4-scenarios/
    │   ├── enterprise-tenant-workflow.test.mjs # Multi-org Casablanca vs Tangier subsidiaries
    │   ├── high-volume-resilience.test.mjs     # Invoicing resilience under transient outages
    │   └── rbac-security-enforcement.test.mjs  # Admin/Comptable/Commercial/Lecteur RBAC
    ├── run-e2e.mjs                   # Master Node.js ESM test runner
    └── run_tests.py                  # Python test runner bridge
```

### 3.2 Runner Commands
To execute the complete E2E test suite:

```bash
# Direct Node.js ESM runner (recommended):
node tests/e2e/run-e2e.mjs

# Python runner bridge:
python tests/e2e/run_tests.py

# Optional: Run specific tier only
node tests/e2e/run-e2e.mjs --tier=1
node tests/e2e/run-e2e.mjs --tier=2
node tests/e2e/run-e2e.mjs --tier=3
node tests/e2e/run-e2e.mjs --tier=4
```

### 3.3 Standalone vs Live Environment Execution
- **Standalone Mode (Default)**: The runner spins up local, ephemeral HTTP mock servers for Brevo REST API v3 and Django REST Framework on dynamic OS-assigned ports (`port: 0`). Tests execute real HTTP requests through standard Node `fetch()`, verifying exact wire payloads, headers, response status codes, and error bodies.
- **Live Mode**: If `TEST_API_URL` or `TEST_BREVO_URL` environment variables are set, tests will target the live instances, executing full end-to-end integration across running services.

---

## 4. Coverage Thresholds & Quality Gates

| Tier | Focus Area | Required Tests per Feature Area | Total Minimum Test Count | Pass Criteria |
|------|------------|---------------------------------|--------------------------|---------------|
| **Tier 1: Feature Coverage** | Primary happy-path and core functional requirements across Email, Brevo, Django Auth, Tenant Scoping, and Frontend Error Handling | >= 5 tests per feature area (5 feature areas) | >= 25 tests (Implemented: 29 tests) | 100% Pass |
| **Tier 2: Boundary & Corner Cases** | Extreme inputs, malicious injection, expired tokens, IDOR attempts, and 500/503 network simulations | >= 5 tests per boundary area (5 boundary areas) | >= 25 tests (Implemented: 25 tests) | 100% Pass |
| **Tier 3: Cross-Feature Combinations** | Integration flows linking multiple subsystems (invitation + Brevo, multi-tenant creation + isolation, fallback relay, account hijacking prevention) | >= 1 comprehensive scenario per flow | >= 4 scenarios (Implemented: 4 tests) | 100% Pass |
| **Tier 4: Real-World Scenarios** | End-to-end enterprise multi-tenant operational lifecycles, high-volume transactions with transient outages, and RBAC matrix | >= 1 comprehensive enterprise scenario per workflow | >= 3 scenarios (Implemented: 3 tests) | 100% Pass |
| **Total Suite** | **Comprehensive Opaque-Box E2E Harness** | — | **>= 57 tests (Implemented: 61 tests)** | **100% Pass (Exit Code 0)** |

---

## 5. Pass/Fail Exit Protocol
- The runner aggregates all test results across Tiers 1 through 4.
- Execution produces a detailed tier-by-tier report with individual test names, durations, and pass/fail statuses.
- If **any** test fails, the runner outputs the exact assertion error, expected vs actual values, and exits with code `1`.
- If **all** tests pass, the runner prints a green summary banner and exits with code `0`.
