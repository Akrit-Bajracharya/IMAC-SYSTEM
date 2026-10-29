import { describe, it, expect } from 'vitest';
import { calculateProjectProgress, type ProgressTaskItem } from '../services/projectProgress.js';

describe('Project Progress Calculation Unit Tests (Step 10d)', () => {
  it('returns 0 when project has no tasks (mock-based)', () => {
    expect(calculateProjectProgress([])).toBe(0);
  });

  it('returns 100 when all leaf tasks are done (mock-based)', () => {
    const tasks: ProgressTaskItem[] = [
      { id: 't1', status: 'done', parentTaskId: null },
      { id: 't2', status: 'done', parentTaskId: null },
    ];
    expect(calculateProjectProgress(tasks)).toBe(100);
  });

  it('treats blocked and in_progress as not done (mock-based)', () => {
    const tasks: ProgressTaskItem[] = [
      { id: 't1', status: 'done', parentTaskId: null },
      { id: 't2', status: 'blocked', parentTaskId: null },
      { id: 't3', status: 'in_progress', parentTaskId: null },
      { id: 't4', status: 'todo', parentTaskId: null },
    ];
    // 1 of 4 leaf tasks is done = 25%
    expect(calculateProjectProgress(tasks)).toBe(25);
  });

  it('evaluates leaf tasks properly in hierarchical subtask structures (mock-based)', () => {
    // Parent task 'p1' has subtasks 's1' and 's2'.
    // Standalone root task 'r1' has no subtasks.
    // Leaves are 's1', 's2', and 'r1'. Total leaves = 3.
    // 'p1' is NOT a leaf, even if status is set to done.
    const tasks: ProgressTaskItem[] = [
      { id: 'p1', status: 'done', parentTaskId: null },
      { id: 's1', status: 'done', parentTaskId: 'p1' },
      { id: 's2', status: 'todo', parentTaskId: 'p1' },
      { id: 'r1', status: 'done', parentTaskId: null },
    ];

    // Leaves: s1 (done), s2 (todo), r1 (done) -> 2 of 3 done = 67%
    expect(calculateProjectProgress(tasks)).toBe(67);
  });

  it('returns 0 when all tasks are blocked or todo (mock-based)', () => {
    const tasks: ProgressTaskItem[] = [
      { id: 't1', status: 'blocked', parentTaskId: null },
      { id: 't2', status: 'todo', parentTaskId: null },
    ];
    expect(calculateProjectProgress(tasks)).toBe(0);
  });

  it('falls back to default strategy when unknown strategy name is passed (mock-based)', () => {
    const tasks: ProgressTaskItem[] = [
      { id: 't1', status: 'done', parentTaskId: null },
      { id: 't2', status: 'todo', parentTaskId: null },
    ];
    expect(calculateProjectProgress(tasks, 'non_existent_strategy')).toBe(50);
  });
});
