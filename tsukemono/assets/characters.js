// 登場人物（参考画像からトレースした絵）と、動かすための目印。
//
// 種類は2つ:
//   poses … ポーズ集から切り出した絵を、コマごとに差し替える（店主・女性・おばあちゃん2人・おじいさん・男の子・麦わら帽子の女の子・セーラー服の女の子・学生服の男の子・ブレザーの女の子・紫の服のお兄さん・スーツのおじいさん・サングラスのおじさん・バレー部の女の子）
//   shift … 1枚の絵を頭・胴・左右の脚に分けて、1〜2ドットずらしてコマを作る（通りがかりの子ども）
//     hipY: ここから下が脚 / legX: 左脚と右脚の境目 / headY: ここから上が頭 / hand: かごを持つ位置
// faces: 絵の向き。'right' / 'left' / 'front'。進む向きに合わせて左右反転する。
import { TRACE } from './trace.js';

const posesOf = (name) => TRACE.poses[name].map((p, i) => ({ ...p, img: `pose_${name}_${i}` }));

export const BODIES = {
  keeper: { kind: 'poses', faces: 'right', poses: posesOf('keeper'), hand: [26, 50] },
  woman: { kind: 'poses', faces: 'right', poses: posesOf('woman') },
  granny: { kind: 'poses', faces: 'right', poses: posesOf('granny') },
  granny2: { kind: 'poses', faces: 'right', poses: posesOf('granny2') },
  oldman: { kind: 'poses', faces: 'right', poses: posesOf('oldman') },
  boy: { kind: 'poses', faces: 'right', poses: posesOf('boy') },
  girl: { kind: 'poses', faces: 'right', poses: posesOf('girl') },
  student: { kind: 'poses', faces: 'right', poses: posesOf('student') },
  gakuran: { kind: 'poses', faces: 'right', poses: posesOf('gakuran') },
  blazer: { kind: 'poses', faces: 'right', poses: posesOf('blazer') },
  yankee: { kind: 'poses', faces: 'right', poses: posesOf('yankee') },
  suit: { kind: 'poses', faces: 'right', poses: posesOf('suit') },
  shades: { kind: 'poses', faces: 'right', poses: posesOf('shades') },
  volley: { kind: 'poses', faces: 'right', poses: posesOf('volley') },
  kid1: { kind: 'shift', faces: 'left', img: 'char_kid1', hipY: 38, legX: 9, headY: 16, hand: [-4, 22] },
  kid2: { kind: 'shift', faces: 'left', img: 'char_kid2', hipY: 38, legX: 10, headY: 15, hand: [-4, 22] },
  kid3: { kind: 'shift', faces: 'left', img: 'char_kid3', hipY: 38, legX: 11, headY: 15, hand: [-4, 22] },
};

// 色の差し替え（同じ絵から別の客を作る）。rules は上から順に、当てはまった最初のものを使う。
//   when: { rows:[y0,y1], hue:[h0,h1](0〜1), light:[l0,l1], sat:[s0,s1] }  to: { hue, sat, light:'+0.3', mix:[色,割合] }
export const RECOLORS = {
  // 源さん: おじいさんの絵の色違い（上着を藍、ズボンを濃く、髪を黒く）
  genOutfit: [
    { when: { rows: [0, 20], hue: [0.0, 0.2], light: [0, 0.55], sat: [0, 0.35] }, to: { mix: ['#2a2420', 0.7] } },
    { when: { rows: [16, 50], hue: [0.2, 0.5], sat: [0.1, 1] }, to: { mix: ['#34507a', 0.75] } },
    { when: { rows: [40, 80], hue: [0.05, 0.16], sat: [0.15, 1], light: [0.3, 0.75] }, to: { mix: ['#4a4a55', 0.7] } },
  ],
};

// 客（config.js の customers の id）→ 絵と色
export const CUSTOMER_LOOKS = {
  ume: { body: 'granny2', umbrella: '#c63d2f' },
  gen: { body: 'oldman', recolor: 'genOutfit', umbrella: '#2d4b7c' },
  kiku: { body: 'woman', umbrella: '#e0b43c' },
  ken: { body: 'boy', umbrella: '#3f8a4a' },
  shige: { body: 'oldman', umbrella: '#5a5a66' },
};
export const KEEPER_LOOK = { body: 'keeper' };

// 通りがかりの人（デモ用・遊びには影響しない）
export const PASSERS = [
  { body: 'woman', umbrella: '#c63d2f' }, { body: 'granny', umbrella: '#2d4b7c' }, { body: 'oldman', umbrella: '#5a5a66' },
  { body: 'girl', umbrella: '#e0b43c' }, { body: 'student', umbrella: '#2d4b7c' }, { body: 'gakuran', umbrella: '#5a5a66' }, { body: 'blazer', umbrella: '#c63d2f' }, { body: 'yankee', umbrella: '#8a4b9a' },
  { body: 'suit', umbrella: '#2a2a33' }, { body: 'shades', umbrella: '#2a2a33' }, { body: 'volley', umbrella: '#c63d2f' },
  { body: 'kid1', umbrella: '#e0b43c' }, { body: 'kid2', umbrella: '#c63d2f' }, { body: 'kid3', umbrella: '#3f8a4a' },
];
export function randomLook(rand = Math.random) { return PASSERS[Math.floor(rand() * PASSERS.length)]; }
export const AMBIENT_LINES = ['いい色だねぇ', 'おいしそう！', 'ひとつください', '今日は何が漬かってる？', 'ちょうどいい塩梅だ'];
