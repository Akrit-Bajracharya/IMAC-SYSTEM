import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import {
  ArrowLeft,
  Briefcase,
  Plus,
  Trash2,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  User,
} from 'lucide-react';
import { fetchAdminUser } from '../../api/adminUsers.js';
import {
  fetchWorkRoles,
  fetchEmployeeWorkRoles,
  assignWorkRoleToEmployee,
  removeWorkRoleFromEmployee,
} from '../../api/adminWorkRoles.js';
import type { WorkRole } from '../../types/index.js';
import { Button } from '../../components/ui/button.js';
import { Select } from '../../components/ui/select.js';
import { Badge } from '../../components/ui/badge.js';
import { Alert, AlertDescription } from '../../components/ui/alert.js';
import { ConfirmationModal } from '../../components/common/ConfirmationModal.js';

export function EmployeeWorkRolesPage() {
  const { t } = useTranslation();
  const { userId } = useParams<{ userId: string }>();
  const queryClient = useQueryClient();

  const [selectedRoleId, setSelectedRoleId] = useState<string>('');
  const [removingRole, setRemovingRole] = useState<WorkRole | null>(null);
  const [successBanner, setSuccessBanner] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const showSuccess = (msg: string) => {
    setSuccessBanner(msg);
    setTimeout(() => setSuccessBanner(null), 5000);
  };

  // 1. Fetch User details
  const {
    data: user,
    isLoading: userLoading,
    isError: userError,
  } = useQuery({
    queryKey: ['admin', 'users', userId],
    queryFn: () => fetchAdminUser(userId!),
    enabled: !!userId,
  });

  // 2. Fetch Employee's Assigned Work Roles
  const {
    data: assignedData,
    isLoading: assignedLoading,
    isError: assignedError,
    refetch: refetchAssigned,
  } = useQuery({
    queryKey: ['admin', 'employee-work-roles', userId],
    queryFn: () => fetchEmployeeWorkRoles(userId!),
    enabled: !!userId,
  });

  // 3. Fetch Catalogue of all Work Roles
  const {
    data: allRoles = [],
    isLoading: rolesLoading,
  } = useQuery({
    queryKey: ['admin', 'work-roles'],
    queryFn: fetchWorkRoles,
  });

  const assignedRoles = assignedData?.workRoles || [];
  const assignedRoleIds = new Set(assignedRoles.map((r) => r.id));

  // Available active roles that are not yet assigned to this employee
  const availableRoles = allRoles.filter(
    (role) => role.isActive && !assignedRoleIds.has(role.id)
  );

  // Assign Mutation
  const assignMutation = useMutation({
    mutationFn: (workRoleId: string) => assignWorkRoleToEmployee(userId!, workRoleId),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['admin', 'employee-work-roles', userId],
      });
      setSelectedRoleId('');
      setActionError(null);
      showSuccess(t('admin.employeeWorkRoles.notifications.assigned'));
    },
    onError: (err: any) => {
      setActionError(
        err?.response?.data?.message ||
          t('admin.employeeWorkRoles.errors.assignFailed', {
            defaultValue: 'Failed to assign work role.',
          })
      );
    },
  });

  // Remove Mutation
  const removeMutation = useMutation({
    mutationFn: (workRoleId: string) =>
      removeWorkRoleFromEmployee(userId!, workRoleId),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['admin', 'employee-work-roles', userId],
      });
      setRemovingRole(null);
      setActionError(null);
      showSuccess(t('admin.employeeWorkRoles.notifications.removed'));
    },
    onError: (err: any) => {
      setActionError(
        err?.response?.data?.message ||
          t('admin.employeeWorkRoles.errors.removeFailed', {
            defaultValue: 'Failed to remove work role.',
          })
      );
    },
  });

  const handleAssign = () => {
    if (!selectedRoleId) return;
    setActionError(null);
    assignMutation.mutate(selectedRoleId);
  };

  const isLoading = userLoading || assignedLoading || rolesLoading;
  const isError = userError || assignedError;

  return (
    <div className="space-y-6">
      {/* Back button & Breadcrumbs */}
      <div>
        <Button variant="ghost" size="sm" asChild className="gap-2 mb-2">
          <Link to="/admin/users">
            <ArrowLeft className="h-4 w-4" />
            <span>{t('admin.employeeWorkRoles.backToUsers')}</span>
          </Link>
        </Button>
      </div>

      {/* Notifications */}
      {successBanner && (
        <Alert className="border-emerald-500/50 bg-emerald-50 text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200">
          <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
          <AlertDescription>{successBanner}</AlertDescription>
        </Alert>
      )}

      {actionError && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{actionError}</AlertDescription>
        </Alert>
      )}

      {isLoading ? (
        <div className="flex flex-col items-center justify-center p-12 bg-card rounded-xl border text-center space-y-3">
          <RefreshCw className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm font-medium text-muted-foreground">
            {t('common.loading')}
          </p>
        </div>
      ) : isError || !user ? (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            {t('admin.employeeWorkRoles.errors.loadFailed')}
          </AlertDescription>
        </Alert>
      ) : (
        <>
          {/* Employee Info Header Card */}
          <div className="bg-card p-6 rounded-xl border shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-lg">
                  {user.displayName.charAt(0).toUpperCase()}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-xl font-bold">{user.displayName}</h2>
                    <Badge variant="secondary" className="capitalize text-xs">
                      {t(`roles.${user.systemRole}`, { defaultValue: user.systemRole })}
                    </Badge>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground mt-1">
                    <span>@{user.username}</span>
                    <span>•</span>
                    <span>{user.employeeProfile?.employeeCode || 'No Code'}</span>
                    <span>•</span>
                    <span>
                      {user.employeeProfile?.jobTitle || 'No Title'} (
                      {user.employeeProfile?.department || 'No Dept'})
                    </span>
                  </div>
                </div>
              </div>

              <div className="text-xs text-muted-foreground sm:text-right">
                <p>
                  {t('admin.employeeWorkRoles.shiftHours')}:{' '}
                  <span className="font-semibold text-foreground">
                    {user.employeeProfile?.standardShiftHours ?? 8}h
                  </span>
                </p>
                <p>
                  {t('admin.employeeWorkRoles.workingDays')}:{' '}
                  <span className="font-semibold text-foreground">
                    {user.employeeProfile?.workingDaysPerWeek ?? 5} days/week
                  </span>
                </p>
              </div>
            </div>
          </div>

          {/* Assignment Section */}
          <div className="bg-card p-6 rounded-xl border shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b pb-4">
              <div>
                <h3 className="text-base font-semibold">
                  {t('admin.employeeWorkRoles.assignTitle')}
                </h3>
                <p className="text-xs text-muted-foreground">
                  {t('admin.employeeWorkRoles.assignSubtitle')}
                </p>
              </div>

              {/* Assign Dropdown & Button */}
              <div className="flex items-center gap-2">
                <div className="w-64">
                  <Select
                    value={selectedRoleId}
                    onChange={(e) => setSelectedRoleId(e.target.value)}
                    disabled={availableRoles.length === 0 || assignMutation.isPending}
                  >
                    <option value="">
                      {availableRoles.length === 0
                        ? t('admin.employeeWorkRoles.noRolesAvailable')
                        : t('admin.employeeWorkRoles.selectRolePlaceholder')}
                    </option>
                    {availableRoles.map((role) => (
                      <option key={role.id} value={role.id}>
                        {role.name}
                      </option>
                    ))}
                  </Select>
                </div>
                <Button
                  onClick={handleAssign}
                  disabled={!selectedRoleId || assignMutation.isPending}
                  className="gap-1.5 shrink-0"
                >
                  <Plus className="h-4 w-4" />
                  <span>{t('admin.employeeWorkRoles.actions.assign')}</span>
                </Button>
              </div>
            </div>

            {/* Currently Assigned Work Roles List */}
            <div>
              <h4 className="text-sm font-semibold mb-3">
                {t('admin.employeeWorkRoles.currentRolesTitle')} ({assignedRoles.length})
              </h4>

              {assignedRoles.length === 0 ? (
                <div className="flex flex-col items-center justify-center p-8 border border-dashed rounded-lg text-center space-y-2">
                  <Briefcase className="h-8 w-8 text-muted-foreground" />
                  <p className="text-sm font-medium">
                    {t('admin.employeeWorkRoles.states.emptyTitle')}
                  </p>
                  <p className="text-xs text-muted-foreground max-w-sm">
                    {t('admin.employeeWorkRoles.states.emptyDescription')}
                  </p>
                </div>
              ) : (
                <div className="divide-y border rounded-lg overflow-hidden bg-background">
                  {assignedRoles.map((role) => (
                    <div
                      key={role.id}
                      className="flex items-center justify-between p-4 hover:bg-muted/30 transition-colors"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-sm">{role.name}</span>
                          {!role.isActive && (
                            <Badge variant="destructive" className="text-[10px] px-1.5 py-0">
                              {t('admin.workRoles.status.inactive')}
                            </Badge>
                          )}
                        </div>
                        {role.description && (
                          <p className="text-xs text-muted-foreground">
                            {role.description}
                          </p>
                        )}
                      </div>

                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setRemovingRole(role)}
                        title={t('admin.employeeWorkRoles.actions.remove')}
                        className="text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/30 gap-1.5 h-8 px-2.5"
                      >
                        <Trash2 className="h-4 w-4" />
                        <span className="text-xs">{t('common.remove')}</span>
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* Confirmation Modal: Remove Role Assignment */}
      <ConfirmationModal
        open={!!removingRole}
        onOpenChange={(open) => !open && setRemovingRole(null)}
        title={t('admin.employeeWorkRoles.confirmRemove.title')}
        description={t('admin.employeeWorkRoles.confirmRemove.description', {
          roleName: removingRole?.name,
          employeeName: user?.displayName,
        })}
        confirmLabel={t('common.remove')}
        variant="destructive"
        isLoading={removeMutation.isPending}
        onConfirm={() => {
          if (removingRole) {
            removeMutation.mutate(removingRole.id);
          }
        }}
      />
    </div>
  );
}
