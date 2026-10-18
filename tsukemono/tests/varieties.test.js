import test from 'node:test';
import assert from 'node:assert/strict';
import { CONFIG, PICKLE_DEFS, REGIONAL_PICKLES } from '../src/config.js';
import { simulate, daysToRipe, affinityOf } from '../src/model.js';
import { createGame, bookKey, bookTotal } from '../src/game.js';

test('たくあん: 約1か月以上かかり、長く置ける。塩が多いほど遅い', () => {
  const d5 = daysToRipe({ veg: 'daikon', pickle: 'takuan', saltPct: 5, tempC: 22 });
  assert.ok(d5 > 30 && d5 < 45, `${d5}`);
  assert.ok(daysToRipe({ veg: 'daikon', pickle: 'takuan', saltPct: 8, tempC: 22 }) > d5);
  const t = simulate({ veg: 'daikon', pickle: 'takuan', saltPct: 5, tempC: 22, days: d5 * 2.5 });
  assert.notEqual(t.stage, 'sour'); // 食べ頃を過ぎても長く持つ
  assert.ok(t.texture > 40, 'たくあんはポリポリのまま');
});

test('野沢菜漬: 冬の屋外で約10日、土間ではもっと長い', () => {
  const out = daysToRipe({ veg: 'nozawana', pickle: 'nozawanazuke', saltPct: 3, tempC: 8 });
  assert.ok(out > 7 && out < 14, `${out}`);
  assert.ok(daysToRipe({ veg: 'nozawana', pickle: 'nozawanazuke', saltPct: 3, tempC: 3 }) > 21);
});

test('調味: 相性が良いと風味が深まり、悪いと濁る。ふつうは半分', () => {
  const base = { veg: 'daikon', pickle: 'takuan', saltPct: 5, tempC: 22, days: 40 };
  const plain = simulate(base).complexity;
  assert.equal(affinityOf('takuan', 'zarame'), 'good');
  assert.ok(simulate({ ...base, additives: ['zarame'] }).complexity > plain);
  assert.ok(simulate({ ...base, additives: ['zarame'] }).saltiness < simulate(base).saltiness, 'ざらめは塩味を和らげる');
  assert.ok(simulate({ ...base, additives: ['yuzu'] }).complexity < plain, 'たくあんにゆずは合わない');
  const h = { veg: 'hakusai', pickle: 'hakusaizuke', saltPct: 3, tempC: 20, days: 7 };
  const neutral = simulate({ ...h, additives: ['zarame'] }).complexity - simulate(h).complexity;
  const good = simulate({ ...h, additives: ['kombu'] }).complexity - simulate(h).complexity;
  assert.ok(neutral > 0 && neutral < good);
  // 唐辛子は傷みにくくする
  assert.ok(simulate({ ...h, additives: ['togarashi'] }).spoilRisk < simulate(h).spoilRisk);
});

test('調味は2つまで。代金がかかり、樽に記録される', () => {
  const g = createGame({ seed: 1 });
  const r = { veg: 'hakusai', pickle: 'hakusaizuke', saltPct: 3, tempC: 20 };
  assert.equal(g.brew(0, { ...r, additives: ['kombu', 'yuzu', 'togarashi'] }).ok, false);
  const m = g.money;
  const res = g.brew(0, { ...r, additives: ['kombu', 'yuzu'] });
  assert.ok(res.ok);
  assert.equal(m - g.money, g.brewCost(r) + CONFIG.additives.kombu.cost + CONFIG.additives.yuzu.cost);
  assert.deepEqual(g.barrels[0].additives, ['kombu', 'yuzu']);
});

test('図鑑: 売った組み合わせが記録され、セーブで残る', () => {
  const g = createGame({ seed: 4 });
  g.brew(0, { veg: 'kyuri', pickle: 'asazuke', saltPct: 2.5, tempC: 20, additives: ['yuzu', 'kombu'] });
  let res;
  for (let i = 0; i < 12 && !res?.visitors?.length; i++) {
    g.advance(1); while (g.timeOfDay() !== 'noon') g.advance(1);
    g.weather = 'sunny'; g.care(0); res = g.sell(0);
  }
  assert.ok(res.discovery?.isNew);
  const key = bookKey({ pickle: 'asazuke', veg: 'kyuri', additives: ['kombu', 'yuzu'] });
  assert.equal(res.discovery.key, key);
  assert.ok(g.book[key].best > 0);
  const h = createGame({ seed: 1 });
  assert.ok(h.restore(g.snapshot()));
  assert.deepEqual(h.book, g.book);
  // 組み合わせの総数: 漬物×野菜16通り × 調味8種から2つまで（なし1＋1つ8＋2つ28＝37通り）
  assert.equal(bookTotal(), (43 + REGIONAL_PICKLES.reduce((s, p) => s + p.vegetables.length, 0)) * 37); // ＋全国の漬物（data/regional.js） // 漬物ごとの野菜の数の合計43（段階Fの地方の4種とすぐき菜、段階Eの梅干し・白瓜・みょうが、段階Dの赤かぶ、段階Cの隠れた4種も含む）× 調味の組み合わせ37 // 段階Cの隠れた4種（からし漬け3・柴漬け2・古漬け4・粕漬け4）も含む
});

test('客の好きな漬物は複数あってよい（たくあんは通・しょっぱめ好き・食感重視が好き）', () => {
  for (const id of ['gourmet', 'salty', 'crunchy']) assert.ok(CONFIG.customers.find((c) => c.id === id).likes.includes('takuan'));
});
