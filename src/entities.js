import * as THREE from 'three';
import { Body } from './physics.js';
import { rayBox } from './player.js';
import { buildBlockGeometry } from './mesher.js';
import { itemTexture, IT } from './items.js';
import {
  BLOCKS, AIR, WATER, GRASS, SNOW, WOOL_WHITE, WOOL_GRAY, WOOL_BLACK, SOLID,
} from './blocks.js';
import { CX, CZ, H, BIOME_DESERT, BIOME_SNOW, BIOME_TAIGA } from './world.js';

const GRAVITY = 26;

// ---------- Model helpers ----------
function pixTex(w, h, base, noise, draw) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(w, h);
  for (let i = 0; i < w * h; i++) {
    const f = 1 - noise + Math.random() * noise * 2;
    img.data[i * 4] = Math.min(255, base[0] * f);
    img.data[i * 4 + 1] = Math.min(255, base[1] * f);
    img.data[i * 4 + 2] = Math.min(255, base[2] * f);
    img.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  if (draw) draw(ctx);
  const t = new THREE.CanvasTexture(c);
  t.magFilter = t.minFilter = THREE.NearestFilter;
  t.generateMipmaps = false;
  return t;
}
const rect = (ctx, x, y, w, h, col) => { ctx.fillStyle = col; ctx.fillRect(x, y, w, h); };

class ModelBuilder {
  constructor() { this.group = new THREE.Group(); this.mats = []; }
  mat(tex) { const m = new THREE.MeshBasicMaterial({ map: tex }); this.mats.push(m); return m; }
  // Box of size (w,h,d) centred at (x,y,z) within parent. faceTex optional texture for the +z face.
  box(parent, w, h, d, x, y, z, tex, faceTex) {
    const m = this.mat(tex);
    const mats = faceTex ? [m, m, m, m, this.mat(faceTex), m] : m;
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mats);
    mesh.position.set(x, y, z);
    parent.add(mesh);
    return mesh;
  }
  pivot(parent, x, y, z) { const g = new THREE.Group(); g.position.set(x, y, z); parent.add(g); return g; }
}

function quadruped(b, { bodyW, bodyH, bodyL, legH, legW, headS, bodyTex, legTex, headTex, faceTex, headY, headZ }) {
  const m = { legs: [] };
  b.box(b.group, bodyW, bodyH, bodyL, 0, legH + bodyH / 2, 0, bodyTex);
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    const p = b.pivot(b.group, sx * (bodyW / 2 - legW / 2), legH, sz * (bodyL / 2 - legW / 2));
    b.box(p, legW, legH, legW, 0, -legH / 2, 0, legTex);
    m.legs.push(p);
  }
  m.head = b.pivot(b.group, 0, headY ?? legH + bodyH * 0.85, headZ ?? bodyL / 2 + headS * 0.3);
  b.box(m.head, headS, headS, headS, 0, 0, headS / 2 - 0.05, headTex, faceTex);
  return m;
}

const eyes = (ctx, y, col = '#fff', pupil = '#111') => {
  rect(ctx, 1, y, 2, 1, col); rect(ctx, 5, y, 2, 1, col);
  rect(ctx, 2, y, 1, 1, pupil); rect(ctx, 5, y, 1, 1, pupil);
};

const MODELS = {
  pig(b) {
    const pink = [240, 160, 160];
    return quadruped(b, {
      bodyW: 0.62, bodyH: 0.55, bodyL: 0.95, legH: 0.35, legW: 0.24, headS: 0.5,
      bodyTex: pixTex(8, 8, pink, 0.06), legTex: pixTex(4, 4, pink, 0.08), headTex: pixTex(8, 8, pink, 0.06),
      faceTex: pixTex(8, 8, pink, 0.05, (c) => { eyes(c, 2); rect(c, 2, 4, 4, 3, '#e58a90'); rect(c, 3, 5, 1, 1, '#8a3c44'); rect(c, 4, 5, 1, 1, '#8a3c44'); }),
    });
  },
  cow(b) {
    const brown = [90, 60, 40];
    const spots = (c) => { for (let i = 0; i < 5; i++) rect(c, Math.random() * 7 | 0, Math.random() * 7 | 0, 2, 2, '#eee'); };
    const m = quadruped(b, {
      bodyW: 0.8, bodyH: 0.7, bodyL: 1.15, legH: 0.6, legW: 0.28, headS: 0.52,
      bodyTex: pixTex(8, 8, brown, 0.08, spots), legTex: pixTex(4, 4, brown, 0.1), headTex: pixTex(8, 8, brown, 0.08),
      faceTex: pixTex(8, 8, brown, 0.06, (c) => { eyes(c, 2); rect(c, 1, 5, 6, 3, '#d8c8b8'); rect(c, 2, 6, 1, 1, '#333'); rect(c, 5, 6, 1, 1, '#333'); }),
    });
    b.box(m.head, 0.1, 0.12, 0.1, -0.24, 0.3, 0.1, pixTex(2, 2, [230, 225, 210], 0.05));
    b.box(m.head, 0.1, 0.12, 0.1, 0.24, 0.3, 0.1, pixTex(2, 2, [230, 225, 210], 0.05));
    return m;
  },
  sheep(b, variant) {
    const woolCol = variant === 1 ? [120, 120, 120] : variant === 2 ? [40, 40, 45] : variant === 3 ? [120, 85, 60] : [235, 235, 235];
    const skin = [215, 190, 170];
    const m = quadruped(b, {
      bodyW: 0.75, bodyH: 0.65, bodyL: 1.0, legH: 0.55, legW: 0.22, headS: 0.45,
      bodyTex: pixTex(8, 8, woolCol, 0.1), legTex: pixTex(4, 4, skin, 0.08), headTex: pixTex(8, 8, woolCol, 0.1),
      faceTex: pixTex(8, 8, skin, 0.06, (c) => { eyes(c, 3); rect(c, 3, 5, 2, 1, '#c09080'); }),
    });
    return m;
  },
  chicken(b) {
    const white = [245, 245, 245];
    const m = { legs: [] };
    b.box(b.group, 0.4, 0.4, 0.5, 0, 0.45, 0, pixTex(8, 8, white, 0.05));
    for (const sx of [-1, 1]) {
      const p = b.pivot(b.group, sx * 0.1, 0.25, 0);
      b.box(p, 0.06, 0.25, 0.06, 0, -0.125, 0, pixTex(2, 2, [230, 170, 40], 0.05));
      m.legs.push(p);
    }
    m.head = b.pivot(b.group, 0, 0.7, 0.22);
    b.box(m.head, 0.26, 0.32, 0.22, 0, 0.05, 0.02, pixTex(8, 8, white, 0.04), pixTex(8, 8, white, 0.04, (c) => eyes(c, 2, '#111', '#111')));
    b.box(m.head, 0.14, 0.08, 0.12, 0, 0.02, 0.18, pixTex(2, 2, [240, 170, 40], 0.05));
    b.box(m.head, 0.08, 0.1, 0.06, 0, -0.08, 0.15, pixTex(2, 2, [210, 30, 30], 0.05));
    for (const sx of [-1, 1]) b.box(b.group, 0.05, 0.28, 0.36, sx * 0.22, 0.47, -0.02, pixTex(4, 4, [230, 230, 230], 0.06));
    return m;
  },
  zombie(b) {
    const skin = [90, 150, 90], shirt = [40, 150, 160], pants = [60, 60, 140];
    const m = { legs: [], arms: [] };
    for (const sx of [-1, 1]) {
      const p = b.pivot(b.group, sx * 0.125, 0.75, 0);
      b.box(p, 0.25, 0.75, 0.25, 0, -0.375, 0, pixTex(4, 8, pants, 0.08));
      m.legs.push(p);
    }
    b.box(b.group, 0.5, 0.75, 0.25, 0, 1.125, 0, pixTex(8, 8, shirt, 0.08));
    for (const sx of [-1, 1]) {
      const p = b.pivot(b.group, sx * 0.375, 1.4, 0);
      b.box(p, 0.25, 0.75, 0.25, 0, -0.3, 0, pixTex(4, 8, skin, 0.08, (c) => rect(c, 0, 0, 4, 3, `rgb(${shirt})`)));
      p.rotation.x = -Math.PI / 2;
      m.arms.push(p);
    }
    m.head = b.pivot(b.group, 0, 1.5, 0);
    b.box(m.head, 0.5, 0.5, 0.5, 0, 0.25, 0, pixTex(8, 8, skin, 0.1),
      pixTex(8, 8, skin, 0.1, (c) => { rect(c, 1, 3, 2, 1, '#111'); rect(c, 5, 3, 2, 1, '#111'); rect(c, 2, 5, 4, 1, '#355535'); }));
    return m;
  },
  creeper(b) {
    const green = [80, 170, 70];
    const m = { legs: [] };
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      const p = b.pivot(b.group, sx * 0.13, 0.3, sz * 0.15);
      b.box(p, 0.25, 0.3, 0.25, 0, -0.15, 0, pixTex(4, 4, green, 0.25));
      m.legs.push(p);
    }
    b.box(b.group, 0.5, 0.75, 0.28, 0, 0.675, 0, pixTex(8, 8, green, 0.3));
    m.head = b.pivot(b.group, 0, 1.05, 0);
    b.box(m.head, 0.5, 0.5, 0.5, 0, 0.25, 0, pixTex(8, 8, green, 0.3),
      pixTex(8, 8, green, 0.3, (c) => { rect(c, 1, 2, 2, 2, '#111'); rect(c, 5, 2, 2, 2, '#111'); rect(c, 3, 4, 2, 2, '#111'); rect(c, 2, 5, 1, 2, '#111'); rect(c, 5, 5, 1, 2, '#111'); }));
    return m;
  },
};

export const MOB_TYPES = {
  pig: { hp: 10, speed: 1.1, hw: 0.4, h: 0.9, passive: true, drops: (r) => [[IT.RAW_PORK, 1 + Math.floor(r * 2)]] },
  cow: { hp: 10, speed: 1.0, hw: 0.45, h: 1.4, passive: true, drops: (r) => [[IT.RAW_BEEF, 1 + Math.floor(r * 2)]] },
  sheep: { hp: 8, speed: 1.0, hw: 0.4, h: 1.3, passive: true, drops: (r, m) => [[[WOOL_WHITE, WOOL_GRAY, WOOL_BLACK, WOOL_WHITE][m.variant], 1 + Math.floor(r * 2)]] },
  chicken: { hp: 4, speed: 1.0, hw: 0.2, h: 0.7, passive: true, drops: (r) => [[IT.RAW_CHICKEN, 1], [IT.FEATHER, Math.floor(r * 3)]] },
  zombie: { hp: 20, speed: 2.1, hw: 0.3, h: 1.9, hostile: true, damage: 3, drops: (r) => [[IT.ROTTEN_FLESH, Math.floor(r * 3)]] },
  creeper: { hp: 20, speed: 1.9, hw: 0.3, h: 1.7, hostile: true, drops: (r) => [[IT.GUNPOWDER, Math.floor(r * 3)]] },
};

// ---------- Entities ----------
class Entity extends Body {
  constructor(world, hw, h) { super(world, hw, h); this.dead = false; this.age = 0; }
  dispose(scene) { scene.remove(this.obj); this.obj.traverse((o) => { if (o.isMesh) { o.geometry.dispose(); } }); }
}

export class Mob extends Entity {
  constructor(game, type, x, y, z) {
    const t = MOB_TYPES[type];
    super(game.world, t.hw, t.h);
    this.game = game;
    this.type = type;
    this.t = t;
    this.hp = t.hp;
    this.pos = [x, y, z];
    this.yaw = Math.random() * Math.PI * 2;
    this.variant = type === 'sheep' ? (Math.random() < 0.8 ? 0 : 1 + Math.floor(Math.random() * 3)) : 0;
    const b = new ModelBuilder();
    this.model = MODELS[type](b, this.variant);
    this.mats = b.mats;
    this.obj = b.group;
    game.scene.add(this.obj);
    this.walkPhase = 0;
    this.moveDir = [0, 0];
    this.wanderTimer = 0;
    this.panic = 0;
    this.hurtTimer = 0;
    this.attackCooldown = 0;
    this.fuse = 0;
    this.deathTimer = 0;
    this.burnTimer = 0;
    this.soundTimer = 3 + Math.random() * 10;
  }

  hurt(dmg, fromX, fromZ) {
    if (this.hp <= 0) return;
    this.hp -= dmg;
    this.hurtTimer = 0.35;
    const dx = this.pos[0] - fromX, dz = this.pos[2] - fromZ, d = Math.hypot(dx, dz) || 1;
    this.vel[0] += (dx / d) * 6;
    this.vel[2] += (dz / d) * 6;
    this.vel[1] = 5;
    if (this.t.passive) this.panic = 4;
    this.game.sound.mob(this.type, this.hp <= 0 ? 'death' : 'hurt', this.distToPlayer());
    if (this.hp <= 0) this.deathTimer = 0.6;
  }

  distToPlayer() {
    const p = this.game.player.pos;
    return Math.hypot(p[0] - this.pos[0], p[1] - this.pos[1], p[2] - this.pos[2]);
  }

  update(dt) {
    const g = this.game, p = this.pos, v = this.vel;
    this.age += dt;
    this.sense(this.h * 0.85);

    // Dying: tip over, then drop loot
    if (this.hp <= 0) {
      this.deathTimer -= dt;
      this.obj.rotation.z = Math.min(Math.PI / 2, (0.6 - this.deathTimer) * 5);
      this.applyTint(1, 0.4, 0.4);
      if (this.deathTimer <= 0) {
        this.dead = true;
        g.spawnParticles(p[0] - 0.5, p[1], p[2] - 0.5, 'poof', 16);
        if (g.mode === 'survival') for (const [id, n] of this.t.drops(Math.random(), this)) if (n > 0) g.entities.dropItem(id, n, p[0], p[1] + 0.5, p[2]);
      }
      v[1] -= GRAVITY * dt;
      this.integrate(dt);
      this.syncObj();
      return;
    }

    const player = g.player;
    const dx = player.pos[0] - p[0], dz = player.pos[2] - p[2], dy = player.pos[1] - p[1];
    const distH = Math.hypot(dx, dz);
    const hostileActive = this.t.hostile && g.mode === 'survival' && g.alive() && g.difficulty > 0;
    let speed = 0;

    if (hostileActive && distH < 18 && Math.abs(dy) < 8) {
      // Chase the player
      this.yawToward(Math.atan2(dx, dz), dt * 6);
      speed = this.t.speed;
      if (this.type === 'creeper') {
        if (distH < 2.6) {
          if (this.fuse === 0) g.sound.hiss(distH);
          this.fuse += dt;
          speed = 0;
        } else if (distH > 5) this.fuse = Math.max(0, this.fuse - dt);
        else if (this.fuse > 0) { this.fuse += dt; speed = 0.4; }
        if (this.fuse >= 1.5) {
          this.dead = true;
          g.explode(Math.floor(p[0]), Math.floor(p[1] + 0.5), Math.floor(p[2]), 3.2, 'was blown up by a Creeper');
          return;
        }
      } else if (distH < 0.8 + this.hw && Math.abs(dy) < 1.6) {
        speed = 0.3;
        if (this.attackCooldown <= 0) {
          this.attackCooldown = 1;
          g.damagePlayer(this.t.damage + (g.difficulty - 2), 'was slain by a Zombie', p[0], p[2]);
        }
      }
    } else {
      this.fuse = Math.max(0, this.fuse - dt);
      // Wander / panic
      this.wanderTimer -= dt;
      if (this.panic > 0) {
        this.panic -= dt;
        if (this.wanderTimer <= 0) { this.targetYaw = Math.atan2(-dx, -dz) + (Math.random() - 0.5) * 1.5; this.wanderTimer = 0.8; }
        speed = this.t.speed * 2.2;
      } else if (this.wanderTimer <= 0) {
        this.wanderTimer = 2 + Math.random() * 5;
        this.walking = Math.random() < 0.6;
        this.targetYaw = Math.random() * Math.PI * 2;
      } else if (this.walking) speed = this.t.speed;
      if (this.targetYaw !== undefined) this.yawToward(this.targetYaw, dt * 3);
      // Don't walk off cliffs
      if (speed > 0 && this.cliffAhead()) { speed = 0; this.wanderTimer = 0; }
    }
    this.attackCooldown -= dt;

    // Movement physics
    const fx = Math.sin(this.yaw), fz = Math.cos(this.yaw);
    const k = Math.min(1, dt * (this.onGround ? 10 : 2));
    v[0] += (fx * speed - v[0]) * k;
    v[2] += (fz * speed - v[2]) * k;
    if (this.inWater || this.inLava) {
      v[1] = Math.min(v[1] + 20 * dt, 2.5); // float
    } else {
      v[1] -= GRAVITY * dt;
      if (this.type === 'chicken') v[1] = Math.max(v[1], -2.5);
    }
    const wasOnGround = this.onGround;
    this.integrate(dt);
    if (this.blockedH && wasOnGround && speed > 0 && this.canStepUp(fx, fz)) v[1] = 8.2;
    else if (this.blockedH && speed > 0 && !hostileActive) this.wanderTimer = 0;

    // Environmental damage
    this.lavaTimer = (this.lavaTimer || 0) - dt;
    if (this.inLava && this.lavaTimer <= 0) { this.lavaTimer = 0.5; this.hurt(4, p[0] - v[0], p[2] - v[2]); }
    if (this.type === 'zombie' && g.daylightLevel() > 0.7 && !this.inWater) {
      const sky = g.world.getLight(Math.floor(p[0]), Math.floor(p[1] + 1.6), Math.floor(p[2])) >> 4;
      if (sky >= 15) {
        this.burnTimer += dt;
        if (Math.random() < dt * 10) g.spawnParticles(p[0] - 0.5, p[1] + Math.random() * 1.6, p[2] - 0.5, 'flame', 1);
        if (this.burnTimer > 1) { this.burnTimer = 0; this.hurt(2, p[0] - v[0], p[2] - v[2]); }
      }
    }

    // Sounds
    this.soundTimer -= dt;
    if (this.soundTimer <= 0) {
      this.soundTimer = 6 + Math.random() * 12;
      const d = this.distToPlayer();
      if (d < 16) g.sound.mob(this.type, 'idle', d);
    }

    // Animation
    const moving = Math.hypot(v[0], v[2]);
    this.walkPhase += moving * dt * 5;
    const swing = Math.sin(this.walkPhase) * Math.min(1, moving) * 0.7;
    this.model.legs.forEach((l, i) => { l.rotation.x = (i % 2 === (i >> 1) % 2 ? swing : -swing); });
    if (this.model.arms) this.model.arms.forEach((a, i) => { a.rotation.x = -Math.PI / 2 + Math.sin(this.age * 2 + i) * 0.08; });
    if (this.model.head && hostileActive && distH < 18) {
      this.model.head.rotation.x = -Math.atan2(dy + 1.6 - this.h * 0.85, distH) * 0.6;
    } else if (this.model.head) this.model.head.rotation.x = Math.sin(this.age * 0.7) * 0.1;

    // Lighting & tint
    this.hurtTimer -= dt;
    const light = g.brightnessAt(p[0], p[1] + this.h * 0.6, p[2]);
    if (this.hurtTimer > 0) this.applyTint(light * 1.4, light * 0.4, light * 0.4);
    else if (this.fuse > 0 && Math.floor(this.fuse * 8) % 2 === 0) this.applyTint(2.5, 2.5, 2.5);
    else this.applyTint(light, light, light);
    if (this.fuse > 0) this.obj.scale.setScalar(1 + this.fuse * 0.08);
    this.syncObj();
  }

  cliffAhead() {
    const w = this.world, p = this.pos;
    const ax = Math.floor(p[0] + Math.sin(this.yaw) * (this.hw + 0.4)), az = Math.floor(p[2] + Math.cos(this.yaw) * (this.hw + 0.4));
    const fy = Math.floor(p[1] + 0.01);
    for (let i = 1; i <= 3; i++) if (w.isSolidAt(ax, fy - i, az) || w.getBlock(ax, fy - i, az) === WATER) return false;
    return !w.isSolidAt(ax, fy, az);
  }

  yawToward(target, k) {
    let d = target - this.yaw;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    this.yaw += d * Math.min(1, k);
  }

  applyTint(r, g, b) { for (const m of this.mats) m.color.setRGB(r, g, b); }

  syncObj() {
    this.obj.position.set(this.pos[0], this.pos[1], this.pos[2]);
    this.obj.rotation.y = this.yaw;
  }

  dispose(scene) {
    super.dispose(scene);
    for (const m of this.mats) { m.map?.dispose(); m.dispose(); }
  }
}

const ITEM_GEO_CACHE = new Map();
export class ItemEntity extends Entity {
  constructor(game, id, count, x, y, z, atlasTexture) {
    super(game.world, 0.12, 0.25);
    this.game = game;
    this.id = id;
    this.count = count;
    this.pos = [x, y, z];
    this.vel = [(Math.random() - 0.5) * 3, 3 + Math.random() * 2, (Math.random() - 0.5) * 3];
    this.pickupDelay = 0.6;
    const obj = new THREE.Group();
    let mesh;
    if (id < 256) {
      if (!ITEM_GEO_CACHE.has(id)) ITEM_GEO_CACHE.set(id, buildBlockGeometry(id));
      mesh = new THREE.Mesh(ITEM_GEO_CACHE.get(id), new THREE.MeshBasicMaterial({ map: atlasTexture, vertexColors: true, alphaTest: 0.5, side: THREE.DoubleSide }));
      mesh.scale.setScalar(0.28);
      mesh.userData.shared = true;
    } else {
      mesh = new THREE.Mesh(new THREE.PlaneGeometry(0.4, 0.4),
        new THREE.MeshBasicMaterial({ map: itemTexture(id), alphaTest: 0.5, side: THREE.DoubleSide }));
    }
    mesh.position.y = 0.2;
    obj.add(mesh);
    this.mesh = mesh;
    this.obj = obj;
    game.scene.add(obj);
  }

  update(dt) {
    const g = this.game, p = this.pos, v = this.vel;
    this.age += dt;
    this.pickupDelay -= dt;
    this.sense(0.1);
    if (this.inWater) v[1] = Math.min(v[1] + 18 * dt, 1.5);
    else v[1] -= GRAVITY * 0.8 * dt;
    const f = this.onGround ? Math.max(0, 1 - dt * 8) : 1 - dt * 0.5;
    v[0] *= f; v[2] *= f;
    this.integrate(dt);
    if (this.inLava || this.age > 300) { this.dead = true; return; }

    // Pickup
    const pp = g.player.pos;
    const dx = pp[0] - p[0], dy = pp[1] + 0.8 - p[1], dz = pp[2] - p[2];
    const d = Math.hypot(dx, dy, dz);
    if (this.pickupDelay <= 0 && g.alive() && d < 2.2) {
      const k = Math.min(1, dt * 12);
      p[0] += dx * k; p[1] += dy * k; p[2] += dz * k;
      if (d < 0.6) { this.dead = true; g.pickup(this.id, this.count); return; }
    }
    this.mesh.rotation.y = this.age * 2;
    this.mesh.position.y = 0.22 + Math.sin(this.age * 3) * 0.06;
    this.mesh.material.color.setScalar(g.brightnessAt(p[0], p[1] + 0.3, p[2]));
    this.obj.position.set(p[0], p[1], p[2]);
  }

  dispose(scene) {
    scene.remove(this.obj);
    if (!this.mesh.userData.shared) this.mesh.geometry.dispose();
    this.mesh.material.dispose();
  }
}

export class FallingBlock extends Entity {
  constructor(game, id, x, y, z, atlasTexture) {
    super(game.world, 0.49, 0.98);
    this.game = game;
    this.id = id;
    this.pos = [x + 0.5, y, z + 0.5];
    if (!ITEM_GEO_CACHE.has(id)) ITEM_GEO_CACHE.set(id, buildBlockGeometry(id));
    this.mesh = new THREE.Mesh(ITEM_GEO_CACHE.get(id), new THREE.MeshBasicMaterial({ map: atlasTexture, vertexColors: true }));
    this.mesh.position.y = 0.5;
    this.obj = new THREE.Group();
    this.obj.add(this.mesh);
    game.scene.add(this.obj);
  }
  update(dt) {
    const g = this.game, p = this.pos;
    this.vel[1] = Math.max(this.vel[1] - GRAVITY * dt, -30);
    this.integrate(dt);
    this.mesh.material.color.setScalar(g.brightnessAt(p[0], p[1] + 0.5, p[2]));
    this.obj.position.set(p[0], p[1], p[2]);
    if (this.onGround || this.age > 10) {
      this.dead = true;
      const x = Math.floor(p[0]), y = Math.floor(p[1] + 0.5), z = Math.floor(p[2]);
      const cur = g.world.getBlock(x, y, z);
      if (BLOCKS[cur].replaceable) g.setBlock(x, y, z, this.id);
      else if (g.mode === 'survival') g.entities.dropItem(this.id, 1, p[0], p[1] + 0.5, p[2]);
    }
    this.age += dt;
  }
  dispose(scene) { scene.remove(this.obj); this.mesh.material.dispose(); }
}

// ---------- Manager ----------
export class EntityManager {
  constructor(game) {
    this.game = game;
    this.list = [];
    this.spawnTimer = 0;
  }

  add(e) { this.list.push(e); return e; }
  spawnMob(type, x, y, z) { return this.add(new Mob(this.game, type, x, y, z)); }
  dropItem(id, count, x, y, z) { return this.add(new ItemEntity(this.game, id, count, x, y, z, this.game.atlas.texture)); }
  spawnFalling(id, x, y, z) { return this.add(new FallingBlock(this.game, id, x, y, z, this.game.atlas.texture)); }

  get mobs() { return this.list.filter((e) => e instanceof Mob); }

  update(dt) {
    const g = this.game;
    for (const e of this.list) {
      // Freeze entities in chunks that aren't loaded (they'd fall through the world)
      const c = g.world.getChunk(Math.floor(e.pos[0] / CX), Math.floor(e.pos[2] / CZ));
      if (!c) { e.dead = true; continue; }
      e.update(dt);
    }
    for (let i = this.list.length - 1; i >= 0; i--) {
      if (this.list[i].dead) { this.list[i].dispose(g.scene); this.list.splice(i, 1); }
    }
    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0) { this.spawnTimer = 1; this.trySpawn(); }
  }

  // Nearest mob hit by a ray, or null
  raycast(origin, dir, maxDist) {
    let best = null;
    for (const e of this.list) {
      if (!(e instanceof Mob) || e.hp <= 0) continue;
      const p = e.pos;
      const r = rayBox(origin, dir, p[0] - e.hw, p[1], p[2] - e.hw, p[0] + e.hw, p[1] + e.h, p[2] + e.hw);
      if (r && r.t <= maxDist && (!best || r.t < best.dist)) best = { mob: e, dist: r.t };
    }
    return best;
  }

  countNear(pred, radius) {
    const pp = this.game.player.pos;
    return this.list.filter((e) => e instanceof Mob && pred(e) && Math.hypot(e.pos[0] - pp[0], e.pos[2] - pp[2]) < radius).length;
  }

  // Herds appear when new terrain is generated
  onChunkGenerated(chunk, heights, biomes) {
    if (Math.random() > 0.1) return;
    const x = Math.floor(Math.random() * CX), z = Math.floor(Math.random() * CZ);
    const h = heights[z * CX + x], biome = biomes[z * CX + x];
    const ground = chunk.data[(h * CZ + z) * CX + x];
    if (ground !== GRASS && ground !== SNOW) return;
    if (biome === BIOME_DESERT) return;
    const types = biome === BIOME_SNOW || biome === BIOME_TAIGA ? ['sheep', 'sheep', 'cow'] : ['pig', 'cow', 'sheep', 'chicken'];
    const type = types[Math.floor(Math.random() * types.length)];
    const n = 2 + Math.floor(Math.random() * 3);
    if (this.countNear((e) => e.t.passive, 96) > 24) return;
    for (let i = 0; i < n; i++) {
      const wx = chunk.cx * CX + x + (Math.random() - 0.5) * 3, wz = chunk.cz * CZ + z + (Math.random() - 0.5) * 3;
      this.spawnMob(type, wx, h + 1.2, wz);
    }
  }

  trySpawn() {
    const g = this.game;
    if (g.mode !== 'survival' || g.difficulty === 0) {
      for (const e of this.list) if (e instanceof Mob && e.t.hostile) e.dead = true;
      return;
    }
    const pp = g.player.pos;
    // Despawn distant hostiles
    for (const e of this.list) {
      if (e instanceof Mob && e.t.hostile && Math.hypot(e.pos[0] - pp[0], e.pos[2] - pp[2]) > 80) e.dead = true;
    }
    const cap = [0, 3, 6, 9][g.difficulty];
    if (this.countNear((e) => e.t.hostile, 80) >= cap) return;
    const a = Math.random() * Math.PI * 2, r = 20 + Math.random() * 24;
    const x = Math.floor(pp[0] + Math.cos(a) * r), z = Math.floor(pp[2] + Math.sin(a) * r);
    const w = g.world;
    if (!w.getChunk(Math.floor(x / CX), Math.floor(z / CZ))?.light) return;
    // Candidate: surface, or a random cave floor below it
    const surface = w.surfaceHeight(x, z);
    const candidates = [surface + 1];
    for (let i = 0; i < 3; i++) candidates.push(3 + Math.floor(Math.random() * Math.max(1, surface - 6)));
    for (const y of candidates) {
      if (y < 1 || y >= H - 2) continue;
      if (!SOLID[w.getBlock(x, y - 1, z)] || w.getBlock(x, y, z) !== AIR || w.getBlock(x, y + 1, z) !== AIR) continue;
      const l = w.getLight(x, y, z);
      const effective = Math.max(l & 15, (l >> 4) * g.daylightLevel());
      if (effective > 6) continue;
      this.spawnMob(Math.random() < 0.6 ? 'zombie' : 'creeper', x + 0.5, y, z + 0.5);
      return;
    }
  }

  clear() {
    for (const e of this.list) e.dispose(this.game.scene);
    this.list = [];
  }
}

