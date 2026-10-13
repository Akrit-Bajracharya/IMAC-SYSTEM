import express, { type Request, type Response, type NextFunction } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { pinoHttp } from 'pino-http';
import rateLimit from 'express-rate-limit';
import { config } from './config.js';
import { logger } from './logger.js';
import { doubleCsrfProtection } from './lib/csrf.js';
import { errorHandler } from './middleware/errorHandler.js';
import { authRouter } from './routes/auth.js';
import { adminUsersRouter } from './routes/admin/users.js';
import { adminSettingsRouter } from './routes/admin/settings.js';

export interface AppOptions {
  /** Disable CSRF protection entirely (use only in automated tests). */
  csrfDisabled?: boolean;
  /**
   * Force CSRF protection on even when NODE_ENV=test.
   * Use this in tests that specifically verify CSRF behaviour (SEC-01).
   */
  csrfEnabled?: boolean;
}

export function createApp(options: AppOptions = {}) {
  const app = express();

  // 1. Helmet security headers
  app.use(helmet());

  // 2. CORS configuration
  app.use(
    cors({
      origin: config.corsOrigin,
      credentials: true,
    }),
  );

  // 3. Body parsing with size limit
  app.use(express.json({ limit: '10kb' }));

  // 4. Cookie parser
  app.use(cookieParser());

  // 5. Structured HTTP logging (skip during tests to avoid log spam)
  if (config.nodeEnv !== 'test') {
    app.use(pinoHttp({ logger }));
  }

  // ── Rate limiters ─────────────────────────────────────────────────────────────

  // SEC-03: Rate limiter for the login endpoint (20 attempts per 15 min per IP).
  const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 20,
    standardHeaders: true,
    legacyHeaders: false,
    skip: () => config.nodeEnv === 'test',
    message: {
      error: 'too_many_requests',
      message: 'Too many login attempts from this IP, please try again later',
    },
  });

  // SEC-03: Rate limiter for the change-password endpoint (10 per 15 min per IP).
  // Prevents session-cookie theft being used to brute-force the current password.
  const changePasswordLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    skip: () => config.nodeEnv === 'test',
    message: {
      error: 'too_many_requests',
      message: 'Too many password change attempts, please try again later',
    },
  });

  // SEC-03: Rate limiter applied to admin user routes; the skip function restricts
  // it to POST /:id/reset-password only, so user listing and other admin GETs are
  // not throttled (10 resets per 15 min per IP).
  const resetPasswordLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => config.nodeEnv === 'test' || !req.path.endsWith('/reset-password'),
    message: {
      error: 'too_many_requests',
      message: 'Too many password reset attempts, please try again later',
    },
  });

  // ── CSRF middleware factory ───────────────────────────────────────────────────
  //
  // SEC-01: CSRF protection is applied to EVERY state-changing API route, including
  // /api/admin/*, via the csrfMiddleware factory below.
  //
  // Why login is NOT exempt:
  //   POST /api/auth/login IS CSRF-protected. The frontend first calls
  //   GET /api/auth/csrf to obtain a token (stored in a SameSite=Strict cookie +
  //   returned in JSON), then includes it as x-csrf-token on the login request.
  //   There is therefore no design reason to exempt login.
  //
  // Why GET /api/auth/csrf is exempt:
  //   It is the token-issue endpoint itself; protecting it would create a bootstrap
  //   deadlock. It is also a GET (read-only), which csrf-csrf already ignores via
  //   ignoredMethods, but we skip our wrapper too for clarity.
  const csrfMiddleware = (req: Request, res: Response, next: NextFunction) => {
    // Allow tests to opt out globally (csrfDisabled) or opt in (csrfEnabled).
    const isTestBypass = !options.csrfEnabled && (options.csrfDisabled || config.nodeEnv === 'test');
    if (isTestBypass || req.path === '/csrf') {
      return next();
    }
    return doubleCsrfProtection(req, res, next);
  };

  // ── Route mounting ────────────────────────────────────────────────────────────

  app.use('/api/auth/login', loginLimiter);
  app.use('/api/auth/change-password', changePasswordLimiter);         // SEC-03
  app.use('/api/admin/users', resetPasswordLimiter);                   // SEC-03

  // SEC-01: csrfMiddleware is mounted on auth AND admin routes.
  app.use('/api/auth', csrfMiddleware, authRouter);
  app.use('/api/admin/users', csrfMiddleware, adminUsersRouter);       // SEC-01 (was unprotected)
  app.use('/api/admin/settings', csrfMiddleware, adminSettingsRouter); // SEC-01 (was unprotected)

  // 404 handler
  app.use((_req: Request, res: Response) => {
    res.status(404).json({ error: 'not_found', message: 'Route not found' });
  });

  // Global error handler (SEC-04: maps CSRF → 403, bad JSON → 400, etc.)
  app.use(errorHandler);

  return app;
}

export const app = createApp();
export default app;
