/**
 * Table-driven unit tests for notificationsHelpers (Step 17b).
 *
 * NOTE: Vitest runs in Node.js here and does NOT render React components.
 * These tests verify pure helper logic: query param building, unread badge formatting,
 * notificationText generation, notificationLink UUID validation, page merging/deduplication,
 * row-click mark-read/navigation ordering, and error resolution.
 */

import { describe, it, expect, vi } from 'vitest';
import fs from 'fs';
import path from 'path';
import {
  ALL_NOTIFICATION_TYPES,
  NOTIFICATION_TYPES,
} from '../../constants/notificationTypes.js';
import {
  buildNotificationQueryParams,
  formatUnreadBadge,
  notificationText,
  notificationLink,
  mergeNotificationPages,
  executeNotificationRowClick,
  resolveNotificationError,
  getNotificationsRedirectPath,
  type NotificationItem,
  type TranslateFn,
} from '../notificationsHelpers.js';

const VALID_PROJECT_ID = '11111111-1111-4111-8111-111111111111';
const VALID_TASK_ID = '22222222-2222-4222-8222-222222222222';
const VALID_USER_ID = '33333333-3333-4333-8333-333333333333';

function makeItem(overrides: Partial<NotificationItem> = {}): NotificationItem {
  return {
    id: '44444444-4444-4444-8444-444444444444',
    userId: VALID_USER_ID,
    type: NOTIFICATION_TYPES.TASK_ASSIGNED,
    entityType: 'task',
    entityId: VALID_TASK_ID,
    projectId: VALID_PROJECT_ID,
    payload: {},
    readAt: null,
    createdAt: '2026-11-25T04:00:00.000Z',
    ...overrides,
  };
}

// Simple deterministic translator using defaultValue interpolation for pure unit tests
const mockT: TranslateFn = (_key, options) => {
  let text = String(options?.['defaultValue'] ?? _key);
  if (options) {
    for (const [k, v] of Object.entries(options)) {
      if (k !== 'defaultValue') {
        text = text.replace(new RegExp(`\\{\\{${k}\\}\\}`, 'g'), String(v));
      }
    }
  }
  return text;
};

describe('notificationsHelpers', () => {
  describe('buildNotificationQueryParams', () => {
    it.each([
      {
        name: 'preserves offset: 0 and limit: 20',
        input: { limit: 20, offset: 0 },
        expected: { limit: 20, offset: 0 },
      },
      {
        name: 'drops undefined values and omits unreadOnly when false',
        input: { limit: undefined, offset: 0, unreadOnly: false },
        expected: { offset: 0 },
      },
      {
        name: 'sends unreadOnly: "true" only when true',
        input: { limit: 5, offset: 20, unreadOnly: true },
        expected: { limit: 5, offset: 20, unreadOnly: 'true' },
      },
      {
        name: 'drops negative offset and non-positive limit',
        input: { limit: 0, offset: -1 },
        expected: {},
      },
    ])('$name', ({ input, expected }) => {
      expect(buildNotificationQueryParams(input)).toEqual(expected);
    });
  });

  describe('formatUnreadBadge', () => {
    it.each([
      { count: 0, expected: null },
      { count: -3, expected: null },
      { count: 1, expected: '1' },
      { count: 42, expected: '42' },
      { count: 99, expected: '99' },
      { count: 100, expected: '99+' },
      { count: 250, expected: '99+' },
    ])('formats count $count as $expected', ({ count, expected }) => {
      expect(formatUnreadBadge(count)).toBe(expected);
    });
  });

  describe('notificationText', () => {
    it('handles every type in ALL_NOTIFICATION_TYPES without falling back to generic fallback', () => {
      const fallback = 'You have a new notification';

      for (const type of ALL_NOTIFICATION_TYPES) {
        const item = makeItem({
          type,
          payload: {
            taskTitle: 'Fix login redirect',
            projectName: 'IMAC Core',
            toStatus: 'in_progress',
          },
        });
        const text = notificationText(item, mockT);
        expect(text).toBeTruthy();
        expect(text).not.toBe(fallback);
        expect(text).not.toContain('undefined');
        expect(text).not.toContain('null');
      }
    });

    it.each<
      {
        type: string;
        payload: Record<string, string | number | boolean | null>;
        expected: string;
      }
    >([
      {
        type: NOTIFICATION_TYPES.TASK_ASSIGNED,
        payload: { taskTitle: 'Implement Bell' },
        expected: 'You were assigned to task "Implement Bell"',
      },
      {
        type: NOTIFICATION_TYPES.TASK_STATUS_CHANGED,
        payload: { taskTitle: 'Implement Bell', toStatus: 'done' },
        expected: 'Task "Implement Bell" moved to done',
      },
      {
        type: NOTIFICATION_TYPES.MESSAGE_CONVERTED_TO_TASK,
        payload: { taskTitle: 'Review deployment' },
        expected: 'A project message was converted to task "Review deployment"',
      },
      {
        type: NOTIFICATION_TYPES.PROJECT_MEMBER_ADDED,
        payload: { projectName: 'Alpha Build' },
        expected: 'You were added to project "Alpha Build"',
      },
      {
        type: NOTIFICATION_TYPES.WORK_LOG_REMINDER,
        payload: {},
        expected: 'Reminder: please submit your daily work log',
      },
      {
        type: 'some.unknown.future.type',
        payload: { taskTitle: 'Ignored' },
        expected: 'You have a new notification',
      },
    ])('renders $type with payload', ({ type, payload, expected }) => {
      const text = notificationText(makeItem({ type, payload }), mockT);
      expect(text).toBe(expected);
    });

    it('never prints "undefined" or "null" when payload keys are missing or null', () => {
      for (const type of [...ALL_NOTIFICATION_TYPES, 'unknown.type']) {
        const text = notificationText(
          makeItem({
            type,
            payload: {
              taskTitle: null,
              projectName: null,
              toStatus: null,
            },
          }),
          mockT
        );
        expect(text.toLowerCase()).not.toContain('undefined');
        expect(text.toLowerCase()).not.toContain('null');
      }
    });
  });

  describe('notificationLink (Amendment C: UUID validation)', () => {
    it.each([
      {
        name: 'task.assigned for system_admin -> /admin/projects/:p/tasks/:t',
        item: makeItem({
          type: NOTIFICATION_TYPES.TASK_ASSIGNED,
          entityType: 'task',
          entityId: VALID_TASK_ID,
          projectId: VALID_PROJECT_ID,
        }),
        role: 'system_admin',
        expected: `/admin/projects/${VALID_PROJECT_ID}/tasks/${VALID_TASK_ID}`,
      },
      {
        name: 'task.status_changed for employee -> /employee/projects/:p/tasks/:t',
        item: makeItem({
          type: NOTIFICATION_TYPES.TASK_STATUS_CHANGED,
          entityType: 'task',
          entityId: VALID_TASK_ID,
          projectId: VALID_PROJECT_ID,
        }),
        role: 'employee',
        expected: `/employee/projects/${VALID_PROJECT_ID}/tasks/${VALID_TASK_ID}`,
      },
      {
        name: 'message.converted_to_task using payload.taskId -> task detail path',
        item: makeItem({
          type: NOTIFICATION_TYPES.MESSAGE_CONVERTED_TO_TASK,
          entityType: 'task',
          entityId: null,
          projectId: VALID_PROJECT_ID,
          payload: { taskId: VALID_TASK_ID },
        }),
        role: 'project_manager',
        expected: `/employee/projects/${VALID_PROJECT_ID}/tasks/${VALID_TASK_ID}`,
      },
      {
        name: 'project.member_added for system_admin -> /admin/projects/:p',
        item: makeItem({
          type: NOTIFICATION_TYPES.PROJECT_MEMBER_ADDED,
          entityType: 'project',
          entityId: VALID_PROJECT_ID,
          projectId: VALID_PROJECT_ID,
        }),
        role: 'system_admin',
        expected: `/admin/projects/${VALID_PROJECT_ID}`,
      },
      {
        name: 'project.member_added for viewer -> /employee/projects/:p',
        item: makeItem({
          type: NOTIFICATION_TYPES.PROJECT_MEMBER_ADDED,
          entityType: 'project',
          entityId: VALID_PROJECT_ID,
          projectId: VALID_PROJECT_ID,
        }),
        role: 'viewer',
        expected: `/employee/projects/${VALID_PROJECT_ID}`,
      },
      {
        name: 'work_log.reminder -> null (no link)',
        item: makeItem({
          type: NOTIFICATION_TYPES.WORK_LOG_REMINDER,
          entityType: null,
          entityId: null,
          projectId: null,
        }),
        role: 'employee',
        expected: null,
      },
      {
        name: 'unknown type -> null (no link)',
        item: makeItem({
          type: 'unknown.type',
          entityType: null,
          entityId: null,
          projectId: null,
        }),
        role: 'system_admin',
        expected: null,
      },
      {
        name: 'malformed projectId -> null',
        item: makeItem({
          type: NOTIFICATION_TYPES.TASK_ASSIGNED,
          projectId: 'not-a-uuid',
          entityId: VALID_TASK_ID,
        }),
        role: 'employee',
        expected: null,
      },
      {
        name: 'malformed entityId -> null',
        item: makeItem({
          type: NOTIFICATION_TYPES.TASK_ASSIGNED,
          projectId: VALID_PROJECT_ID,
          entityId: '12345',
        }),
        role: 'employee',
        expected: null,
      },
      {
        name: 'path traversal "../" in projectId -> null',
        item: makeItem({
          type: NOTIFICATION_TYPES.PROJECT_MEMBER_ADDED,
          projectId: '../admin/settings',
          entityId: '../admin/settings',
        }),
        role: 'employee',
        expected: null,
      },
      {
        name: 'path traversal "../" in payload.taskId -> null',
        item: makeItem({
          type: NOTIFICATION_TYPES.TASK_ASSIGNED,
          projectId: VALID_PROJECT_ID,
          entityId: null,
          payload: { taskId: '../../etc/passwd' },
        }),
        role: 'employee',
        expected: null,
      },
    ])('$name', ({ item, role, expected }) => {
      expect(notificationLink(item, role)).toBe(expected);
    });
  });

  describe('mergeNotificationPages', () => {
    it('merges pages and deduplicates by id while preserving order', () => {
      const a = makeItem({ id: 'a' });
      const b = makeItem({ id: 'b' });
      const bDup = makeItem({ id: 'b', readAt: '2026-11-25T05:00:00.000Z' });
      const c = makeItem({ id: 'c' });

      const merged = mergeNotificationPages([a, b], [bDup, c]);
      expect(merged.map((i) => i.id)).toEqual(['a', 'b', 'c']);
    });
  });

  describe('executeNotificationRowClick (Amendment E)', () => {
    it('marks unread notification read and then navigates when link exists', async () => {
      const callOrder: string[] = [];
      const markRead = vi.fn(async () => {
        callOrder.push('markRead');
      });
      const navigate = vi.fn(() => {
        callOrder.push('navigate');
      });
      const onError = vi.fn();

      await executeNotificationRowClick({
        item: makeItem({ readAt: null }),
        role: 'employee',
        markRead,
        navigate,
        onMarkReadError: onError,
      });

      expect(callOrder).toEqual(['markRead', 'navigate']);
      expect(navigate).toHaveBeenCalledWith(
        `/employee/projects/${VALID_PROJECT_ID}/tasks/${VALID_TASK_ID}`
      );
      expect(onError).not.toHaveBeenCalled();
    });

    it('navigates even if markRead fails, and does not show stay-on-page error', async () => {
      const markRead = vi.fn(async () => {
        throw new Error('Network failed');
      });
      const navigate = vi.fn();
      const onError = vi.fn();

      await executeNotificationRowClick({
        item: makeItem({ readAt: null }),
        role: 'employee',
        markRead,
        navigate,
        onMarkReadError: onError,
      });

      expect(markRead).toHaveBeenCalledTimes(1);
      expect(navigate).toHaveBeenCalledWith(
        `/employee/projects/${VALID_PROJECT_ID}/tasks/${VALID_TASK_ID}`
      );
      expect(onError).not.toHaveBeenCalled();
    });

    it('calls onMarkReadError when markRead fails and user stays on the page (no link)', async () => {
      const markRead = vi.fn(async () => {
        throw new Error('Network failed');
      });
      const navigate = vi.fn();
      const onError = vi.fn();

      await executeNotificationRowClick({
        item: makeItem({
          type: NOTIFICATION_TYPES.WORK_LOG_REMINDER,
          entityType: null,
          entityId: null,
          projectId: null,
          readAt: null,
        }),
        role: 'employee',
        markRead,
        navigate,
        onMarkReadError: onError,
      });

      expect(navigate).not.toHaveBeenCalled();
      expect(onError).toHaveBeenCalledTimes(1);
    });

    it('skips markRead if already read and still navigates', async () => {
      const markRead = vi.fn();
      const navigate = vi.fn();

      await executeNotificationRowClick({
        item: makeItem({ readAt: '2026-11-25T05:00:00.000Z' }),
        role: 'system_admin',
        markRead,
        navigate,
      });

      expect(markRead).not.toHaveBeenCalled();
      expect(navigate).toHaveBeenCalledWith(
        `/admin/projects/${VALID_PROJECT_ID}/tasks/${VALID_TASK_ID}`
      );
    });
  });

  describe('getNotificationsRedirectPath', () => {
    it('routes system_admin and hr_admin to /admin/notifications and others to /employee/notifications', () => {
      expect(getNotificationsRedirectPath('system_admin')).toBe('/admin/notifications');
      expect(getNotificationsRedirectPath('hr_admin')).toBe('/admin/notifications');
      expect(getNotificationsRedirectPath('project_manager')).toBe('/employee/notifications');
      expect(getNotificationsRedirectPath('employee')).toBe('/employee/notifications');
      expect(getNotificationsRedirectPath('viewer')).toBe('/employee/notifications');
    });
  });

  describe('resolveNotificationError', () => {
    it('maps error classes to notifications.errors.* without work-log wording', () => {
      const net = resolveNotificationError(new Error('Network down'));
      expect(net.messageKey).toBe('notifications.errors.network');
      expect(net.defaultMessage).not.toContain('work log');

      const forbidden = resolveNotificationError({ response: { status: 403 } });
      expect(forbidden.messageKey).toBe('notifications.errors.forbidden');

      const serverErr = resolveNotificationError({ response: { status: 500 } });
      expect(serverErr.messageKey).toBe('notifications.errors.generic');
    });
  });

  describe('i18n missing-key check', () => {
    it('verifies every static t() key used in notification components and layouts exists in en.json', () => {
      const enPath = path.resolve(__dirname, '../../i18n/locales/en.json');
      const en = JSON.parse(fs.readFileSync(enPath, 'utf-8'));

      const hasKey = (obj: Record<string, unknown>, keyPath: string): boolean => {
        let cur: unknown = obj;
        for (const part of keyPath.split('.')) {
          if (!cur || typeof cur !== 'object' || !(part in cur)) {
            return false;
          }
          cur = (cur as Record<string, unknown>)[part];
        }
        return cur !== undefined;
      };

      const targetFiles = [
        path.resolve(__dirname, '../../components/layout/NotificationBell.tsx'),
        path.resolve(__dirname, '../../pages/notifications/NotificationsPage.tsx'),
        path.resolve(__dirname, '../notificationsHelpers.ts'),
        path.resolve(__dirname, '../../components/layout/AdminLayout.tsx'),
        path.resolve(__dirname, '../../components/layout/EmployeeLayout.tsx'),
      ];

      const foundKeys = new Set<string>();
      const keyRegex = /\bt\(\s*['"]([a-zA-Z0-9_.]+)['"]/g;

      for (const filePath of targetFiles) {
        const content = fs.readFileSync(filePath, 'utf-8');
        let match: RegExpExecArray | null;
        while ((match = keyRegex.exec(content)) !== null) {
          const key = match[1]!;
          if (!key.endsWith('.')) {
            foundKeys.add(key);
          }
        }
      }

      expect(foundKeys.size).toBeGreaterThan(0);
      const missing = [...foundKeys].filter((k) => !hasKey(en, k));
      expect(missing).toEqual([]);
    });
  });
});
