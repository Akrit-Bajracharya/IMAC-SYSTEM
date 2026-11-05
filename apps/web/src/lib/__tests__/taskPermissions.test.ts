import { describe, it, expect } from 'vitest';
import {
  canEditTask,
  canDeleteTask,
  canCommentOnTask,
  type TaskAction,
} from '../taskPermissions.js';
import type { ProjectRole } from '../../types/index.js';

describe('taskPermissions (mirrors apps/api/src/services/projectAccess.ts)', () => {
  const currentUserId = 'user-current-111';
  const otherUserId = 'user-other-222';

  const taskCreatedByMe = {
    createdByUserId: currentUserId,
    assigneeUserId: otherUserId,
  };

  const taskAssignedToMe = {
    createdByUserId: otherUserId,
    assigneeUserId: currentUserId,
  };

  const taskUnrelated = {
    createdByUserId: otherUserId,
    assigneeUserId: otherUserId,
  };

  const matrixCases: Array<{
    scenario: string;
    projectRole: ProjectRole | undefined;
    isSystemAdmin: boolean;
    userId: string | undefined;
    task: { createdByUserId: string; assigneeUserId?: string | null } | null;
    expected: {
      create: boolean;
      edit: boolean;
      changeStatus: boolean;
      manageDependencies: boolean;
      delete: boolean;
      comment: boolean;
    };
  }> = [
    {
      scenario: 'system_admin with manager role',
      projectRole: 'manager',
      isSystemAdmin: true,
      userId: currentUserId,
      task: taskUnrelated,
      expected: {
        create: true,
        edit: true,
        changeStatus: true,
        manageDependencies: true,
        delete: true,
        comment: true,
      },
    },
    {
      scenario: 'system_admin with undefined projectRole',
      projectRole: undefined,
      isSystemAdmin: true,
      userId: currentUserId,
      task: taskUnrelated,
      expected: {
        create: true,
        edit: true,
        changeStatus: true,
        manageDependencies: true,
        delete: true,
        comment: true,
      },
    },
    {
      scenario: 'project manager (non-admin)',
      projectRole: 'manager',
      isSystemAdmin: false,
      userId: currentUserId,
      task: taskUnrelated,
      expected: {
        create: true,
        edit: true,
        changeStatus: true,
        manageDependencies: true,
        delete: true,
        comment: true,
      },
    },
    {
      scenario: 'project member: task creator (not assignee)',
      projectRole: 'member',
      isSystemAdmin: false,
      userId: currentUserId,
      task: taskCreatedByMe,
      expected: {
        create: true,
        edit: true,
        changeStatus: false, // member creator cannot change status unless assigned
        manageDependencies: true,
        delete: false, // only manager / system_admin can delete
        comment: true,
      },
    },
    {
      scenario: 'project member: task assignee (not creator)',
      projectRole: 'member',
      isSystemAdmin: false,
      userId: currentUserId,
      task: taskAssignedToMe,
      expected: {
        create: true,
        edit: true,
        changeStatus: true, // assignee can change status
        manageDependencies: true,
        delete: false,
        comment: true,
      },
    },
    {
      scenario: 'project member: unrelated task (neither creator nor assignee)',
      projectRole: 'member',
      isSystemAdmin: false,
      userId: currentUserId,
      task: taskUnrelated,
      expected: {
        create: true,
        edit: false,
        changeStatus: false,
        manageDependencies: false,
        delete: false,
        comment: true,
      },
    },
    {
      scenario: 'project viewer',
      projectRole: 'viewer',
      isSystemAdmin: false,
      userId: currentUserId,
      task: taskCreatedByMe,
      expected: {
        create: false,
        edit: false,
        changeStatus: false,
        manageDependencies: false,
        delete: false,
        comment: false,
      },
    },
    {
      scenario: 'undefined role (non-member)',
      projectRole: undefined,
      isSystemAdmin: false,
      userId: currentUserId,
      task: taskCreatedByMe,
      expected: {
        create: false,
        edit: false,
        changeStatus: false,
        manageDependencies: false,
        delete: false,
        comment: false,
      },
    },
    {
      scenario: 'missing userId (undefined or empty)',
      projectRole: 'member',
      isSystemAdmin: false,
      userId: '',
      task: taskAssignedToMe,
      expected: {
        create: false,
        edit: false,
        changeStatus: false,
        manageDependencies: false,
        delete: false,
        comment: true,
      },
    },
  ];

  matrixCases.forEach(
    ({ scenario, projectRole, isSystemAdmin, userId, task, expected }) => {
      describe(`Scenario: ${scenario}`, () => {
        it('evaluates create permission', () => {
          expect(
            canEditTask(projectRole, isSystemAdmin, 'create', task, userId)
          ).toBe(expected.create);
        });

        it('evaluates edit permission', () => {
          expect(
            canEditTask(projectRole, isSystemAdmin, 'edit', task, userId)
          ).toBe(expected.edit);
        });

        it('evaluates changeStatus permission', () => {
          expect(
            canEditTask(projectRole, isSystemAdmin, 'changeStatus', task, userId)
          ).toBe(expected.changeStatus);
        });

        it('evaluates manageDependencies permission', () => {
          expect(
            canEditTask(
              projectRole,
              isSystemAdmin,
              'manageDependencies',
              task,
              userId
            )
          ).toBe(expected.manageDependencies);
        });

        it('evaluates delete permission', () => {
          expect(canDeleteTask(projectRole, isSystemAdmin)).toBe(expected.delete);
        });

        it('evaluates comment permission', () => {
          expect(canCommentOnTask(projectRole, isSystemAdmin)).toBe(
            expected.comment
          );
        });
      });
    }
  );
});
