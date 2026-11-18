// ============================================================
// kf-input.js — one global input layer (installed once, survives scene
// restarts, so no per-scene listeners can leak).
//   Keyboard (window keydown/keyup by e.code), Gamepad (polled), Touch
//   (FightScene writes Input.touch every frame).
//   Input.frame(side) → { l, r, u, d (held), lp, lk, s1, s2, s3, sp (pressed edges) }
// ============================================================
const BTN = ['lp', 'lk', 's1', 's2', 's3', 'sp'];
const KEYMAP = {
  // P1 (also arrows when not in 2P mode)
  p1: { l: ['KeyA'], r: ['KeyD'], u: ['KeyW', 'Space'], d: ['KeyS'],
        lp: ['KeyJ'], lk: ['KeyK'], s1: ['KeyU'], s2: ['KeyI'], s3: ['KeyO'], sp: ['KeyL'] },
  p2: { l: ['ArrowLeft'], r: ['ArrowRight'], u: ['ArrowUp'], d: ['ArrowDown'],
        lp: ['Numpad1', 'Comma'], lk: ['Numpad2', 'Period'], s1: ['Numpad4', 'Semicolon'], s2: ['Numpad5', 'Quote'],
        s3: ['Numpad6', 'BracketRight'], sp: ['Numpad3', 'Slash'] },
};
const MENU_KEYS = { up: ['ArrowUp', 'KeyW'], down: ['ArrowDown', 'KeyS'], left: ['ArrowLeft', 'KeyA'], right: ['ArrowRight', 'KeyD'],
  ok: ['Enter', 'KeyJ', 'Space', 'NumpadEnter', 'Numpad1'], back: ['Escape', 'Backspace', 'KeyK'], pause: ['Escape', 'KeyP', 'Enter'] };

const Input = {
  down: new Set(),            // keys held
  pressed: new Set(),         // keys pressed since last consume (edge)
  twoP: false,                // in 2P the arrow keys belong to P2
  touch: { l: false, r: false, u: false, d: false, lp: false, lk: false, s1: false, s2: false, s3: false, sp: false },
  touchEdge: {},
  ext: [null, null],          // automated tests / AI can inject per side
  pad: [{}, {}], padPrev: [{}, {}],
  installed: false,
  install() {
    if (this.installed) return; this.installed = true;
    const block = new Set(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'Slash', 'Quote', 'Tab']);
    window.addEventListener('keydown', e => {
      if (block.has(e.code)) e.preventDefault();
      if (!e.repeat) this.pressed.add(e.code);
      this.down.add(e.code);
    });
    window.addEventListener('keyup', e => { this.down.delete(e.code); });
    window.addEventListener('blur', () => { this.down.clear(); this.pressed.clear(); });
    document.addEventListener('visibilitychange', () => { if (document.hidden) { this.down.clear(); this.pressed.clear(); } });
  },
  anyDown(codes) { for (const c of codes) if (this.down.has(c)) return true; return false; },
  anyPressed(codes) { let hit = false; for (const c of codes) if (this.pressed.has(c)) hit = true; return hit; },
  consume(codes) { let hit = false; for (const c of codes) if (this.pressed.delete(c)) hit = true; return hit; },
  clearEdges() { this.pressed.clear(); this.touchEdge = {}; for (const p of this.pad) for (const k in p) if (k.endsWith('_e')) p[k] = false; },
  // Menu helpers (any player, keyboard or pad)
  menu(name) {
    let v = this.consume(MENU_KEYS[name]);
    const pm = { up: 'u', down: 'd', left: 'l', right: 'r', ok: 'lp', back: 'lk', pause: 'start' };
    for (let i = 0; i < 2; i++) if (this.pad[i][pm[name] + '_e']) { v = true; this.pad[i][pm[name] + '_e'] = false; }
    return v;
  },
  pollPads() {
    let pads = [];
    try { pads = (navigator.getGamepads && Array.from(navigator.getGamepads()).filter(Boolean)) || []; } catch (e) { pads = []; }
    for (let i = 0; i < 2; i++) {
      const p = pads[i], prev = this.pad[i], cur = {};
      if (p) {
        const b = k => !!(p.buttons[k] && p.buttons[k].pressed);
        const ax = p.axes[0] || 0, ay = p.axes[1] || 0;
        cur.l = b(14) || ax < -0.5; cur.r = b(15) || ax > 0.5; cur.u = b(12) || ay < -0.5; cur.d = b(13) || ay > 0.5;
        cur.lp = b(0); cur.lk = b(1); cur.s1 = b(2); cur.s2 = b(3); cur.s3 = b(4); cur.sp = b(5) || b(7); cur.start = b(9);
      }
      for (const k of ['l', 'r', 'u', 'd', 'lp', 'lk', 's1', 's2', 's3', 'sp', 'start']) {
        cur[k + '_e'] = (cur[k] && !prev[k]) || (prev[k + '_e'] && cur[k]) || false;
      }
      this.pad[i] = cur;
    }
  },
  // side 0 = P1, 1 = P2. Touch always drives P1.
  frame(side) {
    const out = { l: false, r: false, u: false, d: false };
    const map = side === 0 ? KEYMAP.p1 : KEYMAP.p2;
    const arrowsP1 = side === 0 && !this.twoP;
    for (const k of ['l', 'r', 'u', 'd']) {
      out[k] = this.anyDown(map[k]) || (arrowsP1 && this.anyDown(KEYMAP.p2[k])) || !!this.pad[side][k];
    }
    for (const b of BTN) {
      out[b] = this.consume(map[b]) || false;
      if (this.pad[side][b + '_e']) { out[b] = true; this.pad[side][b + '_e'] = false; }
    }
    if (side === 0) {
      const t = this.touch;
      out.l = out.l || t.l; out.r = out.r || t.r; out.u = out.u || t.u; out.d = out.d || t.d;
      for (const b of BTN) if (this.touchEdge[b]) { out[b] = true; this.touchEdge[b] = false; }
    }
    const x = this.ext[side];
    if (x) { for (const k in x) if (x[k]) out[k] = true; }
    return out;
  },
};
Input.install();
