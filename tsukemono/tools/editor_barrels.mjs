// 樽の中身の絵を、ドット絵エディタ（tools/pixel-editor.html）のペンで1ドットずつ描いて書き出す。  node tools/editor_barrels.mjs
//   先に python3 tools/barrel_tops.py で設計図（assets/editor/barrels/<名前>.design.png と mouths.json）を作っておく。
// エディタでの手順（樽の口×中身ごと）:
//   1. 「作品を開く」で、口の大きさの空のキャンバスと色（パレット）を開く
//   2. 「下絵」に、背景の店先の、その樽の口のあたりを敷く（ふちに被らないか見ながら）
//   3. 色ごとに「ペン」でなぞって描く（横につながったドットは1回のドラッグで）
//   4. 「PNG」で書き出し → assets/img/slot<番号>_<中身>.png。「作品を保存」の JSON → assets/editor/barrels/<名前>.json
// Playwright が必要（PLAYWRIGHT_MODULE / CHROME_PATH）。
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import zlib from 'node:zlib';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pw = await import(process.env.PLAYWRIGHT_MODULE ? pathToFileURL(process.env.PLAYWRIGHT_MODULE).href : 'playwright');
const { chromium } = pw.default ?? pw;
const EDITOR = process.env.EDITOR_HTML || path.join(root, 'tools/pixel-editor.html');
const DIR = path.join(root, 'assets/editor/barrels');
const mouths = JSON.parse(fs.readFileSync(path.join(DIR, 'mouths.json'), 'utf8'));
const only = process.argv.slice(2);
const SYMS = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
const dataUrlToFile = (url, file) => fs.writeFileSync(file, Buffer.from(url.split(',')[1], 'base64'));

const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || undefined, args: ['--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 1500, height: 1000 } });
await page.goto(pathToFileURL(EDITOR).href);
await page.evaluate(() => localStorage.clear());
await page.reload();
// 背景の絵（下絵の切り出し用）
await page.evaluate(async (src) => {
  const img = new Image(); img.src = src; await img.decode(); window.__bg = img;
}, `data:image/png;base64,${fs.readFileSync(path.join(root, 'assets/img/bg.png')).toString('base64')}`);

async function modalAction(label) { await page.locator('#modalActions button', { hasText: label }).first().click(); }
async function setRange(sel, v) { await page.$eval(sel, (el, v) => { el.value = v; el.dispatchEvent(new Event('input', { bubbles: true })); }, String(v)); }
async function key(k) { await page.keyboard.press(k); }
async function tool(name) { await page.click(`#toolGrid [data-tool="${name}"]`); }
async function pickColor(sym) { await page.locator('#swatches button.sw', { hasText: new RegExp(`^${sym}$`) }).first().click(); }

for (const [name, m] of Object.entries(mouths)) {
  if (only.length && !only.includes(name)) continue;
  // 設計図の色と画素（ブラウザで読む）
  const design = await page.evaluate(async (src) => {
    const img = new Image(); img.src = src; await img.decode();
    const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
    const x = c.getContext('2d'); x.drawImage(img, 0, 0);
    const d = x.getImageData(0, 0, c.width, c.height).data;
    const px = [];
    for (let y = 0; y < c.height; y++) for (let i = 0; i < c.width; i++) {
      const k = (y * c.width + i) * 4;
      px.push(d[k + 3] ? '#' + [d[k], d[k + 1], d[k + 2]].map((v) => v.toString(16).padStart(2, '0')).join('') : null);
    }
    return { w: c.width, h: c.height, px };
  }, `data:image/png;base64,${fs.readFileSync(path.join(DIR, `${name}.design.png`)).toString('base64')}`);
  const colors = [...new Set(design.px.filter(Boolean))];
  const symOf = Object.fromEntries(colors.map((c, i) => [c, SYMS[i]]));
  const blank = Array.from({ length: design.h }, () => '.'.repeat(design.w));
  const proj = { format: 'sunshine-pixel', version: 2, width: design.w, height: design.h,
    symbols: colors.map((c, i) => ({ sym: SYMS[i], label: `色${SYMS[i]}`, color: c })),
    layers: [{ name: name.endsWith('empty') ? '空の樽の中' : '樽の中身', visible: true, opacity: 1 }], frames: [{ dur: 100 }], cels: [[blank]], layer: 0, frame: 0 };
  // 1. 開く
  await page.click('#openProjBtn');
  await page.fill('#projText', JSON.stringify(proj));
  await modalAction('読み込む');
  if (await page.isChecked('#symmetry')) await page.click('#symmetry');
  if (await page.isChecked('#symmetryV')) await page.click('#symmetryV');
  // 2. 下絵: 店先のその部分
  const ref = await page.evaluate(([x, y, w, h]) => {
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    c.getContext('2d').drawImage(window.__bg, x, y, w, h, 0, 0, w, h);
    return c.toDataURL('image/png');
  }, [m.x, m.y, design.w, design.h]);
  const refFile = path.join(DIR, `${name}.ref.png`);
  dataUrlToFile(ref, refFile);
  await page.setInputFiles('#refFile', refFile);
  await setRange('#refOpacity', 35);
  await setRange('#zoom', 10);
  await setRange('#brushSize', 1);
  await page.waitForTimeout(150);
  let B;
  const measure = async () => { B = await page.$eval('#gridCanvas', (c) => { const r = c.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; }); };
  const at = (r, c) => ({ x: B.x + (c + 0.5) * (B.w / design.w), y: B.y + (r + 0.5) * (B.h / design.h) });
  // 3. 色ごとにペンでなぞる
  await key('Escape');
  await tool('pencil');
  for (const col of colors) {
    await pickColor(symOf[col]);
    await measure(); // 色を選ぶとページが動くことがあるので、測り直す
    for (let y = 0; y < design.h; y++) {
      let x = 0;
      while (x < design.w) {
        if (design.px[y * design.w + x] !== col) { x++; continue; }
        let e = x;
        while (e + 1 < design.w && design.px[y * design.w + e + 1] === col) e++;
        const a = at(y, x), b = at(y, e);
        await page.mouse.move(a.x, a.y); await page.mouse.down();
        if (e > x) await page.mouse.move(b.x, b.y);
        await page.mouse.up();
        x = e + 1;
      }
    }
  }
  // 4. 書き出し
  await page.click('#exPngBtn');
  await page.selectOption('#exScale', '1');
  await modalAction('画像を作る');
  dataUrlToFile(await page.$eval('#outBox img', (i) => i.src), path.join(root, 'assets/img', `${name}.png`));
  await modalAction('閉じる');
  await page.click('#saveProjBtn');
  fs.writeFileSync(path.join(DIR, `${name}.json`), await page.$eval('#projJson', (t) => t.value));
  await modalAction('閉じる');
  console.log(`${name}: ${design.w}×${design.h}・${colors.length}色`);
}
await browser.close();
void zlib;
