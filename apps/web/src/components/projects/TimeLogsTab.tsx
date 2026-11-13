import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import {
  Clock,
  Plus,
  Edit2,
  Trash2,
  Filter,
  AlertCircle,
  RefreshCw,
  Info,
  Calendar,
  User as UserIcon,
} from 'lucide-react';
import { Button } from '../ui/button.js';
import { Alert, AlertDescription } from '../ui/alert.js';
import { ConfirmationModal } from '../common/ConfirmationModal.js';
import {
  fetchProjectTimeLogs,
  createProjectTimeLog,
  patchProjectTimeLog,
  deleteProjectTimeLog,
  fetchAllTasksForProject,
} from '../../api/projects.js';
import {
  canLogTime,
  canSeeTimeTab,
  canEditTimeLog,
  canDeleteTimeLog,
  canFilterTimeLogsByUser,
} from '../../lib/timeLogPermissions.js';
import {
  sumTimeLogHours,
  groupTimeLogsByDate,
} from '../../lib/timeLogTotals.js';
import {
  getTimeLogDateMin,
  getTimeLogDateMax,
  validateAndBuildCreatePayload,
  validateAndBuildPatchPayload,
} from '../../lib/timeLogPayload.js';
import { mapTimeLogError } from '../../lib/timeLogErrorHelpers.js';
import {
  formatDateDisplay,
  formatHours,
  getKathmanduToday,
  toDateInputValue,
  extractDatePart,
} from '../../lib/dateUtils.js';
import { getTaskDetailPath } from '../../lib/taskLinks.js';
import type {
  ProjectDetail,
  ProjectTimeLog,
  ProjectRole,
  User,
  ProjectTask,
} from '../../types/index.js';

interface TimeLogsTabProps {
  project: ProjectDetail;
  currentUser: User | null;
  callerProjectRole?: ProjectRole;
  isSystemAdmin: boolean;
}

export function TimeLogsTab({
  project,
  currentUser,
  callerProjectRole,
  isSystemAdmin,
}: TimeLogsTabProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const isAllowedToSee = canSeeTimeTab(currentUser, project);
  const isAllowedToLog = canLogTime(currentUser, project);
  const canFilterUsers = canFilterTimeLogsByUser(currentUser, callerProjectRole);

  // Filter states
  const [selectedTaskId, setSelectedTaskId] = useState<string>('');
  const [selectedUserId, setSelectedUserId] = useState<string>('');

  // Modals state
  const [logModalOpen, setLogModalOpen] = useState(false);
  const [editingLog, setEditingLog] = useState<ProjectTimeLog | null>(null);
  const [logToDelete, setLogToDelete] = useState<ProjectTimeLog | null>(null);

  // Form states
  const [formWorkDate, setFormWorkDate] = useState<string>(getKathmanduToday());
  const [formHours, setFormHours] = useState<string>('1.00');
  const [formTaskId, setFormTaskId] = useState<string>('');
  const [formNote, setFormNote] = useState<string>('');
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [cursorErrorNotice, setCursorErrorNotice] = useState<string | null>(null);

  // Query: load tasks for the project (used in picker & filters)
  const { data: projectTasks = [] } = useQuery<ProjectTask[]>({
    queryKey: ['projectTasksAll', project.id],
    queryFn: () => fetchAllTasksForProject(project.id),
    enabled: isAllowedToSee,
    staleTime: 0,
  });

  // Query: Infinite project time logs
  const {
    data,
    isLoading,
    isError,
    error,
    refetch,
    hasNextPage,
    fetchNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: [
      'projectTimeLogs',
      project.id,
      {
        taskId: selectedTaskId || undefined,
        userId: selectedUserId || undefined,
      },
    ],
    queryFn: async ({ pageParam }) => {
      try {
        return await fetchProjectTimeLogs(project.id, {
          limit: 30,
          cursor: pageParam as string | undefined,
          taskId: selectedTaskId || undefined,
          userId: selectedUserId || undefined,
        });
      } catch (err: any) {
        if (err?.response?.data?.error === 'invalid_cursor') {
          setCursorErrorNotice(t('projects.timeLogs.errors.invalidCursor', 'Invalid cursor. Refreshed to first page.'));
          return await fetchProjectTimeLogs(project.id, {
            limit: 30,
            taskId: selectedTaskId || undefined,
            userId: selectedUserId || undefined,
          });
        }
        throw err;
      }
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => (lastPage.hasMore ? lastPage.nextCursor ?? undefined : undefined),
    enabled: isAllowedToSee,
    staleTime: 0,
  });

  if (!isAllowedToSee) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          {t('projects.timeLogs.forbiddenView', 'You do not have permission to view project time logs.')}
        </AlertDescription>
      </Alert>
    );
  }

  // Invalidate all related keys
  const invalidateAllTimeQueries = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['projectTimeLogs', project.id] }),
      queryClient.invalidateQueries({ queryKey: ['taskTimeLogs', project.id] }),
      queryClient.invalidateQueries({ queryKey: ['projectWorkload', project.id] }),
      queryClient.invalidateQueries({ queryKey: ['projectSummary', project.id] }),
    ]);
  };

  const handleOpenCreateModal = () => {
    setFormWorkDate(getKathmanduToday());
    setFormHours('1.00');
    setFormTaskId('');
    setFormNote('');
    setFormError(null);
    setLogModalOpen(true);
  };

  const handleOpenEditModal = (log: ProjectTimeLog) => {
    setEditingLog(log);
    setFormWorkDate(toDateInputValue(log.workDate));
    setFormHours(String(log.hours));
    setFormTaskId(log.taskId ?? '');
    setFormNote(log.note ?? '');
    setFormError(null);
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const validation = validateAndBuildCreatePayload({
      workDate: formWorkDate,
      hours: formHours,
      taskId: formTaskId || null,
      note: formNote || null,
    });

    if (!validation.ok) {
      if (validation.error === 'invalid_date_range') {
        setFormError(t('projects.timeLogs.errors.invalidDateRange', 'Date must be within 90 days past and 1 day future.'));
      } else if (validation.error === 'hours_quarter_increment') {
        setFormError(t('projects.timeLogs.errors.quarterHourIncrement', 'Hours must be entered in 0.25 (15 min) increments.'));
      } else if (validation.error === 'hours_must_be_positive') {
        setFormError(t('projects.timeLogs.errors.positiveHours', 'Hours must be greater than 0.'));
      } else if (validation.error === 'hours_cannot_exceed_24') {
        setFormError(t('projects.timeLogs.errors.maxHours', 'Hours cannot exceed 24.'));
      } else if (validation.error === 'note_too_long') {
        setFormError(t('projects.timeLogs.errors.noteTooLong', 'Note must be 5000 characters or less.'));
      } else {
        setFormError(t('projects.timeLogs.errors.validationError', 'Please check entered values.'));
      }
      return;
    }

    setIsSubmitting(true);
    try {
      await createProjectTimeLog(project.id, validation.payload);
      setLogModalOpen(false);
      await invalidateAllTimeQueries();
    } catch (err: any) {
      setFormError(mapTimeLogError(err, t));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingLog) return;
    setFormError(null);

    const validation = validateAndBuildPatchPayload(
      {
        taskId: editingLog.taskId,
        workDate: editingLog.workDate,
        hours: editingLog.hours,
        note: editingLog.note,
      },
      {
        taskId: formTaskId || null,
        workDate: formWorkDate,
        hours: formHours,
        note: formNote || null,
      }
    );

    if (!validation.ok) {
      if (validation.error === 'no_changes') {
        setEditingLog(null);
        return;
      }
      if (validation.error === 'invalid_date_range') {
        setFormError(t('projects.timeLogs.errors.invalidDateRange', 'Date must be within 90 days past and 1 day future.'));
      } else if (validation.error === 'hours_quarter_increment') {
        setFormError(t('projects.timeLogs.errors.quarterHourIncrement', 'Hours must be entered in 0.25 (15 min) increments.'));
      } else if (validation.error === 'hours_must_be_positive') {
        setFormError(t('projects.timeLogs.errors.positiveHours', 'Hours must be greater than 0.'));
      } else if (validation.error === 'hours_cannot_exceed_24') {
        setFormError(t('projects.timeLogs.errors.maxHours', 'Hours cannot exceed 24.'));
      } else if (validation.error === 'note_too_long') {
        setFormError(t('projects.timeLogs.errors.noteTooLong', 'Note must be 5000 characters or less.'));
      } else {
        setFormError(t('projects.timeLogs.errors.validationError', 'Please check entered values.'));
      }
      return;
    }

    setIsSubmitting(true);
    try {
      await patchProjectTimeLog(project.id, editingLog.id, validation.payload);
      setEditingLog(null);
      await invalidateAllTimeQueries();
    } catch (err: any) {
      setFormError(mapTimeLogError(err, t));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!logToDelete) return;
    setIsSubmitting(true);
    try {
      await deleteProjectTimeLog(project.id, logToDelete.id);
      setLogToDelete(null);
      await invalidateAllTimeQueries();
    } catch (err: any) {
      alert(mapTimeLogError(err, t));
    } finally {
      setIsSubmitting(false);
    }
  };

  // Flatten items
  const allLogs: ProjectTimeLog[] = data?.pages.flatMap((page) => page.items) ?? [];
  const loadedHoursTotal = sumTimeLogHours(allLogs);
  const groupedLogs = groupTimeLogsByDate(allLogs);

  return (
    <div className="space-y-6">
      {/* Header and Log Time Action */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight flex items-center gap-2">
            <Clock className="h-5 w-5 text-primary" />
            {t('projects.timeLogs.title', 'Project Time Logs')}
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            {t('projects.timeLogs.subtitle', 'Track and review hours spent on project tasks.')}
          </p>
        </div>

        <div>
          {isAllowedToLog ? (
            <Button
              size="sm"
              onClick={handleOpenCreateModal}
              className="flex items-center gap-1.5 self-start sm:self-auto"
            >
              <Plus className="h-4 w-4" />
              {t('projects.timeLogs.logTimeBtn', 'Log Time')}
            </Button>
          ) : isSystemAdmin ? (
            <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-200 text-xs px-3 py-2 rounded-lg flex items-center gap-2">
              <Info className="h-4 w-4 shrink-0 text-amber-600" />
              <span>{t('projects.timeLogs.adminNoMembershipNotice', 'Add yourself as a project member to log time.')}</span>
            </div>
          ) : null}
        </div>
      </div>

      {cursorErrorNotice && (
        <Alert className="bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-200">
          <Info className="h-4 w-4 text-amber-600" />
          <AlertDescription className="flex items-center justify-between">
            <span>{cursorErrorNotice}</span>
            <button
              onClick={() => setCursorErrorNotice(null)}
              className="text-xs font-semibold opacity-70 hover:opacity-100 ml-4"
            >
              ✕
            </button>
          </AlertDescription>
        </Alert>
      )}

      {/* Filters Bar */}
      <div className="bg-card border rounded-xl p-4 flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
          <Filter className="h-4 w-4" />
          <span>{t('common.filters', 'Filters')}:</span>
        </div>

        {/* Task Filter */}
        <div className="flex items-center gap-2">
          <label htmlFor="timeFilterTask" className="text-xs font-medium text-muted-foreground">
            {t('projects.timeLogs.filterTask', 'Task')}:
          </label>
          <select
            id="timeFilterTask"
            value={selectedTaskId}
            onChange={(e) => setSelectedTaskId(e.target.value)}
            className="text-xs border rounded-md px-2.5 py-1.5 bg-background text-foreground"
          >
            <option value="">{t('projects.timeLogs.allTasks', 'All Tasks')}</option>
            {projectTasks.map((t) => (
              <option key={t.id} value={t.id}>
                {t.title}
              </option>
            ))}
          </select>
        </div>

        {/* Person Filter (Managers & Admin only) */}
        {canFilterUsers && (
          <div className="flex items-center gap-2">
            <label htmlFor="timeFilterPerson" className="text-xs font-medium text-muted-foreground">
              {t('projects.timeLogs.filterPerson', 'Person')}:
            </label>
            <select
              id="timeFilterPerson"
              value={selectedUserId}
              onChange={(e) => setSelectedUserId(e.target.value)}
              className="text-xs border rounded-md px-2.5 py-1.5 bg-background text-foreground"
            >
              <option value="">{t('projects.timeLogs.allMembers', 'All Members')}</option>
              {project.members.map((m) => (
                <option key={m.userId} value={m.userId}>
                  {m.user?.displayName || m.userId}
                </option>
              ))}
            </select>
          </div>
        )}

        {(selectedTaskId || selectedUserId) && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setSelectedTaskId('');
              setSelectedUserId('');
            }}
            className="text-xs h-7 px-2"
          >
            {t('common.reset', 'Reset')}
          </Button>
        )}

        {/* Total of loaded rows */}
        <div className="ml-auto text-xs font-medium text-muted-foreground bg-muted/40 px-3 py-1.5 rounded-lg">
          {hasNextPage
            ? t('projects.timeLogs.totalLoadedRows', {
                defaultValue: 'Total of loaded rows: {{total}}',
                total: formatHours(loadedHoursTotal),
              })
            : t('projects.timeLogs.totalHours', {
                defaultValue: 'Total: {{total}}',
                total: formatHours(loadedHoursTotal),
              })}
        </div>
      </div>

      {/* Main Content Area */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center p-12 text-muted-foreground space-y-3">
          <RefreshCw className="h-6 w-6 animate-spin text-primary" />
          <p className="text-xs">{t('common.loading', 'Loading time logs...')}</p>
        </div>
      ) : isError ? (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="flex items-center justify-between">
            <span>{mapTimeLogError(error, t)}</span>
            <Button size="sm" variant="outline" onClick={() => refetch()} className="ml-4">
              {t('common.retry', 'Retry')}
            </Button>
          </AlertDescription>
        </Alert>
      ) : allLogs.length === 0 ? (
        <div className="border border-dashed rounded-xl p-12 text-center bg-card/40 space-y-3">
          <Clock className="h-8 w-8 mx-auto text-muted-foreground opacity-60" />
          <h3 className="font-semibold text-sm">{t('projects.timeLogs.noLogsTitle', 'No Time Logs Found')}</h3>
          <p className="text-xs text-muted-foreground max-w-sm mx-auto">
            {selectedTaskId || selectedUserId
              ? t('projects.timeLogs.noLogsFiltered', 'No time logs match your selected filters.')
              : t('projects.timeLogs.noLogsDesc', 'No time has been logged on this project yet.')}
          </p>
          {isAllowedToLog && !selectedTaskId && !selectedUserId && (
            <Button size="sm" onClick={handleOpenCreateModal} className="mt-2">
              <Plus className="h-4 w-4 mr-1.5" />
              {t('projects.timeLogs.logFirstTime', 'Log First Time Entry')}
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          {groupedLogs.map((group) => (
            <div key={group.dateKey} className="border rounded-xl bg-card overflow-hidden">
              {/* Date Header */}
              <div className="bg-muted/40 px-4 py-2.5 border-b flex items-center justify-between text-xs">
                <div className="flex items-center gap-2 font-semibold">
                  <Calendar className="h-3.5 w-3.5 text-primary" />
                  <span>{formatDateDisplay(group.dateKey)}</span>
                </div>
                <div className="font-mono font-semibold text-primary">
                  {formatHours(group.totalHours)}
                </div>
              </div>

              {/* Rows List */}
              <div className="divide-y text-xs">
                {group.items.map((log) => {
                  const memberObj = project.members.find((m) => m.userId === log.userId);
                  const personName =
                    log.user?.displayName ||
                    memberObj?.user?.displayName ||
                    t('projects.timeLogs.formerMember', 'Former member');

                  const canEdit = canEditTimeLog(currentUser, log, callerProjectRole);
                  const canDelete = canDeleteTimeLog(currentUser, log, callerProjectRole);

                  return (
                    <div
                      key={log.id}
                      className="p-4 flex flex-col sm:flex-row sm:items-start justify-between gap-3 hover:bg-muted/20 transition"
                    >
                      <div className="space-y-1.5 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-semibold flex items-center gap-1.5">
                            <UserIcon className="h-3.5 w-3.5 text-muted-foreground" />
                            {personName}
                          </span>

                          <span className="text-muted-foreground">•</span>

                          {log.task ? (
                            <a
                              href={getTaskDetailPath(project.id, log.task.id, currentUser?.systemRole)}
                              className="font-medium text-primary hover:underline"
                            >
                              {log.task.title}
                            </a>
                          ) : (
                            <span className="text-muted-foreground italic">
                              {t('projects.timeLogs.generalTime', 'General project time')}
                            </span>
                          )}
                        </div>

                        {log.note && (
                          <p className="text-xs text-muted-foreground whitespace-pre-wrap pl-5 border-l-2 border-muted">
                            {log.note}
                          </p>
                        )}
                      </div>

                      <div className="flex items-center gap-3 self-end sm:self-center shrink-0">
                        <span className="font-mono font-bold text-sm bg-muted/50 px-2.5 py-1 rounded">
                          {formatHours(log.hours)}
                        </span>

                        {(canEdit || canDelete) && (
                          <div className="flex items-center gap-1">
                            {canEdit && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleOpenEditModal(log)}
                                className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
                                title={t('common.edit', 'Edit')}
                              >
                                <Edit2 className="h-3.5 w-3.5" />
                              </Button>
                            )}
                            {canDelete && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setLogToDelete(log)}
                                className="h-7 w-7 p-0 text-destructive hover:bg-destructive/10"
                                title={t('common.delete', 'Delete')}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}

          {/* Load More Pagination Button */}
          {hasNextPage && (
            <div className="text-center pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => fetchNextPage()}
                disabled={isFetchingNextPage}
                className="gap-2"
              >
                {isFetchingNextPage && <RefreshCw className="h-3.5 w-3.5 animate-spin" />}
                {t('projects.timeLogs.loadMore', 'Load older time logs')}
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Log Time Create Modal */}
      {logModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-card border rounded-xl max-w-md w-full p-6 shadow-xl space-y-4">
            <h3 className="text-lg font-bold">{t('projects.timeLogs.logTimeTitle', 'Log Time')}</h3>

            {formError && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{formError}</AlertDescription>
              </Alert>
            )}

            <form onSubmit={handleCreateSubmit} className="space-y-4 text-xs">
              <div>
                <label className="font-medium block mb-1">
                  {t('projects.timeLogs.workDate', 'Date (Asia/Kathmandu)')} *
                </label>
                <input
                  type="date"
                  required
                  min={getTimeLogDateMin()}
                  max={getTimeLogDateMax()}
                  value={formWorkDate}
                  onChange={(e) => setFormWorkDate(e.target.value)}
                  className="w-full border rounded-md px-3 py-2 bg-background"
                />
              </div>

              <div>
                <label className="font-medium block mb-1">
                  {t('projects.timeLogs.hours', 'Hours (0.25 increments, max 24)')} *
                </label>
                <input
                  type="number"
                  step="0.25"
                  min="0.25"
                  max="24"
                  required
                  value={formHours}
                  onChange={(e) => setFormHours(e.target.value)}
                  className="w-full border rounded-md px-3 py-2 bg-background font-mono"
                />
              </div>

              <div>
                <label className="font-medium block mb-1">
                  {t('projects.timeLogs.taskOptional', 'Task (Optional)')}
                </label>
                <select
                  value={formTaskId}
                  onChange={(e) => setFormTaskId(e.target.value)}
                  className="w-full border rounded-md px-3 py-2 bg-background"
                >
                  <option value="">{t('projects.timeLogs.generalProjectTime', '— General Project Time —')}</option>
                  {projectTasks.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.title}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="font-medium">
                    {t('projects.timeLogs.noteOptional', 'Note (Optional)')}
                  </label>
                  <span className="text-[10px] text-muted-foreground">{formNote.length} / 5000</span>
                </div>
                <textarea
                  rows={3}
                  maxLength={5000}
                  value={formNote}
                  onChange={(e) => setFormNote(e.target.value)}
                  placeholder={t('projects.timeLogs.notePlaceholder', 'Describe what was accomplished...')}
                  className="w-full border rounded-md px-3 py-2 bg-background resize-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setLogModalOpen(false)}
                  disabled={isSubmitting}
                >
                  {t('common.cancel', 'Cancel')}
                </Button>
                <Button type="submit" disabled={isSubmitting} className="gap-2">
                  {isSubmitting && <RefreshCw className="h-3.5 w-3.5 animate-spin" />}
                  {t('projects.timeLogs.saveTimeLog', 'Save Time Log')}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editingLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-card border rounded-xl max-w-md w-full p-6 shadow-xl space-y-4">
            <h3 className="text-lg font-bold">{t('projects.timeLogs.editTimeTitle', 'Edit Time Log')}</h3>

            {formError && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{formError}</AlertDescription>
              </Alert>
            )}

            <form onSubmit={handleEditSubmit} className="space-y-4 text-xs">
              <div>
                <label className="font-medium block mb-1">
                  {t('projects.timeLogs.workDate', 'Date (Asia/Kathmandu)')} *
                </label>
                <input
                  type="date"
                  required
                  min={getTimeLogDateMin()}
                  max={getTimeLogDateMax()}
                  value={formWorkDate}
                  onChange={(e) => setFormWorkDate(e.target.value)}
                  className="w-full border rounded-md px-3 py-2 bg-background"
                />
              </div>

              <div>
                <label className="font-medium block mb-1">
                  {t('projects.timeLogs.hours', 'Hours (0.25 increments, max 24)')} *
                </label>
                <input
                  type="number"
                  step="0.25"
                  min="0.25"
                  max="24"
                  required
                  value={formHours}
                  onChange={(e) => setFormHours(e.target.value)}
                  className="w-full border rounded-md px-3 py-2 bg-background font-mono"
                />
              </div>

              <div>
                <label className="font-medium block mb-1">
                  {t('projects.timeLogs.taskOptional', 'Task (Optional)')}
                </label>
                <select
                  value={formTaskId}
                  onChange={(e) => setFormTaskId(e.target.value)}
                  className="w-full border rounded-md px-3 py-2 bg-background"
                >
                  <option value="">{t('projects.timeLogs.generalProjectTime', '— General Project Time —')}</option>
                  {projectTasks.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.title}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="font-medium">
                    {t('projects.timeLogs.noteOptional', 'Note (Optional)')}
                  </label>
                  <span className="text-[10px] text-muted-foreground">{formNote.length} / 5000</span>
                </div>
                <textarea
                  rows={3}
                  maxLength={5000}
                  value={formNote}
                  onChange={(e) => setFormNote(e.target.value)}
                  placeholder={t('projects.timeLogs.notePlaceholder', 'Describe what was accomplished...')}
                  className="w-full border rounded-md px-3 py-2 bg-background resize-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setEditingLog(null)}
                  disabled={isSubmitting}
                >
                  {t('common.cancel', 'Cancel')}
                </Button>
                <Button type="submit" disabled={isSubmitting} className="gap-2">
                  {isSubmitting && <RefreshCw className="h-3.5 w-3.5 animate-spin" />}
                  {t('common.saveChanges', 'Save Changes')}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      <ConfirmationModal
        open={!!logToDelete}
        onOpenChange={(open) => {
          if (!open) setLogToDelete(null);
        }}
        title={t('projects.timeLogs.deleteTitle', 'Delete Time Log')}
        description={t(
          'projects.timeLogs.deleteDesc',
          'Are you sure you want to delete this time entry? This cannot be undone.'
        )}
        confirmLabel={t('common.delete', 'Delete')}
        cancelLabel={t('common.cancel', 'Cancel')}
        variant="destructive"
        isLoading={isSubmitting}
        onConfirm={handleConfirmDelete}
      />
    </div>
  );
}
