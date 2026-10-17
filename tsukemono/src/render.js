// 店先の描画。ゲームの状態は読むだけで、書き換えない（動きを切っても遊びに影響しない）。
// 絵は参考画像のトレース（assets/img/）。季節は色の置き換え、時間帯は色のかけ合わせ。
import { SCENE } from '../assets/scene.js';
import { PERSON_ANIMS, POSE_ANIMS, SWAY_SEQ } from '../assets/animations.js';
import { BODIES, RECOLORS } from '../assets/characters.js';
import { WALK } from '../assets/walk.js';
import { MOUTHS } from '../assets/mouths.js';
import { resolveTheme, mix, hex } from '../assets/themes.js';
import { makeCanvas, getSprite, getText, getImage, recolor, rgbToHsl, hslToRgb } from './pixel.js';

const hash = (n) => { let x = Math.imul(n ^ 0x9e3779b9, 0x85ebca6b); x ^= x >>> 13; x = Math.imul(x, 0xc2b2ae35); return ((x ^ (x >>> 16)) >>> 0) / 4294967296; };
const inRange = (v, r) => !r || (v >= r[0] && v <= r[1]);

/** 背景の画素を分類する（季節の色替え用）。 */
function kindOf(h, s, l, x, y) {
  const [rx0, ry0, rx1, ry1] = SCENE.roofRect;
  const inShop = x > 176 && x < 600 && y > 168 && y < 392;
  if (x >= rx0 && x <= rx1 && y >= ry0 && y <= ry1 && s < 0.25 && l > 0.42) return 'roof';
  if (!inShop && y > 168 && h > 0.52 && h < 0.64 && s > 0.3) return 'water';
  if (!inShop && h > 0.16 && h < 0.52 && s > 0.12) return 'green';
  if ((y >= 404 || (x < 172 && y >= SCENE.groundY) || (x < 80 && y >= 340)) && h > 0.03 && h < 0.15 && s > 0.15 && l > 0.42 && l < 0.88) return 'ground';
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

  /** 人物の絵（色の差し替え・季節の服・左右反転を済ませたもの。キャッシュ）。 */
  personImage(img, look, outfit, flip) {
    const key = `${img}|${look.recolor ?? ''}|${outfit ?? ''}|${flip}`;
    let c = this.people.get(key);
    if (!c) {
      c = recolor(getImage(img), personRecolor(RECOLORS[look.recolor], outfit), { flip });
      this.people.set(key, c);
    }
    return c;
  }

  /** 絵の形のまま白くしたもの（白い膜の表示用）。 */
  whiteOf(name) {
    const key = `white:${name}`;
    let c = this.people.get(key);
    if (!c) { c = recolor(getImage(name), (r, gg, b, x, y) => ((x * 7 + y * 13) % 5 < 3 ? [236, 238, 232] : [210, 214, 206])); this.people.set(key, c); }
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
      g.fillRect(Math.floor(hash(i + 7) * SCENE.w), Math.floor(hash(i + 70) * 160), 1, 1);
    }
    if (theme.sun) { const [x, y] = SCENE.sunPos[theme.sun]; g.drawImage(getSprite('sun'), x - 16, y - 16); }
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
    if (theme.puddles) for (const [x, y] of [[40, 410], [300, 418], [600, 408], [710, 420], [140, 424]]) g.drawImage(getSprite('puddle'), x, y);
    // 売り場の樽の中身
    view.barrels.forEach((b, i) => {
      const s = SCENE.slots[i] ?? SCENE.extraSlots[i - SCENE.slots.length];
      if (!s) return;
      const top = `slot${i}_${b.filled ? (b.top ?? b.veg) : 'empty'}`;
      // 中身の絵は、樽の口の内側に収まる位置へ（tools/barrel_tops.py が背景から測った位置）。4・5個目の樽は絵なし
      const mouth = MOUTHS[top];
      if (mouth) g.drawImage(getImage(top), mouth.x, mouth.y);
      if (mouth && b.film >= 0.15) { // 白い膜（濃さは膜の量）
        g.globalAlpha = Math.min(0.85, b.film);
        g.drawImage(this.whiteOf(top), mouth.x, mouth.y);
        g.globalAlpha = 1;
      }
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
    if (this.drawBubbles !== false) for (const a of actors) if (a.bubble) this.bubble(a); // ゲーム画面では吹き出しを文字の読みやすいDOMで重ねる（main.js）
  }

  label(text, cx, y, selected) {
    const g = this.ctx, t = getText(text, { px: 20, color: '#f6f1e4' });
    const w = t.width + 8, x = Math.round(cx - w / 2);
    g.fillStyle = selected ? '#c63d2f' : '#2a1c14';
    g.fillRect(x, y, w, 26);
    g.drawImage(t, x + 4, y);
  }

  glow(cx, cy, k) {
    const g = this.ctx;
    g.save();
    g.globalCompositeOperation = 'lighter';
    for (let r = 12; r <= 84; r += 12) {
      g.fillStyle = `rgba(255,170,60,${(0.06 * k * (92 - r)) / 92})`;
      g.fillRect(cx - r, cy - r, r * 2, r * 2 + 20);
    }
    g.restore();
  }

  /** 人を描く。ポーズ集の人は絵を差し替え、それ以外は1枚の絵を部分ごとにずらす。 */
  drawPerson(a, theme, tMs) {
    const body = BODIES[a.look.body];
    const set = body.kind === 'poses' ? POSE_ANIMS[a.look.body] : PERSON_ANIMS;
    const anim = set[a.anim] ?? set.idle;
    const total = anim.frames.reduce((s, f) => s + f.ms, 0);
    let t = Math.max(0, tMs - a.animT0);
    t = anim.loop ? t % total : Math.min(t, total - 1);
    let f = anim.frames[anim.frames.length - 1];
    for (const fr of anim.frames) { if (t < fr.ms) { f = fr; break; } t -= fr.ms; }
    // 絵の向きと進む向きが逆なら左右反転
    const flip = body.faces === 'right' ? (a.dir ?? -1) < 0 : body.faces === 'left' ? (a.dir ?? -1) > 0 : false;
    const outfit = a.kind === 'customer' ? theme.outfit : null;
    // 足もとの影（歩くコマは絵の中に影がある）
    if (f.walk == null) {
      const pw = body.kind === 'poses' ? body.poses[f.pose].w : getImage(body.img).width;
      this.groundShadow(a.x, a.y, Math.max(16, Math.round(pw * 0.62)));
    }
    const top = body.kind === 'poses' ? this.drawPose(a, body, f, flip, outfit) : this.drawShift(a, body, f, flip, outfit);
    // 雨・雪の日の傘
    let headTop = top.y;
    if (a.kind === 'customer' && theme.weather !== 'sunny' && !a.look.ownUmbrella) {
      const u = getSprite('umbrella', { pal: { u: a.look.umbrella, U: mix(a.look.umbrella, '#000000', 0.3) } });
      const ux = Math.round(top.cx - u.width / 2), uy = top.y - 12;
      this.ctx.drawImage(u, ux, uy);
      if (theme.weather === 'snow') this.ctx.drawImage(getSprite('umbrella_snow'), ux, uy);
      headTop -= 12;
    }
    a.headTop = headTop;
  }

  drawProps(props, body, X, Y, w, flip, ox = 0, oy = 0) {
    for (const p of props) {
      const spr = p.s === 'basket' ? this.flipped('basket', flip) : getSprite(p.s, { flip });
      const [hx, hy] = body[p.at] ?? body.hand ?? [0, 0];
      const px = flip ? w - hx - (p.dx + spr.width) : hx + p.dx;
      this.ctx.drawImage(spr, X + ox + px, Y + oy + hy + p.dy);
    }
  }

  /** 足もとの影（半透明のだ円。エディタで描いた歩きの影と同じ色・濃さ）。 */
  groundShadow(cx, footY, w) {
    const g = this.ctx;
    g.fillStyle = 'rgba(30,22,16,0.32)';
    const x0 = Math.round(cx - w / 2);
    g.fillRect(x0 + 2, footY - 2, w - 4, 2);
    g.fillRect(x0, footY, w, 2);
    g.fillRect(x0 + 4, footY + 2, w - 8, 2);
  }

  drawPose(a, body, f, flip, outfit) {
    const pose = f.walk != null ? WALK[a.look.body][f.walk] : body.poses[f.pose]; // 歩くコマは描き直した絵
    const img = this.personImage(pose.img, a.look, outfit, flip);
    const ax = flip ? pose.w - 1 - pose.ax : pose.ax;
    const X = Math.round(a.x - ax), Y = Math.round(a.y - pose.h + (pose.below ?? 0) + f.dy); // below: 足の裏より下にある影の行
    this.ctx.drawImage(img, X, Y);
    this.drawProps(f.props, body, X, Y, pose.w, flip);
    return { y: Y, cx: X + pose.w / 2 };
  }

  /** 1枚の絵を、頭・胴・左右の脚に分けて少しずつずらして描く。 */
  drawShift(a, body, f, flip, outfit) {
    const g = this.ctx;
    const img = this.personImage(body.img, a.look, outfit, flip);
    const w = img.width, h = img.height, sx = flip ? -1 : 1;
    const X = Math.round(a.x - w / 2), Y = Math.round(a.y - h);
    const legX = flip ? w - body.legX : body.legX;
    const [ux, uy] = [f.up[0] * sx, f.up[1]];
    g.drawImage(img, 0, body.hipY, legX, h - body.hipY, X + f.legs[0] * sx, Y + body.hipY, legX, h - body.hipY);
    g.drawImage(img, legX, body.hipY, w - legX, h - body.hipY, X + legX + f.legs[1] * sx, Y + body.hipY, w - legX, h - body.hipY);
    g.drawImage(img, 0, body.headY, w, body.hipY - body.headY, X + ux, Y + body.headY + uy, w, body.hipY - body.headY);
    g.drawImage(img, 0, 0, w, body.headY, X + ux + f.head[0] * sx, Y + uy + f.head[1], w, body.headY);
    this.drawProps(f.props, body, X, Y, w, flip, ux, uy);
    return { y: Y + uy, cx: X + w / 2 };
  }

  drawParticles(theme, tMs) {
    const g = this.ctx, t = tMs / 1000, W = SCENE.w, H = SCENE.h;
    if (theme.rain) {
      g.fillStyle = 'rgba(190,215,240,0.75)';
      for (let i = 0; i < 220; i++) {
        const sp = 340 + hash(i) * 120;
        let x = (hash(i + 3) * (W + 80) - (t * sp) / 5) % (W + 80); if (x < 0) x += W + 80;
        const y = (hash(i + 9) * H + t * sp) % H;
        g.fillRect(Math.round(x), Math.round(y), 1, 6);
      }
    }
    if (theme.snow) {
      g.fillStyle = '#ffffff';
      for (let i = 0; i < 180; i++) {
        const sp = 36 + hash(i) * 44;
        let x = (hash(i + 3) * W + Math.sin(t * 0.8 + i) * 12) % W; if (x < 0) x += W;
        const y = (hash(i + 9) * H + t * sp) % H;
        const s = hash(i + 20) < 0.25 ? 4 : 2;
        g.fillRect(Math.round(x), Math.round(y), s, s);
      }
    }
    if (theme.particles) {
      const col = theme.particles === 'petal' ? ['#f9c6d4', '#ffe3ea'] : ['#e08a2c', '#b94d22', '#d9b33a'];
      for (let i = 0; i < 36; i++) {
        const sp = 20 + hash(i) * 20;
        const x = (hash(i + 3) * W + t * (12 + hash(i + 5) * 12) + Math.sin(t + i) * 10) % W;
        const y = (hash(i + 9) * H + t * sp) % H;
        g.fillStyle = col[i % col.length];
        g.fillRect(Math.round(x), Math.round(y), 4, 2);
      }
    }
  }

  bubble(a) {
    const g = this.ctx;
    const t = getText(a.bubble, { px: 20, color: '#2a1c14' });
    const w = t.width + 12, h = t.height + 4;
    let x = Math.round(a.x - w / 2), y = Math.round((a.headTop ?? a.y - 120) - h - 12);
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
