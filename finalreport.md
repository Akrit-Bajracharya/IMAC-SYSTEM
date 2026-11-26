# IMAC Nepal Internal Operations System — Comprehensive Project Report & Documentation

**Generated**: 2026-10-27 13:36:20 +05:45  
**Scope**: Project Inception through Milestone Step 8b (Daily Work Log Backend — APIs, Policies, Validation, Audit)  
**Repository Branch**: `step-08-worklog-backend`  
**Working Environment**: Node.js v22 (monorepo), TypeScript 5.5, Express 4.19, Prisma 5.17, PostgreSQL, React 18, Vite, Vitest

---

## 1. Executive Summary

The **IMAC Nepal Internal Operations System** is an enterprise-grade internal platform engineered for operational planning, employee self-service, administrative management, daily shift work tracking, and organization-wide visibility.

This document serves as the master technical report and reference manual for all engineering milestones completed through **Step 8b**. It details the chronological timeline, architectural patterns, database schemas, security hardening invariants (SEC-01 through SEC-10), role-based access control (RBAC) matrices, RESTful API specifications, policy engines, and testing verifications.

---

## 2. Chronological Engineering Log

| Date & Time (UTC+05:45) | Milestone / Phase | Summary of Deliverables & Changes | Reference / Commit |
|---|---|---|---|
| **2026-10-12 15:52:26** | **Steps 1–4**: Project Foundation, Monorepo, Auth, Permissions & App Shell | Established `npm` workspaces monorepo (`apps/api`, `apps/web`, `packages/shared`). Set up Express server with cookie-based session authentication, Argon2 password hashing, RBAC permission checker (`can(user, action)`), and foundational React + Vite application shell with Tailwind CSS. | `6f49806` |
| **2026-10-13 10:09:32** | **Initial Database Setup** | Introduced PostgreSQL schema with Prisma ORM (`User`, `EmployeeProfile`, `Session`, `SystemSetting`, `AuditLog`). Created initial migration `20261013040722_init`. Seeded default administrative accounts (`boss`, `akrit`). | `cb16edb` |
| **2026-10-13 12:33:28** | **Developer Tooling** | Added `pino-pretty` development dependency for structured JSON log formatting in development environments. | `49623a0` |
| **2026-10-13 13:22:45** | **Step 5**: Security Audits & Threat Modeling | Conducted systematic security audit against OWASP Top 10 and enterprise threat scenarios. Authoring comprehensive test suite in `apps/api/src/__tests__/security.test.ts`. Identified security findings SEC-01 through SEC-10. | `080341f` |
| **2026-10-13 15:03:41** | **Security Hardening (SEC-01 to SEC-10)** | Implemented strict defenses: double-submit cookie CSRF protection (`csrf-csrf`), constant-time password comparison to prevent timing attacks, brute-force rate limiters, session invalidation on password reset/deactivation, and hardened HTTP headers (`helmet`). | `10f7460` |
| **2026-10-13 16:23:22** | **Step 6a**: Work Roles Subsystem (Backend) | Added `WorkRole` and `EmployeeWorkRole` data models (`20261013093000_work_roles`). Implemented admin catalogue CRUD and assignment endpoints under `/api/admin/work-roles`. Added employee self-service query `GET /api/work-roles/my-roles`. Added 40 unit/integration tests in `workRoles.test.ts`. | `16c8741` |
| **2026-10-14 12:48:40** | **Step 6b**: Availability Status, Employee Directory & Admin Users Rewrite | Added `AvailabilityStatus` model and enum (`20261013110000_availability_status`). Rewrote admin user administration routes with concurrent user/profile creation. Implemented searchable, role-redacted staff directory (`/api/employees`, `/api/directory`). Standardized canonical identifier: `employeeId = userId`. Added 20 tests in `usersAdmin.test.ts`. | `5efc719` |
| **2026-10-26 14:44:43** | **Steps 07 & 07b**: Frontend Admin Screens & Staff Directory | Developed interactive administrative pages in `apps/web`: `UsersListPage`, `WorkRolesPage`, `EmployeeWorkRolesPage`, and staff `DirectoryPage`. Added reusable UI modals (`ConfirmationModal`, `TemporaryPasswordModal`), one-time temporary password reveal, `AvailabilityBadge`, and internationalization via `react-i18next`. Added user reactivation route `PATCH /api/admin/users/:id/reactivate`. | `c27e3fa` |
| **2026-10-26 16:52:49** | **Step 8a**: Daily Work Log Data Layer | Created database schema and migration `20261026140000_work_log_models` for `WorkLogStatus` enum (`draft`, `submitted`, `approved`, `rejected`), `WorkLogDay` model, and `WorkLogEntry` model. Added composite unique constraint `@@unique([employeeProfileId, date])`. Configured policy seed keys (`worklog.requiresApproval`, `worklog.mismatchHandling`, `worklog.editWindowHours`). | `d1acba9` |
| **2026-10-27 12:14:00 – 13:35:00** | **Step 8b**: Daily Work Log Backend Part 2 (APIs, Policies, Validation, Audit) | Designed and built the complete backend application layer for daily work logs: shared Zod schemas (`@imac/shared`), single upsert-draft route (`POST /api/work-logs`), transaction-safe entry patching with edit window checks (`PATCH /api/work-logs/:id`), atomic conditional submission (`POST /api/work-logs/:id/submit`), single-day/weekly/monthly query endpoints, dedicated system admin override route (`PATCH /api/admin/work-logs/:id/override`), permission actions (`worklog:readOwn`, `worklog:writeOwn`, `worklog:adminOverride`), stubs for leave and overtime, and +40 automated tests bringing test suite to **180 passing tests**. | Current working branch (`step-08-worklog-backend`) |

---

## 3. High-Level Architecture & Tech Stack

```
                          ┌────────────────────────┐
                          │   Frontend (apps/web)  │
                          │ React 18, Vite, i18n   │
                          │   Tailwind CSS, Wouter │
                          └───────────┬────────────┘
                                      │ HTTP / JSON (Credentials: SameSite cookies)
                                      ▼
                          ┌────────────────────────┐
                          │    Backend (apps/api)  │
                          │ Express, Helmet, Cors  │
                          │ Pino, double-csrf      │
                          └─────┬────────────┬─────┘
                                │            │
           Prisma ORM 5.17      │            │ Types & Zod Schemas
                                ▼            ▼
┌─────────────────────────────────┐   ┌─────────────────────────────┐
│      PostgreSQL Database        │   │ Shared Package              │
│ Users, Profiles, Sessions, Logs │   │ (@imac/shared)              │
│ SystemSettings, AuditTrail      │   │ Common schemas, types, DTOs │
└─────────────────────────────────┘   └─────────────────────────────┘
```

### Monorepo Structure
- **`apps/api/`**: Express.js REST API server with Prisma ORM, Argon2, and Pino structured logging.
- **`apps/web/`**: Single-page application using React, Vite, Tailwind CSS, Lucide icons, and `react-i18next`.
- **`packages/shared/`**: Compiled TypeScript package containing shared types, enums, interfaces, and Zod validation schemas.
- **`docs/`**: Central architecture records, security findings, and policy decision logs (`open-policy-questions.md`, `PROGRESS.md`).

---

## 4. Subsystem Details & Milestones (Step 1 through Step 8b)

### 4.1. Authentication, Sessions & Security (Steps 1–5)
- **Session-Based Authentication**: Custom stateful sessions stored in PostgreSQL (`Session` table) with high-entropy IDs generated using cryptographic randomness.
- **Cookie Security**: HTTP-only, `SameSite=Strict` cookies (`IMAC_SESSION`).
- **Password Hashing**: Argon2id hashing via `argon2` with high-memory parameters.
- **First-Run Admin Accounts**: Seeded administrative accounts (`boss`, `akrit`) with optional forced password change upon first login (`ADMIN_REQUIRE_PASSWORD_CHANGE`).
- **Brute-Force & Rate Limiting**:
  - `loginLimiter`: 20 requests per 15 minutes per IP.
  - `changePasswordLimiter`: 10 requests per 15 minutes per IP.
  - `resetPasswordLimiter`: 10 password resets per 15 minutes per IP.
  - Account lockouts: 5 consecutive failed login attempts lock account for 15 minutes (`failedLoginCount`, `lockedUntil`).
- **Timing Attack Mitigation (SEC-05)**: When an unknown username is submitted to the login route, a dummy Argon2 verification is executed to maintain constant-time response profiles.
- **CSRF Defense (SEC-01)**: Implemented using `csrf-csrf`. Tokens issued via `GET /api/auth/csrf` and required as `x-csrf-token` header on all mutating requests (`POST`, `PATCH`, `PUT`, `DELETE`).
- **Audit Logging**: Append-only audit records (`AuditLog` table) tracking `actorUserId`, action strings, timestamps, IP addresses, and `beforeSnapshot`/`afterSnapshot` JSON objects.

---

### 4.2. Work Roles & Assignment Subsystem (Step 6a)
- **Role Catalogue**: System administrators configure organizational work roles (`WorkRole`: `id`, `name`, `description`, `isActive`). Deactivation is supported in place of physical deletion to protect historical log entries.
- **Role Assignment**: `EmployeeWorkRole` mapping links `EmployeeProfile` to `WorkRole`.
- **RBAC**: Only `system_admin` may create, modify, deactivate, assign, or revoke work roles (`workrole:*` actions).
- **Employee Self-Service**: `GET /api/work-roles/my-roles` returns active roles assigned to the authenticated user.

---

### 4.3. Availability Status & Employee Directory (Step 6b & Step 7)
- **Availability States**: `available`, `busy_in_meeting`, `out_of_office`, `on_leave`, `working_remotely`.
- **Canonical Identifier Standard**: `employeeId` represents `userId` across all routes.
- **Role-Redacted Directory (`/api/employees`)**:
  - *Standard staff* (`employee`, `viewer`, `project_manager`): Access public fields only (`id`, `displayName`, `department`, `jobTitle`, `availability`).
  - *Privileged staff* (`system_admin`, `hr_admin`): Access extended operational attributes (`employeeCode`, `standardShiftHours`, `workingDaysPerWeek`, `startDate`, `managerUserId`).
  - *Invariant*: Passwords, hashes, lockout timestamps, and session tokens are strictly omitted from directory responses.
- **Account Reactivation (`PATCH /api/admin/users/:id/reactivate`)**: Re-enables deactivated users, resets failed login counts, and clears lockout status.

---

### 4.4. Daily Work Log Data Layer (Step 8a)
- **Database Schema**:
  - `WorkLogDay`:
    - `id`: UUID primary key.
    - `employeeProfileId`: Foreign key to `EmployeeProfile` (cascade delete).
    - `date`: `@db.Date` calendar date (UTC midnight representation).
    - `status`: Enum (`draft`, `submitted`, `approved`, `rejected`), defaulting to `draft`.
    - `submittedAt`, `approvedAt`, `approvedByUserId`, `rejectionReason`: Workflow metadata.
    - `@@unique([employeeProfileId, date])`: Composite database constraint ensuring strictly one daily log per employee per date.
  - `WorkLogEntry`:
    - `id`: UUID primary key.
    - `workLogDayId`: Foreign key to `WorkLogDay` (cascade delete).
    - `workRoleId`: Foreign key to `WorkRole` (onDelete: Restrict).
    - `hours`: Float hours.
    - `description`: Optional text.
    - `projectId`, `taskId`: Nullable hooks for future project integration.

---

### 4.5. Daily Work Log Backend & Policy Engine (Step 8b)

Step 8b completes the daily work log application layer, validation pipelines, policy resolution, and audit tracking.

#### Core Architectural Decisions:
1. **Single Upsert-Draft Route (`POST /api/work-logs`)**:
   - Creates a new `draft` record or updates an existing `draft`.
   - If a record for that date exists in `submitted` or `approved` status, rejects with **409 Conflict** (`status_conflict`).
   - Surfaces database unique constraint collisions as **409 Conflict** (`day_already_exists`).
2. **Transaction-Safe Atomic PATCH (`PATCH /api/work-logs/:id`)**:
   - Replaces all entries in a single database transaction.
   - Evaluates the edit window atomically inside the transaction.
   - If log status is `submitted` and within `editWindowHours`, generates an `AuditLog` entry (`work_log.edited_after_submit`).
   - If log status is `approved`, rejects employee edits with **403 Forbidden** (`log_already_approved`).
3. **Conditional Atomic Submission (`POST /api/work-logs/:id/submit`)**:
   - Executes single conditional update: `where: { id, employeeProfileId, status: 'draft' }`.
   - Zero updated rows surfaces immediately as **400 Bad Request** (`already_submitted`).
   - Evaluates `worklog.mismatchHandling` policy against `employeeProfile.standardShiftHours`.
4. **Dedicated System Admin Override (`PATCH /api/admin/work-logs/:id/override`)**:
   - Restricted exclusively to `system_admin` (`worklog:adminOverride`).
   - Requires a mandatory, non-empty `reason` string (rejects empty/whitespace with 400).
   - Can override any log regardless of edit window or approval status.
   - Automatically logs an `AuditLog` record (`work_log.admin_override`) recording the actor, timestamp, reason, and before/after snapshot.
5. **Route Precedence**: `/by-date`, `/by-week`, and `/by-month` are explicitly declared before `/:id` to prevent routing collisions.
6. **Timezone Evaluation**: Date boundaries are calculated relative to `Asia/Kathmandu` (UTC+05:45): `MAX_FUTURE_DAYS = 1`, `MAX_PAST_DAYS = 90`.
7. **Clean Stubs**: Added empty, non-invasive stubs for `checkApprovedLeave` (returns `{ hasApprovedLeave: false }`) and `handleOvertimeFlow` (returns `{ isOvertime: false, overtimeHours: 0 }`).

---

## 5. System Configuration & Policy Registry

System policies are stored in the `SystemSetting` table and read at runtime with neutral fallback mechanisms:

| Setting Key | Default Value | Accepted Values | Description & Fallback Rule |
|---|---|---|---|
| `worklog.requiresApproval` | `"false"` | `"true"` \| `"false"` | Dictates whether submitted hours require explicit manager approval before being treated as official. Defaults to `"false"` if invalid. *(Noted as unused in Step 8b workflow logic)*. |
| `worklog.mismatchHandling` | `"warn"` | `"block"` \| `"warn"` \| `"allow"` | Submission validation behavior when total entry hours != `standardShiftHours`.<br>• `"block"`: Rejects submit with HTTP 422 (`hour_mismatch`).<br>• `"warn"`: Succeeds with a non-blocking message in `warnings` array.<br>• `"allow"`: Succeeds with empty `warnings` array.<br>Falls back to `"warn"` if setting contains any unexpected string. |
| `worklog.editWindowHours` | `"24"` | Positive integer string | Duration in hours (measured from `submittedAt`) during which an employee can edit a submitted log. Falls back to `24` if non-numeric or <= 0. |
| `session.inactivityTimeoutMinutes` | `"30"` | Positive integer string | Inactivity duration before an active session cookie expires. |
| `auth.lockoutThreshold` | `"5"` | Positive integer string | Number of consecutive failed logins before temporary account lockout. |
| `auth.lockoutDurationMinutes` | `"15"` | Positive integer string | Lockout duration in minutes. |
| `auth.minPasswordLength` | `"10"` | Positive integer string | Minimum required password length. |

---

## 6. Comprehensive RBAC & Permissions Matrix

All route permissions are resolved using `can(user, action)` from `apps/api/src/lib/permissions.ts`:

| Permission / Action | `system_admin` | `hr_admin` | `project_manager` | `employee` | `viewer` | Description |
|---|:---:|:---:|:---:|:---:|:---:|---|
| `user:create` | ✅ | ❌ | ❌ | ❌ | ❌ | Provision new user accounts and initial profiles |
| `user:read` | ✅ | ✅ | ❌ | ❌ | ❌ | Access user records and administrative profile details |
| `user:update` | ✅ | ✅ | ❌ | ❌ | ❌ | Update profile fields (department, title, shift hours) |
| `user:deactivate` | ✅ | ❌ | ❌ | ❌ | ❌ | Deactivate user accounts and revoke active sessions |
| `user:reactivate` | ✅ | ❌ | ❌ | ❌ | ❌ | Reactivate accounts and clear lockouts |
| `user:resetPassword` | ✅ | ❌ | ❌ | ❌ | ❌ | Issue one-time temporary passwords |
| `user:changeRole` | ✅ | ❌ | ❌ | ❌ | ❌ | Escalate or change user system roles |
| `settings:read` | ✅ | ❌ | ❌ | ❌ | ❌ | View all system setting keys and values |
| `settings:update` | ✅ | ❌ | ❌ | ❌ | ❌ | Mutate system setting keys |
| `auditlog:read` | ✅ | ❌ | ❌ | ❌ | ❌ | Inspect system audit trail |
| `workrole:create` | ✅ | ❌ | ❌ | ❌ | ❌ | Create new work roles in catalogue |
| `workrole:read` | ✅ | ❌ | ❌ | ❌ | ❌ | List full work role catalogue |
| `workrole:update` | ✅ | ❌ | ❌ | ❌ | ❌ | Rename or change work role description |
| `workrole:deactivate` | ✅ | ❌ | ❌ | ❌ | ❌ | Deactivate work roles |
| `workrole:assign` | ✅ | ❌ | ❌ | ❌ | ❌ | Assign work role to employee profile |
| `workrole:remove` | ✅ | ❌ | ❌ | ❌ | ❌ | Remove assigned work role from employee |
| `workrole:readEmployee` | ✅ | ❌ | ❌ | ❌ | ❌ | Read another employee's role assignments |
| `worklog:readOwn` | ✅ | ✅ | ✅ | ✅ | ✅ | Read own daily work logs (by-date, week, month, ID) |
| `worklog:writeOwn` | ✅ | ✅ | ✅ | ✅ | ❌ | Upsert drafts, edit within window, submit own logs |
| `worklog:adminOverride` | ✅ | ❌ | ❌ | ❌ | ❌ | Override any employee's log with audited reason |

---

## 7. API Endpoints Catalog (Step 8b State)

### 7.1. Authentication & Profile Routes (`/api/auth`)
- `POST /api/auth/login`: Authenticate credentials, issue session cookie, check lockouts.
- `POST /api/auth/logout`: Terminate active session and clear cookie.
- `GET /api/auth/me`: Fetch authenticated user profile and permissions.
- `POST /api/auth/change-password`: Self-service password change.
- `GET /api/auth/csrf`: Issue double-submit CSRF cookie and token.

### 7.2. Employee Directory Routes (`/api/employees` and `/api/directory`)
- `GET /api/employees`: Search/filter employee directory with role-based field redaction.
- `GET /api/employees/me`: Fetch own complete profile and assignments.
- `GET /api/employees/:id`: Lookup employee profile (privileged view for admin/HR, public directory view for staff).

### 7.3. Work Roles Routes (`/api/work-roles`)
- `GET /api/work-roles/my-roles`: List active roles assigned to authenticated employee.

### 7.4. Daily Work Log Routes (`/api/work-logs`)
- `GET /api/work-logs/by-date?date=YYYY-MM-DD`: Fetch caller's work log for a single calendar date.
- `GET /api/work-logs/by-week?startDate=YYYY-MM-DD`: Fetch caller's work logs for 7 consecutive days.
- `GET /api/work-logs/by-month?year=YYYY&month=MM`: Fetch caller's work logs for a calendar month.
- `GET /api/work-logs/:id`: Fetch caller's work log by ID (enforces employee ownership, returns 404 on IDOR).
- `POST /api/work-logs`: Create new draft log or update existing draft for a date. Returns 409 if date is already submitted/approved.
- `PATCH /api/work-logs/:id`: Replace entries of a log. Enforces edit window for submitted logs and writes audit log; blocks approved logs.
- `POST /api/work-logs/:id/submit`: Submit draft log via conditional atomic update. Enforces assigned roles and `worklog.mismatchHandling`.

### 7.5. Administrative Work Log Routes (`/api/admin/work-logs`)
- `PATCH /api/admin/work-logs/:id/override`: System admin override with required reason and full audit capture.

### 7.6. Administrative Management Routes (`/api/admin/*`)
- `GET /api/admin/users`: List users and profiles.
- `POST /api/admin/users`: Create user and employee profile concurrently.
- `GET /api/admin/users/:id`: Lookup user details.
- `PATCH /api/admin/users/:id/role`: Change system role.
- `PATCH /api/admin/users/:id/profile`: Update employee profile attributes.
- `PATCH /api/admin/users/:id/deactivate`: Deactivate account and kill sessions.
- `PATCH /api/admin/users/:id/reactivate`: Reactivate account and clear lockout.
- `POST /api/admin/users/:id/reset-password`: Issue temporary password.
- `GET /api/admin/settings`: Read all system settings.
- `PATCH /api/admin/settings/:key`: Update a system setting (audited).
- `GET /api/admin/work-roles`: List work role catalogue.
- `POST /api/admin/work-roles`: Create a new work role.
- `PATCH /api/admin/work-roles/:id`: Edit work role name or description.
- `PATCH /api/admin/work-roles/:id/deactivate`: Deactivate work role.
- `GET /api/admin/work-roles/employees/:id`: List an employee's assigned work roles.
- `POST /api/admin/work-roles/employees/:id/work-roles`: Assign work role to employee.
- `DELETE /api/admin/work-roles/employees/:id/work-roles/:roleId`: Revoke assigned role from employee.

---

## 8. Standard Error Response Contract

All APIs strictly conform to the following standard JSON error response envelope:
```json
{
  "error": "error_code_string",
  "message": "Human-readable description of the condition",
  "details": []
}
```

### Enumeration of Error Codes
- `unauthenticated` (HTTP 401): Session cookie missing, invalid, or expired.
- `forbidden` (HTTP 403): User lacks permission (e.g. non-admin invoking override, viewer writing logs).
- `not_found` (HTTP 404): Resource does not exist, or IDOR attempt to access another user's log.
- `profile_not_found` (HTTP 404): Authenticated user has no `EmployeeProfile` record.
- `validation_error` (HTTP 400): Schema validation failure (bad date format, step != 0.25h, hours > 24, missing override reason).
- `unassigned_work_role` (HTTP 400): Entry references a work role not currently assigned to the employee.
- `invalid_work_role` (HTTP 400): Entry references a non-existent or deactivated work role.
- `empty_work_log` (HTTP 400): Attempting to submit a log with no entries or 0 total hours.
- `already_submitted` (HTTP 400): Attempting to re-submit an already submitted or approved log.
- `edit_window_expired` (HTTP 403): Employee attempting to edit a submitted log after `worklog.editWindowHours` elapsed.
- `log_already_approved` (HTTP 403): Employee attempting to edit a log that has already been approved.
- `hour_mismatch` (HTTP 422): Submission blocked because total hours != standard shift hours under `block` mode.
- `status_conflict` (HTTP 409): Attempting to create a draft for a date that is already submitted or approved.
- `day_already_exists` (HTTP 409): Unique constraint collision (`[employeeProfileId, date]`).
- `conflict` (HTTP 409): Duplicate username, employee code, or duplicate role assignment.
- `csrf_invalid` (HTTP 403): Missing or mismatched CSRF token on mutating requests.

---

## 9. Quality Assurance, Test Evolution & Verification

### Test Count Progression
- **Step 5 Baseline**: 64 tests (auth, security, session fixation, CSRF).
- **Step 6 Baseline**: 114 tests (+work roles, catalogue CRUD, assignments).
- **Step 7 Baseline**: 134 tests (+user admin, profile editing, directory redaction).
- **Step 8a Baseline**: 140 tests (+availability and status models).
- **Step 8b Final**: **180 tests passing across 6 test suites** (+35 work log tests, +5 permission matrix tests).

### Test Suite Distribution
1. `src/__tests__/security.test.ts`: **51 tests** (session management, lockout thresholds, CSRF enforcement, rate limiters, constant-time hashing).
2. `src/__tests__/workRoles.test.ts`: **40 tests** (work role CRUD, assignment conflicts, deactivations, RBAC guards).
3. `src/__tests__/workLogs.test.ts`: **35 tests** (upsert draft, submit, edit window checks, audit logging, hour mismatch policies, IDOR isolation, 0.25h increments, admin overrides).
4. `src/__tests__/usersAdmin.test.ts`: **25 tests** (user provisioning, profile editing, role escalation prevention, password resets).
5. `src/__tests__/permissions.test.ts`: **16 tests** (complete policy matrix across all system roles for all defined actions).
6. `src/__tests__/auth.test.ts`: **13 tests** (login, logout, session touch, password change, force password change guards).

### Mock Limitations & Testing Caveats
Unit and integration tests run in Vitest using an in-memory mocked Prisma client (`setup.ts`). While providing rapid, deterministic test execution (4.87s full suite run):
- Real PostgreSQL concurrent transaction isolation (MVCC) and live multi-threaded race conditions must be validated against a live PostgreSQL database in staging.
- Database-level cascade deletes and constraints are verified via Prisma schema validation rather than physical database foreign key checks during unit test execution.

---

## 10. Open Policy Questions & Upstream Considerations

Documented in `docs/open-policy-questions.md`:
1. **Approval Workflow Execution (Phase 8d)**: Submitted logs currently remain in `submitted` status. Dedicated approval/rejection endpoints will be introduced in Step 8d.
2. **Work Log Timezone & Date Bounds**: Computed against `Asia/Kathmandu` (UTC+05:45) with `MAX_FUTURE_DAYS = 1` and `MAX_PAST_DAYS = 90`.
3. **Overtime Flow Integration**: Overtime stub `handleOvertimeFlow` is positioned to route excess hours (> `standardShiftHours`) to an overtime request pipeline.
4. **Leave Integration**: Leave stub `checkApprovedLeave` is positioned to cross-reference approved leave requests to exempt employees from mandatory work log entries.

---

## 11. Next Milestone: Step 8c & Beyond

- **Step 8c**: Excel Work Log Export engine (generating formatted work log spreadsheets for payroll and operational reporting).
- **Step 8d**: Manager and Administrator Work Log Approval workflows (bulk approve, reject with reason).
- **Step 8e**: Frontend Daily Work Log interface (interactive calendar view, entry form, draft autosave, submission alerts, and warning displays).


---

## 12. Task Execution Log (Step 8c onwards)

### Task 8c-01: Step 8c Planning & Requirements Inspection
- **Date**: 2026-10-27
- **Day of week**: Tuesday
- **Start time**: 13:48
- **End time**: 13:51
- **Step**: Step 8c (Daily Work Log Excel Export with ExcelJS)
- **Task performed**: Read `docs/PROGRESS.md`, `docs/open-policy-questions.md`, and `imac-antigravity-prompt.md` (Part A Master Brief). Inspected existing route structures, middleware, permission models, and package dependencies. Formulated implementation plan for Excel export, RBAC scoping, ExcelJS integration, formula injection mitigation, and audit tracking.
- **Files created or changed**: `finalreport.md` (appended task log)
- **Tests run with pass counts**: Baseline verified at 180 passed across 6 test suites (`permissions`: 16, `auth`: 13, `usersAdmin`: 25, `workRoles`: 40, `workLogs`: 35, `security`: 51)
- **Status**: done
- **Decisions or problems**:
  - Employee, HR Admin, Project Manager access will be strictly scoped to their own logs. If an employee, team, or project filter pointing to another employee is passed by a non-system_admin, it will be refused with **HTTP 403 Forbidden** (`forbidden: 'You are only permitted to export your own work logs'`).
  - System Admin can export organization-wide with optional filters (`employee`, `team`/department, `workRoleId`, `projectId`, `startDate`, `endDate`, `status`).
  - Viewer role is refused with **HTTP 403 Forbidden**.
  - Formula injection mitigation: Any string starting with `=`, `+`, `-`, or `@` will be sanitized/escaped by prepending a single quote (`'`).
  - Row cap: 50,000 rows max; returns HTTP 400 (`row_limit_exceeded`) if the bounded query finds more than 50,000 entries.
  - Organization-wide export by `hr_admin` is treated as an open policy question (defaulting to NO/own-only) and will be documented in `docs/open-policy-questions.md`.

### Task 8c-02: Installing ExcelJS Dependency
- **Date**: 2026-10-27
- **Day of week**: Tuesday
- **Start time**: 13:53
- **End time**: 13:54
- **Step**: Step 8c (Daily Work Log Excel Export)
- **Task performed**: Install production dependency `exceljs` in `apps/api` (without `@types/exceljs`).
- **Files created or changed**: `apps/api/package.json`
- **Tests run with pass counts**: N/A
- **Status**: done
- **Decisions or problems**: Per amendment 2, installed only `exceljs` as it ships with native TypeScript declaration files.

### Task 8c-03: Implementation of Work Log Export Engine & Tests
- **Date**: 2026-10-27
- **Day of week**: Tuesday
- **Start time**: 13:55
- **End time**: 14:04
- **Step**: Step 8c (Daily Work Log Excel Export with ExcelJS)
- **Task performed**:
  - Implemented `workLogExportQuerySchema` in `packages/shared/src/schemas/workLog.ts` and compiled `@imac/shared`.
  - Added permissions `worklog:exportOwn` and `worklog:exportAll` to `apps/api/src/lib/permissions.ts`.
  - Built `apps/api/src/services/workLogExport.ts` featuring ExcelJS workbook creation, Summary and Entries sheets, Asia/Kathmandu title block, `#,#0.00` numeric formatting, real UTC Excel dates, formula injection defense on all text cells, and empty hook for project manager membership.
  - Implemented `GET /api/work-logs/export` route before `/:id` in `apps/api/src/routes/workLogs.ts`, enforcing count-based 50k row capping, pre-send audit log generation, and security headers (`Cache-Control: no-store`, `X-Content-Type-Options: nosniff`).
  - Added tests in `apps/api/src/__tests__/permissions.test.ts` and created `apps/api/src/__tests__/workLogExport.test.ts`.
- **Files created or changed**:
  - `packages/shared/src/schemas/workLog.ts`
  - `apps/api/src/lib/permissions.ts`
  - `apps/api/src/services/workLogExport.ts`
  - `apps/api/src/routes/workLogs.ts`
  - `apps/api/src/__tests__/setup.ts`
  - `apps/api/src/__tests__/permissions.test.ts`
  - `apps/api/src/__tests__/workLogExport.test.ts`
  - `docs/open-policy-questions.md`
  - `docs/PROGRESS.md`
- **Tests run with pass counts**: Vitest: 7 test files passed, 205 tests passed (180 previous + 25 new Step 8c tests).
- **Status**: done
- **Decisions or problems**: Confirmed `AuditLog.entityId` is nullable in schema, enabling clean null entity logging for export actions.

### Task 8c-04: Code Quality Verification (Lint, Typecheck & Test Suite Re-verification)
- **Date**: 2026-10-27
- **Day of week**: Tuesday
- **Start time**: 14:04
- **End time**: 14:08
- **Step**: Step 8c (Daily Work Log Excel Export)
- **Task performed**:
  - Ran `npm run typecheck` across all workspaces (`@imac/api`, `@imac/web`, `@imac/shared`). Identified TypeScript error TS2322 in `apps/api/src/routes/workLogs.ts` (`beforeSnapshot: null` invalid for Prisma JSON input). Corrected by omitting `beforeSnapshot` when no prior record exists.
  - Ran `npm run lint` across workspaces (0 errors).
  - Executed complete test suite via `npm test` to verify all 7 test files and 205 unit/integration tests pass cleanly.
- **Files created or changed**:
  - `apps/api/src/routes/workLogs.ts`
  - `finalreport.md`
- **Tests run with pass counts**:
  - `npm run typecheck`: Passed (0 errors across `@imac/api`, `@imac/web`, `@imac/shared`).
  - `npm run lint`: Passed (0 errors).
  - `npm test`: 7 test files passed, 205 tests passed (0 failures).
- **Status**: done
- **Decisions or problems**: Omitted `beforeSnapshot` in audit log creation for export operations so Prisma cleanly handles it as undefined/null without type casting.

---

## Step 8c Summary & Verification
- **Status**: Completed
- **Tasks Executed**:
  1. Task 8c-01: Research & Planning for Step 8c (ExcelJS Export Subsystem).
  2. Task 8c-02: Installing ExcelJS Dependency (`exceljs` in `apps/api`).
  3. Task 8c-03: Implementation of Work Log Export Engine & Tests (shared schemas, permission actions, export service, export route before `/:id`, security headers, 20 export tests).
  4. Task 8c-04: Code Quality Verification (typecheck fix for Prisma null snapshot, lint, and full test run).
- **Files Created / Modified**:
  - `apps/api/package.json`
  - `packages/shared/src/schemas/workLog.ts`
  - `apps/api/src/lib/permissions.ts`
  - `apps/api/src/services/workLogExport.ts`
  - `apps/api/src/routes/workLogs.ts`
  - `apps/api/src/__tests__/setup.ts`
  - `apps/api/src/__tests__/permissions.test.ts`
  - `apps/api/src/__tests__/workLogExport.test.ts`
  - `docs/open-policy-questions.md`
  - `docs/PROGRESS.md`
  - `finalreport.md`
- **Test Suite Results**:
  - **Before Step 8c**: 180 tests passing (6 test suites).
  - **After Step 8c**: 205 tests passing (7 test suites, +25 new tests: 20 export tests + 5 permission matrix tests).
- **Unverified Items**:
  - Integration tests run against Vitest mocked database. Full streaming behavior under multi-gigabyte production workloads and live OS socket throughput remain to be tested in live environment.

---

## Step 8d: Review Fixes for Steps 8b and 8c

### Task 8d-01: Implementation of Review Fixes & Tests
- **Date**: 2026-10-27
- **Day of week**: Tuesday
- **Start time**: 14:31
- **End time**: 15:03
- **Step**: Step 8d (Review Fixes for Steps 8b and 8c)
- **Task performed**:
  - Item 1: Applied `worklog.mismatchHandling` on PATCH /api/work-logs/:id for submitted logs (block -> 422 hour_mismatch with nothing saved and no audit log; warn -> 200 with warnings entry; allow -> 200). Drafts unaffected, admin override exempt. Added 5 tests.
  - Item 2: Added optimistic lock to submit route requiring `updatedAt` equal to value read (0 rows -> 409 conflict_retry, keeping 400 already_submitted for non-drafts); in POST /api/work-logs, conditional update on `status = 'draft'` (0 rows -> 409 status_conflict). Added 3 tests.
  - Item 3: Replaced `isQuarterHourIncrement` precision with `Math.abs(val*4 - Math.round(val*4)) < 1e-9`. Added unit tests (0.25, 1.5, 24 accepted; 0.254, 1.251, 0.3, 2.1 rejected) and API validation test.
  - Item 4: Replaced `user: true` in export query with explicit field selection (`id`, `displayName`, `username`), never loading `passwordHash`. Added assertion test.
  - Item 5: Restored deleted explanatory comments in `apps/api/src/app.ts` (SEC-01 notes, CSRF login rationale, CSRF endpoint exemption).
  - Item 6: Replaced non-ASCII / garbled characters in `apps/api/src/services/workLogExport.ts` with plain ASCII. Added test verifying Summary title is pure ASCII.
  - Item 7: Wrote "Submitted At" as real Date cell with numFmt `yyyy-mm-dd hh:mm`, stated timezone in Summary title block, removed 7-row freeze on Summary sheet. Added tests for cell types and sheet views.
  - Item 8: Added rate limiter to GET /api/work-logs/export (15 requests per 15 min per IP), following existing limiter pattern. Documented limits in `PROGRESS.md`. Added rate limiter test.
  - Item 9: Documented in `docs/PROGRESS.md`: rejected-log handling is incomplete until approvals exist, edit audit snapshots contain descriptions, and stated what mock-based tests cannot prove.
- **Files created or changed**:
  - `packages/shared/src/schemas/workLog.ts`
  - `apps/api/src/routes/workLogs.ts`
  - `apps/api/src/services/workLogExport.ts`
  - `apps/api/src/app.ts`
  - `apps/api/src/__tests__/workLogs.test.ts`
  - `apps/api/src/__tests__/workLogExport.test.ts`
  - `docs/PROGRESS.md`
  - `finalreport.md`
- **Tests run with pass counts**:
  - `npm run typecheck`: Passed (0 errors across `@imac/api`, `@imac/web`, `@imac/shared`).
  - `npm run lint`: Passed (0 errors).
  - `npm test`: 7 test files passed, 217 tests passed (0 failures; 205 prior + 12 new Step 8d tests).
- **Status**: done
- **Decisions or problems**: Identified admin override test route is `/api/admin/work-logs/:id/override`; updated test accordingly.

---

## Step 8d Summary & Verification
- **Status**: Completed
- **Tasks Executed**:
  1. Task 8d-01: Implementation and Verification of all 9 review fixes for steps 8b and 8c.
- **Files Created / Modified**:
  - `packages/shared/src/schemas/workLog.ts`
  - `apps/api/src/routes/workLogs.ts`
  - `apps/api/src/services/workLogExport.ts`
  - `apps/api/src/app.ts`
  - `apps/api/src/__tests__/workLogs.test.ts`
  - `apps/api/src/__tests__/workLogExport.test.ts`
  - `docs/PROGRESS.md`
  - `finalreport.md`
- **Test Suite Results**:
  - **Before Step 8d**: 205 tests passing (7 test suites).
  - **After Step 8d**: 217 tests passing (7 test suites, +12 new tests: 10 in `workLogs.test.ts` + 2 in `workLogExport.test.ts`).
- **Mock Limitations & What Tests Cannot Prove**:
  - Integration tests run against an in-memory mocked database (`setup.ts`).
  - Mocks verify business logic, branching, schema parsing, ExcelJS cell formatting, formula neutralization, and error handling.
  - Mocks CANNOT prove real PostgreSQL transaction isolation behavior (e.g. concurrent serialization conflicts), OS thread lock contention, or live Redis/memory rate limiting under multi-instance reverse proxies.


---

## Step 9a: Daily Work Log Screens in apps/web

### Task 9a-01: Implementation of Work Log Screens, Navigation & Settings
- **Date**: 2026-10-28
- **Day of week**: Wednesday
- **Start time**: 08:31:00
- **End time**: 08:48:12
- **Step**: Step 9a (Daily Work Log SCREENS in apps/web)
- **Task performed**:
  - Implemented Daily Log screen (`DailyWorkLogPage.tsx`) for logged-in users with date picker (Asia/Kathmandu today default, YYYY-MM-DD strings), entry rows with active assigned roles from `/api/work-roles/my-roles`, hours (0.25 steps), optional description and reserved project/task fields, live running total vs standard shift hours with difference display, in-flight disabled buttons for save draft and submit, server warnings array display, friendly error code handling (validation_error, unassigned_work_role, hour_mismatch 422, status_conflict 409, conflict_retry 409, already_submitted, edit_window_expired, log_already_approved, profile_not_found, row_limit_exceeded, never showing raw JSON), status badges (draft, submitted, approved, rejected), submitted log edit via PATCH with edit_window_expired notice, friendly "no employee profile" card, and viewer read-only mode.
  - Implemented History & Summaries screen (`WorkLogHistoryPage.tsx`) with Month Calendar View and List View of past days using `/api/work-logs/by-month`, click-to-open day navigation to Daily Log, monthly totals per role/day/overall, and 7-day weekly summaries from `/api/work-logs/by-week`.
  - Implemented Export screen (`WorkLogExportPage.tsx`) with required start/end date filters (366-day limit check), status, work role, system_admin-only employee and team filters, direct .xlsx binary download from `/api/work-logs/export`, and friendly handling for 403, 400 row limit, and 429 rate limit.
  - Implemented Admin Settings screen (`WorkLogSettingsPage.tsx`) restricted to system_admin for `worklog.requiresApproval`, `worklog.mismatchHandling` (block/warn/allow), and `worklog.editWindowHours` (positive integer validation) via `/api/admin/settings` with success/error alerts.
  - Updated navigation layouts (`AdminLayout.tsx`, `EmployeeLayout.tsx`) adding Daily Log, History, and Export sidebar links for permitted roles; hid Settings from non-admins in sidebar; protected `/admin/settings` route with `allowedRoles={['system_admin']}` showing UnauthorizedPage (403) on direct access.
  - Maintained zero backend changes and zero schema changes.
- **Files created or changed**:
  - `apps/web/src/pages/workLogs/DailyWorkLogPage.tsx`
  - `apps/web/src/pages/workLogs/WorkLogHistoryPage.tsx`
  - `apps/web/src/pages/workLogs/WorkLogExportPage.tsx`
  - `apps/web/src/pages/admin/WorkLogSettingsPage.tsx`
  - `apps/web/src/components/common/WorkLogStatusBadge.tsx`
  - `apps/web/src/components/layout/AdminLayout.tsx`
  - `apps/web/src/components/layout/EmployeeLayout.tsx`
  - `apps/web/src/router/index.tsx`
  - `docs/PROGRESS.md`
  - `finalreport.md`
- **Tests run with pass counts**:
  - `npm run typecheck`: Passed (0 errors across `@imac/api`, `@imac/web`, `@imac/shared`).
  - `npm run lint`: Passed (0 errors).
  - `npm run build --workspace=apps/web`: Passed (Vite production build completed in 19.78s).
  - `npm test`: 7 test files passed, 217 tests passed (0 failures).
- **Status**: done
- **Decisions or problems**:
  - Identified that Axios responseType blob wraps JSON error payloads in a Blob object on HTTP error status; implemented async `blob.text()` parsing in `WorkLogExportPage` to accurately detect `row_limit_exceeded` and `too_many_requests` error codes.

---

## Step 9a Summary & Verification
- **Status**: Completed
- **Tasks Executed**:
  1. Task 9a-01: Implementation and verification of all Daily Work Log frontend screens, calendar history, summary metrics, export dialog, admin policy settings, and role-based layout navigation.
- **Files Created / Modified**:
  - `apps/web/src/pages/workLogs/DailyWorkLogPage.tsx`
  - `apps/web/src/pages/workLogs/WorkLogHistoryPage.tsx`
  - `apps/web/src/pages/workLogs/WorkLogExportPage.tsx`
  - `apps/web/src/pages/admin/WorkLogSettingsPage.tsx`
  - `apps/web/src/components/common/WorkLogStatusBadge.tsx`
  - `apps/web/src/components/layout/AdminLayout.tsx`
  - `apps/web/src/components/layout/EmployeeLayout.tsx`
  - `apps/web/src/router/index.tsx`
  - `docs/PROGRESS.md`
  - `finalreport.md`
- **Test Suite Results**:
  - `npm run typecheck`: 0 errors.
  - `npm run lint`: 0 errors.
  - `npm test`: 217 passing tests (7 test suites).
  - `npm run build --workspace=apps/web`: 0 errors.


---

## Step 10a: Projects Data Layer (Models and Migration)

### Task 10a-01: Implementation of Projects Subsystem Models, Mocks, and Policy Questions
- **Date**: 2026-10-28
- **Day of week**: Wednesday
- **Start time**: 10:07:50
- **End time**: 10:36:34
- **Step**: Step 10a (Projects data layer. Models and migration ONLY)
- **Task performed**:
  - Added new models to `apps/api/prisma/schema.prisma`:
    - Enums: `ProjectStatus` (`on_track`, `at_risk`, `off_track`, `on_hold`, `complete`), `ProjectRole` (`manager`, `member`, `viewer`), `TaskStatus` (`todo`, `in_progress`, `blocked`, `done`).
    - `Project`: `id`, `name`, `description?`, `status` (`default(on_track)`), `startDate?` (`@db.Date`), `targetDate?` (`@db.Date`), `createdByUserId`, `createdAt`, `updatedAt`, indexed on `createdByUserId`.
    - `ProjectMember`: `id`, `projectId`, `userId`, `projectRole`, `addedByUserId`, `createdAt`, `@@unique([projectId, userId])`, indexed on `projectId` and `userId`.
    - `ProjectStatusEvent`: `id`, `projectId`, `fromStatus`, `toStatus`, `reason`, `changedByUserId`, `createdAt`, indexed on `projectId`.
    - `Milestone`: `id`, `projectId`, `name`, `dueDate?` (`@db.Date`), `completedAt?`, `createdAt`, indexed on `projectId`.
    - `Task`: `id`, `projectId`, `parentTaskId?` (one-level subtask relation), `title`, `description?`, `status` (`default(todo)`), `assigneeUserId?`, `dueDate?` (`@db.Date`), `estimatedHours?`, `milestoneId?`, `createdByUserId`, `createdAt`, `updatedAt`, indexed on `projectId`, `parentTaskId`, `assigneeUserId`, `milestoneId`.
    - `TaskDependency`: `id`, `taskId`, `dependsOnTaskId`, `@@unique([taskId, dependsOnTaskId])`, indexed on `taskId` and `dependsOnTaskId`.
    - `Comment`: `id`, `taskId`, `authorUserId`, `body`, `createdAt`, `updatedAt`, indexed on `taskId` and `authorUserId`.
    - `ProjectMessage`: `id`, `projectId`, `authorUserId`, `body`, `isPinned` (`default(false)`), `createdAt`, indexed on `projectId` and `authorUserId`.
    - `TimeLog`: `id`, `taskId?`, `projectId`, `userId`, `workDate` (`@db.Date`), `hours`, `note?`, `createdAt`, indexed on `(userId, workDate)`, `projectId`, and `taskId`.
    - Maintained cascade deletes only where a child cannot exist without its parent (`Project` to child entities and `Task` to comments/dependencies/subtasks).
    - Preserved `WorkLogEntry.projectId` and `taskId` as plain nullable strings without foreign keys.
  - Executed migration checks using `npx prisma migrate dev --name projects_models`. Prisma devDiagnostic detected that migration `20261014065852_drift_check` exists in `_prisma_migrations` but is missing from local migrations directory, and triggered a database reset check (`action: { tag: 'reset' }`). In strict compliance with prompt instructions (*"IMPORTANT: if Prisma ever asks to reset the database or says data will be lost, answer NO, stop, and report it. Never reset"*), reset was refused, migration execution stopped, and the reset request is reported.
  - Regenerated Prisma Client (`npx prisma generate`) and validated schema (`npx prisma validate`).
  - Added complete test mocks for all 9 new tables in `apps/api/src/__tests__/setup.ts` (`project`, `projectMember`, `projectStatusEvent`, `milestone`, `task`, `taskDependency`, `comment`, `projectMessage`, `timeLog`).
  - Added 4 open policy questions to `docs/open-policy-questions.md`: project creation authority, project visibility scoping (`hr_admin` default NO), task time log derivation vs daily work logs, and task "blocked" status invariants.
- **Files created or changed**:
  - `apps/api/prisma/schema.prisma`
  - `apps/api/src/__tests__/setup.ts`
  - `docs/open-policy-questions.md`
  - `docs/PROGRESS.md`
  - `finalreport.md`
- **Tests run with pass counts**:
  - `npx prisma validate`: Schema is valid (0 errors).
  - `npm run typecheck`: Passed (0 errors across `@imac/api`, `@imac/web`, `@imac/shared`).
  - `npm run lint`: Passed (0 errors).
  - `npm test`: 7 test files passed, 217 tests passed (0 failures).
- **Status**: stopped_and_reported (database reset requested by Prisma was rejected in compliance with instructions; all other models, schema validations, mocks, policy questions, and test suites completed)
- **Decisions or problems**:
  - Identified database migration discrepancy: `_prisma_migrations` table contains `20261014065852_drift_check` which is missing from the local `migrations` directory. In compliance with the rule "if Prisma ever asks to reset the database or says data will be lost, answer NO, stop, and report it. Never reset", stopped migration and reported findings to user.

---

## Step 10a Summary & Verification
- **Status**: Completed (Schema, Mocks, Policy Questions, Validations & Tests Verified; Migration Reset Refused & Reported)
- **Tasks Executed**:
  1. Task 10a-01: Added Projects data layer models, enums, cascades, and indexes to `schema.prisma`. Updated `setup.ts` mocks. Documented policy questions 12-15 in `open-policy-questions.md`. Refused Prisma database reset and reported missing migration drift. Verified typecheck, lint, schema validation, and test suite.
- **Files Created / Modified**:
  - `apps/api/prisma/schema.prisma`
  - `apps/api/src/__tests__/setup.ts`
  - `docs/open-policy-questions.md`
  - `docs/PROGRESS.md`
  - `finalreport.md`
- **Test Suite Results**:
  - `npx prisma validate`: Schema is valid.
  - `npm run typecheck`: 0 errors.
  - `npm run lint`: 0 errors.
  - `npm test`: 217 passing tests (7 test suites).


---

## Step 10b: Projects, Members, and Status APIs (Backend Only)

### Task 10b-01: Projects Router, Member Management, Status Lifecycle, Permissions & Integration Tests
- **Date**: 2026-10-28
- **Day of week**: Wednesday
- **Start time**: 13:05:00
- **End time**: 13:22:50
- **Step**: Step 10b (Projects, members and status APIs. Backend only)
- **Task performed**:
  - Verified precondition 0: ran `npx prisma migrate status` ensuring PostgreSQL schema is clean and all 5 migrations (including `20261028103000_projects_models`) are applied without resets.
  - Implemented shared Zod validation schemas and types in `packages/shared/src/schemas/project.ts` (`createProjectSchema`, `patchProjectSchema`, `addProjectMemberSchema`, `changeProjectStatusSchema`, `listProjectsQuerySchema`) and exported in `packages/shared/src/index.ts`. Built package cleanly.
  - Updated permissions in `apps/api/src/lib/permissions.ts` with actions `project:create`, `project:read`, `project:update`, `project:manageMembers`, and `project:changeStatus`, including architectural comments on handler-level scoping for non-admins.
  - Added `mockDb.$queryRaw` mock to `apps/api/src/__tests__/setup.ts`.
  - Created `apps/api/src/routes/projects.ts` implementing all 7 endpoints with uniform 4-step check order:
    1. Permission check via `can(user, action)` (403 for viewers on write actions).
    2. UUID parameter validation on `:id` and `:userId` (uniform 404, preventing unhandled Prisma 500 errors).
    3. Project existence and membership lookup: non-members receive 404 (not 403, preventing IDOR project enumeration); `system_admin` bypasses membership.
    4. Project manager role check: non-admins must hold `projectRole: 'manager'` on the project (403).
  - Enforced project row locking (`SELECT "id" FROM "Project" WHERE "id" = $1 FOR UPDATE`) and re-reading target member inside transaction on member deletion.
  - Enforced last-active-manager invariant: counting only managers whose user `isActive === true`, refusing removal of the last active manager with 409 `last_manager_required`.
  - Enforced viewer assignment guard: rejecting users with system role `viewer` from being assigned as `manager` or `member` with 400 `viewer_cannot_be_member_writer`.
  - Enforced atomic status transition: using `updateMany` with `{ id, status: fromStatus }` returning 409 `conflict_retry` on 0 rows updated, and writing `ProjectStatusEvent` and `AuditLog` in one atomic transaction.
  - Enforced cursor pagination on `GET /api/projects`: order by `createdAt: desc, id: desc`, returning `items`, `nextCursor`, and `hasMore`.
  - Mounted router in `apps/api/src/app.ts` under `csrfMiddleware`.
  - Documented open policy questions 16-21 in `docs/open-policy-questions.md`.
  - Updated implementation progress in `docs/PROGRESS.md`.
  - Authored comprehensive integration test suite with 48 tests in `apps/api/src/__tests__/projects.test.ts` and 5 new unit tests in `apps/api/src/__tests__/permissions.test.ts`.
- **Files created or changed**:
  - `packages/shared/src/schemas/project.ts`
  - `packages/shared/src/index.ts`
  - `apps/api/src/lib/permissions.ts`
  - `apps/api/src/__tests__/setup.ts`
  - `apps/api/src/routes/projects.ts`
  - `apps/api/src/app.ts`
  - `apps/api/src/__tests__/permissions.test.ts`
  - `apps/api/src/__tests__/projects.test.ts`
  - `docs/open-policy-questions.md`
  - `docs/PROGRESS.md`
  - `finalreport.md`
- **Tests run with pass counts**:
  - `npm run typecheck`: Passed (0 errors across `@imac/api`, `@imac/web`, `@imac/shared`).
  - `npm run lint`: Passed (0 errors across all workspaces).
  - `npm test`: 8 test files passed, 270 tests passed (0 failures).
- **Status**: done
- **Decisions or problems**:
  - Implemented row-level locking (`SELECT "id" FROM "Project" WHERE "id" = $1 FOR UPDATE`) inside member removal transaction to eliminate race conditions in last-manager check.
  - Used `updateMany` with `{ id, status: currentStatus }` checking for 0 affected rows to return 409 `conflict_retry` against concurrent status transitions.
  - Enforced viewer restriction rejecting assignment of users with system role `viewer` as project `manager` or `member` (400 `viewer_cannot_be_member_writer`).
  - Documented mock limitations in test header: Vitest mocks Prisma calls with stubbed `$transaction` and `$queryRaw`, which cannot prove real PostgreSQL row-level lock concurrency behavior or transactional rollbacks on database crashes.

---

## Step 10b Summary & Verification
- **Status**: Completed
- **Tasks Executed**:
  1. Task 10b-01: Projects router, member management, status lifecycle, permissions, strict check order, row-level locking, cursor pagination, policy questions 16-21, and 48 integration tests.
- **Files Created / Modified**:
  - `packages/shared/src/schemas/project.ts`
  - `packages/shared/src/index.ts`
  - `apps/api/src/lib/permissions.ts`
  - `apps/api/src/__tests__/setup.ts`
  - `apps/api/src/routes/projects.ts`
  - `apps/api/src/app.ts`
  - `apps/api/src/__tests__/permissions.test.ts`
  - `apps/api/src/__tests__/projects.test.ts`
  - `docs/open-policy-questions.md`
  - `docs/PROGRESS.md`
  - `finalreport.md`
- **Test Suite Results**:
  - `npm run typecheck`: 0 errors.
  - `npm run lint`: 0 errors.
  - `npm test`: 270 passing tests (8 test suites, 0 failures).


---

## Step 10c: Tasks, Subtasks, Assignment, Milestones, Dependencies and Comments (Backend Only)

### Task 10c-01: Tasks & Milestones Data Layer, Routers, Permissions, Invariants & Comprehensive Tests
- **Date**: 2026-10-28
- **Day of week**: Wednesday
- **Start time**: 13:46:00
- **End time**: 14:38:00
- **Step**: Step 10c (Tasks, subtasks, assignment, milestones, dependencies and comments. Backend only)
- **Task performed**:
  - Validated Task 0: confirmed existing tests for member list privacy (no passwordHash, no systemRole for non-admins) and invalid cursor rejection (400 validation error) are present and passing in `apps/api/src/__tests__/projects.test.ts`.
  - Refactored `apps/api/src/routes/projects.ts` to import `isValidUuid` from `services/projectAccess.ts` and removed duplicate local helper. Noted that `projects.ts` inline membership lookup is deferred to future refactoring.
  - Added shared Zod validation schemas in `packages/shared/src/schemas/task.ts` and exported in `packages/shared/src/index.ts` with strict schema validation.
  - Added permissions actions `task:read`, `task:write`, `comment:write`, `milestone:manage` to `apps/api/src/lib/permissions.ts` with architectural comments and updated `permissions.test.ts`.
  - Implemented separate modular routers `apps/api/src/routes/tasks.ts` and `apps/api/src/routes/milestones.ts` with `Router({ mergeParams: true })` and mounted them under `/api/projects/:id`.
  - Enforced all invariants and exact error codes:
    - Self-dependency rejected with 400 `self_dependency`.
    - Dependency cycles and depth >= 50 rejected with 400 `dependency_cycle` (using project row locking `FOR UPDATE` and visited set).
    - Duplicate dependency rejected with 409 `duplicate_dependency`.
    - Milestone double completion rejected with 409 `already_completed`.
    - Milestone double reopen rejected with 409 `already_open`.
    - One-level subtask nesting rule enforced.
    - Departed assignee preserved on PATCH with `assigneeIsProjectMember: false`.
    - Invalid status values `in_review` and `canceled` rejected with 400 on status route and list query filter.
    - Viewers (both project viewer and system viewer) rejected with 403 on all mutating operations including comment edit.
    - Comment editing strictly author-only; audit log records `comment.edited` without comment body.
    - All audit snapshots omit task descriptions and comment bodies.
  - Updated `docs/open-policy-questions.md` with Questions 22-27.
  - Updated `docs/PROGRESS.md` with Step 10c deliverables, test results, mock limitations, and next steps.
  - Expanded comprehensive integration test suite in `apps/api/src/__tests__/tasks.test.ts` from 31 to 73 tests covering all negative security boundaries.
- **Files created or changed**:
  - `packages/shared/src/schemas/task.ts` (created)
  - `packages/shared/src/schemas/index.ts` (modified)
  - `packages/shared/src/index.ts` (modified)
  - `apps/api/src/services/projectAccess.ts` (created)
  - `apps/api/src/routes/projects.ts` (modified)
  - `apps/api/src/routes/tasks.ts` (created)
  - `apps/api/src/routes/milestones.ts` (created)
  - `apps/api/src/lib/permissions.ts` (modified)
  - `apps/api/src/__tests__/permissions.test.ts` (modified)
  - `apps/api/src/__tests__/tasks.test.ts` (created)
  - `docs/open-policy-questions.md` (modified)
  - `docs/PROGRESS.md` (modified)
  - `finalreport.md` (modified)
- **Tests run with pass counts**:
  - `npm run test`: 9 test suites passed, 343 total tests passed (0 failures):
    - `src/__tests__/tasks.test.ts` (73 tests passed)
    - `src/__tests__/projects.test.ts` (48 tests passed)
    - `src/__tests__/permissions.test.ts` (26 tests passed)
    - `src/__tests__/auth.test.ts` (13 tests passed)
    - `src/__tests__/security.test.ts` (51 tests passed)
    - `src/__tests__/workRoles.test.ts` (40 tests passed)
    - `src/__tests__/usersAdmin.test.ts` (25 tests passed)
    - `src/__tests__/workLogs.test.ts` (45 tests passed)
    - `src/__tests__/workLogExport.test.ts` (22 tests passed)
  - `npm run typecheck`: clean across all workspaces (`@imac/api`, `@imac/web`, `@imac/shared`, 0 errors).
  - `npm run lint`: clean across all workspaces (0 errors).
- **Status**: done
- **Decisions or problems**:
  - Resolved TypeScript error in `tasks.test.ts` by asserting mock parameter typing on `db.projectMember.findUnique as any`, `db.task.findUnique as any`, `db.task.update as any`, and `db.taskDependency.findMany as any`.
  - Synchronized fake timers with session generation in overdue task test to avoid session token expiration.
  - Implemented explicit viewer guard on comment editing (`PATCH /:taskId/comments/:commentId`) to prevent project viewers and system viewers from modifying comments.
  - Standardized exact error codes: `self_dependency`, `dependency_cycle` (for cycles & depth limit), `duplicate_dependency`, `already_completed`, and `already_open`.
  - Departed assignee retention: tasks preserve `assigneeUserId` with serialized `assigneeIsProjectMember: false`, and unchanged assignee during title/description PATCH does not trigger 400.

## Step 10c Summary & Verification
- **Milestone**: Step 10c — Tasks, subtasks, assignment, milestones, dependencies and comments (Backend only).
- **Schema & Migrations**: Zero schema alterations; no migrations executed.
- **Verification**: 343 passing tests across 9 test suites, clean typecheck, clean linting across entire monorepo.
- **Git Commit**: Not executed (per instruction). Ready for user commit.


---

## 13. Step 10d: Time Logs, Project Progress, Workload Queries & Access Hardening (Backend Only)

### Task 10d-01: Time Logs API, Progress Calculation, Workload/Summary Queries, Access Hardening & Route Inventory
- **Date**: 2026-10-28
- **Day of week**: Wednesday
- **Start time**: 15:51:00
- **End time**: 16:50:00
- **Step**: Step 10d (Time logs, progress, workload queries and access fixes. Backend only)
- **Task performed**:
  - Access Hardening: Strongly typed `ProjectAccessResult` using Prisma models (`Project` and `ProjectMember | null`); enforced fail-closed logic in `canEditTask` (failing closed when `userId` is missing or whitespace-only, when `task` is missing on member branches, and preventing `undefined === undefined` coercion).
  - Central Permissions: Added `timeLog:read` and `timeLog:write` actions with architectural notes clarifying handler-level membership requirements.
  - Shared Validation: Built `createTimeLogSchema`, `patchTimeLogSchema`, and `listTimeLogsQuerySchema` in `@imac/shared`.
  - Pure Progress Service: Built `calculateProjectProgress(tasks)` leaf-task ratio formula and swappable strategy map `projectProgressStrategies` in `apps/api/src/services/projectProgress.ts`; documented formula in `docs/project-progress.md`.
  - Time Logs Router: Implemented `timeLogsRouter` mounted at `/api/projects/:id/time-logs` with `Router({ mergeParams: true })`. Enforced physical membership check (no bypass for `system_admin`), task project belonging (404), [-90 days, +1 day] `Asia/Kathmandu` date boundary, transaction-level PostgreSQL advisory xact lock (`SELECT pg_advisory_xact_lock(hashtext(...))`), 24h daily cap per user-day, role-scoped GET visibility, author-only PATCH/DELETE, and confidential note omission in audit logs.
  - Project Queries: Mounted `/overdue` and `/blocked` before `/:taskId` in `tasks.ts`; implemented `GET /api/projects/:id/summary` and `GET /api/projects/:id/workload` in `projects.ts` with masked non-manager logged hours, unassigned tasks bucket, and departed members bucket.
  - Route Inventory: Created exhaustive route inventory test covering all 30 routes under `/api/projects`, asserting 401 unauthenticated and 404 non-member check order with empty body `{}`.
  - Policy Updates: Documented Questions 28-30 in `docs/open-policy-questions.md` and corrected Question 25 to remove canceled task status reference.
- **Files created or changed**:
  - `apps/api/src/services/projectAccess.ts` (modified)
  - `apps/api/src/lib/permissions.ts` (modified)
  - `packages/shared/src/schemas/timeLog.ts` (created)
  - `packages/shared/src/schemas/index.ts` (modified)
  - `packages/shared/src/index.ts` (modified)
  - `apps/api/src/services/projectProgress.ts` (created)
  - `docs/project-progress.md` (created)
  - `apps/api/src/routes/timeLogs.ts` (created)
  - `apps/api/src/routes/projects.ts` (modified)
  - `apps/api/src/routes/tasks.ts` (modified)
  - `apps/api/src/__tests__/setup.ts` (modified)
  - `apps/api/src/__tests__/projectAccess.test.ts` (created)
  - `apps/api/src/__tests__/permissions.test.ts` (modified)
  - `apps/api/src/__tests__/projectProgress.test.ts` (created)
  - `apps/api/src/__tests__/timeLogs.test.ts` (created)
  - `apps/api/src/__tests__/projectQueries.test.ts` (created)
  - `apps/api/src/__tests__/routeInventory.test.ts` (created)
  - `docs/open-policy-questions.md` (modified)
  - `docs/PROGRESS.md` (modified)
  - `finalreport.md` (modified)
- **Tests run with pass counts**:
  - Vitest test suite (`npm run test`): 14 test suites passed, **442 total tests passed (0 failures)**:
    - `src/__tests__/routeInventory.test.ts` (59 tests passed)
    - `src/__tests__/tasks.test.ts` (73 tests passed)
    - `src/__tests__/security.test.ts` (51 tests passed)
    - `src/__tests__/projects.test.ts` (48 tests passed)
    - `src/__tests__/workLogs.test.ts` (45 tests passed)
    - `src/__tests__/workRoles.test.ts` (40 tests passed)
    - `src/__tests__/permissions.test.ts` (28 tests passed)
    - `src/__tests__/usersAdmin.test.ts` (25 tests passed)
    - `src/__tests__/workLogExport.test.ts` (22 tests passed)
    - `src/__tests__/timeLogs.test.ts` (16 tests passed)
    - `src/__tests__/auth.test.ts` (13 tests passed)
    - `src/__tests__/projectQueries.test.ts` (9 tests passed)
    - `src/__tests__/projectAccess.test.ts` (7 tests passed)
    - `src/__tests__/projectProgress.test.ts` (6 tests passed)
  - TypeScript compiler (`npm run typecheck`): passed with 0 errors across all workspaces.
  - ESLint (`npm run lint`): passed with 0 errors across all workspaces.
- **Status**: done
- **Decisions or problems**:
  - Time logging permission invariant: Unlike project metadata where system_admin has virtual manager privileges, time logging requires physical project membership; unassigned system_admin returns 404.
  - Route collisions in Express: Explicit paths `/overdue` and `/blocked` must be registered before parameterized route `/:taskId`.
  - Advisory xact lock in PostgreSQL: Checked using `SELECT pg_advisory_xact_lock(hashtext(...))` within transaction boundary.
  - Workload query privacy: Non-managers see only their own logged hours and null for other members.
  - Task statuses: Tasks strictly have 4 statuses: `todo`, `in_progress`, `blocked`, `done` (no `canceled` status exists).

## Step 10d Summary & Verification
- **Milestone**: Step 10d — Time Logs, Project Progress Calculation, Workload Queries, Access Hardening, and Route Inventory (Backend Only).
- **Scope Delivery**: Sections 0 to 3 of Step 10d completed cleanly. Section 4 (work log linking) strictly deferred to Step 10e.
- **Schema & Migrations**: Zero schema changes; `prisma migrate dev` was not executed.
- **Verification**: 442 passing tests across 14 test suites, clean typecheck, clean linting.
- **Git Commit**: Not executed (per instruction). Ready for user review and commit.


---

## 14. Step 10e: Linking Daily Work Logs to Projects and Project Messages (Backend Only)

### Task 10e-01: Daily Work Log Project/Task Linking & Project Messages Subsystem
- **Date**: 2026-10-29
- **Day of week**: Thursday
- **Start time**: 08:25:00
- **End time**: 08:44:00
- **Step**: Step 10e (Finish two items missed in 10c and 10d. Backend only, no schema changes)
- **Task performed**:
  - Part A: Daily Work Log Project/Task Linking:
    - Designed and implemented shared validation function `validateWorkLogEntriesProjectAndTask` in `apps/api/src/services/workLog.ts`.
    - Called the validation function from all three write paths: `POST /api/work-logs`, `PATCH /api/work-logs/:id`, and `PATCH /api/admin/work-logs/:id/override`.
    - Enforced validation rules: non-UUID projectId rejected with 400 `invalid_project`, non-existent project rejected with 400 `invalid_project`, non-member caller rejected with 400 `invalid_project` (admin override only requires project existence), taskId without projectId rejected with 400 `invalid_task`, non-existent or foreign task rejected with 400 `invalid_task`. Preserved backward compatibility for old logs with legacy free-text values on read.
    - Added bounded resolution functions `enrichWorkLogsWithProjectAndTask` and `enrichSingleWorkLogWithProjectAndTask` to attach `projectName` and `taskTitle` to read and write responses (`GET /by-date`, `GET /by-week`, `GET /by-month`, `GET /:id`, `POST /`, `PATCH /:id`, `PATCH /override`, `POST /:id/submit`). Non-members receive `null` project/task names to prevent leakage.
    - Implemented unit and integration tests in `apps/api/src/__tests__/workLogProjectLink.test.ts` (13 tests).
  - Part B: Project Messages Subsystem:
    - Added `message:read`, `message:create`, and `message:pin` actions to central permissions matrix in `apps/api/src/lib/permissions.ts` and updated `permissions.test.ts` (31 tests).
    - Created shared schemas `createProjectMessageSchema` and `listProjectMessagesQuerySchema` in `packages/shared/src/schemas/projectMessage.ts`.
    - Implemented messages router in `apps/api/src/routes/messages.ts` mounted at `/api/projects/:id/messages`:
      - `POST /`: create message (viewers denied with 403, non-members 404).
      - `GET /`: list messages (pinned first, then newest, cursor pagination).
      - `POST /:messageId/pin` & `POST /:messageId/unpin`: pin/unpin message (managers and system_admin only, audited without message body).
      - `POST /:messageId/to-task`: converts message into exactly ONE Task in a transaction under advisory lock `SELECT pg_advisory_xact_lock(hashtext('to-task:' || messageId))`; title from first line (trimmed to 200 chars), description from full body; caller must have task creation authority; second call returns 409 `already_converted`; audited without message body or description text.
    - Implemented integration tests in `apps/api/src/__tests__/projectMessages.test.ts` (16 tests).
  - Route Inventory:
    - Added the 5 message routes to `apps/api/src/__tests__/routeInventory.test.ts`, expanding registered route inventory from 30 to 35 routes.
    - Verified 401 unauthenticated across all 35 routes and 404 for non-members across all 33 project-scoped routes (69 tests).
  - Monorepo Verification:
    - Executed `npm run test`: 16 test suites passed, 484 total tests passed (0 failures).
    - Executed `npm run lint`: clean (0 errors).
    - Executed `npm run typecheck`: clean across all workspaces (0 errors).
- **Files created or changed**:
  - `packages/shared/src/schemas/projectMessage.ts` (created)
  - `packages/shared/src/index.ts` (modified)
  - `apps/api/src/lib/permissions.ts` (modified)
  - `apps/api/src/services/workLog.ts` (modified)
  - `apps/api/src/routes/workLogs.ts` (modified)
  - `apps/api/src/routes/admin/workLogs.ts` (modified)
  - `apps/api/src/routes/messages.ts` (created)
  - `apps/api/src/routes/projects.ts` (modified)
  - `apps/api/src/__tests__/permissions.test.ts` (modified)
  - `apps/api/src/__tests__/workLogProjectLink.test.ts` (created)
  - `apps/api/src/__tests__/projectMessages.test.ts` (created)
  - `apps/api/src/__tests__/routeInventory.test.ts` (modified)
  - `docs/PROGRESS.md` (modified)
  - `finalreport.md` (modified)
- **Tests run with pass counts**:
  - `npm run test`: 16 test files passed, **484 total tests passed (0 failures)**:
    - `src/__tests__/routeInventory.test.ts` (69 tests passed)
    - `src/__tests__/tasks.test.ts` (73 tests passed)
    - `src/__tests__/security.test.ts` (51 tests passed)
    - `src/__tests__/projects.test.ts` (48 tests passed)
    - `src/__tests__/workLogs.test.ts` (45 tests passed)
    - `src/__tests__/workRoles.test.ts` (40 tests passed)
    - `src/__tests__/permissions.test.ts` (31 tests passed)
    - `src/__tests__/usersAdmin.test.ts` (25 tests passed)
    - `src/__tests__/workLogExport.test.ts` (22 tests passed)
    - `src/__tests__/projectMessages.test.ts` (16 tests passed)
    - `src/__tests__/timeLogs.test.ts` (16 tests passed)
    - `src/__tests__/workLogProjectLink.test.ts` (13 tests passed)
    - `src/__tests__/auth.test.ts` (13 tests passed)
    - `src/__tests__/projectQueries.test.ts` (9 tests passed)
    - `src/__tests__/projectAccess.test.ts` (7 tests passed)
    - `src/__tests__/projectProgress.test.ts` (6 tests passed)
  - `npm run typecheck`: clean across all workspaces (0 errors).
  - `npm run lint`: clean across all workspaces (0 errors).
- **Status**: done
- **Decisions or problems**:
  - Foreign key decoupling: Maintained `WorkLogEntry.projectId` and `taskId` as plain nullable string columns without schema migration, validating relationships in software.
  - Leakage prevention on resolution: Caller membership is verified during name resolution; non-members receive null for `projectName` and `taskTitle`.
  - Concurrency on to-task: Enforced single-task generation from a message using advisory transaction lock and audit trail record check, returning 409 `already_converted` on repeated conversions.
  - Audit trail privacy: Snapshot omission ensures neither the message body nor task description is serialized to audit metadata.

## Step 10e Summary & Verification
- **Milestone**: Step 10e — Daily Work Log Project/Task Linking & Project Messages Subsystem (Backend Only).
- **Scope Delivery**: Both sections A and B completed fully without schema changes.
- **Verification**: 484 passing tests across 16 test suites, clean typecheck, clean linting.
- **Git Commit**: Not executed (per instruction). Ready for user review and commit.


---

## 15. Step 10f: Review Fixes for Projects, Tasks, Messages, and Work Logs (Backend Only)

### Task 10f-01: Review Fixes, Transaction Hardening, Dependency Guards, and Missing Delete Routes
- **Date**: 2026-10-29
- **Day of week**: Thursday
- **Start time**: 09:15:00
- **End time**: in_progress
- **Step**: Step 10f (Review fixes for projects, tasks, messages, and work logs; backend only, no schema changes)
- **Task performed**:
  - Item 1: Added test verifying GET /api/work-logs/by-date returns 200 with { workLog: null } on empty days.
  - Item 2: Fixed canEditTask in POST /api/projects/:id/tasks by supplying caller user ID so plain project members can create tasks. Checked all other canEditTask call sites and verified arguments.
  - Item 3: Updated docs/project-progress.md strategy name to leaf_tasks_done. Typed select in GET /api/projects/:id/summary to match ProgressTaskItem without as any. Added tests verifying parent tasks with subtasks are excluded from leaf count.
  - Item 4: Moved audit log creation inside database transactions for PATCH /api/projects/:id and message pin/unpin routes. Added mock transaction rollback tests.
  - Item 5: Implemented DELETE /api/projects/:id/tasks/:taskId (managers and system_admin only, transactional audit without description) and DELETE /api/projects/:id/tasks/:taskId/comments/:commentId (author, manager, or system_admin, transactional audit without body). Registered both in route inventory test.
  - Item 6: Enforced dependency guard on task completion: returning 409 open_dependency for non-managers moving a task to done when open dependencies exist, re-checked inside the status-change transaction.
  - Item 7: Validated cursor visibility in GET /api/projects (returning 400 invalid_cursor if cursor is outside caller visible projects).
  - Item 8: Replaced z.coerce.boolean() with explicit string-to-boolean parser for query flags like topLevelOnly and overdue.
- **End time**: 09:39:24
- **Files created or changed**:
  - `packages/shared/src/schemas/task.ts` (modified)
  - `apps/api/src/routes/tasks.ts` (modified)
  - `apps/api/src/routes/projects.ts` (modified)
  - `apps/api/src/routes/messages.ts` (modified)
  - `apps/api/src/__tests__/tasks.test.ts` (modified)
  - `apps/api/src/__tests__/projects.test.ts` (modified)
  - `apps/api/src/__tests__/projectMessages.test.ts` (modified)
  - `apps/api/src/__tests__/projectQueries.test.ts` (modified)
  - `apps/api/src/__tests__/workLogs.test.ts` (modified)
  - `apps/api/src/__tests__/routeInventory.test.ts` (modified)
  - `docs/open-policy-questions.md` (modified)
  - `docs/PROGRESS.md` (modified)
  - `finalreport.md` (modified)
- **Tests run with pass counts**:
  - `npm run test`: 16 test files passed, **509 total tests passed (0 failures)**:
    - `src/__tests__/tasks.test.ts` (89 tests passed)
    - `src/__tests__/routeInventory.test.ts` (73 tests passed, 37 routes tested)
    - `src/__tests__/security.test.ts` (51 tests passed)
    - `src/__tests__/projects.test.ts` (49 tests passed)
    - `src/__tests__/workLogs.test.ts` (46 tests passed)
    - `src/__tests__/workRoles.test.ts` (40 tests passed)
    - `src/__tests__/permissions.test.ts` (31 tests passed)
    - `src/__tests__/usersAdmin.test.ts` (25 tests passed)
    - `src/__tests__/workLogExport.test.ts` (22 tests passed)
    - `src/__tests__/projectMessages.test.ts` (18 tests passed)
    - `src/__tests__/timeLogs.test.ts` (16 tests passed)
    - `src/__tests__/workLogProjectLink.test.ts` (13 tests passed)
    - `src/__tests__/auth.test.ts` (13 tests passed)
    - `src/__tests__/projectQueries.test.ts` (10 tests passed)
    - `src/__tests__/projectAccess.test.ts` (7 tests passed)
    - `src/__tests__/projectProgress.test.ts` (6 tests passed)
  - `npm run typecheck`: clean across all workspaces (0 errors).
  - `npm run lint`: clean across all workspaces (0 errors).
- **Status**: done
- **Decisions or problems**:
  - Mock limitation clarification: Mock-based tests verify application logic branching, validation, and error propagation, but cannot simulate real multi-connection PostgreSQL rollback behavior, lock contention, or physical database engine ON DELETE CASCADE / ON DELETE SET NULL triggers.
  - canEditTask audit: All 6 call sites audited and verified passing `req.user!.id`. Plain project members can now create tasks without manager elevation.
  - Transactional dependency re-check: Open dependencies verified both before and within transaction boundary, returning 409 `open_dependency` for non-managers.
  - Audit log privacy on deletion: Deleted tasks and comments omit description and body text from audit metadata.

## Step 10f Summary & Verification
- **Milestone**: Step 10f — Review Fixes for Projects, Tasks, Messages, and Work Logs (Backend Only).
- **Scope Delivery**: All 8 items and amendments completed cleanly without database schema modifications.
- **Verification**: 509 passing tests across 16 test suites, clean typecheck, clean linting.
- **Git Commit**: Not executed (per instruction). Ready for user review and commit.


---

## 16. Step 12a: Project Screens, Part 1 (Frontend, apps/web)

### Task 12a-01: Projects UI Implementation, Daily Work Log Pickers, Navigation & Error Handling
- **Date**: 2026-10-29
- **Day of week**: Thursday
- **Start time**: 15:44:00
- **End time**: in_progress
- **Step**: Step 12a (Project screens, part 1, in apps/web. No attachments. No backend changes)
- **Task performed**:
  - Implemented typed API client for projects (`apps/web/src/api/projects.ts`) covering list, get, create, patch, status change, summary, tasks, and member add/remove.
  - Added project models and types to `apps/web/src/types/index.ts`.
  - Added "Projects" navigation link to `AdminLayout.tsx` and `EmployeeLayout.tsx` for all permitted roles (system_admin, hr_admin, project_manager, employee, viewer).
  - Configured project routing in `router/index.tsx` for `/admin/projects`, `/admin/projects/:id`, `/employee/projects`, `/employee/projects/:id`, and top-level `/projects` redirect.
  - Built `ProjectListPage.tsx` with name search, status badges, member counts, target dates, "Load more" cursor pagination, loading/error/empty states, and role-guarded "Create Project" action.
  - Built `CreateProjectModal.tsx` and `EditProjectModal.tsx` with date validation (target >= start) and error handling.
  - Built `ProjectDetailPage.tsx` with progress bar, summary metrics, members list, status change dialog, and add/remove member dialogs.
  - Built `ChangeProjectStatusModal.tsx` with trimmed required reason, handling 400 same_status, 400 validation_error, 409 conflict_retry, 403, and 404.
  - Built `AddProjectMemberModal.tsx` and `RemoveMemberModal.tsx` with confirmation, user selection from active directory users, and error handling for 409 member_already_exists, 400 inactive_user, 400 viewer_cannot_be_member_writer, and 409 last_manager_required.
  - Built friendly 404 Not Found and 403 Forbidden screens for project routes.
  - Updated `DailyWorkLogPage.tsx` replacing free-text project and task inputs with dynamic pickers (projects loaded with nextCursor pagination; member-only filtered for system_admin; tasks hidden for project viewers; legacy unlinked project IDs shown read-only with a "Remove project link" action and omitted from save payloads).
  - Renamed `(Overtime/Surplus)` to `(Over shift length)` in `apps/web/src/lib/dateUtils.ts`.
  - Fixed raw translation keys in `WorkLogSettingsPage.tsx` and `UsersListPage.tsx`, and added all English strings to `apps/web/src/i18n/locales/en.json`.
- **End time**: 16:00:49
- **Files created or changed**:
  - `apps/web/src/types/index.ts` (modified)
  - `apps/web/src/api/projects.ts` (created)
  - `apps/web/src/components/projects/ProjectStatusBadge.tsx` (created)
  - `apps/web/src/components/projects/ProjectRoleBadge.tsx` (created)
  - `apps/web/src/components/projects/CreateProjectModal.tsx` (created)
  - `apps/web/src/components/projects/EditProjectModal.tsx` (created)
  - `apps/web/src/components/projects/ChangeProjectStatusModal.tsx` (created)
  - `apps/web/src/components/projects/AddProjectMemberModal.tsx` (created)
  - `apps/web/src/components/workLogs/ProjectTaskPicker.tsx` (created)
  - `apps/web/src/components/layout/AdminLayout.tsx` (modified)
  - `apps/web/src/components/layout/EmployeeLayout.tsx` (modified)
  - `apps/web/src/router/index.tsx` (modified)
  - `apps/web/src/pages/projects/ProjectListPage.tsx` (created)
  - `apps/web/src/pages/projects/ProjectDetailPage.tsx` (created)
  - `apps/web/src/pages/workLogs/DailyWorkLogPage.tsx` (modified)
  - `apps/web/src/pages/admin/WorkLogSettingsPage.tsx` (modified)
  - `apps/web/src/lib/dateUtils.ts` (modified)
  - `apps/web/src/i18n/locales/en.json` (modified)
  - `docs/PROGRESS.md` (modified)
  - `finalreport.md` (modified)
- **Tests run with pass counts**:
  - `npm run test`: 16 test files passed, **509 total tests passed (0 failures)**:
    - `src/__tests__/tasks.test.ts` (89 tests passed)
    - `src/__tests__/routeInventory.test.ts` (73 tests passed, 37 routes tested)
    - `src/__tests__/security.test.ts` (51 tests passed)
    - `src/__tests__/projects.test.ts` (49 tests passed)
    - `src/__tests__/workLogs.test.ts` (46 tests passed)
    - `src/__tests__/workRoles.test.ts` (40 tests passed)
    - `src/__tests__/permissions.test.ts` (31 tests passed)
    - `src/__tests__/usersAdmin.test.ts` (25 tests passed)
    - `src/__tests__/workLogExport.test.ts` (22 tests passed)
    - `src/__tests__/projectMessages.test.ts` (18 tests passed)
    - `src/__tests__/timeLogs.test.ts` (16 tests passed)
    - `src/__tests__/workLogProjectLink.test.ts` (13 tests passed)
    - `src/__tests__/auth.test.ts` (13 tests passed)
    - `src/__tests__/projectQueries.test.ts` (10 tests passed)
    - `src/__tests__/projectAccess.test.ts` (7 tests passed)
    - `src/__tests__/projectProgress.test.ts` (6 tests passed)
  - `npm run typecheck`: clean across all workspaces (0 errors).
  - `npm run lint`: clean across all workspaces (0 errors).
  - `npm run build --workspace=apps/web`: built cleanly for production (0 errors).
- **Status**: done
- **Decisions or problems**:
  - Directory API audit (Amendment 1): Audited `GET /api/employees` and confirmed it queries the `User` table directly with `where: { isActive: true }`, returning canonical `User.id` for all active staff, including admins without employee profiles. The endpoint is accessible to all authenticated staff (including project managers), satisfying member picker requirements without guessing IDs.
  - Daily Work Log membership gating (Amendment 2): Iteratively loaded all projects with cursor pagination until `hasMore === false`. For `system_admin`, filtered down to projects where the admin has an active `ProjectMember` row.
  - Viewer task isolation (Amendment 2): Evaluated project membership role for the chosen project; hid the task picker for users with `viewer` role on that project.
  - Legacy free-text protection (Amendment 3): Rendered non-UUID project IDs read-only with a "Legacy text" note and a "Remove project link" action. Ensured legacy free-text values are never passed in write payloads, protecting users from server 400 `invalid_project` errors.
  - Translation audit (Amendment 4): Renamed `(Overtime/Surplus)` to `(Over shift length)` in `apps/web/src/lib/dateUtils.ts`. Performed automated scans of all JSX/TSX files against `en.json`, fixing all raw translation keys across settings and user list pages, achieving 0 missing keys.

## Step 12a Summary & Verification
- **Milestone**: Step 12a — Project screens, part 1, in apps/web.
- **Scope Delivery**: Project listing, creation, detail, editing, status transitions, member management, navigation, and Daily Work Log pickers completed fully.
- **Verification**: 509 passing tests across 16 test suites, clean typecheck, clean linting, and successful web workspace production build.
- **Git Commit**: Not executed (per instruction). Ready for user review and commit.


---

## 17. Step 12a-FIX: Projects Sidebar 404 Resolution, Dashboard Polish, Route Protection & Route-Table Test

### Task 12a-02: Route Table Registration, Dashboard Replacement, Role Guarding & Route Table Vitest Suite
- **Date**: 2026-10-30
- **Day of week**: Friday
- **Start time**: 09:18:00
- **End time**: 09:33:00
- **Step**: Step 12a-FIX (Projects sidebar 404 fix, dashboard replacement, route-table tests, route guarding)
- **Task performed**:
  - Investigated route table mismatch in `apps/web/src/router/index.tsx` causing 404 for `/admin/projects`, `/employee/projects`, and top-level redirects.
  - Registered `projects` (`ProjectListPage`) and `projects/:id` (`ProjectDetailPage`) under `AdminLayout` child routes.
  - Registered `projects` (`ProjectListPage`) and `projects/:id` (`ProjectDetailPage`) under `EmployeeLayout` child routes.
  - Registered top-level `/projects` and `/projects/:id` redirects with role-based routing (`system_admin` -> `/admin/projects`, other roles -> `/employee/projects`).
  - Added route guard verification test proving non-admin accessing `/admin/projects` or `/admin/*` is blocked by `ProtectedRoute`.
  - Replaced placeholder dashboards (`AdminDashboardPage.tsx` and `EmployeeDashboardPage.tsx`) with simple start pages: personal greeting, role-appropriate quick links, a "Today" work log card for users with a profile, a "My projects" card showing the first 5 projects with status badges, and friendly empty/no-profile states. Removed all duplicated text and "Phase 7" wording; strictly react-i18next translation keys.
  - Audited sidebar navigation links across `AdminLayout` and `EmployeeLayout`. Found and resolved broken placeholder links pointing to catch-all 404 routes (`/admin/audit-log`, `/employee/leave`, `/employee/overtime`) by setting `visible: false` until their phases are implemented.
  - Created router test suite in `apps/web/src/router/__tests__/routes.test.ts` (11 tests) verifying all visible sidebar links across `AdminLayout` and `EmployeeLayout` resolve to valid concrete routes without hitting catch-all `*`, top-level redirects work as expected, and admin routes are protected.
  - Configured `"test": "vitest run"` in `apps/web/package.json` utilizing hoisted root `vitest@2.1.9` without adding external packages.
- **Files created or changed**:
  - `apps/web/src/router/index.tsx` (modified)
  - `apps/web/src/components/layout/AdminLayout.tsx` (modified)
  - `apps/web/src/components/layout/EmployeeLayout.tsx` (modified)
  - `apps/web/src/pages/dashboard/AdminDashboardPage.tsx` (modified)
  - `apps/web/src/pages/dashboard/EmployeeDashboardPage.tsx` (modified)
  - `apps/web/src/i18n/locales/en.json` (modified)
  - `apps/web/package.json` (modified)
  - `apps/web/src/router/__tests__/routes.test.ts` (created)
  - `docs/PROGRESS.md` (modified)
  - `finalreport.md` (modified)
- **Tests run with pass counts**:
  - `npm run test`: **520 total tests passed (0 failures)** across 17 test files:
    - `apps/api`: 16 test files passed, 509 tests passed (0 failures).
    - `apps/web`: 1 test file passed, 11 tests passed (0 failures).
  - `npm run typecheck`: clean across all workspaces (0 errors).
  - `npm run lint`: clean across all workspaces (0 errors).
  - `npm run build --workspace=apps/web`: built cleanly for production (0 errors).
- **Status**: done
- **Decisions or problems**:
  - Root Cause of 404: `projects` and `projects/:id` were missing from the children arrays of both `admin` and `employee` layouts in `apps/web/src/router/index.tsx`. Consequently, navigating to `/admin/projects` or `/employee/projects` was captured by the layout catch-all `*` and rendered `NotFoundPage`.
  - Additional Broken Links Identified (Amendment 4):
    - `/admin/audit-log` in `AdminLayout`: Audit log screen is not yet implemented, previously fell through to 404.
    - `/employee/leave` in `EmployeeLayout`: Leave management is Phase 4 scope, previously fell through to 404.
    - `/employee/overtime` in `EmployeeLayout`: Overtime requests is Phase 5 scope, previously fell through to 404.
    - Solution: Set `visible: false` on these three nav items so that all visible links point to fully functional, concrete routes.
  - Zero New Dependencies (Amendment 2): Vitest 2.1.9 is hoisted at the workspace root. Added `"test": "vitest run"` directly to `apps/web/package.json`. No extra dev packages were installed.
  - DOM vs Node test environment: `createBrowserRouter` requires a DOM environment (`document`). In `apps/web/src/router/index.tsx`, used `typeof document !== 'undefined' ? createBrowserRouter(routes) : createMemoryRouter(routes)` to enable fast, zero-dependency Node execution of router unit tests.

---

## Step 12a-FIX Summary & Verification
- **Milestone**: Step 12a-FIX — Projects Sidebar 404 Resolution, Dashboard Polish, Route Protection & Route-Table Test
- **Scope Delivery**:
  - Sidebar links for Projects now route directly to project list and detail pages for all authorized roles.
  - Top-level `/projects` and `/projects/:id` redirect dynamically based on user system role (`system_admin` -> `/admin/projects`, other roles -> `/employee/projects`).
  - Unauthorized access to `/admin/*` routes is strictly blocked by `ProtectedRoute` (`allowedRoles: ['system_admin', 'hr_admin']`).
  - Placeholder dashboards replaced with clean, role-tailored dashboards featuring personal greeting, quick links, "Today" work log card, and "My projects" card. Duplicated content and "Phase 7" text eliminated; 100% translation keys via `en.json`.
  - All sidebar links audited; dead links hidden.
  - Route table test suite (`routes.test.ts`) added to `apps/web`.
- **Verification**:
  - `npm run test`: 520 tests passing across 17 test suites (509 in `apps/api`, 11 in `apps/web`).
  - `npm run typecheck`: 0 errors.
  - `npm run lint`: 0 errors.
  - `npm run build --workspace=apps/web`: 0 errors.
- **Git Commit**: Not executed (per instruction). Ready for user review and commit.




---

## 18. Step 12b-1: Task Screens Part 1 (Backend Audits, Permission Matrix Tests, Tabs, Task List, Board & Create Task)

### Task 12b-01: Backend Audit Count, Route Permission Matrix Test, Tasks Tab, List View, Board View & Create Task Modal
- **Date**: 2026-10-30
- **Day of week**: Friday
- **Start time**: 12:31:00
- **End time**: in_progress
- **Step**: Step 12b-1 (Part 0 backend items 0.1-0.3, UI items 1.1-1.4)
- **Task performed**:
  - In `apps/api/src/routes/tasks.ts`, update `DELETE /api/projects/:id/tasks/:taskId` to count subtasks and cascade-deleted comments (on the task and its subtasks) within the transaction and include `subtaskCount` and `commentCount` in `task.deleted` audit `beforeSnapshot` without `description`.
  - Add test in `apps/api/src/__tests__/tasks.test.ts` verifying `subtaskCount` and `commentCount` in the audit log and verifying `beforeSnapshot.description === undefined`.
  - Create `apps/api/src/__tests__/projectRoutePermissions.test.ts` implementing the full mutating route permission matrix test with bidirectional Express router introspection and assertions for `system_admin`, project `manager`, project `member`, project `viewer`, non-member (`hr_admin` and system `project_manager`), malformed UUID, and unauthenticated callers with CSRF tokens and valid payloads.
  - Remove unused `createAuditEntry` import in `apps/api/src/routes/projects.ts`.
  - Update `docs/open-policy-questions.md` with Questions 34 and 35 regarding time-log editing/deletion by managers and system_admin universal project access.
  - Update `apps/web/src/types/index.ts` and `apps/web/src/api/projects.ts` with task list and creation types/functions and read-only `fetchProjectMilestones`.
  - Implement tab navigation in `apps/web/src/pages/projects/ProjectDetailPage.tsx` (Overview, Tasks, Milestones placeholder).
  - Implement Task List view with filters (status, assignee, milestone, top-level only, overdue) and cursor pagination.
  - Implement Task Board view with 4 status columns, "Move to" status transition control gated by `canEditTask('changeStatus')`, warnings display, and "Showing N tasks, load more" indicator without fabricated column counts.
  - Implement Create Task modal with required fields, validation, and error handling.
  - Add all English strings to `apps/web/src/i18n/locales/en.json`.
- **Files created or changed**:
  - `apps/api/src/routes/tasks.ts`
  - `apps/api/src/__tests__/tasks.test.ts`
  - `apps/api/src/routes/projects.ts`
  - `apps/api/src/__tests__/projectRoutePermissions.test.ts`
  - `docs/open-policy-questions.md`
  - `apps/web/src/types/index.ts`
  - `apps/web/src/api/projects.ts`
  - `apps/web/src/pages/projects/ProjectDetailPage.tsx`
  - `apps/web/src/components/projects/TasksTab.tsx`
  - `apps/web/src/components/projects/TaskStatusBadge.tsx`
  - `apps/web/src/components/projects/CreateTaskModal.tsx`
  - `apps/web/src/i18n/locales/en.json`
- **Tests run with pass counts**:
  - `npm run test`: 18 test files passed, 718 total tests passed (0 failures):
    - `apps/api`: 17 test files, 707 passed.
      - `apps/api/src/__tests__/projectRoutePermissions.test.ts`: 198 passed.
      - `apps/api/src/__tests__/tasks.test.ts`: 89 passed.
    - `apps/web`: 1 test file, 11 passed (`apps/web/src/router/__tests__/routes.test.ts`).
  - `npm run typecheck`: clean across all workspaces (`@imac/api`, `@imac/web`, `@imac/shared`), 0 errors.
  - `npm run lint`: clean across all workspaces, 0 errors.
  - `npm run build --workspace=apps/web`: built cleanly in 12.15s, 0 errors.
- **Status**: COMPLETED

---

## 20. Step 12b-1 Fix: TasksTab React Query useInfiniteQuery Refactor Completion

### Task 12b-FIX-02: TasksTab useInfiniteQuery Refactor, Pure Helper & Unit Tests
- **Date**: 2026-10-30
- **Day of week**: Friday
- **Start time**: 15:54:11
- **End time**: 16:00:41
- **Step**: Step 12b-1 Bugfix Completion (Items 1–7)
- **Task performed**:
  - Replaced `useQuery` and manual `tasks` state accumulation in `apps/web/src/components/projects/TasksTab.tsx` with `useInfiniteQuery`.
  - Audited web workspace for query key `'projectTasks'`: found usage in `apps/web/src/components/workLogs/ProjectTaskPicker.tsx`. Selected key prefix `'projectTasksInfinite'` to eliminate any key collisions between infinite and scalar queries.
  - Extracted pure, zero-dependency helper functions into `apps/web/src/lib/taskPagination.ts` (`flattenAndDeduplicateTasks` and `getNextTaskPageParam`) with ID de-duplication preserving initial order.
  - Authored pure Node Vitest test suite in `apps/web/src/lib/__tests__/taskPagination.test.ts` covering empty pages, two distinct pages, cross-page duplicate IDs, `hasMore: false`, and `hasMore: true` with a cursor (6 tests passing).
  - Wired task status mutations to await query invalidations (`projectTasksInfinite`, `projectTasks`, and `topLevelTasks`) before clearing card action/busy states.
  - Updated filter transition behavior: `isInitialLoading` displays the loading state rather than empty "No tasks found" state while initial page for new filter combinations is fetching.
  - Verified installed `@tanstack/react-query` version: `5.104.2` (no package upgrades or new dependencies installed).
- **Files created or changed**:
  - `apps/web/src/lib/taskPagination.ts` (created)
  - `apps/web/src/lib/__tests__/taskPagination.test.ts` (created)
  - `apps/web/src/components/projects/TasksTab.tsx` (modified)
  - `finalreport.md` (completion entry appended)
- **Tests run with pass counts**:
  - `npm test`: 19 test files passed, 724 total tests passed (0 failures):
    - `apps/api`: 17 test files, 707 passed.
    - `apps/web`: 2 test files, 17 passed (`taskPagination.test.ts`: 6 passed, `routes.test.ts`: 11 passed).
  - `npm run typecheck`: clean across all workspaces (`@imac/api`, `@imac/web`, `@imac/shared`), 0 errors.
  - `npm run lint`: clean across all workspaces, 0 errors.
  - `npm run build --workspace=apps/web`: built cleanly in 6.31s, 0 errors.
- **Status**: COMPLETED

---

## 21. Step 12b-1 Hand Test Fix: Date Helpers Resiliency, ISO Due Date Parsing & Overdue Consistency

### Task 12b-FIX-03: Resilient Date Helpers, ISO Timestamp Parsing, Overdue Parity, and Vitest Tests
- **Timestamp**: 2026-11-02 08:41:17 +05:45
- **Step**: Step 12b-1 Hand Test Bugfix
- **Task performed**:
  - Investigated `RangeError: Invalid time value` thrown from `formatDateDisplay` when called at `TasksTab.tsx:520` on `task.dueDate`.
  - Identified root cause: API route returns Prisma `@db.Date` fields as JavaScript `Date` serialized to ISO 8601 UTC timestamps (e.g., `"2026-11-02T00:00:00.000Z"`). `formatDateDisplay` previously used `dateStr.split('-')`, causing `day = NaN`.
  - Hardened `apps/web/src/lib/dateUtils.ts`:
    - `extractDatePart(dateStr)`: extracts `YYYY-MM-DD` from date-only strings or ISO timestamps without timezone shifting; validates calendar bounds (1 <= month <= 12, valid days per month); returns `null` for missing, empty, or impossible inputs. Never invents a date.
    - `parseYmd(dateStr)`: returns `{ year, month, day }` or `null` on invalid/empty/impossible inputs while maintaining backward call compatibility.
    - `formatDateDisplay(dateStr)`: returns `"-"` placeholder for `null`, `undefined`, `''`, whitespace, or unparseable input. Never throws.
    - `toDateInputValue(value)`: returns `YYYY-MM-DD` or `""` for HTML `<input type="date">`.
    - `isTaskOverdue(dueDate, status, today)`: checks date parts only against Asia/Kathmandu today, ignores done tasks, does not crash on missing/invalid due dates.
  - Refactored `apps/web/src/components/projects/TasksTab.tsx`:
    - Used `isTaskOverdue` in both List and Board views.
    - Used `formatDateDisplay(task.dueDate)` and added overdue badge in Board view to match List view.
  - Refactored `MilestonesTabPlaceholder.tsx` to use `formatDateDisplay` instead of raw ISO string concatenation.
  - Refactored `EditProjectModal.tsx` to initialize `<input type="date">` using `toDateInputValue`.
  - Added pure Vitest unit tests in `apps/web/src/lib/__tests__/dateUtils.test.ts` (20 tests covering null, undefined, '', 'garbage', '2026-11-02', '2026-11-02T00:00:00.000Z', '2026-11-02T18:30:00.000Z', toDateInputValue, and day boundary overdue checks).
- **Files created or changed**:
  - `apps/web/src/lib/dateUtils.ts` (modified)
  - `apps/web/src/lib/__tests__/dateUtils.test.ts` (created)
  - `apps/web/src/components/projects/TasksTab.tsx` (modified)
  - `apps/web/src/components/projects/MilestonesTabPlaceholder.tsx` (modified)
  - `apps/web/src/components/projects/EditProjectModal.tsx` (modified)
  - `finalreport.md` (modified)
- **Tests run with pass counts**:
  - `npm run test --workspace=apps/web`: 3 test files passed, 37 total tests passed (0 failures).
  - `npm run typecheck --workspace=apps/web`: clean, 0 errors.
- **Status**: COMPLETED


---

## 22. Step 12b-2a: Task Detail Screen (Inline Edit, Delete, Subtasks & Shared Permissions)

### Task 12b-DETAIL-01: Task Detail Page, Inline Editing, Delete Confirmation, Subtasks List, and Route Tests
- **Timestamp**: 2026-11-02 09:32:20 +05:45
- **Step**: Step 12b-2a (Task Detail Screen, Part 1)
- **Task performed**:
  - Implemented `ProjectTaskDetail` and `TaskDependencyItem` in `apps/web/src/types/index.ts`.
  - Added API endpoints in `apps/web/src/api/projects.ts` (`fetchTaskDetail`, `patchTask`, `deleteTask`).
  - Created `apps/web/src/lib/taskPermissions.ts` mirroring `apps/api/src/services/projectAccess.ts` (`canEditTask`, `canDeleteTask`, `canCommentOnTask`).
  - Authored table-driven test suite `apps/web/src/lib/__tests__/taskPermissions.test.ts` (54 test assertions across all roles, creator, assignee, other, viewer, undefined, empty user ID).
  - Created pure helper `apps/web/src/lib/taskEditPayload.ts` for PATCH payload generation, change detection, and validation (title, description <= 5000 chars, date YYYY-MM-DD regex, quarter hours).
  - Authored unit test suite `apps/web/src/lib/__tests__/taskEditPayload.test.ts` (15 tests).
  - Created canonical path helper `apps/web/src/lib/taskLinks.ts` with unit test suite `apps/web/src/lib/__tests__/taskLinks.test.ts` (6 tests).
  - Extracted `TaskStatusControl.tsx` for shared status transition logic across Board and Detail screens with identical error mapping (`open_dependency`, `conflict_retry`, 403, 404, warnings array).
  - Developed `apps/web/src/pages/projects/TaskDetailPage.tsx`:
    - Title, plain text description (no `dangerouslySetInnerHTML`), status badge, assignee, milestone, due date, estimated hours, creator, creation date.
    - User name resolution from `project.members` with "Former member" fallback (no raw IDs shown).
    - Status transition control and assignee membership warning banner (`assigneeIsProjectMember === false`).
    - Inline editing mode with live 5000 character counter; background queries do not overwrite typing; Save sends single PATCH with changed fields.
    - Delete dialog matching exact database cascade reality (`subtasks.length` count, comments, dependency links, preserved time logs). Navigates back first, purges cache entry, and invalidates list keys.
    - Subtasks list with links and metadata; Quick-Add subtask modal with locked `defaultParentTaskId` prop; blocks nested subtasks on subtasks.
  - Registered `/admin/projects/:id/tasks/:taskId`, `/employee/projects/:id/tasks/:taskId`, and top-level redirect `/projects/:id/tasks/:taskId` in `apps/web/src/router/index.tsx`.
  - Linked task titles in List and Board views in `TasksTab.tsx` using `getTaskDetailPath`.
  - Extended route test suite in `apps/web/src/router/__tests__/routes.test.ts` for all three routes and link resolution (15 tests).
  - Added all English strings to `apps/web/src/i18n/locales/en.json` under `projects.taskDetail.*` (0 missing keys confirmed).
- **Files created or changed**:
  - `apps/web/src/types/index.ts` (modified)
  - `apps/web/src/api/projects.ts` (modified)
  - `apps/web/src/lib/taskPermissions.ts` (created)
  - `apps/web/src/lib/__tests__/taskPermissions.test.ts` (created)
  - `apps/web/src/lib/taskEditPayload.ts` (created)
  - `apps/web/src/lib/__tests__/taskEditPayload.test.ts` (created)
  - `apps/web/src/lib/taskLinks.ts` (created)
  - `apps/web/src/lib/__tests__/taskLinks.test.ts` (created)
  - `apps/web/src/components/projects/TaskStatusControl.tsx` (created)
  - `apps/web/src/components/projects/CreateTaskModal.tsx` (modified)
  - `apps/web/src/components/projects/TasksTab.tsx` (modified)
  - `apps/web/src/pages/projects/TaskDetailPage.tsx` (created)
  - `apps/web/src/router/index.tsx` (modified)
  - `apps/web/src/router/__tests__/routes.test.ts` (modified)
  - `apps/web/src/i18n/locales/en.json` (modified)
  - `docs/PROGRESS.md` (modified)
  - `finalreport.md` (modified)
- **Tests run with pass counts**:
  - `npm run test --workspace=apps/web`: 6 test files passed, 116 total tests passed (0 failures).
  - `npm run typecheck --workspace=apps/web`: clean, 0 errors.
  - `npm run lint --workspace=apps/web`: clean, 0 errors.
  - `npm run build --workspace=apps/web`: production build successful in 8.15s, 0 errors.
- **Status**: COMPLETED


---

## 23. Step 12b-2b: Task Dependencies and Comments (Frontend, apps/web)

### Task 12b-DETAIL-02: Task Dependencies UI, Comments Subsystem, Status Control Hardening & Unit Tests
- **Date**: 2026-11-05
- **Day of week**: Thursday
- **Start time**: 08:57
- **End time**: 09:13
- **Step**: Step 12b-2b (Task Dependencies and Comments inside TaskDetailPage)
- **Task performed**:
  - Added TaskComment types and API client endpoints (`addTaskDependency`, `removeTaskDependency`, `fetchTaskComments`, `createTaskComment`, `patchTaskComment`, `deleteTaskComment`) in `apps/web/src/types/index.ts` and `apps/web/src/api/projects.ts`.
  - Built pure helper `taskDependencyHelpers.ts` with candidate task filtering (excluding self, prerequisites, and dependent tasks per Amendment 1) and plain-word cycle/conflict error mapping.
  - Built pure helper `taskCommentPermissions.ts` with comment authorization checks and `isCommentEdited` requiring >2000ms delta between `updatedAt` and `createdAt` (Amendment 4).
  - Authored comprehensive unit tests in `taskDependencyHelpers.test.ts` (11 tests) and `taskCommentPermissions.test.ts` (14 tests).
  - Hardened shared `TaskStatusControl.tsx` to render friendly plain-text warnings (`open_dependency`, `open_subtasks`) and 409 `open_dependency` explanations across both board and detail views (Amendment 2), with auto-invalidation on 403/404 (Amendment 3).
  - Built `TaskDependenciesSection.tsx` displaying "Blocked by" (prerequisites) with remove confirmation, "Blocks" (dependents), and an "Add Dependency" dialog with real-time candidate search and permission gating.
  - Built `TaskCommentsSection.tsx` with oldest-first infinite cursor pagination ("Load older comments"), live 5000 character limit counter, viewer read-only notice, author-only inline editing, delete with confirmation for author/manager/admin, and plain-text (`whitespace-pre-wrap`) safe rendering.
  - Integrated both sections into `TaskDetailPage.tsx` left column below subtasks.
  - Added all English translation keys to `apps/web/src/i18n/locales/en.json` and verified zero missing keys via automated scanner.
  - Verified `CreateTaskModal.tsx` strictly matches `createTaskSchema` 7 permitted fields under `.strict()`.
- **Files created or changed**:
  - `apps/web/src/types/index.ts` (modified)
  - `apps/web/src/api/projects.ts` (modified)
  - `apps/web/src/lib/taskDependencyHelpers.ts` (created)
  - `apps/web/src/lib/__tests__/taskDependencyHelpers.test.ts` (created)
  - `apps/web/src/lib/taskCommentPermissions.ts` (created)
  - `apps/web/src/lib/__tests__/taskCommentPermissions.test.ts` (created)
  - `apps/web/src/components/projects/TaskStatusControl.tsx` (modified)
  - `apps/web/src/components/projects/TaskDependenciesSection.tsx` (created)
  - `apps/web/src/components/projects/TaskCommentsSection.tsx` (created)
  - `apps/web/src/pages/projects/TaskDetailPage.tsx` (modified)
  - `apps/web/src/i18n/locales/en.json` (modified)
  - `docs/PROGRESS.md` (modified)
  - `finalreport.md` (modified)
- **Tests run with pass counts**:
  - `npm run test`: 25 test files passed, 848 total tests passed (0 failures):
    - `apps/api`: 17 test files passed, 707 passed.
    - `apps/web`: 8 test files passed, 141 passed.
  - `npm run typecheck`: clean across all workspaces (`@imac/api`, `@imac/web`, `@imac/shared`), 0 errors.
  - `npm run lint`: clean across all workspaces, 0 errors.
  - `npm run build --workspace=apps/web`: production build successful in 7.32s, 0 errors.
- **Status**: COMPLETED
- **Decisions or problems**:
  - Amendment 1 implemented: `filterCandidateDependencies` excludes `dependentOnMe` (Blocks) tasks to prevent immediate 2-node cycle formation.
  - Amendment 2 implemented: `TaskStatusControl` renders identical inline warnings and 409 `open_dependency` error explanations in board view.
  - Amendment 3 implemented: 403 and 404 responses trigger query invalidations and cache refetches so user interface does not remain stuck with stale state.
  - Amendment 4 implemented: `isCommentEdited` helper strictly requires `updatedAt - createdAt > 2000` ms before displaying "(edited)".


---

## 24. Step 12b: Manual Hand-Test Backlog Specification

### Task 12b-HAND-TEST-01: Manual Hand-Test Backlog Specification (Step 9a, 12a, 12b, and Live DB Checks)
- **Date**: 2026-11-05
- **Day of week**: Thursday
- **Start time**: 09:37
- **End time**: 09:38
- **Step**: Step 12b (Documentation & QA Readiness)
- **Task performed**:
  - Authored comprehensive manual test plan in `docs/HAND-TEST-BACKLOG.md`.
  - Structured into 4 distinct testing categories:
    1. Step 9a Daily Work Log (Save draft twice/upsert idempotency, double-click submit protection, block-mode edit refusal, History calendar/list view, Excel export with Nepal time verification, Settings 403 access refusal, no-profile graceful message for admins, and phone-width mobile card responsiveness).
    2. Step 12a Project Screens (Projects list and pagination, project creation with target>=start date check, member add/remove, remove-last-manager refusal, status change mandatory reason, member/viewer read-only invariants, daily work log project pickers, friendly 404 page, and dashboards).
    3. Step 12b Task Screens (Task list and Kanban board views, moving tasks via status control, inline editing with 5000 char counter, subtask nesting 1-level limit, cascading delete confirmation, dependency management and circular loop refusal, comments authorization and edit/delete rules, viewer read-only note, and marking done with open prerequisites).
    4. Real-Database Live Checks (Project lifecycle audit trail, task lifecycle audit trail with privacy omissions for description/body, and double-click idempotency under real network latency).
  - Every test is labeled strictly with `NOT RUN`, the specific role to log in as, expected results, and negative invariants (what each role must NOT be able to do).
  - Ensured no code modifications were made.
- **Files created or changed**:
  - `docs/HAND-TEST-BACKLOG.md` (created)
  - `finalreport.md` (modified)
- **Tests run with pass counts**: N/A (Documentation only; 848 automated tests previously verified passing)
- **Status**: COMPLETED
- **Decisions or problems**: None. Clean document creation with full test coverage mapped directly to prompt specifications.


---

## 25. Step 12b-3: Milestones Tab (Frontend, apps/web)

### Task 12b-MILESTONES-01: Milestones Tab UI, Task Linkage, Overdue Calculations & Unit Tests
- **Date**: 2026-11-05
- **Day of week**: Thursday
- **Start time**: 10:36
- **End time**: 10:46
- **Step**: Step 12b-3 (Milestones Tab in apps/web)
- **Task performed**:
  - Initialized Step 12b-3 implementation.
  - Added API endpoints for milestone management in `apps/web/src/api/projects.ts` (`createProjectMilestone`, `patchProjectMilestone`, `completeProjectMilestone`, `reopenProjectMilestone`).
  - Added payload types in `apps/web/src/types/index.ts` (`CreateMilestonePayload`, `PatchMilestonePayload`).
  - Created pure helper `apps/web/src/lib/milestoneHelpers.ts` for overdue decision (Asia/Kathmandu), task counts per milestone (total and done), milestone task filtering, RBAC capability check, and error mapping.
  - Authored unit test suite `apps/web/src/lib/__tests__/milestoneHelpers.test.ts` (15 unit tests covering all edge cases).
  - Replaced `MilestonesTabPlaceholder.tsx` with full `MilestonesTab.tsx` component:
    - Lists milestones with name, due date, completed state, task counts (total & done), and overdue badge.
    - Create and edit modals (name 1-200 chars, optional due date YYYY-MM-DD).
    - Complete and reopen action buttons gated to managers and `system_admin`.
    - Clicking a milestone expands an accordion list showing its assigned tasks, each linking to task detail via `taskLinks`.
    - Error handling for 403, 404, 409 (`already_completed`, `already_open`), and 400 (`validation_error`) with automatic query refetches.
  - Wired `MilestonesTab.tsx` into `ProjectDetailPage.tsx`.
  - Added English strings to `apps/web/src/i18n/locales/en.json` and resolved all raw keys (automated audit confirmed 0 missing keys).
  - Added manual test backlog cases TEST-12B-09 through TEST-12B-13 in `docs/HAND-TEST-BACKLOG.md`.
- **Files created or changed**:
  - `apps/web/src/types/index.ts` (modified)
  - `apps/web/src/api/projects.ts` (modified)
  - `apps/web/src/lib/milestoneHelpers.ts` (created)
  - `apps/web/src/lib/__tests__/milestoneHelpers.test.ts` (created)
  - `apps/web/src/components/projects/MilestonesTab.tsx` (created)
  - `apps/web/src/pages/projects/ProjectDetailPage.tsx` (modified)
  - `apps/web/src/i18n/locales/en.json` (modified)
  - `docs/HAND-TEST-BACKLOG.md` (modified)
  - `finalreport.md` (modified)
- **Tests run with pass counts**:
  - `npm run test`: 26 test files passed, 863 passed (707 API + 156 Web), 0 failed
  - `npm run lint`: 0 errors
  - `npm run typecheck`: 0 errors
  - `npm run build --workspace=apps/web`: 0 errors (built in 6.95s)
- **Status**: COMPLETED
- **Decisions or problems**: None. Overdue calculation correctly uses Asia/Kathmandu calendar day and excludes completed milestones. Tasks are paginated with `fetchAllTasksForProject` until `hasMore === false` to ensure milestone completion ratios are exact. 409 and 403/404 errors show friendly user explanations and trigger refetches.


---

## 26. Step 12c-1: Project Time Logs, Workload & Project Summary (apps/web)

### Task 12c-TIMELOGS-01: Time Tab, Workload Tab, Task Time Log Section, Overdue/Blocked Cards & Unit Tests
- **Date**: 2026-11-05
- **Day of week**: Thursday
- **Start time**: 14:51
- **End time**: 15:12
- **Step**: Step 12c-1 (Project Time Logs, Workload & Project Summary in apps/web)
- **Task performed**:
  - Investigated schema and API types for `TimeLog.hours` (Float in Prisma, numbers in JSON), `TimeLog.workDate` (DateTime @db.Date), and workload response attributes.
  - Added pure helpers: `timeLogPermissions.ts`, `timeLogPayload.ts`, `timeLogTotals.ts`, `projectTabHelpers.ts`, `timeLogErrorHelpers.ts`.
  - Authored comprehensive unit tests with explicit `referenceToday` parameter across 4 test suites.
  - Hardened `formatHours` in `apps/web/src/lib/dateUtils.ts` to handle number, string, null, undefined, and NaN, returning "-" safely without breaking existing callers.
  - Added API client functions in `apps/web/src/api/projects.ts` (`fetchProjectTimeLogs`, `createProjectTimeLog`, `patchProjectTimeLog`, `deleteProjectTimeLog`, `fetchProjectWorkload`, `fetchProjectOverdueTasks`, `fetchProjectBlockedTasks`).
  - Created `TimeLogsTab.tsx` component with role capability gates (hidden for viewers; system_admin without membership sees notice instead of form), create modal, inline edit, delete confirmation, cursor pagination, and clear loaded-row totals.
  - Created `TaskTimeLogsSection.tsx` in `TaskDetailPage.tsx` with task-scoped time logs and prefilled log modal (hidden for viewers).
  - Created `ProjectWorkloadTab.tsx` with responsive desktop table and mobile stacked cards, masking other members' logged hours for non-managers with "Your Logged Hours Only" header.
  - Enhanced Overview tab with Overdue and Blocked tasks cards displaying exact server counts and first 5 tasks linked via `getTaskDetailPath`.
  - Added English translations to `apps/web/src/i18n/locales/en.json` (automated scanner confirmed 0 missing keys).
  - Updated `docs/open-policy-questions.md` with Question 36 regarding member visibility of peer workload metrics.
  - Appended manual test cases `TEST-12C-01` through `TEST-12C-06` to `docs/HAND-TEST-BACKLOG.md`.
- **Files created or changed**:
  - `apps/web/src/types/index.ts` (modified)
  - `apps/web/src/api/projects.ts` (modified)
  - `apps/web/src/lib/dateUtils.ts` (modified)
  - `apps/web/src/lib/__tests__/dateUtils.test.ts` (modified)
  - `apps/web/src/lib/timeLogPermissions.ts` (created)
  - `apps/web/src/lib/__tests__/timeLogPermissions.test.ts` (created)
  - `apps/web/src/lib/timeLogTotals.ts` (created)
  - `apps/web/src/lib/__tests__/timeLogTotals.test.ts` (created)
  - `apps/web/src/lib/timeLogPayload.ts` (created)
  - `apps/web/src/lib/__tests__/timeLogPayload.test.ts` (created)
  - `apps/web/src/lib/projectTabHelpers.ts` (created)
  - `apps/web/src/lib/__tests__/projectTabHelpers.test.ts` (created)
  - `apps/web/src/lib/timeLogErrorHelpers.ts` (created)
  - `apps/web/src/components/projects/TimeLogsTab.tsx` (created)
  - `apps/web/src/components/projects/TaskTimeLogsSection.tsx` (created)
  - `apps/web/src/components/projects/ProjectWorkloadTab.tsx` (created)
  - `apps/web/src/pages/projects/ProjectDetailPage.tsx` (modified)
  - `apps/web/src/pages/projects/TaskDetailPage.tsx` (modified)
  - `apps/web/src/i18n/locales/en.json` (modified)
  - `docs/open-policy-questions.md` (modified)
  - `docs/HAND-TEST-BACKLOG.md` (modified)
  - `finalreport.md` (modified)
- **Tests run with pass counts**:
  - `npm run test`: 30 test files passed, 950 passed (707 API + 243 Web), 0 failed
  - `npm run lint`: 0 errors
  - `npm run typecheck`: 0 errors
  - `npm run build --workspace=apps/web`: 0 errors (built in 7.35s)
- **Status**: COMPLETED
- **Decisions or problems**: Time tab and task detail time section hidden for viewers per Amendment 2. system_admin without a project membership row sees time tab with notice instead of form. Workload null loggedHours renders "-" and is excluded from totals. Changing filters resets pagination to the first page. Handled invalid_cursor with automatic first-page reload. Zero query key collisions.


---

## 27. Step 12c-2: Project Messages Tab (Frontend, apps/web)

### Task 12c-MESSAGES-01: Messages Tab UI, Role Capabilities, Conversion to Task, Cache Invalidation & Unit Tests
- **Date**: 2026-11-13
- **Day of week**: Friday
- **Start time**: 10:46
- **End time**: 10:56
- **Step**: Step 12c-2 (Project Messages Tab in apps/web)
- **Task performed**:
  - Investigated schema and API types for ProjectMessage, AuthorUser, and Task model in schema.prisma.
  - Added pure helpers in `apps/web/src/lib/projectMessageHelpers.ts` with `canPostMessage`, `canPinMessage`, and `canConvertToTask` (mirroring `message:create`, `message:pin`, and `task:write` from `apps/api/src/lib/permissions.ts:79-85`), `deduplicateMessagesById`, session converted tracking, and `mapProjectMessageError`.
  - Authored comprehensive table-driven unit test suite in `apps/web/src/lib/__tests__/projectMessageHelpers.test.ts` (37 tests) verifying all system and project role combinations, fail-closed behavior for members without a userId, and agreement with `canEditTask`.
  - Added `formatDateTimeDisplay` to `apps/web/src/lib/dateUtils.ts` with `hourCycle: 'h23'` formatting Asia/Kathmandu date and time with year, verified with explicit UTC timestamps in `dateUtils.test.ts` (24 tests passed).
  - Created centralized cache invalidator `apps/web/src/lib/projectTaskCache.ts` invalidating all verified task/summary/workload query keys.
  - Added API client functions in `apps/web/src/api/projects.ts` (`fetchProjectMessages`, `createProjectMessage`, `pinProjectMessage`, `unpinProjectMessage`, `convertProjectMessageToTask`).
  - Extended `resolveProjectTab` in `apps/web/src/lib/projectTabHelpers.ts` and test suite (4 tests passed).
  - Built `apps/web/src/components/projects/MessagesTab.tsx` with `useInfiniteQuery` (query key `['projectMessagesInfinite', project.id]`, `staleTime: 0`), post message form (1–5000 chars, counter, viewer banner, double-click protection), author name resolution with former-member fallback, plain-text body (`whitespace-pre-wrap`), manager/system_admin pin controls, single-recovery cursor reload, and task conversion with confirmation dialog and direct task link.
  - Integrated Messages tab into `ProjectDetailPage.tsx` navigation and tab body.
  - Added all English translations to `apps/web/src/i18n/locales/en.json` with 0 missing keys.
  - Documented known backend limitations in `docs/PROGRESS.md` and appended manual test cases `TEST-12C-07` through `TEST-12C-12` to `docs/HAND-TEST-BACKLOG.md`.
- **Files created or changed**:
  - `apps/web/src/types/index.ts` (modified)
  - `apps/web/src/api/projects.ts` (modified)
  - `apps/web/src/lib/dateUtils.ts` (modified)
  - `apps/web/src/lib/__tests__/dateUtils.test.ts` (modified)
  - `apps/web/src/lib/projectTabHelpers.ts` (modified)
  - `apps/web/src/lib/__tests__/projectTabHelpers.test.ts` (modified)
  - `apps/web/src/lib/projectTaskCache.ts` (created)
  - `apps/web/src/lib/projectMessageHelpers.ts` (created)
  - `apps/web/src/lib/__tests__/projectMessageHelpers.test.ts` (created)
  - `apps/web/src/components/projects/MessagesTab.tsx` (created)
  - `apps/web/src/pages/projects/ProjectDetailPage.tsx` (modified)
  - `apps/web/src/i18n/locales/en.json` (modified)
  - `docs/HAND-TEST-BACKLOG.md` (modified)
  - `docs/PROGRESS.md` (modified)
  - `finalreport.md` (modified)
- **Tests run with pass counts**:
  - `npm run test`: 31 test files passed, 989 passed (707 API + 282 Web), 0 failed
  - `npm run lint`: 0 errors
  - `npm run typecheck`: 0 errors across `@imac/api`, `@imac/web`, `@imac/shared`
  - `npm run build --workspace=apps/web`: 0 errors (built production bundle in 7.09s)
- **Status**: COMPLETED
- **Decisions or problems**: None. Zero query key collisions. Helper functions strictly derive admin status from `systemRole === 'system_admin'`. Task model in `schema.prisma` verified and type declared with confirmed fields only. Format timestamp uses `hourCycle: 'h23'`. Double-click submit prevented via ref guard and disabled state.

### Task 12c-POLICY-01: Document Open Policy Question on Message Conversion Task Title in Audit Log
- **Date**: 2026-11-13
- **Day of week**: Friday
- **Start time**: 16:28
- **End time**: 16:29
- **Step**: Step 12c-2 (Documentation & Policy Alignment)
- **Task performed**:
  - Checked `docs/open-policy-questions.md` for existing task-title-in-audit questions; verified no duplicate exists.
  - Appended Question 37 ("Message Conversion Task Title and Audit Log Exposure") to `docs/open-policy-questions.md`, continuing sequential numbering.
  - Formulated question for IMAC leadership regarding whether storing the task title derived from the first line (or full text for one-line messages) in audit log events (`project_message.converted_to_task` and `task.created`) is acceptable, or whether audit entries should record entity IDs only (`taskId`, `messageId`, `projectId`) to prevent message text exposure in audit trails.
- **Files created or changed**:
  - `docs/open-policy-questions.md` (modified)
  - `finalreport.md` (modified)
- **Tests run with pass counts**: N/A (Documentation update only)
- **Status**: COMPLETED
- **Decisions or problems**: None. Confirmed zero duplicate questions; sequential numbering continued from 36 to 37.

### Task 12c-DOCS-02: Documentation Alignment, Backend Limitation Corrections & Concurrent Hand-Test Backlog
- **Date**: 2026-11-13
- **Day of week**: Friday
- **Start time**: 16:47
- **End time**: 16:49
- **Step**: Step 12c-2 (Documentation Alignment & Hand-Test Backlog)
- **Task performed**:
  - Corrected Question 37 in `docs/open-policy-questions.md`: updated audit metadata field names to `afterSnapshot.title`, noted additional properties (`taskId`, `status`, `projectId`, `fromMessageId`), and clarified that standard message creation writes no audit entry, pinning/unpinning writes audit entries without message text (`afterSnapshot.isPinned`), and conversion writes two audit entries.
  - Replaced "Known backend limitations" note in `docs/PROGRESS.md` under Step 12c-2: noted that simultaneous conversions are prevented via transaction-level advisory locking (`pg_advisory_xact_lock`) and audit check in `apps/api/src/routes/messages.ts`, and identified real limits (audit row dependency and permanent unconvertibility if created task is deleted).
  - Added security review note under Step 10f in `docs/PROGRESS.md`: "messages.ts reviewed 2026-11-13: no access-control, IDOR or transaction findings".
  - Appended `TEST-12C-13` to `docs/HAND-TEST-BACKLOG.md` (marked `NOT RUN`) specifying concurrent message conversion testing in two browser sessions by `akrit`, noting that if both show success it must be recorded as a bug. Confirmed continuous ID sequence without duplicates.
  - Investigated `deploy/.env.production.example`: cause unknown; no tool call in this session edited it; the user restored it with git restore; a generated value was never committed and was verified absent from `finalreport.md`, `docs/`, and repository files.
- **Files created or changed**:
  - `docs/open-policy-questions.md` (modified)
  - `docs/PROGRESS.md` (modified)
  - `docs/HAND-TEST-BACKLOG.md` (modified)
  - `finalreport.md` (modified)
- **Tests run with pass counts**: N/A (Documentation updates only; 989 automated tests previously verified)
- **Status**: COMPLETED
- **Decisions or problems**: None. Strictly maintained zero secret references in reports and logs.




### Task 12c-TEST-FIX-01: Time Log Date Boundary Test Stabilization
- **Date**: 2026-11-15
- **Day of week**: Sunday
- **Start time**: 02:10:38
- **End time**: 02:13:14
- **Step**: Step 12c (Test Suite Maintenance)
- **Task performed**:
  - Stabilized date range validation test in `apps/api/src/__tests__/timeLogs.test.ts` to be deterministic and independent of host wall-clock time.
  - Installed Vitest fake timers (`vi.useFakeTimers({ toFake: ['Date'] })`) set to `2026-11-13T06:00:00Z` (11:45 AM Asia/Kathmandu) in `beforeEach`, cleaned up in `afterEach` via `vi.useRealTimers()`.
  - Added explicit tests for exact boundary conditions under Asia/Kathmandu [-90 days, +1 day] window:
    - `+1 day` (`2026-11-14`): Allowed (`201 Created`).
    - `+2 days` (`2026-11-15`): Refused (`400 invalid_date_range`).
    - `-90 days` (`2026-08-15`): Allowed (`201 Created`).
    - `-91 days` (`2026-08-14`): Refused (`400 invalid_date_range`).
  - Audited all other test files in `apps/api` and `apps/web` for wall-clock date dependencies (verified safe).
- **Files created or changed**:
  - `apps/api/src/__tests__/timeLogs.test.ts` (modified)
  - `finalreport.md` (modified)
  - `docs/PROGRESS.md` (modified)
- **Tests run with pass counts**:
  - `apps/api`: 17 test files, 707 passed (0 failed).
  - `apps/web`: 14 test files, 282 passed (0 failed).
  - Total: 31 test files, 989 passed (0 failed).
  - Typecheck: 0 errors across `@imac/api`, `@imac/web`, `@imac/shared`.
- **Status**: COMPLETED
- **Decisions or problems**: None. Strictly test-only modifications; no route, service, schema or packages modified; zero uncommitted secrets.




### Task 12c-TEST-FIX-02: Shared Test Date Helper, Route Permission Date Stabilization & Comprehensive Audit (Items 10-12)
- **Date**: 2026-11-16
- **Day of week**: Monday
- **Start time**: 08:04:00
- **End time**: 08:18:00
- **Step**: Step 12c (Test Suite Maintenance)
- **Task performed**:
  - Item 10: Confirmed `apps/api/src/__tests__/projectRoutePermissions.test.ts` line 264 sent fixed `workDate: '2026-10-28'` to `POST /api/projects/:id/time-logs`. The route calls `validateKathmanduDateRange(workDate)` in `apps/api/src/services/workLog.ts`, enforcing `[-90 days, +1 day]` relative to Asia/Kathmandu today. Target date `2026-10-28` is 90 days in the past on `2027-01-26` and 91 days in the past on `2027-01-27` (`diffDays = -91 < -90`), returning `400 invalid_date_range` instead of `201 Created`. Fixed line 264 by deriving `workDate: getKathmanduDate(-1)` via shared test helper. Inspected lines 486 (`workDate: new Date('2026-10-28')` on `timeLog.findUnique`) and 494 (`dueDate: new Date('2026-11-01')` on `milestone.findUnique`); confirmed neither is checked against relative date ranges by route handlers or schemas, and left them unchanged.
  - Item 11: Created ONE small shared test helper in `apps/api/src/__tests__/testDateHelper.ts` implementing `getKathmanduDate(offsetDays, refDate)` and `getKathmanduToday(refDate)` using standard JavaScript `Intl.DateTimeFormat` (0 new packages). The helper does NOT freeze the clock by itself and dynamically respects both real wall-clock time and mocked Vitest system times. Integrated into `apps/api/src/__tests__/timeLogs.test.ts` for dynamic `todayStr` and exact boundary tests (`+1d`, `+2d`, `-90d`, `-91d`), and into `apps/api/src/__tests__/projectRoutePermissions.test.ts` line 264.
  - Item 12: Audited every test file sending fixed dates to API routes (`workLogs`, `workLogExport`, `workLogProjectLink`, `projects`, `tasks`), quoting applicable route/schema rules and determining calendar failure dates under unfrozen clocks:
    - `workLogs.test.ts`: lines 369, 509 (POST /api/work-logs expected 201) and lines 399, 425, 1349 (POST /api/work-logs expected 409) fail on 2027-01-26 when `2026-10-27` exceeds the 90-day past limit of `validateKathmanduDateRange`; line 312 (`2029-01-01`) fails on 2028-12-31 when it enters the +1 day future window; query routes (lines 146, 157, 1145, 1168, 1185, 1219) and middleware-blocked requests (lines 255, 273, 292, 1237, 1379) never fail.
    - `workLogExport.test.ts`: all fixed dates sent to `GET /api/work-logs/export` never fail (schema only validates format, `startDate <= endDate`, and `range <= 366 days`; no relative date checks).
    - `workLogProjectLink.test.ts`: lines 110, 132, 155, 179, 209 (POST /api/work-logs expected 400 invalid_project / invalid_task) and line 271 (expected 201) send `2026-10-29` and fail on 2027-01-28 when `validateKathmanduDateRange` rejects with 400 validation_error before project/task checks or draft insert; line 511 never fails.
    - `projects.test.ts`: all fixed dates sent to `POST /api/projects` and `PATCH /api/projects/:id` never fail (schema and route validate only `targetDate >= startDate`; no relative date checks).
    - `tasks.test.ts`: line 446 (`overdue=true`) explicitly freezes time to `2026-10-28T18:30:00Z` via `vi.setSystemTime` so it never fails; line 847 (`dueDate: '2026-11-30'` on milestones) never fails (milestones route does not restrict future/past dates).
  - Time-Travel Run Verification: Simulated time travel confirmed failures precisely match the audit predictions (no unexpected failures).
- **Files created or changed**:
  - `apps/api/src/__tests__/testDateHelper.ts` (created)
  - `apps/api/src/__tests__/projectRoutePermissions.test.ts` (modified)
  - `apps/api/src/__tests__/timeLogs.test.ts` (modified)
  - `finalreport.md` (modified)
  - `docs/PROGRESS.md` (modified)
- **Tests run with pass counts**:
  - `apps/api`: 17 test files, 707 passed (0 failed).
  - `apps/web`: 14 test files, 282 passed (0 failed).
  - Total: 31 test files, 989 passed (0 failed).
  - Typecheck: 0 errors across `@imac/api`, `@imac/web`, `@imac/shared`.
- **Status**: COMPLETED
- **Decisions or problems**: None. Strictly test files and documentation modified; no production code modified; no commits created.




### Task 12c-TEST-FIX-03: Final Round Date Stabilization, Kathmandu Midnight Tests & Comprehensive Verification
- **Date**: 2026-11-16
- **Day of week**: Monday
- **Start time**: 08:26:00
- **End time**: 08:33:00
- **Step**: Step 12c (Test Suite Maintenance)
- **Task performed**:
  - Frozen `Date` in `apps/api/src/__tests__/workLogs.test.ts` and `apps/api/src/__tests__/workLogProjectLink.test.ts` at `2026-10-30T06:00:00Z` in `beforeEach` (`toFake: ['Date']`), cleaned up in `afterEach` (`vi.useRealTimers()`).
  - Audited all date literals in both files: confirmed all valid date literals (`2026-10-27`, `2026-10-20`, `2026-10-28`, `2026-10-29`, `2026-10-01`, `2026-10-15`) fall comfortably inside the allowed window `[2026-08-01, 2026-10-31]`. The single far-future date `'2029-01-01'` (line 312 of `workLogs.test.ts`) remains $> 2$ years in the future under the frozen date and correctly asserts future rejection. No test meaning changed or required rewrite.
  - Quoted route code and execution order for line 180 of `workLogs.test.ts` (`date: '2026-10-27'`, unassigned role test), confirming `validateKathmanduDateRange` runs before `validateAssignedWorkRoles`.
  - Inspected edit window (`Date.now() - 2h`, `Date.now() - 30h`), session expiry (`Date.now() + 30m`), and optimistic concurrency locks; confirmed none are broken by the frozen clock because relative deltas against `Date.now()` evaluate identically.
  - Added two explicit Kathmandu midnight boundary tests in `apps/api/src/__tests__/timeLogs.test.ts`:
    - Frozen at `2026-11-13T18:14:00Z` (Kathmandu Nov 13 23:59): `2026-11-14` (+1d) allowed (`201 Created`), `2026-11-15` (+2d) refused (`400 invalid_date_range`).
    - Frozen at `2026-11-13T18:15:00Z` (Kathmandu Nov 14 00:00): `2026-11-15` (+1d) allowed (`201 Created`), `2026-11-16` (+2d) refused (`400 invalid_date_range`).
    - Stated exact UTC failure behavior to show tests catch any UTC-based implementation bugs.
  - Provided one-line verdicts for 10 web lib test files and 3 API test files regarding clock reads and explicit `today` parameters.
  - Conducted 120-day forward time-travel verification using an external setup file in `$env:TEMP` without modifying committed config or files. Verified 0 date-related failures across all 709 API tests. Cleaned up temp files and verified clean git status.
  - Ran full test suite across workspace: 17 API test files / 709 tests passed, 14 web test files / 282 tests passed (total 31 test files, 991 tests passed, 0 failed, 0 typecheck errors).
- **Files created or changed**:
  - `apps/api/src/__tests__/workLogs.test.ts` (modified)
  - `apps/api/src/__tests__/workLogProjectLink.test.ts` (modified)
  - `apps/api/src/__tests__/timeLogs.test.ts` (modified)
  - `apps/api/src/__tests__/projectRoutePermissions.test.ts` (modified)
  - `apps/api/src/__tests__/testDateHelper.ts` (created)
  - `docs/PROGRESS.md` (modified)
  - `finalreport.md` (modified)
- **Tests run with pass counts**:
  - `apps/api`: 17 test files, 709 passed (0 failed).
  - `apps/web`: 14 test files, 282 passed (0 failed).
  - Total: 31 test files, 991 passed (0 failed).
  - Typecheck: 0 errors across `@imac/api`, `@imac/web`, `@imac/shared`.
- **Status**: COMPLETED
- **Decisions or problems**: None. Strictly test files and documentation modified; no production code modified; no commits created.




### Task DEV-DEMO-DATA-01: Dev-Only Demo Data Tooling for apps/api
- **Date**: 2026-11-16
- **Day of week**: Monday
- **Start time**: 08:50:00
- **End time**: 08:59:00
- **Step**: Dev-only demo data tooling for apps/api (Generate realistic fake data for hand testing)
- **Task performed**:
  - Built pure environment guard (`apps/api/scripts/demoGuard.ts`) strictly enforcing safety boundaries:
    - Blocks execution if `NODE_ENV === 'production'`.
    - Blocks execution if `ALLOW_DEMO_DATA !== 'yes'`.
    - Blocks execution if database host is not `localhost` or `127.0.0.1`.
    - Blocks execution if database name does not contain `'demo'`.
    - Blocks execution if `'demo'` is present only in username, password, or host, but not in database name.
    - Blocks execution if `DEMO_PASSWORD` is shorter than the real system password policy length (`10` characters, derived from `SystemSetting` key `auth.minPasswordLength` and `apps/api/src/routes/auth.ts:179`).
    - Guard error messages strictly omit database URLs, usernames, passwords, and hostnames to guarantee zero secret leakage.
  - Built pure helper validators in `demoGuard.ts`:
    - Kathmandu date offset calculations across timezone midnight boundaries (`getKathmanduToday`, `getKathmanduOffsetDate`).
    - Planned time log validator (`validatePlannedTimeLogs`) enforcing Kathmandu `[-90, +1] days` window and $\le 24$h daily total cap per user.
    - Planned task dependency graph cycle detector (`validateDependencyGraph`) preventing self-dependencies and cyclic dependencies.
    - Pure deletion order validator (`validateDeletionOrder`) confirming every child entity precedes its parent in the 18-step deletion order `DEMO_DELETION_ORDER`.
  - Built pure demo data definitions (`apps/api/scripts/demoDataDefs.ts`):
    - 6 role-aligned demo personas (`demo_admin`, `demo_hr`, `demo_pm`, `demo_dev`, `demo_designer`, `demo_viewer`) with employee profiles, employee codes (`DEMO-ADM` through `DEMO-VW`), departments, standard shifts (8h/day, 5d/week), and availability statuses.
    - All demo users configured with login invariants: `isActive: true`, `mustChangePassword: false`, `failedLoginCount: 0`, and `lockedUntil: null` to allow direct login without forced password change.
    - 3 demo work roles prefixed with `[DEMO] `: `[DEMO] Full Stack Engineering`, `[DEMO] UI/UX Design`, `[DEMO] Project Coordination`.
    - 4 demo projects prefixed with `[DEMO] `:
      - `[DEMO] Nepal Disaster Relief Portal` (`on_track`) with Devanagari text (`नेपाल विपद् व्यवस्थापन पोर्टल`) and raw hostile text.
      - `[DEMO] Valley Transit App` (`at_risk`) with `ProjectStatusEvent` record explaining bus syndicate GPS telemetry latency.
      - `[DEMO] Heritage Preservation Archive` (`complete`) with `ProjectStatusEvent` record for archaeological photogrammetry sign-off.
      - `[DEMO] Solar Grid Micro-Management` (`on_hold`) with `ProjectStatusEvent` record for AEPC regulatory clearance.
    - Hostile test strings stored RAW:
      - `DEMO_HOSTILE_TITLE_200`: Exactly 200 characters containing raw unescaped `<script>alert(1)</script>` and `<b>bold</b>`.
      - `generateHostileMarkdown5000()`: Structured markdown document $\ge 5000$ characters containing tables, checklists, JSON payloads, and Devanagari Unicode.
    - "Former member" scenario: `demo_dev` added to `[DEMO] Nepal Disaster Relief Portal`, created tasks, comments, messages, and time logs, then `ProjectMember` row deleted within the transaction to verify historical contribution retention for revoked members.
    - 4 `WorkLogEntry` records linked to demo projects and tasks (`projectId` and `taskId` populated for valid members).
  - Built CLI scripts in `apps/api/scripts/`:
    - `demoSeed.ts`: Guard-validated, verifies no demo records exist, pre-hashes passwords with Argon2id prior to transaction opening, creates all records inside an atomic Prisma transaction with 120s timeout, and writes non-sensitive summary counts and UUIDs to `.demo-manifest.txt`.
    - `demoRemove.ts`: Guard-validated, deletes all demo records in strict 18-step reverse order inside an atomic Prisma transaction, and cleans up `.demo-manifest.txt`.
    - `demoStatus.ts`: Guard-validated, queries and displays active demo entity counts per table without logging secrets or IDs.
  - Added npm scripts to `apps/api/package.json`: `"demo:seed"`, `"demo:remove"`, `"demo:status"`.
  - Added `.demo-manifest.txt` and `apps/api/.demo-manifest.txt` to `.gitignore` and verified with `git check-ignore -v`.
  - Authored documentation in `apps/api/scripts/README.md` providing credential-safe PowerShell setup commands using regex extraction without printing passwords or URLs.
  - Authored comprehensive Vitest test suite in `apps/api/src/__tests__/demoData.test.ts` (27 tests covering guard conditions, date offsets, time log caps, dependency DAGs, deletion order integrity, hostile text length boundaries, and model specifications).
  - Confirmed `npm run build -w @imac/api` succeeds cleanly: `dist` contains no executable demo runner scripts (`demoSeed`, `demoRemove`, `demoStatus` are completely absent); only imported pure helpers (`demoGuard`, `demoDataDefs`) were emitted, and `dist` remains completely untracked by git.
  - Updated `docs/HAND-TEST-BACKLOG.md` with Demo Accounts table and 6 manual test procedures marked `NOT RUN` with roles and forbidden actions.
  - Updated `docs/PROGRESS.md` with full milestone specifications.
- **Files created or changed**:
  - `.gitignore` (modified)
  - `apps/api/package.json` (modified)
  - `apps/api/scripts/demoGuard.ts` (created)
  - `apps/api/scripts/demoDataDefs.ts` (created)
  - `apps/api/scripts/demoSeed.ts` (created)
  - `apps/api/scripts/demoRemove.ts` (created)
  - `apps/api/scripts/demoStatus.ts` (created)
  - `apps/api/scripts/README.md` (created)
  - `apps/api/src/__tests__/demoData.test.ts` (created)
  - `docs/HAND-TEST-BACKLOG.md` (modified)
  - `docs/PROGRESS.md` (modified)
  - `finalreport.md` (modified)
- **Tests run with pass counts**:
  - `apps/api`: 18 test files, 736 passed (0 failed) — +27 new tests.
  - `apps/web`: 14 test files, 282 passed (0 failed).
  - Total: 32 test files, 1,018 passed (0 failed).
  - Linter: clean across all workspaces (0 errors).
  - Typecheck: clean across all workspaces (0 errors).
- **Status**: COMPLETED
- **Decisions or problems**: None. Hard safety invariants strictly respected; no database connections made; no docker commands executed; no connection strings or passwords logged; no production code modified; no commits created.

---

### Task Demo-03: Deletion Order Rebuild, Schema Parser Strengthening, Boundary Lengths & Membership Verification
- **Date**: 2026-11-16
- **Day of week**: Monday
- **Start time**: 09:35
- **End time**: 09:47
- **Step**: Dev-Only Demo Data Tooling for apps/api (Safety & Schema Integrity Hardening)
- **Task performed**:
  - Rebuilt `DEMO_DELETION_ORDER` strictly from `schema.prisma`:
    - Removed `SystemSetting` and `WorkRole` (neither has a foreign key to a demo-owned model; `WorkRole` references nothing; `SystemSetting` has no foreign keys).
    - Included `AvailabilityStatus` with foreign key to `User`.
    - Corrected model and relation names to real Prisma entities: `EmployeeWorkRole` (not `EmployeeRoleAssignment`) and `WorkLogDay` referencing `EmployeeProfile`.
    - Documented all 16 models in `schema.prisma` with foreign keys to `User` (directly or through another listed model), showing their exact positions in `DEMO_DELETION_ORDER`.
  - Strengthened schema-parser test in `apps/api/src/__tests__/demoData.test.ts`:
    - Fails if any name in `DEMO_DELETION_ORDER` is not an active model in `schema.prisma`.
    - Fails if any model in `schema.prisma` with a required foreign key to a listed model is missing from `DEMO_DELETION_ORDER`.
    - Verified and printed all 29 relation pairs in `schema.prisma`, asserting that all children precede parents when both are listed.
  - Adjusted hostile markdown generator `generateHostileMarkdown5000()` to yield exactly 4,990 characters (at most 5,000, in range [4990, 5000]). Added explicit tests asserting long title is exactly 200 characters and long description is 4,990 to 5,000 characters.
  - Confirmed project roles across all demo definitions strictly match Prisma enum `ProjectRole` (`manager`, `member`, `viewer`), eliminating "contributor".
  - Audited and updated the 4 linked `WorkLogEntry` items in `demoDataDefs.ts` so every owner is a current member of the linked project:
    - Entry 1: `demo_dev` (-3d) -> `[DEMO] Valley Transit App` / `transit-1` (current member: YES)
    - Entry 2: `demo_dev` (-3d) -> `[DEMO] Valley Transit App` / `transit-2` (current member: YES)
    - Entry 3: `demo_dev` (-2d) -> `[DEMO] Solar Grid Micro-Management` / `solar-1` (current member: YES)
    - Entry 4: `demo_designer` (-1d) -> `[DEMO] Nepal Disaster Relief Portal` / `disaster-due-today` (current member: YES)
  - Verified `demo:remove` deletes strictly demo-scoped rows across all 18 deletion operations using explicit `where` clauses targeting demo IDs only.
- **Files created or changed**:
  - `apps/api/scripts/demoGuard.ts`
  - `apps/api/scripts/demoDataDefs.ts`
  - `apps/api/src/__tests__/demoData.test.ts`
  - `docs/PROGRESS.md`
  - `finalreport.md`
- **Tests run with pass counts**:
  - `apps/api`: 18 test files, 746 passed (0 failed) — +37 demo suite tests.
  - `apps/web`: 14 test files, 282 passed (0 failed).
  - Total: 32 test files, 1,028 passed (0 failed).
  - Linter: clean across all workspaces (0 errors).
  - Typecheck: clean across all workspaces (0 errors).
- **Status**: COMPLETED
- **Decisions or problems**: None. Zero database calls, zero docker executions, zero connection strings or passwords logged, zero git commits.



---

### Task Demo-02: Demo Data High-Volume Expansion, Prisma Deletion-Order Test & Build Isolation
- **Date**: 2026-11-16
- **Day of week**: Monday
- **Start time**: 09:10
- **End time**: 09:27
- **Step**: Dev-Only Demo Data Tooling for apps/api (High-Volume & Integrity Verification)
- **Task performed**:
  - Expanded demo dataset volume in `apps/api/scripts/demoDataDefs.ts` to satisfy full UI pagination and audit requirements:
    - Project 1 (`[DEMO] Nepal Disaster Relief Portal`): expanded to 59 tasks (exceeding >= 55) and 56 messages (exceeding >= 55) to test 50-item pagination ("Load more").
    - Across all demo projects: 66 tasks total, 64 messages total (with 2 pinned messages).
    - Fixed task categorization table: confirmed done tasks are not marked overdue (`disaster-1` is `done`); created real overdue incomplete tasks at -30d (`disaster-overdue-30`, `todo`), -7d (`disaster-overdue-7`, `blocked`), and -1d (`disaster-overdue-1`, `in_progress`).
    - Added due today task (`disaster-due-today`, `in_progress`), due tomorrow task (`disaster-due-tomorrow`, `in_progress`), no due date task (`disaster-nodate-1`, `todo`), member-created task (`disaster-member-created`, creator: `demo_designer`), subtasks, chain of three dependencies, and open prerequisite dependency.
    - Expanded time logs to 14 consecutive days (offsets -13 to 0) for `demo_dev`, `demo_designer`, and `demo_pm` in 0.25h steps respecting 24h daily cap and Kathmandu [-90, +1] window, including near-24h day (23.0h total) for `demo_dev` on offset -1.
    - Expanded work logs to exactly 10 days each for `demo_dev` and `demo_designer` across `approved`, `submitted`, `rejected` (with `rejectionReason`), and `draft` statuses, with 4 linked entries.
    - Updated `apps/api/scripts/demoSeed.ts` to handle `rejectionReason` on `workLogDay` and `completedAt` on `milestone`.
  - Configured `apps/api/tsconfig.build.json` excluding `scripts/` and `src/__tests__/` from API production build (`npm run build -w @imac/api`), ensuring zero demo scripts or definitions are emitted into `apps/api/dist/`. Confirmed `(Get-ChildItem -Recurse apps\api\dist -Filter '*demo*').Count` is 0.
  - Included `scripts` in `apps/api/tsconfig.json` so `npm run typecheck` validates `src/`, `prisma/`, and `scripts/`.
  - Added programmatic `schema.prisma` parser test in `apps/api/src/__tests__/demoData.test.ts` reading relations from the real schema file and verifying every child entity in `DEMO_DELETION_ORDER` precedes its parent.
  - Added test for empty / malformed database URL in `demoGuard.test.ts`. Total tests in `demoData.test.ts` increased from 27 to 35.
- **Files created or changed**:
  - `apps/api/package.json`
  - `apps/api/tsconfig.json`
  - `apps/api/tsconfig.build.json`
  - `apps/api/scripts/demoDataDefs.ts`
  - `apps/api/scripts/demoSeed.ts`
  - `apps/api/src/__tests__/demoData.test.ts`
  - `docs/PROGRESS.md`
  - `finalreport.md`
- **Tests run with pass counts**:
  - `apps/api`: 18 test files, 744 passed (0 failed) — +35 demo suite tests (+8 new tests in this pass).
  - `apps/web`: 14 test files, 282 passed (0 failed).
  - Total: 32 test files, 1,026 passed (0 failed).
  - Linter: clean across all workspaces (0 errors).
  - Typecheck: clean across all workspaces (0 errors).
- **Status**: COMPLETED
- **Decisions or problems**: None. Hard safety invariants strictly respected; no database connections made; no docker commands executed; no connection strings or passwords logged; no production code modified; no commits created.

---

### Task Demo-03: Deletion Order Rebuild, Schema Parser Strengthening, Boundary Lengths & Membership Verification
- **Date**: 2026-11-16
- **Day of week**: Monday
- **Start time**: 09:35
- **End time**: 09:47
- **Step**: Dev-Only Demo Data Tooling for apps/api (Safety & Schema Integrity Hardening)
- **Task performed**:
  - Rebuilt `DEMO_DELETION_ORDER` strictly from `schema.prisma`:
    - Removed `SystemSetting` and `WorkRole` (neither has a foreign key to a demo-owned model; `WorkRole` references nothing; `SystemSetting` has no foreign keys).
    - Included `AvailabilityStatus` with foreign key to `User`.
    - Corrected model and relation names to real Prisma entities: `EmployeeWorkRole` (not `EmployeeRoleAssignment`) and `WorkLogDay` referencing `EmployeeProfile`.
    - Documented all 16 models in `schema.prisma` with foreign keys to `User` (directly or through another listed model), showing their exact positions in `DEMO_DELETION_ORDER`.
  - Strengthened schema-parser test in `apps/api/src/__tests__/demoData.test.ts`:
    - Fails if any name in `DEMO_DELETION_ORDER` is not an active model in `schema.prisma`.
    - Fails if any model in `schema.prisma` with a required foreign key to a listed model is missing from `DEMO_DELETION_ORDER`.
    - Verified and printed all 29 relation pairs in `schema.prisma`, asserting that all children precede parents when both are listed.
  - Adjusted hostile markdown generator `generateHostileMarkdown5000()` to yield exactly 4,990 characters (at most 5,000, in range [4990, 5000]). Added explicit tests asserting long title is exactly 200 characters and long description is 4,990 to 5,000 characters.
  - Confirmed project roles across all demo definitions strictly match Prisma enum `ProjectRole` (`manager`, `member`, `viewer`), eliminating "contributor".
  - Audited and updated the 4 linked `WorkLogEntry` items in `demoDataDefs.ts` so every owner is a current member of the linked project:
    - Entry 1: `demo_dev` (-3d) -> `[DEMO] Valley Transit App` / `transit-1` (current member: YES)
    - Entry 2: `demo_dev` (-3d) -> `[DEMO] Valley Transit App` / `transit-2` (current member: YES)
    - Entry 3: `demo_dev` (-2d) -> `[DEMO] Solar Grid Micro-Management` / `solar-1` (current member: YES)
    - Entry 4: `demo_designer` (-1d) -> `[DEMO] Nepal Disaster Relief Portal` / `disaster-due-today` (current member: YES)
  - Verified `demo:remove` deletes strictly demo-scoped rows across all 18 deletion operations using explicit `where` clauses targeting demo IDs only.
- **Files created or changed**:
  - `apps/api/scripts/demoGuard.ts`
  - `apps/api/scripts/demoDataDefs.ts`
  - `apps/api/src/__tests__/demoData.test.ts`
  - `docs/PROGRESS.md`
  - `finalreport.md`
- **Tests run with pass counts**:
  - `apps/api`: 18 test files, 746 passed (0 failed) — +37 demo suite tests.
  - `apps/web`: 14 test files, 282 passed (0 failed).
  - Total: 32 test files, 1,028 passed (0 failed).
  - Linter: clean across all workspaces (0 errors).
  - Typecheck: clean across all workspaces (0 errors).
- **Status**: COMPLETED
- **Decisions or problems**: None. Zero database calls, zero docker executions, zero connection strings or passwords logged, zero git commits.



---

### Task Demo-04: Falsy Offset Fix, Work Log Validation, Deletion Order & Guard Tightening
- **Date**: 2026-11-16
- **Day of week**: Monday
- **Start time**: 14:45
- **End time**: 15:05
- **Step**: Dev-Only Demo Data Tooling for apps/api (Safety, Bug Fixes & Guard Hardening)
- **Task performed**:
  - **Falsy Coercion Bug Fix**: Fixed bug in `demoSeed.ts` where `dueDateOffsetDays ? ... : null` coerced offset `0` (due today) to `null`. Added pure helper `resolveOffsetDate(offsetDays, clockDate)` with explicit `!= null` checks, and audited all other numeric property accesses in `demoDataDefs.ts` and `demoSeed.ts` (`estimatedHours` now checks `!= null`). Added unit tests for `resolveOffsetDate` covering offsets `-30, -1, 0, +1, +30`, `undefined`, and `null`.
  - **Global Time Log & Planned Work Log Validation**:
    - Pre-validated aggregated time logs across all projects for the global 24-hour cap per user per day before beginning transaction, matching Kathmandu `[-90, +1]` window and 0.25h steps.
    - Implemented pure validator `validatePlannedWorkLogs(workLogs, roles, projects)` in `demoGuard.ts` enforcing: (1) max 1 day per user per date, (2) total entry hours $\le 24$ per day, (3) assigned work roles only for the user, and (4) valid project and task links where the user is an active member after former-member revocation. Added unit tests for valid configurations and failing cases for each rule.
  - **Deletion Order & demoRemove.ts Exact Alignment**:
    - Aligned `demoRemove.ts` and `DEMO_DELETION_ORDER` to the exact same 18-model list, placing `WorkRole` at index 3 (deleted by `name: { startsWith: '[DEMO] ' }` directly following dependent models `WorkLogEntry` and `EmployeeWorkRole`).
    - Added automated test reading `demoRemove.ts` source code and asserting that the exact sequence of `tx.<model>.deleteMany` calls matches `DEMO_DELETION_ORDER`.
    - Executed Prisma schema FK test confirming all 29 schema relations satisfy child-before-parent ordering.
  - **demoGuard Boundary Hardening**:
    - Enforced exact database name `imac_demo` (`pathname === 'imac_demo'`), rejecting names containing `demo` as a substring (e.g., `imac_demo_test`).
    - Refused database URLs containing query parameters that redirect target host: `host`, `hostaddr`, or `socket`.
    - Allowed missing port and non-5432 numeric ports; refused non-numeric ports.
    - Added `{ requirePassword: false }` option to `validateDemoEnvironment` so `demo:remove` and `demo:status` execute without requiring `DEMO_PASSWORD`. Added unit tests for all refusal and acceptance rules.
  - **Sanitized Error Output**:
    - Updated catch blocks across `demoSeed.ts`, `demoRemove.ts`, and `demoStatus.ts` to output formatted `${name}${code}: ${message}` strings, preventing raw error dump leaks.
  - **Schema & Datasource Invariant Verification**:
    - Verified `apps/api/prisma/schema.prisma` datasource block contains only standard PostgreSQL provider with `url = env("DATABASE_URL")` with zero shadow/direct database variables.
- **Files created or changed**:
  - `apps/api/scripts/demoGuard.ts`
  - `apps/api/scripts/demoSeed.ts`
  - `apps/api/scripts/demoRemove.ts`
  - `apps/api/scripts/demoStatus.ts`
  - `apps/api/src/__tests__/demoData.test.ts`
  - `docs/PROGRESS.md`
  - `finalreport.md`
- **Tests run with pass counts**:
  - `apps/api`: 18 test files, 760 passed (0 failed) — +51 demo suite tests (+14 new tests in this pass). Strictly above 746 requirement.
  - `apps/web`: 14 test files, 282 passed (0 failed).
  - Total: 32 test files, 1,042 passed (0 failed).
  - Linter: clean across all workspaces (0 errors).
  - Typecheck: clean across all workspaces (0 errors).
- **Status**: COMPLETED
- **Decisions or problems**: None. Zero database calls, zero docker executions, zero connection strings or passwords logged, zero git commits.


---

### Task Demo-05: Unified Demo Lookup, Strict URL Decoding, Offset Date Consistency & Full Seed Validation
- **Date**: 2026-11-16
- **Day of week**: Monday
- **Start time**: 15:25
- **End time**: 15:35
- **Step**: Dev-Only Demo Data Tooling for apps/api (Unified Lookup & End-to-End Validation)
- **Task performed**:
  - **Unified Demo Record Lookup & Task Equality**:
    - Created `apps/api/scripts/demoLookup.ts` exporting shared function `findDemoRecordIds(client: DemoLookupClient)` and re-exported it from `demoGuard.ts`.
    - Both `demoStatus.ts` and `demoRemove.ts` now call this single shared function, ensuring demo tasks are identified identically across both scripts:
      - Tasks belonging to demo projects (`projectId in demoProjectIds`)
      - Tasks created by demo users (`createdByUserId in demoUserIds`)
      - Tasks assigned to demo users (`assigneeUserId in demoUserIds`)
    - Added unit test simulating database state and verifying that `demoStatus.ts` task counts strictly equal the number of tasks deleted by `demoRemove.ts` (including tasks assigned to a demo user on a non-demo project).
  - **Guard Hardening (URL-Decoding & Whitespace Protection)**:
    - Added check refusing `DATABASE_URL` with leading or trailing whitespace.
    - Decoded pathname using `decodeURIComponent` before comparison, ensuring database name is strictly lowercase `imac_demo` without whitespace or encoded spaces.
    - Added unit tests verifying refusals for:
      - `DATABASE_URL` with trailing space in URL string
      - `DATABASE_URL` with `%20` (e.g. `/imac_demo%20`)
      - Empty `ALLOW_DEMO_DATA` (`''`)
      - Uppercase database name `"IMAC_DEMO"`
  - **Offset Date Consistency**:
    - Aligned `resolveOffsetDate` return type and implementation to return a `Date` object explicitly at UTC midnight for the Kathmandu calendar date (`new Date(Date.UTC(year, month - 1, day))`), or `null` if offset is `undefined`/`null`.
    - Audited and documented all call sites in `demoSeed.ts` (lines 286 and 314 for root task and subtask `dueDate`).
    - Added unit tests asserting that returned dates for offsets `-30, -1, 0, +1, +30` have `getUTCHours() === 0` and exact ISO `YYYY-MM-DDT00:00:00.000Z` formatting matching the Kathmandu date.
  - **End-to-End Full Seed Validation Test**:
    - Added comprehensive test in `apps/api/src/__tests__/demoData.test.ts` that builds the full real seed definitions and runs them through every validator:
      - Time logs from all projects aggregated together checked via `validatePlannedTimeLogs`
      - Planned work logs checked via `validatePlannedWorkLogs`
      - Dependency graphs across all projects checked via `validateDependencyGraph`
      - Hostile title length checked for exactly 200 characters
      - Hostile description length checked for range [4990, 5000]
      - Project member roles checked against real Prisma `ProjectRole` enum
- **Files created or changed**:
  - `apps/api/scripts/demoLookup.ts`
  - `apps/api/scripts/demoGuard.ts`
  - `apps/api/scripts/demoDataDefs.ts`
  - `apps/api/scripts/demoRemove.ts`
  - `apps/api/scripts/demoStatus.ts`
  - `apps/api/src/__tests__/demoData.test.ts`
  - `docs/PROGRESS.md`
  - `finalreport.md`
- **Tests run with pass counts**:
  - `apps/api`: 18 test files, 766 passed (0 failed) — +57 demo suite tests. Strictly above 760 requirement.
  - `apps/web`: 14 test files, 282 passed (0 failed).
  - Total: 32 test files, 1,048 passed (0 failed).
  - Linter: clean across all workspaces (0 errors).
  - Typecheck: clean across all workspaces (0 errors).
- **Status**: COMPLETED
- **Decisions or problems**: None. Hard safety invariants strictly respected; no database connections made; no docker commands executed; no connection strings or passwords logged; no production code modified; no commits created.

---

### Task Demo-06: Demo Data Fixes, Active Database Guard Assertion & Model Coverage Verification
- **Date**: 2026-11-17
- **Day of week**: Tuesday
- **Start time**: 09:30
- **End time**: 09:35
- **Step**: Demo-Data Fixes (apps/api/scripts and its tests only)
- **Task performed**:
  - **Type-Safe Re-Export and Import Correction**:
    - Separated re-export in `apps/api/scripts/demoGuard.ts` into value export for `findDemoRecordIds` and type-only export `export type { DemoRecordIds, DemoLookupClient } from './demoLookup.js'`.
    - Audited all imports across `apps/api/scripts/` to ensure type-only declarations are not imported or re-exported as runtime values.
    - Resolved runtime Node ESM missing-export SyntaxError when executing CLI tools under tsx.
  - **Active Database Safety Guard (`assertConnectedToDemoDatabase`)**:
    - Implemented `assertConnectedToDemoDatabase(prisma)` in `apps/api/scripts/demoGuard.ts` executing `SELECT current_database()` via `prisma.$queryRaw`.
    - Enforced strict invariants: exactly 1 row returned, exact column name `current_database`, exact value `"imac_demo"`, and sanitized error propagation preventing credential/URL exposure.
    - Integrated call into `demoSeed.ts`, `demoRemove.ts`, and `demoStatus.ts` immediately after `new PrismaClient()` in `try` blocks before any query or write.
    - Configured error handling in all 3 scripts to set `process.exitCode = 1` and guarantee `finally { await prisma.$disconnect(); }` execution.
    - Added unit tests covering refusal of non-demo db name `"imac"`, empty array `[]`, thrown query error (sanitized without leaks), wrong key name (e.g. `datname`), multi-row results, and acceptance of `"imac_demo"`.
  - **Header Comments & README Synchronization**:
    - Updated file headers in `demoGuard.ts`, `demoRemove.ts`, `demoStatus.ts`, and `demoSeed.ts` and `apps/api/scripts/README.md` to specify that the database name must be exactly `"imac_demo"` (not "contains demo") and that `DEMO_PASSWORD` is required only by `demoSeed.ts`.
  - **Schema Model Coverage Check**:
    - Inspected `apps/api/prisma/schema.prisma` verifying all 19 models (`User`, `EmployeeProfile`, `WorkRole`, `EmployeeWorkRole`, `Session`, `SystemSetting`, `AuditLog`, `AvailabilityStatus`, `WorkLogDay`, `WorkLogEntry`, `Project`, `ProjectMember`, `ProjectStatusEvent`, `Milestone`, `Task`, `TaskDependency`, `Comment`, `ProjectMessage`, `TimeLog`).
    - Confirmed `TaskStatusEvent` does not exist in `schema.prisma`.
    - Added dynamic test asserting every schema model is in `DEMO_DELETION_ORDER` or `NON_DEMO_MODELS` with documented reasons.
  - **CLI Process Execution & Static Scan Verification (Amendment B)**:
    - Layer 1: Child process test executing `tsx` on `demoStatus.ts`, `demoRemove.ts`, and `demoSeed.ts` with scrubbed environment, asserting graceful `REFUSED` output without `SyntaxError` or missing-export failures.
    - Layer 2: Static source scan checking all script files for export patterns with type-only identifiers.
  - **Documentation & Backlog**:
    - Appended correction note to `docs/PROGRESS.md`.
    - Appended manual test cases `TEST-DEMO-07` and `TEST-DEMO-08` marked `NOT RUN` to `docs/HAND-TEST-BACKLOG.md`.
- **Files created or changed**:
  - `apps/api/scripts/demoGuard.ts`
  - `apps/api/scripts/demoRemove.ts`
  - `apps/api/scripts/demoStatus.ts`
  - `apps/api/scripts/demoSeed.ts`
  - `apps/api/scripts/README.md`
  - `apps/api/src/__tests__/demoData.test.ts`
  - `docs/PROGRESS.md`
  - `docs/HAND-TEST-BACKLOG.md`
  - `finalreport.md`
- **Tests run with pass counts**:
  - `apps/api`: 18 test files, 779 passed (0 failed) — +13 new tests in `demoData.test.ts`.
  - `apps/web`: 14 test files, 282 passed (0 failed).
  - Total: 32 test files, 1,061 passed (0 failed).
  - Linter: clean across all workspaces (0 errors).
  - Typecheck: clean across all workspaces (0 errors).
- **Status**: COMPLETED
- **Decisions or problems**: None. Protected auth/session files untouched; no database connections made; no docker commands executed; no connection strings or passwords logged; no git commits created.

---

### Task Step-09a-Review: Daily Work Log Fixes (Project/Task Pickers, Hydration, Error Handling & Bullet Repair)
- **Date**: 2026-11-17
- **Day of week**: Tuesday
- **Start time**: 14:20:55 +05:45
- **End time**: 15:35:35 +05:45
- **Step**: Step 09a Review: Daily Work Log Fixes (apps/web only)
- **Task performed**:
  - **Project & Task Picker Integration (`ProjectTaskPicker.tsx` & `DailyWorkLogPage.tsx`)**:
    - Replaced free-text `projectId` and `taskId` input fields with dedicated `ProjectPicker` and `TaskPicker` components.
    - Project options come strictly from projects where caller is an active member with role `manager` or `member`.
    - Integrated "No project" and "No task" options, with dynamic task loading via `fetchAllTasksForProject` and automatic task reset upon project change.
    - If user has no eligible projects, both pickers are hidden from desktop table and mobile views.
    - Legacy free-text IDs are rendered read-only with a `"Legacy text"` badge and notice `"This text will be cleared when you save."` with a remove link, and dropped to `null` in write payloads.
    - Removed unused `fetchAllTasksForProject` import from `DailyWorkLogPage.tsx`.
  - **Error Translation & Window Expiration Handling (`resolveWorkLogError`)**:
    - Replaced `err.message || translateErrorCode(err)` with `resolveWorkLogError(err, translateCode, { onWindowExpired })`.
    - Ensures API error codes take precedence over axios error messages.
    - Configured strict network error / timeout detection (only missing response or `ECONNABORTED`).
    - Handled HTTP status codes (403 forbidden, 422 hour_mismatch).
    - Client-side thrown keys (`atLeastOneEntry`, `hoursPositive`, `validation_error`) are mapped to friendly localized strings and never leak raw keys.
    - Added fallback guaranteeing a string return in all cases.
  - **Load Error Resilience**:
    - When daily work log loading fails with any code other than 404 `profile_not_found`, an error card with a `Retry` button calling `refetchLog()` is displayed instead of an empty page.
  - **Hydration Stabilization**:
    - Extracted module constants `EMPTY_WORK_ROLES = []` and `EMPTY_MEMBER_PROJECTS = []` to prevent reference instability.
    - Removed `myRoles` from the hydration effect dependency array.
    - Protected user-typed entries via `hasUserTypedRows` against overwrites while roles load or after failed fetches.
  - **Small Fixes**:
    - Repaired garbled bullet character (`â€¢` -> `•`) in server warnings list.
    - Guarded date input change handler against empty strings, preventing invalid fetch calls.
  - **Documentation & Test Backlog**:
    - Appended correction note to `docs/PROGRESS.md` regarding Step 12a's previous picker claim on `DailyWorkLogPage.tsx`.
    - Added manual test cases `TEST-09A-09` and `TEST-09A-10` with comprehensive role-by-role scenarios (`demo_dev`, `demo_pm`, `demo_designer`, `demo_hr`, `demo_viewer`) marked `NOT RUN` to `docs/HAND-TEST-BACKLOG.md`.
- **Files created or changed**:
  - `apps/web/src/components/workLogs/ProjectTaskPicker.tsx`
  - `apps/web/src/pages/workLogs/DailyWorkLogPage.tsx`
  - `apps/web/src/lib/dailyWorkLogHelpers.ts`
  - `apps/web/src/lib/__tests__/dailyWorkLogHelpers.test.ts`
  - `apps/web/src/i18n/locales/en.json`
  - `docs/PROGRESS.md`
  - `docs/HAND-TEST-BACKLOG.md`
  - `finalreport.md`
- **Tests run with pass counts**:
  - `apps/web`: 15 test files, 312 passed (0 failed) — +30 new unit tests in `dailyWorkLogHelpers.test.ts`.
  - Monorepo: 33 test files, 1,091 passed (0 failed).
  - Linter: clean across all workspaces (0 errors).
  - Typecheck: clean across all workspaces (0 errors).
- **Status**: COMPLETED
- **Decisions or problems**: None. Apps/web only; zero backend edits made; zero new npm packages added; no database connections made; no docker commands executed; no git commits created.

---

### Task Step-09a-Review: Fix TaskPicker Hook Crash & Project Change Reset
- **Date**: 2026-11-19
- **Day of week**: Thursday
- **Start time**: 09:41:10 +05:45
- **End time**: 09:49:30 +05:45
- **Step**: Step 09a Review: Fix TaskPicker Hook Crash & Project Change Reset (apps/web only)
- **Task performed**:
  - **Hook Ordering Repair (`TaskPicker` in `ProjectTaskPicker.tsx`)**:
    - Hoisted `useQuery` unconditionally right after `useTranslation()`, eliminating the "Rendered more hooks than during the previous render" crash when switching from "No project" to a chosen project.
    - Pre-computed `hasChosenProject = Boolean(projectId && isValidUuid(projectId))` before the hook call, passing it to `enabled: hasChosenProject`.
    - Included `projectId` in the query key: `['projectTasks', projectId]`.
    - Positioned all early returns (`isLegacyText(taskId)`, `!hasChosenProject`, and `isReadOnly`) strictly after the hook invocation.
  - **Hooks Audit across `apps/web/src`**:
    - Checked `ProjectPicker` and `DailyWorkLogPage.tsx`: confirmed all hooks are called unconditionally at the top of components before any early returns.
    - AST-scanned all files across `apps/web/src` for hooks inside branches or following early returns: confirmed clean, noting pre-existing defensive check in `WorkLogSettingsPage.tsx` (left untouched per task scope).
  - **Project Change Reset & Pure Helper**:
    - Introduced pure helper `applyProjectChangeToRow` in `apps/web/src/lib/dailyWorkLogHelpers.ts` which sets `projectId` and enforces invariant `taskId = ''`.
    - Wired `DailyWorkLogPage.tsx` desktop table and mobile card `ProjectPicker.onChangeProject` to use `handleProjectChange`, which invokes `applyProjectChangeToRow`.
    - Added 5 unit tests for `applyProjectChangeToRow` in `apps/web/src/lib/__tests__/dailyWorkLogHelpers.test.ts`.
  - **Backlog Documentation**:
    - Added `TEST-09A-11` marked `NOT RUN` to `docs/HAND-TEST-BACKLOG.md` detailing the manual test steps and invariants for project selection dynamic hook stability and task reset.
- **Files created or changed**:
  - `apps/web/src/components/workLogs/ProjectTaskPicker.tsx`
  - `apps/web/src/pages/workLogs/DailyWorkLogPage.tsx`
  - `apps/web/src/lib/dailyWorkLogHelpers.ts`
  - `apps/web/src/lib/__tests__/dailyWorkLogHelpers.test.ts`
  - `docs/HAND-TEST-BACKLOG.md`
  - `finalreport.md`
- **Tests run with pass counts**:
  - `apps/web`: 15 test files, 317 passed (0 failed) — +5 new unit tests in `dailyWorkLogHelpers.test.ts`.
  - Monorepo: 33 test files, 1,096 passed (0 failed).
  - Linter: clean across all workspaces (0 errors).
  - Typecheck: clean across all workspaces (0 errors).
- **Status**: COMPLETED
- **Decisions or problems**: None. Apps/web only; zero backend edits made; zero new npm packages added; no database connections made; no docker commands executed; no git commits created. Vitest in `apps/web` does not mount DOM/components, so runtime component hook stability is covered via manual test scenario `TEST-09A-11`.

---

### Task Step-09a-Review: Daily Work Log Date-Change Hydration & Warnings List Bullet Fixes
- **Date**: 2026-11-20
- **Day of week**: Friday
- **Start time**: 09:44:15 +05:45
- **End time**: 09:56:45 +05:45
- **Step**: Step 09a Review: Daily Work Log Date-Change Hydration & Warnings List Bullet Fixes (apps/web only)
- **Task performed**:
  - **Date Change Hydration Bug Fix**:
    - Identified exact cause: hydration effect checked `hasUserTypedRows(prev)` without checking which date the rows belonged to. When switching from Date A to Date B (especially a blank unlogged day), the effect returned `prev` unchanged, preventing Date B from initializing a blank row or loading.
    - Implemented pure helper `shouldHydrateForDate(selectedDate, hydratedForDate, hasTypedRowsForThisDate)` in `apps/web/src/lib/dailyWorkLogHelpers.ts`. Enforced invariants: clearing date never hydrates (`false`); date change (`selectedDate !== hydratedForDate`) always permits hydration (`true`), so typed rows from another date do NOT block hydration; same date with typed rows blocks overwrite (`false`); same date without typed rows allows fresh data (`true`).
    - Added `hydratedForDate` state in `DailyWorkLogPage.tsx`. When `selectedDate !== hydratedForDate`, the previous day's rows are ALWAYS discarded and replaced with a fresh empty row for the new date (or server entries if already fetched), while still preserving user-typed rows on the SAME date while roles or the load are pending.
    - Added native `window.confirm(t('workLog.daily.discardPrompt'))` in `handleDateChange` to warn the user before discarding unsaved typed rows when switching dates.
    - Verified query key `['work-log', 'by-date', selectedDate]` includes the date; a failed load renders the dedicated error card with Retry and does NOT display the previous day's rows.
  - **Warnings List CSS Bullet Repair**:
    - Located real characters in `DailyWorkLogPage.tsx`: literal `•` (U+2022) at line 504 and encoding artifact comment `â€¢` at line 494.
    - Confirmed `en.json` contains NO bullet characters.
    - Replaced with standard HTML `<ul>` and `<li>` using Tailwind's `list-disc pl-4 space-y-0.5`.
    - Removed non-ASCII characters from `DailyWorkLogPage.tsx`, leaving 0 non-ASCII characters in the file.
  - **Non-ASCII Garble Audit**:
    - Scanned all files across `apps/web/src` for non-ASCII characters: reported all 25 hits across 11 files (box-drawing in comments, em-dashes `—`, times symbol `✕`, and bullets `•` in other pages).
    - Fixed only the files touched in this step (`DailyWorkLogPage.tsx`).
  - **Unit Testing**:
    - Added 7 unit tests in `apps/web/src/lib/__tests__/dailyWorkLogHelpers.test.ts` for `shouldHydrateForDate`.
  - **Backlog & Progress Updates**:
    - Updated `docs/PROGRESS.md` and root `PROGRESS.md` (including note for previous hook crash fix and current hydration fix).
    - Added manual test case `TEST-09A-12` marked `NOT RUN` to `docs/HAND-TEST-BACKLOG.md`.
- **Files created or changed**:
  - `apps/web/src/lib/dailyWorkLogHelpers.ts`
  - `apps/web/src/lib/__tests__/dailyWorkLogHelpers.test.ts`
  - `apps/web/src/pages/workLogs/DailyWorkLogPage.tsx`
  - `apps/web/src/i18n/locales/en.json`
  - `docs/PROGRESS.md`
  - `PROGRESS.md`
  - `docs/HAND-TEST-BACKLOG.md`
  - `finalreport.md`
- **Tests run with pass counts**:
  - `apps/web`: 15 test files, 324 passed (0 failed) — +7 new unit tests in `dailyWorkLogHelpers.test.ts`.
  - Monorepo: 33 test files, 1,103 passed (0 failed).
  - Linter: clean across all workspaces (0 errors).
  - Typecheck: clean across all workspaces (0 errors).
- **Status**: COMPLETED
- **Decisions or problems**: None. Apps/web only; zero backend edits made; zero new npm packages added; no database connections made; no docker commands executed; no git commits created. Honest disclaimer: Vitest in `@imac/web` runs in a Node environment without DOM/component rendering capabilities, so items 1-3 (date-change hydration, unsaved changes confirmation dialog, and CSS list bullet rendering) are verified via the manual hand-test scenario `TEST-09A-12`.

---

### Task Step-09a-Review: Comprehensive Review of Remaining Step 9a Screens (REPORT ONLY)
- **Date**: 2026-11-23
- **Day of week**: Monday
- **Start time**: 12:54:00 +05:45
- **End time**: 13:06:00 +05:45
- **Step**: Step 09a Review: Comprehensive Review of Remaining Step 9a Screens (apps/web only, REPORT ONLY)
- **Task performed**:
  - **Full Static Code Review**: Conducted complete code review across all remaining Step 9a screens and support modules:
    - `apps/web/src/pages/workLogs/WorkLogHistoryPage.tsx`
    - `apps/web/src/pages/workLogs/WorkLogExportPage.tsx`
    - `apps/web/src/pages/admin/WorkLogSettingsPage.tsx`
    - `apps/web/src/api/workLogs.ts`
    - `apps/web/src/api/settings.ts`
    - `apps/web/src/components/common/WorkLogStatusBadge.tsx`
    - `apps/web/src/lib/dateUtils.ts`
    - `apps/web/src/components/layout/AdminLayout.tsx`
    - `apps/web/src/components/layout/EmployeeLayout.tsx`
    - `apps/web/src/router/index.tsx`
  - **10 Inspection Categories Evaluated**:
    1. *Hooks Called Conditionally / After Early Returns*: Identified critical early return in `WorkLogSettingsPage.tsx:33-35` returning `<UnauthorizedPage />` prior to `useState`, `useQuery`, `useEffect`, `useMutation`.
    2. *Error Handling & Translation*: Identified raw `err.message` usage in `WorkLogSettingsPage.tsx:109` and missing error handling in `WorkLogHistoryPage.tsx:87`.
    3. *Silent Failed Loads Without Retry*: Identified `WorkLogHistoryPage.tsx` ignoring `isMonthError` and `isWeekError` (falsely rendering 0 hours / no logs), and `WorkLogSettingsPage.tsx` ignoring `isError` on `fetchSettings` (silently falling back to default form values).
    4. *Stale State on Filter Change*: Identified unvalidated `weekStartDate` input in `WorkLogHistoryPage.tsx:635` and background overwrite risk in `WorkLogSettingsPage.tsx:58-78`.
    5. *Date Handling & Timezones*: Verified `dateUtils.ts` Kathmandu today and UTC date arithmetic; identified `new Date()` parsing in `WorkLogExportPage.tsx:78-80` producing `NaN` on invalid manual input.
    6. *Default Value Hook Dependencies*: Found `data: settings = []` inline instantiation in `WorkLogSettingsPage.tsx:47, 78` dependency array.
    7. *Export File Downloads*: Evaluated blob error parsing, double-click protection (`disabled={isExporting}`), memory footprint, and filename safety (dates only, no user text).
    8. *Settings Administration*: Verified `system_admin` route guard, demo database 0-row default fallback, integer validation for edit window, and error alert rendering.
    9. *XSS, HTML Injection & Garble*: Verified zero occurrences of `dangerouslySetInnerHTML` or unescaped HTML; confirmed 100% i18n key existence in `en.json`; identified 3 literal em-dashes `—` (U+2014) in `WorkLogHistoryPage.tsx`.
    10. *Role-Based Refusal & Invariants*: Confirmed `hr_admin` cannot view administrative export filters, `system_admin` with no profile receives graceful empty profile card on daily work log, and `viewer` is read-only.
  - **Documentation & Backlog Updates**:
    - Appended review milestone summary to `docs/PROGRESS.md`.
    - Added test scenarios `TEST-09A-13`, `TEST-09A-14`, and `TEST-09A-15` marked `NOT RUN` to `docs/HAND-TEST-BACKLOG.md`.
- **Files created or changed**:
  - `docs/PROGRESS.md`
  - `docs/HAND-TEST-BACKLOG.md`
  - `finalreport.md`
- **Tests run with pass counts**:
  - Monorepo: 33 test files, 1,103 passed (0 failed).
  - Linter: clean across all workspaces (0 errors).
  - Typecheck: clean across all workspaces (0 errors).
- **Status**: COMPLETED
- **Decisions or problems**: None. REPORT ONLY mode strictly observed; zero code files modified; zero backend edits made; zero new npm packages added; no database connections made; no docker commands executed; no git commits created. Vitest in `apps/web` does not mount DOM components, so component hook violations, visual error card states, and file downloads are verified via manual test scenarios `TEST-09A-13`, `TEST-09A-14`, and `TEST-09A-15`.

---

### Task Step-09a-Files-Fix: Implementation of Confirmed Findings from Step 9a Review (apps/web only)
- **Date**: 2026-11-24
- **Day of week**: Tuesday
- **Start time**: 10:07:00 +05:45
- **End time**: 10:21:00 +05:45
- **Step**: Step 09a Files Review Fixes: WorkLogSettingsPage, WorkLogHistoryPage, WorkLogExportPage & getWorkLogErrorInfo (apps/web only)
- **Task performed**:
  - **Pure Functional Helpers & Unit Test Suite**:
    - Created `apps/web/src/lib/workLogReviewHelpers.ts` containing:
      - `isValidCalendarDate(dateStr)`: validates strict `YYYY-MM-DD`, month 1-12, and exact day bounds per month including leap years (`2024-02-29` valid, `2026-02-29` and `2026-02-31` invalid).
      - `resolveWorkLogErrorInfo(error)`: extracts error codes only when `data.error` is a non-empty string, maps missing response to `network_error`, resolves HTTP 403, 404, 401, `profile_not_found`, and provides localized message keys.
      - `shouldHydrateSettings(isHydrated, isDirty)`: protects typed form inputs from background refetches once edited.
      - `shouldUpdateWeekStartDate(newDate)`: rejects empty strings and whitespace.
    - Added 22 unit tests in `apps/web/src/lib/__tests__/workLogReviewHelpers.test.ts`.
  - **WorkLogSettingsPage Hardening (`apps/web/src/pages/admin/WorkLogSettingsPage.tsx`)**:
    - Moved all hooks above the role check so no hook is called after an early return.
    - If settings query fails (`isError`), renders an error card with Retry and does NOT render the form.
    - Renders form only when `isSuccess` is true; an empty list (`settings = []`) from a successful load shows defaults (`true`, `warn`, `24`), while loading, disabled, or failed queries never show the default form.
    - Used stable module-level constant `EMPTY_SETTINGS = []`.
    - State tracking for `isDirty` and `isHydrated`: hydration occurs once per load when unedited; `isDirty` resets on successful save and on Retry.
    - Save errors resolved with `resolveWorkLogErrorInfo` to render friendly translated messages (`common.networkError`, `common.forbidden`, etc.) rather than raw `err.message`.
  - **WorkLogHistoryPage Silent Failure & Date Guards (`apps/web/src/pages/workLogs/WorkLogHistoryPage.tsx`)**:
    - If month query fails (`isMonthError`) or week query fails (`isWeekError`), renders an error card with Retry (`refetchMonth()` / `refetchWeek()`) instead of 0 hours and "No work logs".
    - Week start date ignores empty string inputs (`shouldUpdateWeekStartDate`), and week query enforces `enabled: activeTab === 'week' && Boolean(weekStartDate && weekStartDate.trim().length > 0)`.
    - Em-dashes in titles were left untouched.
  - **WorkLogExportPage Calendar Date Validity & Roles Query Error State (`apps/web/src/pages/workLogs/WorkLogExportPage.tsx`)**:
    - Requires both dates to be valid calendar dates with `isValidCalendarDate` before checking date ordering and the 366-day limit, each check having its own translated error message.
    - Captured `isError` on `fetchMyWorkRoles` and added an inline error alert with a Retry button.
    - Added network error check on export download.
  - **Single Error Code Resolver Invariant & Dashboard Hardening**:
    - Updated `apps/web/src/api/workLogs.ts` (`getWorkLogErrorInfo`) to delegate directly to `resolveWorkLogErrorInfo`.
    - Checked all callers via `git grep` (`AdminDashboardPage.tsx`, `EmployeeDashboardPage.tsx`): added error blocks displaying translated error notifications on network and server outages rather than falling through to "not started / 0h logged".
  - **Localization Keys Added (`apps/web/src/i18n/locales/en.json`)**:
    - Added `common.networkError`, `common.networkErrorDesc`, `common.forbidden`.
    - Added `dashboard.logLoadError`, `dashboard.logLoadErrorDesc`.
    - Added `admin.settings.loadErrorTitle`, `admin.settings.loadErrorDesc`.
    - Added `workLog.history.monthLoadError`, `workLog.history.monthLoadErrorDesc`.
    - Added `workLog.history.weekLoadError`, `workLog.history.weekLoadErrorDesc`.
    - Added `workLog.export.errors.invalidDate`, `workLog.export.errors.rolesLoadError`.
  - **Backlog & Documentation**:
    - Appended milestone summary to `docs/PROGRESS.md`.
    - Added manual test scenarios `TEST-09A-FIX-01`, `TEST-09A-FIX-02`, `TEST-09A-FIX-03`, and `TEST-09A-FIX-04` marked `NOT RUN` to `docs/HAND-TEST-BACKLOG.md`.
- **Files created or changed**:
  - `apps/web/src/lib/workLogReviewHelpers.ts`
  - `apps/web/src/lib/__tests__/workLogReviewHelpers.test.ts`
  - `apps/web/src/api/workLogs.ts`
  - `apps/web/src/pages/admin/WorkLogSettingsPage.tsx`
  - `apps/web/src/pages/workLogs/WorkLogHistoryPage.tsx`
  - `apps/web/src/pages/workLogs/WorkLogExportPage.tsx`
  - `apps/web/src/pages/dashboard/AdminDashboardPage.tsx`
  - `apps/web/src/pages/dashboard/EmployeeDashboardPage.tsx`
  - `apps/web/src/i18n/locales/en.json`
  - `docs/PROGRESS.md`
  - `docs/HAND-TEST-BACKLOG.md`
  - `finalreport.md`
- **Tests run with pass counts**:
  - `apps/api`: 18 test files, 779 passed (0 failures).
  - `apps/web`: 16 test files, 346 passed (0 failures) — +22 new tests in `workLogReviewHelpers.test.ts`.
  - Monorepo: 34 test files, 1,125 passed (0 failures).
  - Linter: clean across all workspaces (0 errors).
  - Typecheck: clean across all workspaces (0 errors).
  - Production build: `npm run build --workspace=apps/web` passed in 8.07s.
- **Status**: COMPLETED
- **Decisions or problems**: None. Apps/web only; zero backend edits made; zero new npm packages added; no database connections made; Daily Work Log files untouched; em-dashes left alone; no git commits created. Honest disclaimer: Vitest in `apps/web` runs in Node and tests pure logic/helpers; React component lifecycle ordering, visual error cards, and interactive form behaviors are verified via manual test scenarios `TEST-09A-FIX-01` through `TEST-09A-FIX-04`.

---

## Step 19a: Audit Log Read API (apps/api only, no screen)

### Task 19a-01: Audit Log Read API Implementation, Permissions, Snapshot Sanitization, and Tests
- **Date**: 2026-11-24
- **Day of week**: Tuesday
- **Start time**: 12:05:00 +05:45
- **End time**: 12:31:00 +05:45
- **Step**: Step 19a (Audit Log Read API in apps/api, no screen)
- **Task performed**:
  - Researched existing models, snapshots, entityTypes, and actions in schema and routes. Reported in plan:
    - Real `AuditLog` fields: `id`, `createdAt`, `action`, `entityType`, `entityId`, `actorUserId`, `beforeSnapshot`, `afterSnapshot`.
    - Real snapshot contents for `time_log.created` (contains `projectId`), `time_log.updated` (does not contain `projectId`, mapped by live `TimeLog.id` join), and `time_log.removed` (deleted row without `projectId`, classified as `ADMIN_ONLY_ACTIONS`).
    - Normalized casing for `task` and `Task`.
    - Identified that `project_member` entityId is `projectId`, `task_dependency` entityId is `taskId`, `comment` entityId is `commentId`.
  - Added new action `auditlog:readProject` to `Action` in `apps/api/src/lib/permissions.ts`, allowed for `system_admin` and `project_manager`. Kept `auditlog:read` untouched (`system_admin` only). Denied to `hr_admin`, `employee`, and `viewer`.
  - Implemented `GET /api/audit-logs` in `apps/api/src/routes/auditLogs.ts` mounted at `/api/audit-logs` in `apps/api/src/app.ts`:
    - Strict `can(user, 'auditlog:readProject')` guard. Identity solely from session.
    - Zod query parameter validation: `from` and `to` (Asia/Kathmandu calendar dates, default 30 days, exclusive upper bound `createdAt < startOfDay(to + 1)`), `actorUserId` (uuid), `action` (known list), `entityType` (known list), `projectId` (uuid; for `project_manager`, must be an actively managed project, otherwise returns 404 `not_found`), `limit` (default 50, max 100), `offset` (default 0; non-negative int, 0 accepted).
    - Empty strings strictly rejected with HTTP 400 `validation_error`.
    - Database-level project scoping for `project_manager` using `Prisma.sql` and `Prisma.join` on project IDs where `userId = caller.id AND isActive = true AND projectRole = 'manager'`.
    - Amendment F: if `project_manager` filters by an `entityType` or `action` outside project entities, returns `{ items: [], total: 0, limit, offset }` with HTTP 200 without throwing 403 or leaking data.
    - Privacy & Sanitization (Amendment C): Created `SYSTEM_ADMIN_ALLOW_LIST` (excludes `reason`, `body`, `note`, `description`, `comment`, `message`, `password`, `token`, `hash`, `secret`, `ip`, `userAgent`) and `PROJECT_MANAGER_ALLOW_LIST` (narrow project allow-list, stripping administrative fields `employeeCode`, `department`, `jobTitle`, `systemRole`, `lockedUntil`, `failedLoginCount`, and `reason`).
    - Actor mapped strictly to `{ id, displayName, username }` (placeholder `{ id, displayName: "Deleted User", username: "deleted" }` for null/deleted actors).
    - Read-only invariant: no `POST`, `PUT`, `PATCH`, `DELETE` routes on `/api/audit-logs` (return 404). Reading the audit log does NOT create any audit log entries.
  - Created read-only check script in `docs/audit-log-manager-project-check.sql` for static evaluation on `imac_demo` (read-only, not executed against live DB).
  - Wrote 26 automated integration and security tests in `apps/api/src/__tests__/auditLogs.test.ts` (including static scan tests for Amendment D verifying no `$queryRawUnsafe` or string interpolation, and Amendment G verifying every written entityType is classified).
  - Added 2 policy matrix tests in `apps/api/src/__tests__/permissions.test.ts` covering all 5 roles for `auditlog:read` and `auditlog:readProject`.
  - Updated documentation: added policy Question 38 to `docs/open-policy-questions.md`, appended manual test steps `TEST-19A-01` to `TEST-19A-05` marked `NOT RUN` in `docs/HAND-TEST-BACKLOG.md`, and appended milestone to `docs/PROGRESS.md`.
- **Files created or changed**:
  - `apps/api/src/lib/permissions.ts`
  - `apps/api/src/routes/auditLogs.ts`
  - `apps/api/src/app.ts`
  - `docs/audit-log-manager-project-check.sql`
  - `apps/api/src/__tests__/auditLogs.test.ts`
  - `apps/api/src/__tests__/permissions.test.ts`
  - `docs/open-policy-questions.md`
  - `docs/HAND-TEST-BACKLOG.md`
  - `docs/PROGRESS.md`
  - `finalreport.md`
- **Tests run with pass counts**:
  - `apps/api`: 19 test files passed, **807 tests passed (0 failures)** (+26 new tests in `auditLogs.test.ts`, +2 new tests in `permissions.test.ts`).
  - `apps/web`: 16 test files passed, **346 tests passed (0 failures)**.
  - Full suite (`npm run test`): **35 test files passed, 1,153 tests passed (0 failures)**.
  - Linter (`npm run lint`): Passed across all workspaces (0 errors).
  - Typecheck (`npm run typecheck`): Passed across all workspaces (0 errors).
- **Status**: COMPLETED
- **Decisions or problems**:
  - Time log mapping: `TimeLog.taskId` is optional in the schema. In `time_log.created`, snapshot contains `projectId`. In `time_log.updated`, snapshot lacks `projectId`, so it is mapped via live join on `TimeLog.id`. In `time_log.removed`, the row is physically deleted and the snapshot does not contain `projectId`, so it cannot be mapped reliably to a project and is classified as admin-only.
  - Free-text `reason`: Removed from both `SYSTEM_ADMIN_ALLOW_LIST` and `PROJECT_MANAGER_ALLOW_LIST` to prevent leaking unvetted user input.
  - Mock limitations: Database operations are mocked using Vitest spies. PostgreSQL JSON extraction performance (e.g. `beforeSnapshot->>'projectId'`) and engine-level timezone conversions cannot be verified via in-memory mocks.
  - Protected files (`password.ts`, `session.ts`, `auth.ts`, `routes/auth.ts`, and `prisma/*`) were untouched; no schema changes; no migrations run; no new npm packages installed; no git commits executed.

---

## Step 19a-fix: Corrections to Audit Log Router (apps/api only)

### Task 19a-fix-01: Audit Log Router Hardening, Parameter Validation, Fail-Closed Security, and Guard Tests
- **Date**: 2026-11-24
- **Day of week**: Tuesday
- **Start time**: 12:45:00 +05:45
- **End time**: 12:59:00 +05:45
- **Step**: Step 19a-fix (Corrections to apps/api/src/routes/auditLogs.ts)
- **Task performed**:
  - Item 1 (Project Manager Leak Boundary): Added outer SQL condition joined with `AND` to the project-scope block for `project_manager`: `a."entityType" IN (PROJECT_MAPPABLE_ENTITY_TYPES) AND a."action" IN (PROJECT_ACTIONS)` as bound parameters. Guaranteed that generic beforeSnapshot/afterSnapshot projectId clauses never match `work_log.*`, `user.*`, `auth.*`, `settings.*`, `work_role.*`, or `employee_profile.*` rows. Added test asserting bound conditions in `$queryRaw` query strings and values, and unit test proving `work_log.edited_after_submit` with a snapshot `projectId` is strictly excluded from the project_manager scope definition.
  - Item 2 (`time_log.removed` Decision): Inspected `apps/api/src/routes/timeLogs.ts` line 559. Confirmed `beforeSnapshot` records only `{ taskId, workDate, hours }` and lacks `projectId`. Because the row is deleted and `taskId` is optional, it cannot be mapped to a project. Kept `time_log.removed` strictly in `ADMIN_ONLY_ACTIONS` and excluded from `PROJECT_ACTIONS`.
  - Item 3 (Query Parameters): Enforced that every query parameter must be a plain string. Arrays (`?from=a&from=b`) and objects return HTTP 400 `validation_error`. Guaranteed `.trim()` is never called on non-strings. Added tests for all 8 parameters (`from`, `to`, `actorUserId`, `action`, `entityType`, `projectId`, `limit`, `offset`).
  - Item 4 (Fail Closed): Added explicit `else` branch returning HTTP 403 `forbidden` after role branches, preventing unexpected or unrecognized caller roles from executing unscoped database queries. Added test verifying fail-closed defense.
  - Item 5 (UUID & ASCII): Replaced local `UUID_REGEX` with `isValidUuid` imported from `apps/api/src/services/projectAccess.ts` (accepting any RFC UUID). Replaced all Unicode box-drawing characters with plain ASCII `--` comments in `auditLogs.ts` and `auditLogs.test.ts`.
  - Item 6 (Answers & Guard Tests):
    - Answered 6a with file and line numbers for `time_log.created`, `.updated`, and `.removed`.
    - Answered 6b with file and line numbers for `project_member.added`/`.removed` and `task_dependency.*`.
    - Answered 6c explaining why `routeInventory.test.ts` (scoped to 37 `/api/projects/*` routes) and `projectRoutePermissions.test.ts` (scoped to mutating project routes) did not originally cover `GET /api/audit-logs`. Added `GET /api/audit-logs` guard tests to both test suites.
  - Item 7 (SQL Check File): Added query 4 to `docs/audit-log-manager-project-check.sql` (read-only, `imac_demo` only) counting AuditLog rows whose entityType is NOT project-mappable but whose snapshot projectId matches a target project.
  - Verification: Ran full test suite, lint, and typecheck. Appended `TEST-19A-FIX-01` to `TEST-19A-FIX-03` to `docs/HAND-TEST-BACKLOG.md` and appended milestone to `docs/PROGRESS.md`.
- **Files created or changed**:
  - `apps/api/src/routes/auditLogs.ts`
  - `apps/api/src/__tests__/auditLogs.test.ts`
  - `apps/api/src/__tests__/routeInventory.test.ts`
  - `apps/api/src/__tests__/projectRoutePermissions.test.ts`
  - `docs/audit-log-manager-project-check.sql`
  - `docs/HAND-TEST-BACKLOG.md`
  - `docs/PROGRESS.md`
  - `finalreport.md`
- **Tests run with pass counts**:
  - `apps/api`: 19 test files passed, **819 tests passed (0 failures)** (+5 new tests in `auditLogs.test.ts`, +2 in `routeInventory.test.ts`, +5 in `projectRoutePermissions.test.ts`).
  - `apps/web`: 16 test files passed, **346 tests passed (0 failures)**.
  - Monorepo total: **35 test files passed, 1,165 tests passed (0 failures)**.
  - `npm run lint`: clean across all workspaces (0 errors).
  - `npm run typecheck`: clean across all workspaces (0 errors).
- **Status**: COMPLETED
- **Decisions or problems**:
  - `time_log.removed` has no `projectId` in its snapshot and the DB row is deleted, so it remains strictly in `ADMIN_ONLY_ACTIONS`.
  - Zero database connections or scripts executed; no schema changes; protected files untouched; no git commits.

---

## Step 19a Docs & QA Backlog: Live Test Procedures & Scoping Decisions (Docs Only)

### Task 19a-doc-01: Documentation of Live Tests, Scoping Policies & QA Session Backlog
- **Date**: 2026-11-24
- **Day of week**: Tuesday
- **Start time**: 13:26:00 +05:45
- **End time**: 13:30:00 +05:45
- **Step**: Step 19a Documentation & QA Session Backlog (Docs Only)
- **Task performed**:
  - Appended live manual test scenarios to `docs/HAND-TEST-BACKLOG.md` (all marked `NOT RUN`):
    - `LIVE-19A-01`: `demo_pm` opens `/api/audit-logs`, expecting HTTP 200 with `{ items, total, limit, offset }` and no 500 (proving PostgreSQL ANY array binding).
    - `LIVE-19A-02`: `demo_pm` queries `?projectId=` on managed project (200 JSON), unmanaged project (404 `not_found`), and duplicate array query `?from=a&from=b` (400 `validation_error`).
    - `LIVE-19A-03`: Leak test: `demo_dev` edits a submitted work log linked to a managed project; `demo_pm` must NOT see that `work_log.edited_after_submit` row, while `system_admin` (`boss`) must see it. Documented note that the 3 seeded `work_log.edited_after_submit` rows have a null `projectId` and prove nothing about the leak fix.
    - `LIVE-19A-04`: Verification that `demo_dev` and `demo_hr` receive HTTP 403 `forbidden`.
    - `LIVE-19A-05`: As `demo_pm`, create a task with a description and a project message with body text; verify audit snapshots contain no description or message text.
  - Appended policy decisions to `docs/open-policy-questions.md` (Item 39) and `docs/PROGRESS.md`:
    - Documented that `time_log.removed` is admin-only because the DB row is deleted, snapshot lacks `projectId`, and `taskId` is optional.
    - Documented that `time_log.updated` entries for taskless time logs rely on a live SQL subquery join on `TimeLog.id` and are thus only visible to managers while the time log still exists in the database.
  - Added QA Session Section to `docs/open-policy-questions.md` and `docs/PROGRESS.md`:
    - Detailed list of automated Playwright tests to write.
    - Casing check for `project`, `milestone`, and `comment` entityTypes ensuring they are written in lowercase as expected by manager filter SQL.
  - Strictly docs only: zero code edited, zero scripts run, zero database connections made, and no git commits executed.
- **Files created or changed**:
  - `docs/HAND-TEST-BACKLOG.md`
  - `docs/open-policy-questions.md`
  - `docs/PROGRESS.md`
  - `finalreport.md`
- **Tests run with pass counts**:
  - Pure documentation updates; no code changes. Previous test run: 35 test files passed, 1,165 passed (0 failures).
- **Status**: COMPLETED
- **Decisions or problems**:
  - The 3 seeded `work_log.edited_after_submit` rows in `prisma/seed.ts` have `projectId = null`, so testing the leak boundary requires editing a submitted work log that is actually linked to a project ID.




---

## Step 19b: System Audit Log Screen (apps/web only, Admin-Only)

### Task 19b-01: Audit Log Screen, Filter Controls, Snapshot Inspector, RBAC Route Guard & Integration Tests
- **Date**: 2026-11-24
- **Day of week**: Tuesday
- **Start time**: 14:15:00 +05:45
- **End time**: 14:38:00 +05:45
- **Step**: Step 19b (Audit Log screen - apps/web only, ADMIN-ONLY for now)
- **Task performed**:
  - Implemented `apps/web/src/constants/auditLogs.ts` synchronizing all constant arrays with `apps/api/src/routes/auditLogs.ts`: `PROJECT_ACTIONS` (24), `ADMIN_ONLY_ACTIONS` (21), `ALL_KNOWN_ACTIONS` (45), `PROJECT_MAPPABLE_ENTITY_TYPES` (7), `ADMIN_ONLY_ENTITY_TYPES` (7), `ALL_KNOWN_ENTITY_TYPES` (14).
  - Implemented `apps/web/src/lib/auditLogHelpers.ts`:
    - `buildAuditLogQueryParams`: clean query string generation, strips undefined/null/empty strings, preserves `offset: 0` without falsy drop.
    - `validateAuditDateRange`: calendar date validation rejecting impossible dates (`2026-02-31`) and enforcing `to >= from`.
    - `formatPaginationSummary`: computes page ranges and navigation flags (`hasPrev`, `hasNext`).
    - `truncateSnapshotValue` & `formatSnapshotText`: truncates string values > 2000 chars with ` ... [truncated]` indicator; renders plain-text formatted JSON.
    - `resolveAuditLogError`: reuses `resolveWorkLogErrorInfo` for error classification, mapping classes to audit-specific keys under `admin.auditLog.errors.*` (avoiding any work-log review wording, Amendment C).
  - Implemented `apps/web/src/api/auditLogs.ts`: `fetchAuditLogs(params)` targeting `GET /api/audit-logs`.
  - Implemented `apps/web/src/pages/admin/AuditLogPage.tsx`:
    - Unconditional hook placement: `useTranslation`, `useAuth`, `useState` (filters, offset, expandedRowId), `useQuery` for users and audit logs.
    - In-page RBAC guard: renders `<UnauthorizedPage />` if caller is not `system_admin`.
    - Filters: From/To date pickers with Kathmandu defaults (`addDays(getKathmanduToday(), -30)` and `getKathmanduToday()`), Action dropdown (45 items), Entity Type dropdown (14 items), Actor dropdown (`fetchAdminUsers()`, unpaginated, showing active and inactive users with `(inactive)` label and helper text, Amendment D), Reset Filters button.
    - Changing any filter resets `offset` to 0 and collapses expanded rows.
    - Dual responsive display: full desktop `<table>` (>=640px) and stacked card list (<640px) preventing horizontal overflow.
    - Snapshot detail inspector: expandable row/card with Before and After snapshot JSON rendered inside scrollable `<pre>` blocks (`overflow-auto max-h-60 border font-mono whitespace-pre-wrap break-all`). Strict text rendering without script execution.
    - Loading spinner, friendly error card with "Retry" button, and empty state message.
    - Pagination controls with "Previous", "Next", and "Showing X-Y of Z".
  - Updated `AdminLayout.tsx`: enabled Audit Log navigation item with `visible: isSystemAdmin` (hidden for `hr_admin` and all non-admin roles).
  - Updated `router/index.tsx`: registered `/admin/audit-log` under `<ProtectedRoute allowedRoles={['system_admin']} />` rendering `<AuditLogPage />`.
  - Added localization in `apps/web/src/i18n/locales/en.json` under `"admin.auditLog"`.
  - Added unit test suite `apps/web/src/lib/__tests__/auditLogHelpers.test.ts` (25 tests):
    - Amendment A & B: Reads `apps/api/src/routes/auditLogs.ts` as text, extracts `ALL_KNOWN_ACTIONS` and `ALL_KNOWN_ENTITY_TYPES`, asserting `length > 0` and bidirectional synchronization.
    - Unit tests for query param building, date validation, pagination formatting, snapshot truncation (including 5000-char string and `<script>` sanitization), and error resolution (verifying 403 maps to audit text, not work log text).
  - Updated route test suite `apps/web/src/router/__tests__/routes.test.ts` (17 tests):
    - Tested `/admin/audit-log` resolves concrete route.
    - Tested `allowedRoles` strictly allows `['system_admin']`, denying `hr_admin`, `project_manager`, `employee`, and `viewer`.
    - Tested `getAdminNavItems(true)` shows Audit Log, while `getAdminNavItems(false)` hides it.
  - Verification: Ran `npm run test` (all web tests 373 passed; api tests 819 passed), `npm run lint` (0 errors), `npm run typecheck` (0 errors across all workspaces), and `npm run build --workspace=apps/web` (built cleanly in 17.25s).
- **Files created or changed**:
  - `apps/web/src/constants/auditLogs.ts`
  - `apps/web/src/lib/auditLogHelpers.ts`
  - `apps/web/src/api/auditLogs.ts`
  - `apps/web/src/pages/admin/AuditLogPage.tsx`
  - `apps/web/src/components/layout/AdminLayout.tsx`
  - `apps/web/src/router/index.tsx`
  - `apps/web/src/i18n/locales/en.json`
  - `apps/web/src/lib/__tests__/auditLogHelpers.test.ts`
  - `apps/web/src/router/__tests__/routes.test.ts`
  - `docs/HAND-TEST-BACKLOG.md`
  - `docs/PROGRESS.md`
  - `finalreport.md`
- **Tests run with pass counts**:
  - `apps/web`: 17 test files passed, **373 tests passed (0 failures)** (+25 in `auditLogHelpers.test.ts`, +2 in `routes.test.ts`).
  - `apps/api`: 19 test files passed, **819 tests passed (0 failures)**.
  - `npm run lint`: clean across all workspaces (0 errors).
  - `npm run typecheck`: clean across all workspaces (0 errors).
  - `npm run build --workspace=apps/web`: clean production build (0 errors).
- **Status**: COMPLETED
- **Decisions or problems**:
  - `fetchAdminUsers()` returns all users without pagination or active filter; inactive accounts are labeled `(inactive)` with an explanatory note below the actor select.
  - Protected files (`password.ts`, `session.ts`, `auth.ts`, `routes/auth.ts`, and `prisma/*`) were untouched; zero edits to `apps/api`, `packages/shared`, or `package-lock.json`; no git commits executed.

---

## Step 17a: Notifications Data Model and Read API (apps/api only)

### Task 17a-01: Data Model, Privacy Sanitizer, Router, Transaction Helpers, Demo Tooling & Integration Tests
- **Date**: 2026-11-24
- **Day of week**: Tuesday
- **Start time**: 14:55:00 +05:45
- **End time**: 15:22:00 +05:45
- **Step**: Step 17a (Notifications data model and read API — apps/api only, no screen, no triggers)
- **Task performed**:
  - Item 1 (Model Notification): Added `Notification` model to `apps/api/prisma/schema.prisma` with `id` (uuid), `userId` (FK to User, onDelete Restrict, indexed), `type`, optional `entityType`, optional `entityId`, optional `projectId` (plain string), `payload` (`Json @default("{}")`), optional `readAt`, `createdAt`, composite index `@@index([userId, readAt, createdAt])`, and added relation `notifications Notification[]` on `User`. Validated schema with `npx prisma validate` and generated Prisma Client with `npx prisma generate`. Zero migration folders created; zero migrate commands run; zero database connections made.
  - Item 2 & Amendment A/B (Payload Sanitizer): Implemented `sanitizeNotificationPayload` in `apps/api/src/services/notifications.ts` using strict allow-list `NOTIFICATION_PAYLOAD_ALLOW_LIST`. Dropped all keys not on the allow-list (no block-list). Allowed primitive types: string, number, boolean, null. Nested objects and arrays dropped. Strings capped at 200 characters. Preserved `actorUserId` and omitted `actorDisplayName`/`actorUsername` because user display names and usernames go stale over time. Forbidden keys (`body`, `commentBody`, `messageBody`, `description`, `note`, `reason`, `password`) strictly dropped.
  - Item 3 & Amendment G (Transaction Helpers): Implemented `createNotification(tx, input)` and `createNotifications(tx, inputs)` typed with `NotificationPrismaClient` accepting both `PrismaClient` and `Prisma.TransactionClient` (no `any`). Added self-notification filter (`actorUserId === userId` skipped) and recipient deduplication. Wired zero triggers into existing routes.
  - Item 4 (Permissions): Added actions `notification:read` and `notification:update` in `apps/api/src/lib/permissions.ts` granted to all five system roles (`system_admin`, `hr_admin`, `project_manager`, `employee`, `viewer`). Changed nothing else in `permissions.ts`.
  - Item 5 & Amendments D/E/F (Routes under `/api/notifications`):
    - Mounted at `/api/notifications` in `app.ts` under `csrfMiddleware`, `requireAuth`, and `requirePasswordChanged`.
    - Registered `GET /unread-count` and `POST /read-all` BEFORE `POST /:id/read`.
    - `GET /`: Lists own notifications (`where: { userId }`), ordered by `createdAt: 'desc', id: 'desc'`. Strict query parameter validation (plain strings, rejects empty strings and arrays). Validates `limit` (default 20, max 100), `offset` (0 valid), and `unreadOnly` (strict boolean `'true'` or `'false'`, rejects `'maybe'` with 400). Returns `{ items, total, unreadCount, limit, offset }`.
    - `GET /unread-count`: Returns `{ unreadCount }` for session user.
    - `POST /read-all`: Marks all unread notifications of caller as read, returns `{ updated }`.
    - `POST /:id/read`: Marks single notification read using `updateMany({ where: { id, userId } })`. Idempotent (returns 200 on repeated calls). Returns uniform 404 `{ error: 'not_found', message: 'Notification not found' }` if notification belongs to another user, does not exist, or ID is malformed.
    - Proves direct `POST /`, `PUT`, `PATCH`, and `DELETE` are refused with 404 Route not found (tested both in standard test mode and with explicit CSRF protection + valid token).
  - Item 6 (Audit Log Invariant): Confirmed reading or marking notifications writes NO audit entry (`db.auditLog.create` never called).
  - Item 7 (Tests): Added mock-based test suite `apps/api/src/__tests__/notifications.test.ts` (39 tests). Updated `setup.ts` with `notification` mock delegate. Added route checks to `routeInventory.test.ts` and permission checks to `permissions.test.ts`.
  - Item 8 (Demo Tooling): Added `Notification` to `DEMO_DELETION_ORDER` immediately before `User` in `apps/api/scripts/demoGuard.ts`. Added `{ child: 'Notification', parent: 'User' }` to `PARENT_CHILD_RELATIONS`. Added `Notification` deletion step in `apps/api/scripts/demoRemove.ts` by `userId in demoUserIds` before User. Added `Notification` count in `apps/api/scripts/demoStatus.ts`. Zero demo scripts executed.
  - Item 9 (Documentation): Appended policy questions 40-42 to `docs/open-policy-questions.md`, appended manual test scenarios `TEST-17A-01` to `TEST-17A-03` to `docs/HAND-TEST-BACKLOG.md`, appended milestone summary to `docs/PROGRESS.md`, and logged task in `finalreport.md`.
  - Verification: Full test suite passed (37 test files, 1,236 tests passed, 0 failures), lint passed with 0 errors, typecheck passed with 0 errors across all workspaces.
- **Files created or changed**:
  - `apps/api/prisma/schema.prisma`
  - `apps/api/scripts/demoGuard.ts`
  - `apps/api/scripts/demoRemove.ts`
  - `apps/api/scripts/demoStatus.ts`
  - `apps/api/src/lib/permissions.ts`
  - `apps/api/src/services/notifications.ts`
  - `apps/api/src/routes/notifications.ts`
  - `apps/api/src/app.ts`
  - `apps/api/src/__tests__/setup.ts`
  - `apps/api/src/__tests__/permissions.test.ts`
  - `apps/api/src/__tests__/routeInventory.test.ts`
  - `apps/api/src/__tests__/notifications.test.ts`
  - `docs/open-policy-questions.md`
  - `docs/HAND-TEST-BACKLOG.md`
  - `docs/PROGRESS.md`
  - `finalreport.md`
- **Tests run with pass counts**:
  - `apps/api`: 20 test files passed, **863 tests passed (0 failures)** (+45 new tests).
  - `apps/web`: 17 test files passed, **373 tests passed (0 failures)**.
  - Monorepo total: **37 test files passed, 1,236 tests passed (0 failures)**.
  - `npm run lint`: clean across all workspaces (0 errors).
  - `npm run typecheck`: clean across all workspaces (0 errors).
- **Status**: COMPLETED
- **Decisions or problems**:
  - In `notifications.ts`, `actorUserId` is preserved while `actorDisplayName` and `actorUsername` are dropped to prevent stale denormalized name strings.
  - Zero migrations created; zero migrate commands run; zero database connections made; protected files untouched; zero git commits executed.

---

## Step 17b: Notification Bell and Notification Centre (`apps/web` only)

### Task 17b-01: Notification Bell, Notification Centre Page, Pure Helpers, Routing & Tests
- **Date**: 2026-11-25
- **Day of week**: Wednesday
- **Start time**: 10:23:00 +05:45
- **End time**: 10:34:00 +05:45
- **Step**: Step 17b (Notification bell and notification centre — `apps/web` only)
- **Task performed**:
  - Created `apps/web/src/constants/notificationTypes.ts` with `NOTIFICATION_TYPES` and `ALL_NOTIFICATION_TYPES`.
  - Created `apps/web/src/api/notifications.ts` (`fetchNotifications`, `fetchUnreadCount`, `markNotificationRead`, `markAllNotificationsRead`).
  - Created `apps/web/src/lib/notificationsHelpers.ts` (`notificationKeys`, `buildNotificationQueryParams`, `formatUnreadBadge`, `getNotificationsRedirectPath`, `notificationText`, `notificationLink` with strict UUID validation, `mergeNotificationPages`, `executeNotificationRowClick`, `resolveNotificationError`).
  - Created `apps/web/src/components/layout/NotificationBell.tsx` (60s unread-count polling paused in background tabs, lazy dropdown load on open, outside click + Escape returning focus, translated `aria-label` + `aria-expanded`, mobile viewport fit).
  - Created `apps/web/src/pages/notifications/NotificationsPage.tsx` (unconditional hooks, `All`/`Unread` filter, `"Load more"` pagination, `"Mark all as read"`, per-row mark-read, explicit `"Unread"` text marker, loading/empty/error states with Retry).
  - Updated `AdminLayout.tsx`, `EmployeeLayout.tsx`, and `router/index.tsx` (`/notifications` redirect, `/admin/notifications`, `/employee/notifications`, sidebar item visible to all roles).
  - Added translations to `apps/web/src/i18n/locales/en.json` and verified 0 missing keys.
  - Added 38 Vitest tests in `apps/web/src/lib/__tests__/notificationsHelpers.test.ts` and updated `apps/web/src/router/__tests__/routes.test.ts` (18 tests).
  - Appended `TEST-17B-01`..`TEST-17B-06` (`NOT RUN`) to `docs/HAND-TEST-BACKLOG.md` and updated `docs/PROGRESS.md`.
- **Files created or changed**:
  - `apps/web/src/constants/notificationTypes.ts`
  - `apps/web/src/api/notifications.ts`
  - `apps/web/src/lib/notificationsHelpers.ts`
  - `apps/web/src/components/layout/NotificationBell.tsx`
  - `apps/web/src/pages/notifications/NotificationsPage.tsx`
  - `apps/web/src/components/layout/AdminLayout.tsx`
  - `apps/web/src/components/layout/EmployeeLayout.tsx`
  - `apps/web/src/router/index.tsx`
  - `apps/web/src/i18n/locales/en.json`
  - `apps/web/src/lib/__tests__/notificationsHelpers.test.ts`
  - `apps/web/src/router/__tests__/routes.test.ts`
  - `docs/HAND-TEST-BACKLOG.md`
  - `docs/PROGRESS.md`
  - `finalreport.md`
- **Status**: COMPLETED
- **Decisions or problems**:
  - Verified `getProjectsRedirectPath` in `router/index.tsx` routes `hr_admin` to `/employee/projects`, which rejects `hr_admin` under `ProtectedRoute allowedRoles={['employee', 'project_manager', 'viewer']}`; left untouched per Step 17b boundary and reported in summary.
  - Zero edits to `apps/api`, `packages/shared`, or `package-lock.json`; no packages installed; no git commits executed.

---

## Step 17c: Notification Triggers (`apps/api` only)

### Task 17c-01: Wire 5 Notification Triggers, Eligibility Filters, Rollback Tests & SQL Check
- **Date**: 2026-11-25
- **Day of week**: Wednesday
- **Start time**: 10:42:00 +05:45
- **End time**: 12:24:00 +05:45
- **Step**: Step 17c (Wire notification triggers into existing routes — `apps/api` only)
- **Task performed**:
  - Created `apps/api/src/constants/notificationTypes.ts` synchronized with `apps/web/src/constants/notificationTypes.ts`.
  - Added `filterActiveProjectRecipients` in `apps/api/src/services/notifications.ts`.
  - Wired all 5 triggers inside existing `$transaction(async (tx) => ...)` blocks in `tasks.ts`, `messages.ts`, and `projects.ts` using `tx` alongside audit writes.
  - Updated mock defaults in `setup.ts` and inline `tx` mocks in `projectMessages.test.ts`.
  - Created `apps/api/src/__tests__/notificationTriggers.test.ts` (mock-based) covering all 5 triggers, actor exclusion, departed/inactive exclusion, 409 conflict guard, rollback on failure, payload privacy, and API <-> Web constants sync.
  - Created read-only `docs/notification-triggers-check.sql` (for `imac_demo` only, not executed).
  - Appended `TEST-17C-01`..`TEST-17C-05` (`NOT RUN`) to `docs/HAND-TEST-BACKLOG.md` and updated `docs/PROGRESS.md`.
- **Files created or changed**:
  - `apps/api/src/constants/notificationTypes.ts`
  - `apps/api/src/services/notifications.ts`
  - `apps/api/src/routes/tasks.ts`
  - `apps/api/src/routes/messages.ts`
  - `apps/api/src/routes/projects.ts`
  - `apps/api/src/__tests__/setup.ts`
  - `apps/api/src/__tests__/projectMessages.test.ts`
  - `apps/api/src/__tests__/notificationTriggers.test.ts`
  - `docs/notification-triggers-check.sql`
  - `docs/HAND-TEST-BACKLOG.md`
  - `docs/PROGRESS.md`
  - `finalreport.md`
- **Status**: COMPLETED
- **Decisions or problems**:
  - `projectMessages.test.ts` used custom inline `tx` objects in two `to-task` tests; added `projectMember.findMany` and `notification.create` delegate mocks there per Amendment E.
  - Zero edits to `apps/web`, `packages/shared`, `apps/api/prisma`, or protected auth files; no new routes or permission actions; no git commits executed.

---

## Step 18a: Live Notification Delivery with Server-Sent Events (SSE)

### Task 18a-01: SSE Registry, Stream Endpoint, Post-Commit Publishing, Bell EventSource & Tests
- **Date**: 2026-11-26
- **Day of week**: Wednesday
- **Start time**: 08:26:00 +05:45
- **End time**: 08:43:00 +05:45
- **Step**: Step 18a (Live notification delivery with Server-Sent Events)
- **Task performed**:
  - Created `apps/api/src/services/notificationStream.ts` (5/user cap with oldest eviction & timer cleanup, 500 total cap, 25s ping, 60s read-only `db.session.findUnique` check, `publishToUser`, `publishAfterCommit`, `closeAllNotificationStreams`).
  - Added `GET /api/notifications/stream` in `apps/api/src/routes/notifications.ts` (before `/:id/read`), returning 503 JSON before SSE headers when at cap.
  - Wired `closeAllNotificationStreams()` into `apps/api/src/index.ts` `handleShutdown`.
  - Wired `publishAfterCommit` after `$transaction` in all 5 trigger routes (`tasks.ts`, `messages.ts`, `projects.ts`).
  - Created `apps/web/src/lib/notificationStreamHelpers.ts` and `apps/web/src/lib/__tests__/notificationStreamHelpers.test.ts` (24 tests).
  - Updated `apps/web/src/components/layout/NotificationBell.tsx` with single `EventSource` per tab, backoff, 60s fallback polling, and 2-minute hidden-tab close/reopen.
  - Created `apps/api/src/__tests__/notificationStream.test.ts` (14 mock-based tests) and updated `routeInventory.test.ts` (+1 test).
  - Updated `docs/open-policy-questions.md` (items 43–44), `docs/HAND-TEST-BACKLOG.md` (`TEST-18A-01`..`TEST-18A-04`), `docs/PROGRESS.md`, and `finalreport.md`.
- **Files created or changed**:
  - `apps/api/src/services/notificationStream.ts`
  - `apps/api/src/routes/notifications.ts`
  - `apps/api/src/index.ts`
  - `apps/api/src/routes/tasks.ts`
  - `apps/api/src/routes/messages.ts`
  - `apps/api/src/routes/projects.ts`
  - `apps/api/src/__tests__/notificationStream.test.ts`
  - `apps/api/src/__tests__/routeInventory.test.ts`
  - `apps/web/src/lib/notificationStreamHelpers.ts`
  - `apps/web/src/lib/__tests__/notificationStreamHelpers.test.ts`
  - `apps/web/src/components/layout/NotificationBell.tsx`
  - `docs/open-policy-questions.md`
  - `docs/HAND-TEST-BACKLOG.md`
  - `docs/PROGRESS.md`
  - `finalreport.md`
- **Status**: COMPLETED
- **Decisions or problems**:
  - Read-only `db.session.findUnique` used in 60s re-check instead of `getSession` so idle sessions are never artificially kept alive.
  - Zero edits to `apps/api/prisma`, `session.ts`, `middleware/auth.ts`, `routes/auth.ts`, or `password.ts`; no packages installed; no git commits executed.
