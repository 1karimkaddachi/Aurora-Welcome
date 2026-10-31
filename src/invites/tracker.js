import { createLogger } from '../logger.js';
import {
  deleteStoredInvite,
  getStoredInvites,
  upsertInvite,
} from '../db/repositories.js';

const log = createLogger('invites');
const cache = new Map();
const failures = new Set();

function mapInvite(invite) {
  return {
    code: invite.code,
    uses: invite.uses || 0,
    maxUses: invite.maxUses || 0,
    inviterId: invite.inviter?.id || null,
    inviterName: invite.inviter?.username || null,
  };
}

export async function initGuildInvites(guild, { persist = true } = {}) {
  try {
    const invites = await guild.invites.fetch();
    const map = new Map();
    for (const invite of invites.values()) {
      const entry = mapInvite(invite);
      map.set(entry.code, entry);
      if (persist) upsertInvite(guild.id, entry);
    }
    cache.set(guild.id, map);
    failures.delete(guild.id);
    return map;
  } catch (error) {
    failures.add(guild.id);
    log.warn(`Cannot fetch invites for ${guild.name}`, { guildId: guild.id, error: error.message });
    const stored = new Map(getStoredInvites(guild.id).map((entry) => [entry.code, entry]));
    cache.set(guild.id, stored);
    return stored;
  }
}

export async function initAllInvites(client) {
  const guilds = [...client.guilds.cache.values()];
  await Promise.allSettled(guilds.map((guild) => initGuildInvites(guild)));
  log.info(`Invite cache initialized for ${guilds.length} guild(s)`);
}

export function updateCachedInvite(invite) {
  if (!invite.guild) return;
  const entry = mapInvite(invite);
  const map = cache.get(invite.guild.id) || new Map();
  map.set(entry.code, entry);
  cache.set(invite.guild.id, map);
  upsertInvite(invite.guild.id, entry);
}

export function removeCachedInvite(invite) {
  if (!invite.guild) return;
  const map = cache.get(invite.guild.id);
  map?.delete(invite.code);
  deleteStoredInvite(invite.guild.id, invite.code);
}

/**
 * Determines which invite was used. Discord exposes no direct attribution, so
 * we diff invite use counters before/after the join. Multiple simultaneous
 * joins can make attribution ambiguous; we return all candidates and pick the
 * one with the largest delta.
 */
export async function attributeJoin(guild, settings) {
  if (!settings?.inviteTracking) return { type: 'disabled', code: null, inviterId: null, inviterName: null };

  let fetched;
  try {
    fetched = await guild.invites.fetch();
  } catch (error) {
    if (!failures.has(guild.id)) {
      failures.add(guild.id);
      log.warn(`Invite attribution unavailable for ${guild.name}: ${error.message}`, { guildId: guild.id });
    }
    return { type: 'unknown', code: null, inviterId: null, inviterName: null, reason: 'fetch_failed' };
  }
  failures.delete(guild.id);

  const previous = cache.get(guild.id) || new Map();
  const current = new Map();
  const candidates = [];
  for (const invite of fetched.values()) {
    const entry = mapInvite(invite);
    current.set(entry.code, entry);
    const before = previous.get(entry.code)?.uses;
    if (before !== undefined && entry.uses > before) {
      candidates.push({ ...entry, delta: entry.uses - before });
    }
    upsertInvite(guild.id, entry);
  }
  for (const code of previous.keys()) {
    if (!current.has(code)) deleteStoredInvite(guild.id, code);
  }
  cache.set(guild.id, current);

  if (candidates.length > 0) {
    candidates.sort((a, b) => b.delta - a.delta);
    const chosen = candidates[0];
    return {
      type: 'normal',
      code: chosen.code,
      inviterId: chosen.inviterId,
      inviterName: chosen.inviterName,
      uses: chosen.uses,
      ambiguous: candidates.length > 1 ? candidates.map((item) => ({ code: item.code, inviterId: item.inviterId, delta: item.delta })) : null,
    };
  }

  if (settings.vanityTracking && guild.vanityURLCode) {
    return { type: 'vanity', code: guild.vanityURLCode, inviterId: null, inviterName: 'Vanity URL' };
  }
  return { type: 'unknown', code: null, inviterId: null, inviterName: null };
}

export function getCacheSnapshot(guildId) {
  const map = cache.get(guildId);
  return map ? [...map.values()] : [];
}

export function clearCache() {
  cache.clear();
  failures.clear();
}
