// 動きの定義。トレースした1枚の絵を、部分ごとに1〜2ドットずらしたコマで動かす（拡大縮小はしない）。
//   up: 腰より上を (dx,dy) ずらす / head: 頭だけずらす / legs: [左脚dx, 右脚dx] / props: 持ち物
const fr = (ms, o = {}) => ({ ms, up: [0, 0], head: [0, 0], legs: [0, 0], props: [], ...o });

const WALK = [fr(140), fr(140, { up: [0, -1], legs: [1, -1] }), fr(140), fr(140, { up: [0, -1], legs: [-1, 1] })];
const BASKET = [{ s: 'basket', at: 'hand', dx: -8, dy: -3 }];

export const PERSON_ANIMS = {
  // ---- 客（歩く・品を見る・買う・しゃべる）----
  customer: {
    walk: { loop: true, frames: WALK },
    walk_basket: { loop: true, frames: WALK.map((f) => ({ ...f, props: BASKET })) },
    idle: { loop: true, frames: [fr(700), fr(700, { up: [0, -1] })] },
    look: { loop: true, frames: [fr(550, { head: [-1, 0] }), fr(450, { head: [-1, 1] }), fr(500)] },
    buy: { loop: false, frames: [fr(350, { up: [-1, 0] }), fr(350, { up: [-1, 0], props: BASKET }), fr(400, { props: BASKET })] },
    talk: { loop: true, frames: [fr(240, { head: [0, -1] }), fr(240)] },
    talk_basket: { loop: true, frames: [fr(240, { head: [0, -1], props: BASKET }), fr(240, { props: BASKET })] },
  },
  // ---- 店主（樽から取る・塩をふる・客に渡す）----
  keeper: {
    idle: { loop: true, frames: [fr(800), fr(800, { up: [0, -1] })] },
    take: { loop: false, frames: [
      fr(300, { up: [-1, 1] }),
      fr(320, { up: [-2, 2], props: [{ s: 'pickle_piece', at: 'handL', dx: -3, dy: 1 }] }),
      fr(380, { up: [-1, 0], props: [{ s: 'pickle_piece', at: 'handL', dx: 2, dy: -6 }] }),
    ] },
    salt: { loop: true, frames: [
      fr(170, { up: [-1, 1], props: [{ s: 'salt_a', at: 'handL', dx: -4, dy: 2 }] }),
      fr(170, { up: [-2, 1], props: [{ s: 'salt_b', at: 'handL', dx: -5, dy: 4 }] }),
      fr(170, { up: [-1, 1], props: [{ s: 'salt_c', at: 'handL', dx: -4, dy: 6 }] }),
      fr(170, { up: [0, 0] }),
    ] },
    give: { loop: false, frames: [
      fr(280, { up: [1, 0], props: [{ s: 'plate', at: 'handR', dx: 1, dy: 0 }] }),
      fr(320, { up: [2, 0], props: [{ s: 'plate', at: 'handR', dx: 2, dy: 0 }, { s: 'pickle_piece', at: 'handR', dx: 3, dy: -2 }] }),
      fr(320, { up: [1, 0], props: [{ s: 'plate', at: 'handR', dx: 1, dy: 0 }] }),
    ] },
  },
};

// 吊るし物の揺れ（下ほど大きく、左右に1ドット）。各区切りは SCENE.hanging の ms で別々の周期になる
export const SWAY_SEQ = [0, 1, 0, -1];
