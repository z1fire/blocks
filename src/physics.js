import { WATER, LAVA } from './blocks.js';

// Axis-aligned body with voxel collision, shared by the player and mobs
export class Body {
  constructor(world, halfWidth, height) {
    this.world = world;
    this.hw = halfWidth;
    this.h = height;
    this.pos = [0, 0, 0];
    this.vel = [0, 0, 0];
    this.onGround = false;
    this.inWater = false;
    this.inLava = false;
    this.headInWater = false;
    this.blockedH = false;
  }

  // Returns the first colliding block box [x, y, z, top] or null
  collides() {
    const p = this.pos, w = this.world, hw = this.hw;
    const x0 = Math.floor(p[0] - hw), x1 = Math.floor(p[0] + hw - 1e-6);
    const y0 = Math.floor(p[1]), y1 = Math.floor(p[1] + this.h - 1e-6);
    const z0 = Math.floor(p[2] - hw), z1 = Math.floor(p[2] + hw - 1e-6);
    for (let y = y0; y <= y1; y++)
      for (let z = z0; z <= z1; z++)
        for (let x = x0; x <= x1; x++) {
          const h = w.solidHeight(x, y, z);
          if (h > 0 && p[1] < y + h - 1e-6) return [x, y, z, y + h];
        }
    return null;
  }

  // Move along one axis, resolving collisions. Returns true if blocked.
  moveAxis(axis, amt) {
    if (amt === 0) return false;
    this.pos[axis] += amt;
    const hit = this.collides();
    if (!hit) return false;
    const hw = this.hw;
    if (axis === 1) this.pos[1] = amt > 0 ? hit[1] - this.h - 1e-4 : hit[3] + 1e-4;
    else if (amt > 0) this.pos[axis] = hit[axis] - hw - 1e-4;
    else this.pos[axis] = hit[axis] + 1 + hw + 1e-4;
    if (this.collides()) this.pos[axis] -= amt;
    return true;
  }

  intersectsBlock(bx, by, bz) {
    const p = this.pos, hw = this.hw;
    return p[0] + hw > bx && p[0] - hw < bx + 1 && p[1] + this.h > by && p[1] < by + 1 &&
      p[2] + hw > bz && p[2] - hw < bz + 1;
  }

  sense(eye) {
    const p = this.pos, w = this.world;
    const fx = Math.floor(p[0]), fz = Math.floor(p[2]);
    const feet = w.getBlock(fx, Math.floor(p[1] + 0.4), fz);
    this.inWater = feet === WATER;
    this.inLava = feet === LAVA || w.getBlock(fx, Math.floor(p[1] + 0.05), fz) === LAVA;
    this.headInWater = w.getBlock(fx, Math.floor(p[1] + eye), fz) === WATER;
  }

  // Integrate velocity with sub-steps to avoid tunneling
  integrate(dt) {
    const v = this.vel;
    const steps = Math.ceil(Math.max(Math.abs(v[0]), Math.abs(v[1]), Math.abs(v[2])) * dt / 0.4) || 1;
    const sdt = dt / steps;
    this.blockedH = false;
    const wasOnGround = this.onGround;
    this.onGround = false;
    for (let s = 0; s < steps; s++) {
      if (this.moveAxis(1, v[1] * sdt)) {
        if (v[1] < 0) this.onGround = true;
        v[1] = 0;
      }
      for (const axis of [0, 2]) {
        const amt = v[axis] * sdt;
        if (this.moveAxis(axis, amt) && !(wasOnGround && this.tryStep(axis, amt))) { this.blockedH = true; v[axis] = 0; }
      }
    }
  }

  // Walk up half-block steps (slabs, beds) without jumping
  tryStep(axis, amt) {
    const p = this.pos, save = [...p];
    p[1] += 0.55;
    if (this.collides()) { p[0] = save[0]; p[1] = save[1]; p[2] = save[2]; return false; }
    p[axis] += amt;
    if (this.collides()) { p[0] = save[0]; p[1] = save[1]; p[2] = save[2]; return false; }
    this.moveAxis(1, -0.55);
    this.onGround = true;
    return true;
  }

  // Can step up onto the block in front (for auto-jump)
  canStepUp(dx, dz) {
    const p = this.pos, w = this.world;
    const ax = Math.floor(p[0] + dx * (this.hw + 0.3)), az = Math.floor(p[2] + dz * (this.hw + 0.3));
    const fy = Math.floor(p[1] + 0.01);
    const need = Math.ceil(this.h);
    if (!w.isSolidAt(ax, fy, az)) return false;
    for (let i = 1; i <= need; i++) if (w.isSolidAt(ax, fy + i, az)) return false;
    return !w.isSolidAt(Math.floor(p[0]), fy + need, Math.floor(p[2]));
  }
}
