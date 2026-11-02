import { describe, it, expect } from 'vitest';
import {
  flattenAndDeduplicateTasks,
  getNextTaskPageParam,
} from '../taskPagination.js';
import type { ProjectTask } from '../../types/index.js';

function createMockTask(id: string, title: string): ProjectTask {
  return {
    id,
    projectId: 'proj-1',
    title,
    description: null,
    status: 'todo',
    dueDate: null,
    estimatedHours: null,
    assigneeUserId: null,
    milestoneId: null,
    parentTaskId: null,
    createdByUserId: 'user-1',
    createdAt: '2026-10-30T10:00:00.000Z',
    updatedAt: '2026-10-30T10:00:00.000Z',
  };
}

describe('taskPagination helper', () => {
  describe('flattenAndDeduplicateTasks', () => {
    it('handles empty pages and undefined gracefully', () => {
      expect(flattenAndDeduplicateTasks([])).toEqual([]);
      expect(flattenAndDeduplicateTasks(undefined)).toEqual([]);
      expect(flattenAndDeduplicateTasks(null)).toEqual([]);
      expect(flattenAndDeduplicateTasks([{ items: [] }])).toEqual([]);
    });

    it('flattens two distinct pages preserving ordering', () => {
      const page1 = {
        items: [
          createMockTask('task-1', 'First Task'),
          createMockTask('task-2', 'Second Task'),
        ],
        hasMore: true,
        nextCursor: 'cursor-1',
      };
      const page2 = {
        items: [
          createMockTask('task-3', 'Third Task'),
          createMockTask('task-4', 'Fourth Task'),
        ],
        hasMore: false,
        nextCursor: null,
      };

      const result = flattenAndDeduplicateTasks([page1, page2]);
      expect(result).toHaveLength(4);
      expect(result.map((t) => t.id)).toEqual(['task-1', 'task-2', 'task-3', 'task-4']);
    });

    it('de-duplicates tasks with identical IDs across pages', () => {
      const page1 = {
        items: [
          createMockTask('task-1', 'Task 1 v1'),
          createMockTask('task-2', 'Task 2'),
        ],
      };
      const page2 = {
        items: [
          createMockTask('task-2', 'Task 2 duplicate in page 2'),
          createMockTask('task-3', 'Task 3'),
        ],
      };

      const result = flattenAndDeduplicateTasks([page1, page2]);
      expect(result).toHaveLength(3);
      expect(result.map((t) => t.id)).toEqual(['task-1', 'task-2', 'task-3']);
      // Retains first occurrence
      expect(result[1]?.title).toBe('Task 2');
    });
  });

  describe('getNextTaskPageParam', () => {
    it('returns null when hasMore is false even if nextCursor is present', () => {
      expect(getNextTaskPageParam({ hasMore: false, nextCursor: 'cursor-abc' })).toBeNull();
      expect(getNextTaskPageParam({ hasMore: false, nextCursor: null })).toBeNull();
      expect(getNextTaskPageParam(undefined)).toBeNull();
      expect(getNextTaskPageParam(null)).toBeNull();
    });

    it('returns nextCursor when hasMore is true with a cursor', () => {
      expect(getNextTaskPageParam({ hasMore: true, nextCursor: 'cursor-123' })).toBe('cursor-123');
    });

    it('returns null when hasMore is true but nextCursor is null or undefined', () => {
      expect(getNextTaskPageParam({ hasMore: true, nextCursor: null })).toBeNull();
      expect(getNextTaskPageParam({ hasMore: true })).toBeNull();
    });
  });
});
