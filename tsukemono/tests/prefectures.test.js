import test from 'node:test';
import assert from 'node:assert/strict';
import { CONFIG, REGIONAL_PICKLES } from '../src/config.js';
import { createGame } from '../src/game.js';
import { simulate } from '../src/model.js';
import { PREFECTURE_PICKLES, REGIONS } from '../data/prefectures.js';
import { NOT_PLAYABLE, REAL_TO_GAME } from '../data/regional.js';

const DAY = CONFIG.calendar.ticksPerDay;
const lv = (n) => CONFIG.levels.find((l) => l.level === n).xp;
const rich = (n = 7, seed = 1) => { const g = createGame({ seed }); g.money = 1e7; g.addXp(lv(n)); g.popEvents(); return g; };
const mid = (r) => (r.lo + r.hi) / 2;

test('資料: 47都道府県・84件がそのまま入っていて、参考でないものはすべて遊べる（ふぐの子だけは伝説）', () => {
  assert.equal(PREFECTURE_PICKLES.length, 84);
  assert.equal(new Set(PREFECTURE_PICKLES.map((d) => d.prefecture)).size, 47);
  assert.ok(PREFECTURE_PICKLES.every((d) => REGIONS.includes(d.region) && d.source));
  const refs = Object.values(CONFIG.pickles).map((p) => p.ref).filter(Boolean);
  assert.equal(new Set(refs).size, refs.length, '同じ資料を2つの漬物に使っていない');
  for (const d of PREFECTURE_PICKLES) {
    if (d.is_reference) assert.ok(!refs.includes(d.id), `${d.name}は参考なので作れない`);
    else assert.ok(refs.includes(d.id) || NOT_PLAYABLE[d.id], `${d.id} ${d.name}`);
  }
  assert.deepEqual(Object.keys(NOT_PLAYABLE), ['p17-2']);
});

test('全国の漬物: 資料の真ん中の塩・温度で漬けると、資料の日数（ゲームの日数）で食べ頃になる', () => {
  for (const p of REGIONAL_PICKLES) {
    const p0 = CONFIG.pickles[p.id];
    assert.equal(p0.region, PREFECTURE_PICKLES.find((d) => d.id === p.ref).region);
    const days = Math.max(1, p.realDays);
    const t = simulate({ veg: p.vegetables[0], pickle: p.id, saltPct: p.salt ? mid(p.salt) : 7, tempC: mid(p.temp), days }, CONFIG);
    assert.ok(Math.abs(t.ratio - 1) < 1e-6, `${p.name}: ${t.ratio}`);
    assert.ok(p.saltHint && p.tempHint && p.steps.length, p.name);
    if (p.salt) assert.ok(t.saltiness < 110, `${p.name}: 塩味 ${Math.round(t.saltiness)}（食べるときの塩は抑えてある）`);
  }
  assert.equal(REAL_TO_GAME(30), 30);
  assert.equal(REAL_TO_GAME(365), 112); // 1年はゲームの1年（112日）
});

test('便り: 地方の枠に入れた地方からだけ、5日ごとに作り方が届く。その地方の食材も取り寄せられる', () => {
  const g = rich(3);
  assert.match(g.vegLock('nishin'), /北海道・東北/);
  for (let d = 0; d < 12; d++) g.advance(DAY);
  assert.ok(!g.popEvents().some((e) => e.type === 'inspire' && e.via === 'letter'), '枠に入れていなければ届かない');
  assert.equal(g.openRegion('北海道・東北').ok, true);
  assert.equal(g.vegLock('nishin'), null);
  assert.equal(g.buyStock('nishin', 6).ok, true);
  for (let d = 0; d < CONFIG.letterEvery; d++) g.advance(DAY);
  const ev = g.popEvents().filter((e) => e.type === 'inspire' && e.via === 'letter');
  assert.equal(ev.length, 1);
  assert.equal(CONFIG.pickles[ev[0].pickle].region, '北海道・東北');
  assert.equal(g.recipes[ev[0].pickle].via, 'letter');
  assert.ok(ev[0].line.includes('便り'));
});

test('いっしょに要る食材: にしん漬けは、仕入れでニシンをそろえないと漬けられない（お金も減らない）', () => {
  const g = rich();
  g.openRegion('北海道・東北'); g.learn('nishinzuke'); g.popEvents();
  const recipe = { veg: 'daikon', pickle: 'nishinzuke', saltPct: 4, tempC: 5 };
  const m = g.money;
  assert.match(g.brew(0, recipe).error, /身欠きニシンを2個/);
  assert.equal(g.money, m);
  g.buyStock('nishin', 3);
  assert.equal(g.brew(0, recipe).ok, true);
  assert.equal(g.stockCount('nishin'), 1);
  // 福神漬けは七種の材料。割合で個数が決まる
  assert.deepEqual(g.withNeeds('fukujinzuke', 12), [['nasu', 2], ['shirouri', 2], ['kabu', 2]]);
});

test('酢漬けは、発酵しなくても漬けたそばから酸っぱい（acidBase）', () => {
  const su = simulate({ veg: 'akakabu', pickle: 'akakabura_su', saltPct: 4, tempC: 10, days: 1 }, CONFIG);
  const shio = simulate({ veg: 'hakusai', pickle: 'tatamizuke', saltPct: 3, tempC: 10, days: 1 }, CONFIG);
  assert.ok(su.acid > 35 && su.acid > shio.acid * 3, `${su.acid} / ${shio.acid}`);
});

test('季節の食材: 旬の季節だけ取り寄せられる', () => {
  const g = rich();
  g.openRegion('中国・四国');
  assert.equal(g.season(), 'spring');
  assert.equal(g.vegAvailable('olive'), false);
  assert.match(g.vegLock('olive'), /秋だけ/);
  g.tick = 2 * CONFIG.calendar.daysPerSeason * DAY; // 秋
  assert.equal(g.vegAvailable('olive'), true);
});

test('三五八漬け: 床は寝かせてから。覚えて30日たつと漬けられる', () => {
  const g = rich();
  g.openRegion('北海道・東北'); g.learn('sangohachi'); g.popEvents();
  assert.match(g.canBrew('sangohachi').error, /種/);
  for (let d = 0; d < 29; d++) g.advance(DAY);
  assert.equal(g.canBrew('sangohachi').ok, false);
  for (let d = 0; d < 2; d++) g.advance(DAY);
  assert.ok(g.popEvents().some((e) => e.type === 'starterReady'));
  assert.equal(g.canBrew('sangohachi').ok, true);
});

test('全国の漬物はセーブに残る（便りで覚えた作り方と、取り寄せた地方）', () => {
  const g = rich();
  g.openRegion('九州・沖縄'); g.learn('asotakana', 'letter');
  const h = createGame();
  assert.equal(h.restore(g.snapshot()), true);
  assert.equal(h.recipes.asotakana.via, 'letter');
  assert.deepEqual(h.regions, ['九州・沖縄']);
});
