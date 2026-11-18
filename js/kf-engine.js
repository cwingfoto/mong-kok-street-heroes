// ============================================================
// kf-engine.js — Fighter / Projectile / Fx (pure frame-step logic + views).
// No Phaser physics, no timers: FightScene.step() advances everything one
// 60 Hz frame at a time, so the game can't "hang" on stray callbacks.
// ============================================================
let SPRITE_META = {};
const STAND_H = 210;            // hurtbox height for a 172 cm fighter (scaled by cm)

function boxesOverlap(a, b) { return a && b && a.x1 < b.x2 && a.x2 > b.x1 && a.y1 < b.y2 && a.y2 > b.y1; }
function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }

class Fighter {
  constructor(scene, key, side, form) {
    this.scene = scene; this.key = key; this.side = side;
    this.def = CHARACTERS[key] || CHARACTERS.kowloon;
    this.hScale = this.def.cm / 172;
    this.H = STAND_H * this.hScale;
    this.applyForm(this.def.forms ? (this.def.forms[form] ? form : this.def.defaultForm) : null);
    const m = this.meta;
    this.maxHp = this.def.hp; this.dmgMul = 1;
    if (this.def.boss) { const bs = BOSS_SCALE[KF.diff] || BOSS_SCALE.normal; this.maxHp = bs.hp; this.dmgMul = bs.dmg; this.bossRegen = bs.regen; }
    this.buffT = 0; this.slowT = 0; this.dizzyImmune = 0; this.grab = null; this.heldBy = null;
    this.x = side === 0 ? STAGE_W / 2 - 190 : STAGE_W / 2 + 190;
    this.y = FLOOR_Y; this.vx = 0; this.vy = 0;
    this.dir = side === 0 ? 1 : -1;
    this.hp = this.maxHp; this.meter = 0; this.wins = 0;
    this.state = 'intro'; this.sf = 0;
    this.move = null; this.mf = 0;
    this.buffer = {}; this.combo = 0; this.comboDmg = 0;
    this.holdBack = false; this.holdDown = false;
    this.airAttackUsed = false; this.connected = false;
    this.freeze = 0; this.flash = 0; this.shake = 0;
    this.ko = false; this.dmgTakenMul = 1;
    this.stats = { specials: {}, supers: 0, hits: 0, blocks: 0 };
    // ---- views ----
    const tex = this.texFor('idle');
    this.shadow = scene.add.ellipse(this.x, FLOOR_Y + 2, 110 * this.hScale, 18, 0x000000, 0.4).setDepth(9);
    if (this.def.stand) this.standImg = scene.add.image(this.x, this.y, this.def.stand).setOrigin(0.5, 1).setScale(0.62).setAlpha(0.6).setDepth(9.5);
    this.sprite = scene.add.image(this.x, this.y, tex).setDepth(10 + side * 0.1);
    this.sprite.setOrigin((m.cx || m.w / 2) / m.w, (m.feet || m.h) / m.h).setScale(this.scale);
    this.pose = 'idle';
  }

  // 阿飛's outfits: swap style, specials and stats (also used mid-fight by his super)
  applyForm(form) {
    const d = this.def, fm = d.forms && form ? d.forms[form] : null;
    this.form = fm ? form : null;
    this.style = fm ? fm.style : d.style;
    if (this.side === 1 && ['sage','mkgirl'].includes(this.key)) this.style += '_alt';
    this.specials = fm ? fm.specials : d.specials;
    this.spd = fm ? fm.speed : d.speed; this.mel = fm ? fm.melee : d.melee; this.formTaken = fm ? (fm.dmgTaken || 1) : 1;
    const m = SPRITE_META[this.style] || { w: 280, h: 290, feet: 285, cx: 140, bodyH: 255 };
    this.meta = m;
    this.scale = (238 * this.hScale) / (m.bodyH || 255);
    if (this.sprite) { this.pose = null; this.sprite.setTexture(this.texFor('idle')).setOrigin((m.cx || m.w / 2) / m.w, (m.feet || m.h) / m.h); }
  }
  setForm(form) {
    if (!this.def.forms || form === this.form) return;
    this.applyForm(form);
    this.scene.fx.popText(this.x, this.y - this.H - 50, (this.def.forms[form].label || form) + '！', '#ffffff');
    this.scene.fx.special({ type: 'jacket' }, this);
    if (this.scene.onFormChange) this.scene.onFormChange(this);
  }
  moveSpd() { return this.spd * (this.buffT > 0 && this.buffD ? (this.buffD.speed || 1) : 1) * (this.slowT > 0 ? (this.slowMul || 0.5) : 1); }

  texFor(pose) {
    const k = `${this.style}_${pose}`;
    if (this.scene.textures.exists(k)) return k;
    const fb = { cpunch: 'punch', ckick: 'kick', crouch: 'block', cblock: 'block', shout: 'win', cast: 'shoot', spin: 'kick' }[pose];
    return this.scene.textures.exists(`${this.style}_${fb}`) ? `${this.style}_${fb}` : `${this.style}_idle`;
  }

  get grounded() { return this.y >= FLOOR_Y - 0.01 && this.vy >= 0; }
  get opp() { return this.scene.fighters[1 - this.side]; }
  get actionable() { return ['idle', 'walk', 'crouch', 'guard'].includes(this.state); }
  get attacking() { return this.state === 'attack' && this.move && this.mf <= (this.move.startup + this.move.active + 2); }
  hasProjectile() { return this.scene.projs.some(p => p.alive && p.owner === this && !p.isFollowup && p.kind !== 'puddle'); }

  setState(s) { this.state = s; this.sf = 0; }

  // ------------------------------------------------------------ input → actions
  think(inp) {
    const opp = this.opp;
    for (const b of BTN) { if (inp[b]) this.buffer[b] = 8; else if (this.buffer[b] > 0) this.buffer[b]--; }
    const towardRight = opp.x > this.x;
    this.holdBack = towardRight ? (inp.l && !inp.r) : (inp.r && !inp.l);
    this.holdDown = !!inp.d;
    this.inp = inp;
    if (this.freeze > 0) return;
    const s = this.state;
    if (this.actionable || s === 'land') {
      if (s !== 'land') this.faceOpp();
      if (this.tryButtons(inp)) return;
      if (s === 'land') return;
      if (inp.u) { this.jdir = inp.r && !inp.l ? 1 : inp.l && !inp.r ? -1 : 0; this.setState('jumpsq'); this.vx = 0; return; }
      if (inp.d) { if (s !== 'crouch' && s !== 'guard') this.setState('crouch'); this.vx = 0;
        if (this.holdBack && this.threatened()) { this.state = 'guard'; } else if (this.state === 'guard') this.state = 'crouch';
        return; }
      const fwd = (inp.r && !inp.l) ? 1 : (inp.l && !inp.r) ? -1 : 0;
      if (fwd !== 0) {
        const back = fwd !== this.dir;
        if (back && this.threatened()) { if (s !== 'guard') this.setState('guard'); this.vx = 0; return; }
        if (s !== 'walk') this.setState('walk');
        this.vx = fwd * (back ? 2.9 : 3.7) * this.moveSpd();
      } else { if (s !== 'idle') this.setState('idle'); this.vx = 0; }
      return;
    }
    if (s === 'air' && !this.airAttackUsed) {
      if (this.buffer.lk) { this.buffer.lk = 0; this.startMove(NORMALS.jlk, 'jlk'); this.airAttackUsed = true; return; }
      if (this.buffer.lp) { this.buffer.lp = 0; this.startMove(NORMALS.jlp, 'jlp'); this.airAttackUsed = true; return; }
    }
    // cancel a connected normal into a special / super
    if (s === 'attack' && this.move && this.move.cancel && this.connected && this.mf >= this.move.startup && this.mf < this.move.startup + this.move.active + this.move.rec - 2) {
      this.tryButtons(inp, true);
    }
  }

  threatened() {
    const opp = this.opp;
    if (Math.abs(opp.x - this.x) < 300 && opp.state === 'attack') return true;
    return this.scene.projs.some(p => p.alive && p.owner !== this && !p.warn && Math.abs(p.x - this.x) < 330);
  }

  tryButtons(inp, cancelOnly) {
    const b = this.buffer, sp = this.specials;
    if (b.sp && this.meter >= SUPER_COST) { b.sp = 0; this.startSuper(); return true; }
    for (const k of ['s1', 's2', 's3']) {
      if (b[k]) {
        const mv = sp[k];
        if (mv.needsNoProj && this.hasProjectile()) { b[k] = 0; continue; }
        b[k] = 0; this.startMove(mv, k); this.meterAdd(5); return true;
      }
    }
    if (cancelOnly) return false;
    if (b.lk) { b.lk = 0; this.startMove(inp.d ? NORMALS.clk : NORMALS.lk, inp.d ? 'clk' : 'lk'); return true; }
    if (b.lp) { b.lp = 0; this.startMove(inp.d ? NORMALS.clp : NORMALS.lp, inp.d ? 'clp' : 'lp'); return true; }
    return false;
  }

  faceOpp() { const o = this.opp; if (Math.abs(o.x - this.x) > 2) this.dir = o.x > this.x ? 1 : -1; }

  startSuper() {
    this.meter -= SUPER_COST;
    this.stats.supers++;
    const sp = this.specials.sp;
    this.startMove(sp, 'sp');
    this.scene.superFlash(this, sp);
  }

  startMove(mv, slot) {
    this.move = mv; this.moveSlot = slot; this.mf = 0; this.hitsDone = 0; this.nextHitAt = 0; this.connected = false;
    this.diving = false;
    if (slot && slot[0] === 's') this.stats.specials[slot] = (this.stats.specials[slot] || 0) + 1;
    if (!mv.air) { this.vx = 0; }
    this.setState('attack');
    if (mv.name && !NORMALS_SET.has(mv)) this.scene.moveBanner(this, mv);
    if (mv.heal) this.hp = Math.min(this.maxHp, this.hp + mv.heal);
    if (mv.buff) { this.buffT = mv.buff.t; this.buffD = mv.buff; this.scene.fx.popText(this.x, this.y - this.H - 40, '秘技發動！', '#ffe14a'); }
    this.grab = null;
    SFX.swing();
  }

  // ------------------------------------------------------------ per-frame state update
  update() {
    if (this.freeze > 0) { this.freeze--; return; }
    this.sf++;
    if (this.buffT > 0) this.buffT--;
    if (this.slowT > 0) this.slowT--;
    if (this.dizzyImmune > 0) this.dizzyImmune--;
    if (this.bossRegen && this.scene.phase === 'fight') this.meterAdd(this.bossRegen);
    const s = this.state;
    if (s === 'held') {               // locked in a command grab
      const h = this.heldBy;
      if (!h || !h.grab || h.grab.v !== this || this.sf > 160) { this.heldBy = null; this.setState('fall'); this.vy = -6; this.vx = -this.dir * 3; this.y = FLOOR_Y - 1; return; }
      this.x = h.x + h.dir * 62 * (h.hScale + this.hScale) / 2; this.y = FLOOR_Y; this.vx = this.vy = 0; this.dir = -h.dir;
      return;
    }
    if (this.grab) { this.updateGrab(); return; }
    if (s === 'dizzy' && this.sf >= this.stun) { this.setState('idle'); this.combo = 0; return; }
    if (s === 'jumpsq' && this.sf >= 4) {
      this.vy = JUMP_VY; this.vx = this.jdir * JUMP_VX * (0.9 + 0.1 * this.moveSpd()); this.y -= 1;
      this.airAttackUsed = false; this.setState('air'); SFX.jump();
    } else if (s === 'hit' && this.sf >= this.stun) { this.setState(this.holdDown ? 'crouch' : 'idle'); this.combo = 0; }
    else if (s === 'block' && this.sf >= this.stun) { this.setState(this.holdDown ? 'crouch' : 'idle'); }
    else if (s === 'land' && this.sf >= (this.landLag || 3)) { this.setState('idle'); }
    else if (s === 'down' && this.sf >= 42) { this.setState('getup'); }
    else if (s === 'getup' && this.sf >= 14) { this.setState('idle'); this.combo = 0; }
    else if (s === 'attack') this.updateMove();
    if (this.actionable && this.combo) this.combo = 0;
    if ((s === 'hit' || s === 'block') ) this.vx *= 0.8;
  }

  // command grab: the holder plays the throw sequence, the victim is in 'held'
  startGrab(v) {
    const mv = this.move;
    this.grab = { v, t: 0, seq: mv.grabSeq, isSuper: this.moveSlot === 'sp' };
    v.move = null; v.grab = null; v.heldBy = this; v.setState('held'); v.combo = 0;
    this.vx = 0; this.connected = true;
    this.scene.fx.popText(v.x, v.y - v.H - 30, '捉住！', '#ffb84a');
    this.scene.hitstop = Math.max(this.scene.hitstop, 6); SFX.block();
  }
  updateGrab() {
    const g = this.grab, v = g.v;
    g.t++;
    this.vx = 0;
    for (const h of g.seq.hits) {
      if (h.at !== g.t || v.state !== 'held' || v.heldBy !== this || this.scene.phase !== 'fight') continue;
      const hd = { dmg: h.dmg, hitstun: 20, push: 6, launch: h.launch || -8, level: 'mid' };
      v.takeHit(this, hd, this.x, { ignoreInvuln: true, grab: true, kd: !!h.kd, isSuper: g.isSuper, hy: v.y - v.H * 0.6 });
      if (g.seq.fx) this.scene.fx.special({ type: 'grab_' + g.seq.fx }, v);
      this.scene.shake(h.kd ? 8 : 3, h.kd ? 7 : 3);
    }
    if (g.t >= g.seq.len || this.state !== 'attack') {
      this.grab = null; this.move = null;
      if (this.state === 'attack') this.setState('idle');
    }
  }

  updateMove() {
    const mv = this.move; if (!mv) { this.setState('idle'); return; }
    const f = this.mf++;
    if (mv.form && f === (mv.formAt || 8)) this.setForm(mv.form);
    if (mv.dash && f >= mv.dash.from && f <= mv.dash.to && f % 4 === 0) this.scene.fx.ghost(this);
    // dash
    if (mv.dash && f >= mv.dash.from && f <= mv.dash.to) this.vx = this.dir * mv.dash.vx;
    else if (mv.dash && f === mv.dash.to + 1) this.vx = 0;
    if (mv.rise && f === mv.rise.at) { this.vy = mv.rise.vy; this.vx = this.dir * mv.rise.vx; this.y -= 1; }
    if (mv.dive && f === mv.dive.at) { this.vy = mv.dive.vy; this.vx = this.dir * mv.dive.vx; this.diving = true; }
    if (mv.proj) for (const pd of mv.proj) if (pd.at === f) this.scene.spawnProj(this, pd);
    if (mv.fx) for (const fx of mv.fx) if (fx.at === f) this.scene.fx.special(fx, this);
    // end
    const total = mv.startup + mv.active + mv.rec;
    if (mv.air) {
      if (f > mv.startup + mv.active) { this.move = null; this.setState('air'); this.airAttackUsed = true; }
      return;
    }
    if ((mv.rise || mv.dive) && !this.grounded) return;          // stays in the move until landing
    if (f >= total) {
      this.move = null;
      if (!this.grounded) this.setState('air');
      else this.setState(this.inp && this.inp.d ? 'crouch' : 'idle');
    }
  }

  // landed from a rising / diving move: skip to recovery
  onLand() {
    const s = this.state;
    if (s === 'air') { this.setState('land'); this.landLag = 3; this.vx = 0; }
    else if (s === 'attack' && this.move) {
      if (this.move.air) { this.move = null; this.setState('land'); this.landLag = 4; this.vx = 0; }
      else if (this.grab) { /* throw continues */ }
      else if (this.move.rise || this.move.dive) {
        const rec = this.move.rec; this.move = null; this.setState('land'); this.landLag = rec; this.vx = 0;
      }
    } else if (s === 'fall') {
      this.vx = 0; this.vy = 0;
      if (this.ko) { this.setState('kodown'); }
      else { this.setState('down'); }
      this.scene.fx.dust(this.x, FLOOR_Y); this.scene.shake(5, 6); SFX.hurt();
    } else if (s === 'jumpsq' || s === 'hit' || s === 'block') { /* ok */ }
    else if (s === 'win' || s === 'lose') this.vx = 0;
  }

  // ------------------------------------------------------------ boxes
  hurtbox() {
    const s = this.state;
    if (s === 'down' || s === 'getup' || s === 'kodown' || this.ko) return null;
    if (this.grab) return null;              // throws are not interruptible
    if (s === 'fall' && this.sf > 2 && this.juggled > 1) return null;
    if (s === 'attack' && this.move && this.move.invuln && this.mf >= this.move.invuln[0] && this.mf <= this.move.invuln[1]) return null;
    if (s === 'intro' || s === 'win') return null;
    const crouch = s === 'crouch' || (s === 'guard' && this.holdDown) || (s === 'attack' && this.move && this.move.crouch) || (s === 'block' && this.blockLow) || (s === 'hit' && this.hitLow);
    const h = crouch ? this.H * 0.62 : (this.grounded ? this.H : this.H * 0.82);
    const w = 34 * this.hScale;
    const yb = this.grounded ? this.y : this.y - 20;
    return { x1: this.x - w, x2: this.x + w, y1: yb - h, y2: yb };
  }

  attackBox() {
    const mv = this.move;
    if (this.state !== 'attack' || !mv || !mv.box) return null;
    const from = mv.activeFrom != null ? mv.activeFrom : mv.startup;
    const f = this.mf;
    if (f < from || (f >= from + mv.active && !mv.endOnLand)) return null;
    if (mv.endOnLand && f >= from + mv.active) return null;
    if (this.hitsDone >= (mv.hits || 1) || f < this.nextHitAt) return null;
    const isNormal = NORMALS_SET.has(mv);
    const reach = isNormal ? this.def.reach * this.hScale : 1;
    const b = mv.box, sc = isNormal ? this.hScale : 1;
    const x1 = this.x + this.dir * b.x * sc, x2 = this.x + this.dir * (b.x + b.w * reach);
    return { x1: Math.min(x1, x2), x2: Math.max(x1, x2), y1: this.y - b.y * sc, y2: this.y - b.y * sc + b.h * sc };
  }

  inCounterWindow() {
    const mv = this.move;
    return this.state === 'attack' && mv && mv.counter && this.mf >= mv.startup && this.mf < mv.startup + mv.active;
  }

  meterAdd(v) { this.meter = clamp(this.meter + v, 0, METER_MAX); }

  // ------------------------------------------------------------ being hit
  // returns 'miss' | 'block' | 'hit' | 'countered'
  takeHit(att, hd, srcX, opts = {}) {
    if (this.ko) return 'miss';
    if (this.state === 'held' && !opts.grab) return 'miss';
    if (!opts.ignoreInvuln && !this.hurtbox()) return 'miss';
    if (!opts.grab && this.inCounterWindow()) {
      this.faceOpp();
      this.startMove(this.move.counter, 'counter');
      this.scene.fx.popText(this.x, this.y - this.H - 30, '看破！', '#9cf0ff');
      this.scene.hitstop = 10; SFX.parry();
      return 'countered';
    }
    const fromRight = srcX > this.x;
    const away = fromRight ? -1 : 1;
    const level = hd.level || 'mid';
    const holdingBack = fromRight ? (this.inp && this.inp.l && !this.inp.r) : (this.inp && this.inp.r && !this.inp.l);
    const canBlock = this.grounded && (this.actionable || this.state === 'block') && holdingBack;
    const low = !!this.holdDown;
    const blockOk = !opts.grab && !hd.unblockable && canBlock && (level === 'mid' || (level === 'low' && low) || (level === 'overhead' && !low));
    const special = !NORMALS_SET.has(hd);
    const isSuper = !!opts.isSuper;
    if (blockOk) {
      const chip = special ? Math.round(hd.dmg * (hd.chip != null ? hd.chip : 0.18)) : 0;
      this.hp = Math.max(this.scene.allowChipKO ? 0 : 1, this.hp - chip);
      this.blockLow = low;
      this.setState('block'); this.stun = hd.blockstun || Math.round((hd.hitstun || 16) * 0.75);
      if (hd.guardBreak) { this.stun = 46; this.scene.fx.popText(this.x, this.y - this.H - 30, '破防！', '#ff9a3a'); SFX.bang(); }
      this.vx = away * (hd.push || 7) * 0.85;
      this.stats.blocks++;
      att.meterAdd(hd.dmg * 0.06); this.meterAdd(hd.dmg * 0.04);
      this.scene.hitstop = Math.max(this.scene.hitstop, 6);
      this.scene.fx.blockSpark(this.x - away * 30, this.y - this.H * (low ? 0.4 : 0.65));
      SFX.block();
      this.cornerPush(att, hd, opts.proj);
      if (this.hp <= 0) this.koNow(att);
      return 'block';
    }
    // hit
    const attBuff = att.buffT > 0 && att.buffD ? (att.buffD.dmg || 1) : 1;
    if (this.buffT > 0 && this.buffD && this.buffD.armor && !isSuper && !opts.grab && !opts.kd && this.hp > 1) {   // armor: take reduced damage, keep acting
      const ad = Math.round(hd.dmg * 0.6 * (att.dmgMul || 1) * this.dmgTakenMul * this.formTaken * attBuff * (NORMALS_SET.has(hd) ? att.mel : 1));
      this.hp = Math.max(0, this.hp - ad); this.flash = 2; att.meterAdd(ad * 0.1);
      this.scene.hitstop = Math.max(this.scene.hitstop, 5);
      this.scene.fx.blockSpark(this.x - away * 26, this.y - this.H * 0.6); SFX.block();
      if (this.hp <= 0) this.koNow(att);
      return 'hit';
    }
    this.combo++;
    const scale = this.combo <= 2 ? 1 : Math.max(0.4, 1 - 0.1 * (this.combo - 2));
    let dmg = Math.round(hd.dmg * scale * (att.dmgMul || 1) * this.dmgTakenMul * this.formTaken * attBuff * (NORMALS_SET.has(hd) ? att.mel : 1));
    if (opts.finisher) dmg = Math.round(dmg * opts.finisher);
    this.hp = Math.max(0, this.hp - dmg);
    this.comboDmg = (this.combo === 1 ? 0 : this.comboDmg) + dmg;
    att.stats.hits++;
    att.meterAdd(dmg * 0.16); this.meterAdd(dmg * 0.1);
    this.flash = 3;
    this.hitLow = this.holdDown && this.grounded;
    const heavy = dmg >= 90 || !!opts.kd;
    this.scene.hitstop = Math.max(this.scene.hitstop, isSuper ? 10 : heavy ? 11 : 7);
    this.scene.fx.hitSpark(this.x - away * 26, opts.hy || (this.y - this.H * 0.62), heavy);
    if (heavy) this.scene.shake(heavy ? 6 : 3, 4);
    SFX.hit(heavy);
    if (this.move && this.state === 'attack') this.move = null;
    this.grab = null;
    if (hd.popText) this.scene.fx.popText(this.x, this.y - this.H - 40, hd.popText, '#ffe14a');
    const launch = !!opts.kd || (!this.grounded && !opts.grab) || this.hp <= 0;
    if (launch) {
      this.setState('fall');
      this.juggled = (this.juggled || 0) + 1;
      this.vy = hd.launch || -7.5; this.vx = away * 3.6; this.y = Math.min(this.y, FLOOR_Y - 1);
    } else if (opts.grab) {
      this.juggled = 0; this.vx = 0;           // stay held for the rest of the throw
    } else if (hd.dizzy && !(this.dizzyImmune > 0)) {
      this.juggled = 0;
      this.setState('dizzy'); this.stun = hd.dizzy; this.dizzyImmune = 300; this.vx = away * 3;
      this.scene.fx.popText(this.x, this.y - this.H - 70, '暈咗！', '#ffe14a');
    } else {
      this.juggled = 0;
      this.setState('hit'); this.stun = hd.hitstun || 16;
      this.vx = away * (hd.push || 7);
    }
    if (hd.freezeTint) { this.freezeTint = hd.freezeTint; this.freezeTintT = hd.hitstun || 60; }
    this.cornerPush(att, hd, opts.proj);
    if (this.combo >= 2) this.scene.comboText(att, this.combo, this.comboDmg);
    if (this.hp <= 0) this.koNow(att);
    return 'hit';
  }

  cornerPush(att, hd, isProj) {
    if (isProj) return;
    const atWall = this.x <= WALL_PAD + 4 || this.x >= STAGE_W - WALL_PAD - 4 || Math.abs(this.x - att.x) >= MAX_SEP - 4;
    if (atWall && att.grounded) att.pushV = -att.dir * (hd.push || 7) * 0.7;
  }

  koNow(att) {
    if (this.ko) return;
    if (this.noKO) { this.hp = 1; return; }
    this.ko = true; this.hp = 0;
    if (this.state !== 'fall') { this.setState('fall'); this.vy = -8; this.vx = (this.x < att.x ? -1 : 1) * 4; this.y = Math.min(this.y, FLOOR_Y - 1); }
    this.scene.onKO(this, att);
  }

  // ------------------------------------------------------------ movement / physics
  physics() {
    if (this.freeze > 0) return;
    if (this.pushV) { this.x += this.pushV; this.pushV *= 0.75; if (Math.abs(this.pushV) < 0.3) this.pushV = 0; }
    const air = !this.grounded || this.vy < 0;
    if (air) {
      this.vy += GRAV;
      this.y += this.vy;
      this.x += this.vx;
      if (this.y >= FLOOR_Y) { this.y = FLOOR_Y; this.vy = 0; this.onLand(); }
    } else {
      this.x += this.vx;
    }
    if (this.freezeTintT > 0) this.freezeTintT--;
  }

  // ------------------------------------------------------------ view
  render(tick) {
    const s = this.state, mv = this.move;
    let pose = 'idle', angle = 0, sy = 1, ox = 0;
    switch (s) {
      case 'idle': pose = 'idle'; sy = 1 + 0.012 * Math.sin(tick / 9 + this.side); break;
      case 'walk': pose = (Math.floor(this.sf / 9) % 2) ? 'walk2' : 'walk1'; break;
      case 'crouch': pose = 'crouch'; break;
      case 'guard': pose = this.holdDown ? 'cblock' : 'block'; break;
      case 'block': pose = this.blockLow ? 'cblock' : 'block'; ox = (this.sf % 4 < 2 ? -2 : 2) * (this.sf < 6 ? 1 : 0); break;
      case 'jumpsq': pose = 'crouch'; break;
      case 'land': pose = 'crouch'; break;
      case 'air': pose = 'jump'; break;
      case 'hit': pose = 'hurt'; ox = (this.sf < 8 ? (this.sf % 4 < 2 ? -3 : 3) : 0); break;
      case 'fall': pose = 'hurt'; angle = -this.dir * Math.min(70, this.sf * 4); break;
      case 'down': case 'kodown': pose = 'down'; break;
      case 'getup': pose = 'crouch'; break;
      case 'win': pose = 'win'; break;
      case 'lose': pose = 'hurt'; break;
      case 'held': pose = 'hurt'; ox = (tick % 6 < 3 ? -2 : 2); angle = -this.dir * 8; break;
      case 'dizzy': pose = 'hurt'; angle = Math.sin(tick / 6) * 7; break;
      case 'intro': pose = this.sf < 50 ? (this.scene.textures.exists(`${this.style}_shout`) ? 'shout' : 'win') : 'idle'; break;
      case 'attack': {
        if (!mv) break;
        if (this.grab) { pose = this.grab.seq.pose || 'shoot'; if (this.grab.t % 14 < 7) ox = this.dir * 4; break; }
        if (this.moveSlot === 'counter') { pose = mv.pose || 'kick'; break; }
        const pre = this.mf < (mv.startup || 0);
        pose = mv.pose || 'punch';
        if (mv.dive && this.diving) { pose = mv.dive.pose || pose; angle = this.dir * (mv.dive.angle || 0); }
        else if (mv.angle && !pre) angle = this.dir * mv.angle;
        if (pre && NORMALS_SET.has(mv)) pose = mv.crouch ? 'crouch' : (mv.air ? 'jump' : 'idle');
        if (mv.finisherPose && this.hitsDone >= (mv.hits || 1) - 1) pose = mv.finisherPose;
        if (mv.dash && this.moveSlot === 'sp' && pose === 'walk1') pose = (Math.floor(this.mf / 4) % 2) ? 'walk2' : 'walk1';
        break;
      }
    }
    if (pose !== this.pose) { this.sprite.setTexture(this.texFor(pose)); this.pose = pose; }
    if (this.dir === -1) angle = angle; // angle already mirrored by dir
    this.sprite.setFlipX(this.dir === -1);
    const shk = this.scene.hitstop > 0 && (s === 'hit' || s === 'fall' || s === 'block') ? ((tick % 2) ? 3 : -3) : 0;
    this.sprite.setPosition(this.x + ox + shk, this.y);
    this.sprite.setAngle(angle);
    this.sprite.setScale(this.scale * (this.dir === -1 ? 1 : 1), this.scale * sy);
    if (this.flash > 0) { this.flash--; this.sprite.setTintFill(0xffffff); }
    else if (this.freezeTintT > 0) this.sprite.setTint(this.freezeTint);
    else if (this.superGlow > 0) { this.superGlow--; this.sprite.setTint((tick % 6 < 3) ? 0xfff0a0 : 0xffffff); }
    else if (this.buffT > 0) this.sprite.setTint((tick % 10 < 5) ? 0xfff27a : 0xffffff);
    else if (this.slowT > 0) this.sprite.setTint(0xb8a8ff);
    else if (this.altTint) this.sprite.setTint(this.altTint);
    else this.sprite.clearTint();
    if (s === 'dizzy') {
      if (!this.stars) this.stars = this.scene.add.text(0, 0, '★ ☆ ★', { fontFamily: FONT_TC, fontSize: '26px', color: '#ffe14a', stroke: '#402000', strokeThickness: 4 }).setOrigin(0.5).setDepth(30);
      this.stars.setVisible(true).setPosition(this.x + Math.sin(tick / 5) * 12, this.y - this.H - 20);
    } else if (this.stars) this.stars.setVisible(false);
    const hgt = clamp((FLOOR_Y - this.y) / 220, 0, 0.6);
    this.shadow.setPosition(this.x, FLOOR_Y + 2).setScale(1 - hgt, 1 - hgt);
    if (this.standImg) {
      this.standImg.setPosition(this.x - this.dir * 70, this.y - 30 + 6 * Math.sin(tick / 14)).setFlipX(this.dir === -1);
      this.standImg.setAlpha(s === 'attack' && this.moveSlot && this.moveSlot[0] === 's' ? 0.85 : 0.45);
      this.standImg.setVisible(!['down', 'kodown', 'fall'].includes(s));
    }
  }

  destroy() { [this.sprite, this.shadow, this.standImg, this.stars].forEach(o => o && o.destroy()); }
}
const NORMALS_SET = new Set(Object.values(NORMALS));

// ============================================================ Projectile
class Projectile {
  constructor(scene, owner, d, opts = {}) {
    this.scene = scene; this.owner = owner; this.d = d;
    this.kind = d.kind || 'straight';
    this.dir = owner.dir; this.age = 0; this.alive = true;
    this.hitsLeft = d.hits || 1; this.nextHit = 0;
    this.dur = d.dur || 1; this.clashCd = 0;
    this.isSuper = !!opts.isSuper; this.isFollowup = !!opts.followup;
    if (d.texChoices) this.tex = d.texChoices[Math.floor(Math.random() * d.texChoices.length)];
    if (d.textChoices) this.text = d.textChoices[Math.floor(Math.random() * d.textChoices.length)];
    const opp = owner.opp;
    const bodyY = owner.y - (d.y != null ? d.y : owner.H * (d.yr != null ? d.yr : 0.6));
    if (this.kind === 'rain') {
      this.x = clamp((opts.atX != null ? opts.atX : opp.x) + (d.dx || 0) * this.dir, 40, STAGE_W - 40); this.y = -60;
      this.warn = d.delay || 0; this.vy = d.vy || 12; this.vx = 0;
    } else if (this.kind === 'pillar') {
      this.x = clamp(opts.atX != null ? opts.atX : opp.x, 40, STAGE_W - 40); this.y = FLOOR_Y; this.warn = d.delay || 0; this.vx = 0; this.vy = 0;
    } else if (this.kind === 'puddle') {
      for (const q of scene.projs) if (q.alive && q.owner === owner && q.kind === 'puddle') q.die(true);   // one puddle each
      this.x = clamp(owner.x + this.dir * (d.dx || 200), 60, STAGE_W - 60); this.y = FLOOR_Y; this.vx = 0; this.vy = 0; this.warn = 0;
    } else if (this.kind === 'wave') {
      this.x = owner.x + this.dir * 60; this.y = VIEW_H / 2; this.vx = this.dir * d.speed; this.vy = 0; this.warn = 0;
    } else {
      this.x = owner.x + this.dir * (d.x != null ? d.x : 55); this.y = bodyY;
      this.vx = this.dir * (d.speed || 10); this.vy = d.vy || 0; this.warn = 0;
    }
    this.baseY = this.y; this.bounces = d.bounces || 0;
    this.makeView();
  }

  makeView() {
    const d = this.d, sc = this.scene;
    if (this.kind === 'puddle') {
      this.view = sc.add.image(this.x, FLOOR_Y + 4, 'puddle').setDisplaySize(d.w || 150, 30).setDepth(2).setAlpha(0);
      return;
    }
    const text = this.text || d.text;
    if (text) {
      this.view = sc.add.text(this.x, this.y, text, { fontFamily: FONT_BIG, fontSize: (d.size || 36) + 'px', fontStyle: 'bold',
        color: d.textColor || '#ffffff', stroke: d.textStroke || '#000000', strokeThickness: 6 }).setOrigin(0.5);
    } else {
      const tex = this.tex || d.tex;
      this.view = sc.add.image(this.x, this.y, sc.textures.exists(tex) ? tex : 'spark').setScale(d.scale || 1);
      if (d.tint) this.view.setTint(d.tint);
      if (this.dir === -1) this.view.setFlipX(true);
    }
    this.view.setDepth(this.kind === 'wave' ? 30 : 20);
    if (d.glow && this.view.setShadow) this.view.setShadow(0, 0, d.textStroke || '#ff0080', 16, true, true);
    if (this.kind === 'pillar') { this.view.setOrigin(0.5, 1).setAlpha(0); if (d.tex === 'fx_palm') this.view.setOrigin(0.5, 1); }
    if (this.warn > 0) {
      this.warnView = sc.add.ellipse(this.x, FLOOR_Y + 2, (d.w || 60) * 1.1, 16, 0xffe14a, 0.35).setDepth(8);
      if (this.kind === 'rain') this.view.setVisible(false);
    }
  }

  box() {
    const d = this.d;
    if (this.warn > 0 || this.spent || this.kind === 'puddle') return null;
    if (this.kind === 'pillar') return { x1: this.x - d.w / 2, x2: this.x + d.w / 2, y1: FLOOR_Y - d.h, y2: FLOOR_Y };
    if (this.kind === 'wave') return { x1: this.x - d.w / 2, x2: this.x + d.w / 2, y1: 0, y2: VIEW_H };
    const w = d.w || 30, h = d.h || 30;
    return { x1: this.x - w / 2, x2: this.x + w / 2, y1: this.y - h / 2, y2: this.y + h / 2 };
  }

  step() {
    if (!this.alive) return;
    this.age++;
    if (this.clashCd > 0) this.clashCd--;
    const d = this.d;
    if (this.warn > 0) {
      this.warn--;
      if (this.warnView) this.warnView.setAlpha(0.2 + 0.3 * ((this.age % 8) < 4 ? 1 : 0));
      if (this.warn === 0) {
        if (this.warnView) { this.warnView.destroy(); this.warnView = null; }
        if (this.kind === 'rain') this.view.setVisible(true);
        if (this.kind === 'pillar') { this.age = 0; this.scene.shake(6, 8); SFX.boom(); }
      }
      return;
    }
    if (this.kind === 'pillar') {
      if (this.age > (d.life || 15)) return this.die();
      return;
    }
    if (this.kind === 'puddle') {                 // ink puddle: slows the opponent standing in it
      if (this.age > (d.life || 300)) return this.die(true);
      const o = this.owner.opp;
      if (o && o.grounded && Math.abs(o.x - this.x) < (d.w || 150) / 2) { o.slowT = 3; o.slowMul = d.slow || 0.5; }
      return;
    }
    if (this.kind === 'rain') {
      this.y += this.vy;
      if (this.y >= FLOOR_Y - 10) { this.scene.fx.dust(this.x, FLOOR_Y); return this.die(); }
      return;
    }
    if (d.returns && this.age === d.returns) { this.vx = -this.vx; this.returning = true; this.nextHit = 0; }
    if (this.returning && Math.abs(this.x - this.owner.x) < 40) return this.die();
    this.x += this.vx;
    if (d.grav) this.vy += d.grav;
    this.y += this.vy;
    if (d.wobble) this.y = this.baseY + Math.sin(this.age / 5) * 18;
    if (d.bob) this.y = this.baseY - Math.abs(Math.sin(this.age / 4)) * 8;
    if (d.ceiling != null && this.y < d.ceiling && this.vy < 0) { this.vy = -this.vy; SFX.tick(); }
    if (d.ceiling != null && this.y > FLOOR_Y - 20 && this.vy > 0) { this.vy = -Math.abs(this.vy) * 0.9; SFX.tick(); }
    if (this.bounces > 0 && (this.x < 30 || this.x > STAGE_W - 30)) { this.vx = -this.vx; this.bounces--; this.dir = -this.dir; SFX.tick(); }
    if (d.explode && this.y >= FLOOR_Y - 12 && this.vy > 0) return this.explode();
    if (d.trail && this.age % 6 === 0) this.scene.fx.trail(this.x - this.vx * 2, this.y, d.trail);
    const cam = this.scene.cameras.main;
    const margin = 140;
    if (this.x < cam.scrollX - margin || this.x > cam.scrollX + VIEW_W + margin || this.x < -100 || this.x > STAGE_W + 100) return this.die(true);
    if (this.age > (d.life || 200)) return this.die();
  }

  explode() {
    const d = this.d;
    this.scene.fx.boom(this.x, FLOOR_Y - 40);
    this.scene.shake(6, 6); SFX.boom();
    // the blast is a short stationary hitbox (shares the remaining hits)
    if (this.hitsLeft > 0) {
      const blast = { kind: 'pillar', w: d.explode.w, h: d.explode.h, dmg: d.dmg, kd: d.kd, life: 8, dur: 1, hitstun: d.hitstun, chip: d.chip };
      const p = new Projectile(this.scene, this.owner, blast, { atX: this.x, isSuper: this.isSuper, followup: true });
      p.view.setVisible(false);
      this.scene.projs.push(p);
    }
    this.die();
  }

  render() {
    if (!this.alive || !this.view) return;
    const d = this.d;
    if (this.kind === 'puddle') { const life = d.life || 300; this.view.setAlpha(this.age < 10 ? this.age / 10 * 0.9 : this.age > life - 30 ? 0.9 * (life - this.age) / 30 : 0.9); return; }
    this.view.setPosition(this.x, this.kind === 'pillar' ? FLOOR_Y : this.y);
    if (d.spin) this.view.angle += d.spin * (this.vx < 0 ? -1 : 1);
    if (d.pulse) { const s = (d.scale || 1) * (1 + 0.08 * Math.sin(this.age / 3)); this.view.setScale(s); }
    if (this.kind === 'pillar' && this.warn === 0) {
      const life = d.life || 15;
      if (d.tex === 'fx_palm') { // palm slams down from the sky
        const t = clamp(this.age / 6, 0, 1);
        this.view.setAlpha(1).setY(FLOOR_Y - (1 - t) * 300);
      } else this.view.setAlpha(this.age < life - 5 ? 1 : Math.max(0, (life - this.age) / 5));
    }
  }

  die(silent) {
    if (!this.alive) return;
    this.alive = false;
    if (!silent && this.kind !== 'pillar') this.scene.fx.puff(this.x, this.y);
    if (this.view) { this.view.destroy(); this.view = null; }
    if (this.warnView) { this.warnView.destroy(); this.warnView = null; }
  }
}

// ============================================================ Fx — frame-stepped visual effects
class FxSystem {
  constructor(scene) { this.scene = scene; this.list = []; }
  add(obj, life, upd) {
    this.list.push({ obj, life, max: life, upd });
    if (this.list.length > 160) { const o = this.list.shift(); try { o.obj.destroy(); } catch (e) { /* */ } }
    return obj;
  }
  step() {
    for (let i = this.list.length - 1; i >= 0; i--) {
      const e = this.list[i];
      e.life--;
      try { if (e.upd) e.upd(e.obj, 1 - e.life / e.max, e); } catch (err) { e.life = 0; }
      if (e.life <= 0) { try { e.obj.destroy(); } catch (err) { /* */ } this.list.splice(i, 1); }
    }
  }
  clear() { for (const e of this.list) { try { e.obj.destroy(); } catch (err) { /* */ } } this.list = []; }

  hitSpark(x, y, big) {
    const s = this.scene.add.image(x, y, 'spark').setDepth(40).setScale(big ? 3.2 : 2.2).setBlendMode(Phaser.BlendModes.ADD);
    s.angle = Math.random() * 90;
    this.add(s, 12, (o, t) => { o.setScale((big ? 3.2 : 2.2) * (1 + t * 0.8)); o.setAlpha(1 - t); });
  }
  blockSpark(x, y) {
    const s = this.scene.add.image(x, y, 'ring').setDepth(40).setScale(0.6).setTint(0x9cf0ff).setBlendMode(Phaser.BlendModes.ADD);
    this.add(s, 10, (o, t) => { o.setScale(0.6 + t * 1.2); o.setAlpha(1 - t); });
  }
  puff(x, y) {
    const s = this.scene.add.image(x, y, 'spark').setDepth(25).setScale(1.6).setTint(0xffffff);
    this.add(s, 10, (o, t) => { o.setScale(1.6 + t * 2); o.setAlpha(1 - t); });
  }
  boom(x, y) {
    const k = this.scene.textures.exists('fx_boom') ? 'fx_boom' : 'spark';
    const s = this.scene.add.image(x, y, k).setDepth(26).setScale(0.6);
    this.add(s, 18, (o, t) => { o.setScale(0.6 + t * 0.5); o.setAlpha(1 - t * t); });
  }
  dust(x, y) {
    for (let i = -1; i <= 1; i += 2) {
      const s = this.scene.add.ellipse(x, y - 6, 40, 16, 0xd8c8a8, 0.7).setDepth(9);
      this.add(s, 16, (o, t) => { o.x = x + i * t * 50; o.setScale(1 + t); o.setAlpha(0.7 * (1 - t)); });
    }
  }
  trail(x, y, kind) {
    const t = this.scene.add.text(x, y, kind === 'note' ? (Math.random() < 0.5 ? '♪' : '♫') : '·', { fontFamily: FONT_TC, fontSize: '22px', color: '#ffe14a', stroke: '#402000', strokeThickness: 3 }).setOrigin(0.5).setDepth(19);
    this.add(t, 20, (o, p) => { o.y = y - p * 30; o.setAlpha(1 - p); });
  }
  popText(x, y, text, color) {
    const t = this.scene.add.text(x, y, text, { fontFamily: FONT_BIG, fontSize: '30px', fontStyle: 'bold', color: color || '#fff', stroke: '#000', strokeThickness: 6 }).setOrigin(0.5).setDepth(60);
    this.add(t, 40, (o, p) => { o.y = y - p * 40; o.setAlpha(p > 0.7 ? (1 - p) / 0.3 : 1); });
  }
  summon(key, x, y, flip, life = 50, scale = 0.62) {
    if (!this.scene.textures.exists(key)) return;
    const s = this.scene.add.image(x, y, key).setOrigin(0.5, 1).setScale(scale).setFlipX(flip).setDepth(9.6).setAlpha(0);
    this.add(s, life, (o, t) => o.setAlpha(t < 0.15 ? t / 0.15 : t > 0.8 ? (1 - t) / 0.2 : 1));
  }
  flash(color, frames = 8, alpha = 0.7) {
    const r = this.scene.add.rectangle(VIEW_W / 2, VIEW_H / 2, VIEW_W, VIEW_H, color, alpha).setScrollFactor(0).setDepth(70);
    this.add(r, frames, (o, t) => o.setAlpha(alpha * (1 - t)));
  }
  ghost(f) {          // step-printing afterimage (Wong Kar-wai smear)
    if (!f.sprite || !f.sprite.texture) return;
    const g = this.scene.add.image(f.x, f.y, f.sprite.texture.key).setOrigin(f.sprite.originX, f.sprite.originY).setScale(f.scale).setFlipX(f.dir === -1)
      .setAngle(f.sprite.angle).setTint(0x40e0c0).setAlpha(0.45).setDepth(9.7).setBlendMode(Phaser.BlendModes.ADD);
    this.add(g, 14, (o, t) => o.setAlpha(0.45 * (1 - t)));
  }
  // move-specific flourishes (cosmetic only)
  special(fx, f) {
    const sc = this.scene, flip = f.dir === -1;
    switch (fx.type) {
      case 'screening': {
        this.flash(0x30405c, 12, 0.4);
        this.popText(f.x, f.y - f.H - 36, '好景不散', '#ffcf8b');
        this.summon('fx_mosaic', f.x + f.dir * 95, FLOOR_Y - 30, flip, 58, 1.1);
        this.summon('fx_projector', f.x - f.dir * 80, FLOOR_Y, flip, 70, 0.8);
        break;
      }
      case 'eightbeat': {
        this.popText(f.x, f.y - f.H - 36, '一・二・三・四，再行落去', '#69e7d7');
        for (let i = 0; i < 5; i++) {
          const ghost = sc.add.image(f.x - f.dir * (i + 1) * 28, f.y, 'mkgirl_kick').setOrigin(f.sprite.originX, f.sprite.originY).setScale(f.scale).setFlipX(flip).setTint(0x69e7d7).setAlpha(0.4).setDepth(9.7);
          this.add(ghost, 35 + i * 3, (o, t) => { o.setAlpha(0.4 * (1 - t)); });
        }
        break;
      }
      case 'birds': for (let i = 0; i < 7; i++) {
        if (!sc.textures.exists('fx_bird')) break;
        const b = sc.add.image(f.x + (Math.random() * 2 - 1) * 60, f.y - 40, 'fx_bird').setScale(0.35 + Math.random() * 0.2).setDepth(24).setFlipX(flip);
        const vx = (Math.random() * 2 - 1) * 3 + f.dir * 2, vy = -5 - Math.random() * 4;
        this.add(b, 70, (o, t) => { o.x += vx; o.y += vy; o.setAlpha(1 - t); o.setScale(o.scaleX * 0.995); });
      } SFX.sing(); break;
      case 'jacket': {
        const j = sc.add.rectangle(f.x, f.y - f.H * 0.6, 60, 70, 0xf0e6c8).setDepth(23);
        const vx = -f.dir * 4;
        this.add(j, 50, (o, t) => { o.x += vx; o.y += -4 + t * 12; o.angle += 9; o.setAlpha(1 - t); });
        SFX.swing(); break;
      }
      case 'code': {
        const seq = ['↑', '↑', '↓', '↓', '←', '→', '←', '→', 'B', 'A'];
        seq.forEach((ch, i) => { const t = sc.add.text(f.x - 135 + i * 30, f.y - f.H - 50, ch, { fontFamily: FONT_BIG, fontSize: '26px', color: '#7aff9a', stroke: '#002010', strokeThickness: 5 }).setOrigin(0.5).setDepth(60).setAlpha(0);
          this.add(t, 60, (o, p) => { o.setAlpha(p * 60 > i * 3 ? (p > 0.8 ? (1 - p) / 0.2 : 1) : 0); o.y = f.y - f.H - 50 - p * 10; }); });
        SFX.join(); break;
      }
      case 'coinfx': for (let i = 0; i < 12; i++) {
        const c = sc.add.image(f.x, f.y - f.H * 0.7, 'coin').setDepth(22);
        const vx = (Math.random() * 2 - 1) * 6, vy = -7 - Math.random() * 5;
        this.add(c, 40, (o, t) => { o.x += vx; o.y += vy + t * 20; o.angle += 20; o.setAlpha(1 - t); });
      } SFX.coin && SFX.coin(); break;
      case 'team': this.summon('fx_foot1', f.x - f.dir * 90, FLOOR_Y, flip, 80, 0.75); this.summon('fx_foot2', f.x - f.dir * 170, FLOOR_Y, flip, 80, 0.72); break;
      case 'grab_gold': this.hitSpark(f.x, f.y - f.H * 0.6, true); this.popText(f.x, f.y - f.H - 30, '斬！', '#ffd84a'); break;
      case 'grab_fire': for (let i = 0; i < 4; i++) {
        const fl = sc.add.image(f.x + (Math.random() * 2 - 1) * 40, f.y - Math.random() * f.H, 'fire').setDepth(24).setBlendMode(Phaser.BlendModes.ADD);
        this.add(fl, 24, (o, t) => { o.y -= 2; o.setScale(1 + t); o.setAlpha(1 - t); });
      } SFX.boom(); break;
      case 'flash': this.flash(fx.color || 0xffffff, 10, 0.75); SFX.flash(); break;
      case 'summon': this.summon(fx.key, f.x + f.dir * (fx.dx || -80), FLOOR_Y, flip, fx.life || 50); break;
      case 'idols': for (let i = 0; i < 4; i++) this.summon('fx_idol' + i, f.x - f.dir * (60 + i * 42), FLOOR_Y, flip, 70, 0.55); SFX.sing(); break;
      case 'squad': for (let i = 0; i < 3; i++) this.summon('fx_squad' + i, f.x - f.dir * (70 + i * 70), FLOOR_Y, flip, 75, 0.7); SFX.gunBurst(); break;
      case 'zap': for (let i = 0; i < 6; i++) {
        const b = sc.add.image(f.x + f.dir * (40 + Math.random() * 80), f.y - 60 - Math.random() * 140, 'bolt').setDepth(22).setScale(1 + Math.random()).setBlendMode(Phaser.BlendModes.ADD);
        this.add(b, 14 + i * 2, (o, t) => { o.setAlpha((Math.floor(t * 10) % 2) ? 0.3 : 1); });
      } SFX.zap(); break;
      case 'rings': for (let i = 0; i < 3; i++) {
        const r = sc.add.image(f.x + f.dir * 50, f.y - f.H * 0.6, 'ring').setDepth(22).setTint(0xff7ad0).setBlendMode(Phaser.BlendModes.ADD);
        this.add(r, 16 + i * 4, (o, t) => { o.x = f.x + f.dir * (50 + t * 140); o.setScale(1 + t * 2.4); o.setAlpha(1 - t); });
      } SFX.sonic(); break;
      case 'cans': for (let i = 0; i < 4; i++) {
        const c = sc.add.image(f.x, f.y - 120, 'it_vitasoy').setDepth(22).setScale(0.35);
        const vx = (Math.random() * 2 - 1) * 4, vy = -6 - Math.random() * 4;
        this.add(c, 30, (o, t, e) => { o.x += vx; o.y += vy + t * 14; o.angle += 18; o.setAlpha(1 - t); });
      } break;
      case 'mop': {
        const m = sc.add.image(f.x, f.y - 110, 'it_mop').setDepth(11).setScale(0.6);
        this.add(m, 44, (o) => { o.x = f.x + f.dir * 70; o.y = f.y - 110; o.angle += 24 * f.dir; });
        break;
      }
      case 'petals': for (let i = 0; i < 14; i++) {
        const p = sc.add.ellipse(sc.cameras.main.scrollX + Math.random() * VIEW_W, -10 - Math.random() * 100, 9, 6, 0xffb8d8).setDepth(65);
        const vx = -1 - Math.random(), vy = 2 + Math.random() * 2;
        this.add(p, 90, (o) => { o.x += vx; o.y += vy; o.angle += 6; });
      } break;
      case 'afterimage': {
        for (let i = 0; i < 6; i++) {
          const ghost = sc.add.image(f.x, f.y, f.sprite.texture.key).setOrigin(f.sprite.originX, f.sprite.originY).setScale(f.scale).setFlipX(flip).setTint(0x7aff9a).setAlpha(0).setDepth(9.8);
          this.add(ghost, 40, (o, t) => { const lag = (i + 1) * 3; o.setTexture(f.sprite.texture.key); o.x = f.x - f.dir * lag * 9; o.y = f.y; o.setAlpha(0.35 * (1 - t)); });
        }
        break;
      }
      case 'cheer': this.popText(f.x, f.y - f.H - 40, fx.text, '#ffd84a'); break;
      case 'noteRain': for (let i = 0; i < 16; i++) {
        const n = sc.add.text(sc.cameras.main.scrollX + Math.random() * VIEW_W, -20 - Math.random() * 200, Math.random() < 0.5 ? '♪' : '♫',
          { fontFamily: FONT_TC, fontSize: '34px', color: ['#ffe14a', '#9cf0ff', '#ff9ad8'][i % 3], stroke: '#200040', strokeThickness: 4 }).setDepth(65);
        this.add(n, 80, (o) => { o.y += 6; });
      } SFX.sing(); break;
      case 'halo': {
        const h = sc.add.ellipse(f.x, f.y - f.H - 20, 90, 22).setStrokeStyle(4, 0xfff27a).setDepth(12);
        this.add(h, 60, (o, t) => { o.setPosition(f.x, f.y - f.H - 20); o.setAlpha(1 - t); });
        this.popText(f.x, f.y - f.H - 50, '+' + (f.move && f.move.heal || 150) + ' HP', '#aaffaa');
        SFX.heal();
        break;
      }
    }
  }
}
