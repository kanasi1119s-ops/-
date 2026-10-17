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
// scale: 描くときの倍率。1文字=1ドットで 384×216 の大きさに描いた小物は 2（既定）、768×432 の大きさで描いた小物は 1
const def = (name, rows, pal, scale) => { SPRITES[name] = { rows, pal, scale }; };

def('pickle_piece', ['.gg', 'ggg', '.dg']);
def('plate', ['wwwww', '.www.']);
def('salt_a', ['w....', '...w.', '.w...']);
def('salt_b', ['..w..', 'w...w', '....w']);
def('salt_c', ['.w..w', '..w..', 'w....']);
// 傘（雨・雪の日）。u = 傘の色
{ // 傘: 768×432 の大きさで計算して描く（半円のかさ・8つの骨の先・柄）。u = 傘の色、U = 骨の影
  const W = 52, R = 26, H = 14;
  const dome = Array.from({ length: H }, (_, y) => Array.from({ length: W }, (_, x) => {
    const dx = (x + 0.5 - R) / R, dy = (H - 0.5 - y) / H; // だ円（横 R・縦 H）
    const r2 = dx * dx + dy * dy;
    if (r2 > 1) return '.';
    if (y === H - 1) return (x % 6 === 2 || x % 6 === 3) ? 'U' : 'u'; // ふちの骨の先
    if (y === 0 || r2 > 0.86) return 'U'; // 外まわりの陰
    return 'u';
  }).join(''));
  const stick = Array.from({ length: 6 }, () => '.'.repeat(R - 1) + 'kk' + '.'.repeat(W - R - 1));
  def('umbrella', [...dome, ...stick], undefined, 1);
  def('umbrella_snow', dome.slice(0, 4).map((row) => row.replace(/[uU]/g, 'w')), undefined, 1);
}
// 太陽・月（丸を計算で描く）
{
  const disc = (n, test) => Array.from({ length: n }, (_, y) => Array.from({ length: n }, (_, x) => test(x, y) || '.').join(''));
  def('sun', disc(32, (x, y) => { const d = (x - 15.5) ** 2 + (y - 15.5) ** 2; return d < 144 ? (d < 96 ? 'f' : 'y') : null; }), undefined, 1);
  def('moon', disc(24, (x, y) => ((x - 11.5) ** 2 + (y - 11.5) ** 2 < 120 && (x - 16) ** 2 + (y - 9) ** 2 > 88 ? 'f' : null)), undefined, 1);
}
{ // 水たまり（だ円 28×6）
  const W = 28, H = 6;
  def('puddle', Array.from({ length: H }, (_, y) => Array.from({ length: W }, (_, x) => (((x + 0.5 - W / 2) / (W / 2)) ** 2 + ((y + 0.5 - H / 2) / (H / 2)) ** 2 <= 1 ? 'n' : '.')).join('')), { n: '#7d97ad' }, 1);
}

export function validateSprites() {
  const errors = [];
  for (const [name, s] of Object.entries(SPRITES)) {
    const w = s.rows[0].length;
    s.rows.forEach((r, i) => { if (r.length !== w) errors.push(`${name}: row ${i} width ${r.length} != ${w}`); });
    for (const ch of new Set(s.rows.join(''))) if (ch !== '.' && !PALETTE[ch] && !s.pal?.[ch]) errors.push(`${name}: unknown color '${ch}'`);
  }
  return errors;
}
