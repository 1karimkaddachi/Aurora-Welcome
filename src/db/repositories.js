import crypto from 'node:crypto';
import { db, queries, jsonParse, transaction } from './index.js';
import {
  DEFAULT_DM_CONTENT,
  DEFAULT_GUILD_SETTINGS,
  DEFAULT_IMAGE_CONFIG,
  DEFAULT_LEAVE_CONTENT,
  DEFAULT_LEAVE_IMAGE_CONFIG,
  DEFAULT_LEAVE_SETTINGS,
  DEFAULT_WELCOME_CONTENT,
  DEFAULT_WELCOME_SETTINGS,
} from '../shared/defaults.js';

const now = () => Date.now();
const id = () => crypto.randomUUID();
const bool = (value) => (value ? 1 : 0);
const toBool = (value) => value === 1 || value === true;
const clone = (value) => structuredClone(value);

// ── Guilds ─────────────────────────────────────────────────────────

export function ensureGuild({
  guildId,
  name,
  icon = null,
  ownerId = null,
  memberCount = 0,
  botPresent = 1,
  joinedAt = now(),
}) {
  const timestamp = now();
  queries.run(
    `INSERT INTO guilds (guild_id, name, icon, owner_id, member_count, bot_present, joined_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(guild_id) DO UPDATE SET
       name = excluded.name,
       icon = excluded.icon,
       owner_id = COALESCE(excluded.owner_id, guilds.owner_id),
       member_count = CASE WHEN excluded.member_count > 0 THEN excluded.member_count ELSE guilds.member_count END,
       bot_present = excluded.bot_present,
       updated_at = excluded.updated_at`,
    guildId,
    name,
    icon,
    ownerId,
    memberCount,
    bool(botPresent),
    joinedAt,
    timestamp,
  );
  ensureGuildConfigs(guildId);
  return getGuild(guildId);
}

export function getGuild(guildId) {
  const row = queries.get('SELECT * FROM guilds WHERE guild_id = ?', guildId);
  if (!row) return null;
  return {
    guildId: row.guild_id,
    name: row.name,
    icon: row.icon,
    ownerId: row.owner_id,
    memberCount: row.member_count,
    botPresent: toBool(row.bot_present),
    joinedAt: row.joined_at,
    updatedAt: row.updated_at,
  };
}

export function listGuilds() {
  return queries
    .all('SELECT * FROM guilds ORDER BY name COLLATE NOCASE')
    .map((row) => ({
      guildId: row.guild_id,
      name: row.name,
      icon: row.icon,
      ownerId: row.owner_id,
      memberCount: row.member_count,
      botPresent: toBool(row.bot_present),
      joinedAt: row.joined_at,
    }));
}

export function setGuildMemberCount(guildId, memberCount) {
  queries.run('UPDATE guilds SET member_count = ?, updated_at = ? WHERE guild_id = ?', memberCount, now(), guildId);
}

export function markGuildBotMissing(guildId) {
  queries.run('UPDATE guilds SET bot_present = 0, updated_at = ? WHERE guild_id = ?', now(), guildId);
}

export function deleteGuild(guildId) {
  queries.run('DELETE FROM guilds WHERE guild_id = ?', guildId);
}

// ── Welcome config ─────────────────────────────────────────────────

export function ensureGuildConfigs(guildId) {
  const timestamp = now();
  queries.run(
    `INSERT OR IGNORE INTO welcome_configs
      (guild_id, enabled, style, content_json, image_json, send_mode, bot_mode, returning_mode, dm_content_json, updated_at)
     VALUES (?, 1, 'classic', ?, ?, 'public', 'enabled', 'returning', ?, ?)`,
    guildId,
    JSON.stringify(DEFAULT_WELCOME_CONTENT),
    JSON.stringify(DEFAULT_IMAGE_CONFIG),
    JSON.stringify(DEFAULT_DM_CONTENT),
    timestamp,
  );
  queries.run(
    `INSERT OR IGNORE INTO leave_configs
      (guild_id, enabled, style, content_json, image_json, send_mode, updated_at)
     VALUES (?, 1, 'classic', ?, ?, 'public', ?)`,
    guildId,
    JSON.stringify(DEFAULT_LEAVE_CONTENT),
    JSON.stringify(DEFAULT_LEAVE_IMAGE_CONFIG),
    timestamp,
  );
  queries.run(
    `INSERT OR IGNORE INTO guild_settings
      (guild_id, updated_at) VALUES (?, ?)`,
    guildId,
    timestamp,
  );
}

function mapWelcomeRow(row) {
  if (!row) return null;
  return {
    guildId: row.guild_id,
    enabled: toBool(row.enabled),
    channels: {
      main: row.main_channel_id,
      secondary: row.secondary_channel_id,
      rules: row.rules_channel_id,
      introductions: row.intros_channel_id,
      announcements: row.announcements_channel_id,
    },
    style: row.style,
    sendMode: row.send_mode,
    botMode: row.bot_mode,
    returningMode: row.returning_mode,
    content: jsonParse(row.content_json, clone(DEFAULT_WELCOME_CONTENT)),
    image: jsonParse(row.image_json, clone(DEFAULT_IMAGE_CONFIG)),
    dmContent: jsonParse(row.dm_content_json, clone(DEFAULT_DM_CONTENT)),
    updatedAt: row.updated_at,
  };
}

export function getWelcomeConfig(guildId) {
  const row = queries.get('SELECT * FROM welcome_configs WHERE guild_id = ?', guildId);
  if (!row) {
    ensureGuildConfigs(guildId);
    return mapWelcomeRow(queries.get('SELECT * FROM welcome_configs WHERE guild_id = ?', guildId));
  }
  return mapWelcomeRow(row);
}

export function saveWelcomeConfig(guildId, cfg) {
  ensureGuildConfigs(guildId);
  queries.run(
    `UPDATE welcome_configs SET
      enabled = ?, main_channel_id = ?, secondary_channel_id = ?, rules_channel_id = ?,
      intros_channel_id = ?, announcements_channel_id = ?, style = ?, content_json = ?,
      image_json = ?, send_mode = ?, bot_mode = ?, returning_mode = ?, dm_content_json = ?, updated_at = ?
     WHERE guild_id = ?`,
    bool(cfg.enabled),
    cfg.channels?.main ?? null,
    cfg.channels?.secondary ?? null,
    cfg.channels?.rules ?? null,
    cfg.channels?.introductions ?? null,
    cfg.channels?.announcements ?? null,
    cfg.style,
    JSON.stringify(cfg.content),
    JSON.stringify(cfg.image),
    cfg.sendMode,
    cfg.botMode,
    cfg.returningMode,
    JSON.stringify(cfg.dmContent),
    now(),
    guildId,
  );
  return getWelcomeConfig(guildId);
}

// ── Leave config ───────────────────────────────────────────────────

export function getLeaveConfig(guildId) {
  let row = queries.get('SELECT * FROM leave_configs WHERE guild_id = ?', guildId);
  if (!row) {
    ensureGuildConfigs(guildId);
    row = queries.get('SELECT * FROM leave_configs WHERE guild_id = ?', guildId);
  }
  return {
    guildId: row.guild_id,
    enabled: toBool(row.enabled),
    channelId: row.channel_id,
    style: row.style,
    content: jsonParse(row.content_json, clone(DEFAULT_LEAVE_CONTENT)),
    image: jsonParse(row.image_json, clone(DEFAULT_LEAVE_IMAGE_CONFIG)),
    sendMode: row.send_mode,
    updatedAt: row.updated_at,
  };
}

export function saveLeaveConfig(guildId, cfg) {
  ensureGuildConfigs(guildId);
  queries.run(
    `UPDATE leave_configs SET enabled = ?, channel_id = ?, style = ?, content_json = ?, image_json = ?, send_mode = ?, updated_at = ?
     WHERE guild_id = ?`,
    bool(cfg.enabled),
    cfg.channelId ?? null,
    cfg.style,
    JSON.stringify(cfg.content),
    JSON.stringify(cfg.image),
    cfg.sendMode,
    now(),
    guildId,
  );
  return getLeaveConfig(guildId);
}

// ── Guild settings ─────────────────────────────────────────────────

export function getGuildSettings(guildId) {
  let row = queries.get('SELECT * FROM guild_settings WHERE guild_id = ?', guildId);
  if (!row) {
    ensureGuildConfigs(guildId);
    row = queries.get('SELECT * FROM guild_settings WHERE guild_id = ?', guildId);
  }
  return {
    guildId: row.guild_id,
    logChannelId: row.log_channel_id,
    inviteTracking: toBool(row.invite_tracking),
    vanityTracking: toBool(row.vanity_tracking),
    abuseThreshold: row.abuse_threshold,
    abuseWindowMinutes: row.abuse_window_minutes,
    welcomeDelayMs: row.welcome_delay_ms,
    deleteWelcomeAfter: row.delete_welcome_after,
    dmFailureNotice: toBool(row.dm_failure_notice),
    dryRun: toBool(row.dry_run),
    ticketChannelId: row.ticket_channel_id,
    rolesChannelId: row.roles_channel_id,
    rulesText: row.rules_text || '',
    updatedAt: row.updated_at,
  };
}

export function saveGuildSettings(guildId, settings) {
  ensureGuildConfigs(guildId);
  queries.run(
    `UPDATE guild_settings SET
      log_channel_id = ?, invite_tracking = ?, vanity_tracking = ?, abuse_threshold = ?,
      abuse_window_minutes = ?, welcome_delay_ms = ?, delete_welcome_after = ?, dm_failure_notice = ?,
      dry_run = ?, ticket_channel_id = ?, roles_channel_id = ?, rules_text = ?, updated_at = ?
     WHERE guild_id = ?`,
    settings.logChannelId ?? null,
    bool(settings.inviteTracking),
    bool(settings.vanityTracking),
    settings.abuseThreshold,
    settings.abuseWindowMinutes,
    settings.welcomeDelayMs,
    settings.deleteWelcomeAfter,
    bool(settings.dmFailureNotice),
    bool(settings.dryRun),
    settings.ticketChannelId ?? null,
    settings.rolesChannelId ?? null,
    settings.rulesText || '',
    now(),
    guildId,
  );
  return getGuildSettings(guildId);
}

// ── Buttons ────────────────────────────────────────────────────────

function mapButton(row) {
  return {
    id: row.id,
    guildId: row.guild_id,
    scope: row.scope,
    label: row.label,
    emoji: row.emoji,
    style: row.style,
    type: row.type,
    url: row.url,
    enabled: toBool(row.enabled),
    position: row.position,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function listButtons(guildId, scope = null) {
  const rows = scope
    ? queries.all('SELECT * FROM welcome_buttons WHERE guild_id = ? AND scope = ? ORDER BY position, created_at', guildId, scope)
    : queries.all('SELECT * FROM welcome_buttons WHERE guild_id = ? ORDER BY scope, position, created_at', guildId);
  return rows.map(mapButton);
}

export function createButton(guildId, button) {
  const buttonId = id();
  const timestamp = now();
  const position =
    button.position ??
    (queries.get(
      'SELECT COALESCE(MAX(position), -1) + 1 AS pos FROM welcome_buttons WHERE guild_id = ? AND scope = ?',
      guildId,
      button.scope || 'welcome',
    ).pos ?? 0);
  queries.run(
    `INSERT INTO welcome_buttons
      (id, guild_id, scope, label, emoji, style, type, url, enabled, position, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    buttonId,
    guildId,
    button.scope || 'welcome',
    button.label,
    button.emoji || null,
    button.style ?? 2,
    button.type || 'url',
    button.url || null,
    bool(button.enabled !== false),
    position,
    timestamp,
    timestamp,
  );
  return mapButton(queries.get('SELECT * FROM welcome_buttons WHERE id = ?', buttonId));
}

export function updateButton(guildId, buttonId, patch) {
  const existing = queries.get('SELECT * FROM welcome_buttons WHERE id = ? AND guild_id = ?', buttonId, guildId);
  if (!existing) return null;
  const merged = { ...mapButton(existing), ...patch };
  queries.run(
    `UPDATE welcome_buttons SET label = ?, emoji = ?, style = ?, type = ?, url = ?, enabled = ?, position = ?, updated_at = ?
     WHERE id = ? AND guild_id = ?`,
    merged.label,
    merged.emoji || null,
    merged.style,
    merged.type,
    merged.url || null,
    bool(merged.enabled),
    merged.position,
    now(),
    buttonId,
    guildId,
  );
  return mapButton(queries.get('SELECT * FROM welcome_buttons WHERE id = ?', buttonId));
}

export function deleteButton(guildId, buttonId) {
  return queries.run('DELETE FROM welcome_buttons WHERE id = ? AND guild_id = ?', buttonId, guildId).changes > 0;
}

export function reorderButtons(guildId, scope, ids) {
  transaction(() => {
    ids.forEach((buttonId, index) => {
      queries.run(
        'UPDATE welcome_buttons SET position = ?, updated_at = ? WHERE id = ? AND guild_id = ? AND scope = ?',
        index,
        now(),
        buttonId,
        guildId,
        scope,
      );
    });
  });
  return listButtons(guildId, scope);
}

// ── Auto roles ─────────────────────────────────────────────────────

function mapAutoRole(row) {
  return {
    id: row.id,
    guildId: row.guild_id,
    roleId: row.role_id,
    target: row.target,
    enabled: toBool(row.enabled),
    delaySeconds: row.delay_seconds,
    position: row.position,
    createdAt: row.created_at,
  };
}

export function listAutoRoles(guildId) {
  return queries
    .all('SELECT * FROM auto_roles WHERE guild_id = ? ORDER BY position, created_at', guildId)
    .map(mapAutoRole);
}

export function createAutoRole(guildId, role) {
  const roleId = id();
  const position =
    queries.get('SELECT COALESCE(MAX(position), -1) + 1 AS pos FROM auto_roles WHERE guild_id = ?', guildId).pos ?? 0;
  queries.run(
    `INSERT INTO auto_roles (id, guild_id, role_id, target, enabled, delay_seconds, position, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    roleId,
    guildId,
    role.roleId,
    role.target || 'human',
    bool(role.enabled !== false),
    Math.max(0, Number(role.delaySeconds) || 0),
    position,
    now(),
    now(),
  );
  return mapAutoRole(queries.get('SELECT * FROM auto_roles WHERE id = ?', roleId));
}

export function updateAutoRole(guildId, roleId, patch) {
  const existing = queries.get('SELECT * FROM auto_roles WHERE id = ? AND guild_id = ?', roleId, guildId);
  if (!existing) return null;
  const merged = { ...mapAutoRole(existing), ...patch };
  queries.run(
    `UPDATE auto_roles SET role_id = ?, target = ?, enabled = ?, delay_seconds = ?, updated_at = ?
     WHERE id = ? AND guild_id = ?`,
    merged.roleId,
    merged.target,
    bool(merged.enabled),
    Math.max(0, Number(merged.delaySeconds) || 0),
    now(),
    roleId,
    guildId,
  );
  return mapAutoRole(queries.get('SELECT * FROM auto_roles WHERE id = ?', roleId));
}

export function deleteAutoRole(guildId, roleId) {
  return queries.run('DELETE FROM auto_roles WHERE id = ? AND guild_id = ?', roleId, guildId).changes > 0;
}

// ── Self-assignable roles ──────────────────────────────────────────

function mapSelfRole(row) {
  return {
    id: row.id,
    guildId: row.guild_id,
    roleId: row.role_id,
    label: row.label,
    emoji: row.emoji,
    enabled: toBool(row.enabled),
    position: row.position,
  };
}

export function listSelfRoles(guildId) {
  return queries
    .all('SELECT * FROM self_roles WHERE guild_id = ? ORDER BY position, created_at', guildId)
    .map(mapSelfRole);
}

export function createSelfRole(guildId, role) {
  const roleId = id();
  const position =
    queries.get('SELECT COALESCE(MAX(position), -1) + 1 AS pos FROM self_roles WHERE guild_id = ?', guildId).pos ?? 0;
  queries.run(
    `INSERT INTO self_roles (id, guild_id, role_id, label, emoji, enabled, position, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    roleId,
    guildId,
    role.roleId,
    role.label,
    role.emoji || null,
    bool(role.enabled !== false),
    position,
    now(),
  );
  return mapSelfRole(queries.get('SELECT * FROM self_roles WHERE id = ?', roleId));
}

export function deleteSelfRole(guildId, roleId) {
  return queries.run('DELETE FROM self_roles WHERE id = ? AND guild_id = ?', roleId, guildId).changes > 0;
}

// ── Templates ──────────────────────────────────────────────────────

function mapTemplate(row) {
  return {
    id: row.id,
    guildId: row.guild_id,
    type: row.type,
    name: row.name,
    description: row.description,
    style: row.style,
    content: jsonParse(row.content_json, {}),
    image: jsonParse(row.image_json, null),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function listTemplates(guildId, type = null) {
  const rows = type
    ? queries.all('SELECT * FROM templates WHERE guild_id = ? AND type = ? ORDER BY updated_at DESC', guildId, type)
    : queries.all('SELECT * FROM templates WHERE guild_id = ? ORDER BY updated_at DESC', guildId);
  return rows.map(mapTemplate);
}

export function getTemplate(guildId, templateId) {
  const row = queries.get('SELECT * FROM templates WHERE id = ? AND guild_id = ?', templateId, guildId);
  return row ? mapTemplate(row) : null;
}

export function createTemplate(guildId, template) {
  const templateId = id();
  const timestamp = now();
  queries.run(
    `INSERT INTO templates (id, guild_id, type, name, description, style, content_json, image_json, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    templateId,
    guildId,
    template.type || 'welcome',
    template.name,
    template.description || null,
    template.style || 'custom',
    JSON.stringify(template.content),
    template.image ? JSON.stringify(template.image) : null,
    timestamp,
    timestamp,
  );
  return getTemplate(guildId, templateId);
}

export function updateTemplate(guildId, templateId, patch) {
  const existing = getTemplate(guildId, templateId);
  if (!existing) return null;
  const merged = { ...existing, ...patch };
  queries.run(
    `UPDATE templates SET name = ?, description = ?, style = ?, content_json = ?, image_json = ?, updated_at = ?
     WHERE id = ? AND guild_id = ?`,
    merged.name,
    merged.description || null,
    merged.style,
    JSON.stringify(merged.content),
    merged.image ? JSON.stringify(merged.image) : null,
    now(),
    templateId,
    guildId,
  );
  return getTemplate(guildId, templateId);
}

export function deleteTemplate(guildId, templateId) {
  return queries.run('DELETE FROM templates WHERE id = ? AND guild_id = ?', templateId, guildId).changes > 0;
}

// ── Image templates ────────────────────────────────────────────────

export function listImageTemplates(guildId) {
  return queries
    .all('SELECT * FROM image_templates WHERE guild_id = ? ORDER BY created_at DESC', guildId)
    .map((row) => ({
      id: row.id,
      guildId: row.guild_id,
      name: row.name,
      backgroundPath: row.background_path,
      config: jsonParse(row.config_json, clone(DEFAULT_IMAGE_CONFIG)),
      createdAt: row.created_at,
    }));
}

export function createImageTemplate(guildId, template) {
  const templateId = id();
  queries.run(
    `INSERT INTO image_templates (id, guild_id, name, background_path, config_json, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    templateId,
    guildId,
    template.name,
    template.backgroundPath || null,
    JSON.stringify(template.config),
    now(),
  );
  return listImageTemplates(guildId).find((item) => item.id === templateId);
}

export function deleteImageTemplate(guildId, templateId) {
  return queries.run('DELETE FROM image_templates WHERE id = ? AND guild_id = ?', templateId, guildId).changes > 0;
}

// ── Invites ────────────────────────────────────────────────────────

export function upsertInvite(guildId, invite) {
  queries.run(
    `INSERT INTO invites (guild_id, code, inviter_id, inviter_name, uses, max_uses, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(guild_id, code) DO UPDATE SET
       uses = excluded.uses,
       max_uses = excluded.max_uses,
       inviter_id = excluded.inviter_id,
       inviter_name = COALESCE(excluded.inviter_name, invites.inviter_name),
       updated_at = excluded.updated_at`,
    guildId,
    invite.code,
    invite.inviterId,
    invite.inviterName || null,
    invite.uses || 0,
    invite.maxUses || 0,
    invite.createdAt || now(),
    now(),
  );
}

export function getStoredInvites(guildId) {
  return queries.all('SELECT * FROM invites WHERE guild_id = ?', guildId).map((row) => ({
    code: row.code,
    inviterId: row.inviter_id,
    inviterName: row.inviter_name,
    uses: row.uses,
    maxUses: row.max_uses,
  }));
}

export function deleteStoredInvite(guildId, code) {
  queries.run('DELETE FROM invites WHERE guild_id = ? AND code = ?', guildId, code);
}

export function recordInviteUse({
  guildId,
  code,
  inviterId,
  inviterName,
  userId,
  username,
  type = 'normal',
  joinedAt = now(),
}) {
  queries.run(
    `INSERT INTO invite_uses (guild_id, code, inviter_id, inviter_name, user_id, username, type, joined_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    guildId,
    code,
    inviterId || null,
    inviterName || null,
    userId,
    username || null,
    type,
    joinedAt,
  );
}

export function getInviteLeaderboard(guildId, limit = 10) {
  return queries
    .all(
      `SELECT inviter_id AS inviterId, MAX(inviter_name) AS inviterName, COUNT(*) AS joins,
              SUM(CASE WHEN type = 'vanity' THEN 1 ELSE 0 END) AS vanity,
              SUM(CASE WHEN type = 'unknown' THEN 1 ELSE 0 END) AS unknown
       FROM invite_uses WHERE guild_id = ?
       GROUP BY inviter_id ORDER BY joins DESC LIMIT ?`,
      guildId,
      limit,
    )
    .map((row) => ({ ...row, inviterName: row.inviterName || row.inviterId || 'Unknown' }));
}

export function getInviterStats(guildId, userId) {
  const total = queries.get(
    'SELECT COUNT(*) AS count FROM invite_uses WHERE guild_id = ? AND inviter_id = ?',
    guildId,
    userId,
  );
  const recent = queries.get(
    'SELECT COUNT(*) AS count FROM invite_uses WHERE guild_id = ? AND inviter_id = ? AND joined_at >= ?',
    guildId,
    userId,
    now() - 7 * 24 * 60 * 60 * 1000,
  );
  const invitees = queries.all(
    'SELECT user_id, username, code, type, joined_at FROM invite_uses WHERE guild_id = ? AND inviter_id = ? ORDER BY joined_at DESC LIMIT 20',
    guildId,
    userId,
  );
  return { total: total.count, last7Days: recent.count, invitees };
}

export function getRecentInviteUses(guildId, limit = 20) {
  return queries.all(
    'SELECT * FROM invite_uses WHERE guild_id = ? ORDER BY joined_at DESC LIMIT ?',
    guildId,
    limit,
  );
}

export function countInvites(guildId) {
  return queries.get('SELECT COUNT(*) AS count FROM invite_uses WHERE guild_id = ?', guildId).count;
}

export function getInviteSummary(guildId) {
  const total = countInvites(guildId);
  const last7Days = queries.get(
    'SELECT COUNT(*) AS count FROM invite_uses WHERE guild_id = ? AND joined_at >= ?',
    guildId,
    now() - 7 * 24 * 60 * 60 * 1000,
  ).count;
  return { total, last7Days };
}

export function clearInvites(guildId) {
  transaction(() => {
    queries.run('DELETE FROM invite_uses WHERE guild_id = ?', guildId);
    queries.run('DELETE FROM invites WHERE guild_id = ?', guildId);
  });
}

export function getAbuseWindowCount(guildId, inviterId, windowMinutes) {
  return queries.get(
    'SELECT COUNT(*) AS count FROM invite_uses WHERE guild_id = ? AND inviter_id = ? AND joined_at >= ?',
    guildId,
    inviterId,
    now() - windowMinutes * 60 * 1000,
  ).count;
}

// ── Member history ─────────────────────────────────────────────────

export function findPreviousMember(guildId, userId) {
  const row = queries.get(
    'SELECT * FROM member_history WHERE guild_id = ? AND user_id = ? ORDER BY id DESC LIMIT 1',
    guildId,
    userId,
  );
  return row ? mapMemberRow(row) : null;
}

function mapMemberRow(row) {
  return {
    id: row.id,
    guildId: row.guild_id,
    userId: row.user_id,
    username: row.username,
    displayName: row.display_name,
    avatar: row.avatar,
    isBot: toBool(row.is_bot),
    joinedAt: row.joined_at,
    leftAt: row.left_at,
    inviterId: row.inviter_id,
    inviterName: row.inviter_name,
    inviteCode: row.invite_code,
    inviteType: row.invite_type,
    memberNumber: row.member_number,
  };
}

export function addMemberJoin({
  guildId,
  userId,
  username,
  displayName,
  avatar,
  isBot,
  inviterId = null,
  inviterName = null,
  inviteCode = null,
  inviteType = null,
  joinedAt = now(),
}) {
  const previous = findPreviousMember(guildId, userId);
  let memberNumber = previous?.memberNumber;
  if (!memberNumber) {
    memberNumber = (queries.get('SELECT COALESCE(MAX(member_number), 0) AS n FROM member_history WHERE guild_id = ?', guildId).n ?? 0) + 1;
  }
  const result = queries.run(
    `INSERT INTO member_history
      (guild_id, user_id, username, display_name, avatar, is_bot, joined_at, inviter_id, inviter_name, invite_code, invite_type, member_number)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    guildId,
    userId,
    username,
    displayName || username,
    avatar || null,
    bool(isBot),
    joinedAt,
    inviterId,
    inviterName,
    inviteCode,
    inviteType,
    memberNumber,
  );
  return {
    id: Number(result.lastInsertRowid),
    memberNumber,
    returning: Boolean(previous),
    previousJoinedAt: previous?.joinedAt ?? null,
  };
}

export function markMemberLeft(guildId, userId, leftAt = now()) {
  const row = queries.get(
    'SELECT * FROM member_history WHERE guild_id = ? AND user_id = ? AND left_at IS NULL ORDER BY id DESC LIMIT 1',
    guildId,
    userId,
  );
  if (!row) return null;
  queries.run('UPDATE member_history SET left_at = ? WHERE id = ?', leftAt, row.id);
  return mapMemberRow({ ...row, left_at: leftAt });
}

export function getRecentMembers(guildId, limit = 10) {
  return queries
    .all('SELECT * FROM member_history WHERE guild_id = ? ORDER BY joined_at DESC LIMIT ?', guildId, limit)
    .map(mapMemberRow);
}

function localDay(timestamp) {
  const date = new Date(timestamp);
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

export function recordJoinStat(guildId, { isBot, totalMembers }) {
  const day = localDay(now());
  queries.run(
    `INSERT INTO join_stats (guild_id, day, joins, leaves, humans, bots, total_members)
     VALUES (?, ?, 1, 0, ?, ?, ?)
     ON CONFLICT(guild_id, day) DO UPDATE SET
       joins = join_stats.joins + 1,
       humans = join_stats.humans + ?,
       bots = join_stats.bots + ?,
       total_members = ?`,
    guildId,
    day,
    isBot ? 0 : 1,
    isBot ? 1 : 0,
    totalMembers,
    isBot ? 0 : 1,
    isBot ? 1 : 0,
    totalMembers,
  );
}

export function recordLeaveStat(guildId, { isBot, totalMembers }) {
  const day = localDay(now());
  queries.run(
    `INSERT INTO join_stats (guild_id, day, joins, leaves, humans, bots, total_members)
     VALUES (?, ?, 0, 1, 0, 0, ?)
     ON CONFLICT(guild_id, day) DO UPDATE SET
       leaves = join_stats.leaves + 1,
       total_members = ?`,
    guildId,
    day,
    totalMembers,
    totalMembers,
  );
}

export function getStatistics(guildId, days = 30) {
  const guild = getGuild(guildId);
  const totals = queries.get(
    `SELECT
       COUNT(*) AS totalJoins,
       SUM(CASE WHEN is_bot = 0 THEN 1 ELSE 0 END) AS humansJoined,
       SUM(CASE WHEN is_bot = 1 THEN 1 ELSE 0 END) AS botsJoined,
       COUNT(DISTINCT user_id) AS uniqueMembers,
       COUNT(CASE WHEN left_at IS NOT NULL THEN 1 END) AS totalLeaves
     FROM member_history WHERE guild_id = ?`,
    guildId,
  );

  const dayMs = 24 * 60 * 60 * 1000;
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const todayTs = startOfToday.getTime();
  const joinsSince = (since) =>
    queries.get('SELECT COUNT(*) AS count FROM member_history WHERE guild_id = ? AND joined_at >= ?', guildId, since).count;
  const leavesSince = (since) =>
    queries.get('SELECT COUNT(*) AS count FROM member_history WHERE guild_id = ? AND left_at >= ?', guildId, since).count;

  const rows = queries.all(
    'SELECT * FROM join_stats WHERE guild_id = ? AND day >= ? ORDER BY day',
    guildId,
    localDay(todayTs - (days - 1) * dayMs),
  );
  const byDay = new Map(rows.map((row) => [row.day, row]));
  const daily = [];
  for (let i = days - 1; i >= 0; i -= 1) {
    const day = localDay(todayTs - i * dayMs);
    const row = byDay.get(day);
    daily.push({
      day,
      joins: row?.joins ?? 0,
      leaves: row?.leaves ?? 0,
      humans: row?.humans ?? 0,
      bots: row?.bots ?? 0,
      totalMembers: row?.total_members ?? 0,
    });
  }

  const last7 = daily.slice(-7).reduce((sum, row) => sum + row.joins, 0);
  const previous7 = daily.slice(-14, -7).reduce((sum, row) => sum + row.joins, 0);
  const growthPercent = previous7 === 0 ? (last7 > 0 ? 100 : 0) : Math.round(((last7 - previous7) / previous7) * 100);

  return {
    currentMembers: guild?.memberCount ?? 0,
    totalJoins: totals.totalJoins || 0,
    humansJoined: totals.humansJoined || 0,
    botsJoined: totals.botsJoined || 0,
    uniqueMembers: totals.uniqueMembers || 0,
    totalLeaves: totals.totalLeaves || 0,
    today: { joins: joinsSince(todayTs), leaves: leavesSince(todayTs) },
    week: { joins: joinsSince(now() - 7 * dayMs), leaves: leavesSince(now() - 7 * dayMs) },
    month: { joins: joinsSince(now() - 30 * dayMs), leaves: leavesSince(now() - 30 * dayMs) },
    growthPercent,
    daily,
  };
}

// ── Logs ───────────────────────────────────────────────────────────

export function addLog(guildId, category, action, message, userId = null, meta = null) {
  const result = queries.run(
    'INSERT INTO logs (guild_id, category, action, message, user_id, meta_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
    guildId,
    category,
    action,
    message,
    userId,
    meta ? JSON.stringify(meta) : null,
    now(),
  );
  return Number(result.lastInsertRowid);
}

export function listLogs(guildId, { category = null, limit = 50, offset = 0 } = {}) {
  const safeLimit = Math.min(200, Math.max(1, Number(limit) || 50));
  const safeOffset = Math.max(0, Number(offset) || 0);
  const rows = category
    ? queries.all(
        'SELECT * FROM logs WHERE guild_id = ? AND category = ? ORDER BY created_at DESC LIMIT ? OFFSET ?',
        guildId,
        category,
        safeLimit,
        safeOffset,
      )
    : queries.all(
        'SELECT * FROM logs WHERE guild_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?',
        guildId,
        safeLimit,
        safeOffset,
      );
  const total = category
    ? queries.get('SELECT COUNT(*) AS count FROM logs WHERE guild_id = ? AND category = ?', guildId, category).count
    : queries.get('SELECT COUNT(*) AS count FROM logs WHERE guild_id = ?', guildId).count;
  return {
    total,
    logs: rows.map((row) => ({
      id: row.id,
      category: row.category,
      action: row.action,
      message: row.message,
      userId: row.user_id,
      meta: jsonParse(row.meta_json, null),
      createdAt: row.created_at,
    })),
  };
}

export function getRecentLogs(guildId, limit = 6) {
  return listLogs(guildId, { limit }).logs;
}

export function clearLogs(guildId) {
  return queries.run('DELETE FROM logs WHERE guild_id = ?', guildId).changes;
}

// ── Sessions ───────────────────────────────────────────────────────

export function createSession(user) {
  const sessionId = crypto.randomBytes(32).toString('base64url');
  const timestamp = now();
  queries.run(
    `INSERT INTO sessions (id, user_id, username, global_name, avatar, access_token, refresh_token, token_expires_at, created_at, expires_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    sessionId,
    user.id,
    user.username,
    user.globalName || user.username,
    user.avatar || null,
    user.accessToken || null,
    user.refreshToken || null,
    user.tokenExpiresAt || null,
    timestamp,
    timestamp + 7 * 24 * 60 * 60 * 1000,
  );
  return sessionId;
}

export function getSession(sessionId) {
  if (!sessionId) return null;
  const row = queries.get('SELECT * FROM sessions WHERE id = ? AND expires_at > ?', sessionId, now());
  if (!row) return null;
  return {
    id: row.id,
    userId: row.user_id,
    username: row.username,
    globalName: row.global_name,
    avatar: row.avatar,
    accessToken: row.access_token,
    refreshToken: row.refresh_token,
    tokenExpiresAt: row.token_expires_at,
    expiresAt: row.expires_at,
  };
}

export function deleteSession(sessionId) {
  queries.run('DELETE FROM sessions WHERE id = ?', sessionId);
}

export function updateSessionTokens(sessionId, { accessToken, refreshToken, tokenExpiresAt }) {
  queries.run(
    'UPDATE sessions SET access_token = ?, refresh_token = COALESCE(?, refresh_token), token_expires_at = ? WHERE id = ?',
    accessToken,
    refreshToken || null,
    tokenExpiresAt,
    sessionId,
  );
}

export function cleanupSessions() {
  queries.run('DELETE FROM sessions WHERE expires_at <= ?', now());
}

// ── Preferences ────────────────────────────────────────────────────

export function getPreferences(userId) {
  const row = queries.get('SELECT prefs_json FROM dashboard_preferences WHERE user_id = ?', userId);
  return row ? jsonParse(row.prefs_json, {}) : {};
}

export function savePreferences(userId, prefs) {
  queries.run(
    `INSERT INTO dashboard_preferences (user_id, prefs_json, updated_at) VALUES (?, ?, ?)
     ON CONFLICT(user_id) DO UPDATE SET prefs_json = excluded.prefs_json, updated_at = excluded.updated_at`,
    userId,
    JSON.stringify(prefs),
    now(),
  );
  return prefs;
}

export { db };
