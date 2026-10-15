// 動きの定義（2〜4コマのコマ送り。拡大縮小はしない）。
//
// POSE_ANIMS … ポーズ集の絵を差し替えるコマ。{ ms, pose: 絵の番号, dy: 上下のずれ, props: 持ち物 }
// PERSON_ANIMS … 1枚の絵をずらして作るコマ（子ども）。
//   up: 腰より上を (dx,dy) / head: 頭だけ / legs: [左脚dx, 右脚dx] / props: 持ち物

// ---- ポーズ集の番号 ----
// 店主:       0腕組み 1手を挙げる 2トングで取る 3袋に詰める 4袋を持つ 5袋を渡す 6お辞儀
// 女性:       0歩く 1歩く 2話す 3手を出す(かご) 4歩く(かご) 5指さす 6袋を受け取る
// おばあちゃん: 0歩く 1歩く 2立つ 3手を振る 4手を振る(巾着) 5お辞儀 6指さす 7袋を受け取る
// 頭巾のおばあちゃん: 0歩く 1歩く 2手を振る(かご) 3手を振る 4立つ 5指さす 6財布を出す 7袋を受け取る
// おじいさん:   0歩く 1歩く 2話す 3話す(袋) 4歩く 5指さす 6財布を出す 7受け取る
// 男の子:     0歩く 1歩く 2手を挙げる 3笑う 4歩く 5指さす 6財布を出す 7受け取る
// 女の子:     0歩く 1歩く 2話す 3笑う(かご) 4歩く 5指さす 6財布を出す 7受け取る
// セーラー服:  0歩く 1歩く 2話す 3笑う(かご) 4歩く 5指さす 6財布を出す 7受け取る
// 学生服:     0歩く 1歩く 2話す 3笑う 4歩く 5指さす 6財布を出す 7受け取る
// ブレザー:    0歩く 1歩く 2手を振る(かご) 3笑う(かご) 4歩く 5指さす 6財布を出す 7受け取る
// 紫の服:     0歩く 1歩く 2話す 3笑う(かご) 4歩く 5指さす 6財布を出す 7受け取る
// スーツ:     0歩く 1歩く 2話す 3笑う 4歩く 5指さす 6財布を出す 7受け取る
// サングラス:  0歩く 1歩く 2話す 3話す 4歩く(かご2つ) 5指さす 6財布を出す 7受け取る
const p = (ms, pose, o = {}) => ({ ms, pose, dy: 0, props: [], ...o });
const SALT = (s, dy) => ({ s, at: 'hand', dx: 0, dy });

export const POSE_ANIMS = {
  keeper: {
    idle: { loop: true, frames: [p(900, 0), p(900, 0, { dy: -1 })] },
    greet: { loop: false, frames: [p(250, 1, { dy: -1 }), p(500, 1)] },
    take: { loop: false, frames: [p(350, 2), p(350, 2, { dy: 1 }), p(400, 3)] },
    salt: { loop: true, frames: [
      p(170, 2, { props: [SALT('salt_a', 0)] }), p(170, 2, { dy: 1, props: [SALT('salt_b', 2)] }),
      p(170, 2, { props: [SALT('salt_c', 4)] }), p(170, 2, { dy: 1 }),
    ] },
    give: { loop: false, frames: [p(300, 4), p(500, 5), p(550, 6)] },
  },
  woman: {
    walk: { loop: true, frames: [p(180, 0), p(180, 1)] },
    walk_basket: { loop: true, frames: [p(180, 0), p(180, 1)] },
    idle: { loop: true, frames: [p(800, 4), p(800, 4, { dy: -1 })] },
    look: { loop: true, frames: [p(600, 5), p(500, 4)] },
    buy: { loop: false, frames: [p(400, 6), p(700, 6, { dy: -1 })] },
    talk: { loop: true, frames: [p(300, 2), p(300, 3)] },
    talk_basket: { loop: true, frames: [p(300, 3), p(300, 3, { dy: -1 })] },
  },
  granny: {
    walk: { loop: true, frames: [p(200, 0), p(200, 1)] },
    walk_basket: { loop: true, frames: [p(200, 0), p(200, 1)] },
    idle: { loop: true, frames: [p(800, 2), p(800, 2, { dy: -1 })] },
    look: { loop: true, frames: [p(600, 6), p(600, 5)] },
    buy: { loop: false, frames: [p(400, 7), p(700, 7, { dy: -1 })] },
    talk: { loop: true, frames: [p(300, 3), p(300, 4)] },
    talk_basket: { loop: true, frames: [p(300, 3), p(300, 4)] },
  },
  granny2: {
    walk: { loop: true, frames: [p(200, 0), p(200, 1)] },
    walk_basket: { loop: true, frames: [p(200, 0), p(200, 1)] },
    idle: { loop: true, frames: [p(800, 4), p(800, 4, { dy: -1 })] },
    look: { loop: true, frames: [p(700, 5), p(500, 4)] },
    buy: { loop: false, frames: [p(500, 6), p(600, 7)] },
    talk: { loop: true, frames: [p(300, 3), p(300, 2)] },
    talk_basket: { loop: true, frames: [p(300, 2), p(300, 3)] },
  },
  oldman: {
    walk: { loop: true, frames: [p(190, 0), p(190, 1)] },
    walk_basket: { loop: true, frames: [p(190, 0), p(190, 1)] },
    idle: { loop: true, frames: [p(800, 2), p(800, 2, { dy: -1 })] },
    look: { loop: true, frames: [p(700, 5), p(500, 2)] },
    buy: { loop: false, frames: [p(500, 6), p(600, 7)] },
    talk: { loop: true, frames: [p(300, 2), p(300, 3)] },
    talk_basket: { loop: true, frames: [p(300, 3), p(300, 2)] },
  },
  boy: {
    walk: { loop: true, frames: [p(160, 0), p(160, 1)] },
    walk_basket: { loop: true, frames: [p(160, 0), p(160, 1)] },
    idle: { loop: true, frames: [p(800, 3), p(800, 3, { dy: -1 })] },
    look: { loop: true, frames: [p(700, 5), p(500, 3)] },
    buy: { loop: false, frames: [p(500, 6), p(600, 7)] },
    talk: { loop: true, frames: [p(300, 2), p(300, 3)] },
    talk_basket: { loop: true, frames: [p(300, 2), p(300, 3)] },
  },
  girl: {
    walk: { loop: true, frames: [p(160, 0), p(160, 1)] },
    walk_basket: { loop: true, frames: [p(160, 0), p(160, 1)] },
    idle: { loop: true, frames: [p(800, 3), p(800, 3, { dy: -1 })] },
    look: { loop: true, frames: [p(700, 5), p(500, 3)] },
    buy: { loop: false, frames: [p(500, 6), p(600, 7)] },
    talk: { loop: true, frames: [p(300, 2), p(300, 3)] },
    talk_basket: { loop: true, frames: [p(300, 2), p(300, 3)] },
  },
  student: {
    walk: { loop: true, frames: [p(180, 0), p(180, 1)] },
    walk_basket: { loop: true, frames: [p(180, 0), p(180, 1)] },
    idle: { loop: true, frames: [p(800, 3), p(800, 3, { dy: -1 })] },
    look: { loop: true, frames: [p(700, 5), p(500, 3)] },
    buy: { loop: false, frames: [p(500, 6), p(600, 7)] },
    talk: { loop: true, frames: [p(300, 2), p(300, 3)] },
    talk_basket: { loop: true, frames: [p(300, 2), p(300, 3)] },
  },
  gakuran: {
    walk: { loop: true, frames: [p(180, 0), p(180, 1)] },
    walk_basket: { loop: true, frames: [p(180, 0), p(180, 1)] },
    idle: { loop: true, frames: [p(800, 3), p(800, 3, { dy: -1 })] },
    look: { loop: true, frames: [p(700, 5), p(500, 3)] },
    buy: { loop: false, frames: [p(500, 6), p(600, 7)] },
    talk: { loop: true, frames: [p(300, 2), p(300, 3)] },
    talk_basket: { loop: true, frames: [p(300, 2), p(300, 3)] },
  },
  blazer: {
    walk: { loop: true, frames: [p(180, 0), p(180, 1)] },
    walk_basket: { loop: true, frames: [p(180, 0), p(180, 1)] },
    idle: { loop: true, frames: [p(800, 3), p(800, 3, { dy: -1 })] },
    look: { loop: true, frames: [p(700, 5), p(500, 3)] },
    buy: { loop: false, frames: [p(500, 6), p(600, 7)] },
    talk: { loop: true, frames: [p(300, 2), p(300, 3)] },
    talk_basket: { loop: true, frames: [p(300, 2), p(300, 3)] },
  },
  yankee: {
    walk: { loop: true, frames: [p(180, 0), p(180, 1)] },
    walk_basket: { loop: true, frames: [p(180, 0), p(180, 1)] },
    idle: { loop: true, frames: [p(800, 3), p(800, 3, { dy: -1 })] },
    look: { loop: true, frames: [p(700, 5), p(500, 3)] },
    buy: { loop: false, frames: [p(500, 6), p(600, 7)] },
    talk: { loop: true, frames: [p(300, 2), p(300, 3)] },
    talk_basket: { loop: true, frames: [p(300, 2), p(300, 3)] },
  },
  shades: {
    walk: { loop: true, frames: [p(180, 0), p(180, 1)] },
    walk_basket: { loop: true, frames: [p(180, 0), p(180, 1)] },
    idle: { loop: true, frames: [p(800, 3), p(800, 3, { dy: -1 })] },
    look: { loop: true, frames: [p(700, 5), p(500, 3)] },
    buy: { loop: false, frames: [p(500, 6), p(600, 7)] },
    talk: { loop: true, frames: [p(300, 2), p(300, 3)] },
    talk_basket: { loop: true, frames: [p(300, 2), p(300, 3)] },
  },
  suit: {
    walk: { loop: true, frames: [p(200, 0), p(200, 1)] },
    walk_basket: { loop: true, frames: [p(200, 0), p(200, 1)] },
    idle: { loop: true, frames: [p(800, 3), p(800, 3, { dy: -1 })] },
    look: { loop: true, frames: [p(700, 5), p(500, 3)] },
    buy: { loop: false, frames: [p(500, 6), p(600, 7)] },
    talk: { loop: true, frames: [p(300, 2), p(300, 3)] },
    talk_basket: { loop: true, frames: [p(300, 2), p(300, 3)] },
  },
};

const fr = (ms, o = {}) => ({ ms, up: [0, 0], head: [0, 0], legs: [0, 0], props: [], ...o });
const WALK = [fr(140), fr(140, { up: [0, -1], legs: [1, -1] }), fr(140), fr(140, { up: [0, -1], legs: [-1, 1] })];
const BASKET = [{ s: 'basket', at: 'hand', dx: -8, dy: -3 }];

export const PERSON_ANIMS = {
  walk: { loop: true, frames: WALK },
  walk_basket: { loop: true, frames: WALK.map((f) => ({ ...f, props: BASKET })) },
  idle: { loop: true, frames: [fr(700), fr(700, { up: [0, -1] })] },
  look: { loop: true, frames: [fr(550, { head: [-1, 0] }), fr(450, { head: [-1, 1] }), fr(500)] },
  buy: { loop: false, frames: [fr(350, { up: [-1, 0] }), fr(350, { up: [-1, 0], props: BASKET }), fr(400, { props: BASKET })] },
  talk: { loop: true, frames: [fr(240, { head: [0, -1] }), fr(240)] },
  talk_basket: { loop: true, frames: [fr(240, { head: [0, -1], props: BASKET }), fr(240, { props: BASKET })] },
};

// 吊るし物の揺れ（下ほど大きく、左右に1ドット）。各区切りは SCENE.hanging の ms で別々の周期になる
export const SWAY_SEQ = [0, 1, 0, -1];
