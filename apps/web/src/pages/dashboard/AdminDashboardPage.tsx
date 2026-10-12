import { useTranslation } from 'react-i18next';
import { useAuth } from '../../hooks/useAuth.js';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '../../components/ui/card.js';

export function AdminDashboardPage() {
  const { t } = useTranslation();
  const { user } = useAuth();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          {t('dashboard.admin.title')}
        </h1>
        <p className="text-muted-foreground">
          {t('dashboard.admin.welcome', { name: user?.displayName || '' })}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t('dashboard.admin.title')}</CardTitle>
          <CardDescription>
            {t('dashboard.admin.note')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            {t('dashboard.admin.note')}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
