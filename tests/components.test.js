import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_WELCOME_CONTENT, WELCOME_STYLES } from '../src/shared/defaults.js';
import { buildMessageModel } from '../src/welcome/model.js';
import { buildMessagePayload } from '../src/welcome/components.js';

const base = {
  guild: { id: '987654321098765432', name: 'Aurora Community', iconURL: 'https://cdn.discordapp.com/embed/avatars/2.png', memberCount: 12480 },
  member: {
    id: '111111111111111111',
    username: 'Nova',
    displayName: 'Nova',
    avatarURL: 'https://cdn.discordapp.com/embed/avatars/0.png',
    isBot: false,
    createdAt: Date.UTC(2024, 2, 14),
    joinedAt: Date.UTC(2026, 9, 31),
  },
  inviter: { id: '222222222222222222', name: 'Kai' },
  inviteCode: 'aurora',
  memberNumber: 1024,
  channels: { main: '400000000000000001', rules: '400000000000000002', introductions: '400000000000000003' },
  stats: { todayJoins: 12, weekJoins: 88, totalJoins: 2048 },
  buttons: [
    { label: 'Rules', type: 'rules', style: 2, enabled: true },
    { label: 'Website', type: 'url', style: 5, url: 'https://example.com', enabled: true },
  ],
  imageAttachment: 'welcome.png',
  dashboardUrl: 'https://dashboard.example.com',
};

function containerJson(payload) {
  return payload.components[0].toJSON();
}

test('every style serializes to a components V2 container', () => {
  for (const style of WELCOME_STYLES) {
    const model = buildMessageModel({ ...base, style: style.id, content: structuredClone(DEFAULT_WELCOME_CONTENT) });
    const payload = buildMessagePayload(model);
    const json = containerJson(payload);
    assert.equal(json.type, 17, `${style.id} container type`);
    assert.equal(payload.flags, 32768, `${style.id} components v2 flag`);
    assert.ok(json.components.length > 0);
    assert.equal(json.components.some((component) => component.type === 4), false);
    assert.equal('embeds' in payload, false);
    assert.equal('content' in payload, false);
    for (const component of json.components) {
      if (component.type === 10) assert.ok(component.content.length > 0, 'empty text display');
    }
  }
});

test('link and internal buttons serialize correctly', () => {
  const model = buildMessageModel({ ...base, style: 'classic', content: structuredClone(DEFAULT_WELCOME_CONTENT) });
  const payload = buildMessagePayload(model);
  const json = containerJson(payload);
  const actionRows = json.components.filter((component) => component.type === 1);
  assert.ok(actionRows.length >= 1);
  const flatButtons = actionRows.flatMap((row) => row.components);
  assert.ok(flatButtons.some((button) => button.style === 5 && button.url === 'https://example.com'));
  assert.ok(flatButtons.some((button) => button.custom_id === `wb:rules:${base.guild.id}`));
});

test('25 buttons are chunked into five action rows', () => {
  const buttons = Array.from({ length: 25 }, (_, index) => ({
    label: `Button ${index + 1}`,
    type: 'rules',
    style: 2,
    enabled: true,
  }));
  const model = buildMessageModel({
    ...base,
    style: 'custom',
    content: structuredClone(DEFAULT_WELCOME_CONTENT),
    buttons,
  });
  const json = containerJson(buildMessagePayload(model));
  const actionRows = json.components.filter((component) => component.type === 1);
  assert.equal(actionRows.length, 5);
  assert.equal(actionRows[0].components.length, 5);
});

test('mentions are explicitly allowed only for the joining member', () => {
  const content = structuredClone(DEFAULT_WELCOME_CONTENT);
  content.mention = true;
  const model = buildMessageModel({ ...base, style: 'classic', content });
  const payload = buildMessagePayload(model);
  assert.deepEqual(payload.allowedMentions, { parse: [], users: [model.member.id] });
  const quiet = buildMessagePayload(
    buildMessageModel({ ...base, style: 'classic', content: structuredClone(DEFAULT_WELCOME_CONTENT) }),
  );
  assert.deepEqual(quiet.allowedMentions, { parse: [] });
});

test('ephemeral preview payload combines both flags', () => {
  const model = buildMessageModel({ ...base, style: 'minimal', content: structuredClone(DEFAULT_WELCOME_CONTENT) });
  const payload = buildMessagePayload(model, { ephemeral: true });
  assert.equal(payload.flags, 32768 | 64);
});
