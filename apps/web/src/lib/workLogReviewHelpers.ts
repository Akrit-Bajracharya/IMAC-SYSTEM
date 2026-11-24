/**
 * Pure helper functions for Work Log settings, history, export, and error resolution.
 * All logic is purely functional, side-effect free, and unit tested.
 */

/**
 * Validates that an input is a real calendar date in YYYY-MM-DD format.
 * Strictly verifies 4-digit year, 2-digit month (01-12), and valid day-of-month bounds,
 * correctly accounting for February in leap years vs non-leap years.
 */
export function isValidCalendarDate(dateStr?: unknown): boolean {
  if (typeof dateStr !== 'string') return false;
  const trimmed = dateStr.trim();
  if (!trimmed) return false;

  const match = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return false;

  const year = parseInt(match[1]!, 10);
  const month = parseInt(match[2]!, 10);
  const day = parseInt(match[3]!, 10);

  if (isNaN(year) || isNaN(month) || isNaN(day)) return false;
  if (year < 1000 || year > 9999) return false;
  if (month < 1 || month > 12) return false;

  // Use UTC date to determine exact max days in month (month parameter 1-indexed, day 0 gives last day of month)
  const maxDays = new Date(Date.UTC(year, month, 0)).getUTCDate();
  if (day < 1 || day > maxDays) return false;

  return true;
}

export interface ResolvedWorkLogError {
  code: string;
  messageKey: string;
  isNetworkError: boolean;
  status?: number;
  defaultMessage: string;
}

/**
 * Resolves API and network errors into a consistent structure with code, messageKey, and status.
 * - Only treats data.error as a code if it is a non-empty string.
 * - A missing response maps to code: 'network_error' with a user-friendly message.
 */
export function resolveWorkLogErrorInfo(error: unknown): ResolvedWorkLogError {
  const err = error as {
    response?: {
      status?: number;
      data?: {
        error?: unknown;
        message?: unknown;
      };
    };
  } | null | undefined;

  // Missing response indicates network / connection failure
  if (!err || !err.response) {
    return {
      code: 'network_error',
      messageKey: 'common.networkError',
      isNetworkError: true,
      status: undefined,
      defaultMessage: 'Network connection error. Please check your connection and try again.',
    };
  }

  const status = typeof err.response.status === 'number' ? err.response.status : undefined;
  const rawError = err.response.data?.error;

  // Only treat data.error as a code if it is a non-empty string
  let code: string;
  if (typeof rawError === 'string' && rawError.trim().length > 0) {
    code = rawError.trim();
  } else if (status === 403) {
    code = 'forbidden';
  } else if (status === 404) {
    code = 'not_found';
  } else if (status === 401) {
    code = 'unauthorized';
  } else {
    code = 'unknown_error';
  }

  let messageKey: string;
  let defaultMessage: string;

  switch (code) {
    case 'forbidden':
      messageKey = 'common.forbidden';
      defaultMessage = 'You do not have permission to perform this action.';
      break;
    case 'not_found':
      messageKey = 'common.notFound';
      defaultMessage = 'The requested resource was not found.';
      break;
    case 'unauthorized':
      messageKey = 'common.unauthorized';
      defaultMessage = 'Session expired. Please log in again.';
      break;
    case 'network_error':
      messageKey = 'common.networkError';
      defaultMessage = 'Network connection error. Please check your connection and try again.';
      break;
    case 'profile_not_found':
      messageKey = 'dashboard.noProfileTitle';
      defaultMessage = 'Employee profile not found.';
      break;
    default:
      messageKey = 'common.unknownError';
      defaultMessage = 'An unexpected error occurred. Please try again.';
      break;
  }

  return {
    code,
    messageKey,
    isNetworkError: false,
    status,
    defaultMessage,
  };
}

/**
 * Pure decision helper for whether to hydrate form state from settings query.
 * Hydrates only if the form is not yet hydrated or the user has not edited (not dirty).
 * Never overwrites typed input on background refetches.
 */
export function shouldHydrateSettings(isHydrated: boolean, isDirty: boolean): boolean {
  if (!isHydrated) return true;
  if (!isDirty) return true;
  return false;
}

/**
 * Validates week start date before updating state.
 * Never stores or allows empty strings.
 */
export function shouldUpdateWeekStartDate(newDate?: unknown): boolean {
  if (typeof newDate !== 'string') return false;
  return newDate.trim().length > 0;
}
