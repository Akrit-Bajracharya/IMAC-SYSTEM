/**
 * Mock-Based Unit & Integration Tests for SSE Notification Stream (Step 18a).
 *
 * NOTE: These tests run against an in-memory mocked database (mockDb in setup.ts),
 * fake Express response EventEmitters, and Vitest fake timers.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { EventEmitter } from 'events';
import request from 'supertest';
import { createApp } from '../app.js';
import { db } from '../db.js';
import {
  registerNotificationStream,
  publishToUser,
  publishAfterCommit,
  closeAllNotificationStreams,
  getTotalStreamCount,
  getUserStreamCount,
  MAX_STREAMS_PER_USER,
  MAX_TOTAL_STREAMS,
  PING_INTERVAL_MS,
  SESSION_RECHECK_INTERVAL_MS,
  type StreamResponse,
} from '../services/notificationStream.js';

function createFakeStreamRes(): StreamResponse & EventEmitter & { chunks: string[]; ended: boolean } {
  const emitter = new EventEmitter() as StreamResponse &
    EventEmitter & { chunks: string[]; ended: boolean };
  emitter.chunks = [];
  emitter.ended = false;
  emitter.write = vi.fn((chunk: string) => {
    emitter.chunks.push(chunk);
    return true;
  });
  emitter.end = vi.fn(() => {
    emitter.ended = true;
  });
  return emitter;
}

describe('Step 18a: Live Notification Delivery (SSE) Tests (Mock-Based)', () => {
  const app = createApp({ csrfDisabled: true });

  const adminId = '11111111-1111-4111-8111-111111111111';
  const hrId = '22222222-2222-4222-8222-222222222222';
  const pmId = '33333333-3333-4333-8333-333333333333';
  const devId = '44444444-4444-4444-8444-444444444444';
  const viewerId = '55555555-5555-4555-8555-555555555555';
  const projectId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const taskId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

  const mockUsers: Record<string, any> = {
    [adminId]: { id: adminId, username: 'boss', displayName: 'Admin', systemRole: 'system_admin', isActive: true, mustChangePassword: false },
    [hrId]: { id: hrId, username: 'hr', displayName: 'HR', systemRole: 'hr_admin', isActive: true, mustChangePassword: false },
    [pmId]: { id: pmId, username: 'pm', displayName: 'PM', systemRole: 'project_manager', isActive: true, mustChangePassword: false },
    [devId]: { id: devId, username: 'dev', displayName: 'Dev', systemRole: 'employee', isActive: true, mustChangePassword: false },
    [viewerId]: { id: viewerId, username: 'viewer', displayName: 'Viewer', systemRole: 'viewer', isActive: true, mustChangePassword: false },
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
    closeAllNotificationStreams();
    (db.notification.count as any).mockResolvedValue(3);
    (db.auditLog.create as any).mockResolvedValue({});
    (db.project.findUnique as any).mockResolvedValue({
      id: projectId,
      name: 'IMAC Core Project',
      status: 'on_track',
    });
  });

  afterEach(() => {
    closeAllNotificationStreams();
    vi.useRealTimers();
  });

  // ── 1. HTTP Endpoint Authentication, Roles, Headers, 503 ────────────────────

  describe('1. GET /api/notifications/stream HTTP Guard & Headers', () => {
    it('returns 401 unauthenticated without session', async () => {
      const res = await request(app).get('/api/notifications/stream');
      expect(res.status).toBe(401);
      expect(res.body.error).toBe('unauthenticated');
    });

    it.each([
      ['system_admin', adminId],
      ['hr_admin', hrId],
      ['project_manager', pmId],
      ['employee', devId],
      ['viewer', viewerId],
    ])('works for %s and sets exact SSE headers without compression', async (_role, userId) => {
      const cookie = setupAuth(userId);
      (db.notification.count as any).mockResolvedValueOnce(4);

      let receivedData = '';
      const res = await request(app)
        .get('/api/notifications/stream')
        .set('Cookie', cookie)
        .buffer(false)
        .parse((streamRes, callback) => {
          streamRes.on('data', (chunk: Buffer) => {
            receivedData += chunk.toString('utf8');
            if (receivedData.includes('event: unread')) {
              (streamRes as any).destroy();
              callback(null, receivedData);
            }
          });
        });

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('text/event-stream');
      expect(res.headers['cache-control']).toBe('no-cache, no-transform');
      expect(res.headers['connection']).toBe('keep-alive');
      expect(res.headers['x-accel-buffering']).toBe('no');
      expect(receivedData).toContain('event: unread\ndata: {"unreadCount":4}\n\n');
    });

    it('Amendment F: returns 503 as normal JSON BEFORE any SSE headers when at 500 total streams', async () => {
      const cookie = setupAuth(devId);

      // Fill registry to 500 streams across 100 synthetic users
      for (let i = 0; i < MAX_TOTAL_STREAMS; i++) {
        const uid = `user-${Math.floor(i / MAX_STREAMS_PER_USER)}`;
        const fakeRes = createFakeStreamRes();
        const entry = registerNotificationStream(uid, `sess-${i}`, fakeRes);
        expect(entry).not.toBeNull();
      }
      expect(getTotalStreamCount()).toBe(500);

      const res = await request(app)
        .get('/api/notifications/stream')
        .set('Cookie', cookie);

      expect(res.status).toBe(503);
      expect(res.headers['content-type']).toContain('application/json');
      expect(res.headers['content-type']).not.toContain('text/event-stream');
      expect(res.body).toEqual({
        error: 'service_unavailable',
        message: 'Too many active notification streams',
      });
    });
  });

  // ── 2. Registry Isolation, Eviction, Timers, Close/Error ────────────────────

  describe('2. In-Memory Stream Registry, Caps, Timers & Isolation', () => {
    it('isolates events so User A never receives User B events and strips any extra fields', () => {
      const resA = createFakeStreamRes();
      const resB = createFakeStreamRes();
      registerNotificationStream('user-a', 'sess-a', resA);
      registerNotificationStream('user-b', 'sess-b', resB);

      publishToUser('user-b', {
        unreadCount: 2,
        notificationId: 'notif-1',
        // @ts-expect-error testing runtime stripping of forbidden text fields
        title: 'Secret title',
        body: 'Secret body',
      });

      expect(resA.chunks).toEqual([]);
      expect(resB.chunks).toEqual([
        'event: unread\ndata: {"unreadCount":2,"notificationId":"notif-1"}\n\n',
      ]);
      expect(resB.chunks[0]).not.toContain('Secret');
    });

    it('Amendment D: 6th stream evicts oldest, closes it, and leaves no lingering timers', () => {
      vi.useFakeTimers();

      const responses = Array.from({ length: 6 }, () => createFakeStreamRes());
      for (let i = 0; i < 5; i++) {
        registerNotificationStream('user-1', 'sess-1', responses[i]!);
      }
      expect(getUserStreamCount('user-1')).toBe(5);
      // 5 streams * 2 timers (ping + session) = 10 timers
      expect(vi.getTimerCount()).toBe(10);

      // Register 6th stream -> evicts responses[0] and clears its 2 timers
      registerNotificationStream('user-1', 'sess-1', responses[5]!);
      expect(getUserStreamCount('user-1')).toBe(5);
      expect(responses[0]!.ended).toBe(true);
      expect(vi.getTimerCount()).toBe(10);

      // Advance 25s -> evicted response[0] receives NO ping; remaining 5 do
      vi.advanceTimersByTime(PING_INTERVAL_MS);
      expect(responses[0]!.chunks).toEqual([]);
      for (let i = 1; i < 6; i++) {
        expect(responses[i]!.chunks).toContain(': ping\n\n');
      }
    });

    it('Amendment E: close and error handlers remove entry and clear both timers', () => {
      vi.useFakeTimers();

      const resClose = createFakeStreamRes();
      const resError = createFakeStreamRes();
      registerNotificationStream('user-close', 'sess-c', resClose);
      registerNotificationStream('user-error', 'sess-e', resError);

      expect(getTotalStreamCount()).toBe(2);
      expect(vi.getTimerCount()).toBe(4);

      resClose.emit('close');
      expect(getTotalStreamCount()).toBe(1);
      expect(getUserStreamCount('user-close')).toBe(0);
      expect(vi.getTimerCount()).toBe(2);

      resError.emit('error', new Error('socket reset'));
      expect(getTotalStreamCount()).toBe(0);
      expect(getUserStreamCount('user-error')).toBe(0);
      expect(vi.getTimerCount()).toBe(0);
    });
  });

  // ── 3. Session Safety Re-check (Amendment A) ────────────────────────────────

  describe('3. 60-Second Read-Only Session Safety Re-check (Amendment A)', () => {
    it('closes stream on logout (session null), expiry, deactivation, or mustChangePassword without calling session.update', async () => {
      vi.useFakeTimers();

      const rLogout = createFakeStreamRes();
      const rExpired = createFakeStreamRes();
      const rInactive = createFakeStreamRes();
      const rPwd = createFakeStreamRes();
      const rValid = createFakeStreamRes();

      registerNotificationStream('u-logout', 's-logout', rLogout);
      registerNotificationStream('u-expired', 's-expired', rExpired);
      registerNotificationStream('u-inactive', 's-inactive', rInactive);
      registerNotificationStream('u-pwd', 's-pwd', rPwd);
      registerNotificationStream('u-valid', 's-valid', rValid);

      (db.session.findUnique as any).mockImplementation(async (args: any) => {
        const id = args?.where?.id;
        if (id === 's-logout') return null;
        if (id === 's-expired') {
          return {
            id,
            expiresAt: new Date(Date.now() - 1000),
            user: { isActive: true, mustChangePassword: false },
          };
        }
        if (id === 's-inactive') {
          return {
            id,
            expiresAt: new Date(Date.now() + 60_000),
            user: { isActive: false, mustChangePassword: false },
          };
        }
        if (id === 's-pwd') {
          return {
            id,
            expiresAt: new Date(Date.now() + 60_000),
            user: { isActive: true, mustChangePassword: true },
          };
        }
        return {
          id,
          expiresAt: new Date(Date.now() + 60_000),
          user: { isActive: true, mustChangePassword: false },
        };
      });

      await vi.advanceTimersByTimeAsync(SESSION_RECHECK_INTERVAL_MS);

      expect(rLogout.ended).toBe(true);
      expect(rExpired.ended).toBe(true);
      expect(rInactive.ended).toBe(true);
      expect(rPwd.ended).toBe(true);
      expect(rValid.ended).toBe(false);
      expect(getTotalStreamCount()).toBe(1);

      // Amendment A: must never refresh lastActiveAt / expiresAt
      expect(db.session.update).not.toHaveBeenCalled();
    });
  });

  // ── 4. Publish After Commit, Rollback & Error Safety (Amendments B & C) ─────

  describe('4. Publish After Commit, Rollback & Error Isolation', () => {
    it('publishes ONLY after $transaction commits and never inside tx', async () => {
      const cookie = setupAuth(pmId);
      const streamRes = createFakeStreamRes();
      registerNotificationStream(devId, 'sess-dev', streamRes);

      (db.projectMember.findUnique as any).mockImplementation(async (args: any) => {
        const uid = args?.where?.projectId_userId?.userId;
        if (uid === pmId) return { projectId, userId: pmId, projectRole: 'manager', user: mockUsers[pmId] };
        if (uid === devId) return { projectId, userId: devId, projectRole: 'member', user: mockUsers[devId] };
        return null;
      });
      (db.task.create as any).mockResolvedValue({
        id: taskId,
        projectId,
        title: 'Live SSE task',
        status: 'todo',
        assigneeUserId: devId,
        createdByUserId: pmId,
      });
      (db.notification.create as any).mockImplementation(async (args: any) => {
        // While inside tx (before $transaction resolves), nothing has been published yet
        expect(streamRes.chunks).toEqual([]);
        return { id: 'notif-live-1', ...args.data };
      });
      (db.notification.count as any).mockResolvedValue(5);

      const res = await request(app)
        .post(`/api/projects/${projectId}/tasks`)
        .set('Cookie', cookie)
        .send({ title: 'Live SSE task', assigneeUserId: devId });

      expect(res.status).toBe(201);
      expect(streamRes.chunks).toEqual([
        'event: unread\ndata: {"unreadCount":5,"notificationId":"notif-live-1"}\n\n',
      ]);
    });

    it('publishes nothing when $transaction rolls back', async () => {
      const cookie = setupAuth(pmId);
      const streamRes = createFakeStreamRes();
      registerNotificationStream(devId, 'sess-dev', streamRes);

      (db.projectMember.findUnique as any).mockImplementation(async (args: any) => {
        const uid = args?.where?.projectId_userId?.userId;
        if (uid === pmId) return { projectId, userId: pmId, projectRole: 'manager', user: mockUsers[pmId] };
        if (uid === devId) return { projectId, userId: devId, projectRole: 'member', user: mockUsers[devId] };
        return null;
      });
      (db.task.create as any).mockResolvedValue({
        id: taskId,
        projectId,
        title: 'Rollback SSE task',
        status: 'todo',
        assigneeUserId: devId,
        createdByUserId: pmId,
      });
      (db.notification.create as any).mockRejectedValueOnce(new Error('TX rollback'));

      const res = await request(app)
        .post(`/api/projects/${projectId}/tasks`)
        .set('Cookie', cookie)
        .send({ title: 'Rollback SSE task', assigneeUserId: devId });

      expect(res.status).toBe(500);
      expect(streamRes.chunks).toEqual([]);
    });

    it('Amendment C: throwing notification.count in publishAfterCommit never fails or alters HTTP response', async () => {
      const cookie = setupAuth(pmId);
      const streamRes = createFakeStreamRes();
      registerNotificationStream(devId, 'sess-dev', streamRes);

      (db.projectMember.findUnique as any).mockImplementation(async (args: any) => {
        const uid = args?.where?.projectId_userId?.userId;
        if (uid === pmId) return { projectId, userId: pmId, projectRole: 'manager', user: mockUsers[pmId] };
        if (uid === devId) return { projectId, userId: devId, projectRole: 'member', user: mockUsers[devId] };
        return null;
      });
      (db.task.create as any).mockResolvedValue({
        id: taskId,
        projectId,
        title: 'Count throws task',
        status: 'todo',
        assigneeUserId: devId,
        createdByUserId: pmId,
      });
      (db.notification.create as any).mockResolvedValue({ id: 'notif-live-2' });
      (db.notification.count as any).mockRejectedValueOnce(new Error('Count DB failure'));

      const res = await request(app)
        .post(`/api/projects/${projectId}/tasks`)
        .set('Cookie', cookie)
        .send({ title: 'Count throws task', assigneeUserId: devId });

      expect(res.status).toBe(201);
      expect(res.body.id).toBe(taskId);
      expect(streamRes.chunks).toEqual([]);

      // Also verify direct publishAfterCommit catches rejections cleanly
      await expect(
        publishAfterCommit([{ userId: devId, notificationId: 'notif-live-2' }])
      ).resolves.toBeUndefined();
    });
  });
});
