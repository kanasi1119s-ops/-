// 登場人物（参考画像からトレースした絵）と、動かすための目印。
//   hipY: ここから下が脚（歩くときに左右にずらす） / legX: 左脚と右脚の境目
//   headY: ここから上が頭（見る・しゃべるで動かす） / hand: かご・漬物を持つ位置
// 絵は左向き（店のほうを向いている）。右へ帰るときは左右反転する。
export const BODIES = {
  keeper: { img: 'char_keeper', hipY: 58, legX: 17, headY: 22, hand: [2, 36], handL: [-1, 36], handR: [31, 36] },
  woman: { img: 'char_woman', hipY: 60, legX: 12, headY: 20, hand: [-6, 36] },
  kid1: { img: 'char_kid1', hipY: 38, legX: 9, headY: 16, hand: [-4, 22] },
  kid2: { img: 'char_kid2', hipY: 38, legX: 10, headY: 15, hand: [-4, 22] },
  kid3: { img: 'char_kid3', hipY: 38, legX: 11, headY: 15, hand: [-4, 22] },
};

// 色の差し替え（同じ絵から別の客を作る）。rules は上から順に、当てはまった最初のものを使う。
//   when: { rows:[y0,y1], hue:[h0,h1](0〜1), light:[l0,l1], sat:[s0,s1] }  to: { hue, sat, light, mix:[色,割合] }
export const RECOLORS = {
  grayHair: [{ when: { rows: [0, 22], hue: [0.0, 0.14], light: [0, 0.42] }, to: { sat: 0.05, light: '+0.32' } }],
  indigoDress: [{ when: { rows: [20, 80], hue: [0.85, 1.0], sat: [0.15, 1] }, to: { hue: 0.62 } }, { when: { rows: [20, 80], hue: [0.0, 0.03], sat: [0.15, 1] }, to: { hue: 0.62 } }],
  genOutfit: [
    { when: { rows: [0, 9], light: [0.6, 1] }, to: { mix: ['#3a2a22', 0.85] } }, // 鉢巻→髪
    { when: { rows: [20, 56], light: [0.55, 1], sat: [0, 0.7] }, to: { mix: ['#34507a', 0.8] } }, // シャツ→藍
    { when: { rows: [40, 62], hue: [0.5, 0.7], sat: [0.1, 1] }, to: { mix: ['#5a4a3a', 0.75] } }, // 前掛け→茶
  ],
  shigeOutfit: [
    { when: { rows: [0, 9], light: [0.6, 1] }, to: { mix: ['#c8c8c8', 0.8] } }, // 白髪
    { when: { rows: [0, 22], hue: [0.0, 0.14], light: [0, 0.42] }, to: { sat: 0.05, light: '+0.35' } },
    { when: { rows: [20, 56], light: [0.55, 1], sat: [0, 0.7] }, to: { mix: ['#3e6a52', 0.8] } }, // シャツ→緑
    { when: { rows: [40, 62], hue: [0.5, 0.7], sat: [0.1, 1] }, to: { mix: ['#3a3a44', 0.75] } },
  ],
};

// 客（config.js の customers の id）→ 絵と色
export const CUSTOMER_LOOKS = {
  ume: { body: 'woman', recolor: 'grayHair', umbrella: '#c63d2f' },
  gen: { body: 'keeper', recolor: 'genOutfit', umbrella: '#2d4b7c' },
  kiku: { body: 'woman', recolor: 'indigoDress', umbrella: '#e0b43c' },
  ken: { body: 'kid3', umbrella: '#3f8a4a' },
  shige: { body: 'keeper', recolor: 'shigeOutfit', umbrella: '#5a5a66' },
};
export const KEEPER_LOOK = { body: 'keeper' };

// 通りがかりの人（デモ用・遊びには影響しない）: 絵に描かれていた人たち
export const PASSERS = [
  { body: 'woman', umbrella: '#c63d2f' }, { body: 'kid1', umbrella: '#e0b43c' },
  { body: 'kid2', umbrella: '#c63d2f' }, { body: 'kid3', umbrella: '#3f8a4a' },
];
export function randomLook(rand = Math.random) { return PASSERS[Math.floor(rand() * PASSERS.length)]; }
export const AMBIENT_LINES = ['いい色だねぇ', 'おいしそう！', 'ひとつください', '今日は何が漬かってる？', 'ちょうどいい塩梅だ'];
