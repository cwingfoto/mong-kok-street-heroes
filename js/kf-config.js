// ============================================================
// kf-config.js — constants for 旺角街頭英雄傳
// Everything gameplay runs in fixed 60 Hz "frames" (see FightScene.step),
// never in Phaser timers, so speed-ups (tests), pauses and restarts can't
// leave stray callbacks behind.
// ============================================================
// ---- Title: change ONLY this block to rename the game (also edit manifest.json name/short_name and sw.js CACHE) ----
const GAME = {
  title: '旺角街頭英雄傳',
  titleEn: 'MONG KOK STREET HEROES',
  subtitle: '霓虹燈下・十一個人的迴響',
  short: '旺角英雄傳',
  cachePrefix: 'mk-fighter-',          // service-worker cache name prefix (sw.js uses mk-fighter-v1)
  storeKey: 'mk-fighter',              // localStorage prefix
  version: 'v2.1',
};
const GAME_TITLE = GAME.title;
const GAME_SUB = GAME.subtitle;
const VIEW_W = 960, VIEW_H = 540;
const STAGE_W = 1280;                 // arena width (camera scrolls 0..320)
const FLOOR_Y = 500;                  // feet line
const WALL_PAD = 46;
const MAX_SEP = VIEW_W - 2 * 70;
const GRAV = 0.8;
const JUMP_VY = -16.8, JUMP_VX = 4.3;
const HP_MAX = 1000;
const METER_MAX = 200, SUPER_COST = 200;   // 2 bars → 超必殺
const ROUND_TIME = 99, TICK_FRAMES = 52;   // timer counts down every 52 frames
const ROUNDS_TO_WIN = 2;
const FONT_TC = '"Noto Sans TC","Noto Sans CJK TC","PingFang TC","Microsoft JhengHei","Heiti TC","Noto Serif CJK TC",sans-serif';
const FONT_BIG = '"Arial Black","Impact",' + FONT_TC;
const DIFFICULTY = {
  easy:   { name: '簡單', react: 24, block: 0.22, aa: 0.18, special: 0.010, superUse: 0.25, mistake: 0.35, dmgTaken: 0.85 },
  normal: { name: '普通', react: 15, block: 0.48, aa: 0.45, special: 0.018, superUse: 0.6,  mistake: 0.15, dmgTaken: 1 },
  hard:   { name: '困難', react: 8,  block: 0.78, aa: 0.75, special: 0.026, superUse: 0.9,  mistake: 0.04, dmgTaken: 1.08 },
};
// Final boss 「旺角之魂・霓虹龍」 scales with difficulty
const BOSS_SCALE = {
  easy:   { hp: 950,  dmg: 0.75, regen: 0.03, react: 20, block: 0.25, superUse: 0.4,  aggr: 0.85 },
  normal: { hp: 1120, dmg: 0.86, regen: 0.06, react: 14, block: 0.45, superUse: 0.6,  aggr: 1.0 },
  hard:   { hp: 1250, dmg: 0.95, regen: 0.1,  react: 9,  block: 0.68, superUse: 0.85, aggr: 1.12 },
};
const Q = new URLSearchParams(location.search);
const DEBUG = {
  speed: Math.max(1, Math.min(16, +(Q.get('speed') || 1))),
  touch: Q.get('touch') === '1',
  nomusic: Q.get('nomusic') === '1',
  menu: Q.get('menu') === '1',      // tests: skip the attract screen
};
function store(k, v) { try { if (v === undefined) return localStorage.getItem(GAME.storeKey + '-' + k); localStorage.setItem(GAME.storeKey + '-' + k, v); } catch (e) { return null; } return v; }

// v1 → v2: keys and hero IDs remain valid; preferences / boss unlock never discarded.
try { const old = store('saveVersion'); if (old !== '2') { store('saveVersion', '2'); } } catch (e) { /* storage disabled: playable anyway */ }
