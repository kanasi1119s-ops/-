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
// 傘（雨・雪の日）: 768×432 の大きさで計算して描く。横から見た8本骨の傘で、手前に見える骨は奥行きで縮む（x = R - R·cos φ）。
//   光は左上から: 左のパネルほど明るく、パネルの中ほどがふくらんで明るい。すそは骨の先のあいだが少し上がる。
//   u = 傘の色、v = 明るい所、U・Q = 陰、P = 骨、O = ふちどり（描くときに傘の色から作る。下の色は見本）
{
  const W = 60, H = 18, scallop = 2;
  const R = (W - 1) / 2;
  const tips = [0, 1, 2, 3, 4].map((i) => R - R * Math.cos((i * Math.PI) / 4)); // 骨の先の x
  const dome = (x) => { const d = (x - R) / (R + 0.5); return d * d >= 1 ? Infinity : (H - 3) * (1 - Math.pow(1 - d * d, 0.55)); };
  const hem = (x) => {
    for (let i = 0; i < tips.length - 1; i++) if (x >= tips[i] && x <= tips[i + 1]) {
      const fr = (x - tips[i]) / Math.max(tips[i + 1] - tips[i], 1e-6);
      return H - 1 - scallop * Math.min(1, (tips[i + 1] - tips[i]) / 10) * Math.sin(Math.PI * fr);
    }
    return H - 1;
  };
  const inside = (x, y) => x >= 0 && x < W && y >= dome(x) - 0.5 && y <= hem(x) + 0.5;
  const panel = (x) => { let k = 0; for (let i = 1; i < tips.length; i++) if (x > tips[i]) k = i; return Math.min(k, 3); };
  const g = Array.from({ length: H }, (_, y) => Array.from({ length: W }, (_, x) => {
    if (!inside(x, y)) return '.';
    const k = panel(x), fr = (x - tips[k]) / Math.max(tips[k + 1] - tips[k], 1);
    const l = [0.55, 0.25, -0.1, -0.45][k] + 0.25 * Math.sin(Math.PI * fr) - 0.35 * (y / H);
    return l > 0.42 ? 'v' : l > 0 ? 'u' : l > -0.45 ? 'U' : 'Q';
  }));
  for (const tx of tips.slice(1, -1)) { // 骨: てっぺんから骨の先へ、かさの丸みにそってふくらむ
    for (let t = 0; t <= 1.0001; t += 0.004) {
      const xi = Math.round(R + (tx - R) * Math.sin((t * Math.PI) / 2)), yi = Math.round(dome(R) + (hem(tx) - dome(R)) * t);
      if (yi >= 0 && yi < H && xi >= 0 && xi < W && g[yi][xi] !== '.') g[yi][xi] = 'P';
    }
  }
  const out = g.map((r, y) => r.map((ch, x) => (ch !== '.' && [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([a, b]) => g[y + a]?.[x + b] === undefined || g[y + a][x + b] === '.') ? 'O' : ch)));
  const cx = Math.round(R);
  const blank = () => Array(W).fill('.');
  const rows = [blank(), blank(), ...out, blank()];
  for (let y = 0; y < 2 + out.findIndex((r) => r[cx] !== '.'); y++) { rows[y][cx] = 'O'; rows[y][cx + 1] = 'O'; } // 石突き
  for (const tx of tips) rows[rows.length - 1][Math.min(W - 1, Math.max(0, Math.round(tx)))] = 'O'; // 露先
  const umb = rows.map((r) => r.join(''));
  const pal = { u: '#c63d2f', v: '#d36f64', U: '#9a3025', Q: '#7f271e', P: '#591b15', O: '#37110d' };
  def('umbrella', umb, pal, 1);
  // 雪: かさの上の、ふちどりの内側の数行に白
  const snowTop = [...umb[0]].map((_, x) => umb.findIndex((r, y) => y >= 2 && r[x] !== '.')); // 列ごとのかさの上のふち
  def('umbrella_snow', umb.slice(0, 8).map((row, y) => [...row].map((ch, x) => (snowTop[x] >= 0 && y > snowTop[x] && y <= snowTop[x] + 3 && ch !== 'O' && ch !== '.' ? 'w' : '.')).join('')), undefined, 1);
  // 柄（人の後ろに描く。頭の後ろを通って手のほうへ）
  def('umbrella_shaft', Array.from({ length: 48 }, () => 'nN'), undefined, 1);
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
