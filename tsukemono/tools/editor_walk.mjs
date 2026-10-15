// ドット絵エディタ（tools/pixel-editor.html。claude.ai の「ドット絵エディタ」と同じもの）をブラウザで動かして、
// 歩くアニメを描く。  node tools/editor_walk.mjs [名前...]
//   先に python3 tools/walk_prep.py で下準備（assets/editor/<名前>.start.json / .plan.json / .ref.png）を作っておく。
// エディタでの手順（人ごと）:
//   1. 「作品を開く」ではじめの作品を読む（レイヤー: 後ろ脚・前脚・からだ）
//   2. 「下絵」に元の絵を敷く。左右対称を切る。オニオンスキンを付ける
//   3. 「複製」でフレームを6つに。からだのレイヤーを「動かす」＋↓キーで、沈むコマだけ1ドット下げる
//   4. コマごとに、脚のレイヤーへ「直線」ツールで もも（腰→ひざ）・すね（ひざ→足首）を描き、靴を描く
//   5. ぜんぶ描いてから、脚のレイヤーに「色つき縁取り」をかける
//   6. 再生して確かめる（画面写真を docs/walk/ に残す）
//   7. 「シート」で書き出し → assets/img/walk_<名前>_<0..5>.png。「GIF」も docs/walk/ に。「作品を保存」の JSON を assets/editor/<名前>.json に
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

const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || undefined, args: ['--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 1500, height: 1000 } });
await page.goto(pathToFileURL(EDITOR).href);
await page.evaluate(() => localStorage.clear());
await page.reload();
const meta = {};

async function modalAction(label) { await page.locator('#modalActions button', { hasText: label }).first().click(); }
async function setRange(sel, v) { await page.$eval(sel, (el, v) => { el.value = v; el.dispatchEvent(new Event('input', { bubbles: true })); }, String(v)); }
async function cel(l, f) { await page.click(`td.tl-cel[data-l="${l}"][data-f="${f}"]`); }
async function pickColor(sym) { await page.locator('#swatches button.sw', { hasText: new RegExp(`^${sym}$`) }).first().click(); }
async function key(k) { await page.keyboard.press(k); }

for (const name of names) {
  const start = fs.readFileSync(path.join(ED, `${name}.start.json`), 'utf8');
  const plan = JSON.parse(fs.readFileSync(path.join(ED, `${name}.plan.json`), 'utf8'));
  // 1. はじめの作品を開く
  await page.click('#openProjBtn');
  await page.fill('#projText', start);
  await modalAction('読み込む');
  // 2. 下絵・対称を切る・拡大率
  if (await page.isChecked('#symmetry')) await page.click('#symmetry');
  if (await page.isChecked('#symmetryV')) await page.click('#symmetryV');
  await page.setInputFiles('#refFile', path.join(ED, `${name}.ref.png`));
  await setRange('#refOpacity', 30);
  await setRange('#zoom', 9);
  const box = async () => page.$eval('#gridCanvas', (c) => { const r = c.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; });
  let B = await box();
  const at = (r, c) => ({ x: B.x + (c + 0.5) * (B.w / plan.w), y: B.y + (r + 0.5) * (B.h / plan.h) });
  async function stroke([r0, c0], [r1, c1]) {
    B = await box(); // 色を選ぶとページが動くことがあるので、毎回キャンバスの位置を測り直す
    const a = at(r0, c0), b = at(r1, c1);
    await page.mouse.move(a.x, a.y); await page.mouse.down();
    await page.mouse.move((a.x + b.x) / 2, (a.y + b.y) / 2); await page.mouse.move(b.x, b.y);
    await page.mouse.up();
  }
  // 3. フレームを6つに（からだのレイヤーを選んで「複製」）
  await cel(2, 0);
  for (let i = 1; i < plan.frames.length; i++) await page.click('#frameDup');
  for (let f = 0; f < plan.frames.length; f++) await page.fill('#frameDur', String(plan.frameMs)).catch(() => {});
  // 沈むコマは、からだを「動かす」で1ドット下げる
  for (let f = 0; f < plan.frames.length; f++) {
    const dy = plan.frames[f].dy;
    if (!dy) continue;
    await cel(2, f);
    await key('v');
    for (let i = 0; i < dy; i++) await key('ArrowDown');
    await key('Enter');
    await key('Escape');
  }
  B = await box();
  // 4. 脚を描く（直線ツール）。後ろ脚 → 前脚
  for (let f = 0; f < plan.frames.length; f++) {
    for (const leg of ['B', 'A']) {
      const L = plan.frames[f].legs[leg];
      await cel(L.layer, f);
      await key('l');
      await pickColor(L.sym);
      await setRange('#brushSize', L.width + 1); // もも
      await stroke(L.hip, L.knee);
      await setRange('#brushSize', L.width); // すね
      await stroke(L.knee, L.ankle);
      // 靴（太さ1の直線で2行）
      await pickColor(plan.shoe);
      await setRange('#brushSize', 1);
      const [r, c] = L.ankle;
      const shoe = {
        flat: [[[r, c - 1], [r, c + 1]], [[r + 1, c - 1], [r + 1, c + 2]]],
        heel: [[[r, c], [r, c + 2]], [[r + 1, c - 1], [r + 1, c + 1]]],
        toe: [[[r, c - 2], [r, c]], [[r + 1, c - 1], [r + 1, c + 2]]],
        swing: [[[r, c - 1], [r, c + 1]], [[r + 1, c], [r + 1, c + 1]]],
      }[L.shoe];
      for (const [p, q] of shoe) await stroke(p, q);
    }
  }
  // 5. 色つき縁取り（ぜんぶ描いてから。縁取りは使っていない色をパレットから消すため）
  for (let f = 0; f < plan.frames.length; f++) {
    for (const l of [0, 1]) { await cel(l, f); await page.click('#fxOutline'); }
  }
  // 6. オニオンスキンを付けて、再生して確かめる
  await cel(1, 2);
  if (!(await page.isChecked('#onionSkin'))) await page.click('#onionSkin');
  await page.locator('.layout').screenshot({ path: path.join(DOCS, `${name}_editor.png`) });
  await page.click('#onionSkin');
  await page.click('#playBtn'); await page.waitForTimeout(700); await page.click('#playBtn');
  // 7. 書き出し: シート（1倍・横に6つ）
  await page.click('#exSheetBtn');
  await page.selectOption('#exScale', '1');
  await page.fill('#exCols', String(plan.frames.length));
  await modalAction('シートを作る');
  const sheet = await page.$eval('#outBox img', (i) => i.src);
  const sheetJson = JSON.parse(await page.$eval('#sheetJson', (t) => t.value));
  await modalAction('閉じる');
  const sheetFile = path.join(ED, `${name}.sheet.png`);
  dataUrlToFile(sheet, sheetFile);
  // GIF（4倍）
  await page.click('#exGifBtn');
  await page.selectOption('#exScale', '4');
  await modalAction('GIFを作る');
  dataUrlToFile(await page.$eval('#outBox img', (i) => i.src), path.join(DOCS, `${name}.gif`));
  await modalAction('閉じる');
  // 作品を保存（JSON）
  await page.click('#saveProjBtn');
  fs.writeFileSync(path.join(ED, `${name}.json`), await page.$eval('#projJson', (t) => t.value));
  await modalAction('閉じる');
  meta[name] = { sheet: `${name}.sheet.png`, frameWidth: sheetJson.frameWidth, frameHeight: sheetJson.frameHeight, frames: sheetJson.frames.map((f) => ({ x: f.x, ms: f.duration })) };
  console.log(`${name}: ${sheetJson.frames.length}コマ ${sheetJson.frameWidth}×${sheetJson.frameHeight}`);
}
fs.writeFileSync(path.join(ED, 'sheets.json'), JSON.stringify(meta, null, 1));
await browser.close();
