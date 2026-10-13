# Security Findings & Vulnerability Review — IMAC Operations System

**Audit Date**: October 2026  
**Review Target**: Authentication, Sessions, Permissions & Error Handling (Steps 2 & 3 / Phase 0 Foundation)  
**Role**: Security Tester  
**Rules Applied**: Audit only; no fixes applied during this step. All vulnerabilities substantiated by automated Vitest integration tests in `apps/api/src/__tests__/security.test.ts`.

---

## Executive Summary

A security assessment of the authentication and authorization subsystems was conducted. The baseline authorization policy layer (`apps/api/src/lib/permissions.ts`) and role-based checks (`requirePermission`, `requireRole`) effectively enforce access boundaries against regular employees, viewers, and HR administrators attempting unauthorized administrative actions. IDOR parameter manipulation on user administration endpoints is blocked by permission checks, and deactivated accounts have their active sessions rejected.

However, several critical and high-severity weaknesses were identified, notably **missing CSRF protection across all administrative routes**, **unhandled asynchronous error crashes in Express 4**, **user enumeration via timing discrepancies**, and **administrative password-reset abuse surfaces**.

---

## Vulnerability Findings Ranked by Severity

| ID | Title | Severity | Affected Components | Status |
|---|---|---|---|---|
| **SEC-01** | Missing CSRF Protection on Administrative Endpoints | **CRITICAL** | `apps/api/src/app.ts` | Open (Unfixed) |
| **SEC-02** | Express 4 Async Unhandled Rejection Gap (Server Hang / Crash) | **CRITICAL** | `apps/api/src/routes/*`, `apps/api/src/middleware/auth.ts` | Open (Unfixed) |
| **SEC-03** | Missing Rate Limiting on Password Reset and Change Endpoints | **HIGH** | `apps/api/src/app.ts`, `apps/api/src/routes/auth.ts`, `apps/api/src/routes/admin/users.ts` | Open (Unfixed) |
| **SEC-04** | Global Error Handler Defaults to HTTP 500 for Client & CSRF Errors | **HIGH** | `apps/api/src/middleware/errorHandler.ts` | Open (Unfixed) |
| **SEC-05** | User Enumeration via Argon2id Verification Response Timing | **MEDIUM** | `apps/api/src/routes/auth.ts` | Open (Unfixed) |
| **SEC-06** | Admin Self-Reset & Cross-Admin Password Reset Without Sudo Mode | **MEDIUM** | `apps/api/src/routes/admin/users.ts` | Open (Unfixed) |
| **SEC-07** | Prior Session Records Retained in Database Upon Re-Login | **MEDIUM** | `apps/api/src/routes/auth.ts` | Open (Unfixed) |
| **SEC-08** | Insecure Cookie `Secure` Flag When Not Running with `NODE_ENV=production` | **LOW** | `apps/api/src/config.ts`, `apps/api/src/routes/auth.ts` | Open (Unfixed) |
| **SEC-09** | Trailing Whitespace in Username Bypasses Account Lockout Increment | **LOW** | `packages/shared/src/schemas/auth.ts`, `apps/api/src/routes/auth.ts` | Open (Unfixed) |
| **SEC-10** | Temporary Password Returned Plaintext in JSON Response Body | **LOW** | `apps/api/src/routes/admin/users.ts` | Open (Unfixed) |

---

## Detailed Vulnerability Analysis

### SEC-01: Missing CSRF Protection on Administrative Endpoints
- **Severity**: **CRITICAL**
- **CWE**: CWE-352: Cross-Site Request Forgery (CSRF)
- **Affected File**: `apps/api/src/app.ts` (lines 67–69)
- **Description**:
  In `app.ts`, `csrfMiddleware` is mounted exclusively on `/api/auth`:
  ```typescript
  app.use('/api/auth', csrfMiddleware, authRouter);
  app.use('/api/admin/users', adminUsersRouter);
  app.use('/api/admin/settings', adminSettingsRouter);
  ```
  The administrative routes (`/api/admin/users` and `/api/admin/settings`) are mounted without CSRF protection.
- **Exploit Scenario**:
  An attacker hosts a malicious page or sends a phishing link to an authenticated `system_admin`. When the administrator accesses the page, background cross-site requests are triggered using ambient browser session cookies to:
  - Create arbitrary administrative accounts (`POST /api/admin/users`).
  - Deactivate legitimate staff or executives (`PATCH /api/admin/users/:id/deactivate`).
  - Reset user passwords to gain unauthorized credentials (`POST /api/admin/users/:id/reset-password`).
  - Alter system policies (`PATCH /api/admin/settings/:key`).
- **Test Evidence**:
  `src/__tests__/security.test.ts` (Test: `security weakness: administrative routes (/api/admin/*) lack CSRF protection middleware`). State-changing requests succeed without providing any `x-csrf-token` header or cookie.
- **Remediation**:
  Apply CSRF protection middleware globally to all state-changing API routes (`/api/*`), or mount `csrfMiddleware` across both `adminUsersRouter` and `adminSettingsRouter`.

---

### SEC-02: Express 4 Async Unhandled Rejection Gap (Server Hang / Crash)
- **Severity**: **CRITICAL**
- **CWE**: CWE-703: Improper Check or Handling of Exceptional Conditions / CWE-248: Uncaught Exception
- **Affected Files**: `apps/api/src/routes/auth.ts`, `apps/api/src/routes/admin/users.ts`, `apps/api/src/routes/admin/settings.ts`, `apps/api/src/middleware/auth.ts`
- **Description**:
  In Express 4.x (`"express": "^4.19.2"`), route handlers and middlewares that return rejected Promises do not automatically pass the error to `next(err)`. Route handlers across the application are written as `async (req, res) => ...` without `try/catch` wrapping or an `asyncHandler` utility.
- **Exploit Scenario**:
  If the PostgreSQL database experiences a transient timeout, connection drop, or pool exhaustion during a request:
  1. The unhandled promise rejection is not caught by Express.
  2. The HTTP request hangs indefinitely until client timeout.
  3. Node.js emits an `unhandledRejection` event, which causes the Node.js process to terminate with exit code 1 in modern Node.js runtimes.
- **Test Evidence**:
  `src/__tests__/security.test.ts` (Test: `security weakness: async routes in Express 4 omit try/catch, resulting in unhandledRejection events`).
- **Remediation**:
  Install and import `express-async-errors` at the root of `apps/api/src/app.ts`, or wrap all async route handlers and middlewares with an `asyncHandler(fn)` wrapper that catches errors and forwards to `next(err)`.

---

### SEC-03: Missing Rate Limiting on Password Reset and Change Endpoints
- **Severity**: **HIGH**
- **CWE**: CWE-307: Improper Restriction of Excessive Authentication Attempts
- **Affected Files**: `apps/api/src/app.ts`, `apps/api/src/routes/auth.ts`, `apps/api/src/routes/admin/users.ts`
- **Description**:
  Rate limiting via `loginLimiter` is only attached to `POST /api/auth/login`. Neither `POST /api/auth/change-password` nor `POST /api/admin/users/:id/reset-password` has rate limiting or request throttling.
- **Impact**:
  - `POST /api/auth/change-password` can be brute-forced if a session cookie is intercepted.
  - `POST /api/admin/users/:id/reset-password` can be repeatedly triggered to invalidate user sessions and generate a flood of temporary credentials.
- **Remediation**:
  Implement dedicated rate limiters for `/api/auth/change-password` (e.g., 5 attempts per 15 minutes) and `/api/admin/users/:id/reset-password`.

---

### SEC-04: Global Error Handler Defaults to HTTP 500 for Client & CSRF Errors
- **Severity**: **HIGH**
- **CWE**: CWE-755: Improper Handling of Exceptional Conditions
- **Affected File**: `apps/api/src/middleware/errorHandler.ts`
- **Description**:
  `errorHandler` catches errors and unconditionally responds with:
  ```typescript
  res.status(500).json({ error: 'internal_error', message: 'An internal error occurred' });
  ```
  It does not check whether `err.status` or `err.statusCode` is set (e.g., HTTP 403 for `invalidCsrfTokenError` with code `EBADCSRFTOKEN` or HTTP 400 for malformed JSON bodies).
- **Impact**:
  CSRF rejections and client malformed request errors return 500 Internal Server Error instead of 403 Forbidden or 400 Bad Request, obscuring genuine operational failures.
- **Remediation**:
  Update `errorHandler` to check `err.status` / `err.statusCode` and handle specific known error types (e.g., `invalidCsrfTokenError`).

---

### SEC-05: User Enumeration via Argon2id Verification Response Timing
- **Severity**: **MEDIUM**
- **CWE**: CWE-208: Observable Timing Discrepancy
- **Affected File**: `apps/api/src/routes/auth.ts` (lines 35–47, 58)
- **Description**:
  When a user does not exist or `!user.isActive`, the endpoint immediately returns HTTP 401:
  ```typescript
  if (!user || !user.isActive) {
    return res.status(401).json({ error: 'invalid_credentials', ... });
  }
  ```
  When the user exists, `await verifyPassword(user.passwordHash, password)` executes Argon2id, introducing a 100ms–300ms processing delay.
- **Impact**:
  An attacker can measure request response times to reliably determine whether a username exists on the system.
- **Test Evidence**:
  `src/__tests__/security.test.ts` (Test: `security weakness: response timing difference between valid and invalid usernames`).
- **Remediation**:
  Execute a dummy Argon2id hash verification on an invalid hash whenever `!user` to ensure approximately constant response times regardless of username validity.

---

### SEC-06: Admin Self-Reset & Cross-Admin Password Reset Without Sudo Mode
- **Severity**: **MEDIUM**
- **CWE**: CWE-284: Improper Access Control
- **Affected File**: `apps/api/src/routes/admin/users.ts` (lines 144–180)
- **Description**:
  While account deactivation (`PATCH /:id/deactivate`) and role changes (`PATCH /:id/role`) explicitly prevent self-targeting (`if (req.user?.id === targetId) return res.status(400)`), the password reset endpoint (`POST /:id/reset-password`) has no self-target prevention.
  Furthermore, one `system_admin` can reset the other `system_admin`'s password without providing their own current password ("sudo mode").
- **Impact**:
  An administrator can accidentally or intentionally reset their own password via the admin route, generating a temporary password and forcing a password change. In an organization with two admins (`boss` and `akrit`), either can lock out the other without credential re-verification.
- **Test Evidence**:
  `src/__tests__/security.test.ts` (Test: `security weakness: admin can reset their own password via admin reset endpoint without self-reset block`).
- **Remediation**:
  Add `if (req.user?.id === targetId) return res.status(400)` to the reset-password endpoint, and require re-authentication (current password) before resetting another administrator's password.

---

### SEC-07: Prior Session Records Retained in Database Upon Re-Login
- **Severity**: **MEDIUM**
- **CWE**: CWE-384: Session Fixation / Session Invalidation
- **Affected File**: `apps/api/src/routes/auth.ts` (lines 112–120)
- **Description**:
  Logging in creates a new session in PostgreSQL (`createSession`) and updates the client's cookie. However, if the client previously held an active session, that session record is not deleted from PostgreSQL.
- **Impact**:
  If a user's previous session token was captured by an attacker, the attacker's session remains active in the database even after the legitimate user logs in again.
- **Test Evidence**:
  `src/__tests__/security.test.ts` (Test: `security weakness: login does not delete pre-existing sessions from the database`).
- **Remediation**:
  When logging in, if a valid session cookie was present on the request, revoke that session record in `db.session`. Alternatively, provide a configurable setting to terminate all prior sessions for the user upon new login (single-session policy).

---

### SEC-08: Insecure Cookie `Secure` Flag When Not Running with `NODE_ENV=production`
- **Severity**: **LOW**
- **CWE**: CWE-614: Sensitive Cookie in HTTPS Session Without 'Secure' Attribute
- **Affected Files**: `apps/api/src/config.ts`, `apps/api/src/routes/auth.ts`
- **Description**:
  Cookies set `secure: config.isProduction`, where `isProduction = process.env.NODE_ENV === 'production'`. Master Brief Section 3 specifies: *"Use HTTPS on the local network (internal certificate via the reverse proxy) so passwords are never sent in plain text."*
- **Impact**:
  If the office server is launched in development or staging mode on the local network, cookies will not enforce the `Secure` attribute, allowing them to be sent over cleartext HTTP if an employee mistakenly bypasses HTTPS.
- **Remediation**:
  Allow an explicit configuration variable `SESSION_COOKIE_SECURE=true` defaulting to true whenever accessed over HTTPS or in local staging/production setups.

---

### SEC-09: Trailing Whitespace in Username Bypasses Account Lockout Increment
- **Severity**: **LOW**
- **CWE**: CWE-20: Improper Input Validation
- **Affected Files**: `packages/shared/src/schemas/auth.ts`, `apps/api/src/routes/auth.ts`
- **Description**:
  The Zod schema `loginSchema` defines `username: z.string().min(1)` without `.trim()`. Querying PostgreSQL with `username: { equals: "boss ", mode: 'insensitive' }` does not match the database username `"boss"`.
- **Impact**:
  Failed login attempts using `"boss "` return 401 without updating `"boss"`'s `failedLoginCount`, allowing an attacker to submit passwords without triggering the 5-failure lockout counter for the target user.
- **Test Evidence**:
  `src/__tests__/security.test.ts` (Test: `security weakness: trailing whitespace in username creates lockout inconsistency`).
- **Remediation**:
  Normalize and sanitize usernames in `loginSchema` using `z.string().min(1).trim()`.

---

### SEC-10: Temporary Password Returned Plaintext in JSON Response Body
- **Severity**: **LOW**
- **CWE**: CWE-312: Cleartext Storage of Sensitive Information
- **Affected File**: `apps/api/src/routes/admin/users.ts` (lines 70, 180)
- **Description**:
  When an administrator creates a user or resets a password, the cleartext temporary password is returned in the API JSON response (`{ temporaryPassword }`).
- **Impact**:
  If administrative network traffic passes through HTTP inspection proxies or browser developer consoles, cleartext temporary passwords are exposed.
- **Remediation**:
  Ensure secure delivery channels or provide one-time display mechanisms with audit logging when temporary passwords are generated.

---

## Verified Security Controls (Passing Tests)

The following controls from Phase 0 were tested and confirmed to be functioning correctly:
1. **Privilege Escalation Prevention**:
   - Authenticated `employee` and `viewer` accounts cannot access or call any `/api/admin/*` routes (all return HTTP 403 Forbidden).
   - `hr_admin` cannot create users, change system roles, reset passwords, deactivate accounts, or edit system settings (all return HTTP 403 Forbidden).
2. **Insecure Direct Object Reference (IDOR)**:
   - An employee substituting other user IDs into `/api/admin/users/:id` or action routes is stopped by the permission layer (HTTP 403 Forbidden).
   - `/api/auth/me` is strictly bound to `req.user.id` from the session token.
3. **Deactivated User Handling**:
   - Deactivated users cannot log in (HTTP 401 Unauthorized).
   - If an active session's user is deactivated in the database, subsequent requests immediately return HTTP 401 Unauthorized and clear the session cookie (`Set-Cookie: IMAC_SESSION=; Max-Age=0`).
   - Deactivating a user through `PATCH /api/admin/users/:id/deactivate` calls `deleteUserSessions(userId)` to delete all active database sessions.
4. **Account Lockout**:
   - 5 consecutive failed login attempts trigger an immediate account lockout (setting `lockedUntil` for 15 minutes).
   - Logins during the lockout window return HTTP 423 Locked without computing password hashes.
   - Case variations (`bOsS` vs `boss`) cannot bypass the lockout due to `mode: 'insensitive'` query matching.
5. **Session Fixation Prevention**:
   - Successful logins always issue a brand new session identifier and overwrite incoming session cookies.
6. **Core Cookie Security**:
   - Session cookies include `HttpOnly`, `Path=/`, and `SameSite=Strict`.
   - CSRF token cookies include `HttpOnly`, `Path=/`, and `SameSite=Strict`.
