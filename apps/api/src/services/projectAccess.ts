import { db } from '../db.js';
import type { AuthUser, ProjectRole } from '@imac/shared';
import type { Project, ProjectMember } from '@prisma/client';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isValidUuid(id: string | undefined | null): boolean {
  if (!id) return false;
  return UUID_REGEX.test(id);
}

export interface ProjectAccessResult {
  notFound?: boolean;
  message?: string;
  project?: Project;
  member?: ProjectMember | null;
  isSystemAdmin?: boolean;
  isManager?: boolean;
  isMember?: boolean;
  projectRole?: ProjectRole;
}

/**
 * Resolves project access and membership according to core IMAC security invariants:
 * 1. Malformed UUIDs yield 404 Not Found (never Prisma 500).
 * 2. Non-existent projects yield 404 Not Found.
 * 3. Non-members receive 404 Not Found (never 403, preventing IDOR project existence enumeration).
 * 4. system_admin bypasses membership requirements and is granted manager access.
 */
export async function resolveProjectAccess(
  projectId: string,
  user: AuthUser,
): Promise<ProjectAccessResult> {
  if (!isValidUuid(projectId)) {
    return { notFound: true, message: 'Project not found' };
  }

  const project = await db.project.findUnique({
    where: { id: projectId },
  });

  if (!project) {
    return { notFound: true, message: 'Project not found' };
  }

  if (user.systemRole === 'system_admin') {
    return {
      project,
      member: null,
      isSystemAdmin: true,
      isManager: true,
      isMember: true,
      projectRole: 'manager',
    };
  }

  const member = await db.projectMember.findUnique({
    where: {
      projectId_userId: {
        projectId,
        userId: user.id,
      },
    },
  });

  if (!member) {
    // Return 404 to avoid leaking project existence to non-members
    return { notFound: true, message: 'Project not found' };
  }

  return {
    project,
    member,
    isSystemAdmin: false,
    isManager: member.projectRole === 'manager',
    isMember: true,
    projectRole: member.projectRole as ProjectRole,
  };
}

export type TaskAction = 'create' | 'edit' | 'changeStatus' | 'manageDependencies';

/**
 * Swappable in-project task permission policy (documented in docs/open-policy-questions.md Question 22):
 * - system_admin and project managers can create, edit, change status, and manage dependencies on any task.
 * - Project members can:
 *   - create tasks
 *   - edit tasks they created or are assigned to
 *   - change status of tasks assigned to them
 *   - manage dependencies on tasks they could edit (dependent taskId)
 * - Project viewers are strictly read-only.
 *
 * Fail-Closed Invariants (Step 10d):
 * - After system-admin and manager checks, missing or empty userId returns false.
 * - For member branches other than create, missing task returns false.
 * - undefined === undefined can never match (explicit boolean coercion on non-empty IDs).
 */
export function canEditTask(
  projectRole: ProjectRole | undefined,
  isSystemAdmin: boolean,
  action: TaskAction,
  task?: { createdByUserId: string; assigneeUserId?: string | null } | null,
  userId?: string,
): boolean {
  if (isSystemAdmin || projectRole === 'manager') {
    return true;
  }
  if (!projectRole || projectRole === 'viewer') {
    return false;
  }
  if (!userId || typeof userId !== 'string' || userId.trim() === '') {
    return false;
  }
  if (projectRole === 'member') {
    if (action === 'create') {
      return true;
    }
    if (!task) {
      return false;
    }
    const isCreator = Boolean(task.createdByUserId && task.createdByUserId === userId);
    const isAssignee = Boolean(task.assigneeUserId && task.assigneeUserId === userId);

    if (action === 'edit' || action === 'manageDependencies') {
      return isCreator || isAssignee;
    }
    if (action === 'changeStatus') {
      return isAssignee;
    }
  }
  return false;
}
