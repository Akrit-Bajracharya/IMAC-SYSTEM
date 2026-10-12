import React from 'react';
import { useTranslation } from 'react-i18next';
import { Outlet } from 'react-router-dom';

interface GuestLayoutProps {
  children?: React.ReactNode;
}

export function GuestLayout({ children }: GuestLayoutProps) {
  const { t } = useTranslation();

  return (
    <div className="min-h-screen w-full flex flex-col justify-center items-center bg-muted/40 p-4 sm:p-6 md:p-8">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center space-y-1">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
            {t('brand.name')}
          </h1>
          <p className="text-sm text-muted-foreground">
            {t('brand.portalTitle')}
          </p>
        </div>

        <div className="w-full">
          {children ?? <Outlet />}
        </div>
      </div>
    </div>
  );
}
