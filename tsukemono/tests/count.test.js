import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame } from '../src/game.js';
import { CONFIG } from '../src/config.js';

const r = { veg: 'kyuri', pickle: 'asazuke', saltPct: 2.5, tempC: 20 };

test('仕込みの個数: 選ばなければ標準の個数、選べばその個数ぶん売れる', () => {
  const g = createGame();
  assert.ok(g.brew(0, r).ok);
  assert.equal(g.barrels[0].portions, CONFIG.sales.portionsPerBatch);
  assert.ok(g.brew(1, { ...r, count: 12 }).ok);
  assert.equal(g.barrels[1].portions, 12);
  assert.ok(g.brew(2, { veg: 'daikon', pickle: 'takuan', saltPct: 5, tempC: 20 }).ok);
  assert.equal(g.barrels[2].portions, CONFIG.pickles.takuan.portions); // たくあんの標準は18個
});

test('仕込みの個数: 費用は標準の個数に対する比で増え、調味は樽ごとに1回', () => {
  const g = createGame();
  const std = g.brewCost(r), twice = g.brewCost({ ...r, count: 12 });
  assert.ok(twice > std * 1.9 && twice <= std * 2 + 10);
  assert.equal(g.brewCost({ ...r, count: 6 }), std);
  const withAdd = g.brewCost({ ...r, count: 12, additives: ['kombu'] });
  assert.equal(withAdd, twice + CONFIG.additives.kombu.cost);
  const m0 = g.money;
  const b = g.brew(0, { ...r, count: 12 });
  assert.equal(b.cost, twice);
  assert.equal(g.money, m0 - twice);
});

test('仕込みの個数: 1個未満・樽の上限を超える・お金が足りないときは断る', () => {
  const g = createGame();
  assert.equal(g.brew(0, { ...r, count: 0 }).ok, false);
  assert.equal(g.brew(0, { ...r, count: CONFIG.sales.barrelCapacity + 1 }).ok, false);
  assert.equal(g.brew(0, { ...r, count: 2.5 }).ok, false);
  g.money = 1e6; // 上限いっぱいはお金がたくさん要る
  assert.ok(g.brew(0, { ...r, count: CONFIG.sales.barrelCapacity }).ok);
  g.money = 100;
  assert.equal(g.brew(1, { ...r, count: 24 }).ok, false); // お金が足りない
});
