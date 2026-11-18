// ============================================================
// StoryScene — 2–4 line story beats before / after fights (portrait + text),
// tap / 拳 / Enter to advance, 「略過」 to skip. In 純故事模式 the pre-fight
// beat ends with a choice: watch the fight (auto) / play it / skip it.
// ============================================================
class StoryScene extends Phaser.Scene {
  constructor() { super('Story'); }
  create() {
    UI.sceneInit(this);
    this.dragon = null; this.choiceMenu = null; this.pick = null;
    const st = Flow.cur() || { t: 'story', kind: 'intro' };
    const p = KF.p1, o = st.o;
    this.step = st; this.p = p; this.o = o;
    this.form = KF.p1form;
    let lines, bg;
    if (st.kind === 'intro') { lines = [...STORY.opening, ...Story.intro(p)]; bg = 'bg_eatery'; }
    else if (st.kind === 'pre') { lines = Story.pre(p, o); bg = STAGES[Flow.stageFor(o)] ? STAGES[o === BOSS_KEY ? 'roof' : Flow.stageFor(o)].bg : 'bg_eatery'; }
    else { lines = Story.post(p, o, KF.flow ? KF.flow.lastWon : true); bg = o === BOSS_KEY ? 'stage_roof' : 'bg_eatery'; }
    this.lines = lines.filter(l => l && l.t);
    this.isBoss = o === BOSS_KEY;
    // ---- background (dim, teal-graded) ----
    this.bg = this.add.image(VIEW_W / 2, VIEW_H / 2, bg).setDisplaySize(VIEW_W * 1.08, VIEW_H * 1.08).setTint(0x8aa8a0);
    this.add.rectangle(VIEW_W / 2, VIEW_H / 2, VIEW_W, VIEW_H, 0x02060a, 0.35);
    if (this.isBoss && this.textures.exists('fx_dragon')) {
      this.dragon = this.add.image(VIEW_W / 2, 150, 'fx_dragon').setScale(1.3).setAlpha(0.55).setBlendMode(Phaser.BlendModes.ADD);
    }
    // ---- cast: player left, opponent right, 芳姐 centre ----
    this.cast = {};
    const full = (key, form, x, flip) => {
      const style = charStyle(key, form), m = SPRITE_META[style] || {};
      if (!this.textures.exists(style + '_idle')) return null;
      const img = this.add.image(x, 470, style + '_idle').setOrigin((m.cx || 140) / (m.w || 280), (m.feet || 280) / (m.h || 290));
      img.setScale(1.02 * CHARACTERS[key].cm / 172 * 238 / (m.bodyH || 255)).setFlipX(!!flip);
      img.baseX = x; return img;
    };
    this.cast[p] = full(p, this.form, 200, false);
    if (o) this.cast[o] = full(o, KF.p2form, 760, true);
    this.nana = this.add.image(480, 470, 'nana_idle').setOrigin(0.5, 1).setScale(0.95).setAlpha(0);
    this.mood = Mood.add(this, { rain: true, neon: true, depth: 60, grainA: 0.22 });
    Mood.letterbox(this, 40, 62);
    // location caption (neon style)
    const loc = st.kind === 'intro' ? '旺角・深夜糖水舖' : (this.isBoss ? STAGES.roof.name : (st.kind === 'pre' ? STAGES[Flow.stageFor(o)].name : '旺角・深夜糖水舖'));
    this.add.text(24, 58, loc, { fontFamily: FONT_TC, fontSize: '22px', color: '#9cf0ff', stroke: '#003040', strokeThickness: 4,
      shadow: { offsetX: 0, offsetY: 0, color: '#40ffd0', blur: 12, fill: true } }).setDepth(70);
    if (KF.flow) T(this, VIEW_W - 24, 58, KF.flow.mode === 'story' ? '純故事模式' : '街機模式', 18, '#ffd84a').setOrigin(1, 0).setDepth(70);
    // ---- text box ----
    const D = 70;
    this.add.rectangle(VIEW_W / 2, 446, VIEW_W - 40, 110, 0x000000, 0.72).setStrokeStyle(2, 0x40ffd0).setDepth(D);
    this.face = this.add.image(86, 446, 'face_nana').setDisplaySize(96, 96).setDepth(D + 1);
    this.faceFrame = this.add.rectangle(86, 446, 96, 96).setStrokeStyle(2, 0xffffff).setDepth(D + 1);
    this.nameTxt = T(this, 148, 402, '', 22, '#ffd84a').setOrigin(0, 0.5).setDepth(D + 1);
    this.body = T(this, 148, 420, '', 22, '#ffffff', { align: 'left', wordWrap: { width: 760, useAdvancedWrap: true }, lineSpacing: 6 }).setOrigin(0, 0).setDepth(D + 1);
    this.hint = T(this, VIEW_W - 32, 492, '▼', 18, '#40ffd0').setOrigin(1, 0.5).setDepth(D + 1);
    this.skipBtn = makeButton(this, VIEW_W - 90, 20, 150, 32, '略過 ▶▶', () => this.finish(), { size: 18, depth: 90 });
    this.skipBtn.bg.setStrokeStyle(2, 0x40ffd0);
    this.idx = -1; this.shown = 0; this.full = ''; this.choosing = false; this.done = false; this.f = 0;
    this.input.on('pointerdown', (ptr) => {
      SFX.unlock();
      if (this.choosing || this.done) return;
      if (ptr.y < 44 && ptr.x > VIEW_W - 180) return;          // the skip button handles itself
      this.advance();
    });
    T(this, 24, 91, '虛構合成人物・原創對白', 13, '#b5c8d2').setDepth(90);
    Music.play('neon');
    this.nextLine();
    window.__KF = window.__KF || {}; window.__KF.story = this;
    this.events.once('shutdown', () => { if (window.__KF.story === this) window.__KF.story = null; });
    this.startedAt = this.time.now;
  }
  nextLine() {
    this.idx++;
    if (this.idx >= this.lines.length) return this.finish();
    const l = this.lines[this.idx];
    const who = l.w;
    this.full = l.t; this.shown = 0; this.lineAt = this.f;
    this.body.setFontSize(22).setText(this.full);
    for (let size = 22; this.body.height > 76 && size > 17; size--) this.body.setFontSize(size - 1);
    this.body.setText('');
    let face = 'face_nana', name = NARRATOR.name + '（' + NARRATOR.title + '）';
    if (who !== 'nana' && CHARACTERS[who]) {
      const form = who === this.p ? this.form : KF.p2form;
      face = 'face_' + charStyle(who, form); name = CHARACTERS[who].name;
    }
    if (this.textures.exists(face)) this.face.setTexture(face).setDisplaySize(96, 96);
    this.nameTxt.setText(name).setFontSize(name.length > 13 ? 19 : 22);
    // highlight the speaker
    for (const [k, img] of Object.entries(this.cast)) if (img) img.setTint(k === who ? 0xffffff : 0x506070).setAlpha(k === who ? 1 : 0.8);
    const nanaOn = who === 'nana';
    const nk = 'nana_' + (l.pose || 'idle');
    if (nanaOn && this.textures.exists(nk)) this.nana.setTexture(nk);
    this.nana.setAlpha(nanaOn ? 1 : 0.0);
  }
  advance() {
    if (this.done || this.choosing) return;
    if (this.f - (this.lineAt || 0) < 6) return;         // debounce double taps
    if (this.shown < this.full.length) { this.shown = this.full.length; this.body.setText(this.full); return; }
    this.nextLine();
  }
  finish() {
    if (this.done || this.choosing) return;
    const st = this.step;
    if (KF.flow && KF.flow.mode === 'story' && st.kind === 'pre') return this.choice();
    this.done = true;
    Flow.next(this);
  }
  choice() {
    this.choosing = true;
    this.body.setText(this.full); this.shown = this.full.length;
    const D = 95;
    const items = [this.add.rectangle(VIEW_W / 2, VIEW_H / 2 - 30, 520, 250, 0x050a14, 0.94).setStrokeStyle(3, 0x40ffd0).setDepth(D),
      T(this, VIEW_W / 2, 150, '呢一場點樣打？', 28, '#ffd84a').setOrigin(0.5).setDepth(D)];
    const pick = (mode) => {
      if (this.done) return; this.done = true;
      if (mode === 'skip') { Flow.skipFight(this); return; }
      KF.storyFight = mode; store('storyFight', mode);
      Flow.next(this);
    };
    const btns = [
      makeButton(this, VIEW_W / 2, 205, 400, 50, '▶ 觀看對戰（自動）', () => pick('auto'), { size: 22, depth: D + 1 }),
      makeButton(this, VIEW_W / 2, 265, 400, 50, '🎮 親自打（一局）', () => pick('play'), { size: 22, depth: D + 1 }),
      makeButton(this, VIEW_W / 2, 325, 400, 50, '⏭ 略過呢場', () => pick('skip'), { size: 22, depth: D + 1 }),
    ];
    this.choiceMenu = new Menu(this, btns, { start: KF.storyFight === 'play' ? 1 : 0 });
    this.choiceItems = items;
    this.pick = pick;
  }
  update(time, delta) {
    this.f++;
    if (this.__leaving) return;
    if (this.dragon) { this.dragon.y = 150 + Math.sin(this.f / 40) * 10; this.dragon.setAlpha(0.4 + 0.2 * Math.sin(this.f / 13)); }
    // step-printed portraits: they only move every 3rd frame (Wong Kar-wai smear)
    if (this.f % 3 === 0) for (const img of Object.values(this.cast)) if (img) img.x = img.baseX + Math.sin(this.f / 50) * 6;
    if (this.choosing) {
      if (this.choiceMenu) this.choiceMenu.update();
      if (window.__KF_STORYCHOICE && this.pick && this.time.now - this.startedAt > 100) this.pick(window.__KF_STORYCHOICE);
      return;
    }
    if (this.shown < this.full.length) { this.shown = Math.min(this.full.length, this.shown + 1.2 * ((window.__KF && window.__KF.speed) || DEBUG.speed)); this.body.setText(this.full.slice(0, Math.floor(this.shown))); }
    this.hint.setAlpha(this.shown >= this.full.length && (this.f % 40 < 26) ? 1 : 0);
    if (Input.menu('ok') || Input.consume(['KeyK'])) this.advance();
    if (Input.consume(['Escape', 'Tab'])) this.finish();
    if (window.__KF_AUTO && this.f % 4 === 0) { this.lineAt = -99; this.advance(); }
  }
}
