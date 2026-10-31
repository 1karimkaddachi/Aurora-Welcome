import { Events } from 'discord.js';
import { config } from '../config.js';
import { createLogger } from '../logger.js';
import { getClient } from './client.js';
import { attachGuildLifecycle } from './events/guildLifecycle.js';
import { attachGuildMemberAdd } from './events/guildMemberAdd.js';
import { attachGuildMemberRemove } from './events/guildMemberRemove.js';
import { attachInteractionCreate } from './events/interactionCreate.js';
import { attachInviteEvents } from './events/invites.js';
import { attachReady } from './events/ready.js';

const log = createLogger('bot');

let started = false;

export async function startBot() {
  if (!config.discord.token) {
    log.warn('DISCORD_TOKEN is not set — the dashboard is running in bot-offline mode.');
    return null;
  }
  if (started) return getClient();
  started = true;
  const client = getClient();
  attachReady(client);
  attachGuildLifecycle(client);
  attachInviteEvents(client);
  attachGuildMemberAdd(client);
  attachGuildMemberRemove(client);
  attachInteractionCreate(client);

  client.on(Events.Error, (error) => log.error('Discord client error', { error: error.message }));
  client.on(Events.Warn, (message) => log.warn(`Discord warning: ${message}`));
  client.on('shardError', (error) => log.error('Gateway shard error', { error: error.message }));

  await client.login(config.discord.token);
  return client;
}

export { getClient };
