-- ============================================================================
-- READ-ONLY SQL CHECK: Notification Triggers Verification
-- Target database: imac_demo ONLY (DO NOT run in production or write/modify rows)
-- ============================================================================
-- Lists the newest 20 Notification rows with recipient user, type, and payload keys.

SELECT
  n.id,
  u.username AS recipient_username,
  u."displayName" AS recipient_display_name,
  n.type,
  n."entityType",
  n."entityId",
  n."projectId",
  ARRAY(SELECT jsonb_object_keys(n.payload::jsonb)) AS payload_keys,
  n."readAt",
  n."createdAt"
FROM "Notification" n
JOIN "User" u ON u.id = n."userId"
ORDER BY n."createdAt" DESC, n.id DESC
LIMIT 20;
