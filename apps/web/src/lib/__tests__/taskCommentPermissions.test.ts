import { describe, it, expect } from 'vitest';
import {
  canAddComment,
  canEditComment,
  canDeleteComment,
  isCommentEdited,
} from '../taskCommentPermissions.js';

describe('taskCommentPermissions', () => {
  describe('canAddComment', () => {
    it('allows system_admin regardless of project role', () => {
      expect(canAddComment(undefined, true)).toBe(true);
      expect(canAddComment('viewer', true)).toBe(true);
      expect(canAddComment('member', true)).toBe(true);
    });

    it('allows project manager and member', () => {
      expect(canAddComment('manager', false)).toBe(true);
      expect(canAddComment('member', false)).toBe(true);
    });

    it('denies project viewer and undefined role for non-admins', () => {
      expect(canAddComment('viewer', false)).toBe(false);
      expect(canAddComment(undefined, false)).toBe(false);
    });
  });

  describe('canEditComment', () => {
    const comment = { authorUserId: 'user-author' };

    it('allows strictly the author', () => {
      expect(canEditComment(comment, 'user-author')).toBe(true);
    });

    it('denies non-authors even if they have other roles', () => {
      expect(canEditComment(comment, 'user-manager')).toBe(false);
      expect(canEditComment(comment, 'user-other')).toBe(false);
    });

    it('denies when currentUserId is missing or empty', () => {
      expect(canEditComment(comment, undefined)).toBe(false);
      expect(canEditComment(comment, '')).toBe(false);
      expect(canEditComment(comment, '   ')).toBe(false);
    });
  });

  describe('canDeleteComment', () => {
    const comment = { authorUserId: 'user-author' };

    it('allows system_admin and project managers to delete any comment', () => {
      expect(canDeleteComment(comment, undefined, true, 'user-admin')).toBe(true);
      expect(canDeleteComment(comment, 'manager', false, 'user-manager')).toBe(true);
    });

    it('allows the author to delete their own comment', () => {
      expect(canDeleteComment(comment, 'member', false, 'user-author')).toBe(true);
      expect(canDeleteComment(comment, 'viewer', false, 'user-author')).toBe(true);
    });

    it('denies non-author members and viewers from deleting', () => {
      expect(canDeleteComment(comment, 'member', false, 'user-other')).toBe(false);
      expect(canDeleteComment(comment, 'viewer', false, 'user-other')).toBe(false);
    });

    it('denies when currentUserId is missing and not admin/manager', () => {
      expect(canDeleteComment(comment, 'member', false, undefined)).toBe(false);
      expect(canDeleteComment(comment, 'member', false, '')).toBe(false);
    });
  });

  describe('isCommentEdited (Amendment 4)', () => {
    const created = '2026-11-05T09:00:00.000Z';

    it('returns false when created and updated are identical', () => {
      expect(isCommentEdited(created, created)).toBe(false);
    });

    it('returns false when updated is within 2 seconds (<= 2000ms) of created', () => {
      const within500ms = '2026-11-05T09:00:00.500Z';
      const exact2000ms = '2026-11-05T09:00:02.000Z';
      expect(isCommentEdited(created, within500ms)).toBe(false);
      expect(isCommentEdited(created, exact2000ms)).toBe(false);
    });

    it('returns true when updated is more than 2 seconds (> 2000ms) after created', () => {
      const at2001ms = '2026-11-05T09:00:02.001Z';
      const at10sec = '2026-11-05T09:00:10.000Z';
      expect(isCommentEdited(created, at2001ms)).toBe(true);
      expect(isCommentEdited(created, at10sec)).toBe(true);
    });

    it('returns false for invalid date strings', () => {
      expect(isCommentEdited('invalid', 'invalid')).toBe(false);
      expect(isCommentEdited(created, 'invalid')).toBe(false);
      expect(isCommentEdited('invalid', created)).toBe(false);
    });
  });
});
