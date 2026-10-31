import { REST, Routes } from 'discord.js';
import { config } from '../config.js';
import { commandData } from './commands/data.js';
import { createLogger } from '../logger.js';

const log = createLogger('commands');
let registered = false;

export async function registerCommands(client) {
  if (registered) return;
  const applicationId = client.application?.id || client.user?.id;
  if (!applicationId) throw new Error('Application ID is unavailable.');
  if (config.discord.guildId) {
    const guild = client.guilds.cache.get(config.discord.guildId);
    if (!guild) throw new Error(`DISCORD_GUILD_ID ${config.discord.guildId} is not available to the bot.`);
    await guild.commands.set(commandData);
    await client.application.commands.set([]).catch(() => {});
    log.info(`Registered ${commandData.length} guild commands in ${guild.name}`);
  } else {
    await client.application.commands.set(commandData);
    log.info(`Registered ${commandData.length} global commands`);
  }
  registered = true;
}

export async function deployCommandsWithRest() {
  if (!config.discord.token || !config.discord.clientId) {
    throw new Error('DISCORD_TOKEN and DISCORD_CLIENT_ID are required.');
  }
  const rest = new REST({ version: '10' }).setToken(config.discord.token);
  if (config.discord.guildId) {
    await rest.put(
      Routes.applicationGuildCommands(config.discord.clientId, config.discord.guildId),
      { body: commandData },
    );
    log.info(`Deployed ${commandData.length} guild commands via REST`);
  } else {
    await rest.put(Routes.applicationCommands(config.discord.clientId), { body: commandData });
    log.info(`Deployed ${commandData.length} global commands via REST`);
  }
}
