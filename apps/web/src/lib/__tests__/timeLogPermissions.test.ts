import { describe, it, expect } from 'vitest';
import {
  canLogTime,
  canSeeTimeTab,
  canSeeTaskTimeLogs,
  canEditTimeLog,
  canDeleteTimeLog,
  canSeeAllTimeLogs,
  canFilterTimeLogsByUser,
  canViewWorkload,
} from '../timeLogPermissions.js';
import type { User, ProjectDetail, ProjectRole } from '../../types/index.js';

describe('timeLogPermissions table-driven capability tests', () => {
  const adminNoRow: User = {
    id: 'user-admin',
    username: 'admin',
    displayName: 'Admin User',
    systemRole: 'system_admin',
    mustChangePassword: false,
  };

  const adminWithRow: User = {
    id: 'user-admin-member',
    username: 'admin-member',
    displayName: 'Admin Member',
    systemRole: 'system_admin',
    mustChangePassword: false,
  };

  const managerUser: User = {
    id: 'user-manager',
    username: 'mgr',
    displayName: 'Manager User',
    systemRole: 'employee',
    mustChangePassword: false,
  };

  const memberAuthor: User = {
    id: 'user-member-1',
    username: 'm1',
    displayName: 'Member One',
    systemRole: 'employee',
    mustChangePassword: false,
  };

  const memberOther: User = {
    id: 'user-member-2',
    username: 'm2',
    displayName: 'Member Two',
    systemRole: 'employee',
    mustChangePassword: false,
  };

  const viewerUser: User = {
    id: 'user-viewer',
    username: 'view',
    displayName: 'Viewer User',
    systemRole: 'viewer',
    mustChangePassword: false,
  };

  const project: Pick<ProjectDetail, 'members'> = {
    members: [
      {
        id: 'pm-1',
        projectId: 'p-1',
        userId: adminWithRow.id,
        projectRole: 'manager',
        createdAt: '2026-01-01', addedByUserId: 'admin-1', updatedAt: '2026-01-01',
      },
      {
        id: 'pm-2',
        projectId: 'p-1',
        userId: managerUser.id,
        projectRole: 'manager',
        createdAt: '2026-01-01', addedByUserId: 'admin-1', updatedAt: '2026-01-01',
      },
      {
        id: 'pm-3',
        projectId: 'p-1',
        userId: memberAuthor.id,
        projectRole: 'member',
        createdAt: '2026-01-01', addedByUserId: 'admin-1', updatedAt: '2026-01-01',
      },
      {
        id: 'pm-4',
        projectId: 'p-1',
        userId: memberOther.id,
        projectRole: 'member',
        createdAt: '2026-01-01', addedByUserId: 'admin-1', updatedAt: '2026-01-01',
      },
      {
        id: 'pm-5',
        projectId: 'p-1',
        userId: viewerUser.id,
        projectRole: 'viewer',
        createdAt: '2026-01-01', addedByUserId: 'admin-1', updatedAt: '2026-01-01',
      },
    ],
  };

  const otherLog = { id: 'tl-other', userId: 'someone-else-id' };

  interface PermissionMatrixRow {
    roleName: string;
    user: User | null;
    projectRole: ProjectRole | undefined;
    canLog: boolean;
    canSeeTimeTab: boolean;
    canEditOwn: boolean;
    canEditOther: boolean;
    canDeleteOwn: boolean;
    canDeleteOther: boolean;
    canSeeAll: boolean;
    canFilterUser: boolean;
    canViewWorkload: boolean;
  }

  const matrix: PermissionMatrixRow[] = [
    {
      roleName: 'system_admin without member row',
      user: adminNoRow,
      projectRole: 'manager',
      canLog: false, // Refused without member row
      canSeeTimeTab: true, // Sees tab with notice
      canEditOwn: true,
      canEditOther: false, // Cannot edit other people's logs
      canDeleteOwn: true,
      canDeleteOther: false,
      canSeeAll: true,
      canFilterUser: true,
      canViewWorkload: true,
    },
    {
      roleName: 'system_admin with member row',
      user: adminWithRow,
      projectRole: 'manager',
      canLog: true,
      canSeeTimeTab: true,
      canEditOwn: true,
      canEditOther: false,
      canDeleteOwn: true,
      canDeleteOther: false,
      canSeeAll: true,
      canFilterUser: true,
      canViewWorkload: true,
    },
    {
      roleName: 'project manager',
      user: managerUser,
      projectRole: 'manager',
      canLog: true,
      canSeeTimeTab: true,
      canEditOwn: true,
      canEditOther: false, // Manager CANNOT edit another user's log
      canDeleteOwn: true,
      canDeleteOther: false,
      canSeeAll: true,
      canFilterUser: true,
      canViewWorkload: true,
    },
    {
      roleName: 'member (author)',
      user: memberAuthor,
      projectRole: 'member',
      canLog: true,
      canSeeTimeTab: true,
      canEditOwn: true,
      canEditOther: false,
      canDeleteOwn: true,
      canDeleteOther: false,
      canSeeAll: false,
      canFilterUser: false,
      canViewWorkload: true,
    },
    {
      roleName: 'member (non-author)',
      user: memberOther,
      projectRole: 'member',
      canLog: true,
      canSeeTimeTab: true,
      canEditOwn: true,
      canEditOther: false,
      canDeleteOwn: true,
      canDeleteOther: false,
      canSeeAll: false,
      canFilterUser: false,
      canViewWorkload: true,
    },
    {
      roleName: 'viewer',
      user: viewerUser,
      projectRole: 'viewer',
      canLog: false, // Viewers cannot log
      canSeeTimeTab: false, // Tab hidden for viewers (Amendment 2)
      canEditOwn: false,
      canEditOther: false,
      canDeleteOwn: false,
      canDeleteOther: false,
      canSeeAll: false,
      canFilterUser: false,
      canViewWorkload: true,
    },
    {
      roleName: 'missing user',
      user: null,
      projectRole: undefined,
      canLog: false,
      canSeeTimeTab: false,
      canEditOwn: false,
      canEditOther: false,
      canDeleteOwn: false,
      canDeleteOther: false,
      canSeeAll: false,
      canFilterUser: false,
      canViewWorkload: false,
    },
  ];

  matrix.forEach((row) => {
    describe(`Role: ${row.roleName}`, () => {
      it(`canLogTime -> ${row.canLog}`, () => {
        expect(canLogTime(row.user, project)).toBe(row.canLog);
      });

      it(`canSeeTimeTab -> ${row.canSeeTimeTab}`, () => {
        expect(canSeeTimeTab(row.user, project)).toBe(row.canSeeTimeTab);
        expect(canSeeTaskTimeLogs(row.user, project)).toBe(row.canSeeTimeTab);
      });

      it(`canEditTimeLog (own log) -> ${row.canEditOwn}`, () => {
        const ownLog = row.user ? { userId: row.user.id } : otherLog;
        expect(canEditTimeLog(row.user, ownLog, row.projectRole)).toBe(row.canEditOwn);
      });

      it(`canEditTimeLog (other log) -> ${row.canEditOther}`, () => {
        expect(canEditTimeLog(row.user, otherLog, row.projectRole)).toBe(row.canEditOther);
      });

      it(`canDeleteTimeLog (own log) -> ${row.canDeleteOwn}`, () => {
        const ownLog = row.user ? { userId: row.user.id } : otherLog;
        expect(canDeleteTimeLog(row.user, ownLog, row.projectRole)).toBe(row.canDeleteOwn);
      });

      it(`canDeleteTimeLog (other log) -> ${row.canDeleteOther}`, () => {
        expect(canDeleteTimeLog(row.user, otherLog, row.projectRole)).toBe(row.canDeleteOther);
      });

      it(`canSeeAllTimeLogs -> ${row.canSeeAll}`, () => {
        expect(canSeeAllTimeLogs(row.user, row.projectRole)).toBe(row.canSeeAll);
      });

      it(`canFilterTimeLogsByUser -> ${row.canFilterUser}`, () => {
        expect(canFilterTimeLogsByUser(row.user, row.projectRole)).toBe(row.canFilterUser);
      });

      it(`canViewWorkload -> ${row.canViewWorkload}`, () => {
        expect(canViewWorkload(row.user, row.projectRole)).toBe(row.canViewWorkload);
      });
    });
  });
});
