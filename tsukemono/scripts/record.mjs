// 店先の動きを動画にする（確認用）。  node scripts/record.mjs [出力.mp4]
// ゲームの時計を1コマずつ進めて画面を撮り、ffmpeg で動画にする（3倍、ぼかさない）。
// 中身: お客全員が順に店の前を歩いて通る → 店を開けて、お客が並んで買っていく。
// Playwright と ffmpeg が必要（PLAYWRIGHT_MODULE / CHROME_PATH で場所を指定できる）。
import { spawn, execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.resolve(process.argv[2] || path.join(root, 'docs/walk/walk.mp4'));
const pw = await import(process.env.PLAYWRIGHT_MODULE ? pathToFileURL(process.env.PLAYWRIGHT_MODULE).href : 'playwright');
const { chromium } = pw.default ?? pw;
const port = 8500 + Math.floor(Math.random() * 300);
const server = spawn(process.execPath, [path.join(root, 'scripts/serve.js'), String(port)], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 500));
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'rec-'));
const FPS = 30, DT = 1000 / FPS;

const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || undefined, args: ['--no-sandbox'] });
try {
  const page = await browser.newPage({ viewport: { width: 1300, height: 900 } });
  // ゲームの時計を手で進める（performance.now と requestAnimationFrame を差しかえる）
  await page.addInitScript(() => {
    window.__vt = 0;
    performance.now = () => window.__vt;
    window.__raf = [];
    window.requestAnimationFrame = (cb) => { window.__raf.push(cb); return 1; };
    window.__step = (dt) => { window.__vt += dt; const q = window.__raf; window.__raf = []; for (const cb of q) cb(window.__vt); };
  });
  await page.goto(`http://localhost:${port}/`);
  await page.waitForFunction(() => window.__game, null, { timeout: 20000 });
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForFunction(() => window.__game, null, { timeout: 20000 });
  await page.click('[data-title="new"]');
  await page.evaluate(() => { const g = window.__game; g.game.weather = 'sunny'; g.ui.override = { manual: true, season: 'spring', time: 'noon', weather: 'sunny' }; g.world.speed = 1; });
  let n = 0;
  const shot = async () => {
    const url = await page.evaluate(() => document.getElementById('screen').toDataURL('image/png'));
    fs.writeFileSync(path.join(tmp, `f${String(n++).padStart(5, '0')}.png`), Buffer.from(url.split(',')[1], 'base64'));
  };
  const run = async (ms) => { for (let t = 0; t < ms; t += DT) { await page.evaluate((dt) => window.__step(dt), DT); await shot(); } };
  // 1. お客全員が順に通る
  await page.evaluate(() => {
    const w = window.__game.world;
    const names = ['woman', 'granny', 'granny2', 'oldman', 'boy', 'girl', 'student', 'gakuran', 'blazer', 'yankee', 'suit', 'shades', 'volley', 'soccer', 'racer', 'karate', 'samurai', 'beach', 'parasol', 'angler', 'hiker', 'knight', 'alien', 'witch', 'demon'];
    window.__parade = names.slice();
    window.__spawnNext = () => {
      const name = window.__parade.shift();
      if (!name) return;
      const a = w.spawn('customer', { body: name, umbrella: '#c63d2f' }, 420, 213, 'walk');
      w.walkTo(a, -40).then(() => w.remove(a));
    };
  });
  for (let i = 0; i < 25; i++) { await page.evaluate(() => window.__spawnNext()); await run(1400); }
  await run(7000);
  // 2. 店を開けて売る
  await page.evaluate(() => { const g = window.__game; g.game.money = 9000; g.game.brew(0, { veg: 'kyuri', pickle: 'asazuke', saltPct: 2.5, tempC: 20 }); g.game.advance(5); g.game.weather = 'sunny'; g.renderAll(); g.doSell(0); });
  await run(26000);
} finally {
  await browser.close();
  server.kill();
}
fs.mkdirSync(path.dirname(out), { recursive: true });
execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', String(FPS), '-i', path.join(tmp, 'f%05d.png'), '-vf', 'scale=iw*3:ih*3:flags=neighbor', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '18', out]);
fs.rmSync(tmp, { recursive: true, force: true });
console.log('動画:', out);
