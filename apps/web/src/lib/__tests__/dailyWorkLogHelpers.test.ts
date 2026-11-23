import { describe, it, expect, vi } from 'vitest';
import {
  isValidUuid,
  isLegacyText,
  isProjectEligibleForUser,
  filterEligibleProjects,
  hasUserTypedRows,
  buildWorkLogEntriesPayload,
  resolveWorkLogError,
  applyProjectChangeToRow,
  shouldHydrateForDate,
  type ProjectWithMembers,
  type WorkLogEntryRow,
} from '../dailyWorkLogHelpers.js';
import type { ProjectMember } from '../../types/index.js';

describe('dailyWorkLogHelpers', () => {
  const validUuid1 = 'a0000000-0000-4000-8000-000000000001';
  const validUuid2 = 'b0000000-0000-4000-8000-000000000002';
  const roleUuid = 'c0000000-0000-4000-8000-000000000003';

  const makeMember = (
    userId: string,
    projectRole: 'manager' | 'member' | 'viewer',
    isActiveUser: boolean = true
  ): ProjectMember => ({
    id: 'mem-1',
    projectId: validUuid1,
    userId,
    projectRole,
    addedByUserId: 'admin-1',
    createdAt: '2026-10-30T00:00:00.000Z',
    updatedAt: '2026-10-30T00:00:00.000Z',
    user: {
      id: userId,
      displayName: `User ${userId}`,
      username: `user_${userId}`,
      isActive: isActiveUser,
    },
  });

  describe('1. Project picker eligibility filter with REAL ProjectMember shape', () => {
    const currentUserId = 'user-emp-1';

    it('offers project where current user is an active manager', () => {
      const project: ProjectWithMembers = {
        id: validUuid1,
        name: 'Alpha Project',
        members: [makeMember(currentUserId, 'manager')],
      };
      expect(isProjectEligibleForUser(project, currentUserId)).toBe(true);
    });

    it('offers project where current user is an active member', () => {
      const project: ProjectWithMembers = {
        id: validUuid1,
        name: 'Beta Project',
        members: [makeMember(currentUserId, 'member')],
      };
      expect(isProjectEligibleForUser(project, currentUserId)).toBe(true);
    });

    it('NEGATIVE: viewer-only project is not offered to the user', () => {
      const project: ProjectWithMembers = {
        id: validUuid1,
        name: 'Viewer Project',
        members: [makeMember(currentUserId, 'viewer')],
      };
      expect(isProjectEligibleForUser(project, currentUserId)).toBe(false);
    });

    it('NEGATIVE: rejects project membership if user.isActive === false', () => {
      const project: ProjectWithMembers = {
        id: validUuid1,
        name: 'Deactivated Member Project',
        members: [makeMember(currentUserId, 'member', false)],
      };
      expect(isProjectEligibleForUser(project, currentUserId)).toBe(false);
    });

    it('NEGATIVE: project where current user is not a member is not offered', () => {
      const project: ProjectWithMembers = {
        id: validUuid1,
        name: 'Other Project',
        members: [makeMember('user-other', 'manager')],
      };
      expect(isProjectEligibleForUser(project, currentUserId)).toBe(false);
    });

    it('NEGATIVE: project without members array or undefined userId returns false', () => {
      const project: ProjectWithMembers = { id: validUuid1, name: 'No Members' };
      expect(isProjectEligibleForUser(project, currentUserId)).toBe(false);
      expect(isProjectEligibleForUser(project, undefined)).toBe(false);
    });

    it('filters a list of projects, excluding viewer-only and non-member projects', () => {
      const projects: ProjectWithMembers[] = [
        {
          id: validUuid1,
          name: 'Manager Project',
          members: [makeMember(currentUserId, 'manager')],
        },
        {
          id: validUuid2,
          name: 'Viewer Project',
          members: [makeMember(currentUserId, 'viewer')],
        },
        {
          id: '00000000-0000-4000-8000-000000000003',
          name: 'Member Project',
          members: [makeMember(currentUserId, 'member')],
        },
        {
          id: '00000000-0000-4000-8000-000000000004',
          name: 'Unrelated Project',
          members: [makeMember('user-other', 'manager')],
        },
      ];

      const eligible = filterEligibleProjects(projects, currentUserId);
      expect(eligible).toHaveLength(2);
      expect(eligible.map((p) => p.name)).toEqual(['Manager Project', 'Member Project']);
    });
  });

  describe('2. UUID validation & legacy text detection (isValidUuid / isLegacyText)', () => {
    it('recognizes valid UUIDs in upper/lowercase', () => {
      expect(isValidUuid(validUuid1)).toBe(true);
      expect(isValidUuid('A0000000-0000-4000-8000-000000000001')).toBe(true);
    });

    it('rejects invalid or free-text strings as non-UUIDs', () => {
      expect(isValidUuid('Legacy Free Text')).toBe(false);
      expect(isValidUuid('12345')).toBe(false);
      expect(isValidUuid('')).toBe(false);
      expect(isValidUuid(null)).toBe(false);
      expect(isValidUuid(undefined)).toBe(false);
    });

    it('identifies non-empty free-text strings as legacy text', () => {
      expect(isLegacyText('Legacy Project Name')).toBe(true);
      expect(isLegacyText('PROJ-101')).toBe(true);
      expect(isLegacyText(validUuid1)).toBe(false);
      expect(isLegacyText('')).toBe(false);
      expect(isLegacyText(null)).toBe(false);
    });
  });

  describe('3. Payload builder (buildWorkLogEntriesPayload)', () => {
    it('preserves valid UUID projectId and taskId', () => {
      const rows: WorkLogEntryRow[] = [
        {
          workRoleId: roleUuid,
          hours: '4.5',
          description: 'Working on feature',
          projectId: validUuid1,
          taskId: validUuid2,
        },
      ];

      const payload = buildWorkLogEntriesPayload(rows);
      expect(payload).toEqual([
        {
          workRoleId: roleUuid,
          hours: 4.5,
          description: 'Working on feature',
          projectId: validUuid1,
          taskId: validUuid2,
        },
      ]);
    });

    it('NEGATIVE: legacy free-text projectId is NEVER sent in write payloads (sent as null)', () => {
      const rows: WorkLogEntryRow[] = [
        {
          workRoleId: roleUuid,
          hours: 2,
          description: 'Old log with legacy free text',
          projectId: 'Website Overhaul 2025',
          taskId: 'Bug fixing',
        },
      ];

      const payload = buildWorkLogEntriesPayload(rows);
      expect(payload).toEqual([
        {
          workRoleId: roleUuid,
          hours: 2,
          description: 'Old log with legacy free text',
          projectId: null,
          taskId: null,
        },
      ]);
      expect(payload[0].projectId).toBeNull();
      expect(payload[0].taskId).toBeNull();
    });

    it('NEGATIVE: drops taskId to null if taskId is legacy free text', () => {
      const rows: WorkLogEntryRow[] = [
        {
          workRoleId: roleUuid,
          hours: 3,
          description: 'Valid project but legacy task text',
          projectId: validUuid1,
          taskId: 'Some legacy task string',
        },
      ];

      const payload = buildWorkLogEntriesPayload(rows);
      expect(payload[0].projectId).toBe(validUuid1);
      expect(payload[0].taskId).toBeNull();
    });

    it('NEGATIVE: drops valid UUID taskId to null if projectId is absent or null', () => {
      const rows: WorkLogEntryRow[] = [
        {
          workRoleId: roleUuid,
          hours: 1,
          description: 'No project selected',
          projectId: '',
          taskId: validUuid2,
        },
      ];

      const payload = buildWorkLogEntriesPayload(rows);
      expect(payload[0].projectId).toBeNull();
      expect(payload[0].taskId).toBeNull();
    });

    it('trims description or converts whitespace-only description to null', () => {
      const rows: WorkLogEntryRow[] = [
        {
          workRoleId: roleUuid,
          hours: 1.5,
          description: '   ',
          projectId: '',
          taskId: '',
        },
      ];

      const payload = buildWorkLogEntriesPayload(rows);
      expect(payload[0].description).toBeNull();
    });

    it('throws validation error when required workRoleId is missing or hours <= 0', () => {
      expect(() =>
        buildWorkLogEntriesPayload([
          { workRoleId: '', hours: 2, description: '', projectId: '', taskId: '' },
        ])
      ).toThrow('validation_error');

      expect(() =>
        buildWorkLogEntriesPayload([
          { workRoleId: roleUuid, hours: 0, description: '', projectId: '', taskId: '' },
        ])
      ).toThrow('hoursPositive');

      expect(() =>
        buildWorkLogEntriesPayload([
          { workRoleId: roleUuid, hours: -1, description: '', projectId: '', taskId: '' },
        ])
      ).toThrow('hoursPositive');

      expect(() => buildWorkLogEntriesPayload([])).toThrow('atLeastOneEntry');
    });
  });

  describe('4. Error translator order & amendments (resolveWorkLogError)', () => {
    const mockTranslations: Record<string, string> = {
      invalid_project: 'The selected project is invalid, does not exist, or you are not an active member.',
      invalid_task: 'The selected task is invalid or does not belong to the selected project.',
      edit_window_expired: 'The edit window for this submitted work log has closed.',
      hour_mismatch: 'Hour Mismatch: Logged hours do not match your standard shift length.',
      forbidden: 'You do not have permission to modify this work log.',
      networkError: 'Network error: unable to reach the server. Please check your connection and try again.',
      atLeastOneEntry: 'At least one entry row is required.',
      hoursPositive: 'Hours must be greater than 0 and in 0.25 increments.',
      validation_error: 'Validation failed: please check that all entries have valid roles.',
      generic: 'An error occurred while saving the work log.',
    };

    const translateCode = (code: string) => mockTranslations[code];

    it('NEGATIVE: err.message is NOT preferred over a known API error code', () => {
      const axiosError = {
        message: 'Request failed with status code 400',
        response: {
          status: 400,
          data: {
            error: 'invalid_project',
            message: 'Caller is not a member of project',
          },
        },
      };

      const resolved = resolveWorkLogError(axiosError, translateCode);
      expect(resolved).toBe(mockTranslations.invalid_project);
      expect(resolved).not.toBe('Request failed with status code 400');
    });

    it('NEGATIVE: translates invalid_task before any generic error or axios message', () => {
      const axiosError = {
        message: 'Request failed with status code 400',
        response: {
          status: 400,
          data: {
            error: 'invalid_task',
          },
        },
      };

      const resolved = resolveWorkLogError(axiosError, translateCode);
      expect(resolved).toBe(mockTranslations.invalid_task);
    });

    it('calls onWindowExpired callback and returns friendly error for edit_window_expired', () => {
      const onWindowExpired = vi.fn();
      const axiosError = {
        message: 'Request failed with status code 400',
        response: {
          status: 400,
          data: {
            error: 'edit_window_expired',
          },
        },
      };

      const resolved = resolveWorkLogError(axiosError, translateCode, { onWindowExpired });
      expect(onWindowExpired).toHaveBeenCalledTimes(1);
      expect(resolved).toBe(mockTranslations.edit_window_expired);
    });

    it('Amendment A: MISSING err.response returns translated networkError, not err.message', () => {
      const networkError = {
        message: 'Network Error',
        isAxiosError: true,
      };

      const resolved = resolveWorkLogError(networkError, translateCode);
      expect(resolved).toBe(mockTranslations.networkError);
      expect(resolved).not.toBe('Network Error');
    });

    it('Amendment A: ECONNABORTED timeout without response returns translated networkError', () => {
      const timeoutError = {
        code: 'ECONNABORTED',
        message: 'timeout of 10000ms exceeded',
      };

      const resolved = resolveWorkLogError(timeoutError, translateCode);
      expect(resolved).toBe(mockTranslations.networkError);
      expect(resolved).not.toBe('timeout of 10000ms exceeded');
    });

    it('Amendment A: response with empty data or non-string code must NOT be called a network error', () => {
      // 403 status mapping
      const error403 = {
        message: 'Request failed with status code 403',
        response: { status: 403, data: { error: true } }, // non-string error
      };
      expect(resolveWorkLogError(error403, translateCode)).toBe(mockTranslations.forbidden);

      // 422 status mapping
      const error422 = {
        message: 'Request failed with status code 422',
        response: { status: 422, data: {} }, // empty data
      };
      expect(resolveWorkLogError(error422, translateCode)).toBe(mockTranslations.hour_mismatch);

      // 500 status fallback to generic server error
      const error500 = {
        message: 'Request failed with status code 500',
        response: { status: 500, data: null },
      };
      expect(resolveWorkLogError(error500, translateCode)).toBe(mockTranslations.generic);
      expect(resolveWorkLogError(error500, translateCode)).not.toBe(mockTranslations.networkError);
    });

    it('Amendment A: always returns a string, using hardcoded English fallback when lookup returns undefined', () => {
      const emptyLookup = () => undefined;
      const error500 = {
        message: 'Request failed with status code 500',
        response: { status: 500, data: {} },
      };

      const resolved = resolveWorkLogError(error500, emptyLookup);
      expect(typeof resolved).toBe('string');
      expect(resolved).toBe('An error occurred while saving the work log.');
    });

    it('Item 3: translates locally thrown keys (atLeastOneEntry, hoursPositive, validation_error)', () => {
      const err1 = new Error('atLeastOneEntry');
      expect(resolveWorkLogError(err1, translateCode)).toBe(mockTranslations.atLeastOneEntry);

      const err2 = new Error('hoursPositive');
      expect(resolveWorkLogError(err2, translateCode)).toBe(mockTranslations.hoursPositive);

      const err3 = new Error('validation_error');
      expect(resolveWorkLogError(err3, translateCode)).toBe(mockTranslations.validation_error);
    });

    it('Item 3: NEVER shows raw key even if translation lookup fails for a thrown key', () => {
      const brokenLookup = () => undefined;
      const err = new Error('atLeastOneEntry');
      const resolved = resolveWorkLogError(err, brokenLookup);
      expect(resolved).not.toBe('atLeastOneEntry');
      expect(typeof resolved).toBe('string');
    });

    it('falls back to API response message for unmapped API error codes', () => {
      const unmappedApiError = {
        message: 'Request failed with status code 400',
        response: {
          status: 400,
          data: {
            error: 'unknown_custom_code',
            message: 'A custom backend policy failed',
          },
        },
      };
      expect(resolveWorkLogError(unmappedApiError, translateCode)).toBe(
        'A custom backend policy failed'
      );
    });
  });

  describe('5. User typed rows detection for hydration safety (hasUserTypedRows)', () => {
    it('returns false for pristine initial empty row', () => {
      const pristine: WorkLogEntryRow[] = [
        { workRoleId: roleUuid, hours: '', description: '', projectId: '', taskId: '' },
      ];
      expect(hasUserTypedRows(pristine)).toBe(false);
    });

    it('returns true when user entered hours', () => {
      const withHours: WorkLogEntryRow[] = [
        { workRoleId: roleUuid, hours: '1.5', description: '', projectId: '', taskId: '' },
      ];
      expect(hasUserTypedRows(withHours)).toBe(true);
    });

    it('returns true when user entered description', () => {
      const withDesc: WorkLogEntryRow[] = [
        { workRoleId: roleUuid, hours: '', description: 'Drafting notes', projectId: '', taskId: '' },
      ];
      expect(hasUserTypedRows(withDesc)).toBe(true);
    });

    it('returns true when user selected project or task', () => {
      const withProject: WorkLogEntryRow[] = [
        { workRoleId: roleUuid, hours: '', description: '', projectId: validUuid1, taskId: '' },
      ];
      expect(hasUserTypedRows(withProject)).toBe(true);
    });
  });

  describe('6. Apply project change to row (applyProjectChangeToRow)', () => {
    it('sets new projectId and resets taskId to empty string when selecting a project', () => {
      const initialRow: WorkLogEntryRow = {
        workRoleId: roleUuid,
        hours: 4,
        description: 'Frontend work',
        projectId: '',
        taskId: '',
      };

      const updated = applyProjectChangeToRow(initialRow, validUuid1);
      expect(updated.projectId).toBe(validUuid1);
      expect(updated.taskId).toBe('');
      expect(updated.workRoleId).toBe(roleUuid);
      expect(updated.hours).toBe(4);
      expect(updated.description).toBe('Frontend work');
    });

    it('ALWAYS resets taskId to empty string when switching from one project to another with existing taskId', () => {
      const taskUuid = 'd0000000-0000-4000-8000-000000000004';
      const initialRow: WorkLogEntryRow = {
        id: 'entry-123',
        workRoleId: roleUuid,
        hours: '2.5',
        description: 'Investigating issue',
        projectId: validUuid1,
        taskId: taskUuid,
      };

      const updated = applyProjectChangeToRow(initialRow, validUuid2);
      expect(updated.projectId).toBe(validUuid2);
      expect(updated.taskId).toBe('');
      // Preserves existing id and other row attributes
      expect(updated.id).toBe('entry-123');
      expect(updated.workRoleId).toBe(roleUuid);
      expect(updated.hours).toBe('2.5');
      expect(updated.description).toBe('Investigating issue');
    });

    it('resets taskId to empty string when user selects "No project" (empty string)', () => {
      const taskUuid = 'd0000000-0000-4000-8000-000000000004';
      const initialRow: WorkLogEntryRow = {
        workRoleId: roleUuid,
        hours: 3,
        description: 'General sync',
        projectId: validUuid1,
        taskId: taskUuid,
      };

      const updated = applyProjectChangeToRow(initialRow, '');
      expect(updated.projectId).toBe('');
      expect(updated.taskId).toBe('');
    });

    it('clears legacy free-text taskId when project changes', () => {
      const initialRow: WorkLogEntryRow = {
        workRoleId: roleUuid,
        hours: 5,
        description: 'Legacy task note',
        projectId: validUuid1,
        taskId: 'Old legacy task string from import',
      };

      const updated = applyProjectChangeToRow(initialRow, validUuid2);
      expect(updated.projectId).toBe(validUuid2);
      expect(updated.taskId).toBe('');
    });

    it('is a pure function and does not mutate the original row object', () => {
      const initialRow: WorkLogEntryRow = Object.freeze({
        workRoleId: roleUuid,
        hours: 6,
        description: 'Testing immutability',
        projectId: validUuid1,
        taskId: 'task-abc',
      });

      // Calling with Object.freeze ensures mutation would throw in strict mode
      const updated = applyProjectChangeToRow(initialRow, validUuid2);
      expect(updated).not.toBe(initialRow);
      expect(initialRow.projectId).toBe(validUuid1);
      expect(initialRow.taskId).toBe('task-abc');
      expect(updated.projectId).toBe(validUuid2);
      expect(updated.taskId).toBe('');
    });
  });

  describe('8. Date-change hydration decision (shouldHydrateForDate)', () => {
    it('allows hydration when switching to a new date even if user typed rows on previous date', () => {
      // Typed rows from another date do NOT block hydration
      const result = shouldHydrateForDate('2026-11-21', '2026-11-20', true);
      expect(result).toBe(true);
    });

    it('allows hydration when switching backwards to an earlier date with typed rows', () => {
      const result = shouldHydrateForDate('2026-11-19', '2026-11-20', true);
      expect(result).toBe(true);
    });

    it('BLOCKS overwrite when user has typed rows on the SAME date', () => {
      // Typed rows on the same date DO block overwrite
      const result = shouldHydrateForDate('2026-11-20', '2026-11-20', true);
      expect(result).toBe(false);
    });

    it('allows hydration on the same date when user has NOT typed rows', () => {
      // Same date with no user edits: server data or defaults can hydrate
      const result = shouldHydrateForDate('2026-11-20', '2026-11-20', false);
      expect(result).toBe(true);
    });

    it('NEGATIVE: clearing the date does not hydrate', () => {
      expect(shouldHydrateForDate('', '2026-11-20', false)).toBe(false);
      expect(shouldHydrateForDate('', '2026-11-20', true)).toBe(false);
      expect(shouldHydrateForDate('', null, false)).toBe(false);
    });

    it('NEGATIVE: whitespace, null, or undefined date does not hydrate', () => {
      expect(shouldHydrateForDate('   ', '2026-11-20', false)).toBe(false);
      expect(shouldHydrateForDate(null, '2026-11-20', false)).toBe(false);
      expect(shouldHydrateForDate(undefined, '2026-11-20', false)).toBe(false);
    });

    it('allows initial hydration on mount when hydratedForDate is null or undefined', () => {
      expect(shouldHydrateForDate('2026-11-20', null, false)).toBe(true);
      expect(shouldHydrateForDate('2026-11-20', undefined, false)).toBe(true);
    });
  });
});
