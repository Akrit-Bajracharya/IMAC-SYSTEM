import { describe, it, expect } from 'vitest';
import {
  getTimeLogDateMin,
  getTimeLogDateMax,
  isQuarterHourIncrement,
  validateAndBuildCreatePayload,
  validateAndBuildPatchPayload,
} from '../timeLogPayload.js';

describe('timeLogPayload helpers (with explicit referenceToday)', () => {
  const referenceToday = '2026-11-05';

  describe('date min/max helpers', () => {
    it('computes min as today - 90 days and max as today + 1 day', () => {
      expect(getTimeLogDateMax(referenceToday)).toBe('2026-11-06');
      // 90 days before 2026-11-05 is 2026-08-07
      expect(getTimeLogDateMin(referenceToday)).toBe('2026-08-07');
    });
  });

  describe('isQuarterHourIncrement', () => {
    it('accepts valid 0.25 steps', () => {
      expect(isQuarterHourIncrement(0.25)).toBe(true);
      expect(isQuarterHourIncrement(0.5)).toBe(true);
      expect(isQuarterHourIncrement(0.75)).toBe(true);
      expect(isQuarterHourIncrement(1.0)).toBe(true);
      expect(isQuarterHourIncrement(8.25)).toBe(true);
      expect(isQuarterHourIncrement(24)).toBe(true);
    });

    it('rejects non-quarter hour steps and invalid values', () => {
      expect(isQuarterHourIncrement(0.1)).toBe(false);
      expect(isQuarterHourIncrement(0.33)).toBe(false);
      expect(isQuarterHourIncrement(1.15)).toBe(false);
      expect(isQuarterHourIncrement(NaN)).toBe(false);
    });
  });

  describe('validateAndBuildCreatePayload', () => {
    it('builds a clean payload for valid input', () => {
      const res = validateAndBuildCreatePayload(
        {
          taskId: '9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d',
          workDate: '2026-11-05',
          hours: 3.5,
          note: '  Completed design review  ',
        },
        referenceToday
      );

      expect(res.ok).toBe(true);
      if (res.ok) {
        expect(res.payload.workDate).toBe('2026-11-05');
        expect(res.payload.hours).toBe(3.5);
        expect(res.payload.taskId).toBe('9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d');
        expect(res.payload.note).toBe('Completed design review');
      }
    });

    it('parses numeric string hours in 0.25 increments', () => {
      const res = validateAndBuildCreatePayload(
        {
          workDate: '2026-11-05',
          hours: '2.25',
        },
        referenceToday
      );

      expect(res.ok).toBe(true);
      if (res.ok) {
        expect(res.payload.hours).toBe(2.25);
        expect(res.payload.taskId).toBeNull();
        expect(res.payload.note).toBeNull();
      }
    });

    it('rejects hours <= 0, > 24, or non-quarter hour', () => {
      expect(
        validateAndBuildCreatePayload({ workDate: '2026-11-05', hours: 0 }, referenceToday).ok
      ).toBe(false);
      expect(
        validateAndBuildCreatePayload({ workDate: '2026-11-05', hours: -1 }, referenceToday).ok
      ).toBe(false);
      expect(
        validateAndBuildCreatePayload({ workDate: '2026-11-05', hours: 25 }, referenceToday).ok
      ).toBe(false);
      expect(
        validateAndBuildCreatePayload({ workDate: '2026-11-05', hours: 1.1 }, referenceToday).ok
      ).toBe(false);
    });

    it('rejects workDate outside Kathmandu [-90, +1] range', () => {
      // 2026-11-07 is +2 days ahead
      const future = validateAndBuildCreatePayload(
        { workDate: '2026-11-07', hours: 2 },
        referenceToday
      );
      expect(future.ok).toBe(false);

      // 2026-05-01 is > 90 days past
      const past = validateAndBuildCreatePayload(
        { workDate: '2026-05-01', hours: 2 },
        referenceToday
      );
      expect(past.ok).toBe(false);
    });

    it('rejects note longer than 5000 characters', () => {
      const longNote = 'a'.repeat(5001);
      const res = validateAndBuildCreatePayload(
        { workDate: '2026-11-05', hours: 1, note: longNote },
        referenceToday
      );
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.error).toBe('note_too_long');
      }
    });
  });

  describe('validateAndBuildPatchPayload', () => {
    const existing = {
      taskId: 'task-1',
      workDate: '2026-11-04',
      hours: 4.0,
      note: 'Initial note',
    };

    it('returns no_changes if nothing was changed', () => {
      const res = validateAndBuildPatchPayload(
        existing,
        {
          taskId: 'task-1',
          workDate: '2026-11-04',
          hours: 4.0,
          note: 'Initial note',
        },
        referenceToday
      );

      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.error).toBe('no_changes');
      }
    });

    it('sends null to clear taskId or note and omits unchanged fields', () => {
      const res = validateAndBuildPatchPayload(
        existing,
        {
          taskId: null,
          note: '',
        },
        referenceToday
      );

      expect(res.ok).toBe(true);
      if (res.ok) {
        expect(res.payload.taskId).toBeNull();
        expect(res.payload.note).toBeNull();
        expect(res.payload.hours).toBeUndefined();
        expect(res.payload.workDate).toBeUndefined();
      }
    });

    it('validates modified fields strictly', () => {
      const invalidHours = validateAndBuildPatchPayload(
        existing,
        { hours: 1.33 },
        referenceToday
      );
      expect(invalidHours.ok).toBe(false);

      const invalidDate = validateAndBuildPatchPayload(
        existing,
        { workDate: '2026-11-10' },
        referenceToday
      );
      expect(invalidDate.ok).toBe(false);
    });
  });
});
