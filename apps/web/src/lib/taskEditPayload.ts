import type { PatchTaskPayload } from '../types/index.js';
import { extractDatePart } from './dateUtils.js';

export interface InitialTaskValues {
  title: string;
  description: string | null;
  dueDate: string | null;
  estimatedHours: number | null;
  assigneeUserId: string | null;
  milestoneId: string | null;
}

export interface CurrentTaskFormValues {
  title: string;
  description: string;
  dueDate: string;
  estimatedHours: string;
  assigneeUserId: string;
  milestoneId: string;
}

export interface BuildPatchPayloadResult {
  payload: PatchTaskPayload | null;
  errors: Record<string, string>;
  hasChanges: boolean;
}

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

function isQuarterHourIncrement(val: number): boolean {
  return Math.abs(Math.round(val * 4) - val * 4) < 1e-6;
}

export function buildPatchTaskPayload(
  initial: InitialTaskValues,
  current: CurrentTaskFormValues
): BuildPatchPayloadResult {
  const errors: Record<string, string> = {};
  const payload: PatchTaskPayload = {};

  // 1. Title validation & change detection
  const trimmedTitle = current.title.trim();
  if (trimmedTitle === '') {
    errors.title = 'Task title cannot be empty';
  } else if (trimmedTitle.length > 200) {
    errors.title = 'Task title must be 200 characters or less';
  } else {
    const initialTrimmedTitle = initial.title.trim();
    if (trimmedTitle !== initialTrimmedTitle) {
      payload.title = trimmedTitle;
    }
  }

  // 2. Description validation & change detection
  if (current.description.length > 5000) {
    errors.description = 'Description must be 5000 characters or less';
  } else {
    const trimmedDesc = current.description.trim();
    const initialDesc = (initial.description ?? '').trim();
    if (trimmedDesc !== initialDesc) {
      payload.description = trimmedDesc === '' ? null : current.description;
    }
  }

  // 3. DueDate validation & change detection
  const trimmedDueDate = current.dueDate.trim();
  const initialDueDatePart = extractDatePart(initial.dueDate);
  if (trimmedDueDate === '') {
    if (initialDueDatePart !== null) {
      payload.dueDate = null;
    }
  } else {
    if (!DATE_REGEX.test(trimmedDueDate)) {
      errors.dueDate = 'dueDate must be in YYYY-MM-DD format';
    } else {
      const extracted = extractDatePart(trimmedDueDate);
      if (!extracted) {
        errors.dueDate = 'dueDate must be a valid calendar date';
      } else if (extracted !== initialDueDatePart) {
        payload.dueDate = extracted;
      }
    }
  }

  // 4. EstimatedHours validation & change detection
  const trimmedHours = current.estimatedHours.trim();
  if (trimmedHours === '') {
    if (initial.estimatedHours != null) {
      payload.estimatedHours = null;
    }
  } else {
    const parsedHours = Number(trimmedHours);
    if (Number.isNaN(parsedHours) || parsedHours <= 0) {
      errors.estimatedHours = 'estimatedHours must be greater than 0';
    } else if (parsedHours > 1000) {
      errors.estimatedHours = 'estimatedHours cannot exceed 1000';
    } else if (!isQuarterHourIncrement(parsedHours)) {
      errors.estimatedHours = 'estimatedHours must be entered in 15-minute (0.25) increments';
    } else {
      const initialHours = initial.estimatedHours != null ? initial.estimatedHours : null;
      if (initialHours === null || Math.abs(parsedHours - initialHours) > 1e-6) {
        payload.estimatedHours = parsedHours;
      }
    }
  }

  // 5. Assignee change detection
  const currentAssignee = current.assigneeUserId.trim();
  const initialAssignee = (initial.assigneeUserId ?? '').trim();
  if (currentAssignee !== initialAssignee) {
    payload.assigneeUserId = currentAssignee === '' ? null : currentAssignee;
  }

  // 6. Milestone change detection
  const currentMilestone = current.milestoneId.trim();
  const initialMilestone = (initial.milestoneId ?? '').trim();
  if (currentMilestone !== initialMilestone) {
    payload.milestoneId = currentMilestone === '' ? null : currentMilestone;
  }

  const hasErrors = Object.keys(errors).length > 0;
  const hasChanges = Object.keys(payload).length > 0;

  return {
    payload: hasErrors ? null : payload,
    errors,
    hasChanges,
  };
}
