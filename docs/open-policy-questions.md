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
   - **Question**: Do daily employee work logs require explicit managerial or HR approval before hours are recognized as official?
   - **Current Implementation**: Configurable via `SystemSetting`: `worklog.requiresApproval = "false"` (default: neutral/unapproved mode where submitted logs are official). When enabled (`"true"`), submitted logs require approval, transitioning to `approved` or `rejected` with `approvedAt`, `approvedByUserId`, and optional `rejectionReason`.

2. **Work Log Discrepancies & Hour Mismatch**
   - **Question**: What happens when the total hours entered in a day's work log differ from the employee's expected standard shift hours (e.g. 8 hours)?
   - **Current Implementation**: Configurable via `SystemSetting`: `worklog.mismatchHandling = "warn"` (choices: `"allow"`, `"warn"`, or `"block"`).
     - `"allow"`: Permits any total hours without restriction.
     - `"warn"` (default): Notifies and warns the employee of the discrepancy while still allowing submission.
     - `"block"`: Strictly rejects submission until total hours match the configured shift length.

3. **Work Log Modification Window Length**
   - **Question**: How long after initial submission is an employee permitted to edit or correct a daily work log?
   - **Current Implementation**: Configurable via `SystemSetting`: `worklog.editWindowHours = "24"` (default: 24 hours). Edits past this window are blocked for regular employees; edits to submitted logs within the window trigger audit log entries.

4. **Work Log Visibility & Cross-Employee Access**
   - **Question**: Who is authorized to inspect other employees' daily work logs and summaries?
   - **Current Implementation**:
     - Regular employees (`employee`, `viewer`) can only view their own work logs (`/api/work-logs/my-logs`).
     - Project managers will have access scoped to members of their assigned projects.
     - System administrators (`system_admin`) and HR administrators (`hr_admin`) have organization-wide access to view and export all staff work logs.
     - Access to other employees' work logs is denied by default to prevent IDOR vulnerabilities.

5. **Standard Working Hours & Days**
   - **Question**: What are standard shift hours and work days per week for regular staff profiles?
   - **Current Implementation**: 8 hours per shift, 5 days per week (`employee.defaultShiftHours = "8"`, `employee.defaultWorkingDays = "5"`).

6. **Overtime Approval**
   - **Question**: Does overtime require advance or post-hoc managerial approval?
   - **Current Implementation**: `overtime.requiresApproval = "true"`.

7. **Leave Availability Synchronization**
   - **Question**: Should approved leaves automatically adjust employee availability status across active assignments?
   - **Current Implementation**: `leave.autoSetAvailability = "true"`.

8. **Work Role Customization & Assignment Authority**
   - **Question**: Who may create work roles and customize an employee's assigned work roles (system admin only, or also HR or project managers)? (Master Brief Part C, item 6)
   - **Current Implementation**: Restricted exclusively to `system_admin` in `apps/api/src/lib/permissions.ts`. All admin work role creation, editing, deactivation, and assignment endpoints enforce `requireRole('system_admin')` / `can(user, 'workrole:*')`.

9. **Employee Profile Contract Parameter Editing Authority**
   - **Question**: Should HR administrators be permitted to alter contract parameters like standard shift hours and working days per week, or should those parameters be restricted exclusively to system administrators?
   - **Current Implementation**: In `apps/api/src/lib/permissions.ts`, `user:update` is granted to both `system_admin` and `hr_admin`, allowing HR administrators to update department, job title, start date, standard shift hours, and working days on employee profiles. System role changes (`user:changeRole`) remain strictly restricted to `system_admin`.


10. **Work Log Date Boundaries & Time Zone Evaluation**
    - **Question**: What are the permissible past and future limits for logging daily work, and in which time zone should current-date evaluations take place?
    - **Current Implementation**: Evaluated against the `Asia/Kathmandu` time zone (UTC+05:45). Configured with `MAX_FUTURE_DAYS = 1` (allowing at most +1 day ahead to accommodate local timezone transitions without premature logging) and `MAX_PAST_DAYS = 90` (permitting retro-active daily logging up to 90 calendar days in the past). Submissions outside this window are rejected with HTTP 400 `validation_error`.

11. **HR Administrator Work Log Export Scope & Team Filter Representation**
    - **Question**: Should HR administrators (`hr_admin`) be authorized to perform organization-wide work log Excel exports across all departments, or should export access be restricted to their own personal logs? Additionally, how should team-level export filtering be resolved prior to the creation of a distinct Team entity?
    - **Current Implementation**: Configured by default to NO (`worklog:exportAll` is restricted exclusively to `system_admin`). HR administrators, project managers, and regular employees possess `worklog:exportOwn` only, scoping exports strictly to their own personal log entries. Any attempt by a non-system_admin to pass an employee filter pointing to another staff profile is rejected with HTTP 403 Forbidden. In the absence of a dedicated Team model in Phase 1, the `team` export filter maps directly to `EmployeeProfile.department`.


---

## 4. Projects Subsystem (Phase 2 / Step 10)

12. **Project Creation Authority**
    - **Question**: Who may create new projects in the system?
    - **Current Implementation**: `system_admin` and `project_manager` roles possess project creation authority (`project:create`). Regular staff (`employee`, `viewer`) and HR administrators (`hr_admin`) are restricted from creating projects by default, maintaining clear operational separation between project governance and personnel administration.

13. **Project Visibility & Organization-Wide Scoping**
    - **Question**: Who is authorized to view all projects across the organization, and what is the visibility scope for HR administrators?
    - **Current Implementation**: Organization-wide visibility (`project:readAll`) is granted exclusively to `system_admin`. HR administrators (`hr_admin`) by default do NOT see all projects (`hr_admin` default NO); they, along with regular employees, only see projects where they are explicitly assigned as a `ProjectMember` (`manager`, `member`, or `viewer`).

14. **Time Log Derivation vs. Daily Work Log Dual Entry**
    - **Question**: Should task time logs (`TimeLog`) derive automatically from daily work log entries (`WorkLogEntry`), or should they exist as an independent project-tracking data stream?
    - **Current Implementation**: Data layers remain decoupled in Step 10a; `WorkLogEntry.projectId` and `WorkLogEntry.taskId` remain plain nullable strings without foreign keys to `Project` or `Task`. A policy decision is required on whether logging hours against a project task should automatically populate an employee's daily work log draft, or whether task time logs are reconciled against work logs via background jobs or managerial audit.

15. **Task "Blocked" Status Invariants & Requirements**
    - **Question**: What does transitioning a task to "blocked" require (e.g. mandatory blocking reason, unresolved task dependency link, manager alert)?
    - **Current Implementation**: In Step 10a, `TaskStatus` includes `blocked` as a core enum value. Future policy must determine whether setting a task to `blocked` requires a mandatory reason text field, an associated `Comment`, or an active uncompleted `TaskDependency`, and whether automated notification alerts must be dispatched to project managers upon entering a blocked state.


16. **Reopening Projects in "Complete" Status**
    - **Question**: Can a project that has transitioned to `complete` status be reopened to active statuses (`on_track`, `at_risk`, `off_track`, `on_hold`), or is `complete` an immutable terminal state?
    - **Current Implementation**: In Step 10b, `POST /api/projects/:id/status` permits transitions between any distinct `ProjectStatus` enum values provided a non-empty reason is supplied. Reopening a `complete` project to `on_track` or `on_hold` is permitted. A future policy question remains whether reopening completed projects should require system administrator authorization or mutual sign-off.

17. **Project Member Self-Removal and Last-Manager Guard**
    - **Question**: Can a project member or manager voluntarily remove themselves from a project (`DELETE /api/projects/:id/members/:userId` where `userId === session.userId`), or does removal require action by another manager or administrator?
    - **Current Implementation**: Self-removal is permitted for both regular members and managers, subject to the strict last-manager invariant: if an active manager attempts self-removal and they are the only remaining active manager on the project, the request is rejected with HTTP 409 `last_manager_required`. Self-removal is allowed only if at least one other active manager remains on the project.

18. **Manager Removal with Active Assigned Tasks**
    - **Question**: Can a manager or member be removed from a project while actively holding uncompleted assigned tasks, or must assigned tasks be reassigned first?
    - **Current Implementation**: In Step 10b, member removal (`DELETE /api/projects/:id/members/:userId`) deletes the `ProjectMember` record but does not block on or cascade to `Task.assigneeUserId` (which remains nullable). In Step 10c, policy must establish whether task reassignment is a prerequisite for member removal or whether tasks are automatically transitioned to unassigned (`assigneeUserId = null`).

19. **Direct Project Member Role Modification vs. Remove/Re-add Workaround**
    - **Question**: Should the system provide a dedicated endpoint to update a member's role (e.g. promoting a `member` to `manager` or demoting a `manager` to `viewer`), or should role modification follow the current workflow of removing the member and re-adding them with the updated role?
    - **Current Implementation**: In Step 10b, no direct `PATCH /api/projects/:id/members/:userId` endpoint exists. Changing a member's project role is achieved via the workaround of deleting the existing membership and re-adding the user with the new `projectRole`. A future phase may introduce direct role updates with manager retention validation.

20. **System Role "Viewer" Assignment Restrictions**
    - **Question**: Can a user whose system role is `viewer` be assigned as a project `manager` or `member`, or must their project role be restricted strictly to `viewer`?
    - **Current Implementation**: Users with `systemRole === 'viewer'` cannot be assigned as `projectRole: 'manager'` or `member`. Any attempt to assign a viewer to a writer role is rejected with HTTP 400 `viewer_cannot_be_member_writer`. Viewers can only be added to projects with `projectRole: 'viewer'`, preserving the core invariant that system-level read-only users cannot write project data.

21. **User Deactivation Impact on Project Manager Coverage**
    - **Question**: When a system administrator deactivates a user account (`PATCH /api/admin/users/:id/deactivate`), could deactivating that user leave a project without any active managers?
    - **Current Implementation**: In Step 10b, the last-manager check on member deletion counts only managers whose associated user has `isActive === true`. However, administrative user deactivation in the user administration subsystem does not currently check whether the deactivated user is the sole manager of active projects. As a result, deactivating a user can leave a project without an active manager (in which case a `system_admin` must assign a new active manager). Future policy should determine whether user deactivation should warn administrators if the target user is the sole manager of any active projects.

22. **Task Creation, Modification, and Status Modification Permissions for Project Members**
    - **Question**: Can regular project members (`projectRole === 'member'`) create tasks, modify task details, and update statuses, or is task modification restricted exclusively to project managers?
    - **Current Implementation**: Implemented via a swappable policy function `canEditTask(projectRole, isSystemAdmin, action, isAssignee, isCreator)`. By default:
      - Project managers and system administrators have full authority to create, edit, change status, and manage dependencies for all tasks.
      - Regular members can create new tasks.
      - For existing tasks, regular members can edit task details (title, description, priority, dueDate, assignee, milestone), change status, and manage dependencies if they are the task's current assignee or creator. Members cannot modify tasks assigned to or created by other members.
      - Viewers cannot create, edit, change status, or manage dependencies.

23. **Preserving Departed Assignees on Project Tasks**
    - **Question**: When an assigned user leaves or is removed from a project, what should happen to their assigned tasks? Should the system auto-unassign the tasks, or retain the historical assignee reference with an indicator?
    - **Current Implementation**: The system retains `assigneeUserId` on the task so historical assignments and accountability are not lost. The task response serializes an augmented boolean flag `assigneeIsProjectMember: false` to alert project managers that the assignee is no longer on the project team. Furthermore, when updating other task fields (e.g. `title` or `description`), an unchanged assignee who has left the project is not rejected, preventing workflow deadlocks.

24. **Completing Tasks with Open Blocker Dependencies or Open Subtasks**
    - **Question**: Can a task be moved to `done` status if it has unresolved blocker dependencies (`TaskDependency.dependsOnTaskId` in non-`done` status) or incomplete subtasks? Should this be a hard block or a soft warning?
    - **Current Implementation**: A neutral soft-warning default is adopted. Transitioning a task to `done` succeeds, but the API response includes a `warnings` array containing `'open_dependency'` (if any prerequisite task on which this task depends is not `done`) and/or `'open_subtasks'` (if any child subtask is not `done`). This enables managers and teams to close parent milestones or parent issues flexibly when agreed out-of-band while maintaining audit transparency.

25. **Absence of Task Deletion Endpoint**
    - **Question**: Should tasks be deletable, or should project auditability mandate that tasks are canceled or marked obsolete via status/archival rather than hard-deleted?
    - **Current Implementation**: In Step 10c, no `DELETE /api/projects/:id/tasks/:taskId` endpoint is provided. Historical records, time logs, and audit logs rely on immutable task entities. Note that tasks do not possess a `canceled` status in the data model (valid statuses are strictly `todo`, `in_progress`, `blocked`, and `done`). Abandoned or halted tasks may be held in `blocked` or closed via `done` with explanatory comments. A future policy decision will evaluate whether hard deletion or soft deletion (`archivedAt`) should be supported for project managers or system administrators.

26. **Task Assignee Membership and Role Restrictions**
    - **Question**: Who is eligible to be assigned to a project task? Can viewers be assigned to tasks?
    - **Current Implementation**: Only active project members with `projectRole: 'manager'` or `projectRole: 'member'` may be assigned to a task (`assigneeUserId`). Viewers (`projectRole: 'viewer'`) and users who are not members of the project cannot be assigned tasks (rejected with HTTP 400 `assignee_not_a_member_or_is_viewer`).

27. **Reopening Completed ("Done") Tasks**
    - **Question**: Can a task that has reached `done` status be reopened to active statuses (`todo`, `in_progress`, `blocked`, `in_review`), and who is authorized to do so?
    - **Current Implementation**: Reopening a `done` task is permitted by default. It follows the standard `canEditTask(..., 'changeStatus')` rules: project managers, system administrators, and the task's assignee or creator may reopen the task to any valid `TaskStatus`.
28. **Dual Time Entry (Work Logs vs. Project Time Logs) and Reconciliation**
    - **Question**: Staff now have two distinct mechanisms for logging time: organizational daily work logs (`WorkLog` under `/api/work-logs`) and project/task time logs (`TimeLog` under `/api/projects/:id/time-logs`). Should these two subsystems remain independent, or should daily work log totals be strictly reconciled against the sum of project time logs for the same day?
    - **Current Implementation**: In Step 10d, the two subsystems operate independently. Both enforce a separate daily 24-hour total cap per user per calendar day (UTC date string in `Asia/Kathmandu`), and project time logs enforce an additional constraint that logged entries cannot be dated more than 90 days in the past or more than 1 day in the future. Step 10e will explore linking work logs to project tasks. Reconciliation policies (e.g. flagging variances between attendance/work logs and project billable hours) remain an open leadership decision.

29. **Time-Log Modification and Deletion Time Window**
    - **Question**: What is the allowable time window for employees to edit or delete their logged time entries on project tasks? Should retroactive edits be blocked after a certain duration (e.g. 24 hours, 7 days, or end of payroll period)?
    - **Current Implementation**: In Step 10d, members may edit or delete their own time logs (`PATCH` or `DELETE /api/projects/:id/time-logs/:timeLogId`) provided the log belongs to the project in the URL and the daily 24-hour cap is not exceeded. There is currently no retroactive cutoff window (other than the general -90 days to +1 day creation constraint). A future administrative setting (e.g. `timelog.editWindowHours`) could lock entries once approved by a project manager or after payroll processing.

30. **Logging Time on Completed or On-Hold Projects**
    - **Question**: Should team members be permitted to log hours against projects that are currently in `complete` or `on_hold` status, or should logging time be strictly restricted to `in_progress` and `planning` projects?
    - **Current Implementation**: By default, logging time on `complete` or `on_hold` projects is allowed. Project members can log wrap-up hours, post-launch documentation, or retrospective time on completed projects without requiring managers to reopen project status. If leadership prefers to lock time logging on non-active projects, a configurable setting or status check can enforce this policy.
