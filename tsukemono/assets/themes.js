// 季節・時間帯・天気による見た目の切り替え（仮の色替え）。
export const SEASONS = ['spring', 'summer', 'autumn', 'winter'];
export const TIMES = ['morning', 'noon', 'evening', 'night'];
export const WEATHERS = ['sunny', 'rain', 'snow'];

const SKY = {
  morning: ['#8fb6e6', '#f6d9b0'],
  noon: ['#4d97e0', '#a8d4f5'],
  evening: ['#5b6aa8', '#f4a35e'],
  night: ['#0d1230', '#2a3a6e'],
};
const SEASON = {
  spring: { mountainFar: '#9bb7c8', mountainNear: '#6fae6a', paddy: ['#a5d27f', '#8fc46d', '#9bc9d6'], bank: '#8bbf5a', ground: '#b99b6a', tree: 'tree_spring', particles: 'petal', snowcap: false },
  summer: { mountainFar: '#6f9a8a', mountainNear: '#3f8a4a', paddy: ['#4f9a3f', '#3f8a35', '#5aa845'], bank: '#4a9a3a', ground: '#a98d5c', tree: 'tree_summer', particles: null, snowcap: false },
  autumn: { mountainFar: '#a08a7a', mountainNear: '#c0743a', paddy: ['#dcb94c', '#c9a53c', '#e6c75a'], bank: '#b09a4a', ground: '#b58f56', tree: 'tree_autumn', particles: 'leaf', snowcap: false },
  winter: { mountainFar: '#aebfcf', mountainNear: '#8fa49a', paddy: ['#e8eef3', '#d6dde5', '#c8d2dc'], bank: '#dde5ec', ground: '#e6ecf1', tree: 'tree_winter', particles: null, snowcap: true },
};
// 客の服装（季節）。mix = その色に寄せる割合
const OUTFIT = {
  spring: { toward: '#ffffff', amt: 0.05, scarf: false, hat: false },
  summer: { toward: '#ffffff', amt: 0.4, scarf: false, hat: true },
  autumn: { toward: '#c07030', amt: 0.25, scarf: false, hat: false },
  winter: { toward: '#2e3550', amt: 0.45, scarf: true, hat: false },
};
const TINT = {
  morning: '#fff0dc', noon: '#ffffff', evening: '#ffc58f', night: '#6a78b8',
};
const WEATHER_TINT = { sunny: '#ffffff', rain: '#cdd5de', snow: '#e8eef6' };
const WEATHER_SKY = { sunny: null, rain: ['#7d8794', 0.6], snow: ['#b9c2cc', 0.55] };

export const hex = (c) => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16));
export const toHex = (rgb) => '#' + rgb.map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('');
export const mix = (a, b, t) => { const x = hex(a), y = hex(b); return toHex(x.map((v, i) => v + (y[i] - v) * t)); };
export const multiply = (a, b) => { const x = hex(a), y = hex(b); return toHex(x.map((v, i) => (v * y[i]) / 255)); };

/** 季節・時間帯・天気から、そのときの見た目のセットを決める。 */
export function resolveTheme({ season, time, weather }) {
  const s = SEASON[season];
  const [top, bottom] = SKY[time];
  const wsky = WEATHER_SKY[weather];
  const bands = Array.from({ length: 8 }, (_, i) => {
    let c = mix(top, bottom, i / 7);
    if (wsky) c = mix(c, time === 'night' ? mix(wsky[0], '#000000', 0.7) : wsky[0], time === 'night' ? 0.3 : wsky[1]);
    return c;
  });
  const snowy = weather === 'snow' || season === 'winter';
  return {
    key: `${season}/${time}/${weather}`,
    season, time, weather,
    skyBands: bands,
    mountainFar: s.mountainFar, mountainNear: s.mountainNear, snowcap: s.snowcap || weather === 'snow',
    paddy: s.paddy, bank: snowy ? '#dde5ec' : s.bank,
    ground: snowy ? '#e6ecf1' : (weather === 'rain' ? mix(s.ground, '#4a4a55', 0.25) : s.ground),
    groundShade: snowy ? '#c8d2dc' : mix(s.ground, '#000000', 0.15),
    puddles: weather === 'rain',
    tree: s.tree,
    roofSnow: snowy,
    particles: s.particles,
    rain: weather === 'rain', snow: weather === 'snow',
    darkClouds: weather !== 'sunny',
    sun: time !== 'night' && weather === 'sunny' ? time : null,
    moon: time === 'night' && weather === 'sunny',
    stars: time === 'night' && weather === 'sunny',
    lampOn: time === 'evening' || time === 'night',
    tint: multiply(TINT[time], WEATHER_TINT[weather]),
    outfit: OUTFIT[season],
  };
}
