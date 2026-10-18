import test from 'node:test';
import assert from 'node:assert/strict';
import { CONFIG } from '../src/config.js';
import { PICKLES, picklesFrom } from '../data/pickles.js';
import { createGame } from '../src/game.js';
import { unmet, levelOf, nextLevelXp } from '../src/unlock.js';

const lv = (n) => CONFIG.levels.find((l) => l.level === n).xp;
const DAY = CONFIG.calendar.ticksPerDay;

test('レベル: 経験で上がり、最後のレベルの先も終わりなく上がる', () => {
  assert.equal(levelOf(0).level, 1);
  assert.equal(levelOf(lv(2) - 1).level, 1);
  assert.equal(levelOf(lv(2)).level, 2);
  const last = CONFIG.levels.at(-1);
  assert.equal(levelOf(last.xp + CONFIG.levelAfterLast * 2).level, last.level + 2);
  assert.equal(nextLevelXp(0), lv(2));
});

test('レベル: 上げると枠が開く（設備・樽）', () => {
  const g = createGame({ seed: 1 });
  g.money = 1e6;
  assert.equal(g.buyPlace('kaon').ok, false); // 加温室はレベル4から
  assert.match(g.buyPlace('kaon').error, /レベル4/);
  assert.equal(g.buyPlace('tsubo').ok, false); // 壺はレベル2から
  assert.equal(g.buyBarrel().ok, true); // 4つ目まではレベル1でも置ける
  assert.equal(g.buyBarrel().ok, false);
  g.addXp(lv(4));
  assert.equal(g.level().level, 4);
  assert.equal(g.buyPlace('tsubo').ok, true);
  assert.equal(g.buyPlace('kaon').ok, true);
  assert.equal(g.placeTemp('kaon'), 40);
  assert.equal(g.buyBarrel().ok, true);
  assert.equal(g.buyPlace('kunsei').ok, false); // 燻製小屋はレベル5から
  const ev = g.popEvents().filter((e) => e.type === 'levelup');
  assert.equal(ev.at(-1).level, 4);
  assert.ok(ev.at(-1).title && ev.at(-1).line);
});

test('経験: 売ると経験がたまってレベルが上がり、成功すると図鑑が埋まって作り方が磨かれる', () => {
  const g = createGame({ seed: 3 });
  assert.equal(g.recipeState('hakusaizuke'), 'known'); // はじめから知っている（まだ成功していない）
  let made = 0;
  for (let i = 0; i < 200 && made < 2; i++) {
    if (!g.barrels[0]) g.brew(0, { veg: 'hakusai', pickle: 'hakusaizuke', saltPct: 3, tempC: 20 });
    g.advance(1);
    if (g.isOpen() && g.tasteOf(0)?.stage === 'ripe') { g.weather = 'sunny'; g.sell(0); }
    made = g.recipes.hakusaizuke.made;
    if (!g.barrels[0] || g.barrels[0].succeeded) { g.barrels[0] = null; }
  }
  assert.ok(g.xp > 0);
  assert.ok(made >= 1, '成功した');
  assert.equal(g.recipeState('hakusaizuke'), 'learned');
  assert.ok(g.popEvents().some((e) => e.type === 'learned' && e.pickle === 'hakusaizuke'));
  // 腕前が上がると、同じ条件でも風味が深くなる
  g.brew(1, { veg: 'hakusai', pickle: 'hakusaizuke', saltPct: 3, tempC: 20 });
  g.advance(DAY * 7);
  const before = g.tasteOf(1).complexity;
  g.recipes.hakusaizuke.made = CONFIG.progress.masterAfter;
  assert.ok(g.tasteOf(1).complexity > before);
});

test('ひらめき: 条件の組み合わせ（なす＋からし）で、図鑑の「？」が開く', () => {
  const g = createGame({ seed: 2 });
  assert.equal(g.recipeState('karashizuke'), 'unknown');
  assert.equal(g.brew(0, { veg: 'nasu', pickle: 'karashizuke', saltPct: 3, tempC: 15 }).ok, false); // 知らない作り方は仕込めない
  g.brew(0, { veg: 'nasu', pickle: 'asazuke', saltPct: 2.5, tempC: 15, additives: ['karashi'] });
  g.advance(DAY - 1);
  assert.equal(g.recipeState('karashizuke'), 'unknown'); // まだ1日たっていない
  g.advance(1);
  assert.equal(g.recipeState('karashizuke'), 'known');
  const ev = g.popEvents().find((e) => e.type === 'inspire');
  assert.equal(ev.pickle, 'karashizuke');
  assert.equal(ev.tooEarly, 2); // ひらめいたが、レベル2で挑める
  assert.ok(g.xp >= CONFIG.progress.xpInspire);
});

test('二重の鍵: 条件が合ってひらめいても、レベルが足りなければ挑めない', () => {
  const g = createGame({ seed: 5 });
  g.brew(0, { veg: 'daikon', pickle: 'takuan', saltPct: 5, tempC: 10, additives: ['sakekasu'] });
  g.advance(DAY * 10);
  assert.equal(g.recipeState('kasuzuke'), 'known');
  assert.equal(g.level().level < 3, true);
  const r = g.brew(1, { veg: 'kyuri', pickle: 'kasuzuke', saltPct: 4, tempC: 10 });
  assert.equal(r.ok, false);
  assert.match(r.error, /レベル3/);
  g.addXp(lv(3));
  assert.equal(g.brew(1, { veg: 'kyuri', pickle: 'kasuzuke', saltPct: 4, tempC: 10 }).ok, true);
});

test('季節の条件: 柴漬けは夏のなす＋赤しそでだけひらめく', () => {
  const g = createGame({ seed: 6 });
  g.brew(0, { veg: 'nasu', pickle: 'asazuke', saltPct: 2.5, tempC: 15, additives: ['akajiso'] });
  g.advance(DAY * 3);
  assert.equal(g.season(), 'spring');
  assert.equal(g.recipeState('shibazuke'), 'unknown');
  // あと一歩（季節だけ合わない）は、樽ごとに1回だけ知らせる
  const almost = g.popEvents().filter((e) => e.type === 'almost' && e.pickle === 'shibazuke');
  assert.equal(almost.length, 1);
  assert.equal(almost[0].missing, 'season');
  g.barrels[0] = null;
  g.tick = CONFIG.calendar.daysPerSeason * DAY; // 夏の1日目
  g.brew(0, { veg: 'nasu', pickle: 'asazuke', saltPct: 2.5, tempC: 15, additives: ['akajiso'] });
  g.advance(DAY * 2);
  assert.equal(g.season(), 'summer');
  assert.equal(g.recipeState('shibazuke'), 'known');
});

test('失敗から発見: 酸っぱくなりすぎると古漬けに気づく', () => {
  const g = createGame({ seed: 7 });
  g.brew(0, { veg: 'hakusai', pickle: 'hakusaizuke', saltPct: 3, tempC: 20 });
  g.advance(DAY * 10);
  assert.equal(g.recipeState('furuzuke'), 'unknown');
  g.advance(DAY * 5);
  assert.equal(g.tasteOf(0).stage, 'sour');
  assert.equal(g.recipeState('furuzuke'), 'known');
  assert.equal(g.recipes.furuzuke.via, 'failure');
});

test('教わる経路の枠: learn で覚えられる（中身は段階G）', () => {
  const g = createGame();
  assert.equal(g.learn('kasuzuke', 'taught', 'ばあちゃんが教えてくれた'), true);
  assert.equal(g.learn('kasuzuke', 'taught'), false); // 2回目は何も起きない
  assert.equal(g.recipes.kasuzuke.via, 'taught');
});

test('データで足せる: 解放の条件つきの定義を1件足すと、その条件でひらめく', () => {
  const def = {
    id: 'kabuzuke', name: 'ためしのかぶ漬け', vegetables: ['kabu'], steps: ['かぶを漬ける'], saltHint: '1%', tempHint: '冷蔵', ripeAt: 1, window: { lo: 0.5, hi: 2, sour: 3 }, complexityMax: 40, price: 300,
    level: 1, unlock: { via: 'condition', hint: '冷やしたかぶの噂', when: { veg: ['kabu'], place: ['fridge'], salt: { max: 1.5 } }, line: 'ひらめいた' },
  };
  const cfg = { ...CONFIG, ...picklesFrom([...PICKLES, def]) };
  const g = createGame({ cfg });
  g.money = 1e5;
  g.buyPlace('fridge');
  g.brew(0, { veg: 'kabu', pickle: 'asazuke', saltPct: 2, place: 'fridge' });
  g.brew(1, { veg: 'kabu', pickle: 'asazuke', saltPct: 1, place: 'doma' });
  g.advance(1);
  assert.equal(g.recipeState('kabuzuke'), 'unknown');
  g.brew(2, { veg: 'kabu', pickle: 'asazuke', saltPct: 1, place: 'fridge' });
  g.advance(1);
  assert.equal(g.recipeState('kabuzuke'), 'known');
  assert.equal(g.brew(0, { veg: 'kabu', pickle: 'kabuzuke', saltPct: 1, place: 'fridge' }).ok, false); // 樽0は使用中
  assert.throws(() => picklesFrom([...PICKLES, { ...def, unlock: { via: 'magic', hint: 'x', when: {} } }]), /unlock.via/);
});

test('条件の判定: 合わない項目だけを返す', () => {
  const ctx = { pickle: 'asazuke', veg: 'nasu', additives: ['karashi'], saltPct: 0, place: 'doma', tempC: 12, season: 'winter', days: 3, stage: 'ripe', owned: ['doma'] };
  assert.deepEqual(unmet({ veg: ['nasu'], additives: ['karashi'], salt: { max: 0 }, days: { min: 2 } }, ctx), []);
  assert.deepEqual(unmet({ veg: ['kabu'], season: ['summer'], facility: 'kunsei', temp: { min: 30 } }, ctx), ['veg', 'facility', 'season', 'temp']);
});

test('セーブ: 経験と作り方が残る。古いセーブは図鑑から成功を補う', () => {
  const g = createGame({ seed: 9 });
  g.addXp(100); g.learn('shibazuke'); g.recipes.asazuke.made = 4;
  const h = createGame({ seed: 1 });
  assert.equal(h.restore(g.snapshot()), true);
  assert.equal(h.xp, g.xp);
  assert.equal(h.recipeState('shibazuke'), 'known');
  assert.equal(h.recipes.asazuke.made, 4);
  const old = g.snapshot(); delete old.xp; delete old.recipes; old.book = { 'takuan:daikon': { best: 80, day: 3, n: 2 } };
  const k = createGame();
  assert.equal(k.restore(old), true);
  assert.equal(k.xp, 0);
  assert.equal(k.recipeState('takuan'), 'learned');
  assert.equal(k.recipeState('shibazuke'), 'unknown');
});
