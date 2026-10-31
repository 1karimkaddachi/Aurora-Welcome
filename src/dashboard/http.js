import { config } from '../config.js';

export class HttpError extends Error {
  constructor(status, message, field = null) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
    this.field = field;
  }
}

export const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

export function parseCookies(header = '') {
  const cookies = {};
  for (const part of String(header).split(';')) {
    const index = part.indexOf('=');
    if (index === -1) continue;
    const key = part.slice(0, index).trim();
    const value = part.slice(index + 1).trim();
    if (!key) continue;
    try {
      cookies[key] = decodeURIComponent(value);
    } catch {
      cookies[key] = value;
    }
  }
  return cookies;
}

const secureCookies = config.dashboardUrl.startsWith('https://');

export function sessionCookieOptions(maxAgeMs = config.sessionTtlMs) {
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: secureCookies,
    path: '/',
    maxAge: maxAgeMs,
  };
}

function originOf(value) {
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

const allowedOrigins = new Set([originOf(config.dashboardUrl)].filter(Boolean));

export function requireSameOrigin(req, res, next) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  const origin = req.get('origin');
  if (!origin) return next();
  if (!allowedOrigins.has(originOf(origin))) {
    return res.status(403).json({ error: 'Cross-origin request blocked.' });
  }
  return next();
}

export function securityHeaders(req, res, next) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  res.setHeader(
    'Content-Security-Policy',
    [
      "default-src 'self'",
      "img-src 'self' blob: data: https://cdn.discordapp.com https://media.discordapp.net",
      "style-src 'self' 'unsafe-inline'",
      "script-src 'self'",
      "font-src 'self' data:",
      "connect-src 'self'",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self' https://discord.com",
    ].join('; '),
  );
  next();
}

const buckets = new Map();

export function rateLimit({ windowMs = 60_000, max = 240, prefix = 'global' } = {}) {
  return (req, res, next) => {
    const key = `${prefix}:${req.ip}`;
    const now = Date.now();
    let bucket = buckets.get(key);
    if (!bucket || bucket.resetAt <= now) {
      bucket = { count: 0, resetAt: now + windowMs };
      buckets.set(key, bucket);
    }
    bucket.count += 1;
    if (bucket.count > max) {
      res.setHeader('Retry-After', Math.ceil((bucket.resetAt - now) / 1000));
      return res.status(429).json({ error: 'Too many requests. Please slow down.' });
    }
    if (buckets.size > 10_000) {
      for (const [entry, value] of buckets) if (value.resetAt <= now) buckets.delete(entry);
    }
    return next();
  };
}

export function errorMiddleware(error, req, res, next) {
  if (res.headersSent) return next(error);
  let status = error.status || (error.name === 'ValidationError' ? 400 : 500);
  let message = error.message;
  if (error.name === 'MulterError') {
    status = 400;
    message = error.code === 'LIMIT_FILE_SIZE' ? 'That image is too large.' : `Upload failed: ${error.message}`;
  }
  if (status >= 500) {
    // eslint-disable-next-line no-console
    console.error('[dashboard]', error);
  }
  const body = { error: status >= 500 ? 'Internal server error.' : message };
  if (error.field) body.field = error.field;
  return res.status(status).json(body);
}
