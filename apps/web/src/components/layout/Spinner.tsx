import { useTranslation } from 'react-i18next';
import { Loader2 } from 'lucide-react';

interface SpinnerProps {
  className?: string;
}

export function Spinner({ className = 'h-8 w-8 text-primary' }: SpinnerProps) {
  const { t } = useTranslation();

  return (
    <div
      role="status"
      className="flex h-full w-full items-center justify-center p-4 min-h-[200px]"
    >
      <Loader2 className={`animate-spin ${className}`} aria-hidden="true" />
      <span className="sr-only">{t('common.loading')}</span>
    </div>
  );
}
