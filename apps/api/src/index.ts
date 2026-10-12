import { app } from './app.js';
import { config } from './config.js';
import { logger } from './logger.js';
import { cleanExpiredSessions } from './services/session.js';

const PORT = config.port;

// 1. Session cleanup interval (every 5 minutes)
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000;
const cleanupInterval = setInterval(async () => {
  try {
    const cleanedCount = await cleanExpiredSessions();
    if (cleanedCount > 0) {
      logger.info({ cleanedCount }, 'Expired sessions cleaned up');
    }
  } catch (err) {
    logger.error({ err }, 'Error running periodic session cleanup');
  }
}, CLEANUP_INTERVAL_MS);

// 2. Start server
const server = app.listen(PORT, () => {
  logger.info(`IMAC API server started on port ${PORT} [env=${config.nodeEnv}]`);
});

// 3. Graceful shutdown handler
function handleShutdown(signal: string) {
  logger.info({ signal }, 'Received shutdown signal, closing server gracefully...');
  clearInterval(cleanupInterval);

  server.close(() => {
    logger.info('HTTP server closed');
    process.exit(0);
  });

  // Force exit if not closed within 10 seconds
  setTimeout(() => {
    logger.error('Could not close connections in time, forcefully shutting down');
    process.exit(1);
  }, 10000);
}

process.on('SIGTERM', () => handleShutdown('SIGTERM'));
process.on('SIGINT', () => handleShutdown('SIGINT'));
