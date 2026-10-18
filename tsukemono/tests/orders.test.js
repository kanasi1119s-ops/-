import test from 'node:test';
import assert from 'node:assert/strict';
import { CONFIG } from '../src/config.js';
import { createGame } from '../src/game.js';
import { CLIENTS } from '../data/orders.js';

const DAY = CONFIG.calendar.ticksPerDay;
const lv = (n) => CONFIG.levels.find((l) => l.level === n).xp;
const rich = (n = 7, seed = 1) => { const g = createGame({ seed }); g.money = 1e7; g.addXp(lv(n)); g.popEvents(); return g; };

test('注文: ときどき依頼主が来て、受けると期日がつく。受けなければ消える', () => {
  const g = rich(2);
  const offers = [];
  for (let d = 0; d < 12; d++) { g.advance(DAY); offers.push(...g.popEvents().filter((e) => e.type === 'orderOffer')); }
  assert.ok(offers.length >= 2, `${offers.length}`);
  assert.ok(offers.every((e) => e.line.includes('個')));
  const o = g.orders.board.find((x) => x.state === 'offer');
  assert.ok(g.knows(o.pickle), '知っている漬物を頼まれる');
  assert.equal(g.acceptOrder(o.id).ok, true);
  assert.equal(o.due, g.day() + o.days);
  for (const x of g.orders.board.filter((x) => x.state === 'offer')) assert.equal(g.declineOrder(x.id).ok, true);
  assert.deepEqual(g.orders.board.map((x) => x.state), ['active']);
});

test('注文: 出来が足りれば納めてお礼と評判。足りなければ断られる', () => {
  const g = rich(3);
  const o = { id: 99, client: 'chonaikai', pickle: 'hakusaizuke', count: 12, days: 10, minSat: 45, reward: 9000, rep: 2, state: 'active', due: g.day() + 10 };
  g.orders.board.push(o);
  g.brew(0, { veg: 'hakusai', pickle: 'hakusaizuke', saltPct: 3, tempC: 20, count: 18 });
  g.brew(1, { veg: 'kyuri', pickle: 'asazuke', saltPct: 2.5, tempC: 15 });
  assert.match(g.deliver(99, 1).error, /白菜漬け/);
  g.advance(DAY);
  assert.match(g.deliver(99, 0).error, /出来が足りない.*浅い/);
  g.advance(DAY * 6);
  const m = g.money, rep = g.reputation;
  const r = g.deliver(99, 0);
  assert.ok(r.ok, r.error);
  assert.ok(g.money - m >= 9000 && g.reputation > rep);
  assert.equal(g.barrels[0].portions, 6);
  assert.ok(!g.orders.board.some((x) => x.id === 99));
  assert.equal(g.orders.done, 1);
  assert.equal(g.popEvents().filter((e) => e.type === 'orderDone').length, 1);
});

test('注文: 期日を過ぎると評判が下がる。料亭の板前は通の舌で見る', () => {
  const g = rich(4);
  g.orders.board.push({ id: 7, client: 'ryotei', pickle: 'takuan', count: 6, days: 2, minSat: 60, reward: 9000, rep: 4, state: 'active', due: g.day() + 2 });
  const rep = g.reputation;
  g.advance(DAY * 3);
  assert.equal(g.reputation, rep - 4 * CONFIG.orders.failRepMult);
  assert.ok(g.popEvents().some((e) => e.type === 'orderFailed'));
  assert.equal(g.orders.failed, 1);
  assert.equal(CLIENTS.find((c) => c.id === 'ryotei').judge, 'gourmet');
});

test('注文: 受けられるのは2つまで。棚からも納められる。セーブに残る', () => {
  const g = rich();
  for (let i = 0; i < 3; i++) g.orders.board.push({ id: 50 + i, client: 'bento', pickle: 'asazuke', count: 6, days: 5, minSat: 0, reward: 2000, rep: 1, state: 'offer', offerUntil: g.day() + 3, due: null });
  assert.equal(g.acceptOrder(50).ok, true); assert.equal(g.acceptOrder(51).ok, true);
  assert.match(g.acceptOrder(52).error, /2つまで/);
  g.brew(0, { veg: 'kyuri', pickle: 'asazuke', saltPct: 2.5, tempC: 15, count: 12 });
  g.advance(DAY);
  const sh = g.shelve(0);
  assert.ok(sh.ok, sh.error);
  assert.equal(g.deliver(50, sh.shelf).ok, true);
  const h = createGame();
  assert.equal(h.restore(g.snapshot()), true);
  assert.deepEqual(h.orders, g.orders);
});
