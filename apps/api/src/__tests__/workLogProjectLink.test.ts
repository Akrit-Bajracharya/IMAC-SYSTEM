import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../app.js';
import { db } from '../db.js';

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * MOCK LIMITATIONS AND BOUNDARY DOCUMENTATION:
 *
 * 1. Mock-based Tests:
 *    The tests in this suite mock Prisma client methods (db.project.*, db.projectMember.*,
 *    db.task.*, db.workLogDay.*, db.workLogEntry.*, db.employeeProfile.*, db.employeeWorkRole.*,
 *    db.workRole.*, db.auditLog.*, db.$transaction) via Vitest spies.
 *
 * 2. What Mocks Cannot Prove:
 *    - Real database foreign-key absence: Mocks verify the application-level validation
 *      and resolution logic, but cannot simulate physical database schema constraints.
 *    - Concurrent project removal races: Mocks test sequential authorization checks,
 *      not multi-threaded edge cases where a member is removed between validation and commit.
 * ─────────────────────────────────────────────────────────────────────────────
 */

describe('Step 10e Part A: Daily Work Log Project/Task Linking & Read Resolution', () => {
  const app = createApp({ csrfDisabled: true });

  const adminUserId = '11111111-1111-4111-8111-111111111111';
  const empUserId = '22222222-2222-4222-8222-222222222222';
  const otherEmpUserId = '33333333-3333-4333-8333-333333333333';

  const mockAdminUser = {
    id: adminUserId,
    username: 'admin_boss',
    displayName: 'Boss Admin',
    systemRole: 'system_admin',
    isActive: true,
    mustChangePassword: false,
  };

  const mockEmpUser = {
    id: empUserId,
    username: 'john_dev',
    displayName: 'John Developer',
    systemRole: 'employee',
    isActive: true,
    mustChangePassword: false,
  };

  const mockOtherEmpUser = {
    id: otherEmpUserId,
    username: 'alice_dev',
    displayName: 'Alice Developer',
    systemRole: 'employee',
    isActive: true,
    mustChangePassword: false,
  };

  const mockEmpProfile = {
    id: 'profile-uuid-john',
    userId: empUserId,
    employeeCode: 'EMP-JOHN',
    department: 'Engineering',
    jobTitle: 'Software Engineer',
    standardShiftHours: 8,
    workingDaysPerWeek: 5,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockRoleDevId = 'role-dev-uuid-1111';
  const validProjectId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const otherProjectId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  const validTaskId = '10101010-1010-4010-8010-101010101010';
  const foreignTaskId = '20202020-2020-4020-8020-202020202020';

  function setupAuth(user: any, profile: any = mockEmpProfile) {
    const session = {
      id: `sess-${user.id}`,
      userId: user.id,
      expiresAt: new Date(Date.now() + 3600 * 1000),
      lastActiveAt: new Date(),
      user,
    };
    vi.mocked(db.session.findUnique).mockResolvedValue(session as any);
    vi.mocked(db.session.update).mockResolvedValue(session as any);
    vi.mocked(db.employeeProfile.findUnique).mockResolvedValue(profile as any);
    return `IMAC_SESSION=sess-${user.id}`;
  }

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(db.auditLog.create).mockResolvedValue({} as any);

    // Default mock: Role assignment is valid
    vi.mocked(db.employeeWorkRole.findMany).mockResolvedValue([
      { employeeProfileId: mockEmpProfile.id, workRoleId: mockRoleDevId },
    ] as any);
    vi.mocked(db.workRole.findMany).mockResolvedValue([
      { id: mockRoleDevId, name: 'Developer', isActive: true },
    ] as any);
  });

  describe('1. POST /api/work-logs (Draft Creation/Upsert)', () => {
    it('refuses free-text projectId on new writes (400 invalid_project)', async () => {
      const cookie = setupAuth(mockEmpUser);

      const res = await request(app)
        .post('/api/work-logs')
        .set('Cookie', cookie)
        .send({
          date: '2026-10-29',
          entries: [
            {
              workRoleId: mockRoleDevId,
              hours: 4,
              description: 'Coding',
              projectId: 'Legacy Free Text Project',
            },
          ],
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('invalid_project');
    });

    it('refuses taskId without projectId (400 invalid_task)', async () => {
      const cookie = setupAuth(mockEmpUser);

      const res = await request(app)
        .post('/api/work-logs')
        .set('Cookie', cookie)
        .send({
          date: '2026-10-29',
          entries: [
            {
              workRoleId: mockRoleDevId,
              hours: 4,
              description: 'Coding',
              taskId: validTaskId,
            },
          ],
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('invalid_task');
    });

    it('refuses project that does not exist (400 invalid_project)', async () => {
      const cookie = setupAuth(mockEmpUser);
      vi.mocked(db.project.findMany).mockResolvedValue([]); // Project not found

      const res = await request(app)
        .post('/api/work-logs')
        .set('Cookie', cookie)
        .send({
          date: '2026-10-29',
          entries: [
            {
              workRoleId: mockRoleDevId,
              hours: 4,
              description: 'Coding',
              projectId: validProjectId,
            },
          ],
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('invalid_project');
    });

    it('refuses project when caller is not a member (400 invalid_project)', async () => {
      const cookie = setupAuth(mockEmpUser);
      vi.mocked(db.project.findMany).mockResolvedValue([{ id: validProjectId, name: 'Project Alpha' }] as any);
      vi.mocked(db.projectMember.findMany).mockResolvedValue([]); // Caller NOT a member

      const res = await request(app)
        .post('/api/work-logs')
        .set('Cookie', cookie)
        .send({
          date: '2026-10-29',
          entries: [
            {
              workRoleId: mockRoleDevId,
              hours: 4,
              description: 'Coding',
              projectId: validProjectId,
            },
          ],
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('invalid_project');
    });

    it('refuses task that belongs to another project (400 invalid_task)', async () => {
      const cookie = setupAuth(mockEmpUser);
      vi.mocked(db.project.findMany).mockResolvedValue([{ id: validProjectId, name: 'Project Alpha' }] as any);
      vi.mocked(db.projectMember.findMany).mockResolvedValue([
        { projectId: validProjectId, userId: empUserId },
      ] as any);
      // Task exists but belongs to otherProjectId
      vi.mocked(db.task.findMany).mockResolvedValue([
        { id: foreignTaskId, projectId: otherProjectId, title: 'Foreign Task' },
      ] as any);

      const res = await request(app)
        .post('/api/work-logs')
        .set('Cookie', cookie)
        .send({
          date: '2026-10-29',
          entries: [
            {
              workRoleId: mockRoleDevId,
              hours: 4,
              description: 'Coding',
              projectId: validProjectId,
              taskId: foreignTaskId,
            },
          ],
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('invalid_task');
    });

    it('successfully creates draft and resolves projectName and taskTitle', async () => {
      const cookie = setupAuth(mockEmpUser);
      vi.mocked(db.project.findMany).mockResolvedValue([{ id: validProjectId, name: 'Project Alpha' }] as any);
      vi.mocked(db.projectMember.findMany).mockResolvedValue([
        { projectId: validProjectId, userId: empUserId },
      ] as any);
      vi.mocked(db.task.findMany).mockResolvedValue([
        { id: validTaskId, projectId: validProjectId, title: 'Implement Auth' },
      ] as any);

      const mockCreatedLog = {
        id: 'log-1',
        employeeProfileId: mockEmpProfile.id,
        date: new Date('2026-10-29'),
        status: 'draft',
        entries: [
          {
            id: 'entry-1',
            workLogDayId: 'log-1',
            workRoleId: mockRoleDevId,
            hours: 4,
            description: 'Coding',
            projectId: validProjectId,
            taskId: validTaskId,
            workRole: { id: mockRoleDevId, name: 'Developer' },
          },
        ],
      };

      vi.mocked(db.$transaction).mockImplementation(async (cb: any) => {
        return cb({
          workLogDay: {
            findFirst: vi.fn().mockResolvedValue(null),
            create: vi.fn().mockResolvedValue(mockCreatedLog),
            findUnique: vi.fn().mockResolvedValue(mockCreatedLog),
          },
          workLogEntry: {
            createMany: vi.fn().mockResolvedValue({ count: 1 }),
          },
        });
      });

      const res = await request(app)
        .post('/api/work-logs')
        .set('Cookie', cookie)
        .send({
          date: '2026-10-29',
          entries: [
            {
              workRoleId: mockRoleDevId,
              hours: 4,
              description: 'Coding',
              projectId: validProjectId,
              taskId: validTaskId,
            },
          ],
        });

      expect(res.status).toBe(201);
      expect(res.body.ok).toBe(true);
      expect(res.body.workLog.entries[0].projectName).toBe('Project Alpha');
      expect(res.body.workLog.entries[0].taskTitle).toBe('Implement Auth');
    });
  });

  describe('2. PATCH /api/work-logs/:id', () => {
    it('behaves identically on validation failures (400 invalid_project for non-member)', async () => {
      const cookie = setupAuth(mockEmpUser);
      vi.mocked(db.project.findMany).mockResolvedValue([{ id: validProjectId, name: 'Project Alpha' }] as any);
      vi.mocked(db.projectMember.findMany).mockResolvedValue([]); // Not a member

      const res = await request(app)
        .patch('/api/work-logs/log-1')
        .set('Cookie', cookie)
        .send({
          entries: [
            {
              workRoleId: mockRoleDevId,
              hours: 4,
              projectId: validProjectId,
            },
          ],
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('invalid_project');
    });
  });

  describe('3. PATCH /api/admin/work-logs/:id/override', () => {
    it('refuses free-text projectId (400 invalid_project)', async () => {
      const cookie = setupAuth(mockAdminUser);

      const res = await request(app)
        .patch('/api/admin/work-logs/log-1/override')
        .set('Cookie', cookie)
        .send({
          reason: 'Correcting billing info',
          entries: [
            {
              workRoleId: mockRoleDevId,
              hours: 4,
              projectId: 'Non-UUID Free Text',
            },
          ],
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('invalid_project');
    });

    it('refuses taskId without projectId (400 invalid_task)', async () => {
      const cookie = setupAuth(mockAdminUser);

      const res = await request(app)
        .patch('/api/admin/work-logs/log-1/override')
        .set('Cookie', cookie)
        .send({
          reason: 'Correcting billing info',
          entries: [
            {
              workRoleId: mockRoleDevId,
              hours: 4,
              taskId: validTaskId,
            },
          ],
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('invalid_task');
    });

    it('refuses project that does not exist (400 invalid_project)', async () => {
      const cookie = setupAuth(mockAdminUser);
      vi.mocked(db.project.findMany).mockResolvedValue([]);

      const res = await request(app)
        .patch('/api/admin/work-logs/log-1/override')
        .set('Cookie', cookie)
        .send({
          reason: 'Admin override test',
          entries: [
            {
              workRoleId: mockRoleDevId,
              hours: 4,
              projectId: validProjectId,
            },
          ],
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('invalid_project');
    });

    it('succeeds when project exists even if admin is NOT a project member', async () => {
      const cookie = setupAuth(mockAdminUser);
      vi.mocked(db.project.findMany).mockResolvedValue([{ id: validProjectId, name: 'Project Alpha' }] as any);
      // No projectMember record returned!
      vi.mocked(db.projectMember.findMany).mockResolvedValue([]);
      vi.mocked(db.task.findMany).mockResolvedValue([
        { id: validTaskId, projectId: validProjectId, title: 'Implement Auth' },
      ] as any);

      const mockUpdatedLog = {
        id: 'log-1',
        employeeProfileId: mockEmpProfile.id,
        date: new Date('2026-10-29'),
        status: 'draft',
        entries: [
          {
            id: 'entry-1',
            workLogDayId: 'log-1',
            workRoleId: mockRoleDevId,
            hours: 4,
            projectId: validProjectId,
            taskId: validTaskId,
            workRole: { id: mockRoleDevId, name: 'Developer' },
          },
        ],
      };

      vi.mocked(db.$transaction).mockImplementation(async (cb: any) => {
        return cb({
          workLogDay: {
            findUnique: vi.fn().mockResolvedValue({
              id: 'log-1',
              status: 'draft',
              entries: [],
              employeeProfile: mockEmpProfile,
            }),
            update: vi.fn().mockResolvedValue(mockUpdatedLog),
          },
          workLogEntry: {
            deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
            createMany: vi.fn().mockResolvedValue({ count: 1 }),
          },
          auditLog: {
            create: vi.fn().mockResolvedValue({}),
          },
        });
      });

      const res = await request(app)
        .patch('/api/admin/work-logs/log-1/override')
        .set('Cookie', cookie)
        .send({
          reason: 'Admin adjustment without project membership',
          entries: [
            {
              workRoleId: mockRoleDevId,
              hours: 4,
              projectId: validProjectId,
              taskId: validTaskId,
            },
          ],
        });

      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
      expect(res.body.workLog.entries[0].projectName).toBe('Project Alpha');
      expect(res.body.workLog.entries[0].taskTitle).toBe('Implement Auth');
    });
  });

  describe('4. Read Operations (GET /:id and GET /by-date) & Privacy Invariants', () => {
    it('loads an old log with free-text projectId with null projectName and taskTitle', async () => {
      const cookie = setupAuth(mockEmpUser);

      const mockOldLog = {
        id: 'old-log-1',
        employeeProfileId: mockEmpProfile.id,
        date: new Date('2026-10-01'),
        status: 'draft',
        entries: [
          {
            id: 'entry-old',
            workLogDayId: 'old-log-1',
            workRoleId: mockRoleDevId,
            hours: 4,
            description: 'Legacy work',
            projectId: 'Legacy Free-Text Web App',
            taskId: null,
            workRole: { id: mockRoleDevId, name: 'Developer' },
          },
        ],
      };

      vi.mocked(db.workLogDay.findFirst).mockResolvedValue(mockOldLog as any);

      const res = await request(app)
        .get('/api/work-logs/old-log-1')
        .set('Cookie', cookie);

      expect(res.status).toBe(200);
      expect(res.body.workLog.entries[0].projectId).toBe('Legacy Free-Text Web App');
      expect(res.body.workLog.entries[0].projectName).toBeNull();
      expect(res.body.workLog.entries[0].taskTitle).toBeNull();
    });

    it('returns null projectName and taskTitle when caller is not a member of the project', async () => {
      // Alice Dev viewing her log which points to a project she is NO LONGER a member of
      const cookie = setupAuth(mockOtherEmpUser, { ...mockEmpProfile, userId: otherEmpUserId });

      const mockLog = {
        id: 'log-departed',
        employeeProfileId: mockEmpProfile.id,
        date: new Date('2026-10-15'),
        status: 'submitted',
        entries: [
          {
            id: 'entry-dep',
            workLogDayId: 'log-departed',
            workRoleId: mockRoleDevId,
            hours: 5,
            projectId: validProjectId,
            taskId: validTaskId,
            workRole: { id: mockRoleDevId, name: 'Developer' },
          },
        ],
      };

      vi.mocked(db.workLogDay.findFirst).mockResolvedValue(mockLog as any);
      vi.mocked(db.project.findMany).mockResolvedValue([{ id: validProjectId, name: 'Confidential Project' }] as any);
      vi.mocked(db.projectMember.findMany).mockResolvedValue([]); // Alice is NOT a member

      const res = await request(app)
        .get('/api/work-logs/by-date?date=2026-10-15')
        .set('Cookie', cookie);

      expect(res.status).toBe(200);
      expect(res.body.workLog.entries[0].projectId).toBe(validProjectId);
      // Project name must NOT leak to non-member
      expect(res.body.workLog.entries[0].projectName).toBeNull();
      expect(res.body.workLog.entries[0].taskTitle).toBeNull();
    });
  });
});
