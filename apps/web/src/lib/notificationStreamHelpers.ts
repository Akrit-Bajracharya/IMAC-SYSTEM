/**
 * Pure helper functions for SSE Notification Stream client behavior (Step 18a).
 * All logic is purely functional, side-effect free, and unit tested in Node.
 */

export const STREAM_BACKOFF_BASE_MS = 5_000;
export const STREAM_BACKOFF_MAX_MS = 60_000;
export const HIDDEN_TAB_CLOSE_DELAY_MS = 2 * 60 * 1000; // 2 minutes
export const FALLBACK_POLL_INTERVAL_MS = 60_000;

export interface ParsedUnreadStreamEvent {
  unreadCount: number;
  notificationId?: string;
}

/**
 * Computes exponential backoff delay in milliseconds:
 * attempt 0 -> 5000ms (5s)
 * attempt 1 -> 10000ms (10s)
 * attempt 2 -> 20000ms (20s)
 * attempt 3 -> 40000ms (40s)
 * attempt >= 4 -> 60000ms (max 60s)
 */
export function getStreamBackoffDelayMs(attempt: number): number {
  if (typeof attempt !== 'number' || !Number.isFinite(attempt) || attempt <= 0) {
    return STREAM_BACKOFF_BASE_MS;
  }
  const exp = Math.floor(attempt);
  const raw = STREAM_BACKOFF_BASE_MS * Math.pow(2, Math.min(exp, 10));
  return Math.min(raw, STREAM_BACKOFF_MAX_MS);
}

/**
 * Parses an SSE 'unread' event data string safely.
 * Returns null for malformed JSON, non-object payloads, or invalid unreadCount.
 * Ignores any unknown fields.
 */
export function parseNotificationStreamEvent(
  rawData: unknown
): ParsedUnreadStreamEvent | null {
  if (typeof rawData !== 'string' || rawData.trim().length === 0) {
    return null;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawData);
  } catch {
    return null;
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return null;
  }

  const record = parsed as Record<string, unknown>;
  const unreadCount = record['unreadCount'];

  if (
    typeof unreadCount !== 'number' ||
    !Number.isInteger(unreadCount) ||
    unreadCount < 0
  ) {
    return null;
  }

  const rawId = record['notificationId'];
  if (typeof rawId === 'string' && rawId.trim().length > 0) {
    return {
      unreadCount,
      notificationId: rawId.trim(),
    };
  }

  return { unreadCount };
}

/**
 * Returns polling interval (60s) when stream is disconnected (fallback),
 * or false when SSE stream is actively connected.
 */
export function getUnreadFallbackRefetchInterval(
  isStreamConnected: boolean
): number | false {
  return isStreamConnected ? false : FALLBACK_POLL_INTERVAL_MS;
}

export type VisibilityDecision =
  | { cancelPendingClose: true; action: 'none' | 'reconnect_now' }
  | { cancelPendingClose: false; action: 'schedule_close' | 'none'; delayMs: number };

/**
 * Pure decision helper for browser tab visibility changes (Amendment G):
 * - When tab becomes visible: ALWAYS cancels any pending 2-minute hidden-tab close timer,
 *   and signals 'reconnect_now' if stream is currently closed.
 * - When tab becomes hidden: schedules close after 2 minutes if connected.
 */
export function decideStreamActionOnVisibility(params: {
  isVisible: boolean;
  isStreamOpen: boolean;
}): VisibilityDecision {
  if (params.isVisible) {
    return {
      cancelPendingClose: true,
      action: params.isStreamOpen ? 'none' : 'reconnect_now',
    };
  }

  return {
    cancelPendingClose: false,
    action: params.isStreamOpen ? 'schedule_close' : 'none',
    delayMs: HIDDEN_TAB_CLOSE_DELAY_MS,
  };
}
