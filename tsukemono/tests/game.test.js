import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame, createRng } from '../src/game.js';
import { CONFIG } from '../src/config.js';

const recipe = { veg: 'hakusai', pickle: 'hakusaizuke', saltPct: 3, tempC: 20 };

test('仕込み→熟成→販売が1周でき、満足度・利益が出る', () => {
  const g = createGame({ seed: 7 });
  const m0 = g.money;
  const b = g.brew(0, recipe);
  assert.ok(b.ok);
  assert.equal(g.money, m0 - b.cost);
  g.advance(7 * 4); // 7日
  assert.equal(g.tasteOf(0).stage, 'ripe');
  assert.equal(g.timeOfDay(), 'morning');
  const r = g.sell(0);
  assert.ok(r.ok);
  assert.ok(r.visitors.length >= 1);
  for (const v of r.visitors) assert.ok(v.sat >= 0 && v.sat <= 100);
  assert.equal(g.money, m0 - b.cost + r.revenue);
  assert.equal(g.stats.revenue - g.stats.cost, g.money - m0);
});

test('1つの樽に1つしか仕込めない・材料の組み合わせ・資金チェック', () => {
  const g = createGame();
  assert.ok(g.brew(0, recipe).ok);
  assert.equal(g.brew(0, recipe).ok, false);
  assert.equal(g.brew(1, { ...recipe, veg: 'kyuri' }).ok, false); // 白菜漬けにきゅうりは使えない
  assert.ok(g.brew(1, { ...recipe, veg: 'kyuri', pickle: 'asazuke' }).ok);
  g.money = 0;
  assert.equal(g.brew(2, recipe).ok, false);
});

test('夜は閉店、日付・時間帯・季節が進む', () => {
  const g = createGame();
  g.brew(0, recipe);
  assert.equal(g.day(), 1);
  g.advance(3);
  assert.equal(g.timeOfDay(), 'night');
  assert.equal(g.sell(0).ok, false);
  g.advance(1);
  assert.equal(g.day(), 2);
  assert.equal(g.season(), 'spring');
  g.advance(CONFIG.calendar.daysPerSeason * 4);
  assert.equal(g.season(), 'summer');
  assert.equal(g.ambientTemp(), 28);
});

test('季節ごとの外気温の初期値（春15 夏28 秋15 冬5）', () => {
  const g = createGame();
  const seen = {};
  for (let i = 0; i < 4; i++) { seen[g.season()] = g.ambientTemp(); g.advance(CONFIG.calendar.daysPerSeason * 4); }
  assert.deepEqual(seen, { spring: 15, summer: 28, autumn: 15, winter: 5 });
});

test('雨・雪の日は客が減る', () => {
  const count = (weather) => {
    let n = 0;
    for (let seed = 1; seed <= 300; seed++) {
      const g = createGame({ seed });
      g.weather = weather;
      g.advance(1); // 昼
      g.weather = weather;
      g.brew(0, recipe);
      n += g.sell(0).visitors.length;
    }
    return n;
  };
  const sunny = count('sunny'), rain = count('rain'), snow = count('snow');
  assert.ok(rain < sunny * 0.65, `rain ${rain} sunny ${sunny}`);
  assert.ok(snow < sunny * 0.55, `snow ${snow} sunny ${sunny}`);
});

test('傷んだ樽は全員が買わず、樽は空になる', () => {
  const g = createGame({ rng: () => 0.0001 });
  g.weather = 'sunny';
  g.brew(0, { ...recipe, saltPct: 1, tempC: 35 });
  g.advance(4 * 5);
  const r = g.sell(0);
  assert.equal(r.spoiled, true);
  assert.equal(r.revenue, 0);
  assert.equal(g.barrels[0], null);
});

test('売り切れると買えない。同じseedなら同じ結果', () => {
  const run = (seed) => { const g = createGame({ seed }); g.brew(0, recipe); g.advance(28); return g.sell(0).visitors.map((v) => [v.customer.id, v.price]); };
  assert.deepEqual(run(3), run(3));
  const g = createGame({ rng: createRng(5) });
  g.brew(0, recipe);
  g.barrels[0].portions = 1;
  g.advance(28);
  g.weather = 'sunny';
  const r = g.sell(0);
  assert.ok(r.visitors.filter((v) => v.bought).length <= 1);
});

test('樽の収支: 空になったとき利益(売上-仕入れ)が確定する', () => {
  const g = createGame({ seed: 11 });
  g.brew(0, recipe);
  g.advance(28);
  let last;
  for (let i = 0; i < 8 && g.barrels[0]; i++) { g.weather = 'sunny'; last = g.sell(0); }
  assert.ok(last.batch.closed);
  assert.equal(last.batch.profit, last.batch.earned - last.batch.cost);
});

test('味見は同じ樽の同じ時点では1回まで。時間が進めばまたできる', () => {
  const g = createGame({ seed: 2 });
  assert.equal(g.tasteTest(0).ok, false); // 空の樽
  g.brew(0, recipe);
  const a = g.tasteTest(0);
  assert.equal(a.already, false);
  const b = g.tasteTest(0);
  assert.equal(b.already, true);
  assert.equal(b.taste, a.taste);
  g.advance(1);
  const c = g.tasteTest(0);
  assert.equal(c.already, false);
  assert.ok(c.taste.acid > a.taste.acid);
  g.brew(1, recipe);
  assert.equal(g.tasteTest(1).already, false); // 別の樽は別
});
