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

### TEST-09A-09: Daily Work Log Project & Task Pickers, Role Eligibility & Legacy Text
- **Status**: `NOT RUN`
- **Description**: Verifies that project and task options are strictly filtered according to the user's active membership (role `manager` or `member`), that viewer-only or unassigned projects are omitted, that task pickers only appear after project selection, and that legacy free text is displayed read-only with a warning badge and never submitted.
- **Role-by-Role Test Steps & Invariants**:
  - **1. Persona: `demo_dev` (Software Developer)**
    - *Status*: `NOT RUN`
    - *Steps*: Log in as `demo_dev`. Navigate to `/employee/work-logs`. Click "Add Entry Row". Open the Project dropdown.
    - *Expected Result*: Only projects where `demo_dev` has project role `member` (e.g. `[DEMO] Nepal Disaster Relief Portal`, `[DEMO] Valley Transit App`) are listed, plus "No project". Selecting a project reveals the Task dropdown populated with active tasks from that project. Changing project clears task selection.
    - *Negative Invariants*: Must **NOT** be offered projects where `demo_dev` is not a member or has only viewer access. Must **NOT** see task dropdown before selecting a project.
  - **2. Persona: `demo_pm` (Project Manager)**
    - *Status*: `NOT RUN`
    - *Steps*: Log in as `demo_pm`. Navigate to `/employee/work-logs`. Add or inspect entry rows.
    - *Expected Result*: Sees projects where `demo_pm` is `manager` or `member`. May link logged hours to both project tasks and milestones.
    - *Negative Invariants*: Must **NOT** see projects where `demo_pm` has no membership or only viewer permissions.
  - **3. Persona: `demo_designer` (UI/UX Designer)**
    - *Status*: `NOT RUN`
    - *Steps*: Log in as `demo_designer`. Open Daily Work Log. Choose assigned design project.
    - *Expected Result*: Sees assigned design projects. Task list reflects tasks belonging strictly to that project.
    - *Negative Invariants*: Must **NOT** be offered backend-only or non-assigned projects.
  - **4. Persona: `demo_hr` (HR Administrator)**
    - *Status*: `NOT RUN`
    - *Steps*: Log in as `demo_hr`. Open Daily Work Log (`/employee/work-logs`). Inspect project dropdown.
    - *Expected Result*: If `demo_hr` has no active project memberships, both Project and Task pickers are completely hidden from the entry form.
    - *Negative Invariants*: HR administrative authority must **NOT** grant project-task work logging on projects where `demo_hr` is not an active project member.
  - **5. Persona: `demo_viewer` (Read-Only Viewer)**
    - *Status*: `NOT RUN`
    - *Steps*: Log in as `demo_viewer`. Open Daily Work Log.
    - *Expected Result*: If viewer only holds `viewer` project roles, Project and Task pickers are hidden. If inspecting past logs, displays read-only badges.
    - *Negative Invariants*: Must **NOT** be offered any project where role is `viewer`. Must **NOT** be able to select tasks or save/submit work log entries.
  - **6. Legacy Free Text Verification (Any Role with Legacy Log)**
    - *Status*: `NOT RUN`
    - *Steps*: Load a day containing historical free-text `projectId` or `taskId` (non-UUID strings).
    - *Expected Result*: Displays the legacy string read-only alongside a `"Legacy text"` badge and helper notice `"This text will be cleared when you save."` with a `"Remove project link"` button.
    - *Negative Invariants*: Saving or submitting this log must **NEVER** transmit the free-text string in write payloads (must send `null`), preventing backend 400 `invalid_project` or `invalid_task` errors.

### TEST-09A-10: Network Failure Resilience, Timeout Handling & Translation Order
- **Status**: `NOT RUN`
- **Description**: Verifies that network failures, request timeouts, and server errors show friendly translated error banners without crashing or displaying unhandled axios error messages or raw code keys.
- **Role-by-Role Test Steps & Invariants**:
  - **1. Persona: `demo_dev` (Network Disconnect / Offline Simulation)**
    - *Status*: `NOT RUN`
    - *Steps*: Open daily work log, fill entries, disconnect network / stop backend server, click "Save Draft".
    - *Expected Result*: Banner displays friendly localized error: *"Network error: unable to reach the server. Please check your connection and try again."*
    - *Negative Invariants*: Must **NOT** display raw Axios string `"Network Error"`, `"ECONNREFUSED"`, or uncaught promise rejection.
  - **2. Persona: `demo_pm` (Request Timeout)**
    - *Status*: `NOT RUN`
    - *Steps*: Simulate high latency exceeding timeout threshold on submit mutation.
    - *Expected Result*: Shows localized network/timeout error message.
    - *Negative Invariants*: Must **NOT** display raw `ECONNABORTED` or `"timeout of 10000ms exceeded"`.
  - **3. Persona: `demo_designer` (Edit Window Expired During Session)**
    - *Status*: `NOT RUN`
    - *Steps*: Attempt to patch a submitted log whose operational modification window has closed (`403 edit_window_expired`).
    - *Expected Result*: Banners display *"The edit window for this submitted work log has closed. Changes can no longer be saved."* The form locks into read-only mode immediately.
    - *Negative Invariants*: Must **NOT** display generic `"Request failed with status code 403"` and must **NOT** allow further unsaved edits.
  - **4. Persona: `demo_hr` (Hour Mismatch Policy Enforcement)**
    - *Status*: `NOT RUN`
    - *Steps*: When `worklog.mismatchHandling` is `block`, attempt submission with unequal hours (`422 hour_mismatch`).
    - *Expected Result*: Shows localized *"Hour Mismatch: Logged hours do not match standard shift length"*.
    - *Negative Invariants*: Must **NOT** show raw 422 JSON payload or unformatted error keys.
  - **5. Persona: `demo_viewer` (Forbidden Action Rejection)**
    - *Status*: `NOT RUN`
    - *Steps*: Attempt any mutation yielding `403 forbidden`.
    - *Expected Result*: Displays localized *"You do not have permission to modify this work log."*
    - *Negative Invariants*: Must **NOT** crash or show raw key `forbidden`.

### TEST-09A-11: Project Selection Hook Stability & Task Reset (Crash Fix Verification)
- **Status**: `NOT RUN`
- **Role to Log In As**: `employee` (`demo_dev` or any employee with active project membership)
- **Test Steps**:
  1. Log in as an employee with active project memberships (e.g. `demo_dev`).
  2. Navigate to Daily Work Log (`/employee/work-logs`).
  3. Ensure a row is present with "No project" selected (default initial state).
  4. In the Project dropdown, select an assigned project (e.g. `[DEMO] Nepal Disaster Relief Portal`).
  5. Verify the Task dropdown appears dynamically without crashing or throwing a React error boundary.
  6. Select a task from the Task dropdown.
  7. Change the Project dropdown to another project (e.g. `[DEMO] Valley Transit App`) or back to "No project".
  8. Repeat the same test in a mobile viewport (375px width) in the card view.
- **Expected Result**:
  - Selecting a project runs smoothly without the React crash `"Rendered more hooks than during the previous render"`.
  - The Task dropdown loads tasks for the newly selected project via TanStack Query.
  - When switching projects or returning to "No project", the task selection is immediately reset to empty (`taskId = ''`) across both desktop and mobile views.
- **Negative Invariants (What Must NOT Happen)**:
  - Must **NOT** crash with `"Rendered more hooks than during the previous render"` or trigger a white screen of death.
  - Must **NOT** retain a task ID from a previously selected project when a new project is chosen.

### TEST-09A-12: Date-Change Hydration, Discard Confirmation Prompt, Error Card & Warnings List CSS Bullets
- **Status**: `NOT RUN`
- **Role to Log In As**: `employee` (`demo_dev` or any employee with work roles)
- **Test Steps**:
  1. Log in as `demo_dev` and navigate to Daily Work Log (`/employee/work-logs`).
  2. Select Day A (e.g. Today) and type in an entry row (select a work role, enter 4.5 hours, and enter a description). Do NOT save draft.
  3. Change the date picker to Day B (e.g. Yesterday or Tomorrow, an unlogged day).
  4. Observe the confirmation prompt dialog: `"You have unsaved entries on this date. Discard unsaved changes and switch date?"`.
  5. Click "Cancel". Verify date remains on Day A and typed entries are preserved intact.
  6. Change date to Day B again and click "OK" (confirm discard).
  7. Verify Day B loads cleanly: previous day's rows are discarded, and Day B displays a fresh empty row with the default assigned role (or saved server entries if Day B was previously logged).
  8. Switch back to Day A; verify Day A loads cleanly without retaining stale rows from Day B.
  9. While on Day B, simulate a network load failure or trigger a server error for that date.
  10. Verify the screen displays the dedicated error card with "Retry" button calling `refetchLog()`; verify the old day's rows are completely hidden.
  11. Submit a log with hours that differ from the standard shift length when mismatch handling is set to "warn" (or trigger server warnings).
  12. Inspect the submission warnings alert box.
- **Expected Result**:
  - Switching calendar dates always discards previous day's rows and initializes or hydrates the newly selected date cleanly.
  - Typing unsaved rows on a date prompts a browser confirmation warning before switching dates. Cancelling preserves the typed rows.
  - While roles or new date data are loading, user-typed rows on the SAME date are never overwritten.
  - When loading a new date encounters a server error, the existing error card with Retry button is rendered, and no rows from the previous date are displayed.
  - Server warnings render using a plain CSS list marker (`list-disc`), cleanly aligned without any mojibake or garbled bullet symbols (`â€¢`).
- **Negative Invariants (What Must NOT Happen)**:
  - Rows typed on Day A must **NOT** carry over to Day B or block Day B from initializing fresh rows.
  - Must **NOT** show a garbled symbol (such as `â€¢` or `Ã¢â‚¬Â¢`) in the server warnings list.
  - A failed load on a new date must **NOT** display the previous day's rows.

### TEST-09A-13: WorkLogHistoryPage Failed Query Error Handling & Empty Week Start Date
- **Status**: `NOT RUN`
- **Role to Log In As**: `employee` (`demo_dev`)
- **Test Steps**:
  1. Navigate to `/employee/work-log/history`.
  2. Disconnect network or simulate a 500 error on `GET /api/work-logs/by-month`.
  3. Observe whether the page renders an error alert / card with a Retry button, or if it misleadingly displays "0 work logs recorded in this month".
  4. Reconnect network, switch to "Week Summary" tab.
  5. Clear the "Week start date" date input box completely.
  6. Observe whether `GET /api/work-logs/by-week?startDate=` is fired with an invalid query parameter, and whether day table links navigate to invalid `?date=` parameters.
- **Expected Result**:
  - Failed month/week loads must display a prominent error state with a retry option.
  - Clearing the week start date must not trigger invalid API calls or break relative day calculations.
- **Negative Invariants (What Must NOT Happen)**:
  - Must **NOT** silently mask server load errors as "0 hours logged / no logs recorded".
  - Must **NOT** produce unhandled promise rejections on empty week start dates.

### TEST-09A-14: WorkLogSettingsPage Non-Admin Render Safety & Failed Settings Load Recovery
- **Status**: `NOT RUN`
- **Role to Log In As**: `hr_admin` (`demo_hr`) and `system_admin` (`boss`)
- **Test Steps**:
  1. Log in as `demo_hr` (non-`system_admin`) and attempt direct URL navigation to `/admin/settings`.
  2. Verify that `ProtectedRoute` blocks access without triggering React's `"Rendered fewer hooks than expected"` crash.
  3. Log in as `system_admin` (`boss`) and navigate to `/admin/settings`.
  4. Simulate a network failure on `GET /api/admin/settings`.
  5. Verify whether the screen displays a dedicated load error message with a Retry button or silently falls back to uninitialized default form values (`true`, `warn`, `24`).
  6. Attempt to submit an invalid edit window value (e.g. `0` or negative number or non-integer) and verify client-side validation prevents submission.
  7. Simulate a server error on save (e.g. 500 or network drop) and verify that a friendly, translated message is displayed rather than raw Axios `err.message`.
- **Expected Result**:
  - Non-admins are blocked cleanly without hook-count mismatch crashes.
  - Failed settings loads show an error card with Retry and do not allow saving uninitialized defaults.
  - Save errors display translated, actionable alerts.
- **Negative Invariants (What Must NOT Happen)**:
  - Must **NOT** crash with React hook ordering errors.
  - Must **NOT** display raw `AxiosError: Request failed with status code ...` text.

### TEST-09A-15: WorkLogExportPage Large Export, Date Parsing & Malformed Error Blob Handling
- **Status**: `NOT RUN`
- **Role to Log In As**: `employee` (`demo_dev`) and `system_admin` (`boss`)
- **Test Steps**:
  1. Log in as `demo_dev` and navigate to `/employee/work-log/export`.
  2. Enter an invalid manual date string in `startDate` (e.g. `2026-02-31`) and verify client-side date range validation rejects it before making a network request.
  3. Submit an export with 366 days and inspect the downloaded `.xlsx` filename (`work-logs-export-YYYY-MM-DD-to-YYYY-MM-DD.xlsx`).
  4. Rapidly double-click "Download Export" and verify only one network request is dispatched (`disabled={isExporting}`).
  5. Simulate an API error where the server returns a JSON error body with `responseType: 'blob'` (e.g. 400 `row_limit_exceeded`).
  6. Verify the error message is correctly parsed from the blob and displayed as a localized banner: `"Maximum row limit exceeded"`.
- **Expected Result**:
  - Malformed dates are rejected by client validation.
  - Blob error payloads are parsed and rendered as friendly translated alerts.
  - Double-click protection prevents duplicate download requests.
- **Negative Invariants (What Must NOT Happen)**:
  - Must **NOT** download a corrupted `.xlsx` file containing a JSON error response.
  - Must **NOT** freeze the UI or allow concurrent un-throttled export requests.

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

## 3. Step 12c: Project Time Logs, Workload & Project Summary

### TEST-12C-01: Time Tab & Task Time Log Hidden for Project Viewers
- **Status**: `NOT RUN`
- **Role**: Project `viewer`
- **Test Steps**:
  1. Log in as a user who has `projectRole: 'viewer'` on the target project.
  2. Navigate to `/employee/projects/:id`.
  3. Inspect the project tab navigation bar.
  4. Attempt to access `?tab=time` directly in the browser address bar.
  5. Navigate to any task detail page within the project.
- **Expected Result**: The "Time" tab button is completely hidden from the tab bar. Navigating directly to `?tab=time` falls back to the `overview` tab. In the Task Detail page, the "Time Logged" section is hidden.
- **What Must NOT Happen**: Viewers must **NOT** see the Time tab, cannot log time, and cannot see time log forms.

### TEST-12C-02: System Admin without Member Row Sees Notice Instead of Form
- **Status**: `NOT RUN`
- **Role**: `system_admin` (who has NOT been added as a member in `project.members`)
- **Test Steps**:
  1. Log in as `system_admin` (`boss` or `akrit`).
  2. Open a project where the admin has not been added as a member.
  3. Click on the "Time" tab.
  4. Inspect the top action area.
  5. Navigate to a task detail page and inspect the "Time Logged" section.
- **Expected Result**: Admin sees all project time logs. Instead of a "Log Time" button/form, an informative amber notice is displayed: *"Add yourself as a project member to log time."*
- **What Must NOT Happen**: Admin must **NOT** see a time logging form that fails with HTTP 404 from the server.

### TEST-12C-03: Log Time Validation and Creation
- **Status**: `NOT RUN`
- **Role**: Project `member` or `manager` (with an explicit membership row)
- **Test Steps**:
  1. On the "Time" tab, click "Log Time".
  2. Verify the date input defaults to today in `Asia/Kathmandu` and enforces min (today - 90 days) and max (today + 1 day).
  3. Test invalid hours: enter 0, negative values, 25, or non-quarter increments like 1.10.
  4. Enter valid values: 2.25 hours, select a project task, and enter a note. Submit the form.
- **Expected Result**: Submitting invalid hours is blocked with inline validation. Valid entry disables the button during submission, closes the modal, places the log under today's date group, and updates the loaded row total.
- **What Must NOT Happen**: Must **NOT** send caller `userId` in payload. Must **NOT** permit values outside quarter-hour steps.

### TEST-12C-04: Edit and Delete are Strictly Author-Only
- **Status**: `NOT RUN`
- **Role**: Project `manager` inspecting another member's log; and `member` inspecting peer's log
- **Test Steps**:
  1. As a project manager, navigate to the "Time" tab of a project with logs submitted by other members.
  2. Inspect the action buttons next to other members' logs.
  3. Inspect the action buttons next to the manager's own logged entries.
  4. As a regular member, repeat the inspection.
- **Expected Result**: Edit (pencil) and Delete (trash) buttons appear strictly on logs where `log.userId === session.userId`. For any other user's log, no edit or delete controls appear.
- **What Must NOT Happen**: Managers and system administrators must **NOT** be able to edit or delete time logs created by another person.

### TEST-12C-05: Workload View Privacy and Mobile Responsiveness
- **Status**: `NOT RUN`
- **Role**: Project `member` (non-manager) vs Project `manager`
- **Test Steps**:
  1. Log in as a plain project `member` and open the "Workload" tab.
  2. Inspect the "Logged Hours" column header and row values.
  3. Log in as a project `manager` and open the "Workload" tab.
  4. Resize the browser viewport down to mobile width (<640px).
- **Expected Result**:
  - For plain members, the logged hours column is labeled *"Your Logged Hours Only"*, shows logged hours for their own row, and displays `'-'` (never 0) for all other members.
  - For managers, all members' logged hours are displayed.
  - At mobile viewport width, the table cleanly transforms into stacked cards.
- **What Must NOT Happen**: Plain members must **NOT** see logged hours of peers. Null values must **NOT** render as 0 and must **NOT** be added to totals.

### TEST-12C-06: Overview Tab Overdue and Blocked Tasks Cards
- **Status**: `NOT RUN`
- **Role**: Any project member or `system_admin`
- **Test Steps**:
  1. Navigate to the `Overview` tab of a project with overdue and blocked tasks.
  2. Inspect the "Overdue Tasks" and "Blocked Tasks" cards.
  3. Click a task link in either card.
- **Expected Result**: Cards show the exact aggregate counts from the project summary (`summary.overdueCount`, `summary.blockedCount`), display up to 5 tasks linking directly to task detail, and display *"Showing first 5 tasks"* if more tasks exist.
- **What Must NOT Happen**: Must **NOT** crash, flicker, or show raw IDs.

### TEST-12C-07: Messages Tab Navigation, Cursor Pagination & Mobile Viewport
- **Status**: `NOT RUN`
- **Role**: Any project member, manager, or `system_admin`
- **Test Steps**:
  1. Open a project detail page.
  2. Click the "Messages" tab (observe URL updates with `?tab=messages`).
  3. Verify pinned messages appear at the top with a distinct pinned badge.
  4. Scroll to bottom and click "Load older messages".
  5. Resize browser to mobile viewport width (<640px).
- **Expected Result**: Pinned messages appear first, then descending chronological messages. Dates are formatted in Asia/Kathmandu time with year (e.g. "3 Nov 2026, 00:15"). "Load older messages" loads next page. Mobile viewport stacks cards cleanly without horizontal overflow.
- **What Must NOT Happen**: Must **NOT** crash, display raw JSON, or show raw UUIDs for authors.

### TEST-12C-08: Posting Messages, 5,000 Char Counter & Viewer Read-Only Invariant
- **Status**: `NOT RUN`
- **Role**: Compare Project Member vs Project Viewer
- **Test Steps**:
  1. Log in as a Project Member (`employee` with project role `member`).
  2. In the Messages tab, type a message with multiple lines. Observe live character counter.
  3. Submit the message. Verify message appears in list and input box clears.
  4. Attempt rapid double-click on "Post Message" button.
  5. Log in as a Project Viewer (`projectRole: 'viewer'`) or System Role Viewer (`systemRole: 'viewer'`).
- **Expected Result**: Project members can post messages up to 5,000 characters. Rapid double-click sends only one POST request. Viewers see an informational read-only notice and NO post message textarea.
- **What Must NOT Happen**: Viewers must **NOT** see or be able to submit the message posting form. Submitting an empty or whitespace-only message must **NOT** be permitted.

### TEST-12C-09: Pin and Unpin Gated to Managers and System Admin
- **Status**: `NOT RUN`
- **Role**: Compare Project Manager / System Admin vs Plain Project Member
- **Test Steps**:
  1. Log in as Project Member. Inspect message cards.
  2. Log in as Project Manager or `system_admin`. Inspect message cards.
  3. Click "Pin" on an unpinned message.
  4. Verify the message is marked pinned and sorted to top.
  5. Click "Unpin" on a pinned message.
- **Expected Result**: Only project managers and `system_admin` see "Pin" / "Unpin" action buttons. Pinning immediately promotes the message to the pinned section; unpinning restores it to chronological position.
- **What Must NOT Happen**: Plain members and viewers must **NOT** see pin/unpin buttons.

### TEST-12C-10: Convert Message to Task with Confirmation Dialog
- **Status**: `NOT RUN`
- **Role**: Project Member, Manager, or `system_admin`
- **Test Steps**:
  1. Find a message with a distinct first line (e.g., "Implement login audit logging\nDetailed notes on requirements...").
  2. Click "Turn into task".
  3. Inspect the confirmation dialog text.
  4. Confirm conversion.
  5. Click the task link in the success banner or on the "Converted" badge.
- **Expected Result**: Confirmation dialog accurately explains that one unassigned task in 'todo' status will be created by the user, the first line becomes the title (up to 200 chars), the full message becomes the description, and the message itself is unchanged. Success alert displays a clickable link navigating directly to the new task detail page. Overview, Tasks tab, and Workload tab reflect the new task immediately.
- **What Must NOT Happen**: Must **NOT** create duplicate tasks or promise attributes not supported by the API.

### TEST-12C-11: Conversion Idempotency & 409 Already Converted Handling
- **Status**: `NOT RUN`
- **Role**: Project Member, Manager, or `system_admin`
- **Test Steps**:
  1. Convert a message to a task.
  2. Reload the page (simulating a fresh session where in-memory state is reset).
  3. Click "Turn into task" on the same message again and confirm.
- **Expected Result**: The server returns HTTP 409 `already_converted`. The UI gracefully handles the response with a clear message: *"Message has already been converted to a task"*, and marks the message as converted in the UI session.
- **What Must NOT Happen**: Must **NOT** show an unhandled red error crash or create a second task.

### TEST-12C-12: Invalid Cursor Single Recovery without Retry Loop
- **Status**: `NOT RUN`
- **Role**: Project Member or Manager
- **Test Steps**:
  1. Trigger an invalid cursor condition (e.g. simulated via developer tools or outdated cursor).
- **Expected Result**: The UI captures the 400 `invalid_cursor` error, displays a notification (*"Message list was refreshed due to an updated cursor."*), and reloads the first page once without entering an infinite loop.
- **What Must NOT Happen**: Must **NOT** enter a repeating refetch loop.

### TEST-12C-13: Concurrent Message Conversion in Two Browsers
- **Status**: `NOT RUN`
- **Role**: `system_admin` (`akrit`)
- **Test Steps**:
  1. Log in as `akrit` in two different browsers (e.g. Chrome and Firefox, or two distinct browser profiles).
  2. In both browsers, navigate to the same project and open the Messages tab.
  3. Locate the same unconverted project message in both browser windows.
  4. Click "Turn into task" in both browsers at the exact same moment.
- **Expected Result**: Exactly one new task is created and one browser displays the success banner with the task link; the other browser receives the 409 `already_converted` response and displays the "Message has already been converted to a task" notification.
- **What Must NOT Happen**: Must **NOT** create duplicate tasks or result in an unhandled 500 error. If both browsers show success, record it as a bug.

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

---

## 5. Demo Data Tooling & Persona Hand-Testing Scenarios

### Demo User Accounts Table
The demo seed provisions 6 role-aligned test accounts in the `imac_demo` database:

| Username | System Role | Department | Employee Code | Initial Availability | Primary Work Role |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `demo_admin` | `system_admin` | IT & Infrastructure | `DEMO-ADM` | `available` | None (Admin) |
| `demo_hr` | `hr_admin` | Human Resources | `DEMO-HR` | `available` | None (HR) |
| `demo_pm` | `project_manager` | Operations & Projects | `DEMO-PM` | `busy_in_meeting` | `[DEMO] Project Coordination` |
| `demo_dev` | `employee` | Software Engineering | `DEMO-DEV` | `working_remotely` | `[DEMO] Full Stack Engineering`, `[DEMO] Quality Assurance & Testing` |
| `demo_designer` | `employee` | Design & UX | `DEMO-DES` | `available` | `[DEMO] UI/UX Design`, `[DEMO] Quality Assurance & Testing` |
| `demo_viewer` | `viewer` | Executive & Advisory | `DEMO-VW` | `out_of_office` | None (Stakeholder) |

*Credentials Note*: Password for all demo accounts is the value supplied to `$env:DEMO_PASSWORD` during demo seed. All accounts have `isActive: true`, `mustChangePassword: false`, `failedLoginCount: 0`, and `lockedUntil: null`.

---

### TEST-DEMO-01: Direct Login Without Mandatory Password Change
- **Status**: `NOT RUN`
- **Role to Log In As**: `demo_dev` (and sequentially all other demo accounts)
- **Test Steps**:
  1. Navigate to `/login`.
  2. Enter username `demo_dev` and the configured demo password.
  3. Click "Sign In".
- **Expected Result**: User is authenticated immediately and directed to the home dashboard (`/`). No force password change dialog or redirection to `/change-password` is triggered because `mustChangePassword: false`.
- **Negative Invariants (What Role Must NOT Be Able To Do)**:
  - `demo_dev` must **NOT** be able to access administrative user management (`/admin/users`) or work role catalogue configuration (`/admin/work-roles`).
  - Attempting to load `/admin/users` must return a 403 Access Denied notice or redirect to `/`.

### TEST-DEMO-02: Project Role Hierarchy and Action Boundary Enforcement
- **Status**: `NOT RUN`
- **Role to Log In As**: `demo_pm` vs. `demo_designer` vs. `demo_viewer`
- **Test Steps**:
  1. Log in as `demo_pm` (Project Manager on `[DEMO] Nepal Disaster Relief Portal`).
  2. Open the project settings and verify manager controls (e.g. member invitation, project details editing, milestone creation).
  3. Log out and log in as `demo_designer` (Member on the same project). Inspect the project view.
  4. Log out and log in as `demo_viewer` (Viewer on the same project). Inspect the project view.
- **Expected Result**:
  - `demo_pm` sees full management controls (edit project, add members, create milestones, pin messages).
  - `demo_designer` sees task boards and message feeds, and can create tasks, log time, and post comments.
  - `demo_viewer` sees project details, task lists, and messages strictly in read-only mode.
- **Negative Invariants (What Role Must NOT Be Able To Do)**:
  - `demo_designer` must **NOT** see project settings forms, member removal buttons, or project status transition dropdowns.
  - `demo_viewer` must **NOT** see "New Task", "Log Time", "Add Milestone", "Post Message", or "Turn into task" action triggers.

### TEST-DEMO-03: Former Member Historical Contribution Integrity
- **Status**: `NOT RUN`
- **Role to Log In As**: `demo_dev` (Former member on `[DEMO] Nepal Disaster Relief Portal`)
- **Test Steps**:
  1. Log in as `demo_pm` and open `[DEMO] Nepal Disaster Relief Portal`.
  2. Inspect the task board and time logs tab. Confirm historical tasks (Task 1 & Task 2) and time logs by `demo_dev` are displayed with `demo_dev`'s display name.
  3. Log in as `demo_dev` and navigate to projects list.
  4. Attempt to access `[DEMO] Nepal Disaster Relief Portal` via direct URL `/projects/<disaster-relief-id>`.
- **Expected Result**:
  - Historical tasks, comments, time logs, and messages by `demo_dev` remain intact for existing project members.
  - For `demo_dev`, since their membership was revoked, the project is excluded from their active project list.
- **Negative Invariants (What Role Must NOT Be Able To Do)**:
  - `demo_dev` must **NOT** be able to create new tasks, log additional time, or post new messages on `[DEMO] Nepal Disaster Relief Portal`.
  - Direct navigation to the project page must return 404 Not Found (or 403 Forbidden).

### TEST-DEMO-04: Hostile Script Tag & Boundary Markdown Rendering (XSS Safety)
- **Status**: `NOT RUN`
- **Role to Log In As**: `demo_pm`
- **Test Steps**:
  1. Log in as `demo_pm` and open `[DEMO] Nepal Disaster Relief Portal`.
  2. Inspect the project description containing `<script>alert(1)</script>` and `<b>bold</b>`.
  3. Open Task 2 (200-character title with raw `<script>alert(1)</script>` and `<b>bold</b>`).
  4. Inspect the 5000-character description containing markdown tables, json payloads, and Devanagari text (`नेपाल विपद् व्यवस्थापन पोर्टल`).
- **Expected Result**:
  - Browser developer tools console shows **ZERO** JavaScript alert dialog executions. The string `<script>alert(1)</script>` renders safely as text without executing.
  - The `<b>bold</b>` text renders either sanitized or escaped without altering document layout.
  - The 200-character task title renders cleanly without visual clipping or overflow outside its container.
  - The 5000-character markdown description renders with formatted tables, checkboxes, headers, and intact Devanagari characters.
- **Negative Invariants (What Must NOT Happen)**:
  - Under NO circumstances may an alert dialog pop up or any XSS vector execute.
  - Database text must NOT be escaped at write time (must store raw string) and must be escaped safely by React DOM at render time.

### TEST-DEMO-05: Status History Inspection for At-Risk, Completed, and On-Hold Projects
- **Status**: `NOT RUN`
- **Role to Log In As**: `demo_pm`
- **Test Steps**:
  1. Open `[DEMO] Valley Transit App` (status: `at_risk`).
  2. Inspect project status badge and status history log.
  3. Open `[DEMO] Heritage Preservation Archive` (status: `complete`).
  4. Open `[DEMO] Solar Grid Micro-Management` (status: `on_hold`).
- **Expected Result**:
  - Each project displays its current status accurately.
  - The Status History tab displays the recorded `ProjectStatusEvent` including the previous status (`on_track`), new status, timestamp, author (`Demo Project Manager`), and clear business reason text.
- **Negative Invariants (What Role Must NOT Be Able To Do)**:
  - Non-manager members must **NOT** see options to edit or trigger project status transitions.

### TEST-DEMO-06: Work Log to Project and Task Linkage Verification
- **Status**: `NOT RUN`
- **Role to Log In As**: `demo_dev`
- **Test Steps**:
  1. Log in as `demo_dev` and navigate to Daily Work Log History (`/employee/work-logs/history`).
  2. Open the work log for 2 days ago (submitted log) and 3 days ago (approved log).
  3. Inspect the work log entries.
- **Expected Result**:
  - Linked entries display their assigned `[DEMO] Full Stack Engineering` role, logged hours, and explicit links to the associated project (`[DEMO] Nepal Disaster Relief Portal` or `[DEMO] Valley Transit App`) and task.
  - Clicking on a linked task navigates to the relevant task detail view.
- **Negative Invariants (What Role Must NOT Be Able To Do)**:
  - An approved work log must **NOT** allow inline modification or deletion of linked project/task rows.


---

## 8. Step Demo Fixes: Demo-Data Tooling Hardening & Active Guard Assertion

### TEST-DEMO-07: Active Database Assertion Refusal on Non-Demo Database
- **Status**: `NOT RUN`
- **Role to Log In As**: Developer in PowerShell CLI
- **Test Steps**:
  1. Open a terminal and temporarily set `DATABASE_URL` pointing to the primary dev database (e.g. `postgresql://user:pass@localhost:5432/imac`).
  2. Set `$env:ALLOW_DEMO_DATA = "yes"`.
  3. Attempt to run `npm run demo:status` or `npm run demo:remove`.
- **Expected Result**:
  - The script immediately halts with a clean error message: `DEMO STATUS REFUSED: Database name in DATABASE_URL must be exactly "imac_demo"` or `Database safety guard violation: connected database must be exactly "imac_demo"`.
  - Process exits with non-zero exit code.
  - Zero modifications or queries are executed against the non-demo database.
- **Negative Invariants (What Must NOT Happen)**:
  - Must **NOT** print credentials, username, or connection URL to stdout/stderr.
  - Must **NOT** query or delete any table data from the non-demo database.

### TEST-DEMO-08: Type-Safe CLI Execution without ESM SyntaxError
- **Status**: `NOT RUN`
- **Role to Log In As**: Developer in PowerShell CLI
- **Test Steps**:
  1. In a fresh terminal without demo environment variables, run `npm run demo:status`.
  2. Run `npm run demo:remove`.
  3. Run `npm run demo:seed`.
- **Expected Result**:
  - All three scripts load cleanly via `tsx` without throwing `SyntaxError: The requested module './demoLookup.js' does not provide an export named 'DemoLookupClient'`.
  - Each script immediately prints its expected refusal message (e.g. `DEMO STATUS REFUSED: ALLOW_DEMO_DATA environment variable must be explicitly set to "yes"`) and cleanly exits with status code 1.
- **Negative Invariants (What Must NOT Happen)**:
  - Must **NOT** crash with unhandled ESM import/export syntax errors.

---

## 9. Step 09a Files Review Fixes (`apps/web` only)

### TEST-09A-FIX-01: WorkLogSettingsPage Hook Order, Failed Load Error Card & Hydration Protection
- **Status**: `NOT RUN`
- **Role to Log In As**: `system_admin` (`boss`) and non-admin (`employee` / `hr_admin`)
- **Test Steps**:
  1. Log in as `employee` or `hr_admin` and navigate to `/admin/settings`.
  2. Verify access is denied and `<UnauthorizedPage />` renders with zero React hook count warnings or crashes.
  3. Log in as `system_admin` (`boss`) and navigate to `/admin/settings`.
  4. Block network request to `GET /api/admin/settings` (simulate 500 error or network drop).
  5. Verify the screen renders the dedicated Error Card with a Retry button, and does NOT render the settings form.
  6. Re-enable network and click "Retry". Verify the form renders with server values, and `isDirty` / `isHydrated` resets.
  7. Type edits in the form (e.g. change Edit Window to 48 hours). Simulate a background refetch. Verify typed edits are strictly preserved and never overwritten by background refetches.
  8. Disconnect network and click "Save Policy Settings". Verify a friendly translated network error message is displayed (`"Network connection error. Please check your connection and try again."`) and NOT raw `err.message` or `AxiosError`.
- **Expected Result**:
  - Hooks run unconditionally; non-admins see unauthorized page without React lifecycle crashes.
  - Failed query shows error card with Retry and blocks form render.
  - Form hydration never clobbers typed edits.
  - Network save errors show translated user-friendly alert.
- **Negative Invariants (What Roles Must NOT Be Able To Do)**:
  - Non-admins must **NOT** be able to view or edit system settings.
  - A failed load must **NOT** render uninitialized default form values that could accidentally be saved.
  - Must **NOT** overwrite user-typed input on background refetch.
  - Must **NOT** show raw `err.message` or unhandled promise rejection.

### TEST-09A-FIX-02: WorkLogHistoryPage Failed Month/Week Query Error Cards & Empty Week Start Date Guard
- **Status**: `NOT RUN`
- **Role to Log In As**: `employee` (`demo_dev`) and `hr_admin` (`demo_hr`)
- **Test Steps**:
  1. Log in as `employee` and navigate to `/employee/work-log/history`.
  2. In Month tab, simulate network failure on `GET /api/work-logs/by-month`.
  3. Verify the screen displays an error card with a Retry button, instead of 0 hours and "No work logs recorded".
  4. Click "Retry" after reconnecting to verify the month logs and summary cards reload cleanly.
  5. Switch to "Week Summary" tab. Simulate network failure on `GET /api/work-logs/by-week`.
  6. Verify the screen displays an error card with a Retry button instead of 0 hours and an empty table.
  7. In the "Week start date" date picker, select the text and delete it completely (`""`).
  8. Check Network tab in devtools. Verify that no network request with `?startDate=` or `""` is dispatched.
  9. Verify the week start date maintains its previous valid date and relative day calculations continue functioning without error.
- **Expected Result**:
  - Month and Week query failures display prominent error cards with Retry.
  - Clearing the week start date is ignored and never stored or sent to the backend.
- **Negative Invariants (What Must NOT Happen)**:
  - Failed month/week queries must **NOT** silently mask server errors as "0 hours logged / no logs recorded".
  - Empty string date must **NOT** be dispatched to the API.

### TEST-09A-FIX-03: WorkLogExportPage Calendar Date Validity, 366-Day Range & Roles Query Retry
- **Status**: `NOT RUN`
- **Role to Log In As**: `employee` (`demo_dev`)
- **Test Steps**:
  1. Navigate to `/employee/work-log/export`.
  2. Simulate a failure on `GET /api/work-roles/my-roles`.
  3. Verify the Work Role dropdown shows an error notice with a Retry button.
  4. Click Retry to reload work roles.
  5. Enter an impossible calendar date in Start Date: `2026-02-31`. Click "Download Spreadsheet".
  6. Verify client validation blocks the request with translated error: "Both Start Date and End Date must be valid calendar dates (YYYY-MM-DD)."
  7. Enter `2026-02-29` (non-leap year). Verify validation rejects it.
  8. Enter `2026-01-01` to `2027-01-15` (>366 days). Verify date range max error is displayed.
  9. Enter valid date range `2026-01-01` to `2026-01-31`. Submit export and verify download succeeds.
- **Expected Result**:
  - Work roles load error displays inline Retry control.
  - Impossible calendar dates are strictly rejected before order and 366-day calculations.
- **Negative Invariants (What Must NOT Happen)**:
  - Non-existent dates must **NOT** pass validation or produce `NaN` timestamp comparisons.
  - Work role failure must **NOT** leave the filter permanently disabled without a retry mechanism.

### TEST-09A-FIX-04: Dashboard Today Work Log Load Error Handling (Network and Server Outage)
- **Status**: `NOT RUN`
- **Role to Log In As**: `employee` (`demo_dev`) and `system_admin` (`boss`)
- **Test Steps**:
  1. Log in and open Dashboard (`/employee/dashboard` or `/admin/dashboard`).
  2. Disconnect network or simulate 500 error on `GET /api/work-logs/by-date`.
  3. Inspect "Today's Work Log" card.
  4. Verify the card displays a localized error notification ("Failed to load today's work log" / "Network connection error") rather than displaying "Not started yet / 0h logged".
  5. Reconnect network and refresh dashboard to confirm normal status returns.
- **Expected Result**:
  - Failed work log query on dashboard renders an informative error notice rather than false "not started" state.
- **Negative Invariants (What Must NOT Happen)**:
  - Network or server outages must **NOT** be disguised as zero hours logged or unstarted shift.

### TEST-19A-01: Audit Log Read API - RBAC Role Access & 401/403 Invariants
- **Status**: `NOT RUN`
- **Role to Log In As**: Unauthenticated, `hr_admin` (`demo_hr`), `employee` (`demo_dev`), `viewer` (`demo_viewer`), `system_admin` (`boss`), `project_manager` (`demo_pm`)
- **Test Steps**:
  1. Send `GET /api/audit-logs` without session cookie. Verify response is HTTP 401 `{"error": "unauthenticated"}`.
  2. Log in as `hr_admin` and send `GET /api/audit-logs`. Verify response is HTTP 403 `{"error": "forbidden"}`.
  3. Log in as `employee` and send `GET /api/audit-logs`. Verify response is HTTP 403 `{"error": "forbidden"}`.
  4. Log in as `viewer` and send `GET /api/audit-logs`. Verify response is HTTP 403 `{"error": "forbidden"}`.
  5. Log in as `system_admin` and send `GET /api/audit-logs`. Verify response is HTTP 200 with `{ items, total, limit, offset }`.
  6. Log in as `project_manager` with managed projects and send `GET /api/audit-logs`. Verify response is HTTP 200 with items scoped only to their managed projects.
- **Expected Result**: Only `system_admin` and `project_manager` can access `GET /api/audit-logs`.
- **Negative Invariants (What Roles Must NOT Be Able To Do)**:
  - Unauthenticated callers must **NOT** receive audit data (401).
  - `hr_admin`, `employee`, and `viewer` must **NOT** access audit logs under any circumstances (403 forbidden).

### TEST-19A-02: Audit Log Read API - Project Manager Project Scoping & Isolation
- **Status**: `NOT RUN`
- **Role to Log In As**: `project_manager` (`demo_pm`), `system_admin` (`boss`)
- **Test Steps**:
  1. As `project_manager`, send `GET /api/audit-logs`.
  2. Inspect all returned entries: verify every item corresponds to an entity (`project`, `task`, `milestone`, `comment`, `ProjectMessage`, `time_log`) belonging to a project where caller has `projectRole = 'manager'`.
  3. Verify that zero entries regarding `User`, `Session`, `SystemSetting`, `WorkLogDay`, `WorkRole`, or `EmployeeProfile` appear in the response.
  4. Pass `projectId=<non-managed-project-uuid>`. Verify response is HTTP 404 `{"error": "not_found"}` (identical to non-member project 404).
  5. Pass non-project filter `entityType=User` or `action=user.created`. Verify response returns `{ items: [], total: 0 }` with HTTP 200 (no 403, no leakage).
  6. Log in as `system_admin` and query `entityType=User`. Verify system admin sees all organization-wide user audit records.
- **Expected Result**: Project managers are strictly bounded to their active managed projects in SQL query without data leakage.
- **Negative Invariants (What Roles Must NOT Be Able To Do)**:
  - Project managers must **NOT** see audit entries of projects where they are not managers.
  - Project managers must **NOT** see system administration, HR, session, or work log audit logs.
  - Querying non-managed project must **NOT** reveal whether the project exists (must return 404).

### TEST-19A-03: Audit Log Read API - Query Parameter Validation & Date Bounds
- **Status**: `NOT RUN`
- **Role to Log In As**: `system_admin` (`boss`)
- **Test Steps**:
  1. Send `GET /api/audit-logs?offset=0&limit=50`. Verify HTTP 200 with offset 0 accepted.
  2. Send `GET /api/audit-logs?limit=101`. Verify HTTP 400 validation error (limit capped at 100).
  3. Send `GET /api/audit-logs?from=2026-02-31&to=2026-03-05`. Verify HTTP 400 validation error for non-existent calendar date.
  4. Send `GET /api/audit-logs?from=2026-05-10&to=2026-05-01`. Verify HTTP 400 validation error for `to` before `from`.
  5. Send `GET /api/audit-logs?from=2025-01-01&to=2026-06-01` (>366 days). Verify HTTP 400 validation error.
  6. Send `GET /api/audit-logs?action=`. Verify empty string is rejected with HTTP 400 validation error.
  7. Send `GET /api/audit-logs?projectId=not-a-uuid`. Verify HTTP 400 validation error.
  8. Send `GET /api/audit-logs` without dates. Verify it defaults to the last 30 days in Asia/Kathmandu.
- **Expected Result**: Strict Zod validation and calendar date logic reject invalid inputs cleanly with HTTP 400.
- **Negative Invariants (What Must NOT Happen)**:
  - Empty strings must **NOT** be treated as absent parameters.
  - Invalid calendar dates must **NOT** cause unhandled errors or produce invalid SQL queries.

### TEST-19A-04: Audit Log Read API - Privacy & Snapshot Sanitization Allow-Lists
- **Status**: `NOT RUN`
- **Role to Log In As**: `system_admin` (`boss`) and `project_manager` (`demo_pm`)
- **Test Steps**:
  1. Inspect returned audit log item snapshots for both roles.
  2. Verify that sensitive fields are stripped: `body`, `note`, `description`, `comment`, `message`, `password`, `token`, `hash`, `secret`, `ip`, `userAgent`, and `reason` (free text).
  3. For `project_manager`, verify that administrative attributes are stripped: `employeeCode`, `department`, `jobTitle`, `systemRole`, `lockedUntil`, `failedLoginCount`.
  4. Inspect the `actor` object of each item: verify it only contains `{ id, displayName, username }`.
  5. Verify that if an actor user has been deleted or is null, placeholder `{ id, displayName: "Deleted User", username: "deleted" }` is returned.
- **Expected Result**: Sanitized snapshots adhere strictly to role-specific allow-lists.
- **Negative Invariants (What Must NOT Happen)**:
  - Private notes, message bodies, passwords, password hashes, or free-text reasons must **NOT** be exposed in snapshots.
  - Deleted actors must **NOT** cause null pointer exceptions.

### TEST-19A-05: Audit Log Read API - Read-Only Invariant Enforcement
- **Status**: `NOT RUN`
- **Role to Log In As**: `system_admin` (`boss`)
- **Test Steps**:
  1. Send `POST /api/audit-logs`. Verify HTTP 404 or 405.
  2. Send `PUT /api/audit-logs`. Verify HTTP 404 or 405.
  3. Send `PATCH /api/audit-logs`. Verify HTTP 404 or 405.
  4. Send `DELETE /api/audit-logs`. Verify HTTP 404 or 405.
  5. Send `GET /api/audit-logs`. Verify that reading the audit log does NOT create any new audit log record.
- **Expected Result**: Audit log is strictly read-only and reading does not generate recursive audit entries.
- **Negative Invariants (What Must NOT Happen)**:
  - Audit log entries must **NOT** be editable, creatable via API, or deletable via API.

### TEST-19A-FIX-01: Audit Log Query Array and Object Parameter Rejection
- **Status**: `NOT RUN`
- **Role to Log In As**: `system_admin` (`boss`)
- **Test Steps**:
  1. Send `GET /api/audit-logs?from=2026-01-01&from=2026-01-02`. Verify HTTP 400 validation error ("Query parameter \"from\" must be a plain string").
  2. Test duplicate array params for `to`, `actorUserId`, `action`, `entityType`, `projectId`, `limit`, and `offset`. Verify each returns HTTP 400 validation error.
  3. Send `GET /api/audit-logs?from[nested]=2026-01-01`. Verify HTTP 400 validation error.
- **Expected Result**: Array and object query parameters are rejected with HTTP 400 before any trimming or date calculation.
- **Negative Invariants (What Must NOT Happen)**:
  - Server must **NOT** crash with `TypeError: val.trim is not a function` when arrays or objects are sent in query strings.

### TEST-19A-FIX-02: Project Manager Isolation from Non-Project Snapshot Project ID Rows (e.g. work_log.*)
- **Status**: `NOT RUN`
- **Role to Log In As**: `project_manager` (`demo_pm`)
- **Test Steps**:
  1. Log in as `project_manager`.
  2. Query `GET /api/audit-logs`.
  3. Verify that zero entries with `entityType = 'WorkLogDay'` or action `work_log.*` (e.g. `work_log.edited_after_submit`) appear in the response, even if the work log entry referenced the manager's project ID.
  4. Query `GET /api/audit-logs?entityType=WorkLogDay`. Verify HTTP 200 with `{ items: [], total: 0 }`.
  5. Query `GET /api/audit-logs?action=work_log.edited_after_submit`. Verify HTTP 200 with `{ items: [], total: 0 }`.
- **Expected Result**: Outer SQL condition `a."entityType" IN (...) AND a."action" IN (...)` strictly guarantees that non-project rows referencing project IDs in their snapshots are never returned to project managers.
- **Negative Invariants (What Roles Must NOT Be Able To Do)**:
  - Project managers must **NOT** see employee work log edits, user account changes, password resets, or system setting modifications under any circumstances.

### TEST-19A-FIX-03: Fail-Closed Security Guard on Unexpected Caller Role
- **Status**: `NOT RUN`
- **Role to Log In As**: `employee` (`demo_dev`), `hr_admin` (`demo_hr`), `viewer` (`demo_viewer`)
- **Test Steps**:
  1. Attempt to send `GET /api/audit-logs` as any role other than `system_admin` or `project_manager`.
  2. Verify response is HTTP 403 Forbidden.
  3. Verify that if a caller role is neither `system_admin` nor `project_manager`, the handler terminates immediately and never executes an unscoped SQL query.
- **Expected Result**: Route fails closed with HTTP 403.
- **Negative Invariants (What Must NOT Happen)**:
  - An unauthorized or unrecognized caller must **NOT** trigger an unscoped database query.

### LIVE-19A-01: Audit Log Project Manager Scoped Read & Array Binding Proof
- **Status**: `NOT RUN`
- **Role to Log In As**: `project_manager` (`demo_pm`)
- **Test Steps**:
  1. Log in as `demo_pm`.
  2. Send `GET /api/audit-logs`.
- **Expected Result**:
  - Response returns HTTP 200 with valid JSON structure `{ items, total, limit, offset }`.
  - Proves PostgreSQL parameterized ANY($1) array binding succeeds cleanly without throwing an unhandled 500 error.
- **Negative Invariants (What Must NOT Happen)**:
  - Must **NOT** throw HTTP 500 or PostgreSQL syntax/binding errors when expanding project ID arrays.

### LIVE-19A-02: Audit Log Project Filter & Query Parameter Array Rejection
- **Status**: `NOT RUN`
- **Role to Log In As**: `project_manager` (`demo_pm`)
- **Test Steps**:
  1. Send `GET /api/audit-logs?projectId=<MANAGED_PROJECT_ID>` (using a project where `demo_pm` is an active manager).
  2. Verify response returns HTTP 200 with valid JSON `{ items, total, limit, offset }` scoped to that project.
  3. Send `GET /api/audit-logs?projectId=<UNMANAGED_PROJECT_ID>` (using a valid UUID for a project `demo_pm` does not manage).
  4. Verify response returns HTTP 404 `not_found` (uniform rejection, preventing existence enumeration).
  5. Send `GET /api/audit-logs?from=2026-01-01&from=2026-01-02` (duplicate array query parameter).
  6. Verify response returns HTTP 400 `validation_error` ("Query parameter \"from\" must be a plain string").
- **Expected Result**: Valid JSON for managed project, 404 for unmanaged project, and 400 for array query parameters.
- **Negative Invariants (What Roles Must NOT Be Able To Do)**:
  - Project managers must **NOT** see audit entries of projects they do not manage (must return 404).
  - Server must **NOT** crash on duplicate query parameter keys.

### LIVE-19A-03: Leak Test - Work Log Edits Linked to Project Never Exposed to Project Manager
- **Status**: `NOT RUN`
- **Role to Log In As**: `employee` (`demo_dev`), `project_manager` (`demo_pm`), `system_admin` (`boss`)
- **Test Steps**:
  1. Log in as `demo_dev`.
  2. Edit a submitted daily work log entry linked to a project managed by `demo_pm` (within edit window, modifying hours or description), creating a `work_log.edited_after_submit` audit log entry with `projectId` in its snapshot.
  3. Log in as `demo_pm` and call `GET /api/audit-logs`. Inspect all returned items.
  4. Verify the `work_log.edited_after_submit` entry is **NOT** present in the results returned to `demo_pm`.
  5. Log in as `system_admin` (`boss`) and call `GET /api/audit-logs?action=work_log.edited_after_submit`.
  6. Verify `boss` **DOES** see the `work_log.edited_after_submit` audit log entry.
- **Expected Result**:
  - The outer SQL filter `a."entityType" IN (PROJECT_MAPPABLE_ENTITY_TYPES) AND a."action" IN (PROJECT_ACTIONS)` prevents `work_log.*` rows from leaking to project managers even if their snapshots reference the manager's project.
- **Negative Invariants (What Must NOT Happen)**:
  - Project managers must **NOT** see any work log audit entries.
  - Note on seed data: The 3 seeded `work_log.edited_after_submit` rows have a null `projectId`, so they prove nothing about the leak fix; this live test verifies a fresh post-submission work log edit linked to an actual managed project ID.

### LIVE-19A-04: Non-Manager & Non-Admin Role Audit Log Access Rejection
- **Status**: `NOT RUN`
- **Role to Log In As**: `employee` (`demo_dev`), `hr_admin` (`demo_hr`), `viewer` (`demo_viewer`)
- **Test Steps**:
  1. Log in as `demo_dev` and call `GET /api/audit-logs`. Verify HTTP 403 `forbidden`.
  2. Log in as `demo_hr` and call `GET /api/audit-logs`. Verify HTTP 403 `forbidden`.
  3. Log in as `demo_viewer` and call `GET /api/audit-logs`. Verify HTTP 403 `forbidden`.
- **Expected Result**: All three roles receive HTTP 403 Forbidden with `{ "error": "forbidden" }`.
- **Negative Invariants (What Roles Must NOT Be Able To Do)**:
  - Neither `employee`, `hr_admin`, nor `viewer` may access any audit log entries under any circumstances.

### LIVE-19A-05: Task & Message Creation Audit Snapshot Privacy
- **Status**: `NOT RUN`
- **Role to Log In As**: `project_manager` (`demo_pm`)
- **Test Steps**:
  1. Log in as `demo_pm`.
  2. Create a new task with a sensitive description (e.g. "Confidential task body with sensitive implementation notes").
  3. Create a project message with sensitive body text.
  4. Call `GET /api/audit-logs`.
  5. Locate the resulting audit log entries (`task.created` and any related entries).
  6. Inspect `beforeSnapshot` and `afterSnapshot`.
- **Expected Result**:
  - Audit log entries contain only allowed fields (`id`, `title`, `status`, `projectId`, etc.).
  - Snapshots contain **NO** `description`, `body`, `message`, or `note` field.
- **Negative Invariants (What Must NOT Happen)**:
  - Free-form task descriptions and message body text must **NOT** appear in audit log snapshots.



