import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { FileQuestion } from 'lucide-react';
import { Button } from '../../components/ui/button.js';

export function NotFoundPage() {
  const { t } = useTranslation();

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-background text-foreground text-center">
      <div className="flex items-center justify-center w-16 h-16 rounded-full bg-muted text-muted-foreground mb-4">
        <FileQuestion className="w-8 h-8" />
      </div>
      <h1 className="text-3xl font-bold tracking-tight mb-2">404</h1>
      <p className="text-muted-foreground max-w-md mb-6">
        {t('common.notFound')}
      </p>
      <Button asChild variant="default">
        <Link to="/">{t('common.backToHome')}</Link>
      </Button>
    </div>
  );
}
