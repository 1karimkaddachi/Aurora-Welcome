import { resolvePlaceholders } from '../shared/placeholders.js';
import { WELCOME_STYLES } from '../shared/defaults.js';

const numberFormat = new Intl.NumberFormat('en-US');

function formatTimestamp(timestamp) {
  return new Intl.DateTimeFormat('en-GB', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'UTC',
  }).format(new Date(timestamp));
}

function variantFor(content, context) {
  const isBot = Boolean(context.member?.isBot ?? context.isBot);
  if (isBot && content.variants?.bot) return content.variants.bot;
  if (context.returning && content.variants?.returning) return content.variants.returning;
  return null;
}

function resolveContent(content, context) {
  const variant = variantFor(content, context);
  const title = resolvePlaceholders(variant?.title ?? content.title ?? '', context);
  const description = resolvePlaceholders(variant?.description ?? content.description ?? '', context);
  const footer = resolvePlaceholders(content.footer ?? '', context);
  const emoji = variant?.emoji ?? content.emoji ?? '';
  return { title: title.trim(), description: description.trim(), footer: footer.trim(), emoji: emoji.trim() };
}

function detailsLine(content, context) {
  const parts = [];
  if (content.elements.memberCount) {
    parts.push(`**${numberFormat.format(context.guild.memberCount || 0)}** members`);
  }
  if (content.elements.inviter) {
    parts.push(context.inviter?.name ? `invited by **${context.inviter.name}**` : 'inviter unknown');
  }
  return parts.join(' • ');
}

function statsLine(content, context) {
  if (!content.elements.stats || !context.stats) return '';
  const parts = [];
  if (Number.isFinite(context.stats.todayJoins)) parts.push(`today **+${numberFormat.format(context.stats.todayJoins)}**`);
  if (Number.isFinite(context.stats.weekJoins)) parts.push(`7 days **+${numberFormat.format(context.stats.weekJoins)}**`);
  if (Number.isFinite(context.stats.totalJoins)) parts.push(`all time **${numberFormat.format(context.stats.totalJoins)}**`);
  return parts.length ? `-# ${parts.join(' · ')}` : '';
}

function withEmoji(emoji, text) {
  return emoji ? `${emoji} ${text}` : text;
}

function styleMeta(style) {
  return WELCOME_STYLES.find((item) => item.id === style) || WELCOME_STYLES[0];
}

function galleryBlock(context) {
  if (!context.imageAttachment) return null;
  return {
    type: 'gallery',
    items: [{ url: `attachment://${context.imageAttachment}`, description: `${context.guild.name} welcome banner` }],
  };
}

function buttonModels(buttons, context) {
  return buttons
    .filter((button) => button.enabled !== false)
    .slice(0, 25)
    .map((button) => {
      const base = {
        label: button.label,
        emoji: button.emoji || null,
        style: Number(button.style) || 2,
        type: button.type,
      };
      if (button.type === 'url') return { ...base, style: 5, url: button.url };
      if (button.type === 'dashboard') return { ...base, style: 5, url: `${context.dashboardUrl}/servers/${context.guild.id}/overview` };
      return { ...base, url: null, customId: `wb:${button.type}:${context.guild.id}` };
    });
}

export function buildMessageModel({
  kind = 'welcome',
  style = 'classic',
  content,
  guild,
  member,
  inviter = null,
  inviteCode = null,
  memberNumber = 1,
  returning = false,
  channels = {},
  stats = null,
  buttons = [],
  imageAttachment = null,
  dashboardUrl = 'http://localhost:3000',
  timestamp = Date.now(),
}) {
  const context = {
    guild: {
      id: guild.id,
      name: guild.name || 'this server',
      iconURL: guild.iconURL || null,
      memberCount: guild.memberCount || 0,
    },
    member: {
      id: member.id,
      username: member.username || 'New member',
      displayName: member.displayName || member.username || 'New member',
      avatarURL: member.avatarURL || null,
      isBot: Boolean(member.isBot),
      createdAt: member.createdAt || null,
      joinedAt: member.joinedAt || timestamp,
    },
    inviter,
    inviteCode,
    memberNumber,
    returning,
    channels,
    stats,
    dashboardUrl,
    imageAttachment,
    timestamp,
  };

  const resolved = resolveContent(content, context);
  const meta = styleMeta(style);
  const accentColor = content.color || meta.accent;
  const details = detailsLine(content, context);
  const statsText = statsLine(content, context);
  const timestampText = content.elements.timestamp ? formatTimestamp(timestamp) : '';
  const footerText = content.elements.footer && resolved.footer ? `-# ${resolved.footer}` : '';
  const mentionBlock = content.mention && kind !== 'leave' && member.id ? { type: 'text', content: `<@${member.id}>` } : null;

  const blocks = [];
  const push = (block) => {
    if (block) blocks.push(block);
  };
  const heading = (level, text) => `${'#'.repeat(level)} ${text}`;
  const titleText = (level) => (content.elements.title && resolved.title ? heading(level, withEmoji(resolved.emoji, resolved.title)) : '');
  const descriptionText = content.elements.description ? resolved.description : '';
  const section = (texts, accessory) => {
    const cleaned = texts.filter(Boolean);
    if (!cleaned.length && !accessory) return null;
    return { type: 'section', texts: cleaned, accessory: accessory || null };
  };
  const avatarAccessory =
    content.elements.avatar && context.member.avatarURL
      ? { type: 'thumbnail', url: context.member.avatarURL, description: `${context.member.username}'s avatar` }
      : null;
  const serverAccessory =
    content.elements.serverIcon && context.guild.iconURL
      ? { type: 'thumbnail', url: context.guild.iconURL, description: `${context.guild.name} icon` }
      : null;

  switch (style) {
    case 'modern': {
      push(mentionBlock);
      push({ type: 'text', content: titleText(1) });
      push({ type: 'text', content: descriptionText });
      push({ type: 'separator', divider: true, spacing: 1 });
      push(
        section(
          [details ? `-# ${details}` : '', statsText],
          serverAccessory,
        ),
      );
      push(galleryBlock(context));
      push(footerText ? { type: 'text', content: footerText } : null);
      push(timestampText ? { type: 'text', content: `-# ${timestampText}` } : null);
      break;
    }
    case 'premium': {
      push(mentionBlock);
      push({ type: 'text', content: titleText(2) });
      push(section([descriptionText, details ? `-# ${details}` : ''], avatarAccessory));
      push({ type: 'separator', divider: false, spacing: 2 });
      if (statsText) push({ type: 'text', content: statsText });
      push(galleryBlock(context));
      if (footerText || timestampText) {
        push({ type: 'separator', divider: true, spacing: 1 });
        push({ type: 'text', content: [footerText, timestampText ? `-# ${timestampText}` : ''].filter(Boolean).join('\n') });
      }
      break;
    }
    case 'minimal': {
      push(mentionBlock);
      push({ type: 'text', content: titleText(3) });
      push({ type: 'text', content: descriptionText ? descriptionText : details });
      if (descriptionText && details) push({ type: 'text', content: `-# ${details}` });
      push(galleryBlock(context));
      push(footerText ? { type: 'text', content: footerText } : null);
      break;
    }
    case 'gaming': {
      push(mentionBlock);
      const gamingTitle = content.elements.title && resolved.title
        ? heading(2, withEmoji(resolved.emoji, resolved.title.toUpperCase()))
        : '';
      push({ type: 'text', content: gamingTitle });
      push(galleryBlock(context));
      push({ type: 'separator', divider: true, spacing: 2 });
      push({ type: 'text', content: descriptionText });
      if (details) push({ type: 'text', content: `**▸** ${details}` });
      if (statsText) push({ type: 'text', content: statsText });
      push(footerText ? { type: 'text', content: footerText } : null);
      break;
    }
    case 'community': {
      push(mentionBlock);
      push({ type: 'text', content: titleText(2) });
      if (descriptionText) {
        const quoted = descriptionText
          .split('\n')
          .map((line) => (line ? `> ${line}` : '>'))
          .join('\n');
        push({ type: 'text', content: quoted });
      }
      push(section([details ? `-# ${details}` : '', statsText], serverAccessory || avatarAccessory));
      push(galleryBlock(context));
      push(footerText ? { type: 'text', content: footerText } : null);
      break;
    }
    case 'professional': {
      push(mentionBlock);
      push({ type: 'text', content: titleText(3) });
      push({ type: 'separator', divider: true, spacing: 1 });
      push({ type: 'text', content: descriptionText });
      const profile = [
        '**MEMBER PROFILE**',
        `> **Member no.** #${numberFormat.format(memberNumber)}`,
        `> **User ID** ${context.member.id}`,
        context.inviter?.name ? `> **Referrer** ${context.inviter.name}` : '> **Referrer** Unknown',
        `> **Arrived** ${formatTimestamp(timestamp)}`,
      ].join('\n');
      if (content.elements.inviter || content.elements.memberCount) push({ type: 'text', content: profile });
      push(galleryBlock(context));
      if (statsText) push({ type: 'text', content: statsText });
      push(footerText ? { type: 'text', content: footerText } : null);
      break;
    }
    case 'custom': {
      push(mentionBlock);
      push(
        section(
          [
            serverAccessory ? `## ${context.guild.name}` : '',
            serverAccessory ? '-# Custom layout • Components V2' : '',
          ],
          serverAccessory,
        ),
      );
      if (content.elements.title || content.elements.description) {
        push(section([titleText(2), descriptionText], avatarAccessory));
      }
      if (details) push({ type: 'text', content: `-# ${details}` });
      push(statsText ? { type: 'text', content: statsText } : null);
      push(galleryBlock(context));
      push(footerText ? { type: 'text', content: footerText } : null);
      push(timestampText ? { type: 'text', content: `-# ${timestampText}` } : null);
      break;
    }
    case 'classic':
    default: {
      push(mentionBlock);
      push(section([titleText(2), descriptionText], avatarAccessory));
      push({ type: 'separator', divider: true, spacing: 1 });
      push(details ? { type: 'text', content: `-# ${details}` } : null);
      push(statsText ? { type: 'text', content: statsText } : null);
      push(galleryBlock(context));
      push(footerText ? { type: 'text', content: footerText } : null);
      push(timestampText ? { type: 'text', content: `-# ${timestampText}` } : null);
      break;
    }
  }

  const mappedButtons = kind === 'leave' ? [] : buttonModels(buttons, context);
  if (blocks.filter(Boolean).length === 0) {
    blocks.push({ type: 'text', content: resolved.title || `Welcome, ${context.member.displayName}!` });
  }

  return {
    kind,
    style,
    accentColor,
    accentInt: Number.parseInt(String(accentColor).replace('#', ''), 16) || 0x5865f2,
    guild: { id: context.guild.id, name: context.guild.name, iconURL: context.guild.iconURL, memberCount: context.guild.memberCount },
    member: {
      id: context.member.id,
      username: context.member.username,
      displayName: context.member.displayName,
      avatarURL: context.member.avatarURL,
      isBot: context.member.isBot,
    },
    inviter,
    inviteCode,
    memberNumber,
    returning,
    resolved,
    blocks: blocks.filter(Boolean),
    buttons: mappedButtons,
    attachments: imageAttachment ? [{ name: imageAttachment, url: `attachment://${imageAttachment}` }] : [],
    mentionUserId: content.mention && member.id ? member.id : null,
    timestamp,
  };
}
