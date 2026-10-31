import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_WELCOME_CONTENT, WELCOME_STYLES } from '../src/shared/defaults.js';
import { buildMessageModel } from '../src/welcome/model.js';

const guild = { id: '987654321098765432', name: 'Aurora Community', iconURL: 'https://cdn.discordapp.com/embed/avatars/2.png', memberCount: 12480 };
const member = {
  id: '111111111111111111',
  username: 'Nova',
  displayName: 'Nova',
  avatarURL: 'https://cdn.discordapp.com/embed/avatars/0.png',
  isBot: false,
  createdAt: Date.UTC(2024, 2, 14),
  joinedAt: Date.UTC(2026, 9, 31),
};
const channels = {
  main: '400000000000000001',
  rules: '400000000000000002',
  introductions: '400000000000000003',
  announcements: '400000000000000004',
};
const buttons = [
  { label: 'Read Rules', emoji: '📜', style: 2, type: 'rules', enabled: true },
  { label: 'Get Roles', emoji: '🎭', style: 2, type: 'roles', enabled: true },
  { label: 'Website', emoji: '🌐', style: 5, type: 'url', url: 'https://example.com', enabled: true },
];
const base = {
  guild,
  member,
  inviter: { id: '222222222222222222', name: 'Kai' },
  inviteCode: 'aurora',
  memberNumber: 1024,
  channels,
  stats: { todayJoins: 12, weekJoins: 88, totalJoins: 2048 },
  buttons,
  imageAttachment: 'welcome.png',
  dashboardUrl: 'https://dashboard.example.com',
  timestamp: Date.UTC(2026, 9, 31, 12, 0, 0),
};

test('all eight styles render non-empty layouts', () => {
  for (const style of WELCOME_STYLES) {
    const model = buildMessageModel({ ...base, style: style.id, content: structuredClone(DEFAULT_WELCOME_CONTENT) });
    assert.ok(model.blocks.length > 0, `${style.id} has blocks`);
    assert.equal(model.style, style.id);
    assert.ok(model.blocks.some((block) => block.type === 'text' || block.type === 'section'), `${style.id} contains content`);
    for (const block of model.blocks) {
      assert.ok(['text', 'separator', 'section', 'gallery'].includes(block.type));
    }
  }
});

test('default content fully resolves with context', () => {
  const model = buildMessageModel({ ...base, style: 'classic', content: structuredClone(DEFAULT_WELCOME_CONTENT) });
  const text = [model.resolved.title, model.resolved.description, model.resolved.footer].join(' ');
  assert.ok(!/\{[a-z_]+\}/.test(text), `unresolved placeholders in: ${text}`);
  assert.ok(model.resolved.title.includes('Aurora Community'));
  assert.ok(model.resolved.description.includes('<@111111111111111111>'));
});

test('bot and returning variants override content', () => {
  const bot = buildMessageModel({
    ...base,
    style: 'modern',
    content: structuredClone(DEFAULT_WELCOME_CONTENT),
    member: { ...member, isBot: true },
  });
  assert.match(bot.resolved.title.toLowerCase(), /bot/);
  const returning = buildMessageModel({
    ...base,
    style: 'modern',
    content: structuredClone(DEFAULT_WELCOME_CONTENT),
    member: { ...member, isBot: false },
    returning: true,
  });
  assert.match(returning.resolved.title.toLowerCase(), /back/);
});

test('mention block creates a real mention context', () => {
  const content = structuredClone(DEFAULT_WELCOME_CONTENT);
  content.mention = true;
  const model = buildMessageModel({ ...base, style: 'classic', content });
  assert.equal(model.mentionUserId, member.id);
  assert.ok(model.blocks.some((block) => block.type === 'text' && block.content === `<@${member.id}>`));
});

test('buttons map to valid internal or link actions', () => {
  const model = buildMessageModel({ ...base, style: 'classic', content: structuredClone(DEFAULT_WELCOME_CONTENT) });
  assert.equal(model.buttons.length, 3);
  const rules = model.buttons.find((button) => button.type === 'rules');
  assert.equal(rules.customId, `wb:rules:${guild.id}`);
  assert.equal(rules.url, null);
  const link = model.buttons.find((button) => button.type === 'url');
  assert.equal(link.style, 5);
  assert.equal(link.url, 'https://example.com');
  assert.deepEqual(model.attachments, [{ name: 'welcome.png', url: 'attachment://welcome.png' }]);
});

test('disabled buttons are excluded', () => {
  const model = buildMessageModel({
    ...base,
    style: 'classic',
    content: structuredClone(DEFAULT_WELCOME_CONTENT),
    buttons: [...buttons, { label: 'Hidden', type: 'rules', enabled: false }],
  });
  assert.equal(model.buttons.length, 3);
  assert.ok(!model.buttons.some((button) => button.label === 'Hidden'));
});

test('empty layouts fall back to a readable text block', () => {
  const content = structuredClone(DEFAULT_WELCOME_CONTENT);
  for (const key of Object.keys(content.elements)) content.elements[key] = false;
  content.title = '';
  content.description = '';
  content.footer = '';
  const model = buildMessageModel({ ...base, content, buttons: [], imageAttachment: null, style: 'custom' });
  assert.equal(model.blocks.length, 1);
  assert.equal(model.blocks[0].type, 'text');
  assert.match(model.blocks[0].content, /Nova/);
});

test('leave messages never include buttons', () => {
  const model = buildMessageModel({
    ...base,
    kind: 'leave',
    style: 'community',
    content: structuredClone(DEFAULT_WELCOME_CONTENT),
  });
  assert.equal(model.buttons.length, 0);
  assert.equal(model.kind, 'leave');
});
