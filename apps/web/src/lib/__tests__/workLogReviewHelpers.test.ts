import { describe, it, expect } from 'vitest';
import {
  isValidCalendarDate,
  resolveWorkLogErrorInfo,
  shouldHydrateSettings,
  shouldUpdateWeekStartDate,
} from '../workLogReviewHelpers.js';

describe('workLogReviewHelpers', () => {
  describe('isValidCalendarDate', () => {
    it('returns true for valid standard calendar dates', () => {
      expect(isValidCalendarDate('2026-05-15')).toBe(true);
      expect(isValidCalendarDate('2026-01-01')).toBe(true);
      expect(isValidCalendarDate('2026-12-31')).toBe(true);
      expect(isValidCalendarDate('2026-07-31')).toBe(true);
    });

    it('returns true for leap year Feb 29 (2024, 2020, 2000)', () => {
      expect(isValidCalendarDate('2024-02-29')).toBe(true);
      expect(isValidCalendarDate('2020-02-29')).toBe(true);
      expect(isValidCalendarDate('2000-02-29')).toBe(true);
    });

    it('returns false for Feb 29 in non-leap years (2026, 2025, 1900)', () => {
      expect(isValidCalendarDate('2026-02-29')).toBe(false);
      expect(isValidCalendarDate('2025-02-29')).toBe(false);
      expect(isValidCalendarDate('1900-02-29')).toBe(false);
    });

    it('returns false for impossible days in month (including 2026-02-31)', () => {
      expect(isValidCalendarDate('2026-02-31')).toBe(false);
      expect(isValidCalendarDate('2026-02-30')).toBe(false);
      expect(isValidCalendarDate('2026-04-31')).toBe(false);
      expect(isValidCalendarDate('2026-06-31')).toBe(false);
      expect(isValidCalendarDate('2026-09-31')).toBe(false);
      expect(isValidCalendarDate('2026-11-31')).toBe(false);
    });

    it('returns false for day 0 or out of range days', () => {
      expect(isValidCalendarDate('2026-01-00')).toBe(false);
      expect(isValidCalendarDate('2026-01-32')).toBe(false);
    });

    it('returns false for invalid month numbers', () => {
      expect(isValidCalendarDate('2026-00-15')).toBe(false);
      expect(isValidCalendarDate('2026-13-01')).toBe(false);
      expect(isValidCalendarDate('2026-99-01')).toBe(false);
    });

    it('returns false for empty string, whitespace, null, or undefined', () => {
      expect(isValidCalendarDate('')).toBe(false);
      expect(isValidCalendarDate('   ')).toBe(false);
      expect(isValidCalendarDate(null)).toBe(false);
      expect(isValidCalendarDate(undefined)).toBe(false);
    });

    it('returns false for non-string types', () => {
      expect(isValidCalendarDate(20260515)).toBe(false);
      expect(isValidCalendarDate({})).toBe(false);
      expect(isValidCalendarDate([])).toBe(false);
      expect(isValidCalendarDate(true)).toBe(false);
    });

    it('returns false for malformed or ISO timestamp formats', () => {
      expect(isValidCalendarDate('2026-1-1')).toBe(false);
      expect(isValidCalendarDate('2026/01/01')).toBe(false);
      expect(isValidCalendarDate('01-01-2026')).toBe(false);
      expect(isValidCalendarDate('2026-01-01T00:00:00Z')).toBe(false);
      expect(isValidCalendarDate('not-a-date')).toBe(false);
    });
  });

  describe('resolveWorkLogErrorInfo', () => {
    it('maps missing response or undefined error to network_error', () => {
      const res1 = resolveWorkLogErrorInfo(undefined);
      expect(res1.code).toBe('network_error');
      expect(res1.isNetworkError).toBe(true);
      expect(res1.status).toBeUndefined();
      expect(res1.messageKey).toBe('common.networkError');

      const res2 = resolveWorkLogErrorInfo({});
      expect(res2.code).toBe('network_error');
      expect(res2.isNetworkError).toBe(true);

      const res3 = resolveWorkLogErrorInfo(new Error('Network error'));
      expect(res3.code).toBe('network_error');
      expect(res3.isNetworkError).toBe(true);
    });

    it('extracts string error code from data.error', () => {
      const error = {
        response: {
          status: 400,
          data: { error: 'invalid_edit_window', message: 'Edit window must be positive' },
        },
      };
      const res = resolveWorkLogErrorInfo(error);
      expect(res.code).toBe('invalid_edit_window');
      expect(res.status).toBe(400);
      expect(res.isNetworkError).toBe(false);
    });

    it('ignores non-string data.error and falls back to status-based code or unknown_error', () => {
      // Non-string: object
      const errObj = {
        response: {
          status: 400,
          data: { error: { details: 'bad' } },
        },
      };
      expect(resolveWorkLogErrorInfo(errObj).code).toBe('unknown_error');

      // Non-string: number
      const errNum = {
        response: {
          status: 400,
          data: { error: 500 },
        },
      };
      expect(resolveWorkLogErrorInfo(errNum).code).toBe('unknown_error');

      // Non-string: boolean
      const errBool = {
        response: {
          status: 400,
          data: { error: true },
        },
      };
      expect(resolveWorkLogErrorInfo(errBool).code).toBe('unknown_error');

      // Non-string: array
      const errArr = {
        response: {
          status: 400,
          data: { error: ['err1', 'err2'] },
        },
      };
      expect(resolveWorkLogErrorInfo(errArr).code).toBe('unknown_error');

      // Empty string
      const errEmpty = {
        response: {
          status: 400,
          data: { error: '   ' },
        },
      };
      expect(resolveWorkLogErrorInfo(errEmpty).code).toBe('unknown_error');
    });

    it('resolves HTTP 403 to forbidden when no string code is present', () => {
      const err = { response: { status: 403, data: {} } };
      const res = resolveWorkLogErrorInfo(err);
      expect(res.code).toBe('forbidden');
      expect(res.messageKey).toBe('common.forbidden');
    });

    it('resolves HTTP 404 to not_found when no string code is present', () => {
      const err = { response: { status: 404, data: {} } };
      const res = resolveWorkLogErrorInfo(err);
      expect(res.code).toBe('not_found');
      expect(res.messageKey).toBe('common.notFound');
    });

    it('resolves HTTP 401 to unauthorized when no string code is present', () => {
      const err = { response: { status: 401, data: {} } };
      const res = resolveWorkLogErrorInfo(err);
      expect(res.code).toBe('unauthorized');
      expect(res.messageKey).toBe('common.unauthorized');
    });

    it('resolves profile_not_found code with dashboard messageKey', () => {
      const err = {
        response: {
          status: 404,
          data: { error: 'profile_not_found' },
        },
      };
      const res = resolveWorkLogErrorInfo(err);
      expect(res.code).toBe('profile_not_found');
      expect(res.messageKey).toBe('dashboard.noProfileTitle');
    });
  });

  describe('shouldHydrateSettings', () => {
    it('returns true when form is not yet hydrated regardless of dirty state', () => {
      expect(shouldHydrateSettings(false, false)).toBe(true);
      expect(shouldHydrateSettings(false, true)).toBe(true);
    });

    it('returns true when form is hydrated but user has not edited (clean)', () => {
      expect(shouldHydrateSettings(true, false)).toBe(true);
    });

    it('returns false when form is hydrated and user has typed edits (dirty)', () => {
      expect(shouldHydrateSettings(true, true)).toBe(false);
    });
  });

  describe('shouldUpdateWeekStartDate', () => {
    it('returns true for non-empty string dates', () => {
      expect(shouldUpdateWeekStartDate('2026-11-23')).toBe(true);
    });

    it('returns false for empty string or whitespace', () => {
      expect(shouldUpdateWeekStartDate('')).toBe(false);
      expect(shouldUpdateWeekStartDate('   ')).toBe(false);
    });

    it('returns false for non-string values', () => {
      expect(shouldUpdateWeekStartDate(null)).toBe(false);
      expect(shouldUpdateWeekStartDate(undefined)).toBe(false);
      expect(shouldUpdateWeekStartDate(123)).toBe(false);
    });
  });
});
