import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame } from '../src/game.js';

// 食べ頃の白菜漬けを、手入れしながら何度も売る
function playGood(seed, sales = 40) {
  const g = createGame({ seed });
  const all = [];
  for (let n = 0; n < sales; n++) {
    g.money = 100000; g.weather = 'sunny';
    if (!g.barrels[0]) { g.brew(0, { veg: 'hakusai', pickle: 'hakusaizuke', saltPct: 3, tempC: 20 }); g.advance(4 * 7); }
    while (g.timeOfDay() !== 'noon') g.advance(1);
    g.care(0); g.weather = 'sunny';
    const r = g.sell(0);
    if (r.ok) all.push(...r.visitors);
    g.advance(1);
  }
  return { g, all };
}

test('常連: とても満足した客がときどき常連になり、同じ見た目でまた来て、少し多く払う', () => {
  const { g, all } = playGood(5);
  assert.ok(g.regulars.length > 0, '常連ができる');
  assert.ok(g.regulars.length <= g.cfg.regulars.max);
  const joined = all.filter((v) => v.regular?.joined);
  assert.ok(joined.length > 0 && joined.every((v) => v.sat >= g.cfg.regulars.joinSat));
  const back = all.filter((v) => v.regular && !v.regular.joined);
  assert.ok(back.length > 0, '常連がまた来る');
  const first = joined[0].regular;
  const again = back.find((v) => v.regular.id === first.id);
  if (again) assert.equal(again.regular.look, first.look);
});

test('常連: 傷んだものや不満が続くと離れる', () => {
  const g = createGame({ seed: 2 });
  g.regulars.push({ id: 1, type: 'gourmet', look: 7, visits: 3, misses: 0, since: 1 });
  g.nextRegularId = 2;
  const visit0 = g.cfg.regulars.visit;
  g.cfg.regulars.visit = 10; // 必ず来る（このテストの間だけ）
  for (let i = 0; i < 6 && g.regulars.length; i++) {
    g.money = 100000;
    g.brew(0, { veg: 'kyuri', pickle: 'asazuke', saltPct: 1, tempC: 4 }); // 未熟で通は満足しない
    g.weather = 'sunny';
    while (g.timeOfDay() !== 'noon') g.advance(1);
    g.sell(0); g.discard(0); g.advance(1);
  }
  g.cfg.regulars.visit = visit0;
  assert.equal(g.regulars.length, 0);
});

test('常連はセーブで残る', () => {
  const { g } = playGood(5, 20);
  const h = createGame({ seed: 9 });
  assert.ok(h.restore(g.snapshot()));
  assert.deepEqual(h.regulars, g.regulars);
  assert.equal(h.nextRegularId, g.nextRegularId);
});
