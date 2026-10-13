import type { Request, Response, NextFunction } from 'express';
import { logger } from '../logger.js';

/**
 * SEC-04: Central error handler.
 *
 * Maps known error types to appropriate HTTP status codes instead of
 * unconditionally returning 500 for all errors:
 *   - CSRF token failures  → 403 Forbidden
 *   - Malformed JSON body  → 400 Bad Request
 *   - Errors with 4xx status property → honour that status
 *   - Everything else      → 500 Internal Server Error (logged)
 */
export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (res.headersSent) return;

  if (err !== null && typeof err === 'object') {
    const e = err as Record<string, unknown>;

    // CSRF token failures → 403 Forbidden
    if (e['code'] === 'EBADCSRFTOKEN') {
      return res.status(403).json({ error: 'csrf_invalid', message: 'Invalid or missing CSRF token' });
    }

    // Express body-parser SyntaxError (malformed JSON) → 400 Bad Request
    if (err instanceof SyntaxError && (e['status'] === 400 || e['statusCode'] === 400)) {
      return res.status(400).json({ error: 'invalid_json', message: 'Request body contains invalid JSON' });
    }

    // Honour any explicit 4xx status already on the error object
    const httpStatus = (e['status'] as number) || (e['statusCode'] as number);
    if (typeof httpStatus === 'number' && httpStatus >= 400 && httpStatus < 500) {
      logger.warn({ err }, 'Client error');
      return res.status(httpStatus).json({
        error: 'request_error',
        message: typeof e['message'] === 'string' ? e['message'] : 'Request error',
      });
    }
  }

  // Everything else is an unexpected server error: log it and return 500.
  logger.error({ err }, 'Unhandled error');
  res.status(500).json({ error: 'internal_error', message: 'An internal error occurred' });
}
