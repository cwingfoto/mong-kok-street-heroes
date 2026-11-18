// EndingScene — per-character bittersweet ending (3 panels) + the boss's epilogue + cast
// curtain call at 芳姐's 糖水舖. Tap / 拳 to advance; auto-advances so it never stalls.
class EndingScene extends Phaser.Scene {
  constructor() { super('Ending'); }
  create() {
    UI.sceneInit(this);
    const p = KF.p1;
    const fl = KF.flow;
    store('bossUnlocked', '1');
    store('cleared-' + p, '1');
    this.panels = [];
    for (const e of Story.ending(p)) this.panels.push({ bg: e.bg, text: e.t, who: CHARACTERS[p].name, hero: true });
    const b = STORY.chars.boss.ending;
    this.panels.push({ bg: b[0].bg, text: b[0].t, who: CHARACTERS.boss.name, boss: true });
    this.panels.push({ bg: b[2].bg, text: b[2].t, who: CHARACTERS.boss.name, boss: true });
    const stats = fl ? `\n${fl.mode === 'story' ? '純故事模式' : '街機模式'}・難度 ${DIFFICULTY[KF.diff].name}` +
      (fl.mode === 'arcade' ? `　分數 ${fl.score}　接關 ${fl.continues} 次` : `　勝 ${fl.wins}・略過 ${fl.skipped}`) : '';
    this.panels.push({ final: true, text: `${GAME.title}\n${CHARACTERS[p].name} 篇 —— 完${stats}\n\n十一個人，冇一個係壞人。\n念念不忘、必有迴響。` });
    this.idx = -1; this.objs = [];
    Music.play('ending');
    this.input.on('pointerdown', () => this.advance());
    window.__KF = window.__KF || {}; window.__KF.ending = this;
    KF.endings = KF.endings || []; KF.endings.push({ p, form: KF.p1form, mode: fl && fl.mode, diff: KF.diff, continues: fl ? fl.continues : 0, bonus: fl ? fl.bonus : [] });
    this.events.once('shutdown', () => { if (window.__KF.ending === this) window.__KF.ending = null; });
    this.advance(true);
  }
  advance(force) {
    if (this.__leaving) return;
    if (!force && this.time.now - (this.shownAt || 0) < 400) return;
    this.idx++;
    if (this.idx >= this.panels.length) { KF.flow = null; UI.fadeTo(this, 'Title', { attract: true }); return; }
    this.objs.forEach(o => o.destroy()); this.objs = [];
    const add = o => { this.objs.push(o); return o; };
    const pn = this.panels[this.idx];
    add(this.add.image(VIEW_W / 2, VIEW_H / 2, pn.bg || 'bg_eatery').setDisplaySize(VIEW_W * 1.05, VIEW_H * 1.05).setTint(pn.final ? 0x606870 : 0xa8b8b0));
    if (pn.hero) {
      const style = charStyle(KF.p1, KF.p1form), m = SPRITE_META[style] || {};
      const pose = this.idx === 2 ? 'win' : 'idle';
      add(this.add.image(250, 420, style + '_' + pose).setOrigin((m.cx || 140) / (m.w || 280), (m.feet || 280) / (m.h || 290)).setScale(0.85 * CHARACTERS[KF.p1].cm / 172 * 238 / (m.bodyH || 255)));
    }
    if (pn.boss) add(this.add.image(VIEW_W / 2, 220, 'fx_dragon').setScale(1.4).setBlendMode(Phaser.BlendModes.ADD).setAlpha(this.idx === this.panels.length - 2 ? 0.35 : 0.8));
    if (pn.final) {
      // curtain call: everybody at the 糖水舖
      CHAR_ORDER.forEach((k, i) => {
        const st = charStyle(k, k === KF.p1 ? KF.p1form : 'vest'), m = SPRITE_META[st] || {};
        const img = add(this.add.image(44 + i * (872 / Math.max(1, CHAR_ORDER.length - 1)), 520, st + '_win').setOrigin((m.cx || 140) / (m.w || 280), (m.feet || 280) / (m.h || 290)));
        img.setScale(0.42 * CHARACTERS[k].cm / 172 * 238 / (m.bodyH || 255)).setFlipX(i >= 5).setAlpha(0);
        this.tweens.add({ targets: img, alpha: 1, duration: 400, delay: i * 120 });
      });
      add(this.add.image(VIEW_W - 60, 250, 'nana_smile').setOrigin(0.5, 1).setScale(0.8));
      add(this.add.text(VIEW_W / 2, 70, GAME.title, { fontFamily: FONT_TC, fontSize: '54px', fontStyle: 'bold', color: '#ffe8f4', stroke: '#ff2a80', strokeThickness: 5,
        shadow: { offsetX: 0, offsetY: 0, color: '#ff2a80', blur: 20, fill: true, stroke: true } }).setOrigin(0.5));
      add(T(this, VIEW_W / 2, 210, pn.text, 24, '#ffffff', { lineSpacing: 8 }).setOrigin(0.5));
      this.fireworks();
    } else {
      add(this.add.rectangle(VIEW_W / 2, 455, VIEW_W - 40, 140, 0x000000, 0.75).setStrokeStyle(2, 0x40ffd0));
      add(T(this, 50, 400, pn.who, 22, '#ffd84a').setOrigin(0, 0.5));
      add(T(this, 50, 420, pn.text, 22, '#ffffff', { align: 'left', lineSpacing: 6, wordWrap: { width: VIEW_W - 100, useAdvancedWrap: true } }).setOrigin(0, 0));
    }
    const lb = Mood.letterbox(this, 34, 80); lb.forEach(add);
    add(T(this, VIEW_W - 20, 10, `${this.idx + 1}/${this.panels.length}  點擊繼續 ▶`, 16, '#aab4c8').setOrigin(1, 0).setDepth(90));
    this.shownAt = this.time.now;
    if (this.autoEv) this.autoEv.remove(false);
    const sp = Math.max(1, DEBUG.speed);
    this.autoEv = this.time.delayedCall((pn.final ? 11000 : 8000) / sp, () => this.advance(true));
  }
  fireworks() {
    for (let i = 0; i < 6; i++) {
      const x = 120 + Math.random() * 720, y = 80 + Math.random() * 160;
      const s = this.add.image(x, y, 'spark').setScale(0).setTint([0xff4ab0, 0x40ffd0, 0xffe14a][i % 3]).setBlendMode(Phaser.BlendModes.ADD);
      this.objs.push(s);
      this.tweens.add({ targets: s, scale: 5, alpha: 0, duration: 900, delay: i * 350, repeat: 3, repeatDelay: 700 });
    }
    SFX.clear();
  }
  update(time) {
    if (Input.menu('ok')) this.advance();
    if (window.__KF_AUTO && time - this.shownAt > 250) this.advance(true);
  }
}
