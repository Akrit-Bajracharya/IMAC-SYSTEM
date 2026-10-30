import React from 'react';
import { useTranslation } from 'react-i18next';
import type { ProjectRole } from '../../types/index.js';

interface ProjectRoleBadgeProps {
  role: ProjectRole;
  className?: string;
}

export const ProjectRoleBadge: React.FC<ProjectRoleBadgeProps> = ({
  role,
  className = '',
}) => {
  const { t } = useTranslation();

  const roleConfig: Record<
    ProjectRole,
    { label: string; bg: string; border: string }
  > = {
    manager: {
      label: t('projects.roles.manager'),
      bg: 'bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300',
      border: 'border-purple-200 dark:border-purple-800',
    },
    member: {
      label: t('projects.roles.member'),
      bg: 'bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300',
      border: 'border-blue-200 dark:border-blue-800',
    },
    viewer: {
      label: t('projects.roles.viewer'),
      bg: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
      border: 'border-slate-200 dark:border-slate-700',
    },
  };

  const config = roleConfig[role] ?? {
    label: role,
    bg: 'bg-muted text-muted-foreground',
    border: 'border-border',
  };

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${config.bg} ${config.border} ${className}`}
    >
      {config.label}
    </span>
  );
};
