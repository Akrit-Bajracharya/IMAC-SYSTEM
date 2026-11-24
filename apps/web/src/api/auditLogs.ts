import { apiClient } from './client.js';
import { buildAuditLogQueryParams, type AuditLogFilterParams } from '../lib/auditLogHelpers.js';

export interface AuditLogActor {
  id: string;
  displayName: string;
  username: string;
}

export interface AuditLogItem {
  id: string;
  createdAt: string;
  action: string;
  entityType: string;
  entityId: string | null;
  actor: AuditLogActor;
  beforeSnapshot: Record<string, unknown> | null;
  afterSnapshot: Record<string, unknown> | null;
}

export interface AuditLogsResponse {
  items: AuditLogItem[];
  total: number;
  limit: number;
  offset: number;
}

/**
 * Calls GET /api/audit-logs with query parameter filtering.
 * Never sends empty or undefined values; explicitly preserves offset: 0.
 */
export async function fetchAuditLogs(params: AuditLogFilterParams): Promise<AuditLogsResponse> {
  const cleanParams = buildAuditLogQueryParams(params);
  const res = await apiClient.get<AuditLogsResponse>('/audit-logs', { params: cleanParams });
  return res.data;
}
