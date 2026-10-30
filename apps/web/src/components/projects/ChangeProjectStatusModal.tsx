import React, { useState, useEffect } from 'react';
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
import { Label } from '../ui/label.js';
import { Select } from '../ui/select.js';
import { Alert, AlertDescription, AlertTitle } from '../ui/alert.js';
import { changeProjectStatus, getProjectErrorInfo } from '../../api/projects.js';
import type { ProjectDetail, ProjectStatus } from '../../types/index.js';

interface ChangeProjectStatusModalProps {
  open: boolean;
  project: ProjectDetail | null;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  onReloadRequested?: () => void;
}

export function ChangeProjectStatusModal({
  open,
  project,
  onOpenChange,
  onSuccess,
  onReloadRequested,
}: ChangeProjectStatusModalProps) {
  const { t } = useTranslation();
  const [selectedStatus, setSelectedStatus] = useState<ProjectStatus>('on_track');
  const [reason, setReason] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isConflict, setIsConflict] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (project) {
      setSelectedStatus(project.status);
      setReason('');
      setErrorMsg(null);
      setIsConflict(false);
    }
  }, [project, open]);

  const handleClose = () => {
    setErrorMsg(null);
    setIsConflict(false);
    onOpenChange(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!project) return;
    setErrorMsg(null);
    setIsConflict(false);

    const trimmedReason = reason.trim();
    if (!trimmedReason) {
      setErrorMsg(t('projects.statusModal.reasonRequired'));
      return;
    }

    if (selectedStatus === project.status) {
      setErrorMsg(t('projects.statusModal.sameStatusError'));
      return;
    }

    setIsSubmitting(true);
    try {
      await changeProjectStatus(project.id, {
        status: selectedStatus,
        reason: trimmedReason,
      });
      handleClose();
      onSuccess();
    } catch (err: any) {
      const errInfo = getProjectErrorInfo(err);
      if (errInfo.error === 'conflict_retry' || errInfo.status === 409) {
        setIsConflict(true);
        setErrorMsg(t('projects.statusModal.conflictMessage'));
      } else if (errInfo.error === 'same_status') {
        setErrorMsg(t('projects.statusModal.sameStatusError'));
      } else if (errInfo.status === 403) {
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
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t('projects.statusModal.modalTitle')}</DialogTitle>
          <DialogDescription>
            {t('projects.statusModal.modalDesc')}
          </DialogDescription>
        </DialogHeader>

        {isConflict ? (
          <Alert variant="destructive" className="space-y-2">
            <AlertTitle>{t('projects.statusModal.conflictTitle')}</AlertTitle>
            <AlertDescription className="block">
              {errorMsg}
            </AlertDescription>
            {onReloadRequested && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="mt-2"
                onClick={() => {
                  handleClose();
                  onReloadRequested();
                }}
              >
                {t('projects.detail.reload')}
              </Button>
            )}
          </Alert>
        ) : (
          errorMsg && (
            <Alert variant="destructive">
              <AlertDescription>{errorMsg}</AlertDescription>
            </Alert>
          )
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="change-project-status">
              {t('projects.statusModal.newStatusLabel')}
            </Label>
            <Select
              id="change-project-status"
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value as ProjectStatus)}
              disabled={isSubmitting}
            >
              <option value="on_track">{t('projects.status.on_track')}</option>
              <option value="at_risk">{t('projects.status.at_risk')}</option>
              <option value="off_track">{t('projects.status.off_track')}</option>
              <option value="on_hold">{t('projects.status.on_hold')}</option>
              <option value="complete">{t('projects.status.complete')}</option>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="change-project-reason">
              {t('projects.statusModal.reasonLabel')} <span className="text-destructive">*</span>
            </Label>
            <textarea
              id="change-project-reason"
              rows={3}
              className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
              placeholder={t('projects.statusModal.reasonPlaceholder')}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              disabled={isSubmitting}
            />
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
            <Button
              type="submit"
              disabled={isSubmitting || selectedStatus === project?.status || !reason.trim()}
            >
              {isSubmitting
                ? t('projects.statusModal.submitting')
                : t('projects.statusModal.submit')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
