// 店先の配置（座標はすべて 320×180 のドット座標）。
// 参考: 田んぼと山を背に、瓦屋根の小さな漬物店。店主は店内、樽は軒先に並ぶ。
export const SCENE = {
  w: 320, h: 180,
  horizonY: 96, // 山のふもと
  paddyY: 98, paddyH: 28, bankY: 126, groundY: 142,
  roof: { x: 66, y: 50 },
  interior: { x: 80, y: 74, w: 160, h: 68 },
  posts: [{ x: 78, y: 74, w: 4, h: 68 }, { x: 238, y: 74, w: 4, h: 68 }],
  beam: { x: 80, y: 74, w: 160, h: 3 },
  sign: { x: 118, y: 36, w: 84, h: 18, text: '○○漬物店' },
  noren: { x: 88, y: 77, w: 20, texts: ['漬', '物', '', 'つ', 'け', 'も', 'の'] },
  lantern: { x: 218, y: 96 },
  tree: { x: 262, y: 82 },
  pole: { x: 10, top: 22 },
  shed: { x: 40, y: 98, w: 38 },
  bicycle: { x: 12, y: 132 },
  crate: { x: 54, y: 132 },
  // 樽: x は左端、底は groundY
  barrels: [{ x: 86 }, { x: 124 }, { x: 162 }],
  barrelW: 36, barrelH: 32,
  keeperHome: { x: 220, y: 146 }, // 足元の座標（中心x, 底y）
  keeperAtBarrel: (slot) => 130 + slot * 38, // 樽の右側に立つ（中心x）
  customerLane: { y: 172, startX: -16, standX: 254, endX: 340 },
  sunPos: { morning: [44, 40], noon: [150, 14], evening: [286, 44] },
  moonPos: [270, 20],
  stars: 28,
};
