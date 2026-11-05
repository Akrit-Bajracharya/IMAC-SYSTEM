/**
 * Utility functions for building canonical task links across layouts.
 */

export function getTaskDetailPath(
  projectId: string,
  taskId: string,
  systemRole?: string
): string {
  if (systemRole === 'system_admin') {
    return `/admin/projects/${projectId}/tasks/${taskId}`;
  }
  if (systemRole) {
    return `/employee/projects/${projectId}/tasks/${taskId}`;
  }
  return `/projects/${projectId}/tasks/${taskId}`;
}

export function getProjectTasksTabPath(
  projectId: string,
  systemRole?: string
): string {
  if (systemRole === 'system_admin') {
    return `/admin/projects/${projectId}?tab=tasks`;
  }
  if (systemRole) {
    return `/employee/projects/${projectId}?tab=tasks`;
  }
  return `/projects/${projectId}?tab=tasks`;
}
