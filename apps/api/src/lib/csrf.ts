import { doubleCsrf } from 'csrf-csrf';
import { config } from '../config.js';

const csrfInstance = doubleCsrf({
  getSecret: () => config.sessionSecret,
  cookieName: 'x-csrf-token',
  cookieOptions: {
    sameSite: 'strict',
    secure: config.isProduction,
    path: '/',
  },
  size: 64,
  ignoredMethods: ['GET', 'HEAD', 'OPTIONS'],
  getTokenFromRequest: (req) => req.headers['x-csrf-token'] as string,
});

export const { generateToken, validateRequest, doubleCsrfProtection } = csrfInstance;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const invalidCsrfTokenError: any = csrfInstance.invalidCsrfTokenError;
