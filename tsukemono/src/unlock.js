// 作り方の解放（段階C）。条件の判定と、レベルの計算（乱数なし・画面なし）。
import { CONFIG } from './config.js';

/**
 * ひらめきの条件（data/pickles.js の unlock.when）のうち、合っていない項目の一覧を返す。空なら全部合っている。
 * ctx: { pickle, veg, additives, saltPct, place, tempC, season, days, stage, owned }
 */
export function unmet(when, ctx) {
  const miss = [];
  const inRange = (v, r) => v >= (r.min ?? -Infinity) && v <= (r.max ?? Infinity);
  if (when.pickle && !when.pickle.includes(ctx.pickle)) miss.push('pickle');
  if (when.veg && !when.veg.includes(ctx.veg)) miss.push('veg');
  if (when.additives && !when.additives.every((a) => (ctx.additives ?? []).includes(a))) miss.push('additives');
  if (when.salt && !inRange(ctx.saltPct, when.salt)) miss.push('salt');
  if (when.facility && !(ctx.owned ?? []).includes(when.facility)) miss.push('facility');
  if (when.place && !when.place.includes(ctx.place)) miss.push('place');
  if (when.season && !when.season.includes(ctx.season)) miss.push('season');
  if (when.temp && !inRange(ctx.tempC, when.temp)) miss.push('temp');
  if (when.days && !inRange(ctx.days, when.days)) miss.push('days');
  if (when.stage && !when.stage.includes(ctx.stage)) miss.push('stage');
  return miss;
}

/** 経験からレベルを求める。最後のレベルより先は levelAfterLast ごとに1つずつ上がる（終わりなし）。 */
export function levelOf(xp, cfg = CONFIG) {
  const L = cfg.levels;
  let i = 0;
  while (i + 1 < L.length && xp >= L[i + 1].xp) i++;
  const last = L[L.length - 1];
  const extra = i === L.length - 1 ? Math.floor((xp - last.xp) / cfg.levelAfterLast) : 0;
  return { ...L[i], level: L[i].level + extra, extra };
}

/** 次のレベルに必要な経験の合計 */
export function nextLevelXp(xp, cfg = CONFIG) {
  const L = cfg.levels, cur = levelOf(xp, cfg);
  const next = L.find((l) => l.xp > xp);
  return next ? next.xp : L[L.length - 1].xp + (cur.extra + 1) * cfg.levelAfterLast;
}

/** 腕前（0〜1）。成功した樽の数で上がる。 */
export const masteryOf = (made, cfg = CONFIG) => Math.min(1, (made ?? 0) / cfg.progress.masterAfter);
