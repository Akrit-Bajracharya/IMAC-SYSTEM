/**
 * demoLookup.ts
 *
 * Shared helper for looking up demo record IDs across IMAC Operations System models.
 * Used identically by demoStatus.ts and demoRemove.ts to guarantee consistent identification
 * of demo-owned records (including tasks assigned to demo users).
 */

export interface DemoRecordIds {
  demoUserIds: string[];
  demoProfileIds: string[];
  demoRoleIds: string[];
  demoProjectIds: string[];
  demoTaskIds: string[];
  demoWorkLogDayIds: string[];
}

export interface DemoLookupClient {
  user: {
    findMany: (args: { where: any; select: { id: true } }) => Promise<{ id: string }[]>;
  };
  employeeProfile: {
    findMany: (args: { where: any; select: { id: true } }) => Promise<{ id: string }[]>;
  };
  workRole: {
    findMany: (args: { where: any; select: { id: true } }) => Promise<{ id: string }[]>;
  };
  project: {
    findMany: (args: { where: any; select: { id: true } }) => Promise<{ id: string }[]>;
  };
  task: {
    findMany: (args: { where: any; select: { id: true } }) => Promise<{ id: string }[]>;
  };
  workLogDay: {
    findMany: (args: { where: any; select: { id: true } }) => Promise<{ id: string }[]>;
  };
}

/**
 * Queries all demo record IDs across user, profile, work role, project, task, and work log models.
 * Guaranteed to identify demo tasks consistently:
 * - Tasks belonging to demo projects
 * - Tasks created by demo users
 * - Tasks assigned to demo users
 */
export async function findDemoRecordIds(client: DemoLookupClient): Promise<DemoRecordIds> {
  const demoUsers = await client.user.findMany({
    where: { username: { startsWith: 'demo_' } },
    select: { id: true },
  });
  const demoUserIds = demoUsers.map((u) => u.id);

  const demoProfiles = await client.employeeProfile.findMany({
    where: {
      OR: [
        { userId: { in: demoUserIds } },
        { employeeCode: { startsWith: 'DEMO-' } },
      ],
    },
    select: { id: true },
  });
  const demoProfileIds = demoProfiles.map((p) => p.id);

  const demoRoles = await client.workRole.findMany({
    where: { name: { startsWith: '[DEMO] ' } },
    select: { id: true },
  });
  const demoRoleIds = demoRoles.map((r) => r.id);

  const demoProjects = await client.project.findMany({
    where: {
      OR: [
        { name: { startsWith: '[DEMO] ' } },
        { createdByUserId: { in: demoUserIds } },
      ],
    },
    select: { id: true },
  });
  const demoProjectIds = demoProjects.map((p) => p.id);

  const demoTasks = await client.task.findMany({
    where: {
      OR: [
        { projectId: { in: demoProjectIds } },
        { createdByUserId: { in: demoUserIds } },
        { assigneeUserId: { in: demoUserIds } },
      ],
    },
    select: { id: true },
  });
  const demoTaskIds = demoTasks.map((t) => t.id);

  const demoWorkLogDays = await client.workLogDay.findMany({
    where: { employeeProfileId: { in: demoProfileIds } },
    select: { id: true },
  });
  const demoWorkLogDayIds = demoWorkLogDays.map((d) => d.id);

  return {
    demoUserIds,
    demoProfileIds,
    demoRoleIds,
    demoProjectIds,
    demoTaskIds,
    demoWorkLogDayIds,
  };
}
