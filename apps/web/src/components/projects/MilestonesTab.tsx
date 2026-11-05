import React, { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Milestone as MilestoneIcon,
  Plus,
  Calendar,
  CheckCircle2,
  RotateCcw,
  Edit2,
  ChevronDown,
  ChevronRight,
  AlertTriangle,
  AlertCircle,
  X,
  ListTodo,
  User,
} from 'lucide-react';
import { Button } from '../ui/button.js';
import { Spinner } from '../layout/Spinner.js';
import { TaskStatusBadge } from './TaskStatusBadge.js';
import {
  fetchProjectMilestones,
  fetchAllTasksForProject,
  createProjectMilestone,
  patchProjectMilestone,
  completeProjectMilestone,
  reopenProjectMilestone,
  getProjectErrorInfo,
} from '../../api/projects.js';
import {
  isMilestoneOverdue,
  computeMilestoneTaskCounts,
  getTasksForMilestone,
  canManageMilestones,
  mapMilestoneError,
} from '../../lib/milestoneHelpers.js';
import {
  formatDateDisplay,
  toDateInputValue,
  getKathmanduToday,
  isTaskOverdue,
} from '../../lib/dateUtils.js';
import { getTaskDetailPath } from '../../lib/taskLinks.js';
import type {
  ProjectDetail,
  ProjectMilestone,
  ProjectTask,
  ProjectRole,
  ProjectMember,
} from '../../types/index.js';

interface MilestonesTabProps {
  project: ProjectDetail;
  callerProjectRole?: ProjectRole;
  isSystemAdmin: boolean;
  currentUserId?: string;
}

export function MilestonesTab({
  project,
  callerProjectRole,
  isSystemAdmin,
  currentUserId,
}: MilestonesTabProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const kathmanduToday = useMemo(() => getKathmanduToday(), []);

  // UI state
  const [expandedMilestoneId, setExpandedMilestoneId] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingMilestone, setEditingMilestone] = useState<ProjectMilestone | null>(null);
  const [sectionError, setSectionError] = useState<string | null>(null);

  // Form state
  const [nameInput, setNameInput] = useState('');
  const [dueDateInput, setDueDateInput] = useState('');
  const [modalError, setModalError] = useState<string | null>(null);

  const canManage = canManageMilestones(callerProjectRole, isSystemAdmin);

  // Queries
  const {
    data: milestones,
    isLoading: isLoadingMilestones,
    isError: isMilestonesError,
    refetch: refetchMilestones,
  } = useQuery<ProjectMilestone[]>({
    queryKey: ['projectMilestones', project.id],
    queryFn: () => fetchProjectMilestones(project.id),
    staleTime: 30000,
  });

  const {
    data: allTasks,
    isLoading: isLoadingTasks,
    refetch: refetchTasks,
  } = useQuery<ProjectTask[]>({
    queryKey: ['projectTasksAll', project.id],
    queryFn: () => fetchAllTasksForProject(project.id),
    staleTime: 30000,
  });

  // Tally task counts per milestone
  const taskCounts = useMemo(() => {
    return computeMilestoneTaskCounts(allTasks || []);
  }, [allTasks]);

  // Member name resolver
  const getUserDisplayName = (userId: string | null | undefined): string => {
    if (!userId) return t('projects.tasks.unassigned', 'Unassigned');
    const member = (project.members || []).find((m: ProjectMember) => m.userId === userId);
    if (member?.user?.displayName) return member.user.displayName;
    if (member?.user?.username) return member.user.username;
    return t('projects.taskDetail.formerMember', 'Former member');
  };

  const handleRefetchAll = () => {
    refetchMilestones();
    refetchTasks();
    queryClient.invalidateQueries({ queryKey: ['projectSummary', project.id] });
  };

  // Create mutation
  const createMutation = useMutation({
    mutationFn: async () => {
      return createProjectMilestone(project.id, {
        name: nameInput.trim(),
        dueDate: dueDateInput ? dueDateInput : null,
      });
    },
    onSuccess: () => {
      setShowCreateModal(false);
      setNameInput('');
      setDueDateInput('');
      setModalError(null);
      setSectionError(null);
      handleRefetchAll();
    },
    onError: (err: any) => {
      const errInfo = getProjectErrorInfo(err);
      const mapped = mapMilestoneError(errInfo);
      setModalError(t(mapped.key, mapped.defaultMessage));
      if (mapped.isNotFoundOrForbidden) {
        handleRefetchAll();
      }
    },
  });

  // Edit mutation
  const patchMutation = useMutation({
    mutationFn: async (milestoneId: string) => {
      return patchProjectMilestone(project.id, milestoneId, {
        name: nameInput.trim(),
        dueDate: dueDateInput ? dueDateInput : null,
      });
    },
    onSuccess: () => {
      setEditingMilestone(null);
      setNameInput('');
      setDueDateInput('');
      setModalError(null);
      setSectionError(null);
      handleRefetchAll();
    },
    onError: (err: any) => {
      const errInfo = getProjectErrorInfo(err);
      const mapped = mapMilestoneError(errInfo);
      setModalError(t(mapped.key, mapped.defaultMessage));
      if (mapped.isNotFoundOrForbidden) {
        handleRefetchAll();
      }
    },
  });

  // Complete mutation
  const completeMutation = useMutation({
    mutationFn: async (milestoneId: string) => {
      return completeProjectMilestone(project.id, milestoneId);
    },
    onSuccess: () => {
      setSectionError(null);
      handleRefetchAll();
    },
    onError: (err: any) => {
      const errInfo = getProjectErrorInfo(err);
      const mapped = mapMilestoneError(errInfo);
      setSectionError(t(mapped.key, mapped.defaultMessage));
      if (mapped.isNotFoundOrForbidden) {
        handleRefetchAll();
      }
    },
  });

  // Reopen mutation
  const reopenMutation = useMutation({
    mutationFn: async (milestoneId: string) => {
      return reopenProjectMilestone(project.id, milestoneId);
    },
    onSuccess: () => {
      setSectionError(null);
      handleRefetchAll();
    },
    onError: (err: any) => {
      const errInfo = getProjectErrorInfo(err);
      const mapped = mapMilestoneError(errInfo);
      setSectionError(t(mapped.key, mapped.defaultMessage));
      if (mapped.isNotFoundOrForbidden) {
        handleRefetchAll();
      }
    },
  });

  const handleOpenCreate = () => {
    setNameInput('');
    setDueDateInput('');
    setModalError(null);
    setShowCreateModal(true);
  };

  const handleOpenEdit = (m: ProjectMilestone, e: React.MouseEvent) => {
    e.stopPropagation();
    setNameInput(m.name);
    setDueDateInput(toDateInputValue(m.dueDate));
    setModalError(null);
    setEditingMilestone(m);
  };

  const toggleExpand = (milestoneId: string) => {
    setExpandedMilestoneId((prev) => (prev === milestoneId ? null : milestoneId));
  };

  const isAnySubmitting =
    createMutation.isPending ||
    patchMutation.isPending ||
    completeMutation.isPending ||
    reopenMutation.isPending;

  return (
    <div className="space-y-6">
      {/* Top Action Bar */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <MilestoneIcon className="w-5 h-5 text-indigo-500" />
            <span>{t('projects.milestones.title', 'Project Milestones')}</span>
          </h2>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            {t(
              'projects.milestones.subtitle',
              'Key delivery targets and progress tracking for this project.'
            )}
          </p>
        </div>

        {canManage && (
          <Button
            size="sm"
            onClick={handleOpenCreate}
            disabled={isAnySubmitting}
            className="flex items-center gap-1.5 text-xs"
          >
            <Plus className="w-4 h-4" />
            <span>{t('projects.milestones.createButton', 'Create Milestone')}</span>
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

      {/* Milestones List */}
      {isLoadingMilestones ? (
        <div className="p-12 flex justify-center bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
          <Spinner className="h-8 w-8 text-primary" />
        </div>
      ) : isMilestonesError ? (
        <div className="p-8 text-center bg-white dark:bg-gray-800 rounded-lg border border-red-200 dark:border-red-800 text-xs text-red-600 dark:text-red-400">
          {t('projects.milestones.loadError', 'Failed to load project milestones.')}
        </div>
      ) : milestones && milestones.length > 0 ? (
        <div className="space-y-3">
          {milestones.map((m) => {
            const counts = taskCounts[m.id] || { total: 0, done: 0 };
            const isCompleted = m.completedAt !== null;
            const isOverdue = isMilestoneOverdue(m.dueDate, m.completedAt, kathmanduToday);
            const isExpanded = expandedMilestoneId === m.id;
            const milestoneTasks = getTasksForMilestone(allTasks || [], m.id);

            return (
              <div
                key={m.id}
                className={`bg-white dark:bg-gray-800 rounded-lg border transition-all overflow-hidden ${
                  isExpanded
                    ? 'border-primary/50 shadow-sm'
                    : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'
                }`}
              >
                {/* Milestone Summary Header (Clickable Accordion) */}
                <div
                  onClick={() => toggleExpand(m.id)}
                  className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 cursor-pointer select-none hover:bg-gray-50/50 dark:hover:bg-gray-750/30 transition-colors"
                >
                  <div className="flex items-start gap-3 min-w-0">
                    <button
                      type="button"
                      className="mt-0.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 flex-shrink-0"
                      aria-label={isExpanded ? t('common.close', 'Close') : t('common.open', 'Open')}
                    >
                      {isExpanded ? (
                        <ChevronDown className="w-5 h-5 text-primary" />
                      ) : (
                        <ChevronRight className="w-5 h-5" />
                      )}
                    </button>

                    <div className="space-y-1.5 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold text-gray-900 dark:text-gray-100 text-sm sm:text-base truncate">
                          {m.name}
                        </h3>

                        {/* Status Badges */}
                        {isCompleted ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-green-50 text-green-700 dark:bg-green-950/40 dark:text-green-300 border border-green-200 dark:border-green-800">
                            <CheckCircle2 className="w-3 h-3 text-green-600" />
                            <span>{t('projects.milestones.status.completed', 'Completed')}</span>
                          </span>
                        ) : isOverdue ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300 border border-red-200 dark:border-red-800">
                            <AlertTriangle className="w-3 h-3 text-red-600" />
                            <span>{t('projects.milestones.status.overdue', 'Overdue')}</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                            <span>{t('projects.milestones.status.open', 'In Progress')}</span>
                          </span>
                        )}
                      </div>

                      {/* Due Date & Task Counts */}
                      <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400 flex-wrap">
                        <div className="flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5 text-gray-400" />
                          <span>
                            {m.dueDate
                              ? formatDateDisplay(m.dueDate)
                              : t('projects.milestones.noDueDate', 'No target date')}
                          </span>
                        </div>

                        <div className="flex items-center gap-1.5">
                          <ListTodo className="w-3.5 h-3.5 text-gray-400" />
                          <span>
                            {t(
                              'projects.milestones.taskProgress',
                              '{{done}} of {{total}} tasks completed',
                              { done: counts.done, total: counts.total }
                            )}
                          </span>
                        </div>

                        {isCompleted && m.completedAt && (
                          <span className="text-[11px] text-green-600 dark:text-green-400">
                            {t('projects.milestones.completedOn', 'Completed on {{date}}', {
                              date: formatDateDisplay(m.completedAt),
                            })}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Actions (Gated to Managers & System Admin) */}
                  {canManage && (
                    <div
                      onClick={(e) => e.stopPropagation()}
                      className="flex items-center gap-2 self-end sm:self-center flex-shrink-0"
                    >
                      {isCompleted ? (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => reopenMutation.mutate(m.id)}
                          disabled={isAnySubmitting}
                          className="flex items-center gap-1 text-xs px-2.5 py-1"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          <span>{t('projects.milestones.reopen', 'Reopen')}</span>
                        </Button>
                      ) : (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => completeMutation.mutate(m.id)}
                          disabled={isAnySubmitting}
                          className="flex items-center gap-1 text-xs px-2.5 py-1 text-green-700 dark:text-green-300 hover:bg-green-50 dark:hover:bg-green-950/30"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5 text-green-600" />
                          <span>{t('projects.milestones.markComplete', 'Mark Complete')}</span>
                        </Button>
                      )}

                      <Button
                        variant="outline"
                        size="sm"
                        onClick={(e) => handleOpenEdit(m, e)}
                        disabled={isAnySubmitting}
                        className="text-xs px-2.5 py-1"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline ml-1">
                          {t('common.edit', 'Edit')}
                        </span>
                      </Button>
                    </div>
                  )}
                </div>

                {/* Expanded Tasks List (Requirement 3) */}
                {isExpanded && (
                  <div className="border-t border-gray-100 dark:border-gray-700 p-4 sm:p-5 bg-gray-50/50 dark:bg-gray-800/50 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide">
                        {t('projects.milestones.tasksTitle', 'Tasks in this milestone')} ({milestoneTasks.length})
                      </span>
                    </div>

                    {milestoneTasks.length > 0 ? (
                      <div className="divide-y divide-gray-100 dark:divide-gray-700 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md overflow-hidden">
                        {milestoneTasks.map((task) => {
                          const taskOverdue = isTaskOverdue(task.dueDate, task.status, kathmanduToday);
                          return (
                            <div
                              key={task.id}
                              className="p-3 hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors flex items-center justify-between gap-3 text-xs"
                            >
                              <div className="flex items-center gap-2.5 min-w-0">
                                <TaskStatusBadge status={task.status} />
                                <Link
                                  to={getTaskDetailPath(project.id, task.id)}
                                  className="font-medium text-gray-900 dark:text-gray-100 hover:text-primary dark:hover:text-primary hover:underline truncate"
                                >
                                  {task.title}
                                </Link>
                              </div>

                              <div className="flex items-center gap-3 text-gray-500 dark:text-gray-400 flex-shrink-0">
                                <span className="hidden sm:inline-flex items-center gap-1 text-[11px]">
                                  <User className="w-3 h-3" />
                                  <span>{getUserDisplayName(task.assigneeUserId)}</span>
                                </span>

                                {task.dueDate && (
                                  <span
                                    className={`inline-flex items-center gap-1 text-[11px] ${
                                      taskOverdue ? 'text-red-600 dark:text-red-400 font-semibold' : ''
                                    }`}
                                  >
                                    <Calendar className="w-3 h-3" />
                                    <span>{formatDateDisplay(task.dueDate)}</span>
                                  </span>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="text-xs text-gray-400 dark:text-gray-500 italic p-3 border border-dashed border-gray-200 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800">
                        {t(
                          'projects.milestones.noTasks',
                          'No tasks currently assigned to this milestone. Assign tasks using the Task form or task edit screen.'
                        )}
                      </p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        /* Empty State */
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-dashed border-gray-300 dark:border-gray-700 p-12 text-center">
          <div className="w-12 h-12 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 rounded-full flex items-center justify-center mx-auto mb-4">
            <MilestoneIcon className="w-6 h-6" />
          </div>

          <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-1">
            {t('projects.milestones.emptyTitle', 'No milestones yet')}
          </h3>

          <p className="text-xs text-gray-500 dark:text-gray-400 max-w-sm mx-auto mb-6 leading-relaxed">
            {t(
              'projects.milestones.emptyDesc',
              'Create milestones to organize deliverables, set target completion dates, and track overall project phases.'
            )}
          </p>

          {canManage && (
            <Button size="sm" onClick={handleOpenCreate} className="text-xs">
              <Plus className="w-3.5 h-3.5 mr-1" />
              <span>{t('projects.milestones.createFirst', 'Create First Milestone')}</span>
            </Button>
          )}
        </div>
      )}

      {/* Create / Edit Milestone Modal */}
      {(showCreateModal || editingMilestone) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 overflow-y-auto">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full p-6 relative my-8 space-y-4">
            <button
              onClick={() => {
                setShowCreateModal(false);
                setEditingMilestone(null);
                setModalError(null);
              }}
              disabled={isAnySubmitting}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              aria-label={t('common.close', 'Close')}
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
              <MilestoneIcon className="w-5 h-5 text-indigo-500" />
              <span>
                {editingMilestone
                  ? t('projects.milestones.editModalTitle', 'Edit Milestone')
                  : t('projects.milestones.createModalTitle', 'Create Milestone')}
              </span>
            </h3>

            {/* Modal Error Alert */}
            {modalError && (
              <div className="p-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-md text-xs text-red-700 dark:text-red-300 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{modalError}</span>
              </div>
            )}

            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!nameInput.trim() || isAnySubmitting) return;
                setModalError(null);
                if (editingMilestone) {
                  patchMutation.mutate(editingMilestone.id);
                } else {
                  createMutation.mutate();
                }
              }}
              className="space-y-4 pt-2"
            >
              {/* Milestone Name */}
              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-700 dark:text-gray-300">
                  {t('projects.milestones.fields.name', 'Milestone Name')} *
                </label>
                <input
                  type="text"
                  required
                  maxLength={200}
                  value={nameInput}
                  onChange={(e) => setNameInput(e.target.value)}
                  placeholder={t('projects.milestones.fields.namePlaceholder', 'e.g. Beta Release')}
                  disabled={isAnySubmitting}
                  className="w-full px-3 py-2 text-xs border rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100 focus:ring-2 focus:ring-primary focus:outline-none"
                />
              </div>

              {/* Target Due Date */}
              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-700 dark:text-gray-300">
                  {t('projects.milestones.fields.dueDate', 'Target Due Date (Optional)')}
                </label>
                <input
                  type="date"
                  value={dueDateInput}
                  onChange={(e) => setDueDateInput(e.target.value)}
                  disabled={isAnySubmitting}
                  className="w-full px-3 py-2 text-xs border rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100 focus:ring-2 focus:ring-primary focus:outline-none"
                />
                <p className="text-[11px] text-gray-400">
                  {t('projects.milestones.fields.dueDateHelp', 'Formatted as YYYY-MM-DD. Leave blank if open-ended.')}
                </p>
              </div>

              {/* Modal Actions */}
              <div className="flex justify-end gap-3 pt-3 border-t dark:border-gray-700">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setShowCreateModal(false);
                    setEditingMilestone(null);
                    setModalError(null);
                  }}
                  disabled={isAnySubmitting}
                >
                  {t('common.cancel', 'Cancel')}
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={!nameInput.trim() || isAnySubmitting}
                >
                  {isAnySubmitting
                    ? t('common.saving', 'Saving...')
                    : editingMilestone
                    ? t('common.saveChanges', 'Save Changes')
                    : t('projects.milestones.confirmCreate', 'Create Milestone')}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
