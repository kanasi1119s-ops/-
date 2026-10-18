// ゲームの進行（画面なし）。仕込み→熟成→販売の1周を管理する。
// 乱数は seed 付きで差し替え可能にして、テストで結果を固定できるようにする。
import { CONFIG } from './config.js';
import { simulate, filmPerDay, nukaStep, nukaApply, applyCare, affinityOf } from './model.js';
import { NUKA_CARE } from '../data/nuka.js';
import { unmet, levelOf, masteryOf } from './unlock.js';
import { attachBusiness, agingFactor, hash01 } from './business.js';
import { attachSaga, newStory } from './saga.js';
import { attachWisdom } from './wisdom.js';
import { SAVE_VERSION, migrateSnapshot } from './save.js';
import { TASTE_GRIPES, ABSURD_GRIPES, DEMANDS, DISGUISE, REFORMED, RESPONSES, IGNORE } from '../data/claimer.js';
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

export { SAVE_VERSION } from './save.js';

/** 難癖のお客（好みのタイプではない特別なお客） */
export const CLAIMER_CUSTOMER = { id: 'claimer', name: '難癖のお客', hint: 'なんにでもケチをつける' };

export const BARREL_COUNT = CONFIG.barrelsInvest.start; // 最初の樽の数（投資で増やせる）

/** 図鑑の見出し（漬物・野菜・調味の組み合わせ）。 */
export const bookKey = (b) => [b.pickle, b.veg, ...[...(b.additives ?? [])].sort()].join(':');

/** 図鑑に載りうる組み合わせの数（調味は additiveMax 個まで）。 */
export function bookTotal(cfg = CONFIG) {
  const n = Object.keys(cfg.additives).length;
  let combos = 0, c = 1;
  for (let k = 0; k <= cfg.additiveMax; k++) { combos += c; c = (c * (n - k)) / (k + 1); }
  return Object.values(cfg.pickles).reduce((s, p) => s + p.vegetables.length, 0) * combos;
}

/** まっさらなぬか床。water=水っぽさ・rot=傷み・umami=足した旨味（0〜1）、suteTick=捨て漬けを替えた時、cared=手入れごとの最後の時 */
/** はじめから知っている作り方（unlock のないもの） */
export const startRecipes = (cfg = CONFIG) => Object.fromEntries(Object.entries(cfg.pickles).filter(([, p]) => !p.unlock).map(([id]) => [id, { via: 'start', day: 1, made: 0 }]));

export const newBed = (cfg = CONFIG) => ({ salt: cfg.nuka.startSalt, sour: 0, film: 0, maturity: 0, lastStirDay: 0, water: 0, rot: 0, umami: 0, suteTick: 0, cared: {} });

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
    nuka: newBed(cfg),
    reputation: cfg.reputation.start, // 評判 0〜100
    book: {}, // 図鑑: 売った組み合わせ（漬物・野菜・調味）ごとの最高の満足度 { key: { best, day, n } }
    regulars: [], // 常連客 { id, type, look, visits, misses, since }
    nextRegularId: 1,
    places: Object.keys(cfg.facilities).filter((k) => cfg.facilities[k].cost === 0), // 持っている設備（置き場所と道具）
    xp: 0, // 店の経験（段階C）。たまるとレベルが上がる
    regions: [], // 地方の枠に入れた地方（段階F）
    tane: {}, // 種（すんき）の数 { 漬物id: 数 }
    recipes: startRecipes(cfg), // 知っている作り方 { pickle: { via, day, made（成功した樽の数） } }
    claimer: { nerve: cfg.claimer.startNerve, look: 0, visits: 0, wins: 0, bannedUntil: -1, disguise: false, reformedTick: -1 }, // 難癖のお客（いつも同じ人）
    claim: null, // 対応を待っている難癖 { tick, slot, lines, regularHere, quality }
    events: [], // 画面に知らせること（レベルが上がった・ひらめいた・あと一歩・図鑑が埋まった）。popEvents で受け取る
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
  attachBusiness(g, { cfg, rng, cal, seed });
  attachSaga(g, { cfg, saga: cfg.saga }); // cfg.saga で物語を差し替えられる（試験用）
  attachWisdom(g, { cfg });

  // ---- 店のレベルと作り方の解放（段階C） ----
  g.level = () => levelOf(g.xp, cfg);
  g.popEvents = () => g.events.splice(0);
  g.addXp = (n) => {
    const before = g.level().level;
    g.xp += n;
    const now = g.level();
    if (now.level > before) g.events.push({ type: 'levelup', level: now.level, title: now.title, line: now.line, opens: now.extra ? [] : now.opens });
  };
  g.knows = (id) => !!g.recipes[id];
  /** 作り方の段階: 'learned'（成功した。図鑑が埋まる）/ 'known'（知っているがまだ成功していない）/ 'unknown' */
  g.recipeState = (id) => (!g.recipes[id] ? 'unknown' : g.recipes[id].made > 0 ? 'learned' : 'known');
  g.mastery = (id) => masteryOf(g.recipes[id]?.made, cfg);
  /** 仕込めるか（知っている・レベルが足りる・設備がある）。 */
  g.canBrew = (id) => {
    const p = cfg.pickles[id];
    if (!p) return { ok: false, error: 'その漬物はありません' };
    if (!g.knows(id)) return { ok: false, error: 'まだ作り方を知りません' };
    if (g.level().level < p.level) return { ok: false, error: `店のレベル${p.level}で挑めます`, needLevel: p.level };
    if (p.region && !g.regions.includes(p.region)) return { ok: false, error: `地方の枠に「${p.region}」を入れると挑めます`, needRegion: p.region };
    if (p.starter && !(g.tane[p.starter] > 0)) return { ok: false, error: '種がありません（前の樽から取り分ける）' };
    const lack = (p.needs ?? []).filter((f) => !g.places.includes(f));
    if (lack.length) return { ok: false, error: `${lack.map((f) => cfg.facilities[f].name).join('・')}がいります` };
    return { ok: true };
  };
  /** 作り方を覚える（ひらめき・失敗から・教わる、のどれでも）。新しく覚えたら true。 */
  g.learn = (id, via = 'condition', line = null) => {
    if (!cfg.pickles[id] || g.knows(id)) return false;
    g.recipes[id] = { via, day: g.day(), made: 0 };
    const p = cfg.pickles[id];
    if (p.region && !g.regions.includes(p.region) && g.regions.length < g.regionSlots()) g.regions.push(p.region); // 枠が空いていれば、その地方に挑む
    if (p.starter) g.tane[p.starter] = Math.max(1, g.tane[p.starter] ?? 0); // 最初の種は、ひらめきと一緒に届く
    g.events.push({ type: 'inspire', pickle: id, via, line: line ?? p.unlock?.line ?? '', tooEarly: g.level().level < p.level ? p.level : 0 });
    g.addXp(cfg.progress.xpInspire);
    return true;
  };
  // ---- 地方の枠（段階F） ----
  g.regionSlots = () => g.level().regions ?? 0;
  g.regionList = () => [...new Set(Object.values(cfg.pickles).map((p) => p.region).filter(Boolean))];
  /** 地方の枠に入れる（空きがなければ入れられない。一度入れた地方はそのまま） */
  g.openRegion = (r) => {
    if (!g.regionList().includes(r)) return { ok: false, error: 'その地方はありません' };
    if (g.regions.includes(r)) return { ok: false, error: 'もう挑んでいます' };
    if (g.regions.length >= g.regionSlots()) return { ok: false, error: g.regionSlots() ? '地方の枠がいっぱいです（店のレベルが上がると増える）' : '店のレベル3から、地方の漬物に挑めます' };
    g.regions.push(r);
    return { ok: true };
  };
  /** 樽の中身がひらめきの条件に合うか調べる（あと一歩なら、樽ごとに1回だけ知らせる）。 */
  const checkUnlocks = (b, stage = null) => {
    let ctx = null;
    for (const [id, p] of Object.entries(cfg.pickles)) {
      const u = p.unlock;
      if (!u || g.knows(id) || u.via === 'taught') continue;
      if (!ctx) ctx = { pickle: b.pickle, veg: b.veg, additives: b.additives ?? [], saltPct: b.saltPct, place: b.place, tempC: b.tempC, season: g.season(), days: g.barrelAge(b), owned: g.places, contracts: g.contracts, stage };
      if (u.when.stage && !ctx.stage) ctx.stage = g.tasteOf(g.barrels.indexOf(b))?.stage ?? null;
      const miss = unmet(u.when, ctx);
      if (!miss.length) { g.learn(id, u.via); continue; }
      if (u.via === 'condition' && miss.length === 1 && miss[0] !== 'days' && g.level().level >= (u.hintLevel ?? 1) && !b.almost?.[id]) {
        b.almost = { ...(b.almost ?? {}), [id]: true };
        g.events.push({ type: 'almost', pickle: id, missing: miss[0] });
      }
    }
  };
  g.checkUnlocks = checkUnlocks;

  // ---- 難癖のお客（クレーマー）と対策 ----
  const defense = (k, base) => g.places.reduce((v, id) => { const c = cfg.facilities[id]?.claimer?.[k]; return c == null ? v : k === 'explain' ? v + c : v * c; }, base);
  /** この時間帯に難癖のお客が来る確率 */
  g.claimerChance = () => {
    const k = g.claimer, cc = cfg.claimer;
    if (g.tick < k.bannedUntil) return 0;
    if (k.reformedTick >= 0 && g.tick < k.reformedTick + cc.newAfterDays * cal.ticksPerDay) return 0;
    return Math.min(1, cc.chance * (1 + cc.nerveVisit * k.nerve) * (1 + cc.repBoost * (g.reputation / 100)) * defense('chance', 1));
  };
  /** 難癖の台詞（味のどこかに必ずケチをつけるか、まったく関係ない難癖） */
  const gripeOf = (taste) => {
    if (g.claimer.disguise) return DISGUISE;
    if (rng() < 0.5) return ABSURD_GRIPES[Math.floor(rng() * ABSURD_GRIPES.length)];
    const axes = Object.keys(TASTE_GRIPES), axis = axes[Math.floor(rng() * axes.length)];
    const v = { acid: taste.acid, salt: taste.saltiness, texture: taste.texture, complexity: taste.complexity }[axis];
    const list = TASTE_GRIPES[axis][v >= 50 ? 0 : 1];
    return list[Math.floor(rng() * list.length)];
  };
  /** 今の難癖に選べる対応（選べないものは reason つき） */
  g.claimOptions = () => {
    const c = g.claim;
    if (!c) return [];
    return RESPONSES.map((r) => {
      let reason = null;
      if (r.needsRegular && !c.regularHere) reason = 'この時間帯は常連が来ていない';
      else if (r.minLevel && g.level().level < r.minLevel) reason = `店のレベル${r.minLevel}から`;
      else if (r.piece && !(g.barrels[c.slot]?.portions >= r.piece)) reason = '渡せる漬物がない';
      else if (r.money && g.money < r.money) reason = 'お金が足りない';
      const p = r.success ? g.explainChance() : null;
      return { ...r, ok: !reason, reason, p };
    });
  };
  /** 説明が通る確率 */
  g.explainChance = () => {
    const sc = RESPONSES.find((r) => r.id === 'explain').success;
    return Math.min(0.95, Math.max(0.05, sc.base + sc.perLevel * (g.level().level - 1) + sc.perQuality * (g.claim?.quality ?? 0) + defense('explain', 0) + (g.staffDoes?.('claimDefense') ?? []).reduce((a, v) => a + v, 0)));
  };
  /** 難癖に対応する。id = data/claimer.js の RESPONSES の id、または 'ignore'。 */
  g.respondClaim = (id) => {
    const c = g.claim;
    if (!c) return { ok: false, error: '難癖のお客はいない' };
    const r = id === 'ignore' ? { ...IGNORE, ok: true } : g.claimOptions().find((x) => x.id === id);
    if (!r) return { ok: false, error: 'その対応はありません' };
    if (!r.ok) return { ok: false, error: r.reason };
    let rep = r.rep ?? 0, nerve = r.nerve ?? 0, win = null, lines = r.lines;
    if (r.success) {
      win = rng() < g.explainChance();
      ({ rep, nerve } = win ? r.success.win : r.success.lose);
      lines = win ? r.lines.win : r.lines.lose;
    }
    if (rep < 0) rep *= defense('repLoss', 1);
    if (r.money) { g.money -= r.money; g.stats.cost += r.money; }
    if (r.piece && g.barrels[c.slot]) { g.barrels[c.slot].portions -= r.piece; if (g.barrels[c.slot].portions <= 0) g.barrels[c.slot] = null; }
    g.reputation = Math.min(100, Math.max(0, g.reputation + rep));
    const k = g.claimer;
    k.nerve = Math.min(cfg.claimer.maxNerve, Math.max(0, k.nerve + nerve));
    if (win) k.wins++;
    g.stats.claims = (g.stats.claims ?? 0) + 1;
    let banned = false, reformed = false;
    if (r.ban) { k.bannedUntil = g.tick + cfg.claimer.banDays * cal.ticksPerDay; k.disguise = true; banned = true; }
    else if (k.nerve <= 0) { // 改心: 難癖のお客が常連になる。しばらくして別の難癖のお客が現れる
      reformed = true;
      g.stats.reformed = (g.stats.reformed ?? 0) + 1;
      if (g.regulars.length < cfg.regulars.max) g.regulars.push({ id: g.nextRegularId++, type: 'gourmet', look: k.look, visits: 1, misses: 0, since: g.day(), reformed: true });
      g.claimer = { nerve: cfg.claimer.startNerve, look: Math.floor(rng() * 1e9), visits: 0, wins: 0, bannedUntil: -1, disguise: false, reformedTick: g.tick };
      g.events.push({ type: 'reformed', line: REFORMED });
    }
    g.claim = null;
    g.checkStory?.();
    return { ok: true, id: r.id, name: r.name, win, rep, line: lines[Math.floor(rng() * lines.length)], banned, reformed };
  };

  /** 仕込みの費用（円）。 */
  // ---- 市場（旬） ----
  const seasonFactor = (veg) => cfg.market.priceBySeason[veg]?.[g.season()] ?? 1;
  /** 今の季節の仕入れ値（円）。旬は安い。 */
  g.vegCost = (veg) => Math.round((cfg.vegetables[veg].cost * g.marketFactor(veg)) / 10) * 10; // 季節 × 日ごとの相場（段階D: business.js）
  /** 今の季節の品質（食感に掛ける）。旬は高い。 */
  g.vegQuality = (veg) => { const [lo, hi] = cfg.market.qualityRange; return Math.min(hi, Math.max(lo, 2 - seasonFactor(veg))); };
  g.inSeason = (veg) => seasonFactor(veg) < 1;
  /** 標準の個数（漬物ごと。個数を選ばなければこの数で、仕入れ値はこの数ぶん）。 */
  g.standardCount = (pickle) => cfg.pickles[pickle]?.portions ?? cfg.sales.portionsPerBatch;
  /** 仕込みの費用（円）。count を選ぶと、野菜と塩の代金は標準の個数に対する比で増減する（調味は樽ごとに1回）。 */
  g.brewCost = ({ veg, saltPct, additives = [], count, pickle }) => {
    const std = g.standardCount(pickle);
    const n = count ?? std;
    const fromStock = g.useStock(veg, n, true).used; // 仕入れてある分は野菜代がかからない
    const vegPart = g.vegCost(veg), saltPart = Math.round(saltPct * cfg.sales.saltCostPerPct);
    const scaled = fromStock ? Math.round((vegPart * (n - fromStock) + saltPart * n) / std / 10) * 10
      : n !== std ? Math.round(((vegPart + saltPart) * n) / std / 10) * 10 : vegPart + saltPart;
    return scaled + additives.reduce((s, a) => s + (cfg.additives[a]?.cost ?? 0), 0);
  };

  // ---- 置き場所 ----
  /** 置き場所の温度（℃）。 */
  g.placeTemp = (id) => { const pl = cfg.places[id]; return pl.fixed ?? g.ambientTemp() + pl.offset; };
  /** 設備（置き場所・道具）を買う。店のレベルが足りないと買えない。 */
  g.buyPlace = (id) => {
    const pl = cfg.facilities[id];
    if (!pl) return { ok: false, error: 'その設備はありません' };
    if (g.places.includes(id)) return { ok: false, error: 'もう持っています' };
    if (g.level().level < pl.level) return { ok: false, error: `店のレベル${pl.level}で買えます` };
    if (g.money < pl.cost) return { ok: false, error: 'お金が足りません' };
    g.money -= pl.cost; g.stats.cost += pl.cost; g.stats.invest = (g.stats.invest ?? 0) + pl.cost;
    g.places.push(id);
    return { ok: true, cost: pl.cost };
  };

  // ---- 樽を増やす ----
  g.buyFacility = g.buyPlace;
  g.nextBarrelCost = () => cfg.barrelsInvest.addCost[g.barrels.length - cfg.barrelsInvest.start] ?? null;
  /** 今のレベルで置ける樽の数 */
  g.barrelMax = () => Math.min(cfg.barrelsInvest.max, g.level().barrels ?? cfg.barrelsInvest.max);
  g.buyBarrel = () => {
    const cost = g.nextBarrelCost();
    if (cost == null || g.barrels.length >= cfg.barrelsInvest.max) return { ok: false, error: 'これ以上は置けません' };
    if (g.barrels.length >= g.barrelMax()) return { ok: false, error: '店のレベルが上がると、もっと置けます' };
    if (g.money < cost) return { ok: false, error: 'お金が足りません' };
    g.money -= cost; g.stats.cost += cost; g.stats.invest = (g.stats.invest ?? 0) + cost;
    g.barrels.push(null);
    return { ok: true, cost };
  };

  g.brew = (slot, { veg, pickle, saltPct, tempC, place, additives = [], count, dry, smoke, kaonTemp }) => {
    if (cfg.pickles[pickle]?.place) place = cfg.pickles[pickle].place; // すぐき漬けは加温室で
    additives = [...new Set(additives)];
    count = count ?? g.standardCount(pickle);
    if (!Number.isInteger(count) || count < 1 || count > cfg.sales.barrelCapacity) return { ok: false, error: `個数は1〜${cfg.sales.barrelCapacity}個です` };
    if (additives.length > cfg.additiveMax) return { ok: false, error: `調味は${cfg.additiveMax}つまでです` };
    if (additives.some((a) => !cfg.additives[a])) return { ok: false, error: 'その調味はありません' };
    if (place != null) {
      if (!cfg.places[place]) return { ok: false, error: 'その置き場所はありません' };
      if (!g.places.includes(place)) return { ok: false, error: 'その置き場所はまだ使えません' };
      tempC = g.placeTemp(place);
      if (cfg.facilities[place].adjustable && kaonTemp != null) { // 加温室は温度を選べる
        const [lo, hi] = cfg.kaonRange;
        if (!(kaonTemp >= lo && kaonTemp <= hi)) return { ok: false, error: `加温室の温度は${lo}〜${hi}℃です` };
        tempC = kaonTemp;
      }
    }
    const v = cfg.vegetables[veg], p = cfg.pickles[pickle];
    if (!v || !p) return { ok: false, error: '野菜か漬物が不正です' };
    if (!p.vegetables.includes(veg)) return { ok: false, error: `${p.name}に${v.name}は使えません` };
    if (!g.vegAvailable(veg)) return { ok: false, error: `${v.name}は${v.contract.farmer}と契約すると仕入れられます` };
    const can = g.canBrew(pickle);
    if (!can.ok) return can;
    // 干す日数（たくあんなど。段階E）。干しているあいだも樽はふさがる
    dry = p.drying ? (dry ?? p.drying.default ?? 0) : 0;
    if (!Number.isInteger(dry) || dry < 0 || dry > (p.drying?.max ?? 0)) return { ok: false, error: `干す日数は0〜${p.drying?.max ?? 0}日です` };
    // 燻す（いぶりがっこ。段階F）: 薪と日数。燻すあいだも樽はふさがる（干すのと同じ）
    if (p.smoking) {
      smoke = { days: smoke?.days ?? p.smoking.default, wood: smoke?.wood ?? Object.keys(p.smoking.woods)[0] };
      if (!p.smoking.woods[smoke.wood]) return { ok: false, error: 'その薪はありません' };
      if (!Number.isInteger(smoke.days) || smoke.days < 1 || smoke.days > p.smoking.max) return { ok: false, error: `燻す日数は1〜${p.smoking.max}日です` };
      dry = smoke.days;
    } else smoke = null;
    if (p.saltFree) saltPct = 0; // すんき: 塩を使わない
    if (g.barrels[slot] === undefined) return { ok: false, error: '樽がありません' };
    if (g.barrels[slot]) return { ok: false, error: '樽が空いていません' };
    if (p.usesNukaBed) saltPct = g.nuka.salt; // ぬか漬けはぬか床の塩分で漬かる
    const cost = g.brewCost({ veg, saltPct: p.usesNukaBed ? 0 : saltPct, additives, count, pickle });
    if (cost > g.money) return { ok: false, error: 'お金が足りません' };
    g.money -= cost;
    g.stats.cost += cost;
    if (p.usesNukaBed) {
      g.nuka.salt = Math.max(cfg.nuka.minSalt, g.nuka.salt - cfg.nuka.saltLossPerBatch);
      g.nuka.water = Math.min(1, (g.nuka.water ?? 0) + cfg.nuka.waterPerBatch * (count / g.standardCount(pickle)) * ((v.water ?? cfg.water.base) / cfg.water.base)); // 野菜から水が出る（水分の多い野菜ほど）
    }
    if (p.starter) g.tane[p.starter]--; // 種を使う
    const st = g.useStock(veg, count); // 在庫を古い順に使う（鮮度が品質に響く）。足りない分は今日の相場で買う
    const quality = g.vegQuality(veg) * ((st.used * st.quality + (count - st.used)) / count);
    g.barrels[slot] = { veg, pickle, saltPct, tempC, place: place ?? null, additives, quality, fromStock: st.used, dry, smoke, exposed: 0, tempSum: 0, tempN: 0, startTick: g.tick, portions: count, cost, earned: 0, film: 0, lastCareTick: -1 };
    return { ok: true, cost };
  };

  /** 時間を進める（ticks区切り）。日が変わると天気を引き直す。 */
  g.advance = (ticks = 1) => {
    const dt = 1 / cal.ticksPerDay;
    for (let i = 0; i < ticks; i++) {
      if (g.claim) { const r = g.respondClaim('ignore'); g.events.push({ type: 'claimIgnored', line: r.line, rep: r.rep }); } // 対応しないまま時間が進んだ
      g.tick++;
      if (g.tick % cal.ticksPerDay === 0) { g.weather = pickWeather(); g.newDay(); } // 朝: 天気・維持費・従業員の仕事（business.js）
      // 白い膜は、放っておくと少しずつ広がる（手入れで取れる）
      for (const b of g.barrels) {
        if (!b) continue;
        const pk = cfg.pickles[b.pickle];
        if (g.dryingLeft(b) > 0) continue; // 干しているあいだは漬かっていない
        if (pk.seasonal && b.place && cfg.places[b.place]) { // 季節をまたぐ熟成（へしこ）: 温度はそれまでの置き場所の温度の平均
          b.tempSum = (b.tempSum ?? 0) + g.placeTemp(b.place); b.tempN = (b.tempN ?? 0) + 1;
          b.tempC = Math.round((b.tempSum / b.tempN) * 10) / 10;
        }
        // 梅干し: 梅が梅酢から出てくると、カビ（膜）がつきやすい（段階E）
        let mold = 1;
        if (pk.umezu) { b.exposed = Math.min(1, (b.exposed ?? 0) + cfg.umezu.exposePerDay * dt); mold = b.exposed > cfg.umezu.safe ? cfg.umezu.moldExposed : cfg.umezu.moldInBrine; }
        if (pk.film && !pk.usesNukaBed) b.film = Math.min(1, (b.film ?? 0) + filmPerDay(b.tempC, cfg) * mold * dt);
      }
      // ぬか床は店の中（外気温）。放っておくと 膜 → 酸っぱい → 傷む の順に進む（model.js の nukaStep）
      g.nuka = nukaStep(g.nuka, g.ambientTemp(), dt, (g.tick - (g.nuka.suteTick ?? 0)) / cal.ticksPerDay, cfg);
      for (const b of g.barrels) if (b) checkUnlocks(b); // ひらめき
      g.checkStory(); // 本編の物語（saga.js）
    }
  };

  g.tasteOf = (slot) => {
    const b = g.barrels[slot];
    if (!b) return null;
    const p = cfg.pickles[b.pickle];
    const left = g.dryingLeft(b);
    const base = simulate({ ...b, days: Math.max(0, g.barrelAge(b) - (b.dry ?? 0)) }, cfg);
    if (left > 0) return { ...base, stage: 'raw', stageLabel: '干している', drying: left }; // まだ干している
    const film = Math.max(b.film ?? 0, p.usesNukaBed ? g.nuka.film : 0);
    const t = applyCare(base, { film, bed: p.usesNukaBed ? g.nuka : null }, cfg);
    // 作り方を磨くと品質が上がる（腕前 0〜1）
    const m = g.mastery(b.pickle), pr = cfg.progress;
    return m > 0 ? { ...t, complexity: Math.min(100, t.complexity * (1 + pr.masterComplexity * m)), texture: Math.min(100, t.texture * (1 + pr.masterTexture * m)), mastery: m } : t;
  };

  /** 干し終わるまでの日数（0 = 漬かりはじめている） */
  g.dryingLeft = (b) => Math.max(0, (b.dry ?? 0) - g.barrelAge(b));
  /** 梅干し: 重石を直して、梅を梅酢に沈める（同じ樽は1つの時間帯に1回） */
  g.sink = (slot) => {
    const b = g.barrels[slot];
    if (!b || !cfg.pickles[b.pickle].umezu) return { ok: false, error: '梅酢に漬けている樽ではありません' };
    if (b.lastSinkTick === g.tick) return { ok: false, error: 'さっき直したばかりです' };
    b.lastSinkTick = g.tick;
    b.exposed = 0;
    return { ok: true };
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
    n.rot = Math.max(0, (n.rot ?? 0) - cfg.nuka.rotStirDrop);
    if (n.lastStirDay !== g.day()) {
      n.lastStirDay = g.day();
      n.maturity = Math.min(1, n.maturity + 1 / cfg.nuka.matureDays);
    }
    g.checkStory?.();
    return { ok: true };
  };
  /** ぬか床の手入れ（data/nuka.js の id）。同じ手入れは1つの時間帯に1回まで。 */
  g.nukaCare = (id) => {
    const a = NUKA_CARE.find((x) => x.id === id);
    if (!a) return { ok: false, error: 'その手入れはありません' };
    if (a.needsWisdom && !g.knowsWisdom(a.needsWisdom)) return { ok: false, error: 'まだ知らない手入れです' };
    const n = g.nuka;
    if (n.cared?.[id] === g.tick) return { ok: false, error: 'さっきしたばかりです' };
    if (a.effects.salt > 0 && n.salt >= cfg.nuka.maxSalt) return { ok: false, error: 'これ以上は塩辛くなりすぎます' };
    if (g.money < a.cost) return { ok: false, error: 'お金が足りません' };
    g.money -= a.cost;
    g.stats.cost += a.cost;
    g.nuka = nukaApply(n, a.effects, cfg);
    g.nuka.cared = { ...(n.cared ?? {}), [id]: g.tick };
    if (a.resetsSute) g.nuka.suteTick = g.tick;
    return { ok: true, care: a };
  };
  /** ぬか床に塩を足す（酸味が和らぎ、塩分が上がる）。 */
  g.saltNuka = () => g.nukaCare('salt');
  /** 捨て漬けを替えてからの日数 */
  g.daysSinceSute = () => (g.tick - (g.nuka.suteTick ?? 0)) / cal.ticksPerDay;

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
      * (rep.visitMin + (rep.visitMax - rep.visitMin) * (g.reputation / 100)) // 評判が高いほど客が来る
      * (g.event()?.visitors ?? 1) * g.staffMult('visitors'); // 行事の特需・看板店員（段階D）
    const ev = g.event();
    const priceMult = (ev?.price ?? 1) * agingFactor(cfg.pickles[b.pickle], taste.ratio); // 行事の値段・寝かせた値打ち
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
    // 難癖のお客: 傷んでいない樽を出していると、ときどき来る（並びのどこかに入る）
    const claimAt = !spoiled && !g.claim && rng() < g.claimerChance() ? Math.floor(rng() * (coming.length + 1)) : -1;
    const visitors = [];
    let revenue = 0, sold = 0;
    let soured = false; // 難癖を聞いたあとは店の空気が悪い
    const claimVisitor = () => {
      const k = g.claimer;
      if (!k.look) k.look = Math.floor(rng() * 1e9) + 1;
      const lines = [gripeOf(taste), DEMANDS[Math.floor(rng() * DEMANDS.length)]];
      k.visits++;
      k.disguise = false;
      soured = true;
      const ratio = Math.min(1, taste.ratio / cfg.pickles[b.pickle].window.lo);
      g.claim = { tick: g.tick, slot, lines, regularHere: coming.some((x) => x.regular), quality: Math.max(0, Math.min(1, (taste.ratio >= cfg.pickles[b.pickle].window.lo && taste.stage !== 'sour' ? 0.5 : 0) + 0.5 * ratio * (1 - taste.spoilRisk / 100) * (taste.careFactor ?? 1))) };
      g.events.push({ type: 'claim' });
      return { customer: CLAIMER_CUSTOMER, claimer: { look: k.look, lines }, sat: null, price: 0, bought: false, reaction: { key: 'claim', line: lines[0] } };
    };
    for (const [ci, { c, regular }] of coming.entries()) {
      if (ci === claimAt) visitors.push(claimVisitor());
      // 年代（常連は決まった年代。ほかは今年の割合で）と減塩の流れで、好む塩味がずれる
      const age = regular?.age ?? (() => { let r = hash01(g.seed, g.tick, ci, 'age'); for (const [k, v] of Object.entries(g.ageShares())) { r -= v; if (r < 0) return k; } return 'middle'; })();
      const likeEv = ev?.likes?.includes(b.pickle) ? cfg.sales.likeBonus : 0; // 行事で人気の漬物
      const sat = Math.min(100, Math.max(0, satisfaction(taste, b.pickle, g.customerFor(c, age), season, cfg) + likeEv - (soured ? cfg.claimer.moodPenalty : 0)));
      const reg = regular ? { id: regular.id, look: regular.look, visits: regular.visits + 1 } : null;
      if (spoiled) {
        visitors.push({ customer: c, regular: reg, sat: 0, price: 0, bought: false, reaction: { key: 'rotten', line: ['うっ、傷んでるよ！', 'これは食べられないよ…', 'すっぱい匂いがする…'][Math.floor(rng() * 3)] } });
        continue;
      }
      if (b.portions <= 0) {
        visitors.push({ customer: c, regular: reg, sat, price: 0, bought: false, soldOut: true, reaction: { key: 'soldout', line: '売り切れかぁ' } });
        continue;
      }
      const base = Math.round((priceFor(sat, b.pickle, cfg) * priceMult) / 10) * 10;
      const unit = regular && base > 0 ? Math.round(base * (1 + rc0.tip)) : base;
      const bought = unit > 0;
      // 気に入るほどたくさん買う（1〜maxBuy 個。残りの数まで）
      const qty = bought ? Math.min(b.portions, 1 + Math.max(0, Math.floor((sat - cfg.sales.buyThreshold) / cfg.sales.buyStep)), cfg.sales.maxBuy) : 0;
      const price = unit * qty;
      if (bought) { b.portions -= qty; revenue += price; sold += qty; }
      visitors.push({ customer: c, age, regular: reg, sat, price, unit, qty, bought, reaction: reactionOf(taste, b.pickle, c, sat, season, cfg, Math.floor(rng() * 3)) });
    }
    if (claimAt === coming.length) visitors.push(claimVisitor());
    g.money += revenue;
    g.stats.revenue += revenue;
    g.stats.sold += sold;
    b.earned += revenue;
    const closed = spoiled || b.portions <= 0;
    if (spoiled) { g.stats.spoiled++; checkUnlocks(b, 'spoiled'); }
    // 評判: 満足した客が多いと上がり、傷んだ物を出すと下がる
    const repBefore = g.reputation, rc = cfg.reputation;
    if (spoiled) g.reputation -= rc.spoiledPenalty;
    else for (const v of visitors) if (!v.soldOut && !v.claimer) g.reputation += (v.sat - rc.neutral) * rc.perVisitor;
    g.reputation = Math.min(100, Math.max(0, g.reputation));
    // 図鑑: 傷んでいなければ、この組み合わせを記録する（最高の満足度）
    let discovery = null;
    const rated = visitors.filter((v) => !v.soldOut && !v.claimer);
    if (!spoiled && rated.length) {
      const key = bookKey(b);
      const avg = rated.reduce((s, v) => s + v.sat, 0) / rated.length;
      const prev = g.book[key];
      // 調味の相性を初めて知った（段階E: レシピ帳が埋まる）
      for (const a of b.additives ?? []) {
        const known = Object.keys(g.book).some((k) => { const [pk, , ...ad] = k.split(':'); return pk === b.pickle && ad.includes(a); });
        if (!known) { const aff = affinityOf(b.pickle, a, cfg); g.events.push({ type: 'affinity', pickle: b.pickle, additive: a, aff }); if (aff === 'good') g.addXp(cfg.progress.xpNewBook); }
      }
      discovery = { key, avg, isNew: !prev, best: !prev || avg > prev.best };
      g.book[key] = { best: Math.max(prev?.best ?? 0, avg), day: prev?.day ?? g.day(), n: (prev?.n ?? 0) + 1 };
      if (!prev) g.addXp(cfg.progress.xpNewBook);
    }
    // 経験: 売れた数（とても満足されたぶんは多め）
    const pg = cfg.progress;
    const xp = visitors.reduce((s, v) => s + (v.bought ? v.qty * pg.xpPerPiece * (v.sat >= pg.xpGreatSat ? pg.xpGreatMult : 1) : 0), 0);
    if (xp) g.addXp(xp);
    // 成功（樽ごとに1回）: 図鑑が埋まり、作り方が磨かれる
    let learned = null;
    const top = Math.max(0, ...visitors.filter((v) => v.bought).map((v) => v.sat));
    if (discovery && top >= pg.successSat && !b.succeeded) {
      b.succeeded = true;
      const rec = g.recipes[b.pickle] ?? (g.recipes[b.pickle] = { via: 'start', day: g.day(), made: 0 });
      const first = !rec.made;
      rec.made += g.staffMult('mastery'); // 職人の弟子がいると腕前の伸びが2倍
      if (first) { learned = b.pickle; g.events.push({ type: 'learned', pickle: b.pickle }); g.addXp(pg.xpFirstSuccess); }
      const sp = cfg.pickles[b.pickle].starter; // すんき: うまくできた樽から、次の種を取り分ける
      if (sp) { g.tane[sp] = (g.tane[sp] ?? 0) + 1; g.events.push({ type: 'tane', pickle: b.pickle, n: g.tane[sp] }); }
    }
    // 常連: 来た常連は回数を数え、不満が続くと離れる。とても満足した客はときどき常連になる
    for (const v of visitors) {
      if (v.soldOut || v.claimer) continue;
      const r = v.regular && g.regulars.find((x) => x.id === v.regular.id);
      if (r) {
        r.visits++;
        r.misses = spoiled || v.sat < rc0.leaveSat ? r.misses + 1 : 0;
        if (!spoiled && v.sat >= cfg.bond.sat) { const st = g.deepenBond(r); if (st) v.regular.story = st; } // 絆と物語（business.js）
        if (r.misses >= rc0.leaveAfter) { g.regulars = g.regulars.filter((x) => x !== r); v.regular.left = true; }
      } else if (!spoiled && v.bought && v.sat >= rc0.joinSat && g.regulars.length < rc0.max && rng() < rc0.joinChance) {
        const id = g.nextRegularId++;
        const nr = { id, type: v.customer.id, look: Math.floor(rng() * 1e9), visits: 1, misses: 0, since: g.day(), name: g.regularName(id), age: v.age ?? 'middle', bond: 0, chapters: [] };
        g.regulars.push(nr);
        v.regular = { id: nr.id, look: nr.look, visits: 1, joined: true };
      }
    }
    if (closed) g.barrels[slot] = null;
    // 樽の収支（空になったときだけ確定）
    const batch = { pickle: b.pickle, cost: b.cost, earned: b.earned, profit: b.earned - b.cost, closed };
    const res = { ok: true, spoiled, visitors, revenue, sold, taste, batch, weather: g.weather, season, time: g.timeOfDay(), reputation: { before: repBefore, after: g.reputation }, discovery, learned, xp };
    g.questOnSale(res, b); // 物語の課題（対決など）
    g.checkStory();
    return res;
  };

  /** セーブ用の状態（JSONにできる形）。 */
  g.snapshot = () => JSON.parse(JSON.stringify({
    v: SAVE_VERSION, tick: g.tick, money: g.money, barrels: g.barrels, weather: g.weather, stats: g.stats, lastSaleTick: g.lastSaleTick, nuka: g.nuka, reputation: g.reputation, places: g.places, regulars: g.regulars, nextRegularId: g.nextRegularId, book: g.book, xp: g.xp, recipes: g.recipes, regions: g.regions, tane: g.tane, wisdom: g.wisdom, claimer: g.claimer, claim: g.claim, stock: g.stock, staff: g.staff, contracts: g.contracts, seed: g.seed, story: g.story,
    rng: rng.getState ? rng.getState() : null,
  }));

  /** セーブから戻す。形がおかしければ何もせず false。 */
  g.restore = (raw) => {
    // 古い版は直してから読む。途中で何かあっても、元の状態に戻す（壊れたセーブで店が壊れない）
    const s = migrateSnapshot(raw);
    if (!s) return false;
    const backup = g.snapshot();
    try { return restoreInner(s) || (restoreInner(backup), false); } catch { restoreInner(backup); return false; }
  };
  const restoreInner = (s) => {
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
    if (n && [n.salt, n.sour, n.film, n.maturity].every(Number.isFinite)) {
      g.nuka = { ...newBed(cfg), ...n }; // 段階B より前のセーブには水っぽさ・傷み・旨味がないので、まっさらの値で補う
      for (const k of ['water', 'rot', 'umami', 'suteTick']) if (!Number.isFinite(g.nuka[k])) g.nuka[k] = 0;
      if (typeof g.nuka.cared !== 'object' || !g.nuka.cared) g.nuka.cared = {};
    }
    for (const b of g.barrels) if (b) { b.film = Number.isFinite(b.film) ? b.film : 0; b.lastCareTick ??= -1; b.quality ??= 1; b.dry = Number.isInteger(b.dry) ? b.dry : 0; b.exposed = Number.isFinite(b.exposed) ? b.exposed : 0; }
    if (Number.isFinite(s.reputation)) g.reputation = Math.min(100, Math.max(0, s.reputation));
    if (Array.isArray(s.places)) g.places = [...new Set([...g.places, ...s.places.filter((k) => cfg.facilities[k])])];
    if (s.book && typeof s.book === 'object') {
      g.book = Object.fromEntries(Object.entries(s.book).filter(([, e]) => e && Number.isFinite(e.best)).map(([k, e]) => [k, { best: e.best, day: e.day ?? 1, n: e.n ?? 1 }]));
    }
    for (const b of g.barrels) if (b) b.additives = Array.isArray(b.additives) ? b.additives.filter((a) => cfg.additives[a]) : [];
    if (Array.isArray(s.regulars)) {
      g.regulars = s.regulars.filter((r) => r && Number.isInteger(r.id) && cfg.customers.some((c) => c.id === r.type) && Number.isFinite(r.look))
        .slice(0, cfg.regulars.max).map((r) => ({ ...r, visits: r.visits ?? 0, misses: r.misses ?? 0, since: r.since ?? 1 }));
      g.nextRegularId = Math.max(Number.isInteger(s.nextRegularId) ? s.nextRegularId : 1, ...g.regulars.map((r) => r.id + 1));
    }
    // 段階C: 経験と作り方。古いセーブには無いので、図鑑で成功した漬物を「成功済み」にしておく
    g.xp = Number.isFinite(s.xp) && s.xp >= 0 ? s.xp : 0;
    g.recipes = startRecipes(cfg);
    if (s.recipes && typeof s.recipes === 'object') {
      for (const [id, r] of Object.entries(s.recipes)) if (cfg.pickles[id] && r) g.recipes[id] = { via: r.via ?? 'start', day: r.day ?? 1, made: Number.isInteger(r.made) && r.made >= 0 ? r.made : 0 };
    } else {
      for (const [k, e] of Object.entries(g.book)) { const id = k.split(':')[0]; if (g.recipes[id] && e.best >= cfg.progress.successSat) g.recipes[id].made = Math.max(g.recipes[id].made, 1); }
    }
    g.events = [];
    const wd = s.wisdom;
    g.wisdom = wd && Array.isArray(wd.known) ? { joined: !!wd.joined, known: wd.known.filter((id) => typeof id === 'string'), told: wd.told && typeof wd.told === 'object' ? { ...wd.told } : {} } : { joined: g.regulars.some((r) => r.granny), known: [], told: {} };
    g.regions = Array.isArray(s.regions) ? s.regions.filter((r) => g.regionList().includes(r)) : [];
    g.tane = s.tane && typeof s.tane === 'object' ? Object.fromEntries(Object.entries(s.tane).filter(([k, v]) => cfg.pickles[k] && Number.isInteger(v) && v >= 0)) : {};
    const k = s.claimer;
    g.claimer = k && Number.isFinite(k.nerve) ? { ...g.claimer, ...k, nerve: Math.min(cfg.claimer.maxNerve, Math.max(0, k.nerve)) } : { ...g.claimer };
    // 段階D: 在庫・従業員・契約・相場の種
    if (Number.isFinite(s.seed)) g.seed = s.seed;
    g.stock = {};
    if (s.stock && typeof s.stock === 'object') for (const [veg, lots] of Object.entries(s.stock)) if (cfg.vegetables[veg] && Array.isArray(lots)) g.stock[veg] = lots.filter((l) => l && Number.isInteger(l.n) && l.n > 0 && Number.isFinite(l.day)).map((l) => ({ n: l.n, day: l.day }));
    g.staff = Array.isArray(s.staff) ? s.staff.filter((id) => g.staffDef(id)) : [];
    g.contracts = Array.isArray(s.contracts) ? s.contracts.filter((v) => cfg.vegetables[v]?.contract) : [];
    for (const r of g.regulars) { r.name ??= g.regularName(r.id); r.age ??= 'middle'; r.bond ??= 0; r.chapters ??= []; }
    const sto = s.story;
    g.story = sto && Array.isArray(sto.seen) ? { ...newStory(), ...sto, seen: sto.seen.filter((id) => g.chapter(id)), won: Array.isArray(sto.won) ? sto.won : [], lostPending: Array.isArray(sto.lostPending) ? sto.lostPending : [] } : newStory();
    g.claim = s.claim && Array.isArray(s.claim.lines) && Number.isInteger(s.claim.slot) ? { ...s.claim } : null;
    if (s.rng != null && rng.setState) rng.setState(s.rng);
    return true;
  };

  g.checkStory(); // 序章
  return g;
}
