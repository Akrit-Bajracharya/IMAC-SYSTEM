import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  LayoutDashboard,
  BookUser,
  ClipboardList,
  Calendar,
  Clock,
  LogOut,
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth.js';
import { Badge } from '../ui/badge.js';
import { Button } from '../ui/button.js';
import { cn } from '../../lib/utils.js';

export function EmployeeLayout() {
  const { t } = useTranslation();
  const { user, logout } = useAuth();
  const location = useLocation();

  const navItems = [
    {
      to: '/employee',
      label: t('nav.dashboard'),
      icon: LayoutDashboard,
      end: true,
    },
    {
      to: '/employee/directory',
      label: t('nav.directory'),
      icon: BookUser,
      end: false,
    },
    {
      to: '/employee/work-log',
      label: t('nav.workLog'),
      icon: ClipboardList,
      end: false,
    },
    {
      to: '/employee/leave',
      label: t('nav.leave'),
      icon: Calendar,
      end: false,
    },
    {
      to: '/employee/overtime',
      label: t('nav.overtime'),
      icon: Clock,
      end: false,
    },
  ];

  const currentNav = navItems.find((item) =>
    item.end ? location.pathname === item.to : location.pathname.startsWith(item.to)
  );
  const pageTitle = currentNav ? currentNav.label : t('nav.dashboard');

  return (
    <div className="min-h-screen flex bg-background text-foreground">
      {/* Sidebar */}
      <aside className="w-16 md:w-60 shrink-0 border-r bg-card flex flex-col transition-all duration-200">
        <div className="h-16 flex items-center justify-center md:justify-start px-4 border-b">
          <span className="font-bold text-lg hidden md:inline truncate">
            {t('brand.name')}
          </span>
          <span className="font-bold text-lg md:hidden">IMAC</span>
        </div>

        <nav className="flex-1 p-2 md:p-4 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                    'hover:bg-accent hover:text-accent-foreground',
                    isActive
                      ? 'bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground'
                      : 'text-muted-foreground'
                  )
                }
                title={item.label}
              >
                <Icon className="h-5 w-5 shrink-0" />
                <span className="hidden md:inline truncate">{item.label}</span>
              </NavLink>
            );
          })}
        </nav>
      </aside>

      {/* Main Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className="h-16 border-b bg-card px-4 md:px-6 flex items-center justify-between gap-4">
          <h2 className="text-lg md:text-xl font-semibold truncate">{pageTitle}</h2>

          <div className="flex items-center gap-3">
            {user && (
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium hidden sm:inline">
                  {user.displayName}
                </span>
                <Badge variant="secondary" className="capitalize text-xs">
                  {t(`roles.${user.systemRole}`, { defaultValue: user.systemRole })}
                </Badge>
              </div>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => logout()}
              className="gap-2"
              title={t('auth.logout')}
            >
              <LogOut className="h-4 w-4" />
              <span className="hidden sm:inline">{t('auth.logout')}</span>
            </Button>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 p-4 md:p-6 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
