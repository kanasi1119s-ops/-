import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame } from '../src/game.js';
import { CONFIG } from '../src/config.js';

const toSeason = (g, s) => { while (g.season() !== s) g.advance(4); };

test('旬: 白菜は冬、きゅうりは夏が安く、品質（食感）も高い', () => {
  const g = createGame({ seed: 1 });
  toSeason(g, 'summer');
  const kyuriSummer = g.vegCost('kyuri'), hakusaiSummer = g.vegCost('hakusai');
  assert.ok(g.inSeason('kyuri') && !g.inSeason('hakusai'));
  toSeason(g, 'winter');
  assert.ok(g.vegCost('hakusai') < hakusaiSummer);
  assert.ok(g.vegCost('kyuri') > kyuriSummer);
  g.brew(0, { veg: 'hakusai', pickle: 'hakusaizuke', saltPct: 3, tempC: 20 });
  const winterHakusai = g.tasteOf(0).texture;
  const h = createGame({ seed: 1 }); toSeason(h, 'summer');
  h.brew(0, { veg: 'hakusai', pickle: 'hakusaizuke', saltPct: 3, tempC: 20 });
  assert.ok(winterHakusai > h.tasteOf(0).texture);
});

test('置き場所: 屋外・土間は最初から、冷蔵庫と室は買うと使える。温度は置き場所で決まる', () => {
  const g = createGame({ seed: 2 });
  assert.deepEqual(g.places.sort(), ['doma', 'outdoor']);
  assert.equal(g.placeTemp('doma'), g.ambientTemp() - 2);
  assert.equal(g.brew(0, { veg: 'hakusai', pickle: 'hakusaizuke', saltPct: 3, place: 'fridge' }).ok, false);
  g.money = 10000;
  assert.equal(g.buyPlace('fridge').ok, true);
  assert.equal(g.buyPlace('fridge').ok, false);
  assert.equal(g.brew(0, { veg: 'hakusai', pickle: 'hakusaizuke', saltPct: 3, place: 'fridge' }).ok, true);
  assert.equal(g.barrels[0].tempC, 4);
  assert.equal(g.money, 10000 - CONFIG.places.fridge.cost - g.barrels[0].cost);
});

test('樽を増やす: 3つから5つまで、だんだん高くなる（5つ目は店のレベル2から）', () => {
  const g = createGame({ seed: 3 });
  g.money = 100000;
  g.xp = CONFIG.levels[1].xp;
  const c1 = g.nextBarrelCost();
  assert.equal(g.buyBarrel().ok, true);
  assert.ok(g.nextBarrelCost() > c1);
  assert.equal(g.buyBarrel().ok, true);
  assert.equal(g.barrels.length, 5);
  assert.equal(g.buyBarrel().ok, false);
  assert.equal(g.brew(4, { veg: 'kyuri', pickle: 'asazuke', saltPct: 2.5, tempC: 20 }).ok, true);
});

test('評判: 満足させると上がって客が増え、傷んだ物を出すと下がる', () => {
  const good = createGame({ seed: 4 }), bad = createGame({ seed: 4 });
  good.reputation = 50; bad.reputation = 50;
  for (let i = 0; i < 6; i++) {
    for (const g of [good, bad]) { g.weather = 'sunny'; if (!g.barrels[0]) g.brew(0, g === good ? { veg: 'hakusai', pickle: 'hakusaizuke', saltPct: 3, tempC: 20 } : { veg: 'hakusai', pickle: 'hakusaizuke', saltPct: 1, tempC: 35 }); }
    for (let d = 0; d < 7; d++) { good.advance(4); bad.advance(4); if (good.barrels[0]) good.care(0); }
    good.advance(1); bad.advance(1);
    good.weather = 'sunny'; bad.weather = 'sunny';
    good.sell(0); bad.sell(0);
    good.discard(0); bad.discard(0);
  }
  assert.ok(good.reputation > 55, `good ${good.reputation}`);
  assert.ok(bad.reputation < 45, `bad ${bad.reputation}`);
  // 評判が高いほど来店が多い
  const count = (rep) => { let n = 0; for (let s = 1; s <= 200; s++) { const g = createGame({ seed: s }); g.reputation = rep; g.weather = 'sunny'; g.advance(1); g.weather = 'sunny'; g.brew(0, { veg: 'hakusai', pickle: 'hakusaizuke', saltPct: 3, tempC: 20 }); n += g.sell(0).visitors.length; } return n; };
  assert.ok(count(90) > count(10) * 1.5);
});

test('経営の状態（評判・置き場所・樽の数）もセーブされる', () => {
  const a = createGame({ seed: 5 });
  a.money = 20000; a.buyPlace('muro'); a.buyBarrel(); a.reputation = 77;
  a.brew(3, { veg: 'hakusai', pickle: 'hakusaizuke', saltPct: 3, place: 'muro' });
  const b = createGame({ seed: 6 });
  assert.equal(b.restore(JSON.parse(JSON.stringify(a.snapshot()))), true);
  assert.equal(b.barrels.length, 4);
  assert.equal(b.reputation, 77);
  assert.ok(b.places.includes('muro'));
  assert.equal(b.barrels[3].tempC, 22);
});
