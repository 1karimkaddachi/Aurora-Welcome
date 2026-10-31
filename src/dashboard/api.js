import { Router } from 'express';
import multer from 'multer';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { ChannelType } from 'discord.js';
import { config as appConfig } from '../config.js';
import {
  addLog,
  clearInvites,
  clearLogs,
  countInvites,
  createAutoRole,
  createButton,
  createImageTemplate,
  createSelfRole,
  createTemplate,
  deleteAutoRole,
  deleteButton,
  deleteImageTemplate,
  deleteSelfRole,
  deleteTemplate,
  getGuild,
  getGuildSettings,
  getInviteLeaderboard,
  getInviteSummary,
  getInviterStats,
  getLeaveConfig,
  getPreferences,
  getRecentInviteUses,
  getRecentLogs,
  getRecentMembers,
  getStatistics,
  getTemplate,
  getWelcomeConfig,
  listAutoRoles,
  listButtons,
  listImageTemplates,
  listLogs,
  listSelfRoles,
  listTemplates,
  saveGuildSettings,
  saveLeaveConfig,
  savePreferences,
  reorderButtons,
  saveWelcomeConfig,
  updateAutoRole,
  updateButton,
  updateTemplate,
} from '../db/repositories.js';
import { getClient } from '../bot/client.js';
import { logEvent } from '../bot/audit.js';
import {
  BUILTIN_LEAVE_TEMPLATES,
  BUILTIN_WELCOME_TEMPLATES,
  BUTTON_TYPES,
  DEFAULT_IMAGE_CONFIG,
  DEFAULT_LEAVE_CONTENT,
  DEFAULT_LEAVE_IMAGE_CONFIG,
  WELCOME_STYLES,
} from '../shared/defaults.js';
import { PLACEHOLDERS } from '../shared/placeholders.js';
import {
  ValidationError,
  validateAutoRole,
  validateButton,
  validateGuildSettings,
  validateImageTemplate,
  validateLeaveConfig,
  validateSelfRole,
  validateTemplate,
  validateWelcomeConfig,
} from '../shared/validation.js';
import { buildPreview } from '../welcome/service.js';
import { getAvailableFonts } from '../welcome/render-canvas.js';
import {
  applyLeaveTemplate,
  applyWelcomeTemplate,
  findTemplate,
  listAllTemplates,
} from '../welcome/templates.js';
import { resetWelcomeConfig } from '../bot/commands/welcome.js';
import { getUserGuilds, requireGuild, userAvatarUrl } from './auth.js';
import {
  HttpError,
  asyncHandler,
  rateLimit,
} from './http.js';

export const apiRouter = Router();

const LOG_CATEGORIES = ['member', 'welcome', 'leave', 'dm', 'autorole', 'invite', 'image', 'config', 'system'];
const TEMPLATE_TYPES = ['welcome', 'leave'];

function botGuild(guildId) {
  return getClient().guilds.cache.get(guildId) || null;
}

function plainGuild(guildId) {
  const live = botGuild(guildId);
  const row = getGuild(guildId);
  return {
    id: guildId,
    name: live?.name || row?.name || 'this server',
    iconURL: live?.iconURL?.({ extension: 'png', size: 256 }) || row?.icon || null,
    memberCount: live?.memberCount || row?.memberCount || 0,
  };
}

async function auditConfig(req, action, message, meta = null) {
  await logEvent(getClient(), req.guildRow?.guildId || req.params.guildId, 'config', action, message, {
    userId: req.session?.userId,
    meta,
  });
}

function parseIntOr(value, fallback) {
  const number = Number.parseInt(String(value), 10);
  return Number.isFinite(number) ? number : fallback;
}

// ── Public ─────────────────────────────────────────────────────────

apiRouter.get('/config', (req, res) => {
  res.json({
    oauthConfigured: Boolean(appConfig.discord.clientId && appConfig.discord.clientSecret),
    clientId: appConfig.discord.clientId || null,
    devAuth: appConfig.devAuth,
    dashboardUrl: appConfig.dashboardUrl,
    version: '1.0.0',
  });
});

apiRouter.use((req, res, next) => {
  if (!req.session) return res.status(401).json({ error: 'Your dashboard session has expired. Please sign in again.' });
  return next();
});

apiRouter.get(
  '/me',
  asyncHandler(async (req, res) => {
    const guilds = await getUserGuilds(req.session);
    const client = getClient();
    res.json({
      user: {
        id: req.session.userId,
        username: req.session.username,
        globalName: req.session.globalName,
        avatarUrl: userAvatarUrl(req.session.userId, req.session.avatar),
        isDev: !req.session.accessToken,
      },
      guilds: guilds.map((guild) => ({ ...guild, botOnline: client.guilds.cache.has(guild.id) })),
    });
  }),
);

apiRouter.get('/meta', (req, res) => {
  res.json({
    styles: WELCOME_STYLES,
    placeholders: PLACEHOLDERS,
    buttonTypes: BUTTON_TYPES,
    logCategories: LOG_CATEGORIES,
    limits: {
      title: 256,
      description: 3500,
      footer: 1024,
      buttonsPerMessage: 25,
      uploadBytes: appConfig.limits.uploadBytes,
    },
    fonts: ['Segoe UI', ...getAvailableFonts()],
    imageDefaults: { welcome: DEFAULT_IMAGE_CONFIG, leave: DEFAULT_LEAVE_IMAGE_CONFIG },
    dashboardUrl: appConfig.dashboardUrl,
  });
});

apiRouter.get('/preferences', (req, res) => {
  res.json(getPreferences(req.session.userId));
});

apiRouter.put('/preferences', (req, res) => {
  if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) {
    throw new ValidationError('Preferences must be an object.');
  }
  res.json(savePreferences(req.session.userId, req.body));
});

// ── Guild routes ───────────────────────────────────────────────────

const guildRouter = Router({ mergeParams: true });
guildRouter.use((req, res, next) => requireGuild(req, res, next));

guildRouter.get(
  '/overview',
  asyncHandler(async (req, res) => {
    const guildId = req.params.guildId;
    const welcome = getWelcomeConfig(guildId);
    const leave = getLeaveConfig(guildId);
    const settings = getGuildSettings(guildId);
    const stats = getStatistics(guildId, 14);
    const invites = countInvites(guildId);
    const leaderboard = getInviteLeaderboard(guildId, 5);
    const online = Boolean(botGuild(guildId));
    res.json({
      guild: {
        id: guildId,
        name: req.guildRow.name,
        icon: req.guildRow.icon,
        memberCount: online ? botGuild(guildId).memberCount : req.guildRow.memberCount,
        botPresent: req.guildRow.botPresent,
        botOnline: online,
      },
      welcome: {
        enabled: welcome.enabled,
        style: welcome.style,
        channelId: welcome.channels.main,
        sendMode: welcome.sendMode,
        imageEnabled: welcome.image.enabled,
        buttons: listButtons(guildId, 'welcome').length,
        updatedAt: welcome.updatedAt,
      },
      leave: {
        enabled: leave.enabled,
        channelId: leave.channelId,
        imageEnabled: leave.image.enabled,
        updatedAt: leave.updatedAt,
      },
      settings: {
        logChannelId: settings.logChannelId,
        inviteTracking: settings.inviteTracking,
        vanityTracking: settings.vanityTracking,
        dryRun: settings.dryRun,
      },
      stats,
      invites: { total: invites, leaderboard },
      recentLogs: getRecentLogs(guildId, 6),
      recentMembers: getRecentMembers(guildId, 6),
    });
  }),
);

// Welcome
guildRouter.get('/welcome', (req, res) => {
  res.json(getWelcomeConfig(req.params.guildId));
});

guildRouter.put(
  '/welcome',
  asyncHandler(async (req, res) => {
    const config = validateWelcomeConfig(req.body);
    const saved = saveWelcomeConfig(req.params.guildId, config);
    await auditConfig(req, 'welcome_updated', 'Welcome configuration updated from the dashboard.', {
      style: saved.style,
      sendMode: saved.sendMode,
    });
    res.json(saved);
  }),
);

// Leave
guildRouter.get('/leave', (req, res) => {
  res.json(getLeaveConfig(req.params.guildId));
});

guildRouter.put(
  '/leave',
  asyncHandler(async (req, res) => {
    const config = validateLeaveConfig(req.body);
    const saved = saveLeaveConfig(req.params.guildId, config);
    await auditConfig(req, 'leave_updated', 'Leave configuration updated from the dashboard.', {
      style: saved.style,
      enabled: saved.enabled,
    });
    res.json(saved);
  }),
);

// Advanced settings
guildRouter.get('/settings', (req, res) => {
  res.json(getGuildSettings(req.params.guildId));
});

guildRouter.put(
  '/settings',
  asyncHandler(async (req, res) => {
    const settings = validateGuildSettings(req.body);
    const saved = saveGuildSettings(req.params.guildId, settings);
    await auditConfig(req, 'settings_updated', 'Advanced settings updated from the dashboard.', {
      inviteTracking: saved.inviteTracking,
      dryRun: saved.dryRun,
    });
    res.json(saved);
  }),
);

// Buttons
guildRouter.get('/buttons', (req, res) => {
  const scope = req.query.scope ? String(req.query.scope) : null;
  if (scope && !['welcome', 'dm', 'leave'].includes(scope)) throw new ValidationError('Invalid button scope.');
  res.json(listButtons(req.params.guildId, scope));
});

guildRouter.post(
  '/buttons',
  asyncHandler(async (req, res) => {
    const scope = req.body.scope || 'welcome';
    const existing = listButtons(req.params.guildId, scope);
    const button = validateButton({ ...req.body, scope }, existing.length);
    const created = createButton(req.params.guildId, button);
    await auditConfig(req, 'button_added', `Welcome button **${created.label}** added from the dashboard.`, {
      buttonId: created.id,
      type: created.type,
    });
    res.status(201).json(created);
  }),
);

guildRouter.put(
  '/buttons/:buttonId',
  asyncHandler(async (req, res) => {
    const existing = listButtons(req.params.guildId).find((entry) => entry.id === req.params.buttonId);
    if (!existing) throw new HttpError(404, 'Button not found.');
    const merged = { ...existing, ...req.body, scope: existing.scope };
    const button = validateButton(merged, 0);
    const updated = updateButton(req.params.guildId, existing.id, button);
    await auditConfig(req, 'button_updated', `Welcome button **${updated.label}** updated.`, { buttonId: updated.id });
    res.json(updated);
  }),
);

guildRouter.post(
  '/buttons/reorder',
  asyncHandler(async (req, res) => {
    const scope = req.body.scope || 'welcome';
    if (!['welcome', 'dm', 'leave'].includes(scope)) throw new ValidationError('Invalid button scope.');
    const ids = Array.isArray(req.body.ids) ? req.body.ids.map(String) : [];
    const existing = listButtons(req.params.guildId, scope);
    const known = new Set(existing.map((entry) => entry.id));
    if (!ids.length || ids.some((id) => !known.has(id))) throw new ValidationError('Invalid button order.');
    const ordered = reorderButtons(req.params.guildId, scope, ids);
    await auditConfig(req, 'buttons_reordered', 'Welcome button order updated from the dashboard.');
    res.json(ordered);
  }),
);

guildRouter.delete(
  '/buttons/:buttonId',
  asyncHandler(async (req, res) => {
    const existing = listButtons(req.params.guildId).find((entry) => entry.id === req.params.buttonId);
    if (!existing) throw new HttpError(404, 'Button not found.');
    deleteButton(req.params.guildId, existing.id);
    await auditConfig(req, 'button_deleted', `Welcome button **${existing.label}** deleted.`, { buttonId: existing.id });
    res.json({ ok: true });
  }),
);

// Auto roles
guildRouter.get('/autoroles', (req, res) => {
  const roles = listAutoRoles(req.params.guildId);
  const guild = botGuild(req.params.guildId);
  const roleMap = guild?.roles.cache;
  const botHighest = guild?.members.me?.roles.highest.position ?? Infinity;
  res.json(
    roles.map((role) => {
      const discordRole = roleMap?.get(role.roleId);
      return {
        ...role,
        roleName: discordRole?.name || null,
        roleColor: discordRole?.hexColor || null,
        assignable: discordRole ? !discordRole.managed && discordRole.position < botHighest : null,
      };
    }),
  );
});

guildRouter.post(
  '/autoroles',
  asyncHandler(async (req, res) => {
    const payload = validateAutoRole(req.body);
    const guild = botGuild(req.params.guildId);
    if (guild) {
      const role = guild.roles.cache.get(payload.roleId);
      if (!role) throw new ValidationError('That role does not exist in the server.', 'roleId');
      if (role.id === guild.id) throw new ValidationError('The @everyone role cannot be assigned.', 'roleId');
      if (role.managed) throw new ValidationError('That role is managed by an integration.', 'roleId');
      if (guild.members.me && role.position >= guild.members.me.roles.highest.position) {
        throw new ValidationError('That role is above the bot’s highest role.', 'roleId');
      }
    }
    const created = createAutoRole(req.params.guildId, payload);
    await auditConfig(req, 'autorole_added', `Auto role added from the dashboard.`, { roleId: created.roleId });
    res.status(201).json(created);
  }),
);

guildRouter.put(
  '/autoroles/:roleId',
  asyncHandler(async (req, res) => {
    const existing = listAutoRoles(req.params.guildId).find((entry) => entry.id === req.params.roleId);
    if (!existing) throw new HttpError(404, 'Auto role not found.');
    const payload = validateAutoRole({ ...existing, ...req.body });
    const updated = updateAutoRole(req.params.guildId, existing.id, payload);
    await auditConfig(req, 'autorole_updated', 'Auto role updated from the dashboard.', { roleId: updated.roleId });
    res.json(updated);
  }),
);

guildRouter.delete(
  '/autoroles/:roleId',
  asyncHandler(async (req, res) => {
    const existing = listAutoRoles(req.params.guildId).find((entry) => entry.id === req.params.roleId);
    if (!existing) throw new HttpError(404, 'Auto role not found.');
    deleteAutoRole(req.params.guildId, existing.id);
    await auditConfig(req, 'autorole_deleted', 'Auto role deleted from the dashboard.', { roleId: existing.roleId });
    res.json({ ok: true });
  }),
);

// Self-assignable roles
guildRouter.get('/selfroles', (req, res) => {
  const roles = listSelfRoles(req.params.guildId);
  const guild = botGuild(req.params.guildId);
  const botHighest = guild?.members.me?.roles.highest.position ?? Infinity;
  res.json(
    roles.map((role) => {
      const discordRole = guild?.roles.cache.get(role.roleId);
      return {
        ...role,
        roleName: discordRole?.name || null,
        roleColor: discordRole?.hexColor || null,
        assignable: discordRole ? !discordRole.managed && discordRole.position < botHighest : null,
      };
    }),
  );
});

guildRouter.post(
  '/selfroles',
  asyncHandler(async (req, res) => {
    const payload = validateSelfRole(req.body);
    const guild = botGuild(req.params.guildId);
    if (guild) {
      const role = guild.roles.cache.get(payload.roleId);
      if (!role) throw new ValidationError('That role does not exist in the server.', 'roleId');
      if (role.id === guild.id) throw new ValidationError('The @everyone role cannot be self-assigned.', 'roleId');
      if (role.managed) throw new ValidationError('That role is managed by an integration.', 'roleId');
      if (guild.members.me && role.position >= guild.members.me.roles.highest.position) {
        throw new ValidationError('That role is above the bot’s highest role.', 'roleId');
      }
    }
    const created = createSelfRole(req.params.guildId, payload);
    await auditConfig(req, 'selfrole_added', `Self-assignable role **${created.label}** added.`, { roleId: created.roleId });
    res.status(201).json(created);
  }),
);

guildRouter.delete(
  '/selfroles/:roleId',
  asyncHandler(async (req, res) => {
    const existing = listSelfRoles(req.params.guildId).find((entry) => entry.id === req.params.roleId);
    if (!existing) throw new HttpError(404, 'Self role not found.');
    deleteSelfRole(req.params.guildId, existing.id);
    await auditConfig(req, 'selfrole_deleted', `Self-assignable role **${existing.label}** deleted.`, { roleId: existing.roleId });
    res.json({ ok: true });
  }),
);

// Templates
guildRouter.get('/templates', (req, res) => {
  const type = req.query.type ? String(req.query.type) : 'welcome';
  if (!TEMPLATE_TYPES.includes(type)) throw new ValidationError('Invalid template type.');
  res.json({
    builtins: type === 'leave' ? BUILTIN_LEAVE_TEMPLATES : BUILTIN_WELCOME_TEMPLATES,
    custom: listTemplates(req.params.guildId, type),
  });
});

guildRouter.post(
  '/templates',
  asyncHandler(async (req, res) => {
    const type = req.body.type || 'welcome';
    if (!TEMPLATE_TYPES.includes(type)) throw new ValidationError('Invalid template type.');
    let content;
    let style;
    let image;
    if (req.body.fromCurrent !== false) {
      const current = type === 'leave' ? getLeaveConfig(req.params.guildId) : getWelcomeConfig(req.params.guildId);
      content = current.content;
      style = current.style;
      image = current.image;
    } else {
      content = req.body.content;
      style = req.body.style;
      image = req.body.image;
    }
    const payload = validateTemplate(
      {
        name: req.body.name,
        description: req.body.description || '',
        style: style || 'custom',
        content,
        image,
      },
      type,
    );
    const created = createTemplate(req.params.guildId, payload);
    await auditConfig(req, 'template_saved', `Template **${created.name}** saved.`, { type, templateId: created.id });
    res.status(201).json(created);
  }),
);

guildRouter.put(
  '/templates/:templateId',
  asyncHandler(async (req, res) => {
    const existing = getTemplate(req.params.guildId, req.params.templateId);
    if (!existing) throw new HttpError(404, 'Template not found.');
    const payload = validateTemplate({ ...existing, ...req.body, type: existing.type }, existing.type);
    const updated = updateTemplate(req.params.guildId, existing.id, payload);
    await auditConfig(req, 'template_updated', `Template **${updated.name}** updated.`, { templateId: updated.id });
    res.json(updated);
  }),
);

guildRouter.post(
  '/templates/:templateId/apply',
  asyncHandler(async (req, res) => {
    const type = req.body.type || req.query.type || 'welcome';
    if (!TEMPLATE_TYPES.includes(type)) throw new ValidationError('Invalid template type.');
    const template = findTemplate(req.params.guildId, type, req.params.templateId);
    if (!template) throw new HttpError(404, 'Template not found.');
    const config = type === 'leave' ? applyLeaveTemplate(req.params.guildId, template) : applyWelcomeTemplate(req.params.guildId, template);
    await auditConfig(req, 'template_applied', `Template **${template.name}** applied.`, { type, templateId: template.id });
    res.json({ config, template: { id: template.id, name: template.name, builtin: template.builtin } });
  }),
);

guildRouter.post(
  '/templates/:templateId/duplicate',
  asyncHandler(async (req, res) => {
    const type = req.body.type || req.query.type || 'welcome';
    const template = findTemplate(req.params.guildId, type, req.params.templateId);
    if (!template) throw new HttpError(404, 'Template not found.');
    const payload = validateTemplate(
      {
        name: `${template.name} copy`.slice(0, 100),
        description: template.description || '',
        style: template.style,
        content: template.content,
        image: template.image || null,
      },
      type,
    );
    const created = createTemplate(req.params.guildId, payload);
    await auditConfig(req, 'template_duplicated', `Template **${template.name}** duplicated.`, { templateId: created.id });
    res.status(201).json(created);
  }),
);

guildRouter.delete(
  '/templates/:templateId',
  asyncHandler(async (req, res) => {
    const existing = getTemplate(req.params.guildId, req.params.templateId);
    if (!existing) throw new HttpError(404, 'Template not found.');
    deleteTemplate(req.params.guildId, existing.id);
    await auditConfig(req, 'template_deleted', `Template **${existing.name}** deleted.`, { templateId: existing.id });
    res.json({ ok: true });
  }),
);

guildRouter.post(
  '/templates/restore-defaults',
  asyncHandler(async (req, res) => {
    const type = req.body.type || 'welcome';
    const templateId = type === 'leave' ? 'builtin-leave-classic' : 'builtin-classic';
    const template = findTemplate(req.params.guildId, type, templateId);
    if (!template) throw new HttpError(500, 'Default template is missing.');
    const config = type === 'leave' ? applyLeaveTemplate(req.params.guildId, template) : applyWelcomeTemplate(req.params.guildId, template);
    await auditConfig(req, 'template_restored', `Default ${type} template restored.`, { type });
    res.json({ config });
  }),
);

// Image templates & uploads
guildRouter.get('/image-templates', (req, res) => {
  res.json(listImageTemplates(req.params.guildId));
});

guildRouter.post(
  '/image-templates',
  asyncHandler(async (req, res) => {
    const payload = validateImageTemplate(req.body);
    const created = createImageTemplate(req.params.guildId, payload);
    await auditConfig(req, 'image_template_saved', `Image template **${created.name}** saved.`, { templateId: created.id });
    res.status(201).json(created);
  }),
);

guildRouter.delete(
  '/image-templates/:templateId',
  asyncHandler(async (req, res) => {
    const existing = listImageTemplates(req.params.guildId).find((entry) => entry.id === req.params.templateId);
    if (!existing) throw new HttpError(404, 'Image template not found.');
    deleteImageTemplate(req.params.guildId, existing.id);
    await auditConfig(req, 'image_template_deleted', `Image template **${existing.name}** deleted.`, { templateId: existing.id });
    res.json({ ok: true });
  }),
);

const IMAGE_EXTENSIONS = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif',
};

const storage = multer.diskStorage({
  destination(req, file, callback) {
    const dir = path.join(appConfig.uploadsDir, req.params.guildId);
    fs.mkdirSync(dir, { recursive: true });
    callback(null, dir);
  },
  filename(req, file, callback) {
    const extension = IMAGE_EXTENSIONS[file.mimetype];
    callback(null, `${crypto.randomUUID()}.${extension}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: appConfig.limits.uploadBytes, files: 1 },
  fileFilter(req, file, callback) {
    if (!IMAGE_EXTENSIONS[file.mimetype]) {
      return callback(new ValidationError('Only PNG, JPEG, WebP and GIF images are supported.', 'file'));
    }
    return callback(null, true);
  },
});

guildRouter.post(
  '/uploads',
  upload.single('file'),
  asyncHandler(async (req, res) => {
    if (!req.file) throw new ValidationError('No image was uploaded.', 'file');
    const relative = `uploads/${req.params.guildId}/${req.file.filename}`;
    await auditConfig(req, 'upload', `Background image ${req.file.filename} uploaded.`, { bytes: req.file.size });
    res.status(201).json({
      path: relative,
      url: `/api/guilds/${req.params.guildId}/uploads/${req.file.filename}`,
      bytes: req.file.size,
    });
  }),
);

guildRouter.get('/uploads', (req, res) => {
  const dir = path.join(appConfig.uploadsDir, req.params.guildId);
  if (!fs.existsSync(dir)) return res.json([]);
  const files = fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && /\.(png|jpe?g|webp|gif)$/i.test(entry.name))
    .map((entry) => {
      const stat = fs.statSync(path.join(dir, entry.name));
      return {
        name: entry.name,
        path: `uploads/${req.params.guildId}/${entry.name}`,
        url: `/api/guilds/${req.params.guildId}/uploads/${entry.name}`,
        bytes: stat.size,
        updatedAt: stat.mtimeMs,
      };
    })
    .sort((a, b) => b.updatedAt - a.updatedAt);
  res.json(files);
});

guildRouter.get('/uploads/:file', (req, res) => {
  if (!/^[A-Za-z0-9._-]{1,140}$/.test(req.params.file)) throw new HttpError(400, 'Invalid file name.');
  const absolute = path.join(appConfig.uploadsDir, req.params.guildId, req.params.file);
  if (!absolute.startsWith(path.resolve(appConfig.uploadsDir))) throw new HttpError(400, 'Invalid path.');
  if (!fs.existsSync(absolute)) throw new HttpError(404, 'File not found.');
  res.setHeader('Cache-Control', 'private, max-age=3600');
  res.sendFile(absolute);
});

guildRouter.delete(
  '/uploads/:file',
  asyncHandler(async (req, res) => {
    if (!/^[A-Za-z0-9._-]{1,140}$/.test(req.params.file)) throw new HttpError(400, 'Invalid file name.');
    const absolute = path.join(appConfig.uploadsDir, req.params.guildId, req.params.file);
    if (!absolute.startsWith(path.resolve(appConfig.uploadsDir))) throw new HttpError(400, 'Invalid path.');
    if (fs.existsSync(absolute)) fs.unlinkSync(absolute);
    res.json({ ok: true });
  }),
);

// Channels and roles
guildRouter.get('/channels', (req, res) => {
  const guild = botGuild(req.params.guildId);
  if (!guild) return res.json({ online: false, channels: [] });
  const channels = guild.channels.cache
    .filter((channel) =>
      [ChannelType.GuildText, ChannelType.GuildAnnouncement, ChannelType.GuildVoice, ChannelType.GuildCategory, ChannelType.GuildStageVoice].includes(channel.type),
    )
    .map((channel) => ({
      id: channel.id,
      name: channel.name,
      type: channel.type,
      parentId: channel.parentId,
      position: channel.rawPosition ?? channel.position,
      sendable: channel.isTextBased?.() ?? false,
    }))
    .sort((a, b) => a.position - b.position);
  res.json({ online: true, channels });
});

guildRouter.get('/roles', (req, res) => {
  const guild = botGuild(req.params.guildId);
  if (!guild) return res.json({ online: false, roles: [] });
  const botHighest = guild.members.me?.roles.highest.position ?? -1;
  const roles = guild.roles.cache
    .map((role) => ({
      id: role.id,
      name: role.name,
      color: role.hexColor,
      position: role.position,
      managed: role.managed,
      isEveryone: role.id === guild.id,
      assignable: !role.managed && role.id !== guild.id && role.position < botHighest,
    }))
    .sort((a, b) => b.position - a.position);
  res.json({ online: true, roles, botHighest });
});

// Invites
guildRouter.get('/invites', (req, res) => {
  const settings = getGuildSettings(req.params.guildId);
  const summary = getInviteSummary(req.params.guildId);
  res.json({
    tracking: settings.inviteTracking,
    vanityTracking: settings.vanityTracking,
    abuseThreshold: settings.abuseThreshold,
    abuseWindowMinutes: settings.abuseWindowMinutes,
    total: summary.total,
    last7Days: summary.last7Days,
    leaderboard: getInviteLeaderboard(req.params.guildId, 25),
    recent: getRecentInviteUses(req.params.guildId, 50),
  });
});

guildRouter.get(
  '/invites/:userId',
  asyncHandler(async (req, res) => {
    res.json(getInviterStats(req.params.guildId, req.params.userId));
  }),
);

guildRouter.post(
  '/invites/clear',
  asyncHandler(async (req, res) => {
    clearInvites(req.params.guildId);
    await auditConfig(req, 'invites_cleared', 'Invite attribution history was cleared from the dashboard.');
    res.json({ ok: true });
  }),
);

// Logs
guildRouter.get('/logs', (req, res) => {
  const category = req.query.category && req.query.category !== 'all' ? String(req.query.category) : null;
  if (category && !LOG_CATEGORIES.includes(category)) throw new ValidationError('Invalid log category.');
  const page = Math.max(1, parseIntOr(req.query.page, 1));
  const limit = Math.min(200, Math.max(1, parseIntOr(req.query.limit, 50)));
  const result = listLogs(req.params.guildId, { category, limit, offset: (page - 1) * limit });
  res.json({ ...result, page, limit, category: category || 'all' });
});

guildRouter.delete(
  '/logs',
  asyncHandler(async (req, res) => {
    const removed = clearLogs(req.params.guildId);
    addLog(req.params.guildId, 'system', 'logs_cleared', `Logs cleared from the dashboard (${removed} entries).`, req.session.userId);
    res.json({ ok: true, removed });
  }),
);

// Statistics
guildRouter.get('/stats', (req, res) => {
  const stats = getStatistics(req.params.guildId, Math.min(90, Math.max(7, parseIntOr(req.query.days, 30))));
  res.json({
    ...stats,
    inviteTotal: countInvites(req.params.guildId),
    leaderboard: getInviteLeaderboard(req.params.guildId, 5),
  });
});

// Preview
function draftForGuild(guildId, body) {
  const kind = body.kind === 'dm' ? 'dm' : body.kind === 'leave' ? 'leave' : 'welcome';
  if (kind === 'leave') return { kind, config: validateLeaveConfig(body.config), group: 'leave' };
  return { kind, config: validateWelcomeConfig(body.config), group: 'welcome' };
}

guildRouter.post(
  '/preview/message',
  asyncHandler(async (req, res) => {
    const { kind, config, group } = draftForGuild(req.params.guildId, req.body);
    const guild = plainGuild(req.params.guildId);
    const result = await buildPreview({
      guild,
      welcomeConfig: group === 'welcome' ? config : null,
      leaveConfig: group === 'leave' ? config : null,
      kind,
      generateImage: false,
      sampleOptions: {
        returning: Boolean(req.body.sample?.returning),
        isBot: Boolean(req.body.sample?.isBot),
      },
    });
    res.json({
      model: result.model,
      image: {
        enabled: Boolean(config.image?.enabled && result.model.attachments.length),
      },
    });
  }),
);

guildRouter.post(
  '/preview/image',
  rateLimit({ windowMs: 60_000, max: 90, prefix: 'preview-image' }),
  asyncHandler(async (req, res) => {
    const { kind, config, group } = draftForGuild(req.params.guildId, req.body);
    const forced = structuredClone(config);
    forced.image.enabled = true;
    forced.content.elements.image = true;
    const guild = plainGuild(req.params.guildId);
    const result = await buildPreview({
      guild,
      welcomeConfig: group === 'welcome' ? forced : null,
      leaveConfig: group === 'leave' ? forced : null,
      kind: group === 'leave' ? 'leave' : kind,
      generateImage: true,
    });
    if (!result.imageBuffer) throw new HttpError(422, 'The banner could not be generated. Check the image settings.');
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', 'no-store');
    res.send(result.imageBuffer);
  }),
);

guildRouter.post(
  '/test',
  asyncHandler(async (req, res) => {
    const kind = req.body.kind === 'leave' ? 'leave' : req.body.kind === 'dm' ? 'dm' : 'welcome';
    const client = getClient();
    const guild = client.guilds.cache.get(req.params.guildId);
    if (!guild) throw new HttpError(409, 'The bot is offline or not in this server.');
    if (kind === 'dm') {
      const discordUser = await client.users.fetch(req.session.userId).catch(() => null);
      if (!discordUser) throw new HttpError(409, 'Could not resolve your Discord account for the DM test.');
      const { deliverDmTest } = await import('../welcome/service.js');
      const dmResult = await deliverDmTest(client, guild, discordUser);
      await auditConfig(req, 'test', 'A welcome DM test was triggered from the dashboard.');
      return res.json(dmResult);
    }
    let actor = guild.members.cache.get(req.session.userId);
    if (!actor) actor = await guild.members.fetch(req.session.userId).catch(() => null);
    if (!actor) actor = guild.members.me;
    if (!actor) throw new HttpError(409, 'Could not resolve a member for the test.');
    const { deliverTest } = await import('../welcome/service.js');
    const result = await deliverTest(client, guild, actor, kind);
    await auditConfig(req, 'test', `A ${kind} test message was triggered from the dashboard.`);
    res.json(result);
  }),
);

// Advanced actions
guildRouter.post(
  '/actions',
  asyncHandler(async (req, res) => {
    const action = req.body.action;
    const guildId = req.params.guildId;
    if (req.body.confirm !== true) throw new ValidationError('This action requires confirmation.');
    if (action === 'reset-welcome') {
      const config = resetWelcomeConfig(guildId);
      await auditConfig(req, 'reset_welcome', 'Welcome configuration reset to defaults from the dashboard.');
      return res.json({ ok: true, config });
    }
    if (action === 'reset-leave') {
      const config = getLeaveConfig(guildId);
      config.content = structuredClone(DEFAULT_LEAVE_CONTENT);
      config.image = structuredClone(DEFAULT_LEAVE_IMAGE_CONFIG);
      config.style = 'classic';
      config.enabled = true;
      const saved = saveLeaveConfig(guildId, config);
      await auditConfig(req, 'reset_leave', 'Leave configuration reset to defaults from the dashboard.');
      return res.json({ ok: true, config: saved });
    }
    if (action === 'clear-logs') {
      const removed = clearLogs(guildId);
      addLog(guildId, 'system', 'logs_cleared', `Logs cleared from the dashboard (${removed} entries).`, req.session.userId);
      return res.json({ ok: true, removed });
    }
    if (action === 'clear-invites') {
      clearInvites(guildId);
      await auditConfig(req, 'invites_cleared', 'Invite attribution history was cleared from the dashboard.');
      return res.json({ ok: true });
    }
    throw new ValidationError('Unknown action.');
  }),
);

apiRouter.use('/guilds/:guildId', guildRouter);
