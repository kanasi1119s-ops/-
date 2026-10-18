// ぬか床の手入れ（段階B）。1件足すだけで、ぬか床の窓にボタンが増え、ゲームの計算にも効く。
// 【出典】は企画書（ぬか床の対処）。効き目の数値は【仮置き】。
//
// 項目:
//   id / name   : 見出し / ボタンの名前
//   when        : どんなときの手入れか（窓の見出し）。sour=酸っぱい / water=水っぽい / rot=傷みを防ぐ / umami=旨味を足す
//   cost        : 1回の費用（円）
//   effects     : 床の状態の増減。sour・water・rot・film（0〜1）、salt（%）、umami（0〜1）、maturity（0〜1）
//   resetsSute  : true なら捨て漬けを替えたことになる（傷みの進みがゼロから数え直し）
//   note        : 窓に出す説明

export const NUKA_CARE = [
  // 酸っぱいとき 【出典】塩を足す／からしを大さじ1杯ほど入れる／卵の殻を入れる
  { id: 'salt', name: '塩を足す', when: 'sour', cost: 10, effects: { salt: 1, sour: -0.25 }, note: '塩分が上がり、酸味が和らぐ' }, // 【仮置き】効き目
  { id: 'karashi', name: 'からしを入れる（大さじ1）', when: 'sour', cost: 40, effects: { sour: -0.4, rot: -0.05 }, note: '酸味をおさえ、傷みも少し防ぐ' }, // 【仮置き】
  { id: 'egg', name: '卵の殻を入れる', when: 'sour', cost: 0, effects: { sour: -0.2 }, note: '殻が酸を和らげる（よく洗って乾かした殻）' }, // 【仮置き】
  // 水っぽいとき 【出典】ぬか1カップに塩小さじ1〜大さじ1/2を足す
  { id: 'nuka', name: 'ぬかと塩を足す（ぬか1カップに塩小さじ1〜大さじ½）', when: 'water', cost: 60, effects: { water: -0.45, salt: 0.3, rot: -0.1, maturity: -0.05 }, note: '水気を吸って床がしまる。足したぶん床は少し若くなる' }, // 【仮置き】
  // 傷みを防ぐ 【出典】捨て漬け野菜（キャベツの芯、にんじんの皮）を3〜4日ごとに替える
  { id: 'sute', name: '捨て漬けを替える（キャベツの芯・にんじんの皮）', when: 'rot', cost: 0, effects: { rot: -0.1 }, resetsSute: true, note: '3〜4日ごとに替えると床が傷みにくい' }, // 【仮置き】効き目
  // 旨味が足りないとき 【出典】昆布、赤唐辛子、煮干し、実山椒、ゆず
  { id: 'kombu', name: '昆布', when: 'umami', cost: 60, effects: { umami: 0.25 }, note: '旨味のもと' }, // 【仮置き】
  { id: 'akatogarashi', name: '赤唐辛子', when: 'umami', cost: 30, effects: { umami: 0.15, rot: -0.05 }, note: 'ぴりっとして、虫よけにも' }, // 【仮置き】
  { id: 'niboshi', name: '煮干し', when: 'umami', cost: 50, effects: { umami: 0.25 }, note: '魚の旨味' }, // 【仮置き】
  { id: 'sansho', name: '実山椒', when: 'umami', cost: 70, effects: { umami: 0.2 }, note: 'さわやかな香り' }, // 【仮置き】
  { id: 'yuzu', name: 'ゆずの皮', when: 'umami', cost: 80, effects: { umami: 0.15 }, note: '香りが立つ' }, // 【仮置き】
];

export const NUKA_WHEN = { sour: '酸っぱいとき', water: '水っぽいとき', rot: '傷みを防ぐ', umami: '旨味を足す' };
