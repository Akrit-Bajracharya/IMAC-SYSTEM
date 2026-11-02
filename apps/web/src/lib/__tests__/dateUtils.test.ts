import { describe, it, expect } from 'vitest';
import {
  extractDatePart,
  parseYmd,
  formatDateDisplay,
  toDateInputValue,
  isTaskOverdue,
  addDays,
  getWeekMonday,
  formatYmd,
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

    it('returns null for unparseable or garbage input', () => {
      expect(extractDatePart('garbage')).toBeNull();
      expect(extractDatePart('not-a-date')).toBeNull();
      expect(extractDatePart('abc-de-fg')).toBeNull();

      expect(parseYmd('garbage')).toBeNull();
      expect(parseYmd('not-a-date')).toBeNull();
    });

    it('returns null for impossible dates (e.g. month 13 or day 45)', () => {
      expect(extractDatePart('2026-13-45')).toBeNull();
      expect(extractDatePart('2026-00-10')).toBeNull();
      expect(extractDatePart('2026-02-30')).toBeNull(); // Feb 2026 only has 28 days

      expect(parseYmd('2026-13-45')).toBeNull();
      expect(parseYmd('2026-02-30')).toBeNull();
    });

    it('extracts date part from valid YYYY-MM-DD strings', () => {
      expect(extractDatePart('2026-11-02')).toBe('2026-11-02');
      expect(parseYmd('2026-11-02')).toEqual({ year: 2026, month: 11, day: 2 });
    });

    it('extracts date part from UTC midnight ISO timestamps', () => {
      expect(extractDatePart('2026-11-02T00:00:00.000Z')).toBe('2026-11-02');
      expect(parseYmd('2026-11-02T00:00:00.000Z')).toEqual({ year: 2026, month: 11, day: 2 });
    });

    it('extracts date part from non-midnight ISO timestamps without shifting timezone', () => {
      // API date columns (@db.Date) always arrive at midnight UTC, so the date part
      // is the stored calendar date. The helper takes the date part without time zone shifting.
      expect(extractDatePart('2026-11-02T18:30:00.000Z')).toBe('2026-11-02');
      expect(parseYmd('2026-11-02T18:30:00.000Z')).toEqual({ year: 2026, month: 11, day: 2 });
    });
  });

  describe('formatDateDisplay', () => {
    it('returns neutral placeholder "-" for missing, empty, or invalid input without throwing', () => {
      expect(formatDateDisplay(null)).toBe('-');
      expect(formatDateDisplay(undefined)).toBe('-');
      expect(formatDateDisplay('')).toBe('-');
      expect(formatDateDisplay('   ')).toBe('-');
      expect(formatDateDisplay('garbage')).toBe('-');
      expect(formatDateDisplay('2026-13-45')).toBe('-');
    });

    it('formats YYYY-MM-DD dates in en-US display format', () => {
      expect(formatDateDisplay('2026-11-02')).toBe('Mon, Nov 2, 2026');
    });

    it('formats ISO timestamps at midnight UTC', () => {
      expect(formatDateDisplay('2026-11-02T00:00:00.000Z')).toBe('Mon, Nov 2, 2026');
    });

    it('formats non-midnight ISO timestamps by preserving calendar date part', () => {
      // API date columns (@db.Date) always arrive at midnight UTC, so the date part
      // is the stored calendar date. Never shift by local timezone (e.g. Nepal UTC+05:45).
      expect(formatDateDisplay('2026-11-02T18:30:00.000Z')).toBe('Mon, Nov 2, 2026');
    });
  });

  describe('toDateInputValue', () => {
    it('returns empty string "" for null, undefined, empty, or invalid input', () => {
      expect(toDateInputValue(null)).toBe('');
      expect(toDateInputValue(undefined)).toBe('');
      expect(toDateInputValue('')).toBe('');
      expect(toDateInputValue('   ')).toBe('');
      expect(toDateInputValue('garbage')).toBe('');
      expect(toDateInputValue('2026-13-45')).toBe('');
    });

    it('returns YYYY-MM-DD for valid date-only and ISO timestamps', () => {
      expect(toDateInputValue('2026-11-02')).toBe('2026-11-02');
      expect(toDateInputValue('2026-11-02T00:00:00.000Z')).toBe('2026-11-02');
      // API date columns (@db.Date) always arrive at midnight UTC, so the date part is the stored calendar date
      expect(toDateInputValue('2026-11-02T18:30:00.000Z')).toBe('2026-11-02');
    });
  });

  describe('isTaskOverdue', () => {
    // We pass today explicitly in all tests so tests pass identically across any timezone
    const referenceToday = '2026-11-02';

    it('returns true when due date is strictly in the past (past day)', () => {
      expect(isTaskOverdue('2026-11-01', 'todo', referenceToday)).toBe(true);
      expect(isTaskOverdue('2026-11-01T00:00:00.000Z', 'in_progress', referenceToday)).toBe(true);
      expect(isTaskOverdue('2026-10-31', 'blocked', referenceToday)).toBe(true);
    });

    it('returns false when due date is today (not overdue on due day)', () => {
      expect(isTaskOverdue('2026-11-02', 'todo', referenceToday)).toBe(false);
      expect(isTaskOverdue('2026-11-02T00:00:00.000Z', 'in_progress', referenceToday)).toBe(false);
    });

    it('returns false when due date is tomorrow or future', () => {
      expect(isTaskOverdue('2026-11-03', 'todo', referenceToday)).toBe(false);
      expect(isTaskOverdue('2026-11-03T00:00:00.000Z', 'in_progress', referenceToday)).toBe(false);
      expect(isTaskOverdue('2026-12-01', 'todo', referenceToday)).toBe(false);
    });

    it('returns false when task is done, even if due date is in the past', () => {
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
});
