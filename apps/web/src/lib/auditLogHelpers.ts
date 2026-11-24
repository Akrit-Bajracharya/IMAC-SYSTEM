import { isValidCalendarDate, resolveWorkLogErrorInfo } from './workLogReviewHelpers.js';

export interface AuditLogFilterParams {
  from?: string;
  to?: string;
  actorUserId?: string;
  action?: string;
  entityType?: string;
  limit?: number;
  offset?: number;
}

/**
 * Builds clean query parameters for GET /api/audit-logs.
 * - Drops undefined, null, and empty trimmed strings.
 * - offset 0 is valid and explicitly preserved (never dropped by falsy checks).
 */
export function buildAuditLogQueryParams(
  params: AuditLogFilterParams
): Record<string, string | number> {
  const result: Record<string, string | number> = {};

  if (params.from !== undefined && params.from !== null && params.from.trim() !== '') {
    result['from'] = params.from.trim();
  }

  if (params.to !== undefined && params.to !== null && params.to.trim() !== '') {
    result['to'] = params.to.trim();
  }

  if (params.actorUserId !== undefined && params.actorUserId !== null && params.actorUserId.trim() !== '') {
    result['actorUserId'] = params.actorUserId.trim();
  }

  if (params.action !== undefined && params.action !== null && params.action.trim() !== '') {
    result['action'] = params.action.trim();
  }

  if (params.entityType !== undefined && params.entityType !== null && params.entityType.trim() !== '') {
    result['entityType'] = params.entityType.trim();
  }

  if (typeof params.limit === 'number' && !isNaN(params.limit) && params.limit > 0) {
    result['limit'] = params.limit;
  }

  // offset 0 is valid and must be sent
  if (typeof params.offset === 'number' && !isNaN(params.offset) && params.offset >= 0) {
    result['offset'] = params.offset;
  }

  return result;
}

export interface DateValidationResult {
  valid: boolean;
  errorKey?: string;
  defaultMessage?: string;
}

/**
 * Validates from and to calendar dates.
 * Requires real calendar dates (rejects impossible dates like 2026-02-31) and ensures to >= from.
 */
export function validateAuditDateRange(from: string, to: string): DateValidationResult {
  const trimmedFrom = from.trim();
  const trimmedTo = to.trim();

  if (!isValidCalendarDate(trimmedFrom) || !isValidCalendarDate(trimmedTo)) {
    return {
      valid: false,
      errorKey: 'admin.auditLog.errors.invalidDate',
      defaultMessage: 'Both Start Date and End Date must be valid calendar dates (YYYY-MM-DD).',
    };
  }

  if (trimmedTo < trimmedFrom) {
    return {
      valid: false,
      errorKey: 'admin.auditLog.errors.dateOrder',
      defaultMessage: 'End Date cannot be earlier than Start Date.',
    };
  }

  return { valid: true };
}

export interface PaginationSummary {
  start: number;
  end: number;
  total: number;
  hasPrev: boolean;
  hasNext: boolean;
  summaryText: string;
}

/**
 * Computes pagination boundaries and label for audit logs.
 */
export function formatPaginationSummary(
  total: number,
  limit: number,
  offset: number
): PaginationSummary {
  const safeTotal = Math.max(0, total);
  const safeOffset = Math.max(0, offset);
  const safeLimit = Math.max(1, limit);

  if (safeTotal === 0) {
    return {
      start: 0,
      end: 0,
      total: 0,
      hasPrev: false,
      hasNext: false,
      summaryText: 'Showing 0-0 of 0',
    };
  }

  const start = safeOffset + 1;
  const end = Math.min(safeOffset + safeLimit, safeTotal);
  const hasPrev = safeOffset > 0;
  const hasNext = end < safeTotal;

  return {
    start,
    end,
    total: safeTotal,
    hasPrev,
    hasNext,
    summaryText: `Showing ${start}-${end} of ${safeTotal}`,
  };
}

export const MAX_SNAPSHOT_STRING_LENGTH = 2000;

/**
 * Recursively truncates strings longer than MAX_SNAPSHOT_STRING_LENGTH characters.
 */
export function truncateSnapshotValue(val: unknown): unknown {
  if (typeof val === 'string') {
    if (val.length > MAX_SNAPSHOT_STRING_LENGTH) {
      return val.slice(0, MAX_SNAPSHOT_STRING_LENGTH) + ' ... [truncated]';
    }
    return val;
  }
  if (Array.isArray(val)) {
    return val.map(truncateSnapshotValue);
  }
  if (val && typeof val === 'object') {
    const res: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(val as Record<string, unknown>)) {
      res[k] = truncateSnapshotValue(v);
    }
    return res;
  }
  return val;
}

/**
 * Formats a snapshot object into plain-text JSON representation.
 * - Empty/null snapshots return '(empty)'.
 * - String fields > 2000 chars are truncated with '... [truncated]'.
 * - Text is safe for rendering inside <pre> without HTML injection.
 */
export function formatSnapshotText(snapshot: Record<string, unknown> | null | undefined): string {
  if (!snapshot || Object.keys(snapshot).length === 0) {
    return '(empty)';
  }
  const truncated = truncateSnapshotValue(snapshot);
  return JSON.stringify(truncated, null, 2);
}

export interface ResolvedAuditLogError {
  code: string;
  messageKey: string;
  defaultMessage: string;
  isNetworkError: boolean;
  status?: number;
}

/**
 * Resolves errors specifically for the audit log screen (Amendment C).
 * Reuses resolveWorkLogErrorInfo for classification, but maps failure classes
 * to audit-specific admin.auditLog.errors.* translation keys (no work-log wording).
 */
export function resolveAuditLogError(error: unknown): ResolvedAuditLogError {
  const base = resolveWorkLogErrorInfo(error);

  if (base.isNetworkError) {
    return {
      code: 'network_error',
      messageKey: 'common.networkError',
      defaultMessage: 'Network connection error. Please check your connection and try again.',
      isNetworkError: true,
      status: base.status,
    };
  }

  if (base.status === 403) {
    return {
      code: 'forbidden',
      messageKey: 'admin.auditLog.errors.forbidden',
      defaultMessage: 'You are not authorized to view the system audit logs.',
      isNetworkError: false,
      status: 403,
    };
  }

  if (base.status === 400) {
    const err = error as any;
    const serverMsg = typeof err?.response?.data?.message === 'string' ? err.response.data.message : undefined;
    return {
      code: 'validation_error',
      messageKey: 'admin.auditLog.errors.validation',
      defaultMessage: serverMsg || 'Invalid query parameters provided for audit logs.',
      isNetworkError: false,
      status: 400,
    };
  }

  if (base.status === 404) {
    return {
      code: 'not_found',
      messageKey: 'admin.auditLog.errors.notFound',
      defaultMessage: 'Requested audit log resource not found.',
      isNetworkError: false,
      status: 404,
    };
  }

  return {
    code: base.code || 'unknown_error',
    messageKey: 'admin.auditLog.errors.generic',
    defaultMessage: 'An error occurred while loading audit log entries. Please try again.',
    isNetworkError: false,
    status: base.status,
  };
}
