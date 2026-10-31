export const PLACEHOLDERS = [
  { token: '{user}', label: 'User mention', example: '@Nova' },
  { token: '{username}', label: 'Username', example: 'Nova' },
  { token: '{user_id}', label: 'User ID', example: '123456789012345678' },
  { token: '{server}', label: 'Server name', example: 'Aurora Community' },
  { token: '{server_name}', label: 'Server name (alias)', example: 'Aurora Community' },
  { token: '{server_id}', label: 'Server ID', example: '987654321098765432' },
  { token: '{member_count}', label: 'Member count', example: '12,480' },
  { token: '{created_at}', label: 'Account created', example: '14 Mar 2024' },
  { token: '{joined_at}', label: 'Server joined', example: '31 Oct 2026' },
  { token: '{avatar}', label: 'Avatar URL', example: 'https://cdn.discordapp.com/...' },
  { token: '{server_icon}', label: 'Server icon URL', example: 'https://cdn.discordapp.com/...' },
  { token: '{inviter}', label: 'Inviter name', example: 'Kai' },
  { token: '{invite_code}', label: 'Invite code', example: 'aurora' },
  { token: '{rules_channel}', label: 'Rules channel mention', example: '#rules' },
  { token: '{welcome_channel}', label: 'Welcome channel mention', example: '#welcome' },
  { token: '{intros_channel}', label: 'Introductions channel mention', example: '#introductions' },
  { token: '{announcements_channel}', label: 'Announcements channel mention', example: '#announcements' },
  { token: '{member_number}', label: 'Member number', example: '1,024' },
];

const PLACEHOLDER_PATTERN = /\{([a-z_]+)\}/g;

function formatDate(timestamp) {
  if (!timestamp) return 'Unknown';
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(timestamp));
}

function formatNumber(value) {
  return new Intl.NumberFormat('en-US').format(Number(value) || 0);
}

function channelMention(id, fallback) {
  return id ? `<#${id}>` : fallback;
}

/**
 * Resolves every supported placeholder inside a string.
 * Unknown or missing values degrade to readable fallbacks instead of throwing.
 */
export function resolvePlaceholders(template, context = {}) {
  if (typeof template !== 'string' || template.length === 0) return '';
  const guild = context.guild || {};
  const member = context.member || {};
  const inviter = context.inviter || null;
  const channels = context.channels || {};

  const map = {
    user: member.id ? `<@${member.id}>` : member.displayName || member.username || 'there',
    username: member.username || member.displayName || 'New member',
    user_id: member.id || 'Unknown',
    server: guild.name || 'this server',
    server_name: guild.name || 'this server',
    server_id: guild.id || 'Unknown',
    member_count: formatNumber(guild.memberCount),
    created_at: formatDate(member.createdAt),
    joined_at: formatDate(member.joinedAt ?? context.joinedAt ?? Date.now()),
    avatar:
      member.avatarURL ||
      'https://cdn.discordapp.com/embed/avatars/0.png',
    server_icon:
      guild.iconURL ||
      'https://cdn.discordapp.com/embed/avatars/0.png',
    inviter: inviter?.name || inviter?.username || 'an unknown invite',
    invite_code: context.inviteCode || 'Unknown',
    rules_channel: channelMention(channels.rules, 'the rules channel'),
    welcome_channel: channelMention(channels.main, 'the welcome channel'),
    intros_channel: channelMention(channels.introductions, 'the introductions channel'),
    announcements_channel: channelMention(channels.announcements, 'the announcements channel'),
    member_number: formatNumber(context.memberNumber),
  };

  return template.replace(PLACEHOLDER_PATTERN, (match, key) => {
    const value = map[key];
    return value === undefined || value === null || value === '' ? match : String(value);
  });
}

export function hasUnresolvedPlaceholders(text) {
  return typeof text === 'string' && /\{[a-z_]+\}/.test(text);
}
