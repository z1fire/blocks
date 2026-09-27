import { OPAQUE, LIGHT, FILTER, AIR } from './blocks.js';
import { CX, CZ, H, LIGHT_MARGIN, blockIndex, chunkKey } from './world.js';

const M = LIGHT_MARGIN;
export const RW = CX + 2 * M, RD = CZ + 2 * M;

// Map region x/z -> (chunk offset, local coord)
const OFF = new Int8Array(RW), LOC = new Uint8Array(RW);
for (let r = 0; r < RW; r++) {
  const l = r - M;
  OFF[r] = Math.floor(l / CX);
  LOC[r] = l - OFF[r] * CX;
}

function chunkMaxY(c) {
  if (c.maxY !== undefined) return c.maxY;
  const d = c.data, layer = CX * CZ;
  for (let y = H - 1; y >= 0; y--) {
    const base = y * layer;
    for (let i = 0; i < layer; i++) if (d[base + i] !== AIR) { c.maxY = y; return y; }
  }
  c.maxY = 0;
  return 0;
}

let queue = new Int32Array(1 << 16);
let bufIds = new Uint8Array(0), bufSky = bufIds, bufBlk = bufIds, bufLight = bufIds;
let bottomBuf = null;
function grow() { const q = new Int32Array(queue.length * 2); q.set(queue); queue = q; }

// Builds the block + light region around a chunk. Region coords: x,z in [0,RW), y in [0,RH).
// Returns { ids, light, RH } where index = (y * RD + z) * RW + x and light is (sky << 4) | block.
export function computeRegion(world, chunk) {
  const near = [];
  let maxY = 0;
  for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
    const c = world.chunks.get(chunkKey(chunk.cx + dx, chunk.cz + dz)) || null;
    near.push(c);
    if (c) maxY = Math.max(maxY, chunkMaxY(c));
  }
  const RH = Math.min(H, maxY + 2);
  const layer = RW * RD;
  const size = layer * RH;
  if (bufIds.length < size) {
    bufIds = new Uint8Array(size); bufSky = new Uint8Array(size); bufBlk = new Uint8Array(size); bufLight = new Uint8Array(size);
  }
  const ids = bufIds, sky = bufSky, blk = bufBlk;
  ids.fill(0, 0, size); sky.fill(0, 0, size); blk.fill(0, 0, size);

  // Copy block ids
  for (let rz = 0; rz < RD; rz++) {
    const oz = OFF[rz] + 1, lz = LOC[rz];
    for (let rx = 0; rx < RW; rx++) {
      const c = near[oz * 3 + OFF[rx] + 1];
      if (!c) continue;
      const d = c.data;
      let src = blockIndex(LOC[rx], 0, lz), dst = rz * RW + rx;
      for (let y = 0; y < RH; y++, src += CX * CZ, dst += layer) ids[dst] = d[src];
    }
  }

  // Sky light: straight down from the top, reduced by filtering blocks.
  // bottom[col] = lowest lit y in that column (RH if none).
  const cols = RW * RD;
  if (!bottomBuf || bottomBuf.length < cols) bottomBuf = new Int16Array(cols);
  const bottom = bottomBuf;
  for (let rz = 0; rz < RD; rz++) {
    for (let rx = 0; rx < RW; rx++) {
      let l = 15, b = RH;
      for (let y = RH - 1, i = (RH - 1) * layer + rz * RW + rx; y >= 0; y--, i -= layer) {
        const id = ids[i];
        if (OPAQUE[id]) break;
        l = Math.max(0, l - FILTER[id]);
        if (!l) break;
        sky[i] = l;
        b = y;
      }
      bottom[rz * RW + rx] = b;
    }
  }

  // Seed the flood-fill where a lit column meets a neighbour that is dark at the same height
  let qh = 0, qt = 0;
  for (let rz = 0; rz < RD; rz++) {
    for (let rx = 0; rx < RW; rx++) {
      const col = rz * RW + rx, b = bottom[col];
      let hi = b;
      if (rx > 0) hi = Math.max(hi, bottom[col - 1]);
      if (rx < RW - 1) hi = Math.max(hi, bottom[col + 1]);
      if (rz > 0) hi = Math.max(hi, bottom[col - RW]);
      if (rz < RD - 1) hi = Math.max(hi, bottom[col + RW]);
      for (let y = b; y < hi && y < RH; y++) {
        if (qt >= queue.length) grow();
        queue[qt++] = y * layer + col;
      }
    }
  }
  flood(sky, ids, qh, qt, RH);

  // Block light from emitters
  qt = 0;
  for (let i = 0; i < size; i++) {
    if (!ids[i]) continue;
    const e = LIGHT[ids[i]];
    if (e) { blk[i] = e; if (qt >= queue.length) grow(); queue[qt++] = i; }
  }
  flood(blk, ids, 0, qt, RH);

  const light = bufLight;
  for (let i = 0; i < size; i++) light[i] = (sky[i] << 4) | blk[i];

  // Store this chunk's own light for gameplay queries (spawning, entity lighting)
  const own = chunk.light && chunk.light.length === CX * CZ * H ? chunk.light : new Uint8Array(CX * CZ * H);
  own.fill(15 << 4, CX * CZ * RH);
  for (let y = 0; y < RH; y++) for (let z = 0; z < CZ; z++) {
    const src = y * layer + (z + M) * RW + M, dst = blockIndex(0, y, z);
    for (let x = 0; x < CX; x++) own[dst + x] = light[src + x];
  }
  chunk.light = own;

  return { ids, light, RH };
}

function flood(arr, ids, qh, qt, RH) {
  const layer = RW * RD;
  const push = (n, l) => {
    const id = ids[n];
    if (OPAQUE[id]) return;
    const nl = l - 1 - FILTER[id];
    if (nl > arr[n]) {
      arr[n] = nl;
      if (qt >= queue.length) grow();
      queue[qt++] = n;
    }
  };
  while (qh < qt) {
    const i = queue[qh++];
    const l = arr[i];
    if (l <= 1) continue;
    const y = (i / layer) | 0, rem = i - y * layer, rz = (rem / RW) | 0, rx = rem - rz * RW;
    if (rx > 0) push(i - 1, l);
    if (rx < RW - 1) push(i + 1, l);
    if (rz > 0) push(i - RW, l);
    if (rz < RD - 1) push(i + RW, l);
    if (y > 0) push(i - layer, l);
    if (y < RH - 1) push(i + layer, l);
  }
}
