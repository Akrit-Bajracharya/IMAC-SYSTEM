# Step 8b: Daily Work Log Backend (APIs, Policies, Validation, Audit) Progress & Notes

## Error Code Strings
All endpoints return consistent error response envelopes: `{ error: string, message: string, details?: unknown[] }`.
The error code strings implemented in Step 8b include:
- `unauthenticated` (HTTP 401): Missing or expired session cookie.
- `forbidden` (HTTP 403): User lacks required permissions (e.g., viewer writing logs, non-admin invoking admin override).
- `not_found` (HTTP 404): Work log day or entity not found, or IDOR cross-employee access attempt.
- `profile_not_found` (HTTP 404): Authenticated user has no corresponding `EmployeeProfile`.
- `validation_error` (HTTP 400): Schema validation failure (invalid date, 0.25h step mismatch, hours > 24, missing override reason).
- `unassigned_work_role` (HTTP 400): Employee attempted to log hours against a role not assigned to them in `EmployeeWorkRole`.
- `invalid_work_role` (HTTP 400): Inactive or non-existent work role referenced in an entry.
- `empty_work_log` (HTTP 400): Submitting a log with 0 entries or 0 total hours.
- `already_submitted` (HTTP 400): Submitting a log that is already in `submitted` or `approved` status.
- `edit_window_expired` (HTTP 403): Employee attempting to edit a submitted log after the edit window (`worklog.editWindowHours`) has elapsed.
- `log_already_approved` (HTTP 403): Employee attempting to edit an already approved log.
- `hour_mismatch` (HTTP 422): Submission rejected when `worklog.mismatchHandling` is set to `"block"` and total logged hours differ from `standardShiftHours`.
- `status_conflict` (HTTP 409): Calling draft upsert for a date that is already submitted or approved.
- `day_already_exists` (HTTP 409): Concurrent creation or database constraint collision for the same employee and date.
- `csrf_invalid` (HTTP 403): Missing or invalid CSRF token on mutation requests.

## Policy Notes
- **`worklog.requiresApproval`**: Seeded and parsed with default `"false"`. In Step 8b, this policy setting is defined and readable via settings, but approval workflows (`approved` / `rejected` status transitions and endpoints) belong to Step 8d/future steps.
- **`worklog.mismatchHandling`**: Supports `"block"` (rejects submit with 422), `"warn"` (submits with warning message in payload), and `"allow"` (submits silently). Falls back safely to `"warn"` on invalid setting values.
- **`worklog.editWindowHours`**: Configurable window in hours (counted from `submittedAt`). Falls back to `24` on non-numeric or <= 0 values. Edits by employees within the window trigger an append-only `AuditLog` entry (`work_log.edited_after_submit`).
- **Admin Override**: System administrators can override logs at any time via `PATCH /api/admin/work-logs/:id/override` with a mandatory non-empty reason, generating an `AuditLog` entry (`work_log.admin_override`).

## Mock-Based Test Limitations
The API test suite utilizes Vitest with an in-memory mock of Prisma (`db`). While this allows fast and deterministic testing of application logic, RBAC, input validation, and business rules, mock-based tests have specific inherent limitations:
1. **Real Postgres Unique Constraints**: The `@unique([employeeProfileId, date])` constraint is simulated in mocks. True database-level race conditions and concurrent write serialization under PostgreSQL MVCC can only be verified with an integration test running against a live PostgreSQL instance.
2. **Database Transactions (`$transaction`)**: The in-memory transaction mock executes sequentially or concurrently, but does not provide true ACID transaction rollbacks on unexpected runtime errors or uncommitted reads.
3. **Foreign Key Deletes & Cascades**: Foreign key relations (`onDelete: Cascade` / `onDelete: Restrict`) are handled by Prisma/PostgreSQL directly in production, but simulated in unit mocks.
