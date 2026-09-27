import { makeNoise, hash2, mulberry32 } from './noise.js';
import {
  BLOCKS, AIR, GRASS, DIRT, STONE, SAND, WATER, LOG, LEAVES, SNOW, BEDROCK, GRAVEL, COAL_ORE, IRON_ORE,
  GOLD_ORE, DIAMOND_ORE, CACTUS, BIRCH_LOG, BIRCH_LEAVES, ICE, PUMPKIN, TALL_GRASS, POPPY, DANDELION,
  DEAD_BUSH, LAVA, SANDSTONE, CLAY, SPRUCE_LOG, SPRUCE_LEAVES, MELON, RED_MUSHROOM, BROWN_MUSHROOM,
  OPAQUE, SOLID, LIGHT, FILTER, HEIGHT,
} from './blocks.js';

export const CX = 16, CZ = 16, H = 96;
export const WATER_LEVEL = 28;
export const LIGHT_MARGIN = 8;

export const BIOME_PLAINS = 0, BIOME_FOREST = 1, BIOME_DESERT = 2, BIOME_SNOW = 3, BIOME_TAIGA = 4;
export const BIOME_NAMES = ['Plains', 'Forest', 'Desert', 'Snowy Tundra', 'Taiga'];

export const chunkKey = (cx, cz) => cx + ',' + cz;
export const blockIndex = (x, y, z) => (y * CZ + z) * CX + x;

export class Chunk {
  constructor(cx, cz) {
    this.cx = cx;
    this.cz = cz;
    this.data = new Uint8Array(CX * CZ * H);
    this.light = null; // packed (sky << 4) | block, filled by the mesher
    this.dirty = true;
    this.urgent = false;
    this.mesh = null;
    this.waterMesh = null;
    this.meshed = false;
  }
  get(x, y, z) { return this.data[blockIndex(x, y, z)]; }
  set(x, y, z, id) { this.data[blockIndex(x, y, z)] = id; }
}

// Tree shapes, shared by world generation and sapling growth.
// put(x, y, z, id, force) writes a block; (x, y, z) is the ground block under the trunk.
export function placeTree(put, r, x, y, z, kind) {
  if (kind === 'spruce') {
    const th = 6 + Math.floor(r * 4);
    const top = y + th;
    let rad = 0;
    for (let ly = top + 1; ly >= y + 3; ly--) {
      for (let dz = -rad; dz <= rad; dz++) for (let dx = -rad; dx <= rad; dx++) {
        if (Math.abs(dx) + Math.abs(dz) > rad + (rad > 1 ? 1 : 0)) continue;
        put(x + dx, ly, z + dz, SPRUCE_LEAVES, false);
      }
      rad = rad >= 2 ? 1 : rad + 1;
      if (ly === top + 1) rad = 1;
    }
    for (let i = 1; i <= th; i++) put(x, y + i, z, SPRUCE_LOG, true);
    return;
  }
  const birch = kind === 'birch';
  const logId = birch ? BIRCH_LOG : LOG;
  const leafId = birch ? BIRCH_LEAVES : LEAVES;
  const th = 4 + Math.floor(r * 3);
  const topY = y + th;
  for (let ly = topY - 2; ly <= topY + 1; ly++) {
    const rad = ly >= topY ? 1 : 2;
    for (let dz = -rad; dz <= rad; dz++) {
      for (let dx = -rad; dx <= rad; dx++) {
        if (Math.abs(dx) === rad && Math.abs(dz) === rad && (ly === topY + 1 || ((x + dx) * 7 + (z + dz) * 13 + ly) % 2 === 0)) continue;
        put(x + dx, ly, z + dz, leafId, false);
      }
    }
  }
  for (let i = 1; i <= th; i++) put(x, y + i, z, logId, true);
}

export class World {
  constructor(seed, edits = {}) {
    this.seed = seed | 0;
    this.noise = makeNoise(this.seed);
    this.caveNoise = makeNoise(this.seed + 1013);
    this.chunks = new Map();
    // chunkKey -> Map(blockIndex -> id): player modifications, persisted
    this.edits = new Map();
    for (const [k, list] of Object.entries(edits)) this.edits.set(k, new Map(list));
    this.tickables = new Set(); // "x,y,z" of growing things (saplings, crops)
    this.onGenerate = null;
  }

  column(x, z) {
    const n = this.noise;
    const temp = n.fbm2(x / 350 + 50, z / 350 - 50, 2);
    const humid = n.fbm2(x / 250 - 200, z / 250 + 200, 2);
    let biome = BIOME_PLAINS;
    if (temp > 0.22) biome = BIOME_DESERT;
    else if (temp < -0.22) biome = humid > 0 ? BIOME_TAIGA : BIOME_SNOW;
    else if (humid > 0.05) biome = BIOME_FOREST;

    const cont = n.fbm2(x / 220, z / 220, 4);
    const hills = n.fbm2(x / 55, z / 55, 3);
    const m = n.fbm2(x / 130 + 100, z / 130 + 100, 3);
    const mountain = Math.max(0, m * 2 - 0.3);
    let h = 31 + cont * 22 + hills * (biome === BIOME_DESERT ? 3 : 7) + mountain * mountain * 28;
    h = Math.max(3, Math.min(H - 12, Math.floor(h)));
    return { h, biome };
  }

  generate(cx, cz) {
    const chunk = new Chunk(cx, cz);
    const d = chunk.data;
    const seed = this.seed;
    const cn = this.caveNoise;
    const bx = cx * CX, bz = cz * CZ;
    const heights = new Int16Array(CX * CZ);
    const biomes = new Uint8Array(CX * CZ);

    for (let z = 0; z < CZ; z++) {
      for (let x = 0; x < CX; x++) {
        const wx = bx + x, wz = bz + z;
        const { h, biome } = this.column(wx, wz);
        heights[z * CX + x] = h;
        biomes[z * CX + x] = biome;
        const beach = h <= WATER_LEVEL + 1;
        const desert = biome === BIOME_DESERT;
        const cold = biome === BIOME_SNOW || biome === BIOME_TAIGA;
        const snowy = cold || h > 64;
        let top, filler, deep = STONE;
        if (h < WATER_LEVEL - 4) { top = GRAVEL; filler = DIRT; }
        else if (h < WATER_LEVEL - 1 && hash2(seed + 55, wx >> 2, wz >> 2) < 0.15) { top = CLAY; filler = CLAY; }
        else if (beach || desert) { top = SAND; filler = SAND; if (desert) deep = SANDSTONE; }
        else if (snowy) { top = SNOW; filler = DIRT; }
        else { top = GRASS; filler = DIRT; }
        if (h > 72 && !cold) { top = h > 76 ? SNOW : STONE; filler = STONE; }

        for (let y = 0; y <= h; y++) {
          let id;
          if (y === 0) id = BEDROCK;
          else if (y <= 2 && hash2(seed + y, wx, wz) < 0.5) id = BEDROCK;
          else if (y === h) id = top;
          else if (y > h - 4) id = filler;
          else if (y > h - 7 && deep === SANDSTONE) id = SANDSTONE;
          else {
            id = STONE;
            const r = hash2(seed * 31 + y, wx, wz);
            if (y < 14 && r < 0.0015) id = DIAMOND_ORE;
            else if (y < 26 && r < 0.004) id = GOLD_ORE;
            else if (y < 48 && r < 0.012) id = IRON_ORE;
            else if (y < 70 && r < 0.025) id = COAL_ORE;
          }
          // caves (lava fills the deepest parts)
          if (y > 3 && y < h - 3 && id !== BEDROCK) {
            const c = cn.noise3(wx / 24, y / 14, wz / 24);
            if (c > 0.34) id = y <= 8 ? LAVA : AIR;
          }
          d[blockIndex(x, y, z)] = id;
        }
        for (let y = h + 1; y <= WATER_LEVEL; y++) {
          d[blockIndex(x, y, z)] = (y === WATER_LEVEL && cold) ? ICE : WATER;
        }
      }
    }

    // Cave floor decorations: mushrooms in dark caves
    const rand = mulberry32(hash2(seed + 4242, cx, cz) * 4294967296);
    for (let i = 0; i < 6; i++) {
      const x = Math.floor(rand() * CX), z = Math.floor(rand() * CZ);
      const h = heights[z * CX + x];
      for (let y = 10; y < h - 4; y++) {
        const i0 = blockIndex(x, y, z);
        if (d[i0] === AIR && OPAQUE[d[blockIndex(x, y - 1, z)]] && d[blockIndex(x, y - 1, z)] !== LAVA) {
          d[i0] = rand() < 0.5 ? RED_MUSHROOM : BROWN_MUSHROOM;
          break;
        }
      }
    }

    // Surface plants within this chunk
    for (let z = 0; z < CZ; z++) {
      for (let x = 0; x < CX; x++) {
        const h = heights[z * CX + x];
        if (h <= WATER_LEVEL || h >= H - 2) continue;
        const ground = d[blockIndex(x, h, z)];
        const above = blockIndex(x, h + 1, z);
        if (d[above] !== AIR) continue;
        const biome = biomes[z * CX + x];
        const r = hash2(seed + 313, bx + x, bz + z);
        if (ground === GRASS) {
          const grassChance = biome === BIOME_PLAINS ? 0.22 : biome === BIOME_FOREST ? 0.12 : 0.06;
          if (r < grassChance) d[above] = TALL_GRASS;
          else if (r < grassChance + 0.012) d[above] = POPPY;
          else if (r < grassChance + 0.024) d[above] = DANDELION;
          else if (biome === BIOME_PLAINS && r > 0.9996) d[above] = PUMPKIN;
          else if (biome === BIOME_FOREST && r > 0.9994) d[above] = MELON;
        } else if (ground === SNOW && biome === BIOME_TAIGA && r < 0.05) d[above] = TALL_GRASS;
        else if (ground === SAND && biome === BIOME_DESERT && r < 0.006) d[above] = DEAD_BUSH;
      }
    }

    // Trees and cacti: consider columns in a margin so trees can cross chunk borders
    const put = (x, y, z, id, force) => {
      if (x < 0 || x >= CX || z < 0 || z >= CZ || y < 0 || y >= H) return;
      const i = blockIndex(x, y, z);
      if (force || d[i] === AIR || BLOCKS[d[i]].replaceable) {
        if (!force && d[i] === WATER) return;
        d[i] = id;
      }
    };
    for (let z = -3; z < CZ + 3; z++) {
      for (let x = -3; x < CX + 3; x++) {
        const wx = bx + x, wz = bz + z;
        const r = hash2(seed + 777, wx, wz);
        if (r > 0.04) continue;
        const inside = x >= 0 && x < CX && z >= 0 && z < CZ;
        const { h, biome } = inside ? { h: heights[z * CX + x], biome: biomes[z * CX + x] } : this.column(wx, wz);
        if (h <= WATER_LEVEL + 1 || h > 70) continue;
        const r2 = hash2(seed + 999, wx, wz);
        if (biome === BIOME_DESERT) {
          if (r < 0.006) {
            const ch = 1 + Math.floor(r2 * 3);
            for (let i = 1; i <= ch; i++) put(x, h + i, z, CACTUS, false);
          }
          continue;
        }
        const density = biome === BIOME_FOREST ? 0.035 : biome === BIOME_TAIGA ? 0.03 : biome === BIOME_SNOW ? 0.006 : 0.004;
        if (r > density) continue;
        const kind = biome === BIOME_TAIGA || biome === BIOME_SNOW ? 'spruce' : biome === BIOME_FOREST && r2 < 0.35 ? 'birch' : 'oak';
        placeTree(put, r2, x, h, z, kind);
        put(x, h, z, DIRT, true);
      }
    }

    // Player edits
    const ed = this.edits.get(chunkKey(cx, cz));
    if (ed) {
      for (const [i, id] of ed) {
        d[i] = id;
        if (BLOCKS[id].tick) {
          const y = Math.floor(i / (CX * CZ)), rem = i % (CX * CZ);
          this.tickables.add(`${bx + (rem % CX)},${y},${bz + Math.floor(rem / CX)}`);
        }
      }
    }

    this.chunks.set(chunkKey(cx, cz), chunk);
    if (this.onGenerate) this.onGenerate(chunk, heights, biomes);
    return chunk;
  }

  getChunk(cx, cz) { return this.chunks.get(chunkKey(cx, cz)); }

  getBlock(x, y, z) {
    if (y < 0) return BEDROCK;
    if (y >= H) return AIR;
    const cx = Math.floor(x / CX), cz = Math.floor(z / CZ);
    const c = this.chunks.get(chunkKey(cx, cz));
    if (!c) return AIR;
    return c.data[blockIndex(x - cx * CX, y, z - cz * CZ)];
  }

  // Collision height of the block (0 if passable). Unloaded chunks are solid.
  solidHeight(x, y, z) {
    if (y < 0) return 1;
    if (y >= H) return 0;
    const cx = Math.floor(x / CX), cz = Math.floor(z / CZ);
    const c = this.chunks.get(chunkKey(cx, cz));
    if (!c) return 1;
    const id = c.data[blockIndex(x - cx * CX, y, z - cz * CZ)];
    return SOLID[id] ? HEIGHT[id] : 0;
  }

  isSolidAt(x, y, z) { return this.solidHeight(x, y, z) > 0; }

  // Packed light (sky << 4 | block) at a position
  getLight(x, y, z) {
    if (y >= H) return 15 << 4;
    if (y < 0) return 0;
    const cx = Math.floor(x / CX), cz = Math.floor(z / CZ);
    const c = this.chunks.get(chunkKey(cx, cz));
    if (!c || !c.light) return 15 << 4;
    return c.light[blockIndex(x - cx * CX, y, z - cz * CZ)];
  }

  setBlock(x, y, z, id) {
    if (y < 0 || y >= H) return false;
    const cx = Math.floor(x / CX), cz = Math.floor(z / CZ);
    const c = this.chunks.get(chunkKey(cx, cz));
    if (!c) return false;
    const lx = x - cx * CX, lz = z - cz * CZ;
    const i = blockIndex(lx, y, lz);
    const old = c.data[i];
    if (old === id) return true;
    c.data[i] = id;
    if (id !== AIR && c.maxY !== undefined && y > c.maxY) c.maxY = y;
    const k = chunkKey(cx, cz);
    if (!this.edits.has(k)) this.edits.set(k, new Map());
    this.edits.get(k).set(i, id);
    const tk = `${x},${y},${z}`;
    if (BLOCKS[id].tick) this.tickables.add(tk); else this.tickables.delete(tk);

    c.dirty = true;
    c.urgent = true;
    // Neighbouring chunks: faces/AO at the border, or light that reaches across
    const lightChange = OPAQUE[old] !== OPAQUE[id] || LIGHT[old] !== LIGHT[id] || FILTER[old] !== FILTER[id];
    const reach = lightChange ? LIGHT_MARGIN : 1;
    const nx = lx < reach ? -1 : lx >= CX - reach ? 1 : 0;
    const nz = lz < reach ? -1 : lz >= CZ - reach ? 1 : 0;
    const mark = (dx, dz) => {
      const n = this.chunks.get(chunkKey(cx + dx, cz + dz));
      if (n) n.dirty = true;
    };
    if (nx) mark(nx, 0);
    if (nz) mark(0, nz);
    if (nx && nz) mark(nx, nz);
    return true;
  }

  surfaceHeight(x, z) {
    for (let y = H - 1; y > 0; y--) {
      const b = this.getBlock(x, y, z);
      if (SOLID[b] || b === WATER) return y;
    }
    return 0;
  }

  serializeEdits() {
    const out = {};
    for (const [k, m] of this.edits) if (m.size) out[k] = [...m];
    return out;
  }
}
