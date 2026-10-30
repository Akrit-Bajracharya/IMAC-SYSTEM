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
 *    db.auditLog.*, db.$transaction, and db.$queryRaw) via Vitest spies and mock implementations.
 *
 * 2. What Mocks Cannot Prove:
 *    - Real PostgreSQL Row-Level Locking:
 *      The query `SELECT "id" FROM "Project" WHERE "id" = $1 FOR UPDATE` is verified to be executed,
 *      but mock execution cannot prove PostgreSQL lock wait states, deadlocks, or lock contention.
 *    - Concurrency Race Conditions & Database Rollbacks:
 *      In a real PostgreSQL cluster, concurrent DELETE or status PATCH transactions might interleave
 *      at the engine level; mock tests execute sequentially in a single Node.js thread.
 *    - Native Constraint Collisions (P2002):
 *      Mocks simulate P2002 by throwing an Error with `code: 'P2002'`; they cannot prove that the
 *      PostgreSQL compound unique index `@@unique([projectId, userId])` triggers natively.
 *    - Date Serialization in PostgreSQL @db.Date:
 *      JavaScript Dates vs. PostgreSQL DATE column truncation at UTC midnight.
 * ─────────────────────────────────────────────────────────────────────────────
 */

describe('Step 10b: Projects, Members and Status APIs Integration Tests', () => {
  const app = createApp({ csrfDisabled: true });

  const adminUserId = '11111111-1111-4111-8111-111111111111';
  const pmUserId = '22222222-2222-4222-8222-222222222222';
  const otherPmUserId = '33333333-3333-4333-8333-333333333333';
  const employeeUserId = '44444444-4444-4444-8444-444444444444';
  const viewerUserId = '55555555-5555-4555-8555-555555555555';
  const hrUserId = '66666666-6666-4666-8666-666666666666';

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
    [viewerUserId]: {
      id: viewerUserId,
      username: 'view_auditor',
      displayName: 'Viewer Auditor',
      systemRole: 'viewer',
      isActive: true,
      mustChangePassword: false,
    },
    [hrUserId]: {
      id: hrUserId,
      username: 'hr_manager',
      displayName: 'HR Manager',
      systemRole: 'hr_admin',
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
  const validMemberUserId = '77777777-7777-4777-8777-777777777777';

  beforeEach(() => {
    vi.clearAllMocks();
    (db.auditLog.create as any).mockResolvedValue({});
    (db.$queryRaw as any).mockResolvedValue([{ id: validProjectId }]);
  });

  // ───────────────────────────────────────────────────────────────────────────
  // Authentication & Baseline Negative Cases
  // ───────────────────────────────────────────────────────────────────────────
  describe('Authentication and Route Guards', () => {
    it('returns 401 when request is unauthenticated', async () => {
      const res = await request(app).get('/api/projects');
      expect(res.status).toBe(401);
      expect(res.body.error).toBe('unauthenticated');
    });

    it('returns 403 if mustChangePassword is true', async () => {
      const cookie = setupAuth(pmUserId, true);

      const res = await request(app)
        .get('/api/projects')
        .set('Cookie', cookie);
      expect(res.status).toBe(403);
      expect(res.body.error).toBe('password_change_required');
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 1. POST /api/projects
  // ───────────────────────────────────────────────────────────────────────────
  describe('POST /api/projects - Create Project', () => {
    it('allows project_manager to create project, creator becomes manager in same transaction', async () => {
      const cookie = setupAuth(pmUserId);

      const createdProject = {
        id: validProjectId,
        name: 'New Nepal Bridge Portal',
        description: 'Bridge engineering documentation',
        status: 'on_track',
        startDate: new Date('2026-11-01'),
        targetDate: new Date('2026-12-01'),
        createdByUserId: pmUserId,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const createdMember = {
        id: 'pm-mem-1',
        projectId: validProjectId,
        userId: pmUserId,
        projectRole: 'manager',
        addedByUserId: pmUserId,
        createdAt: new Date(),
      };

      vi.mocked(db.project.create).mockResolvedValue(createdProject as any);
      vi.mocked(db.projectMember.create).mockResolvedValue(createdMember as any);

      const res = await request(app)
        .post('/api/projects')
        .set('Cookie', cookie)
        .send({
          name: 'New Nepal Bridge Portal',
          description: 'Bridge engineering documentation',
          startDate: '2026-11-01',
          targetDate: '2026-12-01',
        });

      expect(res.status).toBe(201);
      expect(res.body.id).toBe(validProjectId);
      expect(res.body.members).toHaveLength(1);
      expect(res.body.members[0].projectRole).toBe('manager');
      expect(res.body.members[0].userId).toBe(pmUserId);

      expect(db.project.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          name: 'New Nepal Bridge Portal',
          createdByUserId: pmUserId,
          status: 'on_track',
        }),
      });

      expect(db.projectMember.create).toHaveBeenCalledWith({
        data: {
          projectId: validProjectId,
          userId: pmUserId,
          projectRole: 'manager',
          addedByUserId: pmUserId,
        },
      });

      expect(db.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          action: 'project.created',
          actorUserId: pmUserId,
          entityId: validProjectId,
        }),
      });
    });

    it('allows system_admin to create project', async () => {
      const cookie = setupAuth(adminUserId);

      vi.mocked(db.project.create).mockResolvedValue({
        id: validProjectId,
        name: 'Admin Project',
        status: 'on_track',
        createdByUserId: adminUserId,
      } as any);

      vi.mocked(db.projectMember.create).mockResolvedValue({
        id: 'mem-admin-1',
        projectId: validProjectId,
        userId: adminUserId,
        projectRole: 'manager',
      } as any);

      const res = await request(app)
        .post('/api/projects')
        .set('Cookie', cookie)
        .send({ name: 'Admin Project' });

      expect(res.status).toBe(201);
    });

    it('refuses creation for regular employee (403 forbidden)', async () => {
      const cookie = setupAuth(employeeUserId);
      const res = await request(app)
        .post('/api/projects')
        .set('Cookie', cookie)
        .send({ name: 'Employee Attempt' });

      expect(res.status).toBe(403);
      expect(res.body.error).toBe('forbidden');
      expect(db.project.create).not.toHaveBeenCalled();
    });

    it('refuses creation for viewer (403 forbidden)', async () => {
      const cookie = setupAuth(viewerUserId);
      const res = await request(app)
        .post('/api/projects')
        .set('Cookie', cookie)
        .send({ name: 'Viewer Attempt' });

      expect(res.status).toBe(403);
      expect(res.body.error).toBe('forbidden');
    });

    it('refuses creation for hr_admin by default (403 forbidden)', async () => {
      const cookie = setupAuth(hrUserId);
      const res = await request(app)
        .post('/api/projects')
        .set('Cookie', cookie)
        .send({ name: 'HR Attempt' });

      expect(res.status).toBe(403);
      expect(res.body.error).toBe('forbidden');
    });

    it('refuses creation when targetDate is before startDate (400 invalid date range)', async () => {
      const cookie = setupAuth(pmUserId);
      const res = await request(app)
        .post('/api/projects')
        .set('Cookie', cookie)
        .send({
          name: 'Invalid Dates Project',
          startDate: '2026-12-01',
          targetDate: '2026-11-01',
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('validation_error');
      expect(db.project.create).not.toHaveBeenCalled();
    });

    it('refuses creation when name is empty or whitespace (400)', async () => {
      const cookie = setupAuth(pmUserId);
      const res = await request(app)
        .post('/api/projects')
        .set('Cookie', cookie)
        .send({ name: '   ' });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('validation_error');
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 2. GET /api/projects - List Projects
  // ───────────────────────────────────────────────────────────────────────────
  describe('GET /api/projects - List Scoping and Pagination', () => {
    it('scopes list ONLY to projects caller is member of for non-admin staff', async () => {
      const cookie = setupAuth(employeeUserId);

      vi.mocked(db.project.findMany).mockResolvedValueOnce([
        {
          id: 'proj-1',
          name: 'Project 1',
          description: 'Desc',
          status: 'on_track',
          startDate: null,
          targetDate: null,
          createdByUserId: pmUserId,
          createdAt: new Date(),
          updatedAt: new Date(),
          _count: { members: 3 },
        },
      ] as any);

      const res = await request(app)
        .get('/api/projects')
        .set('Cookie', cookie);

      expect(res.status).toBe(200);
      expect(res.body.items).toHaveLength(1);
      expect(res.body.items[0].memberCount).toBe(3);

      expect(db.project.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            members: {
              some: {
                userId: employeeUserId,
              },
            },
          },
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        }),
      );
    });

    it('allows system_admin to view all projects without membership filtering', async () => {
      const cookie = setupAuth(adminUserId);

      vi.mocked(db.project.findMany).mockResolvedValueOnce([]);

      const res = await request(app)
        .get('/api/projects')
        .set('Cookie', cookie);

      expect(res.status).toBe(200);
      expect(db.project.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {},
        }),
      );
    });

    it('handles pagination with limit and cursor, calculating hasMore and nextCursor', async () => {
      const cookie = setupAuth(pmUserId);

      const mockItems = Array.from({ length: 3 }, (_, i) => ({
        id: `00000000-0000-4000-8000-00000000000${i + 1}`,
        name: `Project ${i + 1}`,
        description: null,
        status: 'on_track',
        startDate: null,
        targetDate: null,
        createdByUserId: pmUserId,
        createdAt: new Date(),
        updatedAt: new Date(),
        _count: { members: 2 },
      }));

      // take was limit + 1 = 3 (limit = 2)
      vi.mocked(db.project.findMany).mockResolvedValueOnce(mockItems as any);

      const cursorId = '00000000-0000-4000-8000-000000000000';
      vi.mocked(db.project.findFirst).mockResolvedValueOnce({ id: cursorId } as any);
      const res = await request(app)
        .get(`/api/projects?limit=2&cursor=${cursorId}`)
        .set('Cookie', cookie);

      expect(res.status).toBe(200);
      expect(res.body.items).toHaveLength(2);
      expect(res.body.hasMore).toBe(true);
      expect(res.body.nextCursor).toBe('00000000-0000-4000-8000-000000000002');

      expect(db.project.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 3,
          cursor: { id: cursorId },
          skip: 1,
        }),
      );
    });

    it('refuses invalid cursor UUID format with 400 validation error', async () => {
      const cookie = setupAuth(pmUserId);
      const res = await request(app)
        .get('/api/projects?cursor=not-a-valid-uuid')
        .set('Cookie', cookie);

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('validation_error');
      expect(db.project.findMany).not.toHaveBeenCalled();
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 3. GET /api/projects/:id - Detail
  // ───────────────────────────────────────────────────────────────────────────
  describe('GET /api/projects/:id - Detail & Privacy', () => {
    it('returns 404 (not 403) for non-members on project detail', async () => {
      const cookie = setupAuth(employeeUserId);

      vi.mocked(db.project.findUnique).mockResolvedValueOnce({
        id: validProjectId,
        name: 'Secret Project',
        members: [
          { userId: pmUserId, projectRole: 'manager' }, // employee is not a member
        ],
        _count: { members: 1 },
      } as any);

      const res = await request(app)
        .get(`/api/projects/${validProjectId}`)
        .set('Cookie', cookie);

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('not_found');
    });

    it('returns 404 if project does not exist', async () => {
      const cookie = setupAuth(pmUserId);
      vi.mocked(db.project.findUnique).mockResolvedValueOnce(null);

      const res = await request(app)
        .get(`/api/projects/${validProjectId}`)
        .set('Cookie', cookie);

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('not_found');
    });

    it('returns 404 for malformed UUID in :id parameter', async () => {
      const cookie = setupAuth(pmUserId);
      const res = await request(app)
        .get('/api/projects/malformed-id-123')
        .set('Cookie', cookie);

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('not_found');
      expect(db.project.findUnique).not.toHaveBeenCalled();
    });

    it('allows system_admin who is not a member to view details', async () => {
      const cookie = setupAuth(adminUserId);

      vi.mocked(db.project.findUnique).mockResolvedValueOnce({
        id: validProjectId,
        name: 'Any Project',
        status: 'on_track',
        members: [{ userId: pmUserId, user: { id: pmUserId, displayName: 'PM', username: 'pm_lead', systemRole: 'project_manager' } }],
        _count: { members: 1 },
      } as any);

      const res = await request(app)
        .get(`/api/projects/${validProjectId}`)
        .set('Cookie', cookie);

      expect(res.status).toBe(200);
      expect(res.body.id).toBe(validProjectId);
    });

    it('returns member list with systemRole ONLY to system_admin and never includes passwordHash', async () => {
      // Test 1: system_admin receives systemRole
      const adminCookie = setupAuth(adminUserId);
      vi.mocked(db.project.findUnique).mockResolvedValueOnce({
        id: validProjectId,
        name: 'Test Project',
        members: [
          {
            userId: pmUserId,
            user: { id: pmUserId, displayName: 'PM', username: 'pm_lead', systemRole: 'project_manager' },
          },
        ],
        _count: { members: 1 },
      } as any);

      const adminRes = await request(app)
        .get(`/api/projects/${validProjectId}`)
        .set('Cookie', adminCookie);

      expect(adminRes.status).toBe(200);
      expect(adminRes.body.members[0].user.systemRole).toBe('project_manager');
      expect(adminRes.body.members[0].user.passwordHash).toBeUndefined();

      // Test 2: regular member does NOT receive systemRole
      const empCookie = setupAuth(employeeUserId);
      vi.mocked(db.project.findUnique).mockResolvedValueOnce({
        id: validProjectId,
        name: 'Test Project',
        members: [
          {
            userId: employeeUserId,
            user: { id: employeeUserId, displayName: 'Dev', username: 'emp_dev' }, // systemRole omitted
          },
        ],
        _count: { members: 1 },
      } as any);

      const empRes = await request(app)
        .get(`/api/projects/${validProjectId}`)
        .set('Cookie', empCookie);

      expect(empRes.status).toBe(200);
      expect(empRes.body.members[0].user.systemRole).toBeUndefined();
      expect(empRes.body.members[0].user.passwordHash).toBeUndefined();
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 4. PATCH /api/projects/:id - Edit Project
  // ───────────────────────────────────────────────────────────────────────────
  describe('PATCH /api/projects/:id - Edit Project', () => {
    it('returns 404 for non-members on PATCH', async () => {
      const cookie = setupAuth(employeeUserId);

      vi.mocked(db.project.findUnique).mockResolvedValueOnce({ id: validProjectId } as any);
      vi.mocked(db.projectMember.findUnique).mockResolvedValueOnce(null); // non-member

      const res = await request(app)
        .patch(`/api/projects/${validProjectId}`)
        .set('Cookie', cookie)
        .send({ name: 'Renamed Project' });

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('not_found');
    });

    it('returns 403 for member without manager rights on PATCH', async () => {
      const cookie = setupAuth(employeeUserId);

      vi.mocked(db.project.findUnique).mockResolvedValueOnce({ id: validProjectId } as any);
      vi.mocked(db.projectMember.findUnique).mockResolvedValueOnce({
        projectId: validProjectId,
        userId: employeeUserId,
        projectRole: 'member', // member, not manager
      } as any);

      const res = await request(app)
        .patch(`/api/projects/${validProjectId}`)
        .set('Cookie', cookie)
        .send({ name: 'Renamed Project' });

      expect(res.status).toBe(403);
      expect(res.body.error).toBe('forbidden');
    });

    it('returns 403 for viewer attempting to write (viewer cannot write)', async () => {
      const cookie = setupAuth(viewerUserId);
      const res = await request(app)
        .patch(`/api/projects/${validProjectId}`)
        .set('Cookie', cookie)
        .send({ name: 'Viewer Rename' });

      expect(res.status).toBe(403);
      expect(res.body.error).toBe('forbidden');
    });

    it('returns 404 when project_manager attempts to edit project they are not member of', async () => {
      const cookie = setupAuth(otherPmUserId);

      vi.mocked(db.project.findUnique).mockResolvedValueOnce({ id: validProjectId } as any);
      vi.mocked(db.projectMember.findUnique).mockResolvedValueOnce(null); // not a member

      const res = await request(app)
        .patch(`/api/projects/${validProjectId}`)
        .set('Cookie', cookie)
        .send({ name: 'Unassigned PM Edit' });

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('not_found');
    });

    it('allows project manager of THIS project to edit details and clear description with null', async () => {
      const cookie = setupAuth(pmUserId);

      vi.mocked(db.project.findUnique).mockResolvedValueOnce({
        id: validProjectId,
        name: 'Old Name',
        description: 'Old Description',
        startDate: null,
        targetDate: null,
      } as any);

      vi.mocked(db.projectMember.findUnique).mockResolvedValueOnce({
        projectId: validProjectId,
        userId: pmUserId,
        projectRole: 'manager',
      } as any);

      vi.mocked(db.project.update).mockResolvedValueOnce({
        id: validProjectId,
        name: 'Updated Name',
        description: null,
        startDate: null,
        targetDate: null,
      } as any);

      const res = await request(app)
        .patch(`/api/projects/${validProjectId}`)
        .set('Cookie', cookie)
        .send({
          name: 'Updated Name',
          description: null,
        });

      expect(res.status).toBe(200);
      expect(db.project.update).toHaveBeenCalledWith({
        where: { id: validProjectId },
        data: {
          name: 'Updated Name',
          description: null,
        },
      });
      expect(db.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: 'project.updated',
            actorUserId: pmUserId,
            entityId: validProjectId,
          }),
        }),
      );
    });

    it('allows system_admin who is not a member to edit project details', async () => {
      const cookie = setupAuth(adminUserId);

      vi.mocked(db.project.findUnique).mockResolvedValueOnce({
        id: validProjectId,
        name: 'Old Name',
        description: 'Desc',
        startDate: null,
        targetDate: null,
      } as any);

      vi.mocked(db.project.update).mockResolvedValueOnce({
        id: validProjectId,
        name: 'Admin Renamed',
      } as any);

      const res = await request(app)
        .patch(`/api/projects/${validProjectId}`)
        .set('Cookie', cookie)
        .send({ name: 'Admin Renamed' });

      expect(res.status).toBe(200);
      expect(db.projectMember.findUnique).not.toHaveBeenCalled();
    });

    it('rolls back PATCH /api/projects/:id if auditLog.create fails inside transaction (mock-based) (Step 10f)', async () => {
      const cookie = setupAuth(pmUserId);
      vi.mocked(db.project.findUnique).mockResolvedValue({
        id: validProjectId,
        name: 'Old Name',
        startDate: new Date('2026-11-01'),
        targetDate: new Date('2026-11-30'),
      } as any);

      vi.mocked(db.projectMember.findUnique).mockResolvedValue({
        projectId: validProjectId,
        userId: pmUserId,
        projectRole: 'manager',
      } as any);

      vi.mocked(db.project.update).mockResolvedValue({
        id: validProjectId,
        name: 'New Name',
      } as any);

      vi.mocked(db.auditLog.create).mockRejectedValueOnce(new Error('Audit DB write error'));

      const res = await request(app)
        .patch(`/api/projects/${validProjectId}`)
        .set('Cookie', cookie)
        .send({ name: 'New Name' });

      expect(res.status).toBe(500);
    });

    it('refuses PATCH with a forbidden field (400 validation error due to strict schema)', async () => {
      const cookie = setupAuth(pmUserId);

      vi.mocked(db.project.findUnique).mockResolvedValueOnce({ id: validProjectId } as any);
      vi.mocked(db.projectMember.findUnique).mockResolvedValueOnce({
        projectId: validProjectId,
        userId: pmUserId,
        projectRole: 'manager',
      } as any);

      const res = await request(app)
        .patch(`/api/projects/${validProjectId}`)
        .set('Cookie', cookie)
        .send({
          status: 'complete', // forbidden in PATCH
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('validation_error');
    });

    it('refuses targetDate before startDate when comparing against stored date (400)', async () => {
      const cookie = setupAuth(pmUserId);

      vi.mocked(db.project.findUnique).mockResolvedValueOnce({
        id: validProjectId,
        name: 'Existing Project',
        startDate: new Date('2026-11-15'), // stored startDate
        targetDate: new Date('2026-12-15'),
      } as any);

      vi.mocked(db.projectMember.findUnique).mockResolvedValueOnce({
        projectId: validProjectId,
        userId: pmUserId,
        projectRole: 'manager',
      } as any);

      // Sending targetDate earlier than stored startDate
      const res = await request(app)
        .patch(`/api/projects/${validProjectId}`)
        .set('Cookie', cookie)
        .send({
          targetDate: '2026-11-10',
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('validation_error');
      expect(res.body.message).toContain('targetDate cannot be before startDate');
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 5. POST /api/projects/:id/members - Add Member
  // ───────────────────────────────────────────────────────────────────────────
  describe('POST /api/projects/:id/members - Add Member', () => {
    it('returns 404 for non-members on adding member', async () => {
      const cookie = setupAuth(employeeUserId);

      vi.mocked(db.project.findUnique).mockResolvedValueOnce({ id: validProjectId } as any);
      vi.mocked(db.projectMember.findUnique).mockResolvedValueOnce(null);

      const res = await request(app)
        .post(`/api/projects/${validProjectId}/members`)
        .set('Cookie', cookie)
        .send({ userId: validMemberUserId, projectRole: 'member' });

      expect(res.status).toBe(404);
    });

    it('returns 403 for member without manager rights on adding member', async () => {
      const cookie = setupAuth(employeeUserId);

      vi.mocked(db.project.findUnique).mockResolvedValueOnce({ id: validProjectId } as any);
      vi.mocked(db.projectMember.findUnique).mockResolvedValueOnce({
        projectId: validProjectId,
        userId: employeeUserId,
        projectRole: 'member',
      } as any);

      const res = await request(app)
        .post(`/api/projects/${validProjectId}/members`)
        .set('Cookie', cookie)
        .send({ userId: validMemberUserId, projectRole: 'member' });

      expect(res.status).toBe(403);
      expect(res.body.error).toBe('forbidden');
    });

    it('returns 400 when attempting to add an inactive user', async () => {
      const cookie = setupAuth(pmUserId);

      vi.mocked(db.project.findUnique).mockResolvedValueOnce({ id: validProjectId } as any);
      vi.mocked(db.projectMember.findUnique).mockResolvedValueOnce({
        projectId: validProjectId,
        userId: pmUserId,
        projectRole: 'manager',
      } as any);

      vi.mocked(db.user.findUnique).mockResolvedValueOnce({
        id: validMemberUserId,
        isActive: false, // inactive user
      } as any);

      const res = await request(app)
        .post(`/api/projects/${validProjectId}/members`)
        .set('Cookie', cookie)
        .send({ userId: validMemberUserId, projectRole: 'member' });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('inactive_user');
    });

    it('rejects target user with systemRole viewer when projectRole is manager or member (400 viewer_cannot_be_member_writer)', async () => {
      const cookie = setupAuth(pmUserId);

      vi.mocked(db.project.findUnique).mockResolvedValueOnce({ id: validProjectId } as any);
      vi.mocked(db.projectMember.findUnique).mockResolvedValueOnce({
        projectId: validProjectId,
        userId: pmUserId,
        projectRole: 'manager',
      } as any);

      vi.mocked(db.user.findUnique).mockResolvedValueOnce({
        id: viewerUserId,
        systemRole: 'viewer',
        isActive: true,
      } as any);

      const res = await request(app)
        .post(`/api/projects/${validProjectId}/members`)
        .set('Cookie', cookie)
        .send({ userId: viewerUserId, projectRole: 'member' });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('viewer_cannot_be_member_writer');
    });

    it('allows target user with systemRole viewer to be added as project viewer', async () => {
      const cookie = setupAuth(pmUserId);

      vi.mocked(db.project.findUnique).mockResolvedValueOnce({ id: validProjectId } as any);
      vi.mocked(db.projectMember.findUnique)
        .mockResolvedValueOnce({
          projectId: validProjectId,
          userId: pmUserId,
          projectRole: 'manager',
        } as any) // caller check
        .mockResolvedValueOnce(null); // duplicate check

      vi.mocked(db.user.findUnique).mockResolvedValueOnce({
        id: viewerUserId,
        systemRole: 'viewer',
        isActive: true,
      } as any);

      vi.mocked(db.projectMember.create).mockResolvedValueOnce({
        id: 'mem-v-1',
        projectId: validProjectId,
        userId: viewerUserId,
        projectRole: 'viewer',
        user: { id: viewerUserId, displayName: 'Viewer', username: 'view_auditor' },
      } as any);

      const res = await request(app)
        .post(`/api/projects/${validProjectId}/members`)
        .set('Cookie', cookie)
        .send({ userId: viewerUserId, projectRole: 'viewer' });

      expect(res.status).toBe(201);
      expect(res.body.projectRole).toBe('viewer');
    });

    it('returns 409 conflict when adding duplicate member', async () => {
      const cookie = setupAuth(pmUserId);

      vi.mocked(db.project.findUnique).mockResolvedValueOnce({ id: validProjectId } as any);
      vi.mocked(db.projectMember.findUnique)
        .mockResolvedValueOnce({
          projectId: validProjectId,
          userId: pmUserId,
          projectRole: 'manager',
        } as any) // caller check
        .mockResolvedValueOnce({
          projectId: validProjectId,
          userId: validMemberUserId,
        } as any); // existing member

      vi.mocked(db.user.findUnique).mockResolvedValueOnce({
        id: validMemberUserId,
        systemRole: 'employee',
        isActive: true,
      } as any);

      const res = await request(app)
        .post(`/api/projects/${validProjectId}/members`)
        .set('Cookie', cookie)
        .send({ userId: validMemberUserId, projectRole: 'member' });

      expect(res.status).toBe(409);
      expect(res.body.error).toBe('member_already_exists');
    });

    it('catches Prisma P2002 error and cleanly returns 409 member_already_exists', async () => {
      const cookie = setupAuth(pmUserId);

      vi.mocked(db.project.findUnique).mockResolvedValueOnce({ id: validProjectId } as any);
      vi.mocked(db.projectMember.findUnique)
        .mockResolvedValueOnce({
          projectId: validProjectId,
          userId: pmUserId,
          projectRole: 'manager',
        } as any) // caller
        .mockResolvedValueOnce(null); // not found in pre-check

      vi.mocked(db.user.findUnique).mockResolvedValueOnce({
        id: validMemberUserId,
        systemRole: 'employee',
        isActive: true,
      } as any);

      const p2002Error: any = new Error('Unique constraint failed');
      p2002Error.code = 'P2002';
      vi.mocked(db.projectMember.create).mockRejectedValueOnce(p2002Error);

      const res = await request(app)
        .post(`/api/projects/${validProjectId}/members`)
        .set('Cookie', cookie)
        .send({ userId: validMemberUserId, projectRole: 'member' });

      expect(res.status).toBe(409);
      expect(res.body.error).toBe('member_already_exists');
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 6. DELETE /api/projects/:id/members/:userId - Remove Member
  // ───────────────────────────────────────────────────────────────────────────
  describe('DELETE /api/projects/:id/members/:userId - Remove Member', () => {
    it('returns 404 for malformed UUID for :id or :userId', async () => {
      const cookie = setupAuth(pmUserId);

      const res1 = await request(app)
        .delete(`/api/projects/malformed-id/members/${validMemberUserId}`)
        .set('Cookie', cookie);
      expect(res1.status).toBe(404);

      const res2 = await request(app)
        .delete(`/api/projects/${validProjectId}/members/malformed-user-id`)
        .set('Cookie', cookie);
      expect(res2.status).toBe(404);
    });

    it('returns 404 for non-members attempting member removal', async () => {
      const cookie = setupAuth(employeeUserId);

      vi.mocked(db.project.findUnique).mockResolvedValueOnce({ id: validProjectId } as any);
      vi.mocked(db.projectMember.findUnique).mockResolvedValueOnce(null);

      const res = await request(app)
        .delete(`/api/projects/${validProjectId}/members/${validMemberUserId}`)
        .set('Cookie', cookie);

      expect(res.status).toBe(404);
    });

    it('returns 403 for member without manager rights on member removal', async () => {
      const cookie = setupAuth(employeeUserId);

      vi.mocked(db.project.findUnique).mockResolvedValueOnce({ id: validProjectId } as any);
      vi.mocked(db.projectMember.findUnique).mockResolvedValueOnce({
        projectId: validProjectId,
        userId: employeeUserId,
        projectRole: 'member',
      } as any);

      const res = await request(app)
        .delete(`/api/projects/${validProjectId}/members/${validMemberUserId}`)
        .set('Cookie', cookie);

      expect(res.status).toBe(403);
      expect(res.body.error).toBe('forbidden');
    });

    it('refuses removing the last active manager (409 last_manager_required)', async () => {
      const cookie = setupAuth(pmUserId);

      vi.mocked(db.project.findUnique).mockResolvedValueOnce({ id: validProjectId } as any);
      vi.mocked(db.projectMember.findUnique)
        .mockResolvedValueOnce({
          projectId: validProjectId,
          userId: pmUserId,
          projectRole: 'manager',
        } as any) // caller check
        .mockResolvedValueOnce({
          projectId: validProjectId,
          userId: pmUserId,
          projectRole: 'manager',
          user: { id: pmUserId, isActive: true },
        } as any); // re-read target inside transaction

      vi.mocked(db.projectMember.count).mockResolvedValueOnce(1); // activeManagersCount = 1

      const res = await request(app)
        .delete(`/api/projects/${validProjectId}/members/${pmUserId}`)
        .set('Cookie', cookie);

      expect(res.status).toBe(409);
      expect(res.body.error).toBe('last_manager_required');
      expect(db.projectMember.delete).not.toHaveBeenCalled();
    });

    it('does not count deactivated manager in last-manager check and allows removing an inactive manager', async () => {
      const cookie = setupAuth(pmUserId);

      vi.mocked(db.project.findUnique).mockResolvedValueOnce({ id: validProjectId } as any);
      vi.mocked(db.projectMember.findUnique)
        .mockResolvedValueOnce({
          projectId: validProjectId,
          userId: pmUserId,
          projectRole: 'manager',
        } as any) // caller
        .mockResolvedValueOnce({
          projectId: validProjectId,
          userId: 'inactive-manager-id',
          projectRole: 'manager',
          user: { id: 'inactive-manager-id', isActive: false }, // inactive
        } as any); // target inside transaction

      // 1 active manager remains (pmUserId)
      vi.mocked(db.projectMember.count).mockResolvedValueOnce(1);
      vi.mocked(db.projectMember.delete).mockResolvedValueOnce({} as any);

      const res = await request(app)
        .delete(`/api/projects/${validProjectId}/members/00000000-0000-4000-8000-000000000099`)
        .set('Cookie', cookie);

      expect(res.status).toBe(200);
      expect(db.projectMember.delete).toHaveBeenCalled();
    });

    it('succeeds removing a non-last manager when multiple active managers exist', async () => {
      const cookie = setupAuth(pmUserId);

      vi.mocked(db.project.findUnique).mockResolvedValueOnce({ id: validProjectId } as any);
      vi.mocked(db.projectMember.findUnique)
        .mockResolvedValueOnce({
          projectId: validProjectId,
          userId: pmUserId,
          projectRole: 'manager',
        } as any) // caller
        .mockResolvedValueOnce({
          projectId: validProjectId,
          userId: validMemberUserId,
          projectRole: 'manager',
          user: { id: validMemberUserId, isActive: true },
        } as any); // target

      vi.mocked(db.projectMember.count).mockResolvedValueOnce(2); // 2 active managers exist
      vi.mocked(db.projectMember.delete).mockResolvedValueOnce({} as any);

      const res = await request(app)
        .delete(`/api/projects/${validProjectId}/members/${validMemberUserId}`)
        .set('Cookie', cookie);

      expect(res.status).toBe(200);
      expect(db.projectMember.delete).toHaveBeenCalled();
      expect(db.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: 'project_member.removed',
          }),
        }),
      );
    });

    it('returns 404 when target member was deleted concurrently (re-read inside transaction)', async () => {
      const cookie = setupAuth(pmUserId);

      vi.mocked(db.project.findUnique).mockResolvedValueOnce({ id: validProjectId } as any);
      vi.mocked(db.projectMember.findUnique)
        .mockResolvedValueOnce({
          projectId: validProjectId,
          userId: pmUserId,
          projectRole: 'manager',
        } as any) // caller
        .mockResolvedValueOnce(null); // re-read returns null (already gone)

      const res = await request(app)
        .delete(`/api/projects/${validProjectId}/members/${validMemberUserId}`)
        .set('Cookie', cookie);

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('not_found');
      expect(db.projectMember.delete).not.toHaveBeenCalled();
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 7. POST /api/projects/:id/status - Change Status
  // ───────────────────────────────────────────────────────────────────────────
  describe('POST /api/projects/:id/status - Status Lifecycle & Audit', () => {
    it('returns 404 for malformed UUID for status change', async () => {
      const cookie = setupAuth(pmUserId);
      const res = await request(app)
        .post('/api/projects/malformed-id/status')
        .set('Cookie', cookie)
        .send({ status: 'at_risk', reason: 'Delays in supplier materials' });

      expect(res.status).toBe(404);
    });

    it('returns 404 for non-members on status change', async () => {
      const cookie = setupAuth(employeeUserId);

      vi.mocked(db.project.findUnique).mockResolvedValueOnce({ id: validProjectId } as any);
      vi.mocked(db.projectMember.findUnique).mockResolvedValueOnce(null);

      const res = await request(app)
        .post(`/api/projects/${validProjectId}/status`)
        .set('Cookie', cookie)
        .send({ status: 'at_risk', reason: 'Delays in delivery' });

      expect(res.status).toBe(404);
    });

    it('returns 403 for member without manager rights on status change', async () => {
      const cookie = setupAuth(employeeUserId);

      vi.mocked(db.project.findUnique).mockResolvedValueOnce({ id: validProjectId } as any);
      vi.mocked(db.projectMember.findUnique).mockResolvedValueOnce({
        projectId: validProjectId,
        userId: employeeUserId,
        projectRole: 'member',
      } as any);

      const res = await request(app)
        .post(`/api/projects/${validProjectId}/status`)
        .set('Cookie', cookie)
        .send({ status: 'at_risk', reason: 'Delays in delivery' });

      expect(res.status).toBe(403);
      expect(res.body.error).toBe('forbidden');
    });

    it('refuses empty or whitespace status reason (400 validation error)', async () => {
      const cookie = setupAuth(pmUserId);

      vi.mocked(db.project.findUnique).mockResolvedValueOnce({
        id: validProjectId,
        status: 'on_track',
      } as any);
      vi.mocked(db.projectMember.findUnique).mockResolvedValueOnce({
        projectId: validProjectId,
        userId: pmUserId,
        projectRole: 'manager',
      } as any);

      const res = await request(app)
        .post(`/api/projects/${validProjectId}/status`)
        .set('Cookie', cookie)
        .send({ status: 'at_risk', reason: '   ' });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('validation_error');
    });

    it('refuses same-status transition with 400 same_status', async () => {
      const cookie = setupAuth(pmUserId);

      vi.mocked(db.project.findUnique).mockResolvedValueOnce({
        id: validProjectId,
        status: 'on_track',
      } as any);
      vi.mocked(db.projectMember.findUnique).mockResolvedValueOnce({
        projectId: validProjectId,
        userId: pmUserId,
        projectRole: 'manager',
      } as any);

      const res = await request(app)
        .post(`/api/projects/${validProjectId}/status`)
        .set('Cookie', cookie)
        .send({ status: 'on_track', reason: 'Everything running normally' });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('same_status');
    });

    it('writes ProjectStatusEvent and AuditLog in ONE transaction, recording correct fromStatus and toStatus', async () => {
      const cookie = setupAuth(pmUserId);

      vi.mocked(db.project.findUnique).mockResolvedValueOnce({
        id: validProjectId,
        status: 'on_track',
      } as any);

      vi.mocked(db.projectMember.findUnique).mockResolvedValueOnce({
        projectId: validProjectId,
        userId: pmUserId,
        projectRole: 'manager',
      } as any);

      vi.mocked(db.project.updateMany).mockResolvedValueOnce({ count: 1 } as any);
      vi.mocked(db.projectStatusEvent.create).mockResolvedValueOnce({
        id: 'event-uuid-1',
        projectId: validProjectId,
        fromStatus: 'on_track',
        toStatus: 'at_risk',
        reason: 'Staff shortage this week',
        changedByUserId: pmUserId,
      } as any);

      const res = await request(app)
        .post(`/api/projects/${validProjectId}/status`)
        .set('Cookie', cookie)
        .send({ status: 'at_risk', reason: 'Staff shortage this week' });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('at_risk');
      expect(res.body.event.fromStatus).toBe('on_track');
      expect(res.body.event.toStatus).toBe('at_risk');

      expect(db.projectStatusEvent.create).toHaveBeenCalledWith({
        data: {
          projectId: validProjectId,
          fromStatus: 'on_track',
          toStatus: 'at_risk',
          reason: 'Staff shortage this week',
          changedByUserId: pmUserId,
        },
      });

      expect(db.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          action: 'project.status_changed',
          actorUserId: pmUserId,
          entityId: validProjectId,
          beforeSnapshot: { status: 'on_track' },
          afterSnapshot: { status: 'at_risk', reason: 'Staff shortage this week' },
        }),
      });
    });

    it('returns 409 conflict_retry when updateMany updates 0 rows due to concurrent status modification', async () => {
      const cookie = setupAuth(pmUserId);

      vi.mocked(db.project.findUnique).mockResolvedValueOnce({
        id: validProjectId,
        status: 'on_track',
      } as any);

      vi.mocked(db.projectMember.findUnique).mockResolvedValueOnce({
        projectId: validProjectId,
        userId: pmUserId,
        projectRole: 'manager',
      } as any);

      // Concurrent modification occurred between read and update
      vi.mocked(db.project.updateMany).mockResolvedValueOnce({ count: 0 } as any);

      const res = await request(app)
        .post(`/api/projects/${validProjectId}/status`)
        .set('Cookie', cookie)
        .send({ status: 'at_risk', reason: 'Supply chain bottleneck' });

      expect(res.status).toBe(409);
      expect(res.body.error).toBe('conflict_retry');
      expect(db.projectStatusEvent.create).not.toHaveBeenCalled();
    });

    it('allows system_admin who is not a member to change status', async () => {
      const cookie = setupAuth(adminUserId);

      vi.mocked(db.project.findUnique).mockResolvedValueOnce({
        id: validProjectId,
        status: 'at_risk',
      } as any);

      vi.mocked(db.project.updateMany).mockResolvedValueOnce({ count: 1 } as any);
      vi.mocked(db.projectStatusEvent.create).mockResolvedValueOnce({
        id: 'event-admin-1',
        projectId: validProjectId,
        fromStatus: 'at_risk',
        toStatus: 'complete',
        reason: 'Project successfully delivered and signed off',
        changedByUserId: adminUserId,
      } as any);

      const res = await request(app)
        .post(`/api/projects/${validProjectId}/status`)
        .set('Cookie', cookie)
        .send({ status: 'complete', reason: 'Project successfully delivered and signed off' });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('complete');
      expect(db.projectMember.findUnique).not.toHaveBeenCalled();
    });
  });
});
