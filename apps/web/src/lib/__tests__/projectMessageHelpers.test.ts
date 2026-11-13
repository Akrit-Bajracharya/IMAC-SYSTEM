import { describe, it, expect } from 'vitest';
import {
  canPostMessage,
  canPinMessage,
  canConvertToTask,
  deduplicateMessagesById,
  getConvertedMessageKey,
  isMessageConverted,
  mapProjectMessageError,
  ALLOWED_MESSAGE_SYSTEM_ROLES,
} from '../projectMessageHelpers.js';
import { canEditTask } from '../taskPermissions.js';
import type { ProjectRole, ProjectMessageListResponse } from '../../types/index.js';

describe('projectMessageHelpers', () => {
  describe('canPostMessage and canPinMessage table-driven tests', () => {
    interface TestCase {
      name: string;
      callerProjectRole?: ProjectRole | string | null;
      systemRole?: string | null;
      canPost: boolean;
      canPin: boolean;
    }

    const testCases: TestCase[] = [
      {
        name: 'system_admin without a project member row',
        callerProjectRole: undefined,
        systemRole: 'system_admin',
        canPost: true,
        canPin: true,
      },
      {
        name: 'system_admin with manager project row',
        callerProjectRole: 'manager',
        systemRole: 'system_admin',
        canPost: true,
        canPin: true,
      },
      {
        name: 'system_admin with member project row',
        callerProjectRole: 'member',
        systemRole: 'system_admin',
        canPost: true,
        canPin: true,
      },
      {
        name: 'project manager (systemRole: employee)',
        callerProjectRole: 'manager',
        systemRole: 'employee',
        canPost: true,
        canPin: true,
      },
      {
        name: 'project manager (systemRole: project_manager)',
        callerProjectRole: 'manager',
        systemRole: 'project_manager',
        canPost: true,
        canPin: true,
      },
      {
        name: 'project manager (systemRole: hr_admin)',
        callerProjectRole: 'manager',
        systemRole: 'hr_admin',
        canPost: true,
        canPin: true,
      },
      {
        name: 'project member (systemRole: employee)',
        callerProjectRole: 'member',
        systemRole: 'employee',
        canPost: true,
        canPin: false,
      },
      {
        name: 'project member (systemRole: project_manager)',
        callerProjectRole: 'member',
        systemRole: 'project_manager',
        canPost: true,
        canPin: false,
      },
      {
        name: 'project viewer (systemRole: employee)',
        callerProjectRole: 'viewer',
        systemRole: 'employee',
        canPost: false,
        canPin: false,
      },
      {
        name: 'system-role viewer who is a project manager',
        callerProjectRole: 'manager',
        systemRole: 'viewer',
        canPost: false,
        canPin: false,
      },
      {
        name: 'system-role viewer who is a project member',
        callerProjectRole: 'member',
        systemRole: 'viewer',
        canPost: false,
        canPin: false,
      },
      {
        name: 'system-role viewer who is a project viewer',
        callerProjectRole: 'viewer',
        systemRole: 'viewer',
        canPost: false,
        canPin: false,
      },
      {
        name: 'member with undefined systemRole (fail-closed)',
        callerProjectRole: 'member',
        systemRole: undefined,
        canPost: false,
        canPin: false,
      },
      {
        name: 'missing both projectRole and systemRole',
        callerProjectRole: undefined,
        systemRole: undefined,
        canPost: false,
        canPin: false,
      },
      {
        name: 'null roles',
        callerProjectRole: null,
        systemRole: null,
        canPost: false,
        canPin: false,
      },
      {
        name: 'unknown systemRole with manager projectRole',
        callerProjectRole: 'manager',
        systemRole: 'guest_user',
        canPost: false,
        canPin: false,
      },
      {
        name: 'unknown projectRole with employee systemRole',
        callerProjectRole: 'observer',
        systemRole: 'employee',
        canPost: false,
        canPin: false,
      },
      {
        name: 'unknown systemRole and unknown projectRole',
        callerProjectRole: 'unknown_project_role',
        systemRole: 'unknown_system_role',
        canPost: false,
        canPin: false,
      },
    ];

    testCases.forEach(({ name, callerProjectRole, systemRole, canPost, canPin }) => {
      it(`evaluates ${name}`, () => {
        expect(canPostMessage(callerProjectRole, systemRole)).toBe(canPost);
        expect(canPinMessage(callerProjectRole, systemRole)).toBe(canPin);
      });
    });

    it('rejects every systemRole outside ALLOWED_MESSAGE_SYSTEM_ROLES', () => {
      const disallowed = ['viewer', 'guest', 'anonymous', '', 'admin', 'root'];
      disallowed.forEach((role) => {
        expect(canPostMessage('manager', role)).toBe(false);
        expect(canPinMessage('manager', role)).toBe(false);
      });
    });
  });

  describe('canConvertToTask', () => {
    const validUserId = 'user-123';

    it('allows system_admin to convert even without a project member row', () => {
      expect(canConvertToTask(undefined, 'system_admin', validUserId)).toBe(true);
      expect(canConvertToTask('viewer', 'system_admin', validUserId)).toBe(true);
    });

    it('allows project managers to convert', () => {
      expect(canConvertToTask('manager', 'employee', validUserId)).toBe(true);
      expect(canConvertToTask('manager', 'project_manager', validUserId)).toBe(true);
    });

    it('allows project members to convert when userId is provided', () => {
      expect(canConvertToTask('member', 'employee', validUserId)).toBe(true);
    });

    it('denies project members without a userId (fail-closed)', () => {
      expect(canConvertToTask('member', 'employee', undefined)).toBe(false);
      expect(canConvertToTask('member', 'employee', null)).toBe(false);
      expect(canConvertToTask('member', 'employee', '')).toBe(false);
      expect(canConvertToTask('member', 'employee', '   ')).toBe(false);
    });

    it('denies project viewers', () => {
      expect(canConvertToTask('viewer', 'employee', validUserId)).toBe(false);
    });

    it('denies system-role viewer regardless of project role', () => {
      expect(canConvertToTask('manager', 'viewer', validUserId)).toBe(false);
      expect(canConvertToTask('member', 'viewer', validUserId)).toBe(false);
      expect(canConvertToTask('viewer', 'viewer', validUserId)).toBe(false);
    });

    it('denies missing or unknown system roles', () => {
      expect(canConvertToTask('manager', undefined, validUserId)).toBe(false);
      expect(canConvertToTask('manager', 'guest', validUserId)).toBe(false);
    });

    it('strictly agrees with canEditTask "create" for all allowed system roles', () => {
      const roles: (ProjectRole | undefined)[] = ['manager', 'member', 'viewer', undefined];
      ALLOWED_MESSAGE_SYSTEM_ROLES.forEach((sysRole) => {
        const isSysAdmin = sysRole === 'system_admin';
        roles.forEach((projRole) => {
          const helperResult = canConvertToTask(projRole, sysRole, validUserId);
          const taskResult = canEditTask(projRole, isSysAdmin, 'create', null, validUserId);
          expect(helperResult).toBe(taskResult);
        });
      });
    });
  });

  describe('deduplicateMessagesById', () => {
    it('flattens pages and deduplicates by message id preserving order', () => {
      const msg1 = { id: 'm1', projectId: 'p1', authorUserId: 'u1', body: 'First', isPinned: true, createdAt: '2026-11-05T08:00:00Z' };
      const msg2 = { id: 'm2', projectId: 'p1', authorUserId: 'u2', body: 'Second', isPinned: false, createdAt: '2026-11-05T08:05:00Z' };
      const msg3 = { id: 'm3', projectId: 'p1', authorUserId: 'u1', body: 'Third', isPinned: false, createdAt: '2026-11-05T08:10:00Z' };

      const pages: ProjectMessageListResponse[] = [
        { items: [msg1, msg2], nextCursor: 'm2', hasMore: true },
        { items: [msg2, msg3], nextCursor: null, hasMore: false }, // msg2 is duplicated across page boundary
      ];

      const result = deduplicateMessagesById(pages);
      expect(result).toHaveLength(3);
      expect(result.map((m) => m.id)).toEqual(['m1', 'm2', 'm3']);
    });

    it('returns empty array when pages are empty or null', () => {
      expect(deduplicateMessagesById([])).toEqual([]);
      expect(deduplicateMessagesById([null as any, { items: [] } as any])).toEqual([]);
    });
  });

  describe('session converted message tracking', () => {
    it('builds compound key from projectId and messageId', () => {
      expect(getConvertedMessageKey('proj-1', 'msg-1')).toBe('proj-1:msg-1');
    });

    it('checks whether message is converted in tracking dictionary', () => {
      const tracking = {
        'proj-1:msg-1': { taskId: 'task-100', taskTitle: 'Task Title' },
        'proj-1:msg-2': { taskId: undefined }, // converted without known task id
      };

      expect(isMessageConverted(tracking, 'proj-1', 'msg-1')).toBe(true);
      expect(isMessageConverted(tracking, 'proj-1', 'msg-2')).toBe(true);
      expect(isMessageConverted(tracking, 'proj-1', 'msg-3')).toBe(false);
      expect(isMessageConverted(tracking, 'proj-2', 'msg-1')).toBe(false);
    });
  });

  describe('mapProjectMessageError', () => {
    it('maps 409 already_converted', () => {
      const err = { response: { status: 409, data: { error: 'already_converted' } } };
      expect(mapProjectMessageError(err).code).toBe('already_converted');
    });

    it('maps 400 invalid_cursor', () => {
      const err = { response: { status: 400, data: { error: 'invalid_cursor' } } };
      expect(mapProjectMessageError(err).code).toBe('invalid_cursor');
    });

    it('maps 400 validation_error', () => {
      const err = { response: { status: 400, data: { error: 'validation_error' } } };
      expect(mapProjectMessageError(err).code).toBe('validation_error');
    });

    it('maps 403 forbidden', () => {
      const err = { response: { status: 403, data: { error: 'forbidden' } } };
      expect(mapProjectMessageError(err).code).toBe('forbidden');
    });

    it('maps 404 not_found', () => {
      const err = { response: { status: 404, data: { error: 'not_found' } } };
      expect(mapProjectMessageError(err).code).toBe('not_found');
    });

    it('returns unknown_error fallback for arbitrary errors', () => {
      const err = new Error('Network failure');
      expect(mapProjectMessageError(err).code).toBe('unknown_error');
    });
  });
});
