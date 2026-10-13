# IMAC Nepal Internal Operations System — Implementation Progress

## Current Milestone: Work Roles Backend (Master Brief Section 7) — COMPLETED

### 1. What Was Built
- **Database Models & Migration**:
  - `WorkRole` (UUID `id`, unique `name`, optional `description`, `isActive` boolean defaulting to true, `createdAt`, `updatedAt`, `employeeWorkRoles` relation).
  - `EmployeeWorkRole` (UUID `id`, `employeeProfileId` FK, `workRoleId` FK, `createdAt`, unique constraint `@@unique([employeeProfileId, workRoleId])`).
  - `EmployeeProfile` updated with `workRoles EmployeeWorkRole[]` relation.
  - Migration created and preserved: `apps/api/prisma/migrations/20261013093000_work_roles/migration.sql`.
  - Prisma client generated with the new models and relations.
- **Shared Validation Schemas & Types (`@imac/shared`)**:
  - `createWorkRoleSchema`, `updateWorkRoleSchema`, `assignWorkRoleSchema` and their inferred TypeScript types exported from `packages/shared/src/schemas/workRole.ts` and built.
- **Central Authorization Layer (`apps/api/src/lib/permissions.ts`)**:
  - Added actions `workrole:create`, `workrole:read`, `workrole:update`, `workrole:deactivate`, `workrole:assign`, `workrole:remove`, `workrole:readEmployee`.
  - Configured all administrative work role actions to be accessible strictly by `system_admin`.
- **Administrative Work Roles APIs (`apps/api/src/routes/admin/workRoles.ts`)**:
  - `POST /api/admin/work-roles` — Create work role (validates schema, checks name uniqueness, creates audit entry `work_role.created`).
  - `GET /api/admin/work-roles` — List all work roles ordered by name.
  - `GET /api/admin/work-roles/:id` — Retrieve a single work role.
  - `PATCH /api/admin/work-roles/:id` — Edit work role name/description/status (validates schema, prevents name conflicts, creates audit entry `work_role.updated`).
  - `PATCH /api/admin/work-roles/:id/deactivate` — Deactivate work role (`isActive: false`, creates audit entry `work_role.deactivated`).
  - `POST /api/admin/work-roles/employees/:employeeId/work-roles` — Assign work role to employee:
    - Resolves employee profile by `employeeProfileId` or `userId`.
    - Enforces business rule: deactivated work roles cannot be newly assigned (HTTP 400 `invalid_action`).
    - Enforces business rule: assigning the same role twice returns HTTP 409 conflict and prevents duplicates.
    - Creates audit entry `work_role.assigned`.
  - `DELETE /api/admin/work-roles/employees/:employeeId/work-roles/:workRoleId` — Remove assigned role from employee (creates audit entry `work_role.removed`).
  - `GET /api/admin/work-roles/employees/:employeeId` — List all work roles assigned to a specific employee.
- **Employee Self-Service API (`apps/api/src/routes/workRoles.ts`)**:
  - `GET /api/work-roles/my-roles` — Returns only active work roles assigned to the authenticated user's employee profile.
  - Prevents IDOR by resolving identity strictly from the authenticated session (`req.user.id`).
- **CSRF & Security Integration (`apps/api/src/app.ts`)**:
  - Mounted `/api/admin/work-roles` under `csrfMiddleware`.
  - All state-changing routes (POST, PATCH, DELETE) enforce CSRF tokens in production/staging.
  - All asynchronous route handlers are wrapped with `asyncHandler`.
- **Automated Integration Tests (`apps/api/src/__tests__/workRoles.test.ts`)**:
  - 40 dedicated tests covering admin CRUD, RBAC boundaries across all 5 system roles (`system_admin`, `hr_admin`, `project_manager`, `employee`, `viewer`), CSRF enforcement, duplicate assignment rejection, deactivated role assignment prevention, and employee self-service isolation.
- **Policy Documentation (`docs/open-policy-questions.md`)**:
  - Added Question 7 under Section 3 recording work role customization authority policies.

---

### 2. Verification & Test Results
- **Type Checking**:
  - Clean across all workspaces (`packages/shared`, `apps/api`, `apps/web` via `npm run typecheck`).
- **Unit & Integration Tests**:
  - Vitest test suite (`apps/api`): 4 test files, **114 passing tests (0 failures)**:
    - `src/__tests__/permissions.test.ts`: 10 tests passed
    - `src/__tests__/auth.test.ts`: 13 tests passed
    - `src/__tests__/security.test.ts`: 51 tests passed
    - `src/__tests__/workRoles.test.ts`: 40 tests passed
- **Monorepo Build**:
  - `@imac/shared` compiled clean (`dist/` generated).

---

### 3. What is Untested (Awaiting Environment / Next Steps)
- Applying database migrations against live production PostgreSQL database in Docker Compose.
- React frontend UI screens for work role administration and employee assignment.
- End-to-end browser tests via Playwright (scheduled for Phase 7).

---

### 4. Assumptions Made
- Work role customization authority is restricted exclusively to `system_admin` per Master Brief Section 7. Policy Question 7 in `docs/open-policy-questions.md` documents whether HR or Project Managers should be granted role customization permissions in future phases.
- Employees can view only their own assigned work roles that are currently active (`isActive === true`).

---

### 5. What the Next Step Needs
- Admin UI for user and employee management (Phase 1 frontend):
  - Interface for managing users and system roles.
  - Interface for creating/editing work roles and assigning work roles to employees.
  - Searchable employee directory showing permitted fields.
- Daily Work Log subsystem (Phase 2):
  - Enabling employees to select from their assigned work roles when submitting daily task logs.
