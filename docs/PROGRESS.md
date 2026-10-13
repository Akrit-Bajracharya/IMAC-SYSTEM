# IMAC Nepal Internal Operations System — Implementation Progress

## Current Milestone: Security Hardening & Remediation (SEC-01 to SEC-10) — COMPLETED

### 1. What Was Built
- **Security Hardening (Remediation of Findings SEC-01 to SEC-10)**:
  - **SEC-01 (CSRF on Admin Routes)**: Extended CSRF protection middleware globally across `/api/admin/users` and `/api/admin/settings` in `apps/api/src/app.ts`. Added `csrfEnabled` option to `createApp()` to support deterministic CSRF testing.
  - **SEC-02 (Unhandled Async Errors)**: Created `asyncHandler` middleware in `apps/api/src/middleware/asyncHandler.ts` and wrapped all async handlers across auth and admin routes. Added `try/catch` in `requireAuth` middleware to ensure DB/runtime errors are forwarded to `next(err)` and return HTTP 500 without crashing Node.js.
  - **SEC-03 (Rate Limiting)**: Added `changePasswordLimiter` (10 per 15 min per IP) and `resetPasswordLimiter` (10 per 15 min per IP) in `apps/api/src/app.ts`.
  - **SEC-04 (Error Status Mapping)**: Updated `apps/api/src/middleware/errorHandler.ts` to map CSRF rejections (`EBADCSRFTOKEN`) to HTTP 403 (`csrf_invalid`) and JSON body syntax errors to HTTP 400 (`invalid_json`), preserving explicit 4xx statuses.
  - **SEC-05 (User Enumeration Timing Mitigation)**: Added `getDummyHash()` in `apps/api/src/services/password.ts` to precompute a dummy Argon2id hash. In `apps/api/src/routes/auth.ts`, login runs `verifyPassword` against the dummy hash when users are non-existent or inactive, standardizing response timing.
  - **SEC-06 (Admin Self-Reset Guard)**: Added check `if (req.user?.id === targetId)` to `POST /api/admin/users/:id/reset-password` returning HTTP 400 (`invalid_action`). Admins must change their own password via `/api/auth/change-password`.
  - **SEC-07 (Session Retention Policy)**: Retained multi-session support by policy as documented in `docs/open-policy-questions.md`.
  - **SEC-08 (Cookie Secure Flag)**: Configured session cookies to enforce `secure: true` when `NODE_ENV=production` or `SESSION_COOKIE_SECURE=true`.
  - **SEC-09 (Username Input Sanitization)**: Updated `loginSchema` in `packages/shared/src/schemas/auth.ts` with `.trim().toLowerCase()` and rebuilt `@imac/shared`. Whitespace variants cleanly map to the user and increment lockout counters.
  - **SEC-10 (Temporary Password Cache Prevention)**: Added `Cache-Control: no-store` header to responses returning temporary passwords in `apps/api/src/routes/admin/users.ts`. Ensured plaintext passwords are never logged in audit trails.
- **Automated Test Updates (`apps/api/src/__tests__/security.test.ts`)**:
  - Updated all 7 vulnerability test cases to assert safe behavior instead of weaknesses.
  - Added new tests for `SESSION_COOKIE_SECURE`, `Cache-Control: no-store`, dummy hash execution, and 403 CSRF status mapping (total: 51 security tests, 74 overall).
- **Documentation**:
  - Updated `docs/security-findings.md` with remediation details and verified status for all 10 items.
  - Updated `docs/open-policy-questions.md` questions 8 and 10 with implementation status.

---

### 2. Verification & Test Results
- **Type Checking**:
  - Clean across all workspaces (`packages/shared`, `apps/api`, `apps/web` via `npm run typecheck`).
- **Unit & Integration Tests**:
  - Vitest test suite (`apps/api`): 3 test files, **74 passing tests (0 failures)**:
    - `src/__tests__/permissions.test.ts`: 10 tests passed
    - `src/__tests__/auth.test.ts`: 13 tests passed
    - `src/__tests__/security.test.ts`: 51 tests passed
- **Monorepo Build**:
  - `@imac/shared` built clean (`dist/` generated).

---

### 3. What is Untested (Awaiting Environment / Next Steps)
- Live database performance benchmarks and rate limiter stress tests under high concurrent traffic.
- End-to-end browser tests via Playwright (scheduled for Phase 7).

---

### 4. Assumptions Made
- Single-session vs multi-session concurrency remains an open organizational policy question (SEC-07); multi-session concurrency is kept as the default.
- Cross-admin password reset remains permitted and audited; sudo-mode re-authentication for cross-admin actions is logged as a future policy question.

---

### 5. What the Next Step Needs (Phase 1)
- Prompt: **PHASE 1: Users, employees and work roles (admin side)**.
- Needs:
  - System admin screens to create/deactivate users, set system roles, edit employee profiles (shift length, working days, department), and reset passwords.
  - The `WorkRole` catalogue schema and backend APIs.
  - Admin assignment of specific work roles to each specific employee.
  - Searchable employee directory showing permitted fields only.
  - Audit logging of all user and work role administrative actions.
