import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import {
  Users,
  Search,
  Building2,
  Briefcase,
  Calendar,
  Clock,
  RefreshCw,
  AlertCircle,
  Shield,
} from 'lucide-react';
import { fetchDirectoryEmployees } from '../../api/directory.js';
import type { DirectoryEmployee } from '../../types/index.js';
import { useAuth } from '../../hooks/useAuth.js';
import { Input } from '../../components/ui/input.js';
import { Select } from '../../components/ui/select.js';
import { Badge } from '../../components/ui/badge.js';
import { Button } from '../../components/ui/button.js';
import { Alert, AlertDescription } from '../../components/ui/alert.js';
import { AvailabilityBadge } from '../../components/common/AvailabilityBadge.js';

export function DirectoryPage() {
  const { t } = useTranslation();
  const { user: currentUser } = useAuth();
  const isPrivileged =
    currentUser?.systemRole === 'system_admin' || currentUser?.systemRole === 'hr_admin';

  const [search, setSearch] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('all');

  const {
    data: employees = [],
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ['directory', { search, department: departmentFilter }],
    queryFn: () =>
      fetchDirectoryEmployees({
        search: search.trim() || undefined,
        department: departmentFilter !== 'all' ? departmentFilter : undefined,
      }),
  });

  // Extract unique departments for dropdown
  const departments = useMemo(() => {
    const set = new Set<string>();
    employees.forEach((e) => {
      if (e.department) set.add(e.department);
    });
    return Array.from(set).sort();
  }, [employees]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {t('directory.pageTitle')}
          </h1>
          <p className="text-sm text-muted-foreground">
            {t('directory.pageSubtitle')}
          </p>
        </div>

        {isPrivileged && (
          <Badge variant="outline" className="gap-1.5 self-start sm:self-auto py-1 px-3">
            <Shield className="h-3.5 w-3.5 text-primary" />
            <span className="text-xs">
              {t('directory.privilegedViewActive', {
                defaultValue: 'Administrative View Active',
              })}
            </span>
          </Badge>
        )}
      </div>

      {/* Filter toolbar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 bg-card p-4 rounded-xl border">
        {/* Search Input */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={t('directory.filters.searchPlaceholder')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* Department Filter */}
        <div className="w-full sm:w-52">
          <Select
            value={departmentFilter}
            onChange={(e) => setDepartmentFilter(e.target.value)}
          >
            <option value="all">{t('directory.filters.allDepartments')}</option>
            {departments.map((dept) => (
              <option key={dept} value={dept}>
                {dept}
              </option>
            ))}
          </Select>
        </div>

        {/* Refresh */}
        <Button
          variant="outline"
          size="icon"
          onClick={() => refetch()}
          title={t('common.refresh')}
          className="shrink-0"
        >
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>

      {/* Main Content Area */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center p-12 bg-card rounded-xl border text-center space-y-3">
          <RefreshCw className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm font-medium text-muted-foreground">
            {t('directory.states.loading')}
          </p>
        </div>
      ) : isError ? (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            {error instanceof Error ? error.message : t('common.error')}
          </AlertDescription>
        </Alert>
      ) : employees.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-12 bg-card rounded-xl border text-center space-y-4">
          <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center text-muted-foreground">
            <Users className="h-6 w-6" />
          </div>
          <div>
            <h3 className="font-semibold text-lg">{t('directory.states.emptyTitle')}</h3>
            <p className="text-sm text-muted-foreground max-w-sm mt-1">
              {t('directory.states.emptyDescription')}
            </p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {employees.map((emp) => {
            const isSelf = currentUser?.id === emp.id;
            return (
              <div
                key={emp.id}
                className="bg-card rounded-xl border p-5 shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between"
              >
                <div>
                  {/* Top Bar: Avatar, Name, Availability */}
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex items-center gap-3">
                      <div className="h-11 w-11 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-base shrink-0">
                        {emp.displayName.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <h3 className="font-semibold text-base leading-tight text-foreground flex items-center gap-1.5">
                          {emp.displayName}
                          {isSelf && (
                            <span className="text-[11px] font-normal text-primary">
                              ({t('common.you')})
                            </span>
                          )}
                        </h3>
                        {emp.jobTitle ? (
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {emp.jobTitle}
                          </p>
                        ) : (
                          <p className="text-xs text-muted-foreground italic mt-0.5">
                            {t('directory.noTitle')}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Availability Badge */}
                    <AvailabilityBadge
                      status={emp.availability || 'available'}
                      message={emp.availabilityMessage}
                    />
                  </div>

                  {/* Department */}
                  <div className="flex items-center gap-2 text-xs text-muted-foreground mb-3">
                    <Building2 className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    <span className="truncate">
                      {emp.department || t('directory.unassignedDept')}
                    </span>
                  </div>

                  {/* Privileged-Only Extended Metadata */}
                  {isPrivileged && (
                    <div className="mt-3 pt-3 border-t border-border/60 grid grid-cols-2 gap-2 text-xs">
                      {emp.employeeCode && (
                        <div>
                          <span className="text-muted-foreground block text-[10px] uppercase font-semibold">
                            {t('admin.users.fields.employeeCode')}
                          </span>
                          <span className="font-mono text-foreground font-medium">
                            {emp.employeeCode}
                          </span>
                        </div>
                      )}

                      {emp.systemRole && (
                        <div>
                          <span className="text-muted-foreground block text-[10px] uppercase font-semibold">
                            {t('admin.users.fields.systemRole')}
                          </span>
                          <span className="text-foreground font-medium capitalize">
                            {t(`roles.${emp.systemRole}`, { defaultValue: emp.systemRole })}
                          </span>
                        </div>
                      )}

                      {emp.standardShiftHours !== undefined && (
                        <div>
                          <span className="text-muted-foreground block text-[10px] uppercase font-semibold">
                            {t('admin.users.fields.standardShiftHours')}
                          </span>
                          <span className="text-foreground font-medium">
                            {emp.standardShiftHours}h / day
                          </span>
                        </div>
                      )}

                      {emp.workingDaysPerWeek !== undefined && (
                        <div>
                          <span className="text-muted-foreground block text-[10px] uppercase font-semibold">
                            {t('admin.users.fields.workingDaysPerWeek')}
                          </span>
                          <span className="text-foreground font-medium">
                            {emp.workingDaysPerWeek} days / wk
                          </span>
                        </div>
                      )}

                      {emp.startDate && (
                        <div className="col-span-2">
                          <span className="text-muted-foreground block text-[10px] uppercase font-semibold">
                            {t('admin.users.fields.startDate')}
                          </span>
                          <span className="text-foreground font-medium">
                            {new Date(emp.startDate).toLocaleDateString()}
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
