# IMAC Nepal Internal Operations System — Implementation Progress

## Current Milestone: Phase 0 (Foundation) — COMPLETED

### 1. What Was Built
- **Monorepo Layout & Workspace Setup**:
  - `apps/api`: Node.js + Express + TypeScript + Prisma.
  - `apps/web`: React + Vite + TypeScript + Tailwind CSS + shadcn/ui.
  - `packages/shared`: Shared TypeScript types (`SystemRole`, `AuthUser`, `ApiError`) and Zod schemas (`loginSchema`, `changePasswordSchema`, `createUserSchema`, `updateUserRoleSchema`).
- **Database & Prisma Schema (`apps/api/prisma/schema.prisma`)**:
  - Implemented models: `User`, `EmployeeProfile`, `Session`, `SystemSetting`, `AuditLog`.
  - Configured PostgreSQL datasource with UUID primary keys and UTC timestamps.
  - Idempotent seed script (`prisma/seed.ts`) seeding 12 configurable `SystemSetting` defaults and the 2 initial `system_admin` users (`boss`, `akrit`) from environment variables.
- **Authentication & Security Engine (`apps/api/src`)**:
  - Server-side PostgreSQL-backed sessions with inactivity timeout and sliding window renewal (`Session` model).
  - Password management using Argon2id (`argon2id` variant with tuned memory/time parameters) and secure temporary password generation.
  - Failed login tracking with configurable lockout threshold (default 5 attempts) and duration (default 15 minutes).
  - First-time login forced password change flow (`mustChangePassword`).
  - Admin password reset generating one-time temporary passwords and setting `mustChangePassword = true`.
  - Protection against self-deactivation and self-role changes by administrators.
  - Double-submit cookie CSRF protection (`csrf-csrf`) with bypass during automated unit testing.
  - Append-only audit logger service recording logins, logouts, lockouts, password resets, role changes, and account status alterations.
- **Central Authorization Matrix (`apps/api/src/lib/permissions.ts`)**:
  - Single `can(user, action)` policy function covering all 5 system roles (`system_admin`, `hr_admin`, `project_manager`, `employee`, `viewer`).
  - Express authorization middlewares: `requireAuth`, `requireRole`, `requirePasswordChanged`, `requirePermission`.
- **Frontend App Shell (`apps/web`)**:
  - React Router v7 configured in SPA / library mode (`createBrowserRouter`).
  - Strict internationalization via `react-i18next` with complete English keys (`locales/en.json`) for all authentication, navigation, and role labels.
  - `LoginPage` with validation, lock countdown/formatting, and CSRF token binding.
  - `ChangePasswordPage` with confirmation verification.
  - Role-based nested layouts: `AdminLayout`, `EmployeeLayout`, `GuestLayout`.
  - Accessible UI primitives inspired by shadcn/ui (`Button`, `Input`, `Label`, `Card`, `Alert`, `Badge`, `Form`, `Spinner`).
  - TanStack Query client for caching session state and handling auth state synchronization.
- **Infrastructure & Deployment (`deploy/`)**:
  - `docker-compose.yml` defining services: `postgres` (16-alpine), `app` (Node 20 multi-stage build), and `caddy` (2-alpine).
  - `Caddyfile` configured with local trusted certificates, security headers, reverse proxy to Express `/api/*`, and static file serving for web build.
  - Automated database & uploaded assets backup script (`backup.sh`) with 30-day retention cleanup.
- **Documentation**:
  - `README.md` with instructions for local development and containerized production deployment.
  - `docs/open-policy-questions.md` covering Part C questions and Phase 0 policy questions.
  - `.env.example` documenting all configuration keys.

---

### 2. Verification & Test Results
- **Type Checking**:
  - `packages/shared`: Clean (`tsc --noEmit`)
  - `apps/api`: Clean (`tsc --noEmit`)
  - `apps/web`: Clean (`tsc --noEmit`)
- **Unit & Integration Tests**:
  - Vitest test suite (`apps/api`): 2 test files, 23 passing tests (0 failures).
    - `src/__tests__/auth.test.ts`: 13 tests verifying login, password verification, lockout threshold, logout, me endpoint, password change, and forced change enforcement.
    - `src/__tests__/permissions.test.ts`: 10 tests verifying positive and negative permission matrix across all 5 roles.
- **Production Build**:
  - `apps/web`: Vite production build passed (`dist/` generated).

---

### 3. What is Untested (Awaiting Environment / Next Steps)
- End-to-end integration against a live running PostgreSQL instance (requires Docker Compose or live Postgres connection to execute `npx prisma migrate dev` and `prisma/seed.ts`).
- Playwright E2E browser tests (scheduled for Phase 7).
- SSE-driven real-time notifications (Phase 6).

---

### 4. Assumptions Made
- Default session inactivity timeout set to 30 minutes.
- Default account lockout set to 5 attempts with a 15-minute lockout period.
- Minimum password length set to 10 characters.
- Initial seeded administrator accounts do not force password change by default in dev, but flag `ADMIN_REQUIRE_PASSWORD_CHANGE=true` is recommended for production.
- All policy questions logged in `docs/open-policy-questions.md`.

---

### 5. What the Next Step Needs (Phase 1)
- Prompt: **PHASE 1: Users, employees and work roles (admin side)**.
- Needs:
  - System admin screens to create/deactivate users, set system roles, edit employee profiles (shift length, working days, department), and reset passwords.
  - The `WorkRole` catalogue schema and backend APIs.
  - Admin assignment of specific work roles to each specific employee.
  - Searchable employee directory showing permitted fields only.
  - Audit logging of all user and work role administrative actions.
