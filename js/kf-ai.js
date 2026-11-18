// ============================================================
// kf-ai.js — CPU opponent. Produces the same input object a player does,
// reacting to what it "saw" `react` frames ago (difficulty-based).
// ============================================================
const ARCHETYPE = {
  sage: [170, 320], mkgirl: [55, 140],
  kowloon: [240, 420], phone: [260, 440], otaku: [260, 440], boss: [150, 330],
  muscle: [70, 150], wok: [100, 210], auntie: [140, 300], stall: [110, 240], football: [120, 260], afei: [110, 230],
};
class CpuBrain {
  constructor(fighter, diffKey, opts = {}) {
    this.f = fighter;
    this.cfg = Object.assign({}, DIFFICULTY[diffKey] || DIFFICULTY.normal);
    if (opts.boost) { this.cfg.block = Math.min(0.92, this.cfg.block + opts.boost * 0.05); this.cfg.react = Math.max(6, this.cfg.react - opts.boost); }
    this.chaos = !!opts.chaos;
    this.hist = []; this.plan = 'idle'; this.planT = 0; this.age = 0;
    this.lastThreatId = null; this.blockRoll = false; this.lastJumpId = null; this.aaRoll = false;
    this.range = ARCHETYPE[fighter.key] || [150, 300];
    this.roles = {};
    for (const [slot, mv] of Object.entries(fighter.specials)) (this.roles[mv.role] = this.roles[mv.role] || []).push(slot);
  }
  bossTune(bs) {      // final boss: difficulty-scaled reactions, blocking and super use
    this.cfg.react = bs.react; this.cfg.block = bs.block; this.cfg.superUse = bs.superUse; this.cfg.aa = Math.min(0.9, this.cfg.aa * bs.aggr);
    this.cfg.special = this.cfg.special * bs.aggr; this.cfg.mistake = this.cfg.mistake / bs.aggr; this.aggr = bs.aggr;
  }
  rnd() { return Math.random(); }
  snapshot(scene) {
    const f = this.f, o = f.opp;
    const projs = scene.projs.filter(p => p.alive && p.owner === o && !p.warn);
    let near = null;
    for (const p of projs) {
      const dx = f.x - p.x;
      const approaching = p.kind === 'pillar' || p.kind === 'rain' || Math.sign(p.vx) === Math.sign(dx) || p.vx === 0;
      if (approaching && Math.abs(dx) < 280) { near = p; break; }
    }
    const mv = o.move;
    return { x: o.x, y: o.y, air: !o.grounded, vy: o.vy, state: o.state,
      attacking: o.state === 'attack' && !!mv, moveId: o.state === 'attack' ? (o.moveSlot + ':' + (scene.frame - o.mf)) : null,
      low: !!(mv && mv.level === 'low'), overhead: !!(mv && (mv.level === 'overhead' || mv.air)), proj: near, projId: near ? near : null,
      dist: Math.abs(o.x - f.x) };
  }
  frame(scene) {
    const f = this.f, o = f.opp, cfg = this.cfg;
    const out = { l: false, r: false, u: false, d: false, lp: false, lk: false, s1: false, s2: false, s3: false, sp: false };
    this.age++;
    this.hist.push(this.snapshot(scene));
    if (this.hist.length > 40) this.hist.shift();
    const obs = this.hist[Math.max(0, this.hist.length - 1 - cfg.react)];
    const fwdKey = o.x > f.x ? 'r' : 'l', backKey = fwdKey === 'r' ? 'l' : 'r';
    const dist = Math.abs(o.x - f.x);
    if (this.chaos) return this.chaosFrame(out);
    const canAct = f.actionable || f.state === 'block' || f.state === 'land';
    // ---- defence ----
    const threatId = obs.attacking && obs.dist < 240 ? obs.moveId : (obs.proj ? 'p' + (obs.proj.age - (this.hist.length)) + obs.proj.x.toFixed(0)[0] : null);
    if ((obs.attacking && obs.dist < 240) || obs.proj) {
      const id = obs.attacking ? obs.moveId : obs.proj;
      if (id !== this.lastThreatId) { this.lastThreatId = id; this.blockRoll = this.rnd() < cfg.block; this.jumpRoll = this.rnd() < 0.18 * (1 - cfg.mistake); }
      if (canAct || f.state === 'block') {
        if (obs.proj && !obs.attacking && this.jumpRoll && obs.proj.kind === 'straight' && Math.abs(obs.proj.x - f.x) > 120 && f.actionable) {
          out.u = true; out[fwdKey] = true; return out;
        }
        if (this.blockRoll) {
          out[backKey] = true;
          out.d = obs.low || (!obs.overhead && !obs.air && this.rnd() < 0.5 && !obs.proj);
          if (obs.proj && obs.proj.d && obs.proj.d.level === 'low') out.d = true;
          if (obs.overhead) out.d = false;
          return out;
        }
      }
    } else if (f.state === 'block') { out[backKey] = true; out.d = f.blockLow; }
    // ---- reflect / absorb an incoming projectile ----
    if (obs.proj && f.actionable && this.roles.counter && obs.proj.kind === 'straight' && Math.abs(obs.proj.x - f.x) < 170 && Math.abs(obs.proj.x - f.x) > 60) {
      const slot = this.roles.counter.find(sl => f.specials[sl].reflect || f.specials[sl].absorb);
      if (slot && this.projReactId !== obs.proj) { this.projReactId = obs.proj; if (this.rnd() < 0.55 * (1 - cfg.mistake)) { out[slot] = true; return out; } }
    }
    // ---- anti-air ----
    if (obs.air && obs.dist < 250 && canAct) {
      const jid = Math.round(obs.x / 50) + ':' + (o.sf > 0 ? Math.floor((scene.frame - o.sf) / 10) : 0);
      if (this.lastJumpId === null || Math.abs(this.age - this.lastJumpAge) > 30) { this.lastJumpAge = this.age; this.aaRoll = this.rnd() < cfg.aa; this.lastJumpId = jid; }
      if (this.aaRoll && obs.dist < 200 && f.actionable) {
        this.aaRoll = false;
        const aa = this.roles.antiair || this.roles.counter;
        if (aa && this.rnd() < 0.8) { const s = aa[0]; if (!(f.specials[s].needsNoProj && f.hasProjectile())) { out[s] = true; return out; } }
        out.lk = true; return out;
      }
    }
    // ---- combo: cancel a connected normal ----
    if (f.state === 'attack' && f.connected && f.move && f.move.cancel && this.rnd() < 0.5 * (1 - cfg.mistake)) {
      const pick = (this.roles.close || this.roles.rush || this.roles.counter ? null : null) || (this.roles.close || this.roles.rush || this.roles.proj);
      if (pick) out[pick[Math.floor(this.rnd() * pick.length)]] = true;
      if (f.meter >= SUPER_COST && this.rnd() < cfg.superUse * 0.5) out.sp = true;
      return out;
    }
    if (!f.actionable) return out;
    // ---- super ----
    if (f.meter >= SUPER_COST && this.age % 20 === 0 && this.rnd() < cfg.superUse * 0.5) {
      const sp = f.specials.sp;
      const dashy = !!sp.dash;
      if ((!dashy || dist < 420) && (!sp.heal || f.hp < f.maxHp * 0.85 || this.rnd() < 0.3)) { out.sp = true; return out; }
    }
    // ---- plan (re-decided every few frames) ----
    if (--this.planT <= 0) this.choosePlan(dist);
    const [lo, hi] = this.range;
    switch (this.plan) {
      case 'approach': out[fwdKey] = true; if (dist < lo) this.planT = 0; break;
      case 'retreat': out[backKey] = true; if (dist > hi) this.planT = 0; break;
      case 'jumpin': out.u = true; out[fwdKey] = true; this.plan = 'airattack'; this.planT = 40; break;
      case 'airattack': if (!f.grounded && f.vy > -2 && dist < 170) { out[this.rnd() < 0.6 ? 'lk' : 'lp'] = true; this.plan = 'idle'; } break;
      case 'jumpback': out.u = true; out[backKey] = true; this.plan = 'idle'; break;
      case 'crouch': out.d = true; break;
      case 'poke': {
        const r = this.rnd();
        if (r < 0.35) out.lp = true; else if (r < 0.65) out.lk = true; else if (r < 0.85) { out.d = true; out.lk = true; } else { out.d = true; out.lp = true; }
        this.plan = 'idle'; this.planT = 6 + Math.floor(this.rnd() * 10); break;
      }
      case 'special': {
        const slot = this.pendingSlot;
        if (slot && !(f.specials[slot].needsNoProj && f.hasProjectile())) out[slot] = true;
        this.plan = 'idle'; this.planT = 10 + Math.floor(this.rnd() * 14); break;
      }
      default: break;
    }
    return out;
  }
  choosePlan(dist) {
    const f = this.f, cfg = this.cfg, [lo, hi] = this.range;
    const r = this.rnd();
    this.planT = 8 + Math.floor(this.rnd() * (cfg.react + 12));
    if (r < cfg.mistake * 0.5) { this.plan = 'idle'; return; }
    const pickRole = (...roles) => { for (const ro of roles) { const s = this.roles[ro]; if (s) { const slot = s[Math.floor(this.rnd() * s.length)]; if (!(f.specials[slot].needsNoProj && f.hasProjectile())) return slot; } } return null; };
    const spChance = 0.25 + cfg.special * 12;
    if (this.roles.buff && !(f.buffT > 0) && dist > 200 && this.rnd() < 0.2) { this.plan = 'special'; this.pendingSlot = this.roles.buff[0]; return; }
    if (dist > 250) {
      if (this.rnd() < spChance) { const s = pickRole('proj', 'trap'); if (s) { this.plan = 'special'; this.pendingSlot = s; return; } }
      if (dist > hi) { this.plan = this.rnd() < 0.12 ? 'jumpin' : 'approach'; return; }
      if (this.rnd() < 0.15 && dist < 360) { this.plan = 'jumpin'; return; }
      if (dist < 340 && this.rnd() < 0.3) { const s = pickRole('rush'); if (s) { this.plan = 'special'; this.pendingSlot = s; return; } }
      this.plan = this.rnd() < 0.6 ? 'approach' : 'idle'; return;
    }
    if (dist > 140) {
      if (this.rnd() < 0.3) { const s = pickRole('rush', 'proj', 'trap'); if (s) { this.plan = 'special'; this.pendingSlot = s; return; } }
      if (dist < lo) { this.plan = this.rnd() < 0.8 ? 'retreat' : 'jumpback'; return; }
      this.plan = this.rnd() < 0.7 ? 'approach' : (this.rnd() < 0.5 ? 'jumpin' : 'crouch'); return;
    }
    // close
    if (this.roles.grab && dist < 120 && this.rnd() < 0.16) { this.plan = 'special'; this.pendingSlot = this.roles.grab[0]; return; }
    if (this.roles.buff && !(f.buffT > 0) && this.rnd() < 0.08) { this.plan = 'special'; this.pendingSlot = this.roles.buff[0]; return; }
    if (this.rnd() < 0.22) { const s = pickRole('close', 'counter', 'antiair'); if (s) { this.plan = 'special'; this.pendingSlot = s; return; } }
    if (lo > 200 && this.rnd() < 0.4) { this.plan = this.rnd() < 0.7 ? 'retreat' : 'jumpback'; return; }
    this.plan = this.rnd() < 0.75 ? 'poke' : 'crouch';
  }
  chaosFrame(out) {
    // random monkey input (used by the soak test)
    if (this.age % 7 === 0) this.dirs = ['l', 'r', 'u', 'd'].filter(() => this.rnd() < 0.3);
    for (const k of this.dirs || []) out[k] = true;
    if (this.rnd() < 0.18) { const b = BTN[Math.floor(this.rnd() * BTN.length)]; out[b] = true; }
    return out;
  }
}
