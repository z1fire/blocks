import * as THREE from 'three';
import { BLOCKS, AIR, WATER, TILE_COUNT } from './blocks.js';
import { CX, CZ, H, blockIndex } from './world.js';

// Each face: normal, 4 corners (pos, uv). Triangles (0,1,2) (2,1,3) are CCW from outside.
const FACES = [
  { n: [-1, 0, 0], shade: 0.8, c: [[0, 1, 0, 0, 1], [0, 0, 0, 0, 0], [0, 1, 1, 1, 1], [0, 0, 1, 1, 0]] },
  { n: [1, 0, 0], shade: 0.8, c: [[1, 1, 1, 0, 1], [1, 0, 1, 0, 0], [1, 1, 0, 1, 1], [1, 0, 0, 1, 0]] },
  { n: [0, -1, 0], shade: 0.5, c: [[1, 0, 1, 1, 0], [0, 0, 1, 0, 0], [1, 0, 0, 1, 1], [0, 0, 0, 0, 1]] },
  { n: [0, 1, 0], shade: 1.0, c: [[0, 1, 1, 1, 1], [1, 1, 1, 0, 1], [0, 1, 0, 1, 0], [1, 1, 0, 0, 0]] },
  { n: [0, 0, -1], shade: 0.65, c: [[1, 0, 0, 0, 0], [0, 0, 0, 1, 0], [1, 1, 0, 0, 1], [0, 1, 0, 1, 1]] },
  { n: [0, 0, 1], shade: 0.65, c: [[0, 0, 1, 0, 0], [1, 0, 1, 1, 0], [0, 1, 1, 0, 1], [1, 1, 1, 1, 1]] },
];
const AO_LEVELS = [0.45, 0.65, 0.82, 1.0];
const UV_INSET = 0.0005;

class Buf {
  constructor() { this.pos = []; this.uv = []; this.col = []; this.idx = []; this.n = 0; }
}

export function buildChunkGeometry(world, chunk) {
  const data = chunk.data;
  const bx = chunk.cx * CX, bz = chunk.cz * CZ;
  const get = (x, y, z) => {
    if (y < 0) return 1;
    if (y >= H) return AIR;
    if (x >= 0 && x < CX && z >= 0 && z < CZ) return data[blockIndex(x, y, z)];
    return world.getBlock(bx + x, y, bz + z);
  };
  const opaqueAt = (x, y, z) => BLOCKS[get(x, y, z)].opaque ? 1 : 0;

  const solid = new Buf();
  const water = new Buf();

  for (let y = 0; y < H; y++) {
    for (let z = 0; z < CZ; z++) {
      for (let x = 0; x < CX; x++) {
        const id = data[blockIndex(x, y, z)];
        if (id === AIR) continue;
        const b = BLOCKS[id];
        const isWater = id === WATER;
        const out = isWater ? water : solid;
        const waterTop = isWater && get(x, y + 1, z) !== WATER;

        for (let f = 0; f < 6; f++) {
          const face = FACES[f];
          const [nx, ny, nz] = face.n;
          const nid = get(x + nx, y + ny, z + nz);
          const nb = BLOCKS[nid];
          if (nb.opaque) continue;
          if (isWater) {
            if (nid === WATER) continue;
            if (nid !== AIR && ny !== 1) continue; // only draw water against air (and top surface)
          } else if (!b.opaque && !b.foliage && nid === id) continue; // glass-glass
          else if (b.glass && nid === WATER) { /* draw */ }

          let tile = f === 3 ? b.tiles[0] : f === 2 ? b.tiles[2] : b.tiles[1];
          if (b.faceTile !== undefined && f === 5) tile = b.faceTile;

          const ao = [3, 3, 3, 3];
          if (b.opaque && !b.emissive) {
            // tangent axes for this face
            const axes = nx !== 0 ? [1, 2] : ny !== 0 ? [0, 2] : [0, 1];
            for (let v = 0; v < 4; v++) {
              const c = face.c[v];
              const p = [x + nx, y + ny, z + nz];
              const s1 = [...p], s2 = [...p];
              s1[axes[0]] += c[axes[0]] ? 1 : -1;
              s2[axes[1]] += c[axes[1]] ? 1 : -1;
              const cr = [...s1];
              cr[axes[1]] += c[axes[1]] ? 1 : -1;
              const a = opaqueAt(s1[0], s1[1], s1[2]);
              const bb = opaqueAt(s2[0], s2[1], s2[2]);
              const cc = opaqueAt(cr[0], cr[1], cr[2]);
              ao[v] = a && bb ? 0 : 3 - (a + bb + cc);
            }
          }

          const base = out.n;
          const shade = b.emissive ? 1.0 : face.shade;
          for (let v = 0; v < 4; v++) {
            const c = face.c[v];
            let py = y + c[1];
            if (waterTop && c[1] === 1) py -= 0.12;
            out.pos.push(x + c[0], py, z + c[2]);
            const u = (tile + (c[3] ? 1 - UV_INSET : UV_INSET)) / TILE_COUNT;
            out.uv.push(u, c[4] ? 1 - UV_INSET : UV_INSET);
            const l = shade * AO_LEVELS[ao[v]];
            out.col.push(l, l, l);
          }
          if (ao[0] + ao[3] > ao[1] + ao[2]) {
            out.idx.push(base, base + 1, base + 2, base + 2, base + 1, base + 3);
          } else {
            out.idx.push(base, base + 1, base + 3, base, base + 3, base + 2);
          }
          out.n += 4;
        }
      }
    }
  }

  return { solid: toGeometry(solid), water: toGeometry(water) };
}

function toGeometry(b) {
  if (b.n === 0) return null;
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(b.pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(b.uv, 2));
  g.setAttribute('color', new THREE.Float32BufferAttribute(b.col, 3));
  g.setIndex(b.n > 65535 ? new THREE.Uint32BufferAttribute(b.idx, 1) : new THREE.Uint16BufferAttribute(b.idx, 1));
  g.computeBoundingSphere();
  return g;
}
