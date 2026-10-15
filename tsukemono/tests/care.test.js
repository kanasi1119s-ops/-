import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame } from '../src/game.js';
import { satisfaction } from '../src/sales.js';
import { CONFIG } from '../src/config.js';

const C = Object.fromEntries(CONFIG.customers.map((c) => [c.id, c]));
const hakusai = { veg: 'hakusai', pickle: 'hakusaizuke', saltPct: 3, tempC: 20 };
const avgSat = (t, pickle) => CONFIG.customers.reduce((s, c) => s + satisfaction(t, pickle, c), 0) / CONFIG.customers.length;

test('白い膜: 20℃で放っておくと数日で見え、手入れすると取れる', () => {
  const g = createGame({ seed: 1 });
  g.brew(0, hakusai);
  g.advance(4 * 3);
  assert.equal(g.tasteOf(0).filmVisible, false);
  g.advance(4 * 2); // 5日目
  assert.equal(g.tasteOf(0).filmVisible, true);
  assert.equal(g.care(0).ok, true);
  assert.equal(g.tasteOf(0).film, 0);
  assert.equal(g.care(0).ok, false); // 同じ時間帯に2回はできない
});

test('白い膜: 4℃では35日ほど出ない（出典: 4℃では35日まで出ず）', () => {
  const g = createGame({ seed: 1 });
  g.brew(0, { ...hakusai, tempC: 4 });
  g.advance(4 * 34);
  assert.equal(g.tasteOf(0).filmVisible, false);
});

test('放置と手入れの差が味に出る（白菜漬け7日、手入れ2回 vs 放置）', () => {
  const kept = createGame({ seed: 1 }), left = createGame({ seed: 1 });
  kept.brew(0, hakusai); left.brew(0, hakusai);
  for (let d = 1; d <= 7; d++) {
    kept.advance(4); left.advance(4);
    if (d === 3 || d === 6) kept.care(0);
  }
  const tk = kept.tasteOf(0), tl = left.tasteOf(0);
  assert.ok(tk.complexity > tl.complexity);
  assert.ok(avgSat(tk, 'hakusaizuke') > avgSat(tl, 'hakusaizuke') + 3, `${avgSat(tk, 'hakusaizuke')} vs ${avgSat(tl, 'hakusaizuke')}`);
});

test('ぬか床: かき混ぜないと酸っぱくなり、毎日かき混ぜると熟成して風味が深くなる', () => {
  const kept = createGame({ seed: 2 }), left = createGame({ seed: 2 });
  for (let d = 1; d <= 14; d++) { kept.stirNuka(); kept.advance(4); left.advance(4); }
  assert.ok(left.nuka.sour > kept.nuka.sour + 0.5, `${left.nuka.sour} vs ${kept.nuka.sour}`);
  assert.ok(kept.nuka.maturity > 0.9 && left.nuka.maturity === 0);
  const k = { veg: 'kyuri', pickle: 'nukazuke', tempC: 20 };
  kept.brew(0, k); left.brew(0, k);
  kept.advance(4); left.advance(4);
  const tk = kept.tasteOf(0), tl = left.tasteOf(0);
  assert.ok(tl.acid > tk.acid + 20, '放置した床は酸っぱい');
  assert.ok(tk.complexity > tl.complexity * 1.5, '育てた床は風味が深い');
  assert.ok(avgSat(tk, 'nukazuke') > avgSat(tl, 'nukazuke'));
});

test('ぬか床: 26℃以上だと早く酸っぱくなる。塩を足すと酸味が和らぐ', () => {
  const warm = createGame({ seed: 3 }), cool = createGame({ seed: 3 });
  // 夏（28℃）と春（15℃）で3日放置
  warm.advance(4 * CONFIG.calendar.daysPerSeason); // 夏へ
  warm.nuka.sour = 0; // 夏の初めにまっさらな床
  const w0 = warm.nuka.sour;
  warm.advance(12); cool.advance(12);
  assert.ok(warm.nuka.sour - w0 > cool.nuka.sour * 2);
  const before = warm.nuka.sour, salt = warm.nuka.salt, money = warm.money;
  assert.equal(warm.saltNuka().ok, true);
  assert.ok(warm.nuka.sour < before && warm.nuka.salt > salt && warm.money < money);
});

test('ぬか漬け: 塩分はぬか床のものを使い、漬けるたびに床の塩分が少し減る。しょっぱすぎない', () => {
  const g = createGame({ seed: 4 });
  const s0 = g.nuka.salt;
  g.brew(0, { veg: 'kyuri', pickle: 'nukazuke', saltPct: 99, tempC: 20 });
  assert.equal(g.barrels[0].saltPct, s0);
  assert.ok(g.nuka.salt < s0);
  g.advance(4);
  const t = g.tasteOf(0);
  assert.ok(t.saltiness > 25 && t.saltiness < 65, `塩味 ${t.saltiness}`);
  assert.notEqual(t.stage, 'raw');
});

test('手入れの状態もセーブされる', () => {
  const a = createGame({ seed: 5 });
  a.brew(0, hakusai); a.stirNuka(); a.advance(10);
  const b = createGame({ seed: 6 });
  assert.equal(b.restore(JSON.parse(JSON.stringify(a.snapshot()))), true);
  assert.deepEqual(b.nuka, a.nuka);
  assert.equal(b.barrels[0].film, a.barrels[0].film);
});

test('ぬか漬けの樽は樽の手入れではなく、ぬか床をかき混ぜる', () => {
  const g = createGame({ seed: 7 });
  g.brew(0, { veg: 'kyuri', pickle: 'nukazuke', tempC: 20 });
  g.advance(4 * 5);
  assert.equal(g.care(0).ok, false);
  assert.ok(g.tasteOf(0).filmVisible);
  g.stirNuka();
  assert.equal(g.tasteOf(0).film, 0);
});
