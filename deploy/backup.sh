#!/bin/bash
# Nightly backup script — run from host or as a cron job
set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-/backups}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
KEEP_DAYS="${KEEP_DAYS:-30}"

mkdir -p "$BACKUP_DIR"

echo "[$(date)] Starting backup..."

# Database dump
docker exec imac-system-postgres-1 pg_dump -U imac_user imac_db | gzip > "$BACKUP_DIR/db_$TIMESTAMP.sql.gz"
echo "[$(date)] Database backed up."

# Uploads backup
docker run --rm -v imac-system_uploads:/data -v "$BACKUP_DIR":/backup alpine \
  tar czf "/backup/uploads_$TIMESTAMP.tar.gz" -C /data .
echo "[$(date)] Uploads backed up."

# Delete old backups
find "$BACKUP_DIR" -name 'db_*.sql.gz' -mtime +$KEEP_DAYS -delete
find "$BACKUP_DIR" -name 'uploads_*.tar.gz' -mtime +$KEEP_DAYS -delete
echo "[$(date)] Old backups cleaned up (kept last $KEEP_DAYS days)."
echo "[$(date)] Backup complete."
