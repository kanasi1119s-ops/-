// 店先の配置（座標はすべて 320×180 のドット座標）。
export const SCENE = {
  w: 320, h: 180,
  horizonY: 96, // 山のふもと
  paddyY: 98, paddyH: 28, bankY: 126, groundY: 142,
  roof: { x: 114, y: 70 },
  interior: { x: 124, y: 92, w: 192, h: 50 },
  posts: [{ x: 124, y: 92, w: 4, h: 50 }, { x: 312, y: 92, w: 4, h: 50 }],
  beam: { x: 124, y: 92, w: 192, h: 3 },
  sign: { x: 170, y: 54, w: 60, h: 16, text: '漬物' },
  lantern: { x: 296, y: 94 },
  tree: { x: 22, y: 82 },
  // 樽: x は左端、底は groundY
  barrels: [{ x: 130 }, { x: 170 }, { x: 210 }],
  barrelW: 36, barrelH: 32,
  keeperHome: { x: 284, y: 150 }, // 足元の座標（中心x, 底y）
  keeperAtBarrel: (slot) => 170 + slot * 40 + 4, // 樽の右側に立つ（中心x）
  customerLane: { y: 172, startX: -16, standX: 292, endX: 340 },
  sunPos: { morning: [58, 52], noon: [150, 16], evening: [262, 54] },
  moonPos: [250, 22],
  stars: 28,
};
