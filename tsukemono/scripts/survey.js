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
