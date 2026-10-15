// ドット絵エディタ（tools/pixel-editor.html。claude.ai の「ドット絵エディタ」と同じもの）をブラウザで動かして、
// 元の絵の脚をそのまま動かした歩くアニメを作る。  node tools/editor_walk.mjs [名前...]
//   先に python3 tools/walk_plan.py で段取り（assets/editor/<名前>.orig.json / .plan.json / .ref.png）を作っておく。
// 持ち物に隠れていた脚だけ えんぴつで描き足し、ほかは元のドットを「切り取り・貼り付け・左右反転・動かす」で動かし、影は「だ円（塗り）」で描く。
// エディタでの手順（人ごと。8コマの中身は tools/walk_plan.py の説明）:
//   1. 「作品を開く」で元の絵を開く。「下絵」にも元の絵を敷く。左右対称を切る
//   2. レイヤーを足す: 影（いちばん下・不透明度32%）、後ろ脚・前脚・持ち物（からだの上）
//   3. かご・袋は、からだを「複製」した「持ち物」レイヤーと、からだのレイヤーの両方から、消しゴムで相手のぶんを消して形どおりに分ける。
//      股から下の脚は「範囲選択」→ 切り取り（Ctrl+X）→ 貼り付け（Ctrl+V）→ Enter で「後ろ脚」「前脚」へ。
//      かごに隠れていた手前の脚（もも・ひざ・すね）は「えんぴつ」で描き足す
//      （同じ場所に置くので見た目は元の絵のまま）
//   4. 「複製」でフレームを8つに
//   5. コマごとに: すそを「範囲選択」→「動かす」で揺らす／からだと持ち物を「動かす」で沈める／
//      脚を帯ごとに「範囲選択」→（反対の一歩では Shift+H で左右反転）→「動かす」＋矢印キー → Enter／
//      影のレイヤーに「だ円（塗り）」で足もとの影
//   6. オニオンスキンを付けて写真、再生して確かめる
//   7. 「シート」で書き出し、「GIF」、「作品を保存」の JSON（assets/editor/<名前>.json）
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
const names = process.argv.slice(2).length ? process.argv.slice(2) : JSON.parse(fs.readFileSync(path.join(ED, 'index.json'), 'utf8'));
const dataUrlToFile = (url, file) => fs.writeFileSync(file, Buffer.from(url.split(',')[1], 'base64'));
const sheetsFile = path.join(ED, 'sheets.json');
const meta = fs.existsSync(sheetsFile) ? JSON.parse(fs.readFileSync(sheetsFile, 'utf8')) : {};

const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || undefined, args: ['--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 1500, height: 1000 } });
await page.goto(pathToFileURL(EDITOR).href);
await page.evaluate(() => localStorage.clear());
await page.reload();

const LAYER = { shadow: 0, body: 1, back: 2, front: 3, item: 4 };
async function modalAction(label) { await page.locator('#modalActions button', { hasText: label }).first().click(); }
async function setRange(sel, v) { await page.$eval(sel, (el, v) => { el.value = v; el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); }, String(v)); }
async function cel(l, f) { await page.click(`td.tl-cel[data-l="${l}"][data-f="${f}"]`); }
async function key(k) { await page.keyboard.press(k); }
async function tool(name) { await page.click(`#toolGrid [data-tool="${name}"]`); }
async function pickColor(sym) { await page.locator('#swatches button.sw', { hasText: new RegExp(`^${sym}$`) }).first().click(); }

for (const name of names) {
  const plan = JSON.parse(fs.readFileSync(path.join(ED, `${name}.plan.json`), 'utf8'));
  // 1. 元の絵を開く・下絵
  await page.click('#openProjBtn');
  await page.fill('#projText', fs.readFileSync(path.join(ED, `${name}.orig.json`), 'utf8'));
  await modalAction('読み込む');
  if (await page.isChecked('#symmetry')) await page.click('#symmetry');
  if (await page.isChecked('#symmetryV')) await page.click('#symmetryV');
  if (await page.isChecked('#onionSkin')) await page.click('#onionSkin');
  await page.setInputFiles('#refFile', path.join(ED, `${name}.ref.png`));
  await setRange('#refOpacity', 20);
  await setRange('#zoom', 9);
  await setRange('#brushSize', 1);
  const box = () => page.$eval('#gridCanvas', (c) => { const r = c.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; });
  async function at(r, c) { const B = await box(); return { x: B.x + (c + 0.5) * (B.w / plan.w), y: B.y + (r + 0.5) * (B.h / plan.h) }; }
  async function drag([r0, c0, r1, c1]) {
    const a = await at(r0, c0), b = await at(r1, c1);
    await page.mouse.move(a.x, a.y); await page.mouse.down();
    await page.mouse.move((a.x + b.x) / 2, (a.y + b.y) / 2); await page.mouse.move(b.x, b.y);
    await page.mouse.up();
  }
  async function selectRect(rect) { await key('Escape'); await tool('select'); await drag(rect); }
  async function nudge(dx, dy) {
    await tool('move');
    for (let i = 0; i < Math.abs(dx); i++) await key(dx > 0 ? 'ArrowRight' : 'ArrowLeft');
    for (let i = 0; i < Math.abs(dy); i++) await key(dy > 0 ? 'ArrowDown' : 'ArrowUp');
    await key('Enter'); await key('Escape');
  }
  async function addLayer(nm) {
    await page.click('#layerAdd');
    await page.fill('#layerName', nm);
    await page.$eval('#layerName', (el) => { el.dispatchEvent(new Event('change', { bubbles: true })); el.blur(); });
  }
  // 消しゴムで消す（行ごとのつながりを1回ずつなぞる）
  async function eraseRuns(layer, runs) {
    await cel(layer, 0);
    await key('Escape');
    await tool('eraser');
    for (const [y, x0, x1] of runs) await drag([y, x0, y, x1]);
  }
  // 2. レイヤー: 影（からだの下へ）、持ち物（いちばん上）
  await cel(0, 0);
  await addLayer('影');
  await page.click('#layerDown');
  await setRange('#layerOpacity', Math.round(plan.shadow.opacity * 100));
  await cel(1, 0);
  if (plan.keepRuns?.length) {
    // 持ち物は形どおりに分ける: からだを複製して「持ち物」にし、消しゴムで、持ち物からは体を、からだからは持ち物を消す
    // （1ドットの所も消しゴムなら確実に消せる）
    await page.click('#layerDup'); // 2
    await page.fill('#layerName', '持ち物');
    await page.$eval('#layerName', (el) => { el.dispatchEvent(new Event('change', { bubbles: true })); el.blur(); });
  } else {
    await addLayer('持ち物'); // 2
  }
  // 3. 持ち物（かご・袋）を切り取って「持ち物」へ。股から下の脚を切り取って「後ろ脚」へ → 複製して「前脚」
  async function cutPaste(rect, fromLayer, toLayer) {
    await cel(fromLayer, 0);
    await selectRect(rect);
    await page.keyboard.press('Control+x');
    await cel(toLayer, 0);
    await page.keyboard.press('Control+v');
    await key('Enter'); await key('Escape');
  }
  if (plan.keepRuns?.length) {
    await eraseRuns(2, plan.bodyRuns);
    await eraseRuns(1, plan.keepRuns);
  } else for (const k of plan.keep) await cutPaste(k, 1, 2);
  await cel(1, 0);
  await addLayer('後ろ脚'); // 2（持ち物は3へ）
  await cutPaste(plan.legs, 1, 2);
  await cel(2, 0);
  await page.click('#layerDup'); // 3（持ち物は4へ）
  await page.fill('#layerName', '前脚');
  await page.$eval('#layerName', (el) => { el.dispatchEvent(new Event('change', { bubbles: true })); el.blur(); });
  await eraseRuns(LAYER.back, plan.eraseBack);
  await eraseRuns(LAYER.front, plan.eraseFront);
  // 手前の脚の、持ち物に隠れていた もも・ひざ を「えんぴつ」で描き足す（色ごと、横につながる所は1回でなぞる）
  if (plan.fillFront?.length) {
    await cel(LAYER.front, 0);
    await key('Escape');
    await tool('pencil');
    const bySym = {};
    for (const [y, x, c] of plan.fillFront) (bySym[c] ??= []).push([y, x]);
    for (const [sym, pts] of Object.entries(bySym)) {
      await pickColor(sym);
      pts.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
      for (let i = 0; i < pts.length;) {
        let j = i;
        while (j + 1 < pts.length && pts[j + 1][0] === pts[i][0] && pts[j + 1][1] === pts[j][1] + 1) j++;
        const a = await at(pts[i][0], pts[i][1]), b = await at(pts[j][0], pts[j][1]);
        await page.mouse.move(a.x, a.y); await page.mouse.down();
        if (j > i) await page.mouse.move(b.x, b.y);
        await page.mouse.up();
        i = j + 1;
      }
    }
  }
  // 4. フレームを8つに
  await cel(LAYER.body, 0);
  for (let i = 1; i < plan.frames; i++) await page.click('#frameDup');
  // 5. コマごとに動かす
  for (let f = 0; f < plan.frames; f++) {
    if (plan.hem && plan.hem.seq[f]) { await cel(LAYER.body, f); await selectRect(plan.hem.rect); await nudge(plan.hem.seq[f], 0); }
    for (const op of plan.ops.filter((o) => o.frame === f)) {
      await cel(LAYER[op.layer], f);
      await selectRect(op.rect);
      if (op.flip) await page.keyboard.press('Shift+KeyH');
      await nudge(op.dx, op.dy);
    }
    for (const b of plan.bob.filter((o) => o.frame === f)) {
      for (const l of [LAYER.body, LAYER.item]) { await cel(l, f); await key('Escape'); await nudge(0, b.dy); }
    }
    for (const sh of plan.shadows.filter((o) => o.frame === f)) {
      await cel(LAYER.shadow, f);
      await key('Escape');
      await tool('ellipseFill');
      await pickColor(plan.shadow.sym);
      await drag(sh.rect);
    }
  }
  // 6. オニオンスキンで写真、再生
  await cel(LAYER.front, 2);
  await page.click('#onionSkin');
  await page.locator('.layout').screenshot({ path: path.join(DOCS, `${name}_editor.png`) });
  await page.click('#onionSkin');
  await page.click('#playBtn'); await page.waitForTimeout(900); await page.click('#playBtn');
  // 7. 書き出し
  await page.click('#exSheetBtn');
  await page.selectOption('#exScale', '1');
  await page.fill('#exCols', String(plan.frames));
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
  await page.click('#saveProjBtn');
  fs.writeFileSync(path.join(ED, `${name}.json`), await page.$eval('#projJson', (t) => t.value));
  await modalAction('閉じる');
  meta[name] = { sheet: `${name}.sheet.png`, frameWidth: sj.frameWidth, frameHeight: sj.frameHeight, padBottom: plan.padBottom, frames: sj.frames.map((f) => ({ x: f.x, ms: f.duration })) };
  fs.writeFileSync(sheetsFile, JSON.stringify(meta, null, 1));
  console.log(`${name}: ${sj.frames.length}コマ ${sj.frameWidth}×${sj.frameHeight}`);
}
await browser.close();
