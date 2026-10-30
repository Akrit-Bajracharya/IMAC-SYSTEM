import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../app.js';
import { db } from '../db.js';
import { projectsRouter } from '../routes/projects.js';
import { tasksRouter } from '../routes/tasks.js';
import { milestonesRouter } from '../routes/milestones.js';
import { timeLogsRouter } from '../routes/timeLogs.js';
import { messagesRouter } from '../routes/messages.js';

/**
 * =============================================================================
 * MOCK LIMITATIONS AND BOUNDARY DOCUMENTATION:
 *
 * 1. Mock-based Tests:
 *    This test suite executes in-memory unit/integration tests with Vitest spies
 *    mocking Prisma database calls (db.project, db.projectMember, db.task,
 *    db.milestone, db.comment, db.timeLog, db.projectMessage, db.session, db.user).
 *
 * 2. What Mocks Cannot Prove:
 *    - Real PostgreSQL Transaction Advisory Locks & Row Locks:
 *      Mocks verify Express routing, CSRF token validation, middleware execution order,
 *      role and ownership authorization logic, and fail-closed security guards.
 *      However, mocks cannot prove actual PostgreSQL row locking (SELECT ... FOR UPDATE)
 *      or concurrency race behavior under multi-threaded network socket loads.
 * =============================================================================
 */

interface MutatingRouteSpec {
  method: 'post' | 'patch' | 'put' | 'delete';
  routePattern: string;
  buildPath: (projectId: string) => string;
  payload: Record<string, any>;
  isProjectScoped: boolean;
  /** Role expectations for project-scoped routes */
  systemAdminAllowed: boolean;
  managerAllowed: boolean;
  memberAllowed: boolean | 'conditional';
  viewerAllowed: boolean;
}

const validProjectId = '11111111-1111-4111-8111-111111111111';
const validTaskId = '22222222-2222-4222-8222-222222222222';
const otherTaskId = '33333333-3333-4333-8333-333333333333';
const validMilestoneId = '44444444-4444-4444-8444-444444444444';
const validCommentId = '55555555-5555-4555-8555-555555555555';
const validTimeLogId = '66666666-6666-4666-8666-666666666666';
const validMessageId = '77777777-7777-4777-8777-777777777777';
const targetUserId = '88888888-8888-4888-8888-888888888888';
const newMemberUserId = '99999999-9999-4999-8999-999999999999';

export const MUTATING_PROJECT_ROUTES: MutatingRouteSpec[] = [
  // ── Project Root Endpoint ──────────────────────────────────────────────────
  {
    method: 'post',
    routePattern: 'POST /api/projects',
    buildPath: () => '/api/projects',
    payload: { name: 'Initiative Alpha', description: 'Project description' },
    isProjectScoped: false,
    systemAdminAllowed: true,
    managerAllowed: true,
    memberAllowed: false,
    viewerAllowed: false,
  },

  // ── Project Resource Endpoints ─────────────────────────────────────────────
  {
    method: 'patch',
    routePattern: 'PATCH /api/projects/:id',
    buildPath: (pId) => `/api/projects/${pId}`,
    payload: { name: 'Renamed Initiative Alpha' },
    isProjectScoped: true,
    systemAdminAllowed: true,
    managerAllowed: true,
    memberAllowed: false,
    viewerAllowed: false,
  },
  {
    method: 'post',
    routePattern: 'POST /api/projects/:id/members',
    buildPath: (pId) => `/api/projects/${pId}/members`,
    payload: { userId: newMemberUserId, projectRole: 'member' },
    isProjectScoped: true,
    systemAdminAllowed: true,
    managerAllowed: true,
    memberAllowed: false,
    viewerAllowed: false,
  },
  {
    method: 'delete',
    routePattern: 'DELETE /api/projects/:id/members/:userId',
    buildPath: (pId) => `/api/projects/${pId}/members/${targetUserId}`,
    payload: {},
    isProjectScoped: true,
    systemAdminAllowed: true,
    managerAllowed: true,
    memberAllowed: false,
    viewerAllowed: false,
  },
  {
    method: 'post',
    routePattern: 'POST /api/projects/:id/status',
    buildPath: (pId) => `/api/projects/${pId}/status`,
    payload: { status: 'at_risk', reason: 'Critical blocker on dependencies' },
    isProjectScoped: true,
    systemAdminAllowed: true,
    managerAllowed: true,
    memberAllowed: false,
    viewerAllowed: false,
  },

  // ── Tasks Subsystem Endpoints ──────────────────────────────────────────────
  {
    method: 'post',
    routePattern: 'POST /api/projects/:id/tasks',
    buildPath: (pId) => `/api/projects/${pId}/tasks`,
    payload: { title: 'Implement Module A' },
    isProjectScoped: true,
    systemAdminAllowed: true,
    managerAllowed: true,
    memberAllowed: true,
    viewerAllowed: false,
  },
  {
    method: 'patch',
    routePattern: 'PATCH /api/projects/:id/tasks/:taskId',
    buildPath: (pId) => `/api/projects/${pId}/tasks/${validTaskId}`,
    payload: { title: 'Updated Task Title' },
    isProjectScoped: true,
    systemAdminAllowed: true,
    managerAllowed: true,
    memberAllowed: 'conditional',
    viewerAllowed: false,
  },
  {
    method: 'delete',
    routePattern: 'DELETE /api/projects/:id/tasks/:taskId',
    buildPath: (pId) => `/api/projects/${pId}/tasks/${validTaskId}`,
    payload: {},
    isProjectScoped: true,
    systemAdminAllowed: true,
    managerAllowed: true,
    memberAllowed: false,
    viewerAllowed: false,
  },
  {
    method: 'post',
    routePattern: 'POST /api/projects/:id/tasks/:taskId/status',
    buildPath: (pId) => `/api/projects/${pId}/tasks/${validTaskId}/status`,
    payload: { status: 'in_progress' },
    isProjectScoped: true,
    systemAdminAllowed: true,
    managerAllowed: true,
    memberAllowed: 'conditional',
    viewerAllowed: false,
  },
  {
    method: 'post',
    routePattern: 'POST /api/projects/:id/tasks/:taskId/dependencies',
    buildPath: (pId) => `/api/projects/${pId}/tasks/${validTaskId}/dependencies`,
    payload: { dependsOnTaskId: otherTaskId },
    isProjectScoped: true,
    systemAdminAllowed: true,
    managerAllowed: true,
    memberAllowed: 'conditional',
    viewerAllowed: false,
  },
  {
    method: 'delete',
    routePattern: 'DELETE /api/projects/:id/tasks/:taskId/dependencies/:dependsOnTaskId',
    buildPath: (pId) => `/api/projects/${pId}/tasks/${validTaskId}/dependencies/${otherTaskId}`,
    payload: {},
    isProjectScoped: true,
    systemAdminAllowed: true,
    managerAllowed: true,
    memberAllowed: 'conditional',
    viewerAllowed: false,
  },
  {
    method: 'post',
    routePattern: 'POST /api/projects/:id/tasks/:taskId/comments',
    buildPath: (pId) => `/api/projects/${pId}/tasks/${validTaskId}/comments`,
    payload: { body: 'This is a test comment.' },
    isProjectScoped: true,
    systemAdminAllowed: true,
    managerAllowed: true,
    memberAllowed: true,
    viewerAllowed: false,
  },
  {
    method: 'patch',
    routePattern: 'PATCH /api/projects/:id/tasks/:taskId/comments/:commentId',
    buildPath: (pId) => `/api/projects/${pId}/tasks/${validTaskId}/comments/${validCommentId}`,
    payload: { body: 'Updated comment text.' },
    isProjectScoped: true,
    systemAdminAllowed: false, // Author only
    managerAllowed: false,     // Author only
    memberAllowed: 'conditional', // Author only
    viewerAllowed: false,
  },
  {
    method: 'delete',
    routePattern: 'DELETE /api/projects/:id/tasks/:taskId/comments/:commentId',
    buildPath: (pId) => `/api/projects/${pId}/tasks/${validTaskId}/comments/${validCommentId}`,
    payload: {},
    isProjectScoped: true,
    systemAdminAllowed: true,
    managerAllowed: true,
    memberAllowed: 'conditional', // Author only
    viewerAllowed: false,
  },

  // ── Milestones Subsystem Endpoints ─────────────────────────────────────────
  {
    method: 'post',
    routePattern: 'POST /api/projects/:id/milestones',
    buildPath: (pId) => `/api/projects/${pId}/milestones`,
    payload: { name: 'Alpha Release' },
    isProjectScoped: true,
    systemAdminAllowed: true,
    managerAllowed: true,
    memberAllowed: false,
    viewerAllowed: false,
  },
  {
    method: 'patch',
    routePattern: 'PATCH /api/projects/:id/milestones/:milestoneId',
    buildPath: (pId) => `/api/projects/${pId}/milestones/${validMilestoneId}`,
    payload: { name: 'Beta Release' },
    isProjectScoped: true,
    systemAdminAllowed: true,
    managerAllowed: true,
    memberAllowed: false,
    viewerAllowed: false,
  },
  {
    method: 'post',
    routePattern: 'POST /api/projects/:id/milestones/:milestoneId/complete',
    buildPath: (pId) => `/api/projects/${pId}/milestones/${validMilestoneId}/complete`,
    payload: {},
    isProjectScoped: true,
    systemAdminAllowed: true,
    managerAllowed: true,
    memberAllowed: false,
    viewerAllowed: false,
  },
  {
    method: 'post',
    routePattern: 'POST /api/projects/:id/milestones/:milestoneId/reopen',
    buildPath: (pId) => `/api/projects/${pId}/milestones/${validMilestoneId}/reopen`,
    payload: {},
    isProjectScoped: true,
    systemAdminAllowed: true,
    managerAllowed: true,
    memberAllowed: false,
    viewerAllowed: false,
  },

  // ── TimeLogs Subsystem Endpoints ───────────────────────────────────────────
  {
    method: 'post',
    routePattern: 'POST /api/projects/:id/time-logs',
    buildPath: (pId) => `/api/projects/${pId}/time-logs`,
    payload: { workDate: '2026-10-28', hours: 2.5, note: 'Development work' },
    isProjectScoped: true,
    systemAdminAllowed: true,
    managerAllowed: true,
    memberAllowed: true,
    viewerAllowed: false,
  },
  {
    method: 'patch',
    routePattern: 'PATCH /api/projects/:id/time-logs/:timeLogId',
    buildPath: (pId) => `/api/projects/${pId}/time-logs/${validTimeLogId}`,
    payload: { hours: 3.5 },
    isProjectScoped: true,
    systemAdminAllowed: false, // Author only
    managerAllowed: false,     // Author only
    memberAllowed: 'conditional', // Author only
    viewerAllowed: false,
  },
  {
    method: 'delete',
    routePattern: 'DELETE /api/projects/:id/time-logs/:timeLogId',
    buildPath: (pId) => `/api/projects/${pId}/time-logs/${validTimeLogId}`,
    payload: {},
    isProjectScoped: true,
    systemAdminAllowed: false, // Author only
    managerAllowed: false,     // Author only
    memberAllowed: 'conditional', // Author only
    viewerAllowed: false,
  },

  // ── Project Messages Subsystem Endpoints ───────────────────────────────────
  {
    method: 'post',
    routePattern: 'POST /api/projects/:id/messages',
    buildPath: (pId) => `/api/projects/${pId}/messages`,
    payload: { body: 'Team status update' },
    isProjectScoped: true,
    systemAdminAllowed: true,
    managerAllowed: true,
    memberAllowed: true,
    viewerAllowed: false,
  },
  {
    method: 'post',
    routePattern: 'POST /api/projects/:id/messages/:messageId/pin',
    buildPath: (pId) => `/api/projects/${pId}/messages/${validMessageId}/pin`,
    payload: {},
    isProjectScoped: true,
    systemAdminAllowed: true,
    managerAllowed: true,
    memberAllowed: false,
    viewerAllowed: false,
  },
  {
    method: 'post',
    routePattern: 'POST /api/projects/:id/messages/:messageId/unpin',
    buildPath: (pId) => `/api/projects/${pId}/messages/${validMessageId}/unpin`,
    payload: {},
    isProjectScoped: true,
    systemAdminAllowed: true,
    managerAllowed: true,
    memberAllowed: false,
    viewerAllowed: false,
  },
  {
    method: 'post',
    routePattern: 'POST /api/projects/:id/messages/:messageId/to-task',
    buildPath: (pId) => `/api/projects/${pId}/messages/${validMessageId}/to-task`,
    payload: {},
    isProjectScoped: true,
    systemAdminAllowed: true,
    managerAllowed: true,
    memberAllowed: true,
    viewerAllowed: false,
  },
];

describe('Step 12b-1: Project Mutating Routes Permission Matrix Test Suite', () => {
  // Use csrfEnabled: true to prove every request validates CSRF tokens alongside permissions
  const app = createApp({ csrfEnabled: true });

  const adminUser = {
    id: 'a0000000-0000-4000-8000-000000000001',
    username: 'admin_user',
    displayName: 'Admin User',
    systemRole: 'system_admin',
    isActive: true,
    mustChangePassword: false,
  };

  const managerUser = {
    id: 'a0000000-0000-4000-8000-000000000002',
    username: 'manager_user',
    displayName: 'Manager User',
    systemRole: 'project_manager',
    isActive: true,
    mustChangePassword: false,
  };

  const memberUser = {
    id: 'a0000000-0000-4000-8000-000000000003',
    username: 'member_user',
    displayName: 'Member User',
    systemRole: 'employee',
    isActive: true,
    mustChangePassword: false,
  };

  const viewerUser = {
    id: 'a0000000-0000-4000-8000-000000000004',
    username: 'viewer_user',
    displayName: 'Viewer User',
    systemRole: 'viewer',
    isActive: true,
    mustChangePassword: false,
  };

  const nonMemberHrAdmin = {
    id: 'a0000000-0000-4000-8000-000000000005',
    username: 'hr_admin_non_member',
    displayName: 'HR Admin Non-Member',
    systemRole: 'hr_admin',
    isActive: true,
    mustChangePassword: false,
  };

  const nonMemberPm = {
    id: 'a0000000-0000-4000-8000-000000000006',
    username: 'pm_non_member',
    displayName: 'PM Non-Member',
    systemRole: 'project_manager',
    isActive: true,
    mustChangePassword: false,
  };

  function setupAuth(user: any) {
    const session = {
      id: `sess-${user.id}`,
      userId: user.id,
      expiresAt: new Date(Date.now() + 3600 * 1000),
      lastActiveAt: new Date(),
      user,
    };
    (db.session.findUnique as any).mockResolvedValue(session);
    (db.session.update as any).mockResolvedValue(session);
    return `IMAC_SESSION=sess-${user.id}`;
  }

  async function getCsrfHeaderAndCookie() {
    const res = await request(app).get('/api/auth/csrf');
    const csrfToken = res.body.csrfToken;
    const setCookie = res.headers['set-cookie'];
    const csrfCookieStr = Array.isArray(setCookie) ? setCookie[0]! : (setCookie as string);
    return { csrfToken, csrfCookie: csrfCookieStr.split(';')[0]! };
  }

  function mockProjectEntities(options: {
    callerUserId: string;
    projectRole?: 'manager' | 'member' | 'viewer';
    taskAssigneeId?: string;
    taskCreatorId?: string;
    commentAuthorId?: string;
    timeLogAuthorId?: string;
  }) {
    vi.mocked(db.project.findUnique).mockResolvedValue({
      id: validProjectId,
      name: 'Test Project',
      status: 'on_track',
      createdByUserId: managerUser.id,
      members: options.projectRole
        ? [
            {
              userId: options.callerUserId,
              projectRole: options.projectRole,
              user: { isActive: true },
            },
          ]
        : [],
    } as any);

    (db.projectMember.findUnique as any).mockImplementation(async (args: any) => {
      const qUserId = args?.where?.projectId_userId?.userId;
      if (options.projectRole && qUserId === options.callerUserId) {
        return {
          projectId: validProjectId,
          userId: options.callerUserId,
          projectRole: options.projectRole,
          user: { isActive: true },
        } as any;
      }
      if (qUserId === targetUserId) {
        return {
          projectId: validProjectId,
          userId: targetUserId,
          projectRole: 'member',
          user: { isActive: true },
        } as any;
      }
      return null;
    });

    vi.mocked(db.task.findUnique).mockResolvedValue({
      id: validTaskId,
      projectId: validProjectId,
      title: 'Existing Task',
      status: 'todo',
      assigneeUserId: options.taskAssigneeId ?? managerUser.id,
      createdByUserId: options.taskCreatorId ?? managerUser.id,
      _count: { comments: 0 },
    } as any);

    vi.mocked(db.comment.findUnique).mockResolvedValue({
      id: validCommentId,
      taskId: validTaskId,
      authorUserId: options.commentAuthorId ?? managerUser.id,
      body: 'Existing comment',
    } as any);

    vi.mocked(db.timeLog.findUnique).mockResolvedValue({
      id: validTimeLogId,
      projectId: validProjectId,
      userId: options.timeLogAuthorId ?? managerUser.id,
      workDate: new Date('2026-10-28'),
      hours: 2.0,
    } as any);

    vi.mocked(db.milestone.findUnique).mockResolvedValue({
      id: validMilestoneId,
      projectId: validProjectId,
      name: 'Existing Milestone',
      dueDate: new Date('2026-11-01'),
      completedAt: null,
    } as any);

    vi.mocked(db.projectMessage.findUnique).mockResolvedValue({
      id: validMessageId,
      projectId: validProjectId,
      authorUserId: managerUser.id,
      body: 'Existing Message Line 1\nDetails',
      isPinned: false,
    } as any);

    vi.mocked(db.taskDependency.findUnique).mockResolvedValue({
      taskId: validTaskId,
      dependsOnTaskId: otherTaskId,
    } as any);

    (db.user.findUnique as any).mockImplementation(async (args: any) => {
      const uId = args?.where?.id;
      return {
        id: uId || targetUserId,
        isActive: true,
        systemRole: 'employee',
      } as any;
    });
    (db.auditLog as any).findFirst = vi.fn().mockResolvedValue(null);

    // Mocks for writes
    vi.mocked(db.task.create).mockResolvedValue({ id: 'new-task-id' } as any);
    vi.mocked(db.comment.create).mockResolvedValue({ id: 'new-comment-id' } as any);
    vi.mocked(db.projectMessage.create).mockResolvedValue({ id: 'new-message-id' } as any);
    vi.mocked(db.timeLog.create).mockResolvedValue({ id: 'new-timelog-id' } as any);
    vi.mocked(db.task.update).mockResolvedValue({ id: validTaskId } as any);
    vi.mocked(db.task.updateMany).mockResolvedValue({ count: 1 } as any);
    vi.mocked(db.comment.update).mockResolvedValue({ id: validCommentId } as any);
    vi.mocked(db.timeLog.update).mockResolvedValue({ id: validTimeLogId } as any);
    vi.mocked(db.project.update).mockResolvedValue({ id: validProjectId } as any);
    vi.mocked(db.project.create).mockResolvedValue({ id: validProjectId, name: 'New Project', status: 'on_track' } as any);
    vi.mocked(db.project.updateMany).mockResolvedValue({ count: 1 } as any);
    vi.mocked(db.milestone.create).mockResolvedValue({ id: 'new-milestone-id' } as any);
    vi.mocked(db.milestone.update).mockResolvedValue({ id: validMilestoneId } as any);
    vi.mocked(db.milestone.updateMany).mockResolvedValue({ count: 1 } as any);
    vi.mocked(db.projectMember.count).mockResolvedValue(2);
    vi.mocked(db.projectMessage.findFirst).mockResolvedValue({
      id: validMessageId,
      projectId: validProjectId,
      authorUserId: managerUser.id,
      body: 'Existing Message Line 1\nDetails',
      isPinned: false,
    } as any);
    vi.mocked(db.task.delete).mockResolvedValue({ id: validTaskId } as any);
    vi.mocked(db.comment.delete).mockResolvedValue({ id: validCommentId } as any);
    vi.mocked(db.timeLog.delete).mockResolvedValue({ id: validTimeLogId } as any);
    vi.mocked(db.taskDependency.create).mockResolvedValue({} as any);
    vi.mocked(db.taskDependency.delete).mockResolvedValue({} as any);
    vi.mocked(db.projectMember.create).mockResolvedValue({} as any);
    vi.mocked(db.projectMember.delete).mockResolvedValue({} as any);
    vi.mocked(db.projectStatusEvent.create).mockResolvedValue({} as any);
    vi.mocked(db.auditLog.create).mockResolvedValue({ id: 'audit-id' } as any);
    if ((db.auditLog as any).findFirst) {
      (db.auditLog as any).findFirst.mockResolvedValue(null);
    }
    vi.mocked(db.task.findMany).mockResolvedValue([]);
    vi.mocked(db.taskDependency.findMany).mockResolvedValue([]);
    vi.mocked(db.comment.count).mockResolvedValue(0);
    vi.mocked(db.timeLog.aggregate).mockResolvedValue({ _sum: { hours: 2.0 } } as any);
    vi.mocked(db.$queryRaw).mockResolvedValue([]);
  }

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── 1. Introspection Test: Exact bidirectional match ─────────────────────────
  it('introspects all mutating routes under /api/projects and verifies bidirectional match (2c & 2d)', () => {
    function extractMutatingRoutes(router: any, prefix: string): string[] {
      const routes: string[] = [];
      for (const layer of router.stack) {
        if (layer.route) {
          const subPath = layer.route.path === '/' ? '' : layer.route.path;
          const fullPath = `${prefix}${subPath}`;
          for (const method of Object.keys(layer.route.methods)) {
            if (['post', 'patch', 'put', 'delete'].includes(method.toLowerCase())) {
              routes.push(`${method.toUpperCase()} ${fullPath}`);
            }
          }
        }
      }
      return routes;
    }

    const expressRoutes: string[] = [];
    expressRoutes.push(...extractMutatingRoutes(projectsRouter, '/api/projects'));
    expressRoutes.push(...extractMutatingRoutes(tasksRouter, '/api/projects/:id/tasks'));
    expressRoutes.push(...extractMutatingRoutes(milestonesRouter, '/api/projects/:id/milestones'));
    expressRoutes.push(...extractMutatingRoutes(timeLogsRouter, '/api/projects/:id/time-logs'));
    expressRoutes.push(...extractMutatingRoutes(messagesRouter, '/api/projects/:id/messages'));

    const tableRoutes = MUTATING_PROJECT_ROUTES.map((r) => r.routePattern);

    // Fail if a registered mutating route is missing from the table
    for (const expRoute of expressRoutes) {
      expect(tableRoutes, `Registered mutating route ${expRoute} is missing from table`).toContain(expRoute);
    }

    // Fail if a table row matches no registered route
    for (const tblRoute of tableRoutes) {
      expect(expressRoutes, `Table route ${tblRoute} matches no registered mutating route in Express`).toContain(tblRoute);
    }

    expect(tableRoutes.length).toBe(25);
    expect(expressRoutes.length).toBe(25);
  });

  // ── 2. Unauthenticated Callers: Must Return 401 unauthenticated ───────────────
  describe('Unauthenticated Request Verification (Expect 401 unauthenticated)', () => {
    for (const r of MUTATING_PROJECT_ROUTES) {
      it(`returns 401 unauthenticated on ${r.routePattern}`, async () => {
        const { csrfToken, csrfCookie } = await getCsrfHeaderAndCookie();
        const path = r.buildPath(validProjectId);

        const res = await (request(app) as any)[r.method](path)
          .set('Cookie', csrfCookie)
          .set('x-csrf-token', csrfToken)
          .send(r.payload);

        expect(res.status).toBe(401);
        expect(res.body.error).toBe('unauthenticated');
      });
    }
  });

  // ── 3. Malformed UUID: Must Return 404 not_found ─────────────────────────────
  describe('Malformed Project UUID Verification (Expect 404 not_found)', () => {
    const projectScopedRoutes = MUTATING_PROJECT_ROUTES.filter((r) => r.isProjectScoped);

    for (const r of projectScopedRoutes) {
      it(`returns 404 not_found on malformed project UUID for ${r.routePattern}`, async () => {
        const sessionCookie = setupAuth(memberUser);
        const { csrfToken, csrfCookie } = await getCsrfHeaderAndCookie();

        const path = r.buildPath('not-a-valid-uuid');
        const res = await (request(app) as any)[r.method](path)
          .set('Cookie', [sessionCookie, csrfCookie].join('; '))
          .set('x-csrf-token', csrfToken)
          .send(r.payload);

        expect(res.status).toBe(404);
        expect(res.body.error).toBe('not_found');
      });
    }
  });

  // ── 4. Non-Member Callers (HR Admin & PM Non-Member): Must Return 404 not_found
  describe('Non-Member Access (Expect 404 not_found for hr_admin & pm non-member)', () => {
    const projectScopedRoutes = MUTATING_PROJECT_ROUTES.filter((r) => r.isProjectScoped);

    for (const r of projectScopedRoutes) {
      it(`returns 404 not_found for non-member hr_admin on ${r.routePattern}`, async () => {
        const sessionCookie = setupAuth(nonMemberHrAdmin);
        const { csrfToken, csrfCookie } = await getCsrfHeaderAndCookie();
        mockProjectEntities({ callerUserId: nonMemberHrAdmin.id }); // No projectRole -> non-member

        const path = r.buildPath(validProjectId);
        const res = await (request(app) as any)[r.method](path)
          .set('Cookie', [sessionCookie, csrfCookie].join('; '))
          .set('x-csrf-token', csrfToken)
          .send(r.payload);

        expect(res.status).toBe(404);
        expect(res.body.error).toBe('not_found');
      });

      it(`returns 404 not_found for non-member project_manager on ${r.routePattern}`, async () => {
        const sessionCookie = setupAuth(nonMemberPm);
        const { csrfToken, csrfCookie } = await getCsrfHeaderAndCookie();
        mockProjectEntities({ callerUserId: nonMemberPm.id }); // No projectRole -> non-member

        const path = r.buildPath(validProjectId);
        const res = await (request(app) as any)[r.method](path)
          .set('Cookie', [sessionCookie, csrfCookie].join('; '))
          .set('x-csrf-token', csrfToken)
          .send(r.payload);

        expect(res.status).toBe(404);
        expect(res.body.error).toBe('not_found');
      });
    }
  });

  // ── 5. Project Viewer: Must be Refused on EVERY Write with 403 forbidden ───────
  describe('Project Viewer Access (Expect 403 forbidden on every mutating route)', () => {
    for (const r of MUTATING_PROJECT_ROUTES) {
      it(`refuses project viewer with 403 forbidden on ${r.routePattern}`, async () => {
        const sessionCookie = setupAuth(viewerUser);
        const { csrfToken, csrfCookie } = await getCsrfHeaderAndCookie();
        mockProjectEntities({
          callerUserId: viewerUser.id,
          projectRole: 'viewer',
          taskAssigneeId: viewerUser.id,
          commentAuthorId: viewerUser.id,
          timeLogAuthorId: viewerUser.id,
        });

        const path = r.buildPath(validProjectId);
        const res = await (request(app) as any)[r.method](path)
          .set('Cookie', [sessionCookie, csrfCookie].join('; '))
          .set('x-csrf-token', csrfToken)
          .send(r.payload);

        expect(res.status).toBe(403);
        expect(res.body.error).toBe('forbidden');
      });
    }
  });

  // ── 6. Project Member: Role Matrix Expectations ─────────────────────────────
  describe('Project Member Access (Matrix Enforcement)', () => {
    for (const r of MUTATING_PROJECT_ROUTES) {
      if (r.memberAllowed === false) {
        it(`refuses plain project member on manager-only route ${r.routePattern} with 403 forbidden`, async () => {
          const sessionCookie = setupAuth(memberUser);
          const { csrfToken, csrfCookie } = await getCsrfHeaderAndCookie();
          mockProjectEntities({ callerUserId: memberUser.id, projectRole: 'member' });

          const path = r.buildPath(validProjectId);
          const res = await (request(app) as any)[r.method](path)
            .set('Cookie', [sessionCookie, csrfCookie].join('; '))
            .set('x-csrf-token', csrfToken)
            .send(r.payload);

          expect(res.status).toBe(403);
          expect(res.body.error).toBe('forbidden');
        });
      } else if (r.memberAllowed === true) {
        it(`allows plain project member on ${r.routePattern}`, async () => {
          const sessionCookie = setupAuth(memberUser);
          const { csrfToken, csrfCookie } = await getCsrfHeaderAndCookie();
          mockProjectEntities({ callerUserId: memberUser.id, projectRole: 'member' });

          const path = r.buildPath(validProjectId);
          const res = await (request(app) as any)[r.method](path)
            .set('Cookie', [sessionCookie, csrfCookie].join('; '))
            .set('x-csrf-token', csrfToken)
            .send(r.payload);

          expect([200, 201]).toContain(res.status);
        });
      } else if (r.memberAllowed === 'conditional') {
        it(`tests member conditional ownership on ${r.routePattern}`, async () => {
          const sessionCookie = setupAuth(memberUser);
          const { csrfToken, csrfCookie } = await getCsrfHeaderAndCookie();

          // 1. When member is NOT the owner/assignee -> 403 forbidden
          mockProjectEntities({
            callerUserId: memberUser.id,
            projectRole: 'member',
            taskAssigneeId: managerUser.id,
            taskCreatorId: managerUser.id,
            commentAuthorId: managerUser.id,
            timeLogAuthorId: managerUser.id,
          });

          const path = r.buildPath(validProjectId);
          const resDenied = await (request(app) as any)[r.method](path)
            .set('Cookie', [sessionCookie, csrfCookie].join('; '))
            .set('x-csrf-token', csrfToken)
            .send(r.payload);

          expect(resDenied.status).toBe(403);
          expect(resDenied.body.error).toBe('forbidden');

          // 2. When member IS the owner/assignee -> allowed (200 or 201)
          mockProjectEntities({
            callerUserId: memberUser.id,
            projectRole: 'member',
            taskAssigneeId: memberUser.id,
            taskCreatorId: memberUser.id,
            commentAuthorId: memberUser.id,
            timeLogAuthorId: memberUser.id,
          });

          const resAllowed = await (request(app) as any)[r.method](path)
            .set('Cookie', [sessionCookie, csrfCookie].join('; '))
            .set('x-csrf-token', csrfToken)
            .send(r.payload);

          expect([200, 201]).toContain(resAllowed.status);
        });
      }
    }
  });

  // ── 7. Project Manager: Allowed on Manager Routes & Checked on Author-Only ───
  describe('Project Manager Access', () => {
    for (const r of MUTATING_PROJECT_ROUTES) {
      it(`tests project manager on ${r.routePattern}`, async () => {
        const sessionCookie = setupAuth(managerUser);
        const { csrfToken, csrfCookie } = await getCsrfHeaderAndCookie();

        if (r.managerAllowed) {
          mockProjectEntities({ callerUserId: managerUser.id, projectRole: 'manager' });
          const path = r.buildPath(validProjectId);
          const res = await (request(app) as any)[r.method](path)
            .set('Cookie', [sessionCookie, csrfCookie].join('; '))
            .set('x-csrf-token', csrfToken)
            .send(r.payload);

          expect([200, 201]).toContain(res.status);
        } else {
          // Author only routes: Comment PATCH, TimeLog PATCH, TimeLog DELETE
          // When manager is NOT author -> 403 forbidden
          mockProjectEntities({
            callerUserId: managerUser.id,
            projectRole: 'manager',
            commentAuthorId: memberUser.id,
            timeLogAuthorId: memberUser.id,
          });
          const path = r.buildPath(validProjectId);
          const res = await (request(app) as any)[r.method](path)
            .set('Cookie', [sessionCookie, csrfCookie].join('; '))
            .set('x-csrf-token', csrfToken)
            .send(r.payload);

          expect(res.status).toBe(403);
          expect(res.body.error).toBe('forbidden');
        }
      });
    }
  });

  // ── 8. System Admin: Universal Access Except Author-Only Routes ─────────────
  describe('System Admin Access', () => {
    for (const r of MUTATING_PROJECT_ROUTES) {
      it(`tests system_admin on ${r.routePattern}`, async () => {
        const sessionCookie = setupAuth(adminUser);
        const { csrfToken, csrfCookie } = await getCsrfHeaderAndCookie();

        if (r.systemAdminAllowed) {
          mockProjectEntities({ callerUserId: adminUser.id, projectRole: 'manager' }); // system_admin with project member row for time-logs
          const path = r.buildPath(validProjectId);
          const res = await (request(app) as any)[r.method](path)
            .set('Cookie', [sessionCookie, csrfCookie].join('; '))
            .set('x-csrf-token', csrfToken)
            .send(r.payload);

          expect([200, 201]).toContain(res.status);
        } else {
          // Author only routes: Comment PATCH, TimeLog PATCH, TimeLog DELETE
          // When system_admin is NOT author -> 403 forbidden
          mockProjectEntities({
            callerUserId: adminUser.id,
            commentAuthorId: memberUser.id,
            timeLogAuthorId: memberUser.id,
          });
          const path = r.buildPath(validProjectId);
          const res = await (request(app) as any)[r.method](path)
            .set('Cookie', [sessionCookie, csrfCookie].join('; '))
            .set('x-csrf-token', csrfToken)
            .send(r.payload);

          expect(res.status).toBe(403);
          expect(res.body.error).toBe('forbidden');
        }
      });
    }
  });
});
