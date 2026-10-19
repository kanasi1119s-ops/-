// すべてのボタンを確かめる（デバッグ用）。  node scripts/buttons.mjs
// 窓（全種類・タブも）とメイン画面のボタンを、いろいろな画面の大きさと埋め込み表示（高くのびる枠）で、1つずつ
//   1. 届くか: 窓の中をスクロールしてボタンを出したとき、見えている範囲の中にあって、指で押せる（ほかの物の下にかくれていない）
//   2. 押せるか: 本物のマウスで押して、エラーが出ず、何かが変わる（画面・お金・せりふ・選んだもの）
// を調べ、だめだったものを一覧にする。Playwright が必要（PLAYWRIGHT_MODULE / CHROME_PATH）。dist/tsukemono-standalone.html を使う（先に npm run build）。
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pw = await import(process.env.PLAYWRIGHT_MODULE ? pathToFileURL(process.env.PLAYWRIGHT_MODULE).href : 'playwright');
const { chromium } = pw.default ?? pw;
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'btn-'));
fs.copyFileSync(path.join(root, 'dist/tsukemono-standalone.html'), path.join(tmp, 'game.html'));
const QUICK = process.argv.includes('--quick');

// 遊びこんだ店にする（窓にたくさんボタンが出るように）
const SETUP = () => {
  const g = window.__game, G = g.game;
  while (g.ui.win) g.closeWin();
  g.ui.paused = true;
  G.money = 500000; G.reputation = 95;
  for (let i = 0; i < 40; i++) G.advance(1);
  G.popEvents();
  for (let k = 0; k < 4 && G.barrels.length < G.barrelMax() && G.nextBarrelCost() != null; k++) if (!G.buyBarrel().ok) break;
  G.barrels.forEach((b, i) => { if (b) G.discard(i); });
  G.brew(0, { veg: 'kyuri', pickle: 'asazuke', saltPct: 2.5, tempC: 20 });
  G.brew(1, { veg: 'hakusai', pickle: 'hakusaizuke', saltPct: 3, tempC: 20 });
  if (G.canBrew('nukazuke').ok) G.brew(2, { veg: 'kyuri', pickle: 'nukazuke', saltPct: 0, tempC: 20 });
  for (let i = 0; i < 6; i++) G.advance(1);
  try { G.shelve(0); } catch { /* 棚がなければよい */ }
  G.brew(0, { veg: 'kabu', pickle: 'asazuke', saltPct: 2.5, tempC: 20 });
  G.buyStock?.('daikon', 12);
  G.popEvents(); g.ui.pending = []; g.renderAll();
};
const WINS0 = [
  ['brew', { slot: 3 }], ['barrel', { slot: 1 }], ['barrel', { slot: 2 }], ['barrels', {}], ['sell', {}], ['market', {}], ['shop', {}], ['nuka', {}], ['book', {}],
  ['settings', {}], ['help', {}], ['rest', {}], ['granny', {}], ['claim', {}], ['saveText', { text: 'x' }], ['saveText', { text: null }],
  ['saga', { id: 'prologue', step: 0 }], ['saga', { id: 'rival', all: true }], ['dayend', 'TODAY'],
  ['wisdom', { e: { text: '塩はひとつまみ多めに。', lore: false } }], ['story', { e: { name: '町内会長', title: '昔話', text: 'むかしむかし。' } }],
  ['idea', { e: { pickle: 'takuan', line: 'ひらめいた', via: 'inspire' } }], ['levelup', { e: { level: 3, title: '町の店', line: 'やったな', opens: ['冷蔵庫'] } }], ['reformed', { e: { line: 'また来てやる' } }],
];
const ONLY = process.env.SIZE ? [process.env.SIZE.split('x').map(Number)] : null;
const WINS = process.env.WIN ? WINS0.filter(([k]) => k === process.env.WIN) : WINS0;
const SIZES = ONLY ?? (QUICK ? [[1280, 720], [390, 640]] : [[1360, 900], [1280, 720], [1024, 600], [390, 844], [390, 600], [844, 390]]);
const EMBED = ONLY ? [] : QUICK ? [[1280, 700, 1800]] : [[1280, 700, 1800], [400, 700, 2600]]; // 外の見える大きさと、のびた枠の高さ
const SKIP_CLICK = new Set(['reset', 'toTitle', 'pickFile', 'importSave', 'pasteSave', 'exportSave']); // 押すと遊びが止まる・別の窓に飛ぶ（届くかだけ見る）

const problems = [];
const note = (where, what) => { const k = `${where}｜${what}`; if (!problems.includes(k)) { problems.push(k); console.log('!!', k); } };
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || undefined, args: ['--no-sandbox', '--allow-file-access-from-files'] });

async function run(label, page, frame, vis) {
  frame.page().on('pageerror', (e) => note(label, `エラー: ${e.message}`));
  await frame.waitForFunction(() => window.__game, null, { timeout: 60000 });
  await frame.evaluate(() => localStorage.clear());
  await frame.click('[data-title="new"]');
  await frame.evaluate(SETUP);
  // 見えている範囲（外のページの座標で）と、枠の位置
  const off = async () => (frame === page.mainFrame() ? { x: 0, y: 0 } : page.evaluate(() => { const r = document.querySelector('iframe').getBoundingClientRect(); return { x: r.left, y: r.top }; }));
  const openW = (kind, opts) => frame.evaluate(([kind, opts]) => {
    const g = window.__game; if (opts === 'TODAY') opts = { t: { ...g.ui.today, repEnd: g.game.reputation } };
    while (g.ui.win) g.closeWin(); g.openWin(kind, opts);
    document.getAnimations().forEach((a) => { if (a.effect?.getComputedTiming().endTime !== Infinity) a.finish(); }); // 窓が出るときの動き（少し縮んでいる）を終わらせてから測る
    return document.getElementById('winTitle').textContent;
  }, [kind, opts]);
  // i 番目のボタンを窓の中でスクロールして出し、届くかを見る
  const reach = async (sel, i) => {
    const r = await frame.evaluate(([sel, i]) => {
      const el = [...document.querySelectorAll(sel)].filter((x) => x.offsetParent)[i]; if (!el) return null;
      const body = el.closest('#winBody'); // 足もと（#winFoot）のボタンはスクロールしない
      document.getAnimations().forEach((a) => { if (a.effect?.getComputedTiming().endTime !== Infinity) a.finish(); });
      if (body) { const a = el.getBoundingClientRect(), b = body.getBoundingClientRect(); body.scrollTop += (a.top + a.height / 2) - (b.top + b.height / 2); }
      else el.scrollIntoView({ block: 'center' });
      const a = el.getBoundingClientRect();
      const name = (el.dataset.act || el.dataset.cmd || Object.keys(el.dataset)[0] || el.id || '') + '「' + el.textContent.trim().replace(/\s+/g, ' ').slice(0, 14) + '」';
      return { x: a.left + a.width / 2, y: a.top + a.height / 2, w: a.width, h: a.height, name, disabled: el.disabled, act: el.dataset.act };
    }, [sel, i]);
    if (!r) return null;
    if (frame !== page.mainFrame() && !(await frame.evaluate(() => !!document.querySelector('#modal:not([hidden])')))) await page.evaluate((y) => window.scrollTo(0, Math.max(0, y)), 0);
    const o = await off();
    const X = r.x + o.x, Y = r.y + o.y;
    const inView = X >= 0 && X <= vis.w && Y >= 0 && Y <= vis.h && r.w > 4 && r.h > 4;
    const hit = await frame.evaluate(([sel, i, x, y]) => { const el = [...document.querySelectorAll(sel)].filter((q) => q.offsetParent)[i]; const h = document.elementFromPoint(x, y); return !!h && (h === el || el.contains(h)) ? true : (h ? `${h.tagName}.${h.className}「${h.textContent.trim().slice(0, 12)}」` : 'なし'); }, [sel, i, r.x, r.y]);
    return { ...r, X, Y, ok: inView && hit === true, why: !inView ? `見える範囲の外（${Math.round(X)},${Math.round(Y)} / ${vis.w}×${vis.h}）` : hit !== true ? `ほかの物の下（${hit}）` : '' };
  };
  const stateOf = () => frame.evaluate(() => { const g = window.__game; return JSON.stringify([g.ui.win?.kind, g.ui.win?.tab, g.ui.win?.step, document.getElementById('modal').hidden, document.getElementById('winBody').innerHTML.length, document.getElementById('winBody').innerHTML.slice(0, 4000), document.getElementById('winFoot').innerHTML, g.game.money, document.getElementById('message')?.textContent, g.ui.recipe, g.ui.slot, g.ui.display, g.ui.paused, g.ui.confirm, document.getElementById('title')?.hidden]); });

  let nWin = 0, nBtn = 0;
  // ---- 窓
  for (const [kind, opts] of WINS) {
    const title = await openW(kind, opts);
    // タブがあれば、タブごとに
    const tabs = await frame.evaluate(() => [...document.querySelectorAll('#winBody [data-tab]')].map((b) => b.dataset.tab));
    for (const tab of tabs.length ? tabs : [null]) {
      const reopen = async () => { await openW(kind, opts); if (tab) await frame.evaluate((t) => { window.__game.ui.win.tab = t; document.querySelector(`#winBody [data-tab="${t}"]`)?.click(); }, tab); };
      await reopen();
      const where = `${label} 窓「${title}」${tab ? `（${tab}）` : ''}`;
      nWin++; const t0 = Date.now();
      const n = await frame.evaluate(() => [...document.querySelectorAll('#modal button, #modal input, #modal select')].filter((x) => x.offsetParent).length);
      for (let i = 0; i < n; i++) {
        await reopen();
        const sel = '#modal button, #modal input, #modal select';
        const r = await reach(sel, i); if (!r) continue;
        nBtn++;
        if (!r.ok) { note(where, `${r.name} が押せない: ${r.why}`); continue; }
        if (r.disabled || SKIP_CLICK.has(r.act) || QUICK) continue;
        const tag = await frame.evaluate(([sel, i]) => [...document.querySelectorAll(sel)].filter((x) => x.offsetParent)[i].tagName, [sel, i]);
        if (tag !== 'BUTTON') continue;
        const before = await stateOf();
        await page.mouse.click(r.X, r.Y); await page.waitForTimeout(60);
        await frame.waitForFunction(() => !window.__game.ui.busy, null, { timeout: 30000 }).catch(() => note(where, `${r.name} を押したあと止まったまま`));
        const after = await stateOf();
        if (before === after) note(where, `${r.name} を押しても何も変わらない`);
        if (await frame.evaluate(() => !!document.getElementById('title') && !document.getElementById('title').hidden)) { await frame.click('[data-title="continue"]').catch(() => frame.click('[data-title="new"]')); await frame.evaluate(SETUP); }
      }
      if (process.env.VERBOSE) console.log(`  ${where}: ${n}個 ${((Date.now() - t0) / 1000).toFixed(1)}秒`);
    }
  }
  // ---- メイン画面（コマンド・時間の一時停止・樽の札）
  await frame.evaluate(() => { const g = window.__game; while (g.ui.win) g.closeWin(); });
  const msel = '#hud button, #commands button, #chips button, .commands button, .hud button, .chips button';
  const mn = await frame.evaluate((s) => [...document.querySelectorAll(s)].filter((x) => x.offsetParent).length, msel);
  for (let i = 0; i < mn; i++) {
    await frame.evaluate(() => { const g = window.__game; while (g.ui.win) g.closeWin(); g.ui.paused = true; });
    const r = await frame.evaluate(([s, i]) => { const el = [...document.querySelectorAll(s)].filter((x) => x.offsetParent)[i]; el.scrollIntoView({ block: 'center' }); const a = el.getBoundingClientRect(); return { x: a.left + a.width / 2, y: a.top + a.height / 2, name: (el.dataset.cmd || el.dataset.chip || '') + '「' + el.textContent.trim().slice(0, 12) + '」', disabled: el.disabled }; }, [msel, i]);
    const o = await off();
    if (frame !== page.mainFrame()) await page.evaluate((y) => window.scrollTo(0, y), r.y + o.y + await page.evaluate(() => scrollY) - vis.h / 2);
    const o2 = await off();
    const hit = await frame.evaluate(([s, i, x, y]) => { const el = [...document.querySelectorAll(s)].filter((q) => q.offsetParent)[i]; const h = document.elementFromPoint(x, y); return !!h && (h === el || el.contains(h)); }, [msel, i, r.x, r.y]);
    const Y = r.y + o2.y;
    nBtn++;
    if (!hit || Y < 0 || Y > vis.h) { note(`${label} メイン画面`, `${r.name} が押せない`); continue; }
    if (r.disabled || QUICK) continue;
    const before = await stateOf();
    await page.mouse.click(r.x + o2.x, Y); await page.waitForTimeout(60);
    await frame.waitForFunction(() => !window.__game.ui.busy, null, { timeout: 30000 }).catch(() => {});
    if (before === await stateOf()) note(`${label} メイン画面`, `${r.name} を押しても何も変わらない`);
  }
  console.log(`${label}: 窓 ${nWin}・ボタン ${nBtn}`);
}

for (const [w, h] of SIZES) {
  const page = await browser.newPage({ viewport: { width: w, height: h }, hasTouch: w < 600, isMobile: w < 600 });
  page.on('filechooser', () => {}); page.on('dialog', (d) => d.dismiss());
  await page.goto(pathToFileURL(path.join(tmp, 'game.html')).href);
  await run(`${w}×${h}`, page, page.mainFrame(), { w, h });
  await page.close();
}
for (const [w, h, fh] of EMBED) {
  fs.writeFileSync(path.join(tmp, 'outer.html'), `<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><body style="margin:0;background:#222"><div style="height:30px"></div><iframe src="game.html" style="width:100%;height:${fh}px;border:0;display:block"></iframe><div style="height:200px"></div></body>`);
  const page = await browser.newPage({ viewport: { width: w, height: h }, hasTouch: w < 600, isMobile: w < 600 });
  page.on('filechooser', () => {}); page.on('dialog', (d) => d.dismiss());
  await page.goto(pathToFileURL(path.join(tmp, 'outer.html')).href);
  await page.waitForTimeout(500);
  const frame = page.frames().find((f) => f.url().endsWith('game.html'));
  await run(`埋め込み${w}×${h}（枠${fh}）`, page, frame, { w, h });
  await page.close();
}
await browser.close();
console.log(problems.length ? `\n見つかったもの ${problems.length}件\n${problems.join('\n')}` : '\nすべてのボタンが届いて、押せた');
