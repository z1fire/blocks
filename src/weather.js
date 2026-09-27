import * as THREE from 'three';
import { BIOME_DESERT, BIOME_SNOW, BIOME_TAIGA } from './world.js';

const RAIN_N = 700, SNOW_N = 600, RADIUS = 18;

// Rain and snow around the player, with occasional storms
export class Weather {
  constructor(scene) {
    this.raining = false;
    this.timer = 300 + Math.random() * 600;
    this.intensity = 0;
    this.kind = 'rain';

    const rg = new THREE.BufferGeometry();
    rg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(RAIN_N * 6), 3));
    this.rain = new THREE.LineSegments(rg, new THREE.LineBasicMaterial({ color: 0x9fb8e0, transparent: true, opacity: 0.5, depthWrite: false }));
    this.rain.frustumCulled = false;
    this.rainDrops = Array.from({ length: RAIN_N }, () => ({ x: 0, y: -1000, z: 0, floor: 0, s: 18 + Math.random() * 6 }));

    const sg = new THREE.BufferGeometry();
    sg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(SNOW_N * 3), 3));
    this.snow = new THREE.Points(sg, new THREE.PointsMaterial({ color: 0xffffff, size: 0.13, transparent: true, opacity: 0.9, depthWrite: false }));
    this.snow.frustumCulled = false;
    this.flakes = Array.from({ length: SNOW_N }, () => ({ x: 0, y: -1000, z: 0, floor: 0, s: 1.5 + Math.random(), ph: Math.random() * 6 }));
    scene.add(this.rain, this.snow);
  }

  serialize() { return { raining: this.raining, timer: this.timer }; }
  load(d) {
    if (!d) return;
    this.raining = !!d.raining;
    this.timer = d.timer ?? this.timer;
    this.intensity = this.raining ? 1 : 0;
  }
  toggle() { this.raining = !this.raining; this.timer = this.raining ? 150 + Math.random() * 200 : 400 + Math.random() * 700; }

  respawn(d, px, py, pz, world, spread) {
    d.x = px + (Math.random() * 2 - 1) * RADIUS;
    d.z = pz + (Math.random() * 2 - 1) * RADIUS;
    d.y = py + (spread ? Math.random() * 24 - 6 : 14 + Math.random() * 6);
    d.floor = world.surfaceHeight(Math.floor(d.x), Math.floor(d.z)) + 1;
  }

  update(dt, player, world) {
    this.timer -= dt;
    if (this.timer <= 0) this.toggle();
    const [px, py, pz] = player.pos;
    const biome = world.column(Math.floor(px), Math.floor(pz)).biome;
    const kind = biome === BIOME_DESERT ? 'none' : biome === BIOME_SNOW || biome === BIOME_TAIGA ? 'snow' : 'rain';
    const target = this.raining && kind !== 'none' ? 1 : 0;
    this.intensity += (target - this.intensity) * Math.min(1, dt * 0.3);
    if (kind !== this.kind) { this.kind = kind; for (const d of [...this.rainDrops, ...this.flakes]) d.y = -1000; }

    const active = Math.floor((kind === 'snow' ? SNOW_N : RAIN_N) * this.intensity);
    this.rain.visible = kind === 'rain' && active > 0;
    this.snow.visible = kind === 'snow' && active > 0;
    let budget = 30; // limit surface lookups per frame

    if (this.rain.visible) {
      const a = this.rain.geometry.attributes.position.array;
      for (let i = 0; i < RAIN_N; i++) {
        const d = this.rainDrops[i];
        if (i >= active) { a[i * 6 + 1] = a[i * 6 + 4] = -1000; continue; }
        d.y -= d.s * dt;
        const far = Math.abs(d.x - px) > RADIUS || Math.abs(d.z - pz) > RADIUS;
        if ((d.y < d.floor || d.y < py - 12 || far) && budget-- > 0) this.respawn(d, px, py, pz, world, d.y < -500);
        a[i * 6] = d.x; a[i * 6 + 1] = d.y; a[i * 6 + 2] = d.z;
        a[i * 6 + 3] = d.x + 0.05; a[i * 6 + 4] = d.y + 0.7; a[i * 6 + 5] = d.z;
      }
      this.rain.geometry.attributes.position.needsUpdate = true;
      this.rain.material.opacity = 0.45 * this.intensity;
    }
    if (this.snow.visible) {
      const a = this.snow.geometry.attributes.position.array;
      const t = performance.now() / 1000;
      for (let i = 0; i < SNOW_N; i++) {
        const d = this.flakes[i];
        if (i >= active) { a[i * 3 + 1] = -1000; continue; }
        d.y -= d.s * dt;
        const far = Math.abs(d.x - px) > RADIUS || Math.abs(d.z - pz) > RADIUS;
        if ((d.y < d.floor || d.y < py - 12 || far) && budget-- > 0) this.respawn(d, px, py, pz, world, d.y < -500);
        a[i * 3] = d.x + Math.sin(t + d.ph) * 0.3; a[i * 3 + 1] = d.y; a[i * 3 + 2] = d.z + Math.cos(t * 0.8 + d.ph) * 0.3;
      }
      this.snow.geometry.attributes.position.needsUpdate = true;
    }
  }

  // Multiplier for sky brightness
  get gloom() { return 1 - 0.35 * this.intensity; }
  get rainLevel() { return this.kind === 'rain' ? this.intensity : 0; }
}
