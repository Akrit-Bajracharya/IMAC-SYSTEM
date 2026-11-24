import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import {
  FileText,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  AlertCircle,
  Filter,
  RotateCcw,
} from 'lucide-react';

import { useAuth } from '../../hooks/useAuth.js';
import { fetchAuditLogs } from '../../api/auditLogs.js';
import { fetchAdminUsers } from '../../api/adminUsers.js';
import {
  ALL_KNOWN_ACTIONS,
  ALL_KNOWN_ENTITY_TYPES,
} from '../../constants/auditLogs.js';
import {
  validateAuditDateRange,
  formatPaginationSummary,
  formatSnapshotText,
  resolveAuditLogError,
} from '../../lib/auditLogHelpers.js';
import { getKathmanduToday, addDays, formatDateTimeDisplay } from '../../lib/dateUtils.js';

import { Button } from '../../components/ui/button.js';
import { Input } from '../../components/ui/input.js';
import { Label } from '../../components/ui/label.js';
import { Select } from '../../components/ui/select.js';
import { Badge } from '../../components/ui/badge.js';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/card.js';
import { Alert, AlertDescription, AlertTitle } from '../../components/ui/alert.js';
import { Spinner } from '../../components/layout/Spinner.js';
import { UnauthorizedPage } from '../errors/UnauthorizedPage.js';

const PAGE_SIZE = 50;

export function AuditLogPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const isSystemAdmin = user?.systemRole === 'system_admin';

  // Date defaults: Kathmandu today and Kathmandu 30 days prior
  const today = getKathmanduToday();
  const defaultFrom = addDays(today, -30);

  // Filter states
  const [from, setFrom] = useState<string>(defaultFrom);
  const [to, setTo] = useState<string>(today);
  const [action, setAction] = useState<string>('');
  const [entityType, setEntityType] = useState<string>('');
  const [actorUserId, setActorUserId] = useState<string>('');
  const [offset, setOffset] = useState<number>(0);
  const [expandedRowId, setExpandedRowId] = useState<string | null>(null);

  // Date validation
  const dateValidation = validateAuditDateRange(from, to);

  // Query: all system users for actor filter (Amendment D: unpaginated, active and inactive)
  const usersQuery = useQuery({
    queryKey: ['admin', 'users'],
    queryFn: fetchAdminUsers,
    staleTime: 5 * 60 * 1000,
  });

  // Query: audit logs
  const auditQuery = useQuery({
    queryKey: ['audit-logs', { from, to, action, entityType, actorUserId, offset, limit: PAGE_SIZE }],
    queryFn: () =>
      fetchAuditLogs({
        from,
        to,
        action,
        entityType,
        actorUserId,
        offset,
        limit: PAGE_SIZE,
      }),
    enabled: isSystemAdmin && dateValidation.valid,
  });

  // Role guard: if not system_admin, render UnauthorizedPage
  if (!isSystemAdmin) {
    return <UnauthorizedPage />;
  }

  // Filter change handlers (all reset offset to 0 and close expanded row)
  const handleFromChange = (newFrom: string) => {
    setFrom(newFrom);
    setOffset(0);
    setExpandedRowId(null);
  };

  const handleToChange = (newTo: string) => {
    setTo(newTo);
    setOffset(0);
    setExpandedRowId(null);
  };

  const handleActionChange = (newAction: string) => {
    setAction(newAction);
    setOffset(0);
    setExpandedRowId(null);
  };

  const handleEntityTypeChange = (newEntityType: string) => {
    setEntityType(newEntityType);
    setOffset(0);
    setExpandedRowId(null);
  };

  const handleActorChange = (newActor: string) => {
    setActorUserId(newActor);
    setOffset(0);
    setExpandedRowId(null);
  };

  const handleResetFilters = () => {
    setFrom(defaultFrom);
    setTo(today);
    setAction('');
    setEntityType('');
    setActorUserId('');
    setOffset(0);
    setExpandedRowId(null);
  };

  const toggleRowExpansion = (id: string) => {
    setExpandedRowId((prev) => (prev === id ? null : id));
  };

  const pagination = formatPaginationSummary(
    auditQuery.data?.total ?? 0,
    auditQuery.data?.limit ?? PAGE_SIZE,
    auditQuery.data?.offset ?? offset
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <FileText className="h-6 w-6 text-primary" />
            {t('admin.auditLog.title', 'Audit Log')}
          </h1>
          <p className="text-sm text-muted-foreground">
            {t('admin.auditLog.subtitle', 'System-wide activity and security audit trail')}
          </p>
        </div>
      </div>

      {/* Filter Card */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Filter className="h-4 w-4" />
              {t('common.filters', 'Filters')}
            </CardTitle>
            <Button
              variant="outline"
              size="sm"
              onClick={handleResetFilters}
              className="text-xs h-8 flex items-center gap-1"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              {t('admin.auditLog.filters.reset', 'Reset Filters')}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            {/* From Date */}
            <div className="space-y-1">
              <Label htmlFor="audit-filter-from" className="text-xs font-medium">
                {t('admin.auditLog.filters.from', 'From Date')}
              </Label>
              <Input
                id="audit-filter-from"
                type="date"
                value={from}
                onChange={(e) => handleFromChange(e.target.value)}
                className="h-9 text-xs"
              />
            </div>

            {/* To Date */}
            <div className="space-y-1">
              <Label htmlFor="audit-filter-to" className="text-xs font-medium">
                {t('admin.auditLog.filters.to', 'To Date')}
              </Label>
              <Input
                id="audit-filter-to"
                type="date"
                value={to}
                onChange={(e) => handleToChange(e.target.value)}
                className="h-9 text-xs"
              />
            </div>

            {/* Action Select */}
            <div className="space-y-1">
              <Label htmlFor="audit-filter-action" className="text-xs font-medium">
                {t('admin.auditLog.filters.action', 'Action')}
              </Label>
              <Select
                id="audit-filter-action"
                value={action}
                onChange={(e) => handleActionChange(e.target.value)}
                className="h-9 text-xs"
              >
                <option value="">{t('admin.auditLog.filters.allActions', 'All Actions')}</option>
                {ALL_KNOWN_ACTIONS.map((act) => (
                  <option key={act} value={act}>
                    {act}
                  </option>
                ))}
              </Select>
            </div>

            {/* Entity Type Select */}
            <div className="space-y-1">
              <Label htmlFor="audit-filter-entity" className="text-xs font-medium">
                {t('admin.auditLog.filters.entityType', 'Entity Type')}
              </Label>
              <Select
                id="audit-filter-entity"
                value={entityType}
                onChange={(e) => handleEntityTypeChange(e.target.value)}
                className="h-9 text-xs"
              >
                <option value="">{t('admin.auditLog.filters.allEntities', 'All Entity Types')}</option>
                {ALL_KNOWN_ENTITY_TYPES.map((et) => (
                  <option key={et} value={et}>
                    {et}
                  </option>
                ))}
              </Select>
            </div>

            {/* Actor Select */}
            <div className="space-y-1">
              <Label htmlFor="audit-filter-actor" className="text-xs font-medium">
                {t('admin.auditLog.filters.actor', 'Actor')}
              </Label>
              <Select
                id="audit-filter-actor"
                value={actorUserId}
                onChange={(e) => handleActorChange(e.target.value)}
                className="h-9 text-xs"
              >
                <option value="">{t('admin.auditLog.filters.allActors', 'All Actors')}</option>
                {usersQuery.data?.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.displayName} ({u.username})
                    {!u.isActive ? ` ${t('admin.auditLog.filters.inactiveUserSuffix', '(inactive)')}` : ''}
                  </option>
                ))}
              </Select>
              <p className="text-[10px] text-muted-foreground mt-0.5">
                Showing all system users (active and inactive).
              </p>
            </div>
          </div>

          {/* Date Validation Alert */}
          {!dateValidation.valid && (
            <Alert variant="destructive" className="py-2 text-xs">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle className="text-xs font-semibold">Invalid Date Range</AlertTitle>
              <AlertDescription>
                {t(dateValidation.errorKey ?? '', dateValidation.defaultMessage ?? 'Invalid date range.')}
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Main Content Area */}
      {auditQuery.isLoading ? (
        <Card>
          <CardContent className="py-12 flex flex-col items-center justify-center gap-3">
            <Spinner className="h-8 w-8 text-primary" />
            <p className="text-sm text-muted-foreground">
              {t('admin.auditLog.loading', 'Loading audit logs...')}
            </p>
          </CardContent>
        </Card>
      ) : auditQuery.isError ? (
        <Card className="border-destructive/40">
          <CardHeader>
            <div className="flex items-center gap-2 text-destructive">
              <AlertCircle className="h-5 w-5" />
              <CardTitle className="text-base font-semibold">Error Loading Audit Logs</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-foreground">
              {(() => {
                const err = resolveAuditLogError(auditQuery.error);
                return t(err.messageKey, err.defaultMessage);
              })()}
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => auditQuery.refetch()}
              className="flex items-center gap-2"
            >
              <RefreshCw className="h-4 w-4" />
              {t('common.retry', 'Retry')}
            </Button>
          </CardContent>
        </Card>
      ) : auditQuery.data?.items.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <FileText className="h-10 w-10 mx-auto mb-3 opacity-40" />
            <p className="text-sm font-medium">
              {t('admin.auditLog.empty', 'No audit entries match these filters')}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {/* Desktop / Tablet Table View (sm and up) */}
          <div className="hidden sm:block border rounded-md bg-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-muted text-muted-foreground uppercase tracking-wider text-[11px] border-b">
                  <tr>
                    <th className="py-2.5 px-4 font-semibold">
                      {t('admin.auditLog.table.timestamp', 'Timestamp')}
                    </th>
                    <th className="py-2.5 px-4 font-semibold">
                      {t('admin.auditLog.table.actor', 'Actor')}
                    </th>
                    <th className="py-2.5 px-4 font-semibold">
                      {t('admin.auditLog.table.action', 'Action')}
                    </th>
                    <th className="py-2.5 px-4 font-semibold">
                      {t('admin.auditLog.table.entityType', 'Entity Type')}
                    </th>
                    <th className="py-2.5 px-4 font-semibold">
                      {t('admin.auditLog.table.entityId', 'Entity ID')}
                    </th>
                    <th className="py-2.5 px-4 font-semibold text-right">
                      {t('admin.auditLog.table.details', 'Details')}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {auditQuery.data?.items.map((item) => {
                    const isExpanded = expandedRowId === item.id;
                    const hasSnapshots =
                      (item.beforeSnapshot && Object.keys(item.beforeSnapshot).length > 0) ||
                      (item.afterSnapshot && Object.keys(item.afterSnapshot).length > 0);

                    return (
                      <React.Fragment key={item.id}>
                        <tr
                          className="hover:bg-muted/50 cursor-pointer transition-colors"
                          onClick={() => toggleRowExpansion(item.id)}
                        >
                          <td className="py-3 px-4 font-mono text-[11px] whitespace-nowrap text-muted-foreground">
                            {formatDateTimeDisplay(item.createdAt)}
                          </td>
                          <td className="py-3 px-4 whitespace-nowrap font-medium text-foreground">
                            {item.actor.displayName}{' '}
                            <span className="text-muted-foreground font-normal">
                              (@{item.actor.username})
                            </span>
                          </td>
                          <td className="py-3 px-4 whitespace-nowrap">
                            <Badge variant="outline" className="font-mono text-[11px] px-1.5 py-0">
                              {item.action}
                            </Badge>
                          </td>
                          <td className="py-3 px-4 font-mono text-[11px] whitespace-nowrap">
                            {item.entityType}
                          </td>
                          <td className="py-3 px-4 font-mono text-[11px] whitespace-nowrap text-muted-foreground">
                            {item.entityId ?? '—'}
                          </td>
                          <td className="py-3 px-4 text-right whitespace-nowrap">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0"
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleRowExpansion(item.id);
                              }}
                              aria-label={isExpanded ? 'Collapse row' : 'Expand row'}
                            >
                              {isExpanded ? (
                                <ChevronUp className="h-4 w-4" />
                              ) : (
                                <ChevronDown className="h-4 w-4" />
                              )}
                            </Button>
                          </td>
                        </tr>

                        {isExpanded && (
                          <tr className="bg-muted/20">
                            <td colSpan={6} className="p-4 border-b">
                              {hasSnapshots ? (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                  <div>
                                    <h4 className="text-xs font-semibold mb-1 text-muted-foreground">
                                      {t('admin.auditLog.details.before', 'Before Snapshot')}
                                    </h4>
                                    <pre className="text-xs bg-muted p-2 rounded overflow-auto max-h-60 font-mono whitespace-pre-wrap break-all border">
                                      {formatSnapshotText(item.beforeSnapshot)}
                                    </pre>
                                  </div>
                                  <div>
                                    <h4 className="text-xs font-semibold mb-1 text-muted-foreground">
                                      {t('admin.auditLog.details.after', 'After Snapshot')}
                                    </h4>
                                    <pre className="text-xs bg-muted p-2 rounded overflow-auto max-h-60 font-mono whitespace-pre-wrap break-all border">
                                      {formatSnapshotText(item.afterSnapshot)}
                                    </pre>
                                  </div>
                                </div>
                              ) : (
                                <p className="text-xs text-muted-foreground italic">
                                  {t('admin.auditLog.details.noSnapshots', 'No snapshot data available')}
                                </p>
                              )}
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mobile Card List View (<640px, stacked cards, no horizontal scroll) */}
          <div className="block sm:hidden space-y-3">
            {auditQuery.data?.items.map((item) => {
              const isExpanded = expandedRowId === item.id;
              const hasSnapshots =
                (item.beforeSnapshot && Object.keys(item.beforeSnapshot).length > 0) ||
                (item.afterSnapshot && Object.keys(item.afterSnapshot).length > 0);

              return (
                <Card key={item.id} className="p-3 text-xs space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <Badge variant="outline" className="font-mono text-[11px] px-1.5 py-0 break-all">
                      {item.action}
                    </Badge>
                    <span className="font-mono text-[10px] text-muted-foreground whitespace-nowrap">
                      {formatDateTimeDisplay(item.createdAt)}
                    </span>
                  </div>

                  <div className="space-y-1 text-muted-foreground">
                    <div>
                      <span className="font-medium text-foreground">Actor: </span>
                      {item.actor.displayName} (@{item.actor.username})
                    </div>
                    <div>
                      <span className="font-medium text-foreground">Entity: </span>
                      <span className="font-mono">{item.entityType}</span>
                      {item.entityId && (
                        <span className="font-mono text-muted-foreground ml-1">
                          ({item.entityId})
                        </span>
                      )}
                    </div>
                  </div>

                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => toggleRowExpansion(item.id)}
                    className="w-full h-8 text-xs flex items-center justify-center gap-1 mt-1 border"
                  >
                    {isExpanded ? (
                      <>
                        <ChevronUp className="h-3.5 w-3.5" />
                        Hide Details
                      </>
                    ) : (
                      <>
                        <ChevronDown className="h-3.5 w-3.5" />
                        View Details
                      </>
                    )}
                  </Button>

                  {isExpanded && (
                    <div className="pt-2 border-t mt-2 space-y-3">
                      {hasSnapshots ? (
                        <>
                          <div>
                            <h4 className="text-[11px] font-semibold mb-1 text-muted-foreground">
                              {t('admin.auditLog.details.before', 'Before Snapshot')}
                            </h4>
                            <pre className="text-[11px] bg-muted p-2 rounded overflow-auto max-h-48 font-mono whitespace-pre-wrap break-all border">
                              {formatSnapshotText(item.beforeSnapshot)}
                            </pre>
                          </div>
                          <div>
                            <h4 className="text-[11px] font-semibold mb-1 text-muted-foreground">
                              {t('admin.auditLog.details.after', 'After Snapshot')}
                            </h4>
                            <pre className="text-[11px] bg-muted p-2 rounded overflow-auto max-h-48 font-mono whitespace-pre-wrap break-all border">
                              {formatSnapshotText(item.afterSnapshot)}
                            </pre>
                          </div>
                        </>
                      ) : (
                        <p className="text-[11px] text-muted-foreground italic">
                          {t('admin.auditLog.details.noSnapshots', 'No snapshot data available')}
                        </p>
                      )}
                    </div>
                  )}
                </Card>
              );
            })}
          </div>

          {/* Pagination Controls */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
            <p className="text-xs text-muted-foreground font-medium">
              {pagination.summaryText}
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setOffset(Math.max(0, offset - PAGE_SIZE));
                  setExpandedRowId(null);
                }}
                disabled={!pagination.hasPrev || auditQuery.isLoading}
                className="text-xs h-8"
              >
                {t('common.previous', 'Previous')}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setOffset(offset + PAGE_SIZE);
                  setExpandedRowId(null);
                }}
                disabled={!pagination.hasNext || auditQuery.isLoading}
                className="text-xs h-8"
              >
                {t('common.next', 'Next')}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
