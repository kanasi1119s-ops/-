// 漬物の定義（段階A）。1件足すだけで、仕込みの窓・図鑑・お客の反応に新しい漬物が出る。
// 【出典】= 企画書の根拠数値に基づく値 / 【仮置き】= 出典になく、妥当そうな値を置いた箇所（node scripts/placeholders.js で一覧）。
//
// 項目:
//   id          : 見出し（英数字。セーブや図鑑のキーになるので、一度決めたら変えない）
//   name        : 表示名
//   vegetables  : 使える野菜（data/ ではなく src/config.js の vegetables の id）
//   steps       : 工程（仕込みの説明に出す。順番どおり）
//   saltHint    : 塩分の目安（表示用）。salt: { lo, hi } は目安の範囲（%）
//   tempHint    : 温度の目安（表示用）。temp: { lo, hi } は目安の範囲（℃）
//   ripeAt      : 食べ頃になる標準日数（塩3%・20℃の白菜で1日=1標準日）
//   window      : 進み/ripeAt の比。lo未満=まだ早い、lo〜hi=食べ頃、hi〜sour=過熟、sour超=酸っぱすぎ
//   complexityMax: 風味の複雑さの上限
//   price       : 1個の定価（円）
//   level       : 挑むのに必要な店のレベル（段階Cで使う。1 = はじめから）
//   unlock      : 解放の条件（段階Cで使う。null = 条件なし）
//   affinity    : 調味との相性（good / bad。書いてなければふつう）
//   そのほか    : portions（標準の個数）、usesNukaBed（ぬか床を使う）、saltUptake、acidHalfProgress、film（白い膜が出る）、top（樽の中身の絵）

export const PICKLES = [
  {
    id: 'asazuke',
    name: '浅漬け',
    vegetables: ['hakusai', 'kyuri', 'nasu', 'daikon', 'kabu', 'kyabetsu', 'ninjin'],
    steps: ['野菜を切る', '塩をまぶして重石をする', '冷暗所で半日〜1日'],
    saltHint: '2〜3%', // 【出典】
    salt: { lo: 2, hi: 3 }, // 【出典】
    tempHint: '5〜20℃', // 【仮置き】冷蔵〜室温の短期
    temp: { lo: 5, hi: 20 }, // 【仮置き】
    ripeAt: 1, // 【出典】半日でしんなり、数時間〜数日で完成（3%・20℃で1日を食べ頃の中心に）
    window: { lo: 0.5, hi: 3, sour: 5 }, // 【仮置き】日持ちは数日
    complexityMax: 35, // 【仮置き】浅漬けは風味が単純
    price: 250, // 【仮置き】1個(円)
    level: 1,
    unlock: null,
    affinity: { kombu: 'good', yuzu: 'good', zarame: 'bad', shoga: 'good', akajiso: 'good', sakekasu: 'bad' },
  },
  {
    id: 'hakusaizuke',
    name: '白菜漬け',
    vegetables: ['hakusai'],
    steps: ['白菜を割って干す', '塩をすり込んで重石をする', '水が上がったら重石を軽く', '約1週間'],
    saltHint: '3%', // 【出典】
    salt: { lo: 2.5, hi: 3.5 }, // 【仮置き】出典は3%のみ
    tempHint: '5〜20℃', // 【仮置き】
    temp: { lo: 5, hi: 20 }, // 【仮置き】
    ripeAt: 7, // 【出典】約1週間
    window: { lo: 0.85, hi: 1.3, sour: 1.8 }, // 【仮置き】6〜9日が食べ頃、約12.6日で酸っぱすぎ
    complexityMax: 85, // 【仮置き】調味（昆布など）でさらに深くなる余地を残す
    price: 500, // 【仮置き】
    film: true, // 白い膜が出る（浅漬けは冷蔵で短期なので対象外）
    level: 1,
    unlock: null,
    affinity: { kombu: 'good', togarashi: 'good', yuzu: 'good', shoga: 'good', sakekasu: 'bad' },
  },
  {
    id: 'nukazuke',
    name: 'ぬか漬け',
    vegetables: ['kyuri', 'hakusai', 'nasu', 'daikon', 'kabu', 'ninjin'],
    steps: ['野菜に塩をすり込む', 'ぬか床に埋める', '20〜25℃で一晩〜1日', '毎日かき混ぜる'],
    usesNukaBed: true, // 塩分はぬか床の塩分を使う（仕込みで塩分は選ばない）
    saltHint: 'ぬか床の塩分',
    salt: null,
    tempHint: '20〜25℃', // 【出典】ぬか床の適温
    temp: { lo: 20, hi: 25 }, // 【出典】
    ripeAt: 0.8, // 【仮置き】きゅうりを20〜25℃の床で一晩〜1日
    window: { lo: 0.5, hi: 2, sour: 3.5 }, // 【仮置き】
    saltUptake: 0.4, // 【仮置き】野菜が吸う塩はぬか床の塩分の一部だけ
    complexityMax: 80, // 【仮置き】床の熟成度で 40%〜100% になる
    price: 300, // 【仮置き】
    film: true,
    level: 1,
    unlock: null,
    affinity: { kombu: 'good', togarashi: 'good', zarame: 'bad', yuzu: 'bad', karashi: 'good', shoga: 'good', sakekasu: 'bad' },
  },
  {
    id: 'takuan',
    name: 'たくあん',
    vegetables: ['daikon'],
    steps: ['大根を干す', '米ぬか・塩・ざらめと漬ける', '重石をして数週間〜数か月'],
    saltHint: '4〜8%（長く置くなら多め）', // 【仮置き】出典は「干し日数と出荷時期で塩を変える」のみ
    salt: { lo: 4, hi: 8 }, // 【仮置き】
    tempHint: '寒い時期（5〜15℃）', // 【仮置き】冬の仕込み
    temp: { lo: 5, hi: 15 }, // 【仮置き】
    ripeAt: 20, // 【仮置き】出典は「約1か月以上」。大根は漬かりが遅い（×0.8）ので、塩5%・室22℃で約36日
    window: { lo: 0.9, hi: 4, sour: 6 }, // 【仮置き】長く置ける
    acidHalfProgress: 20, // 【仮置き】長く漬けても酸っぱくなりにくい（食べ頃で酸味50）
    complexityMax: 80, // 【仮置き】ざらめ・唐辛子・昆布で深まる
    price: 900, // 【仮置き】長く寝かせるぶん高い
    portions: 18, // 【仮置き】大きな樽で一度にたくさん漬ける（ふつうは6個）
    film: true,
    top: 'takuan', // 樽の中身の絵（黄色）
    level: 1,
    unlock: null,
    affinity: { zarame: 'good', togarashi: 'good', kombu: 'good', yuzu: 'bad', sakekasu: 'good', akajiso: 'bad' },
  },
  {
    id: 'nozawanazuke',
    name: '野沢菜漬',
    vegetables: ['nozawana'],
    steps: ['野沢菜を洗う', '塩と唐辛子で漬ける', '重石をして寒い所で2〜3週間'],
    saltHint: '2.5〜3%', // 【出典】野菜40kgに塩1〜1.3kg
    salt: { lo: 2.5, hi: 3 }, // 【出典】
    tempHint: '寒い所（0〜10℃）', // 【仮置き】出典は「寒い時期」
    temp: { lo: 0, hi: 10 }, // 【仮置き】
    ripeAt: 3, // 【仮置き】出典は「2〜3週間で食べられる」（寒い時期）。冬の屋外（8℃）で約10日、土間（3℃）で約1か月
    window: { lo: 0.8, hi: 2, sour: 3 }, // 【仮置き】
    complexityMax: 70, // 【仮置き】
    price: 450, // 【仮置き】
    film: true,
    level: 1,
    unlock: null,
    affinity: { togarashi: 'good', kombu: 'good', zarame: 'bad', shoga: 'good', sakekasu: 'bad' },
  },
];

/** 定義の一覧から、設定（CONFIG.pickles と CONFIG.affinity）の形を作る。id がかぶったり、必須の項目が抜けていればエラー。 */
export function picklesFrom(defs) {
  const pickles = {}, affinity = {};
  for (const d of defs) {
    for (const k of ['id', 'name', 'vegetables', 'ripeAt', 'window', 'complexityMax', 'price']) {
      if (d[k] == null) throw new Error(`漬物の定義 ${d.id ?? '?'}: ${k} がない`);
    }
    if (pickles[d.id]) throw new Error(`漬物の定義 ${d.id}: id がかぶっている`);
    const { id, affinity: aff = {}, ...rest } = d;
    pickles[id] = { level: 1, unlock: null, steps: [], ...rest };
    affinity[id] = { ...aff };
  }
  return { pickles, affinity };
}
