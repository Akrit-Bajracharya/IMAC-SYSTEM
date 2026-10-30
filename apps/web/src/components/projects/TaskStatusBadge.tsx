import React from 'react';
import { useTranslation } from 'react-i18next';
import { Circle, Clock, AlertOctagon, CheckCircle2 } from 'lucide-react';
import type { TaskStatus } from '../../types/index.js';

interface TaskStatusBadgeProps {
  status: TaskStatus;
  className?: string;
  showIcon?: boolean;
}

export function TaskStatusBadge({ status, className = '', showIcon = true }: TaskStatusBadgeProps) {
  const { t } = useTranslation();

  const getBadgeConfig = () => {
    switch (status) {
      case 'todo':
        return {
          label: t('projects.tasks.status.todo', 'To Do'),
          classes: 'bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700',
          icon: Circle,
        };
      case 'in_progress':
        return {
          label: t('projects.tasks.status.inProgress', 'In Progress'),
          classes: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800',
          icon: Clock,
        };
      case 'blocked':
        return {
          label: t('projects.tasks.status.blocked', 'Blocked'),
          classes: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800',
          icon: AlertOctagon,
        };
      case 'done':
        return {
          label: t('projects.tasks.status.done', 'Done'),
          classes: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-800',
          icon: CheckCircle2,
        };
      default:
        return {
          label: status,
          classes: 'bg-gray-100 text-gray-700 border-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700',
          icon: Circle,
        };
    }
  };

  const { label, classes, icon: Icon } = getBadgeConfig();

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border ${classes} ${className}`}
    >
      {showIcon && <Icon className="w-3.5 h-3.5 flex-shrink-0" />}
      <span>{label}</span>
    </span>
  );
}
