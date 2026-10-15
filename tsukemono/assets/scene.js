// 店先の配置（384×216 のドット座標）。絵は参考画像をトレースしたもの（assets/img/、tools/trace.py）。
// 背景は人のいない絵、人物は人のいる絵から切り抜いたもの。
import { TRACE } from './trace.js';

const [W, H] = TRACE.size;

export const SCENE = {
  w: W, h: H,
  skyBottom: 112, // 空のグラデーションを描く高さ（背景の空は透明）
  groundY: 196, // これより下が地面（季節の色替えで使う）
  roofRect: [68, 28, 322, 84], // 屋根（冬に雪をのせる範囲）
  // 店主は、のれんの下の入口に立つ（足元の中心）
  keeperFeet: { x: 195, y: 191 },
  // 売り場の樽（樽1〜3）。中身の絵を差し替えて、空・白菜・きゅうりを見せる
  slots: TRACE.slots.map((s) => ({ ...s, cx: s.x + Math.round(s.w / 2) })),
  labelY: 199,
  // 吊るし物。panels = 別々に揺れる区切り（画像内のx範囲）
  hanging: [
    { img: 'hang_noren', ...pos('noren'), panels: [[0, 40], [40, 75], [75, 107], [107, 130], [130, 151], [151, 181], [181, 195]], ms: [1000, 1200, 900, 1300, 1100, 950, 1150] },
    { img: 'hang_daikon', ...pos('daikon'), panels: [[0, 17], [17, 31], [31, 48]], ms: [800, 1000, 1150] },
    { img: 'hang_chili_l', ...pos('chili_l'), panels: [[0, 12], [12, 25]], ms: [900, 1250] },
    { img: 'hang_chili_r', ...pos('chili_r'), panels: [[0, 17]], ms: [1050] },
  ],
  // 浮いている雲（速さはバラバラ）
  clouds: TRACE.clouds.map(([x, y], i) => ({ img: `cloud_${i}`, x0: x, y, speed: [4.5, 2.4][i] ?? 3 })),
  // 客の通り道: 右から来て、樽の前で止まり、右へ帰る（足元のy）
  lane: { y: 213, startX: W + 20, queueX: 298, queueGap: 26, standX: 264, endX: W + 24 },
  doorLight: { x: 195, y: 128 }, // 夕方・夜に店の奥が灯る位置
  sunPos: { morning: [52, 40], noon: [190, 14], evening: [330, 40] },
  moonPos: [318, 20],
  stars: 34,
};

function pos(name) { const [x, y] = TRACE.hanging[name]; return { x, y }; }

/** 読み込む画像（assets/img/*.png）。 */
export const IMAGES = [
  'bg', 'basket', 'cloud_0', 'cloud_1',
  'char_kid1', 'char_kid2', 'char_kid3',
  ...Object.entries(TRACE.poses).flatMap(([n, ps]) => ps.map((_, i) => `pose_${n}_${i}`)),
  'hang_noren', 'hang_daikon', 'hang_chili_l', 'hang_chili_r',
  ...[0, 1, 2].flatMap((i) => ['empty', 'hakusai', 'kyuri'].map((v) => `slot${i}_${v}`)),
];
