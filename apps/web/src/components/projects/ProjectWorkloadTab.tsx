import React from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import {
  Users,
  Briefcase,
  Clock,
  AlertCircle,
  RefreshCw,
  UserX,
  CheckCircle2,
} from 'lucide-react';
import { Button } from '../ui/button.js';
import { Alert, AlertDescription } from '../ui/alert.js';
import { ProjectRoleBadge } from './ProjectRoleBadge.js';
import { fetchProjectWorkload, getProjectErrorInfo } from '../../api/projects.js';
import { formatHours } from '../../lib/dateUtils.js';
import type {
  ProjectDetail,
  ProjectWorkloadResponse,
  ProjectRole,
  User,
} from '../../types/index.js';

interface ProjectWorkloadTabProps {
  project: ProjectDetail;
  currentUser: User | null;
  callerProjectRole?: ProjectRole;
  isSystemAdmin: boolean;
}

export function ProjectWorkloadTab({
  project,
  currentUser,
  callerProjectRole,
  isSystemAdmin,
}: ProjectWorkloadTabProps) {
  const { t } = useTranslation();
  const isManagerOrAdmin = isSystemAdmin || callerProjectRole === 'manager';

  const {
    data: workload,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery<ProjectWorkloadResponse>({
    queryKey: ['projectWorkload', project.id],
    queryFn: () => fetchProjectWorkload(project.id),
    staleTime: 0,
  });

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center p-16 text-muted-foreground space-y-3">
        <RefreshCw className="h-8 w-8 animate-spin text-primary" />
        <p className="text-xs font-medium">{t('projects.workload.loading', 'Loading workload distribution...')}</p>
      </div>
    );
  }

  if (isError) {
    const errInfo = getProjectErrorInfo(error);
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription className="flex items-center justify-between">
          <span>{errInfo.message || t('projects.workload.error', 'Failed to load project workload.')}</span>
          <Button size="sm" variant="outline" onClick={() => refetch()} className="ml-4">
            {t('common.retry', 'Retry')}
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  const members = workload?.members ?? [];
  const unassigned = workload?.unassignedOrDeparted ?? { openTasksCount: 0, estimatedHours: 0 };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold tracking-tight flex items-center gap-2">
          <Briefcase className="h-5 w-5 text-primary" />
          {t('projects.workload.title', 'Project Workload & Distribution')}
        </h2>
        <p className="text-xs text-muted-foreground mt-0.5">
          {t('projects.workload.subtitle', 'Overview of open tasks and hours allocation across team members.')}
        </p>
      </div>

      {/* Unassigned or Departed Tasks Banner/Card if present */}
      {(unassigned.openTasksCount > 0 || unassigned.estimatedHours > 0) && (
        <div className="bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400 flex items-center justify-center shrink-0">
              <UserX className="h-4 w-4" />
            </div>
            <div>
              <h4 className="text-sm font-semibold text-amber-900 dark:text-amber-200">
                {t('projects.workload.unassignedTitle', 'Unassigned or Departed Assignee Tasks')}
              </h4>
              <p className="text-xs text-amber-700/80 dark:text-amber-300/70">
                {t('projects.workload.unassignedDesc', 'Tasks requiring manager assignment or backlog grooming.')}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4 text-xs font-mono font-semibold self-end sm:self-center">
            <span className="bg-amber-100/80 dark:bg-amber-900/60 text-amber-900 dark:text-amber-200 px-2.5 py-1 rounded">
              {t('projects.workload.openTasksCount', { count: unassigned.openTasksCount, defaultValue: '{{count}} open tasks' })}
            </span>
            <span className="bg-amber-100/80 dark:bg-amber-900/60 text-amber-900 dark:text-amber-200 px-2.5 py-1 rounded">
              {formatHours(unassigned.estimatedHours)} {t('projects.workload.estimatedHoursShort', 'est')}
            </span>
          </div>
        </div>
      )}

      {/* Main Members Workload Content */}
      {members.length === 0 ? (
        <div className="border border-dashed rounded-xl p-12 text-center bg-card/40 space-y-3">
          <Users className="h-8 w-8 mx-auto text-muted-foreground opacity-60" />
          <h3 className="font-semibold text-sm">{t('projects.workload.noMembersTitle', 'No Project Members')}</h3>
          <p className="text-xs text-muted-foreground max-w-sm mx-auto">
            {t('projects.workload.noMembersDesc', 'There are no active members assigned to this project.')}
          </p>
        </div>
      ) : (
        <>
          {/* Desktop Table View (hidden on mobile < 640px) */}
          <div className="hidden sm:block border rounded-xl bg-card overflow-hidden">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b bg-muted/40 text-xs font-semibold text-muted-foreground">
                  <th className="py-3 px-4">{t('projects.workload.member', 'Member')}</th>
                  <th className="py-3 px-4">{t('projects.workload.role', 'Role')}</th>
                  <th className="py-3 px-4 text-center">{t('projects.workload.openTasks', 'Open Tasks')}</th>
                  <th className="py-3 px-4 text-right">{t('projects.workload.estimatedHours', 'Estimated Hours')}</th>
                  <th className="py-3 px-4 text-right">
                    {isManagerOrAdmin
                      ? t('projects.workload.loggedHours', 'Logged Hours')
                      : t('projects.workload.yourLoggedHoursOnly', 'Your Logged Hours Only')}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y text-xs">
                {members.map((member) => (
                  <tr key={member.userId} className="hover:bg-muted/20 transition">
                    <td className="py-3 px-4">
                      <div className="font-medium text-foreground">
                        {member.displayName}
                        {currentUser?.id === member.userId && (
                          <span className="ml-1.5 text-[10px] bg-primary/10 text-primary font-semibold px-1.5 py-0.5 rounded">
                            {t('common.you', 'You')}
                          </span>
                        )}
                      </div>
                      <div className="text-muted-foreground font-mono text-[11px]">{member.username}</div>
                    </td>

                    <td className="py-3 px-4">
                      <ProjectRoleBadge role={member.projectRole} />
                    </td>

                    <td className="py-3 px-4 text-center font-mono font-semibold">
                      {member.openTasksCount}
                    </td>

                    <td className="py-3 px-4 text-right font-mono">
                      {formatHours(member.estimatedHours)}
                    </td>

                    <td className="py-3 px-4 text-right font-mono font-semibold text-primary">
                      {member.loggedHours === null ? '-' : formatHours(member.loggedHours)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile Stacked Cards View (visible only on mobile < 640px) */}
          <div className="sm:hidden space-y-3">
            {members.map((member) => (
              <div key={member.userId} className="border rounded-xl bg-card p-4 space-y-3 shadow-sm">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="font-semibold text-sm">
                      {member.displayName}
                      {currentUser?.id === member.userId && (
                        <span className="ml-1.5 text-[10px] bg-primary/10 text-primary font-semibold px-1.5 py-0.5 rounded">
                          {t('common.you', 'You')}
                        </span>
                      )}
                    </div>
                    <div className="text-muted-foreground font-mono text-xs">{member.username}</div>
                  </div>
                  <ProjectRoleBadge role={member.projectRole} />
                </div>

                <div className="grid grid-cols-3 gap-2 pt-2 border-t text-xs">
                  <div className="bg-muted/40 p-2 rounded text-center">
                    <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-0.5">
                      {t('projects.workload.openTasksShort', 'Open')}
                    </div>
                    <div className="font-mono font-bold text-sm">{member.openTasksCount}</div>
                  </div>

                  <div className="bg-muted/40 p-2 rounded text-center">
                    <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-0.5">
                      {t('projects.workload.estShort', 'Est')}
                    </div>
                    <div className="font-mono font-bold text-sm">{formatHours(member.estimatedHours)}</div>
                  </div>

                  <div className="bg-muted/40 p-2 rounded text-center">
                    <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-0.5">
                      {t('projects.workload.loggedShort', 'Logged')}
                    </div>
                    <div className="font-mono font-bold text-sm text-primary">
                      {member.loggedHours === null ? '-' : formatHours(member.loggedHours)}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
