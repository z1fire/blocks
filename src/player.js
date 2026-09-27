import { WATER } from './blocks.js';

const HALF_W = 0.3, HEIGHT = 1.8;
export const EYE = 1.62;
const GRAVITY = 28, JUMP_V = 8.6;
const WALK = 4.4, SPRINT = 5.8, FLY = 11, SWIM = 2.6;

export class Player {
  constructor(world) {
    this.world = world;
    this.pos = [0, 60, 0];
    this.vel = [0, 0, 0];
    this.yaw = 0;
    this.pitch = 0;
    this.onGround = false;
    this.flying = false;
    this.inWater = false;
    this.headInWater = false;
    this.sprinting = false;
  }

  collides() {
    const p = this.pos, w = this.world;
    const x0 = Math.floor(p[0] - HALF_W), x1 = Math.floor(p[0] + HALF_W - 1e-6);
    const y0 = Math.floor(p[1]), y1 = Math.floor(p[1] + HEIGHT - 1e-6);
    const z0 = Math.floor(p[2] - HALF_W), z1 = Math.floor(p[2] + HALF_W - 1e-6);
    for (let y = y0; y <= y1; y++)
      for (let z = z0; z <= z1; z++)
        for (let x = x0; x <= x1; x++)
          if (w.isSolidAt(x, y, z)) return [x, y, z];
    return null;
  }

  // Move along one axis, resolving collisions. Returns true if blocked.
  moveAxis(axis, amt) {
    if (amt === 0) return false;
    this.pos[axis] += amt;
    const hit = this.collides();
    if (!hit) return false;
    const minOff = [-HALF_W, 0, -HALF_W], maxOff = [HALF_W, HEIGHT, HALF_W];
    if (amt > 0) this.pos[axis] = hit[axis] - maxOff[axis] - 1e-4;
    else this.pos[axis] = hit[axis] + 1 - minOff[axis] + 1e-4;
    // Resolve any remaining overlap from other blocks by reverting
    if (this.collides()) this.pos[axis] -= amt;
    return true;
  }

  intersectsBlock(bx, by, bz) {
    const p = this.pos;
    return p[0] + HALF_W > bx && p[0] - HALF_W < bx + 1 &&
      p[1] + HEIGHT > by && p[1] < by + 1 &&
      p[2] + HALF_W > bz && p[2] - HALF_W < bz + 1;
  }

  update(dt, input) {
    const w = this.world;
    const p = this.pos, v = this.vel;
    this.inWater = w.getBlock(Math.floor(p[0]), Math.floor(p[1] + 0.4), Math.floor(p[2])) === WATER;
    this.headInWater = w.getBlock(Math.floor(p[0]), Math.floor(p[1] + EYE), Math.floor(p[2])) === WATER;

    // Desired horizontal movement relative to view yaw
    const fx = -Math.sin(this.yaw), fz = -Math.cos(this.yaw);
    const rx = Math.cos(this.yaw), rz = -Math.sin(this.yaw);
    let mx = input.forward * fx + input.strafe * rx;
    let mz = input.forward * fz + input.strafe * rz;
    const mag = Math.hypot(mx, mz);
    if (mag > 1) { mx /= mag; mz /= mag; }
    this.sprinting = input.sprint && input.forward > 0.5;

    let speed = this.flying ? FLY : this.inWater ? SWIM : this.sprinting ? SPRINT : WALK;
    if (this.flying && this.sprinting) speed *= 1.6;
    const tx = mx * speed, tz = mz * speed;

    if (this.flying) {
      const k = Math.min(1, dt * 10);
      v[0] += (tx - v[0]) * k;
      v[2] += (tz - v[2]) * k;
      const ty = ((input.jump ? 1 : 0) - (input.down ? 1 : 0)) * FLY * 0.8;
      v[1] += (ty - v[1]) * k;
    } else {
      const accel = this.onGround ? 14 : this.inWater ? 6 : 4;
      const k = Math.min(1, dt * accel);
      v[0] += (tx - v[0]) * k;
      v[2] += (tz - v[2]) * k;
      if (this.inWater) {
        v[1] -= GRAVITY * 0.25 * dt;
        if (input.jump) v[1] = Math.min(v[1] + 30 * dt, 4);
        if (input.down) v[1] = Math.max(v[1] - 30 * dt, -4);
        v[1] = Math.max(v[1], -3.5);
      } else {
        v[1] -= GRAVITY * dt;
        v[1] = Math.max(v[1], -60);
        if (input.jump && this.onGround) { v[1] = JUMP_V; this.onGround = false; }
      }
    }

    // Integrate with sub-steps to avoid tunneling
    const steps = Math.ceil(Math.max(Math.abs(v[0]), Math.abs(v[1]), Math.abs(v[2])) * dt / 0.4) || 1;
    const sdt = dt / steps;
    let blockedH = false;
    const wasOnGround = this.onGround;
    this.onGround = false;
    for (let s = 0; s < steps; s++) {
      if (this.moveAxis(1, v[1] * sdt)) {
        if (v[1] < 0) this.onGround = true;
        v[1] = 0;
      }
      if (this.moveAxis(0, v[0] * sdt)) { blockedH = true; v[0] = 0; }
      if (this.moveAxis(2, v[2] * sdt)) { blockedH = true; v[2] = 0; }
    }

    // Auto-jump: walking into a 1-block step
    if (!this.flying && blockedH && wasOnGround && mag > 0.1 && !this.inWater) {
      const ax = Math.floor(p[0] + mx * 0.6), az = Math.floor(p[2] + mz * 0.6);
      const fy = Math.floor(p[1] + 0.01);
      if (w.isSolidAt(ax, fy, az) && !w.isSolidAt(ax, fy + 1, az) && !w.isSolidAt(ax, fy + 2, az) &&
        !w.isSolidAt(Math.floor(p[0]), fy + 2, Math.floor(p[2]))) {
        v[1] = JUMP_V;
      }
    }
    // Swimming: hop out of water onto a ledge
    if (this.inWater && blockedH && input.jump) v[1] = 5;

    if (p[1] < -30) { p[1] = 100; v[1] = 0; }
  }
}

// Voxel DDA raycast. Returns { hit:[x,y,z], normal:[nx,ny,nz], id } or null
export function raycast(world, origin, dir, maxDist, skipWater = true) {
  let x = Math.floor(origin[0]), y = Math.floor(origin[1]), z = Math.floor(origin[2]);
  const stepX = Math.sign(dir[0]), stepY = Math.sign(dir[1]), stepZ = Math.sign(dir[2]);
  const tDeltaX = stepX ? Math.abs(1 / dir[0]) : Infinity;
  const tDeltaY = stepY ? Math.abs(1 / dir[1]) : Infinity;
  const tDeltaZ = stepZ ? Math.abs(1 / dir[2]) : Infinity;
  const frac = (v, s) => s > 0 ? Math.floor(v) + 1 - v : v - Math.floor(v);
  let tMaxX = stepX ? frac(origin[0], stepX) * tDeltaX : Infinity;
  let tMaxY = stepY ? frac(origin[1], stepY) * tDeltaY : Infinity;
  let tMaxZ = stepZ ? frac(origin[2], stepZ) * tDeltaZ : Infinity;
  let normal = [0, 0, 0];
  let t = 0;
  while (t <= maxDist) {
    const id = world.getBlock(x, y, z);
    if (id !== 0 && !(skipWater && id === WATER)) return { hit: [x, y, z], normal, id };
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
