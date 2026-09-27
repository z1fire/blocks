import { BLOCKS } from './blocks.js';

// Synthesized sound effects via WebAudio (no audio assets needed)
export class Sound {
  constructor(enabled) {
    this.enabled = enabled;
    this.ctx = null;
    this.noiseBuf = null;
    this.master = null;
    this.rain = null;
  }

  unlock() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.connect(this.ctx.destination);
      const len = this.ctx.sampleRate * 2;
      this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = this.noiseBuf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
  }

  ok() { return this.enabled() && this.ctx && this.ctx.state === 'running'; }

  noise(dur, freq, vol, type = 'lowpass', q = 1, delay = 0) {
    if (!this.ok() || vol <= 0.001) return;
    const c = this.ctx, t = c.currentTime + delay;
    const src = c.createBufferSource();
    src.buffer = this.noiseBuf;
    const f = c.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = q;
    const g = c.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(f).connect(g).connect(this.master);
    src.start(t, Math.random() * 1.5);
    src.stop(t + dur);
  }

  tone(f0, f1, dur, vol, type = 'sine', delay = 0, filter = 0) {
    if (!this.ok() || vol <= 0.001) return;
    const c = this.ctx, t = c.currentTime + delay;
    const o = c.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + Math.min(0.03, dur / 4));
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    let node = o.connect(g);
    if (filter) { const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = filter; node = g.connect(f); }
    node.connect(this.master);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  static falloff(dist) { return Math.max(0, 1 - dist / 20); }

  freqFor(id) {
    const n = BLOCKS[id]?.name || '';
    if (/Glass|Ice/.test(n)) return 4000;
    if (/Stone|Cobble|Ore|Brick|Obsidian|Bedrock|Furnace|Slab|Block/.test(n)) return 1800;
    if (/Log|Plank|Table|Bookshelf|Bed/.test(n)) return 900;
    if (/Sand|Gravel|Snow/.test(n)) return 2500;
    if (/Wool|Leaves|Grass|Poppy|Dandelion|Sapling|Wheat|Mushroom/.test(n)) return 1200;
    return 700;
  }

  break(id) {
    this.noise(0.18, this.freqFor(id), 0.5, 'bandpass', 0.8);
    if (/Glass|Ice/.test(BLOCKS[id]?.name)) this.tone(2400, 900, 0.15, 0.08, 'triangle');
  }
  place(id) { this.noise(0.09, this.freqFor(id) * 0.8, 0.45, 'bandpass', 1.2); }
  hit(id) { this.noise(0.06, this.freqFor(id), 0.18, 'bandpass', 1.5); }
  step(id) { this.noise(0.07, this.freqFor(id) * 0.7, 0.12, 'bandpass', 1); }
  hurt() { this.tone(260, 120, 0.25, 0.25, 'square', 0, 1200); }
  fuse() { this.noise(1.2, 5000, 0.12, 'highpass'); }
  explode() { this.noise(1.6, 350, 1.0, 'lowpass'); this.tone(90, 30, 0.9, 0.5); }
  eat() { for (let i = 0; i < 3; i++) this.noise(0.08, 900 + i * 100, 0.3, 'bandpass', 2, i * 0.12); }
  pop() { this.tone(500 + Math.random() * 300, 1200, 0.08, 0.15, 'sine'); }
  toolBreak() { this.noise(0.3, 3000, 0.4, 'bandpass', 1); this.tone(1800, 400, 0.2, 0.1, 'triangle'); }
  splash() { this.noise(0.5, 1200, 0.3, 'lowpass'); }
  click() { this.tone(900, 700, 0.05, 0.08, 'square', 0, 2500); }
  hiss(dist) { this.noise(1.5, 5500, 0.35 * Sound.falloff(dist), 'highpass'); }
  sleep() { this.tone(440, 220, 1.2, 0.08, 'sine'); }

  mob(type, kind, dist) {
    const v = Sound.falloff(dist);
    if (v <= 0) return;
    const hurt = kind === 'hurt' || kind === 'death';
    const p = hurt ? 1.25 : 1;
    switch (type) {
      case 'pig': this.tone(260 * p, 180 * p, 0.15, 0.2 * v, 'square', 0, 900); this.tone(240 * p, 170 * p, 0.12, 0.18 * v, 'square', 0.18, 900); break;
      case 'cow': this.tone(140 * p, 105 * p, 0.8, 0.25 * v, 'sawtooth', 0, 600); break;
      case 'sheep': for (let i = 0; i < 4; i++) this.tone(330 * p, 300 * p, 0.12, 0.14 * v, 'sawtooth', i * 0.1, 1400); break;
      case 'chicken': this.tone(1300 * p, 1700 * p, 0.07, 0.1 * v, 'triangle'); this.tone(1400 * p, 1100 * p, 0.07, 0.1 * v, 'triangle', 0.1); break;
      case 'zombie': this.tone(95 * p, 70 * p, 0.9, 0.25 * v, 'sawtooth', 0, 400); break;
      case 'creeper': if (hurt) this.noise(0.3, 900, 0.3 * v, 'bandpass', 1); break;
    }
  }

  setRain(level) {
    if (!this.ctx) return;
    const target = this.enabled() ? level * 0.12 : 0;
    if (!this.rain) {
      if (target <= 0.001) return;
      const c = this.ctx;
      const src = c.createBufferSource();
      src.buffer = this.noiseBuf;
      src.loop = true;
      const f = c.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = 2500;
      const g = c.createGain();
      g.gain.value = 0;
      src.connect(f).connect(g).connect(this.master);
      src.start();
      this.rain = g;
    }
    this.rain.gain.setTargetAtTime(target, this.ctx.currentTime, 0.5);
  }
}
