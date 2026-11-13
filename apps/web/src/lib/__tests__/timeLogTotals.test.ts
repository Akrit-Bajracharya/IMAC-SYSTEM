import { describe, it, expect } from 'vitest';
import {
  sumTimeLogHours,
  groupTimeLogsByDate,
  parseNumericHours,
} from '../timeLogTotals.js';

describe('timeLogTotals helpers', () => {
  describe('parseNumericHours', () => {
    it('parses numbers and strings correctly', () => {
      expect(parseNumericHours(2.5)).toBe(2.5);
      expect(parseNumericHours('2.5')).toBe(2.5);
      expect(parseNumericHours('0.25')).toBe(0.25);
    });

    it('returns 0 for null, undefined, NaN, or negative inputs', () => {
      expect(parseNumericHours(null)).toBe(0);
      expect(parseNumericHours(undefined)).toBe(0);
      expect(parseNumericHours('invalid')).toBe(0);
      expect(parseNumericHours(-5)).toBe(0);
    });
  });

  describe('sumTimeLogHours', () => {
    it('sums mixed numbers and numeric strings accurately', () => {
      const logs = [
        { hours: 2.25 },
        { hours: '1.75' },
        { hours: 0.5 },
        { hours: '3.0' },
      ];
      expect(sumTimeLogHours(logs)).toBe(7.5);
    });

    it('handles null, undefined, empty, and invalid hours gracefully without throwing', () => {
      const logs = [
        { hours: null },
        { hours: undefined },
        { hours: 'not-a-number' },
        { hours: 4.25 },
      ];
      expect(sumTimeLogHours(logs)).toBe(4.25);
    });

    it('returns 0 for empty array', () => {
      expect(sumTimeLogHours([])).toBe(0);
    });
  });

  describe('groupTimeLogsByDate', () => {
    it('groups by calendar date whether workDate is YYYY-MM-DD or ISO timestamp', () => {
      const logs = [
        { id: '1', workDate: '2026-11-05', hours: 2.5 },
        { id: '2', workDate: '2026-11-05T08:30:00.000Z', hours: '1.5' },
        { id: '3', workDate: '2026-11-04', hours: 3 },
      ];

      const groups = groupTimeLogsByDate(logs);
      expect(groups).toHaveLength(2);

      const nov5 = groups.find((g) => g.dateKey === '2026-11-05');
      expect(nov5).toBeDefined();
      expect(nov5!.totalHours).toBe(4.0);
      expect(nov5!.items).toHaveLength(2);

      const nov4 = groups.find((g) => g.dateKey === '2026-11-04');
      expect(nov4).toBeDefined();
      expect(nov4!.totalHours).toBe(3.0);
      expect(nov4!.items).toHaveLength(1);
    });

    it('handles missing or unparseable workDate by grouping under unknown', () => {
      const logs = [
        { id: '1', workDate: null, hours: 2 },
        { id: '2', workDate: '', hours: 1 },
      ];

      const groups = groupTimeLogsByDate(logs);
      expect(groups).toHaveLength(1);
      expect(groups[0]!.dateKey).toBe('unknown');
      expect(groups[0]!.totalHours).toBe(3);
    });
  });
});
