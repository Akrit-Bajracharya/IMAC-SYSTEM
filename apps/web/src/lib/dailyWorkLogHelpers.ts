import type { ProjectMember } from '../types/index.js';

export interface ProjectWithMembers {
  id: string;
  name: string;
  members?: ProjectMember[];
}

export interface WorkLogEntryRow {
  id?: string;
  workRoleId: string;
  hours: number | string;
  description: string;
  projectId: string;
  taskId: string;
}

export interface WorkLogEntryPayload {
  workRoleId: string;
  hours: number;
  description: string | null;
  projectId: string | null;
  taskId: string | null;
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Validates whether a given string is a valid standard UUID.
 */
export function isValidUuid(val?: string | null): boolean {
  if (typeof val !== 'string') return false;
  return UUID_REGEX.test(val.trim());
}

/**
 * Checks whether a given string is non-empty legacy free-text (i.e. not a valid UUID).
 */
export function isLegacyText(val?: string | null): boolean {
  if (!val) return false;
  const trimmed = val.trim();
  if (!trimmed) return false;
  return !isValidUuid(trimmed);
}

/**
 * Determines whether a project is eligible for Daily Work Log selection by a given user.
 * Requirement 1a: Project options come only from projects where the current user is
 * an ACTIVE member with project role manager or member. Viewer-only or non-member projects
 * must never be offered.
 * Real ProjectMember type audit:
 * - field name: projectRole ('manager' | 'member' | 'viewer')
 * - user.isActive: checks that the member user account is not deactivated.
 */
export function isProjectEligibleForUser(
  project: ProjectWithMembers,
  userId?: string | null
): boolean {
  if (!userId || !project || !Array.isArray(project.members)) {
    return false;
  }
  const membership = project.members.find((m) => m.userId === userId);
  if (!membership) {
    return false;
  }

  // Active check on the user object if present
  if (membership.user && membership.user.isActive === false) {
    return false;
  }

  return membership.projectRole === 'manager' || membership.projectRole === 'member';
}

/**
 * Filters an array of projects to only those where the given user is an active member
 * with project role 'manager' or 'member'.
 */
export function filterEligibleProjects<T extends ProjectWithMembers>(
  projects: T[],
  userId?: string | null
): T[] {
  if (!userId || !Array.isArray(projects)) {
    return [];
  }
  return projects.filter((p) => isProjectEligibleForUser(p, userId));
}

/**
 * Checks if the user has entered any data into the rows.
 * Used during hydration to ensure typed rows are never overwritten.
 */
export function hasUserTypedRows(entries: WorkLogEntryRow[]): boolean {
  if (!entries || entries.length === 0) return false;
  return entries.some((row) => {
    const hasHours = row.hours !== '' && row.hours !== 0 && row.hours !== '0';
    const hasDesc = Boolean(row.description && row.description.trim() !== '');
    const hasProject = Boolean(row.projectId && row.projectId.trim() !== '');
    const hasTask = Boolean(row.taskId && row.taskId.trim() !== '');
    return hasHours || hasDesc || hasProject || hasTask;
  });
}

/**
 * Prepares payload entries for saveWorkLogDraft / patchWorkLog.
 * Drops legacy free-text IDs to null so junk text NEVER causes 400 invalid_project / invalid_task.
 */
export function buildWorkLogEntriesPayload(
  entries: WorkLogEntryRow[]
): WorkLogEntryPayload[] {
  if (!entries || entries.length === 0) {
    throw new Error('atLeastOneEntry');
  }

  return entries.map((row) => {
    if (!row.workRoleId) {
      throw new Error('validation_error');
    }

    const h = typeof row.hours === 'number' ? row.hours : parseFloat(String(row.hours));
    if (isNaN(h) || h <= 0) {
      throw new Error('hoursPositive');
    }

    const trimmedDesc = row.description?.trim();
    const description = trimmedDesc ? trimmedDesc : null;

    // Requirement 1e: Legacy text is NEVER sent in write payloads. Only valid UUIDs are sent.
    const rawProjectId = row.projectId?.trim() || '';
    const validProjectId = isValidUuid(rawProjectId) ? rawProjectId : null;

    // Task ID requires valid project UUID and valid task UUID.
    const rawTaskId = row.taskId?.trim() || '';
    const validTaskId = validProjectId && isValidUuid(rawTaskId) ? rawTaskId : null;

    return {
      workRoleId: row.workRoleId,
      hours: h,
      description,
      projectId: validProjectId,
      taskId: validTaskId,
    };
  });
}

const KNOWN_INTERNAL_ERROR_KEYS = new Set([
  'atLeastOneEntry',
  'hoursPositive',
  'validation_error',
  'invalid_project',
  'invalid_task',
  'edit_window_expired',
  'hour_mismatch',
  'unassigned_work_role',
  'status_conflict',
  'conflict_retry',
  'already_submitted',
  'log_already_approved',
  'profile_not_found',
  'row_limit_exceeded',
  'forbidden',
  'networkError',
  'generic',
]);

/**
 * Resolves error messages from work log mutations.
 * Invariants (Amendment A & B):
 * - ONLY a MISSING err.response (or err.code === 'ECONNABORTED') means network/timeout.
 * - A response with no data or no string code must NOT be called a network error.
 *   Uses status mapping (403 forbidden, 422 hour_mismatch), else generic server error.
 * - Only treat data.error as a code if it is a string.
 * - Never shows raw error keys.
 * - Always returns a string (with last-resort hardcoded English fallback).
 */
export function resolveWorkLogError(
  err: any,
  translateCode: (code: string) => string | undefined,
  callbacks?: {
    onWindowExpired?: () => void;
  }
): string {
  // 1. Client-side thrown errors with known keys (e.g. atLeastOneEntry, hoursPositive, validation_error)
  if (typeof err?.message === 'string' && KNOWN_INTERNAL_ERROR_KEYS.has(err.message)) {
    const translatedThrown = translateCode(err.message);
    if (translatedThrown) {
      return translatedThrown;
    }
    // Never show a raw key identifier
    const genericThrown = translateCode('generic');
    return genericThrown || 'Validation error: please verify all fields.';
  }

  // 2. Network / timeout error: strictly when err.response is missing OR err.code is 'ECONNABORTED'
  const isNetworkOrTimeout = !err?.response || err?.code === 'ECONNABORTED';
  if (isNetworkOrTimeout) {
    const networkMsg = translateCode('networkError');
    if (networkMsg) return networkMsg;
    const genericMsg = translateCode('generic');
    if (genericMsg) return genericMsg;
    return 'Network error: unable to reach the server. Please check your connection and try again.';
  }

  // 3. Response exists: do NOT call it a network error!
  const status = err.response?.status;
  const data = err.response?.data;

  // Only treat data.error as a code if it is a string
  const rawCode = typeof data?.error === 'string' ? data.error : undefined;
  const code =
    rawCode ||
    (status === 403 ? 'forbidden' : status === 422 ? 'hour_mismatch' : undefined);

  if (code === 'edit_window_expired') {
    callbacks?.onWindowExpired?.();
  }

  if (code) {
    const translated = translateCode(code);
    if (translated) {
      return translated;
    }
  }

  // If server sent a string message, use it
  if (typeof data?.message === 'string' && data.message.trim().length > 0) {
    return data.message;
  }

  // Generic server error translation lookup
  const genericTranslated = translateCode('generic');
  if (genericTranslated) {
    return genericTranslated;
  }

  // Last-resort hard-coded English fallback
  return 'An error occurred while saving the work log.';
}

/**
 * Pure helper to apply a project change to a work log entry row.
 * Invariant: changing the project ALWAYS resets taskId to empty string ('').
 */
export function applyProjectChangeToRow(
  row: WorkLogEntryRow,
  newProjectId: string
): WorkLogEntryRow {
  return {
    ...row,
    projectId: newProjectId,
    taskId: '',
  };
}
