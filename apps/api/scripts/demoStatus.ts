/**
 * demoStatus.ts
 *
 * Dev-only demo data status inspector for IMAC Operations System.
 * Reports counts of active demo records per entity type.
 *
 * Hard Safety Invariants:
 * - Refuses if NODE_ENV=production.
 * - Refuses if ALLOW_DEMO_DATA is not 'yes'.
 * - Refuses if database host is not localhost or 127.0.0.1.
 * - Refuses if database name is not exactly "imac_demo".
 * - DEMO_PASSWORD is required only by demoSeed.ts (not required by demoStatus).
 * - Never prints passwords, secrets, or database URLs.
 */

import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';
import {
  assertConnectedToDemoDatabase,
  findDemoRecordIds,
  validateDemoEnvironment,
} from './demoGuard.js';

async function main() {
  // 1. Guard check (demoStatus does not require DEMO_PASSWORD)
  const guard = validateDemoEnvironment(process.env, { requirePassword: false });
  if (!guard.allowed) {
    console.error(`DEMO STATUS REFUSED: ${guard.reason}`);
    process.exit(1);
  }

  const prisma = new PrismaClient();

  try {
    // 2. Assert connected database is strictly 'imac_demo' before any query
    await assertConnectedToDemoDatabase(prisma);

    const {
      demoUserIds,
      demoProfileIds,
      demoRoleIds,
      demoProjectIds,
      demoTaskIds,
      demoWorkLogDayIds,
    } = await findDemoRecordIds(prisma);

    const counts: Record<string, number> = {
      User: demoUserIds.length,
      EmployeeProfile: demoProfileIds.length,
      WorkRole: demoRoleIds.length,
      Project: demoProjectIds.length,
      Task: demoTaskIds.length,
      WorkLogDay: demoWorkLogDayIds.length,
    };

    counts['AvailabilityStatus'] = await prisma.availabilityStatus.count({
      where: { userId: { in: demoUserIds } },
    });

    counts['EmployeeWorkRole'] = await prisma.employeeWorkRole.count({
      where: {
        OR: [
          { employeeProfileId: { in: demoProfileIds } },
          { workRoleId: { in: demoRoleIds } },
        ],
      },
    });

    counts['ProjectStatusEvent'] = await prisma.projectStatusEvent.count({
      where: {
        OR: [
          { projectId: { in: demoProjectIds } },
          { changedByUserId: { in: demoUserIds } },
        ],
      },
    });

    counts['ProjectMember'] = await prisma.projectMember.count({
      where: {
        OR: [
          { projectId: { in: demoProjectIds } },
          { userId: { in: demoUserIds } },
        ],
      },
    });

    counts['Milestone'] = await prisma.milestone.count({
      where: { projectId: { in: demoProjectIds } },
    });

    counts['TaskDependency'] = await prisma.taskDependency.count({
      where: {
        OR: [
          { taskId: { in: demoTaskIds } },
          { dependsOnTaskId: { in: demoTaskIds } },
        ],
      },
    });

    counts['Comment'] = await prisma.comment.count({
      where: {
        OR: [
          { taskId: { in: demoTaskIds } },
          { authorUserId: { in: demoUserIds } },
        ],
      },
    });

    counts['ProjectMessage'] = await prisma.projectMessage.count({
      where: {
        OR: [
          { projectId: { in: demoProjectIds } },
          { authorUserId: { in: demoUserIds } },
        ],
      },
    });

    counts['TimeLog'] = await prisma.timeLog.count({
      where: {
        OR: [
          { projectId: { in: demoProjectIds } },
          { taskId: { in: demoTaskIds } },
          { userId: { in: demoUserIds } },
        ],
      },
    });

    counts['WorkLogEntry'] = await prisma.workLogEntry.count({
      where: {
        OR: [
          { workLogDayId: { in: demoWorkLogDayIds } },
          { workRoleId: { in: demoRoleIds } },
          { projectId: { in: demoProjectIds } },
          { taskId: { in: demoTaskIds } },
        ],
      },
    });

    counts['Session'] = await prisma.session.count({
      where: { userId: { in: demoUserIds } },
    });

    counts['AuditLog'] = await prisma.auditLog.count({
      where: { actorUserId: { in: demoUserIds } },
    });

    console.log('--- IMAC DEMO DATA STATUS ---');
    let totalDemoRecords = 0;
    for (const [entity, count] of Object.entries(counts)) {
      console.log(`  ${entity}: ${count}`);
      totalDemoRecords += count;
    }
    console.log(`Total demo records in database: ${totalDemoRecords}`);

    const manifestPath = path.resolve(process.cwd(), '.demo-manifest.txt');
    if (fs.existsSync(manifestPath)) {
      const stat = fs.statSync(manifestPath);
      console.log(`Manifest file exists: .demo-manifest.txt (modified ${stat.mtime.toISOString()})`);
    } else {
      console.log('Manifest file: not present');
    }
  } catch (error) {
    const err = error as any;
    const name = err?.name || 'Error';
    const code = err?.code ? ` [Code: ${err.code}]` : '';
    const message = err?.message || String(error);
    console.error(`Failed to inspect demo status: ${name}${code}: ${message}`);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

main();
