// ============================================================
// kf-chars.js — 9 Mong Kok heroes + the final boss. Nobody is a villain.
// Titles only (no real names). Moves are data: see kf-engine.js.
// Box = { x: forward offset from body centre, w, y: top height above feet, h } (px).
// Specials use dedicated buttons (必殺1/2/3) — no motion inputs. 超必殺 costs 2 bars.
// role tells the CPU when to use a move: proj / antiair / rush / close / counter / trap / grab / buff / super
// New mechanics: puddle (slow), grab (command throw), absorb / reflect, buff (armor),
//   dizzy, guardBreak, form change (阿飛 suit → vest).
// ============================================================
const NORMALS = {
  lp:  { name: '拳', startup: 4, active: 3, rec: 9,  dmg: 45, box: { x: 10, w: 92, y: 172, h: 34 }, hitstun: 15, blockstun: 11, push: 7, level: 'mid', pose: 'punch', cancel: true },
  lk:  { name: '腳', startup: 7, active: 4, rec: 15, dmg: 70, box: { x: 10, w: 118, y: 186, h: 70 }, hitstun: 18, blockstun: 13, push: 10, level: 'mid', pose: 'kick', cancel: true },
  clp: { name: '蹲拳', startup: 4, active: 3, rec: 9, dmg: 40, box: { x: 10, w: 92, y: 120, h: 34 }, hitstun: 14, blockstun: 10, push: 7, level: 'mid', pose: 'cpunch', cancel: true, crouch: true },
  clk: { name: '掃腿', startup: 8, active: 5, rec: 22, dmg: 62, box: { x: 6, w: 128, y: 46, h: 44 }, hitstun: 16, blockstun: 12, push: 9, level: 'low', pose: 'ckick', kd: true, crouch: true },
  jlp: { name: '跳拳', startup: 4, active: 22, rec: 0, dmg: 55, box: { x: 4, w: 84, y: 150, h: 90 }, hitstun: 16, blockstun: 12, push: 6, level: 'overhead', pose: 'punch', air: true },
  jlk: { name: '跳腳', startup: 6, active: 22, rec: 0, dmg: 75, box: { x: 4, w: 104, y: 110, h: 80 }, hitstun: 18, blockstun: 13, push: 7, level: 'overhead', pose: 'kick', air: true },
};

const C = (o) => Object.assign({ hp: HP_MAX, speed: 1, melee: 1, reach: 1, cm: 172 }, o);

// ---- 阿飛: two outfits share one character (selectable at Select, super changes suit → vest mid-fight) ----
const AFEI_COUNTER = { name: '鏡前獨舞・回身恰恰', startup: 2, active: 6, rec: 16, pose: 'spin', box: { x: 0, w: 120, y: 190, h: 120 }, dmg: 95, kd: true, hitstun: 20, push: 8 };
const AFEI_SUIT = {
  s1: { name: '恰恰・三步一回頭', sub: 'CHA-CHA STEP', color: '#ff9ad8', role: 'rush', startup: 6, active: 16, rec: 18, pose: 'spin',
        dash: { from: 4, to: 20, vx: 7.5 }, box: { x: 0, w: 100, y: 190, h: 120 }, dmg: 44, hits: 2, interval: 8, kd: true, hitstun: 18, blockstun: 14, push: 6 },
  s2: { name: '停擺的時鐘', sub: 'THE STOPPED CLOCK', color: '#9cf0ff', role: 'proj', startup: 13, active: 0, rec: 22, pose: 'shoot', needsNoProj: true,
        proj: [{ at: 13, tex: 'clock', speed: 6, yr: 0.62, w: 46, h: 46, dmg: 55, hitstun: 50, freezeTint: 0x9cf0ff, spin: 3, life: 170 }] },
  s3: { name: '鏡前獨舞', sub: 'MIRROR DANCE', color: '#c8f0ff', role: 'counter', startup: 3, active: 22, rec: 14, pose: 'shout',
        counter: AFEI_COUNTER, reflect: true },
  sp: { name: '一生只落地一次', sub: 'THE BIRD THAT LANDS ONCE・SUPER', color: '#ffe14a', role: 'super', startup: 10, active: 40, rec: 18, pose: 'cast', invuln: [0, 30],
        rise: { at: 6, vy: -17, vx: 1 }, dive: { at: 26, vy: 15, vx: 10, pose: 'kick', angle: 30 }, activeFrom: 24, endOnLand: true,
        box: { x: -10, w: 130, y: 210, h: 220 }, dmg: 62, hits: 5, interval: 4, kd: true, hitstun: 24, push: 6, chip: 0.25,
        fx: [{ at: 0, type: 'birds' }], form: 'vest', formText: '脫下外套・白背心' },
};
const AFEI_VEST = {
  s1: { name: '恰恰・赤腳旋步', sub: 'BAREFOOT CHA-CHA', color: '#ff9ad8', role: 'rush', startup: 5, active: 18, rec: 16, pose: 'spin',
        dash: { from: 3, to: 18, vx: 7.5 }, box: { x: 0, w: 96, y: 190, h: 120 }, dmg: 34, hits: 3, interval: 6, kd: true, hitstun: 18, blockstun: 14, push: 6 },
  s2: { name: '鏡中倒影', sub: 'REFLECTION', color: '#c8f0ff', role: 'proj', startup: 10, active: 0, rec: 20, pose: 'shoot', needsNoProj: true,
        proj: [{ at: 10, tex: 'shard', speed: 11, yr: 0.66, w: 40, h: 26, dmg: 42, hitstun: 16 }, { at: 16, tex: 'shard', speed: 11, yr: 0.42, w: 40, h: 26, dmg: 42, hitstun: 18 }] },
  s3: { name: '鏡前獨舞', sub: 'MIRROR DANCE', color: '#c8f0ff', role: 'counter', startup: 3, active: 22, rec: 14, pose: 'shout',
        counter: Object.assign({}, AFEI_COUNTER, { dmg: 105 }), reflect: true },
  sp: { name: '一生只落地一次', sub: 'THE BIRD THAT LANDS ONCE・SUPER', color: '#ffe14a', role: 'super', startup: 10, active: 40, rec: 18, pose: 'cast', invuln: [0, 30],
        rise: { at: 6, vy: -17, vx: 1 }, dive: { at: 26, vy: 15, vx: 11, pose: 'kick', angle: 30 }, activeFrom: 24, endOnLand: true,
        box: { x: -10, w: 130, y: 210, h: 220 }, dmg: 58, hits: 6, interval: 4, kd: true, hitstun: 24, push: 6, chip: 0.25,
        fx: [{ at: 0, type: 'birds' }] },
};

const CHARACTERS = {
  kowloon: C({
    name: '九龍皇帝', en: 'KING OF KOWLOON', style: 'kowloon', cm: 165, hp: 1030, speed: 0.9, melee: 1.12, reach: 1.15, stage: 'bridge', color: '#ffd84a',
    blurb: '拐杖・毛筆・一瓶墨\n陷阱型：墨池減速＋看破反擊',
    intro: '此土，本皇所有。', win: ['墨未乾，字未完。', '你哋笑我癲，我寫我嘅。', '皇土寸寸，皆有墨跡。'],
    specials: {
      s1: { name: '御筆・墨跡橫掃', sub: 'INK SWEEP', color: '#cfd8ff', role: 'proj', startup: 12, active: 0, rec: 22, pose: 'shoot', needsNoProj: true,
            proj: [{ at: 12, tex: 'ink', speed: 8.5, yr: 0.55, w: 54, h: 40, dmg: 88, hitstun: 18, blockstun: 14, push: 7 }] },
      s2: { name: '墨池・寸步難行', sub: 'INK PUDDLE', color: '#9a8cff', role: 'trap', startup: 14, active: 0, rec: 18, pose: 'shout',
            proj: [{ at: 14, kind: 'puddle', dx: 250, w: 150, life: 300, tex: 'puddle', slow: 0.5 }] },
      s3: { name: '拐杖・守護皇土', sub: 'CRUTCH GUARD', color: '#ffe14a', role: 'counter', startup: 3, active: 22, rec: 16, pose: 'block',
            counter: { name: '拐杖・當頭一喝', startup: 3, active: 6, rec: 18, pose: 'spin', box: { x: 0, w: 130, y: 240, h: 200 }, dmg: 125, kd: true, hitstun: 22, push: 9 } },
      sp: { name: '皇帝聖旨・天書降臨', sub: 'IMPERIAL DECREE・SUPER', color: '#ffffff', role: 'super', startup: 16, active: 0, rec: 34, pose: 'cast', invuln: [0, 20],
            fx: [{ at: 0, type: 'flash', color: 0x101020 }],
            proj: ['九', '龍', '皇', '帝', '土'].map((ch, i) => ({ at: 14 + i * 5, kind: 'rain', text: ch, size: 74, textColor: '#111111', textStroke: '#f4f0e0',
              dx: -64 + i * 32, delay: 6, vy: 24, w: 84, h: 80, dmg: 52, kd: i === 4, hitstun: 22, chip: 0.25 })) },
    },
  }),
  muscle: C({
    name: '龍記大隻佬', en: 'BIG GUY OF LUNG KEE', style: 'muscle', cm: 188, hp: 1030, speed: 0.9, melee: 1.05, reach: 1.05, stage: 'street', color: '#ff8a3a',
    blurb: '188cm・燒臘舖斬料師傅\n摔投型：抱摔＋旋風臂',
    intro: '斬料！今日叉燒半肥瘦！', win: ['食飽先有力，下次再嚟。', '燒鵝要皮脆，做人要硬淨。', '斬兩舊叉燒，請你食！'],
    specials: {
      s1: { name: '燒肉刀・飛身斬', sub: 'FLYING CLEAVER', color: '#ffb84a', role: 'rush', startup: 9, active: 30, rec: 22, pose: 'shout', angle: 8,
            rise: { at: 6, vy: -10, vx: 5.5 }, endOnLand: true, box: { x: 0, w: 120, y: 230, h: 230 }, dmg: 85, kd: true, level: 'overhead', hitstun: 22, blockstun: 16, push: 8 },
      s2: { name: '斬料抱抱・大力摔', sub: 'BEAR HUG SLAM', color: '#ff7a3a', role: 'grab', startup: 6, active: 4, rec: 26, pose: 'shoot', grab: true,
            box: { x: 0, w: 70, y: 200, h: 180 }, dmg: 0,
            grabSeq: { len: 54, pose: 'shoot', hits: [{ at: 10, dmg: 25 }, { at: 24, dmg: 25 }, { at: 42, dmg: 75, kd: true, launch: -9 }] } },
      s3: { name: '龍記招牌・旋風叉燒臂', sub: 'CHAR SIU LARIAT', color: '#ffd84a', role: 'antiair', startup: 4, active: 20, rec: 18, pose: 'spin',
            invuln: [1, 9], dash: { from: 2, to: 20, vx: 3 }, box: { x: -60, w: 180, y: 240, h: 160 }, dmg: 36, hits: 3, interval: 7, kd: true, hitstun: 18, blockstun: 12, push: 6 },
      sp: { name: '龍記大霸王・終極抱摔', sub: 'ULTIMATE SLAM・SUPER', color: '#ff4a2a', role: 'super', startup: 8, active: 22, rec: 26, pose: 'walk1', invuln: [0, 30],
            dash: { from: 6, to: 28, vx: 9.5 }, grab: true, box: { x: 0, w: 80, y: 220, h: 220 }, dmg: 0,
            grabSeq: { len: 80, pose: 'cast', hits: [{ at: 8, dmg: 32 }, { at: 20, dmg: 32 }, { at: 32, dmg: 32 }, { at: 46, dmg: 32 }, { at: 66, dmg: 120, kd: true, launch: -12 }], fx: 'gold' } },
    },
  }),
  phone: C({
    name: '先達水貨炒機王', en: 'PHONE SCALPER KING', style: 'phone', cm: 172, hp: 1000, speed: 1.1, melee: 1.0, stage: 'phone', color: '#5ac8ff',
    blurb: '先達廣場・水貨磚頭機\n遠攻型：擲機＋SIM卡亂撒',
    intro: '現金收機！有貨有價！', win: ['今日行情，你蝕咗。', '收工！貨尾留畀你。', '一部機，一個時代。'],
    specials: {
      s1: { name: '磚頭機・飛擲', sub: 'BRICK PHONE TOSS', color: '#9cf0ff', role: 'proj', startup: 11, active: 0, rec: 22, pose: 'shoot', needsNoProj: true,
            proj: [{ at: 11, tex: 'it_brick', scale: 0.5, speed: 10.5, yr: 0.6, w: 40, h: 34, dmg: 82, spin: 16, hitstun: 18, blockstun: 13, push: 7 }] },
      s2: { name: 'SIM卡・天女散花', sub: 'SIM CARD SPRAY', color: '#ffe14a', role: 'trap', startup: 12, active: 0, rec: 24, pose: 'cast', needsNoProj: true,
            proj: [-3.2, 0, 3.2].map((vy, i) => ({ at: 12 + i * 2, tex: 'sim', speed: 9, vy, yr: 0.62, w: 26, h: 20, dmg: 32, spin: 20, hitstun: 14, life: 90 })) },
      s3: { name: '充電線・長鞭', sub: 'CABLE WHIP', color: '#ffffff', role: 'antiair', startup: 6, active: 8, rec: 18, pose: 'spin', invuln: [1, 6],
            box: { x: 10, w: 200, y: 300, h: 230 }, dmg: 90, kd: true, hitstun: 20, blockstun: 14, push: 12 },
      sp: { name: '炒機王・全場掃貨', sub: 'SELL-OUT RUSH・SUPER', color: '#ffd84a', role: 'super', startup: 14, active: 0, rec: 34, pose: 'shout', invuln: [0, 18],
            proj: [-100, -50, 0, 50, 100, -25, 25].map((dx, i) => ({ at: 12 + i * 4, kind: 'rain', tex: 'it_brick', scale: 0.55, spin: 14, dx, delay: 6, vy: 22, w: 64, h: 60,
              dmg: 42, kd: i === 6, hitstun: 20, chip: 0.25 })) },
    },
  }),
  otaku: C({
    name: '信和宅男', en: 'SINO CENTRE OTAKU', style: 'otaku', cm: 168, hp: 990, speed: 1.0, melee: 0.92, reach: 0.95, stage: 'sino', color: '#7aff9a',
    blurb: '信和地庫・漫畫光碟\n召喚型：迴旋光碟＋機械人\n秘技：上上下下左右左右BA',
    intro: '今期週刊，到貨未？', win: ['存檔完成。', '呢套漫畫，我追咗廿年。', '秘技，係要畀識嘅人用。'],
    specials: {
      s1: { name: '光碟・迴旋飛盤', sub: 'DISC BOOMERANG', color: '#c8f0ff', role: 'proj', startup: 11, active: 0, rec: 22, pose: 'shoot', needsNoProj: true,
            proj: [{ at: 11, tex: 'disc', speed: 9, yr: 0.6, w: 40, h: 26, dmg: 48, hits: 2, interval: 28, returns: 40, spin: 24, hitstun: 16, life: 120 }] },
      s2: { name: '召喚・鐵皮機械人', sub: 'TIN ROBOT', color: '#7aff9a', role: 'trap', startup: 14, active: 0, rec: 24, pose: 'cast', needsNoProj: true,
            proj: [{ at: 14, tex: 'it_robot', scale: 0.4, speed: 3.2, x: 40, yr: 0.38, w: 90, h: 150, dmg: 38, hits: 3, interval: 14, dur: 3, bob: true, barrier: true, life: 170, hitstun: 16 }] },
      s3: { name: '秘技・上上下下左右左右BA', sub: 'SECRET CODE: ARMOR', color: '#ffe14a', role: 'buff', startup: 6, active: 0, rec: 18, pose: 'shout',
            buff: { t: 360, armor: true, speed: 1.25, dmg: 1.12 }, fx: [{ at: 0, type: 'code' }] },
      sp: { name: '宅之魂・百連打手掣', sub: 'HUNDRED-HIT COMBO・SUPER', color: '#7aff9a', role: 'super', startup: 8, active: 44, rec: 24, pose: 'spin', invuln: [0, 20],
            dash: { from: 6, to: 22, vx: 8.5 }, box: { x: -10, w: 110, y: 200, h: 170 }, dmg: 24, hits: 10, interval: 4, kd: true, finisher: 2.5, finisherPose: 'shout', hitstun: 16, push: 2, chip: 0.25 },
    },
  }),
  auntie: C({
    name: '金雞機鋪唱錢大嬸', en: 'ARCADE CHANGE AUNTIE', style: 'auntie', cm: 158, hp: 1000, speed: 1.0, melee: 1.0, reach: 0.9, stage: 'arcade', color: '#ffe14a',
    blurb: '機鋪唱錢櫃檯・腰包\n平衡型：銅仔彈＋吸錢大法',
    intro: '唱錢呀？排隊！', win: ['細路，早啲返屋企。', '一個銅仔，一個夢。', '我睇住你哋大個㗎。'],
    specials: {
      s1: { name: '唱錢・銅仔彈', sub: 'COIN FLICK', color: '#ffe14a', role: 'proj', startup: 9, active: 0, rec: 22, pose: 'shoot', needsNoProj: true,
            proj: [9, 14, 19].map((at, i) => ({ at, tex: 'coin', speed: 13, yr: 0.6 + (i - 1) * 0.06, w: 22, h: 22, dmg: 26, spin: 18, hitstun: 12, blockstun: 9, push: 4 })) },
      s2: { name: '腰包・吸錢大法', sub: 'FANNY-PACK ABSORB', color: '#ffd84a', role: 'counter', startup: 3, active: 24, rec: 14, pose: 'block', absorb: 36,
            counter: { name: '代幣筒・反手一揈', startup: 2, active: 6, rec: 16, pose: 'spin', box: { x: 0, w: 120, y: 200, h: 140 }, dmg: 90, kd: true, hitstun: 20, push: 8 } },
      s3: { name: '代幣筒・當頭棒喝', sub: 'TOKEN-TUBE SMASH', color: '#ff9a3a', role: 'close', startup: 15, active: 5, rec: 20, pose: 'spin',
            box: { x: 10, w: 120, y: 230, h: 120 }, dmg: 92, level: 'overhead', guardBreak: true, hitstun: 22, blockstun: 16, push: 9 },
      sp: { name: '金雞大派錢・銅仔雨', sub: 'COIN SHOWER・SUPER', color: '#ffe14a', role: 'super', startup: 14, active: 0, rec: 32, pose: 'cast', invuln: [0, 18],
            fx: [{ at: 0, type: 'coinfx' }],
            proj: Array.from({ length: 10 }, (_, i) => ({ at: 12 + i * 3, kind: 'rain', tex: 'coin', scale: 1.8, spin: 12, dx: ((i * 53) % 200) - 100, delay: 5, vy: 22, w: 48, h: 48,
              dmg: 30, kd: i === 9, hitstun: 18, chip: 0.25 })) },
    },
  }),
  wok: C({
    name: '砵蘭街大鑊火師傅', en: 'PORTLAND ST. WOK MASTER', style: 'wok', cm: 170, hp: 1020, speed: 0.95, melee: 1.05, stage: 'market', color: '#ff5a3a',
    blurb: '大牌檔・猛火大鑊・牙籤\n攻守型：火龍噴＋鑊蓋反彈',
    intro: '火候到，就上碟。', win: ['鑊氣，係要等㗎。', '食飽未？未就坐低。', '個牌，係老婆留低嘅。'],
    specials: {
      s1: { name: '鑊氣・火龍噴', sub: 'WOK-HEI FLAME', color: '#ff7a3a', role: 'proj', startup: 12, active: 0, rec: 22, pose: 'shoot', needsNoProj: true,
            proj: [{ at: 12, tex: 'fire', speed: 9, yr: 0.62, w: 60, h: 42, dmg: 80, hitstun: 18, blockstun: 13, push: 7, pulse: true }] },
      s2: { name: '鑊鏟・連環快炒', sub: 'SPATULA FLURRY', color: '#ffd84a', role: 'close', startup: 6, active: 20, rec: 16, pose: 'shout',
            box: { x: 10, w: 110, y: 190, h: 90 }, dmg: 24, hits: 4, interval: 5, hitstun: 14, blockstun: 10, push: 3, finisher: 2 },
      s3: { name: '鑊蓋・原路奉還', sub: 'WOK SHIELD REFLECT', color: '#9cf0ff', role: 'counter', startup: 3, active: 22, rec: 14, pose: 'block', reflect: true,
            counter: { name: '大鑊・反手蓋頂', startup: 3, active: 6, rec: 18, pose: 'spin', box: { x: 0, w: 130, y: 240, h: 200 }, dmg: 105, kd: true, hitstun: 22, push: 9 } },
      sp: { name: '極速乾炒牛河・猛火大鑊', sub: 'WOK INFERNO・SUPER', color: '#ff4a1a', role: 'super', startup: 8, active: 22, rec: 26, pose: 'walk1', invuln: [0, 30],
            dash: { from: 6, to: 26, vx: 9 }, grab: true, grabAir: true, box: { x: 0, w: 80, y: 220, h: 220 }, dmg: 0,
            grabSeq: { len: 78, pose: 'cast', hits: [{ at: 8, dmg: 38 }, { at: 18, dmg: 38 }, { at: 28, dmg: 38 }, { at: 38, dmg: 38 }, { at: 62, dmg: 140, kd: true, launch: -12 }], fx: 'fire' } },
    },
  }),
  stall: C({
    name: '女人街殺價檔主', en: "LADIES' MARKET HAGGLER", style: 'stall', cm: 160, hp: 1000, speed: 1.05, melee: 1.0, reach: 1.1, stage: 'market', color: '#ff7ad0',
    blurb: '通菜街夜市・叉衫棍・計數機\n纏鬥型：計數機令人暈眩',
    intro: '靚女，睇吓先！', win: ['十蚊三件，唔講價。', '收檔前，最後一單。', '人情味，唔使錢。'],
    specials: {
      s1: { name: '貨尾・亂擲', sub: 'BARGAIN BIN TOSS', color: '#ff9ad8', role: 'proj', startup: 12, active: 0, rec: 22, pose: 'shoot', needsNoProj: true,
            proj: [{ at: 12, texChoices: ['g_bag', 'g_slipper', 'g_hanger', 'g_tee'], speed: 8, vy: -6.5, grav: 0.36, yr: 0.7, w: 44, h: 40, dmg: 72, spin: 10, hitstun: 18, blockstun: 13, push: 7, life: 140 }] },
      s2: { name: '計數機・殺到見骨', sub: 'CALCULATOR SLAM', color: '#ffe14a', role: 'close', startup: 13, active: 5, rec: 20, pose: 'shout',
            box: { x: 10, w: 110, y: 230, h: 130 }, dmg: 80, level: 'overhead', dizzy: 75, hitstun: 22, blockstun: 16, push: 6, popText: '$10 三件！' },
      s3: { name: '叉衫棍・挑高晾起', sub: 'POLE LAUNCHER', color: '#ff7ad0', role: 'antiair', startup: 4, active: 10, rec: 22, pose: 'spin', invuln: [1, 8],
            box: { x: 0, w: 150, y: 320, h: 260 }, dmg: 100, kd: true, launch: -12, hitstun: 22, blockstun: 14, push: 6 },
      sp: { name: '女人街・全場清貨大減價', sub: 'CLEARANCE SALE・SUPER', color: '#ff4ab0', role: 'super', startup: 14, active: 0, rec: 30, pose: 'cast', invuln: [0, 18],
            proj: [{ at: 14, kind: 'wave', text: '大減價！$10', size: 60, textColor: '#ffe14a', textStroke: '#c00060', speed: 8, w: 120, dmg: 44, hits: 5, interval: 7, kd: true, life: 150, dur: 99, chip: 0.25 }] },
    },
  }),
  football: C({
    name: '旺角球場波牛', en: 'MONG KOK FOOTBALL BULL', style: 'football', cm: 175, hp: 1000, speed: 1.06, melee: 1.0, stage: 'street', color: '#7aff9a',
    blurb: '花墟硬地・夜波之王\n速攻型：爆射＋鏟波＋倒掛',
    intro: '夠膽就落場！', win: ['輸波唔輸人。', '聽晚八點，花墟見。', '個波係圓嘅，人生都係。'],
    specials: {
      s1: { name: '十二碼・爆射', sub: 'PENALTY BLAST', color: '#ffffff', role: 'proj', startup: 10, active: 0, rec: 22, pose: 'shoot', needsNoProj: true,
            proj: [{ at: 10, tex: 'football', speed: 12, yr: 0.5, w: 38, h: 38, dmg: 70, spin: 20, bounces: 1, hitstun: 18, blockstun: 12, push: 7, life: 150 }] },
      s2: { name: '鏟波・飛身鏟', sub: 'SLIDE TACKLE', color: '#7aff9a', role: 'rush', startup: 5, active: 18, rec: 18, pose: 'spin', crouch: true,
            dash: { from: 4, to: 20, vx: 8.5 }, box: { x: 0, w: 120, y: 60, h: 60 }, dmg: 72, level: 'low', kd: true, hitstun: 20, blockstun: 14, push: 8 },
      s3: { name: '倒掛金鈎', sub: 'BICYCLE KICK', color: '#ffe14a', role: 'antiair', startup: 3, active: 16, rec: 16, pose: 'shout', angle: -20,
            invuln: [1, 10], rise: { at: 3, vy: -14, vx: 1.6 }, box: { x: -20, w: 120, y: 270, h: 200 }, dmg: 56, hits: 2, interval: 7, kd: true, hitstun: 20, blockstun: 14, push: 6 },
      sp: { name: '花墟夜波・世紀入球', sub: 'GOAL OF THE CENTURY・SUPER', color: '#7aff9a', role: 'super', startup: 18, active: 0, rec: 30, pose: 'cast', invuln: [0, 22],
            fx: [{ at: 0, type: 'team' }],
            proj: [{ at: 18, tex: 'football', scale: 3, speed: 13, yr: 0.5, w: 100, h: 100, dmg: 46, hits: 6, interval: 5, dur: 99, kd: true, spin: 18, life: 100, chip: 0.25, trail: 'star' }] },
    },
  }),
  afei: C({
    name: '無腳雀仔・阿飛', en: 'THE BIRD WITHOUT FEET', style: 'afeis', cm: 177, hp: 980, speed: 1.0, melee: 1.0, stage: 'room', color: '#ff9ad8',
    blurb: '六十年代・油頭・恰恰\n舞步型：反彈＋超必殺後換裝\n（選角時可換：西裝 / 白背心）',
    intro: '……一、二、三，恰恰恰。', win: ['我只係路過。', '鏡入面嗰個，先係我。', '一直飛，就唔使落地。'],
    defaultForm: 'suit',
    forms: {
      suit: { label: '西裝', style: 'afeis', speed: 1.0, melee: 1.0, dmgTaken: 1.0, specials: AFEI_SUIT },
      vest: { label: '白背心', style: 'afeiv', speed: 1.12, melee: 1.08, dmgTaken: 1.06, specials: AFEI_VEST },
    },
    specials: AFEI_SUIT,
  }),
  sage: C({
    name: '好景商場四仔隱藏仙人', short: '好景仙人', en: 'THE HIDDEN DISC SAGE', style: 'sage', cm: 169, hp: 1050, speed: 0.99, melee: 1.07, stage: 'sino', color: '#ffbc72',
    blurb: '虛構合成人物・58歲\n光碟／格仔／布簾・非露骨喜劇',
    intro: '三仔有格仔，四仔冇格仔。', win: ['散場唔等於散伙。凳留畀你。', '呢隻唔賣，係街坊合照。', '燈暗啲，我幫你搵返條路。'],
    specials: {
      s1: { name: '碟海・銀光借路', sub: 'SILVER DISC', color: '#b7e9ff', role: 'proj', startup: 11, active: 0, rec: 22, pose: 'shoot', needsNoProj: true,
        proj: [{ at: 11, tex: 'disc', kind: 'boomerang', speed: 9, yr: 0.58, w: 62, h: 45, dmg: 64, hitstun: 20, spin: 14, life: 85 }] },
      s2: { name: '格仔・留白之牆', sub: 'MOSAIC WALL', color: '#d5c7f4', role: 'trap', startup: 14, active: 0, rec: 25, pose: 'cast', needsNoProj: true,
        proj: [{ at: 14, kind: 'barrier', tex: 'fx_mosaic', dx: 150, w: 90, h: 150, dmg: 35, hits: 2, interval: 22, life: 150, kd: true }] },
      s3: { name: '布簾・散場回身', sub: 'CURTAIN CALL', color: '#ffbc72', role: 'counter', startup: 3, active: 24, rec: 16, pose: 'block', reflect: true,
        counter: { name: '布簾・借光回禮', startup: 2, active: 7, rec: 18, pose: 'spin', box: { x: 0, w: 150, y: 230, h: 190 }, dmg: 100, kd: true, hitstun: 23, push: 10 } },
      sp: { name: '好景不散・末班放映', sub: 'ONE LAST SCREENING', color: '#ffcf8b', role: 'super', startup: 16, active: 0, rec: 34, pose: 'cast', invuln: [0, 22],
        fx: [{ at: 0, type: 'screening' }],
        proj: [{ at: 16, kind: 'wave', tex: 'fx_projector', speed: 8, w: 230, h: 170, dmg: 40, hits: 6, interval: 7, kd: true, life: 140, chip: 0.2 }] },
    },
  }),
  mkgirl: C({
    name: '旺角MK妹', short: 'MK妹', en: 'NEON STEPPER', style: 'mkgirl', cm: 168, hp: 970, speed: 1.15, melee: 0.98, reach: 1.02, stage: 'market', color: '#69e7d7', age: 25,
    blurb: '25歲成年人・原創街頭舞者\n短外套／格仔絲帶靴・快速近身腿法',
    intro: '夠 IN 未？我先唔會放低自己。', win: ['條鞋帶鬆咗。等我幫你綁。', '個場散咗，下星期都喺度等。', '唔使同我一樣。做你自己就夠。'],
    specials: {
      s1: { name: '街角・踏光連踢', sub: 'NEON STEP', color: '#69e7d7', role: 'rush', startup: 6, active: 18, rec: 20, pose: 'kick',
        dash: { from: 3, to: 19, vx: 7.4 }, box: { x: 2, w: 115, y: 190, h: 130 }, dmg: 32, hits: 3, interval: 6, hitstun: 18, blockstun: 12, push: 5 },
      s2: { name: '鞋帶・低迴掃步', sub: 'RIBBON SWEEP', color: '#f5b3db', role: 'close', startup: 8, active: 7, rec: 22, pose: 'ckick', crouch: true,
        dash: { from: 5, to: 12, vx: 5 }, box: { x: 0, w: 150, y: 65, h: 60 }, dmg: 76, level: 'low', kd: true, hitstun: 20, push: 9 },
      s3: { name: '天台・躍霓挑踢', sub: 'ROOFTOP ARC', color: '#a9dcff', role: 'antiair', startup: 4, active: 16, rec: 22, pose: 'spin', invuln: [1, 8],
        rise: { at: 3, vy: -13, vx: 2 }, box: { x: -12, w: 130, y: 290, h: 240 }, dmg: 46, hits: 2, interval: 7, kd: true, hitstun: 22, push: 7 },
      sp: { name: '未完的八拍・霓虹疾奏', sub: 'EIGHT COUNTS ONWARD', color: '#69e7d7', role: 'super', startup: 8, active: 40, rec: 24, pose: 'spin', invuln: [0, 18],
        dash: { from: 5, to: 39, vx: 6.5 }, box: { x: -4, w: 145, y: 245, h: 215 }, dmg: 38, hits: 7, interval: 5, kd: true, hitstun: 24, push: 4, chip: 0.2,
        fx: [{ at: 0, type: 'eightbeat' }] },
    },
  }),
  boss: C({
    name: '旺角之魂・霓虹龍', en: 'SOUL OF MONG KOK: NEON DRAGON', style: 'boss', cm: 196, hp: 1300, speed: 0.98, melee: 1.05, reach: 1.2, stage: 'roof', color: '#ff4ab0',
    boss: true,
    blurb: '最終頭目・霓虹招牌之靈\n所有拆落嚟嘅光，都喺佢身上',
    intro: '……你哋，仲記唔記得我嘅光？', win: ['燈，熄咗都仲喺度。', '記住我，就夠了。', '旺角，一直都光。'],
    specials: {
      s1: { name: '霓虹掌・光字飛彈', sub: 'NEON PALM', color: '#ff7ad0', role: 'proj', startup: 11, active: 0, rec: 20, pose: 'shoot', needsNoProj: true,
            proj: [{ at: 11, textChoices: ['押', '當', '茶', '樓', '冰', '室', '金', '舖'], size: 54, textColor: '#ff9ad8', textStroke: '#ff0080', speed: 9.5, yr: 0.6, w: 56, h: 56, dmg: 70, hitstun: 18, blockstun: 13, push: 7, glow: true }] },
      s2: { name: '招牌陣・霓虹落地', sub: 'FALLING SIGNS', color: '#9cf0ff', role: 'trap', startup: 14, active: 0, rec: 24, pose: 'shout', needsNoProj: true,
            proj: [-90, 0, 90].map((dx, i) => ({ at: 14 + i * 6, kind: 'rain', tex: 'neonsign', dx, delay: 14, vy: 20, w: 70, h: 90, dmg: 44, kd: i === 2, hitstun: 18 })) },
      s3: { name: '昇龍・霓虹掌', sub: 'RISING NEON PALM', color: '#ffe14a', role: 'antiair', startup: 3, active: 16, rec: 24, pose: 'spin', angle: -30,
            invuln: [1, 9], rise: { at: 3, vy: -15, vx: 2 }, box: { x: -10, w: 110, y: 280, h: 220 }, dmg: 50, hits: 2, interval: 6, kd: true, hitstun: 22, blockstun: 16, push: 6 },
      sp: { name: '萬家燈火・霓虹龍騰', sub: 'TEN THOUSAND LIGHTS・SUPER', color: '#ff4ab0', role: 'super', startup: 18, active: 0, rec: 30, pose: 'cast', invuln: [0, 22],
            fx: [{ at: 0, type: 'flash', color: 0xff4ab0 }],
            proj: [{ at: 18, kind: 'wave', tex: 'fx_dragon', scale: 1.1, speed: 9, w: 240, dmg: 38, hits: 6, interval: 6, kd: true, life: 160, dur: 99, chip: 0.25 }] },
    },
  }),
};
const CHAR_ORDER = ['kowloon', 'muscle', 'phone', 'otaku', 'auntie', 'wok', 'stall', 'football', 'afei', 'sage', 'mkgirl'];
const BOSS_KEY = 'boss';
const STAGES = {
  bridge: { name: '九龍・鐵路橋底', bg: 'stage_bridge', music: 'mk1', rain: true, train: true },
  sino:   { name: '信和中心・地庫走廊', bg: 'stage_sino', music: 'stage1', tube: true },
  phone:  { name: '先達廣場・迷宮一樓', bg: 'stage_phone', music: 'versus', tube: true },
  street: { name: '西洋菜南街・行人專用區', bg: 'stage_street', music: 'mk1', neon: true },
  market: { name: '通菜街・女人街夜市', bg: 'stage_market', music: 'boss', neon: true, rain: true },
  arcade: { name: '金雞廣場・遊戲機中心', bg: 'stage_arcade', music: 'title', tube: true, cameo: 'muscle' },
  room:   { name: '舊唐樓・鏡子房', bg: 'stage_room', music: 'chacha', rain: true },
  roof:   { name: '旺角・唐樓天台（最終戰）', bg: 'stage_roof', music: 'boss2', rain: true, neon: true },
};
const STAGE_ORDER = ['bridge', 'sino', 'phone', 'street', 'market', 'arcade', 'room', 'roof'];
const BUTTON_LABEL = { lp: '拳', lk: '腳', s1: '必殺1', s2: '必殺2', s3: '必殺3', sp: '超必殺' };
// face / style helpers that know about 阿飛's outfits
function charStyle(key, form) { const d = CHARACTERS[key]; if (!d) return 'kowloon'; if (d.forms) return (d.forms[form] || d.forms[d.defaultForm]).style; return d.style; }
function charSpecials(key, form) { const d = CHARACTERS[key]; if (d.forms) return (d.forms[form] || d.forms[d.defaultForm]).specials; return d.specials; }
const SHORT_NAME = { kowloon: '九龍皇帝', muscle: '大隻佬', phone: '炒機王', otaku: '信和宅男', auntie: '唱錢大嬸', wok: '大鑊火', stall: '殺價檔主', football: '球場波牛', afei: '阿飛', sage: '好景仙人', mkgirl: 'MK妹', boss: '霓虹龍' };
for (const k in SHORT_NAME) if (CHARACTERS[k]) CHARACTERS[k].short = SHORT_NAME[k];

// v2 original fictional-composite win dialogue.
CHARACTERS.kowloon.win = ["我有一張乾淨嘅寫字紙，坐低先。", "唔使急住走。雨仲大。", "今日未解決嘅事，聽日陪你再去一轉。"];
CHARACTERS.muscle.win = ["我有一盒留到收舖都仲暖嘅飯，坐低先。", "唔使急住走。雨仲大。", "今日未解決嘅事，聽日陪你再去一轉。"];
CHARACTERS.phone.win = ["我有一粒充滿電嘅舊電池，坐低先。", "唔使急住走。雨仲大。", "今日未解決嘅事，聽日陪你再去一轉。"];
CHARACTERS.otaku.win = ["我有一本可以借走嘅空白畫簿，坐低先。", "唔使急住走。雨仲大。", "今日未解決嘅事，聽日陪你再去一轉。"];
CHARACTERS.auntie.win = ["我有一枚留起嘅最後代幣，坐低先。", "唔使急住走。雨仲大。", "今日未解決嘅事，聽日陪你再去一轉。"];
CHARACTERS.wok.win = ["我有一碗少鹽嘅熱湯，坐低先。", "唔使急住走。雨仲大。", "今日未解決嘅事，聽日陪你再去一轉。"];
CHARACTERS.stall.win = ["我有一條縫好裂口嘅帆布帶，坐低先。", "唔使急住走。雨仲大。", "今日未解決嘅事，聽日陪你再去一轉。"];
CHARACTERS.football.win = ["我有一條重新綁好嘅鞋帶，坐低先。", "唔使急住走。雨仲大。", "今日未解決嘅事，聽日陪你再去一轉。"];
CHARACTERS.afei.win = ["我有一張寫住歸途嘅小紙條，坐低先。", "唔使急住走。雨仲大。", "今日未解決嘅事，聽日陪你再去一轉。"];
CHARACTERS.sage.win = ["我有一張留住散場餘光嘅空凳，坐低先。", "唔使急住走。雨仲大。", "今日未解決嘅事，聽日陪你再去一轉。"];
CHARACTERS.mkgirl.win = ["我有一條乾淨格仔絲帶，坐低先。", "唔使急住走。雨仲大。", "今日未解決嘅事，聽日陪你再去一轉。"];
CHARACTERS.boss.win = ["我有一小截照到樓梯嘅光，坐低先。", "唔使急住走。雨仲大。", "今日未解決嘅事，聽日陪你再去一轉。"];
