import * as fs from 'fs';
import * as path from 'path';
import { describe, expect, it } from 'vitest';
import { ProjectRole } from '@prisma/client';
import {
  DEMO_HOSTILE_TITLE_200,
  DEMO_PROJECTS,
  DEMO_USERS,
  DEMO_WORK_LOG_DAYS,
  DEMO_WORK_ROLES,
  generateHostileMarkdown5000,
  getDemoProjects,
  getDemoWorkLogs,
} from '../../scripts/demoDataDefs.js';
import {
  DEMO_DELETION_ORDER,
  findDemoRecordIds,
  getKathmanduOffsetDate,
  getKathmanduToday,
  MIN_PASSWORD_LENGTH,
  PARENT_CHILD_RELATIONS,
  resolveOffsetDate,
  validateDeletionOrder,
  validateDemoEnvironment,
  validateDependencyGraph,
  validatePlannedTimeLogs,
  validatePlannedWorkLogs,
} from '../../scripts/demoGuard.js';

describe('Demo Data Tooling - demoGuard and Data Definitions', () => {
  describe('Environment Guard (validateDemoEnvironment)', () => {
    const validEnv = {
      ALLOW_DEMO_DATA: 'yes',
      NODE_ENV: 'test',
      DATABASE_URL: 'postgresql://test_user:test_secret@localhost:5432/imac_demo',
      DEMO_PASSWORD: 'DemoPassword123!',
    };

    // ITEM 6 TEST: imac_demo allowed
    it('allows database named imac_demo on localhost', () => {
      const result = validateDemoEnvironment(validEnv);
      expect(result.allowed).toBe(true);
      expect(result.reason).toBeUndefined();
    });

    it('allows database named imac_demo on 127.0.0.1', () => {
      const result = validateDemoEnvironment({
        ...validEnv,
        DATABASE_URL: 'postgresql://test_user:test_secret@127.0.0.1:5432/imac_demo',
      });
      expect(result.allowed).toBe(true);
    });

    // ITEM 6 TEST: ALLOW_DEMO_DATA missing refused
    it('refuses when ALLOW_DEMO_DATA is missing or not set to "yes"', () => {
      const result = validateDemoEnvironment({
        ...validEnv,
        ALLOW_DEMO_DATA: undefined,
      });
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('ALLOW_DEMO_DATA');

      const resultNo = validateDemoEnvironment({
        ...validEnv,
        ALLOW_DEMO_DATA: 'no',
      });
      expect(resultNo.allowed).toBe(false);
    });

    // ITEM 6 TEST: production refused
    it('refuses when NODE_ENV is production', () => {
      const result = validateDemoEnvironment({
        ...validEnv,
        NODE_ENV: 'production',
      });
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('production');
    });

    // ITEM 6 TEST: empty or malformed URL refused
    it('refuses when DATABASE_URL is empty or malformed', () => {
      const resMissing = validateDemoEnvironment({
        ...validEnv,
        DATABASE_URL: undefined,
      });
      expect(resMissing.allowed).toBe(false);
      expect(resMissing.reason).toContain('DATABASE_URL');

      const resEmpty = validateDemoEnvironment({
        ...validEnv,
        DATABASE_URL: '',
      });
      expect(resEmpty.allowed).toBe(false);
      expect(resEmpty.reason).toContain('DATABASE_URL');

      const resMalformed = validateDemoEnvironment({
        ...validEnv,
        DATABASE_URL: 'not-a-valid-url-format',
      });
      expect(resMalformed.allowed).toBe(false);
      expect(resMalformed.reason).toContain('valid URL');
      // Ensure the malformed string is not echoed in the error
      expect(resMalformed.reason).not.toContain('not-a-valid-url-format');
    });

    // ITEM 6 TEST: remote host refused
    it('refuses when database host is remote', () => {
      const result = validateDemoEnvironment({
        ...validEnv,
        DATABASE_URL: 'postgresql://user:secret@192.168.1.100:5432/imac_demo',
      });
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('localhost or 127.0.0.1');
      expect(result.reason).not.toContain('192.168.1.100');
    });

    // ITEM 4 TEST: database name must be exactly imac_demo
    it('refuses when database is named imac (not exactly imac_demo)', () => {
      const result = validateDemoEnvironment({
        ...validEnv,
        DATABASE_URL: 'postgresql://user:secret@localhost:5432/imac',
      });
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('must be exactly "imac_demo"');
    });

    it('refuses when database name contains demo but is not exactly imac_demo', () => {
      const resSuffix = validateDemoEnvironment({
        ...validEnv,
        DATABASE_URL: 'postgresql://user:secret@localhost:5432/imac_demo_2',
      });
      expect(resSuffix.allowed).toBe(false);
      expect(resSuffix.reason).toContain('must be exactly "imac_demo"');

      const resBare = validateDemoEnvironment({
        ...validEnv,
        DATABASE_URL: 'postgresql://user:secret@localhost:5432/demo',
      });
      expect(resBare.allowed).toBe(false);
      expect(resBare.reason).toContain('must be exactly "imac_demo"');
    });

    // Guard tests: trailing space, %20, empty ALLOW_DEMO_DATA, uppercase IMAC_DEMO
    it('refuses database name with trailing space in URL', () => {
      const result = validateDemoEnvironment({
        ...validEnv,
        DATABASE_URL: 'postgresql://test_user:test_secret@localhost:5432/imac_demo ',
      });
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('forbidden leading or trailing whitespace');
    });

    it('refuses database name with %20 (URL-encoded trailing space)', () => {
      const result = validateDemoEnvironment({
        ...validEnv,
        DATABASE_URL: 'postgresql://test_user:test_secret@localhost:5432/imac_demo%20',
      });
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('must be exactly "imac_demo"');
    });

    it('refuses when ALLOW_DEMO_DATA is empty string', () => {
      const result = validateDemoEnvironment({
        ...validEnv,
        ALLOW_DEMO_DATA: '',
      });
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('ALLOW_DEMO_DATA environment variable must be explicitly set to "yes"');
    });

    it('refuses database name in uppercase "IMAC_DEMO"', () => {
      const result = validateDemoEnvironment({
        ...validEnv,
        DATABASE_URL: 'postgresql://test_user:test_secret@localhost:5432/IMAC_DEMO',
      });
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('must be exactly "imac_demo"');
    });

    // ITEM 4 TEST: refuse URLs with host, hostaddr or socket query parameters
    it('refuses URLs with host, hostaddr, or socket query parameters', () => {
      const resHost = validateDemoEnvironment({
        ...validEnv,
        DATABASE_URL: 'postgresql://user:secret@localhost:5432/imac_demo?host=remote.evil.com',
      });
      expect(resHost.allowed).toBe(false);
      expect(resHost.reason).toContain('forbidden query parameter override');

      const resHostAddr = validateDemoEnvironment({
        ...validEnv,
        DATABASE_URL: 'postgresql://user:secret@localhost:5432/imac_demo?hostaddr=10.0.0.1',
      });
      expect(resHostAddr.allowed).toBe(false);
      expect(resHostAddr.reason).toContain('forbidden query parameter override');

      const resSocket = validateDemoEnvironment({
        ...validEnv,
        DATABASE_URL: 'postgresql://user:secret@localhost:5432/imac_demo?socket=/var/run/postgresql',
      });
      expect(resSocket.allowed).toBe(false);
      expect(resSocket.reason).toContain('forbidden query parameter override');
    });

    // ITEM 4 TEST: missing port or numeric ports other than 5432 are accepted
    it('allows missing port or numeric ports other than 5432', () => {
      // Missing port (default pg port)
      const resMissingPort = validateDemoEnvironment({
        ...validEnv,
        DATABASE_URL: 'postgresql://user:secret@localhost/imac_demo',
      });
      expect(resMissingPort.allowed).toBe(true);

      // Port other than 5432 (e.g. 5433)
      const res5433 = validateDemoEnvironment({
        ...validEnv,
        DATABASE_URL: 'postgresql://user:secret@localhost:5433/imac_demo',
      });
      expect(res5433.allowed).toBe(true);
    });

    // ITEM 4 TEST: demo:remove and demo:status do not require DEMO_PASSWORD
    it('supports requirePassword option: demo:remove and demo:status do not require DEMO_PASSWORD', () => {
      const envNoPassword = {
        ...validEnv,
        DEMO_PASSWORD: undefined,
      };

      // Default (requirePassword: true) refuses without DEMO_PASSWORD
      const resDefault = validateDemoEnvironment(envNoPassword);
      expect(resDefault.allowed).toBe(false);
      expect(resDefault.reason).toContain('DEMO_PASSWORD');

      // Explicit requirePassword: false allows execution
      const resNoPassword = validateDemoEnvironment(envNoPassword, { requirePassword: false });
      expect(resNoPassword.allowed).toBe(true);
    });

    // ITEM 6 TEST: "demo" only in the password or host but not the database name refused
    it('refuses when "demo" is only in username, password, or host, but not in the database name', () => {
      // "demo" in username only
      const resUser = validateDemoEnvironment({
        ...validEnv,
        DATABASE_URL: 'postgresql://demo_user:secret@localhost:5432/imac',
      });
      expect(resUser.allowed).toBe(false);
      expect(resUser.reason).toContain('must be exactly "imac_demo"');

      // "demo" in password only
      const resPass = validateDemoEnvironment({
        ...validEnv,
        DATABASE_URL: 'postgresql://user:demo_pass@localhost:5432/imac',
      });
      expect(resPass.allowed).toBe(false);
      expect(resPass.reason).toContain('must be exactly "imac_demo"');

      // "demo" in remote host only
      const resHost = validateDemoEnvironment({
        ...validEnv,
        DATABASE_URL: 'postgresql://user:secret@demo.cloud.internal:5432/imac',
      });
      expect(resHost.allowed).toBe(false);
      expect(resHost.reason).toContain('localhost or 127.0.0.1');
    });

    it('refuses when DEMO_PASSWORD is missing or shorter than policy minimum (10 chars)', () => {
      expect(MIN_PASSWORD_LENGTH).toBe(10);

      const resMissing = validateDemoEnvironment({
        ...validEnv,
        DEMO_PASSWORD: undefined,
      });
      expect(resMissing.allowed).toBe(false);
      expect(resMissing.reason).toContain('DEMO_PASSWORD');

      // 9 characters (below minimum 10)
      const resShort = validateDemoEnvironment({
        ...validEnv,
        DEMO_PASSWORD: '123456789',
      });
      expect(resShort.allowed).toBe(false);
      expect(resShort.reason).toContain(`at least ${MIN_PASSWORD_LENGTH} characters`);
      expect(resShort.reason).not.toContain('123456789');

      // Exactly 10 characters (allowed)
      const resExact = validateDemoEnvironment({
        ...validEnv,
        DEMO_PASSWORD: '1234567890',
      });
      expect(resExact.allowed).toBe(true);
    });
  });

  describe('Kathmandu Date Helpers (explicit clock & machine timezone independence)', () => {
    it('accurately resolves Kathmandu date across UTC midnight boundaries with explicit clock', () => {
      // 18:14:00 UTC on 2026-11-13 is 23:59:00 NPT on 2026-11-13
      const clock1 = new Date('2026-11-13T18:14:00Z');
      expect(getKathmanduToday(clock1)).toBe('2026-11-13');

      // 18:15:00 UTC on 2026-11-13 is 00:00:00 NPT on 2026-11-14
      const clock2 = new Date('2026-11-13T18:15:00Z');
      expect(getKathmanduToday(clock2)).toBe('2026-11-14');
    });

    it('accurately calculates positive and negative day offsets in Kathmandu with explicit clock', () => {
      const fixedClock = new Date('2026-10-30T06:00:00Z'); // 2026-10-30 in Kathmandu
      expect(getKathmanduToday(fixedClock)).toBe('2026-10-30');

      expect(getKathmanduOffsetDate(0, fixedClock)).toBe('2026-10-30');
      expect(getKathmanduOffsetDate(1, fixedClock)).toBe('2026-10-31');
      expect(getKathmanduOffsetDate(-1, fixedClock)).toBe('2026-10-29');
      expect(getKathmanduOffsetDate(-90, fixedClock)).toBe('2026-08-01');
    });
  });

  describe('resolveOffsetDate pure helper (Item 1 & Item 3 tests)', () => {
    const fixedClock = new Date('2026-11-16T12:00:00Z'); // today in Kathmandu: 2026-11-16

    it('correctly resolves offsets -30, -1, 0, +1, +30 and undefined without falsy coercion on 0, returning Date at UTC midnight', () => {
      // Offset 0: due today (crucial test: must NOT be falsy-coerced to null!)
      const date0 = resolveOffsetDate(0, fixedClock);
      expect(date0).not.toBeNull();
      expect(date0 instanceof Date).toBe(true);
      expect(date0!.toISOString()).toBe('2026-11-16T00:00:00.000Z');
      expect(date0!.getUTCHours()).toBe(0);
      expect(date0!.getUTCMinutes()).toBe(0);
      expect(getKathmanduToday(date0!)).toBe('2026-11-16');

      // Offset -30: 30 days ago
      const dateMinus30 = resolveOffsetDate(-30, fixedClock);
      expect(dateMinus30).not.toBeNull();
      expect(dateMinus30 instanceof Date).toBe(true);
      expect(dateMinus30!.toISOString()).toBe('2026-10-17T00:00:00.000Z');
      expect(dateMinus30!.getUTCHours()).toBe(0);
      expect(getKathmanduToday(dateMinus30!)).toBe('2026-10-17');

      // Offset -1: yesterday
      const dateMinus1 = resolveOffsetDate(-1, fixedClock);
      expect(dateMinus1).not.toBeNull();
      expect(dateMinus1 instanceof Date).toBe(true);
      expect(dateMinus1!.toISOString()).toBe('2026-11-15T00:00:00.000Z');
      expect(dateMinus1!.getUTCHours()).toBe(0);
      expect(getKathmanduToday(dateMinus1!)).toBe('2026-11-15');

      // Offset +1: tomorrow
      const datePlus1 = resolveOffsetDate(1, fixedClock);
      expect(datePlus1).not.toBeNull();
      expect(datePlus1 instanceof Date).toBe(true);
      expect(datePlus1!.toISOString()).toBe('2026-11-17T00:00:00.000Z');
      expect(datePlus1!.getUTCHours()).toBe(0);
      expect(getKathmanduToday(datePlus1!)).toBe('2026-11-17');

      // Offset +30: 30 days in future
      const datePlus30 = resolveOffsetDate(30, fixedClock);
      expect(datePlus30).not.toBeNull();
      expect(datePlus30 instanceof Date).toBe(true);
      expect(datePlus30!.toISOString()).toBe('2026-12-16T00:00:00.000Z');
      expect(datePlus30!.getUTCHours()).toBe(0);
      expect(getKathmanduToday(datePlus30!)).toBe('2026-12-16');

      // Undefined: must return null
      const dateUndefined = resolveOffsetDate(undefined, fixedClock);
      expect(dateUndefined).toBeNull();

      // Null: must return null
      const dateNull = resolveOffsetDate(null, fixedClock);
      expect(dateNull).toBeNull();
    });
  });

  describe('Planned Time Log Validation (validatePlannedTimeLogs)', () => {
    const fixedClock = new Date('2026-10-30T06:00:00Z'); // today: 2026-10-30; allowed window: 2026-08-01 to 2026-10-31

    it('accepts logs within the allowed Kathmandu window and <= 24 daily hours with explicit clock', () => {
      const result = validatePlannedTimeLogs(
        [
          { userId: 'u1', workDate: '2026-10-30', hours: 8 },
          { userId: 'u1', workDate: '2026-10-31', hours: 4 },
          { userId: 'u1', workDate: '2026-08-01', hours: 6 },
          { userId: 'u2', workDate: '2026-10-30', hours: 10 },
        ],
        fixedClock
      );
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('rejects logs older than 90 days with explicit clock', () => {
      const result = validatePlannedTimeLogs(
        [{ userId: 'u1', workDate: '2026-07-31', hours: 5 }],
        fixedClock
      );
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('older than allowed window');
    });

    it('rejects logs beyond tomorrow (+1 day in Kathmandu) with explicit clock', () => {
      const result = validatePlannedTimeLogs(
        [{ userId: 'u1', workDate: '2026-11-01', hours: 5 }],
        fixedClock
      );
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('beyond allowed window');
    });

    it('rejects when cumulative daily hours for a user exceed 24 hours with explicit clock', () => {
      const result = validatePlannedTimeLogs(
        [
          { userId: 'u1', workDate: '2026-10-25', hours: 14 },
          { userId: 'u1', workDate: '2026-10-25', hours: 11 }, // Total 25h > 24h
        ],
        fixedClock
      );
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('exceeds 24 daily hours');
    });

    it('rejects time log hours not conforming to 0.25 increments', () => {
      const result = validatePlannedTimeLogs(
        [{ userId: 'u1', workDate: '2026-10-30', hours: 2.3 }],
        fixedClock
      );
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('0.25 increments');
    });

    it('validates all planned project time logs pass using explicit clock (including near-24h day)', () => {
      const projects = getDemoProjects();
      const allPlannedLogs = projects.flatMap((p) =>
        p.timeLogs.map((tl) => ({
          userId: tl.username,
          workDate: getKathmanduOffsetDate(tl.workDateOffsetDays, fixedClock),
          hours: tl.hours,
        }))
      );

      const validation = validatePlannedTimeLogs(allPlannedLogs, fixedClock);
      expect(validation.valid).toBe(true);
      expect(validation.errors).toHaveLength(0);

      // Verify the near-24h day for demo_dev on offset -1 (23.0h total)
      const devMinus1Logs = allPlannedLogs.filter(
        (l) => l.userId === 'demo_dev' && l.workDate === getKathmanduOffsetDate(-1, fixedClock)
      );
      const devMinus1Total = devMinus1Logs.reduce((acc, l) => acc + l.hours, 0);
      expect(devMinus1Total).toBe(23.0); // Exactly 23h (near 24h boundary!)
    });
  });

  describe('Dependency Graph Cycle Detection (validateDependencyGraph)', () => {
    it('accepts acyclic directed dependencies', () => {
      const result = validateDependencyGraph([
        { taskId: 'task-3', dependsOnTaskId: 'task-2' },
        { taskId: 'task-2', dependsOnTaskId: 'task-1' },
      ]);
      expect(result.valid).toBe(true);
      expect(result.hasCycle).toBe(false);
    });

    it('rejects self-dependencies', () => {
      const result = validateDependencyGraph([
        { taskId: 'task-1', dependsOnTaskId: 'task-1' },
      ]);
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('Self dependency');
    });

    it('rejects direct 2-node cycles', () => {
      const result = validateDependencyGraph([
        { taskId: 'task-A', dependsOnTaskId: 'task-B' },
        { taskId: 'task-B', dependsOnTaskId: 'task-A' },
      ]);
      expect(result.valid).toBe(false);
      expect(result.hasCycle).toBe(true);
      expect(result.errors[0]).toContain('Dependency cycle detected');
    });

    it('rejects multi-node cycles', () => {
      const result = validateDependencyGraph([
        { taskId: 'task-A', dependsOnTaskId: 'task-B' },
        { taskId: 'task-B', dependsOnTaskId: 'task-C' },
        { taskId: 'task-C', dependsOnTaskId: 'task-A' },
      ]);
      expect(result.valid).toBe(false);
      expect(result.hasCycle).toBe(true);
    });

    it('confirms all project dependencies are valid DAGs with chain of three and open prerequisite', () => {
      const projects = getDemoProjects();
      for (const proj of projects) {
        const result = validateDependencyGraph(
          proj.dependencies.map((d) => ({
            taskId: d.taskKey,
            dependsOnTaskId: d.dependsOnTaskKey,
          }))
        );
        expect(result.valid).toBe(true);
        expect(result.hasCycle).toBe(false);
      }

      const disasterProj = projects.find((p) => p.name.includes('Disaster Relief'))!;
      // Chain of three: disaster-overdue-7 -> disaster-due-tomorrow -> disaster-1
      const depChain = disasterProj.dependencies.filter(
        (d) =>
          (d.taskKey === 'disaster-overdue-7' && d.dependsOnTaskKey === 'disaster-due-tomorrow') ||
          (d.taskKey === 'disaster-due-tomorrow' && d.dependsOnTaskKey === 'disaster-1')
      );
      expect(depChain).toHaveLength(2);

      // Open prerequisite: disaster-overdue-1 depends on disaster-due-today (in_progress)
      const openPrereq = disasterProj.dependencies.find(
        (d) => d.taskKey === 'disaster-overdue-1' && d.dependsOnTaskKey === 'disaster-due-today'
      );
      expect(openPrereq).toBeDefined();
    });
  });

  describe('Planned Work Log Validation (validatePlannedWorkLogs - Item 2)', () => {
    it('passes for valid demo work logs, roles, and projects', () => {
      const workLogs = getDemoWorkLogs();
      const projects = getDemoProjects();
      const res = validatePlannedWorkLogs(workLogs, DEMO_WORK_ROLES, projects);
      expect(res.valid).toBe(true);
      expect(res.errors).toHaveLength(0);
    });

    it('fails when duplicate day exists for the same user and date offset (Rule 1)', () => {
      const duplicateDays = [
        {
          username: 'demo_dev',
          dateOffsetDays: -1,
          entries: [{ workRoleName: '[DEMO] Full Stack Engineering', hours: 4.0, description: 'Shift 1' }],
        },
        {
          username: 'demo_dev',
          dateOffsetDays: -1,
          entries: [{ workRoleName: '[DEMO] Full Stack Engineering', hours: 4.0, description: 'Shift 2' }],
        },
      ];
      const res = validatePlannedWorkLogs(duplicateDays, DEMO_WORK_ROLES, getDemoProjects());
      expect(res.valid).toBe(false);
      expect(res.errors.some((e) => e.includes('Duplicate work log day'))).toBe(true);
    });

    it('fails when day entries total exceeds 24 hours (Rule 2)', () => {
      const over24Days = [
        {
          username: 'demo_dev',
          dateOffsetDays: -1,
          entries: [
            { workRoleName: '[DEMO] Full Stack Engineering', hours: 16.0, description: 'Shift 1' },
            { workRoleName: '[DEMO] Full Stack Engineering', hours: 9.0, description: 'Shift 2' },
          ],
        },
      ];
      const res = validatePlannedWorkLogs(over24Days, DEMO_WORK_ROLES, getDemoProjects());
      expect(res.valid).toBe(false);
      expect(res.errors.some((e) => e.includes('exceeds 24 total hours'))).toBe(true);
    });

    it('fails when work role is not assigned to the user (Rule 3)', () => {
      // demo_pm is assigned to [DEMO] Project Coordination only, not [DEMO] Full Stack Engineering
      const unassignedRoleDays = [
        {
          username: 'demo_pm',
          dateOffsetDays: -1,
          entries: [
            { workRoleName: '[DEMO] Full Stack Engineering', hours: 4.0, description: 'Unassigned role entry' },
          ],
        },
      ];
      const res = validatePlannedWorkLogs(unassignedRoleDays, DEMO_WORK_ROLES, getDemoProjects());
      expect(res.valid).toBe(false);
      expect(res.errors.some((e) => e.includes('is not assigned to work role'))).toBe(true);
    });

    it('fails when linked task does not belong to the linked project (Rule 4a)', () => {
      // transit-1 belongs to Valley Transit App, not Solar Grid
      const mismatchedTaskDays = [
        {
          username: 'demo_dev',
          dateOffsetDays: -1,
          entries: [
            {
              workRoleName: '[DEMO] Full Stack Engineering',
              hours: 4.0,
              description: 'Mismatched project and task',
              linkProjectName: '[DEMO] Solar Grid Micro-Management',
              linkTaskKey: 'transit-1',
            },
          ],
        },
      ];
      const res = validatePlannedWorkLogs(mismatchedTaskDays, DEMO_WORK_ROLES, getDemoProjects());
      expect(res.valid).toBe(false);
      expect(res.errors.some((e) => e.includes('does not belong to project'))).toBe(true);
    });

    it('fails when user is a former member (membership deleted) of linked project (Rule 4b)', () => {
      // demo_dev was a member of Disaster Relief, but isFormerMember: true marks membership removed
      const formerMemberDays = [
        {
          username: 'demo_dev',
          dateOffsetDays: -1,
          entries: [
            {
              workRoleName: '[DEMO] Full Stack Engineering',
              hours: 4.0,
              description: 'Linking to project where membership was removed',
              linkProjectName: '[DEMO] Nepal Disaster Relief Portal',
              linkTaskKey: 'disaster-1',
            },
          ],
        },
      ];
      const res = validatePlannedWorkLogs(formerMemberDays, DEMO_WORK_ROLES, getDemoProjects());
      expect(res.valid).toBe(false);
      expect(res.errors.some((e) => e.includes('is not a current member'))).toBe(true);
    });

    it('fails when user is a non-member of linked project (Rule 4c)', () => {
      // demo_designer is a non-member of Valley Transit App
      const nonMemberDays = [
        {
          username: 'demo_designer',
          dateOffsetDays: -1,
          entries: [
            {
              workRoleName: '[DEMO] UI/UX Design',
              hours: 4.0,
              description: 'Non-member linking task',
              linkProjectName: '[DEMO] Valley Transit App',
              linkTaskKey: 'transit-1',
            },
          ],
        },
      ];
      const res = validatePlannedWorkLogs(nonMemberDays, DEMO_WORK_ROLES, getDemoProjects());
      expect(res.valid).toBe(false);
      expect(res.errors.some((e) => e.includes('is not a current member'))).toBe(true);
    });
  });

  describe('Deletion Order Integrity & Prisma Foreign Key Parser (validateDeletionOrder)', () => {
    it('confirms DEMO_DELETION_ORDER places every child before its parent in hardcoded relations', () => {
      const result = validateDeletionOrder(DEMO_DELETION_ORDER, PARENT_CHILD_RELATIONS);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('detects inverted parent-child order violations', () => {
      const badOrder = ['User', 'Project', 'Task', 'Comment'];
      const result = validateDeletionOrder(badOrder, [
        { child: 'Comment', parent: 'Task' },
        { child: 'Task', parent: 'Project' },
        { child: 'Project', parent: 'User' },
      ]);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThanOrEqual(1);
      expect(result.errors[0]).toContain('Entity order violation');
    });

    // ITEM 2 & ITEM 6 TEST: Programmatic Prisma schema foreign key validator
    it('reads schema.prisma and validates model names, required foreign keys, and child-before-parent ordering in DEMO_DELETION_ORDER', () => {
      const schemaPath = path.resolve(__dirname, '../../prisma/schema.prisma');
      const schemaContent = fs.readFileSync(schemaPath, 'utf-8');

      // 1. Extract all model definitions from schema.prisma
      const modelBlocks = schemaContent.match(/model\s+(\w+)\s*\{([^}]+)\}/g) || [];
      const schemaModelNames = new Set<string>();
      const modelFieldsMap = new Map<string, Map<string, string>>();
      const modelRelations: Array<{
        child: string;
        parent: string;
        fkField: string;
        isRequired: boolean;
      }> = [];

      for (const block of modelBlocks) {
        const modelNameMatch = block.match(/model\s+(\w+)/);
        if (!modelNameMatch) continue;
        const modelName = modelNameMatch[1];
        schemaModelNames.add(modelName);

        const fieldTypes = new Map<string, string>();
        const lines = block.split('\n');

        // First pass: collect field declarations and their types
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || trimmed.startsWith('//') || trimmed.startsWith('@@')) continue;
          const fieldMatch = trimmed.match(/^(\w+)\s+([A-Za-z0-9_?]+)/);
          if (fieldMatch) {
            fieldTypes.set(fieldMatch[1], fieldMatch[2]);
          }
        }
        modelFieldsMap.set(modelName, fieldTypes);

        // Second pass: extract @relation annotations with fields and references
        for (const line of lines) {
          const relMatch = line.match(/\s+(\w+)\s+(\w+)(\??)\s+@relation\((.*fields:\s*\[(\w+)\])/);
          if (relMatch) {
            const relField = relMatch[1];
            const targetModel = relMatch[2];
            const isOptionalRel = relMatch[3] === '?';
            const fkScalarField = relMatch[5];

            const scalarType = fieldTypes.get(fkScalarField) || '';
            const isRequiredFk = !scalarType.endsWith('?') && !isOptionalRel;

            if (targetModel !== modelName) {
              modelRelations.push({
                child: modelName,
                parent: targetModel,
                fkField: fkScalarField,
                isRequired: isRequiredFk,
              });
            }
          }
        }
      }

      // Check 1: DEMO_DELETION_ORDER must FAIL if any name is not a model in schema.prisma
      for (const orderName of DEMO_DELETION_ORDER) {
        expect(
          schemaModelNames.has(orderName),
          `DEMO_DELETION_ORDER contains entity "${orderName}" which is NOT a model in schema.prisma!`
        ).toBe(true);
      }

      // Check 2: DEMO_DELETION_ORDER must FAIL if any model in schema.prisma that has a required foreign key to a listed model is missing from the list
      const orderSet = new Set<string>(DEMO_DELETION_ORDER as readonly string[]);
      const checkedPairs: string[] = [];

      for (const rel of modelRelations) {
        if (orderSet.has(rel.parent) && rel.isRequired) {
          expect(
            orderSet.has(rel.child),
            `Model "${rel.child}" has a required foreign key (${rel.fkField}) to listed model "${rel.parent}" but is MISSING from DEMO_DELETION_ORDER!`
          ).toBe(true);
        }
      }

      // Check 3: Print all checked relation pairs and verify child appears before parent when both are in DEMO_DELETION_ORDER
      console.log('--- SCHEMA FOREIGN KEY RELATION PAIRS CHECKED ---');
      for (const rel of modelRelations) {
        const childInList = orderSet.has(rel.child);
        const parentInList = orderSet.has(rel.parent);
        const pairDesc = `${rel.child}.${rel.fkField} -> ${rel.parent} (${rel.isRequired ? 'REQUIRED' : 'OPTIONAL'}) [child in list: ${childInList}, parent in list: ${parentInList}]`;
        checkedPairs.push(pairDesc);
        console.log(`  [FK CHECK] ${pairDesc}`);

        if (childInList && parentInList) {
          const childIdx = DEMO_DELETION_ORDER.indexOf(rel.child as any);
          const parentIdx = DEMO_DELETION_ORDER.indexOf(rel.parent as any);
          expect(
            childIdx,
            `Foreign key order violation in DEMO_DELETION_ORDER: child "${rel.child}" (index ${childIdx}) references parent "${rel.parent}" (index ${parentIdx}), so child MUST be deleted BEFORE parent!`
          ).toBeLessThan(parentIdx);
        }
      }
      console.log(`Total schema relation pairs verified: ${checkedPairs.length}`);
      expect(checkedPairs.length).toBeGreaterThanOrEqual(15);
    });

    // ITEM 3 TEST: demoRemove.ts deletes models in the exact sequence of DEMO_DELETION_ORDER
    it('verifies demoRemove.ts deletes models in the exact sequence defined by DEMO_DELETION_ORDER', () => {
      const demoRemovePath = path.resolve(__dirname, '../../scripts/demoRemove.ts');
      const content = fs.readFileSync(demoRemovePath, 'utf-8');

      // Extract all tx.<model>.deleteMany calls inside the transaction
      const matches = [...content.matchAll(/tx\.(\w+)\.deleteMany\(/g)];
      const modelsInRemove = matches.map((m) => {
        const raw = m[1];
        return raw.charAt(0).toUpperCase() + raw.slice(1);
      });

      expect(modelsInRemove).toHaveLength(DEMO_DELETION_ORDER.length);
      expect(modelsInRemove).toEqual([...DEMO_DELETION_ORDER]);
    });
  });

  describe('Demo Data Model Specifications', () => {
    it('defines exactly 6 role-aligned demo users with proper invariants', () => {
      expect(DEMO_USERS).toHaveLength(6);
      const usernames = DEMO_USERS.map((u) => u.username);
      expect(usernames).toEqual([
        'demo_admin',
        'demo_hr',
        'demo_pm',
        'demo_dev',
        'demo_designer',
        'demo_viewer',
      ]);

      for (const user of DEMO_USERS) {
        expect(user.username.startsWith('demo_')).toBe(true);
        expect(user.employeeCode.startsWith('DEMO-')).toBe(true);
        expect(user.standardShiftHours).toBe(8);
        expect(user.workingDaysPerWeek).toBe(5);
      }
    });

    it('assigns two work roles each to demo_dev and demo_designer', () => {
      expect(DEMO_WORK_ROLES).toHaveLength(4);
      for (const role of DEMO_WORK_ROLES) {
        expect(role.name.startsWith('[DEMO] ')).toBe(true);
      }

      const devRoles = DEMO_WORK_ROLES.filter((r) => r.assignedUsernames.includes('demo_dev'));
      expect(devRoles).toHaveLength(2);
      expect(devRoles.map((r) => r.name)).toEqual([
        '[DEMO] Full Stack Engineering',
        '[DEMO] Quality Assurance & Testing',
      ]);

      const designerRoles = DEMO_WORK_ROLES.filter((r) => r.assignedUsernames.includes('demo_designer'));
      expect(designerRoles).toHaveLength(2);
      expect(designerRoles.map((r) => r.name)).toEqual([
        '[DEMO] UI/UX Design',
        '[DEMO] Quality Assurance & Testing',
      ]);
    });

    it('confirms demo_admin is a member of no projects, and non-member employees exist', () => {
      const projects = getDemoProjects();
      expect(projects).toHaveLength(4);

      // demo_admin is member of 0 projects
      for (const p of projects) {
        const hasAdmin = p.members.some((m) => m.username === 'demo_admin');
        expect(hasAdmin).toBe(false);
      }

      // Non-member employee checks:
      // demo_designer is not a member of Valley Transit App (p[1]) or Solar Grid (p[3])
      const transitMembers = projects[1].members.map((m) => m.username);
      expect(transitMembers).not.toContain('demo_designer');

      // demo_dev is not a member of Heritage Preservation Archive (p[2])
      const heritageMembers = projects[2].members.map((m) => m.username);
      expect(heritageMembers).not.toContain('demo_dev');

      // Project viewer exists on project 0
      const disasterViewers = projects[0].members.filter((m) => m.role === 'viewer');
      expect(disasterViewers).toHaveLength(1);
      expect(disasterViewers[0].username).toBe('demo_viewer');
    });

    it('verifies milestones include completed, overdue incomplete, and empty milestones', () => {
      const projects = getDemoProjects();
      const allMilestones = projects.flatMap((p) =>
        p.milestones.map((m) => ({
          ...m,
          taskCount: p.tasks.filter((t) => t.milestoneName === m.name).length,
        }))
      );

      // Completed milestones (completedAtOffsetDays set)
      const completed = allMilestones.filter((m) => m.completedAtOffsetDays !== undefined);
      expect(completed.length).toBeGreaterThanOrEqual(2);

      // Overdue incomplete milestone (dueDate in past, completedAt unset)
      const overdueIncomplete = allMilestones.filter(
        (m) => m.dueDateOffsetDays < 0 && m.completedAtOffsetDays === undefined
      );
      expect(overdueIncomplete.length).toBeGreaterThanOrEqual(1);

      // Empty milestone (0 tasks attached)
      const empty = allMilestones.filter((m) => m.taskCount === 0);
      expect(empty.length).toBeGreaterThanOrEqual(1);
      expect(empty[0].name).toBe('Phase 3 Post-Monsoon Impact Assessment');
    });

    it('verifies tasks cover all requested breakdown dimensions (>= 55 tasks in Project 1, ~65 total)', () => {
      const projects = getDemoProjects();
      const disasterTasks = projects[0].tasks;
      const allTasks = projects.flatMap((p) => p.tasks);

      // Project 1 tasks volume >= 55 for 50-item pagination testing
      expect(disasterTasks.length).toBeGreaterThanOrEqual(55);
      expect(allTasks.length).toBeGreaterThanOrEqual(60);

      // Real overdue tasks (NOT DONE!)
      const overdue30 = allTasks.find((t) => t.key === 'disaster-overdue-30');
      expect(overdue30).toBeDefined();
      expect(overdue30!.status).toBe('todo'); // NOT done!
      expect(overdue30!.dueDateOffsetDays).toBe(-30);

      const overdue7 = allTasks.find((t) => t.key === 'disaster-overdue-7');
      expect(overdue7).toBeDefined();
      expect(overdue7!.status).toBe('blocked'); // NOT done!
      expect(overdue7!.dueDateOffsetDays).toBe(-7);

      const overdue1 = allTasks.find((t) => t.key === 'disaster-overdue-1');
      expect(overdue1).toBeDefined();
      expect(overdue1!.status).toBe('in_progress'); // NOT done!
      expect(overdue1!.dueDateOffsetDays).toBe(-1);

      // Due today (NOT done)
      const dueToday = allTasks.find((t) => t.key === 'disaster-due-today');
      expect(dueToday).toBeDefined();
      expect(dueToday!.status).toBe('in_progress'); // NOT done!
      expect(dueToday!.dueDateOffsetDays).toBe(0);

      // Due tomorrow
      const dueTomorrow = allTasks.find((t) => t.key === 'disaster-due-tomorrow');
      expect(dueTomorrow).toBeDefined();
      expect(dueTomorrow!.dueDateOffsetDays).toBe(1);

      // No due date
      const noDueDate = allTasks.find((t) => t.key === 'disaster-nodate-1');
      expect(noDueDate).toBeDefined();
      expect(noDueDate!.dueDateOffsetDays).toBeUndefined();

      // Created by member (not manager)
      const memberCreated = allTasks.find((t) => t.key === 'disaster-member-created');
      expect(memberCreated).toBeDefined();
      expect(memberCreated!.creatorUsername).toBe('demo_designer');
      expect(memberCreated!.creatorUsername).not.toBe('demo_pm');
      expect(memberCreated!.title).toContain('नेपाल विपद् व्यवस्थापन'); // Devanagari title!

      // Subtasks
      const subtasks = allTasks.filter((t) => t.parentTaskKey !== undefined);
      expect(subtasks.length).toBeGreaterThanOrEqual(2);
    });

    it('defines 4 demo projects prefixed with [DEMO] including hostile text and status events', () => {
      const projects = getDemoProjects();
      expect(projects).toHaveLength(4);

      for (const p of projects) {
        expect(p.name.startsWith('[DEMO] ')).toBe(true);
      }

      // Check hostile title length is exactly 200 characters
      expect(DEMO_HOSTILE_TITLE_200.length).toBe(200);
      expect(DEMO_HOSTILE_TITLE_200).toContain('<script>alert(1)</script>');
      expect(DEMO_HOSTILE_TITLE_200).toContain('<b>bold</b>');

      // Check hostile markdown description length is at most 5000 characters and between 4990 and 5000
      const markdown5000 = generateHostileMarkdown5000();
      expect(markdown5000.length).toBeGreaterThanOrEqual(4990);
      expect(markdown5000.length).toBeLessThanOrEqual(5000);
      expect(markdown5000).toContain('<script>alert(1)</script>');
      expect(markdown5000).toContain('नेपाल विपद् व्यवस्थापन पोर्टल');

      // Check projects with non-default status have status events
      const nonDefaultProjects = projects.filter((p) => p.status !== 'on_track');
      expect(nonDefaultProjects.length).toBe(3);
      for (const p of nonDefaultProjects) {
        expect(p.statusEvents).toBeDefined();
        expect(p.statusEvents!.length).toBeGreaterThanOrEqual(1);
        expect(p.statusEvents![0].reason.length).toBeGreaterThan(10);
      }
    });

    it('asserts exact boundary lengths: long title is exactly 200 characters and long description is 4990 to 5000 characters', () => {
      // Long title: exactly 200 characters
      expect(DEMO_HOSTILE_TITLE_200.length).toBe(200);

      // Long description: at most 5000 characters, between 4990 and 5000
      const desc = generateHostileMarkdown5000();
      expect(desc.length).toBeGreaterThanOrEqual(4990);
      expect(desc.length).toBeLessThanOrEqual(5000);
    });

    it('verifies project messages include >= 55 in Project 1 and 8 messages in other projects with 2 pinned', () => {
      const projects = getDemoProjects();
      const disasterMsgs = projects[0].messages;

      // Project 1 messages volume >= 55 for 50-item pagination testing
      expect(disasterMsgs.length).toBeGreaterThanOrEqual(55);

      // Other projects messages volume = 8 with 2 pinned
      const otherProjectMsgs = projects.slice(1).flatMap((p) => p.messages);
      expect(otherProjectMsgs).toHaveLength(8);
      const otherPinned = otherProjectMsgs.filter((m) => m.isPinned);
      expect(otherPinned).toHaveLength(2);

      // Multi-line message
      const multiLine = disasterMsgs.filter((m) => m.body.includes('\n'));
      expect(multiLine.length).toBeGreaterThanOrEqual(1);

      // Short message
      const shortMsgs = disasterMsgs.filter((m) => m.body.length < 100);
      expect(shortMsgs.length).toBeGreaterThanOrEqual(1);

      // Devanagari message
      const devanagari = disasterMsgs.filter((m) => m.body.includes('मेलम्ची'));
      expect(devanagari.length).toBeGreaterThanOrEqual(1);
    });

    it('verifies comments on different tasks contain hostile text and Devanagari', () => {
      const projects = getDemoProjects();
      const allComments = projects.flatMap((p) => p.comments);

      // At least 8-10 comments on different tasks
      expect(allComments.length).toBeGreaterThanOrEqual(8);
      const uniqueTasks = new Set(allComments.map((c) => c.taskKey));
      expect(uniqueTasks.size).toBeGreaterThanOrEqual(8);

      // Comment with raw bold and script
      const hostileComment = allComments.find(
        (c) => c.body.includes('<b>bold</b>') && c.body.includes('<script>alert(1)</script>')
      );
      expect(hostileComment).toBeDefined();

      // Comment with Devanagari
      const devanagariComment = allComments.find((c) => c.body.includes('टिप्पणी'));
      expect(devanagariComment).toBeDefined();
    });

    it('verifies 14 days of time logs for demo_dev, demo_designer, and demo_pm', () => {
      const projects = getDemoProjects();
      const allTimeLogs = projects.flatMap((p) => p.timeLogs);

      for (const username of ['demo_dev', 'demo_designer', 'demo_pm']) {
        const userLogs = allTimeLogs.filter((l) => l.username === username);
        const uniqueOffsets = new Set(userLogs.map((l) => l.workDateOffsetDays));
        expect(uniqueOffsets.size).toBe(14); // Exactly 14 distinct days!
        for (let offset = -13; offset <= 0; offset++) {
          expect(uniqueOffsets.has(offset)).toBe(true);
        }
      }
    });

    it('verifies 10 days of work logs in mixed statuses for demo_dev and demo_designer', () => {
      const workLogs = getDemoWorkLogs();

      // Exactly 10 days each
      const devLogs = workLogs.filter((l) => l.username === 'demo_dev');
      expect(devLogs).toHaveLength(10);
      const designerLogs = workLogs.filter((l) => l.username === 'demo_designer');
      expect(designerLogs).toHaveLength(10);

      // Mixed statuses
      const allStatuses = new Set(workLogs.map((l) => l.status));
      expect(allStatuses.has('approved')).toBe(true);
      expect(allStatuses.has('submitted')).toBe(true);
      expect(allStatuses.has('rejected')).toBe(true);
      expect(allStatuses.has('draft')).toBe(true);

      // Rejection reason populated on rejected logs
      const rejected = workLogs.filter((l) => l.status === 'rejected');
      expect(rejected.length).toBeGreaterThanOrEqual(2);
      for (const r of rejected) {
        expect(r.rejectionReason).toBeDefined();
        expect(r.rejectionReason!.length).toBeGreaterThan(10);
      }

      // Exactly 4 linked entries referencing demo projects and tasks
      const allEntries = workLogs.flatMap((wld) => wld.entries);
      const linkedEntries = allEntries.filter((e) => e.linkProjectName && e.linkTaskKey);
      expect(linkedEntries).toHaveLength(4);
    });

    it('verifies every owner of the 4 linked WorkLogEntry rows is a current member of the linked project', () => {
      const workLogs = getDemoWorkLogs();
      const projects = getDemoProjects();

      const linkedEntriesWithUser: Array<{
        username: string;
        dateOffset: number;
        projectName: string;
        taskKey: string;
      }> = [];

      for (const day of workLogs) {
        for (const entry of day.entries) {
          if (entry.linkProjectName && entry.linkTaskKey) {
            linkedEntriesWithUser.push({
              username: day.username,
              dateOffset: day.dateOffsetDays,
              projectName: entry.linkProjectName,
              taskKey: entry.linkTaskKey,
            });
          }
        }
      }

      expect(linkedEntriesWithUser).toHaveLength(4);

      for (const item of linkedEntriesWithUser) {
        const proj = projects.find((p) => p.name === item.projectName);
        expect(proj, `Project ${item.projectName} not found`).toBeDefined();

        // Check current membership (exclude former members whose membership row is deleted)
        const currentMember = proj!.members.find((m) => m.username === item.username && !m.isFormerMember);
        expect(
          currentMember,
          `Owner "${item.username}" must be a current member of linked project "${item.projectName}"!`
        ).toBeDefined();

        // Check that linked task exists in the project
        const task = proj!.tasks.find((t) => t.key === item.taskKey);
        expect(task, `Task ${item.taskKey} not found in project ${item.projectName}`).toBeDefined();
      }
    });

    it('includes a former member configuration with preserved historical contributions', () => {
      const projects = getDemoProjects();
      const disasterProj = projects.find((p) => p.name.includes('Disaster Relief'))!;
      const formerMember = disasterProj.members.find((m) => m.isFormerMember);

      expect(formerMember).toBeDefined();
      expect(formerMember!.username).toBe('demo_dev');

      // Confirm user has tasks, comments, time logs, and messages on the project
      const tasksByFormer = disasterProj.tasks.filter((t) => t.assigneeUsername === formerMember!.username);
      expect(tasksByFormer.length).toBeGreaterThanOrEqual(1);

      const commentsByFormer = disasterProj.comments.filter((c) => c.authorUsername === formerMember!.username);
      expect(commentsByFormer.length).toBeGreaterThanOrEqual(1);

      const logsByFormer = disasterProj.timeLogs.filter((tl) => tl.username === formerMember!.username);
      expect(logsByFormer.length).toBeGreaterThanOrEqual(1);

      const msgsByFormer = disasterProj.messages.filter((m) => m.authorUsername === formerMember!.username);
      expect(msgsByFormer.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Shared Demo Record Lookup & Mocked Status vs Remove Task Equality (Item 1 tests)', () => {
    it('finds demo tasks consistently (including tasks assigned to demo users) and status counts for tasks equal number removed in a mocked run', async () => {
      // Mock data representing database state
      const mockUsers = [
        { id: 'u-demo-1', username: 'demo_dev' },
        { id: 'u-real-1', username: 'real_staff' },
      ];
      const mockProfiles = [
        { id: 'p-demo-1', userId: 'u-demo-1', employeeCode: 'DEMO-DEV' },
        { id: 'p-real-1', userId: 'u-real-1', employeeCode: 'EMP-001' },
      ];
      const mockRoles = [
        { id: 'r-demo-1', name: '[DEMO] Full Stack' },
        { id: 'r-real-1', name: 'Software Engineer' },
      ];
      const mockProjects = [
        { id: 'proj-demo-1', name: '[DEMO] Disaster Relief', createdByUserId: 'u-demo-1' },
        { id: 'proj-real-1', name: 'Real Operations', createdByUserId: 'u-real-1' },
      ];
      // Tasks:
      // t1: in demo project (proj-demo-1)
      // t2: created by demo user in real project (proj-real-1, createdBy: u-demo-1)
      // t3: assigned to demo user in real project (proj-real-1, assignee: u-demo-1, createdBy: u-real-1)
      // t4: purely real non-demo task (proj-real-1, createdBy: u-real-1, assignee: u-real-1)
      const mockTasks = [
        { id: 't1', projectId: 'proj-demo-1', createdByUserId: 'u-real-1', assigneeUserId: null },
        { id: 't2', projectId: 'proj-real-1', createdByUserId: 'u-demo-1', assigneeUserId: 'u-real-1' },
        { id: 't3', projectId: 'proj-real-1', createdByUserId: 'u-real-1', assigneeUserId: 'u-demo-1' },
        { id: 't4', projectId: 'proj-real-1', createdByUserId: 'u-real-1', assigneeUserId: 'u-real-1' },
      ];
      const mockWorkLogDays = [
        { id: 'wld-demo-1', employeeProfileId: 'p-demo-1' },
        { id: 'wld-real-1', employeeProfileId: 'p-real-1' },
      ];

      const deletedTaskIds: string[] = [];
      const mockClient = {
        user: {
          findMany: async ({ where }: any) =>
            mockUsers.filter((u) => u.username.startsWith('demo_')).map((u) => ({ id: u.id })),
        },
        employeeProfile: {
          findMany: async ({ where }: any) =>
            mockProfiles
              .filter((p) =>
                where.OR.some(
                  (cond: any) =>
                    cond.userId?.in?.includes(p.userId) ||
                    (cond.employeeCode?.startsWith && p.employeeCode.startsWith('DEMO-'))
                )
              )
              .map((p) => ({ id: p.id })),
        },
        workRole: {
          findMany: async ({ where }: any) =>
            mockRoles.filter((r) => r.name.startsWith('[DEMO] ')).map((r) => ({ id: r.id })),
        },
        project: {
          findMany: async ({ where }: any) =>
            mockProjects
              .filter(
                (pr) =>
                  pr.name.startsWith('[DEMO] ') ||
                  where.OR.some((cond: any) => cond.createdByUserId?.in?.includes(pr.createdByUserId))
              )
              .map((pr) => ({ id: pr.id })),
        },
        task: {
          findMany: async ({ where }: any) => {
            const orConds = where.OR;
            return mockTasks
              .filter((t) =>
                orConds.some(
                  (cond: any) =>
                    (cond.projectId?.in && cond.projectId.in.includes(t.projectId)) ||
                    (cond.createdByUserId?.in && cond.createdByUserId.in.includes(t.createdByUserId)) ||
                    (cond.assigneeUserId?.in && cond.assigneeUserId.in.includes(t.assigneeUserId))
                )
              )
              .map((t) => ({ id: t.id }));
          },
          deleteMany: async ({ where }: any) => {
            const idsToDelete = where.id.in as string[];
            deletedTaskIds.push(...idsToDelete);
            return { count: idsToDelete.length };
          },
        },
        workLogDay: {
          findMany: async ({ where }: any) =>
            mockWorkLogDays
              .filter((d) => where.employeeProfileId?.in?.includes(d.employeeProfileId))
              .map((d) => ({ id: d.id })),
        },
      };

      // 1. Shared lookup used by both demoStatus.ts and demoRemove.ts
      const demoRecordIds = await findDemoRecordIds(mockClient);

      // Verify that t1 (demo project), t2 (created by demo user), and t3 (assigned to demo user) are all identified
      expect(demoRecordIds.demoTaskIds).toContain('t1');
      expect(demoRecordIds.demoTaskIds).toContain('t2');
      expect(demoRecordIds.demoTaskIds).toContain('t3');
      expect(demoRecordIds.demoTaskIds).not.toContain('t4');
      expect(demoRecordIds.demoTaskIds).toHaveLength(3);

      // 2. Status count calculation in demoStatus.ts
      const statusTaskCount = demoRecordIds.demoTaskIds.length;
      expect(statusTaskCount).toBe(3);

      // 3. Remove execution in demoRemove.ts
      const removalResult = await mockClient.task.deleteMany({
        where: { id: { in: demoRecordIds.demoTaskIds } },
      });
      const removedTaskCount = removalResult.count;
      expect(removedTaskCount).toBe(3);

      // 4. Assert status counts for tasks equal the number removed
      expect(statusTaskCount).toBe(removedTaskCount);
      expect(deletedTaskIds).toEqual(demoRecordIds.demoTaskIds);
    });
  });

  describe('Full Real Seed Definitions End-to-End Validation (Item 4 tests)', () => {
    it('builds the full real seed definitions and runs them through every validator without any errors', () => {
      // 1. Build real seed definitions
      const users = DEMO_USERS;
      const workRoles = DEMO_WORK_ROLES;
      const projects = DEMO_PROJECTS;
      const workLogs = DEMO_WORK_LOG_DAYS;
      const hostileTitle = DEMO_HOSTILE_TITLE_200;
      const hostileDesc = generateHostileMarkdown5000();

      expect(users.length).toBeGreaterThanOrEqual(6);
      expect(workRoles.length).toBeGreaterThanOrEqual(3);
      expect(projects.length).toBeGreaterThanOrEqual(4);

      // 2. Validate all projects' time logs aggregated together
      const allPlannedTimeLogs = projects.flatMap((proj) =>
        proj.timeLogs.map((tl) => ({
          userId: tl.username,
          workDate: getKathmanduOffsetDate(tl.workDateOffsetDays),
          hours: tl.hours,
        }))
      );
      expect(allPlannedTimeLogs.length).toBeGreaterThan(0);
      const timeLogValidation = validatePlannedTimeLogs(allPlannedTimeLogs);
      if (!timeLogValidation.valid) {
        throw new Error(`Time log validation failed: ${timeLogValidation.errors.join('; ')}`);
      }
      expect(timeLogValidation.valid).toBe(true);
      expect(timeLogValidation.errors).toEqual([]);

      // 3. Validate planned work logs across users, dates, caps, roles, and project/task links
      const workLogValidation = validatePlannedWorkLogs(workLogs, workRoles, projects);
      if (!workLogValidation.valid) {
        throw new Error(`Work log validation failed: ${workLogValidation.errors.join('; ')}`);
      }
      expect(workLogValidation.valid).toBe(true);
      expect(workLogValidation.errors).toEqual([]);

      // 4. Validate dependency graphs across all projects (no self-loops, no cycles)
      for (const project of projects) {
        const depValidation = validateDependencyGraph(
          project.dependencies.map((d) => ({
            taskId: d.taskKey,
            dependsOnTaskId: d.dependsOnTaskKey,
          }))
        );
        if (!depValidation.valid) {
          throw new Error(
            `Dependency validation failed for project ${project.name}: ${depValidation.errors.join('; ')}`
          );
        }
        expect(depValidation.valid).toBe(true);
        expect(depValidation.errors).toEqual([]);
      }

      // 5. Validate the 200 character title
      expect(hostileTitle.length).toBe(200);

      // 6. Validate the 4990 to 5000 character description
      expect(hostileDesc.length).toBeGreaterThanOrEqual(4990);
      expect(hostileDesc.length).toBeLessThanOrEqual(5000);

      // 7. Validate project roles from the real Prisma enum
      const validProjectRoles = Object.values(ProjectRole);
      for (const project of projects) {
        for (const member of project.members) {
          expect(
            validProjectRoles.includes(member.role as any),
            `Member role "${member.role}" in project "${project.name}" must be a valid ProjectRole enum value`
          ).toBe(true);
        }
      }
    });
  });
});

