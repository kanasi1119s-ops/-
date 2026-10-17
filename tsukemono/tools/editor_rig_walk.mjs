// ドット絵エディタ（tools/pixel-editor.html）で、関節で動かす歩きを作る。  node tools/editor_rig_walk.mjs [名前...]
//   先に python3 tools/walk_rig.py で手順表（assets/editor/<名前>.rig.json）を作っておく。
// エディタでの手順（人ごと。すべてエディタの操作）:
//   1. 「作品を開く」で元の絵（まわりに余白をつけたもの）を開く
//   1b. 脚のそうじ: ほとんど同じ色をそろえ、色のつぶ・白いにじみをまわりの色に（「えんぴつ」で描きなおす）
//   2. 部品に分ける: 「からだ」レイヤーを「複製」し、名前を部品の名前にして、「消しゴム」で部品でない所を消す。
//      部品は 奥の腕・奥の足・奥のすね・奥のもも・胴・手前の足・手前のすね・手前のもも・カバン・手前の腕・かご。
//      かごの裏で元の絵にない手前の脚は、奥の脚と同じ所を残して作る（あとで手前の脚の位置へ回して動かす）。最後に「からだ」を削除
//   3. 胴の手直し: 腕の下に隠れていた胴を「えんぴつ」で描く（腕を振っても胴が欠けない）
//   4. 「影」レイヤーを足していちばん下へ（不透明度32%）
//   5. フレームを「複製」して16コマに
//   6. コマごと・部品ごとに: Ctrl+A で選ぶ → 「回す（角度・軸）」で関節を軸に回す → 矢印キーで関節の行き先へ動かす → Enter で確定。
//      脚の部品は、地面より下にはみ出た所を「範囲選択」→ Delete で消す
//   7. 作品を保存して読み返し、手順表どおりか1ドットずつ確かめる
//   8. 「手直し」レイヤーを足し、部品を動かしてできたすき間を、コマごとに「えんぴつ」で描く。
//      回して削れた脚のふち（太さ戻し）もここで描く。足まわり（腰より下の脚・すそ）の色のつぶはまわりの色で描きなおし、はなれたつぶは「消しゴム」で消す
//   9. 「影」に、コマごとに「だ円（塗り）」で足もとの影
//  10. 確かめる: 足の裏が地面の行にあるか、かご・カバンが欠けていないか、すき間が残っていないか（コマごと）
//  11. オニオンスキンで写真、再生、「シート」「GIF」で書き出し、「作品を保存」（assets/editor/<名前>.json）
// Playwright が必要（PLAYWRIGHT_MODULE / CHROME_PATH で場所を指定できる）。
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pw = await import(process.env.PLAYWRIGHT_MODULE ? pathToFileURL(process.env.PLAYWRIGHT_MODULE).href : 'playwright');
const { chromium } = pw.default ?? pw;
const EDITOR = process.env.EDITOR_HTML || path.join(root, 'tools/pixel-editor.html');
const ED = path.join(root, 'assets/editor');
const DOCS = path.join(root, 'docs/walk');
fs.mkdirSync(DOCS, { recursive: true });
const JOINTS = JSON.parse(fs.readFileSync(path.join(root, 'tools/walk_joints.json'), 'utf8'));
const names = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(JOINTS);
const dataUrlToFile = (url, file) => fs.writeFileSync(file, Buffer.from(url.split(',')[1], 'base64'));
const sheetsFile = path.join(ED, 'sheets.json');
const meta = fs.existsSync(sheetsFile) ? JSON.parse(fs.readFileSync(sheetsFile, 'utf8')) : {};

const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || undefined, args: ['--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 1500, height: 1700 } });
const pageErrors = [];
page.on('pageerror', (e) => pageErrors.push(String(e)));
await page.goto(pathToFileURL(EDITOR).href);
await page.evaluate(() => localStorage.clear());
await page.reload();

async function modalAction(label) { await page.locator('#modalActions button', { hasText: label }).first().click(); }
async function setRange(sel, v) { await page.$eval(sel, (el, v) => { el.value = v; el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); }, String(v)); }
async function cel(l, f) { await page.click(`td.tl-cel[data-l="${l}"][data-f="${f}"]`); }
async function key(k) { await page.keyboard.press(k); }
async function tool(name) { await page.click(`#toolGrid [data-tool="${name}"]`); }
async function pickColor(sym) { await page.locator('#swatches button.sw', { hasText: new RegExp(`^${sym.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`) }).first().click(); }
async function rename(nm) {
  await page.fill('#layerName', nm);
  await page.$eval('#layerName', (el) => { el.dispatchEvent(new Event('change', { bubbles: true })); el.blur(); });
}
async function saveProject() {
  await page.click('#saveProjBtn');
  const t = await page.$eval('#projJson', (el) => el.value);
  await modalAction('閉じる');
  return JSON.parse(t);
}

for (const name of names) {
  const rig = JSON.parse(fs.readFileSync(path.join(ED, `${name}.rig.json`), 'utf8'));
  const sim = JSON.parse(fs.readFileSync(path.join(ED, `${name}.rigsim.json`), 'utf8'));
  const W = rig.w, H = rig.h, F = rig.frames;
  const log = [];
  // 1. 開く
  await page.click('#openProjBtn');
  await page.fill('#projText', JSON.stringify(rig.orig));
  await modalAction('読み込む');
  if (await page.isChecked('#symmetry')) await page.click('#symmetry');
  if (await page.isChecked('#symmetryV')) await page.click('#symmetryV');
  if (await page.isChecked('#onionSkin')) await page.click('#onionSkin');
  await setRange('#zoom', 8);
  await setRange('#brushSize', 1);
  let B;
  const measure = async () => { B = await page.$eval('#gridCanvas', (c) => { const r = c.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; }); };
  const at = (r, c) => ({ x: B.x + (c + 0.5) * (B.w / W), y: B.y + (r + 0.5) * (B.h / H) });
  async function stroke(r, c0, c1) {
    const a = at(r, c0), b = at(r, c1);
    await page.mouse.move(a.x, a.y); await page.mouse.down();
    if (c1 > c0) await page.mouse.move(b.x, b.y);
    await page.mouse.up();
  }
  async function dragRect(r0, c0, r1, c1) {
    const a = at(r0, c0), b = at(r1, c1);
    await page.mouse.move(a.x, a.y); await page.mouse.down();
    await page.mouse.move((a.x + b.x) / 2, (a.y + b.y) / 2); await page.mouse.move(b.x, b.y);
    await page.mouse.up();
  }
  // 取り残される元の絵のドットを、消しゴムで消す
  const body = rig.orig.cels[0][0].map((r) => [...r]);
  if (rig.erase?.length) {
    await cel(0, 0); await key('Escape'); await tool('eraser'); await measure();
    for (const [y, x] of rig.erase) { await stroke(y, x, x); body[y][x] = '.'; }
  }
  // 脚の色のつぶ（写し取ったときの色むら）を、まわりの色で「えんぴつ」で描きなおす
  if (rig.clean?.length) {
    await cel(0, 0); await key('Escape'); await tool('pencil');
    const bySym = {};
    for (const [y, x, s] of rig.clean) (bySym[s] ??= []).push([y, x]);
    for (const [s, pts] of Object.entries(bySym)) {
      await pickColor(s); await measure();
      pts.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
      for (let i = 0; i < pts.length;) {
        let j = i;
        while (j + 1 < pts.length && pts[j + 1][0] === pts[i][0] && pts[j + 1][1] === pts[j][1] + 1) j++;
        await stroke(pts[i][0], pts[i][1], pts[j][1]);
        for (let k = i; k <= j; k++) body[pts[k][0]][pts[k][1]] = s;
        i = j + 1;
      }
    }
  }
  // 2. 部品に分ける（からだを複製 → 部品でない所を消しゴムで消す）。上の部品から作ると、下から LAYERS の順に並ぶ
  const parts = rig.layers.filter((nm) => nm !== '影');
  const nearFromFar = { '手前の足': '奥の足', '手前のすね': '奥のすね', '手前のもも': '奥のもも' };
  for (const nm of [...parts].reverse()) {
    const src = rig.legFrom === 'far' && nearFromFar[nm] ? nearFromFar[nm] : nm;
    const keep = new Set(rig.parts[src].flatMap(([y, a, b]) => Array.from({ length: b - a + 1 }, (_, i) => `${y},${a + i}`)));
    await cel(0, 0);
    await page.click('#layerDup');
    await rename(nm);
    await key('Escape');
    await tool('eraser');
    await measure();
    for (let y = 0; y < H; y++) {
      let x = 0;
      while (x < W) {
        if (body[y][x] === '.' || keep.has(`${y},${x}`)) { x++; continue; }
        let e = x;
        while (e + 1 < W && body[y][e + 1] !== '.' && !keep.has(`${y},${e + 1}`)) e++;
        await stroke(y, x, e);
        x = e + 1;
      }
    }
  }
  await cel(0, 0);
  await page.click('#layerDel'); // からだ
  // 奥の脚から写した手前の脚: 脚と脚の間の明るいふちの色を、脚の色に（主色を副色に置きかえる。左クリック＝主色、右クリック＝副色）
  for (const nm of ['手前の足', '手前のすね', '手前のもも']) {
    if (!rig.recolorNear || !Object.keys(rig.recolorNear).length) break;
    await cel(rig.layers.indexOf(nm) - 1, 0); // まだ影がないので1つ下
    await key('Escape');
    for (const [from, to] of Object.entries(rig.recolorNear)) {
      await pickColor(from);
      await page.locator('#swatches button.sw', { hasText: new RegExp(`^${to}$`) }).first().click({ button: 'right' });
      await key('Shift+KeyR');
    }
  }
  // 描き足し: カバンの、手やかごの後ろに隠れていた所／脚の付け根（上着のすその下）など（えんぴつ）
  for (const [nm, pts0] of Object.entries(rig.drawn || {})) {
    if (!pts0.length) continue;
    await cel(rig.layers.indexOf(nm) - 1, 0); // まだ影がないので1つ下
    await key('Escape');
    await tool('pencil');
    const bySym = {};
    for (const [y, x, s] of pts0) (bySym[s] ??= []).push([y, x]);
    for (const [s, pts] of Object.entries(bySym)) {
      await pickColor(s); await measure();
      pts.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
      for (let i = 0; i < pts.length;) {
        let j = i;
        while (j + 1 < pts.length && pts[j + 1][0] === pts[i][0] && pts[j + 1][1] === pts[j][1] + 1) j++;
        await stroke(pts[i][0], pts[i][1], pts[j][1]);
        i = j + 1;
      }
    }
  }
  // 3. 胴の手直し（腕の下に隠れていた胴）
  const torsoL = parts.indexOf('胴');
  if (rig.torsoFill.length) {
    await cel(torsoL, 0);
    await key('Escape');
    await tool('pencil');
    const bySym = {};
    for (const [y, x, s] of rig.torsoFill) (bySym[s] ??= []).push([y, x]);
    for (const [s, pts] of Object.entries(bySym)) {
      await pickColor(s); await measure();
      for (const [y, x] of pts) await stroke(y, x, x);
    }
  }
  // 4. 影レイヤー（いちばん下）
  await cel(0, 0);
  await page.click('#layerAdd');
  await rename('影');
  await page.click('#layerDown');
  await setRange('#layerOpacity', Math.round(rig.shadow.opacity * 100));
  // 5. 16コマに
  await cel(1, 0);
  for (let i = 1; i < F; i++) await page.click('#frameDup');
  // 6. コマごと・部品ごとに 回す → 動かす
  const L = (nm) => rig.layers.indexOf(nm);
  const legLayers = ['奥の足', '奥のすね', '奥のもも', '手前の足', '手前のすね', '手前のもも'].filter((nm) => rig.layers.includes(nm));
  for (let f = 0; f < F; f++) {
    const ops = rig.plan[f].ops;
    for (const nm of parts) {
      const op = ops[nm];
      if (!op || (!op.deg && !op.dx && !op.dy)) continue;
      await cel(L(nm), f);
      await key('Escape');
      await key('Control+a');
      if (op.deg) {
        await key('Shift+KeyT');
        await page.fill('#rtDeg', String(op.deg));
        await page.fill('#rtR', String(op.pr));
        await page.fill('#rtC', String(op.pc));
        await modalAction('回す');
      }
      await tool('move');
      for (let i = 0; i < Math.abs(op.dx); i++) await key(op.dx > 0 ? 'ArrowRight' : 'ArrowLeft');
      for (let i = 0; i < Math.abs(op.dy); i++) await key(op.dy > 0 ? 'ArrowDown' : 'ArrowUp');
      await key('Enter'); await key('Escape');
    }
    // 地面より下にはみ出た脚のドットを消す
    for (const nm of legLayers) {
      await cel(L(nm), f);
      await key('Escape');
      await tool('select');
      await measure();
      await dragRect(rig.ground + 1, 0, H - 1, W - 1);
      await key('Delete');
      await key('Escape');
    }
  }
  // 7. 読み返して、手順表どおりか確かめる
  let proj = await saveProject();
  const names_ = proj.layers.map((l) => l.name);
  let diff = 0;
  for (let f = 0; f < F; f++) for (const nm of parts) {
    const got = proj.cels[names_.indexOf(nm)][f], want = sim[f][nm];
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (got[y][x] !== want[y][x]) diff++;
  }
  log.push(`手順表とのちがい: ${diff}ドット`);
  // 8. 手直し: 重ねた絵で、左右か上下を囲まれた透明なドット → となりの色で
  const sym2 = (f) => {
    const g = Array.from({ length: H }, () => Array(W).fill('.'));
    for (const nm of parts) { const c = proj.cels[names_.indexOf(nm)][f]; for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (c[y][x] !== '.') g[y][x] = c[y][x]; }
    return g;
  };
  // 外（絵のふち）から透明のままたどれない透明ドット（大きさ12ドットまでのかたまり）。上から順に並べる
  const enclosed = (g) => {
    const out = Array.from({ length: H }, () => Array(W).fill(false)), st = [];
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if ((y === 0 || x === 0 || y === H - 1 || x === W - 1) && g[y][x] === '.') { out[y][x] = true; st.push([y, x]); }
    while (st.length) {
      const [y, x] = st.pop();
      for (const [dy, dx] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const yy = y + dy, xx = x + dx;
        if (yy >= 0 && xx >= 0 && yy < H && xx < W && !out[yy][xx] && g[yy][xx] === '.') { out[yy][xx] = true; st.push([yy, xx]); }
      }
    }
    const res = [], seen = Array.from({ length: H }, () => Array(W).fill(false));
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      if (g[y][x] !== '.' || out[y][x] || seen[y][x]) continue;
      const comp = [], q = [[y, x]]; seen[y][x] = true;
      while (q.length) {
        const [a, b] = q.pop(); comp.push([a, b]);
        for (const [dy, dx] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const yy = a + dy, xx = b + dx;
          if (g[yy][xx] === '.' && !out[yy][xx] && !seen[yy][xx]) { seen[yy][xx] = true; q.push([yy, xx]); }
        }
      }
      if (comp.length <= 48) res.push(...comp);
    }
    return res.sort((p, q) => p[0] - q[0] || p[1] - q[1]);
  };
  // すき間の色: まわり8マスでいちばん多い色（肌と服の境なら、多い方の色。となりの1マスだけで決めない）
  const major = (g, y, x) => {
    const n = {};
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const v = g[y + dy]?.[x + dx];
      if ((dy || dx) && v && v !== '.') n[v] = (n[v] || 0) + (dy && dx ? 1 : 2);
    }
    return Object.entries(n).sort((a, b) => b[1] - a[1])[0]?.[0] ?? '.';
  };
  const fixes = [], erases = [];
  // どの部品のドットか（上の部品が見えている）
  const owner = (f) => {
    const o = Array.from({ length: H }, () => Array(W).fill(null));
    for (const nm of parts) { const c = proj.cels[names_.indexOf(nm)][f]; for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (c[y][x] !== '.') o[y][x] = nm; }
    return o;
  };
  const cleanSet = new Set([...legLayers, 'すそ', 'すそ前', 'すそ後', 'すその裏', '手直し']);
  const legTop = Math.min(JOINTS[name].cut, JOINTS[name].joints.near.hip[0], JOINTS[name].joints.far.hip[0]) + rig.padTop;  // 腰（脚の付け根）の行
  for (let f = 0; f < F; f++) {
    const g = sym2(f), fx = [];
    for (const [y, x, s] of rig.thick?.[f] || []) if (g[y][x] === '.') { g[y][x] = s; fx.push([y, x, s]); }  // 太さ戻し（回して削れた脚のふち）
    for (let round = 0; round < 3; round++) {
    for (let pass = 0; pass < 6; pass++) {
      const add = [];
      for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
        if (g[y][x] !== '.') continue;
        if ((g[y][x - 1] !== '.' && g[y][x + 1] !== '.') || (g[y - 1][x] !== '.' && g[y + 1][x] !== '.')) add.push([y, x, major(g, y, x)]);
      }
      for (const [y, x, s] of add) { g[y][x] = s; fx.push([y, x, s]); }
      if (!add.length) break;
    }
    // 外とつながっていない小さな透明のかたまり（2×2 など）も、まわりの色で埋める（埋めると新しいすき間ができることがあるので、もう一回り）
    const enc = enclosed(g);
    for (const [y, x] of enc) {
      const s = major(g, y, x);
      g[y][x] = s; fx.push([y, x, s]);
    }
    if (!enc.length) break;
    }
    // 足まわりのそうじ（腰より下の、脚・すその部品と手直しのドットだけ）:
    //   ・まわり8マスに同じ色が1つもなく、5マス以上が同じ色 → その色にそろえる（回してできた色のつぶ）
    //   ・まわり8マスにドットが1つ以下 → 消す（はなれたつぶ）
    const own = owner(f);
    for (const [y, x] of fx) own[y][x] = '手直し';
    const ok = (y, x) => y >= legTop && g[y][x] !== '.' && cleanSet.has(own[y][x]);
    const er = [];
    for (let pass = 0; pass < 2; pass++) {
      const rec = [], del = [];
      for (let y = Math.max(1, legTop); y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
        if (!ok(y, x)) continue;
        const n = {}; let cnt = 0;
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
          const v = g[y + dy][x + dx];
          if ((dy || dx) && v !== '.') { n[v] = (n[v] || 0) + 1; cnt++; }
        }
        if (cnt <= 1) { del.push([y, x]); continue; }
        const [best, bc] = Object.entries(n).sort((a, b) => b[1] - a[1])[0];
        if (!n[g[y][x]] && bc >= 5) rec.push([y, x, best]);
      }
      for (const [y, x, c] of rec) { g[y][x] = c; fx.push([y, x, c]); own[y][x] = '手直し'; }
      for (const [y, x] of del) {
        g[y][x] = '.';
        for (let i = fx.length - 1; i >= 0; i--) if (fx[i][0] === y && fx[i][1] === x) fx.splice(i, 1);
        er.push([y, x]);
      }
      if (!rec.length && !del.length) break;
    }
    fixes.push(fx);
    erases.push(er);
  }
  // はなれたつぶは、そのドットがある部品すべてで「消しゴム」で消す
  for (let f = 0; f < F; f++) {
    for (const [li, nm] of names_.entries()) {
      if (!parts.includes(nm)) continue;
      const pts = erases[f].filter(([y, x]) => proj.cels[li][f][y][x] !== '.');
      if (!pts.length) continue;
      await cel(li, f); await key('Escape'); await tool('eraser'); await measure();
      for (const [y, x] of pts) await stroke(y, x, x);
    }
  }
  await cel(proj.layers.length - 1, 0);
  await page.click('#layerAdd');
  await rename('手直し');
  const TL = proj.layers.length;
  for (let f = 0; f < F; f++) {
    if (!fixes[f].length) continue;
    await cel(TL, f);
    await key('Escape');
    await tool('pencil');
    const bySym = {};
    for (const [y, x, s] of fixes[f]) (bySym[s] ??= []).push([y, x]);
    for (const [s, pts] of Object.entries(bySym)) {
      await pickColor(s); await measure();
      pts.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
      for (let i = 0; i < pts.length;) {
        let j = i;
        while (j + 1 < pts.length && pts[j + 1][0] === pts[i][0] && pts[j + 1][1] === pts[j][1] + 1) j++;
        await stroke(pts[i][0], pts[i][1], pts[j][1]);
        i = j + 1;
      }
    }
  }
  log.push(`手直し: ${fixes.reduce((a, b) => a + b.length, 0)}ドット（太さ戻し ${(rig.thick || []).reduce((a, b) => a + b.length, 0)}）・消したつぶ: ${erases.reduce((a, b) => a + b.length, 0)}ドット`);
  // 9. 影
  proj = await saveProject();
  const shadowSym = proj.symbols.some((s) => s.sym === rig.shadow.sym) ? rig.shadow.sym : null;
  if (shadowSym) {
    for (let f = 0; f < F; f++) {
      const g = sym2(f), y = rig.ground;
      const xs = []; for (let x = 0; x < W; x++) if (g[y][x] !== '.' || g[y - 1][x] !== '.') xs.push(x);
      if (!xs.length) continue;
      await cel(0, f);
      await key('Escape');
      await tool('ellipseFill');
      await pickColor(shadowSym); await measure();
      await dragRect(y, Math.max(0, Math.min(...xs) - 6), Math.min(H - 1, y + 4), Math.min(W - 1, Math.max(...xs) + 6));
    }
  } else log.push('影の色がパレットにない（影は描いていない）');
  // 10. 確かめる
  proj = await saveProject();
  const nm2 = proj.layers.map((l) => l.name);
  const count = (nm, f) => nm2.indexOf(nm) < 0 ? 0 : proj.cels[nm2.indexOf(nm)][f].reduce((a, r) => a + [...r].filter((c) => c !== '.').length, 0);
  const report = [];
  for (let f = 0; f < F; f++) {
    const g = Array.from({ length: H }, () => Array(W).fill('.'));
    for (const nm of nm2) { if (nm === '影') continue; const c = proj.cels[nm2.indexOf(nm)][f]; for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (c[y][x] !== '.') g[y][x] = c[y][x]; }
    let low = -1; for (let y = 0; y < H; y++) if (g[y].some((c) => c !== '.')) low = y;
    const contact = g[rig.ground].filter((c) => c !== '.').length;
    let holes = 0;
    for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) if (g[y][x] === '.' && ((g[y][x - 1] !== '.' && g[y][x + 1] !== '.') || (g[y - 1][x] !== '.' && g[y + 1][x] !== '.'))) holes++;
    holes += enclosed(g).length;
    report.push({ f, 足の裏の行: low, 地面のドット: contact, すき間: holes, かご: count('かご', f), カバン: count('カバン', f) });
  }
  const k0 = report[0].かご, b0 = report[0].カバン;
  const bad = report.filter((r) => r.足の裏の行 !== rig.ground || r.地面のドット < 2 || r.すき間 > 0 || r.かご !== k0 || r.カバン !== b0);
  log.push(`確かめ: 問題のコマ ${bad.length}（${bad.map((r) => JSON.stringify(r)).join(' ')}）`);
  fs.writeFileSync(path.join(DOCS, `${name}_check.json`), JSON.stringify(report, null, 1));
  // 11. 写真・再生・書き出し
  await cel(TL, 4);
  await page.click('#onionSkin');
  await page.locator('.layout').screenshot({ path: path.join(DOCS, `${name}_editor.png`) });
  await page.click('#onionSkin');
  await page.click('#playBtn'); await page.waitForTimeout(1200); await page.click('#playBtn');
  await page.click('#exSheetBtn');
  await page.selectOption('#exScale', '1');
  await page.fill('#exCols', String(F));
  await modalAction('シートを作る');
  const sheet = await page.$eval('#outBox img', (i) => i.src);
  const sj = JSON.parse(await page.$eval('#sheetJson', (t) => t.value));
  await modalAction('閉じる');
  dataUrlToFile(sheet, path.join(ED, `${name}.sheet.png`));
  await page.click('#exGifBtn');
  await page.selectOption('#exScale', '4');
  await modalAction('GIFを作る');
  dataUrlToFile(await page.$eval('#outBox img', (i) => i.src), path.join(DOCS, `${name}.gif`));
  await modalAction('閉じる');
  fs.writeFileSync(path.join(ED, `${name}.json`), JSON.stringify(proj));
  Object.assign(meta, fs.existsSync(sheetsFile) ? JSON.parse(fs.readFileSync(sheetsFile, 'utf8')) : {}); // ほかの書き出しと同時に動いても消さない
  meta[name] = { sheet: `${name}.sheet.png`, frameWidth: sj.frameWidth, frameHeight: sj.frameHeight, padBottom: H - 1 - rig.ground, padLeft: rig.padLeft,
    frames: sj.frames.map((fr) => ({ x: fr.x, ms: fr.duration })) };
  fs.writeFileSync(sheetsFile, JSON.stringify(meta, null, 1));
  console.log(`${name}: ${sj.frames.length}コマ ${sj.frameWidth}×${sj.frameHeight}\n  ${log.join('\n  ')}`);
}
if (pageErrors.length) console.log('エディタのエラー:', pageErrors.slice(0, 5));
await browser.close();
