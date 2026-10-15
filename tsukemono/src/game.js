// ゲームの進行（画面なし）。仕込み→熟成→販売の1周を管理する。
// 乱数は seed 付きで差し替え可能にして、テストで結果を固定できるようにする。
import { CONFIG } from './config.js';
import { simulate, filmPerDay, nukaSourPerDay, applyCare } from './model.js';
import { satisfaction, priceFor, reactionOf } from './sales.js';

export function createRng(seed = 1) {
  let a = seed >>> 0;
  const rng = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  // セーブ用: 乱数の状態を読み書きする
  rng.getState = () => a;
  rng.setState = (v) => { a = v >>> 0; };
  return rng;
}

export const SAVE_VERSION = 1;

export const BARREL_COUNT = CONFIG.barrelsInvest.start; // 最初の樽の数（投資で増やせる）

export function createGame({ seed = 1, rng = createRng(seed), cfg = CONFIG } = {}) {
  const cal = cfg.calendar;
  const g = {
    cfg, rng,
    tick: 0, // 0 = 1日目の朝。1日 = ticksPerDay 区切り。
    money: cfg.sales.startMoney,
    barrels: Array.from({ length: BARREL_COUNT }, () => null),
    weather: 'sunny',
    stats: { revenue: 0, cost: 0, sold: 0, visits: 0, spoiled: 0 },
    lastSaleTick: -1, // 販売は1つの時間帯（区切り）に1回まで
    // ぬか床（店にひとつ）: 塩分、酸味(0〜1)、白い膜(0〜1)、熟成度(0〜1)、最後にかき混ぜた日
    nuka: { salt: cfg.nuka.startSalt, sour: 0, film: 0, maturity: 0, lastStirDay: 0 },
    reputation: cfg.reputation.start, // 評判 0〜100
    regulars: [], // 常連客 { id, type, look, visits, misses, since }
    nextRegularId: 1,
    places: Object.keys(cfg.places).filter((k) => cfg.places[k].cost === 0), // 使える置き場所
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
  // ---- 市場（旬） ----
  const seasonFactor = (veg) => cfg.market.priceBySeason[veg]?.[g.season()] ?? 1;
  /** 今の季節の仕入れ値（円）。旬は安い。 */
  g.vegCost = (veg) => Math.round((cfg.vegetables[veg].cost * seasonFactor(veg)) / 10) * 10;
  /** 今の季節の品質（食感に掛ける）。旬は高い。 */
  g.vegQuality = (veg) => { const [lo, hi] = cfg.market.qualityRange; return Math.min(hi, Math.max(lo, 2 - seasonFactor(veg))); };
  g.inSeason = (veg) => seasonFactor(veg) < 1;
  g.brewCost = ({ veg, saltPct }) => g.vegCost(veg) + Math.round(saltPct * cfg.sales.saltCostPerPct);

  // ---- 置き場所 ----
  /** 置き場所の温度（℃）。 */
  g.placeTemp = (id) => { const pl = cfg.places[id]; return pl.fixed ?? g.ambientTemp() + pl.offset; };
  g.buyPlace = (id) => {
    const pl = cfg.places[id];
    if (!pl) return { ok: false, error: 'その置き場所はありません' };
    if (g.places.includes(id)) return { ok: false, error: 'もう持っています' };
    if (g.money < pl.cost) return { ok: false, error: 'お金が足りません' };
    g.money -= pl.cost; g.stats.cost += pl.cost; g.stats.invest = (g.stats.invest ?? 0) + pl.cost;
    g.places.push(id);
    return { ok: true, cost: pl.cost };
  };

  // ---- 樽を増やす ----
  g.nextBarrelCost = () => cfg.barrelsInvest.addCost[g.barrels.length - cfg.barrelsInvest.start] ?? null;
  g.buyBarrel = () => {
    const cost = g.nextBarrelCost();
    if (cost == null || g.barrels.length >= cfg.barrelsInvest.max) return { ok: false, error: 'これ以上は置けません' };
    if (g.money < cost) return { ok: false, error: 'お金が足りません' };
    g.money -= cost; g.stats.cost += cost; g.stats.invest = (g.stats.invest ?? 0) + cost;
    g.barrels.push(null);
    return { ok: true, cost };
  };

  g.brew = (slot, { veg, pickle, saltPct, tempC, place }) => {
    if (place != null) {
      if (!cfg.places[place]) return { ok: false, error: 'その置き場所はありません' };
      if (!g.places.includes(place)) return { ok: false, error: 'その置き場所はまだ使えません' };
      tempC = g.placeTemp(place);
    }
    const v = cfg.vegetables[veg], p = cfg.pickles[pickle];
    if (!v || !p) return { ok: false, error: '野菜か漬物が不正です' };
    if (!p.vegetables.includes(veg)) return { ok: false, error: `${p.name}に${v.name}は使えません` };
    if (g.barrels[slot] === undefined) return { ok: false, error: '樽がありません' };
    if (g.barrels[slot]) return { ok: false, error: '樽が空いていません' };
    if (p.usesNukaBed) saltPct = g.nuka.salt; // ぬか漬けはぬか床の塩分で漬かる
    const cost = g.brewCost({ veg, saltPct: p.usesNukaBed ? 0 : saltPct });
    if (cost > g.money) return { ok: false, error: 'お金が足りません' };
    g.money -= cost;
    g.stats.cost += cost;
    if (p.usesNukaBed) g.nuka.salt = Math.max(cfg.nuka.minSalt, g.nuka.salt - cfg.nuka.saltLossPerBatch);
    g.barrels[slot] = { veg, pickle, saltPct, tempC, place: place ?? null, quality: g.vegQuality(veg), startTick: g.tick, portions: cfg.sales.portionsPerBatch, cost, earned: 0, film: 0, lastCareTick: -1 };
    return { ok: true, cost };
  };

  /** 時間を進める（ticks区切り）。日が変わると天気を引き直す。 */
  g.advance = (ticks = 1) => {
    const dt = 1 / cal.ticksPerDay;
    for (let i = 0; i < ticks; i++) {
      g.tick++;
      if (g.tick % cal.ticksPerDay === 0) g.weather = pickWeather();
      // 白い膜は、放っておくと少しずつ広がる（手入れで取れる）
      for (const b of g.barrels) {
        if (b && cfg.pickles[b.pickle].film && !cfg.pickles[b.pickle].usesNukaBed) b.film = Math.min(1, (b.film ?? 0) + filmPerDay(b.tempC, cfg) * dt);
      }
      // ぬか床は店の中（外気温）。かき混ぜないと酸っぱくなり、膜が張る
      const n = g.nuka, t = g.ambientTemp();
      n.sour = Math.min(1, n.sour + nukaSourPerDay(t, n.salt, cfg) * dt);
      n.film = Math.min(1, n.film + filmPerDay(t, cfg) * dt);
    }
  };

  g.tasteOf = (slot) => {
    const b = g.barrels[slot];
    if (!b) return null;
    const p = cfg.pickles[b.pickle];
    const base = simulate({ ...b, days: g.barrelAge(b) }, cfg);
    const film = Math.max(b.film ?? 0, p.usesNukaBed ? g.nuka.film : 0);
    return applyCare(base, { film, bed: p.usesNukaBed ? { sour: g.nuka.sour, maturity: g.nuka.maturity } : null }, cfg);
  };

  // ---- 手入れ ----
  /** 樽の手入れ（白い膜を取る）。同じ樽は1つの時間帯に1回まで。 */
  g.care = (slot) => {
    const b = g.barrels[slot];
    if (!b) return { ok: false, error: '樽が空です' };
    if (!cfg.pickles[b.pickle].film) return { ok: false, error: 'この漬物は手入れがいりません' };
    if (cfg.pickles[b.pickle].usesNukaBed) return { ok: false, error: 'ぬか漬けは、ぬか床をかき混ぜて手入れします' };
    if (b.lastCareTick === g.tick) return { ok: false, error: 'さっき手入れしたばかりです' };
    b.lastCareTick = g.tick;
    b.film = 0;
    return { ok: true };
  };
  /** ぬか床をかき混ぜる。1日1回で熟成度が上がる（毎日かき混ぜると育つ）。 */
  g.stirNuka = () => {
    const n = g.nuka;
    if (n.lastStirTick === g.tick) return { ok: false, error: 'さっきかき混ぜたばかりです' };
    n.lastStirTick = g.tick;
    n.sour = Math.max(0, n.sour - cfg.nuka.stirSourDrop);
    n.film = 0;
    if (n.lastStirDay !== g.day()) {
      n.lastStirDay = g.day();
      n.maturity = Math.min(1, n.maturity + 1 / cfg.nuka.matureDays);
    }
    return { ok: true };
  };
  /** ぬか床に塩を足す（酸味が和らぎ、塩分が上がる）。 */
  g.saltNuka = () => {
    const n = g.nuka, c = cfg.nuka;
    if (n.salt >= c.maxSalt) return { ok: false, error: 'これ以上は塩辛くなりすぎます' };
    if (g.money < c.addSaltCost) return { ok: false, error: 'お金が足りません' };
    g.money -= c.addSaltCost;
    g.stats.cost += c.addSaltCost;
    n.salt = Math.min(c.maxSalt, n.salt + c.addSaltPct);
    n.sour = Math.max(0, n.sour - c.addSaltSourDrop);
    return { ok: true };
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
    if (g.lastSaleTick === g.tick) return { ok: false, error: 'この時間帯はもう店を開けました。時間を進めてください' };
    g.lastSaleTick = g.tick;
    const taste = g.tasteOf(slot);
    const season = g.season();
    const rep = cfg.reputation;
    const visitP = cfg.visit.base * cfg.visit.weather[g.weather] * cfg.visit.time[g.timeOfDay()]
      * (rep.visitMin + (rep.visitMax - rep.visitMin) * (g.reputation / 100)); // 評判が高いほど客が来る
    // 名前のない客がランダムに来る。来た客の好みのタイプもランダム
    const rc0 = cfg.regulars;
    const coming = [];
    // 常連が先に来る（来店率は評判に関係なく、天気と時間だけで決まる）
    const regP = rc0.visit * cfg.visit.weather[g.weather] * cfg.visit.time[g.timeOfDay()];
    for (const r of g.regulars) {
      if (coming.length < cfg.visit.slots && rng() < regP) coming.push({ c: cfg.customers.find((x) => x.id === r.type), regular: r });
    }
    for (let i = coming.length; i < cfg.visit.slots; i++) {
      if (rng() < visitP) coming.push({ c: cfg.customers[Math.floor(rng() * cfg.customers.length)] });
    }
    g.stats.visits += coming.length;
    const spoiled = coming.length > 0 && rng() * 100 < taste.spoilRisk;
    const visitors = [];
    let revenue = 0, sold = 0;
    for (const { c, regular } of coming) {
      const sat = satisfaction(taste, b.pickle, c, season, cfg);
      const reg = regular ? { id: regular.id, look: regular.look, visits: regular.visits + 1 } : null;
      if (spoiled) {
        visitors.push({ customer: c, regular: reg, sat: 0, price: 0, bought: false, reaction: { key: 'rotten', line: ['うっ、傷んでるよ！', 'これは食べられないよ…', 'すっぱい匂いがする…'][Math.floor(rng() * 3)] } });
        continue;
      }
      if (b.portions <= 0) {
        visitors.push({ customer: c, regular: reg, sat, price: 0, bought: false, soldOut: true, reaction: { key: 'soldout', line: '売り切れかぁ' } });
        continue;
      }
      const base = priceFor(sat, b.pickle, cfg);
      const price = regular && base > 0 ? Math.round(base * (1 + rc0.tip)) : base;
      const bought = price > 0;
      if (bought) { b.portions--; revenue += price; sold++; }
      visitors.push({ customer: c, regular: reg, sat, price, bought, reaction: reactionOf(taste, b.pickle, c, sat, season, cfg, Math.floor(rng() * 3)) });
    }
    g.money += revenue;
    g.stats.revenue += revenue;
    g.stats.sold += sold;
    b.earned += revenue;
    const closed = spoiled || b.portions <= 0;
    if (spoiled) g.stats.spoiled++;
    // 評判: 満足した客が多いと上がり、傷んだ物を出すと下がる
    const repBefore = g.reputation, rc = cfg.reputation;
    if (spoiled) g.reputation -= rc.spoiledPenalty;
    else for (const v of visitors) if (!v.soldOut) g.reputation += (v.sat - rc.neutral) * rc.perVisitor;
    g.reputation = Math.min(100, Math.max(0, g.reputation));
    // 常連: 来た常連は回数を数え、不満が続くと離れる。とても満足した客はときどき常連になる
    for (const v of visitors) {
      if (v.soldOut) continue;
      const r = v.regular && g.regulars.find((x) => x.id === v.regular.id);
      if (r) {
        r.visits++;
        r.misses = spoiled || v.sat < rc0.leaveSat ? r.misses + 1 : 0;
        if (r.misses >= rc0.leaveAfter) { g.regulars = g.regulars.filter((x) => x !== r); v.regular.left = true; }
      } else if (!spoiled && v.bought && v.sat >= rc0.joinSat && g.regulars.length < rc0.max && rng() < rc0.joinChance) {
        const nr = { id: g.nextRegularId++, type: v.customer.id, look: Math.floor(rng() * 1e9), visits: 1, misses: 0, since: g.day() };
        g.regulars.push(nr);
        v.regular = { id: nr.id, look: nr.look, visits: 1, joined: true };
      }
    }
    if (closed) g.barrels[slot] = null;
    // 樽の収支（空になったときだけ確定）
    const batch = { cost: b.cost, earned: b.earned, profit: b.earned - b.cost, closed };
    return { ok: true, spoiled, visitors, revenue, sold, taste, batch, weather: g.weather, season, time: g.timeOfDay(), reputation: { before: repBefore, after: g.reputation } };
  };

  /** セーブ用の状態（JSONにできる形）。 */
  g.snapshot = () => JSON.parse(JSON.stringify({
    v: SAVE_VERSION, tick: g.tick, money: g.money, barrels: g.barrels, weather: g.weather, stats: g.stats, lastSaleTick: g.lastSaleTick, nuka: g.nuka, reputation: g.reputation, places: g.places, regulars: g.regulars, nextRegularId: g.nextRegularId,
    rng: rng.getState ? rng.getState() : null,
  }));

  /** セーブから戻す。形がおかしければ何もせず false。 */
  g.restore = (s) => {
    const okBarrel = (b) => b === null || (b && cfg.vegetables[b.veg] && cfg.pickles[b.pickle] && Number.isFinite(b.saltPct) && Number.isFinite(b.tempC) && Number.isFinite(b.startTick) && Number.isFinite(b.portions));
    if (!s || s.v !== SAVE_VERSION || !Number.isInteger(s.tick) || s.tick < 0 || !Number.isFinite(s.money)
      || !Array.isArray(s.barrels) || s.barrels.length < BARREL_COUNT || s.barrels.length > cfg.barrelsInvest.max || !s.barrels.every(okBarrel)
      || !cal.weathers.includes(s.weather) || !s.stats) return false;
    g.tick = s.tick;
    g.money = s.money;
    g.barrels = s.barrels.map((b) => (b ? { ...b } : null));
    g.weather = s.weather;
    g.stats = { ...g.stats, ...s.stats };
    g.lastSaleTick = Number.isInteger(s.lastSaleTick) ? s.lastSaleTick : -1;
    const n = s.nuka;
    if (n && [n.salt, n.sour, n.film, n.maturity].every(Number.isFinite)) g.nuka = { ...g.nuka, ...n };
    for (const b of g.barrels) if (b) { b.film = Number.isFinite(b.film) ? b.film : 0; b.lastCareTick ??= -1; b.quality ??= 1; }
    if (Number.isFinite(s.reputation)) g.reputation = Math.min(100, Math.max(0, s.reputation));
    if (Array.isArray(s.places)) g.places = [...new Set([...g.places, ...s.places.filter((k) => cfg.places[k])])];
    if (Array.isArray(s.regulars)) {
      g.regulars = s.regulars.filter((r) => r && Number.isInteger(r.id) && cfg.customers.some((c) => c.id === r.type) && Number.isFinite(r.look))
        .slice(0, cfg.regulars.max).map((r) => ({ ...r, visits: r.visits ?? 0, misses: r.misses ?? 0, since: r.since ?? 1 }));
      g.nextRegularId = Math.max(Number.isInteger(s.nextRegularId) ? s.nextRegularId : 1, ...g.regulars.map((r) => r.id + 1));
    }
    if (s.rng != null && rng.setState) rng.setState(s.rng);
    return true;
  };

  return g;
}
