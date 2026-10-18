import test from 'node:test';
import assert from 'node:assert/strict';
import { CONFIG } from '../src/config.js';
import { createGame } from '../src/game.js';
import { simulate } from '../src/model.js';

const DAY = CONFIG.calendar.ticksPerDay;
const SEASON = CONFIG.calendar.daysPerSeason;
const lv = (n) => CONFIG.levels.find((l) => l.level === n).xp;
/** 店のレベル n・お金たっぷり・指定の季節の1日目 */
function shop(n, season = 'spring', seed = 1) {
  const g = createGame({ seed });
  g.money = 1e6; g.addXp(lv(n));
  g.tick = CONFIG.calendar.seasons.indexOf(season) * SEASON * DAY;
  g.popEvents();
  return g;
}

test('地方の漬物（特別な決まりのあるもの）は4つ。条件でひらめき、レベルと地方の枠がそろうまで挑めない', () => {
  const regional = Object.entries(CONFIG.pickles).filter(([, p]) => p.region && p.unlock.via !== 'letter').map(([id]) => id);
  assert.deepEqual(regional.sort(), ['heshiko', 'iburigakko', 'sugukizuke', 'sunki']);
  for (const id of regional) {
    const g = shop(7);
    assert.equal(g.canBrew(id).ok, false); // まだ知らない
    g.learn(id);
    if (CONFIG.pickles[id].needs.length) assert.match(g.canBrew(id).error, /がいります/);
  }
  assert.ok(!Object.keys(CONFIG.pickles).includes('fugunoko')); // ふぐの子糠漬けは入れていない
});

test('地方の枠: レベル3で1つ。枠がいっぱいだと、ひらめいても挑めない', () => {
  const g = shop(3);
  assert.equal(g.regionSlots(), 1);
  g.learn('sunki');
  assert.deepEqual(g.regions, ['北陸・甲信・岐阜']); // 空いていたので入った
  g.learn('heshiko'); // 同じ地方なので、そのまま挑める
  g.buyContract('saba');
  assert.equal(g.canBrew('heshiko').ok, true);
  g.addXp(lv(5)); g.buyPlace('kunsei'); g.popEvents();
  g.wisdom.joined = true; g.regions = ['北陸・甲信・岐阜', '関東', '東海・近畿']; // 枠（Lv5で3つ）をいっぱいにする
  g.learn('iburigakko'); // 北海道・東北
  assert.match(g.canBrew('iburigakko').error, /地方の枠/);
  assert.match(g.openRegion('北海道・東北').error, /いっぱい/);
  g.addXp(lv(6));
  assert.equal(g.openRegion('北海道・東北').ok, true);
  assert.equal(g.canBrew('iburigakko').ok, true);
});

test('すんき: 秋冬に赤かぶを塩をひかえて漬けるとひらめき、種が届く。塩は使わず、種を使う', () => {
  const g = shop(3, 'autumn');
  g.buyContract('akakabu');
  g.brew(0, { veg: 'akakabu', pickle: 'asazuke', saltPct: 1, tempC: 8 });
  g.advance(DAY * 3);
  assert.equal(g.recipeState('sunki'), 'known');
  assert.equal(g.tane.sunki, 1);
  const r = g.brew(1, { veg: 'akakabu', pickle: 'sunki', saltPct: 3, tempC: 5 });
  assert.ok(r.ok, r.error);
  assert.equal(g.barrels[1].saltPct, 0);
  assert.equal(g.tane.sunki, 0);
  assert.match(g.brew(2, { veg: 'akakabu', pickle: 'sunki', saltPct: 0, tempC: 5 }).error, /種/);
  // 塩なしでも、種の乳酸菌で傷みにくい（種なしの塩なし浅漬けとくらべて）
  const sunki = simulate({ veg: 'akakabu', pickle: 'sunki', saltPct: 0, tempC: 5, days: 30 });
  const raw = simulate({ veg: 'akakabu', pickle: 'asazuke', saltPct: 0, tempC: 5, days: 30 });
  assert.ok(sunki.spoilRisk < raw.spoilRisk / 5);
  assert.equal(sunki.saltiness, 0);
});

test('すんき: うまくできた樽から次の種を取り分ける。種が絶えても冬のはじめに届く', () => {
  const g = shop(3, 'autumn');
  g.learn('sunki'); g.buyContract('akakabu');
  g.brew(0, { veg: 'akakabu', pickle: 'sunki', saltPct: 0, tempC: 5, count: 60 });
  g.barrels[0].startTick -= 30 * DAY;
  g.questOnSale = () => false;
  let got = false;
  for (let i = 0; i < 12 && !got; i++) { g.weather = 'sunny'; if (g.isOpen()) g.sell(0); got = g.tane.sunki > 0; g.advance(1); }
  assert.ok(got, '種が取れた');
  const h = shop(3, 'autumn');
  h.learn('sunki'); h.tane.sunki = 0;
  h.tick = (SEASON * 3) * DAY - 1; // 冬の前の晩
  h.advance(1);
  assert.equal(h.tane.sunki, 1);
});

test('いぶりがっこ: 燻製小屋がいる。薪と日数で香りが変わり、燻しすぎるとえぐい', () => {
  const g = shop(5, 'autumn');
  g.learn('iburigakko');
  assert.match(g.canBrew('iburigakko').error, /燻製小屋/);
  g.buyPlace('kunsei');
  const r = g.brew(0, { veg: 'daikon', pickle: 'iburigakko', saltPct: 6, tempC: 5, smoke: { days: 5, wood: 'sakura' } });
  assert.ok(r.ok, r.error);
  assert.equal(g.barrels[0].dry, 5); // 燻すあいだ樽はふさがる
  assert.equal(g.brew(1, { veg: 'daikon', pickle: 'iburigakko', saltPct: 6, tempC: 5, smoke: { days: 9, wood: 'nara' } }).ok, false);
  const t = (wood, days) => simulate({ veg: 'daikon', pickle: 'iburigakko', saltPct: 6, tempC: 5, days: 60, dry: days, smoke: { days, wood } }).complexity;
  assert.ok(t('sakura', 4) > t('kunugi', 4));
  assert.ok(t('nara', 4) > t('nara', 1));
  assert.ok(t('nara', 8) < t('nara', 5), '燻しすぎ');
});

test('すぐき漬け: 加温室で漬ける。温度管理が主役（40℃前後がいちばん）', () => {
  const g = shop(4, 'winter');
  g.learn('sugukizuke');
  g.buyContract('suguki');
  assert.match(g.canBrew('sugukizuke').error, /加温室/);
  g.buyPlace('kaon');
  assert.equal(g.brew(0, { veg: 'suguki', pickle: 'sugukizuke', saltPct: 3.5, kaonTemp: 60 }).ok, false);
  const r = g.brew(0, { veg: 'suguki', pickle: 'sugukizuke', saltPct: 3.5, place: 'doma', kaonTemp: 40 });
  assert.ok(r.ok, r.error);
  assert.equal(g.barrels[0].place, 'kaon');
  assert.equal(g.barrels[0].tempC, 40);
  const cx = (tempC) => simulate({ veg: 'suguki', pickle: 'sugukizuke', saltPct: 3.5, tempC, days: 15 }).complexity;
  assert.ok(cx(40) > cx(32) && cx(40) > cx(45));
});

test('へしこ: 鯖を塩でたっぷり漬けて、季節をまたいで約1年。塩が少ないと傷みやすい', () => {
  const g = shop(3, 'spring');
  g.buyContract('saba');
  g.brew(0, { veg: 'kyuri', pickle: 'nukazuke', saltPct: 0, tempC: 20 });
  g.advance(DAY * 2);
  assert.equal(g.recipeState('heshiko'), 'known'); // 鯖の契約＋ぬか床でひらめく
  g.addXp(lv(4));
  g.barrels[0] = null;
  assert.ok(g.brew(0, { veg: 'saba', pickle: 'heshiko', saltPct: 15, place: 'doma' }).ok);
  const t0 = g.barrels[0].tempC;
  g.advance(DAY * SEASON); // 夏を越える
  g.advance(DAY * 10);
  assert.ok(g.barrels[0].tempC > t0, `${t0} → ${g.barrels[0].tempC}（夏で平均が上がる）`);
  const hi = simulate({ veg: 'saba', pickle: 'heshiko', saltPct: 15, tempC: 14, days: 100 });
  const lo = simulate({ veg: 'saba', pickle: 'heshiko', saltPct: 7, tempC: 14, days: 100 });
  assert.ok(lo.spoilRisk > hi.spoilRisk * 2);
  assert.ok(hi.stage !== 'raw' || hi.ratio > 0.7, 'だいたい1年（112日）で食べ頃');
});

test('セーブ: 地方の枠と種が残る', () => {
  const g = shop(3);
  g.learn('sunki');
  const h = createGame();
  assert.equal(h.restore(g.snapshot()), true);
  assert.deepEqual(h.regions, ['北陸・甲信・岐阜']);
  assert.equal(h.tane.sunki, 1);
});
