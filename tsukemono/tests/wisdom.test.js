import test from 'node:test';
import assert from 'node:assert/strict';
import { CONFIG } from '../src/config.js';
import { createGame } from '../src/game.js';
import { GRANNY, WISDOM, TEACH } from '../data/wisdom.js';
import { NUKA_CARE } from '../data/nuka.js';

const DAY = CONFIG.calendar.ticksPerDay;
/** 梅子さんが常連になった後のゲーム */
function withGranny(seed = 1) {
  const g = createGame({ seed });
  g.advance(DAY * GRANNY.joinDay);
  return g;
}
const bondTo = (g, n) => { const r = g.granny(); while ((r.bond ?? 0) < n) g.deepenBond(r); return r; };

test('梅子さん: はじめの数日のうちに常連になり、最初の知恵を教えてくれる', () => {
  const g = createGame({ seed: 1 });
  assert.equal(g.granny(), null);
  g.advance(DAY * GRANNY.joinDay);
  const r = g.granny();
  assert.ok(r && r.name === GRANNY.name && r.age === 'old');
  assert.ok(g.popEvents().some((e) => e.type === 'grannyJoin'));
  assert.deepEqual(g.wisdomList().map((w) => w.id), WISDOM.filter((w) => w.bond === 0).map((w) => w.id));
});

test('関係が深まると知恵が増え、作り方も教わる（教わる経路）', () => {
  const g = withGranny();
  const n0 = g.wisdomList().length;
  bondTo(g, 4);
  assert.ok(g.wisdomList().length > n0 + 3);
  for (const t of TEACH.filter((x) => x.bond <= 4)) {
    assert.equal(g.recipeState(t.pickle) !== 'unknown', true);
    assert.equal(g.recipes[t.pickle].via, 'taught');
  }
  assert.ok(g.popEvents().some((e) => e.type === 'inspire' && e.via === 'taught'));
  bondTo(g, 99);
  assert.equal(g.wisdomList().length, WISDOM.length);
});

test('場面に合った知恵が出る（ぬか床が酸っぱい・水っぽい・傷みやすい・旨味が足りない・梅にカビ）', () => {
  const g = withGranny();
  bondTo(g, 99);
  g.brew(0, { veg: 'kyuri', pickle: 'nukazuke', saltPct: 0, tempC: 20 });
  g.stirNuka();
  const at = (patch) => { Object.assign(g.nuka, { sour: 0, water: 0, rot: 0, umami: 0.5, maturity: 0.2 }, patch); g.nuka.suteTick = g.tick; return g.wisdomFor()?.id; };
  assert.equal(at({ sour: 0.7 }), 'sour');
  assert.equal(at({ water: 0.7 }), 'water');
  assert.equal(at({ rot: 0.4 }), 'rot');
  assert.equal(at({ maturity: 0.8, umami: 0 }), 'umami');
  assert.equal(at({}), undefined);
  g.money = 1e5; g.addXp(CONFIG.levels[1].xp); g.buyPlace('tsubo');
  g.brew(1, { veg: 'ume', pickle: 'umeboshi', saltPct: 18, tempC: 20 });
  g.barrels[1].exposed = 0.9;
  assert.equal(at({}), 'ume');
});

test('知恵は教わっていなければ出ない。朝に1日1回だけ思い出させてくれる', () => {
  const g = withGranny();
  g.brew(0, { veg: 'kyuri', pickle: 'nukazuke', saltPct: 0, tempC: 20 });
  g.nuka.sour = 0.8;
  assert.notEqual(g.wisdomFor()?.id, 'sour'); // まだ教わっていない
  bondTo(g, 1);
  g.popEvents();
  g.advance(DAY);
  g.nuka.sour = 0.8; g.stirNuka(); g.nuka.sour = 0.8;
  g.advance(DAY);
  const hints = g.popEvents().filter((e) => e.type === 'wisdomHint');
  assert.ok(hints.length >= 1);
  g.wisdomMorning(); // 同じ日にもう一度
  assert.equal(g.popEvents().filter((e) => e.type === 'wisdomHint').length, 0, '同じ日に同じ知恵はくり返さない');
});

test('伝承（糠に釘・パチンコ玉）は伝承として出し、遊びには効かない（演出だけ）', () => {
  const lore = NUKA_CARE.filter((a) => a.lore);
  assert.deepEqual(lore.map((a) => a.id).sort(), ['kugi', 'pachinko']);
  for (const a of lore) {
    assert.deepEqual(a.effects, {});
    assert.match(a.note, /確かめられていない/);
  }
  const g = withGranny();
  g.money = 1e5;
  assert.equal(g.nukaCare('kugi').ok, false); // まだ教わっていない
  bondTo(g, 99);
  const before = JSON.stringify({ ...g.nuka, cared: null });
  assert.equal(g.nukaCare('kugi').ok, true);
  assert.equal(g.nukaCare('pachinko').ok, true);
  assert.equal(JSON.stringify({ ...g.nuka, cared: null }), before, '床の状態は変わらない');
  assert.ok(WISDOM.filter((w) => w.lore).every((w) => /言う|人もいる|知らない/.test(w.text)), '伝承とわかる言い方');
});

test('セーブ: 教わった知恵と梅子さんが残る', () => {
  const g = withGranny();
  bondTo(g, 3);
  const h = createGame();
  assert.equal(h.restore(g.snapshot()), true);
  assert.deepEqual(h.wisdom.known, g.wisdom.known);
  assert.ok(h.granny());
  h.advance(DAY * 2);
  assert.equal(h.regulars.filter((r) => r.granny).length, 1, '二人にならない');
});
