# Open Policy Questions — IMAC Nepal Internal Operations System

This document tracks unresolved policy, organizational, and operational decisions that require confirmation from IMAC leadership. Default implementations have been provided in Phase 0 using neutral system settings or configuration flags.

---

## 1. Authentication & Session Security (Phase 0)

1. **Admin Initial Password Change**
   - **Question**: Should seeded initial administrative accounts (`boss`, `akrit`) be forced to change their passwords upon first login?
   - **Current Implementation**: Configurable via `ADMIN_REQUIRE_PASSWORD_CHANGE` environment variable (default: `false` in development, recommended `true` in production).

2. **Session Inactivity Timeout**
   - **Question**: What is the designated idle inactivity timeout for user sessions before automatic logout?
   - **Current Implementation**: 30 minutes (stored in `SystemSetting`: `session.inactivityTimeoutMinutes = "30"`).

3. **Account Lockout Policy**
   - **Question**: What are the acceptable failed login attempt limits and temporary lockout durations?
   - **Current Implementation**: 5 consecutive failed attempts trigger a 15-minute lockout (stored in `SystemSetting`: `auth.lockoutThreshold = "5"`, `auth.lockoutDurationMinutes = "15"`).

4. **Minimum Password Complexity & Length**
   - **Question**: What is the minimum password character length and complexity rule for IMAC personnel?
   - **Current Implementation**: 10 characters minimum (stored in `SystemSetting`: `auth.minPasswordLength = "10"`).

5. **Session Cookie Persistence**
   - **Question**: Should session cookies persist across browser restarts (remember me) or clear immediately on browser exit?
   - **Current Implementation**: Session cookies without persistent `maxAge`, destroyed when the browser session closes or on inactivity expiration.

6. **Audit Log Access Scoping**
   - **Question**: Which roles are permitted to inspect append-only audit trail records?
   - **Current Implementation**: Restricted exclusively to `system_admin` in `src/lib/permissions.ts`.

7. **Single Concurrent Session vs. Multi-Session Policy**
   - **Question**: When a user successfully logs in, should prior active sessions from other devices or browsers be automatically terminated, or may staff maintain concurrent active sessions across office workstations?
   - **Current Implementation**: Multi-session allowed; login issues a new session cookie but does not delete prior session records from PostgreSQL.

8. **Admin Self-Password Reset Guard**
   - **Question**: Should system administrators be blocked from using the administrative temporary password reset endpoint on their own account (`POST /api/admin/users/:id/reset-password`), requiring them instead to change passwords via the standard authenticated `/change-password` endpoint?
   - **Current Implementation**: Blocked (HTTP 400 `invalid_action`); administrators must use `/api/auth/change-password` to change their own password, preserving audit clarity and requiring the current password.

9. **Cross-Admin Password Reset & Sudo Mode**
   - **Question**: Can one system administrator (`boss` or `akrit`) unilaterally reset the password of another system administrator, or should administrative actions targeting other administrators require credential re-verification (sudo mode) or mutual confirmation?
   - **Current Implementation**: Allowed and fully audited; any `system_admin` can reset another user's (including another admin's) password without re-entering credentials. A policy question remains whether sudo-mode re-authentication should be required for cross-admin actions in future phases.

10. **Administrative Password Reset Throttling**
    - **Question**: What is the maximum permitted rate of temporary password generations per administrator per hour?
    - **Current Implementation**: Rate limited at 10 requests per 15 minutes per IP (`resetPasswordLimiter`).

---

## 2. Infrastructure & Local Network Deployment

1. **Local Network Hostname & DNS**
   - **Question**: What dedicated local network hostname or static IP address will host the internal operations system?
   - **Current Implementation**: `imac.local` configured in Caddy reverse proxy (`deploy/Caddyfile`) with local trusted certificates.

2. **Backup Retention & Off-site Rotation**
   - **Question**: What is the required retention window for automated database dumps and uploaded media?
   - **Current Implementation**: 30 days retention (`KEEP_DAYS=30` in `deploy/backup.sh`), with files stored in `/backups`.

---

## 3. Operations & Work Log Policies (Subsequent Phases)

1. **Work Log Approval Workflow**
   - **Question**: Do daily employee work logs require explicit project manager or HR approval before recording?
   - **Current Implementation**: `worklog.requiresApproval = "false"` in `SystemSetting`.

2. **Work Log Discrepancies**
   - **Question**: How should discrepancies between recorded shift hours and task hours be addressed?
   - **Current Implementation**: `worklog.mismatchHandling = "warn"` (warn rather than block submissions).

3. **Work Log Modification Window**
   - **Question**: How long after submission is an employee allowed to edit or correct a work log?
   - **Current Implementation**: 24 hours (`worklog.editWindowHours = "24"`).

4. **Standard Working Hours & Days**
   - **Question**: What are standard shift hours and work days per week for regular staff profiles?
   - **Current Implementation**: 8 hours per shift, 5 days per week (`employee.defaultShiftHours = "8"`, `employee.defaultWorkingDays = "5"`).

5. **Overtime Approval**
   - **Question**: Does overtime require advance or post-hoc managerial approval?
   - **Current Implementation**: `overtime.requiresApproval = "true"`.

6. **Leave Availability Synchronization**
   - **Question**: Should approved leaves automatically adjust employee availability status across active assignments?
   - **Current Implementation**: `leave.autoSetAvailability = "true"`.

7. **Work Role Customization & Assignment Authority**
   - **Question**: Who may create work roles and customize an employee's assigned work roles (system admin only, or also HR or project managers)? (Master Brief Part C, item 6)
   - **Current Implementation**: Restricted exclusively to `system_admin` in `apps/api/src/lib/permissions.ts`. All admin work role creation, editing, deactivation, and assignment endpoints enforce `requireRole('system_admin')` / `can(user, 'workrole:*')`.

8. **Employee Profile Contract Parameter Editing Authority**
   - **Question**: Should HR administrators be permitted to alter contract parameters like standard shift hours and working days per week, or should those parameters be restricted exclusively to system administrators?
   - **Current Implementation**: In `apps/api/src/lib/permissions.ts`, `user:update` is granted to both `system_admin` and `hr_admin`, allowing HR administrators to update department, job title, start date, standard shift hours, and working days on employee profiles. System role changes (`user:changeRole`) remain strictly restricted to `system_admin`.

