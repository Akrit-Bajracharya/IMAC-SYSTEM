import type { QueryClient } from '@tanstack/react-query';

/**
 * Invalidates all project task and summary caches across the application after a task mutation
 * (such as converting a project message to a task).
 *
 * Exact query keys verified across the codebase:
 * - ['projectTasksInfinite', projectId] -> apps/web/src/components/projects/TasksTab.tsx:75
 * - ['projectTasks', projectId] -> apps/web/src/components/projects/TasksTab.tsx:180, apps/web/src/pages/projects/TaskDetailPage.tsx:208
 * - ['topLevelTasks', projectId] -> apps/web/src/components/projects/CreateTaskModal.tsx:49
 * - ['projectSummary', projectId] -> apps/web/src/pages/projects/ProjectDetailPage.tsx:89
 * - ['projectWorkload', projectId] -> apps/web/src/components/projects/ProjectWorkloadTab.tsx:32
 * - ['projectOverdueTasks', projectId] -> apps/web/src/pages/projects/ProjectDetailPage.tsx:97
 * - ['projectBlockedTasks', projectId] -> apps/web/src/pages/projects/ProjectDetailPage.tsx:104
 * - ['projectTasksAll', projectId] -> apps/web/src/components/projects/MilestonesTab.tsx:57, apps/web/src/components/projects/TimeLogsTab.tsx:83
 */
export async function invalidateProjectTaskCaches(
  queryClient: QueryClient,
  projectId: string
): Promise<void> {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: ['projectTasksInfinite', projectId] }),
    queryClient.invalidateQueries({ queryKey: ['projectTasks', projectId] }),
    queryClient.invalidateQueries({ queryKey: ['topLevelTasks', projectId] }),
    queryClient.invalidateQueries({ queryKey: ['projectSummary', projectId] }),
    queryClient.invalidateQueries({ queryKey: ['projectWorkload', projectId] }),
    queryClient.invalidateQueries({ queryKey: ['projectOverdueTasks', projectId] }),
    queryClient.invalidateQueries({ queryKey: ['projectBlockedTasks', projectId] }),
    queryClient.invalidateQueries({ queryKey: ['projectTasksAll', projectId] }),
  ]);
}
