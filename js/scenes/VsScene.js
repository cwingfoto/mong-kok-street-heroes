// VsScene — portraits, names, stage name; auto-advances to the fight (tap to skip).
class VsScene extends Phaser.Scene {
  constructor() { super('Vs'); }
  create() {
    UI.sceneInit(this);
    const a = CHARACTERS[KF.p1], b = CHARACTERS[KF.p2], st = STAGES[KF.stage] || STAGES.street;
    this.add.image(VIEW_W / 2, VIEW_H / 2, st.bg).setDisplaySize(VIEW_W, VIEW_H).setTint(0x405060);
    this.add.rectangle(VIEW_W / 4, VIEW_H / 2, VIEW_W / 2, VIEW_H, 0xa01040, 0.35);
    this.add.rectangle(VIEW_W * 3 / 4, VIEW_H / 2, VIEW_W / 2, VIEW_H, 0x007060, 0.35);
    const fa = this.add.image(-200, 270, 'face_' + charStyle(KF.p1, KF.p1form)).setDisplaySize(300, 300);
    const fb = this.add.image(VIEW_W + 200, 270, 'face_' + charStyle(KF.p2, KF.p2form)).setDisplaySize(300, 300).setFlipX(true);
    this.tweens.add({ targets: fa, x: 230, duration: 350, ease: 'Back.out' });
    this.tweens.add({ targets: fb, x: VIEW_W - 230, duration: 350, ease: 'Back.out' });
    T(this, 230, 450, a.name, 28, a.color).setOrigin(0.5);
    T(this, VIEW_W - 230, 450, b.name, 28, b.color).setOrigin(0.5);
    const vs = gradText(this, VIEW_W / 2, 260, 'VS', 120).setScale(3).setAlpha(0);
    this.tweens.add({ targets: vs, scale: 1, alpha: 1, duration: 300, delay: 250, ease: 'Back.out' });
    T(this, VIEW_W / 2, 505, '舞台：' + st.name, 22, '#9cf0ff').setOrigin(0.5);
    if (KF.flow) {
      const n = (KF.ladderIdx || 0) + 1, last = KF.p2 === BOSS_KEY;
      T(this, VIEW_W / 2, 70, last ? '最終戰！' : `第 ${n} / ${KF.flow.total} 戰` + (KF.flow.mode === 'story' ? '　（一局）' : ''), 28, last ? '#ff6a4a' : '#ffd84a').setOrigin(0.5);
    }
    Mood.add(this, { rain: true, depth: 60, grainA: 0.3 });
    SFX.announce('round');
    this.at = this.time.now;
    this.input.on('pointerdown', () => this.go());
    this.ev = this.time.delayedCall(2300 / Math.max(1, DEBUG.speed), () => this.go());
  }
  go() { if (this.time.now - this.at < 300 && DEBUG.speed <= 1) return; UI.fadeTo(this, 'Fight', { stage: KF.stage }); }
  update() { if (Input.menu('ok')) this.go(); }
}
