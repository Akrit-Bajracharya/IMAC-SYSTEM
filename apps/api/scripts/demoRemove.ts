/**
 * demoRemove.ts
 *
 * Dev-only demo data teardown for IMAC Operations System.
 * Safely removes all seeded demo records in strict child-to-parent reverse order
 * inside an atomic Prisma transaction.
 *
 * Hard Safety Invariants:
 * - Refuses if NODE_ENV=production.
 * - Refuses if ALLOW_DEMO_DATA is not 'yes'.
 * - Refuses if database host is not localhost or 127.0.0.1.
 * - Refuses if database name is not exactly "imac_demo".
 * - DEMO_PASSWORD is required only by demoSeed.ts (not required by demoRemove).
 * - Never prints passwords or connection strings.
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
  // 1. Guard check (demoRemove does not require DEMO_PASSWORD)
  const guard = validateDemoEnvironment(process.env, { requirePassword: false });
  if (!guard.allowed) {
    console.error(`DEMO REMOVE REFUSED: ${guard.reason}`);
    process.exit(1);
  }

  const prisma = new PrismaClient();

  try {
    // 2. Assert connected database is strictly 'imac_demo' before any query or write
    await assertConnectedToDemoDatabase(prisma);

    // Collect demo record IDs via shared helper to scope deletions accurately
    const {
      demoUserIds,
      demoProfileIds,
      demoRoleIds,
      demoProjectIds,
      demoTaskIds,
      demoWorkLogDayIds,
    } = await findDemoRecordIds(prisma);

    console.log('Executing demo removal in strict child-to-parent reverse order inside transaction...');

    const deletionCounts: Record<string, number> = {};

    await prisma.$transaction(
      async (tx) => {
        // 1. WorkLogEntry (including linked entries)
        const delWorkLogEntries = await tx.workLogEntry.deleteMany({
          where: {
            OR: [
              { workLogDayId: { in: demoWorkLogDayIds } },
              { workRoleId: { in: demoRoleIds } },
              { projectId: { in: demoProjectIds } },
              { taskId: { in: demoTaskIds } },
            ],
          },
        });
        deletionCounts['WorkLogEntry'] = delWorkLogEntries.count;

        // 2. WorkLogDay
        const delWorkLogDays = await tx.workLogDay.deleteMany({
          where: { id: { in: demoWorkLogDayIds } },
        });
        deletionCounts['WorkLogDay'] = delWorkLogDays.count;

        // 3. EmployeeWorkRole
        const delEmpRoles = await tx.employeeWorkRole.deleteMany({
          where: {
            OR: [
              { employeeProfileId: { in: demoProfileIds } },
              { workRoleId: { in: demoRoleIds } },
            ],
          },
        });
        deletionCounts['EmployeeWorkRole'] = delEmpRoles.count;

        // 4. WorkRole (deleted by name prefix [DEMO] after EmployeeWorkRole and WorkLogEntry)
        const delRoles = await tx.workRole.deleteMany({
          where: { id: { in: demoRoleIds } },
        });
        deletionCounts['WorkRole'] = delRoles.count;

        // 5. Comment
        const delComments = await tx.comment.deleteMany({
          where: {
            OR: [
              { taskId: { in: demoTaskIds } },
              { authorUserId: { in: demoUserIds } },
            ],
          },
        });
        deletionCounts['Comment'] = delComments.count;

        // 6. TaskDependency
        const delDeps = await tx.taskDependency.deleteMany({
          where: {
            OR: [
              { taskId: { in: demoTaskIds } },
              { dependsOnTaskId: { in: demoTaskIds } },
            ],
          },
        });
        deletionCounts['TaskDependency'] = delDeps.count;

        // 7. TimeLog
        const delTimeLogs = await tx.timeLog.deleteMany({
          where: {
            OR: [
              { projectId: { in: demoProjectIds } },
              { taskId: { in: demoTaskIds } },
              { userId: { in: demoUserIds } },
            ],
          },
        });
        deletionCounts['TimeLog'] = delTimeLogs.count;

        // 8. ProjectMessage
        const delMsgs = await tx.projectMessage.deleteMany({
          where: {
            OR: [
              { projectId: { in: demoProjectIds } },
              { authorUserId: { in: demoUserIds } },
            ],
          },
        });
        deletionCounts['ProjectMessage'] = delMsgs.count;

        // 9. Task
        const delTasks = await tx.task.deleteMany({
          where: { id: { in: demoTaskIds } },
        });
        deletionCounts['Task'] = delTasks.count;

        // 10. Milestone
        const delMilestones = await tx.milestone.deleteMany({
          where: { projectId: { in: demoProjectIds } },
        });
        deletionCounts['Milestone'] = delMilestones.count;

        // 11. ProjectStatusEvent
        const delEvents = await tx.projectStatusEvent.deleteMany({
          where: {
            OR: [
              { projectId: { in: demoProjectIds } },
              { changedByUserId: { in: demoUserIds } },
            ],
          },
        });
        deletionCounts['ProjectStatusEvent'] = delEvents.count;

        // 12. ProjectMember
        const delMembers = await tx.projectMember.deleteMany({
          where: {
            OR: [
              { projectId: { in: demoProjectIds } },
              { userId: { in: demoUserIds } },
            ],
          },
        });
        deletionCounts['ProjectMember'] = delMembers.count;

        // 13. Project
        const delProjects = await tx.project.deleteMany({
          where: { id: { in: demoProjectIds } },
        });
        deletionCounts['Project'] = delProjects.count;

        // 14. EmployeeProfile
        const delProfiles = await tx.employeeProfile.deleteMany({
          where: { id: { in: demoProfileIds } },
        });
        deletionCounts['EmployeeProfile'] = delProfiles.count;

        // 15. AvailabilityStatus
        const delAvail = await tx.availabilityStatus.deleteMany({
          where: { userId: { in: demoUserIds } },
        });
        deletionCounts['AvailabilityStatus'] = delAvail.count;

        // 16. Session
        const delSessions = await tx.session.deleteMany({
          where: { userId: { in: demoUserIds } },
        });
        deletionCounts['Session'] = delSessions.count;

        // 17. AuditLog
        const delAudit = await tx.auditLog.deleteMany({
          where: { actorUserId: { in: demoUserIds } },
        });
        deletionCounts['AuditLog'] = delAudit.count;

        // 18. Notification
        const delNotifications = await tx.notification.deleteMany({
          where: { userId: { in: demoUserIds } },
        });
        deletionCounts['Notification'] = delNotifications.count;

        // 19. User
        const delUsers = await tx.user.deleteMany({
          where: { id: { in: demoUserIds } },
        });
        deletionCounts['User'] = delUsers.count;
      },
      {
        timeout: 120000,
        maxWait: 10000,
      }
    );

    // Clean up manifest file if it exists
    const manifestPath = path.resolve(process.cwd(), '.demo-manifest.txt');
    if (fs.existsSync(manifestPath)) {
      fs.unlinkSync(manifestPath);
      console.log('Removed .demo-manifest.txt');
    }

    console.log('Demo removal completed successfully:');
    for (const [entity, count] of Object.entries(deletionCounts)) {
      console.log(`  ${entity}: ${count} deleted`);
    }
  } catch (error) {
    const err = error as any;
    const name = err?.name || 'Error';
    const code = err?.code ? ` [Code: ${err.code}]` : '';
    const message = err?.message || String(error);
    console.error(`Demo removal failed. Transaction rolled back cleanly: ${name}${code}: ${message}`);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

main();
