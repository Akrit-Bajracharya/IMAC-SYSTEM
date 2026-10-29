import { describe, it, expect } from 'vitest';
import { canEditTask, isValidUuid } from '../services/projectAccess.js';

describe('Project Access Service: canEditTask Fail-Closed Invariants (Step 10d)', () => {
  const validUserId = '11111111-1111-4111-8111-111111111111';
  const otherUserId = '22222222-2222-4222-8222-222222222222';

  it('fails closed when userId is missing or empty (mock-based)', () => {
    // Missing userId (undefined)
    expect(canEditTask('member', false, 'edit', { createdByUserId: validUserId }, undefined)).toBe(false);

    // Empty userId string
    expect(canEditTask('member', false, 'edit', { createdByUserId: validUserId }, '')).toBe(false);
    expect(canEditTask('member', false, 'edit', { createdByUserId: validUserId }, '   ')).toBe(false);
  });

  it('fails closed when task is missing for member edit, changeStatus, manageDependencies (mock-based)', () => {
    expect(canEditTask('member', false, 'edit', null, validUserId)).toBe(false);
    expect(canEditTask('member', false, 'edit', undefined, validUserId)).toBe(false);
    expect(canEditTask('member', false, 'changeStatus', null, validUserId)).toBe(false);
    expect(canEditTask('member', false, 'manageDependencies', null, validUserId)).toBe(false);

    // Create does not require existing task
    expect(canEditTask('member', false, 'create', null, validUserId)).toBe(true);
  });

  it('proves undefined userId with undefined assignee NEVER matches (fail-closed) (mock-based)', () => {
    // Both task.assigneeUserId and userId are undefined
    const taskWithNoAssignee = { createdByUserId: otherUserId, assigneeUserId: undefined };
    expect(canEditTask('member', false, 'changeStatus', taskWithNoAssignee, undefined)).toBe(false);
    expect(canEditTask('member', false, 'edit', taskWithNoAssignee, undefined)).toBe(false);
  });

  it('allows member to edit/manageDependencies if creator or assignee (mock-based)', () => {
    // Creator
    const createdTask = { createdByUserId: validUserId, assigneeUserId: otherUserId };
    expect(canEditTask('member', false, 'edit', createdTask, validUserId)).toBe(true);
    expect(canEditTask('member', false, 'manageDependencies', createdTask, validUserId)).toBe(true);
    expect(canEditTask('member', false, 'changeStatus', createdTask, validUserId)).toBe(false);

    // Assignee
    const assignedTask = { createdByUserId: otherUserId, assigneeUserId: validUserId };
    expect(canEditTask('member', false, 'edit', assignedTask, validUserId)).toBe(true);
    expect(canEditTask('member', false, 'manageDependencies', assignedTask, validUserId)).toBe(true);
    expect(canEditTask('member', false, 'changeStatus', assignedTask, validUserId)).toBe(true);

    // Neither
    const unrelatedTask = { createdByUserId: otherUserId, assigneeUserId: otherUserId };
    expect(canEditTask('member', false, 'edit', unrelatedTask, validUserId)).toBe(false);
    expect(canEditTask('member', false, 'manageDependencies', unrelatedTask, validUserId)).toBe(false);
    expect(canEditTask('member', false, 'changeStatus', unrelatedTask, validUserId)).toBe(false);
  });

  it('refuses viewers on all actions regardless of assignment or creation (mock-based)', () => {
    const ownTask = { createdByUserId: validUserId, assigneeUserId: validUserId };
    expect(canEditTask('viewer', false, 'create', null, validUserId)).toBe(false);
    expect(canEditTask('viewer', false, 'edit', ownTask, validUserId)).toBe(false);
    expect(canEditTask('viewer', false, 'changeStatus', ownTask, validUserId)).toBe(false);
    expect(canEditTask('viewer', false, 'manageDependencies', ownTask, validUserId)).toBe(false);
  });

  it('allows system_admin and project managers on any task (mock-based)', () => {
    const unrelatedTask = { createdByUserId: otherUserId, assigneeUserId: otherUserId };
    expect(canEditTask('manager', false, 'edit', unrelatedTask, validUserId)).toBe(true);
    expect(canEditTask('viewer', true, 'edit', unrelatedTask, validUserId)).toBe(true);
    expect(canEditTask(undefined, true, 'changeStatus', unrelatedTask, validUserId)).toBe(true);
  });

  it('validates UUIDs properly via isValidUuid', () => {
    expect(isValidUuid(validUserId)).toBe(true);
    expect(isValidUuid('invalid-uuid')).toBe(false);
    expect(isValidUuid(null)).toBe(false);
    expect(isValidUuid(undefined)).toBe(false);
  });
});
