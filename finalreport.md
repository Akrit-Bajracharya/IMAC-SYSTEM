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
