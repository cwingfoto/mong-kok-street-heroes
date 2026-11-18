// TitleScene — two phases:
//   1) ATTRACT: big neon logo, original large portrait ensemble and illustrated Mong Kok landmarks, rain,
//      a passing tram and minibus light streaks, moody ballad, blinking 「PRESS ANY BUTTON・按任意鍵開始」.
//      ANY key, mouse click, screen tap or gamepad button → 2)
//   2) MAIN MENU: neon-plaque mode menu (+ 難度 / 操作說明), selected-mode description. Esc / 返回 → attract.
// Coming back from other scenes opens the menu directly; endings / game over return to the attract screen.
const TAGLINE = '燈會熄，人會老；\n但係今晚，我哋仲企喺度。';
const MODE_INFO = [
  ['街機模式', 'ARCADE', '1P vs CPU', '連戰七人・三個獎勵關・天台決戰霓虹龍', 0xff4ab0, () => 'arcade'],
  ['純故事模式', 'STORY', '睇故事', '每個對手一局・可自動觀看／親自打／略過', 0x40ffd0, () => 'story'],
  ['雙人對戰', 'VERSUS', '1P vs 2P', '同一部電腦或兩個手掣，兄弟對決', 0xffd84a, () => 'vs'],
  ['自由對戰', 'FREE BATTLE', '揀對手', '自己揀對手同場景', 0x7ab8ff, () => 'free'],
  ['觀戰模式', 'WATCH', 'CPU vs CPU', '泡杯茶，睇兩個旺角人過招', 0xc8a0ff, () => 'watch'],
];
class TitleScene extends Phaser.Scene {
  constructor() { super('Title'); }
  create(data) {
    UI.sceneInit(this);
    Input.twoP = false; KF.flow = null;
    this.f = 0; this.helpItems = null; this.menuObjs = []; this.menu = null; this.menuAt = 0; this.padPrev = null;
    this.phase = (data && data.attract) || !KF.titleSeen ? 'attract' : 'menu';
    if (DEBUG && DEBUG.menu) this.phase = 'menu';
    // v2 original large portrait ensemble + hand-drawn landmark montage. No sprite upscaling.
    this.add.image(VIEW_W / 2, VIEW_H / 2, 'title_bg').setDisplaySize(VIEW_W, VIEW_H);
    this.dragon = this.add.image(480, 220, 'fx_dragon').setVisible(false);
    this.tubes = []; this.signs = []; this.cast = [];
    this.tram = this.add.container(-600, 318).setVisible(false); this.tramT = 200;
    this.streaks = [];
    for (let i = 0; i < 3; i++) {
      const red = i % 2 === 0;
      const s = this.add.image(-300, 0, 'streak').setDepth(13).setBlendMode(Phaser.BlendModes.ADD).setTint(red ? 0xff3a83 : 0x65f0d9).setScale(2.4, 0.9);
      this.streaks.push({ s, red, t: i * 90 });
    }
    Mood.add(this, { rain: true, neon: true, depth: 40, grainA: 0.12, vigA: 0.15 });
    // ---- logo
    const logoStyle = (c, st, blur) => ({ fontFamily: FONT_TC, fontSize: '64px', fontStyle: 'bold', color: c, stroke: st, strokeThickness: 7, padding: { x: 48, y: 40 },
      shadow: { offsetX: 0, offsetY: 0, color: st, blur, fill: true, stroke: true } });
    this.logoGhost = this.add.text(VIEW_W / 2 + 4, 65, GAME.title, logoStyle('#30f0ff', '#0090a0', 10)).setOrigin(0.5).setDepth(49).setAlpha(0.45);
    this.logo = this.add.text(VIEW_W / 2, 62, GAME.title, logoStyle('#fff4fa', '#ff2a80', 30)).setOrigin(0.5).setDepth(50);
    this.underline = this.add.rectangle(VIEW_W / 2, 100, 560, 3, 0xff4ab0, 0.9).setDepth(50);
    this.underGlow = this.add.rectangle(VIEW_W / 2, 100, 600, 12, 0xff4ab0, 0.18).setDepth(49);
    this.en = this.add.text(VIEW_W / 2, 18, GAME.titleEn.split('').join(' '), { fontFamily: FONT_BIG, fontSize: '20px', color: '#c8fff0', stroke: '#004030', strokeThickness: 2,
      shadow: { offsetX: 0, offsetY: 0, color: '#40ffd0', blur: 12, fill: true } }).setOrigin(0.5).setDepth(50);
    this.tag = this.add.text(VIEW_W / 2, 117, '念念不忘、必有迴響', { fontFamily: FONT_TC, fontSize: '18px', color: '#f0e6d0', align: 'center', lineSpacing: 6,
      shadow: { offsetX: 0, offsetY: 0, color: '#000000', blur: 8, fill: true } }).setOrigin(0.5).setDepth(50);
    this.press = this.add.text(VIEW_W / 2, 392, 'PRESS ANY BUTTON\n按任意鍵開始', { fontFamily: FONT_BIG, fontSize: '22px', color: '#ffe14a', align: 'center', stroke: '#402000', strokeThickness: 4,
      shadow: { offsetX: 0, offsetY: 0, color: '#ff9a20', blur: 16, fill: true } }).setOrigin(0.5).setDepth(51);
    this.pressBand = this.add.rectangle(VIEW_W / 2, 392, 480, 66, 0x000000, 0.82).setDepth(50);
    this.credit = T(this, VIEW_W / 2, VIEW_H - 12, GAME.version + '　・　' + GAME.subtitle + '　・　十一個旺角人，冇反派' + (bossUnlocked() ? '　・　霓虹龍已解鎖' : ''), 14, '#b8c4d8').setOrigin(0.5).setDepth(60);
    UI.topButtons(this);
    Music.play('attract');
    // ---- any-input listeners (attract → menu)
    this.onKey = (e) => { if (this.phase === 'attract' && !this.__leaving && !e.repeat) { this.anyInput('key:' + e.code); } };
    window.addEventListener('keydown', this.onKey);
    this.events.once('shutdown', () => window.removeEventListener('keydown', this.onKey));
    this.input.on('pointerdown', (ptr) => {
      SFX.unlock();
      if (this.phase !== 'attract') return;
      if (ptr.x > VIEW_W - 160 && ptr.y < 100) return;          // 全螢幕 / 靜音 buttons
      this.anyInput('pointer');
    });
    window.__KF = window.__KF || {}; window.__KF.title = this;
    this.events.once('shutdown', () => { if (window.__KF.title === this) window.__KF.title = null; });
    if (this.phase === 'menu') this.showMenu(true);
    else this.introAnim();
  }
  introAnim() {
    this.logo.setAlpha(0).setScale(1.25); this.logoGhost.setAlpha(0); this.tag.setAlpha(0); this.underline.setScale(0, 1); this.pressBand.setAlpha(0); this.tweens.add({ targets: this.pressBand, alpha: 0.82, duration: 600, delay: 1500 });
    this.tweens.add({ targets: [this.underline, this.underGlow], scaleX: 1, duration: 900, delay: 700, ease: 'Cubic.out' }); this.press.setAlpha(0); this.en.setAlpha(0);
    this.tweens.add({ targets: this.logo, alpha: 1, scale: 1, duration: 900, ease: 'Cubic.out', onComplete: () => { this.cameras.main.flash(180, 255, 120, 200); } });
    this.tweens.add({ targets: this.logoGhost, alpha: 0.45, duration: 900, delay: 300 });
    this.tweens.add({ targets: this.en, alpha: 1, duration: 700, delay: 600 });
    this.tweens.add({ targets: this.tag, alpha: 1, duration: 1600, delay: 1100 });
    this.press.setData('show', 1); this.introUntil = 70;
  }
  anyInput(src) {
    if (this.phase !== 'attract') return;
    this.lastInput = src;
    SFX.unlock(); SFX.announce('ok');
    KF.titleSeen = true;
    this.cameras.main.flash(220, 255, 230, 240);
    this.showMenu(false);
  }
  // ------------------------------------------------------------ main menu
  showMenu(instant) {
    this.phase = 'menu'; this.menuAt = this.time.now; KF.titleSeen = true; this.introUntil = 0;
    Input.clearEdges();
    const d = instant ? 0 : 450;
    this.tweens.killTweensOf([this.logo, this.logoGhost, this.tag, this.press, this.en, this.underline, this.underGlow]);
    this.press.setVisible(false); this.pressBand.setVisible(false);
    this.tweens.add({ targets: this.logo, y: 54, scale: 0.82, alpha: 1, duration: d, ease: 'Cubic.out' });
    this.tweens.add({ targets: this.logoGhost, y: 56, x: VIEW_W / 2 + 3, scale: 0.82, alpha: 0.4, duration: d, ease: 'Cubic.out' });
    this.tweens.add({ targets: this.en, y: 18, alpha: 0.9, scale: 0.8, duration: d });
    this.tweens.add({ targets: [this.tag, this.underline, this.underGlow], alpha: 0, duration: Math.min(d, 250) });
    this.cast.forEach(c => c.grp.forEach(o => this.tweens.add({ targets: o, alpha: o.alpha * 0.55, duration: d })));
    const D = 55, objs = this.menuObjs;
    objs.push(this.add.rectangle(VIEW_W / 2, 282, 540, 400, 0x040810, 0.91).setStrokeStyle(2, 0x1c3a4a).setDepth(D - 1));
    const plaque = (x, y, w, h, label, sub, sub2, color, cb) => {
      const bg = this.add.rectangle(0, 0, w, h, 0x07101c, 0.85).setStrokeStyle(2, 0x2a4a5a);
      const bar = this.add.rectangle(-w / 2 + 6, 0, 6, h - 12, color, 1);
      const arrow = this.add.text(-w / 2 + 26, 0, '▶', { fontFamily: FONT_TC, fontSize: '18px', color: '#ffffff' }).setOrigin(0.5);
      const small = !sub2 && w < 300;
      const txt = this.add.text(small ? 6 : -w / 2 + 46, 0, label, { fontFamily: FONT_TC, fontSize: small ? '22px' : '26px', fontStyle: 'bold', color: '#a8c0cc' }).setOrigin(small ? 0.5 : 0, 0.5);
      const subT = this.add.text(w / 2 - 14, -8, small ? '' : sub, { fontFamily: FONT_BIG, fontSize: '14px', color: '#6a8494' }).setOrigin(1, 0.5);
      const subT2 = this.add.text(w / 2 - 14, 10, sub2, { fontFamily: FONT_TC, fontSize: '14px', color: '#6a8494' }).setOrigin(1, 0.5);
      const c = this.add.container(x, y, [bg, bar, arrow, txt, subT, subT2]).setSize(w, h).setDepth(D);
      c.setInteractive({ useHandCursor: true });
      Object.assign(c, { bg, txt, bar, arrow, subT, subT2, cb, color });
      c.on('pointerup', () => { if (this.time.now - this.menuAt < 350 || this.helpItems || this.__menuLock) return; SFX.unlock(); SFX.announce('ok'); cb(); });
      c.on('pointerover', () => { if (c.menu) c.menu.select(c.menuIndex, true); });
      objs.push(c); return c;
    };
    const btns = MODE_INFO.map(([zh, en, vs, desc, color, mode], i) => plaque(VIEW_W / 2, 132 + i * 56, 480, 48, zh, en, vs, color, () => this.go(mode())));
    this.diffBtn = plaque(VIEW_W / 2 - 122, 422, 236, 44, '', 'DIFFICULTY', '', 0xff7a3a, () => this.cycleDiff());
    const help = plaque(VIEW_W / 2 + 122, 422, 236, 44, '操作說明', 'HOW TO PLAY', '', 0x9ad0ff, () => this.showHelp());
    btns.push(this.diffBtn, help);
    this.desc = this.add.text(VIEW_W / 2, 470, '', { fontFamily: FONT_TC, fontSize: '18px', color: '#f0e6d0', shadow: { offsetX: 0, offsetY: 0, color: '#000', blur: 6, fill: true } }).setOrigin(0.5).setDepth(D);
    this.hintT = T(this, VIEW_W / 2, 498, '↑↓ 揀　Enter / J / 點擊 = 決定　Esc = 返回標題', 14, '#8aa0b0').setOrigin(0.5).setDepth(D);
    objs.push(this.desc, this.hintT);
    const style = (b, on) => {
      b.bg.setStrokeStyle(on ? 3 : 2, on ? b.color : 0x2a4a5a); b.bg.setFillStyle(on ? 0x1a0a20 : 0x07101c, on ? 0.92 : 0.85);
      b.txt.setColor(on ? '#ffffff' : '#a8c0cc'); b.txt.setShadow(0, 0, on ? '#' + b.color.toString(16).padStart(6, '0') : '#000000', on ? 14 : 0, true, true);
      b.arrow.setVisible(on); b.subT.setColor(on ? '#e0f0ff' : '#6a8494'); b.subT2.setColor(on ? '#e0f0ff' : '#6a8494');
      b.setScale(on ? 1.04 : 1); b.bar.setAlpha(on ? 1 : 0.5);
    };
    const descs = MODE_INFO.map(m => m[3]).concat(['簡單／普通／困難 ・ 會影響最終頭目霓虹龍嘅體力同攻擊', '鍵盤・手掣・手機觸控 操作一覽']);
    this.menu = new Menu(this, btns, { style, onSelect: i => this.desc && this.desc.setText(descs[i] || '') });
    this.menu.select(this.menu.idx, true);
    this.refreshDiff();
    if (!instant) objs.forEach((o, i) => { const a = o.alpha; o.setAlpha(0); this.tweens.add({ targets: o, alpha: a, duration: 260, delay: 120 + i * 30 }); });
  }
  hideMenu() {
    if (this.phase !== 'menu' || this.helpItems) return;
    this.menuObjs.forEach(o => o.destroy()); this.menuObjs = []; this.menu = null; this.desc = null;
    this.phase = 'attract';
    this.tweens.killTweensOf([this.logo, this.logoGhost, this.tag, this.en, this.underline, this.underGlow]);
    this.logo.setPosition(VIEW_W / 2, 62).setScale(1); this.logoGhost.setPosition(VIEW_W / 2 + 4, 65).setScale(1).setAlpha(0.45);
    this.en.setPosition(VIEW_W / 2, 18).setScale(1).setAlpha(1); this.tag.setAlpha(1); this.underline.setAlpha(0.9); this.underGlow.setAlpha(0.18); this.press.setVisible(true); this.pressBand.setVisible(true).setAlpha(0.82);
    this.cast.forEach(c => { c.grp[0].setAlpha(0.85); c.grp[1].setAlpha(0.7); c.grp[2].setAlpha(1); });
    Input.clearEdges();
  }
  cycleDiff() {
    const ks = Object.keys(DIFFICULTY); KF.diff = ks[(ks.indexOf(KF.diff) + 1) % ks.length];
    store('diff', KF.diff);
    this.refreshDiff();
  }
  refreshDiff() { if (this.diffBtn) this.diffBtn.txt.setText('難度：' + DIFFICULTY[KF.diff].name); }
  go(mode) {
    if (this.helpItems || this.__leaving) return;
    KF.mode = mode; KF.continues = 0;
    Input.twoP = mode === 'vs';
    UI.fadeTo(this, 'Select', {});
  }
  showHelp() {
    if (this.helpItems) return;
    if (this.phase !== 'menu') this.showMenu(true);
    const lines = [
      '【鍵盤 1P】 移動 W A S D（或方向鍵）・ 上 = 跳 ・ 下 = 蹲 ・ 向後 = 防禦',
      '拳 J　腳 K　必殺1 U　必殺2 I　必殺3 O　超必殺 L（要 2 格氣）',
      '【鍵盤 2P】 方向鍵 ・ 拳 , 　腳 . 　必殺 ; \' ]　超必殺 /（或數字鍵盤）',
      '【手機】 左邊搖桿移動／跳／蹲／防禦，右邊六粒掣 ・ 手掣都得',
      '必殺技唔使搓招，一粒掣就出！ 蹲低 + 腳 = 掃腿（要蹲防）・ 跳攻擊要企防',
      '新機制：墨池減速・抱摔（防唔到）・吸收／反彈飛行道具・暈眩・破防・秘技強化',
      '純故事模式：每個對手一局，可自動觀看、親自打或略過 ・ 故事畫面點擊繼續',
      'Esc / P / Enter = 暫停（暫停畫面有招式表）・ M = 音樂開關',
      '離線版：download/mk-fighter-play-offline-v2.zip（解壓後開 mk-fighter/index.html）',
    ];
    const items = [this.add.rectangle(VIEW_W / 2, VIEW_H / 2, 920, 490, 0x050c18, 0.97).setStrokeStyle(3, 0x40ffd0),
      T(this, VIEW_W / 2, 78, '操作說明', 34, '#ffd84a').setOrigin(0.5)];
    lines.forEach((l, i) => items.push(T(this, VIEW_W / 2, 122 + i * 36, l, 18, i % 2 ? '#e0f0ff' : '#ffffff').setOrigin(0.5)));
    items.push(T(this, VIEW_W / 2, 484, '（點擊或按任何掣關閉）', 18, '#aab4c8').setOrigin(0.5));
    items.forEach(o => o.setDepth(300));
    this.helpItems = items; this.helpAt = this.time.now;
    this.input.once('pointerup', () => this.closeHelp());
  }
  closeHelp() { if (!this.helpItems || this.time.now - this.helpAt < 200) { if (this.helpItems) this.input.once('pointerup', () => this.closeHelp()); return; } this.helpItems.forEach(o => o.destroy()); this.helpItems = null; Input.clearEdges(); }
  padAny() {
    let pads = [];
    try { pads = (navigator.getGamepads && Array.from(navigator.getGamepads()).filter(Boolean)) || []; } catch (e) { pads = []; }
    let any = false;
    for (const p of pads) for (const b of (p.buttons || [])) if (b && (b.pressed || b.value > 0.5)) any = true;
    const edge = any && this.padPrev === false;
    this.padPrev = any;
    return edge;
  }
  update(time) {
    this.f++;
    const f = this.f;
    // neon + tube flicker
    const fl = (f % 160 < 3 || f % 233 < 2);
    if (f > (this.introUntil || 0)) this.logo.setAlpha(fl ? 0.5 : 1);
    for (const t of this.tubes) {
      if (t.off > 0) t.off--; else if (Math.random() < 0.004) t.off = Phaser.Math.Between(3, 14);
      const on = t.off === 0 || (t.off % 3 === 0);
      t.tube.setAlpha(on ? 0.95 : 0.2); t.glow.setAlpha(on ? 0.12 : 0.02);
    }
    for (const s of this.signs) {
      if (s.off > 0) s.off--; else if (Math.random() < 0.003) s.off = Phaser.Math.Between(4, 30);
      s.t.setAlpha(s.off > 0 && (s.off % 4 < 2) ? 0.15 : s.base);
    }
    this.dragon.setAlpha(0.12 + 0.05 * Math.sin(f / 50));
    // tram + minibus streaks
    if (this.tramT > 0) this.tramT--; else { this.tram.x += 2.2; if (this.tram.x > VIEW_W + 300) { this.tram.x = -320; this.tramT = Phaser.Math.Between(300, 600); } }
    for (const s of this.streaks) {
      if (s.t > 0) { s.t--; s.s.setVisible(false); continue; }
      if (!s.s.visible) { s.s.setVisible(true); s.s.x = s.red ? VIEW_W + 320 : -320; s.s.y = Phaser.Math.Between(430, 520); s.s.setAlpha(Phaser.Math.FloatBetween(0.35, 0.8)); }
      s.s.x += s.red ? -16 : 20;
      if (s.s.x < -340 || s.s.x > VIEW_W + 340) { s.t = Phaser.Math.Between(40, 260); }
    }
    if (this.phase === 'attract') {
      if (this.press.getData('show')) this.press.setAlpha(this.f % 70 < 44 ? 1 : 0.15);
      if (this.padAny()) this.anyInput('gamepad');
      Input.clearEdges();
      return;
    }
    this.padAny();
    if (this.helpItems) { if (Input.menu('ok') || Input.menu('back')) this.closeHelp(); return; }
    if (time - this.menuAt < 200) { Input.clearEdges(); return; }
    if (Input.menu('back')) { this.hideMenu(); return; }
    if (this.menu) this.menu.update();
  }
}
