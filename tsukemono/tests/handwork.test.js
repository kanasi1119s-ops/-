import test from 'node:test';
import assert from 'node:assert/strict';
import { CONFIG } from '../src/config.js';
import { createGame } from '../src/game.js';
import { simulate } from '../src/model.js';
import { WORK } from '../data/work.js';

const DAY = CONFIG.calendar.ticksPerDay;
const lv = (n) => CONFIG.levels.find((l) => l.level === n).xp;
const rich = (n = 7, seed = 1) => { const g = createGame({ seed }); g.money = 1e7; g.addXp(lv(n)); g.popEvents(); return g; };
const haku = { veg: 'hakusai', pickle: 'hakusaizuke', saltPct: 3, tempC: 15, days: 9 };

test('重石: ふつうの重石は今までと同じ。重くして水が上がったら軽くするのがいちばん良い', () => {
  const none = simulate(haku), normal = simulate({ ...haku, weights: [{ d: 0, w: 1 }] });
  assert.equal(normal.texture, none.texture);
  assert.equal(normal.spoilRisk, none.spoilRisk);
  const heavy = simulate({ ...haku, weights: [{ d: 0, w: 2 }] });
  const light = simulate({ ...haku, weights: [{ d: 0, w: 0.5 }] });
  const sw = simulate({ ...haku, weights: [{ d: 0, w: 2 }, { d: 1, w: 0.5 }] });
  assert.ok(heavy.spoilRisk < normal.spoilRisk && light.spoilRisk > normal.spoilRisk, '重いほど傷みにくい');
  assert.ok(heavy.texture < normal.texture * 0.8, '重いままだとつぶれる');
  assert.ok(sw.texture > normal.texture && sw.spoilRisk < normal.spoilRisk, '切り替えると両方良い');
  // 大根（かたい）はつぶれにくい
  const dk = (w) => simulate({ veg: 'daikon', pickle: 'takuan', saltPct: 5, tempC: 15, days: 9, weights: w }).texture;
  assert.ok(dk([{ d: 0, w: 2 }]) / dk([{ d: 0, w: 1 }]) > heavy.texture / normal.texture);
});

test('重石: 仕込みで選び、樽の窓で替えられる。水が上がると知らせる', () => {
  const g = rich();
  assert.equal(g.brew(0, { ...haku, weight: 'heavy' }).ok, true);
  assert.deepEqual(g.barrels[0].weights, [{ d: 0, w: 2 }]);
  assert.match(g.brew(1, { ...haku, weight: 'omoi' }).error, /重石/);
  g.advance(DAY * 2);
  const ev = g.popEvents().find((e) => e.type === 'waterUp');
  assert.ok(ev && ev.slot === 0 && ev.heavy);
  assert.equal(g.tasteOf(0).waterUp, 1);
  assert.equal(g.setWeight(0, 'light').ok, true);
  assert.equal(g.weightOf(g.barrels[0]), 'light');
  assert.equal(g.setWeight(0, 'light').ok, false);
  assert.equal(g.barrels[0].weights.length, 2);
  // 重石を使わない漬物は替えられない
  g.brew(2, { veg: 'kyuri', pickle: 'asazuke', saltPct: 2.5, tempC: 15 });
  assert.equal(g.setWeight(2, 'heavy').ok, false);
});

test('工程: 目安の日にやると良く、やらずに過ぎると味が落ちる。早すぎ・遅すぎは少し落ちる', () => {
  const run = (doAt) => {
    const g = rich();
    g.openRegion('関東'); g.learn('teppozuke'); g.popEvents();
    g.brew(0, { veg: 'shirouri', pickle: 'teppozuke', saltPct: 5, tempC: 10 });
    let r = null;
    for (let d = 0; d < 7; d++) { if (d === doAt) r = g.doWork(0, 'nikaeshi'); g.advance(DAY); }
    return { t: g.tasteOf(0), r, g };
  };
  const good = run(3), skip = run(-1), early = run(0), late = run(6);
  assert.equal(good.r.timing, 'good');
  assert.equal(early.r.timing, 'early');
  assert.equal(late.r.timing, 'late');
  assert.ok(good.t.spoilRisk < skip.t.spoilRisk && good.t.complexity > skip.t.complexity);
  assert.ok(early.t.complexity < good.t.complexity);
  assert.ok(late.t.texture < good.t.texture);
  assert.equal(skip.t.work[0].state, 'skipped');
  assert.equal(good.g.doWork(0, 'nikaeshi').ok, false); // 2回はできない
  // 目安を大きく過ぎると、もうできない
  skip.g.advance(DAY * 5);
  assert.match(skip.g.doWork(0, 'nikaeshi').error, /遅すぎ/);
});

test('工程: 柴漬けは汁を捨てる。らっきょうは甘酢に漬け替えないと、ただしょっぱい', () => {
  assert.deepEqual(CONFIG.pickles.shibazuke.work.map((w) => w.id), ['drain']);
  const g = rich();
  g.openRegion('関東'); g.learn('rakkyo_ibaraki'); g.popEvents();
  g.brew(0, { veg: 'rakkyo', pickle: 'rakkyo_ibaraki', saltPct: 9, tempC: 10 });
  g.brew(1, { veg: 'rakkyo', pickle: 'rakkyo_ibaraki', saltPct: 9, tempC: 10 });
  for (let d = 0; d < 20; d++) { if (d === 10) g.doWork(0, 'amazu'); g.advance(DAY); }
  const done = g.tasteOf(0), skip = g.tasteOf(1);
  assert.ok(done.acid > skip.acid * 2 && done.saltiness < skip.saltiness && done.complexity > skip.complexity);
  for (const p of Object.values(CONFIG.pickles)) for (const w of p.work) assert.ok(WORK[w.id] && w.window[1] >= w.window[0], p.name);
});

test('職人の弟子: 水が上がったら重石を軽くし、工程も目安の日にやってくれる。セーブに残る', () => {
  const g = rich();
  g.hire('deshi');
  g.openRegion('関東'); g.learn('teppozuke'); g.popEvents();
  g.brew(0, { ...haku, weight: 'heavy' });
  g.brew(1, { veg: 'shirouri', pickle: 'teppozuke', saltPct: 5, tempC: 10 });
  g.advance(DAY * 4);
  assert.equal(g.weightOf(g.barrels[0]), 'light');
  assert.ok(g.barrels[1].work.nikaeshi != null);
  const h = createGame();
  assert.equal(h.restore(g.snapshot()), true);
  assert.deepEqual(h.barrels[0].weights, g.barrels[0].weights);
  assert.deepEqual(h.barrels[1].work, g.barrels[1].work);
});
