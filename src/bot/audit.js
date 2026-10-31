import { ContainerBuilder, MessageFlags, TextDisplayBuilder } from 'discord.js';
import { addLog, getGuildSettings } from '../db/repositories.js';
import { createLogger } from '../logger.js';

const log = createLogger('audit');

const ACCENTS = {
  member: 0x22d3ee,
  welcome: 0x5865f2,
  leave: 0xf43f5e,
  dm: 0xa855f7,
  autorole: 0x34d399,
  invite: 0xf0b429,
  image: 0xfb7185,
  config: 0x94a3b8,
  system: 0x64748b,
};

/**
 * Persists an audit entry and mirrors it to the configured log channel using
 * Components V2 only.
 */
export async function logEvent(client, guildId, category, action, message, { userId = null, meta = null, notify = true } = {}) {
  let logId = null;
  try {
    logId = addLog(guildId, category, action, message, userId, meta);
  } catch (error) {
    log.warn('Could not persist audit log', { error: error.message });
  }
  if (!notify || !client?.isReady()) return logId;
  try {
    const settings = getGuildSettings(guildId);
    if (!settings.logChannelId) return logId;
    const guild = client.guilds.cache.get(guildId);
    const channel = guild?.channels.cache.get(settings.logChannelId);
    if (!channel?.isTextBased()) return logId;
    const container = new ContainerBuilder().setAccentColor(ACCENTS[category] || ACCENTS.system);
    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        `**${labelFor(category)} · ${action.replace(/_/g, ' ')}**\n${message}${userId ? `\n-# User: <@${userId}>` : ''}\n-# <t:${Math.floor(Date.now() / 1000)}:F>`,
      ),
    );
    await channel.send({
      components: [container],
      flags: MessageFlags.IsComponentsV2,
      allowedMentions: { parse: [] },
    });
  } catch (error) {
    log.warn('Could not mirror audit log to Discord', { guildId, error: error.message });
  }
  return logId;
}

function labelFor(category) {
  const labels = {
    member: 'Member',
    welcome: 'Welcome',
    leave: 'Leave',
    dm: 'Direct message',
    autorole: 'Auto role',
    invite: 'Invites',
    image: 'Image',
    config: 'Configuration',
    system: 'System',
  };
  return labels[category] || 'System';
}
