import { BLOCKS, AIR, WATER, LAVA } from './blocks.js';
import { Body } from './physics.js';

export const EYE = 1.62;
const GRAVITY = 28, JUMP_V = 8.6;
const WALK = 4.4, SPRINT = 5.8, FLY = 11, SWIM = 2.6;

export class Player extends Body {
  constructor(world) {
    super(world, 0.3, 1.8);
    this.pos = [0, 60, 0];
    this.yaw = 0;
    this.pitch = 0;
    this.flying = false;
    this.sprinting = false;
    this.canSprint = true;
    this.jumped = false;   // set on the frame a jump starts (for hunger)
    this.walkDist = 0;     // accumulated ground distance (footsteps, bobbing)
  }

  update(dt, input) {
    const p = this.pos, v = this.vel;
    this.sense(EYE);
    this.jumped = false;

    // Desired horizontal movement relative to view yaw
    const fx = -Math.sin(this.yaw), fz = -Math.cos(this.yaw);
    const rx = Math.cos(this.yaw), rz = -Math.sin(this.yaw);
    let mx = input.forward * fx + input.strafe * rx;
    let mz = input.forward * fz + input.strafe * rz;
    const mag = Math.hypot(mx, mz);
    if (mag > 1) { mx /= mag; mz /= mag; }
    this.sprinting = input.sprint && input.forward > 0.5 && this.canSprint;

    const liquid = this.inWater || this.inLava;
    let speed = this.flying ? FLY : liquid ? SWIM * (this.inLava ? 0.5 : 1) : this.sprinting ? SPRINT : WALK;
    if (this.flying && this.sprinting) speed *= 1.6;
    const tx = mx * speed, tz = mz * speed;

    if (this.flying) {
      const k = Math.min(1, dt * 10);
      v[0] += (tx - v[0]) * k;
      v[2] += (tz - v[2]) * k;
      const ty = ((input.jump ? 1 : 0) - (input.down ? 1 : 0)) * FLY * 0.8;
      v[1] += (ty - v[1]) * k;
    } else {
      const accel = this.onGround ? 14 : liquid ? 6 : 4;
      const k = Math.min(1, dt * accel);
      v[0] += (tx - v[0]) * k;
      v[2] += (tz - v[2]) * k;
      if (liquid) {
        v[1] -= GRAVITY * 0.25 * dt;
        if (input.jump) v[1] = Math.min(v[1] + 30 * dt, 4);
        if (input.down) v[1] = Math.max(v[1] - 30 * dt, -4);
        v[1] = Math.max(v[1], this.inLava ? -2 : -3.5);
      } else {
        v[1] -= GRAVITY * dt;
        v[1] = Math.max(v[1], -60);
        if (input.jump && this.onGround) { v[1] = JUMP_V; this.onGround = false; this.jumped = true; }
      }
    }

    const wasOnGround = this.onGround;
    const before0 = p[0], before2 = p[2];
    this.integrate(dt);
    if (this.onGround) this.walkDist += Math.hypot(p[0] - before0, p[2] - before2);

    // Auto-jump: walking into a 1-block step
    if (!this.flying && this.blockedH && wasOnGround && mag > 0.1 && !liquid && this.canStepUp(mx, mz)) {
      v[1] = JUMP_V;
      this.jumped = true;
    }
    // Swimming: hop out of water onto a ledge
    if (liquid && this.blockedH && input.jump) v[1] = 5;

    if (p[1] < -30) { p[1] = 100; v[1] = 0; }
  }
}

// Voxel DDA raycast against block shapes. Returns { hit:[x,y,z], normal:[nx,ny,nz], id, dist } or null
export function raycast(world, origin, dir, maxDist) {
  let x = Math.floor(origin[0]), y = Math.floor(origin[1]), z = Math.floor(origin[2]);
  const stepX = Math.sign(dir[0]), stepY = Math.sign(dir[1]), stepZ = Math.sign(dir[2]);
  const tDeltaX = stepX ? Math.abs(1 / dir[0]) : Infinity;
  const tDeltaY = stepY ? Math.abs(1 / dir[1]) : Infinity;
  const tDeltaZ = stepZ ? Math.abs(1 / dir[2]) : Infinity;
  const frac = (v, s) => (s > 0 ? Math.floor(v) + 1 - v : v - Math.floor(v));
  let tMaxX = stepX ? frac(origin[0], stepX) * tDeltaX : Infinity;
  let tMaxY = stepY ? frac(origin[1], stepY) * tDeltaY : Infinity;
  let tMaxZ = stepZ ? frac(origin[2], stepZ) * tDeltaZ : Infinity;
  let normal = [0, 0, 0];
  let t = 0;
  while (t <= maxDist) {
    const id = world.getBlock(x, y, z);
    if (id !== AIR && id !== WATER && id !== LAVA) {
      const b = BLOCKS[id];
      if (b.model === 'cube') return { hit: [x, y, z], normal, id, dist: t };
      // Partial shapes: test the ray against the block's box
      const box = b.model === 'box' ? b.box : b.model === 'torch' ? [0.35, 0, 0.35, 0.65, 0.7, 0.65] : [0.15, 0, 0.15, 0.85, 0.8, 0.85];
      const r = rayBox(origin, dir, x + box[0], y + box[1], z + box[2], x + box[3], y + box[4], z + box[5]);
      if (r && r.t <= maxDist) return { hit: [x, y, z], normal: r.normal, id, dist: r.t };
    }
    if (tMaxX < tMaxY && tMaxX < tMaxZ) {
      x += stepX; t = tMaxX; tMaxX += tDeltaX; normal = [-stepX, 0, 0];
    } else if (tMaxY < tMaxZ) {
      y += stepY; t = tMaxY; tMaxY += tDeltaY; normal = [0, -stepY, 0];
    } else {
      z += stepZ; t = tMaxZ; tMaxZ += tDeltaZ; normal = [0, 0, -stepZ];
    }
  }
  return null;
}

// Slab-method ray/AABB test. Returns { t, normal } or null
export function rayBox(o, d, x0, y0, z0, x1, y1, z1) {
  let tmin = -Infinity, tmax = Infinity, axis = -1, sign = 0;
  const mins = [x0, y0, z0], maxs = [x1, y1, z1];
  for (let a = 0; a < 3; a++) {
    if (Math.abs(d[a]) < 1e-9) {
      if (o[a] < mins[a] || o[a] > maxs[a]) return null;
      continue;
    }
    let t1 = (mins[a] - o[a]) / d[a], t2 = (maxs[a] - o[a]) / d[a];
    let s = -1;
    if (t1 > t2) { [t1, t2] = [t2, t1]; s = 1; }
    if (t1 > tmin) { tmin = t1; axis = a; sign = s; }
    if (t2 < tmax) tmax = t2;
    if (tmin > tmax) return null;
  }
  if (tmax < 0) return null;
  const normal = [0, 0, 0];
  if (axis >= 0) normal[axis] = sign;
  return { t: Math.max(0, tmin), normal };
}
