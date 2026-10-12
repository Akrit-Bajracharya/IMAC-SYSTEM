import type { Request, Response, NextFunction } from 'express';
import { logger } from '../logger.js';

export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction) {
  logger.error({ err }, 'Unhandled error');
  if (res.headersSent) return;
  res.status(500).json({ error: 'internal_error', message: 'An internal error occurred' });
}
