import { Router, type Response } from 'express';
import type { Prisma } from '@prisma/client';
import { db } from '../db.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { requireAuth, type AuthRequest } from '../middleware/auth.js';
import { can } from '../lib/permissions.js';
import { isValidUuid } from '../services/projectAccess.js';

export const notificationsRouter = Router();

// ── GET /api/notifications/unread-count (Registered BEFORE /:id/read) ───────────

notificationsRouter.get(
  '/unread-count',
  requireAuth,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    if (!can(req.user!, 'notification:read')) {
      return res.status(403).json({
        error: 'forbidden',
        message: 'You do not have permission to access notifications',
      });
    }

    const unreadCount = await db.notification.count({
      where: {
        userId: req.user!.id,
        readAt: null,
      },
    });

    return res.status(200).json({ unreadCount });
  })
);

// ── POST /api/notifications/read-all (Registered BEFORE /:id/read) ─────────────

notificationsRouter.post(
  '/read-all',
  requireAuth,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    if (!can(req.user!, 'notification:update')) {
      return res.status(403).json({
        error: 'forbidden',
        message: 'You do not have permission to update notifications',
      });
    }

    const result = await db.notification.updateMany({
      where: {
        userId: req.user!.id,
        readAt: null,
      },
      data: {
        readAt: new Date(),
      },
    });

    return res.status(200).json({ updated: result.count });
  })
);

// ── GET /api/notifications (List Own Notifications) ────────────────────────────

notificationsRouter.get(
  '/',
  requireAuth,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    if (!can(req.user!, 'notification:read')) {
      return res.status(403).json({
        error: 'forbidden',
        message: 'You do not have permission to access notifications',
      });
    }

    // 1. Validate query parameters: all must be plain non-empty strings
    for (const [key, val] of Object.entries(req.query)) {
      if (val !== undefined && typeof val !== 'string') {
        return res.status(400).json({
          error: 'validation_error',
          message: `Query parameter "${key}" must be a plain string`,
        });
      }
      if (typeof val === 'string' && val.trim() === '') {
        return res.status(400).json({
          error: 'validation_error',
          message: `Query parameter "${key}" cannot be empty`,
        });
      }
    }

    // 2. Parse limit (default 20, max 100)
    let limit = 20;
    const rawLimit = typeof req.query['limit'] === 'string' ? req.query['limit'] : undefined;
    if (rawLimit !== undefined) {
      const trimmedLimit = rawLimit.trim();
      const parsedLimit = parseInt(trimmedLimit, 10);
      if (!/^\d+$/.test(trimmedLimit) || isNaN(parsedLimit) || parsedLimit < 1 || parsedLimit > 100) {
        return res.status(400).json({
          error: 'validation_error',
          message: 'Parameter "limit" must be an integer between 1 and 100',
        });
      }
      limit = parsedLimit;
    }

    // 3. Parse offset (default 0, offset 0 is explicitly valid)
    let offset = 0;
    const rawOffset = typeof req.query['offset'] === 'string' ? req.query['offset'] : undefined;
    if (rawOffset !== undefined) {
      const trimmedOffset = rawOffset.trim();
      const parsedOffset = parseInt(trimmedOffset, 10);
      if (!/^\d+$/.test(trimmedOffset) || isNaN(parsedOffset) || parsedOffset < 0) {
        return res.status(400).json({
          error: 'validation_error',
          message: 'Parameter "offset" must be a non-negative integer',
        });
      }
      offset = parsedOffset;
    }

    // 4. Parse unreadOnly (strict boolean: "true" or "false" only, "maybe" returns 400)
    let unreadOnly = false;
    const rawUnreadOnly = typeof req.query['unreadOnly'] === 'string' ? req.query['unreadOnly'] : undefined;
    if (rawUnreadOnly !== undefined) {
      const trimmed = rawUnreadOnly.trim().toLowerCase();
      if (trimmed === 'true') {
        unreadOnly = true;
      } else if (trimmed === 'false') {
        unreadOnly = false;
      } else {
        return res.status(400).json({
          error: 'validation_error',
          message: 'Parameter "unreadOnly" must be a boolean (\'true\' or \'false\')',
        });
      }
    }

    // 5. Query notifications: strictly scoped to session user id
    const userId = req.user!.id;
    const where: Prisma.NotificationWhereInput = {
      userId,
      ...(unreadOnly ? { readAt: null } : {}),
    };

    const [items, total, unreadCount] = await Promise.all([
      db.notification.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: limit,
        skip: offset,
      }),
      db.notification.count({ where }),
      db.notification.count({
        where: {
          userId,
          readAt: null,
        },
      }),
    ]);

    return res.status(200).json({
      items,
      total,
      unreadCount,
      limit,
      offset,
    });
  })
);

// ── POST /api/notifications/:id/read (Mark Single Notification Read) ───────────

notificationsRouter.post(
  '/:id/read',
  requireAuth,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    if (!can(req.user!, 'notification:update')) {
      return res.status(403).json({
        error: 'forbidden',
        message: 'You do not have permission to update notifications',
      });
    }

    const { id } = req.params;

    // Uniform 404 response if ID is malformed or invalid UUID
    if (!id || !isValidUuid(id)) {
      return res.status(404).json({
        error: 'not_found',
        message: 'Notification not found',
      });
    }

    // Amendment E: updateMany with where { id, userId } (no readAt: null in where so repeated reads stay 200)
    // Returns uniform 404 if count is 0 (covers missing ID and other users' IDs)
    const result = await db.notification.updateMany({
      where: {
        id,
        userId: req.user!.id,
      },
      data: {
        readAt: new Date(),
      },
    });

    if (result.count === 0) {
      return res.status(404).json({
        error: 'not_found',
        message: 'Notification not found',
      });
    }

    return res.status(200).json({ success: true });
  })
);
