import {
  DEFAULT_DM_CONTENT,
  DEFAULT_GUILD_SETTINGS,
  DEFAULT_IMAGE_CONFIG,
  DEFAULT_LEAVE_CONTENT,
  DEFAULT_LEAVE_IMAGE_CONFIG,
  DEFAULT_LEAVE_SETTINGS,
  DEFAULT_WELCOME_CONTENT,
  DEFAULT_WELCOME_SETTINGS,
  ELEMENT_KEYS,
  STYLE_IDS,
} from './defaults.js';

export class ValidationError extends Error {
  constructor(message, field = null) {
    super(message);
    this.name = 'ValidationError';
    this.status = 400;
    this.field = field;
  }
}

const SNOWFLAKE = /^\d{16,20}$/;
const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;
const UPLOAD_PATH = /^uploads\/[A-Za-z0-9_-]{1,64}\/[A-Za-z0-9._-]{1,140}$/;
const BUTTON_TYPES = ['rules', 'roles', 'intro', 'ticket', 'dashboard', 'url'];
const BUTTON_SCOPES = ['welcome', 'dm', 'leave'];

export function isSnowflake(value) {
  return typeof value === 'string' && SNOWFLAKE.test(value);
}

function optionalSnowflake(value, field) {
  if (value === null || value === undefined || value === '') return null;
  if (!isSnowflake(String(value))) throw new ValidationError(`${field} must be a Discord ID.`, field);
  return String(value);
}

function text(value, field, max, { allowEmpty = true } = {}) {
  if (value === null || value === undefined) value = '';
  if (typeof value !== 'string') throw new ValidationError(`${field} must be text.`, field);
  const clean = value.replace(/\u0000/g, '').replace(/\r\n/g, '\n');
  if (!allowEmpty && clean.trim().length === 0) throw new ValidationError(`${field} cannot be empty.`, field);
  if (clean.length > max) throw new ValidationError(`${field} must be at most ${max} characters.`, field);
  return clean;
}

function oneOf(value, allowed, field, fallback) {
  if (value === undefined || value === null) return fallback;
  if (!allowed.includes(value)) throw new ValidationError(`${field} must be one of: ${allowed.join(', ')}.`, field);
  return value;
}

function boolean(value, fallback = false) {
  if (value === undefined || value === null) return fallback;
  return value === true || value === 1 || value === '1';
}

function clampInt(value, min, max, fallback, field) {
  if (value === undefined || value === null || value === '') return fallback;
  const number = Number(value);
  if (!Number.isFinite(number)) throw new ValidationError(`${field} must be a number.`, field);
  return Math.round(Math.min(max, Math.max(min, number)));
}

function hex(value, fallback = '#5865F2', field = 'color') {
  if (value === undefined || value === null || value === '') return fallback;
  const color = String(value).trim();
  if (!HEX_COLOR.test(color)) throw new ValidationError(`${field} must be a hex color like #5865F2.`, field);
  return color.toUpperCase();
}

function webUrl(value, field, { required = false } = {}) {
  if (value === null || value === undefined || value === '') {
    if (required) throw new ValidationError(`${field} is required.`, field);
    return null;
  }
  if (typeof value !== 'string' || value.length > 512) throw new ValidationError(`${field} is invalid.`, field);
  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    throw new ValidationError(`${field} must be a valid URL.`, field);
  }
  if (!['https:', 'http:'].includes(parsed.protocol)) {
    throw new ValidationError(`${field} must use http or https.`, field);
  }
  if (parsed.username || parsed.password) throw new ValidationError(`${field} must not contain credentials.`, field);
  return parsed.toString();
}

function emoji(value, field) {
  if (value === null || value === undefined || value === '') return '';
  if (typeof value !== 'string' || value.length > 64 || value.includes('\n')) {
    throw new ValidationError(`${field} must be a short emoji or custom emoji.`, field);
  }
  return value;
}

function mergeVariant(base, patch) {
  if (!patch || typeof patch !== 'object') return { ...base };
  return {
    title: text(patch.title ?? base.title ?? '', 'variant.title', 256),
    description: text(patch.description ?? base.description ?? '', 'variant.description', 3500),
    emoji: emoji(patch.emoji ?? base.emoji ?? '', 'variant.emoji'),
  };
}

export function normalizeContent(input = {}, base = DEFAULT_WELCOME_CONTENT, field = 'content') {
  if (input !== null && typeof input !== 'object') throw new ValidationError(`${field} must be an object.`, field);
  const source = input || {};
  const elements = {};
  for (const key of ELEMENT_KEYS) {
    elements[key] = boolean(source.elements?.[key], base.elements?.[key] ?? false);
  }
  const variants = {};
  const variantKeys = new Set([...Object.keys(base.variants || {}), ...Object.keys(source.variants || {})]);
  for (const key of variantKeys) {
    variants[key] = mergeVariant(base.variants?.[key] || {}, source.variants?.[key]);
  }

  const title = text(source.title ?? base.title, `${field}.title`, 256);
  const description = text(source.description ?? base.description, `${field}.description`, 3500);
  const footer = text(source.footer ?? base.footer, `${field}.footer`, 1024);
  if (title.length + description.length + footer.length > 5900) {
    throw new ValidationError(`${field} content is too long overall.`, field);
  }

  return {
    title,
    description,
    footer,
    color: hex(source.color ?? base.color, base.color, `${field}.color`),
    emoji: emoji(source.emoji ?? base.emoji, `${field}.emoji`),
    mention: boolean(source.mention, base.mention),
    elements,
    variants,
  };
}

export function normalizeImage(input = {}, base = DEFAULT_IMAGE_CONFIG, field = 'image') {
  const source = input && typeof input === 'object' ? input : {};
  const merged = {
    ...base,
    ...source,
    background: { ...base.background, ...(source.background || {}) },
    avatar: { ...base.avatar, ...(source.avatar || {}) },
    text: { ...base.text, ...(source.text || {}) },
    server: { ...base.server, ...(source.server || {}) },
    memberNumber: { ...base.memberNumber, ...(source.memberNumber || {}) },
    decorations: { ...base.decorations, ...(source.decorations || {}) },
  };

  const backgroundImage = merged.background.image;
  if (backgroundImage && !UPLOAD_PATH.test(String(backgroundImage))) {
    throw new ValidationError(`${field}.background.image must be an uploaded asset.`, `${field}.background.image`);
  }
  const colors = Array.isArray(merged.background.colors) ? merged.background.colors : base.background.colors;
  if (colors.length === 0 || colors.length > 5) {
    throw new ValidationError(`${field}.background.colors needs 1-5 colors.`, `${field}.background.colors`);
  }
  const font = text(merged.font ?? merged.text.font ?? 'Segoe UI', `${field}.font`, 64).trim() || 'Segoe UI';

  return {
    enabled: boolean(merged.enabled, true),
    width: clampInt(merged.width, 400, 2000, 1024, `${field}.width`),
    height: clampInt(merged.height, 150, 1000, 420, `${field}.height`),
    font,
    background: {
      type: oneOf(merged.background.type, ['gradient', 'color', 'image'], `${field}.background.type`, 'gradient'),
      colors: colors.map((color, index) => hex(color, base.background.colors[index] || '#0B1020', `${field}.background.colors`)),
      angle: clampInt(merged.background.angle, 0, 360, 135, `${field}.background.angle`),
      image: backgroundImage ? String(backgroundImage) : null,
      fit: oneOf(merged.background.fit, ['cover', 'contain', 'stretch'], `${field}.background.fit`, 'cover'),
      overlay: Math.min(0.95, Math.max(0, Number(merged.background.overlay) || 0)),
    },
    avatar: {
      show: boolean(merged.avatar.show, true),
      shape: oneOf(merged.avatar.shape, ['circle', 'rounded', 'square'], `${field}.avatar.shape`, 'circle'),
      size: clampInt(merged.avatar.size, 40, 400, 156, `${field}.avatar.size`),
      x: clampInt(merged.avatar.x, 0, 2000, 88, `${field}.avatar.x`),
      y: clampInt(merged.avatar.y, 0, 1000, 132, `${field}.avatar.y`),
      borderColor: hex(merged.avatar.borderColor, '#FFFFFF', `${field}.avatar.borderColor`),
      borderWidth: clampInt(merged.avatar.borderWidth, 0, 24, 6, `${field}.avatar.borderWidth`),
      glow: boolean(merged.avatar.glow, true),
    },
    text: {
      x: clampInt(merged.text.x, 0, 2000, 286, `${field}.text.x`),
      y: clampInt(merged.text.y, 0, 1000, 118, `${field}.text.y`),
      align: oneOf(merged.text.align, ['left', 'center', 'right'], `${field}.text.align`, 'left'),
      titleColor: hex(merged.text.titleColor, '#C7D2FE', `${field}.text.titleColor`),
      userColor: hex(merged.text.userColor, '#FFFFFF', `${field}.text.userColor`),
      subtitleColor: hex(merged.text.subtitleColor, '#A5B4FC', `${field}.text.subtitleColor`),
      titleSize: clampInt(merged.text.titleSize, 10, 100, 26, `${field}.text.titleSize`),
      userSize: clampInt(merged.text.userSize, 12, 140, 56, `${field}.text.userSize`),
      subtitleSize: clampInt(merged.text.subtitleSize, 10, 80, 22, `${field}.text.subtitleSize`),
    },
    server: {
      show: boolean(merged.server.show, true),
      logo: boolean(merged.server.logo, true),
      x: clampInt(merged.server.x, 0, 2000, 832, `${field}.server.x`),
      y: clampInt(merged.server.y, 0, 1000, 32, `${field}.server.y`),
      size: clampInt(merged.server.size, 16, 200, 56, `${field}.server.size`),
      nameColor: hex(merged.server.nameColor, '#E2E8F0', `${field}.server.nameColor`),
      nameSize: clampInt(merged.server.nameSize, 8, 60, 20, `${field}.server.nameSize`),
    },
    memberNumber: {
      show: boolean(merged.memberNumber.show, true),
      x: clampInt(merged.memberNumber.x, 0, 2000, 286, `${field}.memberNumber.x`),
      y: clampInt(merged.memberNumber.y, 0, 1000, 300, `${field}.memberNumber.y`),
      color: hex(merged.memberNumber.color, '#C7D2FE', `${field}.memberNumber.color`),
      size: clampInt(merged.memberNumber.size, 10, 80, 24, `${field}.memberNumber.size`),
    },
    decorations: {
      glow: boolean(merged.decorations.glow, true),
      particles: boolean(merged.decorations.particles, true),
      grid: boolean(merged.decorations.grid, true),
      accentBar: boolean(merged.decorations.accentBar, true),
    },
  };
}

export function validateWelcomeConfig(body = {}) {
  const channels = body.channels || {};
  return {
    enabled: boolean(body.enabled, DEFAULT_WELCOME_SETTINGS.enabled),
    channels: {
      main: optionalSnowflake(channels.main, 'channels.main'),
      secondary: optionalSnowflake(channels.secondary, 'channels.secondary'),
      rules: optionalSnowflake(channels.rules, 'channels.rules'),
      introductions: optionalSnowflake(channels.introductions, 'channels.introductions'),
      announcements: optionalSnowflake(channels.announcements, 'channels.announcements'),
    },
    style: oneOf(body.style, STYLE_IDS, 'style', DEFAULT_WELCOME_SETTINGS.style),
    sendMode: oneOf(body.sendMode, ['public', 'dm', 'both'], 'sendMode', 'public'),
    botMode: oneOf(body.botMode, ['enabled', 'skip'], 'botMode', 'enabled'),
    returningMode: oneOf(body.returningMode, ['returning', 'normal', 'skip'], 'returningMode', 'returning'),
    content: normalizeContent(body.content, DEFAULT_WELCOME_CONTENT, 'content'),
    image: normalizeImage(body.image, DEFAULT_IMAGE_CONFIG, 'image'),
    dmContent: normalizeContent(body.dmContent, DEFAULT_DM_CONTENT, 'dmContent'),
  };
}

export function validateLeaveConfig(body = {}) {
  return {
    enabled: boolean(body.enabled, DEFAULT_LEAVE_SETTINGS.enabled),
    channelId: optionalSnowflake(body.channelId, 'channelId'),
    style: oneOf(body.style, STYLE_IDS, 'style', 'classic'),
    sendMode: oneOf(body.sendMode, ['public'], 'sendMode', 'public'),
    content: normalizeContent(body.content, DEFAULT_LEAVE_CONTENT, 'content'),
    image: normalizeImage(body.image, DEFAULT_LEAVE_IMAGE_CONFIG, 'image'),
  };
}

export function validateGuildSettings(body = {}) {
  return {
    logChannelId: optionalSnowflake(body.logChannelId, 'logChannelId'),
    inviteTracking: boolean(body.inviteTracking, true),
    vanityTracking: boolean(body.vanityTracking, true),
    abuseThreshold: clampInt(body.abuseThreshold, 1, 100, 6, 'abuseThreshold'),
    abuseWindowMinutes: clampInt(body.abuseWindowMinutes, 1, 1440, 30, 'abuseWindowMinutes'),
    welcomeDelayMs: clampInt(body.welcomeDelayMs, 0, 600000, 0, 'welcomeDelayMs'),
    deleteWelcomeAfter: clampInt(body.deleteWelcomeAfter, 0, 604800, 0, 'deleteWelcomeAfter'),
    dmFailureNotice: boolean(body.dmFailureNotice, true),
    dryRun: boolean(body.dryRun, false),
    ticketChannelId: optionalSnowflake(body.ticketChannelId, 'ticketChannelId'),
    rolesChannelId: optionalSnowflake(body.rolesChannelId, 'rolesChannelId'),
    rulesText: text(body.rulesText ?? '', 'rulesText', 2000),
  };
}

export function validateButton(body = {}, existingCount = 0) {
  const type = oneOf(body.type, BUTTON_TYPES, 'type', 'url');
  const style = clampInt(body.style, 1, 5, type === 'url' || type === 'dashboard' ? 5 : 2, 'style');
  const scope = oneOf(body.scope, BUTTON_SCOPES, 'scope', 'welcome');
  if (existingCount >= 25) throw new ValidationError('A message can contain at most 25 buttons.');
  if (scope === 'dm' && !['url', 'dashboard'].includes(type)) {
    throw new ValidationError('Direct-message buttons must be URL or dashboard links.', 'type');
  }
  if (type === 'url') {
    return {
      scope,
      label: text(body.label, 'label', 80, { allowEmpty: false }),
      emoji: emoji(body.emoji, 'emoji'),
      style: 5,
      type,
      url: webUrl(body.url, 'url', { required: true }),
      enabled: boolean(body.enabled, true),
    };
  }
  if (type === 'dashboard') {
    return {
      scope,
      label: text(body.label, 'label', 80, { allowEmpty: false }),
      emoji: emoji(body.emoji, 'emoji'),
      style: 5,
      type,
      url: null,
      enabled: boolean(body.enabled, true),
    };
  }
  return {
    scope,
    label: text(body.label, 'label', 80, { allowEmpty: false }),
    emoji: emoji(body.emoji, 'emoji'),
    style: style === 5 ? 2 : style,
    type,
    url: null,
    enabled: boolean(body.enabled, true),
  };
}

export function validateAutoRole(body = {}) {
  if (!isSnowflake(body.roleId)) throw new ValidationError('roleId must be a Discord role ID.', 'roleId');
  return {
    roleId: body.roleId,
    target: oneOf(body.target, ['human', 'bot', 'all'], 'target', 'human'),
    enabled: boolean(body.enabled, true),
    delaySeconds: clampInt(body.delaySeconds, 0, 3600, 0, 'delaySeconds'),
  };
}

export function validateSelfRole(body = {}) {
  if (!isSnowflake(body.roleId)) throw new ValidationError('roleId must be a Discord role ID.', 'roleId');
  return {
    roleId: body.roleId,
    label: text(body.label, 'label', 80, { allowEmpty: false }),
    emoji: emoji(body.emoji, 'emoji'),
    enabled: boolean(body.enabled, true),
  };
}

export function validateTemplate(body = {}, type = 'welcome') {
  const isLeave = type === 'leave';
  return {
    type: isLeave ? 'leave' : 'welcome',
    name: text(body.name, 'name', 100, { allowEmpty: false }),
    description: text(body.description ?? '', 'description', 300),
    style: oneOf(body.style, STYLE_IDS, 'style', 'custom'),
    content: normalizeContent(body.content, isLeave ? DEFAULT_LEAVE_CONTENT : DEFAULT_WELCOME_CONTENT, 'content'),
    image: body.image ? normalizeImage(body.image, isLeave ? DEFAULT_LEAVE_IMAGE_CONFIG : DEFAULT_IMAGE_CONFIG, 'image') : null,
  };
}

export function validateImageTemplate(body = {}) {
  const backgroundPath = body.backgroundPath || null;
  if (backgroundPath && !UPLOAD_PATH.test(String(backgroundPath))) {
    throw new ValidationError('backgroundPath must be an uploaded asset.', 'backgroundPath');
  }
  return {
    name: text(body.name, 'name', 100, { allowEmpty: false }),
    backgroundPath,
    config: normalizeImage(body.config, DEFAULT_IMAGE_CONFIG, 'config'),
  };
}

export { DEFAULT_GUILD_SETTINGS };
