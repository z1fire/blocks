import * as THREE from 'three';

// Block ids
export const AIR = 0, GRASS = 1, DIRT = 2, STONE = 3, SAND = 4, WATER = 5, LOG = 6, LEAVES = 7,
  PLANKS = 8, GLASS = 9, COBBLE = 10, BRICK = 11, SNOW = 12, BEDROCK = 13, GRAVEL = 14,
  COAL_ORE = 15, IRON_ORE = 16, GOLD_ORE = 17, DIAMOND_ORE = 18, BOOKSHELF = 19, WOOL_WHITE = 20,
  WOOL_RED = 21, WOOL_BLUE = 22, WOOL_YELLOW = 23, WOOL_GREEN = 24, WOOL_BLACK = 25, TNT = 26,
  STONE_BRICK = 27, CACTUS = 28, PUMPKIN = 29, CRAFTING = 30, BIRCH_LOG = 31, BIRCH_LEAVES = 32,
  GLOWSTONE = 33, OBSIDIAN = 34, ICE = 35;

// Texture tile names, in atlas order
const TILE_NAMES = [
  'grass_top', 'grass_side', 'dirt', 'stone', 'sand', 'water', 'log_side', 'log_top', 'leaves',
  'planks', 'glass', 'cobble', 'brick', 'snow', 'bedrock', 'gravel', 'coal_ore', 'iron_ore',
  'gold_ore', 'diamond_ore', 'bookshelf', 'wool_white', 'wool_red', 'wool_blue', 'wool_yellow',
  'wool_green', 'wool_black', 'tnt_side', 'tnt_top', 'tnt_bottom', 'stone_brick', 'cactus_side',
  'cactus_top', 'pumpkin_side', 'pumpkin_top', 'pumpkin_face', 'crafting_top', 'crafting_side',
  'birch_side', 'birch_top', 'birch_leaves', 'glowstone', 'obsidian', 'ice', 'snow_side',
];
export const TILE = Object.fromEntries(TILE_NAMES.map((n, i) => [n, i]));
export const TILE_COUNT = TILE_NAMES.length;

// name, tiles [top, side, bottom], flags
function def(name, top, side = top, bottom = top, opts = {}) {
  return { name, tiles: [TILE[top], TILE[side], TILE[bottom]], opaque: true, solid: true, ...opts };
}

export const BLOCKS = [];
BLOCKS[AIR] = { name: 'Air', opaque: false, solid: false, tiles: [0, 0, 0] };
BLOCKS[GRASS] = def('Grass', 'grass_top', 'grass_side', 'dirt');
BLOCKS[DIRT] = def('Dirt', 'dirt');
BLOCKS[STONE] = def('Stone', 'stone');
BLOCKS[SAND] = def('Sand', 'sand');
BLOCKS[WATER] = def('Water', 'water', 'water', 'water', { opaque: false, solid: false, liquid: true });
BLOCKS[LOG] = def('Oak Log', 'log_top', 'log_side', 'log_top');
BLOCKS[LEAVES] = def('Oak Leaves', 'leaves', 'leaves', 'leaves', { opaque: false, foliage: true });
BLOCKS[PLANKS] = def('Planks', 'planks');
BLOCKS[GLASS] = def('Glass', 'glass', 'glass', 'glass', { opaque: false, glass: true });
BLOCKS[COBBLE] = def('Cobblestone', 'cobble');
BLOCKS[BRICK] = def('Bricks', 'brick');
BLOCKS[SNOW] = def('Snowy Grass', 'snow', 'snow_side', 'dirt');
BLOCKS[BEDROCK] = def('Bedrock', 'bedrock', 'bedrock', 'bedrock', { unbreakable: true });
BLOCKS[GRAVEL] = def('Gravel', 'gravel');
BLOCKS[COAL_ORE] = def('Coal Ore', 'coal_ore');
BLOCKS[IRON_ORE] = def('Iron Ore', 'iron_ore');
BLOCKS[GOLD_ORE] = def('Gold Ore', 'gold_ore');
BLOCKS[DIAMOND_ORE] = def('Diamond Ore', 'diamond_ore');
BLOCKS[BOOKSHELF] = def('Bookshelf', 'planks', 'bookshelf', 'planks');
BLOCKS[WOOL_WHITE] = def('White Wool', 'wool_white');
BLOCKS[WOOL_RED] = def('Red Wool', 'wool_red');
BLOCKS[WOOL_BLUE] = def('Blue Wool', 'wool_blue');
BLOCKS[WOOL_YELLOW] = def('Yellow Wool', 'wool_yellow');
BLOCKS[WOOL_GREEN] = def('Green Wool', 'wool_green');
BLOCKS[WOOL_BLACK] = def('Black Wool', 'wool_black');
BLOCKS[TNT] = def('TNT', 'tnt_top', 'tnt_side', 'tnt_bottom', { tnt: true });
BLOCKS[STONE_BRICK] = def('Stone Bricks', 'stone_brick');
BLOCKS[CACTUS] = def('Cactus', 'cactus_top', 'cactus_side', 'cactus_top');
BLOCKS[PUMPKIN] = def('Pumpkin', 'pumpkin_top', 'pumpkin_side', 'pumpkin_top', { faceTile: TILE.pumpkin_face });
BLOCKS[CRAFTING] = def('Crafting Table', 'crafting_top', 'crafting_side', 'planks');
BLOCKS[BIRCH_LOG] = def('Birch Log', 'birch_top', 'birch_side', 'birch_top');
BLOCKS[BIRCH_LEAVES] = def('Birch Leaves', 'birch_leaves', 'birch_leaves', 'birch_leaves', { opaque: false, foliage: true });
BLOCKS[GLOWSTONE] = def('Glowstone', 'glowstone', 'glowstone', 'glowstone', { emissive: true });
BLOCKS[OBSIDIAN] = def('Obsidian', 'obsidian');
BLOCKS[ICE] = def('Ice', 'ice', 'ice', 'ice', { opaque: false, glass: true });

// Blocks offered in the inventory
export const PLACEABLE = [
  GRASS, DIRT, STONE, COBBLE, SAND, GRAVEL, LOG, PLANKS, LEAVES, BIRCH_LOG, BIRCH_LEAVES, GLASS,
  BRICK, STONE_BRICK, BOOKSHELF, CRAFTING, SNOW, ICE, CACTUS, PUMPKIN, GLOWSTONE, OBSIDIAN, TNT,
  COAL_ORE, IRON_ORE, GOLD_ORE, DIAMOND_ORE, WOOL_WHITE, WOOL_RED, WOOL_BLUE, WOOL_YELLOW,
  WOOL_GREEN, WOOL_BLACK, WATER, BEDROCK,
];

export const isOpaque = (id) => BLOCKS[id].opaque;
export const isSolid = (id) => BLOCKS[id].solid;

// ---------- Procedural pixel-art textures ----------
const S = 16;

function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shade([r, g, b], f) {
  return [Math.max(0, Math.min(255, r * f)), Math.max(0, Math.min(255, g * f)), Math.max(0, Math.min(255, b * f))];
}

function drawTile(ctx, ox, name, seed) {
  const img = ctx.createImageData(S, S);
  const R = rng(seed * 9973 + 17);
  const px = (x, y, c, a = 255) => {
    const i = (y * S + x) * 4;
    img.data[i] = c[0]; img.data[i + 1] = c[1]; img.data[i + 2] = c[2]; img.data[i + 3] = a;
  };
  const noisy = (base, amt = 0.15) => {
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) px(x, y, shade(base, 1 - amt + R() * amt * 2));
  };
  const speckle = (base, spots, spotCol, chance) => {
    noisy(base, 0.12);
    for (let i = 0; i < spots; i++) {
      const cx = Math.floor(R() * S), cy = Math.floor(R() * S);
      for (let dy = 0; dy < 2; dy++) for (let dx = 0; dx < 2; dx++) {
        if (R() < chance) px((cx + dx) % S, (cy + dy) % S, shade(spotCol, 0.85 + R() * 0.3));
      }
    }
  };
  const border = (c) => {
    for (let i = 0; i < S; i++) { px(i, 0, c); px(i, S - 1, c); px(0, i, c); px(S - 1, i, c); }
  };
  const wool = (c) => {
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      const f = 0.9 + ((x + y * 3) % 4 === 0 ? -0.08 : 0) + R() * 0.12;
      px(x, y, shade(c, f));
    }
  };

  const GRASS_C = [106, 170, 64], DIRT_C = [134, 96, 67], STONE_C = [125, 125, 125];
  switch (name) {
    case 'grass_top': noisy(GRASS_C, 0.18); break;
    case 'grass_side':
      noisy(DIRT_C, 0.15);
      for (let x = 0; x < S; x++) {
        const d = 3 + Math.floor(R() * 3);
        for (let y = 0; y < d; y++) px(x, y, shade(GRASS_C, 0.85 + R() * 0.3));
      }
      break;
    case 'snow_side':
      noisy(DIRT_C, 0.15);
      for (let x = 0; x < S; x++) {
        const d = 3 + Math.floor(R() * 3);
        for (let y = 0; y < d; y++) px(x, y, shade([240, 250, 255], 0.92 + R() * 0.08));
      }
      break;
    case 'dirt': speckle(DIRT_C, 10, [100, 70, 50], 0.6); break;
    case 'stone': speckle(STONE_C, 12, [105, 105, 105], 0.5); break;
    case 'sand': noisy([219, 207, 163], 0.07); break;
    case 'gravel': speckle([130, 124, 122], 20, [95, 90, 90], 0.7); break;
    case 'water': noisy([48, 96, 220], 0.08); break;
    case 'snow': noisy([240, 250, 255], 0.04); break;
    case 'ice': noisy([160, 200, 255], 0.05); for (let i = 0; i < 6; i++) px(3 + i, 4 + (i >> 1), [230, 240, 255]); break;
    case 'bedrock': speckle([85, 85, 85], 25, [30, 30, 30], 0.8); break;
    case 'obsidian': speckle([20, 16, 32], 14, [60, 40, 90], 0.5); break;
    case 'log_side': case 'birch_side': {
      const birch = name === 'birch_side';
      for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
        const stripe = (x % 4 === 0) ? 0.8 : 1;
        const base = birch ? [215, 215, 205] : [102, 81, 51];
        px(x, y, shade(base, stripe * (0.9 + R() * 0.2)));
      }
      if (birch) for (let i = 0; i < 7; i++) {
        const y = Math.floor(R() * S), x = Math.floor(R() * 12);
        for (let d = 0; d < 3 + R() * 3; d++) px(Math.min(S - 1, x + d), y, [40, 40, 40]);
      }
      break;
    }
    case 'log_top': case 'birch_top': {
      const base = name === 'log_top' ? [160, 130, 80] : [200, 190, 150];
      for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
        const d = Math.max(Math.abs(x - 7.5), Math.abs(y - 7.5));
        const ring = Math.floor(d) % 2 === 0 ? 0.88 : 1;
        px(x, y, d > 6.5 ? (name === 'log_top' ? [102, 81, 51] : [215, 215, 205]) : shade(base, ring * (0.95 + R() * 0.1)));
      }
      break;
    }
    case 'leaves': case 'birch_leaves': {
      const base = name === 'leaves' ? [58, 130, 40] : [110, 160, 70];
      for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
        if (R() < 0.18) px(x, y, [0, 0, 0], 0);
        else px(x, y, shade(base, 0.7 + R() * 0.5));
      }
      break;
    }
    case 'cactus_side':
      for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
        const edge = x === 1 || x === 14;
        px(x, y, shade([60, 130, 40], (edge ? 0.7 : 1) * (0.9 + R() * 0.2)));
      }
      for (let i = 0; i < 8; i++) px(Math.floor(R() * S), Math.floor(R() * S), [20, 30, 10]);
      break;
    case 'cactus_top': noisy([80, 150, 55], 0.1); border([50, 110, 35]); break;
    case 'planks':
      for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
        const seam = y % 4 === 3 || (x === ((y >> 2) * 5 + 3) % S);
        px(x, y, shade([162, 130, 78], seam ? 0.7 : 0.9 + R() * 0.15));
      }
      break;
    case 'crafting_top':
      drawTile(ctx, ox, 'planks', seed);
      return (() => {
        const d = ctx.getImageData(ox, 0, S, S); img.data.set(d.data);
        for (let i = 2; i < 14; i++) { px(i, 5, [90, 60, 30]); px(i, 10, [90, 60, 30]); px(5, i, [90, 60, 30]); px(10, i, [90, 60, 30]); }
        border([100, 70, 40]);
        ctx.putImageData(img, ox, 0);
      })();
    case 'crafting_side':
      drawTile(ctx, ox, 'planks', seed);
      return (() => {
        const d = ctx.getImageData(ox, 0, S, S); img.data.set(d.data);
        for (let y = 2; y < 8; y++) { px(3, y, [120, 120, 120]); px(4, y, [80, 60, 40]); }
        for (let x = 9; x < 14; x++) { px(x, 3, [140, 140, 140]); px(x, 4, [140, 140, 140]); }
        px(11, 5, [80, 60, 40]); px(11, 6, [80, 60, 40]); px(11, 7, [80, 60, 40]);
        border([100, 70, 40]);
        ctx.putImageData(img, ox, 0);
      })();
    case 'glass':
      for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) px(x, y, [0, 0, 0], 0);
      border([200, 230, 240]);
      px(3, 3, [255, 255, 255]); px(4, 4, [255, 255, 255]); px(4, 3, [230, 245, 250]); px(11, 10, [230, 245, 250]); px(12, 11, [230, 245, 250]);
      break;
    case 'cobble':
      for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
        const cell = ((Math.floor(x / 4) + Math.floor(y / 4) * 3) * 7) % 5;
        const edge = x % 4 === 0 || (y + (Math.floor(x / 4) % 2) * 2) % 4 === 0;
        px(x, y, shade([122, 122, 122], edge ? 0.6 : 0.85 + cell * 0.06 + R() * 0.08));
      }
      break;
    case 'stone_brick':
      for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
        const row = Math.floor(y / 8);
        const edge = y % 8 === 7 || (x + row * 8) % 16 === 15;
        px(x, y, shade(STONE_C, edge ? 0.6 : 0.9 + R() * 0.12));
      }
      break;
    case 'brick':
      for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
        const row = Math.floor(y / 4);
        const mortar = y % 4 === 3 || (x + (row % 2) * 4) % 8 === 7;
        px(x, y, mortar ? shade([200, 195, 185], 0.9 + R() * 0.1) : shade([150, 70, 55], 0.85 + R() * 0.25));
      }
      break;
    case 'coal_ore': speckle(STONE_C, 5, [30, 30, 30], 0.9); break;
    case 'iron_ore': speckle(STONE_C, 5, [216, 175, 147], 0.9); break;
    case 'gold_ore': speckle(STONE_C, 5, [250, 220, 70], 0.9); break;
    case 'diamond_ore': speckle(STONE_C, 5, [90, 230, 225], 0.9); break;
    case 'bookshelf': {
      const cols = [[160, 40, 40], [40, 80, 160], [50, 130, 60], [180, 150, 60], [120, 60, 140]];
      for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
        if (y === 0 || y === 15 || y === 7 || y === 8) px(x, y, shade([162, 130, 78], 0.85 + R() * 0.1));
        else px(x, y, shade(cols[(Math.floor(x / 2) + (y > 7 ? 2 : 0)) % 5], x % 2 ? 0.8 : 1));
      }
      break;
    }
    case 'wool_white': wool([230, 230, 230]); break;
    case 'wool_red': wool([180, 45, 40]); break;
    case 'wool_blue': wool([50, 70, 170]); break;
    case 'wool_yellow': wool([230, 200, 50]); break;
    case 'wool_green': wool([80, 140, 40]); break;
    case 'wool_black': wool([35, 35, 40]); break;
    case 'tnt_side':
      for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
        const band = y >= 5 && y <= 10;
        px(x, y, band ? [230, 230, 220] : shade([200, 50, 40], x % 4 === 0 ? 0.75 : 1));
      }
      // "TNT" letters
      [[2, 6], [3, 6], [4, 6], [3, 7], [3, 8], [3, 9], [6, 6], [6, 7], [6, 8], [6, 9], [7, 7], [8, 8], [9, 6], [9, 7], [9, 8], [9, 9],
        [11, 6], [12, 6], [13, 6], [12, 7], [12, 8], [12, 9]].forEach(([x, y]) => px(x, y, [30, 30, 30]));
      break;
    case 'tnt_top': noisy([200, 50, 40], 0.08); for (let y = 6; y < 10; y++) for (let x = 6; x < 10; x++) px(x, y, [60, 60, 60]); break;
    case 'tnt_bottom': noisy([200, 50, 40], 0.08); break;
    case 'pumpkin_side': case 'pumpkin_face':
      for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) px(x, y, shade([220, 130, 30], (x % 4 === 0 ? 0.8 : 1) * (0.92 + R() * 0.1)));
      if (name === 'pumpkin_face') {
        [[4, 5], [5, 5], [10, 5], [11, 5], [4, 6], [5, 6], [10, 6], [11, 6]].forEach(([x, y]) => px(x, y, [60, 30, 0]));
        for (let x = 3; x < 13; x++) px(x, 10, [60, 30, 0]);
        for (let x = 4; x < 12; x++) px(x, 11, [60, 30, 0]);
      }
      break;
    case 'pumpkin_top': noisy([200, 120, 30], 0.08); px(7, 7, [90, 70, 30]); px(8, 7, [90, 70, 30]); px(7, 8, [90, 70, 30]); px(8, 8, [90, 70, 30]); break;
    case 'glowstone':
      for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) px(x, y, shade([230, 190, 110], 0.75 + R() * 0.4));
      break;
    default: noisy([255, 0, 255], 0);
  }
  ctx.putImageData(img, ox, 0);
}

export function createAtlas() {
  const canvas = document.createElement('canvas');
  canvas.width = S * TILE_COUNT;
  canvas.height = S;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  TILE_NAMES.forEach((n, i) => drawTile(ctx, i * S, n, i + 1));
  const tex = new THREE.CanvasTexture(canvas);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  return { texture: tex, canvas };
}

// Render an isometric block icon for the UI
export function blockIcon(atlasCanvas, id, size = 48) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  const b = BLOCKS[id];
  const [top, side] = b.tiles;
  const front = b.faceTile ?? side;
  const h = size / 2, q = size / 4;
  const face = (tile, m, dark) => {
    ctx.save();
    ctx.setTransform(...m);
    ctx.drawImage(atlasCanvas, tile * S, 0, S, S, 0, 0, S, S);
    if (dark) { ctx.fillStyle = `rgba(0,0,0,${dark})`; ctx.fillRect(0, 0, S, S); }
    ctx.restore();
  };
  const k = h / S;
  // top face
  face(top, [k, q / S, -k, q / S, h, 0], 0);
  // left face
  face(side, [k, q / S, 0, h / S * 1.0, 0, q], 0.25);
  // right face
  face(front, [k, -q / S, 0, h / S * 1.0, h, h], 0.42);
  return c.toDataURL();
}
