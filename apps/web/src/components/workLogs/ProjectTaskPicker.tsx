import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Select } from '../ui/select.js';
import { Button } from '../ui/button.js';
import { Badge } from '../ui/badge.js';
import { fetchAllTasksForProject } from '../../api/projects.js';
import { isValidUuid, isLegacyText } from '../../lib/dailyWorkLogHelpers.js';
import type { ProjectListItem } from '../../types/index.js';

export { isValidUuid, isLegacyText };

export interface ProjectPickerProps {
  projectId: string;
  memberProjects: ProjectListItem[];
  isReadOnly: boolean;
  isSaving?: boolean;
  onChangeProject: (projectId: string) => void;
  className?: string;
}

export function ProjectPicker({
  projectId,
  memberProjects,
  isReadOnly,
  isSaving = false,
  onChangeProject,
  className = 'w-full text-xs',
}: ProjectPickerProps) {
  const { t } = useTranslation();

  // 1. Saved entry has legacy free-text that is not a valid UUID
  if (isLegacyText(projectId)) {
    return (
      <div className="flex flex-col gap-1 py-1">
        <div className="flex items-center gap-1.5 flex-wrap">
          <Badge
            variant="secondary"
            className="text-[10px] px-1.5 py-0 bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 border-amber-300"
          >
            {t('workLog.daily.legacyBadge')}
          </Badge>
          <span
            className="text-xs font-mono text-muted-foreground truncate"
            title={projectId}
          >
            {projectId}
          </span>
        </div>
        <p className="text-[11px] text-muted-foreground">
          {t('workLog.daily.legacyClearedOnSave')}
        </p>
        {!isReadOnly && !isSaving && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onChangeProject('')}
            className="h-5 px-1.5 text-xs text-destructive hover:text-destructive self-start"
          >
            {t('workLog.daily.removeProjectLink')}
          </Button>
        )}
      </div>
    );
  }

  // 2. Read-only mode
  if (isReadOnly) {
    const projectName = memberProjects.find((p) => p.id === projectId)?.name;
    return (
      <div className="p-2 rounded bg-muted/30 text-xs font-medium truncate">
        {projectName || t('workLog.daily.noProject')}
      </div>
    );
  }

  // 3. Interactive Project Select with "No project" option
  return (
    <Select
      value={projectId}
      onChange={(e) => onChangeProject(e.target.value)}
      disabled={isReadOnly || isSaving}
      className={className}
    >
      <option value="">{t('workLog.daily.noProject')}</option>
      {memberProjects.map((p) => (
        <option key={p.id} value={p.id}>
          {p.name}
        </option>
      ))}
    </Select>
  );
}

export interface TaskPickerProps {
  projectId: string;
  taskId: string;
  isReadOnly: boolean;
  isSaving?: boolean;
  onChangeTask: (taskId: string) => void;
  className?: string;
}

export function TaskPicker({
  projectId,
  taskId,
  isReadOnly,
  isSaving = false,
  onChangeTask,
  className = 'w-full text-xs',
}: TaskPickerProps) {
  const { t } = useTranslation();

  const hasChosenProject = Boolean(projectId && isValidUuid(projectId));

  // Fetch tasks for chosen project (cached/deduplicated across rows by TanStack Query).
  // Runs unconditionally right after useTranslation() so the hook call order is stable.
  const { data: tasks = [], isLoading: isLoadingTasks } = useQuery({
    queryKey: ['projectTasks', projectId],
    queryFn: () => fetchAllTasksForProject(projectId),
    enabled: hasChosenProject,
    staleTime: 60 * 1000,
  });

  // 1. If saved taskId is legacy free text
  if (isLegacyText(taskId)) {
    return (
      <div className="flex flex-col gap-0.5 py-1">
        <div className="flex items-center gap-1.5 flex-wrap">
          <Badge
            variant="secondary"
            className="text-[10px] px-1.5 py-0 bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 border-amber-300"
          >
            {t('workLog.daily.legacyBadge')}
          </Badge>
          <span
            className="text-xs font-mono text-muted-foreground truncate"
            title={taskId}
          >
            {taskId}
          </span>
        </div>
        <p className="text-[11px] text-muted-foreground">
          {t('workLog.daily.legacyClearedOnSave')}
        </p>
      </div>
    );
  }

  // 2. Requirement 1c: The Task picker appears only after a project is chosen
  if (!hasChosenProject) {
    return null;
  }

  // 3. Read-only mode
  if (isReadOnly) {
    const taskTitle = tasks.find((tk) => tk.id === taskId)?.title;
    return (
      <div className="p-2 rounded bg-muted/30 text-xs font-medium truncate">
        {taskTitle || (taskId ? taskId : t('workLog.daily.noTask'))}
      </div>
    );
  }

  // 4. Interactive Task Select with "No task" option
  return (
    <Select
      value={taskId}
      onChange={(e) => onChangeTask(e.target.value)}
      disabled={isReadOnly || isSaving || isLoadingTasks}
      className={className}
    >
      <option value="">{t('workLog.daily.noTask')}</option>
      {tasks.map((task) => (
        <option key={task.id} value={task.id}>
          {task.title} ({task.status})
        </option>
      ))}
    </Select>
  );
}

export interface ProjectTaskPickerProps {
  projectId: string;
  taskId: string;
  isReadOnly: boolean;
  isSaving?: boolean;
  memberProjects: ProjectListItem[];
  onChangeProject: (projectId: string) => void;
  onChangeTask: (taskId: string) => void;
  variant?: 'inline' | 'stacked';
}

export function ProjectTaskPicker({
  projectId,
  taskId,
  isReadOnly,
  isSaving = false,
  memberProjects,
  onChangeProject,
  onChangeTask,
  variant = 'inline',
}: ProjectTaskPickerProps) {
  const hasEligibleProjects = memberProjects.length > 0;
  const hasLegacyProject = isLegacyText(projectId);
  const hasLegacyTask = isLegacyText(taskId);

  // Requirement 1d: If the user has no eligible projects, hide both pickers
  if (!hasEligibleProjects && !hasLegacyProject && !hasLegacyTask) {
    return null;
  }

  const handleProjectSelect = (newProjectId: string) => {
    onChangeProject(newProjectId);
    // Requirement 1c: resets when the project changes
    onChangeTask('');
  };

  const showTaskPicker =
    hasLegacyTask || (Boolean(projectId) && isValidUuid(projectId));

  return (
    <div
      className={
        variant === 'inline'
          ? 'grid grid-cols-2 gap-2 w-full'
          : 'space-y-2 w-full'
      }
    >
      <div className="space-y-1">
        <ProjectPicker
          projectId={projectId}
          memberProjects={memberProjects}
          isReadOnly={isReadOnly}
          isSaving={isSaving}
          onChangeProject={handleProjectSelect}
        />
      </div>

      {showTaskPicker && (
        <div className="space-y-1">
          <TaskPicker
            projectId={projectId}
            taskId={taskId}
            isReadOnly={isReadOnly}
            isSaving={isSaving}
            onChangeTask={onChangeTask}
          />
        </div>
      )}
    </div>
  );
}
