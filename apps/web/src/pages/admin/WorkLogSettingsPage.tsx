import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import {
  Settings,
  Save,
  CheckCircle2,
  AlertCircle,
  Clock,
  ShieldCheck,
  Sliders,
  RefreshCw,
} from 'lucide-react';

import { useAuth } from '../../hooks/useAuth.js';
import { fetchSettings, updateSetting } from '../../api/settings.js';
import { Button } from '../../components/ui/button.js';
import { Input } from '../../components/ui/input.js';
import { Label } from '../../components/ui/label.js';
import { Select } from '../../components/ui/select.js';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/card.js';
import { Alert, AlertDescription } from '../../components/ui/alert.js';
import { Spinner } from '../../components/layout/Spinner.js';
import { UnauthorizedPage } from '../errors/UnauthorizedPage.js';
import type { SystemSettingItem } from '../../types/index.js';

export function WorkLogSettingsPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Defense-in-depth: only system_admin can view or configure system settings
  if (user?.systemRole !== 'system_admin') {
    return <UnauthorizedPage />;
  }

  // Form field states
  const [requiresApproval, setRequiresApproval] = useState<string>('true');
  const [mismatchHandling, setMismatchHandling] = useState<'block' | 'warn' | 'allow'>('warn');
  const [editWindowHours, setEditWindowHours] = useState<string>('24');

  const [formError, setFormError] = useState<string | null>(null);
  const [successBanner, setSuccessBanner] = useState<string | null>(null);

  // Fetch settings from API
  const {
    data: settings = [],
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery<SystemSettingItem[]>({
    queryKey: ['admin', 'settings'],
    queryFn: fetchSettings,
  });

  // Populate form state when settings load
  useEffect(() => {
    if (settings && settings.length > 0) {
      const approvalItem = settings.find((s) => s.key === 'worklog.requiresApproval');
      if (approvalItem) {
        setRequiresApproval(approvalItem.value === 'true' ? 'true' : 'false');
      }

      const mismatchItem = settings.find((s) => s.key === 'worklog.mismatchHandling');
      if (
        mismatchItem &&
        ['block', 'warn', 'allow'].includes(mismatchItem.value.toLowerCase())
      ) {
        setMismatchHandling(mismatchItem.value.toLowerCase() as 'block' | 'warn' | 'allow');
      }

      const windowItem = settings.find((s) => s.key === 'worklog.editWindowHours');
      if (windowItem) {
        setEditWindowHours(windowItem.value);
      }
    }
  }, [settings]);

  // Save mutation
  const saveMutation = useMutation({
    mutationFn: async () => {
      // Validate editWindowHours: positive whole number > 0
      const trimmedHours = editWindowHours.trim();
      const numHours = parseInt(trimmedHours, 10);
      if (
        !/^\d+$/.test(trimmedHours) ||
        isNaN(numHours) ||
        numHours <= 0 ||
        numHours > 8760
      ) {
        throw new Error(t('admin.settings.errors.invalidEditWindow'));
      }

      // Execute all setting updates
      await Promise.all([
        updateSetting('worklog.requiresApproval', requiresApproval),
        updateSetting('worklog.mismatchHandling', mismatchHandling),
        updateSetting('worklog.editWindowHours', trimmedHours),
      ]);
    },
    onSuccess: () => {
      setFormError(null);
      setSuccessBanner(t('admin.settings.notifications.saved'));
      queryClient.invalidateQueries({ queryKey: ['admin', 'settings'] });
      setTimeout(() => setSuccessBanner(null), 5000);
    },
    onError: (err: any) => {
      setFormError(err.message || t('admin.settings.errors.saveFailed'));
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setSuccessBanner(null);
    saveMutation.mutate();
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[300px]">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Title */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {t('admin.settings.pageTitle')}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {t('admin.settings.pageSubtitle')}
          </p>
        </div>

        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => refetch()}
          className="gap-2 self-start sm:self-auto"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>{t('common.refresh')}</span>
        </Button>
      </div>

      {/* Notifications */}
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

      {/* Policy Settings Form */}
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* 1. Requires Approval Setting */}
        <Card>
          <CardHeader className="pb-3 border-b">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-muted-foreground" />
              <div>
                <CardTitle className="text-base font-semibold">
                  {t('admin.settings.requiresApprovalTitle')}
                </CardTitle>
                <CardDescription className="text-xs">
                  {t('admin.settings.requiresApprovalDesc')}
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-4 sm:p-6 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label
                className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                  requiresApproval === 'true'
                    ? 'border-primary bg-primary/5 text-primary'
                    : 'border-border hover:bg-muted/40'
                }`}
              >
                <input
                  type="radio"
                  name="requiresApproval"
                  value="true"
                  checked={requiresApproval === 'true'}
                  onChange={(e) => setRequiresApproval(e.target.value)}
                  className="w-4 h-4 text-primary"
                  disabled={saveMutation.isPending}
                />
                <div>
                  <span className="text-xs font-semibold block">
                    {t('admin.settings.enabled')}
                  </span>
                  <span className="text-[11px] text-muted-foreground">
                    Logs transition to 'submitted' awaiting management sign-off
                  </span>
                </div>
              </label>

              <label
                className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                  requiresApproval === 'false'
                    ? 'border-primary bg-primary/5 text-primary'
                    : 'border-border hover:bg-muted/40'
                }`}
              >
                <input
                  type="radio"
                  name="requiresApproval"
                  value="false"
                  checked={requiresApproval === 'false'}
                  onChange={(e) => setRequiresApproval(e.target.value)}
                  className="w-4 h-4 text-primary"
                  disabled={saveMutation.isPending}
                />
                <div>
                  <span className="text-xs font-semibold block">
                    {t('admin.settings.disabled')}
                  </span>
                  <span className="text-[11px] text-muted-foreground">
                    Logs transition directly to 'approved' status upon submission
                  </span>
                </div>
              </label>
            </div>
          </CardContent>
        </Card>

        {/* 2. Mismatch Handling Setting */}
        <Card>
          <CardHeader className="pb-3 border-b">
            <div className="flex items-center gap-2">
              <Sliders className="w-5 h-5 text-muted-foreground" />
              <div>
                <CardTitle className="text-base font-semibold">
                  {t('admin.settings.mismatchHandlingTitle')}
                </CardTitle>
                <CardDescription className="text-xs">
                  {t('admin.settings.mismatchHandlingDesc')}
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-4 sm:p-6 space-y-3">
            <div className="space-y-2">
              <label
                className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                  mismatchHandling === 'block'
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:bg-muted/40'
                }`}
              >
                <input
                  type="radio"
                  name="mismatchHandling"
                  value="block"
                  checked={mismatchHandling === 'block'}
                  onChange={() => setMismatchHandling('block')}
                  className="w-4 h-4 text-primary mt-0.5"
                  disabled={saveMutation.isPending}
                />
                <div className="text-xs space-y-0.5">
                  <span className="font-semibold block">
                    {t('admin.settings.mismatchModes.block')}
                  </span>
                  <span className="text-muted-foreground">
                    Strict enforcement: logged hours must strictly match the expected shift length.
                  </span>
                </div>
              </label>

              <label
                className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                  mismatchHandling === 'warn'
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:bg-muted/40'
                }`}
              >
                <input
                  type="radio"
                  name="mismatchHandling"
                  value="warn"
                  checked={mismatchHandling === 'warn'}
                  onChange={() => setMismatchHandling('warn')}
                  className="w-4 h-4 text-primary mt-0.5"
                  disabled={saveMutation.isPending}
                />
                <div className="text-xs space-y-0.5">
                  <span className="font-semibold block">
                    {t('admin.settings.mismatchModes.warn')}
                  </span>
                  <span className="text-muted-foreground">
                    Permissive with feedback: accepts submission but returns an explicit warning notification.
                  </span>
                </div>
              </label>

              <label
                className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                  mismatchHandling === 'allow'
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:bg-muted/40'
                }`}
              >
                <input
                  type="radio"
                  name="mismatchHandling"
                  value="allow"
                  checked={mismatchHandling === 'allow'}
                  onChange={() => setMismatchHandling('allow')}
                  className="w-4 h-4 text-primary mt-0.5"
                  disabled={saveMutation.isPending}
                />
                <div className="text-xs space-y-0.5">
                  <span className="font-semibold block">
                    {t('admin.settings.mismatchModes.allow')}
                  </span>
                  <span className="text-muted-foreground">
                    Quiet acceptance: accepts submission without validation alerts or mismatch warnings.
                  </span>
                </div>
              </label>
            </div>
          </CardContent>
        </Card>

        {/* 3. Edit Window Hours Setting */}
        <Card>
          <CardHeader className="pb-3 border-b">
            <div className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-muted-foreground" />
              <div>
                <CardTitle className="text-base font-semibold">
                  {t('admin.settings.editWindowTitle')}
                </CardTitle>
                <CardDescription className="text-xs">
                  {t('admin.settings.editWindowDesc')}
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-4 sm:p-6 space-y-4">
            <div className="max-w-xs space-y-2">
              <Label htmlFor="edit-window-hours" className="text-xs font-semibold">
                Hours Allowed for Post-Submission Edits
              </Label>
              <div className="relative">
                <Input
                  id="edit-window-hours"
                  type="number"
                  min="1"
                  step="1"
                  value={editWindowHours}
                  onChange={(e) => setEditWindowHours(e.target.value)}
                  placeholder={t('admin.settings.editWindowPlaceholder')}
                  disabled={saveMutation.isPending}
                  className="w-full text-xs font-mono pr-14"
                  required
                />
                <span className="absolute right-3 top-2.5 text-xs text-muted-foreground font-mono">
                  hours
                </span>
              </div>
              <span className="text-[11px] text-muted-foreground block">
                Must be a positive whole number greater than 0 (standard default: 24 hours).
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Submit Actions */}
        <div className="flex justify-end pt-2">
          <Button
            type="submit"
            variant="default"
            disabled={saveMutation.isPending}
            className="w-full sm:w-auto gap-2"
          >
            <Save className="w-4 h-4" />
            <span>
              {saveMutation.isPending
                ? t('admin.settings.savingSettings')
                : t('admin.settings.saveSettings')}
            </span>
          </Button>
        </div>
      </form>
    </div>
  );
}
