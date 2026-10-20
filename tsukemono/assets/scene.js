// 店先の配置（768×432 のドット座標。tools/trace.py の SC=2）。絵は参考画像をトレースしたもの（assets/img/、tools/trace.py）。
// 背景は人のいない絵、人物は人のいる絵から切り抜いたもの。
import { SURPRISE_BASE, ANGRY_BASE, OVER_WORDS } from './faces.js';
import { VEGETABLES } from '../data/vegetables.js'; // 野菜を足すと、樽の中身の絵（slot{0..2}_{id}.png）も読みこむ
import { TRACE } from './trace.js';
import { STAFF_IMAGES } from './staff.js';
import { CAST_IMAGES } from './cast.js';
import { WALK } from './walk.js';

const [W, H] = TRACE.size;

export const SCENE = {
  w: W, h: H,
  skyBottom: 224, // 空のグラデーションを描く高さ（背景の空は透明）
  groundY: 392, // これより下が地面（季節の色替えで使う）
  roofRect: [136, 56, 644, 168], // 屋根（冬に雪をのせる範囲）
  // 屋根の上の看板。絵にある「〇〇漬物店」の文字を木目で消して、店の名前で書き直す（render.js の signBoard）
  sign: { rect: [287, 83, 481, 125], cx: 383, cy: 104, w: 186, size: 34, ink: [12, 6, 8] },
  // 店主は、のれんの下の入口に立つ（足元の中心）
  keeperFeet: { x: 390, y: 382 },
  // 売り場の樽（樽1〜3）。中身の絵を差し替えて、空・白菜・きゅうりを見せる
  slots: TRACE.slots.map((s) => ({ ...s, cx: s.x + Math.round(s.w / 2) })),
  // 増やした樽（4・5個目）。絵は背景の右側の樽をそのまま使い、ラベルだけ出す
  extraSlots: [{ cx: 542 }, { cx: 634 }],
  labelY: 398,
  // 吊るし物。panels = 別々に揺れる区切り（画像内のx範囲）
  hanging: [
    { img: 'hang_noren', ...pos('noren'), panels: [[0, 80], [80, 150], [150, 214], [214, 260], [260, 302], [302, 362], [362, 390]], ms: [1000, 1200, 900, 1300, 1100, 950, 1150] },
    { img: 'hang_daikon', ...pos('daikon'), panels: [[0, 34], [34, 62], [62, 96]], ms: [800, 1000, 1150] },
    { img: 'hang_chili_l', ...pos('chili_l'), panels: [[0, 24], [24, 50]], ms: [900, 1250] },
    { img: 'hang_chili_r', ...pos('chili_r'), panels: [[0, 34]], ms: [1050] },
  ],
  // 浮いている雲（速さはバラバラ）
  clouds: TRACE.clouds.map(([x, y], i) => ({ img: `cloud_${i}`, x0: x, y, speed: [9, 4.8][i] ?? 6 })),
  // 客の通り道: 右から来て、樽の前で止まり、右へ帰る（足元のy）
  lane: { y: 426, startX: W + 40, queueX: 596, queueGap: 52, standX: 528, endX: W + 48 },
  doorLight: { x: 390, y: 256 }, // 夕方・夜に店の奥が灯る位置
  sunPos: { morning: [104, 80], noon: [380, 28], evening: [660, 80] },
  moonPos: [636, 40],
  stars: 60,
  // 従業員の立つ所（足元）。dir = 向き（1 右・-1 左）。hide = 手前の物にかくれる範囲 [x, y, 幅, 高さ]
  staff: {
    kanban: { x: 44, y: 424, dir: 1 }, // 電柱の前で呼びこみ
    baito: { x: 136, y: 398, dir: 1, hide: [102, 352, 96, 48] }, // 野菜の木箱の後ろ（脚は箱と樽の陰にかくれる。かがむと右の樽から漬物を取る）
    deshi: { x: 716, y: 422, dir: -1 }, // 大八車の横で、店のほうを向いて重石を持つ
  },
  // 物語の人物。男爵は右から来て、ここで止まって言うだけ言って帰る。タマ殿は対決のあいだ左奥の樽のふたの上で審査し、終章のあとは看板の下の屋根で寝る
  cast: { baronX: 612, tamaJudge: { x: 262, y: 305 }, tamaNap: { x: 468, y: 156 } },
};

function pos(name) { const [x, y] = TRACE.hanging[name]; return { x, y }; }

/** 読み込む画像（assets/img/*.png）。 */
export const IMAGES = [
  'bg', 'basket', 'cloud_0', 'cloud_1',
  'char_kid1', 'char_kid2', 'char_kid3',
  ...Object.entries(TRACE.poses).flatMap(([n, ps]) => ps.map((_, i) => `pose_${n}_${i}`)),
  ...Object.keys(SURPRISE_BASE).map((n) => `surprise_${n}`), // 驚いた顔（assets/faces.js）
  ...Object.keys(ANGRY_BASE).map((n) => `angry_${n}`), // 怒った顔
  ...OVER_WORDS.great.concat(OVER_WORDS.bad).map((n) => `over_${n}`), // オーバーリアクションの描き文字
  ...STAFF_IMAGES, // 従業員（assets/staff.js）
  ...CAST_IMAGES, // 漬物男爵・タマ殿（assets/cast.js）
  ...Object.values(WALK).flatMap((fs) => fs.map((f) => f.img)), // 描き直した歩くコマ（tools/walk_frames.py）
  'hang_noren', 'hang_daikon', 'hang_chili_l', 'hang_chili_r',
  ...[0, 1, 2].flatMap((i) => ['empty', 'takuan', ...VEGETABLES.filter((v) => !v.img).map((v) => v.id)].map((v) => `slot${i}_${v}`)),
];
