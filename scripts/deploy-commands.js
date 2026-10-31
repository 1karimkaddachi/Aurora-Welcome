import { config } from '../src/config.js';
import { deployCommandsWithRest } from '../src/bot/deploy.js';

if (!config.discord.token || !config.discord.clientId) {
  console.error('Set DISCORD_TOKEN and DISCORD_CLIENT_ID in .env before deploying commands.');
  process.exit(1);
}

deployCommandsWithRest()
  .then(() => {
    console.log('Slash commands deployed.');
    process.exit(0);
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
