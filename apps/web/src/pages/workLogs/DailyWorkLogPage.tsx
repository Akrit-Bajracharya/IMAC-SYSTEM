import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import {
  Calendar as CalendarIcon,
  Plus,
  Trash2,
  Clock,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Info,
  Shield,
  Save,
  Send,
  RefreshCw,
  UserX,
} from 'lucide-react';

import { useAuth } from '../../hooks/useAuth.js';
import {
  fetchMyWorkRoles,
  fetchWorkLogByDate,
  saveWorkLogDraft,
  patchWorkLog,
  submitWorkLog,
  getWorkLogErrorInfo,
} from '../../api/workLogs.js';
import {
  getKathmanduToday,
  addDays,
  formatDateDisplay,
  calculateShiftDifference,
} from '../../lib/dateUtils.js';
import { Button } from '../../components/ui/button.js';
import { Input } from '../../components/ui/input.js';
import { Label } from '../../components/ui/label.js';
import { Select } from '../../components/ui/select.js';
import { Alert, AlertDescription, AlertTitle } from '../../components/ui/alert.js';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/card.js';
import { WorkLogStatusBadge } from '../../components/common/WorkLogStatusBadge.js';
import { fetchAllAccessibleProjects, fetchProjectById, fetchAllTasksForProject } from '../../api/projects.js';
import type { ProjectListItem } from '../../types/index.js';
import type { WorkRole } from '../../types/index.js';

interface EditableEntry {
  id?: string;
  workRoleId: string;
  hours: number | string;
  description: string;
  projectId: string;
  taskId: string;
}

export function DailyWorkLogPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();

  // Selected calendar date (YYYY-MM-DD string)
  const initialDate = searchParams.get('date') || getKathmanduToday();
  const [selectedDate, setSelectedDate] = useState<string>(initialDate);

  // Sync date with URL params
  useEffect(() => {
    const urlDate = searchParams.get('date');
    if (urlDate && urlDate !== selectedDate) {
      setSelectedDate(urlDate);
    }
  }, [searchParams]);

  const handleDateChange = (newDate: string) => {
    setSelectedDate(newDate);
    setSearchParams({ date: newDate });
    setFormError(null);
    setSuccessBanner(null);
    setServerWarnings([]);
  };

  // Editable entry rows state
  const [entries, setEntries] = useState<EditableEntry[]>([
    { workRoleId: '', hours: '', description: '', projectId: '', taskId: '' },
  ]);

  // Window expired lock state for submitted log
  const [isWindowExpired, setIsWindowExpired] = useState(false);

  // Status and notification banners
  const [successBanner, setSuccessBanner] = useState<string | null>(null);
  const [serverWarnings, setServerWarnings] = useState<string[]>([]);
  const [formError, setFormError] = useState<string | null>(null);

  const isViewer = user?.systemRole === 'viewer';

  // Query all member projects for current user (system_admin only gets projects they belong to)
  const { data: memberProjects = [] } = useQuery({
    queryKey: ['workLog', 'memberProjects', user?.id],
    queryFn: async () => {
      const all = await fetchAllAccessibleProjects();
      if (!user) return [];
      if (user.systemRole !== 'system_admin') {
        return all;
      }
      const detailed = await Promise.all(
        all.map(async (p) => {
          try {
            const detail = await fetchProjectById(p.id);
            const isMember = detail.members.some((m) => m.userId === user.id);
            return isMember ? p : null;
          } catch {
            return null;
          }
        })
      );
      return detailed.filter((p): p is ProjectListItem => p !== null);
    },
    enabled: !!user,
    staleTime: 60 * 1000,
  });


  // 1. Fetch user's assigned active work roles
  const {
    data: myRoles = [],
    isLoading: isLoadingRoles,
    error: rolesError,
  } = useQuery<WorkRole[]>({
    queryKey: ['work-roles', 'my-roles'],
    queryFn: fetchMyWorkRoles,
    staleTime: 5 * 60 * 1000,
  });

  // 2. Fetch work log for selected date
  const {
    data: logData,
    isLoading: isLoadingLog,
    isError: isLogError,
    error: logQueryError,
    refetch: refetchLog,
  } = useQuery({
    queryKey: ['work-log', 'by-date', selectedDate],
    queryFn: () => fetchWorkLogByDate(selectedDate),
    retry: (failureCount, error: any) => {
      // Do not retry 404 (profile not found / no log)
      if (error?.response?.status === 404) return false;
      return failureCount < 2;
    },
  });

  // Check if user has no employee profile
  const isProfileNotFound =
    (logQueryError as any)?.response?.status === 404 &&
    (logQueryError as any)?.response?.data?.error === 'profile_not_found';

  const workLog = logData?.workLog ?? null;
  const standardShiftHours = logData?.standardShiftHours ?? 8;
  const currentStatus = workLog?.status;

  // Hydrate entries when logData changes or when switching dates
  useEffect(() => {
    setIsWindowExpired(false);
    setFormError(null);
    setServerWarnings(logData?.warnings ?? []);

    if (workLog && workLog.entries && workLog.entries.length > 0) {
      setEntries(
        workLog.entries.map((e) => ({
          id: e.id,
          workRoleId: e.workRoleId,
          hours: e.hours,
          description: e.description || '',
          projectId: e.projectId || '',
          taskId: e.taskId || '',
        }))
      );
    } else {
      // If no entries, start with one empty row
      const firstRoleId = myRoles.length > 0 ? myRoles[0].id : '';
      setEntries([
        {
          workRoleId: firstRoleId,
          hours: '',
          description: '',
          projectId: '',
          taskId: '',
        },
      ]);
    }
  }, [logData, workLog?.id, selectedDate, myRoles]);

  // Read-only state check
  const isApproved = currentStatus === 'approved';
  const isReadOnly = isViewer || isApproved || isWindowExpired;

  // Calculate live running total
  const runningTotal = useMemo(() => {
    return entries.reduce((acc, row) => {
      const h = typeof row.hours === 'number' ? row.hours : parseFloat(row.hours);
      return acc + (isNaN(h) || h < 0 ? 0 : h);
    }, 0);
  }, [entries]);

  const shiftDiff = useMemo(() => {
    return calculateShiftDifference(runningTotal, standardShiftHours);
  }, [runningTotal, standardShiftHours]);

  // Handlers for entry rows
  const handleAddRow = () => {
    if (isReadOnly) return;
    const defaultRole = myRoles.length > 0 ? myRoles[0].id : '';
    setEntries((prev) => [
      ...prev,
      { workRoleId: defaultRole, hours: '', description: '', projectId: '', taskId: '' },
    ]);
  };

  const handleRemoveRow = (index: number) => {
    if (isReadOnly || entries.length <= 1) return;
    setEntries((prev) => prev.filter((_, i) => i !== index));
  };

  const handleFieldChange = (
    index: number,
    field: keyof EditableEntry,
    value: string | number
  ) => {
    if (isReadOnly) return;
    setEntries((prev) =>
      prev.map((row, i) => (i === index ? { ...row, [field]: value } : row))
    );
  };

  // Helper to map error response codes to i18n text
  const translateErrorCode = (err: any): string => {
    const { code, status } = getWorkLogErrorInfo(err);

    if (code === 'edit_window_expired') {
      setIsWindowExpired(true);
      return t('workLog.daily.errors.edit_window_expired');
    }
    if (code === 'invalid_project') {
      return t('workLog.daily.errors.invalidProject');
    }
    if (code === 'invalid_task') {
      return t('workLog.daily.errors.invalidTask');
    }
    if (code === 'hour_mismatch' || status === 422) {
      return t('workLog.daily.errors.hour_mismatch');
    }
    if (code === 'validation_error') {
      return t('workLog.daily.errors.validation_error');
    }
    if (code === 'unassigned_work_role') {
      return t('workLog.daily.errors.unassigned_work_role');
    }
    if (code === 'status_conflict') {
      return t('workLog.daily.errors.status_conflict');
    }
    if (code === 'conflict_retry') {
      return t('workLog.daily.errors.conflict_retry');
    }
    if (code === 'already_submitted') {
      return t('workLog.daily.errors.already_submitted');
    }
    if (code === 'log_already_approved') {
      return t('workLog.daily.errors.log_already_approved');
    }
    if (code === 'profile_not_found') {
      return t('workLog.daily.errors.profile_not_found');
    }
    if (code === 'row_limit_exceeded') {
      return t('workLog.daily.errors.row_limit_exceeded');
    }
    if (code === 'forbidden' || status === 403) {
      return t('workLog.daily.errors.forbidden');
    }

    return err?.response?.data?.message || t('workLog.daily.errors.generic');
  };

  // Prepare payload from local state
  const preparePayloadEntries = () => {
    if (entries.length === 0) {
      throw new Error(t('workLog.daily.errors.atLeastOneEntry'));
    }

    return entries.map((row) => {
      if (!row.workRoleId) {
        throw new Error(t('workLog.daily.errors.validation_error'));
      }
      const h = typeof row.hours === 'number' ? row.hours : parseFloat(row.hours);
      if (isNaN(h) || h <= 0) {
        throw new Error(t('workLog.daily.errors.hoursPositive'));
      }
      return {
        workRoleId: row.workRoleId,
        hours: h,
        description: row.description.trim() ? row.description.trim() : null,
        projectId: row.projectId.trim() ? row.projectId.trim() : null,
        taskId: row.taskId.trim() ? row.taskId.trim() : null,
      };
    });
  };

  // 3. Save Draft mutation
  const saveDraftMutation = useMutation({
    mutationFn: async () => {
      const payloadEntries = preparePayloadEntries();

      if (workLog?.id && currentStatus === 'submitted') {
        // Submitted log being updated within window via PATCH
        return patchWorkLog(workLog.id, { entries: payloadEntries });
      }

      // Draft upsert
      return saveWorkLogDraft({
        date: selectedDate,
        entries: payloadEntries,
      });
    },
    onSuccess: (data) => {
      setFormError(null);
      setServerWarnings(data.warnings || []);
      setSuccessBanner(
        currentStatus === 'submitted'
          ? t('workLog.daily.notifications.changesSaved')
          : t('workLog.daily.notifications.draftSaved')
      );
      queryClient.invalidateQueries({ queryKey: ['work-log', 'by-date', selectedDate] });
      queryClient.invalidateQueries({ queryKey: ['work-logs'] });
    },
    onError: (err: any) => {
      setFormError(err.message || translateErrorCode(err));
    },
  });

  // 4. Submit mutation
  const submitMutation = useMutation({
    mutationFn: async () => {
      const payloadEntries = preparePayloadEntries();

      // First ensure draft is saved/updated
      let targetId = workLog?.id;
      if (!targetId || currentStatus === 'draft') {
        const saved = await saveWorkLogDraft({
          date: selectedDate,
          entries: payloadEntries,
        });
        targetId = saved.workLog?.id;
      }

      if (!targetId) {
        throw new Error(t('workLog.daily.errors.generic'));
      }

      // Then submit atomically
      return submitWorkLog(targetId);
    },
    onSuccess: (data) => {
      setFormError(null);
      setServerWarnings(data.warnings || []);
      setSuccessBanner(t('workLog.daily.notifications.submitted'));
      queryClient.invalidateQueries({ queryKey: ['work-log', 'by-date', selectedDate] });
      queryClient.invalidateQueries({ queryKey: ['work-logs'] });
    },
    onError: (err: any) => {
      setFormError(err.message || translateErrorCode(err));
    },
  });

  const isSaving = saveDraftMutation.isPending || submitMutation.isPending;

  // Handle No Profile state friendly view
  if (isProfileNotFound) {
    return (
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {t('workLog.daily.pageTitle')}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {t('workLog.daily.pageSubtitle')}
          </p>
        </div>

        <Card className="border-amber-200 bg-amber-50/50 dark:bg-amber-950/20 dark:border-amber-900">
          <CardContent className="flex flex-col items-center justify-center p-8 text-center space-y-3">
            <div className="flex items-center justify-center w-14 h-14 rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-600">
              <UserX className="w-7 h-7" />
            </div>
            <CardTitle className="text-lg font-semibold text-amber-900 dark:text-amber-200">
              {t('workLog.daily.noProfile.title')}
            </CardTitle>
            <p className="text-sm text-amber-800 dark:text-amber-300 max-w-md">
              {t('workLog.daily.noProfile.description')}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header and Title */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {t('workLog.daily.pageTitle')}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {t('workLog.daily.pageSubtitle')}
          </p>
        </div>

        {/* Status Badge */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground font-medium">
            {t('workLog.daily.statusLabel')}:
          </span>
          <WorkLogStatusBadge status={currentStatus} />
        </div>
      </div>

      {/* Notifications / Alerts */}
      {isViewer && (
        <Alert className="border-sky-200 bg-sky-50 dark:bg-sky-950/30 text-sky-800 dark:text-sky-300">
          <Shield className="h-4 w-4" />
          <AlertTitle className="text-xs font-semibold">
            {t('workLog.daily.readOnlyNotice')}
          </AlertTitle>
        </Alert>
      )}

      {currentStatus === 'submitted' && !isWindowExpired && (
        <Alert className="border-sky-200 bg-sky-50 dark:bg-sky-950/30 text-sky-800 dark:text-sky-300">
          <Info className="h-4 w-4" />
          <AlertDescription className="text-xs">
            {t('workLog.daily.submittedNotice')}
          </AlertDescription>
        </Alert>
      )}

      {isWindowExpired && (
        <Alert className="border-amber-200 bg-amber-50 dark:bg-amber-950/30 text-amber-800 dark:text-amber-300">
          <Clock className="h-4 w-4" />
          <AlertDescription className="text-xs">
            {t('workLog.daily.windowExpiredNotice')}
          </AlertDescription>
        </Alert>
      )}

      {isApproved && (
        <Alert className="border-emerald-200 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-800 dark:text-emerald-300">
          <CheckCircle2 className="h-4 w-4" />
          <AlertDescription className="text-xs">
            {t('workLog.daily.approvedNotice')}
          </AlertDescription>
        </Alert>
      )}

      {successBanner && (
        <Alert className="border-emerald-200 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-800 dark:text-emerald-300">
          <CheckCircle2 className="h-4 w-4" />
          <AlertDescription className="text-xs">{successBanner}</AlertDescription>
        </Alert>
      )}

      {formError && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="text-xs">{formError}</AlertDescription>
        </Alert>
      )}

      {serverWarnings.length > 0 && (
        <Alert className="border-amber-200 bg-amber-50 dark:bg-amber-950/30 text-amber-900 dark:text-amber-200">
          <AlertTriangle className="h-4 w-4 text-amber-600" />
          <div className="ml-2">
            <AlertTitle className="text-xs font-semibold">
              {t('workLog.daily.warningsTitle')}
            </AlertTitle>
            <AlertDescription className="text-xs mt-1 space-y-0.5">
              {serverWarnings.map((warning, idx) => (
                <div key={idx}>• {warning}</div>
              ))}
            </AlertDescription>
          </div>
        </Alert>
      )}

      {/* Date Control Card */}
      <Card>
        <CardContent className="p-4 sm:p-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
              <div className="flex items-center gap-2">
                <CalendarIcon className="w-5 h-5 text-muted-foreground" />
                <Label htmlFor="log-date" className="font-semibold text-sm">
                  {t('workLog.daily.dateLabel')}:
                </Label>
              </div>
              <Input
                id="log-date"
                type="date"
                value={selectedDate}
                onChange={(e) => handleDateChange(e.target.value)}
                className="w-full sm:w-auto"
                title={t('workLog.daily.selectDate')}
              />
              <span className="text-xs text-muted-foreground">
                {formatDateDisplay(selectedDate)}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => handleDateChange(addDays(selectedDate, -1))}
              >
                {t('workLog.daily.yesterday')}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => handleDateChange(getKathmanduToday())}
              >
                {t('workLog.daily.today')}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => refetchLog()}
                title={t('common.refresh')}
                disabled={isLoadingLog}
              >
                <RefreshCw className={`w-4 h-4 ${isLoadingLog ? 'animate-spin' : ''}`} />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Assigned Roles Warning if empty */}
      {!isLoadingRoles && myRoles.length === 0 && (
        <Card className="border-amber-200 bg-amber-50/40 dark:bg-amber-950/20">
          <CardContent className="p-4 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <h4 className="text-sm font-semibold text-amber-900 dark:text-amber-200">
                {t('workLog.daily.noRoles.title')}
              </h4>
              <p className="text-xs text-amber-800 dark:text-amber-300 mt-0.5">
                {t('workLog.daily.noRoles.description')}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Entries Form Card */}
      <Card>
        <CardHeader className="pb-3 border-b">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div>
              <CardTitle className="text-base font-semibold">
                {t('workLog.daily.entriesTitle')}
              </CardTitle>
              <CardDescription className="text-xs">
                {t('workLog.daily.entriesSubtitle')}
              </CardDescription>
            </div>
            {!isReadOnly && myRoles.length > 0 && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleAddRow}
                className="gap-1.5 self-start sm:self-auto"
                disabled={isSaving}
              >
                <Plus className="w-4 h-4" />
                <span>{t('workLog.daily.addEntry')}</span>
              </Button>
            )}
          </div>
        </CardHeader>

        <CardContent className="p-4 sm:p-6 space-y-4">
          {/* Desktop Table View */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-muted-foreground text-xs font-medium text-left">
                  <th className="pb-2 pl-1 w-[260px]">{t('workLog.daily.roleColumn')}</th>
                  <th className="pb-2 w-[120px]">{t('workLog.daily.hoursColumn')}</th>
                  <th className="pb-2">{t('workLog.daily.descriptionColumn')}</th>
                  <th className="pb-2 w-[140px]">{t('workLog.daily.projectColumn')}</th>
                  <th className="pb-2 w-[140px]">{t('workLog.daily.taskColumn')}</th>
                  {!isReadOnly && <th className="pb-2 pr-1 w-[50px] text-right"></th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {entries.map((entry, idx) => (
                  <tr key={idx} className="group">
                    <td className="py-2.5 pl-1 pr-2 align-top">
                      <Select
                        value={entry.workRoleId}
                        onChange={(e) => handleFieldChange(idx, 'workRoleId', e.target.value)}
                        disabled={isReadOnly || myRoles.length === 0 || isSaving}
                        className="w-full text-xs"
                      >
                        <option value="" disabled>
                          {t('workLog.daily.rolePlaceholder')}
                        </option>
                        {myRoles.map((role) => (
                          <option key={role.id} value={role.id}>
                            {role.name}
                          </option>
                        ))}
                      </Select>
                    </td>
                    <td className="py-2.5 px-2 align-top">
                      <Input
                        type="number"
                        step="0.25"
                        min="0.25"
                        max="24"
                        placeholder="0.00"
                        value={entry.hours}
                        onChange={(e) => handleFieldChange(idx, 'hours', e.target.value)}
                        disabled={isReadOnly || isSaving}
                        className="w-full text-xs font-mono"
                      />
                    </td>
                    <td className="py-2.5 px-2 align-top">
                      <Input
                        type="text"
                        placeholder={t('workLog.daily.descriptionPlaceholder')}
                        value={entry.description}
                        onChange={(e) => handleFieldChange(idx, 'description', e.target.value)}
                        disabled={isReadOnly || isSaving}
                        className="w-full text-xs"
                      />
                    </td>
                    <td className="py-2.5 px-2 align-top">
                      <Input
                        type="text"
                        placeholder={t('workLog.daily.projectPlaceholder')}
                        value={entry.projectId}
                        onChange={(e) => handleFieldChange(idx, 'projectId', e.target.value)}
                        disabled={isReadOnly || isSaving}
                        className="w-full text-xs font-mono bg-muted/30"
                      />
                    </td>
                    <td className="py-2.5 px-2 align-top">
                      <Input
                        type="text"
                        placeholder={t('workLog.daily.taskPlaceholder')}
                        value={entry.taskId}
                        onChange={(e) => handleFieldChange(idx, 'taskId', e.target.value)}
                        disabled={isReadOnly || isSaving}
                        className="w-full text-xs font-mono bg-muted/30"
                      />
                    </td>
                    {!isReadOnly && (
                      <td className="py-2.5 pr-1 pl-2 text-right align-top">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveRow(idx)}
                          disabled={entries.length <= 1 || isSaving}
                          title={t('workLog.daily.removeRow')}
                          className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile Card View (Phone width) */}
          <div className="block md:hidden space-y-4">
            {entries.map((entry, idx) => (
              <div
                key={idx}
                className="border rounded-lg p-3 space-y-3 bg-card/60 relative"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-muted-foreground">
                    Row #{idx + 1}
                  </span>
                  {!isReadOnly && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemoveRow(idx)}
                      disabled={entries.length <= 1 || isSaving}
                      className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  )}
                </div>

                <div className="space-y-1">
                  <Label className="text-xs">{t('workLog.daily.roleColumn')}</Label>
                  <Select
                    value={entry.workRoleId}
                    onChange={(e) => handleFieldChange(idx, 'workRoleId', e.target.value)}
                    disabled={isReadOnly || myRoles.length === 0 || isSaving}
                    className="w-full text-xs"
                  >
                    <option value="" disabled>
                      {t('workLog.daily.rolePlaceholder')}
                    </option>
                    {myRoles.map((role) => (
                      <option key={role.id} value={role.id}>
                        {role.name}
                      </option>
                    ))}
                  </Select>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs">{t('workLog.daily.hoursColumn')}</Label>
                  <Input
                    type="number"
                    step="0.25"
                    min="0.25"
                    max="24"
                    placeholder="0.00"
                    value={entry.hours}
                    onChange={(e) => handleFieldChange(idx, 'hours', e.target.value)}
                    disabled={isReadOnly || isSaving}
                    className="w-full text-xs font-mono"
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs">{t('workLog.daily.descriptionColumn')}</Label>
                  <Input
                    type="text"
                    placeholder={t('workLog.daily.descriptionPlaceholder')}
                    value={entry.description}
                    onChange={(e) => handleFieldChange(idx, 'description', e.target.value)}
                    disabled={isReadOnly || isSaving}
                    className="w-full text-xs"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label className="text-xs">{t('workLog.daily.projectColumn')}</Label>
                    <Input
                      type="text"
                      placeholder={t('workLog.daily.projectPlaceholder')}
                      value={entry.projectId}
                      onChange={(e) => handleFieldChange(idx, 'projectId', e.target.value)}
                      disabled={isReadOnly || isSaving}
                      className="w-full text-xs font-mono bg-muted/30"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">{t('workLog.daily.taskColumn')}</Label>
                    <Input
                      type="text"
                      placeholder={t('workLog.daily.taskPlaceholder')}
                      value={entry.taskId}
                      onChange={(e) => handleFieldChange(idx, 'taskId', e.target.value)}
                      disabled={isReadOnly || isSaving}
                      className="w-full text-xs font-mono bg-muted/30"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Running Totals & Shift Summary Card */}
      <Card className="border-border">
        <CardContent className="p-4 sm:p-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="grid grid-cols-3 gap-4 sm:gap-8">
              <div>
                <span className="text-xs text-muted-foreground block">
                  {t('workLog.daily.expectedHours')}
                </span>
                <span className="text-lg font-bold font-mono">
                  {standardShiftHours.toFixed(2)}h
                </span>
              </div>

              <div>
                <span className="text-xs text-muted-foreground block">
                  {t('workLog.daily.totalHours')}
                </span>
                <span className="text-lg font-bold font-mono text-primary">
                  {runningTotal.toFixed(2)}h
                </span>
              </div>

              <div>
                <span className="text-xs text-muted-foreground block">
                  {t('workLog.daily.difference')}
                </span>
                <span
                  className={`text-sm font-semibold font-mono block mt-1 ${
                    shiftDiff.isBalanced
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : shiftDiff.isOver
                      ? 'text-sky-600 dark:text-sky-400'
                      : 'text-amber-600 dark:text-amber-400'
                  }`}
                >
                  {shiftDiff.formatted}
                </span>
              </div>
            </div>

            {/* Action Buttons */}
            {!isReadOnly && (
              <div className="flex flex-col sm:flex-row items-center gap-2 pt-2 sm:pt-0">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => saveDraftMutation.mutate()}
                  disabled={isSaving || myRoles.length === 0}
                  className="w-full sm:w-auto gap-2"
                >
                  <Save className="w-4 h-4" />
                  <span>
                    {isSaving && saveDraftMutation.isPending
                      ? currentStatus === 'submitted'
                        ? t('workLog.daily.savingChanges')
                        : t('workLog.daily.savingDraft')
                      : currentStatus === 'submitted'
                      ? t('workLog.daily.saveChanges')
                      : t('workLog.daily.saveDraft')}
                  </span>
                </Button>

                {currentStatus !== 'submitted' && (
                  <Button
                    type="button"
                    variant="default"
                    onClick={() => submitMutation.mutate()}
                    disabled={isSaving || myRoles.length === 0}
                    className="w-full sm:w-auto gap-2"
                  >
                    <Send className="w-4 h-4" />
                    <span>
                      {isSaving && submitMutation.isPending
                        ? t('workLog.daily.submitting')
                        : t('workLog.daily.submit')}
                    </span>
                  </Button>
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
