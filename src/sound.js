import { BLOCKS } from './blocks.js';

// Tiny synthesized sound effects via WebAudio (no audio assets needed)
export class Sound {
  constructor(enabled) {
    this.enabled = enabled;
    this.ctx = null;
    this.noiseBuf = null;
  }

  unlock() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      const len = this.ctx.sampleRate;
      this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = this.noiseBuf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
  }

  noise(dur, freq, vol, type = 'lowpass', q = 1) {
    if (!this.enabled() || !this.ctx) return;
    const c = this.ctx, t = c.currentTime;
    const src = c.createBufferSource();
    src.buffer = this.noiseBuf;
    const f = c.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = q;
    const g = c.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(f).connect(g).connect(c.destination);
    src.start(t, Math.random() * 0.5);
    src.stop(t + dur);
  }

  tone(f0, f1, dur, vol, type = 'sine') {
    if (!this.enabled() || !this.ctx) return;
    const c = this.ctx, t = c.currentTime;
    const o = c.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    const g = c.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g).connect(c.destination);
    o.start(t);
    o.stop(t + dur);
  }

  freqFor(id) {
    const n = BLOCKS[id].name;
    if (/Glass|Ice/.test(n)) return 4000;
    if (/Stone|Cobble|Ore|Brick|Obsidian|Bedrock/.test(n)) return 1800;
    if (/Log|Plank|Table|Bookshelf/.test(n)) return 900;
    if (/Sand|Gravel|Snow/.test(n)) return 2500;
    if (/Wool|Leaves/.test(n)) return 1200;
    return 700;
  }

  break(id) {
    const f = this.freqFor(id);
    this.noise(0.18, f, 0.5, 'bandpass', 0.8);
    if (/Glass|Ice/.test(BLOCKS[id].name)) this.tone(2400, 900, 0.15, 0.08, 'triangle');
  }
  place(id) { this.noise(0.09, this.freqFor(id) * 0.8, 0.45, 'bandpass', 1.2); }
  hurt() { this.tone(260, 120, 0.25, 0.25, 'square'); }
  fuse() { this.noise(1.2, 5000, 0.12, 'highpass'); }
  explode() { this.noise(1.4, 400, 1.0, 'lowpass'); this.tone(90, 30, 0.8, 0.5); }
}
