import type { Request, Response, NextFunction } from 'express';

type AsyncRouteHandler = (req: Request, res: Response, next: NextFunction) => Promise<unknown>;

/**
 * SEC-02: Wraps an async Express route handler so that any rejected Promise is
 * forwarded to next(err), letting the global errorHandler return HTTP 500 rather
 * than hanging the request or crashing the process.
 *
 * Express 4 does NOT automatically propagate unhandled Promise rejections from
 * route callbacks to the error-handler chain. Without this wrapper, a database
 * timeout or any other thrown error in an async route would cause an
 * unhandledRejection event and, in modern Node.js runtimes, terminate the process.
 */
export function asyncHandler(fn: AsyncRouteHandler) {
  return (req: Request, res: Response, next: NextFunction): void => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
