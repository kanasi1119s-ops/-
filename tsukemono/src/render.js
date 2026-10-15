// 店先の描画。ゲームの状態は読むだけで、書き換えない（動きを切っても遊びに影響しない）。
import { SCENE } from '../assets/scene.js';
import { PERSON_ANIMS, SCENERY_ANIMS } from '../assets/animations.js';
import { PALETTE } from '../assets/sprites.js';
import { resolveTheme, mix } from '../assets/themes.js';
import { makeCanvas, getSprite, getText } from './pixel.js';

const hash = (n) => { let x = Math.imul(n ^ 0x9e3779b9, 0x85ebca6b); x ^= x >>> 13; x = Math.imul(x, 0xc2b2ae35); return ((x ^ (x >>> 16)) >>> 0) / 4294967296; };

export class SceneRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    canvas.width = SCENE.w; canvas.height = SCENE.h;
    this.ctx = canvas.getContext('2d');
    this.ctx.imageSmoothingEnabled = false;
    this.layers = new Map();
  }

  // ---- 背景（テーマごとに1回だけ描いて使い回す）----
  layersFor(theme) {
    let l = this.layers.get(theme.key);
    if (l) return l;
    l = { sky: this.drawSky(theme), land: this.drawLand(theme) };
    this.layers.set(theme.key, l);
    if (this.layers.size > 24) this.layers.delete(this.layers.keys().next().value);
    return l;
  }

  drawSky(theme) {
    const c = makeCanvas(SCENE.w, SCENE.h), g = c.getContext('2d');
    const bandH = Math.ceil(SCENE.horizonY / theme.skyBands.length);
    theme.skyBands.forEach((col, i) => { g.fillStyle = col; g.fillRect(0, i * bandH, SCENE.w, bandH + 1); });
    if (theme.sun) { const [x, y] = SCENE.sunPos[theme.sun]; g.drawImage(getSprite('sun'), x - 8, y - 8); }
    if (theme.moon) g.drawImage(getSprite('moon'), SCENE.moonPos[0], SCENE.moonPos[1]);
    return c;
  }

  drawLand(theme) {
    const c = makeCanvas(SCENE.w, SCENE.h), g = c.getContext('2d');
    const px = (x, y, w, h, col) => { g.fillStyle = col; g.fillRect(x, y, w, h); };
    const H = SCENE.horizonY;
    // 山（遠・近）
    const far = (x) => 20 + 11 * Math.sin(x * 0.028 + 1) + 6 * Math.sin(x * 0.075 + 2);
    const near = (x) => 9 + 7 * Math.sin(x * 0.045 + 4) + 3 * Math.sin(x * 0.12);
    for (let x = 0; x < SCENE.w; x++) {
      const hf = Math.round(far(x)), hn = Math.round(near(x));
      px(x, H - hf, 1, hf, theme.mountainFar);
      if (theme.snowcap && hf > 22) px(x, H - hf, 1, Math.min(4, hf - 20), '#f4f8fb');
      px(x, H - hn, 1, hn, theme.mountainNear);
      for (let y = H - hn; y < H; y += 3) if (hash(x * 131 + y) < 0.22) px(x, y, 1, 1, mix(theme.mountainNear, '#000000', 0.12));
    }
    // 田んぼ（畝）
    for (let i = 0; i < SCENE.paddyH; i += 4) {
      px(0, SCENE.paddyY + i, SCENE.w, 4, theme.paddy[(i / 4) % 2]);
      px(0, SCENE.paddyY + i + 3, SCENE.w, 1, theme.paddy[2]);
    }
    for (let i = 0; i < 90; i++) { // 稲や水面の点
      const x = Math.floor(hash(i) * SCENE.w), y = SCENE.paddyY + Math.floor(hash(i + 500) * SCENE.paddyH);
      px(x, y, 1, 1, mix(theme.paddy[i % 2], '#000000', 0.15));
    }
    px(0, SCENE.bankY, SCENE.w, SCENE.groundY - SCENE.bankY, theme.bank);
    for (let x = 0; x < SCENE.w; x += 3) if (hash(x) < 0.5) px(x, SCENE.bankY + (x % 5), 1, 2, mix(theme.bank, '#000000', 0.15));
    // 木
    g.drawImage(getSprite(theme.tree), SCENE.tree.x, SCENE.tree.y);
    // 地面
    px(0, SCENE.groundY, SCENE.w, SCENE.h - SCENE.groundY, theme.ground);
    for (let i = 0; i < 160; i++) {
      const x = Math.floor(hash(i + 900) * SCENE.w), y = SCENE.groundY + 2 + Math.floor(hash(i + 1300) * (SCENE.h - SCENE.groundY - 3));
      px(x, y, 2, 1, theme.groundShade);
    }
    if (theme.puddles) for (const [x, y] of [[40, 160], [120, 168], [200, 176], [270, 161], [80, 174]]) g.drawImage(getSprite('puddle'), x, y);
    // 離れ（左の小屋）・電柱・電線・自転車・木箱
    const sh = SCENE.shed;
    px(sh.x, sh.y, sh.w, SCENE.groundY - sh.y, '#8a6238');
    for (let x = sh.x + 3; x < sh.x + sh.w; x += 5) px(x, sh.y, 1, SCENE.groundY - sh.y, '#6a4824');
    px(sh.x + 8, sh.y + 10, 12, 16, '#2a1c14'); px(sh.x + 9, sh.y + 11, 10, 14, '#3d2a1c');
    for (let x = sh.x + 11; x < sh.x + 19; x += 3) px(x, sh.y + 11, 1, 14, '#8a6238');
    for (let y = 88; y < 98; y++) {
      const left = sh.x - 6 + (97 - y) * 3;
      for (let x = left; x < 80; x++) px(x, y, 1, 1, (y + (x >> 1)) % 3 === 0 ? PALETTE.T : PALETTE.t);
    }
    px(sh.x - 6, 96, 46, 2, PALETTE.k);
    const pl = SCENE.pole;
    px(pl.x, pl.top, 4, SCENE.groundY - pl.top + 2, '#8a8a84'); px(pl.x, pl.top, 1, SCENE.groundY - pl.top + 2, '#a8a8a2');
    px(pl.x - 6, pl.top + 4, 16, 2, '#6a5a44'); px(pl.x - 4, pl.top + 12, 12, 2, '#6a5a44');
    for (let y = 108; y < 126; y += 6) { px(pl.x, y, 4, 3, '#e6c25a'); px(pl.x, y + 3, 4, 3, '#2a1c14'); }
    for (const [y0, y1, sag] of [[pl.top + 4, 62, 8], [pl.top + 13, 70, 7], [pl.top + 5, 40, 6]]) {
      const x0 = pl.x + 4, x1 = 66;
      for (let x = x0; x <= x1; x++) { const t = (x - x0) / (x1 - x0); px(x, Math.round(y0 + (y1 - y0) * t + Math.sin(t * Math.PI) * sag), 1, 1, '#3a3a44'); }
    }
    g.drawImage(getSprite('bicycle'), SCENE.bicycle.x, SCENE.bicycle.y);
    g.drawImage(getSprite('crate'), SCENE.crate.x, SCENE.crate.y + 4);
    // 店の中（暗い土間と壁）、柱、梁
    const it = SCENE.interior;
    px(it.x, it.y, it.w, it.h, PALETTE.i);
    for (let y = it.y + 4; y < it.y + it.h; y += 6) px(it.x, y, it.w, 1, '#3d2813');
    px(it.x, SCENE.groundY - 2, it.w, 2, PALETTE.X);
    // 奥の棚と貼り紙
    px(200, 108, 38, 2, PALETTE.x); px(200, 126, 38, 2, PALETTE.x);
    for (const [x, y, w, h, col] of [[203, 100, 8, 8, '#8d8d88'], [214, 102, 7, 6, '#c18c52'], [224, 99, 9, 9, '#8d8d88'], [204, 118, 9, 8, '#c18c52'], [218, 117, 8, 9, '#8d8d88']]) px(x, y, w, h, col);
    px(184, 84, 14, 10, '#d8cfae'); px(185, 85, 12, 8, '#efe6c8');
    for (let y = 87; y < 92; y += 2) px(187, y, 8, 1, '#8a7a5a');
    // 屋根・看板
    g.drawImage(getSprite('roof'), SCENE.roof.x, SCENE.roof.y);
    if (theme.roofSnow) g.drawImage(getSprite('roof_snow'), SCENE.roof.x, SCENE.roof.y - 1);
    const sg = SCENE.sign;
    g.drawImage(getSprite('signboard'), sg.x, sg.y);
    const t = getText(sg.text, { px: 13, color: '#2a1c14' });
    g.drawImage(t, Math.round(sg.x + (sg.w - t.width) / 2), sg.y + 1);
    for (const p of SCENE.posts) px(p.x, p.y, p.w, p.h, PALETTE.x), px(p.x, p.y, 1, p.h, PALETTE.W);
    px(SCENE.beam.x, SCENE.beam.y, SCENE.beam.w, SCENE.beam.h, PALETTE.X);
    return c;
  }

  // ---- 1コマ ----
  draw(view, tMs) {
    const g = this.ctx;
    const theme = resolveTheme(view);
    const L = this.layersFor(theme);
    g.clearRect(0, 0, SCENE.w, SCENE.h);
    g.drawImage(L.sky, 0, 0);
    if (theme.stars) for (let i = 0; i < SCENE.stars; i++) {
      const on = Math.floor((tMs + hash(i) * 3000) / (700 + hash(i + 40) * 900)) % 2 === 0;
      g.fillStyle = on ? '#fff8d8' : '#8890b8';
      g.fillRect(Math.floor(hash(i + 7) * SCENE.w), Math.floor(hash(i + 70) * 70), 1, 1);
    }
    // 雲
    for (const c of SCENERY_ANIMS.clouds) {
      const spr = getSprite(c.s, theme.darkClouds ? { pal: { w: '#aab3be', D: '#8590a0' } } : theme.time === 'night' ? { pal: { w: '#9aa4c8', D: '#7480a8' } } : undefined);
      const span = SCENE.w + spr.width + 40;
      const x = ((c.x0 + (tMs / 1000) * c.speed) % span) - spr.width - 20;
      g.drawImage(spr, Math.round(x), c.y);
    }
    g.drawImage(L.land, 0, 0);
    // 吊るし物（コマ送り）
    const swing = (a) => {
      const i = Math.floor((tMs + a.phase) / a.ms) % a.seq.length;
      g.drawImage(getSprite(a.seq[i]), a.x, a.y);
    };
    SCENERY_ANIMS.daikon.forEach(swing);
    SCENERY_ANIMS.chili.forEach(swing);
    SCENERY_ANIMS.noren.forEach(swing);
    SCENE.noren.texts.forEach((ch, i) => {
      if (!ch) return;
      const tx = getText(ch, { px: 11, color: '#f6f1e4' });
      g.drawImage(tx, SCENE.noren.x + i * SCENE.noren.w + Math.round((19 - tx.width) / 2), SCENE.noren.y + 3);
    });
    g.drawImage(getSprite('lantern'), SCENE.lantern.x, SCENE.lantern.y);
    // 樽
    view.barrels.forEach((b, i) => {
      const x = SCENE.barrels[i].x, y = SCENE.groundY - SCENE.barrelH;
      g.drawImage(getSprite(b.filled ? 'barrel_full' : 'barrel_empty', b.filled ? { pal: { w: b.veg === 'kyuri' ? '#6fae4a' : '#dfe9b8' } } : undefined), x, y);
      g.drawImage(getSprite('tag'), x + 3, SCENE.groundY - 12);
      if (b.label) this.label(b.label, x + SCENE.barrelW / 2, SCENE.groundY + 2, b.selected);
      else if (b.selected) this.label('空', x + SCENE.barrelW / 2, SCENE.groundY + 2, true);
    });
    // 人（足元のyが小さい順に描く）
    const actors = [...view.actors].sort((a, b) => a.y - b.y);
    for (const a of actors) this.drawPerson(a, theme, tMs);
    // 天気・季節の粒
    this.drawParticles(theme, tMs);
    // 時間帯の色
    g.save();
    g.globalCompositeOperation = 'multiply';
    g.fillStyle = theme.tint;
    g.fillRect(0, 0, SCENE.w, SCENE.h);
    g.restore();
    if (theme.lampOn) this.glow(SCENE.lantern.x + 4, SCENE.lantern.y + 5, theme.time === 'night' ? 1 : 0.6);
    // 吹き出し
    for (const a of actors) if (a.bubble) this.bubble(a, a.kind === 'customer' && theme.weather !== 'sunny' ? 8 : 0);
  }

  label(text, cx, y, selected) {
    const g = this.ctx, t = getText(text, { px: 10, color: '#f6f1e4' });
    const w = t.width + 4, x = Math.round(cx - w / 2);
    g.fillStyle = selected ? '#c63d2f' : '#2a1c14';
    g.fillRect(x, y, w, 13);
    g.drawImage(t, x + 2, y);
  }

  glow(cx, cy, k) {
    const g = this.ctx;
    g.save();
    g.globalCompositeOperation = 'lighter';
    for (let r = 4; r <= 28; r += 4) {
      g.fillStyle = `rgba(255,170,60,${(0.07 * k * (30 - r)) / 30})`;
      g.fillRect(cx - r, cy - r + 2, r * 2, r * 2 - 4);
    }
    g.restore();
  }

  drawPerson(a, theme, tMs) {
    const g = this.ctx;
    const set = PERSON_ANIMS[a.kind];
    const anim = set[a.anim] ?? set.idle;
    const total = anim.frames.reduce((s, f) => s + f.ms, 0);
    let t = Math.max(0, tMs - a.animT0);
    t = anim.loop ? t % total : Math.min(t, total - 1);
    let frame = anim.frames[anim.frames.length - 1];
    for (const f of anim.frames) { if (t < f.ms) { frame = f; break; } t -= f.ms; }
    const look = a.look;
    const outfit = theme.outfit;
    const pal = a.kind === 'customer'
      ? { h: look.hair, c: mix(look.clothes, outfit.toward, outfit.amt), C: mix(look.clothes2, outfit.toward, outfit.amt), p: mix(look.pants, outfit.toward, outfit.amt * 0.6), s: look.skin ?? PALETTE.s }
      : { h: look.hair, c: look.clothes, C: look.clothes2, p: look.pants, s: look.skin ?? PALETTE.s, a: look.apron ?? PALETTE.a };
    const style = look.style;
    const flipAll = a.facing === -1;
    const W = 12;
    const place = (name, lx, ly, flip, extraPal) => {
      const spr = getSprite(name, { pal: extraPal ? { ...pal, ...extraPal } : pal, flip: flip !== flipAll });
      const dx = flipAll ? W - lx - spr.width : lx;
      g.drawImage(spr, Math.round(a.x - W / 2 + dx), Math.round(a.y - 21 + ly));
    };
    const layers = [...frame.layers];
    if (a.kind === 'keeper') layers.splice(2, 0, { s: 'apron', x: 3, y: 12 + frame.bob });
    for (const l of layers) {
      const name = l.s === '@head' ? `head_${style}` : l.s === '@head_talk' ? `head_${style}_talk` : l.s;
      place(name, l.x, l.y, !!l.flip);
    }
    if (a.kind === 'customer') {
      const bob = frame.bob;
      if (look.pack) place('acc_randoseru', 0, 9 + bob, false);
      if (outfit.scarf) place('acc_scarf', 2, 7 + bob, false, { r: '#c63d2f', R: '#8f2a20' });
      if (outfit.hat && look.hat && theme.weather === 'sunny') place('acc_strawhat', 0, bob, false);
      if (theme.weather !== 'sunny') {
        place('acc_umbrella', -4, -7 + bob, false, { u: look.umbrella, U: mix(look.umbrella, '#000000', 0.3) });
        if (theme.weather === 'snow') place('acc_umbrella_snow', -4, -7 + bob, false);
      }
    }
  }

  drawParticles(theme, tMs) {
    const g = this.ctx, t = tMs / 1000;
    if (theme.rain) {
      g.fillStyle = 'rgba(190,215,240,0.75)';
      for (let i = 0; i < 90; i++) {
        const sp = 150 + hash(i) * 60;
        const x = (hash(i + 3) * (SCENE.w + 40) - ((t * sp) / 5)) % (SCENE.w + 40);
        const y = (hash(i + 9) * SCENE.h + t * sp) % SCENE.h;
        g.fillRect(Math.round(x < 0 ? x + SCENE.w + 40 : x), Math.round(y), 1, 3);
      }
    }
    if (theme.snow) {
      g.fillStyle = '#ffffff';
      for (let i = 0; i < 70; i++) {
        const sp = 18 + hash(i) * 22;
        const x = (hash(i + 3) * SCENE.w + Math.sin(t * 0.8 + i) * 6) % SCENE.w;
        const y = (hash(i + 9) * SCENE.h + t * sp) % SCENE.h;
        const s = hash(i + 20) < 0.25 ? 2 : 1;
        g.fillRect(Math.round(x < 0 ? x + SCENE.w : x), Math.round(y), s, s);
      }
    }
    if (theme.particles && !theme.rain && !theme.snow) {
      const col = theme.particles === 'petal' ? ['#f9c6d4', '#ffe3ea'] : ['#e08a2c', '#b94d22', '#d9b33a'];
      for (let i = 0; i < 16; i++) {
        const sp = 10 + hash(i) * 10;
        const x = (hash(i + 3) * SCENE.w + t * (6 + hash(i + 5) * 6) + Math.sin(t + i) * 5) % SCENE.w;
        const y = (hash(i + 9) * SCENE.h + t * sp) % SCENE.h;
        g.fillStyle = col[i % col.length];
        g.fillRect(Math.round(x), Math.round(y), 2, 1);
      }
    }
  }

  bubble(a, lift = 0) {
    const g = this.ctx;
    const t = getText(a.bubble, { px: 10, color: '#2a1c14' });
    const w = t.width + 6, h = t.height + 2;
    let x = Math.round(a.x - w / 2), y = Math.round(a.y - 21 - lift - h - 10);
    x = Math.max(2, Math.min(SCENE.w - w - 2, x));
    y = Math.max(2, y);
    g.fillStyle = '#2a1c14'; g.fillRect(x - 1, y - 1, w + 2, h + 2);
    g.fillStyle = '#fffdf2'; g.fillRect(x, y, w, h);
    const tx = Math.max(x + 2, Math.min(x + w - 6, Math.round(a.x) - 1));
    g.fillStyle = '#2a1c14'; g.fillRect(tx - 1, y + h + 1, 3, 1); g.fillRect(tx, y + h + 2, 1, 1);
    g.fillStyle = '#fffdf2'; g.fillRect(tx, y + h, 1, 1); g.fillRect(tx - 1, y + h, 3, 1); g.fillRect(tx, y + h + 1, 1, 1);
    g.drawImage(t, x + 3, y + 1);
  }
}
