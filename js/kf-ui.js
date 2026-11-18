// ============================================================
// kf-ui.js — text / button / menu helpers, full-screen + mute buttons,
// and the session object shared by scenes (window.KF).
// ============================================================
const KF = window.KF = {
  mode: 'arcade',          // arcade | story | vs | free | watch
  diff: 'normal',
  p1: 'kowloon', p2: 'muscle', p1form: null, p2form: null,
  flow: null, storyFight: 'auto',
  ladder: [], ladderIdx: 0, continues: 0,
  stage: null,
  results: [],             // finished matches (tests read this)
};
{ const d = store('diff'); if (DIFFICULTY[d]) KF.diff = d; const sf = store('storyFight'); if (sf === 'play' || sf === 'auto') KF.storyFight = sf; }

function T(scene, x, y, text, size = 24, color = '#ffffff', opts = {}) {
  const t = scene.add.text(x, y, text, Object.assign({
    fontFamily: FONT_TC, fontSize: size + 'px', color, stroke: '#000000', strokeThickness: Math.max(3, Math.round(size / 6)),
    align: 'center',
  }, opts));
  return t;
}
function gradText(scene, x, y, text, size, c1 = '#ffffff', c2 = '#ffd84a', c3 = '#ff5a00', opts = {}) {
  const t = scene.add.text(x, y, text, Object.assign({ fontFamily: FONT_BIG, fontSize: size + 'px', fontStyle: 'bold italic',
    color: '#fff', stroke: '#3a0800', strokeThickness: Math.round(size / 5),
    shadow: { offsetX: 4, offsetY: 4, color: '#000', blur: 0, fill: true, stroke: true } }, opts)).setOrigin(0.5);
  try { const g = t.context.createLinearGradient(0, 0, 0, t.height); g.addColorStop(0, c1); g.addColorStop(0.5, c2); g.addColorStop(1, c3); t.setFill(g); } catch (e) { /* */ }
  return t;
}
function makeButton(scene, x, y, w, h, label, cb, opts = {}) {
  const bg = scene.add.rectangle(0, 0, w, h, opts.fill || 0x101830, opts.alpha != null ? opts.alpha : 0.85).setStrokeStyle(3, opts.stroke || 0xffd84a);
  const txt = T(scene, 0, 0, label, opts.size || 26, opts.color || '#ffffff').setOrigin(0.5);
  const c = scene.add.container(x, y, [bg, txt]).setSize(w, h).setDepth(opts.depth || 50);
  c.setInteractive({ useHandCursor: true });
  c.bg = bg; c.txt = txt; c.cb = cb;
  c.on('pointerup', () => { SFX.unlock(); if (scene.__menuLock) return; SFX.announce('ok'); cb(); });
  c.on('pointerover', () => { if (c.menu) c.menu.select(c.menuIndex, true); });
  if (opts.scrollFactor === 0) c.setScrollFactor(0);
  return c;
}
// Keyboard / pad navigable vertical (or horizontal) menu of buttons
class Menu {
  constructor(scene, buttons, opts = {}) {
    this.scene = scene; this.buttons = buttons; this.opts = opts; this.idx = opts.start || 0; this.horizontal = !!opts.horizontal;
    buttons.forEach((b, i) => { b.menu = this; b.menuIndex = i; });
    this.select(this.idx, true);
  }
  select(i, silent) {
    this.idx = (i + this.buttons.length) % this.buttons.length;
    if (this.opts && this.opts.style) { this.buttons.forEach((b, k) => this.opts.style(b, k === this.idx)); if (!silent) SFX.announce('select'); if (this.opts.onSelect) this.opts.onSelect(this.idx); return; }
    this.buttons.forEach((b, k) => { const on = k === this.idx; b.bg.setStrokeStyle(on ? 5 : 3, on ? 0xffffff : 0xffd84a); b.bg.setFillStyle(on ? 0x2a3a78 : 0x101830, 0.88); b.setScale(on ? 1.05 : 1); });
    if (!silent) SFX.announce('select');
  }
  update() {
    const prev = this.horizontal ? 'left' : 'up', next = this.horizontal ? 'right' : 'down';
    if (Input.menu(prev)) this.select(this.idx - 1);
    if (Input.menu(next)) this.select(this.idx + 1);
    if (Input.menu('ok')) { const b = this.buttons[this.idx]; if (b && b.cb) { SFX.announce('ok'); b.cb(); } }
  }
}
const UI = {
  fullscreenAvailable(game) { return !!(game.device.fullscreen && game.device.fullscreen.available); },
  isStandalone() {
    try { return window.matchMedia('(display-mode: fullscreen)').matches || window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true; } catch (e) { return false; }
  },
  topButtons(scene) {
    const items = [];
    if (!this.isStandalone()) {
      const fs = makeButton(scene, VIEW_W - 78, 26, 140, 40, '全螢幕', () => this.toggleFullscreen(scene), { size: 18, depth: 200 });
      const refresh = () => { try { fs.txt.setText(scene.scale.isFullscreen ? '退出全螢幕' : '全螢幕'); } catch (e) { /* */ } };
      scene.scale.on('enterfullscreen', refresh); scene.scale.on('leavefullscreen', refresh);
      scene.events.once('shutdown', () => { scene.scale.off('enterfullscreen', refresh); scene.scale.off('leavefullscreen', refresh); });
      refresh(); items.push(fs);
    }
    const mute = makeButton(scene, VIEW_W - 78, items.length ? 72 : 26, 140, 40, '', () => SFX.toggleMute(), { size: 18, depth: 200 });
    const rm = () => { try { mute.txt.setText(SFX.muted ? '♪ 靜音 (M)' : '♪ 音樂 (M)').setColor(SFX.muted ? '#ff9a9a' : '#ffffff'); } catch (e) { /* */ } };
    window.addEventListener('kf-mute', rm); scene.events.once('shutdown', () => window.removeEventListener('kf-mute', rm));
    rm(); items.push(mute);
    return items;
  },
  toggleFullscreen(scene) {
    SFX.unlock();
    const sc = scene.scale;
    if (sc.isFullscreen) { sc.stopFullscreen(); return; }
    if (!this.fullscreenAvailable(scene.game)) { this.iosHint(scene); return; }
    try { sc.startFullscreen(); } catch (e) { this.iosHint(scene); }
  },
  iosHint(scene) {
    if (scene.__hint) return;
    const items = [
      scene.add.rectangle(VIEW_W / 2, VIEW_H / 2, 620, 220, 0x101830, 0.96).setStrokeStyle(3, 0xffd84a),
      T(scene, VIEW_W / 2, VIEW_H / 2 - 70, 'iPhone 全螢幕玩法', 30, '#ffd84a').setOrigin(0.5),
      T(scene, VIEW_W / 2, VIEW_H / 2 + 5, '1. 用 Safari 開啟本頁\n2. 按「分享」→「加入主畫面」\n3. 由主畫面圖示開啟，即可全螢幕', 22, '#ffffff', { lineSpacing: 6 }).setOrigin(0.5),
      T(scene, VIEW_W / 2, VIEW_H / 2 + 88, '（點擊關閉）', 16, '#aab4c8').setOrigin(0.5),
    ];
    items.forEach(o => o.setDepth(500).setScrollFactor(0));
    scene.__hint = items;
    scene.input.once('pointerup', () => { items.forEach(o => o.destroy()); scene.__hint = null; });
  },
  fadeTo(scene, key, data, ms = 250) {
    if (scene.__leaving) return; scene.__leaving = true; scene.__menuLock = true;
    const token = { done: false };
    const go = () => { if (token.done) return; token.done = true; try { scene.scene.start(key, data); } catch (e) { console.error(e); } };
    try { scene.cameras.main.fadeOut(ms, 0, 0, 0); scene.cameras.main.once('camerafadeoutcomplete', go); } catch (e) { go(); }
    setTimeout(go, ms + 700);      // safety net if the fade event never fires
  },
  // call first in every scene's create(): scenes are reused objects, so reset per-run flags
  sceneInit(scene) {
    scene.__leaving = false; scene.__menuLock = false; scene.__hint = null;
    Input.clearEdges();
    scene.cameras.main.fadeIn(200, 0, 0, 0);
  },
};
function shuffle(a) { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
