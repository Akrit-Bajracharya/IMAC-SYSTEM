# Manual Hand-Test Backlog — IMAC Nepal Internal Operations System

This document tracks all manual user-interface and functional verification scenarios that have **not yet been executed** against a running application instance.

Each test is specified in plain language with:
- **Status**: Marked strictly as `NOT RUN`.
- **Role to Log In As**: The specific persona (`system_admin`, `hr_admin`, `project_manager`, `employee`, `viewer`, or user without `EmployeeProfile`).
- **Expected Result**: What the screen must display and allow.
- **Negative Invariants**: What the role must **NOT** be able to see, click, edit, or submit.

---

## 1. Step 9a: Daily Work Log Screens (`apps/web`)

### TEST-09A-01: Save Draft Twice (Draft Upsert Idempotency)
- **Status**: `NOT RUN`
- **Role**: `employee`
- **Test Steps**:
  1. Navigate to Daily Work Log (`/employee/work-logs`).
  2. Select an assigned work role, enter 4.0 hours, and click "Save Draft".
  3. Verify the log saves successfully without reloading errors.
  4. Add a second row with 4.0 hours and click "Save Draft" a second time for the same calendar date.
- **Expected Result**: The draft updates smoothly in place. Total logged hours display 8.0 hours.
- **What Must NOT Happen**: Must **NOT** trigger a database collision, 409 conflict, or create duplicate `WorkLogDay` records for that date.

### TEST-09A-02: Double-Click Submit Protection
- **Status**: `NOT RUN`
- **Role**: `employee`
- **Test Steps**:
  1. Fill in a draft log with valid hours matching the expected shift length.
  2. Rapidly double-click or triple-click the "Submit Work Log" button.
- **Expected Result**: The button immediately enters a disabled / loading state upon the first click; only a single `POST /api/work-logs/:id/submit` network request is dispatched.
- **What Must NOT Happen**: Must **NOT** dispatch concurrent submit requests or produce a 400 `already_submitted` error dialog from the second click.

### TEST-09A-03: Block-Mode Shift Mismatch Refusal
- **Status**: `NOT RUN`
- **Role**: `employee` (with `systemSetting: worklog.mismatchHandling = "block"`)
- **Test Steps**:
  1. Fill in 6.0 hours on an employee profile whose standard shift length is 8.0 hours.
  2. Attempt to click "Submit Work Log".
- **Expected Result**: Submission is blocked. A clear, friendly explanation is presented informing the user that total hours (6.0h) must match the expected standard shift length (8.0h) before submission is allowed.
- **What Must NOT Happen**: Must **NOT** submit the log, must **NOT** transition status to `submitted`, and must **NOT** show an unhandled 422 JSON payload.

### TEST-09A-04: Work Log History Calendar and List Views
- **Status**: `NOT RUN`
- **Role**: `employee`
- **Test Steps**:
  1. Navigate to `/employee/work-logs/history`.
  2. Toggle between weekly calendar view and past logs list view.
  3. Inspect past days with `draft`, `submitted`, and unlogged states.
- **Expected Result**: Past days display accurate status badges and total logged hours vs. target shift hours. Clicking a past draft opens it for editing; clicking a submitted log opens it in read-only mode (or editable within the configured edit window).
- **What Must NOT Happen**: An employee must **NOT** see any other employee's work logs or name filters in this view.

### TEST-09A-05: Excel Export with Nepal Time Boundary Verification
- **Status**: `NOT RUN`
- **Role**: `employee` (and separately `system_admin`)
- **Test Steps**:
  1. Navigate to Export screen (`/employee/work-logs/export` or `/admin/work-logs/export`).
  2. Choose a date range and click "Download Excel".
  3. Open the downloaded `.xlsx` file.
- **Expected Result**:
  - The workbook contains two sheets: a formatted report summary sheet and a raw entry data sheet.
  - Dates and calendar day groupings align strictly with `Asia/Kathmandu` (UTC+05:45) calendar dates, with no day-shift discrepancy caused by UTC conversion.
  - An `employee` export contains only their own records.
  - A `system_admin` export includes organization-wide records.
- **What Must NOT Happen**: An `employee` must **NOT** be able to select or export other employees' records.

### TEST-09A-06: Settings 403 Access Refusal for Non-Admins
- **Status**: `NOT RUN`
- **Role**: `employee`, `project_manager`, `viewer`
- **Test Steps**:
  1. Attempt to manually navigate to `/admin/work-logs/settings` in the browser URL bar.
- **Expected Result**: Access is denied. The user is redirected to their role home page or presented with an Access Denied / 403 page.
- **What Must NOT Happen**: Non-admins must **NOT** see the Work Log Policy Settings form and must **NOT** be able to mutate policy values (`worklog.mismatchHandling`, `worklog.editWindowHours`, `worklog.requiresApproval`).

### TEST-09A-07: No-Profile Administrative User Graceful Message
- **Status**: `NOT RUN`
- **Role**: `system_admin` (logged in as an account without an `EmployeeProfile`, such as `boss` or `akrit`)
- **Test Steps**:
  1. Navigate to `/admin/work-logs` or the dashboard Daily Work Log widget.
- **Expected Result**: The screen displays a friendly informational message: *"No employee profile assigned. Daily work logs are only available for staff with an active employee profile."*
- **What Must NOT Happen**: The page must **NOT** crash, throw a white screen of death, or display a raw 404 `profile_not_found` JSON error.

### TEST-09A-08: Mobile and Phone Width Responsiveness
- **Status**: `NOT RUN`
- **Role**: `employee`
- **Test Steps**:
  1. Open the Daily Work Log screen on a mobile viewport (375px width).
- **Expected Result**: The entry table gracefully transitions to a vertical card layout; inputs, dropdowns, and "Save Draft" / "Submit" buttons fit comfortably without horizontal blowout or clipped elements.
- **What Must NOT Happen**: Tables must **NOT** overflow horizontally off-screen or obscure touch targets.

---

## 2. Step 12a: Project Screens & Navigation (`apps/web`)

### TEST-12A-01: Projects List Navigation and Card Rendering
- **Status**: `NOT RUN`
- **Role**: `employee`, `project_manager`, `system_admin`
- **Test Steps**:
  1. Click "Projects" in the sidebar navigation.
  2. Inspect the project cards and pagination.
- **Expected Result**: Accessible projects load with name, description snippet, status badge (`on_track`, `at_risk`, `off_track`, `on_hold`, `complete`), member count, and target date. "Load more" button loads subsequent pages via cursor pagination.
- **What Must NOT Happen**: Users must **NOT** see projects they are not members of (unless `system_admin`).

### TEST-12A-02: Project Creation with Start and Target Date Validation
- **Status**: `NOT RUN`
- **Role**: `project_manager` or `system_admin`
- **Test Steps**:
  1. Click "Create Project".
  2. Set Start Date to `2026-12-01` and Target Date to `2026-11-01` (target earlier than start).
  3. Attempt to submit.
  4. Fix Target Date to `2026-12-31` and submit.
- **Expected Result**: Target date before start date displays an inline validation error: *"Target date cannot be earlier than start date."* After correcting the date, the project is created, and the user is redirected to the new project detail view.
- **What Must NOT Happen**: The invalid date form must **NOT** submit to the server. Plain `employee` and `viewer` roles must **NOT** see the "Create Project" button.

### TEST-12A-03: Add and Remove Project Members
- **Status**: `NOT RUN`
- **Role**: Project `manager` or `system_admin`
- **Test Steps**:
  1. On the Project Detail page (`Overview` tab), click "Add Member".
  2. Pick an active staff member from the dropdown (loaded from active users), assign role `member`, and submit.
  3. Locate the member in the members table, click "Remove", and confirm the dialog.
- **Expected Result**: Member is added to the list immediately; removing removes them from the table and updates the member count.
- **What Must NOT Happen**: Inactive users must **NOT** be selectable. Plain `member` and `viewer` roles must **NOT** see member add/remove actions.

### TEST-12A-04: Remove Last Project Manager Refusal
- **Status**: `NOT RUN`
- **Role**: Project `manager` (the sole manager of the project)
- **Test Steps**:
  1. In a project with only one manager, click "Remove" on that sole manager row.
- **Expected Result**: The system prevents removal with a clear message: *"Cannot remove the last project manager. A project must have at least one active manager."*
- **What Must NOT Happen**: A project must **NOT** be left without an active manager.

### TEST-12A-05: Status Change Requires Mandatory Reason
- **Status**: `NOT RUN`
- **Role**: Project `manager` or `system_admin`
- **Test Steps**:
  1. Click "Change Status" on the Project Detail page.
  2. Select a new status (e.g. `at_risk`) and leave the reason field empty or with whitespace only.
  3. Attempt to confirm.
  4. Enter a non-empty explanation (e.g. *"Client deliverables delayed by 2 weeks"*) and confirm.
- **Expected Result**: Empty reason is blocked with an inline validation prompt. Non-empty reason successfully updates the project status badge and registers an audit log record.
- **What Must NOT Happen**: Must **NOT** submit empty or whitespace-only reasons. Selecting the existing status must **NOT** send a redundant status change.

### TEST-12A-06: Member and Viewer Read-Only Invariants on Project Detail
- **Status**: `NOT RUN`
- **Role**: Project `member` and project `viewer`
- **Test Steps**:
  1. Log in as a project `member` and navigate to assigned project detail.
  2. Separately, log in as a project `viewer` and navigate to permitted project detail.
- **Expected Result**: Overview metrics, members list, and progress bar are visible in read-only mode.
- **What Must NOT Happen**:
  - `member` and `viewer` must **NOT** see "Edit Project" button.
  - `member` and `viewer` must **NOT** see "Change Status" button.
  - `member` and `viewer` must **NOT** see "Add Member" button or remove member trash icons.

### TEST-12A-07: Daily Work Log Project and Task Dynamic Pickers
- **Status**: `NOT RUN`
- **Role**: `employee` (assigned to Project A as `member`, Project B as `viewer`)
- **Test Steps**:
  1. Open Daily Work Log (`/employee/work-logs`).
  2. Click the Project dropdown on an entry row.
  3. Select Project A; inspect Task dropdown.
  4. Select Project B; inspect Task dropdown.
- **Expected Result**:
  - The Project dropdown lists only projects where the employee is an active member (plus "No project").
  - Selecting Project A enables the Task dropdown showing Project A's tasks.
  - Selecting Project B (`viewer` role) hides the Task dropdown because viewers cannot log time against tasks.
  - Pre-existing legacy text project entries render read-only with a "Legacy text" badge and a "Remove project link" button without corrupting new writes.
- **What Must NOT Happen**: Unassigned projects must **NOT** appear in the project dropdown.

### TEST-12A-08: Friendly 404 on Unknown Project ID
- **Status**: `NOT RUN`
- **Role**: Any authenticated user
- **Test Steps**:
  1. Navigate to `/projects/00000000-0000-0000-0000-000000000000` or a non-existent UUID.
- **Expected Result**: Displays a friendly "Project Not Found" page with a clear "Back to Projects" navigation button.
- **What Must NOT Happen**: Must **NOT** crash, freeze, or display raw JSON `{ "error": "not_found" }`.

### TEST-12A-09: Dashboard Quick Links and Project Overview
- **Status**: `NOT RUN`
- **Role**: `system_admin`, `employee`
- **Test Steps**:
  1. Log in and land on the root dashboard (`/admin/dashboard` or `/employee/dashboard`).
- **Expected Result**: Displays personalized greeting, quick action cards (Daily Work Log, Projects, Directory), "Today's Work Log" progress card, and "My Projects" listing up to 5 accessible projects with status badges and member counts.
- **What Must NOT Happen**: Must **NOT** show placeholder "Phase 7" wording or broken links.

---

## 3. Step 12b: Tasks, Subtasks, Dependencies & Comments (`apps/web`)

### TEST-12B-01: Task List and Board Views
- **Status**: `NOT RUN`
- **Role**: Project `manager`, `member`, `viewer`
- **Test Steps**:
  1. Open a project and switch to the `Tasks` tab (`?tab=tasks`).
  2. Toggle between `List` and `Board` views.
  3. Apply filters: Status (`in_progress`), Assignee, Milestone, Overdue, and "Top-level only".
- **Expected Result**: Tasks filter accurately in both views. Board view displays 4 Kanban columns (`To Do`, `In Progress`, `Blocked`, `Done`) with accurate task cards.
- **What Must NOT Happen**: Board columns must **NOT** display fabricated total count badges when infinite pages remain unloaded; load-more indicator must display accurately.

### TEST-12B-02: Moving Tasks via Status Control
- **Status**: `NOT RUN`
- **Role**: Assignee `member`, Project `manager`, `system_admin`
- **Test Steps**:
  1. On a board card or task detail page, change status from `todo` to `in_progress`.
  2. Move from `in_progress` to `blocked`.
  3. Move from `blocked` to `done`.
- **Expected Result**: Status updates immediately in the UI and recalculates the project leaf task progress percentage.
- **What Must NOT Happen**: A non-assignee `member` or a `viewer` must **NOT** see the "Move to" status dropdown.

### TEST-12B-03: Task Detail Inline Editing and Character Counter
- **Status**: `NOT RUN`
- **Role**: Task creator/assignee (`member`), Project `manager`, `system_admin`
- **Test Steps**:
  1. Click on a task title to navigate to `/projects/:id/tasks/:taskId`.
  2. Click "Edit Task".
  3. Edit Title, Due Date, Estimated Hours (test non-0.25 increment like 1.3h vs valid 1.5h), and Description (observe the `X / 5000` live counter).
  4. Click "Save Changes".
- **Expected Result**: Non-quarter-hour increments display inline validation errors. Valid inputs send a PATCH payload containing only dirty fields. Background queries do not overwrite user typing while in edit mode.
- **What Must NOT Happen**: Non-author/non-assignee members and viewers must **NOT** see the "Edit Task" button. Description must **NOT** exceed 5000 characters.

### TEST-12B-04: Subtask Nesting Refusal (1-Level Constraint)
- **Status**: `NOT RUN`
- **Role**: Project `manager`, `system_admin`, `member`
- **Test Steps**:
  1. Open a root task and click "Add Subtask" via the subtasks section.
  2. Create Subtask A. Verify Subtask A links back to the parent task.
  3. Open Subtask A's detail page.
- **Expected Result**: Subtask A displays an informational note: *"Subtasks cannot have nested subtasks."* The "Add Subtask" button is completely absent.
- **What Must NOT Happen**: The UI must **NOT** allow creating a subtask on another subtask (no 2nd-level subtask nesting).

### TEST-12B-05: Task Cascading Delete Confirmation
- **Status**: `NOT RUN`
- **Role**: Project `manager` or `system_admin`
- **Test Steps**:
  1. Create a task with 2 subtasks, 3 comments, and a dependency link.
  2. Click "Delete" on the task detail page.
- **Expected Result**: A confirmation dialog opens stating: *"This permanently deletes this task, its 2 subtasks, its comments and all comments on its subtasks, and its dependency links. Logged hours are kept but lose their link to this task."* Confirming navigates back to the task list and purges the deleted task from view.
- **What Must NOT Happen**: Plain project `member` and `viewer` roles must **NOT** see the "Delete" button. Logged hours from Daily Work Logs must **NOT** be deleted.

### TEST-12B-06: Dependencies Management and Circular Cycle Refusal
- **Status**: `NOT RUN`
- **Role**: Project `manager` or task creator/assignee (`member`)
- **Test Steps**:
  1. On Task A, open the Dependencies section and click "Add Dependency".
  2. Verify candidate task list excludes Task A itself, tasks already in "Blocked by", and tasks in "Blocks" (Amendment 1).
  3. Pick Task B so that Task A depends on Task B (Task B blocks Task A).
  4. Navigate to Task B and attempt to add Task A as a dependency for Task B (creating a circular cycle: A -> B -> A).
- **Expected Result**: Adding Task B succeeds and displays under "Blocked by" on Task A and under "Blocks" on Task B. Attempting to create the cycle is rejected with a plain-language explanation: *"Adding this dependency would create a circular loop where tasks wait on each other."*
- **What Must NOT Happen**: Must **NOT** permit self-dependency, duplicate dependencies, circular wait loops, or display raw JSON `{ "error": "dependency_cycle" }`.

### TEST-12B-07: Task Comments Authorization, Editing, and Deletion
- **Status**: `NOT RUN`
- **Role**: Author (`member`), Project `manager`, `system_admin`, `viewer`
- **Test Steps**:
  1. Log in as `viewer`: Inspect task comments section.
  2. Log in as `member` (User 1): Post a comment (check live 5000 character counter).
  3. Immediately inspect the comment: verify no "(edited)" marker appears.
  4. Wait >2 seconds, click "Edit", update the text, and save.
  5. Log in as another `member` (User 2): View User 1's comment.
  6. Log in as `manager` or `system_admin`: View User 1's comment.
- **Expected Result**:
  - `viewer` sees: *"You can read comments, but project viewers cannot post or edit comments."* (no input box).
  - User 1 sees "(edited)" marker appear only after editing >2s past creation (Amendment 4).
  - User 2 sees User 1's comment in plain text (`whitespace-pre-wrap`), but has **no** edit or delete buttons on User 1's comment.
  - `manager` and `system_admin` see delete button (with confirmation dialog) on any comment.
- **What Must NOT Happen**: Viewers must **NOT** be able to post or edit comments. Non-authors must **NOT** be able to edit another person's comment. HTML / scripts must **NOT** execute (rendered as strict plain text).

### TEST-12B-08: Marking Task Done with Open Prerequisites
- **Status**: `NOT RUN`
- **Role**: Plain `member` (non-manager), Project `manager`, `system_admin`
- **Test Steps**:
  1. Create Task A depending on prerequisite Task B. Leave Task B in `todo` status.
  2. As plain `member` assigned to Task A: Attempt to change Task A's status to `done`.
  3. As project `manager`: Attempt to change Task A's status to `done`.
- **Expected Result**:
  - Plain `member`: Hard-blocked with 409 error message explicitly naming open prerequisites: *"Cannot mark task done while prerequisite dependencies are open: Task B"*. Status remains uncompleted.
  - Project `manager`: Operation succeeds, but displays soft warning banner: *"Warning: This task was marked done while prerequisite dependencies are still open."* (Amendment 2).
- **What Must NOT Happen**: Plain members must **NOT** bypass open dependencies. Managers must **NOT** be hard-blocked but must be clearly warned.

### TEST-12B-09: Milestones List, Overdue Calculation & Task Counts
- **Status**: `NOT RUN`
- **Role**: Project `member`, `manager`, `system_admin`, `viewer`
- **Test Steps**:
  1. Open project detail and click the `Milestones` tab (`?tab=milestones`).
  2. Inspect milestones list for past-due uncompleted milestone, future milestone, and completed milestone.
  3. Verify task count summary (`X of Y tasks completed`).
- **Expected Result**:
  - Past-due uncompleted milestone displays red "Overdue" badge based on Asia/Kathmandu calendar date.
  - Future uncompleted milestone displays "In Progress" badge.
  - Completed milestone displays green "Completed" badge with completion date.
  - Task count fraction matches total and done tasks assigned to the milestone.
- **What Must NOT Happen**: Completed milestones must **NOT** show as overdue, even if their due date is in the past.

### TEST-12B-10: Milestone Creation and Editing
- **Status**: `NOT RUN`
- **Role**: Project `manager` or `system_admin`
- **Test Steps**:
  1. Click "Create Milestone".
  2. Test submitting empty name (blocked by HTML5 / validation).
  3. Enter name "Alpha Release" and target date `2026-12-15`. Submit.
  4. Click "Edit" on "Alpha Release", change name to "Alpha v1.0", and submit.
- **Expected Result**: Milestone creates and updates cleanly in the list without reloading the page.
- **What Must NOT Happen**: Plain `member` and `viewer` roles must **NOT** see "Create Milestone" or "Edit" buttons.

### TEST-12B-11: Milestone Complete and Reopen Transitions
- **Status**: `NOT RUN`
- **Role**: Project `manager` or `system_admin`
- **Test Steps**:
  1. Click "Mark Complete" on an active milestone.
  2. Verify milestone transitions to completed with a green badge and current completion date.
  3. Click "Reopen".
  4. Verify milestone returns to open status.
- **Expected Result**: Status updates immediately and updates project summary. Reopening an already open milestone or completing an already completed milestone surfaces friendly error messaging instead of crashing.
- **What Must NOT Happen**: Plain `member` and `viewer` roles must **NOT** see "Mark Complete" or "Reopen" buttons.

### TEST-12B-12: Milestone Accordion Task Linkage
- **Status**: `NOT RUN`
- **Role**: Project `member`, `manager`, `viewer`
- **Test Steps**:
  1. Click anywhere on a milestone card header to expand it.
  2. Inspect tasks listed under the milestone.
  3. Click on a task title.
- **Expected Result**:
  - Clicking expands/collapses the task list accordion.
  - Tasks assigned to this milestone display with title, status badge, assignee name, and due date.
  - Clicking a task title navigates to its task detail page.
  - If no tasks are assigned, a friendly empty note is displayed.
- **What Must NOT Happen**: Tasks belonging to other milestones must **NOT** appear under this milestone.

### TEST-12B-13: Milestone RBAC Invariants for Members and Viewers
- **Status**: `NOT RUN`
- **Role**: Project `member` and `viewer`
- **Test Steps**:
  1. Navigate to assigned project `Milestones` tab as a plain `member`.
  2. Repeat as a project `viewer`.
- **Expected Result**: Milestones, status badges, due dates, task progress fractions, and task accordion links are visible in read-only mode.
- **What Must NOT Happen**:
  - Members and viewers must **NOT** see the "Create Milestone" button.
  - Members and viewers must **NOT** see "Edit" buttons on milestone cards.
  - Members and viewers must **NOT** see "Mark Complete" or "Reopen" buttons.

---

## 4. Real-Database Integration & Audit Checks Pending

The following checks cannot be proven by Vitest in-memory mocks and must be verified against a live PostgreSQL database instance:

### TEST-DB-01: Project Lifecycle Append-Only Audit Entries
- **Status**: `NOT RUN`
- **Verification Target**: Query `AuditLog` table in PostgreSQL:
  `SELECT action, "entityType", "entityId", "beforeSnapshot", "afterSnapshot" FROM "AuditLog" WHERE "entityType" = 'project' ORDER BY "createdAt" DESC;`
- **Expected Result**:
  - `project.created`: records `name`, `startDate`, `targetDate`.
  - `project.updated`: records changed attributes.
  - `project.status_changed`: records `status`, `previousStatus`, and non-empty `reason`.
  - `project.member_added`: records `userId`, `projectRole`.
  - `project.member_removed`: records `userId`.
- **What Must NOT Happen**: No passwords, session secrets, or unhashed sensitive data in snapshots.

### TEST-DB-02: Task Lifecycle Append-Only Audit Entries and Privacy
- **Status**: `NOT RUN`
- **Verification Target**: Query `AuditLog` table in PostgreSQL:
  `SELECT action, "entityType", "entityId", "beforeSnapshot", "afterSnapshot" FROM "AuditLog" WHERE "entityType" = 'task' ORDER BY "createdAt" DESC;`
- **Expected Result**:
  - `task.created`: records `title`, `status`, `assigneeUserId`.
  - `task.updated`: records changed fields.
  - `task.deleted`: records `subtaskCount` and `commentCount` in `beforeSnapshot`, but **strictly omits task `description`** to protect user privacy.
  - `task_dependency.added` & `task_dependency.removed`: records `dependsOnTaskId`.
  - `comment.created`, `comment.edited`, `comment.deleted`: records `taskId`, but **strictly omits comment `body`** from audit snapshots.

### TEST-DB-03: Real Network Latency Double-Click and Idempotency
- **Status**: `NOT RUN`
- **Verification Target**: Under simulated 500ms network latency in Chrome DevTools:
  - Rapid double-click on "Save Draft", "Submit Work Log", "Create Project", "Add Dependency", and "Post Comment".
- **Expected Result**: Frontend UI buttons immediately disable; mutations are debounced or protected by server-side idempotency / state guards; no duplicate records or unhandled race condition collisions.
