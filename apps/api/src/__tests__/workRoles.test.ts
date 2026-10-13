import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../app.js';
import { db } from '../db.js';

describe('Work Roles Subsystem Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mockAdminUser = {
    id: 'admin-uuid-1',
    username: 'boss',
    displayName: 'Boss Admin',
    passwordHash: 'hashed_password',
    systemRole: 'system_admin',
    isActive: true,
    mustChangePassword: false,
  };

  const mockHrUser = {
    id: 'hr-uuid-2',
    username: 'hr_lead',
    displayName: 'HR Lead',
    passwordHash: 'hashed_password',
    systemRole: 'hr_admin',
    isActive: true,
    mustChangePassword: false,
  };

  const mockPmUser = {
    id: 'pm-uuid-3',
    username: 'pm_lead',
    displayName: 'Project Manager',
    passwordHash: 'hashed_password',
    systemRole: 'project_manager',
    isActive: true,
    mustChangePassword: false,
  };

  const mockEmployeeUser = {
    id: 'employee-uuid-4',
    username: 'john_dev',
    displayName: 'John Developer',
    passwordHash: 'hashed_password',
    systemRole: 'employee',
    isActive: true,
    mustChangePassword: false,
  };

  const mockViewerUser = {
    id: 'viewer-uuid-5',
    username: 'auditor',
    displayName: 'Auditor Viewer',
    passwordHash: 'hashed_password',
    systemRole: 'viewer',
    isActive: true,
    mustChangePassword: false,
  };

  const mockAdminSession = {
    id: 'admin-session-id',
    userId: mockAdminUser.id,
    expiresAt: new Date(Date.now() + 30 * 60 * 1000),
    lastActiveAt: new Date(),
    user: mockAdminUser,
  };

  const mockHrSession = {
    id: 'hr-session-id',
    userId: mockHrUser.id,
    expiresAt: new Date(Date.now() + 30 * 60 * 1000),
    lastActiveAt: new Date(),
    user: mockHrUser,
  };

  const mockPmSession = {
    id: 'pm-session-id',
    userId: mockPmUser.id,
    expiresAt: new Date(Date.now() + 30 * 60 * 1000),
    lastActiveAt: new Date(),
    user: mockPmUser,
  };

  const mockEmployeeSession = {
    id: 'employee-session-id',
    userId: mockEmployeeUser.id,
    expiresAt: new Date(Date.now() + 30 * 60 * 1000),
    lastActiveAt: new Date(),
    user: mockEmployeeUser,
  };

  const mockViewerSession = {
    id: 'viewer-session-id',
    userId: mockViewerUser.id,
    expiresAt: new Date(Date.now() + 30 * 60 * 1000),
    lastActiveAt: new Date(),
    user: mockViewerUser,
  };

  const mockEmployeeProfile = {
    id: 'emp-profile-uuid-1',
    userId: mockEmployeeUser.id,
    employeeCode: 'EMP-JOHN_DEV',
    department: 'Engineering',
    jobTitle: 'Software Engineer',
    standardShiftHours: 8,
    workingDaysPerWeek: 5,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockWorkRoleDeveloper = {
    id: 'role-dev-uuid',
    name: 'Developer',
    description: 'Software development and technical implementation',
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockWorkRoleDesigner = {
    id: 'role-des-uuid',
    name: 'Designer',
    description: 'UI/UX and visual design work',
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockDeactivatedRole = {
    id: 'role-deactivated-uuid',
    name: 'Legacy Specialist',
    description: 'Deprecated work role category',
    isActive: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  /* -------------------------------------------------------------------------- */
  /* 1. System Admin Work Role CRUD Operations                                 */
  /* -------------------------------------------------------------------------- */
  describe('1. System Admin Work Role CRUD', () => {
    it('creates a new work role and records an audit log entry', async () => {
      const app = createApp({ csrfDisabled: true });
      vi.mocked(db.session.findUnique).mockResolvedValue(mockAdminSession as any);
      vi.mocked(db.session.update).mockResolvedValue(mockAdminSession as any);
      vi.mocked(db.workRole.findUnique).mockResolvedValue(null);
      vi.mocked(db.workRole.create).mockResolvedValue(mockWorkRoleDeveloper as any);

      const res = await request(app)
        .post('/api/admin/work-roles')
        .set('Cookie', [`IMAC_SESSION=${mockAdminSession.id}`])
        .send({
          name: 'Developer',
          description: 'Software development and technical implementation',
        });

      expect(res.status).toBe(201);
      expect(res.body.workRole.name).toBe('Developer');
      expect(db.workRole.create).toHaveBeenCalledWith({
        data: {
          name: 'Developer',
          description: 'Software development and technical implementation',
          isActive: true,
        },
      });
      expect(db.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: 'work_role.created',
            entityType: 'WorkRole',
            entityId: mockWorkRoleDeveloper.id,
          }),
        }),
      );
    });

    it('rejects duplicate work role name with HTTP 409 conflict', async () => {
      const app = createApp({ csrfDisabled: true });
      vi.mocked(db.session.findUnique).mockResolvedValue(mockAdminSession as any);
      vi.mocked(db.session.update).mockResolvedValue(mockAdminSession as any);
      vi.mocked(db.workRole.findUnique).mockResolvedValue(mockWorkRoleDeveloper as any);

      const res = await request(app)
        .post('/api/admin/work-roles')
        .set('Cookie', [`IMAC_SESSION=${mockAdminSession.id}`])
        .send({
          name: 'Developer',
          description: 'Attempting duplicate name',
        });

      expect(res.status).toBe(409);
      expect(res.body.error).toBe('conflict');
      expect(db.workRole.create).not.toHaveBeenCalled();
    });

    it('lists all work roles for system admin', async () => {
      const app = createApp({ csrfDisabled: true });
      vi.mocked(db.session.findUnique).mockResolvedValue(mockAdminSession as any);
      vi.mocked(db.session.update).mockResolvedValue(mockAdminSession as any);
      vi.mocked(db.workRole.findMany).mockResolvedValue([mockWorkRoleDeveloper, mockWorkRoleDesigner] as any);

      const res = await request(app)
        .get('/api/admin/work-roles')
        .set('Cookie', [`IMAC_SESSION=${mockAdminSession.id}`]);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body).toHaveLength(2);
    });

    it('edits a work role and records an audit log entry', async () => {
      const app = createApp({ csrfDisabled: true });
      vi.mocked(db.session.findUnique).mockResolvedValue(mockAdminSession as any);
      vi.mocked(db.session.update).mockResolvedValue(mockAdminSession as any);
      vi.mocked(db.workRole.findUnique).mockResolvedValue(mockWorkRoleDeveloper as any);
      vi.mocked(db.workRole.update).mockResolvedValue({
        ...mockWorkRoleDeveloper,
        description: 'Updated engineering scope',
      } as any);

      const res = await request(app)
        .patch(`/api/admin/work-roles/${mockWorkRoleDeveloper.id}`)
        .set('Cookie', [`IMAC_SESSION=${mockAdminSession.id}`])
        .send({ description: 'Updated engineering scope' });

      expect(res.status).toBe(200);
      expect(res.body.workRole.description).toBe('Updated engineering scope');
      expect(db.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: 'work_role.updated',
            entityType: 'WorkRole',
          }),
        }),
      );
    });

    it('deactivates a work role and records an audit log entry', async () => {
      const app = createApp({ csrfDisabled: true });
      vi.mocked(db.session.findUnique).mockResolvedValue(mockAdminSession as any);
      vi.mocked(db.session.update).mockResolvedValue(mockAdminSession as any);
      vi.mocked(db.workRole.findUnique).mockResolvedValue(mockWorkRoleDeveloper as any);
      vi.mocked(db.workRole.update).mockResolvedValue({
        ...mockWorkRoleDeveloper,
        isActive: false,
      } as any);

      const res = await request(app)
        .patch(`/api/admin/work-roles/${mockWorkRoleDeveloper.id}/deactivate`)
        .set('Cookie', [`IMAC_SESSION=${mockAdminSession.id}`]);

      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
      expect(db.workRole.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: mockWorkRoleDeveloper.id },
          data: { isActive: false },
        }),
      );
      expect(db.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: 'work_role.deactivated',
            entityType: 'WorkRole',
          }),
        }),
      );
    });
  });

  /* -------------------------------------------------------------------------- */
  /* 2. Negative RBAC Tests: Non-Admins Blocked                                 */
  /* -------------------------------------------------------------------------- */
  describe('2. RBAC Enforcement (HR, PM, Employee, Viewer cannot manage work roles)', () => {
    const nonAdminRoles = [
      { role: 'hr_admin', session: mockHrSession },
      { role: 'project_manager', session: mockPmSession },
      { role: 'employee', session: mockEmployeeSession },
      { role: 'viewer', session: mockViewerSession },
    ];

    nonAdminRoles.forEach(({ role, session }) => {
      it(`blocks ${role} from creating work roles with 403 Forbidden`, async () => {
        const app = createApp({ csrfDisabled: true });
        vi.mocked(db.session.findUnique).mockResolvedValue(session as any);
        vi.mocked(db.session.update).mockResolvedValue(session as any);

        const res = await request(app)
          .post('/api/admin/work-roles')
          .set('Cookie', [`IMAC_SESSION=${session.id}`])
          .send({ name: 'Unauthorized Role' });

        expect(res.status).toBe(403);
        expect(res.body.error).toBe('forbidden');
        expect(db.workRole.create).not.toHaveBeenCalled();
      });

      it(`blocks ${role} from editing work roles with 403 Forbidden`, async () => {
        const app = createApp({ csrfDisabled: true });
        vi.mocked(db.session.findUnique).mockResolvedValue(session as any);
        vi.mocked(db.session.update).mockResolvedValue(session as any);

        const res = await request(app)
          .patch(`/api/admin/work-roles/${mockWorkRoleDeveloper.id}`)
          .set('Cookie', [`IMAC_SESSION=${session.id}`])
          .send({ description: 'Unauthorized Edit' });

        expect(res.status).toBe(403);
        expect(res.body.error).toBe('forbidden');
      });

      it(`blocks ${role} from deactivating work roles with 403 Forbidden`, async () => {
        const app = createApp({ csrfDisabled: true });
        vi.mocked(db.session.findUnique).mockResolvedValue(session as any);
        vi.mocked(db.session.update).mockResolvedValue(session as any);

        const res = await request(app)
          .patch(`/api/admin/work-roles/${mockWorkRoleDeveloper.id}/deactivate`)
          .set('Cookie', [`IMAC_SESSION=${session.id}`]);

        expect(res.status).toBe(403);
        expect(res.body.error).toBe('forbidden');
      });

      it(`blocks ${role} from assigning work roles to an employee with 403 Forbidden`, async () => {
        const app = createApp({ csrfDisabled: true });
        vi.mocked(db.session.findUnique).mockResolvedValue(session as any);
        vi.mocked(db.session.update).mockResolvedValue(session as any);

        const res = await request(app)
          .post(`/api/admin/work-roles/employees/${mockEmployeeUser.id}/work-roles`)
          .set('Cookie', [`IMAC_SESSION=${session.id}`])
          .send({ workRoleId: mockWorkRoleDeveloper.id });

        expect(res.status).toBe(403);
        expect(res.body.error).toBe('forbidden');
        expect(db.employeeWorkRole.create).not.toHaveBeenCalled();
      });

      it(`blocks ${role} from removing assigned work roles with 403 Forbidden`, async () => {
        const app = createApp({ csrfDisabled: true });
        vi.mocked(db.session.findUnique).mockResolvedValue(session as any);
        vi.mocked(db.session.update).mockResolvedValue(session as any);

        const res = await request(app)
          .delete(`/api/admin/work-roles/employees/${mockEmployeeUser.id}/work-roles/${mockWorkRoleDeveloper.id}`)
          .set('Cookie', [`IMAC_SESSION=${session.id}`]);

        expect(res.status).toBe(403);
        expect(res.body.error).toBe('forbidden');
      });

      it(`blocks ${role} from reading admin employee assignment list with 403 Forbidden`, async () => {
        const app = createApp({ csrfDisabled: true });
        vi.mocked(db.session.findUnique).mockResolvedValue(session as any);
        vi.mocked(db.session.update).mockResolvedValue(session as any);

        const res = await request(app)
          .get(`/api/admin/work-roles/employees/${mockEmployeeUser.id}`)
          .set('Cookie', [`IMAC_SESSION=${session.id}`]);

        expect(res.status).toBe(403);
        expect(res.body.error).toBe('forbidden');
      });
    });
  });

  /* -------------------------------------------------------------------------- */
  /* 3. Assignment Business Logic & Edge Cases                                  */
  /* -------------------------------------------------------------------------- */
  describe('3. Assignment Business Rules', () => {
    it('successfully assigns an active work role to an employee with audit entry', async () => {
      const app = createApp({ csrfDisabled: true });
      vi.mocked(db.session.findUnique).mockResolvedValue(mockAdminSession as any);
      vi.mocked(db.session.update).mockResolvedValue(mockAdminSession as any);
      vi.mocked(db.employeeProfile.findFirst).mockResolvedValue(mockEmployeeProfile as any);
      vi.mocked(db.workRole.findUnique).mockResolvedValue(mockWorkRoleDeveloper as any);
      vi.mocked(db.employeeWorkRole.findUnique).mockResolvedValue(null);
      vi.mocked(db.employeeWorkRole.create).mockResolvedValue({
        id: 'assignment-uuid-1',
        employeeProfileId: mockEmployeeProfile.id,
        workRoleId: mockWorkRoleDeveloper.id,
        workRole: mockWorkRoleDeveloper,
      } as any);

      const res = await request(app)
        .post(`/api/admin/work-roles/employees/${mockEmployeeProfile.id}/work-roles`)
        .set('Cookie', [`IMAC_SESSION=${mockAdminSession.id}`])
        .send({ workRoleId: mockWorkRoleDeveloper.id });

      expect(res.status).toBe(201);
      expect(res.body.assignment.workRoleId).toBe(mockWorkRoleDeveloper.id);
      expect(db.employeeWorkRole.create).toHaveBeenCalled();
      expect(db.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: 'work_role.assigned',
            entityType: 'EmployeeWorkRole',
          }),
        }),
      );
    });

    it('rejects assignment of the same role twice to prevent duplicates (HTTP 409)', async () => {
      const app = createApp({ csrfDisabled: true });
      vi.mocked(db.session.findUnique).mockResolvedValue(mockAdminSession as any);
      vi.mocked(db.session.update).mockResolvedValue(mockAdminSession as any);
      vi.mocked(db.employeeProfile.findFirst).mockResolvedValue(mockEmployeeProfile as any);
      vi.mocked(db.workRole.findUnique).mockResolvedValue(mockWorkRoleDeveloper as any);
      // Existing assignment already present
      vi.mocked(db.employeeWorkRole.findUnique).mockResolvedValue({
        id: 'existing-assignment-id',
        employeeProfileId: mockEmployeeProfile.id,
        workRoleId: mockWorkRoleDeveloper.id,
      } as any);

      const res = await request(app)
        .post(`/api/admin/work-roles/employees/${mockEmployeeProfile.id}/work-roles`)
        .set('Cookie', [`IMAC_SESSION=${mockAdminSession.id}`])
        .send({ workRoleId: mockWorkRoleDeveloper.id });

      expect(res.status).toBe(409);
      expect(res.body.error).toBe('conflict');
      expect(db.employeeWorkRole.create).not.toHaveBeenCalled();
    });

    it('rejects assignment of a deactivated work role with HTTP 400 invalid_action', async () => {
      const app = createApp({ csrfDisabled: true });
      vi.mocked(db.session.findUnique).mockResolvedValue(mockAdminSession as any);
      vi.mocked(db.session.update).mockResolvedValue(mockAdminSession as any);
      vi.mocked(db.employeeProfile.findFirst).mockResolvedValue(mockEmployeeProfile as any);
      // Role is deactivated
      vi.mocked(db.workRole.findUnique).mockResolvedValue(mockDeactivatedRole as any);

      const res = await request(app)
        .post(`/api/admin/work-roles/employees/${mockEmployeeProfile.id}/work-roles`)
        .set('Cookie', [`IMAC_SESSION=${mockAdminSession.id}`])
        .send({ workRoleId: mockDeactivatedRole.id });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('invalid_action');
      expect(res.body.message).toContain('deactivated');
      expect(db.employeeWorkRole.create).not.toHaveBeenCalled();
    });

    it('removes assigned work role and logs audit entry', async () => {
      const app = createApp({ csrfDisabled: true });
      vi.mocked(db.session.findUnique).mockResolvedValue(mockAdminSession as any);
      vi.mocked(db.session.update).mockResolvedValue(mockAdminSession as any);
      vi.mocked(db.employeeProfile.findFirst).mockResolvedValue(mockEmployeeProfile as any);
      vi.mocked(db.employeeWorkRole.findUnique).mockResolvedValue({
        id: 'assignment-to-delete-id',
        employeeProfileId: mockEmployeeProfile.id,
        workRoleId: mockWorkRoleDeveloper.id,
      } as any);
      vi.mocked(db.employeeWorkRole.delete).mockResolvedValue({} as any);

      const res = await request(app)
        .delete(`/api/admin/work-roles/employees/${mockEmployeeProfile.id}/work-roles/${mockWorkRoleDeveloper.id}`)
        .set('Cookie', [`IMAC_SESSION=${mockAdminSession.id}`]);

      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
      expect(db.employeeWorkRole.delete).toHaveBeenCalledWith({
        where: { id: 'assignment-to-delete-id' },
      });
      expect(db.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: 'work_role.removed',
            entityType: 'EmployeeWorkRole',
          }),
        }),
      );
    });

    it('lists all assigned work roles for one employee (admin view)', async () => {
      const app = createApp({ csrfDisabled: true });
      vi.mocked(db.session.findUnique).mockResolvedValue(mockAdminSession as any);
      vi.mocked(db.session.update).mockResolvedValue(mockAdminSession as any);
      vi.mocked(db.employeeProfile.findFirst).mockResolvedValue(mockEmployeeProfile as any);
      vi.mocked(db.employeeWorkRole.findMany).mockResolvedValue([
        { id: '1', workRole: mockWorkRoleDeveloper },
        { id: '2', workRole: mockWorkRoleDesigner },
      ] as any);

      const res = await request(app)
        .get(`/api/admin/work-roles/employees/${mockEmployeeProfile.id}`)
        .set('Cookie', [`IMAC_SESSION=${mockAdminSession.id}`]);

      expect(res.status).toBe(200);
      expect(res.body.workRoles).toHaveLength(2);
      expect(res.body.workRoles[0].name).toBe('Developer');
      expect(res.body.workRoles[1].name).toBe('Designer');
    });
  });

  /* -------------------------------------------------------------------------- */
  /* 4. Employee Self-Service & IDOR Protection                                 */
  /* -------------------------------------------------------------------------- */
  describe('4. Employee Self-Service & Access Isolation', () => {
    it('employee can list only their own active assigned work roles', async () => {
      const app = createApp({ csrfDisabled: true });
      vi.mocked(db.session.findUnique).mockResolvedValue(mockEmployeeSession as any);
      vi.mocked(db.session.update).mockResolvedValue(mockEmployeeSession as any);
      vi.mocked(db.employeeProfile.findUnique).mockResolvedValue(mockEmployeeProfile as any);
      vi.mocked(db.employeeWorkRole.findMany).mockResolvedValue([
        { id: '1', workRole: mockWorkRoleDeveloper },
      ] as any);

      const res = await request(app)
        .get('/api/work-roles/my-roles')
        .set('Cookie', [`IMAC_SESSION=${mockEmployeeSession.id}`]);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body).toHaveLength(1);
      expect(res.body[0].name).toBe('Developer');
      expect(db.employeeWorkRole.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            employeeProfileId: mockEmployeeProfile.id,
            workRole: { isActive: true },
          },
        }),
      );
    });

    it('employee cannot read another employee assignments via admin endpoint', async () => {
      const app = createApp({ csrfDisabled: true });
      vi.mocked(db.session.findUnique).mockResolvedValue(mockEmployeeSession as any);
      vi.mocked(db.session.update).mockResolvedValue(mockEmployeeSession as any);

      const otherEmployeeId = 'other-employee-uuid-99';
      const res = await request(app)
        .get(`/api/admin/work-roles/employees/${otherEmployeeId}`)
        .set('Cookie', [`IMAC_SESSION=${mockEmployeeSession.id}`]);

      // Must be blocked with 403 Forbidden
      expect(res.status).toBe(403);
      expect(res.body.error).toBe('forbidden');
      expect(db.employeeWorkRole.findMany).not.toHaveBeenCalled();
    });
  });

  /* -------------------------------------------------------------------------- */
  /* 5. CSRF Protection on Work Role Admin Routes                              */
  /* -------------------------------------------------------------------------- */
  describe('5. CSRF Protection Enforcement', () => {
    it('rejects POST /api/admin/work-roles without CSRF token with HTTP 403', async () => {
      const app = createApp({ csrfEnabled: true });
      vi.mocked(db.session.findUnique).mockResolvedValue(mockAdminSession as any);
      vi.mocked(db.session.update).mockResolvedValue(mockAdminSession as any);

      const res = await request(app)
        .post('/api/admin/work-roles')
        .set('Cookie', [`IMAC_SESSION=${mockAdminSession.id}`])
        .send({ name: 'CSRF Attack Role' });

      expect(res.status).toBe(403);
      expect(res.body.error).toBe('csrf_invalid');
    });

    it('rejects PATCH /api/admin/work-roles/:id/deactivate without CSRF token with HTTP 403', async () => {
      const app = createApp({ csrfEnabled: true });
      vi.mocked(db.session.findUnique).mockResolvedValue(mockAdminSession as any);
      vi.mocked(db.session.update).mockResolvedValue(mockAdminSession as any);

      const res = await request(app)
        .patch(`/api/admin/work-roles/${mockWorkRoleDeveloper.id}/deactivate`)
        .set('Cookie', [`IMAC_SESSION=${mockAdminSession.id}`]);

      expect(res.status).toBe(403);
      expect(res.body.error).toBe('csrf_invalid');
    });

    it('rejects assign POST without CSRF token with HTTP 403', async () => {
      const app = createApp({ csrfEnabled: true });
      vi.mocked(db.session.findUnique).mockResolvedValue(mockAdminSession as any);
      vi.mocked(db.session.update).mockResolvedValue(mockAdminSession as any);

      const res = await request(app)
        .post(`/api/admin/work-roles/employees/${mockEmployeeProfile.id}/work-roles`)
        .set('Cookie', [`IMAC_SESSION=${mockAdminSession.id}`])
        .send({ workRoleId: mockWorkRoleDeveloper.id });

      expect(res.status).toBe(403);
      expect(res.body.error).toBe('csrf_invalid');
    });

    it('rejects remove DELETE without CSRF token with HTTP 403', async () => {
      const app = createApp({ csrfEnabled: true });
      vi.mocked(db.session.findUnique).mockResolvedValue(mockAdminSession as any);
      vi.mocked(db.session.update).mockResolvedValue(mockAdminSession as any);

      const res = await request(app)
        .delete(`/api/admin/work-roles/employees/${mockEmployeeProfile.id}/work-roles/${mockWorkRoleDeveloper.id}`)
        .set('Cookie', [`IMAC_SESSION=${mockAdminSession.id}`]);

      expect(res.status).toBe(403);
      expect(res.body.error).toBe('csrf_invalid');
    });
  });
});
