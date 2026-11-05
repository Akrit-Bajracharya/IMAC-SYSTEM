import { describe, it, expect } from 'vitest';
import {
  isMilestoneOverdue,
  computeMilestoneTaskCounts,
  getTasksForMilestone,
  canManageMilestones,
  mapMilestoneError,
} from '../milestoneHelpers.js';
import type { ProjectTask } from '../../types/index.js';

describe('milestoneHelpers', () => {
  describe('isMilestoneOverdue', () => {
    const today = '2026-11-05';

    it('returns true when due date is in the past and completedAt is null', () => {
      expect(isMilestoneOverdue('2026-11-01', null, today)).toBe(true);
      expect(isMilestoneOverdue('2026-11-04T12:00:00Z', null, today)).toBe(true);
    });

    it('returns false when completedAt is set, even if due date is in the past', () => {
      expect(isMilestoneOverdue('2026-11-01', '2026-11-02T10:00:00Z', today)).toBe(false);
    });

    it('returns false when due date is today or in the future', () => {
      expect(isMilestoneOverdue('2026-11-05', null, today)).toBe(false);
      expect(isMilestoneOverdue('2026-11-06', null, today)).toBe(false);
      expect(isMilestoneOverdue('2026-12-01', null, today)).toBe(false);
    });

    it('returns false when due date is null, undefined, or empty', () => {
      expect(isMilestoneOverdue(null, null, today)).toBe(false);
      expect(isMilestoneOverdue(undefined, null, today)).toBe(false);
      expect(isMilestoneOverdue('', null, today)).toBe(false);
    });
  });

  describe('computeMilestoneTaskCounts', () => {
    const makeTask = (id: string, milestoneId: string | null, status: 'todo' | 'in_progress' | 'blocked' | 'done'): ProjectTask => ({
      id,
      projectId: 'proj-1',
      title: `Task ${id}`,
      description: null,
      status,
      dueDate: null,
      estimatedHours: null,
      assigneeUserId: null,
      milestoneId,
      parentTaskId: null,
      createdByUserId: 'user-1',
      createdAt: '2026-11-01T00:00:00Z',
      updatedAt: '2026-11-01T00:00:00Z',
    });

    it('correctly tallies total and done tasks per milestone', () => {
      const tasks: ProjectTask[] = [
        makeTask('t1', 'm1', 'done'),
        makeTask('t2', 'm1', 'in_progress'),
        makeTask('t3', 'm1', 'done'),
        makeTask('t4', 'm2', 'todo'),
        makeTask('t5', 'm2', 'blocked'),
        makeTask('t6', null, 'done'), // unassigned
      ];

      const counts = computeMilestoneTaskCounts(tasks);
      expect(counts['m1']).toEqual({ total: 3, done: 2 });
      expect(counts['m2']).toEqual({ total: 2, done: 0 });
      expect(counts['m3']).toBeUndefined();
    });

    it('returns empty object when task list is empty', () => {
      expect(computeMilestoneTaskCounts([])).toEqual({});
    });
  });

  describe('getTasksForMilestone', () => {
    const makeTask = (id: string, milestoneId: string | null): ProjectTask => ({
      id,
      projectId: 'proj-1',
      title: `Task ${id}`,
      description: null,
      status: 'todo',
      dueDate: null,
      estimatedHours: null,
      assigneeUserId: null,
      milestoneId,
      parentTaskId: null,
      createdByUserId: 'user-1',
      createdAt: '2026-11-01T00:00:00Z',
      updatedAt: '2026-11-01T00:00:00Z',
    });

    it('filters tasks strictly for the requested milestone', () => {
      const tasks: ProjectTask[] = [
        makeTask('t1', 'm1'),
        makeTask('t2', 'm2'),
        makeTask('t3', 'm1'),
      ];

      const m1Tasks = getTasksForMilestone(tasks, 'm1');
      expect(m1Tasks.map((t) => t.id)).toEqual(['t1', 't3']);
    });
  });

  describe('canManageMilestones', () => {
    it('allows system_admin and project managers', () => {
      expect(canManageMilestones(undefined, true)).toBe(true);
      expect(canManageMilestones('viewer', true)).toBe(true);
      expect(canManageMilestones('manager', false)).toBe(true);
    });

    it('denies members, viewers, and undefined roles for non-admins', () => {
      expect(canManageMilestones('member', false)).toBe(false);
      expect(canManageMilestones('viewer', false)).toBe(false);
      expect(canManageMilestones(undefined, false)).toBe(false);
    });
  });

  describe('mapMilestoneError', () => {
    it('maps already_completed error', () => {
      const res = mapMilestoneError({ status: 409, error: 'already_completed' });
      expect(res.key).toBe('projects.milestones.errors.alreadyCompleted');
      expect(res.defaultMessage).toBe('Milestone is already completed.');
      expect(res.isNotFoundOrForbidden).toBe(false);
    });

    it('maps already_open error', () => {
      const res = mapMilestoneError({ status: 409, error: 'already_open' });
      expect(res.key).toBe('projects.milestones.errors.alreadyOpen');
      expect(res.defaultMessage).toBe('Milestone is already open.');
      expect(res.isNotFoundOrForbidden).toBe(false);
    });

    it('maps validation_error', () => {
      const res = mapMilestoneError({ status: 400, error: 'validation_error' });
      expect(res.key).toBe('projects.milestones.errors.validation');
      expect(res.isNotFoundOrForbidden).toBe(false);
    });

    it('flags 403 as notFoundOrForbidden', () => {
      const res = mapMilestoneError({ status: 403, error: 'forbidden' });
      expect(res.key).toBe('projects.milestones.errors.forbidden');
      expect(res.isNotFoundOrForbidden).toBe(true);
    });

    it('flags 404 as notFoundOrForbidden', () => {
      const res = mapMilestoneError({ status: 404, error: 'not_found' });
      expect(res.key).toBe('projects.milestones.errors.notFound');
      expect(res.isNotFoundOrForbidden).toBe(true);
    });

    it('falls back to generic error', () => {
      const res = mapMilestoneError({ status: 500, error: 'server_error', message: 'DB down' });
      expect(res.key).toBe('projects.milestones.errors.generic');
      expect(res.defaultMessage).toBe('DB down');
      expect(res.isNotFoundOrForbidden).toBe(false);
    });
  });
});
