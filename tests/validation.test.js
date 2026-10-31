import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ValidationError,
  normalizeImage,
  validateAutoRole,
  validateButton,
  validateGuildSettings,
  validateLeaveConfig,
  validateSelfRole,
  validateTemplate,
  validateWelcomeConfig,
} from '../src/shared/validation.js';
import { DEFAULT_IMAGE_CONFIG, DEFAULT_WELCOME_CONTENT } from '../src/shared/defaults.js';

const baseWelcome = {
  enabled: true,
  channels: {
    main: '400000000000000001',
    rules: '400000000000000002',
    introductions: '400000000000000003',
  },
  style: 'modern',
  sendMode: 'both',
  botMode: 'enabled',
  returningMode: 'returning',
  content: { ...DEFAULT_WELCOME_CONTENT, color: '#22d3ee' },
  image: DEFAULT_IMAGE_CONFIG,
  dmContent: DEFAULT_WELCOME_CONTENT,
};

test('normalizes a valid welcome configuration', () => {
  const config = validateWelcomeConfig(baseWelcome);
  assert.equal(config.style, 'modern');
  assert.equal(config.sendMode, 'both');
  assert.equal(config.channels.main, '400000000000000001');
  assert.equal(config.content.color, '#22D3EE');
});

test('defaults apply when payload is empty', () => {
  const config = validateWelcomeConfig({});
  assert.equal(config.enabled, true);
  assert.equal(config.style, 'classic');
  assert.equal(config.sendMode, 'public');
  assert.ok(config.content.title.length > 0);
});

test('rejects invalid colors, channels, modes and oversized content', () => {
  assert.throws(() => validateWelcomeConfig({ ...baseWelcome, content: { ...baseWelcome.content, color: 'red' } }), ValidationError);
  assert.throws(() => validateWelcomeConfig({ ...baseWelcome, channels: { main: 'nope' } }), ValidationError);
  assert.throws(() => validateWelcomeConfig({ ...baseWelcome, sendMode: 'everywhere' }), ValidationError);
  assert.throws(
    () => validateWelcomeConfig({ ...baseWelcome, content: { ...baseWelcome.content, title: 'x'.repeat(300) } }),
    ValidationError,
  );
});

test('leave validation is independent and safe', () => {
  const config = validateLeaveConfig({ channelId: '400000000000000001', style: 'community' });
  assert.equal(config.channelId, '400000000000000001');
  assert.equal(config.style, 'community');
  assert.throws(() => validateLeaveConfig({ channelId: 'abc' }), ValidationError);
});

test('image validation clamps and rejects unsafe paths', () => {
  const image = normalizeImage({ width: 9999, height: 10, avatar: { size: 9999, shape: 'circle' } });
  assert.equal(image.width, 2000);
  assert.equal(image.height, 150);
  assert.equal(image.avatar.size, 400);
  assert.throws(() => normalizeImage({ background: { image: '../../etc/passwd' } }), ValidationError);
  assert.throws(() => normalizeImage({ background: { colors: ['not-a-color'] } }), ValidationError);
  const uploaded = normalizeImage({ background: { image: 'uploads/123456789012345678/bg.png', type: 'image' } });
  assert.equal(uploaded.background.image, 'uploads/123456789012345678/bg.png');
});

test('button validation enforces Discord limits and URL safety', () => {
  const internal = validateButton({ label: 'Read Rules', type: 'rules', style: 3 });
  assert.equal(internal.style, 3);
  assert.equal(internal.url, null);
  assert.equal(internal.scope, 'welcome');
  const link = validateButton({ label: 'Website', type: 'url', url: 'https://example.com', scope: 'welcome' });
  assert.equal(link.style, 5);
  assert.throws(() => validateButton({ label: 'Bad', type: 'url', url: 'javascript:alert(1)' }), ValidationError);
  assert.throws(() => validateButton({ label: 'Bad', type: 'url', url: 'https://user:pass@example.com' }), ValidationError);
  assert.throws(() => validateButton({ label: 'Internal DM', type: 'rules', scope: 'dm' }), ValidationError);
  assert.doesNotThrow(() => validateButton({ label: 'DM link', type: 'url', url: 'https://example.com', scope: 'dm' }));
  assert.throws(() => validateButton({ label: 'x', type: 'rules' }, 25), ValidationError);
  assert.throws(() => validateButton({ label: '', type: 'rules' }), ValidationError);
});

test('role validation rejects malformed snowflakes', () => {
  assert.throws(() => validateAutoRole({ roleId: 'abc' }), ValidationError);
  assert.equal(validateAutoRole({ roleId: '400000000000000001', target: 'human', delaySeconds: 5 }).delaySeconds, 5);
  assert.throws(() => validateSelfRole({ roleId: '400000000000000001', label: '' }), ValidationError);
  assert.equal(validateSelfRole({ roleId: '400000000000000001', label: 'Gamer' }).label, 'Gamer');
});

test('advanced settings clamp numeric values', () => {
  const settings = validateGuildSettings({
    abuseThreshold: 999,
    abuseWindowMinutes: 0,
    welcomeDelayMs: -5,
    deleteWelcomeAfter: 99999999,
    logChannelId: '400000000000000001',
  });
  assert.equal(settings.abuseThreshold, 100);
  assert.equal(settings.abuseWindowMinutes, 1);
  assert.equal(settings.welcomeDelayMs, 0);
  assert.equal(settings.deleteWelcomeAfter, 604800);
  assert.throws(() => validateGuildSettings({ logChannelId: 'nope' }), ValidationError);
});

test('template validation normalizes content and rejects empty names', () => {
  const template = validateTemplate(
    { name: 'Modern', description: 'Nice', style: 'modern', content: DEFAULT_WELCOME_CONTENT },
    'welcome',
  );
  assert.equal(template.type, 'welcome');
  assert.equal(template.name, 'Modern');
  assert.throws(() => validateTemplate({ name: '  ', content: DEFAULT_WELCOME_CONTENT }, 'welcome'), ValidationError);
});
