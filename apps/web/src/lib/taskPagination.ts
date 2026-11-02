import type { ProjectTask } from '../types/index.js';

export interface TaskPageLike {
  items: ProjectTask[];
  hasMore?: boolean;
  nextCursor?: string | null;
}

/**
 * Flattens an array of task list response pages and de-duplicates tasks by id.
 * Preserves insertion order (first occurrence of each task id is kept).
 */
export function flattenAndDeduplicateTasks(
  pages?: TaskPageLike[] | null
): ProjectTask[] {
  if (!pages || pages.length === 0) return [];

  const seenIds = new Set<string>();
  const result: ProjectTask[] = [];

  for (const page of pages) {
    if (!page?.items) continue;
    for (const task of page.items) {
      if (!seenIds.has(task.id)) {
        seenIds.add(task.id);
        result.push(task);
      }
    }
  }

  return result;
}

/**
 * Determines the next page cursor parameter from the last fetched page.
 * Returns nextCursor if hasMore is true; otherwise returns null.
 */
export function getNextTaskPageParam(
  lastPage?: { hasMore?: boolean; nextCursor?: string | null } | null
): string | null {
  if (!lastPage || !lastPage.hasMore) {
    return null;
  }
  return lastPage.nextCursor ?? null;
}
