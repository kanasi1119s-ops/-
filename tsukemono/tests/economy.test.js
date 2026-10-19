import test from 'node:test';
import assert from 'node:assert/strict';
import { CONFIG } from '../src/config.js';
import { createGame } from '../src/game.js';
import { agingFactor } from '../src/business.js';

const DAY = CONFIG.calendar.ticksPerDay;
const SEASON_DAYS = CONFIG.calendar.daysPerSeason;
const toDay = (g, day) => { while (g.day() < day) g.advance(1); };
const lv = (n) => CONFIG.levels.find((l) => l.level === n).xp;

test('相場: 日ごとに揺れ、同じ日なら何度見ても同じ。特売の日は安い', () => {
  const g = createGame({ seed: 3 });
  const prices = [];
  let sale = null;
  for (let d = 1; d <= 30; d++) {
    prices.push(g.marketFactor('kyuri', d));
    assert.equal(g.marketFactor('kyuri', d), g.marketFactor('kyuri', d));
    const s = g.saleVeg(d);
    if (s && !sale) sale = { d, s };
  }
  assert.ok(new Set(prices.map((p) => p.toFixed(3))).size > 20, '毎日違う');
  assert.ok(sale, '30日のうちに特売の日がある');
  const season = CONFIG.calendar.seasons[Math.floor((sale.d - 1) / SEASON_DAYS) % 4];
  assert.ok(g.marketFactor(sale.s, sale.d) <= CONFIG.market.priceBySeason[sale.s][season] * (1 + CONFIG.market.dailyNoise) * CONFIG.market.saleFactor + 1e-9);
});

test('行事: たくあんの仕込みどきは大根が安く、正月は客が多くて高く売れる', () => {
  const g = createGame({ seed: 4 });
  const autumn21 = SEASON_DAYS * 2 + 21, winter11 = SEASON_DAYS * 3 + 11;
  assert.equal(g.event(autumn21).id, 'takuanDoki');
  assert.equal(g.event(winter11).id, 'shogatsu');
  assert.equal(g.event(3), null);
  // 大根の倍率は、行事のない前後の日より低い
  assert.ok(g.marketFactor('daikon', autumn21) < CONFIG.market.priceBySeason.daikon.autumn * (1 - CONFIG.market.dailyNoise) + 1e-9 || g.saleVeg(autumn21) === 'daikon');
  // 正月: 同じ漬物を、正月と行事のない日に売り比べる
  const sellOn = (day) => {
    let total = 0, visits = 0;
    for (let seed = 1; seed <= 40; seed++) {
      const h = createGame({ seed });
      h.tick = (day - 1) * DAY + 1; // 昼
      h.weather = 'sunny'; h.money = 1e6;
      h.brew(0, { veg: 'daikon', pickle: 'takuan', saltPct: 5, tempC: 20, count: 60, dry: 0 });
      h.barrels[0].startTick -= 60 * DAY; // 寝かせ済み（干す日は天気しだいなので、干さずに）
      const r = h.sell(0);
      total += r.revenue; visits += r.visitors.length;
    }
    return { total, visits };
  };
  const plain = sellOn(SEASON_DAYS * 3 + 20), ny = sellOn(winter11);
  assert.ok(ny.visits > plain.visits, `客 ${ny.visits} > ${plain.visits}`);
  assert.ok(ny.total > plain.total * 1.2, `売上 ${ny.total} > ${plain.total}`);
});

test('仕入れ: 在庫を先に使うと野菜代がかからず、古い野菜は品質が落ち、やがて傷んで捨てる', () => {
  const g = createGame({ seed: 5 });
  g.money = 1e5;
  const r = { veg: 'kyuri', pickle: 'asazuke', saltPct: 2.5, tempC: 15, count: 12 };
  const full = g.brewCost(r);
  assert.equal(g.buyStock('kyuri', 12).ok, true);
  assert.equal(g.stockCount('kyuri'), 12);
  assert.ok(g.brewCost(r) < full, '在庫ぶん安い');
  g.brew(0, r);
  assert.equal(g.stockCount('kyuri'), 0);
  assert.equal(g.barrels[0].fromStock, 12);
  // 鮮度
  g.buyStock('nasu', 6);
  const q0 = g.vegQuality('nasu');
  g.advance(DAY * 5);
  g.brew(1, { veg: 'nasu', pickle: 'asazuke', saltPct: 2.5, tempC: 15, count: 6 });
  assert.ok(g.barrels[1].quality < g.vegQuality('nasu') && q0 > 0);
  // 傷んで捨てる
  g.buyStock('daikon', 6);
  g.advance(DAY * (CONFIG.stock.spoilDays + 1));
  assert.equal(g.stockCount('daikon'), 0);
  assert.ok(g.popEvents().some((e) => e.type === 'stockSpoiled'));
});

test('新しい野菜: 赤かぶは農家と契約するまで使えない（レベル2から）', () => {
  const g = createGame({ seed: 6 });
  g.money = 1e5;
  const r = { veg: 'akakabu', pickle: 'asazuke', saltPct: 2.5, tempC: 15 };
  assert.equal(g.brew(0, r).ok, false);
  assert.equal(g.buyStock('akakabu', 6).ok, false);
  assert.match(g.buyContract('akakabu').error, /レベル2/);
  g.addXp(lv(2));
  assert.equal(g.buyContract('akakabu').ok, true);
  assert.equal(g.brew(0, r).ok, true);
});

test('寝かせると値打ちが上がる: たくあんは長く置くほど高く売れる', () => {
  const t = CONFIG.pickles.takuan;
  assert.equal(agingFactor(t, 1), 1);
  assert.ok(agingFactor(t, 2) > 1);
  assert.equal(agingFactor(t, 10), 1 + t.aging.max);
  assert.equal(agingFactor(CONFIG.pickles.asazuke, 3), 1);
});

test('維持費: 毎朝かかり、お金はマイナスにならない（払えない分は大家さんが待ってくれる）', () => {
  const g = createGame({ seed: 7 });
  const m = g.money;
  g.advance(DAY);
  assert.equal(g.money, m - g.upkeep());
  g.brew(0, { veg: 'kyuri', pickle: 'asazuke', saltPct: 2.5, tempC: 20 }); // 樽に仕込みがあれば、大家さんの助けはない
  g.money = 10;
  g.advance(DAY);
  assert.equal(g.money, 0);
  assert.ok(g.popEvents().some((e) => e.type === 'upkeepShort'));
});

test('お金が尽きて樽も棚も空の朝は、大家さんがいちばん安い仕込みの代金を出してくれる（詰まない）', () => {
  const g = createGame({ seed: 7 });
  g.money = 0;
  g.advance(DAY);
  const ev = g.popEvents().find((e) => e.type === 'rescue');
  assert.ok(ev);
  assert.ok(g.money >= g.cheapestBrew());
  const empty = g.barrels.findIndex((b) => !b);
  const veg = Object.keys(CONFIG.vegetables).filter((v) => g.vegAvailable(v)).sort((a, b) => g.brewCost({ veg: a, saltPct: 2 }) - g.brewCost({ veg: b, saltPct: 2 }))[0];
  assert.ok(g.brew(empty, { veg, pickle: 'asazuke', saltPct: 2, tempC: 20 }).ok, '借りたお金で仕込める');
  g.money = 0;
  g.advance(DAY);
  assert.ok(!g.popEvents().some((e) => e.type === 'rescue'), '仕込みがあるあいだは出さない');
});

test('従業員: アルバイトは毎朝ぬか床をかき混ぜ膜を取る。お給料を払えないと辞める', () => {
  const g = createGame({ seed: 8 });
  g.money = 1e5;
  assert.equal(g.hire('kanban').ok, false); // レベル3から
  assert.equal(g.hire('baito').ok, true);
  g.brew(0, { veg: 'hakusai', pickle: 'hakusaizuke', saltPct: 3, tempC: 25 });
  const m = g.money;
  g.advance(DAY * 6);
  assert.equal(g.nuka.lastStirDay, g.day());
  assert.ok(g.barrels[0].film < CONFIG.care.filmVisible);
  assert.ok(g.nuka.maturity > 0.3);
  assert.equal(m - g.money, 6 * (g.upkeep() + CONFIG.upkeep.base * 0 + 250));
  g.money = 0;
  g.advance(DAY);
  assert.deepEqual(g.staff, []);
  assert.ok(g.popEvents().some((e) => e.type === 'staffQuit'));
});

test('従業員: 看板店員がいるとお客が増える', () => {
  const count = (hire) => {
    let n = 0;
    for (let seed = 1; seed <= 60; seed++) {
      const g = createGame({ seed });
      g.money = 1e5; g.addXp(lv(3)); g.reputation = 20;
      if (hire) g.hire('kanban');
      g.brew(0, { veg: 'kyuri', pickle: 'asazuke', saltPct: 2.5, tempC: 20, count: 60 });
      g.advance(5); g.weather = 'rain';
      n += g.sell(0).visitors.filter((v) => !v.claimer).length;
    }
    return n;
  };
  assert.ok(count(true) > count(false) * 1.1);
});

test('客の年代と減塩の流れ: 若い人ほど薄味好き、年がたつと若い人が増えて、みんな塩を控える', () => {
  const g = createGame({ seed: 9 });
  assert.ok(g.saltShift('young') < g.saltShift('middle') && g.saltShift('middle') < g.saltShift('old'));
  const y1 = g.ageShares(), s1 = g.saltShift('middle');
  g.tick = SEASON_DAYS * 4 * 3 * DAY; // 4年目
  assert.equal(g.year(), 4);
  assert.ok(g.ageShares().young > y1.young);
  assert.equal(g.saltShift('middle'), s1 + Math.max(CONFIG.trend.saltMin, CONFIG.trend.saltPerYear * 3));
});

test('常連の物語: とても満足させるたびに絆が深まり、章が開くと評判が上がる', () => {
  const g = createGame({ seed: 10 });
  const r = { id: 1, type: 'salty', look: 1, visits: 3, misses: 0, since: 1, name: '山田さん', age: 'old', bond: 0, chapters: [] };
  g.regulars.push(r);
  const rep = g.reputation;
  assert.equal(g.deepenBond(r), null);
  const st = g.deepenBond(r);
  assert.equal(st.title, '晩酌');
  assert.equal(g.reputation, rep + CONFIG.bond.storyRep);
  assert.deepEqual(r.chapters, [2]);
  assert.ok(g.popEvents().some((e) => e.type === 'story'));
});

test('行商人: 決まった日に来て、まだ知らない作り方を売ってくれる', () => {
  const g = createGame({ seed: 11 });
  assert.equal(g.peddlerOffer(), null);
  toDay(g, CONFIG.peddler.onDay);
  const o = g.peddlerOffer();
  assert.ok(o && !g.knows(o.pickle));
  g.money = 1e5;
  assert.equal(g.buyRecipe().ok, true);
  assert.equal(g.recipes[o.pickle].via, 'bought');
});

test('セーブ: 在庫・従業員・契約が残る', () => {
  const g = createGame({ seed: 12 });
  g.money = 1e5; g.addXp(lv(2));
  g.buyStock('kyuri', 10); g.hire('baito'); g.buyContract('akakabu');
  const h = createGame();
  assert.equal(h.restore(g.snapshot()), true);
  assert.equal(h.stockCount('kyuri'), 10);
  assert.deepEqual(h.staff, ['baito']);
  assert.deepEqual(h.contracts, ['akakabu']);
  assert.equal(h.vegCost('kyuri'), g.vegCost('kyuri'));
});

test('やりくり: 1年遊んでも、お金が尽きたり無限に増えたりしない（崩壊・無限増殖がない）', () => {
  for (const seed of [1, 2, 3]) {
    const g = createGame({ seed });
    const half = [];
    let minMoney = Infinity;
    while (g.day() <= SEASON_DAYS * 4) {
      g.barrels.forEach((b, i) => {
        if (b) return;
        const p = i === 0 ? { veg: 'kyuri', pickle: 'asazuke', saltPct: 2.5, place: 'doma' } : { veg: 'hakusai', pickle: 'hakusaizuke', saltPct: 3, place: 'doma' };
        if (g.brewCost(p) <= g.money) g.brew(i, p);
      });
      if (g.timeOfDay() === 'morning') { g.stirNuka(); g.barrels.forEach((b, i) => { if (b && b.film > 0.2) g.care(i); }); }
      if (g.isOpen()) {
        const ready = g.barrels.map((b, i) => ({ i, t: b && g.tasteOf(i) })).filter((x) => x.t && x.t.stage !== 'raw').sort((a, b) => b.t.ratio - a.t.ratio);
        if (ready.length) g.sell(ready[0].i);
        if (g.claim) g.respondClaim('explain');
      }
      if (g.money > 20000 && g.barrels.length < g.barrelMax()) g.buyBarrel();
      g.advance(1);
      minMoney = Math.min(minMoney, g.money);
      if (g.tick % (SEASON_DAYS * 2 * DAY) === 0) half.push(g.money);
    }
    const [m1, m2] = half;
    assert.ok(minMoney >= 0, `お金がマイナス: ${minMoney}`);
    assert.ok(m1 > CONFIG.sales.startMoney * 0.5, `半年で ${m1}円`);
    assert.ok(m2 - m1 < 4 * Math.max(1, m1 - CONFIG.sales.startMoney) + 50000, `増え方が急すぎる: ${m1} → ${m2}`);
    assert.ok(g.reputation > 20, `評判 ${g.reputation}`);
  }
});
