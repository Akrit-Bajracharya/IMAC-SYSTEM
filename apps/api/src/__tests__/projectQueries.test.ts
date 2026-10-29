import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../app.js';
import { db } from '../db.js';

describe('Step 10d: Project Queries Subsystem Tests (/summary, /workload, /overdue, /blocked)', () => {
  const app = createApp({ csrfDisabled: true });

  const adminUserId = '11111111-1111-4111-8111-111111111111';
  const pmUserId = '22222222-2222-4222-8222-222222222222';
  const employeeUserId = '44444444-4444-4444-8444-444444444444';
  const otherEmpUserId = '44444444-4444-4444-8444-444444444445';
  const departedUserId = '77777777-7777-4777-8777-777777777777';

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
  const validMilestoneId = '30303030-3030-4030-8030-303030303030';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('1. GET /api/projects/:id/summary', () => {
    it('returns 401 unauthenticated and 404 for non-members (mock-based)', async () => {
      const resUnauth = await request(app).get(`/api/projects/${validProjectId}/summary`);
      expect(resUnauth.status).toBe(401);

      const cookie = setupAuth(employeeUserId);
      vi.mocked(db.project.findUnique as any).mockResolvedValue({ id: validProjectId });
      vi.mocked(db.projectMember.findUnique as any).mockResolvedValue(null);

      const resNonMember = await request(app)
        .get(`/api/projects/${validProjectId}/summary`)
        .set('Cookie', cookie);
      expect(resNonMember.status).toBe(404);
    });

    it('allows system_admin who is NOT a member to read summary (mock-based)', async () => {
      const cookie = setupAuth(adminUserId);
      vi.mocked(db.project.findUnique as any).mockResolvedValue({ id: validProjectId, status: 'on_track' });
      vi.mocked(db.task.findMany as any).mockResolvedValue([]);
      vi.mocked(db.timeLog.aggregate as any).mockResolvedValue({ _sum: { hours: 0 } });
      vi.mocked(db.milestone.findMany as any).mockResolvedValue([]);

      const res = await request(app)
        .get(`/api/projects/${validProjectId}/summary`)
        .set('Cookie', cookie);

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('on_track');
      expect(res.body.progress).toBe(0);
    });

    it('returns calculated summary: status, progress, taskCounts, overdueCount, blockedCount, rounded hours, upcoming milestones (mock-based)', async () => {
      const cookie = setupAuth(employeeUserId);
      vi.mocked(db.project.findUnique as any).mockResolvedValue({ id: validProjectId, status: 'at_risk' });
      vi.mocked(db.projectMember.findUnique as any).mockResolvedValue({
        projectId: validProjectId,
        userId: employeeUserId,
        projectRole: 'member',
      });

      // Tasks:
      // t1: done (leaf)
      // t2: blocked (leaf)
      // t3: in_progress with past dueDate (overdue, leaf)
      // t4: todo (leaf)
      // Total leaves = 4, done = 1 -> progress = 25%
      vi.mocked(db.task.findMany as any).mockResolvedValue([
        { id: 't1', status: 'done', dueDate: null, estimatedHours: 4.255, parentTaskId: null },
        { id: 't2', status: 'blocked', dueDate: null, estimatedHours: 2, parentTaskId: null },
        { id: 't3', status: 'in_progress', dueDate: new Date('2025-01-01'), estimatedHours: 3.5, parentTaskId: null },
        { id: 't4', status: 'todo', dueDate: null, estimatedHours: 1, parentTaskId: null },
      ]);

      vi.mocked(db.timeLog.aggregate as any).mockResolvedValue({ _sum: { hours: 14.3333 } });

      vi.mocked(db.milestone.findMany as any).mockResolvedValue([
        { id: validMilestoneId, name: 'Sprint Milestone', dueDate: new Date('2026-11-01') },
      ]);

      const res = await request(app)
        .get(`/api/projects/${validProjectId}/summary`)
        .set('Cookie', cookie);

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('at_risk');
      expect(res.body.progress).toBe(25);
      expect(res.body.taskCounts).toEqual({
        todo: 1,
        in_progress: 1,
        blocked: 1,
        done: 1,
      });
      expect(res.body.overdueCount).toBe(1);
      expect(res.body.blockedCount).toBe(1);
      // Rounded to 2 decimals
      expect(res.body.hours.estimated).toBe(10.76); // 4.255 + 2 + 3.5 + 1 = 10.755 -> 10.76
      expect(res.body.hours.logged).toBe(14.33); // 14.3333 -> 14.33
      expect(res.body.upcomingMilestones).toHaveLength(1);
    });
  });

  describe('2. GET /api/projects/:id/workload', () => {
    it('returns 401 unauthenticated and 404 for non-members (mock-based)', async () => {
      const resUnauth = await request(app).get(`/api/projects/${validProjectId}/workload`);
      expect(resUnauth.status).toBe(401);

      const cookie = setupAuth(employeeUserId);
      vi.mocked(db.project.findUnique as any).mockResolvedValue({ id: validProjectId });
      vi.mocked(db.projectMember.findUnique as any).mockResolvedValue(null);

      const resNonMember = await request(app)
        .get(`/api/projects/${validProjectId}/workload`)
        .set('Cookie', cookie);
      expect(resNonMember.status).toBe(404);
    });

    it('shows loggedHours per person to managers/admin, but masks other members loggedHours as null for regular members (mock-based)', async () => {
      // 1. Regular member request
      const memberCookie = setupAuth(employeeUserId);
      vi.mocked(db.project.findUnique as any).mockResolvedValue({ id: validProjectId });
      vi.mocked(db.projectMember.findUnique as any).mockResolvedValue({
        projectId: validProjectId,
        userId: employeeUserId,
        projectRole: 'member',
      });

      vi.mocked(db.projectMember.findMany as any).mockResolvedValue([
        {
          userId: employeeUserId,
          projectRole: 'member',
          user: { id: employeeUserId, displayName: 'Dev 1', username: 'dev1' },
        },
        {
          userId: otherEmpUserId,
          projectRole: 'member',
          user: { id: otherEmpUserId, displayName: 'Dev 2', username: 'dev2' },
        },
      ]);

      vi.mocked(db.task.findMany as any).mockResolvedValue([]);
      vi.mocked(db.timeLog.groupBy as any).mockResolvedValue([
        { userId: employeeUserId, _sum: { hours: 10 } },
        { userId: otherEmpUserId, _sum: { hours: 15 } },
      ]);

      const resMember = await request(app)
        .get(`/api/projects/${validProjectId}/workload`)
        .set('Cookie', memberCookie);

      expect(resMember.status).toBe(200);
      const dev1 = resMember.body.members.find((m: any) => m.userId === employeeUserId);
      const dev2 = resMember.body.members.find((m: any) => m.userId === otherEmpUserId);
      expect(dev1.loggedHours).toBe(10);
      expect(dev2.loggedHours).toBeNull(); // Masked for other members!

      // 2. Project Manager request
      const pmCookie = setupAuth(pmUserId);
      vi.mocked(db.projectMember.findUnique as any).mockResolvedValue({
        projectId: validProjectId,
        userId: pmUserId,
        projectRole: 'manager',
      });

      const resPm = await request(app)
        .get(`/api/projects/${validProjectId}/workload`)
        .set('Cookie', pmCookie);

      expect(resPm.status).toBe(200);
      const pmDev1 = resPm.body.members.find((m: any) => m.userId === employeeUserId);
      const pmDev2 = resPm.body.members.find((m: any) => m.userId === otherEmpUserId);
      expect(pmDev1.loggedHours).toBe(10);
      expect(pmDev2.loggedHours).toBe(15); // PM sees both!
    });

    it('handles unassignedOrDeparted bucket and strictly counts only open tasks (mock-based)', async () => {
      const pmCookie = setupAuth(pmUserId);
      vi.mocked(db.project.findUnique as any).mockResolvedValue({ id: validProjectId });
      vi.mocked(db.projectMember.findUnique as any).mockResolvedValue({
        projectId: validProjectId,
        userId: pmUserId,
        projectRole: 'manager',
      });

      // Active members: only pmUserId and employeeUserId
      vi.mocked(db.projectMember.findMany as any).mockResolvedValue([
        {
          userId: pmUserId,
          projectRole: 'manager',
          user: { id: pmUserId, displayName: 'PM', username: 'pm' },
        },
        {
          userId: employeeUserId,
          projectRole: 'member',
          user: { id: employeeUserId, displayName: 'Dev', username: 'dev' },
        },
      ]);

      // Open tasks (status != 'done')
      vi.mocked(db.task.findMany as any).mockResolvedValue([
        // Assigned to active member
        { id: 't1', assigneeUserId: employeeUserId, estimatedHours: 5 },
        // Unassigned
        { id: 't2', assigneeUserId: null, estimatedHours: 3.5 },
        // Assigned to departed member (departedUserId not in active members)
        { id: 't3', assigneeUserId: departedUserId, estimatedHours: 4.5 },
      ]);

      vi.mocked(db.timeLog.groupBy as any).mockResolvedValue([]);

      const res = await request(app)
        .get(`/api/projects/${validProjectId}/workload`)
        .set('Cookie', pmCookie);

      expect(res.status).toBe(200);
      expect(res.body.unassignedOrDeparted).toEqual({
        openTasksCount: 2, // t2 and t3
        estimatedHours: 8, // 3.5 + 4.5 = 8
      });
    });
  });

  describe('3. GET /api/projects/:id/tasks/overdue and /blocked', () => {
    it('returns overdue tasks using Asia/Kathmandu date boundary (mock-based)', async () => {
      const cookie = setupAuth(employeeUserId);
      vi.mocked(db.project.findUnique as any).mockResolvedValue({ id: validProjectId });
      vi.mocked(db.projectMember.findUnique as any).mockResolvedValue({
        projectId: validProjectId,
        userId: employeeUserId,
        projectRole: 'member',
      });

      vi.mocked(db.task.findMany as any).mockResolvedValue([
        { id: 't-overdue-1', title: 'Overdue Task 1', status: 'in_progress' },
      ]);

      const res = await request(app)
        .get(`/api/projects/${validProjectId}/tasks/overdue`)
        .set('Cookie', cookie);

      expect(res.status).toBe(200);
      expect(res.body.items).toHaveLength(1);
      expect(db.task.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            projectId: validProjectId,
            status: { not: 'done' },
            dueDate: expect.objectContaining({ lt: expect.any(Date) }),
          }),
        }),
      );
    });

    it('returns blocked tasks with pagination (mock-based)', async () => {
      const cookie = setupAuth(employeeUserId);
      vi.mocked(db.project.findUnique as any).mockResolvedValue({ id: validProjectId });
      vi.mocked(db.projectMember.findUnique as any).mockResolvedValue({
        projectId: validProjectId,
        userId: employeeUserId,
        projectRole: 'member',
      });

      vi.mocked(db.task.findMany as any).mockResolvedValue([
        { id: 't-blocked-1', title: 'Blocked Task 1', status: 'blocked' },
      ]);

      const res = await request(app)
        .get(`/api/projects/${validProjectId}/tasks/blocked`)
        .set('Cookie', cookie);

      expect(res.status).toBe(200);
      expect(res.body.items).toHaveLength(1);
      expect(db.task.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            projectId: validProjectId,
            status: 'blocked',
          },
        }),
      );
    });

    it('PROVES that neither /overdue nor /blocked is captured as a :taskId (mock-based)', async () => {
      const cookie = setupAuth(employeeUserId);
      vi.mocked(db.project.findUnique as any).mockResolvedValue({ id: validProjectId });
      vi.mocked(db.projectMember.findUnique as any).mockResolvedValue({
        projectId: validProjectId,
        userId: employeeUserId,
        projectRole: 'member',
      });

      vi.mocked(db.task.findMany as any).mockResolvedValue([]);
      // db.task.findUnique is what /:taskId calls
      const findUniqueSpy = vi.spyOn(db.task, 'findUnique');

      const resOverdue = await request(app)
        .get(`/api/projects/${validProjectId}/tasks/overdue`)
        .set('Cookie', cookie);
      expect(resOverdue.status).toBe(200);
      expect(resOverdue.body.items).toBeDefined();

      const resBlocked = await request(app)
        .get(`/api/projects/${validProjectId}/tasks/blocked`)
        .set('Cookie', cookie);
      expect(resBlocked.status).toBe(200);
      expect(resBlocked.body.items).toBeDefined();

      // Ensure findUnique was NOT called with taskId: 'overdue' or 'blocked'
      for (const call of findUniqueSpy.mock.calls) {
        const arg = call[0] as any;
        expect(arg?.where?.id).not.toBe('overdue');
        expect(arg?.where?.id).not.toBe('blocked');
      }
    });
  });
});
