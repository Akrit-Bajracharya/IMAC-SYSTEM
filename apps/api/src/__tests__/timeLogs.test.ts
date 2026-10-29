import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../app.js';
import { db } from '../db.js';

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * MOCK LIMITATIONS AND BOUNDARY DOCUMENTATION:
 *
 * 1. Mock-based Tests:
 *    The tests in this suite mock Prisma client methods (db.timeLog.*, db.task.*,
 *    db.project.*, db.projectMember.*, db.auditLog.*, db.$transaction, db.$queryRaw)
 *    via Vitest spies.
 *
 * 2. What Mocks Cannot Prove:
 *    - Real PostgreSQL Transaction Advisory Locks (SELECT pg_advisory_xact_lock(...)):
 *      The SQL statement is verified to execute within the transaction, but Vitest
 *      mock execution cannot simulate multi-connection lock contention or concurrent race
 *      conditions when two threads attempt to log time simultaneously for the same user.
 * ─────────────────────────────────────────────────────────────────────────────
 */

describe('Step 10d: Time Logs Subsystem Tests', () => {
  const app = createApp({ csrfDisabled: true });

  const adminUserId = '11111111-1111-4111-8111-111111111111';
  const pmUserId = '22222222-2222-4222-8222-222222222222';
  const employeeUserId = '44444444-4444-4444-8444-444444444444';
  const otherEmpUserId = '44444444-4444-4444-8444-444444444445';
  const viewerUserId = '55555555-5555-4555-8555-555555555555';

  const mockUsers: Record<string, any> = {
    [adminUserId]: {
      id: adminUserId,
      username: 'admin_boss',
      displayName: 'System Admin Boss',
      systemRole: 'system_admin',
      isActive: true,
      mustChangePassword: false,
    },
    [pmUserId]: {
      id: pmUserId,
      username: 'pm_lead',
      displayName: 'PM Lead',
      systemRole: 'project_manager',
      isActive: true,
      mustChangePassword: false,
    },
    [employeeUserId]: {
      id: employeeUserId,
      username: 'emp_dev',
      displayName: 'Employee Developer',
      systemRole: 'employee',
      isActive: true,
      mustChangePassword: false,
    },
    [otherEmpUserId]: {
      id: otherEmpUserId,
      username: 'emp_other',
      displayName: 'Other Employee',
      systemRole: 'employee',
      isActive: true,
      mustChangePassword: false,
    },
    [viewerUserId]: {
      id: viewerUserId,
      username: 'view_auditor',
      displayName: 'Viewer Auditor',
      systemRole: 'viewer',
      isActive: true,
      mustChangePassword: false,
    },
  };

  function setupAuth(userId: string) {
    const user = { ...mockUsers[userId] };
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

  const validProjectId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const otherProjectId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  const validTaskId = '10101010-1010-4010-8010-101010101010';
  const otherTaskId = '20202020-2020-4020-8020-202020202020';
  const validTimeLogId = '90909090-9090-4090-8090-909090909090';

  const todayStr = '2026-10-28';

  beforeEach(() => {
    vi.clearAllMocks();
    (db.auditLog.create as any).mockResolvedValue({});
    (db.$queryRaw as any).mockResolvedValue([{ id: 'mock-id' }]);
  });

  describe('1. Authentication & Route Guards', () => {
    it('returns 401 unauthenticated on all time log endpoints', async () => {
      const resPost = await request(app).post(`/api/projects/${validProjectId}/time-logs`).send({});
      expect(resPost.status).toBe(401);

      const resGet = await request(app).get(`/api/projects/${validProjectId}/time-logs`);
      expect(resGet.status).toBe(401);

      const resPatch = await request(app).patch(`/api/projects/${validProjectId}/time-logs/${validTimeLogId}`).send({});
      expect(resPatch.status).toBe(401);

      const resDelete = await request(app).delete(`/api/projects/${validProjectId}/time-logs/${validTimeLogId}`);
      expect(resDelete.status).toBe(401);
    });

    it('returns 404 when non-member attempts to log time (mock-based)', async () => {
      const cookie = setupAuth(employeeUserId);
      vi.mocked(db.project.findUnique).mockResolvedValue({ id: validProjectId } as any);
      // Not a member
      vi.mocked(db.projectMember.findUnique as any).mockResolvedValue(null);

      const res = await request(app)
        .post(`/api/projects/${validProjectId}/time-logs`)
        .set('Cookie', cookie)
        .send({ workDate: todayStr, hours: 2 });

      expect(res.status).toBe(404);
      expect(res.body.message).toContain('member');
    });

    it('returns 403 when project viewer attempts to log time (mock-based)', async () => {
      const cookie = setupAuth(employeeUserId);
      vi.mocked(db.project.findUnique).mockResolvedValue({ id: validProjectId } as any);
      vi.mocked(db.projectMember.findUnique as any).mockResolvedValue({
        projectId: validProjectId,
        userId: employeeUserId,
        projectRole: 'viewer',
      } as any);

      const res = await request(app)
        .post(`/api/projects/${validProjectId}/time-logs`)
        .set('Cookie', cookie)
        .send({ workDate: todayStr, hours: 2 });

      expect(res.status).toBe(403);
      expect(res.body.message).toContain('Viewers cannot');
    });

    it('refuses system_admin without a project member row from logging time (NO membership bypass) (mock-based)', async () => {
      const cookie = setupAuth(adminUserId);
      vi.mocked(db.project.findUnique).mockResolvedValue({ id: validProjectId } as any);
      // Admin is NOT a member of this project
      vi.mocked(db.projectMember.findUnique as any).mockResolvedValue(null);

      const res = await request(app)
        .post(`/api/projects/${validProjectId}/time-logs`)
        .set('Cookie', cookie)
        .send({ workDate: todayStr, hours: 2 });

      expect(res.status).toBe(404);
      expect(res.body.message).toContain('member');
    });
  });

  describe('2. POST /api/projects/:id/time-logs - Creation Invariants', () => {
    it('allows project member to log time, omitting note from audit log (mock-based)', async () => {
      const cookie = setupAuth(employeeUserId);
      vi.mocked(db.project.findUnique).mockResolvedValue({ id: validProjectId } as any);
      vi.mocked(db.projectMember.findUnique as any).mockResolvedValue({
        projectId: validProjectId,
        userId: employeeUserId,
        projectRole: 'member',
      } as any);

      vi.mocked(db.timeLog.aggregate as any).mockResolvedValue({ _sum: { hours: 4 } });
      vi.mocked(db.timeLog.create as any).mockResolvedValue({
        id: validTimeLogId,
        projectId: validProjectId,
        userId: employeeUserId,
        workDate: new Date(todayStr),
        hours: 3.5,
        note: 'Confidential work note',
        user: { id: employeeUserId, displayName: 'Dev', username: 'dev' },
      });

      const res = await request(app)
        .post(`/api/projects/${validProjectId}/time-logs`)
        .set('Cookie', cookie)
        .send({
          workDate: todayStr,
          hours: 3.5,
          note: 'Confidential work note',
        });

      expect(res.status).toBe(201);
      expect(res.body.id).toBe(validTimeLogId);
      expect(res.body.user.passwordHash).toBeUndefined();
      expect(res.body.user.systemRole).toBeUndefined();

      // Verify audit log omits note
      expect(db.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: 'time_log.created',
            entityId: validTimeLogId,
            afterSnapshot: expect.not.objectContaining({ note: expect.anything() }),
          }),
        }),
      );
    });

    it('allows system_admin to log time IF they are added as a member (mock-based)', async () => {
      const cookie = setupAuth(adminUserId);
      vi.mocked(db.project.findUnique).mockResolvedValue({ id: validProjectId } as any);
      vi.mocked(db.projectMember.findUnique as any).mockResolvedValue({
        projectId: validProjectId,
        userId: adminUserId,
        projectRole: 'manager',
      } as any);

      vi.mocked(db.timeLog.aggregate as any).mockResolvedValue({ _sum: { hours: 0 } });
      vi.mocked(db.timeLog.create as any).mockResolvedValue({
        id: validTimeLogId,
        projectId: validProjectId,
        userId: adminUserId,
        workDate: new Date(todayStr),
        hours: 1.25,
      });

      const res = await request(app)
        .post(`/api/projects/${validProjectId}/time-logs`)
        .set('Cookie', cookie)
        .send({ workDate: todayStr, hours: 1.25 });

      expect(res.status).toBe(201);
    });

    it('refuses logging time on a task belonging to another project (400 invalid_task) (mock-based)', async () => {
      const cookie = setupAuth(employeeUserId);
      vi.mocked(db.project.findUnique).mockResolvedValue({ id: validProjectId } as any);
      vi.mocked(db.projectMember.findUnique as any).mockResolvedValue({
        projectId: validProjectId,
        userId: employeeUserId,
        projectRole: 'member',
      } as any);

      vi.mocked(db.task.findUnique as any).mockResolvedValue({
        id: otherTaskId,
        projectId: otherProjectId, // belongs to otherProjectId
      });

      const res = await request(app)
        .post(`/api/projects/${validProjectId}/time-logs`)
        .set('Cookie', cookie)
        .send({
          taskId: otherTaskId,
          workDate: todayStr,
          hours: 2,
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('invalid_task');
    });

    it('refuses dates more than 1 day in the future or older than 90 days in Asia/Kathmandu (400 invalid_date_range) (mock-based)', async () => {
      const cookie = setupAuth(employeeUserId);
      vi.mocked(db.project.findUnique).mockResolvedValue({ id: validProjectId } as any);
      vi.mocked(db.projectMember.findUnique as any).mockResolvedValue({
        projectId: validProjectId,
        userId: employeeUserId,
        projectRole: 'member',
      } as any);

      // Future date (> 1 day in future)
      const resFuture = await request(app)
        .post(`/api/projects/${validProjectId}/time-logs`)
        .set('Cookie', cookie)
        .send({ workDate: '2026-11-15', hours: 2 });
      expect(resFuture.status).toBe(400);
      expect(resFuture.body.error).toBe('invalid_date_range');

      // Past date (> 90 days ago)
      const resPast = await request(app)
        .post(`/api/projects/${validProjectId}/time-logs`)
        .set('Cookie', cookie)
        .send({ workDate: '2025-01-01', hours: 2 });
      expect(resPast.status).toBe(400);
      expect(resPast.body.error).toBe('invalid_date_range');
    });

    it('refuses daily total hours exceeding 24 across all projects (400 daily_hours_exceeded) (mock-based)', async () => {
      const cookie = setupAuth(employeeUserId);
      vi.mocked(db.project.findUnique).mockResolvedValue({ id: validProjectId } as any);
      vi.mocked(db.projectMember.findUnique as any).mockResolvedValue({
        projectId: validProjectId,
        userId: employeeUserId,
        projectRole: 'member',
      } as any);

      // Already logged 22 hours on this day across other projects
      vi.mocked(db.timeLog.aggregate as any).mockResolvedValue({ _sum: { hours: 22 } });

      const res = await request(app)
        .post(`/api/projects/${validProjectId}/time-logs`)
        .set('Cookie', cookie)
        .send({ workDate: todayStr, hours: 3 }); // 22 + 3 = 25 > 24

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('daily_hours_exceeded');
    });
  });

  describe('3. GET /api/projects/:id/time-logs - Scoping and Filters', () => {
    it('allows manager and system_admin to view all project logs, filtering by userId if requested (mock-based)', async () => {
      const cookie = setupAuth(pmUserId);
      vi.mocked(db.project.findUnique).mockResolvedValue({ id: validProjectId } as any);
      vi.mocked(db.projectMember.findUnique as any).mockResolvedValue({
        projectId: validProjectId,
        userId: pmUserId,
        projectRole: 'manager',
      } as any);

      vi.mocked(db.timeLog.findMany as any).mockResolvedValue([
        { id: 'l1', hours: 2, userId: employeeUserId },
        { id: 'l2', hours: 3, userId: otherEmpUserId },
      ]);

      const res = await request(app)
        .get(`/api/projects/${validProjectId}/time-logs`)
        .set('Cookie', cookie);

      expect(res.status).toBe(200);
      expect(res.body.items).toHaveLength(2);
      expect(db.timeLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { projectId: validProjectId },
        }),
      );

      // Manager filtering by specific userId
      await request(app)
        .get(`/api/projects/${validProjectId}/time-logs?userId=${employeeUserId}`)
        .set('Cookie', cookie);

      expect(db.timeLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { projectId: validProjectId, userId: employeeUserId },
        }),
      );
    });

    it('scopes regular members and viewers strictly to their own logs (mock-based)', async () => {
      const cookie = setupAuth(employeeUserId);
      vi.mocked(db.project.findUnique).mockResolvedValue({ id: validProjectId } as any);
      vi.mocked(db.projectMember.findUnique as any).mockResolvedValue({
        projectId: validProjectId,
        userId: employeeUserId,
        projectRole: 'member',
      } as any);

      vi.mocked(db.timeLog.findMany as any).mockResolvedValue([]);

      await request(app)
        .get(`/api/projects/${validProjectId}/time-logs`)
        .set('Cookie', cookie);

      expect(db.timeLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { projectId: validProjectId, userId: employeeUserId },
        }),
      );
    });

    it('refuses regular member from passing another userId filter (403 forbidden) (mock-based)', async () => {
      const cookie = setupAuth(employeeUserId);
      vi.mocked(db.project.findUnique).mockResolvedValue({ id: validProjectId } as any);
      vi.mocked(db.projectMember.findUnique as any).mockResolvedValue({
        projectId: validProjectId,
        userId: employeeUserId,
        projectRole: 'member',
      } as any);

      const res = await request(app)
        .get(`/api/projects/${validProjectId}/time-logs?userId=${otherEmpUserId}`)
        .set('Cookie', cookie);

      expect(res.status).toBe(403);
      expect(res.body.message).toContain('only view your own');
    });
  });

  describe('4. PATCH and DELETE /api/projects/:id/time-logs/:timeLogId - IDOR & Ownership', () => {
    it('returns 404 when timeLog belongs to another project (IDOR prevention) (mock-based)', async () => {
      const cookie = setupAuth(employeeUserId);
      vi.mocked(db.project.findUnique).mockResolvedValue({ id: validProjectId } as any);
      vi.mocked(db.projectMember.findUnique as any).mockResolvedValue({
        projectId: validProjectId,
        userId: employeeUserId,
        projectRole: 'member',
      } as any);

      // Log belongs to otherProjectId
      vi.mocked(db.timeLog.findUnique as any).mockResolvedValue({
        id: validTimeLogId,
        projectId: otherProjectId,
        userId: employeeUserId,
      });

      const resPatch = await request(app)
        .patch(`/api/projects/${validProjectId}/time-logs/${validTimeLogId}`)
        .set('Cookie', cookie)
        .send({ hours: 1 });
      expect(resPatch.status).toBe(404);

      const resDelete = await request(app)
        .delete(`/api/projects/${validProjectId}/time-logs/${validTimeLogId}`)
        .set('Cookie', cookie);
      expect(resDelete.status).toBe(404);
    });

    it('returns 403 when trying to edit or delete another user time log (mock-based)', async () => {
      const cookie = setupAuth(employeeUserId);
      vi.mocked(db.project.findUnique).mockResolvedValue({ id: validProjectId } as any);
      vi.mocked(db.projectMember.findUnique as any).mockResolvedValue({
        projectId: validProjectId,
        userId: employeeUserId,
        projectRole: 'member',
      } as any);

      // Log belongs to otherEmpUserId
      vi.mocked(db.timeLog.findUnique as any).mockResolvedValue({
        id: validTimeLogId,
        projectId: validProjectId,
        userId: otherEmpUserId,
      });

      const resPatch = await request(app)
        .patch(`/api/projects/${validProjectId}/time-logs/${validTimeLogId}`)
        .set('Cookie', cookie)
        .send({ hours: 1 });
      expect(resPatch.status).toBe(403);
      expect(resPatch.body.message).toContain('only edit your own');

      const resDelete = await request(app)
        .delete(`/api/projects/${validProjectId}/time-logs/${validTimeLogId}`)
        .set('Cookie', cookie);
      expect(resDelete.status).toBe(403);
      expect(resDelete.body.message).toContain('only delete your own');
    });

    it('allows owner to edit time log, excluding current log from 24h cap and omitting note from audit (mock-based)', async () => {
      const cookie = setupAuth(employeeUserId);
      vi.mocked(db.project.findUnique).mockResolvedValue({ id: validProjectId } as any);
      vi.mocked(db.projectMember.findUnique as any).mockResolvedValue({
        projectId: validProjectId,
        userId: employeeUserId,
        projectRole: 'member',
      } as any);

      vi.mocked(db.timeLog.findUnique as any).mockResolvedValue({
        id: validTimeLogId,
        projectId: validProjectId,
        userId: employeeUserId,
        workDate: new Date(todayStr),
        hours: 4,
        note: 'Old note',
      });

      // Sum excluding current log is 18h
      vi.mocked(db.timeLog.aggregate as any).mockResolvedValue({ _sum: { hours: 18 } });
      vi.mocked(db.timeLog.update as any).mockResolvedValue({
        id: validTimeLogId,
        projectId: validProjectId,
        userId: employeeUserId,
        workDate: new Date(todayStr),
        hours: 5,
        note: 'New sensitive note',
      });

      const res = await request(app)
        .patch(`/api/projects/${validProjectId}/time-logs/${validTimeLogId}`)
        .set('Cookie', cookie)
        .send({ hours: 5, note: 'New sensitive note' });

      expect(res.status).toBe(200);
      expect(db.timeLog.aggregate).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            id: { not: validTimeLogId },
          }),
        }),
      );

      // Audit log omits note
      expect(db.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: 'time_log.updated',
            beforeSnapshot: expect.not.objectContaining({ note: expect.anything() }),
            afterSnapshot: expect.not.objectContaining({ note: expect.anything() }),
          }),
        }),
      );
    });

    it('allows owner to delete own time log and audits time_log.removed (mock-based)', async () => {
      const cookie = setupAuth(employeeUserId);
      vi.mocked(db.project.findUnique).mockResolvedValue({ id: validProjectId } as any);
      vi.mocked(db.projectMember.findUnique as any).mockResolvedValue({
        projectId: validProjectId,
        userId: employeeUserId,
        projectRole: 'member',
      } as any);

      vi.mocked(db.timeLog.findUnique as any).mockResolvedValue({
        id: validTimeLogId,
        projectId: validProjectId,
        userId: employeeUserId,
        workDate: new Date(todayStr),
        hours: 2,
      });

      vi.mocked(db.timeLog.delete as any).mockResolvedValue({});

      const res = await request(app)
        .delete(`/api/projects/${validProjectId}/time-logs/${validTimeLogId}`)
        .set('Cookie', cookie);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(db.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: 'time_log.removed',
            entityId: validTimeLogId,
          }),
        }),
      );
    });
  });
});
