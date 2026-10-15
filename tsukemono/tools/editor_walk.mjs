// ドット絵エディタ（tools/pixel-editor.html。claude.ai の「ドット絵エディタ」と同じもの）をブラウザで動かして、
// 元の絵の脚をそのまま動かした歩くアニメを作る。  node tools/editor_walk.mjs [名前...]
//   先に python3 tools/walk_plan.py で段取り（assets/editor/<名前>.orig.json / .plan.json / .ref.png）を作っておく。
// 新しく描き足す線はなく、元のドットを「切り取り・貼り付け・動かす」だけで動きをつける。エディタでの手順（人ごと）:
//   1. 「作品を開く」で元の絵を開く。「下絵」にも元の絵を敷く。左右対称を切る
//   2. 「＋レイヤー」で 後ろ脚・前脚・持ち物 を足す（名前を付ける）
//   3. 「範囲選択」で、かご・袋 → 持ち物、ひざから下の左の脚 → 後ろ脚、右の脚 → 前脚 へ、切り取り（Ctrl+X）→ 貼り付け（Ctrl+V）
//      → Enter で同じ場所に置く（見た目は元の絵のまま。レイヤーが分かれるだけ）
//   4. 「複製」でフレームを4つに（0 元の絵 1 足がそろう 2 元の絵 3 足がそろう）
//   5. 足がそろうコマ（1・3）で、脚のレイヤーを帯ごとに「範囲選択」→「動かす」＋矢印キーで真ん中へ寄せる
//      （ひざに近い帯は少し、足に近い帯ほど多く。後ろの足は1ドット持ち上げる）→ Enter
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

const L_BODY = 0, L_BACK = 1, L_FRONT = 2, L_ITEM = 3;
async function modalAction(label) { await page.locator('#modalActions button', { hasText: label }).first().click(); }
async function setRange(sel, v) { await page.$eval(sel, (el, v) => { el.value = v; el.dispatchEvent(new Event('input', { bubbles: true })); }, String(v)); }
async function cel(l, f) { await page.click(`td.tl-cel[data-l="${l}"][data-f="${f}"]`); }
async function key(k) { await page.keyboard.press(k); }

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
  await setRange('#refOpacity', 25);
  await setRange('#zoom', 9);
  const box = () => page.$eval('#gridCanvas', (c) => { const r = c.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; });
  async function at(r, c) { const B = await box(); return { x: B.x + (c + 0.5) * (B.w / plan.w), y: B.y + (r + 0.5) * (B.h / plan.h) }; }
  async function tool(name) { await page.click(`#toolGrid [data-tool="${name}"]`); }
  async function selectRect([r0, c0, r1, c1]) {
    await key('Escape');
    await tool('select');
    const a = await at(r0, c0), b = await at(r1, c1);
    await page.mouse.move(a.x, a.y); await page.mouse.down();
    await page.mouse.move((a.x + b.x) / 2, (a.y + b.y) / 2); await page.mouse.move(b.x, b.y);
    await page.mouse.up();
  }
  // 2. レイヤーを足す（からだの上に 後ろ脚・前脚・持ち物）
  await cel(L_BODY, 0);
  for (const nm of ['後ろ脚', '前脚', '持ち物']) {
    await page.click('#layerAdd');
    await page.fill('#layerName', nm);
    await page.$eval('#layerName', (el) => { el.dispatchEvent(new Event('change', { bubbles: true })); el.blur(); });
  }
  // 3. 切り取り → 別のレイヤーへ貼り付け（同じ場所）
  async function moveToLayer(rect, layer) {
    await cel(L_BODY, 0);
    await selectRect(rect);
    await page.keyboard.press('Control+x');
    await cel(layer, 0);
    await page.keyboard.press('Control+v');
    await key('Enter');
    await key('Escape');
  }
  for (const k of plan.keep) await moveToLayer(k, L_ITEM);
  await moveToLayer(plan.back, L_BACK);
  await moveToLayer(plan.front, L_FRONT);
  // 4. フレームを4つに
  await cel(L_BODY, 0);
  for (let i = 1; i < plan.frames; i++) await page.click('#frameDup');
  // 5. 足がそろうコマ: 帯ごとに真ん中へ寄せる
  for (const f of [1, 3]) {
    for (const b of plan.bands) {
      // 後ろ脚: 右へ（いちばん下の帯は1ドット持ち上げる）
      await cel(L_BACK, f);
      await selectRect([b.rows[0], plan.back[1], b.rows[1], plan.back[3]]);
      await tool('move');
      for (let i = 0; i < b.shift; i++) await key('ArrowRight');
      for (let i = 0; i < b.lift; i++) await key('ArrowUp');
      await key('Enter'); await key('Escape');
      // 前脚: 左へ
      await cel(L_FRONT, f);
      await selectRect([b.rows[0], plan.front[1], b.rows[1], plan.front[3]]);
      await tool('move');
      for (let i = 0; i < b.shift; i++) await key('ArrowLeft');
      await key('Enter'); await key('Escape');
    }
  }
  // 6. オニオンスキンで写真、再生
  await cel(L_FRONT, 1);
  await page.click('#onionSkin');
  await page.locator('.layout').screenshot({ path: path.join(DOCS, `${name}_editor.png`) });
  await page.click('#onionSkin');
  await page.click('#playBtn'); await page.waitForTimeout(700); await page.click('#playBtn');
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
  meta[name] = { sheet: `${name}.sheet.png`, frameWidth: sj.frameWidth, frameHeight: sj.frameHeight, frames: sj.frames.map((f) => ({ x: f.x, ms: f.duration })) };
  fs.writeFileSync(sheetsFile, JSON.stringify(meta, null, 1));
  console.log(`${name}: ${sj.frames.length}コマ ${sj.frameWidth}×${sj.frameHeight}`);
}
await browser.close();
