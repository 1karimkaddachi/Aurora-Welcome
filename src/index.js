import { config } from './config.js';
import { closeLogger, createLogger } from './logger.js';
import { cleanupSessions } from './db/repositories.js';
import { closeDb } from './db/index.js';
import { startDashboard } from './dashboard/server.js';
import { startBot } from './bot/index.js';
import { shutdownImagePool } from './welcome/image.js';

const log = createLogger('app');

cleanupSessions();

let server = null;
let client = null;
let shuttingDown = false;

async function shutdown(reason, exitCode = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  log.info(`Shutting down (${reason})`);
  try {
    if (server) await new Promise((resolve) => server.close(resolve));
  } catch {
    /* ignore */
  }
  try {
    if (client?.isReady()) await client.destroy();
  } catch {
    /* ignore */
  }
  try {
    await shutdownImagePool();
  } catch {
    /* ignore */
  }
  closeDb();
  await closeLogger();
  setTimeout(() => process.exit(exitCode), 100).unref();
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('unhandledRejection', (error) => {
  log.error('Unhandled promise rejection', {
    error: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : undefined,
  });
});
process.on('uncaughtException', (error) => {
  log.error('Uncaught exception', { error: error.message, stack: error.stack });
  shutdown('uncaughtException', 1);
});

async function main() {
  server = await startDashboard();
  client = await startBot();
  log.info('Aurora is running', {
    dashboard: config.dashboardUrl,
    bot: client?.user?.tag || 'offline',
    devAuth: config.devAuth,
  });
}

main().catch((error) => {
  log.error('Fatal startup error', { error: error.message, stack: error.stack });
  shutdown('startup failure', 1);
});
