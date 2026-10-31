import { Router } from 'express';
import crypto from 'node:crypto';
import { config } from '../config.js';
import {
  createSession,
  deleteSession,
  getGuild,
  getSession,
  listGuilds,
  updateSessionTokens,
} from '../db/repositories.js';
import { createLogger } from '../logger.js';
import {
  HttpError,
  asyncHandler,
  parseCookies,
  sessionCookieOptions,
} from './http.js';

const log = createLogger('auth');
export const SESSION_COOKIE = 'aurora_session';
const STATE_COOKIE = 'aurora_oauth_state';
const MANAGE_GUILD = 0x20n;
const ADMINISTRATOR = 0x8n;
const guildCache = new Map();

function signState(raw) {
  return crypto.createHmac('sha256', config.sessionSecret).update(raw).digest('base64url');
}

function issueState(res) {
  const raw = crypto.randomBytes(18).toString('base64url');
  const state = `${raw}.${signState(raw)}`;
  res.cookie(STATE_COOKIE, state, {
    ...sessionCookieOptions(10 * 60 * 1000),
  });
  return state;
}

function verifyState(req) {
  const cookies = parseCookies(req.headers.cookie);
  const expected = cookies[STATE_COOKIE];
  const provided = String(req.query.state || '');
  if (!expected || !provided) return false;
  if (expected.length !== provided.length) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(provided));
  } catch {
    return false;
  }
}

function avatarUrl(userId, hash) {
  if (!hash) return `https://cdn.discordapp.com/embed/avatars/${Number(BigInt(userId) % 5n)}.png`;
  return `https://cdn.discordapp.com/avatars/${userId}/${hash}.png?size=128`;
}

export function userAvatarUrl(userId, hash) {
  try {
    return avatarUrl(userId, hash);
  } catch {
    return 'https://cdn.discordapp.com/embed/avatars/0.png';
  }
}

async function fetchJson(url, options) {
  const response = await fetch(url, { ...options, signal: AbortSignal.timeout(10_000) });
  let body = null;
  try {
    body = await response.json();
  } catch {
    body = null;
  }
  if (!response.ok) {
    const message = body?.error_description || body?.message || `Discord API returned ${response.status}.`;
    throw new HttpError(response.status === 401 ? 401 : 502, message);
  }
  return body;
}

async function exchangeCode(code) {
  const body = new URLSearchParams({
    client_id: config.discord.clientId,
    client_secret: config.discord.clientSecret,
    grant_type: 'authorization_code',
    code,
    redirect_uri: `${config.dashboardUrl}/auth/callback`,
  });
  return fetchJson('https://discord.com/api/v10/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
}

async function refreshToken(refresh) {
  const body = new URLSearchParams({
    client_id: config.discord.clientId,
    client_secret: config.discord.clientSecret,
    grant_type: 'refresh_token',
    refresh_token: refresh,
  });
  return fetchJson('https://discord.com/api/v10/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
}

async function ensureFreshToken(session) {
  if (!session.accessToken) return session;
  if (session.tokenExpiresAt && session.tokenExpiresAt > Date.now() + 60_000) return session;
  if (!session.refreshToken) return session;
  try {
    const token = await refreshToken(session.refreshToken);
    session.accessToken = token.access_token;
    session.refreshToken = token.refresh_token || session.refreshToken;
    session.tokenExpiresAt = Date.now() + Number(token.expires_in || 604800) * 1000;
    updateSessionTokens(session.id, {
      accessToken: session.accessToken,
      refreshToken: token.refresh_token,
      tokenExpiresAt: session.tokenExpiresAt,
    });
  } catch (error) {
    log.warn('OAuth token refresh failed', { error: error.message });
  }
  return session;
}

export function attachSession(req, res, next) {
  const cookies = parseCookies(req.headers.cookie);
  req.session = getSession(cookies[SESSION_COOKIE]);
  req.cookies = cookies;
  next();
}

export function requireAuth(req, res, next) {
  if (!req.session) return res.status(401).json({ error: 'Your dashboard session has expired. Please sign in again.' });
  next();
}

export async function getUserGuilds(session) {
  if (!session.accessToken) {
    const guilds = listGuilds();
    const filtered = config.devGuildId ? guilds.filter((guild) => guild.guildId === config.devGuildId) : guilds;
    return filtered.map((guild) => ({
      id: guild.guildId,
      name: guild.name,
      icon: guild.icon,
      memberCount: guild.memberCount,
      botPresent: guild.botPresent,
      permissions: 'dev',
      isOwner: true,
      isDev: true,
    }));
  }

  const cached = guildCache.get(session.id);
  if (cached && cached.expiresAt > Date.now()) return cached.guilds;

  await ensureFreshToken(session);
  const discordGuilds = await fetchJson('https://discord.com/api/v10/users/@me/guilds', {
    headers: { Authorization: `Bearer ${session.accessToken}` },
  });
  const managed = discordGuilds.filter((guild) => {
    const permissions = BigInt(guild.permissions);
    return guild.owner || (permissions & ADMINISTRATOR) !== 0n || (permissions & MANAGE_GUILD) !== 0n;
  });
  const databaseGuilds = new Map(listGuilds().map((guild) => [guild.guildId, guild]));
  const result = managed
    .filter((guild) => databaseGuilds.has(guild.id))
    .map((guild) => {
      const row = databaseGuilds.get(guild.id);
      return {
        id: guild.id,
        name: row.name || guild.name,
        icon: row.icon,
        iconUrl: row.icon || (guild.icon ? `https://cdn.discordapp.com/icons/${guild.id}/${guild.icon}.png?size=128` : null),
        memberCount: row.memberCount,
        botPresent: row.botPresent,
        permissions: String(guild.permissions),
        isOwner: Boolean(guild.owner),
      };
    });
  guildCache.set(session.id, { guilds: result, expiresAt: Date.now() + 60_000 });
  return result;
}

export async function requireGuild(req, res, next) {
  try {
    if (!req.session) return res.status(401).json({ error: 'Your dashboard session has expired. Please sign in again.' });
    const guildId = req.params.guildId;
    const guilds = await getUserGuilds(req.session);
    const access = guilds.find((guild) => guild.id === guildId);
    if (!access) return res.status(403).json({ error: 'You do not have Manage Server access to this community.' });
    const row = getGuild(guildId);
    if (!row) return res.status(404).json({ error: 'This server is not known to Aurora. Add the bot first.' });
    req.userGuilds = guilds;
    req.guildAccess = access;
    req.guildRow = row;
    return next();
  } catch (error) {
    if (error.status === 401) {
      return res.status(401).json({ error: 'Discord rejected the stored session. Sign in again.' });
    }
    return res.status(error.status || 502).json({ error: error.message || 'Could not verify Discord permissions.' });
  }
}

export const authRouter = Router();

authRouter.get('/login', (req, res) => {
  if (!config.discord.clientId || !config.discord.clientSecret) {
    return res.redirect('/login?error=oauth_not_configured');
  }
  const state = issueState(res);
  const url = new URL('https://discord.com/oauth2/authorize');
  url.searchParams.set('client_id', config.discord.clientId);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('redirect_uri', `${config.dashboardUrl}/auth/callback`);
  url.searchParams.set('scope', 'identify guilds');
  url.searchParams.set('state', state);
  url.searchParams.set('prompt', 'none');
  return res.redirect(url.toString());
});

authRouter.get(
  '/callback',
  asyncHandler(async (req, res) => {
    if (req.query.error) {
      return res.redirect(`/login?error=${encodeURIComponent(String(req.query.error))}`);
    }
    if (!verifyState(req)) throw new HttpError(400, 'OAuth state verification failed. Please try signing in again.');
    if (!req.query.code) throw new HttpError(400, 'Missing OAuth authorization code.');

    const token = await exchangeCode(String(req.query.code));
    const user = await fetchJson('https://discord.com/api/v10/users/@me', {
      headers: { Authorization: `Bearer ${token.access_token}` },
    });
    const sessionId = createSession({
      id: user.id,
      username: user.username,
      globalName: user.global_name,
      avatar: user.avatar,
      accessToken: token.access_token,
      refreshToken: token.refresh_token,
      tokenExpiresAt: Date.now() + Number(token.expires_in || 604800) * 1000,
    });
    res.clearCookie(STATE_COOKIE, { path: '/' });
    res.cookie(SESSION_COOKIE, sessionId, sessionCookieOptions());
    log.info(`Dashboard login for ${user.username}`, { userId: user.id });
    return res.redirect('/');
  }),
);

authRouter.post(
  '/dev',
  asyncHandler(async (req, res) => {
    if (!config.devAuth) throw new HttpError(403, 'Developer sign-in is disabled.');
    const guilds = listGuilds();
    const targetId = config.devGuildId || req.body?.guildId || guilds[0]?.guildId;
    if (!targetId || !getGuild(targetId)) {
      throw new HttpError(400, 'No guild is available. Run `npm run seed:dev` or start the bot first.');
    }
    const userId = config.devUserId || '000000000000000001';
    const sessionId = createSession({
      id: userId,
      username: 'Dev Admin',
      globalName: 'Dev Admin',
      avatar: null,
      accessToken: null,
      refreshToken: null,
      tokenExpiresAt: null,
    });
    res.cookie(SESSION_COOKIE, sessionId, sessionCookieOptions());
    return res.json({ ok: true });
  }),
);

authRouter.post(
  '/logout',
  asyncHandler(async (req, res) => {
    if (req.session) deleteSession(req.session.id);
    res.clearCookie(SESSION_COOKIE, { path: '/' });
    res.clearCookie(STATE_COOKIE, { path: '/' });
    return res.json({ ok: true });
  }),
);

export { avatarUrl };
