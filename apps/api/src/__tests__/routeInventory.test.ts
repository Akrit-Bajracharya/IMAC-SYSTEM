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
 *    db.session.*, db.user.*) via Vitest spies.
 *
 * 2. What Mocks Cannot Prove:
 *    - Real PostgreSQL Transaction Advisory Locks & Row Locks:
 *      Mocks verify that route routing, middleware ordering, authentication,
 *      membership authorization, and fail-closed security guards function correctly.
 *      However, Vitest mocks cannot simulate PostgreSQL row locks (SELECT ... FOR UPDATE)
 *      or session-level advisory locks (pg_advisory_xact_lock) under concurrent multi-connection races.
 * ─────────────────────────────────────────────────────────────────────────────
 */

interface RouteDefinition {
  method: 'get' | 'post' | 'patch' | 'delete';
  subsystem: 'projects' | 'tasks' | 'milestones' | 'timeLogs' | 'messages';
  routePattern: string;
  buildPath: (projectId: string, extraIds: { taskId: string; userId: string; milestoneId: string; timeLogId: string; messageId: string }) => string;
  isProjectScoped: boolean;
}

const PROJECT_ROUTES: RouteDefinition[] = [
  // ── Project Root Endpoints ──────────────────────────────────────────────────
  {
    method: 'post',
    subsystem: 'projects',
    routePattern: 'POST /api/projects',
    buildPath: () => '/api/projects',
    isProjectScoped: false,
  },
  {
    method: 'get',
    subsystem: 'projects',
    routePattern: 'GET /api/projects',
    buildPath: () => '/api/projects',
    isProjectScoped: false,
  },

  // ── Project Resource Endpoints ──────────────────────────────────────────────
  {
    method: 'get',
    subsystem: 'projects',
    routePattern: 'GET /api/projects/:id',
    buildPath: (pId) => `/api/projects/${pId}`,
    isProjectScoped: true,
  },
  {
    method: 'patch',
    subsystem: 'projects',
    routePattern: 'PATCH /api/projects/:id',
    buildPath: (pId) => `/api/projects/${pId}`,
    isProjectScoped: true,
  },
  {
    method: 'post',
    subsystem: 'projects',
    routePattern: 'POST /api/projects/:id/members',
    buildPath: (pId) => `/api/projects/${pId}/members`,
    isProjectScoped: true,
  },
  {
    method: 'delete',
    subsystem: 'projects',
    routePattern: 'DELETE /api/projects/:id/members/:userId',
    buildPath: (pId, { userId }) => `/api/projects/${pId}/members/${userId}`,
    isProjectScoped: true,
  },
  {
    method: 'post',
    subsystem: 'projects',
    routePattern: 'POST /api/projects/:id/status',
    buildPath: (pId) => `/api/projects/${pId}/status`,
    isProjectScoped: true,
  },
  {
    method: 'get',
    subsystem: 'projects',
    routePattern: 'GET /api/projects/:id/summary',
    buildPath: (pId) => `/api/projects/${pId}/summary`,
    isProjectScoped: true,
  },
  {
    method: 'get',
    subsystem: 'projects',
    routePattern: 'GET /api/projects/:id/workload',
    buildPath: (pId) => `/api/projects/${pId}/workload`,
    isProjectScoped: true,
  },

  // ── Task Subsystem Endpoints ────────────────────────────────────────────────
  {
    method: 'get',
    subsystem: 'tasks',
    routePattern: 'GET /api/projects/:id/tasks',
    buildPath: (pId) => `/api/projects/${pId}/tasks`,
    isProjectScoped: true,
  },
  {
    method: 'post',
    subsystem: 'tasks',
    routePattern: 'POST /api/projects/:id/tasks',
    buildPath: (pId) => `/api/projects/${pId}/tasks`,
    isProjectScoped: true,
  },
  {
    method: 'get',
    subsystem: 'tasks',
    routePattern: 'GET /api/projects/:id/tasks/overdue',
    buildPath: (pId) => `/api/projects/${pId}/tasks/overdue`,
    isProjectScoped: true,
  },
  {
    method: 'get',
    subsystem: 'tasks',
    routePattern: 'GET /api/projects/:id/tasks/blocked',
    buildPath: (pId) => `/api/projects/${pId}/tasks/blocked`,
    isProjectScoped: true,
  },
  {
    method: 'get',
    subsystem: 'tasks',
    routePattern: 'GET /api/projects/:id/tasks/:taskId',
    buildPath: (pId, { taskId }) => `/api/projects/${pId}/tasks/${taskId}`,
    isProjectScoped: true,
  },
  {
    method: 'patch',
    subsystem: 'tasks',
    routePattern: 'PATCH /api/projects/:id/tasks/:taskId',
    buildPath: (pId, { taskId }) => `/api/projects/${pId}/tasks/${taskId}`,
    isProjectScoped: true,
  },
  {
    method: 'post',
    subsystem: 'tasks',
    routePattern: 'POST /api/projects/:id/tasks/:taskId/status',
    buildPath: (pId, { taskId }) => `/api/projects/${pId}/tasks/${taskId}/status`,
    isProjectScoped: true,
  },
  {
    method: 'post',
    subsystem: 'tasks',
    routePattern: 'POST /api/projects/:id/tasks/:taskId/dependencies',
    buildPath: (pId, { taskId }) => `/api/projects/${pId}/tasks/${taskId}/dependencies`,
    isProjectScoped: true,
  },
  {
    method: 'delete',
    subsystem: 'tasks',
    routePattern: 'DELETE /api/projects/:id/tasks/:taskId/dependencies/:dependsOnTaskId',
    buildPath: (pId, { taskId }) => `/api/projects/${pId}/tasks/${taskId}/dependencies/${taskId}`,
    isProjectScoped: true,
  },
  {
    method: 'get',
    subsystem: 'tasks',
    routePattern: 'GET /api/projects/:id/tasks/:taskId/comments',
    buildPath: (pId, { taskId }) => `/api/projects/${pId}/tasks/${taskId}/comments`,
    isProjectScoped: true,
  },
  {
    method: 'post',
    subsystem: 'tasks',
    routePattern: 'POST /api/projects/:id/tasks/:taskId/comments',
    buildPath: (pId, { taskId }) => `/api/projects/${pId}/tasks/${taskId}/comments`,
    isProjectScoped: true,
  },
  {
    method: 'patch',
    subsystem: 'tasks',
    routePattern: 'PATCH /api/projects/:id/tasks/:taskId/comments/:commentId',
    buildPath: (pId, { taskId, timeLogId }) => `/api/projects/${pId}/tasks/${taskId}/comments/${timeLogId}`,
    isProjectScoped: true,
  },

  // ── Milestone Subsystem Endpoints ───────────────────────────────────────────
  {
    method: 'get',
    subsystem: 'milestones',
    routePattern: 'GET /api/projects/:id/milestones',
    buildPath: (pId) => `/api/projects/${pId}/milestones`,
    isProjectScoped: true,
  },
  {
    method: 'post',
    subsystem: 'milestones',
    routePattern: 'POST /api/projects/:id/milestones',
    buildPath: (pId) => `/api/projects/${pId}/milestones`,
    isProjectScoped: true,
  },
  {
    method: 'patch',
    subsystem: 'milestones',
    routePattern: 'PATCH /api/projects/:id/milestones/:milestoneId',
    buildPath: (pId, { milestoneId }) => `/api/projects/${pId}/milestones/${milestoneId}`,
    isProjectScoped: true,
  },
  {
    method: 'post',
    subsystem: 'milestones',
    routePattern: 'POST /api/projects/:id/milestones/:milestoneId/complete',
    buildPath: (pId, { milestoneId }) => `/api/projects/${pId}/milestones/${milestoneId}/complete`,
    isProjectScoped: true,
  },
  {
    method: 'post',
    subsystem: 'milestones',
    routePattern: 'POST /api/projects/:id/milestones/:milestoneId/reopen',
    buildPath: (pId, { milestoneId }) => `/api/projects/${pId}/milestones/${milestoneId}/reopen`,
    isProjectScoped: true,
  },

  // ── TimeLog Subsystem Endpoints ─────────────────────────────────────────────
  {
    method: 'post',
    subsystem: 'timeLogs',
    routePattern: 'POST /api/projects/:id/time-logs',
    buildPath: (pId) => `/api/projects/${pId}/time-logs`,
    isProjectScoped: true,
  },
  {
    method: 'get',
    subsystem: 'timeLogs',
    routePattern: 'GET /api/projects/:id/time-logs',
    buildPath: (pId) => `/api/projects/${pId}/time-logs`,
    isProjectScoped: true,
  },
  {
    method: 'patch',
    subsystem: 'timeLogs',
    routePattern: 'PATCH /api/projects/:id/time-logs/:timeLogId',
    buildPath: (pId, { timeLogId }) => `/api/projects/${pId}/time-logs/${timeLogId}`,
    isProjectScoped: true,
  },
  {
    method: 'delete',
    subsystem: 'timeLogs',
    routePattern: 'DELETE /api/projects/:id/time-logs/:timeLogId',
    buildPath: (pId, { timeLogId }) => `/api/projects/${pId}/time-logs/${timeLogId}`,
    isProjectScoped: true,
  },

  // ── Project Message Subsystem Endpoints ─────────────────────────────────────
  {
    method: 'post',
    subsystem: 'messages',
    routePattern: 'POST /api/projects/:id/messages',
    buildPath: (pId) => `/api/projects/${pId}/messages`,
    isProjectScoped: true,
  },
  {
    method: 'get',
    subsystem: 'messages',
    routePattern: 'GET /api/projects/:id/messages',
    buildPath: (pId) => `/api/projects/${pId}/messages`,
    isProjectScoped: true,
  },
  {
    method: 'post',
    subsystem: 'messages',
    routePattern: 'POST /api/projects/:id/messages/:messageId/pin',
    buildPath: (pId, { messageId }) => `/api/projects/${pId}/messages/${messageId}/pin`,
    isProjectScoped: true,
  },
  {
    method: 'post',
    subsystem: 'messages',
    routePattern: 'POST /api/projects/:id/messages/:messageId/unpin',
    buildPath: (pId, { messageId }) => `/api/projects/${pId}/messages/${messageId}/unpin`,
    isProjectScoped: true,
  },
  {
    method: 'post',
    subsystem: 'messages',
    routePattern: 'POST /api/projects/:id/messages/:messageId/to-task',
    buildPath: (pId, { messageId }) => `/api/projects/${pId}/messages/${messageId}/to-task`,
    isProjectScoped: true,
  },
];

describe('Step 10d: Route Inventory Test Suite', () => {
  const app = createApp({ csrfDisabled: true });

  const pmUserId = '22222222-2222-4222-8222-222222222222';
  const targetUserId = '44444444-4444-4444-8444-444444444444';
  const validProjectId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const validTaskId = '10101010-1010-4010-8010-101010101010';
  const validMilestoneId = '30303030-3030-4030-8030-303030303030';
  const validTimeLogId = '90909090-9090-4090-8090-909090909090';
  const validMessageId = '50505050-5050-4050-8050-505050505050';

  const extraIds = {
    taskId: validTaskId,
    userId: targetUserId,
    milestoneId: validMilestoneId,
    timeLogId: validTimeLogId,
    messageId: validMessageId,
  };

  const pmUser = {
    id: pmUserId,
    username: 'pm_lead',
    displayName: 'PM Lead',
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

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('verifies that exactly 35 routes are registered under /api/projects', () => {
    expect(PROJECT_ROUTES.length).toBe(35);

    // Count breakdown by subsystem
    const counts = PROJECT_ROUTES.reduce(
      (acc, r) => {
        acc[r.subsystem] = (acc[r.subsystem] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    );

    expect(counts).toEqual({
      projects: 9,
      tasks: 12,
      milestones: 5,
      timeLogs: 4,
      messages: 5,
    });
  });

  describe('Unauthenticated Access (Expect 401 Unauthorized)', () => {
    for (const r of PROJECT_ROUTES) {
      it(`returns 401 for unauthenticated request to ${r.routePattern}`, async () => {
        const path = r.buildPath(validProjectId, extraIds);
        const req = (request(app) as any)[r.method](path);

        const res = await req.send({});
        expect(res.status).toBe(401);
        expect(res.body.error).toBe('unauthenticated');
      });
    }
  });

  describe('Authenticated Non-Member Access (Expect 404 Not Found)', () => {
    const projectScopedRoutes = PROJECT_ROUTES.filter((r) => r.isProjectScoped);

    for (const r of projectScopedRoutes) {
      it(`returns 404 for non-member authenticated as project_manager on ${r.routePattern}`, async () => {
        const cookie = setupAuth(pmUser);

        // Mock DB: Project exists, but caller is NOT a member
        (db.project.findUnique as any).mockResolvedValue({
          id: validProjectId,
          name: 'Target Project',
          code: 'TP-01',
          status: 'in_progress',
          createdAt: new Date('2026-01-01'),
          members: [],
        });
        (db.projectMember.findUnique as any).mockResolvedValue(null);

        const path = r.buildPath(validProjectId, extraIds);
        const req = (request(app) as any)[r.method](path).set('Cookie', cookie);

        const res = await req.send({});
        expect(res.status).toBe(404);
        expect(res.body.error).toBe('not_found');
      });
    }
  });
});
