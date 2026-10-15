// ドット絵の定義（仮の絵）。画像素材ができたら、ここと animations.js / themes.js を差し替える。
// 1文字 = 1ドット。'.' は透明。色は PALETTE の文字で引く。
// スプライト単位の pal で色を上書きでき、描画時にも上書きできる（客の服の色など）。

export const PALETTE = {
  k: '#2a1c14', w: '#f6f1e4', W: '#c18c52', x: '#8d5c2e', X: '#5a381b', i: '#33200f',
  r: '#c63d2f', R: '#8f2a20', g: '#5d9c3f', G: '#3c7a2e', b: '#2d4b7c', B: '#46689f',
  s: '#f2c9a0', S: '#d5a077', h: '#3a2a22', H: '#b9b9b9', c: '#6a8f5a', C: '#8a6a3a',
  p: '#4a4a5c', e: '#231710', m: '#a5483a', M: '#5a2a22', n: '#8d8d88', N: '#5c5c58',
  t: '#4d5a6e', T: '#2f3a4b', d: '#efece0', D: '#c8c4b0', a: '#ece6d4', y: '#e6c25a',
  Y: '#b8933a', u: '#c63d2f', U: '#8f2a20', l: '#6aa84f', L: '#4c8a3a', q: '#f2b6c4',
  o: '#e8892a', z: '#7a5a3a', f: '#fff8c8', j: '#7aa3cc', J: '#9fc0e0', V: '#3b4a5a',
};

// ---- 小道具: 文字グリッドを組み立てる ----
const grid = (w, h, ch = '.') => Array.from({ length: h }, () => Array(w).fill(ch));
const blit = (g, x0, y0, rows) =>
  rows.forEach((row, dy) => [...row].forEach((ch, dx) => {
    if (ch !== '.' && g[y0 + dy] && x0 + dx >= 0 && x0 + dx < g[0].length) g[y0 + dy][x0 + dx] = ch;
  }));
const fill = (g, x, y, w, h, ch) => { for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) if (g[j]?.[i] !== undefined) g[j][i] = ch; };
const toRows = (g) => g.map((r) => r.join(''));
const shear = (rows, maxShift) => { // 下ほど横にずらす（揺れの1コマ）
  const h = rows.length, w = rows[0].length;
  return rows.map((row, y) => {
    const s = Math.round(maxShift * (y / (h - 1)) ** 1.5);
    const g = Array(w).fill('.');
    [...row].forEach((ch, x) => { const nx = x + s; if (nx >= 0 && nx < w && ch !== '.') g[nx] = ch; });
    return g.join('');
  });
};

export const SPRITES = {};
const def = (name, rows, pal) => { SPRITES[name] = { rows, pal }; };

// ---------------- 人 ----------------
const FACE = {
  closed: ['...sesses...', '...ssssss...', '...ssmmss...', '....ssss....', '.....ss.....'],
  open: ['...sesses...', '...ssssss...', '...ssMMss...', '....ssss....', '.....ss.....'],
};
const HAIR = {
  short: ['....hhhh....', '...hhhhhh...', '...hhhhhh...'],
  bun: ['.....hh.....', '....hhhh....', '...hhhhhh...'],
  cap: ['....CCCC....', '...CCCCCC...', '..CCCCCCCC..'],
  long: ['....hhhh....', '...hhhhhh...', '..hhhhhhhh..'],
  spiky: ['...h.hh.h...', '...hhhhhh...', '...hhhhhh...'],
  bald: ['............', '....ssss....', '...ssssss...'],
  band: ['....hhhh....', '...hhhhhh...', '...wwwwww...'],
};
const SIDE = { long: true, bald: true };
for (const [style, top] of Object.entries(HAIR)) {
  for (const [mouth, face] of Object.entries(FACE)) {
    const rows = [...top, ...face];
    if (SIDE[style]) for (const y of [3, 4, 5]) { const a = [...rows[y]]; a[2] = 'h'; a[9] = 'h'; rows[y] = a.join(''); }
    def(mouth === 'closed' ? `head_${style}` : `head_${style}_talk`, rows);
  }
}
export const HEAD_STYLES = Object.keys(HAIR);

def('torso', ['cccccc', 'cccccc', 'cccccc', 'cccccc', 'CCCCCC', 'cccccc', 'cccccc']);
def('arm_down', ['c', 'c', 'c', 's']);
def('arm_up', ['.s', '.c', 'c.']);
def('arm_out', ['sscccccc.', '.cccccccc'].map((r) => r.slice(0, 9).padEnd(9, 'c')));
def('legs_stand', ['...pppppp...', '...pp..pp...', '...pp..pp...', '...pp..pp...', '...pp..pp...', '..kkk..kkk..']);
def('legs_stride', ['...pppppp...', '..pp....pp..', '..pp....pp..', '..pp....pp..', '..pp....pp..', '.kkk....kkk.']);
def('legs_cross', ['...pppppp...', '....pppp....', '....pppp....', '....pppp....', '....pppp....', '....kkkk....']);

def('acc_scarf', ['rrrrrrrr', '.rrRRrr.']);
def('acc_strawhat', ['....yyyy....', '...yyyyyy...', 'YYYYYYYYYYYY']);
def('acc_umbrella', [
  '.......uuuuuu.......', '....uuuuuuuuuuuu....', '..uuuuuuuuuuuuuuuu..', 'uuUuuUuuUuuUuuUuuUuu',
  '..........k.........', '..........k.........', '..........k.........',
]);
def('acc_umbrella_snow', ['.......wwwwww.......', '....wwwwwwwwwwww....', '..wwwwwwwwwwwwwwww..']);
def('basket_empty', ['xxxxxxxx', 'XxXxXxXx', '.XXXXXX.']);
def('basket_full', ['...dd...', '..dDddg.', 'xxxxxxxx', 'XxXxXxXx', '.XXXXXX.']);
def('apron', ['aaaaaa', 'aaaaaa', 'aaaaaa']);
def('pickle_piece', ['.gg', 'ggg', '.dg']);
def('plate', ['wwwww', '.www.']);
def('salt_a', ['w....', '...w.', '.w...']);
def('salt_b', ['..w..', 'w...w', '....w']);
def('salt_c', ['.w..w', '..w..', 'w....']);
def('bubble_tail', ['kk.', '.wk', '..k'].map((r) => r));

// ---------------- 背景 ----------------
// 屋根（濃い瓦、棟の端に飾り）
{
  const W = 188, H = 24, g = grid(W, H);
  for (let y = 3; y < H; y++) {
    const inset = Math.round((H - 1 - y) * 0.38);
    for (let x = inset; x < W - inset; x++) {
      const col = (x + (Math.floor(y / 3) % 2) * 3) % 6; // 瓦の列（段ごとに半分ずらす）
      const row = y % 3;
      g[y][x] = row === 2 ? 'T' : col === 0 ? 'T' : (row === 0 ? 'V' : 't');
    }
    if (y >= H - 2) for (let x = inset; x < W - inset; x++) g[y][x] = y === H - 1 ? 'k' : (x % 6 < 3 ? 'T' : 'V');
  }
  // 棟（むね）と鬼瓦
  const ri = Math.round((H - 1 - 3) * 0.38);
  fill(g, ri, 0, W - ri * 2, 3, 'T'); fill(g, ri, 0, W - ri * 2, 1, 'V');
  for (let x = ri; x < W - ri; x += 4) g[2][x] = 'k';
  fill(g, ri - 2, 0, 4, 5, 'T'); fill(g, W - ri - 2, 0, 4, 5, 'T');
  def('roof', toRows(g));
  const sn = grid(W, H);
  for (let y = 0; y < 10; y++) {
    const inset = Math.round((H - 1 - y) * 0.38);
    for (let x = inset; x < W - inset; x++) { const edge = 4 + ((x * 7) % 4); if (y < edge) sn[y][x] = y >= edge - 2 && (x % 3 === 0) ? 'D' : 'w'; }
  }
  def('roof_snow', toRows(sn));
}
// 看板
{
  const W = 84, H = 18, g = grid(W, H);
  fill(g, 0, 0, W, H, 'X'); fill(g, 2, 2, W - 4, H - 4, 'W');
  for (let y = 3; y < H - 2; y += 4) for (let x = 2; x < W - 2; x++) if ((x * 3 + y) % 11 === 0) g[y][x] = 'x';
  fill(g, 0, 0, W, 1, 'x'); fill(g, 6, H - 1, 3, 1, 'k'); fill(g, W - 9, H - 1, 3, 1, 'k');
  def('signboard', toRows(g));
}
// 暖簾（7枚、揺れ4コマ）。文字は render 側で重ねる
{
  const W = 19, H = 18, base = grid(W, H);
  fill(base, 0, 0, W, 2, 'V'); fill(base, 0, 2, W, H - 2, 'j');
  for (let y = 3; y < H - 3; y++) { base[y][0] = 'J'; base[y][W - 1] = 'B'; }
  fill(base, 0, H - 2, W, 2, 'J');
  for (let x = 0; x < W; x += 3) base[0][x] = 'k';
  const rows = toRows(base);
  [0, 2, 0, -2].forEach((sh, i) => def(`noren_${i}`, shear(rows, sh)));
}
// 吊るし大根（3コマ）
{
  const rows = [
    '...k...', '...k...', '..ggg..', '.gGgg..', '.ddddd.', '.ddddd.', '.dDdDd.', '.dddDd.', '.dddDd.',
    '..dDdd.', '..ddd..', '..dDd..', '...dd..', '...d...',
  ];
  [0, 1, -1].forEach((s, i) => def(`daikon_${i}`, shear(rows, s)));
}
// 吊るし唐辛子（3コマ）
{
  const rows = [
    '..k..', '..k..', '.rkr.', '.rrR.', '.rRr.', '..rk.', '.rrk.', '.rRr.', '.rrR.', '..rr.', '..Rr.', '...r.',
  ];
  [0, 1, -1].forEach((s, i) => def(`chili_${i}`, shear(rows, s)));
}
// 樽（空・仕込み済み）
{
  const W = 36, H = 32;
  const make = (full) => {
    const g = grid(W, H);
    const top = full ? 8 : 6;
    for (let y = top; y < H; y++) {
      const t = (y - top) / (H - top - 1);
      const half = 17 + Math.round(Math.sin(t * Math.PI) * 1) - (y === H - 1 ? 1 : 0);
      for (let x = 18 - half; x < 18 + half; x++) g[y][x] = ((x - (18 - half)) % 6 === 0) ? 'x' : (y > top + 2 ? 'W' : 'W');
    }
    for (const hy of [top + 4, H - 6]) for (let x = 0; x < W; x++) if (g[hy][x] !== '.') { g[hy][x] = 'X'; g[hy + 1][x] = 'X'; }
    for (let x = 1; x < W - 1; x++) { g[top][x] = 'X'; }
    if (full) {
      fill(g, 3, top + 1, W - 6, 2, 'w'); // 重しの下の布
      fill(g, 8, 0, 20, 4, 'n'); fill(g, 10, 4, 16, 4, 'n'); // 重石
      fill(g, 8, 0, 20, 1, 'D'); fill(g, 10, 7, 16, 1, 'N'); fill(g, 12, 2, 3, 1, 'D');
    } else {
      fill(g, 3, top + 1, W - 6, 2, 'i'); // 空の樽のふち
    }
    return toRows(g);
  };
  def('barrel_empty', make(false));
  def('barrel_full', make(true));
}
// 札
def('lantern', ['..kkkk..', '.rrrrrr.', 'rrrrrrrr', 'rRrrrrRr', 'rrrrrrrr', 'rRrrrrRr', 'rrrrrrrr', '.rrrrrr.', '..kkkk..', '...kk...']);
def('puddle', ['...nnnnnn...', '.nnnnnnnnnn.', '...nnnnnn...'], { n: '#7d97ad' });

// 空
def('cloud_a', ['.....www......', '...wwwwwww....', '.wwwwwwwwwww..', 'wwwwwwwwwwwwww', '.DDwwwwwwDDDw.']);
def('cloud_b', ['..........ww...........', '.....wwww.wwww.........', '...wwwwwwwwwwwww.......', '.wwwwwwwwwwwwwwwwww....', 'wwwwwwwwwwwwwwwwwwwwwww', '.DDDwwwwwwwwwwwwDDDDDD.']);
def('cloud_c', ['..ww....', '.wwwww..', 'wwwwwwww', '.DDwwDD.']);
{
  const g = grid(16, 16);
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { const d = (x - 7.5) ** 2 + (y - 7.5) ** 2; if (d < 36) g[y][x] = d < 24 ? 'f' : 'y'; }
  def('sun', toRows(g));
  const m = grid(12, 12);
  for (let y = 0; y < 12; y++) for (let x = 0; x < 12; x++) { const d = (x - 5.5) ** 2 + (y - 5.5) ** 2, d2 = (x - 8) ** 2 + (y - 4.5) ** 2; if (d < 30 && d2 > 22) m[y][x] = 'f'; }
  def('moon', toRows(m));
}

// 木（季節ごと。葉の色は pal で上書き）
function tree(name, { leaves, pal, bare = false, snow = false }) {
  const W = 44, H = 52, g = grid(W, H);
  fill(g, 20, 26, 4, 26, 'X'); fill(g, 21, 26, 2, 26, 'x'); fill(g, 17, 48, 10, 4, 'X');
  if (bare) {
    for (let i = 0; i < 14; i++) { g[25 - i][22 - Math.floor(i * 0.9)] = 'X'; g[25 - i][22 + Math.floor(i * 0.9)] = 'X'; g[22 - i][22] = 'X'; }
    for (let i = 0; i < 7; i++) { g[14 - i][13 - i] = 'X'; g[14 - i][31 + i] = 'X'; g[24 - i][10 - Math.floor(i / 2)] = 'X'; g[24 - i][34 + Math.floor(i / 2)] = 'X'; }
    if (snow) for (const [x, y] of [[22, 8], [13, 13], [31, 13], [10, 23], [34, 23], [14, 17], [30, 17]]) { g[y][x] = 'w'; g[y][x + 1] = 'w'; g[y][x - 1] = 'w'; }
  } else {
    const blobs = [[22, 14, 15], [12, 22, 10], [32, 22, 10], [22, 24, 11]];
    for (let y = 0; y < 34; y++) for (let x = 0; x < W; x++) for (const [cx, cy, r] of blobs) {
      const d = (x - cx) ** 2 + (y - cy) ** 2;
      if (d < r * r) { g[y][x] = d < (r * 0.55) ** 2 && y < cy ? 'l' : ((x + y) % 5 === 0 ? 'q' === leaves ? 'q' : 'L' : (y > cy + 2 ? 'L' : 'l')); }
    }
    if (leaves === 'q') for (let i = 0; i < 18; i++) { const x = (i * 7) % 36 + 4, y = (i * 11) % 28 + 3; if (g[y][x] !== '.') g[y][x] = 'q'; }
  }
  def(name, toRows(g), pal);
}
tree('tree_spring', { leaves: 'q', pal: { l: '#f4c1cf', L: '#e59bb1', q: '#ffe3ea' } });
tree('tree_summer', { leaves: 'l', pal: { l: '#4f9a3a', L: '#357a2b' } });
tree('tree_autumn', { leaves: 'l', pal: { l: '#e08a2c', L: '#b94d22' } });
tree('tree_winter', { leaves: 'l', bare: true, snow: true });


// ランドセル（人の両脇にのぞく）
def('acc_randoseru', ['rr........rr', 'rr........rr', 'rR........Rr', 'rr........rr', 'RR........RR']);
// 自転車
def('bicycle', [
  '..........kkk.......',
  '.........k.kN.......',
  '.....kkkkkkkk.kk....',
  '....k...k..k..k.....',
  '...k....k.k...k.....',
  '.nnnn..kkkkk.nnnn...',
  'nNkkkNnk.k.knNkkkNn.',
  'nkn.nkn.k.k.nkn.nkn.',
  'nk...kn....nk...kn..',
  'nkn.nkn....nkn.nkn..',
  'nNkkkNn....nNkkkNn..',
  '.nnnnn......nnnnn...',
].map((r) => r.padEnd(20, '.')), { n: '#9fb4c8', N: '#6f86a0', k: '#2a3a5a' });
// 野菜の木箱
def('crate', [
  '..gg.dd.gg..d.',
  '.gggdddggggdd.',
  'xxxxxxxxxxxxxx',
  'XxXxXxXxXxXxXx',
  'xxxxxxxxxxxxxx',
  'XXXXXXXXXXXXXX',
]);
// 樽の札
def('tag', ['wwww', 'wkwk', 'wwww', 'wkkw', 'wwww', 'wkwk', 'wwww']);

export function validateSprites() {
  const errors = [];
  for (const [name, s] of Object.entries(SPRITES)) {
    const w = s.rows[0].length;
    s.rows.forEach((r, i) => { if (r.length !== w) errors.push(`${name}: row ${i} width ${r.length} != ${w}`); });
    for (const ch of new Set(s.rows.join(''))) if (ch !== '.' && !PALETTE[ch] && !s.pal?.[ch]) errors.push(`${name}: unknown color '${ch}'`);
  }
  return errors;
}
