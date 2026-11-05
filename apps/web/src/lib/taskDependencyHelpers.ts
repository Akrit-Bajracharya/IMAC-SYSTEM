import type { ProjectTask } from '../types/index.js';

/**
 * Filter project tasks to find valid candidates for new prerequisite dependencies.
 * Excludes:
 * 1. The task itself
 * 2. Tasks that are already prerequisites (the "Blocked by" list)
 * 3. Tasks that already depend on the current task (the "Blocks" list) - per Amendment 1
 */
export function filterCandidateDependencies(
  allProjectTasks: ProjectTask[],
  currentTaskId: string,
  existingPrerequisiteIds: string[],
  existingDependentIds: string[] = []
): ProjectTask[] {
  const prereqSet = new Set(existingPrerequisiteIds);
  const depSet = new Set(existingDependentIds);

  return allProjectTasks.filter((task) => {
    if (task.id === currentTaskId) return false;
    if (prereqSet.has(task.id)) return false;
    if (depSet.has(task.id)) return false;
    return true;
  });
}

export interface DependencyErrorInfo {
  key: string;
  defaultMessage: string;
  isNotFoundOrForbidden: boolean;
}

/**
 * Maps dependency API errors into localized keys and friendly plain-language messages.
 * Explains dependency cycle in plain words (tasks waiting on each other in a loop).
 */
export function mapDependencyError(errInfo: {
  status: number;
  error: string;
  message?: string;
}): DependencyErrorInfo {
  if (errInfo.error === 'self_dependency') {
    return {
      key: 'projects.taskDetail.dependencies.errors.selfDependency',
      defaultMessage: 'A task cannot depend on itself.',
      isNotFoundOrForbidden: false,
    };
  }

  if (errInfo.error === 'dependency_cycle') {
    return {
      key: 'projects.taskDetail.dependencies.errors.cycle',
      defaultMessage:
        'Adding this dependency would create a circular loop where tasks wait on each other.',
      isNotFoundOrForbidden: false,
    };
  }

  if (errInfo.error === 'duplicate_dependency') {
    return {
      key: 'projects.taskDetail.dependencies.errors.duplicate',
      defaultMessage: 'This dependency already exists.',
      isNotFoundOrForbidden: false,
    };
  }

  if (errInfo.error === 'validation_error') {
    return {
      key: 'projects.taskDetail.dependencies.errors.validation',
      defaultMessage: 'Invalid dependency data. Please verify the selected task.',
      isNotFoundOrForbidden: false,
    };
  }

  if (errInfo.status === 403) {
    return {
      key: 'projects.taskDetail.dependencies.errors.forbidden',
      defaultMessage: 'You do not have permission to manage dependencies on this task.',
      isNotFoundOrForbidden: true,
    };
  }

  if (errInfo.status === 404) {
    return {
      key: 'projects.taskDetail.dependencies.errors.notFound',
      defaultMessage: 'Task or project not found.',
      isNotFoundOrForbidden: true,
    };
  }

  return {
    key: 'projects.taskDetail.dependencies.errors.generic',
    defaultMessage: errInfo.message || 'Failed to update dependency.',
    isNotFoundOrForbidden: false,
  };
}
