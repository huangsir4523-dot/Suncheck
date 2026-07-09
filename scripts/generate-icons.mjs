import { deflateSync } from "node:zlib";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

const outDir = resolve("public/icons");
mkdirSync(outDir, { recursive: true });

const crcTable = new Uint32Array(256);
for (let n = 0; n < 256; n += 1) {
  let c = n;
  for (let k = 0; k < 8; k += 1) {
    c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  crcTable[n] = c >>> 0;
}

function crc32(buffer) {
  let c = 0xffffffff;
  for (const byte of buffer) c = crcTable[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const typeBuffer = Buffer.from(type);
  const length = Buffer.alloc(4);
  const crc = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])), 0);
  return Buffer.concat([length, typeBuffer, data, crc]);
}

function drawIcon(size) {
  const data = Buffer.alloc((size * 4 + 1) * size);
  const bg = [247, 247, 244, 255];
  const ink = [17, 17, 17, 255];

  function setPixel(x, y, color) {
    if (x < 0 || y < 0 || x >= size || y >= size) return;
    const i = y * (size * 4 + 1) + 1 + x * 4;
    data[i] = color[0];
    data[i + 1] = color[1];
    data[i + 2] = color[2];
    data[i + 3] = color[3];
  }

  for (let y = 0; y < size; y += 1) {
    data[y * (size * 4 + 1)] = 0;
    for (let x = 0; x < size; x += 1) setPixel(x, y, bg);
  }

  const cx = size / 2;
  const cy = size * 0.47;
  const radius = size * 0.17;
  const ring = size * 0.026;
  const rayWidth = size * 0.022;

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const dx = x - cx;
      const dy = y - cy;
      const d = Math.hypot(dx, dy);
      if (Math.abs(d - radius) <= ring) setPixel(x, y, ink);

      const rays = [
        [0, -1, cx, cy - radius - size * 0.09, size * 0.12],
        [0, 1, cx, cy + radius + size * 0.09, size * 0.12],
        [-1, 0, cx - radius - size * 0.09, cy, size * 0.12],
        [1, 0, cx + radius + size * 0.09, cy, size * 0.12],
        [0.707, 0.707, cx + radius * 0.95, cy + radius * 0.95, size * 0.12],
        [-0.707, 0.707, cx - radius * 0.95, cy + radius * 0.95, size * 0.12],
        [0.707, -0.707, cx + radius * 0.95, cy - radius * 0.95, size * 0.12],
        [-0.707, -0.707, cx - radius * 0.95, cy - radius * 0.95, size * 0.12]
      ];

      for (const [vx, vy, sx, sy, len] of rays) {
        const px = x - sx;
        const py = y - sy;
        const along = px * vx + py * vy;
        const off = Math.abs(px * -vy + py * vx);
        if (along > 0 && along < len && off < rayWidth) setPixel(x, y, ink);
      }

      const smileY = size * 0.77;
      const smileDx = (x - cx) / (size * 0.19);
      const targetY = smileY + Math.pow(smileDx, 2) * size * 0.035;
      if (Math.abs(y - targetY) < size * 0.018 && Math.abs(smileDx) < 1) setPixel(x, y, ink);
    }
  }

  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header[8] = 8;
  header[9] = 6;
  header[10] = 0;
  header[11] = 0;
  header[12] = 0;

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", header),
    chunk("IDAT", deflateSync(data)),
    chunk("IEND", Buffer.alloc(0))
  ]);
}

for (const [file, size] of [
  ["icon-192.png", 192],
  ["icon-512.png", 512],
  ["apple-touch-icon.png", 180]
]) {
  const target = resolve(outDir, file);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, drawIcon(size));
}
