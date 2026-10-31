import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aurora-invites-'));
process.env.DATA_DIR = dataDir;
process.env.LOG_LEVEL = 'error';

const repo = await import('../src/db/repositories.js');
const dbModule = await import('../src/db/index.js');
const { closeLogger } = await import('../src/logger.js');
const { attributeJoin, clearCache, initGuildInvites, removeCachedInvite, updateCachedInvite } = await import('../src/invites/tracker.js');

const GUILD = '910000000000000001';
const settings = { inviteTracking: true, vanityTracking: true };

function invite(code, uses, inviterId, inviterName) {
  return { code, uses, maxUses: 0, inviter: { id: inviterId, username: inviterName } };
}

after(async () => {
  dbModule.closeDb();
  await closeLogger();
  fs.rmSync(dataDir, { recursive: true, force: true });
});

repo.ensureGuild({ guildId: GUILD, name: 'Invite Guild' });

test('detects a normal invite usage increase', async () => {
  const map = new Map([['aurora', invite('aurora', 5, '900000000000000501', 'kai')]]);
  const guild = { id: GUILD, name: 'Invite Guild', invites: { fetch: async () => map } };
  await initGuildInvites(guild);
  map.set('aurora', invite('aurora', 6, '900000000000000501', 'kai'));
  const result = await attributeJoin(guild, settings);
  assert.equal(result.type, 'normal');
  assert.equal(result.code, 'aurora');
  assert.equal(result.inviterId, '900000000000000501');
  assert.equal(result.inviterName, 'kai');
  assert.equal(result.ambiguous, null);
});

test('flags ambiguous attribution when several invites advance', async () => {
  clearCache();
  const map = new Map([
    ['aurora', invite('aurora', 10, '900000000000000501', 'kai')],
    ['luna', invite('luna', 3, '900000000000000502', 'luna')],
  ]);
  const guild = { id: GUILD, name: 'Invite Guild', invites: { fetch: async () => map } };
  await initGuildInvites(guild);
  map.set('aurora', invite('aurora', 11, '900000000000000501', 'kai'));
  map.set('luna', invite('luna', 4, '900000000000000502', 'luna'));
  const result = await attributeJoin(guild, settings);
  assert.equal(result.type, 'normal');
  assert.ok(result.ambiguous);
  assert.equal(result.ambiguous.length, 2);
});

test('prefers the invite with the largest delta', async () => {
  clearCache();
  const map = new Map([
    ['aurora', invite('aurora', 10, '900000000000000501', 'kai')],
    ['bulk', invite('bulk', 3, '900000000000000503', 'bulk')],
  ]);
  const guild = { id: GUILD, name: 'Invite Guild', invites: { fetch: async () => map } };
  await initGuildInvites(guild);
  map.set('aurora', invite('aurora', 11, '900000000000000501', 'kai'));
  map.set('bulk', invite('bulk', 15, '900000000000000503', 'bulk'));
  const result = await attributeJoin(guild, settings);
  assert.equal(result.code, 'bulk');
  assert.equal(result.inviterName, 'bulk');
});

test('falls back to vanity when no invite advanced', async () => {
  clearCache();
  const map = new Map([['aurora', invite('aurora', 10, '900000000000000501', 'kai')]]);
  const guild = { id: GUILD, name: 'Invite Guild', vanityURLCode: 'aurora-vanity', invites: { fetch: async () => map } };
  await initGuildInvites(guild);
  const result = await attributeJoin(guild, settings);
  assert.equal(result.type, 'vanity');
  assert.equal(result.code, 'aurora-vanity');
});

test('returns unknown when attribution cannot be resolved', async () => {
  clearCache();
  const map = new Map([['aurora', invite('aurora', 10, '900000000000000501', 'kai')]]);
  const guild = { id: GUILD, name: 'Invite Guild', invites: { fetch: async () => map } };
  await initGuildInvites(guild);
  const result = await attributeJoin(guild, { inviteTracking: true, vanityTracking: false });
  assert.equal(result.type, 'unknown');
  assert.equal(result.code, null);
});

test('survives invite fetch failures', async () => {
  clearCache();
  const guild = {
    id: GUILD,
    name: 'Invite Guild',
    invites: { fetch: async () => { throw new Error('Missing Access'); } },
  };
  const result = await attributeJoin(guild, settings);
  assert.equal(result.type, 'unknown');
  assert.equal(result.reason, 'fetch_failed');
});

test('respects a disabled tracking setting', async () => {
  const result = await attributeJoin({ id: GUILD, name: 'Invite Guild' }, { inviteTracking: false });
  assert.equal(result.type, 'disabled');
});

test('invite create and delete events keep cache and storage aligned', async () => {
  clearCache();
  const map = new Map();
  const guild = { id: GUILD, name: 'Invite Guild', invites: { fetch: async () => map } };
  await initGuildInvites(guild);
  const created = invite('new-code', 0, '900000000000000504', 'new');
  updateCachedInvite({ ...created, guild });
  map.set('new-code', created);
  assert.ok(repo.getStoredInvites(GUILD).some((entry) => entry.code === 'new-code'));
  removeCachedInvite({ code: 'new-code', guild });
  assert.ok(!repo.getStoredInvites(GUILD).some((entry) => entry.code === 'new-code'));
});
