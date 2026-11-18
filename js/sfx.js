// ============================================================
// sfx.js — tiny WebAudio beeps + procedural chiptune BGM (no audio files,
// so it works on file:// too). Audio starts after the first tap / key
// (browser autoplay rules). Every audio call is wrapped in try/catch:
// audio can fail silently but can never stop the game loop.
// NOTE: methods only use `SFX.` / `Music.` (never `this`), so passing
// them around as plain functions (e.g. `const f = SFX.go; f()`) is safe.
// ============================================================
const SFX = {
  ctx: null,
  out: null,            // master gain for sound effects
  muted: false,
  unlock() {
    try {
      if (!SFX.ctx) {
        SFX.ctx = new (window.AudioContext || window.webkitAudioContext)();
        SFX.out = SFX.ctx.createGain(); SFX.out.connect(SFX.ctx.destination);
        SFX.out.gain.value = SFX.muted ? 0 : 1;
      }
      if (SFX.ctx.state === 'suspended') SFX.ctx.resume().catch(() => {});
      Music.onUnlock();
    } catch (e) { /* audio not available */ }
  },
  tone(freq, dur = 0.08, type = 'square', vol = 0.06, slideTo = null, delay = 0) {
    try {
      const ctx = SFX.ctx;
      if (!ctx || SFX.muted || ctx.state !== 'running') return;
      const t0 = ctx.currentTime + delay;
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = type; o.frequency.setValueAtTime(freq, t0);
      if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
      g.gain.setValueAtTime(vol, t0); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      o.connect(g); g.connect(SFX.out); o.start(t0); o.stop(t0 + dur + 0.02);
    } catch (e) { /* ignore */ }
  },
  setMuted(m) {
    SFX.muted = !!m;
    store('muted', SFX.muted ? '1' : '0');
    try {
      if (SFX.out) SFX.out.gain.value = SFX.muted ? 0 : 1;
      if (Music.out) Music.out.gain.value = SFX.muted ? 0 : Music.volume;
    } catch (e) { /* ignore */ }
    try { window.dispatchEvent(new CustomEvent('kf-mute', { detail: SFX.muted })); } catch (e) { /* ignore */ }
  },
  toggleMute() { SFX.setMuted(!SFX.muted); },
  swing() { SFX.tone(500, 0.05, 'triangle', 0.03, 200); },
  hit(heavy) { SFX.tone(heavy ? 120 : 180, heavy ? 0.16 : 0.09, 'square', 0.08, 50); if (heavy) SFX.tone(70, 0.2, 'sawtooth', 0.06, 30); },
  ko()    { SFX.tone(220, 0.25, 'sawtooth', 0.07, 40); },
  hurt()  { SFX.tone(120, 0.15, 'sawtooth', 0.07, 70); },
  jump()  { SFX.tone(300, 0.1, 'triangle', 0.04, 600); },
  // BB機 "BB BB" beep
  pager() { [0, 0.12, 0.3, 0.42].forEach(d => SFX.tone(2100, 0.07, 'square', 0.04, null, d)); },
  eat()   { [660, 880, 1175].forEach((f, i) => SFX.tone(f, 0.07, 'square', 0.035, null, i * 0.06)); },
  gunBurst() { for (let i = 0; i < 16; i++) { SFX.tone(900 - i * 20, 0.035, 'square', 0.05, 90, i * 0.042); } },
  shot()  { SFX.tone(1400, 0.03, 'square', 0.04, 200); },
  bang()  { SFX.tone(500, 0.12, 'sawtooth', 0.08, 60); },
  boom()  { SFX.tone(120, 0.35, 'sawtooth', 0.09, 30); },
  join()  { [784, 988, 1318].forEach((f, i) => SFX.tone(f, 0.1, 'square', 0.04, null, i * 0.08)); },
  go()    { SFX.tone(660, 0.08, 'square', 0.04); SFX.tone(880, 0.1, 'square', 0.04, null, 0.1); },
  // ---- fighter extras ----
  block() { SFX.tone(1200, 0.04, 'square', 0.05, 700); },
  parry() { SFX.tone(1500, 0.06, 'square', 0.05); SFX.tone(2200, 0.08, 'square', 0.04, null, 0.05); },
  tick()  { SFX.tone(900, 0.03, 'triangle', 0.04); },
  flash() { SFX.tone(2400, 0.06, 'square', 0.03, 800); },
  zap()   { for (let i = 0; i < 8; i++) SFX.tone(300 + Math.random() * 900, 0.04, 'sawtooth', 0.03, null, i * 0.035); },
  sonic() { SFX.tone(200, 0.3, 'sawtooth', 0.06, 900); },
  sing()  { [784, 880, 988, 1175].forEach((f, i) => SFX.tone(f, 0.12, 'triangle', 0.04, null, i * 0.1)); },
  heal()  { [523, 784, 1046, 1568].forEach((f, i) => SFX.tone(f, 0.15, 'sine', 0.05, null, i * 0.09)); },
  superFlash() { SFX.tone(110, 0.5, 'sawtooth', 0.07, 880); SFX.tone(1760, 0.3, 'square', 0.03, 440, 0.1); },
  announce(kind) {
    if (kind === 'round') [392, 523].forEach((f, i) => SFX.tone(f, 0.18, 'square', 0.05, null, i * 0.16));
    else if (kind === 'fight') [523, 659, 784, 1046].forEach((f, i) => SFX.tone(f, 0.1, 'square', 0.06, null, i * 0.06));
    else if (kind === 'ko') { SFX.tone(880, 0.5, 'sawtooth', 0.07, 55); SFX.tone(440, 0.6, 'square', 0.05, 40, 0.1); }
    else if (kind === 'win') [523, 659, 784, 1046, 784, 1046].forEach((f, i) => SFX.tone(f, 0.14, 'square', 0.05, null, i * 0.12));
    else if (kind === 'select') SFX.tone(988, 0.05, 'square', 0.04);
    else if (kind === 'ok') { SFX.tone(660, 0.06, 'square', 0.05); SFX.tone(1320, 0.1, 'square', 0.05, null, 0.06); }
  },
  coin()  { SFX.tone(1568, 0.05, 'square', 0.04); SFX.tone(2093, 0.12, 'square', 0.04, null, 0.05); },
  clear() { [523, 659, 784, 1046].forEach((f, i) => SFX.tone(f, 0.15, 'square', 0.05, null, i * 0.13)); },
};
SFX.muted = store('muted') === '1';

// ------------------------------------------------------------
// Music — original chiptune tracks, sequenced live with WebAudio.
// Track: bpm, chords (one per bar), lead ("NOTE:16ths" tokens, r = rest),
// drums (16 chars per bar: k kick, s snare, h hat, . rest), wave / arp style.
// ------------------------------------------------------------
const TRACKS = {
  // 旺角 originals: pentatonic street theme, a slow neon ballad for story scenes, a cha-cha, a bonus jingle
  mk1: { bpm: 138, lead: 'square', arp: 1, bass: 2, drums: 'k.hsk.hhk.hsk.hs',
    chords: 'Am G F E Am G F G',
    notes: 'A4:2 C5:2 D5:2 E5:2 G5:4 E5:4 | D5:2 E5:2 G5:4 A5:2 G5:2 E5:4 | F5:2 E5:2 D5:2 C5:2 A4:4 C5:4 | B4:4 E5:4 G#5:8 |' +
           'A5:2 G5:2 E5:2 D5:2 E5:4 A4:4 | G5:2 E5:2 D5:2 C5:2 D5:8 | C5:2 D5:2 E5:2 G5:2 A5:4 C6:4 | B5:4 G5:4 D5:8' },
  neon: { bpm: 72, lead: 'triangle', arp: 2, bass: 8, drums: 'k.......s.......',
    chords: 'Dm Bb F C Dm Bb Gm A',
    notes: 'A4:6 F4:2 D5:8 | D5:4 C5:4 A#4:8 | A4:4 C5:4 F5:6 E5:2 | E5:8 r:8 |' +
           'F5:4 E5:4 D5:4 A4:4 | A#4:6 C5:2 D5:8 | G4:4 A#4:4 D5:4 C5:4 | C#5:12 r:4' },
  // title / attract: slow minor ballad — nostalgia and sadness, lifting to a major chord at the end (hope)
  attract: { bpm: 66, lead: 'triangle', arp: 2, bass: 8, drums: 'k.......s.....h.',
    chords: 'Am F C G Am F Dm E',
    notes: 'E5:6 D5:2 C5:4 A4:4 | A4:4 C5:4 F5:8 | E5:4 G5:4 C5:6 D5:2 | B4:8 G4:8 |' +
           'C5:4 E5:4 A5:6 G5:2 | F5:4 E5:4 C5:8 | D5:4 F5:4 A5:4 G5:4 | G#5:12 r:4' },
  chacha: { bpm: 120, lead: 'square', arp: 2, bass: 4, drums: 'k..hs.hhk..hs.h.',
    chords: 'Dm G C A Dm G C A',
    notes: 'D5:2 F5:2 A5:3 A5:1 G5:2 F5:2 E5:4 | D5:2 B4:2 G4:4 B4:2 D5:2 F5:4 | E5:2 G5:2 C6:3 C6:1 B5:2 A5:2 G5:4 | E5:2 C#5:2 A4:4 C#5:1 C#5:1 C#5:2 r:4 |' +
           'A5:2 F5:2 D5:3 D5:1 F5:2 A5:2 D6:4 | B5:2 G5:2 D5:4 F5:1 F5:1 F5:2 r:4 | G5:2 E5:2 C5:3 C5:1 E5:2 G5:2 C6:4 | A5:4 C#5:1 C#5:1 C#5:2 A4:8' },
  bonus: { bpm: 168, lead: 'square', arp: 1, bass: 2, drums: 'k.h.k.h.k.hhk.hs',
    chords: 'C F G C C F G G',
    notes: 'C5:2 E5:2 G5:2 C6:2 G5:2 E5:2 C5:4 | F5:2 A5:2 C6:4 A5:2 F5:2 C5:4 | G5:2 B5:2 D6:4 B5:2 G5:2 D5:4 | C6:8 G5:8 |' +
           'E5:2 G5:2 C6:2 E6:2 D6:2 C6:2 G5:4 | A5:2 C6:2 F6:4 E6:2 C6:2 A5:4 | B5:2 D6:2 G6:4 F6:2 D6:2 B5:4 | G5:4 B5:4 D6:8' },
  versus: { bpm: 150, lead: 'square', arp: 1, bass: 2, drums: 'k.hsk.hsk.hsk.hs',
    chords: 'Am F G E Am F G E',
    notes: 'A5:2 E5:2 A5:2 C6:2 B5:4 A5:4 | F5:2 A5:2 C6:4 A5:2 F5:2 C5:4 | G5:2 B5:2 D6:4 B5:2 G5:2 D5:4 | E5:2 G#5:2 B5:4 E6:8 |' +
           'A5:2 C6:2 E6:4 D6:2 C6:2 A5:4 | F5:4 A5:4 C6:4 F6:4 | D6:2 B5:2 G5:2 B5:2 D6:4 G6:4 | E6:4 B5:4 G#5:4 E5:4' },
  title: { bpm: 126, lead: 'square', arp: 1, bass: 2, drums: 'k.h.s.h.k.h.s.hh',
    chords: 'C G Am F C G F G',
    notes: 'E5:2 G5:2 C6:4 B5:2 G5:2 E5:4 | D5:2 G5:2 B5:4 A5:2 G5:2 D5:4 | C5:2 E5:2 A5:4 G5:2 E5:2 C5:4 | F5:4 A5:4 G5:4 F5:2 E5:2 |' +
           'E5:2 G5:2 C6:4 D6:2 C6:2 G5:4 | B5:4 D6:4 B5:2 A5:2 G5:4 | A5:2 G5:2 F5:2 E5:2 D5:4 F5:4 | G5:6 B5:2 D6:8' },
  stage1: { bpm: 144, lead: 'square', arp: 1, bass: 2, drums: 'k.hhs.hhk.hhs.hk',
    chords: 'G D Em C G D C D',
    notes: 'B4:2 D5:2 G5:2 D5:2 B5:4 A5:2 G5:2 | F#5:2 A5:2 D6:4 C#6:2 A5:2 F#5:4 | G5:2 E5:2 B4:2 E5:2 G5:4 B5:4 | C6:4 B5:2 A5:2 G5:4 E5:4 |' +
           'D5:2 G5:2 B5:2 G5:2 D6:4 B5:4 | A5:2 F#5:2 D5:2 F#5:2 A5:4 D6:4 | E6:2 D6:2 C6:2 B5:2 A5:4 G5:4 | F#5:4 A5:4 D6:8' },
  stage2: { bpm: 96, lead: 'triangle', arp: 2, bass: 4, drums: 'k...h...s...h..h',
    chords: 'Am F C G Am F E E',
    notes: 'A4:4 C5:4 E5:6 D5:2 | C5:4 A4:4 F4:8 | E4:4 G4:4 C5:6 B4:2 | D5:8 r:8 |' +
           'E5:4 D5:4 C5:4 A4:4 | F5:6 E5:2 C5:8 | B4:4 G#4:4 E4:4 G#4:4 | B4:12 r:4' },
  boss: { bpm: 160, lead: 'square', arp: 1, bass: 1, drums: 'k.hsk.hsk.hsk.ss',
    chords: 'Dm Dm Bb C Dm Dm A A',
    notes: 'D5:2 D5:2 F5:2 D5:2 A5:2 D5:2 G5:2 F5:2 | E5:2 D5:2 C5:2 D5:2 F5:4 E5:4 | D5:2 F5:2 A#5:4 A5:2 F5:2 D5:4 | E5:2 G5:2 C6:4 A#5:2 G5:2 E5:4 |' +
           'D6:2 C6:2 A5:2 F5:2 D5:2 F5:2 A5:4 | G5:2 F5:2 E5:2 F5:2 D5:8 | C#5:2 E5:2 A5:2 E5:2 C#6:4 A5:4 | E6:4 C#6:4 A5:4 E5:4' },
  boss2: { bpm: 176, lead: 'sawtooth', arp: 1, bass: 1, drums: 'kkhskhhskkhskhss',
    chords: 'Em F Em D Em F G F',
    notes: 'E5:1 E5:1 G5:2 E5:1 E5:1 A#5:2 B5:2 A5:2 G5:2 F5:2 | F5:2 A5:2 C6:4 B5:2 A5:2 F5:4 | E5:2 B5:2 E6:4 D6:2 B5:2 G5:4 | F#5:2 A5:2 D6:4 C6:2 A5:2 F#5:4 |' +
           'G5:2 F5:2 E5:2 F5:2 G5:2 B5:2 E6:4 | F6:4 E6:2 C6:2 A5:4 F5:4 | G5:2 B5:2 D6:2 G6:2 F6:4 D6:4 | C6:4 A5:4 F5:4 E5:4' },
  ending: { bpm: 76, lead: 'triangle', arp: 2, bass: 8, drums: '',
    chords: 'F C Dm Bb F C Bb C',
    notes: 'A4:4 C5:4 F5:8 | E5:4 D5:4 C5:8 | D5:4 F5:4 A5:6 G5:2 | F5:8 D5:8 |' +
           'C5:4 F5:4 A5:4 C6:4 | G5:8 E5:8 | F5:4 D5:4 A#4:8 | C5:16' },
};
const NOTE_IDX = { C: 0, 'C#': 1, Db: 1, D: 2, 'D#': 3, Eb: 3, E: 4, F: 5, 'F#': 6, Gb: 6, G: 7, 'G#': 8, Ab: 8, A: 9, 'A#': 10, Bb: 10, B: 11 };
function noteFreq(n) {            // 'A4' → 440
  const m = /^([A-G][#b]?)(\d)$/.exec(n); if (!m) return 0;
  return 440 * Math.pow(2, (NOTE_IDX[m[1]] + (+m[2] + 1) * 12 - 69) / 12);
}
function chordNotes(name) {       // 'Am' → [A3, C4, E4] freqs
  const m = /^([A-G][#b]?)(m?)$/.exec(name); if (!m) return [220];
  const root = NOTE_IDX[m[1]] + 48;   // C3 = 48
  return [0, m[2] ? 3 : 4, 7].map(i => 440 * Math.pow(2, (root + i - 69) / 12));
}
function compileTrack(t) {
  const bars = t.chords.split(/\s+/).filter(Boolean);
  const steps = bars.length * 16;
  const lead = new Array(steps).fill(null);
  let pos = 0;
  t.notes.replace(/\|/g, ' ').split(/\s+/).filter(Boolean).forEach(tok => {
    const [n, l] = tok.split(':'); const len = +l || 1;
    if (n !== 'r' && pos < steps) lead[pos] = { f: noteFreq(n), len };
    pos += len;
  });
  return { bpm: t.bpm, steps, lead, chords: bars.map(chordNotes), t };
}

const Music = {
  out: null, volume: 0.55, track: null, want: null, timer: null, step: 0, nextTime: 0, noise: null, errors: 0,
  compiled: {},
  play(name) {
    Music.want = name;
    try { if (SFX.ctx && SFX.ctx.state === 'running') Music.start(name); } catch (e) { Music.fail(e); }
  },
  onUnlock() {
    try {
      const ctx = SFX.ctx; if (!ctx) return;
      if (ctx.state !== 'running') { ctx.resume().then(() => Music.want && Music.start(Music.want)).catch(() => {}); return; }
      if (Music.want && Music.track !== Music.want) Music.start(Music.want);
    } catch (e) { Music.fail(e); }
  },
  start(name) {
    const ctx = SFX.ctx;
    if (!ctx || !TRACKS[name]) return;
    if (Music.track === name && Music.timer) return;
    if (!Music.out) { Music.out = ctx.createGain(); Music.out.connect(ctx.destination); }
    Music.out.gain.value = SFX.muted ? 0 : Music.volume;
    if (!Music.noise) {
      const buf = ctx.createBuffer(1, ctx.sampleRate * 0.25, ctx.sampleRate), d = buf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      Music.noise = buf;
    }
    Music.compiled[name] = Music.compiled[name] || compileTrack(TRACKS[name]);
    Music.track = name; Music.step = 0; Music.nextTime = ctx.currentTime + 0.08;
    if (!Music.timer) Music.timer = setInterval(Music.tick, 30);
  },
  stop() { if (Music.timer) clearInterval(Music.timer); Music.timer = null; Music.track = null; },
  fail(e) { Music.errors++; if (Music.errors > 5) Music.stop(); try { console.warn('[music]', e && e.message); } catch (_) { /* */ } },
  tick() {
    try {
      const ctx = SFX.ctx, c = Music.compiled[Music.track];
      if (!ctx || !c) return;
      const now = ctx.currentTime, dt = 60 / c.bpm / 4;
      if (Music.nextTime < now - 0.25) Music.nextTime = now + 0.05;   // tab was in background: skip ahead, no burst
      let guard = 0;
      while (Music.nextTime < now + 0.15 && guard++ < 16) {
        if (!SFX.muted) Music.playStep(c, Music.step % c.steps, Music.nextTime, dt);
        Music.step++; Music.nextTime += dt;
      }
    } catch (e) { Music.fail(e); }
  },
  osc(type, f, t, dur, vol, slideTo) {
    const ctx = SFX.ctx, o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(f, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + 0.008);
    g.gain.setValueAtTime(vol, t + dur * 0.7); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(Music.out); o.start(t); o.stop(t + dur + 0.03);
  },
  hit(t, dur, vol, hp) {
    const ctx = SFX.ctx, s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    s.buffer = Music.noise; f.type = 'highpass'; f.frequency.value = hp;
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(Music.out); s.start(t); s.stop(t + dur + 0.02);
  },
  playStep(c, s, t, dt) {
    const tr = c.t, bar = Math.floor(s / 16), inBar = s % 16, ch = c.chords[bar % c.chords.length];
    const ln = c.lead[s];
    if (ln) Music.osc(tr.lead, ln.f, t, ln.len * dt * 0.95, tr.lead === 'triangle' ? 0.16 : tr.lead === 'sawtooth' ? 0.05 : 0.06);
    if (inBar % tr.bass === 0) Music.osc('triangle', ch[0] / 2, t, dt * tr.bass * 0.9, 0.2);
    if (inBar % tr.arp === 0) Music.osc(tr.arp > 1 ? 'triangle' : 'square', ch[(inBar / tr.arp) % 3] * 2, t, dt * tr.arp * 0.8, tr.arp > 1 ? 0.05 : 0.018);
    const d = tr.drums && tr.drums[inBar];
    if (d === 'k') Music.osc('sine', 150, t, 0.14, 0.35, 40);
    else if (d === 's') Music.hit(t, 0.12, 0.12, 1500);
    else if (d === 'h') Music.hit(t, 0.03, 0.05, 7000);
  },
};
