import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
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
import { Alert, AlertDescription } from '../ui/alert.js';
import { fetchDirectoryEmployees } from '../../api/directory.js';
import { addProjectMember, getProjectErrorInfo } from '../../api/projects.js';
import type { DirectoryEmployee, ProjectRole, ProjectMember } from '../../types/index.js';

interface AddProjectMemberModalProps {
  open: boolean;
  projectId: string;
  existingMemberUserIds: Set<string>;
  onOpenChange: (open: boolean) => void;
  onSuccess: (newMember: ProjectMember) => void;
}

export function AddProjectMemberModal({
  open,
  projectId,
  existingMemberUserIds,
  onOpenChange,
  onSuccess,
}: AddProjectMemberModalProps) {
  const { t } = useTranslation();
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [selectedRole, setSelectedRole] = useState<ProjectRole>('member');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Load active directory employees
  const {
    data: employees = [],
    isLoading: isLoadingUsers,
  } = useQuery<DirectoryEmployee[]>({
    queryKey: ['directory', 'activeUsers'],
    queryFn: () => fetchDirectoryEmployees(),
    enabled: open,
  });

  // Filter out already added members
  const availableUsers = employees.filter((u) => !existingMemberUserIds.has(u.id));

  const handleClose = () => {
    setSelectedUserId('');
    setSelectedRole('member');
    setErrorMsg(null);
    onOpenChange(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!selectedUserId) {
      setErrorMsg(t('projects.addMemberModal.errors.userRequired'));
      return;
    }

    setIsSubmitting(true);
    try {
      const created = await addProjectMember(projectId, {
        userId: selectedUserId,
        projectRole: selectedRole,
      });
      handleClose();
      onSuccess(created);
    } catch (err: any) {
      const errInfo = getProjectErrorInfo(err);
      if (errInfo.error === 'member_already_exists' || errInfo.status === 409) {
        setErrorMsg(t('projects.addMemberModal.errors.alreadyMember'));
      } else if (errInfo.error === 'inactive_user') {
        setErrorMsg(t('projects.addMemberModal.errors.inactiveUser'));
      } else if (errInfo.error === 'viewer_cannot_be_member_writer') {
        setErrorMsg(t('projects.addMemberModal.errors.viewerCannotWrite'));
      } else if (errInfo.status === 403) {
        setErrorMsg(t('projects.detail.forbiddenDesc'));
      } else if (errInfo.status === 404) {
        setErrorMsg(t('projects.detail.notFoundDesc'));
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
          <DialogTitle>{t('projects.addMemberModal.modalTitle')}</DialogTitle>
          <DialogDescription>
            {t('projects.addMemberModal.modalDesc')}
          </DialogDescription>
        </DialogHeader>

        {errorMsg && (
          <Alert variant="destructive">
            <AlertDescription>{errorMsg}</AlertDescription>
          </Alert>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="add-member-user">
              {t('projects.addMemberModal.userLabel')} <span className="text-destructive">*</span>
            </Label>
            {isLoadingUsers ? (
              <p className="text-xs text-muted-foreground">{t('projects.loading')}</p>
            ) : (
              <Select
                id="add-member-user"
                value={selectedUserId}
                onChange={(e) => setSelectedUserId(e.target.value)}
                disabled={isSubmitting}
              >
                <option value="">{t('projects.addMemberModal.userPlaceholder')}</option>
                {availableUsers.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.displayName} {u.jobTitle ? `(${u.jobTitle})` : ''}
                  </option>
                ))}
              </Select>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="add-member-role">
              {t('projects.addMemberModal.roleLabel')}
            </Label>
            <Select
              id="add-member-role"
              value={selectedRole}
              onChange={(e) => setSelectedRole(e.target.value as ProjectRole)}
              disabled={isSubmitting}
            >
              <option value="manager">{t('projects.roles.manager')}</option>
              <option value="member">{t('projects.roles.member')}</option>
              <option value="viewer">{t('projects.roles.viewer')}</option>
            </Select>
            <p className="text-xs text-muted-foreground mt-1">
              {t('projects.addMemberModal.roleDesc')}
            </p>
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
              disabled={isSubmitting || !selectedUserId}
            >
              {isSubmitting
                ? t('projects.addMemberModal.submitting')
                : t('projects.addMemberModal.submit')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
