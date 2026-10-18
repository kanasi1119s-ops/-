// 経営（段階D）: 毎日の相場と仕入れ・在庫、季節の行事、従業員、維持費、客の年代と減塩の流れ、常連の物語、行商人。
// game.js の createGame から attachBusiness(g, ...) で取りつける（画面なし・乱数は seed 付きか日付から決める）。
import { EVENTS, eventOn } from '../data/events.js';
import { STAFF } from '../data/staff.js';
import { AGES, REGULAR_NAMES, STORIES } from '../data/stories.js';

/** 数の組から 0〜1 の決まった値を作る（同じ日・同じ野菜なら、画面とゲームで同じ相場になる） */
export function hash01(...ns) {
  let h = 2166136261 >>> 0;
  for (const n of ns) for (const ch of String(n)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619) >>> 0; }
  h ^= h >>> 13; h = Math.imul(h, 0x5bd1e995) >>> 0; h ^= h >>> 15;
  return (h >>> 0) / 4294967296;
}

/** 寝かせた漬物の値打ち（売り値に掛ける）。def.aging = { from, full, max }、ratio = 進み/ripeAt */
export function agingFactor(def, ratio) {
  const a = def?.aging;
  if (!a || !(ratio > a.from)) return 1;
  return 1 + a.max * Math.min(1, (ratio - a.from) / (a.full - a.from));
}

export function attachBusiness(g, { cfg, rng, cal, seed = 1 }) {
  g.stock = {}; // 仕入れた野菜 { veg: [{ n: 個分, day: 仕入れた日 }] }
  g.staff = []; // 雇っている人（data/staff.js の id）
  g.contracts = []; // 契約した農家の野菜
  g.seed = seed; // 相場の揺れの種（ゲームごとに違う）

  // ---- 暦と行事 ----
  g.dayOfSeason = () => ((g.day() - 1) % cal.daysPerSeason) + 1;
  g.year = () => Math.floor((g.day() - 1) / (cal.daysPerSeason * cal.seasons.length)) + 1;
  g.event = (day = g.day()) => {
    const season = cal.seasons[Math.floor((day - 1) / cal.daysPerSeason) % cal.seasons.length];
    return eventOn(season, ((day - 1) % cal.daysPerSeason) + 1, EVENTS);
  };

  // ---- 相場（季節 × 日ごとの揺れ × 特売 × 行事） ----
  // 契約が要る野菜と、地方の食材（その地方を地方の枠に入れると取り寄せられる）
  g.vegAvailable = (veg) => { const v = cfg.vegetables[veg]; return !!v && (!v.contract || g.contracts.includes(veg)) && (!v.region || g.regions.includes(v.region)) && (!v.only || v.only.includes(g.season())); };
  /** 仕入れられない理由（なければ null） */
  g.vegLock = (veg) => { const v = cfg.vegetables[veg]; if (!v) return 'ありません'; if (v.contract && !g.contracts.includes(veg)) return `${v.contract.farmer}と契約がいる`; if (v.region && !g.regions.includes(v.region)) return `地方の枠に「${v.region}」を入れると取り寄せられる`; if (v.only && !v.only.includes(g.season())) return `${v.only.map((x) => cfg.season[x].name).join('・')}だけ`; return null; };
  const vegIds = () => Object.keys(cfg.vegetables).filter(g.vegAvailable);
  /** 今日の特売の野菜（なければ null） */
  g.saleVeg = (day = g.day()) => {
    const m = cfg.market;
    if (hash01(g.seed, day, 'sale') >= m.saleChance) return null;
    const ids = vegIds();
    return ids[Math.floor(hash01(g.seed, day, 'which') * ids.length)];
  };
  /** 今日の仕入れ値の倍率 */
  g.marketFactor = (veg, day = g.day()) => {
    const m = cfg.market;
    const season = cal.seasons[Math.floor((day - 1) / cal.daysPerSeason) % cal.seasons.length];
    const noise = 1 + m.dailyNoise * (2 * hash01(g.seed, day, veg) - 1);
    return (m.priceBySeason[veg]?.[season] ?? 1) * noise * (g.saleVeg(day) === veg ? m.saleFactor : 1) * (g.event(day)?.vegPrice?.[veg] ?? 1);
  };

  // ---- 在庫（仕入れた野菜。古いものから使う） ----
  const perPortion = (veg) => g.vegCost(veg) / cfg.sales.portionsPerBatch;
  g.stockAge = (lot) => g.day() - lot.day;
  g.stockCount = (veg) => (g.stock[veg] ?? []).reduce((s, l) => s + l.n, 0);
  /** 鮮度（品質に掛ける）: 採れたては1、日がたつほど下がる */
  g.freshness = (lot) => 1 - cfg.stock.decayPerDay * Math.max(0, g.stockAge(lot) - cfg.stock.freshDays);
  /** n 個分を仕入れる値段 */
  g.stockCost = (veg, n) => Math.round((perPortion(veg) * n) / 10) * 10;
  g.buyStock = (veg, n) => {
    if (!cfg.vegetables[veg]) return { ok: false, error: 'その野菜はありません' };
    if (!g.vegAvailable(veg)) return { ok: false, error: `${cfg.vegetables[veg].name}は${g.vegLock(veg)}` };
    if (!Number.isInteger(n) || n < 1) return { ok: false, error: '数がおかしい' };
    const cost = g.stockCost(veg, n);
    if (cost > g.money) return { ok: false, error: 'お金が足りません' };
    g.money -= cost; g.stats.cost += cost;
    const lots = (g.stock[veg] ??= []);
    const today = lots.find((l) => l.day === g.day());
    if (today) today.n += n; else lots.push({ n, day: g.day() });
    return { ok: true, cost };
  };
  /** 在庫から count 個分を使う（古い順）。{ used, quality }: quality は使った分の鮮度の平均 */
  g.useStock = (veg, count, dry = false) => {
    let left = count, used = 0, q = 0;
    for (const l of g.stock[veg] ?? []) {
      if (!left) break;
      const k = Math.min(left, l.n);
      used += k; q += k * g.freshness(l); left -= k;
      if (!dry) l.n -= k;
    }
    if (!dry && g.stock[veg]) g.stock[veg] = g.stock[veg].filter((l) => l.n > 0);
    return { used, quality: used ? q / used : 1 };
  };

  // ---- 契約農家（新しい野菜） ----
  g.buyContract = (veg) => {
    const c = cfg.vegetables[veg]?.contract;
    if (!c) return { ok: false, error: 'その野菜は契約がいりません' };
    if (g.contracts.includes(veg)) return { ok: false, error: 'もう契約しています' };
    if (g.level().level < c.level) return { ok: false, error: `店のレベル${c.level}で契約できます` };
    if (g.money < c.cost) return { ok: false, error: 'お金が足りません' };
    g.money -= c.cost; g.stats.cost += c.cost; g.stats.invest = (g.stats.invest ?? 0) + c.cost;
    g.contracts.push(veg);
    return { ok: true, cost: c.cost };
  };

  // ---- 店の格上げ・樽の木桶・宣伝（data/upgrades.js） ----
  g.upgrades = []; // 買った店の格上げ
  g.barrelGrade = {}; // 樽ごとの格上げ { 樽の番号: id }
  g.campaigns = []; // いま効いている宣伝 [{ id, until（この区切りまで） }]
  const activeUps = () => [...g.upgrades, ...g.campaigns.filter((c) => c.until > g.tick).map((c) => c.id)].map((id) => cfg.upgrades[id]).filter(Boolean);
  /** 店の格上げと宣伝の効き目（掛け算のもの） */
  g.upgradeMult = (k) => activeUps().reduce((a, u) => a * (u.effects[k] ?? 1), 1);
  /** 足し算のもの（満足度・説明の通りやすさ） */
  g.upgradeAdd = (k) => activeUps().reduce((a, u) => a + (u.effects[k] ?? 0), 0);
  g.barrelUpgrade = (slot) => cfg.upgrades[g.barrelGrade[slot]] ?? null;
  g.campaignLeft = (id) => { const c = g.campaigns.find((x) => x.id === id && x.until > g.tick); return c ? (c.until - g.tick) / cal.ticksPerDay : 0; };
  /** 買う。barrel は slot（樽の番号）を選ぶ */
  g.buyUpgrade = (id, slot = null) => {
    const u = cfg.upgrades[id];
    if (!u) return { ok: false, error: 'それは売っていません' };
    if (g.level().level < u.level) return { ok: false, error: `店のレベル${u.level}で買えます` };
    if (u.requires && !g.upgrades.includes(u.requires)) return { ok: false, error: `先に「${cfg.upgrades[u.requires].name}」が要ります` };
    if (u.group === 'shop' && g.upgrades.includes(id)) return { ok: false, error: 'もう済んでいます' };
    if (u.group === 'barrel' && (g.barrels[slot] === undefined || g.barrelGrade[slot] === id)) return { ok: false, error: g.barrels[slot] === undefined ? '樽がありません' : 'もう替えてあります' };
    if (u.group === 'campaign' && g.campaignLeft(id) > 0) return { ok: false, error: 'まだ効いています' };
    if (g.money < u.cost) return { ok: false, error: 'お金が足りません' };
    g.money -= u.cost; g.stats.cost += u.cost; g.stats.invest = (g.stats.invest ?? 0) + u.cost;
    if (u.group === 'shop') g.upgrades.push(id);
    else if (u.group === 'barrel') g.barrelGrade[slot] = id;
    else g.campaigns = [...g.campaigns.filter((c) => c.until > g.tick && c.id !== id), { id, until: g.tick + u.days * cal.ticksPerDay }];
    return { ok: true, cost: u.cost, upgrade: u };
  };

  // ---- 従業員 ----
  g.staffDef = (id) => STAFF.find((s) => s.id === id);
  g.staffDoes = (k) => g.staff.map(g.staffDef).filter(Boolean).map((s) => s.does[k]).filter((v) => v != null);
  g.staffMult = (k) => g.staffDoes(k).reduce((a, v) => a * v, 1);
  g.wages = () => g.staff.reduce((s, id) => s + (g.staffDef(id)?.wage ?? 0), 0);
  g.hire = (id) => {
    const s = g.staffDef(id);
    if (!s) return { ok: false, error: 'その人はいません' };
    if (g.staff.includes(id)) return { ok: false, error: 'もう雇っています' };
    if (g.level().level < s.level) return { ok: false, error: `店のレベル${s.level}で雇えます` };
    if (g.money < s.hire) return { ok: false, error: 'お金が足りません' };
    g.money -= s.hire; g.stats.cost += s.hire; g.stats.invest = (g.stats.invest ?? 0) + s.hire;
    g.staff.push(id);
    return { ok: true, cost: s.hire, line: s.hello };
  };
  g.fire = (id) => { if (!g.staff.includes(id)) return { ok: false, error: '雇っていません' }; g.staff = g.staff.filter((x) => x !== id); return { ok: true }; };

  // ---- 毎朝（日が変わったとき）: 在庫が傷む、維持費とお給料、従業員の仕事 ----
  g.upkeep = () => cfg.upkeep.base + cfg.upkeep.perBarrel * g.barrels.length;
  g.newDay = () => {
    // 古い野菜は捨てる
    let spoiled = 0;
    for (const [veg, lots] of Object.entries(g.stock)) {
      g.stock[veg] = lots.filter((l) => { const bad = g.stockAge(l) > cfg.stock.spoilDays; if (bad) spoiled += l.n; return !bad; });
      if (!g.stock[veg].length) delete g.stock[veg];
    }
    if (spoiled) g.events.push({ type: 'stockSpoiled', n: spoiled });
    // 維持費とお給料。払えない人は辞める（高い人から）
    // 払えない分は大家さんが待ってくれる（お金はマイナスにならない）
    const up = Math.min(g.upkeep(), Math.max(0, g.money));
    if (up < g.upkeep()) g.events.push({ type: 'upkeepShort', short: g.upkeep() - up });
    g.money -= up; g.stats.cost += up; g.stats.upkeep = (g.stats.upkeep ?? 0) + up;
    let wages = 0;
    for (const id of [...g.staff].sort((a, b) => g.staffDef(b).wage - g.staffDef(a).wage)) {
      const s = g.staffDef(id);
      if (g.money >= s.wage) { g.money -= s.wage; wages += s.wage; } else { g.staff = g.staff.filter((x) => x !== id); g.events.push({ type: 'staffQuit', id, name: s.name, line: s.quit }); }
    }
    g.stats.cost += wages; g.stats.wages = (g.stats.wages ?? 0) + wages;
    g.lastUpkeep = { day: g.day(), upkeep: up, wages };
    // 従業員の朝の仕事
    if (g.staffDoes('stir').length && g.nuka.lastStirDay !== g.day()) g.stirNuka();
    if (g.staffDoes('film').length) g.barrels.forEach((b, i) => { if (b && cfg.pickles[b.pickle].umezu && (b.exposed ?? 0) > 0.1) g.sink(i); }); // 梅も沈めておいてくれる
    if (g.staffDoes('film').length) g.barrels.forEach((b, i) => { if (b && cfg.pickles[b.pickle].film && !cfg.pickles[b.pickle].usesNukaBed && b.film >= cfg.care.filmHarmless) g.care(i); });
    if (g.staffDoes('handwork').length) g.barrels.forEach((b, i) => { // 職人の弟子: 重石と工程
      if (!b || g.dryingLeft(b) > 0) return;
      const p = cfg.pickles[b.pickle], t = g.tasteOf(i);
      if (p.weight && t.waterUp >= 1 && (b.weights?.at(-1)?.w ?? 1) > 1) g.setWeight(i, 'light');
      for (const s of p.work) if (b.work?.[s.id] == null && g.fermentDays(b) >= s.window[0]) g.doWork(i, s.id);
    });
    // 種が絶えても、冬のはじめには木曽から種が届く（すんき。段階F）
    for (const [id, p] of Object.entries(cfg.pickles)) {
      if (p.starterAfter && g.knows(id) && !g.recipes[id].starterReady && g.day() - g.recipes[id].day >= p.starterAfter) { g.recipes[id].starterReady = true; g.tane[p.starter] = Math.max(1, g.tane[p.starter] ?? 0); g.events.push({ type: 'starterReady', pickle: id }); continue; }
      if (p.starter && !p.starterAfter && g.knows(id) && !(g.tane[p.starter] > 0) && g.season() === 'winter' && g.dayOfSeason() === 1 && !g.barrels.some((b) => b?.pickle === id)) { g.tane[p.starter] = 1; g.events.push({ type: 'taneArrived', pickle: id }); }
    }
    g.wisdomMorning(); // 梅子さん（知恵袋のおばあちゃん）
    // 地方の便り: 地方の枠に入れた地方から、ときどき作り方の便りが届く（全国の漬物。data/regional.js）
    if (g.day() % cfg.letterEvery === 0) {
      const cand = Object.entries(cfg.pickles).filter(([id, p]) => p.unlock?.via === 'letter' && !g.knows(id) && g.regions.includes(p.region));
      if (cand.length) {
        const [id, p] = cand[Math.floor(hash01(g.seed, g.day(), 'letter') * cand.length)];
        g.learn(id, 'letter', p.unlock.line);
      }
    }
    const ev = g.event();
    if (ev && ev.from === g.dayOfSeason()) g.events.push({ type: 'season', id: ev.id, name: ev.name, note: ev.note });
    if (g.peddlerOffer()) g.events.push({ type: 'peddler' });
  };

  // ---- 客の年代と、減塩の流れ ----
  /** 今年の年代ごとの割合 */
  g.ageShares = () => {
    const y = g.year() - 1;
    const raw = Object.fromEntries(Object.entries(AGES).map(([k, a]) => [k, Math.max(0.05, a.share + a.perYear * y)]));
    const sum = Object.values(raw).reduce((a, b) => a + b, 0);
    return Object.fromEntries(Object.entries(raw).map(([k, v]) => [k, v / sum]));
  };
  g.pickAge = () => {
    let r = rng();
    for (const [k, v] of Object.entries(g.ageShares())) { r -= v; if (r < 0) return k; }
    return 'middle';
  };
  /** 年代と、年ごとの減塩の流れで、好む塩味がずれる */
  g.saltShift = (age) => (AGES[age]?.salt ?? 0) + Math.max(cfg.trend.saltMin, cfg.trend.saltPerYear * (g.year() - 1));
  g.customerFor = (c, age) => ({ ...c, target: { ...c.target, salt: c.target.salt + g.saltShift(age) } });

  // ---- 常連の名前と物語 ----
  g.regularName = (id) => REGULAR_NAMES[(id - 1) % REGULAR_NAMES.length];
  g.storiesOf = (r) => STORIES[r.reformed ? 'reformed' : r.type] ?? [];
  /** 常連をとても満足させたとき: 絆が深まり、章が開くと物語と評判 */
  g.deepenBond = (r) => {
    r.bond = (r.bond ?? 0) + 1;
    if (r.granny) { g.grannyBond(r); return null; } // 梅子さんは、物語のかわりに知恵と作り方を教えてくれる（wisdom.js）
    const ch = g.storiesOf(r).find((c) => c.bond === r.bond);
    if (!ch) return null;
    r.chapters = [...(r.chapters ?? []), ch.bond];
    g.reputation = Math.min(100, g.reputation + cfg.bond.storyRep);
    const ev = { type: 'story', id: r.id, name: r.name ?? g.regularName(r.id), title: ch.title, text: ch.text };
    g.events.push(ev);
    return ev;
  };

  // ---- 行商人（作り方を売りに来る） ----
  /** 今日の行商人の売り物 { pickle, price }（来ない日・売る物がない日は null） */
  g.peddlerOffer = () => {
    const pd = cfg.peddler;
    if (g.day() % pd.every !== pd.onDay % pd.every) return null;
    const ids = Object.entries(cfg.pickles).filter(([id, p]) => p.unlock && !g.knows(id) && p.unlock.via !== 'taught').sort((a, b) => a[1].level - b[1].level);
    if (!ids.length) return null;
    const [id, p] = ids[Math.floor(hash01(g.seed, g.day(), 'peddler') * ids.length)];
    return { pickle: id, price: pd.pricePerLevel * p.level };
  };
  g.buyRecipe = () => {
    const o = g.peddlerOffer();
    if (!o) return { ok: false, error: '今日は行商人が来ていない' };
    if (g.money < o.price) return { ok: false, error: 'お金が足りません' };
    g.money -= o.price; g.stats.cost += o.price;
    g.learn(o.pickle, 'bought', '行商人「この巻物はね、ひいひいじいさんの代から…（長いので省略）」');
    return { ok: true, cost: o.price, pickle: o.pickle };
  };
}

export { EVENTS, STAFF, AGES };
