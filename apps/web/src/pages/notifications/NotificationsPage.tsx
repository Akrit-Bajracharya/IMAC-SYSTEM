import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Bell, CheckCheck, AlertCircle, RefreshCw, Check } from 'lucide-react';

import { useAuth } from '../../hooks/useAuth.js';
import {
  fetchNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  type NotificationItem,
} from '../../api/notifications.js';
import {
  executeNotificationRowClick,
  mergeNotificationPages,
  notificationKeys,
  notificationText,
  resolveNotificationError,
} from '../../lib/notificationsHelpers.js';
import { formatDateTimeDisplay } from '../../lib/dateUtils.js';
import { cn } from '../../lib/utils.js';

import { Button } from '../../components/ui/button.js';
import { Badge } from '../../components/ui/badge.js';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card.js';
import { Alert, AlertDescription } from '../../components/ui/alert.js';
import { Spinner } from '../../components/layout/Spinner.js';

const PAGE_SIZE = 20;

export function NotificationsPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // All hooks declared unconditionally at the top before any early return
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const [offset, setOffset] = useState<number>(0);
  const [accumulatedItems, setAccumulatedItems] = useState<NotificationItem[]>([]);
  const [actionError, setActionError] = useState<string | null>(null);

  const unreadOnly = filter === 'unread';

  const listQuery = useQuery({
    queryKey: notificationKeys.list({
      unreadOnly,
      limit: PAGE_SIZE,
      offset,
    }),
    queryFn: () =>
      fetchNotifications({
        limit: PAGE_SIZE,
        offset,
        unreadOnly,
      }),
    enabled: Boolean(user),
  });

  useEffect(() => {
    const data = listQuery.data;
    if (!data) return;

    if (data.offset === 0) {
      setAccumulatedItems(data.items);
    } else {
      setAccumulatedItems((prev) => mergeNotificationPages(prev, data.items));
    }
  }, [listQuery.data]);

  const markReadMutation = useMutation({
    mutationFn: (id: string) => markNotificationRead(id),
    onSuccess: (_res, id) => {
      setActionError(null);
      const nowIso = new Date().toISOString();
      setAccumulatedItems((prev) =>
        unreadOnly
          ? prev.filter((item) => item.id !== id)
          : prev.map((item) =>
              item.id === id ? { ...item, readAt: item.readAt ?? nowIso } : item
            )
      );
      queryClient.invalidateQueries({ queryKey: notificationKeys.all });
    },
  });

  const markAllMutation = useMutation({
    mutationFn: () => markAllNotificationsRead(),
    onSuccess: () => {
      setActionError(null);
      setOffset(0);
      const nowIso = new Date().toISOString();
      setAccumulatedItems((prev) =>
        unreadOnly
          ? []
          : prev.map((item) => ({ ...item, readAt: item.readAt ?? nowIso }))
      );
      queryClient.invalidateQueries({ queryKey: notificationKeys.all });
    },
    onError: () => {
      setActionError(
        t(
          'notifications.errors.markAllReadFailed',
          'Could not mark all notifications as read. Please try again.'
        )
      );
    },
  });

  const handleFilterChange = (nextFilter: 'all' | 'unread') => {
    if (nextFilter === filter) return;
    setFilter(nextFilter);
    setOffset(0);
    setAccumulatedItems([]);
    setActionError(null);
  };

  const handleRowClick = async (item: NotificationItem) => {
    setActionError(null);
    await executeNotificationRowClick({
      item,
      role: user?.systemRole,
      markRead: (id) => markReadMutation.mutateAsync(id),
      navigate: (to) => navigate(to),
      onMarkReadError: () => {
        setActionError(
          t(
            'notifications.errors.markReadFailed',
            'Could not mark notification as read. Please try again.'
          )
        );
      },
    });
  };

  const handleMarkSingleReadOnly = async (
    e: React.MouseEvent,
    item: NotificationItem
  ) => {
    e.stopPropagation();
    if (item.readAt) return;
    setActionError(null);
    try {
      await markReadMutation.mutateAsync(item.id);
    } catch {
      setActionError(
        t(
          'notifications.errors.markReadFailed',
          'Could not mark notification as read. Please try again.'
        )
      );
    }
  };

  const total = listQuery.data?.total ?? 0;
  const unreadCount = listQuery.data?.unreadCount ?? 0;
  const hasMore = accumulatedItems.length < total;
  const isInitialLoading = listQuery.isLoading && accumulatedItems.length === 0;
  const isInitialError = listQuery.isError && accumulatedItems.length === 0;

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Bell className="h-6 w-6 text-primary shrink-0" />
            <span className="truncate">{t('notifications.title', 'Notifications')}</span>
          </h1>
          <p className="text-sm text-muted-foreground">
            {t(
              'notifications.subtitle',
              'Stay updated on task assignments, status changes, and team activity.'
            )}
          </p>
        </div>

        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={unreadCount === 0 || markAllMutation.isPending}
          onClick={() => markAllMutation.mutate()}
          className="self-start sm:self-auto gap-1.5"
        >
          <CheckCheck className="h-4 w-4" />
          {markAllMutation.isPending
            ? t('notifications.actions.markingAllRead', 'Marking...')
            : t('notifications.actions.markAllRead', 'Mark all as read')}
        </Button>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 border-b pb-3">
        <Button
          type="button"
          variant={filter === 'all' ? 'default' : 'outline'}
          size="sm"
          onClick={() => handleFilterChange('all')}
        >
          {t('notifications.filters.all', 'All')}
        </Button>
        <Button
          type="button"
          variant={filter === 'unread' ? 'default' : 'outline'}
          size="sm"
          onClick={() => handleFilterChange('unread')}
        >
          {t('notifications.filters.unread', 'Unread')}
        </Button>
      </div>

      {/* Inline error for mark-read / mark-all-read failures */}
      {actionError && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{actionError}</AlertDescription>
        </Alert>
      )}

      {/* Content Area */}
      {isInitialLoading ? (
        <Card>
          <CardContent className="py-12 flex flex-col items-center justify-center gap-3">
            <Spinner className="h-8 w-8 text-primary" />
            <p className="text-sm text-muted-foreground">
              {t('notifications.loading', 'Loading notifications...')}
            </p>
          </CardContent>
        </Card>
      ) : isInitialError ? (
        <Card className="border-destructive/40">
          <CardHeader>
            <div className="flex items-center gap-2 text-destructive">
              <AlertCircle className="h-5 w-5" />
              <CardTitle className="text-base font-semibold">
                {t('common.error', 'An error occurred')}
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-foreground">
              {(() => {
                const err = resolveNotificationError(listQuery.error);
                return t(err.messageKey, err.defaultMessage);
              })()}
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => listQuery.refetch()}
              className="gap-2"
            >
              <RefreshCw className="h-4 w-4" />
              {t('notifications.actions.retry', 'Retry')}
            </Button>
          </CardContent>
        </Card>
      ) : accumulatedItems.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <Bell className="h-10 w-10 mx-auto mb-3 opacity-40" />
            <p className="text-sm font-medium">
              {unreadOnly
                ? t('notifications.empty.unread', 'No unread notifications')
                : t('notifications.empty.all', 'No notifications yet')}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          <div className="border rounded-lg bg-card divide-y overflow-hidden">
            {accumulatedItems.map((item) => {
              const isUnread = !item.readAt;
              return (
                <div
                  key={item.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => handleRowClick(item)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      handleRowClick(item);
                    }
                  }}
                  className={cn(
                    'w-full text-left p-4 transition-colors flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 cursor-pointer hover:bg-accent/50 focus:bg-accent/50 focus:outline-none',
                    isUnread && 'bg-primary/5 border-l-4 border-l-primary'
                  )}
                >
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p
                        className={cn(
                          'text-sm break-words',
                          isUnread
                            ? 'font-semibold text-foreground'
                            : 'text-muted-foreground'
                        )}
                      >
                        {notificationText(item, t)}
                      </p>
                      {isUnread && (
                        <Badge variant="default" className="text-[10px] px-1.5 py-0">
                          {t('notifications.status.unread', 'Unread')}
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {formatDateTimeDisplay(item.createdAt)}
                    </p>
                  </div>

                  {isUnread && (
                    <div className="shrink-0">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={(e) => handleMarkSingleReadOnly(e, item)}
                        disabled={markReadMutation.isPending}
                        className="h-8 text-xs gap-1"
                      >
                        <Check className="h-3.5 w-3.5" />
                        {t('notifications.actions.markRead', 'Mark as read')}
                      </Button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {hasMore && (
            <div className="flex justify-center pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={listQuery.isFetching}
                onClick={() => setOffset((prev) => prev + PAGE_SIZE)}
              >
                {listQuery.isFetching
                  ? t('notifications.actions.loadingMore', 'Loading...')
                  : t('notifications.actions.loadMore', 'Load more')}
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
