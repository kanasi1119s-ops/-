// 客の満足度・売上の計算（乱数なし）。
import { CONFIG } from './config.js';

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const AXES = ['acid', 'salt', 'texture', 'complexity'];
const TASTE_KEY = { acid: 'acid', salt: 'saltiness', texture: 'texture', complexity: 'complexity' };

/** 季節で少し変わる客の理想の味。 */
export function targetFor(customer, season, cfg = CONFIG) {
  const shift = cfg.season[season]?.prefShift ?? {};
  const t = {};
  for (const a of AXES) t[a] = clamp(customer.target[a] + (shift[a] ?? 0), 0, 100);
  return t;
}

/**
 * 満足度(0〜100)を返す。
 * taste は model.simulate の結果、pickle は漬物のid。
 */
export function satisfaction(taste, pickle, customer, season = 'spring', cfg = CONFIG) {
  const s = cfg.sales;
  const target = targetFor(customer, season, cfg);
  let sum = 0, wsum = 0;
  for (const a of AXES) {
    const w = customer.weights[a];
    sum += w * Math.abs(taste[TASTE_KEY[a]] - target[a]);
    wsum += w;
  }
  let sat = 100 - (sum / wsum) * s.satScale;
  if (customer.likes === pickle) sat += s.likeBonus;
  // 未熟は 0.5〜1.0 倍（過熟・酸っぱすぎは酸味のズレで下がる）
  const win = cfg.pickles[pickle].window;
  if (taste.ratio < win.lo) sat *= s.unripeMinFactor + (1 - s.unripeMinFactor) * (taste.ratio / win.lo);
  sat *= s.stageFactor[taste.stage] ?? 1;
  // 傷みリスクは期待値として引く
  sat *= 1 - s.spoilSatPenalty * (taste.spoilRisk / 100);
  return clamp(sat, 0, 100);
}

/** 満足度に応じた支払額(円)。買わないなら0。 */
export function priceFor(sat, pickle, cfg = CONFIG) {
  const s = cfg.sales;
  if (sat < s.buyThreshold) return 0;
  const f = s.priceMin + (s.priceMax - s.priceMin) * (sat / 100);
  return Math.round((cfg.pickles[pickle].price * f) / 10) * 10;
}

/** 最もズレた軸から客の一言を決める。 */
export function reactionOf(taste, pickle, customer, sat, season = 'spring', cfg = CONFIG) {
  if (taste.spoilRisk >= 60 && sat < cfg.sales.buyThreshold) return { key: 'rotten', line: 'なんだか傷んでない？' };
  const target = targetFor(customer, season, cfg);
  if (sat >= 80) return { key: 'great', line: 'これだよ、これ！' };
  if (sat >= 60) return { key: 'good', line: 'うん、おいしい' };
  let worst = null, worstD = 0;
  for (const a of AXES) {
    const d = (taste[TASTE_KEY[a]] - target[a]) * customer.weights[a];
    if (Math.abs(d) > Math.abs(worstD)) { worst = a; worstD = d; }
  }
  const high = worstD > 0;
  const table = {
    acid: [high, '酸っぱいねぇ', 'まだ酸味が足りないな'],
    salt: [high, 'しょっぱいなぁ', '味が薄いねぇ'],
    texture: [high, '硬いかな', 'くたっとしてるな'],
    complexity: [high, '凝りすぎかな', '風味が単調だね'],
  };
  const [h, hi, lo] = table[worst];
  return { key: `${worst}_${high ? 'high' : 'low'}`, line: h ? hi : lo };
}
