// 画面の通し確認（ブラウザで実際に遊んでみる）。  npm run e2e
// Playwright が必要: npm i -D playwright && npx playwright install chromium
//   別の場所の Playwright を使うとき: PLAYWRIGHT_MODULE=/path/to/playwright/index.mjs
//   Chromium の場所を指定するとき:    CHROME_PATH=/path/to/chrome
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let pw;
try {
  pw = await import(process.env.PLAYWRIGHT_MODULE ? pathToFileURL(process.env.PLAYWRIGHT_MODULE).href : 'playwright');
} catch {
  console.error('Playwright が見つかりません。 npm i -D playwright && npx playwright install chromium を実行してください。');
  process.exit(2);
}
const { chromium } = pw.default ?? pw;

const port = 8000 + Math.floor(Math.random() * 900);
const server = spawn(process.execPath, [path.join(root, 'scripts/serve.js'), String(port)], { stdio: 'ignore' });
const url = `http://localhost:${port}/`;
await new Promise((r) => setTimeout(r, 500));

const results = [];
const check = (name, ok, detail = '') => { results.push({ name, ok }); console.log(`${ok ? 'ok  ' : 'NG  '} ${name}${detail ? `  (${detail})` : ''}`); };

const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || undefined, args: ['--no-sandbox'] });
try {
  const page = await browser.newPage({ viewport: { width: 1360, height: 900 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  const ready = () => page.waitForFunction(() => window.__game, null, { timeout: 15000 });
  const idle = (t = 60000) => page.waitForFunction(() => !window.__game.ui.busy, null, { timeout: t });

  await page.goto(url); await ready();
  await page.evaluate(() => localStorage.clear()); await page.reload(); await ready();
  check('画面が開く', true);
  await page.evaluate(() => { window.__game.world.speed = 4; });

  // 仕込み
  const money0 = await page.evaluate(() => window.__game.game.money);
  await page.click('#brewBtn'); await idle();
  const brewed = await page.evaluate(() => window.__game.game.barrels[0]);
  check('仕込める', !!brewed && (await page.evaluate(() => window.__game.game.money)) < money0);

  // 熟成（+3日 ×3）
  for (let i = 0; i < 3; i++) { await page.click('[data-adv="12"]'); await idle(); }
  check('時間が進む', (await page.evaluate(() => window.__game.game.day())) === 10);

  // 味見は同じ時点で1回まで
  await page.click('[data-act="taste"]');
  check('味見できて、同じ時点では2回目ができない', await page.isDisabled('[data-act="taste"]'));

  // 昼にして販売（客が来なければ日を変えて何度か）
  let sold = false;
  for (let i = 0; i < 6 && !sold; i++) {
    await page.evaluate(() => { const g = window.__game.game; do g.advance(1); while (g.timeOfDay() !== 'noon'); });
    await page.evaluate(() => window.__game.renderAll?.());
    await page.click('[data-act="sell"]').catch(() => {});
    await idle();
    sold = (await page.evaluate(() => document.querySelectorAll('#log tr').length)) > 1;
  }
  check('販売して、結果（満足度・支払）が出る', sold);

  // セーブ
  const before = await page.evaluate(() => JSON.stringify(window.__game.game.snapshot()));
  await page.reload(); await ready();
  const after = await page.evaluate(() => JSON.stringify(window.__game.game.snapshot()));
  check('再読み込みしても続きから', before === after);

  // 見た目の切り替え
  for (const season of ['spring', 'summer', 'autumn', 'winter']) {
    for (const weather of ['sunny', 'rain', 'snow']) {
      await page.evaluate(([s, w]) => { const o = window.__game.ui.override; o.manual = true; o.season = s; o.weather = w; o.time = 'evening'; window.__game.world.ambientVisit(s); }, [season, weather]);
      await page.waitForTimeout(120);
    }
  }
  check('季節・天気を切り替えても動く', errors.length === 0);

  // スマホ幅
  await page.setViewportSize({ width: 390, height: 844 }); await page.waitForTimeout(200);
  check('スマホ幅で横にはみ出さない', !(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)));

  check('エラーが出ない', errors.length === 0, errors.slice(0, 3).join(' / '));
} finally {
  await browser.close();
  server.kill();
}
const ng = results.filter((r) => !r.ok).length;
console.log(ng ? `\n${ng}件 NG` : `\nすべて ok（${results.length}件）`);
process.exit(ng ? 1 : 0);
