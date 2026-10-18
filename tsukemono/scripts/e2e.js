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
  check('タイトルが出る', await page.isVisible('#title'));
  await page.click('[data-title="new"]');
  check('はじめると店先になる', !(await page.isVisible('#title')));
  check('序章（物語）の窓が出て、「次へ」で読み進められる', (await page.textContent('#winTitle')).includes('序章'));
  for (let i = 0; i < 20 && (await page.$('[data-act="sagaNext"]')); i++) await page.click('[data-act="sagaNext"]');
  await page.click('[data-act="closeWin"]');
  await page.evaluate(() => { window.__game.world.speed = 8; window.__game.ui.paused = true; }); // 確認のあいだ時間は止めておく
  const G = (f) => page.evaluate(f);
  // 物語・ひらめき・レベルなどの知らせの窓を閉じる（遊んでいると自然に出てくる）
  const closeNotices = () => G(() => { const w = window.__game; let n = 0; while (w.ui.win && ['idea', 'levelup', 'saga', 'story', 'reformed', 'claim', 'dayend', 'granny', 'wisdom'].includes(w.ui.win.kind) && n++ < 20) w.closeWin(); });

  // 仕込み（コマンド → 窓 → 仕込む）
  const money0 = await G(() => window.__game.game.money);
  await closeNotices(); await page.click('[data-cmd=\"brew\"]');
  check('仕込みの窓が開く', await page.isVisible('#modal'));
  await page.click('[data-veg="kyuri"]');
  await page.click('[data-countset="12"]');
  await page.click('[data-act="brew"]'); await idle();
  const brewed = await G(() => window.__game.game.barrels[0]);
  check('仕込める', !!brewed && (await G(() => window.__game.game.money)) < money0 && !(await page.isVisible('#modal')));
  check('個数を選んで仕込める', brewed?.portions === 12);

  // 次へ（4回で翌朝。夜明けに一日のまとめ）
  for (let i = 0; i < 4; i++) { await closeNotices(); await page.click('[data-cmd=\"next\"]'); await idle(); }
  check('一日のまとめが出る', (await page.textContent('#winTitle')).includes('店じまい'));
  await page.click('[data-act="dayClose"]');
  check('翌朝になる', (await G(() => [window.__game.game.day(), window.__game.game.timeOfDay()].join())) === '2,morning');

  // 時間制: 止めるのをやめると、時間帯が自動で進む
  await G(() => { const g = window.__game; g.game.cfg.calendar.realSeconds.morning = 1; g.ui.paused = false; });
  await page.waitForFunction(() => window.__game.game.timeOfDay() === 'noon', null, { timeout: 8000 }).catch(() => {});
  check('時間が自動で進む', (await G(() => window.__game.game.timeOfDay())) === 'noon');
  await G(() => { const g = window.__game; g.ui.paused = true; g.game.cfg.calendar.realSeconds.morning = 90; });

  // 樽の札 → 味見は同じ時点で1回まで
  await page.click('[data-chip="0"]');
  await page.click('[data-act="taste"]');
  check('味見できて、同じ時点では2回目ができない', await page.isDisabled('[data-act="taste"]'));
  await page.click('#winClose'); await closeNotices();

  // 売る（客が来なければ時間を変えて何度か）
  let sold = false;
  for (let i = 0; i < 8 && !sold; i++) {
    await G(() => { const g = window.__game.game; g.weather = 'sunny'; if (!g.barrels[0]) g.brew(0, { veg: 'kyuri', pickle: 'asazuke', saltPct: 2.5, tempC: 20 }); while (g.timeOfDay() !== 'noon' || g.lastSaleTick === g.tick) g.advance(1); window.__game.renderAll(); });
    await closeNotices(); await page.click('[data-cmd=\"sell\"]');
    await page.click('#winBody [data-act="sellSlot"]'); await idle();
    sold = (await G(() => window.__game.ui.log.length)) > 0;
  }
  check('店先に出すと売れる', sold);
  check('出した樽は次の時間帯も店先に出たまま', (await G(() => window.__game.ui.display)) === 0 || (await G(() => window.__game.game.barrels[0] === null)));
  await closeNotices(); await page.click('[data-cmd=\"book\"]');
  check('帳面に記録が出る', (await page.textContent('#winBody')).includes('満足'));
  await page.click('[data-tab="book"]');
  check('図鑑に載る', (await page.textContent('#winBody')).includes('きゅうりの浅漬け'));
  await page.click('#winClose'); await closeNotices();

  // 投資: 樽を増やす・冷蔵庫を買う
  await G(() => { window.__game.game.money = 20000; window.__game.renderAll(); });
  await closeNotices(); await page.click('[data-cmd=\"shop\"]');
  await page.click('[data-buy="barrel"]');
  await page.click('[data-buy="fridge"]');
  const inv = await G(() => ({ n: window.__game.game.barrels.length, places: window.__game.game.places }));
  check('樽を増やし、冷蔵庫を買える', inv.n === 4 && inv.places.includes('fridge'), JSON.stringify(inv));
  await page.click('#winClose'); await closeNotices();
  await page.click('[data-chip="3"]');
  await page.click('[data-act="openBrew"]');
  await page.click('[data-place="fridge"]');
  await page.click('[data-act="brew"]'); await idle();
  const b4 = await G(() => window.__game.game.barrels[3]);
  check('4個目の樽に冷蔵庫で仕込める', !!b4 && b4.tempC === 4 && b4.place === 'fridge');
  check('樽が4個でも描画が落ちない', errors.length === 0, errors.join(' / '));

  // ぬか床
  await closeNotices(); await page.click('[data-cmd=\"nuka\"]');
  await page.click('[data-act="stir"]');
  check('ぬか床をかき混ぜられる', (await G(() => window.__game.game.nuka.lastStirDay)) === (await G(() => window.__game.game.day())));

  // 常連
  await G(() => { const g = window.__game.game; g.regulars.push({ id: 99, type: 'light', look: 12345, visits: 2, misses: 0, since: 1, name: '山田さん', age: 'old', bond: 0, chapters: [] }); g.nextRegularId = 100; g.cfg.regulars.visit = 10; g.weather = 'sunny'; g.money = 20000; if (g.barrels[1]) g.discard(1); g.brew(1, { veg: 'kyuri', pickle: 'asazuke', saltPct: 2.5, tempC: 20 }); g.advance(4); while (g.timeOfDay() !== 'noon') g.advance(1); window.__game.renderAll(); });
  await G(() => window.__game.doSell(1)); await idle();
  await G(() => { window.__game.game.cfg.regulars.visit = 0.45; });
  check('常連が来て記録に出る', JSON.stringify(await G(() => window.__game.ui.log[0])).includes('常連'));

  // 休む・設定
  const d0 = await G(() => window.__game.game.day());
  await closeNotices(); await page.click('[data-cmd=\"rest\"]'); await page.click('[data-rest="3"]'); await idle();
  check('休むと日が進む', (await G(() => window.__game.game.day())) === d0 + 3);
  await closeNotices();

  // 段階C: レシピ帳・ひらめき・レベル
  await closeNotices(); await page.click('[data-cmd=\"book\"]'); await page.click('[data-tab="recipes"]');
  check('レシピ帳に「？？？」と噂が出る', (await page.textContent('#winBody')).includes('？？？') && (await page.textContent('#winBody')).includes('噂'));
  await page.click('#winClose'); await closeNotices();
  await G(() => { const g = window.__game.game; g.money = 50000; g.barrels = g.barrels.map(() => null); g.brew(0, { veg: 'nasu', pickle: 'asazuke', saltPct: 2.5, tempC: 15, additives: ['karashi'] }); window.__game.renderAll(); });
  await G(() => window.__game.advance(4, { summary: false })); await idle();
  await page.waitForSelector('.idea', { timeout: 5000 }).catch(() => {});
  const ideaText = await page.textContent('#winBody').catch(() => '');
  check('条件がそろうと、ひらめきの窓が出る', ideaText.includes('からし漬け'), ideaText.slice(0, 60));
  await closeNotices();
  await G(() => { window.__game.game.addXp(400); window.__game.renderAll(); });
  await G(() => window.__game.advance(1, { summary: false })); await idle();
  check('レベルが上がると知らせが出て、帳場にレベルが出る', (await page.textContent('#hud')).includes('Lv.4'));
  await closeNotices();
  // 難癖のお客
  await G(() => { const w = window.__game, g = w.game; g.cfg.claimer.chance = 1; g.weather = 'sunny'; g.barrels = g.barrels.map(() => null); g.brew(0, { veg: 'kyuri', pickle: 'asazuke', saltPct: 2.5, tempC: 20, count: 30 }); g.advance(4); while (g.timeOfDay() !== 'noon') g.advance(1); w.renderAll(); });
  await G(() => window.__game.doSell(0));
  await page.waitForSelector('[data-claim]', { timeout: 60000 }).catch(() => {});
  check('難癖のお客が来て、対応の窓が出る', !!(await page.$('[data-claim="apologize"]')));
  await page.click('[data-claim="apologize"]').catch(() => {});
  check('対応を選ぶと結果が出る', (await G(() => window.__game.game.claim)) === null && (await page.textContent('#winBody')).includes('評判'));
  await G(() => { window.__game.game.cfg.claimer.chance = 0.1; });
  await page.click('#winClose'); await closeNotices(); await idle(); await closeNotices();
  // 段階E: 干す日数を選んでたくあんを仕込む
  await G(() => { const g = window.__game.game; g.money = 50000; g.barrels = g.barrels.map(() => null); window.__game.ui.slot = 0; window.__game.renderAll(); });
  await closeNotices(); await page.click('[data-cmd="brew"]');
  await page.click('[data-pickle="takuan"]');
  await page.click('[data-dryset="10"]');
  await page.click('[data-act="brew"]'); await idle(); await closeNotices();
  check('干す日数を選んでたくあんを仕込める', (await G(() => window.__game.game.barrels.find((b) => b?.pickle === 'takuan')?.dry)) === 10);

  // 買えるもの: 特別な食材を足して仕込む・店の格上げ
  await G(() => { const g = window.__game.game; g.money = 200000; g.addXp(200); g.barrels = g.barrels.map(() => null); window.__game.ui.slot = 0; window.__game.renderAll(); });
  await closeNotices(); await page.click('[data-cmd="brew"]');
  await page.click('[data-pickle="hakusaizuke"]');
  await page.click('[data-special="moshio"]');
  await page.click('[data-act="brew"]'); await idle(); await closeNotices();
  check('特別な食材を足して仕込める', JSON.stringify(await G(() => window.__game.game.barrels[0]?.specials)) === '["moshio"]');
  await closeNotices(); await page.click('[data-cmd="shop"]');
  await page.click('[data-upgrade="noren"]');
  check('店の格上げを買える', await G(() => window.__game.game.upgrades.includes('noren')));
  await page.click('#winClose'); await closeNotices();

  // 段階D: 仕入れ・店の経営
  await G(() => { window.__game.game.money = 50000; window.__game.renderAll(); });
  await closeNotices(); await page.click('[data-cmd=\"market\"]');
  await page.click('[data-stock="kyuri:12"]');
  check('仕入れの窓で野菜を買って在庫にできる', (await G(() => window.__game.game.stockCount('kyuri'))) === 12);
  await page.click('#winClose'); await closeNotices();
  await closeNotices(); await page.click('[data-cmd=\"shop\"]');
  await page.click('[data-hire="baito"]');
  check('店の窓で従業員を雇える', (await G(() => window.__game.game.staff.includes('baito'))));
  await page.click('#winClose'); await closeNotices();
  await closeNotices(); await page.click('[data-cmd=\"brew\"]');
  check('ひらめいた作り方を仕込みの窓で選べる', (await page.textContent('#winBody')).includes('からし漬け'));
  await page.click('#winClose'); await closeNotices();
  await closeNotices(); await page.click('[data-cmd=\"settings\"]');
  await page.fill('#vBgm', '0.3');
  check('設定で音量を変えられる', (await G(() => window.__game.settings.bgm)) === 0.3);
  await page.click('#winClose'); await closeNotices();

  // セーブ
  const before = await G(() => JSON.stringify(window.__game.game.snapshot()));
  await page.reload(); await ready();
  const after = await G(() => JSON.stringify(window.__game.game.snapshot()));
  check('再読み込みしても続きから', before === after);
  await page.click('[data-title="continue"]');

  // 段階H: ファイルに書き出して、読みこむ。壊れたセーブは安全に扱う
  await closeNotices(); await page.click('[data-cmd="settings"]');
  await page.click('[data-act="exportSave"]');
  const exported = await G(() => window.__lastExport);
  check('セーブをファイルに書き出せる（版番号つき）', !!exported && JSON.parse(exported).v === 2);
  check('ファイルが使えない所でも、セーブの文字をコピーできる', (await page.inputValue('#winBody textarea')) === exported);
  await page.click('#winClose');
  const edited = JSON.parse(exported); edited.game.money = 123456;
  await Promise.all([page.waitForEvent('load'), page.evaluate((t) => window.__game.importSaveText(t), JSON.stringify(edited)).catch(() => {})]);
  await ready();
  check('ファイルから読みこむと、その続きから遊べる', (await G(() => window.__game.game.money)) === 123456);
  await page.evaluate(() => localStorage.setItem('tsukemono.save.v1', '{"game": {"v": 2, "tick": "こわれた"')); await page.reload(); await ready();
  check('壊れたセーブは別に残して、最初から始められる', (await G(() => window.__game.game.tick)) === 0 && (await page.evaluate(() => !!localStorage.getItem('tsukemono.save.broken'))));

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
