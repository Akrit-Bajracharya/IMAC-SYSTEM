-- ============================================================================
-- READ-ONLY SQL CHECK: Daily Work Log Reminder Verification
-- Target database: imac_demo ONLY (DO NOT run in production or write/modify rows)
-- ============================================================================

-- 1. Check current work log reminder settings
SELECT key, value, "updatedAt"
FROM "SystemSetting"
WHERE key IN ('worklog.reminder.enabled', 'worklog.reminder.time')
ORDER BY key;

-- 2. List newest 20 work_log.reminder notifications with recipient user & payload
SELECT
  n.id,
  u.username AS recipient_username,
  u."systemRole" AS recipient_role,
  n.type,
  n."entityType",
  n."entityId" AS reminder_date,
  n.payload,
  n."readAt",
  n."createdAt"
FROM "Notification" n
JOIN "User" u ON u.id = n."userId"
WHERE n.type = 'work_log.reminder'
ORDER BY n."createdAt" DESC, n.id DESC
LIMIT 20;
