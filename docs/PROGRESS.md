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

### 4. What is Untested (Awaiting Environment / Next Steps)
- Applying migrations to live PostgreSQL database container in Docker.
- React frontend UI screens for user administration, work role assignments, and employee directory (Phase 1 frontend).
- End-to-end browser integration tests with Playwright (scheduled for Phase 7).

---

### 5. Assumptions Made
- The canonical identifier `employeeId` used in routes and frontend calls represents `userId` (UUID).
- HR administrators are permitted to update employee profile operational fields (`user:update`), but are strictly barred from altering system roles (`user:changeRole`).
- Deactivating an employee account immediately clears all associated active sessions in PostgreSQL (`deleteUserSessions`).

---

### 6. What the Next Step Needs (Phase 1 Frontend)
- System admin UI screens in `apps/web`:
  - User creation, deactivation, and system role management modal/page.
  - Temporary password display dialog with one-time copy button.
  - Employee profile editor (department, job title, shift hours, working days).
  - Work role catalogue and employee work role assignment screen.
  - Searchable employee directory table/cards with role-based field visibility and availability indicators.
