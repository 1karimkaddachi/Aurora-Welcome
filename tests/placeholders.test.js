import test from 'node:test';
import assert from 'node:assert/strict';
import { resolvePlaceholders, PLACEHOLDERS } from '../src/shared/placeholders.js';

const context = {
  guild: {
    id: '987654321098765432',
    name: 'Aurora Community',
    iconURL: 'https://cdn.discordapp.com/icons/1/icon.png',
    memberCount: 12480,
  },
  member: {
    id: '111111111111111111',
    username: 'Nova',
    displayName: 'Nova',
    avatarURL: 'https://cdn.discordapp.com/avatars/1/avatar.png',
    createdAt: Date.UTC(2024, 2, 14),
    joinedAt: Date.UTC(2026, 9, 31),
  },
  inviter: { id: '222222222222222222', name: 'Kai' },
  inviteCode: 'aurora',
  memberNumber: 1024,
  channels: {
    main: '400000000000000001',
    rules: '400000000000000002',
    introductions: '400000000000000003',
    announcements: '400000000000000004',
  },
};

test('resolves every documented placeholder', () => {
  for (const placeholder of PLACEHOLDERS) {
    const value = resolvePlaceholders(placeholder.token, context);
    assert.notEqual(value, placeholder.token, `${placeholder.token} should resolve`);
  }
});

test('resolves core values correctly', () => {
  assert.equal(resolvePlaceholders('{username}', context), 'Nova');
  assert.equal(resolvePlaceholders('{user}', context), '<@111111111111111111>');
  assert.equal(resolvePlaceholders('{server_name}', context), 'Aurora Community');
  assert.equal(resolvePlaceholders('{member_count}', context), '12,480');
  assert.equal(resolvePlaceholders('{member_number}', context), '1,024');
  assert.equal(resolvePlaceholders('{rules_channel}', context), '<#400000000000000002>');
  assert.equal(resolvePlaceholders('{intros_channel}', context), '<#400000000000000003>');
  assert.equal(resolvePlaceholders('{inviter}', context), 'Kai');
  assert.equal(resolvePlaceholders('{invite_code}', context), 'aurora');
  assert.equal(resolvePlaceholders('{created_at}', context), '14 Mar 2024');
  assert.equal(resolvePlaceholders('{joined_at}', context), '31 Oct 2026');
});

test('missing values degrade to readable fallbacks', () => {
  const bare = { member: { username: 'Solo' }, guild: { name: 'Server' } };
  assert.equal(resolvePlaceholders('{inviter}', bare), 'an unknown invite');
  assert.equal(resolvePlaceholders('{rules_channel}', bare), 'the rules channel');
  assert.equal(resolvePlaceholders('{member_count}', bare), '0');
  assert.equal(resolvePlaceholders('{invite_code}', bare), 'Unknown');
  assert.equal(resolvePlaceholders('', context), '');
  assert.equal(resolvePlaceholders(null, context), '');
});

test('unknown placeholders are preserved for debugging', () => {
  assert.equal(resolvePlaceholders('Hello {unknown_token}', context), 'Hello {unknown_token}');
});

test('replaces every occurrence, not just the first', () => {
  assert.equal(resolvePlaceholders('{username} and {username}', context), 'Nova and Nova');
});
