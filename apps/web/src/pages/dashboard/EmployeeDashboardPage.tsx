import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import {
  FolderKanban,
  BookUser,
  ClipboardList,
  Calendar,
  FileSpreadsheet,
  Clock,
  ChevronRight,
  ShieldAlert,
  ArrowRight,
  RefreshCw,
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth.js';
import { fetchWorkLogByDate, getWorkLogErrorInfo } from '../../api/workLogs.js';
import { fetchProjects } from '../../api/projects.js';
import { getKathmanduToday, formatDateDisplay } from '../../lib/dateUtils.js';
import { Button } from '../../components/ui/button.js';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '../../components/ui/card.js';
import { WorkLogStatusBadge } from '../../components/common/WorkLogStatusBadge.js';
import { ProjectStatusBadge } from '../../components/projects/ProjectStatusBadge.js';
import type { WorkLogDayResponse, ProjectListResponse } from '../../types/index.js';

export function EmployeeDashboardPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const navigate = useNavigate();

  const today = getKathmanduToday();

  // 1. Fetch Today's Work Log
  const {
    data: logData,
    isLoading: isLoadingLog,
    error: logError,
  } = useQuery<WorkLogDayResponse>({
    queryKey: ['work-log', 'by-date', today],
    queryFn: () => fetchWorkLogByDate(today),
    retry: false,
  });

  const isProfileNotFound =
    logError && getWorkLogErrorInfo(logError).code === 'profile_not_found';

  // 2. Fetch First 5 Assigned Projects
  const {
    data: projectsData,
    isLoading: isLoadingProjects,
  } = useQuery<ProjectListResponse>({
    queryKey: ['projects', 'dashboardList'],
    queryFn: () => fetchProjects({ limit: 5 }),
  });

  const recentProjects = projectsData?.items?.slice(0, 5) || [];

  const quickLinks = [
    {
      to: '/employee/work-log',
      label: t('dashboard.links.workLog'),
      icon: ClipboardList,
      desc: t('workLog.daily.subtitle', { defaultValue: 'Submit shift work hours' }),
    },
    {
      to: '/employee/projects',
      label: t('dashboard.links.projects'),
      icon: FolderKanban,
      desc: t('projects.subtitle', { defaultValue: 'Track project initiatives' }),
    },
    {
      to: '/employee/directory',
      label: t('dashboard.links.directory'),
      icon: BookUser,
      desc: t('directory.pageSubtitle', { defaultValue: 'Company staff directory' }),
    },
    {
      to: '/employee/work-log/history',
      label: t('dashboard.links.history'),
      icon: Calendar,
      desc: t('workLog.history.subtitle', { defaultValue: 'Past calendar logs' }),
    },
    {
      to: '/employee/work-log/export',
      label: t('dashboard.links.export'),
      icon: FileSpreadsheet,
      desc: t('workLog.export.subtitle', { defaultValue: 'Export timesheet data' }),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header Greeting */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          {t('dashboard.greeting', { name: user?.displayName || user?.username || '' })}
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          {t('dashboard.subtitle')}
        </p>
      </div>

      {/* Main Grid: Work Log Card & Projects Card */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Today's Work Log Card */}
        <Card className="flex flex-col justify-between">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Clock className="h-4 w-4 text-primary" />
                {t('dashboard.todayWorkLog')}
              </CardTitle>
              <span className="text-xs text-muted-foreground font-medium">
                {t('dashboard.todayDate', { date: formatDateDisplay(today) })}
              </span>
            </div>
          </CardHeader>
          <CardContent className="space-y-4 flex-1 flex flex-col justify-between">
            {isLoadingLog ? (
              <div className="flex items-center justify-center p-8 text-muted-foreground">
                <RefreshCw className="h-5 w-5 animate-spin mr-2" />
                <span className="text-xs">{t('common.loading')}</span>
              </div>
            ) : isProfileNotFound ? (
              <div className="rounded-lg p-4 bg-muted/30 border text-xs space-y-1.5">
                <div className="font-semibold flex items-center gap-1.5 text-foreground">
                  <ShieldAlert className="h-4 w-4 text-primary" />
                  {t('dashboard.noProfileTitle')}
                </div>
                <p className="text-muted-foreground leading-relaxed">
                  {t('dashboard.noProfileDesc')}
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 rounded-lg bg-muted/20 border">
                  <div>
                    <div className="text-xs text-muted-foreground">{t('workLog.daily.statusBadge')}</div>
                    <div className="mt-1">
                      {logData?.workLog ? (
                        <WorkLogStatusBadge status={logData.workLog.status} />
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-muted text-muted-foreground border">
                          {t('dashboard.notStarted')}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-muted-foreground">{t('workLog.daily.totalHours')}</div>
                    <div className="text-sm font-bold font-mono text-primary mt-1">
                      {t('dashboard.hoursLogged', {
                        logged: logData?.totalHours ?? 0,
                        expected: logData?.standardShiftHours ?? 8,
                      })}
                    </div>
                  </div>
                </div>

                <Button
                  onClick={() => navigate('/employee/work-log')}
                  className="w-full flex items-center justify-center gap-2"
                  size="sm"
                >
                  <ClipboardList className="h-4 w-4" />
                  {t('dashboard.openWorkLog')}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* My Projects Card */}
        <Card className="flex flex-col justify-between">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <FolderKanban className="h-4 w-4 text-primary" />
                {t('dashboard.myProjects')}
              </CardTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate('/employee/projects')}
                className="text-xs h-7 px-2"
              >
                {t('dashboard.viewAllProjects')}
                <ArrowRight className="h-3 w-3 ml-1" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3 flex-1 flex flex-col justify-between">
            {isLoadingProjects ? (
              <div className="flex items-center justify-center p-8 text-muted-foreground">
                <RefreshCw className="h-5 w-5 animate-spin mr-2" />
                <span className="text-xs">{t('common.loading')}</span>
              </div>
            ) : recentProjects.length === 0 ? (
              <div className="text-center p-6 border rounded-lg bg-muted/20 text-xs text-muted-foreground space-y-1">
                <p className="font-medium text-foreground">{t('dashboard.myProjects')}</p>
                <p>{t('dashboard.noProjectsAssigned')}</p>
              </div>
            ) : (
              <div className="space-y-2">
                {recentProjects.map((project) => (
                  <div
                    key={project.id}
                    onClick={() => navigate(`/employee/projects/${project.id}`)}
                    className="flex items-center justify-between p-2.5 rounded-lg border bg-card hover:bg-muted/40 transition cursor-pointer text-xs"
                  >
                    <div className="space-y-0.5 truncate mr-3">
                      <div className="font-semibold text-foreground truncate">
                        {project.name}
                      </div>
                      <div className="text-[11px] text-muted-foreground flex items-center gap-2">
                        <span>
                          {t('projects.memberCount', {
                            count: project.memberCount,
                            defaultValue: `${project.memberCount} members`,
                          })}
                        </span>
                        {project.targetDate && (
                          <span>
                            • {t('projects.targetDate', { date: project.targetDate.slice(0, 10) })}
                          </span>
                        )}
                      </div>
                    </div>
                    <ProjectStatusBadge status={project.status} />
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions Section */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold tracking-wide uppercase text-muted-foreground">
          {t('dashboard.quickLinks')}
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
          {quickLinks.map((item) => {
            const Icon = item.icon;
            return (
              <div
                key={item.to}
                onClick={() => navigate(item.to)}
                className="flex items-center justify-between p-3.5 rounded-xl border bg-card hover:border-primary/40 hover:shadow-sm transition cursor-pointer group"
              >
                <div className="flex items-center gap-3 truncate">
                  <div className="w-9 h-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0 group-hover:bg-primary group-hover:text-primary-foreground transition">
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="truncate">
                    <div className="font-semibold text-xs text-foreground group-hover:text-primary transition truncate">
                      {item.label}
                    </div>
                    <div className="text-[11px] text-muted-foreground truncate">
                      {item.desc}
                    </div>
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground shrink-0 ml-2" />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
