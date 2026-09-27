import * as THREE from 'three';
import { BLOCKS, AIR, WATER, LAVA, TILE_COUNT, OPAQUE } from './blocks.js';
import { CX, CZ, LIGHT_MARGIN } from './world.js';
import { computeRegion, RW, RD } from './lighting.js';

const M = LIGHT_MARGIN;

// Each face: normal, 4 corners (x,y,z,u,v). Triangles (0,1,2) (2,1,3) are CCW from outside.
const FACES = [
  { n: [-1, 0, 0], shade: 0.8, c: [[0, 1, 0, 0, 1], [0, 0, 0, 0, 0], [0, 1, 1, 1, 1], [0, 0, 1, 1, 0]] },
  { n: [1, 0, 0], shade: 0.8, c: [[1, 1, 1, 0, 1], [1, 0, 1, 0, 0], [1, 1, 0, 1, 1], [1, 0, 0, 1, 0]] },
  { n: [0, -1, 0], shade: 0.5, c: [[1, 0, 1, 1, 0], [0, 0, 1, 0, 0], [1, 0, 0, 1, 1], [0, 0, 0, 0, 1]] },
  { n: [0, 1, 0], shade: 1.0, c: [[0, 1, 1, 1, 1], [1, 1, 1, 0, 1], [0, 1, 0, 1, 0], [1, 1, 0, 0, 0]] },
  { n: [0, 0, -1], shade: 0.65, c: [[1, 0, 0, 0, 0], [0, 0, 0, 1, 0], [1, 1, 0, 0, 1], [0, 1, 0, 1, 1]] },
  { n: [0, 0, 1], shade: 0.65, c: [[0, 0, 1, 0, 0], [1, 0, 1, 1, 0], [0, 1, 1, 0, 1], [1, 1, 1, 1, 1]] },
];
// uv as a function of the corner position, per face (for partial boxes)
const UVMAP = [
  (p) => [p[2], p[1]], (p) => [1 - p[2], p[1]], (p) => [p[0], 1 - p[2]],
  (p) => [1 - p[0], p[2]], (p) => [1 - p[0], p[1]], (p) => [p[0], p[1]],
];
// Tangent axes and AO sample offsets per face/corner, precomputed
const AXES = FACES.map((f) => (f.n[0] !== 0 ? [1, 2] : f.n[1] !== 0 ? [0, 2] : [0, 1]));
const AO_LEVELS = [0.5, 0.7, 0.85, 1.0];
const CURVE = new Float32Array(61);
for (let i = 0; i <= 60; i++) CURVE[i] = Math.pow(0.8, 15 - i / 4);
const UV_INSET = 0.0005;
const TORCH_BOX = [7 / 16, 0, 7 / 16, 9 / 16, 10 / 16, 9 / 16];

// Growable typed-array vertex buffer, reused between chunk builds to avoid garbage
class Buf {
  constructor(cap = 4096) { this.alloc(cap); this.n = 0; this.ni = 0; }
  alloc(cap) {
    const old = this.cap ? this : null;
    this.cap = cap;
    const pos = new Float32Array(cap * 3), uv = new Float32Array(cap * 2), light = new Float32Array(cap * 2), idx = new Uint32Array(cap * 1.5);
    if (old) { pos.set(old.pos); uv.set(old.uv); light.set(old.light); idx.set(old.idx); }
    this.pos = pos; this.uv = uv; this.light = light; this.idx = idx;
  }
  reset() { this.n = 0; this.ni = 0; return this; }
  ensure() { if (this.n + 4 > this.cap) this.alloc(this.cap * 2); }
}
const SOLID_BUF = new Buf(16384), WATER_BUF = new Buf(4096);

export function buildChunkGeometry(world, chunk) {
  const { ids, light, RH } = computeRegion(world, chunk);
  const at = (x, y, z) => (y * RD + z) * RW + x;
  const idAt = (x, y, z) => (y < 0 ? 13 : y >= RH ? AIR : ids[at(x, y, z)]);
  const lightAt = (x, y, z) => (y < 0 ? 0 : y >= RH ? 240 : light[at(x, y, z)]);

  const solid = SOLID_BUF.reset();
  const water = WATER_BUF.reset();
  const s1 = [0, 0, 0], s2 = [0, 0, 0], cr = [0, 0, 0];
  const aoV = [3, 3, 3, 3], skyV = [0, 0, 0, 0], blkV = [0, 0, 0, 0];

  const quad = (out, verts, uvs, tile, sky, blk, flip) => {
    out.ensure();
    const base = out.n, P = out.pos, U = out.uv, L = out.light, I = out.idx;
    for (let v = 0; v < 4; v++) {
      const i = base + v;
      P[i * 3] = verts[v * 3]; P[i * 3 + 1] = verts[v * 3 + 1]; P[i * 3 + 2] = verts[v * 3 + 2];
      let u = uvs[v * 2], w = uvs[v * 2 + 1];
      u = u < UV_INSET ? UV_INSET : u > 1 - UV_INSET ? 1 - UV_INSET : u;
      w = w < UV_INSET ? UV_INSET : w > 1 - UV_INSET ? 1 - UV_INSET : w;
      U[i * 2] = (tile + u) / TILE_COUNT; U[i * 2 + 1] = w;
      L[i * 2] = sky[v]; L[i * 2 + 1] = blk[v];
    }
    let k = out.ni;
    if (flip) { I[k++] = base; I[k++] = base + 1; I[k++] = base + 3; I[k++] = base; I[k++] = base + 3; I[k++] = base + 2; }
    else { I[k++] = base; I[k++] = base + 1; I[k++] = base + 2; I[k++] = base + 2; I[k++] = base + 1; I[k++] = base + 3; }
    out.ni = k;
    out.n += 4;
  };

  const verts = new Array(12), uvs = new Array(8);

  // Partial box (torch, slab, bed): faces lit by the block's own cell
  const emitBox = (out, x, y, z, rx, ry, rz, b, box) => {
    const l = lightAt(rx, ry, rz);
    for (let f = 0; f < 6; f++) {
      const face = FACES[f];
      const [nx, ny, nz] = face.n;
      // Cull faces flush with an opaque neighbour
      const flush = (nx < 0 && box[0] === 0) || (nx > 0 && box[3] === 1) || (ny < 0 && box[1] === 0) ||
        (ny > 0 && box[4] === 1) || (nz < 0 && box[2] === 0) || (nz > 0 && box[5] === 1);
      if (flush && OPAQUE[idAt(rx + nx, ry + ny, rz + nz)]) continue;
      const nl = flush ? lightAt(rx + nx, ry + ny, rz + nz) : l;
      const sk = CURVE[(nl >> 4) * 4] * face.shade, bl = CURVE[(nl & 15) * 4] * face.shade;
      const tile = f === 3 ? b.tiles[0] : f === 2 ? b.tiles[2] : b.tiles[1];
      for (let v = 0; v < 4; v++) {
        const c = face.c[v];
        const p = [box[0] + (box[3] - box[0]) * c[0], box[1] + (box[4] - box[1]) * c[1], box[2] + (box[5] - box[2]) * c[2]];
        verts[v * 3] = x + p[0]; verts[v * 3 + 1] = y + p[1]; verts[v * 3 + 2] = z + p[2];
        const uv = UVMAP[f](p);
        uvs[v * 2] = uv[0]; uvs[v * 2 + 1] = uv[1];
        skyV[v] = sk; blkV[v] = bl;
      }
      quad(out, verts, uvs, tile, skyV, blkV, false);
    }
  };

  const CROSS = [
    [0.15, 0, 0.15, 0.85, 0, 0.85, 0.15, 1, 0.15, 0.85, 1, 0.85],
    [0.15, 0, 0.85, 0.85, 0, 0.15, 0.15, 1, 0.85, 0.85, 1, 0.15],
  ];
  const CROSS_UV = [0, 0, 1, 0, 0, 1, 1, 1];
  const CROSS_UV_BACK = [1, 0, 0, 0, 1, 1, 0, 1];

  for (let y = 0; y < RH; y++) {
    for (let z = 0; z < CZ; z++) {
      const rz = z + M;
      for (let x = 0; x < CX; x++) {
        const rx = x + M;
        const id = ids[(y * RD + rz) * RW + rx];
        if (id === AIR) continue;
        const b = BLOCKS[id];

        if (b.model === 'cross') {
          const l = lightAt(rx, y, rz);
          const sk = CURVE[(l >> 4) * 4], bl = CURVE[(l & 15) * 4];
          skyV.fill(sk); blkV.fill(bl);
          for (const q of CROSS) {
            for (let i = 0; i < 12; i += 3) { verts[i] = x + q[i]; verts[i + 1] = y + q[i + 1]; verts[i + 2] = z + q[i + 2]; }
            quad(solid, verts, CROSS_UV, b.tiles[1], skyV, blkV, false);
            // back side: swap corner order 0<->1, 2<->3
            const back = [verts[3], verts[4], verts[5], verts[0], verts[1], verts[2], verts[9], verts[10], verts[11], verts[6], verts[7], verts[8]];
            quad(solid, back, CROSS_UV_BACK, b.tiles[1], skyV, blkV, false);
          }
          continue;
        }
        if (b.model === 'torch') { emitBox(solid, x, y, z, rx, y, rz, b, TORCH_BOX); continue; }
        if (b.model === 'box') { emitBox(solid, x, y, z, rx, y, rz, b, b.box); continue; }

        const liquid = b.liquid;
        const out = id === WATER ? water : solid;
        const liquidTop = liquid && idAt(rx, y + 1, rz) !== id;

        for (let f = 0; f < 6; f++) {
          const face = FACES[f];
          const [nx, ny, nz] = face.n;
          const nid = idAt(rx + nx, y + ny, rz + nz);
          if (OPAQUE[nid]) continue;
          if (liquid) {
            if (nid === id) continue;
            if (id === WATER && nid !== AIR && ny !== 1 && BLOCKS[nid].model === 'cube') continue;
            if (id === LAVA && nid === WATER) continue;
          } else if (!b.opaque && !b.foliage && nid === id) continue; // glass-glass

          let tile = f === 3 ? b.tiles[0] : f === 2 ? b.tiles[2] : b.tiles[1];
          if (b.faceTile !== undefined && f === 5) tile = b.faceTile;

          const axes = AXES[f];
          const fx = rx + nx, fy = y + ny, fz = rz + nz;
          const fl = lightAt(fx, fy, fz);
          for (let v = 0; v < 4; v++) {
            const c = face.c[v];
            s1[0] = fx; s1[1] = fy; s1[2] = fz;
            s2[0] = fx; s2[1] = fy; s2[2] = fz;
            s1[axes[0]] += c[axes[0]] ? 1 : -1;
            s2[axes[1]] += c[axes[1]] ? 1 : -1;
            cr[0] = s1[0]; cr[1] = s1[1]; cr[2] = s1[2];
            cr[axes[1]] += c[axes[1]] ? 1 : -1;
            const i1 = idAt(s1[0], s1[1], s1[2]), i2 = idAt(s2[0], s2[1], s2[2]), i3 = idAt(cr[0], cr[1], cr[2]);
            const o1 = OPAQUE[i1], o2 = OPAQUE[i2], o3 = OPAQUE[i3];
            aoV[v] = b.opaque ? (o1 && o2 ? 0 : 3 - (o1 + o2 + o3)) : 3;
            // smooth light: average of the open cells around this corner
            let ss = fl >> 4, bs = fl & 15, n = 1;
            if (!o1) { const l = lightAt(s1[0], s1[1], s1[2]); ss += l >> 4; bs += l & 15; n++; }
            if (!o2) { const l = lightAt(s2[0], s2[1], s2[2]); ss += l >> 4; bs += l & 15; n++; }
            if (!o3 && !(o1 && o2)) { const l = lightAt(cr[0], cr[1], cr[2]); ss += l >> 4; bs += l & 15; n++; }
            const k = face.shade * AO_LEVELS[aoV[v]];
            skyV[v] = CURVE[Math.round(ss * 4 / n)] * k;
            blkV[v] = CURVE[Math.round(bs * 4 / n)] * k;

            let py = y + c[1];
            if (liquidTop && c[1] === 1) py -= 0.12;
            verts[v * 3] = x + c[0]; verts[v * 3 + 1] = py; verts[v * 3 + 2] = z + c[2];
            uvs[v * 2] = c[3]; uvs[v * 2 + 1] = c[4];
          }
          const flip = !(aoV[0] + aoV[3] > aoV[1] + aoV[2]);
          quad(out, verts, uvs, tile, skyV, blkV, flip);
        }
      }
    }
  }

  return { solid: toGeometry(solid), water: toGeometry(water) };
}

function toGeometry(b) {
  if (b.n === 0) return null;
  const g = new THREE.BufferGeometry();
  if (Array.isArray(b.pos)) {
    g.setAttribute('position', new THREE.Float32BufferAttribute(b.pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(b.uv, 2));
    g.setAttribute('light', new THREE.Float32BufferAttribute(b.light, 2));
    g.setIndex(new THREE.Uint16BufferAttribute(b.idx, 1));
  } else {
    g.setAttribute('position', new THREE.BufferAttribute(b.pos.slice(0, b.n * 3), 3));
    g.setAttribute('uv', new THREE.BufferAttribute(b.uv.slice(0, b.n * 2), 2));
    g.setAttribute('light', new THREE.BufferAttribute(b.light.slice(0, b.n * 2), 2));
    const idx = b.idx.subarray(0, b.ni);
    g.setIndex(new THREE.BufferAttribute(b.n > 65535 ? idx.slice() : Uint16Array.from(idx), 1));
  }
  g.computeBoundingSphere();
  return g;
}

// Simple array-backed buffer for one-off single-block meshes
class ArrBuf { constructor() { this.pos = []; this.uv = []; this.light = []; this.idx = []; this.n = 0; } }

// Geometry for a single block (held item, dropped items, falling blocks), fully lit
export function buildBlockGeometry(id) {
  const b = BLOCKS[id];
  const out = new ArrBuf();
  const box = b.model === 'box' ? b.box : b.model === 'torch' ? TORCH_BOX : [0, 0, 0, 1, 1, 1];
  if (b.model === 'cross') {
    const q = [0, 0, 0.5, 1, 0, 0.5, 0, 1, 0.5, 1, 1, 0.5];
    const tile = b.tiles[1];
    for (const back of [false, true]) {
      const v = back ? [q[3], q[4], q[5], q[0], q[1], q[2], q[9], q[10], q[11], q[6], q[7], q[8]] : q;
      const base = out.n;
      for (let i = 0; i < 4; i++) {
        out.pos.push(v[i * 3] - 0.5, v[i * 3 + 1] - 0.5, v[i * 3 + 2] - 0.5);
        const u = back ? [1, 0, 1, 0][i] : [0, 1, 0, 1][i];
        out.uv.push((tile + u) / TILE_COUNT, [0, 0, 1, 1][i]);
        out.light.push(1, 0);
      }
      out.idx.push(base, base + 1, base + 2, base + 2, base + 1, base + 3);
      out.n += 4;
    }
    return withShadeColors(toGeometry(out));
  }
  for (let f = 0; f < 6; f++) {
    const face = FACES[f];
    let tile = f === 3 ? b.tiles[0] : f === 2 ? b.tiles[2] : b.tiles[1];
    if (b.faceTile !== undefined && f === 5) tile = b.faceTile;
    const base = out.n;
    for (let v = 0; v < 4; v++) {
      const c = face.c[v];
      const p = [box[0] + (box[3] - box[0]) * c[0], box[1] + (box[4] - box[1]) * c[1], box[2] + (box[5] - box[2]) * c[2]];
      out.pos.push(p[0] - 0.5, p[1] - 0.5, p[2] - 0.5);
      const uv = UVMAP[f](p);
      out.uv.push((tile + Math.min(1 - UV_INSET, Math.max(UV_INSET, uv[0]))) / TILE_COUNT, Math.min(1 - UV_INSET, Math.max(UV_INSET, uv[1])));
      out.light.push(face.shade, 0);
    }
    out.idx.push(base, base + 1, base + 2, base + 2, base + 1, base + 3);
    out.n += 4;
  }
  return withShadeColors(toGeometry(out));
}

// Vertex colours from face shading, for use with plain (non-shader) materials
function withShadeColors(g) {
  const l = g.attributes.light.array;
  const c = new Float32Array((l.length / 2) * 3);
  for (let i = 0; i < l.length / 2; i++) c[i * 3] = c[i * 3 + 1] = c[i * 3 + 2] = l[i * 2];
  g.setAttribute('color', new THREE.BufferAttribute(c, 3));
  return g;
}
