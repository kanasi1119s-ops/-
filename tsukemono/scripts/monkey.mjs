// でたらめに遊んで不具合を探す（デバッグ用）。  node scripts/monkey.mjs [手数=600] [種=1]
// 画面に見えているボタンや入力をでたらめに押し、ときどき時間を進める。ブラウザのエラー・おかしな数（NaN・負のお金など）・
// 画面からはみ出した窓を集めて最後に一覧にする。おかしな所が出た手の前後は docs/monkey/ に画面を残す。
// Playwright が必要（PLAYWRIGHT_MODULE / CHROME_PATH で場所を指定できる）。
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const STEPS = Number(process.argv[2] || 600), SEED = Number(process.argv[3] || 1);
const OUT = path.join(root, 'docs/monkey');
const pw = await import(process.env.PLAYWRIGHT_MODULE ? pathToFileURL(process.env.PLAYWRIGHT_MODULE).href : 'playwright');
const { chromium } = pw.default ?? pw;
let s = SEED >>> 0 || 1;
const rnd = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32);

const port = 8000 + Math.floor(Math.random() * 900);
const server = spawn(process.execPath, [path.join(root, 'scripts/serve.js'), String(port)], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 500));
fs.mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || undefined, args: ['--no-sandbox'] });
const problems = [];
try {
  const page = await browser.newPage({ viewport: { width: Number(process.env.W || 1360), height: Number(process.env.H || 900) } });
  let step = 0, lastAct = '';
  const note = async (kind, msg) => {
    if (problems.some((p) => p.kind === kind && p.msg === msg)) return;
    const shot = `step${step}_${problems.length}.png`;
    await page.screenshot({ path: path.join(OUT, shot) }).catch(() => {});
    problems.push({ step, kind, msg, after: lastAct, shot });
    console.log(`!! ${step} ${kind}: ${msg}  （直前: ${lastAct}）`);
  };
  page.on('pageerror', (e) => { problems.push({ step, kind: 'error', msg: e.message, after: lastAct }); console.log(`!! ${step} error: ${e.message} （直前: ${lastAct}）`); });
  page.on('console', (m) => { if (m.type() === 'error') { problems.push({ step, kind: 'console', msg: m.text(), after: lastAct }); console.log(`!! ${step} console: ${m.text()}`); } });
  page.on('dialog', (d) => d.dismiss());
  await page.goto(`http://localhost:${port}/`);
  await page.waitForFunction(() => window.__game, null, { timeout: 20000 });
  await page.evaluate(() => localStorage.clear()); await page.reload();
  await page.waitForFunction(() => window.__game, null, { timeout: 20000 });
  await page.click('[data-title="new"]');
  await page.evaluate(() => { window.__game.world.speed = 8; });
  // 押さないもの: 最初から・タイトルへ・ファイルを選ぶ（遊びが止まる）
  const SKIP = ['reset', 'toTitle', 'pickFile', 'importSave', 'pasteSave'];
  for (step = 1; step <= STEPS; step++) {
    const r = rnd();
    if (r < 0.12) {
      lastAct = '時間を進める';
      await page.evaluate(() => { const g = window.__game; if (!g.ui.busy) g.advance(1 + Math.floor(Math.random() * 3)); }).catch(() => {});
      await page.waitForFunction(() => !window.__game.ui.busy, null, { timeout: 30000 }).catch(() => note('stuck', '時間を進めたまま戻らない'));
    } else {
      const items = await page.evaluate((SKIP) => {
        const vis = (e) => { const r = e.getBoundingClientRect(); const st = getComputedStyle(e); return r.width > 0 && r.height > 0 && st.visibility !== 'hidden' && st.display !== 'none' && !e.disabled; };
        const els = [...document.querySelectorAll('button, [data-act], select, input[type=range], input[type=number], input[type=checkbox], canvas#screen')]
          .filter(vis).filter((e) => !SKIP.includes(e.dataset.act) && e.type !== 'file');
        // 窓が開いていれば窓の中を多めに
        const modal = els.filter((e) => e.closest('#modal, .win, #win'));
        return (modal.length && Math.random() < 0.75 ? modal : els).map((e) => {
          const r = e.getBoundingClientRect();
          return { x: r.left + r.width / 2, y: r.top + r.height / 2, tag: e.tagName, type: e.type, label: (e.dataset.act || e.dataset.cmd || e.textContent || e.id || '').trim().slice(0, 30), sel: e.tagName === 'SELECT' ? e.options.length : 0 };
        });
      }, SKIP);
      if (!items.length) { lastAct = '（押せるものがない）'; continue; }
      const it = items[Math.floor(rnd() * items.length)];
      lastAct = `${it.tag} ${it.label}`;
      try {
        if (it.tag === 'SELECT') {
          await page.evaluate(({ x, y, k }) => { const e = document.elementFromPoint(x, y)?.closest('select'); if (e) { e.selectedIndex = k % e.options.length; e.dispatchEvent(new Event('change', { bubbles: true })); e.dispatchEvent(new Event('input', { bubbles: true })); } }, { x: it.x, y: it.y, k: Math.floor(rnd() * 20) });
        } else if (it.type === 'range' || it.type === 'number') {
          await page.evaluate(({ x, y, f }) => { const e = document.elementFromPoint(x, y)?.closest('input'); if (e) { const lo = Number(e.min || 0), hi = Number(e.max || 100); e.value = String(Math.round(lo + (hi - lo) * f)); e.dispatchEvent(new Event('input', { bubbles: true })); e.dispatchEvent(new Event('change', { bubbles: true })); } }, { x: it.x, y: it.y, f: rnd() });
        } else {
          await page.mouse.click(it.x, it.y);
        }
      } catch (e) { /* 押せなかった */ }
      await page.waitForTimeout(60);
      await page.waitForFunction(() => !window.__game.ui.busy, null, { timeout: 30000 }).catch(() => note('stuck', `押したあと戻らない`));
    }
    // おかしな数・はみ出し
    const bad = await page.evaluate(() => {
      const g = window.__game.game, out = [];
      const num = (v, k) => { if (typeof v === 'number' && !Number.isFinite(v)) out.push(`${k} が ${v}`); };
      num(g.money, 'お金'); num(g.reputation, '評判');
      if (g.money < -1e6) out.push(`お金が ${g.money}`);
      (g.barrels || []).forEach((b, i) => { if (b) for (const [k, v] of Object.entries(b)) num(v, `樽${i}.${k}`); });
      const txt = document.body.innerText;
      if (/NaN|undefined|\[object Object\]/.test(txt)) out.push(`画面の文字に ${txt.match(/NaN|undefined|\[object Object\]/)[0]}`);
      const W = innerWidth, H = innerHeight;
      for (const e of document.querySelectorAll('#modal .win, #modal > div, .win')) {
        const r = e.getBoundingClientRect();
        if (r.width && (r.right > W + 2 || r.left < -2)) out.push(`窓が横にはみ出す（${Math.round(r.left)}〜${Math.round(r.right)} / ${W}）`);
      }
      return out;
    }).catch(() => []);
    for (const b of bad) await note('bad', b);
    if (step % 100 === 0) {
      const st = await page.evaluate(() => { const g = window.__game.game; return `${g.day()}日目 ${g.timeOfDay()} お金${g.money} 評判${Math.round(g.reputation)} 樽${g.barrels.filter(Boolean).length}/${g.barrels.length} 棚${JSON.stringify(g.shelf ?? null).slice(0, 60)} 在庫${JSON.stringify(g.stock ?? null).slice(0, 60)} 従業員${JSON.stringify(g.staff ?? null)}`; });
      console.log(`-- ${step}手: ${st}`);
    }
  }
} finally {
  await browser.close(); server.kill();
  fs.writeFileSync(path.join(OUT, 'report.json'), JSON.stringify(problems, null, 1));
  console.log(`\n見つかったもの ${problems.length}件 → docs/monkey/report.json`);
}
