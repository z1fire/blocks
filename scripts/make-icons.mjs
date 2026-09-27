// Generates PWA + Android launcher icons: an isometric grass block, rendered in pure Node.
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/(\w:)/, '$1')), '..');

function crc32(buf) {
  let c, crc = 0xffffffff;
  for (let n = 0; n < buf.length; n++) {
    c = (crc ^ buf[n]) & 0xff;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crc = (crc >>> 8) ^ c;
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function png(size, rgba) {
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    rgba.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0)),
  ]);
}

// deterministic pseudo-random per texel
const rnd = (x, y, s) => {
  let h = (x * 374761393 + y * 668265263 + s * 982451653) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};
const GRASS = [106, 170, 64], DIRT = [134, 96, 67];
function texel(face, u, v) {
  const x = Math.min(15, Math.floor(u * 16)), y = Math.min(15, Math.floor(v * 16));
  if (face === 'top') {
    const f = 0.85 + rnd(x, y, 1) * 0.3;
    return GRASS.map((c) => c * f);
  }
  const depth = 3 + Math.floor(rnd(x, 0, 2) * 3);
  const f = 0.85 + rnd(x, y, 3) * 0.3;
  return (y < depth ? GRASS : DIRT).map((c) => c * f);
}

function render(size, { background, scale }) {
  const buf = Buffer.alloc(size * size * 4);
  const s = size * scale;           // block width
  const ox = (size - s) / 2, oy = (size - s * 1.0) / 2;
  const h = s / 2, q = s / 4;
  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      const i = (py * size + px) * 4;
      let col = null;
      if (background) {
        // rounded-square dark background with subtle gradient
        const r = size * 0.18, cx = Math.min(Math.max(px, r), size - r), cy = Math.min(Math.max(py, r), size - r);
        if (Math.hypot(px - cx, py - cy) <= r) {
          const t = py / size;
          col = [40 - t * 14, 52 - t * 16, 72 - t * 20, 255];
        }
      }
      // inverse iso mapping (same as the in-game icon)
      const X = px - ox, Y = py - oy;
      // top face: X = h + k(u - v)*16..., solve in unit coords
      const a = (X - h) / h, b = Y / q;         // a = u - v, b = u + v
      let u = (a + b) / 2, v = (b - a) / 2;
      let hit = null;
      if (u >= 0 && u < 1 && v >= 0 && v < 1) hit = ['top', u, v, 1];
      else if (X >= 0 && X < h) {               // left face
        u = X / h; v = (Y - q - u * q) / h;
        if (v >= 0 && v < 1) hit = ['side', u, v, 0.78];
      } else if (X >= h && X < s) {             // right face
        u = (X - h) / h; v = (Y - h + u * q) / h;
        if (v >= 0 && v < 1) hit = ['side', u, v, 0.6];
      }
      if (hit) {
        const t = texel(hit[0], hit[1], hit[2]).map((c) => Math.min(255, c * hit[3]));
        col = [...t, 255];
      }
      if (col) { buf[i] = col[0]; buf[i + 1] = col[1]; buf[i + 2] = col[2]; buf[i + 3] = col[3]; }
    }
  }
  return png(size, buf);
}

const write = (rel, data) => {
  const p = path.join(root, rel);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, data);
  console.log('wrote', rel);
};

write('public/icon-192.png', render(192, { background: true, scale: 0.62 }));
write('public/icon-512.png', render(512, { background: true, scale: 0.62 }));

const res = path.join(root, 'android/app/src/main/res');
if (fs.existsSync(res)) {
  const dens = { mdpi: 48, hdpi: 72, xhdpi: 96, xxhdpi: 144, xxxhdpi: 192 };
  for (const [d, sz] of Object.entries(dens)) {
    write(`android/app/src/main/res/mipmap-${d}/ic_launcher.png`, render(sz, { background: true, scale: 0.62 }));
    write(`android/app/src/main/res/mipmap-${d}/ic_launcher_round.png`, render(sz, { background: true, scale: 0.62 }));
    // adaptive foreground is 108dp with a 66dp safe zone
    write(`android/app/src/main/res/mipmap-${d}/ic_launcher_foreground.png`, render(Math.round(sz * 2.25), { background: false, scale: 0.4 }));
  }
}
