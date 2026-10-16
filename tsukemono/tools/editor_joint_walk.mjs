// ドット絵エディタ（tools/pixel-editor.html）で、関節で動かした歩きを仕上げる。  node tools/editor_joint_walk.mjs [名前...]
//   先に python3 tools/walk_joints.py で作品（assets/editor/<名前>.joint.json）と手直しの一覧（<名前>.touch.json）を作っておく。
// エディタでの手順（人ごと）:
//   1. 「作品を開く」で、部品ごとのレイヤー（影・奥の腕・奥の脚・胴・手前の脚・カバン・手前の腕・かご）×16コマを開く
//   2. いちばん上に「手直し」レイヤーを足し、コマごとに「えんぴつ」で、部品を動かしてできたすき間を描く
//   3. 「影」レイヤーに、コマごとに「だ円（塗り）」で足もとの影
//   4. オニオンスキンで写真、再生して確かめる
//   5. 「シート」「GIF」で書き出し、「作品を保存」（assets/editor/<名前>.json）
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
const names = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(JSON.parse(fs.readFileSync(path.join(root, 'tools/walk_joints.json'), 'utf8')));
const dataUrlToFile = (url, file) => fs.writeFileSync(file, Buffer.from(url.split(',')[1], 'base64'));
const sheetsFile = path.join(ED, 'sheets.json');
const meta = fs.existsSync(sheetsFile) ? JSON.parse(fs.readFileSync(sheetsFile, 'utf8')) : {};

const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || undefined, args: ['--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 1500, height: 1700 } });
await page.goto(pathToFileURL(EDITOR).href);
await page.evaluate(() => localStorage.clear());
await page.reload();

async function modalAction(label) { await page.locator('#modalActions button', { hasText: label }).first().click(); }
async function setRange(sel, v) { await page.$eval(sel, (el, v) => { el.value = v; el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); }, String(v)); }
async function cel(l, f) { await page.click(`td.tl-cel[data-l="${l}"][data-f="${f}"]`); }
async function key(k) { await page.keyboard.press(k); }
async function tool(name) { await page.click(`#toolGrid [data-tool="${name}"]`); }
async function pickColor(sym) { await page.locator('#swatches button.sw', { hasText: new RegExp(`^${sym.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`) }).first().click(); }

for (const name of names) {
  const projText = fs.readFileSync(path.join(ED, `${name}.joint.json`), 'utf8');
  const proj = JSON.parse(projText);
  const touch = JSON.parse(fs.readFileSync(path.join(ED, `${name}.touch.json`), 'utf8'));
  const W = proj.width, H = proj.height, F = proj.frames.length, NL = proj.layers.length;
  // 1. 開く
  await page.click('#openProjBtn');
  await page.fill('#projText', projText);
  await modalAction('読み込む');
  if (await page.isChecked('#symmetry')) await page.click('#symmetry');
  if (await page.isChecked('#symmetryV')) await page.click('#symmetryV');
  if (await page.isChecked('#onionSkin')) await page.click('#onionSkin');
  await setRange('#zoom', 8);
  await setRange('#brushSize', 1);
  let B;
  const measure = async () => { B = await page.$eval('#gridCanvas', (c) => { const r = c.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; }); };
  const at = (r, c) => ({ x: B.x + (c + 0.5) * (B.w / W), y: B.y + (r + 0.5) * (B.h / H) });
  // 2. 手直しレイヤー（いちばん上）
  await cel(NL - 1, 0);
  await page.click('#layerAdd');
  await page.fill('#layerName', '手直し');
  await page.$eval('#layerName', (el) => { el.dispatchEvent(new Event('change', { bubbles: true })); el.blur(); });
  const TL = NL; // 手直しのレイヤー番号
  for (let f = 0; f < F; f++) {
    const fixes = touch.fixes[f];
    if (!fixes.length) continue;
    await cel(TL, f);
    await key('Escape');
    await tool('pencil');
    const bySym = {};
    for (const [y, x, s] of fixes) (bySym[s] ??= []).push([y, x]);
    for (const [s, pts] of Object.entries(bySym)) {
      await pickColor(s);
      await measure(); // 色を選ぶとページが動くことがあるので測り直す
      pts.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
      for (let i = 0; i < pts.length;) {
        let j = i;
        while (j + 1 < pts.length && pts[j + 1][0] === pts[i][0] && pts[j + 1][1] === pts[j][1] + 1) j++;
        const a = at(pts[i][0], pts[i][1]), b = at(pts[j][0], pts[j][1]);
        await page.mouse.move(a.x, a.y); await page.mouse.down();
        if (j > i) await page.mouse.move(b.x, b.y);
        await page.mouse.up();
        i = j + 1;
      }
    }
  }
  // 3. 影（だ円の塗り）
  for (let f = 0; f < F; f++) {
    const [y0, x0, y1, x1] = touch.shadows[f];
    await cel(0, f);
    await key('Escape');
    await tool('ellipseFill');
    await pickColor(touch.shadowSym);
    await measure();
    const a = at(y0, x0), b = at(y1, x1);
    await page.mouse.move(a.x, a.y); await page.mouse.down();
    await page.mouse.move((a.x + b.x) / 2, (a.y + b.y) / 2); await page.mouse.move(b.x, b.y);
    await page.mouse.up();
  }
  // 4. オニオンスキンで写真、再生
  await cel(TL, 4);
  await page.click('#onionSkin');
  await page.locator('.layout').screenshot({ path: path.join(DOCS, `${name}_editor.png`) });
  await page.click('#onionSkin');
  await page.click('#playBtn'); await page.waitForTimeout(1200); await page.click('#playBtn');
  // 5. 書き出し
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
  await page.click('#saveProjBtn');
  fs.writeFileSync(path.join(ED, `${name}.json`), await page.$eval('#projJson', (t) => t.value));
  await modalAction('閉じる');
  meta[name] = { sheet: `${name}.sheet.png`, frameWidth: sj.frameWidth, frameHeight: sj.frameHeight, padBottom: touch.padBottom, padLeft: touch.padLeft,
    frames: sj.frames.map((fr) => ({ x: fr.x, ms: fr.duration })) };
  fs.writeFileSync(sheetsFile, JSON.stringify(meta, null, 1));
  console.log(`${name}: ${sj.frames.length}コマ ${sj.frameWidth}×${sj.frameHeight}`);
}
await browser.close();
