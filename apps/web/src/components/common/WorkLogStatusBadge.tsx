import { useTranslation } from 'react-i18next';
import { cn } from '../../lib/utils.js';
import type { WorkLogStatus } from '../../types/index.js';

interface WorkLogStatusBadgeProps {
  status: WorkLogStatus | string | null | undefined;
  className?: string;
  showDotOnly?: boolean;
}

export function WorkLogStatusBadge({
  status,
  className,
  showDotOnly = false,
}: WorkLogStatusBadgeProps) {
  const { t } = useTranslation();

  const getStatusConfig = (s?: string | null) => {
    switch (s) {
      case 'draft':
        return {
          dotColor: 'bg-amber-500',
          badgeBg:
            'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800',
          label: t('workLog.daily.status.draft', { defaultValue: 'Draft' }),
        };
      case 'submitted':
        return {
          dotColor: 'bg-sky-500',
          badgeBg:
            'bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/40 dark:text-sky-300 dark:border-sky-800',
          label: t('workLog.daily.status.submitted', { defaultValue: 'Submitted' }),
        };
      case 'approved':
        return {
          dotColor: 'bg-emerald-500',
          badgeBg:
            'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800',
          label: t('workLog.daily.status.approved', { defaultValue: 'Approved' }),
        };
      case 'rejected':
        return {
          dotColor: 'bg-rose-500',
          badgeBg:
            'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800',
          label: t('workLog.daily.status.rejected', { defaultValue: 'Rejected' }),
        };
      default:
        return {
          dotColor: 'bg-slate-400',
          badgeBg:
            'bg-slate-50 text-slate-600 border-slate-200 dark:bg-slate-900/40 dark:text-slate-400 dark:border-slate-800',
          label: t('workLog.daily.status.notCreated', { defaultValue: 'Not Created' }),
        };
    }
  };

  const config = getStatusConfig(status);

  if (showDotOnly) {
    return (
      <span
        className={cn('inline-block h-2.5 w-2.5 rounded-full', config.dotColor, className)}
        title={config.label}
      />
    );
  }

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium',
        config.badgeBg,
        className
      )}
    >
      <span className={cn('h-1.5 w-1.5 rounded-full', config.dotColor)} />
      {config.label}
    </span>
  );
}
