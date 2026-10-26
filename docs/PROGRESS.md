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
