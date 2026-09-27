import * as THREE from 'three';
import { BLOCKS, blockIcon, shade, I, FARMLAND, WHEAT_0, GRASS, DIRT, SNOW } from './blocks.js';

// Non-block items (ids >= 256)
export const ITEMS = {};
export const TIERS = { wood: 1, stone: 2, iron: 3, diamond: 4 };
const TIER_INFO = {
  1: { name: 'Wooden', speed: 2, durability: 60, color: [150, 115, 65] },
  2: { name: 'Stone', speed: 4, durability: 132, color: [135, 135, 135] },
  3: { name: 'Iron', speed: 6, durability: 250, color: [225, 225, 225] },
  4: { name: 'Diamond', speed: 8, durability: 1561, color: [90, 230, 220] },
};
const TOOL_DAMAGE = { sword: [4, 5, 6, 7], axe: [3, 4, 5, 6], pickaxe: [2, 3, 4, 5], shovel: [2, 2.5, 3, 4], hoe: [1, 1, 1, 1] };

function item(id, name, opts = {}) { ITEMS[id] = { id, name, item: true, stack: 64, ...opts }; }

item(I.STICK, 'Stick', { sprite: 'stick' });
item(I.COAL, 'Coal', { sprite: 'coal' });
item(I.IRON_INGOT, 'Iron Ingot', { sprite: 'ingot', color: [220, 220, 220] });
item(I.GOLD_INGOT, 'Gold Ingot', { sprite: 'ingot', color: [245, 210, 60] });
item(I.DIAMOND, 'Diamond', { sprite: 'diamond' });

export const TOOL_IDS = {};
let tid = 261;
for (const tier of [1, 2, 3, 4]) {
  for (const kind of ['pickaxe', 'axe', 'shovel', 'sword']) {
    const t = TIER_INFO[tier];
    item(tid, `${t.name} ${kind[0].toUpperCase() + kind.slice(1)}`, {
      sprite: kind, color: t.color, stack: 1,
      tool: { kind, tier, speed: t.speed, durability: t.durability, damage: TOOL_DAMAGE[kind][tier - 1] },
    });
    TOOL_IDS[`${kind}_${tier}`] = tid++;
  }
}
// 261..276 tools; 277 hoe
item(277, 'Hoe', { sprite: 'hoe', color: TIER_INFO[2].color, stack: 1, tool: { kind: 'hoe', tier: 2, speed: 4, durability: 132, damage: 1 } });
TOOL_IDS.hoe = 277;
item(I.SEEDS, 'Seeds', { sprite: 'seeds', plants: WHEAT_0, plantOn: [FARMLAND] });
item(I.WHEAT, 'Wheat', { sprite: 'wheat' });
item(280, 'Bread', { sprite: 'bread', food: 5 });
item(281, 'Raw Porkchop', { sprite: 'meat', color: [240, 140, 140], food: 3 });
item(282, 'Cooked Porkchop', { sprite: 'meat', color: [190, 120, 70], food: 8 });
item(283, 'Raw Beef', { sprite: 'meat', color: [200, 50, 45], food: 3 });
item(284, 'Steak', { sprite: 'meat', color: [130, 75, 40], food: 8 });
item(285, 'Raw Chicken', { sprite: 'drumstick', color: [245, 200, 180], food: 2 });
item(286, 'Cooked Chicken', { sprite: 'drumstick', color: [200, 140, 70], food: 6 });
item(I.APPLE, 'Apple', { sprite: 'apple', food: 4 });
item(288, 'Rotten Flesh', { sprite: 'meat', color: [120, 140, 70], food: 2, sick: true });
item(289, 'Feather', { sprite: 'feather' });
item(290, 'Gunpowder', { sprite: 'gunpowder' });
item(I.MELON_SLICE, 'Melon Slice', { sprite: 'melon', food: 2 });
item(I.CLAY_BALL, 'Clay Ball', { sprite: 'clayball' });
item(293, 'Brick', { sprite: 'ingot', color: [170, 80, 60] });
item(294, 'Mushroom Stew', { sprite: 'stew', food: 6, stack: 1 });

export const IT = {
  BREAD: 280, RAW_PORK: 281, COOKED_PORK: 282, RAW_BEEF: 283, STEAK: 284, RAW_CHICKEN: 285,
  COOKED_CHICKEN: 286, ROTTEN_FLESH: 288, FEATHER: 289, GUNPOWDER: 290, BRICK_ITEM: 293, STEW: 294, ...I,
};

export const HOE_TARGETS = new Set([GRASS, DIRT, SNOW]);

export const getDef = (id) => (id >= 256 ? ITEMS[id] : BLOCKS[id]);
export const isBlock = (id) => id > 0 && id < 256;
export const itemName = (id) => getDef(id)?.name ?? '?';
export const maxStack = (id) => (id >= 256 ? ITEMS[id].stack : 64);

export const CREATIVE_ITEMS = Object.keys(ITEMS).map(Number);

// ---------- Item sprites ----------
const S = 16;
function spriteCanvas(def) {
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(S, S);
  let seed = def.id * 7919;
  const R = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const px = (x, y, col, f = 1) => {
    x = Math.round(x); y = Math.round(y);
    if (x < 0 || y < 0 || x >= S || y >= S) return;
    const i = (y * S + x) * 4;
    const [r, g, b] = shade(col, f);
    img.data[i] = r; img.data[i + 1] = g; img.data[i + 2] = b; img.data[i + 3] = 255;
  };
  const line = (x0, y0, x1, y1, col, f = 1) => {
    const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
    for (let i = 0; i <= n; i++) px(x0 + (x1 - x0) * i / n, y0 + (y1 - y0) * i / n, col, f);
  };
  const ellipse = (cx, cy, rx, ry, col, rot = 0, noise = 0.15) => {
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      const dx = x - cx, dy = y - cy;
      const u = dx * Math.cos(rot) + dy * Math.sin(rot), v = -dx * Math.sin(rot) + dy * Math.cos(rot);
      const d = (u * u) / (rx * rx) + (v * v) / (ry * ry);
      if (d <= 1) px(x, y, col, (d > 0.6 ? 0.8 : 1) * (1 - noise + R() * noise * 2));
    }
  };
  const STICK = [130, 95, 50];
  const handle = (x0, y0, x1, y1) => { line(x0, y0, x1, y1, STICK); line(x0 + 1, y0, x1 + 1, y1, STICK, 0.7); };
  const col = def.color || [200, 200, 200];

  switch (def.sprite) {
    case 'stick': handle(3, 13, 11, 5); break;
    case 'pickaxe':
      handle(3, 13, 10, 6);
      for (let t = -5; t <= 5; t++) {
        const o = Math.round((25 - t * t) / 12);
        px(10 + t + o, 5 + t - o, col, 1.1); px(10 + t + o - 1, 5 + t - o, col, 0.8);
        if (Math.abs(t) < 5) px(10 + t + o, 5 + t - o - 1, col, 1.2);
      }
      break;
    case 'axe':
      handle(3, 13, 11, 5);
      for (let y = 1; y < 8; y++) for (let x = 7; x < 12; x++) {
        if (x - 7 + (7 - y) > 3 && x + y < 16 && !(x === 11 && y === 1)) px(x, y, col, x === 7 || y === 1 ? 1.2 : 0.95);
      }
      break;
    case 'shovel':
      handle(3, 13, 9, 7);
      ellipse(11.5, 4.5, 3, 2.2, col, -Math.PI / 4, 0.08);
      break;
    case 'hoe':
      handle(3, 13, 11, 5);
      line(8, 3, 12, 3, col, 1.1); line(8, 4, 12, 4, col, 0.85); px(12, 5, col);
      break;
    case 'sword':
      for (let i = 0; i < 9; i++) { px(5 + i, 10 - i, col, 1.15); px(6 + i, 10 - i, col, 0.95); px(6 + i, 11 - i, col, 0.75); }
      line(3, 9, 7, 13, [90, 70, 40]);
      line(2, 14, 4, 12, STICK); px(1, 15, [90, 70, 40]);
      break;
    case 'coal': ellipse(8, 8.5, 5, 4, [40, 40, 45], 0.4, 0.3); break;
    case 'ingot':
      for (let y = 6; y < 11; y++) for (let x = 2 + (10 - y); x < 14 - (10 - y) + 2; x++) px(x, y, col, y === 6 ? 1.2 : y === 10 ? 0.75 : 1);
      break;
    case 'diamond':
      for (let y = 3; y < 13; y++) {
        const w = y < 6 ? 2 + (y - 3) * 2 : 12 - y;
        for (let x = 8 - w; x <= 7 + w; x++) px(x, y, [90, 230, 225], y < 6 ? 1.2 : x < 8 ? 1 : 0.8);
      }
      break;
    case 'seeds': for (let i = 0; i < 7; i++) { const x = 3 + R() * 10, y = 5 + R() * 8; px(x, y, [80, 150, 50]); px(x + 1, y, [60, 120, 40]); } break;
    case 'wheat':
      for (let i = 0; i < 4; i++) line(4 + i * 2, 15, 7 + i, 2, [210, 180, 80], 0.9 + i * 0.05);
      break;
    case 'bread': ellipse(8, 9, 6.5, 3.5, [190, 130, 60], -0.3, 0.1); for (let i = 0; i < 3; i++) px(5 + i * 3, 7 + (i === 1 ? 0 : 1), [230, 190, 120]); break;
    case 'meat': ellipse(8, 8, 6, 4, col, 0.5, 0.12); ellipse(6, 7, 1.5, 1, [245, 235, 220], 0.5, 0); break;
    case 'drumstick': ellipse(9, 7, 4.5, 3.8, col, 0.8, 0.12); line(5, 10, 2, 13, [240, 235, 220]); px(1, 14, [240, 235, 220]); px(2, 14, [240, 235, 220]); break;
    case 'apple': ellipse(8, 9, 5, 4.5, [210, 30, 35], 0, 0.1); line(8, 3, 8, 5, [90, 60, 30]); px(9, 3, [60, 140, 40]); px(10, 2, [60, 140, 40]); px(6, 7, [255, 140, 140]); break;
    case 'feather': line(3, 13, 12, 3, [230, 230, 230]); for (let i = 0; i < 8; i++) { px(5 + i, 12 - i, [250, 250, 250]); px(4 + i, 10 - i, [215, 215, 215]); } break;
    case 'gunpowder': for (let i = 0; i < 40; i++) { const a = R() * Math.PI * 2, r = R() * 5; px(8 + Math.cos(a) * r * 1.2, 10 + Math.sin(a) * r * 0.6 - (5 - r) * 0.6, [90, 90, 90], 0.6 + R() * 0.6); } break;
    case 'melon':
      for (let y = 4; y < 13; y++) for (let x = 2; x < 14; x++) {
        const d = Math.hypot(x - 8, (y - 4) * 1.3);
        if (d < 7.5) px(x, y, d > 6.3 ? [70, 140, 40] : ((x * 3 + y) % 7 === 0 ? [30, 20, 20] : [220, 60, 60]));
      }
      break;
    case 'clayball': ellipse(8, 8, 4.5, 4, [165, 170, 185], 0, 0.1); break;
    case 'stew':
      ellipse(8, 10, 6, 3.5, [110, 75, 40], 0, 0.05); ellipse(8, 9, 4.5, 2, [170, 120, 80], 0, 0.15);
      break;
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

const spriteCache = new Map();
export function itemSprite(id) {
  if (!spriteCache.has(id)) spriteCache.set(id, spriteCanvas(ITEMS[id]));
  return spriteCache.get(id);
}

const iconCache = new Map();
export function iconFor(atlasCanvas, id) {
  if (!iconCache.has(id)) {
    if (id >= 256) {
      const c = document.createElement('canvas');
      c.width = c.height = 48;
      const ctx = c.getContext('2d');
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(itemSprite(id), 4, 4, 40, 40);
      iconCache.set(id, c.toDataURL());
    } else iconCache.set(id, blockIcon(atlasCanvas, id));
  }
  return iconCache.get(id);
}

const texCache = new Map();
export function itemTexture(id) {
  if (!texCache.has(id)) {
    const t = new THREE.CanvasTexture(itemSprite(id));
    t.magFilter = t.minFilter = THREE.NearestFilter;
    t.generateMipmaps = false;
    texCache.set(id, t);
  }
  return texCache.get(id);
}
