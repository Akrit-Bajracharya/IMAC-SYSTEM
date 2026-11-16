/**
 * Shared date calculation helper for tests.
 * Computes calendar dates in the Asia/Kathmandu time zone with optional day offsets.
 *
 * NOTE: This helper does NOT freeze the clock by itself. It reads the current system clock
 * (real or faked by the test runner) at the time of invocation.
 */

/**
 * Returns a 'YYYY-MM-DD' formatted date string in Asia/Kathmandu, optionally
 * shifted by `offsetDays` calendar days relative to `refDate` (defaulting to current system time).
 */
export function getKathmanduDate(offsetDays: number = 0, refDate: Date = new Date()): string {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kathmandu',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const parts = formatter.formatToParts(refDate);
  const year = parseInt(parts.find((p) => p.type === 'year')!.value, 10);
  const month = parseInt(parts.find((p) => p.type === 'month')!.value, 10);
  const day = parseInt(parts.find((p) => p.type === 'day')!.value, 10);

  const shiftedUtc = new Date(Date.UTC(year, month - 1, day + offsetDays));
  return shiftedUtc.toISOString().slice(0, 10);
}

/**
 * Returns today's date formatted as 'YYYY-MM-DD' in Asia/Kathmandu.
 */
export function getKathmanduToday(refDate: Date = new Date()): string {
  return getKathmanduDate(0, refDate);
}
