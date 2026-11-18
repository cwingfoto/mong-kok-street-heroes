// SelectScene — 4x3 grid (11 heroes + 霓虹龍 once unlocked), big phone-friendly text, detail panel,
// 阿飛 outfit toggle (西裝 / 白背心). arcade & 純故事模式: 1P picks · vs: 1P and 2P pick ·
// free: 1P then the CPU opponent · watch: both CPUs.
const MODE_NAME = { arcade: '街機模式', story: '純故事模式', vs: '雙人對戰', free: '自由對戰', watch: '觀戰模式' };
function bossUnlocked() { return store('bossUnlocked') === '1' || Q.get('unlock') === '1'; }
class SelectScene extends Phaser.Scene {
  constructor() { super('Select'); }
  create() {
    UI.sceneInit(this);
    KF.flow = null;
    this.add.image(VIEW_W / 2, VIEW_H / 2, 'stage_street').setDisplaySize(VIEW_W, VIEW_H).setTint(0x4a6070);
    this.add.rectangle(VIEW_W / 2, VIEW_H / 2, VIEW_W, VIEW_H, 0x020810, 0.55);
    this.header = gradText(this, 312, 34, '選擇角色', 38);
    T(this, 312, 72, MODE_NAME[KF.mode] + (KF.mode === 'vs' ? '' : '　難度：' + DIFFICULTY[KF.diff].name), 20, '#9cf0ff').setOrigin(0.5);
    const bossOk = bossUnlocked() && !['arcade', 'story'].includes(KF.mode);
    this.roster = CHAR_ORDER.concat(bossOk ? [BOSS_KEY] : []);
    const slots = CHAR_ORDER.concat([BOSS_KEY]);
    this.cards = slots.map((k, i) => {
      const cx = 94 + (i % 4) * 148, cy = 174 + Math.floor(i / 4) * 116;
      const locked = k === BOSS_KEY && !bossOk;
      const frame = this.add.rectangle(cx, cy, 138, 108, locked ? 0x101010 : 0x0c1a24, 0.92).setStrokeStyle(3, 0x3a7a8a);
      const face = this.add.image(cx, cy - 10, 'face_' + charStyle(k, 'suit')).setDisplaySize(82, 82);
      if (locked) face.setTint(0x101010);
      const name = T(this, cx, cy + 43, locked ? '？？？' : CHARACTERS[k].short, 19, locked ? '#666' : CHARACTERS[k].color).setOrigin(0.5);
      if (locked) T(this, cx, cy - 10, KF.mode === 'arcade' || KF.mode === 'story' ? '最終頭目' : '通關解鎖', 16, '#aaa').setOrigin(0.5);
      if (!locked) { const zone = this.add.zone(cx, cy, 138, 108).setInteractive({ useHandCursor: true }); zone.on('pointerup', () => this.tapCard(i)); }
      return { k, frame, face, name, cx, cy, locked };
    });
    this.n = this.roster.length;
    // detail panel
    this.add.rectangle(790, 286, 320, 456, 0x050c14, 0.82).setStrokeStyle(2, 0x3a7a8a);
    this.big = this.add.image(790, 300, 'kowloon_idle').setOrigin(0.5, 1);
    this.dName = T(this, 790, 82, '', 23, '#ffd84a', { wordWrap: { width: 292, useAdvancedWrap: true }, align: 'center' }).setOrigin(0.5);
    this.dBlurb = T(this, 790, 136, '', 17, '#e0f0ff', { align: 'center', lineSpacing: 4, wordWrap: { width: 300, useAdvancedWrap: true } }).setOrigin(0.5);
    this.dMoves = T(this, 642, 318, '', 17, '#ffffff', { align: 'left', lineSpacing: 6, strokeThickness: 3, wordWrap: { width: 300, useAdvancedWrap: true } }).setOrigin(0, 0);
    this.formBtn = makeButton(this, 790, 466, 290, 40, '', () => this.toggleForm(this.lastMoved), { size: 18, depth: 60 });
    this.cursors = [{ idx: 0, done: false, color: 0xff4a4a, label: '1P', form: store('form1') || 'suit' }, { idx: 1, done: false, color: 0x4aa0ff, label: '2P', form: 'suit' }];
    this.cursorGfx = this.cursors.map(c => ({ rect: this.add.rectangle(0, 0, 144, 114).setStrokeStyle(6, c.color).setDepth(5),
      tag: T(this, 0, 0, c.label, 20, c.color === 0xff4a4a ? '#ff8a8a' : '#8ac8ff').setOrigin(0.5).setDepth(6) }));
    this.step = 0; this.tappedOnce = null;
    this.okBtn = makeButton(this, 430, 510, 200, 50, '決定', () => this.confirmTouch(), { size: 26 });
    makeButton(this, 160, 510, 160, 50, '返回', () => this.back(), { size: 22 });
    makeButton(this, 600, 510, 120, 50, '隨機', () => this.random(), { size: 22 });
    T(this, 312, 100, '點兩下 / 拳 決定　阿飛：U 或「換裝」掣切換服裝', 15, '#c8d8e0').setOrigin(0.5);
    this.lastMoved = 0;
    if (KF.mode !== 'vs') { this.cursorGfx[1].rect.setVisible(false); this.cursorGfx[1].tag.setVisible(false); }
    this.cursors[0].idx = Math.max(0, this.roster.indexOf(KF.p1));
    this.refresh();
    Music.play('versus');
    window.__KF = window.__KF || {}; window.__KF.select = this;
  }
  activeSide() { if (KF.mode === 'vs') return this.cursors[0].done ? 1 : 0; return this.step; }
  tapCard(i) {
    if (this.__leaving || i >= this.n) return;
    const s = this.activeSide(), c = this.cursors[s];
    if (c.done) return;
    if (c.idx === i && this.tappedOnce === i) { this.confirm(s); return; }
    c.idx = i; this.tappedOnce = i; this.lastMoved = s; SFX.announce('select'); this.refresh();
  }
  toggleForm(s) {
    const c = this.cursors[s]; if (c.done) return;
    const k = this.roster[c.idx]; if (!CHARACTERS[k].forms) return;
    c.form = c.form === 'suit' ? 'vest' : 'suit'; SFX.announce('select');
    this.lastMoved = s; this.refresh();
  }
  confirmTouch() { this.confirm(this.activeSide()); }
  random() { const s = this.activeSide(); this.cursors[s].idx = Math.floor(Math.random() * CHAR_ORDER.length); this.cursors[s].form = Math.random() < 0.5 ? 'suit' : 'vest'; this.lastMoved = s; this.refresh(); this.confirm(s); }
  back() {
    if (this.__leaving) return;
    if (KF.mode !== 'vs' && this.step === 1) { this.step = 0; this.cursors[0].done = false; this.cursorGfx[1].rect.setVisible(false); this.cursorGfx[1].tag.setVisible(false); this.refresh(); return; }
    if (KF.mode === 'vs' && (this.cursors[0].done || this.cursors[1].done)) { this.cursors.forEach(c => c.done = false); this.refresh(); return; }
    UI.fadeTo(this, 'Title', {});
  }
  confirm(s) {
    if (this.__leaving) return;
    const c = this.cursors[s]; if (c.done) return;
    c.done = true; this.tappedOnce = null; SFX.announce('ok');
    const card = this.cards[c.idx];
    this.tweens.add({ targets: card.face, scaleX: card.face.scaleX * 1.12, scaleY: card.face.scaleY * 1.12, duration: 90, yoyo: true });
    if (KF.mode === 'vs') { if (this.cursors[0].done && this.cursors[1].done) this.start(); else { this.lastMoved = 1; this.refresh(); } return; }
    if (KF.mode === 'arcade' || KF.mode === 'story') return this.start();
    if (this.step === 0) {
      this.step = 1; const o = this.cursors[1]; o.done = false; o.idx = (c.idx + 1) % this.n;
      this.cursorGfx[1].rect.setVisible(true); this.cursorGfx[1].tag.setVisible(true).setText(KF.mode === 'watch' ? 'CPU2' : 'CPU');
      this.header.setText(KF.mode === 'watch' ? '選擇 CPU 2' : '選擇對手'); this.lastMoved = 1; this.refresh(); return;
    }
    this.start();
  }
  start() {
    this.__menuLock = true;
    const c0 = this.cursors[0], c1 = this.cursors[1];
    KF.p1 = this.roster[c0.idx]; KF.p1form = CHARACTERS[KF.p1].forms ? c0.form : null;
    if (KF.p1form) store('form1', KF.p1form);
    if (KF.mode === 'arcade' || KF.mode === 'story') {
      this.time.delayedCall(350, () => Flow.start(this, KF.mode));
      return;
    }
    KF.p2 = this.roster[c1.idx]; KF.p2form = CHARACTERS[KF.p2].forms ? c1.form : null;
    KF.stage = KF.p2 === BOSS_KEY ? 'roof' : STAGE_ORDER[Math.floor(Math.random() * STAGE_ORDER.length)];
    this.time.delayedCall(350, () => UI.fadeTo(this, 'Vs', {}));
  }
  move(s, dx, dy) {
    const c = this.cursors[s]; if (c.done) return;
    let col = c.idx % 4, row = Math.floor(c.idx / 4);
    for (let tries = 0; tries < 12; tries++) {
      col = (col + dx + 4) % 4; row = (row + dy + 3) % 3;
      if (row * 4 + col < this.n) break;
      if (dy) { row = 0; break; }
    }
    c.idx = Math.min(this.n - 1, row * 4 + col); this.lastMoved = s; this.tappedOnce = null; SFX.announce('select'); this.refresh();
  }
  refresh() {
    this.cursors.forEach((c, s) => {
      if (s === 1 && KF.mode !== 'vs' && this.step !== 1) return;
      const card = this.cards[c.idx], g = this.cursorGfx[s];
      g.rect.setPosition(card.cx, card.cy).setStrokeStyle(c.done ? 8 : 5, c.done ? 0xffffff : c.color);
      g.tag.setPosition(card.cx + (s ? 40 : -40), card.cy - 48);
      const k = this.roster[c.idx];
      card.face.setTexture('face_' + charStyle(k, c.form)).setDisplaySize(82, 82);
    });
    if (KF.mode !== 'vs') this.cursorGfx[0].tag.setText(KF.mode === 'watch' ? 'CPU1' : '1P');
    const c = this.cursors[this.lastMoved], k = this.roster[c.idx], ch = CHARACTERS[k];
    const style = charStyle(k, c.form), m = SPRITE_META[style] || {};
    this.big.setTexture(`${style}_idle`).setOrigin((m.cx || 140) / (m.w || 280), (m.feet || 280) / (m.h || 290)).setScale(0.5 * ch.cm / 172 * 238 / (m.bodyH || 255)).setPosition(790, 312);
    this.dName.setText(ch.name);
    this.dBlurb.setText(ch.blurb);
    const sp = charSpecials(k, c.form);
    this.dMoves.setText(`必殺1　${sp.s1.name}\n必殺2　${sp.s2.name}\n必殺3　${sp.s3.name}\n超必殺　${sp.sp.name}`);
    this.formBtn.setVisible(!!ch.forms);
    if (ch.forms) this.formBtn.txt.setText(`換裝：${c.form === 'vest' ? '白背心' : '西裝'}　⇄`);
    this.okBtn.txt.setText(this.activeSide() === 1 && KF.mode !== 'arcade' ? (KF.mode === 'vs' ? '2P 決定' : '決定對手') : '決定');
  }
  update() {
    if (this.__leaving || this.__menuLock) return;
    const twoP = KF.mode === 'vs';
    const sets = [
      { l: ['KeyA'].concat(twoP ? [] : ['ArrowLeft']), r: ['KeyD'].concat(twoP ? [] : ['ArrowRight']), u: ['KeyW'].concat(twoP ? [] : ['ArrowUp']), d: ['KeyS'].concat(twoP ? [] : ['ArrowDown']),
        ok: ['KeyJ', 'Space'].concat(twoP ? [] : ['Enter', 'NumpadEnter']), back: ['KeyK', 'Escape'], form: ['KeyU', 'Tab'] },
      { l: ['ArrowLeft'], r: ['ArrowRight'], u: ['ArrowUp'], d: ['ArrowDown'], ok: ['Numpad1', 'Comma', 'Enter', 'NumpadEnter'], back: ['Numpad2', 'Period', 'Backspace'], form: ['Numpad4', 'Semicolon'] },
    ];
    const nSides = twoP ? 2 : 1;
    for (let i = 0; i < nSides; i++) {
      const s = twoP ? i : this.activeSide(), ks = sets[i], pad = Input.pad[i] || {};
      const e = (k, pk) => { const v = Input.consume(ks[k]) || (pad[pk + '_e'] && !(pad[pk + '_e'] = false)); return v; };
      if (e('l', 'l')) this.move(s, -1, 0);
      if (e('r', 'r')) this.move(s, 1, 0);
      if (e('u', 'u')) this.move(s, 0, -1);
      if (e('d', 'd')) this.move(s, 0, 1);
      if (e('form', 's1')) this.toggleForm(s);
      if (e('ok', 'lp')) this.confirm(s);
      if (e('back', 'lk')) this.back();
    }
  }
}
