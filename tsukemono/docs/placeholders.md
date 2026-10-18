# 仮置きの一覧

`src/config.js` で【仮置き】とコメントした値（出典がなく、遊びの釣り合いで決めたもの）。`node scripts/placeholders.js` で作り直せる。

| 行 | 項目 | 値 | 理由・メモ |
| --- | --- | --- | --- |
| 3 | — | `` | 【出典】= 企画書の根拠数値に基づく値 / = 出典になく、妥当そうな値を置いた箇所。 |
| 24 | taste.acidHalfProgress | `7` |  |
| 26 | taste.saltAbsorbTauDays | `0.5` | 1日でほぼ（86%）回る |
| 27 | taste.saltFullPct | `6` | 回りきった塩分6%で塩味100（3%なら50） |
| 30 | taste.complexityLowSlope | `0.02` | 18℃から1℃下がるごとに-2% |
| 31 | taste.complexityHighSlope | `0.04` | 22℃から1℃上がるごとに-4%（高温の急速発酵は単調） |
| 32 | taste.complexityMinFactor | `0.15` | 下限 |
| 40 | spoil.basePerDay | `0.01` | 3%・20℃で7日 → 約7% |
| 41 | spoil.saltTable | `[[1, 8], [2, 3], [3, 1], [5, 0.3], [10, 0.05], [20, 0]]` |  |
| 42 | spoil.tempTable | `[[4, 0.1], [10, 0.3], [20, 1], [25, 2.5], [30, 5], [40, 10]]` |  |
| 47 | texture.spoilPenalty | `0.5` | 傷み100%で食感が半分に |
| 57 | vegetables.hakusai.crisp0 | `80, crispTau: 20` |  |
| 58 | vegetables.hakusai.spoilMult | `1.0` |  |
| 59 | vegetables.hakusai.cost | `500` | 1樽分の仕入れ値(円) |
| 63 | vegetables.kyuri.fermentRate | `1.1` |  |
| 64 | vegetables.kyuri.crisp0 | `95, crispTau: 8` | シャキシャキだが早く柔らかくなる |
| 65 | vegetables.kyuri.spoilMult | `1.3` |  |
| 66 | vegetables.kyuri.cost | `300` |  |
| 71 | vegetables.daikon.fermentRate | `0.8` | かたく、ゆっくり漬かる |
| 72 | vegetables.daikon.crisp0 | `90, crispTau: 80` | 長く漬けてもポリポリ（たくあん） |
| 73 | vegetables.daikon.spoilMult | `0.8` |  |
| 74 | vegetables.daikon.cost | `400` |  |
| 78 | vegetables.nozawana.fermentRate | `1.0` |  |
| 79 | vegetables.nozawana.crisp0 | `85, crispTau: 15` |  |
| 80 | vegetables.nozawana.spoilMult | `1.0` |  |
| 81 | vegetables.nozawana.cost | `450` |  |
| 85 | vegetables.nasu.fermentRate | `1.1` |  |
| 86 | vegetables.nasu.crisp0 | `70, crispTau: 10` | やわらかめ |
| 87 | vegetables.nasu.spoilMult | `1.2` |  |
| 88 | vegetables.nasu.cost | `350` |  |
| 92 | vegetables.kabu.fermentRate | `1.1` | やわらかく、早く漬かる |
| 93 | vegetables.kabu.crisp0 | `85, crispTau: 12` |  |
| 94 | vegetables.kabu.spoilMult | `1.1` |  |
| 95 | vegetables.kabu.cost | `300` |  |
| 99 | vegetables.ninjin.fermentRate | `0.8` | かたく、ゆっくり漬かる |
| 100 | vegetables.ninjin.crisp0 | `90, crispTau: 40` | 長くポリポリ |
| 101 | vegetables.ninjin.spoilMult | `0.9` |  |
| 102 | vegetables.ninjin.cost | `250` |  |
| 106 | vegetables.kyabetsu.fermentRate | `1.1` |  |
| 107 | vegetables.kyabetsu.crisp0 | `80, crispTau: 12` |  |
| 108 | vegetables.kyabetsu.spoilMult | `1.1` |  |
| 109 | vegetables.kyabetsu.cost | `300` |  |
| 124 | pickles.asazuke.window | `{ lo: 0.5, hi: 3, sour: 5 }` | 日持ちは数日 |
| 125 | pickles.asazuke.complexityMax | `35` | 浅漬けは風味が単純 |
| 126 | pickles.asazuke.price | `250` | 1個(円) |
| 133 | pickles.hakusaizuke.window | `{ lo: 0.85, hi: 1.3, sour: 1.8 }` | 6〜9日が食べ頃、約12.6日で酸っぱすぎ |
| 134 | pickles.hakusaizuke.complexityMax | `85` | 調味（昆布など）でさらに深くなる余地を残す |
| 135 | pickles.hakusaizuke.price | `500` |  |
| 143 | pickles.nukazuke.ripeAt | `0.8` | きゅうりを20〜25℃の床で一晩〜1日 |
| 144 | pickles.nukazuke.window | `{ lo: 0.5, hi: 2, sour: 3.5 }` |  |
| 145 | pickles.nukazuke.saltUptake | `0.4` | 野菜が吸う塩はぬか床の塩分の一部だけ |
| 146 | pickles.nukazuke.complexityMax | `80` | 床の熟成度で 40%〜100% になる |
| 147 | pickles.nukazuke.price | `300` |  |
| 155 | pickles.takuan.ripeAt | `20` | 出典は「約1か月以上」。大根は漬かりが遅い（×0.8）ので、塩5%・室22℃で約36日 |
| 156 | pickles.takuan.window | `{ lo: 0.9, hi: 4, sour: 6 }` | 長く置ける |
| 157 | pickles.takuan.acidHalfProgress | `20` | 長く漬けても酸っぱくなりにくい（食べ頃で酸味50） |
| 158 | pickles.takuan.complexityMax | `80` | ざらめ・唐辛子・昆布で深まる |
| 159 | pickles.takuan.price | `900` | 長く寝かせるぶん高い |
| 160 | pickles.takuan.portions | `18` | 大きな樽で一度にたくさん漬ける（ふつうは6個） |
| 161 | pickles.takuan.saltHint | `'4〜8%（長く置くなら多め）'` | 出典は「干し日数と出荷時期で塩を変える」のみ |
| 168 | pickles.nozawanazuke.ripeAt | `3` | 出典は「2〜3週間で食べられる」（寒い時期）。冬の屋外（8℃）で約10日、土間（3℃）で約1か月 |
| 169 | pickles.nozawanazuke.window | `{ lo: 0.8, hi: 2, sour: 3 }` |  |
| 170 | pickles.nozawanazuke.complexityMax | `70` |  |
| 171 | pickles.nozawanazuke.price | `450` |  |
| 180 | — | `` | 出典: たくあん＝塩・ぬか・ざらめ・唐辛子・昆布、ぬか床の旨味＝昆布・赤唐辛子・ゆず など。効き目の数値は |
| 187 | additives.shoga | `{ name: '生姜', cost: 50, complexity: 10, salt: 0, acid: 0, spoil: 0.9 }` | さっぱり・日持ちを少し良く |
| 188 | additives.akajiso | `{ name: '赤しそ', cost: 70, complexity: 12, salt: 0, acid: 4, spoil: 0…` | 香りと色 |
| 189 | additives.karashi | `{ name: 'からし', cost: 40, complexity: 9, salt: 0, acid: 0, spoil: 0.…` | ぬか床に入れると傷みにくい |
| 190 | additives.sakekasu | `{ name: '酒粕', cost: 90, complexity: 16, salt: -4, acid: -3, spoil: 1 }` | まろやかでコクが出る（粕漬け） |
| 201 | affinityBadPenalty | `15` |  |
| 202 | affinitySatBonus | `6` | 相性の良い調味1つにつき、どのお客の満足度も+6（悪いと−6） |
| 203 | affinityNeutralFactor | `0.5` |  |
| 208 | — | `` | 旬: 【出典: 企画書】旬の野菜は安く品質が高い（白菜は冬、きゅうりは夏）。倍率は |
| 220 | market | `` | 品質（食感の初期値に掛ける）＝ 2 − 価格の倍率 を、この範囲に収める |
| 223 | — | `` | 評判: 満足度で上下し、来店の多さに効く |
| 231 | — | `` | 置き場所: 【出典: 企画書】熟成は置き場所（冷蔵庫・土間・屋外）と日数で味が変わる。温度・値段は |
| 238 | — | `` | 樽を増やす投資 |
| 239 | — | `` | 常連客: とても満足した客がときどき常連になり、決まった見た目でまた来る |
| 256 | care.filmPerDay | `[[4, 0.008], [10, 0.05], [20, 0.08], [25, 0.12], [30, 0.15], [40, 0…` | 量は |
| 257 | care.filmVisible | `0.3` | これ以上で「白い膜」が見える（4℃では約37日） |
| 258 | care.filmHarmless | `0.15` | これ未満は味に響かない |
| 259 | care.filmSatPenalty | `0.5` | 膜が一面に張ると満足度×0.5 |
| 260 | care.filmComplexityPenalty | `0.4` | 膜が一面に張ると風味の深さ×0.6 |
| 265 | nuka.startSalt | `7` | ぬか床の塩分% |
| 266 | nuka.minSalt | `4, maxSalt: 12` |  |
| 267 | nuka.saltLossPerBatch | `0.3` | ぬか漬けを1樽漬けるごとに床の塩分が減る |
| 268 | nuka.sourPerDay | `[[4, 0.02], [10, 0.06], [20, 0.1], [25, 0.12], [26, 0.2], [30, 0.3]…` | かき混ぜないと1日に増える酸味（26℃以上で急に増える） |
| 269 | nuka.lowSaltSourBoost | `0.05` | 塩分が1%下がるごとに酸味の増え方+5% |
| 270 | nuka.stirSourDrop | `0.35` | かき混ぜると酸味がこれだけ下がる |
| 271 | nuka.addSaltPct | `1, addSaltCost: 10, addSaltSourDrop: 0.25` | 塩を足す（出典: 塩を足すと酸味が和らぐ） |
| 272 | nuka.sourAcidBoost | `40` | 床の酸味1でぬか漬けの酸味+40 |
| 273 | nuka.matureDays | `14` | 毎日かき混ぜて14日で熟成度が最大 |
| 280 | sales.portionsPerBatch | `6` | 1樽の標準の個数（仕込みで個数を選ばなければこの数。費用はこの数ぶんの仕入れ値） |
| 281 | sales.barrelCapacity | `60` | 1樽に仕込める最大の個数（たくさん仕込んで長く売れる。売れ残ると酸っぱくなる） |
| 282 | sales.satScale | `1.7` | 好みとのズレ(重み付き平均)×この値を100から引く |
| 283 | sales.stageFactor | `{ raw: 1, ripe: 1, over: 0.92, sour: 0.7 }` | 過熟・酸っぱすぎは満足度に掛ける（rawは別途、未熟の式で下げる） |
| 284 | sales.likeBonus | `8` | 好きな種類の漬物なら満足度+8 |
| 285 | sales.unripeMinFactor | `0.5` | 未熟だと満足度に 0.5〜1.0 を掛ける |
| 286 | sales.spoilSatPenalty | `0.8` | 傷みリスク100%で満足度×0.2（期待値） |
| 287 | sales.buyThreshold | `40` | 満足度がこれ未満なら買わない |
| 289 | sales.priceMin | `0.6, priceMax: 1.3` |  |
| 290 | sales.saltCostPerPct | `10` | 塩代: 塩分1%あたり(円) |
| 291 | sales.startMoney | `2000` |  |
| 298 | calendar.ticksPerDay | `4` | 1日=4区切り（朝・昼・夕・夜） |
| 299 | calendar.daysPerSeason | `28` |  |
| 306 | calendar | `` | 時間制: 各時間帯が実時間で何秒つづくか（設定の速さで割る）。夜は短い |
| 314 | season | `` | 外気温は【出典: 指示書の仮置き例】、prefShiftは |
| 318 | — | `` | 季節ごとの天気の出やすさ（重み） |
| 325 | — | `` | 来店: 最大 slots 人まで、1人ずつ「来店率 = base × 天気 × 時間帯」で来るか決める |
| 335 | — | `` | target は 0〜100 の理想の味。weights は重視度。 |

合計 110 件
