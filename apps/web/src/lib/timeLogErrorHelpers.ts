/**
 * Maps time log error codes to user-friendly messages.
 */

import { getProjectErrorInfo } from '../api/projects.js';

export function mapTimeLogError(
  err: any,
  t: (key: string, options?: any) => string
): string {
  const errInfo = getProjectErrorInfo(err);

  switch (errInfo.error) {
    case 'daily_hours_exceeded':
      return t(
        'projects.timeLogs.errors.dailyHoursExceeded',
        'Total logged hours for this day across all projects cannot exceed 24.'
      );
    case 'invalid_date_range':
      return t(
        'projects.timeLogs.errors.invalidDateRange',
        'Date must be within 90 days in the past and at most 1 day in the future.'
      );
    case 'invalid_task':
      return t(
        'projects.timeLogs.errors.invalidTask',
        'Selected task does not belong to this project.'
      );
    case 'invalid_cursor':
      return t(
        'projects.timeLogs.errors.invalidCursor',
        'Pagination cursor is invalid. Refreshing list.'
      );
    case 'validation_error':
      return t(
        'projects.timeLogs.errors.validationError',
        'Please check entered values (positive hours in 0.25 steps up to 24h).'
      );
    case 'forbidden':
      return t(
        'projects.timeLogs.errors.forbidden',
        'You do not have permission to perform this action.'
      );
    case 'not_found':
      return t(
        'projects.timeLogs.errors.notFound',
        'Project, task or time log not found.'
      );
    default:
      if (errInfo.status === 403) {
        return t(
          'projects.timeLogs.errors.forbidden',
          'You do not have permission to perform this action.'
        );
      }
      if (errInfo.status === 404) {
        return t(
          'projects.timeLogs.errors.notFound',
          'Project, task or time log not found.'
        );
      }
      return errInfo.message || t('common.unknownError', 'An unexpected error occurred.');
  }
}
