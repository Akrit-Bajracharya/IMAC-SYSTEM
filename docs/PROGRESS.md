# IMAC Nepal Internal Operations System — Implementation Progress

## Current Milestone: User & Employee Administration and Directory APIs (Phase 1 Backend) — COMPLETED

### 1. Canonical Identifier Standard: employeeId = userId
Across all APIs in the IMAC Operations System:
- **`employeeId` parameter represents the User ID (`userId`)**. Every staff member has a `User` record upon account creation.
- Work-role assignment routes (`/api/admin/work-roles/employees/:employeeId/...`) and user profile routes (`/api/admin/users/:id/profile`) consistently treat `:employeeId` and `:id` as the **`userId`** (with `employeeProfileId` supported as a fallback resolver).
- Directory API listings (`/api/employees`) return `id: user.id` as the primary identifier, along with `profileId: user.employeeProfile.id`.
- Frontend screens in the next step can uniformly pass `user.id` as the `employeeId` without needing to translate between user IDs and profile IDs.

---

### 2. What Was Built
- **Database Models & Migration**:
  - `Availability` enum (`available`, `busy_in_meeting`, `out_of_office`, `on_leave`, `working_remotely`).
  - `AvailabilityStatus` model (`id`, unique `userId` FK, `status`, `message`, `expiresAt`, `source`, `updatedAt`).
  - `User` model updated with `availabilityStatus AvailabilityStatus?` relation.
  - Migration created and preserved: `apps/api/prisma/migrations/20261013110000_availability_status/migration.sql`.
  - Prisma client regenerated.
- **Shared Schemas & Validation (`@imac/shared`)**:
  - `createUserSchema` enhanced with optional initial employee profile fields (`employeeCode`, `department`, `jobTitle`, `startDate`, `standardShiftHours`, `workingDaysPerWeek`, `managerUserId`).
  - Added `updateEmployeeProfileSchema` in `packages/shared/src/schemas/user.ts` and rebuilt `@imac/shared`.
- **Administrative User & Employee APIs (`apps/api/src/routes/admin/users.ts`)**:
  - Enhanced existing routes without duplication:
    - `POST /api/admin/users`: Creates `User` and `EmployeeProfile` concurrently in a single operation, with audit log `user.created` and one-time temporary password.
    - `GET /api/admin/users`: Lists users including `employeeProfile`.
    - `GET /api/admin/users/:id`: Retrieves user including `employeeProfile`.
    - `PATCH /api/admin/users/:id/role`: Updates system role (`system_admin` only, audited, self-role modification blocked).
    - `PATCH /api/admin/users/:id/deactivate`: Deactivates user account, terminates all active sessions, audited.
    - `POST /api/admin/users/:id/reset-password`: Issues temporary password, invalidates active sessions, self-reset blocked, audited.
    - `PATCH /api/admin/users/:id/profile` (New): Updates employee profile (`department`, `jobTitle`, `startDate`, `standardShiftHours`, `workingDaysPerWeek`, `employeeCode`, `managerUserId`). Permitted for `system_admin` and `hr_admin` (`user:update`), validated via Zod, audited as `employee_profile.updated`.
- **Employee Directory API (`apps/api/src/routes/employees.ts`)**:
  - Mounted at `/api/employees` and `/api/directory`.
  - `GET /api/employees`:
    - Accessible to all authenticated users.
    - Searchable with `?search=...` and filterable by `?department=...`.
    - **Role-based field redaction**:
      - Regular staff (`employee`, `viewer`, `project_manager`) see only public directory fields: `id` (`userId`), `displayName`, `department`, `jobTitle`, `availability` (`status` and `message`).
      - Privileged staff (`system_admin`, `hr_admin`) see extended administrative fields (`username`, `systemRole`, `employeeCode`, `startDate`, `standardShiftHours`, `workingDaysPerWeek`, `managerUserId`, `createdAt`).
      - **Strict security invariant**: `passwordHash`, `failedLoginCount`, and `lockedUntil` are NEVER returned in directory responses.
  - `GET /api/employees/me`:
    - Allows an employee to inspect their own full profile (`user`, `employeeProfile`, assigned active `workRoles`, and `availabilityStatus`).
  - `GET /api/employees/:id`:
    - Allows an employee to view their own profile, or admins/HR to view an employee's full profile. For non-privileged users viewing other staff, returns strictly redacted public directory fields (preventing IDOR).
- **Security & CSRF Protection (`apps/api/src/app.ts`)**:
  - `csrfMiddleware` mounted on all state-changing admin routes.
  - Rate limiting enforced on login, change-password, and reset-password.
  - All asynchronous route handlers wrapped with `asyncHandler`.
- **Automated Integration Tests (`apps/api/src/__tests__/usersAdmin.test.ts`)**:
  - 20 comprehensive integration tests covering user creation, profile editing, HR permission boundaries, role change blocking, directory field redaction, self-profile retrieval, IDOR prevention, and CSRF enforcement.
  - 134 total passing tests across 5 test suites.
- **Policy Documentation (`docs/open-policy-questions.md`)**:
  - Added Question 8 under Section 3 documenting HR vs. System Admin profile contract parameter editing authority.

---

### 3. Verification & Test Results
- **Type Checking**:
  - Clean across all workspaces (`packages/shared`, `apps/api`, `apps/web` via `npm run typecheck`).
- **Unit & Integration Tests**:
  - Vitest test suite (`apps/api`): 5 test files, **134 passing tests (0 failures)**:
    - `src/__tests__/permissions.test.ts`: 10 tests passed
    - `src/__tests__/auth.test.ts`: 13 tests passed
    - `src/__tests__/security.test.ts`: 51 tests passed
    - `src/__tests__/workRoles.test.ts`: 40 tests passed
    - `src/__tests__/usersAdmin.test.ts`: 20 tests passed
- **Monorepo Build**:
  - `@imac/shared` built clean (`dist/` generated).

---

---

## Current Milestone: Admin Screens & Employee Directory (Phase 1 Frontend) — COMPLETED

### 1. What Was Built
- **API Integration Services (`apps/web/src/api`)**:
  - `adminUsers.ts`: typed clients for user listing, fetching, creation, profile updates, system role changes, deactivation, and password resets.
  - `adminWorkRoles.ts`: typed clients for work-role catalogue CRUD, deactivation, reactivation, employee role assignments, and removals.
  - `directory.ts`: typed client for employee directory listing with search and department filtering.
- **Shared Dialogs & UI Components (`apps/web/src/components`)**:
  - `ConfirmationModal`: accessible modal for dangerous actions (deactivations, password resets, role removals) with custom confirm/cancel labels and loading indicators.
  - `TemporaryPasswordModal`: displays generated temporary passwords **exactly once** upon account creation or password reset. Features single-click clipboard copying with visual feedback and an explicit security warning that the password cannot be retrieved again.
  - `AvailabilityBadge`: color-coded badge indicating staff availability (`available`, `busy_in_meeting`, `out_of_office`, `on_leave`, `working_remotely`) and status notes.
  - `Dialog` and `Select`: styled, accessible dialog and select primitives.
- **Administrative Screens (`apps/web/src/pages/admin`)**:
  - `UsersListPage` (`/admin/users`):
    - Real-time search across display name, username, employee code, and department.
    - Role filter dropdown (`system_admin`, `hr_admin`, `project_manager`, `employee`, `viewer`).
    - Account status filter dropdown (`active`, `inactive`).
    - "Create User" modal collecting credentials and initial profile operational parameters.
    - Employee profile editor modal (`EmployeeProfileModal`) for updating operational attributes and system roles.
    - Password reset confirmation flow displaying the one-time temporary password.
    - Account deactivation confirmation flow.
    - Direct link to work-role assignments.
  - `WorkRolesPage` (`/admin/work-roles`):
    - Catalogue listing of all work categories with name, scope description, active status, and creation date.
    - Create Work Role modal.
    - Rename and edit description modal.
    - Deactivate and reactivate flows with confirmation dialogs.
  - `EmployeeWorkRolesPage` (`/admin/users/:userId/work-roles` and `/admin/work-roles/assign/:userId`):
    - Employee profile summary card (shift hours, working days, code, department).
    - Assignment dropdown displaying unassigned active work roles.
    - Assigned roles listing with remove action and confirmation modal.
- **Employee Directory (`apps/web/src/pages/directory/DirectoryPage.tsx`)**:
  - Mounted at `/admin/directory` and `/employee/directory`.
  - Accessible to all authenticated staff members.
  - Role-based field redaction:
    - Regular staff see: display name, department, job title, availability badge and message.
    - Privileged staff (`system_admin`, `hr_admin`) additionally see: employee code, system role badge, daily shift hours, working days per week, start date, and username.
  - Real-time search by name/title/department and department filtering.
- **Role-Based Navigation & Access Guards**:
  - `AdminLayout`: navigation sidebar includes Dashboard, Users, Work Roles, and Directory.
  - `EmployeeLayout`: navigation sidebar includes Dashboard, Directory, Work Log, Leave, Overtime (Admin links hidden from non-admin roles).
  - Non-admin attempts to access `/admin/*` directly are intercepted by `ProtectedRoute` and render a friendly 403 `UnauthorizedPage`.
- **Localization**:
  - All user-facing text, field labels, confirmation dialogs, notifications, and error/empty states fully mapped to `react-i18next` keys in `apps/web/src/i18n/locales/en.json`.

---

### 2. Backend API Endpoint Updates
- **User Reactivation Endpoint (`PATCH /api/admin/users/:id/reactivate`)**:
  - Implemented in `apps/api/src/routes/admin/users.ts` mirroring the deactivate route.
  - Enforces `user:reactivate` permission (`system_admin` only).
  - Sets `isActive: true`, clears failed-login lockout (`failedLoginCount: 0`, `lockedUntil: null`), logs audit event `user.reactivated`, and returns 404 for unknown users.
  - Connected in `apps/web/src/pages/admin/UsersListPage.tsx` with full confirmation modal, loading, success, and error states.

---

### 3. Verification & Test Results
- **Type Checking**:
  - Clean across all workspaces (`packages/shared`, `apps/api`, `apps/web`) via `npm run typecheck`.
- **Linting**:
  - Clean across workspaces via `npm run lint`.
- **Frontend Production Build**:
  - `npm run build --workspace=apps/web` compiled with Vite into `dist/` with 0 errors.
- **Integration & Unit Tests**:
  - Vitest test suite (`apps/api`): 5 test suites, **134 passing tests (0 failures)**.


---

## Current Milestone: Step 8a — Daily Work Log Data Layer (Phase 2) — COMPLETED

### 1. What Was Built
- **Database Schema Models & Migration (`apps/api/prisma/schema.prisma`)**:
  - `WorkLogStatus` enum (`draft`, `submitted`, `approved`, `rejected`).
  - `WorkLogDay` model:
    - Primary key: `id` (UUID).
    - Relation to `EmployeeProfile`: `employeeProfileId` (cascade delete).
    - `date`: `DateTime` using `@db.Date` (calendar date).
    - Status: `WorkLogStatus` defaulting to `draft`.
    - Approval fields: `submittedAt`, `approvedAt`, `approvedByUserId` (nullable string), `rejectionReason` (nullable string).
    - Timestamps: `createdAt`, `updatedAt`.
    - Unique composite constraint: `@@unique([employeeProfileId, date])`.
  - `WorkLogEntry` model:
    - Primary key: `id` (UUID).
    - Relation to `WorkLogDay`: `workLogDayId` (cascade delete).
    - Relation to `WorkRole`: `workRoleId`.
    - `hours`: `Float` (positive decimal hours).
    - `description`: `String?` (optional).
    - `projectId`: `String?` (nullable string link for Phase 3).
    - `taskId`: `String?` (nullable string link for Phase 3).
    - Timestamps: `createdAt`, `updatedAt`.
  - Relations updated on `EmployeeProfile` (`workLogDays WorkLogDay[]`) and `WorkRole` (`workLogEntries WorkLogEntry[]`).
  - Migration created and deployed to database: `apps/api/prisma/migrations/20261026140000_work_log_models/migration.sql`.
  - Prisma Client regenerated.
- **System Settings Seed (`apps/api/prisma/seed.ts`)**:
  - Preserved existing worklog policy settings without duplication (`worklog.requiresApproval`, `worklog.mismatchHandling`, `worklog.editWindowHours`).
  - Updated `worklog.mismatchHandling` description to explicitly reflect all three valid modes: `(allow, warn, or block)`.
- **Policy Documentation (`docs/open-policy-questions.md`)**:
  - Documented work log approval requirement (`worklog.requiresApproval`).
  - Documented hour mismatch handling (`worklog.mismatchHandling` allow/warn/block).
  - Documented modification window length (`worklog.editWindowHours`).
  - Documented cross-employee log visibility and read authorization rules (who may read other employees' logs).

### 2. What Is Untested
- API routes, shared validation schemas, Excel export, and frontend screens are deferred to subsequent sub-steps (8b+) as instructed.

### 3. Assumptions & Next Steps
- **Next Step (8b)**: Shared schemas in `@imac/shared`, backend API endpoints under `/api/work-logs` (`my-logs`, day retrieval, save draft/submit, admin lookup, export), permission matrix updates, and integration tests.


---

## Current Milestone: Step 8c — Daily Work Log Excel Export (Phase 1 Backend) — COMPLETED

### 1. What Was Built
- **ExcelJS Export Engine (`apps/api/src/services/workLogExport.ts`)**:
  - Two-sheet workbook generation (`Summary` and `Entries`).
  - **Sheet 1 "Summary"**: Title block specifying `Asia/Kathmandu` timezone, generated timestamp, requesting actor, active filters, frozen header row, and totals tables:
    - Totals by Employee (name, code, department, total hours).
    - Totals by Work Role (role name, total hours).
    - Hours by Status (`draft`, `submitted`, `approved`, `rejected`).
  - **Sheet 2 "Entries"**: Detailed tabular rows with real Excel dates (`yyyy-mm-dd`), calculated UTC weekday, status, work role, numeric hours (`#,##0.00`), sanitized description, project/task hooks, and Kathmandu-formatted `submittedAt`.
  - **Formula Injection Defense**: Neutralizes CSV/Excel formula injection on **every text cell** (display names, codes, departments, roles, project/task IDs, descriptions) if the value starts with tab, newline, carriage return, or `= + - @` (including leading whitespace).
  - **50,000 Row Cap Protection**: Runs a preliminary `count` query; if results exceed 50,000 rows, halts immediately and returns HTTP 400 `row_limit_exceeded` before loading rows into memory.
- **Shared Validation Schemas (`packages/shared/src/schemas/workLog.ts`)**:
  - Added `workLogExportQuerySchema` validating `startDate`, `endDate`, date range maximum (366 days), and optional filters (`employee`, `team`, `workRoleId`, `projectId`, `status`).
- **Export Route (`GET /api/work-logs/export` in `apps/api/src/routes/workLogs.ts`)**:
  - Declared **before** `GET /api/work-logs/:id` to prevent routing collisions.
  - Permissions: Evaluates `can(user, 'worklog:exportAll')`. Non-admins are scoped strictly to their own logs (`employeeProfileId`). If an employee filter matching another staff member's ID is passed by a non-admin, the request is rejected with HTTP 403 Forbidden.
  - Team filter maps directly to `EmployeeProfile.department`.
  - Status filter behavior: **When no status filter is provided, drafts and rejected entries are included alongside submitted and approved logs**.
  - Audit Logging: Writes an `AuditLog` entry (`work_log.exported`) recording actor, scope (`own` vs `organisation`), rowCount, and filters before transmitting the file. If audit creation fails, the request fails with 500 without sending data.
  - HTTP Headers: `Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`, `Content-Disposition: attachment; filename="work-logs-export.xlsx"`, `Cache-Control: no-store`, `X-Content-Type-Options: nosniff`.
- **Policy Documentation (`docs/open-policy-questions.md`)**:
  - Documented Question 11: HR Admin export scope (default NO / own-only) and `team` filter mapping to `department`.

### 2. Mock Limitations & What Tests Cannot Prove
- Integration tests in Vitest use an in-memory mocked database (`setup.ts`). Mocks verify application business logic, authorization scoping, ExcelJS workbook generation, cell formatting, formula neutralization, and error handling.
- They do not test live streaming under multi-gigabyte PostgreSQL loads or real OS network socket buffers.

### 3. Assumptions & Next Steps
- **Next Step (8d)**: Review Fixes for Steps 8b and 8c (completed below).

---

## Current Milestone: Step 8d — Review Fixes for Steps 8b and 8c — COMPLETED

### 1. What Was Built & Fixed
- **Submitted Log PATCH Mismatch Handling (`apps/api/src/routes/workLogs.ts`)**:
  - `PATCH /api/work-logs/:id` on a `submitted` log now evaluates `worklog.mismatchHandling` on the updated entries within the edit window:
    - `block`: Returns HTTP 422 `hour_mismatch`. Atomic transaction ensures nothing is deleted, updated, or created, and no audit entry is written.
    - `warn`: Returns HTTP 200 with warning in `warnings` array.
    - `allow`: Returns HTTP 200 with empty `warnings: []`.
  - Draft work logs are unaffected.
  - The admin override endpoint (`PATCH /api/admin/work-logs/:id`) remains exempt from mismatch blocking.
- **Optimistic Locking & Status Concurrency Guard (`apps/api/src/routes/workLogs.ts`)**:
  - `POST /api/work-logs/:id/submit`: The atomic conditional update now verifies `updatedAt: existing.updatedAt` alongside `status: 'draft'`. If zero rows are updated, the handler re-queries the day:
    - If status changed away from draft, returns HTTP 400 `already_submitted`.
    - If status is still draft (concurrency collision), returns HTTP 409 `conflict_retry`.
  - `POST /api/work-logs`: In-transaction draft update requires `status: 'draft'`. If zero rows are updated (e.g. log submitted concurrently), returns HTTP 409 `status_conflict`.
- **Quarter-Hour Precision Function (`packages/shared/src/schemas/workLog.ts`)**:
  - Replaced modulo arithmetic in `isQuarterHourIncrement` with floating-point tolerance check: `Math.abs(val * 4 - Math.round(val * 4)) < 1e-9`.
  - Accurately accepts `0.25`, `1.5`, `24`, and rejects `0.254`, `1.251`, `0.3`, `2.1`.
- **Sensitive User Field Exclusion in Export Query (`apps/api/src/routes/workLogs.ts`)**:
  - Replaced `user: true` in `findMany` with explicit field selection: `user: { select: { id: true, displayName: true, username: true } }`.
  - Sensitive authentication attributes (`passwordHash`, `failedLoginCount`, `lockedUntil`) are never selected or loaded into memory during exports.
- **Restored Explanatory Comments (`apps/api/src/app.ts`)**:
  - Restored SEC-01 notes, CSRF login rationale, and `/api/auth/csrf` token bootstrap exemption explanation without modifying behavior.
- **Export Character Encoding & Layout Cleanup (`apps/api/src/services/workLogExport.ts`)**:
  - Replaced non-ASCII / box-drawing characters and em-dashes with plain ASCII.
  - Removed 7-row freeze on Summary sheet (`views: [{ state: 'frozen', ySplit: 7 }]`).
  - Stated time zone clearly in the Summary title block: `Time Zone: Asia/Kathmandu (UTC+05:45)`.
  - Formatted "Submitted At" column as a native Excel `Date` cell with `numFmt: 'yyyy-mm-dd hh:mm'`.
- **Export Rate Limiter (`apps/api/src/app.ts`)**:
  - Added `exportLimiter` on `/api/work-logs/export`:
    - **Limit**: 15 requests per 15-minute window per IP.
    - **Status Code**: 429 `too_many_requests`.
    - **Rationale**: Prevents CPU and memory exhaustion from high-frequency large spreadsheet generation.
- **Important System Notes**:
  - **Rejected-log handling is incomplete until approvals exist** (full rejection workflow with rejection reasons, manager re-submission, and status transition endpoints will be finalized when the approval module is introduced).
  - **Edit audit snapshots contain descriptions**: `AuditLog.beforeSnapshot` and `afterSnapshot` on post-submission edits capture the full entry payload including employee descriptions to ensure complete audit trail integrity.

### 2. Mock Limitations & What Tests Cannot Prove
- Integration tests in Vitest use an in-memory mocked database (`setup.ts`).
- **What mocks prove**: Application business logic, policy branch handling (`block`, `warn`, `allow`), status code returns (422, 409, 400), Zod schema validations, ExcelJS cell formatting, formula neutralization, and security checks.
- **What mocks CANNOT prove**:
  - Real database transaction isolation levels (e.g. Read Committed vs Serializable in PostgreSQL).
  - Physical race conditions under parallel operating system threads simultaneously executing against a PostgreSQL engine.
  - Real database unique constraints and lock contention under multi-client loads.
  - Memory and socket streaming under multi-gigabyte production workloads.

### 3. Assumptions & Next Steps
- **Next Step (8e/9)**: Work Log Approvals module (approval flows, rejection with reason, manager/admin approval endpoints).


---

## Current Milestone: Step 9a — Daily Work Log Screens (apps/web) — COMPLETED

### 1. What Was Built
- **Zero Backend Changes / Zero Schema Changes**:
  - Implemented strictly in `apps/web` utilizing only the real REST endpoints from Step 8 (`/api/work-roles/my-roles`, `/api/work-logs/by-date`, `/by-week`, `/by-month`, `/:id`, `POST /api/work-logs`, `PATCH /api/work-logs/:id`, `POST /api/work-logs/:id/submit`, `GET /api/work-logs/export`, and `GET`/`PATCH /api/admin/settings`).
  - No API was missing any required fields or functionalities.
- **Frontend Architecture & Conventions**:
  - Full adherence to `react-i18next` with complete translation keys across `en.json` (no raw user-facing hardcoded text).
  - Integrated with `@tanstack/react-query` for query caching, loading states, and optimistic mutation invalidation.
  - Automatic double-submit cookie CSRF handling through the shared Axios client.
  - Responsive layouts supporting phone width down to mobile viewport sizes.
- **Daily Work Log Page (`apps/web/src/pages/workLogs/DailyWorkLogPage.tsx`)**:
  - Calendar date selector defaulting to current date in `Asia/Kathmandu` (`YYYY-MM-DD` string format, never timestamps) with quick Today/Yesterday navigation.
  - Role-based write authorization: permits `employee`, `hr_admin`, `project_manager`, and `system_admin` with profile; displays a clear read-only banner for `viewer`.
  - Profile guard: staff accounts without an employee profile see a friendly informative card (`noProfile`) rather than an error or raw JSON.
  - Interactive entry rows: work role selector populated strictly with the user's assigned active roles (`GET /api/work-roles/my-roles`), 0.25-hour increment inputs, optional activity description, and reserved project/task inputs.
  - Real-time running total computation evaluated against `standardShiftHours` with color-coded balance indicator (Balanced, Surplus/Overtime, Deficit).
  - Save Draft and Submit actions with button-level request in-flight disabling to prevent double-submission races.
  - Post-submission edit support via `PATCH /api/work-logs/:id`; automatically detects `edit_window_expired` responses and locks the form with an operational notice.
  - Display of server-generated `warnings` array upon save or submit.
  - Explicit error handling for all domain codes: `validation_error`, `unassigned_work_role`, `hour_mismatch` (422), `status_conflict` (409), `conflict_retry` (409), `already_submitted`, `edit_window_expired`, `log_already_approved`, `profile_not_found`, `row_limit_exceeded`. Raw error JSON is never displayed.
- **Work Log History & Summaries Page (`apps/web/src/pages/workLogs/WorkLogHistoryPage.tsx`)**:
  - Dual view modes: Interactive Month Calendar View with color-coded daily status dots/hours and structured List View.
  - Click-through navigation: selecting any past day opens the Daily Log screen for that specific date.
  - Aggregated monthly totals: overall hours, expected shift hours baseline, net variance, and work role time allocation breakdown.
  - 7-day weekly summaries: date-range selector, daily breakdown table, and work-role hours distribution from `/api/work-logs/by-week`.
- **Work Log Export Screen (`apps/web/src/pages/workLogs/WorkLogExportPage.tsx`)**:
  - Filter form: required start and end dates with client-side 366-day range validation, status filter, and work role filter.
  - Administrative filters (employee ID and team/department) displayed strictly for `system_admin` users.
  - Direct binary Excel (.xlsx) download from `/api/work-logs/export`.
  - Blob error parsing with friendly user notifications for HTTP 403 Forbidden, 400 row limit, and 429 rate limit errors.
- **Admin Settings Screen (`apps/web/src/pages/admin/WorkLogSettingsPage.tsx`)**:
  - Restricted strictly to `system_admin` (direct URL access by non-admins renders the friendly 403 Unauthorized page).
  - Form controls for `worklog.requiresApproval` (radio group), `worklog.mismatchHandling` ('block' | 'warn' | 'allow'), and `worklog.editWindowHours` (positive integer validation).
  - Success and error alerts with automatic cache invalidation.
- **Navigation & Layouts (`apps/web/src/components/layout/` & `router/`)**:
  - Added Daily Log, History, and Export links to both `AdminLayout` and `EmployeeLayout` sidebars.
  - Filtered Settings link in `AdminLayout` to be visible only to `system_admin`.
  - Added protected routing in `apps/web/src/router/index.tsx` ensuring role-based access control.

### 2. Verification & Test Results
- **Type Checking**:
  - Clean across all workspaces (`@imac/api`, `@imac/web`, `@imac/shared` via `npm run typecheck`).
- **Linting**:
  - Clean across all workspaces via `npm run lint`.
- **Frontend Build**:
  - Built cleanly in 19.78s via `npm run build --workspace=apps/web` generating production bundle in `apps/web/dist/`.
- **Automated Test Suite**:
  - All 217 unit and integration tests passing in `apps/api` (7 test files, 0 failures).

### 3. Next Steps
- **Next Step (9b)**: Daily work log reminders and notification background jobs.
