import React, { useState, useMemo, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  Calendar,
  Clock,
  User,
  Milestone as MilestoneIcon,
  AlertTriangle,
  Edit2,
  Trash2,
  Plus,
  GitBranch,
  Check,
  X,
  AlertCircle,
  ShieldAlert,
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth.js';
import {
  fetchTaskDetail,
  fetchProjectById,
  fetchProjectMilestones,
  patchTask,
  deleteTask,
  getProjectErrorInfo,
} from '../../api/projects.js';
import { Button } from '../../components/ui/button.js';
import { Spinner } from '../../components/layout/Spinner.js';
import { TaskStatusBadge } from '../../components/projects/TaskStatusBadge.js';
import { TaskStatusControl } from '../../components/projects/TaskStatusControl.js';
import { TaskDependenciesSection } from '../../components/projects/TaskDependenciesSection.js';
import { TaskCommentsSection } from '../../components/projects/TaskCommentsSection.js';
import { CreateTaskModal } from '../../components/projects/CreateTaskModal.js';
import {
  canEditTask,
  canDeleteTask,
} from '../../lib/taskPermissions.js';
import {
  buildPatchTaskPayload,
  type CurrentTaskFormValues,
} from '../../lib/taskEditPayload.js';
import {
  formatDateDisplay,
  toDateInputValue,
  isTaskOverdue,
  getKathmanduToday,
} from '../../lib/dateUtils.js';
import {
  getTaskDetailPath,
  getProjectTasksTabPath,
} from '../../lib/taskLinks.js';
import type {
  ProjectDetail,
  ProjectRole,
  ProjectMember,
  ProjectMilestone,
  ProjectTaskDetail,
  TaskStatus,
} from '../../types/index.js';

export function TaskDetailPage() {
  const { id: projectId, taskId } = useParams<{ id: string; taskId: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const isSystemAdmin = user?.systemRole === 'system_admin';
  const kathmanduToday = useMemo(() => getKathmanduToday(), []);

  // UI States
  const [isEditMode, setIsEditMode] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showAddSubtaskModal, setShowAddSubtaskModal] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  // Edit form state
  const [formValues, setFormValues] = useState<CurrentTaskFormValues>({
    title: '',
    description: '',
    dueDate: '',
    estimatedHours: '',
    assigneeUserId: '',
    milestoneId: '',
  });

  // Queries
  const {
    data: project,
    isLoading: isLoadingProject,
    isError: isProjectError,
    error: projectError,
  } = useQuery<ProjectDetail>({
    queryKey: ['project', projectId],
    queryFn: () => fetchProjectById(projectId!),
    enabled: Boolean(projectId),
    staleTime: 60000,
  });

  const {
    data: task,
    isLoading: isLoadingTask,
    isError: isTaskError,
    error: taskError,
    refetch: refetchTask,
  } = useQuery<ProjectTaskDetail>({
    queryKey: ['projectTask', projectId, taskId],
    queryFn: () => fetchTaskDetail(projectId!, taskId!),
    enabled: Boolean(projectId && taskId),
  });

  const { data: milestones } = useQuery({
    queryKey: ['projectMilestones', projectId],
    queryFn: () => fetchProjectMilestones(projectId!),
    enabled: Boolean(projectId),
    staleTime: 60000,
  });

  // Sync form values when task loads and user is NOT actively editing
  useEffect(() => {
    if (task && !isEditMode) {
      setFormValues({
        title: task.title,
        description: task.description || '',
        dueDate: toDateInputValue(task.dueDate),
        estimatedHours: task.estimatedHours != null ? String(task.estimatedHours) : '',
        assigneeUserId: task.assigneeUserId || '',
        milestoneId: task.milestoneId || '',
      });
      setServerError(null);
    }
  }, [task, isEditMode]);

  // Caller role resolution
  const callerProjectRole: ProjectRole | undefined = useMemo(() => {
    if (!user || !project) return undefined;
    if (isSystemAdmin) return 'manager';
    const myMembership = project.members.find((m: ProjectMember) => m.userId === user.id);
    return myMembership?.projectRole;
  }, [user, project, isSystemAdmin]);

  // Permissions
  const canEdit = useMemo(() => {
    return canEditTask(callerProjectRole, isSystemAdmin, 'edit', task, user?.id);
  }, [callerProjectRole, isSystemAdmin, task, user?.id]);

  const canDelete = useMemo(() => {
    return canDeleteTask(callerProjectRole, isSystemAdmin);
  }, [callerProjectRole, isSystemAdmin]);

  const canAddSubtask = useMemo(() => {
    return canEditTask(callerProjectRole, isSystemAdmin, 'create', null, user?.id);
  }, [callerProjectRole, isSystemAdmin, user?.id]);

  // Name resolution helpers (never show raw user ID)
  const getUserDisplayName = (userId: string | null | undefined): string => {
    if (!userId) return t('projects.tasks.unassigned', 'Unassigned');
    const member = (project?.members || []).find((m: ProjectMember) => m.userId === userId);
    if (member?.user?.displayName) return member.user.displayName;
    if (member?.user?.username) return member.user.username;
    if (task?.assigneeUserId === userId && task?.assigneeUser?.displayName) {
      return task.assigneeUser.displayName;
    }
    return t('projects.taskDetail.formerMember', 'Former member');
  };

  // Eligible assignees for inline edit
  const eligibleAssignees = useMemo(() => {
    return (project?.members || []).filter(
      (m: ProjectMember) =>
        m.user?.isActive !== false &&
        (m.projectRole === 'manager' || m.projectRole === 'member')
    );
  }, [project?.members]);

  // Computed edit payload and validations
  const payloadResult = useMemo(() => {
    if (!task) return { payload: null, errors: {}, hasChanges: false };
    return buildPatchTaskPayload(
      {
        title: task.title,
        description: task.description,
        dueDate: task.dueDate,
        estimatedHours: task.estimatedHours,
        assigneeUserId: task.assigneeUserId,
        milestoneId: task.milestoneId,
      },
      formValues
    );
  }, [task, formValues]);

  // Patch mutation
  const patchMutation = useMutation({
    mutationFn: async () => {
      if (!projectId || !taskId || !payloadResult.payload) return;
      return patchTask(projectId, taskId, payloadResult.payload);
    },
    onSuccess: async () => {
      setIsEditMode(false);
      setServerError(null);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['projectTask', projectId, taskId] }),
        queryClient.invalidateQueries({ queryKey: ['projectTasksInfinite', projectId] }),
        queryClient.invalidateQueries({ queryKey: ['projectTasks', projectId] }),
        queryClient.invalidateQueries({ queryKey: ['topLevelTasks', projectId] }),
      ]);
    },
    onError: (err: any) => {
      const errInfo = getProjectErrorInfo(err);
      if (errInfo.error === 'invalid_assignee') {
        setServerError(
          t(
            'projects.taskDetail.errors.invalidAssignee',
            'Assignee must be an active project member with role manager or member.'
          )
        );
      } else if (errInfo.error === 'invalid_milestone') {
        setServerError(
          t(
            'projects.taskDetail.errors.invalidMilestone',
            'Selected milestone does not belong to this project.'
          )
        );
      } else if (errInfo.status === 403) {
        setServerError(
          t(
            'projects.taskDetail.errors.forbidden',
            'You do not have permission to edit this task.'
          )
        );
      } else if (errInfo.status === 404) {
        setServerError(
          t('projects.taskDetail.errors.notFound', 'Task or project not found.')
        );
      } else {
        setServerError(
          errInfo.message ||
            t('projects.taskDetail.errors.generic', 'Failed to update task.')
        );
      }
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async () => {
      if (!projectId || !taskId) return;
      return deleteTask(projectId, taskId);
    },
    onSuccess: async () => {
      // 1. Navigate to Tasks tab first so no 404 flashes
      const tasksTabUrl = getProjectTasksTabPath(projectId!, user?.systemRole);
      navigate(tasksTabUrl, { replace: true });

      // 2. Remove the deleted task cache entry (do not refetch it)
      queryClient.removeQueries({ queryKey: ['projectTask', projectId, taskId] });

      // 3. Invalidate task list keys
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['projectTasksInfinite', projectId] }),
        queryClient.invalidateQueries({ queryKey: ['projectTasks', projectId] }),
        queryClient.invalidateQueries({ queryKey: ['topLevelTasks', projectId] }),
        queryClient.invalidateQueries({ queryKey: ['projectSummary', projectId] }),
      ]);
    },
    onError: (err: any) => {
      const errInfo = getProjectErrorInfo(err);
      setServerError(
        errInfo.message ||
          t('projects.taskDetail.errors.deleteFailed', 'Failed to delete task.')
      );
      setShowDeleteDialog(false);
    },
  });

  // Loading state
  if (isLoadingProject || isLoadingTask) {
    return (
      <div className="flex justify-center items-center py-24">
        <Spinner />
      </div>
    );
  }

  // Error / Not Found / Forbidden states
  const taskErrInfo = taskError ? getProjectErrorInfo(taskError) : null;
  const projectErrInfo = projectError ? getProjectErrorInfo(projectError) : null;

  if (taskErrInfo?.status === 404 || projectErrInfo?.status === 404 || (!task && !isLoadingTask)) {
    return (
      <div className="max-w-4xl mx-auto p-6 space-y-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg p-8 border border-gray-200 dark:border-gray-700 text-center space-y-3">
          <AlertCircle className="w-10 h-10 text-red-500 mx-auto" />
          <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">
            {t('projects.taskDetail.notFoundTitle', 'Task Not Found')}
          </h2>
          <p className="text-sm text-gray-600 dark:text-gray-400 max-w-md mx-auto">
            {t(
              'projects.taskDetail.notFoundDesc',
              'The task you requested does not exist or may have been deleted.'
            )}
          </p>
          <div className="pt-2">
            <Link
              to={getProjectTasksTabPath(projectId || '', user?.systemRole)}
              className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>{t('projects.taskDetail.backToTasks', 'Back to Tasks')}</span>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (taskErrInfo?.status === 403 || projectErrInfo?.status === 403) {
    return (
      <div className="max-w-4xl mx-auto p-6 space-y-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg p-8 border border-red-200 dark:border-red-800 text-center space-y-3">
          <ShieldAlert className="w-10 h-10 text-red-600 dark:text-red-400 mx-auto" />
          <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">
            {t('projects.taskDetail.forbiddenTitle', 'Access Denied')}
          </h2>
          <p className="text-sm text-gray-600 dark:text-gray-400 max-w-md mx-auto">
            {t(
              'projects.taskDetail.forbiddenDesc',
              'You do not have permission to view this task.'
            )}
          </p>
          <div className="pt-2">
            <Link
              to={getProjectTasksTabPath(projectId || '', user?.systemRole)}
              className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>{t('projects.taskDetail.backToTasks', 'Back to Tasks')}</span>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (isTaskError) {
    return (
      <div className="max-w-4xl mx-auto p-6 space-y-4">
        <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-lg p-6 text-center space-y-3">
          <p className="text-sm text-red-700 dark:text-red-300">
            {taskErrInfo?.message || t('projects.taskDetail.loadError', 'Failed to load task details.')}
          </p>
          <Button variant="outline" size="sm" onClick={() => refetchTask()}>
            {t('common.retry', 'Retry')}
          </Button>
        </div>
      </div>
    );
  }

  if (!task || !project) return null;

  const isOverdue = isTaskOverdue(task.dueDate, task.status, kathmanduToday);
  const tasksTabUrl = getProjectTasksTabPath(project.id, user?.systemRole);

  const handleCancelEdit = () => {
    setIsEditMode(false);
    setServerError(null);
    setFormValues({
      title: task.title,
      description: task.description || '',
      dueDate: toDateInputValue(task.dueDate),
      estimatedHours: task.estimatedHours != null ? String(task.estimatedHours) : '',
      assigneeUserId: task.assigneeUserId || '',
      milestoneId: task.milestoneId || '',
    });
  };

  const handleSaveEdit = () => {
    if (!payloadResult.hasChanges || Object.keys(payloadResult.errors).length > 0) return;
    patchMutation.mutate();
  };

  return (
    <div className="max-w-5xl mx-auto p-4 sm:p-6 space-y-6">
      {/* Top Navigation & Breadcrumbs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b pb-4 dark:border-gray-700">
        <div className="flex items-center gap-2 text-xs sm:text-sm text-gray-500 dark:text-gray-400 flex-wrap">
          <Link
            to={tasksTabUrl}
            className="flex items-center gap-1 hover:text-gray-900 dark:hover:text-gray-100 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>{project.name}</span>
          </Link>
          <span>/</span>
          <span className="text-gray-900 dark:text-gray-100 font-medium truncate max-w-[200px] sm:max-w-xs">
            {task.title}
          </span>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2 flex-wrap">
          {canEdit && !isEditMode && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsEditMode(true)}
              className="flex items-center gap-1.5"
            >
              <Edit2 className="w-3.5 h-3.5" />
              <span>{t('projects.taskDetail.edit', 'Edit Task')}</span>
            </Button>
          )}

          {isEditMode && (
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleCancelEdit}
                disabled={patchMutation.isPending}
                className="flex items-center gap-1"
              >
                <X className="w-3.5 h-3.5" />
                <span>{t('common.cancel', 'Cancel')}</span>
              </Button>
              <Button
                size="sm"
                onClick={handleSaveEdit}
                disabled={
                  patchMutation.isPending ||
                  !payloadResult.hasChanges ||
                  Object.keys(payloadResult.errors).length > 0
                }
                className="flex items-center gap-1"
              >
                <Check className="w-3.5 h-3.5" />
                <span>
                  {patchMutation.isPending
                    ? t('common.saving', 'Saving...')
                    : t('common.save', 'Save Changes')}
                </span>
              </Button>
            </div>
          )}

          {canDelete && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowDeleteDialog(true)}
              disabled={deleteMutation.isPending}
              className="text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 flex items-center gap-1.5"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>{t('projects.taskDetail.delete', 'Delete')}</span>
            </Button>
          )}
        </div>
      </div>

      {/* Former Member / Unassigned Banner */}
      {task.assigneeUserId && task.assigneeIsProjectMember === false && (
        <div className="p-3.5 bg-yellow-50 dark:bg-yellow-950/30 border border-yellow-200 dark:border-yellow-800 rounded-lg flex items-start gap-2.5 text-xs text-yellow-800 dark:text-yellow-200">
          <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <div>
            <span className="font-semibold">
              {t('projects.taskDetail.unassignedMemberTitle', 'Assignee Warning')}:
            </span>{' '}
            {t(
              'projects.taskDetail.unassignedMemberDesc',
              'The assigned user is no longer an active member of this project.'
            )}
          </div>
        </div>
      )}

      {/* Server Error Alert */}
      {serverError && (
        <div className="p-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-lg text-xs text-red-700 dark:text-red-300 flex items-center justify-between gap-2">
          <span>{serverError}</span>
          <button
            onClick={() => setServerError(null)}
            className="text-red-500 hover:text-red-700"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Main Grid: Left Details & Right Metadata */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Title, Description, Subtasks (2 spans) */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-5 space-y-4">
            {/* Title */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <TaskStatusBadge status={task.status} />
                {task.parentTaskId && (
                  <Link
                    to={getTaskDetailPath(project.id, task.parentTaskId, user?.systemRole)}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800 hover:underline"
                  >
                    <GitBranch className="w-3 h-3" />
                    <span>{t('projects.taskDetail.subtaskOf', 'Subtask')}</span>
                  </Link>
                )}
              </div>

              {isEditMode ? (
                <div className="space-y-1">
                  <input
                    type="text"
                    value={formValues.title}
                    onChange={(e) =>
                      setFormValues((prev) => ({ ...prev, title: e.target.value }))
                    }
                    maxLength={200}
                    className="w-full text-lg font-bold px-3 py-1.5 border rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100 focus:ring-2 focus:ring-primary focus:outline-none"
                    placeholder={t('projects.taskDetail.titlePlaceholder', 'Task title')}
                  />
                  {payloadResult.errors.title && (
                    <p className="text-xs text-red-600 dark:text-red-400">
                      {payloadResult.errors.title}
                    </p>
                  )}
                </div>
              ) : (
                <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-gray-100 break-words">
                  {task.title}
                </h1>
              )}
            </div>

            {/* Description */}
            <div className="pt-2 border-t dark:border-gray-700 space-y-2">
              <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
                <span className="font-medium text-gray-700 dark:text-gray-300">
                  {t('projects.taskDetail.descriptionLabel', 'Description')}
                </span>
                {isEditMode && (
                  <span
                    className={`${
                      formValues.description.length > 5000
                        ? 'text-red-600 dark:text-red-400 font-bold'
                        : ''
                    }`}
                  >
                    {formValues.description.length} / 5000
                  </span>
                )}
              </div>

              {isEditMode ? (
                <div className="space-y-1">
                  <textarea
                    rows={6}
                    value={formValues.description}
                    onChange={(e) =>
                      setFormValues((prev) => ({
                        ...prev,
                        description: e.target.value,
                      }))
                    }
                    maxLength={5000}
                    placeholder={t(
                      'projects.taskDetail.descPlaceholder',
                      'Add detailed task description or criteria...'
                    )}
                    className="w-full px-3 py-2 text-sm border rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100 focus:ring-2 focus:ring-primary focus:outline-none"
                  />
                  {payloadResult.errors.description && (
                    <p className="text-xs text-red-600 dark:text-red-400">
                      {payloadResult.errors.description}
                    </p>
                  )}
                </div>
              ) : task.description ? (
                <div className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap break-words leading-relaxed">
                  {task.description}
                </div>
              ) : (
                <p className="text-sm text-gray-400 dark:text-gray-500 italic">
                  {t('projects.taskDetail.noDescription', 'No description provided.')}
                </p>
              )}
            </div>
          </div>

          {/* Subtasks Section */}
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-5 space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <GitBranch className="w-4 h-4 text-gray-500" />
                <h3 className="font-semibold text-gray-900 dark:text-gray-100 text-sm sm:text-base">
                  {t('projects.taskDetail.subtasksTitle', 'Subtasks')} (
                  {task.subtasks?.length ?? 0})
                </h3>
              </div>

              {/* Subtask Creation Control */}
              {task.parentTaskId ? (
                <span className="text-[11px] text-gray-400 italic">
                  {t('projects.taskDetail.noNestedSubtasks', 'Subtasks cannot have nested subtasks.')}
                </span>
              ) : (
                canAddSubtask && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowAddSubtaskModal(true)}
                    className="flex items-center gap-1 text-xs"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>{t('projects.taskDetail.addSubtask', 'Add Subtask')}</span>
                  </Button>
                )
              )}
            </div>

            {/* Subtasks List */}
            {task.subtasks && task.subtasks.length > 0 ? (
              <div className="divide-y divide-gray-100 dark:divide-gray-700 border border-gray-100 dark:border-gray-700 rounded-md overflow-hidden">
                {task.subtasks.map((sub) => {
                  const subAssignee = getUserDisplayName(sub.assigneeUserId);
                  return (
                    <div
                      key={sub.id}
                      className="p-3 hover:bg-gray-50/75 dark:hover:bg-gray-750/50 transition-colors flex items-center justify-between gap-3 text-xs"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <TaskStatusBadge status={sub.status} />
                        <Link
                          to={getTaskDetailPath(project.id, sub.id, user?.systemRole)}
                          className="font-medium text-gray-900 dark:text-gray-100 hover:text-primary dark:hover:text-primary hover:underline truncate"
                        >
                          {sub.title}
                        </Link>
                      </div>

                      <div className="flex items-center gap-3 text-gray-500 dark:text-gray-400 flex-shrink-0">
                        <span className="hidden sm:inline-flex items-center gap-1">
                          <User className="w-3 h-3" />
                          <span>{subAssignee}</span>
                        </span>
                        {sub.dueDate && (
                          <span className="inline-flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            <span>{formatDateDisplay(sub.dueDate)}</span>
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-xs text-gray-400 italic py-2">
                {t('projects.taskDetail.noSubtasks', 'No subtasks for this task.')}
              </p>
            )}
          </div>

          {/* Dependencies Section */}
          <TaskDependenciesSection
            projectId={project.id}
            task={task}
            callerProjectRole={callerProjectRole}
            isSystemAdmin={isSystemAdmin}
            currentUserId={user?.id}
            onRefreshTask={refetchTask}
          />

          {/* Comments Section */}
          <TaskCommentsSection
            projectId={project.id}
            taskId={task.id}
            commentCount={task.commentCount ?? 0}
            callerProjectRole={callerProjectRole}
            isSystemAdmin={isSystemAdmin}
            currentUserId={user?.id}
            projectMembers={project.members}
            onRefreshTask={refetchTask}
          />
        </div>

        {/* Right Column: Metadata Sidebar Card (1 span) */}
        <div className="space-y-6">
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-5 space-y-4 text-xs sm:text-sm">
            <h3 className="font-semibold text-gray-900 dark:text-gray-100 text-sm border-b pb-2 dark:border-gray-700">
              {t('projects.taskDetail.propertiesTitle', 'Task Properties')}
            </h3>

            {/* Status Selector */}
            <div className="space-y-1">
              <span className="text-xs text-gray-500 dark:text-gray-400">
                {t('projects.tasks.statusLabel', 'Status')}
              </span>
              <div>
                <TaskStatusControl
                  projectId={project.id}
                  task={task}
                  callerProjectRole={callerProjectRole}
                  isSystemAdmin={isSystemAdmin}
                  currentUserId={user?.id}
                  variant="detail"
                  onStatusChanged={() => {
                    refetchTask();
                  }}
                />
              </div>
            </div>

            {/* Assignee */}
            <div className="space-y-1 pt-2 border-t dark:border-gray-700">
              <span className="text-xs text-gray-500 dark:text-gray-400">
                {t('projects.tasks.create.fields.assignee', 'Assignee')}
              </span>
              {isEditMode ? (
                <select
                  value={formValues.assigneeUserId}
                  onChange={(e) =>
                    setFormValues((prev) => ({
                      ...prev,
                      assigneeUserId: e.target.value,
                    }))
                  }
                  className="w-full px-2.5 py-1.5 border rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100 focus:ring-2 focus:ring-primary focus:outline-none text-xs"
                >
                  <option value="">{t('projects.tasks.unassigned', 'Unassigned')}</option>
                  {eligibleAssignees.map((m: ProjectMember) => (
                    <option key={m.userId} value={m.userId}>
                      {m.user?.displayName || m.user?.username || m.userId} ({m.projectRole})
                    </option>
                  ))}
                </select>
              ) : (
                <div className="flex items-center gap-1.5 font-medium text-gray-900 dark:text-gray-100">
                  <User className="w-3.5 h-3.5 text-gray-400" />
                  <span>{getUserDisplayName(task.assigneeUserId)}</span>
                </div>
              )}
            </div>

            {/* Milestone */}
            <div className="space-y-1 pt-2 border-t dark:border-gray-700">
              <span className="text-xs text-gray-500 dark:text-gray-400">
                {t('projects.tasks.create.fields.milestone', 'Milestone')}
              </span>
              {isEditMode ? (
                <select
                  value={formValues.milestoneId}
                  onChange={(e) =>
                    setFormValues((prev) => ({
                      ...prev,
                      milestoneId: e.target.value,
                    }))
                  }
                  className="w-full px-2.5 py-1.5 border rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100 focus:ring-2 focus:ring-primary focus:outline-none text-xs"
                >
                  <option value="">{t('projects.tasks.create.noMilestone', 'No Milestone')}</option>
                  {(milestones || []).map((ms) => (
                    <option key={ms.id} value={ms.id}>
                      {ms.name}
                    </option>
                  ))}
                </select>
              ) : (
                <div className="flex items-center gap-1.5 font-medium text-gray-900 dark:text-gray-100">
                  <MilestoneIcon className="w-3.5 h-3.5 text-indigo-500" />
                  <span>
                    {task.milestone?.name ||
                      t('projects.tasks.create.noMilestone', 'No Milestone')}
                  </span>
                </div>
              )}
            </div>

            {/* Due Date */}
            <div className="space-y-1 pt-2 border-t dark:border-gray-700">
              <span className="text-xs text-gray-500 dark:text-gray-400">
                {t('projects.tasks.create.fields.dueDate', 'Due Date')}
              </span>
              {isEditMode ? (
                <div className="space-y-1">
                  <input
                    type="date"
                    value={formValues.dueDate}
                    onChange={(e) =>
                      setFormValues((prev) => ({ ...prev, dueDate: e.target.value }))
                    }
                    className="w-full px-2.5 py-1.5 border rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100 focus:ring-2 focus:ring-primary focus:outline-none text-xs"
                  />
                  {payloadResult.errors.dueDate && (
                    <p className="text-xs text-red-600 dark:text-red-400">
                      {payloadResult.errors.dueDate}
                    </p>
                  )}
                </div>
              ) : (
                <div
                  className={`flex items-center gap-1.5 font-medium ${
                    isOverdue
                      ? 'text-red-600 dark:text-red-400 font-semibold'
                      : 'text-gray-900 dark:text-gray-100'
                  }`}
                >
                  <Calendar className="w-3.5 h-3.5" />
                  <span>{formatDateDisplay(task.dueDate)}</span>
                  {isOverdue && (
                    <span className="px-1.5 py-0.2 bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200 rounded text-[10px] uppercase font-bold ml-1">
                      {t('projects.tasks.overdueBadge', 'Overdue')}
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* Estimated Hours */}
            <div className="space-y-1 pt-2 border-t dark:border-gray-700">
              <span className="text-xs text-gray-500 dark:text-gray-400">
                {t('projects.tasks.create.fields.estimatedHours', 'Estimated Hours')}
              </span>
              {isEditMode ? (
                <div className="space-y-1">
                  <input
                    type="number"
                    step="0.25"
                    min="0.25"
                    max="1000"
                    placeholder="e.g. 4.5"
                    value={formValues.estimatedHours}
                    onChange={(e) =>
                      setFormValues((prev) => ({
                        ...prev,
                        estimatedHours: e.target.value,
                      }))
                    }
                    className="w-full px-2.5 py-1.5 border rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100 focus:ring-2 focus:ring-primary focus:outline-none text-xs"
                  />
                  {payloadResult.errors.estimatedHours && (
                    <p className="text-xs text-red-600 dark:text-red-400">
                      {payloadResult.errors.estimatedHours}
                    </p>
                  )}
                </div>
              ) : (
                <div className="flex items-center gap-1.5 font-medium text-gray-900 dark:text-gray-100">
                  <Clock className="w-3.5 h-3.5 text-gray-400" />
                  <span>
                    {task.estimatedHours != null
                      ? `${task.estimatedHours}h`
                      : t('projects.detail.notSet', 'Not set')}
                  </span>
                </div>
              )}
            </div>

            {/* Created By & Date */}
            <div className="pt-2 border-t dark:border-gray-700 text-xs text-gray-500 dark:text-gray-400 space-y-1">
              <div>
                <span className="font-medium text-gray-700 dark:text-gray-300">
                  {t('projects.taskDetail.createdBy', 'Created by')}:
                </span>{' '}
                {getUserDisplayName(task.createdByUserId)}
              </div>
              <div>
                <span className="font-medium text-gray-700 dark:text-gray-300">
                  {t('projects.taskDetail.createdAt', 'Created on')}:
                </span>{' '}
                {formatDateDisplay(task.createdAt)}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      {showDeleteDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full p-6 space-y-4">
            <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
              <Trash2 className="w-5 h-5 text-red-600" />
              <span>{t('projects.taskDetail.deleteTitle', 'Delete Task')}</span>
            </h3>

            <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed">
              {t(
                'projects.taskDetail.deleteConfirmText',
                'This permanently deletes this task, its {{subtaskCount}} subtasks, its comments and all comments on its subtasks, and its dependency links. Logged hours are kept but lose their link to this task.',
                { subtaskCount: task.subtasks?.length ?? 0 }
              )}
            </p>

            <div className="flex justify-end gap-3 pt-3 border-t dark:border-gray-700">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowDeleteDialog(false)}
                disabled={deleteMutation.isPending}
              >
                {t('common.cancel', 'Cancel')}
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => deleteMutation.mutate()}
                disabled={deleteMutation.isPending}
              >
                {deleteMutation.isPending
                  ? t('common.deleting', 'Deleting...')
                  : t('projects.taskDetail.confirmDelete', 'Delete Permanently')}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Quick Add Subtask Modal */}
      {showAddSubtaskModal && (
        <CreateTaskModal
          project={project}
          isOpen={showAddSubtaskModal}
          onClose={() => setShowAddSubtaskModal(false)}
          defaultParentTaskId={task.id}
          onSuccess={() => {
            setShowAddSubtaskModal(false);
            refetchTask();
          }}
        />
      )}
    </div>
  );
}
