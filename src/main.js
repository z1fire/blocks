import * as THREE from 'three';
import { App } from '@capacitor/app';
import {
  BLOCKS, AIR, WATER, LAVA, TNT, BEDROCK, GRASS, DIRT, STONE, COBBLE, PLANKS, LOG, GLASS, TORCH,
  FARMLAND, CACTUS, SNOW, SAND, CRAFTING, FURNACE, OBSIDIAN, DEAD_BUSH, RED_MUSHROOM, BROWN_MUSHROOM,
  SOLID, createAtlas, TILE_COUNT,
} from './blocks.js';
import { ITEMS, HOE_TARGETS, getDef, itemName, iconFor } from './items.js';
import { World, CX, CZ, H, WATER_LEVEL, chunkKey, placeTree, BIOME_NAMES } from './world.js';
import { buildChunkGeometry } from './mesher.js';
import { Player, EYE, raycast } from './player.js';
import { Controls } from './controls.js';
import { Sound } from './sound.js';
import { blockMaterial, lightUniforms } from './materials.js';
import { EntityManager } from './entities.js';
import { Hand } from './hand.js';
import { Weather } from './weather.js';
import { Inventory, mining, dropsFor, attackDamage, craft } from './inventory.js';
import { listWorlds, loadWorld, saveWorld, deleteWorld, newWorldId } from './storage.js';
import { $, renderStats, renderHotbar, buildInventory, renderWorldList } from './ui.js';

THREE.ColorManagement.enabled = false;

const SETTINGS_KEY = 'blocks-settings-v1';
const DAY_LENGTH = 1200; // seconds per full day
const REACH = 5.5, MOB_REACH = 3.5;
const CURVE = (l) => Math.pow(0.8, 15 - l);

const isTouch = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
document.body.classList.toggle('is-touch', isTouch);
$('version').textContent = `v${__APP_VERSION__}`;
const SPLASHES = ['a pocket voxel sandbox', 'now with creepers!', 'mind the lava', 'torches not included', 'punch a tree!', 'moo.', 'crafted on a phone'];
$('splash').textContent = SPLASHES[Math.floor(Math.random() * SPLASHES.length)];

// ---------- Settings ----------
const settings = Object.assign(
  { rd: isTouch ? 4 : 6, sens: 1, res: isTouch ? 1 : Math.min(devicePixelRatio, 2), fov: 75, info: false, sound: true, diff: 2, bob: true, hand: true },
  safeParse(localStorage.getItem(SETTINGS_KEY)) || {},
);
function safeParse(s) { try { return JSON.parse(s); } catch { return null; } }
function saveSettings() { try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); } catch { /* ignore */ } }

// ---------- Renderer / scene ----------
const canvas = $('view');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: !isTouch, powerPreference: 'high-performance' });
renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(settings.fov, 1, 0.05, 1000);
camera.rotation.order = 'YXZ';
scene.background = new THREE.Color(0x87b8ff);

const atlas = createAtlas();
const hand = new Hand(atlas.texture);

function resize() {
  renderer.setPixelRatio(Math.min(settings.res, devicePixelRatio || 1));
  renderer.setSize(window.innerWidth, window.innerHeight, false);
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  hand.resize(camera.aspect);
}
window.addEventListener('resize', resize);
resize();

const solidMat = blockMaterial(atlas.texture, { alphaCut: 0.5 });
const waterMat = blockMaterial(atlas.texture, { transparent: true, opacity: 0.72, alphaCut: 0.01, side: THREE.DoubleSide });
const chunkGroup = new THREE.Group();
scene.add(chunkGroup);

// Block selection outline + breaking cracks
const outline = new THREE.LineSegments(
  new THREE.EdgesGeometry(new THREE.BoxGeometry(1.004, 1.004, 1.004)),
  new THREE.LineBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.6 }),
);
outline.visible = false;
scene.add(outline);
const crack = (() => {
  const c = document.createElement('canvas');
  c.width = 160; c.height = 16;
  const ctx = c.getContext('2d');
  let s = 99;
  const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  const lines = [];
  for (let i = 0; i < 40; i++) {
    let x = 8, y = 8;
    const pts = [[x, y]];
    const a = r() * Math.PI * 2;
    for (let k = 0; k < 6; k++) { x += Math.cos(a + (r() - 0.5)) * 1.6; y += Math.sin(a + (r() - 0.5)) * 1.6; pts.push([x, y]); }
    lines.push(pts);
  }
  for (let f = 0; f < 10; f++) {
    ctx.fillStyle = 'rgba(0,0,0,0.75)';
    const n = Math.floor((f + 1) * 4);
    for (let i = 0; i < n; i++) {
      const len = Math.min(lines[i].length, 2 + Math.floor(f / 2));
      for (let k = 0; k < len; k++) ctx.fillRect(f * 16 + Math.floor(lines[i][k][0]), Math.floor(lines[i][k][1]), 1, 1);
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.magFilter = tex.minFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  tex.repeat.set(0.1, 1);
  const m = new THREE.Mesh(new THREE.BoxGeometry(1.006, 1.006, 1.006),
    new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }));
  m.visible = false;
  scene.add(m);
  return m;
})();

// Sun, moon, stars, clouds
const skyPivot = new THREE.Group();
scene.add(skyPivot);
const sun = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), new THREE.MeshBasicMaterial({ color: 0xfff3a0, fog: false, depthWrite: false, transparent: true }));
sun.position.set(0, 0, -300);
const moon = new THREE.Mesh(new THREE.PlaneGeometry(26, 26), new THREE.MeshBasicMaterial({ color: 0xe8ecff, fog: false, depthWrite: false, transparent: true }));
moon.position.set(0, 0, 300);
moon.rotation.y = Math.PI;
const stars = (() => {
  const g = new THREE.BufferGeometry();
  const a = new Float32Array(600 * 3);
  for (let i = 0; i < 600; i++) {
    const u = Math.random() * 2 - 1, t = Math.random() * Math.PI * 2, r = Math.sqrt(1 - u * u);
    a[i * 3] = r * Math.cos(t) * 350; a[i * 3 + 1] = u * 350; a[i * 3 + 2] = r * Math.sin(t) * 350;
  }
  g.setAttribute('position', new THREE.BufferAttribute(a, 3));
  return new THREE.Points(g, new THREE.PointsMaterial({ color: 0xffffff, size: 1.6, sizeAttenuation: false, transparent: true, depthWrite: false, fog: false }));
})();
skyPivot.add(sun, moon, stars);
sun.renderOrder = moon.renderOrder = stars.renderOrder = -1;

const clouds = (() => {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const ctx = c.getContext('2d');
  let s = 12345;
  const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 26; i++) {
    ctx.fillStyle = '#fff';
    ctx.fillRect(Math.floor(r() * 64), Math.floor(r() * 64), 3 + Math.floor(r() * 8), 2 + Math.floor(r() * 5));
  }
  const tex = new THREE.CanvasTexture(c);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(4, 4);
  const m = new THREE.Mesh(new THREE.PlaneGeometry(1600, 1600),
    new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: 0.8, depthWrite: false, side: THREE.DoubleSide, fog: false }));
  m.rotation.x = -Math.PI / 2;
  m.position.y = H + 20;
  scene.add(m);
  return m;
})();

const weather = new Weather(scene);

// Particles
const MAX_PARTICLES = 600;
const particles = (() => {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(MAX_PARTICLES * 3), 3));
  g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(MAX_PARTICLES * 3), 3));
  g.setDrawRange(0, 0);
  const pts = new THREE.Points(g, new THREE.PointsMaterial({ size: 0.14, vertexColors: true, sizeAttenuation: true }));
  pts.frustumCulled = false;
  scene.add(pts);
  return { pts, g, list: [] };
})();
const tileColors = (() => {
  const ctx = atlas.canvas.getContext('2d');
  const out = [];
  for (let t = 0; t < TILE_COUNT; t++) {
    const d = ctx.getImageData(t * 16, 0, 16, 16).data;
    let r = 0, gg = 0, b = 0, n = 0;
    for (let i = 0; i < d.length; i += 4) if (d[i + 3] > 0) { r += d[i]; gg += d[i + 1]; b += d[i + 2]; n++; }
    out.push(n ? [r / n / 255, gg / n / 255, b / n / 255] : [1, 1, 1]);
  }
  return out;
})();
const PARTICLE_KINDS = { poof: [0.9, 0.9, 0.9], flame: [1, 0.55, 0.1], smoke: [0.35, 0.35, 0.35], splash: [0.5, 0.65, 1], crit: [1, 1, 0.6] };
function spawnParticles(x, y, z, kind, count = 14, speed = 3) {
  const col = typeof kind === 'number' ? tileColors[BLOCKS[kind].tiles[1]] : Array.isArray(kind) ? kind : PARTICLE_KINDS[kind];
  const glow = kind === 'flame' || kind === 'crit';
  for (let i = 0; i < count; i++) {
    if (particles.list.length >= MAX_PARTICLES) particles.list.shift();
    particles.list.push({
      p: [x + Math.random(), y + Math.random(), z + Math.random()],
      v: [(Math.random() - 0.5) * speed, Math.random() * speed * (kind === 'flame' ? 0.3 : 1), (Math.random() - 0.5) * speed],
      c: col.map((c) => c * (0.7 + Math.random() * 0.3)),
      life: 0.5 + Math.random() * 0.5,
      g: kind === 'poof' || kind === 'smoke' ? -2 : kind === 'flame' ? -3 : 18,
      glow,
    });
  }
}
function updateParticles(dt) {
  const list = particles.list;
  const pos = particles.g.attributes.position.array, col = particles.g.attributes.color.array;
  for (let i = list.length - 1; i >= 0; i--) {
    const q = list[i];
    q.life -= dt;
    if (q.life <= 0) { list.splice(i, 1); continue; }
    q.v[1] -= q.g * dt;
    const nx = q.p[0] + q.v[0] * dt, ny = q.p[1] + q.v[1] * dt, nz = q.p[2] + q.v[2] * dt;
    if (world && world.isSolidAt(Math.floor(nx), Math.floor(ny), Math.floor(nz))) { q.v[0] *= 0.3; q.v[1] = 0; q.v[2] *= 0.3; }
    else { q.p[0] = nx; q.p[1] = ny; q.p[2] = nz; }
  }
  let n = 0;
  for (const q of list) {
    const l = q.glow ? 1 : brightnessAt(q.p[0], q.p[1], q.p[2]);
    pos[n * 3] = q.p[0]; pos[n * 3 + 1] = q.p[1]; pos[n * 3 + 2] = q.p[2];
    col[n * 3] = q.c[0] * l; col[n * 3 + 1] = q.c[1] * l; col[n * 3 + 2] = q.c[2] * l;
    n++;
  }
  particles.g.setDrawRange(0, n);
  particles.g.attributes.position.needsUpdate = true;
  particles.g.attributes.color.needsUpdate = true;
}

// ---------- Game state ----------
let world = null, player = null, meta = null;
let state = 'menu'; // menu | playing | paused | inventory | dead | sleeping
let mode = 'survival';
let timeOfDay = 0.05;
let daylight = 1;
let inv = new Inventory();
let health = 20, hunger = 20, exhaustion = 0, air = 10;
let regenTimer = 0, starveTimer = 0, drownTimer = 0, hazardTimer = 0, invuln = 0, fallPeak = null;
let spawn = [0, 60, 0];
let breakState = null, target = null, mobTarget = null, attackCooldown = 0;
let saveTimer = 0, tickTimer = 0, stepDist = 0, fovKick = 0;
const fuses = [];
const sound = new Sound(() => settings.sound);

const DEFAULT_CREATIVE_HOTBAR = [GRASS, DIRT, STONE, COBBLE, PLANKS, LOG, GLASS, TORCH, TNT];

function daylightLevel() { return Math.max(0, Math.min(1, (daylight - 0.2) / 0.8)); }
function brightnessAt(x, y, z) {
  if (!world) return 1;
  const l = world.getLight(Math.floor(x), Math.floor(y), Math.floor(z));
  return Math.max(0.05, CURVE(l >> 4) * daylight, CURVE(l & 15));
}

// Shared context for entities and other systems
const game = {
  scene, atlas, sound,
  get world() { return world; },
  get player() { return player; },
  get mode() { return mode; },
  get difficulty() { return settings.diff; },
  get inv() { return inv; },
  get health() { return health; },
  get hunger() { return hunger; },
  get air() { return air; },
  entities: null,
  alive: () => state !== 'dead' && health > 0,
  icon: (id) => iconFor(atlas.canvas, id),
  spawnParticles,
  brightnessAt,
  daylightLevel,
  damagePlayer: (n, reason, fx, fz) => damagePlayer(n, reason, fx, fz),
  explode: (x, y, z, power, reason) => explode(x, y, z, power, reason),
  setBlock: (x, y, z, id) => setBlock(x, y, z, id),
  pickup: (id, n) => { inv.add(id, n); sound.pop(); renderHotbar(game, $('hotbar'), selectSlot); },
};
const entities = new EntityManager(game);
game.entities = entities;

const controls = new Controls(canvas, {
  isActive: () => state === 'playing',
  onPlace: () => useOrPlace(),
  onToggleFly: () => toggleFly(),
  onHotbar: (n) => selectSlot(n),
  onHotbarScroll: (d) => selectSlot((inv.sel + d + 9) % 9),
  onInventory: () => openInventory(),
  onPause: () => pause(),
});
controls.sensitivity = settings.sens;

// ---------- Chunk management ----------
const offsetCache = new Map();
function offsets(r) {
  if (offsetCache.has(r)) return offsetCache.get(r);
  const list = [];
  for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) {
    if (dx * dx + dz * dz <= (r + 0.5) * (r + 0.5)) list.push([dx, dz, dx * dx + dz * dz]);
  }
  list.sort((a, b) => a[2] - b[2]);
  offsetCache.set(r, list);
  return list;
}

function neighborsReady(c) {
  for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
    if (!world.chunks.has(chunkKey(c.cx + dx, c.cz + dz))) return false;
  }
  return true;
}

function meshChunk(c) {
  const { solid, water } = buildChunkGeometry(world, c);
  const apply = (old, geo, mat) => {
    if (old) { chunkGroup.remove(old); old.geometry.dispose(); }
    if (!geo) return null;
    const m = new THREE.Mesh(geo, mat);
    m.position.set(c.cx * CX, 0, c.cz * CZ);
    m.matrixAutoUpdate = false;
    m.updateMatrix();
    chunkGroup.add(m);
    return m;
  };
  c.mesh = apply(c.mesh, solid, solidMat);
  c.waterMesh = apply(c.waterMesh, water, waterMat);
  if (c.waterMesh) c.waterMesh.renderOrder = 1;
  c.dirty = false;
  c.urgent = false;
  c.meshed = true;
}

function unloadChunk(c) {
  for (const m of [c.mesh, c.waterMesh]) if (m) { chunkGroup.remove(m); m.geometry.dispose(); }
  world.chunks.delete(chunkKey(c.cx, c.cz));
}

let unloadTimer = 0;
// Generates and meshes chunks within a per-frame time budget (always at least one of each)
function updateChunks(dt, budgetMs = 7) {
  const pcx = Math.floor(player.pos[0] / CX), pcz = Math.floor(player.pos[2] / CZ);
  const R = settings.rd;
  const start = performance.now();
  const over = () => performance.now() - start > budgetMs;
  // Edited chunks first (the player is looking at them)
  for (const c of world.chunks.values()) {
    if (c.urgent && c.dirty && c.meshed) { meshChunk(c); if (over()) return; }
  }
  let did = false;
  for (const [dx, dz] of offsets(R + 1)) {
    const cx = pcx + dx, cz = pcz + dz;
    if (!world.chunks.has(chunkKey(cx, cz))) { world.generate(cx, cz); did = true; if (over()) break; }
  }
  did = false;
  for (const [dx, dz] of offsets(R)) {
    const c = world.getChunk(pcx + dx, pcz + dz);
    if (c && c.dirty && neighborsReady(c)) { meshChunk(c); if (did && over()) break; did = true; }
  }
  unloadTimer += dt;
  if (unloadTimer > 1) {
    unloadTimer = 0;
    const lim = (R + 2) * (R + 2);
    for (const c of [...world.chunks.values()]) {
      const dx = c.cx - pcx, dz = c.cz - pcz;
      if (dx * dx + dz * dz > lim) unloadChunk(c);
    }
  }
}

// Remesh the chunk that was just edited right away; neighbours follow over the next frames
function flushUrgent() {
  for (const c of world.chunks.values()) if (c.urgent && c.dirty && c.meshed) { meshChunk(c); break; }
}

// ---------- Block changes & updates ----------
function setBlock(x, y, z, id) {
  if (!world.setBlock(x, y, z, id)) return false;
  updateAround(x, y, z);
  return true;
}

function supportOk(id, below) {
  const b = BLOCKS[id];
  if (!SOLID[below] || BLOCKS[below].model === 'cross') return false;
  if (b.tick === 'crop') return below === FARMLAND;
  if (id === DEAD_BUSH) return below === SAND;
  if (b.model === 'cross' && id !== RED_MUSHROOM && id !== BROWN_MUSHROOM) return below === GRASS || below === DIRT || below === SNOW || below === FARMLAND;
  return true;
}

function updateAround(x, y, z) {
  const queue = [[x, y, z], [x, y + 1, z], [x, y - 1, z], [x + 1, y, z], [x - 1, y, z], [x, y, z + 1], [x, y, z - 1]];
  let guard = 0;
  while (queue.length && guard++ < 200) {
    const [bx, by, bz] = queue.shift();
    const id = world.getBlock(bx, by, bz);
    if (id === AIR) continue;
    const b = BLOCKS[id];
    const below = world.getBlock(bx, by - 1, bz);
    if (b.gravity && BLOCKS[below].replaceable && by > 0) {
      world.setBlock(bx, by, bz, AIR);
      entities.spawnFalling(id, bx, by, bz);
      queue.push([bx, by + 1, bz]);
    } else if (b.needsSupport && !supportOk(id, below)) {
      world.setBlock(bx, by, bz, AIR);
      if (mode === 'survival') for (const [d, n] of dropsFor(id, Math.random(), true)) if (n > 0) entities.dropItem(d, n, bx + 0.5, by + 0.3, bz + 0.5);
      spawnParticles(bx, by, bz, id, 6);
      queue.push([bx, by + 1, bz]);
    } else if (id === FARMLAND && SOLID[world.getBlock(bx, by + 1, bz)]) {
      world.setBlock(bx, by, bz, DIRT);
    }
  }
}

// ---------- Interaction ----------
function lookDir() {
  const cp = Math.cos(player.pitch);
  return [-Math.sin(player.yaw) * cp, Math.sin(player.pitch), -Math.cos(player.yaw) * cp];
}
function eyePos() { return [player.pos[0], player.pos[1] + EYE, player.pos[2]]; }

function breakBlock(t) {
  const [x, y, z] = t.hit;
  const id = world.getBlock(x, y, z);
  if (id === AIR || BLOCKS[id].liquid) return;
  if (id === BEDROCK && mode !== 'creative') return;
  if (id === TNT && mode === 'survival') { ignite(x, y, z); return; }
  const held = inv.selected;
  const { harvest } = mining(id, held, mode === 'creative');
  // Neighbouring liquid flows into the hole
  const flow = [[0, 1, 0], [1, 0, 0], [-1, 0, 0], [0, 0, 1], [0, 0, -1]]
    .map(([dx, dy, dz]) => world.getBlock(x + dx, y + dy, z + dz)).find((n) => n === WATER || n === LAVA);
  setBlock(x, y, z, flow ?? AIR);
  spawnParticles(x, y, z, id);
  sound.break(id);
  if (mode === 'survival') {
    for (const [d, n] of dropsFor(id, Math.random(), harvest)) if (n > 0) entities.dropItem(d, n, x + 0.5, y + 0.3, z + 0.5);
    if (BLOCKS[id].hardness > 0 && ITEMS[held]?.tool) toolWear(held, 1);
    exhaustion += 0.005;
  }
}

function toolWear(id, n) {
  if (inv.useTool(id, n)) { sound.toolBreak(); toast(`${itemName(id)} broke!`); }
  renderHotbar(game, $('hotbar'), selectSlot);
}

function attack(mob) {
  if (attackCooldown > 0) return;
  attackCooldown = 0.4;
  hand.swing();
  const held = inv.selected;
  let dmg = mode === 'survival' ? attackDamage(held) : Math.max(4, attackDamage(held));
  if (!player.onGround && player.vel[1] < 0 && !player.flying) { dmg *= 1.5; spawnParticles(mob.pos[0] - 0.5, mob.pos[1] + 0.5, mob.pos[2] - 0.5, 'crit', 8); }
  mob.hurt(dmg, player.pos[0], player.pos[2]);
  if (mode === 'survival') {
    exhaustion += 0.1;
    if (ITEMS[held]?.tool) toolWear(held, ITEMS[held].tool.kind === 'sword' ? 1 : 2);
  }
}

function canPlaceAt(x, y, z, id) {
  if (y < 0 || y >= H) return false;
  const cur = world.getBlock(x, y, z);
  if (!BLOCKS[cur].replaceable) return false;
  if (BLOCKS[id].solid && player.intersectsBlock(x, y, z)) return false;
  if (BLOCKS[id].solid && entities.mobs.some((m) => m.intersectsBlock(x, y, z))) return false;
  if (BLOCKS[id].needsSupport && !supportOk(id, world.getBlock(x, y - 1, z))) return false;
  return true;
}

function useOrPlace() {
  hand.swing();
  // 1. Attack a mob in reach
  if (mobTarget && (!target || mobTarget.dist < target.dist)) { attack(mobTarget.mob); return; }
  const held = inv.selected;
  const def = getDef(held);
  // 2. Use a block
  if (target) {
    const [hx, hy, hz] = target.hit;
    const use = BLOCKS[target.id].use;
    if (use === 'tnt') { ignite(hx, hy, hz); return; }
    if (use === 'craft' || use === 'furnace') { openInventory({ table: true, furnace: use === 'furnace' }); return; }
    if (use === 'bed') { sleep(hx, hy, hz); return; }
  }
  // 3. Use the held item
  if (def?.food && mode === 'survival') {
    if (hunger >= 20) { toast('You are not hungry'); return; }
    hunger = Math.min(20, hunger + def.food);
    inv.remove(held, 1);
    sound.eat();
    spawnParticles(player.pos[0] - 0.5 + lookDir()[0] * 0.5, player.pos[1] + 1.2, player.pos[2] - 0.5 + lookDir()[2] * 0.5, 'crit', 6, 1);
    renderHotbar(game, $('hotbar'), selectSlot);
    renderStats(game);
    return;
  }
  if (!target) return;
  const [hx, hy, hz] = target.hit;
  if (def?.tool?.kind === 'hoe' && HOE_TARGETS.has(target.id) && target.normal[1] === 1 && world.getBlock(hx, hy + 1, hz) === AIR) {
    setBlock(hx, hy, hz, FARMLAND);
    sound.place(DIRT);
    if (mode === 'survival') toolWear(held, 1);
    return;
  }
  // 4. Place
  let placeId = held;
  if (def?.plants) placeId = def.plants;
  if (!placeId || placeId >= 256) return;
  if (mode === 'survival' && inv.count(held) <= 0) { toast(`No ${itemName(held)} left`); return; }
  // Clicking a replaceable block (tall grass) places into it
  let x, y, z;
  if (BLOCKS[target.id].replaceable) { [x, y, z] = target.hit; }
  else { x = hx + target.normal[0]; y = hy + target.normal[1]; z = hz + target.normal[2]; }
  if (def?.plantOn && !def.plantOn.includes(world.getBlock(x, y - 1, z))) { toast('Seeds need farmland (use a hoe)'); return; }
  if (!canPlaceAt(x, y, z, placeId)) return;
  if (!setBlock(x, y, z, placeId)) return;
  flushUrgent();
  sound.place(placeId);
  if (mode === 'survival') { inv.remove(held, 1); renderHotbar(game, $('hotbar'), selectSlot); }
}

function ignite(x, y, z) {
  if (fuses.some((f) => f.x === x && f.y === y && f.z === z)) return;
  fuses.push({ x, y, z, t: 3 });
  sound.fuse();
  toast('TNT ignited — run!');
}

function updateFuses(dt) {
  for (let i = fuses.length - 1; i >= 0; i--) {
    const f = fuses[i];
    f.t -= dt;
    if (Math.random() < dt * 12) spawnParticles(f.x, f.y + 0.6, f.z, 'smoke', 1, 1);
    if (f.t <= 0) {
      fuses.splice(i, 1);
      if (world.getBlock(f.x, f.y, f.z) === TNT) { world.setBlock(f.x, f.y, f.z, AIR); explode(f.x, f.y, f.z, 3.6, 'blew up'); }
    }
  }
}

function explode(x, y, z, r, reason) {
  const ri = Math.ceil(r);
  for (let dy = -ri; dy <= ri; dy++) for (let dz = -ri; dz <= ri; dz++) for (let dx = -ri; dx <= ri; dx++) {
    const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
    if (d > r - Math.random() * 0.8) continue;
    const bx = x + dx, by = y + dy, bz = z + dz;
    const id = world.getBlock(bx, by, bz);
    if (id === AIR || id === BEDROCK || BLOCKS[id].liquid || by <= 0 || id === OBSIDIAN) continue;
    if (id === TNT) { if (!fuses.some((f) => f.x === bx && f.y === by && f.z === bz)) fuses.push({ x: bx, y: by, z: bz, t: 0.4 + Math.random() * 0.5 }); continue; }
    world.setBlock(bx, by, bz, AIR);
    if (mode === 'survival' && Math.random() < 0.25) for (const [dd, n] of dropsFor(id, Math.random(), true)) if (n > 0) entities.dropItem(dd, n, bx + 0.5, by + 0.5, bz + 0.5);
    if (Math.random() < 0.15) spawnParticles(bx, by, bz, id, 3, 8);
  }
  for (let i = 0; i < 20; i++) spawnParticles(x - 1.5 + Math.random() * 3, y - 1 + Math.random() * 2, z - 1.5 + Math.random() * 3, 'smoke', 2, 4);
  updateAround(x, y + ri, z);
  flushUrgent();
  sound.explode();
  // Knock back and hurt everything nearby
  const hitBody = (b, onHit) => {
    const px = b.pos[0] - (x + 0.5), py = b.pos[1] + b.h / 2 - (y + 0.5), pz = b.pos[2] - (z + 0.5);
    const d = Math.hypot(px, py, pz) || 0.1;
    const reach = r * 2;
    if (d >= reach) return;
    const k = (reach - d) / reach;
    b.vel[0] += (px / d) * k * 14;
    b.vel[1] += (py / d) * k * 8 + 5 * k;
    b.vel[2] += (pz / d) * k * 14;
    onHit(k);
  };
  hitBody(player, (k) => damagePlayer(Math.round(k * 5 * r), reason));
  for (const m of entities.mobs) hitBody(m, (k) => m.hurt(k * 5 * r, x + 0.5, z + 0.5));
}

function sleep(x, y, z) {
  spawn = [x + 0.5, y + 1.01, z + 0.5];
  const night = Math.sin(timeOfDay * Math.PI * 2) < -0.08;
  if (!night) { toast('Respawn point set. You can only sleep at night.'); return; }
  if (mode === 'survival' && entities.countNear((e) => e.t.hostile, 10) > 0) { toast('You may not rest now, there are monsters nearby'); return; }
  state = 'sleeping';
  controls.reset();
  sound.sleep();
  $('sleep-overlay').classList.add('on');
  setTimeout(() => {
    timeOfDay = 0.01;
    if (weather.raining) weather.toggle();
    setTimeout(() => {
      $('sleep-overlay').classList.remove('on');
      if (state === 'sleeping') state = 'playing';
      toast('Good morning! Respawn point set.');
      save();
    }, 900);
  }, 1500);
}

// ---------- Survival ----------
function damagePlayer(n, reason, fx, fz) {
  if (mode !== 'survival' || n <= 0 || state === 'dead' || invuln > 0) return;
  if (settings.diff === 0 && !/lava|world|fell|drown|prick/.test(reason)) n = Math.ceil(n / 2);
  health = Math.max(0, health - n);
  invuln = 0.5;
  sound.hurt();
  if (fx !== undefined) {
    const dx = player.pos[0] - fx, dz = player.pos[2] - fz, d = Math.hypot(dx, dz) || 1;
    player.vel[0] += (dx / d) * 7; player.vel[2] += (dz / d) * 7; player.vel[1] = 5;
  }
  const o = $('damage-overlay');
  o.classList.add('on');
  setTimeout(() => o.classList.remove('on'), 80);
  $('hearts').classList.remove('shake'); void $('hearts').offsetWidth; $('hearts').classList.add('shake');
  renderStats(game);
  if (health <= 0) die(reason);
}

function die(reason) {
  state = 'dead';
  controls.reset();
  document.exitPointerLock?.();
  $('death-msg').textContent = `You ${reason}. Your items were kept.`;
  $('hud').classList.add('hidden');
  showMenu('menu-dead');
}

function respawn() {
  health = 20; hunger = 20; exhaustion = 0; air = 10; fallPeak = null;
  player.pos = [...spawn];
  player.vel = [0, 0, 0];
  renderStats(game);
  resume();
}

function updateSurvival(dt) {
  if (mode !== 'survival') return;
  invuln -= dt;
  const peaceful = settings.diff === 0;
  // Fall damage
  if (!player.onGround && !player.inWater && !player.flying) {
    if (fallPeak === null || player.pos[1] > fallPeak) fallPeak = player.pos[1];
  } else {
    if (fallPeak !== null && player.onGround) {
      const dist = fallPeak - player.pos[1];
      if (dist > 3.5) damagePlayer(Math.floor(dist - 3), 'fell from a high place');
    }
    fallPeak = null;
  }
  if (player.inWater) fallPeak = null;
  // Drowning
  if (player.headInWater) {
    air = Math.max(0, air - dt);
    if (air <= 0) { drownTimer += dt; if (drownTimer >= 1) { drownTimer = 0; damagePlayer(2, 'drowned'); } }
  } else { air = Math.min(10, air + dt * 4); drownTimer = 0; }
  // Lava, cactus, void
  hazardTimer -= dt;
  if (hazardTimer <= 0) {
    const p = player.pos;
    let touchingCactus = false;
    for (const [dx, dz] of [[0.35, 0], [-0.35, 0], [0, 0.35], [0, -0.35]]) {
      for (const dy of [0.1, 1]) if (world.getBlock(Math.floor(p[0] + dx), Math.floor(p[1] + dy), Math.floor(p[2] + dz)) === CACTUS) touchingCactus = true;
    }
    if (world.getBlock(Math.floor(p[0]), Math.floor(p[1] - 0.05), Math.floor(p[2])) === CACTUS) touchingCactus = true;
    if (player.inLava) { damagePlayer(4, 'tried to swim in lava'); hazardTimer = 0.5; spawnParticles(p[0] - 0.5, p[1], p[2] - 0.5, 'flame', 4); }
    else if (touchingCactus) { damagePlayer(1, 'was pricked to death'); hazardTimer = 0.5; }
  }
  if (player.pos[1] < 0) damagePlayer(4, 'fell out of the world');
  // Hunger
  if (!peaceful) {
    exhaustion += dt * 0.02;
    if (player.sprinting && Math.hypot(player.vel[0], player.vel[2]) > 1) exhaustion += dt * 0.12;
    if (player.inWater) exhaustion += dt * 0.02;
    if (player.jumped) exhaustion += 0.05;
    while (exhaustion >= 1) { exhaustion -= 1; hunger = Math.max(0, hunger - 1); }
  } else hunger = 20;
  player.canSprint = hunger > 6;
  // Regeneration / starvation
  regenTimer += dt;
  if (health < 20 && hunger >= 18 && regenTimer >= 2.5) { regenTimer = 0; health++; if (!peaceful) exhaustion += 0.6; }
  if (hunger <= 0) {
    starveTimer += dt;
    const floor = settings.diff <= 1 ? 10 : settings.diff === 2 ? 1 : 0;
    if (starveTimer >= 4) { starveTimer = 0; if (health > floor) damagePlayer(1, 'starved to death'); }
  }
  renderStats(game);
}

// Crops grow and saplings become trees
function updateTickables(dt) {
  tickTimer += dt;
  if (tickTimer < 1) return;
  tickTimer = 0;
  for (const key of [...world.tickables]) {
    const [x, y, z] = key.split(',').map(Number);
    if (!world.getChunk(Math.floor(x / CX), Math.floor(z / CZ))) continue;
    const id = world.getBlock(x, y, z);
    const b = BLOCKS[id];
    if (!b.tick) { world.tickables.delete(key); continue; }
    const l = world.getLight(x, y, z);
    const lit = Math.max(l & 15, l >> 4) >= 9;
    if (b.tick === 'crop' && lit && Math.random() < 1 / 25) setBlock(x, y, z, b.next);
    else if (b.tick === 'sapling' && lit && Math.random() < 1 / 45) growTree(x, y, z);
  }
}

function growTree(x, y, z) {
  for (let i = 1; i < 6; i++) if (world.getBlock(x, y + i, z) !== AIR) return;
  const below = world.getBlock(x, y - 1, z);
  const kind = below === SNOW ? 'spruce' : Math.random() < 0.3 ? 'birch' : 'oak';
  world.setBlock(x, y, z, AIR);
  placeTree((bx, by, bz, id, force) => {
    const cur = world.getBlock(bx, by, bz);
    if (force || cur === AIR || BLOCKS[cur].replaceable) world.setBlock(bx, by, bz, id);
  }, Math.random(), x, y - 1, z, kind);
}

// ---------- UI ----------
function selectSlot(i) {
  inv.sel = i;
  renderHotbar(game, $('hotbar'), selectSlot);
  if (!$('inventory').classList.contains('hidden')) renderHotbar(game, $('inv-hotbar'), selectInvSlot);
  const id = inv.hotbar[i];
  if (id) toast(itemName(id));
}
function selectInvSlot(i) { inv.sel = i; renderHotbar(game, $('inv-hotbar'), selectInvSlot); renderHotbar(game, $('hotbar'), selectSlot); }

let toastTimer = null;
function toast(msg) {
  const t = $('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 1600);
}

function showMenu(id) {
  for (const m of document.querySelectorAll('.menu')) m.classList.add('hidden');
  if (id) $(id).classList.remove('hidden');
}

let settingsReturn = 'menu-main';
const DIFF_NAMES = ['Peaceful', 'Easy', 'Normal', 'Hard'];
function openSettings(from) {
  settingsReturn = from;
  $('set-diff').value = settings.diff;
  $('set-rd').value = settings.rd;
  $('set-sens').value = settings.sens;
  $('set-res').value = settings.res;
  $('set-fov').value = settings.fov;
  $('set-info').checked = settings.info;
  $('set-sound').checked = settings.sound;
  $('set-bob').checked = settings.bob;
  $('set-hand').checked = settings.hand;
  updateSettingLabels();
  showMenu('menu-settings');
}
function updateSettingLabels() {
  $('diff-val').textContent = DIFF_NAMES[settings.diff];
  $('rd-val').textContent = settings.rd + ' chunks';
  $('sens-val').textContent = settings.sens.toFixed(1) + 'x';
  $('res-val').textContent = settings.res.toFixed(2) + 'x';
  $('fov-val').textContent = settings.fov + '°';
}
function bindSetting(id, key, parse) {
  $(id).addEventListener('input', (e) => {
    settings[key] = parse(e.target);
    updateSettingLabels();
    applySettings();
    saveSettings();
  });
}
bindSetting('set-diff', 'diff', (t) => parseInt(t.value, 10));
bindSetting('set-rd', 'rd', (t) => parseInt(t.value, 10));
bindSetting('set-sens', 'sens', (t) => parseFloat(t.value));
bindSetting('set-res', 'res', (t) => parseFloat(t.value));
bindSetting('set-fov', 'fov', (t) => parseInt(t.value, 10));
bindSetting('set-info', 'info', (t) => t.checked);
bindSetting('set-sound', 'sound', (t) => t.checked);
bindSetting('set-bob', 'bob', (t) => t.checked);
bindSetting('set-hand', 'hand', (t) => t.checked);
function applySettings() {
  controls.sensitivity = settings.sens;
  camera.far = settings.rd * 16 + 80;
  resize();
  if (!settings.info) $('info').textContent = '';
}

// Crafting stations within reach of the player
function nearbyStations() {
  const s = { table: false, furnace: false };
  const [px, py, pz] = player.pos.map(Math.floor);
  for (let y = -2; y <= 3; y++) for (let z = -4; z <= 4; z++) for (let x = -4; x <= 4; x++) {
    const id = world.getBlock(px + x, py + y, pz + z);
    if (id === CRAFTING) s.table = true;
    else if (id === FURNACE) s.furnace = true;
  }
  return s;
}

let invTab = 'blocks', invStations = {}, invOpenedAt = 0;
function openInventory(stations) {
  if (state !== 'playing' && state !== 'inventory') return;
  state = 'inventory';
  invOpenedAt = performance.now();
  controls.reset();
  document.exitPointerLock?.();
  if (mode === 'survival') invTab = 'inv';
  else if (invTab === 'inv') invTab = 'blocks';
  invStations = stations ? { ...nearbyStations(), ...stations } : nearbyStations();
  refreshInventory();
  showMenu('inventory');
}
function refreshInventory() {
  buildInventory(game, {
    tab: invTab,
    stations: invStations,
    onTab: (t) => { invTab = t; refreshInventory(); },
    onAssign: (id) => {
      const existing = inv.hotbar.indexOf(id);
      if (existing >= 0 && existing !== inv.sel) inv.hotbar[existing] = inv.hotbar[inv.sel];
      inv.hotbar[inv.sel] = id;
      if (mode === 'creative') inv.sel = (inv.sel + 1) % 9;
      sound.click();
      refreshInventory();
      renderHotbar(game, $('hotbar'), selectSlot);
    },
    onCraft: (r) => {
      if (craft(inv, r, invStations)) {
        sound.place(r.out[0] < 256 ? r.out[0] : PLANKS);
        toast(`Crafted ${r.out[1] > 1 ? r.out[1] + ' ' : ''}${itemName(r.out[0])}`);
        refreshInventory();
        renderHotbar(game, $('hotbar'), selectSlot);
      }
    },
  });
  renderHotbar(game, $('inv-hotbar'), selectInvSlot);
}
function closeInventory() {
  showMenu(null);
  state = 'playing';
  lastT = performance.now();
}

function toggleFly() {
  if (mode !== 'creative' || !player) return;
  player.flying = !player.flying;
  player.vel[1] = 0;
  updateFlyUI();
  toast(player.flying ? 'Flying on' : 'Flying off');
}
function updateFlyUI() {
  const creative = mode === 'creative';
  $('btn-fly').classList.toggle('hidden', !creative);
  $('btn-fly').classList.toggle('on', !!player?.flying);
  $('btn-down').classList.toggle('hidden', !(player?.flying || player?.inWater || player?.inLava));
}

function pause() {
  if (state !== 'playing') return;
  state = 'paused';
  controls.reset();
  save();
  showMenu('menu-pause');
}
function resume() {
  showMenu(null);
  $('hud').classList.remove('hidden');
  state = 'playing';
  lastT = performance.now();
  if (!isTouch) canvas.requestPointerLock?.();
}

// ---------- Save / load ----------
function save() {
  if (!world || !meta) return;
  const data = {
    v: 2, seed: world.seed, mode, time: timeOfDay, weather: weather.serialize(), inv: inv.serialize(),
    health, hunger, exhaustion, spawn,
    player: { pos: player.pos, yaw: player.yaw, pitch: player.pitch, flying: player.flying },
    edits: world.serializeEdits(),
  };
  try { saveWorld(meta, data); } catch { toast('Could not save — storage full'); }
}

function findSpawn(w) {
  for (let r = 0; r < 600; r += 4) {
    for (let a = 0; a < 16; a++) {
      const x = Math.round(Math.cos(a / 16 * Math.PI * 2) * r), z = Math.round(Math.sin(a / 16 * Math.PI * 2) * r);
      const { h, biome } = w.column(x, z);
      if (h > WATER_LEVEL + 1 && h < 60 && biome !== 2) return [x + 0.5, z + 0.5];
      if (r === 0) break;
    }
  }
  return [0.5, 0.5];
}

function hashSeed(str) {
  if (/^-?\d+$/.test(str)) return parseInt(str, 10) | 0;
  let h = 2166136261;
  for (const ch of str) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return h | 0;
}

function clearWorld() {
  if (world) for (const c of [...world.chunks.values()]) unloadChunk(c);
  entities.clear();
  fuses.length = 0;
  particles.list.length = 0;
}

function startGame(worldMeta, data) {
  $('loading').classList.remove('hidden');
  showMenu(null);
  setTimeout(() => {
    clearWorld();
    meta = worldMeta;
    world = new World(data.seed, data.edits || {});
    world.onGenerate = (c, heights, biomes) => entities.onChunkGenerated(c, heights, biomes);
    player = new Player(world);
    mode = data.mode || 'creative';
    document.body.classList.toggle('mode-creative', mode === 'creative');
    timeOfDay = data.time ?? 0.05;
    weather.load(data.weather);
    if (data.v === 2) inv = new Inventory(data.inv);
    else inv = new Inventory({ counts: data.inv, hotbar: data.hotbar, sel: data.sel }); // v1 save
    if (mode === 'creative' && !inv.hotbar.some(Boolean)) inv.hotbar = [...DEFAULT_CREATIVE_HOTBAR];
    health = data.health ?? 20;
    hunger = data.hunger ?? 20;
    exhaustion = data.exhaustion ?? 0;
    air = 10;
    fallPeak = null;
    if (data.player) {
      player.pos = [...data.player.pos];
      player.yaw = data.player.yaw;
      player.pitch = data.player.pitch;
      player.flying = mode === 'creative' && data.player.flying;
      spawn = data.spawn || [...player.pos];
    } else {
      const [sx, sz] = findSpawn(world);
      player.pos = [sx, 0, sz];
    }
    // Generate the area around the player synchronously
    const pcx = Math.floor(player.pos[0] / CX), pcz = Math.floor(player.pos[2] / CZ);
    for (const [dx, dz] of offsets(3)) if (!world.getChunk(pcx + dx, pcz + dz)) world.generate(pcx + dx, pcz + dz);
    for (const [dx, dz] of offsets(2)) { const c = world.getChunk(pcx + dx, pcz + dz); if (c.dirty && neighborsReady(c)) meshChunk(c); }
    if (!data.player) {
      player.pos[1] = world.surfaceHeight(Math.floor(player.pos[0]), Math.floor(player.pos[2])) + 1.01;
      spawn = [...player.pos];
    }
    applySettings();
    renderHotbar(game, $('hotbar'), selectSlot);
    renderStats.last = null;
    renderStats(game);
    updateFlyUI();
    $('loading').classList.add('hidden');
    save();
    resume();
    if (!data.player && mode === 'survival') toast('Punch a tree! Hold on a log to mine it.');
  }, 30);
}

function showWorlds() {
  renderWorldList(listWorlds(), {
    onPlay: (w) => { const d = loadWorld(w.id); if (d) startGame(w, d); else toast('World data missing'); },
    onDelete: (w) => { deleteWorld(w.id); showWorlds(); refreshMain(); },
  });
  showMenu('menu-worlds');
}
function refreshMain() {
  const last = listWorlds()[0];
  const b = $('btn-continue');
  b.classList.toggle('hidden', !last);
  if (last) b.textContent = `Continue: ${last.name}`;
}

// ---------- Menus wiring ----------
let newMode = 'survival';
const MODE_HINTS = {
  survival: 'Gather resources, craft tools, farm and survive the night.',
  creative: 'Unlimited blocks, flying, no damage.',
};
$('mode-hint').textContent = MODE_HINTS.survival;
const tap = (id, fn) => $(id).addEventListener('click', () => { sound.unlock(); sound.click(); fn(); });
tap('btn-continue', () => { const w = listWorlds()[0]; const d = w && loadWorld(w.id); if (d) startGame(w, d); });
tap('btn-play', () => showWorlds());
tap('btn-worlds-back', () => showMenu('menu-main'));
tap('btn-new', () => { $('seed-input').value = ''; $('name-input').value = ''; showMenu('menu-new'); });
tap('btn-new-back', () => showWorlds());
tap('btn-settings-main', () => openSettings('menu-main'));
tap('btn-settings-pause', () => openSettings('menu-pause'));
tap('btn-settings-back', () => showMenu(settingsReturn));
tap('btn-resume', () => resume());
tap('btn-day', () => { timeOfDay = 0.1; toast('Time set to day'); });
tap('btn-night', () => { timeOfDay = 0.6; toast('Time set to night'); });
tap('btn-weather', () => { weather.toggle(); toast(weather.raining ? 'Weather: rain' : 'Weather: clear'); });
tap('btn-quit', () => quitToTitle());
tap('btn-dead-quit', () => { health = 20; hunger = 20; player.pos = [...spawn]; quitToTitle(); });
tap('btn-inv-close', () => closeInventory());
tap('btn-respawn', () => respawn());
tap('btn-create', () => {
  const s = $('seed-input').value.trim();
  const seed = s ? hashSeed(s) : (Math.random() * 2 ** 31) | 0;
  const name = $('name-input').value.trim() || 'New World';
  startGame({ id: newWorldId(), name, seed, mode: newMode }, { seed, mode: newMode });
});
function quitToTitle() {
  save();
  state = 'menu';
  $('hud').classList.add('hidden');
  refreshMain();
  showMenu('menu-main');
}
for (const b of document.querySelectorAll('#mode-seg button')) {
  b.addEventListener('click', () => {
    newMode = b.dataset.mode;
    for (const o of document.querySelectorAll('#mode-seg button')) o.classList.toggle('on', o === b);
    $('mode-hint').textContent = MODE_HINTS[newMode];
  });
}
const hudBtn = (id, fn) => {
  const b = $(id);
  b.addEventListener('touchstart', (e) => { e.preventDefault(); e.stopPropagation(); sound.unlock(); fn(); }, { passive: false });
  b.addEventListener('click', (e) => { e.stopPropagation(); fn(); });
};
hudBtn('btn-pause', () => pause());
hudBtn('btn-inv', () => openInventory());
hudBtn('btn-fly', () => toggleFly());
window.addEventListener('keydown', (e) => {
  if (state === 'inventory' && (e.code === 'KeyE' || e.code === 'Escape') && performance.now() - invOpenedAt > 150) closeInventory();
  else if (state === 'paused' && e.code === 'Escape') resume();
});
canvas.addEventListener('touchstart', () => sound.unlock(), { passive: true });
canvas.addEventListener('mousedown', () => sound.unlock());
refreshMain();

// Save when the app is backgrounded / closed
document.addEventListener('visibilitychange', () => { if (document.hidden) { save(); if (state === 'playing') pause(); } });
window.addEventListener('pagehide', save);

// Android hardware back button
App.addListener('backButton', () => {
  if (state === 'playing') pause();
  else if (state === 'paused') resume();
  else if (state === 'inventory') closeInventory();
  else if (!$('menu-settings').classList.contains('hidden')) showMenu(settingsReturn);
  else if (!$('menu-new').classList.contains('hidden')) showWorlds();
  else if (!$('menu-worlds').classList.contains('hidden')) showMenu('menu-main');
  else if (state === 'menu') App.exitApp();
}).catch(() => {});

// ---------- Main loop ----------
const skyDay = new THREE.Color(0x87b8ff), skyNight = new THREE.Color(0x070b1c), skySunset = new THREE.Color(0xf09a5a);
const skyRain = new THREE.Color(0x6a7482);
const waterFog = new THREE.Color(0x1a3c8c), lavaFog = new THREE.Color(0xc04000);
const skyColor = new THREE.Color();
let lastT = performance.now();
let fpsFrames = 0, fpsTime = 0, fps = 0;

function updateSky(dt) {
  timeOfDay = (timeOfDay + dt / DAY_LENGTH) % 1;
  const s = Math.sin(timeOfDay * Math.PI * 2);
  const k = THREE.MathUtils.smoothstep(s, -0.2, 0.25);
  const gloom = weather.gloom;
  daylight = (0.2 + 0.8 * k) * gloom;
  skyColor.copy(skyNight).lerp(skyDay, k);
  const dusk = Math.max(0, 1 - Math.abs(s) * 4) * 0.6;
  skyColor.lerp(skySunset, dusk * gloom);
  skyColor.lerp(skyRain.clone().multiplyScalar(0.3 + 0.7 * k), weather.intensity * 0.75);
  // Darken the sky when deep underground
  const depthDark = THREE.MathUtils.clamp((player.pos[1] - 12) / 16, 0.15, 1);
  skyColor.multiplyScalar(depthDark);

  const underWater = player.headInWater;
  const underLava = world.getBlock(Math.floor(player.pos[0]), Math.floor(player.pos[1] + EYE), Math.floor(player.pos[2])) === LAVA;
  const fogCol = underLava ? lavaFog : underWater ? waterFog : skyColor;
  scene.background.copy(fogCol);
  lightUniforms.fogColor.value.copy(fogCol);
  const far = settings.rd * 16;
  lightUniforms.fogNear.value = underLava ? 0.1 : underWater ? 1 : far * (0.55 - weather.intensity * 0.25);
  lightUniforms.fogFar.value = underLava ? 3 : underWater ? 20 : far * (1 - weather.intensity * 0.2);
  lightUniforms.daylight.value = daylight;

  clouds.material.color.setScalar(Math.max(0.25, daylight));
  clouds.material.opacity = 0.8 + weather.intensity * 0.2;
  skyPivot.position.set(player.pos[0], player.pos[1], player.pos[2]);
  skyPivot.rotation.x = timeOfDay * Math.PI * 2 - Math.PI / 2;
  sun.material.opacity = moon.material.opacity = gloom;
  stars.material.opacity = Math.max(0, 1 - k * 1.5) * gloom;
  clouds.position.x = player.pos[0];
  clouds.position.z = player.pos[2];
  clouds.material.map.offset.set((player.pos[0] / 1600) * 4 + performance.now() / 400000, -(player.pos[2] / 1600) * 4);
  $('water-overlay').classList.toggle('on', underWater);
  $('lava-overlay').classList.toggle('on', underLava);
}

function updateTargeting() {
  const eye = eyePos(), dir = lookDir();
  target = raycast(world, eye, dir, REACH);
  mobTarget = entities.raycast(eye, dir, Math.min(MOB_REACH, target ? target.dist : MOB_REACH));
  const showBlock = target && !mobTarget;
  outline.visible = !!showBlock;
  if (showBlock) {
    const b = BLOCKS[target.id];
    const box = b.model === 'box' ? b.box : b.model === 'torch' ? [0.4, 0, 0.4, 0.6, 0.65, 0.6] : b.model === 'cross' ? [0.15, 0, 0.15, 0.85, 0.85, 0.85] : [0, 0, 0, 1, 1, 1];
    outline.scale.set(box[3] - box[0], box[4] - box[1], box[5] - box[2]);
    outline.position.set(target.hit[0] + (box[0] + box[3]) / 2, target.hit[1] + (box[1] + box[4]) / 2, target.hit[2] + (box[2] + box[5]) / 2);
  }
  $('crosshair').classList.toggle('mob', !!mobTarget);
}

function updateBreaking(dt) {
  const ring = $('hold-ring');
  attackCooldown -= dt;
  if (controls.breaking && mobTarget) {
    attack(mobTarget.mob);
    breakState = null;
    ring.classList.remove('active');
    crack.visible = false;
    return;
  }
  if (controls.breaking && target) {
    const key = target.hit.join(',');
    if (!breakState || breakState.key !== key) {
      const { time } = mining(target.id, inv.selected, mode === 'creative');
      breakState = { key, t: 0, need: time, hitT: 0 };
    }
    breakState.t += dt;
    breakState.hitT -= dt;
    if (breakState.hitT <= 0 && mode === 'survival') { breakState.hitT = 0.25; sound.hit(target.id); hand.swing(); spawnParticles(...target.hit, target.id, 2, 2); }
    const prog = Math.min(1, breakState.t / breakState.need);
    ring.classList.toggle('active', isFinite(breakState.need));
    ring.firstElementChild.style.strokeDashoffset = String(100.5 * (1 - prog));
    crack.visible = breakState.need > 0.2 && isFinite(breakState.need);
    crack.position.set(target.hit[0] + 0.5, target.hit[1] + 0.5, target.hit[2] + 0.5);
    crack.material.map.offset.x = Math.min(9, Math.floor(prog * 10)) * 0.1;
    if (breakState.t >= breakState.need) { breakBlock(target); hand.swing(); breakState = null; }
  } else {
    breakState = null;
    ring.classList.remove('active');
    crack.visible = false;
  }
}

function frame(now) {
  requestAnimationFrame(frame);
  step(now);
}

function step(now) {
  const dt = Math.min(0.05, (now - lastT) / 1000);
  lastT = now;
  if (!world) return;
  const playing = state === 'playing';

  if (playing) {
    const [lx, ly] = controls.consumeLook();
    player.yaw -= lx;
    player.pitch = Math.max(-Math.PI / 2 + 0.01, Math.min(Math.PI / 2 - 0.01, player.pitch - ly));
    const input = controls.input;
    const wasInWater = player.inWater;
    player.update(dt, input);
    if (!wasInWater && player.inWater && player.vel[1] < -4) { sound.splash(); spawnParticles(player.pos[0] - 0.5, player.pos[1], player.pos[2] - 0.5, 'splash', 12, 3); }
    updateChunks(dt);
    updateSurvival(dt);
    updateFuses(dt);
    updateTickables(dt);
    updateTargeting();
    updateBreaking(dt);

    // Footsteps
    if (player.onGround && player.walkDist - stepDist > 1.8) {
      stepDist = player.walkDist;
      const below = world.getBlock(Math.floor(player.pos[0]), Math.floor(player.pos[1] - 0.2), Math.floor(player.pos[2]));
      if (below) sound.step(below);
    }
    if ($('btn-down').classList.contains('hidden') === !!(player.flying || player.inWater || player.inLava)) updateFlyUI();

    saveTimer += dt;
    if (saveTimer > 30) { saveTimer = 0; save(); }
  } else {
    outline.visible = false;
    crack.visible = false;
  }
  if (playing || state === 'inventory' || state === 'sleeping') {
    entities.update(playing ? dt : 0);
    weather.update(dt, player, world);
    sound.setRain(playing ? weather.rainLevel : weather.rainLevel * 0.3);
  }

  updateSky(playing || state === 'sleeping' ? dt : 0);
  updateParticles(dt);

  // Camera: sprint FOV, view bobbing
  const moving = player.onGround && Math.hypot(player.vel[0], player.vel[2]) > 0.5;
  fovKick += ((player.sprinting && moving ? 10 : 0) - fovKick) * Math.min(1, dt * 8);
  const fov = settings.fov + fovKick;
  if (Math.abs(camera.fov - fov) > 0.05) { camera.fov = fov; camera.updateProjectionMatrix(); }
  const bob = settings.bob && moving ? player.walkDist * Math.PI / 1.8 : 0;
  camera.position.set(player.pos[0], player.pos[1] + EYE + (bob ? Math.abs(Math.sin(bob)) * 0.06 : 0), player.pos[2]);
  camera.rotation.set(player.pitch, player.yaw, bob ? Math.sin(bob) * 0.006 : 0);
  renderer.render(scene, camera);

  if (settings.hand && state !== 'dead') {
    hand.setItem(mode === 'survival' && inv.count(inv.selected) <= 0 ? 0 : inv.selected);
    hand.update(dt, { moving: moving && settings.bob, sprinting: player.sprinting, light: brightnessAt(player.pos[0], player.pos[1] + 1, player.pos[2]) });
    hand.render(renderer);
  }

  fpsFrames++; fpsTime += dt;
  if (fpsTime >= 0.5) {
    fps = Math.round(fpsFrames / fpsTime);
    fpsFrames = 0; fpsTime = 0;
    if (settings.info) {
      const p = player.pos;
      const biome = BIOME_NAMES[world.column(Math.floor(p[0]), Math.floor(p[2])).biome];
      const l = world.getLight(Math.floor(p[0]), Math.floor(p[1] + 1), Math.floor(p[2]));
      $('info').textContent = `${fps} fps · ${world.chunks.size} chunks · ${entities.list.length} entities\nXYZ ${p[0].toFixed(1)} ${p[1].toFixed(1)} ${p[2].toFixed(1)}\n${biome} · light ${l >> 4}/${l & 15} · ${mode}`;
    }
  }
}
requestAnimationFrame(frame);

// PWA offline support (web only; the Android app bundles everything)
if ('serviceWorker' in navigator && !window.Capacitor?.isNativePlatform?.() && location.protocol === 'https:') {
  navigator.serviceWorker.register('./sw.js').catch(() => {});
}

// Debug handle (handy for testing from the console)
window.blocks = {
  get world() { return world; }, get player() { return player; }, get target() { return target; }, controls, entities, game,
  get inv() { return inv; }, get state() { return state; }, save, setBlock,
  use: () => useOrPlace(), mine: () => target && breakBlock(target), meshChunk, buildChunkGeometry,
  setTime: (t) => { timeOfDay = t; }, weather,
  randomTick: () => { tickTimer = 1; updateTickables(0); },
  // Advance the simulation manually (e.g. when the tab is throttled): n frames of 1/60s
  step: (n = 1) => { for (let i = 0; i < n; i++) step(lastT + 1000 / 60); },
};
