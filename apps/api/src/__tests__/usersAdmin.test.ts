import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../app.js';
import { db } from '../db.js';

describe('User & Employee Administration and Directory Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mockAdminUser = {
    id: 'admin-uuid-1',
    username: 'boss',
    displayName: 'Boss Admin',
    passwordHash: 'hashed_password_12345',
    systemRole: 'system_admin',
    isActive: true,
    mustChangePassword: false,
    failedLoginCount: 0,
    lockedUntil: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockHrUser = {
    id: 'hr-uuid-2',
    username: 'hr_lead',
    displayName: 'HR Lead',
    passwordHash: 'hashed_password_12345',
    systemRole: 'hr_admin',
    isActive: true,
    mustChangePassword: false,
    failedLoginCount: 0,
    lockedUntil: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockPmUser = {
    id: 'pm-uuid-3',
    username: 'pm_lead',
    displayName: 'Project Manager Lead',
    passwordHash: 'hashed_password_12345',
    systemRole: 'project_manager',
    isActive: true,
    mustChangePassword: false,
    failedLoginCount: 0,
    lockedUntil: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockEmployeeUser = {
    id: 'employee-uuid-4',
    username: 'john_dev',
    displayName: 'John Developer',
    passwordHash: 'hashed_password_12345',
    systemRole: 'employee',
    isActive: true,
    mustChangePassword: false,
    failedLoginCount: 0,
    lockedUntil: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockOtherEmployeeUser = {
    id: 'employee-uuid-5',
    username: 'jane_des',
    displayName: 'Jane Designer',
    passwordHash: 'hashed_password_secret',
    systemRole: 'employee',
    isActive: true,
    mustChangePassword: false,
    failedLoginCount: 3,
    lockedUntil: new Date(Date.now() + 15 * 60 * 1000),
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockViewerUser = {
    id: 'viewer-uuid-6',
    username: 'auditor',
    displayName: 'Auditor Viewer',
    passwordHash: 'hashed_password_12345',
    systemRole: 'viewer',
    isActive: true,
    mustChangePassword: false,
    failedLoginCount: 0,
    lockedUntil: null,
    createdAt: new Date(),
    updatedAt: new Date(),
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
    id: 'emp-profile-1',
    userId: mockEmployeeUser.id,
    employeeCode: 'EMP-JOHN_DEV',
    department: 'Engineering',
    jobTitle: 'Backend Engineer',
    startDate: new Date('2026-01-15'),
    standardShiftHours: 8,
    workingDaysPerWeek: 5,
    managerUserId: mockAdminUser.id,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockOtherProfile = {
    id: 'emp-profile-2',
    userId: mockOtherEmployeeUser.id,
    employeeCode: 'EMP-JANE_DES',
    department: 'Design',
    jobTitle: 'Lead Designer',
    startDate: new Date('2026-02-01'),
    standardShiftHours: 7.5,
    workingDaysPerWeek: 5,
    managerUserId: mockAdminUser.id,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  /* -------------------------------------------------------------------------- */
  /* 1. Admin User & Profile Management                                         */
  /* -------------------------------------------------------------------------- */
  describe('1. Admin User & Profile Management', () => {
    it('creates a new user and employee profile concurrently with audit log', async () => {
      const app = createApp({ csrfDisabled: true });
      vi.mocked(db.session.findUnique).mockResolvedValue(mockAdminSession as any);
      vi.mocked(db.session.update).mockResolvedValue(mockAdminSession as any);
      vi.mocked(db.user.findUnique).mockResolvedValue(null);
      vi.mocked(db.employeeProfile.findUnique).mockResolvedValue(null);
      vi.mocked(db.user.create).mockResolvedValue({
        id: 'new-user-id',
        username: 'alice_eng',
        displayName: 'Alice Engineer',
        systemRole: 'employee',
        isActive: true,
        mustChangePassword: true,
        failedLoginCount: 0,
        lockedUntil: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        employeeProfile: {
          id: 'new-profile-id',
          userId: 'new-user-id',
          employeeCode: 'EMP-ALICE',
          department: 'Engineering',
          jobTitle: 'Software Engineer',
          startDate: new Date('2026-03-01'),
          standardShiftHours: 8,
          workingDaysPerWeek: 5,
          managerUserId: null,
        },
      } as any);

      const res = await request(app)
        .post('/api/admin/users')
        .set('Cookie', [`IMAC_SESSION=${mockAdminSession.id}`])
        .send({
          username: 'alice_eng',
          displayName: 'Alice Engineer',
          systemRole: 'employee',
          employeeCode: 'EMP-ALICE',
          department: 'Engineering',
          jobTitle: 'Software Engineer',
          startDate: '2026-03-01',
          standardShiftHours: 8,
          workingDaysPerWeek: 5,
        });

      expect(res.status).toBe(201);
      expect(res.body.user.username).toBe('alice_eng');
      expect(res.body.temporaryPassword).toBeDefined();
      expect(res.body.user.employeeProfile.department).toBe('Engineering');
      expect(db.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: 'user.created',
            entityType: 'User',
          }),
        }),
      );
    });

    it('edits an employee profile and records an audit log entry', async () => {
      const app = createApp({ csrfDisabled: true });
      vi.mocked(db.session.findUnique).mockResolvedValue(mockAdminSession as any);
      vi.mocked(db.session.update).mockResolvedValue(mockAdminSession as any);
      vi.mocked(db.user.findUnique).mockResolvedValue({
        ...mockEmployeeUser,
        employeeProfile: mockEmployeeProfile,
      } as any);
      vi.mocked(db.employeeProfile.upsert).mockResolvedValue({
        ...mockEmployeeProfile,
        department: 'Core Infrastructure',
        jobTitle: 'Senior Systems Engineer',
        standardShiftHours: 8.5,
        workingDaysPerWeek: 5,
      } as any);

      const res = await request(app)
        .patch(`/api/admin/users/${mockEmployeeUser.id}/profile`)
        .set('Cookie', [`IMAC_SESSION=${mockAdminSession.id}`])
        .send({
          department: 'Core Infrastructure',
          jobTitle: 'Senior Systems Engineer',
          standardShiftHours: 8.5,
          workingDaysPerWeek: 5,
        });

      expect(res.status).toBe(200);
      expect(res.body.employeeProfile.department).toBe('Core Infrastructure');
      expect(res.body.employeeProfile.jobTitle).toBe('Senior Systems Engineer');
      expect(db.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: 'employee_profile.updated',
            entityType: 'EmployeeProfile',
          }),
        }),
      );
    });

    it('allows HR admin to update employee profile (user:update)', async () => {
      const app = createApp({ csrfDisabled: true });
      vi.mocked(db.session.findUnique).mockResolvedValue(mockHrSession as any);
      vi.mocked(db.session.update).mockResolvedValue(mockHrSession as any);
      vi.mocked(db.user.findUnique).mockResolvedValue({
        ...mockEmployeeUser,
        employeeProfile: mockEmployeeProfile,
      } as any);
      vi.mocked(db.employeeProfile.upsert).mockResolvedValue({
        ...mockEmployeeProfile,
        jobTitle: 'Staff Engineer',
      } as any);

      const res = await request(app)
        .patch(`/api/admin/users/${mockEmployeeUser.id}/profile`)
        .set('Cookie', [`IMAC_SESSION=${mockHrSession.id}`])
        .send({ jobTitle: 'Staff Engineer' });

      expect(res.status).toBe(200);
      expect(res.body.employeeProfile.jobTitle).toBe('Staff Engineer');
    });

    it('deactivating a user revokes all active sessions for that user', async () => {
      const app = createApp({ csrfDisabled: true });
      vi.mocked(db.session.findUnique).mockResolvedValue(mockAdminSession as any);
      vi.mocked(db.session.update).mockResolvedValue(mockAdminSession as any);
      vi.mocked(db.user.findUnique).mockResolvedValue(mockEmployeeUser as any);
      vi.mocked(db.user.update).mockResolvedValue({ ...mockEmployeeUser, isActive: false } as any);
      vi.mocked(db.session.deleteMany).mockResolvedValue({ count: 2 });

      const res = await request(app)
        .patch(`/api/admin/users/${mockEmployeeUser.id}/deactivate`)
        .set('Cookie', [`IMAC_SESSION=${mockAdminSession.id}`]);

      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
      expect(db.session.deleteMany).toHaveBeenCalledWith({
        where: { userId: mockEmployeeUser.id },
      });
      expect(db.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: 'user.deactivated',
            entityType: 'User',
            entityId: mockEmployeeUser.id,
          }),
        }),
      );
    });
  });

  /* -------------------------------------------------------------------------- */
  /* 2. Negative RBAC Tests                                                     */
  /* -------------------------------------------------------------------------- */
  describe('2. RBAC Enforcement (System Roles & Privilege Escalation)', () => {
    it('HR cannot change system roles with HTTP 403 Forbidden', async () => {
      const app = createApp({ csrfDisabled: true });
      vi.mocked(db.session.findUnique).mockResolvedValue(mockHrSession as any);
      vi.mocked(db.session.update).mockResolvedValue(mockHrSession as any);

      const res = await request(app)
        .patch(`/api/admin/users/${mockEmployeeUser.id}/role`)
        .set('Cookie', [`IMAC_SESSION=${mockHrSession.id}`])
        .send({ systemRole: 'system_admin' });

      expect(res.status).toBe(403);
      expect(res.body.error).toBe('forbidden');
      expect(db.user.update).not.toHaveBeenCalled();
    });

    it('HR cannot create users with HTTP 403 Forbidden', async () => {
      const app = createApp({ csrfDisabled: true });
      vi.mocked(db.session.findUnique).mockResolvedValue(mockHrSession as any);
      vi.mocked(db.session.update).mockResolvedValue(mockHrSession as any);

      const res = await request(app)
        .post('/api/admin/users')
        .set('Cookie', [`IMAC_SESSION=${mockHrSession.id}`])
        .send({ username: 'newbie', displayName: 'Newbie', systemRole: 'employee' });

      expect(res.status).toBe(403);
      expect(res.body.error).toBe('forbidden');
    });

    it('HR cannot deactivate users with HTTP 403 Forbidden', async () => {
      const app = createApp({ csrfDisabled: true });
      vi.mocked(db.session.findUnique).mockResolvedValue(mockHrSession as any);
      vi.mocked(db.session.update).mockResolvedValue(mockHrSession as any);

      const res = await request(app)
        .patch(`/api/admin/users/${mockEmployeeUser.id}/deactivate`)
        .set('Cookie', [`IMAC_SESSION=${mockHrSession.id}`]);

      expect(res.status).toBe(403);
      expect(res.body.error).toBe('forbidden');
    });

    const nonAdminRoles = [
      { role: 'project_manager', session: mockPmSession },
      { role: 'employee', session: mockEmployeeSession },
      { role: 'viewer', session: mockViewerSession },
    ];

    nonAdminRoles.forEach(({ role, session }) => {
      it(`blocks ${role} from editing employee profile with HTTP 403 Forbidden`, async () => {
        const app = createApp({ csrfDisabled: true });
        vi.mocked(db.session.findUnique).mockResolvedValue(session as any);
        vi.mocked(db.session.update).mockResolvedValue(session as any);

        const res = await request(app)
          .patch(`/api/admin/users/${mockEmployeeUser.id}/profile`)
          .set('Cookie', [`IMAC_SESSION=${session.id}`])
          .send({ jobTitle: 'Hacked Title' });

        expect(res.status).toBe(403);
        expect(res.body.error).toBe('forbidden');
      });

      it(`blocks ${role} from changing system roles with HTTP 403 Forbidden`, async () => {
        const app = createApp({ csrfDisabled: true });
        vi.mocked(db.session.findUnique).mockResolvedValue(session as any);
        vi.mocked(db.session.update).mockResolvedValue(session as any);

        const res = await request(app)
          .patch(`/api/admin/users/${mockEmployeeUser.id}/role`)
          .set('Cookie', [`IMAC_SESSION=${session.id}`])
          .send({ systemRole: 'system_admin' });

        expect(res.status).toBe(403);
        expect(res.body.error).toBe('forbidden');
      });
    });
  });

  /* -------------------------------------------------------------------------- */
  /* 3. Employee Directory API & Field-Level Access Control                     */
  /* -------------------------------------------------------------------------- */
  describe('3. Employee Directory & Field Redaction', () => {
    const mockDirectoryUsers = [
      {
        id: mockAdminUser.id,
        username: mockAdminUser.username,
        displayName: mockAdminUser.displayName,
        systemRole: mockAdminUser.systemRole,
        isActive: true,
        createdAt: mockAdminUser.createdAt,
        employeeProfile: {
          id: 'emp-profile-admin',
          employeeCode: 'EMP-BOSS',
          department: 'Executive',
          jobTitle: 'Managing Director',
          startDate: new Date('2020-01-01'),
          standardShiftHours: 8,
          workingDaysPerWeek: 5,
          managerUserId: null,
        },
        availabilityStatus: {
          status: 'available',
          message: 'In office',
          expiresAt: null,
        },
      },
      {
        id: mockOtherEmployeeUser.id,
        username: mockOtherEmployeeUser.username,
        displayName: mockOtherEmployeeUser.displayName,
        systemRole: mockOtherEmployeeUser.systemRole,
        isActive: true,
        createdAt: mockOtherEmployeeUser.createdAt,
        employeeProfile: mockOtherProfile,
        availabilityStatus: {
          status: 'busy_in_meeting',
          message: 'Design review until 3pm',
          expiresAt: null,
        },
      },
    ];

    it('ordinary employee sees only permitted public fields in the directory', async () => {
      const app = createApp({ csrfDisabled: true });
      vi.mocked(db.session.findUnique).mockResolvedValue(mockEmployeeSession as any);
      vi.mocked(db.session.update).mockResolvedValue(mockEmployeeSession as any);
      vi.mocked(db.user.findMany).mockResolvedValue(mockDirectoryUsers as any);

      const res = await request(app)
        .get('/api/employees')
        .set('Cookie', [`IMAC_SESSION=${mockEmployeeSession.id}`]);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body).toHaveLength(2);

      const entry = res.body[1];
      // Permitted public fields
      expect(entry.id).toBe(mockOtherEmployeeUser.id);
      expect(entry.displayName).toBe(mockOtherEmployeeUser.displayName);
      expect(entry.department).toBe('Design');
      expect(entry.jobTitle).toBe('Lead Designer');
      expect(entry.availability).toBe('busy_in_meeting');
      expect(entry.availabilityMessage).toBe('Design review until 3pm');

      // Private data MUST be absent
      expect(entry.passwordHash).toBeUndefined();
      expect(entry.failedLoginCount).toBeUndefined();
      expect(entry.lockedUntil).toBeUndefined();
      expect(entry.employeeCode).toBeUndefined();
      expect(entry.standardShiftHours).toBeUndefined();
      expect(entry.workingDaysPerWeek).toBeUndefined();
      expect(entry.startDate).toBeUndefined();
      expect(entry.username).toBeUndefined();
    });

    it('directory responses NEVER contain passwordHash, failedLoginCount, or lockedUntil for any caller', async () => {
      const app = createApp({ csrfDisabled: true });
      vi.mocked(db.session.findUnique).mockResolvedValue(mockAdminSession as any);
      vi.mocked(db.session.update).mockResolvedValue(mockAdminSession as any);
      vi.mocked(db.user.findMany).mockResolvedValue(mockDirectoryUsers as any);

      const res = await request(app)
        .get('/api/employees')
        .set('Cookie', [`IMAC_SESSION=${mockAdminSession.id}`]);

      expect(res.status).toBe(200);
      res.body.forEach((user: any) => {
        expect(user.passwordHash).toBeUndefined();
        expect(user.failedLoginCount).toBeUndefined();
        expect(user.lockedUntil).toBeUndefined();
      });
    });

    it('system admin and HR see extended administrative fields in the directory', async () => {
      const app = createApp({ csrfDisabled: true });
      vi.mocked(db.session.findUnique).mockResolvedValue(mockHrSession as any);
      vi.mocked(db.session.update).mockResolvedValue(mockHrSession as any);
      vi.mocked(db.user.findMany).mockResolvedValue(mockDirectoryUsers as any);

      const res = await request(app)
        .get('/api/employees')
        .set('Cookie', [`IMAC_SESSION=${mockHrSession.id}`]);

      expect(res.status).toBe(200);
      const entry = res.body[1];
      expect(entry.username).toBe(mockOtherEmployeeUser.username);
      expect(entry.employeeCode).toBe('EMP-JANE_DES');
      expect(entry.standardShiftHours).toBe(7.5);
      expect(entry.workingDaysPerWeek).toBe(5);
    });

    it('employees can read their own full profile via /api/employees/me', async () => {
      const app = createApp({ csrfDisabled: true });
      vi.mocked(db.session.findUnique).mockResolvedValue(mockEmployeeSession as any);
      vi.mocked(db.session.update).mockResolvedValue(mockEmployeeSession as any);
      vi.mocked(db.user.findUnique).mockResolvedValue({
        id: mockEmployeeUser.id,
        username: mockEmployeeUser.username,
        displayName: mockEmployeeUser.displayName,
        systemRole: mockEmployeeUser.systemRole,
        employeeProfile: {
          ...mockEmployeeProfile,
          workRoles: [],
        },
        availabilityStatus: { status: 'available', message: null },
      } as any);

      const res = await request(app)
        .get('/api/employees/me')
        .set('Cookie', [`IMAC_SESSION=${mockEmployeeSession.id}`]);

      expect(res.status).toBe(200);
      expect(res.body.user.id).toBe(mockEmployeeUser.id);
      expect(res.body.employeeProfile.employeeCode).toBe('EMP-JOHN_DEV');
      expect(res.body.employeeProfile.standardShiftHours).toBe(8);
      expect(res.body.employeeProfile.department).toBe('Engineering');
    });

    it('ordinary employee cannot read another employee full profile via /api/employees/:id', async () => {
      const app = createApp({ csrfDisabled: true });
      vi.mocked(db.session.findUnique).mockResolvedValue(mockEmployeeSession as any);
      vi.mocked(db.session.update).mockResolvedValue(mockEmployeeSession as any);
      vi.mocked(db.user.findFirst).mockResolvedValue({
        id: mockOtherEmployeeUser.id,
        username: mockOtherEmployeeUser.username,
        displayName: mockOtherEmployeeUser.displayName,
        systemRole: mockOtherEmployeeUser.systemRole,
        employeeProfile: mockOtherProfile,
        availabilityStatus: { status: 'available', message: null },
      } as any);

      const res = await request(app)
        .get(`/api/employees/${mockOtherEmployeeUser.id}`)
        .set('Cookie', [`IMAC_SESSION=${mockEmployeeSession.id}`]);

      // Returns restricted public directory fields, NOT full private profile
      expect(res.status).toBe(200);
      expect(res.body.id).toBe(mockOtherEmployeeUser.id);
      expect(res.body.displayName).toBe(mockOtherEmployeeUser.displayName);
      expect(res.body.employeeProfile).toBeUndefined();
      expect(res.body.employeeCode).toBeUndefined();
      expect(res.body.standardShiftHours).toBeUndefined();
    });

    it('ordinary employee is blocked from admin single user lookup with HTTP 403 Forbidden', async () => {
      const app = createApp({ csrfDisabled: true });
      vi.mocked(db.session.findUnique).mockResolvedValue(mockEmployeeSession as any);
      vi.mocked(db.session.update).mockResolvedValue(mockEmployeeSession as any);

      const res = await request(app)
        .get(`/api/admin/users/${mockOtherEmployeeUser.id}`)
        .set('Cookie', [`IMAC_SESSION=${mockEmployeeSession.id}`]);

      expect(res.status).toBe(403);
      expect(res.body.error).toBe('forbidden');
    });
  });

  /* -------------------------------------------------------------------------- */
  /* 4. CSRF Protection on New State-Changing Routes                            */
  /* -------------------------------------------------------------------------- */
  describe('4. CSRF Protection on User Profile Routes', () => {
    it('rejects PATCH /api/admin/users/:id/profile without CSRF token with HTTP 403', async () => {
      const app = createApp({ csrfEnabled: true });
      vi.mocked(db.session.findUnique).mockResolvedValue(mockAdminSession as any);
      vi.mocked(db.session.update).mockResolvedValue(mockAdminSession as any);

      const res = await request(app)
        .patch(`/api/admin/users/${mockEmployeeUser.id}/profile`)
        .set('Cookie', [`IMAC_SESSION=${mockAdminSession.id}`])
        .send({ department: 'Unauthorized Hack' });

      expect(res.status).toBe(403);
      expect(res.body.error).toBe('csrf_invalid');
    });
  });
});
