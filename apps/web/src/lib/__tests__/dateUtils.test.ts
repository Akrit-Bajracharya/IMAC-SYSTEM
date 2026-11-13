import { describe, it, expect } from 'vitest';
import {
  extractDatePart,
  parseYmd,
  formatDateDisplay,
  formatDateTimeDisplay,
  toDateInputValue,
  isTaskOverdue,
  addDays,
  getWeekMonday,
  formatYmd,
  formatHours,
} from '../dateUtils.js';

describe('dateUtils', () => {
  describe('extractDatePart and parseYmd', () => {
    it('returns null for null, undefined, empty, or whitespace-only strings', () => {
      expect(extractDatePart(null)).toBeNull();
      expect(extractDatePart(undefined)).toBeNull();
      expect(extractDatePart('')).toBeNull();
      expect(extractDatePart('   ')).toBeNull();

      expect(parseYmd(null)).toBeNull();
      expect(parseYmd(undefined)).toBeNull();
      expect(parseYmd('')).toBeNull();
      expect(parseYmd('   ')).toBeNull();
    });

    it('extracts date part from pure YYYY-MM-DD strings', () => {
      expect(extractDatePart('2026-11-02')).toBe('2026-11-02');
      expect(extractDatePart('   2026-11-02   ')).toBe('2026-11-02');

      expect(parseYmd('2026-11-02')).toEqual({ year: 2026, month: 11, day: 2 });
    });

    it('extracts date part from ISO timestamps without shifting days', () => {
      // Must extract calendar date part '2026-11-02' even if timestamp would shift under timezone offsets
      expect(extractDatePart('2026-11-02T00:00:00.000Z')).toBe('2026-11-02');
      expect(extractDatePart('2026-11-02T23:59:59.999Z')).toBe('2026-11-02');
      expect(extractDatePart('2026-11-02T18:15:00.000Z')).toBe('2026-11-02');

      expect(parseYmd('2026-11-02T00:00:00.000Z')).toEqual({ year: 2026, month: 11, day: 2 });
      expect(parseYmd('2026-11-02T23:59:59.999Z')).toEqual({ year: 2026, month: 11, day: 2 });
    });

    it('returns null on impossible calendar dates', () => {
      // Month 13 or day 32 should fail
      expect(extractDatePart('2026-13-01')).toBeNull();
      expect(extractDatePart('2026-02-31')).toBeNull();
      expect(extractDatePart('not-a-date')).toBeNull();

      expect(parseYmd('2026-13-01')).toBeNull();
      expect(parseYmd('2026-02-31')).toBeNull();
      expect(parseYmd('not-a-date')).toBeNull();
    });

    it('correctly validates leap years (Feb 29)', () => {
      // 2024 is leap year, 2026 is not
      expect(extractDatePart('2024-02-29')).toBe('2024-02-29');
      expect(extractDatePart('2026-02-29')).toBeNull();
    });
  });

  describe('formatDateDisplay', () => {
    it('formats valid YYYY-MM-DD date string with short weekday', () => {
      // 2026-11-02 was a Monday
      expect(formatDateDisplay('2026-11-02')).toBe('Mon, Nov 2, 2026');
      expect(formatDateDisplay('2026-11-06')).toBe('Fri, Nov 6, 2026');
    });

    it('formats ISO timestamp using calendar date part (never shifting date)', () => {
      expect(formatDateDisplay('2026-11-02T00:00:00.000Z')).toBe('Mon, Nov 2, 2026');
      expect(formatDateDisplay('2026-11-02T23:59:59.000Z')).toBe('Mon, Nov 2, 2026');
    });

    it('returns "-" for null, undefined, empty, or unparseable inputs without throwing', () => {
      expect(formatDateDisplay(null)).toBe('-');
      expect(formatDateDisplay(undefined)).toBe('-');
      expect(formatDateDisplay('')).toBe('-');
      expect(formatDateDisplay('   ')).toBe('-');
      expect(formatDateDisplay('not-a-date')).toBe('-');
      expect(formatDateDisplay('2026-13-45')).toBe('-');
    });
  });

  describe('toDateInputValue', () => {
    it('returns YYYY-MM-DD from valid date strings and ISO timestamps', () => {
      expect(toDateInputValue('2026-11-02')).toBe('2026-11-02');
      expect(toDateInputValue('2026-11-02T15:30:00.000Z')).toBe('2026-11-02');
    });

    it('returns empty string "" for null, undefined, empty, or invalid input', () => {
      expect(toDateInputValue(null)).toBe('');
      expect(toDateInputValue(undefined)).toBe('');
      expect(toDateInputValue('')).toBe('');
      expect(toDateInputValue('invalid')).toBe('');
    });
  });

  describe('isTaskOverdue', () => {
    const referenceToday = '2026-11-02';

    it('returns true when due date calendar part is strictly before today and status is not done', () => {
      expect(isTaskOverdue('2026-11-01', 'todo', referenceToday)).toBe(true);
      expect(isTaskOverdue('2026-11-01', 'in_progress', referenceToday)).toBe(true);
      expect(isTaskOverdue('2026-11-01', 'blocked', referenceToday)).toBe(true);
      expect(isTaskOverdue('2026-10-31', 'todo', referenceToday)).toBe(true);
    });

    it('works identically with ISO timestamps by extracting calendar date part', () => {
      // 2026-11-01T23:59:59.000Z is calendar date 2026-11-01, which is before referenceToday 2026-11-02
      expect(isTaskOverdue('2026-11-01T23:59:59.000Z', 'todo', referenceToday)).toBe(true);
      // 2026-11-02T00:00:00.000Z is calendar date 2026-11-02 (today), which is NOT overdue
      expect(isTaskOverdue('2026-11-02T00:00:00.000Z', 'todo', referenceToday)).toBe(false);
    });

    it('returns false when due date is today or in the future', () => {
      expect(isTaskOverdue('2026-11-02', 'todo', referenceToday)).toBe(false);
      expect(isTaskOverdue('2026-11-03', 'todo', referenceToday)).toBe(false);
      expect(isTaskOverdue('2026-12-01', 'in_progress', referenceToday)).toBe(false);
    });

    it('returns false when status is done, even if due date is in the past', () => {
      expect(isTaskOverdue('2026-11-01', 'done', referenceToday)).toBe(false);
      expect(isTaskOverdue('2026-11-01T00:00:00.000Z', 'done', referenceToday)).toBe(false);
      expect(isTaskOverdue('2025-01-01', 'done', referenceToday)).toBe(false);
    });

    it('returns false without crashing when due date is null, undefined, empty, or garbage', () => {
      expect(isTaskOverdue(null, 'todo', referenceToday)).toBe(false);
      expect(isTaskOverdue(undefined, 'todo', referenceToday)).toBe(false);
      expect(isTaskOverdue('', 'todo', referenceToday)).toBe(false);
      expect(isTaskOverdue('garbage', 'todo', referenceToday)).toBe(false);
      expect(isTaskOverdue('2026-13-45', 'todo', referenceToday)).toBe(false);
    });
  });

  describe('addDays and getWeekMonday compatibility', () => {
    it('shifts days correctly on valid dates and timestamps', () => {
      expect(addDays('2026-11-02', 3)).toBe('2026-11-05');
      expect(addDays('2026-11-02T00:00:00.000Z', 1)).toBe('2026-11-03');
      expect(addDays('invalid', 1)).toBe('');
    });

    it('computes week Monday correctly', () => {
      // 2026-11-02 is Monday
      expect(getWeekMonday('2026-11-02')).toBe('2026-11-02');
      // 2026-11-08 is Sunday, belongs to the week starting 2026-11-02
      expect(getWeekMonday('2026-11-08')).toBe('2026-11-02');
      expect(getWeekMonday('invalid')).toBe('');
    });

    it('formatYmd helper outputs zero-padded YYYY-MM-DD', () => {
      expect(formatYmd(2026, 5, 9)).toBe('2026-05-09');
    });
  });

  describe('formatHours safe formatting', () => {
    it('formats numeric hours with 2 decimal places', () => {
      expect(formatHours(2.5)).toBe('2.50h');
      expect(formatHours(0)).toBe('0.00h');
      expect(formatHours(8)).toBe('8.00h');
    });

    it('formats string hours with 2 decimal places', () => {
      expect(formatHours('2.5')).toBe('2.50h');
      expect(formatHours('0.25')).toBe('0.25h');
    });

    it('returns "-" for null, undefined, empty, or NaN inputs without throwing', () => {
      expect(formatHours(null)).toBe('-');
      expect(formatHours(undefined)).toBe('-');
      expect(formatHours('')).toBe('-');
      expect(formatHours('not-a-number')).toBe('-');
      expect(formatHours(NaN)).toBe('-');
    });
  });

  describe('formatDateTimeDisplay', () => {
    it('formats explicit ISO timestamp to Asia/Kathmandu time with year and 24h clock', () => {
      // 2026-11-02T18:30:00.000Z in UTC -> +5:45 is 2026-11-03 00:15
      expect(formatDateTimeDisplay('2026-11-02T18:30:00.000Z')).toBe('3 Nov 2026, 00:15');
    });

    it('formats timestamp falling just after Kathmandu midnight correctly', () => {
      // 2026-11-02T18:16:00.000Z in UTC -> +5:45 is 2026-11-03 00:01
      expect(formatDateTimeDisplay('2026-11-02T18:16:00.000Z')).toBe('3 Nov 2026, 00:01');
    });

    it('returns "-" for null, undefined, empty, or invalid input without throwing', () => {
      expect(formatDateTimeDisplay(null)).toBe('-');
      expect(formatDateTimeDisplay(undefined)).toBe('-');
      expect(formatDateTimeDisplay('')).toBe('-');
      expect(formatDateTimeDisplay('   ')).toBe('-');
      expect(formatDateTimeDisplay('invalid-date-string')).toBe('-');
    });
  });
});
