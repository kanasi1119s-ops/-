// ドット絵を canvas に描くための小さな道具。拡大は整数倍のみ（ぼかさない）。
import { SPRITES, PALETTE } from '../assets/sprites.js';

export function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const ctx = c.getContext('2d', { willReadFrequently: true });
  ctx.imageSmoothingEnabled = false;
  return c;
}

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
      const color = pal?.[ch] ?? def.pal?.[ch] ?? PALETTE[ch];
      ctx.fillStyle = color;
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
