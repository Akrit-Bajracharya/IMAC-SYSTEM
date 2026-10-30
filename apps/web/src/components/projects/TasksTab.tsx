import React, { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import {
  List,
  Kanban,
  Plus,
  Filter,
  Calendar,
  AlertTriangle,
  Clock,
  MessageSquare,
  GitBranch,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  User,
  Milestone as MilestoneIcon,
} from 'lucide-react';
import {
  fetchProjectTasks,
  changeTaskStatus,
  fetchProjectMilestones,
  getProjectErrorInfo,
} from '../../api/projects.js';
import { Button } from '../ui/button.js';
import { TaskStatusBadge } from './TaskStatusBadge.js';
import { CreateTaskModal } from './CreateTaskModal.js';
import { getKathmanduToday, formatDateDisplay } from '../../lib/dateUtils.js';
import type {
  ProjectDetail,
  ProjectTask,
  TaskStatus,
  ProjectRole,
  AuthUser,
} from '../../types/index.js';

interface TasksTabProps {
  project: ProjectDetail;
  currentUser: AuthUser | null;
  callerProjectRole?: ProjectRole;
  isSystemAdmin: boolean;
}

const BOARD_COLUMNS: { id: TaskStatus; labelKey: string; defaultLabel: string }[] = [
  { id: 'todo', labelKey: 'projects.tasks.status.todo', defaultLabel: 'To Do' },
  { id: 'in_progress', labelKey: 'projects.tasks.status.inProgress', defaultLabel: 'In Progress' },
  { id: 'blocked', labelKey: 'projects.tasks.status.blocked', defaultLabel: 'Blocked' },
  { id: 'done', labelKey: 'projects.tasks.status.done', defaultLabel: 'Done' },
];

export function TasksTab({
  project,
  currentUser,
  callerProjectRole,
  isSystemAdmin,
}: TasksTabProps) {
  const { t } = useTranslation();

  // View state
  const [viewMode, setViewMode] = useState<'list' | 'board'>('list');
  const [createModalOpen, setCreateModalOpen] = useState(false);

  // Filter state
  const [filterStatus, setFilterStatus] = useState<string>('');
  const [filterAssignee, setFilterAssignee] = useState<string>('');
  const [filterMilestone, setFilterMilestone] = useState<string>('');
  const [topLevelOnly, setTopLevelOnly] = useState<boolean>(false);
  const [overdueOnly, setOverdueOnly] = useState<boolean>(false);

  // Pagination accumulation state
  const [tasks, setTasks] = useState<ProjectTask[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState<boolean>(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  // Mutation / Status change feedback
  const [statusActionTaskId, setStatusActionTaskId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<{ message: string; isConflict?: boolean } | null>(null);
  const [statusSuccessWarning, setStatusSuccessWarning] = useState<string[] | null>(null);

  // Milestone list for filters
  const { data: milestones } = useQuery({
    queryKey: ['projectMilestones', project.id],
    queryFn: () => fetchProjectMilestones(project.id),
    staleTime: 60000,
  });

  // Today in Kathmandu for overdue checks
  const kathmanduToday = useMemo(() => getKathmanduToday(), []);

  // Permission checks
  // Create task: manager, member, system_admin; never viewer
  const canCreateTask = useMemo(() => {
    if (isSystemAdmin || callerProjectRole === 'manager' || callerProjectRole === 'member') {
      return true;
    }
    return false;
  }, [isSystemAdmin, callerProjectRole]);

  // Initial tasks fetch
  const {
    isLoading,
    isError,
    error,
    refetch,
    isFetching,
  } = useQuery({
    queryKey: [
      'projectTasks',
      project.id,
      filterStatus,
      filterAssignee,
      filterMilestone,
      topLevelOnly,
      overdueOnly,
    ],
    queryFn: async () => {
      const res = await fetchProjectTasks(project.id, {
        limit: 50,
        status: filterStatus ? (filterStatus as TaskStatus) : undefined,
        assigneeUserId: filterAssignee || undefined,
        milestoneId: filterMilestone || undefined,
        topLevelOnly: topLevelOnly ? true : undefined,
        overdue: overdueOnly ? true : undefined,
      });
      setTasks(res.items);
      setNextCursor(res.nextCursor);
      setHasMore(res.hasMore);
      return res;
    },
    staleTime: 10000,
  });

  // Load more tasks with nextCursor
  const handleLoadMore = async () => {
    if (!nextCursor || isLoadingMore) return;
    setIsLoadingMore(true);
    setActionError(null);
    try {
      const res = await fetchProjectTasks(project.id, {
        limit: 50,
        cursor: nextCursor,
        status: filterStatus ? (filterStatus as TaskStatus) : undefined,
        assigneeUserId: filterAssignee || undefined,
        milestoneId: filterMilestone || undefined,
        topLevelOnly: topLevelOnly ? true : undefined,
        overdue: overdueOnly ? true : undefined,
      });
      setTasks((prev) => [...prev, ...res.items]);
      setNextCursor(res.nextCursor);
      setHasMore(res.hasMore);
    } catch (err: any) {
      const errInfo = getProjectErrorInfo(err);
      setActionError({ message: errInfo.message });
    } finally {
      setIsLoadingMore(false);
    }
  };

  // Rule from item 2 & 3:
  // "isSystemAdmin || callerProjectRole === 'manager' || (callerProjectRole === 'member' && task.assigneeUserId === currentUser.id)"
  const canMoveTask = (task: ProjectTask): boolean => {
    if (isSystemAdmin) return true;
    if (callerProjectRole === 'manager') return true;
    if (callerProjectRole === 'member' && currentUser && task.assigneeUserId === currentUser.id) {
      return true;
    }
    return false;
  };

  // Handle status transition
  const handleStatusChange = async (task: ProjectTask, targetStatus: TaskStatus) => {
    if (task.status === targetStatus) return;
    setStatusActionTaskId(task.id);
    setActionError(null);
    setStatusSuccessWarning(null);

    try {
      const res = await changeTaskStatus(project.id, task.id, targetStatus);
      // Update local task status
      setTasks((prev) =>
        prev.map((t) => (t.id === task.id ? { ...t, status: res.status } : t))
      );
      if (res.warnings && res.warnings.length > 0) {
        setStatusSuccessWarning(res.warnings);
      }
    } catch (err: any) {
      const errInfo = getProjectErrorInfo(err);
      if (errInfo.error === 'open_dependency') {
        setActionError({
          message: t(
            'projects.tasks.statusErrors.openDependency',
            'Cannot mark task done while prerequisite dependencies are open.'
          ),
        });
      } else if (errInfo.error === 'conflict_retry') {
        setActionError({
          message: t(
            'projects.tasks.statusErrors.conflictRetry',
            'Task was modified concurrently by another user. Please reload.'
          ),
          isConflict: true,
        });
      } else if (errInfo.status === 403) {
        setActionError({
          message: t(
            'projects.tasks.statusErrors.forbidden',
            'You do not have permission to change the status of this task.'
          ),
        });
      } else if (errInfo.status === 404) {
        setActionError({
          message: t('projects.tasks.statusErrors.notFound', 'Task or project not found.'),
        });
        refetch();
      } else {
        setActionError({ message: errInfo.message });
      }
    } finally {
      setStatusActionTaskId(null);
    }
  };

  // Group tasks by status for board view
  const boardColumns = useMemo(() => {
    const cols: Record<TaskStatus, ProjectTask[]> = {
      todo: [],
      in_progress: [],
      blocked: [],
      done: [],
    };
    for (const t of tasks) {
      if (cols[t.status]) {
        cols[t.status].push(t);
      } else {
        cols.todo.push(t);
      }
    }
    return cols;
  }, [tasks]);

  return (
    <div className="space-y-6">
      {/* Action / Warning Feedback Banner */}
      {actionError && (
        <div className="p-4 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg flex items-center justify-between text-sm text-red-700 dark:text-red-300">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <span>{actionError.message}</span>
          </div>
          {actionError.isConflict && (
            <Button size="sm" variant="outline" onClick={() => refetch()}>
              <RefreshCw className="w-4 h-4 mr-1.5" />
              {t('common.reload', 'Reload')}
            </Button>
          )}
        </div>
      )}

      {statusSuccessWarning && statusSuccessWarning.length > 0 && (
        <div className="p-4 bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-800 rounded-lg flex items-center gap-2 text-sm text-amber-800 dark:text-amber-300">
          <AlertTriangle className="w-5 h-5 flex-shrink-0" />
          <span>
            {t(
              'projects.tasks.statusWarnings.completedWithNotice',
              'Task status updated, but please note:'
            )}{' '}
            {statusSuccessWarning
              .map((w) =>
                w === 'open_dependency'
                  ? t('projects.tasks.statusWarnings.openDependency', 'Prerequisites are still open.')
                  : w === 'open_subtasks'
                  ? t('projects.tasks.statusWarnings.openSubtasks', 'Subtasks are still open.')
                  : w
              )
              .join(' ')}
          </span>
        </div>
      )}

      {/* Header controls: View Switcher, Filters Bar, Create Task button */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm">
        {/* Left: View toggle and active count */}
        <div className="flex items-center gap-3">
          <div className="inline-flex rounded-md shadow-sm border border-gray-200 dark:border-gray-700 p-0.5 bg-gray-50 dark:bg-gray-900">
            <button
              onClick={() => setViewMode('list')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded ${
                viewMode === 'list'
                  ? 'bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 shadow'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900'
              }`}
            >
              <List className="w-4 h-4" />
              <span>{t('projects.tasks.view.list', 'List')}</span>
            </button>
            <button
              onClick={() => setViewMode('board')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded ${
                viewMode === 'board'
                  ? 'bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 shadow'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900'
              }`}
            >
              <Kanban className="w-4 h-4" />
              <span>{t('projects.tasks.view.board', 'Board')}</span>
            </button>
          </div>

          <span className="text-xs text-gray-500 dark:text-gray-400">
            {t('projects.tasks.showingCount', 'Showing {{count}} tasks', { count: tasks.length })}
          </span>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-2">
          {canCreateTask && (
            <Button onClick={() => setCreateModalOpen(true)} className="flex items-center gap-1.5">
              <Plus className="w-4 h-4" />
              <span>{t('projects.tasks.newTask', 'New Task')}</span>
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw className={`w-4 h-4 ${isFetching ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {/* Filters Row */}
      <div className="bg-gray-50 dark:bg-gray-850 p-4 rounded-lg border border-gray-200 dark:border-gray-700 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 text-xs">
        {/* Status filter */}
        <div>
          <label className="block text-gray-700 dark:text-gray-300 font-medium mb-1">
            {t('projects.tasks.filters.status', 'Status')}
          </label>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="w-full px-2.5 py-1.5 rounded border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 text-xs"
          >
            <option value="">{t('projects.tasks.filters.allStatuses', 'All Statuses')}</option>
            <option value="todo">{t('projects.tasks.status.todo', 'To Do')}</option>
            <option value="in_progress">{t('projects.tasks.status.inProgress', 'In Progress')}</option>
            <option value="blocked">{t('projects.tasks.status.blocked', 'Blocked')}</option>
            <option value="done">{t('projects.tasks.status.done', 'Done')}</option>
          </select>
        </div>

        {/* Assignee filter */}
        <div>
          <label className="block text-gray-700 dark:text-gray-300 font-medium mb-1">
            {t('projects.tasks.filters.assignee', 'Assignee')}
          </label>
          <select
            value={filterAssignee}
            onChange={(e) => setFilterAssignee(e.target.value)}
            className="w-full px-2.5 py-1.5 rounded border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 text-xs"
          >
            <option value="">{t('projects.tasks.filters.allAssignees', 'All Assignees')}</option>
            {(project.members || []).map((m) => (
              <option key={m.userId} value={m.userId}>
                {m.user?.displayName || m.user?.username || m.userId}
              </option>
            ))}
          </select>
        </div>

        {/* Milestone filter */}
        <div>
          <label className="block text-gray-700 dark:text-gray-300 font-medium mb-1">
            {t('projects.tasks.filters.milestone', 'Milestone')}
          </label>
          <select
            value={filterMilestone}
            onChange={(e) => setFilterMilestone(e.target.value)}
            className="w-full px-2.5 py-1.5 rounded border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 text-xs"
          >
            <option value="">{t('projects.tasks.filters.allMilestones', 'All Milestones')}</option>
            {(milestones || []).map((ms) => (
              <option key={ms.id} value={ms.id}>
                {ms.name}
              </option>
            ))}
          </select>
        </div>

        {/* Top-level only checkbox */}
        <div className="flex items-center pt-5">
          <label className="flex items-center gap-2 cursor-pointer text-gray-700 dark:text-gray-300">
            <input
              type="checkbox"
              checked={topLevelOnly}
              onChange={(e) => setTopLevelOnly(e.target.checked)}
              className="rounded border-gray-300 text-primary focus:ring-primary"
            />
            <span>{t('projects.tasks.filters.topLevelOnly', 'Top-level only')}</span>
          </label>
        </div>

        {/* Overdue only checkbox */}
        <div className="flex items-center pt-5">
          <label className="flex items-center gap-2 cursor-pointer text-gray-700 dark:text-gray-300">
            <input
              type="checkbox"
              checked={overdueOnly}
              onChange={(e) => setOverdueOnly(e.target.checked)}
              className="rounded border-gray-300 text-primary focus:ring-primary"
            />
            <span className="text-red-600 dark:text-red-400 font-medium">
              {t('projects.tasks.filters.overdueOnly', 'Overdue only')}
            </span>
          </label>
        </div>
      </div>

      {/* Loading state */}
      {isLoading && (
        <div className="flex items-center justify-center p-12 bg-white dark:bg-gray-800 rounded-lg border dark:border-gray-700">
          <RefreshCw className="w-6 h-6 animate-spin text-gray-400 mr-2" />
          <span className="text-sm text-gray-500">{t('projects.tasks.loading', 'Loading tasks...')}</span>
        </div>
      )}

      {/* Error state */}
      {isError && (
        <div className="p-8 text-center bg-white dark:bg-gray-800 rounded-lg border border-red-200 dark:border-red-900">
          <AlertCircle className="w-8 h-8 mx-auto text-red-500 mb-2" />
          <h3 className="font-semibold text-gray-900 dark:text-gray-100">
            {t('projects.tasks.loadError', 'Failed to load tasks')}
          </h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 mb-4">
            {error instanceof Error ? error.message : t('common.error', 'An error occurred')}
          </p>
          <Button size="sm" onClick={() => refetch()}>
            {t('common.retry', 'Retry')}
          </Button>
        </div>
      )}

      {/* Empty state */}
      {!isLoading && !isError && tasks.length === 0 && (
        <div className="p-12 text-center bg-white dark:bg-gray-800 rounded-lg border border-dashed border-gray-300 dark:border-gray-700">
          <GitBranch className="w-10 h-10 mx-auto text-gray-400 mb-3" />
          <h3 className="text-base font-medium text-gray-900 dark:text-gray-100">
            {t('projects.tasks.emptyTitle', 'No tasks found')}
          </h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 max-w-sm mx-auto mb-4">
            {t(
              'projects.tasks.emptyDesc',
              'There are no tasks matching your selected filters. Create a new task or adjust your filters.'
            )}
          </p>
          {canCreateTask && (
            <Button size="sm" onClick={() => setCreateModalOpen(true)}>
              <Plus className="w-4 h-4 mr-1.5" />
              {t('projects.tasks.newTask', 'New Task')}
            </Button>
          )}
        </div>
      )}

      {/* ── View Mode: LIST VIEW ────────────────────────────────────────────── */}
      {!isLoading && !isError && tasks.length > 0 && viewMode === 'list' && (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
          <div className="divide-y divide-gray-100 dark:divide-gray-700">
            {tasks.map((task) => {
              const isOverdue =
                Boolean(task.dueDate) &&
                task.dueDate! < kathmanduToday &&
                task.status !== 'done';

              const member = (project.members || []).find((m) => m.userId === task.assigneeUserId);
              const assigneeName = member?.user?.displayName || member?.user?.username || task.assigneeUser?.displayName;

              return (
                <div
                  key={task.id}
                  className="p-4 hover:bg-gray-50/75 dark:hover:bg-gray-750/50 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  {/* Left: Title, subtask badge, milestone, status */}
                  <div className="space-y-1.5 min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <TaskStatusBadge status={task.status} />
                      <span className="font-medium text-sm text-gray-900 dark:text-gray-100 truncate">
                        {task.title}
                      </span>
                      {task.parentTaskId && (
                        <span className="px-2 py-0.5 rounded text-[10px] bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
                          {t('projects.tasks.subtask', 'Subtask')}
                        </span>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-500 dark:text-gray-400">
                      {/* Assignee */}
                      <span className="flex items-center gap-1">
                        <User className="w-3.5 h-3.5" />
                        {assigneeName ? (
                          <span>{assigneeName}</span>
                        ) : (
                          <span className="italic">{t('projects.tasks.unassigned', 'Unassigned')}</span>
                        )}
                      </span>

                      {/* Milestone */}
                      {task.milestone && (
                        <span className="flex items-center gap-1 text-indigo-600 dark:text-indigo-400">
                          <MilestoneIcon className="w-3.5 h-3.5" />
                          <span>{task.milestone.name}</span>
                        </span>
                      )}

                      {/* Due Date & Overdue */}
                      {task.dueDate && (
                        <span
                          className={`flex items-center gap-1 ${
                            isOverdue
                              ? 'text-red-600 dark:text-red-400 font-semibold'
                              : ''
                          }`}
                        >
                          <Calendar className="w-3.5 h-3.5" />
                          <span>{formatDateDisplay(task.dueDate)}</span>
                          {isOverdue && (
                            <span className="px-1.5 py-0.2 bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200 rounded text-[10px] uppercase font-bold ml-1">
                              {t('projects.tasks.overdueBadge', 'Overdue')}
                            </span>
                          )}
                        </span>
                      )}

                      {/* Estimated hours */}
                      {task.estimatedHours != null && (
                        <span className="flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5" />
                          <span>{task.estimatedHours}h</span>
                        </span>
                      )}

                      {/* Counts */}
                      {task._count?.subtasks ? (
                        <span className="flex items-center gap-1">
                          <GitBranch className="w-3.5 h-3.5" />
                          <span>{task._count.subtasks}</span>
                        </span>
                      ) : null}

                      {task._count?.comments ? (
                        <span className="flex items-center gap-1">
                          <MessageSquare className="w-3.5 h-3.5" />
                          <span>{task._count.comments}</span>
                        </span>
                      ) : null}
                    </div>
                  </div>

                  {/* Right: "Move to" status transition control */}
                  {canMoveTask(task) && (
                    <div className="flex items-center gap-1.5 flex-shrink-0 self-start sm:self-center">
                      <span className="text-xs text-gray-500 mr-1 hidden sm:inline">
                        {t('projects.tasks.moveTo', 'Move to')}:
                      </span>
                      <select
                        value={task.status}
                        onChange={(e) => handleStatusChange(task, e.target.value as TaskStatus)}
                        disabled={statusActionTaskId === task.id}
                        className="px-2.5 py-1 text-xs border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100 focus:ring-1 focus:ring-primary focus:outline-none"
                      >
                        <option value="todo">{t('projects.tasks.status.todo', 'To Do')}</option>
                        <option value="in_progress">{t('projects.tasks.status.inProgress', 'In Progress')}</option>
                        <option value="blocked">{t('projects.tasks.status.blocked', 'Blocked')}</option>
                        <option value="done">{t('projects.tasks.status.done', 'Done')}</option>
                      </select>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── View Mode: BOARD VIEW ───────────────────────────────────────────── */}
      {!isLoading && !isError && tasks.length > 0 && viewMode === 'board' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {BOARD_COLUMNS.map((col) => {
            const colTasks = boardColumns[col.id] || [];

            return (
              <div
                key={col.id}
                className="bg-gray-50 dark:bg-gray-850 rounded-lg p-3 border border-gray-200 dark:border-gray-700 flex flex-col"
              >
                {/* Column header - NO fabricated totals, only label */}
                <div className="flex items-center justify-between pb-3 mb-3 border-b border-gray-200 dark:border-gray-700">
                  <span className="font-semibold text-sm text-gray-900 dark:text-gray-100">
                    {t(col.labelKey, col.defaultLabel)}
                  </span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 font-medium">
                    {colTasks.length}
                  </span>
                </div>

                {/* Column Cards */}
                <div className="space-y-3 flex-1 overflow-y-auto max-h-[700px] pr-1">
                  {colTasks.length === 0 ? (
                    <div className="text-center py-8 text-xs text-gray-400 italic">
                      {t('projects.tasks.board.emptyColumn', 'No tasks')}
                    </div>
                  ) : (
                    colTasks.map((task) => {
                      const isOverdue =
                        Boolean(task.dueDate) &&
                        task.dueDate! < kathmanduToday &&
                        task.status !== 'done';

                      const member = (project.members || []).find((m) => m.userId === task.assigneeUserId);
                      const assigneeName = member?.user?.displayName || member?.user?.username || task.assigneeUser?.displayName;

                      return (
                        <div
                          key={task.id}
                          className="bg-white dark:bg-gray-800 p-3 rounded-md border border-gray-200 dark:border-gray-700 shadow-sm space-y-2 hover:border-gray-300 dark:hover:border-gray-600 transition-colors"
                        >
                          <div className="font-medium text-sm text-gray-900 dark:text-gray-100 line-clamp-2">
                            {task.title}
                          </div>

                          {task.milestone && (
                            <div className="flex items-center gap-1 text-[11px] text-indigo-600 dark:text-indigo-400">
                              <MilestoneIcon className="w-3 h-3 flex-shrink-0" />
                              <span className="truncate">{task.milestone.name}</span>
                            </div>
                          )}

                          <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-xs text-gray-500 dark:text-gray-400 border-t border-gray-100 dark:border-gray-700">
                            {/* Assignee */}
                            <span className="flex items-center gap-1 truncate max-w-[120px]">
                              <User className="w-3 h-3 flex-shrink-0" />
                              <span className="truncate">
                                {assigneeName || t('projects.tasks.unassigned', 'Unassigned')}
                              </span>
                            </span>

                            {/* Due Date & Overdue */}
                            {task.dueDate && (
                              <span
                                className={`flex items-center gap-1 ${
                                  isOverdue ? 'text-red-600 dark:text-red-400 font-semibold' : ''
                                }`}
                              >
                                <Calendar className="w-3 h-3" />
                                <span>{task.dueDate}</span>
                              </span>
                            )}
                          </div>

                          {/* "Move to" status transition control */}
                          {canMoveTask(task) && (
                            <div className="pt-2 border-t border-gray-100 dark:border-gray-700">
                              <div className="flex items-center justify-between gap-1 text-[11px]">
                                <span className="text-gray-500">
                                  {t('projects.tasks.moveTo', 'Move to')}:
                                </span>
                                <select
                                  value={task.status}
                                  onChange={(e) => handleStatusChange(task, e.target.value as TaskStatus)}
                                  disabled={statusActionTaskId === task.id}
                                  className="px-2 py-0.5 text-xs border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100 focus:ring-1 focus:ring-primary focus:outline-none"
                                >
                                  <option value="todo">{t('projects.tasks.status.todo', 'To Do')}</option>
                                  <option value="in_progress">{t('projects.tasks.status.inProgress', 'In Progress')}</option>
                                  <option value="blocked">{t('projects.tasks.status.blocked', 'Blocked')}</option>
                                  <option value="done">{t('projects.tasks.status.done', 'Done')}</option>
                                </select>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Visible "Showing N tasks, load more" note & button on both List and Board */}
      {!isLoading && !isError && tasks.length > 0 && (
        <div className="p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-200 dark:border-gray-700 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-gray-600 dark:text-gray-400">
          <span>
            {t(
              'projects.tasks.showingNote',
              'Showing {{loaded}} loaded tasks. {{moreNote}}',
              {
                loaded: tasks.length,
                moreNote: hasMore
                  ? t('projects.tasks.moreAvailable', 'Additional tasks are available.')
                  : t('projects.tasks.allLoaded', 'All tasks loaded.'),
              }
            )}
          </span>

          {hasMore && (
            <Button
              size="sm"
              variant="outline"
              onClick={handleLoadMore}
              disabled={isLoadingMore}
              className="flex items-center gap-1.5"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoadingMore ? 'animate-spin' : ''}`} />
              <span>
                {isLoadingMore
                  ? t('common.loading', 'Loading...')
                  : t('projects.tasks.loadMore', 'Load More Tasks')}
              </span>
            </Button>
          )}
        </div>
      )}

      {/* Create Task Modal */}
      {createModalOpen && (
        <CreateTaskModal
          project={project}
          isOpen={createModalOpen}
          onClose={() => setCreateModalOpen(false)}
          onSuccess={() => {
            setCreateModalOpen(false);
            refetch();
          }}
        />
      )}
    </div>
  );
}
