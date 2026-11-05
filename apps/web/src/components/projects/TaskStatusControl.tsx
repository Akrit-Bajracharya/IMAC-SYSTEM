import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import { changeTaskStatus, getProjectErrorInfo } from '../../api/projects.js';
import { canEditTask } from '../../lib/taskPermissions.js';
import type { TaskStatus, ProjectRole, TaskDependencyItem } from '../../types/index.js';

interface TaskStatusControlProps {
  projectId: string;
  task: {
    id: string;
    status: TaskStatus;
    createdByUserId: string;
    assigneeUserId?: string | null;
    dependencies?: TaskDependencyItem[];
  };
  callerProjectRole?: ProjectRole;
  isSystemAdmin: boolean;
  currentUserId?: string;
  variant?: 'board' | 'detail';
  onError?: (err: { message: string; isConflict?: boolean } | null) => void;
  onSuccessWarning?: (warnings: string[] | null) => void;
  onStatusChanged?: (newStatus: TaskStatus) => void;
}

export function formatStatusWarning(t: (key: string, def: string) => string, warning: string): string {
  if (warning === 'open_dependency') {
    return t(
      'projects.tasks.statusWarnings.openDependency',
      'Warning: This task was marked done while prerequisite dependencies are still open.'
    );
  }
  if (warning === 'open_subtasks') {
    return t(
      'projects.tasks.statusWarnings.openSubtasks',
      'Warning: This task was marked done while some subtasks are still open.'
    );
  }
  return warning;
}

export function TaskStatusControl({
  projectId,
  task,
  callerProjectRole,
  isSystemAdmin,
  currentUserId,
  variant = 'board',
  onError,
  onSuccessWarning,
  onStatusChanged,
}: TaskStatusControlProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [inlineError, setInlineError] = useState<string | null>(null);
  const [inlineWarnings, setInlineWarnings] = useState<string[] | null>(null);

  const canChange = canEditTask(
    callerProjectRole,
    isSystemAdmin,
    'changeStatus',
    task,
    currentUserId
  );

  if (!canChange) {
    return null;
  }

  const handleStatusChange = async (targetStatus: TaskStatus) => {
    if (task.status === targetStatus) return;
    setIsSubmitting(true);
    setInlineError(null);
    setInlineWarnings(null);
    onError?.(null);
    onSuccessWarning?.(null);

    try {
      const res = await changeTaskStatus(projectId, task.id, targetStatus);
      if (res.warnings && res.warnings.length > 0) {
        setInlineWarnings(res.warnings);
        onSuccessWarning?.(res.warnings);
      }

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['projectTask', projectId, task.id] }),
        queryClient.invalidateQueries({ queryKey: ['projectTasksInfinite', projectId] }),
        queryClient.invalidateQueries({ queryKey: ['projectTasks', projectId] }),
        queryClient.invalidateQueries({ queryKey: ['topLevelTasks', projectId] }),
      ]);

      onStatusChanged?.(targetStatus);
    } catch (err: any) {
      const errInfo = getProjectErrorInfo(err);
      let errMsg = errInfo.message;
      let isConflict = false;

      if (errInfo.error === 'open_dependency') {
        const openPrereqs = (task.dependencies || [])
          .filter((d) => d.dependsOnTask && d.dependsOnTask.status !== 'done')
          .map((d) => d.dependsOnTask?.title)
          .filter(Boolean);

        if (openPrereqs.length > 0) {
          errMsg = t(
            'projects.tasks.statusErrors.openDependencyWithList',
            `Cannot mark task done while prerequisite dependencies are open: ${openPrereqs.join(', ')}`
          );
        } else {
          errMsg = t(
            'projects.tasks.statusErrors.openDependency',
            'Cannot mark task done while prerequisite dependencies are open.'
          );
        }
      } else if (errInfo.error === 'conflict_retry') {
        errMsg = t(
          'projects.tasks.statusErrors.conflictRetry',
          'Task was modified concurrently by another user. Please reload.'
        );
        isConflict = true;
      } else if (errInfo.status === 403) {
        errMsg = t(
          'projects.tasks.statusErrors.forbidden',
          'You do not have permission to change the status of this task.'
        );
        // Amendment 3: Invalidate queries on 403/404 so UI doesn't remain stuck
        queryClient.invalidateQueries({ queryKey: ['projectTask', projectId, task.id] });
        queryClient.invalidateQueries({ queryKey: ['projectTasksInfinite', projectId] });
        queryClient.invalidateQueries({ queryKey: ['project', projectId] });
      } else if (errInfo.status === 404) {
        errMsg = t(
          'projects.tasks.statusErrors.notFound',
          'Task or project not found.'
        );
        // Amendment 3: Invalidate queries on 403/404 so UI doesn't remain stuck
        queryClient.invalidateQueries({ queryKey: ['projectTask', projectId, task.id] });
        queryClient.invalidateQueries({ queryKey: ['projectTasksInfinite', projectId] });
        queryClient.invalidateQueries({ queryKey: ['project', projectId] });
      }

      setInlineError(errMsg);
      onError?.({ message: errMsg, isConflict });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (variant === 'detail') {
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <label className="text-xs font-medium text-gray-500 dark:text-gray-400">
            {t('projects.tasks.statusLabel', 'Status')}:
          </label>
          <select
            value={task.status}
            onChange={(e) => handleStatusChange(e.target.value as TaskStatus)}
            disabled={isSubmitting}
            className="px-2.5 py-1 text-sm border rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100 focus:ring-2 focus:ring-primary focus:outline-none"
          >
            <option value="todo">{t('projects.tasks.status.todo', 'To Do')}</option>
            <option value="in_progress">{t('projects.tasks.status.inProgress', 'In Progress')}</option>
            <option value="blocked">{t('projects.tasks.status.blocked', 'Blocked')}</option>
            <option value="done">{t('projects.tasks.status.done', 'Done')}</option>
          </select>
        </div>

        {inlineError && (
          <p className="text-xs text-red-600 dark:text-red-400 font-medium">
            {inlineError}
          </p>
        )}

        {inlineWarnings && inlineWarnings.length > 0 && (
          <div className="p-2 bg-yellow-50 dark:bg-yellow-950/30 border border-yellow-200 dark:border-yellow-800 rounded text-xs text-yellow-800 dark:yellow-200 space-y-1">
            {inlineWarnings.map((w, idx) => (
              <div key={idx}>{formatStatusWarning(t, w)}</div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // Board variant (Amendment 2: shows same warnings and 409 explanation)
  return (
    <div className="pt-2 border-t border-gray-100 dark:border-gray-700 space-y-1">
      <div className="flex items-center justify-between gap-1 text-[11px]">
        <span className="text-gray-500">
          {t('projects.tasks.moveTo', 'Move to')}:
        </span>
        <select
          value={task.status}
          onChange={(e) => handleStatusChange(e.target.value as TaskStatus)}
          disabled={isSubmitting}
          className="px-2 py-0.5 text-xs border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100 focus:ring-1 focus:ring-primary focus:outline-none"
        >
          <option value="todo">{t('projects.tasks.status.todo', 'To Do')}</option>
          <option value="in_progress">{t('projects.tasks.status.inProgress', 'In Progress')}</option>
          <option value="blocked">{t('projects.tasks.status.blocked', 'Blocked')}</option>
          <option value="done">{t('projects.tasks.status.done', 'Done')}</option>
        </select>
      </div>

      {inlineError && (
        <p className="text-[11px] text-red-600 dark:text-red-400 font-medium leading-tight">
          {inlineError}
        </p>
      )}

      {inlineWarnings && inlineWarnings.length > 0 && (
        <div className="p-1.5 bg-yellow-50 dark:bg-yellow-950/30 border border-yellow-200 dark:border-yellow-800 rounded text-[11px] text-yellow-800 dark:text-yellow-200 space-y-0.5">
          {inlineWarnings.map((w, idx) => (
            <div key={idx}>{formatStatusWarning(t, w)}</div>
          ))}
        </div>
      )}
    </div>
  );
}
