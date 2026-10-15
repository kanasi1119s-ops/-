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

// 客の一言（ズレの種類ごとに数通り。variant で選ぶ） 【仮置き】
export const LINES = {
  rotten: ['なんだか傷んでない？', '……これ、大丈夫？', 'においが変だよ'],
  great: ['これだよ、これ！', '最高の漬かり具合だ！', 'また買いに来るよ！'],
  good: ['うん、おいしい', 'いい塩梅だね', 'ご飯が進みそう'],
  acid_high: ['酸っぱいねぇ', 'ちょっと漬かりすぎかな', '酸味が強いなぁ'],
  acid_low: ['まだ酸味が足りないな', 'もう少し漬けてもいいかも', '浅いねぇ'],
  salt_high: ['しょっぱいなぁ', '塩がきついね', '喉が渇きそう'],
  salt_low: ['味が薄いねぇ', 'もうちょっと塩気がほしい', '物足りないかな'],
  texture_high: ['硬いかな', '歯ごたえがありすぎる', 'まだ生っぽいね'],
  texture_low: ['くたっとしてるな', '食感がもう少しほしい', 'やわらかすぎるね'],
  complexity_high: ['凝りすぎかな', '味が濃いなぁ', 'クセが強いね'],
  complexity_low: ['風味が単調だね', 'もう少し深みがほしい', '味に奥行きがないな'],
};
const pick = (key, variant) => { const l = LINES[key]; return l[((variant % l.length) + l.length) % l.length]; };

/** 最もズレた軸から客の一言を決める。variant で言い回しを変える。 */
export function reactionOf(taste, pickle, customer, sat, season = 'spring', cfg = CONFIG, variant = 0) {
  if (taste.spoilRisk >= 60 && sat < cfg.sales.buyThreshold) return { key: 'rotten', line: pick('rotten', variant) };
  const target = targetFor(customer, season, cfg);
  if (sat >= 80) return { key: 'great', line: pick('great', variant) };
  if (sat >= 60) return { key: 'good', line: pick('good', variant) };
  let worst = null, worstD = 0;
  for (const a of AXES) {
    const d = (taste[TASTE_KEY[a]] - target[a]) * customer.weights[a];
    if (Math.abs(d) > Math.abs(worstD)) { worst = a; worstD = d; }
  }
  const key = `${worst}_${worstD > 0 ? 'high' : 'low'}`;
  return { key, line: pick(key, variant) };
}
