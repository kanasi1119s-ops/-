// ゲームの進行（画面なし）。仕込み→熟成→販売の1周を管理する。
// 乱数は seed 付きで差し替え可能にして、テストで結果を固定できるようにする。
import { CONFIG } from './config.js';
import { simulate } from './model.js';
import { satisfaction, priceFor, reactionOf } from './sales.js';

export function createRng(seed = 1) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const BARREL_COUNT = 3; // 【仮置き】

export function createGame({ seed = 1, rng = createRng(seed), cfg = CONFIG } = {}) {
  const cal = cfg.calendar;
  const g = {
    cfg, rng,
    tick: 0, // 0 = 1日目の朝。1日 = ticksPerDay 区切り。
    money: cfg.sales.startMoney,
    barrels: Array.from({ length: BARREL_COUNT }, () => null),
    weather: 'sunny',
    stats: { revenue: 0, cost: 0, sold: 0, visits: 0, spoiled: 0 },
  };

  const pickWeather = () => {
    const w = cfg.weatherWeights[g.season()];
    const total = Object.values(w).reduce((a, b) => a + b, 0);
    let r = rng() * total;
    for (const k of cal.weathers) { r -= w[k]; if (r < 0) return k; }
    return 'sunny';
  };

  g.day = () => Math.floor(g.tick / cal.ticksPerDay) + 1;
  g.timeOfDay = () => cal.times[g.tick % cal.ticksPerDay];
  g.season = () => cal.seasons[Math.floor((g.day() - 1) / cal.daysPerSeason) % cal.seasons.length];
  g.ambientTemp = () => cfg.season[g.season()].ambientTemp;
  g.isOpen = () => cal.storeOpen[g.timeOfDay()];
  g.barrelAge = (b) => (g.tick - b.startTick) / cal.ticksPerDay; // 日
  g.weather = pickWeather();

  /** 仕込みの費用（円）。 */
  g.brewCost = ({ veg, saltPct }) => cfg.vegetables[veg].cost + Math.round(saltPct * cfg.sales.saltCostPerPct);

  g.brew = (slot, { veg, pickle, saltPct, tempC }) => {
    const v = cfg.vegetables[veg], p = cfg.pickles[pickle];
    if (!v || !p) return { ok: false, error: '野菜か漬物が不正です' };
    if (!p.vegetables.includes(veg)) return { ok: false, error: `${p.name}に${v.name}は使えません` };
    if (g.barrels[slot] === undefined) return { ok: false, error: '樽がありません' };
    if (g.barrels[slot]) return { ok: false, error: '樽が空いていません' };
    const cost = g.brewCost({ veg, saltPct });
    if (cost > g.money) return { ok: false, error: 'お金が足りません' };
    g.money -= cost;
    g.stats.cost += cost;
    g.barrels[slot] = { veg, pickle, saltPct, tempC, startTick: g.tick, portions: cfg.sales.portionsPerBatch, cost, earned: 0 };
    return { ok: true, cost };
  };

  /** 時間を進める（ticks区切り）。日が変わると天気を引き直す。 */
  g.advance = (ticks = 1) => {
    for (let i = 0; i < ticks; i++) {
      g.tick++;
      if (g.tick % cal.ticksPerDay === 0) g.weather = pickWeather();
    }
  };

  g.tasteOf = (slot) => {
    const b = g.barrels[slot];
    return b ? simulate({ ...b, days: g.barrelAge(b) }, cfg) : null;
  };

  /**
   * 味見。同じ樽の同じ時点では1回まで（時間が進めば、また味見できる）。
   * 2回目以降は新しい結果を出さず、前回の味見結果を返す。
   */
  g.tasteTest = (slot) => {
    const b = g.barrels[slot];
    if (!b) return { ok: false, error: '樽が空です' };
    if (b.tastedTick === g.tick) return { ok: true, already: true, taste: b.tastedTaste };
    b.tastedTick = g.tick;
    b.tastedTaste = g.tasteOf(slot);
    return { ok: true, already: false, taste: b.tastedTaste };
  };

  /** 樽を捨てる（損切り）。 */
  g.discard = (slot) => { g.barrels[slot] = null; };

  /**
   * 樽の漬物を販売する。来店する客を引き、満足度・支払額・一言を返す。
   * 傷みは樽ごとに1回判定する（傷んでいたら全員が買わず、樽は空になる）。
   */
  g.sell = (slot) => {
    const b = g.barrels[slot];
    if (!b) return { ok: false, error: '樽が空です' };
    if (!g.isOpen()) return { ok: false, error: '夜は閉店です' };
    const taste = g.tasteOf(slot);
    const season = g.season();
    const visitP = cfg.visit.base * cfg.visit.weather[g.weather] * cfg.visit.time[g.timeOfDay()];
    const coming = cfg.customers.filter(() => rng() < visitP);
    g.stats.visits += coming.length;
    const spoiled = coming.length > 0 && rng() * 100 < taste.spoilRisk;
    const visitors = [];
    let revenue = 0, sold = 0;
    for (const c of coming) {
      const sat = satisfaction(taste, b.pickle, c, season, cfg);
      if (spoiled) {
        visitors.push({ customer: c, sat: 0, price: 0, bought: false, reaction: { key: 'rotten', line: 'うっ、傷んでるよ！' } });
        continue;
      }
      if (b.portions <= 0) {
        visitors.push({ customer: c, sat, price: 0, bought: false, soldOut: true, reaction: { key: 'soldout', line: '売り切れかぁ' } });
        continue;
      }
      const price = priceFor(sat, b.pickle, cfg);
      const bought = price > 0;
      if (bought) { b.portions--; revenue += price; sold++; }
      visitors.push({ customer: c, sat, price, bought, reaction: reactionOf(taste, b.pickle, c, sat, season, cfg) });
    }
    g.money += revenue;
    g.stats.revenue += revenue;
    g.stats.sold += sold;
    b.earned += revenue;
    const closed = spoiled || b.portions <= 0;
    if (spoiled) g.stats.spoiled++;
    if (closed) g.barrels[slot] = null;
    // 樽の収支（空になったときだけ確定）
    const batch = { cost: b.cost, earned: b.earned, profit: b.earned - b.cost, closed };
    return { ok: true, spoiled, visitors, revenue, sold, taste, batch, weather: g.weather, season, time: g.timeOfDay() };
  };

  return g;
}
