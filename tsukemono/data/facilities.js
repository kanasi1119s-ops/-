// 設備（段階C）。置き場所（漬ける温度が決まるもの）と、道具（持っていると作れる・ひらめく漬物が増えるもの）。
// 1件足すだけで、店の窓に並び、仕込みの置き場所やひらめきの条件に使える。
//
// 項目:
//   id     : 見出し（セーブのキーになるので変えない）
//   name   : 表示名
//   cost   : 値段（0 = はじめから持っている）
//   level  : 買える店のレベル
//   offset : 置き場所の温度 = 外気温 + offset（℃）
//   fixed  : 置き場所の温度をいつもこの値にする（℃）。offset も fixed もなければ置き場所ではなく道具
//   note   : 説明

export const FACILITIES = [
  { id: 'outdoor', name: '屋外', cost: 0, level: 1, offset: 3, note: '外気温 + 3℃（日なた）' }, // 【仮置き】
  { id: 'doma', name: '土間', cost: 0, level: 1, offset: -2, note: '外気温 − 2℃' }, // 【仮置き】
  { id: 'fridge', name: '冷蔵庫', cost: 3000, level: 1, fixed: 4, note: 'いつでも4℃' }, // 値段は【仮置き】
  { id: 'muro', name: '室（むろ）', cost: 4000, level: 1, fixed: 22, note: '発酵の最良18〜22℃を保つ部屋' }, // 【出典】ザワークラウト18〜22℃。値段は【仮置き】
  { id: 'tsubo', name: '壺', cost: 2000, level: 2, note: '小さな仕込み用の陶器の壺。梅干しなどに（段階Eで使う）' }, // 【仮置き】
  { id: 'kaon', name: '加温室', cost: 12000, level: 4, fixed: 40, note: '約40℃で発酵させる部屋（すぐき漬けなど。段階Fで使う）' }, // 【出典】すぐきの室は約40℃。値段は【仮置き】
  { id: 'kunsei', name: '燻製小屋', cost: 15000, level: 5, note: '薪で燻す小屋（いぶりがっこなど。段階Fで使う）' }, // 【仮置き】
];

/** 定義の一覧から { facilities, places } を作る。places は温度の決まる置き場所だけ。 */
export function facilitiesFrom(defs) {
  const facilities = {}, places = {};
  for (const d of defs) {
    for (const k of ['id', 'name', 'cost', 'level']) if (d[k] == null) throw new Error(`設備の定義 ${d.id ?? '?'}: ${k} がない`);
    if (facilities[d.id]) throw new Error(`設備の定義 ${d.id}: id がかぶっている`);
    const { id, ...rest } = d;
    facilities[id] = { ...rest, isPlace: d.offset != null || d.fixed != null };
    if (facilities[id].isPlace) places[id] = facilities[id];
  }
  return { facilities, places };
}
