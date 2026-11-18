// ============================================================
// main.js — Phaser config & boot for 旺角街頭英雄傳
// ============================================================
(function patchTextFilter() {           // crisp CJK text: linear filtering on text textures
  const F = Phaser.GameObjects.GameObjectFactory.prototype, orig = F.text;
  F.text = function (...args) { const t = orig.apply(this, args); try { t.texture.setFilter(Phaser.Textures.FilterMode.LINEAR); } catch (e) { /* */ } return t; };
})();
// Freeze guard: one uncaught exception inside game.step() would otherwise stop
// requestAnimationFrame for good. Log it and keep the loop running.
window.__GAME_ERRORS = window.__GAME_ERRORS || [];
(function guardStep() {
  const step = Phaser.Game.prototype.step;
  Phaser.Game.prototype.step = function (time, delta) {
    try { step.call(this, time, delta); }
    catch (e) {
      const msg = (e && (e.stack || e.message)) || String(e);
      if (window.__GAME_ERRORS.length < 50) window.__GAME_ERRORS.push(msg);
      if (window.__GAME_ERRORS.length <= 5) console.error('[game] recovered from error:', msg);
      try { const r = this.renderer; r.preRender(); this.scene.render(r); r.postRender(); } catch (_) { /* */ }
    }
  };
})();
window.__FRAMES = 0;
// Audio can fail on devices without an output (or before a gesture); never let that surface as an error.
window.addEventListener('unhandledrejection', e => {
  const r = e && e.reason, msg = String((r && (r.message || r.name)) || r || '');
  if (/audio|NotAllowedError|InvalidStateError/i.test(msg)) e.preventDefault();
});
const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: VIEW_W, height: VIEW_H,
  backgroundColor: '#000000',
  render: { antialias: true, roundPixels: false },
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH, fullscreenTarget: 'game' },
  input: { activePointers: 4, gamepad: false },
  fps: { target: 60, forceSetTimeOut: false },
  audio: { noAudio: true },          // all sound is our own WebAudio (sfx.js); Phaser's sound manager is not needed
  scene: [BootScene, TitleScene, SelectScene, VsScene, FightScene, ResultScene, StoryScene, BonusScene, EndingScene],
});
game.events.on('poststep', () => { window.__FRAMES++; });
game.scale.on('enterfullscreen', () => { try { screen.orientation.lock('landscape').catch(() => {}); } catch (e) { /* */ } });
window.addEventListener('contextmenu', e => e.preventDefault());
document.addEventListener('touchmove', e => e.preventDefault(), { passive: false });
['gesturestart', 'gesturechange', 'gestureend'].forEach(t => document.addEventListener(t, e => e.preventDefault()));
let lastTouchEnd = 0;
document.addEventListener('touchend', e => { const now = Date.now(); if (now - lastTouchEnd < 300) e.preventDefault(); lastTouchEnd = now; }, { passive: false });
document.addEventListener('dblclick', e => e.preventDefault());
if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}
['pointerdown', 'keydown', 'touchstart'].forEach(t => window.addEventListener(t, () => SFX.unlock(), { capture: true, passive: true }));
window.addEventListener('keydown', e => { if (e.code === 'KeyM' && !e.repeat && !(game.scene.isActive('Fight'))) SFX.toggleMute(); });
if (DEBUG.nomusic) SFX.setMuted(true);
