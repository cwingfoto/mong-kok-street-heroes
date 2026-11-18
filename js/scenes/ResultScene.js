// ResultScene — winner pose + quote; arcade: next opponent / continue / game over;
// vs / free: rematch or reselect; watch: next random match (attract mode).
class ResultScene extends Phaser.Scene {
  constructor() { super('Result'); }
  create() {
    UI.sceneInit(this);
    const r = KF.lastResult || { winner: 0 };
    const st = STAGES[KF.stage] || STAGES.street;
    this.add.image(VIEW_W / 2, VIEW_H / 2, st.bg).setDisplaySize(VIEW_W, VIEW_H).setTint(0x606080);
    this.add.rectangle(VIEW_W / 2, VIEW_H / 2, VIEW_W, VIEW_H, 0x000010, 0.45);
    this.humanLost = (KF.mode === 'arcade') && r.winner !== 0;
    this.left = 0;
    if (this.humanLost) return this.continueScreen();
    const wk = r.winner === 1 ? KF.p2 : KF.p1, lk = r.winner === 1 ? KF.p1 : KF.p2;
    const w = CHARACTERS[wk], l = CHARACTERS[lk];
    const wf = r.winner === 1 ? KF.p2form : KF.p1form, lf = r.winner === 1 ? KF.p1form : KF.p2form;
    if (r.winner >= 0) {
      this.pose(wk, wf, 260, 'win', 0.95);
      this.pose(lk, lf, 760, 'down', 0.75).setTint(0x8080a0).setFlipX(true);
      gradText(this, VIEW_W / 2 + 120, 80, w.name + ' 勝！', 60);
      const q = w.win[Math.floor(Math.random() * w.win.length)];
      this.add.rectangle(620, 230, 560, 110, 0x000000, 0.6).setStrokeStyle(2, 0xffd84a);
      T(this, 620, 230, '「' + q + '」', 26, '#ffffff', { wordWrap: { width: 520, useAdvancedWrap: true } }).setOrigin(0.5);
    } else {
      gradText(this, VIEW_W / 2, 120, 'DRAW GAME', 70);
      T(this, VIEW_W / 2, 200, '兩位都好勁！再嚟過？', 28, '#ffffff').setOrigin(0.5);
    }
    let btns = [];
    if (KF.mode === 'arcade') {
      btns.push(makeButton(this, 620, 360, 300, 56, '下一步 ▶', () => this.next(), { size: 26 }));
      this.autoAt = this.time.now + 5000;
    } else {
      btns.push(makeButton(this, 620, 330, 280, 52, '再戰一場', () => UI.fadeTo(this, 'Vs', {}), { size: 24 }));
      btns.push(makeButton(this, 620, 395, 280, 52, '重新揀角色', () => UI.fadeTo(this, 'Select', {}), { size: 24 }));
      btns.push(makeButton(this, 620, 460, 280, 52, '回到標題', () => UI.fadeTo(this, 'Title', {}), { size: 24 }));
      if (KF.mode === 'watch') this.autoAt = this.time.now + 4000;
    }
    this.menu = new Menu(this, btns);
    Music.play('versus');
    if (KF.mode === 'watch' && window.__KF_AUTO) this.autoAt = this.time.now + 500;
  }
  pose(key, form, x, pose, s) {
    const ch = CHARACTERS[key], style = charStyle(key, form), m = SPRITE_META[style] || {};
    return this.add.image(x, 520, `${style}_${pose}`).setOrigin((m.cx || 140) / (m.w || 280), (m.feet || 280) / (m.h || 290)).setScale(s * ch.cm / 172 * 238 / (m.bodyH || 255));
  }
  next() {
    if (this.__leaving) return;
    if (KF.flow) { Flow.next(this); return; }
    UI.fadeTo(this, 'Title', {});
  }
  continueScreen() {
    this.pose(KF.p1, KF.p1form, 300, 'hurt', 0.95);
    gradText(this, 640, 110, 'CONTINUE?', 64, '#ffffff', '#ff9a4a', '#c01000');
    this.count = 10; this.countT = 0;
    this.countTxt = gradText(this, 640, 230, '10', 110);
    T(this, 640, 320, '輸咗唔緊要，再嚟過！', 24, '#ffffff').setOrigin(0.5);
    const yes = makeButton(this, 560, 410, 200, 56, '繼續！', () => this.doContinue(), { size: 26 });
    const no = makeButton(this, 780, 410, 180, 56, '放棄', () => this.gameOver(), { size: 24 });
    this.menu = new Menu(this, [yes, no]);
    this.menu.horizontal = true;
    Music.play('ending');
  }
  doContinue() { if (this.over || this.__leaving) return; KF.continues++; if (KF.flow) Flow.retry(this); else UI.fadeTo(this, 'Vs', {}); }
  gameOver() {
    if (this.over) return; this.over = true; KF.flow = null;
    this.menu.buttons.forEach(b => b.setVisible(false));
    this.countTxt.setText('');
    gradText(this, 640, 230, 'GAME OVER', 70, '#ffffff', '#aaaaaa', '#444444');
    this.time.delayedCall(2500, () => UI.fadeTo(this, 'Title', { attract: true }));
  }
  update(time, delta) {
    if (this.__leaving) return;
    if (this.humanLost && !this.over && window.__KF_AUTO && !this.autoCont) { this.autoCont = time; }
    if (this.autoCont && time - this.autoCont > 600 && !this.over) { this.autoCont = 0; window.__KF_GAMEOVER ? this.gameOver() : this.doContinue(); return; }
    if (this.humanLost && !this.over) {
      this.countT += delta;
      if (this.countT >= 1000) { this.countT = 0; this.count--; if (this.count < 0) return this.gameOver(); this.countTxt.setText(String(this.count)); SFX.tick(); }
    }
    if (this.menu && !this.over) this.menu.update();
    if (this.autoAt && time > this.autoAt) {
      this.autoAt = 0;
      if (KF.mode === 'arcade' && !KF.flow) this.next();
      else if (KF.mode === 'watch') {          // attract mode: a new random pairing
        const pick = shuffle(CHAR_ORDER); KF.p1 = pick[0]; KF.p2 = pick[1];
        KF.p1form = Math.random() < 0.5 ? 'suit' : 'vest'; KF.p2form = Math.random() < 0.5 ? 'suit' : 'vest';
        KF.stage = STAGE_ORDER[Math.floor(Math.random() * STAGE_ORDER.length)];
        UI.fadeTo(this, 'Vs', {});
      }
    }
  }
}
