import { Events } from 'discord.js';
import { ensureGuild, markGuildBotMissing } from '../../db/repositories.js';
import { initGuildInvites } from '../../invites/tracker.js';
import { createLogger } from '../../logger.js';
import { logEvent } from '../audit.js';

const log = createLogger('guilds');

export function attachGuildLifecycle(client) {
  client.on(Events.GuildCreate, async (guild) => {
    try {
      ensureGuild({
        guildId: guild.id,
        name: guild.name,
        icon: guild.iconURL({ extension: 'png', size: 256 }),
        ownerId: guild.ownerId,
        memberCount: guild.memberCount,
      });
      await initGuildInvites(guild);
      await logEvent(client, guild.id, 'system', 'guild_joined', `Aurora was added to **${guild.name}**.`);
      log.info(`Joined guild ${guild.name}`, { guildId: guild.id });
    } catch (error) {
      log.error('Guild create handling failed', { guildId: guild.id, error: error.message });
    }
  });

  client.on(Events.GuildDelete, async (guild) => {
    try {
      markGuildBotMissing(guild.id);
      await logEvent(client, guild.id, 'system', 'guild_left', `Aurora was removed from **${guild.name}**.`, { notify: false });
      log.info(`Left guild ${guild.name}`, { guildId: guild.id });
    } catch (error) {
      log.error('Guild delete handling failed', { guildId: guild.id, error: error.message });
    }
  });

  client.on(Events.GuildUpdate, (oldGuild, newGuild) => {
    try {
      ensureGuild({
        guildId: newGuild.id,
        name: newGuild.name,
        icon: newGuild.iconURL({ extension: 'png', size: 256 }),
        ownerId: newGuild.ownerId,
        memberCount: newGuild.memberCount,
      });
    } catch (error) {
      log.warn('Guild update sync failed', { guildId: newGuild.id, error: error.message });
    }
  });
}
