/**
 * Development-only demo data for the dashboard.
 *
 * This never runs automatically. It creates a fake guild record so the full
 * dashboard can be exercised without a Discord token. It does not create
 * anything on Discord and must not be used to represent production behaviour.
 */
import { db, queries } from '../src/db/index.js';
import {
  addLog,
  addMemberJoin,
  createAutoRole,
  createButton,
  createSelfRole,
  createTemplate,
  deleteGuild,
  ensureGuild,
  getLeaveConfig,
  getWelcomeConfig,
  recordInviteUse,
  saveGuildSettings,
  saveLeaveConfig,
  saveWelcomeConfig,
  upsertInvite,
} from '../src/db/repositories.js';
import {
  BUILTIN_LEAVE_TEMPLATES,
  BUILTIN_WELCOME_TEMPLATES,
  DEFAULT_DM_CONTENT,
  DEFAULT_IMAGE_CONFIG,
} from '../src/shared/defaults.js';

const GUILD_ID = '900000000000000001';
const CHANNELS = {
  main: '900000000000000101',
  rules: '900000000000000102',
  introductions: '900000000000000103',
  announcements: '900000000000000104',
  logs: '900000000000000105',
  tickets: '900000000000000106',
  roles: '900000000000000107',
};
const ROLES = {
  member: '900000000000000201',
  announcements: '900000000000000202',
  events: '900000000000000203',
  gamer: '900000000000000204',
  artist: '900000000000000205',
  developer: '900000000000000206',
};
const INVITERS = [
  { id: '900000000000000301', name: 'kai' },
  { id: '900000000000000302', name: 'luna' },
  { id: '900000000000000303', name: 'orion' },
  { id: '900000000000000304', name: 'mira' },
];
const NAMES = [
  'nova', 'pixel', 'echo', 'sable', 'iri', 'zephyr', 'mako', 'lumen', 'kira', 'onyx',
  'violet', 'rune', 'sol', 'nyx', 'ember', 'juno', 'cove', 'atlas', 'sage', 'wren',
  'kite', 'moss', 'aria', 'dune', 'fable', 'glint', 'haze', 'indigo', 'jade', 'koda',
  'lyric', 'mint', 'nori', 'opal', 'pulse', 'quartz', 'rave', 'silk', 'tide', 'umbra',
];

function dayString(offsetDays) {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() + offsetDays);
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

function seed() {
  console.log('Seeding development demo data (no Discord resources are created)...');
  deleteGuild(GUILD_ID);
  queries.run('DELETE FROM member_history WHERE guild_id = ?', GUILD_ID);
  queries.run('DELETE FROM invite_uses WHERE guild_id = ?', GUILD_ID);
  queries.run('DELETE FROM invites WHERE guild_id = ?', GUILD_ID);
  queries.run('DELETE FROM join_stats WHERE guild_id = ?', GUILD_ID);
  queries.run('DELETE FROM logs WHERE guild_id = ?', GUILD_ID);
  ensureGuild({
    guildId: GUILD_ID,
    name: 'Aurora Community',
    icon: 'https://cdn.discordapp.com/embed/avatars/2.png',
    ownerId: INVITERS[0].id,
    memberCount: 12480,
    botPresent: 1,
  });

  const modern = BUILTIN_WELCOME_TEMPLATES.find((template) => template.id === 'builtin-modern');
  const welcome = getWelcomeConfig(GUILD_ID);
  welcome.enabled = true;
  welcome.style = 'modern';
  welcome.content = structuredClone(modern.content);
  welcome.dmContent = structuredClone(DEFAULT_DM_CONTENT);
  welcome.channels = {
    main: CHANNELS.main,
    secondary: null,
    rules: CHANNELS.rules,
    introductions: CHANNELS.introductions,
    announcements: CHANNELS.announcements,
  };
  welcome.sendMode = 'both';
  welcome.botMode = 'enabled';
  welcome.returningMode = 'returning';
  welcome.image = {
    ...structuredClone(DEFAULT_IMAGE_CONFIG),
    background: {
      ...DEFAULT_IMAGE_CONFIG.background,
      colors: ['#050816', '#0E1B3D', '#4338CA'],
      overlay: 0.28,
    },
    text: {
      ...DEFAULT_IMAGE_CONFIG.text,
      titleColor: '#A5B4FC',
      subtitleColor: '#818CF8',
    },
  };
  saveWelcomeConfig(GUILD_ID, welcome);

  const warm = BUILTIN_LEAVE_TEMPLATES.find((template) => template.id === 'builtin-leave-warm');
  const leave = getLeaveConfig(GUILD_ID);
  leave.enabled = true;
  leave.channelId = CHANNELS.announcements;
  leave.style = 'community';
  leave.content = structuredClone(warm.content);
  saveLeaveConfig(GUILD_ID, leave);

  saveGuildSettings(GUILD_ID, {
    logChannelId: CHANNELS.logs,
    inviteTracking: true,
    vanityTracking: true,
    abuseThreshold: 8,
    abuseWindowMinutes: 30,
    welcomeDelayMs: 0,
    deleteWelcomeAfter: 0,
    dmFailureNotice: true,
    dryRun: false,
    ticketChannelId: CHANNELS.tickets,
    rolesChannelId: CHANNELS.roles,
    rulesText:
      '**Be kind.** Treat every member with respect.\n**Stay on topic.** Use the right channels for the right conversations.\n**No spam or self-promo** without staff approval.\n**Keep it safe.** No NSFW, hate speech, or harassment.',
  });

  const buttons = [
    { label: 'Read Rules', emoji: '📜', style: 2, type: 'rules' },
    { label: 'Get Roles', emoji: '🎭', style: 2, type: 'roles' },
    { label: 'Introduce Yourself', emoji: '👋', style: 2, type: 'intro' },
    { label: 'Open Ticket', emoji: '🎫', style: 3, type: 'ticket' },
  ];
  for (const button of buttons) createButton(GUILD_ID, { ...button, scope: 'welcome' });

  createAutoRole(GUILD_ID, { roleId: ROLES.member, target: 'human', delaySeconds: 0 });
  createAutoRole(GUILD_ID, { roleId: ROLES.announcements, target: 'all', delaySeconds: 2 });

  createSelfRole(GUILD_ID, { roleId: ROLES.events, label: 'Event pings', emoji: '📣' });
  createSelfRole(GUILD_ID, { roleId: ROLES.gamer, label: 'Gamer', emoji: '🎮' });
  createSelfRole(GUILD_ID, { roleId: ROLES.artist, label: 'Artist', emoji: '🎨' });
  createSelfRole(GUILD_ID, { roleId: ROLES.developer, label: 'Developer', emoji: '💻' });

  createTemplate(GUILD_ID, {
    type: 'welcome',
    name: 'Aurora Modern',
    description: 'The demo community welcome card.',
    style: 'modern',
    content: welcome.content,
    image: welcome.image,
  });
  createTemplate(GUILD_ID, {
    type: 'welcome',
    name: 'Premium Gold',
    description: 'Luxury layout with statistics.',
    style: 'premium',
    content: BUILTIN_WELCOME_TEMPLATES.find((template) => template.id === 'builtin-premium').content,
    image: { ...welcome.image, background: { ...welcome.image.background, colors: ['#0B0903', '#2A2005', '#F0B429'] } },
  });

  const invites = [
    { code: 'aurora', inviterId: INVITERS[0].id, inviterName: INVITERS[0].name, uses: 0, maxUses: 0 },
    { code: 'luna-lounge', inviterId: INVITERS[1].id, inviterName: INVITERS[1].name, uses: 0, maxUses: 0 },
    { code: 'events', inviterId: INVITERS[2].id, inviterName: INVITERS[2].name, uses: 0, maxUses: 0 },
    { code: 'partner', inviterId: INVITERS[3].id, inviterName: INVITERS[3].name, uses: 0, maxUses: 0 },
  ];
  for (const invite of invites) upsertInvite(GUILD_ID, invite);

  const start = Date.now();
  const dayMs = 86_400_000;
  const plans = [];
  for (let offset = -29; offset <= 0; offset += 1) {
    const wave = Math.max(0, Math.round(8 + 7 * Math.sin((offset + 30) / 5) + Math.random() * 5));
    const leaves = offset < -26 ? 0 : Math.max(0, Math.round(wave * 0.26 + Math.random() * 2));
    const dayStartDate = new Date();
    dayStartDate.setHours(0, 0, 0, 0);
    dayStartDate.setDate(dayStartDate.getDate() + offset);
    plans.push({ offset, joins: wave, leaves, day: dayString(offset), dayStart: dayStartDate.getTime() });
  }

  const active = [];
  const inviteCounts = Object.fromEntries(invites.map((invite) => [invite.code, 0]));
  const dailyRows = [];
  let totalJoins = 0;
  let totalLeaves = 0;

  for (const plan of plans) {
    for (let index = 0; index < plan.joins; index += 1) {
      const ordinal = totalJoins;
      const baseName = NAMES[ordinal % NAMES.length];
      const name = ordinal >= NAMES.length ? `${baseName}-${Math.floor(ordinal / NAMES.length) + 1}` : baseName;
      const userId = `9000000000000${String(50000 + ordinal).padStart(5, '0')}`;
      const joinedAt = Math.min(plan.dayStart + Math.floor(Math.random() * 20 * 3_600_000), Date.now() - 5 * 60_000);
      const invite = invites[Math.floor(Math.random() * invites.length)];
      addMemberJoin({
        guildId: GUILD_ID,
        userId,
        username: name,
        displayName: name,
        avatar: `https://cdn.discordapp.com/embed/avatars/${ordinal % 5}.png`,
        isBot: false,
        inviterId: invite.inviterId,
        inviterName: invite.inviterName,
        inviteCode: invite.code,
        inviteType: 'normal',
        joinedAt,
      });
      recordInviteUse({
        guildId: GUILD_ID,
        code: invite.code,
        inviterId: invite.inviterId,
        inviterName: invite.inviterName,
        userId,
        username: name,
        type: 'normal',
        joinedAt,
      });
      inviteCounts[invite.code] += 1;
      active.push({ userId, joinedAt });
      totalJoins += 1;
    }

    let dayLeaves = 0;
    if (plan.offset >= -26) {
      for (let count = 0; count < plan.leaves && active.length > 2; count += 1) {
        const pick = Math.floor(Math.random() * active.length);
        const [leaver] = active.splice(pick, 1);
        const leftAt = Math.min(plan.dayStart + 8 * 3_600_000 + Math.floor(Math.random() * 12 * 3_600_000), Date.now() - 60_000);
        queries.run(
          'UPDATE member_history SET left_at = ? WHERE guild_id = ? AND user_id = ? AND left_at IS NULL',
          Math.max(leftAt, leaver.joinedAt + 3_600_000),
          GUILD_ID,
          leaver.userId,
        );
        dayLeaves += 1;
        totalLeaves += 1;
      }
    }
    dailyRows.push({ day: plan.day, joins: plan.joins, leaves: dayLeaves });
  }

  for (let index = 0; index < 2; index += 1) {
    addMemberJoin({
      guildId: GUILD_ID,
      userId: `9000000000000009${index}`,
      username: index === 0 ? 'helper-bot' : 'music-bot',
      displayName: index === 0 ? 'helper-bot' : 'music-bot',
      avatar: null,
      isBot: true,
      joinedAt: start - dayMs * (12 + index * 5),
    });
    totalJoins += 1;
  }

  let running = 12480 - (dailyRows.reduce((sum, row) => sum + row.joins, 0) - totalLeaves);
  for (const row of dailyRows) {
    running += row.joins - row.leaves;
    queries.run(
      `INSERT OR REPLACE INTO join_stats (guild_id, day, joins, leaves, humans, bots, total_members)
       VALUES (?, ?, ?, ?, ?, 0, ?)`,
      GUILD_ID,
      row.day,
      row.joins,
      row.leaves,
      row.joins,
      running,
    );
  }

  for (const invite of invites) {
    upsertInvite(GUILD_ID, { ...invite, uses: inviteCounts[invite.code] });
  }

  const logs = [
    ['member', 'joined', 'nova joined (member #41); invited by kai via `aurora`.'],
    ['welcome', 'sent', 'Welcome posted for nova in #welcome.'],
    ['invite', 'attributed', 'luna was credited for x47 joins.'],
    ['autorole', 'assigned', 'Assigned @Member to nova.'],
    ['dm', 'sent', 'Welcome DM delivered to nova.'],
    ['config', 'updated', 'Welcome style changed to Modern.'],
    ['leave', 'sent', 'Leave message posted for echo.'],
    ['image', 'failed', 'A background fetch timed out and was retried.'],
    ['system', 'ticket_opened', 'Ticket ticket-nova was opened.'],
  ];
  for (let index = 0; index < 26; index += 1) {
    const entry = logs[index % logs.length];
    queries.run(
      'INSERT INTO logs (guild_id, category, action, message, user_id, meta_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
      GUILD_ID,
      entry[0],
      entry[1],
      entry[2],
      INVITERS[index % INVITERS.length].id,
      null,
      start - index * 23 * 60 * 1000,
    );
  }
  addLog(GUILD_ID, 'system', 'seeded', 'Development demo data seeded.', null);

  console.log('Demo guild ready:', GUILD_ID, '— Aurora Community');
  console.log('Enable ALLOW_DEV_AUTH=true and DEV_GUILD_ID=' + GUILD_ID + ' in .env, then open /login.');
  db.close();
}

seed();
