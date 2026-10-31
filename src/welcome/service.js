import { logEvent } from '../bot/audit.js';
import {
  getLeaveConfig,
  getStatistics,
  getWelcomeConfig,
  getGuildSettings,
  listButtons,
} from '../db/repositories.js';
import { buildMessagePayload } from './components.js';
import { generateWelcomeImage } from './image.js';
import { buildMessageModel } from './model.js';

const DEFAULT_AVATAR = 'https://cdn.discordapp.com/embed/avatars/0.png';
const DEFAULT_ICON = 'https://cdn.discordapp.com/embed/avatars/2.png';

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function schedule(callback, ms) {
  const timer = setTimeout(callback, ms);
  timer.unref?.();
  return timer;
}

export function guildImageContext(guild) {
  return {
    name: guild.name,
    iconURL: guild.iconURL?.({ extension: 'png', size: 256 }) || null,
  };
}

export function memberImageContext(member) {
  return {
    username: member.user?.username || member.username,
    displayName: member.displayName || member.user?.globalName || member.user?.username,
    avatarURL: member.displayAvatarURL?.({ extension: 'png', size: 512 }) || member.avatarURL || null,
  };
}

function channelLinks(config) {
  return {
    main: config.channels?.main || null,
    secondary: config.channels?.secondary || null,
    rules: config.channels?.rules || null,
    introductions: config.channels?.introductions || null,
    announcements: config.channels?.announcements || null,
  };
}

export async function generateBanner({imageConfig, style, accent, guild, member, inviter, memberNumber, returning, kind, timestamp}) {
  if (!imageConfig?.enabled) return null;
  try {
    const buffer = await generateWelcomeImage({
      config: imageConfig,
      style,
      accent,
      data: {
        username: member.username,
        displayName: member.displayName || member.username,
        memberNumber,
        guildName: guild.name,
        avatarUrl: member.avatarURL,
        serverIconUrl: guild.iconURL,
        joinedAt: member.joinedAt || timestamp,
        inviterName: inviter?.name || null,
        returning,
        backgroundPath: imageConfig.background?.image || null,
      },
    });
    return buffer;
  } catch (error) {
    await logEvent(null, guild.id, 'image', 'failed', `Welcome image generation failed: ${error.message}`, {
      notify: false,
    });
    return null;
  }
}

export async function prepareMessage({
  kind,
  guild,
  member,
  welcomeConfig,
  leaveConfig,
  inviter = null,
  inviteCode = null,
  memberNumber = 1,
  returning = false,
  scope = 'welcome',
  stats = null,
  generateImage = true,
  imageBufferOverride = null,
}) {
  const isLeave = kind === 'leave';
  const content = isLeave ? leaveConfig.content : scope === 'dm' ? welcomeConfig.dmContent : welcomeConfig.content;
  const imageConfig = isLeave ? leaveConfig.image : welcomeConfig.image;
  const style = isLeave ? leaveConfig.style : welcomeConfig.style;
  const buttonScope = scope === 'dm' ? 'dm' : 'welcome';
  const buttons = isLeave ? [] : listButtons(guild.id, buttonScope);
  const wantsImage = Boolean(content.elements.image && imageConfig.enabled);
  let imageBuffer = imageBufferOverride;
  if (wantsImage && generateImage && !imageBuffer) {
    imageBuffer = await generateBanner({
      imageConfig,
      style,
      accent: content.color,
      guild,
      member,
      inviter,
      memberNumber,
      returning,
      kind,
      timestamp: Date.now(),
    });
  }
  const attachmentName = wantsImage && (imageBuffer || !generateImage) ? `${isLeave ? 'leave' : 'welcome'}.png` : null;
  const guildIcon = typeof guild.iconURL === 'function' ? guild.iconURL({ extension: 'png', size: 256 }) : guild.iconURL;
  const model = buildMessageModel({
    kind: isLeave ? 'leave' : kind,
    style,
    content,
    guild: { id: guild.id, name: guild.name, iconURL: guildIcon, memberCount: guild.memberCount },
    member,
    inviter,
    inviteCode,
    memberNumber,
    returning,
    channels: isLeave ? { main: leaveConfig.channelId } : channelLinks(welcomeConfig),
    stats,
    buttons,
    imageAttachment: wantsImage ? attachmentName : null,
    timestamp: Date.now(),
  });
  const files = imageBuffer ? [{ attachment: imageBuffer, name: attachmentName }] : [];
  return { model, files, imageBuffer, content, style, imageConfig };
}

export function sampleContext(guild, { memberNumber = 1024, username = 'Nova', returning = false, isBot = false } = {}) {
  const member = {
    id: '111111111111111111',
    username,
    displayName: username,
    avatarURL: DEFAULT_AVATAR,
    isBot,
    createdAt: Date.now() - 1000 * 60 * 60 * 24 * 420,
    joinedAt: Date.now(),
  };
  const inviter = { id: '222222222222222222', name: 'Kai', avatarURL: DEFAULT_AVATAR };
  return {
    member,
    inviter,
    inviteCode: 'aurora',
    memberNumber,
    returning,
    guild: {
      id: guild?.id || '999999999999999999',
      name: guild?.name || 'Aurora Community',
      iconURL: guild?.iconURL || DEFAULT_ICON,
      memberCount: guild?.memberCount || 12480,
    },
    stats: { todayJoins: 12, weekJoins: 88, totalJoins: 2048 },
  };
}

export async function buildPreview({ guild, welcomeConfig, leaveConfig, kind = 'welcome', memberNumber = null, generateImage = false, sampleOptions = {} }) {
  const normalizedGuild = guild
    ? {
        id: guild.id,
        name: guild.name,
        iconURL: typeof guild.iconURL === 'function' ? guild.iconURL({ extension: 'png', size: 256 }) : guild.iconURL,
        memberCount: guild.memberCount,
      }
    : null;
  const stats = guild?.id ? getStatistics(guild.id) : null;
  const sample = sampleContext(normalizedGuild, {
    memberNumber: memberNumber ?? (stats?.totalJoins ? stats.totalJoins + 1 : 1024),
    returning: Boolean(sampleOptions.returning),
    isBot: Boolean(sampleOptions.isBot),
  });
  const effectiveGuild = normalizedGuild || sample.guild;
  if (kind === 'leave') {
    const config = leaveConfig || getLeaveConfig(guild.id);
    return prepareMessage({
      kind: 'leave',
      guild: effectiveGuild,
      member: sample.member,
      leaveConfig: config,
      memberNumber: 512,
      stats,
      generateImage,
    });
  }
  const config = welcomeConfig || getWelcomeConfig(guild.id);
  return prepareMessage({
    kind,
    guild: effectiveGuild,
    member: sample.member,
    welcomeConfig: config,
    inviter: sample.inviter,
    inviteCode: sample.inviteCode,
    memberNumber: sample.memberNumber,
    returning: sample.returning,
    scope: kind === 'dm' ? 'dm' : 'welcome',
    stats,
    generateImage,
  });
}

function modelWithoutImage(model) {
  return {
    ...model,
    blocks: model.blocks.filter((block) => block.type !== 'gallery'),
    attachments: [],
  };
}

function canSend(channel, requiresAttachments) {
  try {
    const permissions = channel.permissionsFor(channel.guild.members.me);
    if (!permissions?.has(['ViewChannel', 'SendMessages'])) return { ok: false, reason: 'missing send permissions' };
    if (requiresAttachments && !permissions.has('AttachFiles')) {
      return { ok: true, stripImage: true, reason: 'missing attach files permission' };
    }
    return { ok: true, stripImage: false };
  } catch {
    return { ok: true, stripImage: false };
  }
}

async function sendToChannel(channel, model, files, client, guildId, settings, test = false) {
  const needsImage = files.length > 0;
  const check = canSend(channel, needsImage);
  if (!check.ok) {
    await logEvent(client, guildId, 'welcome', 'skipped', `Could not post in <#${channel.id}>: ${check.reason}.`, {
      meta: { channelId: channel.id },
    });
    return { ok: false, reason: check.reason };
  }
  const effectiveModel = check.stripImage ? modelWithoutImage(model) : model;
  const effectiveFiles = check.stripImage ? [] : files;
  if (check.stripImage) {
    await logEvent(client, guildId, 'welcome', 'image_skipped', `Image omitted in <#${channel.id}> due to missing Attach Files permission.`, {
      meta: { channelId: channel.id },
      notify: false,
    });
  }
  try {
    const payload = buildMessagePayload(effectiveModel, { files: effectiveFiles });
    const message = await channel.send(payload);
    if (settings?.deleteWelcomeAfter > 0 && !test) {
      schedule(() => message.delete().catch(() => {}), settings.deleteWelcomeAfter * 1000);
    }
    return { ok: true, message, strippedImage: check.stripImage };
  } catch (error) {
    await logEvent(client, guildId, 'welcome', 'failed', `Could not send in <#${channel.id}>: ${error.message}`, {
      meta: { channelId: channel.id, code: error.code },
    });
    return { ok: false, reason: error.message };
  }
}

/**
 * Delivers the welcome flow: public message(s) and/or DM, with images, logs and
 * permission-aware fallbacks. Never throws into the gateway event handler.
 */
export async function deliverWelcome(client, member, { invite = null, memberNumber = 1, returning = false, test = false } = {}) {
  const guild = member.guild;
  const welcomeConfig = getWelcomeConfig(guild.id);
  const settings = getGuildSettings(guild.id);
  const isBot = Boolean(member.user?.bot);
  if (!test) {
    if (!welcomeConfig.enabled) return { skipped: 'disabled' };
    if (isBot && welcomeConfig.botMode === 'skip') return { skipped: 'bot_skip' };
    if (returning && welcomeConfig.returningMode === 'skip') return { skipped: 'returning_skip' };
  }
  if (settings.dryRun && !test) {
    await logEvent(client, guild.id, 'welcome', 'dry_run', `Dry run: welcome for @${member.user.username} was not sent.`, {
      userId: member.id,
      meta: { sendMode: welcomeConfig.sendMode },
    });
    return { skipped: 'dry_run' };
  }
  if (!test && settings.welcomeDelayMs > 0) await sleep(settings.welcomeDelayMs);

  const stats = getStatistics(guild.id);
  const inviter = invite?.inviterId ? { id: invite.inviterId, name: invite.inviterName } : null;
  const prepared = await prepareMessage({
    kind: 'welcome',
    guild,
    member: {
      id: member.id,
      username: member.user.username,
      displayName: member.displayName,
      avatarURL: member.displayAvatarURL?.({ extension: 'png', size: 512 }) || DEFAULT_AVATAR,
      isBot,
      createdAt: member.user.createdTimestamp,
      joinedAt: member.joinedTimestamp || Date.now(),
    },
    welcomeConfig,
    inviter,
    inviteCode: invite?.code || null,
    memberNumber,
    returning,
    scope: 'welcome',
    stats,
    generateImage: true,
  });

  const results = { channels: [], dm: null, imageGenerated: Boolean(prepared.imageBuffer) };
  const publicMode = test || welcomeConfig.sendMode === 'public' || welcomeConfig.sendMode === 'both';
  if (publicMode) {
    const channelIds = [...new Set([welcomeConfig.channels.main, welcomeConfig.channels.secondary].filter(Boolean))];
    for (const channelId of channelIds) {
      const channel = guild.channels.cache.get(channelId);
      if (!channel || !(channel.isSendable?.() ?? channel.isTextBased())) {
        await logEvent(client, guild.id, 'welcome', 'channel_missing', `Welcome channel ${channelId} is missing or unavailable.`, {
          notify: false,
        });
        continue;
      }
      const result = await sendToChannel(channel, prepared.model, prepared.files, client, guild.id, settings, test);
      results.channels.push({ channelId, ...result, message: undefined });
      if (result.ok) {
        await logEvent(client, guild.id, 'welcome', test ? 'test_sent' : 'sent', `Welcome posted for @${member.user.username} in <#${channelId}>.`, {
          userId: member.id,
          meta: { channelId, memberNumber },
        });
      }
    }
    if (channelIds.length === 0) {
      await logEvent(client, guild.id, 'welcome', 'no_channel', 'Welcome is enabled for public delivery but no channel is configured.', {
        notify: false,
      });
    }
  }

  const dmMode = !test && (welcomeConfig.sendMode === 'dm' || welcomeConfig.sendMode === 'both');
  if (dmMode) {
    const dmPrepared = await prepareMessage({
      kind: 'dm',
      guild,
      member: {
        id: member.id,
        username: member.user.username,
        displayName: member.displayName,
        avatarURL: member.displayAvatarURL?.({ extension: 'png', size: 512 }) || DEFAULT_AVATAR,
        isBot,
        createdAt: member.user.createdTimestamp,
        joinedAt: member.joinedTimestamp || Date.now(),
      },
      welcomeConfig,
      inviter,
      inviteCode: invite?.code || null,
      memberNumber,
      returning,
      scope: 'dm',
      stats,
      generateImage: true,
      imageBufferOverride: prepared.imageBuffer,
    });
    try {
      const payload = buildMessagePayload(dmPrepared.model, { files: dmPrepared.files });
      await member.send(payload);
      results.dm = { ok: true };
      await logEvent(client, guild.id, 'dm', 'sent', `Welcome DM delivered to @${member.user.username}.`, { userId: member.id });
    } catch (error) {
      results.dm = { ok: false, reason: error.message };
      await logEvent(client, guild.id, 'dm', 'failed', `Welcome DM to @${member.user.username} failed: ${error.message}`, {
        userId: member.id,
        meta: { code: error.code },
        notify: settings.dmFailureNotice,
      });
    }
  }
  return results;
}

export async function deliverLeave(client, member, history = null) {
  const guild = member.guild;
  const leaveConfig = getLeaveConfig(guild.id);
  if (!leaveConfig.enabled) return { skipped: 'disabled' };
  const settings = getGuildSettings(guild.id);
  if (settings.dryRun) {
    await logEvent(client, guild.id, 'leave', 'dry_run', `Dry run: leave message for @${member.user.username} was not sent.`, {
      userId: member.id,
    });
    return { skipped: 'dry_run' };
  }
  const channel = leaveConfig.channelId ? guild.channels.cache.get(leaveConfig.channelId) : null;
  if (!channel || !(channel.isSendable?.() ?? channel.isTextBased())) {
    await logEvent(client, guild.id, 'leave', 'channel_missing', 'Leave channel is missing or unavailable.', { notify: false });
    return { skipped: 'channel_missing' };
  }
  const stats = getStatistics(guild.id);
  const prepared = await prepareMessage({
    kind: 'leave',
    guild,
    member: {
      id: member.id,
      username: member.user.username,
      displayName: member.displayName || member.user.username,
      avatarURL: member.displayAvatarURL?.({ extension: 'png', size: 512 }) || DEFAULT_AVATAR,
      isBot: Boolean(member.user.bot),
      createdAt: member.user.createdTimestamp,
      joinedAt: history?.joinedAt || member.joinedTimestamp || Date.now(),
    },
    leaveConfig,
    memberNumber: history?.memberNumber || 1,
    stats,
    generateImage: true,
  });
  const result = await sendToChannel(channel, prepared.model, prepared.files, client, guild.id, settings);
  if (result.ok) {
    await logEvent(client, guild.id, 'leave', 'sent', `Leave message posted for @${member.user.username} in <#${channel.id}>.`, {
      userId: member.id,
      meta: { channelId: channel.id },
    });
  }
  return result;
}

export async function deliverTest(client, guild, actorMember, kind = 'welcome') {
  const stats = getStatistics(guild.id);
  const member = {
    id: actorMember.id,
    username: actorMember.user.username,
    displayName: actorMember.displayName,
    avatarURL: actorMember.displayAvatarURL?.({ extension: 'png', size: 512 }) || DEFAULT_AVATAR,
    isBot: Boolean(actorMember.user.bot),
    createdAt: actorMember.user.createdTimestamp,
    joinedAt: actorMember.joinedTimestamp || Date.now(),
  };
  if (kind === 'leave') {
    return deliverLeaveTest(client, guild, member, stats);
  }
  return deliverWelcome(client, actorMember, {
    invite: null,
    memberNumber: stats.totalJoins + 1,
    returning: false,
    test: true,
  });
}

async function deliverLeaveTest(client, guild, member, stats) {
  const leaveConfig = getLeaveConfig(guild.id);
  const channel = leaveConfig.channelId ? guild.channels.cache.get(leaveConfig.channelId) : null;
  if (!leaveConfig.enabled || !channel) return { skipped: 'disabled' };
  const prepared = await prepareMessage({
    kind: 'leave',
    guild,
    member,
    leaveConfig,
    memberNumber: 512,
    stats,
    generateImage: true,
  });
  const result = await sendToChannel(channel, prepared.model, prepared.files, client, guild.id, getGuildSettings(guild.id), true);
  return result;
}

export function buildPreviewPayload(result, { ephemeral = true } = {}) {
  return buildMessagePayload(result.model, { files: result.files, ephemeral });
}

export async function deliverDmTest(client, guild, discordUser) {
  const welcomeConfig = getWelcomeConfig(guild.id);
  const settings = getGuildSettings(guild.id);
  const stats = getStatistics(guild.id);
  const member = {
    id: discordUser.id,
    username: discordUser.username,
    displayName: discordUser.globalName || discordUser.username,
    avatarURL: discordUser.displayAvatarURL?.({ extension: 'png', size: 512 }) || DEFAULT_AVATAR,
    isBot: Boolean(discordUser.bot),
    createdAt: discordUser.createdTimestamp,
    joinedAt: discordUser.createdTimestamp,
  };
  const prepared = await prepareMessage({
    kind: 'dm',
    guild,
    member,
    welcomeConfig,
    inviteCode: null,
    memberNumber: stats.totalJoins + 1,
    scope: 'dm',
    stats,
    generateImage: true,
  });
  try {
    const payload = buildMessagePayload(prepared.model, { files: prepared.files });
    await discordUser.send(payload);
    await logEvent(client, guild.id, 'dm', 'test_sent', `A welcome DM test was sent to @${discordUser.username}.`, {
      userId: discordUser.id,
    });
    return { ok: true, imageGenerated: Boolean(prepared.imageBuffer) };
  } catch (error) {
    await logEvent(client, guild.id, 'dm', 'test_failed', `Welcome DM test to @${discordUser.username} failed: ${error.message}`, {
      userId: discordUser.id,
      meta: { code: error.code },
    });
    return { ok: false, reason: error.message, dryRun: settings.dryRun };
  }
}
