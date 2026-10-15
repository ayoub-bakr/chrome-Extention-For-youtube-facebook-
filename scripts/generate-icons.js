import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const iconsDir = path.resolve(__dirname, '../icons');

if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir, { recursive: true });
}

// Function to generate a simple RGBA PNG buffer with an intentional target/focus reticle icon
function createPng(width, height) {
  // RGBA buffer: (width * 4 + 1 filter byte per line) * height
  const rowSize = 1 + width * 4;
  const rawData = Buffer.alloc(rowSize * height);

  const cx = width / 2;
  const cy = height / 2;
  const rOuter = width * 0.42;
  const rInner = width * 0.28;
  const rDot = width * 0.12;

  for (let y = 0; y < height; y++) {
    const rowOffset = y * rowSize;
    rawData[rowOffset] = 0; // Filter type 0 (None)

    for (let x = 0; x < width; x++) {
      const pxOffset = rowOffset + 1 + x * 4;
      const dx = x - cx;
      const dy = y - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);

      // Colors:
      // Background: Deep Indigo / Navy #1E1B4B: 30, 27, 75
      // Accent / Focus: Emerald / Cyan gradient: #10B981 to #06B6D4
      let r = 30, g = 27, b = 75, a = 255;

      const isOuterRing = Math.abs(dist - rOuter) <= (width >= 48 ? 2.5 : 1.2);
      const isInnerRing = Math.abs(dist - rInner) <= (width >= 48 ? 1.8 : 1.0);
      const isCenterDot = dist <= rDot;
      const isCrosshair = (Math.abs(dx) <= (width >= 48 ? 1.5 : 0.8) || Math.abs(dy) <= (width >= 48 ? 1.5 : 0.8)) && dist <= rOuter * 1.15 && dist >= rInner * 0.8;

      if (dist > width * 0.48) {
        // Outside circle corner - transparent or rounded badge
        a = 0;
      } else if (isCenterDot || isOuterRing || isCrosshair) {
        // Vibrant Emerald / Cyan
        r = 16;
        g = 185;
        b = 129;
        a = 255;
      } else if (isInnerRing) {
        r = 6;
        g = 182;
        b = 212;
        a = 230;
      } else {
        // Dark badge background
        r = 15;
        g = 23;
        b = 42; // #0f172a slate-900
        a = 255;
      }

      rawData[pxOffset] = r;
      rawData[pxOffset + 1] = g;
      rawData[pxOffset + 2] = b;
      rawData[pxOffset + 3] = a;
    }
  }

  // Build PNG chunks
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  function makeChunk(type, data) {
    const typeBuf = Buffer.from(type, 'ascii');
    const lenBuf = Buffer.alloc(4);
    lenBuf.writeUInt32BE(data.length, 0);

    const crcBuf = Buffer.alloc(4);
    const crc = crc32(Buffer.concat([typeBuf, data]));
    crcBuf.writeInt32BE(crc, 0);

    return Buffer.concat([lenBuf, typeBuf, data, crcBuf]);
  }

  // IHDR chunk: 13 bytes
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr.writeUInt8(8, 8); // 8-bit depth
  ihdr.writeUInt8(6, 9); // RGBA
  ihdr.writeUInt8(0, 10); // Compression method (deflate)
  ihdr.writeUInt8(0, 11); // Filter method
  ihdr.writeUInt8(0, 12); // Interlace (none)

  const ihdrChunk = makeChunk('IHDR', ihdr);

  // IDAT chunk
  const compressed = zlib.deflateSync(rawData);
  const idatChunk = makeChunk('IDAT', compressed);

  // IEND chunk
  const iendChunk = makeChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

// Minimal CRC32 implementation
function crc32(buf) {
  let table = crc32.table;
  if (!table) {
    table = new Int32Array(256);
    for (let i = 0; i < 256; i++) {
      let c = i;
      for (let j = 0; j < 8; j++) {
        c = (c & 1) ? (-306674912 ^ (c >>> 1)) : (c >>> 1);
      }
      table[i] = c;
    }
    crc32.table = table;
  }
  let crc = -1;
  for (let i = 0; i < buf.length; i++) {
    crc = (crc >>> 8) ^ table[(crc ^ buf[i]) & 0xFF];
  }
  return crc ^ (-1);
}

// Generate 16, 48, 128
for (const size of [16, 48, 128]) {
  const pngBuf = createPng(size, size);
  const outPath = path.join(iconsDir, `icon${size}.png`);
  fs.writeFileSync(outPath, pngBuf);
  console.log(`Generated ${outPath} (${pngBuf.length} bytes)`);
}
