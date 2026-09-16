# Project: Tadbir AI Codebase Audit & System Stabilization

## Architecture
- **Next.js Frontend & API Routes** (`app/`, `components/`, `lib/`):
  - Next.js 14 App Router, Tailwind CSS, Zustand stores (`authStore`, `tenantStore`).
  - Next.js API route handlers act as both reverse proxies to Django backend and direct integration endpoints for transactional email (Brevo REST API v3 / Nodemailer SMTP).
- **Django Backend** (`fawatir_backend/`):
  - Django 5 + Django REST Framework (DRF), SimpleJWT auth, Multi-tenant architecture keyed on `Organization`.
  - Views inherit from `TenantIsolationMixin` to scope queries and mutations by tenant organization.
- **Transactional Email Infrastructure**:
  - Primary dispatch: Brevo REST API v3 (`https://api.brevo.com/v3/smtp/email`).
  - Secondary fallback: Nodemailer SMTP over TLS/SSL (`smtp.gmail.com:587` / `465`).
  - Strict SPF/DKIM/DMARC alignment requiring authenticated sender domains and valid `replyTo` headers.

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| 1 | Email Sender Alignment & DMARC Fix | Prevent `@gmail.com` sender spoofing via Brevo; enforce authorized sender and RFC-compliant `replyTo` | M1 | ORIGINAL_REQUEST §R1 |
| 2 | Brevo API Key Environment Loading | Respect `BREVO_API_KEY` from environment variables, fallback safely | M1 | ORIGINAL_REQUEST §R1 |
| 3 | Brevo API Error Handling & Structured Logging | Capture and log non-2xx responses from Brevo; include status, statusText, and sanitized details | M1 | ORIGINAL_REQUEST §R1 |
| 4 | Email Dispatch Timeout & SMTP Fallback | Add 15s `AbortController` timeout; fallback to Nodemailer SMTP on Brevo failure | M1 | ORIGINAL_REQUEST §R1 |
| 5 | Email Environment Documentation | Add `BREVO_API_KEY`, `BREVO_SENDER`, `BREVO_SENDER_NAME`, `REPLY_TO_EMAIL` to `.env.example` | M1 | ORIGINAL_REQUEST §R1 |
| 6 | Automated Email Verification Script | Standalone or API-based verification script to validate dispatch and inbox delivery | M1 | ORIGINAL_REQUEST §R1 |
| 7 | Tenant Isolation Relationship Traversal | Extend `TenantIsolationMixin` to enforce tenant scoping across all 23 child models | M2 | ORIGINAL_REQUEST §R2 |
| 8 | Cross-Tenant Foreign Key IDOR Prevention | Validate in `perform_create()` that parent FKs belong to the requester's organization | M2 | ORIGINAL_REQUEST §R2 |
| 9 | Development Mode Auth Bypass Removal | Remove unauthenticated database bypass in `TenantIsolationMixin.get_queryset()` | M2 | ORIGINAL_REQUEST §R2 |
| 10 | Invite User Account Hijacking Fix | Remove forced organization overwrite in `InviteUserView` when email belongs to another tenant | M2 | ORIGINAL_REQUEST §R2 |
| 11 | `UserSerializer` Role Deserialization Fix | Allow writing `role` during user creation without triggering `IntegrityError` | M2 | ORIGINAL_REQUEST §R2 |
| 12 | Schema Alignment (`company` to `organisation`) | Fix broken `company` model references in import executor, auth views, chatbot, and commands | M2 | ORIGINAL_REQUEST §R2 |
| 13 | Organization API Endpoints Routing | Re-enable / route `/api/companies/` and `/api/company-settings/` in `api/urls.py` | M2 | ORIGINAL_REQUEST §R2 |
| 14 | Django Automated Test Suite Pass | Run Django tests without errors; add tests for child model isolation and IDOR prevention | M2 | ORIGINAL_REQUEST §R2 |
| 15 | Reusable Table Error Component | Create `TableErrorState` with error banner, description, and Retry button | M3 | ORIGINAL_REQUEST §R2 |
| 16 | Table Empty-State vs Error-State Separation | Separate empty dataset display from 500/503 server errors across all 10 operational tables | M3 | ORIGINAL_REQUEST §R2 |
| 17 | Detail Pages Accurate Error Reporting | Distinguish true 404 Not Found from 500/503 backend failure on single-item pages | M3 | ORIGINAL_REQUEST §R2 |
| 18 | Mutation False-Positive Elimination | Verify `res.ok` before showing success toasts in Settings, POS, Scanner, and Modals | M3 | ORIGINAL_REQUEST §R2 |
| 19 | Team Bulk Delete & DRF Error Parsing | Fix `{ ids }` handling in `/api/equipe/route.ts` and parse DRF validation errors cleanly | M3 | ORIGINAL_REQUEST §R2 |
| 20 | Tenant Store Error State Exposure | Expose error state when organization fetching fails rather than silently switching to demo | M3 | ORIGINAL_REQUEST §R2 |
| 21 | Opaque-box E2E Test Suite (Tiers 1-4) | Comprehensive multi-tier test harness covering email, backend auth/tenant, and frontend UI | E2E | ORIGINAL_REQUEST §Acceptance |
| 22 | 100% E2E Suite Pass & Adversarial Hardening | Validate all acceptance criteria against test suite, adversarial tests (Tier 5), and audit | M-Final | ORIGINAL_REQUEST §Acceptance |

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| E2E | E2E Testing Suite Track | Design and build test infrastructure & test cases (Tiers 1-4); publish TEST_READY.md | none | IN_PROGRESS |
| M1 | Email Delivery & Brevo Fixes | Features 1–6: email-config, /api/equipe, Brevo logging, SMTP fallback, env vars, test script | none | IN_PROGRESS |
| M2 | Django Backend Audit & Isolation | Features 7–14: TenantIsolationMixin, IDOR prevention, user invite, UserSerializer, tests | none | PLANNED |
| M3 | Frontend Error Rendering & UI | Features 15–20: TableErrorState, table error handling, detail pages, mutation checks, tenantStore | M1, M2 | PLANNED |
| M-Final | E2E Pass & Adversarial Hardening | Features 21–22: 100% pass of E2E suite, Tier 5 adversarial hardening, Forensic Audit | E2E, M1, M2, M3 | PLANNED |

## Interface Contracts

### Next.js API Routes ↔ Brevo REST API v3
- Endpoint: `POST https://api.brevo.com/v3/smtp/email`
- Headers:
  - `api-key`: string (from `process.env.BREVO_API_KEY` or fallback)
  - `content-type`: `application/json`
  - `accept`: `application/json`
- Request Payload:
  - `sender`: `{ name: string, email: string }` (must NOT be `@gmail.com` when dispatched via Brevo)
  - `to`: `[{ email: string, name?: string }]`
  - `replyTo`: `{ email: string, name: string }`
  - `subject`: string
  - `htmlContent`: string
  - `textContent`: string
  - `tags`: string[] (e.g. `["team-invitation"]`)
- Error Contract:
  - Any non-2xx status (400, 401, 402, 500) must be caught, logged with status code and body, and trigger fallback or user-friendly error response.

### Next.js Frontend ↔ Django Backend
- Base URL: `process.env.NEXT_PUBLIC_API_URL` (default: `http://localhost:8000/api`)
- Authentication: `Authorization: Bearer <access_token>`
- Tenant Context: `X-Organization-Id: <org_uuid>` (derived from authenticated user profile)
- Error Response Format:
  - HTTP 400: `{"<field>": ["<error_message>"]}` or `{"error": "<message>"}`
  - HTTP 401: `{"detail": "Given token not valid for any token type"}`
  - HTTP 403: `{"detail": "You do not have permission to perform this action."}`
  - HTTP 404: `{"detail": "Not found."}`
  - HTTP 500: `{"error": "<server_error>"}`
  - HTTP 503: `{"error": "Le serveur backend est injoignable."}`
- Client Contract:
  - Clients MUST check `res.ok`. If `!res.ok`, client must extract `error` / `detail` / field errors and render `TableErrorState` or error toast, NOT coerce to empty list.

## Code Layout
- Frontend Application: `app/`
  - Page Routes: `app/factures/`, `app/devis/`, `app/clients/`, `app/stocks/`, `app/depenses/`, `app/equipe/`, `app/entreprise/`, `app/parametres/`, `app/pos/`, etc.
  - API Routes: `app/api/equipe/route.ts`, `app/api/auth/send-verification-email/route.ts`, `app/api/clients/`, etc.
- Frontend Shared: `components/`, `lib/`
  - Configuration: `lib/email-config.ts`
  - State Stores: `lib/store/tenantStore.ts`, `lib/store/authStore.ts`
  - Reusable UI: `components/TableErrorState.tsx`, `components/ProtectedRoute.tsx`
- Backend Application: `fawatir_backend/`
  - Core API App: `fawatir_backend/api/`
    - Views: `api/views.py` (TenantIsolationMixin, ViewSets)
    - Serializers: `api/serializers.py` (UserSerializer, etc.)
    - Auth & Invites: `api/jwt_auth.py` (InviteUserView)
    - URLs: `api/urls.py`
    - Tests: `api/tests.py`, `api/test_tenant_isolation.py`
  - AI App: `fawatir_backend/ai/`
    - Services: `ai/services/import_executor.py`, `ai/services/chatbot.py`
- Test Infrastructure: `tests/`
  - E2E Tests: `tests/e2e/`
