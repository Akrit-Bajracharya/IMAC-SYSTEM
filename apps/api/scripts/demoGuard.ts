/**
 * demoGuard.ts
 *
 * Guard validation and pure helper routines for IMAC demo data management.
 * Adheres strictly to the hard safety rules:
 * - Never runs in production.
 * - Requires explicit ALLOW_DEMO_DATA=yes.
 * - Requires localhost / 127.0.0.1 database host.
 * - Requires the database name to be exactly "imac_demo".
 * - DEMO_PASSWORD is required only by demoSeed.ts and must satisfy real password policy length (>= 10).
 * - Never prints or returns connection strings, credentials, or sensitive tokens.
 */

// Minimum password length from real system policy (SystemSetting key 'auth.minPasswordLength', seeded as 10)
export const MIN_PASSWORD_LENGTH = 10;

export interface DemoGuardResult {
  allowed: boolean;
  reason?: string;
}

export interface DemoGuardOptions {
  requirePassword?: boolean;
}

export { findDemoRecordIds } from './demoLookup.js';
export type { DemoRecordIds, DemoLookupClient } from './demoLookup.js';

export interface DemoDatabaseClient {
  $queryRaw: (...args: any[]) => Promise<any>;
}

/**
 * Asserts that the Prisma client is connected to the exact database 'imac_demo'.
 * Queries SELECT current_database() via prisma.$queryRaw and throws unless the result
 * contains exactly one row with the key 'current_database' strictly equal to 'imac_demo'.
 * Never prints connection strings, passwords, or credentials in error messages.
 */
export async function assertConnectedToDemoDatabase(
  prisma: DemoDatabaseClient
): Promise<void> {
  let result: any;
  try {
    result = await prisma.$queryRaw`SELECT current_database()`;
  } catch {
    throw new Error('Database safety check failed: unable to query current database');
  }

  if (!Array.isArray(result) || result.length !== 1) {
    throw new Error(
      `Database safety guard violation: unexpected current_database query result structure (expected 1 row, got ${Array.isArray(result) ? result.length : typeof result})`
    );
  }

  const row = result[0];
  if (!row || typeof row !== 'object' || !('current_database' in row)) {
    throw new Error(
      'Database safety guard violation: current_database column missing in database query result'
    );
  }

  const dbName = row.current_database;
  if (dbName !== 'imac_demo') {
    throw new Error(
      `Database safety guard violation: connected database must be exactly "imac_demo", but got "${dbName ?? 'unknown'}"`
    );
  }
}

/**
 * Validates the runtime environment against safety rules before executing any demo operations.
 */
export function validateDemoEnvironment(
  env: Record<string, string | undefined>,
  options: DemoGuardOptions = { requirePassword: true }
): DemoGuardResult {
  if (env.ALLOW_DEMO_DATA !== 'yes') {
    return {
      allowed: false,
      reason: 'ALLOW_DEMO_DATA environment variable must be explicitly set to "yes"',
    };
  }

  if (env.NODE_ENV === 'production') {
    return {
      allowed: false,
      reason: 'Demo data tooling cannot be executed in production environment (NODE_ENV=production)',
    };
  }

  if (!env.DATABASE_URL) {
    return {
      allowed: false,
      reason: 'DATABASE_URL environment variable is not set',
    };
  }

  // Refuse URLs with leading or trailing whitespace
  if (env.DATABASE_URL !== env.DATABASE_URL.trim()) {
    return {
      allowed: false,
      reason: 'DATABASE_URL contains forbidden leading or trailing whitespace',
    };
  }

  let parsed: URL;
  try {
    parsed = new URL(env.DATABASE_URL);
  } catch {
    return {
      allowed: false,
      reason: 'DATABASE_URL is not a valid URL format',
    };
  }

  // Refuse URLs with query parameters attempting to override host/socket
  if (
    parsed.searchParams.has('host') ||
    parsed.searchParams.has('hostaddr') ||
    parsed.searchParams.has('socket')
  ) {
    return {
      allowed: false,
      reason: 'DATABASE_URL contains forbidden query parameter override (host, hostaddr, or socket)',
    };
  }

  // Host verification: only localhost or 127.0.0.1
  const hostname = parsed.hostname.toLowerCase();
  if (hostname !== 'localhost' && hostname !== '127.0.0.1') {
    return {
      allowed: false,
      reason: 'Database host must be localhost or 127.0.0.1 for demo data execution',
    };
  }

  // Port verification: if port is provided, it must be numeric
  if (parsed.port && !/^\d+$/.test(parsed.port)) {
    return {
      allowed: false,
      reason: 'Database port in DATABASE_URL must be numeric',
    };
  }

  // Database name verification: decoded pathname must be exactly 'imac_demo'
  const rawPath = parsed.pathname.replace(/^\//, '').split('?')[0];
  let dbName: string;
  try {
    dbName = decodeURIComponent(rawPath);
  } catch {
    return {
      allowed: false,
      reason: 'Database name in DATABASE_URL contains invalid URL encoding',
    };
  }
  if (dbName !== 'imac_demo') {
    return {
      allowed: false,
      reason: 'Database name in DATABASE_URL must be exactly "imac_demo"',
    };
  }

  // Password verification against real system policy (only if required by caller)
  const requirePassword = options.requirePassword ?? true;
  if (requirePassword) {
    if (!env.DEMO_PASSWORD || env.DEMO_PASSWORD.length < MIN_PASSWORD_LENGTH) {
      return {
        allowed: false,
        reason: `DEMO_PASSWORD must be provided and must be at least ${MIN_PASSWORD_LENGTH} characters long`,
      };
    }
  }

  return { allowed: true };
}

/**
 * Derives Kathmandu today's date formatted as YYYY-MM-DD.
 */
export function getKathmanduToday(clockDate: Date = new Date()): string {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kathmandu',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return formatter.format(clockDate);
}

/**
 * Derives a date in Kathmandu offset by offsetDays from today formatted as YYYY-MM-DD.
 */
export function getKathmanduOffsetDate(offsetDays: number, clockDate: Date = new Date()): string {
  const kathmanduStr = getKathmanduToday(clockDate);
  const [year, month, day] = kathmanduStr.split('-').map(Number);
  const utcDate = new Date(Date.UTC(year, month - 1, day));
  utcDate.setUTCDate(utcDate.getUTCDate() + offsetDays);
  const y = utcDate.getUTCFullYear();
  const m = String(utcDate.getUTCMonth() + 1).padStart(2, '0');
  const d = String(utcDate.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Resolves an optional offset in days to a Date object set at UTC midnight for the Kathmandu calendar date,
 * or null if offset is undefined or null.
 * Safely handles 0 (e.g. due today) without falsy coercion.
 */
export function resolveOffsetDate(
  offsetDays: number | undefined | null,
  clockDate: Date = new Date()
): Date | null {
  if (offsetDays === undefined || offsetDays === null) {
    return null;
  }
  const dateStr = getKathmanduOffsetDate(offsetDays, clockDate);
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

export interface PlannedTimeLog {
  userId: string;
  workDate: string; // 'YYYY-MM-DD'
  hours: number;
}

/**
 * Validates that planned time logs obey the Kathmandu submission window (-90 to +1 days),
 * 0.25 hour increments, and do not exceed 24 total hours per user per calendar day.
 */
export function validatePlannedTimeLogs(
  logs: PlannedTimeLog[],
  clockDate: Date = new Date()
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  const minDate = getKathmanduOffsetDate(-90, clockDate);
  const maxDate = getKathmanduOffsetDate(1, clockDate);

  const dailyUserHours = new Map<string, number>();

  for (const log of logs) {
    if (log.workDate < minDate) {
      errors.push(`Time log for user ${log.userId} on ${log.workDate} is older than allowed window (${minDate})`);
    }
    if (log.workDate > maxDate) {
      errors.push(`Time log for user ${log.userId} on ${log.workDate} is beyond allowed window (${maxDate})`);
    }
    if (log.hours <= 0) {
      errors.push(`Time log hours must be positive: got ${log.hours}`);
    }
    if (Math.abs(log.hours * 4 - Math.round(log.hours * 4)) >= 1e-9) {
      errors.push(`Time log hours must be in 0.25 increments: got ${log.hours} for user ${log.userId} on ${log.workDate}`);
    }

    const key = `${log.userId}:${log.workDate}`;
    const current = dailyUserHours.get(key) || 0;
    dailyUserHours.set(key, current + log.hours);
  }

  for (const [key, total] of dailyUserHours.entries()) {
    if (total > 24) {
      const [userId, date] = key.split(':');
      errors.push(`User ${userId} exceeds 24 daily hours on ${date} (total: ${total}h)`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

export interface PlannedWorkLogEntry {
  workRoleName: string;
  hours: number;
  description: string;
  linkProjectName?: string;
  linkTaskKey?: string;
}

export interface PlannedWorkLogDay {
  username: string;
  dateOffsetDays: number;
  entries: PlannedWorkLogEntry[];
}

export interface DemoProjectContext {
  name: string;
  members: Array<{ username: string; isFormerMember?: boolean }>;
  tasks: Array<{ key: string }>;
}

export interface DemoWorkRoleContext {
  name: string;
  assignedUsernames: string[];
}

/**
 * Pure validator for planned work log days:
 * - One day per user per date.
 * - Entries total at most 24h per day (and positive, 0.25h increments).
 * - Every entry's work role is assigned to that user.
 * - Project and task links belong together and user is a current member (after former-member deletion).
 */
export function validatePlannedWorkLogs(
  workLogs: PlannedWorkLogDay[],
  roles: DemoWorkRoleContext[],
  projects: DemoProjectContext[]
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  const seenUserDates = new Set<string>();

  const userRolesMap = new Map<string, Set<string>>();
  for (const role of roles) {
    for (const u of role.assignedUsernames) {
      if (!userRolesMap.has(u)) {
        userRolesMap.set(u, new Set());
      }
      userRolesMap.get(u)!.add(role.name);
    }
  }

  const projectMap = new Map<string, DemoProjectContext>();
  for (const p of projects) {
    projectMap.set(p.name, p);
  }

  for (const day of workLogs) {
    // 1. One day per user per date
    const userDateKey = `${day.username}:${day.dateOffsetDays}`;
    if (seenUserDates.has(userDateKey)) {
      errors.push(`Duplicate work log day detected for user ${day.username} on date offset ${day.dateOffsetDays}`);
    }
    seenUserDates.add(userDateKey);

    // 2. Entries total at most 24
    let totalDayHours = 0;
    for (const entry of day.entries) {
      if (entry.hours <= 0) {
        errors.push(`Work log entry hours must be positive: got ${entry.hours} for user ${day.username}`);
      }
      if (Math.abs(entry.hours * 4 - Math.round(entry.hours * 4)) >= 1e-9) {
        errors.push(`Work log entry hours must be in 0.25 increments: got ${entry.hours} for user ${day.username}`);
      }
      totalDayHours += entry.hours;

      // 3. Every entry's work role is assigned to that user
      const assignedRoles = userRolesMap.get(day.username);
      if (!assignedRoles || !assignedRoles.has(entry.workRoleName)) {
        errors.push(
          `User ${day.username} is not assigned to work role "${entry.workRoleName}" on date offset ${day.dateOffsetDays}`
        );
      }

      // 4. Project and task links belong together and user is a current member (after former-member deletion)
      if (entry.linkProjectName || entry.linkTaskKey) {
        if (!entry.linkProjectName || !entry.linkTaskKey) {
          errors.push(
            `Work log entry for ${day.username} must provide both linkProjectName and linkTaskKey or neither`
          );
        } else {
          const proj = projectMap.get(entry.linkProjectName);
          if (!proj) {
            errors.push(`Linked project "${entry.linkProjectName}" does not exist in demo projects`);
          } else {
            const taskExists = proj.tasks.some((t) => t.key === entry.linkTaskKey);
            if (!taskExists) {
              errors.push(
                `Linked task "${entry.linkTaskKey}" does not belong to project "${entry.linkProjectName}"`
              );
            }

            const isCurrentMember = proj.members.some(
              (m) => m.username === day.username && !m.isFormerMember
            );
            if (!isCurrentMember) {
              errors.push(
                `User ${day.username} is not a current member of linked project "${entry.linkProjectName}" (after former-member cleanup)`
              );
            }
          }
        }
      }
    }

    if (totalDayHours > 24) {
      errors.push(
        `Work log day for user ${day.username} on date offset ${day.dateOffsetDays} exceeds 24 total hours: ${totalDayHours}h`
      );
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

export interface TaskDependencyDef {
  taskId: string;
  dependsOnTaskId: string;
}

/**
 * Validates task dependencies: prevents self-dependencies and cyclic dependencies.
 */
export function validateDependencyGraph(
  dependencies: TaskDependencyDef[]
): { valid: boolean; hasCycle: boolean; errors: string[] } {
  const errors: string[] = [];
  const adj = new Map<string, string[]>();

  for (const dep of dependencies) {
    if (dep.taskId === dep.dependsOnTaskId) {
      errors.push(`Self dependency detected on task ${dep.taskId}`);
    }
    if (!adj.has(dep.taskId)) {
      adj.set(dep.taskId, []);
    }
    adj.get(dep.taskId)!.push(dep.dependsOnTaskId);
  }

  // DFS cycle detection (0: unvisited, 1: visiting, 2: visited)
  const state = new Map<string, number>();
  let hasCycle = false;

  function dfs(node: string, path: string[]) {
    state.set(node, 1);
    const neighbors = adj.get(node) || [];
    for (const n of neighbors) {
      const s = state.get(n) || 0;
      if (s === 1) {
        hasCycle = true;
        errors.push(`Dependency cycle detected: ${[...path, node, n].join(' -> ')}`);
      } else if (s === 0) {
        dfs(n, [...path, node]);
      }
    }
    state.set(node, 2);
  }

  for (const node of adj.keys()) {
    if ((state.get(node) || 0) === 0) {
      dfs(node, []);
    }
  }

  return {
    valid: errors.length === 0,
    hasCycle,
    errors,
  };
}

/**
 * Standard deletion sequence: child entities deleted before parent entities.
 * Exactly matches the deletion sequence executed in demoRemove.ts.
 */
export const DEMO_DELETION_ORDER = [
  'WorkLogEntry',
  'WorkLogDay',
  'EmployeeWorkRole',
  'WorkRole',
  'Comment',
  'TaskDependency',
  'TimeLog',
  'ProjectMessage',
  'Task',
  'Milestone',
  'ProjectStatusEvent',
  'ProjectMember',
  'Project',
  'EmployeeProfile',
  'AvailabilityStatus',
  'Session',
  'AuditLog',
  'Notification',
  'User',
] as const;

export const PARENT_CHILD_RELATIONS: Array<{ child: string; parent: string }> = [
  { child: 'Comment', parent: 'Task' },
  { child: 'Comment', parent: 'User' },
  { child: 'TaskDependency', parent: 'Task' },
  { child: 'TimeLog', parent: 'Task' },
  { child: 'TimeLog', parent: 'Project' },
  { child: 'TimeLog', parent: 'User' },
  { child: 'ProjectMessage', parent: 'Project' },
  { child: 'ProjectMessage', parent: 'User' },
  { child: 'Task', parent: 'Milestone' },
  { child: 'Task', parent: 'Project' },
  { child: 'Task', parent: 'User' },
  { child: 'Milestone', parent: 'Project' },
  { child: 'ProjectStatusEvent', parent: 'Project' },
  { child: 'ProjectStatusEvent', parent: 'User' },
  { child: 'ProjectMember', parent: 'Project' },
  { child: 'ProjectMember', parent: 'User' },
  { child: 'Project', parent: 'User' },
  { child: 'WorkLogEntry', parent: 'WorkLogDay' },
  { child: 'WorkLogEntry', parent: 'WorkRole' },
  { child: 'WorkLogDay', parent: 'EmployeeProfile' },
  { child: 'EmployeeWorkRole', parent: 'EmployeeProfile' },
  { child: 'EmployeeWorkRole', parent: 'WorkRole' },
  { child: 'EmployeeProfile', parent: 'User' },
  { child: 'AvailabilityStatus', parent: 'User' },
  { child: 'Session', parent: 'User' },
  { child: 'AuditLog', parent: 'User' },
  { child: 'Notification', parent: 'User' },
];

/**
 * Verifies that every child entity index is strictly lower than its parent entity index in the deletion order list.
 */
export function validateDeletionOrder(
  order: readonly string[],
  relations: Array<{ child: string; parent: string }> = PARENT_CHILD_RELATIONS
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  for (const { child, parent } of relations) {
    const childIdx = order.indexOf(child);
    const parentIdx = order.indexOf(parent);
    if (childIdx === -1) {
      errors.push(`Child entity ${child} missing from deletion order`);
    }
    if (parentIdx === -1) {
      errors.push(`Parent entity ${parent} missing from deletion order`);
    }
    if (childIdx !== -1 && parentIdx !== -1 && childIdx > parentIdx) {
      errors.push(
        `Entity order violation: child ${child} (index ${childIdx}) appears AFTER parent ${parent} (index ${parentIdx})`
      );
    }
  }
  return {
    valid: errors.length === 0,
    errors,
  };
}
