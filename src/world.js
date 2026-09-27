import { makeNoise, hash2 } from './noise.js';
import {
  AIR, GRASS, DIRT, STONE, SAND, WATER, LOG, LEAVES, SNOW, BEDROCK, GRAVEL, COAL_ORE, IRON_ORE,
  GOLD_ORE, DIAMOND_ORE, CACTUS, BIRCH_LOG, BIRCH_LEAVES, ICE, PUMPKIN, isSolid,
} from './blocks.js';

export const CX = 16, CZ = 16, H = 96;
export const WATER_LEVEL = 28;

const BIOME_PLAINS = 0, BIOME_FOREST = 1, BIOME_DESERT = 2, BIOME_SNOW = 3;

export const chunkKey = (cx, cz) => cx + ',' + cz;
export const blockIndex = (x, y, z) => (y * CZ + z) * CX + x;

export class Chunk {
  constructor(cx, cz) {
    this.cx = cx;
    this.cz = cz;
    this.data = new Uint8Array(CX * CZ * H);
    this.dirty = true;
    this.mesh = null;
    this.waterMesh = null;
  }
  get(x, y, z) { return this.data[blockIndex(x, y, z)]; }
  set(x, y, z, id) { this.data[blockIndex(x, y, z)] = id; }
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
    this.onChunkDirty = null;
  }

  column(x, z) {
    const n = this.noise;
    const temp = n.fbm2(x / 350 + 50, z / 350 - 50, 2);
    const humid = n.fbm2(x / 250 - 200, z / 250 + 200, 2);
    let biome = BIOME_PLAINS;
    if (temp > 0.22) biome = BIOME_DESERT;
    else if (temp < -0.22) biome = BIOME_SNOW;
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

    for (let z = 0; z < CZ; z++) {
      for (let x = 0; x < CX; x++) {
        const wx = bx + x, wz = bz + z;
        const { h, biome } = this.column(wx, wz);
        const beach = h <= WATER_LEVEL + 1;
        const desert = biome === BIOME_DESERT;
        const snowy = biome === BIOME_SNOW || h > 64;
        let top, filler;
        if (h < WATER_LEVEL - 4) { top = GRAVEL; filler = DIRT; }
        else if (beach || desert) { top = SAND; filler = SAND; }
        else if (snowy) { top = SNOW; filler = DIRT; }
        else { top = GRASS; filler = DIRT; }
        if (h > 72 && biome !== BIOME_SNOW) { top = h > 76 ? SNOW : STONE; filler = STONE; }

        for (let y = 0; y <= h; y++) {
          let id;
          if (y === 0) id = BEDROCK;
          else if (y <= 2 && hash2(seed + y, wx, wz) < 0.5) id = BEDROCK;
          else if (y === h) id = top;
          else if (y > h - 4) id = filler;
          else {
            id = STONE;
            const r = hash2(seed * 31 + y, wx, wz);
            if (y < 14 && r < 0.0015) id = DIAMOND_ORE;
            else if (y < 26 && r < 0.004) id = GOLD_ORE;
            else if (y < 48 && r < 0.012) id = IRON_ORE;
            else if (y < 70 && r < 0.025) id = COAL_ORE;
          }
          // caves
          if (y > 3 && y < h - 3 && id !== BEDROCK) {
            const c = cn.noise3(wx / 24, y / 14, wz / 24);
            if (c > 0.34) id = AIR;
          }
          d[blockIndex(x, y, z)] = id;
        }
        for (let y = h + 1; y <= WATER_LEVEL; y++) {
          d[blockIndex(x, y, z)] = (y === WATER_LEVEL && biome === BIOME_SNOW) ? ICE : WATER;
        }
      }
    }

    // Vegetation: consider columns in a margin so trees can cross chunk borders
    const put = (x, y, z, id, force) => {
      if (x < 0 || x >= CX || z < 0 || z >= CZ || y < 0 || y >= H) return;
      const i = blockIndex(x, y, z);
      if (force || d[i] === AIR) d[i] = id;
    };
    for (let z = -3; z < CZ + 3; z++) {
      for (let x = -3; x < CX + 3; x++) {
        const wx = bx + x, wz = bz + z;
        const r = hash2(seed + 777, wx, wz);
        if (r > 0.035) continue;
        const { h, biome } = this.column(wx, wz);
        if (h <= WATER_LEVEL + 1 || h > 70) continue;
        const r2 = hash2(seed + 999, wx, wz);
        if (biome === BIOME_DESERT) {
          if (r < 0.006) {
            const ch = 1 + Math.floor(r2 * 3);
            for (let i = 1; i <= ch; i++) put(x, h + i, z, CACTUS, false);
          }
          continue;
        }
        const density = biome === BIOME_FOREST ? 0.035 : biome === BIOME_SNOW ? 0.01 : 0.004;
        if (r > density) {
          continue;
        }
        if (biome === BIOME_PLAINS && r < 0.0006) { put(x, h + 1, z, PUMPKIN, false); continue; }
        const birch = biome === BIOME_FOREST && r2 < 0.35;
        const logId = birch ? BIRCH_LOG : LOG;
        const leafId = birch ? BIRCH_LEAVES : LEAVES;
        const th = 4 + Math.floor(r2 * 3);
        const topY = h + th;
        for (let ly = topY - 2; ly <= topY + 1; ly++) {
          const rad = ly >= topY ? 1 : 2;
          for (let dz = -rad; dz <= rad; dz++) {
            for (let dx = -rad; dx <= rad; dx++) {
              if (Math.abs(dx) === rad && Math.abs(dz) === rad && (ly === topY + 1 || hash2(seed + ly, wx + dx, wz + dz) < 0.5)) continue;
              put(x + dx, ly, z + dz, leafId, false);
            }
          }
        }
        for (let i = 1; i <= th; i++) put(x, h + i, z, logId, true);
        if (x >= 0 && x < CX && z >= 0 && z < CZ) put(x, h, z, DIRT, true);
      }
    }

    // Player edits
    const ed = this.edits.get(chunkKey(cx, cz));
    if (ed) for (const [i, id] of ed) d[i] = id;

    this.chunks.set(chunkKey(cx, cz), chunk);
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

  // For physics: unloaded chunks count as solid so the player can't fall through
  isSolidAt(x, y, z) {
    if (y < 0) return true;
    if (y >= H) return false;
    const cx = Math.floor(x / CX), cz = Math.floor(z / CZ);
    const c = this.chunks.get(chunkKey(cx, cz));
    if (!c) return true;
    return isSolid(c.data[blockIndex(x - cx * CX, y, z - cz * CZ)]);
  }

  setBlock(x, y, z, id) {
    if (y < 0 || y >= H) return false;
    const cx = Math.floor(x / CX), cz = Math.floor(z / CZ);
    const c = this.chunks.get(chunkKey(cx, cz));
    if (!c) return false;
    const lx = x - cx * CX, lz = z - cz * CZ;
    const i = blockIndex(lx, y, lz);
    c.data[i] = id;
    const k = chunkKey(cx, cz);
    if (!this.edits.has(k)) this.edits.set(k, new Map());
    this.edits.get(k).set(i, id);
    c.dirty = true;
    const mark = (dx, dz) => {
      const n = this.chunks.get(chunkKey(cx + dx, cz + dz));
      if (n) n.dirty = true;
    };
    if (lx === 0) mark(-1, 0);
    if (lx === CX - 1) mark(1, 0);
    if (lz === 0) mark(0, -1);
    if (lz === CZ - 1) mark(0, 1);
    if (lx === 0 && lz === 0) mark(-1, -1);
    if (lx === CX - 1 && lz === 0) mark(1, -1);
    if (lx === 0 && lz === CZ - 1) mark(-1, 1);
    if (lx === CX - 1 && lz === CZ - 1) mark(1, 1);
    return true;
  }

  surfaceHeight(x, z) {
    for (let y = H - 1; y > 0; y--) {
      const b = this.getBlock(x, y, z);
      if (b !== AIR && b !== LEAVES && b !== BIRCH_LEAVES) return y;
    }
    return 0;
  }

  serializeEdits() {
    const out = {};
    for (const [k, m] of this.edits) if (m.size) out[k] = [...m];
    return out;
  }
}
