import { useTranslation } from 'react-i18next';
import { cn } from '../../lib/utils.js';

interface AvailabilityBadgeProps {
  status: string;
  message?: string | null;
  className?: string;
  showDotOnly?: boolean;
}

export function AvailabilityBadge({
  status,
  message,
  className,
  showDotOnly = false,
}: AvailabilityBadgeProps) {
  const { t } = useTranslation();

  const getStatusConfig = (s: string) => {
    switch (s) {
      case 'available':
        return {
          dotColor: 'bg-emerald-500',
          badgeBg: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800',
          label: t('availability.available', { defaultValue: 'Available' }),
        };
      case 'busy_in_meeting':
        return {
          dotColor: 'bg-amber-500',
          badgeBg: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800',
          label: t('availability.busyInMeeting', { defaultValue: 'In Meeting' }),
        };
      case 'out_of_office':
        return {
          dotColor: 'bg-orange-500',
          badgeBg: 'bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950/40 dark:text-orange-300 dark:border-orange-800',
          label: t('availability.outOfOffice', { defaultValue: 'Out of Office' }),
        };
      case 'on_leave':
        return {
          dotColor: 'bg-purple-500',
          badgeBg: 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-800',
          label: t('availability.onLeave', { defaultValue: 'On Leave' }),
        };
      case 'working_remotely':
        return {
          dotColor: 'bg-sky-500',
          badgeBg: 'bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/40 dark:text-sky-300 dark:border-sky-800',
          label: t('availability.workingRemotely', { defaultValue: 'Remote' }),
        };
      default:
        return {
          dotColor: 'bg-slate-400',
          badgeBg: 'bg-slate-50 text-slate-700 border-slate-200 dark:bg-slate-900/40 dark:text-slate-300 dark:border-slate-800',
          label: status,
        };
    }
  };

  const config = getStatusConfig(status);

  if (showDotOnly) {
    return (
      <span
        className={cn('inline-block h-2.5 w-2.5 rounded-full', config.dotColor, className)}
        title={message ? `${config.label}: ${message}` : config.label}
      />
    );
  }

  return (
    <div className={cn('inline-flex flex-col', className)}>
      <span
        className={cn(
          'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium',
          config.badgeBg
        )}
        title={message || undefined}
      >
        <span className={cn('h-1.5 w-1.5 rounded-full', config.dotColor)} />
        {config.label}
      </span>
      {message && (
        <span className="text-[11px] text-muted-foreground truncate max-w-[160px] mt-0.5 ml-1">
          {message}
        </span>
      )}
    </div>
  );
}
