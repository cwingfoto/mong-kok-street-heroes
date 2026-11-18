// BootScene — loads assets/ (meta.json lists every sprite) or, on file://, the
// embedded data-URI copy (js/assets-embedded.js), then builds effect textures.
const BACKGROUNDS = {};
['stage_bridge', 'stage_sino', 'stage_phone', 'stage_street', 'stage_market', 'stage_arcade', 'stage_roof', 'stage_room',
  'bg_eatery', 'title_bg', 'landmark_montage', 'bonus_noodle', 'bonus_cardboard'].forEach(k => { BACKGROUNDS[k] = `assets/bg/${k}.jpg`; });
function artManifest(meta) {
  const m = {};
  for (const [key, v] of Object.entries(meta || {})) {
    if (v.poses) for (const p of v.poses) m[`${key}_${p}`] = `assets/sprites/${key}_${p}.png`;
    else m[key] = `assets/sprites/${key}.png`;
  }
  for (const k of Object.keys(meta || {})) if (meta[k].poses) m['face_' + k] = `assets/sprites/face_${k}.png`;
  return Object.assign(m, BACKGROUNDS);
}
class BootScene extends Phaser.Scene {
  constructor() { super('Boot'); }
  preload() {
    this.bar = this.add.rectangle(VIEW_W / 2 - 200, VIEW_H / 2 + 20, 0, 14, 0xffd84a).setOrigin(0, 0.5);
    this.add.rectangle(VIEW_W / 2, VIEW_H / 2 + 20, 404, 18).setStrokeStyle(2, 0xffffff);
    this.add.text(VIEW_W / 2, VIEW_H / 2 - 30, GAME_TITLE + '\n載入中… LOADING', { fontFamily: FONT_TC, fontSize: '24px', color: '#fff', align: 'center' }).setOrigin(0.5);
    this.embedded = (location.protocol === 'file:' && window.EMBEDDED_ASSETS) || null;
    if (this.embedded) return;
    this.load.on('progress', v => this.bar.width = 400 * v);
    this.load.on('loaderror', f => console.error('[assets] failed to load', f.key, f.url));
    this.load.once('filecomplete-json-spriteMeta', (key, type, data) => {
      for (const [k, url] of Object.entries(artManifest(data))) this.load.image(k, url + '?v=' + GAME.version);
    });
    this.load.json('spriteMeta', 'assets/sprites/meta.json?v=' + GAME.version);
  }
  create() {
    if (!this.embedded) { SPRITE_META = this.cache.json.get('spriteMeta') || {}; return this.finish(); }
    SPRITE_META = JSON.parse(JSON.stringify(this.embedded.meta || {}));
    const man = artManifest(SPRITE_META);
    const jobs = Object.entries(man).filter(([, url]) => this.embedded.images[url]);
    let left = jobs.length, done = 0;
    if (!left) return this.finish();
    const tm = this.textures, pending = new Set(jobs.map(([k]) => k));
    const tick = () => { done++; this.bar.width = 400 * done / jobs.length; if (--left === 0) this.finish(); };
    const onAdd = key => { if (pending.delete(key)) tick(); };
    const onErr = key => { if (pending.delete(key)) { console.error('[assets] embedded image failed:', key); tick(); } };
    tm.on(Phaser.Textures.Events.ADD, onAdd); tm.on(Phaser.Textures.Events.ERROR, onErr);
    this.events.once('shutdown', () => { tm.off(Phaser.Textures.Events.ADD, onAdd); tm.off(Phaser.Textures.Events.ERROR, onErr); });
    for (const [k, url] of jobs) tm.addBase64(k, this.embedded.images[url]);
    // never get stuck on the loading screen
    this.time.delayedCall(15000, () => this.finish());
  }
  finish() {
    if (this.finished) return; this.finished = true;
    const man = artManifest(SPRITE_META);
    const missing = Object.keys(man).filter(k => !this.textures.exists(k));
    if (missing.length) console.error(`[assets] MISSING ART for ${missing.length} textures: ${missing.slice(0, 20).join(', ')}`);
    else console.info(`[assets] art OK (${Object.keys(man).length} textures, ${this.embedded ? 'embedded' : 'http'})`);
    window.__ART_STATUS = { source: this.embedded ? 'embedded' : 'http', missing, count: Object.keys(man).length };
    generateFxTextures(this);
    const start = Q.get('scene');
    // debug / tests: ?scene=fight&p1=..&p2=..&mode=watch&p1form=vest · ?scene=bonus&kind=noodle · ?scene=story|arcade&p1=..
    const ck = k => CHARACTERS[k] ? k : null;
    KF.p1 = ck(Q.get('p1')) || KF.p1; KF.p2 = ck(Q.get('p2')) || KF.p2;
    KF.p1form = Q.get('p1form') || (CHARACTERS[KF.p1].forms ? 'suit' : null); KF.p2form = Q.get('p2form') || (CHARACTERS[KF.p2].forms ? 'suit' : null);
    if (DIFFICULTY[Q.get('diff')]) KF.diff = Q.get('diff');
    if (start === 'fight') {
      KF.mode = Q.get('mode') || 'watch';
      this.scene.start('Fight', { stage: Q.get('stage') || (KF.p2 === BOSS_KEY ? 'roof' : CHARACTERS[KF.p2].stage) });
    } else if (start === 'bonus') {
      KF.mode = 'arcade'; this.scene.start('Bonus', { kind: Q.get('kind') || 'noodle' });
    } else if (start === 'arcade' || start === 'story') {
      if (Q.get('fight')) KF.storyFight = Q.get('fight');
      Flow.start(this, start);
    } else if (start === 'select') { KF.mode = Q.get('mode') || 'arcade'; this.scene.start('Select'); }
    else this.scene.start('Title');
  }
}
