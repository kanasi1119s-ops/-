// 動きの定義。「絵の差し替え（2〜4コマのコマ送り）」だけで動かす。拡大縮小はしない。
// 人は 12×21 のコマの中に、レイヤー（部品スプライト）を重ねて作る。
//   head/legs/torso/arm... は sprites.js の名前。'@head' '@head_talk' は人ごとの髪型に置き換わる。

const LEFT = 'L', RIGHT = 'R';

function arm(side, kind, bob) {
  const L = side === LEFT;
  switch (kind) {
    case 'down': return { s: 'arm_down', x: L ? 2 : 9, y: 8 + bob };
    case 'up': return { s: 'arm_up', x: L ? 1 : 9, y: 6 + bob, flip: L };
    case 'out': return { s: 'arm_out', x: L ? -6 : 9, y: 9 + bob, flip: !L };
    case 'none': return null;
    default: throw new Error(`unknown arm: ${kind}`);
  }
}

/** 人の1コマ分のレイヤー列。 */
function person({ head = '@head', armL = 'down', armR = 'down', legs = 'stand', bob = 0, extra = [], hands = [] }) {
  return {
    bob,
    layers: [
      { s: `legs_${legs}`, x: 0, y: 15 },
      { s: 'torso', x: 3, y: 8 + bob },
      arm(LEFT, armL, bob),
      arm(RIGHT, armR, bob),
      ...hands.map((h) => ({ ...h, y: h.y + bob })),
      { s: head, x: 0, y: bob },
      ...extra,
    ].filter(Boolean),
  };
}
const f = (ms, spec) => ({ ms, ...person(spec) });

const WALK = [['stride', 0], ['stand', -1], ['cross', 0], ['stand', -1]];
const BASKET_EMPTY = [{ s: 'basket_empty', x: 2, y: 12 }];
const BASKET_FULL = [{ s: 'basket_full', x: 2, y: 10 }];

export const PERSON_ANIMS = {
  // ---- 客（歩く・品を見る・買う・しゃべる）----
  customer: {
    walk: { loop: true, frames: WALK.map(([legs, bob]) => f(130, { legs, bob })) },
    walk_basket: { loop: true, frames: WALK.map(([legs, bob]) => f(130, { legs, bob, hands: BASKET_FULL })) },
    look: { loop: true, frames: [f(500, { armR: 'up', bob: 0 }), f(500, { bob: -1 }), f(400, { armR: 'up', bob: 0 })] },
    buy: { loop: false, frames: [f(300, { hands: BASKET_EMPTY }), f(300, { hands: BASKET_FULL, bob: -1 }), f(400, { hands: BASKET_FULL })] },
    talk: { loop: true, frames: [f(260, { head: '@head_talk', armL: 'up' }), f(260, { head: '@head' }), f(260, { head: '@head_talk', armL: 'up', bob: -1 }), f(260, { head: '@head' })] },
    talk_basket: { loop: true, frames: [f(260, { head: '@head_talk', hands: BASKET_FULL }), f(260, { head: '@head', hands: BASKET_FULL })] },
    idle: { loop: true, frames: [f(600, {}), f(600, { bob: -1 })] },
  },
  // ---- 店主（樽から取る・塩をふる・客に渡す）----
  keeper: {
    idle: { loop: true, frames: [f(700, {}), f(700, { bob: -1 })] },
    take: { loop: false, frames: [
      f(300, { armL: 'out' }),
      f(300, { armL: 'out', hands: [{ s: 'pickle_piece', x: -8, y: 10 }] }),
      f(350, { armL: 'up', hands: [{ s: 'pickle_piece', x: -1, y: 5 }] }),
    ] },
    salt: { loop: true, frames: [
      f(180, { armL: 'out', hands: [{ s: 'salt_a', x: -9, y: 11 }] }),
      f(180, { armL: 'out', hands: [{ s: 'salt_b', x: -9, y: 12 }] }),
      f(180, { armL: 'out', hands: [{ s: 'salt_c', x: -9, y: 13 }] }),
      f(180, { armL: 'up', hands: [] }),
    ] },
    give: { loop: false, frames: [
      f(280, { armR: 'out', hands: [{ s: 'plate', x: 15, y: 11 }] }),
      f(300, { armR: 'out', hands: [{ s: 'plate', x: 15, y: 11 }, { s: 'pickle_piece', x: 16, y: 9 }] }),
      f(300, { armR: 'out', hands: [{ s: 'plate', x: 15, y: 11 }] }),
    ] },
  },
};
export const CUSTOMER_FRAME = { w: 12, h: 21 };

// ---- 背景の動き（コマ送りの順番と周期）----
// seq: スプライト名の並び / ms: 1コマの長さ / ここでは周期を物ごとに少しずつ変えて揃わないようにする。
const NOREN_SEQS = [['noren_0', 'noren_1', 'noren_0', 'noren_3'], ['noren_0', 'noren_3', 'noren_0', 'noren_1']];
export const SCENERY_ANIMS = {
  noren: Array.from({ length: 7 }, (_, i) => ({
    x: 88 + i * 20, y: 77, seq: NOREN_SEQS[i % 2], ms: 900 + ((i * 230) % 600), phase: (i * 370) % 1000,
  })),
  daikon: [
    { x: 90, y: 95, seq: ['daikon_0', 'daikon_1', 'daikon_0', 'daikon_2'], ms: 800, phase: 0 },
    { x: 99, y: 95, seq: ['daikon_0', 'daikon_2', 'daikon_0', 'daikon_1'], ms: 1000, phase: 300 },
    { x: 108, y: 95, seq: ['daikon_0', 'daikon_1', 'daikon_0', 'daikon_2'], ms: 1200, phase: 650 },
  ],
  chili: [
    { x: 132, y: 95, seq: ['chili_0', 'chili_1', 'chili_0', 'chili_2'], ms: 900, phase: 100 },
    { x: 140, y: 95, seq: ['chili_0', 'chili_2', 'chili_0', 'chili_1'], ms: 1150, phase: 500 },
  ],
  // 雲: 速さ(px/秒)がバラバラ
  clouds: [
    { s: 'cloud_b', y: 12, speed: 3.0, x0: 20 },
    { s: 'cloud_a', y: 30, speed: 5.5, x0: 150 },
    { s: 'cloud_c', y: 20, speed: 8.0, x0: 260 },
    { s: 'cloud_a', y: 6, speed: 2.2, x0: 330 },
  ],
};
