// 漬物ゲーム 設定ファイル
// 係数・基準値はすべてここに集約する。遊びながら調整するときはこのファイルだけ触る。
// 【出典】= 企画書の根拠数値に基づく値 / 【仮置き】= 出典になく、妥当そうな値を置いた箇所。
// 仮置きの一覧は tsukemono/README.md にもまとめてある。

export const CONFIG = {
  // ---------------------------------------------------------------
  // 発酵の進み（1日） = 基準の進み × 温度の係数 × 塩分の係数 × 野菜の係数
  // 進みは「標準日」で数える。白菜を塩3%・20℃で漬けると1日で1標準日進む。
  // ---------------------------------------------------------------
  ferment: {
    baseProgressPerDay: 1, // 【出典】塩3%・20℃の白菜漬けが約1週間で食べ頃（ripeAt=7と合わせて）
    // [温度℃, 係数]。間は線形補間、範囲外は端の値。 【出典: 企画書の初期値】
    tempCoef: [[4, 0.1], [10, 0.4], [20, 1.0], [25, 1.4], [40, 3.0]],
    // [塩分%, 係数]。 【出典: 企画書の初期値】
    saltCoef: [[2, 1.3], [3, 1.0], [5, 0.6], [10, 0.25], [20, 0.05]],
  },

  // ---------------------------------------------------------------
  // 味の各指標（0〜100の目安）
  // ---------------------------------------------------------------
  taste: {
    // 酸味 = 100 * p / (p + halfProgress)。 p=7で50、p=14で約67、p=28で80。
    acidHalfProgress: 7, // 【仮置き】
    // 塩味: 野菜に塩が回る速さ（日）と、塩味100とみなす塩分%
    saltAbsorbTauDays: 0.5, // 【仮置き】1日でほぼ（86%）回る
    saltFullPct: 6, // 【仮置き】回りきった塩分6%で塩味100（3%なら50）
    // 風味の複雑さ: 18〜22℃で最大、そこから離れるほど下がる。高温側ほど急に下がる。
    complexityBestTemp: [18, 22], // 【出典】ザワークラウト18〜22℃が最良
    complexityLowSlope: 0.02, // 【仮置き】18℃から1℃下がるごとに-2%
    complexityHighSlope: 0.04, // 【仮置き】22℃から1℃上がるごとに-4%（高温の急速発酵は単調）
    complexityMinFactor: 0.15, // 【仮置き】下限
  },

  // ---------------------------------------------------------------
  // 傷みのリスク: 1日あたりの危険度 = base × 塩分表 × 温度表 × 野菜 、リスク = 1 - exp(-危険度×日数)
  // 塩分が低く、温度が高いほど上がる。放置するほど積み上がる。
  // ---------------------------------------------------------------
  spoil: {
    basePerDay: 0.01, // 【仮置き】3%・20℃で7日 → 約7%
    saltTable: [[1, 8], [2, 3], [3, 1], [5, 0.3], [10, 0.05], [20, 0]], // 【仮置き】
    tempTable: [[4, 0.1], [10, 0.3], [20, 1], [25, 2.5], [30, 5], [40, 10]], // 【仮置き】
  },

  // 食感: 100 * veg.crisp0 * exp(-p / veg.crispTau)、傷みが高いと下がる
  texture: {
    spoilPenalty: 0.5, // 【仮置き】傷み100%で食感が半分に
  },

  // ---------------------------------------------------------------
  // 野菜（最小版は2種）
  // ---------------------------------------------------------------
  vegetables: {
    hakusai: {
      name: '白菜',
      fermentRate: 1.0, // 【出典】基準
      crisp0: 80, crispTau: 20, // 【仮置き】
      spoilMult: 1.0, // 【仮置き】
      cost: 500, // 【仮置き】1樽分の仕入れ値(円)
    },
    kyuri: {
      name: 'きゅうり',
      fermentRate: 1.1, // 【仮置き】
      crisp0: 95, crispTau: 8, // 【仮置き】シャキシャキだが早く柔らかくなる
      spoilMult: 1.3, // 【仮置き】
      cost: 300, // 【仮置き】
    },
    // 段階5で追加
    daikon: {
      name: '大根',
      fermentRate: 0.8, // 【仮置き】かたく、ゆっくり漬かる
      crisp0: 90, crispTau: 80, // 【仮置き】長く漬けてもポリポリ（たくあん）
      spoilMult: 0.8, // 【仮置き】
      cost: 400, // 【仮置き】
    },
    nozawana: {
      name: '野沢菜',
      fermentRate: 1.0, // 【仮置き】
      crisp0: 85, crispTau: 15, // 【仮置き】
      spoilMult: 1.0, // 【仮置き】
      cost: 450, // 【仮置き】
    },
    nasu: {
      name: 'なす',
      fermentRate: 1.1, // 【仮置き】
      crisp0: 70, crispTau: 10, // 【仮置き】やわらかめ
      spoilMult: 1.2, // 【仮置き】
      cost: 350, // 【仮置き】
    },
  },

  // ---------------------------------------------------------------
  // 漬物（最小版は2種）
  //  ripeAt     : 食べ頃になる標準日数
  //  window     : 進み/ripeAt の比。lo未満=まだ早い、lo〜hi=食べ頃、hi〜sour=過熟、sour超=酸っぱすぎ
  //  complexityMax: 風味の複雑さの上限
  // ---------------------------------------------------------------
  pickles: {
    asazuke: {
      name: '浅漬け',
      vegetables: ['hakusai', 'kyuri', 'nasu', 'daikon'],
      ripeAt: 1, // 【出典】半日でしんなり、数時間〜数日で完成（3%・20℃で1日を食べ頃の中心に）
      window: { lo: 0.5, hi: 3, sour: 5 }, // 【仮置き】日持ちは数日
      complexityMax: 35, // 【仮置き】浅漬けは風味が単純
      price: 250, // 【仮置き】1個(円)
      saltHint: '2〜3%', // 【出典】
    },
    hakusaizuke: {
      name: '白菜漬け',
      vegetables: ['hakusai'],
      ripeAt: 7, // 【出典】約1週間
      window: { lo: 0.85, hi: 1.3, sour: 1.8 }, // 【仮置き】6〜9日が食べ頃、約12.6日で酸っぱすぎ
      complexityMax: 85, // 【仮置き】調味（昆布など）でさらに深くなる余地を残す
      price: 500, // 【仮置き】
      saltHint: '3%', // 【出典】
      film: true, // 白い膜が出る（浅漬けは冷蔵で短期なので対象外）
    },
    nukazuke: {
      name: 'ぬか漬け',
      vegetables: ['kyuri', 'hakusai', 'nasu', 'daikon'],
      usesNukaBed: true, // 塩分はぬか床の塩分を使う（仕込みで塩分は選ばない）
      ripeAt: 0.8, // 【仮置き】きゅうりを20〜25℃の床で一晩〜1日
      window: { lo: 0.5, hi: 2, sour: 3.5 }, // 【仮置き】
      saltUptake: 0.4, // 【仮置き】野菜が吸う塩はぬか床の塩分の一部だけ
      complexityMax: 80, // 【仮置き】床の熟成度で 40%〜100% になる
      price: 300, // 【仮置き】
      saltHint: 'ぬか床の塩分',
      film: true,
    },
    // 段階5で追加
    takuan: {
      name: 'たくあん',
      vegetables: ['daikon'],
      ripeAt: 20, // 【仮置き】出典は「約1か月以上」。大根は漬かりが遅い（×0.8）ので、塩5%・室22℃で約36日
      window: { lo: 0.9, hi: 4, sour: 6 }, // 【仮置き】長く置ける
      acidHalfProgress: 20, // 【仮置き】長く漬けても酸っぱくなりにくい（食べ頃で酸味50）
      complexityMax: 80, // 【仮置き】ざらめ・唐辛子・昆布で深まる
      price: 900, // 【仮置き】長く寝かせるぶん高い
      portions: 18, // 【仮置き】大きな樽で一度にたくさん漬ける（ふつうは6個）
      saltHint: '4〜8%（長く置くなら多め）', // 【仮置き】出典は「干し日数と出荷時期で塩を変える」のみ
      film: true,
      top: 'takuan', // 樽の中身の絵（黄色）
    },
    nozawanazuke: {
      name: '野沢菜漬',
      vegetables: ['nozawana'],
      ripeAt: 3, // 【仮置き】出典は「2〜3週間で食べられる」（寒い時期）。冬の屋外（8℃）で約10日、土間（3℃）で約1か月
      window: { lo: 0.8, hi: 2, sour: 3 }, // 【仮置き】
      complexityMax: 70, // 【仮置き】
      price: 450, // 【仮置き】
      saltHint: '2.5〜3%', // 【出典】野菜40kgに塩1〜1.3kg
      film: true,
    },
  },

  // ---------------------------------------------------------------
  // 調味（段階5）。仕込みで2つまで足せる。漬物との相性（good/bad、書いてなければふつう）で効き方が変わる。
  //  complexity: 相性が良いとき足す風味の深さ / salt: 塩味の増減 / acid: 酸味の増減 / spoil: 傷みやすさの倍率
  //  出典: たくあん＝塩・ぬか・ざらめ・唐辛子・昆布、ぬか床の旨味＝昆布・赤唐辛子・ゆず など。効き目の数値は【仮置き】
  // ---------------------------------------------------------------
  additives: {
    kombu: { name: '昆布', cost: 60, complexity: 14, salt: 0, acid: 0, spoil: 1 },
    togarashi: { name: '唐辛子', cost: 30, complexity: 8, salt: 0, acid: 0, spoil: 0.85 },
    zarame: { name: 'ざらめ', cost: 40, complexity: 10, salt: -10, acid: -5, spoil: 1 },
    yuzu: { name: 'ゆず', cost: 80, complexity: 10, salt: 0, acid: 6, spoil: 1 },
  },
  additiveMax: 2,
  // 相性。good=効き目そのまま＋ほめられる、bad=風味が濁る（風味の深さ−badPenalty）、ふつう=効き目の半分
  affinity: {
    asazuke: { kombu: 'good', yuzu: 'good', zarame: 'bad' },
    hakusaizuke: { kombu: 'good', togarashi: 'good', yuzu: 'good' },
    nukazuke: { kombu: 'good', togarashi: 'good', zarame: 'bad', yuzu: 'bad' },
    takuan: { zarame: 'good', togarashi: 'good', kombu: 'good', yuzu: 'bad' },
    nozawanazuke: { togarashi: 'good', kombu: 'good', zarame: 'bad' },
  },
  affinityBadPenalty: 15, // 【仮置き】
  affinitySatBonus: 6, // 【仮置き】相性の良い調味1つにつき、どのお客の満足度も+6（悪いと−6）
  affinityNeutralFactor: 0.5, // 【仮置き】

  // ---------------------------------------------------------------
  // 経営（段階4）
  // ---------------------------------------------------------------
  // 旬: 【出典: 企画書】旬の野菜は安く品質が高い（白菜は冬、きゅうりは夏）。倍率は【仮置き】
  market: {
    priceBySeason: {
      hakusai: { spring: 1.1, summer: 1.3, autumn: 0.9, winter: 0.7 },
      kyuri: { spring: 1.0, summer: 0.7, autumn: 1.1, winter: 1.4 },
      daikon: { spring: 1.1, summer: 1.4, autumn: 0.9, winter: 0.7 }, // 冬が旬（たくあんの仕込み時期）
      nozawana: { spring: 1.2, summer: 1.5, autumn: 0.9, winter: 0.7 }, // 晩秋〜冬
      nasu: { spring: 1.2, summer: 0.7, autumn: 0.9, winter: 1.5 }, // 夏〜秋
    },
    // 品質（食感の初期値に掛ける）＝ 2 − 価格の倍率 を、この範囲に収める 【仮置き】
    qualityRange: [0.85, 1.15],
  },
  // 評判: 満足度で上下し、来店の多さに効く 【仮置き】
  reputation: {
    start: 50,
    perVisitor: 0.08, // 1人ごとに（満足度 − neutral）× この値
    neutral: 50,
    spoiledPenalty: 6, // 傷んだ樽を出すと
    visitMin: 0.6, visitMax: 1.4, // 評判0 → 来店率×0.6、評判100 → ×1.4
  },
  // 置き場所: 【出典: 企画書】熟成は置き場所（冷蔵庫・土間・屋外）と日数で味が変わる。温度・値段は【仮置き】
  places: {
    outdoor: { name: '屋外', offset: 3, cost: 0 }, // 外気温 + 3℃（日なた）
    doma: { name: '土間', offset: -2, cost: 0 }, // 外気温 − 2℃
    fridge: { name: '冷蔵庫', fixed: 4, cost: 3000 },
    muro: { name: '室（むろ）', fixed: 22, cost: 4000 }, // 発酵の最良18〜22℃（出典: ザワークラウト）を保つ部屋
  },
  // 樽を増やす投資 【仮置き】
  // 常連客: とても満足した客がときどき常連になり、決まった見た目でまた来る 【仮置き】
  regulars: {
    max: 6, // 常連の最大人数
    joinSat: 80, // この満足度以上で買った客が常連になりうる
    joinChance: 0.3, // そのときに常連になる確率
    visit: 0.45, // 常連1人が店を開けたときに来る確率（天気・時間の倍率をかける）
    tip: 0.1, // 常連は1割多く払う
    leaveSat: 50, // これ未満の満足度が続くと離れる
    leaveAfter: 2, // 何回続けて不満なら離れるか
  },
  barrelsInvest: { start: 3, max: 5, addCost: [2500, 4000] },

  // ---------------------------------------------------------------
  // 手入れと失敗（段階3）
  // ---------------------------------------------------------------
  care: {
    // 白い膜（産膜酵母）: 1日に増える量。1 = 表面一面。 【出典】4℃では35日まで出ず、10〜25℃で早く出る（キムチの研究）
    filmPerDay: [[4, 0.008], [10, 0.05], [20, 0.08], [25, 0.12], [30, 0.15], [40, 0.18]], // 量は【仮置き】
    filmVisible: 0.3, // 【仮置き】これ以上で「白い膜」が見える（4℃では約37日）
    filmHarmless: 0.15, // 【仮置き】これ未満は味に響かない
    filmSatPenalty: 0.5, // 【仮置き】膜が一面に張ると満足度×0.5
    filmComplexityPenalty: 0.4, // 【仮置き】膜が一面に張ると風味の深さ×0.6
  },
  // ぬか床（店にひとつ）。 【出典】適温20〜25℃、26℃以上で酸味のもとの乳酸が出やすい。
  // 酸っぱくなる原因は高温・かき混ぜ不足・塩分不足・水分過多。塩を足してかき混ぜると回復する。
  nuka: {
    startSalt: 7, // 【仮置き】ぬか床の塩分%
    minSalt: 4, maxSalt: 12, // 【仮置き】
    saltLossPerBatch: 0.3, // 【仮置き】ぬか漬けを1樽漬けるごとに床の塩分が減る
    sourPerDay: [[4, 0.02], [10, 0.06], [20, 0.1], [25, 0.12], [26, 0.2], [30, 0.3], [40, 0.4]], // 【仮置き】かき混ぜないと1日に増える酸味（26℃以上で急に増える）
    lowSaltSourBoost: 0.05, // 【仮置き】塩分が1%下がるごとに酸味の増え方+5%
    stirSourDrop: 0.35, // 【仮置き】かき混ぜると酸味がこれだけ下がる
    addSaltPct: 1, addSaltCost: 10, addSaltSourDrop: 0.25, // 【仮置き】塩を足す（出典: 塩を足すと酸味が和らぐ）
    sourAcidBoost: 40, // 【仮置き】床の酸味1でぬか漬けの酸味+40
    matureDays: 14, // 【仮置き】毎日かき混ぜて14日で熟成度が最大
  },

  // ---------------------------------------------------------------
  // 客の満足度・売上
  // ---------------------------------------------------------------
  sales: {
    portionsPerBatch: 6, // 【仮置き】1樽で売れる個数
    satScale: 1.7, // 【仮置き】好みとのズレ(重み付き平均)×この値を100から引く
    stageFactor: { raw: 1, ripe: 1, over: 0.92, sour: 0.7 }, // 【仮置き】過熟・酸っぱすぎは満足度に掛ける（rawは別途、未熟の式で下げる）
    likeBonus: 8, // 【仮置き】好きな種類の漬物なら満足度+8
    unripeMinFactor: 0.5, // 【仮置き】未熟だと満足度に 0.5〜1.0 を掛ける
    spoilSatPenalty: 0.8, // 【仮置き】傷みリスク100%で満足度×0.2（期待値）
    buyThreshold: 40, // 【仮置き】満足度がこれ未満なら買わない
    // 支払額 = 定価 × (priceMin + (priceMax - priceMin) × 満足度/100)
    priceMin: 0.6, priceMax: 1.3, // 【仮置き】
    saltCostPerPct: 10, // 【仮置き】塩代: 塩分1%あたり(円)
    startMoney: 2000, // 【仮置き】
  },

  // ---------------------------------------------------------------
  // 季節・天気・時間
  // ---------------------------------------------------------------
  calendar: {
    ticksPerDay: 4, // 【仮置き】1日=4区切り（朝・昼・夕・夜）
    daysPerSeason: 28, // 【仮置き】
    seasons: ['spring', 'summer', 'autumn', 'winter'],
    times: ['morning', 'noon', 'evening', 'night'],
    weathers: ['sunny', 'rain', 'snow'],
    // 時間帯の意味づけ（仮置き）: 朝=仕込み / 昼=熟成（日を進める） / 夕=販売 / 夜=締め
    // 実際には、どの時間帯でも仕込み・販売はできる（夜は閉店）。
    storeOpen: { morning: true, noon: true, evening: true, night: false },
  },
  season: {
    spring: { name: '春', ambientTemp: 15, prefShift: {} },
    summer: { name: '夏', ambientTemp: 28, prefShift: { salt: -12, acid: -5 } }, // 夏はあっさり
    autumn: { name: '秋', ambientTemp: 15, prefShift: {} },
    winter: { name: '冬', ambientTemp: 5, prefShift: { salt: +12 } }, // 冬はしょっぱめ
    // 外気温は【出典: 指示書の仮置き例】、prefShiftは【仮置き】
  },
  weatherName: { sunny: '晴れ', rain: '雨', snow: '雪' },
  timeName: { morning: '朝', noon: '昼', evening: '夕', night: '夜' },
  // 季節ごとの天気の出やすさ（重み） 【仮置き】
  weatherWeights: {
    spring: { sunny: 6, rain: 4, snow: 0 },
    summer: { sunny: 6, rain: 4, snow: 0 },
    autumn: { sunny: 7, rain: 3, snow: 0 },
    winter: { sunny: 5, rain: 1, snow: 4 },
  },
  // 来店: 最大 slots 人まで、1人ずつ「来店率 = base × 天気 × 時間帯」で来るか決める 【仮置き】
  visit: {
    slots: 5,
    base: 0.8,
    weather: { sunny: 1.0, rain: 0.5, snow: 0.4 },
    time: { morning: 0.7, noon: 1.0, evening: 1.0, night: 0 },
  },

  // ---------------------------------------------------------------
  // 客の好みのタイプ（5つ）。客は名前なしでランダムに来て、来るたびにどれかのタイプになる。
  // target は 0〜100 の理想の味。weights は重視度。 【仮置き】
  // ---------------------------------------------------------------
  customers: [
    {
      id: 'light', name: 'あっさり好き', hint: '浅漬けが好き',
      likes: ['asazuke'],
      target: { acid: 15, salt: 30, texture: 80, complexity: 30 },
      weights: { acid: 1, salt: 1.5, texture: 1, complexity: 0.3 },
    },
    {
      id: 'salty', name: 'しょっぱめ好き', hint: '酒の肴に。よく漬かった白菜漬けやたくあん',
      likes: ['hakusaizuke', 'takuan'],
      target: { acid: 40, salt: 75, texture: 55, complexity: 50 },
      weights: { acid: 0.8, salt: 1.6, texture: 0.6, complexity: 0.6 },
    },
    {
      id: 'sour', name: '酸っぱい好き', hint: 'よく漬かって酸味の出たもの（ぬか漬けも）',
      likes: ['hakusaizuke', 'nukazuke'],
      target: { acid: 70, salt: 45, texture: 45, complexity: 60 },
      weights: { acid: 1.8, salt: 0.8, texture: 0.5, complexity: 0.6 },
    },
    {
      id: 'crunchy', name: '食感重視', hint: 'シャキシャキ・ポリポリが命',
      likes: ['asazuke', 'takuan', 'nozawanazuke'],
      target: { acid: 12, salt: 40, texture: 95, complexity: 20 },
      weights: { acid: 0.7, salt: 0.8, texture: 2.0, complexity: 0.2 },
    },
    {
      id: 'gourmet', name: '通', hint: '風味の深さにうるさい。調味の相性も見抜く',
      likes: ['hakusaizuke', 'takuan'],
      target: { acid: 50, salt: 50, texture: 55, complexity: 90 },
      weights: { acid: 0.8, salt: 0.8, texture: 0.5, complexity: 2.0 },
    },
  ],
};
