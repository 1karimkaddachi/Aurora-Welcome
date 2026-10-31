import { Client, GatewayIntentBits } from 'discord.js';

let client = null;

export function getClient() {
  if (!client) {
    client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildInvites,
      ],
      allowedMentions: { parse: [] },
    });
  }
  return client;
}

export function setClient(instance) {
  client = instance;
}
