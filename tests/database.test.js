import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aurora-db-'));
process.env.DATA_DIR = dataDir;
process.env.LOG_LEVEL = 'error';
process.env.SESSION_SECRET = 'test-secret';

const repo = await import('../src/db/repositories.js');
const dbModule = await import('../src/db/index.js');
const { closeLogger } = await import('../src/logger.js');
const { buildPreview } = await import('../src/welcome/service.js');

const GUILD = '900000000000000001';
const USER = '900000000000000101';

after(async () => {
  dbModule.closeDb();
  await closeLogger();
  fs.rmSync(dataDir, { recursive: true, force: true });
});

test('guild provisioning creates independent defaults', () => {
  repo.ensureGuild({ guildId: GUILD, name: 'Test Guild', memberCount: 42 });
  const welcome = repo.getWelcomeConfig(GUILD);
  const leave = repo.getLeaveConfig(GUILD);
  const settings = repo.getGuildSettings(GUILD);
  assert.equal(welcome.style, 'classic');
  assert.equal(welcome.enabled, true);
  assert.equal(leave.enabled, true);
  assert.equal(settings.inviteTracking, true);
});

test('welcome configuration persists and stays isolated', () => {
  const config = repo.getWelcomeConfig(GUILD);
  config.style = 'premium';
  config.content.title = 'Custom {username}';
  config.channels.main = '900000000000000201';
  const saved = repo.saveWelcomeConfig(GUILD, config);
  assert.equal(saved.style, 'premium');
  assert.equal(repo.getWelcomeConfig(GUILD).content.title, 'Custom {username}');
  repo.ensureGuild({ guildId: '900000000000000002', name: 'Other Guild' });
  assert.equal(repo.getWelcomeConfig('900000000000000002').style, 'classic');
  assert.notEqual(repo.getWelcomeConfig('900000000000000002').content.title, 'Custom {username}');
});

test('leave and advanced settings round-trip', () => {
  const leave = repo.getLeaveConfig(GUILD);
  leave.channelId = '900000000000000201';
  leave.style = 'community';
  repo.saveLeaveConfig(GUILD, leave);
  assert.equal(repo.getLeaveConfig(GUILD).channelId, '900000000000000201');
  const settings = repo.getGuildSettings(GUILD);
  settings.abuseThreshold = 9;
  settings.dryRun = true;
  repo.saveGuildSettings(GUILD, settings);
  const stored = repo.getGuildSettings(GUILD);
  assert.equal(stored.abuseThreshold, 9);
  assert.equal(stored.dryRun, true);
});

test('buttons can be created, reordered, updated and deleted', () => {
  const first = repo.createButton(GUILD, { label: 'Rules', type: 'rules', scope: 'welcome' });
  const second = repo.createButton(GUILD, { label: 'Site', type: 'url', url: 'https://example.com', scope: 'welcome' });
  assert.equal(repo.listButtons(GUILD, 'welcome').length, 2);
  const reordered = repo.reorderButtons(GUILD, 'welcome', [second.id, first.id]);
  assert.equal(reordered[0].id, second.id);
  const updated = repo.updateButton(GUILD, second.id, { enabled: false });
  assert.equal(updated.enabled, false);
  assert.equal(repo.deleteButton(GUILD, first.id), true);
  assert.equal(repo.listButtons(GUILD, 'welcome').length, 1);
});

test('auto roles and self roles round-trip', () => {
  const auto = repo.createAutoRole(GUILD, { roleId: '900000000000000301', target: 'human', delaySeconds: 3 });
  assert.equal(repo.listAutoRoles(GUILD).length, 1);
  assert.equal(repo.updateAutoRole(GUILD, auto.id, { enabled: false }).enabled, false);
  assert.equal(repo.deleteAutoRole(GUILD, auto.id), true);

  const self = repo.createSelfRole(GUILD, { roleId: '900000000000000302', label: 'Gamer', emoji: '🎮' });
  assert.equal(repo.listSelfRoles(GUILD)[0].label, 'Gamer');
  assert.equal(repo.deleteSelfRole(GUILD, self.id), true);
});

test('member history computes numbers, returns and statistics', () => {
  const first = repo.addMemberJoin({
    guildId: GUILD,
    userId: USER,
    username: 'Nova',
    isBot: false,
    joinedAt: Date.now() - 1000,
  });
  assert.equal(first.memberNumber, 1);
  assert.equal(first.returning, false);
  const returning = repo.addMemberJoin({
    guildId: GUILD,
    userId: USER,
    username: 'Nova',
    isBot: false,
    joinedAt: Date.now(),
  });
  assert.equal(returning.memberNumber, 1);
  assert.equal(returning.returning, true);
  const other = repo.addMemberJoin({
    guildId: GUILD,
    userId: '900000000000000102',
    username: 'Second',
    isBot: false,
    joinedAt: Date.now(),
  });
  assert.equal(other.memberNumber, 2);
  repo.recordJoinStat(GUILD, { isBot: false, totalMembers: 12480 });
  repo.recordJoinStat(GUILD, { isBot: false, totalMembers: 12481 });
  repo.recordLeaveStat(GUILD, { isBot: false, totalMembers: 12479 });
  const stats = repo.getStatistics(GUILD);
  assert.equal(stats.totalJoins, 3);
  assert.equal(stats.uniqueMembers, 2);
  assert.equal(stats.daily.at(-1).joins, 2);
  assert.equal(stats.daily.at(-1).leaves, 1);
  assert.equal(stats.daily.at(-1).totalMembers, 12479);
  const left = repo.markMemberLeft(GUILD, USER);
  assert.ok(left.leftAt > 0);
});

test('invite history and leaderboards work', () => {
  repo.upsertInvite(GUILD, { code: 'aurora', inviterId: '900000000000000401', inviterName: 'Kai', uses: 5 });
  repo.recordInviteUse({
    guildId: GUILD,
    code: 'aurora',
    inviterId: '900000000000000401',
    inviterName: 'Kai',
    userId: USER,
    username: 'Nova',
    joinedAt: Date.now(),
  });
  repo.recordInviteUse({
    guildId: GUILD,
    code: 'aurora',
    inviterId: '900000000000000401',
    inviterName: 'Kai',
    userId: '900000000000000103',
    username: 'Other',
    joinedAt: Date.now(),
  });
  const summary = repo.getInviteSummary(GUILD);
  assert.equal(summary.total, 2);
  assert.equal(summary.last7Days, 2);
  const leaders = repo.getInviteLeaderboard(GUILD);
  assert.equal(leaders[0].inviterName, 'Kai');
  assert.equal(leaders[0].joins, 2);
  const inviter = repo.getInviterStats(GUILD, '900000000000000401');
  assert.equal(inviter.total, 2);
  assert.equal(repo.getRecentInviteUses(GUILD).length, 2);
});

test('templates can be saved, listed and deleted', () => {
  const created = repo.createTemplate(GUILD, {
    type: 'welcome',
    name: 'Test Template',
    description: 'A template',
    style: 'modern',
    content: { title: 'T', description: 'D', footer: '', color: '#5865F2', emoji: '', mention: false, elements: {}, variants: {} },
  });
  assert.equal(repo.listTemplates(GUILD, 'welcome').length, 1);
  assert.equal(repo.getTemplate(GUILD, created.id).name, 'Test Template');
  assert.equal(repo.deleteTemplate(GUILD, created.id), true);
});

test('logs paginate and clear', () => {
  for (let index = 0; index < 5; index += 1) repo.addLog(GUILD, 'member', 'joined', `Join ${index}`);
  const page = repo.listLogs(GUILD, { limit: 2, offset: 0 });
  assert.equal(page.total, 5);
  assert.equal(page.logs.length, 2);
  assert.equal(repo.clearLogs(GUILD), 5);
});

test('sessions persist and can be revoked', () => {
  const id = repo.createSession({ id: USER, username: 'Dev', globalName: 'Dev' });
  assert.ok(repo.getSession(id));
  repo.updateSessionTokens(id, { accessToken: 'token', refreshToken: 'refresh', tokenExpiresAt: Date.now() + 1000 });
  assert.equal(repo.getSession(id).accessToken, 'token');
  repo.deleteSession(id);
  assert.equal(repo.getSession(id), null);
});

test('preview builds from persisted configuration', async () => {
  const config = repo.getWelcomeConfig(GUILD);
  config.content.title = 'Hello {username}';
  repo.saveWelcomeConfig(GUILD, config);
  const result = await buildPreview({
    guild: { id: GUILD, name: 'Test Guild', iconURL: null, memberCount: 42 },
    welcomeConfig: config,
    kind: 'welcome',
    generateImage: false,
  });
  assert.ok(result.model.blocks.length > 0);
  assert.ok(result.model.resolved.title.includes('Nova'));
  assert.equal(result.files.length, 0);
});
