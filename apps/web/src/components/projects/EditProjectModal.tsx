import React, { useState, useEffect } from 'react';
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
import { Alert, AlertDescription } from '../ui/alert.js';
import { updateProject, getProjectErrorInfo } from '../../api/projects.js';
import type { ProjectDetail } from '../../types/index.js';

interface EditProjectModalProps {
  open: boolean;
  project: ProjectDetail | null;
  onOpenChange: (open: boolean) => void;
  onSuccess: (updated: ProjectDetail) => void;
}

interface FormValues {
  name: string;
  description: string;
  startDate: string;
  targetDate: string;
}

export function EditProjectModal({
  open,
  project,
  onOpenChange,
  onSuccess,
}: EditProjectModalProps) {
  const { t } = useTranslation();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>();

  useEffect(() => {
    if (project) {
      reset({
        name: project.name,
        description: project.description || '',
        startDate: project.startDate ? project.startDate.slice(0, 10) : '',
        targetDate: project.targetDate ? project.targetDate.slice(0, 10) : '',
      });
      setErrorMsg(null);
    }
  }, [project, reset]);

  const handleClose = () => {
    setErrorMsg(null);
    onOpenChange(false);
  };

  const onSubmit = async (data: FormValues) => {
    if (!project) return;
    setErrorMsg(null);

    // Validate dates
    if (data.startDate && data.targetDate && data.targetDate < data.startDate) {
      setErrorMsg(t('projects.create.errors.invalidDates'));
      return;
    }

    setIsSubmitting(true);
    try {
      const updated = await updateProject(project.id, {
        name: data.name.trim(),
        description: data.description.trim() ? data.description.trim() : null,
        startDate: data.startDate || null,
        targetDate: data.targetDate || null,
      });
      handleClose();
      onSuccess(updated);
    } catch (err: any) {
      const errInfo = getProjectErrorInfo(err);
      if (errInfo.status === 403) {
        setErrorMsg(t('projects.detail.forbiddenDesc'));
      } else if (errInfo.status === 404) {
        setErrorMsg(t('projects.detail.notFoundDesc'));
      } else if (errInfo.error === 'validation_error' && Array.isArray(errInfo.details)) {
        const issues = errInfo.details.map((d: any) => d.message).join(', ');
        setErrorMsg(issues || errInfo.message);
      } else {
        setErrorMsg(errInfo.message);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{t('projects.edit.modalTitle')}</DialogTitle>
          <DialogDescription>{t('projects.edit.modalDesc')}</DialogDescription>
        </DialogHeader>

        {errorMsg && (
          <Alert variant="destructive">
            <AlertDescription>{errorMsg}</AlertDescription>
          </Alert>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="edit-project-name">
              {t('projects.create.nameLabel')} <span className="text-destructive">*</span>
            </Label>
            <Input
              id="edit-project-name"
              {...register('name', { required: t('projects.create.errors.nameRequired') })}
              disabled={isSubmitting}
            />
            {errors.name && (
              <p className="text-xs text-destructive">{errors.name.message}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="edit-project-desc">
              {t('projects.create.descriptionLabel')}
            </Label>
            <textarea
              id="edit-project-desc"
              rows={3}
              className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
              {...register('description')}
              disabled={isSubmitting}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="edit-project-start-date">
                {t('projects.create.startDateLabel')}
              </Label>
              <Input
                id="edit-project-start-date"
                type="date"
                {...register('startDate')}
                disabled={isSubmitting}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="edit-project-target-date">
                {t('projects.create.targetDateLabel')}
              </Label>
              <Input
                id="edit-project-target-date"
                type="date"
                {...register('targetDate')}
                disabled={isSubmitting}
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={isSubmitting}
            >
              {t('common.cancel')}
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting
                ? t('projects.edit.submitting')
                : t('projects.edit.submit')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
