import { db } from '../db.js';
import { logger } from '../logger.js';

export const MAX_STREAMS_PER_USER = 5;
export const MAX_TOTAL_STREAMS = 500;
export const PING_INTERVAL_MS = 25_000;
export const SESSION_RECHECK_INTERVAL_MS = 60_000;

export interface StreamResponse {
  write: (chunk: string) => boolean | void;
  end: () => void;
  on: (event: string, listener: (...args: unknown[]) => void) => unknown;
  off?: (event: string, listener: (...args: unknown[]) => void) => unknown;
  removeListener?: (event: string, listener: (...args: unknown[]) => void) => unknown;
}

export interface UnreadStreamEvent {
  unreadCount: number;
  notificationId?: string;
}

interface StreamEntry {
  userId: string;
  sessionId: string | undefined;
  res: StreamResponse;
  pingTimer: ReturnType<typeof setInterval>;
  sessionTimer: ReturnType<typeof setInterval>;
  cleanup: () => void;
}

const userStreams = new Map<string, Set<StreamEntry>>();

export function getTotalStreamCount(): number {
  let total = 0;
  for (const set of userStreams.values()) {
    total += set.size;
  }
  return total;
}

export function getUserStreamCount(userId: string): number {
  return userStreams.get(userId)?.size ?? 0;
}

export function canAcceptNewStream(): boolean {
  return getTotalStreamCount() < MAX_TOTAL_STREAMS;
}

function detachListeners(
  res: StreamResponse,
  onClose: () => void,
  onError: () => void
) {
  if (typeof res.off === 'function') {
    res.off('close', onClose);
    res.off('error', onError);
  } else if (typeof res.removeListener === 'function') {
    res.removeListener('close', onClose);
    res.removeListener('error', onError);
  }
}

/**
 * Registers a new SSE response stream for a user.
 * - Returns null if total active streams >= MAX_TOTAL_STREAMS (500).
 * - If user already has MAX_STREAMS_PER_USER (5), evicts and closes the oldest stream
 *   and clears its ping & session timers (Amendment D).
 * - Sends ': ping\n\n' every 25s.
 * - Re-checks session validity every 60s using a read-only db.session.findUnique lookup
 *   (Amendment A: never refreshes lastActiveAt/expiresAt so idle sessions still expire).
 */
export function registerNotificationStream(
  userId: string,
  sessionId: string | undefined,
  res: StreamResponse
): StreamEntry | null {
  if (getTotalStreamCount() >= MAX_TOTAL_STREAMS) {
    return null;
  }

  let set = userStreams.get(userId);
  if (!set) {
    set = new Set<StreamEntry>();
    userStreams.set(userId, set);
  }

  // Evict oldest stream for this user if at cap (Amendment D)
  if (set.size >= MAX_STREAMS_PER_USER) {
    const oldest = set.values().next().value as StreamEntry | undefined;
    if (oldest) {
      oldest.cleanup();
    }
  }

  let cleaned = false;

  const cleanup = () => {
    if (cleaned) return;
    cleaned = true;

    clearInterval(entry.pingTimer);
    clearInterval(entry.sessionTimer);
    detachListeners(res, cleanup, cleanup);

    const currentSet = userStreams.get(userId);
    if (currentSet) {
      currentSet.delete(entry);
      if (currentSet.size === 0) {
        userStreams.delete(userId);
      }
    }

    try {
      res.end();
    } catch {
      // Ignore already-closed stream errors
    }
  };

  const pingTimer = setInterval(() => {
    try {
      res.write(': ping\n\n');
    } catch {
      cleanup();
    }
  }, PING_INTERVAL_MS);

  // Amendment A: Read-only session lookup (no update to lastActiveAt/expiresAt)
  const sessionTimer = setInterval(async () => {
    if (!sessionId) {
      cleanup();
      return;
    }

    try {
      const session = await db.session.findUnique({
        where: { id: sessionId },
        include: { user: true },
      });

      if (
        !session ||
        session.expiresAt < new Date() ||
        !session.user?.isActive ||
        session.user.mustChangePassword
      ) {
        cleanup();
      }
    } catch (err) {
      logger.warn({ err, userId }, 'Error re-checking SSE stream session');
    }
  }, SESSION_RECHECK_INTERVAL_MS);

  const entry: StreamEntry = {
    userId,
    sessionId,
    res,
    pingTimer,
    sessionTimer,
    cleanup,
  };

  res.on('close', cleanup);
  res.on('error', cleanup);

  set.add(entry);
  return entry;
}

/**
 * Publishes an 'unread' SSE event to all active streams of a specific user.
 * Strictly emits ONLY { unreadCount } and optional { notificationId } — never titles or payload text.
 */
export function publishToUser(userId: string, event: UnreadStreamEvent): void {
  const set = userStreams.get(userId);
  if (!set || set.size === 0) return;

  const safePayload: UnreadStreamEvent = {
    unreadCount: event.unreadCount,
    ...(event.notificationId ? { notificationId: event.notificationId } : {}),
  };

  const chunk = `event: unread\ndata: ${JSON.stringify(safePayload)}\n\n`;

  for (const entry of Array.from(set)) {
    try {
      entry.res.write(chunk);
    } catch {
      entry.cleanup();
    }
  }
}

export interface PendingStreamNotification {
  userId: string;
  notificationId?: string;
}

/**
 * Publishes unread notifications AFTER a database transaction has committed.
 * Never called inside $transaction.
 * Amendment C: Catches all synchronous and asynchronous errors so a publish failure
 * can never fail or alter the caller's HTTP response.
 */
export async function publishAfterCommit(
  notifications: PendingStreamNotification[]
): Promise<void> {
  if (!notifications || notifications.length === 0) return;

  try {
    // Deduplicate by userId, keeping the notificationId for each recipient
    const byUser = new Map<string, string | undefined>();
    for (const item of notifications) {
      if (item.userId && !byUser.has(item.userId)) {
        byUser.set(item.userId, item.notificationId);
      }
    }

    for (const [userId, notificationId] of byUser.entries()) {
      if (getUserStreamCount(userId) === 0) {
        continue;
      }
      const unreadCount = await db.notification.count({
        where: { userId, readAt: null },
      });
      publishToUser(userId, { unreadCount, notificationId });
    }
  } catch (err) {
    logger.warn({ err }, 'Failed to publish live notification after commit');
  }
}

/**
 * Closes all active notification streams and clears all timers (used on graceful shutdown & test cleanup).
 */
export function closeAllNotificationStreams(): void {
  for (const set of Array.from(userStreams.values())) {
    for (const entry of Array.from(set)) {
      entry.cleanup();
    }
  }
  userStreams.clear();
}
