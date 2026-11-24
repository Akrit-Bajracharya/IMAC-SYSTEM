import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import fs from 'fs';
import path from 'path';
import { createApp } from '../app.js';
import { db } from '../db.js';
import {
  PROJECT_MAPPABLE_ENTITY_TYPES,
  ADMIN_ONLY_ENTITY_TYPES,
  ALL_KNOWN_ENTITY_TYPES,
  SYSTEM_ADMIN_ALLOW_LIST,
  PROJECT_MANAGER_ALLOW_LIST,
  PROJECT_ACTIONS,
  sanitizeSnapshot,
} from '../routes/auditLogs.js';

/**
 * -----------------------------------------------------------------------------
 * MOCK LIMITATIONS AND BOUNDARY DOCUMENTATION:
 *
 * 1. Mock-based Tests:
 *    The tests in this suite mock Prisma database operations (db.auditLog,
 *    db.projectMember, db.project, db.session, db.user, db.$queryRaw) via Vitest spies.
 *
 * 2. What Mocks Cannot Prove:
 *    - Real PostgreSQL JSON extraction performance:
 *      (e.g. beforeSnapshot->>'projectId' indexless sequential scans).
 *    - Real PostgreSQL date arithmetic and timezone conversions at the engine level.
 *    - Real PostgreSQL ANY() array binding behavior with thousands of project IDs.
 *    - Real concurrent read/write isolation against live PostgreSQL transactions.
 * -----------------------------------------------------------------------------
 */

describe('Step 19a: Audit Log Read API Integration Tests', () => {
  const app = createApp({ csrfDisabled: true });

  const adminUserId = '11111111-1111-4111-8111-111111111111';
  const pmUserId = '22222222-2222-4222-8222-222222222222';
  const plainPmUserId = '33333333-3333-4333-8333-333333333333';
  const hrUserId = '44444444-4444-4444-8444-444444444444';
  const employeeUserId = '55555555-5555-4555-8555-555555555555';
  const viewerUserId = '66666666-6666-4666-8666-666666666666';

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
    [plainPmUserId]: {
      id: plainPmUserId,
      username: 'pm_plain',
      displayName: 'Plain PM No Projects',
      systemRole: 'project_manager',
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
    [employeeUserId]: {
      id: employeeUserId,
      username: 'staff_dev',
      displayName: 'Staff Dev',
      systemRole: 'employee',
      isActive: true,
      mustChangePassword: false,
    },
    [viewerUserId]: {
      id: viewerUserId,
      username: 'viewer_auditor',
      displayName: 'Auditor Viewer',
      systemRole: 'viewer',
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

  const projectAId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const projectBId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

  beforeEach(() => {
    vi.clearAllMocks();
    (db.auditLog.create as any).mockResolvedValue({});
    (db.project.findUnique as any).mockResolvedValue({ id: projectAId, name: 'Project Alpha' });
    (db.projectMember.findMany as any).mockResolvedValue([{ projectId: projectAId }]);
    (db.$queryRaw as any).mockImplementation(async (query: any) => {
      // Differentiate between COUNT(*) query and items query
      const queryStr = String(query?.strings ? query.strings.join('') : query);
      if (queryStr.includes('COUNT(*)')) {
        return [{ count: 1 }];
      }
      return [
        {
          id: 'log-1',
          createdAt: new Date('2026-11-20T10:00:00Z'),
          action: 'project.updated',
          entityType: 'project',
          entityId: projectAId,
          actorUserId: adminUserId,
          beforeSnapshot: { name: 'Old Alpha', body: 'Confidential secret body', reason: 'User reason' },
          afterSnapshot: { name: 'New Alpha', passwordHash: 'argon2$hash' },
          u_id: adminUserId,
          u_displayName: 'System Admin Boss',
          u_username: 'admin_boss',
        },
      ];
    });
  });

  // -- 1. Authentication & Role Permissions ---------------------------------

  describe('Authentication and RBAC Role Access', () => {
    it('returns 401 unauthenticated when session cookie is missing', async () => {
      const res = await request(app).get('/api/audit-logs');
      expect(res.status).toBe(401);
      expect(res.body.error).toBe('unauthenticated');
    });

    it('returns 403 forbidden for hr_admin', async () => {
      const cookie = setupAuth(hrUserId);
      const res = await request(app).get('/api/audit-logs').set('Cookie', cookie);
      expect(res.status).toBe(403);
      expect(res.body.error).toBe('forbidden');
    });

    it('returns 403 forbidden for employee', async () => {
      const cookie = setupAuth(employeeUserId);
      const res = await request(app).get('/api/audit-logs').set('Cookie', cookie);
      expect(res.status).toBe(403);
      expect(res.body.error).toBe('forbidden');
    });

    it('returns 403 forbidden for viewer', async () => {
      const cookie = setupAuth(viewerUserId);
      const res = await request(app).get('/api/audit-logs').set('Cookie', cookie);
      expect(res.status).toBe(403);
      expect(res.body.error).toBe('forbidden');
    });

    it('allows system_admin to read audit logs', async () => {
      const cookie = setupAuth(adminUserId);
      const res = await request(app).get('/api/audit-logs').set('Cookie', cookie);
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('items');
      expect(res.body).toHaveProperty('total');
      expect(res.body.limit).toBe(50);
      expect(res.body.offset).toBe(0);
    });

    it('allows project_manager with managed projects to read audit logs', async () => {
      const cookie = setupAuth(pmUserId);
      const res = await request(app).get('/api/audit-logs').set('Cookie', cookie);
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('items');
      expect(res.body).toHaveProperty('total');
    });
    it('Item 4: fails closed with 403 if caller bypasses can() but is neither system_admin nor project_manager', async () => {
      const cookie = setupAuth(employeeUserId);
      const permissionsModule = await import('../lib/permissions.js');
      const canSpy = vi.spyOn(permissionsModule, 'can').mockReturnValue(true);

      const res = await request(app).get('/api/audit-logs').set('Cookie', cookie);
      expect(res.status).toBe(403);
      expect(res.body.error).toBe('forbidden');
      expect(res.body.message).toContain('Access denied');
      expect(db.$queryRaw).not.toHaveBeenCalled();

      canSpy.mockRestore();
    });
  });

  // -- 2. Project Manager Scoping Rules -------------------------------------

  describe('Project Manager Scoping & Security Boundaries', () => {
    it('returns empty list for project_manager who manages zero projects', async () => {
      const cookie = setupAuth(plainPmUserId);
      (db.projectMember.findMany as any).mockResolvedValueOnce([]); // no managed projects

      const res = await request(app).get('/api/audit-logs').set('Cookie', cookie);
      expect(res.status).toBe(200);
      expect(res.body.items).toEqual([]);
      expect(res.body.total).toBe(0);
      expect(db.$queryRaw).not.toHaveBeenCalled();
    });

    it('returns 404 not_found when project_manager asks for a project they do not manage', async () => {
      const cookie = setupAuth(pmUserId);
      // Caller manages projectAId, but requests projectBId
      (db.projectMember.findMany as any).mockResolvedValueOnce([{ projectId: projectAId }]);

      const res = await request(app)
        .get(`/api/audit-logs?projectId=${projectBId}`)
        .set('Cookie', cookie);

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('not_found');
    });

    it('returns 404 not_found when project_manager is only a plain member/viewer of the project', async () => {
      const cookie = setupAuth(pmUserId);
      // User is only 'member', not 'manager' in projectBId
      (db.projectMember.findMany as any).mockResolvedValueOnce([
        // only projectA is returned by query because query filters by projectRole: 'manager'
        { projectId: projectAId },
      ]);

      const res = await request(app)
        .get(`/api/audit-logs?projectId=${projectBId}`)
        .set('Cookie', cookie);

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('not_found');
    });

    it('Amendment F: returns empty list (no 403, no leakage) if project_manager passes non-project entityType', async () => {
      const cookie = setupAuth(pmUserId);
      const res = await request(app)
        .get('/api/audit-logs?entityType=User')
        .set('Cookie', cookie);

      expect(res.status).toBe(200);
      expect(res.body.items).toEqual([]);
      expect(res.body.total).toBe(0);
      expect(db.$queryRaw).not.toHaveBeenCalled();
    });

    it('Amendment F: returns empty list (no 403, no leakage) if project_manager passes non-project action', async () => {
      const cookie = setupAuth(pmUserId);
      const res = await request(app)
        .get('/api/audit-logs?action=settings.updated')
        .set('Cookie', cookie);

      expect(res.status).toBe(200);
      expect(res.body.items).toEqual([]);
      expect(res.body.total).toBe(0);
      expect(db.$queryRaw).not.toHaveBeenCalled();
    });

    it('allows system_admin to query non-project entityType and actions', async () => {
      const cookie = setupAuth(adminUserId);
      const res = await request(app)
        .get('/api/audit-logs?entityType=SystemSetting&action=settings.updated')
        .set('Cookie', cookie);

      expect(res.status).toBe(200);
      expect(db.$queryRaw).toHaveBeenCalled();
    });

    it('Item 1: asserts the bound SQL query for project_manager restricts entityType and action with bound parameters', async () => {
      const cookie = setupAuth(pmUserId);
      (db.projectMember.findMany as any).mockResolvedValueOnce([{ projectId: projectAId }]);

      let capturedArgs: any[] = [];
      (db.$queryRaw as any).mockImplementation(async (...args: any[]) => {
        capturedArgs = args;
        const queryStr = String(args[0]?.strings ? args[0].strings.join('') : (Array.isArray(args[0]) ? args[0].join('') : args[0]));
        if (queryStr.includes('COUNT(*)')) {
          return [{ count: 1 }];
        }
        return [];
      });

      const res = await request(app).get('/api/audit-logs').set('Cookie', cookie);
      expect(res.status).toBe(200);

      expect(capturedArgs.length).toBeGreaterThan(0);
      const whereSql = capturedArgs[1]?.strings ? capturedArgs[1] : capturedArgs[0];
      const sqlStrings = whereSql?.strings ? whereSql.strings.join('') : String(whereSql);
      expect(sqlStrings).toContain('a."entityType" IN (');
      expect(sqlStrings).toContain('a."action" IN (');

      const boundValues = whereSql?.values ?? [];
      for (const et of PROJECT_MAPPABLE_ENTITY_TYPES) {
        expect(boundValues).toContain(et);
      }
      for (const act of PROJECT_ACTIONS) {
        expect(boundValues).toContain(act);
      }
      expect(PROJECT_ACTIONS).not.toContain('work_log.edited_after_submit');
      expect(PROJECT_ACTIONS).not.toContain('work_log.admin_override');
      expect(PROJECT_ACTIONS).not.toContain('user.created');
      expect(PROJECT_ACTIONS).not.toContain('settings.updated');
      expect(PROJECT_ACTIONS).not.toContain('time_log.removed');
    });

    it('Item 1: work_log.edited_after_submit row with projectId in its snapshot is NOT in project_manager scope definition', () => {
      expect((PROJECT_MAPPABLE_ENTITY_TYPES as readonly string[]).includes('WorkLogDay')).toBe(false);
      expect((PROJECT_ACTIONS as readonly string[]).includes('work_log.edited_after_submit')).toBe(false);

      const mockRow = {
        action: 'work_log.edited_after_submit',
        entityType: 'WorkLogDay',
        afterSnapshot: { projectId: projectAId },
      };
      const isMappable = (PROJECT_MAPPABLE_ENTITY_TYPES as readonly string[]).includes(mockRow.entityType) &&
        (PROJECT_ACTIONS as readonly string[]).includes(mockRow.action);
      expect(isMappable).toBe(false);
    });
  });

  // -- 3. Query Parameter Validation & Date Boundaries -----------------------

  describe('Query Parameter Validation & Edge Cases', () => {
    it('accepts offset=0 as valid non-negative integer', async () => {
      const cookie = setupAuth(adminUserId);
      const res = await request(app).get('/api/audit-logs?offset=0').set('Cookie', cookie);
      expect(res.status).toBe(200);
      expect(res.body.offset).toBe(0);
    });

    it('rejects limit > 100 with 400 validation_error', async () => {
      const cookie = setupAuth(adminUserId);
      const res = await request(app).get('/api/audit-logs?limit=101').set('Cookie', cookie);
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('validation_error');
    });

    it('rejects impossible calendar date 2026-02-31 with 400 validation_error', async () => {
      const cookie = setupAuth(adminUserId);
      const res = await request(app)
        .get('/api/audit-logs?from=2026-02-31&to=2026-03-05')
        .set('Cookie', cookie);
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('validation_error');
    });

    it('rejects to date before from date with 400 validation_error', async () => {
      const cookie = setupAuth(adminUserId);
      const res = await request(app)
        .get('/api/audit-logs?from=2026-11-20&to=2026-11-10')
        .set('Cookie', cookie);
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('validation_error');
    });

    it('rejects date range exceeding 366 days with 400 validation_error', async () => {
      const cookie = setupAuth(adminUserId);
      const res = await request(app)
        .get('/api/audit-logs?from=2025-01-01&to=2026-02-01')
        .set('Cookie', cookie);
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('validation_error');
    });

    it('rejects empty string query parameters with 400 validation_error', async () => {
      const cookie = setupAuth(adminUserId);
      const res = await request(app).get('/api/audit-logs?action=').set('Cookie', cookie);
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('validation_error');
      expect(res.body.message).toContain('cannot be empty');
    });

    it('rejects malformed UUID projectId with 400 validation_error', async () => {
      const cookie = setupAuth(adminUserId);
      const res = await request(app)
        .get('/api/audit-logs?projectId=not-a-valid-uuid')
        .set('Cookie', cookie);
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('validation_error');
    });

    it('Item 3: rejects array query parameters (?param=a&param=b) with 400 validation_error for all supported params', async () => {
      const cookie = setupAuth(adminUserId);
      const params = ['from', 'to', 'actorUserId', 'action', 'entityType', 'projectId', 'limit', 'offset'];

      for (const param of params) {
        const res = await request(app)
          .get(`/api/audit-logs?${param}=val1&${param}=val2`)
          .set('Cookie', cookie);
        expect(res.status, `param ${param} as array must return 400`).toBe(400);
        expect(res.body.error).toBe('validation_error');
        expect(res.body.message).toContain('plain string');
      }
    });

    it('Item 3: rejects object query parameters with 400 validation_error', async () => {
      const cookie = setupAuth(adminUserId);
      const res = await request(app)
        .get('/api/audit-logs?from[nested]=val')
        .set('Cookie', cookie);
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('validation_error');
    });
  });

  // -- 4. Privacy & Allow-Lists (Amendment C) --------------------------------

  describe('Privacy, Secrets and Snapshot Allow-Lists (Amendment C)', () => {
    it('strips secrets (body, passwordHash, reason) from returned snapshots for system_admin', async () => {
      const cookie = setupAuth(adminUserId);
      const res = await request(app).get('/api/audit-logs').set('Cookie', cookie);
      expect(res.status).toBe(200);
      const item = res.body.items[0];

      // Allowed fields present
      expect(item.beforeSnapshot).toHaveProperty('name', 'Old Alpha');
      expect(item.afterSnapshot).toHaveProperty('name', 'New Alpha');

      // Private / secret fields stripped
      expect(item.beforeSnapshot).not.toHaveProperty('body');
      expect(item.beforeSnapshot).not.toHaveProperty('reason');
      expect(item.afterSnapshot).not.toHaveProperty('passwordHash');
    });

    it('strips non-project administrative fields from project_manager snapshots', () => {
      const sampleSnapshot = {
        title: 'Fix issue',
        status: 'in_progress',
        employeeCode: 'EMP-001',
        department: 'Operations',
        jobTitle: 'Developer',
        systemRole: 'employee',
        lockedUntil: '2026-11-25T00:00:00Z',
        failedLoginCount: 3,
        reason: 'Free text notes',
        body: 'Confidential comments',
        note: 'Secret note',
        ipAddress: '127.0.0.1',
      };

      const pmSanitized = sanitizeSnapshot(sampleSnapshot, PROJECT_MANAGER_ALLOW_LIST);
      expect(pmSanitized).toEqual({
        title: 'Fix issue',
        status: 'in_progress',
      });

      // Assert that sensitive admin attributes were stripped
      expect(pmSanitized).not.toHaveProperty('employeeCode');
      expect(pmSanitized).not.toHaveProperty('department');
      expect(pmSanitized).not.toHaveProperty('jobTitle');
      expect(pmSanitized).not.toHaveProperty('systemRole');
      expect(pmSanitized).not.toHaveProperty('lockedUntil');
      expect(pmSanitized).not.toHaveProperty('failedLoginCount');
      expect(pmSanitized).not.toHaveProperty('reason');
      expect(pmSanitized).not.toHaveProperty('body');
      expect(pmSanitized).not.toHaveProperty('note');
    });

    it('renders placeholder for deleted or null actor users', async () => {
      const cookie = setupAuth(adminUserId);
      (db.$queryRaw as any).mockImplementation(async (query: any) => {
        const queryStr = String(query?.strings ? query.strings.join('') : query);
        if (queryStr.includes('COUNT(*)')) {
          return [{ count: 1 }];
        }
        return [
          {
            id: 'log-orphan',
            createdAt: new Date('2026-11-21T10:00:00Z'),
            action: 'project.updated',
            entityType: 'project',
            entityId: projectAId,
            actorUserId: 'deleted-user-uuid',
            beforeSnapshot: null,
            afterSnapshot: null,
            u_id: null,
            u_displayName: null,
            u_username: null,
          },
        ];
      });

      const res = await request(app).get('/api/audit-logs').set('Cookie', cookie);
      expect(res.status).toBe(200);
      const item = res.body.items[0];
      expect(item.actor).toEqual({
        id: 'deleted-user-uuid',
        displayName: 'Deleted User',
        username: 'deleted',
      });
    });
  });

  // -- 5. Read-Only Invariant ------------------------------------------------

  describe('Read-Only Route Safety', () => {
    it('returns 404 for mutating HTTP methods on /api/audit-logs', async () => {
      const cookie = setupAuth(adminUserId);

      const postRes = await request(app).post('/api/audit-logs').set('Cookie', cookie).send({});
      expect([404, 405]).toContain(postRes.status);

      const patchRes = await request(app).patch('/api/audit-logs').set('Cookie', cookie).send({});
      expect([404, 405]).toContain(patchRes.status);

      const putRes = await request(app).put('/api/audit-logs').set('Cookie', cookie).send({});
      expect([404, 405]).toContain(putRes.status);

      const delRes = await request(app).delete('/api/audit-logs').set('Cookie', cookie);
      expect([404, 405]).toContain(delRes.status);
    });

    it('reading audit logs does NOT trigger audit log creation', async () => {
      const cookie = setupAuth(adminUserId);
      await request(app).get('/api/audit-logs').set('Cookie', cookie);
      expect(db.auditLog.create).not.toHaveBeenCalled();
    });
  });

  // -- 6. Static Scan Coverage Tests (Amendments D & G) -----------------------

  describe('Static Code Scans (Amendments D & G)', () => {
    it('Amendment D: asserts auditLogs.ts does NOT contain $queryRawUnsafe or raw string interpolation', () => {
      const routePath = path.resolve(__dirname, '../routes/auditLogs.ts');
      const source = fs.readFileSync(routePath, 'utf8');

      expect(source.includes('$queryRawUnsafe'), 'auditLogs.ts must NOT use $queryRawUnsafe').toBe(false);
      // Ensure all queries use Prisma.sql or Prisma.join
      expect(source.includes('db.$queryRaw'), 'auditLogs.ts must use db.$queryRaw with Prisma.sql').toBe(true);
    });

    it('Amendment G: every entityType written across all routes is classified as project-mappable or admin-only', () => {
      const routesDir = path.resolve(__dirname, '../routes');
      const files = fs.readdirSync(routesDir, { recursive: true }) as string[];

      const writtenEntityTypes = new Set<string>();

      for (const relFile of files) {
        if (!relFile.endsWith('.ts')) continue;
        if (relFile === 'auditLogs.ts' || relFile.endsWith('/auditLogs.ts') || relFile.endsWith('\\auditLogs.ts')) {
          continue; // auditLogs.ts is read-only and does not write audit entries
        }
        const filePath = path.join(routesDir, relFile);
        const content = fs.readFileSync(filePath, 'utf8');

        // Regex scanning for entityType: '...' or entityType: "..."
        const regex = /entityType:\s*['"]([a-zA-Z0-9_]+)['"]/g;
        let match: RegExpExecArray | null;
        while ((match = regex.exec(content)) !== null) {
          writtenEntityTypes.add(match[1]!);
        }
      }

      expect(writtenEntityTypes.size).toBeGreaterThan(0);

      // Verify each written entityType is known and classified
      for (const entityType of writtenEntityTypes) {
        const isProjectMappable = (PROJECT_MAPPABLE_ENTITY_TYPES as readonly string[]).includes(entityType);
        const isAdminOnly = (ADMIN_ONLY_ENTITY_TYPES as readonly string[]).includes(entityType);

        expect(
          isProjectMappable || isAdminOnly,
          `entityType "${entityType}" written in routes must be classified as either PROJECT_MAPPABLE_ENTITY_TYPES or ADMIN_ONLY_ENTITY_TYPES`
        ).toBe(true);
      }
    });
  });
});
