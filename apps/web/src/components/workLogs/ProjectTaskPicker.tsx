import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Select } from '../ui/select.js';
import { Button } from '../ui/button.js';
import { fetchProjectById, fetchAllTasksForProject } from '../../api/projects.js';
import type { ProjectListItem } from '../../types/index.js';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isValidUuid = (val?: string | null): boolean =>
  typeof val === 'string' && UUID_REGEX.test(val);

interface ProjectTaskPickerProps {
  projectId: string;
  taskId: string;
  legacyProjectId?: string | null;
  projectName?: string | null;
  taskTitle?: string | null;
  isReadOnly: boolean;
  isSaving: boolean;
  memberProjects: ProjectListItem[];
  currentUserId?: string;
  onChangeProject: (projectId: string) => void;
  onChangeTask: (taskId: string) => void;
  onRemoveLegacyProject: () => void;
  variant?: 'inline' | 'stacked';
}

export function ProjectTaskPicker({
  projectId,
  taskId,
  legacyProjectId,
  projectName,
  taskTitle,
  isReadOnly,
  isSaving,
  memberProjects,
  currentUserId,
  onChangeProject,
  onChangeTask,
  onRemoveLegacyProject,
  variant = 'inline',
}: ProjectTaskPickerProps) {
  const { t } = useTranslation();

  // 1. Fetch project detail if projectId is selected to check caller's role on project
  const { data: projectDetail } = useQuery({
    queryKey: ['project', projectId],
    queryFn: () => fetchProjectById(projectId),
    enabled: !!projectId && isValidUuid(projectId),
    staleTime: 60 * 1000,
  });

  // Check if current user is viewer on this project
  const isProjectViewer = useMemo(() => {
    if (!projectDetail || !currentUserId) return false;
    const member = projectDetail.members.find((m) => m.userId === currentUserId);
    return member?.projectRole === 'viewer';
  }, [projectDetail, currentUserId]);

  // 2. Fetch tasks for selected project if not viewer
  const { data: projectTasks = [], isLoading: isLoadingTasks } = useQuery({
    queryKey: ['projectTasks', projectId],
    queryFn: () => fetchAllTasksForProject(projectId),
    enabled: !!projectId && isValidUuid(projectId) && !isProjectViewer,
    staleTime: 60 * 1000,
  });

  // Display project name if read-only or saved
  const displayProjectName = projectName || projectDetail?.name;

  return (
    <div
      className={
        variant === 'inline'
          ? 'grid grid-cols-2 gap-2 w-full'
          : 'space-y-2 w-full'
      }
    >
      {/* Project Selection / Display */}
      <div className="space-y-1">
        {legacyProjectId ? (
          <div className="p-1.5 rounded border border-amber-300/60 bg-amber-50/60 dark:bg-amber-950/20 text-xs flex flex-col gap-1">
            <span className="text-amber-800 dark:text-amber-300 font-medium">
              {t('workLog.daily.legacyProject')}{' '}
              <span className="font-mono">{legacyProjectId}</span>
            </span>
            {!isReadOnly && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={onRemoveLegacyProject}
                className="h-5 px-1.5 text-xs text-destructive hover:text-destructive self-start"
              >
                {t('workLog.daily.removeProjectLink')}
              </Button>
            )}
          </div>
        ) : isReadOnly ? (
          <div className="p-2 rounded bg-muted/30 text-xs font-medium truncate">
            {displayProjectName || t('workLog.daily.noProject')}
          </div>
        ) : (
          <Select
            value={projectId}
            onChange={(e) => {
              onChangeProject(e.target.value);
              onChangeTask('');
            }}
            disabled={isReadOnly || isSaving}
            className="w-full text-xs"
          >
            <option value="">{t('workLog.daily.noProject')}</option>
            {memberProjects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </Select>
        )}
      </div>

      {/* Task Selection / Display */}
      <div className="space-y-1">
        {isReadOnly ? (
          <div className="p-2 rounded bg-muted/30 text-xs font-medium truncate">
            {taskTitle || t('workLog.daily.noTask')}
          </div>
        ) : !projectId ? (
          <div className="p-2 rounded bg-muted/20 text-xs text-muted-foreground italic truncate">
            {t('workLog.daily.selectProjectFirst')}
          </div>
        ) : isProjectViewer ? (
          <div className="p-2 rounded bg-muted/20 text-xs text-muted-foreground italic truncate">
            {t('workLog.daily.viewerNoTasks')}
          </div>
        ) : (
          <Select
            value={taskId}
            onChange={(e) => onChangeTask(e.target.value)}
            disabled={isReadOnly || isSaving || isLoadingTasks}
            className="w-full text-xs"
          >
            <option value="">{t('workLog.daily.noTask')}</option>
            {projectTasks.map((t) => (
              <option key={t.id} value={t.id}>
                {t.title} ({t.status})
              </option>
            ))}
          </Select>
        )}
      </div>
    </div>
  );
}
