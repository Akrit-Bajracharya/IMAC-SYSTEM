import { useState } from 'react';
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
import { createAdminUser, type CreateAdminUserInput } from '../../api/adminUsers.js';

interface CreateUserModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: (user: AdminUser, tempPassword: string) => void;
}

interface FormValues {
  username: string;
  displayName: string;
  systemRole: SystemRole;
  employeeCode: string;
  department: string;
  jobTitle: string;
  startDate: string;
  standardShiftHours: number;
  workingDaysPerWeek: number;
  managerUserId: string;
}

export function CreateUserModal({
  open,
  onOpenChange,
  onSuccess,
}: CreateUserModalProps) {
  const { t } = useTranslation();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    defaultValues: {
      username: '',
      displayName: '',
      systemRole: 'employee',
      employeeCode: '',
      department: '',
      jobTitle: '',
      startDate: '',
      standardShiftHours: 8,
      workingDaysPerWeek: 5,
      managerUserId: '',
    },
  });

  const onSubmit = async (data: FormValues) => {
    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      const payload: CreateAdminUserInput = {
        username: data.username.trim(),
        displayName: data.displayName.trim(),
        systemRole: data.systemRole,
        employeeCode: data.employeeCode.trim() || undefined,
        department: data.department.trim() || undefined,
        jobTitle: data.jobTitle.trim() || undefined,
        startDate: data.startDate || undefined,
        standardShiftHours: Number(data.standardShiftHours) || 8,
        workingDaysPerWeek: Number(data.workingDaysPerWeek) || 5,
        managerUserId: data.managerUserId.trim() || undefined,
      };

      const result = await createAdminUser(payload);
      reset();
      onOpenChange(false);
      onSuccess(result.user, result.temporaryPassword);
    } catch (err: any) {
      const msg =
        err?.response?.data?.message ||
        t('admin.users.createModal.errorGeneric', {
          defaultValue: 'Failed to create user account.',
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
          <DialogTitle>{t('admin.users.createModal.title')}</DialogTitle>
          <DialogDescription>
            {t('admin.users.createModal.description')}
          </DialogDescription>
        </DialogHeader>

        {errorMsg && (
          <Alert variant="destructive" className="mb-4">
            <AlertDescription>{errorMsg}</AlertDescription>
          </Alert>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Username */}
            <div className="space-y-1.5">
              <Label htmlFor="create-username">
                {t('admin.users.fields.username')} *
              </Label>
              <Input
                id="create-username"
                {...register('username', {
                  required: true,
                  minLength: 3,
                  pattern: /^[a-zA-Z0-9_.\-]+$/,
                })}
                placeholder="e.g. jdoe"
              />
              {errors.username && (
                <p className="text-xs text-destructive">
                  {t('admin.users.createModal.usernameError', {
                    defaultValue: 'Username must be at least 3 characters and alphanumeric.',
                  })}
                </p>
              )}
            </div>

            {/* Display Name */}
            <div className="space-y-1.5">
              <Label htmlFor="create-displayName">
                {t('admin.users.fields.displayName')} *
              </Label>
              <Input
                id="create-displayName"
                {...register('displayName', { required: true })}
                placeholder="e.g. John Doe"
              />
              {errors.displayName && (
                <p className="text-xs text-destructive">
                  {t('common.required')}
                </p>
              )}
            </div>

            {/* System Role */}
            <div className="space-y-1.5">
              <Label htmlFor="create-systemRole">
                {t('admin.users.fields.systemRole')} *
              </Label>
              <Select id="create-systemRole" {...register('systemRole')}>
                <option value="employee">{t('roles.employee')}</option>
                <option value="project_manager">{t('roles.project_manager')}</option>
                <option value="hr_admin">{t('roles.hr_admin')}</option>
                <option value="system_admin">{t('roles.system_admin')}</option>
                <option value="viewer">{t('roles.viewer')}</option>
              </Select>
            </div>

            {/* Employee Code */}
            <div className="space-y-1.5">
              <Label htmlFor="create-employeeCode">
                {t('admin.users.fields.employeeCode')}
              </Label>
              <Input
                id="create-employeeCode"
                {...register('employeeCode')}
                placeholder="e.g. EMP-001 (auto if blank)"
              />
            </div>

            {/* Department */}
            <div className="space-y-1.5">
              <Label htmlFor="create-department">
                {t('admin.users.fields.department')}
              </Label>
              <Input
                id="create-department"
                {...register('department')}
                placeholder="e.g. Engineering"
              />
            </div>

            {/* Job Title */}
            <div className="space-y-1.5">
              <Label htmlFor="create-jobTitle">
                {t('admin.users.fields.jobTitle')}
              </Label>
              <Input
                id="create-jobTitle"
                {...register('jobTitle')}
                placeholder="e.g. Senior Developer"
              />
            </div>

            {/* Start Date */}
            <div className="space-y-1.5">
              <Label htmlFor="create-startDate">
                {t('admin.users.fields.startDate')}
              </Label>
              <Input
                id="create-startDate"
                type="date"
                {...register('startDate')}
              />
            </div>

            {/* Standard Shift Hours */}
            <div className="space-y-1.5">
              <Label htmlFor="create-standardShiftHours">
                {t('admin.users.fields.standardShiftHours')}
              </Label>
              <Input
                id="create-standardShiftHours"
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

            {/* Working Days */}
            <div className="space-y-1.5">
              <Label htmlFor="create-workingDaysPerWeek">
                {t('admin.users.fields.workingDaysPerWeek')}
              </Label>
              <Input
                id="create-workingDaysPerWeek"
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
            <div className="space-y-1.5">
              <Label htmlFor="create-managerUserId">
                {t('admin.users.fields.managerUserId')}
              </Label>
              <Input
                id="create-managerUserId"
                {...register('managerUserId')}
                placeholder="UUID (optional)"
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
              {isSubmitting ? t('common.creating') : t('admin.users.createModal.submit')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
