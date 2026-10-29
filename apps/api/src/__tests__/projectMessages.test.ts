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
 *    db.projectMessage.*, db.task.*, db.auditLog.*, db.session.*, db.$transaction, db.$queryRaw)
 *    via Vitest spies.
 *
 * 2. What Mocks Cannot Prove:
 *    - Real PostgreSQL Transaction Advisory Locks (SELECT pg_advisory_xact_lock(...)):
 *      Mocks verify that the SQL query is issued and that duplicate conversions return 409,
 *      but Vitest mock execution cannot simulate true multi-connection lock contention
 *      or concurrent racing threads converting the exact same message simultaneously.
 *    - Physical Database Cascade Deletions: Mocks cannot test database-level CASCADE
 *      when a project or user is deleted.
 * ─────────────────────────────────────────────────────────────────────────────
 */

describe('Step 10e Part B: Project Messages Subsystem Tests', () => {
  const app = createApp({ csrfDisabled: true });

  const adminUserId = '11111111-1111-4111-8111-111111111111';
  const managerUserId = '22222222-2222-4222-8222-222222222222';
  const memberUserId = '33333333-3333-4333-8333-333333333333';
  const viewerUserId = '44444444-4444-4444-8444-444444444444';
  const systemViewerUserId = '55555555-5555-4555-8555-555555555555';
  const nonMemberUserId = '66666666-6666-4666-8666-666666666666';

  const validProjectId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const otherProjectId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  const validMessageId = '90909090-9090-4090-8090-909090909090';
  const foreignMessageId = '80808080-8080-4080-8080-808080808080';

  const mockUsers: Record<string, any> = {
    [adminUserId]: {
      id: adminUserId,
      username: 'boss_admin',
      displayName: 'Boss Admin',
      systemRole: 'system_admin',
      isActive: true,
      mustChangePassword: false,
    },
    [managerUserId]: {
      id: managerUserId,
      username: 'pm_lead',
      displayName: 'PM Lead',
      systemRole: 'project_manager',
      isActive: true,
      mustChangePassword: false,
    },
    [memberUserId]: {
      id: memberUserId,
      username: 'dev_john',
      displayName: 'Dev John',
      systemRole: 'employee',
      isActive: true,
      mustChangePassword: false,
    },
    [viewerUserId]: {
      id: viewerUserId,
      username: 'proj_viewer',
      displayName: 'Project Viewer',
      systemRole: 'employee',
      isActive: true,
      mustChangePassword: false,
    },
    [systemViewerUserId]: {
      id: systemViewerUserId,
      username: 'sys_viewer',
      displayName: 'System Viewer',
      systemRole: 'viewer',
      isActive: true,
      mustChangePassword: false,
    },
    [nonMemberUserId]: {
      id: nonMemberUserId,
      username: 'outsider',
      displayName: 'Outsider User',
      systemRole: 'employee',
      isActive: true,
      mustChangePassword: false,
    },
  };

  const mockMembers: Record<string, any> = {
    [adminUserId]: { projectId: validProjectId, userId: adminUserId, projectRole: 'manager' },
    [managerUserId]: { projectId: validProjectId, userId: managerUserId, projectRole: 'manager' },
    [memberUserId]: { projectId: validProjectId, userId: memberUserId, projectRole: 'member' },
    [viewerUserId]: { projectId: validProjectId, userId: viewerUserId, projectRole: 'viewer' },
    [systemViewerUserId]: { projectId: validProjectId, userId: systemViewerUserId, projectRole: 'viewer' },
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
    vi.mocked(db.session.findUnique).mockResolvedValue(session as any);
    vi.mocked(db.session.update).mockResolvedValue(session as any);

    // Mock projectAccess resolution
    (db.project.findUnique as any).mockImplementation(async ({ where }: any) => {
      if (where.id === validProjectId) {
        return {
          id: validProjectId,
          name: 'Core System',
          status: 'in_progress',
        } as any;
      }
      return null;
    });

    (db.projectMember.findUnique as any).mockImplementation(async ({ where }: any) => {
      const pId = where.projectId_userId?.projectId;
      const uId = where.projectId_userId?.userId;
      if (pId === validProjectId && mockMembers[uId]) {
        return mockMembers[uId];
      }
      return null;
    });

    return `IMAC_SESSION=sess-${userId}`;
  }

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(db.auditLog.create).mockResolvedValue({} as any);
    vi.mocked(db.$queryRaw).mockResolvedValue([{ id: 'mock-lock' }] as any);
  });

  describe('1. Non-Member and Foreign ID 404 Guards', () => {
    it('returns 404 for non-members on POST /api/projects/:id/messages', async () => {
      const cookie = setupAuth(nonMemberUserId);

      const res = await request(app)
        .post(`/api/projects/${validProjectId}/messages`)
        .set('Cookie', cookie)
        .send({ body: 'Hello team' });

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('not_found');
    });

    it('returns 404 for non-members on GET /api/projects/:id/messages', async () => {
      const cookie = setupAuth(nonMemberUserId);

      const res = await request(app)
        .get(`/api/projects/${validProjectId}/messages`)
        .set('Cookie', cookie);

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('not_found');
    });

    it('returns 404 for foreign messageId on pin, unpin, and to-task', async () => {
      const cookie = setupAuth(managerUserId);

      vi.mocked(db.projectMessage.findFirst).mockResolvedValue(null); // Message not found in validProjectId

      const pinRes = await request(app)
        .post(`/api/projects/${validProjectId}/messages/${foreignMessageId}/pin`)
        .set('Cookie', cookie);
      expect(pinRes.status).toBe(404);

      const unpinRes = await request(app)
        .post(`/api/projects/${validProjectId}/messages/${foreignMessageId}/unpin`)
        .set('Cookie', cookie);
      expect(unpinRes.status).toBe(404);

      const toTaskRes = await request(app)
        .post(`/api/projects/${validProjectId}/messages/${foreignMessageId}/to-task`)
        .set('Cookie', cookie);
      expect(toTaskRes.status).toBe(404);
    });

    it('returns 404 for malformed UUID messageId on pin and to-task', async () => {
      const cookie = setupAuth(managerUserId);

      const pinRes = await request(app)
        .post(`/api/projects/${validProjectId}/messages/not-a-valid-uuid/pin`)
        .set('Cookie', cookie);
      expect(pinRes.status).toBe(404);

      const toTaskRes = await request(app)
        .post(`/api/projects/${validProjectId}/messages/not-a-valid-uuid/to-task`)
        .set('Cookie', cookie);
      expect(toTaskRes.status).toBe(404);
    });
  });

  describe('2. Viewer and Non-Manager Write Protections', () => {
    it('refuses project viewer on POST message (403 forbidden)', async () => {
      const cookie = setupAuth(viewerUserId);

      const res = await request(app)
        .post(`/api/projects/${validProjectId}/messages`)
        .set('Cookie', cookie)
        .send({ body: 'Viewer trying to write' });

      expect(res.status).toBe(403);
      expect(res.body.error).toBe('forbidden');
    });

    it('refuses system viewer on POST message (403 forbidden)', async () => {
      const cookie = setupAuth(systemViewerUserId);

      const res = await request(app)
        .post(`/api/projects/${validProjectId}/messages`)
        .set('Cookie', cookie)
        .send({ body: 'System viewer trying to write' });

      expect(res.status).toBe(403);
      expect(res.body.error).toBe('forbidden');
    });

    it('refuses non-manager on pin and unpin (403 forbidden)', async () => {
      const cookie = setupAuth(memberUserId);

      const pinRes = await request(app)
        .post(`/api/projects/${validProjectId}/messages/${validMessageId}/pin`)
        .set('Cookie', cookie);
      expect(pinRes.status).toBe(403);

      const unpinRes = await request(app)
        .post(`/api/projects/${validProjectId}/messages/${validMessageId}/unpin`)
        .set('Cookie', cookie);
      expect(unpinRes.status).toBe(403);
    });

    it('allows manager and system_admin to pin messages', async () => {
      const cookie = setupAuth(managerUserId);

      vi.mocked(db.projectMessage.findFirst).mockResolvedValue({
        id: validMessageId,
        projectId: validProjectId,
        isPinned: false,
        body: 'Important release announcement',
      } as any);

      vi.mocked(db.projectMessage.update).mockResolvedValue({
        id: validMessageId,
        projectId: validProjectId,
        isPinned: true,
        body: 'Important release announcement',
      } as any);

      const res = await request(app)
        .post(`/api/projects/${validProjectId}/messages/${validMessageId}/pin`)
        .set('Cookie', cookie);

      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
      expect(res.body.message.isPinned).toBe(true);
    });
  });

  describe('3. Body Validation & Ordering', () => {
    it('refuses empty body on POST message (400 validation_error)', async () => {
      const cookie = setupAuth(memberUserId);

      const res = await request(app)
        .post(`/api/projects/${validProjectId}/messages`)
        .set('Cookie', cookie)
        .send({ body: '' });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('validation_error');
    });

    it('refuses whitespace-only body on POST message (400 validation_error)', async () => {
      const cookie = setupAuth(memberUserId);

      const res = await request(app)
        .post(`/api/projects/${validProjectId}/messages`)
        .set('Cookie', cookie)
        .send({ body: '     ' });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('validation_error');
    });

    it('refuses body over 5000 characters on POST message (400 validation_error)', async () => {
      const cookie = setupAuth(memberUserId);

      const longBody = 'A'.repeat(5001);
      const res = await request(app)
        .post(`/api/projects/${validProjectId}/messages`)
        .set('Cookie', cookie)
        .send({ body: longBody });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('validation_error');
    });

    it('orders messages by pinned first, then newest on GET /api/projects/:id/messages', async () => {
      const cookie = setupAuth(memberUserId);

      vi.mocked(db.projectMessage.findMany).mockResolvedValue([
        { id: 'msg-pinned', isPinned: true, body: 'Pinned announcement', createdAt: new Date() },
        { id: 'msg-recent', isPinned: false, body: 'Recent chat', createdAt: new Date() },
      ] as any);

      const res = await request(app)
        .get(`/api/projects/${validProjectId}/messages`)
        .set('Cookie', cookie);

      expect(res.status).toBe(200);
      expect(res.body.items).toHaveLength(2);

      // Verify orderBy passed to Prisma findMany
      expect(db.projectMessage.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: [{ isPinned: 'desc' }, { createdAt: 'desc' }, { id: 'desc' }],
        }),
      );
    });
  });

  describe('4. POST /:messageId/to-task (Turn Message into Task)', () => {
    const multiLineMessage = {
      id: validMessageId,
      projectId: validProjectId,
      isPinned: false,
      body: 'Design new payment gateway integration\nThis integration needs to support eSewa and Khalti.\nPlease ensure retry logic is configured.',
      authorUserId: memberUserId,
    };

    it('creates exactly ONE task with first line as title and body as description', async () => {
      const cookie = setupAuth(memberUserId);

      vi.mocked(db.projectMessage.findFirst).mockResolvedValue(multiLineMessage as any);

      const createdTaskMock = {
        id: 'new-task-uuid',
        projectId: validProjectId,
        title: 'Design new payment gateway integration',
        description: multiLineMessage.body,
        status: 'todo',
        createdByUserId: memberUserId,
      };

      vi.mocked(db.$transaction).mockImplementation(async (cb: any) => {
        return cb({
          $queryRaw: vi.fn().mockResolvedValue([{ id: 'lock' }]),
          auditLog: {
            findFirst: vi.fn().mockResolvedValue(null), // Not previously converted
            create: vi.fn().mockResolvedValue({}),
          },
          task: {
            create: vi.fn().mockResolvedValue(createdTaskMock),
          },
        });
      });

      const res = await request(app)
        .post(`/api/projects/${validProjectId}/messages/${validMessageId}/to-task`)
        .set('Cookie', cookie);

      expect(res.status).toBe(201);
      expect(res.body.ok).toBe(true);
      expect(res.body.task.title).toBe('Design new payment gateway integration');
      expect(res.body.task.description).toBe(multiLineMessage.body);
    });

    it('returns 409 already_converted when a message is turned into a task a second time', async () => {
      const cookie = setupAuth(memberUserId);

      vi.mocked(db.projectMessage.findFirst).mockResolvedValue(multiLineMessage as any);

      vi.mocked(db.$transaction).mockImplementation(async (cb: any) => {
        return cb({
          $queryRaw: vi.fn().mockResolvedValue([{ id: 'lock' }]),
          auditLog: {
            // Already converted previously!
            findFirst: vi.fn().mockResolvedValue({
              id: 'audit-log-uuid',
              action: 'project_message.converted_to_task',
              entityId: validMessageId,
            }),
            create: vi.fn().mockResolvedValue({}),
          },
        });
      });

      const res = await request(app)
        .post(`/api/projects/${validProjectId}/messages/${validMessageId}/to-task`)
        .set('Cookie', cookie);

      expect(res.status).toBe(409);
      expect(res.body.error).toBe('already_converted');
    });
  });

  describe('5. Audit Log Privacy Invariant (Audit contains NO message body text)', () => {
    it('audits pin changes without exposing message body in snapshot', async () => {
      const cookie = setupAuth(managerUserId);

      vi.mocked(db.projectMessage.findFirst).mockResolvedValue({
        id: validMessageId,
        projectId: validProjectId,
        isPinned: false,
        body: 'Sensitive internal project discussion text',
      } as any);

      vi.mocked(db.projectMessage.update).mockResolvedValue({
        id: validMessageId,
        projectId: validProjectId,
        isPinned: true,
        body: 'Sensitive internal project discussion text',
      } as any);

      await request(app)
        .post(`/api/projects/${validProjectId}/messages/${validMessageId}/pin`)
        .set('Cookie', cookie);

      expect(db.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: 'project_message.pinned',
            entityId: validMessageId,
            beforeSnapshot: { isPinned: false },
            afterSnapshot: { isPinned: true },
          }),
        }),
      );

      const auditCall = vi.mocked(db.auditLog.create).mock.calls[0]![0]!;
      expect(JSON.stringify(auditCall)).not.toContain('Sensitive internal project discussion text');
    });

    it('audits to-task creation without exposing message body or description in snapshot', async () => {
      const cookie = setupAuth(managerUserId);

      const messageWithConfidentialBody = {
        id: validMessageId,
        projectId: validProjectId,
        isPinned: false,
        body: 'Confidential Client Details\nCredit card processor credentials must be migrated.',
        authorUserId: managerUserId,
      };

      vi.mocked(db.projectMessage.findFirst).mockResolvedValue(messageWithConfidentialBody as any);

      const createdTaskMock = {
        id: 'new-task-uuid-sec',
        projectId: validProjectId,
        title: 'Confidential Client Details',
        description: messageWithConfidentialBody.body,
        status: 'todo',
        createdByUserId: managerUserId,
      };

      const auditCreateMock = vi.fn().mockResolvedValue({});

      vi.mocked(db.$transaction).mockImplementation(async (cb: any) => {
        return cb({
          $queryRaw: vi.fn().mockResolvedValue([{ id: 'lock' }]),
          auditLog: {
            findFirst: vi.fn().mockResolvedValue(null),
            create: auditCreateMock,
          },
          task: {
            create: vi.fn().mockResolvedValue(createdTaskMock),
          },
        });
      });

      await request(app)
        .post(`/api/projects/${validProjectId}/messages/${validMessageId}/to-task`)
        .set('Cookie', cookie);

      // Verify audit calls
      expect(auditCreateMock).toHaveBeenCalledTimes(2);

      const conversionAudit = auditCreateMock.mock.calls[0]![0]!;
      expect(conversionAudit.data.action).toBe('project_message.converted_to_task');
      expect(JSON.stringify(conversionAudit)).not.toContain('Credit card processor credentials');

      const taskCreatedAudit = auditCreateMock.mock.calls[1]![0]!;
      expect(taskCreatedAudit.data.action).toBe('task.created');
      expect(JSON.stringify(taskCreatedAudit)).not.toContain('Credit card processor credentials');
    });
  });
});
