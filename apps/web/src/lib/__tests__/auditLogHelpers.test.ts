/**
 * Unit tests for auditLogHelpers and cross-validation of audit log constants.
 *
 * NOTE: Vitest runs in Node.js and does not mount React DOM components.
 * These tests verify pure helper logic, error resolution mapping, query parameter
 * generation, snapshot truncation, and cross-package synchronization of constants.
 */

import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import {
  buildAuditLogQueryParams,
  validateAuditDateRange,
  formatPaginationSummary,
  truncateSnapshotValue,
  formatSnapshotText,
  resolveAuditLogError,
  MAX_SNAPSHOT_STRING_LENGTH,
} from '../auditLogHelpers.js';
import {
  ALL_KNOWN_ACTIONS,
  ALL_KNOWN_ENTITY_TYPES,
  PROJECT_ACTIONS,
  ADMIN_ONLY_ACTIONS,
  PROJECT_MAPPABLE_ENTITY_TYPES,
  ADMIN_ONLY_ENTITY_TYPES,
} from '../../constants/auditLogs.js';

describe('auditLogHelpers', () => {
  describe('Amendment A & B: Constants Synchronization with apps/api', () => {
    /**
     * Recursively extracts string elements from array declarations in TS source,
     * including spread operators referencing other const arrays.
     */
    function extractArrayFromSource(source: string, arrayName: string): string[] {
      const regex = new RegExp(`export\\s+const\\s+${arrayName}\\s*=\\s*\\[([\\s\\S]*?)\\]`, 'm');
      const match = source.match(regex);
      if (!match) return [];
      const body = match[1];
      const items: string[] = [];

      for (const line of body.split('\n')) {
        const trimmed = line.trim();
        const spreadMatch = trimmed.match(/^\.\.\.([A-Za-z0-9_]+)/);
        if (spreadMatch) {
          const referenced = spreadMatch[1];
          items.push(...extractArrayFromSource(source, referenced));
        } else {
          const strMatch = trimmed.match(/^['"]([^'"]+)['"]/);
          if (strMatch) {
            items.push(strMatch[1]);
          }
        }
      }
      return items;
    }

    const apiAuditLogsPath = path.resolve(__dirname, '../../../../api/src/routes/auditLogs.ts');

    it('reads apps/api/src/routes/auditLogs.ts and finds the arrays', () => {
      expect(fs.existsSync(apiAuditLogsPath)).toBe(true);
      const apiSource = fs.readFileSync(apiAuditLogsPath, 'utf-8');

      const apiActions = extractArrayFromSource(apiSource, 'ALL_KNOWN_ACTIONS');
      const apiEntityTypes = extractArrayFromSource(apiSource, 'ALL_KNOWN_ENTITY_TYPES');

      // Fail if either array cannot be found or parses to zero items
      expect(apiActions.length).toBeGreaterThan(0);
      expect(apiEntityTypes.length).toBeGreaterThan(0);

      // Verify exact counts (Amendment B)
      expect(apiActions.length).toBe(45);
      expect(apiEntityTypes.length).toBe(14);

      // Verify both directions: web has all API values, and API has all web values
      expect(ALL_KNOWN_ACTIONS.length).toBe(apiActions.length);
      for (const action of ALL_KNOWN_ACTIONS) {
        expect(apiActions).toContain(action);
      }
      for (const apiAction of apiActions) {
        expect(ALL_KNOWN_ACTIONS).toContain(apiAction);
      }

      expect(ALL_KNOWN_ENTITY_TYPES.length).toBe(apiEntityTypes.length);
      for (const entityType of ALL_KNOWN_ENTITY_TYPES) {
        expect(apiEntityTypes).toContain(entityType);
      }
      for (const apiEntityType of apiEntityTypes) {
        expect(ALL_KNOWN_ENTITY_TYPES).toContain(apiEntityType);
      }
    });

    it('verifies sub-array counts match Amendment B specification', () => {
      expect(PROJECT_ACTIONS.length).toBe(24);
      expect(ADMIN_ONLY_ACTIONS.length).toBe(21);
      expect(ALL_KNOWN_ACTIONS.length).toBe(45);

      expect(PROJECT_MAPPABLE_ENTITY_TYPES.length).toBe(7);
      expect(ADMIN_ONLY_ENTITY_TYPES.length).toBe(7);
      expect(ALL_KNOWN_ENTITY_TYPES.length).toBe(14);
    });
  });

  describe('buildAuditLogQueryParams', () => {
    it('preserves offset 0 and does not drop it via falsy check', () => {
      const params = buildAuditLogQueryParams({
        offset: 0,
        limit: 50,
      });
      expect(params).toEqual({
        offset: 0,
        limit: 50,
      });
    });

    it('drops empty strings, null, and undefined values', () => {
      const params = buildAuditLogQueryParams({
        from: '   ',
        to: undefined,
        actorUserId: '',
        action: 'user.created',
        entityType: undefined,
        offset: 10,
        limit: 25,
      });
      expect(params).toEqual({
        action: 'user.created',
        offset: 10,
        limit: 25,
      });
    });

    it('trims string parameters', () => {
      const params = buildAuditLogQueryParams({
        from: ' 2026-01-01 ',
        to: ' 2026-01-31 ',
        actorUserId: ' user-123 ',
        action: ' auth.login.success ',
        entityType: ' User ',
        offset: 0,
        limit: 50,
      });
      expect(params).toEqual({
        from: '2026-01-01',
        to: '2026-01-31',
        actorUserId: 'user-123',
        action: 'auth.login.success',
        entityType: 'User',
        offset: 0,
        limit: 50,
      });
    });
  });

  describe('validateAuditDateRange', () => {
    it('returns valid: true for valid calendar date range', () => {
      const res = validateAuditDateRange('2026-01-01', '2026-01-31');
      expect(res.valid).toBe(true);
      expect(res.errorKey).toBeUndefined();
    });

    it('returns valid: true when from and to are the same date', () => {
      const res = validateAuditDateRange('2026-05-15', '2026-05-15');
      expect(res.valid).toBe(true);
    });

    it('rejects impossible calendar date like 2026-02-31', () => {
      const res = validateAuditDateRange('2026-02-01', '2026-02-31');
      expect(res.valid).toBe(false);
      expect(res.errorKey).toBe('admin.auditLog.errors.invalidDate');
    });

    it('rejects inverted date order (to < from)', () => {
      const res = validateAuditDateRange('2026-05-20', '2026-05-10');
      expect(res.valid).toBe(false);
      expect(res.errorKey).toBe('admin.auditLog.errors.dateOrder');
    });

    it('rejects empty or whitespace date strings', () => {
      const res = validateAuditDateRange('', '2026-05-10');
      expect(res.valid).toBe(false);
      expect(res.errorKey).toBe('admin.auditLog.errors.invalidDate');
    });
  });

  describe('formatPaginationSummary', () => {
    it('returns Showing 0-0 of 0 when total is 0', () => {
      const res = formatPaginationSummary(0, 50, 0);
      expect(res).toEqual({
        start: 0,
        end: 0,
        total: 0,
        hasPrev: false,
        hasNext: false,
        summaryText: 'Showing 0-0 of 0',
      });
    });

    it('returns correct first page summary with hasNext: true', () => {
      const res = formatPaginationSummary(125, 50, 0);
      expect(res).toEqual({
        start: 1,
        end: 50,
        total: 125,
        hasPrev: false,
        hasNext: true,
        summaryText: 'Showing 1-50 of 125',
      });
    });

    it('returns correct middle page summary with hasPrev: true and hasNext: true', () => {
      const res = formatPaginationSummary(125, 50, 50);
      expect(res).toEqual({
        start: 51,
        end: 100,
        total: 125,
        hasPrev: true,
        hasNext: true,
        summaryText: 'Showing 51-100 of 125',
      });
    });

    it('returns correct last page summary with hasPrev: true and hasNext: false', () => {
      const res = formatPaginationSummary(125, 50, 100);
      expect(res).toEqual({
        start: 101,
        end: 125,
        total: 125,
        hasPrev: true,
        hasNext: false,
        summaryText: 'Showing 101-125 of 125',
      });
    });

    it('handles total less than page limit', () => {
      const res = formatPaginationSummary(23, 50, 0);
      expect(res).toEqual({
        start: 1,
        end: 23,
        total: 23,
        hasPrev: false,
        hasNext: false,
        summaryText: 'Showing 1-23 of 23',
      });
    });
  });

  describe('truncateSnapshotValue and formatSnapshotText', () => {
    it('returns (empty) for null or empty snapshot objects', () => {
      expect(formatSnapshotText(null)).toBe('(empty)');
      expect(formatSnapshotText(undefined)).toBe('(empty)');
      expect(formatSnapshotText({})).toBe('(empty)');
    });

    it('preserves strings under MAX_SNAPSHOT_STRING_LENGTH (2000 chars)', () => {
      const normalStr = 'A'.repeat(500);
      const snapshot = { text: normalStr };
      const formatted = formatSnapshotText(snapshot);
      const parsed = JSON.parse(formatted);
      expect(parsed.text).toBe(normalStr);
      expect(parsed.text.length).toBe(500);
    });

    it('truncates a 5000-character string to 2000 chars + visible indicator', () => {
      const longStr = 'B'.repeat(5000);
      const truncated = truncateSnapshotValue(longStr) as string;
      expect(truncated.length).toBe(2000 + ' ... [truncated]'.length);
      expect(truncated.startsWith('B'.repeat(2000))).toBe(true);
      expect(truncated.endsWith(' ... [truncated]')).toBe(true);
    });

    it('renders a value containing <script>alert(1)</script> safely as plain text', () => {
      const malicious = { code: '<script>alert(1)</script>', field: '<b>bold</b>' };
      const formatted = formatSnapshotText(malicious);
      expect(formatted).toContain('<script>alert(1)</script>');
      expect(formatted).toContain('<b>bold</b>');
      // When rendered inside <pre>{text}</pre> in React, it is rendered as text and never executed.
      const parsed = JSON.parse(formatted);
      expect(parsed.code).toBe('<script>alert(1)</script>');
    });

    it('recursively processes nested objects and arrays', () => {
      const data = {
        outer: {
          nested: 'C'.repeat(3000),
          arr: ['short', 'D'.repeat(4000)],
        },
      };
      const truncated = truncateSnapshotValue(data) as any;
      expect(truncated.outer.nested.endsWith(' ... [truncated]')).toBe(true);
      expect(truncated.outer.arr[0]).toBe('short');
      expect(truncated.outer.arr[1].endsWith(' ... [truncated]')).toBe(true);
    });
  });

  describe('resolveAuditLogError (Amendment C)', () => {
    it('maps 403 to admin.auditLog.errors.forbidden with audit wording, not work log wording', () => {
      const err403 = {
        response: {
          status: 403,
          data: { error: 'forbidden', message: 'Forbidden' },
        },
      };
      const resolved = resolveAuditLogError(err403);
      expect(resolved.code).toBe('forbidden');
      expect(resolved.messageKey).toBe('admin.auditLog.errors.forbidden');
      expect(resolved.defaultMessage).toBe('You are not authorized to view the system audit logs.');
      expect(resolved.defaultMessage).not.toContain('work log');
      expect(resolved.defaultMessage).toContain('audit logs');
    });

    it('maps network errors to common.networkError', () => {
      const netErr = new Error('Network Error');
      (netErr as any).isAxiosError = true;
      (netErr as any).response = undefined;

      const resolved = resolveAuditLogError(netErr);
      expect(resolved.code).toBe('network_error');
      expect(resolved.isNetworkError).toBe(true);
      expect(resolved.messageKey).toBe('common.networkError');
    });

    it('maps 400 validation error to admin.auditLog.errors.validation', () => {
      const err400 = {
        response: {
          status: 400,
          data: { error: 'validation_error', message: 'Invalid query parameters' },
        },
      };
      const resolved = resolveAuditLogError(err400);
      expect(resolved.code).toBe('validation_error');
      expect(resolved.messageKey).toBe('admin.auditLog.errors.validation');
      expect(resolved.status).toBe(400);
    });

    it('maps 404 not found to admin.auditLog.errors.notFound', () => {
      const err404 = {
        response: {
          status: 404,
          data: { error: 'not_found' },
        },
      };
      const resolved = resolveAuditLogError(err404);
      expect(resolved.code).toBe('not_found');
      expect(resolved.messageKey).toBe('admin.auditLog.errors.notFound');
      expect(resolved.status).toBe(404);
    });

    it('maps generic 500 or unknown errors to admin.auditLog.errors.generic', () => {
      const err500 = {
        response: {
          status: 500,
          data: { error: 'internal_server_error' },
        },
      };
      const resolved = resolveAuditLogError(err500);
      expect(resolved.messageKey).toBe('admin.auditLog.errors.generic');
      expect(resolved.status).toBe(500);
    });
  });
});
