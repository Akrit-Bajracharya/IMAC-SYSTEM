import type { Request, Response, NextFunction } from 'express';
import { getSession } from '../services/session.js';
import type { AuthUser, SystemRole } from '@imac/shared';
import { can, type Action } from '../lib/permissions.js';

export type AuthRequest = Request & { user?: AuthUser; sessionId?: string };

// SEC-02: requireAuth is wrapped in try/catch so that any database error
// (e.g. connection pool exhausted) is forwarded to next(err) → errorHandler,
// returning HTTP 500 instead of hanging the request or crashing the process.
export async function requireAuth(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const cookieName = process.env['SESSION_COOKIE_NAME'] ?? 'IMAC_SESSION';
    const sessionId = req.cookies?.[cookieName];
    if (!sessionId) return res.status(401).json({ error: 'unauthenticated', message: 'Not authenticated' });

    const session = await getSession(sessionId);
    if (!session || !session.user.isActive) {
      res.clearCookie(cookieName);
      return res.status(401).json({ error: 'unauthenticated', message: 'Session expired or invalid' });
    }

    req.user = {
      id: session.user.id,
      username: session.user.username,
      displayName: session.user.displayName,
      systemRole: session.user.systemRole as SystemRole,
      mustChangePassword: session.user.mustChangePassword,
    };
    req.sessionId = session.id;
    next();
  } catch (err) {
    next(err);
  }
}

export function requireRole(...roles: SystemRole[]) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) return res.status(401).json({ error: 'unauthenticated', message: 'Not authenticated' });
    if (!roles.includes(req.user.systemRole)) {
      return res.status(403).json({ error: 'forbidden', message: 'Insufficient permissions' });
    }
    next();
  };
}

export function requirePasswordChanged(req: AuthRequest, res: Response, next: NextFunction) {
  if (!req.user) return res.status(401).json({ error: 'unauthenticated', message: 'Not authenticated' });
  if (req.user.mustChangePassword) {
    return res.status(403).json({
      error: 'password_change_required',
      message: 'You must change your password before continuing',
    });
  }
  next();
}

export function requirePermission(action: Action) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) return res.status(401).json({ error: 'unauthenticated', message: 'Not authenticated' });
    if (!can(req.user, action)) {
      return res.status(403).json({ error: 'forbidden', message: 'Insufficient permissions' });
    }
    next();
  };
}
