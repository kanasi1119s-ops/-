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
      vegetables: ['hakusai', 'kyuri'],
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
      complexityMax: 100, // 【仮置き】
      price: 500, // 【仮置き】
      saltHint: '3%', // 【出典】
    },
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
      likes: 'asazuke',
      target: { acid: 15, salt: 30, texture: 80, complexity: 30 },
      weights: { acid: 1, salt: 1.5, texture: 1, complexity: 0.3 },
    },
    {
      id: 'salty', name: 'しょっぱめ好き', hint: '酒の肴に。よく漬かった白菜漬け',
      likes: 'hakusaizuke',
      target: { acid: 40, salt: 75, texture: 55, complexity: 50 },
      weights: { acid: 0.8, salt: 1.6, texture: 0.6, complexity: 0.6 },
    },
    {
      id: 'sour', name: '酸っぱい好き', hint: 'よく漬かって酸味の出たもの',
      likes: 'hakusaizuke',
      target: { acid: 70, salt: 45, texture: 45, complexity: 60 },
      weights: { acid: 1.8, salt: 0.8, texture: 0.5, complexity: 0.6 },
    },
    {
      id: 'crunchy', name: '食感重視', hint: 'シャキシャキが命',
      likes: 'asazuke',
      target: { acid: 12, salt: 40, texture: 95, complexity: 20 },
      weights: { acid: 0.7, salt: 0.8, texture: 2.0, complexity: 0.2 },
    },
    {
      id: 'gourmet', name: '通', hint: '風味の深さにうるさい',
      likes: 'hakusaizuke',
      target: { acid: 50, salt: 50, texture: 55, complexity: 90 },
      weights: { acid: 0.8, salt: 0.8, texture: 0.5, complexity: 2.0 },
    },
  ],
};
