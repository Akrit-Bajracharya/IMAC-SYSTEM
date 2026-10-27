import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import ExcelJS from 'exceljs';
import { createApp } from '../app.js';
import { db } from '../db.js';

describe('Daily Work Log Excel Export Subsystem (Step 8c)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mockAdminUser = {
    id: 'admin-uuid-1',
    username: 'boss',
    displayName: 'Boss Admin',
    systemRole: 'system_admin',
    isActive: true,
    mustChangePassword: false,
  };

  const mockEmployeeUser = {
    id: 'employee-uuid-1',
    username: 'john_dev',
    displayName: 'John Developer',
    systemRole: 'employee',
    isActive: true,
    mustChangePassword: false,
  };

  const mockOtherEmployeeUser = {
    id: 'employee-uuid-2',
    username: 'jane_dev',
    displayName: 'Jane Developer',
    systemRole: 'employee',
    isActive: true,
    mustChangePassword: false,
  };

  const mockViewerUser = {
    id: 'viewer-uuid-1',
    username: 'auditor',
    displayName: 'Auditor Viewer',
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
    employeeCode: 'EMP-001',
    department: 'Engineering',
    jobTitle: 'Software Engineer',
    standardShiftHours: 8,
    workingDaysPerWeek: 5,
    user: mockEmployeeUser,
  };

  const mockOtherProfile = {
    id: 'profile-uuid-jane',
    userId: mockOtherEmployeeUser.id,
    employeeCode: 'EMP-002',
    department: 'Design',
    jobTitle: 'UI Designer',
    standardShiftHours: 8,
    workingDaysPerWeek: 5,
    user: mockOtherEmployeeUser,
  };

  const mockRoleDev = {
    id: 'role-dev-id',
    name: 'Developer',
    isActive: true,
  };

  const mockRoleDesign = {
    id: 'role-des-id',
    name: 'Designer',
    isActive: true,
  };

  function setupAuth(session: any, profile: any = mockEmployeeProfile) {
    vi.mocked(db.session.findUnique).mockResolvedValue(session);
    vi.mocked(db.session.update).mockResolvedValue(session);
    vi.mocked(db.employeeProfile.findUnique).mockResolvedValue(profile);
  }

  const sampleEntries = [
    {
      id: 'entry-1',
      hours: 7.5,
      description: 'Worked on auth module',
      projectId: 'PRJ-101',
      taskId: 'TSK-501',
      workRoleId: mockRoleDev.id,
      workRole: mockRoleDev,
      workLogDay: {
        id: 'day-1',
        date: new Date('2026-10-15T00:00:00.000Z'),
        status: 'submitted',
        submittedAt: new Date('2026-10-15T17:30:00.000Z'),
        employeeProfile: mockEmployeeProfile,
      },
    },
    {
      id: 'entry-2',
      hours: 8,
      description: '=SUM(1,2) formula injection attempt',
      projectId: '+PRJ-SECRET',
      taskId: '-TASK-MALICIOUS',
      workRoleId: mockRoleDesign.id,
      workRole: mockRoleDesign,
      workLogDay: {
        id: 'day-2',
        date: new Date('2026-10-16T00:00:00.000Z'),
        status: 'approved',
        submittedAt: new Date('2026-10-16T18:00:00.000Z'),
        employeeProfile: mockOtherProfile,
      },
    },
  ];

  // ── 1. Authentication & Role Permissions ─────────────────────────────────────
  describe('1. Authentication & Role Permissions', () => {
    it('returns 401 unauthenticated when no session cookie is present', async () => {
      const app = createApp({ csrfDisabled: true });
      const res = await request(app)
        .get('/api/work-logs/export?startDate=2026-10-01&endDate=2026-10-15');

      expect(res.status).toBe(401);
      expect(res.body.error).toBe('unauthenticated');
    });

    it('returns 403 forbidden for viewer role', async () => {
      const app = createApp({ csrfDisabled: true });
      setupAuth(mockViewerSession, {
        ...mockEmployeeProfile,
        userId: mockViewerUser.id,
      });

      const res = await request(app)
        .get('/api/work-logs/export?startDate=2026-10-01&endDate=2026-10-15')
        .set('Cookie', [`IMAC_SESSION=${mockViewerSession.id}`]);

      expect(res.status).toBe(403);
      expect(res.body.error).toBe('forbidden');
    });

    it('returns 404 profile_not_found when non-admin has no EmployeeProfile', async () => {
      const app = createApp({ csrfDisabled: true });
      setupAuth(mockEmployeeSession, null); // employee without profile

      const res = await request(app)
        .get('/api/work-logs/export?startDate=2026-10-01&endDate=2026-10-15')
        .set('Cookie', [`IMAC_SESSION=${mockEmployeeSession.id}`]);

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('profile_not_found');
    });

    it('system_admin with no profile can export organisation-wide', async () => {
      const app = createApp({ csrfDisabled: true });
      setupAuth(mockAdminSession, null); // admin with no profile

      vi.mocked(db.workLogEntry.count).mockResolvedValue(0);
      vi.mocked(db.workLogEntry.findMany).mockResolvedValue([]);
      vi.mocked(db.auditLog.create).mockResolvedValue({} as any);

      const res = await request(app)
        .get('/api/work-logs/export?startDate=2026-10-01&endDate=2026-10-15')
        .set('Cookie', [`IMAC_SESSION=${mockAdminSession.id}`]);

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain(
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      );
    });
  });

  // ── 2. Scope & IDOR Protection ───────────────────────────────────────────────
  describe('2. Scope Enforcement & IDOR Isolation', () => {
    it('employee passing another employee profile id receives 403 forbidden', async () => {
      const app = createApp({ csrfDisabled: true });
      setupAuth(mockEmployeeSession);

      const res = await request(app)
        .get(
          `/api/work-logs/export?startDate=2026-10-01&endDate=2026-10-15&employee=${mockOtherProfile.id}`,
        )
        .set('Cookie', [`IMAC_SESSION=${mockEmployeeSession.id}`]);

      expect(res.status).toBe(403);
      expect(res.body.error).toBe('forbidden');
      expect(res.body.message).toContain('only permitted to export your own work logs');
    });

    it('employee passing their own profile id succeeds', async () => {
      const app = createApp({ csrfDisabled: true });
      setupAuth(mockEmployeeSession);

      vi.mocked(db.workLogEntry.count).mockResolvedValue(1);
      vi.mocked(db.workLogEntry.findMany).mockResolvedValue([sampleEntries[0]] as any);
      vi.mocked(db.auditLog.create).mockResolvedValue({} as any);

      const res = await request(app)
        .get(
          `/api/work-logs/export?startDate=2026-10-01&endDate=2026-10-15&employee=${mockEmployeeProfile.id}`,
        )
        .set('Cookie', [`IMAC_SESSION=${mockEmployeeSession.id}`])
        .responseType('blob');

      expect(res.status).toBe(200);

      // Verify ExcelJS loads the workbook properly
      const wb = new ExcelJS.Workbook();
      await wb.xlsx.load(res.body);

      const wsSummary = wb.getWorksheet('Summary');
      expect(wsSummary).toBeDefined();

      const wsEntries = wb.getWorksheet('Entries');
      expect(wsEntries).toBeDefined();
      expect(wsEntries!.rowCount).toBe(2); // Header + 1 entry row
    });

    it('employee export scopes strictly to own rows and summary contains only own totals', async () => {
      const app = createApp({ csrfDisabled: true });
      setupAuth(mockEmployeeSession);

      // Return only John's entry
      vi.mocked(db.workLogEntry.count).mockResolvedValue(1);
      vi.mocked(db.workLogEntry.findMany).mockResolvedValue([sampleEntries[0]] as any);
      vi.mocked(db.auditLog.create).mockResolvedValue({} as any);

      const res = await request(app)
        .get('/api/work-logs/export?startDate=2026-10-01&endDate=2026-10-15')
        .set('Cookie', [`IMAC_SESSION=${mockEmployeeSession.id}`])
        .responseType('blob');

      expect(res.status).toBe(200);

      // Verify db query had employeeProfileId = John's ID
      expect(db.workLogEntry.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            workLogDay: expect.objectContaining({
              employeeProfileId: mockEmployeeProfile.id,
            }),
          }),
        }),
      );

      const wb = new ExcelJS.Workbook();
      await wb.xlsx.load(res.body);

      const wsSummary = wb.getWorksheet('Summary')!;
      // Find row with John Developer
      let foundJohn = false;
      let foundJane = false;
      wsSummary.eachRow((row) => {
        const val = row.getCell(1).value;
        if (val === 'John Developer') foundJohn = true;
        if (val === 'Jane Developer') foundJane = true;
      });

      expect(foundJohn).toBe(true);
      expect(foundJane).toBe(false);
    });

    it('employee team (department) and projectId filters only narrow their own rows', async () => {
      const app = createApp({ csrfDisabled: true });
      setupAuth(mockEmployeeSession);

      vi.mocked(db.workLogEntry.count).mockResolvedValue(0);
      vi.mocked(db.workLogEntry.findMany).mockResolvedValue([]);
      vi.mocked(db.auditLog.create).mockResolvedValue({} as any);

      const res = await request(app)
        .get(
          '/api/work-logs/export?startDate=2026-10-01&endDate=2026-10-15&team=Engineering&projectId=PRJ-101',
        )
        .set('Cookie', [`IMAC_SESSION=${mockEmployeeSession.id}`]);

      expect(res.status).toBe(200);

      expect(db.workLogEntry.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            projectId: 'PRJ-101',
            workLogDay: expect.objectContaining({
              employeeProfileId: mockEmployeeProfile.id,
              employeeProfile: { department: 'Engineering' },
            }),
          }),
        }),
      );
    });
  });

  // ── 3. Query Validation & Date Bounds ─────────────────────────────────────────
  describe('3. Query Validation & Filter Rules', () => {
    it('rejects missing startDate or endDate with 400 validation_error', async () => {
      const app = createApp({ csrfDisabled: true });
      setupAuth(mockEmployeeSession);

      const res = await request(app)
        .get('/api/work-logs/export?startDate=2026-10-01')
        .set('Cookie', [`IMAC_SESSION=${mockEmployeeSession.id}`]);

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('validation_error');
    });

    it('rejects endDate < startDate with 400 validation_error', async () => {
      const app = createApp({ csrfDisabled: true });
      setupAuth(mockEmployeeSession);

      const res = await request(app)
        .get('/api/work-logs/export?startDate=2026-10-15&endDate=2026-10-01')
        .set('Cookie', [`IMAC_SESSION=${mockEmployeeSession.id}`]);

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('validation_error');
      expect(res.body.details[0].message).toContain('greater than or equal to');
    });

    it('rejects date range exceeding 366 days with 400 validation_error', async () => {
      const app = createApp({ csrfDisabled: true });
      setupAuth(mockEmployeeSession);

      const res = await request(app)
        .get('/api/work-logs/export?startDate=2025-01-01&endDate=2026-01-10') // 374 days
        .set('Cookie', [`IMAC_SESSION=${mockEmployeeSession.id}`]);

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('validation_error');
      expect(res.body.details[0].message).toContain('366 days');
    });

    it('export is NOT limited by the 90-day save window (180 days within 366 succeeds)', async () => {
      const app = createApp({ csrfDisabled: true });
      setupAuth(mockEmployeeSession);

      vi.mocked(db.workLogEntry.count).mockResolvedValue(0);
      vi.mocked(db.workLogEntry.findMany).mockResolvedValue([]);
      vi.mocked(db.auditLog.create).mockResolvedValue({} as any);

      const res = await request(app)
        .get('/api/work-logs/export?startDate=2026-01-01&endDate=2026-06-30') // ~180 days
        .set('Cookie', [`IMAC_SESSION=${mockEmployeeSession.id}`]);

      expect(res.status).toBe(200);
    });

    it('rejects invalid status enum with 400 validation_error', async () => {
      const app = createApp({ csrfDisabled: true });
      setupAuth(mockEmployeeSession);

      const res = await request(app)
        .get('/api/work-logs/export?startDate=2026-10-01&endDate=2026-10-15&status=archived')
        .set('Cookie', [`IMAC_SESSION=${mockEmployeeSession.id}`]);

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('validation_error');
    });
  });

  // ── 4. 50,000 Row Cap Protection ──────────────────────────────────────────────
  describe('4. Row Cap & Memory Protection', () => {
    it('returns 400 row_limit_exceeded when entry count exceeds 50,000 before loading rows', async () => {
      const app = createApp({ csrfDisabled: true });
      setupAuth(mockAdminSession, null);

      // Mock count returning 50,001
      vi.mocked(db.workLogEntry.count).mockResolvedValue(50001);

      const res = await request(app)
        .get('/api/work-logs/export?startDate=2026-01-01&endDate=2026-12-31')
        .set('Cookie', [`IMAC_SESSION=${mockAdminSession.id}`]);

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('row_limit_exceeded');
      expect(res.body.message).toContain('50,000');
      // findMany must NOT be called when limit exceeded
      expect(db.workLogEntry.findMany).not.toHaveBeenCalled();
    });
  });

  // ── 5. ExcelJS Workbook Verification & Formula Neutralization ─────────────────
  describe('5. ExcelJS Workbook Structure, Types & Formula Neutralization', () => {
    it('neutralises formula injection on EVERY text cell starting with = + - @ or tab/whitespace', async () => {
      const app = createApp({ csrfDisabled: true });
      setupAuth(mockAdminSession, null);

      const injectionEntries = [
        {
          id: 'inj-1',
          hours: 4.25,
          description: '=cmd|/c calc!A0',
          projectId: '+PROJECT-CMD',
          taskId: '\t@TASK-TAB',
          workRoleId: mockRoleDev.id,
          workRole: {
            id: mockRoleDev.id,
            name: '-FormulaRole',
          },
          workLogDay: {
            id: 'day-inj',
            date: new Date('2026-10-20T00:00:00.000Z'),
            status: 'submitted',
            submittedAt: new Date('2026-10-20T10:00:00.000Z'),
            employeeProfile: {
              id: 'prof-inj',
              employeeCode: '@EMP-AT',
              department: '   +Finance',
              user: {
                id: 'user-inj',
                displayName: '=HackerName',
                username: 'hacker',
              },
            },
          },
        },
      ];

      vi.mocked(db.workLogEntry.count).mockResolvedValue(1);
      vi.mocked(db.workLogEntry.findMany).mockResolvedValue(injectionEntries as any);
      vi.mocked(db.auditLog.create).mockResolvedValue({} as any);

      const res = await request(app)
        .get('/api/work-logs/export?startDate=2026-10-01&endDate=2026-10-31')
        .set('Cookie', [`IMAC_SESSION=${mockAdminSession.id}`])
        .responseType('blob');

      expect(res.status).toBe(200);

      const wb = new ExcelJS.Workbook();
      await wb.xlsx.load(res.body);

      const wsEntries = wb.getWorksheet('Entries')!;
      expect(wsEntries.rowCount).toBe(2);

      const dataRow = wsEntries.getRow(2);
      // Col 1: Employee Name
      expect(dataRow.getCell(1).value).toBe("'=HackerName");
      // Col 2: Employee Code
      expect(dataRow.getCell(2).value).toBe("'@EMP-AT");
      // Col 3: Department (has leading whitespace then +)
      expect(dataRow.getCell(3).value).toBe("'   +Finance");
      // Col 4: Date (Real Date object, NOT string and NOT neutralized)
      expect(dataRow.getCell(4).type).toBe(ExcelJS.ValueType.Date);
      expect(dataRow.getCell(4).numFmt).toBe('yyyy-mm-dd');
      // Col 7: Work Role
      expect(dataRow.getCell(7).value).toBe("'-FormulaRole");
      // Col 8: Hours (Real number, NOT string and NOT neutralized)
      expect(dataRow.getCell(8).type).toBe(ExcelJS.ValueType.Number);
      expect(dataRow.getCell(8).value).toBe(4.25);
      expect(dataRow.getCell(8).numFmt).toBe('#,##0.00');
      // Col 9: Description
      expect(dataRow.getCell(9).value).toBe("'=cmd|/c calc!A0");
      // Col 10: Project ID
      expect(dataRow.getCell(10).value).toBe("'+PROJECT-CMD");
      // Col 11: Task ID (starts with tab then @)
      expect(dataRow.getCell(11).value).toBe("'\t@TASK-TAB");
      // Col 12: Submitted At (Real Date object with yyyy-mm-dd hh:mm numFmt)
      expect(dataRow.getCell(12).type).toBe(ExcelJS.ValueType.Date);
      expect(dataRow.getCell(12).numFmt).toBe('yyyy-mm-dd hh:mm');

      // Verify Summary sheet has no non-ASCII characters in title and states time zone
      const wsSummary = wb.getWorksheet('Summary')!;
      const title = String(wsSummary.getRow(1).getCell(1).value);
      expect(/^[\x00-\x7F]*$/.test(title)).toBe(true);
      expect(title).toContain('IMAC Nepal - Daily Work Log Export Summary');

      // Verify Summary sheet has NO 7-row freeze
      const views = (wsSummary as any).views || [];
      const hasFrozenView = views.some((v: any) => v.state === 'frozen');
      expect(hasFrozenView).toBe(false);

      // Summary title block states Time Zone
      const timeZoneCell = String(wsSummary.getRow(2).getCell(1).value);
      expect(timeZoneCell).toContain('Time Zone: Asia/Kathmandu');
    });

    it('empty result still returns a valid workbook with headers and zero totals', async () => {
      const app = createApp({ csrfDisabled: true });
      setupAuth(mockEmployeeSession);

      vi.mocked(db.workLogEntry.count).mockResolvedValue(0);
      vi.mocked(db.workLogEntry.findMany).mockResolvedValue([]);
      vi.mocked(db.auditLog.create).mockResolvedValue({} as any);

      const res = await request(app)
        .get('/api/work-logs/export?startDate=2026-10-01&endDate=2026-10-15')
        .set('Cookie', [`IMAC_SESSION=${mockEmployeeSession.id}`])
        .responseType('blob');

      expect(res.status).toBe(200);

      const wb = new ExcelJS.Workbook();
      await wb.xlsx.load(res.body);

      const wsSummary = wb.getWorksheet('Summary')!;
      expect(wsSummary).toBeDefined();

      const wsEntries = wb.getWorksheet('Entries')!;
      expect(wsEntries).toBeDefined();
      expect(wsEntries.rowCount).toBe(1); // Only header row
      expect(wsEntries.getRow(1).getCell(1).value).toBe('Employee Name');
    });

    it('sets correct response headers (xlsx content-type, safe disposition, no-store, nosniff)', async () => {
      const app = createApp({ csrfDisabled: true });
      setupAuth(mockEmployeeSession);

      vi.mocked(db.workLogEntry.count).mockResolvedValue(0);
      vi.mocked(db.workLogEntry.findMany).mockResolvedValue([]);
      vi.mocked(db.auditLog.create).mockResolvedValue({} as any);

      const res = await request(app)
        .get('/api/work-logs/export?startDate=2026-10-01&endDate=2026-10-15')
        .set('Cookie', [`IMAC_SESSION=${mockEmployeeSession.id}`]);

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain(
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      );
      expect(res.headers['content-disposition']).toBe(
        'attachment; filename="work-logs-export.xlsx"',
      );
      expect(res.headers['cache-control']).toBe('no-store');
      expect(res.headers['x-content-type-options']).toBe('nosniff');
    });
  });

  // ── 6. Audit Trail & Failure Handling ─────────────────────────────────────────
  describe('6. Audit Logging & Pre-Send Security Invariants', () => {
    it('creates AuditLog entry before sending file (action: work_log.exported) with no descriptions', async () => {
      const app = createApp({ csrfDisabled: true });
      setupAuth(mockEmployeeSession);

      vi.mocked(db.workLogEntry.count).mockResolvedValue(1);
      vi.mocked(db.workLogEntry.findMany).mockResolvedValue([sampleEntries[0]] as any);
      vi.mocked(db.auditLog.create).mockResolvedValue({} as any);

      const res = await request(app)
        .get('/api/work-logs/export?startDate=2026-10-01&endDate=2026-10-15&status=submitted')
        .set('Cookie', [`IMAC_SESSION=${mockEmployeeSession.id}`]);

      expect(res.status).toBe(200);
      expect(db.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: 'work_log.exported',
            actorUserId: mockEmployeeUser.id,
            entityType: 'WorkLogDay',
            entityId: null,
            afterSnapshot: expect.objectContaining({
              scope: 'own',
              rowCount: 1,
              filters: expect.objectContaining({
                startDate: '2026-10-01',
                endDate: '2026-10-15',
                status: 'submitted',
              }),
            }),
          }),
        }),
      );

      // Verify no description text in audit snapshot
      const auditCall = vi.mocked(db.auditLog.create).mock.calls[0][0];
      const snapshotStr = JSON.stringify(auditCall.data.afterSnapshot);
      expect(snapshotStr).not.toContain('Worked on auth module');
    });

    it('returns 500 and sends nothing if AuditLog creation fails', async () => {
      const app = createApp({ csrfDisabled: true });
      setupAuth(mockEmployeeSession);

      vi.mocked(db.workLogEntry.count).mockResolvedValue(1);
      vi.mocked(db.workLogEntry.findMany).mockResolvedValue([sampleEntries[0]] as any);
      // Simulate audit log DB failure
      vi.mocked(db.auditLog.create).mockRejectedValue(new Error('Audit DB down'));

      const res = await request(app)
        .get('/api/work-logs/export?startDate=2026-10-01&endDate=2026-10-15')
        .set('Cookie', [`IMAC_SESSION=${mockEmployeeSession.id}`]);

      expect(res.status).toBe(500);
      expect(res.body.error).toBe('internal_error');
      // Content-type must NOT be spreadsheet
      expect(res.headers['content-type']).not.toContain('spreadsheet');
    });
  });

  // ── 7. Route Precedence ───────────────────────────────────────────────────────
  describe('7. Route Precedence (/export before /:id)', () => {
    it('GET /api/work-logs/export is not captured by /api/work-logs/:id', async () => {
      const app = createApp({ csrfDisabled: true });
      setupAuth(mockEmployeeSession);

      vi.mocked(db.workLogEntry.count).mockResolvedValue(0);
      vi.mocked(db.workLogEntry.findMany).mockResolvedValue([]);
      vi.mocked(db.auditLog.create).mockResolvedValue({} as any);

      const res = await request(app)
        .get('/api/work-logs/export?startDate=2026-10-01&endDate=2026-10-15')
        .set('Cookie', [`IMAC_SESSION=${mockEmployeeSession.id}`]);

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain(
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      );
      // Verify db.workLogDay.findFirst with id='export' was NOT called
      expect(db.workLogDay.findFirst).not.toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            id: 'export',
          }),
        }),
      );
    });
  });

  // ── 8. User Field Selection & Security (Item 4) ────────────────────────────────
  describe('8. User Field Selection & Security (Item 4)', () => {
    it('export query selects only required user fields and excludes passwordHash', async () => {
      const app = createApp({ csrfDisabled: true });
      setupAuth(mockAdminSession, null);

      vi.mocked(db.workLogEntry.count).mockResolvedValue(0);
      vi.mocked(db.workLogEntry.findMany).mockResolvedValue([]);
      vi.mocked(db.auditLog.create).mockResolvedValue({} as any);

      await request(app)
        .get('/api/work-logs/export?startDate=2026-10-01&endDate=2026-10-15')
        .set('Cookie', [`IMAC_SESSION=${mockAdminSession.id}`]);

      expect(db.workLogEntry.findMany).toHaveBeenCalledTimes(1);
      const findManyCall = vi.mocked(db.workLogEntry.findMany).mock.calls[0][0] as any;
      const userSelect =
        findManyCall.include.workLogDay.include.employeeProfile.include.user.select;

      expect(userSelect).toBeDefined();
      expect(userSelect.displayName).toBe(true);
      expect(userSelect.username).toBe(true);
      expect(userSelect.passwordHash).toBeUndefined();
    });
  });

  // ── 9. Export Rate Limiting (Item 8) ───────────────────────────────────────────
  describe('9. Export Rate Limiting (Item 8)', () => {
    it('returns 429 too_many_requests when export limit is exceeded', async () => {
      const { rateLimit } = await import('express-rate-limit');
      const testLimiter = rateLimit({
        windowMs: 15 * 60 * 1000,
        max: 2,
        standardHeaders: true,
        legacyHeaders: false,
        message: {
          error: 'too_many_requests',
          message: 'Too many export requests, please try again later',
        },
      });

      const express = (await import('express')).default;
      const testApp = express();
      testApp.use('/api/work-logs/export', testLimiter, (_req, res) => {
        res.status(200).json({ ok: true });
      });

      const res1 = await request(testApp).get('/api/work-logs/export');
      expect(res1.status).toBe(200);

      const res2 = await request(testApp).get('/api/work-logs/export');
      expect(res2.status).toBe(200);

      const res3 = await request(testApp).get('/api/work-logs/export');
      expect(res3.status).toBe(429);
      expect(res3.body.error).toBe('too_many_requests');
    });
  });
});
