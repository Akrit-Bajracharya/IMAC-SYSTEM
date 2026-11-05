import { describe, it, expect } from 'vitest';
import { getTaskDetailPath, getProjectTasksTabPath } from '../taskLinks.js';

describe('taskLinks', () => {
  const pId = 'proj-123';
  const tId = 'task-456';

  describe('getTaskDetailPath', () => {
    it('returns admin layout path for system_admin', () => {
      expect(getTaskDetailPath(pId, tId, 'system_admin')).toBe(
        '/admin/projects/proj-123/tasks/task-456'
      );
    });

    it('returns employee layout path for employee, project_manager, hr_admin, viewer', () => {
      expect(getTaskDetailPath(pId, tId, 'employee')).toBe(
        '/employee/projects/proj-123/tasks/task-456'
      );
      expect(getTaskDetailPath(pId, tId, 'project_manager')).toBe(
        '/employee/projects/proj-123/tasks/task-456'
      );
      expect(getTaskDetailPath(pId, tId, 'hr_admin')).toBe(
        '/employee/projects/proj-123/tasks/task-456'
      );
      expect(getTaskDetailPath(pId, tId, 'viewer')).toBe(
        '/employee/projects/proj-123/tasks/task-456'
      );
    });

    it('returns top-level redirect path when role is undefined', () => {
      expect(getTaskDetailPath(pId, tId)).toBe(
        '/projects/proj-123/tasks/task-456'
      );
    });
  });

  describe('getProjectTasksTabPath', () => {
    it('returns admin layout tab path for system_admin', () => {
      expect(getProjectTasksTabPath(pId, 'system_admin')).toBe(
        '/admin/projects/proj-123?tab=tasks'
      );
    });

    it('returns employee layout tab path for other roles', () => {
      expect(getProjectTasksTabPath(pId, 'employee')).toBe(
        '/employee/projects/proj-123?tab=tasks'
      );
    });

    it('returns top-level redirect tab path when role is undefined', () => {
      expect(getProjectTasksTabPath(pId)).toBe('/projects/proj-123?tab=tasks');
    });
  });
});
