import 'dotenv/config';

function requireEnv(key: string): string {
  const val = process.env[key];
  if (!val) {
    if (process.env['NODE_ENV'] === 'test') {
      return 'test_default_value_placeholder';
    }
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return val;
}

export const config = {
  databaseUrl: requireEnv('DATABASE_URL'),
  port: parseInt(process.env['PORT'] ?? '3001', 10),
  nodeEnv: process.env['NODE_ENV'] ?? 'development',
  logLevel: process.env['LOG_LEVEL'] ?? 'info',
  corsOrigin: process.env['CORS_ORIGIN'] ?? 'http://localhost:5173',
  sessionSecret: requireEnv('SESSION_SECRET'),
  sessionCookieName: process.env['SESSION_COOKIE_NAME'] ?? 'IMAC_SESSION',
  isProduction: process.env['NODE_ENV'] === 'production',
};
