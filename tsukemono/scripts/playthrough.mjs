// まじめに長く遊んでみる（デバッグ用）。  node scripts/playthrough.mjs [日数=120]
// 毎朝、空いた樽に浅漬けや白菜漬けを仕込み、食べ頃の樽を店先に出し、出てきた窓はいちばん目立つボタンで閉じる。
// お金がたまれば樽・従業員を足す。エラー・おかしな数・止まったままを集め、10日ごとに店先を docs/playthrough/ に撮る。
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DAYS = Number(process.argv[2] || 120);
const OUT = path.join(root, 'docs/playthrough');
const pw = await import(process.env.PLAYWRIGHT_MODULE ? pathToFileURL(process.env.PLAYWRIGHT_MODULE).href : 'playwright');
const { chromium } = pw.default ?? pw;
const port = 8000 + Math.floor(Math.random() * 900);
const server = spawn(process.execPath, [path.join(root, 'scripts/serve.js'), String(port)], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 500));
fs.mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || undefined, args: ['--no-sandbox'] });
const found = [];
const seen = { win: new Set(), ev: new Set() };
try {
  const page = await browser.newPage({ viewport: { width: 1360, height: 900 } });
  page.on('pageerror', (e) => { found.push(`エラー: ${e.message}`); console.log('!! エラー', e.message); });
  page.on('console', (m) => { if (m.type() === 'error') { found.push(`console: ${m.text()}`); console.log('!! console', m.text()); } });
  await page.goto(`http://localhost:${port}/`);
  await page.waitForFunction(() => window.__game, null, { timeout: 20000 });
  await page.evaluate(() => localStorage.clear()); await page.reload();
  await page.waitForFunction(() => window.__game, null, { timeout: 20000 });
  await page.click('[data-title="new"]');
  await page.evaluate(() => { window.__game.world.speed = 16; window.__game.ui.paused = true; });
  // 開いている窓を閉じる（ボタンの中でいちばん目立つもの。物語は「次へ」を押し切る）
  const closeAll = async () => {
    for (let k = 0; k < 40; k++) {
      const w = await page.evaluate(() => { const g = window.__game; return g.ui.win ? g.ui.win.kind : null; });
      if (!w) return;
      seen.win.add(w);
      const b = await page.$('#winBody [data-act="sagaNext"]') || await page.$('#winBody button.main') || await page.$('#winBody [data-act="closeWin"]');
      if (b) await b.click().catch(() => {}); else await page.evaluate(() => window.__game.closeWin());
      await page.waitForTimeout(30);
    }
    found.push('窓が閉じきれない');
  };
  for (let day = 1; day <= DAYS; day++) {
    await closeAll();
    await page.evaluate(() => {
      const g = window.__game, G = g.game;
      // 食べ頃・酸っぱくなりかけを店先に、ダメなものは捨てる
      G.barrels.forEach((b, i) => { if (!b) return; const t = G.tasteOf(i); if (t.stage === 'spoiled' || t.stage === 'rotten') G.discard(i); });
      const ready = G.barrels.map((b, i) => (b ? [i, G.tasteOf(i).stage] : null)).filter((x) => x && ['ripe', 'over', 'sour'].includes(x[1]));
      if (ready.length && (g.ui.display == null || !G.vessel(g.ui.display))) g.doSell(ready[0][0]);
      // 空いた樽に仕込む（季節の野菜で浅漬け、1つは白菜漬け）
      G.barrels.forEach((b, i) => {
        if (b) return;
        const veg = ['kyuri', 'nasu', 'kabu', 'hakusai', 'daikon', 'kyabetsu'].find((v) => G.vegAvailable(v));
        const pk = i === 1 && G.vegAvailable('hakusai') ? ['hakusai', 'hakusaizuke', 3] : [veg, 'asazuke', 2.5];
        G.brew(i, { veg: pk[0], pickle: pk[1], saltPct: pk[2], tempC: 20 });
      });
      // お金がたまったら樽と従業員
      const nb = G.nextBarrelCost();
      if (nb != null && G.barrels.length < G.barrelMax() && G.money > nb + 20000) G.buyBarrel?.();
      for (const id of ['baito', 'kanban', 'deshi']) if (!G.staff.includes(id) && G.money > 60000) G.hire(id);
      if (G.claim) g.closeWin();
      g.renderAll();
    }).catch((e) => found.push(`日${day} 朝の手: ${e.message}`));
    // 一日ぶん、1刻みずつ進める（窓が出たら閉じる）
    for (let t = 0; t < 6; t++) {
      await closeAll();
      const ok = await page.evaluate(async () => { const g = window.__game; if (g.ui.busy) return 'busy'; await g.advance(1); return 'ok'; }).catch((e) => `err ${e.message}`);
      if (ok !== 'ok') found.push(`日${day}: 進めない（${ok}）`);
      await page.waitForFunction(() => !window.__game.ui.busy, null, { timeout: 30000 }).catch(() => found.push(`日${day}: 止まったまま`));
      await page.evaluate(() => window.__game.tryOpenShop());
      await page.waitForTimeout(80);
    }
    const st = await page.evaluate(() => {
      const G = window.__game.game, bad = [];
      if (!Number.isFinite(G.money) || G.money < 0) bad.push(`お金 ${G.money}`);
      if (/NaN|undefined|\[object Object\]/.test(document.body.innerText)) bad.push('画面に NaN/undefined');
      return { bad, s: `${G.day()}日目 Lv${G.level().level} お金${G.money} 評判${Math.round(G.reputation)} 樽${G.barrels.length} 従業員${G.staff.join(',')} 章${G.story?.done?.length ?? '?'}` };
    });
    for (const b of st.bad) if (!found.includes(b)) { found.push(`日${day}: ${b}`); }
    if (day % 10 === 0) { console.log(st.s); await page.screenshot({ path: path.join(OUT, `day${day}.png`) }); }
  }
} finally {
  await browser.close(); server.kill();
  console.log(`\n出た窓: ${[...seen.win].join(' ')}`);
  console.log(found.length ? found.join('\n') : '問題なし');
}
