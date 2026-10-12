import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { ShieldAlert } from 'lucide-react';
import { Button } from '../../components/ui/button.js';

export function UnauthorizedPage() {
  const { t } = useTranslation();

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-background text-foreground text-center">
      <div className="flex items-center justify-center w-16 h-16 rounded-full bg-destructive/10 text-destructive mb-4">
        <ShieldAlert className="w-8 h-8" />
      </div>
      <h1 className="text-3xl font-bold tracking-tight mb-2">403</h1>
      <p className="text-muted-foreground max-w-md mb-6">
        {t('common.unauthorized')}
      </p>
      <Button asChild variant="default">
        <Link to="/">{t('common.backToHome')}</Link>
      </Button>
    </div>
  );
}
