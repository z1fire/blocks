import * as THREE from 'three';

// Block ids (0-35 are stable from v1 saves)
export const AIR = 0, GRASS = 1, DIRT = 2, STONE = 3, SAND = 4, WATER = 5, LOG = 6, LEAVES = 7,
  PLANKS = 8, GLASS = 9, COBBLE = 10, BRICK = 11, SNOW = 12, BEDROCK = 13, GRAVEL = 14,
  COAL_ORE = 15, IRON_ORE = 16, GOLD_ORE = 17, DIAMOND_ORE = 18, BOOKSHELF = 19, WOOL_WHITE = 20,
  WOOL_RED = 21, WOOL_BLUE = 22, WOOL_YELLOW = 23, WOOL_GREEN = 24, WOOL_BLACK = 25, TNT = 26,
  STONE_BRICK = 27, CACTUS = 28, PUMPKIN = 29, CRAFTING = 30, BIRCH_LOG = 31, BIRCH_LEAVES = 32,
  GLOWSTONE = 33, OBSIDIAN = 34, ICE = 35,
  TALL_GRASS = 36, POPPY = 37, DANDELION = 38, DEAD_BUSH = 39, SAPLING = 40, TORCH = 41, LAVA = 42,
  FURNACE = 43, BED = 44, RED_MUSHROOM = 45, BROWN_MUSHROOM = 46, FARMLAND = 47,
  WHEAT_0 = 48, WHEAT_1 = 49, WHEAT_2 = 50, WHEAT_3 = 51, GOLD_BLOCK = 52, IRON_BLOCK = 53,
  DIAMOND_BLOCK = 54, SANDSTONE = 55, MOSSY_COBBLE = 56, SPRUCE_LOG = 57, SPRUCE_LEAVES = 58,
  MELON = 59, JACK_O_LANTERN = 60, CLAY = 61, STONE_SLAB = 62, PLANK_SLAB = 63, WOOL_ORANGE = 64,
  WOOL_PURPLE = 65, WOOL_CYAN = 66, WOOL_PINK = 67, WOOL_LIME = 68, WOOL_GRAY = 69,
  SPRUCE_PLANKS = 70, BIRCH_PLANKS = 71, SNOW_BLOCK = 72;

// Item ids referenced by block drops (defined fully in items.js)
export const I = {
  STICK: 256, COAL: 257, IRON_INGOT: 258, GOLD_INGOT: 259, DIAMOND: 260,
  SEEDS: 278, WHEAT: 279, APPLE: 287, MELON_SLICE: 291, CLAY_BALL: 292,
};

// Texture tile names, in atlas order
const TILE_NAMES = [
  'grass_top', 'grass_side', 'dirt', 'stone', 'sand', 'water', 'log_side', 'log_top', 'leaves',
  'planks', 'glass', 'cobble', 'brick', 'snow', 'bedrock', 'gravel', 'coal_ore', 'iron_ore',
  'gold_ore', 'diamond_ore', 'bookshelf', 'wool_white', 'wool_red', 'wool_blue', 'wool_yellow',
  'wool_green', 'wool_black', 'tnt_side', 'tnt_top', 'tnt_bottom', 'stone_brick', 'cactus_side',
  'cactus_top', 'pumpkin_side', 'pumpkin_top', 'pumpkin_face', 'crafting_top', 'crafting_side',
  'birch_side', 'birch_top', 'birch_leaves', 'glowstone', 'obsidian', 'ice', 'snow_side',
  'tall_grass', 'poppy', 'dandelion', 'dead_bush', 'sapling', 'torch', 'lava', 'furnace_front',
  'furnace_side', 'furnace_top', 'bed_top', 'bed_side', 'red_mushroom', 'brown_mushroom', 'farmland',
  'wheat0', 'wheat1', 'wheat2', 'wheat3', 'gold_block', 'iron_block', 'diamond_block',
  'sandstone_top', 'sandstone_side', 'mossy_cobble', 'spruce_side', 'spruce_top', 'spruce_leaves',
  'melon_side', 'melon_top', 'jack_face', 'clay', 'wool_orange', 'wool_purple', 'wool_cyan',
  'wool_pink', 'wool_lime', 'wool_gray', 'spruce_planks', 'birch_planks', 'slab_side', 'plank_slab_side',
];
export const TILE = Object.fromEntries(TILE_NAMES.map((n, i) => [n, i]));
export const TILE_COUNT = TILE_NAMES.length;

const BASE = {
  opaque: true, solid: true, model: 'cube', hardness: 1, tool: null, tier: 0, light: 0, filter: 0,
};
function def(id, name, top, side = top, bottom = top, opts = {}) {
  BLOCKS[id] = { ...BASE, id, name, tiles: [TILE[top], TILE[side], TILE[bottom]], ...opts };
}
const plant = { opaque: false, solid: false, model: 'cross', hardness: 0, replaceable: true, needsSupport: true };
const leaves = { opaque: false, foliage: true, hardness: 0.2, filter: 1, tool: 'hoe' };
const wood = { hardness: 2, tool: 'axe' };
const rock = { hardness: 1.5, tool: 'pickaxe', tier: 1 };
const soil = { hardness: 0.5, tool: 'shovel' };
const wool = { hardness: 0.8 };

export const BLOCKS = [];
BLOCKS[AIR] = { ...BASE, id: 0, name: 'Air', opaque: false, solid: false, model: 'none', replaceable: true, tiles: [0, 0, 0] };
def(GRASS, 'Grass Block', 'grass_top', 'grass_side', 'dirt', { ...soil, hardness: 0.6, drops: DIRT });
def(DIRT, 'Dirt', 'dirt', 'dirt', 'dirt', soil);
def(STONE, 'Stone', 'stone', 'stone', 'stone', { ...rock, drops: COBBLE });
def(SAND, 'Sand', 'sand', 'sand', 'sand', { ...soil, gravity: true });
def(WATER, 'Water', 'water', 'water', 'water', { opaque: false, solid: false, model: 'liquid', liquid: true, replaceable: true, filter: 2, hardness: Infinity });
def(LOG, 'Oak Log', 'log_top', 'log_side', 'log_top', wood);
def(LEAVES, 'Oak Leaves', 'leaves', 'leaves', 'leaves', { ...leaves, drops: (r) => r < 0.06 ? [[SAPLING, 1]] : r < 0.1 ? [[I.APPLE, 1]] : [] });
def(PLANKS, 'Oak Planks', 'planks', 'planks', 'planks', wood);
def(GLASS, 'Glass', 'glass', 'glass', 'glass', { opaque: false, glass: true, hardness: 0.3, drops: 0 });
def(COBBLE, 'Cobblestone', 'cobble', 'cobble', 'cobble', { ...rock, hardness: 2 });
def(BRICK, 'Bricks', 'brick', 'brick', 'brick', { ...rock, hardness: 2 });
def(SNOW, 'Snowy Grass', 'snow', 'snow_side', 'dirt', { ...soil, hardness: 0.6, drops: DIRT });
def(BEDROCK, 'Bedrock', 'bedrock', 'bedrock', 'bedrock', { hardness: Infinity, unbreakable: true });
def(GRAVEL, 'Gravel', 'gravel', 'gravel', 'gravel', { ...soil, hardness: 0.6, gravity: true });
def(COAL_ORE, 'Coal Ore', 'coal_ore', 'coal_ore', 'coal_ore', { ...rock, hardness: 3, drops: I.COAL });
def(IRON_ORE, 'Iron Ore', 'iron_ore', 'iron_ore', 'iron_ore', { ...rock, hardness: 3, tier: 2 });
def(GOLD_ORE, 'Gold Ore', 'gold_ore', 'gold_ore', 'gold_ore', { ...rock, hardness: 3, tier: 3 });
def(DIAMOND_ORE, 'Diamond Ore', 'diamond_ore', 'diamond_ore', 'diamond_ore', { ...rock, hardness: 3, tier: 3, drops: I.DIAMOND });
def(BOOKSHELF, 'Bookshelf', 'planks', 'bookshelf', 'planks', { ...wood, hardness: 1.5 });
def(WOOL_WHITE, 'White Wool', 'wool_white', 'wool_white', 'wool_white', wool);
def(WOOL_RED, 'Red Wool', 'wool_red', 'wool_red', 'wool_red', wool);
def(WOOL_BLUE, 'Blue Wool', 'wool_blue', 'wool_blue', 'wool_blue', wool);
def(WOOL_YELLOW, 'Yellow Wool', 'wool_yellow', 'wool_yellow', 'wool_yellow', wool);
def(WOOL_GREEN, 'Green Wool', 'wool_green', 'wool_green', 'wool_green', wool);
def(WOOL_BLACK, 'Black Wool', 'wool_black', 'wool_black', 'wool_black', wool);
def(TNT, 'TNT', 'tnt_top', 'tnt_side', 'tnt_bottom', { hardness: 0, use: 'tnt' });
def(STONE_BRICK, 'Stone Bricks', 'stone_brick', 'stone_brick', 'stone_brick', rock);
def(CACTUS, 'Cactus', 'cactus_top', 'cactus_side', 'cactus_top', { hardness: 0.4, hurts: true });
def(PUMPKIN, 'Pumpkin', 'pumpkin_top', 'pumpkin_side', 'pumpkin_top', { hardness: 1, tool: 'axe', faceTile: TILE.pumpkin_face });
def(CRAFTING, 'Crafting Table', 'crafting_top', 'crafting_side', 'planks', { ...wood, hardness: 2.5, use: 'craft' });
def(BIRCH_LOG, 'Birch Log', 'birch_top', 'birch_side', 'birch_top', wood);
def(BIRCH_LEAVES, 'Birch Leaves', 'birch_leaves', 'birch_leaves', 'birch_leaves', { ...leaves, drops: (r) => r < 0.06 ? [[SAPLING, 1]] : [] });
def(GLOWSTONE, 'Glowstone', 'glowstone', 'glowstone', 'glowstone', { hardness: 0.3, light: 15 });
def(OBSIDIAN, 'Obsidian', 'obsidian', 'obsidian', 'obsidian', { hardness: 25, tool: 'pickaxe', tier: 4 });
def(ICE, 'Ice', 'ice', 'ice', 'ice', { opaque: false, glass: true, hardness: 0.5, filter: 1, drops: 0, tool: 'pickaxe' });
def(TALL_GRASS, 'Tall Grass', 'tall_grass', 'tall_grass', 'tall_grass', { ...plant, drops: (r) => r < 0.15 ? [[I.SEEDS, 1]] : [] });
def(POPPY, 'Poppy', 'poppy', 'poppy', 'poppy', plant);
def(DANDELION, 'Dandelion', 'dandelion', 'dandelion', 'dandelion', plant);
def(DEAD_BUSH, 'Dead Bush', 'dead_bush', 'dead_bush', 'dead_bush', { ...plant, drops: (r) => r < 0.5 ? [[I.STICK, 1]] : [] });
def(SAPLING, 'Sapling', 'sapling', 'sapling', 'sapling', { ...plant, replaceable: false, tick: 'sapling' });
def(TORCH, 'Torch', 'torch', 'torch', 'torch', { opaque: false, solid: false, model: 'torch', hardness: 0, light: 14, needsSupport: true });
def(LAVA, 'Lava', 'lava', 'lava', 'lava', { opaque: false, solid: false, model: 'liquid', liquid: true, replaceable: true, light: 15, hardness: Infinity, filter: 15 });
def(FURNACE, 'Furnace', 'furnace_top', 'furnace_side', 'furnace_top', { ...rock, hardness: 3.5, faceTile: TILE.furnace_front, use: 'furnace' });
def(BED, 'Bed', 'bed_top', 'bed_side', 'planks', { opaque: false, model: 'box', box: [0, 0, 0, 1, 9 / 16, 1], hardness: 0.2, use: 'bed' });
def(RED_MUSHROOM, 'Red Mushroom', 'red_mushroom', 'red_mushroom', 'red_mushroom', { ...plant, light: 0 });
def(BROWN_MUSHROOM, 'Brown Mushroom', 'brown_mushroom', 'brown_mushroom', 'brown_mushroom', { ...plant, light: 1 });
def(FARMLAND, 'Farmland', 'farmland', 'dirt', 'dirt', { ...soil, hardness: 0.6, drops: DIRT });
def(WHEAT_0, 'Wheat Crop', 'wheat0', 'wheat0', 'wheat0', { ...plant, replaceable: false, tick: 'crop', next: WHEAT_1, drops: [[I.SEEDS, 1]] });
def(WHEAT_1, 'Wheat Crop', 'wheat1', 'wheat1', 'wheat1', { ...plant, replaceable: false, tick: 'crop', next: WHEAT_2, drops: [[I.SEEDS, 1]] });
def(WHEAT_2, 'Wheat Crop', 'wheat2', 'wheat2', 'wheat2', { ...plant, replaceable: false, tick: 'crop', next: WHEAT_3, drops: [[I.SEEDS, 1]] });
def(WHEAT_3, 'Wheat', 'wheat3', 'wheat3', 'wheat3', { ...plant, replaceable: false, drops: (r) => [[I.WHEAT, 1], [I.SEEDS, 1 + Math.floor(r * 3)]] });
def(GOLD_BLOCK, 'Gold Block', 'gold_block', 'gold_block', 'gold_block', { ...rock, hardness: 3, tier: 3 });
def(IRON_BLOCK, 'Iron Block', 'iron_block', 'iron_block', 'iron_block', { ...rock, hardness: 5, tier: 2 });
def(DIAMOND_BLOCK, 'Diamond Block', 'diamond_block', 'diamond_block', 'diamond_block', { ...rock, hardness: 5, tier: 3 });
def(SANDSTONE, 'Sandstone', 'sandstone_top', 'sandstone_side', 'sandstone_top', { ...rock, hardness: 0.8 });
def(MOSSY_COBBLE, 'Mossy Cobblestone', 'mossy_cobble', 'mossy_cobble', 'mossy_cobble', { ...rock, hardness: 2 });
def(SPRUCE_LOG, 'Spruce Log', 'spruce_top', 'spruce_side', 'spruce_top', wood);
def(SPRUCE_LEAVES, 'Spruce Leaves', 'spruce_leaves', 'spruce_leaves', 'spruce_leaves', { ...leaves, drops: (r) => r < 0.06 ? [[SAPLING, 1]] : [] });
def(MELON, 'Melon', 'melon_top', 'melon_side', 'melon_top', { hardness: 1, tool: 'axe', drops: (r) => [[I.MELON_SLICE, 3 + Math.floor(r * 5)]] });
def(JACK_O_LANTERN, "Jack o'Lantern", 'pumpkin_top', 'pumpkin_side', 'pumpkin_top', { hardness: 1, tool: 'axe', faceTile: TILE.jack_face, light: 15 });
def(CLAY, 'Clay', 'clay', 'clay', 'clay', { ...soil, hardness: 0.6, drops: [[I.CLAY_BALL, 4]] });
def(STONE_SLAB, 'Stone Slab', 'stone', 'slab_side', 'stone', { ...rock, hardness: 2, opaque: false, model: 'box', box: [0, 0, 0, 1, 0.5, 1] });
def(PLANK_SLAB, 'Oak Slab', 'planks', 'plank_slab_side', 'planks', { ...wood, opaque: false, model: 'box', box: [0, 0, 0, 1, 0.5, 1] });
def(WOOL_ORANGE, 'Orange Wool', 'wool_orange', 'wool_orange', 'wool_orange', wool);
def(WOOL_PURPLE, 'Purple Wool', 'wool_purple', 'wool_purple', 'wool_purple', wool);
def(WOOL_CYAN, 'Cyan Wool', 'wool_cyan', 'wool_cyan', 'wool_cyan', wool);
def(WOOL_PINK, 'Pink Wool', 'wool_pink', 'wool_pink', 'wool_pink', wool);
def(WOOL_LIME, 'Lime Wool', 'wool_lime', 'wool_lime', 'wool_lime', wool);
def(WOOL_GRAY, 'Gray Wool', 'wool_gray', 'wool_gray', 'wool_gray', wool);
def(SPRUCE_PLANKS, 'Spruce Planks', 'spruce_planks', 'spruce_planks', 'spruce_planks', wood);
def(BIRCH_PLANKS, 'Birch Planks', 'birch_planks', 'birch_planks', 'birch_planks', wood);
def(SNOW_BLOCK, 'Snow Block', 'snow', 'snow', 'snow', { ...soil, hardness: 0.2 });

export const BLOCK_COUNT = BLOCKS.length;

// Fast lookup tables for hot loops
export const OPAQUE = new Uint8Array(256);
export const SOLID = new Uint8Array(256);
export const LIGHT = new Uint8Array(256);
export const FILTER = new Uint8Array(256);
export const HEIGHT = new Float32Array(256).fill(1); // collision height
for (const b of BLOCKS) {
  if (!b) continue;
  OPAQUE[b.id] = b.opaque ? 1 : 0;
  SOLID[b.id] = b.solid ? 1 : 0;
  LIGHT[b.id] = b.light;
  FILTER[b.id] = b.filter;
  if (b.model === 'box') HEIGHT[b.id] = b.box[4];
}

// Blocks shown in the creative inventory, in order
export const CREATIVE_BLOCKS = [
  GRASS, DIRT, STONE, COBBLE, MOSSY_COBBLE, STONE_BRICK, SAND, SANDSTONE, GRAVEL, CLAY, SNOW, SNOW_BLOCK, ICE,
  LOG, BIRCH_LOG, SPRUCE_LOG, PLANKS, BIRCH_PLANKS, SPRUCE_PLANKS, STONE_SLAB, PLANK_SLAB,
  LEAVES, BIRCH_LEAVES, SPRUCE_LEAVES, GLASS, BRICK, BOOKSHELF, CRAFTING, FURNACE, BED, TORCH,
  GLOWSTONE, JACK_O_LANTERN, PUMPKIN, MELON, CACTUS, TALL_GRASS, POPPY, DANDELION, DEAD_BUSH,
  SAPLING, RED_MUSHROOM, BROWN_MUSHROOM, FARMLAND, COAL_ORE, IRON_ORE, GOLD_ORE, DIAMOND_ORE,
  IRON_BLOCK, GOLD_BLOCK, DIAMOND_BLOCK, OBSIDIAN, TNT, WOOL_WHITE, WOOL_GRAY, WOOL_BLACK, WOOL_RED,
  WOOL_ORANGE, WOOL_YELLOW, WOOL_LIME, WOOL_GREEN, WOOL_CYAN, WOOL_BLUE, WOOL_PURPLE, WOOL_PINK,
  WATER, LAVA, BEDROCK,
];

export const isOpaque = (id) => OPAQUE[id] === 1;
export const isSolid = (id) => SOLID[id] === 1;

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

export function shade([r, g, b], f) {
  return [Math.max(0, Math.min(255, r * f)), Math.max(0, Math.min(255, g * f)), Math.max(0, Math.min(255, b * f))];
}

// Painter for one 16x16 tile
function painter(seed) {
  const img = new ImageData(S, S);
  const R = rng(seed * 9973 + 17);
  const p = {
    img, R,
    px(x, y, c, a = 255) {
      if (x < 0 || y < 0 || x >= S || y >= S) return;
      const i = (y * S + x) * 4;
      img.data[i] = c[0]; img.data[i + 1] = c[1]; img.data[i + 2] = c[2]; img.data[i + 3] = a;
    },
    get(x, y) { const i = (y * S + x) * 4; return [img.data[i], img.data[i + 1], img.data[i + 2]]; },
    clear() { img.data.fill(0); },
    noisy(base, amt = 0.15) {
      for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) p.px(x, y, shade(base, 1 - amt + R() * amt * 2));
    },
    speckle(base, spots, spotCol, chance) {
      p.noisy(base, 0.12);
      for (let i = 0; i < spots; i++) {
        const cx = Math.floor(R() * S), cy = Math.floor(R() * S);
        for (let dy = 0; dy < 2; dy++) for (let dx = 0; dx < 2; dx++) {
          if (R() < chance) p.px((cx + dx) % S, (cy + dy) % S, shade(spotCol, 0.85 + R() * 0.3));
        }
      }
    },
    border(c) { for (let i = 0; i < S; i++) { p.px(i, 0, c); p.px(i, S - 1, c); p.px(0, i, c); p.px(S - 1, i, c); } },
    wool(c) {
      for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
        const f = 0.9 + ((x + y * 3) % 4 === 0 ? -0.08 : 0) + R() * 0.12;
        p.px(x, y, shade(c, f));
      }
    },
    planks(c) {
      for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
        const seam = y % 4 === 3 || (x === ((y >> 2) * 5 + 3) % S);
        p.px(x, y, shade(c, seam ? 0.7 : 0.9 + R() * 0.15));
      }
    },
    cobble(c) {
      for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
        const cell = ((Math.floor(x / 4) + Math.floor(y / 4) * 3) * 7) % 5;
        const edge = x % 4 === 0 || (y + (Math.floor(x / 4) % 2) * 2) % 4 === 0;
        p.px(x, y, shade(c, edge ? 0.6 : 0.85 + cell * 0.06 + R() * 0.08));
      }
    },
    logSide(c, birch) {
      for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
        const stripe = (x % 4 === 0) ? 0.8 : 1;
        p.px(x, y, shade(c, stripe * (0.9 + R() * 0.2)));
      }
      if (birch) for (let i = 0; i < 7; i++) {
        const y = Math.floor(R() * S), x = Math.floor(R() * 12);
        for (let d = 0; d < 3 + R() * 3; d++) p.px(Math.min(S - 1, x + d), y, [40, 40, 40]);
      }
    },
    logTop(inner, bark) {
      for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
        const d = Math.max(Math.abs(x - 7.5), Math.abs(y - 7.5));
        const ring = Math.floor(d) % 2 === 0 ? 0.88 : 1;
        p.px(x, y, d > 6.5 ? bark : shade(inner, ring * (0.95 + R() * 0.1)));
      }
    },
    leaves(c) {
      for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
        if (R() < 0.18) p.px(x, y, [0, 0, 0], 0);
        else p.px(x, y, shade(c, 0.7 + R() * 0.5));
      }
    },
    metal(c) {
      for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
        const edge = x === 0 || y === 0 ? 1.25 : x === 15 || y === 15 ? 0.7 : 1;
        const hl = (x + y) % 7 === 0 ? 1.1 : 1;
        p.px(x, y, shade(c, edge * hl * (0.95 + R() * 0.08)));
      }
    },
    stem(x, y0, y1, c) { for (let y = y0; y <= y1; y++) p.px(x, y, shade(c, 0.85 + R() * 0.3)); },
    blob(cx, cy, r, c) {
      for (let y = -r; y <= r; y++) for (let x = -r; x <= r; x++) {
        if (x * x + y * y <= r * r + 0.5) p.px(cx + x, cy + y, shade(c, 0.85 + R() * 0.3));
      }
    },
  };
  return p;
}

const GRASS_C = [106, 170, 64], DIRT_C = [134, 96, 67], STONE_C = [125, 125, 125], PLANK_C = [162, 130, 78];

function paintTile(name, seed) {
  const p = painter(seed);
  const { px, R } = p;
  switch (name) {
    case 'grass_top': p.noisy(GRASS_C, 0.18); break;
    case 'grass_side': case 'snow_side': {
      p.noisy(DIRT_C, 0.15);
      const top = name === 'grass_side' ? GRASS_C : [240, 250, 255];
      for (let x = 0; x < S; x++) {
        const d = 3 + Math.floor(R() * 3);
        for (let y = 0; y < d; y++) px(x, y, shade(top, 0.88 + R() * 0.2));
      }
      break;
    }
    case 'dirt': p.speckle(DIRT_C, 10, [100, 70, 50], 0.6); break;
    case 'farmland':
      for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) px(x, y, shade([96, 64, 40], (y % 4 === 0 ? 0.7 : 1) * (0.85 + R() * 0.25)));
      break;
    case 'stone': p.speckle(STONE_C, 12, [105, 105, 105], 0.5); break;
    case 'slab_side':
      p.speckle(STONE_C, 12, [105, 105, 105], 0.5);
      for (let x = 0; x < S; x++) { px(x, 8, [90, 90, 90]); px(x, 15, [95, 95, 95]); }
      break;
    case 'plank_slab_side': p.planks(PLANK_C); break;
    case 'sand': p.noisy([219, 207, 163], 0.07); break;
    case 'sandstone_top': p.noisy([216, 203, 155], 0.05); p.border([196, 183, 135]); break;
    case 'sandstone_side':
      for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
        const band = y < 3 ? 1.05 : y > 12 ? 0.85 : (y === 6 || y === 9) ? 0.9 : 1;
        px(x, y, shade([216, 203, 155], band * (0.96 + R() * 0.06)));
      }
      break;
    case 'gravel': p.speckle([130, 124, 122], 20, [95, 90, 90], 0.7); break;
    case 'clay': p.speckle([160, 166, 179], 8, [140, 146, 160], 0.6); break;
    case 'water': p.noisy([48, 96, 220], 0.08); break;
    case 'lava':
      for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
        const v = Math.sin(x * 0.9 + y * 0.4) + Math.cos(y * 0.8 - x * 0.3) + R() * 0.8;
        px(x, y, v > 1.2 ? [255, 220, 90] : v > 0.2 ? [240, 120, 20] : [200, 70, 10]);
      }
      break;
    case 'snow': p.noisy([240, 250, 255], 0.04); break;
    case 'ice': p.noisy([160, 200, 255], 0.05); for (let i = 0; i < 6; i++) px(3 + i, 4 + (i >> 1), [230, 240, 255]); break;
    case 'bedrock': p.speckle([85, 85, 85], 25, [30, 30, 30], 0.8); break;
    case 'obsidian': p.speckle([20, 16, 32], 14, [60, 40, 90], 0.5); break;
    case 'log_side': p.logSide([102, 81, 51]); break;
    case 'birch_side': p.logSide([215, 215, 205], true); break;
    case 'spruce_side': p.logSide([70, 50, 30]); break;
    case 'log_top': p.logTop([160, 130, 80], [102, 81, 51]); break;
    case 'birch_top': p.logTop([200, 190, 150], [215, 215, 205]); break;
    case 'spruce_top': p.logTop([120, 90, 55], [70, 50, 30]); break;
    case 'leaves': p.leaves([58, 130, 40]); break;
    case 'birch_leaves': p.leaves([110, 160, 70]); break;
    case 'spruce_leaves': p.leaves([45, 95, 60]); break;
    case 'cactus_side':
      for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
        const edge = x === 1 || x === 14;
        px(x, y, shade([60, 130, 40], (edge ? 0.7 : 1) * (0.9 + R() * 0.2)));
      }
      for (let i = 0; i < 8; i++) px(Math.floor(R() * S), Math.floor(R() * S), [20, 30, 10]);
      break;
    case 'cactus_top': p.noisy([80, 150, 55], 0.1); p.border([50, 110, 35]); break;
    case 'planks': p.planks(PLANK_C); break;
    case 'spruce_planks': p.planks([110, 80, 50]); break;
    case 'birch_planks': p.planks([200, 180, 125]); break;
    case 'crafting_top':
      p.planks(PLANK_C);
      for (let i = 2; i < 14; i++) { px(i, 5, [90, 60, 30]); px(i, 10, [90, 60, 30]); px(5, i, [90, 60, 30]); px(10, i, [90, 60, 30]); }
      p.border([100, 70, 40]);
      break;
    case 'crafting_side':
      p.planks(PLANK_C);
      for (let y = 2; y < 8; y++) { px(3, y, [120, 120, 120]); px(4, y, [80, 60, 40]); }
      for (let x = 9; x < 14; x++) { px(x, 3, [140, 140, 140]); px(x, 4, [140, 140, 140]); }
      px(11, 5, [80, 60, 40]); px(11, 6, [80, 60, 40]); px(11, 7, [80, 60, 40]);
      p.border([100, 70, 40]);
      break;
    case 'furnace_side': p.cobble([120, 120, 120]); p.border([80, 80, 80]); break;
    case 'furnace_top': p.speckle([110, 110, 110], 8, [90, 90, 90], 0.5); p.border([80, 80, 80]); break;
    case 'furnace_front':
      p.cobble([120, 120, 120]); p.border([80, 80, 80]);
      for (let y = 8; y < 14; y++) for (let x = 4; x < 12; x++) px(x, y, y > 11 ? [230, 120 + R() * 60, 30] : [25, 22, 20]);
      for (let x = 3; x < 13; x++) px(x, 7, [70, 70, 70]);
      break;
    case 'glass':
      p.clear();
      p.border([200, 230, 240]);
      px(3, 3, [255, 255, 255]); px(4, 4, [255, 255, 255]); px(4, 3, [230, 245, 250]); px(11, 10, [230, 245, 250]); px(12, 11, [230, 245, 250]);
      break;
    case 'cobble': p.cobble([122, 122, 122]); break;
    case 'mossy_cobble':
      p.cobble([122, 122, 122]);
      for (let i = 0; i < 40; i++) { const x = Math.floor(R() * S), y = Math.floor(R() * S); px(x, y, shade([80, 120, 60], 0.8 + R() * 0.3)); }
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
    case 'coal_ore': p.speckle(STONE_C, 5, [30, 30, 30], 0.9); break;
    case 'iron_ore': p.speckle(STONE_C, 5, [216, 175, 147], 0.9); break;
    case 'gold_ore': p.speckle(STONE_C, 5, [250, 220, 70], 0.9); break;
    case 'diamond_ore': p.speckle(STONE_C, 5, [90, 230, 225], 0.9); break;
    case 'gold_block': p.metal([240, 200, 60]); break;
    case 'iron_block': p.metal([215, 215, 215]); break;
    case 'diamond_block': p.metal([100, 225, 220]); break;
    case 'bookshelf': {
      const cols = [[160, 40, 40], [40, 80, 160], [50, 130, 60], [180, 150, 60], [120, 60, 140]];
      for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
        if (y === 0 || y === 15 || y === 7 || y === 8) px(x, y, shade(PLANK_C, 0.85 + R() * 0.1));
        else px(x, y, shade(cols[(Math.floor(x / 2) + (y > 7 ? 2 : 0)) % 5], x % 2 ? 0.8 : 1));
      }
      break;
    }
    case 'wool_white': p.wool([230, 230, 230]); break;
    case 'wool_red': p.wool([180, 45, 40]); break;
    case 'wool_blue': p.wool([50, 70, 170]); break;
    case 'wool_yellow': p.wool([230, 200, 50]); break;
    case 'wool_green': p.wool([80, 110, 30]); break;
    case 'wool_black': p.wool([35, 35, 40]); break;
    case 'wool_orange': p.wool([235, 130, 40]); break;
    case 'wool_purple': p.wool([130, 50, 170]); break;
    case 'wool_cyan': p.wool([30, 140, 150]); break;
    case 'wool_pink': p.wool([240, 150, 180]); break;
    case 'wool_lime': p.wool([120, 200, 40]); break;
    case 'wool_gray': p.wool([90, 90, 95]); break;
    case 'tnt_side':
      for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
        const band = y >= 5 && y <= 10;
        px(x, y, band ? [230, 230, 220] : shade([200, 50, 40], x % 4 === 0 ? 0.75 : 1));
      }
      [[2, 6], [3, 6], [4, 6], [3, 7], [3, 8], [3, 9], [6, 6], [6, 7], [6, 8], [6, 9], [7, 7], [8, 8], [9, 6], [9, 7], [9, 8], [9, 9],
        [11, 6], [12, 6], [13, 6], [12, 7], [12, 8], [12, 9]].forEach(([x, y]) => px(x, y, [30, 30, 30]));
      break;
    case 'tnt_top': p.noisy([200, 50, 40], 0.08); for (let y = 6; y < 10; y++) for (let x = 6; x < 10; x++) px(x, y, [60, 60, 60]); break;
    case 'tnt_bottom': p.noisy([200, 50, 40], 0.08); break;
    case 'pumpkin_side': case 'pumpkin_face': case 'jack_face':
      for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) px(x, y, shade([220, 130, 30], (x % 4 === 0 ? 0.8 : 1) * (0.92 + R() * 0.1)));
      if (name !== 'pumpkin_side') {
        const c = name === 'jack_face' ? [255, 230, 90] : [60, 30, 0];
        [[4, 5], [5, 5], [10, 5], [11, 5], [4, 6], [5, 6], [10, 6], [11, 6]].forEach(([x, y]) => px(x, y, c));
        for (let x = 3; x < 13; x++) px(x, 10, c);
        for (let x = 4; x < 12; x++) px(x, 11, c);
      }
      break;
    case 'pumpkin_top': p.noisy([200, 120, 30], 0.08); px(7, 7, [90, 70, 30]); px(8, 7, [90, 70, 30]); px(7, 8, [90, 70, 30]); px(8, 8, [90, 70, 30]); break;
    case 'melon_side':
      for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) px(x, y, shade([100, 160, 40], ((x + (y >> 2)) % 4 === 0 ? 0.65 : 1) * (0.9 + R() * 0.15)));
      break;
    case 'melon_top': p.noisy([110, 160, 45], 0.1); p.blob(8, 8, 2, [80, 120, 30]); break;
    case 'glowstone':
      for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) px(x, y, shade([230, 190, 110], 0.75 + R() * 0.4));
      break;
    case 'bed_top':
      for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
        if (y < 5) px(x, y, shade([235, 235, 235], 0.92 + R() * 0.08));
        else px(x, y, shade([170, 30, 35], (x === 0 || x === 15 ? 0.8 : 1) * (0.9 + R() * 0.12)));
      }
      break;
    case 'bed_side':
      p.clear();
      for (let x = 0; x < S; x++) {
        for (let y = 7; y < 11; y++) px(x, y, shade(x < 5 ? [235, 235, 235] : [170, 30, 35], 0.9 + R() * 0.1));
        for (let y = 11; y < 13; y++) px(x, y, shade(PLANK_C, 0.85 + R() * 0.1));
      }
      for (let y = 13; y < 16; y++) for (const x of [0, 1, 14, 15]) px(x, y, shade(PLANK_C, 0.75));
      break;
    // ----- cutout sprites -----
    case 'tall_grass':
      p.clear();
      for (let i = 0; i < 9; i++) {
        const x = 1 + Math.floor(R() * 14), h = 5 + Math.floor(R() * 9);
        for (let y = 15; y > 15 - h; y--) px(x + ((15 - y) > h / 2 && i % 2 ? 1 : 0), y, shade(GRASS_C, 0.7 + R() * 0.45));
      }
      break;
    case 'poppy': case 'dandelion': {
      p.clear();
      p.stem(7, 8, 15, [60, 130, 40]);
      px(6, 12, [60, 130, 40]); px(5, 11, [60, 130, 40]); px(8, 13, [60, 130, 40]); px(9, 12, [60, 130, 40]);
      const c = name === 'poppy' ? [210, 30, 30] : [245, 215, 40];
      p.blob(7, 6, 2, c);
      px(7, 6, name === 'poppy' ? [30, 20, 10] : [230, 160, 20]);
      break;
    }
    case 'dead_bush':
      p.clear();
      p.stem(7, 9, 15, [120, 85, 45]);
      for (let i = 0; i < 5; i++) { px(6 - i, 9 - i, [120, 85, 45]); px(8 + i, 10 - i, [120, 85, 45]); px(5 + i, 12 - (i >> 1), [110, 80, 40]); }
      break;
    case 'sapling':
      p.clear();
      p.stem(7, 9, 15, [102, 81, 51]);
      p.blob(7, 6, 3, [58, 130, 40]);
      p.blob(5, 9, 1, [58, 130, 40]);
      p.blob(10, 8, 1, [58, 130, 40]);
      break;
    case 'red_mushroom': case 'brown_mushroom':
      p.clear();
      p.stem(7, 9, 15, [220, 215, 200]); p.stem(8, 9, 15, [200, 195, 180]);
      for (let y = 5; y < 10; y++) for (let x = 3; x < 13; x++) {
        if ((y === 5 && (x < 5 || x > 10)) || (y === 6 && (x < 4 || x > 11))) continue;
        px(x, y, name === 'red_mushroom' ? ((x + y) % 5 === 0 ? [240, 240, 240] : [200, 30, 30]) : shade([150, 110, 80], 0.9 + R() * 0.2));
      }
      break;
    case 'torch':
      p.clear();
      for (let y = 8; y < 16; y++) { px(7, y, [120, 90, 50]); px(8, y, [100, 75, 40]); }
      px(7, 6, [255, 240, 150]); px(8, 6, [255, 200, 60]); px(7, 7, [255, 170, 40]); px(8, 7, [255, 220, 90]);
      px(7, 8, [230, 120, 30]); px(8, 8, [200, 90, 20]);
      break;
    case 'wheat0': case 'wheat1': case 'wheat2': case 'wheat3': {
      p.clear();
      const stage = +name[5];
      const h = [3, 6, 10, 13][stage];
      const col = stage === 3 ? [210, 180, 80] : [80, 160, 40];
      for (let x = 1; x < 16; x += 3) {
        for (let y = 15; y > 15 - h; y--) px(x + (y % 3 === 0 ? 1 : 0), y, shade(col, 0.8 + R() * 0.35));
        if (stage === 3) { px(x, 15 - h, [180, 140, 50]); px(x + 1, 16 - h, [180, 140, 50]); }
      }
      break;
    }
    default: p.noisy([255, 0, 255], 0);
  }
  return p.img;
}

export function createAtlas() {
  const canvas = document.createElement('canvas');
  canvas.width = S * TILE_COUNT;
  canvas.height = S;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  TILE_NAMES.forEach((n, i) => ctx.putImageData(paintTile(n, i + 1), i * S, 0));
  const tex = new THREE.CanvasTexture(canvas);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  return { texture: tex, canvas };
}

// Isometric block icon (or flat sprite for plants) for the UI
export function blockIcon(atlasCanvas, id, size = 48) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  const b = BLOCKS[id];
  if (b.model === 'cross' || b.model === 'torch') {
    ctx.drawImage(atlasCanvas, b.tiles[1] * S, 0, S, S, size * 0.1, size * 0.1, size * 0.8, size * 0.8);
    return c.toDataURL();
  }
  const [top, side] = b.tiles;
  const front = b.faceTile ?? side;
  const f = b.model === 'box' ? b.box[4] : 1;
  const h = size / 2, q = size / 4, k = h / S;
  const drop = (1 - f) * h;
  const face = (tile, m, dark, srcY = 0) => {
    ctx.save();
    ctx.setTransform(...m);
    ctx.drawImage(atlasCanvas, tile * S, srcY, S, S - srcY, 0, srcY, S, S - srcY);
    if (dark) { ctx.fillStyle = `rgba(0,0,0,${dark})`; ctx.fillRect(0, srcY, S, S - srcY); }
    ctx.restore();
  };
  const srcY = Math.round((1 - f) * S);
  face(top, [k, q / S, -k, q / S, h, drop], 0);
  face(side, [k, q / S, 0, h / S, 0, q], 0.25, srcY);
  face(front, [k, -q / S, 0, h / S, h, h], 0.42, srcY);
  return c.toDataURL();
}
