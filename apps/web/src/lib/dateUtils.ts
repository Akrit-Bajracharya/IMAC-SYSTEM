/**
 * Date and time utility functions for IMAC Operations System.
 * Ensures consistent Asia/Kathmandu date string handling (YYYY-MM-DD, never timestamps).
 */

export function getKathmanduToday(): string {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kathmandu',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return formatter.format(new Date());
}

export function parseYmd(dateStr: string): { year: number; month: number; day: number } {
  const [year, month, day] = dateStr.split('-').map(Number);
  return { year: year ?? 2026, month: month ?? 1, day: day ?? 1 };
}

export function formatYmd(year: number, month: number, day: number): string {
  const m = String(month).padStart(2, '0');
  const d = String(day).padStart(2, '0');
  return `${year}-${m}-${d}`;
}

export function addDays(dateStr: string, days: number): string {
  const { year, month, day } = parseYmd(dateStr);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().split('T')[0]!;
}

export function getWeekMonday(dateStr: string): string {
  const { year, month, day } = parseYmd(dateStr);
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

export function formatDateDisplay(dateStr: string): string {
  const { year, month, day } = parseYmd(dateStr);
  const date = new Date(Date.UTC(year, month - 1, day));
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'UTC',
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(date);
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
