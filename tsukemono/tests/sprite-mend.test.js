import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import zlib from 'node:zlib';

// RGBA 8ビットの PNG を読む（assets/img の絵はすべてこの形）
function readPng(file) {
  const b = fs.readFileSync(file);
  const w = b.readUInt32BE(16), h = b.readUInt32BE(20);
  assert.equal(b[24], 8); assert.equal(b[25], 6);
  const idat = [];
  for (let p = 8; p < b.length;) {
    const len = b.readUInt32BE(p), type = b.toString('ascii', p + 4, p + 8);
    if (type === 'IDAT') idat.push(b.subarray(p + 8, p + 8 + len));
    p += 12 + len;
  }
  const raw = zlib.inflateSync(Buffer.concat(idat)), px = Buffer.alloc(w * h * 4), st = w * 4;
  for (let y = 0; y < h; y++) {
    const f = raw[y * (st + 1)];
    for (let i = 0; i < st; i++) {
      const x = raw[y * (st + 1) + 1 + i], a = i >= 4 ? px[y * st + i - 4] : 0, up = y ? px[(y - 1) * st + i] : 0, ul = y && i >= 4 ? px[(y - 1) * st + i - 4] : 0;
      const pa = Math.abs(up - ul), pb = Math.abs(a - ul), pc = Math.abs(a + up - 2 * ul);
      const pred = [0, a, up, (a + up) >> 1, pa <= pb && pa <= pc ? a : pb <= pc ? up : ul][f];
      px[y * st + i] = (x + pred) & 255;
    }
  }
  return { w, h, px, alpha: (x, y) => px[(y * w + x) * 4 + 3] };
}

// つながったかたまり（4近傍）。pick(x, y) が真のマスをまとめる
function groups(img, pick, n8 = false) {
  const seen = new Uint8Array(img.w * img.h), out = [];
  const nb = n8 ? [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]] : [[1, 0], [-1, 0], [0, 1], [0, -1]];
  for (let y = 0; y < img.h; y++) for (let x = 0; x < img.w; x++) {
    if (seen[y * img.w + x] || !pick(x, y)) continue;
    const g = [], st = [[x, y]]; seen[y * img.w + x] = 1;
    while (st.length) {
      const [cx, cy] = st.pop(); g.push([cx, cy]);
      for (const [dx, dy] of nb) {
        const nx = cx + dx, ny = cy + dy;
        if (nx < 0 || ny < 0 || nx >= img.w || ny >= img.h || seen[ny * img.w + nx] || !pick(nx, ny)) continue;
        seen[ny * img.w + nx] = 1; st.push([nx, ny]);
      }
    }
    out.push(g);
  }
  return out;
}

const people = fs.readdirSync('assets/img').filter((f) => /^(pose|walk|surprise|angry|staff|baron)_/.test(f));

test('人物の絵: 体の中に小さな穴（ピンホール）がない', () => {
  for (const f of people) {
    const img = readPng(`assets/img/${f}`);
    const holes = groups(img, (x, y) => img.alpha(x, y) === 0)
      .filter((g) => g.length <= 6 && g.every(([x, y]) => x > 0 && y > 0 && x < img.w - 1 && y < img.h - 1))
      .filter((g) => g.every(([x, y]) => [[1, 0], [-1, 0], [0, 1], [0, -1]].every(([dx, dy]) => [0, 255].includes(img.alpha(x + dx, y + dy)))));
    assert.equal(holes.length, 0, `${f}: 穴 ${holes.map((g) => g[0].join(',')).join(' ')}`);
  }
});

test('受け取りのポーズ: 袋が宙に浮いていない（体から離れた大きなかたまりがない）', () => {
  for (const f of people.filter((n) => /^pose_.*_7\.png$/.test(n))) {
    const img = readPng(`assets/img/${f}`);
    const big = groups(img, (x, y) => img.alpha(x, y) > 0, true).filter((g) => g.length > 40);
    assert.equal(big.length, 1, `${f}: ${big.length}かたまり`);
  }
});

test('おばあちゃん: 首と肩がつながっている（頭と胴のあいだに横一列の切れ目がない）', () => {
  for (const f of ['pose_granny_0.png', 'pose_granny_3.png', 'surprise_granny.png', 'angry_granny.png', 'walk_granny_0.png']) {
    const img = readPng(`assets/img/${f}`);
    // 頭（上の20行）より下、胴の上までで、どの行も3マス以上は塗られている
    let top = 0; while (![...Array(img.w).keys()].some((x) => img.alpha(x, top))) top++;
    for (let y = top + 20; y < top + 45; y++) {
      const n = [...Array(img.w).keys()].filter((x) => img.alpha(x, y) === 255).length;
      assert.ok(n >= 12, `${f}: ${y}行目が ${n}マスしかない`);
    }
  }
});

test('色をそろえた: 同じ人のポーズ全体で使う色が多すぎない（ポーズごとにばらばらの色にならない）', () => {
  const colorsOf = (f) => {
    const img = readPng(f), set = new Set();
    for (let i = 0; i < img.w * img.h; i++) if (img.px[i * 4 + 3] === 255) set.add(img.px.readUIntBE(i * 4, 3));
    return set;
  };
  for (const ch of ['keeper', 'woman', 'granny', 'suit', 'hiker', 'witch']) {
    const all = new Set();
    for (const f of fs.readdirSync('assets/img').filter((n) => n.startsWith(`pose_${ch}_`))) for (const c of colorsOf(`assets/img/${f}`)) all.add(c);
    assert.ok(all.size <= 120, `${ch}: ${all.size}色`);
  }
});

test('おばあさん: 頭巾に欠けがない（頭巾の高さで、左右・上下とも近くに絵がある透明のドットがない）', () => {
  const R = 4;
  for (const f of people.filter((n) => n.includes('granny'))) {
    const img = readPng(`assets/img/${f}`), op = (x, y) => x >= 0 && y >= 0 && x < img.w && y < img.h && img.alpha(x, y) > 0;
    let top = 0; while (![...Array(img.w).keys()].some((x) => img.alpha(x, top))) top++;
    const near = (x, y, dx, dy) => [1, 2, 3, 4].slice(0, R).some((k) => op(x + dx * k, y + dy * k));
    const holes = [];
    for (let y = top; y < Math.min(img.h, top + 12); y++) for (let x = 0; x < img.w; x++) {
      if (!op(x, y) && near(x, y, -1, 0) && near(x, y, 1, 0) && near(x, y, 0, -1) && near(x, y, 0, 1)) holes.push(`${x},${y}`);
    }
    assert.equal(holes.length, 0, `${f}: 欠け ${holes.join(' ')}`);
  }
});
