import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../app.js';
import { db } from '../db.js';

describe('Daily Work Log Subsystem (Step 8b)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mockAdminUser = {
    id: 'admin-user-uuid',
    username: 'boss',
    displayName: 'Boss Admin',
    passwordHash: 'hashed_pw',
    systemRole: 'system_admin',
    isActive: true,
    mustChangePassword: false,
  };

  const mockHrUser = {
    id: 'hr-user-uuid',
    username: 'hr_lead',
    displayName: 'HR Lead',
    passwordHash: 'hashed_pw',
    systemRole: 'hr_admin',
    isActive: true,
    mustChangePassword: false,
  };

  const mockPmUser = {
    id: 'pm-user-uuid',
    username: 'pm_lead',
    displayName: 'PM Lead',
    passwordHash: 'hashed_pw',
    systemRole: 'project_manager',
    isActive: true,
    mustChangePassword: false,
  };

  const mockEmployeeUser = {
    id: 'emp-user-uuid',
    username: 'john_dev',
    displayName: 'John Developer',
    passwordHash: 'hashed_pw',
    systemRole: 'employee',
    isActive: true,
    mustChangePassword: false,
  };

  const mockViewerUser = {
    id: 'viewer-user-uuid',
    username: 'auditor',
    displayName: 'Auditor Viewer',
    passwordHash: 'hashed_pw',
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
    id: 'emp-session-id',
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
    id: 'profile-uuid-john',
    userId: mockEmployeeUser.id,
    employeeCode: 'EMP-JOHN',
    department: 'Engineering',
    jobTitle: 'Software Engineer',
    standardShiftHours: 8,
    workingDaysPerWeek: 5,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockRoleDev = {
    id: 'role-dev-id',
    name: 'Developer',
    description: 'Dev work',
    isActive: true,
  };

  const mockRoleTest = {
    id: 'role-test-id',
    name: 'QA Tester',
    description: 'Testing work',
    isActive: true,
  };

  const mockRoleUnassigned = {
    id: 'role-unassigned-id',
    name: 'Marketing Specialist',
    description: 'Not assigned to dev',
    isActive: true,
  };

  // Setup common session lookup helper
  function setupAuth(session: any, profile: any = mockEmployeeProfile) {
    vi.mocked(db.session.findUnique).mockResolvedValue(session);
    vi.mocked(db.session.update).mockResolvedValue(session);
    vi.mocked(db.employeeProfile.findUnique).mockResolvedValue(profile);
  }

  // ── 1. Authentication & Profile Resolution ─────────────────────────────────────
  describe('1. Authentication & Profile Resolution', () => {
    it('returns 401 unauthenticated when no session cookie is provided', async () => {
      const app = createApp({ csrfDisabled: true });
      const res = await request(app).get('/api/work-logs/by-date?date=2026-10-27');

      expect(res.status).toBe(401);
      expect(res.body.error).toBe('unauthenticated');
    });

    it('returns 404 profile_not_found when user has no EmployeeProfile', async () => {
      const app = createApp({ csrfDisabled: true });
      setupAuth(mockAdminSession, null); // admin with no profile

      const res = await request(app)
        .get('/api/work-logs/by-date?date=2026-10-27')
        .set('Cookie', [`IMAC_SESSION=${mockAdminSession.id}`]);

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('profile_not_found');
    });
  });

  // ── 2. Work Role Assignment Validation ─────────────────────────────────────────
  describe('2. Work Role Assignment & Historic Integrity', () => {
    it('rejects saving draft with unassigned work role (400 unassigned_work_role)', async () => {
      const app = createApp({ csrfDisabled: true });
      setupAuth(mockEmployeeSession);

      // Only dev role assigned
      vi.mocked(db.employeeWorkRole.findMany).mockResolvedValue([
        { workRoleId: mockRoleDev.id } as any,
      ]);

      const res = await request(app)
        .post('/api/work-logs')
        .set('Cookie', [`IMAC_SESSION=${mockEmployeeSession.id}`])
        .send({
          date: '2026-10-27',
          entries: [
            { workRoleId: mockRoleUnassigned.id, hours: 4, description: 'Marketing tasks' },
          ],
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('unassigned_work_role');
    });

    it('historic integrity: entry created with role remains readable after role unassigned', async () => {
      const app = createApp({ csrfDisabled: true });
      setupAuth(mockEmployeeSession);

      const existingLog = {
        id: 'log-past-id',
        employeeProfileId: mockEmployeeProfile.id,
        date: new Date('2026-10-20'),
        status: 'submitted',
        submittedAt: new Date('2026-10-20T17:00:00Z'),
        entries: [
          {
            id: 'entry-past-id',
            workRoleId: mockRoleUnassigned.id,
            hours: 8,
            workRole: mockRoleUnassigned,
          },
        ],
      };

      vi.mocked(db.workLogDay.findFirst).mockResolvedValue(existingLog as any);

      // Read historic log
      const res = await request(app)
        .get(`/api/work-logs/${existingLog.id}`)
        .set('Cookie', [`IMAC_SESSION=${mockEmployeeSession.id}`]);

      expect(res.status).toBe(200);
      expect(res.body.workLog.id).toBe(existingLog.id);
      expect(res.body.workLog.entries[0].workRoleId).toBe(mockRoleUnassigned.id);
    });

    it('resending an edit with now-unassigned role is rejected (400 unassigned_work_role)', async () => {
      const app = createApp({ csrfDisabled: true });
      setupAuth(mockEmployeeSession);

      // Only mockRoleDev is currently assigned
      vi.mocked(db.employeeWorkRole.findMany).mockResolvedValue([
        { workRoleId: mockRoleDev.id } as any,
      ]);

      const res = await request(app)
        .patch('/api/work-logs/log-past-id')
        .set('Cookie', [`IMAC_SESSION=${mockEmployeeSession.id}`])
        .send({
          entries: [
            { workRoleId: mockRoleUnassigned.id, hours: 8, description: 'Attempting old unassigned role' },
          ],
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('unassigned_work_role');
    });
  });

  // ── 3. Input Validation ────────────────────────────────────────────────────────
  describe('3. Input Validation (0.25 steps, caps, dates, bounds)', () => {
    it('rejects hours not in 0.25 steps (400 validation_error)', async () => {
      const app = createApp({ csrfDisabled: true });
      setupAuth(mockEmployeeSession);

      const res = await request(app)
        .post('/api/work-logs')
        .set('Cookie', [`IMAC_SESSION=${mockEmployeeSession.id}`])
        .send({
          date: '2026-10-27',
          entries: [
            { workRoleId: mockRoleDev.id, hours: 1.33 },
          ],
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('validation_error');
    });

    it('rejects total hours exceeding 24 across entries (400 validation_error)', async () => {
      const app = createApp({ csrfDisabled: true });
      setupAuth(mockEmployeeSession);

      const res = await request(app)
        .post('/api/work-logs')
        .set('Cookie', [`IMAC_SESSION=${mockEmployeeSession.id}`])
        .send({
          date: '2026-10-27',
          entries: [
            { workRoleId: mockRoleDev.id, hours: 15 },
            { workRoleId: mockRoleDev.id, hours: 10 },
          ],
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('validation_error');
    });

    it('rejects bad date format (400 validation_error)', async () => {
      const app = createApp({ csrfDisabled: true });
      setupAuth(mockEmployeeSession);

      const res = await request(app)
        .post('/api/work-logs')
        .set('Cookie', [`IMAC_SESSION=${mockEmployeeSession.id}`])
        .send({
          date: '2026-99-99',
          entries: [{ workRoleId: mockRoleDev.id, hours: 8 }],
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('validation_error');
    });

    it('rejects date in the far future (400 validation_error)', async () => {
      const app = createApp({ csrfDisabled: true });
      setupAuth(mockEmployeeSession);

      vi.mocked(db.employeeWorkRole.findMany).mockResolvedValue([
        { workRoleId: mockRoleDev.id } as any,
      ]);

      const res = await request(app)
        .post('/api/work-logs')
        .set('Cookie', [`IMAC_SESSION=${mockEmployeeSession.id}`])
        .send({
          date: '2029-01-01',
          entries: [{ workRoleId: mockRoleDev.id, hours: 8 }],
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('validation_error');
      expect(res.body.message).toContain('future');
    });

    it('rejects empty log submit (400 empty_work_log)', async () => {
      const app = createApp({ csrfDisabled: true });
      setupAuth(mockEmployeeSession);

      vi.mocked(db.workLogDay.findFirst).mockResolvedValue({
        id: 'draft-empty-id',
        employeeProfileId: mockEmployeeProfile.id,
        status: 'draft',
        entries: [],
      } as any);

      const res = await request(app)
        .post('/api/work-logs/draft-empty-id/submit')
        .set('Cookie', [`IMAC_SESSION=${mockEmployeeSession.id}`]);

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('empty_work_log');
    });
  });

  // ── 4. Upsert Draft, Submission Flow & Conflict Handling ────────────────────────
  describe('4. Draft Upsert, Submission & 409 Conflicts', () => {
    it('creates or updates draft cleanly (POST /api/work-logs)', async () => {
      const app = createApp({ csrfDisabled: true });
      setupAuth(mockEmployeeSession);

      vi.mocked(db.employeeWorkRole.findMany).mockResolvedValue([
        { workRoleId: mockRoleDev.id } as any,
      ]);
      vi.mocked(db.workLogDay.findFirst).mockResolvedValue(null); // not existing yet
      vi.mocked(db.workLogDay.create).mockResolvedValue({
        id: 'new-draft-id',
        employeeProfileId: mockEmployeeProfile.id,
        date: new Date('2026-10-27'),
        status: 'draft',
      } as any);
      vi.mocked(db.workLogDay.findUnique).mockResolvedValue({
        id: 'new-draft-id',
        employeeProfileId: mockEmployeeProfile.id,
        date: new Date('2026-10-27'),
        status: 'draft',
        entries: [{ id: 'entry-1', workRoleId: mockRoleDev.id, hours: 8 }],
      } as any);

      const res = await request(app)
        .post('/api/work-logs')
        .set('Cookie', [`IMAC_SESSION=${mockEmployeeSession.id}`])
        .send({
          date: '2026-10-27',
          entries: [{ workRoleId: mockRoleDev.id, hours: 8, description: 'Building feature' }],
        });

      expect(res.status).toBe(201);
      expect(res.body.ok).toBe(true);
      expect(res.body.workLog.status).toBe('draft');
      expect(res.body.totalHours).toBe(8);
      expect(res.body.standardShiftHours).toBe(8);
      expect(res.body.warnings).toEqual([]);
    });

    it('rejects draft creation on a date that is already submitted or approved (409 status_conflict)', async () => {
      const app = createApp({ csrfDisabled: true });
      setupAuth(mockEmployeeSession);

      vi.mocked(db.employeeWorkRole.findMany).mockResolvedValue([
        { workRoleId: mockRoleDev.id } as any,
      ]);
      vi.mocked(db.workLogDay.findFirst).mockResolvedValue({
        id: 'existing-sub-id',
        employeeProfileId: mockEmployeeProfile.id,
        date: new Date('2026-10-27'),
        status: 'submitted',
      } as any);

      const res = await request(app)
        .post('/api/work-logs')
        .set('Cookie', [`IMAC_SESSION=${mockEmployeeSession.id}`])
        .send({
          date: '2026-10-27',
          entries: [{ workRoleId: mockRoleDev.id, hours: 8 }],
        });

      expect(res.status).toBe(409);
      expect(res.body.error).toBe('status_conflict');
    });

    it('surfaces database unique constraint collision (P2002) as 409 day_already_exists', async () => {
      const app = createApp({ csrfDisabled: true });
      setupAuth(mockEmployeeSession);

      vi.mocked(db.employeeWorkRole.findMany).mockResolvedValue([
        { workRoleId: mockRoleDev.id } as any,
      ]);
      vi.mocked(db.workLogDay.findFirst).mockResolvedValue(null);

      // Simulate concurrent insert hitting unique constraint P2002
      const p2002Err: any = new Error('Unique constraint failed');
      p2002Err.code = 'P2002';
      vi.mocked(db.workLogDay.create).mockRejectedValue(p2002Err);

      const res = await request(app)
        .post('/api/work-logs')
        .set('Cookie', [`IMAC_SESSION=${mockEmployeeSession.id}`])
        .send({
          date: '2026-10-27',
          entries: [{ workRoleId: mockRoleDev.id, hours: 8 }],
        });

      expect(res.status).toBe(409);
      expect(res.body.error).toBe('day_already_exists');
    });

    it('rejects double submission with 400 already_submitted', async () => {
      const app = createApp({ csrfDisabled: true });
      setupAuth(mockEmployeeSession);

      vi.mocked(db.workLogDay.findFirst).mockResolvedValue({
        id: 'already-sub-log-id',
        employeeProfileId: mockEmployeeProfile.id,
        status: 'submitted',
        entries: [{ workRoleId: mockRoleDev.id, hours: 8 }],
      } as any);

      const res = await request(app)
        .post('/api/work-logs/already-sub-log-id/submit')
        .set('Cookie', [`IMAC_SESSION=${mockEmployeeSession.id}`]);

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('already_submitted');
    });
  });

  // ── 5. Hour Mismatch Policy Modes ──────────────────────────────────────────────
  describe('5. Hour Mismatch Policies (block, warn, allow, and dynamic setting change)', () => {
    it('block mode: rejects submission when total != shift hours (422 hour_mismatch)', async () => {
      const app = createApp({ csrfDisabled: true });
      setupAuth(mockEmployeeSession);

      vi.mocked(db.systemSetting.findUnique as any).mockImplementation(async ({ where }: any) => {
        if (where.key === 'worklog.mismatchHandling') return { key: 'worklog.mismatchHandling', value: 'block' } as any;
        return null;
      });

      vi.mocked(db.workLogDay.findFirst).mockResolvedValue({
        id: 'draft-mismatch-id',
        employeeProfileId: mockEmployeeProfile.id,
        status: 'draft',
        entries: [{ workRoleId: mockRoleDev.id, hours: 6 }], // 6 != 8
      } as any);
      vi.mocked(db.employeeWorkRole.findMany).mockResolvedValue([
        { workRoleId: mockRoleDev.id } as any,
      ]);

      const res = await request(app)
        .post('/api/work-logs/draft-mismatch-id/submit')
        .set('Cookie', [`IMAC_SESSION=${mockEmployeeSession.id}`]);

      expect(res.status).toBe(422);
      expect(res.body.error).toBe('hour_mismatch');
      expect(res.body.totalHours).toBe(6);
      expect(res.body.standardShiftHours).toBe(8);
      expect(res.body.warnings.length).toBeGreaterThan(0);
    });

    it('block mode still saves a mismatched DRAFT (200 OK)', async () => {
      const app = createApp({ csrfDisabled: true });
      setupAuth(mockEmployeeSession);

      vi.mocked(db.systemSetting.findUnique as any).mockImplementation(async ({ where }: any) => {
        if (where.key === 'worklog.mismatchHandling') return { key: 'worklog.mismatchHandling', value: 'block' } as any;
        return null;
      });

      vi.mocked(db.employeeWorkRole.findMany).mockResolvedValue([
        { workRoleId: mockRoleDev.id } as any,
      ]);
      vi.mocked(db.workLogDay.findFirst).mockResolvedValue(null);
      vi.mocked(db.workLogDay.create).mockResolvedValue({ id: 'draft-6h-id', status: 'draft' } as any);
      vi.mocked(db.workLogDay.findUnique).mockResolvedValue({
        id: 'draft-6h-id',
        status: 'draft',
        entries: [{ workRoleId: mockRoleDev.id, hours: 6 }],
      } as any);

      const res = await request(app)
        .post('/api/work-logs')
        .set('Cookie', [`IMAC_SESSION=${mockEmployeeSession.id}`])
        .send({
          date: '2026-10-27',
          entries: [{ workRoleId: mockRoleDev.id, hours: 6 }], // 6 != 8, allowed as draft!
        });

      expect(res.status).toBe(201);
      expect(res.body.ok).toBe(true);
      expect(res.body.totalHours).toBe(6);
      expect(res.body.warnings).toEqual([]);
    });

    it('warn mode: succeeds with warning in payload (200 OK)', async () => {
      const app = createApp({ csrfDisabled: true });
      setupAuth(mockEmployeeSession);

      vi.mocked(db.systemSetting.findUnique as any).mockImplementation(async ({ where }: any) => {
        if (where.key === 'worklog.mismatchHandling') return { key: 'worklog.mismatchHandling', value: 'warn' } as any;
        return null;
      });

      vi.mocked(db.workLogDay.findFirst).mockResolvedValue({
        id: 'draft-warn-id',
        employeeProfileId: mockEmployeeProfile.id,
        status: 'draft',
        entries: [{ workRoleId: mockRoleDev.id, hours: 7 }], // 7 != 8
      } as any);
      vi.mocked(db.employeeWorkRole.findMany).mockResolvedValue([
        { workRoleId: mockRoleDev.id } as any,
      ]);
      vi.mocked(db.workLogDay.updateMany).mockResolvedValue({ count: 1 });
      vi.mocked(db.workLogDay.findUnique).mockResolvedValue({
        id: 'draft-warn-id',
        status: 'submitted',
        entries: [{ workRoleId: mockRoleDev.id, hours: 7 }],
      } as any);

      const res = await request(app)
        .post('/api/work-logs/draft-warn-id/submit')
        .set('Cookie', [`IMAC_SESSION=${mockEmployeeSession.id}`]);

      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
      expect(res.body.totalHours).toBe(7);
      expect(res.body.warnings).toEqual([
        'Total hours (7) does not match standard shift length (8)',
      ]);
    });

    it('allow mode: succeeds with empty warnings array (200 OK)', async () => {
      const app = createApp({ csrfDisabled: true });
      setupAuth(mockEmployeeSession);

      vi.mocked(db.systemSetting.findUnique as any).mockImplementation(async ({ where }: any) => {
        if (where.key === 'worklog.mismatchHandling') return { key: 'worklog.mismatchHandling', value: 'allow' } as any;
        return null;
      });

      vi.mocked(db.workLogDay.findFirst).mockResolvedValue({
        id: 'draft-allow-id',
        employeeProfileId: mockEmployeeProfile.id,
        status: 'draft',
        entries: [{ workRoleId: mockRoleDev.id, hours: 5 }],
      } as any);
      vi.mocked(db.employeeWorkRole.findMany).mockResolvedValue([
        { workRoleId: mockRoleDev.id } as any,
      ]);
      vi.mocked(db.workLogDay.updateMany).mockResolvedValue({ count: 1 });
      vi.mocked(db.workLogDay.findUnique).mockResolvedValue({
        id: 'draft-allow-id',
        status: 'submitted',
        entries: [{ workRoleId: mockRoleDev.id, hours: 5 }],
      } as any);

      const res = await request(app)
        .post('/api/work-logs/draft-allow-id/submit')
        .set('Cookie', [`IMAC_SESSION=${mockEmployeeSession.id}`]);

      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
      expect(res.body.totalHours).toBe(5);
      expect(res.body.warnings).toEqual([]);
    });

    it('dynamic setting change via admin settings API alters subsequent submit behavior', async () => {
      const app = createApp({ csrfDisabled: true });

      // First submit under default 'warn' mode
      setupAuth(mockEmployeeSession);
      vi.mocked(db.systemSetting.findUnique).mockResolvedValue(null); // default 'warn'
      vi.mocked(db.workLogDay.findFirst).mockResolvedValue({
        id: 'draft-dynamic-id',
        employeeProfileId: mockEmployeeProfile.id,
        status: 'draft',
        entries: [{ workRoleId: mockRoleDev.id, hours: 6 }],
      } as any);
      vi.mocked(db.employeeWorkRole.findMany).mockResolvedValue([
        { workRoleId: mockRoleDev.id } as any,
      ]);
      vi.mocked(db.workLogDay.updateMany).mockResolvedValue({ count: 1 });
      vi.mocked(db.workLogDay.findUnique).mockResolvedValue({
        id: 'draft-dynamic-id',
        status: 'submitted',
        entries: [{ workRoleId: mockRoleDev.id, hours: 6 }],
      } as any);

      const submit1 = await request(app)
        .post('/api/work-logs/draft-dynamic-id/submit')
        .set('Cookie', [`IMAC_SESSION=${mockEmployeeSession.id}`]);

      expect(submit1.status).toBe(200);
      expect(submit1.body.warnings.length).toBe(1);

      // Admin updates setting to 'block'
      setupAuth(mockAdminSession);
      vi.mocked(db.systemSetting.upsert).mockResolvedValue({
        key: 'worklog.mismatchHandling',
        value: 'block',
      } as any);

      const patchSettingRes = await request(app)
        .patch('/api/admin/settings/worklog.mismatchHandling')
        .set('Cookie', [`IMAC_SESSION=${mockAdminSession.id}`])
        .send({ value: 'block' });

      expect(patchSettingRes.status).toBe(200);

      // Now employee tries to submit another mismatched draft -> blocked!
      setupAuth(mockEmployeeSession);
      vi.mocked(db.systemSetting.findUnique as any).mockImplementation(async ({ where }: any) => {
        if (where.key === 'worklog.mismatchHandling') return { key: 'worklog.mismatchHandling', value: 'block' } as any;
        return null;
      });
      vi.mocked(db.workLogDay.findFirst).mockResolvedValue({
        id: 'draft-dynamic-2',
        employeeProfileId: mockEmployeeProfile.id,
        status: 'draft',
        entries: [{ workRoleId: mockRoleDev.id, hours: 6 }],
      } as any);

      const submit2 = await request(app)
        .post('/api/work-logs/draft-dynamic-2/submit')
        .set('Cookie', [`IMAC_SESSION=${mockEmployeeSession.id}`]);

      expect(submit2.status).toBe(422);
      expect(submit2.body.error).toBe('hour_mismatch');
    });

    it('invalid setting values safely fall back to defaults', async () => {
      const app = createApp({ csrfDisabled: true });
      setupAuth(mockEmployeeSession);

      // Corrupted / invalid settings in DB
      vi.mocked(db.systemSetting.findUnique as any).mockImplementation(async ({ where }: any) => {
        if (where.key === 'worklog.mismatchHandling') return { key: 'worklog.mismatchHandling', value: 'invalid_mode' } as any;
        if (where.key === 'worklog.editWindowHours') return { key: 'worklog.editWindowHours', value: '-99' } as any;
        return null;
      });

      vi.mocked(db.workLogDay.findFirst).mockResolvedValue({
        id: 'draft-fallback-id',
        employeeProfileId: mockEmployeeProfile.id,
        status: 'draft',
        entries: [{ workRoleId: mockRoleDev.id, hours: 6 }],
      } as any);
      vi.mocked(db.employeeWorkRole.findMany).mockResolvedValue([
        { workRoleId: mockRoleDev.id } as any,
      ]);
      vi.mocked(db.workLogDay.updateMany).mockResolvedValue({ count: 1 });
      vi.mocked(db.workLogDay.findUnique).mockResolvedValue({
        id: 'draft-fallback-id',
        status: 'submitted',
        entries: [{ workRoleId: mockRoleDev.id, hours: 6 }],
      } as any);

      const res = await request(app)
        .post('/api/work-logs/draft-fallback-id/submit')
        .set('Cookie', [`IMAC_SESSION=${mockEmployeeSession.id}`]);

      // Mismatch handling should fall back to 'warn', succeeding with warning
      expect(res.status).toBe(200);
      expect(res.body.warnings.length).toBe(1);
    });
  });

  // ── 6. Edit Window, Approved Logs & Admin Override ─────────────────────────────
  describe('6. Edit Window Enforcement, Approved Logs & Admin Override', () => {
    it('editing draft succeeds without creating an audit log', async () => {
      const app = createApp({ csrfDisabled: true });
      setupAuth(mockEmployeeSession);

      vi.mocked(db.employeeWorkRole.findMany).mockResolvedValue([
        { workRoleId: mockRoleDev.id } as any,
      ]);
      vi.mocked(db.workLogDay.findFirst).mockResolvedValue({
        id: 'draft-to-edit',
        employeeProfileId: mockEmployeeProfile.id,
        status: 'draft',
        entries: [{ id: 'old-e', workRoleId: mockRoleDev.id, hours: 4 }],
      } as any);
      vi.mocked(db.workLogDay.update).mockResolvedValue({
        id: 'draft-to-edit',
        status: 'draft',
        entries: [{ id: 'new-e', workRoleId: mockRoleDev.id, hours: 8 }],
      } as any);

      const res = await request(app)
        .patch('/api/work-logs/draft-to-edit')
        .set('Cookie', [`IMAC_SESSION=${mockEmployeeSession.id}`])
        .send({
          entries: [{ workRoleId: mockRoleDev.id, hours: 8 }],
        });

      expect(res.status).toBe(200);
      expect(db.auditLog.create).not.toHaveBeenCalled();
    });

    it('editing submitted log within edit window succeeds and creates audit log entry', async () => {
      const app = createApp({ csrfDisabled: true });
      setupAuth(mockEmployeeSession);

      vi.mocked(db.employeeWorkRole.findMany).mockResolvedValue([
        { workRoleId: mockRoleDev.id } as any,
      ]);
      // Submitted 2 hours ago (within 24h default window)
      const submittedTwoHoursAgo = new Date(Date.now() - 2 * 3600 * 1000);
      vi.mocked(db.workLogDay.findFirst).mockResolvedValue({
        id: 'submitted-recent-id',
        employeeProfileId: mockEmployeeProfile.id,
        status: 'submitted',
        submittedAt: submittedTwoHoursAgo,
        entries: [{ id: 'old-e', workRoleId: mockRoleDev.id, hours: 8 }],
      } as any);
      vi.mocked(db.workLogDay.update).mockResolvedValue({
        id: 'submitted-recent-id',
        status: 'submitted',
        submittedAt: submittedTwoHoursAgo,
        entries: [{ id: 'new-e', workRoleId: mockRoleDev.id, hours: 8, description: 'Updated' }],
      } as any);

      const res = await request(app)
        .patch('/api/work-logs/submitted-recent-id')
        .set('Cookie', [`IMAC_SESSION=${mockEmployeeSession.id}`])
        .send({
          entries: [{ workRoleId: mockRoleDev.id, hours: 8, description: 'Updated' }],
        });

      expect(res.status).toBe(200);
      expect(db.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: 'work_log.edited_after_submit',
            entityType: 'WorkLogDay',
            entityId: 'submitted-recent-id',
            actorUserId: mockEmployeeUser.id,
          }),
        }),
      );
    });

    it('editing submitted log after edit window has elapsed returns 403 edit_window_expired', async () => {
      const app = createApp({ csrfDisabled: true });
      setupAuth(mockEmployeeSession);

      vi.mocked(db.employeeWorkRole.findMany).mockResolvedValue([
        { workRoleId: mockRoleDev.id } as any,
      ]);
      // Submitted 30 hours ago (> 24h window)
      const submitted30HoursAgo = new Date(Date.now() - 30 * 3600 * 1000);
      vi.mocked(db.workLogDay.findFirst).mockResolvedValue({
        id: 'submitted-old-id',
        employeeProfileId: mockEmployeeProfile.id,
        status: 'submitted',
        submittedAt: submitted30HoursAgo,
        entries: [{ id: 'old-e', workRoleId: mockRoleDev.id, hours: 8 }],
      } as any);

      const res = await request(app)
        .patch('/api/work-logs/submitted-old-id')
        .set('Cookie', [`IMAC_SESSION=${mockEmployeeSession.id}`])
        .send({
          entries: [{ workRoleId: mockRoleDev.id, hours: 8 }],
        });

      expect(res.status).toBe(403);
      expect(res.body.error).toBe('edit_window_expired');
      expect(db.workLogEntry.deleteMany).not.toHaveBeenCalled();
    });

    it('approved logs are locked against employee edits (403 log_already_approved)', async () => {
      const app = createApp({ csrfDisabled: true });
      setupAuth(mockEmployeeSession);

      vi.mocked(db.employeeWorkRole.findMany).mockResolvedValue([
        { workRoleId: mockRoleDev.id } as any,
      ]);
      vi.mocked(db.workLogDay.findFirst).mockResolvedValue({
        id: 'approved-log-id',
        employeeProfileId: mockEmployeeProfile.id,
        status: 'approved',
        submittedAt: new Date(),
        entries: [{ id: 'e1', workRoleId: mockRoleDev.id, hours: 8 }],
      } as any);

      const res = await request(app)
        .patch('/api/work-logs/approved-log-id')
        .set('Cookie', [`IMAC_SESSION=${mockEmployeeSession.id}`])
        .send({
          entries: [{ workRoleId: mockRoleDev.id, hours: 8 }],
        });

      expect(res.status).toBe(403);
      expect(res.body.error).toBe('log_already_approved');
    });

    it('system_admin can override log after edit window with audit entry (actor, timestamp, reason)', async () => {
      const app = createApp({ csrfDisabled: true });
      setupAuth(mockAdminSession, null); // admin user

      vi.mocked(db.workRole.findMany).mockResolvedValue([mockRoleDev as any]);
      const submitted30HoursAgo = new Date(Date.now() - 30 * 3600 * 1000);
      vi.mocked(db.workLogDay.findUnique).mockResolvedValue({
        id: 'submitted-old-id',
        employeeProfileId: 'some-other-emp-profile-id',
        status: 'submitted',
        submittedAt: submitted30HoursAgo,
        entries: [{ id: 'old-e', workRoleId: mockRoleDev.id, hours: 8 }],
        employeeProfile: { standardShiftHours: 8 },
      } as any);
      vi.mocked(db.workLogDay.update).mockResolvedValue({
        id: 'submitted-old-id',
        status: 'submitted',
        entries: [{ id: 'new-e', workRoleId: mockRoleDev.id, hours: 8, description: 'Admin corrected' }],
      } as any);

      const res = await request(app)
        .patch('/api/admin/work-logs/submitted-old-id/override')
        .set('Cookie', [`IMAC_SESSION=${mockAdminSession.id}`])
        .send({
          reason: 'Manager approved correction for missed clock-out',
          entries: [{ workRoleId: mockRoleDev.id, hours: 8, description: 'Admin corrected' }],
        });

      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
      expect(db.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: 'work_log.admin_override',
            actorUserId: mockAdminUser.id,
            entityType: 'WorkLogDay',
            entityId: 'submitted-old-id',
            afterSnapshot: expect.objectContaining({
              reason: 'Manager approved correction for missed clock-out',
            }),
          }),
        }),
      );
    });

    it('admin override fails with 400 validation_error if reason is empty or whitespace', async () => {
      const app = createApp({ csrfDisabled: true });
      setupAuth(mockAdminSession, null);

      const res = await request(app)
        .patch('/api/admin/work-logs/some-id/override')
        .set('Cookie', [`IMAC_SESSION=${mockAdminSession.id}`])
        .send({
          reason: '   ',
          entries: [{ workRoleId: mockRoleDev.id, hours: 8 }],
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('validation_error');
    });

    it('non-admins receive 403 forbidden when calling admin override endpoint', async () => {
      const app = createApp({ csrfDisabled: true });
      const nonAdmins = [
        { role: 'employee', session: mockEmployeeSession },
        { role: 'hr_admin', session: mockHrSession },
        { role: 'project_manager', session: mockPmSession },
        { role: 'viewer', session: mockViewerSession },
      ];

      for (const { session } of nonAdmins) {
        setupAuth(session);
        const res = await request(app)
          .patch('/api/admin/work-logs/any-id/override')
          .set('Cookie', [`IMAC_SESSION=${session.id}`])
          .send({
            reason: 'Unauthorized override attempt',
            entries: [{ workRoleId: mockRoleDev.id, hours: 8 }],
          });

        expect(res.status).toBe(403);
        expect(res.body.error).toBe('forbidden');
      }
    });
  });

  // ── 7. IDOR & Access Isolation (Consistent 404 Status Code) ────────────────────
  describe('7. IDOR & Access Isolation (Consistent 404 on other employees logs)', () => {
    it('employee attempting to read another employee log returns 404', async () => {
      const app = createApp({ csrfDisabled: true });
      setupAuth(mockEmployeeSession);

      // Scoped query findFirst { id: 'other-emp-log', employeeProfileId: callerProfile.id } returns null
      vi.mocked(db.workLogDay.findFirst).mockResolvedValue(null);

      const res = await request(app)
        .get('/api/work-logs/other-emp-log')
        .set('Cookie', [`IMAC_SESSION=${mockEmployeeSession.id}`]);

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('not_found');
    });

    it('employee attempting to edit another employee log returns 404', async () => {
      const app = createApp({ csrfDisabled: true });
      setupAuth(mockEmployeeSession);

      vi.mocked(db.employeeWorkRole.findMany).mockResolvedValue([
        { workRoleId: mockRoleDev.id } as any,
      ]);
      vi.mocked(db.workLogDay.findFirst).mockResolvedValue(null);

      const res = await request(app)
        .patch('/api/work-logs/other-emp-log')
        .set('Cookie', [`IMAC_SESSION=${mockEmployeeSession.id}`])
        .send({
          entries: [{ workRoleId: mockRoleDev.id, hours: 8 }],
        });

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('not_found');
    });
  });

  // ── 8. Route Ordering Verification ─────────────────────────────────────────────
  describe('8. Route Ordering (/by-date, /by-week, /by-month before /:id)', () => {
    it('GET /api/work-logs/by-date is handled by by-date route and not captured by /:id', async () => {
      const app = createApp({ csrfDisabled: true });
      setupAuth(mockEmployeeSession);

      vi.mocked(db.workLogDay.findFirst).mockResolvedValue({
        id: 'date-specific-log',
        employeeProfileId: mockEmployeeProfile.id,
        date: new Date('2026-10-27'),
        entries: [{ id: 'e1', workRoleId: mockRoleDev.id, hours: 8, workRole: mockRoleDev }],
      } as any);

      const res = await request(app)
        .get('/api/work-logs/by-date?date=2026-10-27')
        .set('Cookie', [`IMAC_SESSION=${mockEmployeeSession.id}`]);

      expect(res.status).toBe(200);
      expect(res.body.workLog.id).toBe('date-specific-log');
      expect(res.body.totalHours).toBe(8);
      // Confirmed date query was parsed
      expect(db.workLogDay.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            employeeProfileId: mockEmployeeProfile.id,
          }),
        }),
      );
    });

    it('GET /api/work-logs/by-week is handled by by-week route', async () => {
      const app = createApp({ csrfDisabled: true });
      setupAuth(mockEmployeeSession);

      vi.mocked(db.workLogDay.findMany).mockResolvedValue([]);

      const res = await request(app)
        .get('/api/work-logs/by-week?startDate=2026-10-20')
        .set('Cookie', [`IMAC_SESSION=${mockEmployeeSession.id}`]);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.workLogs)).toBe(true);
    });

    it('GET /api/work-logs/by-month is handled by by-month route', async () => {
      const app = createApp({ csrfDisabled: true });
      setupAuth(mockEmployeeSession);

      vi.mocked(db.workLogDay.findMany).mockResolvedValue([]);

      const res = await request(app)
        .get('/api/work-logs/by-month?year=2026&month=10')
        .set('Cookie', [`IMAC_SESSION=${mockEmployeeSession.id}`]);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.workLogs)).toBe(true);
    });
  });

  // ── 9. Role Permissions Matrix ─────────────────────────────────────────────────
  describe('9. Role Permission Matrix (viewer cannot write; hr and pm manage own)', () => {
    it('viewer role can read own logs (200 OK)', async () => {
      const app = createApp({ csrfDisabled: true });
      setupAuth(mockViewerSession, {
        ...mockEmployeeProfile,
        userId: mockViewerUser.id,
      });

      vi.mocked(db.workLogDay.findFirst).mockResolvedValue(null);

      const res = await request(app)
        .get('/api/work-logs/by-date?date=2026-10-27')
        .set('Cookie', [`IMAC_SESSION=${mockViewerSession.id}`]);

      expect(res.status).toBe(200);
      expect(res.body.workLog).toBeNull();
    });

    it('viewer role CANNOT write logs (403 forbidden)', async () => {
      const app = createApp({ csrfDisabled: true });
      setupAuth(mockViewerSession, {
        ...mockEmployeeProfile,
        userId: mockViewerUser.id,
      });

      const res = await request(app)
        .post('/api/work-logs')
        .set('Cookie', [`IMAC_SESSION=${mockViewerSession.id}`])
        .send({
          date: '2026-10-27',
          entries: [{ workRoleId: mockRoleDev.id, hours: 8 }],
        });

      expect(res.status).toBe(403);
      expect(res.body.error).toBe('forbidden');
    });

    it('hr_admin and project_manager manage only their own logs (404 on others)', async () => {
      const app = createApp({ csrfDisabled: true });

      for (const session of [mockHrSession, mockPmSession]) {
        setupAuth(session, {
          ...mockEmployeeProfile,
          userId: session.userId,
        });
        vi.mocked(db.workLogDay.findFirst).mockResolvedValue(null);

        const res = await request(app)
          .get('/api/work-logs/someone-elses-log-id')
          .set('Cookie', [`IMAC_SESSION=${session.id}`]);

        expect(res.status).toBe(404);
        expect(res.body.error).toBe('not_found');
      }
    });
  });
});
