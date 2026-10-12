import { db } from '../db.js';
import { logger } from '../logger.js';

export interface AuditParams {
  actorUserId?: string | null;
  action: string;
  entityType?: string | null;
  entityId?: string | null;
  beforeSnapshot?: Record<string, unknown> | null;
  afterSnapshot?: Record<string, unknown> | null;
  ipAddress?: string | null;
}

export async function createAuditEntry(params: AuditParams): Promise<void> {
  try {
    await db.auditLog.create({
      data: {
        actorUserId: params.actorUserId ?? undefined,
        action: params.action,
        entityType: params.entityType ?? undefined,
        entityId: params.entityId ?? undefined,
        beforeSnapshot: (params.beforeSnapshot as any) ?? undefined,
        afterSnapshot: (params.afterSnapshot as any) ?? undefined,
        ipAddress: params.ipAddress ?? undefined,
      },
    });
  } catch (err) {
    // Audit log failures must never crash the main request
    logger.error({ err, params }, 'Failed to write audit log entry');
  }
}
