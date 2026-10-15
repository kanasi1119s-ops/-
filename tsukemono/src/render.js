// 店先の描画。ゲームの状態は読むだけで、書き換えない（動きを切っても遊びに影響しない）。
// 絵は参考画像のトレース（assets/img/）。季節は色の置き換え、時間帯は色のかけ合わせ。
import { SCENE } from '../assets/scene.js';
import { PERSON_ANIMS, SWAY_SEQ } from '../assets/animations.js';
import { BODIES, RECOLORS } from '../assets/characters.js';
import { resolveTheme, mix, hex } from '../assets/themes.js';
import { makeCanvas, getSprite, getText, getImage, recolor, rgbToHsl, hslToRgb } from './pixel.js';

const hash = (n) => { let x = Math.imul(n ^ 0x9e3779b9, 0x85ebca6b); x ^= x >>> 13; x = Math.imul(x, 0xc2b2ae35); return ((x ^ (x >>> 16)) >>> 0) / 4294967296; };
const inRange = (v, r) => !r || (v >= r[0] && v <= r[1]);

/** 背景の画素を分類する（季節の色替え用）。 */
function kindOf(h, s, l, x, y) {
  const [rx0, ry0, rx1, ry1] = SCENE.roofRect;
  const inShop = x > 88 && x < 300 && y > 84 && y < 196;
  if (x >= rx0 && x <= rx1 && y >= ry0 && y <= ry1 && s < 0.25 && l > 0.42) return 'roof';
  if (!inShop && y > 84 && h > 0.52 && h < 0.64 && s > 0.3) return 'water';
  if (!inShop && h > 0.16 && h < 0.52 && s > 0.12) return 'green';
  if ((y >= 202 || (x < 86 && y >= SCENE.groundY) || (x < 40 && y >= 170)) && h > 0.03 && h < 0.15 && s > 0.15 && l > 0.42 && l < 0.88) return 'ground';
  return null;
}
function applyTo(rgb, hsl, to) {
  let [h, s, l] = hsl, out = rgb;
  if (to.hue != null) { out = hslToRgb(to.hue + (h - 0.3) * 0.15, Math.max(s, to.satMin ?? 0), l); }
  if (to.mix) { const c = hex(to.mix[0]); out = out.map((v, i) => v + (c[i] - v) * to.mix[1]); }
  return out;
}
/** 人物の色の差し替え（assets/characters.js の RECOLORS）。 */
function personRecolor(rules, outfit) {
  if (!rules && !outfit) return null;
  const oc = outfit && hex(outfit[0]);
  return (r, g, b, x, y) => {
    let out = null;
    const [h, s, l] = rgbToHsl(r, g, b);
    for (const rule of rules ?? []) {
      const w = rule.when;
      if (!inRange(y, w.rows) || !inRange(h, w.hue) || !inRange(l, w.light) || !inRange(s, w.sat)) continue;
      const t = rule.to;
      let nh = t.hue ?? h, ns = t.sat ?? s, nl = l;
      if (typeof t.light === 'string') nl = Math.min(0.95, l + parseFloat(t.light));
      out = hslToRgb(nh, ns, nl);
      if (t.mix) { const c = hex(t.mix[0]); out = [r, g, b].map((v, i) => v + (c[i] - v) * t.mix[1]); }
      break;
    }
    if (oc) out = (out ?? [r, g, b]).map((v, i) => v + (oc[i] - v) * outfit[1]);
    return out;
  };
}

export class SceneRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    canvas.width = SCENE.w; canvas.height = SCENE.h;
    this.ctx = canvas.getContext('2d');
    this.ctx.imageSmoothingEnabled = false;
    this.lands = new Map();
    this.people = new Map();
  }

  /** 季節・天気で色を置き換えた背景（キャッシュ）。 */
  land(theme) {
    let c = this.lands.get(theme.landKey);
    if (c) return c;
    const rc = theme.recolor;
    c = recolor(getImage('bg'), Object.keys(rc).length ? (r, g, b, x, y) => {
      const hsl = rgbToHsl(r, g, b), k = kindOf(...hsl, x, y);
      return k && rc[k] ? applyTo([r, g, b], hsl, rc[k]) : null;
    } : null);
    this.lands.set(theme.landKey, c);
    return c;
  }

  personImage(look, outfit, flip) {
    const body = BODIES[look.body];
    const key = `${look.body}|${look.recolor ?? ''}|${outfit ?? ''}|${flip}`;
    let c = this.people.get(key);
    if (!c) {
      c = recolor(getImage(body.img), personRecolor(RECOLORS[look.recolor], outfit), { flip });
      this.people.set(key, c);
    }
    return c;
  }

  flipped(name, flip) {
    const key = `img:${name}|${flip}`;
    let c = this.people.get(key);
    if (!c) { c = recolor(getImage(name), null, { flip }); this.people.set(key, c); }
    return c;
  }

  // ---- 1コマ ----
  draw(view, tMs) {
    const g = this.ctx;
    const theme = resolveTheme(view);
    g.clearRect(0, 0, SCENE.w, SCENE.h);
    // 空
    const bandH = Math.ceil(SCENE.skyBottom / theme.skyBands.length);
    theme.skyBands.forEach((col, i) => { g.fillStyle = col; g.fillRect(0, i * bandH, SCENE.w, bandH + 1); });
    if (theme.stars) for (let i = 0; i < SCENE.stars; i++) {
      const on = Math.floor((tMs + hash(i) * 3000) / (700 + hash(i + 40) * 900)) % 2 === 0;
      g.fillStyle = on ? '#fff8d8' : '#8890b8';
      g.fillRect(Math.floor(hash(i + 7) * SCENE.w), Math.floor(hash(i + 70) * 80), 1, 1);
    }
    if (theme.sun) { const [x, y] = SCENE.sunPos[theme.sun]; g.drawImage(getSprite('sun'), x - 8, y - 8); }
    if (theme.moon) g.drawImage(getSprite('moon'), SCENE.moonPos[0], SCENE.moonPos[1]);
    // 流れる雲（画面の右端から出て、左端から戻る）
    for (const c of SCENE.clouds) {
      const img = getImage(c.img);
      const span = SCENE.w + img.width;
      const x = ((c.x0 + img.width + (tMs / 1000) * c.speed) % span) - img.width;
      if (theme.darkClouds) { g.globalAlpha = 0.85; }
      g.drawImage(img, Math.round(x), c.y);
      g.globalAlpha = 1;
    }
    // 背景（トレースした店先）
    g.drawImage(this.land(theme), 0, 0);
    if (theme.puddles) for (const [x, y] of [[20, 205], [150, 209], [300, 204], [355, 210], [70, 212]]) g.drawImage(getSprite('puddle'), x, y);
    // 売り場の樽の中身
    view.barrels.forEach((b, i) => {
      const s = SCENE.slots[i];
      g.drawImage(getImage(`slot${i}_${b.filled ? b.veg : 'empty'}`), s.x, s.y);
      const text = b.label ?? (b.selected ? '空' : null);
      if (text) this.label(text, s.cx, SCENE.labelY, b.selected);
    });
    // 吊るし物（区切りごとに、下ほど大きく1ドット揺れる）
    for (const h of SCENE.hanging) {
      const img = getImage(h.img);
      h.panels.forEach(([a, b], i) => {
        const shift = SWAY_SEQ[Math.floor((tMs + i * 377) / h.ms[i]) % SWAY_SEQ.length];
        for (let y = 0; y < img.height; y++) {
          const dx = Math.round(shift * (y / (img.height - 1)) ** 1.5);
          g.drawImage(img, a, y, b - a, 1, h.x + a + dx, h.y + y, b - a, 1);
        }
      });
    }
    // 人（足元のyが小さい順）
    const actors = [...view.actors].sort((a, b) => a.y - b.y);
    for (const a of actors) this.drawPerson(a, theme, tMs);
    this.drawParticles(theme, tMs);
    // 時間帯の色
    g.save();
    g.globalCompositeOperation = 'multiply';
    g.fillStyle = theme.tint;
    g.fillRect(0, 0, SCENE.w, SCENE.h);
    g.restore();
    if (theme.lampOn) this.glow(SCENE.doorLight.x, SCENE.doorLight.y, theme.time === 'night' ? 1 : 0.6);
    for (const a of actors) if (a.bubble) this.bubble(a);
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
    for (let r = 6; r <= 42; r += 6) {
      g.fillStyle = `rgba(255,170,60,${(0.06 * k * (46 - r)) / 46})`;
      g.fillRect(cx - r, cy - r, r * 2, r * 2 + 10);
    }
    g.restore();
  }

  /** 1枚の絵を、頭・胴・左右の脚に分けて少しずつずらして描く。 */
  drawPerson(a, theme, tMs) {
    const g = this.ctx;
    const set = PERSON_ANIMS[a.kind];
    const anim = set[a.anim] ?? set.idle;
    const total = anim.frames.reduce((s, f) => s + f.ms, 0);
    let t = Math.max(0, tMs - a.animT0);
    t = anim.loop ? t % total : Math.min(t, total - 1);
    let f = anim.frames[anim.frames.length - 1];
    for (const fr of anim.frames) { if (t < fr.ms) { f = fr; break; } t -= fr.ms; }

    const body = BODIES[a.look.body];
    const flip = !!a.flip;
    const img = this.personImage(a.look, a.kind === 'customer' ? theme.outfit : null, flip);
    const w = img.width, h = img.height, sx = flip ? -1 : 1;
    const X = Math.round(a.x - w / 2), Y = Math.round(a.y - h);
    const legX = flip ? w - body.legX : body.legX;
    const [ux, uy] = [f.up[0] * sx, f.up[1]];
    // 脚
    g.drawImage(img, 0, body.hipY, legX, h - body.hipY, X + f.legs[0] * sx, Y + body.hipY, legX, h - body.hipY);
    g.drawImage(img, legX, body.hipY, w - legX, h - body.hipY, X + legX + f.legs[1] * sx, Y + body.hipY, w - legX, h - body.hipY);
    // 胴
    g.drawImage(img, 0, body.headY, w, body.hipY - body.headY, X + ux, Y + body.headY + uy, w, body.hipY - body.headY);
    // 頭
    g.drawImage(img, 0, 0, w, body.headY, X + ux + f.head[0] * sx, Y + uy + f.head[1], w, body.headY);
    // 持ち物
    for (const p of f.props) {
      const spr = p.s === 'basket' ? this.flipped('basket', flip) : getSprite(p.s, { flip });
      const [hx, hy] = body[p.at] ?? body.hand ?? [0, 0];
      const px = flip ? w - hx - (p.dx + spr.width) : hx + p.dx;
      g.drawImage(spr, X + ux + px, Y + uy + hy + p.dy);
    }
    // 雨・雪の日の傘
    if (a.kind === 'customer' && theme.weather !== 'sunny') {
      const u = getSprite('umbrella', { pal: { u: a.look.umbrella, U: mix(a.look.umbrella, '#000000', 0.3) } });
      const ux2 = X + Math.round(w / 2 - u.width / 2) + ux, uy2 = Y + uy - 6;
      g.drawImage(u, ux2, uy2);
      if (theme.weather === 'snow') g.drawImage(getSprite('umbrella_snow'), ux2, uy2);
    }
    a.headTop = Y + uy - (a.kind === 'customer' && theme.weather !== 'sunny' ? 6 : 0);
  }

  drawParticles(theme, tMs) {
    const g = this.ctx, t = tMs / 1000, W = SCENE.w, H = SCENE.h;
    if (theme.rain) {
      g.fillStyle = 'rgba(190,215,240,0.75)';
      for (let i = 0; i < 110; i++) {
        const sp = 170 + hash(i) * 60;
        let x = (hash(i + 3) * (W + 40) - (t * sp) / 5) % (W + 40); if (x < 0) x += W + 40;
        const y = (hash(i + 9) * H + t * sp) % H;
        g.fillRect(Math.round(x), Math.round(y), 1, 3);
      }
    }
    if (theme.snow) {
      g.fillStyle = '#ffffff';
      for (let i = 0; i < 90; i++) {
        const sp = 18 + hash(i) * 22;
        let x = (hash(i + 3) * W + Math.sin(t * 0.8 + i) * 6) % W; if (x < 0) x += W;
        const y = (hash(i + 9) * H + t * sp) % H;
        const s = hash(i + 20) < 0.25 ? 2 : 1;
        g.fillRect(Math.round(x), Math.round(y), s, s);
      }
    }
    if (theme.particles) {
      const col = theme.particles === 'petal' ? ['#f9c6d4', '#ffe3ea'] : ['#e08a2c', '#b94d22', '#d9b33a'];
      for (let i = 0; i < 18; i++) {
        const sp = 10 + hash(i) * 10;
        const x = (hash(i + 3) * W + t * (6 + hash(i + 5) * 6) + Math.sin(t + i) * 5) % W;
        const y = (hash(i + 9) * H + t * sp) % H;
        g.fillStyle = col[i % col.length];
        g.fillRect(Math.round(x), Math.round(y), 2, 1);
      }
    }
  }

  bubble(a) {
    const g = this.ctx;
    const t = getText(a.bubble, { px: 10, color: '#2a1c14' });
    const w = t.width + 6, h = t.height + 2;
    let x = Math.round(a.x - w / 2), y = Math.round((a.headTop ?? a.y - 60) - h - 6);
    x = Math.max(2, Math.min(SCENE.w - w - 2, x));
    y = Math.max(2, y);
    g.fillStyle = '#2a1c14'; g.fillRect(x - 1, y - 1, w + 2, h + 2);
    g.fillStyle = '#fffdf2'; g.fillRect(x, y, w, h);
    const tx = Math.max(x + 2, Math.min(x + w - 6, Math.round(a.x) - 1));
    g.fillStyle = '#2a1c14'; g.fillRect(tx - 1, y + h + 1, 3, 1); g.fillRect(tx, y + h + 2, 1, 1);
    g.fillStyle = '#fffdf2'; g.fillRect(tx - 1, y + h, 3, 1); g.fillRect(tx, y + h + 1, 1, 1);
    g.drawImage(t, x + 3, y + 1);
  }
}
