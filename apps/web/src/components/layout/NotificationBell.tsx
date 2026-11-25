import { useState, useRef, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Bell, CheckCheck } from 'lucide-react';

import { useAuth } from '../../hooks/useAuth.js';
import {
  fetchNotifications,
  fetchUnreadCount,
  markAllNotificationsRead,
  markNotificationRead,
} from '../../api/notifications.js';
import {
  executeNotificationRowClick,
  formatUnreadBadge,
  notificationKeys,
  notificationText,
  resolveNotificationError,
} from '../../lib/notificationsHelpers.js';
import { formatDateTimeDisplay } from '../../lib/dateUtils.js';
import { cn } from '../../lib/utils.js';
import { Button } from '../ui/button.js';
import { Spinner } from './Spinner.js';

export function NotificationBell() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [isOpen, setIsOpen] = useState(false);
  const [inlineError, setInlineError] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const bellButtonRef = useRef<HTMLButtonElement>(null);

  // Only the unread-count query polls (60s, paused when tab is hidden, refetch on focus).
  // If it fails, show the bell without a badge and no error popup.
  const unreadCountQuery = useQuery({
    queryKey: notificationKeys.unreadCount,
    queryFn: fetchUnreadCount,
    refetchInterval: 60_000,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
    enabled: Boolean(user),
  });

  // Dropdown list loads ONLY when opened and shares the query key family with NotificationsPage.
  const listQuery = useQuery({
    queryKey: notificationKeys.list({ limit: 5, offset: 0 }),
    queryFn: () => fetchNotifications({ limit: 5, offset: 0 }),
    enabled: Boolean(user) && isOpen,
  });

  const markReadMutation = useMutation({
    mutationFn: (id: string) => markNotificationRead(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: notificationKeys.all });
    },
  });

  const markAllMutation = useMutation({
    mutationFn: () => markAllNotificationsRead(),
    onSuccess: () => {
      setInlineError(null);
      queryClient.invalidateQueries({ queryKey: notificationKeys.all });
    },
    onError: () => {
      setInlineError(
        t(
          'notifications.errors.markAllReadFailed',
          'Could not mark all notifications as read. Please try again.'
        )
      );
    },
  });

  // Close on outside click and Escape (returning focus to bell button on Escape).
  useEffect(() => {
    if (!isOpen) return;

    function handleMouseDown(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsOpen(false);
        bellButtonRef.current?.focus();
      }
    }

    document.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleMouseDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const unreadCount = unreadCountQuery.isError
    ? 0
    : (unreadCountQuery.data?.unreadCount ?? 0);
  const badgeText = formatUnreadBadge(unreadCount);
  const items = listQuery.data?.items ?? [];

  const handleRowClick = async (item: (typeof items)[number]) => {
    setInlineError(null);
    await executeNotificationRowClick({
      item,
      role: user?.systemRole,
      markRead: (id) => markReadMutation.mutateAsync(id),
      navigate: (to) => {
        setIsOpen(false);
        navigate(to);
      },
      onMarkReadError: () => {
        setInlineError(
          t(
            'notifications.errors.markReadFailed',
            'Could not mark notification as read. Please try again.'
          )
        );
      },
    });
  };

  return (
    <div ref={containerRef} className="relative">
      <Button
        ref={bellButtonRef}
        type="button"
        variant="ghost"
        size="icon"
        onClick={() => {
          setInlineError(null);
          setIsOpen((prev) => !prev);
        }}
        aria-label={t('notifications.bell.ariaLabel', {
          count: unreadCount,
          defaultValue: 'Notifications ({{count}} unread)',
        })}
        aria-expanded={isOpen}
        aria-haspopup="true"
        className="relative"
      >
        <Bell className="h-5 w-5" />
        {badgeText && (
          <span
            aria-hidden="true"
            className="absolute -top-0.5 -right-0.5 min-w-[1.125rem] h-[1.125rem] px-1 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center leading-none"
          >
            {badgeText}
          </span>
        )}
      </Button>

      {isOpen && (
        <div
          role="region"
          aria-label={t('notifications.bell.dropdownTitle', 'Notifications')}
          className="absolute right-0 mt-2 w-[calc(100vw-2rem)] max-w-[22rem] sm:w-80 rounded-lg border bg-card text-card-foreground shadow-lg z-50 overflow-hidden"
        >
          {/* Dropdown Header */}
          <div className="flex items-center justify-between gap-2 px-3 py-2.5 border-b bg-muted/40">
            <span className="text-sm font-semibold">
              {t('notifications.bell.dropdownTitle', 'Notifications')}
            </span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={unreadCount === 0 || markAllMutation.isPending}
              onClick={() => markAllMutation.mutate()}
              className="h-7 px-2 text-xs gap-1"
            >
              <CheckCheck className="h-3.5 w-3.5" />
              {markAllMutation.isPending
                ? t('notifications.bell.markingAllRead', 'Marking...')
                : t('notifications.bell.markAllRead', 'Mark all as read')}
            </Button>
          </div>

          {inlineError && (
            <div className="px-3 py-2 text-xs text-destructive bg-destructive/10 border-b">
              {inlineError}
            </div>
          )}

          {/* Dropdown Body */}
          <div className="max-h-80 overflow-y-auto divide-y">
            {listQuery.isLoading ? (
              <div className="py-8 flex flex-col items-center justify-center gap-2 text-xs text-muted-foreground">
                <Spinner className="h-5 w-5" />
                <span>{t('notifications.bell.loading', 'Loading notifications...')}</span>
              </div>
            ) : listQuery.isError ? (
              <div className="p-4 text-center space-y-2">
                <p className="text-xs text-destructive">
                  {(() => {
                    const err = resolveNotificationError(listQuery.error);
                    return t(err.messageKey, err.defaultMessage);
                  })()}
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => listQuery.refetch()}
                >
                  {t('notifications.actions.retry', 'Retry')}
                </Button>
              </div>
            ) : items.length === 0 ? (
              <div className="py-8 px-4 text-center text-xs text-muted-foreground">
                {t('notifications.bell.empty', 'No notifications yet')}
              </div>
            ) : (
              items.map((item) => {
                const isUnread = !item.readAt;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleRowClick(item)}
                    className={cn(
                      'w-full text-left px-3 py-2.5 transition-colors hover:bg-accent/60 focus:bg-accent/60 focus:outline-none',
                      isUnread && 'bg-primary/5'
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p
                        className={cn(
                          'text-xs leading-snug break-words',
                          isUnread ? 'font-semibold text-foreground' : 'text-muted-foreground'
                        )}
                      >
                        {notificationText(item, t)}
                      </p>
                      {isUnread && (
                        <span className="shrink-0 inline-flex items-center rounded bg-primary/15 px-1.5 py-0.5 text-[10px] font-semibold text-primary">
                          {t('notifications.status.unread', 'Unread')}
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      {formatDateTimeDisplay(item.createdAt)}
                    </p>
                  </button>
                );
              })
            )}
          </div>

          {/* Dropdown Footer */}
          <div className="border-t px-3 py-2 bg-muted/30 text-center">
            <Link
              to="/notifications"
              onClick={() => setIsOpen(false)}
              className="text-xs font-medium text-primary hover:underline inline-block py-0.5"
            >
              {t('notifications.bell.viewAll', 'View all')}
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
