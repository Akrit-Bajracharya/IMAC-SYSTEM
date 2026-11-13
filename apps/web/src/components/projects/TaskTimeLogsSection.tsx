import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Clock,
  Plus,
  Edit2,
  Trash2,
  RefreshCw,
  Info,
  AlertCircle,
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
} from '../../api/projects.js';
import {
  canLogTime,
  canSeeTaskTimeLogs,
  canEditTimeLog,
  canDeleteTimeLog,
} from '../../lib/timeLogPermissions.js';
import { sumTimeLogHours } from '../../lib/timeLogTotals.js';
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
} from '../../lib/dateUtils.js';
import type {
  ProjectTaskDetail,
  ProjectTimeLog,
  ProjectRole,
  User,
  ProjectMember,
} from '../../types/index.js';

interface TaskTimeLogsSectionProps {
  projectId: string;
  task: ProjectTaskDetail;
  currentUser: User | null;
  callerProjectRole?: ProjectRole;
  isSystemAdmin: boolean;
  projectMembers: ProjectMember[];
  onRefreshTask?: () => void;
}

export function TaskTimeLogsSection({
  projectId,
  task,
  currentUser,
  callerProjectRole,
  isSystemAdmin,
  projectMembers,
  onRefreshTask,
}: TaskTimeLogsSectionProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const mockProject = { members: projectMembers };
  const isAllowedToSee = canSeeTaskTimeLogs(currentUser, mockProject);
  const isAllowedToLog = canLogTime(currentUser, mockProject);

  const [logModalOpen, setLogModalOpen] = useState(false);
  const [editingLog, setEditingLog] = useState<ProjectTimeLog | null>(null);
  const [logToDelete, setLogToDelete] = useState<ProjectTimeLog | null>(null);

  const [formWorkDate, setFormWorkDate] = useState<string>(getKathmanduToday());
  const [formHours, setFormHours] = useState<string>('1.00');
  const [formNote, setFormNote] = useState<string>('');
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Query: Time logs for this task
  const {
    data,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ['taskTimeLogs', projectId, task.id],
    queryFn: () => fetchProjectTimeLogs(projectId, { taskId: task.id, limit: 100 }),
    enabled: isAllowedToSee,
    staleTime: 0,
  });

  if (!isAllowedToSee) {
    return null;
  }

  const logs = data?.items ?? [];
  const totalHours = sumTimeLogHours(logs);

  const invalidateAllTimeQueries = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['taskTimeLogs', projectId, task.id] }),
      queryClient.invalidateQueries({ queryKey: ['projectTimeLogs', projectId] }),
      queryClient.invalidateQueries({ queryKey: ['projectWorkload', projectId] }),
      queryClient.invalidateQueries({ queryKey: ['projectSummary', projectId] }),
    ]);
    if (onRefreshTask) onRefreshTask();
  };

  const handleOpenCreateModal = () => {
    setFormWorkDate(getKathmanduToday());
    setFormHours('1.00');
    setFormNote('');
    setFormError(null);
    setLogModalOpen(true);
  };

  const handleOpenEditModal = (log: ProjectTimeLog) => {
    setEditingLog(log);
    setFormWorkDate(toDateInputValue(log.workDate));
    setFormHours(String(log.hours));
    setFormNote(log.note ?? '');
    setFormError(null);
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const validation = validateAndBuildCreatePayload({
      taskId: task.id,
      workDate: formWorkDate,
      hours: formHours,
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
      await createProjectTimeLog(projectId, validation.payload);
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
      setFormError(t('projects.timeLogs.errors.validationError', 'Please check entered values.'));
      return;
    }

    setIsSubmitting(true);
    try {
      await patchProjectTimeLog(projectId, editingLog.id, validation.payload);
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
      await deleteProjectTimeLog(projectId, logToDelete.id);
      setLogToDelete(null);
      await invalidateAllTimeQueries();
    } catch (err: any) {
      alert(mapTimeLogError(err, t));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h3 className="font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2 text-base">
            <Clock className="h-4 w-4 text-primary" />
            {t('projects.timeLogs.taskSectionTitle', 'Time Logged')}
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            {data?.hasMore
              ? t('projects.timeLogs.totalLoadedRows', {
                  defaultValue: 'Total of loaded rows: {{total}}',
                  total: formatHours(totalHours),
                })
              : t('projects.timeLogs.totalHours', {
                  defaultValue: 'Total: {{total}}',
                  total: formatHours(totalHours),
                })}
          </p>
        </div>

        <div>
          {isAllowedToLog ? (
            <Button
              size="sm"
              variant="outline"
              onClick={handleOpenCreateModal}
              className="flex items-center gap-1.5"
            >
              <Plus className="h-3.5 w-3.5" />
              {t('projects.timeLogs.logTimeBtn', 'Log Time')}
            </Button>
          ) : isSystemAdmin ? (
            <div className="text-xs text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 px-2.5 py-1.5 rounded flex items-center gap-1.5">
              <Info className="h-3.5 w-3.5 shrink-0" />
              <span>{t('projects.timeLogs.adminNoMembershipNotice', 'Add yourself as a project member to log time.')}</span>
            </div>
          ) : null}
        </div>
      </div>

      {isLoading ? (
        <div className="py-6 flex justify-center text-muted-foreground text-xs">
          <RefreshCw className="h-4 w-4 animate-spin text-primary mr-2" />
          {t('common.loading', 'Loading time logs...')}
        </div>
      ) : isError ? (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="flex items-center justify-between text-xs">
            <span>{mapTimeLogError(error, t)}</span>
            <Button size="sm" variant="outline" onClick={() => refetch()} className="ml-2 h-7 px-2">
              {t('common.retry', 'Retry')}
            </Button>
          </AlertDescription>
        </Alert>
      ) : logs.length === 0 ? (
        <p className="text-xs text-gray-400 italic py-2">
          {t('projects.timeLogs.noLogsOnTask', 'No time logged on this task yet.')}
        </p>
      ) : (
        <div className="divide-y text-xs border rounded-lg overflow-hidden bg-card">
          {logs.map((log) => {
            const memberObj = projectMembers.find((m) => m.userId === log.userId);
            const personName =
              log.user?.displayName ||
              memberObj?.user?.displayName ||
              t('projects.timeLogs.formerMember', 'Former member');

            const canEdit = canEditTimeLog(currentUser, log, callerProjectRole);
            const canDelete = canDeleteTimeLog(currentUser, log, callerProjectRole);

            return (
              <div
                key={log.id}
                className="p-3 flex flex-col sm:flex-row sm:items-start justify-between gap-2 hover:bg-muted/30 transition"
              >
                <div className="space-y-1 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold flex items-center gap-1">
                      <UserIcon className="h-3 w-3 text-muted-foreground" />
                      {personName}
                    </span>
                    <span className="text-muted-foreground">•</span>
                    <span className="text-muted-foreground">{formatDateDisplay(log.workDate)}</span>
                  </div>

                  {log.note && (
                    <p className="text-xs text-muted-foreground whitespace-pre-wrap pl-4 border-l border-muted">
                      {log.note}
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-3 self-end sm:self-center shrink-0">
                  <span className="font-mono font-bold text-xs bg-muted/60 px-2 py-0.5 rounded">
                    {formatHours(log.hours)}
                  </span>

                  {(canEdit || canDelete) && (
                    <div className="flex items-center gap-1">
                      {canEdit && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleOpenEditModal(log)}
                          className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
                          title={t('common.edit', 'Edit')}
                        >
                          <Edit2 className="h-3 w-3" />
                        </Button>
                      )}
                      {canDelete && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setLogToDelete(log)}
                          className="h-6 w-6 p-0 text-destructive hover:bg-destructive/10"
                          title={t('common.delete', 'Delete')}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Log Time Modal (Prefilled with task) */}
      {logModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-card border rounded-xl max-w-md w-full p-6 shadow-xl space-y-4">
            <h3 className="text-lg font-bold">{t('projects.timeLogs.logTimeTitle', 'Log Time')}</h3>
            <p className="text-xs text-muted-foreground font-medium">
              {t('projects.timeLogs.taskLabel', 'Task')}: <span className="text-foreground">{task.title}</span>
            </p>

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
