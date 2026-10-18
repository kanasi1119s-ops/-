// 特別な食材（仕込みのときに買い足す、ちょっと良い材料）。1件足せば仕込みの窓に並ぶ。
// 費用は標準の個数ぶん（多く仕込めばそのぶん増える）。1つの樽に2つまで、同じ種類（kind）は1つまで。
// 【仮置き】値段と効き目はすべて遊びの釣り合いで決めた値
//
// 項目:
//   kind    : 種類（salt 塩 / umami 旨味 / veg 野菜 / aroma 香り / deco 飾り）。同じ種類は1つまで
//   cost    : 標準の個数ぶんの値段（円）
//   level   : 使える店のレベル
//   pickles : この漬物にだけ使える（なければ、どれでも）
//   effects : complexity（風味の深さに足す。漬かるほど効く）/ texture（食感に掛ける）/ saltiness（塩味に掛ける）
//             / spoil（傷みリスクに掛ける）/ price（売り値に掛ける。お客は「良いもの」に払う）
//   note    : 説明（ちょっとふざけてよい）

export const SPECIALS = [
  { id: 'moshio', name: '藻塩', kind: 'salt', cost: 150, level: 1, effects: { complexity: 6, saltiness: 0.95, price: 1.05 }, note: '海藻のうまみ。しょっぱさが丸くなる' }, // 【仮置き】
  { id: 'tenpien', name: '天日塩', kind: 'salt', cost: 100, level: 1, effects: { complexity: 4, texture: 1.03, price: 1.03 }, note: 'お日さまでじっくり。気のせいか、シャキッとする' }, // 【仮置き】
  { id: 'asatore', name: '朝採れの野菜', kind: 'veg', cost: 200, level: 1, effects: { texture: 1.08, price: 1.08 }, note: '夜明けに畑で採れたもの。農家さんは眠そうだった' }, // 【仮置き】
  { id: 'yuki', name: '有機栽培の野菜', kind: 'veg', cost: 400, level: 2, effects: { texture: 1.12, complexity: 4, price: 1.15 }, note: '畑の土の匂いがする（いい意味で）' }, // 【仮置き】
  { id: 'rausu', name: '羅臼昆布', kind: 'umami', cost: 500, level: 2, effects: { complexity: 14, price: 1.12 }, note: '昆布の王様（と、昆布屋さんが言っていた）' }, // 【仮置き】
  { id: 'honkare', name: '本枯れ節', kind: 'umami', cost: 400, level: 2, effects: { complexity: 10, price: 1.08 }, note: '削ると、店じゅうがだしの香り' }, // 【仮置き】
  { id: 'jizake', name: '地酒', kind: 'aroma', cost: 400, level: 3, effects: { complexity: 8, price: 1.1 }, note: '少しだけ。店主もほんの少しだけ（味見）' }, // 【仮置き】
  { id: 'asakura', name: '朝倉山椒', kind: 'aroma', cost: 500, level: 3, effects: { complexity: 10, spoil: 0.9, price: 1.08 }, note: 'しびれる香り。虫もしびれて寄ってこない' }, // 【仮置き】
  { id: 'nankobai', name: '紀州の南高梅', kind: 'veg', cost: 1200, level: 2, pickles: ['umeboshi'], effects: { texture: 1.2, complexity: 6, price: 1.4 }, note: '皮がやわらかく、果肉が厚い。梅干しの王道' }, // 【仮置き】
  { id: 'kinpaku', name: '金箔', kind: 'deco', cost: 2400, level: 5, effects: { price: 1.5 }, note: '味は何も変わらない。値段は変わる（高い漬物ほど元が取れる）' }, // 【仮置き】
];
