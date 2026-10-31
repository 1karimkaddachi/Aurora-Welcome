import fs from 'node:fs';
import path from 'node:path';
import { createCanvas, loadImage, GlobalFonts } from '@napi-rs/canvas';

const REGULAR = 'Aurora UI';
const BOLD = 'Aurora UI Bold';
let fontsReady = false;
const knownFamilies = new Set();

function registerFonts() {
  if (fontsReady) return;
  fontsReady = true;
  const win = process.env.WINDIR || 'C:\\Windows';
  const candidates = [
    { file: path.join(win, 'Fonts', 'segoeui.ttf'), family: REGULAR },
    { file: path.join(win, 'Fonts', 'segoeuib.ttf'), family: BOLD },
    { file: path.join(win, 'Fonts', 'seguisb.ttf'), family: BOLD },
    { file: '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', family: REGULAR },
    { file: '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', family: BOLD },
  ];
  for (const candidate of candidates) {
    try {
      if (fs.existsSync(candidate.file)) {
        GlobalFonts.registerFromPath(candidate.file, candidate.family);
        knownFamilies.add(candidate.family);
      }
    } catch {
      /* ignore unavailable system font */
    }
  }
  const customDir = path.join(process.env.DATA_DIR || './data', 'fonts');
  try {
    if (fs.existsSync(customDir)) {
      for (const entry of fs.readdirSync(customDir)) {
        if (!/\.(ttf|otf|woff2?)$/i.test(entry)) continue;
        const family = path.basename(entry, path.extname(entry)).replace(/[_-]+/g, ' ').trim();
        try {
          GlobalFonts.registerFromPath(path.join(customDir, entry), family);
          knownFamilies.add(family);
        } catch {
          /* ignore invalid font */
        }
      }
    }
  } catch {
    /* ignore */
  }
  try {
    for (const item of GlobalFonts.families) knownFamilies.add(item.family);
  } catch {
    /* ignore */
  }
}

export function getAvailableFonts() {
  registerFonts();
  return [...knownFamilies].filter((family) => family && !family.startsWith('Aurora UI')).sort((a, b) => a.localeCompare(b));
}

function pickFamily(requested, bold) {
  registerFonts();
  if (requested && requested !== 'Segoe UI' && knownFamilies.has(requested)) return requested;
  return bold ? BOLD : REGULAR;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function hashString(value) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function seededRandom(seed) {
  let state = seed || 1;
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
}

function fitText(ctx, value, maxWidth) {
  let text = String(value ?? '');
  if (!text) return '';
  if (ctx.measureText(text).width <= maxWidth) return text;
  while (text.length > 1 && ctx.measureText(`${text}…`).width > maxWidth) text = text.slice(0, -1);
  return `${text.trimEnd()}…`;
}

async function fetchImage(url) {
  if (!url) return null;
  try {
    if (url.startsWith('data:')) return await loadImage(url);
    if (url.startsWith('http://') || url.startsWith('https://')) {
      const response = await fetch(url, { signal: AbortSignal.timeout(6000) });
      if (!response.ok) return null;
      const buffer = Buffer.from(await response.arrayBuffer());
      return await loadImage(buffer);
    }
    if (fs.existsSync(url)) return await loadImage(fs.readFileSync(url));
  } catch {
    return null;
  }
  return null;
}

function drawCover(ctx, image, x, y, width, height) {
  const scale = Math.max(width / image.width, height / image.height);
  const drawWidth = image.width * scale;
  const drawHeight = image.height * scale;
  ctx.drawImage(image, x + (width - drawWidth) / 2, y + (height - drawHeight) / 2, drawWidth, drawHeight);
}

function drawContain(ctx, image, x, y, width, height) {
  const scale = Math.min(width / image.width, height / image.height);
  const drawWidth = image.width * scale;
  const drawHeight = image.height * scale;
  ctx.drawImage(image, x + (width - drawWidth) / 2, y + (height - drawHeight) / 2, drawWidth, drawHeight);
}

function fillGradient(ctx, width, height, angle, colors) {
  const radians = ((angle % 360) * Math.PI) / 180;
  const centerX = width / 2;
  const centerY = height / 2;
  const length = Math.abs(width * Math.cos(radians)) + Math.abs(height * Math.sin(radians));
  const startX = centerX - (Math.cos(radians) * length) / 2;
  const startY = centerY - (Math.sin(radians) * length) / 2;
  const endX = centerX + (Math.cos(radians) * length) / 2;
  const endY = centerY + (Math.sin(radians) * length) / 2;
  const gradient = ctx.createLinearGradient(startX, startY, endX, endY);
  const palette = colors.length === 1 ? [colors[0], colors[0]] : colors;
  palette.forEach((color, index) => gradient.addColorStop(index / (palette.length - 1), color));
  return gradient;
}

function drawFallbackAvatar(ctx, x, y, size, accent, name) {
  const gradient = ctx.createLinearGradient(x, y, x + size, y + size);
  gradient.addColorStop(0, accent);
  gradient.addColorStop(1, '#0B1020');
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(x + size / 2, y + size / 2, size / 2, 0, Math.PI * 2);
  ctx.fill();
  const initial = (String(name || '?').trim()[0] || '?').toUpperCase();
  ctx.fillStyle = '#FFFFFF';
  ctx.font = `700 ${Math.round(size * 0.42)}px "${BOLD}"`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(initial, x + size / 2, y + size / 2 + 1);
}

function drawAvatar(ctx, image, config, accent, name) {
  const { size, shape, borderColor, borderWidth, glow, x, y } = config;
  const centerX = x + size / 2;
  const centerY = y + size / 2;

  if (glow) {
    const glowGradient = ctx.createRadialGradient(centerX, centerY, size * 0.28, centerX, centerY, size * 0.85);
    glowGradient.addColorStop(0, `${accent}99`);
    glowGradient.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = glowGradient;
    ctx.beginPath();
    ctx.arc(centerX, centerY, size * 0.85, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.save();
  if (shape === 'circle') {
    ctx.beginPath();
    ctx.arc(centerX, centerY, size / 2, 0, Math.PI * 2);
    ctx.clip();
  } else {
    const radius = shape === 'rounded' ? size * 0.18 : 0;
    ctx.beginPath();
    ctx.roundRect(x, y, size, size, radius);
    ctx.clip();
  }
  if (image) {
    drawCover(ctx, image, x, y, size, size);
  } else {
    ctx.restore();
    drawFallbackAvatar(ctx, x, y, size, accent, name);
    ctx.save();
    if (shape === 'circle') {
      ctx.beginPath();
      ctx.arc(centerX, centerY, size / 2, 0, Math.PI * 2);
    } else {
      ctx.beginPath();
      ctx.roundRect(x, y, size, size, shape === 'rounded' ? size * 0.18 : 0);
    }
  }
  ctx.restore();

  if (borderWidth > 0) {
    ctx.save();
    ctx.strokeStyle = borderColor;
    ctx.lineWidth = borderWidth;
    if (shape === 'circle') {
      ctx.beginPath();
      ctx.arc(centerX, centerY, size / 2 + borderWidth / 2, 0, Math.PI * 2);
    } else {
      ctx.beginPath();
      ctx.roundRect(x - borderWidth / 2, y - borderWidth / 2, size + borderWidth, size + borderWidth, shape === 'rounded' ? size * 0.18 : 0);
    }
    ctx.stroke();
    ctx.restore();
  }
}

function drawServerBrand(ctx, image, config, guildName, accent, canvasWidth) {
  if (!config.show) return;
  const { x, y, size, nameColor, nameSize, logo } = config;
  ctx.font = `600 ${nameSize}px "${BOLD}"`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  const name = guildName ? fitText(ctx, guildName, 320) : '';
  const nameWidth = name ? ctx.measureText(name).width : 0;
  const groupWidth = (logo ? size + 12 : 0) + nameWidth;
  let startX = x;
  if (canvasWidth && startX + groupWidth > canvasWidth - 24) startX = Math.max(16, canvasWidth - 24 - groupWidth);

  if (logo) {
    if (image) {
      ctx.save();
      ctx.beginPath();
      ctx.roundRect(startX, y, size, size, size * 0.24);
      ctx.clip();
      drawCover(ctx, image, startX, y, size, size);
      ctx.restore();
      ctx.save();
      ctx.strokeStyle = 'rgba(255,255,255,0.22)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(startX, y, size, size, size * 0.24);
      ctx.stroke();
      ctx.restore();
    } else {
      const gradient = ctx.createLinearGradient(startX, y, startX + size, y + size);
      gradient.addColorStop(0, accent);
      gradient.addColorStop(1, '#111827');
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.roundRect(startX, y, size, size, size * 0.24);
      ctx.fill();
      ctx.fillStyle = '#FFFFFF';
      ctx.font = `700 ${Math.round(size * 0.42)}px "${BOLD}"`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText((guildName || 'S')[0].toUpperCase(), startX + size / 2, y + size / 2 + 1);
    }
  }
  if (name) {
    ctx.fillStyle = nameColor;
    ctx.font = `600 ${nameSize}px "${BOLD}"`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(name, startX + (logo ? size + 12 : 0), y + (logo ? size / 2 - nameSize / 2 : 0));
  }
}

function drawDecorativeLayers(ctx, { width, height, config, accent, style, seed }) {
  const decorations = config.decorations;
  const reduced = style === 'minimal';
  if (!reduced && decorations.grid) {
    ctx.save();
    ctx.strokeStyle = 'rgba(255,255,255,0.045)';
    ctx.lineWidth = 1;
    for (let x = 0; x < width; x += 46) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
    for (let y = 0; y < height; y += 46) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }
    ctx.restore();
  }

  if (!reduced && decorations.particles) {
    const random = seededRandom(seed);
    ctx.save();
    for (let index = 0; index < 44; index += 1) {
      const x = random() * width;
      const y = random() * height;
      const radius = 0.8 + random() * 2.4;
      ctx.fillStyle = index % 5 === 0 ? 'rgba(255,255,255,0.34)' : 'rgba(255,255,255,0.1)';
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  if (style === 'gaming') {
    ctx.save();
    ctx.globalAlpha = 0.13;
    ctx.fillStyle = accent;
    for (let index = -1; index < 8; index += 1) {
      ctx.beginPath();
      ctx.moveTo(index * 150 + 60, height);
      ctx.lineTo(index * 150 + 140, 0);
      ctx.lineTo(index * 150 + 190, 0);
      ctx.lineTo(index * 150 + 110, height);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }

  if (style === 'premium') {
    ctx.save();
    ctx.strokeStyle = `${accent}AA`;
    ctx.lineWidth = 2;
    const inset = 22;
    const corner = 54;
    const points = [
      [inset, inset, 1, 1],
      [width - inset, inset, -1, 1],
      [inset, height - inset, 1, -1],
      [width - inset, height - inset, -1, -1],
    ];
    for (const [x, y, dx, dy] of points) {
      ctx.beginPath();
      ctx.moveTo(x + dx * corner, y);
      ctx.lineTo(x, y);
      ctx.lineTo(x, y + dy * corner);
      ctx.stroke();
    }
    ctx.restore();
  }

  if (style === 'community') {
    ctx.save();
    ctx.fillStyle = 'rgba(255,255,255,0.035)';
    ctx.beginPath();
    ctx.roundRect(20, 20, width - 40, height - 40, 28);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.restore();
  }

  if (style === 'professional') {
    ctx.save();
    ctx.fillStyle = accent;
    ctx.fillRect(0, 0, width, 6);
    ctx.restore();
  }

  if (decorations.accentBar) {
    ctx.save();
    const barGradient = ctx.createLinearGradient(0, 0, 0, height);
    barGradient.addColorStop(0, accent);
    barGradient.addColorStop(0.55, '#FFFFFF');
    barGradient.addColorStop(1, accent);
    ctx.fillStyle = barGradient;
    ctx.fillRect(0, 0, style === 'minimal' ? 3 : 7, height);
    ctx.restore();
  }

  if (decorations.glow) {
    const glow = ctx.createRadialGradient(width * 0.78, height * 0.12, 20, width * 0.78, height * 0.12, width * 0.6);
    glow.addColorStop(0, `${accent}30`);
    glow.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, width, height);
  }
}

function titleLabel(style, guildName, returning) {
  if (returning) return 'WELCOME BACK TO';
  switch (style) {
    case 'gaming':
      return 'PLAYER ENTERED';
    case 'professional':
      return 'MEMBER ONBOARDING';
    case 'community':
      return 'SAY HELLO TO';
    case 'premium':
      return 'WELCOME TO';
    case 'minimal':
      return 'WELCOME TO';
    case 'modern':
      return 'WELCOME TO';
    default:
      return 'WELCOME TO';
  }
}

function alignX(config) {
  const { x, align } = config.text;
  if (align === 'center') return x;
  return x;
}

function drawTextBlock(ctx, config, data, style, accent) {
  const { text, memberNumber } = config;
  const family = pickFamily(config.font, false);
  const boldFamily = pickFamily(config.font, true);
  const maxWidth = Math.max(160, config.width - text.x - 60);
  const x = alignX(config);
  ctx.textAlign = text.align;
  ctx.textBaseline = 'top';

  const label = titleLabel(style, data.guildName, data.returning);
  ctx.fillStyle = text.titleColor;
  ctx.font = `700 ${text.titleSize}px "${boldFamily}"`;
  ctx.fillText(fitText(ctx, label, maxWidth), x, text.y);
  if (style === 'premium') {
    const labelWidth = Math.min(ctx.measureText(label).width, maxWidth);
    const lineY = text.y + text.titleSize + 8;
    ctx.fillStyle = accent;
    ctx.fillRect(text.align === 'center' ? x - labelWidth / 2 : text.align === 'right' ? x - labelWidth : x, lineY, labelWidth, 2);
  }

  const nameY = text.y + text.titleSize + (style === 'premium' ? 24 : 14);
  ctx.fillStyle = text.userColor;
  ctx.font = `700 ${text.userSize}px "${boldFamily}"`;
  const displayName = style === 'gaming' ? String(data.displayName || data.username).toUpperCase() : data.displayName || data.username;
  const name = fitText(ctx, displayName, maxWidth);
  if (style === 'gaming') {
    ctx.save();
    ctx.shadowColor = accent;
    ctx.shadowBlur = 18;
    ctx.fillText(name, x, nameY);
    ctx.restore();
  } else {
    ctx.fillText(name, x, nameY);
  }

  const subtitleY = nameY + text.userSize + 14;
  ctx.fillStyle = text.subtitleColor;
  ctx.font = `500 ${text.subtitleSize}px "${family}"`;
  const dateText = data.joinedAt
    ? new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(data.joinedAt))
    : '';
  const subtitleParts = [];
  if (!memberNumber?.show) subtitleParts.push(`Member #${new Intl.NumberFormat('en-US').format(data.memberNumber || 1)}`);
  if (dateText) subtitleParts.push(`Joined ${dateText}`);
  if (data.inviterName) subtitleParts.push(`Invited by ${data.inviterName}`);
  const subtitle = fitText(ctx, subtitleParts.join('  •  '), maxWidth);
  if (subtitle) ctx.fillText(subtitle, x, subtitleY);

  if (memberNumber?.show) {
    ctx.fillStyle = memberNumber.color;
    ctx.font = `700 ${memberNumber.size}px "${boldFamily}"`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    const badge = `#${new Intl.NumberFormat('en-US').format(data.memberNumber || 1)}`;
    const badgeWidth = ctx.measureText(badge).width;
    ctx.save();
    ctx.globalAlpha = 0.14;
    ctx.fillStyle = accent;
    ctx.beginPath();
    ctx.roundRect(memberNumber.x - 12, memberNumber.y - 7, badgeWidth + 24, memberNumber.size + 18, 10);
    ctx.fill();
    ctx.restore();
    ctx.fillStyle = memberNumber.color;
    ctx.fillText(badge, memberNumber.x, memberNumber.y);
  }
}

export async function renderWelcomeImage({ config, style = 'classic', accent = '#5865F2', data = {} }) {
  registerFonts();
  const width = clamp(Number(config.width) || 1024, 200, 3000);
  const height = clamp(Number(config.height) || 420, 100, 2000);
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');
  const effectiveAccent = accent || '#5865F2';
  const seed = hashString(`${data.username || ''}:${data.guildName || ''}:${style}`);

  ctx.fillStyle = '#070B18';
  ctx.fillRect(0, 0, width, height);

  const background = config.background || {};
  if (background.type === 'image' && data.backgroundPath) {
    const image = await fetchImage(data.backgroundPath);
    if (image) {
      if (background.fit === 'stretch') ctx.drawImage(image, 0, 0, width, height);
      else if (background.fit === 'contain') drawContain(ctx, image, 0, 0, width, height);
      else drawCover(ctx, image, 0, 0, width, height);
    } else {
      ctx.fillStyle = fillGradient(ctx, width, height, background.angle || 135, background.colors || ['#070B18', '#14204A']);
      ctx.fillRect(0, 0, width, height);
    }
  } else if (background.type === 'color') {
    ctx.fillStyle = background.colors?.[0] || '#070B18';
    ctx.fillRect(0, 0, width, height);
  } else {
    ctx.fillStyle = fillGradient(ctx, width, height, background.angle || 135, background.colors || ['#070B18', '#14204A', '#4C1D95']);
    ctx.fillRect(0, 0, width, height);
  }

  const overlay = clamp(Number(background.overlay) || 0, 0, 0.95);
  if (overlay > 0) {
    const shade = ctx.createLinearGradient(0, 0, width, height);
    shade.addColorStop(0, `rgba(3,6,18,${overlay})`);
    shade.addColorStop(1, `rgba(3,6,18,${Math.min(0.95, overlay + 0.15)})`);
    ctx.fillStyle = shade;
    ctx.fillRect(0, 0, width, height);
  }

  drawDecorativeLayers(ctx, { width, height, config, accent: effectiveAccent, style, seed });

  const avatar = config.avatar?.show ? await fetchImage(data.avatarUrl) : null;
  if (config.avatar?.show) {
    drawAvatar(ctx, avatar, config.avatar, effectiveAccent, data.displayName || data.username);
  }

  const serverIcon = config.server?.show && config.server.logo ? await fetchImage(data.serverIconUrl) : null;
  drawServerBrand(ctx, serverIcon, config.server || {}, data.guildName, effectiveAccent, width);

  drawTextBlock(ctx, config, data, style, effectiveAccent);

  return canvas.encode('png');
}
