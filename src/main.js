import * as THREE from 'three';
import { App } from '@capacitor/app';
import {
  BLOCKS, PLACEABLE, AIR, WATER, TNT, BEDROCK, GRASS, DIRT, STONE, COBBLE, PLANKS, LOG, GLASS,
  BRICK, LEAVES, BIRCH_LEAVES, SNOW, ICE, BIRCH_LOG, CRAFTING, STONE_BRICK, SAND, COAL_ORE,
  BOOKSHELF, GRAVEL, createAtlas, blockIcon, TILE_COUNT,
} from './blocks.js';
import { World, CX, CZ, H, WATER_LEVEL, chunkKey } from './world.js';
import { buildChunkGeometry } from './mesher.js';
import { Player, EYE, raycast } from './player.js';
import { Controls } from './controls.js';
import { Sound } from './sound.js';

THREE.ColorManagement.enabled = false;

const SAVE_KEY = 'blocks-save-v1';
const SETTINGS_KEY = 'blocks-settings-v1';
const DAY_LENGTH = 1200; // seconds per full day
const REACH = 6;

const $ = (id) => document.getElementById(id);
const isTouch = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
document.body.classList.toggle('is-touch', isTouch);

// ---------- Settings ----------
const settings = Object.assign(
  { rd: isTouch ? 4 : 6, sens: 1, res: isTouch ? 1 : Math.min(devicePixelRatio, 2), fov: 75, info: false, sound: true },
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
scene.fog = new THREE.Fog(0x87b8ff, 20, 100);
scene.background = new THREE.Color(0x87b8ff);

function resize() {
  renderer.setPixelRatio(Math.min(settings.res, devicePixelRatio || 1));
  renderer.setSize(window.innerWidth, window.innerHeight, false);
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);
resize();

const atlas = createAtlas();
const solidMat = new THREE.MeshBasicMaterial({ map: atlas.texture, vertexColors: true, alphaTest: 0.5 });
const waterMat = new THREE.MeshBasicMaterial({
  map: atlas.texture, vertexColors: true, transparent: true, opacity: 0.7, depthWrite: false, side: THREE.DoubleSide,
});
const chunkGroup = new THREE.Group();
scene.add(chunkGroup);

// Block selection outline
const outline = new THREE.LineSegments(
  new THREE.EdgesGeometry(new THREE.BoxGeometry(1.004, 1.004, 1.004)),
  new THREE.LineBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.6 }),
);
outline.visible = false;
scene.add(outline);

// Sun, moon, clouds
const skyPivot = new THREE.Group();
scene.add(skyPivot);
const sun = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), new THREE.MeshBasicMaterial({ color: 0xfff3a0, fog: false, depthWrite: false }));
sun.position.set(0, 0, -300);
const moon = new THREE.Mesh(new THREE.PlaneGeometry(26, 26), new THREE.MeshBasicMaterial({ color: 0xe8ecff, fog: false, depthWrite: false }));
moon.position.set(0, 0, 300);
moon.rotation.y = Math.PI;
skyPivot.add(sun, moon);
sun.renderOrder = moon.renderOrder = -1;

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
    new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: 0.8, depthWrite: false, side: THREE.DoubleSide }));
  m.rotation.x = -Math.PI / 2;
  m.position.y = H + 20;
  scene.add(m);
  return m;
})();

// Break particles
const MAX_PARTICLES = 500;
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
function spawnParticles(x, y, z, id, count = 14, speed = 3) {
  const col = tileColors[BLOCKS[id].tiles[1]];
  for (let i = 0; i < count; i++) {
    if (particles.list.length >= MAX_PARTICLES) particles.list.shift();
    particles.list.push({
      p: [x + Math.random(), y + Math.random(), z + Math.random()],
      v: [(Math.random() - 0.5) * speed, Math.random() * speed, (Math.random() - 0.5) * speed],
      c: col.map((c) => c * (0.7 + Math.random() * 0.3)),
      life: 0.5 + Math.random() * 0.5,
    });
  }
}
function updateParticles(dt) {
  const list = particles.list;
  const pos = particles.g.attributes.position.array, col = particles.g.attributes.color.array;
  let n = 0;
  for (let i = list.length - 1; i >= 0; i--) {
    const q = list[i];
    q.life -= dt;
    if (q.life <= 0) { list.splice(i, 1); continue; }
    q.v[1] -= 18 * dt;
    const nx = q.p[0] + q.v[0] * dt, ny = q.p[1] + q.v[1] * dt, nz = q.p[2] + q.v[2] * dt;
    if (world && world.isSolidAt(Math.floor(nx), Math.floor(ny), Math.floor(nz))) { q.v[0] *= 0.3; q.v[1] = 0; q.v[2] *= 0.3; }
    else { q.p[0] = nx; q.p[1] = ny; q.p[2] = nz; }
  }
  for (const q of list) {
    pos[n * 3] = q.p[0]; pos[n * 3 + 1] = q.p[1]; pos[n * 3 + 2] = q.p[2];
    col[n * 3] = q.c[0] * light; col[n * 3 + 1] = q.c[1] * light; col[n * 3 + 2] = q.c[2] * light;
    n++;
  }
  particles.g.setDrawRange(0, n);
  particles.g.attributes.position.needsUpdate = true;
  particles.g.attributes.color.needsUpdate = true;
}

// ---------- Game state ----------
let world = null, player = null;
let state = 'menu'; // menu | playing | paused | inventory | dead
let mode = 'creative';
let timeOfDay = 0.05;
let light = 1;
let hotbar = [], sel = 0, inv = {};
let health = 20, air = 10, regenTimer = 0, drownTimer = 0, fallPeak = null;
let spawn = [0, 60, 0];
let breakState = null;
let target = null;
let saveTimer = 0;
const fuses = [];
const sound = new Sound(() => settings.sound);

const DEFAULT_HOTBAR = [GRASS, DIRT, STONE, COBBLE, PLANKS, LOG, GLASS, BRICK, TNT];

const controls = new Controls(canvas, {
  isActive: () => state === 'playing',
  onPlace: () => placeBlock(),
  onToggleFly: () => toggleFly(),
  onHotbar: (n) => selectSlot(n),
  onHotbarScroll: (d) => selectSlot((sel + d + 9) % 9),
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
  c.meshed = true;
}

function unloadChunk(c) {
  for (const m of [c.mesh, c.waterMesh]) if (m) { chunkGroup.remove(m); m.geometry.dispose(); }
  world.chunks.delete(chunkKey(c.cx, c.cz));
}

let unloadTimer = 0;
function updateChunks(dt, genBudget = 2, meshBudget = 2) {
  const pcx = Math.floor(player.pos[0] / CX), pcz = Math.floor(player.pos[2] / CZ);
  const R = settings.rd;
  for (const [dx, dz] of offsets(R + 1)) {
    if (genBudget <= 0) break;
    const cx = pcx + dx, cz = pcz + dz;
    if (!world.chunks.has(chunkKey(cx, cz))) { world.generate(cx, cz); genBudget--; }
  }
  for (const [dx, dz] of offsets(R)) {
    if (meshBudget <= 0) break;
    const c = world.getChunk(pcx + dx, pcz + dz);
    if (c && c.dirty && neighborsReady(c)) { meshChunk(c); meshBudget--; }
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

// Immediately remesh edited chunks that are already visible
function flushDirty() {
  for (const c of world.chunks.values()) if (c.dirty && c.meshed) meshChunk(c);
}

// ---------- Block interaction ----------
const DROPS = { [GRASS]: DIRT, [SNOW]: DIRT, [STONE]: COBBLE, [LEAVES]: 0, [BIRCH_LEAVES]: 0, [GLASS]: 0, [ICE]: 0, [WATER]: 0 };
function breakTime(id) {
  if (mode === 'creative') return 0.18;
  const n = BLOCKS[id].name;
  if (BLOCKS[id].unbreakable) return Infinity;
  if (id === TNT) return 0.05;
  if (/Leaves/.test(n)) return 0.3;
  if (/Glass|Ice|Glowstone/.test(n)) return 0.4;
  if (/Wool|Cactus/.test(n)) return 0.6;
  if (/Obsidian/.test(n)) return 6;
  if (/Stone|Cobble|Ore|Brick/.test(n)) return 1.6;
  if (/Log|Plank|Table|Bookshelf|Pumpkin/.test(n)) return 1.1;
  return 0.6;
}

function lookDir() {
  const cp = Math.cos(player.pitch);
  return [-Math.sin(player.yaw) * cp, Math.sin(player.pitch), -Math.cos(player.yaw) * cp];
}
function eyePos() { return [player.pos[0], player.pos[1] + EYE, player.pos[2]]; }

function breakBlock(t) {
  const [x, y, z] = t.hit;
  const id = world.getBlock(x, y, z);
  if (id === AIR) return;
  if (id === BEDROCK && mode !== 'creative') return;
  if (id === TNT) { ignite(x, y, z); return; }
  // Neighbouring water flows into the hole
  const wet = [[0, 1, 0], [1, 0, 0], [-1, 0, 0], [0, 0, 1], [0, 0, -1]]
    .some(([dx, dy, dz]) => world.getBlock(x + dx, y + dy, z + dz) === WATER);
  world.setBlock(x, y, z, wet ? WATER : AIR);
  flushDirty();
  spawnParticles(x, y, z, id);
  sound.break(id);
  if (mode === 'survival') {
    const drop = id in DROPS ? DROPS[id] : id;
    if (drop) addItem(drop, 1);
  }
}

function placeBlock() {
  if (!target) return;
  const [hx, hy, hz] = target.hit;
  if (target.id === TNT) { ignite(hx, hy, hz); return; }
  const id = hotbar[sel];
  if (!id) return;
  if (mode === 'survival' && !(inv[id] > 0)) { toast('No ' + BLOCKS[id].name + ' left'); return; }
  const x = hx + target.normal[0], y = hy + target.normal[1], z = hz + target.normal[2];
  if (y < 0 || y >= H) return;
  const cur = world.getBlock(x, y, z);
  if (cur !== AIR && cur !== WATER) return;
  if (BLOCKS[id].solid && player.intersectsBlock(x, y, z)) return;
  if (!world.setBlock(x, y, z, id)) return;
  flushDirty();
  sound.place(id);
  if (mode === 'survival') { inv[id]--; renderHotbar(); }
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
    if (Math.random() < dt * 12) spawnParticles(f.x, f.y + 0.6, f.z, SNOW, 1, 1);
    if (f.t <= 0) { fuses.splice(i, 1); explode(f.x, f.y, f.z); }
  }
}

function explode(x, y, z) {
  if (world.getBlock(x, y, z) !== TNT) return;
  world.setBlock(x, y, z, AIR);
  const r = 3.6;
  for (let dy = -4; dy <= 4; dy++) for (let dz = -4; dz <= 4; dz++) for (let dx = -4; dx <= 4; dx++) {
    const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
    if (d > r - Math.random() * 0.8) continue;
    const bx = x + dx, by = y + dy, bz = z + dz;
    const id = world.getBlock(bx, by, bz);
    if (id === AIR || id === BEDROCK || id === WATER || by <= 0) continue;
    if (id === TNT) { if (!fuses.some((f) => f.x === bx && f.y === by && f.z === bz)) fuses.push({ x: bx, y: by, z: bz, t: 0.4 + Math.random() * 0.5 }); continue; }
    world.setBlock(bx, by, bz, AIR);
    if (Math.random() < 0.15) spawnParticles(bx, by, bz, id, 4, 8);
  }
  flushDirty();
  sound.explode();
  const px = player.pos[0] - (x + 0.5), py = player.pos[1] + 0.9 - (y + 0.5), pz = player.pos[2] - (z + 0.5);
  const d = Math.hypot(px, py, pz);
  if (d < 7) {
    const k = (7 - d) / 7;
    player.vel[0] += (px / d) * k * 14;
    player.vel[1] += (py / d) * k * 10 + 4 * k;
    player.vel[2] += (pz / d) * k * 14;
    if (mode === 'survival') damage(Math.round(k * 16), 'blew up');
  }
}

// ---------- Survival ----------
function addItem(id, n) {
  inv[id] = (inv[id] || 0) + n;
  if (!hotbar.includes(id)) {
    const empty = hotbar.findIndex((h) => !h || !(inv[h] > 0));
    if (empty >= 0) hotbar[empty] = id;
  }
  renderHotbar();
}

function damage(n, reason) {
  if (mode !== 'survival' || n <= 0 || state !== 'playing') return;
  health = Math.max(0, health - n);
  sound.hurt();
  const o = $('damage-overlay');
  o.classList.add('on');
  requestAnimationFrame(() => requestAnimationFrame(() => o.classList.remove('on')));
  renderStats();
  if (health <= 0) die(reason);
}

function die(reason) {
  state = 'dead';
  controls.reset();
  $('death-msg').textContent = 'You ' + reason + '.';
  $('hud').classList.add('hidden');
  $('menu-dead').classList.remove('hidden');
}

function respawn() {
  health = 20; air = 10; fallPeak = null;
  player.pos = [...spawn];
  player.vel = [0, 0, 0];
  $('menu-dead').classList.add('hidden');
  renderStats();
  resume();
}

function updateSurvival(dt) {
  if (mode !== 'survival') return;
  // Fall damage
  if (!player.onGround && !player.inWater && !player.flying) {
    if (fallPeak === null || player.pos[1] > fallPeak) fallPeak = player.pos[1];
  } else {
    if (fallPeak !== null && player.onGround) {
      const dist = fallPeak - player.pos[1];
      if (dist > 3.5) damage(Math.floor(dist - 3), 'fell from a high place');
    }
    fallPeak = null;
  }
  // Drowning
  if (player.headInWater) {
    air = Math.max(0, air - dt);
    if (air <= 0) {
      drownTimer += dt;
      if (drownTimer >= 1) { drownTimer = 0; damage(2, 'drowned'); }
    }
  } else {
    air = Math.min(10, air + dt * 4);
    drownTimer = 0;
  }
  // Regeneration
  if (health < 20) {
    regenTimer += dt;
    if (regenTimer >= 3) { regenTimer = 0; health++; }
  }
  renderStats();
}

const RECIPES = [
  { out: [PLANKS, 4], in: [[LOG, 1]] },
  { out: [PLANKS, 4], in: [[BIRCH_LOG, 1]] },
  { out: [CRAFTING, 1], in: [[PLANKS, 4]] },
  { out: [BOOKSHELF, 1], in: [[PLANKS, 6]] },
  { out: [STONE_BRICK, 4], in: [[COBBLE, 4]] },
  { out: [STONE, 1], in: [[COBBLE, 1], [COAL_ORE, 1]], label: 'smelt' },
  { out: [GLASS, 2], in: [[SAND, 2], [COAL_ORE, 1]], label: 'smelt' },
  { out: [BRICK, 2], in: [[DIRT, 2], [COAL_ORE, 1]], label: 'smelt' },
  { out: [TNT, 1], in: [[SAND, 4], [GRAVEL, 5]] },
];

// ---------- UI ----------
const iconCache = new Map();
const icon = (id) => {
  if (!iconCache.has(id)) iconCache.set(id, blockIcon(atlas.canvas, id));
  return iconCache.get(id);
};

function renderHotbar() {
  const el = $('hotbar');
  if (el.children.length !== 9) {
    el.innerHTML = '';
    for (let i = 0; i < 9; i++) {
      const s = document.createElement('div');
      s.className = 'slot';
      s.innerHTML = '<img alt=""><span class="count"></span>';
      const pick = (e) => { e.preventDefault(); e.stopPropagation(); selectSlot(i); };
      s.addEventListener('touchstart', pick, { passive: false });
      s.addEventListener('mousedown', pick);
      el.appendChild(s);
    }
  }
  [...el.children].forEach((s, i) => {
    const id = hotbar[i];
    const img = s.querySelector('img');
    const cnt = s.querySelector('.count');
    s.classList.toggle('sel', i === sel);
    if (id) { img.src = icon(id); img.style.visibility = 'visible'; } else img.style.visibility = 'hidden';
    if (mode === 'survival' && id) {
      const n = inv[id] || 0;
      cnt.textContent = n > 1 ? n : '';
      s.classList.toggle('empty', n <= 0);
    } else {
      cnt.textContent = '';
      s.classList.remove('empty');
    }
  });
}

function selectSlot(i) {
  sel = i;
  renderHotbar();
  if (hotbar[i]) toast(BLOCKS[hotbar[i]].name);
}

let lastHearts = '';
function renderStats() {
  const survival = mode === 'survival';
  $('stats').classList.toggle('hidden', !survival);
  if (!survival) return;
  let hs = '';
  for (let i = 0; i < 10; i++) {
    const v = health - i * 2;
    hs += `<span class="heart ${v >= 2 ? '' : v === 1 ? 'half' : 'empty'}">♥</span>`;
  }
  let bs = '';
  if (player && player.headInWater) for (let i = 0; i < Math.ceil(air); i++) bs += '<span class="bubble">●</span>';
  const key = hs + bs;
  if (key !== lastHearts) { $('hearts').innerHTML = hs; $('bubbles').innerHTML = bs; lastHearts = key; }
}

let toastTimer = null;
function toast(msg) {
  const t = $('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 1400);
}

function showMenu(id) {
  for (const m of document.querySelectorAll('.menu')) m.classList.add('hidden');
  if (id) $(id).classList.remove('hidden');
}

let settingsReturn = 'menu-main';
function openSettings(from) {
  settingsReturn = from;
  $('set-rd').value = settings.rd;
  $('set-sens').value = settings.sens;
  $('set-res').value = settings.res;
  $('set-fov').value = settings.fov;
  $('set-info').checked = settings.info;
  $('set-sound').checked = settings.sound;
  updateSettingLabels();
  showMenu('menu-settings');
}
function updateSettingLabels() {
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
bindSetting('set-rd', 'rd', (t) => parseInt(t.value, 10));
bindSetting('set-sens', 'sens', (t) => parseFloat(t.value));
bindSetting('set-res', 'res', (t) => parseFloat(t.value));
bindSetting('set-fov', 'fov', (t) => parseInt(t.value, 10));
bindSetting('set-info', 'info', (t) => t.checked);
bindSetting('set-sound', 'sound', (t) => t.checked);
function applySettings() {
  controls.sensitivity = settings.sens;
  camera.fov = settings.fov;
  camera.far = settings.rd * 16 + 80;
  resize();
  if (!settings.info) $('info').textContent = '';
}

function openInventory() {
  if (state !== 'playing') return;
  state = 'inventory';
  controls.reset();
  document.exitPointerLock?.();
  const grid = $('inv-grid');
  grid.innerHTML = '';
  const survival = mode === 'survival';
  const ids = survival ? Object.keys(inv).map(Number).filter((id) => inv[id] > 0) : PLACEABLE;
  $('inventory').querySelector('h2').textContent = survival ? 'Inventory' : 'Blocks';
  for (const id of ids) {
    const s = document.createElement('div');
    s.className = 'slot';
    s.title = BLOCKS[id].name;
    s.innerHTML = `<img src="${icon(id)}" alt=""><span class="count">${survival ? inv[id] : ''}</span>`;
    s.addEventListener('click', () => {
      const existing = hotbar.indexOf(id);
      if (existing >= 0 && existing !== sel) hotbar[existing] = hotbar[sel];
      hotbar[sel] = id;
      renderHotbar();
      closeInventory();
      toast(BLOCKS[id].name);
    });
    grid.appendChild(s);
  }
  if (survival) {
    if (!ids.length) grid.insertAdjacentHTML('beforeend', '<p class="hint" style="grid-column:1/-1">Empty — hold on blocks to mine them.</p>');
    const h = document.createElement('p');
    h.className = 'hint';
    h.style.gridColumn = '1/-1';
    h.textContent = 'Crafting';
    grid.appendChild(h);
    for (const r of RECIPES) {
      const ok = r.in.every(([id, n]) => (inv[id] || 0) >= n);
      const b = document.createElement('button');
      b.className = 'hud-btn';
      b.style.cssText = 'grid-column:1/-1;padding:8px;display:flex;align-items:center;gap:6px;justify-content:center;opacity:' + (ok ? 1 : 0.4);
      b.innerHTML = r.in.map(([id, n]) => `${n}×<img src="${icon(id)}" width="22" height="22">`).join(' + ') +
        ` → ${r.out[1]}×<img src="${icon(r.out[0])}" width="22" height="22"> ${BLOCKS[r.out[0]].name}`;
      b.disabled = !ok;
      b.addEventListener('click', () => {
        if (!r.in.every(([id, n]) => (inv[id] || 0) >= n)) return;
        for (const [id, n] of r.in) inv[id] -= n;
        addItem(r.out[0], r.out[1]);
        sound.place(r.out[0]);
        state = 'playing';
        openInventory();
      });
      grid.appendChild(b);
    }
  }
  showMenu('inventory');
}
function closeInventory() {
  showMenu(null);
  state = 'playing';
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
  $('btn-down').classList.toggle('hidden', !(player?.flying || player?.inWater));
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
  if (!world) return;
  const data = {
    v: 1, seed: world.seed, mode, time: timeOfDay, hotbar, sel, inv, health, spawn,
    player: { pos: player.pos, yaw: player.yaw, pitch: player.pitch, flying: player.flying },
    edits: world.serializeEdits(),
  };
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(data)); } catch { toast('Could not save — storage full'); }
}
function loadSave() { return safeParse(localStorage.getItem(SAVE_KEY)); }

function findSpawn(w) {
  for (let r = 0; r < 400; r += 4) {
    for (let a = 0; a < 16; a++) {
      const x = Math.round(Math.cos(a / 16 * Math.PI * 2) * r), z = Math.round(Math.sin(a / 16 * Math.PI * 2) * r);
      const { h } = w.column(x, z);
      if (h > WATER_LEVEL + 1 && h < 60) return [x + 0.5, z + 0.5];
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
  fuses.length = 0;
  particles.list.length = 0;
}

function startGame(data) {
  $('loading').classList.remove('hidden');
  showMenu(null);
  setTimeout(() => {
    clearWorld();
    world = new World(data.seed, data.edits || {});
    player = new Player(world);
    mode = data.mode || 'creative';
    timeOfDay = data.time ?? 0.05;
    hotbar = data.hotbar ? [...data.hotbar] : mode === 'creative' ? [...DEFAULT_HOTBAR] : Array(9).fill(0);
    sel = data.sel || 0;
    inv = data.inv || {};
    health = data.health ?? 20;
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
    renderHotbar();
    renderStats();
    updateFlyUI();
    $('loading').classList.add('hidden');
    $('btn-continue').disabled = false;
    save();
    resume();
  }, 30);
}

// ---------- Menus wiring ----------
let newMode = 'creative';
const tap = (id, fn) => $(id).addEventListener('click', () => { sound.unlock(); fn(); });
tap('btn-continue', () => { const d = loadSave(); if (d) startGame(d); });
tap('btn-new', () => { $('seed-input').value = ''; showMenu('menu-new'); });
tap('btn-new-back', () => showMenu('menu-main'));
tap('btn-settings-main', () => openSettings('menu-main'));
tap('btn-settings-pause', () => openSettings('menu-pause'));
tap('btn-settings-back', () => showMenu(settingsReturn));
tap('btn-resume', () => resume());
tap('btn-quit', () => { save(); state = 'menu'; $('hud').classList.add('hidden'); showMenu('menu-main'); });
tap('btn-inv-close', () => closeInventory());
tap('btn-respawn', () => respawn());
tap('btn-create', () => {
  const s = $('seed-input').value.trim();
  const seed = s ? hashSeed(s) : (Math.random() * 2 ** 31) | 0;
  startGame({ seed, mode: newMode });
});
for (const b of document.querySelectorAll('#mode-seg button')) {
  b.addEventListener('click', () => {
    newMode = b.dataset.mode;
    for (const o of document.querySelectorAll('#mode-seg button')) o.classList.toggle('on', o === b);
    $('mode-hint').textContent = newMode === 'creative'
      ? 'Unlimited blocks, flying, no damage.'
      : 'Mine blocks to collect them, craft, and try not to fall or drown.';
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
  if (state === 'inventory' && (e.code === 'KeyE' || e.code === 'Escape')) closeInventory();
  else if (state === 'paused' && e.code === 'Escape') resume();
});
canvas.addEventListener('touchstart', () => sound.unlock(), { passive: true });

$('btn-continue').disabled = !loadSave();

// Save when the app is backgrounded / closed
document.addEventListener('visibilitychange', () => { if (document.hidden) { save(); if (state === 'playing') pause(); } });
window.addEventListener('pagehide', save);

// Android hardware back button
App.addListener('backButton', () => {
  if (state === 'playing') pause();
  else if (state === 'paused') resume();
  else if (state === 'inventory') closeInventory();
  else if (!$('menu-settings').classList.contains('hidden')) showMenu(settingsReturn);
  else if (!$('menu-new').classList.contains('hidden')) showMenu('menu-main');
  else if (state === 'menu') App.exitApp();
}).catch(() => {});

// ---------- Main loop ----------
const skyDay = new THREE.Color(0x87b8ff), skyNight = new THREE.Color(0x070b1c), skySunset = new THREE.Color(0xf09a5a);
const waterFog = new THREE.Color(0x1a3c8c);
const tmpColor = new THREE.Color();
let lastT = performance.now();
let fpsFrames = 0, fpsTime = 0, fps = 0;

function updateSky(dt) {
  timeOfDay = (timeOfDay + dt / DAY_LENGTH) % 1;
  const s = Math.sin(timeOfDay * Math.PI * 2);
  const k = THREE.MathUtils.smoothstep(s, -0.2, 0.25);
  light = 0.2 + 0.8 * k;
  tmpColor.copy(skyNight).lerp(skyDay, k);
  const dusk = Math.max(0, 1 - Math.abs(s) * 4) * 0.6;
  tmpColor.lerp(skySunset, dusk);
  const under = player.headInWater;
  scene.background.copy(under ? waterFog : tmpColor);
  scene.fog.color.copy(under ? waterFog : tmpColor);
  const far = settings.rd * 16;
  scene.fog.near = under ? 0.5 : far * 0.55;
  scene.fog.far = under ? 18 : far;
  solidMat.color.setScalar(light);
  waterMat.color.setScalar(light);
  clouds.material.color.setScalar(Math.max(0.3, light));
  skyPivot.position.set(player.pos[0], player.pos[1], player.pos[2]);
  skyPivot.rotation.x = timeOfDay * Math.PI * 2 - Math.PI / 2;
  clouds.position.x = player.pos[0];
  clouds.position.z = player.pos[2];
  clouds.material.map.offset.set((player.pos[0] / 1600) * 4 + performance.now() / 400000, -(player.pos[2] / 1600) * 4);
  $('water-overlay').classList.toggle('on', under);
}

function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, (now - lastT) / 1000);
  lastT = now;
  if (!world) return;

  if (state === 'playing') {
    const [lx, ly] = controls.consumeLook();
    player.yaw -= lx;
    player.pitch = Math.max(-Math.PI / 2 + 0.01, Math.min(Math.PI / 2 - 0.01, player.pitch - ly));
    player.update(dt, controls.input);
    updateChunks(dt);
    updateSurvival(dt);
    updateFuses(dt);

    // Targeting
    target = raycast(world, eyePos(), lookDir(), REACH);
    if (target) {
      outline.visible = true;
      outline.position.set(target.hit[0] + 0.5, target.hit[1] + 0.5, target.hit[2] + 0.5);
    } else outline.visible = false;

    // Breaking
    const ring = $('hold-ring');
    if (controls.breaking && target) {
      const key = target.hit.join(',');
      if (!breakState || breakState.key !== key) breakState = { key, t: 0, need: breakTime(target.id) };
      breakState.t += dt;
      if (Math.random() < dt * 8 && mode === 'survival') spawnParticles(...target.hit, target.id, 1, 2);
      const prog = Math.min(1, breakState.t / breakState.need);
      ring.classList.add('active');
      ring.firstElementChild.style.strokeDashoffset = String(100.5 * (1 - prog));
      if (breakState.t >= breakState.need) { breakBlock(target); breakState = null; }
    } else {
      breakState = null;
      ring.classList.remove('active');
    }

    if ($('btn-down').classList.contains('hidden') === !!(player.flying || player.inWater)) updateFlyUI();

    saveTimer += dt;
    if (saveTimer > 20) { saveTimer = 0; save(); }
  } else {
    outline.visible = false;
  }

  updateSky(state === 'playing' ? dt : 0);
  updateParticles(dt);

  camera.position.set(player.pos[0], player.pos[1] + EYE, player.pos[2]);
  camera.rotation.set(player.pitch, player.yaw, 0);
  renderer.render(scene, camera);

  fpsFrames++; fpsTime += dt;
  if (fpsTime >= 0.5) {
    fps = Math.round(fpsFrames / fpsTime);
    fpsFrames = 0; fpsTime = 0;
    if (settings.info) {
      const p = player.pos;
      $('info').textContent = `${fps} fps\nXYZ ${p[0].toFixed(1)} ${p[1].toFixed(1)} ${p[2].toFixed(1)}\nchunks ${world.chunks.size} · ${mode}`;
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
  get world() { return world; }, get player() { return player; }, get target() { return target; }, controls,
  place: () => placeBlock(), mine: () => target && breakBlock(target), save, get state() { return state; },
};
