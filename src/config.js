import 'dotenv/config';
import path from 'node:path';
import crypto from 'node:crypto';
import fs from 'node:fs';

const rootDir = process.cwd();
const dataDir = path.resolve(rootDir, process.env.DATA_DIR || './data');
const isProduction = process.env.NODE_ENV === 'production';

fs.mkdirSync(dataDir, { recursive: true });
fs.mkdirSync(path.join(dataDir, 'uploads'), { recursive: true });
fs.mkdirSync(path.join(dataDir, 'generated'), { recursive: true });

let sessionSecret = process.env.SESSION_SECRET || '';
if (!sessionSecret || sessionSecret === 'replace-me-with-a-long-random-string') {
  if (isProduction) {
    throw new Error('SESSION_SECRET must be set to a long random string in production.');
  }
  sessionSecret = crypto.randomBytes(48).toString('hex');
}

const bool = (value, fallback = false) => {
  if (value === undefined) return fallback;
  return ['1', 'true', 'yes', 'on'].includes(String(value).toLowerCase());
};

export const config = {
  rootDir,
  dataDir,
  uploadsDir: path.join(dataDir, 'uploads'),
  generatedDir: path.join(dataDir, 'generated'),
  dbPath: path.join(dataDir, 'aurora.db'),
  isProduction,
  port: Number(process.env.PORT || 3000),
  dashboardUrl: (process.env.DASHBOARD_URL || 'http://localhost:3000').replace(/\/$/, ''),
  sessionSecret,
  sessionTtlMs: 1000 * 60 * 60 * 24 * 7,
  logLevel: process.env.LOG_LEVEL || 'info',
  discord: {
    token: process.env.DISCORD_TOKEN || '',
    clientId: process.env.DISCORD_CLIENT_ID || '',
    clientSecret: process.env.DISCORD_CLIENT_SECRET || '',
    guildId: process.env.DISCORD_GUILD_ID || '',
  },
  devAuth: !isProduction && bool(process.env.ALLOW_DEV_AUTH),
  devGuildId: process.env.DEV_GUILD_ID || '',
  devUserId: process.env.DEV_USER_ID || '',
  imageWorkerCount: Math.max(1, Math.min(4, Number(process.env.IMAGE_WORKERS || 2))),
  limits: {
    uploadBytes: 8 * 1024 * 1024,
    imageQueue: 40,
    dashboardRequestsPerMinute: 240,
    authAttemptsPerMinute: 30,
    interactionCooldownMs: 1500,
  },
};

export function assertBotConfigured() {
  const missing = [];
  if (!config.discord.token) missing.push('DISCORD_TOKEN');
  if (!config.discord.clientId) missing.push('DISCORD_CLIENT_ID');
  return missing;
}
