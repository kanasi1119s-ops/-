// すべての窓を開いて画面を撮り、はみ出し・おかしな文字・エラーを調べる（デバッグ用）。  node scripts/winshots.mjs
// パソコン幅（1360×900）とスマホ幅（390×844）で撮る → docs/winshots/。Playwright が必要。
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(root, 'docs/winshots');
const pw = await import(process.env.PLAYWRIGHT_MODULE ? pathToFileURL(process.env.PLAYWRIGHT_MODULE).href : 'playwright');
const { chromium } = pw.default ?? pw;
const port = 8000 + Math.floor(Math.random() * 900);
const server = spawn(process.execPath, [path.join(root, 'scripts/serve.js'), String(port)], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 500));
fs.mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || undefined, args: ['--no-sandbox'] });
const found = [];
try {
  for (const [vw, vh, tag] of [[1360, 900, 'pc'], [390, 844, 'sp']]) {
    const page = await browser.newPage({ viewport: { width: vw, height: vh } });
    page.on('pageerror', (e) => found.push(`${tag} エラー: ${e.message}`));
    page.on('console', (m) => { if (m.type() === 'error') found.push(`${tag} console: ${m.text()}`); });
    await page.goto(`http://localhost:${port}/`);
    await page.waitForFunction(() => window.__game, null, { timeout: 20000 });
    await page.evaluate(() => localStorage.clear()); await page.reload();
    await page.waitForFunction(() => window.__game, null, { timeout: 20000 });
    await page.click('[data-title="new"]');
    // 遊びこんだ店にする: お金・レベル・樽・棚・在庫・従業員
    await page.evaluate(() => {
      const g = window.__game, G = g.game;
      while (g.ui.win) g.closeWin();
      G.money = 300000; G.reputation = 80;
      G.brew(0, { veg: 'kyuri', pickle: 'asazuke', saltPct: 2.5, tempC: 20 });
      G.brew(1, { veg: 'hakusai', pickle: 'hakusaizuke', saltPct: 3, tempC: 20 });
      for (let i = 0; i < 12; i++) G.advance(1);
      G.buyStock('daikon', 12);
      G.popEvents(); g.renderAll();
    });
    const wins = [
      ['brew', { slot: 2 }], ['barrel', { slot: 0 }], ['barrels', {}], ['book', {}], ['market', {}], ['shop', {}], ['nuka', {}],
      ['sell', { slot: 0 }], ['settings', {}], ['help', {}], ['saveText', { text: 'x' }], ['rest', {}], ['granny', {}],
      ['saga', { id: 'SAGA1', all: true }], ['claim', {}],
      ['dayend', { t: 'TODAY' }],
      ['wisdom', { e: { type: 'wisdom', id: 'x', text: '塩はひとつまみ多いくらいが、夏は安心じゃよ。', lore: true } }],
      ['story', { e: { type: 'story', id: 'x', name: '町内会長', title: '長い長いお話', text: 'むかしむかし、この町には漬物屋が十軒もあってのう。'.repeat(4) } }],
      ['idea', { e: { type: 'inspire', pickle: 'takuan', line: '干した大根をぬかに漬けたら…！', via: 'inspire' } }],
      ['levelup', { e: { type: 'levelup', level: 3, title: '町で評判の店', line: 'お客が増えてきた。', opens: ['看板店員を雇える', '冷蔵庫', '新しい漬物'] } }],
      ['reformed', { e: { type: 'reformed', line: 'まあ…悪くないな。また来てやる。' } }],
    ];
    for (const [kind, opts] of wins) {
      const res = await page.evaluate(([kind, opts]) => {
        const g = window.__game;
        if (opts.id === 'SAGA1') opts = { ...opts, id: 'rival' };
        if (opts.t === 'TODAY') opts = { t: { ...g.ui.today, repEnd: g.game.reputation } };
        try { while (g.ui.win) g.closeWin(); g.openWin(kind, opts); } catch (e) { return { err: String(e.stack || e).slice(0, 400) }; }
        const m = document.getElementById('modal'), body = document.getElementById('winBody');
        const box = (m.querySelector('.win') || m.firstElementChild || m).getBoundingClientRect();
        const txt = m.innerText;
        const out = [];
        if (/NaN|undefined|\[object Object\]|null円/.test(txt)) out.push(`文字に ${txt.match(/NaN|undefined|\[object Object\]|null円/)[0]}`);
        if (box.right > innerWidth + 1 || box.left < -1) out.push(`横にはみ出す ${Math.round(box.left)}〜${Math.round(box.right)}`);
        if (body && body.scrollWidth > body.clientWidth + 2) out.push(`中身が横にあふれる ${body.scrollWidth}>${body.clientWidth}`);
        if (document.documentElement.scrollWidth > innerWidth + 1) out.push(`ページが横にスクロールする ${document.documentElement.scrollWidth}`);
        return { out, title: document.getElementById('winTitle').textContent };
      }, [kind, opts]);
      if (res.err) found.push(`${tag} ${kind}: 開けない（${res.err}）`);
      else for (const o of res.out) found.push(`${tag} ${kind}「${res.title}」: ${o}`);
      await page.screenshot({ path: path.join(OUT, `${tag}_${kind}.png`), fullPage: false });
    }
    await page.close();
  }
} finally {
  await browser.close(); server.kill();
  console.log(found.length ? found.join('\n') : '問題なし');
}
