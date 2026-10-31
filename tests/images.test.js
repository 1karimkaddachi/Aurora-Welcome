import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aurora-image-'));
process.env.DATA_DIR = dataDir;
process.env.LOG_LEVEL = 'error';

const { generateWelcomeImage, shutdownImagePool } = await import('../src/welcome/image.js');
const { DEFAULT_IMAGE_CONFIG } = await import('../src/shared/defaults.js');

after(async () => {
  await shutdownImagePool();
  const { closeLogger } = await import('../src/logger.js');
  await closeLogger();
  fs.rmSync(dataDir, { recursive: true, force: true });
});

function pngDimensions(buffer) {
  assert.equal(buffer.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20),
  };
}

test('generates a PNG banner at the configured dimensions', async () => {
  const config = structuredClone(DEFAULT_IMAGE_CONFIG);
  const buffer = await generateWelcomeImage({
    config,
    style: 'premium',
    accent: '#F0B429',
    data: {
      username: 'Nova',
      displayName: 'Nova',
      memberNumber: 1024,
      guildName: 'Aurora Community',
      joinedAt: Date.now(),
      inviterName: 'Kai',
    },
  });
  assert.ok(buffer.length > 5_000);
  const { width, height } = pngDimensions(buffer);
  assert.equal(width, 1024);
  assert.equal(height, 420);
});

test('renders an uploaded background image and custom dimensions', async () => {
  const first = await generateWelcomeImage({
    config: structuredClone(DEFAULT_IMAGE_CONFIG),
    style: 'classic',
    accent: '#5865F2',
    data: { username: 'Nova', displayName: 'Nova', memberNumber: 1, guildName: 'Aurora' },
  });
  const dir = path.join(dataDir, 'uploads', '900000000000000001');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'bg.png'), first);
  const config = structuredClone(DEFAULT_IMAGE_CONFIG);
  config.width = 640;
  config.height = 300;
  config.background = {
    ...config.background,
    type: 'image',
    image: 'uploads/900000000000000001/bg.png',
  };
  const second = await generateWelcomeImage({
    config,
    style: 'gaming',
    accent: '#F43F5E',
    data: { username: 'Pixel', displayName: 'Pixel', memberNumber: 42, guildName: 'Aurora', backgroundPath: config.background.image },
  });
  const { width, height } = pngDimensions(second);
  assert.equal(width, 640);
  assert.equal(height, 300);
  assert.ok(second.length > 5_000);
});

test('all eight styles generate valid PNGs', async () => {
  for (const style of ['classic', 'modern', 'premium', 'minimal', 'gaming', 'community', 'professional', 'custom']) {
    const buffer = await generateWelcomeImage({
      config: structuredClone(DEFAULT_IMAGE_CONFIG),
      style,
      accent: '#6366F1',
      data: { username: 'Nova', displayName: 'Nova', memberNumber: 12, guildName: 'Aurora Community' },
    });
    pngDimensions(buffer);
    assert.ok(buffer.length > 4_000, `${style} output too small`);
  }
});
