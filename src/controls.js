// Unified input: touch (virtual joystick, drag-look, tap/hold) and keyboard/mouse.
export class Controls {
  constructor(el, opts) {
    this.el = el;
    this.opts = opts; // { onPlace, onToggleFly, onHotbar(n), onHotbarScroll(d), onInventory, onPause, isActive() }
    this.sensitivity = 1;
    this.look = [0, 0];      // accumulated look delta (radians) consumed each frame
    this.move = [0, 0];      // joystick: x strafe, y forward
    this.keys = new Set();
    this.jumpBtn = false;
    this.downBtn = false;
    this.breaking = false;   // hold-to-break active
    this.touchLook = null;   // {id, x, y, sx, sy, t, moved, holdTimer}
    this.touchMove = null;   // {id, ox, oy}
    this.lastJumpTap = 0;
    this.isTouch = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;

    this.joy = document.getElementById('joystick');
    this.joyKnob = document.getElementById('joystick-knob');
    this.holdRing = document.getElementById('hold-ring');

    this.bindTouch();
    this.bindDesktop();
  }

  get input() {
    const k = this.keys;
    let forward = this.move[1], strafe = this.move[0];
    if (k.has('KeyW') || k.has('ArrowUp')) forward += 1;
    if (k.has('KeyS') || k.has('ArrowDown')) forward -= 1;
    if (k.has('KeyD') || k.has('ArrowRight')) strafe += 1;
    if (k.has('KeyA') || k.has('ArrowLeft')) strafe -= 1;
    const joySprint = this.touchMove && this.move[1] > 0.92;
    return {
      forward: Math.max(-1, Math.min(1, forward)),
      strafe: Math.max(-1, Math.min(1, strafe)),
      jump: this.jumpBtn || k.has('Space'),
      down: this.downBtn || k.has('ShiftLeft') || k.has('ShiftRight'),
      sprint: joySprint || k.has('ControlLeft') || k.has('KeyR'),
    };
  }

  consumeLook() {
    const l = this.look;
    this.look = [0, 0];
    return l;
  }

  // ---------- Touch ----------
  bindTouch() {
    const el = this.el;
    const opt = { passive: false };
    el.addEventListener('touchstart', (e) => this.onTouchStart(e), opt);
    el.addEventListener('touchmove', (e) => this.onTouchMove(e), opt);
    el.addEventListener('touchend', (e) => this.onTouchEnd(e), opt);
    el.addEventListener('touchcancel', (e) => this.onTouchEnd(e), opt);

    const hold = (id, on, off) => {
      const b = document.getElementById(id);
      if (!b) return;
      b.addEventListener('touchstart', (e) => { e.preventDefault(); e.stopPropagation(); b.classList.add('pressed'); on(); }, opt);
      const end = (e) => { e.preventDefault(); e.stopPropagation(); b.classList.remove('pressed'); off(); };
      b.addEventListener('touchend', end, opt);
      b.addEventListener('touchcancel', end, opt);
    };
    hold('btn-jump', () => {
      const now = performance.now();
      if (now - this.lastJumpTap < 300) this.opts.onToggleFly();
      this.lastJumpTap = now;
      this.jumpBtn = true;
    }, () => { this.jumpBtn = false; });
    hold('btn-down', () => { this.downBtn = true; }, () => { this.downBtn = false; });
  }

  onTouchStart(e) {
    e.preventDefault();
    if (!this.opts.isActive()) return;
    const w = window.innerWidth;
    for (const t of e.changedTouches) {
      if (t.clientX < w * 0.4 && !this.touchMove) {
        this.touchMove = { id: t.identifier, ox: t.clientX, oy: t.clientY };
        this.joy.style.left = t.clientX + 'px';
        this.joy.style.top = t.clientY + 'px';
        this.joy.classList.add('active');
        this.joyKnob.style.transform = 'translate(-50%,-50%)';
      } else if (!this.touchLook) {
        const tl = { id: t.identifier, x: t.clientX, y: t.clientY, sx: t.clientX, sy: t.clientY, t: performance.now(), moved: false };
        tl.holdTimer = setTimeout(() => {
          if (!tl.moved && this.touchLook === tl) {
            this.breaking = true;
            this.holdRing.classList.add('active');
          }
        }, 280);
        this.touchLook = tl;
      }
    }
  }

  onTouchMove(e) {
    e.preventDefault();
    for (const t of e.changedTouches) {
      if (this.touchMove && t.identifier === this.touchMove.id) {
        const R = 60;
        let dx = t.clientX - this.touchMove.ox, dy = t.clientY - this.touchMove.oy;
        const d = Math.hypot(dx, dy);
        if (d > R) { dx *= R / d; dy *= R / d; }
        this.move = [dx / R, -dy / R];
        this.joyKnob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
      } else if (this.touchLook && t.identifier === this.touchLook.id) {
        const tl = this.touchLook;
        const dx = t.clientX - tl.x, dy = t.clientY - tl.y;
        tl.x = t.clientX; tl.y = t.clientY;
        if (Math.hypot(t.clientX - tl.sx, t.clientY - tl.sy) > 12) tl.moved = true;
        const s = 0.0055 * this.sensitivity;
        this.look[0] += dx * s;
        this.look[1] += dy * s;
      }
    }
  }

  onTouchEnd(e) {
    e.preventDefault();
    for (const t of e.changedTouches) {
      if (this.touchMove && t.identifier === this.touchMove.id) {
        this.touchMove = null;
        this.move = [0, 0];
        this.joy.classList.remove('active');
      } else if (this.touchLook && t.identifier === this.touchLook.id) {
        const tl = this.touchLook;
        clearTimeout(tl.holdTimer);
        if (!tl.moved && !this.breaking && performance.now() - tl.t < 280) this.opts.onPlace();
        this.breaking = false;
        this.holdRing.classList.remove('active');
        this.touchLook = null;
      }
    }
  }

  // ---------- Keyboard / mouse ----------
  bindDesktop() {
    const el = this.el;
    this.mouseBreak = false;
    el.addEventListener('mousedown', (e) => {
      if (this.isTouchEvent) return;
      if (!this.opts.isActive()) return;
      if (document.pointerLockElement !== el) {
        el.requestPointerLock?.();
        return;
      }
      if (e.button === 0) this.breaking = true;
      else if (e.button === 2) this.opts.onPlace();
    });
    window.addEventListener('mouseup', (e) => { if (e.button === 0 && !this.touchLook) this.breaking = false; });
    el.addEventListener('contextmenu', (e) => e.preventDefault());
    document.addEventListener('mousemove', (e) => {
      if (document.pointerLockElement !== el) return;
      const s = 0.0022 * this.sensitivity;
      this.look[0] += e.movementX * s;
      this.look[1] += e.movementY * s;
    });
    document.addEventListener('pointerlockchange', () => {
      if (document.pointerLockElement !== el && this.opts.isActive() && !this.isTouch) this.opts.onPause();
    });
    el.addEventListener('wheel', (e) => { if (this.opts.isActive()) this.opts.onHotbarScroll(Math.sign(e.deltaY)); }, { passive: true });
    window.addEventListener('keydown', (e) => {
      if (e.target.tagName === 'INPUT') return;
      this.keys.add(e.code);
      if (!this.opts.isActive()) return;
      if (e.code === 'Space') {
        const now = performance.now();
        if (!e.repeat && now - this.lastJumpTap < 300) this.opts.onToggleFly();
        if (!e.repeat) this.lastJumpTap = now;
        e.preventDefault();
      }
      if (e.code === 'KeyF') this.opts.onToggleFly();
      if (e.code === 'KeyE') this.opts.onInventory();
      if (e.code.startsWith('Digit')) {
        const n = parseInt(e.code.slice(5), 10);
        if (n >= 1 && n <= 9) this.opts.onHotbar(n - 1);
      }
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => { this.keys.clear(); this.breaking = false; });
    // Suppress synthetic mouse events after touches
    el.addEventListener('touchstart', () => { this.isTouchEvent = true; }, { passive: true });
  }

  reset() {
    this.move = [0, 0];
    this.breaking = false;
    this.jumpBtn = this.downBtn = false;
    this.touchLook = this.touchMove = null;
    this.keys.clear();
    this.joy.classList.remove('active');
    this.holdRing.classList.remove('active');
  }
}
