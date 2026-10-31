import fs from 'node:fs';
import path from 'node:path';
import { config } from './config.js';

const LEVELS = { debug: 10, info: 20, warn: 30, error: 40 };
const threshold = LEVELS[config.logLevel] || LEVELS.info;
const logFile = path.join(config.dataDir, 'aurora.log');
let fileStream = null;

try {
  fileStream = fs.createWriteStream(logFile, { flags: 'a' });
} catch {
  fileStream = null;
}

function write(level, scope, message, meta) {
  if (LEVELS[level] < threshold) return;
  const line = {
    time: new Date().toISOString(),
    level,
    scope,
    message,
    ...(meta ? { meta } : {}),
  };
  const text = `[${line.time}] ${level.toUpperCase()} ${scope}: ${message}${meta ? ' ' + safeJson(meta) : ''}`;
  if (level === 'error') console.error(text);
  else if (level === 'warn') console.warn(text);
  else console.log(text);
  fileStream?.write(safeJson(line) + '\n');
}

function safeJson(value) {
  try {
    return JSON.stringify(value, (key, val) => {
      if (typeof val === 'bigint') return val.toString();
      if (val instanceof Error) return { name: val.name, message: val.message, stack: val.stack };
      return val;
    });
  } catch {
    return '"[unserializable]"';
  }
}

export function closeLogger() {
  return new Promise((resolve) => {
    const stream = fileStream;
    fileStream = null;
    if (!stream) {
      resolve();
      return;
    }
    try {
      stream.end(resolve);
    } catch {
      resolve();
    }
  });
}

export function createLogger(scope) {
  return {
    debug: (message, meta) => write('debug', scope, message, meta),
    info: (message, meta) => write('info', scope, message, meta),
    warn: (message, meta) => write('warn', scope, message, meta),
    error: (message, meta) => write('error', scope, message, meta),
  };
}

export const logger = createLogger('core');
