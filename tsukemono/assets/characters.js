// 登場人物（参考画像からトレースした絵）と、動かすための目印。
//
// 種類は2つ:
//   poses … ポーズ集から切り出した絵を、コマごとに差し替える（店主・女性・おばあちゃん）
//   shift … 1枚の絵を頭・胴・左右の脚に分けて、1〜2ドットずらしてコマを作る（子ども・男の客）
//     hipY: ここから下が脚 / legX: 左脚と右脚の境目 / headY: ここから上が頭 / hand: かごを持つ位置
// faces: 絵の向き。'right' / 'left' / 'front'。進む向きに合わせて左右反転する。
import { TRACE } from './trace.js';

const posesOf = (name) => TRACE.poses[name].map((p, i) => ({ ...p, img: `pose_${name}_${i}` }));

export const BODIES = {
  keeper: { kind: 'poses', faces: 'right', poses: posesOf('keeper'), hand: [26, 50] },
  woman: { kind: 'poses', faces: 'right', poses: posesOf('woman') },
  granny: { kind: 'poses', faces: 'right', poses: posesOf('granny') },
  // 男の客: 店主の「腕組み」の絵を色違いにして使う（ポーズ集に男の客がいないため）
  man: { kind: 'shift', faces: 'front', img: 'pose_keeper_0', hipY: 57, legX: 13, headY: 22, hand: [2, 36] },
  kid1: { kind: 'shift', faces: 'left', img: 'char_kid1', hipY: 38, legX: 9, headY: 16, hand: [-4, 22] },
  kid2: { kind: 'shift', faces: 'left', img: 'char_kid2', hipY: 38, legX: 10, headY: 15, hand: [-4, 22] },
  kid3: { kind: 'shift', faces: 'left', img: 'char_kid3', hipY: 38, legX: 11, headY: 15, hand: [-4, 22] },
};

// 色の差し替え（同じ絵から別の客を作る）。rules は上から順に、当てはまった最初のものを使う。
//   when: { rows:[y0,y1], hue:[h0,h1](0〜1), light:[l0,l1], sat:[s0,s1] }  to: { hue, sat, light:'+0.3', mix:[色,割合] }
export const RECOLORS = {
  genOutfit: [
    { when: { rows: [0, 12], light: [0.6, 1] }, to: { mix: ['#3a2a22', 0.85] } }, // 鉢巻→髪
    { when: { rows: [18, 56], light: [0.55, 1], sat: [0, 0.7] }, to: { mix: ['#34507a', 0.8] } }, // シャツ→藍
    { when: { rows: [36, 62], hue: [0.5, 0.7], sat: [0.1, 1] }, to: { mix: ['#5a4a3a', 0.75] } }, // 前掛け→茶
  ],
  shigeOutfit: [
    { when: { rows: [0, 12], light: [0.6, 1] }, to: { mix: ['#c8c8c8', 0.8] } }, // 白髪
    { when: { rows: [0, 22], hue: [0.0, 0.14], light: [0, 0.42] }, to: { sat: 0.05, light: '+0.35' } },
    { when: { rows: [18, 56], light: [0.55, 1], sat: [0, 0.7] }, to: { mix: ['#3e6a52', 0.8] } }, // シャツ→緑
    { when: { rows: [36, 62], hue: [0.5, 0.7], sat: [0.1, 1] }, to: { mix: ['#3a3a44', 0.75] } },
  ],
};

// 客（config.js の customers の id）→ 絵と色
export const CUSTOMER_LOOKS = {
  ume: { body: 'granny', umbrella: '#c63d2f' },
  gen: { body: 'man', recolor: 'genOutfit', umbrella: '#2d4b7c' },
  kiku: { body: 'woman', umbrella: '#e0b43c' },
  ken: { body: 'kid3', umbrella: '#3f8a4a' },
  shige: { body: 'man', recolor: 'shigeOutfit', umbrella: '#5a5a66' },
};
export const KEEPER_LOOK = { body: 'keeper' };

// 通りがかりの人（デモ用・遊びには影響しない）
export const PASSERS = [
  { body: 'woman', umbrella: '#c63d2f' }, { body: 'granny', umbrella: '#2d4b7c' },
  { body: 'kid1', umbrella: '#e0b43c' }, { body: 'kid2', umbrella: '#c63d2f' }, { body: 'kid3', umbrella: '#3f8a4a' },
];
export function randomLook(rand = Math.random) { return PASSERS[Math.floor(rand() * PASSERS.length)]; }
export const AMBIENT_LINES = ['いい色だねぇ', 'おいしそう！', 'ひとつください', '今日は何が漬かってる？', 'ちょうどいい塩梅だ'];
