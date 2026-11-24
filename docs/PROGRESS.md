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


---

## Current Milestone: Step 10a — Projects Data Layer (Models and Migration) — COMPLETED WITH DATABASE RESET ALERT

### 1. What Was Built
- **Database Schema Models & Enums (`apps/api/prisma/schema.prisma`)**:
  - `ProjectStatus` enum: `on_track`, `at_risk`, `off_track`, `on_hold`, `complete`.
  - `ProjectRole` enum: `manager`, `member`, `viewer`.
  - `TaskStatus` enum: `todo`, `in_progress`, `blocked`, `done`.
  - `Project`: `id`, `name`, `description?`, `status` (default `on_track`), `startDate?` (`@db.Date`), `targetDate?` (`@db.Date`), `createdByUserId`, `createdAt`, `updatedAt`.
  - `ProjectMember`: `id`, `projectId`, `userId`, `projectRole`, `addedByUserId`, `createdAt`, with `@@unique([projectId, userId])`.
  - `ProjectStatusEvent`: `id`, `projectId`, `fromStatus`, `toStatus`, `reason`, `changedByUserId`, `createdAt`, with `@@index([projectId])`.
  - `Milestone`: `id`, `projectId`, `name`, `dueDate?` (`@db.Date`), `completedAt?`, `createdAt`.
  - `Task`: `id`, `projectId`, `parentTaskId?` (one-level subtask self-relation), `title`, `description?`, `status` (default `todo`), `assigneeUserId?`, `dueDate?` (`@db.Date`), `estimatedHours?`, `milestoneId?`, `createdByUserId`, `createdAt`, `updatedAt`.
  - `TaskDependency`: `id`, `taskId`, `dependsOnTaskId`, with `@@unique([taskId, dependsOnTaskId])`.
  - `Comment`: `id`, `taskId`, `authorUserId`, `body`, `createdAt`, `updatedAt`.
  - `ProjectMessage`: `id`, `projectId`, `authorUserId`, `body`, `isPinned` (default `false`), `createdAt`.
  - `TimeLog`: `id`, `taskId?`, `projectId`, `userId`, `workDate` (`@db.Date`), `hours` (Float), `note?`, `createdAt`, with indexes on `(userId, workDate)` and `projectId`.
- **Cascade Deletes & Referential Integrity**:
  - Cascading deletes restricted strictly to child entities that cannot exist without their parent:
    - `Project` -> `Task`, `Comment` (via Task), `ProjectMember`, `ProjectMessage`, `Milestone`, `TaskDependency` (via Task), `TimeLog`, `ProjectStatusEvent`.
    - `Task` -> `subtasks` (`parentTask`), `Comment`, `TaskDependency`.
  - User references maintain standard referential integrity without cascade deletes (`Restrict` or `SetNull`).
  - `WorkLogEntry.projectId` and `WorkLogEntry.taskId` preserved as plain nullable strings without foreign keys.
  - Foreign keys used in lookups indexed across all new models.
- **Test Setup Mocks (`apps/api/src/__tests__/setup.ts`)**:
  - Added complete mock entries for `project`, `projectMember`, `projectStatusEvent`, `milestone`, `task`, `taskDependency`, `comment`, `projectMessage`, and `timeLog`.
- **Policy Documentation (`docs/open-policy-questions.md`)**:
  - Documented Questions 12-15 covering project creation authority (`system_admin` and `project_manager`), project visibility scoping (`system_admin` all; `hr_admin` default NO), task time log derivation vs independent work log entries, and task "blocked" status requirements.

### 2. IMPORTANT DATABASE RESET ALERT & FINDING
- When executing migration checks, Prisma diagnostic detected an existing migration discrepancy in the target PostgreSQL database:
  - **Diagnostic Output**: `{"action": {"tag": "reset", "reason": "The following migration(s) are applied to the database but missing from the local migrations directory: 20261014065852_drift_check"}}`
  - In accordance with prompt instructions (*"IMPORTANT: if Prisma ever asks to reset the database or says data will be lost, answer NO, stop, and report it. Never reset"*), **reset was rejected and database was NOT reset**.
  - All existing database records remain intact and preserved without data loss.

### 3. Verification & Test Results
- **Prisma Schema Validation**:
  - `npx prisma validate --schema=apps/api/prisma/schema.prisma` passed cleanly.
- **Prisma Client Generation**:
  - `npx prisma generate` generated Prisma Client v5.22.0.
- **Type Checking**:
  - Clean across all workspaces (`@imac/api`, `@imac/web`, `@imac/shared` via `npm run typecheck`).
- **Linting**:
  - Clean across all workspaces via `npm run lint`.
- **Automated Test Suite**:
  - All 217 tests passing across 7 test suites via `npm test`.

### 4. Next Steps
- Resolve database migration drift (`20261014065852_drift_check`) or apply migration via safe migration deploy/reconciliation before proceeding to project route implementation.


---

## Current Milestone: Step 10b — Projects, Members and Status APIs (Backend Only) — COMPLETED

### 1. What Was Built
- **Shared Validation Schemas & Types (`packages/shared/src/schemas/project.ts` & `index.ts`)**:
  - `ProjectStatus` enum: `on_track`, `at_risk`, `off_track`, `on_hold`, `complete`.
  - `ProjectRole` enum: `manager`, `member`, `viewer`.
  - `createProjectSchema`: validated name (trimmed, 1-100 chars), optional description, optional startDate and targetDate with cross-date refinement (`targetDate >= startDate`).
  - `patchProjectSchema`: `.strict()` rejection of unknown/forbidden fields (disallowing status or createdByUserId), at least one field required, description nullable (null clears description in DB), cross-date validation.
  - `addProjectMemberSchema`: UUID validation on userId, projectRole enum.
  - `changeProjectStatusSchema`: non-empty trimmed reason string, status enum.
  - `listProjectsQuerySchema`: limit (default 50, max 100, min 1), optional UUID cursor.
- **Central Permissions Matrix (`apps/api/src/lib/permissions.ts`)**:
  - Added actions: `project:create`, `project:read`, `project:update`, `project:manageMembers`, `project:changeStatus`.
  - `project:create` restricted to `system_admin` and `project_manager`.
  - `project:read` granted to all 5 system roles (`system_admin`, `hr_admin`, `project_manager`, `employee`, `viewer`).
  - `project:update`, `project:manageMembers`, and `project:changeStatus` held by `system_admin`, `project_manager`, `employee`, and `hr_admin` at the system level with `viewer` strictly denied ("viewer cannot write"). Architectural comments document that the route handler's project-level membership role check (`member.projectRole === 'manager'`) is the real enforcement barrier for non-admins.
- **Projects Router (`apps/api/src/routes/projects.ts`)**:
  - Mounted at `/api/projects` in `apps/api/src/app.ts` under `csrfMiddleware`, `requireAuth`, and `requirePasswordChanged`.
  - Strict 4-step check order on every mutating route:
    1. System-level `can(user, action)` check (uniform 403 Forbidden).
    2. UUID format validation on URL parameters `:id` and `:userId` (uniform 404 Not Found, never letting Prisma throw an unhandled 500).
    3. Project existence and caller membership lookup: non-members receive 404 Not Found (never 403, preventing IDOR / project enumeration). `system_admin` bypasses membership requirement.
    4. Project role check: non-admins must hold `projectRole: 'manager'` on the target project (uniform 403 Forbidden).
  - `POST /api/projects`: atomic creation of project, creator as `manager` member, and audit log in one Prisma `$transaction`.
  - `GET /api/projects`: lists only projects caller is member of (`system_admin` sees all); ordered by `createdAt: 'desc', id: 'desc'`; limit + cursor pagination (`skip: 1`, returning `items`, `nextCursor`, `hasMore`); returns `memberCount`.
  - `GET /api/projects/:id`: detail with member list. Uses explicit select (`id`, `displayName`, `username`); `systemRole` is selected and returned strictly for `system_admin`; `passwordHash` is never loaded.
  - `PATCH /api/projects/:id`: edits project details; compares dates against stored values when only one date is sent; null description clears value in DB; audited as `project.updated`.
  - `POST /api/projects/:id/members`: checks target user exists and `isActive === true` (400 `inactive_user`); enforces viewer restriction rejecting system role `viewer` from being assigned as `manager` or `member` (400 `viewer_cannot_be_member_writer`); catches Prisma P2002 duplicate collisions and returns 409 `member_already_exists`; audited as `project_member.added`.
  - `DELETE /api/projects/:id/members/:userId`: executes inside a transaction with project row lock (`SELECT "id" FROM "Project" WHERE "id" = $1 FOR UPDATE`); re-reads target member inside transaction (404 if deleted concurrently); counts remaining active managers (`isActive: true`); refuses removing the last active manager with 409 `last_manager_required`; audited as `project_member.removed`.
  - `POST /api/projects/:id/status`: requires non-empty trimmed reason (400); refuses same-status transitions (400 `same_status`); executes atomic `updateMany` conditional on status read previously, returning 409 `conflict_retry` if 0 rows were updated due to concurrent modifications; writes `ProjectStatusEvent` and `AuditLog` in one transaction.
- **Automated Integration & Unit Tests (`apps/api/src/__tests__/projects.test.ts` & `permissions.test.ts`)**:
  - 48 comprehensive integration tests in `projects.test.ts` covering all positive flows and required negative security invariants: 401 unauthenticated, 404 for non-members on read/edit/members/status, 403 for members without manager rights, 403 for viewers, 404 cross-PM isolation, 409 last-manager guard, 400 invalid dates, 400 strict patch rejection, 400 viewer writer guard, 409 duplicate member, 409 status conflict retry, 404 malformed UUIDs.
  - Documented mock limitations regarding mock-based isolation and PostgreSQL row lock concurrency behavior.
  - 26 tests in `permissions.test.ts` testing all 5 roles against project actions.
- **Policy Documentation (`docs/open-policy-questions.md`)**:
  - Added Questions 16-21 covering: reopening completed projects, project member self-removal invariants, manager removal with active assigned tasks, direct member role modification vs remove/re-add, system role viewer assignment restrictions, and user deactivation impact on project manager coverage.

### 2. Verification & Test Results
- **Prisma Schema & Migrations**:
  - `npx prisma migrate status` verified: 5 migrations applied, database schema clean and up to date without resets.
- **Automated Test Suite**:
  - Vitest test suite (`apps/api`): 8 test files, **270 passing tests (0 failures)**:
    - `src/__tests__/projects.test.ts`: 48 tests passed
    - `src/__tests__/permissions.test.ts`: 26 tests passed
    - `src/__tests__/auth.test.ts`: 13 tests passed
    - `src/__tests__/security.test.ts`: 51 tests passed
    - `src/__tests__/workRoles.test.ts`: 40 tests passed
    - `src/__tests__/usersAdmin.test.ts`: 25 tests passed
    - `src/__tests__/workLogs.test.ts`: 45 tests passed
    - `src/__tests__/workLogExport.test.ts`: 22 tests passed
- **Type Checking**:
  - Clean across all workspaces (`@imac/api`, `@imac/web`, `@imac/shared` via `npm run typecheck`).
- **Linting**:
  - Clean across all workspaces via `npm run lint`.
- **Shared Package Build**:
  - `@imac/shared` compiled cleanly via `tsc`.

### 3. What is Untested & Assumptions
- **Untested via Vitest (Mock-Based Limitations)**:
  - Vitest mocks Prisma calls with stubbed `$transaction` and `$queryRaw`; while the SQL lock statement `SELECT "id" FROM "Project" WHERE "id" = $1 FOR UPDATE` is verified to execute, PostgreSQL engine-level row-lock contention, deadlock aborts, and transactional rollbacks cannot be proven by mock unit tests.
  - Concurrency collision on compound index `@@unique([projectId, userId])` is proven by simulating P2002 error handling, but native database constraint enforcement under simultaneous physical writes is untested.
- **Assumptions**:
  - Self-removal by project members is permitted provided the last-active-manager invariant is preserved.
  - Changing a member's role uses the existing delete + add member sequence.
  - Reopening projects in `complete` status is permitted if a non-empty reason is provided.

### 4. Next Steps
- **Step 10c**: Task management, assignments, subtasks, milestone associations, comments, dependencies, and time logs data and APIs — COMPLETED.
- **Step 10d**: Time logs, project messages, progress calculation, overdue/blocked reports, and linking `WorkLogEntry.projectId`/`taskId`.

---

## Current Milestone: Step 10c — Tasks, Subtasks, Assignment, Milestones, Dependencies, and Comments APIs (Backend Only) — COMPLETED

### 1. What Was Built
- **Shared Validation Schemas & Types (`packages/shared/src/schemas/task.ts` & `index.ts`)**:
  - `TaskStatus` enum: `todo`, `in_progress`, `blocked`, `done` (values `in_review` and `canceled` are invalid and rejected with 400).
  - `TaskPriority` enum: `low`, `medium`, `high`, `urgent`.
  - `createTaskSchema`: `.strict()` rejection of forbidden/unknown fields (`status`, `createdByUserId`, `projectId`), validated title (trimmed 1-200 chars), optional description, optional priority, optional ISO dueDate string, optional UUID `assigneeUserId`, optional UUID `milestoneId`, optional UUID `parentTaskId`.
  - `patchTaskSchema`: `.strict()`, requires at least one field, allows clearing optional fields (`description`, `dueDate`, `assigneeUserId`, `milestoneId`) via `null`, validates UUIDs, trims title.
  - `changeTaskStatusSchema`: non-empty `status` enum value.
  - `listTasksQuerySchema`: pagination with limit (default 50, max 100), optional UUID cursor, optional status filter, optional UUID `assigneeUserId`, optional UUID `milestoneId`, optional UUID `parentTaskId`, optional boolean `topLevelOnly`. Mutually exclusive validation: `topLevelOnly` together with `parentTaskId` returns 400.
  - `createTaskDependencySchema`: UUID `dependsOnTaskId`.
  - `createMilestoneSchema`: `.strict()`, trimmed title (1-200 chars), optional description, optional ISO dueDate string.
  - `patchMilestoneSchema`: `.strict()`, at least one field required, nullable description and dueDate.
  - `createCommentSchema`: `.strict()`, non-empty trimmed body (1-5000 chars).
  - `patchCommentSchema`: `.strict()`, non-empty trimmed body (1-5000 chars).
  - `listCommentsQuerySchema`: limit (default 50, max 100) and optional UUID cursor.
- **Central Permissions Matrix (`apps/api/src/lib/permissions.ts`)**:
  - Added actions: `task:read`, `task:write`, `comment:write`, `milestone:manage`.
  - `task:read` granted to all 5 system roles (`system_admin`, `hr_admin`, `project_manager`, `employee`, `viewer`).
  - `task:write`, `comment:write`, `milestone:manage` held by `system_admin`, `project_manager`, `employee`, and `hr_admin` at the system level (`viewer` strictly denied). Architectural comment clarifies that the handler-level project membership and project-role check (`canEditTask` and `isManager`) is the actual security enforcement gate.
- **Project Access Resolution & Swappable Policy Service (`apps/api/src/services/projectAccess.ts`)**:
  - Note for Review: `apps/api/src/routes/projects.ts` now imports `isValidUuid` from `services/projectAccess.ts` (local copy removed). `projects.ts` currently retains its inline membership lookup and should be migrated to `resolveProjectAccess` in a future refactoring step.
  - `isValidUuid`: regex check preventing malformed UUIDs from reaching Prisma and triggering 500 errors (returning uniform 404).
  - `resolveProjectAccess`: resolves project existence and caller membership. Non-members receive 404 Not Found (never 403, preventing IDOR / enumeration). `system_admin` bypasses membership with virtual manager rights.
  - `canEditTask`: swappable policy function supporting actions `create`, `edit`, `changeStatus`, and `manageDependencies`. Managers and system administrators have full authority. Regular members can create tasks, and can edit, change status, or manage dependencies on tasks where they are the current assignee or creator. Viewers are strictly denied.
- **Milestones Router (`apps/api/src/routes/milestones.ts`)**:
  - Mounted at `/api/projects/:id/milestones` with `Router({ mergeParams: true })`.
  - Non-members get 404. Viewer/member without manager role gets 403 on mutating routes.
  - `POST /`: creates milestone with `isCompleted: false`, logs audit entry `milestone.created`.
  - `GET /`: lists project milestones ordered by `dueDate: 'asc', id: 'asc'`.
  - `PATCH /:milestoneId`: updates title, description, dueDate; audited as `milestone.updated`.
  - `POST /:milestoneId/complete` & `POST /:milestoneId/reopen`: atomic conditional `updateMany` checking current `isCompleted` state. Completing an already-completed milestone or reopening an already-open milestone returns 409 `already_completed` / `already_open`. Emits single audit entry (`milestone.completed` or `milestone.reopened`).
- **Tasks Router (`apps/api/src/routes/tasks.ts`)**:
  - Mounted at `/api/projects/:id/tasks` with `Router({ mergeParams: true })`.
  - `POST /`: verifies assignee is active member with role `manager` or `member` (viewers rejected); verifies milestone belongs to project; enforces 1-level subtask nesting (parent task must belong to current project [404 if not], and parent task cannot itself be a subtask [400 `subtask_nesting_not_allowed`]); logs audit `task.created`.
  - `GET /`: cursor-based pagination ordered by `createdAt: 'desc', id: 'desc'`; supports filters for status, assignee, milestone, subtasks, and `topLevelOnly`; computes `assigneeIsProjectMember` boolean flag and `isOverdue` boolean flag using `Asia/Kathmandu` midnight calendar date boundary.
  - `GET /:taskId`: retrieves task with subtasks, dependencies, milestone, comments, and computed flags.
  - `PATCH /:taskId`: enforces `canEditTask(..., 'edit')`. Preserves departed assignees: validates `assigneeUserId` only when present in request and changed from stored value (permits updating title when assignee has left project). Audited as `task.updated`.
  - `POST /:taskId/status`: enforces `canEditTask(..., 'changeStatus')`; prevents redundant same-status transition (400); optimistic concurrency guard via `updateMany` conditional on status read previously (returns 409 `conflict_retry` on 0 rows updated); writes `TaskStatusEvent` and `AuditLog`; returns soft warnings: `'open_dependency'` if any prerequisite task is not `done`, `'open_subtasks'` if any subtask is not `done`.
  - `POST /:taskId/dependencies`: takes project row lock (`SELECT "id" FROM "Project" WHERE "id" = $1 FOR UPDATE`) before cycle check; verifies target task belongs to same project (404); prevents self-dependency (400 `self_dependency`); traverses existing dependency graph up to depth limit 50 using a visited set to detect cycles (400 `dependency_cycle`, also used for depth limit); catches Prisma P2002 duplicate collision and returns 409 `duplicate_dependency`; audited as `task_dependency.added`.
  - `DELETE /:taskId/dependencies/:dependsOnTaskId`: deletes dependency link; audited as `task_dependency.removed`.
  - `POST /:taskId/comments`: creates comment with explicit author select (`id`, `displayName`, `username`); audited as `comment.created`.
  - `GET /:taskId/comments`: lists comments ordered by `createdAt: 'asc', id: 'asc'` with cursor pagination.
  - `PATCH /:taskId/comments/:commentId`: restricts edits strictly to comment author (`system_admin` or regular user cannot edit another user's comment, 403); records audit event `comment.edited` without exposing comment body text in audit log metadata.
- **Automated Integration Tests (`apps/api/src/__tests__/tasks.test.ts`)**:
  - 73 comprehensive integration tests covering all positive paths and security requirements:
    - 401 unauthenticated requests.
    - 404 for non-members on task, milestone, and comment routes.
    - 404 on malformed UUIDs.
    - 403 for members without edit rights on other members' tasks.
    - 403 for viewers across all mutating routes.
    - Subtask under another project's parent returns 404.
    - Subtask of subtask returns 400.
    - Departed assignee title patch succeeds without 400.
    - Overdue boundary test with fake timers at 18:30 UTC verifying `Asia/Kathmandu` midnight rollover.
    - Milestone double-complete returns 409.
    - Dependency cycle detection returns 400.
    - Duplicate dependency returns 409.
    - Comment editing by non-author returns 403.
    - Comment edit audit event logged as `comment.edited` without body text.

### 2. Verification & Test Results
- **Automated Test Suite**:
  - Vitest test suite (`apps/api`): 9 test files, **343 passing tests (0 failures)**:
    - `src/__tests__/tasks.test.ts`: 73 tests passed
    - `src/__tests__/projects.test.ts`: 48 tests passed
    - `src/__tests__/permissions.test.ts`: 26 tests passed
    - `src/__tests__/auth.test.ts`: 13 tests passed
    - `src/__tests__/security.test.ts`: 51 tests passed
    - `src/__tests__/workRoles.test.ts`: 40 tests passed
    - `src/__tests__/usersAdmin.test.ts`: 25 tests passed
    - `src/__tests__/workLogs.test.ts`: 45 tests passed
    - `src/__tests__/workLogExport.test.ts`: 22 tests passed
- **Type Checking**:
  - Clean across all workspaces (`@imac/api`, `@imac/web`, `@imac/shared` via `npm run typecheck`).
- **Linting**:
  - Clean across all workspaces via `npm run lint`.
- **Shared Package Build**:
  - `@imac/shared` compiled cleanly via `tsc`.

### 3. What is Untested & Assumptions
- **Untested via Vitest (Mock-Based Limitations)**:
  - Mocked `$transaction` and `$queryRaw` cannot simulate physical PostgreSQL row-level lock serialization or multi-threaded race conditions when two clients add mutual dependencies simultaneously.
  - Database-level foreign key and unique constraint enforcement under high physical concurrency is simulated via Prisma error mappings (e.g. P2002) rather than live database stress testing.
- **Assumptions**:
  - Neutral soft warnings (`open_dependency`, `open_subtasks`) are returned when completing tasks with unresolved prerequisites or subtasks.
  - Retaining departed assignees on tasks with `assigneeIsProjectMember: false` is preferred over destructive auto-unassignment.
  - Reopening completed tasks is permitted by default under standard `canEditTask(..., 'changeStatus')` rules.
  - Task entities are immutable with respect to deletion (no `DELETE` endpoint; canceled status used for discarded tasks).

### 4. Next Steps
- **Step 10d**: Time logs, progress calculation, workload & summary queries, access hardening, and route inventory verification — COMPLETED.
- **Step 10e**: Linking daily work logs to projects/tasks (`WorkLogEntry.projectId`/`taskId`) following plan approval.

---

## Current Milestone: Step 10d — Time Logs, Progress Calculation, Workload Queries, Access Hardening, and Route Inventory (Backend Only) — COMPLETED

### 1. What Was Built
- **Access Hardening & Strict Typing (`apps/api/src/services/projectAccess.ts`)**:
  - `ProjectAccessResult` strongly typed: replaces loose `any` with Prisma types `{ project: Project | null; member: ProjectMember | null }`.
  - `canEditTask` fail-closed security enforcement: signature `(projectRole, isSystemAdmin, action, task, userId)`. Missing `userId`, whitespace-only `userId`, or missing `task` on member branches fails closed immediately (`false`). Strict boolean coercion ensures `undefined === undefined` can never evaluate to `true`.
  - Comprehensive unit tests in `apps/api/src/__tests__/projectAccess.test.ts` (7 tests).
- **Central Permissions Matrix (`apps/api/src/lib/permissions.ts`)**:
  - Added actions: `timeLog:read`, `timeLog:write`.
  - System-level defaults: `system_admin`, `project_manager`, `employee`, and `hr_admin` hold actions; `viewer` denied.
  - Handler-level scoping enforces that time logging requires physical project membership (system administrators without project membership receive 404).
  - Updated permissions tests in `apps/api/src/__tests__/permissions.test.ts` (28 tests).
- **Pure Project Progress Calculation Service (`apps/api/src/services/projectProgress.ts` & `docs/project-progress.md`)**:
  - Pure function `calculateProjectProgress(tasks)` computes completion percentage from leaf tasks (`subtasks.length === 0`).
  - Tasks without subtasks contribute to the total; parent tasks are containers.
  - Zero leaf tasks returns progress `0`.
  - Formula: `round((doneLeafTasks / totalLeafTasks) * 100)`.
  - Strategy map `projectProgressStrategies` with default strategy `'leaf_done_ratio'` allows easy swapping to weighted or hour-based progress calculations in future phases without touching callers.
  - Architectural documentation recorded in `docs/project-progress.md`.
  - Pure unit tests in `apps/api/src/__tests__/projectProgress.test.ts` (6 tests).
- **Shared Validation Schemas (`packages/shared/src/schemas/timeLog.ts` & `packages/shared/src/index.ts`)**:
  - `createTimeLogSchema`: `.strict()`, validated UUID `taskId`, duration in hours (`0.25` to `24`, step `0.25`), date string (`YYYY-MM-DD`), optional trimmed note (1-1000 chars).
  - `patchTimeLogSchema`: `.strict()`, requires at least one field, allows updating `hours`, `workDate`, or nullable `note`.
  - `listTimeLogsQuerySchema`: limit (default 50, max 100), optional UUID cursor, optional UUID `taskId`, optional UUID `userId`, optional date range (`startDate`, `endDate`).
  - Compiled cleanly to `packages/shared/dist/index.js`.
- **Time Logs Router (`apps/api/src/routes/timeLogs.ts`)**:
  - Mounted at `/api/projects/:id/time-logs` with `Router({ mergeParams: true })`.
  - `POST /`: Enforces project membership (even for `system_admin`); verifies target task belongs to URL project (404); restricts `workDate` to [-90 days, +1 day] relative to current date in `Asia/Kathmandu`; takes transaction-level PostgreSQL advisory lock `SELECT pg_advisory_xact_lock(hashtext($1))` scoped to `userId:workDate`; enforces 24-hour daily total cap; creates time log; audits event `time_log.created` omitting confidential note text from audit metadata.
  - `GET /`: Scoped visibility: `system_admin` and project managers see all project time logs; members and project viewers see only their own entries. Non-managers passing another member's `userId` receive 403. Ordered by `workDate: 'desc', createdAt: 'desc', id: 'desc'` with cursor pagination.
  - `PATCH /:timeLogId`: Verifies time log exists and belongs to URL project (404); enforces ownership check (only the creator can edit their time log, 403); validates [-90 days, +1 day] date window; takes advisory xact lock and re-validates 24-hour daily cap excluding the record being edited; audits `time_log.updated` (omitting note text).
  - `DELETE /:timeLogId`: Verifies project match (404) and ownership (403); deletes record; audits `time_log.deleted`.
  - Comprehensive unit tests in `apps/api/src/__tests__/timeLogs.test.ts` (16 tests).
- **Project Query Endpoints (`apps/api/src/routes/projects.ts` & `apps/api/src/routes/tasks.ts`)**:
  - Mounted fixed sub-routes (`/overdue` and `/blocked`) BEFORE `/:taskId` parameter route to prevent routing collisions.
  - `GET /api/projects/:id/tasks/overdue`: returns non-done tasks with `dueDate < today` (in `Asia/Kathmandu`).
  - `GET /api/projects/:id/tasks/blocked`: returns tasks with `status === 'blocked'`.
  - `GET /api/projects/:id/summary`: returns project metadata, progress (`calculateProjectProgress`), task counts by status (`todo`, `in_progress`, `blocked`, `done`), milestone progress (completed count / total count), and total logged hours via database aggregation.
  - `GET /api/projects/:id/workload`: groups tasks by assignee; returns active member task counts (todo, in_progress, blocked, done, total); masks `loggedHours` (visible only to managers and admin; regular members see only their own logged hours and `null` for others); includes `unassigned` task bucket and `departedMembers` task bucket for open tasks assigned to users who are no longer on the project.
  - Integration tests in `apps/api/src/__tests__/projectQueries.test.ts` (9 tests).
- **Route Inventory Test Suite (`apps/api/src/__tests__/routeInventory.test.ts`)**:
  - Exhaustively enumerates all 30 routes registered under `/api/projects`:
    - 9 Project routes (`POST /`, `GET /`, `GET /:id`, `PATCH /:id`, `POST /:id/members`, `DELETE /:id/members/:userId`, `POST /:id/status`, `GET /:id/summary`, `GET /:id/workload`)
    - 12 Task routes (`GET /`, `POST /`, `GET /overdue`, `GET /blocked`, `GET /:taskId`, `PATCH /:taskId`, `POST /:taskId/status`, `POST /:taskId/dependencies`, `DELETE /:taskId/dependencies/:dependsOnTaskId`, `GET /:taskId/comments`, `POST /:taskId/comments`, `PATCH /:taskId/comments/:commentId`)
    - 5 Milestone routes (`GET /`, `POST /`, `PATCH /:milestoneId`, `POST /:milestoneId/complete`, `POST /:milestoneId/reopen`)
    - 4 TimeLog routes (`POST /`, `GET /`, `PATCH /:timeLogId`, `DELETE /:timeLogId`)
  - Asserts 401 unauthenticated for all 30 routes.
  - Asserts 404 for authenticated non-members (`project_manager`) with empty body `{}` across all 28 project-scoped routes.
  - 59 total tests in `routeInventory.test.ts`.
- **Policy Documentation Updates (`docs/open-policy-questions.md`)**:
  - Question 25 corrected: removed mention of `canceled` status (valid statuses are `todo`, `in_progress`, `blocked`, `done`).
  - Question 28 added: Dual time entry (work logs vs project time logs and reconciliation).
  - Question 29 added: Time-log modification and deletion time window.
  - Question 30 added: Logging time on complete or on_hold projects (default: allowed).

### 2. Verification & Test Results
- **Automated Test Suite**:
  - Vitest test suite (`apps/api`): 14 test files, **442 passing tests (0 failures)**:
    - `src/__tests__/routeInventory.test.ts`: 59 tests passed
    - `src/__tests__/tasks.test.ts`: 73 tests passed
    - `src/__tests__/security.test.ts`: 51 tests passed
    - `src/__tests__/projects.test.ts`: 48 tests passed
    - `src/__tests__/workLogs.test.ts`: 45 tests passed
    - `src/__tests__/workRoles.test.ts`: 40 tests passed
    - `src/__tests__/permissions.test.ts`: 28 tests passed
    - `src/__tests__/usersAdmin.test.ts`: 25 tests passed
    - `src/__tests__/workLogExport.test.ts`: 22 tests passed
    - `src/__tests__/timeLogs.test.ts`: 16 tests passed
    - `src/__tests__/auth.test.ts`: 13 tests passed
    - `src/__tests__/projectQueries.test.ts`: 9 tests passed
    - `src/__tests__/projectAccess.test.ts`: 7 tests passed
    - `src/__tests__/projectProgress.test.ts`: 6 tests passed
- **Type Checking**:
  - Clean across all workspaces (`@imac/api`, `@imac/web`, `@imac/shared` via `npm run typecheck`).
- **Linting**:
  - Clean across all workspaces via `npm run lint`.

### 3. What is Untested & Assumptions
- **Untested via Vitest (Mock-Based Limitations)**:
  - Mocked `$queryRaw` verifying `pg_advisory_xact_lock(hashtext(...))` ensures the lock acquisition SQL is issued within the transaction, but unit test mocks cannot simulate physical multi-connection lock contention or race conditions under high concurrent volume.
  - Vitest mocks cannot simulate physical database-level foreign key cascading or race conditions on simultaneous time log deletion and retrieval.
- **Assumptions**:
  - Logging time on `complete` and `on_hold` projects is permitted by default (policy question 30).
  - Time logs and work logs remain separate without automatic mutual reconciliation until Step 10e/future policy (policy question 28).
  - There is no retroactive time-window cutoff for editing own time logs within the [-90 days, +1 day] creation window (policy question 29).

### 4. Next Steps
- **Step 10e**: Work Log linking to projects (`WorkLogEntry.projectId` and `WorkLogEntry.taskId`) and Project Messages Subsystem — COMPLETED.
- **Phase 2 / Next Phase**: Scheduled subsequent steps as directed by the Master Brief.

---

## Current Milestone: Step 10e — Daily Work Log Project/Task Linking & Project Messages Subsystem (Backend Only) — COMPLETED

### 1. What Was Built
- **Part A: Daily Work Log Linking to Real Projects (`WorkLogEntry.projectId` and `taskId`)**:
  - `WorkLogEntry.projectId` and `taskId` remain plain nullable strings with NO database foreign keys.
  - Single shared validation function `validateWorkLogEntriesProjectAndTask` in `apps/api/src/services/workLog.ts`, called uniformly across all three write paths:
    1. `POST /api/work-logs`
    2. `PATCH /api/work-logs/:id`
    3. `PATCH /api/admin/work-logs/:id/override`
  - Exact validation rules and error codes:
    - `400 invalid_project`: Refuses free-text or non-UUID `projectId` on new writes; refuses non-existent project; refuses project where caller has no `ProjectMember` row (bypassed on admin override, which only requires the project to exist).
    - `400 invalid_task`: Refuses `taskId` provided without `projectId`; refuses non-UUID `taskId`; refuses non-existent task; refuses task belonging to a different project.
    - Free-text backward compatibility: Old logs containing historical free-text `projectId` strings load cleanly without errors or schema rejections.
  - Bounded name resolution (`enrichWorkLogsWithProjectAndTask` & `enrichSingleWorkLogWithProjectAndTask`):
    - Appends `projectName: string | null` and `taskTitle: string | null` to work log read responses (`GET /by-date`, `GET /by-week`, `GET /by-month`, `GET /:id`) and write responses (`POST /`, `PATCH /:id`, `PATCH /override`, `POST /:id/submit`).
    - Non-member privacy invariant: If the caller is not a member of the project, `projectName` and `taskTitle` resolve to `null` so project metadata never leaks to non-members.
    - Uses one bounded lookup per request (at most 3 batch queries total across all entries in the request).
  - Integration tests in `apps/api/src/__tests__/workLogProjectLink.test.ts` (13 tests).
- **Part B: Project Messages Subsystem (`/api/projects/:id/messages`)**:
  - Shared schemas in `packages/shared/src/schemas/projectMessage.ts`:
    - `createProjectMessageSchema`: body trimmed, 1 to 5000 characters, no empty or whitespace-only bodies.
    - `listProjectMessagesQuerySchema`: limit (default 50, max 100), optional UUID cursor.
    - Built and exported in `@imac/shared`.
  - Permissions matrix updates in `apps/api/src/lib/permissions.ts`:
    - Added actions: `message:read`, `message:create`, `message:pin`.
    - Tested across all 5 system roles in `apps/api/src/__tests__/permissions.test.ts` (31 tests).
  - Messages router (`apps/api/src/routes/messages.ts`) mounted at `/api/projects/:id/messages`:
    - `POST /`: create message; project members with write rights; project viewers and system viewers refused with 403; non-members get 404.
    - `GET /`: list messages; members only; ordered pinned first (`isPinned: 'desc'`), then newest (`createdAt: 'desc', id: 'desc'`); limit 50 with cursor pagination.
    - `POST /:messageId/pin` & `POST /:messageId/unpin`: pin or unpin message; managers and `system_admin` only (members and viewers refused with 403); foreign messageId returns 404; malformed UUID returns 404; audited as `project_message.pinned` / `project_message.unpinned` WITHOUT message body text.
    - `POST /:messageId/to-task`: converts message into exactly ONE Task in a single transaction; title derived from the first line trimmed to 200 characters; description from the message body; caller must have task creation authority (`canEditTask`); message stays; transactional advisory lock `SELECT pg_advisory_xact_lock(hashtext('to-task:' || messageId))` and audit log conversion check prevent duplication; second conversion attempt returns 409 `already_converted`; audited as `project_message.converted_to_task` and `task.created` WITHOUT message body or description text.
  - Integration tests in `apps/api/src/__tests__/projectMessages.test.ts` (16 tests).
- **Expanded Route Inventory Test Suite (`apps/api/src/__tests__/routeInventory.test.ts`)**:
  - Expanded from 30 to 35 total registered routes under `/api/projects` (adding the 5 new message routes).
  - 69 total automated tests asserting:
    - 401 unauthenticated across all 35 routes.
    - 404 for non-members across all 33 project-scoped routes.

### 2. Verification & Test Results
- **Automated Test Suite**:
  - Vitest test suite (`apps/api`): 16 test files, **484 passing tests (0 failures)**:
    - `src/__tests__/routeInventory.test.ts`: 69 tests passed
    - `src/__tests__/tasks.test.ts`: 73 tests passed
    - `src/__tests__/security.test.ts`: 51 tests passed
    - `src/__tests__/projects.test.ts`: 48 tests passed
    - `src/__tests__/workLogs.test.ts`: 45 tests passed
    - `src/__tests__/workRoles.test.ts`: 40 tests passed
    - `src/__tests__/permissions.test.ts`: 31 tests passed
    - `src/__tests__/usersAdmin.test.ts`: 25 tests passed
    - `src/__tests__/workLogExport.test.ts`: 22 tests passed
    - `src/__tests__/projectMessages.test.ts`: 16 tests passed
    - `src/__tests__/timeLogs.test.ts`: 16 tests passed
    - `src/__tests__/workLogProjectLink.test.ts`: 13 tests passed
    - `src/__tests__/auth.test.ts`: 13 tests passed
    - `src/__tests__/projectQueries.test.ts`: 9 tests passed
    - `src/__tests__/projectAccess.test.ts`: 7 tests passed
    - `src/__tests__/projectProgress.test.ts`: 6 tests passed
- **Type Checking**:
  - Clean across all workspaces (`@imac/api`, `@imac/web`, `@imac/shared` via `npm run typecheck`, 0 errors).
- **Linting**:
  - Clean across all workspaces via `npm run lint` (0 errors).

### 3. What is Untested & Assumptions
- **Untested via Vitest (Mock-Based Limitations)**:
  - Mocked transaction advisory locks (`SELECT pg_advisory_xact_lock(...)`) verify the SQL statement is executed within the transaction, but unit test mocks cannot simulate physical multi-connection database lock contention or simultaneous racing threads.
  - Physical foreign-key absence on `WorkLogEntry.projectId` and `taskId` is verified via application validation logic; live database stress testing under intentional foreign-key constraint violations was not run against live Postgres.
- **Assumptions**:
  - Pinned messages sort ahead of unpinned messages regardless of creation date; within pinned/unpinned groups, newest messages sort first.
  - Turning a message into a task produces an independent task record in `todo` status with no assignee or milestone by default; managers can subsequently edit or assign the task.
  - A message converted to a task cannot be converted again (returns 409 `already_converted`).

### 4. Next Steps
- Frontend screens and dashboard components for Projects, Tasks, Milestones, Time Logs, and Project Messages.


---

## Step 10f: Review Fixes for Projects, Tasks, Messages, and Work Logs (Backend Only)

### 1. Scope & Implementation Details
- messages.ts reviewed 2026-11-13: no access-control, IDOR or transaction findings
- **Item 1: Work Log Empty Day Query**:
  - Verified `GET /api/work-logs/by-date` returns HTTP 200 with `{ workLog: null, totalHours: 0, standardShiftHours: 8, warnings: [] }` when no work log exists for the requested date. Added explicit test in `workLogs.test.ts`.
- **Item 2: Member Task Creation Permission Fix & canEditTask Audit**:
  - Fixed `POST /api/projects/:id/tasks` by passing caller's user ID: `canEditTask(access.projectRole, access.isSystemAdmin!, 'create', null, req.user!.id)`.
  - Audited all `canEditTask` call sites across codebase:
    1. `apps/api/src/routes/tasks.ts:207`: passed `access.projectRole, access.isSystemAdmin!, 'create', null, req.user!.id` (fixed).
    2. `apps/api/src/routes/tasks.ts:556`: passed `access.projectRole, access.isSystemAdmin!, 'edit', task, req.user!.id`.
    3. `apps/api/src/routes/tasks.ts:741`: passed `access.projectRole, access.isSystemAdmin!, 'changeStatus', task, req.user!.id`.
    4. `apps/api/src/routes/tasks.ts:881`: passed `access.projectRole, access.isSystemAdmin!, 'manageDependencies', task, req.user!.id`.
    5. `apps/api/src/routes/tasks.ts:1000`: passed `access.projectRole, access.isSystemAdmin!, 'manageDependencies', task, req.user!.id`.
    6. `apps/api/src/routes/messages.ts:289`: passed `access.projectRole, access.isSystemAdmin ?? false, 'create', null, req.user!.id`.
  - Added test in `tasks.test.ts` verifying that a plain project MEMBER (not manager, not system_admin) successfully creates tasks.
- **Item 3: Progress Calculation Documentation, Typings, and Subtask Invariants**:
  - Aligned progress calculation strategy name to `leaf_tasks_done` across `docs/project-progress.md` and codebase.
  - In `GET /api/projects/:id/summary`, removed `as any` cast on task selection by mapping tasks to typed `ProgressTaskItem[]`.
  - Added test in `projectQueries.test.ts` verifying that parent tasks with child subtasks are excluded from leaf count, even when parent task status is `done`.
- **Item 4: Transactional Auditing**:
  - `PATCH /api/projects/:id`: Wrapped `db.project.update` and `db.auditLog.create` inside a single `db.$transaction`.
  - `POST /api/projects/:id/messages/:messageId/pin` and `unpin`: Wrapped message pin/unpin and `db.auditLog.create` in `db.$transaction`.
  - Added mock-based rollback tests in `projects.test.ts` and `projectMessages.test.ts` verifying that if `auditLog.create` fails, the update is rolled back and returns 500.
- **Item 5: Missing Delete Endpoints**:
  - Implemented `DELETE /api/projects/:id/tasks/:taskId`:
    - Access: Project managers of this project and `system_admin` only. Viewers and regular members denied with 403.
    - Database integrity: Schema relations handle cascade deletes (`onDelete: Cascade` on `parentTaskId`, `Comment`, and `TaskDependency`; `onDelete: SetNull` on `TimeLog.taskId`). No schema changes needed.
    - Audited as `task.deleted` within the same transaction, strictly omitting task description from audit metadata.
  - Implemented `DELETE /api/projects/:id/tasks/:taskId/comments/:commentId`:
    - Access: Comment author, project manager of this project, or `system_admin`. Viewers and non-author members denied with 403.
    - Audited as `comment.deleted` within the same transaction, strictly omitting comment body from audit metadata.
  - Registered both endpoints in `routeInventory.test.ts`, expanding registered route inventory from 35 to 37 routes.
- **Item 6: Dependency Guard on Task Completion**:
  - In `POST /api/projects/:id/tasks/:taskId/status`, when transitioning to `done` while prerequisite dependencies are open:
    - Non-managers (regular project members) receive 409 `open_dependency`, re-checked both prior to and inside the status-change transaction.
    - Managers and `system_admin` retain soft-warning behavior (status updates to `done` with `warnings: ['open_dependency']`).
  - Added integration tests for both cases in `tasks.test.ts`.
- **Item 7: Project Listing Cursor Visibility Validation**:
  - In `GET /api/projects`, when `cursor` is provided, verified that the cursor project exists and belongs to the caller's visible project set (`db.project.findFirst({ where: { id: cursor, ...whereClause } })`).
  - Inaccessible or foreign project cursor returns 400 `invalid_cursor`. Added integration test in `projects.test.ts`.
- **Item 8: Boolean Query Parameter Parsing**:
  - Replaced `z.coerce.boolean()` with `booleanQueryParam` in shared task schemas (`packages/shared/src/schemas/task.ts`) for `topLevelOnly` and `overdue`.
  - `"false"` and `false` parse strictly to `false`; `"true"` and `true` parse to `true`; invalid strings (e.g. `"maybe"`) return 400 `validation_error`. Rebuilt `@imac/shared`.
  - Added positive and negative test cases in `tasks.test.ts`.

### 2. Mock-Based Limitations & Invariants
- **What Mock-Based Tests Cover**:
  - Route authorization barriers (401 unauthenticated, 403 forbidden, 404 non-member/not-found).
  - Validation schemas (strict unknown field rejection, boolean transformations, invalid cursor checks).
  - Transaction callback execution and error propagation.
- **What Mocks Cannot Prove (Must Be Verified in Real Postgres Cluster)**:
  - **Transaction Rollback Behavior**: Unit test mocks for `db.$transaction` simulate rollback by rejecting the promise when an internal operation throws. However, mocks cannot prove real PostgreSQL engine multi-connection rollback mechanics, row lock release, or serializable conflict aborts.
  - **Physical Database Cascade Deletes**: Mocks verify application delete calls (`tx.task.delete`, `tx.comment.delete`), but cannot execute PostgreSQL engine-level `ON DELETE CASCADE` on subtasks or `ON DELETE SET NULL` on time logs. These are enforced by the applied PostgreSQL database schema constraints.
  - **Advisory Lock Contention**: Mocks assert that `pg_advisory_xact_lock` queries are executed, but cannot prove physical lock queueing or deadlock avoidance under concurrent multi-client load.

### 3. Verification & Monorepo Health
- **Test Suite Pass Counts**:
  - `npm run test`: 16 test files passed, **509 total tests passed (0 failures)**:
    - `src/__tests__/tasks.test.ts`: 89 tests passed (+16 new tests)
    - `src/__tests__/routeInventory.test.ts`: 73 tests passed (+4 new tests, 37 routes tested)
    - `src/__tests__/security.test.ts`: 51 tests passed
    - `src/__tests__/projects.test.ts`: 49 tests passed (+1 new test)
    - `src/__tests__/workLogs.test.ts`: 46 tests passed (+1 new test)
    - `src/__tests__/workRoles.test.ts`: 40 tests passed
    - `src/__tests__/permissions.test.ts`: 31 tests passed
    - `src/__tests__/usersAdmin.test.ts`: 25 tests passed
    - `src/__tests__/workLogExport.test.ts`: 22 tests passed
    - `src/__tests__/projectMessages.test.ts`: 18 tests passed (+2 new tests)
    - `src/__tests__/timeLogs.test.ts`: 16 tests passed
    - `src/__tests__/workLogProjectLink.test.ts`: 13 tests passed
    - `src/__tests__/auth.test.ts`: 13 tests passed
    - `src/__tests__/projectQueries.test.ts`: 10 tests passed (+1 new test)
    - `src/__tests__/projectAccess.test.ts`: 7 tests passed
    - `src/__tests__/projectProgress.test.ts`: 6 tests passed
- **Type Checking**:
  - Clean across all workspaces (`@imac/api`, `@imac/web`, `@imac/shared` via `npm run typecheck`, 0 errors).
- **Linting**:
  - Clean across all workspaces via `npm run lint` (0 errors).

### 4. Next Steps
- Review frontend components and screens for Projects, Tasks, Milestones, Time Logs, and Project Messages.

---

## Current Milestone: Step 12a — Project Screens, Part 1 (`apps/web`) — COMPLETED

### 1. What Was Built
- **API Services & Types (`apps/web/src/api/projects.ts` & `apps/web/src/types/index.ts`)**:
  - `fetchProjects`: List projects with cursor pagination (`GET /api/projects`).
  - `fetchAllAccessibleProjects`: Iterative cursor loader until `hasMore === false`.
  - `fetchProjectById`: Single project detail with members (`GET /api/projects/:id`).
  - `createProject`: Create project initiative (`POST /api/projects`).
  - `updateProject`: Edit project attributes (`PATCH /api/projects/:id`).
  - `changeProjectStatus`: Change status with required trimmed reason (`POST /api/projects/:id/status`).
  - `fetchProjectSummary`: Summary metrics including leaf progress percentage, task status counts, overdue/blocked counts, and estimated/logged hours (`GET /api/projects/:id/summary`).
  - `fetchProjectTasks` & `fetchAllTasksForProject`: Paginated project tasks (`GET /api/projects/:id/tasks`).
  - `addProjectMember`: Add active user to project (`POST /api/projects/:id/members`).
  - `removeProjectMember`: Remove user from project (`DELETE /api/projects/:id/members/:userId`).
  - Enhanced types: `ProjectStatus`, `ProjectRole`, `ProjectMember`, `ProjectListItem`, `ProjectDetail`, `ProjectSummary`, `ProjectTask`, and enriched `WorkLogEntry` with `projectName` and `taskTitle`.
- **User Directory API Inspection & Assessment (Amendment 1)**:
  - Audited `GET /api/employees` backend implementation (`apps/api/src/routes/employees.ts`).
  - Verified: Queries the `User` table directly with `where: { isActive: true }`, returning `id: u.id` (canonical User ID) for all active staff, including administrative users who do not have an `EmployeeProfile`.
  - Accessible to all authenticated users (including project managers). Confirmed 100% compliant with member assignment requirements without guessing IDs.
- **Navigation & Routing Integration**:
  - Added "Projects" navigation link with `FolderKanban` icon to both `AdminLayout.tsx` and `EmployeeLayout.tsx` for all permitted roles (`system_admin`, `hr_admin`, `project_manager`, `employee`, `viewer`).
  - Wired routes in `apps/web/src/router/index.tsx`:
    - Top-level `/projects` and `/projects/:id` redirects to role-appropriate layout paths.
    - Admin layout: `/admin/projects` and `/admin/projects/:id`.
    - Employee layout: `/employee/projects` and `/employee/projects/:id`.
- **Project List Screen (`apps/web/src/pages/projects/ProjectListPage.tsx`)**:
  - Real-time client-side search across loaded project cards by name and description.
  - Project status badge (`on_track`, `at_risk`, `off_track`, `on_hold`, `complete`).
  - Member count badge and target date formatting.
  - "Load more" button with cursor pagination (`nextCursor` and `hasMore`).
  - Role-guarded "Create Project" action button shown exclusively to `system_admin` and `project_manager`.
  - Comprehensive loading, error (with retry), and friendly empty states.
- **Project Detail Screen (`apps/web/src/pages/projects/ProjectDetailPage.tsx`)**:
  - Title, description, start date, target date, and current status badge.
  - Informational disclaimer explaining project status change history is preserved in audit logs.
  - Progress bar with task completion percentage (`progress.percentage`%) and task count breakdown (`todo`, `in_progress`, `blocked`, `done`).
  - Metrics cards for overdue count, blocked count, and estimated vs. logged hours.
  - Members table displaying staff name, username, and role badge (`manager`, `member`, `viewer`).
  - Actions visible exclusively to project managers and system administrators:
    - Edit project modal (`EditProjectModal.tsx`).
    - Change status modal (`ChangeProjectStatusModal.tsx`).
    - Add member modal (`AddProjectMemberModal.tsx`).
    - Remove member action with confirmation dialog (`ConfirmationModal.tsx`).
  - Friendly 404 Not Found and 403 Forbidden screens without revealing raw JSON errors.
- **Create & Edit Modals (`CreateProjectModal.tsx`, `EditProjectModal.tsx`)**:
  - Name, description, start date, and target date fields (`YYYY-MM-DD`).
  - Form validation enforcing that target date cannot precede start date.
  - Server validation error handling (400 `validation_error`).
  - Double-click prevention with loading state on submit button.
- **Status Change Modal (`ChangeProjectStatusModal.tsx`)**:
  - Target status dropdown and mandatory trimmed reason textarea.
  - Handles 400 `same_status`, 400 `validation_error`, 409 `conflict_retry` (offering one-click project reload), 403, and 404.
  - Only confirms success upon 2xx response, then refetches project and summary.
- **Member Management Modals (`AddProjectMemberModal.tsx`)**:
  - Member picker populated with active users from `GET /api/employees`.
  - Project role selection (`manager`, `member`, `viewer`).
  - Error handling for 409 `member_already_exists`, 400 `inactive_user`, 400 `viewer_cannot_be_member_writer`, 409 `last_manager_required`, 403, and 404.
- **Daily Work Log Pickers (Amendment 2 & Amendment 3)**:
  - Replaced free-text project and task inputs in both desktop table and mobile card views with dynamic pickers (`ProjectCell`, `TaskCell`).
  - Project picker loads only projects where the user is an active member:
    - Automatically paginates with `nextCursor` until `hasMore === false`.
    - For `system_admin`, explicitly filters down to projects where the admin has an active `ProjectMember` row.
    - Includes "No project" option.
  - Task picker:
    - Appears once a project is selected and loads that project's tasks with "No task" option.
    - Automatically hidden for users assigned as `viewer` on the chosen project.
  - Displays server-resolved `projectName` and `taskTitle` when stored on log entries.
  - Legacy free-text entries:
    - Rendered read-only with a "Legacy text" badge and a "Remove project link" button.
    - Legacy free text is never included in write payloads, protecting against server 400 `invalid_project` errors.
    - Friendly error messages for `invalid_project` and `invalid_task`.
- **Label & Translation Key Audit (Amendment 4)**:
  - Searched whole web app and renamed `(Overtime/Surplus)` to `(Over shift length)` in `apps/web/src/lib/dateUtils.ts`.
  - Fixed raw translation keys in `WorkLogSettingsPage.tsx` (`settings.*` -> `admin.settings.*`) and `UsersListPage.tsx` (`admin.users.errors.deactivateFailed`).
  - Added all English translations to `apps/web/src/i18n/locales/en.json`. Automated audit confirms 0 missing keys.

### 2. Verification Results
- `npm run test`: 16 test files passed, **509 total tests passed (0 failures)**.
- `npm run typecheck`: clean across all workspaces (`packages/shared`, `apps/api`, `apps/web`).
- `npm run lint`: clean across all workspaces (0 errors).
- `npm run build --workspace=apps/web`: built cleanly for production.

---

## Current Milestone: Step 12a-FIX — Projects Sidebar 404 Resolution, Dashboard Polish & Route Guard Verification — COMPLETED

### 1. Root Cause Analysis
- **Sidebar 404 Root Cause**:
  - In `apps/web/src/router/index.tsx`, the routes `projects` and `projects/:id` were declared as top-level redirects but were completely omitted from the `children` arrays of both the admin and employee route groups.
  - Because both `AdminLayout` and `EmployeeLayout` contain a catch-all route `{ path: '*', element: <NotFoundPage /> }`, any navigation to `/admin/projects`, `/admin/projects/:id`, `/employee/projects`, or `/employee/projects/:id` directly resolved to `NotFoundPage`.

### 2. What Was Built & Fixed
- **Route Table Registration & Redirects (`apps/web/src/router/index.tsx`)**:
  - Registered `projects` (`ProjectListPage`) and `projects/:id` (`ProjectDetailPage`) under `AdminLayout` children.
  - Registered `projects` (`ProjectListPage`) and `projects/:id` (`ProjectDetailPage`) under `EmployeeLayout` children.
  - Added role-aware top-level redirects (`ProjectsRedirect`, `ProjectParamRedirect`, helper `getProjectsRedirectPath`):
    - `system_admin` is redirected to `/admin/projects` (or `/admin/projects/:id`).
    - All other roles (`hr_admin`, `project_manager`, `employee`, `viewer`) are redirected to `/employee/projects` (or `/employee/projects/:id`).
  - Added node/browser environment safety (`typeof document !== 'undefined' ? createBrowserRouter(routes) : createMemoryRouter(routes)`) allowing zero-dependency route tests under Vitest.
- **Sidebar Navigation Dead Links Audit**:
  - Audited all sidebar items in `AdminLayout.tsx` and `EmployeeLayout.tsx`:
    - Discovered `/admin/audit-log` in `AdminLayout` (Audit log is not yet implemented) pointed to catch-all 404.
    - Discovered `/employee/leave` in `EmployeeLayout` (Phase 4 scope) pointed to catch-all 404.
    - Discovered `/employee/overtime` in `EmployeeLayout` (Phase 5 scope) pointed to catch-all 404.
  - Set `visible: false` on these three nav items so users only see links that resolve to live, functioning screens.
- **Dashboard Replacement (Amendment 1)**:
  - Replaced placeholder dashboards (`AdminDashboardPage.tsx` and `EmployeeDashboardPage.tsx`) with simple, operational start pages:
    - Personalized greeting with active user's display name.
    - Role-appropriate quick links (Work Logs, Projects, Settings, User Management).
    - "Today's Work Log" card displaying daily logged hours vs. target shift length, with a friendly no-profile state for users lacking an `EmployeeProfile` (such as administrative users).
    - "My Projects" card showing the first 5 projects with real-time status badges, member count, and direct link to project details.
    - Eliminated all duplicate text and "Phase 7" wording.
    - 100% powered by `react-i18next` translation keys (`dashboard.*` in `en.json`). No invented statistics.
- **Vitest Configuration in Web Workspace (Amendment 2)**:
  - Confirmed `vitest@2.1.9` is already hoisted at root node modules.
  - Added `"test": "vitest run"` script to `apps/web/package.json`. No external packages were installed.
- **Route Table & Security Test Suite (`apps/web/src/router/__tests__/routes.test.ts`)**:
  - Added 11 automated unit tests verifying:
    - All visible sidebar links in `AdminLayout` map to concrete routes.
    - All visible sidebar links in `EmployeeLayout` map to concrete routes.
    - Top-level `/projects` and `/projects/:id` redirect according to user system role.
    - Direct access to `/admin/*` routes strictly rejects non-admin roles (`employee`, `project_manager`, `viewer`) via `allowedRoles: ['system_admin', 'hr_admin']`.
    - Daily Log, History, Export, and Settings routes resolve correctly without hitting catch-all `*`.

### 3. Verification Results
- `npm run test`: 17 test files passed, **520 total tests passed (0 failures)**:
  - `apps/api`: 16 test files passed, 509 tests passed.
  - `apps/web`: 1 test file passed, 11 tests passed.
- `npm run typecheck`: clean across all workspaces (0 errors).
- `npm run lint`: clean across all workspaces (0 errors).
- `npm run build --workspace=apps/web`: built cleanly for production (0 errors).




---

## Current Milestone: Step 12b-1 — Task Screens Part 1 (Backend Audits, Permission Matrix Tests, Tabs, Task List, Board & Create Task) — COMPLETED

**Timestamp**: 2026-10-30 15:31:05 +05:45

### 1. What Was Built & Verified
- **Part 0: Backend Audits & Route Permission Tests**:
  - `0.1 DELETE /api/projects/:id/tasks/:taskId Audit Hardening`: Counted subtasks and cascade-deleted comments within transaction; recorded `subtaskCount` and `commentCount` in `task.deleted` audit snapshot without sensitive `description`. Verified via unit test in `tasks.test.ts`.
  - `0.2 Mutating Route Permission Matrix Test Suite`: Created `apps/api/src/__tests__/projectRoutePermissions.test.ts` running 198 automated test assertions across all mutating project endpoints using Express router introspection against caller roles (`system_admin`, `manager`, `member`, `viewer`, non-members, malformed UUIDs, and unauthenticated callers).
  - `0.3 Clean up Unused Import`: Removed unused `createAuditEntry` in `apps/api/src/routes/projects.ts`.
- **Part 1: UI Types, API Client & Task Views**:
  - `1.1 Tab Navigation`: Added URL search param tab switching (`?tab=overview|tasks|milestones`) to `ProjectDetailPage.tsx`.
  - `1.2 Tasks Tab List View`: Filterable by status, assignee, milestone, overdue, and top-level only, supporting cursor-based pagination.
  - `1.3 Tasks Tab Board View`: Kanban board featuring 4 columns (`todo`, `in_progress`, `blocked`, `done`), real API-derived transition gating (`canEditTask('changeStatus')`), open warnings indicators, and pagination load-more support.
  - `1.4 Create Task Modal`: Dialog supporting full task metadata input with real-time validation and error handling.
  - Translations: Complete English localization in `apps/web/src/i18n/locales/en.json` (0 missing keys).

### 2. Verification Results
- `npm run test`: 18 test files passed, **718 total tests passed (0 failures)**:
  - `apps/api`: 17 test files passed, 707 tests passed.
  - `apps/web`: 1 test file passed, 11 tests passed.
- `npm run typecheck`: clean across all workspaces (0 errors).
- `npm run lint`: clean across all workspaces (0 errors).
- `npm run build --workspace=apps/web`: built cleanly for production in 12.15s (0 errors).


---

## Current Milestone: Step 12b-2a — Task Detail Screen (Inline Edit, Delete, Subtasks & Shared Permissions) — COMPLETED

**Timestamp**: 2026-11-02 09:32:20 +05:45

### 1. What Was Built & Verified
- **API Client & Web Types**:
  - Added `ProjectTaskDetail` and `TaskDependencyItem` in `apps/web/src/types/index.ts`.
  - Added `fetchTaskDetail`, `patchTask`, and `deleteTask` in `apps/web/src/api/projects.ts`.
- **Pure Helpers & Test Suites**:
  - `taskPermissions.ts`: Mirrors backend `apps/api/src/services/projectAccess.ts` (`canEditTask`, `canDeleteTask`, `canCommentOnTask`). Verified via table-driven Vitest test with 54 test assertions across all roles and ownership scenarios.
  - `taskEditPayload.ts`: Pure helper validating and building PATCH payloads (unchanged fields omitted, cleared fields converted to `null`, character bounds, 0.25h increments, `YYYY-MM-DD` regex). Verified with 15 unit tests.
  - `taskLinks.ts`: Canonical link builder for task detail routes and back links across admin and employee layouts. Verified with 6 unit tests.
- **Shared Status Control Component**:
  - Extracted `TaskStatusControl.tsx` for shared status transition logic across Board and Detail screens with identical error mapping and React Query cache invalidations.
- **Task Detail Screen (`TaskDetailPage.tsx`)**:
  - Header: Breadcrumb navigation, back link to `?tab=tasks`, status badge, delete button.
  - Warnings: Assignee membership status banner when `assigneeIsProjectMember === false`.
  - Main section: Title, plain text description (`whitespace-pre-wrap`), parent subtask link badge.
  - Properties sidebar: Status selector, assignee, milestone, due date with overdue badge, estimated hours, creator, creation date.
  - Inline Edit: Edit button reveals inputs with a live 5000 character counter for description; background queries do not overwrite user input; Save sends single PATCH with changed fields.
  - Delete with Confirmation: Dialog displaying exact database cascade impact (`subtasks.length`, comment cascades, dependency cascades, time-log preservation note). On deletion, navigates back first, purges cache entry, and invalidates list keys.
  - Subtasks: List of subtasks with links, badges, assignees, due dates. Quick-add via `CreateTaskModal` with locked `defaultParentTaskId`; subtasks cannot have nested subtasks.
  - User Names: Never displays raw IDs; looks up from `project.members` or displays "Former member".
- **Routing & Navigation**:
  - Registered `/admin/projects/:id/tasks/:taskId`, `/employee/projects/:id/tasks/:taskId`, and top-level redirect `/projects/:id/tasks/:taskId`.
  - Linked task titles in List and Board views to detail page.
- **Localization**:
  - Added all English strings in `apps/web/src/i18n/locales/en.json` under `projects.taskDetail.*` (0 missing keys confirmed).

### 2. Verification Results
- `npm run test --workspace=apps/web`: 6 test files passed, **116 total tests passed (0 failures)**.
- `npm run typecheck --workspace=apps/web`: clean, **0 errors**.
- `npm run lint --workspace=apps/web`: clean, **0 errors**.
- `npm run build --workspace=apps/web`: built cleanly for production in 8.15s, **0 errors**.


---

## Current Milestone: Step 12b-2b — Task Dependencies & Comments inside TaskDetailPage (`apps/web`) — COMPLETED

**Timestamp**: 2026-11-05 09:13:00 +05:45

### 1. What Was Built & Verified
- **API Services & Web Types (`apps/web/src/types/index.ts` & `apps/web/src/api/projects.ts`)**:
  - Added `TaskCommentUser`, `TaskCommentItem`, and `TaskCommentListResponse`.
  - Added `addTaskDependency`: `POST /api/projects/:id/tasks/:taskId/dependencies` (`dependsOnTaskId`).
  - Added `removeTaskDependency`: `DELETE /api/projects/:id/tasks/:taskId/dependencies/:dependsOnTaskId`.
  - Added `fetchTaskComments`: `GET /api/projects/:id/tasks/:taskId/comments` with `limit` and `cursor`.
  - Added `createTaskComment`: `POST /api/projects/:id/tasks/:taskId/comments` (`body`).
  - Added `patchTaskComment`: `PATCH /api/projects/:id/tasks/:taskId/comments/:commentId` (`body`).
  - Added `deleteTaskComment`: `DELETE /api/projects/:id/tasks/:taskId/comments/:commentId`.
- **Pure Helpers & Test Suites**:
  - `taskDependencyHelpers.ts`:
    - `filterCandidateDependencies`: Excludes current task, existing prerequisites ("Blocked by"), and existing dependent tasks ("Blocks") per Amendment 1 to prevent immediate 2-node cycles.
    - `mapDependencyError`: Maps error codes (`self_dependency`, `dependency_cycle`, `duplicate_dependency`, `validation_error`, 403, 404) into friendly plain-language explanations (explaining cycles as circular loops where tasks wait on each other).
    - Unit tests: `apps/web/src/lib/__tests__/taskDependencyHelpers.test.ts` (11 tests passed).
  - `taskCommentPermissions.ts`:
    - `canAddComment`: Allows manager, member, and system_admin; denies project viewers.
    - `canEditComment`: Strictly comment author.
    - `canDeleteComment`: Author, project manager, or system_admin.
    - `isCommentEdited`: Returns true strictly when `updatedAt` is more than 2 seconds (>2000ms) after `createdAt` per Amendment 4.
    - Unit tests: `apps/web/src/lib/__tests__/taskCommentPermissions.test.ts` (14 tests passed).
- **Hardened Shared Status Control (`TaskStatusControl.tsx`)**:
  - Shared across both Board (Kanban) and Task Detail views per Amendment 2.
  - Formats server warnings (`open_dependency`, `open_subtasks`) in friendly plain text.
  - On 409 `open_dependency` (for non-manager members), displays an explanation listing open prerequisite titles loaded from `task.dependencies`.
  - On 403 or 404, invalidates queries and refetches so user interface does not remain stuck per Amendment 3.
- **Task Dependencies Section (`TaskDependenciesSection.tsx`)**:
  - Displays "Blocked by" (prerequisites) with status badge, due date, link, and remove button.
  - Displays "Blocks" (dependents) with status badge, due date, and link.
  - "Add Dependency" modal with candidate filtering, real-time title search, radio selection, and clear cycle/conflict error handling.
  - Remove confirmation dialog preventing accidental deletions.
  - Add and remove controls visible strictly to users with `manageDependencies` permissions (managers, system_admin, or creator/assignee for members; hidden for viewers).
- **Task Comments Subsystem (`TaskCommentsSection.tsx`)**:
  - Lists comments oldest first with "Load older comments" button powered by `useInfiniteQuery`.
  - Add comment box with 1 to 5000 character limit, trimmed, live counter, disabled during submission to prevent double-posts.
  - Informative banner for project viewers explaining they have read-only access.
  - Displays author display name (never raw user ID), formatted timestamp, and "(edited)" marker when `updatedAt` > `createdAt` + 2s.
  - Plain text rendering with `whitespace-pre-wrap` (zero `dangerouslySetInnerHTML` or HTML tags; @mentions rendered as plain text).
  - Inline comment editing for author only, with character counter and cancel/save buttons.
  - Delete comment with confirmation modal for author, manager, or system_admin.
  - Automatic cache invalidation and refetch on 403/404 per Amendment 3.
- **Verification of Create Task Modal**:
  - Audited `CreateTaskModal.tsx` against `createTaskSchema` in `packages/shared/src/schemas/task.ts`.
  - Confirmed modal constructs a payload containing strictly the 7 permitted keys (`title`, `description`, `dueDate`, `estimatedHours`, `assigneeUserId`, `milestoneId`, `parentTaskId`) conforming to `.strict()` validation without extra fields.
- **Localization**:
  - All text localized through `react-i18next` with English strings added to `apps/web/src/i18n/locales/en.json`.
  - Automated scanner confirmed 0 missing keys.

### 2. Verification Results
- `npm run test`: 25 test files passed, **848 total tests passed (0 failures)**:
  - `apps/api`: 17 test files passed, 707 passed.
  - `apps/web`: 8 test files passed, 141 passed.
- `npm run typecheck`: clean across all workspaces (`@imac/api`, `@imac/web`, `@imac/shared`), **0 errors**.
- `npm run lint`: clean across all workspaces, **0 errors**.
- `npm run build --workspace=apps/web`: built cleanly for production in 7.32s, **0 errors**.

### 3. API Gaps & Mock Limitations
- **API Gaps**: No backend API gaps were encountered. All required endpoints (`dependencies`, `comments`, `status`) exist and were integrated as specified.
- **Mock Limitations (What Unit Tests Cannot Prove)**:
  - Vitest tests in `apps/api` utilize in-memory mocks of Prisma. True PostgreSQL concurrency serialization, transactional table locks (`SELECT ... FOR UPDATE` in dependency cycle checks), physical database cascade deletions (`onDelete: Cascade`), and real network double-submit CSRF cookie token timing cannot be verified by mock-based tests and require live integration/Playwright testing on PostgreSQL.

---

## Current Milestone: Step 12b-3 — Milestones Tab in apps/web — COMPLETED

**Timestamp**: 2026-11-05 10:46:00 +05:45

### 1. What Was Built & Verified
- **API Services & Web Types (`apps/web/src/types/index.ts` & `apps/web/src/api/projects.ts`)**:
  - Added `CreateMilestonePayload` (`name`, optional `dueDate`) and `PatchMilestonePayload` (`name`, optional `dueDate`).
  - Added `createProjectMilestone`: `POST /api/projects/:id/milestones`.
  - Added `patchProjectMilestone`: `PATCH /api/projects/:id/milestones/:milestoneId`.
  - Added `completeProjectMilestone`: `POST /api/projects/:id/milestones/:milestoneId/complete`.
  - Added `reopenProjectMilestone`: `POST /api/projects/:id/milestones/:milestoneId/reopen`.
- **Pure Helpers & Test Suite (`apps/web/src/lib/milestoneHelpers.ts` & `apps/web/src/lib/__tests__/milestoneHelpers.test.ts`)**:
  - `isMilestoneOverdue`: Compares `dueDate` (YYYY-MM-DD) against the current date in the `Asia/Kathmandu` timezone. Completed milestones (`completedAt !== null`) are never overdue.
  - `computeMilestoneTaskCounts`: Iterates project tasks to return `{ total, done }` per milestone ID.
  - `getTasksForMilestone`: Filters tasks assigned to a specific milestone.
  - `canManageMilestones`: Gates create, edit, complete, and reopen actions strictly to project managers and `system_admin`.
  - `mapMilestoneError`: Maps `already_completed`, `already_open`, `validation_error`, 403, and 404 to user-friendly plain-language messages.
  - 15 unit tests covering overdue edge cases across timezones, task counting, task filtering, RBAC capability checks, and error mappings.
- **Milestones Tab Component (`apps/web/src/components/projects/MilestonesTab.tsx`)**:
  - Replaced `MilestonesTabPlaceholder.tsx` with full interactive tab in `ProjectDetailPage.tsx`.
  - Iteratively loads all project tasks using `fetchAllTasksForProject(projectId)` until `hasMore === false` so completion fractions (`X of Y tasks done`) are always exact.
  - Displays milestone name, due date, completion status, task progress count, and red "Overdue" badge when applicable.
  - Accordion interaction: clicking any milestone expands a list of its assigned tasks with title, status badge, due date, and direct link to `TaskDetailPage` via `getTaskDetailPath`.
  - Create and Edit Modals: allows setting/editing name (1–200 characters) and optional due date (`YYYY-MM-DD`), with live validation and disabled submit buttons during mutation.
  - Complete and Reopen actions: directly toggles milestone state; catches 409 `already_completed` or `already_open` and 403/404, showing friendly banners and triggering cache invalidation.
  - Add/Edit/Complete/Reopen controls are hidden for plain members and viewers.
  - Responsive layout functioning smoothly at mobile/phone width with full loading, empty, and error states.
- **Localization & Backlog**:
  - Added complete i18n key set to `apps/web/src/i18n/locales/en.json`.
  - Automated scanner confirmed 0 missing keys.
  - Added manual test backlog cases `TEST-12B-09` through `TEST-12B-13` to `docs/HAND-TEST-BACKLOG.md`.

### 2. Verification Results
- `npm run test`: 26 test files passed, **863 total tests passed (0 failures)**:
  - `apps/api`: 17 test files passed, 707 passed.
  - `apps/web`: 9 test files passed, 156 passed.
- `npm run lint`: clean across all workspaces, **0 errors**.
- `npm run typecheck`: clean across `@imac/api`, `@imac/web`, `@imac/shared`, **0 errors**.
- `npm run build --workspace=apps/web`: built cleanly for production in 6.95s, **0 errors**.

### 3. API Gaps & Mock Limitations
- **API Gaps**: None. All milestone endpoints (`/milestones`, `/milestones/:milestoneId`, `/complete`, `/reopen`) were already present and conform to spec.
- **Mock Limitations (What Unit Tests Cannot Prove)**:
  - Unit tests in `milestoneHelpers.test.ts` verify pure logic (Kathmandu date comparison, task counting, RBAC, error code translation) using deterministic mock objects.
  - They do not test live network latency, database unique constraints or transaction locks on PostgreSQL, or real browser DOM reflow at mobile screen resolutions.

---

## Current Milestone: Step 12c-1 — Project Time Logs, Workload & Project Summary (apps/web) — COMPLETED

**Timestamp**: 2026-11-05 15:12:00 +05:45

### 1. What Was Built & Verified
- **API Services & Web Types (`apps/web/src/types/index.ts` & `apps/web/src/api/projects.ts`)**:
  - Added types: `ProjectTimeLog`, `ProjectTimeLogListResponse`, `CreateTimeLogPayload`, `PatchTimeLogPayload`, `ProjectWorkloadResponse`, `ProjectWorkloadMember`.
  - Added API endpoints: `fetchProjectTimeLogs`, `createProjectTimeLog`, `patchProjectTimeLog`, `deleteProjectTimeLog`, `fetchProjectWorkload`, `fetchProjectOverdueTasks`, `fetchProjectBlockedTasks`.
- **Pure Helpers & Test Suites**:
  - `timeLogPermissions.ts`:
    - Role-based permissions matching `apps/api/src/routes/timeLogs.ts` and `apps/api/src/services/projectAccess.ts`.
    - Viewers cannot log and cannot view the Time tab or Task Time section per Amendment 2.
    - `system_admin` without a member row cannot log time (sees notice instead of form).
    - Edit and delete are strictly author-only for everyone (including managers and system_admin).
    - Unit tests: `timeLogPermissions.test.ts` (63 table-driven tests passed).
  - `timeLogTotals.ts`:
    - `sumTimeLogHours`: handles number, string, null, undefined, and NaN inputs safely.
    - `groupTimeLogsByDate`: groups by calendar date part (`extractDatePart`) handling both date strings and ISO timestamps.
    - Unit tests: `timeLogTotals.test.ts` (7 tests passed).
  - `timeLogPayload.ts`:
    - Date min/max bounds in Kathmandu (`[-90, +1]` days).
    - Quarter-hour increment validation (`0.25` step, `> 0`, max 24).
    - Patch payload diffing: omits unchanged fields and passes `null` to clear task or note per Amendment 8.
    - Unit tests: `timeLogPayload.test.ts` (11 tests passed with explicit `referenceToday`).
  - `projectTabHelpers.ts`:
    - Validates tab parameter against `'overview' | 'tasks' | 'milestones' | 'time' | 'workload'`.
    - Falls back to `'overview'` if unknown or if `canSeeTime` is false.
    - Unit tests: `projectTabHelpers.test.ts` (3 tests passed).
  - `dateUtils.ts`:
    - Hardened `formatHours` to safely accept string, null, undefined, and NaN, returning `"-"` without breaking existing callers (23 tests passed in `dateUtils.test.ts`).
  - `timeLogErrorHelpers.ts`:
    - User-friendly localized error mapping for `daily_hours_exceeded`, `invalid_date_range`, `invalid_task`, `invalid_cursor`, `validation_error`, 403, and 404.
- **Time Logs UI (`TimeLogsTab.tsx`)**:
  - Filterable by Task and Person (Person filter restricted to managers and system_admin).
  - Filter change resets cursor/pagination to first page.
  - Infinite scroll with "Load older time logs" button.
  - Totals clearly labeled as "Total of loaded rows: Xh" or "Total: Xh".
  - Log Time modal with Kathmandu today default, quarter-hour steps, task picker, live note counter (5000 chars).
  - Author-only inline edit modal and delete confirmation dialog.
- **Task Detail Integration (`TaskTimeLogsSection.tsx`)**:
  - Embedded in `TaskDetailPage.tsx`, scoped by `taskId`.
  - Hidden for project viewers.
  - Log time modal prefilled with the task.
  - Author-only edit and delete controls.
- **Workload View (`ProjectWorkloadTab.tsx`)**:
  - Displays member rows with open tasks count, estimated hours, and logged hours.
  - Column labeled "Your Logged Hours Only" for plain members; other members' logged hours masked as `'-'` (never 0 and excluded from totals).
  - Displays unassigned / departed assignee tasks section card.
  - Responsive: table transforms into stacked cards at phone width (<640px).
- **Overview Tab Enhancements**:
  - Added "Overdue Tasks" and "Blocked Tasks" cards linking up to 5 tasks via `getTaskDetailPath`.
  - Reflects exact aggregate counts from project summary.
- **Docs & Backlog**:
  - Added Question 36 to `docs/open-policy-questions.md`.
  - Added test cases `TEST-12C-01` through `TEST-12C-06` to `docs/HAND-TEST-BACKLOG.md`.

### 2. Verification Results
- `npm run test`: 30 test files passed, **950 total tests passed (0 failures)**:
  - `apps/api`: 17 test files, 707 passed.
  - `apps/web`: 13 test files, 243 passed.
- `npm run lint`: clean across all workspaces, **0 errors**.
- `npm run typecheck`: clean across `@imac/api`, `@imac/web`, `@imac/shared`, **0 errors**.
- `npm run build --workspace=apps/web`: built production bundle in 7.35s, **0 errors**.

### 3. API Gaps & Mock Limitations
- **API Gaps**: Date range filtering (`startDate`, `endDate`) is not supported by `GET /api/projects/:id/time-logs` (route only supports `limit`, `cursor`, `userId`, `taskId`). Total hours is only returned at project level in `/summary`, not per task or list filter.
- **Mock Limitations (What Unit Tests Cannot Prove)**:
  - Unit tests verify in-memory calculations and logic. They do not test live PostgreSQL advisory transaction locks (`pg_advisory_xact_lock`), high-concurrency race conditions across browser tabs, or real DOM reflow under physical mobile hardware.



---

## Current Milestone: Step 12c-2 — Project Messages Tab (apps/web) — COMPLETED

**Timestamp**: 2026-11-13 10:55:00 +05:45

### 1. What Was Built & Verified
- **API Services & Web Types (`apps/web/src/types/index.ts` & `apps/web/src/api/projects.ts`)**:
  - Added types: `ProjectMessageUser`, `ProjectMessage`, `ProjectMessageListResponse`, `ConvertedTask`, `ConvertToTaskResponse`.
  - Added API endpoints: `fetchProjectMessages`, `createProjectMessage`, `pinProjectMessage`, `unpinProjectMessage`, `convertProjectMessageToTask`.
- **Pure Helpers & Test Suites (`apps/web/src/lib/projectMessageHelpers.ts` & `apps/web/src/lib/__tests__/projectMessageHelpers.test.ts`)**:
  - `canPostMessage(callerProjectRole, systemRole)`:
    - Allowed only for systemRole in `['system_admin', 'project_manager', 'employee', 'hr_admin']` (mirroring `apps/api/src/lib/permissions.ts:83-85`).
    - Project role: `system_admin`, `manager`, or `member`. Disallows `viewer` or unknown role.
  - `canPinMessage(callerProjectRole, systemRole)`:
    - Allowed only for systemRole in `['system_admin', 'project_manager', 'employee', 'hr_admin']`.
    - Project role: `system_admin` or `manager`. Disallows `member`, `viewer`, or unknown role.
  - `canConvertToTask(callerProjectRole, systemRole, userId)`:
    - Allowed only for systemRole in `['system_admin', 'project_manager', 'employee', 'hr_admin']` (mirroring `task:write`).
    - Calls `canEditTask(callerProjectRole, isSystemAdmin, 'create', null, userId)`. Fails closed if `userId` is missing/empty for a member.
  - Table-driven unit tests: 37 tests in `projectMessageHelpers.test.ts` covering all combinations (system_admin without member row, manager, member, project viewer, system-role viewer who is manager/member, missing role, unknown role, agreement with `canEditTask`).
  - `deduplicateMessagesById(pages)`: Flattens infinite query pages and deduplicates by message id preserving server order.
  - `getConvertedMessageKey(projectId, messageId)` & `isMessageConverted`: Manages session-based conversion tracking scoped by `${projectId}:${messageId}`.
  - `mapProjectMessageError(err)`: Plain-language translation mapper for `already_converted` (409), `invalid_cursor` (400), `validation_error` (400), `forbidden` (403), `not_found` (404), and fallback unexpected errors.
- **Date Formatting (`apps/web/src/lib/dateUtils.ts` & `apps/web/src/lib/__tests__/dateUtils.test.ts`)**:
  - `formatDateTimeDisplay(isoString)`: Formats ISO timestamps to `Asia/Kathmandu` with year and 24h clock (`hourCycle: 'h23'`). Verified with `2026-11-02T18:30:00.000Z` -> `3 Nov 2026, 00:15`, and `2026-11-02T18:16:00.000Z` -> `3 Nov 2026, 00:01`. Returns `"-"` on invalid input; never throws.
- **Cache Invalidation (`apps/web/src/lib/projectTaskCache.ts`)**:
  - Centralized cache invalidator `invalidateProjectTaskCaches` invalidating all verified task and summary query keys: `projectTasksInfinite`, `projectTasks`, `topLevelTasks`, `projectSummary`, `projectWorkload`, `projectOverdueTasks`, `projectBlockedTasks`, `projectTasksAll`.
- **Navigation & MessagesTab UI (`MessagesTab.tsx` & `ProjectDetailPage.tsx`)**:
  - Messages tab in `<nav>` alongside Overview, Tasks, Milestones, Time (gated by `canSeeTime`), and Workload.
  - Plain-text message rendering with `whitespace-pre-wrap break-words font-sans text-sm`.
  - Author name resolution with fallback to `"Former member"`; never raw UUID.
  - Pinned badge indicator; managers and system_admin can pin/unpin with immediate reset.
  - 1–5000 char trimmed post form with live counter; viewers see read-only informational banner. Double-submit prevented via `isPending` and local ref guard. Text preserved on failure.
  - Convert to Task confirmation dialog accurately explaining what the API really creates (one unassigned task in 'todo', title from first line up to 200 chars, full body as description, original message unchanged, can be converted only once).
  - Session tracking remembers converted messages, displays "Converted" badge with direct task link, and keeps convert button accessible after reload (server enforces 409).
  - Cursor recovery: on 400 `invalid_cursor`, automatically recovers to page 1 once with an informational banner (no infinite retry loop).

### 2. Verification Results
- `npm run test`: 31 test files passed, **989 total tests passed (0 failures)**:
  - `apps/api`: 17 test files, 707 passed.
  - `apps/web`: 14 test files, 282 passed.
- `npm run lint`: clean across all workspaces, **0 errors**.
- `npm run typecheck`: clean across `@imac/api`, `@imac/web`, `@imac/shared`, **0 errors**.
- `npm run build --workspace=apps/web`: production build succeeded cleanly.

### 3. Known Backend Limitations & Mock Limitations
- **Known Backend Limitations**:
  - Simultaneous conversions ARE prevented (advisory lock plus audit check inside one transaction in apps/api/src/routes/messages.ts); the real limits are (a) "already converted" is derived from the audit log only, so archiving or deleting audit rows would allow a second conversion, and (b) deleting the created task leaves the message permanently unconvertible.
- **Mock Limitations (What Unit Tests Cannot Prove)**:
  - Pure helper unit tests verify role matrix logic, error mapping, and string formatting in memory. They do not test live SSE notification delivery, physical mobile viewport touch interactions, or real concurrent database connections.


---

## Maintenance Note: Step 12c Test Suite Stabilization (2026-11-15 & 2026-11-16)
- **Time Log Date Range Test**: Fixed `apps/api/src/__tests__/timeLogs.test.ts` where wall-clock progression to `2026-11-15` caused a fixed future date test to return 201 instead of 400. Installed Vitest fake timers (`vi.useFakeTimers({ toFake: ['Date'] })`) set to `2026-11-13T06:00:00Z` restored in `afterEach`, and added exact boundary checks (+1d allowed, +2d refused, -90d allowed, -91d refused in Asia/Kathmandu).
- **Shared Test Date Helper & Permissions Test Stabilization (Items 10-12)**:
  - Created shared helper `apps/api/src/__tests__/testDateHelper.ts` (`getKathmanduDate`, `getKathmanduToday`) to dynamically calculate Asia/Kathmandu dates and calendar day offsets without freezing system timers or adding external packages.
  - Used shared helper in `apps/api/src/__tests__/timeLogs.test.ts` for dynamic `todayStr` and boundary offsets (`+1d`, `+2d`, `-90d`, `-91d`).
  - Confirmed `apps/api/src/__tests__/projectRoutePermissions.test.ts` line 264 sent fixed date `'2026-10-28'` to `POST /api/projects/:id/time-logs`, which accepts `[-90 days, +1 day]` relative to Kathmandu today and would fail on 2027-01-27. Fixed by deriving `workDate: getKathmanduDate(-1)` via `testDateHelper.ts`. Verified lines 486 and 494 are unvalidated mock DB returns and left them untouched.
  - Performed comprehensive date audit across all remaining test files sending dates to routes (`workLogs`, `workLogExport`, `workLogProjectLink`, `projects`, `tasks`) and calculated exact calendar expiration dates for unfrozen clocks.
- **Date-Fix Final Round (Items 1-7 & 5 Additional Requirements)**:
  - Frozen `Date` in `apps/api/src/__tests__/workLogs.test.ts` and `apps/api/src/__tests__/workLogProjectLink.test.ts` at `2026-10-30T06:00:00Z` in `beforeEach`, cleaned up in `afterEach`. All date literals fall within `[2026-08-01, 2026-10-31]`. Confirmed sessions, edit window logic, and optimistic locks operate identically.
  - Added two explicit midnight boundary tests to `apps/api/src/__tests__/timeLogs.test.ts` proving Asia/Kathmandu timezone (+05:45) is enforced rather than UTC (18:14 UTC evaluates as Nov 13; 18:15 UTC evaluates as Nov 14).
  - Executed 120-day forward time-travel verification using external setup configuration in `$env:TEMP`; confirmed 0 date-related regressions.
- **Verification**: All 991 automated tests passing (apps/api: 709, apps/web: 282), 0 lint/typecheck errors.

---

## Current Milestone: Dev-Only Demo Data Tooling (apps/api) — COMPLETED

### 1. What Was Built
- **Environment & Safety Guard (`apps/api/scripts/demoGuard.ts`)**:
  - Pure function `validateDemoEnvironment(env)` enforcing hard safety boundaries:
    - Rejection if `NODE_ENV === 'production'`.
    - Rejection if `ALLOW_DEMO_DATA !== 'yes'`.
    - Rejection if database host is not `localhost` or `127.0.0.1`.
    - Rejection if database name in `DATABASE_URL` does not contain `'demo'`.
    - Rejection if `demo` appears only in username, password, or host, but not in the database name.
    - Rejection if `DEMO_PASSWORD` is shorter than real system password policy length (`MIN_PASSWORD_LENGTH = 10`, matching `SystemSetting` key `auth.minPasswordLength` and `apps/api/src/routes/auth.ts:179`).
    - **Security Invariant**: Never prints or leaks database URLs, usernames, passwords, or credentials in refusal error messages.
  - Pure Kathmandu date helpers: `getKathmanduToday` and `getKathmanduOffsetDate` resolving across timezone boundaries.
  - Pure planned time log validator `validatePlannedTimeLogs` verifying Kathmandu submission window (`[-90, +1] days`) and daily $\le 24$h user total cap.
  - Pure dependency graph cycle detector `validateDependencyGraph` ensuring directed acyclic graphs without self-dependencies or cycles.
  - Defined canonical 18-step reverse child-to-parent deletion order `DEMO_DELETION_ORDER` with pure validator `validateDeletionOrder` confirming every child entity precedes its parent.
- **Pure Data Definitions (`apps/api/scripts/demoDataDefs.ts`)**:
  - 6 role-aligned demo personas:
    - `demo_admin` (`system_admin`, `DEMO-ADM`)
    - `demo_hr` (`hr_admin`, `DEMO-HR`)
    - `demo_pm` (`project_manager`, `DEMO-PM`)
    - `demo_dev` (`employee`, `DEMO-DEV`)
    - `demo_designer` (`employee`, `DEMO-DES`)
    - `demo_viewer` (`viewer`, `DEMO-VW`)
    - All configured with login invariants: `isActive: true`, `mustChangePassword: false`, `failedLoginCount: 0`, `lockedUntil: null`.
  - 3 demo work roles prefixed with `[DEMO] `: `[DEMO] Full Stack Engineering`, `[DEMO] UI/UX Design`, `[DEMO] Project Coordination`.
  - 4 realistic demo projects prefixed with `[DEMO] `:
    - `[DEMO] Nepal Disaster Relief Portal` (`on_track`) with Devanagari text (`नेपाल विपद् व्यवस्थापन पोर्टल`) and raw hostile test text (`<script>alert(1)</script>`, `<b>bold</b>`).
    - `[DEMO] Valley Transit App` (`at_risk`) with `ProjectStatusEvent` record explaining transit syndicate GPS latency.
    - `[DEMO] Heritage Preservation Archive` (`complete`) with `ProjectStatusEvent` record for archaeological catalog completion.
    - `[DEMO] Solar Grid Micro-Management` (`on_hold`) with `ProjectStatusEvent` record for AEPC regulatory clearance.
  - Hostile test strings stored strictly RAW:
    - `DEMO_HOSTILE_TITLE_200`: Exactly 200 characters containing raw `<script>alert(1)</script>` and `<b>bold</b>`.
    - `generateHostileMarkdown5000()`: Structured markdown document $\ge 5000$ characters containing tables, checklists, JSON payloads, and Devanagari Unicode.
  - Former member scenario: `demo_dev` added as project member on Disaster Relief Portal, creates tasks, comments, messages, and time logs, then membership row is deleted within transaction to test historical contribution retention for revoked members.
  - 4 WorkLogEntry rows linked to demo projects and tasks (`projectId` and `taskId` populated for valid members).
- **Seed, Remove, and Status CLI Scripts (`apps/api/scripts/`)**:
  - `demoSeed.ts`: Guard-validated, pre-checks that no demo data exists, pre-hashes passwords with Argon2id before transaction, writes all records in a single atomic transaction with 120-second timeout, outputs summary counts and IDs (no secrets) to `.demo-manifest.txt`.
  - `demoRemove.ts`: Guard-validated, deletes demo records in strict 18-step reverse order inside a single transaction, removes manifest.
  - `demoStatus.ts`: Guard-validated, reports counts of active demo records per entity type without leaking secrets or IDs.
  - Added npm scripts to `apps/api/package.json`: `demo:seed`, `demo:remove`, `demo:status`.
  - Added documentation in `apps/api/scripts/README.md` using credential-safe PowerShell pattern.
  - Added `.demo-manifest.txt` to `.gitignore`.
- **Automated Test Suite (`apps/api/src/__tests__/demoData.test.ts`)**:
  - 57 comprehensive tests verifying guard refusal rules (including empty/malformed URLs, host query param redirects, port validations, exact `imac_demo` matching with decoded URL and whitespace rejection, and `requirePassword: false`), Kathmandu date offsets (`resolveOffsetDate` returning UTC midnight Date), shared demo record lookups with task count equality in mocked runs, time log daily 24h cap across all projects, work log validator rules (`validatePlannedWorkLogs`), dependency DAGs, deletion order code extraction against `demoRemove.ts`, schema foreign key relation parser (29 relation pairs), boundary lengths (200-char title, 4990-char description), linked entry current membership, and model specifications.

### 2. Verification Results
- `npm run test`: 32 test files passed, **1,048 total tests passed (0 failures)**:
  - `apps/api`: 18 test files, **766 passed** (well above 760 requirement; +57 demo suite tests).
  - `apps/web`: 14 test files, **282 passed**.
- `npm run lint`: clean across all workspaces, **0 errors**.
- `npm run typecheck`: clean across `@imac/api`, `@imac/web`, `@imac/shared`, **0 errors**.
- `npm run build -w @imac/api`: compiled clean with `tsc -p tsconfig.build.json`. Confirmed 0 demo files in `dist` (`scripts/` and `src/__tests__/` excluded). Zero git tracking of `dist`.



---

## Current Milestone: Demo-Data Tooling Hardening & Model Coverage — COMPLETED

### 1. Correction Note & Architectural Changes
- **Type-Safe Re-Export & Import Fix (`apps/api/scripts/demoGuard.ts`)**:
  - Corrected re-export in `apps/api/scripts/demoGuard.ts`: exported `findDemoRecordIds` as a value export and `DemoRecordIds`, `DemoLookupClient` via `export type`.
  - Audited all script imports across `apps/api/scripts/`, ensuring no type definitions are re-exported or imported as runtime values.
  - Eliminated runtime Node ESM `SyntaxError: The requested module './demoLookup.js' does not provide an export named 'DemoLookupClient'`.
- **Active Database Safety Assertion (`assertConnectedToDemoDatabase`)**:
  - Implemented `assertConnectedToDemoDatabase(prisma)` in `apps/api/scripts/demoGuard.ts`.
  - Executes `SELECT current_database()` via `prisma.$queryRaw` and enforces strict invariants:
    - Must return an array of length exactly 1.
    - Row must contain the exact column key `current_database`.
    - Column value must strictly equal `"imac_demo"` (not `"imac"`, not uppercase, not partial).
    - Refuses unexpected row count, malformed columns (e.g. `datname`), empty results, or wrong database names.
    - Query rejection throws a sanitized error without leaking connection URLs or credentials.
  - Mounted immediately after `new PrismaClient()` in `try` block across `demoSeed.ts`, `demoRemove.ts`, and `demoStatus.ts` BEFORE any other query or write.
  - Configured `try/catch/finally` across all CLI scripts to set `process.exitCode = 1` on error and guarantee `await prisma.$disconnect()` completes in `finally`.
- **Specification Alignment in Documentation & Header Comments**:
  - Updated file headers in `demoGuard.ts`, `demoRemove.ts`, `demoStatus.ts`, and `demoSeed.ts` along with `apps/api/scripts/README.md` to state that the connected database name must be exactly `"imac_demo"` (not just contain `"demo"`), and that `DEMO_PASSWORD` is required only by `demoSeed.ts` (not required by `demoRemove.ts` or `demoStatus.ts`).
- **Prisma Schema Model Coverage**:
  - Checked `apps/api/prisma/schema.prisma`: verified all 19 models (`User`, `EmployeeProfile`, `WorkRole`, `EmployeeWorkRole`, `Session`, `SystemSetting`, `AuditLog`, `AvailabilityStatus`, `WorkLogDay`, `WorkLogEntry`, `Project`, `ProjectMember`, `ProjectStatusEvent`, `Milestone`, `Task`, `TaskDependency`, `Comment`, `ProjectMessage`, `TimeLog`).
  - Confirmed `TaskStatusEvent` does **not** exist in `schema.prisma`.
  - All 18 demo data models are covered in `DEMO_DELETION_ORDER` in reverse child-to-parent order; the 1 non-demo model (`SystemSetting`) is accounted for in `NON_DEMO_MODELS` with explicit documented rationale.
- **Two-Layer CLI & Re-Export Verification**:
  - Layer 1: Child process test executing `tsx` on `demoStatus.ts`, `demoRemove.ts`, and `demoSeed.ts` under a scrubbed environment (`NODE_ENV=test`, zero demo env vars), asserting graceful `REFUSED` output without `SyntaxError`.
  - Layer 2: Static source code scan scanning `apps/api/scripts/*.ts` verifying no type-only declarations are re-exported as runtime values.

### 2. Verification Results
- `npm run test`: 32 test files passed, **1,061 total tests passed (0 failures)**:
  - `apps/api`: 18 test files, **779 passed** (+13 new tests).
  - `apps/web`: 14 test files, **282 passed**.
- `npm run lint`: clean across all workspaces, **0 errors**.
- `npm run typecheck`: clean across all workspaces (`@imac/api`, `@imac/web`, `@imac/shared`), **0 errors**.

---

## Current Milestone: Step 09a Review — Daily Work Log Fixes (`apps/web` only) — COMPLETED

### 1. Correction Note: Step 12a Picker Claim on DailyWorkLogPage.tsx
Commit `e0f698c` claimed to deliver Project/Task pickers on `DailyWorkLogPage.tsx`. In reality, that commit created `ProjectTaskPicker.tsx` in isolation without importing or rendering it on `DailyWorkLogPage.tsx`. The page only added an unbounded `memberProjects` query and two error-code mappings, while row entries continued to render raw free-text `<Input>` fields for `projectId` and `taskId`. Any free-text input resulted in backend 400 `invalid_project`. This review step completes the actual picker wiring, active manager/member filtering, legacy free-text badges, error translation ordering, and hydration safeguards.

### 2. What Was Built
- **Project & Task Pickers (`apps/web/src/components/workLogs/ProjectTaskPicker.tsx` & `DailyWorkLogPage.tsx`)**:
  - `ProjectPicker`: Selects projects where the caller is an active member with role `manager` or `member`.
  - `TaskPicker`: Appears only after an eligible project is selected, loads tasks for that project via `fetchAllTasksForProject`, includes "No task" option, and resets selection when the project changes.
  - Replaced raw text inputs in `DailyWorkLogPage.tsx` desktop table and mobile card views with `ProjectPicker` and `TaskPicker`.
  - Hides both pickers completely when the user has no eligible projects (unless an existing entry has legacy text).
  - Displays legacy free-text IDs read-only with a "Legacy text" badge and allows removing/clearing the link.
  - Removed unused import `fetchAllTasksForProject` from `DailyWorkLogPage.tsx` (now imported and consumed by `ProjectTaskPicker.tsx`).
- **Project Membership Filtering**:
  - Noted that `GET /api/projects` list data returns `memberCount` but does not include `members` or current user's role. Detailed requests (`fetchProjectById`) are loaded for the projects to inspect membership.
  - Implemented `isProjectEligibleForUser` and `filterEligibleProjects` pure helpers in `apps/web/src/lib/dailyWorkLogHelpers.ts`. Ensures viewer-only projects or non-member projects are never offered.
- **Payload Sanitization**:
  - Implemented `buildWorkLogEntriesPayload` in `apps/web/src/lib/dailyWorkLogHelpers.ts`. Legacy free-text strings in `projectId` or `taskId` are dropped to `null`, guaranteeing write payloads never trigger backend 400 `invalid_project` or `invalid_task`.
- **Error Handling & Window Lock (`resolveWorkLogError`)**:
  - Replaced `err.message || translateErrorCode(err)` with `resolveWorkLogError(err, translateCode, { onWindowExpired })`.
  - Prioritizes API error codes over axios `err.message` so that `invalid_project`, `invalid_task`, and `edit_window_expired` display friendly translated text and lock the form upon window expiration.
  - Preserved `err.message` for non-API client errors.
  - Verified and added i18n keys in `en.json` (`invalidProject`, `invalidTask`, `legacyBadge`, `loadError`, `loadErrorDesc`).
- **Load Error Resilience**:
  - When fetching daily work logs encounters an error (other than 404 `profile_not_found`), `DailyWorkLogPage.tsx` renders a dedicated error card with a `Retry` button calling `refetchLog()` instead of an empty page.
- **Hydration Stabilization**:
  - Extracted `EMPTY_WORK_ROLES = []` and `EMPTY_MEMBER_PROJECTS = []` stable module constants to prevent array recreation on every render.
  - Removed `myRoles` from the hydration effect dependency array, using `isRolesSuccess, isLogError, isLoadingRoles, isRolesError`.
  - Guarded against overwriting user-typed rows while roles are loading, after a failed load, or on re-renders via `hasUserTypedRows`.
- **Small Fixes**:
  - Repaired garbled bullet encoding (`â€¢` -> `•`) in server warnings list.
  - Guarded date change handler against empty strings: cleared date input does not request or send empty dates.
- **Automated Unit Tests (`apps/web/src/lib/__tests__/dailyWorkLogHelpers.test.ts`)**:
  - 25 pure unit tests covering project eligibility (including viewer-only negatives), legacy text dropping in payloads (including legacy projectId/taskId negatives), error resolution precedence (axios `err.message` not preferred over known code), window expired lock callback, and hydration row protection.

### 2. Verification Results
- `npm run test --prefix apps/web`: 15 test files passed, **307 total tests passed (0 failures)** (+25 tests).
- `npm run lint --prefix apps/web`: clean, **0 errors**.
- `npm run typecheck --prefix apps/web`: clean, **0 errors**.
- Zero backend edits, zero new npm packages.

---

## Current Milestone: Step 09a Review (Part 2) — TaskPicker Hook Crash & Project Change Reset — COMPLETED

### 1. What Was Built
- **Hook Ordering Repair (`TaskPicker` in `ProjectTaskPicker.tsx`)**:
  - Hoisted `useQuery` unconditionally to top level of `TaskPicker`, eliminating the React crash "Rendered more hooks than during the previous render" when switching from "No project" to a chosen project.
  - Enabled query with precomputed `hasChosenProject = Boolean(projectId && isValidUuid(projectId))`.
  - Positioned early returns (`isLegacyText(taskId)`, `!hasChosenProject`, and `isReadOnly`) strictly after all hook declarations.
- **Project Change Reset (`applyProjectChangeToRow` in `dailyWorkLogHelpers.ts`)**:
  - Implemented pure helper `applyProjectChangeToRow(row, newProjectId)` enforcing invariant that changing project ALWAYS resets `taskId = ''`.
  - Wired `DailyWorkLogPage.tsx` desktop and mobile project change handlers through `applyProjectChangeToRow`.
  - Added 5 pure unit tests for `applyProjectChangeToRow`.
- **Hooks Audit**: Scanned all files across `apps/web/src` confirming unconditional hook calls.

### 2. Verification Results
- `npm run test`: 33 test files passed, **1,096 total tests passed (0 failures)**.
- `npm run lint`: clean, **0 errors**.
- `npm run typecheck`: clean, **0 errors**.
- Zero backend edits, zero new npm packages.

---

## Current Milestone: Step 09a Review (Part 3) — Daily Work Log Date-Change Hydration & Bullet Fixes — COMPLETED

### 1. Root Cause Analysis
- **(A) Date Change Rows Blocking**:
  - In `DailyWorkLogPage.tsx`, the hydration effect previously checked `if (hasUserTypedRows(prev)) return prev;` without tracking which calendar date those entries belonged to.
  - When a user typed rows on Date A and switched to Date B (especially a blank unlogged date), `hasUserTypedRows(prev)` was `true` because `prev` still contained Date A's rows.
  - Consequently, the effect returned `prev` unchanged, blocking Date B from hydrating or initializing fresh blank rows.
- **(B) Garbled Bullet Character**:
  - `DailyWorkLogPage.tsx` previously rendered literal Unicode character `•` (U+2022) at line 504 and contained an encoding artifact `â€¢` in a comment at line 494.
  - `en.json` contains no bullet characters.
  - Rendering literal non-ASCII bytes in JSX caused encoding misinterpretation (`â€¢`) in browsers lacking explicit UTF-8 document parsing headers.

### 2. What Was Built
- **Pure Hydration Helper (`shouldHydrateForDate` in `dailyWorkLogHelpers.ts`)**:
  - Implemented pure helper `shouldHydrateForDate(selectedDate, hydratedForDate, hasTypedRowsForThisDate)`.
  - Enforces three key invariants:
    1. Clearing the date (`!selectedDate || !selectedDate.trim()`) never hydrates (`false`).
    2. Changing date (`selectedDate !== hydratedForDate`) ALWAYS permits hydration (`true`); typed rows from another date do NOT block hydration.
    3. On the SAME date (`selectedDate === hydratedForDate`), user-typed rows block overwrite (`false`), while an unedited form allows fresh data to hydrate (`true`).
  - Added 7 unit tests covering all branch combinations in `dailyWorkLogHelpers.test.ts`.
- **Hydration Marker & Unsaved Changes Warning (`DailyWorkLogPage.tsx`)**:
  - Introduced `hydratedForDate` state tracker.
  - In `handleDateChange`, if user has typed rows (`hasUserTypedRows(entries)`), prompts native confirmation `window.confirm(t('workLog.daily.discardPrompt'))` before discarding unsaved rows.
  - In the hydration effect, when `selectedDate !== hydratedForDate`, previous day's rows are ALWAYS discarded and replaced with a fresh empty row (or saved server entries if already fetched), setting `hydratedForDate = selectedDate`.
  - While roles or new date query is pending, user-typed rows on the SAME date are strictly preserved from overwrite.
  - The query key `['work-log', 'by-date', selectedDate]` includes the date; a failed load shows the existing error card with `Retry` without rendering the previous day's rows.
- **CSS List Bullet Fix**:
  - Replaced literal `•` and `â€¢` with standard HTML `<ul>` and `<li>` using Tailwind's `list-disc pl-4 space-y-0.5`.
  - Zero non-ASCII characters remain in `DailyWorkLogPage.tsx`.
- **i18n Key**: Added `workLog.daily.discardPrompt` to `apps/web/src/i18n/locales/en.json`.

### 3. Verification Results
- `npm run test`: 33 test files passed, **1,103 total tests passed (0 failures)** (+7 new tests in `dailyWorkLogHelpers.test.ts`).
  - `apps/api`: 18 test files, **779 passed**.
  - `apps/web`: 15 test files, **324 passed**.
- `npm run lint`: clean across all workspaces, **0 errors**.
- `npm run typecheck`: clean across all workspaces, **0 errors**.
- Zero backend edits, zero new npm packages.
- Note: Vitest in `apps/web` does not render DOM/React components; component behavior is verified via manual hand test.

---

## Current Milestone: Step 09a Review (Part 4) — Review of Remaining Step 9a Screens (`apps/web` only) — COMPLETED

### 1. Scope & Execution Mode
- Report-only static review of remaining Step 9a screens and dependencies:
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
- Zero code modifications made; zero backend edits; zero new npm packages; no database connections made; application server not run.

### 2. Summary of Identified Issues
- **Hook Violation (`WorkLogSettingsPage.tsx:33-35`)**: Early return `<UnauthorizedPage />` precedes hook invocations (`useState`, `useQuery`, `useEffect`, `useMutation`), risking React runtime crashes if rendered by non-admins or during auth state hydration.
- **Silent Query Failures (`WorkLogHistoryPage.tsx:84-103`, `WorkLogSettingsPage.tsx:46-55`)**:
  - `WorkLogHistoryPage`: `isMonthError` and `isWeekError` are ignored in the UI, misleading users by rendering 0 hours and "No work logs recorded" on server 500 / network outage instead of an error card with Retry.
  - `WorkLogSettingsPage`: `isError` is ignored in JSX, allowing uninitialized forms with default values (`true`, `warn`, `24`) to render and potentially overwrite custom server settings if saved.
- **Raw Axios Error Strings (`WorkLogSettingsPage.tsx:109`)**: `err.message` is rendered directly in form alerts instead of resolving API error envelopes `{ error: "code", message: "..." }`.
- **Date Inputs & Boundary Handling**:
  - `WorkLogHistoryPage.tsx:635`: Clearing week start date input sends `?startDate=` to the API and generates invalid date calculations (`addDays("", i) => ""`).
  - `WorkLogExportPage.tsx:78-80`: `new Date()` date span comparison yields `NaN` on invalid manual date inputs, bypassing the 366-day range guard.
- **Inline Array Instantiations in Dependencies (`WorkLogSettingsPage.tsx:47, 78`)**: `data: settings = []` creates new array references in the `useEffect` dependency array, risking re-render thrashing.
- **Export Mime-Type & Blob Error Parsing**:
  - `WorkLogExportPage.tsx:109-120`: Parses blob error responses on HTTP >= 400, but lacks specific network error branching (`!err?.response`).
  - `api/workLogs.ts:107`: Unconditionally downloads response as `.xlsx` without verifying `content-type`.
- **Non-ASCII Characters**: Literal em-dashes `—` (U+2014) in `WorkLogHistoryPage.tsx` (lines 487, 505, 766).
- **Role Permissions & Layout Guards**: `AdminLayout` and `router/index.tsx` enforce strict RBAC (`system_admin` for settings, `worklog:readOwn` for exports, `viewer` read-only work log).

### 3. Verification Results
- All 1,103 automated tests across 33 test files continue to pass (0 failures).
- Component-level render paths and interactive error cards rely on hand-test backlog scenarios.

---

## Current Milestone: Step 09a Files Review Fixes (`apps/web` only) — COMPLETED

### 1. Scope & Objectives
- Fixed confirmed findings identified during Step 9a screens review across `apps/web`:
  - `apps/web/src/pages/admin/WorkLogSettingsPage.tsx`
  - `apps/web/src/pages/workLogs/WorkLogHistoryPage.tsx`
  - `apps/web/src/pages/workLogs/WorkLogExportPage.tsx`
  - `apps/web/src/api/workLogs.ts`
  - `apps/web/src/pages/dashboard/AdminDashboardPage.tsx`
  - `apps/web/src/pages/dashboard/EmployeeDashboardPage.tsx`
  - `apps/web/src/i18n/locales/en.json`
- Created dedicated pure helpers and unit test suite:
  - `apps/web/src/lib/workLogReviewHelpers.ts`
  - `apps/web/src/lib/__tests__/workLogReviewHelpers.test.ts`
- Strictly frontend (`apps/web`) only; zero backend edits made (`apps/api`); zero schema changes; zero new npm packages; Daily Work Log files untouched.

### 2. What Was Built & Fixed
- **Pure Functional Helpers & Unit Test Suite (`apps/web/src/lib/workLogReviewHelpers.ts`)**:
  - `isValidCalendarDate(dateStr)`: Strictly validates `YYYY-MM-DD` formatting, 1-12 months, and exact day bounds per month including February leap year rules (`2024-02-29` is valid, `2026-02-29` and `2026-02-31` are invalid).
  - `resolveWorkLogErrorInfo(error)`: Authoritative error resolver: only treats `data.error` as an error code if it is a non-empty string (ignoring objects, arrays, booleans, numbers); maps missing responses to `code: 'network_error'` with translated message key `common.networkError`; resolves HTTP 403, 404, 401, and `profile_not_found`.
  - `shouldHydrateSettings(isHydrated, isDirty)`: Protects form inputs from being clobbered by background refetches once edited by user.
  - `shouldUpdateWeekStartDate(newDate)`: Rejects empty strings and whitespace, ensuring empty dates are never stored or queried.
  - Added 22 unit tests in `apps/web/src/lib/__tests__/workLogReviewHelpers.test.ts` covering standard and boundary negative cases (impossible dates, leap years, non-string error codes, network outages).
- **WorkLogSettingsPage Hardening (`apps/web/src/pages/admin/WorkLogSettingsPage.tsx`)**:
  - **Hook Ordering**: Moved all React hooks (`useState`, `useQuery`, `useEffect`, `useMutation`) above the role check so no hook sits after an early return.
  - **Failed Load Error Card**: If settings query fails (`isError`), renders an error card with a `Retry` button and strictly does NOT render the settings form.
  - **Controlled Render**: Renders the form only when `isSuccess` is true; an empty list (`settings = []`) from a successful load shows defaults (`true`, `warn`, `24`), while loading, disabled, or failed queries never show the default form.
  - **Form Hydration & Dirty State**: Module-level stable empty constant `EMPTY_SETTINGS = []`; hydration runs only when unhydrated or clean; `isDirty` and `isHydrated` reset cleanly upon successful save and on Retry.
  - **Save Error Presentation**: Resolves errors using `resolveWorkLogErrorInfo` to show translated error messages (`common.networkError`, `common.forbidden`, `admin.settings.errors.<code}>`), eliminating raw `err.message` or `AxiosError` strings.
- **WorkLogHistoryPage Silent Failure & Date Guards (`apps/web/src/pages/workLogs/WorkLogHistoryPage.tsx`)**:
  - **Month & Week Error Cards**: When `isMonthError` or `isWeekError` occurs, replaces the 0-hours summary cards and empty views with a dedicated error card and `Retry` button (`refetchMonth()` / `refetchWeek()`).
  - **Empty Week Start Date Guard**: Input `onChange` ignores empty strings (`shouldUpdateWeekStartDate`), and the week query explicitly enforces `enabled: activeTab === 'week' && Boolean(weekStartDate && weekStartDate.trim().length > 0)`, preventing `?startDate=` requests.
  - Em-dashes in titles were left untouched.
- **WorkLogExportPage Date Validation & Roles Error State (`apps/web/src/pages/workLogs/WorkLogExportPage.tsx`)**:
  - **Strict Calendar Date Validation**: Validates both `startDate` and `endDate` with `isValidCalendarDate` before checking date ordering and the 366-day span limit, each with its own translated error message.
  - **Work Roles Query Error State**: Captures `isError` on `fetchMyWorkRoles` and renders an inline error alert with a `Retry` button for the work roles dropdown.
  - Blob error parsing safely extracts string codes and handles network drops (`!err?.response`).
- **Single Error Resolver Invariant & Dashboard Hardening**:
  - `apps/web/src/api/workLogs.ts` (`getWorkLogErrorInfo`): Refactored to delegate directly to `resolveWorkLogErrorInfo`, maintaining a single error-code resolver across the client.
  - Inspected all callers (`AdminDashboardPage.tsx`, `EmployeeDashboardPage.tsx`): Added error notification blocks so network and server errors are displayed with friendly translated messages rather than silently falling through to "not started / 0h logged".
- **Localization Keys Added (`apps/web/src/i18n/locales/en.json`)**:
  - Added `common.networkError`, `common.networkErrorDesc`, `common.forbidden`.
  - Added `dashboard.logLoadError`, `dashboard.logLoadErrorDesc`.
  - Added `admin.settings.loadErrorTitle`, `admin.settings.loadErrorDesc`.
  - Added `workLog.history.monthLoadError`, `workLog.history.monthLoadErrorDesc`.
  - Added `workLog.history.weekLoadError`, `workLog.history.weekLoadErrorDesc`.
  - Added `workLog.export.errors.invalidDate`, `workLog.export.errors.rolesLoadError`.

### 3. Verification & Test Results
- **Automated Tests**:
  - All 18 test files in `apps/api` passed: **779 passed**.
  - All 16 test files in `apps/web` passed: **346 passed** (+22 new tests in `workLogReviewHelpers.test.ts`).
  - Monorepo total: **34 test files, 1,125 tests passed (0 failures)**.
- **Linter & Type Check**:
  - `npm run lint`: clean across all workspaces (0 errors).
  - `npm run typecheck`: clean across all workspaces (0 errors).
- **Production Build**:
  - `npm run build --workspace=apps/web`: built cleanly in 8.07s.
- **Manual Test Backlog**:
  - Appended `TEST-09A-FIX-01`, `TEST-09A-FIX-02`, `TEST-09A-FIX-03`, `TEST-09A-FIX-04` marked `NOT RUN` to `docs/HAND-TEST-BACKLOG.md`.
- **Honest Disclaimer**:
  - Vitest in `apps/web` operates in a Node environment executing pure TypeScript logic. Interactive component mounting, React hook lifecycle ordering, and visual error card render paths are verified via manual test scenarios in the hand-test backlog.

---

## Current Milestone: Step 19a — Audit Log Read API (apps/api only, no screen) — COMPLETED

### 1. What Was Built
- **Central Permissions (`apps/api/src/lib/permissions.ts`)**:
  - Added new action `auditlog:readProject`.
  - Granted to `system_admin` and `project_manager`.
  - Existing `auditlog:read` retained exclusively for `system_admin`.
  - Strictly denied to `hr_admin`, `employee`, and `viewer`.
  - Protected files untouched (`password.ts`, `session.ts`, `auth.ts`, `routes/auth.ts`, and `prisma/*`).
- **Audit Logs Router (`apps/api/src/routes/auditLogs.ts`)**:
  - Mounted at `/api/audit-logs` in `apps/api/src/app.ts` under standard `csrfMiddleware`, `requireAuth`, and `requirePasswordChanged`.
  - **Read-Only Invariant**: Implements only `GET /api/audit-logs`; mutating HTTP methods (`POST`, `PUT`, `PATCH`, `DELETE`) return HTTP 404. Reading the audit log does not trigger audit log creation.
  - **Zod & Custom Query Validations**:
    - `from` and `to`: YYYY-MM-DD formatted calendar dates parsed and interpreted in `Asia/Kathmandu` timezone.
    - Default to the last 30 calendar days when omitted.
    - Calendar date validity checks reject impossible dates (e.g. `2026-02-31`).
    - Date range validations enforce `to >= from` and maximum 366 calendar days span.
    - Exclusive upper bound: filters `createdAt < startOfDay(to + 1)` in `Asia/Kathmandu`.
    - `actorUserId`: UUID format validation.
    - `action`: Validated against known action strings.
    - `entityType`: Validated against known entity types.
    - `projectId`: UUID format validation. For `project_manager`, must be one of their actively managed projects; otherwise returns uniform 404 `not_found` (same as non-member projects).
    - `limit`: Validated integer with default 50 and maximum 100.
    - `offset`: Validated non-negative integer with default 0 (0 is accepted and respected).
    - Reject empty strings on all query parameters with HTTP 400 `validation_error`.
  - **Database Project Scoping for `project_manager`**:
    - Managed project IDs resolved from database query where `userId = caller.id AND isActive = true AND projectRole = 'manager'`.
    - Database-level project filtering using parameterized SQL (`Prisma.sql` / `Prisma.join`), ensuring pagination counts (`total`) are strictly accurate in the database query without post-fetch array truncation.
    - If `project_manager` manages zero projects, immediately returns `{ items: [], total: 0, limit, offset }`.
    - **Amendment F**: If `project_manager` requests an `entityType` or `action` outside project entities, returns `{ items: [], total: 0, limit, offset }` with HTTP 200 without throwing 403 or leaking existence.
    - Non-project audit entries (`User`, `Session`, `SystemSetting`, `WorkLogDay`, `WorkRole`, `EmployeeProfile`) and unmappable actions (`time_log.removed`) are strictly inaccessible to `project_manager`.
  - **Sanitization & Privacy Allow-Lists (Amendment C)**:
    - Actor fields strictly mapped to `{ id, displayName, username }` (placeholder `{ id, displayName: "Deleted User", username: "deleted" }` if actor is null/deleted).
    - Dropped all private text, credentials, and free text from snapshots: `body`, `note`, `description`, `comment`, `message`, `password`, `token`, `hash`, `secret`, `ip`, `userAgent`, and `reason`.
    - `SYSTEM_ADMIN_ALLOW_LIST`: Explicit allow-list of operational identifiers and status keys without `reason`.
    - `PROJECT_MANAGER_ALLOW_LIST`: Narrow project-specific allow-list stripping administrative user attributes (`employeeCode`, `department`, `jobTitle`, `systemRole`, `lockedUntil`, `failedLoginCount`).
  - **Read-Only SQL Safety Check File (`docs/audit-log-manager-project-check.sql`)**:
    - Documented SQL script targeted at `imac_demo` for static database inspection.
    - Explicit header notes: read-only, not executed against live databases during automated tests.

### 2. Verification & Test Results
- **Automated Tests (`apps/api/src/__tests__/auditLogs.test.ts` & `permissions.test.ts`)**:
  - `apps/api/src/__tests__/auditLogs.test.ts`: **26 tests passed (0 failures)**:
    - 401 unauthenticated.
    - 403 forbidden for `hr_admin`, `employee`, and `viewer`.
    - 200 for `system_admin` with organization-wide visibility.
    - 200 for `project_manager` scoped strictly to managed projects.
    - Empty list for `project_manager` managing 0 projects.
    - 404 `not_found` for `project_manager` requesting non-managed projects or projects where they are only a plain member/viewer.
    - Amendment F: empty list when `project_manager` queries non-project entityType/action.
    - Validation of offset=0, limit > 100, impossible calendar dates (`2026-02-31`), `to < from`, date range > 366 days, empty strings, and malformed UUIDs.
    - Snapshot stripping of secrets and free-text reason for `system_admin`.
    - Snapshot stripping of administrative employee fields for `project_manager`.
    - Deleted actor placeholder rendering.
    - Read-only invariant: 404 for mutating methods, no audit entry written on read.
    - Amendment D: static scan verifying no `$queryRawUnsafe` or raw string concatenation.
    - Amendment G: static scan verifying all route entityTypes are classified into project-mappable or admin-only categories.
  - `apps/api/src/__tests__/permissions.test.ts`: **33 tests passed (0 failures)** (+7 tests for `auditlog:read` and `auditlog:readProject` across all 5 roles).
- **Full Monorepo Test Run (`npm run test`)**:
  - `apps/api`: 19 test files passed, **807 tests passed (0 failures)**.
  - `apps/web`: 16 test files passed, **346 tests passed (0 failures)**.
  - Combined Total: **35 test files, 1,153 tests passed (0 failures)**.
- **Lint & Typecheck**:
  - `npm run lint`: clean across all workspaces (0 errors).
  - `npm run typecheck`: clean across all workspaces (0 errors).
- **Hand-Test Backlog**:
  - Appended `TEST-19A-01` through `TEST-19A-05` marked `NOT RUN` to `docs/HAND-TEST-BACKLOG.md`.
- **Policy Documentation**:
  - Appended Question 38 to `docs/open-policy-questions.md`.

### 3. What is Untested & Assumptions
- **Untested via Vitest (Mock-Based Limitations)**:
  - Mock tests mock database operations via Vitest spies and Prisma client delegates.
  - Real PostgreSQL JSON extraction performance (e.g. `beforeSnapshot->>'projectId'` and sequential scans) and live PostgreSQL date arithmetic across daylight savings/timezone boundaries cannot be verified with mocks.
  - The read-only SQL check file (`docs/audit-log-manager-project-check.sql`) was not run against live database instances.
- **Assumptions**:
  - `time_log.removed` entries cannot be mapped reliably to projects due to physical record deletion and absence of `projectId` in their snapshots; they remain admin-only.
  - Free-text `reason` fields could contain sensitive unstructured text and are removed from snapshot exposure for both `system_admin` and `project_manager`.

---

## Current Milestone: Step 19a-fix — Corrections to Audit Log Router (apps/api only) — COMPLETED

### 1. What Was Fixed & Hardened
- **Project Manager Leak Boundary (Item 1)**:
  - Added outer SQL condition joined with `AND` to the project-scope block for `project_manager`:
    `a."entityType" IN (PROJECT_MAPPABLE_ENTITY_TYPES) AND a."action" IN (PROJECT_ACTIONS)` with all values bound as parameterized SQL values via `Prisma.join`.
  - Guarantees that generic `beforeSnapshot->>'projectId'` and `afterSnapshot->>'projectId'` clauses never match non-project entities such as `work_log.*`, `user.*`, `auth.*`, `settings.*`, `work_role.*`, or `employee_profile.*` rows.
  - Added integration tests asserting query strings and bound parameter values in `$queryRaw`, and proving that `work_log.edited_after_submit` with a `projectId` snapshot is strictly outside the scope definition.
- **Definitive Decision on `time_log.removed` (Item 2)**:
  - Verified snapshot written at `apps/api/src/routes/timeLogs.ts` line 559: `beforeSnapshot: { taskId, workDate, hours }`. Because `time_log.removed` has no `projectId`, row deletion prevents live ID joining, and `taskId` is optional, `time_log.removed` CANNOT be mapped reliably to projects.
  - Kept `time_log.removed` strictly in `ADMIN_ONLY_ACTIONS` and excluded from `PROJECT_ACTIONS`, enforced at the database query level for `project_manager`.
- **Query Parameter Array & Object Hardening (Item 3)**:
  - Validates that every query parameter is a plain string. Arrays (e.g. `?from=a&from=b`) and objects (e.g. `?from[nested]=val`) immediately return HTTP 400 `validation_error`.
  - Guaranteed that `.trim()` is never called on a non-string value.
  - Tested across all 8 parameters (`from`, `to`, `actorUserId`, `action`, `entityType`, `projectId`, `limit`, `offset`).
- **Fail-Closed Role Check (Item 4)**:
  - Added an explicit `else` branch after `if (isProjectManager) ... else if (isSystemAdmin) ...`: returns HTTP 403 `forbidden` and terminates immediately, ensuring an unscoped database query can never execute.
  - Added test verifying fail-closed behavior.
- **UUID Validation & Clean ASCII Comments (Item 5)**:
  - Replaced local `UUID_REGEX` with the project's standard `isValidUuid` imported from `apps/api/src/services/projectAccess.ts` (accepting any RFC UUID).
  - Replaced all Unicode box-drawing characters with plain ASCII `--` comments in `auditLogs.ts` and `auditLogs.test.ts`.
- **Route Guard Test Coverage (Item 6c)**:
  - Documented why `routeInventory.test.ts` (originally scoped to 37 `/api/projects/*` routes) and `projectRoutePermissions.test.ts` (originally scoped to mutating project routes) did not cover `GET /api/audit-logs`.
  - Added dedicated guard tests for `GET /api/audit-logs` in both test suites, verifying 401 unauthenticated, 403 viewer, 404 non-managed project, and 200 authorized manager/admin access.
- **SQL Leak Verification Query (Item 7)**:
  - Added query 4 to `docs/audit-log-manager-project-check.sql` counting `AuditLog` rows whose `entityType` is NOT project-mappable but whose snapshot `projectId` matches a managed project. Shows the count of non-project rows that the API guarantees to exclude (returning 0) for project managers.

### 2. Verification & Test Results
- **Automated Tests**:
  - `apps/api`: 19 test files passed, **819 tests passed (0 failures)** (+5 new tests in `auditLogs.test.ts`, +2 in `routeInventory.test.ts`, +5 in `projectRoutePermissions.test.ts`).
  - `apps/web`: 16 test files passed, **346 tests passed (0 failures)**.
  - Full Monorepo: **35 test files passed, 1,165 tests passed (0 failures)**.
- **Linter & Typecheck**:
  - `npm run lint`: clean across all workspaces (0 errors).
  - `npm run typecheck`: clean across all workspaces (0 errors).

### 3. Open Policy Additions & Scoping Decisions
- **Time Log Audit Log Scoping: Deletion and Taskless Updates**:
  - `time_log.removed` is strictly admin-only. Its snapshot records only `{ taskId, workDate, hours }` without `projectId`, and because the DB row is physically deleted and `taskId` is optional, it cannot be mapped to a project.
  - `time_log.updated` entries for time logs with no task (taskless time logs) rely on a live SQL subquery join on `TimeLog.id` (`SELECT tl.id FROM "TimeLog" tl WHERE tl."projectId" = ANY(...)`). Therefore, they are only visible to managers while the time log still exists in the database. If that time log is subsequently deleted, past `time_log.updated` entries for it become unmappable to the project and are no longer visible to managers (visible to `system_admin` only).

### 4. QA Session Section
- **Automated Playwright Tests to Write**:
  1. `LIVE-19A-01`: Log in as `demo_pm`, open `/api/audit-logs`, verify HTTP 200 with `{ items, total, limit, offset }` and no 500 error (proves PostgreSQL array binding).
  2. `LIVE-19A-02`: Log in as `demo_pm`, test `?projectId=` with a managed project (200 JSON), an unmanaged project (404 not_found), and `?from=a&from=b` (400 validation_error).
  3. `LIVE-19A-03`: Leak test: As `demo_dev`, edit a submitted work log linked to a managed project; verify `demo_pm` does NOT see that `work_log.edited_after_submit` row, while `system_admin` does.
  4. `LIVE-19A-04`: Verify `demo_dev` and `demo_hr` receive 403 forbidden on `/api/audit-logs`.
  5. `LIVE-19A-05`: As `demo_pm`, create a task with a description and a project message with body text; verify audit snapshots contain no description or message text.
- **EntityType Casing Check**:
  - Verify that `project`, `milestone`, and `comment` entityTypes are written in the lowercase spelling (`project`, `milestone`, `comment`) expected by the manager project filter SQL (`LOWER(a."entityType") = 'project'`, `LOWER(a."entityType") = 'milestone'`, `LOWER(a."entityType") = 'comment'`), while `Task`/`task` is normalized with lowercase comparison, and `ProjectMessage` is exact casing.



