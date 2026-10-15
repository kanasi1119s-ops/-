import test from 'node:test';
import assert from 'node:assert/strict';
import { simulate, daysToRipe } from '../src/model.js';
import { satisfaction, priceFor, targetFor, reactionOf } from '../src/sales.js';
import { CONFIG } from '../src/config.js';

const C = Object.fromEntries(CONFIG.customers.map((c) => [c.id, c]));
const taste = (o) => simulate({ veg: 'hakusai', pickle: 'hakusaizuke', saltPct: 3, tempC: 20, days: 7, ...o });
const sat = (o, id, season) => satisfaction(taste(o), o.pickle ?? 'hakusaizuke', C[id], season);

test('客は5人で、満足度は0〜100に収まる', () => {
  assert.equal(CONFIG.customers.length, 5);
  for (const c of CONFIG.customers) for (const d of [0, 1, 7, 30]) {
    const s = sat({ days: d }, c.id);
    assert.ok(s >= 0 && s <= 100);
  }
});

test('客ごとに好みが違う: 通は標準の白菜漬けを、しょっぱめ好きは塩を強めたものを好む', () => {
  assert.ok(sat({}, 'shige') > sat({}, 'ume'));
  const salty = { saltPct: 5, days: daysToRipe({ veg: 'hakusai', pickle: 'hakusaizuke', saltPct: 5, tempC: 20 }) };
  assert.ok(sat(salty, 'gen') > sat({}, 'gen'));
});

test('酸っぱい好きは、よく漬かったものを好む', () => {
  assert.ok(sat({ days: 11 }, 'kiku') > sat({ days: 7 }, 'kiku'));
  assert.ok(sat({ days: 7 }, 'kiku') > sat({ days: 2 }, 'kiku'));
});

test('あっさり好きは浅漬けを好み、食感重視はきゅうりの浅漬けを好む', () => {
  const asa = { veg: 'hakusai', pickle: 'asazuke', saltPct: 2.5, tempC: 20, days: 1 };
  assert.ok(sat(asa, 'ume') > sat({}, 'ume'));
  const kyuri = { ...asa, veg: 'kyuri' };
  assert.ok(sat(kyuri, 'ken') > sat(asa, 'ken'));
});

test('未熟・傷み・しょっぱすぎ・酸っぱすぎは満足度が下がる', () => {
  for (const id of ['gen', 'kiku', 'shige']) {
    const best = sat({}, id);
    assert.ok(sat({ days: 1 }, id) < best, `${id} unripe`);
    assert.ok(sat({ saltPct: 2, tempC: 30 }, id) < best, `${id} spoil`);
  }
  assert.ok(sat({ saltPct: 15, days: 7 }, 'ume') < sat({}, 'ume'));
  assert.ok(sat({ days: 60 }, 'shige') < sat({}, 'shige'));
});

test('季節で好みが変わる: 夏はあっさり、冬はしょっぱめ', () => {
  assert.ok(targetFor(C.gen, 'summer').salt < targetFor(C.gen, 'winter').salt);
  const salty = { saltPct: 5, days: 12 };
  assert.ok(sat(salty, 'gen', 'winter') > sat(salty, 'gen', 'summer'));
});

test('支払額: 満足度が低いと買わず、高いほど高く買う', () => {
  assert.equal(priceFor(10, 'hakusaizuke'), 0);
  assert.ok(priceFor(90, 'hakusaizuke') > priceFor(50, 'hakusaizuke'));
  assert.ok(priceFor(50, 'hakusaizuke') > 0);
});

test('客の一言が返る', () => {
  const t = taste({ saltPct: 12, days: 7 });
  const s = satisfaction(t, 'hakusaizuke', C.ume);
  assert.match(reactionOf(t, 'hakusaizuke', C.ume, s).line, /.+/);
});
