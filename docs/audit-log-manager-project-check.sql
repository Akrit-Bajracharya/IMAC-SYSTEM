-- =============================================================================
-- IMAC Nepal Operations System - Audit Log Manager Scoping Verification Script
-- Target Database: imac_demo (READ-ONLY)
-- DO NOT RUN AUTOMATICALLY during CI, build, or deployment.
--
-- PURPOSE:
-- This script contains read-only SELECT queries to verify the audit log counts
-- returned for a Project Manager's managed project versus the overall audit log table.
-- =============================================================================

-- 1. Find all active projects and their designated managers in imac_demo
SELECT
  p.id AS project_id,
  p.name AS project_name,
  u.id AS manager_user_id,
  u.username AS manager_username,
  u."displayName" AS manager_name
FROM "Project" p
JOIN "ProjectMember" pm ON pm."projectId" = p.id AND pm."projectRole" = 'manager'
JOIN "User" u ON u.id = pm."userId"
ORDER BY p.name ASC;

-- 2. Count audit log entries scoped to a specific manager's project
-- (Replace '<TARGET_PROJECT_ID>' with a UUID from query 1)
WITH scoped_audit AS (
  SELECT a.*
  FROM "AuditLog" a
  WHERE (
    -- Direct project records
    (LOWER(a."entityType") = 'project' AND a."entityId" = '<TARGET_PROJECT_ID>')
    OR
    -- Direct snapshot project references (including deleted tasks/comments)
    (a."beforeSnapshot"->>'projectId' = '<TARGET_PROJECT_ID>')
    OR
    (a."afterSnapshot"->>'projectId' = '<TARGET_PROJECT_ID>')
    OR
    -- Milestones belonging to the project
    (LOWER(a."entityType") = 'milestone' AND a."entityId" IN (
      SELECT m.id FROM "Milestone" m WHERE m."projectId" = '<TARGET_PROJECT_ID>'
    ))
    OR
    -- Tasks belonging to the project
    (LOWER(a."entityType") = 'task' AND a."entityId" IN (
      SELECT t.id FROM "Task" t WHERE t."projectId" = '<TARGET_PROJECT_ID>'
    ))
    OR
    -- Comments on tasks belonging to the project
    (LOWER(a."entityType") = 'comment' AND a."entityId" IN (
      SELECT c.id FROM "Comment" c JOIN "Task" t ON c."taskId" = t.id WHERE t."projectId" = '<TARGET_PROJECT_ID>'
    ))
    OR
    -- Messages belonging to the project
    (a."entityType" = 'ProjectMessage' AND a."entityId" IN (
      SELECT pm.id FROM "ProjectMessage" pm WHERE pm."projectId" = '<TARGET_PROJECT_ID>'
    ))
    OR
    -- Time logs belonging to the project
    (a."entityType" = 'time_log' AND (
      (a."afterSnapshot"->>'projectId' = '<TARGET_PROJECT_ID>')
      OR
      (a."entityId" IN (
        SELECT tl.id FROM "TimeLog" tl WHERE tl."projectId" = '<TARGET_PROJECT_ID>'
      ))
    ))
  )
)
SELECT
  COUNT(*) AS total_scoped_audit_logs,
  COUNT(*) FILTER (WHERE LOWER("entityType") = 'project') AS project_entries,
  COUNT(*) FILTER (WHERE LOWER("entityType") = 'milestone') AS milestone_entries,
  COUNT(*) FILTER (WHERE LOWER("entityType") = 'task') AS task_entries,
  COUNT(*) FILTER (WHERE LOWER("entityType") = 'comment') AS comment_entries,
  COUNT(*) FILTER (WHERE "entityType" = 'ProjectMessage') AS message_entries,
  COUNT(*) FILTER (WHERE "entityType" = 'time_log') AS time_log_entries
FROM scoped_audit;

-- 3. Total audit entries in imac_demo (for system_admin comparison)
SELECT
  COUNT(*) AS total_all_audit_logs,
  COUNT(*) FILTER (WHERE "entityType" IN ('User', 'Session', 'EmployeeProfile', 'WorkRole', 'EmployeeWorkRole', 'SystemSetting', 'WorkLogDay')) AS admin_only_entries,
  COUNT(*) FILTER (WHERE "entityType" IN ('project', 'milestone', 'task', 'Task', 'comment', 'ProjectMessage', 'time_log')) AS project_mappable_entries
FROM "AuditLog";

-- 4. Count AuditLog rows whose entityType is NOT project-mappable but whose snapshot projectId equals a managed project
-- (Step 19a-fix Item 7: Verifies the leak boundary: these non-project rows must NOT be visible to a project manager)
-- (Replace '<TARGET_PROJECT_ID>' with a UUID from query 1)
--
-- This query returns the count of non-project rows (e.g. WorkLogDay with an edited_after_submit entry)
-- that reference this project in beforeSnapshot or afterSnapshot.
-- In the API (GET /api/audit-logs), the outer SQL condition:
--   a."entityType" IN (PROJECT_MAPPABLE_ENTITY_TYPES) AND a."action" IN (PROJECT_ACTIONS)
-- guarantees that exactly ZERO (0) of these rows are returned to a project_manager.
SELECT
  COUNT(*) AS non_project_rows_with_snapshot_project_id,
  COALESCE(json_agg(json_build_object(
    'id', a.id,
    'action', a.action,
    'entityType', a."entityType",
    'entityId', a."entityId",
    'createdAt', a."createdAt"
  )), '[]'::json) AS sample_non_project_entries
FROM "AuditLog" a
WHERE a."entityType" NOT IN ('project', 'milestone', 'task', 'Task', 'comment', 'ProjectMessage', 'time_log')
  AND (
    (a."beforeSnapshot"->>'projectId' = '<TARGET_PROJECT_ID>')
    OR
    (a."afterSnapshot"->>'projectId' = '<TARGET_PROJECT_ID>')
  );

