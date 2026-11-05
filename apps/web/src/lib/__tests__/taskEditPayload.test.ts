import { describe, it, expect } from 'vitest';
import {
  buildPatchTaskPayload,
  type InitialTaskValues,
  type CurrentTaskFormValues,
} from '../taskEditPayload.js';

describe('buildPatchTaskPayload', () => {
  const baseInitial: InitialTaskValues = {
    title: 'Initial Title',
    description: 'Initial Description',
    dueDate: '2026-11-15T00:00:00.000Z',
    estimatedHours: 4.5,
    assigneeUserId: 'user-uuid-1',
    milestoneId: 'milestone-uuid-1',
  };

  const baseCurrent: CurrentTaskFormValues = {
    title: 'Initial Title',
    description: 'Initial Description',
    dueDate: '2026-11-15',
    estimatedHours: '4.5',
    assigneeUserId: 'user-uuid-1',
    milestoneId: 'milestone-uuid-1',
  };

  it('omits all fields and reports hasChanges: false when nothing changed', () => {
    const res = buildPatchTaskPayload(baseInitial, baseCurrent);
    expect(res.errors).toEqual({});
    expect(res.hasChanges).toBe(false);
    expect(res.payload).toEqual({});
  });

  it('includes only changed fields when some fields are updated', () => {
    const current: CurrentTaskFormValues = {
      ...baseCurrent,
      title: 'Updated Title',
      estimatedHours: '6.25',
    };
    const res = buildPatchTaskPayload(baseInitial, current);
    expect(res.errors).toEqual({});
    expect(res.hasChanges).toBe(true);
    expect(res.payload).toEqual({
      title: 'Updated Title',
      estimatedHours: 6.25,
    });
  });

  it('sets cleared fields to null when optional fields are cleared', () => {
    const current: CurrentTaskFormValues = {
      ...baseCurrent,
      description: '',
      dueDate: '',
      estimatedHours: '',
      assigneeUserId: '',
      milestoneId: '',
    };
    const res = buildPatchTaskPayload(baseInitial, current);
    expect(res.errors).toEqual({});
    expect(res.hasChanges).toBe(true);
    expect(res.payload).toEqual({
      description: null,
      dueDate: null,
      estimatedHours: null,
      assigneeUserId: null,
      milestoneId: null,
    });
  });

  describe('title validation', () => {
    it('rejects empty and whitespace-only title', () => {
      const current1 = { ...baseCurrent, title: '' };
      const res1 = buildPatchTaskPayload(baseInitial, current1);
      expect(res1.errors.title).toBe('Task title cannot be empty');
      expect(res1.payload).toBeNull();

      const current2 = { ...baseCurrent, title: '    ' };
      const res2 = buildPatchTaskPayload(baseInitial, current2);
      expect(res2.errors.title).toBe('Task title cannot be empty');
      expect(res2.payload).toBeNull();
    });

    it('rejects title over 200 characters', () => {
      const longTitle = 'a'.repeat(201);
      const current = { ...baseCurrent, title: longTitle };
      const res = buildPatchTaskPayload(baseInitial, current);
      expect(res.errors.title).toBe('Task title must be 200 characters or less');
      expect(res.payload).toBeNull();
    });

    it('accepts title up to 200 characters', () => {
      const validTitle = 'a'.repeat(200);
      const current = { ...baseCurrent, title: validTitle };
      const res = buildPatchTaskPayload(baseInitial, current);
      expect(res.errors).toEqual({});
      expect(res.payload?.title).toBe(validTitle);
    });
  });

  describe('description validation', () => {
    it('rejects description over 5000 characters', () => {
      const longDesc = 'a'.repeat(5001);
      const current = { ...baseCurrent, description: longDesc };
      const res = buildPatchTaskPayload(baseInitial, current);
      expect(res.errors.description).toBe('Description must be 5000 characters or less');
      expect(res.payload).toBeNull();
    });

    it('accepts description up to 5000 characters', () => {
      const validDesc = 'a'.repeat(5000);
      const current = { ...baseCurrent, description: validDesc };
      const res = buildPatchTaskPayload(baseInitial, current);
      expect(res.errors).toEqual({});
      expect(res.payload?.description).toBe(validDesc);
    });
  });

  describe('dueDate validation', () => {
    it('rejects dates not in YYYY-MM-DD format', () => {
      const invalidFormats = ['15-11-2026', '2026/11/15', 'tomorrow', '2026-11'];
      for (const format of invalidFormats) {
        const current = { ...baseCurrent, dueDate: format };
        const res = buildPatchTaskPayload(baseInitial, current);
        expect(res.errors.dueDate).toBe('dueDate must be in YYYY-MM-DD format');
        expect(res.payload).toBeNull();
      }
    });

    it('rejects impossible calendar dates', () => {
      const impossible = ['2026-13-15', '2026-02-31'];
      for (const date of impossible) {
        const current = { ...baseCurrent, dueDate: date };
        const res = buildPatchTaskPayload(baseInitial, current);
        expect(res.errors.dueDate).toBe('dueDate must be a valid calendar date');
        expect(res.payload).toBeNull();
      }
    });

    it('accepts valid YYYY-MM-DD date and compares with initial timestamp without timezone shift', () => {
      const current = { ...baseCurrent, dueDate: '2026-11-20' };
      const res = buildPatchTaskPayload(baseInitial, current);
      expect(res.errors).toEqual({});
      expect(res.payload?.dueDate).toBe('2026-11-20');
    });
  });

  describe('estimatedHours validation', () => {
    it('rejects hours <= 0 or NaN', () => {
      const invalid = ['0', '-1.5', 'abc'];
      for (const val of invalid) {
        const current = { ...baseCurrent, estimatedHours: val };
        const res = buildPatchTaskPayload(baseInitial, current);
        expect(res.errors.estimatedHours).toBe('estimatedHours must be greater than 0');
        expect(res.payload).toBeNull();
      }
    });

    it('rejects hours over 1000', () => {
      const current = { ...baseCurrent, estimatedHours: '1000.25' };
      const res = buildPatchTaskPayload(baseInitial, current);
      expect(res.errors.estimatedHours).toBe('estimatedHours cannot exceed 1000');
      expect(res.payload).toBeNull();
    });

    it('rejects non-0.25 increments', () => {
      const nonQuarter = ['1.1', '2.3', '4.45'];
      for (const val of nonQuarter) {
        const current = { ...baseCurrent, estimatedHours: val };
        const res = buildPatchTaskPayload(baseInitial, current);
        expect(res.errors.estimatedHours).toBe(
          'estimatedHours must be entered in 15-minute (0.25) increments'
        );
        expect(res.payload).toBeNull();
      }
    });

    it('accepts valid 15-minute increments (0.25, 0.5, 0.75, 1.0)', () => {
      const quarters = [
        { str: '0.25', num: 0.25 },
        { str: '1.5', num: 1.5 },
        { str: '1000', num: 1000 },
      ];
      for (const { str, num } of quarters) {
        const current = { ...baseCurrent, estimatedHours: str };
        const res = buildPatchTaskPayload(baseInitial, current);
        expect(res.errors).toEqual({});
        expect(res.payload?.estimatedHours).toBe(num);
      }
    });
  });
});
