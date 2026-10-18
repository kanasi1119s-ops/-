// 季節の行事と特需（段階D）。1件足せば、その日に客足・値段・人気の漬物・野菜の値段が変わる。
// 1年 = 春夏秋冬 × 28日。日にちは季節の中の何日目か（1〜28）。【仮置き】日にちと効き目はすべて遊びの釣り合いで決めた値
//
// 項目:
//   season, from, to : いつ（季節と、その季節の何日目から何日目まで）
//   visitors : 来るお客の多さに掛ける
//   price    : 売り値に掛ける
//   likes    : この期間に特に売れる漬物（好きな漬物と同じだけ満足度が上がる）
//   vegPrice : 野菜の仕入れ値に掛ける { 野菜: 倍率 }
//   note     : 説明（ちょっとふざけてよい）

export const EVENTS = [
  { id: 'hanami', name: 'お花見', season: 'spring', from: 8, to: 10, visitors: 1.3, price: 1, likes: ['asazuke', 'shibazuke'], note: '花より団子、団子より漬物（という人もいる）' }, // 【仮置き】
  { id: 'tsuyu', name: '梅雨入り', season: 'summer', from: 1, to: 5, visitors: 0.9, price: 1, likes: ['nukazuke'], vegPrice: { kyuri: 0.8 }, note: 'じめじめ。ぬか床がやたら元気になる季節' }, // 【仮置き】
  { id: 'obon', name: 'お盆', season: 'summer', from: 20, to: 23, visitors: 1.5, price: 1.1, likes: ['nukazuke', 'shibazuke', 'asazuke', 'karashizuke'], note: '帰省した人たちが「この味だよ、この味」と買っていく' }, // 【仮置き】
  { id: 'takuanDoki', name: 'たくあんの仕込みどき', season: 'autumn', from: 20, to: 28, visitors: 1, price: 1, likes: [], vegPrice: { daikon: 0.6 }, note: '干し大根が軒先に並ぶ季節。大根が安い。いま漬けると正月に間に合う' }, // 【仮置き】
  { id: 'saimatsu', name: '歳末', season: 'winter', from: 5, to: 9, visitors: 1.3, price: 1.15, likes: ['takuan', 'hakusaizuke', 'kasuzuke', 'nozawanazuke'], note: 'お歳暮に漬物。重い。でも喜ばれる' }, // 【仮置き】
  { id: 'shogatsu', name: '正月', season: 'winter', from: 10, to: 12, visitors: 1.6, price: 1.2, likes: ['takuan', 'hakusaizuke', 'kasuzuke', 'furuzuke'], note: 'おせちに飽きた人が、漬物を求めてやってくる' }, // 【仮置き】
];

/** その日の行事（なければ null）。dayOfSeason は 1〜28 */
export function eventOn(season, dayOfSeason, events = EVENTS) {
  return events.find((e) => e.season === season && dayOfSeason >= e.from && dayOfSeason <= e.to) ?? null;
}
