import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aurora-delivery-'));
process.env.DATA_DIR = dataDir;
process.env.LOG_LEVEL = 'error';

const repo = await import('../src/db/repositories.js');
const dbModule = await import('../src/db/index.js');
const { closeLogger } = await import('../src/logger.js');
const { deliverLeave, deliverWelcome } = await import('../src/welcome/service.js');

const GUILD_ID = '920000000000000001';
const CHANNEL_ID = '920000000000000010';
const LEAVE_CHANNEL_ID = '920000000000000011';

after(async () => {
  dbModule.closeDb();
  await closeLogger();
  fs.rmSync(dataDir, { recursive: true, force: true });
});

repo.ensureGuild({ guildId: GUILD_ID, name: 'Delivery Guild', memberCount: 42 });

function setWelcome(patch) {
  const config = repo.getWelcomeConfig(GUILD_ID);
  Object.assign(config, patch);
  config.image.enabled = false;
  config.content.elements.image = false;
  repo.saveWelcomeConfig(GUILD_ID, config);
  return config;
}

function setSettings(patch = {}) {
  const settings = repo.getGuildSettings(GUILD_ID);
  repo.saveGuildSettings(GUILD_ID, { ...settings, ...patch });
}

const sent = [];
const dms = [];
function makeChannel(store, id) {
  return {
    id,
    guild: null,
    isSendable: () => true,
    permissionsFor: () => ({ has: () => true }),
    send: async (payload) => {
      store.push(payload);
      return { id: `msg-${store.length}`, delete: async () => {} };
    },
  };
}
const channel = makeChannel(sent, CHANNEL_ID);
const leaveChannel = makeChannel(sent, LEAVE_CHANNEL_ID);

const guild = {
  id: GUILD_ID,
  name: 'Delivery Guild',
  iconURL: () => 'https://cdn.discordapp.com/embed/avatars/2.png',
  memberCount: 42,
  channels: { cache: new Map([[CHANNEL_ID, channel], [LEAVE_CHANNEL_ID, leaveChannel]]) },
  members: { me: { id: '1' } },
};
channel.guild = guild;
leaveChannel.guild = guild;

const client = { isReady: () => false };

function makeMember({ bot = false } = {}) {
  return {
    id: '920000000000000100',
    guild,
    displayName: 'Nova',
    displayAvatarURL: () => 'https://cdn.discordapp.com/embed/avatars/0.png',
    joinedTimestamp: Date.now(),
    user: { id: '920000000000000100', username: 'Nova', bot, createdTimestamp: Date.now() - 86400000 },
    send: async (payload) => {
      dms.push(payload);
      return { id: 'dm' };
    },
  };
}

test('public welcome sends a Components V2 container', async () => {
  setWelcome({
    enabled: true,
    sendMode: 'public',
    botMode: 'enabled',
    returningMode: 'returning',
    channels: { main: CHANNEL_ID, secondary: null, rules: null, introductions: null, announcements: null },
    content: { ...repo.getWelcomeConfig(GUILD_ID).content, title: 'Hello {username}', mention: true },
  });
  setSettings({ dryRun: false, welcomeDelayMs: 0, deleteWelcomeAfter: 0 });
  sent.length = 0;
  const result = await deliverWelcome(client, makeMember(), { memberNumber: 7, returning: false });
  assert.equal(result.channels.length, 1);
  assert.equal(result.channels[0].ok, true);
  assert.equal(sent.length, 1);
  const payload = sent[0];
  assert.equal(payload.flags, 32768);
  assert.ok(payload.components[0].toJSON());
  assert.deepEqual(payload.allowedMentions.users, ['920000000000000100']);
  const json = JSON.stringify(payload.components[0].toJSON());
  assert.ok(json.includes('Hello Nova'));
});

test('DM delivery and bot/returning skip rules', async () => {
  setWelcome({
    enabled: true,
    sendMode: 'both',
    botMode: 'enabled',
    returningMode: 'returning',
    channels: { main: CHANNEL_ID, secondary: null, rules: null, introductions: null, announcements: null },
  });
  sent.length = 0;
  dms.length = 0;
  const result = await deliverWelcome(client, makeMember(), { memberNumber: 8, returning: false });
  assert.equal(result.dm.ok, true);
  assert.equal(sent.length, 1);
  assert.equal(dms.length, 1);
  assert.equal(dms[0].flags, 32768);

  setWelcome({ botMode: 'skip' });
  sent.length = 0;
  const bot = await deliverWelcome(client, makeMember({ bot: true }), { memberNumber: 9, returning: false });
  assert.equal(bot.skipped, 'bot_skip');
  assert.equal(sent.length, 0);

  setWelcome({ returningMode: 'skip' });
  sent.length = 0;
  const returning = await deliverWelcome(client, makeMember(), { memberNumber: 10, returning: true });
  assert.equal(returning.skipped, 'returning_skip');
  assert.equal(sent.length, 0);
});

test('dry run never sends', async () => {
  setWelcome({ botMode: 'enabled', returningMode: 'returning', sendMode: 'both' });
  setSettings({ dryRun: true });
  sent.length = 0;
  dms.length = 0;
  const result = await deliverWelcome(client, makeMember(), { memberNumber: 11, returning: false });
  assert.equal(result.skipped, 'dry_run');
  assert.equal(sent.length, 0);
  assert.equal(dms.length, 0);
  setSettings({ dryRun: false });
});

test('leave delivery posts a leave message when enabled', async () => {
  const leave = repo.getLeaveConfig(GUILD_ID);
  leave.enabled = true;
  leave.channelId = LEAVE_CHANNEL_ID;
  leave.image.enabled = false;
  leave.content.elements.image = false;
  leave.content.title = 'Goodbye {username}';
  repo.saveLeaveConfig(GUILD_ID, leave);
  sent.length = 0;
  const result = await deliverLeave(client, makeMember(), { joinedAt: Date.now() - 86400000, memberNumber: 3 });
  assert.equal(result.ok, true);
  assert.equal(sent.length, 1);
  assert.equal(sent[0].flags, 32768);
  assert.ok(JSON.stringify(sent[0].components[0].toJSON()).includes('Goodbye Nova'));
});

test('private delivery fails gracefully for unknown channels', async () => {
  setWelcome({
    enabled: true,
    sendMode: 'public',
    channels: { main: '920000000000000099', secondary: null, rules: null, introductions: null, announcements: null },
  });
  sent.length = 0;
  const result = await deliverWelcome(client, makeMember(), { memberNumber: 12, returning: false });
  assert.equal(result.channels.length, 0);
  assert.equal(sent.length, 0);
});
