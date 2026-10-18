// 漬物ゲーム 設定ファイル
// 係数・基準値はすべてここに集約する。遊びながら調整するときはこのファイルだけ触る。
// 【出典】= 企画書の根拠数値に基づく値 / 【仮置き】= 出典になく、妥当そうな値を置いた箇所。
// 仮置きの一覧は tsukemono/README.md にもまとめてある。

import { PICKLES, picklesFrom } from '../data/pickles.js';
import { FACILITIES, facilitiesFrom } from '../data/facilities.js';
import { LEVELS, LEVEL_AFTER_LAST } from '../data/levels.js';
import { VEGETABLES, vegetablesFrom } from '../data/vegetables.js';
import { WISDOM } from '../data/wisdom.js';
import { SPECIALS } from '../data/specials.js';
import { UPGRADES } from '../data/upgrades.js';
import { REGIONAL, regionalPickles } from '../data/regional.js';
import { PREFECTURE_PICKLES } from '../data/prefectures.js';

const FERMENT = {
  baseProgressPerDay: 1, // 【出典】塩3%・20℃の白菜漬けが約1週間で食べ頃（ripeAt=7と合わせて）
  // [温度℃, 係数]。間は線形補間、範囲外は端の値。 【出典: 企画書の初期値】
  tempCoef: [[4, 0.1], [10, 0.4], [20, 1.0], [25, 1.4], [40, 3.0]],
  // [塩分%, 係数]。 【出典: 企画書の初期値】
  saltCoef: [[2, 1.3], [3, 1.0], [5, 0.6], [10, 0.25], [20, 0.05]],
};
const FACILITY_CFG = facilitiesFrom(FACILITIES);
const VEG_CFG = vegetablesFrom(VEGETABLES);
// 全国の漬物（data/regional.js）は、資料の数値から食べ頃を計算して足す
export const REGIONAL_PICKLES = regionalPickles(REGIONAL, { ferment: FERMENT, vegetables: VEG_CFG.vegetables, dataset: PREFECTURE_PICKLES });
/** 漬物の定義すべて（data/pickles.js ＋ 全国の漬物） */
export const PICKLE_DEFS = [...PICKLES, ...REGIONAL_PICKLES];
const PICKLE_CFG = picklesFrom(PICKLE_DEFS);

export const CONFIG = {
  // ---------------------------------------------------------------
  // 発酵の進み（1日） = 基準の進み × 温度の係数 × 塩分の係数 × 野菜の係数
  // 進みは「標準日」で数える。白菜を塩3%・20℃で漬けると1日で1標準日進む。
  // ---------------------------------------------------------------
  ferment: FERMENT,

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
  // 野菜: data/vegetables.js の定義から作る（段階E。水分量・塩の入り方・食感の変わり方を野菜ごとに持つ）
  vegetables: VEG_CFG.vegetables,
  // 水分量の差: 水分が基準より多いほど塩味が薄まる（基準 0.93）【仮置き】
  water: { base: 0.93, saltDilution: 1.5 },
  // 干す（たくあんなど。段階E）: 干した日数だけ水分が抜け、食感・塩味が締まり、傷みにくくなる 【仮置き】
  drying: { waterLossPerDay: 0.03, crispPerDay: 0.03, crispMax: 1.3, spoilDropPerDay: 0.05, spoilMin: 0.5 },
  // 買えるもの: 特別な食材（data/specials.js）と店の格上げ（data/upgrades.js）
  specials: Object.fromEntries(SPECIALS.map(({ id, ...x }) => [id, x])),
  specialMax: 2, // 【仮置き】1つの樽に2つまで
  upgrades: Object.fromEntries(UPGRADES.map(({ id, ...x }) => [id, x])),
  wisdomTotal: WISDOM.length, // 知恵袋の知恵の数（段階G。中身は data/wisdom.js）
  // 燻す（いぶりがっこ。段階F）: 目安の日数まで燻すと風味の深さが最大 ×1.5、目安を過ぎると1日ごとに −12%（えぐい）【仮置き】
  smoking: { bonusMax: 0.5, overPenalty: 0.12 },
  // 加温室の温度を選べる幅（すぐき漬け。段階F）【仮置き】出典は「約40℃」
  // 重石（重石と工程）: 重さは野菜の重さの何倍か。ふつうの重石なら今までどおり（効き目なし）【仮置き】
  // 出典: 資料 p19-1「重石を倍量→半量に切り替える」、p20-1「重石の付け替えと水上がりの判断」。数値は仮置き
  weight: {
    levels: { light: { name: '軽い', w: 0.5 }, normal: { name: 'ふつう', w: 1 }, heavy: { name: '重い（倍）', w: 2 } },
    riseBase: 0.5, // 【仮置き】ふつうの重石・塩3%の白菜で、2日で水が上がる
    unUpSpoil: 3, // 【仮置き】水の上がっていない1日 = 傷みの3日ぶん（ふつうの重石との差で数える）
    crush: 0.06, // 【仮置き】水が上がったあと倍の重石のままだと、1日ごとに食感 −6%（白菜。大根はその1/4）
    lightBonus: 0.01, lightMax: 1.06, // 【仮置き】水が上がったあと軽くしておくと、1日ごとに食感 +1%（6%まで）
  },
  // 工程の早すぎ・遅すぎ（data/work.js の工程に共通）【仮置き】
  work: { early: { complexity: 0.9 }, late: { texture: 0.9 } },
  workGrace: 3, // 【仮置き】目安を過ぎても3日までは（遅れて）できる
  // 注文・依頼（data/orders.js）【仮置き】
  orders: { slack: 1.4, maxDays: 60, firstDay: 3, every: 3, max: 3, maxActive: 2, offerDays: 3, spoilMax: 30, bonusPerSat: 0.01, xp: 15, failRepMult: 2 },
  // 天日干し（天気と季節の仕込み）: 1日に乾く量（晴れ1）。冬の寒風はよく乾く。雨に当たると質が1日3%落ちる【仮置き】
  // 出典: 資料 p14-1「天日干しの天気に左右される」、p10-1・p32-1「からっ風・寒風の天日干し」。数値は仮置き
  sunDry: { weather: { sunny: 1, rain: 0, snow: 0.3 }, winter: 1.3, wetLoss: 0.03 },
  letterEvery: 5, // 【仮置き】地方の便りが届く間隔（日）
  kaonRange: [30, 55], // かぶらずしの糀は50℃前後（【出典】資料 p17-1）
  // 梅酢（梅干し。段階E）: 梅は梅酢に浸かっていればカビにくい。日がたつと梅が梅酢から出てくる 【仮置き】
  umezu: { exposePerDay: 0.08, safe: 0.3, moldInBrine: 0.2, moldExposed: 3 },


  // ---------------------------------------------------------------
  // 漬物は data/pickles.js の定義から作る（1件足すだけで増える）。相性（affinity）も定義の中に持つ。
  // ---------------------------------------------------------------
  pickles: PICKLE_CFG.pickles,

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
    shoga: { name: '生姜', cost: 50, complexity: 10, salt: 0, acid: 0, spoil: 0.9 }, // 【仮置き】さっぱり・日持ちを少し良く
    akajiso: { name: '赤しそ', cost: 70, complexity: 12, salt: 0, acid: 4, spoil: 0.9 }, // 【仮置き】香りと色
    karashi: { name: 'からし', cost: 40, complexity: 9, salt: 0, acid: 0, spoil: 0.85 }, // 【仮置き】ぬか床に入れると傷みにくい
    sakekasu: { name: '酒粕', cost: 90, complexity: 16, salt: -4, acid: -3, spoil: 1 }, // 【仮置き】まろやかでコクが出る（粕漬け）
  },
  additiveMax: 2,
  // 相性は data/pickles.js の各定義の affinity。good=効き目そのまま＋ほめられる、bad=風味が濁る（風味の深さ−badPenalty）、ふつう=効き目の半分
  affinity: PICKLE_CFG.affinity,
  affinityBadPenalty: 15, // 【仮置き】
  affinitySatBonus: 6, // 【仮置き】相性の良い調味1つにつき、どのお客の満足度も+6（悪いと−6）
  affinityNeutralFactor: 0.5, // 【仮置き】

  // ---------------------------------------------------------------
  // 経営（段階4）
  // ---------------------------------------------------------------
  // 旬: 【出典: 企画書】旬の野菜は安く品質が高い（白菜は冬、きゅうりは夏）。倍率は【仮置き】
  market: {
    priceBySeason: VEG_CFG.priceBySeason, // data/vegetables.js の seasons
    // 品質（食感の初期値に掛ける）＝ 2 − 価格の倍率 を、この範囲に収める 【仮置き】
    qualityRange: [0.85, 1.15],
    // 段階D: 毎日の相場。季節の倍率に、日ごとの揺れと特売をかける 【仮置き】
    dailyNoise: 0.15, // ±15%
    saleChance: 0.25, // 1日に1つの野菜が特売になる確率
    saleFactor: 0.6, // 特売は4割引き
  },
  // 仕入れた野菜の在庫（段階D）。置いておくと鮮度が落ち、やがて捨てることになる 【仮置き】
  stock: {
    freshDays: 2, // この日数までは採れたて
    decayPerDay: 0.05, // それを過ぎると、1日ごとに品質−5%
    spoilDays: 7, // この日数を過ぎた野菜は傷んで捨てる
  },
  // 店の維持費（毎朝払う）。光熱費・樽の手入れ・町内会費など 【仮置き】
  upkeep: { base: 150, perBarrel: 40 },
  // 客の年代と減塩の流れ（data/stories.js の AGES）【仮置き】
  trend: { saltPerYear: -2, saltMin: -8 }, // 1年ごとに、みんなの好む塩味が −2（減塩志向。−8まで）
  // 常連との絆と物語（data/stories.js）【仮置き】
  bond: { sat: 75, storyRep: 2, prefAfter: 3 }, // この満足度以上で絆+1、章が開くと評判+2、3回来ると好みを覚える
  // 行商人（作り方を売りに来る）【仮置き】
  peddler: { every: 7, onDay: 4, pricePerLevel: 2500 }, // 7日に1度（4日目・11日目…）来る。値段 = 2500 × 挑むレベル

  // 評判: 満足度で上下し、来店の多さに効く 【仮置き】
  reputation: {
    start: 50,
    perVisitor: 0.08, // 1人ごとに（満足度 − neutral）× この値
    neutral: 50,
    spoiledPenalty: 6, // 傷んだ樽を出すと
    visitMin: 0.6, visitMax: 1.4, // 評判0 → 来店率×0.6、評判100 → ×1.4
  },
  // 置き場所と道具: data/facilities.js の定義から作る（段階C）。【出典: 企画書】熟成は置き場所（冷蔵庫・土間・屋外）と日数で味が変わる
  places: FACILITY_CFG.places,
  facilities: FACILITY_CFG.facilities,
  // 難癖のお客（クレーマー）。台詞と対応は data/claimer.js、備えの設備は data/facilities.js 【仮置き】
  claimer: {
    chance: 0.1, // 店を開けた時間帯ごとに来る確率（図太さ・評判で増える）
    nerveVisit: 0.25, // 図太さ1ごとに来る確率×(1+0.25)
    repBoost: 0.5, // 評判100で×1.5（繁盛している店ほど目をつけられる）
    startNerve: 4, maxNerve: 6, // 図太さのはじめと上限（0まで下げると改心して常連になる）
    moodPenalty: 5, // 難癖を聞いたあとのお客の満足度が下がる（店の空気が悪くなる）
    banDays: 28, // 出入り禁止の日数（季節ひとつ）
    newAfterDays: 14, // 改心したあと、新しい難癖のお客が現れるまでの日数
  },
  // 店のレベルと、作り方の解放（段階C）。レベルの表は data/levels.js
  levels: LEVELS,
  levelAfterLast: LEVEL_AFTER_LAST,
  progress: {
    xpPerPiece: 1, // 【仮置き】1個売るごとの経験
    xpGreatSat: 70, // 【仮置き】この満足度以上で買われた分は
    xpGreatMult: 2, // 【仮置き】経験×2
    xpNewBook: 5, // 【仮置き】図鑑に新しい組み合わせが載ったとき
    xpInspire: 20, // 【仮置き】ひらめいたとき
    xpFirstSuccess: 30, // 【仮置き】作り方を初めて成功させたとき（図鑑が埋まる）
    successSat: 60, // 【仮置き】1つの樽で、買ったお客の誰か1人でもこの満足度以上なら「成功」（うまいと言わせた）
    masterAfter: 10, // 【仮置き】成功10樽で腕前が最大
    masterComplexity: 0.15, // 【仮置き】腕前が最大なら風味の深さ×1.15（作り方を磨くと品質が上がる）
    masterTexture: 0.05, // 【仮置き】腕前が最大なら食感×1.05（扱いが上手になる）
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
  // 樽: 店先に5つまで（max）。蔵（店の格上げ）を建てると、裏に backMax まで置ける（店先の絵には出ない）【仮置き】
  barrelsInvest: { start: 3, max: 5, backMax: 4, addCost: [2500, 4000, 8000, 10000, 12000, 15000] },
  // 棚: できた漬物を樽から移しておく所。棚では漬かりも傷みも熟成も slow 倍の速さ【仮置き】
  shelf: { base: 3, slow: 0.2 },

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
    sourAcidBoost: 40, // 【仮置き】床の酸味1でぬか漬けの酸味+40
    matureDays: 14, // 【仮置き】毎日かき混ぜて14日で熟成度が最大
    // 段階B: 水っぽさ・傷み・旨味。手入れの種類と効き目は data/nuka.js
    waterPerBatch: 0.08, // 【仮置き】ぬか漬けを標準の個数ぶん漬けるごとに、野菜から出る水で床が水っぽくなる（個数に比例）
    waterPerDay: 0.01, // 【仮置き】何もしなくても少しずつ水が出る
    waterSourBoost: 0.6, // 【仮置き】水っぽさ1で酸味の増え方×1.6（水分過多は酸っぱくなる原因）
    waterSaltLoss: 0.3, // 【仮置き】水っぽさ1でぬか漬けの塩味×0.7（薄まる）
    // 傷み: 膜が広がり、酸っぱくなり、捨て漬けを替えないと進む（膜→酸っぱい→傷む、の順に出る）
    rotFilmStart: 0.5, rotPerFilm: 0.35, // 【仮置き】膜が半分を超えると、超えたぶん×0.35/日
    rotSourStart: 0.6, rotPerSour: 0.35, // 【仮置き】酸味が0.6を超えると、超えたぶん×0.35/日
    suteEveryDays: 4, rotPerSuteDay: 0.02, // 【仮置き】捨て漬けを4日より長く替えないと、1日ごとに+0.02/日
    rotStirDrop: 0.05, // 【仮置き】かき混ぜると傷みが少し戻る（空気を入れて悪い菌をおさえる）
    rotSpoilBoost: 100, // 【仮置き】傷み1でぬか漬けの傷みリスク+100%
    rotComplexityLoss: 0.5, // 【仮置き】傷み1で風味の深さ×0.5
    umamiPerDay: 0.02, // 【仮置き】足した旨味は1日に0.02ずつ抜けていく
    umamiComplexityBoost: 0.3, // 【仮置き】旨味1でぬか漬けの風味の深さ×1.3
  },

  // ---------------------------------------------------------------
  // 客の満足度・売上
  // ---------------------------------------------------------------
  sales: {
    portionsPerBatch: 6, // 【仮置き】1樽の標準の個数（仕込みで個数を選ばなければこの数。費用はこの数ぶんの仕入れ値）
    barrelCapacity: 60, // 【仮置き】1樽に仕込める最大の個数（たくさん仕込んで長く売れる。売れ残ると酸っぱくなる）
    satScale: 1.7, // 【仮置き】好みとのズレ(重み付き平均)×この値を100から引く
    stageFactor: { raw: 1, ripe: 1, over: 0.92, sour: 0.7 }, // 【仮置き】過熟・酸っぱすぎは満足度に掛ける（rawは別途、未熟の式で下げる）
    likeBonus: 8, // 【仮置き】好きな種類の漬物なら満足度+8
    unripeMinFactor: 0.5, // 【仮置き】未熟だと満足度に 0.5〜1.0 を掛ける
    spoilSatPenalty: 0.8, // 【仮置き】傷みリスク100%で満足度×0.2（期待値）
    buyThreshold: 40, // 【仮置き】満足度がこれ未満なら買わない
    // 支払額 = 定価 × (priceMin + (priceMax - priceMin) × 満足度/100)
    priceMin: 0.6, priceMax: 1.3, // 【仮置き】
    saltCostPerPct: 10, // 【仮置き】塩代: 塩分1%あたり(円)
    startMoney: 10000, // 【仮置き】はじめから樽いっぱい（60個）仕込める額
    maxBuy: 4, // 【仮置き】1人が買う数の上限。満足度が buyThreshold から buyStep 上がるごとに1個ずつ増える
    buyStep: 15, // 【仮置き】
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
    // 時間制: 各時間帯が実時間で何秒つづくか（設定の速さで割る）。夜は短い 【仮置き】
    realSeconds: { morning: 90, noon: 90, evening: 90, night: 30 }, // ×1で1日 5分
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
    slots: 10, // 【仮置き】1つの時間帯に来るお客の上限（1日5分で、1時間帯に十人ほど）
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
