import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '../ui/dialog.js';
import { Button } from '../ui/button.js';
import { Input } from '../ui/input.js';
import { Label } from '../ui/label.js';
import { Select } from '../ui/select.js';
import { Alert, AlertDescription } from '../ui/alert.js';
import type { AdminUser, SystemRole } from '../../types/index.js';
import { updateEmployeeProfile, updateUserRole } from '../../api/adminUsers.js';
import { useAuth } from '../../hooks/useAuth.js';
import { useState } from 'react';

interface EmployeeProfileModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: AdminUser | null;
  onSuccess: () => void;
}

interface FormValues {
  systemRole: SystemRole;
  employeeCode: string;
  department: string;
  jobTitle: string;
  startDate: string;
  standardShiftHours: number;
  workingDaysPerWeek: number;
  managerUserId: string;
}

export function EmployeeProfileModal({
  open,
  onOpenChange,
  user,
  onSuccess,
}: EmployeeProfileModalProps) {
  const { t } = useTranslation();
  const { user: currentUser } = useAuth();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isSystemAdmin = currentUser?.systemRole === 'system_admin';
  const isEditingSelf = currentUser?.id === user?.id;

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>();

  useEffect(() => {
    if (user) {
      setErrorMsg(null);
      const profile = user.employeeProfile;
      const formattedStartDate = profile?.startDate
        ? new Date(profile.startDate).toISOString().split('T')[0]
        : '';

      reset({
        systemRole: user.systemRole,
        employeeCode: profile?.employeeCode || `EMP-${user.username.toUpperCase()}`,
        department: profile?.department || '',
        jobTitle: profile?.jobTitle || '',
        startDate: formattedStartDate || '',
        standardShiftHours: profile?.standardShiftHours ?? 8,
        workingDaysPerWeek: profile?.workingDaysPerWeek ?? 5,
        managerUserId: profile?.managerUserId || '',
      });
    }
  }, [user, reset]);

  const onSubmit = async (data: FormValues) => {
    if (!user) return;
    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      // 1. Update system role if changed and actor is system admin and not self
      if (isSystemAdmin && !isEditingSelf && data.systemRole !== user.systemRole) {
        await updateUserRole(user.id, data.systemRole);
      }

      // 2. Update employee profile
      await updateEmployeeProfile(user.id, {
        employeeCode: data.employeeCode.trim() || undefined,
        department: data.department.trim() || undefined,
        jobTitle: data.jobTitle.trim() || undefined,
        startDate: data.startDate || null,
        standardShiftHours: Number(data.standardShiftHours) || 8,
        workingDaysPerWeek: Number(data.workingDaysPerWeek) || 5,
        managerUserId: data.managerUserId.trim() || null,
      });

      onSuccess();
      onOpenChange(false);
    } catch (err: any) {
      const msg =
        err?.response?.data?.message ||
        t('admin.users.profileModal.errorGeneric', {
          defaultValue: 'Failed to update employee profile.',
        });
      setErrorMsg(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent onClose={() => onOpenChange(false)} className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{t('admin.users.profileModal.title')}</DialogTitle>
          <DialogDescription>
            {t('admin.users.profileModal.description', {
              name: user?.displayName,
              username: user?.username,
            })}
          </DialogDescription>
        </DialogHeader>

        {errorMsg && (
          <Alert variant="destructive" className="mb-4">
            <AlertDescription>{errorMsg}</AlertDescription>
          </Alert>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* System Role */}
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="systemRole">
                {t('admin.users.fields.systemRole')}
              </Label>
              <Select
                id="systemRole"
                disabled={!isSystemAdmin || isEditingSelf}
                {...register('systemRole')}
              >
                <option value="employee">{t('roles.employee')}</option>
                <option value="project_manager">{t('roles.project_manager')}</option>
                <option value="hr_admin">{t('roles.hr_admin')}</option>
                <option value="system_admin">{t('roles.system_admin')}</option>
                <option value="viewer">{t('roles.viewer')}</option>
              </Select>
              {isEditingSelf && (
                <p className="text-xs text-muted-foreground">
                  {t('admin.users.profileModal.selfRoleNote', {
                    defaultValue: 'You cannot change your own system role.',
                  })}
                </p>
              )}
              {!isSystemAdmin && (
                <p className="text-xs text-muted-foreground">
                  {t('admin.users.profileModal.hrRoleNote', {
                    defaultValue: 'Only System Admins may change system roles.',
                  })}
                </p>
              )}
            </div>

            {/* Employee Code */}
            <div className="space-y-1.5">
              <Label htmlFor="employeeCode">
                {t('admin.users.fields.employeeCode')}
              </Label>
              <Input
                id="employeeCode"
                {...register('employeeCode', { required: true })}
                placeholder="e.g. EMP-101"
              />
              {errors.employeeCode && (
                <p className="text-xs text-destructive">
                  {t('common.required')}
                </p>
              )}
            </div>

            {/* Department */}
            <div className="space-y-1.5">
              <Label htmlFor="department">
                {t('admin.users.fields.department')}
              </Label>
              <Input
                id="department"
                {...register('department')}
                placeholder="e.g. Engineering"
              />
            </div>

            {/* Job Title */}
            <div className="space-y-1.5">
              <Label htmlFor="jobTitle">
                {t('admin.users.fields.jobTitle')}
              </Label>
              <Input
                id="jobTitle"
                {...register('jobTitle')}
                placeholder="e.g. Senior Software Engineer"
              />
            </div>

            {/* Start Date */}
            <div className="space-y-1.5">
              <Label htmlFor="startDate">
                {t('admin.users.fields.startDate')}
              </Label>
              <Input id="startDate" type="date" {...register('startDate')} />
            </div>

            {/* Shift Hours */}
            <div className="space-y-1.5">
              <Label htmlFor="standardShiftHours">
                {t('admin.users.fields.standardShiftHours')}
              </Label>
              <Input
                id="standardShiftHours"
                type="number"
                step="0.5"
                min="1"
                max="24"
                {...register('standardShiftHours', {
                  valueAsNumber: true,
                  min: 1,
                  max: 24,
                })}
              />
            </div>

            {/* Working Days Per Week */}
            <div className="space-y-1.5">
              <Label htmlFor="workingDaysPerWeek">
                {t('admin.users.fields.workingDaysPerWeek')}
              </Label>
              <Input
                id="workingDaysPerWeek"
                type="number"
                min="1"
                max="7"
                {...register('workingDaysPerWeek', {
                  valueAsNumber: true,
                  min: 1,
                  max: 7,
                })}
              />
            </div>

            {/* Manager User ID */}
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="managerUserId">
                {t('admin.users.fields.managerUserId')}
              </Label>
              <Input
                id="managerUserId"
                {...register('managerUserId')}
                placeholder="Manager User UUID (optional)"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              {t('common.cancel')}
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? t('common.saving') : t('common.saveChanges')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
