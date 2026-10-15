// 季節・時間帯・天気による見た目の切り替え。
// 背景の絵（トレース）は夏の昼の色なので、季節は色の置き換え、時間帯は色をかけ合わせて表す。
export const SEASONS = ['spring', 'summer', 'autumn', 'winter'];
export const TIMES = ['morning', 'noon', 'evening', 'night'];
export const WEATHERS = ['sunny', 'rain', 'snow'];

const SKY = {
  morning: ['#8fb6e6', '#f6d9b0'],
  noon: ['#3f8fe0', '#9ed0f4'],
  evening: ['#5b6aa8', '#f4a35e'],
  night: ['#0d1230', '#2a3a6e'],
};
const TINT = { morning: '#fff0dc', noon: '#ffffff', evening: '#ffc58f', night: '#5e6cae' };
const WEATHER_TINT = { sunny: '#ffffff', rain: '#c4ccd6', snow: '#e8eef6' };
const WEATHER_SKY = { sunny: null, rain: ['#7d8794', 0.65], snow: ['#b9c2cc', 0.6] };

// 背景の色の置き換え（季節）。kind は render.js の画素の分類:
//   green=草木・田んぼ・山 / ground=地面（土） / roof=屋根の明るい瓦 / water=田んぼの水
//   to: { hue, satMin, mix:[色,割合], dark }
export const SEASON_RECOLOR = {
  spring: { green: { mix: ['#b8e08c', 0.25] }, water: { mix: ['#a8d4ee', 0.15] } },
  summer: {},
  autumn: { green: { hue: 0.085, satMin: 0.45, mix: ['#d9a03a', 0.2] }, water: { mix: ['#d9c070', 0.25] } },
  winter: { green: { mix: ['#e4ebf2', 0.6] }, ground: { mix: ['#eef3f7', 0.8] }, roof: { mix: ['#ffffff', 0.75] }, water: { mix: ['#c8d6e2', 0.45] } },
};
// 雪の日は季節に関係なく地面と屋根に雪、雨の日は地面が濡れる
export const WEATHER_RECOLOR = {
  sunny: {},
  rain: { ground: { mix: ['#5a4a40', 0.3] } },
  snow: { ground: { mix: ['#eef3f7', 0.8] }, roof: { mix: ['#ffffff', 0.75] }, green: { mix: ['#e4ebf2', 0.35] } },
};
// 客の服装（季節）: 絵全体に薄くかける色
const OUTFIT = {
  spring: null,
  summer: ['#fff6e0', 0.12],
  autumn: ['#c07030', 0.12],
  winter: ['#2e3550', 0.25],
};

export const hex = (c) => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16));
export const toHex = (rgb) => '#' + rgb.map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('');
export const mix = (a, b, t) => { const x = hex(a), y = hex(b); return toHex(x.map((v, i) => v + (y[i] - v) * t)); };
export const multiply = (a, b) => { const x = hex(a), y = hex(b); return toHex(x.map((v, i) => (v * y[i]) / 255)); };

/** 季節・時間帯・天気から、そのときの見た目のセットを決める。 */
export function resolveTheme({ season, time, weather }) {
  const [top, bottom] = SKY[time];
  const wsky = WEATHER_SKY[weather];
  const bands = Array.from({ length: 10 }, (_, i) => {
    let c = mix(top, bottom, i / 9);
    if (wsky) c = mix(c, time === 'night' ? mix(wsky[0], '#000000', 0.7) : wsky[0], time === 'night' ? 0.3 : wsky[1]);
    return c;
  });
  return {
    key: `${season}/${time}/${weather}`,
    landKey: `${season}/${weather}`,
    season, time, weather,
    skyBands: bands,
    recolor: { ...SEASON_RECOLOR[season], ...WEATHER_RECOLOR[weather] },
    particles: weather === 'sunny' ? { spring: 'petal', autumn: 'leaf' }[season] ?? null : null,
    rain: weather === 'rain', snow: weather === 'snow',
    puddles: weather === 'rain',
    darkClouds: weather !== 'sunny',
    sun: time !== 'night' && weather === 'sunny' ? time : null,
    moon: time === 'night' && weather === 'sunny',
    stars: time === 'night' && weather === 'sunny',
    lampOn: time === 'evening' || time === 'night',
    tint: multiply(TINT[time], WEATHER_TINT[weather]),
    outfit: OUTFIT[season],
  };
}
