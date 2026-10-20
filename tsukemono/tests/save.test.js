import test from 'node:test';
import assert from 'node:assert/strict';
import { CONFIG } from '../src/config.js';
import { createGame, cleanShopName, SHOP_NAME_DEFAULT } from '../src/game.js';
import { SAVE_VERSION, encodeSave, decodeSave, migrateSnapshot } from '../src/save.js';

const DAY = CONFIG.calendar.ticksPerDay;
/** いろいろ遊んだ状態のゲーム */
function played(seed = 1) {
  const g = createGame({ seed });
  g.money = 50000; g.addXp(500);
  g.brew(0, { veg: 'hakusai', pickle: 'hakusaizuke', saltPct: 3, tempC: 20, additives: ['kombu'] });
  g.buyStock('kyuri', 6); g.hire('baito'); g.buyContract('akakabu'); g.learn('sunki');
  g.advance(DAY * 8);
  g.weather = 'sunny'; while (!g.isOpen()) g.advance(1);
  g.sell(0);
  g.stirNuka();
  return g;
}
const tryLoad = (snap) => createGame().restore(snap);

test('セーブ→ロード: お金・評判・在庫・ぬか床・図鑑・日付などが、そっくり戻る', () => {
  const g = played();
  const text = encodeSave(g, { log: ['x'] });
  const r = decodeSave(text, tryLoad);
  assert.ok(r.ok, r.error);
  assert.equal(r.data.v, SAVE_VERSION);
  assert.deepEqual(r.data.log, ['x']);
  const h = createGame({ seed: 99 });
  assert.equal(h.restore(r.data.game), true);
  assert.deepEqual(h.snapshot(), g.snapshot());
  // 続きを遊んでも同じ結果になる（乱数の状態も戻る）
  g.advance(DAY * 3); h.advance(DAY * 3);
  assert.deepEqual(h.snapshot(), g.snapshot());
});

test('版番号: 古い版（1）のセーブも、新しい版に直して読める', () => {
  const g = played(2);
  const old = g.snapshot();
  old.v = 1;
  for (const k of ['xp', 'recipes', 'regions', 'tane', 'wisdom', 'claimer', 'claim', 'stock', 'staff', 'contracts', 'seed', 'story']) delete old[k]; // 段階Cより前の形
  assert.equal(migrateSnapshot(old).v, SAVE_VERSION);
  const r = decodeSave(JSON.stringify({ format: 'tsukemono-save', v: 1, game: old }), tryLoad);
  assert.ok(r.ok, r.error);
  assert.equal(r.migrated, true);
  const h = createGame();
  assert.equal(h.restore(r.data.game), true);
  assert.equal(h.money, g.money);
  assert.equal(h.recipeState('hakusaizuke') !== 'unknown', true);
  assert.deepEqual(h.staff, []); // 無かった項目は初期値
});

test('壊れたセーブは安全に扱う（読めない・形が違う・新しすぎる版）。今の店はそのまま', () => {
  const g = played(3);
  const before = JSON.stringify(g.snapshot());
  const bad = [
    '{"format":"tsukemono-save", "v": 2, "game": {"v": 2, "tick": ',
    'ただの文章',
    JSON.stringify({ hello: 1 }),
    JSON.stringify({ format: 'tsukemono-save', v: 2, game: { v: 2, tick: -5, money: 'たくさん' } }),
    JSON.stringify({ format: 'tsukemono-save', v: 9, game: { ...g.snapshot(), v: 9 } }),
    JSON.stringify({ format: 'tsukemono-save', v: 2, game: { ...g.snapshot(), barrels: [{ veg: 'unknown', pickle: 'x' }, null, null] } }),
  ];
  for (const text of bad) {
    const r = decodeSave(text, tryLoad);
    assert.equal(r.ok, false, text.slice(0, 40));
    assert.ok(r.error.length > 0);
  }
  assert.match(decodeSave(bad[4], tryLoad).error, /新しい版/);
  // 直接 restore しても、失敗したら何も変わらない
  assert.equal(g.restore({ ...g.snapshot(), barrels: 'こわれた' }), false);
  assert.equal(g.restore(null), false);
  assert.equal(JSON.stringify(g.snapshot()), before);
});

test('知らない項目（後の版で消えた漬物・野菜など）は、読みとばして続けられる', () => {
  const g = played(4);
  const s = g.snapshot();
  s.book['なぞの漬物:なぞ'] = { best: 50, day: 1, n: 1 };
  s.recipes.nazozuke = { via: 'start', day: 1, made: 3 };
  s.stock.nazo = [{ n: 6, day: 1 }];
  s.staff.push('nazo');
  const h = createGame();
  assert.equal(h.restore(s), true);
  assert.equal(h.recipes.nazozuke, undefined);
  assert.equal(h.stock.nazo, undefined);
  assert.ok(!h.staff.includes('nazo'));
});

test('店の名前: 決めた名前はセーブに入り、使えない文字は落ち、長すぎれば切れ、空や古いセーブは決まった名前', () => {
  const g = createGame({ seed: 3 });
  assert.equal(g.shopTitle(), `${SHOP_NAME_DEFAULT}漬物店`);
  assert.equal(g.setShopName(' 山田 '), '山田');
  const h = createGame({ seed: 4 });
  const d = decodeSave(encodeSave(g), (s) => createGame({ seed: 5 }).restore(s));
  assert.ok(d.ok); assert.ok(h.restore(d.data.game)); assert.equal(h.shopTitle(), '山田漬物店');
  assert.equal(cleanShopName('<b>ぬか</b>'), 'bぬか/b');
  assert.equal(cleanShopName('一二三四五六七八'), '一二三四五六');
  assert.equal(g.setShopName('   '), SHOP_NAME_DEFAULT);
  const old = g.snapshot(); delete old.shopName; h.setShopName('x'); assert.ok(h.restore(old)); assert.equal(h.shopName, SHOP_NAME_DEFAULT);
});
