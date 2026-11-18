// ============================================================
// kf-flow.js — arcade / 純故事模式 sequencing, plus the Wong Kar-wai style
// mood overlay (rain, grain, neon flicker, slow-shutter streaks).
//   KF.flow.steps: story → [pre story, fight, post story, (bonus)] × N → boss pre → boss → boss post → ending
// Every step is a separate scene start, so restarting / continuing just re-runs a step.
// ============================================================
const BONUS_AFTER = { 1: 'noodle', 3: 'cardboard', 5: 'coins' };   // arcade: after fight #2, #4, #6
const Flow = {
  start(scene, mode) {
    const p = KF.p1;
    const others = CHAR_ORDER.filter(k => k !== p);
    const opps = mode === 'arcade' ? shuffle(others).slice(0, 7) : others.slice();   // story mode meets everyone once
    const steps = [{ t: 'story', kind: 'intro' }];
    opps.forEach((o, i) => {
      steps.push({ t: 'story', kind: 'pre', o });
      steps.push({ t: 'fight', o, stage: Flow.stageFor(o), n: i });
      steps.push({ t: 'story', kind: 'post', o });
      if (mode === 'arcade' && BONUS_AFTER[i]) steps.push({ t: 'bonus', kind: BONUS_AFTER[i] });
    });
    steps.push({ t: 'story', kind: 'pre', o: BOSS_KEY });
    steps.push({ t: 'fight', o: BOSS_KEY, stage: 'roof', n: opps.length, boss: true });
    steps.push({ t: 'story', kind: 'post', o: BOSS_KEY });
    steps.push({ t: 'ending' });
    KF.mode = mode;
    KF.flow = { mode, steps, idx: 0, p, form: KF.p1form, total: opps.length + 1, score: 0, bonus: [], wins: 0, losses: 0, skipped: 0, continues: 0, startedAt: Date.now() };
    Flow.go(scene);
  },
  stageFor(o) { return (CHARACTERS[o] && CHARACTERS[o].stage) || 'street'; },
  cur() { return KF.flow && KF.flow.steps[KF.flow.idx]; },
  go(scene) {
    const st = Flow.cur();
    if (!st) { KF.flow = null; UI.fadeTo(scene, 'Title', {}); return; }
    if (window.__KF) window.__KF.flowStep = KF.flow.idx + ':' + st.t + ':' + (st.kind || st.o || '');
    if (st.t === 'story') UI.fadeTo(scene, 'Story', {});
    else if (st.t === 'fight') {
      KF.p2 = st.o; KF.stage = st.stage; KF.ladderIdx = st.n;
      KF.p2form = CHARACTERS[st.o].forms ? (Math.random() < 0.5 ? 'suit' : 'vest') : null;
      UI.fadeTo(scene, 'Vs', {});
    } else if (st.t === 'bonus') UI.fadeTo(scene, 'Bonus', { kind: st.kind });
    else UI.fadeTo(scene, 'Ending', {});
  },
  next(scene) { if (!KF.flow) return UI.fadeTo(scene, 'Title', {}); KF.flow.idx++; Flow.go(scene); },
  // story mode: skip the coming fight, still show the post-fight story
  skipFight(scene) {
    const f = KF.flow; if (!f) return;
    const st = f.steps[f.idx + 1];
    if (st && st.t === 'fight') { f.idx += 2; f.skipped++; KF.results.push({ p1: KF.p1, p2: st.o, mode: 'story', winner: 0, skipped: true }); f.lastWon = true; Flow.go(scene); }
    else Flow.next(scene);
  },
  afterFight(scene, res) {
    const f = KF.flow; if (!f) return UI.fadeTo(scene, 'Title', {});
    const won = res.winner === 0;
    if (f.mode === 'arcade' && !won) { UI.fadeTo(scene, 'Result', {}); return; }   // continue screen → Flow.retry
    if (res.skipped) f.skipped++; else if (won) f.wins++; else f.losses++;
    f.lastWon = won;
    if (won && !res.skipped && res.hp) f.score += 1000 + Math.round(res.hp[0]) * 10;
    Flow.next(scene);
  },
  retry(scene) { KF.flow.continues++; Flow.go(scene); },
};

// ------------------------------------------------------------ mood overlay
const Mood = {
  add(scene, o0 = {}) {
    let o = o0;
    const D = o.depth || 80, items = [];
    if (store('fx') === '0') { o = Object.assign({}, o, { light: true, nograin: true }); }
    const sf = x => { x.setScrollFactor(0).setDepth(D); items.push(x); return x; };
    const m = { items, rain: [], streaks: [], t: 0 };
    // colour grade: teal shadows, warm neon — subtle so the fight stays readable
    // (fights: the backgrounds already have grade + vignette baked in, so only grain is added — keeps phones at 60 fps)
    if (!o.light) {
      m.wash = sf(scene.add.rectangle(VIEW_W / 2, VIEW_H / 2, VIEW_W, VIEW_H, 0x10a080, o.washA != null ? o.washA : 0.07));
      m.vig = sf(scene.add.image(VIEW_W / 2, VIEW_H / 2, 'vignette').setDisplaySize(VIEW_W, VIEW_H).setAlpha(o.vigA != null ? o.vigA : 0.9));
    }
    if (!o.nograin) m.grain = sf(scene.add.image(0, 0, 'grain').setOrigin(0).setDisplaySize(VIEW_W + 256, VIEW_H + 256).setAlpha(o.grainA != null ? o.grainA : 0.32));
    if (o.rain) for (let i = 0; i < 44; i++) {
      const r = sf(scene.add.image(Math.random() * VIEW_W, Math.random() * VIEW_H, 'rainline').setAngle(12).setAlpha(0.18 + Math.random() * 0.25).setScale(1, 0.6 + Math.random() * 0.8));
      r.vy = 11 + Math.random() * 7; m.rain.push(r);
    }
    if (o.neon) m.neon = sf(scene.add.rectangle(VIEW_W / 2, VIEW_H * 0.3, VIEW_W, VIEW_H * 0.6, 0xff2a80, 0).setBlendMode(Phaser.BlendModes.ADD));
    if (o.tube) m.tube = sf(scene.add.rectangle(VIEW_W / 2, 60, VIEW_W, 120, 0xc8fff0, 0).setBlendMode(Phaser.BlendModes.ADD));
    for (let i = 0; i < 2; i++) {
      const s = sf(scene.add.image(-400, 0, 'streak').setBlendMode(Phaser.BlendModes.ADD).setAlpha(0));
      s.active2 = false; m.streaks.push(s);
    }
    const upd = () => {
      m.t++;
      if (m.grain && m.t % 2 === 0) m.grain.setPosition(-Math.random() * 256, -Math.random() * 256);
      for (const r of m.rain) { r.y += r.vy; r.x += r.vy * 0.2; if (r.y > VIEW_H + 40) { r.y = -40; r.x = Math.random() * VIEW_W; } }
      if (m.neon) { const on = m.t % 240 < 18; m.neon.setVisible(on).setAlpha(on ? (m.t % 4 < 2 ? 0.09 : 0.03) : 0); }
      if (m.tube) { const on = m.t % 173 < 5; m.tube.setVisible(on).setAlpha(on && m.t % 2 ? 0.12 : 0); }
      // slow-shutter light streaks (trains / passing cars)
      for (const s of m.streaks) {
        if (!s.active2 && Math.random() < (o.train ? 0.006 : 0.003)) {
          s.active2 = true; s.x = -300; s.y = 80 + Math.random() * (o.train ? 80 : 240); s.vx = 26 + Math.random() * 20;
          s.setTint([0xff4a8a, 0x40ffd0, 0xffe14a][Math.floor(Math.random() * 3)]).setScale(3 + Math.random() * 3, 1 + Math.random() * 2).setAlpha(0.35);
        }
        if (s.active2) { s.x += s.vx; if (s.x > VIEW_W + 500) { s.active2 = false; s.setAlpha(0); } }
      }
    };
    scene.events.on('update', upd);
    scene.events.once('shutdown', () => scene.events.off('update', upd));
    m.setVisible = v => items.forEach(x => x.setVisible(v));
    return m;
  },
  letterbox(scene, h = 46, depth = 85) {
    return [scene.add.rectangle(VIEW_W / 2, h / 2, VIEW_W, h, 0x000000).setScrollFactor(0).setDepth(depth),
      scene.add.rectangle(VIEW_W / 2, VIEW_H - h / 2, VIEW_W, h, 0x000000).setScrollFactor(0).setDepth(depth)];
  },
};
