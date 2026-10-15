// 確認用スクリプト: 条件を変えたときの味を一覧する。  node scripts/survey.js
import { CONFIG } from '../src/config.js';
import { simulate, daysToRipe, ripeRangeDays } from '../src/model.js';
import { satisfaction, priceFor } from '../src/sales.js';

const f = (v, w = 5, d = 0) => String(v.toFixed(d)).padStart(w);
const base = { veg: 'hakusai', pickle: 'hakusaizuke' };

console.log('■ 食べ頃までの日数（白菜漬け）  行=塩分% 列=温度℃');
const temps = [4, 10, 15, 20, 25, 30, 40];
console.log('      ' + temps.map((t) => f(t, 7)).join(''));
for (const s of [2, 3, 5, 10, 20]) {
  console.log(f(s, 4) + '% ' + temps.map((t) => f(daysToRipe({ ...base, saltPct: s, tempC: t }), 7, 1)).join(''));
}

console.log('\n■ 傷みのリスク%（食べ頃の日に売ったとき）  行=塩分% 列=温度℃');
console.log('      ' + temps.map((t) => f(t, 7)).join(''));
for (const s of [1, 2, 3, 5, 10]) {
  console.log(f(s, 4) + '% ' + temps.map((t) => {
    const p = { ...base, saltPct: s, tempC: t };
    return f(simulate({ ...p, days: daysToRipe(p) }).spoilRisk, 7, 0);
  }).join(''));
}

function table(title, p, days) {
  console.log(`\n■ ${title}`);
  console.log('日数  段階        酸味 塩味 食感 複雑 傷み%   ' + CONFIG.customers.map((c) => c.name.padEnd(8, '　')).join(''));
  for (const d of days) {
    const t = simulate({ ...p, days: d });
    const sats = CONFIG.customers.map((c) => {
      const s = satisfaction(t, p.pickle, c, 'spring');
      return `${f(s, 3)}/${String(priceFor(s, p.pickle)).padStart(3)}`.padEnd(10);
    });
    console.log(`${f(d, 4, 1)}  ${t.stageLabel.padEnd(6, '　')}  ${f(t.acid, 4)}${f(t.saltiness, 5)}${f(t.texture, 5)}${f(t.complexity, 5)}${f(t.spoilRisk, 6)}   ` + sats.join(' '));
  }
}
table('白菜漬け 塩3%・20℃（満足度/支払額）', { ...base, saltPct: 3, tempC: 20 }, [1, 3, 5, 6, 7, 8, 10, 12, 14, 21, 28]);
table('白菜漬け 塩5%・15℃', { ...base, saltPct: 5, tempC: 15 }, [3, 7, 10, 14, 17, 21, 28]);
table('白菜漬け 塩2%・28℃', { ...base, saltPct: 2, tempC: 28 }, [1, 2, 3, 4, 5, 7, 10]);
table('浅漬け 白菜 塩2.5%・20℃', { veg: 'hakusai', pickle: 'asazuke', saltPct: 2.5, tempC: 20 }, [0.25, 0.5, 1, 2, 3, 5, 7]);
table('浅漬け きゅうり 塩2.5%・20℃', { veg: 'kyuri', pickle: 'asazuke', saltPct: 2.5, tempC: 20 }, [0.25, 0.5, 1, 2, 3, 5, 7]);

// ■ バランスの点検: 客の好みがランダム（5タイプ均等）のとき、1人あたりの売上の期待値が高い条件
{
  const rows = [];
  for (const [pickle, pk] of Object.entries(CONFIG.pickles)) for (const veg of pk.vegetables) {
    for (let salt = 1.5; salt <= 10; salt += 0.5) for (const temp of [5, 10, 15, 20, 25, 28, 32]) {
      const p = { veg, pickle, saltPct: salt, tempC: temp };
      const ripe = daysToRipe(p);
      for (const k of [0.6, 0.85, 1, 1.15, 1.3, 1.6, 2]) {
        const days = ripe * k;
        if (days > 40) continue;
        const t = simulate({ ...p, days });
        let ev = 0;
        for (const c of CONFIG.customers) ev += priceFor(satisfaction(t, pickle, c, 'spring'), pickle) * (1 - t.spoilRisk / 100);
        ev /= CONFIG.customers.length;
        const cost = CONFIG.vegetables[veg].cost + salt * CONFIG.sales.saltCostPerPct;
        rows.push({ pickle, veg, salt, temp, days, ev, perDay: (ev * CONFIG.sales.portionsPerBatch - cost) / Math.max(0.5, days) });
      }
    }
  }
  const show = (title, key) => {
    console.log(`\n■ ${title}`);
    console.log('漬物      野菜     塩%  温度  日数   1人あたり売上  1日あたり利益');
    for (const r of [...rows].sort((a, b) => b[key] - a[key]).slice(0, 8)) {
      console.log(`${CONFIG.pickles[r.pickle].name.padEnd(5, '　')} ${CONFIG.vegetables[r.veg].name.padEnd(4, '　')} ${f(r.salt, 4, 1)} ${f(r.temp, 4)} ${f(r.days, 6, 1)}   ${f(r.ev, 8)}円   ${f(r.perDay, 9)}円`);
    }
  };
  show('1人あたりの売上が高い条件（客の好みはランダム）', 'ev');
  show('1日あたりの利益が高い条件（6個すべて売れたとして）', 'perDay');
}
