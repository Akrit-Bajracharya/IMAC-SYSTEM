import { describe, it, expect } from 'vitest';
import {
  filterCandidateDependencies,
  mapDependencyError,
} from '../taskDependencyHelpers.js';
import type { ProjectTask } from '../../types/index.js';

describe('taskDependencyHelpers', () => {
  const makeTask = (id: string, title: string): ProjectTask => ({
    id,
    projectId: 'proj-1',
    title,
    description: null,
    status: 'todo',
    dueDate: null,
    estimatedHours: 2,
    assigneeUserId: 'user-1',
    milestoneId: null,
    parentTaskId: null,
    createdByUserId: 'user-1',
    createdAt: '2026-11-01T00:00:00Z',
    updatedAt: '2026-11-01T00:00:00Z',
  });

  describe('filterCandidateDependencies', () => {
    const taskCurrent = makeTask('task-current', 'Current Task');
    const taskPrereq = makeTask('task-prereq', 'Prerequisite Task');
    const taskDependent = makeTask('task-dependent', 'Dependent Task (Blocks)');
    const taskAvailable1 = makeTask('task-avail-1', 'Available Task 1');
    const taskAvailable2 = makeTask('task-avail-2', 'Available Task 2');

    const allTasks: ProjectTask[] = [
      taskCurrent,
      taskPrereq,
      taskDependent,
      taskAvailable1,
      taskAvailable2,
    ];

    it('excludes current task, prerequisites, and dependent tasks (Amendment 1)', () => {
      const candidates = filterCandidateDependencies(
        allTasks,
        'task-current',
        ['task-prereq'],
        ['task-dependent']
      );

      expect(candidates.map((t) => t.id)).toEqual(['task-avail-1', 'task-avail-2']);
    });

    it('excludes dependent tasks even if no prerequisites exist', () => {
      const candidates = filterCandidateDependencies(
        allTasks,
        'task-current',
        [],
        ['task-dependent']
      );

      expect(candidates.map((t) => t.id)).toEqual([
        'task-prereq',
        'task-avail-1',
        'task-avail-2',
      ]);
    });

    it('works when existingDependentIds is omitted (defaults to empty)', () => {
      const candidates = filterCandidateDependencies(
        allTasks,
        'task-current',
        ['task-prereq']
      );

      expect(candidates.map((t) => t.id)).toEqual([
        'task-dependent',
        'task-avail-1',
        'task-avail-2',
      ]);
    });

    it('returns empty array when all project tasks are filtered out', () => {
      const candidates = filterCandidateDependencies(
        [taskCurrent, taskPrereq],
        'task-current',
        ['task-prereq'],
        []
      );

      expect(candidates).toEqual([]);
    });
  });

  describe('mapDependencyError', () => {
    it('maps self_dependency error code', () => {
      const res = mapDependencyError({ status: 400, error: 'self_dependency' });
      expect(res.key).toBe('projects.taskDetail.dependencies.errors.selfDependency');
      expect(res.defaultMessage).toBe('A task cannot depend on itself.');
      expect(res.isNotFoundOrForbidden).toBe(false);
    });

    it('maps dependency_cycle with circular loop explanation', () => {
      const res = mapDependencyError({ status: 400, error: 'dependency_cycle' });
      expect(res.key).toBe('projects.taskDetail.dependencies.errors.cycle');
      expect(res.defaultMessage).toContain('circular loop where tasks wait on each other');
      expect(res.isNotFoundOrForbidden).toBe(false);
    });

    it('maps duplicate_dependency error code', () => {
      const res = mapDependencyError({ status: 409, error: 'duplicate_dependency' });
      expect(res.key).toBe('projects.taskDetail.dependencies.errors.duplicate');
      expect(res.defaultMessage).toBe('This dependency already exists.');
      expect(res.isNotFoundOrForbidden).toBe(false);
    });

    it('maps validation_error', () => {
      const res = mapDependencyError({ status: 400, error: 'validation_error' });
      expect(res.key).toBe('projects.taskDetail.dependencies.errors.validation');
      expect(res.isNotFoundOrForbidden).toBe(false);
    });

    it('flags 403 as notFoundOrForbidden', () => {
      const res = mapDependencyError({ status: 403, error: 'forbidden' });
      expect(res.key).toBe('projects.taskDetail.dependencies.errors.forbidden');
      expect(res.isNotFoundOrForbidden).toBe(true);
    });

    it('flags 404 as notFoundOrForbidden', () => {
      const res = mapDependencyError({ status: 404, error: 'not_found' });
      expect(res.key).toBe('projects.taskDetail.dependencies.errors.notFound');
      expect(res.isNotFoundOrForbidden).toBe(true);
    });

    it('falls back to generic error with custom message', () => {
      const res = mapDependencyError({
        status: 500,
        error: 'server_error',
        message: 'DB connection dropped',
      });
      expect(res.key).toBe('projects.taskDetail.dependencies.errors.generic');
      expect(res.defaultMessage).toBe('DB connection dropped');
      expect(res.isNotFoundOrForbidden).toBe(false);
    });
  });
});
