import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import {
  Link2,
  Plus,
  Trash2,
  AlertCircle,
  Search,
  X,
  ExternalLink,
  ShieldAlert,
} from 'lucide-react';
import { Button } from '../ui/button.js';
import { Spinner } from '../layout/Spinner.js';
import { TaskStatusBadge } from './TaskStatusBadge.js';
import {
  fetchAllTasksForProject,
  addTaskDependency,
  removeTaskDependency,
  getProjectErrorInfo,
} from '../../api/projects.js';
import { canEditTask } from '../../lib/taskPermissions.js';
import {
  filterCandidateDependencies,
  mapDependencyError,
} from '../../lib/taskDependencyHelpers.js';
import { getTaskDetailPath } from '../../lib/taskLinks.js';
import { formatDateDisplay } from '../../lib/dateUtils.js';
import type {
  ProjectTaskDetail,
  ProjectTask,
  ProjectRole,
  TaskDependencyItem,
} from '../../types/index.js';

interface TaskDependenciesSectionProps {
  projectId: string;
  task: ProjectTaskDetail;
  callerProjectRole?: ProjectRole;
  isSystemAdmin: boolean;
  currentUserId?: string;
  onRefreshTask: () => void;
}

export function TaskDependenciesSection({
  projectId,
  task,
  callerProjectRole,
  isSystemAdmin,
  currentUserId,
  onRefreshTask,
}: TaskDependenciesSectionProps) {
  const { t } = useTranslation();

  // Modals & states
  const [showAddModal, setShowAddModal] = useState(false);
  const [depToRemove, setDepToRemove] = useState<TaskDependencyItem | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDependsOnTaskId, setSelectedDependsOnTaskId] = useState<string>('');
  const [modalError, setModalError] = useState<string | null>(null);
  const [sectionError, setSectionError] = useState<string | null>(null);

  // Permission: managers and system_admin on any task; a member only on tasks they created or are assigned to
  const canManage = canEditTask(
    callerProjectRole,
    isSystemAdmin,
    'manageDependencies',
    task,
    currentUserId
  );

  // Load project tasks when modal is open to pick a dependency
  const {
    data: allProjectTasks,
    isLoading: isLoadingCandidates,
    isError: isCandidatesError,
  } = useQuery<ProjectTask[]>({
    queryKey: ['projectTasksAll', projectId],
    queryFn: () => fetchAllTasksForProject(projectId),
    enabled: showAddModal && Boolean(projectId),
    staleTime: 30000,
  });

  const existingPrereqIds = (task.dependencies || []).map((d) => d.dependsOnTaskId);
  const existingDependentIds = (task.dependentOnMe || []).map((d) => d.taskId);

  // Candidate tasks (Amendment 1: excludes self, prerequisites, and dependent tasks)
  const candidateTasks = React.useMemo(() => {
    if (!allProjectTasks) return [];
    const baseCandidates = filterCandidateDependencies(
      allProjectTasks,
      task.id,
      existingPrereqIds,
      existingDependentIds
    );

    if (!searchQuery.trim()) return baseCandidates;
    const query = searchQuery.toLowerCase();
    return baseCandidates.filter(
      (t) =>
        t.title.toLowerCase().includes(query) ||
        (t.description && t.description.toLowerCase().includes(query))
    );
  }, [allProjectTasks, task.id, existingPrereqIds, existingDependentIds, searchQuery]);

  // Add dependency mutation
  const addMutation = useMutation({
    mutationFn: async (dependsOnTaskId: string) => {
      return addTaskDependency(projectId, task.id, dependsOnTaskId);
    },
    onSuccess: () => {
      setShowAddModal(false);
      setSelectedDependsOnTaskId('');
      setSearchQuery('');
      setModalError(null);
      setSectionError(null);
      onRefreshTask();
    },
    onError: (err: any) => {
      const errInfo = getProjectErrorInfo(err);
      const mapped = mapDependencyError(errInfo);
      setModalError(t(mapped.key, mapped.defaultMessage));

      // Amendment 3: friendly message and refetch on 403 or 404
      if (mapped.isNotFoundOrForbidden) {
        onRefreshTask();
      }
    },
  });

  // Remove dependency mutation
  const removeMutation = useMutation({
    mutationFn: async (dependsOnTaskId: string) => {
      return removeTaskDependency(projectId, task.id, dependsOnTaskId);
    },
    onSuccess: () => {
      setDepToRemove(null);
      setSectionError(null);
      onRefreshTask();
    },
    onError: (err: any) => {
      const errInfo = getProjectErrorInfo(err);
      const mapped = mapDependencyError(errInfo);
      setSectionError(t(mapped.key, mapped.defaultMessage));
      setDepToRemove(null);

      // Amendment 3: friendly message and refetch on 403 or 404
      if (mapped.isNotFoundOrForbidden) {
        onRefreshTask();
      }
    },
  });

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDependsOnTaskId || addMutation.isPending) return;
    setModalError(null);
    addMutation.mutate(selectedDependsOnTaskId);
  };

  const handleRemoveConfirm = () => {
    if (!depToRemove || removeMutation.isPending) return;
    removeMutation.mutate(depToRemove.dependsOnTaskId);
  };

  const dependenciesCount = (task.dependencies?.length ?? 0) + (task.dependentOnMe?.length ?? 0);

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-5 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Link2 className="w-4 h-4 text-gray-500" />
          <h3 className="font-semibold text-gray-900 dark:text-gray-100 text-sm sm:text-base">
            {t('projects.taskDetail.dependencies.title', 'Dependencies')} ({dependenciesCount})
          </h3>
        </div>

        {canManage && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setModalError(null);
              setSelectedDependsOnTaskId('');
              setSearchQuery('');
              setShowAddModal(true);
            }}
            className="flex items-center gap-1 text-xs"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{t('projects.taskDetail.dependencies.addDependency', 'Add Dependency')}</span>
          </Button>
        )}
      </div>

      {/* Section Error Banner */}
      {sectionError && (
        <div className="p-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-md text-xs text-red-700 dark:text-red-300 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{sectionError}</span>
          </div>
          <button
            onClick={() => setSectionError(null)}
            className="text-red-500 hover:text-red-700"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Blocked By List (Prerequisites) */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide">
            {t('projects.taskDetail.dependencies.blockedBy', 'Blocked By')} ({task.dependencies?.length ?? 0})
          </span>
          <span className="text-[11px] text-gray-400">
            {t('projects.taskDetail.dependencies.blockedByDesc', 'Prerequisite tasks this task depends on')}
          </span>
        </div>

        {task.dependencies && task.dependencies.length > 0 ? (
          <div className="divide-y divide-gray-100 dark:divide-gray-700 border border-gray-100 dark:border-gray-700 rounded-md overflow-hidden">
            {task.dependencies.map((dep) => {
              const prereq = dep.dependsOnTask;
              return (
                <div
                  key={dep.id}
                  className="p-3 hover:bg-gray-50/75 dark:hover:bg-gray-750/50 transition-colors flex items-center justify-between gap-3 text-xs"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    {prereq && <TaskStatusBadge status={prereq.status} />}
                    {prereq ? (
                      <Link
                        to={getTaskDetailPath(projectId, prereq.id)}
                        className="font-medium text-gray-900 dark:text-gray-100 hover:text-primary dark:hover:text-primary hover:underline truncate"
                      >
                        {prereq.title}
                      </Link>
                    ) : (
                      <span className="text-gray-400 italic truncate">
                        {t('projects.taskDetail.dependencies.unknownTask', 'Deleted or unknown task')}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-3 flex-shrink-0">
                    {prereq?.dueDate && (
                      <span className="text-gray-500 dark:text-gray-400 text-[11px]">
                        {formatDateDisplay(prereq.dueDate)}
                      </span>
                    )}

                    {canManage && (
                      <button
                        type="button"
                        onClick={() => setDepToRemove(dep)}
                        disabled={removeMutation.isPending}
                        className="text-gray-400 hover:text-red-600 dark:hover:text-red-400 p-1 rounded transition-colors"
                        title={t('projects.taskDetail.dependencies.remove', 'Remove dependency')}
                        aria-label={t('projects.taskDetail.dependencies.remove', 'Remove dependency')}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-xs text-gray-400 dark:text-gray-500 italic p-3 border border-dashed border-gray-200 dark:border-gray-700 rounded-md">
            {t(
              'projects.taskDetail.dependencies.noBlockedBy',
              'No prerequisite tasks (this task is not blocked by anything).'
            )}
          </p>
        )}
      </div>

      {/* Blocks List (Dependents) */}
      <div className="space-y-2 pt-2 border-t border-gray-100 dark:border-gray-700">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide">
            {t('projects.taskDetail.dependencies.blocks', 'Blocks')} ({task.dependentOnMe?.length ?? 0})
          </span>
          <span className="text-[11px] text-gray-400">
            {t('projects.taskDetail.dependencies.blocksDesc', 'Tasks waiting on this task to finish')}
          </span>
        </div>

        {task.dependentOnMe && task.dependentOnMe.length > 0 ? (
          <div className="divide-y divide-gray-100 dark:divide-gray-700 border border-gray-100 dark:border-gray-700 rounded-md overflow-hidden">
            {task.dependentOnMe.map((dep) => {
              const dependent = dep.task;
              return (
                <div
                  key={dep.id}
                  className="p-3 hover:bg-gray-50/75 dark:hover:bg-gray-750/50 transition-colors flex items-center justify-between gap-3 text-xs"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    {dependent && <TaskStatusBadge status={dependent.status} />}
                    {dependent ? (
                      <Link
                        to={getTaskDetailPath(projectId, dependent.id)}
                        className="font-medium text-gray-900 dark:text-gray-100 hover:text-primary dark:hover:text-primary hover:underline truncate"
                      >
                        {dependent.title}
                      </Link>
                    ) : (
                      <span className="text-gray-400 italic truncate">
                        {t('projects.taskDetail.dependencies.unknownTask', 'Deleted or unknown task')}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    {dependent?.dueDate && (
                      <span className="text-gray-500 dark:text-gray-400 text-[11px]">
                        {formatDateDisplay(dependent.dueDate)}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-xs text-gray-400 dark:text-gray-500 italic p-3 border border-dashed border-gray-200 dark:border-gray-700 rounded-md">
            {t('projects.taskDetail.dependencies.noBlocks', 'No tasks are currently waiting on this task.')}
          </p>
        )}
      </div>

      {/* Add Dependency Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 overflow-y-auto">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-lg w-full p-6 relative my-8 space-y-4">
            <button
              onClick={() => {
                setShowAddModal(false);
                setModalError(null);
              }}
              disabled={addMutation.isPending}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              aria-label={t('common.close', 'Close')}
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
              <Link2 className="w-5 h-5 text-primary" />
              <span>{t('projects.taskDetail.dependencies.addModalTitle', 'Add Prerequisite Dependency')}</span>
            </h3>

            <p className="text-xs text-gray-500 dark:text-gray-400">
              {t(
                'projects.taskDetail.dependencies.addModalDesc',
                'Select a task from this project that must be completed before this task can be marked done.'
              )}
            </p>

            {/* Modal Error Banner */}
            {modalError && (
              <div className="p-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-md text-xs text-red-700 dark:text-red-300 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{modalError}</span>
              </div>
            )}

            {/* Search Input */}
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t('projects.taskDetail.dependencies.searchPlaceholder', 'Search candidate tasks...')}
                className="w-full pl-9 pr-3 py-1.5 text-xs border rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100 focus:ring-2 focus:ring-primary focus:outline-none"
              />
            </div>

            {/* Candidates List */}
            <div className="max-h-60 overflow-y-auto border border-gray-200 dark:border-gray-700 rounded-md divide-y divide-gray-100 dark:divide-gray-700">
              {isLoadingCandidates ? (
                <div className="p-6 flex justify-center">
                  <Spinner className="h-6 w-6 text-primary" />
                </div>
              ) : isCandidatesError ? (
                <div className="p-4 text-center text-xs text-red-600 dark:text-red-400">
                  {t('projects.taskDetail.dependencies.loadError', 'Failed to load project tasks.')}
                </div>
              ) : candidateTasks.length > 0 ? (
                candidateTasks.map((cand) => {
                  const isSelected = selectedDependsOnTaskId === cand.id;
                  return (
                    <label
                      key={cand.id}
                      className={`p-3 flex items-center justify-between gap-3 text-xs cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors ${
                        isSelected ? 'bg-primary/5 dark:bg-primary/10' : ''
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <input
                          type="radio"
                          name="candidateTask"
                          value={cand.id}
                          checked={isSelected}
                          onChange={() => setSelectedDependsOnTaskId(cand.id)}
                          className="text-primary focus:ring-primary"
                        />
                        <TaskStatusBadge status={cand.status} />
                        <span className="font-medium text-gray-900 dark:text-gray-100 truncate">
                          {cand.title}
                        </span>
                      </div>

                      {cand.dueDate && (
                        <span className="text-[11px] text-gray-400 flex-shrink-0">
                          {formatDateDisplay(cand.dueDate)}
                        </span>
                      )}
                    </label>
                  );
                })
              ) : (
                <div className="p-4 text-center text-xs text-gray-400 dark:text-gray-500 italic">
                  {t(
                    'projects.taskDetail.dependencies.noCandidates',
                    'No available tasks found to add as a dependency.'
                  )}
                </div>
              )}
            </div>

            {/* Modal Actions */}
            <div className="flex justify-end gap-3 pt-3 border-t dark:border-gray-700">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setShowAddModal(false);
                  setModalError(null);
                }}
                disabled={addMutation.isPending}
              >
                {t('common.cancel', 'Cancel')}
              </Button>
              <Button
                size="sm"
                onClick={handleAddSubmit}
                disabled={!selectedDependsOnTaskId || addMutation.isPending}
              >
                {addMutation.isPending
                  ? t('common.saving', 'Adding...')
                  : t('projects.taskDetail.dependencies.confirmAdd', 'Add Dependency')}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Remove Confirmation Dialog */}
      {depToRemove && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full p-6 space-y-4">
            <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
              <Trash2 className="w-5 h-5 text-red-600" />
              <span>{t('projects.taskDetail.dependencies.removeTitle', 'Remove Prerequisite Dependency')}</span>
            </h3>

            <p className="text-xs text-gray-600 dark:text-gray-300 leading-relaxed">
              {t(
                'projects.taskDetail.dependencies.removeConfirmText',
                'Are you sure you want to remove the prerequisite dependency on "{{title}}"? This task will no longer be blocked by it.',
                { title: depToRemove.dependsOnTask?.title || t('projects.taskDetail.dependencies.unknownTask', 'this task') }
              )}
            </p>

            <div className="flex justify-end gap-3 pt-3 border-t dark:border-gray-700">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setDepToRemove(null)}
                disabled={removeMutation.isPending}
              >
                {t('common.cancel', 'Cancel')}
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={handleRemoveConfirm}
                disabled={removeMutation.isPending}
              >
                {removeMutation.isPending
                  ? t('common.deleting', 'Removing...')
                  : t('projects.taskDetail.dependencies.confirmRemove', 'Remove')}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
