/**
 * Helper to validate and resolve project tabs with role capability checks.
 */

export type ProjectTabId = 'overview' | 'tasks' | 'milestones' | 'time' | 'workload' | 'messages';

export function resolveProjectTab(
  tabParam: string | null | undefined,
  options?: { canSeeTime?: boolean }
): ProjectTabId {
  if (!tabParam) return 'overview';

  const validTabs: ProjectTabId[] = ['overview', 'tasks', 'milestones', 'time', 'workload', 'messages'];
  if (!validTabs.includes(tabParam as ProjectTabId)) {
    return 'overview';
  }

  if (tabParam === 'time' && options?.canSeeTime === false) {
    return 'overview';
  }

  return tabParam as ProjectTabId;
}
