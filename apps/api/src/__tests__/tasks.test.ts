import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../app.js';
import { db } from '../db.js';

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * MOCK LIMITATIONS AND BOUNDARY DOCUMENTATION:
 *
 * 1. Mock-based Tests:
 *    The tests in this suite mock Prisma client methods (db.task.*, db.milestone.*,
 *    db.taskDependency.*, db.comment.*, db.auditLog.*, db.$transaction, and db.$queryRaw)
 *    via Vitest spies.
 *
 * 2. What Mocks Cannot Prove:
 *    - Real PostgreSQL Row-Level Locking (SELECT "id" FROM "Project" WHERE "id" = $1 FOR UPDATE):
 *      The SQL statement is verified to execute within the transaction, but Vitest mock execution
 *      cannot simulate multi-connection lock contention, lock queues, or deadlocks.
 *    - Concurrent Race Conditions & Rollbacks:
 *      In real production PostgreSQL, concurrent status changes or dependency additions
 *      are isolated by database transactions; unit test mocks execute sequentially in a single thread.
 *    - Native Constraint Collisions (P2002):
 *      Mocks simulate P2002 by rejecting with `{ code: 'P2002' }`; they do not execute database-level
 *      index checks.
 * ─────────────────────────────────────────────────────────────────────────────
 */

describe('Step 10c: Tasks, Subtasks, Milestones, Dependencies & Comments Tests', () => {
  const app = createApp({ csrfDisabled: true });

  const adminUserId = '11111111-1111-4111-8111-111111111111';
  const pmUserId = '22222222-2222-4222-8222-222222222222';
  const otherPmUserId = '33333333-3333-4333-8333-333333333333';
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
    [otherPmUserId]: {
      id: otherPmUserId,
      username: 'pm_other',
      displayName: 'Other PM',
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

  function setupAuth(userId: string, mustChangePassword = false) {
    const user = { ...mockUsers[userId], mustChangePassword };
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
  const validMilestoneId = '30303030-3030-4030-8030-303030303030';
  const validCommentId = '40404040-4040-4040-8040-404040404040';

  beforeEach(() => {
    vi.clearAllMocks();
    (db.auditLog.create as any).mockResolvedValue({});
    (db.$queryRaw as any).mockResolvedValue([{ id: validProjectId }]);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 1. Unauthenticated & Non-Member 404 (Route Guards & Amendment 5)
  // ───────────────────────────────────────────────────────────────────────────
  describe('1. Authentication and Non-Member 404 Tests', () => {
    it('returns 401 unauthenticated on every route group', async () => {
      const res1 = await request(app).get(`/api/projects/${validProjectId}/tasks`);
      expect(res1.status).toBe(401);

      const res2 = await request(app).post(`/api/projects/${validProjectId}/tasks`).send({ title: 'Task' });
      expect(res2.status).toBe(401);

      const res3 = await request(app).get(`/api/projects/${validProjectId}/milestones`);
      expect(res3.status).toBe(401);

      const res4 = await request(app).post(`/api/projects/${validProjectId}/milestones`).send({ name: 'M1' });
      expect(res4.status).toBe(401);

      const res5 = await request(app).post(`/api/projects/${validProjectId}/tasks/${validTaskId}/comments`).send({ body: 'Comment' });
      expect(res5.status).toBe(401);
    });

    it('returns 404 for non-members on task and milestone routers (Amendment 5)', async () => {
      const cookie = setupAuth(employeeUserId);
      // Project exists, but caller is not a member
      vi.mocked(db.project.findUnique).mockResolvedValue({ id: validProjectId } as any);
      vi.mocked(db.projectMember.findUnique).mockResolvedValue(null);

      const resTasks = await request(app)
        .get(`/api/projects/${validProjectId}/tasks`)
        .set('Cookie', cookie);
      expect(resTasks.status).toBe(404);
      expect(resTasks.body.error).toBe('not_found');

      const resMilestones = await request(app)
        .get(`/api/projects/${validProjectId}/milestones`)
        .set('Cookie', cookie);
      expect(resMilestones.status).toBe(404);
      expect(resMilestones.body.error).toBe('not_found');
    });

    it('returns 404 when project_manager of another project accesses tasks', async () => {
      const cookie = setupAuth(otherPmUserId);
      vi.mocked(db.project.findUnique).mockResolvedValue({ id: validProjectId } as any);
      vi.mocked(db.projectMember.findUnique).mockResolvedValue(null);

      const res = await request(app)
        .get(`/api/projects/${validProjectId}/tasks`)
        .set('Cookie', cookie);
      expect(res.status).toBe(404);
      expect(res.body.error).toBe('not_found');
    });

    it('returns 404 for malformed UUIDs on path parameters', async () => {
      const cookie = setupAuth(pmUserId);
      const res1 = await request(app).get('/api/projects/malformed-id/tasks').set('Cookie', cookie);
      expect(res1.status).toBe(404);

      const res2 = await request(app).get(`/api/projects/${validProjectId}/tasks/malformed-task-id`).set('Cookie', cookie);
      expect(res2.status).toBe(404);

      const res3 = await request(app).patch(`/api/projects/${validProjectId}/milestones/malformed-milestone`).set('Cookie', cookie);
      expect(res3.status).toBe(404);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 2. Task Creation & Subtask Rules
  // ───────────────────────────────────────────────────────────────────────────
  describe('2. POST /api/projects/:id/tasks - Creation & Invariants', () => {
        it('allows a plain project MEMBER (not manager, not system_admin) to create task (Step 10f fix)', async () => {
      const cookie = setupAuth(employeeUserId);
      vi.mocked(db.project.findUnique).mockResolvedValue({ id: validProjectId } as any);
      vi.mocked(db.projectMember.findUnique).mockResolvedValue({
        projectId: validProjectId,
        userId: employeeUserId,
        projectRole: 'member',
      } as any);

      vi.mocked(db.task.create).mockResolvedValue({
        id: validTaskId,
        projectId: validProjectId,
        title: 'Plain Member Task',
        status: 'todo',
        createdByUserId: employeeUserId,
      } as any);

      const res = await request(app)
        .post(`/api/projects/${validProjectId}/tasks`)
        .set('Cookie', cookie)
        .send({
          title: 'Plain Member Task',
          estimatedHours: 2.5,
        });

      expect(res.status).toBe(201);
      expect(res.body.title).toBe('Plain Member Task');
      expect(res.body.createdByUserId).toBe(employeeUserId);
      expect(db.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: 'task.created',
            entityId: validTaskId,
          }),
        }),
      );
    });

it('allows project manager and system_admin to create task', async () => {
      const cookie = setupAuth(pmUserId);
      vi.mocked(db.project.findUnique).mockResolvedValue({ id: validProjectId } as any);
      vi.mocked(db.projectMember.findUnique).mockResolvedValue({
        projectId: validProjectId,
        userId: pmUserId,
        projectRole: 'manager',
      } as any);

      vi.mocked(db.task.create).mockResolvedValue({
        id: validTaskId,
        projectId: validProjectId,
        title: 'Implement Authentication Bridge',
        status: 'todo',
        createdByUserId: pmUserId,
      } as any);

      const res = await request(app)
        .post(`/api/projects/${validProjectId}/tasks`)
        .set('Cookie', cookie)
        .send({
          title: 'Implement Authentication Bridge',
          estimatedHours: 4.25,
        });

      expect(res.status).toBe(201);
      expect(res.body.title).toBe('Implement Authentication Bridge');
      expect(db.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: 'task.created',
            entityId: validTaskId,
          }),
        }),
      );
    });

    it('refuses creation for project viewer (403 forbidden)', async () => {
      const cookie = setupAuth(viewerUserId);
      vi.mocked(db.project.findUnique).mockResolvedValue({ id: validProjectId } as any);
      vi.mocked(db.projectMember.findUnique).mockResolvedValue({
        projectId: validProjectId,
        userId: viewerUserId,
        projectRole: 'viewer',
      } as any);

      const res = await request(app)
        .post(`/api/projects/${validProjectId}/tasks`)
        .set('Cookie', cookie)
        .send({ title: 'Viewer Task' });

      expect(res.status).toBe(403);
      expect(res.body.error).toBe('forbidden');
    });

    it('refuses creation with forbidden fields in body (.strict() schema)', async () => {
      const cookie = setupAuth(pmUserId);
      vi.mocked(db.project.findUnique).mockResolvedValue({ id: validProjectId } as any);
      vi.mocked(db.projectMember.findUnique).mockResolvedValue({
        projectId: validProjectId,
        userId: pmUserId,
        projectRole: 'manager',
      } as any);

      const res = await request(app)
        .post(`/api/projects/${validProjectId}/tasks`)
        .set('Cookie', cookie)
        .send({
          title: 'Hacked Task',
          status: 'done', // forbidden
          createdByUserId: adminUserId, // forbidden
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('validation_error');
    });

    it('refuses estimatedHours not in 0.25 increment (0.254 refused, 0.25 accepted)', async () => {
      const cookie = setupAuth(pmUserId);
      vi.mocked(db.project.findUnique).mockResolvedValue({ id: validProjectId } as any);
      vi.mocked(db.projectMember.findUnique).mockResolvedValue({
        projectId: validProjectId,
        userId: pmUserId,
        projectRole: 'manager',
      } as any);

      const resBad = await request(app)
        .post(`/api/projects/${validProjectId}/tasks`)
        .set('Cookie', cookie)
        .send({ title: 'Task', estimatedHours: 0.254 });
      expect(resBad.status).toBe(400);
      expect(resBad.body.error).toBe('validation_error');

      vi.mocked(db.task.create).mockResolvedValue({ id: validTaskId, title: 'Task' } as any);
      const resGood = await request(app)
        .post(`/api/projects/${validProjectId}/tasks`)
        .set('Cookie', cookie)
        .send({ title: 'Task', estimatedHours: 0.25 });
      expect(resGood.status).toBe(201);
    });

    it('returns 404 when parentTaskId belongs to another project (Amendment 2 & IDOR)', async () => {
      const cookie = setupAuth(pmUserId);
      vi.mocked(db.project.findUnique).mockResolvedValue({ id: validProjectId } as any);
      vi.mocked(db.projectMember.findUnique).mockResolvedValue({
        projectId: validProjectId,
        userId: pmUserId,
        projectRole: 'manager',
      } as any);

      // Parent task belongs to otherProjectId
      vi.mocked(db.task.findUnique).mockResolvedValue({
        id: otherTaskId,
        projectId: otherProjectId,
        parentTaskId: null,
      } as any);

      const res = await request(app)
        .post(`/api/projects/${validProjectId}/tasks`)
        .set('Cookie', cookie)
        .send({
          title: 'Cross Project Subtask',
          parentTaskId: otherTaskId,
        });

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('not_found');
    });

    it('returns 400 when attempting to create subtask under a subtask (1-level rule)', async () => {
      const cookie = setupAuth(pmUserId);
      vi.mocked(db.project.findUnique).mockResolvedValue({ id: validProjectId } as any);
      vi.mocked(db.projectMember.findUnique).mockResolvedValue({
        projectId: validProjectId,
        userId: pmUserId,
        projectRole: 'manager',
      } as any);

      // Parent task already has a parentTaskId
      vi.mocked(db.task.findUnique).mockResolvedValue({
        id: validTaskId,
        projectId: validProjectId,
        parentTaskId: 'grandparent-task-id',
      } as any);

      const res = await request(app)
        .post(`/api/projects/${validProjectId}/tasks`)
        .set('Cookie', cookie)
        .send({
          title: '2-Level Nested Subtask',
          parentTaskId: validTaskId,
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('invalid_subtask_nesting');
    });

    it('refuses invalid assignee (inactive, non-member, or project viewer) with 400 invalid_assignee', async () => {
      const cookie = setupAuth(pmUserId);
      vi.mocked(db.project.findUnique).mockResolvedValue({ id: validProjectId } as any);
      vi.mocked(db.projectMember.findUnique)
        .mockResolvedValueOnce({ projectId: validProjectId, userId: pmUserId, projectRole: 'manager' } as any) // caller
        .mockResolvedValueOnce({
          projectId: validProjectId,
          userId: viewerUserId,
          projectRole: 'viewer', // viewer cannot be assignee
          user: { id: viewerUserId, isActive: true },
        } as any);

      const res = await request(app)
        .post(`/api/projects/${validProjectId}/tasks`)
        .set('Cookie', cookie)
        .send({
          title: 'Assigned to Viewer',
          assigneeUserId: viewerUserId,
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('invalid_assignee');
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 3. Task Listing, Filtering & Overdue Check
  // ───────────────────────────────────────────────────────────────────────────
  describe('3. GET /api/projects/:id/tasks - Filters, Pagination & Overdue', () => {
    it('returns 400 when topLevelOnly is combined with parentTaskId (Amendment 9)', async () => {
      const cookie = setupAuth(pmUserId);
      vi.mocked(db.project.findUnique).mockResolvedValue({ id: validProjectId } as any);
      vi.mocked(db.projectMember.findUnique).mockResolvedValue({
        projectId: validProjectId,
        userId: pmUserId,
        projectRole: 'manager',
      } as any);

      const res = await request(app)
        .get(`/api/projects/${validProjectId}/tasks?topLevelOnly=true&parentTaskId=${validTaskId}`)
        .set('Cookie', cookie);

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('validation_error');
    });

    it('evaluates overdue filter using Asia/Kathmandu date boundary (Amendment 13)', async () => {
      // Set fake time to 18:30 UTC on 2026-10-28.
      // In UTC, it's Oct 28. In Asia/Kathmandu (+05:45), it is 00:15 on Oct 29!
      vi.setSystemTime(new Date('2026-10-28T18:30:00Z'));
      const cookie = setupAuth(pmUserId);

      vi.mocked(db.project.findUnique).mockResolvedValue({ id: validProjectId } as any);
      vi.mocked(db.projectMember.findUnique).mockResolvedValue({
        projectId: validProjectId,
        userId: pmUserId,
        projectRole: 'manager',
      } as any);
      vi.mocked(db.projectMember.findMany).mockResolvedValue([]);
      vi.mocked(db.task.findMany).mockResolvedValue([]);

      const res = await request(app)
        .get(`/api/projects/${validProjectId}/tasks?overdue=true`)
        .set('Cookie', cookie);

      expect(res.status).toBe(200);
      // In Kathmandu it is 2026-10-29, so overdue query searches dueDate < 2026-10-29T00:00:00Z
      expect(db.task.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            dueDate: { lt: new Date(Date.UTC(2026, 9, 29)) },
            status: { not: 'done' },
          }),
        }),
      );
    });

    it('returns 400 when cursor is not found in this project (Amendment 11)', async () => {
      const cookie = setupAuth(pmUserId);
      vi.mocked(db.project.findUnique).mockResolvedValue({ id: validProjectId } as any);
      vi.mocked(db.projectMember.findUnique).mockResolvedValue({
        projectId: validProjectId,
        userId: pmUserId,
        projectRole: 'manager',
      } as any);

      // Cursor not found in this project
      vi.mocked(db.task.findFirst).mockResolvedValue(null);

      const res = await request(app)
        .get(`/api/projects/${validProjectId}/tasks?cursor=${validTaskId}`)
        .set('Cookie', cookie);

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('invalid_cursor');
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 4. Task Editing, Departed Assignee & Permission Scoping
  // ───────────────────────────────────────────────────────────────────────────
  describe('4. PATCH /api/projects/:id/tasks/:taskId - Editing & Permissions', () => {
    it('member cannot edit another member task they did not create and are not assigned to (403)', async () => {
      const cookie = setupAuth(employeeUserId);
      vi.mocked(db.project.findUnique).mockResolvedValue({ id: validProjectId } as any);
      vi.mocked(db.projectMember.findUnique).mockResolvedValue({
        projectId: validProjectId,
        userId: employeeUserId,
        projectRole: 'member',
      } as any);

      // Task created by otherEmpUserId and assigned to otherEmpUserId
      vi.mocked(db.task.findUnique).mockResolvedValue({
        id: validTaskId,
        projectId: validProjectId,
        createdByUserId: otherEmpUserId,
        assigneeUserId: otherEmpUserId,
      } as any);

      const res = await request(app)
        .patch(`/api/projects/${validProjectId}/tasks/${validTaskId}`)
        .set('Cookie', cookie)
        .send({ title: 'Unauthorized Edit' });

      expect(res.status).toBe(403);
      expect(res.body.error).toBe('forbidden');
    });

    it('member can edit a task they created or are assigned to', async () => {
      const cookie = setupAuth(employeeUserId);
      vi.mocked(db.project.findUnique).mockResolvedValue({ id: validProjectId } as any);
      vi.mocked(db.projectMember.findUnique).mockResolvedValue({
        projectId: validProjectId,
        userId: employeeUserId,
        projectRole: 'member',
      } as any);

      // Task created by employeeUserId
      vi.mocked(db.task.findUnique).mockResolvedValue({
        id: validTaskId,
        projectId: validProjectId,
        createdByUserId: employeeUserId,
        assigneeUserId: null,
        title: 'Original Title',
      } as any);

      vi.mocked(db.task.update).mockResolvedValue({
        id: validTaskId,
        projectId: validProjectId,
        title: 'Updated Title',
      } as any);

      const res = await request(app)
        .patch(`/api/projects/${validProjectId}/tasks/${validTaskId}`)
        .set('Cookie', cookie)
        .send({ title: 'Updated Title' });

      expect(res.status).toBe(200);
      expect(res.body.title).toBe('Updated Title');
    });

    it('succeeds patching title when assignee has left project if assignee is unchanged (Amendment 1)', async () => {
      const cookie = setupAuth(pmUserId);
      vi.mocked(db.project.findUnique).mockResolvedValue({ id: validProjectId } as any);
      vi.mocked(db.projectMember.findUnique as any).mockImplementation(async ({ where }: any) => {
        if (where?.projectId_userId?.userId === pmUserId) {
          return { projectId: validProjectId, userId: pmUserId, projectRole: 'manager' } as any;
        }
        return null; // departedUserId is no longer a member
      });

      const departedUserId = '88888888-8888-4888-8888-888888888888';
      vi.mocked(db.task.findUnique).mockResolvedValue({
        id: validTaskId,
        projectId: validProjectId,
        assigneeUserId: departedUserId,
        title: 'Old Title',
      } as any);

      vi.mocked(db.task.update).mockResolvedValue({
        id: validTaskId,
        projectId: validProjectId,
        title: 'New Title',
        assigneeUserId: departedUserId,
      } as any);

      // Only patching title; assigneeUserId is NOT in body or unchanged
      const res = await request(app)
        .patch(`/api/projects/${validProjectId}/tasks/${validTaskId}`)
        .set('Cookie', cookie)
        .send({ title: 'New Title' });

      expect(res.status).toBe(200);
      expect(res.body.assigneeIsProjectMember).toBe(false);
    });

    it('returns 404 on task detail or patch when taskId belongs to another project (IDOR)', async () => {
      const cookie = setupAuth(pmUserId);
      vi.mocked(db.project.findUnique).mockResolvedValue({ id: validProjectId } as any);
      vi.mocked(db.projectMember.findUnique).mockResolvedValue({
        projectId: validProjectId,
        userId: pmUserId,
        projectRole: 'manager',
      } as any);

      // Task belongs to otherProjectId
      vi.mocked(db.task.findUnique).mockResolvedValue({
        id: validTaskId,
        projectId: otherProjectId,
      } as any);

      const resGet = await request(app)
        .get(`/api/projects/${validProjectId}/tasks/${validTaskId}`)
        .set('Cookie', cookie);
      expect(resGet.status).toBe(404);

      const resPatch = await request(app)
        .patch(`/api/projects/${validProjectId}/tasks/${validTaskId}`)
        .set('Cookie', cookie)
        .send({ title: 'IDOR Title' });
      expect(resPatch.status).toBe(404);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 5. Status Transitions & Warnings
  // ───────────────────────────────────────────────────────────────────────────
  describe('5. POST /api/projects/:id/tasks/:taskId/status - Status Transitions', () => {
    it('refuses same-status transition with 400 same_status', async () => {
      const cookie = setupAuth(pmUserId);
      vi.mocked(db.project.findUnique).mockResolvedValue({ id: validProjectId } as any);
      vi.mocked(db.projectMember.findUnique).mockResolvedValue({
        projectId: validProjectId,
        userId: pmUserId,
        projectRole: 'manager',
      } as any);

      vi.mocked(db.task.findUnique).mockResolvedValue({
        id: validTaskId,
        projectId: validProjectId,
        status: 'todo',
      } as any);

      const res = await request(app)
        .post(`/api/projects/${validProjectId}/tasks/${validTaskId}/status`)
        .set('Cookie', cookie)
        .send({ status: 'todo' });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('same_status');
    });

        it('rejects task completion for plain member with 409 open_dependency when blocker is not done (Step 10f)', async () => {
      const cookie = setupAuth(employeeUserId);
      vi.mocked(db.project.findUnique).mockResolvedValue({ id: validProjectId } as any);
      vi.mocked(db.projectMember.findUnique).mockResolvedValue({
        projectId: validProjectId,
        userId: employeeUserId,
        projectRole: 'member',
      } as any);

      vi.mocked(db.task.findUnique).mockResolvedValue({
        id: validTaskId,
        projectId: validProjectId,
        status: 'in_progress',
        assigneeUserId: employeeUserId,
      } as any);

      vi.mocked(db.taskDependency.findMany).mockResolvedValue([
        {
          taskId: validTaskId,
          dependsOnTaskId: otherTaskId,
          dependsOnTask: { id: otherTaskId, status: 'in_progress' },
        },
      ] as any);

      const res = await request(app)
        .post(`/api/projects/${validProjectId}/tasks/${validTaskId}/status`)
        .set('Cookie', cookie)
        .send({ status: 'done' });

      expect(res.status).toBe(409);
      expect(res.body.error).toBe('open_dependency');
      expect(db.task.updateMany).not.toHaveBeenCalled();
    });

it('returns warnings array with open_dependency and open_subtasks when completed with blockers (Amendment 10)', async () => {
      const cookie = setupAuth(pmUserId);
      vi.mocked(db.project.findUnique).mockResolvedValue({ id: validProjectId } as any);
      vi.mocked(db.projectMember.findUnique).mockResolvedValue({
        projectId: validProjectId,
        userId: pmUserId,
        projectRole: 'manager',
      } as any);

      vi.mocked(db.task.findUnique).mockResolvedValue({
        id: validTaskId,
        projectId: validProjectId,
        status: 'in_progress',
      } as any);

      // Task depends on blockerTask (which is still in_progress)
      vi.mocked(db.taskDependency.findMany).mockResolvedValue([
        {
          taskId: validTaskId,
          dependsOnTaskId: otherTaskId,
          dependsOnTask: { id: otherTaskId, status: 'in_progress' },
        },
      ] as any);

      // Task has unfinished subtask
      vi.mocked(db.task.findMany).mockResolvedValue([
        { id: 'subtask-1', status: 'todo' },
      ] as any);

      vi.mocked(db.task.updateMany).mockResolvedValue({ count: 1 } as any);

      const res = await request(app)
        .post(`/api/projects/${validProjectId}/tasks/${validTaskId}/status`)
        .set('Cookie', cookie)
        .send({ status: 'done' });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('done');
      expect(res.body.warnings).toContain('open_dependency');
      expect(res.body.warnings).toContain('open_subtasks');
    });

    it('returns 409 conflict_retry when status was concurrently changed', async () => {
      const cookie = setupAuth(pmUserId);
      vi.mocked(db.project.findUnique).mockResolvedValue({ id: validProjectId } as any);
      vi.mocked(db.projectMember.findUnique).mockResolvedValue({
        projectId: validProjectId,
        userId: pmUserId,
        projectRole: 'manager',
      } as any);

      vi.mocked(db.task.findUnique).mockResolvedValue({
        id: validTaskId,
        projectId: validProjectId,
        status: 'todo',
      } as any);

      vi.mocked(db.task.updateMany).mockResolvedValue({ count: 0 } as any); // 0 rows updated

      const res = await request(app)
        .post(`/api/projects/${validProjectId}/tasks/${validTaskId}/status`)
        .set('Cookie', cookie)
        .send({ status: 'in_progress' });

      expect(res.status).toBe(409);
      expect(res.body.error).toBe('conflict_retry');
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 6. Dependencies & Cycle Prevention
  // ───────────────────────────────────────────────────────────────────────────
  describe('6. Task Dependencies & Graph Invariants', () => {
    it('refuses self-dependency with 400 self_dependency', async () => {
      const cookie = setupAuth(pmUserId);
      vi.mocked(db.project.findUnique).mockResolvedValue({ id: validProjectId } as any);
      vi.mocked(db.projectMember.findUnique).mockResolvedValue({
        projectId: validProjectId,
        userId: pmUserId,
        projectRole: 'manager',
      } as any);

      vi.mocked(db.task.findUnique).mockResolvedValue({
        id: validTaskId,
        projectId: validProjectId,
      } as any);

      const res = await request(app)
        .post(`/api/projects/${validProjectId}/tasks/${validTaskId}/dependencies`)
        .set('Cookie', cookie)
        .send({ dependsOnTaskId: validTaskId });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('self_dependency');
    });

    it('detects dependency cycle and refuses with 400 dependency_cycle (Amendment 3)', async () => {
      const cookie = setupAuth(pmUserId);
      vi.mocked(db.project.findUnique).mockResolvedValue({ id: validProjectId } as any);
      vi.mocked(db.projectMember.findUnique).mockResolvedValue({
        projectId: validProjectId,
        userId: pmUserId,
        projectRole: 'manager',
      } as any);

      vi.mocked(db.task.findUnique)
        .mockResolvedValueOnce({ id: validTaskId, projectId: validProjectId } as any) // task A
        .mockResolvedValueOnce({ id: otherTaskId, projectId: validProjectId } as any); // task B

      // Task B already depends on Task A
      vi.mocked(db.taskDependency.findMany).mockResolvedValueOnce([
        { taskId: otherTaskId, dependsOnTaskId: validTaskId },
      ] as any);

      // Attempting to make Task A depend on Task B (creating A -> B -> A cycle)
      const res = await request(app)
        .post(`/api/projects/${validProjectId}/tasks/${validTaskId}/dependencies`)
        .set('Cookie', cookie)
        .send({ dependsOnTaskId: otherTaskId });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('dependency_cycle');
    });

    it('catches Prisma P2002 on duplicate dependency and returns 409 duplicate_dependency', async () => {
      const cookie = setupAuth(pmUserId);
      vi.mocked(db.project.findUnique).mockResolvedValue({ id: validProjectId } as any);
      vi.mocked(db.projectMember.findUnique).mockResolvedValue({
        projectId: validProjectId,
        userId: pmUserId,
        projectRole: 'manager',
      } as any);

      vi.mocked(db.task.findUnique)
        .mockResolvedValueOnce({ id: validTaskId, projectId: validProjectId } as any)
        .mockResolvedValueOnce({ id: otherTaskId, projectId: validProjectId } as any);

      vi.mocked(db.taskDependency.findMany).mockResolvedValue([]); // no cycle

      const p2002Err: any = new Error('Unique constraint failed');
      p2002Err.code = 'P2002';
      vi.mocked(db.taskDependency.create).mockRejectedValue(p2002Err);

      const res = await request(app)
        .post(`/api/projects/${validProjectId}/tasks/${validTaskId}/dependencies`)
        .set('Cookie', cookie)
        .send({ dependsOnTaskId: otherTaskId });

      expect(res.status).toBe(409);
      expect(res.body.error).toBe('duplicate_dependency');
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 7. Milestones Lifecycle
  // ───────────────────────────────────────────────────────────────────────────
  describe('7. Milestones Lifecycle', () => {
    it('creates and lists milestones for project members', async () => {
      const cookie = setupAuth(pmUserId);
      vi.mocked(db.project.findUnique).mockResolvedValue({ id: validProjectId } as any);
      vi.mocked(db.projectMember.findUnique).mockResolvedValue({
        projectId: validProjectId,
        userId: pmUserId,
        projectRole: 'manager',
      } as any);

      vi.mocked(db.milestone.create).mockResolvedValue({
        id: validMilestoneId,
        projectId: validProjectId,
        name: 'Sprint 1 Delivery',
        dueDate: new Date('2026-11-30'),
        completedAt: null,
      } as any);

      const resCreate = await request(app)
        .post(`/api/projects/${validProjectId}/milestones`)
        .set('Cookie', cookie)
        .send({ name: 'Sprint 1 Delivery', dueDate: '2026-11-30' });

      expect(resCreate.status).toBe(201);
      expect(resCreate.body.name).toBe('Sprint 1 Delivery');

      vi.mocked(db.milestone.findMany).mockResolvedValue([
        { id: validMilestoneId, name: 'Sprint 1 Delivery' },
      ] as any);

      const resList = await request(app)
        .get(`/api/projects/${validProjectId}/milestones`)
        .set('Cookie', cookie);

      expect(resList.status).toBe(200);
      expect(resList.body).toHaveLength(1);
    });

    it('completing milestone twice returns 409 already_completed (Amendment 7 & 13)', async () => {
      const cookie = setupAuth(pmUserId);
      vi.mocked(db.project.findUnique).mockResolvedValue({ id: validProjectId } as any);
      vi.mocked(db.projectMember.findUnique).mockResolvedValue({
        projectId: validProjectId,
        userId: pmUserId,
        projectRole: 'manager',
      } as any);

      vi.mocked(db.milestone.findUnique).mockResolvedValue({
        id: validMilestoneId,
        projectId: validProjectId,
      } as any);

      // First completion: 1 row updated
      vi.mocked(db.milestone.updateMany).mockResolvedValueOnce({ count: 1 } as any);
      const res1 = await request(app)
        .post(`/api/projects/${validProjectId}/milestones/${validMilestoneId}/complete`)
        .set('Cookie', cookie);
      expect(res1.status).toBe(200);

      // Second completion: 0 rows updated
      vi.mocked(db.milestone.updateMany).mockResolvedValueOnce({ count: 0 } as any);
      const res2 = await request(app)
        .post(`/api/projects/${validProjectId}/milestones/${validMilestoneId}/complete`)
        .set('Cookie', cookie);
      expect(res2.status).toBe(409);
      expect(res2.body.error).toBe('already_completed');
    });

    it('reopening milestone twice returns 409 already_open', async () => {
      const cookie = setupAuth(pmUserId);
      vi.mocked(db.project.findUnique).mockResolvedValue({ id: validProjectId } as any);
      vi.mocked(db.projectMember.findUnique).mockResolvedValue({
        projectId: validProjectId,
        userId: pmUserId,
        projectRole: 'manager',
      } as any);

      vi.mocked(db.milestone.findUnique).mockResolvedValue({
        id: validMilestoneId,
        projectId: validProjectId,
      } as any);

      vi.mocked(db.milestone.updateMany).mockResolvedValueOnce({ count: 0 } as any);
      const res = await request(app)
        .post(`/api/projects/${validProjectId}/milestones/${validMilestoneId}/reopen`)
        .set('Cookie', cookie);

      expect(res.status).toBe(409);
      expect(res.body.error).toBe('already_open');
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 8. Comments
  // ───────────────────────────────────────────────────────────────────────────
  describe('8. Comments System', () => {
    it('allows project member to add comment, omitting body from audit log', async () => {
      const cookie = setupAuth(employeeUserId);
      vi.mocked(db.project.findUnique).mockResolvedValue({ id: validProjectId } as any);
      vi.mocked(db.projectMember.findUnique).mockResolvedValue({
        projectId: validProjectId,
        userId: employeeUserId,
        projectRole: 'member',
      } as any);

      vi.mocked(db.task.findUnique).mockResolvedValue({
        id: validTaskId,
        projectId: validProjectId,
      } as any);

      vi.mocked(db.comment.create).mockResolvedValue({
        id: validCommentId,
        taskId: validTaskId,
        authorUserId: employeeUserId,
        body: 'Investigated the database lock issue.',
        authorUser: { id: employeeUserId, displayName: 'Dev', username: 'emp_dev' },
      } as any);

      const res = await request(app)
        .post(`/api/projects/${validProjectId}/tasks/${validTaskId}/comments`)
        .set('Cookie', cookie)
        .send({ body: 'Investigated the database lock issue.' });

      expect(res.status).toBe(201);
      expect(res.body.body).toBe('Investigated the database lock issue.');

      // Check audit snapshot does NOT contain comment body
      expect(db.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: 'comment.created',
            afterSnapshot: { taskId: validTaskId }, // body omitted
          }),
        }),
      );
    });

    it('refuses project viewer from adding comments (403 forbidden)', async () => {
      const cookie = setupAuth(viewerUserId);
      vi.mocked(db.project.findUnique).mockResolvedValue({ id: validProjectId } as any);
      vi.mocked(db.projectMember.findUnique).mockResolvedValue({
        projectId: validProjectId,
        userId: viewerUserId,
        projectRole: 'viewer',
      } as any);

      const res = await request(app)
        .post(`/api/projects/${validProjectId}/tasks/${validTaskId}/comments`)
        .set('Cookie', cookie)
        .send({ body: 'Viewer comment' });

      expect(res.status).toBe(403);
      expect(res.body.error).toBe('forbidden');
    });

    it('only allows the author to edit their own comment (Amendment 8 & 13)', async () => {
      const cookie = setupAuth(otherEmpUserId); // other employee
      vi.mocked(db.project.findUnique).mockResolvedValue({ id: validProjectId } as any);
      vi.mocked(db.projectMember.findUnique).mockResolvedValue({
        projectId: validProjectId,
        userId: otherEmpUserId,
        projectRole: 'member',
      } as any);

      vi.mocked(db.task.findUnique).mockResolvedValue({ id: validTaskId, projectId: validProjectId } as any);

      // Comment authored by employeeUserId (not otherEmpUserId)
      vi.mocked(db.comment.findUnique).mockResolvedValue({
        id: validCommentId,
        taskId: validTaskId,
        authorUserId: employeeUserId,
      } as any);

      const resForbidden = await request(app)
        .patch(`/api/projects/${validProjectId}/tasks/${validTaskId}/comments/${validCommentId}`)
        .set('Cookie', cookie)
        .send({ body: 'Malicious edit attempt' });

      expect(resForbidden.status).toBe(403);
      expect(resForbidden.body.error).toBe('forbidden');

      // Now author edits comment: succeeds
      const authorCookie = setupAuth(employeeUserId);
      vi.mocked(db.comment.update).mockResolvedValue({
        id: validCommentId,
        body: 'Updated comment text',
      } as any);

      const resSuccess = await request(app)
        .patch(`/api/projects/${validProjectId}/tasks/${validTaskId}/comments/${validCommentId}`)
        .set('Cookie', authorCookie)
        .send({ body: 'Updated comment text' });

      expect(resSuccess.status).toBe(200);
      expect(db.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: 'comment.edited',
            afterSnapshot: { taskId: validTaskId },
          }),
        }),
      );
    });

    it('explicitly selects author fields and never returns passwordHash or systemRole to non-admins', async () => {
      const cookie = setupAuth(employeeUserId);
      vi.mocked(db.project.findUnique).mockResolvedValue({ id: validProjectId } as any);
      vi.mocked(db.projectMember.findUnique).mockResolvedValue({
        projectId: validProjectId,
        userId: employeeUserId,
        projectRole: 'member',
      } as any);

      vi.mocked(db.task.findUnique).mockResolvedValue({ id: validTaskId, projectId: validProjectId } as any);

      vi.mocked(db.comment.findMany).mockResolvedValue([
        {
          id: validCommentId,
          body: 'Hello',
          authorUser: {
            id: pmUserId,
            displayName: 'PM Lead',
            username: 'pm_lead',
          },
        },
      ] as any);

      const res = await request(app)
        .get(`/api/projects/${validProjectId}/tasks/${validTaskId}/comments`)
        .set('Cookie', cookie);

      expect(res.status).toBe(200);
      expect(res.body.items[0].authorUser.passwordHash).toBeUndefined();
      expect(res.body.items[0].authorUser.systemRole).toBeUndefined();
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 8. Rejection of invalid status values in_review and canceled (Part A.3)
  // ───────────────────────────────────────────────────────────────────────────
  describe('8. Part A.3: Rejection of invalid status values in_review and canceled', () => {
    it('refuses in_review and canceled on status route with 400 (mock-based)', async () => {
      const cookie = setupAuth(pmUserId);
      vi.mocked(db.project.findUnique).mockResolvedValue({ id: validProjectId } as any);
      vi.mocked(db.projectMember.findUnique).mockResolvedValue({
        projectId: validProjectId,
        userId: pmUserId,
        projectRole: 'manager',
      } as any);

      vi.mocked(db.task.findUnique).mockResolvedValue({
        id: validTaskId,
        projectId: validProjectId,
        status: 'todo',
      } as any);

      const resReview = await request(app)
        .post(`/api/projects/${validProjectId}/tasks/${validTaskId}/status`)
        .set('Cookie', cookie)
        .send({ status: 'in_review' });

      expect(resReview.status).toBe(400);

      const resCanceled = await request(app)
        .post(`/api/projects/${validProjectId}/tasks/${validTaskId}/status`)
        .set('Cookie', cookie)
        .send({ status: 'canceled' });

      expect(resCanceled.status).toBe(400);
    });

    it('refuses in_review and canceled on list filter with 400 (mock-based)', async () => {
      const cookie = setupAuth(pmUserId);
      vi.mocked(db.project.findUnique).mockResolvedValue({ id: validProjectId } as any);
      vi.mocked(db.projectMember.findUnique).mockResolvedValue({
        projectId: validProjectId,
        userId: pmUserId,
        projectRole: 'manager',
      } as any);

      const resReview = await request(app)
        .get(`/api/projects/${validProjectId}/tasks?status=in_review`)
        .set('Cookie', cookie);

      expect(resReview.status).toBe(400);

      const resCanceled = await request(app)
        .get(`/api/projects/${validProjectId}/tasks?status=canceled`)
        .set('Cookie', cookie);

      expect(resCanceled.status).toBe(400);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 9. Viewers (project viewer AND system viewer) get 403 on mutating routes (Part B.1)
  // ───────────────────────────────────────────────────────────────────────────
  describe('9. Part B.1: Viewers 403 on all mutating operations', () => {
    it('refuses project viewer from PATCH task with 403 (mock-based)', async () => {
      const cookie = setupAuth(employeeUserId);
      vi.mocked(db.project.findUnique).mockResolvedValue({ id: validProjectId } as any);
      vi.mocked(db.projectMember.findUnique).mockResolvedValue({
        projectId: validProjectId,
        userId: employeeUserId,
        projectRole: 'viewer',
      } as any);
      vi.mocked(db.task.findUnique).mockResolvedValue({ id: validTaskId, projectId: validProjectId } as any);

      const res = await request(app)
        .patch(`/api/projects/${validProjectId}/tasks/${validTaskId}`)
        .set('Cookie', cookie)
        .send({ title: 'New Title' });

      expect(res.status).toBe(403);
    });

    it('refuses project viewer from task status change with 403 (mock-based)', async () => {
      const cookie = setupAuth(employeeUserId);
      vi.mocked(db.project.findUnique).mockResolvedValue({ id: validProjectId } as any);
      vi.mocked(db.projectMember.findUnique).mockResolvedValue({
        projectId: validProjectId,
        userId: employeeUserId,
        projectRole: 'viewer',
      } as any);
      vi.mocked(db.task.findUnique).mockResolvedValue({ id: validTaskId, projectId: validProjectId, status: 'todo' } as any);

      const res = await request(app)
        .post(`/api/projects/${validProjectId}/tasks/${validTaskId}/status`)
        .set('Cookie', cookie)
        .send({ status: 'in_progress' });

      expect(res.status).toBe(403);
    });

    it('refuses project viewer from adding task dependency with 403 (mock-based)', async () => {
      const cookie = setupAuth(employeeUserId);
      vi.mocked(db.project.findUnique).mockResolvedValue({ id: validProjectId } as any);
      vi.mocked(db.projectMember.findUnique).mockResolvedValue({
        projectId: validProjectId,
        userId: employeeUserId,
        projectRole: 'viewer',
      } as any);
      vi.mocked(db.task.findUnique).mockResolvedValue({ id: validTaskId, projectId: validProjectId } as any);

      const res = await request(app)
        .post(`/api/projects/${validProjectId}/tasks/${validTaskId}/dependencies`)
        .set('Cookie', cookie)
        .send({ dependsOnTaskId: otherTaskId });

      expect(res.status).toBe(403);
    });

    it('refuses project viewer from removing task dependency with 403 (mock-based)', async () => {
      const cookie = setupAuth(employeeUserId);
      vi.mocked(db.project.findUnique).mockResolvedValue({ id: validProjectId } as any);
      vi.mocked(db.projectMember.findUnique).mockResolvedValue({
        projectId: validProjectId,
        userId: employeeUserId,
        projectRole: 'viewer',
      } as any);
      vi.mocked(db.task.findUnique).mockResolvedValue({ id: validTaskId, projectId: validProjectId } as any);

      const res = await request(app)
        .delete(`/api/projects/${validProjectId}/tasks/${validTaskId}/dependencies/${otherTaskId}`)
        .set('Cookie', cookie);

      expect(res.status).toBe(403);
    });

    it('refuses project viewer from create, patch, complete, reopen milestone with 403 (mock-based)', async () => {
      const cookie = setupAuth(employeeUserId);
      vi.mocked(db.project.findUnique).mockResolvedValue({ id: validProjectId } as any);
      vi.mocked(db.projectMember.findUnique).mockResolvedValue({
        projectId: validProjectId,
        userId: employeeUserId,
        projectRole: 'viewer',
      } as any);
      vi.mocked(db.milestone.findUnique).mockResolvedValue({ id: validMilestoneId, projectId: validProjectId } as any);

      const resCreate = await request(app)
        .post(`/api/projects/${validProjectId}/milestones`)
        .set('Cookie', cookie)
        .send({ name: 'Sprint 1' });
      expect(resCreate.status).toBe(403);

      const resPatch = await request(app)
        .patch(`/api/projects/${validProjectId}/milestones/${validMilestoneId}`)
        .set('Cookie', cookie)
        .send({ name: 'Sprint 1 Modified' });
      expect(resPatch.status).toBe(403);

      const resComplete = await request(app)
        .post(`/api/projects/${validProjectId}/milestones/${validMilestoneId}/complete`)
        .set('Cookie', cookie);
      expect(resComplete.status).toBe(403);

      const resReopen = await request(app)
        .post(`/api/projects/${validProjectId}/milestones/${validMilestoneId}/reopen`)
        .set('Cookie', cookie);
      expect(resReopen.status).toBe(403);
    });

    it('refuses project viewer from editing a comment with 403 (mock-based)', async () => {
      const cookie = setupAuth(employeeUserId);
      vi.mocked(db.project.findUnique).mockResolvedValue({ id: validProjectId } as any);
      vi.mocked(db.projectMember.findUnique).mockResolvedValue({
        projectId: validProjectId,
        userId: employeeUserId,
        projectRole: 'viewer',
      } as any);
      vi.mocked(db.task.findUnique).mockResolvedValue({ id: validTaskId, projectId: validProjectId } as any);
      vi.mocked(db.comment.findUnique).mockResolvedValue({
        id: validCommentId,
        taskId: validTaskId,
        authorUserId: employeeUserId,
      } as any);

      const res = await request(app)
        .patch(`/api/projects/${validProjectId}/tasks/${validTaskId}/comments/${validCommentId}`)
        .set('Cookie', cookie)
        .send({ body: 'New comment text' });

      expect(res.status).toBe(403);
    });

    it('refuses system viewer from mutating tasks, status, dependencies, milestones, comments with 403 (mock-based)', async () => {
      const cookie = setupAuth(viewerUserId);

      const resPatch = await request(app)
        .patch(`/api/projects/${validProjectId}/tasks/${validTaskId}`)
        .set('Cookie', cookie)
        .send({ title: 'New Title' });
      expect(resPatch.status).toBe(403);

      const resStatus = await request(app)
        .post(`/api/projects/${validProjectId}/tasks/${validTaskId}/status`)
        .set('Cookie', cookie)
        .send({ status: 'done' });
      expect(resStatus.status).toBe(403);

      const resDepAdd = await request(app)
        .post(`/api/projects/${validProjectId}/tasks/${validTaskId}/dependencies`)
        .set('Cookie', cookie)
        .send({ dependsOnTaskId: otherTaskId });
      expect(resDepAdd.status).toBe(403);

      const resDepDel = await request(app)
        .delete(`/api/projects/${validProjectId}/tasks/${validTaskId}/dependencies/${otherTaskId}`)
        .set('Cookie', cookie);
      expect(resDepDel.status).toBe(403);

      const resMilePost = await request(app)
        .post(`/api/projects/${validProjectId}/milestones`)
        .set('Cookie', cookie)
        .send({ name: 'Sprint M' });
      expect(resMilePost.status).toBe(403);

      const resMilePatch = await request(app)
        .patch(`/api/projects/${validProjectId}/milestones/${validMilestoneId}`)
        .set('Cookie', cookie)
        .send({ name: 'Sprint M2' });
      expect(resMilePatch.status).toBe(403);

      const resMileComp = await request(app)
        .post(`/api/projects/${validProjectId}/milestones/${validMilestoneId}/complete`)
        .set('Cookie', cookie);
      expect(resMileComp.status).toBe(403);

      const resMileReopen = await request(app)
        .post(`/api/projects/${validProjectId}/milestones/${validMilestoneId}/reopen`)
        .set('Cookie', cookie);
      expect(resMileReopen.status).toBe(403);

      const resComment = await request(app)
        .patch(`/api/projects/${validProjectId}/tasks/${validTaskId}/comments/${validCommentId}`)
        .set('Cookie', cookie)
        .send({ body: 'Updated comment' });
      expect(resComment.status).toBe(403);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 10. Status & Dependency permissions for members (Part B.2 & B.3)
  // ───────────────────────────────────────────────────────────────────────────
  describe('10. Part B.2 & B.3: Member status and dependency authority', () => {
    it('refuses member who is not assignee from changing status (403) and allows assignee (200) (mock-based)', async () => {
      // Member not assignee
      const nonAssigneeCookie = setupAuth(otherEmpUserId);
      vi.mocked(db.project.findUnique).mockResolvedValue({ id: validProjectId } as any);
      vi.mocked(db.projectMember.findUnique).mockResolvedValue({
        projectId: validProjectId,
        userId: otherEmpUserId,
        projectRole: 'member',
      } as any);

      vi.mocked(db.task.findUnique).mockResolvedValue({
        id: validTaskId,
        projectId: validProjectId,
        assigneeUserId: employeeUserId, // assigned to employeeUserId, not otherEmpUserId
        createdByUserId: pmUserId,
        status: 'todo',
      } as any);

      const resForbidden = await request(app)
        .post(`/api/projects/${validProjectId}/tasks/${validTaskId}/status`)
        .set('Cookie', nonAssigneeCookie)
        .send({ status: 'in_progress' });

      expect(resForbidden.status).toBe(403);

      // Assignee member
      const assigneeCookie = setupAuth(employeeUserId);
      vi.mocked(db.projectMember.findUnique).mockResolvedValue({
        projectId: validProjectId,
        userId: employeeUserId,
        projectRole: 'member',
      } as any);

      vi.mocked(db.taskDependency.findMany).mockResolvedValue([]);
      vi.mocked(db.task.findMany).mockResolvedValue([]);
      vi.mocked(db.task.updateMany).mockResolvedValue({ count: 1 } as any);
      
      const resSuccess = await request(app)
        .post(`/api/projects/${validProjectId}/tasks/${validTaskId}/status`)
        .set('Cookie', assigneeCookie)
        .send({ status: 'in_progress' });

      expect(resSuccess.status).toBe(200);
      expect(resSuccess.body.status).toBe('in_progress');
    });

    it('refuses member who is not creator or assignee from adding dependency (403) (mock-based)', async () => {
      const nonAssigneeCookie = setupAuth(otherEmpUserId);
      vi.mocked(db.project.findUnique).mockResolvedValue({ id: validProjectId } as any);
      vi.mocked(db.projectMember.findUnique).mockResolvedValue({
        projectId: validProjectId,
        userId: otherEmpUserId,
        projectRole: 'member',
      } as any);

      vi.mocked(db.task.findUnique).mockResolvedValue({
        id: validTaskId,
        projectId: validProjectId,
        assigneeUserId: employeeUserId,
        createdByUserId: pmUserId,
      } as any);

      const res = await request(app)
        .post(`/api/projects/${validProjectId}/tasks/${validTaskId}/dependencies`)
        .set('Cookie', nonAssigneeCookie)
        .send({ dependsOnTaskId: otherTaskId });

      expect(res.status).toBe(403);
    });

    it('manageDependencies: manager and system_admin allowed on any task (mock-based)', async () => {
      // Manager on another member's task
      const pmCookie = setupAuth(pmUserId);
      vi.mocked(db.project.findUnique).mockResolvedValue({ id: validProjectId } as any);
      vi.mocked(db.projectMember.findUnique).mockResolvedValue({
        projectId: validProjectId,
        userId: pmUserId,
        projectRole: 'manager',
      } as any);

      vi.mocked(db.task.findUnique as any).mockImplementation(async ({ where }: any) => {
        if (where?.id === validTaskId) {
          return { id: validTaskId, projectId: validProjectId, createdByUserId: employeeUserId, assigneeUserId: otherEmpUserId } as any;
        }
        if (where?.id === otherTaskId) {
          return { id: otherTaskId, projectId: validProjectId } as any;
        }
        return null;
      });

      vi.mocked(db.taskDependency.findMany).mockResolvedValue([]);
      vi.mocked(db.taskDependency.create).mockResolvedValue({
        taskId: validTaskId,
        dependsOnTaskId: otherTaskId,
      } as any);

      const resPm = await request(app)
        .post(`/api/projects/${validProjectId}/tasks/${validTaskId}/dependencies`)
        .set('Cookie', pmCookie)
        .send({ dependsOnTaskId: otherTaskId });

      expect(resPm.status).toBe(201);

      // System admin on any task
      const adminCookie = setupAuth(adminUserId);
      const resAdmin = await request(app)
        .post(`/api/projects/${validProjectId}/tasks/${validTaskId}/dependencies`)
        .set('Cookie', adminCookie)
        .send({ dependsOnTaskId: otherTaskId });

      expect(resAdmin.status).toBe(201);
    });

    it('manageDependencies: member allowed on task they created or are assigned to (mock-based)', async () => {
      const empCookie = setupAuth(employeeUserId);
      vi.mocked(db.project.findUnique).mockResolvedValue({ id: validProjectId } as any);
      vi.mocked(db.projectMember.findUnique).mockResolvedValue({
        projectId: validProjectId,
        userId: employeeUserId,
        projectRole: 'member',
      } as any);

      // Case 1: Member created the task
      vi.mocked(db.task.findUnique as any).mockImplementation(async ({ where }: any) => {
        if (where?.id === validTaskId) {
          return { id: validTaskId, projectId: validProjectId, createdByUserId: employeeUserId, assigneeUserId: otherEmpUserId } as any;
        }
        if (where?.id === otherTaskId) {
          return { id: otherTaskId, projectId: validProjectId } as any;
        }
        return null;
      });

      vi.mocked(db.taskDependency.findMany).mockResolvedValue([]);
      vi.mocked(db.taskDependency.create).mockResolvedValue({
        taskId: validTaskId,
        dependsOnTaskId: otherTaskId,
      } as any);

      const resCreated = await request(app)
        .post(`/api/projects/${validProjectId}/tasks/${validTaskId}/dependencies`)
        .set('Cookie', empCookie)
        .send({ dependsOnTaskId: otherTaskId });

      expect(resCreated.status).toBe(201);

      // Case 2: Member is assigned to the task
      vi.mocked(db.task.findUnique as any).mockImplementation(async ({ where }: any) => {
        if (where?.id === validTaskId) {
          return { id: validTaskId, projectId: validProjectId, createdByUserId: pmUserId, assigneeUserId: employeeUserId } as any;
        }
        if (where?.id === otherTaskId) {
          return { id: otherTaskId, projectId: validProjectId } as any;
        }
        return null;
      });

      const resAssigned = await request(app)
        .post(`/api/projects/${validProjectId}/tasks/${validTaskId}/dependencies`)
        .set('Cookie', empCookie)
        .send({ dependsOnTaskId: otherTaskId });

      expect(resAssigned.status).toBe(201);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 11. PATCH task: Strict schema, clearing fields, invalid targets & task.assigned audit (Part B.4)
  // ───────────────────────────────────────────────────────────────────────────
  describe('11. Part B.4: PATCH task strictness, clearing fields and task.assigned audit', () => {
    it('PATCH task: strict schema rejects status, projectId, createdByUserId, parentTaskId and unknown keys (400) (mock-based)', async () => {
      const cookie = setupAuth(pmUserId);
      vi.mocked(db.project.findUnique).mockResolvedValue({ id: validProjectId } as any);
      vi.mocked(db.projectMember.findUnique).mockResolvedValue({
        projectId: validProjectId,
        userId: pmUserId,
        projectRole: 'manager',
      } as any);
      vi.mocked(db.task.findUnique).mockResolvedValue({ id: validTaskId, projectId: validProjectId } as any);

      const resStatus = await request(app)
        .patch(`/api/projects/${validProjectId}/tasks/${validTaskId}`)
        .set('Cookie', cookie)
        .send({ status: 'done' });
      expect(resStatus.status).toBe(400);

      const resProj = await request(app)
        .patch(`/api/projects/${validProjectId}/tasks/${validTaskId}`)
        .set('Cookie', cookie)
        .send({ projectId: validProjectId });
      expect(resProj.status).toBe(400);

      const resCreator = await request(app)
        .patch(`/api/projects/${validProjectId}/tasks/${validTaskId}`)
        .set('Cookie', cookie)
        .send({ createdByUserId: adminUserId });
      expect(resCreator.status).toBe(400);

      const resParent = await request(app)
        .patch(`/api/projects/${validProjectId}/tasks/${validTaskId}`)
        .set('Cookie', cookie)
        .send({ parentTaskId: otherTaskId });
      expect(resParent.status).toBe(400);

      const resUnknown = await request(app)
        .patch(`/api/projects/${validProjectId}/tasks/${validTaskId}`)
        .set('Cookie', cookie)
        .send({ customBogusField: 'bad' });
      expect(resUnknown.status).toBe(400);
    });

    it('PATCH task: empty body returns 400 (mock-based)', async () => {
      const cookie = setupAuth(pmUserId);
      vi.mocked(db.project.findUnique).mockResolvedValue({ id: validProjectId } as any);
      vi.mocked(db.projectMember.findUnique).mockResolvedValue({
        projectId: validProjectId,
        userId: pmUserId,
        projectRole: 'manager',
      } as any);
      vi.mocked(db.task.findUnique).mockResolvedValue({ id: validTaskId, projectId: validProjectId } as any);

      const res = await request(app)
        .patch(`/api/projects/${validProjectId}/tasks/${validTaskId}`)
        .set('Cookie', cookie)
        .send({});

      expect(res.status).toBe(400);
    });

    it('PATCH task: null clears description, dueDate, estimatedHours, assignee and milestone (mock-based)', async () => {
      const cookie = setupAuth(pmUserId);
      vi.mocked(db.project.findUnique).mockResolvedValue({ id: validProjectId } as any);
      vi.mocked(db.projectMember.findUnique).mockResolvedValue({
        projectId: validProjectId,
        userId: pmUserId,
        projectRole: 'manager',
      } as any);

      vi.mocked(db.task.findUnique).mockResolvedValue({
        id: validTaskId,
        projectId: validProjectId,
        description: 'Existing description',
        dueDate: new Date('2026-12-01'),
        estimatedHours: 4,
        assigneeUserId: employeeUserId,
        milestoneId: validMilestoneId,
      } as any);

      vi.mocked(db.task.update as any).mockImplementation(async ({ data }: any) => {
        return {
          id: validTaskId,
          projectId: validProjectId,
          ...data,
        };
      });

      const res = await request(app)
        .patch(`/api/projects/${validProjectId}/tasks/${validTaskId}`)
        .set('Cookie', cookie)
        .send({
          description: null,
          dueDate: null,
          estimatedHours: null,
          assigneeUserId: null,
          milestoneId: null,
        });

      expect(res.status).toBe(200);
      expect(db.task.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            description: null,
            dueDate: null,
            estimatedHours: null,
            assigneeUserId: null,
            milestoneId: null,
          }),
        }),
      );
    });

    it('PATCH task: milestone from another project returns 400 invalid_milestone (mock-based)', async () => {
      const cookie = setupAuth(pmUserId);
      vi.mocked(db.project.findUnique).mockResolvedValue({ id: validProjectId } as any);
      vi.mocked(db.projectMember.findUnique).mockResolvedValue({
        projectId: validProjectId,
        userId: pmUserId,
        projectRole: 'manager',
      } as any);
      vi.mocked(db.task.findUnique).mockResolvedValue({ id: validTaskId, projectId: validProjectId } as any);

      const otherProjectMilestoneId = '39393939-3939-4939-8939-393939393939';
      vi.mocked(db.milestone.findUnique).mockResolvedValue({
        id: otherProjectMilestoneId,
        projectId: otherProjectId, // belongs to otherProjectId
      } as any);

      const res = await request(app)
        .patch(`/api/projects/${validProjectId}/tasks/${validTaskId}`)
        .set('Cookie', cookie)
        .send({ milestoneId: otherProjectMilestoneId });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('invalid_milestone');
    });

    it('PATCH task: changing to an invalid assignee returns 400 invalid_assignee (mock-based)', async () => {
      const cookie = setupAuth(pmUserId);
      vi.mocked(db.project.findUnique).mockResolvedValue({ id: validProjectId } as any);
      vi.mocked(db.projectMember.findUnique).mockResolvedValue({
        projectId: validProjectId,
        userId: pmUserId,
        projectRole: 'manager',
      } as any);
      vi.mocked(db.task.findUnique).mockResolvedValue({ id: validTaskId, projectId: validProjectId } as any);

      const invalidTargetUserId = '99999999-9999-4999-8999-999999999999';
      // User is not a member of the project
      vi.mocked(db.user.findUnique).mockResolvedValue({ id: invalidTargetUserId, isActive: true } as any);
      vi.mocked(db.projectMember.findUnique as any).mockImplementation(async ({ where }: any) => {
        if (where?.projectId_userId?.userId === pmUserId) {
          return { projectId: validProjectId, userId: pmUserId, projectRole: 'manager' } as any;
        }
        return null;
      });

      const res = await request(app)
        .patch(`/api/projects/${validProjectId}/tasks/${validTaskId}`)
        .set('Cookie', cookie)
        .send({ assigneeUserId: invalidTargetUserId });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('invalid_assignee');
    });

    it('PATCH task: changing assignee writes task.assigned audit entry in same transaction (mock-based)', async () => {
      const cookie = setupAuth(pmUserId);
      vi.mocked(db.project.findUnique).mockResolvedValue({ id: validProjectId } as any);
      vi.mocked(db.projectMember.findUnique as any).mockImplementation(async ({ where }: any) => {
        if (where?.projectId_userId?.userId === pmUserId) {
          return { projectId: validProjectId, userId: pmUserId, projectRole: 'manager', user: { isActive: true } } as any;
        }
        if (where?.projectId_userId?.userId === employeeUserId) {
          return { projectId: validProjectId, userId: employeeUserId, projectRole: 'member', user: { isActive: true } } as any;
        }
        return null;
      });

      vi.mocked(db.user.findUnique).mockResolvedValue({ id: employeeUserId, isActive: true } as any);

      vi.mocked(db.task.findUnique).mockResolvedValue({
        id: validTaskId,
        projectId: validProjectId,
        assigneeUserId: null,
      } as any);

      vi.mocked(db.task.update).mockResolvedValue({
        id: validTaskId,
        projectId: validProjectId,
        assigneeUserId: employeeUserId,
      } as any);

      const res = await request(app)
        .patch(`/api/projects/${validProjectId}/tasks/${validTaskId}`)
        .set('Cookie', cookie)
        .send({ assigneeUserId: employeeUserId });

      expect(res.status).toBe(200);
      expect(db.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: 'task.assigned',
            entityId: validTaskId,
            beforeSnapshot: { assigneeUserId: null },
            afterSnapshot: { assigneeUserId: employeeUserId },
          }),
        }),
      );
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 12. Task list: filters, ordering and pagination (Part B.5)
  // ───────────────────────────────────────────────────────────────────────────
  describe('12. Part B.5: Task list filters, ordering and pagination', () => {
    it('Task list: filters by status, assignee, milestone, parentTaskId, and topLevelOnly (mock-based)', async () => {
      const cookie = setupAuth(pmUserId);
      vi.mocked(db.project.findUnique).mockResolvedValue({ id: validProjectId } as any);
      vi.mocked(db.projectMember.findUnique).mockResolvedValue({
        projectId: validProjectId,
        userId: pmUserId,
        projectRole: 'manager',
      } as any);

      vi.mocked(db.task.findMany).mockResolvedValue([]);

      // Test status filter
      await request(app)
        .get(`/api/projects/${validProjectId}/tasks?status=todo`)
        .set('Cookie', cookie);

      expect(db.task.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ projectId: validProjectId, status: 'todo' }),
        }),
      );

      // Test assignee filter
      await request(app)
        .get(`/api/projects/${validProjectId}/tasks?assigneeUserId=${employeeUserId}`)
        .set('Cookie', cookie);

      expect(db.task.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ projectId: validProjectId, assigneeUserId: employeeUserId }),
        }),
      );

      // Test milestone filter
      await request(app)
        .get(`/api/projects/${validProjectId}/tasks?milestoneId=${validMilestoneId}`)
        .set('Cookie', cookie);

      expect(db.task.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ projectId: validProjectId, milestoneId: validMilestoneId }),
        }),
      );

      // Test parentTaskId filter
      await request(app)
        .get(`/api/projects/${validProjectId}/tasks?parentTaskId=${otherTaskId}`)
        .set('Cookie', cookie);

      expect(db.task.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ projectId: validProjectId, parentTaskId: otherTaskId }),
        }),
      );

      // Test topLevelOnly filter
      await request(app)
        .get(`/api/projects/${validProjectId}/tasks?topLevelOnly=true`)
        .set('Cookie', cookie);

      expect(db.task.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ projectId: validProjectId, parentTaskId: null }),
        }),
      );
    });

    it('Task list: orders by createdAt desc then id desc and returns nextCursor and hasMore (mock-based)', async () => {
      const cookie = setupAuth(pmUserId);
      vi.mocked(db.project.findUnique).mockResolvedValue({ id: validProjectId } as any);
      vi.mocked(db.projectMember.findUnique).mockResolvedValue({
        projectId: validProjectId,
        userId: pmUserId,
        projectRole: 'manager',
      } as any);

      // Return 3 items when limit is 2 (indicating hasMore = true)
      vi.mocked(db.task.findMany).mockResolvedValue([
        { id: '11111111-1111-4111-8111-111111111111', title: 'Task 1', createdAt: new Date() },
        { id: '22222222-2222-4222-8222-222222222222', title: 'Task 2', createdAt: new Date() },
        { id: '33333333-3333-4333-8333-333333333333', title: 'Task 3', createdAt: new Date() },
      ] as any);

      const res = await request(app)
        .get(`/api/projects/${validProjectId}/tasks?limit=2`)
        .set('Cookie', cookie);

      expect(res.status).toBe(200);
      expect(db.task.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
          take: 3,
        }),
      );
      expect(res.body.hasMore).toBe(true);
      expect(res.body.items).toHaveLength(2);
      expect(res.body.nextCursor).toBe('22222222-2222-4222-8222-222222222222');
    });

    it('Task list: returns 400 when cursor belongs to another project or does not exist (mock-based)', async () => {
      const cookie = setupAuth(pmUserId);
      vi.mocked(db.project.findUnique).mockResolvedValue({ id: validProjectId } as any);
      vi.mocked(db.projectMember.findUnique).mockResolvedValue({
        projectId: validProjectId,
        userId: pmUserId,
        projectRole: 'manager',
      } as any);

      // Cursor not found in this project
      vi.mocked(db.task.findFirst).mockResolvedValue(null);

      const res = await request(app)
        .get(`/api/projects/${validProjectId}/tasks?cursor=${otherTaskId}`)
        .set('Cookie', cookie);

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('invalid_cursor');
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 13. Task detail: subtasks, bidirectional dependencies, comment count & departed assignee (Part B.6)
  // ───────────────────────────────────────────────────────────────────────────
  describe('13. Part B.6: Task detail with bidirectional dependencies and subtasks', () => {
    it('Task detail: includes subtasks, dependencies in both directions, comment count, and assigneeIsProjectMember false for departed assignee (mock-based)', async () => {
      const cookie = setupAuth(pmUserId);
      vi.mocked(db.project.findUnique).mockResolvedValue({ id: validProjectId } as any);
      vi.mocked(db.projectMember.findUnique as any).mockImplementation(async ({ where }: any) => {
        if (where?.projectId_userId?.userId === pmUserId) {
          return { projectId: validProjectId, userId: pmUserId, projectRole: 'manager' } as any;
        }
        return null; // assignee has left the project
      });

      const departedUserId = '77777777-7777-4777-8777-777777777777';
      vi.mocked(db.task.findUnique).mockResolvedValue({
        id: validTaskId,
        projectId: validProjectId,
        title: 'Main Task',
        assigneeUserId: departedUserId,
        subtasks: [
          { id: 'sub-1', title: 'Subtask 1' },
        ],
        dependencies: [
          { dependsOnTask: { id: otherTaskId, title: 'Prerequisite Blocker', status: 'done' } },
        ],
        dependentOnMe: [
          { task: { id: 'dep-on-me-1', title: 'Dependent Downstream Task', status: 'todo' } },
        ],
        _count: { comments: 5 },
      } as any);

      const res = await request(app)
        .get(`/api/projects/${validProjectId}/tasks/${validTaskId}`)
        .set('Cookie', cookie);

      expect(res.status).toBe(200);
      expect(res.body.subtasks).toHaveLength(1);
      expect(res.body.dependencies).toHaveLength(1);
      expect(res.body.dependentOnMe).toHaveLength(1);
      expect(res.body.commentCount).toBe(5);
      expect(res.body.assigneeIsProjectMember).toBe(false);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 14. Status change audit and open_dependency direction (Part B.7)
  // ───────────────────────────────────────────────────────────────────────────
  describe('14. Part B.7: Status change audit and open_dependency direction', () => {
    it('Status: a valid change succeeds and writes task.status_changed audit entry (mock-based)', async () => {
      const cookie = setupAuth(pmUserId);
      vi.mocked(db.project.findUnique).mockResolvedValue({ id: validProjectId } as any);
      vi.mocked(db.projectMember.findUnique).mockResolvedValue({
        projectId: validProjectId,
        userId: pmUserId,
        projectRole: 'manager',
      } as any);

      vi.mocked(db.task.findUnique).mockResolvedValue({
        id: validTaskId,
        projectId: validProjectId,
        status: 'todo',
      } as any);

      vi.mocked(db.taskDependency.findMany).mockResolvedValue([]);
      vi.mocked(db.task.findMany).mockResolvedValue([]);
      vi.mocked(db.task.updateMany).mockResolvedValue({ count: 1 } as any);
      
      const res = await request(app)
        .post(`/api/projects/${validProjectId}/tasks/${validTaskId}/status`)
        .set('Cookie', cookie)
        .send({ status: 'done' });

      expect(res.status).toBe(200);
      expect(db.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: 'task.status_changed',
            entityId: validTaskId,
            beforeSnapshot: { status: 'todo' },
            afterSnapshot: { status: 'done' },
          }),
        }),
      );
    });

    it('Status: open_dependency looks at tasks THIS task depends on (completing prerequisite must NOT warn about dependent task) (mock-based)', async () => {
      const cookie = setupAuth(pmUserId);
      vi.mocked(db.project.findUnique).mockResolvedValue({ id: validProjectId } as any);
      vi.mocked(db.projectMember.findUnique).mockResolvedValue({
        projectId: validProjectId,
        userId: pmUserId,
        projectRole: 'manager',
      } as any);

      // Case A: Completing Task B (the prerequisite). Task B has NO dependencies of its own.
      vi.mocked(db.task.findUnique).mockResolvedValue({
        id: otherTaskId,
        projectId: validProjectId,
        status: 'in_progress',
      } as any);

      // Task B does not depend on anything
      vi.mocked(db.taskDependency.findMany).mockResolvedValue([]);
      vi.mocked(db.task.findMany).mockResolvedValue([]); // no subtasks
      vi.mocked(db.task.updateMany).mockResolvedValue({ count: 1 } as any);
      
      const resB = await request(app)
        .post(`/api/projects/${validProjectId}/tasks/${otherTaskId}/status`)
        .set('Cookie', cookie)
        .send({ status: 'done' });

      expect(resB.status).toBe(200);
      expect(resB.body.warnings).toEqual([]); // Must NOT warn about Task A!

      // Case B: Completing Task A (which depends on Task B). Task B is in_progress.
      vi.mocked(db.task.findUnique).mockResolvedValue({
        id: validTaskId,
        projectId: validProjectId,
        status: 'in_progress',
      } as any);

      vi.mocked(db.taskDependency.findMany).mockResolvedValue([
        { dependsOnTask: { id: otherTaskId, status: 'in_progress' } } as any,
      ]);

      const resA = await request(app)
        .post(`/api/projects/${validProjectId}/tasks/${validTaskId}/status`)
        .set('Cookie', cookie)
        .send({ status: 'done' });

      expect(resA.status).toBe(200);
      expect(resA.body.warnings).toContain('open_dependency');
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 15. Dependencies: Indirect cycles, depth limits, cross-project IDOR, deletion (Part B.8)
  // ───────────────────────────────────────────────────────────────────────────
  describe('15. Part B.8: Dependencies lifecycle and cycle detection', () => {
    it('Dependencies: cross-project dependsOnTaskId returns 404 (mock-based)', async () => {
      const cookie = setupAuth(pmUserId);
      vi.mocked(db.project.findUnique).mockResolvedValue({ id: validProjectId } as any);
      vi.mocked(db.projectMember.findUnique).mockResolvedValue({
        projectId: validProjectId,
        userId: pmUserId,
        projectRole: 'manager',
      } as any);

      vi.mocked(db.task.findUnique as any).mockImplementation(async ({ where }: any) => {
        if (where?.id === validTaskId) {
          return { id: validTaskId, projectId: validProjectId } as any;
        }
        if (where?.id === otherTaskId) {
          return { id: otherTaskId, projectId: otherProjectId } as any; // belongs to otherProjectId
        }
        return null;
      });

      const res = await request(app)
        .post(`/api/projects/${validProjectId}/tasks/${validTaskId}/dependencies`)
        .set('Cookie', cookie)
        .send({ dependsOnTaskId: otherTaskId });

      expect(res.status).toBe(404);
      expect(res.body.message).toContain('not found');
    });

    it('Dependencies: indirect cycle (A -> B -> C -> A) is refused with 400 dependency_cycle (mock-based)', async () => {
      const cookie = setupAuth(pmUserId);
      vi.mocked(db.project.findUnique).mockResolvedValue({ id: validProjectId } as any);
      vi.mocked(db.projectMember.findUnique).mockResolvedValue({
        projectId: validProjectId,
        userId: pmUserId,
        projectRole: 'manager',
      } as any);

      const taskA = '11111111-1111-4111-8111-111111111111';
      const taskB = '22222222-2222-4222-8222-222222222222';
      const taskC = '33333333-3333-4333-8333-333333333333';

      vi.mocked(db.task.findUnique as any).mockImplementation(async ({ where }: any) => {
        return { id: where.id, projectId: validProjectId } as any;
      });

      // Existing graph: B depends on A, C depends on B
      // Now attempting: A depends on C (which would create cycle A -> C -> B -> A)
      vi.mocked(db.taskDependency.findMany as any).mockImplementation(async ({ where }: any) => {
        if (where.taskId === taskC) {
          return [{ dependsOnTaskId: taskB }] as any;
        }
        if (where.taskId === taskB) {
          return [{ dependsOnTaskId: taskA }] as any;
        }
        return [];
      });

      const res = await request(app)
        .post(`/api/projects/${validProjectId}/tasks/${taskA}/dependencies`)
        .set('Cookie', cookie)
        .send({ dependsOnTaskId: taskC });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('dependency_cycle');
    });

    it('Dependencies: depth limit of 50 is rejected with 400 dependency_cycle (mock-based)', async () => {
      const cookie = setupAuth(pmUserId);
      vi.mocked(db.project.findUnique).mockResolvedValue({ id: validProjectId } as any);
      vi.mocked(db.projectMember.findUnique).mockResolvedValue({
        projectId: validProjectId,
        userId: pmUserId,
        projectRole: 'manager',
      } as any);

      vi.mocked(db.task.findUnique as any).mockImplementation(async ({ where }: any) => {
        return { id: where.id, projectId: validProjectId } as any;
      });

      // Chain that exceeds 50 hops: each hop returns a fresh unvisited task ID
      let hopCount = 0;
      vi.mocked(db.taskDependency.findMany as any).mockImplementation(async () => {
        hopCount++;
        const nextId = '00000000-0000-4000-8000-' + String(hopCount + 10).padStart(12, '0');
        return [{ dependsOnTaskId: nextId }] as any;
      });

      const res = await request(app)
        .post(`/api/projects/${validProjectId}/tasks/${validTaskId}/dependencies`)
        .set('Cookie', cookie)
        .send({ dependsOnTaskId: '00000000-0000-4000-8000-000000000001' });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('dependency_cycle');
    });

    it('Dependencies: delete works and deleting a missing dependency returns 404 (mock-based)', async () => {
      const cookie = setupAuth(pmUserId);
      vi.mocked(db.project.findUnique).mockResolvedValue({ id: validProjectId } as any);
      vi.mocked(db.projectMember.findUnique).mockResolvedValue({
        projectId: validProjectId,
        userId: pmUserId,
        projectRole: 'manager',
      } as any);

      vi.mocked(db.task.findUnique as any).mockImplementation(async ({ where }: any) => {
        if (where?.id === validTaskId || where?.id === otherTaskId) {
          return { id: where.id, projectId: validProjectId } as any;
        }
        return null;
      });

      // Case 1: Dependency missing returns 404
      vi.mocked(db.taskDependency.findUnique).mockResolvedValue(null);

      const resMissing = await request(app)
        .delete(`/api/projects/${validProjectId}/tasks/${validTaskId}/dependencies/${otherTaskId}`)
        .set('Cookie', cookie);

      expect(resMissing.status).toBe(404);

      // Case 2: Dependency exists and delete succeeds
      vi.mocked(db.taskDependency.findUnique).mockResolvedValue({
        taskId: validTaskId,
        dependsOnTaskId: otherTaskId,
      } as any);
      vi.mocked(db.taskDependency.delete).mockResolvedValue({} as any);

      const resSuccess = await request(app)
        .delete(`/api/projects/${validProjectId}/tasks/${validTaskId}/dependencies/${otherTaskId}`)
        .set('Cookie', cookie);

      expect(resSuccess.status).toBe(200);
      expect(resSuccess.body.success).toBe(true);
      expect(db.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: 'task_dependency.removed',
            entityId: validTaskId,
            beforeSnapshot: { dependsOnTaskId: otherTaskId },
          }),
        }),
      );
    });

    it('Dependencies: taskId from another project returns 404 on dependency operations (mock-based)', async () => {
      const cookie = setupAuth(pmUserId);
      vi.mocked(db.project.findUnique).mockResolvedValue({ id: validProjectId } as any);
      vi.mocked(db.projectMember.findUnique).mockResolvedValue({
        projectId: validProjectId,
        userId: pmUserId,
        projectRole: 'manager',
      } as any);

      // Task belongs to otherProjectId
      vi.mocked(db.task.findUnique).mockResolvedValue({
        id: validTaskId,
        projectId: otherProjectId,
      } as any);

      const resPost = await request(app)
        .post(`/api/projects/${validProjectId}/tasks/${validTaskId}/dependencies`)
        .set('Cookie', cookie)
        .send({ dependsOnTaskId: otherTaskId });
      expect(resPost.status).toBe(404);

      const resDelete = await request(app)
        .delete(`/api/projects/${validProjectId}/tasks/${validTaskId}/dependencies/${otherTaskId}`)
        .set('Cookie', cookie);
      expect(resDelete.status).toBe(404);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 16. Milestones: RBAC, complete/reopen lifecycle, and cross-project 404 (Part B.9)
  // ───────────────────────────────────────────────────────────────────────────
  describe('16. Part B.9: Milestones lifecycle and cross-project isolation', () => {
    it('Milestones: member without manager role gets 403 on create, patch, complete, reopen (mock-based)', async () => {
      const cookie = setupAuth(employeeUserId);
      vi.mocked(db.project.findUnique).mockResolvedValue({ id: validProjectId } as any);
      vi.mocked(db.projectMember.findUnique).mockResolvedValue({
        projectId: validProjectId,
        userId: employeeUserId,
        projectRole: 'member',
      } as any);

      vi.mocked(db.milestone.findUnique).mockResolvedValue({ id: validMilestoneId, projectId: validProjectId } as any);

      const resCreate = await request(app)
        .post(`/api/projects/${validProjectId}/milestones`)
        .set('Cookie', cookie)
        .send({ name: 'Sprint' });
      expect(resCreate.status).toBe(403);

      const resPatch = await request(app)
        .patch(`/api/projects/${validProjectId}/milestones/${validMilestoneId}`)
        .set('Cookie', cookie)
        .send({ name: 'Sprint New' });
      expect(resPatch.status).toBe(403);

      const resComplete = await request(app)
        .post(`/api/projects/${validProjectId}/milestones/${validMilestoneId}/complete`)
        .set('Cookie', cookie);
      expect(resComplete.status).toBe(403);

      const resReopen = await request(app)
        .post(`/api/projects/${validProjectId}/milestones/${validMilestoneId}/reopen`)
        .set('Cookie', cookie);
      expect(resReopen.status).toBe(403);
    });

    it('Milestones: patch works and writes milestone.updated audit entry (mock-based)', async () => {
      const cookie = setupAuth(pmUserId);
      vi.mocked(db.project.findUnique).mockResolvedValue({ id: validProjectId } as any);
      vi.mocked(db.projectMember.findUnique).mockResolvedValue({
        projectId: validProjectId,
        userId: pmUserId,
        projectRole: 'manager',
      } as any);

      vi.mocked(db.milestone.findUnique).mockResolvedValue({
        id: validMilestoneId,
        projectId: validProjectId,
        name: 'Old Name',
        dueDate: null,
      } as any);

      vi.mocked(db.milestone.update).mockResolvedValue({
        id: validMilestoneId,
        projectId: validProjectId,
        name: 'Updated Name',
        dueDate: null,
      } as any);

      const res = await request(app)
        .patch(`/api/projects/${validProjectId}/milestones/${validMilestoneId}`)
        .set('Cookie', cookie)
        .send({ name: 'Updated Name' });

      expect(res.status).toBe(200);
      expect(db.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: 'milestone.updated',
            entityId: validMilestoneId,
            beforeSnapshot: expect.objectContaining({ name: 'Old Name' }),
            afterSnapshot: expect.objectContaining({ name: 'Updated Name' }),
          }),
        }),
      );
    });

    it('Milestones: complete sets completedAt and writes exactly one milestone.completed entry (mock-based)', async () => {
      const cookie = setupAuth(pmUserId);
      vi.mocked(db.project.findUnique).mockResolvedValue({ id: validProjectId } as any);
      vi.mocked(db.projectMember.findUnique).mockResolvedValue({
        projectId: validProjectId,
        userId: pmUserId,
        projectRole: 'manager',
      } as any);

      vi.mocked(db.milestone.findUnique).mockResolvedValue({
        id: validMilestoneId,
        projectId: validProjectId,
        name: 'Sprint 1',
        completedAt: null,
      } as any);

      vi.mocked(db.milestone.updateMany).mockResolvedValue({ count: 1 } as any);

      const res = await request(app)
        .post(`/api/projects/${validProjectId}/milestones/${validMilestoneId}/complete`)
        .set('Cookie', cookie);

      expect(res.status).toBe(200);
      expect(res.body.completedAt).toBeDefined();
      expect(db.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: 'milestone.completed',
            entityId: validMilestoneId,
          }),
        }),
      );
    });

    it('Milestones: reopen clears completedAt to null and writes milestone.reopened (mock-based)', async () => {
      const cookie = setupAuth(pmUserId);
      vi.mocked(db.project.findUnique).mockResolvedValue({ id: validProjectId } as any);
      vi.mocked(db.projectMember.findUnique).mockResolvedValue({
        projectId: validProjectId,
        userId: pmUserId,
        projectRole: 'manager',
      } as any);

      vi.mocked(db.milestone.findUnique).mockResolvedValue({
        id: validMilestoneId,
        projectId: validProjectId,
        name: 'Sprint 1',
        completedAt: new Date(),
      } as any);

      vi.mocked(db.milestone.updateMany).mockResolvedValue({ count: 1 } as any);

      const res = await request(app)
        .post(`/api/projects/${validProjectId}/milestones/${validMilestoneId}/reopen`)
        .set('Cookie', cookie);

      expect(res.status).toBe(200);
      expect(res.body.completedAt).toBeNull();
      expect(db.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: 'milestone.reopened',
            entityId: validMilestoneId,
          }),
        }),
      );
    });

    it('Milestones: milestoneId from another project returns 404 (mock-based)', async () => {
      const cookie = setupAuth(pmUserId);
      vi.mocked(db.project.findUnique).mockResolvedValue({ id: validProjectId } as any);
      vi.mocked(db.projectMember.findUnique).mockResolvedValue({
        projectId: validProjectId,
        userId: pmUserId,
        projectRole: 'manager',
      } as any);

      vi.mocked(db.milestone.findUnique).mockResolvedValue({
        id: validMilestoneId,
        projectId: otherProjectId, // other project
      } as any);

      const resPatch = await request(app)
        .patch(`/api/projects/${validProjectId}/milestones/${validMilestoneId}`)
        .set('Cookie', cookie)
        .send({ name: 'New' });
      expect(resPatch.status).toBe(404);

      const resComplete = await request(app)
        .post(`/api/projects/${validProjectId}/milestones/${validMilestoneId}/complete`)
        .set('Cookie', cookie);
      expect(resComplete.status).toBe(404);

      const resReopen = await request(app)
        .post(`/api/projects/${validProjectId}/milestones/${validMilestoneId}/reopen`)
        .set('Cookie', cookie);
      expect(resReopen.status).toBe(404);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 17. Comments: Pagination, IDOR, author edits, and input boundaries (Part B.10)
  // ───────────────────────────────────────────────────────────────────────────
  describe('17. Part B.10: Comments pagination, IDOR, author editing and boundaries', () => {
    it('Comments: list is oldest first and paginated with nextCursor (mock-based)', async () => {
      const cookie = setupAuth(pmUserId);
      vi.mocked(db.project.findUnique).mockResolvedValue({ id: validProjectId } as any);
      vi.mocked(db.projectMember.findUnique).mockResolvedValue({
        projectId: validProjectId,
        userId: pmUserId,
        projectRole: 'manager',
      } as any);
      vi.mocked(db.task.findUnique).mockResolvedValue({ id: validTaskId, projectId: validProjectId } as any);

      vi.mocked(db.comment.findMany).mockResolvedValue([
        { id: 'c1', body: 'First comment', createdAt: new Date('2026-01-01'), authorUser: { id: 'u1' } },
        { id: 'c2', body: 'Second comment', createdAt: new Date('2026-01-02'), authorUser: { id: 'u2' } },
        { id: 'c3', body: 'Third comment', createdAt: new Date('2026-01-03'), authorUser: { id: 'u3' } },
      ] as any);

      const res = await request(app)
        .get(`/api/projects/${validProjectId}/tasks/${validTaskId}/comments?limit=2`)
        .set('Cookie', cookie);

      expect(res.status).toBe(200);
      expect(db.comment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
          take: 3,
        }),
      );
      expect(res.body.hasMore).toBe(true);
      expect(res.body.items).toHaveLength(2);
      expect(res.body.nextCursor).toBe('c2');
    });

    it('Comments: commentId from another project or task returns 404 (mock-based)', async () => {
      const cookie = setupAuth(employeeUserId);
      vi.mocked(db.project.findUnique).mockResolvedValue({ id: validProjectId } as any);
      vi.mocked(db.projectMember.findUnique).mockResolvedValue({
        projectId: validProjectId,
        userId: employeeUserId,
        projectRole: 'member',
      } as any);
      vi.mocked(db.task.findUnique).mockResolvedValue({ id: validTaskId, projectId: validProjectId } as any);

      // Comment belongs to otherTaskId
      vi.mocked(db.comment.findUnique).mockResolvedValue({
        id: validCommentId,
        taskId: otherTaskId,
        authorUserId: employeeUserId,
      } as any);

      const res = await request(app)
        .patch(`/api/projects/${validProjectId}/tasks/${validTaskId}/comments/${validCommentId}`)
        .set('Cookie', cookie)
        .send({ body: 'New text' });

      expect(res.status).toBe(404);
    });

    it('Comments: author edit succeeds and writes comment.edited without body (mock-based)', async () => {
      const cookie = setupAuth(employeeUserId);
      vi.mocked(db.project.findUnique).mockResolvedValue({ id: validProjectId } as any);
      vi.mocked(db.projectMember.findUnique).mockResolvedValue({
        projectId: validProjectId,
        userId: employeeUserId,
        projectRole: 'member',
      } as any);
      vi.mocked(db.task.findUnique).mockResolvedValue({ id: validTaskId, projectId: validProjectId } as any);

      vi.mocked(db.comment.findUnique).mockResolvedValue({
        id: validCommentId,
        taskId: validTaskId,
        authorUserId: employeeUserId,
        body: 'Old body',
      } as any);

      vi.mocked(db.comment.update).mockResolvedValue({
        id: validCommentId,
        taskId: validTaskId,
        authorUserId: employeeUserId,
        body: 'Updated body',
        authorUser: { id: employeeUserId, displayName: 'Dev', username: 'dev' },
      } as any);

      const res = await request(app)
        .patch(`/api/projects/${validProjectId}/tasks/${validTaskId}/comments/${validCommentId}`)
        .set('Cookie', cookie)
        .send({ body: 'Updated body' });

      expect(res.status).toBe(200);
      expect(db.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: 'comment.edited',
            entityId: validCommentId,
            afterSnapshot: expect.not.objectContaining({ body: expect.anything() }),
          }),
        }),
      );
    });

    it('Comments: system_admin who is not the author gets 403 (mock-based)', async () => {
      const cookie = setupAuth(adminUserId);
      vi.mocked(db.project.findUnique).mockResolvedValue({ id: validProjectId } as any);
      vi.mocked(db.task.findUnique).mockResolvedValue({ id: validTaskId, projectId: validProjectId } as any);

      vi.mocked(db.comment.findUnique).mockResolvedValue({
        id: validCommentId,
        taskId: validTaskId,
        authorUserId: employeeUserId, // author is employeeUserId, not adminUserId
      } as any);

      const res = await request(app)
        .patch(`/api/projects/${validProjectId}/tasks/${validTaskId}/comments/${validCommentId}`)
        .set('Cookie', cookie)
        .send({ body: 'Admin overwrite attempt' });

      expect(res.status).toBe(403);
      expect(res.body.message).toContain('Only the author');
    });

    it('Comments: empty or whitespace body returns 400 (mock-based)', async () => {
      const cookie = setupAuth(employeeUserId);
      vi.mocked(db.project.findUnique).mockResolvedValue({ id: validProjectId } as any);
      vi.mocked(db.projectMember.findUnique).mockResolvedValue({
        projectId: validProjectId,
        userId: employeeUserId,
        projectRole: 'member',
      } as any);
      vi.mocked(db.task.findUnique).mockResolvedValue({ id: validTaskId, projectId: validProjectId } as any);

      const resPostEmpty = await request(app)
        .post(`/api/projects/${validProjectId}/tasks/${validTaskId}/comments`)
        .set('Cookie', cookie)
        .send({ body: '   ' });
      expect(resPostEmpty.status).toBe(400);

      const resPatchEmpty = await request(app)
        .patch(`/api/projects/${validProjectId}/tasks/${validTaskId}/comments/${validCommentId}`)
        .set('Cookie', cookie)
        .send({ body: '' });
      expect(resPatchEmpty.status).toBe(400);
    });

    it('Comments: body over 5000 characters returns 400 (mock-based)', async () => {
      const cookie = setupAuth(employeeUserId);
      vi.mocked(db.project.findUnique).mockResolvedValue({ id: validProjectId } as any);
      vi.mocked(db.projectMember.findUnique).mockResolvedValue({
        projectId: validProjectId,
        userId: employeeUserId,
        projectRole: 'member',
      } as any);
      vi.mocked(db.task.findUnique).mockResolvedValue({ id: validTaskId, projectId: validProjectId } as any);

      const longBody = 'x'.repeat(5001);

      const resPostLong = await request(app)
        .post(`/api/projects/${validProjectId}/tasks/${validTaskId}/comments`)
        .set('Cookie', cookie)
        .send({ body: longBody });
      expect(resPostLong.status).toBe(400);

      const resPatchLong = await request(app)
        .patch(`/api/projects/${validProjectId}/tasks/${validTaskId}/comments/${validCommentId}`)
        .set('Cookie', cookie)
        .send({ body: longBody });
      expect(resPatchLong.status).toBe(400);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 18. Audit log integrity: transactional execution and snapshot privacy (Part B.11)
  // ───────────────────────────────────────────────────────────────────────────
  describe('18. Part B.11: Audit log integrity and snapshot privacy', () => {
    it('Audit: task.created, task.updated, task_dependency.added, task_dependency.removed, and milestone.created omit description and body from snapshots (mock-based)', async () => {
      const cookie = setupAuth(pmUserId);
      vi.mocked(db.project.findUnique).mockResolvedValue({ id: validProjectId } as any);
      vi.mocked(db.projectMember.findUnique).mockResolvedValue({
        projectId: validProjectId,
        userId: pmUserId,
        projectRole: 'manager',
      } as any);

      // 1. task.created: create task with long description
      vi.mocked(db.task.create).mockResolvedValue({
        id: validTaskId,
        title: 'Audit Task',
        status: 'todo',
        description: 'Super sensitive description',
      } as any);

      await request(app)
        .post(`/api/projects/${validProjectId}/tasks`)
        .set('Cookie', cookie)
        .send({ title: 'Audit Task', description: 'Super sensitive description' });

      expect(db.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: 'task.created',
            afterSnapshot: expect.not.objectContaining({ description: expect.anything() }),
          }),
        }),
      );

      // 2. task.updated: update task description
      vi.mocked(db.task.findUnique).mockResolvedValue({
        id: validTaskId,
        projectId: validProjectId,
        title: 'Audit Task',
        description: 'Old description',
      } as any);

      vi.mocked(db.task.update).mockResolvedValue({
        id: validTaskId,
        projectId: validProjectId,
        title: 'Audit Task Updated',
        description: 'New sensitive description',
      } as any);

      await request(app)
        .patch(`/api/projects/${validProjectId}/tasks/${validTaskId}`)
        .set('Cookie', cookie)
        .send({ title: 'Audit Task Updated', description: 'New sensitive description' });

      expect(db.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: 'task.updated',
            beforeSnapshot: expect.not.objectContaining({ description: expect.anything() }),
            afterSnapshot: expect.not.objectContaining({ description: expect.anything() }),
          }),
        }),
      );

      // 3. milestone.created: create milestone
      vi.mocked(db.milestone.create).mockResolvedValue({
        id: validMilestoneId,
        projectId: validProjectId,
        name: 'Audit Milestone',
      } as any);

      await request(app)
        .post(`/api/projects/${validProjectId}/milestones`)
        .set('Cookie', cookie)
        .send({ name: 'Audit Milestone' });

      expect(db.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: 'milestone.created',
            afterSnapshot: expect.not.objectContaining({ description: expect.anything() }),
          }),
        }),
      );
    });
  });


  // ── Step 10f: Delete Endpoints, Boolean Query Parsing, and Transaction Rollback Tests ──
  describe('Step 10f: DELETE Routes, Boolean Query Flags, and Mock-based Invariants', () => {
    /*
     * MOCK LIMITATIONS (Step 10f Note):
     * The unit/integration tests below use Vitest mocks for Prisma ($transaction, delete, auditLog.create).
     * These mocks verify route authorization, validation branching, and sequential composition of transaction callbacks.
     * Mocks CANNOT prove:
     * 1. Real PostgreSQL database rollbacks on failure in a concurrent multi-connection environment.
     * 2. Physical database ON DELETE CASCADE (Task -> Subtasks, Task -> Comments, Task -> TaskDependencies)
     *    and ON DELETE SET NULL (TimeLog.taskId -> null), which are executed by the PostgreSQL engine.
     */

    describe('DELETE /api/projects/:id/tasks/:taskId', () => {
      it('allows project manager to delete a task (audited without description)', async () => {
        const cookie = setupAuth(pmUserId);
        vi.mocked(db.project.findUnique).mockResolvedValue({ id: validProjectId } as any);
        vi.mocked(db.projectMember.findUnique).mockResolvedValue({
          projectId: validProjectId,
          userId: pmUserId,
          projectRole: 'manager',
        } as any);

        vi.mocked(db.task.findUnique).mockResolvedValue({
          id: validTaskId,
          projectId: validProjectId,
          title: 'Task to be deleted',
          description: 'Top secret description that must not be in audit log',
        } as any);

        vi.mocked(db.task.delete).mockResolvedValue({ id: validTaskId } as any);

        const res = await request(app)
          .delete(`/api/projects/${validProjectId}/tasks/${validTaskId}`)
          .set('Cookie', cookie);

        expect(res.status).toBe(200);
        expect(res.body.ok).toBe(true);
        expect(res.body.deletedTaskId).toBe(validTaskId);

        expect(db.task.delete).toHaveBeenCalledWith({ where: { id: validTaskId } });
        expect(db.auditLog.create).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({
              action: 'task.deleted',
              entityType: 'Task',
              entityId: validTaskId,
              beforeSnapshot: {
                title: 'Task to be deleted',
                projectId: validProjectId,
              },
            }),
          }),
        );
        // Verify description is strictly omitted
        const auditCallData = vi.mocked(db.auditLog.create).mock.calls[0]![0].data as any;
        expect(auditCallData.beforeSnapshot?.description).toBeUndefined();
      });

      it('allows system_admin to delete a task even if not a member', async () => {
        const cookie = setupAuth(adminUserId);
        vi.mocked(db.project.findUnique).mockResolvedValue({ id: validProjectId } as any);

        vi.mocked(db.task.findUnique).mockResolvedValue({
          id: validTaskId,
          projectId: validProjectId,
          title: 'Admin Deleted Task',
        } as any);

        vi.mocked(db.task.delete).mockResolvedValue({ id: validTaskId } as any);

        const res = await request(app)
          .delete(`/api/projects/${validProjectId}/tasks/${validTaskId}`)
          .set('Cookie', cookie);

        expect(res.status).toBe(200);
        expect(res.body.ok).toBe(true);
      });

      it('refuses deletion by plain project member (403 forbidden)', async () => {
        const cookie = setupAuth(employeeUserId);
        vi.mocked(db.project.findUnique).mockResolvedValue({ id: validProjectId } as any);
        vi.mocked(db.projectMember.findUnique).mockResolvedValue({
          projectId: validProjectId,
          userId: employeeUserId,
          projectRole: 'member',
        } as any);

        const res = await request(app)
          .delete(`/api/projects/${validProjectId}/tasks/${validTaskId}`)
          .set('Cookie', cookie);

        expect(res.status).toBe(403);
        expect(res.body.error).toBe('forbidden');
        expect(db.task.delete).not.toHaveBeenCalled();
      });

      it('refuses deletion by project viewer (403 forbidden)', async () => {
        const cookie = setupAuth(viewerUserId);
        vi.mocked(db.project.findUnique).mockResolvedValue({ id: validProjectId } as any);
        vi.mocked(db.projectMember.findUnique).mockResolvedValue({
          projectId: validProjectId,
          userId: viewerUserId,
          projectRole: 'viewer',
        } as any);

        const res = await request(app)
          .delete(`/api/projects/${validProjectId}/tasks/${validTaskId}`)
          .set('Cookie', cookie);

        expect(res.status).toBe(403);
        expect(res.body.error).toBe('forbidden');
      });

      it('returns 404 for task belonging to a different project', async () => {
        const cookie = setupAuth(pmUserId);
        vi.mocked(db.project.findUnique).mockResolvedValue({ id: validProjectId } as any);
        vi.mocked(db.projectMember.findUnique).mockResolvedValue({
          projectId: validProjectId,
          userId: pmUserId,
          projectRole: 'manager',
        } as any);

        vi.mocked(db.task.findUnique).mockResolvedValue({
          id: validTaskId,
          projectId: 'foreign-project-id',
          title: 'Foreign Task',
        } as any);

        const res = await request(app)
          .delete(`/api/projects/${validProjectId}/tasks/${validTaskId}`)
          .set('Cookie', cookie);

        expect(res.status).toBe(404);
        expect(res.body.error).toBe('not_found');
      });

      it('returns 404 for malformed task UUID', async () => {
        const cookie = setupAuth(pmUserId);
        vi.mocked(db.project.findUnique).mockResolvedValue({ id: validProjectId } as any);
        vi.mocked(db.projectMember.findUnique).mockResolvedValue({
          projectId: validProjectId,
          userId: pmUserId,
          projectRole: 'manager',
        } as any);

        const res = await request(app)
          .delete(`/api/projects/${validProjectId}/tasks/not-a-uuid`)
          .set('Cookie', cookie);

        expect(res.status).toBe(404);
        expect(res.body.error).toBe('not_found');
      });

      it('rolls back task deletion if audit log creation fails inside transaction (mock-based)', async () => {
        const cookie = setupAuth(pmUserId);
        vi.mocked(db.project.findUnique).mockResolvedValue({ id: validProjectId } as any);
        vi.mocked(db.projectMember.findUnique).mockResolvedValue({
          projectId: validProjectId,
          userId: pmUserId,
          projectRole: 'manager',
        } as any);

        vi.mocked(db.task.findUnique).mockResolvedValue({
          id: validTaskId,
          projectId: validProjectId,
          title: 'Rollback Task',
        } as any);

        vi.mocked(db.auditLog.create).mockRejectedValue(new Error('Audit DB write error'));

        const res = await request(app)
          .delete(`/api/projects/${validProjectId}/tasks/${validTaskId}`)
          .set('Cookie', cookie);

        expect(res.status).toBe(500);
      });
    });

    describe('DELETE /api/projects/:id/tasks/:taskId/comments/:commentId', () => {
      const validCommentId = '99999999-9999-4999-8999-999999999999';

      it('allows comment author to delete their own comment (audited without body)', async () => {
        const cookie = setupAuth(employeeUserId);
        vi.mocked(db.project.findUnique).mockResolvedValue({ id: validProjectId } as any);
        vi.mocked(db.projectMember.findUnique).mockResolvedValue({
          projectId: validProjectId,
          userId: employeeUserId,
          projectRole: 'member',
        } as any);

        vi.mocked(db.task.findUnique).mockResolvedValue({
          id: validTaskId,
          projectId: validProjectId,
        } as any);

        vi.mocked(db.comment.findUnique).mockResolvedValue({
          id: validCommentId,
          taskId: validTaskId,
          authorUserId: employeeUserId,
          body: 'This is my comment body that must not be audited',
        } as any);

        vi.mocked(db.comment.delete).mockResolvedValue({ id: validCommentId } as any);

        const res = await request(app)
          .delete(`/api/projects/${validProjectId}/tasks/${validTaskId}/comments/${validCommentId}`)
          .set('Cookie', cookie);

        expect(res.status).toBe(200);
        expect(res.body.ok).toBe(true);
        expect(res.body.deletedCommentId).toBe(validCommentId);

        expect(db.comment.delete).toHaveBeenCalledWith({ where: { id: validCommentId } });
        expect(db.auditLog.create).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({
              action: 'comment.deleted',
              entityType: 'comment',
              entityId: validCommentId,
              beforeSnapshot: {
                taskId: validTaskId,
                projectId: validProjectId,
              },
            }),
          }),
        );
        const auditCallData = vi.mocked(db.auditLog.create).mock.calls[0]![0].data as any;
        expect(auditCallData.beforeSnapshot?.body).toBeUndefined();
      });

      it('allows project manager to delete another user comment', async () => {
        const cookie = setupAuth(pmUserId);
        vi.mocked(db.project.findUnique).mockResolvedValue({ id: validProjectId } as any);
        vi.mocked(db.projectMember.findUnique).mockResolvedValue({
          projectId: validProjectId,
          userId: pmUserId,
          projectRole: 'manager',
        } as any);

        vi.mocked(db.task.findUnique).mockResolvedValue({
          id: validTaskId,
          projectId: validProjectId,
        } as any);

        vi.mocked(db.comment.findUnique).mockResolvedValue({
          id: validCommentId,
          taskId: validTaskId,
          authorUserId: employeeUserId, // authored by employee
        } as any);

        vi.mocked(db.comment.delete).mockResolvedValue({ id: validCommentId } as any);

        const res = await request(app)
          .delete(`/api/projects/${validProjectId}/tasks/${validTaskId}/comments/${validCommentId}`)
          .set('Cookie', cookie);

        expect(res.status).toBe(200);
        expect(res.body.ok).toBe(true);
      });

      it('refuses deletion by a different member who is not author and not manager (403 forbidden)', async () => {
        const cookie = setupAuth(otherEmpUserId);
        vi.mocked(db.project.findUnique).mockResolvedValue({ id: validProjectId } as any);
        vi.mocked(db.projectMember.findUnique).mockResolvedValue({
          projectId: validProjectId,
          userId: otherEmpUserId,
          projectRole: 'member',
        } as any);

        vi.mocked(db.task.findUnique).mockResolvedValue({
          id: validTaskId,
          projectId: validProjectId,
        } as any);

        vi.mocked(db.comment.findUnique).mockResolvedValue({
          id: validCommentId,
          taskId: validTaskId,
          authorUserId: employeeUserId, // authored by someone else
        } as any);

        const res = await request(app)
          .delete(`/api/projects/${validProjectId}/tasks/${validTaskId}/comments/${validCommentId}`)
          .set('Cookie', cookie);

        expect(res.status).toBe(403);
        expect(res.body.error).toBe('forbidden');
        expect(db.comment.delete).not.toHaveBeenCalled();
      });

      it('refuses deletion by project viewer (403 forbidden)', async () => {
        const cookie = setupAuth(viewerUserId);
        vi.mocked(db.project.findUnique).mockResolvedValue({ id: validProjectId } as any);
        vi.mocked(db.projectMember.findUnique).mockResolvedValue({
          projectId: validProjectId,
          userId: viewerUserId,
          projectRole: 'viewer',
        } as any);

        const res = await request(app)
          .delete(`/api/projects/${validProjectId}/tasks/${validTaskId}/comments/${validCommentId}`)
          .set('Cookie', cookie);

        expect(res.status).toBe(403);
        expect(res.body.error).toBe('forbidden');
      });

      it('returns 404 for malformed comment UUID or foreign task comment', async () => {
        const cookie = setupAuth(pmUserId);
        vi.mocked(db.project.findUnique).mockResolvedValue({ id: validProjectId } as any);
        vi.mocked(db.projectMember.findUnique).mockResolvedValue({
          projectId: validProjectId,
          userId: pmUserId,
          projectRole: 'manager',
        } as any);

        // Malformed UUID
        const res1 = await request(app)
          .delete(`/api/projects/${validProjectId}/tasks/${validTaskId}/comments/bad-uuid`)
          .set('Cookie', cookie);
        expect(res1.status).toBe(404);

        // Comment belonging to another task
        vi.mocked(db.task.findUnique).mockResolvedValue({
          id: validTaskId,
          projectId: validProjectId,
        } as any);
        vi.mocked(db.comment.findUnique).mockResolvedValue({
          id: validCommentId,
          taskId: 'different-task-id',
        } as any);

        const res2 = await request(app)
          .delete(`/api/projects/${validProjectId}/tasks/${validTaskId}/comments/${validCommentId}`)
          .set('Cookie', cookie);
        expect(res2.status).toBe(404);
      });
    });

    describe('Boolean Query Parameters Parsing (topLevelOnly and overdue)', () => {
      it('correctly parses topLevelOnly=true, topLevelOnly=false, and rejects invalid strings', async () => {
        const cookie = setupAuth(pmUserId);
        vi.mocked(db.project.findUnique).mockResolvedValue({ id: validProjectId } as any);
        vi.mocked(db.projectMember.findUnique).mockResolvedValue({
          projectId: validProjectId,
          userId: pmUserId,
          projectRole: 'manager',
        } as any);

        vi.mocked(db.task.findMany).mockResolvedValue([]);

        // topLevelOnly=true
        const resTrue = await request(app)
          .get(`/api/projects/${validProjectId}/tasks?topLevelOnly=true`)
          .set('Cookie', cookie);
        expect(resTrue.status).toBe(200);

        // topLevelOnly=false
        const resFalse = await request(app)
          .get(`/api/projects/${validProjectId}/tasks?topLevelOnly=false`)
          .set('Cookie', cookie);
        expect(resFalse.status).toBe(200);

        // topLevelOnly=invalid (must return 400 validation_error)
        const resInvalid = await request(app)
          .get(`/api/projects/${validProjectId}/tasks?topLevelOnly=not_a_bool`)
          .set('Cookie', cookie);
        expect(resInvalid.status).toBe(400);
        expect(resInvalid.body.error).toBe('validation_error');
      });

      it('correctly parses overdue=true, overdue=false, and rejects invalid strings', async () => {
        const cookie = setupAuth(pmUserId);
        vi.mocked(db.project.findUnique).mockResolvedValue({ id: validProjectId } as any);
        vi.mocked(db.projectMember.findUnique).mockResolvedValue({
          projectId: validProjectId,
          userId: pmUserId,
          projectRole: 'manager',
        } as any);

        vi.mocked(db.task.findMany).mockResolvedValue([]);

        // overdue=true
        const resTrue = await request(app)
          .get(`/api/projects/${validProjectId}/tasks?overdue=true`)
          .set('Cookie', cookie);
        expect(resTrue.status).toBe(200);

        // overdue=false
        const resFalse = await request(app)
          .get(`/api/projects/${validProjectId}/tasks?overdue=false`)
          .set('Cookie', cookie);
        expect(resFalse.status).toBe(200);

        // overdue=invalid (must return 400 validation_error)
        const resInvalid = await request(app)
          .get(`/api/projects/${validProjectId}/tasks?overdue=maybe`)
          .set('Cookie', cookie);
        expect(resInvalid.status).toBe(400);
        expect(resInvalid.body.error).toBe('validation_error');
      });
    });
  });

});
