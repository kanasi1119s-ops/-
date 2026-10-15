// 音（BGMと効果音）。音源ファイルは使わず、ブラウザの合成音（Web Audio）で鳴らす。
// 曲は下の SONGS に、MML（音符の文字列）で書いてある。音階は和風（陽音階・都節）。
//   o4 = オクターブ4、l8 = 既定の長さ8分、c d e f g a b = 音、+ = シャープ、- = フラット、
//   r = 休み、. = 付点、< > = オクターブ上げ下げ、数字 = 長さ（4=4分、8=8分、16=16分）
// 押してから鳴らす（ブラウザは操作の前に音を出せない）。

export const SONGS = {
  // タイトル: 箏と尺八のゆっくりした曲（都節: レ ミ♭ ソ ラ シ♭）
  title: {
    bpm: 76,
    tracks: [
      { inst: 'flute', vol: 0.22, mml: 'o5 l4 d2 e-8d8 c4 | <a2 >c4 d4 | e-2 d8c8 <a4 | g1 | a2 >c4 d4 | e-4 g4 f8e-8 d4 | c4 <a4 b-4 a4 | d1' },
      { inst: 'koto', vol: 0.2, mml: 'o4 l8 d a >d <a e- >g d <a | d a >d <a c g >c <g | e- b- >e- <b- d a >d <a | g >d g d <g >d g d | <d a >d <a c g >c <g | e- b- >e- <b- g >d g d | c g >c <g <b- >f b- f | d a >d <a d a >d <a' },
      { inst: 'bass', vol: 0.18, mml: 'o3 l2 d d | c c | e- d | g g | d c | e- g | c <b- | >d d' },
    ],
  },
  // 朝〜昼: 店を開けている明るい曲（陽音階: レ ミ ソ ラ シ）
  day: {
    bpm: 112,
    tracks: [
      { inst: 'shami', vol: 0.2, mml: 'o5 l8 d d e g a4 g e | d e g a b4 a g | a4 g e d e g4 | e d <b >d e4 r4 | d d e g a4 g e | b >d <b a g4 e g | a b a g e d e g | d2 r4 r4' },
      { inst: 'koto', vol: 0.12, mml: 'o4 l8 d a >d <a d a >d <a | g >d g d <g >d g d | <a >e a e <a >e a e | <b >e g e <b >e g e | <d a >d <a d a >d <a | e b >e <b e b >e <b | a >e a e <g >d g d | <d a >d <a d4 r4' },
      { inst: 'bass', vol: 0.2, mml: 'o3 l4 d r d r | g r g r | a r a r | e r e r | d r d r | e r e r | a r g r | d r d r' },
      { inst: 'block', vol: 0.18, mml: 'o5 l8 c r c c c r c r | c r c c c r c r | c r c c c r c r | c r c c c r c c | c r c c c r c r | c r c c c r c r | c r c c c r c r | c r c c c c c c' },
      { inst: 'taiko', vol: 0.3, mml: 'o2 l4 c r r c8 c8 | c r r r | c r r c8 c8 | c r c r | c r r c8 c8 | c r r r | c r c r | c c c r' },
    ],
  },
  // 夕方: 少しゆったり、さみしさのある曲（都節）
  evening: {
    bpm: 92,
    tracks: [
      { inst: 'shami', vol: 0.18, mml: 'o5 l8 a4 b- a g4 e- d | e-4 d c <a2 | >d4 e- d c4 <a b- | a2 r2 | >a4 b- a >d4 c <b- | a4 g e- d2 | e-4 d c <a b- >c d | d2 r2' },
      { inst: 'koto', vol: 0.12, mml: 'o4 l8 d a >d <a d a >d <a | c g >c <g c g >c <g | <b- >f b- f <b- >f b- f | <a >e a e <a >e a e | d a >d <a d a >d <a | e- b- >e- <b- e- b- >e- <b- | c g >c <g <a >e a e | d a >d <a d4 r4' },
      { inst: 'bass', vol: 0.18, mml: 'o3 l2 d d | c c | <b- b- | a a | >d d | e- e- | c <a | >d d' },
      { inst: 'block', vol: 0.12, mml: 'o5 l4 c r c r | c r c r | c r c r | c r c8 c8 r | c r c r | c r c r | c r c r | c r r r' },
    ],
  },
  // 夜: 尺八だけの静かな曲
  night: {
    bpm: 66,
    tracks: [
      { inst: 'flute', vol: 0.2, mml: 'o5 l4 a2 g8e8 d4 | e2. r4 | d4 e4 g4 a8g8 | e1 | a2 >c4 <b4 | a2 g8e8 d4 | e4 g4 e4 d4 | d1' },
      { inst: 'koto', vol: 0.08, mml: 'o4 l2 d a | e b | g >d | <a e | d a | e b | g e | d r' },
    ],
  },
};

// 効果音: [楽器, 音名列, 長さ(秒)]
const SFX = {
  click: [['blip', 'o6 l32 c']],
  select: [['blip', 'o6 l32 e g']],
  open: [['koto', 'o5 l32 d a']],
  close: [['koto', 'o5 l32 a d']],
  brew: [['splash'], ['taiko', 'o2 l8 c']],
  care: [['brush']],
  stir: [['brush'], ['brush', null, 0.15]],
  coin: [['coin', 'o6 l32 b >e']],
  bad: [['buzz', 'o3 l8 c <b']],
  taste: [['blip', 'o5 l32 g >c e']],
  found: [['koto', 'o5 l32 d e g a b >d']],
  regular: [['koto', 'o5 l16 g a b >d']],
  dayEnd: [['koto', 'o4 l16 d a >d e g a'], ['taiko', 'o2 l4 c']],
  buy: [['coin', 'o5 l16 g b >d g']],
  next: [['block', 'o5 l16 c c']],
  error: [['buzz', 'o3 l16 c']],
  discard: [['splash']],
};

const NOTE = { c: 0, d: 2, e: 4, f: 5, g: 7, a: 9, b: 11 };
const freqOf = (midi) => 440 * 2 ** ((midi - 69) / 12);

/** MML を [{ t:拍, len:拍, midi|null }] にする。 */
export function parseMML(mml) {
  const out = [];
  let o = 4, l = 4, t = 0, i = 0;
  const s = mml.replace(/\|/g, ' ');
  const num = () => { let n = ''; while (/[0-9]/.test(s[i] ?? '')) n += s[i++]; return n ? +n : null; };
  while (i < s.length) {
    const ch = s[i++].toLowerCase();
    if (ch === 'o') o = num() ?? o;
    else if (ch === 'l') l = num() ?? l;
    else if (ch === '<') o--;
    else if (ch === '>') o++;
    else if (NOTE[ch] != null || ch === 'r') {
      let semi = 0;
      while (s[i] === '+' || s[i] === '-') semi += s[i++] === '+' ? 1 : -1;
      const n = num() ?? l;
      let len = 4 / n;
      if (s[i] === '.') { len *= 1.5; i++; }
      out.push({ t, len, midi: ch === 'r' ? null : 12 * (o + 1) + NOTE[ch] + semi });
      t += len;
    }
  }
  return { notes: out, beats: t };
}

export class Sound {
  constructor() {
    this.ctx = null;
    this.bgmVol = 0.6;
    this.seVol = 0.8;
    this.song = null;
    this.loopTimer = null;
    this.rain = null;
  }

  /** 最初の操作のときに呼ぶ（それまでは鳴らせない）。 */
  unlock() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain(); this.master.connect(this.ctx.destination);
    this.bgmBus = this.ctx.createGain(); this.bgmBus.gain.value = this.bgmVol; this.bgmBus.connect(this.master);
    this.seBus = this.ctx.createGain(); this.seBus.gain.value = this.seVol; this.seBus.connect(this.master);
    // 簡単な響き（ディレイ）
    const d = this.ctx.createDelay(); d.delayTime.value = 0.18;
    const fb = this.ctx.createGain(); fb.gain.value = 0.25;
    const wet = this.ctx.createGain(); wet.gain.value = 0.22;
    this.bgmBus.connect(d); d.connect(fb); fb.connect(d); d.connect(wet); wet.connect(this.master);
    this.noiseBuf = this.ctx.createBuffer(1, this.ctx.sampleRate, this.ctx.sampleRate);
    const ch = this.noiseBuf.getChannelData(0);
    for (let k = 0; k < ch.length; k++) ch[k] = Math.random() * 2 - 1;
    if (this.pending) { const p = this.pending; this.pending = null; this.play(p); }
  }

  setVolumes(bgm, se) {
    this.bgmVol = bgm; this.seVol = se;
    if (this.ctx) { this.bgmBus.gain.value = bgm; this.seBus.gain.value = se; }
  }

  // ---- 楽器（1音） ----
  voice(inst, midi, when, dur, vol, out) {
    const c = this.ctx;
    const g = c.createGain(); g.connect(out);
    const env = (a, peak, decay, sustain = 0) => {
      g.gain.setValueAtTime(0.0001, when);
      g.gain.linearRampToValueAtTime(peak, when + a);
      g.gain.exponentialRampToValueAtTime(Math.max(0.0001, peak * sustain || 0.0001), when + a + decay);
    };
    const osc = (type, f) => { const o = c.createOscillator(); o.type = type; o.frequency.value = f; return o; };
    const noise = () => { const n = c.createBufferSource(); n.buffer = this.noiseBuf; return n; };
    const f = midi != null ? freqOf(midi) : 0;
    const stopAt = when + dur + 0.3;
    switch (inst) {
      case 'shami': { // 三味線っぽい: のこぎり波をすぐ減衰、明るめのフィルタ
        const o = osc('sawtooth', f), lp = c.createBiquadFilter(); lp.type = 'lowpass';
        lp.frequency.setValueAtTime(f * 8, when); lp.frequency.exponentialRampToValueAtTime(f * 1.5, when + 0.25);
        o.connect(lp); lp.connect(g); env(0.004, vol, Math.min(0.5, dur + 0.1));
        o.frequency.setValueAtTime(f * 1.02, when); o.frequency.exponentialRampToValueAtTime(f, when + 0.03); // さわり
        o.start(when); o.stop(stopAt); break;
      }
      case 'koto': { // 箏っぽい: 三角波＋倍音、やわらかく減衰
        const o = osc('triangle', f), o2 = osc('sine', f * 2), g2 = c.createGain(); g2.gain.value = 0.3;
        o.connect(g); o2.connect(g2); g2.connect(g); env(0.003, vol, Math.min(1.2, dur * 2 + 0.2));
        o.start(when); o2.start(when); o.stop(stopAt + 0.6); o2.stop(stopAt + 0.6); break;
      }
      case 'flute': { // 尺八っぽい: 正弦波にゆれ（ビブラート）と息の音
        const o = osc('sine', f), lfo = osc('sine', 5), lg = c.createGain(); lg.gain.value = f * 0.012;
        lfo.connect(lg); lg.connect(o.frequency);
        const n = noise(), bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = f * 2; bp.Q.value = 2;
        const ng = c.createGain(); ng.gain.value = 0.18; n.connect(bp); bp.connect(ng); ng.connect(g);
        o.connect(g);
        g.gain.setValueAtTime(0.0001, when); g.gain.linearRampToValueAtTime(vol, when + 0.08);
        g.gain.setValueAtTime(vol, when + Math.max(0.09, dur - 0.08)); g.gain.linearRampToValueAtTime(0.0001, when + dur + 0.05);
        o.start(when); lfo.start(when); n.start(when); o.stop(stopAt); lfo.stop(stopAt); n.stop(stopAt); break;
      }
      case 'bass': {
        const o = osc('triangle', f);
        o.connect(g); env(0.01, vol, dur * 0.9 + 0.05, 0.4);
        o.start(when); o.stop(stopAt); break;
      }
      case 'blip': case 'coin': {
        const o = osc(inst === 'coin' ? 'square' : 'square', f);
        o.connect(g); env(0.002, vol * 0.5, inst === 'coin' ? 0.25 : 0.06);
        o.start(when); o.stop(when + 0.35); break;
      }
      case 'buzz': {
        const o = osc('sawtooth', f), lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 600;
        o.connect(lp); lp.connect(g); env(0.005, vol * 0.6, dur + 0.05, 0.5);
        o.start(when); o.stop(stopAt); break;
      }
      case 'block': { // 拍子木・木魚っぽい
        const o = osc('sine', 1400), o2 = osc('square', 900), g2 = c.createGain(); g2.gain.value = 0.15;
        o.connect(g); o2.connect(g2); g2.connect(g); env(0.001, vol, 0.05);
        o.start(when); o2.start(when); o.stop(when + 0.1); o2.stop(when + 0.1); break;
      }
      case 'taiko': { // 太鼓: 低い音が下がる＋皮の雑音
        const o = osc('sine', 110); o.frequency.setValueAtTime(140, when); o.frequency.exponentialRampToValueAtTime(55, when + 0.25);
        o.connect(g); env(0.002, vol, 0.4);
        const n = noise(), lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 300;
        const ng = c.createGain(); ng.gain.setValueAtTime(vol * 0.5, when); ng.gain.exponentialRampToValueAtTime(0.0001, when + 0.12);
        n.connect(lp); lp.connect(ng); ng.connect(out);
        o.start(when); n.start(when); o.stop(when + 0.5); n.stop(when + 0.2); break;
      }
      case 'splash': { // 水の音
        const n = noise(), bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 1.5;
        bp.frequency.setValueAtTime(2500, when); bp.frequency.exponentialRampToValueAtTime(500, when + 0.4);
        n.connect(bp); bp.connect(g); env(0.01, vol * 0.9, 0.45);
        n.start(when); n.stop(when + 0.5); break;
      }
      case 'brush': { // かき混ぜ・ふき取り
        const n = noise(), bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 0.8;
        bp.frequency.setValueAtTime(800, when); bp.frequency.linearRampToValueAtTime(1600, when + 0.2);
        n.connect(bp); bp.connect(g); env(0.05, vol * 0.5, 0.25);
        n.start(when); n.stop(when + 0.35); break;
      }
      default: break;
    }
  }

  /** 効果音を鳴らす。 */
  se(name) {
    if (!this.ctx) return;
    const list = SFX[name];
    if (!list) return;
    const now = this.ctx.currentTime + 0.01;
    for (const [inst, mml, delay = 0] of list) {
      if (!mml) { this.voice(inst, null, now + delay, 0.2, 0.7, this.seBus); continue; }
      const { notes } = parseMML(mml);
      const beat = 60 / 140;
      for (const n of notes) if (n.midi != null) this.voice(inst, n.midi, now + delay + n.t * beat, n.len * beat, 0.6, this.seBus);
    }
  }

  /** BGMを切り替える（同じ曲なら何もしない）。null で止める。 */
  play(name) {
    if (!this.ctx) { this.pending = name; return; }
    if (this.song?.name === name) return;
    this.stop();
    if (!name || !SONGS[name]) return;
    const def = SONGS[name];
    const beat = 60 / def.bpm;
    const tracks = def.tracks.map((tr) => ({ ...tr, ...parseMML(tr.mml) }));
    const beats = Math.max(...tracks.map((t) => t.beats));
    const song = { name, gain: this.ctx.createGain() };
    song.gain.connect(this.bgmBus);
    song.gain.gain.setValueAtTime(0.0001, this.ctx.currentTime);
    song.gain.gain.linearRampToValueAtTime(1, this.ctx.currentTime + 0.8);
    this.song = song;
    let start = this.ctx.currentTime + 0.1;
    // 先の1周ぶんを予約し、終わる少し前に次の周を予約する
    const schedule = () => {
      if (this.song !== song) return;
      for (const tr of tracks) {
        for (const n of tr.notes) {
          if (n.midi == null) continue;
          this.voice(tr.inst, n.midi, start + n.t * beat, n.len * beat * 0.95, tr.vol, song.gain);
        }
      }
      const loopLen = beats * beat;
      const nextAt = start + loopLen;
      start = nextAt;
      this.loopTimer = setTimeout(schedule, Math.max(50, (nextAt - this.ctx.currentTime - 1.0) * 1000));
    };
    schedule();
  }

  stop() {
    clearTimeout(this.loopTimer);
    if (this.song && this.ctx) {
      const g = this.song.gain, t = this.ctx.currentTime;
      g.gain.cancelScheduledValues(t); g.gain.setValueAtTime(g.gain.value, t); g.gain.linearRampToValueAtTime(0.0001, t + 0.6);
      setTimeout(() => g.disconnect(), 800);
    }
    this.song = null;
  }

  /** 雨音（天気が雨・雪のとき）。 */
  setRain(on) {
    if (!this.ctx) return;
    if (on && !this.rain) {
      const n = this.ctx.createBufferSource(); n.buffer = this.noiseBuf; n.loop = true;
      const lp = this.ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1800;
      const g = this.ctx.createGain(); g.gain.value = 0.0001; g.gain.linearRampToValueAtTime(0.06, this.ctx.currentTime + 1.5);
      n.connect(lp); lp.connect(g); g.connect(this.bgmBus); n.start();
      this.rain = { n, g };
    } else if (!on && this.rain) {
      const { n, g } = this.rain; const t = this.ctx.currentTime;
      g.gain.linearRampToValueAtTime(0.0001, t + 1); n.stop(t + 1.1); this.rain = null;
    }
  }
}

export const SONG_NAMES = Object.keys(SONGS);
export const SFX_NAMES = Object.keys(SFX);
