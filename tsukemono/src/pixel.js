// ドット絵を canvas に描くための小さな道具。拡大は整数倍のみ（ぼかさない）。
import { SPRITES, PALETTE } from '../assets/sprites.js';

export function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const ctx = c.getContext('2d', { willReadFrequently: true });
  ctx.imageSmoothingEnabled = false;
  return c;
}

// ---------------------------------------------------------------- 画像（トレースした絵）
const images = new Map();

/** assets/img/<name>.png を読み込んで canvas にしておく。 */
export async function loadImages(names, base = 'assets/img/') {
  await Promise.all(names.map((name) => new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const c = makeCanvas(img.width, img.height);
      c.getContext('2d').drawImage(img, 0, 0);
      images.set(name, c);
      resolve();
    };
    img.onerror = () => reject(new Error(`画像を読めません: ${base}${name}.png`));
    // 1つのファイルにまとめた版（scripts/build-single.mjs）では、絵は埋め込みの data URL から読む
    img.src = globalThis.TSUKEMONO_IMAGES?.[name] ?? `${base}${name}.png`;
  })));
}
export function getImage(name) {
  const c = images.get(name);
  if (!c) throw new Error(`image not loaded: ${name}`);
  return c;
}

export function rgbToHsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min, s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h / 6, s, l];
}
export function hslToRgb(h, s, l) {
  if (s === 0) return [l * 255, l * 255, l * 255];
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q;
  const f = (t) => { t = (t + 1) % 1; return t < 1 / 6 ? p + (q - p) * 6 * t : t < 1 / 2 ? q : t < 2 / 3 ? p + (q - p) * (2 / 3 - t) * 6 : p; };
  return [f(h + 1 / 3) * 255, f(h) * 255, f(h - 1 / 3) * 255];
}

/** 画素ごとに色を置き換えた写しを作る。fn(r,g,b,x,y) が [r,g,b] を返せば置き換え、null ならそのまま。 */
export function recolor(src, fn, { flip = false } = {}) {
  const c = makeCanvas(src.width, src.height), g = c.getContext('2d');
  if (flip) { g.translate(src.width, 0); g.scale(-1, 1); }
  g.drawImage(src, 0, 0);
  g.setTransform(1, 0, 0, 1, 0, 0);
  if (!fn) return c;
  const img = g.getImageData(0, 0, c.width, c.height), d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] === 0) continue;
    const p = i / 4, out = fn(d[i], d[i + 1], d[i + 2], p % c.width, Math.floor(p / c.width));
    if (out) { d[i] = out[0]; d[i + 1] = out[1]; d[i + 2] = out[2]; }
  }
  g.putImageData(img, 0, 0);
  return c;
}

// ---------------------------------------------------------------- 小物（文字で描いたドット絵）
const spriteCache = new Map();

/** スプライトを canvas にして返す（キャッシュ）。pal で色を上書き、flip で左右反転。 */
export function getSprite(name, { pal, flip = false } = {}) {
  const def = SPRITES[name];
  if (!def) throw new Error(`sprite not found: ${name}`);
  const key = `${name}|${flip ? 1 : 0}|${pal ? Object.entries(pal).sort().join(',') : ''}`;
  let c = spriteCache.get(key);
  if (c) return c;
  const h = def.rows.length, w = def.rows[0].length;
  c = makeCanvas(w, h);
  const ctx = c.getContext('2d');
  def.rows.forEach((row, y) => {
    for (let x = 0; x < w; x++) {
      const ch = row[x];
      if (ch === '.') continue;
      ctx.fillStyle = pal?.[ch] ?? def.pal?.[ch] ?? PALETTE[ch];
      ctx.fillRect(flip ? w - 1 - x : x, y, 1, 1);
    }
  });
  spriteCache.set(key, c);
  return c;
}

const FONT = '"DotGothic16","Unifont JP","IPAGothic","Hiragino Sans","Noto Sans JP","Yu Gothic",Meiryo,sans-serif';
const textCache = new Map();

/** 文字を2値化してドットの文字にする（アンチエイリアスを残さない）。 */
export function getText(text, { px = 10, color = '#2a1c14' } = {}) {
  const key = `${text}|${px}|${color}`;
  let c = textCache.get(key);
  if (c) return c;
  const probe = makeCanvas(4, 4).getContext('2d');
  probe.font = `${px}px ${FONT}`;
  const w = Math.ceil(probe.measureText(text).width) + 2, h = px + 3;
  const tmp = makeCanvas(w, h);
  const t = tmp.getContext('2d');
  t.font = `${px}px ${FONT}`;
  t.textBaseline = 'top';
  t.fillStyle = '#000';
  t.fillText(text, 1, 1);
  const img = t.getImageData(0, 0, w, h);
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(color.slice(i, i + 2), 16));
  for (let i = 0; i < img.data.length; i += 4) {
    const on = img.data[i + 3] > 120;
    img.data[i] = r; img.data[i + 1] = g; img.data[i + 2] = b; img.data[i + 3] = on ? 255 : 0;
  }
  t.putImageData(img, 0, 0);
  textCache.set(key, tmp);
  return tmp;
}

/** 整数倍で一番大きく表示できる倍率。 */
export function integerScale(availW, availH, w, h) {
  return Math.max(1, Math.floor(Math.min(availW / w, availH / h)));
}
