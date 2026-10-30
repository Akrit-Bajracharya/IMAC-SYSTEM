import React, { useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import {
  ArrowLeft,
  Calendar,
  Clock,
  AlertTriangle,
  AlertOctagon,
  Users,
  Edit2,
  Activity,
  UserPlus,
  Trash2,
  Info,
  CheckCircle2,
  FolderKanban,
  Shield,
  RefreshCw,
} from 'lucide-react';
import {
  fetchProjectById,
  fetchProjectSummary,
  removeProjectMember,
  getProjectErrorInfo,
} from '../../api/projects.js';
import { useAuth } from '../../hooks/useAuth.js';
import { Button } from '../../components/ui/button.js';
import { Alert, AlertDescription, AlertTitle } from '../../components/ui/alert.js';
import { ProjectStatusBadge } from '../../components/projects/ProjectStatusBadge.js';
import { ProjectRoleBadge } from '../../components/projects/ProjectRoleBadge.js';
import { EditProjectModal } from '../../components/projects/EditProjectModal.js';
import { ChangeProjectStatusModal } from '../../components/projects/ChangeProjectStatusModal.js';
import { AddProjectMemberModal } from '../../components/projects/AddProjectMemberModal.js';
import { ConfirmationModal } from '../../components/common/ConfirmationModal.js';
import type { ProjectDetail, ProjectSummary, ProjectMember } from '../../types/index.js';

export function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { t } = useTranslation();
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const basePath = user && ['system_admin', 'hr_admin'].includes(user.systemRole)
    ? '/admin/projects'
    : '/employee/projects';

  // Modals state
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [statusModalOpen, setStatusModalOpen] = useState(false);
  const [addMemberModalOpen, setAddMemberModalOpen] = useState(false);
  const [memberToRemove, setMemberToRemove] = useState<ProjectMember | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [isRemovingMember, setIsRemovingMember] = useState(false);

  // 1. Fetch project details
  const {
    data: project,
    isLoading: isLoadingProject,
    isError: isProjectError,
    error: projectError,
    refetch: refetchProject,
  } = useQuery<ProjectDetail>({
    queryKey: ['project', id],
    queryFn: () => fetchProjectById(id!),
    enabled: !!id,
    retry: 1,
  });

  // 2. Fetch project summary (progress, task counts, hours)
  const {
    data: summary,
    isLoading: isLoadingSummary,
    refetch: refetchSummary,
  } = useQuery<ProjectSummary>({
    queryKey: ['projectSummary', id],
    queryFn: () => fetchProjectSummary(id!),
    enabled: !!id && !!project,
    retry: 1,
  });

  // Determine if caller is a project manager or system_admin
  const isManagerOrAdmin = useMemo(() => {
    if (!user || !project) return false;
    if (user.systemRole === 'system_admin') return true;
    const myMembership = project.members.find((m) => m.userId === user.id);
    return myMembership?.projectRole === 'manager';
  }, [user, project]);

  // Existing member user IDs set
  const existingMemberUserIds = useMemo(() => {
    if (!project) return new Set<string>();
    return new Set(project.members.map((m) => m.userId));
  }, [project]);

  // Handle remove member
  const handleConfirmRemoveMember = async () => {
    if (!id || !memberToRemove) return;
    setActionError(null);
    setIsRemovingMember(true);
    try {
      await removeProjectMember(id, memberToRemove.userId);
      setMemberToRemove(null);
      await refetchProject();
      await refetchSummary();
    } catch (err: any) {
      const errInfo = getProjectErrorInfo(err);
      if (errInfo.error === 'last_manager_required' || errInfo.status === 409) {
        setActionError(t('projects.detail.lastManagerError'));
      } else if (errInfo.status === 403) {
        setActionError(t('projects.detail.forbiddenDesc'));
      } else if (errInfo.status === 404) {
        setActionError(t('projects.detail.notFoundDesc'));
      } else {
        setActionError(errInfo.message);
      }
    } finally {
      setIsRemovingMember(false);
    }
  };

  // Handle 404 or 403 errors on project loading
  if (isProjectError) {
    const errInfo = getProjectErrorInfo(projectError);
    if (errInfo.status === 404) {
      return (
        <div className="border rounded-xl p-12 text-center bg-card max-w-lg mx-auto mt-8 space-y-4">
          <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center text-muted-foreground mx-auto">
            <FolderKanban className="h-6 w-6" />
          </div>
          <h2 className="text-xl font-bold">{t('projects.detail.notFoundTitle')}</h2>
          <p className="text-sm text-muted-foreground">
            {t('projects.detail.notFoundDesc')}
          </p>
          <Button variant="outline" onClick={() => navigate(basePath)}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            {t('projects.detail.backToList')}
          </Button>
        </div>
      );
    }

    if (errInfo.status === 403) {
      return (
        <div className="border rounded-xl p-12 text-center bg-card max-w-lg mx-auto mt-8 space-y-4">
          <div className="w-12 h-12 rounded-full bg-destructive/10 text-destructive flex items-center justify-center mx-auto">
            <Shield className="h-6 w-6" />
          </div>
          <h2 className="text-xl font-bold">{t('projects.detail.forbiddenTitle')}</h2>
          <p className="text-sm text-muted-foreground">
            {t('projects.detail.forbiddenDesc')}
          </p>
          <Button variant="outline" onClick={() => navigate(basePath)}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            {t('projects.detail.backToList')}
          </Button>
        </div>
      );
    }

    return (
      <Alert variant="destructive" className="max-w-xl mx-auto mt-8">
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>{t('projects.errorTitle')}</AlertTitle>
        <AlertDescription className="flex items-center justify-between">
          <span>{errInfo.message}</span>
          <Button variant="outline" size="sm" onClick={() => refetchProject()} className="ml-4">
            {t('common.retry')}
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  if (isLoadingProject || !project) {
    return (
      <div className="flex flex-col items-center justify-center p-16 text-muted-foreground space-y-3">
        <RefreshCw className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm font-medium">{t('projects.loading')}</p>
      </div>
    );
  }

  const completionPercentage = summary?.progress?.percentage ?? 0;

  return (
    <div className="space-y-6">
      {/* Top Navigation */}
      <div className="flex items-center justify-between">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate(basePath)}
          className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          {t('projects.detail.backToList')}
        </Button>
      </div>

      {/* Global Error Banner */}
      {actionError && (
        <Alert variant="destructive" className="relative">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription className="pr-6">{actionError}</AlertDescription>
          <button
            onClick={() => setActionError(null)}
            className="absolute top-2.5 right-2.5 text-xs font-semibold opacity-70 hover:opacity-100"
          >
            ✕
          </button>
        </Alert>
      )}

      {/* Main Project Header Card */}
      <div className="border rounded-xl p-6 bg-card space-y-4">
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
          <div className="space-y-2 flex-1">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-2xl font-bold tracking-tight">{project.name}</h1>
              <ProjectStatusBadge status={project.status} />
            </div>

            <p className="text-sm text-muted-foreground whitespace-pre-line">
              {project.description || (
                <span className="italic opacity-70">
                  {t('projects.detail.noDescription')}
                </span>
              )}
            </p>
          </div>

          {/* Action Buttons for Managers / System Admin */}
          {isManagerOrAdmin && (
            <div className="flex flex-wrap items-center gap-2 self-start">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setEditModalOpen(true)}
                className="flex items-center gap-1.5"
              >
                <Edit2 className="h-3.5 w-3.5" />
                {t('projects.detail.editProject')}
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={() => setStatusModalOpen(true)}
                className="flex items-center gap-1.5"
              >
                <Activity className="h-3.5 w-3.5" />
                {t('projects.detail.changeStatus')}
              </Button>
            </div>
          )}
        </div>

        {/* Dates Bar */}
        <div className="pt-4 border-t flex flex-wrap items-center gap-6 text-xs text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <Calendar className="h-4 w-4 text-primary" />
            <span className="font-medium">{t('projects.detail.startDate')}:</span>
            <span>
              {project.startDate
                ? project.startDate.slice(0, 10)
                : t('projects.detail.notSet')}
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <Calendar className="h-4 w-4 text-primary" />
            <span className="font-medium">{t('projects.detail.targetDate')}:</span>
            <span>
              {project.targetDate
                ? project.targetDate.slice(0, 10)
                : t('projects.detail.notSet')}
            </span>
          </div>
        </div>

        {/* Status History Note */}
        <div className="flex items-start gap-2 bg-muted/40 p-3 rounded-lg text-xs text-muted-foreground">
          <Info className="h-4 w-4 shrink-0 text-muted-foreground mt-0.5" />
          <span>{t('projects.detail.statusHistoryNote')}</span>
        </div>
      </div>

      {/* Progress & Summary Dashboard */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Progress Bar Card */}
        <div className="border rounded-xl p-5 bg-card flex flex-col justify-between space-y-4">
          <div>
            <div className="flex items-center justify-between mb-1">
              <h3 className="font-semibold text-sm">
                {t('projects.detail.progress')}
              </h3>
              <span className="text-lg font-bold text-primary">
                {completionPercentage}%
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              {summary?.progress
                ? t('projects.detail.progressCompletion', {
                    percentage: summary.progress.percentage,
                    completed: summary.progress.completedTasks,
                    total: summary.progress.totalTasks,
                  })
                : t('common.loading')}
            </p>
          </div>

          {/* Styled Progress Bar */}
          <div className="w-full bg-muted rounded-full h-2.5 overflow-hidden">
            <div
              className="bg-primary h-2.5 rounded-full transition-all duration-500"
              style={{ width: `${Math.min(100, Math.max(0, completionPercentage))}%` }}
            />
          </div>

          {/* Task Status Breakdown Chips */}
          <div className="grid grid-cols-2 gap-2 text-xs pt-2 border-t">
            <div className="flex items-center justify-between p-1.5 rounded bg-muted/30">
              <span className="text-muted-foreground">{t('projects.detail.tasksTodo')}:</span>
              <span className="font-semibold">{summary?.taskCounts?.todo ?? 0}</span>
            </div>
            <div className="flex items-center justify-between p-1.5 rounded bg-muted/30">
              <span className="text-muted-foreground">{t('projects.detail.tasksInProgress')}:</span>
              <span className="font-semibold">{summary?.taskCounts?.in_progress ?? 0}</span>
            </div>
            <div className="flex items-center justify-between p-1.5 rounded bg-muted/30">
              <span className="text-muted-foreground">{t('projects.detail.tasksBlocked')}:</span>
              <span className="font-semibold text-rose-600">{summary?.taskCounts?.blocked ?? 0}</span>
            </div>
            <div className="flex items-center justify-between p-1.5 rounded bg-muted/30">
              <span className="text-muted-foreground">{t('projects.detail.tasksDone')}:</span>
              <span className="font-semibold text-emerald-600">{summary?.taskCounts?.done ?? 0}</span>
            </div>
          </div>
        </div>

        {/* Overdue & Blockers Card */}
        <div className="border rounded-xl p-5 bg-card flex flex-col justify-between space-y-4">
          <h3 className="font-semibold text-sm">{t('projects.detail.metrics')}</h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 rounded-lg border border-amber-200/60 bg-amber-50/50 dark:bg-amber-950/20 dark:border-amber-900/40">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-600" />
                <span className="text-xs font-medium">{t('projects.detail.overdueCount')}</span>
              </div>
              <span className="text-base font-bold text-amber-700 dark:text-amber-400">
                {summary?.overdueCount ?? 0}
              </span>
            </div>

            <div className="flex items-center justify-between p-3 rounded-lg border border-rose-200/60 bg-rose-50/50 dark:bg-rose-950/20 dark:border-rose-900/40">
              <div className="flex items-center gap-2">
                <AlertOctagon className="h-4 w-4 text-rose-600" />
                <span className="text-xs font-medium">{t('projects.detail.blockedCount')}</span>
              </div>
              <span className="text-base font-bold text-rose-700 dark:text-rose-400">
                {summary?.blockedCount ?? 0}
              </span>
            </div>
          </div>
          <div className="text-xs text-muted-foreground text-right opacity-70">
            {t('projects.title')}
          </div>
        </div>

        {/* Hours Logged Card */}
        <div className="border rounded-xl p-5 bg-card flex flex-col justify-between space-y-4">
          <h3 className="font-semibold text-sm flex items-center gap-2">
            <Clock className="h-4 w-4 text-primary" />
            {t('projects.detail.estimatedHours')} & {t('projects.detail.loggedHours')}
          </h3>
          <div className="space-y-3">
            <div className="p-3 rounded-lg bg-muted/40 flex items-center justify-between">
              <span className="text-xs text-muted-foreground">{t('projects.detail.estimatedHours')}</span>
              <span className="text-base font-bold font-mono">
                {summary?.hours?.estimated ? `${summary.hours.estimated}h` : '0h'}
              </span>
            </div>

            <div className="p-3 rounded-lg bg-muted/40 flex items-center justify-between">
              <span className="text-xs text-muted-foreground">{t('projects.detail.loggedHours')}</span>
              <span className="text-base font-bold font-mono text-primary">
                {summary?.hours?.logged ? `${summary.hours.logged}h` : '0h'}
              </span>
            </div>
          </div>
          <div className="text-xs text-muted-foreground text-right opacity-70">
            {t('workLog.daily.title', { defaultValue: 'Work Logs' })}
          </div>
        </div>
      </div>

      {/* Project Members Section */}
      <div className="border rounded-xl p-6 bg-card space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" />
              {t('projects.detail.members')}
            </h2>
            <p className="text-xs text-muted-foreground">
              {t('projects.memberCount', {
                count: project.members.length,
                defaultValue: `${project.members.length} members`,
              })}
            </p>
          </div>

          {isManagerOrAdmin && (
            <Button
              size="sm"
              onClick={() => setAddMemberModalOpen(true)}
              className="flex items-center gap-1.5 self-start sm:self-auto"
            >
              <UserPlus className="h-4 w-4" />
              {t('projects.detail.addMember')}
            </Button>
          )}
        </div>

        {/* Members Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b text-xs text-muted-foreground">
                <th className="py-2.5 px-3">{t('admin.users.displayName', { defaultValue: 'Name' })}</th>
                <th className="py-2.5 px-3">{t('admin.users.username', { defaultValue: 'Username' })}</th>
                <th className="py-2.5 px-3">{t('projects.addMemberModal.roleLabel')}</th>
                {isManagerOrAdmin && (
                  <th className="py-2.5 px-3 text-right">{t('common.actions')}</th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y text-xs">
              {project.members.map((member) => (
                <tr key={member.id} className="hover:bg-muted/30 transition">
                  <td className="py-3 px-3 font-medium">
                    {member.user?.displayName || member.userId}
                  </td>
                  <td className="py-3 px-3 text-muted-foreground font-mono">
                    {member.user?.username || '—'}
                  </td>
                  <td className="py-3 px-3">
                    <ProjectRoleBadge role={member.projectRole} />
                  </td>
                  {isManagerOrAdmin && (
                    <td className="py-3 px-3 text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setMemberToRemove(member)}
                        className="text-destructive hover:text-destructive hover:bg-destructive/10 h-7 px-2"
                        title={t('projects.detail.removeMember')}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        <span className="sr-only sm:not-sr-only sm:ml-1 text-xs">
                          {t('projects.detail.removeMember')}
                        </span>
                      </Button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit Project Modal */}
      <EditProjectModal
        open={editModalOpen}
        project={project}
        onOpenChange={setEditModalOpen}
        onSuccess={() => {
          refetchProject();
          refetchSummary();
        }}
      />

      {/* Change Status Modal */}
      <ChangeProjectStatusModal
        open={statusModalOpen}
        project={project}
        onOpenChange={setStatusModalOpen}
        onSuccess={() => {
          refetchProject();
          refetchSummary();
        }}
        onReloadRequested={() => {
          refetchProject();
          refetchSummary();
        }}
      />

      {/* Add Member Modal */}
      <AddProjectMemberModal
        open={addMemberModalOpen}
        projectId={project.id}
        existingMemberUserIds={existingMemberUserIds}
        onOpenChange={setAddMemberModalOpen}
        onSuccess={() => {
          refetchProject();
          refetchSummary();
        }}
      />

      {/* Remove Member Confirmation Dialog */}
      <ConfirmationModal
        open={!!memberToRemove}
        onOpenChange={(open) => {
          if (!open) setMemberToRemove(null);
        }}
        title={t('projects.detail.removeMemberConfirmTitle')}
        description={t('projects.detail.removeMemberConfirmDesc', {
          name: memberToRemove?.user?.displayName || memberToRemove?.userId || '',
        })}
        confirmLabel={t('projects.detail.removeMember')}
        cancelLabel={t('common.cancel')}
        variant="destructive"
        isLoading={isRemovingMember}
        onConfirm={handleConfirmRemoveMember}
      />
    </div>
  );
}
