/**
 * Aggregation and calculation helpers for project time logs.
 * Ensures consistent date extraction and safe handling of numeric/string/null hours.
 */

import { extractDatePart } from './dateUtils.js';

export interface TimeLogLike {
  id?: string;
  workDate?: string | null;
  hours?: number | string | null;
}

export function parseNumericHours(val?: number | string | null): number {
  if (val === null || val === undefined) return 0;
  const num = typeof val === 'string' ? parseFloat(val) : val;
  if (typeof num !== 'number' || isNaN(num) || num < 0) return 0;
  return num;
}

export function sumTimeLogHours(logs: Array<{ hours?: number | string | null }>): number {
  if (!Array.isArray(logs) || logs.length === 0) return 0;
  let total = 0;
  for (const log of logs) {
    total += parseNumericHours(log.hours);
  }
  return Math.round(total * 100) / 100;
}

export interface DateGroupedTimeLogs<T extends TimeLogLike> {
  dateKey: string;
  totalHours: number;
  items: T[];
}

export function groupTimeLogsByDate<T extends TimeLogLike>(
  logs: T[]
): DateGroupedTimeLogs<T>[] {
  if (!Array.isArray(logs) || logs.length === 0) return [];

  const groupMap = new Map<string, { totalHours: number; items: T[] }>();

  for (const log of logs) {
    const dateKey = extractDatePart(log.workDate) ?? 'unknown';
    const hours = parseNumericHours(log.hours);

    let group = groupMap.get(dateKey);
    if (!group) {
      group = { totalHours: 0, items: [] };
      groupMap.set(dateKey, group);
    }

    group.totalHours = Math.round((group.totalHours + hours) * 100) / 100;
    group.items.push(log);
  }

  // Convert to array preserving descending date order (unknown at end)
  const result: DateGroupedTimeLogs<T>[] = [];
  for (const [dateKey, data] of groupMap.entries()) {
    result.push({
      dateKey,
      totalHours: data.totalHours,
      items: data.items,
    });
  }

  return result;
}
