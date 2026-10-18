// 人の絵の手直しを、ドット絵エディタ（tools/pixel-editor.html）のえんぴつで1ドットずつ描いて書き出す。
//   node tools/editor_touch.mjs <設計図.json> [絵の名前...]
// 設計図: { "<元の絵の名前>": [{ x, y, color }...] } または { "<新しい絵の名前>": { "from": "<元の絵>", "touch": [...] } }
//   または { "<新しい絵の名前>": { "size": [幅, 高さ], "touch": [...] } }（まっさらなキャンバスから描く）
//   color が null なら消しゴムで消す。
// エディタでの手順（絵ごと）:
//   1. 元の絵（assets/img/<名前>.png）を、色の表つきの作品にして「作品を開く」で開く
//   2. 色ごとに「えんぴつ」で、設計図のドットを描く（消すドットは「消しゴム」）
//   3. 「PNG」で書き出し → assets/img/<名前>.png。「作品を保存」の JSON → assets/editor/faces/<名前>.json
// 書き出した絵が、元の絵＋設計図と1ドットも違わないことを確かめる。Playwright が必要（PLAYWRIGHT_MODULE / CHROME_PATH）。
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pw = await import(process.env.PLAYWRIGHT_MODULE ? pathToFileURL(process.env.PLAYWRIGHT_MODULE).href : 'playwright');
const { chromium } = pw.default ?? pw;
const EDITOR = process.env.EDITOR_HTML || path.join(root, 'tools/pixel-editor.html');
const OUT = path.join(root, 'assets/editor/faces');
const [designFile, ...only] = process.argv.slice(2);
const design = JSON.parse(fs.readFileSync(designFile, 'utf8'));
const SYMS = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
const dataUrlToFile = (url, file) => fs.writeFileSync(file, Buffer.from(url.split(',')[1], 'base64'));
const png64 = (name) => `data:image/png;base64,${fs.readFileSync(path.join(root, 'assets/img', `${name}.png`)).toString('base64')}`;
fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || undefined, args: ['--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 1500, height: 1000 } });
await page.goto(pathToFileURL(EDITOR).href);
await page.evaluate(() => localStorage.clear());
await page.reload();
async function modalAction(label) { await page.locator('#modalActions button', { hasText: label }).first().click(); }
async function setRange(sel, v) { await page.$eval(sel, (el, v) => { el.value = v; el.dispatchEvent(new Event('input', { bubbles: true })); }, String(v)); }
async function tool(name) { await page.click(`#toolGrid [data-tool="${name}"]`); }
async function pickColor(sym) { await page.locator('#swatches button.sw', { hasText: new RegExp(`^${sym}$`) }).first().click(); }
/** 絵を読む（ブラウザで）: { w, h, px: '#rrggbb' | null の並び } */
const readPng = (src) => page.evaluate(async (src) => {
  const img = new Image(); img.src = src; await img.decode();
  const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
  const x = c.getContext('2d'); x.drawImage(img, 0, 0);
  const d = x.getImageData(0, 0, c.width, c.height).data, px = [];
  for (let i = 0; i < c.width * c.height; i++) px.push(d[i * 4 + 3] ? '#' + [d[i * 4], d[i * 4 + 1], d[i * 4 + 2]].map((v) => v.toString(16).padStart(2, '0')).join('') : null);
  return { w: c.width, h: c.height, px };
}, src);

let bad = 0;
for (const [name, spec] of Object.entries(design)) {
  if (only.length && !only.includes(name)) continue;
  const from = Array.isArray(spec) ? name : spec.from, touch = Array.isArray(spec) ? spec : spec.touch;
  const base = spec.size ? { w: spec.size[0], h: spec.size[1], px: Array(spec.size[0] * spec.size[1]).fill(null) } : await readPng(png64(from));
  const colors = [...new Set([...base.px.filter(Boolean), ...touch.map((t) => t.color).filter(Boolean)])];
  if (colors.length > SYMS.length) throw new Error(`${name}: 色が多すぎる（${colors.length}）`);
  const symOf = Object.fromEntries(colors.map((c, i) => [c, SYMS[i]]));
  const rows = Array.from({ length: base.h }, (_, y) => Array.from({ length: base.w }, (_, x) => { const c = base.px[y * base.w + x]; return c ? symOf[c] : '.'; }).join(''));
  const proj = { format: 'sunshine-pixel', version: 2, width: base.w, height: base.h,
    symbols: colors.map((c, i) => ({ sym: SYMS[i], label: `色${SYMS[i]}`, color: c })),
    layers: [{ name: name === from ? '手直し' : '表情', visible: true, opacity: 1 }], frames: [{ dur: 100 }], cels: [[rows]], layer: 0, frame: 0 };
  // 1. 開く
  await page.click('#openProjBtn');
  await page.fill('#projText', JSON.stringify(proj));
  await modalAction('読み込む');
  if (await page.isChecked('#symmetry')) await page.click('#symmetry');
  if (await page.isChecked('#symmetryV')) await page.click('#symmetryV');
  await setRange('#zoom', base.w > 90 ? 6 : 8);
  await setRange('#brushSize', 1);
  await page.keyboard.press('Escape');
  let B;
  const measure = async () => { B = await page.$eval('#gridCanvas', (c) => { const r = c.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; }); };
  const at = (y, x) => ({ x: B.x + (x + 0.5) * (B.w / base.w), y: B.y + (y + 0.5) * (B.h / base.h) });
  // 横に並んだドットは1回のドラッグで描く
  const runs = (list) => {
    const set = new Set(list.map((t) => t.y * base.w + t.x)), out = [];
    for (const t of [...list].sort((a, b) => a.y - b.y || a.x - b.x)) {
      if (set.has(t.y * base.w + t.x - 1)) continue;
      let e = t.x; while (set.has(t.y * base.w + e + 1)) e++;
      out.push([t.y, t.x, e]);
    }
    return out;
  };
  const stroke = async ([y, x0, x1]) => { const a = at(y, x0), b = at(y, x1); await page.mouse.move(a.x, a.y); await page.mouse.down(); if (x1 > x0) await page.mouse.move(b.x, b.y, { steps: Math.max(1, x1 - x0) }); await page.mouse.up(); };
  // 2. 色ごとにえんぴつ、消すドットは消しゴム
  for (const col of [...new Set(touch.map((t) => t.color).filter(Boolean))]) {
    await tool('pencil'); await pickColor(symOf[col]); await measure();
    for (const r of runs(touch.filter((t) => t.color === col))) await stroke(r);
  }
  const erase = touch.filter((t) => !t.color);
  if (erase.length) { await tool('eraser'); await measure(); for (const r of runs(erase)) await stroke(r); }
  // 3. 書き出し
  await page.click('#exPngBtn');
  await page.selectOption('#exScale', '1');
  await modalAction('画像を作る');
  const url = await page.$eval('#outBox img', (i) => i.src);
  await modalAction('閉じる');
  await page.click('#saveProjBtn');
  fs.writeFileSync(path.join(OUT, `${name}.json`), await page.$eval('#projJson', (t) => t.value));
  await modalAction('閉じる');
  // 確かめ: 元の絵＋設計図と同じか
  const got = await readPng(url);
  const want = [...base.px];
  for (const t of touch) want[t.y * base.w + t.x] = t.color;
  const diff = want.reduce((n, c, i) => n + (c !== got.px[i] ? 1 : 0), 0);
  if (diff || got.w !== base.w || got.h !== base.h) { bad++; console.log(`${name}: ${diff}ドット違う（書き出さない）`); continue; }
  dataUrlToFile(url, path.join(root, 'assets/img', `${name}.png`));
  console.log(`${name}: ${touch.length}ドット描いた（${spec.size ? 'まっさらなキャンバス' : from} から）`);
}
await browser.close();
if (bad) process.exit(1);
