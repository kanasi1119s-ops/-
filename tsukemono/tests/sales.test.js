import test from 'node:test';
import assert from 'node:assert/strict';
import { simulate, daysToRipe } from '../src/model.js';
import { satisfaction, priceFor, targetFor, reactionOf } from '../src/sales.js';
import { CONFIG } from '../src/config.js';

const C = Object.fromEntries(CONFIG.customers.map((c) => [c.id, c]));
const taste = (o) => simulate({ veg: 'hakusai', pickle: 'hakusaizuke', saltPct: 3, tempC: 20, days: 7, ...o });
const sat = (o, id, season) => satisfaction(taste(o), o.pickle ?? 'hakusaizuke', C[id], season);

test('好みのタイプは5つで、満足度は0〜100に収まる', () => {
  assert.equal(CONFIG.customers.length, 5);
  for (const c of CONFIG.customers) for (const d of [0, 1, 7, 30]) {
    const s = sat({ days: d }, c.id);
    assert.ok(s >= 0 && s <= 100);
  }
});

test('タイプごとに好みが違う: 通は標準の白菜漬けを、しょっぱめ好きは塩を強めたものを好む', () => {
  assert.ok(sat({}, 'gourmet') > sat({}, 'light'));
  const salty = { saltPct: 5, days: daysToRipe({ veg: 'hakusai', pickle: 'hakusaizuke', saltPct: 5, tempC: 20 }) };
  assert.ok(sat(salty, 'salty') > sat({}, 'salty'));
});

test('酸っぱい好きは、よく漬かったものを好む', () => {
  assert.ok(sat({ days: 11 }, 'sour') > sat({ days: 7 }, 'sour'));
  assert.ok(sat({ days: 7 }, 'sour') > sat({ days: 2 }, 'sour'));
});

test('あっさり好きは浅漬けを好み、食感重視はきゅうりの浅漬けを好む', () => {
  const asa = { veg: 'hakusai', pickle: 'asazuke', saltPct: 2.5, tempC: 20, days: 1 };
  assert.ok(sat(asa, 'light') > sat({}, 'light'));
  const kyuri = { ...asa, veg: 'kyuri' };
  assert.ok(sat(kyuri, 'crunchy') > sat(asa, 'crunchy'));
});

test('未熟・傷み・しょっぱすぎ・酸っぱすぎは満足度が下がる', () => {
  for (const id of ['salty', 'sour', 'gourmet']) {
    const best = sat({}, id);
    assert.ok(sat({ days: 1 }, id) < best, `${id} unripe`);
    assert.ok(sat({ saltPct: 2, tempC: 30 }, id) < best, `${id} spoil`);
  }
  assert.ok(sat({ saltPct: 15, days: 7 }, 'light') < sat({}, 'light'));
  assert.ok(sat({ days: 60 }, 'gourmet') < sat({}, 'gourmet'));
});

test('季節で好みが変わる: 夏はあっさり、冬はしょっぱめ', () => {
  assert.ok(targetFor(C.salty, 'summer').salt < targetFor(C.salty, 'winter').salt);
  const salty = { saltPct: 5, days: 12 };
  assert.ok(sat(salty, 'salty', 'winter') > sat(salty, 'salty', 'summer'));
});

test('支払額: 満足度が低いと買わず、高いほど高く買う', () => {
  assert.equal(priceFor(10, 'hakusaizuke'), 0);
  assert.ok(priceFor(90, 'hakusaizuke') > priceFor(50, 'hakusaizuke'));
  assert.ok(priceFor(50, 'hakusaizuke') > 0);
});

test('客の一言が返る', () => {
  const t = taste({ saltPct: 12, days: 7 });
  const s = satisfaction(t, 'hakusaizuke', C.light);
  assert.match(reactionOf(t, 'hakusaizuke', C.light, s).line, /.+/);
});
