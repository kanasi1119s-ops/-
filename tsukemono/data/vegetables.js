// 野菜の定義（段階E）。1件足すだけで、仕入れ・仕込みの窓・図鑑に新しい野菜が出る（樽の中身の絵は assets/img/slot{0..2}_{id}.png）。
// 【出典】= 根拠のある値 / 【仮置き】= 遊びの釣り合いで決めた値（node scripts/placeholders.js で一覧）。
//
// 項目:
//   id, name   : 見出しと表示名
//   water      : 水分量（0〜1）。【出典: 日本食品標準成分表の生の値の目安】多いほど、ぬか床を水っぽくし、塩味が薄まる。干すと減る
//   saltUptake : 塩の入り方（1 = 白菜と同じ）。葉物は早く、かたい根や皮の厚い実は遅い。塩味の回る速さと量に掛ける
//   fermentRate: 漬かる速さ（1 = 白菜と同じ）
//   crisp0, crispTau : 食感の変わり方。漬けはじめの歯ごたえと、やわらかくなるまでの長さ（大きいほど長くポリポリ）
//   spoilMult  : 傷みやすさ
//   cost       : 6個分の仕入れ値（円）
//   seasons    : 季節ごとの値段の倍率（1未満が旬）
//   contract   : 農家と契約しないと仕入れられない { cost, level, farmer }
//   note       : 説明

export const VEGETABLES = [
  { id: 'hakusai', name: '白菜', water: 0.952, saltUptake: 1.0, fermentRate: 1.0, crisp0: 80, crispTau: 20, spoilMult: 1.0, cost: 500, seasons: { spring: 1.1, summer: 1.3, autumn: 0.9, winter: 0.7 }, note: '葉が重なり、塩がよく回る' }, // fermentRate は【出典】基準、ほかは【仮置き】
  { id: 'kyuri', name: 'きゅうり', water: 0.954, saltUptake: 1.0, fermentRate: 1.1, crisp0: 95, crispTau: 8, spoilMult: 1.3, cost: 300, seasons: { spring: 1.0, summer: 0.7, autumn: 1.1, winter: 1.4 }, note: 'シャキシャキだが早くやわらかくなる' }, // 【仮置き】
  { id: 'daikon', name: '大根', water: 0.946, saltUptake: 0.8, fermentRate: 0.8, crisp0: 90, crispTau: 80, spoilMult: 0.8, cost: 400, seasons: { spring: 1.1, summer: 1.4, autumn: 0.9, winter: 0.7 }, note: 'かたく、ゆっくり漬かる。長く漬けてもポリポリ（冬が旬、たくあんの仕込み時期）' }, // 【仮置き】
  { id: 'nozawana', name: '野沢菜', water: 0.94, saltUptake: 1.15, fermentRate: 1.0, crisp0: 85, crispTau: 15, spoilMult: 1.0, cost: 450, seasons: { spring: 1.2, summer: 1.5, autumn: 0.9, winter: 0.7 }, note: '葉物で塩の入りが早い（晩秋〜冬）' }, // 【仮置き】
  { id: 'nasu', name: 'なす', water: 0.932, saltUptake: 0.9, fermentRate: 1.1, crisp0: 70, crispTau: 10, spoilMult: 1.2, cost: 350, seasons: { spring: 1.2, summer: 0.7, autumn: 0.9, winter: 1.5 }, note: '皮があって塩の入りは少し遅い。やわらかめ（夏〜秋）' }, // 【仮置き】
  { id: 'kabu', name: 'かぶ', water: 0.939, saltUptake: 1.05, fermentRate: 1.1, crisp0: 85, crispTau: 12, spoilMult: 1.1, cost: 300, seasons: { spring: 1.0, summer: 1.3, autumn: 0.8, winter: 0.8 }, note: 'やわらかく、早く漬かる（秋〜冬）' }, // 【仮置き】
  { id: 'akakabu', name: '赤かぶ', water: 0.92, saltUptake: 1.0, fermentRate: 1.1, crisp0: 88, crispTau: 14, spoilMult: 1.1, cost: 400, seasons: { spring: 1.1, summer: 1.4, autumn: 0.8, winter: 0.8 }, contract: { cost: 3000, level: 2, farmer: '山あいの赤かぶ農家' }, note: '色が鮮やか。契約農家から（秋〜冬）' }, // 【仮置き】
  { id: 'ninjin', name: 'にんじん', water: 0.891, saltUptake: 0.8, fermentRate: 0.8, crisp0: 90, crispTau: 40, spoilMult: 0.9, cost: 250, seasons: { spring: 1.0, summer: 1.2, autumn: 0.8, winter: 0.9 }, note: '水分が少なめで、かたく、ゆっくり漬かる（秋〜冬）' }, // 【仮置き】
  { id: 'kyabetsu', name: 'キャベツ', water: 0.927, saltUptake: 1.1, fermentRate: 1.1, crisp0: 80, crispTau: 12, spoilMult: 1.1, cost: 300, seasons: { spring: 0.7, summer: 1.0, autumn: 1.1, winter: 1.0 }, note: '葉物で塩の入りが早い（春キャベツ）' }, // 【仮置き】
  // ---- 段階Eで追加 ----
  { id: 'ume', name: '梅', water: 0.904, saltUptake: 0.6, fermentRate: 0.6, crisp0: 60, crispTau: 30, spoilMult: 1.0, cost: 600, seasons: { spring: 1.3, summer: 0.6, autumn: 2.0, winter: 2.0 }, note: '皮がかたく、塩はゆっくり入る。6月ごろの青梅が旬' }, // 【仮置き】
  { id: 'shirouri', name: '白瓜', water: 0.953, saltUptake: 1.0, fermentRate: 1.0, crisp0: 88, crispTau: 18, spoilMult: 1.2, cost: 350, seasons: { spring: 1.3, summer: 0.7, autumn: 1.1, winter: 1.6 }, note: '水分が多い。粕漬け（奈良漬け）の定番（夏）' }, // 【仮置き】
  { id: 'myoga', name: 'みょうが', water: 0.956, saltUptake: 1.2, fermentRate: 1.2, crisp0: 82, crispTau: 10, spoilMult: 1.2, cost: 500, seasons: { spring: 1.4, summer: 0.8, autumn: 0.9, winter: 1.6 }, note: '薄く重なっていて塩がすぐ入る。香りが良い（夏〜秋）' }, // 【仮置き】
];

/** 定義の一覧から { vegetables, priceBySeason } を作る。id がかぶったり、必須の項目が抜けていればエラー。 */
export function vegetablesFrom(defs) {
  const vegetables = {}, priceBySeason = {};
  for (const d of defs) {
    for (const k of ['id', 'name', 'water', 'saltUptake', 'fermentRate', 'crisp0', 'crispTau', 'spoilMult', 'cost']) if (d[k] == null) throw new Error(`野菜の定義 ${d.id ?? '?'}: ${k} がない`);
    if (vegetables[d.id]) throw new Error(`野菜の定義 ${d.id}: id がかぶっている`);
    const { id, seasons, ...rest } = d;
    vegetables[id] = rest;
    if (seasons) priceBySeason[id] = { ...seasons };
  }
  return { vegetables, priceBySeason };
}
