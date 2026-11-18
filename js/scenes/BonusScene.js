// ============================================================
// BonusScene — arcade bonus stages between fights (fixed 60 Hz step, hard time limit,
// always ends → can't hang). Keyboard, gamepad and touch.
//   noodle    食麵大胃王   mash any attack button / tap to eat wonton noodles
//   cardboard 執紙皮賣錢   walk, jump over trolleys, carry cardboard to the recycling shop
//   coins     唱錢大考驗   catch falling coins with the fanny pack, dodge brick phones
// ============================================================
const BONUS_CFG = {
  noodle:    { time: 15, target: { easy: 4, normal: 5, hard: 6 }, bites: 10, bg: 'bonus_noodle', music: 'bonus' },
  cardboard: { time: 35, target: { easy: 14, normal: 18, hard: 22 }, bg: 'bonus_cardboard', music: 'bonus' },
  coins:     { time: 22, target: { easy: 18, normal: 24, hard: 30 }, bg: 'stage_arcade', music: 'bonus' },
};
class BonusScene extends Phaser.Scene {
  constructor() { super('Bonus'); }
  create(data) {
    UI.sceneInit(this);
    this.touchBite = false; this.biteFx = 0; this.success = false;
    this.kind = (data && data.kind) || 'noodle';
    if (!BONUS_CFG[this.kind]) this.kind = 'noodle';
    const cfg = this.cfg = BONUS_CFG[this.kind];
    this.target = cfg.target[KF.diff] || cfg.target.normal;
    this.frame = 0; this.acc = 0; this.phase = 'intro'; this.phaseF = 0;
    this.timeLeft = cfg.time * 60; this.score = 0;
    this.add.image(VIEW_W / 2, VIEW_H / 2, cfg.bg).setDisplaySize(VIEW_W, VIEW_H).setTint(this.kind === 'coins' ? 0x7080a0 : 0xd0d8d0);
    this.style = charStyle(KF.p1, KF.p1form);
    this.meta = SPRITE_META[this.style] || { w: 280, h: 290, feet: 285, cx: 140, bodyH: 255 };
    this.objs = [];
    this['setup_' + this.kind]();
    Mood.add(this, { rain: this.kind === 'cardboard', depth: 60, grainA: 0.25 });
    // HUD
    const D = 100, info = STORY.bonus[this.kind];
    this.add.rectangle(VIEW_W / 2, 30, VIEW_W, 60, 0x000000, 0.55).setDepth(D);
    gradText(this, 170, 30, 'BONUS ' + info.title, 30).setDepth(D + 1);
    this.timeTxt = T(this, VIEW_W / 2 + 40, 30, '', 30, '#ffd84a').setOrigin(0.5).setDepth(D + 1);
    this.scoreTxt = T(this, VIEW_W - 30, 30, '', 26, '#ffffff').setOrigin(1, 0.5).setDepth(D + 1);
    this.msg = this.add.rectangle(VIEW_W / 2, 270, 760, 170, 0x000000, 0.8).setStrokeStyle(3, 0x40ffd0).setDepth(D + 2);
    this.msgTxt = T(this, VIEW_W / 2, 270, info.pre + '\n\n' + this.howTo(), 22, '#ffffff', { wordWrap: { width: 700, useAdvancedWrap: true }, lineSpacing: 6 }).setOrigin(0.5).setDepth(D + 3);
    this.buildTouch();
    Music.play(cfg.music);
    window.__KF = window.__KF || {}; window.__KF.bonus = this;
    this.events.once('shutdown', () => { if (window.__KF.bonus === this) window.__KF.bonus = null; this.input.removeAllListeners(); });
    this.refreshHud();
  }
  howTo() {
    if (this.kind === 'noodle') return `【玩法】狂撳 拳 / 腳 / 任何攻擊掣，或者狂㩒畫面「食！」掣\n${this.cfg.time} 秒內食 ${this.target} 碗！`;
    if (this.kind === 'cardboard') return `【玩法】◀ ▶ 行，跳（W / ↑ / 拳）避開手推車\n執紙皮，拎去右邊回收舖賣：賺夠 $${this.target}！`;
    return `【玩法】◀ ▶ 移動，用腰包接銅仔，避開磚頭機\n接夠 ${this.target} 個！`;
  }
  // ------------------------------------------------------------ setups
  addPlayer(x, y, s) {
    const m = this.meta;
    const img = this.add.image(x, y, this.style + '_idle').setOrigin((m.cx || m.w / 2) / m.w, (m.feet || m.h) / m.h);
    img.setScale(s * 238 / (m.bodyH || 255) * CHARACTERS[KF.p1].cm / 172).setDepth(20);
    return img;
  }
  setup_noodle() {
    this.add.rectangle(VIEW_W / 2, 470, VIEW_W, 140, 0x2a1a10, 0.85).setDepth(5);      // table
    this.pl = this.addPlayer(330, 440, 0.95);
    this.bowl = this.add.image(560, 430, 'it_noodle').setScale(0.9).setDepth(22);
    this.bar = this.add.rectangle(470, 505, 0, 16, 0xffd84a).setOrigin(0, 0.5).setDepth(23);
    this.add.rectangle(470, 505, 200, 20).setOrigin(0, 0.5).setStrokeStyle(2, 0xffffff).setDepth(23);
    this.stack = [];
    this.bites = 0;
    this.eatBtn = makeButton(this, 830, 420, 180, 120, '食！', () => this.bite(), { size: 48, depth: 40 });
    this.eatBtn.removeAllListeners('pointerup');
    this.eatBtn.on('pointerdown', () => { SFX.unlock(); this.touchBite = true; });
  }
  setup_cardboard() {
    this.groundY = 492;
    this.shop = { x: 880, w: 140 };
    this.add.rectangle(this.shop.x, 410, this.shop.w, 170, 0x203028, 0.85).setStrokeStyle(3, 0x40ffd0).setDepth(6);
    T(this, this.shop.x, 350, '回收舖\n紙皮 $0.4/kg', 20, '#9cf0ff').setOrigin(0.5).setDepth(7);
    this.pl = this.addPlayer(200, this.groundY, 0.62);
    this.px = 200; this.py = this.groundY; this.pvy = 0; this.stun = 0; this.carry = 0; this.money = 0; this.dir = 1;
    this.boxes = []; this.carts = []; this.carryImgs = [];
    this.spawnT = 0; this.cartT = 120;
  }
  setup_coins() {
    this.pl = this.addPlayer(480, 500, 0.7);
    this.px = 480; this.items = []; this.spawnT = 0; this.miss = 0;
  }
  // ------------------------------------------------------------ touch
  buildTouch() {
    this.tc = {};
    if (this.kind === 'noodle') return;
    const mk = (id, x, y, label) => { const b = makeButton(this, x, y, 110, 90, label, () => {}, { size: 34, depth: 120, alpha: 0.5 }); b.removeAllListeners('pointerup'); b.tid = id; this.tc[id] = b; return b; };
    mk('l', 80, 470, '◀'); mk('r', 210, 470, '▶');
    if (this.kind === 'cardboard') mk('u', 870, 470, '跳');
    this.input.addPointer(2);
  }
  touchHeld(id) {
    const b = this.tc[id]; if (!b) return false;
    for (const p of this.input.manager.pointers) if (p && p.isDown && Math.abs(p.x - b.x) < 60 && Math.abs(p.y - b.y) < 50) return true;
    return false;
  }
  readInput() {
    const a = Input.frame(0), b = Input.frame(1);
    const inp = { l: a.l || b.l || this.touchHeld('l'), r: a.r || b.r || this.touchHeld('r'), u: a.u || b.u || this.touchHeld('u') };
    inp.press = BTN.some(k => a[k] || b[k]);
    if (this.touchBite) { inp.press = true; this.touchBite = false; }
    // tests / attract: scripted play (success) or idle (fail)
    if (window.__KF_AUTO && !window.__KF_BONUSFAIL) Object.assign(inp, this.autoPlay());
    if (window.__KF_BONUSFAIL) { inp.l = inp.r = inp.u = inp.press = false; }
    return inp;
  }
  autoPlay() {
    if (this.kind === 'noodle') return { press: this.frame % 3 === 0 };
    if (this.kind === 'coins') {
      const c = this.items.filter(i => i.coin && i.y < 470).sort((p, q) => q.y - p.y)[0];
      const danger = this.items.find(i => !i.coin && i.y > 300 && Math.abs(i.x - this.px) < 60);
      const tx = danger ? this.px + (danger.x > this.px ? -120 : 120) : c ? c.x : 480;
      return { l: tx < this.px - 8, r: tx > this.px + 8 };
    }
    // cardboard
    const goShop = this.carry >= 4 || (this.carry > 0 && this.timeLeft < 300);
    let tx = this.shop.x;
    if (!goShop) { const bx = this.boxes.slice().sort((p, q) => Math.abs(p.x - this.px) - Math.abs(q.x - this.px))[0]; if (bx) tx = bx.x; }
    const cart = this.carts.find(c => Math.abs(c.x - this.px) < 130 && Math.sign(c.vx) === Math.sign(this.px - c.x));
    return { l: tx < this.px - 10, r: tx > this.px + 10, u: !!cart };
  }
  // ------------------------------------------------------------ loop
  update(time, delta) {
    if (this.__leaving) return;
    const speed = (window.__KF && window.__KF.speed) || DEBUG.speed;
    this.acc += Math.min(delta, 100) * speed;
    let n = 0;
    while (this.acc >= 1000 / 60 && n < 4 * speed) {
      this.acc -= 1000 / 60; n++;
      try { this.step(); } catch (e) { (window.__GAME_ERRORS = window.__GAME_ERRORS || []).push('[bonus] ' + (e.stack || e)); this.finish(); }
      if (this.__leaving) break;
    }
    if (n >= 4 * speed) this.acc = 0;
  }
  step() {
    this.frame++; this.phaseF++;
    if (this.phase === 'intro') {
      const go = this.phaseF > 30 && (Input.menu('ok') || this.input.activePointer.isDown || window.__KF_AUTO || window.__KF_BONUSFAIL);
      if (go || this.phaseF > 420) { this.phase = 'play'; this.phaseF = 0; this.msg.setVisible(false); this.msgTxt.setVisible(false); Input.clearEdges(); SFX.go(); }
      return;
    }
    if (this.phase === 'result') {
      if ((this.phaseF > 40 && (Input.menu('ok') || this.input.activePointer.isDown)) || this.phaseF > 240 || (window.__KF_AUTO && this.phaseF > 30) || (window.__KF_BONUSFAIL && this.phaseF > 30)) this.leave();
      return;
    }
    const inp = this.readInput();
    this['step_' + this.kind](inp);
    this.timeLeft--;
    if (this.timeLeft <= 0 || this.won()) this.finish();
    this.refreshHud();
  }
  won() { return this.kind === 'noodle' ? this.score >= this.target : false; }
  step_noodle(inp) {
    if (inp.press) this.bite();
    this.bowl.setScale(0.9 + (this.biteFx > 0 ? 0.05 : 0)); if (this.biteFx > 0) this.biteFx--;
    this.pl.setTexture(this.style + (this.biteFx > 0 ? '_punch' : '_idle'));
  }
  bite() {
    if (this.phase !== 'play') return;
    this.bites++; this.biteFx = 4; SFX.tick();
    const s = this.add.text(560 + (Math.random() * 60 - 30), 380, Math.random() < 0.5 ? '索' : '嗦', { fontFamily: FONT_TC, fontSize: '26px', color: '#fff', stroke: '#000', strokeThickness: 4 }).setDepth(30);
    this.objs.push(s); this.tweens.add({ targets: s, y: 320, alpha: 0, duration: 400, onComplete: () => s.destroy() });
    if (this.bites >= this.cfg.bites) {
      this.bites = 0; this.score++; SFX.join();
      const e = this.add.image(700 + (this.stack.length % 3) * 10, 470 - this.stack.length * 22, 'it_noodle').setScale(0.45).setTint(0x908070).setDepth(21);
      this.stack.push(e);
    }
    this.bar.width = 200 * this.bites / this.cfg.bites;
  }
  step_cardboard(inp) {
    // spawn cardboard & trolleys
    if (--this.spawnT <= 0 && this.boxes.length < 4) {
      this.spawnT = 40 + Math.floor(Math.random() * 40);
      const x = 60 + Math.random() * 700;
      this.boxes.push({ x, img: this.add.image(x, this.groundY, 'it_cardboard').setOrigin(0.5, 1).setScale(0.55).setDepth(15) });
    }
    if (--this.cartT <= 0) {
      this.cartT = 150 + Math.floor(Math.random() * 120);
      const fromLeft = Math.random() < 0.5, vx = (fromLeft ? 1 : -1) * (3.5 + Math.random() * 2.5);
      const tex = Math.random() < 0.6 ? 'it_trolley' : 'it_bin';
      this.carts.push({ x: fromLeft ? -40 : VIEW_W + 40, vx, img: this.add.image(0, this.groundY, tex).setOrigin(0.5, 1).setScale(0.8).setDepth(16).setFlipX(vx < 0) });
    }
    // player
    if (this.stun > 0) { this.stun--; inp = { l: false, r: false, u: false }; }
    const sp = 4.6 * (this.carry > 3 ? 0.8 : 1);
    if (inp.l) { this.px -= sp; this.dir = -1; } else if (inp.r) { this.px += sp; this.dir = 1; }
    this.px = clamp(this.px, 30, VIEW_W - 30);
    if ((inp.u || inp.press) && this.py >= this.groundY) this.pvy = -13;
    this.pvy += 0.75; this.py = Math.min(this.groundY, this.py + this.pvy); if (this.py >= this.groundY) this.pvy = 0;
    // pick up
    for (let i = this.boxes.length - 1; i >= 0; i--) {
      const b = this.boxes[i];
      if (Math.abs(b.x - this.px) < 40 && this.py > this.groundY - 40 && this.carry < 6) { b.img.destroy(); this.boxes.splice(i, 1); this.carry++; SFX.tick(); }
    }
    // sell
    if (this.carry > 0 && Math.abs(this.px - this.shop.x) < this.shop.w / 2) {
      const earn = this.carry * 2; this.money += earn; this.score = this.money;
      this.popup(this.shop.x, 300, `+$${earn}（${this.carry * 5}kg）`, '#9cf0ff'); this.carry = 0; SFX.clear();
    }
    // trolleys
    for (let i = this.carts.length - 1; i >= 0; i--) {
      const c = this.carts[i]; c.x += c.vx; c.img.x = c.x;
      if (c.x < -80 || c.x > VIEW_W + 80) { c.img.destroy(); this.carts.splice(i, 1); continue; }
      if (!c.hit && Math.abs(c.x - this.px) < 34 && this.py > this.groundY - 50 && this.stun <= 0) {
        c.hit = true; this.stun = 40; SFX.hurt();
        if (this.carry) { this.popup(this.px, this.py - 160, `跌咗 ${this.carry} 疊紙皮！`, '#ff9a9a'); this.carry = 0; }
      }
    }
    this.pl.setPosition(this.px, this.py).setFlipX(this.dir < 0);
    const moving = inp.l || inp.r;
    this.pl.setTexture(this.style + (this.stun > 0 ? '_hurt' : this.py < this.groundY ? '_jump' : moving ? ((Math.floor(this.frame / 8) % 2) ? '_walk2' : '_walk1') : '_idle'));
    // carried stack above the head
    while (this.carryImgs.length < this.carry) this.carryImgs.push(this.add.image(0, 0, 'it_cardboard').setScale(0.4).setDepth(21));
    while (this.carryImgs.length > this.carry) this.carryImgs.pop().destroy();
    this.carryImgs.forEach((im, i) => im.setPosition(this.px, this.py - 175 - i * 22));
  }
  step_coins(inp) {
    if (--this.spawnT <= 0) {
      this.spawnT = 14 + Math.floor(Math.random() * 12);
      const coin = Math.random() < 0.78;
      const img = this.add.image(40 + Math.random() * (VIEW_W - 80), -20, coin ? 'coin' : 'it_brick').setScale(coin ? 1.4 : 0.45).setDepth(18);
      this.items.push({ x: img.x, y: -20, vy: 3.5 + Math.random() * 3, coin, img });
    }
    if (inp.l) this.px -= 7; else if (inp.r) this.px += 7;
    this.px = clamp(this.px, 40, VIEW_W - 40);
    this.pl.setX(this.px).setTexture(this.style + ((inp.l || inp.r) ? ((Math.floor(this.frame / 8) % 2) ? '_walk2' : '_walk1') : '_block')).setFlipX(inp.l);
    for (let i = this.items.length - 1; i >= 0; i--) {
      const it = this.items[i]; it.y += it.vy; it.img.y = it.y; it.img.angle += 6;
      if (it.y > 360 && it.y < 470 && Math.abs(it.x - this.px) < 55) {
        if (it.coin) { this.score++; SFX.tick(); } else { this.score = Math.max(0, this.score - 3); this.popup(this.px, 300, '-3', '#ff9a9a'); SFX.hurt(); }
        it.img.destroy(); this.items.splice(i, 1); continue;
      }
      if (it.y > VIEW_H + 30) { it.img.destroy(); this.items.splice(i, 1); }
    }
  }
  popup(x, y, t, c) { const o = T(this, x, y, t, 24, c).setOrigin(0.5).setDepth(50); this.tweens.add({ targets: o, y: y - 50, alpha: 0, duration: 900, onComplete: () => o.destroy() }); }
  refreshHud() {
    this.timeTxt.setText('⏱ ' + Math.max(0, Math.ceil(this.timeLeft / 60)));
    if (this.kind === 'noodle') this.scoreTxt.setText(`碗數 ${this.score} / ${this.target}`);
    else if (this.kind === 'cardboard') this.scoreTxt.setText(`$${this.money} / $${this.target}　手上 ${this.carry} 疊`);
    else this.scoreTxt.setText(`銅仔 ${this.score} / ${this.target}`);
  }
  finish() {
    if (this.phase === 'result') return;
    this.phase = 'result'; this.phaseF = 0;
    const success = this.score >= this.target;
    this.success = success;
    const info = STORY.bonus[this.kind];
    const pts = success ? 5000 + this.score * 100 : this.score * 100;
    if (KF.flow) { KF.flow.score += pts; KF.flow.bonus.push({ kind: this.kind, score: this.score, target: this.target, success }); }
    KF.bonusResults = KF.bonusResults || []; KF.bonusResults.push({ kind: this.kind, score: this.score, target: this.target, success });
    this.msg.setVisible(true); this.msgTxt.setVisible(true);
    this.msgTxt.setText((success ? '🎉 成功！\n' : '時間到！\n') + (success ? info.win : info.lose) + `\n\n獎勵分數 +${pts}　（點擊繼續）`);
    if (success) SFX.clear(); else SFX.announce('ko');
    this.refreshHud();
  }
  leave() {
    if (this.__leaving) return;
    if (KF.flow) Flow.next(this); else UI.fadeTo(this, 'Title', {});
  }
}
