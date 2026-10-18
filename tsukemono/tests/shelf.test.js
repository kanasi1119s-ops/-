import test from 'node:test';
import assert from 'node:assert/strict';
import { CONFIG } from '../src/config.js';
import { createGame, SHELF } from '../src/game.js';

const DAY = CONFIG.calendar.ticksPerDay;
const lv = (n) => CONFIG.levels.find((l) => l.level === n).xp;
const rich = (n = 7, seed = 1) => { const g = createGame({ seed }); g.money = 1e7; g.addXp(lv(n)); g.popEvents(); return g; };
const haku = { veg: 'hakusai', pickle: 'hakusaizuke', saltPct: 3, tempC: 20 };
const toNoon = (g) => { while (g.timeOfDay() !== 'noon') g.advance(1); };

test('棚: 食べ頃の樽を移すと樽が空き、棚から店先に出して売れる', () => {
  const g = rich();
  g.brew(0, haku);
  assert.match(g.shelve(0).error, /食べ頃/);
  g.advance(DAY * 8);
  const r = g.shelve(0);
  assert.ok(r.ok, r.error);
  assert.equal(r.shelf, SHELF);
  assert.equal(g.barrels[0], null);
  assert.equal(g.vessel(SHELF).pickle, 'hakusaizuke');
  assert.equal(g.brew(0, haku).ok, true); // 樽が空いたので次を仕込める
  toNoon(g); g.weather = 'sunny';
  const before = g.vessel(SHELF).portions;
  let sold = 0;
  for (let i = 0; i < 6 && g.vessel(SHELF); i++) { const s = g.sell(SHELF); assert.ok(s.ok, s.error); sold += s.sold; g.advance(1); while (!g.isOpen()) g.advance(1); }
  assert.ok(sold > 0 && sold <= before);
});

test('棚: 漬かりも傷みもゆっくり進む（樽に置いたままより長く食べ頃が続く）', () => {
  const g = rich();
  g.brew(0, haku); g.brew(1, haku);
  g.advance(DAY * 7);
  g.shelve(0);
  g.advance(DAY * 8);
  const shelf = g.tasteOf(SHELF), barrel = g.tasteOf(1);
  assert.equal(shelf.stage, 'ripe');
  assert.notEqual(barrel.stage, 'ripe');
  assert.ok(shelf.spoilRisk < barrel.spoilRisk);
});

test('棚の数: はじめは3つ。いっぱいだと移せない。棚を作り足すと増える。セーブに残る', () => {
  const g = rich();
  assert.equal(g.shelfSlots(), CONFIG.shelf.base);
  for (let i = 0; i < 3; i++) g.brew(i, haku);
  g.advance(DAY * 8);
  for (let i = 0; i < 3; i++) assert.equal(g.shelve(i).ok, true);
  g.brew(0, haku); g.advance(DAY * 8);
  assert.match(g.shelve(0).error, /棚がいっぱい/);
  g.buyUpgrade('tana');
  assert.equal(g.shelfSlots(), CONFIG.shelf.base + 3);
  assert.equal(g.shelve(0).ok, true);
  const h = createGame();
  assert.equal(h.restore(g.snapshot()), true);
  assert.equal(h.shelf.filter(Boolean).length, 4);
  assert.equal(h.tasteOf(SHELF).stage, g.tasteOf(SHELF).stage);
});

test('樽の数: 店先は5つまで。裏の物置・漬物蔵を建てると、裏に樽が置ける', () => {
  const g = rich();
  while (g.buyBarrel().ok);
  assert.equal(g.barrels.length, 5);
  assert.match(g.buyBarrel().error, /蔵/);
  for (const id of ['noren', 'kanban', 'urakura']) assert.equal(g.buyUpgrade(id).ok, true, id);
  assert.equal(g.buyBarrel().ok, true); assert.equal(g.buyBarrel().ok, true);
  assert.equal(g.barrels.length, 7);
  assert.equal(g.buyBarrel().ok, false);
  assert.equal(g.brew(6, haku).ok, true);
  const h = createGame();
  assert.equal(h.restore(g.snapshot()), true);
  assert.equal(h.barrels.length, 7);
});
