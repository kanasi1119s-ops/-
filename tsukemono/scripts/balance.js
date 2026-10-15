// バランスの点検: 決まった作戦でゲームを自動で遊び、もうけを比べる。  node scripts/balance.js [日数]
// 実際の game.js をそのまま使う（客の来方・天気・季節・1時間帯1回の販売も本番どおり）。
import { createGame } from '../src/game.js';
import { CONFIG } from '../src/config.js';

const DAYS = Number(process.argv[2] || 112); // 既定は4季節
const SEEDS = 30;

// 作戦: 空いた樽に recipe(季節) を仕込み、食べ頃（stage が ripe）になった樽から売る
const STRATEGIES = {
  '浅漬け（きゅうり）を回す': () => ({ veg: 'kyuri', pickle: 'asazuke', saltPct: 3.5, tempC: 28 }),
  '浅漬け（白菜）を回す': () => ({ veg: 'hakusai', pickle: 'asazuke', saltPct: 2.5, tempC: 20 }),
  '白菜漬けを育てる（20℃）': () => ({ veg: 'hakusai', pickle: 'hakusaizuke', saltPct: 3, tempC: 20 }),
  '白菜漬けを育てる（外気温）': (g) => ({ veg: 'hakusai', pickle: 'hakusaizuke', saltPct: 3, tempC: g.ambientTemp() }),
  '白菜漬け2樽＋浅漬け1樽': (g, slot) => (slot === 2 ? { veg: 'kyuri', pickle: 'asazuke', saltPct: 3.5, tempC: 28 } : { veg: 'hakusai', pickle: 'hakusaizuke', saltPct: 3, tempC: 20 }),
};

function play(strategy, seed) {
  const g = createGame({ seed });
  const start = g.money;
  while (g.day() <= DAYS) {
    g.barrels.forEach((b, i) => { if (!b) g.brew(i, strategy(g, i)); });
    if (g.isOpen()) {
      // 熟れている順（過熟・酸っぱすぎに近いもの）から1つ売る
      const ready = g.barrels.map((b, i) => ({ i, t: b && g.tasteOf(i) })).filter((x) => x.t && x.t.stage !== 'raw').sort((a, b) => b.t.ratio - a.t.ratio);
      if (ready.length) g.sell(ready[0].i);
    }
    g.advance(1);
  }
  return { profit: g.money - start, sold: g.stats.sold, spoiled: g.stats.spoiled };
}

console.log(`■ ${DAYS}日遊んだときのもうけ（${SEEDS}回の平均）`);
console.log('作戦                          利益/日    売れた個数/日  傷んだ樽');
for (const [name, s] of Object.entries(STRATEGIES)) {
  const rs = Array.from({ length: SEEDS }, (_, i) => play(s, i + 1));
  const avg = (k) => rs.reduce((a, r) => a + r[k], 0) / rs.length;
  console.log(`${name.padEnd(16, '　')} ${String(Math.round(avg('profit') / DAYS)).padStart(6)}円  ${(avg('sold') / DAYS).toFixed(1).padStart(10)}個  ${avg('spoiled').toFixed(1).padStart(6)}`);
}
console.log(`\n（価格: 浅漬け ${CONFIG.pickles.asazuke.price}円 / 白菜漬け ${CONFIG.pickles.hakusaizuke.price}円、仕入れ: 白菜 ${CONFIG.vegetables.hakusai.cost}円 / きゅうり ${CONFIG.vegetables.kyuri.cost}円）`);
