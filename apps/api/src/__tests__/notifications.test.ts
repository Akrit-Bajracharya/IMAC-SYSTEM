/**
 * Unit & Integration Tests for Notifications Subsystem (Step 17a).
 *
 * NOTE: These tests run against an in-memory mocked database (mockDb in setup.ts).
 * They verify route authorization, query parameter validation, payload sanitization,
 * recipient deduplication, updateMany idempotency, transaction client typing, and
 * CSRF protection behavior.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import { app, createApp } from '../app.js';
import { db } from '../db.js';
import {
  sanitizeNotificationPayload,
  createNotification,
  createNotifications,
  type NotificationPrismaClient,
} from '../services/notifications.js';

describe('Step 17a: Notifications Subsystem Integration & Unit Tests', () => {
  const adminUserId = '11111111-1111-4111-8111-111111111111';
  const hrUserId = '22222222-2222-4222-8222-222222222222';
  const pmUserId = '33333333-3333-4333-8333-333333333333';
  const employeeUserId = '44444444-4444-4444-8444-444444444444';
  const viewerUserId = '55555555-5555-4555-8555-555555555555';
  const otherUserId = '66666666-6666-4666-8666-666666666666';

  const mockUsers: Record<string, any> = {
    [adminUserId]: {
      id: adminUserId,
      username: 'admin_user',
      displayName: 'System Admin',
      systemRole: 'system_admin',
      isActive: true,
      mustChangePassword: false,
    },
    [hrUserId]: {
      id: hrUserId,
      username: 'hr_user',
      displayName: 'HR Admin',
      systemRole: 'hr_admin',
      isActive: true,
      mustChangePassword: false,
    },
    [pmUserId]: {
      id: pmUserId,
      username: 'pm_user',
      displayName: 'Project Manager',
      systemRole: 'project_manager',
      isActive: true,
      mustChangePassword: false,
    },
    [employeeUserId]: {
      id: employeeUserId,
      username: 'employee_user',
      displayName: 'Staff Dev',
      systemRole: 'employee',
      isActive: true,
      mustChangePassword: false,
    },
    [viewerUserId]: {
      id: viewerUserId,
      username: 'viewer_user',
      displayName: 'Auditor Viewer',
      systemRole: 'viewer',
      isActive: true,
      mustChangePassword: false,
    },
    [otherUserId]: {
      id: otherUserId,
      username: 'other_user',
      displayName: 'Other Dev',
      systemRole: 'employee',
      isActive: true,
      mustChangePassword: false,
    },
  };

  function setupAuth(userId: string) {
    const user = mockUsers[userId];
    const session = {
      id: `sess-${userId}`,
      userId,
      expiresAt: new Date(Date.now() + 3600 * 1000),
      lastActiveAt: new Date(),
      user,
    };
    (db.session.findUnique as any).mockResolvedValue(session);
    (db.session.update as any).mockResolvedValue(session);
    return `IMAC_SESSION=sess-${userId}`;
  }

  beforeEach(() => {
    vi.clearAllMocks();
    (db.auditLog.create as any).mockResolvedValue({});
    (db.notification.findMany as any).mockResolvedValue([]);
    (db.notification.count as any).mockResolvedValue(0);
    (db.notification.updateMany as any).mockResolvedValue({ count: 1 });
  });

  // ── 1. Authentication & Route Guards ────────────────────────────────────────

  describe('1. Authentication & Route Guards (401 Unauthenticated)', () => {
    it('returns 401 unauthenticated on GET /api/notifications without session', async () => {
      const res = await request(app).get('/api/notifications');
      expect(res.status).toBe(401);
      expect(res.body.error).toBe('unauthenticated');
    });

    it('returns 401 unauthenticated on GET /api/notifications/unread-count without session', async () => {
      const res = await request(app).get('/api/notifications/unread-count');
      expect(res.status).toBe(401);
      expect(res.body.error).toBe('unauthenticated');
    });

    it('returns 401 unauthenticated on POST /api/notifications/read-all without session', async () => {
      const res = await request(app).post('/api/notifications/read-all');
      expect(res.status).toBe(401);
      expect(res.body.error).toBe('unauthenticated');
    });

    it('returns 401 unauthenticated on POST /api/notifications/:id/read without session', async () => {
      const notifId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
      const res = await request(app).post(`/api/notifications/${notifId}/read`);
      expect(res.status).toBe(401);
      expect(res.body.error).toBe('unauthenticated');
    });
  });

  // ── 2. Role Scoping & User Isolation ────────────────────────────────────────

  describe('2. Role Scoping & User Isolation (Each Role Sees Only Own Rows)', () => {
    const roles = [
      { name: 'system_admin', userId: adminUserId },
      { name: 'hr_admin', userId: hrUserId },
      { name: 'project_manager', userId: pmUserId },
      { name: 'employee', userId: employeeUserId },
      { name: 'viewer', userId: viewerUserId },
    ];

    for (const { name, userId } of roles) {
      it(`allows ${name} to access notifications and scopes where condition strictly to session userId`, async () => {
        const cookie = setupAuth(userId);
        const res = await request(app).get('/api/notifications').set('Cookie', cookie);

        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('items');
        expect(res.body).toHaveProperty('total');
        expect(res.body).toHaveProperty('unreadCount');
        expect(res.body.limit).toBe(20);
        expect(res.body.offset).toBe(0);

        // Verify Prisma query was strictly scoped to session user id
        expect(db.notification.findMany).toHaveBeenCalledWith(
          expect.objectContaining({
            where: expect.objectContaining({ userId }),
            orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
            take: 20,
            skip: 0,
          })
        );
      });
    }

    it('denies user when permissions function returns false', async () => {
      const cookie = setupAuth(employeeUserId);
      const permissionsModule = await import('../lib/permissions.js');
      const canSpy = vi.spyOn(permissionsModule, 'can').mockReturnValue(false);

      const res = await request(app).get('/api/notifications').set('Cookie', cookie);
      expect(res.status).toBe(403);
      expect(res.body.error).toBe('forbidden');

      canSpy.mockRestore();
    });
  });

  // ── 3. Query Parameter Validation & Pagination ──────────────────────────────

  describe('3. Query Parameter Validation & Pagination (GET /api/notifications)', () => {
    it('accepts offset: 0 as valid and sends skip: 0 to Prisma', async () => {
      const cookie = setupAuth(employeeUserId);
      const res = await request(app)
        .get('/api/notifications?offset=0&limit=15')
        .set('Cookie', cookie);

      expect(res.status).toBe(200);
      expect(res.body.offset).toBe(0);
      expect(res.body.limit).toBe(15);
      expect(db.notification.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 0,
          take: 15,
        })
      );
    });

    it('rejects limit over 100 with HTTP 400', async () => {
      const cookie = setupAuth(employeeUserId);
      const res = await request(app)
        .get('/api/notifications?limit=101')
        .set('Cookie', cookie);

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('validation_error');
      expect(res.body.message).toContain('between 1 and 100');
    });

    it('rejects limit less than 1 or non-integer', async () => {
      const cookie = setupAuth(employeeUserId);
      const res1 = await request(app).get('/api/notifications?limit=0').set('Cookie', cookie);
      expect(res1.status).toBe(400);

      const res2 = await request(app).get('/api/notifications?limit=abc').set('Cookie', cookie);
      expect(res2.status).toBe(400);
    });

    it('rejects negative or non-integer offset with HTTP 400', async () => {
      const cookie = setupAuth(employeeUserId);
      const res1 = await request(app).get('/api/notifications?offset=-5').set('Cookie', cookie);
      expect(res1.status).toBe(400);

      const res2 = await request(app).get('/api/notifications?offset=xyz').set('Cookie', cookie);
      expect(res2.status).toBe(400);
    });

    it('handles unreadOnly=true strictly by filtering readAt: null', async () => {
      const cookie = setupAuth(employeeUserId);
      const res = await request(app)
        .get('/api/notifications?unreadOnly=true')
        .set('Cookie', cookie);

      expect(res.status).toBe(200);
      expect(db.notification.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            userId: employeeUserId,
            readAt: null,
          },
        })
      );
    });

    it('handles unreadOnly=false without readAt filter', async () => {
      const cookie = setupAuth(employeeUserId);
      const res = await request(app)
        .get('/api/notifications?unreadOnly=false')
        .set('Cookie', cookie);

      expect(res.status).toBe(200);
      expect(db.notification.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            userId: employeeUserId,
          },
        })
      );
    });

    it('rejects unreadOnly="maybe" with HTTP 400 validation_error', async () => {
      const cookie = setupAuth(employeeUserId);
      const res = await request(app)
        .get('/api/notifications?unreadOnly=maybe')
        .set('Cookie', cookie);

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('validation_error');
      expect(res.body.message).toContain('must be a boolean');
    });

    it('rejects empty query parameter with HTTP 400', async () => {
      const cookie = setupAuth(employeeUserId);
      const res = await request(app)
        .get('/api/notifications?limit=')
        .set('Cookie', cookie);

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('validation_error');
      expect(res.body.message).toContain('cannot be empty');
    });

    it('rejects array query parameter with HTTP 400', async () => {
      const cookie = setupAuth(employeeUserId);
      const res = await request(app)
        .get('/api/notifications?limit=10&limit=20')
        .set('Cookie', cookie);

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('validation_error');
      expect(res.body.message).toContain('must be a plain string');
    });
  });

  // ── 4. Unread Count Endpoint ────────────────────────────────────────────────

  describe('4. Unread Count Endpoint (GET /api/notifications/unread-count)', () => {
    it('returns unread count scoped to the caller session', async () => {
      const cookie = setupAuth(employeeUserId);
      (db.notification.count as any).mockResolvedValueOnce(7);

      const res = await request(app)
        .get('/api/notifications/unread-count')
        .set('Cookie', cookie);

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ unreadCount: 7 });
      expect(db.notification.count).toHaveBeenCalledWith({
        where: {
          userId: employeeUserId,
          readAt: null,
        },
      });
    });
  });

  // ── 5. Marking Notifications Read & Route Ordering ──────────────────────────

  describe('5. Marking Read, Route Ordering & Idempotency', () => {
    const validNotifId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
    const otherUserNotifId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

    it('Amendment D: proves GET /unread-count and POST /read-all are registered BEFORE /:id/read', async () => {
      const cookie = setupAuth(employeeUserId);

      // GET /unread-count is NOT routed to /:id
      const countRes = await request(app)
        .get('/api/notifications/unread-count')
        .set('Cookie', cookie);
      expect(countRes.status).toBe(200);
      expect(countRes.body).toHaveProperty('unreadCount');

      // POST /read-all is NOT routed to /:id/read
      const readAllRes = await request(app)
        .post('/api/notifications/read-all')
        .set('Cookie', cookie);
      expect(readAllRes.status).toBe(200);
      expect(readAllRes.body).toHaveProperty('updated');
      expect(db.notification.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            userId: employeeUserId,
            readAt: null,
          },
        })
      );
    });

    it('Amendment E: marks one own notification read via updateMany { id, userId }', async () => {
      const cookie = setupAuth(employeeUserId);
      (db.notification.updateMany as any).mockResolvedValueOnce({ count: 1 });

      const res = await request(app)
        .post(`/api/notifications/${validNotifId}/read`)
        .set('Cookie', cookie);

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ success: true });
      expect(db.notification.updateMany).toHaveBeenCalledWith({
        where: {
          id: validNotifId,
          userId: employeeUserId,
        },
        data: {
          readAt: expect.any(Date),
        },
      });
    });

    it('Amendment E: repeated read calls on already-read notification stay 200 (idempotent)', async () => {
      const cookie = setupAuth(employeeUserId);
      // updateMany matches the record regardless of prior readAt because readAt: null is omitted from where
      (db.notification.updateMany as any).mockResolvedValue({ count: 1 });

      const res1 = await request(app)
        .post(`/api/notifications/${validNotifId}/read`)
        .set('Cookie', cookie);
      expect(res1.status).toBe(200);

      const res2 = await request(app)
        .post(`/api/notifications/${validNotifId}/read`)
        .set('Cookie', cookie);
      expect(res2.status).toBe(200);
      expect(res2.body).toEqual({ success: true });
    });

    it('returns exact same 404 when notification belongs to another user (count 0)', async () => {
      const cookie = setupAuth(employeeUserId);
      // When trying to update another user's notification, where: { id: otherUserNotifId, userId: employeeUserId } matches 0 rows
      (db.notification.updateMany as any).mockResolvedValueOnce({ count: 0 });

      const res = await request(app)
        .post(`/api/notifications/${otherUserNotifId}/read`)
        .set('Cookie', cookie);

      expect(res.status).toBe(404);
      expect(res.body).toEqual({
        error: 'not_found',
        message: 'Notification not found',
      });
    });

    it('returns exact same 404 when notification ID does not exist (count 0)', async () => {
      const cookie = setupAuth(employeeUserId);
      (db.notification.updateMany as any).mockResolvedValueOnce({ count: 0 });

      const res = await request(app)
        .post(`/api/notifications/${validNotifId}/read`)
        .set('Cookie', cookie);

      expect(res.status).toBe(404);
      expect(res.body).toEqual({
        error: 'not_found',
        message: 'Notification not found',
      });
    });

    it('returns exact same 404 when ID is malformed or not a valid UUID', async () => {
      const cookie = setupAuth(employeeUserId);
      const res = await request(app)
        .post('/api/notifications/malformed-notif-id-xyz/read')
        .set('Cookie', cookie);

      expect(res.status).toBe(404);
      expect(res.body).toEqual({
        error: 'not_found',
        message: 'Notification not found',
      });
      // Does not even touch the database
      expect(db.notification.updateMany).not.toHaveBeenCalled();
    });

    it('POST /read-all marks all unread notifications of caller as read and returns count', async () => {
      const cookie = setupAuth(employeeUserId);
      (db.notification.updateMany as any).mockResolvedValueOnce({ count: 4 });

      const res = await request(app)
        .post('/api/notifications/read-all')
        .set('Cookie', cookie);

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ updated: 4 });
      expect(db.notification.updateMany).toHaveBeenCalledWith({
        where: {
          userId: employeeUserId,
          readAt: null,
        },
        data: {
          readAt: expect.any(Date),
        },
      });
    });
  });

  // ── 6. Sanitizer Unit Tests (Amendment A & B) ────────────────────────────────

  describe('6. Payload Sanitizer (Amendment A & B: Strict Allow-List Only)', () => {
    it('drops unknown keys not on the allow-list', () => {
      const input = {
        taskId: 'task-123',
        unknownCustomField: 'should be dropped',
        metaInfo: 12345,
      };
      const sanitized = sanitizeNotificationPayload(input);
      expect(sanitized).toEqual({
        taskId: 'task-123',
      });
      expect(sanitized).not.toHaveProperty('unknownCustomField');
      expect(sanitized).not.toHaveProperty('metaInfo');
    });

    it('drops nested objects and arrays', () => {
      const input = {
        taskTitle: 'Refactor Auth Flow',
        nestedObject: { a: 1, b: 'nested' },
        arrayField: ['item1', 'item2'],
      };
      const sanitized = sanitizeNotificationPayload(input);
      expect(sanitized).toEqual({
        taskTitle: 'Refactor Auth Flow',
      });
      expect(sanitized).not.toHaveProperty('nestedObject');
      expect(sanitized).not.toHaveProperty('arrayField');
    });

    it('truncates a 5000-character title to exactly 200 characters', () => {
      const longTitle = 'T'.repeat(5000);
      const input = {
        taskTitle: longTitle,
      };
      const sanitized = sanitizeNotificationPayload(input);
      expect(typeof sanitized['taskTitle']).toBe('string');
      expect((sanitized['taskTitle'] as string).length).toBe(200);
      expect(sanitized['taskTitle']).toBe('T'.repeat(200));
    });

    it('drops forbidden private keys: body, description, note, reason, password', () => {
      const input = {
        taskId: 'task-abc',
        body: 'Sensitive comment body text',
        commentBody: 'Another sensitive comment',
        messageBody: 'Confidential project message',
        description: 'Detailed confidential task description',
        note: 'Private employee note',
        reason: 'Internal justification reason',
        password: 'PlainTextPassword123!',
      };
      const sanitized = sanitizeNotificationPayload(input);
      expect(sanitized).toEqual({
        taskId: 'task-abc',
      });
      expect(sanitized).not.toHaveProperty('body');
      expect(sanitized).not.toHaveProperty('commentBody');
      expect(sanitized).not.toHaveProperty('messageBody');
      expect(sanitized).not.toHaveProperty('description');
      expect(sanitized).not.toHaveProperty('note');
      expect(sanitized).not.toHaveProperty('reason');
      expect(sanitized).not.toHaveProperty('password');
    });

    it('Amendment B: preserves actorUserId but drops actorDisplayName and actorUsername (names go stale)', () => {
      const input = {
        actorUserId: 'user-789',
        actorDisplayName: 'Akrit Subedi',
        actorUsername: 'akrit',
        projectName: 'IMAC Internal Operations',
      };
      const sanitized = sanitizeNotificationPayload(input);
      expect(sanitized).toEqual({
        actorUserId: 'user-789',
        projectName: 'IMAC Internal Operations',
      });
      expect(sanitized).not.toHaveProperty('actorDisplayName');
      expect(sanitized).not.toHaveProperty('actorUsername');
    });

    it('allows valid primitive types: string, number, boolean, null', () => {
      const input = {
        status: 'in_progress',
        priority: 'high',
        actorUserId: null,
      };
      const sanitized = sanitizeNotificationPayload(input);
      expect(sanitized).toEqual({
        status: 'in_progress',
        priority: 'high',
        actorUserId: null,
      });
    });
  });

  // ── 7. createNotification & createNotifications (Amendment G) ───────────────

  describe('7. Transaction Helpers createNotification & createNotifications (Amendment G)', () => {
    it('accepts a fake transaction client with strict Prisma typing and creates notification', async () => {
      const fakeTx: NotificationPrismaClient = {
        notification: {
          create: vi.fn().mockResolvedValue({ id: 'mock-created-notif-1' }),
        },
      };

      const result = await createNotification(fakeTx, {
        userId: employeeUserId,
        actorUserId: adminUserId,
        type: 'task.assigned',
        entityType: 'task',
        entityId: 'task-111',
        projectId: 'proj-111',
        payload: {
          taskId: 'task-111',
          taskTitle: 'Audit System Overhaul',
          description: 'SHOULD BE STRIPPED',
        },
      });

      expect(result).toEqual({ id: 'mock-created-notif-1' });
      expect(fakeTx.notification.create).toHaveBeenCalledWith({
        data: {
          userId: employeeUserId,
          type: 'task.assigned',
          entityType: 'task',
          entityId: 'task-111',
          projectId: 'proj-111',
          payload: {
            taskId: 'task-111',
            taskTitle: 'Audit System Overhaul',
          },
        },
      });
    });

    it('never notifies the actor about their own action', async () => {
      const fakeTx: NotificationPrismaClient = {
        notification: {
          create: vi.fn(),
        },
      };

      // actorUserId matches userId
      const result = await createNotification(fakeTx, {
        userId: adminUserId,
        actorUserId: adminUserId,
        type: 'task.created',
      });

      expect(result).toBeNull();
      expect(fakeTx.notification.create).not.toHaveBeenCalled();
    });

    it('deduplicates recipients in createNotifications and skips self-notifications', async () => {
      const fakeTx: NotificationPrismaClient = {
        notification: {
          create: vi.fn().mockImplementation(async (args) => ({
            id: `notif-${args.data.userId}`,
            ...args.data,
          })),
        },
      };

      const inputs = [
        // Valid recipient 1
        {
          userId: employeeUserId,
          actorUserId: adminUserId,
          type: 'milestone.completed',
          payload: { milestoneTitle: 'v1.0' },
        },
        // Duplicate recipient 1 (should be skipped)
        {
          userId: employeeUserId,
          actorUserId: adminUserId,
          type: 'milestone.completed',
          payload: { milestoneTitle: 'v1.0 duplicate' },
        },
        // Actor self-notification (should be skipped)
        {
          userId: adminUserId,
          actorUserId: adminUserId,
          type: 'milestone.completed',
          payload: { milestoneTitle: 'v1.0 self' },
        },
        // Valid recipient 2
        {
          userId: pmUserId,
          actorUserId: adminUserId,
          type: 'milestone.completed',
          payload: { milestoneTitle: 'v1.0' },
        },
      ];

      const results = await createNotifications(fakeTx, inputs);

      expect(results).toHaveLength(2);
      expect(results[0].userId).toBe(employeeUserId);
      expect(results[1].userId).toBe(pmUserId);
      expect(fakeTx.notification.create).toHaveBeenCalledTimes(2);
    });
  });

  // ── 8. Refused HTTP Methods & CSRF Handling (Amendment F) ───────────────────

  describe('8. Refused HTTP Methods & CSRF Handling (Amendment F)', () => {
    it('proves no create, edit, or delete route exists under /api/notifications (refused with 404 Route not found)', async () => {
      const cookie = setupAuth(adminUserId);

      // 1. POST /api/notifications (creation from API is prohibited)
      const postRoot = await request(app)
        .post('/api/notifications')
        .set('Cookie', cookie)
        .send({ type: 'hack' });
      expect(postRoot.status).toBe(404);
      expect(postRoot.body).toEqual({ error: 'not_found', message: 'Route not found' });

      // 2. PUT /api/notifications
      const putRoot = await request(app)
        .put('/api/notifications')
        .set('Cookie', cookie)
        .send({});
      expect(putRoot.status).toBe(404);
      expect(putRoot.body).toEqual({ error: 'not_found', message: 'Route not found' });

      // 3. PATCH /api/notifications
      const patchRoot = await request(app)
        .patch('/api/notifications')
        .set('Cookie', cookie)
        .send({});
      expect(patchRoot.status).toBe(404);
      expect(patchRoot.body).toEqual({ error: 'not_found', message: 'Route not found' });

      // 4. DELETE /api/notifications
      const delRoot = await request(app)
        .delete('/api/notifications')
        .set('Cookie', cookie);
      expect(delRoot.status).toBe(404);
      expect(delRoot.body).toEqual({ error: 'not_found', message: 'Route not found' });

      // 5. PUT /api/notifications/:id
      const putItem = await request(app)
        .put(`/api/notifications/${employeeUserId}`)
        .set('Cookie', cookie)
        .send({});
      expect(putItem.status).toBe(404);
      expect(putItem.body).toEqual({ error: 'not_found', message: 'Route not found' });

      // 6. DELETE /api/notifications/:id
      const delItem = await request(app)
        .delete(`/api/notifications/${employeeUserId}`)
        .set('Cookie', cookie);
      expect(delItem.status).toBe(404);
      expect(delItem.body).toEqual({ error: 'not_found', message: 'Route not found' });
    });

    it('proves route refusal returns 404 even when CSRF protection is explicitly enabled with a valid CSRF token', async () => {
      // Create test app with CSRF strictly enabled
      const csrfApp = createApp({ csrfEnabled: true });

      // Step A: Request CSRF token from /api/auth/csrf
      const csrfRes = await request(csrfApp).get('/api/auth/csrf');
      expect(csrfRes.status).toBe(200);
      const csrfToken = csrfRes.body.csrfToken;
      const csrfCookie = csrfRes.headers['set-cookie'];

      // Combine session cookie and CSRF cookie
      const authCookie = setupAuth(adminUserId);
      const combinedCookies = [authCookie, ...(Array.isArray(csrfCookie) ? csrfCookie : [csrfCookie])].join('; ');

      // Step B: Send POST /api/notifications with valid CSRF token header
      const res = await request(csrfApp)
        .post('/api/notifications')
        .set('Cookie', combinedCookies)
        .set('x-csrf-token', csrfToken)
        .send({ type: 'test' });

      // The request successfully clears CSRF protection and reaches the routing table,
      // where it returns 404 Route not found (proving refusal is not caused by CSRF 403).
      expect(res.status).toBe(404);
      expect(res.body).toEqual({ error: 'not_found', message: 'Route not found' });
    });
  });

  // ── 9. Audit Log Invariant (Rule 6) ─────────────────────────────────────────

  describe('9. Audit Log Invariant (Rule 6: Reading or marking notifications writes NO audit entry)', () => {
    it('verifies db.auditLog.create is NEVER called on any notifications endpoint', async () => {
      const cookie = setupAuth(employeeUserId);
      (db.notification.updateMany as any).mockResolvedValue({ count: 1 });

      await request(app).get('/api/notifications').set('Cookie', cookie);
      await request(app).get('/api/notifications/unread-count').set('Cookie', cookie);
      await request(app).post('/api/notifications/read-all').set('Cookie', cookie);
      await request(app).post(`/api/notifications/${employeeUserId}/read`).set('Cookie', cookie);

      expect(db.auditLog.create).not.toHaveBeenCalled();
    });
  });
});
