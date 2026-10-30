import React from 'react';
import { useTranslation } from 'react-i18next';
import { Badge } from '../ui/badge.js';
import type { ProjectStatus } from '../../types/index.js';

interface ProjectStatusBadgeProps {
  status: ProjectStatus;
  className?: string;
}

export const ProjectStatusBadge: React.FC<ProjectStatusBadgeProps> = ({
  status,
  className = '',
}) => {
  const { t } = useTranslation();

  const statusConfig: Record<
    ProjectStatus,
    { label: string; bg: string; text: string; border: string }
  > = {
    on_track: {
      label: t('projects.status.on_track'),
      bg: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300',
      text: 'text-emerald-700 dark:text-emerald-300',
      border: 'border-emerald-200 dark:border-emerald-800',
    },
    at_risk: {
      label: t('projects.status.at_risk'),
      bg: 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300',
      text: 'text-amber-700 dark:text-amber-300',
      border: 'border-amber-200 dark:border-amber-800',
    },
    off_track: {
      label: t('projects.status.off_track'),
      bg: 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300',
      text: 'text-rose-700 dark:text-rose-300',
      border: 'border-rose-200 dark:border-rose-800',
    },
    on_hold: {
      label: t('projects.status.on_hold'),
      bg: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
      text: 'text-slate-700 dark:text-slate-300',
      border: 'border-slate-200 dark:border-slate-700',
    },
    complete: {
      label: t('projects.status.complete'),
      bg: 'bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300',
      text: 'text-blue-700 dark:text-blue-300',
      border: 'border-blue-200 dark:border-blue-800',
    },
  };

  const config = statusConfig[status] ?? {
    label: status,
    bg: 'bg-muted text-muted-foreground',
    text: 'text-muted-foreground',
    border: 'border-border',
  };

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${config.bg} ${config.border} ${className}`}
    >
      <span className="w-1.5 h-1.5 rounded-full mr-1.5 bg-current opacity-75" />
      {config.label}
    </span>
  );
};
