import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame, newBed } from '../src/game.js';
import { CONFIG } from '../src/config.js';
import { NUKA_CARE } from '../data/nuka.js';
import { nukaStep } from '../src/model.js';

const day = (g) => g.advance(CONFIG.calendar.ticksPerDay);

test('ぬか床: 毎日かき混ぜ、3日ごとに捨て漬けを替えると、30日たっても安定している', () => {
  const g = createGame({ seed: 11 });
  for (let d = 1; d <= 30; d++) {
    g.stirNuka();
    if (d % 3 === 0) g.nukaCare('sute');
    day(g);
  }
  const n = g.nuka;
  assert.ok(n.sour < 0.4, `酸味 ${n.sour}`);
  assert.ok(n.film < 0.3, `膜 ${n.film}`);
  assert.ok(n.rot < 0.05, `傷み ${n.rot}`);
  assert.ok(n.maturity > 0.99, '床が育つ');
});

test('ぬか床: 放っておくと 白い膜 → 酸っぱい → 傷む の順に進む', () => {
  // 店の中 20℃ のつもりで、モデルだけで1日ずつ進める
  let bed = newBed(), first = {};
  for (let d = 1; d <= 40; d++) {
    bed = nukaStep(bed, 20, 1, d, CONFIG);
    if (first.film == null && bed.film >= CONFIG.care.filmVisible) first.film = d;
    if (first.sour == null && bed.sour >= 0.5) first.sour = d;
    if (first.rot == null && bed.rot >= 0.3) first.rot = d;
  }
  assert.ok(first.film && first.sour && first.rot, JSON.stringify(first));
  assert.ok(first.film < first.sour && first.sour < first.rot, `膜${first.film}日 酸${first.sour}日 傷み${first.rot}日`);
});

test('ぬか床: 26℃以上は20〜25℃より早く酸っぱくなる', () => {
  const at = (t) => nukaStep(newBed(), t, 3, 0, CONFIG).sour;
  assert.ok(at(28) > at(23) * 1.5, `${at(28)} vs ${at(23)}`);
});

test('ぬか床: 酸っぱいときは 塩・からし・卵の殻 で酸味が戻る', () => {
  for (const id of ['salt', 'karashi', 'egg']) {
    const g = createGame({ seed: 12 });
    g.nuka.sour = 0.8;
    const r = g.nukaCare(id);
    assert.ok(r.ok, `${id}: ${r.error}`);
    assert.ok(g.nuka.sour < 0.8, `${id} で酸味が下がる`);
    assert.equal(g.nukaCare(id).ok, false, '同じ時間帯に2回はできない');
  }
});

test('ぬか床: ぬか漬けを漬けるほど水っぽくなり、ぬかと塩を足すと戻る。水っぽいと塩味が薄まり、酸っぱくなりやすい', () => {
  const g = createGame({ seed: 13 });
  g.money = 1e6;
  g.brew(0, { veg: 'kyuri', pickle: 'nukazuke', tempC: 20, count: 60 });
  assert.ok(g.nuka.water > 0.5, `水っぽさ ${g.nuka.water}`);
  const wet = nukaStep({ ...g.nuka, sour: 0 }, 22, 2, 0, CONFIG).sour, dry = nukaStep({ ...g.nuka, water: 0, sour: 0 }, 22, 2, 0, CONFIG).sour;
  assert.ok(wet > dry, '水っぽいと酸っぱくなりやすい');
  g.advance(4);
  const salty = g.tasteOf(0).saltiness;
  const w = g.nuka.water, s = g.nuka.salt;
  assert.ok(g.nukaCare('nuka').ok);
  assert.ok(g.nuka.water < w && g.nuka.salt > s);
  assert.ok(g.tasteOf(0).saltiness > salty, '水気が減ると塩味が戻る');
});

test('ぬか床: 捨て漬けを替えないと傷みが進み、替えると止まる。傷んだ床のぬか漬けは傷みリスクが上がる', () => {
  const kept = createGame({ seed: 14 }), left = createGame({ seed: 14 });
  for (let d = 1; d <= 20; d++) {
    kept.stirNuka(); left.stirNuka(); // どちらも毎日かき混ぜる（違いは捨て漬けだけ）
    if (d % 3 === 0) kept.nukaCare('sute');
    day(kept); day(left);
  }
  assert.ok(left.nuka.rot > kept.nuka.rot + 0.1, `${left.nuka.rot} vs ${kept.nuka.rot}`);
  const r0 = left.nuka.rot;
  assert.ok(left.nukaCare('sute').ok);
  assert.ok(left.nuka.rot < r0);
  const k = { veg: 'kyuri', pickle: 'nukazuke', tempC: 20 };
  kept.brew(0, k); left.brew(0, k); kept.advance(2); left.advance(2);
  assert.ok(left.tasteOf(0).spoilRisk > kept.tasteOf(0).spoilRisk + 10);
});

test('ぬか床: 昆布・赤唐辛子・煮干し・実山椒・ゆずで旨味が足され、ぬか漬けの風味が深くなる', () => {
  const ids = NUKA_CARE.filter((a) => a.when === 'umami').map((a) => a.id);
  assert.deepEqual(ids, ['kombu', 'akatogarashi', 'niboshi', 'sansho', 'yuzu']);
  const plain = createGame({ seed: 15 }), rich = createGame({ seed: 15 });
  for (const id of ['kombu', 'niboshi']) assert.ok(rich.nukaCare(id).ok);
  const k = { veg: 'kyuri', pickle: 'nukazuke', tempC: 20 };
  plain.brew(0, k); rich.brew(0, k); plain.advance(4); rich.advance(4);
  assert.ok(rich.tasteOf(0).complexity > plain.tasteOf(0).complexity * 1.1);
});

test('ぬか床: 手入れの定義を1件足すだけで使える。お金が足りないとできない', () => {
  NUKA_CARE.push({ id: 'test_ume', name: '梅酢を少し', when: 'sour', cost: 20, effects: { sour: -0.1 } });
  try {
    const g = createGame({ seed: 16 });
    g.nuka.sour = 0.5;
    assert.ok(g.nukaCare('test_ume').ok);
    assert.ok(Math.abs(g.nuka.sour - 0.4) < 1e-9);
    g.money = 0;
    assert.equal(g.nukaCare('kombu').ok, false);
  } finally { NUKA_CARE.pop(); }
});

test('ぬか床: 段階Bより前のセーブ（水っぽさ・傷みがない）も読める', () => {
  const a = createGame({ seed: 17 });
  const snap = JSON.parse(JSON.stringify(a.snapshot()));
  snap.nuka = { salt: 6, sour: 0.2, film: 0.1, maturity: 0.5, lastStirDay: 3 };
  const b = createGame({ seed: 18 });
  assert.equal(b.restore(snap), true);
  assert.equal(b.nuka.water, 0);
  assert.equal(b.nuka.rot, 0);
  assert.equal(b.nuka.maturity, 0.5);
  b.advance(4);
  assert.ok(Number.isFinite(b.nuka.rot));
});
