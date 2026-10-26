import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import {
  Users,
  Search,
  Plus,
  KeyRound,
  UserCheck,
  UserX,
  Briefcase,
  Edit2,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';
import { fetchAdminUsers, deactivateUser, reactivateUser, resetUserPassword } from '../../api/adminUsers.js';
import type { AdminUser, SystemRole } from '../../types/index.js';
import { Button } from '../../components/ui/button.js';
import { Input } from '../../components/ui/input.js';
import { Select } from '../../components/ui/select.js';
import { Badge } from '../../components/ui/badge.js';
import { Alert, AlertDescription } from '../../components/ui/alert.js';
import { CreateUserModal } from '../../components/admin/CreateUserModal.js';
import { EmployeeProfileModal } from '../../components/admin/EmployeeProfileModal.js';
import { ConfirmationModal } from '../../components/common/ConfirmationModal.js';
import { TemporaryPasswordModal } from '../../components/common/TemporaryPasswordModal.js';
import { useAuth } from '../../hooks/useAuth.js';

export function UsersListPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { user: currentUser } = useAuth();

  // Search & Filter state
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Modals state
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<AdminUser | null>(null);
  const [deactivatingUser, setDeactivatingUser] = useState<AdminUser | null>(null);
  const [reactivatingUser, setReactivatingUser] = useState<AdminUser | null>(null);
  const [resettingUser, setResettingUser] = useState<AdminUser | null>(null);
  const [tempPasswordState, setTempPasswordState] = useState<{
    username: string;
    temporaryPassword: string;
  } | null>(null);

  // Success & Error message banner state
  const [successBanner, setSuccessBanner] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const showSuccess = (msg: string) => {
    setSuccessBanner(msg);
    setTimeout(() => setSuccessBanner(null), 5000);
  };

  // Queries & Mutations
  const {
    data: users = [],
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ['admin', 'users'],
    queryFn: fetchAdminUsers,
  });

  const deactivateMutation = useMutation({
    mutationFn: (userId: string) => deactivateUser(userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
      setActionError(null);
      showSuccess(t('admin.users.notifications.deactivated'));
      setDeactivatingUser(null);
    },
    onError: (err: any) => {
      setActionError(
        err?.response?.data?.message ||
          t('admin.users.errors.deactivateFailed', {
            defaultValue: 'Failed to deactivate user account.',
          })
      );
      setDeactivatingUser(null);
    },
  });

  const reactivateMutation = useMutation({
    mutationFn: (userId: string) => reactivateUser(userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
      setActionError(null);
      showSuccess(t('admin.users.notifications.reactivated'));
      setReactivatingUser(null);
    },
    onError: (err: any) => {
      setActionError(
        err?.response?.data?.message ||
          t('admin.users.errors.reactivateFailed', {
            defaultValue: 'Failed to reactivate user account.',
          })
      );
      setReactivatingUser(null);
    },
  });

  const resetPasswordMutation = useMutation({
    mutationFn: (userId: string) => resetUserPassword(userId),
    onSuccess: (data, userId) => {
      const targetUser = users.find((u) => u.id === userId);
      setResettingUser(null);
      setTempPasswordState({
        username: targetUser?.username || userId,
        temporaryPassword: data.temporaryPassword,
      });
      showSuccess(t('admin.users.notifications.passwordReset'));
    },
  });

  // Filtered users
  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      // 1. Role filter
      if (roleFilter !== 'all' && u.systemRole !== roleFilter) return false;

      // 2. Status filter
      if (statusFilter === 'active' && !u.isActive) return false;
      if (statusFilter === 'inactive' && u.isActive) return false;

      // 3. Search query
      if (search.trim()) {
        const query = search.toLowerCase();
        const matchesName = u.displayName.toLowerCase().includes(query);
        const matchesUsername = u.username.toLowerCase().includes(query);
        const matchesCode = u.employeeProfile?.employeeCode?.toLowerCase().includes(query) ?? false;
        const matchesDept = u.employeeProfile?.department?.toLowerCase().includes(query) ?? false;
        const matchesJob = u.employeeProfile?.jobTitle?.toLowerCase().includes(query) ?? false;
        return matchesName || matchesUsername || matchesCode || matchesDept || matchesJob;
      }

      return true;
    });
  }, [users, roleFilter, statusFilter, search]);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {t('admin.users.pageTitle')}
          </h1>
          <p className="text-sm text-muted-foreground">
            {t('admin.users.pageSubtitle')}
          </p>
        </div>
        <Button onClick={() => setIsCreateOpen(true)} className="gap-2">
          <Plus className="h-4 w-4" />
          <span>{t('admin.users.actions.createUser')}</span>
        </Button>
      </div>

      {/* Success Banner */}
      {successBanner && (
        <Alert className="border-emerald-500/50 bg-emerald-50 text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200">
          <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
          <AlertDescription>{successBanner}</AlertDescription>
        </Alert>
      )}

      {/* Action Error Banner */}
      {actionError && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{actionError}</AlertDescription>
        </Alert>
      )}

      {/* Filters Bar */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3 bg-card p-4 rounded-xl border">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={t('admin.users.filters.searchPlaceholder')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* Role Filter */}
        <div className="w-full md:w-48">
          <Select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
          >
            <option value="all">{t('admin.users.filters.allRoles')}</option>
            <option value="system_admin">{t('roles.system_admin')}</option>
            <option value="hr_admin">{t('roles.hr_admin')}</option>
            <option value="project_manager">{t('roles.project_manager')}</option>
            <option value="employee">{t('roles.employee')}</option>
            <option value="viewer">{t('roles.viewer')}</option>
          </Select>
        </div>

        {/* Status Filter */}
        <div className="w-full md:w-40">
          <Select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="all">{t('admin.users.filters.allStatuses')}</option>
            <option value="active">{t('admin.users.filters.active')}</option>
            <option value="inactive">{t('admin.users.filters.inactive')}</option>
          </Select>
        </div>

        {/* Refresh Button */}
        <Button
          variant="outline"
          size="icon"
          onClick={() => refetch()}
          title={t('common.refresh')}
          className="shrink-0"
        >
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>

      {/* Main Table / State View */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center p-12 bg-card rounded-xl border text-center space-y-3">
          <RefreshCw className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm font-medium text-muted-foreground">
            {t('admin.users.states.loading')}
          </p>
        </div>
      ) : isError ? (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            {error instanceof Error ? error.message : t('common.error')}
          </AlertDescription>
        </Alert>
      ) : filteredUsers.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-12 bg-card rounded-xl border text-center space-y-4">
          <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center text-muted-foreground">
            <Users className="h-6 w-6" />
          </div>
          <div>
            <h3 className="font-semibold text-lg">{t('admin.users.states.emptyTitle')}</h3>
            <p className="text-sm text-muted-foreground max-w-sm mt-1">
              {users.length === 0
                ? t('admin.users.states.emptyDescription')
                : t('admin.users.states.noMatches')}
            </p>
          </div>
          {users.length === 0 && (
            <Button onClick={() => setIsCreateOpen(true)} className="gap-2">
              <Plus className="h-4 w-4" />
              <span>{t('admin.users.actions.createUser')}</span>
            </Button>
          )}
        </div>
      ) : (
        <div className="rounded-xl border bg-card overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-muted/50 border-b text-muted-foreground">
                <tr>
                  <th className="py-3.5 px-4 font-semibold">{t('admin.users.table.user')}</th>
                  <th className="py-3.5 px-4 font-semibold">{t('admin.users.table.role')}</th>
                  <th className="py-3.5 px-4 font-semibold">{t('admin.users.table.employeeCode')}</th>
                  <th className="py-3.5 px-4 font-semibold">{t('admin.users.table.department')}</th>
                  <th className="py-3.5 px-4 font-semibold">{t('admin.users.table.status')}</th>
                  <th className="py-3.5 px-4 font-semibold text-right">{t('admin.users.table.actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredUsers.map((u) => {
                  const isSelf = currentUser?.id === u.id;
                  return (
                    <tr key={u.id} className="hover:bg-muted/30 transition-colors">
                      {/* Name & Username */}
                      <td className="py-3.5 px-4">
                        <div className="flex flex-col">
                          <span className="font-medium text-foreground">
                            {u.displayName}
                            {isSelf && (
                              <span className="ml-2 text-xs text-primary font-normal">
                                ({t('common.you')})
                              </span>
                            )}
                          </span>
                          <span className="text-xs text-muted-foreground">@{u.username}</span>
                        </div>
                      </td>

                      {/* System Role */}
                      <td className="py-3.5 px-4">
                        <Badge variant="secondary" className="capitalize text-xs font-normal">
                          {t(`roles.${u.systemRole}`, { defaultValue: u.systemRole })}
                        </Badge>
                      </td>

                      {/* Employee Code */}
                      <td className="py-3.5 px-4">
                        <span className="font-mono text-xs">
                          {u.employeeProfile?.employeeCode || '—'}
                        </span>
                      </td>

                      {/* Department & Job Title */}
                      <td className="py-3.5 px-4">
                        <div className="flex flex-col">
                          <span className="text-xs font-medium">
                            {u.employeeProfile?.department || '—'}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {u.employeeProfile?.jobTitle || '—'}
                          </span>
                        </div>
                      </td>

                      {/* Active Status */}
                      <td className="py-3.5 px-4">
                        {u.isActive ? (
                          <span className="inline-flex items-center gap-1.5 text-xs text-emerald-600 font-medium">
                            <span className="h-2 w-2 rounded-full bg-emerald-500" />
                            {t('admin.users.status.active')}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 text-xs text-rose-600 font-medium">
                            <span className="h-2 w-2 rounded-full bg-rose-500" />
                            {t('admin.users.status.inactive')}
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="inline-flex items-center justify-end gap-1">
                          {/* Edit Profile */}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setEditingUser(u)}
                            title={t('admin.users.actions.editProfile')}
                            className="h-8 px-2"
                          >
                            <Edit2 className="h-4 w-4" />
                          </Button>

                          {/* Work Roles Assignment */}
                          <Button
                            variant="ghost"
                            size="sm"
                            asChild
                            title={t('admin.users.actions.assignWorkRoles')}
                            className="h-8 px-2"
                          >
                            <Link to={`/admin/users/${u.id}/work-roles`}>
                              <Briefcase className="h-4 w-4" />
                            </Link>
                          </Button>

                          {/* Reset Password */}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setResettingUser(u)}
                            disabled={isSelf}
                            title={
                              isSelf
                                ? t('admin.users.tooltips.cannotResetSelf')
                                : t('admin.users.actions.resetPassword')
                            }
                            className="h-8 px-2"
                          >
                            <KeyRound className="h-4 w-4" />
                          </Button>

                          {/* Deactivate / Reactivate */}
                          {u.isActive ? (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setActionError(null);
                                setDeactivatingUser(u);
                              }}
                              disabled={isSelf}
                              title={
                                isSelf
                                  ? t('admin.users.tooltips.cannotDeactivateSelf')
                                  : t('admin.users.actions.deactivate')
                              }
                              className="h-8 px-2 text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/30"
                            >
                              <UserX className="h-4 w-4" />
                            </Button>
                          ) : (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setActionError(null);
                                setReactivatingUser(u);
                              }}
                              title={t('admin.users.actions.reactivate')}
                              className="h-8 px-2 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/30"
                            >
                              <UserCheck className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal: Create User */}
      <CreateUserModal
        open={isCreateOpen}
        onOpenChange={setIsCreateOpen}
        onSuccess={(createdUser, tempPassword) => {
          queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
          setTempPasswordState({
            username: createdUser.username,
            temporaryPassword: tempPassword,
          });
          showSuccess(t('admin.users.notifications.created'));
        }}
      />

      {/* Modal: Edit Profile & Role */}
      <EmployeeProfileModal
        open={!!editingUser}
        onOpenChange={(open) => !open && setEditingUser(null)}
        user={editingUser}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
          showSuccess(t('admin.users.notifications.profileUpdated'));
        }}
      />

      {/* Modal: Deactivate Confirmation */}
      <ConfirmationModal
        open={!!deactivatingUser}
        onOpenChange={(open) => !open && setDeactivatingUser(null)}
        title={t('admin.users.confirmDeactivate.title')}
        description={t('admin.users.confirmDeactivate.description', {
          name: deactivatingUser?.displayName,
          username: deactivatingUser?.username,
        })}
        confirmLabel={t('admin.users.confirmDeactivate.confirmButton')}
        variant="destructive"
        isLoading={deactivateMutation.isPending}
        onConfirm={() => {
          if (deactivatingUser) {
            deactivateMutation.mutate(deactivatingUser.id);
          }
        }}
      />

      {/* Modal: Reactivate Confirmation */}
      <ConfirmationModal
        open={!!reactivatingUser}
        onOpenChange={(open) => !open && setReactivatingUser(null)}
        title={t('admin.users.confirmReactivate.title')}
        description={t('admin.users.confirmReactivate.description', {
          name: reactivatingUser?.displayName,
          username: reactivatingUser?.username,
        })}
        confirmLabel={t('admin.users.confirmReactivate.confirmButton')}
        variant="default"
        isLoading={reactivateMutation.isPending}
        onConfirm={() => {
          if (reactivatingUser) {
            setActionError(null);
            reactivateMutation.mutate(reactivatingUser.id);
          }
        }}
      />

      {/* Modal: Reset Password Confirmation */}
      <ConfirmationModal
        open={!!resettingUser}
        onOpenChange={(open) => !open && setResettingUser(null)}
        title={t('admin.users.confirmReset.title')}
        description={t('admin.users.confirmReset.description', {
          name: resettingUser?.displayName,
        })}
        confirmLabel={t('admin.users.confirmReset.confirmButton')}
        isLoading={resetPasswordMutation.isPending}
        onConfirm={() => {
          if (resettingUser) {
            resetPasswordMutation.mutate(resettingUser.id);
          }
        }}
      />

      {/* Modal: One-Time Temporary Password Display */}
      {tempPasswordState && (
        <TemporaryPasswordModal
          open={!!tempPasswordState}
          onOpenChange={(open) => !open && setTempPasswordState(null)}
          username={tempPasswordState.username}
          temporaryPassword={tempPasswordState.temporaryPassword}
        />
      )}
    </div>
  );
}
