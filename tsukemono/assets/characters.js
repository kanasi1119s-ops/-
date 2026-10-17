// 登場人物（参考画像からトレースした絵）と、動かすための目印。
//
// 種類は2つ:
//   poses … ポーズ集から切り出した絵を、コマごとに差し替える（店主・女性・おばあちゃん2人・おじいさん・男の子・麦わら帽子の女の子・セーラー服の女の子・学生服の男の子・ブレザーの女の子・紫の服のお兄さん・スーツのおじいさん・サングラスのおじさん・バレー部の女の子・サッカー部の男の子・レースクイーン風のお姉さん・空手着の男の子・お侍さん・水着の女の子・日傘の女の子・釣り人のおじさん・バックパッカーのお兄さん・甲冑の騎士・宇宙人・ケンタウロス・魔女の女の子・悪魔の男の子）
//   shift … 1枚の絵を頭・胴・左右の脚に分けて、1〜2ドットずらしてコマを作る（通りがかりの子ども）
//     hipY: ここから下が脚 / legX: 左脚と右脚の境目 / headY: ここから上が頭 / hand: かごを持つ位置
// faces: 絵の向き。'right' / 'left' / 'front'。進む向きに合わせて左右反転する。
import { TRACE } from './trace.js';

const posesOf = (name) => TRACE.poses[name].map((p, i) => ({ ...p, img: `pose_${name}_${i}` }));

export const BODIES = {
  keeper: { kind: 'poses', faces: 'right', poses: posesOf('keeper'), hand: [52, 100] },
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
  soccer: { kind: 'poses', faces: 'right', poses: posesOf('soccer') },
  racer: { kind: 'poses', faces: 'right', poses: posesOf('racer') },
  karate: { kind: 'poses', faces: 'right', poses: posesOf('karate') },
  samurai: { kind: 'poses', faces: 'right', poses: posesOf('samurai') },
  beach: { kind: 'poses', faces: 'right', poses: posesOf('beach') },
  parasol: { kind: 'poses', faces: 'right', poses: posesOf('parasol') },
  angler: { kind: 'poses', faces: 'right', poses: posesOf('angler') },
  hiker: { kind: 'poses', faces: 'right', poses: posesOf('hiker') },
  knight: { kind: 'poses', faces: 'right', poses: posesOf('knight') },
  alien: { kind: 'poses', faces: 'right', poses: posesOf('alien') },
  centaur: { kind: 'poses', faces: 'right', poses: posesOf('centaur') },
  witch: { kind: 'poses', faces: 'right', poses: posesOf('witch') },
  demon: { kind: 'poses', faces: 'right', poses: posesOf('demon') },
  kid1: { kind: 'shift', faces: 'left', img: 'char_kid1', hipY: 76, legX: 18, headY: 32, hand: [-8, 44] },
  kid2: { kind: 'shift', faces: 'left', img: 'char_kid2', hipY: 76, legX: 20, headY: 30, hand: [-8, 44] },
  kid3: { kind: 'shift', faces: 'left', img: 'char_kid3', hipY: 76, legX: 22, headY: 30, hand: [-8, 44] },
};

// 色の差し替え（同じ絵から色違いの人を作る）。rules は上から順に、当てはまった最初のものを使う。
//   when: { rows:[y0,y1], hue:[h0,h1](0〜1), light:[l0,l1], sat:[s0,s1] }  to: { hue, sat, light:'+0.3', mix:[色,割合] }
export const RECOLORS = {
  // おじいさんの絵の色違い（上着を藍、ズボンを濃く、髪を黒く）
  genOutfit: [
    { when: { rows: [0, 40], hue: [0.0, 0.2], light: [0, 0.55], sat: [0, 0.35] }, to: { mix: ['#2a2420', 0.7] } },
    { when: { rows: [32, 100], hue: [0.2, 0.5], sat: [0.1, 1] }, to: { mix: ['#34507a', 0.75] } },
    { when: { rows: [80, 160], hue: [0.05, 0.16], sat: [0.15, 1], light: [0.3, 0.75] }, to: { mix: ['#4a4a55', 0.7] } },
  ],
};

export const KEEPER_LOOK = { body: 'keeper' };

// 来る人の見た目。販売の客も通りがかり（デモ）も、ここからランダムに選ぶ（見た目は遊びに影響しない）。
// seasons があれば、その季節にだけ来る。
// ownUmbrella: 自分の傘を持っている絵なので、雨・雪の日に傘を重ねない
// weight: 来やすさ（既定1）。0.2 なら他の人の5分の1くらい
// likes: その見た目の人がなりやすい好みのタイプ（config.js の customers の id）。そのタイプの客のとき選ばれやすい
const L = 'light', SA = 'salty', SO = 'sour', CR = 'crunchy', GO = 'gourmet';
export const PASSERS = [
  { body: 'woman', umbrella: '#c63d2f', likes: [SO, L] },
  { body: 'granny', umbrella: '#2d4b7c', likes: [L] },
  { body: 'granny2', umbrella: '#c63d2f', likes: [L] },
  { body: 'oldman', umbrella: '#5a5a66', likes: [GO] },
  { body: 'oldman', recolor: 'genOutfit', umbrella: '#2d4b7c', likes: [SA] },
  { body: 'suit', umbrella: '#2a2a33', likes: [GO] },
  { body: 'boy', umbrella: '#3f8a4a', likes: [CR] },
  { body: 'girl', umbrella: '#e0b43c', likes: [CR, L] },
  { body: 'student', umbrella: '#2d4b7c', likes: [L, CR] },
  { body: 'gakuran', umbrella: '#5a5a66', likes: [CR, SA] },
  { body: 'blazer', umbrella: '#c63d2f', likes: [L, SO] },
  { body: 'volley', umbrella: '#c63d2f', likes: [CR] },
  { body: 'soccer', umbrella: '#2d4b7c', likes: [CR, SA] },
  { body: 'yankee', umbrella: '#8a4b9a', likes: [SA] },
  { body: 'shades', umbrella: '#2a2a33', likes: [SA, SO] },
  { body: 'racer', umbrella: '#c63d2f', likes: [L] },
  { body: 'karate', umbrella: '#2d4b7c', likes: [SA] },
  { body: 'samurai', umbrella: '#c18c52', likes: [GO, SA] },
  { body: 'angler', umbrella: '#3f8a4a', likes: [SA] },
  { body: 'hiker', umbrella: '#3f8a4a', likes: [SA, CR] },
  { body: 'knight', umbrella: '#8f2a20', likes: [GO] },
  { body: 'beach', umbrella: '#46689f', likes: [L, CR], seasons: ['summer'] }, // 水着なので夏だけ
  { body: 'parasol', ownUmbrella: true, likes: [L], seasons: ['spring', 'summer'] }, // 日傘を持っているので傘は重ねない
  { body: 'witch', umbrella: '#2a1c3a', likes: [SO], seasons: ['autumn'] }, // ハロウィンの季節（秋）だけ
  { body: 'demon', umbrella: '#2a1c14', likes: [SO, SA], seasons: ['autumn'] }, // ハロウィンの季節（秋）だけ
  { body: 'alien', umbrella: '#7aa3cc', likes: [GO], weight: 0.2 }, // めったに来ない
  { body: 'centaur', umbrella: '#8d5c2e', likes: [SA], weight: 0.2 }, // めったに来ない
  // 店先の絵から切り抜いたランドセルの子ども（1枚の絵をずらして動かすので、少なめ）
  { body: 'kid1', umbrella: '#e0b43c', likes: [CR], weight: 0.4 },
  { body: 'kid2', umbrella: '#c63d2f', likes: [CR], weight: 0.4 },
  { body: 'kid3', umbrella: '#3f8a4a', likes: [CR], weight: 0.4 },
];
export const LIKE_BOOST = 4; // 好みのタイプが合う見た目は、この倍だけ選ばれやすい 【仮置き】
/** 季節に合う人から、来やすさ（と、好みのタイプが合うか）に応じてランダムに選ぶ。 */
export function randomLook(rand = Math.random, season = null, type = null) {
  const list = PASSERS.filter((p) => !p.seasons || !season || p.seasons.includes(season));
  const w = (p) => (p.weight ?? 1) * (type && p.likes?.includes(type) ? LIKE_BOOST : 1);
  const total = list.reduce((s, p) => s + w(p), 0);
  let r = rand() * total;
  for (const p of list) { r -= w(p); if (r < 0) return p; }
  return list[list.length - 1];
}
/** 常連の見た目。常連ごとの番号（look）から毎回同じ人を選ぶ（季節限定の人は選ばない）。 */
export function regularLook(look, type = null) {
  let a = look >>> 0; // mulberry32
  const rand = () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const list = PASSERS.filter((p) => !p.seasons);
  const w = (p) => (p.weight ?? 1) * (type && p.likes?.includes(type) ? LIKE_BOOST : 1);
  let r = rand() * list.reduce((s, p) => s + w(p), 0);
  for (const p of list) { r -= w(p); if (r < 0) return p; }
  return list[list.length - 1];
}
export const REGULAR_LINES = { hello: ['また来たよ', 'いつもの、ある？', 'こんにちは、今日は何がある？'], joined: 'また来るね！', left: '…しばらく来ないかな' };
export const AMBIENT_LINES = ['いい色だねぇ', 'おいしそう！', 'ひとつください', '今日は何が漬かってる？', 'ちょうどいい塩梅だ'];
