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
  csrfDisabled?: boolean;
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

  // Rate limiter for login endpoint (20 attempts per 15 minutes per IP)
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

  // CSRF Protection middleware
  const csrfMiddleware = (req: Request, res: Response, next: NextFunction) => {
    if (options.csrfDisabled || config.nodeEnv === 'test' || req.path === '/csrf') {
      return next();
    }
    return doubleCsrfProtection(req, res, next);
  };

  // Mount routers
  app.use('/api/auth/login', loginLimiter);
  app.use('/api/auth', csrfMiddleware, authRouter);
  app.use('/api/admin/users', adminUsersRouter);
  app.use('/api/admin/settings', adminSettingsRouter);

  // 404 handler
  app.use((_req: Request, res: Response) => {
    res.status(404).json({ error: 'not_found', message: 'Route not found' });
  });

  // Global error handler
  app.use(errorHandler);

  return app;
}

export const app = createApp();
export default app;
