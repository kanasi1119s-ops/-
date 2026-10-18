// バランスの点検: 決まった作戦でゲームを自動で遊び、もうけを比べる。  node scripts/balance.js [日数]
// 実際の game.js をそのまま使う（客の来方・天気・季節・1時間帯1回の販売も本番どおり）。
import { createGame } from '../src/game.js';
import { CONFIG } from '../src/config.js';

const DAYS = Number(process.argv[2] || 112); // 既定は4季節
const SEEDS = 30;

// 作戦: 空いた樽に recipe(季節) を仕込み、食べ頃（stage が ripe）になった樽から売る
const NUKA = { veg: 'kyuri', pickle: 'nukazuke', tempC: 20 };
const TAKUAN = { veg: 'daikon', pickle: 'takuan', saltPct: 5, tempC: 20, additives: ['zarame', 'kombu'] };
const STRATEGIES = {
  '浅漬け（きゅうり）を回す': () => ({ veg: 'kyuri', pickle: 'asazuke', saltPct: 3.5, tempC: 28 }),
  '浅漬け（白菜）を回す': () => ({ veg: 'hakusai', pickle: 'asazuke', saltPct: 2.5, tempC: 20 }),
  '白菜漬けを育てる（20℃）': () => ({ veg: 'hakusai', pickle: 'hakusaizuke', saltPct: 3, tempC: 20 }),
  '白菜漬けを育てる（外気温）': (g) => ({ veg: 'hakusai', pickle: 'hakusaizuke', saltPct: 3, tempC: g.ambientTemp() }),
  '白菜漬け2樽＋浅漬け1樽': (g, slot) => (slot === 2 ? { veg: 'kyuri', pickle: 'asazuke', saltPct: 3.5, tempC: 28 } : { veg: 'hakusai', pickle: 'hakusaizuke', saltPct: 3, tempC: 20 }),
  'ぬか漬け（きゅうり）を回す': () => NUKA,
  '白菜漬け＋浅漬け＋ぬか漬け': (g, slot) => [{ veg: 'hakusai', pickle: 'hakusaizuke', saltPct: 3, tempC: 20 }, { veg: 'kyuri', pickle: 'asazuke', saltPct: 3.5, tempC: 28 }, NUKA][slot],
  // 段階5: 種類と調味
  '白菜漬け＋昆布・唐辛子（20℃）': () => ({ veg: 'hakusai', pickle: 'hakusaizuke', saltPct: 3, tempC: 20, additives: ['kombu', 'togarashi'] }),
  '白菜漬け＋ざらめ・ゆず（相性△）': () => ({ veg: 'hakusai', pickle: 'hakusaizuke', saltPct: 3, tempC: 20, additives: ['zarame', 'yuzu'] }),
  'たくあん3樽（5%・20℃、ざらめ・昆布）': () => TAKUAN,
  'たくあん1＋白菜漬け1＋ぬか漬け1': (g, slot) => [TAKUAN, { veg: 'hakusai', pickle: 'hakusaizuke', saltPct: 3, tempC: 20, additives: ['kombu', 'togarashi'] }, { ...NUKA, additives: ['kombu', 'togarashi'] }][slot],
  '旬で回す（夏なす浅漬け／冬野沢菜）': (g) => (g.season() === 'summer' ? { veg: 'nasu', pickle: 'asazuke', saltPct: 2.5, tempC: 20, additives: ['kombu'] }
    : g.season() === 'winter' ? { veg: 'nozawana', pickle: 'nozawanazuke', saltPct: 3, tempC: 20, additives: ['togarashi'] }
      : { veg: 'hakusai', pickle: 'hakusaizuke', saltPct: 3, tempC: 20, additives: ['kombu', 'togarashi'] }),
};

function play(strategy, seed, careful) {
  const g = createGame({ seed });
  const start = g.money;
  const lvDay = {};
  while (g.day() <= DAYS) {
    for (const e of g.popEvents()) if (e.type === 'levelup') lvDay[e.level] ??= g.day();
    g.barrels.forEach((b, i) => { if (!b) g.brew(i, strategy(g, i)); });
    if (careful) { // 手入れする人: 膜が見えたら取る、ぬか床は毎朝かき混ぜ、酸っぱければ塩、水っぽければぬか、捨て漬けも替える
      g.barrels.forEach((b, i) => { if (b && g.tasteOf(i).filmVisible) g.care(i); });
      if (g.timeOfDay() === 'morning') g.stirNuka();
      if (g.nuka.sour > 0.5) g.saltNuka();
      if ((g.nuka.water ?? 0) > 0.5) g.nukaCare('nuka'); // 水っぽければぬかと塩を足す（段階B）
      if (g.daysSinceSute() > g.cfg.nuka.suteEveryDays - 1) g.nukaCare('sute'); // 捨て漬けを替える
    }
    if (g.isOpen()) {
      // 熟れている順（過熟・酸っぱすぎに近いもの）から1つ売る
      const ready = g.barrels.map((b, i) => ({ i, t: b && g.tasteOf(i) })).filter((x) => x.t && x.t.stage !== 'raw').sort((a, b) => b.t.ratio - a.t.ratio);
      if (ready.length) g.sell(ready[0].i);
    }
    g.advance(1);
  }
  const known = Object.keys(g.recipes).filter((id) => g.cfg.pickles[id].unlock).length;
  return { profit: g.money - start, sold: g.stats.sold, spoiled: g.stats.spoiled, level: g.level().level, lv3: lvDay[3] ?? DAYS + 1, lv5: lvDay[5] ?? DAYS + 1, known };
}

console.log(`■ ${DAYS}日遊んだときのもうけ（${SEEDS}回の平均）`);
console.log('作戦                          利益/日（手入れする / しない）  売れた個数/日  傷んだ樽   店Lv  Lv3の日 Lv5の日 ひらめき');
for (const [name, s] of Object.entries(STRATEGIES)) {
  const run = (careful) => {
    const rs = Array.from({ length: SEEDS }, (_, i) => play(s, i + 1, careful));
    return (k) => rs.reduce((a, r) => a + r[k], 0) / rs.length;
  };
  const a = run(true), b = run(false);
  console.log(`${name.padEnd(16, '　')} ${String(Math.round(a('profit') / DAYS)).padStart(6)}円 / ${String(Math.round(b('profit') / DAYS)).padStart(5)}円  ${(a('sold') / DAYS).toFixed(1).padStart(10)}個  ${a('spoiled').toFixed(1).padStart(6)}  ${a('level').toFixed(1).padStart(6)} ${a('lv3').toFixed(0).padStart(7)} ${a('lv5').toFixed(0).padStart(7)} ${a('known').toFixed(1).padStart(6)}`);
}
console.log(`（店Lv・Lvの日・ひらめきは手入れする場合。届かなければ ${DAYS + 1}日。ひらめきは隠れた作り方を覚えた数。作戦は決まった作り方しか仕込まない）`);
console.log(`\n（価格: 浅漬け ${CONFIG.pickles.asazuke.price}円 / 白菜漬け ${CONFIG.pickles.hakusaizuke.price}円、仕入れ: 白菜 ${CONFIG.vegetables.hakusai.cost}円 / きゅうり ${CONFIG.vegetables.kyuri.cost}円）`);
