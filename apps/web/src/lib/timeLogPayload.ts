/**
 * Validation and payload construction helpers for project time log mutations.
 * Enforces quarter-hour steps, 24-hour ceiling, Kathmandu date boundaries, and field diffing.
 */

import {
  getKathmanduToday,
  addDays,
  extractDatePart,
  toDateInputValue,
} from './dateUtils.js';
import type { CreateTimeLogPayload, PatchTimeLogPayload } from '../types/index.js';

export function isQuarterHourIncrement(val: number): boolean {
  if (typeof val !== 'number' || isNaN(val)) return false;
  return Math.abs(val * 4 - Math.round(val * 4)) < 1e-9;
}

export function getTimeLogDateMin(referenceToday?: string): string {
  const base = referenceToday ?? getKathmanduToday();
  return addDays(base, -90);
}

export function getTimeLogDateMax(referenceToday?: string): string {
  const base = referenceToday ?? getKathmanduToday();
  return addDays(base, 1);
}

export interface CreateTimeLogInput {
  taskId?: string | null;
  workDate: string;
  hours: number | string;
  note?: string | null;
}

export type BuildPayloadResult<T> =
  | { ok: true; payload: T }
  | { ok: false; error: string; field?: string };

export function validateAndBuildCreatePayload(
  input: CreateTimeLogInput,
  referenceToday?: string
): BuildPayloadResult<CreateTimeLogPayload> {
  // 1. Validate workDate
  const cleanDate = extractDatePart(input.workDate);
  if (!cleanDate) {
    return { ok: false, error: 'invalid_date_format', field: 'workDate' };
  }

  const minDate = getTimeLogDateMin(referenceToday);
  const maxDate = getTimeLogDateMax(referenceToday);
  if (cleanDate < minDate || cleanDate > maxDate) {
    return { ok: false, error: 'invalid_date_range', field: 'workDate' };
  }

  // 2. Validate hours
  const rawHours = typeof input.hours === 'string' ? parseFloat(input.hours) : input.hours;
  if (typeof rawHours !== 'number' || isNaN(rawHours) || rawHours <= 0) {
    return { ok: false, error: 'hours_must_be_positive', field: 'hours' };
  }
  if (rawHours > 24) {
    return { ok: false, error: 'hours_cannot_exceed_24', field: 'hours' };
  }
  if (!isQuarterHourIncrement(rawHours)) {
    return { ok: false, error: 'hours_quarter_increment', field: 'hours' };
  }

  // 3. Validate note
  let cleanNote: string | null = null;
  if (input.note !== undefined && input.note !== null) {
    const trimmed = input.note.trim();
    if (trimmed.length > 5000) {
      return { ok: false, error: 'note_too_long', field: 'note' };
    }
    cleanNote = trimmed.length > 0 ? trimmed : null;
  }

  // 4. Validate taskId
  const cleanTaskId = input.taskId && input.taskId.trim().length > 0 ? input.taskId.trim() : null;

  return {
    ok: true,
    payload: {
      workDate: cleanDate,
      hours: rawHours,
      taskId: cleanTaskId,
      note: cleanNote,
    },
  };
}

export interface ExistingTimeLogState {
  taskId: string | null;
  workDate: string;
  hours: number;
  note: string | null;
}

export interface PatchTimeLogInput {
  taskId?: string | null;
  workDate?: string;
  hours?: number | string;
  note?: string | null;
}

export function validateAndBuildPatchPayload(
  existing: ExistingTimeLogState,
  updated: PatchTimeLogInput,
  referenceToday?: string
): BuildPayloadResult<PatchTimeLogPayload> {
  const payload: PatchTimeLogPayload = {};
  let changed = false;

  // 1. Task ID change (null to clear)
  if (updated.taskId !== undefined) {
    const targetTaskId = updated.taskId && updated.taskId.trim().length > 0 ? updated.taskId.trim() : null;
    if (targetTaskId !== existing.taskId) {
      payload.taskId = targetTaskId;
      changed = true;
    }
  }

  // 2. WorkDate change
  if (updated.workDate !== undefined) {
    const targetDate = extractDatePart(updated.workDate);
    const existingDate = extractDatePart(existing.workDate);

    if (targetDate !== existingDate) {
      if (!targetDate) {
        return { ok: false, error: 'invalid_date_format', field: 'workDate' };
      }
      const minDate = getTimeLogDateMin(referenceToday);
      const maxDate = getTimeLogDateMax(referenceToday);
      if (targetDate < minDate || targetDate > maxDate) {
        return { ok: false, error: 'invalid_date_range', field: 'workDate' };
      }
      payload.workDate = targetDate;
      changed = true;
    }
  }

  // 3. Hours change
  if (updated.hours !== undefined) {
    const rawHours = typeof updated.hours === 'string' ? parseFloat(updated.hours) : updated.hours;
    if (typeof rawHours !== 'number' || isNaN(rawHours) || rawHours <= 0) {
      return { ok: false, error: 'hours_must_be_positive', field: 'hours' };
    }
    if (rawHours > 24) {
      return { ok: false, error: 'hours_cannot_exceed_24', field: 'hours' };
    }
    if (!isQuarterHourIncrement(rawHours)) {
      return { ok: false, error: 'hours_quarter_increment', field: 'hours' };
    }

    if (Math.abs(rawHours - existing.hours) > 0.001) {
      payload.hours = rawHours;
      changed = true;
    }
  }

  // 4. Note change (null to clear)
  if (updated.note !== undefined) {
    let cleanNote: string | null = null;
    if (updated.note !== null) {
      const trimmed = updated.note.trim();
      if (trimmed.length > 5000) {
        return { ok: false, error: 'note_too_long', field: 'note' };
      }
      cleanNote = trimmed.length > 0 ? trimmed : null;
    }

    const existingCleanNote = existing.note ? existing.note.trim() : null;
    if (cleanNote !== existingCleanNote) {
      payload.note = cleanNote;
      changed = true;
    }
  }

  if (!changed) {
    return { ok: false, error: 'no_changes' };
  }

  return { ok: true, payload };
}
