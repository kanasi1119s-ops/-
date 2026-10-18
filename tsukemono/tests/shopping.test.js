import test from 'node:test';
import assert from 'node:assert/strict';
import { CONFIG } from '../src/config.js';
import { createGame } from '../src/game.js';
import { applySpecials, simulate } from '../src/model.js';
import { SPECIALS } from '../data/specials.js';
import { UPGRADES } from '../data/upgrades.js';

const DAY = CONFIG.calendar.ticksPerDay;
const lv = (n) => CONFIG.levels.find((l) => l.level === n).xp;
const rich = (n = 7, seed = 1) => { const g = createGame({ seed }); g.money = 1e7; g.addXp(lv(n)); return g; };
const recipe = { veg: 'hakusai', pickle: 'hakusaizuke', saltPct: 3, tempC: 20 };

test('特別な食材: 仕込みで買い足すと、そのぶん費用がかかる（個数に比例）', () => {
  const g = rich();
  const base = g.brewCost(recipe);
  const withRausu = g.brewCost({ ...recipe, specials: ['rausu'] });
  assert.equal(withRausu - base, CONFIG.specials.rausu.cost);
  const twice = g.brewCost({ ...recipe, count: 12, specials: ['rausu'] }) - g.brewCost({ ...recipe, count: 12 });
  assert.equal(twice, CONFIG.specials.rausu.cost * 2);
  const m = g.money;
  const r = g.brew(0, { ...recipe, specials: ['rausu', 'moshio'] });
  assert.ok(r.ok, r.error);
  assert.equal(m - g.money, g.barrels[0].cost);
  assert.deepEqual(g.barrels[0].specials, ['rausu', 'moshio']);
});

test('特別な食材: 2つまで、同じ種類は1つまで、レベルと漬物の決まりがある', () => {
  const g = createGame({ seed: 2 });
  g.money = 1e6;
  assert.match(g.brew(0, { ...recipe, specials: ['rausu'] }).error, /レベル2/);
  g.addXp(lv(7));
  assert.match(g.brew(0, { ...recipe, specials: ['moshio', 'tenpien'] }).error, /同じ種類/);
  assert.match(g.brew(0, { ...recipe, specials: ['moshio', 'rausu', 'jizake'] }).error, /2つまで/);
  assert.match(g.brew(0, { ...recipe, specials: ['nankobai'] }).error, /梅干し/);
  assert.equal(g.brew(0, { ...recipe, specials: ['moshio', 'rausu'] }).ok, true);
});

test('特別な食材の効き目: 風味が深くなり、良い材料には高く払う。金箔は味が変わらず値段だけ', () => {
  const t = simulate({ ...recipe, days: 7 });
  const r = applySpecials(t, ['rausu'], CONFIG);
  assert.ok(r.complexity > t.complexity);
  assert.ok(r.priceMult > 1);
  const k = applySpecials(t, ['kinpaku'], CONFIG);
  assert.equal(k.complexity, t.complexity);
  assert.equal(k.texture, t.texture);
  assert.equal(k.priceMult, 1.5);
  // 売ってみると、同じ満足でも高く売れる
  const sellWith = (specials) => { let rev = 0; for (let seed = 1; seed <= 30; seed++) { const g = rich(7, seed); g.brew(0, { ...recipe, count: 60, specials }); g.advance(25); g.weather = 'sunny'; rev += g.sell(0).revenue; } return rev; };
  assert.ok(sellWith(['kinpaku']) > sellWith([]) * 1.3);
});

test('店の格上げ: 順番に買い、お客と売り値が増える。二度は買えない', () => {
  const g = rich();
  assert.match(g.buyUpgrade('kanban').error, /暖簾/);
  assert.equal(g.buyUpgrade('noren').ok, true);
  assert.equal(g.buyUpgrade('noren').ok, false);
  const v0 = g.upgradeMult('visitors');
  assert.equal(g.buyUpgrade('kanban').ok, true);
  assert.ok(g.upgradeMult('visitors') > v0 && g.upgradeMult('price') > 1);
  const low = createGame(); low.money = 1e7;
  assert.match(low.buyUpgrade('noren').error, /レベル2/);
  // 全部買うと、かなりのお金がかかる（お金の使い道）
  const total = UPGRADES.filter((u) => u.group === 'shop').reduce((a, u) => a + u.cost, 0);
  assert.ok(total >= 400000, `${total}円`);
});

test('漬物蔵: 寝かせた値打ちが上乗せされる。試食コーナー: 満足が上がり、難癖のお客に説明が通りやすい', () => {
  const g = rich();
  for (const id of ['noren', 'kanban', 'misesaki', 'kura', 'shishoku']) assert.equal(g.buyUpgrade(id).ok, true, id);
  assert.equal(g.upgradeMult('aging'), 1.3);
  assert.equal(g.upgradeAdd('sat'), 3);
  assert.ok(g.upgradeAdd('explain') > 0);
});

test('杉の木桶: その樽だけ、風味が深く膜が張りにくい。中身を入れかえても残る', () => {
  const g = rich();
  g.brew(0, { ...recipe, tempC: 25 }); g.brew(1, { ...recipe, tempC: 25 });
  assert.equal(g.buyUpgrade('sugioke', 0).ok, true);
  assert.equal(g.buyUpgrade('sugioke', 0).ok, false);
  g.advance(DAY * 6);
  assert.ok(g.tasteOf(0).complexity > g.tasteOf(1).complexity);
  assert.ok(g.barrels[0].film < g.barrels[1].film);
  g.discard(0); g.brew(0, recipe);
  assert.equal(g.barrelUpgrade(0).name, '杉の木桶に替える');
});

test('宣伝: チラシは3日だけお客が増え、効いているあいだは重ねて買えない', () => {
  const g = rich();
  assert.equal(g.buyUpgrade('chirashi').ok, true);
  assert.equal(g.upgradeMult('visitors'), 1.3);
  assert.match(g.buyUpgrade('chirashi').error, /まだ効いて/);
  g.advance(DAY * 3);
  assert.equal(g.upgradeMult('visitors'), 1);
  assert.equal(g.buyUpgrade('chirashi').ok, true); // また買える（何度でもお金の使い道）
});

test('データで足せる・セーブに残る', () => {
  assert.ok(SPECIALS.every((s) => s.cost > 0 && s.kind && s.effects));
  const g = rich();
  g.buyUpgrade('noren'); g.buyUpgrade('sugioke', 1); g.buyUpgrade('chirashi');
  g.brew(0, { ...recipe, specials: ['honkare'] });
  const h = createGame();
  assert.equal(h.restore(g.snapshot()), true);
  assert.deepEqual(h.upgrades, ['noren']);
  assert.equal(h.barrelUpgrade(1).name, '杉の木桶に替える');
  assert.equal(h.upgradeMult('visitors'), g.upgradeMult('visitors'));
  assert.deepEqual(h.barrels[0].specials, ['honkare']);
});
