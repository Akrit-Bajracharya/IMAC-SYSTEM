import { describe, it, expect } from 'vitest';
import { resolveProjectTab } from '../projectTabHelpers.js';

describe('projectTabHelpers', () => {
  it('resolves valid tabs correctly', () => {
    expect(resolveProjectTab('overview')).toBe('overview');
    expect(resolveProjectTab('tasks')).toBe('tasks');
    expect(resolveProjectTab('milestones')).toBe('milestones');
    expect(resolveProjectTab('time')).toBe('time');
    expect(resolveProjectTab('workload')).toBe('workload');
    expect(resolveProjectTab('messages')).toBe('messages');
  });

  it('falls back to overview for unknown or invalid tabs', () => {
    expect(resolveProjectTab('unknown')).toBe('overview');
    expect(resolveProjectTab('random-tab')).toBe('overview');
    expect(resolveProjectTab('')).toBe('overview');
    expect(resolveProjectTab(null)).toBe('overview');
    expect(resolveProjectTab(undefined)).toBe('overview');
  });

  it('falls back to overview if tab is time but canSeeTime is false', () => {
    expect(resolveProjectTab('time', { canSeeTime: false })).toBe('overview');
    expect(resolveProjectTab('time', { canSeeTime: true })).toBe('time');
  });

  it('resolves messages tab for all viewers regardless of canSeeTime', () => {
    expect(resolveProjectTab('messages', { canSeeTime: false })).toBe('messages');
    expect(resolveProjectTab('messages', { canSeeTime: true })).toBe('messages');
  });
});
