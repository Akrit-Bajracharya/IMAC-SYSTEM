import type { ProjectRole } from '../types/index.js';

export interface CommentSubject {
  authorUserId: string;
}

/**
 * Project viewers cannot post comments; managers, members, and system_admin can.
 */
export function canAddComment(
  projectRole: ProjectRole | undefined,
  isSystemAdmin: boolean
): boolean {
  if (isSystemAdmin || projectRole === 'manager' || projectRole === 'member') {
    return true;
  }
  return false;
}

/**
 * Edit is restricted strictly to the comment author.
 */
export function canEditComment(
  comment: CommentSubject,
  currentUserId: string | undefined
): boolean {
  if (!currentUserId || typeof currentUserId !== 'string' || currentUserId.trim() === '') {
    return false;
  }
  return comment.authorUserId === currentUserId;
}

/**
 * Delete is permitted to the author, a project manager, or system_admin.
 * Viewers and non-author members without manager elevation cannot delete.
 */
export function canDeleteComment(
  comment: CommentSubject,
  projectRole: ProjectRole | undefined,
  isSystemAdmin: boolean,
  currentUserId: string | undefined
): boolean {
  if (isSystemAdmin || projectRole === 'manager') {
    return true;
  }
  if (!currentUserId || typeof currentUserId !== 'string' || currentUserId.trim() === '') {
    return false;
  }
  return comment.authorUserId === currentUserId;
}

/**
 * Pure helper for "(edited)" marker:
 * Only returns true if updatedAt is more than 2 seconds (2000 ms) after createdAt.
 * (Amendment 4)
 */
export function isCommentEdited(createdAt: string, updatedAt: string): boolean {
  const createdMs = Date.parse(createdAt);
  const updatedMs = Date.parse(updatedAt);

  if (Number.isNaN(createdMs) || Number.isNaN(updatedMs)) {
    return false;
  }

  return updatedMs - createdMs > 2000;
}
