/**
 * demoSeed.ts
 *
 * Dev-only demo data generator for IMAC Operations System.
 * Generates realistic fake data for manual testing against a separate database (imac_demo).
 *
 * Hard Safety Invariants:
 * - Refuses if NODE_ENV=production.
 * - Refuses if ALLOW_DEMO_DATA is not 'yes'.
 * - Refuses if database host is not localhost or 127.0.0.1.
 * - Refuses if database name is not exactly "imac_demo".
 * - DEMO_PASSWORD is required only by demoSeed.ts and must satisfy real password policy length (>= 10).
 * - Never prints passwords or connection strings.
 * - Entire seed is executed inside a single transaction with a 120s timeout.
 */

import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';
import { hashPassword } from '../src/services/password.js';
import {
  DEMO_USERS,
  DEMO_WORK_ROLES,
  getDemoProjects,
  getDemoWorkLogs,
} from './demoDataDefs.js';
import {
  assertConnectedToDemoDatabase,
  getKathmanduOffsetDate,
  resolveOffsetDate,
  validateDemoEnvironment,
  validateDependencyGraph,
  validatePlannedTimeLogs,
  validatePlannedWorkLogs,
} from './demoGuard.js';

async function main() {
  // 1. Guard check
  const guard = validateDemoEnvironment(process.env);
  if (!guard.allowed) {
    console.error(`DEMO SEED REFUSED: ${guard.reason}`);
    process.exit(1);
  }

  const prisma = new PrismaClient();

  try {
    // 2. Assert connected database is strictly 'imac_demo' before any query or write
    await assertConnectedToDemoDatabase(prisma);

    // 3. Pre-check: verify no demo data already exists
    const existingDemoUser = await prisma.user.findFirst({
      where: { username: { startsWith: 'demo_' } },
    });
    const existingDemoRole = await prisma.workRole.findFirst({
      where: { name: { startsWith: '[DEMO] ' } },
    });
    const existingDemoProject = await prisma.project.findFirst({
      where: { name: { startsWith: '[DEMO] ' } },
    });

    if (existingDemoUser || existingDemoRole || existingDemoProject) {
      console.error(
        'DEMO SEED REFUSED: Existing demo data detected in database. Run npm run demo:remove first.'
      );
      process.exit(1);
    }

    // 3. Pre-validate planned dependency graphs per project
    const projects = getDemoProjects();
    for (const proj of projects) {
      const depValidation = validateDependencyGraph(
        proj.dependencies.map((d) => ({
          taskId: d.taskKey,
          dependsOnTaskId: d.dependsOnTaskKey,
        }))
      );
      if (!depValidation.valid) {
        console.error(
          `DEMO SEED REFUSED: Invalid dependency graph in project "${proj.name}":`,
          depValidation.errors
        );
        process.exit(1);
      }
    }

    // 4. Aggregate ALL projects' planned time logs before validating global 24-hour cap
    const allPlannedTimeLogs = projects.flatMap((proj) =>
      proj.timeLogs.map((tl) => ({
        userId: tl.username,
        workDate: getKathmanduOffsetDate(tl.workDateOffsetDays),
        hours: tl.hours,
      }))
    );
    const timeLogValidation = validatePlannedTimeLogs(allPlannedTimeLogs);
    if (!timeLogValidation.valid) {
      console.error(
        'DEMO SEED REFUSED: Invalid time log configuration across projects:',
        timeLogValidation.errors
      );
      process.exit(1);
    }

    // 5. Pre-validate planned work logs (daily cap, role assignment, project/task membership)
    const workLogs = getDemoWorkLogs();
    const workLogValidation = validatePlannedWorkLogs(workLogs, DEMO_WORK_ROLES, projects);
    if (!workLogValidation.valid) {
      console.error(
        'DEMO SEED REFUSED: Invalid planned work logs configuration:',
        workLogValidation.errors
      );
      process.exit(1);
    }

    console.log('Pre-hashing demo user credentials with Argon2id...');
    // Pre-hash password before entering transaction to prevent transaction timeout
    const commonHash = await hashPassword(process.env.DEMO_PASSWORD!);

    console.log('Writing demo records inside atomic transaction (timeout: 120s)...');

    const manifestCounts: Record<string, number> = {};
    const manifestIds: Record<string, string[]> = {};

    function recordId(entity: string, id: string) {
      if (!manifestIds[entity]) {
        manifestIds[entity] = [];
      }
      manifestIds[entity].push(id);
      manifestCounts[entity] = (manifestCounts[entity] || 0) + 1;
    }

    await prisma.$transaction(
      async (tx) => {
        const userMap = new Map<string, string>(); // username -> userId
        const profileMap = new Map<string, string>(); // username -> profileId
        const workRoleMap = new Map<string, string>(); // roleName -> roleId
        const projectMap = new Map<string, string>(); // projectName -> projectId
        const milestoneMap = new Map<string, string>(); // milestoneName -> milestoneId
        const taskMap = new Map<string, string>(); // taskKey -> taskId

        // 1. Create Users, Profiles, and AvailabilityStatus
        for (const userDef of DEMO_USERS) {
          const user = await tx.user.create({
            data: {
              username: userDef.username,
              displayName: userDef.displayName,
              passwordHash: commonHash,
              systemRole: userDef.systemRole,
              isActive: true,
              mustChangePassword: false,
              failedLoginCount: 0,
              lockedUntil: null,
            },
          });
          userMap.set(userDef.username, user.id);
          recordId('User', user.id);

          const profile = await tx.employeeProfile.create({
            data: {
              userId: user.id,
              employeeCode: userDef.employeeCode,
              department: userDef.department,
              jobTitle: userDef.jobTitle,
              startDate: new Date(userDef.startDate),
              standardShiftHours: userDef.standardShiftHours,
              workingDaysPerWeek: userDef.workingDaysPerWeek,
            },
          });
          profileMap.set(userDef.username, profile.id);
          recordId('EmployeeProfile', profile.id);

          const availability = await tx.availabilityStatus.create({
            data: {
              userId: user.id,
              status: userDef.availability,
              message: userDef.availabilityMessage || null,
              source: 'demo_seed',
            },
          });
          recordId('AvailabilityStatus', availability.id);
        }

        // 2. Create Work Roles and Assignments
        for (const roleDef of DEMO_WORK_ROLES) {
          const workRole = await tx.workRole.create({
            data: {
              name: roleDef.name,
              description: roleDef.description,
              isActive: true,
            },
          });
          workRoleMap.set(roleDef.name, workRole.id);
          recordId('WorkRole', workRole.id);

          for (const username of roleDef.assignedUsernames) {
            const profileId = profileMap.get(username);
            if (profileId) {
              const link = await tx.employeeWorkRole.create({
                data: {
                  employeeProfileId: profileId,
                  workRoleId: workRole.id,
                },
              });
              recordId('EmployeeWorkRole', link.id);
            }
          }
        }

        // 3. Create Projects, Milestones, Tasks, Messages, Comments, Time Logs
        const formerMembersToDelete: Array<{ projectId: string; userId: string }> = [];

        for (const projDef of projects) {
          const creatorUserId = userMap.get(projDef.creatorUsername)!;
          const project = await tx.project.create({
            data: {
              name: projDef.name,
              description: projDef.description,
              status: projDef.status,
              startDate: new Date(getKathmanduOffsetDate(projDef.startDateOffsetDays)),
              targetDate: new Date(getKathmanduOffsetDate(projDef.targetDateOffsetDays)),
              createdByUserId: creatorUserId,
            },
          });
          projectMap.set(projDef.name, project.id);
          recordId('Project', project.id);

          // Status history events for non-default project statuses
          if (projDef.statusEvents) {
            for (const ev of projDef.statusEvents) {
              const changedByUserId = userMap.get(ev.changedByUsername)!;
              const statusEvent = await tx.projectStatusEvent.create({
                data: {
                  projectId: project.id,
                  fromStatus: ev.fromStatus,
                  toStatus: ev.toStatus,
                  reason: ev.reason,
                  changedByUserId,
                },
              });
              recordId('ProjectStatusEvent', statusEvent.id);
            }
          }

          // Project Members
          for (const memberDef of projDef.members) {
            const userId = userMap.get(memberDef.username)!;
            const member = await tx.projectMember.create({
              data: {
                projectId: project.id,
                userId,
                projectRole: memberDef.role,
                addedByUserId: creatorUserId,
              },
            });
            recordId('ProjectMember', member.id);

            if (memberDef.isFormerMember) {
              formerMembersToDelete.push({ projectId: project.id, userId });
            }
          }

          // Milestones
          for (const msDef of projDef.milestones) {
            const milestone = await tx.milestone.create({
              data: {
                projectId: project.id,
                name: msDef.name,
                dueDate: new Date(getKathmanduOffsetDate(msDef.dueDateOffsetDays)),
                completedAt:
                  msDef.completedAtOffsetDays !== undefined
                    ? new Date(getKathmanduOffsetDate(msDef.completedAtOffsetDays))
                    : null,
              },
            });
            milestoneMap.set(msDef.name, milestone.id);
            recordId('Milestone', milestone.id);
          }

          // Tasks (first pass: root tasks)
          for (const taskDef of projDef.tasks.filter((t) => !t.parentTaskKey)) {
            const task = await tx.task.create({
              data: {
                projectId: project.id,
                title: taskDef.title,
                description: taskDef.description,
                status: taskDef.status,
                assigneeUserId: taskDef.assigneeUsername
                  ? userMap.get(taskDef.assigneeUsername)
                  : null,
                dueDate: resolveOffsetDate(taskDef.dueDateOffsetDays),
                estimatedHours:
                  taskDef.estimatedHours !== undefined && taskDef.estimatedHours !== null
                    ? taskDef.estimatedHours
                    : null,
                milestoneId: taskDef.milestoneName
                  ? milestoneMap.get(taskDef.milestoneName)
                  : null,
                createdByUserId: userMap.get(taskDef.creatorUsername)!,
              },
            });
            taskMap.set(taskDef.key, task.id);
            recordId('Task', task.id);
          }

          // Tasks (second pass: subtasks)
          for (const taskDef of projDef.tasks.filter((t) => t.parentTaskKey)) {
            const parentTaskId = taskMap.get(taskDef.parentTaskKey!);
            const task = await tx.task.create({
              data: {
                projectId: project.id,
                parentTaskId,
                title: taskDef.title,
                description: taskDef.description,
                status: taskDef.status,
                assigneeUserId: taskDef.assigneeUsername
                  ? userMap.get(taskDef.assigneeUsername)
                  : null,
                dueDate: resolveOffsetDate(taskDef.dueDateOffsetDays),
                estimatedHours:
                  taskDef.estimatedHours !== undefined && taskDef.estimatedHours !== null
                    ? taskDef.estimatedHours
                    : null,
                milestoneId: taskDef.milestoneName
                  ? milestoneMap.get(taskDef.milestoneName)
                  : null,
                createdByUserId: userMap.get(taskDef.creatorUsername)!,
              },
            });
            taskMap.set(taskDef.key, task.id);
            recordId('Task', task.id);
          }

          // Task Dependencies
          for (const depDef of projDef.dependencies) {
            const taskId = taskMap.get(depDef.taskKey)!;
            const dependsOnTaskId = taskMap.get(depDef.dependsOnTaskKey)!;
            const dep = await tx.taskDependency.create({
              data: {
                taskId,
                dependsOnTaskId,
              },
            });
            recordId('TaskDependency', dep.id);
          }

          // Comments
          for (const commentDef of projDef.comments) {
            const taskId = taskMap.get(commentDef.taskKey)!;
            const authorUserId = userMap.get(commentDef.authorUsername)!;
            const comment = await tx.comment.create({
              data: {
                taskId,
                authorUserId,
                body: commentDef.body,
              },
            });
            recordId('Comment', comment.id);
          }

          // Project Messages
          for (const msgDef of projDef.messages) {
            const authorUserId = userMap.get(msgDef.authorUsername)!;
            const message = await tx.projectMessage.create({
              data: {
                projectId: project.id,
                authorUserId,
                body: msgDef.body,
                isPinned: msgDef.isPinned,
              },
            });
            recordId('ProjectMessage', message.id);
          }

          // Time Logs
          for (const tlDef of projDef.timeLogs) {
            const userId = userMap.get(tlDef.username)!;
            const taskId = tlDef.taskKey ? taskMap.get(tlDef.taskKey) : null;
            const timeLog = await tx.timeLog.create({
              data: {
                projectId: project.id,
                taskId,
                userId,
                workDate: new Date(getKathmanduOffsetDate(tlDef.workDateOffsetDays)),
                hours: tlDef.hours,
                note: tlDef.note,
              },
            });
            recordId('TimeLog', timeLog.id);
          }
        }

        // Former member cleanup: delete ProjectMember rows so user has historical data but is no longer a member
        for (const former of formerMembersToDelete) {
          await tx.projectMember.delete({
            where: {
              projectId_userId: {
                projectId: former.projectId,
                userId: former.userId,
              },
            },
          });
        }

        // 4. Create WorkLogDays and WorkLogEntries (including project/task linked entries)
        const workLogs = getDemoWorkLogs();
        for (const wldDef of workLogs) {
          const profileId = profileMap.get(wldDef.username)!;
          const workLogDay = await tx.workLogDay.create({
            data: {
              employeeProfileId: profileId,
              date: new Date(getKathmanduOffsetDate(wldDef.dateOffsetDays)),
              status: wldDef.status,
              submittedAt:
                wldDef.submittedAtOffsetDays !== undefined
                  ? new Date(getKathmanduOffsetDate(wldDef.submittedAtOffsetDays))
                  : null,
              approvedAt:
                wldDef.approvedAtOffsetDays !== undefined
                  ? new Date(getKathmanduOffsetDate(wldDef.approvedAtOffsetDays))
                  : null,
              approvedByUserId: wldDef.approvedByUsername
                ? userMap.get(wldDef.approvedByUsername)
                : null,
              rejectionReason: wldDef.rejectionReason || null,
            },
          });
          recordId('WorkLogDay', workLogDay.id);

          for (const entryDef of wldDef.entries) {
            const workRoleId = workRoleMap.get(entryDef.workRoleName)!;
            const linkedProjectId = entryDef.linkProjectName
              ? projectMap.get(entryDef.linkProjectName) || null
              : null;
            const linkedTaskId = entryDef.linkTaskKey
              ? taskMap.get(entryDef.linkTaskKey) || null
              : null;

            const entry = await tx.workLogEntry.create({
              data: {
                workLogDayId: workLogDay.id,
                workRoleId,
                hours: entryDef.hours,
                description: entryDef.description,
                projectId: linkedProjectId,
                taskId: linkedTaskId,
              },
            });
            recordId('WorkLogEntry', entry.id);
          }
        }
      },
      {
        timeout: 120000,
        maxWait: 10000,
      }
    );

    // 5. Generate Manifest (IDs and counts only, no credentials or database URLs)
    const manifestLines: string[] = [
      '# IMAC DEMO DATA MANIFEST',
      `# Generated at: ${new Date().toISOString()}`,
      '# This file contains non-sensitive record counts and UUIDs for demo test verification.',
      '',
      '--- SUMMARY COUNTS ---',
    ];

    for (const [entity, count] of Object.entries(manifestCounts)) {
      manifestLines.push(`${entity}: ${count}`);
    }

    manifestLines.push('');
    manifestLines.push('--- RECORD IDENTIFIERS ---');

    for (const [entity, ids] of Object.entries(manifestIds)) {
      manifestLines.push(`[${entity}] (${ids.length} records)`);
      for (const id of ids) {
        manifestLines.push(`  ${id}`);
      }
    }

    const manifestPath = path.resolve(process.cwd(), '.demo-manifest.txt');
    fs.writeFileSync(manifestPath, manifestLines.join('\n'), 'utf-8');

    console.log('Demo seed completed successfully.');
    console.log(`Manifest written to: ${manifestPath}`);
    for (const [entity, count] of Object.entries(manifestCounts)) {
      console.log(`  ${entity}: ${count}`);
    }
  } catch (error) {
    const err = error as any;
    const name = err?.name || 'Error';
    const code = err?.code ? ` [Code: ${err.code}]` : '';
    const message = err?.message || String(error);
    console.error(`Demo seed failed. Transaction rolled back cleanly: ${name}${code}: ${message}`);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

main();
