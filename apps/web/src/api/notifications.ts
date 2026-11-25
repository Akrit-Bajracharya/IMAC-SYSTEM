import { apiClient } from './client.js';
import {
  buildNotificationQueryParams,
  type FetchNotificationsParams,
  type MarkAllReadResponse,
  type MarkReadResponse,
  type NotificationItem,
  type NotificationsListResponse,
  type UnreadCountResponse,
} from '../lib/notificationsHelpers.js';

export type {
  FetchNotificationsParams,
  MarkAllReadResponse,
  MarkReadResponse,
  NotificationItem,
  NotificationsListResponse,
  UnreadCountResponse,
};

/**
 * Fetches notifications for the current authenticated user.
 * Never sends empty or undefined query values; offset 0 is always sent.
 */
export async function fetchNotifications(
  params: FetchNotificationsParams = {}
): Promise<NotificationsListResponse> {
  const cleanParams = buildNotificationQueryParams(params);
  const res = await apiClient.get<NotificationsListResponse>('/notifications', {
    params: cleanParams,
  });
  return res.data;
}

/**
 * Fetches the unread notification count for the current authenticated user.
 */
export async function fetchUnreadCount(): Promise<UnreadCountResponse> {
  const res = await apiClient.get<UnreadCountResponse>(
    '/notifications/unread-count'
  );
  return res.data;
}

/**
 * Marks a single notification as read.
 */
export async function markNotificationRead(
  id: string
): Promise<MarkReadResponse> {
  const res = await apiClient.post<MarkReadResponse>(
    `/notifications/${encodeURIComponent(id)}/read`
  );
  return res.data;
}

/**
 * Marks all unread notifications for the current user as read.
 */
export async function markAllNotificationsRead(): Promise<MarkAllReadResponse> {
  const res = await apiClient.post<MarkAllReadResponse>(
    '/notifications/read-all'
  );
  return res.data;
}
