// 店のレベル（段階C）。経験（xp）がたまると上がり、設備と枠が開く。1件足せば上のレベルが増える。
// 【仮置き】必要な経験・開く中身・肩書きはすべて遊びの釣り合いで決めた値（node scripts/placeholders.js で一覧）。
//
// 項目:
//   level    : レベル（1から順に）
//   xp       : このレベルになるのに必要な経験の合計
//   title    : 肩書き
//   line     : 上がったときの一言
//   barrels  : 置ける樽の最大数
//   regions  : 挑める地方の漬物の枠（段階Fで使う）
//   opens    : 開くもの（表示用）

export const LEVELS = [
  { level: 1, xp: 0, title: '見習い漬物屋', line: 'まだ樽にナメられている。', barrels: 4, regions: 0, opens: ['浅漬け・白菜漬け・ぬか漬け・たくあん・野沢菜漬'] },
  { level: 2, xp: 60, title: '駆け出しの漬物屋', line: '近所の猫が店先で昼寝するようになった。', barrels: 5, regions: 0, opens: ['樽の5個目', '壺'] }, // 【仮置き】
  { level: 3, xp: 180, title: '町の漬物屋', line: '回覧板に店の名前が載った（誤字だった）。', barrels: 5, regions: 1, opens: ['地方の漬物の枠 1つ'] }, // 【仮置き】
  { level: 4, xp: 400, title: '漬物名人', line: 'ぬか床に話しかけても、もう誰も驚かない。', barrels: 5, regions: 2, opens: ['加温室', '地方の漬物の枠 2つ'] }, // 【仮置き】
  { level: 5, xp: 750, title: '漬物番長', line: '重石を持つ姿が、やけに様になってきた。', barrels: 5, regions: 3, opens: ['燻製小屋', '地方の漬物の枠 3つ'] }, // 【仮置き】
  { level: 6, xp: 1200, title: '漬物仙人', line: '白菜の気持ちがわかる（気がする）。', barrels: 5, regions: 4, opens: ['地方の漬物の枠 4つ'] }, // 【仮置き】
  { level: 7, xp: 2000, title: '最強の漬物屋', line: 'ついに「最強」を名乗っても怒られなくなった。…でも道はまだ続く。', barrels: 5, regions: 4, opens: [] }, // 【仮置き】
];

/** 最後のレベルより先は、この経験ごとに「＋1」ずつ上がる（遊びは終わりなし） */
export const LEVEL_AFTER_LAST = 1000; // 【仮置き】
