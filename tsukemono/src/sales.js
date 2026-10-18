// 客の満足度・売上の計算（乱数なし）。
import { CONFIG } from './config.js';
import { GREAT, AWFUL } from '../data/reactions.js';

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
  if ([].concat(customer.likes).includes(pickle)) sat += s.likeBonus;
  sat += (taste.harmony ?? 0) * (cfg.affinitySatBonus ?? 0); // 調味の相性
  // 未熟は 0.5〜1.0 倍（過熟・酸っぱすぎは酸味のズレで下がる）
  const win = cfg.pickles[pickle].window;
  if (taste.ratio < win.lo) sat *= s.unripeMinFactor + (1 - s.unripeMinFactor) * (taste.ratio / win.lo);
  sat *= s.stageFactor[taste.stage] ?? 1;
  sat *= taste.careFactor ?? 1; // 白い膜が張っていると下がる
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
  film: ['膜っぽいにおいがするね', '表面がちょっと白いよ', '手入れが足りないんじゃない？'],
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
/**
 * お客の反応。とても満足（とてもがっかり）すると、大げさに反応する（over: true。data/reactions.js）。
 * 秘伝の漬物は、満足の境目が低く、専用の大げさな反応がある（data/hiden.js の over）。
 */
export function reactionOf(taste, pickle, customer, sat, season = 'spring', cfg = CONFIG, variant = 0) {
  const r = plainReaction(taste, pickle, customer, sat, season, cfg, variant);
  const o = cfg.over, p = cfg.pickles[pickle];
  if (!o || r.key === 'rotten' || r.key === 'film') return r;
  const n = variant + Math.floor(sat * 7);
  if (sat >= (p?.hiden ? o.hidenSat : o.sat)) {
    const pool = p?.over?.length ? p.over : [...(GREAT[customer.id] ?? []), ...GREAT.generic];
    return { key: 'great', over: true, line: pool[n % pool.length] };
  }
  if (sat < o.awfulSat && AWFUL[r.key] && variant % 2 === 0) return { key: r.key, over: true, line: AWFUL[r.key][n % AWFUL[r.key].length] };
  return r;
}

function plainReaction(taste, pickle, customer, sat, season, cfg, variant) {
  if (taste.spoilRisk >= 60 && sat < cfg.sales.buyThreshold) return { key: 'rotten', line: pick('rotten', variant) };
  const target = targetFor(customer, season, cfg);
  if (taste.filmVisible && sat < 60) return { key: 'film', line: pick('film', variant) };
  const praise = cfg.pickles[pickle]?.praise; // 漬物ごとのほめ言葉（data/pickles.js。あれば半分の確率で）
  if (sat >= 60 && praise?.length && variant % 2 === 0) return { key: sat >= 80 ? 'great' : 'good', line: praise[(variant + Math.floor(sat)) % praise.length] };
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
