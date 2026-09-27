import {
  BLOCKS, PLANKS, LOG, BIRCH_LOG, SPRUCE_LOG, BIRCH_PLANKS, SPRUCE_PLANKS, CRAFTING, FURNACE, COBBLE,
  STONE, STONE_BRICK, SAND, GLASS, BRICK, TNT, BOOKSHELF, TORCH, BED, WOOL_WHITE, WOOL_RED, WOOL_YELLOW,
  POPPY, DANDELION, IRON_ORE, GOLD_ORE, IRON_BLOCK, GOLD_BLOCK, DIAMOND_BLOCK, SANDSTONE, STONE_SLAB,
  PLANK_SLAB, JACK_O_LANTERN, PUMPKIN, MOSSY_COBBLE, MELON, CLAY, GLOWSTONE,
  RED_MUSHROOM, BROWN_MUSHROOM, WOOL_BLACK, WOOL_GRAY, TALL_GRASS, I,
} from './blocks.js';
import { ITEMS, IT, TOOL_IDS, getDef, maxStack } from './items.js';

export class Inventory {
  constructor(data = {}) {
    this.counts = { ...(data.counts || {}) };
    this.wear = { ...(data.wear || {}) };
    this.hotbar = data.hotbar ? [...data.hotbar] : Array(9).fill(0);
    this.sel = data.sel || 0;
  }
  count(id) { return this.counts[id] || 0; }
  add(id, n = 1) {
    this.counts[id] = this.count(id) + n;
    if (!this.hotbar.includes(id)) {
      const empty = this.hotbar.findIndex((h) => !h || this.count(h) <= 0);
      if (empty >= 0) this.hotbar[empty] = id;
    }
  }
  remove(id, n = 1) {
    if (this.count(id) < n) return false;
    this.counts[id] -= n;
    if (this.counts[id] <= 0) { delete this.counts[id]; delete this.wear[id]; }
    return true;
  }
  get selected() { return this.hotbar[this.sel] || 0; }
  // Wear down a tool; returns true if it broke
  useTool(id, amount = 1) {
    const t = ITEMS[id]?.tool;
    if (!t) return false;
    this.wear[id] = (this.wear[id] || 0) + amount;
    if (this.wear[id] >= t.durability) {
      this.wear[id] = 0;
      this.remove(id, 1);
      return true;
    }
    return false;
  }
  durability(id) {
    const t = ITEMS[id]?.tool;
    return t ? 1 - (this.wear[id] || 0) / t.durability : 1;
  }
  serialize() { return { counts: this.counts, wear: this.wear, hotbar: this.hotbar, sel: this.sel }; }
}

// Mining: how long a block takes and whether it drops anything
export function mining(blockId, heldId, creative) {
  const b = BLOCKS[blockId];
  if (b.liquid) return { time: Infinity, harvest: false };
  if (creative) return { time: b.hardness === 0 ? 0.05 : 0.15, harvest: false };
  if (b.unbreakable || !isFinite(b.hardness)) return { time: Infinity, harvest: false };
  if (b.hardness === 0) return { time: 0.05, harvest: true };
  const tool = ITEMS[heldId]?.tool;
  const correct = tool && tool.kind === b.tool;
  const harvest = b.tier === 0 || (correct && tool.tier >= b.tier);
  const speed = correct ? tool.speed : 1;
  return { time: b.hardness * (harvest ? 1.5 : 5) / speed, harvest, correct };
}

export function dropsFor(blockId, rand, harvest) {
  if (!harvest) return [];
  const d = BLOCKS[blockId].drops;
  if (d === undefined) return [[blockId, 1]];
  if (d === 0) return [];
  if (typeof d === 'number') return [[d, 1]];
  if (typeof d === 'function') return d(rand);
  return d;
}

export function attackDamage(heldId) {
  return ITEMS[heldId]?.tool?.damage ?? 1;
}

// ---------- Recipes ----------
// station: null (anywhere), 'table' (crafting table nearby) or 'furnace' (furnace nearby; uses 1 coal)
const R = (out, n, inputs, station = null) => ({ out: [out, n], in: inputs, station });
const T = TOOL_IDS;
export const RECIPES = [
  R(PLANKS, 4, [[LOG, 1]]),
  R(BIRCH_PLANKS, 4, [[BIRCH_LOG, 1]]),
  R(SPRUCE_PLANKS, 4, [[SPRUCE_LOG, 1]]),
  R(I.STICK, 4, [[PLANKS, 2]]),
  R(I.STICK, 4, [[BIRCH_PLANKS, 2]]),
  R(I.STICK, 4, [[SPRUCE_PLANKS, 2]]),
  R(CRAFTING, 1, [[PLANKS, 4]]),
  R(TORCH, 4, [[I.COAL, 1], [I.STICK, 1]]),
  R(IT.BREAD, 1, [[I.WHEAT, 3]]),
  R(IT.STEW, 1, [[RED_MUSHROOM, 1], [BROWN_MUSHROOM, 1]]),
  R(WOOL_RED, 1, [[WOOL_WHITE, 1], [POPPY, 1]]),
  R(WOOL_YELLOW, 1, [[WOOL_WHITE, 1], [DANDELION, 1]]),
  R(JACK_O_LANTERN, 1, [[PUMPKIN, 1], [TORCH, 1]]),
  R(MELON, 1, [[I.MELON_SLICE, 9]]),
  // tools (need a crafting table)
  ...[[1, PLANKS], [2, COBBLE], [3, I.IRON_INGOT], [4, I.DIAMOND]].flatMap(([tier, mat]) => [
    R(T[`pickaxe_${tier}`], 1, [[mat, 3], [I.STICK, 2]], 'table'),
    R(T[`axe_${tier}`], 1, [[mat, 3], [I.STICK, 2]], 'table'),
    R(T[`shovel_${tier}`], 1, [[mat, 1], [I.STICK, 2]], 'table'),
    R(T[`sword_${tier}`], 1, [[mat, 2], [I.STICK, 1]], 'table'),
  ]),
  R(T.hoe, 1, [[COBBLE, 2], [I.STICK, 2]], 'table'),
  R(FURNACE, 1, [[COBBLE, 8]], 'table'),
  R(BED, 1, [[WOOL_WHITE, 3], [PLANKS, 3]], 'table'),
  R(BOOKSHELF, 1, [[PLANKS, 6]], 'table'),
  R(STONE_BRICK, 4, [[STONE, 4]], 'table'),
  R(MOSSY_COBBLE, 1, [[COBBLE, 1], [TALL_GRASS, 1]], 'table'),
  R(STONE_SLAB, 6, [[COBBLE, 3]], 'table'),
  R(PLANK_SLAB, 6, [[PLANKS, 3]], 'table'),
  R(SANDSTONE, 1, [[SAND, 4]], 'table'),
  R(BRICK, 1, [[IT.BRICK_ITEM, 4]], 'table'),
  R(CLAY, 1, [[I.CLAY_BALL, 4]], 'table'),
  R(TNT, 1, [[IT.GUNPOWDER, 5], [SAND, 4]], 'table'),
  R(WOOL_BLACK, 1, [[WOOL_WHITE, 1], [I.COAL, 1]], 'table'),
  R(WOOL_GRAY, 2, [[WOOL_WHITE, 1], [WOOL_BLACK, 1]], 'table'),
  R(GLOWSTONE, 1, [[TORCH, 4], [GLASS, 1]], 'table'),
  R(IRON_BLOCK, 1, [[I.IRON_INGOT, 9]], 'table'),
  R(GOLD_BLOCK, 1, [[I.GOLD_INGOT, 9]], 'table'),
  R(DIAMOND_BLOCK, 1, [[I.DIAMOND, 9]], 'table'),
  R(I.IRON_INGOT, 9, [[IRON_BLOCK, 1]], 'table'),
  R(I.GOLD_INGOT, 9, [[GOLD_BLOCK, 1]], 'table'),
  R(I.DIAMOND, 9, [[DIAMOND_BLOCK, 1]], 'table'),
  // smelting
  R(I.IRON_INGOT, 1, [[IRON_ORE, 1]], 'furnace'),
  R(I.GOLD_INGOT, 1, [[GOLD_ORE, 1]], 'furnace'),
  R(GLASS, 1, [[SAND, 1]], 'furnace'),
  R(STONE, 1, [[COBBLE, 1]], 'furnace'),
  R(IT.BRICK_ITEM, 1, [[I.CLAY_BALL, 1]], 'furnace'),
  R(IT.COOKED_PORK, 1, [[IT.RAW_PORK, 1]], 'furnace'),
  R(IT.STEAK, 1, [[IT.RAW_BEEF, 1]], 'furnace'),
  R(IT.COOKED_CHICKEN, 1, [[IT.RAW_CHICKEN, 1]], 'furnace'),
  R(I.COAL, 1, [[LOG, 1]], 'furnace'),
].filter((r) => r.in.every(([id]) => getDef(id)));

// Fuel for the furnace: coal, or planks as a weaker fallback
export function furnaceFuel(inv) {
  if (inv.count(I.COAL) > 0) return [I.COAL, 1];
  for (const p of [PLANKS, BIRCH_PLANKS, SPRUCE_PLANKS]) if (inv.count(p) >= 2) return [p, 2];
  return null;
}

export function canCraft(inv, r, stations) {
  if (r.station && !stations[r.station]) return false;
  if (!r.in.every(([id, n]) => inv.count(id) >= n)) return false;
  if (r.station === 'furnace') {
    const fuel = furnaceFuel(inv);
    if (!fuel) return false;
    // fuel may be the same item as an input
    const need = r.in.find(([id]) => id === fuel[0]);
    if (need && inv.count(fuel[0]) < need[1] + fuel[1]) return false;
  }
  return true;
}

export function craft(inv, r, stations) {
  if (!canCraft(inv, r, stations)) return false;
  if (r.station === 'furnace') { const [f, n] = furnaceFuel(inv); inv.remove(f, n); }
  for (const [id, n] of r.in) inv.remove(id, n);
  inv.add(r.out[0], r.out[1]);
  return true;
}

export { maxStack };
