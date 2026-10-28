import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import {
  FileSpreadsheet,
  Download,
  Calendar,
  Filter,
  ShieldAlert,
  AlertCircle,
  CheckCircle2,
  Users,
} from 'lucide-react';

import { useAuth } from '../../hooks/useAuth.js';
import { fetchMyWorkRoles, downloadWorkLogsExport } from '../../api/workLogs.js';
import {
  getKathmanduToday,
  parseYmd,
  formatYmd,
  addDays,
} from '../../lib/dateUtils.js';
import { Button } from '../../components/ui/button.js';
import { Input } from '../../components/ui/input.js';
import { Label } from '../../components/ui/label.js';
import { Select } from '../../components/ui/select.js';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/card.js';
import { Alert, AlertDescription } from '../../components/ui/alert.js';
import type { WorkRole, WorkLogExportParams } from '../../types/index.js';

export function WorkLogExportPage() {
  const { t } = useTranslation();
  const { user } = useAuth();

  const isSystemAdmin = user?.systemRole === 'system_admin';

  // Initial date range: current month (1st of month to today)
  const todayStr = getKathmanduToday();
  const todayYmd = parseYmd(todayStr);
  const firstOfMonthStr = formatYmd(todayYmd.year, todayYmd.month, 1);

  // Filter form state
  const [startDate, setStartDate] = useState<string>(firstOfMonthStr);
  const [endDate, setEndDate] = useState<string>(todayStr);
  const [status, setStatus] = useState<string>('');
  const [workRoleId, setWorkRoleId] = useState<string>('');
  const [employee, setEmployee] = useState<string>('');
  const [team, setTeam] = useState<string>('');

  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Fetch work roles for filter dropdown
  const { data: myRoles = [] } = useQuery<WorkRole[]>({
    queryKey: ['work-roles', 'my-roles'],
    queryFn: fetchMyWorkRoles,
    staleTime: 5 * 60 * 1000,
  });

  const handleExport = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    // Validation checks
    if (!startDate || !endDate) {
      setErrorMessage(t('workLog.export.errors.dateRequired'));
      return;
    }

    if (endDate < startDate) {
      setErrorMessage(t('workLog.export.errors.dateOrder'));
      return;
    }

    // Date range max 366 days
    const startMs = new Date(startDate).getTime();
    const endMs = new Date(endDate).getTime();
    const diffDays = Math.round((endMs - startMs) / (24 * 3600 * 1000));
    if (diffDays > 366) {
      setErrorMessage(t('workLog.export.errors.dateRangeMax'));
      return;
    }

    const params: WorkLogExportParams = {
      startDate,
      endDate,
    };

    if (status) params.status = status;
    if (workRoleId) params.workRoleId = workRoleId;

    // Administrative filters for system_admin only
    if (isSystemAdmin) {
      if (employee.trim()) params.employee = employee.trim();
      if (team.trim()) params.team = team.trim();
    }

    setIsExporting(true);

    try {
      await downloadWorkLogsExport(params);
      setSuccessMessage(t('workLog.export.notifications.downloadStarted'));
    } catch (err: any) {
      let errorCode = '';
      let statusCode = err?.response?.status;

      // Handle axios blob error parsing
      if (err?.response?.data instanceof Blob) {
        try {
          const text = await err.response.data.text();
          const json = JSON.parse(text);
          errorCode = json.error || '';
        } catch {
          // ignore parsing error
        }
      } else if (err?.response?.data) {
        errorCode = err.response.data.error || '';
      }

      if (statusCode === 403 || errorCode === 'forbidden') {
        setErrorMessage(t('workLog.export.errors.forbidden'));
      } else if (
        statusCode === 400 &&
        (errorCode === 'row_limit_exceeded' || errorCode === 'validation_error')
      ) {
        setErrorMessage(t('workLog.export.errors.row_limit_exceeded'));
      } else if (statusCode === 429 || errorCode === 'too_many_requests') {
        setErrorMessage(t('workLog.export.errors.too_many_requests'));
      } else {
        setErrorMessage(t('workLog.export.errors.generic'));
      }
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Title */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          {t('workLog.export.pageTitle')}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          {t('workLog.export.pageSubtitle')}
        </p>
      </div>

      {/* Notifications */}
      {successMessage && (
        <Alert className="border-emerald-200 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-800 dark:text-emerald-300">
          <CheckCircle2 className="h-4 w-4" />
          <AlertDescription className="text-xs">{successMessage}</AlertDescription>
        </Alert>
      )}

      {errorMessage && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="text-xs">{errorMessage}</AlertDescription>
        </Alert>
      )}

      {/* Filter and Export Form */}
      <Card>
        <CardHeader className="pb-3 border-b">
          <div className="flex items-center gap-2">
            <Filter className="w-5 h-5 text-muted-foreground" />
            <div>
              <CardTitle className="text-base font-semibold">
                {t('workLog.export.filtersTitle')}
              </CardTitle>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-4 sm:p-6">
          <form onSubmit={handleExport} className="space-y-6">
            {/* Required Date Range */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="start-date" className="text-xs font-semibold">
                  {t('workLog.export.startDate')} <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="start-date"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  required
                  disabled={isExporting}
                  className="w-full text-xs"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="end-date" className="text-xs font-semibold">
                  {t('workLog.export.endDate')} <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="end-date"
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  required
                  disabled={isExporting}
                  className="w-full text-xs"
                />
              </div>
            </div>

            {/* Optional Status & Work Role Filters */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="export-status" className="text-xs font-semibold">
                  {t('workLog.export.status')}
                </Label>
                <Select
                  id="export-status"
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  disabled={isExporting}
                  className="w-full text-xs"
                >
                  <option value="">{t('workLog.export.allStatuses')}</option>
                  <option value="draft">{t('workLog.daily.status.draft')}</option>
                  <option value="submitted">{t('workLog.daily.status.submitted')}</option>
                  <option value="approved">{t('workLog.daily.status.approved')}</option>
                  <option value="rejected">{t('workLog.daily.status.rejected')}</option>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="export-work-role" className="text-xs font-semibold">
                  {t('workLog.export.workRole')}
                </Label>
                <Select
                  id="export-work-role"
                  value={workRoleId}
                  onChange={(e) => setWorkRoleId(e.target.value)}
                  disabled={isExporting}
                  className="w-full text-xs"
                >
                  <option value="">{t('workLog.export.allWorkRoles')}</option>
                  {myRoles.map((role) => (
                    <option key={role.id} value={role.id}>
                      {role.name}
                    </option>
                  ))}
                </Select>
              </div>
            </div>

            {/* Administrative Filters: ONLY FOR SYSTEM_ADMIN */}
            {isSystemAdmin && (
              <div className="border rounded-lg p-4 bg-muted/20 space-y-4">
                <div className="flex items-center gap-2 text-xs font-semibold text-primary">
                  <Users className="w-4 h-4" />
                  <span>{t('workLog.export.adminOnlySection')}</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="admin-employee-id" className="text-xs font-medium">
                      {t('workLog.export.employeeId')}
                    </Label>
                    <Input
                      id="admin-employee-id"
                      type="text"
                      placeholder={t('workLog.export.employeeIdPlaceholder')}
                      value={employee}
                      onChange={(e) => setEmployee(e.target.value)}
                      disabled={isExporting}
                      className="w-full text-xs font-mono"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="admin-team" className="text-xs font-medium">
                      {t('workLog.export.team')}
                    </Label>
                    <Input
                      id="admin-team"
                      type="text"
                      placeholder={t('workLog.export.teamPlaceholder')}
                      value={team}
                      onChange={(e) => setTeam(e.target.value)}
                      disabled={isExporting}
                      className="w-full text-xs"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Download Button */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2 border-t">
              <span className="text-xs text-muted-foreground">
                Official Excel (.xlsx) work log spreadsheet report.
              </span>

              <Button
                type="submit"
                variant="default"
                disabled={isExporting}
                className="w-full sm:w-auto gap-2"
              >
                {isExporting ? (
                  <>
                    <FileSpreadsheet className="w-4 h-4 animate-pulse" />
                    <span>{t('workLog.export.downloading')}</span>
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4" />
                    <span>{t('workLog.export.downloadButton')}</span>
                  </>
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
