import { nanoid } from 'nanoid';
import { db } from '../db.js';
import { getSettingNumber } from './settings.js';

export async function createSession(
  userId: string,
  ipAddress?: string,
  userAgent?: string,
): Promise<string> {
  const sessionId = nanoid(64);
  const timeoutMinutes = await getSettingNumber('session.inactivityTimeoutMinutes', 30);
  const expiresAt = new Date(Date.now() + timeoutMinutes * 60 * 1000);

  await db.session.create({
    data: { id: sessionId, userId, expiresAt, lastActiveAt: new Date(), ipAddress, userAgent },
  });

  return sessionId;
}

export async function getSession(sessionId: string) {
  const session = await db.session.findUnique({
    where: { id: sessionId },
    include: { user: true },
  });

  if (!session) return null;

  const now = new Date();
  if (session.expiresAt < now) {
    await db.session.delete({ where: { id: sessionId } });
    return null;
  }

  // Refresh expiry on activity
  const timeoutMinutes = await getSettingNumber('session.inactivityTimeoutMinutes', 30);
  const newExpiresAt = new Date(now.getTime() + timeoutMinutes * 60 * 1000);
  await db.session.update({
    where: { id: sessionId },
    data: { lastActiveAt: now, expiresAt: newExpiresAt },
  });

  return session;
}

export async function deleteSession(sessionId: string): Promise<void> {
  await db.session.deleteMany({ where: { id: sessionId } });
}

export async function deleteUserSessions(userId: string): Promise<void> {
  await db.session.deleteMany({ where: { userId } });
}

export async function cleanExpiredSessions(): Promise<number> {
  const result = await db.session.deleteMany({ where: { expiresAt: { lt: new Date() } } });
  return result.count;
}
