/**
 * Permission helpers for project time logs and workload views.
 *
 * Sourced directly from backend route enforcement:
 * - apps/api/src/routes/timeLogs.ts
 * - apps/api/src/routes/projects.ts
 * - apps/api/src/services/projectAccess.ts
 *
 * Invariants:
 * 1. POST /time-logs requires an explicit ProjectMember row (manager or member).
 *    system_admin has NO bypass for creating time logs without a membership row.
 *    Viewers receive HTTP 403.
 * 2. PATCH /time-logs/:id and DELETE /time-logs/:id are strictly author-only for everyone.
 *    Managers and system_admin cannot edit or delete other users' logs (HTTP 403).
 *    Viewers receive HTTP 403.
 * 3. GET /time-logs: managers and system_admin see all logs and can filter by userId.
 *    Members and viewers see only their own logs; non-managers passing another userId get HTTP 403.
 * 4. Time tab & Task Time Log section are hidden for viewers per Amendment 2.
 *    system_admin without a member row can view the Time tab (all logs) with a membership notice.
 */

import type { User, ProjectDetail, ProjectRole } from '../types/index.js';

export function getCallerProjectRole(
  user: User | null | undefined,
  project: Pick<ProjectDetail, 'members'> | null | undefined
): ProjectRole | undefined {
  if (!user || !project) return undefined;
  if (user.systemRole === 'system_admin') {
    // If system_admin has an explicit membership row, reflect that; otherwise default to manager-level capability
    const memberRow = project.members.find((m) => m.userId === user.id);
    return memberRow ? memberRow.projectRole : 'manager';
  }
  const memberRow = project.members.find((m) => m.userId === user.id);
  return memberRow?.projectRole;
}

export function hasProjectMemberRow(
  user: User | null | undefined,
  project: Pick<ProjectDetail, 'members'> | null | undefined
): boolean {
  if (!user || !project) return false;
  return project.members.some((m) => m.userId === user.id);
}

export function canLogTime(
  user: User | null | undefined,
  project: Pick<ProjectDetail, 'members'> | null | undefined
): boolean {
  if (!user || !project) return false;
  // system_admin has NO bypass for logging time: must have a project member row
  const memberRow = project.members.find((m) => m.userId === user.id);
  if (!memberRow) return false;
  // Viewers cannot log time
  return memberRow.projectRole === 'manager' || memberRow.projectRole === 'member';
}

export function canSeeTimeTab(
  user: User | null | undefined,
  project: Pick<ProjectDetail, 'members'> | null | undefined
): boolean {
  if (!user || !project) return false;
  // system_admin can always inspect time tab (with or without member row)
  if (user.systemRole === 'system_admin') return true;

  const memberRow = project.members.find((m) => m.userId === user.id);
  if (!memberRow) return false;
  // Viewers cannot see time tab (Amendment 2)
  return memberRow.projectRole !== 'viewer';
}

export function canSeeTaskTimeLogs(
  user: User | null | undefined,
  project: Pick<ProjectDetail, 'members'> | null | undefined
): boolean {
  return canSeeTimeTab(user, project);
}

export function canEditTimeLog(
  user: User | null | undefined,
  timeLog: { userId: string } | null | undefined,
  projectRole: ProjectRole | undefined
): boolean {
  if (!user || !timeLog) return false;
  if (projectRole === 'viewer') return false;
  // Author only for everyone; managers and system_admin get NO edit on other people's logs
  return timeLog.userId === user.id;
}

export function canDeleteTimeLog(
  user: User | null | undefined,
  timeLog: { userId: string } | null | undefined,
  projectRole: ProjectRole | undefined
): boolean {
  if (!user || !timeLog) return false;
  if (projectRole === 'viewer') return false;
  // Author only for everyone; managers and system_admin get NO delete on other people's logs
  return timeLog.userId === user.id;
}

export function canSeeAllTimeLogs(
  user: User | null | undefined,
  projectRole: ProjectRole | undefined
): boolean {
  if (!user) return false;
  return user.systemRole === 'system_admin' || projectRole === 'manager';
}

export function canFilterTimeLogsByUser(
  user: User | null | undefined,
  projectRole: ProjectRole | undefined
): boolean {
  return canSeeAllTimeLogs(user, projectRole);
}

export function canViewWorkload(
  user: User | null | undefined,
  projectRole: ProjectRole | undefined
): boolean {
  if (!user) return false;
  if (user.systemRole === 'system_admin') return true;
  return !!projectRole;
}
