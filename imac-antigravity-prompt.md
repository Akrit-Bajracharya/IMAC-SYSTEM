# IMAC Nepal Internal Operations System: Phase 1 (Employee Interface)

How to use this file:
1. Paste **PART A (Master Brief)** into Antigravity first, once. It holds the rules the agent must follow for the whole project.
2. Then paste **one phase prompt from PART B at a time**. Review the result at each checkpoint before pasting the next.
3. Do not paste everything at once. Small phases drift less.

---

# PART A: MASTER BRIEF

## 1. Your role and working rules

You are a senior full-stack engineer building an internal software system for IMAC Nepal. Follow these rules for the whole project:

- Build **only what the current phase prompt asks for**. Do not build later phases early.
- **Before writing code in each phase, produce a short implementation plan and wait for my approval.**
- **Do not invent IMAC business policies.** Leave rules, overtime rules, approval rules, working days, shift length and similar policies must be **configurable settings**, not hard-coded. Where a rule is unknown, add a clearly named setting with a neutral default, list it in `docs/open-policy-questions.md`, and move on.
- Do not claim the system makes official immigration, employment or government decisions.
- Keep the code simple, typed, tested and readable. Prefer boring, well-known patterns.
- After each phase: run the tests, run the linter and type-check, update the docs, and give me a short summary of what changed, what is untested, and what you assumed.
- Never commit secrets. Never hard-code passwords. Use environment variables and a `.env.example`.

## 2. Product context

IMAC Nepal connects Nepali engineering graduates with training, OJT and employment opportunities in Japan. This system is an **internal, IMAC-specific operations platform**, not a generic project-management app.

Eventually it will combine: (1) project and team work management, (2) candidate and employment case management, and (3) an Employment Management System (EMS) for employee self-service and HR administration.

**This build is Phase 1 only: the employee interface** and the admin/HR functions needed to make it work. **Candidate and case management is explicitly out of scope.** Do not create candidate tables or screens. Design so they can be added later without rework (for example, work categories and task links should be extensible).

## 3. Deployment model (important)

- **Self-hosted on a server at the IMAC office**, accessed by staff through a web browser over the **local network only**.
- Not a public website. Not cloud-hosted. The app and database must **not** be exposed to the public internet.
- Employee computers talk to the application only. They never connect to the database directly.
- Use **HTTPS** on the local network (internal certificate via the reverse proxy) so passwords are never sent in plain text.
- Remote access, if ever needed, is handled separately (for example a VPN) and is out of scope.

## 4. Tech stack (fixed)

| Layer | Choice |
|---|---|
| Frontend | React + Vite + TypeScript, Tailwind CSS, shadcn/ui |
| Routing | **React Router v7 in library (SPA) mode**: nested layouts per role area, protected route guards, URL-based filters. Do NOT use framework/SSR mode. |
| Data/forms | TanStack Query, React Hook Form, Zod |
| Charts | Recharts (every chart must have an accessible data table or export beside it) |
| Backend | Node.js + TypeScript + Express, modular structure |
| Database | PostgreSQL with Prisma (migrations and typed models) |
| Auth | Username + password with server-side sessions (see section 5) |
| Files | Private folder on the server, outside any public web root, served only through authenticated endpoints; metadata in the database |
| Excel export | ExcelJS |
| Notifications | In-app, delivered via Server-Sent Events (SSE) |
| Background jobs | pg-boss (PostgreSQL-based queue). No Redis. |
| Deployment | Docker Compose: app, PostgreSQL, Caddy reverse proxy |
| Testing | Vitest (unit/integration), Playwright (end-to-end) |
| Logging | pino |
| Language support | react-i18next, **English default; Japanese-ready**. All user-facing text goes through translation keys from day one. Ship English strings only for now. |

Route guards in the frontend only hide screens. **All real permission checks must happen on the backend.**

Suggested layout (single repository):

```
/apps/web        React frontend
/apps/api        Express backend
/packages/shared shared Zod schemas and types
/docs            specs, open policy questions, runbooks
/deploy          docker-compose, Caddy config, backup scripts
```

## 5. Authentication (username and password)

- Staff log in with **username and password**. No email-based sign-up, no social login, no self-registration.
- **Accounts are created only by a system admin.** New accounts get a temporary password and **must change it at first login**.
- Hash passwords with **argon2id**. Never store or log plain-text passwords.
- Sessions are **server-side**, stored in PostgreSQL, using httpOnly, secure, sameSite cookies, with an inactivity timeout (configurable) and a way to end a session on logout.
- There is no email-based recovery. **A system admin resets passwords** (generates a new temporary password, forces change on next login).
- Add **rate limiting and temporary lockout** after repeated failed logins (thresholds configurable).
- Enforce a sensible minimum password policy (configurable length).
- CSRF protection for state-changing requests.
- Record these in the audit log: successful and failed logins, logouts, password resets, password changes, lockouts, account creation, deactivation, and role changes.
- Seed **two separate system-admin accounts** (the boss and Akrit) from environment variables on first run. Never hard-code credentials.
- Deactivating a user must immediately end their sessions and preserve their historical records (never hard-delete users who have records).

## 6. Roles and access control

Two separate ideas, never mixed up:

1. **System roles** control *what a person can do*: `system_admin`, `hr_admin`, `project_manager`, `employee`, `viewer`.
2. **Project membership** controls *which project information a person can see*.

Rules:
- `system_admin`: full control (users, roles, projects, teams, settings, reports, exports, permissions, audit).
- `hr_admin`: administrator for employee records, leave policies, leave requests, overtime submissions and approvals, holidays, and EMS reports. **Not** system-wide control unless explicitly granted.
- `project_manager`: manages **only assigned projects** and their teams. Does **not** automatically see every project or any HR records.
- `employee`: works on assigned projects and tasks; uses self-service.
- `viewer`: read-only, only on explicitly permitted information.
- Employees may belong to several projects but see only projects they are members of.
- Implement permissions in **one central policy layer** on the backend (not scattered through routes), and write **automated tests for it**, including negative tests (for example "a project manager cannot read another project", "an employee cannot read another employee's leave reasons").
- Exports follow exactly the same access rules as the screens.

## 7. The two kinds of "role" (do not confuse them)

- **System role** = permission level (section 6).
- **Work role** = a job function or work category an employee can choose in the Daily Work Log (for example Designer, Developer, Coordinator, Meetings, Training). **Admins define work roles and assign a specific set of work roles to each specific employee.** An employee sees only the work roles assigned to them.

## 8. Data models (starting point; refine in the plan)

Use Prisma. Use UUIDs, `createdAt`/`updatedAt`, and soft-deactivation where records matter historically. Store dates/times in UTC; display in the user's time zone (default Asia/Kathmandu).

- **User**: username (unique), displayName, passwordHash, systemRole, isActive, mustChangePassword, failedLoginCount, lockedUntil, employeeProfile (1:1)
- **EmployeeProfile**: userId, employeeCode, department, jobTitle, startDate, standardShiftHours (default 8, per-employee overridable), workingDays (configurable), managerUserId (optional)
- **Session**: id, userId, expiresAt, lastActiveAt, ip, userAgent
- **WorkRole**: name, description, isActive
- **EmployeeWorkRole**: employeeProfileId, workRoleId (admin-assigned; unique pair)
- **Project**: name, purpose, ownerUserId, managerUserId, startDate, dueDate, status (`on_track`, `at_risk`, `off_track`, `on_hold`, `complete`), statusReason
- **ProjectMember**: projectId, userId, projectRole
- **Task**: projectId, parentTaskId (subtasks), title, description, assigneeUserId, priority, status, dueDate, estimatedHours, isBlocked, blockedReason
- **Milestone** and **TaskDependency**
- **Comment** (on project/task), **ProjectMessage** (with pinned flag), **Attachment** (metadata; file stored privately)
- **WorkLogDay**: employeeProfileId, date, status (`draft`, `submitted`, plus `approved`/`rejected` only if the approval setting is on), submittedAt
- **WorkLogEntry**: workLogDayId, workRoleId, hours (decimal), description, optional projectId, optional taskId, `activityType` (`project_task`, `meeting`, `training`, `administrative`, extensible later), note
- **LeaveType**: name, entitlementRules (configurable), requiresApproval, carryForward settings, isActive
- **LeaveBalance**: employeeProfileId, leaveTypeId, period, entitled, used (derived from approved requests)
- **LeaveRequest**: employeeProfileId, leaveTypeId, startDate, endDate, note (private reasons restricted), status (`pending`, `approved`, `rejected`, `cancelled`), decidedBy, decidedAt, decisionNote
- **Holiday**: date, name, scope
- **OvertimeSubmission**: employeeProfileId, date, hours or start/end time, reason, optional projectId/taskId, status (`pending`, `approved`, `rejected`), decidedBy, decidedAt
- **AvailabilityStatus**: userId, status (`available`, `busy_in_meeting`, `out_of_office`, `on_leave`, `working_remotely`), message, expiresAt, source (`manual` or `leave_auto`)
- **ContactToken**: requesterUserId, targetUserId, topic/message, status (`raised`, `notified`, `accepted`, `time_suggested`, `declined`, `completed`), suggestedTime, responseNote
- **Notification**: userId, type, payload, readAt
- **DirectMessage** and participants (only if time allows in Phase 6; otherwise defer)
- **AuditLog**: actorUserId, action, entityType, entityId, before/after summary, ip, createdAt (append-only; no edit or delete from the UI)
- **SystemSetting**: key/value for all configurable policies

## 9. Core behaviour rules

**Daily Work Log**
- Each working day, an employee fills in their shift (default 8 hours) as entries: choose a **work role** (from their assigned set) and enter the **hours** put in, with optional description and optional project/task link.
- It is **self-reported**. The system never claims to know what an employee did.
- Policies below must be **settings**, not assumptions: whether a manager/HR must approve logs before hours count as official; whether totals that do not match the shift length block submission, warn, or are allowed; how long submitted logs stay editable; per-employee shift length.
- Show a running total vs. the expected shift hours while filling in.
- Days with approved leave are not expected to be filled in.
- Hours beyond the standard shift go through the **overtime** flow, not silently into the log.
- Edits to submitted logs are audited.
- Exportable to Excel (see below).

**Leave**
- Employee requests leave (type, dates, optional note). HR or an authorized approver approves or rejects. Approved leave updates the balance and may set availability to "On leave" for the approved period.
- Keep pending, approved and rejected clearly distinct everywhere.
- All leave rules are configurable by HR. Do not assume any.

**Overtime**
- Employee submits date, hours or start/end, reason, optional project/task link. HR or an authorized approver approves or rejects.
- **Only approved overtime counts toward official totals.** Pending, rejected and approved stay distinct.
- Calculation, compensation and reporting policy are unconfirmed: expose them as settings and record in open policy questions.

**Availability**
- Employees set a temporary status with an optional short message and expiry. Approved leave can auto-display "On leave". A manually set "Out" status **never** changes attendance, leave or overtime records.
- Coworkers see enough to coordinate; private reasons and sensitive HR information stay restricted.

**Contact token**
- A request to speak with a colleague: requester chooses a colleague, adds a short topic, submits. The colleague is notified and can accept, suggest a time, decline, and later mark completed. It is only a communication request, not a payment, credit or guaranteed meeting. Visible only to the requester, the colleague, and administrators who need access under policy.

**Progress and time**
- Progress comes from recorded tasks, milestones and logged hours, never from guessed activity. Make the completion-percentage calculation explicit and swappable (simple task-count by default; weighted option later).

**Audit**
- Record important changes: role changes, account actions, approvals, sensitive record updates, and **sensitive exports**.

## 10. Excel export rules

- Use ExcelJS. Where practical, each export has a **formatted report sheet plus a raw source-data sheet** behind it.
- Filters: employee, team, project, date range, role, status, report type.
- Exports obey the same access rules as screens: employees export only their own data, project managers only their projects' permitted data, admins organization-wide, HR only HR-permitted data.
- Daily Work Log must be exportable (own logs; project managers for project members where permitted; admins organization-wide).
- Sensitive exports are written to the audit log.

## 11. Security and data protection

- Individual accounts, role-based permissions, project-membership checks, restricted private files, HTTPS, protected storage.
- Input validation with Zod on every endpoint. Parameterized queries only (Prisma).
- Security headers, CORS locked to the app origin, upload type/size limits, files stored under random names outside the web root.
- Backup and restore: nightly database dump plus uploaded-file copy, a restore script, and a documented restore test.
- Retention and correction procedures are not yet defined: add placeholders in `docs/open-policy-questions.md`.

## 12. Definition of done (every phase)

Plan approved, code complete, migrations included, tests passing (including permission tests), lint and types clean, docs updated, short summary delivered, and no policy invented without being flagged.

---

# PART B: PHASE PROMPTS (paste one at a time)

## PHASE 0: Foundation

> Using the Master Brief, set up the project foundation. First give me a plan and wait for approval.
>
> Deliver: the monorepo layout; Docker Compose (app, PostgreSQL, Caddy with HTTPS for the local network); Prisma schema and first migration for User, EmployeeProfile, Session, SystemSetting, AuditLog; username/password authentication exactly as specified in section 5 (login, logout, forced password change, admin password reset, lockout, session timeout); first-run seeding of the two system-admin accounts from environment variables; the central permission/policy layer with the five system roles; an audit-log service; React app shell with React Router v7 (library mode), role-based layouts, protected routes, a login page and a change-password page; react-i18next wired with English keys; `.env.example`; README with local and server setup; `docs/open-policy-questions.md`.
>
> Tests: authentication flows, lockout, and permission-layer unit tests.
>
> Checkpoint: stop and summarize. Do not start Phase 1.

## PHASE 1: Users, employees and work roles (admin side)

> Build user and employee administration. Plan first, wait for approval.
>
> Deliver: system-admin screens to create/deactivate users, set system roles, edit employee profiles (shift length, working days, department), reset passwords; the **WorkRole** catalogue; **admin assignment of specific work roles to each specific employee**; audit entries for every change; searchable employee directory showing allowed fields only.
>
> Tests: only system admins can manage users; HR cannot change system roles; work-role assignment is respected by later phases.
>
> Checkpoint: stop and summarize.

## PHASE 2: Daily Work Log

> Build the Daily Work Log. Plan first, wait for approval.
>
> Deliver: employee screen to fill the day's shift (choose an assigned work role, enter hours, optional description and project/task link), running total vs. expected shift hours, draft/submit, calendar/list of past days; the policy settings from the Master Brief section 9 (approval required, mismatch handling, edit window, per-employee shift length) as admin-configurable settings with neutral defaults; weekly and monthly views; a reminder job for unfilled logs; an Excel export (formatted summary sheet plus raw entries sheet) with filters and correct access rules; audit entries for edits to submitted logs.
>
> Tests: an employee can only use their assigned work roles; an employee cannot see another employee's log; export access rules; hour-total validation modes.
>
> Checkpoint: stop and summarize.

## PHASE 3: Projects, tasks and time

> Build project and task features for employees, with the admin and project-manager functions they depend on. Plan first, wait for approval.
>
> Deliver: projects with members and statuses (with reasons); tasks and subtasks, priorities, statuses, due dates, estimates, blockers, milestones, dependencies; comments, attachments (private storage), project messages with pinning and "turn message into task"; time logging against tasks/projects feeding estimated vs. logged hours; project dashboard (status, task completion, milestones, overdue/blocked, workload, time spent); employee dashboard (my tasks, deadlines, projects); explicit, swappable progress calculation.
>
> Tests: project-membership visibility rules; project managers cannot see unassigned projects; attachment access.
>
> Checkpoint: stop and summarize.

## PHASE 4: Leave, holidays and availability

> Build leave management and availability. Plan first, wait for approval.
>
> Deliver: HR configuration of leave types, entitlements, applicable employees, approval rules, carry-forward rules (all as settings, no assumed policy); holiday calendar; employee leave request flow with balances by type, used, pending, approved and rejected clearly separated; approval/rejection with decision notes; automatic "On leave" availability for approved leave; manual availability status with message and expiry; team availability view that hides private leave reasons; notifications for decisions.
>
> Tests: leave reasons stay private from project managers; pending leave does not reduce balances; manual status never alters leave records.
>
> Checkpoint: stop and summarize.

## PHASE 5: Overtime

> Build overtime submission and approval. Plan first, wait for approval.
>
> Deliver: employee submission (date, hours or start/end, reason, optional project/task link); HR approval/rejection with notes; employee view showing submitted, pending, approved and rejected totals separately; only approved overtime in official totals; policy values as admin settings; link to the Daily Work Log so hours beyond the shift are guided to overtime rather than silently logged; audit entries for approvals.
>
> Tests: totals count only approved overtime; access rules.
>
> Checkpoint: stop and summarize.

## PHASE 6: Contact tokens and notifications

> Build contact tokens and the notification system. Plan first, wait for approval.
>
> Deliver: contact token flow and statuses (raised, notified, accepted, time suggested, declined, completed) with visibility limited to requester, target and permitted administrators; in-app notifications via SSE for assignments, mentions, replies, status changes, approvals and token events; notification centre with read/unread; @mentions in comments and project messages.
>
> Tests: token visibility; notification delivery to the right users only.
>
> Checkpoint: stop and summarize.

## PHASE 7: Dashboards, reports, hardening and handover

> Finish Phase 1. Plan first, wait for approval.
>
> Deliver: role-appropriate dashboards (employee, project, admin, HR) with charts that have accessible data tables; a report centre with Excel exports and filters for all modules; an audit-log viewer for system admins with filtering and export; backup and restore scripts with a documented restore test; security review checklist run against the code; full Playwright end-to-end tests of the main flows; admin and employee user guides; server deployment guide for the office machine; updated `docs/open-policy-questions.md`.
>
> Checkpoint: stop. Give me a final summary, list of known limitations, and every assumption that still needs confirmation from IMAC.

---

# PART C: OPEN POLICY QUESTIONS (to confirm with IMAC; the agent must not assume answers)

1. Leave types, entitlements, approval rules, carry-forward rules.
2. Overtime calculation, approval, compensation and reporting policy.
3. Whether daily work logs need approval before hours count as official.
4. What happens when daily hours do not add up to the shift length (block, warn or allow); how long submitted logs stay editable.
5. Whether the shift length and working days vary by employee.
6. Who may customize an employee's work roles (system admin only, or also HR or project managers).
7. Whether admins may read direct messages.
8. Project completion method: simple task count or weighted.
9. Data retention and correction procedures.
10. Whether Japanese language support is needed from day one (the build is Japanese-ready, English first).
