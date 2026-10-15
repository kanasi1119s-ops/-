// 小物のドット絵（文字で描く）。店先・人物の絵は参考画像のトレース（assets/img/）。
// 1文字 = 1ドット。'.' は透明。色は PALETTE の文字で引く。描画時に pal で色を上書きできる。

export const PALETTE = {
  k: '#2a1c14', w: '#f6f1e4', W: '#c18c52', x: '#8d5c2e', X: '#5a381b', i: '#33200f',
  r: '#c63d2f', R: '#8f2a20', g: '#5d9c3f', G: '#3c7a2e', b: '#2d4b7c', B: '#46689f',
  s: '#f2c9a0', S: '#d5a077', h: '#3a2a22', H: '#b9b9b9', c: '#6a8f5a', C: '#8a6a3a',
  p: '#4a4a5c', e: '#231710', m: '#a5483a', M: '#5a2a22', n: '#8d8d88', N: '#5c5c58',
  t: '#4d5a6e', T: '#2f3a4b', d: '#efece0', D: '#c8c4b0', a: '#ece6d4', y: '#e6c25a',
  Y: '#b8933a', u: '#c63d2f', U: '#8f2a20', l: '#6aa84f', L: '#4c8a3a', q: '#f2b6c4',
  o: '#e8892a', z: '#7a5a3a', f: '#fff8c8', j: '#7aa3cc', J: '#9fc0e0', V: '#3b4a5a',
};

export const SPRITES = {};
const def = (name, rows, pal) => { SPRITES[name] = { rows, pal }; };

def('pickle_piece', ['.gg', 'ggg', '.dg']);
def('plate', ['wwwww', '.www.']);
def('salt_a', ['w....', '...w.', '.w...']);
def('salt_b', ['..w..', 'w...w', '....w']);
def('salt_c', ['.w..w', '..w..', 'w....']);
// 傘（雨・雪の日）。u = 傘の色
def('umbrella', [
  '.........uuuuuuuu.........',
  '.....uuuuuuuuuuuuuuuu.....',
  '...uuuuuuuuuuuuuuuuuuuu...',
  '.uuuuuuuuuuuuuuuuuuuuuuuu.',
  'uUuuuUuuuuUuuuuUuuuuUuuuuU',
  '.............k............',
  '.............k............',
  '.............k............',
]);
def('umbrella_snow', ['.........wwwwwwww.........', '.....wwwwwwwwwwwwwwww.....']);
// 太陽・月（丸を計算で描く）
{
  const disc = (n, test) => Array.from({ length: n }, (_, y) => Array.from({ length: n }, (_, x) => test(x, y) || '.').join(''));
  def('sun', disc(16, (x, y) => { const d = (x - 7.5) ** 2 + (y - 7.5) ** 2; return d < 36 ? (d < 24 ? 'f' : 'y') : null; }));
  def('moon', disc(12, (x, y) => ((x - 5.5) ** 2 + (y - 5.5) ** 2 < 30 && (x - 8) ** 2 + (y - 4.5) ** 2 > 22 ? 'f' : null)));
}
def('puddle', ['...nnnnnnnn...', '.nnnnnnnnnnnn.', '...nnnnnnnn...'], { n: '#7d97ad' });

export function validateSprites() {
  const errors = [];
  for (const [name, s] of Object.entries(SPRITES)) {
    const w = s.rows[0].length;
    s.rows.forEach((r, i) => { if (r.length !== w) errors.push(`${name}: row ${i} width ${r.length} != ${w}`); });
    for (const ch of new Set(s.rows.join(''))) if (ch !== '.' && !PALETTE[ch] && !s.pal?.[ch]) errors.push(`${name}: unknown color '${ch}'`);
  }
  return errors;
}
