/**
 * Mock-Based Integration & Constants Synchronization Tests for Step 17c Notification Triggers.
 *
 * NOTE: These tests run against an in-memory mocked database (mockDb in setup.ts).
 * They verify notification recipient selection, payload privacy, actor exclusion,
 * deduplication, transaction rollback behavior when notification writes fail,
 * and synchronization between API and Web notification type constants.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import fs from 'fs';
import path from 'path';
import { createApp } from '../app.js';
import { db } from '../db.js';
import {
  ALL_NOTIFICATION_TYPES,
  NOTIFICATION_TYPES,
} from '../constants/notificationTypes.js';

describe('Step 17c: Notification Triggers & Constants Sync (Mock-Based)', () => {
  const app = createApp({ csrfDisabled: true });

  const adminId = '11111111-1111-4111-8111-111111111111';
  const pmId = '22222222-2222-4222-8222-222222222222';
  const dev1Id = '33333333-3333-4333-8333-333333333333';
  const dev2Id = '44444444-4444-4444-8444-444444444444';
  const projectId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const taskId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  const messageId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';

  const mockUsers: Record<string, any> = {
    [adminId]: {
      id: adminId,
      username: 'boss',
      displayName: 'System Admin',
      systemRole: 'system_admin',
      isActive: true,
      mustChangePassword: false,
    },
    [pmId]: {
      id: pmId,
      username: 'demo_pm',
      displayName: 'Project Manager',
      systemRole: 'project_manager',
      isActive: true,
      mustChangePassword: false,
    },
    [dev1Id]: {
      id: dev1Id,
      username: 'demo_dev1',
      displayName: 'Developer 1',
      systemRole: 'employee',
      isActive: true,
      mustChangePassword: false,
    },
    [dev2Id]: {
      id: dev2Id,
      username: 'demo_dev2',
      displayName: 'Developer 2',
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
    (db.notification.create as any).mockImplementation(async (args: any) => ({
      id: 'notif-mock-id',
      ...args.data,
    }));
    (db.project.findUnique as any).mockResolvedValue({
      id: projectId,
      name: 'IMAC Core Project',
      status: 'on_track',
    });
    (db.projectMember.findUnique as any).mockImplementation(async (args: any) => {
      const uid = args?.where?.projectId_userId?.userId;
      if (uid === pmId) {
        return { projectId, userId: pmId, projectRole: 'manager', user: mockUsers[pmId] };
      }
      if (uid === dev1Id) {
        return { projectId, userId: dev1Id, projectRole: 'member', user: mockUsers[dev1Id] };
      }
      if (uid === dev2Id) {
        return { projectId, userId: dev2Id, projectRole: 'member', user: mockUsers[dev2Id] };
      }
      return null;
    });
    (db.projectMember.findMany as any).mockResolvedValue([]);
    (db.$queryRaw as any).mockResolvedValue([{ id: projectId }]);
    (db.$transaction as any).mockImplementation(async (cb: any) => cb(db));
  });

  // ── 0. Constants Synchronization & Route Usage Check ────────────────────────

  describe('0. Notification Type Constants Synchronization (API <-> Web)', () => {
    function extractObjectValues(source: string, constName: string): string[] {
      const regex = new RegExp(
        `export\\s+const\\s+${constName}\\s*=\\s*\\{([\\s\\S]*?)\\}\\s*as\\s+const`,
        'm'
      );
      const match = source.match(regex);
      if (!match) return [];
      const body = match[1]!;
      const values: string[] = [];
      for (const line of body.split('\n')) {
        const m = line.match(/:\s*['"]([^'"]+)['"]/);
        if (m) values.push(m[1]!);
      }
      return values;
    }

    it('matches apps/web/src/constants/notificationTypes.ts bidirectionally and fails if missing', () => {
      const webPath = path.resolve(
        __dirname,
        '../../../web/src/constants/notificationTypes.ts'
      );
      expect(fs.existsSync(webPath)).toBe(true);

      const webSource = fs.readFileSync(webPath, 'utf-8');
      const webTypes = extractObjectValues(webSource, 'NOTIFICATION_TYPES');

      // Fail if array/object cannot be found or parses to zero items
      expect(webTypes.length).toBeGreaterThan(0);
      expect(ALL_NOTIFICATION_TYPES.length).toBeGreaterThan(0);

      // Bidirectional check
      expect(ALL_NOTIFICATION_TYPES.length).toBe(webTypes.length);
      for (const t of ALL_NOTIFICATION_TYPES) {
        expect(webTypes).toContain(t);
      }
      for (const wt of webTypes) {
        expect(ALL_NOTIFICATION_TYPES).toContain(wt);
      }
    });

    it('verifies every NOTIFICATION_TYPES.<KEY> used in routes exists in ALL_NOTIFICATION_TYPES', () => {
      const routeFiles = [
        path.resolve(__dirname, '../routes/tasks.ts'),
        path.resolve(__dirname, '../routes/messages.ts'),
        path.resolve(__dirname, '../routes/projects.ts'),
      ];

      const usedKeys = new Set<string>();
      const regex = /NOTIFICATION_TYPES\.([A-Z0-9_]+)/g;
      for (const file of routeFiles) {
        const content = fs.readFileSync(file, 'utf-8');
        let m: RegExpExecArray | null;
        while ((m = regex.exec(content)) !== null) {
          usedKeys.add(m[1]!);
        }
      }

      expect(usedKeys.size).toBeGreaterThan(0);
      for (const key of usedKeys) {
        const val = (NOTIFICATION_TYPES as Record<string, string>)[key];
        expect(val, `Missing NOTIFICATION_TYPES.${key}`).toBeDefined();
        expect(ALL_NOTIFICATION_TYPES).toContain(val);
      }
    });
  });

  // ── 1. Trigger 1: POST /api/projects/:id/tasks ──────────────────────────────

  describe('1. Trigger 1: POST /api/projects/:id/tasks (task.assigned)', () => {
    it('notifies assignee inside tx when assigneeUserId is set and differs from actor', async () => {
      const cookie = setupAuth(pmId);
      (db.task.create as any).mockResolvedValue({
        id: taskId,
        projectId,
        title: 'Build notification bell',
        description: 'Secret description text',
        status: 'todo',
        assigneeUserId: dev1Id,
        createdByUserId: pmId,
      });

      const res = await request(app)
        .post(`/api/projects/${projectId}/tasks`)
        .set('Cookie', cookie)
        .send({
          title: 'Build notification bell',
          description: 'Secret description text',
          assigneeUserId: dev1Id,
        });

      expect(res.status).toBe(201);
      expect(db.notification.create).toHaveBeenCalledTimes(1);
      const callArg = (db.notification.create as any).mock.calls[0][0].data;
      expect(callArg).toEqual({
        userId: dev1Id,
        type: 'task.assigned',
        entityType: 'task',
        entityId: taskId,
        projectId,
        payload: {
          taskId,
          taskTitle: 'Build notification bell',
          projectId,
          actorUserId: pmId,
        },
      });
      expect(callArg.payload).not.toHaveProperty('description');
      expect(callArg.payload).not.toHaveProperty('body');
    });

    it('does NOT notify actor when actor assigns task to themselves', async () => {
      const cookie = setupAuth(pmId);
      (db.task.create as any).mockResolvedValue({
        id: taskId,
        projectId,
        title: 'Self assigned task',
        status: 'todo',
        assigneeUserId: pmId,
        createdByUserId: pmId,
      });

      const res = await request(app)
        .post(`/api/projects/${projectId}/tasks`)
        .set('Cookie', cookie)
        .send({
          title: 'Self assigned task',
          assigneeUserId: pmId,
        });

      expect(res.status).toBe(201);
      expect(db.notification.create).not.toHaveBeenCalled();
    });

    it('does NOT notify when assigneeUserId is null or omitted', async () => {
      const cookie = setupAuth(pmId);
      (db.task.create as any).mockResolvedValue({
        id: taskId,
        projectId,
        title: 'Unassigned task',
        status: 'todo',
        assigneeUserId: null,
        createdByUserId: pmId,
      });

      const res = await request(app)
        .post(`/api/projects/${projectId}/tasks`)
        .set('Cookie', cookie)
        .send({ title: 'Unassigned task' });

      expect(res.status).toBe(201);
      expect(db.notification.create).not.toHaveBeenCalled();
    });

    it('rolls back transaction if notification creation fails', async () => {
      const cookie = setupAuth(pmId);
      (db.task.create as any).mockResolvedValue({
        id: taskId,
        projectId,
        title: 'Rollback task',
        status: 'todo',
        assigneeUserId: dev1Id,
        createdByUserId: pmId,
      });
      (db.notification.create as any).mockRejectedValueOnce(new Error('DB write error'));

      const res = await request(app)
        .post(`/api/projects/${projectId}/tasks`)
        .set('Cookie', cookie)
        .send({ title: 'Rollback task', assigneeUserId: dev1Id });

      expect(res.status).toBe(500);
    });
  });

  // ── 2. Trigger 2: PATCH /api/projects/:id/tasks/:taskId ─────────────────────

  describe('2. Trigger 2: PATCH /api/projects/:id/tasks/:taskId (task.assigned)', () => {
    it('notifies ONLY the new assignee when assigneeUserId changes to a different non-null user', async () => {
      const cookie = setupAuth(pmId);
      (db.task.findUnique as any).mockResolvedValue({
        id: taskId,
        projectId,
        title: 'Existing task',
        status: 'todo',
        assigneeUserId: dev1Id,
        createdByUserId: pmId,
        milestoneId: null,
      });
      (db.task.update as any).mockResolvedValue({
        id: taskId,
        projectId,
        title: 'Existing task',
        status: 'todo',
        assigneeUserId: dev2Id,
        createdByUserId: pmId,
        milestoneId: null,
      });

      const res = await request(app)
        .patch(`/api/projects/${projectId}/tasks/${taskId}`)
        .set('Cookie', cookie)
        .send({ assigneeUserId: dev2Id });

      expect(res.status).toBe(200);
      expect(db.notification.create).toHaveBeenCalledTimes(1);
      const callArg = (db.notification.create as any).mock.calls[0][0].data;
      expect(callArg.userId).toBe(dev2Id);
      expect(callArg.type).toBe('task.assigned');
      expect(callArg.payload).not.toHaveProperty('description');
      expect(callArg.payload).not.toHaveProperty('body');
    });

    it('does NOT notify when assigneeUserId is unchanged, absent, or cleared to null', async () => {
      const cookie = setupAuth(pmId);
      (db.task.findUnique as any).mockResolvedValue({
        id: taskId,
        projectId,
        title: 'Existing task',
        status: 'todo',
        assigneeUserId: dev1Id,
        createdByUserId: pmId,
        milestoneId: null,
      });

      // Unchanged
      (db.task.update as any).mockResolvedValue({
        id: taskId,
        projectId,
        title: 'Existing task',
        status: 'todo',
        assigneeUserId: dev1Id,
        createdByUserId: pmId,
      });
      const r1 = await request(app)
        .patch(`/api/projects/${projectId}/tasks/${taskId}`)
        .set('Cookie', cookie)
        .send({ assigneeUserId: dev1Id });
      expect(r1.status).toBe(200);

      // Absent
      const r2 = await request(app)
        .patch(`/api/projects/${projectId}/tasks/${taskId}`)
        .set('Cookie', cookie)
        .send({ title: 'Renamed task' });
      expect(r2.status).toBe(200);

      // Cleared to null
      (db.task.update as any).mockResolvedValue({
        id: taskId,
        projectId,
        title: 'Existing task',
        status: 'todo',
        assigneeUserId: null,
        createdByUserId: pmId,
      });
      const r3 = await request(app)
        .patch(`/api/projects/${projectId}/tasks/${taskId}`)
        .set('Cookie', cookie)
        .send({ assigneeUserId: null });
      expect(r3.status).toBe(200);

      expect(db.notification.create).not.toHaveBeenCalled();
    });

    it('rolls back transaction if notification creation fails on PATCH', async () => {
      const cookie = setupAuth(pmId);
      (db.task.findUnique as any).mockResolvedValue({
        id: taskId,
        projectId,
        title: 'Existing task',
        status: 'todo',
        assigneeUserId: dev1Id,
        createdByUserId: pmId,
        milestoneId: null,
      });
      (db.task.update as any).mockResolvedValue({
        id: taskId,
        projectId,
        title: 'Existing task',
        status: 'todo',
        assigneeUserId: dev2Id,
        createdByUserId: pmId,
      });
      (db.notification.create as any).mockRejectedValueOnce(new Error('DB write error'));

      const res = await request(app)
        .patch(`/api/projects/${projectId}/tasks/${taskId}`)
        .set('Cookie', cookie)
        .send({ assigneeUserId: dev2Id });

      expect(res.status).toBe(500);
    });
  });

  // ── 3. Trigger 3: POST /api/projects/:id/tasks/:taskId/status ───────────────

  describe('3. Trigger 3: POST /api/projects/:id/tasks/:taskId/status (task.status_changed)', () => {
    it('notifies active assignee and creator (deduplicated, actor excluded, departed excluded)', async () => {
      const cookie = setupAuth(pmId);
      (db.task.findUnique as any).mockResolvedValue({
        id: taskId,
        projectId,
        title: 'Status task',
        status: 'todo',
        assigneeUserId: dev1Id,
        createdByUserId: dev2Id,
      });
      (db.task.updateMany as any).mockResolvedValue({ count: 1 });
      (db.projectMember.findMany as any).mockResolvedValue([
        { userId: dev1Id },
        { userId: dev2Id },
      ]);

      const res = await request(app)
        .post(`/api/projects/${projectId}/tasks/${taskId}/status`)
        .set('Cookie', cookie)
        .send({ status: 'in_progress' });

      expect(res.status).toBe(200);
      expect(db.notification.create).toHaveBeenCalledTimes(2);

      const notifiedUsers = (db.notification.create as any).mock.calls.map(
        (c: any) => c[0].data.userId
      );
      expect(notifiedUsers).toEqual([dev1Id, dev2Id]);

      const payload = (db.notification.create as any).mock.calls[0][0].data.payload;
      expect(payload).toEqual({
        taskId,
        taskTitle: 'Status task',
        projectId,
        fromStatus: 'todo',
        toStatus: 'in_progress',
        actorUserId: pmId,
      });
      expect(payload).not.toHaveProperty('description');
      expect(payload).not.toHaveProperty('body');
    });

    it('excludes actor and departed/inactive users (via projectMember filter)', async () => {
      const cookie = setupAuth(dev1Id);
      (db.task.findUnique as any).mockResolvedValue({
        id: taskId,
        projectId,
        title: 'Status task',
        status: 'todo',
        assigneeUserId: dev1Id, // actor!
        createdByUserId: dev2Id, // departed (not in findMany result)
      });
      (db.task.updateMany as any).mockResolvedValue({ count: 1 });
      // Only dev1Id is returned as active member; dev2Id has left/is inactive
      (db.projectMember.findMany as any).mockResolvedValue([{ userId: dev1Id }]);

      const res = await request(app)
        .post(`/api/projects/${projectId}/tasks/${taskId}/status`)
        .set('Cookie', cookie)
        .send({ status: 'in_progress' });

      expect(res.status).toBe(200);
      expect(db.notification.create).not.toHaveBeenCalled();
    });

    it('Amendment B: creates NO notification on 409 conflict (updateMany count 0)', async () => {
      const cookie = setupAuth(pmId);
      (db.task.findUnique as any).mockResolvedValue({
        id: taskId,
        projectId,
        title: 'Conflict task',
        status: 'todo',
        assigneeUserId: dev1Id,
        createdByUserId: dev2Id,
      });
      (db.task.updateMany as any).mockResolvedValue({ count: 0 });

      const res = await request(app)
        .post(`/api/projects/${projectId}/tasks/${taskId}/status`)
        .set('Cookie', cookie)
        .send({ status: 'in_progress' });

      expect(res.status).toBe(409);
      expect(db.projectMember.findMany).not.toHaveBeenCalled();
      expect(db.notification.create).not.toHaveBeenCalled();
    });

    it('Amendment A: rolls back transaction if projectMember.findMany or notification.create fails', async () => {
      const cookie = setupAuth(pmId);
      (db.task.findUnique as any).mockResolvedValue({
        id: taskId,
        projectId,
        title: 'Rollback status task',
        status: 'todo',
        assigneeUserId: dev1Id,
        createdByUserId: pmId,
      });
      (db.task.updateMany as any).mockResolvedValue({ count: 1 });
      (db.projectMember.findMany as any).mockRejectedValueOnce(new Error('DB failure'));

      const res = await request(app)
        .post(`/api/projects/${projectId}/tasks/${taskId}/status`)
        .set('Cookie', cookie)
        .send({ status: 'in_progress' });

      expect(res.status).toBe(500);
    });
  });

  // ── 4. Trigger 4: POST /api/projects/:id/messages/:messageId/to-task ────────

  describe('4. Trigger 4: POST /api/projects/:id/messages/:messageId/to-task (message.converted_to_task)', () => {
    it('notifies active message author when different from actor and strips message body', async () => {
      const cookie = setupAuth(pmId);
      (db.projectMessage.findFirst as any).mockResolvedValue({
        id: messageId,
        projectId,
        authorUserId: dev1Id,
        body: 'Deploy the hotfix\nDetailed confidential message body here',
      });
      (db.auditLog.findFirst as any).mockResolvedValue(null);
      (db.task.create as any).mockResolvedValue({
        id: taskId,
        projectId,
        title: 'Deploy the hotfix',
        status: 'todo',
        createdByUserId: pmId,
      });
      (db.projectMember.findMany as any).mockResolvedValue([{ userId: dev1Id }]);

      const res = await request(app)
        .post(`/api/projects/${projectId}/messages/${messageId}/to-task`)
        .set('Cookie', cookie)
        .send();

      expect(res.status).toBe(201);
      expect(db.notification.create).toHaveBeenCalledTimes(1);
      const callArg = (db.notification.create as any).mock.calls[0][0].data;
      expect(callArg).toEqual({
        userId: dev1Id,
        type: 'message.converted_to_task',
        entityType: 'task',
        entityId: taskId,
        projectId,
        payload: {
          taskId,
          taskTitle: 'Deploy the hotfix',
          projectId,
          actorUserId: pmId,
        },
      });
      expect(callArg.payload).not.toHaveProperty('body');
      expect(callArg.payload).not.toHaveProperty('description');
    });

    it('does NOT notify actor when actor converts their own message', async () => {
      const cookie = setupAuth(pmId);
      (db.projectMessage.findFirst as any).mockResolvedValue({
        id: messageId,
        projectId,
        authorUserId: pmId,
        body: 'Self message',
      });
      (db.auditLog.findFirst as any).mockResolvedValue(null);
      (db.task.create as any).mockResolvedValue({
        id: taskId,
        projectId,
        title: 'Self message',
        status: 'todo',
        createdByUserId: pmId,
      });
      (db.projectMember.findMany as any).mockResolvedValue([{ userId: pmId }]);

      const res = await request(app)
        .post(`/api/projects/${projectId}/messages/${messageId}/to-task`)
        .set('Cookie', cookie)
        .send();

      expect(res.status).toBe(201);
      expect(db.notification.create).not.toHaveBeenCalled();
    });

    it('Amendment D: does NOT notify if message author is no longer an active project member', async () => {
      const cookie = setupAuth(pmId);
      (db.projectMessage.findFirst as any).mockResolvedValue({
        id: messageId,
        projectId,
        authorUserId: dev1Id,
        body: 'Old message from departed member',
      });
      (db.auditLog.findFirst as any).mockResolvedValue(null);
      (db.task.create as any).mockResolvedValue({
        id: taskId,
        projectId,
        title: 'Old message from departed member',
        status: 'todo',
        createdByUserId: pmId,
      });
      // Departed author -> findMany returns empty
      (db.projectMember.findMany as any).mockResolvedValue([]);

      const res = await request(app)
        .post(`/api/projects/${projectId}/messages/${messageId}/to-task`)
        .set('Cookie', cookie)
        .send();

      expect(res.status).toBe(201);
      expect(db.notification.create).not.toHaveBeenCalled();
    });

    it('rolls back transaction if notification creation fails on to-task', async () => {
      const cookie = setupAuth(pmId);
      (db.projectMessage.findFirst as any).mockResolvedValue({
        id: messageId,
        projectId,
        authorUserId: dev1Id,
        body: 'Fail on notify',
      });
      (db.auditLog.findFirst as any).mockResolvedValue(null);
      (db.task.create as any).mockResolvedValue({
        id: taskId,
        projectId,
        title: 'Fail on notify',
        status: 'todo',
        createdByUserId: pmId,
      });
      (db.projectMember.findMany as any).mockResolvedValue([{ userId: dev1Id }]);
      (db.notification.create as any).mockRejectedValueOnce(new Error('DB write error'));

      const res = await request(app)
        .post(`/api/projects/${projectId}/messages/${messageId}/to-task`)
        .set('Cookie', cookie)
        .send();

      expect(res.status).toBe(500);
    });
  });

  // ── 5. Trigger 5: POST /api/projects/:id/members ────────────────────────────

  describe('5. Trigger 5: POST /api/projects/:id/members (project.member_added)', () => {
    it('notifies added active user with projectId and projectName', async () => {
      const cookie = setupAuth(pmId);
      (db.user.findUnique as any).mockResolvedValue(mockUsers[dev2Id]);
      // Ensure caller is manager, target dev2Id is NOT yet a member
      (db.projectMember.findUnique as any).mockImplementation(async (args: any) => {
        const uid = args?.where?.projectId_userId?.userId;
        if (uid === pmId) {
          return { projectId, userId: pmId, projectRole: 'manager' };
        }
        return null;
      });
      (db.projectMember.create as any).mockResolvedValue({
        id: 'pm-row-1',
        projectId,
        userId: dev2Id,
        projectRole: 'member',
        user: mockUsers[dev2Id],
      });

      const res = await request(app)
        .post(`/api/projects/${projectId}/members`)
        .set('Cookie', cookie)
        .send({ userId: dev2Id, projectRole: 'member' });

      expect(res.status).toBe(201);
      expect(db.notification.create).toHaveBeenCalledTimes(1);
      const callArg = (db.notification.create as any).mock.calls[0][0].data;
      expect(callArg).toEqual({
        userId: dev2Id,
        type: 'project.member_added',
        entityType: 'project',
        entityId: projectId,
        projectId,
        payload: {
          projectId,
          projectName: 'IMAC Core Project',
          actorUserId: pmId,
        },
      });
      expect(callArg.payload).not.toHaveProperty('body');
      expect(callArg.payload).not.toHaveProperty('description');
    });

    it('Amendment C: does NOT notify when system_admin adds themselves to a project', async () => {
      const cookie = setupAuth(adminId);
      (db.user.findUnique as any).mockResolvedValue(mockUsers[adminId]);
      (db.projectMember.findUnique as any).mockResolvedValue(null);
      (db.projectMember.create as any).mockResolvedValue({
        id: 'pm-row-admin',
        projectId,
        userId: adminId,
        projectRole: 'manager',
        user: mockUsers[adminId],
      });

      const res = await request(app)
        .post(`/api/projects/${projectId}/members`)
        .set('Cookie', cookie)
        .send({ userId: adminId, projectRole: 'manager' });

      expect(res.status).toBe(201);
      expect(db.notification.create).not.toHaveBeenCalled();
    });

    it('rolls back transaction if notification creation fails when adding member', async () => {
      const cookie = setupAuth(pmId);
      (db.user.findUnique as any).mockResolvedValue(mockUsers[dev2Id]);
      (db.projectMember.findUnique as any).mockImplementation(async (args: any) => {
        const uid = args?.where?.projectId_userId?.userId;
        if (uid === pmId) {
          return { projectId, userId: pmId, projectRole: 'manager' };
        }
        return null;
      });
      (db.projectMember.create as any).mockResolvedValue({
        id: 'pm-row-1',
        projectId,
        userId: dev2Id,
        projectRole: 'member',
        user: mockUsers[dev2Id],
      });
      (db.notification.create as any).mockRejectedValueOnce(new Error('DB write error'));

      const res = await request(app)
        .post(`/api/projects/${projectId}/members`)
        .set('Cookie', cookie)
        .send({ userId: dev2Id, projectRole: 'member' });

      expect(res.status).toBe(500);
    });
  });
});
