// 登場人物の見た目（仮）。客のidは config.js の customers と対応する。
export const KEEPER_LOOK = { style: 'band', hair: '#3a2a22', clothes: '#2d4b7c', clothes2: '#1d3257', pants: '#2f2f3a' };

export const CUSTOMER_LOOKS = {
  ume: { style: 'bun', hair: '#c9c9c9', clothes: '#9a5a8a', clothes2: '#6e3b62', pants: '#5b4a6a', hat: true, umbrella: '#c63d2f' },
  gen: { style: 'cap', hair: '#3a2a22', clothes: '#4a6a8a', clothes2: '#8a6a3a', pants: '#3f3a35', hat: false, umbrella: '#2d4b7c' },
  kiku: { style: 'long', hair: '#2a2a30', clothes: '#b5503c', clothes2: '#7c2f22', pants: '#4a3a5a', hat: true, umbrella: '#e0b43c' },
  ken: { style: 'spiky', hair: '#4a2f1d', clothes: '#e0b43c', clothes2: '#b88a22', pants: '#3a5a8a', hat: true, umbrella: '#3f8a4a' },
  shige: { style: 'bald', hair: '#c8c8c8', clothes: '#3e6a52', clothes2: '#244a38', pants: '#3a3a44', hat: false, umbrella: '#5a5a66' },
};

// 通りがかりの人（デモ用・遊びには影響しない）
const STYLES = ['short', 'bun', 'cap', 'long', 'spiky', 'bald'];
const CLOTHES = ['#9a5a8a', '#4a6a8a', '#b5503c', '#3e6a52', '#c98a3c', '#6a6aa8'];
const HAIRS = ['#3a2a22', '#2a2a30', '#6a4a2a', '#b9b9b9'];
export function randomLook(rand = Math.random) {
  const pick = (a) => a[Math.floor(rand() * a.length)];
  const c = pick(CLOTHES);
  return { style: pick(STYLES), hair: pick(HAIRS), clothes: c, clothes2: '#7a5a3a', pants: '#3f3f4f', hat: rand() < 0.5, umbrella: pick(CLOTHES) };
}
export const AMBIENT_LINES = ['いい色だねぇ', 'おいしそう！', 'ひとついただこうかな', '今日は何が漬かってる？', 'ちょうどいい塩梅だ'];
