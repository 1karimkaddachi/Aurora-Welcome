import { Events } from 'discord.js';
import { ensureGuild, listGuilds, markGuildBotMissing, setGuildMemberCount } from '../../db/repositories.js';
import { createLogger } from '../../logger.js';
import { initAllInvites } from '../../invites/tracker.js';
import { registerCommands } from '../deploy.js';

const log = createLogger('ready');
let lastReady = 0;

export async function onReady(client) {
  if (Date.now() - lastReady < 5000) return;
  lastReady = Date.now();
  log.info(`Logged in as ${client.user.tag}`, { guilds: client.guilds.cache.size });

  const present = new Set();
  for (const guild of client.guilds.cache.values()) {
    present.add(guild.id);
    try {
      ensureGuild({
        guildId: guild.id,
        name: guild.name,
        icon: guild.iconURL({ extension: 'png', size: 256 }),
        ownerId: guild.ownerId,
        memberCount: guild.memberCount,
      });
      setGuildMemberCount(guild.id, guild.memberCount);
    } catch (error) {
      log.error(`Could not initialize guild ${guild.id}`, { error: error.message });
    }
  }
  for (const guild of listGuilds()) {
    if (!present.has(guild.guildId)) markGuildBotMissing(guild.guildId);
  }

  await initAllInvites(client);
  try {
    await registerCommands(client);
  } catch (error) {
    log.error('Slash command registration failed', { error: error.message });
  }
  log.info('Bot runtime ready');
}

export function attachReady(client) {
  client.on(Events.ClientReady, (readyClient) => {
    onReady(readyClient).catch((error) => log.error('Ready handler failed', { error: error.message }));
  });
}
