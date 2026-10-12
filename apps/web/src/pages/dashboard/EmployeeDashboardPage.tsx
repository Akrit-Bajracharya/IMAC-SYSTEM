import { useTranslation } from 'react-i18next';
import { useAuth } from '../../hooks/useAuth.js';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '../../components/ui/card.js';

export function EmployeeDashboardPage() {
  const { t } = useTranslation();
  const { user } = useAuth();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          {t('dashboard.employee.title')}
        </h1>
        <p className="text-muted-foreground">
          {t('dashboard.employee.welcome', { name: user?.displayName || '' })}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t('dashboard.employee.title')}</CardTitle>
          <CardDescription>
            {t('dashboard.employee.note')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            {t('dashboard.employee.note')}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
