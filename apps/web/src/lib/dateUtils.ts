/**
 * Date and time utility functions for IMAC Operations System.
 * Ensures consistent Asia/Kathmandu date string handling (YYYY-MM-DD, never timestamps).
 */

export type ParsedYmd = { year: number; month: number; day: number };

export function getKathmanduToday(): string {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kathmandu',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return formatter.format(new Date());
}

/**
 * Extracts YYYY-MM-DD date part from a date-only string or ISO timestamp without shifting time zones.
 * Validates that year, month, and day represent a real calendar date.
 * Returns null if input is missing, empty, or an impossible date (e.g. 2026-13-45).
 */
export function extractDatePart(dateStr?: string | null): string | null {
  if (!dateStr || typeof dateStr !== 'string') return null;
  const trimmed = dateStr.trim();
  if (!trimmed) return null;
  const match = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return null;
  const year = parseInt(match[1]!, 10);
  const month = parseInt(match[2]!, 10);
  const day = parseInt(match[3]!, 10);

  if (month < 1 || month > 12) return null;
  const maxDays = new Date(Date.UTC(year, month, 0)).getUTCDate();
  if (day < 1 || day > maxDays) return null;

  const mm = String(month).padStart(2, '0');
  const dd = String(day).padStart(2, '0');
  return `${year}-${mm}-${dd}`;
}

/**
 * Safely parses a date string or ISO timestamp into { year, month, day }.
 * Returns null if input is empty, unreadable, or impossible (e.g. 2026-13-45).
 * Preserves call compatibility with existing callers.
 */
export function parseYmd(dateStr: string): ParsedYmd;
export function parseYmd(dateStr?: string | null): ParsedYmd | null;
export function parseYmd(dateStr?: string | null): ParsedYmd | null {
  const datePart = extractDatePart(dateStr);
  if (!datePart) return null;
  const [yearStr, monthStr, dayStr] = datePart.split('-');
  return {
    year: parseInt(yearStr!, 10),
    month: parseInt(monthStr!, 10),
    day: parseInt(dayStr!, 10),
  };
}

export function formatYmd(year: number, month: number, day: number): string {
  const m = String(month).padStart(2, '0');
  const d = String(day).padStart(2, '0');
  return `${year}-${m}-${d}`;
}

export function addDays(dateStr: string, days: number): string {
  const parsed = parseYmd(dateStr);
  if (!parsed) return '';
  const { year, month, day } = parsed;
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().split('T')[0]!;
}

export function getWeekMonday(dateStr: string): string {
  const parsed = parseYmd(dateStr);
  if (!parsed) return '';
  const { year, month, day } = parsed;
  const date = new Date(Date.UTC(year, month - 1, day));
  // In JS, getUTCDay: 0 is Sun, 1 is Mon, ..., 6 is Sat
  const dayOfWeek = date.getUTCDay();
  // We want Monday (1). If Sunday (0), distance is -6 days. Otherwise distance is 1 - dayOfWeek.
  const diffDays = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  date.setUTCDate(date.getUTCDate() + diffDays);
  return date.toISOString().split('T')[0]!;
}

export function getDaysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

export function getFirstWeekdayOfMonth(year: number, month: number): number {
  // Returns 0 for Sunday, 1 for Monday, etc.
  return new Date(Date.UTC(year, month - 1, 1)).getUTCDay();
}

/**
 * Formats a YYYY-MM-DD string or ISO timestamp for display (e.g. "Mon, Nov 2, 2026").
 * Takes the date part without time zone shifting.
 * Returns neutral placeholder "-" for null, undefined, empty, or unparseable input.
 * Never throws.
 */
export function formatDateDisplay(dateStr?: string | null): string {
  const parsed = parseYmd(dateStr);
  if (!parsed) return '-';
  const { year, month, day } = parsed;
  const date = new Date(Date.UTC(year, month - 1, day));
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'UTC',
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(date);
}

/**
 * Returns YYYY-MM-DD or empty string "" for HTML <input type="date"> elements.
 */
export function toDateInputValue(value?: string | null): string {
  return extractDatePart(value) ?? '';
}

/**
 * Determines whether a task is overdue:
 * - Done tasks are never overdue.
 * - Missing, empty, or invalid due dates are never overdue (does not crash).
 * - Compares calendar date parts only (dueDatePart < referenceToday).
 * - Defaults referenceToday to Asia/Kathmandu today.
 */
export function isTaskOverdue(
  dueDate: string | null | undefined,
  status: string,
  today?: string
): boolean {
  if (status === 'done') return false;
  const dueDatePart = extractDatePart(dueDate);
  if (!dueDatePart) return false;
  const referenceToday = today ?? getKathmanduToday();
  return dueDatePart < referenceToday;
}

export function formatHours(hours: number): string {
  return `${hours.toFixed(2)}h`;
}

export function calculateShiftDifference(
  totalHours: number,
  standardShiftHours: number
): {
  diff: number;
  formatted: string;
  isOver: boolean;
  isUnder: boolean;
  isBalanced: boolean;
} {
  const diff = Math.round((totalHours - standardShiftHours) * 100) / 100;
  const isBalanced = Math.abs(diff) < 0.001;
  const isOver = diff > 0.001;
  const isUnder = diff < -0.001;

  let formatted = '0.00h (Balanced)';
  if (isOver) {
    formatted = `+${diff.toFixed(2)}h (Over shift length)`;
  } else if (isUnder) {
    formatted = `${diff.toFixed(2)}h (Deficit)`;
  }

  return {
    diff,
    formatted,
    isOver,
    isUnder,
    isBalanced,
  };
}
