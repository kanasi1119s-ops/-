// 味のモデル（画面なし・乱数なし）。入力が同じなら結果は必ず同じ。
import { CONFIG } from './config.js';

/** 区間線形補間。table は [[x, y], ...]（xの昇順）。範囲外は端の値。 */
export function interpolate(table, x) {
  if (x <= table[0][0]) return table[0][1];
  const last = table[table.length - 1];
  if (x >= last[0]) return last[1];
  for (let i = 1; i < table.length; i++) {
    const [x1, y1] = table[i];
    if (x <= x1) {
      const [x0, y0] = table[i - 1];
      return y0 + ((y1 - y0) * (x - x0)) / (x1 - x0);
    }
  }
  return last[1];
}

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

/** 1日あたりの発酵の進み（標準日/日）。 */
export function fermentRate({ veg, saltPct, tempC }, cfg = CONFIG) {
  const f = cfg.ferment;
  return (
    f.baseProgressPerDay *
    cfg.vegetables[veg].fermentRate *
    interpolate(f.tempCoef, tempC) *
    interpolate(f.saltCoef, saltPct)
  );
}

/** 風味の複雑さにかかる温度の係数（0〜1）。 */
export function complexityTempFactor(tempC, cfg = CONFIG) {
  const t = cfg.taste;
  const [lo, hi] = t.complexityBestTemp;
  let f = 1;
  if (tempC < lo) f = 1 - (lo - tempC) * t.complexityLowSlope;
  else if (tempC > hi) f = 1 - (tempC - hi) * t.complexityHighSlope;
  return clamp(f, t.complexityMinFactor, 1);
}

/** 1日あたりの傷みの危険度。 */
export function spoilHazard({ veg, saltPct, tempC, additives }, cfg = CONFIG) {
  const s = cfg.spoil;
  const add = (additives ?? []).reduce((m, a) => m * (cfg.additives[a]?.spoil ?? 1), 1); // 唐辛子は傷みにくくする
  return (
    add * s.basePerDay *
    cfg.vegetables[veg].spoilMult *
    interpolate(s.saltTable, saltPct) *
    interpolate(s.tempTable, tempC)
  );
}

/** 進み(標準日)と食べ頃の比から段階を決める。 */
export function stageOf(ratio, window) {
  if (ratio < window.lo) return 'raw';
  if (ratio <= window.hi) return 'ripe';
  if (ratio <= window.sour) return 'over';
  return 'sour';
}
export const STAGE_LABEL = {
  raw: 'まだ早い',
  ripe: '食べ頃',
  over: '過熟ぎみ',
  sour: '酸っぱすぎ',
};

/**
 * 漬物の状態を計算する。
 * @param {{veg:string, pickle:string, saltPct:number, tempC:number, days:number}} p
 * @returns 酸味・塩味・食感・風味の複雑さ・傷みのリスク（0〜100の目安）と段階
 */
export function simulate(p, cfg = CONFIG) {
  const veg = cfg.vegetables[p.veg];
  const pickle = cfg.pickles[p.pickle];
  if (!veg) throw new Error(`unknown veg: ${p.veg}`);
  if (!pickle) throw new Error(`unknown pickle: ${p.pickle}`);
  const days = Math.max(0, p.days);
  const t = cfg.taste;

  const rate = fermentRate(p, cfg);
  const progress = rate * days;
  const ratio = progress / pickle.ripeAt;
  const stage = stageOf(ratio, pickle.window);

  const half = pickle.acidHalfProgress ?? t.acidHalfProgress;
  const acid = (100 * progress) / (progress + half);

  const absorbed = 1 - Math.exp(-days / t.saltAbsorbTauDays);
  const saltiness = (100 * p.saltPct * (pickle.saltUptake ?? 1) * absorbed) / t.saltFullPct;

  const spoilRisk = 100 * (1 - Math.exp(-spoilHazard(p, cfg) * days));

  const crisp = veg.crisp0 * (p.quality ?? 1) * Math.exp(-progress / veg.crispTau); // quality = 旬の品質
  const texture = crisp * (1 - cfg.texture.spoilPenalty * (spoilRisk / 100));

  const maturity = Math.sqrt(Math.min(1, ratio));
  const complexity = pickle.complexityMax * maturity * complexityTempFactor(p.tempC, cfg);

  const base = { progress, ratio, stage, stageLabel: STAGE_LABEL[stage], acid, saltiness, texture, complexity, spoilRisk, rate };
  return p.additives?.length ? withAdditives(base, p, maturity, absorbed, cfg) : base;
}

/** 漬物と調味の相性。'good' / 'bad' / 'neutral' */
export function affinityOf(pickle, additive, cfg = CONFIG) {
  return cfg.affinity[pickle]?.[additive] ?? 'neutral';
}

// 調味の効き目（漬かるほど効く）。相性が良ければそのまま、ふつうは半分、悪いと風味が濁る
function withAdditives(t, p, maturity, absorbed, cfg) {
  const c = (v) => Math.min(100, Math.max(0, v));
  let { complexity, saltiness, acid } = t, harmony = 0;
  for (const id of p.additives) {
    const a = cfg.additives[id];
    if (!a) continue;
    const aff = affinityOf(p.pickle, id, cfg);
    const f = aff === 'good' ? 1 : aff === 'bad' ? 0 : cfg.affinityNeutralFactor;
    complexity += a.complexity * f * maturity;
    if (aff === 'bad') complexity -= cfg.affinityBadPenalty * maturity;
    harmony += aff === 'good' ? maturity : aff === 'bad' ? -maturity : 0; // 漬かるほど効く
    saltiness += a.salt * absorbed;
    acid += a.acid * maturity;
  }
  return { ...t, complexity: c(complexity), saltiness: c(saltiness), acid: c(acid), harmony };
}

/** 食べ頃（比=1）になるまでの日数。 */
export function daysToRipe(p, cfg = CONFIG) {
  return cfg.pickles[p.pickle].ripeAt / fermentRate(p, cfg);
}

/** 食べ頃の範囲（日数）。 */
export function ripeRangeDays(p, cfg = CONFIG) {
  const w = cfg.pickles[p.pickle].window;
  const per = fermentRate(p, cfg);
  const ripeAt = cfg.pickles[p.pickle].ripeAt;
  return { from: (ripeAt * w.lo) / per, to: (ripeAt * w.hi) / per, sourFrom: (ripeAt * w.sour) / per };
}

/** 白い膜が1日に増える量（温度で決まる）。 */
export function filmPerDay(tempC, cfg = CONFIG) {
  return interpolate(cfg.care.filmPerDay, tempC);
}

/** ぬか床をかき混ぜないとき、1日に増える酸味。高温・低塩分ほど増える。 */
export function nukaSourPerDay(tempC, saltPct, cfg = CONFIG) {
  const n = cfg.nuka;
  return interpolate(n.sourPerDay, tempC) * (1 + Math.max(0, n.startSalt - saltPct) * n.lowSaltSourBoost);
}

/**
 * 手入れの状態を味に反映する（膜・ぬか床）。taste は simulate の結果。
 * care = { film: 0〜1, bed?: { sour: 0〜1, maturity: 0〜1 } }
 */
export function applyCare(taste, care, cfg = CONFIG) {
  const c = cfg.care;
  const film = Math.max(0, Math.min(1, care.film ?? 0));
  const harm = Math.max(0, Math.min(1, (film - c.filmHarmless) / (1 - c.filmHarmless)));
  const out = { ...taste, film, filmVisible: film >= c.filmVisible, careFactor: 1 - c.filmSatPenalty * harm };
  out.complexity = taste.complexity * (1 - c.filmComplexityPenalty * harm);
  if (care.bed) {
    out.acid = Math.min(100, taste.acid + cfg.nuka.sourAcidBoost * care.bed.sour);
    out.complexity *= 0.4 + 0.6 * care.bed.maturity;
  }
  return out;
}
