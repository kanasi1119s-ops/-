import test from 'node:test';
import assert from 'node:assert/strict';
import { CONFIG } from '../src/config.js';
import { createGame } from '../src/game.js';
import { eventOn } from '../data/events.js';

const DAY = CONFIG.calendar.ticksPerDay;
const SEASON = CONFIG.calendar.daysPerSeason;
const lv = (n) => CONFIG.levels.find((l) => l.level === n).xp;
const rich = (n = 7, seed = 1) => { const g = createGame({ seed }); g.money = 1e7; g.addXp(lv(n)); g.popEvents(); return g; };
const days = (g, n, w) => { for (let d = 0; d < n; d++) { g.weather = w; g.tomorrow = w; g.advance(DAY); } };
const takuan = { veg: 'daikon', pickle: 'takuan', saltPct: 5, tempC: 15, dry: 4 };

test('天日干し: 晴れの日だけ乾き、雨の日は止まって質が落ちる。干し上がると知らせて漬かりはじめる', () => {
  const sun = rich(), rain = rich();
  sun.brew(0, takuan); rain.brew(0, takuan);
  days(sun, 2, 'sunny'); days(rain, 2, 'rain');
  assert.ok(Math.abs(sun.dryingLeft(sun.barrels[0]) - 2) < 1e-6);
  assert.ok(Math.abs(rain.dryingLeft(rain.barrels[0]) - 4) < 1e-6);
  assert.ok(rain.barrels[0].quality < sun.barrels[0].quality);
  days(sun, 2, 'sunny');
  assert.ok(sun.popEvents().some((e) => e.type === 'dried'));
  assert.equal(sun.dryingLeft(sun.barrels[0]), 0);
  assert.equal(sun.fermentDays(sun.barrels[0]), 0);
  days(sun, 3, 'sunny');
  assert.equal(sun.fermentDays(sun.barrels[0]), 3);
  // 冬の寒風はよく乾く
  const w = rich(); w.tick = 3 * SEASON * DAY;
  w.brew(0, takuan); days(w, 2, 'sunny');
  assert.ok(w.dryingLeft(w.barrels[0]) < 2);
});

test('天気の見立て: 明日の天気が分かり、翌朝その天気になる', () => {
  const g = rich();
  for (let d = 0; d < 20; d++) { const t = g.tomorrow; assert.ok(CONFIG.calendar.weathers.includes(t)); g.advance(DAY); assert.equal(g.weather, t); }
  const h = createGame();
  assert.equal(h.restore(g.snapshot()), true);
  assert.equal(h.tomorrow, g.tomorrow);
});

test('梅の土用干し: 夏の晴れた日にだけできて、値打ちが上がる', () => {
  const g = rich();
  g.buyPlace('tsubo');
  const r = { veg: 'ume', pickle: 'umeboshi', saltPct: 18, tempC: 20 };
  g.brew(0, r); g.brew(1, r);
  days(g, 24, 'sunny'); // 春のうち（漬けて24日）
  assert.match(g.doWork(0, 'doyoboshi').error, /夏/);
  days(g, 6, 'rain'); // 夏に入った
  g.weather = 'rain';
  assert.match(g.doWork(0, 'doyoboshi').error, /晴れ/);
  g.weather = 'sunny';
  assert.equal(g.doWork(0, 'doyoboshi').ok, true);
  const a = g.tasteOf(0), b = g.tasteOf(1);
  assert.ok(a.priceMult > (b.priceMult ?? 1) && a.complexity > b.complexity);
});

test('季節の行事: べったら市・夏の土用。正月は地方の正月の漬物も売れる', () => {
  assert.equal(eventOn('autumn', 12).id, 'bettaraichi');
  assert.ok(eventOn('autumn', 12).likes.includes('bettarazuke'));
  assert.equal(eventOn('summer', 15).id, 'doyo');
  assert.ok(eventOn('winter', 11).likes.includes('kaburazushi_ishikawa'));
  for (const e of [eventOn('autumn', 12), eventOn('summer', 15), eventOn('winter', 11)]) for (const id of e.likes) assert.ok(CONFIG.pickles[id], id);
});
