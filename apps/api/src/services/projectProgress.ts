import type { TaskStatus } from '@imac/shared';

export interface ProgressTaskItem {
  id: string;
  status: TaskStatus;
  parentTaskId?: string | null;
}

export type ProgressCalculationStrategy = (tasks: ProgressTaskItem[]) => number;

/**
 * Strategy 1: Leaf tasks completed ratio (Default)
 *
 * Definition:
 * A leaf task is any task that has no child subtasks in the project.
 * Only leaf tasks represent atomic units of work; parent tasks aggregate subtasks.
 *
 * Formula:
 * - If total leaf tasks == 0 -> return 0.
 * - Otherwise: round((done leaf tasks / total leaf tasks) * 100)
 * Note: Statuses 'todo', 'in_progress', and 'blocked' count as NOT done.
 */
export const leafTasksDoneStrategy: ProgressCalculationStrategy = (tasks) => {
  if (!tasks || tasks.length === 0) {
    return 0;
  }

  // Identify all parent task IDs
  const parentIdSet = new Set<string>();
  for (const t of tasks) {
    if (t.parentTaskId) {
      parentIdSet.add(t.parentTaskId);
    }
  }

  // Leaf tasks are tasks whose ID is never referenced as a parentTaskId
  const leafTasks = tasks.filter((t) => !parentIdSet.has(t.id));

  if (leafTasks.length === 0) {
    return 0;
  }

  const doneCount = leafTasks.filter((t) => t.status === 'done').length;
  return Math.round((doneCount / leafTasks.length) * 100);
};

export const projectProgressStrategies: Record<string, ProgressCalculationStrategy> = {
  leaf_tasks_done: leafTasksDoneStrategy,
};

/**
 * Pure function to calculate project progress.
 * Default strategy: 'leaf_tasks_done'.
 */
export function calculateProjectProgress(
  tasks: ProgressTaskItem[],
  strategyName: string = 'leaf_tasks_done',
): number {
  const strategy = projectProgressStrategies[strategyName] ?? leafTasksDoneStrategy;
  return strategy(tasks);
}
