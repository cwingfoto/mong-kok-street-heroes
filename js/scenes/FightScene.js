// ============================================================
// FightScene — one match (best of 3). Fixed-step 60 Hz logic in step();
// rendering in update(). Round flow: intro → fight → ko / timeup → roundEnd → …
// ============================================================
class FightScene extends Phaser.Scene {
  constructor() { super('Fight'); }

  create(data) {
    this.runId = window.__KF_FIGHT_RUN = (window.__KF_FIGHT_RUN || 0) + 1;
    UI.sceneInit(this);
    this.cameo = null; this.mood = null; this.matchOver = false; this.centerHideAt = 0; this.comboHideAt = null; this.koSettledAt = 0;
    this.stageKey = (data && data.stage) || KF.stage || 'street';
    if (!STAGES[this.stageKey]) this.stageKey = 'street';
    const st = STAGES[this.stageKey];
    this.story = KF.mode === 'story';
    this.roundsToWin = this.story ? 1 : ROUNDS_TO_WIN;
    this.frame = 0; this.acc = 0; this.tick = 0;
    this.hitstop = 0; this.superFreeze = 0; this.slowmo = 0; this.slowAcc = 0;
    this.shakeT = 0; this.shakeI = 0;
    this.projs = []; this.round = 1; this.phase = 'intro'; this.phaseF = 0;
    this.paused = false; this.matchOver = false; this.allowChipKO = true;
    this.fx = new FxSystem(this);
    this.buildStage(st);
    this.fighters = [new Fighter(this, KF.p1, 0, KF.p1form), new Fighter(this, KF.p2, 1, KF.p2form)];
    this.fighters.forEach(f => { f.form0 = f.form; });
    if (KF.p1 === KF.p2 && !['sage','mkgirl'].includes(KF.p1)) this.fighters[1].altTint = 0xb8c8ff;   // mirror match: 2P colour
    // controllers
    const cpu = (side, boost) => new CpuBrain(this.fighters[side], KF.diff, { boost });
    const boost = KF.mode === 'arcade' ? Math.min(3, Math.floor((KF.ladderIdx || 0) / 2)) : 0;
    this.ctrl = [null, null];
    if (KF.mode === 'watch') this.ctrl[0] = cpu(0, 0);
    if (window.__KF_AUTO) this.ctrl[0] = new CpuBrain(this.fighters[0], 'hard', { boost: 3 });
    if (KF.mode !== 'vs') this.ctrl[1] = cpu(1, boost);
    if (window.__KF_CHAOS) { this.ctrl = [new CpuBrain(this.fighters[0], 'hard', { chaos: true }), new CpuBrain(this.fighters[1], 'hard', { chaos: window.__KF_CHAOS === 2 })]; }
    if (KF.mode !== 'vs' && this.ctrl[1]) this.fighters[1].dmgTakenMul = 1;
    if (KF.mode !== 'vs' && KF.mode !== 'watch' && !window.__KF_AUTO) this.fighters[0].dmgTakenMul = DIFFICULTY[KF.diff].dmgTaken;
    if (this.story) {          // 純故事模式: one round; the story hero never falls in the cinematic (result doesn't matter anyway)
      this.autoStory = KF.storyFight !== 'play';
      if (this.autoStory) {
        this.ctrl[0] = new CpuBrain(this.fighters[0], 'hard', { boost: 2 });
        this.ctrl[1] = new CpuBrain(this.fighters[1], 'easy', {});
        this.fighters[0].dmgTakenMul = 0.5; this.fighters[0].noKO = true; this.fighters[1].dmgTakenMul = 1.3;
      }
    }
    if (window.__KF_CHAOS) { this.ctrl = [new CpuBrain(this.fighters[0], 'hard', { chaos: true }), new CpuBrain(this.fighters[1], 'hard', { chaos: window.__KF_CHAOS === 2 })]; }
    // boss AI scales with difficulty
    this.fighters.forEach((f, s) => { if (f.def.boss && this.ctrl[s] && !this.ctrl[s].chaos) this.ctrl[s].bossTune(BOSS_SCALE[KF.diff] || BOSS_SCALE.normal); });
    Input.twoP = KF.mode === 'vs';
    this.buildHud();
    this.buildTouch();
    this.buildPause();
    Music.play(this.fighters.some(f => f.def.boss) ? 'boss2' : st.music);
    this.startRound(true);
    // auto-pause when the page is hidden (phone lock / app switch)
    this.onHidden = () => { if (document.hidden && !this.paused && this.phase === 'fight' && KF.mode !== 'watch') this.setPaused(true); };
    document.addEventListener('visibilitychange', this.onHidden);
    this.events.once('shutdown', () => this.cleanup());
    window.__KF = window.__KF || {};
    window.__KF.scene = this;
    this.cameras.main.setBounds(0, 0, STAGE_W, VIEW_H);
    this.cameras.main.scrollX = (STAGE_W - VIEW_W) / 2;
  }

  cleanup() {
    document.removeEventListener('visibilitychange', this.onHidden);
    try { this.fx.clear(); } catch (e) { /* */ }
    for (const p of this.projs) p.die(true);
    this.projs = [];
    if (window.__KF && window.__KF.scene === this) window.__KF.scene = null;
    Input.touch.l = Input.touch.r = Input.touch.u = Input.touch.d = false;
  }

  // ------------------------------------------------------------ stage
  buildStage(st) {
    const key = st.bg, tex = this.textures.get(key).getSourceImage();
    const w = tex.width || 960, h = tex.height || 540;
    let img;
    if (w >= 1200) { img = this.add.image(0, VIEW_H, key).setOrigin(0, 1).setDisplaySize(STAGE_W, VIEW_H); }
    else {
      const s = 1.15; img = this.add.image(0, VIEW_H, key).setOrigin(0, 1).setScale(s * VIEW_W / w);
      img.setScrollFactor((w * s * VIEW_W / w - VIEW_W) / (STAGE_W - VIEW_W), 1);
    }
    img.setDepth(0);
    if (st.cameo && this.textures.exists(st.cameo + '_walk1')) {      // 龍記大隻佬 walks past in the background carrying a box
      const cm = this.add.image(-100, FLOOR_Y - 70, st.cameo + '_walk1').setOrigin(0.5, 1).setScale(0.38).setTint(0x8090a0).setAlpha(0.85).setDepth(0.5);
      const box = this.add.image(-100, FLOOR_Y - 170, 'it_cardboard').setScale(0.6).setTint(0x8090a0).setDepth(0.6);
      this.cameo = { cm, box, x: -100, key: st.cameo };
    }
    if (Q.get('nomood') !== '1') this.mood = Mood.add(this, { rain: st.rain, neon: st.neon, tube: st.tube, train: st.train, depth: 80, light: true, grainA: 0.22 });
    this.add.rectangle(STAGE_W / 2, FLOOR_Y + 22, STAGE_W, 76, 0x000000, 0.12).setDepth(1);
    this.dim = this.add.rectangle(VIEW_W / 2, VIEW_H / 2, VIEW_W, VIEW_H, 0x000010, 0).setScrollFactor(0).setDepth(8);
  }

  // ------------------------------------------------------------ HUD
  buildHud() {
    const D = 100, sf = o => o.setScrollFactor(0).setDepth(D);
    this.hud = {};
    const bar = (side) => {
      const left = side === 0, x0 = left ? 76 : VIEW_W - 76 - 360, ch = this.fighters[side].def;
      sf(this.add.rectangle(x0 - 3, 18, 366, 30, 0x000000, 0.7).setOrigin(0).setStrokeStyle(2, 0xffffff));
      const lag = sf(this.add.rectangle(left ? x0 : x0 + 360, 21, 360, 24, 0xd02020).setOrigin(left ? 0 : 1, 0));
      const hp = sf(this.add.rectangle(left ? x0 : x0 + 360, 21, 360, 24, 0xffd84a).setOrigin(left ? 0 : 1, 0));
      const face = sf(this.add.image(left ? 38 : VIEW_W - 38, 36, 'face_' + this.fighters[side].style).setDisplaySize(64, 64).setFlipX(!left));
      sf(this.add.rectangle(left ? 38 : VIEW_W - 38, 36, 64, 64).setStrokeStyle(2, 0xffffff));
      const name = sf(T(this, left ? x0 : x0 + 360, 52, ch.name, 22, '#ffffff').setOrigin(left ? 0 : 1, 0));
      const tag = sf(T(this, left ? x0 + 150 : x0 + 210, 54, this.sideLabel(side), 16, side ? '#8ac8ff' : '#ff9a9a').setOrigin(0.5, 0));
      const stars = [0, 1].slice(0, this.roundsToWin).map(i => sf(T(this, left ? x0 + 340 - i * 26 : x0 + 20 + i * 26, 54, '☆', 22, '#ffd84a').setOrigin(0.5, 0)));
      // meter (2 bars)
      const my = 86, mx = left ? 76 : VIEW_W - 76 - 220;
      sf(this.add.rectangle(mx - 2, my - 2, 224, 18, 0x000000, 0.7).setOrigin(0).setStrokeStyle(1, 0xffffff));
      const meter = sf(this.add.rectangle(left ? mx : mx + 220, my, 220, 14, 0x3ac8ff).setOrigin(left ? 0 : 1, 0).setScale(0, 1));
      sf(this.add.rectangle(mx + 110, my - 2, 2, 18, 0xffffff, 0.8).setOrigin(0.5, 0));
      const mtxt = sf(T(this, left ? mx + 230 : mx - 10, my - 6, '', 16, '#9cf0ff').setOrigin(left ? 0 : 1, 0));
      return { hp, lag, stars, name, meter, mtxt, lagW: 360, face };
    };
    this.hud.bars = [bar(0), bar(1)];
    sf(this.add.rectangle(VIEW_W / 2, 38, 76, 58, 0x000000, 0.7).setStrokeStyle(2, 0xffd84a));
    this.hud.timer = sf(T(this, VIEW_W / 2, 38, '99', 40, '#ffd84a', { fontFamily: FONT_BIG }).setOrigin(0.5));
    this.hud.combo = [0, 1].map(s => sf(T(this, s ? VIEW_W - 120 : 120, 170, '', 30, '#ffe14a', { fontFamily: FONT_BIG, fontStyle: 'italic' }).setOrigin(0.5).setAlpha(0)));
    this.hud.banner = [null, null];
    this.hud.center = sf(gradText(this, VIEW_W / 2, 230, '', 84).setDepth(D + 5).setAlpha(0));
    this.hud.center2 = sf(T(this, VIEW_W / 2, 310, '', 28, '#ffffff').setOrigin(0.5).setDepth(D + 5).setAlpha(0));
    // pause button
    const pb = makeButton(this, VIEW_W / 2, 92, 64, 34, 'II', () => this.setPaused(!this.paused), { size: 20, depth: D + 2, scrollFactor: 0 });
    this.pauseBtn = pb;
  }
  onFormChange(f) { try { this.hud.bars[f.side].face.setTexture('face_' + f.style).setDisplaySize(64, 64); } catch (e) { /* */ } }
  sideLabel(side) {
    if (KF.mode === 'vs') return side ? '2P' : '1P';
    if (this.story && this.autoStory) return side ? 'CPU' : '主角';
    if (KF.mode === 'watch' || (side === 0 && window.__KF_AUTO)) return 'CPU';
    return side ? 'CPU' : '1P';
  }

  centerText(big, small, frames = 60, color) {
    const c = this.hud.center, c2 = this.hud.center2;
    c.setText(big).setAlpha(1).setScale(2.2);
    this.tweens.killTweensOf(c);
    this.tweens.add({ targets: c, scale: 1, duration: 180, ease: 'Back.out' });
    c2.setText(small || '').setAlpha(small ? 1 : 0);
    this.centerHideAt = this.frame + frames;
  }

  moveBanner(f, mv) {
    const s = f.side, x = s ? VIEW_W - 250 : 250, y = 140;
    if (this.hud.banner[s]) { try { this.hud.banner[s].destroy(); } catch (e) { /* */ } }
    const t = gradText(this, x, y, mv.name, mv.name.length > 10 ? 28 : 34, '#ffffff', mv.color || '#ffd84a', '#ff5a00').setScrollFactor(0).setDepth(110);
    if (t.width > 440) t.setScale(440 / t.width);
    this.hud.banner[s] = t;
    this.fx.add(t, 70, (o, p) => { o.setAlpha(p > 0.75 ? (1 - p) / 0.25 : 1); });
  }

  comboText(att, n, dmg) {
    const t = this.hud.combo[att.side];
    t.setText(`${n} HITS\n${dmg}`).setAlpha(1).setScale(1.3);
    this.tweens.killTweensOf(t);
    this.tweens.add({ targets: t, scale: 1, duration: 120 });
    this.comboHideAt = this.comboHideAt || [0, 0];
    this.comboHideAt[att.side] = this.frame + 70;
  }

  superFlash(f, mv) {
    this.superFreeze = 42; this.superUser = f;
    f.superGlow = 42;
    this.fx.flash(0xffffff, 6, 0.6);
    SFX.superFlash();
    // cut-in portrait
    const left = f.side === 0;
    const band = this.add.rectangle(VIEW_W / 2, 300, VIEW_W, 150, 0x000000, 0.75).setScrollFactor(0).setDepth(90);
    const face = this.add.image(left ? -150 : VIEW_W + 150, 300, 'face_' + f.style).setDisplaySize(170, 170).setScrollFactor(0).setDepth(91).setFlipX(!left);
    this.fx.add(band, 42, (o, p) => o.setAlpha(0.75 * (p < 0.8 ? 1 : (1 - p) / 0.2)));
    this.fx.add(face, 42, (o, p) => { o.x = left ? -150 + Math.min(1, p * 4) * 330 : VIEW_W + 150 - Math.min(1, p * 4) * 330; o.setAlpha(p < 0.8 ? 1 : (1 - p) / 0.2); });
    const nm = gradText(this, left ? 600 : 360, 300, mv.name, 40, '#ffffff', mv.color || '#ffd84a', '#ff3a00').setScrollFactor(0).setDepth(92);
    if (nm.width > 560) nm.setScale(560 / nm.width);
    const s0 = nm.scale;
    this.fx.add(nm, 42, (o, p) => { o.setScale(s0 * (p < 0.15 ? 1 + (0.15 - p) * 6 : 1)); o.setAlpha(p < 0.8 ? 1 : (1 - p) / 0.2); });
    const sub = T(this, left ? 600 : 360, 345, (mv.sub || '') + '', 18, '#9cf0ff').setOrigin(0.5).setScrollFactor(0).setDepth(92);
    this.fx.add(sub, 42, (o, p) => o.setAlpha(p < 0.8 ? 1 : (1 - p) / 0.2));
  }

  shake(frames, intensity) { this.shakeT = Math.max(this.shakeT, frames); this.shakeI = Math.max(this.shakeI, intensity); }

  spawnProj(owner, d, opts = {}) {
    const p = new Projectile(this, owner, d, Object.assign({ isSuper: owner.moveSlot === 'sp' }, opts));
    this.projs.push(p);
    if (this.projs.length > 40) { const old = this.projs.shift(); old.die(true); }
    if (!opts.followup) SFX.shot();
    return p;
  }

  // ------------------------------------------------------------ rounds
  startRound(first) {
    for (const p of this.projs) p.die(true);
    this.projs = [];
    this.fx.clear();
    this.hud.banner = [null, null];
    const [a, b] = this.fighters;
    [a, b].forEach((f, i) => {
      f.hp = f.maxHp; f.ko = false; f.x = i === 0 ? STAGE_W / 2 - 190 : STAGE_W / 2 + 190; f.y = FLOOR_Y; f.vx = f.vy = 0; f.pushV = 0;
      f.dir = i === 0 ? 1 : -1; f.move = null; f.combo = 0; f.freeze = 0; f.flash = 0; f.freezeTintT = 0; f.superGlow = 0; f.juggled = 0;
      f.buffer = {}; f.setState(first ? 'intro' : 'idle');
      f.buffT = 0; f.slowT = 0; f.dizzyImmune = 0; f.grab = null; f.heldBy = null; f.meterRoundStart = f.meter;
      if (f.form0 && f.form !== f.form0) f.applyForm(f.form0);
      this.onFormChange(f);
    });
    this.hpLag = [a.hp, b.hp];
    this.timer = ROUND_TIME; this.timerF = 0;
    this.phase = 'intro'; this.phaseF = 0; this.hitstop = 0; this.superFreeze = 0; this.slowmo = 0;
    this.roundWinner = null;
    this.cameras.main.scrollX = (STAGE_W - VIEW_W) / 2;
    Input.clearEdges();
  }

  onKO(victim, att) {
    if (this.phase !== 'fight') return;
    this.phase = 'ko'; this.phaseF = 0;
    this.slowmo = 70;
    SFX.announce('ko');
    this.fx.flash(0xffffff, 10, 0.8);
    this.centerText('K.O.', '', 100);
  }

  endRound(winner) {   // winner: fighter or null (draw)
    if (this.phase === 'roundEnd') return;
    this.phase = 'roundEnd'; this.phaseF = 0;
    const [a, b] = this.fighters;
    if (winner) { winner.wins++; if (winner.grounded && winner.state !== 'attack') winner.setState('win'); }
    else { a.wins++; b.wins++; }
    this.roundWinner = winner;
    const loser = winner ? winner.opp : null;
    if (loser && !loser.ko) loser.setState('lose');
    let big, small = '';
    if (winner) {
      big = winner.def.name + ' 勝';
      if (winner.hp >= winner.maxHp) small = 'PERFECT!';
      SFX.announce('win');
    } else { big = 'DRAW'; small = '平手'; }
    this.centerText(big, small, 110);
    this.refreshStars();
  }

  refreshStars() {
    this.fighters.forEach((f, s) => this.hud.bars[s].stars.forEach((st, i) => st.setText(f.wins > i ? '★' : '☆')));
  }

  finishRoundFlow() {
    const [a, b] = this.fighters;
    if (a.wins >= this.roundsToWin || b.wins >= this.roundsToWin) {
      let winner = null;
      if (a.wins >= this.roundsToWin && b.wins < this.roundsToWin) winner = a;
      else if (b.wins >= this.roundsToWin && a.wins < this.roundsToWin) winner = b;
      this.endMatch(winner);
      return;
    }
    this.round++;
    this.startRound(false);
  }

  endMatch(winner) {
    if (this.matchOver) return;
    this.matchOver = true;
    const res = { p1: KF.p1, p2: KF.p2, p1form: this.fighters[0].form0, p2form: this.fighters[1].form0, diff: KF.diff, mode: KF.mode, winner: winner ? winner.side : -1, rounds: this.round, wins: this.fighters.map(f => f.wins),
      hp: this.fighters.map(f => f.hp), maxHp: this.fighters.map(f => f.maxHp), dmgMul: this.fighters.map(f => f.dmgMul), frames: this.frame, stats: this.fighters.map(f => f.stats), stage: this.stageKey };
    KF.results.push(res);
    if (KF.results.length > 400) KF.results.shift();
    KF.lastResult = res;
    this.phase = 'matchEnd'; this.phaseF = 0;
  }

  // ------------------------------------------------------------ main loop
  update(time, delta) {
    this.tick++;
    Input.pollPads();
    this.updateTouch();
    if (!this.paused && (Input.menu('pause'))) { if (this.phase !== 'matchEnd') this.setPaused(true); }
    else if (this.paused) { this.updatePauseMenu(); }
    if (Input.consume(['KeyM'])) SFX.toggleMute();
    if (!this.paused) {
      const speed = (window.__KF && window.__KF.speed) || DEBUG.speed;
      this.acc += Math.min(delta, 100) * speed;
      let n = 0;
      const maxSteps = 4 * speed;
      while (this.acc >= 1000 / 60 && n < maxSteps) {
        this.acc -= 1000 / 60; n++;
        if (this.slowmo > 0) { this.slowmo--; if ((this.slowmo % 3) !== 0) continue; }
        try { this.step(); } catch (e) { this.reportError(e); }
        if (this.__leaving) break;
      }
      if (n >= maxSteps) this.acc = 0;
    }
    try { this.render(); } catch (e) { this.reportError(e); }
  }

  reportError(e) {
    const msg = (e && (e.stack || e.message)) || String(e);
    window.__GAME_ERRORS = window.__GAME_ERRORS || [];
    if (window.__GAME_ERRORS.length < 50) window.__GAME_ERRORS.push(msg);
    if (window.__GAME_ERRORS.length <= 5) console.error('[fight] recovered from error:', msg);
  }

  step() {
    this.frame++; this.phaseF++;
    const [a, b] = this.fighters;
    this.fx.step();
    if (this.centerHideAt && this.frame >= this.centerHideAt) { this.hud.center.setAlpha(0); this.hud.center2.setAlpha(0); this.centerHideAt = 0; }
    if (this.comboHideAt) this.comboHideAt.forEach((t, s) => { if (t && this.frame >= t) { this.hud.combo[s].setAlpha(0); this.comboHideAt[s] = 0; } });
    if (this.shakeT > 0) { this.shakeT--; if (!this.shakeT) this.shakeI = 0; }
    // ---- phase flow ----
    if (this.phase === 'intro') {
      const len = this.round === 1 ? 120 : 90;
      if (this.phaseF === 12) {
        if (this.story) this.centerText('ONE ROUND', '一局定勝負', 50);
        else this.centerText(this.round >= 3 ? 'FINAL ROUND' : 'ROUND ' + this.round, this.round >= 3 ? '最終回合' : `第 ${this.round} 回合`, 50);
        SFX.announce('round');
      }
      if (this.phaseF === len - 24) { this.centerText('FIGHT!', '開打！', 36); SFX.announce('fight'); }
      if (this.phaseF >= len) { this.phase = 'fight'; this.phaseF = 0; a.setState('idle'); b.setState('idle'); Input.clearEdges(); }
      a.update(); b.update();
      this.physicsAll();
      return;
    }
    if (this.phase === 'matchEnd') {
      a.update(); b.update(); this.physicsAll();
      if (this.phaseF === 30) {
        const w = KF.lastResult.winner;
        let txt;
        if (w < 0) txt = 'DRAW GAME';
        else if (KF.mode === 'arcade' || KF.mode === 'free' || (this.story && !this.autoStory)) txt = w === 0 ? 'YOU WIN!' : 'YOU LOSE';
        else txt = this.fighters[w].def.name + ' WINS!';
        this.centerText(txt, '', 200);
      }
      if (this.phaseF === 140) {
        if (KF.flow && (KF.mode === 'arcade' || KF.mode === 'story')) Flow.afterFight(this, KF.lastResult);
        else UI.fadeTo(this, 'Result', {});
      }
      return;
    }
    if (this.phase === 'timeup') {
      a.update(); b.update(); this.physicsAll();
      for (const p of this.projs) p.step();
      this.projs = this.projs.filter(p => p.alive);
      if (this.phaseF >= 75) this.endRound(this.timeupWinner);
      return;
    }
    if (this.phase === 'roundEnd') {
      const w = this.roundWinner;
      if (w && !w.ko && w.grounded && w.state !== 'win' && w.state !== 'attack') w.setState('win');
      if (w && w.state === 'attack' && w.grounded && this.phaseF > 40) { w.move = null; w.setState('win'); }
      a.update(); b.update(); this.physicsAll();
      for (const p of this.projs) p.step();
      this.projs = this.projs.filter(p => p.alive);
      if (this.phaseF >= 150) this.finishRoundFlow();
      return;
    }
    // ---- super flash freeze ----
    if (this.superFreeze > 0) {
      this.superFreeze--;
      this.dim.setAlpha(Math.min(0.55, this.dim.alpha + 0.08));
      return;
    }
    if (this.dim.alpha > 0) this.dim.setAlpha(Math.max(0, this.dim.alpha - 0.06));
    if (this.hitstop > 0) { this.hitstop--; return; }

    if (this.phase === 'fight') {
      // inputs
      const inp = [0, 1].map(s => {
        if (this.ctrl[s]) return this.ctrl[s].frame(this);
        return Input.frame(s);
      });
      if (window.__KF && window.__KF.inject) {          // tests: per-side forced input for this frame
        for (let s = 0; s < 2; s++) { const x = window.__KF.inject[s]; if (x) { Object.assign(inp[s], x); } }
        window.__KF.inject = null;
      }
      a.think(inp[0]); b.think(inp[1]);
    }
    a.update(); b.update();
    this.physicsAll();
    if (this.phase === 'fight') this.resolveHits();
    for (const p of this.projs) p.step();
    this.projs = this.projs.filter(p => p.alive);
    if (this.phase === 'fight') {
      // timer
      if (++this.timerF >= TICK_FRAMES) {
        this.timerF = 0; this.timer--;
        if (this.timer <= 0) { this.timer = 0; this.timeUp(); }
      }
    }
    if (this.phase === 'ko') {
      // wait for the KO'd fighter(s) to land, then a beat
      const downed = this.fighters.filter(f => f.ko);
      const settled = downed.every(f => f.state === 'kodown');
      if (settled && !this.koSettledAt) this.koSettledAt = this.phaseF;
      if ((this.koSettledAt && this.phaseF - this.koSettledAt > 50) || this.phaseF > 400) {
        this.koSettledAt = 0;
        const alive = this.fighters.filter(f => !f.ko);
        this.endRound(alive.length === 1 ? alive[0] : null);
      }
    }
  }

  timeUp() {
    const [a, b] = this.fighters;
    this.phase = 'timeup'; this.phaseF = 0;
    this.centerText('TIME UP', '時間到', 70);
    const ra = Math.round(a.hp / a.maxHp * 1000), rb = Math.round(b.hp / b.maxHp * 1000);   // compare % of life (heroes differ in max HP)
    this.timeupWinner = ra === rb ? null : (ra > rb ? a : b);
  }

  physicsAll() {
    const [a, b] = this.fighters;
    const pa = a.x, pb = b.x;
    a.physics(); b.physics();
    // walls
    for (const f of this.fighters) f.x = clamp(f.x, WALL_PAD, STAGE_W - WALL_PAD);
    // max separation (screen width) — the one moving outward is stopped
    const dist = Math.abs(a.x - b.x);
    if (dist > MAX_SEP) {
      const ex = dist - MAX_SEP;
      const left = a.x < b.x ? a : b, right = left === a ? b : a;
      const lp = left === a ? pa : pb, rp = right === a ? pa : pb;
      const outL = lp - left.x, outR = right.x - rp;
      if (outL >= outR) left.x += ex; else right.x -= ex;
    }
    // body push (no overlapping), skip while one is down or far above the other
    const solid = f => !['down', 'kodown', 'getup'].includes(f.state);
    if (solid(a) && solid(b) && Math.abs(a.y - b.y) < 120) {
      const PW = 30 * (a.hScale + b.hScale);
      const dx = b.x - a.x;
      if (Math.abs(dx) < PW) {
        const side = dx !== 0 ? Math.sign(dx) : (a.dir || 1);
        const ov = PW - Math.abs(dx);
        a.x -= side * ov / 2; b.x += side * ov / 2;
        for (const f of this.fighters) {
          if (f.x < WALL_PAD) { const d = WALL_PAD - f.x; f.x = WALL_PAD; f.opp.x += d; }
          if (f.x > STAGE_W - WALL_PAD) { const d = f.x - (STAGE_W - WALL_PAD); f.x = STAGE_W - WALL_PAD; f.opp.x -= d; }
        }
      }
    }
  }

  resolveHits() {
    const [a, b] = this.fighters;
    const ha = this.meleeCheck(a, b), hb = this.meleeCheck(b, a);
    if (ha) this.applyMelee(a, b);
    if (hb) this.applyMelee(b, a);
    // projectiles vs fighters
    for (const p of this.projs) {
      if (!p.alive) continue;
      const box = p.box(); if (!box) continue;
      if (p.age < p.nextHit) continue;
      const t = p.owner.opp;
      const hb2 = t.hurtbox();
      if (!boxesOverlap(box, hb2)) continue;
      const last = p.hitsLeft <= 1;
      const srcX = (p.kind === 'rain' || p.kind === 'pillar') ? p.owner.x : p.x - p.vx;
      // absorb / reflect stances (single-hit, non-super projectiles only)
      if (t.state === 'attack' && t.move && (t.move.absorb || t.move.reflect) && t.mf >= t.move.startup - 2 && t.mf <= t.move.startup + t.move.active
          && !p.isSuper && (p.d.hits || 1) <= 1 && p.kind === 'straight') {
        if (t.move.reflect && !p.reflected) {
          p.owner = t; p.dir = -p.dir; p.vx = -p.vx * 1.15; p.age = 0; p.nextHit = 0; p.reflected = true; p.returning = false;
          if (p.view && p.view.setFlipX) p.view.setFlipX(p.dir === -1);
          this.fx.popText(t.x, t.y - t.H - 30, '反彈！', '#9cf0ff'); this.fx.blockSpark(p.x, p.y); SFX.parry(); t.meterAdd(12);
        } else {
          p.die(true); this.fx.popText(t.x, t.y - t.H - 30, '吸收！+氣', '#ffe14a'); this.fx.blockSpark(p.x, p.y); SFX.coin ? SFX.coin() : SFX.parry(); t.meterAdd(t.move.absorb || 30);
        }
        continue;
      }
      const res = t.takeHit(p.owner, p.d, srcX, { proj: true, kd: !!p.d.kd && last, isSuper: p.isSuper, hy: clamp(p.y, t.y - t.H, t.y - 20) });
      if (res === 'miss') continue;
      p.hitsLeft--; p.nextHit = p.age + (p.d.interval || 99);
      if (res === 'hit' && p.d.followup) this.spawnProj(p.owner, p.d.followup, { atX: t.x, followup: true, isSuper: p.isSuper });
      if (res === 'countered' || p.hitsLeft <= 0) {
        if (p.kind === 'pillar' || p.kind === 'wave') p.spent = true; else p.die();
      }
    }
    // projectile clash
    const ps = this.projs;
    for (let i = 0; i < ps.length; i++) for (let j = i + 1; j < ps.length; j++) {
      const p = ps[i], q = ps[j];
      if (!p.alive || !q.alive || p.owner === q.owner) continue;
      const barrier = p.d.barrier || q.d.barrier;
      const ok = k => k === 'straight' || k === 'wave' || (barrier && k === 'rain');
      if (!ok(p.kind) || !ok(q.kind)) continue;
      if (p.clashCd > 0 || q.clashCd > 0 || p.spent || q.spent) continue;
      if (!boxesOverlap(p.box(), q.box())) continue;
      p.dur--; q.dur--; p.clashCd = q.clashCd = 8;
      this.fx.hitSpark((p.x + q.x) / 2, (p.y + q.y) / 2, true); SFX.bang();
      if (p.dur <= 0) p.die(); if (q.dur <= 0) q.die();
    }
  }

  meleeCheck(att, def) {
    const box = att.attackBox(); if (!box) return false;
    return boxesOverlap(box, def.hurtbox());
  }

  applyMelee(att, def) {
    const mv = att.move; if (!mv) return;
    if (mv.grab) {          // command grab: beats blocking & counter stances, misses airborne / stunned / invulnerable targets
      const bad = ['held', 'fall', 'down', 'getup', 'kodown', 'intro', 'win', 'lose'];
      if (!mv.grabAir) bad.push('hit', 'dizzy', 'jumpsq');
      if (bad.includes(def.state) || def.grab || def.ko || (!def.grounded && !mv.grabAir) || !def.hurtbox()) return;
      if (!def.grounded) { def.y = FLOOR_Y; def.vy = 0; }
      att.hitsDone = 99;
      att.startGrab(def);
      return;
    }
    const hits = mv.hits || 1;
    const last = att.hitsDone + 1 >= hits;
    const res = def.takeHit(att, mv, att.x, { kd: !!mv.kd && last, finisher: last && mv.finisher, isSuper: att.moveSlot === 'sp' });
    if (res === 'miss') return;
    att.hitsDone++; att.nextHitAt = att.mf + (mv.interval || 99); att.connected = true;
    if (res === 'countered') att.hitsDone = 99;
    if (res === 'block' && mv.dash) { /* dash continues */ }
  }

  // ------------------------------------------------------------ render
  render() {
    const [a, b] = this.fighters;
    const cam = this.cameras.main;
    const target = clamp((a.x + b.x) / 2 - VIEW_W / 2, 0, STAGE_W - VIEW_W);
    let sx = cam.scrollX + (target - cam.scrollX) * 0.2;
    if (Math.abs(target - sx) < 0.5) sx = target;
    const sh = this.shakeT > 0 ? (Math.random() * 2 - 1) * this.shakeI : 0;
    cam.setScroll(sx + sh, (this.shakeT > 0 ? (Math.random() * 2 - 1) * this.shakeI * 0.6 : 0));
    a.render(this.tick); b.render(this.tick);
    if (this.cameo) {
      const c = this.cameo; c.x += 1.1; if (c.x > STAGE_W + 120) c.x = -120;
      c.cm.setX(c.x).setTexture(c.key + ((Math.floor(this.tick / 14) % 2) ? '_walk2' : '_walk1'));
      c.box.setPosition(c.x + 6, FLOOR_Y - 70 - 0.38 * 250 - 10);
    }
    for (const p of this.projs) p.render();
    // HUD
    this.fighters.forEach((f, s) => {
      const bar = this.hud.bars[s];
      bar.hp.scaleX = clamp(f.hp / f.maxHp, 0, 1);
      bar.hp.fillColor = f.hp < f.maxHp * 0.25 ? ((this.tick % 20 < 10) ? 0xff6a3a : 0xffd84a) : 0xffd84a;
      this.hpLag[s] = this.hpLag[s] > f.hp ? Math.max(f.hp, this.hpLag[s] - 6) : f.hp;
      bar.lag.scaleX = clamp(this.hpLag[s] / f.maxHp, 0, 1);
      bar.meter.scaleX = clamp(f.meter / METER_MAX, 0, 1);
      const full = f.meter >= SUPER_COST;
      bar.meter.fillColor = full ? ((this.tick % 16 < 8) ? 0xffffff : 0xffd84a) : 0x3ac8ff;
      bar.mtxt.setText(full ? '超必殺 OK!' : (f.meter >= 100 ? '氣 1/2' : ''));
    });
    this.hud.timer.setText(String(Math.max(0, this.timer)).padStart(2, '0'));
    this.hud.timer.setColor(this.timer <= 10 ? '#ff5a4a' : '#ffd84a');
    if (this.touch) this.renderTouch();
  }

  // ------------------------------------------------------------ touch controls
  buildTouch() {
    const humanP1 = !this.ctrl[0];
    this.touch = null;
    if (!humanP1) return;
    const want = DEBUG.touch || this.sys.game.device.input.touch;
    const D = 120;
    const t = { visible: false, dpad: { x: 130, y: 405, r: 86 }, buttons: [] };
    t.base = this.add.image(t.dpad.x, t.dpad.y, 'tc_base').setScrollFactor(0).setDepth(D).setAlpha(0.8);
    t.knob = this.add.image(t.dpad.x, t.dpad.y, 'tc_knob').setScrollFactor(0).setDepth(D + 1).setAlpha(0.85);
    const defs = [
      { id: 's1', label: '必殺1', x: 680, y: 372 }, { id: 's2', label: '必殺2', x: 780, y: 360 }, { id: 's3', label: '必殺3', x: 880, y: 372 },
      { id: 'lp', label: '拳', x: 680, y: 470 }, { id: 'lk', label: '腳', x: 780, y: 458 }, { id: 'sp', label: '超必殺', x: 880, y: 470 },
    ];
    for (const d of defs) {
      d.img = this.add.image(d.x, d.y, 'tc_btn').setScrollFactor(0).setDepth(D).setScale(0.86);
      d.txt = T(this, d.x, d.y, d.label, d.label.length > 1 ? 18 : 28, d.id === 'sp' ? '#ffe14a' : d.id[0] === 's' ? '#9cf0ff' : '#ffffff').setOrigin(0.5).setScrollFactor(0).setDepth(D + 1);
      d.held = false; t.buttons.push(d);
    }
    this.touch = t;
    this.setTouchVisible(want);
    this.input.addPointer(3);
    this.input.on('pointerdown', (p) => {
      SFX.unlock();
      if (p.wasTouch && !this.touch.visible) this.setTouchVisible(true);
      if (!this.touch.visible || this.paused) return;
      for (const b of this.touch.buttons) if (!b.held && Math.hypot(p.x - b.x, p.y - b.y) < 50) { Input.touchEdge[b.id] = true; b.held = true; }
    });
  }
  setTouchVisible(v) {
    const t = this.touch; if (!t) return;
    t.visible = v;
    [t.base, t.knob, ...t.buttons.flatMap(b => [b.img, b.txt])].forEach(o => o.setVisible(v));
  }
  updateTouch() {
    const t = this.touch, tt = Input.touch;
    tt.l = tt.r = tt.u = tt.d = false;
    if (!t || !t.visible || this.paused) return;
    const held = {};
    let kx = t.dpad.x, ky = t.dpad.y;
    for (const ptr of this.input.manager.pointers) {
      if (!ptr || !ptr.isDown) continue;
      const x = ptr.x, y = ptr.y;
      if (x < VIEW_W * 0.42 && y > 150) {
        const dx = x - t.dpad.x, dy = y - t.dpad.y, dist = Math.hypot(dx, dy);
        if (dist > 16) {
          const ang = Math.atan2(dy, dx);
          tt.r = Math.cos(ang) > 0.38; tt.l = Math.cos(ang) < -0.38; tt.d = Math.sin(ang) > 0.5; tt.u = Math.sin(ang) < -0.5;
        }
        const k = Math.min(dist, t.dpad.r - 20) / (dist || 1);
        kx = t.dpad.x + dx * k; ky = t.dpad.y + dy * k;
      } else if (x > VIEW_W * 0.55 && y > 300) {
        let best = null, bd = 60;
        for (const b of t.buttons) { const d = Math.hypot(x - b.x, y - b.y); if (d < bd) { bd = d; best = b; } }
        if (best) held[best.id] = true;
      }
    }
    t.knob.setPosition(kx, ky);
    for (const b of t.buttons) {
      const h = !!held[b.id];
      if (h && !b.held) Input.touchEdge[b.id] = true;
      b.held = h;
    }
  }
  renderTouch() {
    const t = this.touch; if (!t.visible) return;
    const f = this.fighters[0];
    for (const b of t.buttons) {
      let tint = b.held ? 0xffd84a : 0xffffff;
      if (b.id === 'sp' && f.meter >= SUPER_COST && !b.held) tint = (this.tick % 16 < 8) ? 0xffe14a : 0xffffff;
      b.img.setTint(tint).setScale(b.held ? 0.8 : 0.86);
    }
  }

  // ------------------------------------------------------------ pause
  buildPause() {
    const D = 300, sf = o => o.setScrollFactor(0).setDepth(D).setVisible(false);
    const items = [];
    items.push(sf(this.add.rectangle(VIEW_W / 2, VIEW_H / 2, VIEW_W, VIEW_H, 0x000000, 0.78)));
    items.push(sf(gradText(this, VIEW_W / 2, 50, '暫停 PAUSE', 44)));
    const btnDefs = [['繼續', () => this.setPaused(false)], ['重新開始這場', () => this.restartMatch()], ['重新揀角色', () => this.toSelect()], ['回到標題', () => this.toTitle()]];
    if (this.story) btnDefs.splice(1, 0, ['略過這場戰鬥', () => { this.paused = false; this.skipFight(); }]);
    this.pauseBtns = btnDefs.map(([l, cb], i) => { const b = makeButton(this, 170, 140 + i * 62, 270, 50, l, () => { if (this.paused) cb(); }, { size: 22, depth: D + 1, scrollFactor: 0 }); b.setVisible(false); return b; });
    this.pauseMenu = new Menu(this, this.pauseBtns);
    // move list
    const list = (f, x) => {
      const sp = f.specials;
      return sf(T(this, x, 110, `${f.def.name} 招式表\n\n` +
        `拳 / 腳　　（蹲下＋腳 = 掃腿，要蹲防）\n` +
        `必殺1　${sp.s1.name}\n必殺2　${sp.s2.name}\n必殺3　${sp.s3.name}\n超必殺　${sp.sp.name}（2 格氣）`, 18, '#ffffff', { align: 'left', lineSpacing: 8 }).setOrigin(0, 0));
    };
    items.push(list(this.fighters[0], 340));
    if (KF.mode === 'vs') items.push(list(this.fighters[1], 340).setY(330));
    items.push(sf(T(this, 340, KF.mode === 'vs' ? 520 : 400, '鍵盤：拳 J 腳 K 必殺 U I O 超必殺 L ・ 跳 W ・ 蹲 S ・ 向後 = 防禦', 16, '#9cf0ff', { align: 'left' }).setOrigin(0, 0.5)));
    this.pauseItems = items;
    this.fullBtn = null;
  }
  setPaused(v) {
    if (this.phase === 'matchEnd' && v) return;
    this.paused = v;
    this.pauseItems.forEach(o => o.setVisible(v));
    this.pauseBtns.forEach(b => b.setVisible(v));
    if (v) { this.pauseMenu.select(0, true); this.pausedAt = this.time.now; Input.clearEdges(); }
    else { this.acc = 0; Input.clearEdges(); }
    if (this.touch) {
      if (v) { this.touchWasVisible = this.touch.visible; this.setTouchVisible(false); }
      else if (this.touchWasVisible) this.setTouchVisible(true);
    }
  }
  updatePauseMenu() {
    if (this.time.now - this.pausedAt < 150) return;
    if (Input.menu('back') || Input.consume(['KeyP'])) { this.setPaused(false); return; }
    if (Input.consume(['Escape'])) { this.setPaused(false); return; }
    this.pauseMenu.update();
  }
  skipFight() {
    if (this.matchOver) return;
    this.matchOver = true;
    const res = { p1: KF.p1, p2: KF.p2, mode: KF.mode, winner: 0, skipped: true, rounds: 0, wins: [0, 0], hp: this.fighters.map(f => f.hp), frames: this.frame, stats: this.fighters.map(f => f.stats), stage: this.stageKey };
    KF.results.push(res); KF.lastResult = res;
    Flow.afterFight(this, res);
  }
  restartMatch() { this.paused = false; UI.fadeTo(this, 'Fight', { stage: this.stageKey }); }
  toSelect() { this.paused = false; UI.fadeTo(this, 'Select', {}); }
  toTitle() { this.paused = false; UI.fadeTo(this, 'Title', {}); }
}
