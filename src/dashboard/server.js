import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { config } from '../config.js';
import { createLogger } from '../logger.js';
import { attachSession, authRouter } from './auth.js';
import { apiRouter } from './api.js';
import {
  errorMiddleware,
  rateLimit,
  requireSameOrigin,
  securityHeaders,
} from './http.js';

const log = createLogger('dashboard');
const publicDir = path.join(config.rootDir, 'public');

export function createDashboardApp() {
  const app = express();
  app.disable('x-powered-by');
  if (config.isProduction) app.set('trust proxy', 1);

  app.use(securityHeaders);
  app.use(express.json({ limit: '2mb' }));
  app.use(attachSession);

  app.use(
    '/auth',
    requireSameOrigin,
    rateLimit({ windowMs: 60_000, max: config.limits.authAttemptsPerMinute, prefix: 'auth' }),
    authRouter,
  );
  app.use(
    '/api',
    requireSameOrigin,
    rateLimit({ windowMs: 60_000, max: config.limits.dashboardRequestsPerMinute, prefix: 'api' }),
    (req, res, next) => {
      res.setHeader('Cache-Control', 'no-store');
      next();
    },
    apiRouter,
  );

  if (fs.existsSync(publicDir)) {
    app.use(
      express.static(publicDir, {
        index: false,
        maxAge: '1y',
        immutable: true,
        setHeaders(res, filePath) {
          if (filePath.endsWith('.html')) res.setHeader('Cache-Control', 'no-store');
        },
      }),
    );
  }

  app.get('*', (req, res) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/auth')) {
      return res.status(404).json({ error: 'Not found.' });
    }
    const indexPath = path.join(publicDir, 'index.html');
    if (!fs.existsSync(indexPath)) {
      return res
        .status(503)
        .type('text/plain')
        .send('Dashboard assets are not built yet. Run `npm run build`, then restart the app.');
    }
    res.setHeader('Cache-Control', 'no-store');
    return res.sendFile(indexPath);
  });

  app.use(errorMiddleware);
  return app;
}

export function startDashboard() {
  const app = createDashboardApp();
  return new Promise((resolve, reject) => {
    const server = app.listen(config.port, () => {
      log.info(`Dashboard listening on ${config.dashboardUrl}`, { port: config.port });
      resolve(server);
    });
    server.on('error', reject);
  });
}
