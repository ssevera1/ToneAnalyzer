/**
 * Generate PWA icon PNGs from pixel data.
 * Run: node scripts/generate-icons.mjs
 */

import { deflateSync } from 'zlib';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(__dirname, '..', 'public');

function isInRoundedRect(x, y, rw, rh, r) {
  if (x < 0 || x >= rw || y < 0 || y >= rh) return false;
  const corners = [[r, r], [rw - r, r], [r, rh - r], [rw - r, rh - r]];
  for (const [cx, cy] of corners) {
    if ((x < r || x >= rw - r) && (y < r || y >= rh - r)) {
      const dx = x - cx;
      const dy = y - cy;
      if (dx * dx + dy * dy > r * r) return false;
    }
  }
  return true;
}

function makeChunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const t = Buffer.from(type, 'ascii');
  const crcBuf = Buffer.concat([t, data]);
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < crcBuf.length; i++) {
    crc ^= crcBuf[i];
    for (let j = 0; j < 8; j++) crc = crc & 1 ? (crc >>> 1) ^ 0xEDB88320 : crc >>> 1;
  }
  const c = Buffer.alloc(4);
  c.writeUInt32BE((crc ^ 0xFFFFFFFF) >>> 0, 0);
  return Buffer.concat([len, t, data, c]);
}

function createPNG(size) {
  const raw = Buffer.alloc(size * (1 + size * 4));
  const bgR = 15, bgG = 23, bgB = 42;
  const acR = 6, acG = 182, acB = 212;
  const cornerR = size * 0.1875;
  const barW = size * 0.047;
  const gap = size * 0.039;
  const startX = size * 0.1875;
  const barH = [0.14, 0.30, 0.45, 0.34, 0.53, 0.375, 0.25, 0.11];

  for (let y = 0; y < size; y++) {
    const ro = y * (1 + size * 4);
    raw[ro] = 0;
    for (let x = 0; x < size; x++) {
      const px = ro + 1 + x * 4;
      if (!isInRoundedRect(x, y, size, size, cornerR)) {
        raw[px] = 0; raw[px+1] = 0; raw[px+2] = 0; raw[px+3] = 0;
        continue;
      }
      let isBar = false;
      for (let i = 0; i < barH.length; i++) {
        const bx = startX + i * (barW + gap);
        const bh = barH[i] * size;
        const by = (size - bh) / 2;
        if (x >= bx && x < bx + barW && y >= by && y < by + bh) { isBar = true; break; }
      }
      if (isBar) {
        raw[px] = acR; raw[px+1] = acG; raw[px+2] = acB; raw[px+3] = 255;
      } else {
        raw[px] = bgR; raw[px+1] = bgG; raw[px+2] = bgB; raw[px+3] = 255;
      }
    }
  }

  const compressed = deflateSync(raw, { level: 9 });
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([sig, makeChunk('IHDR', ihdr), makeChunk('IDAT', compressed), makeChunk('IEND', Buffer.alloc(0))]);
}

for (const size of [192, 512]) {
  const f = `icon-${size}x${size}.png`;
  fs.writeFileSync(path.join(publicDir, f), createPNG(size));
  console.log(`Created ${f}`);
}
fs.writeFileSync(path.join(publicDir, 'apple-touch-icon.png'), createPNG(180));
console.log('Created apple-touch-icon.png');
