import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useForm } from 'react-hook-form';
import {
  Briefcase,
  Search,
  Plus,
  Edit2,
  PowerOff,
  CheckCircle2,
  RefreshCw,
  AlertCircle,
  ToggleLeft,
  ToggleRight,
} from 'lucide-react';
import {
  fetchWorkRoles,
  createWorkRole,
  updateWorkRole,
  deactivateWorkRole,
} from '../../api/adminWorkRoles.js';
import type { WorkRole } from '../../types/index.js';
import { Button } from '../../components/ui/button.js';
import { Input } from '../../components/ui/input.js';
import { Label } from '../../components/ui/label.js';
import { Select } from '../../components/ui/select.js';
import { Badge } from '../../components/ui/badge.js';
import { Alert, AlertDescription } from '../../components/ui/alert.js';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '../../components/ui/dialog.js';
import { ConfirmationModal } from '../../components/common/ConfirmationModal.js';

interface WorkRoleFormValues {
  name: string;
  description: string;
  isActive?: boolean;
}

export function WorkRolesPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  // Filters
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');

  // Modal states
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<WorkRole | null>(null);
  const [deactivatingRole, setDeactivatingRole] = useState<WorkRole | null>(null);
  const [reactivatingRole, setReactivatingRole] = useState<WorkRole | null>(null);

  // Success banner
  const [successBanner, setSuccessBanner] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const showSuccess = (msg: string) => {
    setSuccessBanner(msg);
    setTimeout(() => setSuccessBanner(null), 5000);
  };

  // React Hook Form for Create/Edit
  const {
    register: registerCreate,
    handleSubmit: handleCreateSubmit,
    reset: resetCreate,
    formState: { errors: createErrors, isSubmitting: isCreating },
  } = useForm<WorkRoleFormValues>({
    defaultValues: { name: '', description: '' },
  });

  const {
    register: registerEdit,
    handleSubmit: handleEditSubmit,
    reset: resetEdit,
    formState: { errors: editErrors, isSubmitting: isEditing },
  } = useForm<WorkRoleFormValues>();

  // Fetch Work Roles
  const {
    data: workRoles = [],
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ['admin', 'work-roles'],
    queryFn: fetchWorkRoles,
  });

  // Mutations
  const createMutation = useMutation({
    mutationFn: (data: WorkRoleFormValues) =>
      createWorkRole({
        name: data.name.trim(),
        description: data.description.trim() || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'work-roles'] });
      setIsCreateOpen(false);
      resetCreate();
      showSuccess(t('admin.workRoles.notifications.created'));
    },
    onError: (err: any) => {
      setFormError(
        err?.response?.data?.message ||
          t('admin.workRoles.errors.createFailed', {
            defaultValue: 'Failed to create work role.',
          })
      );
    },
  });

  const editMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: WorkRoleFormValues }) =>
      updateWorkRole(id, {
        name: data.name.trim(),
        description: data.description.trim() || undefined,
        isActive: data.isActive,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'work-roles'] });
      setEditingRole(null);
      resetEdit();
      showSuccess(t('admin.workRoles.notifications.updated'));
    },
    onError: (err: any) => {
      setFormError(
        err?.response?.data?.message ||
          t('admin.workRoles.errors.updateFailed', {
            defaultValue: 'Failed to update work role.',
          })
      );
    },
  });

  const deactivateMutation = useMutation({
    mutationFn: (id: string) => deactivateWorkRole(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'work-roles'] });
      setDeactivatingRole(null);
      showSuccess(t('admin.workRoles.notifications.deactivated'));
    },
  });

  const reactivateMutation = useMutation({
    mutationFn: (id: string) => updateWorkRole(id, { isActive: true }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'work-roles'] });
      setReactivatingRole(null);
      showSuccess(t('admin.workRoles.notifications.reactivated'));
    },
  });

  // Filtered
  const filteredRoles = useMemo(() => {
    return workRoles.filter((role) => {
      if (statusFilter === 'active' && !role.isActive) return false;
      if (statusFilter === 'inactive' && role.isActive) return false;

      if (search.trim()) {
        const query = search.toLowerCase();
        const matchesName = role.name.toLowerCase().includes(query);
        const matchesDesc = role.description?.toLowerCase().includes(query) ?? false;
        return matchesName || matchesDesc;
      }
      return true;
    });
  }, [workRoles, statusFilter, search]);

  const handleOpenEdit = (role: WorkRole) => {
    setFormError(null);
    setEditingRole(role);
    resetEdit({
      name: role.name,
      description: role.description || '',
      isActive: role.isActive,
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {t('admin.workRoles.pageTitle')}
          </h1>
          <p className="text-sm text-muted-foreground">
            {t('admin.workRoles.pageSubtitle')}
          </p>
        </div>
        <Button
          onClick={() => {
            setFormError(null);
            resetCreate();
            setIsCreateOpen(true);
          }}
          className="gap-2"
        >
          <Plus className="h-4 w-4" />
          <span>{t('admin.workRoles.actions.createRole')}</span>
        </Button>
      </div>

      {/* Success Notification */}
      {successBanner && (
        <Alert className="border-emerald-500/50 bg-emerald-50 text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200">
          <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
          <AlertDescription>{successBanner}</AlertDescription>
        </Alert>
      )}

      {/* Filter Toolbar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 bg-card p-4 rounded-xl border">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={t('admin.workRoles.filters.searchPlaceholder')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        <div className="w-full sm:w-44">
          <Select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
          >
            <option value="all">{t('admin.workRoles.filters.allStatuses')}</option>
            <option value="active">{t('admin.workRoles.filters.active')}</option>
            <option value="inactive">{t('admin.workRoles.filters.inactive')}</option>
          </Select>
        </div>

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

      {/* Main Content Area */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center p-12 bg-card rounded-xl border text-center space-y-3">
          <RefreshCw className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm font-medium text-muted-foreground">
            {t('admin.workRoles.states.loading')}
          </p>
        </div>
      ) : isError ? (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            {error instanceof Error ? error.message : t('common.error')}
          </AlertDescription>
        </Alert>
      ) : filteredRoles.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-12 bg-card rounded-xl border text-center space-y-4">
          <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center text-muted-foreground">
            <Briefcase className="h-6 w-6" />
          </div>
          <div>
            <h3 className="font-semibold text-lg">{t('admin.workRoles.states.emptyTitle')}</h3>
            <p className="text-sm text-muted-foreground max-w-sm mt-1">
              {workRoles.length === 0
                ? t('admin.workRoles.states.emptyDescription')
                : t('admin.workRoles.states.noMatches')}
            </p>
          </div>
          {workRoles.length === 0 && (
            <Button
              onClick={() => {
                setFormError(null);
                resetCreate();
                setIsCreateOpen(true);
              }}
              className="gap-2"
            >
              <Plus className="h-4 w-4" />
              <span>{t('admin.workRoles.actions.createRole')}</span>
            </Button>
          )}
        </div>
      ) : (
        <div className="rounded-xl border bg-card overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-muted/50 border-b text-muted-foreground">
                <tr>
                  <th className="py-3.5 px-4 font-semibold">{t('admin.workRoles.table.name')}</th>
                  <th className="py-3.5 px-4 font-semibold">{t('admin.workRoles.table.description')}</th>
                  <th className="py-3.5 px-4 font-semibold">{t('admin.workRoles.table.status')}</th>
                  <th className="py-3.5 px-4 font-semibold">{t('admin.workRoles.table.created')}</th>
                  <th className="py-3.5 px-4 font-semibold text-right">{t('admin.workRoles.table.actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredRoles.map((role) => (
                  <tr key={role.id} className="hover:bg-muted/30 transition-colors">
                    {/* Name */}
                    <td className="py-3.5 px-4">
                      <span className="font-semibold text-foreground">
                        {role.name}
                      </span>
                    </td>

                    {/* Description */}
                    <td className="py-3.5 px-4 max-w-md">
                      <span className="text-xs text-muted-foreground line-clamp-2">
                        {role.description || '—'}
                      </span>
                    </td>

                    {/* Status */}
                    <td className="py-3.5 px-4">
                      {role.isActive ? (
                        <span className="inline-flex items-center gap-1.5 text-xs text-emerald-600 font-medium">
                          <span className="h-2 w-2 rounded-full bg-emerald-500" />
                          {t('admin.workRoles.status.active')}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground font-medium">
                          <span className="h-2 w-2 rounded-full bg-slate-400" />
                          {t('admin.workRoles.status.inactive')}
                        </span>
                      )}
                    </td>

                    {/* Created Date */}
                    <td className="py-3.5 px-4 text-xs text-muted-foreground">
                      {new Date(role.createdAt).toLocaleDateString()}
                    </td>

                    {/* Actions */}
                    <td className="py-3.5 px-4 text-right">
                      <div className="inline-flex items-center justify-end gap-1">
                        {/* Rename / Edit */}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleOpenEdit(role)}
                          title={t('admin.workRoles.actions.editRole')}
                          className="h-8 px-2"
                        >
                          <Edit2 className="h-4 w-4" />
                        </Button>

                        {/* Deactivate / Reactivate */}
                        {role.isActive ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setDeactivatingRole(role)}
                            title={t('admin.workRoles.actions.deactivate')}
                            className="h-8 px-2 text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/30"
                          >
                            <PowerOff className="h-4 w-4" />
                          </Button>
                        ) : (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setReactivatingRole(role)}
                            title={t('admin.workRoles.actions.reactivate')}
                            className="h-8 px-2 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/30"
                          >
                            <ToggleRight className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal: Create Work Role */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent onClose={() => setIsCreateOpen(false)}>
          <DialogHeader>
            <DialogTitle>{t('admin.workRoles.createModal.title')}</DialogTitle>
            <DialogDescription>
              {t('admin.workRoles.createModal.description')}
            </DialogDescription>
          </DialogHeader>

          {formError && (
            <Alert variant="destructive" className="mb-4">
              <AlertDescription>{formError}</AlertDescription>
            </Alert>
          )}

          <form
            onSubmit={handleCreateSubmit((data) => createMutation.mutate(data))}
            className="space-y-4"
          >
            <div className="space-y-1.5">
              <Label htmlFor="create-role-name">
                {t('admin.workRoles.fields.name')} *
              </Label>
              <Input
                id="create-role-name"
                {...registerCreate('name', { required: true, maxLength: 100 })}
                placeholder="e.g. Frontend Engineer, Designer, Coordinator"
              />
              {createErrors.name && (
                <p className="text-xs text-destructive">
                  {t('common.required')}
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="create-role-desc">
                {t('admin.workRoles.fields.description')}
              </Label>
              <Input
                id="create-role-desc"
                {...registerCreate('description', { maxLength: 500 })}
                placeholder="Optional description of tasks and scope"
              />
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsCreateOpen(false)}
                disabled={isCreating}
              >
                {t('common.cancel')}
              </Button>
              <Button type="submit" disabled={isCreating}>
                {isCreating ? t('common.creating') : t('common.create')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal: Rename / Edit Work Role */}
      <Dialog open={!!editingRole} onOpenChange={(open) => !open && setEditingRole(null)}>
        <DialogContent onClose={() => setEditingRole(null)}>
          <DialogHeader>
            <DialogTitle>{t('admin.workRoles.editModal.title')}</DialogTitle>
            <DialogDescription>
              {t('admin.workRoles.editModal.description', { name: editingRole?.name })}
            </DialogDescription>
          </DialogHeader>

          {formError && (
            <Alert variant="destructive" className="mb-4">
              <AlertDescription>{formError}</AlertDescription>
            </Alert>
          )}

          <form
            onSubmit={handleEditSubmit((data) => {
              if (editingRole) {
                editMutation.mutate({ id: editingRole.id, data });
              }
            })}
            className="space-y-4"
          >
            <div className="space-y-1.5">
              <Label htmlFor="edit-role-name">
                {t('admin.workRoles.fields.name')} *
              </Label>
              <Input
                id="edit-role-name"
                {...registerEdit('name', { required: true, maxLength: 100 })}
              />
              {editErrors.name && (
                <p className="text-xs text-destructive">
                  {t('common.required')}
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="edit-role-desc">
                {t('admin.workRoles.fields.description')}
              </Label>
              <Input
                id="edit-role-desc"
                {...registerEdit('description', { maxLength: 500 })}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="edit-role-status">
                {t('admin.workRoles.fields.status')}
              </Label>
              <Select
                id="edit-role-status"
                {...registerEdit('isActive', {
                  setValueAs: (v) => v === 'true' || v === true,
                })}
              >
                <option value="true">{t('admin.workRoles.status.active')}</option>
                <option value="false">{t('admin.workRoles.status.inactive')}</option>
              </Select>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setEditingRole(null)}
                disabled={isEditing}
              >
                {t('common.cancel')}
              </Button>
              <Button type="submit" disabled={isEditing}>
                {isEditing ? t('common.saving') : t('common.saveChanges')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Confirmation Modal: Deactivate Work Role */}
      <ConfirmationModal
        open={!!deactivatingRole}
        onOpenChange={(open) => !open && setDeactivatingRole(null)}
        title={t('admin.workRoles.confirmDeactivate.title')}
        description={t('admin.workRoles.confirmDeactivate.description', {
          name: deactivatingRole?.name,
        })}
        confirmLabel={t('admin.workRoles.actions.deactivate')}
        variant="destructive"
        isLoading={deactivateMutation.isPending}
        onConfirm={() => {
          if (deactivatingRole) {
            deactivateMutation.mutate(deactivatingRole.id);
          }
        }}
      />

      {/* Confirmation Modal: Reactivate Work Role */}
      <ConfirmationModal
        open={!!reactivatingRole}
        onOpenChange={(open) => !open && setReactivatingRole(null)}
        title={t('admin.workRoles.confirmReactivate.title')}
        description={t('admin.workRoles.confirmReactivate.description', {
          name: reactivatingRole?.name,
        })}
        confirmLabel={t('admin.workRoles.actions.reactivate')}
        isLoading={reactivateMutation.isPending}
        onConfirm={() => {
          if (reactivatingRole) {
            reactivateMutation.mutate(reactivatingRole.id);
          }
        }}
      />
    </div>
  );
}
