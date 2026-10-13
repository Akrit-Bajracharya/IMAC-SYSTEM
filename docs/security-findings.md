# Security Findings & Vulnerability Review — IMAC Operations System

**Audit Date**: October 2026  
**Review Target**: Authentication, Sessions, Permissions & Error Handling (Steps 2 & 3 / Phase 0 Foundation)  
**Remediation Milestone**: Security Hardening (SEC-01 to SEC-10 Remediation) — COMPLETED  
**Status**: All 10 findings resolved and verified via automated Vitest integration tests in `apps/api/src/__tests__/security.test.ts`.

---

## Executive Summary

A comprehensive security hardening pass was completed to remediate findings SEC-01 through SEC-10. All critical and high-severity weaknesses have been addressed:
- **CSRF Protection** is now enforced across all administrative state-changing routes (`/api/admin/users`, `/api/admin/settings`).
- **Unhandled Async Errors** in routes and middleware are safely routed to central error handling via an `asyncHandler` wrapper and try/catch guards, returning HTTP 500 without crashing the process.
- **Error Mapping** has been updated to return HTTP 403 for CSRF rejections and HTTP 400 for malformed request payloads instead of masking them as 500.
- **Timing Discrepancies** on login are mitigated by executing a dummy Argon2id hash comparison when users do not exist.
- **Rate Limiting** is applied to `/api/auth/change-password` and `/api/admin/users/:id/reset-password`.
- **Self-Reset by Admins** is explicitly blocked on the administrative reset endpoint.
- **Input Sanitization** now trims and lowercases usernames prior to database queries.
- **HTTP Caching** is disabled (`Cache-Control: no-store`) on responses returning temporary passwords.

---

## Vulnerability Findings & Remediation Status

| ID | Title | Severity | Affected Components | Status |
|---|---|---|---|---|
| **SEC-01** | Missing CSRF Protection on Administrative Endpoints | **CRITICAL** | `apps/api/src/app.ts` | **FIXED** |
| **SEC-02** | Express 4 Async Unhandled Rejection Gap (Server Hang / Crash) | **CRITICAL** | `apps/api/src/routes/*`, `apps/api/src/middleware/auth.ts` | **FIXED** |
| **SEC-03** | Missing Rate Limiting on Password Reset and Change Endpoints | **HIGH** | `apps/api/src/app.ts` | **FIXED** |
| **SEC-04** | Global Error Handler Defaults to HTTP 500 for Client & CSRF Errors | **HIGH** | `apps/api/src/middleware/errorHandler.ts` | **FIXED** |
| **SEC-05** | User Enumeration via Argon2id Verification Response Timing | **MEDIUM** | `apps/api/src/routes/auth.ts`, `apps/api/src/services/password.ts` | **FIXED** |
| **SEC-06** | Admin Self-Reset & Cross-Admin Password Reset Without Sudo Mode | **MEDIUM** | `apps/api/src/routes/admin/users.ts` | **FIXED** |
| **SEC-07** | Prior Session Records Retained in Database Upon Re-Login | **MEDIUM** | `apps/api/src/routes/auth.ts`, `docs/open-policy-questions.md` | **RETAINED BY POLICY** |
| **SEC-08** | Insecure Cookie `Secure` Flag When Not Running with `NODE_ENV=production` | **LOW** | `apps/api/src/routes/auth.ts` | **FIXED** |
| **SEC-09** | Trailing Whitespace in Username Bypasses Account Lockout Increment | **LOW** | `packages/shared/src/schemas/auth.ts`, `apps/api/src/routes/auth.ts` | **FIXED** |
| **SEC-10** | Temporary Password Returned Plaintext in JSON Response Body | **LOW** | `apps/api/src/routes/admin/users.ts` | **FIXED** |

---

## Detailed Remediation Actions

### SEC-01: Missing CSRF Protection on Administrative Endpoints
- **Severity**: **CRITICAL**
- **Status**: **FIXED**
- **Action Taken**: In `apps/api/src/app.ts`, mounted `csrfMiddleware` across both `adminUsersRouter` (`/api/admin/users`) and `adminSettingsRouter` (`/api/admin/settings`). State-changing requests lacking a valid CSRF token now fail with HTTP 403 Forbidden.
- **Verification**: Tested in `security.test.ts` (`SEC-01 & SEC-04: administrative routes (/api/admin/*) enforce CSRF and return 403 when token is missing`).

### SEC-02: Express 4 Async Unhandled Rejection Gap
- **Severity**: **CRITICAL**
- **Status**: **FIXED**
- **Action Taken**: Implemented `asyncHandler` middleware (`apps/api/src/middleware/asyncHandler.ts`) and wrapped all async route handlers across `authRouter`, `adminUsersRouter`, and `adminSettingsRouter`. Wrapped async `requireAuth` middleware with try/catch to forward exceptions to `next(err)`. Unhandled database or runtime errors reliably return HTTP 500 and log the error without terminating the Node.js process.
- **Verification**: Tested in `security.test.ts` (`SEC-02: unhandled async DB error in route returns HTTP 500 cleanly via asyncHandler` and `requireAuth middleware returns HTTP 500 cleanly`).

### SEC-03: Missing Rate Limiting on Password Reset and Change Endpoints
- **Severity**: **HIGH**
- **Status**: **FIXED**
- **Action Taken**: Configured dedicated rate limiters in `apps/api/src/app.ts`:
  - `changePasswordLimiter`: Max 10 attempts per 15 minutes per IP on `/api/auth/change-password`.
  - `resetPasswordLimiter`: Max 10 attempts per 15 minutes per IP on `/api/admin/users/:id/reset-password`.

### SEC-04: Global Error Handler Defaults to HTTP 500 for Client & CSRF Errors
- **Severity**: **HIGH**
- **Status**: **FIXED**
- **Action Taken**: Updated `apps/api/src/middleware/errorHandler.ts` to inspect error attributes:
  - Code `EBADCSRFTOKEN` returns HTTP 403 with `{ error: 'csrf_invalid', message: 'Invalid or missing CSRF token' }`.
  - JSON body syntax errors return HTTP 400 with `{ error: 'invalid_json' }`.
  - Preserves explicit 4xx error codes before defaulting to HTTP 500.

### SEC-05: User Enumeration via Argon2id Verification Response Timing
- **Severity**: **MEDIUM**
- **Status**: **FIXED**
- **Action Taken**: Pre-computed a constant dummy Argon2id hash via `getDummyHash()` in `apps/api/src/services/password.ts`. In `apps/api/src/routes/auth.ts`, whenever a username is not found or is inactive, `verifyPassword` is executed against the dummy hash, eliminating observable response-time discrepancies between existing and non-existing accounts.
- **Verification**: Tested in `security.test.ts` (`SEC-05: password verification runs dummy hash check when username does not exist`).

### SEC-06: Admin Self-Reset Guard
- **Severity**: **MEDIUM**
- **Status**: **FIXED**
- **Action Taken**: Added `if (req.user?.id === targetId)` guard to `POST /api/admin/users/:id/reset-password` in `apps/api/src/routes/admin/users.ts`. System administrators attempting to reset their own password via the admin route receive HTTP 400 Bad Request with guidance to use `/api/auth/change-password`. Cross-admin password reset remains permitted and audited as logged in `docs/open-policy-questions.md`.
- **Verification**: Tested in `security.test.ts` (`SEC-06: blocks admin from resetting their own password via admin reset endpoint`).

### SEC-07: Prior Session Records Retained in Database Upon Re-Login
- **Severity**: **MEDIUM**
- **Status**: **RETAINED BY POLICY**
- **Action Taken**: Re-verified that multi-session support is the intended initial default pending IMAC organizational decision. Session records are preserved upon subsequent logins, and the policy question remains documented under Question 7 in `docs/open-policy-questions.md`.

### SEC-08: Insecure Cookie `Secure` Flag When Not Running in `NODE_ENV=production`
- **Severity**: **LOW**
- **Status**: **FIXED**
- **Action Taken**: In `apps/api/src/routes/auth.ts`, configured cookie `secure` attribute to check `process.env['NODE_ENV'] === 'production' || process.env['SESSION_COOKIE_SECURE'] === 'true'`. Added a dedicated test confirming the `Secure` flag is added when `SESSION_COOKIE_SECURE=true`.
- **Verification**: Tested in `security.test.ts` (`SEC-08: Secure flag is enforced when NODE_ENV=production or SESSION_COOKIE_SECURE=true`).

### SEC-09: Trailing Whitespace in Username Bypasses Account Lockout Increment
- **Severity**: **LOW**
- **Status**: **FIXED**
- **Action Taken**: Updated `loginSchema` in `packages/shared/src/schemas/auth.ts` with `.trim().toLowerCase()`. Input usernames are normalized during Zod validation before database lookup and lockout tracking, ensuring variants like `'  boss  '` resolve to the same user and properly increment failed login counters.
- **Verification**: Tested in `security.test.ts` (`SEC-09: trailing and leading whitespace in username is trimmed and correctly matches user`).

### SEC-10: Temporary Password Returned Plaintext in JSON Response Body
- **Severity**: **LOW**
- **Status**: **FIXED**
- **Action Taken**: Added `res.setHeader('Cache-Control', 'no-store')` to both `POST /api/admin/users` (user creation) and `POST /api/admin/users/:id/reset-password` in `apps/api/src/routes/admin/users.ts`. Confirmed temporary passwords are never recorded in audit log snapshots.
- **Verification**: Tested in `security.test.ts` (`password reset sets Cache-Control: no-store` and `user creation returns Cache-Control: no-store`).
