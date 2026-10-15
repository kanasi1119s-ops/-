import test from 'node:test';
import assert from 'node:assert/strict';
import { simulate, fermentRate, daysToRipe, ripeRangeDays, interpolate, complexityTempFactor } from '../src/model.js';

const H = (o) => ({ veg: 'hakusai', pickle: 'hakusaizuke', saltPct: 3, tempC: 20, days: 7, ...o });

test('補間: 表の節点では表の値、間は線形', () => {
  assert.equal(interpolate([[4, 0.1], [10, 0.4]], 4), 0.1);
  assert.ok(Math.abs(interpolate([[4, 0.1], [10, 0.4]], 7) - 0.25) < 1e-9);
  assert.equal(interpolate([[4, 0.1], [10, 0.4]], -5), 0.1);
  assert.equal(interpolate([[4, 0.1], [10, 0.4]], 99), 0.4);
});

test('温度・塩分の係数が企画書の初期値どおり', () => {
  const r = (saltPct, tempC) => fermentRate({ veg: 'hakusai', saltPct, tempC });
  assert.equal(r(3, 20), 1);
  assert.ok(Math.abs(r(3, 4) - 0.1) < 1e-9);
  assert.ok(Math.abs(r(3, 25) - 1.4) < 1e-9);
  assert.ok(Math.abs(r(3, 40) - 3) < 1e-9);
  assert.ok(Math.abs(r(2, 20) - 1.3) < 1e-9);
  assert.ok(Math.abs(r(10, 20) - 0.25) < 1e-9);
  assert.ok(Math.abs(r(20, 20) - 0.05) < 1e-9);
});

test('白菜を塩3%・20℃で漬けると約1週間で食べ頃', () => {
  assert.equal(daysToRipe(H()), 7);
  assert.equal(simulate(H({ days: 7 })).stage, 'ripe');
  assert.equal(simulate(H({ days: 6 })).stage, 'ripe');
  assert.equal(simulate(H({ days: 8 })).stage, 'ripe');
  assert.equal(simulate(H({ days: 3 })).stage, 'raw');
  assert.equal(simulate(H({ days: 5 })).stage, 'raw');
  assert.equal(simulate(H({ days: 11 })).stage, 'over');
  assert.equal(simulate(H({ days: 14 })).stage, 'sour');
});

test('高温・低塩分だと速く、低温・高塩分だと遅い', () => {
  const base = daysToRipe(H());
  assert.ok(daysToRipe(H({ tempC: 28 })) < base);
  assert.ok(daysToRipe(H({ saltPct: 2 })) < base);
  assert.ok(daysToRipe(H({ tempC: 28, saltPct: 2 })) < daysToRipe(H({ tempC: 28 })));
  assert.ok(daysToRipe(H({ tempC: 5 })) > base);
  assert.ok(daysToRipe(H({ saltPct: 10 })) > base);
  assert.ok(daysToRipe(H({ tempC: 5, saltPct: 10 })) > daysToRipe(H({ tempC: 5 })));
});

test('日数が進むと酸味が増え、食感は下がる', () => {
  let prev = simulate(H({ days: 0 }));
  for (const d of [1, 3, 7, 14, 28]) {
    const cur = simulate(H({ days: d }));
    assert.ok(cur.acid > prev.acid, `acid ${d}`);
    assert.ok(cur.texture < prev.texture, `texture ${d}`);
    prev = cur;
  }
  assert.ok(simulate(H({ days: 7 })).acid > 40 && simulate(H({ days: 7 })).acid < 60);
});

test('塩分を上げると塩味が増える（日数で塩が回る）', () => {
  assert.ok(simulate(H({ saltPct: 5 })).saltiness > simulate(H({ saltPct: 3 })).saltiness);
  assert.ok(simulate(H({ saltPct: 10 })).saltiness > 100); // しょっぱすぎ
  assert.ok(simulate(H({ days: 0.1 })).saltiness < simulate(H({ days: 3 })).saltiness);
});

test('傷みのリスク: 低塩分・高温・放置で上がる。塩分を上げると日持ちが良い', () => {
  const risk = (o) => simulate(H(o)).spoilRisk;
  assert.ok(risk({}) < 10, '標準条件は安全');
  assert.ok(risk({ saltPct: 1 }) > risk({ saltPct: 3 }));
  assert.ok(risk({ saltPct: 2, tempC: 28 }) > 40);
  assert.ok(risk({ tempC: 30 }) > risk({ tempC: 20 }));
  assert.ok(risk({ days: 30 }) > risk({ days: 7 }));
  assert.ok(risk({ saltPct: 10, days: 30 }) < risk({ saltPct: 3, days: 30 }));
  assert.ok(risk({ saltPct: 20, tempC: 40 }) === 0 || risk({ saltPct: 20, tempC: 40 }) < 1);
});

test('風味の複雑さ: 18〜22℃で最大、高温ほど下がる', () => {
  const c = (t) => simulate(H({ tempC: t, days: daysToRipe(H({ tempC: t })) })).complexity;
  assert.equal(complexityTempFactor(18), 1);
  assert.equal(complexityTempFactor(22), 1);
  assert.ok(c(20) > c(28));
  assert.ok(c(28) > c(35));
  assert.ok(c(35) > c(40));
  assert.ok(c(20) > c(10));
  assert.ok(c(20) >= c(18) - 1e-9 && c(20) >= c(22) - 1e-9);
});

test('浅漬け: 数時間〜数日で完成。白菜漬けより風味は単純', () => {
  const A = (o) => ({ veg: 'hakusai', pickle: 'asazuke', saltPct: 2.5, tempC: 20, days: 1, ...o });
  assert.equal(simulate(A({ days: 0.5 })).stage, 'ripe');
  assert.equal(simulate(A({ days: 0.25 })).stage, 'raw');
  assert.equal(simulate(A({ days: 2 })).stage, 'ripe');
  assert.equal(simulate(A({ days: 7 })).stage, 'sour');
  assert.ok(simulate(A()).complexity < simulate(H()).complexity);
  const range = ripeRangeDays(A());
  assert.ok(range.from < 1 && range.to > 2);
});

test('きゅうりは食感が高いが、早く柔らかくなる', () => {
  const K = (o) => ({ veg: 'kyuri', pickle: 'asazuke', saltPct: 2.5, tempC: 20, days: 1, ...o });
  const W = (o) => ({ veg: 'hakusai', pickle: 'asazuke', saltPct: 2.5, tempC: 20, days: 1, ...o });
  assert.ok(simulate(K()).texture > simulate(W()).texture);
  const drop = (f) => simulate(f({ days: 0 })).texture - simulate(f({ days: 7 })).texture;
  assert.ok(drop(K) > drop(W));
});

test('未知の野菜・漬物は例外', () => {
  assert.throws(() => simulate(H({ veg: 'tomato' })));
  assert.throws(() => simulate(H({ pickle: 'x' })));
});
