# 仮置きの一覧

`src/config.js` と `data/` で【仮置き】とコメントした値（出典がなく、遊びの釣り合いで決めたもの）。`node scripts/placeholders.js > docs/placeholders.md` で作り直せる。

## src/config.js

| 行 | 項目 | 値 | 理由・メモ |
| --- | --- | --- | --- |
| 44 | taste.acidHalfProgress | `7` |  |
| 46 | taste.saltAbsorbTauDays | `0.5` | 1日でほぼ（86%）回る |
| 47 | taste.saltFullPct | `6` | 回りきった塩分6%で塩味100（3%なら50） |
| 50 | taste.complexityLowSlope | `0.02` | 18℃から1℃下がるごとに-2% |
| 51 | taste.complexityHighSlope | `0.04` | 22℃から1℃上がるごとに-4%（高温の急速発酵は単調） |
| 52 | taste.complexityMinFactor | `0.15` | 下限 |
| 60 | spoil.basePerDay | `0.01` | 3%・20℃で7日 → 約7% |
| 61 | spoil.saltTable | `[[1, 8], [2, 3], [3, 1], [5, 0.3], [10, 0.05], [20, 0]]` |  |
| 62 | spoil.tempTable | `[[4, 0.1], [10, 0.3], [20, 1], [25, 2.5], [30, 5], [40, 10]]` |  |
| 67 | texture.spoilPenalty | `0.5` | 傷み100%で食感が半分に |
| 81 | specialMax | `2` | 1つの樽に2つまで |
| 91 | weight.riseBase | `0.5` | ふつうの重石・塩3%の白菜で、2日で水が上がる |
| 92 | weight.unUpSpoil | `3` | 水の上がっていない1日 = 傷みの3日ぶん（ふつうの重石との差で数える） |
| 93 | weight.crush | `0.06` | 水が上がったあと倍の重石のままだと、1日ごとに食感 −6%（白菜。大根はその1/4） |
| 94 | weight.lightBonus | `0.01, lightMax: 1.06` | 水が上がったあと軽くしておくと、1日ごとに食感 +1%（6%まで） |
| 98 | workGrace | `3` | 目安を過ぎても3日までは（遅れて）できる |
| 106 | letterEvery | `5` | 地方の便りが届く間隔（日） |
| 127 | additives.shoga | `{ name: '生姜', cost: 50, complexity: 10, salt: 0, acid: 0, spoil: 0.9 }` | さっぱり・日持ちを少し良く |
| 128 | additives.akajiso | `{ name: '赤しそ', cost: 70, complexity: 12, salt: 0, acid: 4, spoil: 0…` | 香りと色 |
| 129 | additives.karashi | `{ name: 'からし', cost: 40, complexity: 9, salt: 0, acid: 0, spoil: 0.…` | ぬか床に入れると傷みにくい |
| 130 | additives.sakekasu | `{ name: '酒粕', cost: 90, complexity: 16, salt: -4, acid: -3, spoil: 1 }` | まろやかでコクが出る（粕漬け） |
| 135 | affinityBadPenalty | `15` |  |
| 136 | affinitySatBonus | `6` | 相性の良い調味1つにつき、どのお客の満足度も+6（悪いと−6） |
| 137 | affinityNeutralFactor | `0.5` |  |
| 192 | progress.xpPerPiece | `1` | 1個売るごとの経験 |
| 193 | progress.xpGreatSat | `70` | この満足度以上で買われた分は |
| 194 | progress.xpGreatMult | `2` | 経験×2 |
| 195 | progress.xpNewBook | `5` | 図鑑に新しい組み合わせが載ったとき |
| 196 | progress.xpInspire | `20` | ひらめいたとき |
| 197 | progress.xpFirstSuccess | `30` | 作り方を初めて成功させたとき（図鑑が埋まる） |
| 198 | progress.successSat | `60` | 1つの樽で、買ったお客の誰か1人でもこの満足度以上なら「成功」（うまいと言わせた） |
| 199 | progress.masterAfter | `10` | 成功10樽で腕前が最大 |
| 200 | progress.masterComplexity | `0.15` | 腕前が最大なら風味の深さ×1.15（作り方を磨くと品質が上がる） |
| 201 | progress.masterTexture | `0.05` | 腕前が最大なら食感×1.05（扱いが上手になる） |
| 224 | care.filmPerDay | `[[4, 0.008], [10, 0.05], [20, 0.08], [25, 0.12], [30, 0.15], [40, 0…` | 量は |
| 225 | care.filmVisible | `0.3` | これ以上で「白い膜」が見える（4℃では約37日） |
| 226 | care.filmHarmless | `0.15` | これ未満は味に響かない |
| 227 | care.filmSatPenalty | `0.5` | 膜が一面に張ると満足度×0.5 |
| 228 | care.filmComplexityPenalty | `0.4` | 膜が一面に張ると風味の深さ×0.6 |
| 233 | nuka.startSalt | `7` | ぬか床の塩分% |
| 234 | nuka.minSalt | `4, maxSalt: 12` |  |
| 235 | nuka.saltLossPerBatch | `0.3` | ぬか漬けを1樽漬けるごとに床の塩分が減る |
| 236 | nuka.sourPerDay | `[[4, 0.02], [10, 0.06], [20, 0.1], [25, 0.12], [26, 0.2], [30, 0.3]…` | かき混ぜないと1日に増える酸味（26℃以上で急に増える） |
| 237 | nuka.lowSaltSourBoost | `0.05` | 塩分が1%下がるごとに酸味の増え方+5% |
| 238 | nuka.stirSourDrop | `0.35` | かき混ぜると酸味がこれだけ下がる |
| 239 | nuka.sourAcidBoost | `40` | 床の酸味1でぬか漬けの酸味+40 |
| 240 | nuka.matureDays | `14` | 毎日かき混ぜて14日で熟成度が最大 |
| 242 | nuka.waterPerBatch | `0.08` | ぬか漬けを標準の個数ぶん漬けるごとに、野菜から出る水で床が水っぽくなる（個数に比例） |
| 243 | nuka.waterPerDay | `0.01` | 何もしなくても少しずつ水が出る |
| 244 | nuka.waterSourBoost | `0.6` | 水っぽさ1で酸味の増え方×1.6（水分過多は酸っぱくなる原因） |
| 245 | nuka.waterSaltLoss | `0.3` | 水っぽさ1でぬか漬けの塩味×0.7（薄まる） |
| 247 | nuka.rotFilmStart | `0.5, rotPerFilm: 0.35` | 膜が半分を超えると、超えたぶん×0.35/日 |
| 248 | nuka.rotSourStart | `0.6, rotPerSour: 0.35` | 酸味が0.6を超えると、超えたぶん×0.35/日 |
| 249 | nuka.suteEveryDays | `4, rotPerSuteDay: 0.02` | 捨て漬けを4日より長く替えないと、1日ごとに+0.02/日 |
| 250 | nuka.rotStirDrop | `0.05` | かき混ぜると傷みが少し戻る（空気を入れて悪い菌をおさえる） |
| 251 | nuka.rotSpoilBoost | `100` | 傷み1でぬか漬けの傷みリスク+100% |
| 252 | nuka.rotComplexityLoss | `0.5` | 傷み1で風味の深さ×0.5 |
| 253 | nuka.umamiPerDay | `0.02` | 足した旨味は1日に0.02ずつ抜けていく |
| 254 | nuka.umamiComplexityBoost | `0.3` | 旨味1でぬか漬けの風味の深さ×1.3 |
| 261 | sales.portionsPerBatch | `6` | 1樽の標準の個数（仕込みで個数を選ばなければこの数。費用はこの数ぶんの仕入れ値） |
| 262 | sales.barrelCapacity | `60` | 1樽に仕込める最大の個数（たくさん仕込んで長く売れる。売れ残ると酸っぱくなる） |
| 263 | sales.satScale | `1.7` | 好みとのズレ(重み付き平均)×この値を100から引く |
| 264 | sales.stageFactor | `{ raw: 1, ripe: 1, over: 0.92, sour: 0.7 }` | 過熟・酸っぱすぎは満足度に掛ける（rawは別途、未熟の式で下げる） |
| 265 | sales.likeBonus | `8` | 好きな種類の漬物なら満足度+8 |
| 266 | sales.unripeMinFactor | `0.5` | 未熟だと満足度に 0.5〜1.0 を掛ける |
| 267 | sales.spoilSatPenalty | `0.8` | 傷みリスク100%で満足度×0.2（期待値） |
| 268 | sales.buyThreshold | `40` | 満足度がこれ未満なら買わない |
| 270 | sales.priceMin | `0.6, priceMax: 1.3` |  |
| 271 | sales.saltCostPerPct | `10` | 塩代: 塩分1%あたり(円) |
| 272 | sales.startMoney | `10000` | はじめから樽いっぱい（60個）仕込める額 |
| 273 | sales.maxBuy | `4` | 1人が買う数の上限。満足度が buyThreshold から buyStep 上がるごとに1個ずつ増える |
| 274 | sales.buyStep | `15` |  |
| 281 | calendar.ticksPerDay | `4` | 1日=4区切り（朝・昼・夕・夜） |
| 282 | calendar.daysPerSeason | `28` |  |
| 310 | visit.slots | `10` | 1つの時間帯に来るお客の上限（1日5分で、1時間帯に十人ほど） |

## data/claimer.js

| 行 | 項目 | 値 | 理由・メモ |
| --- | --- | --- | --- |
| 52 | — | `{ id: 'apologize', name: '平謝りする', note: 'その場はおさまる。でも相手は調子に乗る', rep:…` |  |
| 53 | — | `{ id: 'omake', name: 'おまけで黙らせる', note: '1個タダで渡す。味をしめてまた来る', piece: …` |  |
| 56 | explain.success | `{ base: 0.2, perLevel: 0.06, perQuality: 0.25, win: { rep: 2, nerve…` |  |
| 59 | — | `{ id: 'regular', name: '常連さんに助け舟を出してもらう', note: 'この時間帯に常連が来ていたら頼める'…` |  |
| 60 | — | `{ id: 'ban', name: '出入り禁止にする', note: '季節がひとつ巡るまで来なくなる。ただし角が立って評判が少し…` |  |
| 64 | — | `export const IGNORE = { id: 'ignore', name: '聞こえないふり', rep: -3, ner…` |  |

## data/events.js

| 行 | 項目 | 値 | 理由・メモ |
| --- | --- | --- | --- |
| 13 | — | `{ id: 'hanami', name: 'お花見', season: 'spring', from: 8, to: 10, vis…` |  |
| 14 | — | `{ id: 'doyo', name: '夏の土用', season: 'summer', from: 14, to: 19, vis…` |  |
| 15 | — | `{ id: 'tsuyu', name: '梅雨入り', season: 'summer', from: 1, to: 5, visi…` |  |
| 16 | — | `{ id: 'obon', name: 'お盆', season: 'summer', from: 20, to: 23, visit…` |  |
| 17 | — | `{ id: 'bettaraichi', name: 'べったら市', season: 'autumn', from: 12, to:…` | 出典: 資料 p13-1「秋の市（べったら市）に合わせた出荷」 |
| 18 | — | `{ id: 'takuanDoki', name: 'たくあんの仕込みどき', season: 'autumn', from: 20,…` |  |
| 19 | — | `{ id: 'saimatsu', name: '歳末', season: 'winter', from: 5, to: 9, vis…` |  |
| 20 | — | `{ id: 'shogatsu', name: '正月', season: 'winter', from: 10, to: 12, v…` |  |

## data/facilities.js

| 行 | 項目 | 値 | 理由・メモ |
| --- | --- | --- | --- |
| 16 | — | `{ id: 'outdoor', name: '屋外', cost: 0, level: 1, offset: 3, note: '外…` |  |
| 17 | — | `{ id: 'doma', name: '土間', cost: 0, level: 1, offset: -2, note: '外気温…` |  |
| 18 | — | `{ id: 'fridge', name: '冷蔵庫', cost: 3000, level: 1, fixed: 4, note: …` | 値段は |
| 19 | — | `{ id: 'muro', name: '室（むろ）', cost: 4000, level: 1, fixed: 22, note:…` | 【出典】ザワークラウト18〜22℃。値段は |
| 20 | — | `{ id: 'tsubo', name: '壺', cost: 2000, level: 2, note: '小さな仕込み用の陶器の壺…` |  |
| 21 | — | `{ id: 'kaon', name: '加温室', cost: 12000, level: 4, fixed: 40, adjust…` | 【出典】すぐきの室は約40℃。値段は |
| 22 | — | `{ id: 'fuda', name: '品質表示の札', cost: 1500, level: 1, claimer: { expl…` |  |
| 23 | — | `{ id: 'koenote', name: 'お客様の声ノート', cost: 800, level: 1, claimer: { …` |  |
| 24 | — | `{ id: 'manekineko', name: 'にらみ招き猫', cost: 5000, level: 3, claimer: …` |  |
| 25 | — | `{ id: 'kunsei', name: '燻製小屋', cost: 15000, level: 5, note: '薪で燻す小屋。…` |  |

## data/levels.js

| 行 | 項目 | 値 | 理由・メモ |
| --- | --- | --- | --- |
| 15 | — | `{ level: 2, xp: 60, title: '駆け出しの漬物屋', line: '近所の猫が店先で昼寝するようになった。',…` |  |
| 16 | — | `{ level: 3, xp: 180, title: '町の漬物屋', line: '回覧板に店の名前が載った（誤字だった）。', …` |  |
| 17 | — | `{ level: 4, xp: 400, title: '漬物名人', line: 'ぬか床に話しかけても、もう誰も驚かない。', b…` |  |
| 18 | — | `{ level: 5, xp: 750, title: '漬物番長', line: '重石を持つ姿が、やけに様になってきた。', ba…` |  |
| 19 | — | `{ level: 6, xp: 1200, title: '漬物仙人', line: '白菜の気持ちがわかる（気がする）。', bar…` |  |
| 20 | — | `{ level: 7, xp: 2000, title: '最強の漬物屋', line: 'ついに「最強」を名乗っても怒られなくなった…` |  |
| 24 | — | `export const LEVEL_AFTER_LAST = 1000;` |  |

## data/nuka.js

| 行 | 項目 | 値 | 理由・メモ |
| --- | --- | --- | --- |
| 15 | — | `{ id: 'salt', name: '塩を足す', when: 'sour', cost: 10, effects: { salt…` | 効き目 |
| 16 | — | `{ id: 'karashi', name: 'からしを入れる（大さじ1）', when: 'sour', cost: 40, eff…` |  |
| 17 | — | `{ id: 'egg', name: '卵の殻を入れる', when: 'sour', cost: 0, effects: { sou…` |  |
| 19 | — | `{ id: 'nuka', name: 'ぬかと塩を足す（ぬか1カップに塩小さじ1〜大さじ½）', when: 'water', co…` |  |
| 21 | — | `{ id: 'sute', name: '捨て漬けを替える（キャベツの芯・にんじんの皮）', when: 'rot', cost: 0…` | 効き目 |
| 23 | — | `{ id: 'kombu', name: '昆布', when: 'umami', cost: 60, effects: { umam…` |  |
| 24 | — | `{ id: 'akatogarashi', name: '赤唐辛子', when: 'umami', cost: 30, effect…` |  |
| 25 | — | `{ id: 'niboshi', name: '煮干し', when: 'umami', cost: 50, effects: { u…` |  |
| 26 | — | `{ id: 'sansho', name: '実山椒', when: 'umami', cost: 70, effects: { um…` |  |
| 27 | — | `{ id: 'yuzu', name: 'ゆずの皮', when: 'umami', cost: 80, effects: { uma…` |  |

## data/orders.js

| 行 | 項目 | 値 | 理由・メモ |
| --- | --- | --- | --- |
| 19 | bento | `}` |  |
| 25 | chonaikai | `}` |  |
| 31 | ryokan | `}` |  |
| 37 | furusato | `}` |  |
| 43 | ryotei | `}` |  |
| 49 | oyashiki | `}` |  |

## data/pickles.js

| 行 | 項目 | 値 | 理由・メモ |
| --- | --- | --- | --- |
| 48 | asazuke.tempHint | `'5〜20℃'` | 冷蔵〜室温の短期 |
| 49 | asazuke.temp | `{ lo: 5, hi: 20 }` |  |
| 51 | asazuke.window | `{ lo: 0.5, hi: 3, sour: 5 }` | 日持ちは数日 |
| 52 | asazuke.complexityMax | `35` | 浅漬けは風味が単純 |
| 53 | asazuke.price | `250` | 1個(円) |
| 64 | hakusaizuke.salt | `{ lo: 2.5, hi: 3.5 }` | 出典は3%のみ |
| 65 | hakusaizuke.tempHint | `'5〜20℃'` |  |
| 66 | hakusaizuke.temp | `{ lo: 5, hi: 20 }` |  |
| 68 | hakusaizuke.window | `{ lo: 0.85, hi: 1.3, sour: 1.8 }` | 6〜9日が食べ頃、約12.6日で酸っぱすぎ |
| 69 | hakusaizuke.complexityMax | `85` | 調味（昆布など）でさらに深くなる余地を残す |
| 70 | hakusaizuke.price | `500` |  |
| 87 | nukazuke.ripeAt | `0.8` | きゅうりを20〜25℃の床で一晩〜1日 |
| 88 | nukazuke.window | `{ lo: 0.5, hi: 2, sour: 3.5 }` |  |
| 89 | nukazuke.saltUptake | `0.4` | 野菜が吸う塩はぬか床の塩分の一部だけ |
| 90 | nukazuke.complexityMax | `80` | 床の熟成度で 40%〜100% になる |
| 91 | nukazuke.price | `300` |  |
| 103 | takuan.saltHint | `'4〜8%（長く置くなら多め）'` | 出典は「干し日数と出荷時期で塩を変える」のみ |
| 104 | takuan.salt | `{ lo: 4, hi: 8 }` |  |
| 105 | takuan.tempHint | `'寒い時期（5〜15℃）'` | 冬の仕込み |
| 106 | takuan.temp | `{ lo: 5, hi: 15 }` |  |
| 107 | takuan.ripeAt | `20` | 出典は「約1か月以上」。大根は漬かりが遅い（×0.8）ので、塩5%・室22℃で約36日 |
| 108 | takuan.window | `{ lo: 0.9, hi: 4, sour: 6 }` | 長く置ける |
| 109 | takuan.acidHalfProgress | `20` | 長く漬けても酸っぱくなりにくい（食べ頃で酸味50） |
| 110 | takuan.complexityMax | `80` | ざらめ・唐辛子・昆布で深まる |
| 111 | takuan.price | `900` | 長く寝かせるぶん高い |
| 112 | takuan.portions | `18` | 大きな樽で一度にたくさん漬ける（ふつうは6個） |
| 117 | takuan.drying | `{ max: 14, ideal: [5, 10], default: 7 }` | 出典は「干してから塩漬け」。干す日数（1〜2週間ほど、の字に曲がるまで） |
| 118 | takuan.aging | `{ from: 1.3, full: 3, max: 0.5 }` | 寝かせるほど高く売れる |
| 130 | nozawanazuke.tempHint | `'寒い所（0〜10℃）'` | 出典は「寒い時期」 |
| 131 | nozawanazuke.temp | `{ lo: 0, hi: 10 }` |  |
| 132 | nozawanazuke.ripeAt | `3` | 出典は「2〜3週間で食べられる」（寒い時期）。冬の屋外（8℃）で約10日、土間（3℃）で約1か月 |
| 133 | nozawanazuke.window | `{ lo: 0.8, hi: 2, sour: 3 }` |  |
| 134 | nozawanazuke.complexityMax | `70` |  |
| 135 | nozawanazuke.price | `450` |  |
| 150 | umeboshi.salt | `{ lo: 15, hi: 20 }` |  |
| 151 | umeboshi.tempHint | `'冷暗所（15〜25℃）'` |  |
| 152 | umeboshi.temp | `{ lo: 15, hi: 25 }` |  |
| 153 | umeboshi.ripeAt | `1.6` | 塩18%・20℃で約1か月 |
| 154 | umeboshi.window | `{ lo: 0.8, hi: 30, sour: 60 }` | ほぼ傷まず、いつまでも置ける |
| 155 | umeboshi.acidHalfProgress | `0.3` | 梅はもともと酸っぱい |
| 156 | umeboshi.saltUptake | `0.4` | 塩分は高いが、感じる塩味は果肉の酸味でやわらぐ（梅の塩の入り方0.6と合わせて、18%で塩味75ほど） |
| 157 | umeboshi.complexityMax | `75` |  |
| 158 | umeboshi.price | `150` | 1粒より少し多めの1包み |
| 159 | umeboshi.portions | `24` | 壺いっぱいに漬ける |
| 166 | umeboshi.aging | `{ from: 1, full: 12, max: 1.0 }` | 古い梅干しほど値打ちがある |
| 176 | karashizuke.saltHint | `'2〜4%'` |  |
| 177 | karashizuke.salt | `{ lo: 2, hi: 4 }` |  |
| 178 | karashizuke.tempHint | `'5〜20℃'` |  |
| 179 | karashizuke.temp | `{ lo: 5, hi: 20 }` |  |
| 180 | karashizuke.ripeAt | `2` | 数日 |
| 181 | karashizuke.window | `{ lo: 0.7, hi: 2.5, sour: 4 }` |  |
| 182 | karashizuke.complexityMax | `60` |  |
| 183 | karashizuke.price | `400` |  |
| 200 | shibazuke.work | `[['drain', 2, 4]]` | 【出典】資料 p26-2「黒い汁を捨てる判断」。日は |
| 201 | shibazuke.saltHint | `'3〜5%'` |  |
| 202 | shibazuke.salt | `{ lo: 3, hi: 5 }` |  |
| 203 | shibazuke.tempHint | `'15〜25℃（夏）'` | 夏の仕込み |
| 204 | shibazuke.temp | `{ lo: 15, hi: 25 }` |  |
| 205 | shibazuke.ripeAt | `6` | 乳酸発酵で1週間ほど |
| 206 | shibazuke.window | `{ lo: 0.8, hi: 2.5, sour: 4 }` |  |
| 207 | shibazuke.complexityMax | `75` |  |
| 208 | shibazuke.price | `550` |  |
| 224 | furuzuke.saltHint | `'4〜7%'` |  |
| 225 | furuzuke.salt | `{ lo: 4, hi: 7 }` |  |
| 226 | furuzuke.tempHint | `'0〜15℃'` |  |
| 227 | furuzuke.temp | `{ lo: 0, hi: 15 }` |  |
| 228 | furuzuke.ripeAt | `10` |  |
| 229 | furuzuke.window | `{ lo: 0.8, hi: 5, sour: 8 }` | 酸っぱいのが持ち味なので長く置ける |
| 230 | furuzuke.acidHalfProgress | `3` | 早く酸っぱくなる（食べ頃で酸味が強い） |
| 231 | furuzuke.complexityMax | `70` |  |
| 232 | furuzuke.price | `350` |  |
| 241 | furuzuke.aging | `{ from: 1.5, full: 4, max: 0.3 }` | 寝かせるほど高く売れる |
| 249 | kasuzuke.saltHint | `'3〜6%（下漬け）'` |  |
| 250 | kasuzuke.salt | `{ lo: 3, hi: 6 }` |  |
| 251 | kasuzuke.tempHint | `'涼しい所（5〜15℃）'` |  |
| 252 | kasuzuke.temp | `{ lo: 5, hi: 15 }` |  |
| 253 | kasuzuke.ripeAt | `14` |  |
| 254 | kasuzuke.window | `{ lo: 0.9, hi: 4, sour: 6 }` |  |
| 255 | kasuzuke.acidHalfProgress | `20` | 酸っぱくなりにくい |
| 256 | kasuzuke.complexityMax | `90` |  |
| 257 | kasuzuke.price | `800` |  |
| 266 | kasuzuke.aging | `{ from: 1.2, full: 3, max: 0.6 }` | 寝かせるほど高く売れる |
| 281 | sunki.tempHint | `'寒い所（0〜10℃）'` | 【出典】は「低温」。数値は |
| 282 | sunki.temp | `{ lo: 0, hi: 10 }` |  |
| 283 | sunki.ripeAt | `6` | 5℃で約1か月 |
| 284 | sunki.window | `{ lo: 0.8, hi: 2.5, sour: 4 }` |  |
| 285 | sunki.acidHalfProgress | `3` | 乳酸でしっかり酸っぱい |
| 286 | sunki.spoilMult | `0.05` | 種の乳酸菌が、塩のかわりに傷みをおさえる |
| 287 | sunki.complexityMax | `80` |  |
| 288 | sunki.price | `700` |  |
| 305 | iburigakko.smoking | `{ woods: { nara: { name: 'ナラ', flavor: 1.0 }, sakura: { name: 'サクラ'…` | 日数は【出典】4〜5日、香りの差は |
| 307 | iburigakko.saltHint | `'5〜8%（米ぬか・ざらめと）'` |  |
| 308 | iburigakko.salt | `{ lo: 5, hi: 8 }` |  |
| 309 | iburigakko.tempHint | `'冬の冷気（0〜10℃）'` | 【出典】は「冬の冷気」。数値は |
| 310 | iburigakko.temp | `{ lo: 0, hi: 10 }` |  |
| 311 | iburigakko.ripeAt | `3.8` | 塩6%・5℃で約2か月 |
| 312 | iburigakko.window | `{ lo: 0.9, hi: 3, sour: 5 }` |  |
| 313 | iburigakko.acidHalfProgress | `15` |  |
| 314 | iburigakko.complexityMax | `70` | 燻すと最大 ×1.5 |
| 315 | iburigakko.price | `1100` |  |
| 316 | iburigakko.portions | `12` |  |
| 325 | iburigakko.aging | `{ from: 1.2, full: 3, max: 0.4 }` |  |
| 337 | sugukizuke.bestTemp | `[38, 42]` | 【出典】は「約40℃」。幅は |
| 338 | sugukizuke.saltHint | `'3〜4%'` |  |
| 339 | sugukizuke.salt | `{ lo: 3, hi: 4 }` |  |
| 342 | sugukizuke.ripeAt | `40` | 塩3.5%・40℃で約15日 |
| 343 | sugukizuke.window | `{ lo: 0.85, hi: 1.3, sour: 1.8 }` | 食べ頃は短い |
| 344 | sugukizuke.spoilMult | `0.06` | 高温を好む乳酸菌が、ほかの菌をおさえる |
| 345 | sugukizuke.complexityMax | `85` |  |
| 346 | sugukizuke.price | `1000` |  |
| 364 | heshiko.saltHint | `'10〜20%（魚なので多め。少ないと傷む）'` |  |
| 365 | heshiko.salt | `{ lo: 10, hi: 20 }` |  |
| 366 | heshiko.tempHint | `'置き場所の温度で（夏の暑さに注意）'` |  |
| 367 | heshiko.temp | `{ lo: 0, hi: 20 }` |  |
| 368 | heshiko.ripeAt | `5` | 塩15%・土間で約1年（1年 = 112日） |
| 369 | heshiko.window | `{ lo: 0.8, hi: 3, sour: 5 }` |  |
| 370 | heshiko.acidHalfProgress | `10` |  |
| 371 | heshiko.saltUptake | `0.18` | 感じる塩味（ぬかでやわらぐ。塩15%で塩味80ほど） |
| 372 | heshiko.complexityMax | `95` | 長い熟成で旨味が深い |
| 373 | heshiko.price | `1500` |  |
| 374 | heshiko.portions | `12` |  |
| 382 | heshiko.aging | `{ from: 1, full: 2.5, max: 0.6 }` |  |

## data/regional.js

| 行 | 項目 | 値 | 理由・メモ |
| --- | --- | --- | --- |
| 22 | — | `/** 漬け方ごとの性質【仮置き】 */` |  |
| 36 | — | `const SALT_EATEN = 3.5;` |  |
| 37 | — | `const MIN_DAYS = 1;` |  |

## data/specials.js

| 行 | 項目 | 値 | 理由・メモ |
| --- | --- | --- | --- |
| 15 | — | `{ id: 'moshio', name: '藻塩', kind: 'salt', cost: 150, level: 1, effe…` |  |
| 16 | — | `{ id: 'tenpien', name: '天日塩', kind: 'salt', cost: 100, level: 1, ef…` |  |
| 17 | — | `{ id: 'asatore', name: '朝採れの野菜', kind: 'veg', cost: 200, level: 1, …` |  |
| 18 | — | `{ id: 'yuki', name: '有機栽培の野菜', kind: 'veg', cost: 400, level: 2, ef…` |  |
| 19 | — | `{ id: 'rausu', name: '羅臼昆布', kind: 'umami', cost: 500, level: 2, ef…` |  |
| 20 | — | `{ id: 'honkare', name: '本枯れ節', kind: 'umami', cost: 400, level: 2, …` |  |
| 21 | — | `{ id: 'jizake', name: '地酒', kind: 'aroma', cost: 400, level: 3, eff…` |  |
| 22 | — | `{ id: 'asakura', name: '朝倉山椒', kind: 'aroma', cost: 500, level: 3, …` |  |
| 23 | — | `{ id: 'nankobai', name: '紀州の南高梅', kind: 'veg', cost: 1200, level: 2…` |  |
| 24 | — | `{ id: 'kinpaku', name: '金箔', kind: 'deco', cost: 2400, level: 5, ef…` |  |

## data/staff.js

| 行 | 項目 | 値 | 理由・メモ |
| --- | --- | --- | --- |
| 21 | baito | `}` |  |
| 29 | kanban | `}` |  |
| 36 | deshi | `}` |  |

## data/stories.js

| 行 | 項目 | 値 | 理由・メモ |
| --- | --- | --- | --- |
| 10 | young | `{ name: '若い人', salt: -10, share: 0.3, perYear: 0.03 }` | 減塩志向 |
| 11 | middle | `{ name: '働き盛り', salt: 0, share: 0.4, perYear: 0 }` |  |
| 12 | old | `{ name: 'お年寄り', salt: 8, share: 0.3, perYear: -0.03 }` | 昔ながらのしょっぱめ |

## data/upgrades.js

| 行 | 項目 | 値 | 理由・メモ |
| --- | --- | --- | --- |
| 16 | — | `{ id: 'noren', group: 'shop', name: '暖簾を新調する', cost: 8000, level: 2…` |  |
| 17 | — | `{ id: 'kanban', group: 'shop', name: '看板を書き直す', cost: 20000, level:…` |  |
| 18 | — | `{ id: 'shishoku', group: 'shop', name: '試食コーナーを作る', cost: 12000, le…` |  |
| 19 | — | `{ id: 'tana', group: 'shop', name: '棚を作り足す', cost: 6000, level: 2, …` |  |
| 20 | — | `{ id: 'urakura', group: 'shop', name: '裏の物置を蔵にする', cost: 30000, lev…` |  |
| 21 | — | `{ id: 'misesaki', group: 'shop', name: '店先を改装する', cost: 50000, leve…` |  |
| 22 | — | `{ id: 'kura', group: 'shop', name: '漬物蔵を建てる', cost: 120000, level: …` |  |
| 23 | — | `{ id: 'shinise', group: 'shop', name: '「老舗」の札をかける', cost: 300000, l…` |  |
| 25 | — | `{ id: 'sugioke', group: 'barrel', name: '杉の木桶に替える', cost: 6000, lev…` |  |
| 27 | — | `{ id: 'chirashi', group: 'campaign', name: 'チラシを配る', cost: 3000, le…` |  |
| 28 | — | `{ id: 'radio', group: 'campaign', name: '地元のラジオに出る', cost: 15000, l…` |  |

## data/vegetables.js

| 行 | 項目 | 値 | 理由・メモ |
| --- | --- | --- | --- |
| 21 | — | `{ id: 'hakusai', name: '白菜', water: 0.952, saltUptake: 1.0, ferment…` | fermentRate は【出典】基準、ほかは |
| 22 | — | `{ id: 'kyuri', name: 'きゅうり', water: 0.954, saltUptake: 1.0, ferment…` |  |
| 23 | — | `{ id: 'daikon', name: '大根', water: 0.946, saltUptake: 0.8, fermentR…` |  |
| 24 | — | `{ id: 'nozawana', name: '野沢菜', water: 0.94, saltUptake: 1.15, ferme…` |  |
| 25 | — | `{ id: 'nasu', name: 'なす', water: 0.932, saltUptake: 0.9, fermentRat…` |  |
| 26 | — | `{ id: 'kabu', name: 'かぶ', water: 0.939, saltUptake: 1.05, fermentRa…` |  |
| 27 | — | `{ id: 'akakabu', name: '赤かぶ', water: 0.92, saltUptake: 1.0, ferment…` |  |
| 28 | — | `{ id: 'ninjin', name: 'にんじん', water: 0.891, saltUptake: 0.8, fermen…` |  |
| 29 | — | `{ id: 'kyabetsu', name: 'キャベツ', water: 0.927, saltUptake: 1.1, ferm…` |  |
| 31 | — | `{ id: 'ume', name: '梅', water: 0.904, saltUptake: 0.6, fermentRate:…` |  |
| 32 | — | `{ id: 'shirouri', name: '白瓜', water: 0.953, saltUptake: 1.0, fermen…` |  |
| 33 | — | `{ id: 'myoga', name: 'みょうが', water: 0.956, saltUptake: 1.2, ferment…` |  |
| 35 | — | `{ id: 'suguki', name: 'すぐき菜', water: 0.93, saltUptake: 1.0, ferment…` |  |
| 36 | — | `{ id: 'saba', name: '鯖', water: 0.62, saltUptake: 1.2, fermentRate:…` | water は【出典: 食品成分表の目安】、ほかは |
| 38 | — | `{ id: 'nishin', name: '身欠きニシン', region: '北海道・東北', img: 'saba', fish…` |  |
| 39 | — | `{ id: 'gyoja', name: '行者にんにく', region: '北海道・東北', img: 'nozawana', o…` |  |
| 40 | — | `{ id: 'masu', name: 'マス', region: '北海道・東北', img: 'saba', fish: true…` |  |
| 41 | — | `{ id: 'seisai', name: '山形青菜', region: '北海道・東北', img: 'nozawana', wa…` |  |
| 42 | — | `{ id: 'sanma', name: 'サンマ', region: '関東', img: 'saba', fish: true, …` |  |
| 43 | — | `{ id: 'aotogarashi', name: '日光唐辛子', region: '関東', img: 'ninjin', on…` |  |
| 44 | — | `{ id: 'shakushina', name: 'しゃくし菜', region: '関東', img: 'nozawana', w…` |  |
| 45 | — | `{ id: 'buri', name: 'ブリ', region: '北陸・甲信・岐阜', img: 'saba', fish: tr…` |  |
| 46 | — | `{ id: 'narusawana', name: '鳴沢菜', region: '北陸・甲信・岐阜', img: 'nozawana…` |  |
| 47 | — | `{ id: 'koume', name: '甲州小梅', region: '北陸・甲信・岐阜', img: 'ume', only: …` |  |
| 48 | — | `{ id: 'wasabi', name: 'わさび', region: '東海・近畿', img: 'nozawana', wate…` |  |
| 49 | — | `{ id: 'mizukakena', name: '水かけ菜', region: '東海・近畿', img: 'nozawana',…` |  |
| 50 | — | `{ id: 'moriguchi', name: '守口大根', region: '東海・近畿', img: 'daikon', wa…` |  |
| 51 | — | `{ id: 'yatsugashira', name: '八つ頭の茎', region: '東海・近畿', img: 'akakabu…` |  |
| 52 | — | `{ id: 'hinona', name: '日野菜', region: '東海・近畿', img: 'akakabu', water…` |  |
| 53 | — | `{ id: 'shogoin', name: '聖護院かぶ', region: '東海・近畿', img: 'kabu', only:…` |  |
| 54 | — | `{ id: 'mizunasu', name: '泉州水なす', region: '東海・近畿', img: 'nasu', only…` |  |
| 55 | — | `{ id: 'harumana', name: '下北春まな', region: '東海・近畿', img: 'nozawana', …` |  |
| 56 | — | `{ id: 'tsudakabu', name: '津田かぶ', region: '中国・四国', img: 'akakabu', o…` |  |
| 57 | — | `{ id: 'mamakari', name: 'ママカリ', region: '中国・四国', img: 'saba', fish:…` |  |
| 58 | — | `{ id: 'hiroshimana', name: '広島菜', region: '中国・四国', img: 'nozawana',…` |  |
| 59 | — | `{ id: 'wakame', name: 'わかめ', region: '中国・四国', img: 'nozawana', only…` |  |
| 60 | — | `{ id: 'chorogi', name: 'チョロギ', region: '中国・四国', img: 'ume', only: […` |  |
| 61 | — | `{ id: 'olive', name: 'オリーブの実', region: '中国・四国', img: 'ume', only: […` |  |
| 62 | — | `{ id: 'hikabura', name: '緋のかぶら', region: '中国・四国', img: 'akakabu', o…` |  |
| 63 | — | `{ id: 'itadori', name: 'イタドリ', region: '中国・四国', img: 'akakabu', onl…` |  |
| 64 | — | `{ id: 'takana', name: '高菜', region: '九州・沖縄', img: 'nozawana', only:…` |  |
| 65 | — | `{ id: 'tojinna', name: '唐人菜', region: '九州・沖縄', img: 'hakusai', only…` |  |
| 66 | — | `{ id: 'akado', name: '赤ど芋の茎', region: '九州・沖縄', img: 'akakabu', only…` |  |
| 67 | — | `{ id: 'ayu', name: 'アユ', region: '九州・沖縄', img: 'saba', fish: true, …` |  |
| 68 | — | `{ id: 'papaya', name: '青パパイヤ', region: '九州・沖縄', img: 'shirouri', on…` |  |
| 69 | — | `{ id: 'suku', name: 'スク（アイゴの稚魚）', region: '九州・沖縄', img: 'saba', fis…` |  |
| 70 | — | `{ id: 'shimarakkyo', name: '島らっきょう', region: '九州・沖縄', img: 'daikon'…` |  |
| 72 | — | `{ id: 'rakkyo', name: 'らっきょう', img: 'daikon', only: ['spring', 'sum…` |  |
| 73 | — | `{ id: 'iwashi', name: 'イワシ', img: 'saba', fish: true, water: 0.69, …` |  |
| 74 | — | `{ id: 'ninniku', name: 'にんにく', img: 'daikon', water: 0.64, saltUpta…` |  |
| 75 | — | `{ id: 'jagaimo', name: '男爵いも', img: 'daikon', water: 0.79, saltUpta…` |  |
| 76 | — | `{ id: 'purin', name: 'プリン', img: 'daikon', water: 0.75, saltUptake:…` |  |
| 77 | — | `{ id: 'tofu', name: '木綿豆腐', img: 'daikon', water: 0.86, saltUptake:…` |  |

## data/wisdom.js

| 行 | 項目 | 値 | 理由・メモ |
| --- | --- | --- | --- |
| 6 | — | `export const GRANNY = { name: '梅子さん', title: '知恵袋のおばあちゃん', type: 's…` |  |

## data/work.js

| 行 | 項目 | 値 | 理由・メモ |
| --- | --- | --- | --- |
| 13 | honzuke | `{ label: '本漬けに漬け替える', note: '下漬けで水が出たら、新しい漬け床へ。下漬けのままだと塩がきつく、味が浅い',…` |  |
| 14 | tsukekae | `{ label: '漬け替える（塩を下げる）', note: '塩の多い床から、薄い床へ。替えないとしょっぱいまま', done: {…` |  |
| 15 | amazu | `{ label: '甘酢に漬け替える', note: '塩漬けのあと、甘酢へ。替えないと、ただのしょっぱいらっきょう', done: …` |  |
| 16 | nikaeshi | `{ label: '漬け汁を煮返す', note: '汁を煮立てて、冷まして戻す。傷みにくくなり、味がしみる', done: { sp…` |  |
| 17 | drain | `{ label: '汁を捨てる', note: '上がった汁（黒い汁・えぐみ）を捨てる。捨てないとえぐく、酸っぱい', done: {…` |  |
| 18 | kasu | `{ label: '粕を替える', note: '古い粕から新しい粕へ。替えるほど、しょっぱさが抜けて深くなる', done: { c…` |  |
| 19 | kasane | `{ label: '魚と野菜を重ねる', note: '下ごしらえした魚と、塩漬けした野菜を、麹と交互に重ねる', done: {},…` |  |
| 20 | doyoboshi | `{ label: '土用干しをする', note: '夏の土用の晴れた日に、梅を3日3晩お日さまに当てる。皮がやわらかく、色よく、値打…` | 出典: 資料 p14-1「天日干しの天気に左右される」 |
| 21 | hasamu | `{ label: '魚をかぶで挟む', note: '塩漬けしたかぶに、魚をはさんで麹へ', done: {}, skip: { co…` |  |

## data/regional.js（全国の漬物）

資料の「numbers」にない数値は仮置き。値段・店のレベル・食べ頃の長さ・漬け方ごとの性質（METHODS）はすべて仮置き。

| 資料 | 漬物 | 仮置きの数値 |
| --- | --- | --- |
| p01-1 | 北海道 ニシン漬け | 塩 3〜5% ・ 温度 0〜10℃ ・ 値段 1200円 |
| p01-2 | 北海道 行者にんにくしょうゆ漬け | 塩 2〜4% ・ 温度 5〜15℃ ・ 値段 900円 |
| p02-1 | 青森 赤かぶの千枚漬け | 温度 0〜10℃ ・ 値段 600円 |
| p02-2 | 青森 キャベツとマスの漬物 | 温度 5〜15℃ ・ 値段 800円 |
| p03-1 | 岩手 金婚漬け | 塩 4〜6% ・ 温度 5〜15℃ ・ 日数 30 ・ 値段 1200円 |
| p04-1 | 宮城 仙台白菜の漬物 | 温度 5〜15℃ ・ 値段 550円 |
| p06-1 | 山形 青菜漬（せいさいづけ） | 塩 3〜4% ・ 温度 5〜15℃ ・ 値段 600円 |
| p06-2 | 山形 大山の粕漬 | 塩 3〜6% ・ 温度 5〜15℃ ・ 日数 40 ・ 値段 1300円 |
| p07-1 | 福島 三五八漬け | 塩 2〜3% ・ 温度 10〜20℃ ・ 値段 450円 |
| p07-2 | 福島 にしんの山椒漬け | 塩 3〜5% ・ 温度 5〜15℃ ・ 値段 900円 |
| p08-1 | 茨城 ごさい漬け | 塩 5〜8% ・ 温度 0〜10℃ ・ 値段 1100円 |
| p08-2 | 茨城 らっきょう漬 | 塩 8〜10% ・ 温度 5〜15℃ ・ 値段 700円 |
| p09-1 | 栃木 ゆず巻き | 温度 5〜15℃ ・ 値段 500円 |
| p09-2 | 栃木 日光唐辛子のしそ巻き漬け | 塩 15〜20% ・ 温度 5〜15℃ ・ 値段 1500円 |
| p10-1 | 群馬 ゆず巻き | 塩 2〜3% ・ 値段 500円 |
| p11-1 | 埼玉 しゃくし菜の漬物 | 塩 2〜3% ・ 温度 0〜10℃ ・ 日数 14 ・ 値段 500円（資料に数値の記載なし） |
| p12-1 | 千葉 瓜の鉄砲漬 | 塩 4〜6% ・ 温度 5〜15℃ ・ 値段 800円 |
| p12-2 | 千葉 せぐろいわしのごま漬け | 塩 8〜10% ・ 温度 5〜15℃ ・ 値段 700円 |
| p13-1 | 東京 べったら漬け | 塩 3〜5% ・ 温度 5〜15℃ ・ 値段 800円 |
| p13-2 | 東京 福神漬け | 塩 3〜5% ・ 温度 5〜15℃ ・ 値段 700円 |
| p14-1 | 神奈川 小田原の梅干し | 塩 18〜20% ・ 温度 10〜20℃ ・ 日数 30 ・ 値段 200円 |
| p14-2 | 神奈川 割り干し大根のはりはり漬け | 塩 3〜4% ・ 温度 5〜15℃ ・ 値段 700円 |
| p15-1 | 新潟 なまぐさこうこ（塩からこうこ） | 塩 8〜10% ・ 温度 0〜10℃ ・ 値段 900円 |
| p15-2 | 新潟 干し大根漬け（はりはり漬け） | 塩 3〜4% ・ 温度 5〜15℃ ・ 日数 2 ・ 値段 800円 |
| p16-1 | 富山 かぶら寿し | 塩 3〜4% ・ 温度 0〜10℃ ・ 値段 1800円 |
| p17-1 | 石川 かぶらずし・大根ずし | 値段 1800円 |
| p18-2 | 福井 三年子らっきょの漬物 | 塩 8〜10% ・ 温度 5〜15℃ ・ 値段 1000円 |
| p18-3 | 福井 赤かぶらの酢漬け | 温度 5〜15℃ ・ 値段 600円 |
| p19-1 | 山梨 鳴沢菜漬け | 塩 2〜3% ・ 温度 5〜15℃ ・ 値段 500円 |
| p19-2 | 山梨 甲州小梅の漬物 | 塩 10〜15% ・ 温度 10〜20℃ ・ 値段 120円 |
| p21-1 | 岐阜 赤かぶ漬け（飛騨紅かぶ） | 温度 10〜20℃ ・ 値段 700円 |
| p22-1 | 静岡 山葵漬け | 温度 5〜15℃ ・ 値段 1500円 |
| p22-2 | 静岡 水かけ菜の漬物 | 温度 5〜15℃ ・ 値段 500円 |
| p23-1 | 愛知 守口漬 | 塩 4〜8% ・ 温度 5〜15℃ ・ 値段 3000円 |
| p23-2 | 愛知 かりもりの粕漬け | 値段 1200円 |
| p24-1 | 三重 白瓜漬け（伊賀の鉄砲漬け） | 塩 4〜6% ・ 温度 5〜15℃ ・ 値段 1200円 |
| p24-2 | 三重 八つ頭の茎漬け | 温度 2〜6℃ ・ 値段 600円 |
| p25-1 | 滋賀 日野菜漬 | 温度 5〜15℃ ・ 値段 700円 |
| p25-2 | 滋賀 白菜のたたみ漬け | 温度 5〜15℃ ・ 値段 500円 |
| p26-1 | 京都 千枚漬け | 温度 5〜15℃ ・ 値段 1000円 |
| p27-1 | 大阪 泉州水なすの浅漬 | 温度 20〜25℃ ・ 値段 700円 |
| p27-2 | 大阪 大阪漬 | 塩 1〜2% ・ 温度 2〜6℃ ・ 値段 300円 |
| p28-1 | 兵庫 やたら漬け | 塩 3〜5% ・ 温度 5〜15℃ ・ 値段 900円 |
| p29-1 | 奈良 下北春まな漬（まなめはりの具） | 塩 3〜4% ・ 温度 5〜15℃ ・ 日数 3 ・ 値段 800円（資料に数値の記載なし） |
| p29-2 | 奈良 奈良漬け | 塩 3〜5% ・ 温度 5〜15℃ ・ 日数 30 ・ 値段 1300円（資料に数値の記載なし） |
| p31-1 | 鳥取 らっきょう漬け | 塩 8〜10% ・ 温度 5〜15℃ ・ 値段 700円 |
| p32-1 | 島根 津田かぶ漬け | 塩 4〜5% ・ 温度 0〜10℃ ・ 値段 700円 |
| p33-1 | 岡山 ママカリの酢漬け | 塩 3〜5% ・ 温度 5〜15℃ ・ 日数 0.5 ・ 値段 800円 |
| p34-1 | 広島 広島菜漬け | 塩 3〜4% ・ 温度 5〜15℃ ・ 値段 600円 |
| p35-1 | 山口 寒漬（事業者サイトの記載） | 塩 5〜8% ・ 値段 1500円 |
| p35-2 | 山口 わかめの醤油漬け | 塩 2〜4% ・ 温度 5〜15℃ ・ 日数 0.3 ・ 値段 500円 |
| p36-1 | 徳島 久尾のチョロギ（梅酢漬け） | 塩 3〜5% ・ 温度 5〜15℃ ・ 日数 7 ・ 値段 900円（資料に数値の記載なし） |
| p36-2 | 徳島 阿波沢庵 | 塩 4〜8% ・ 温度 5〜15℃ ・ 日数 36 ・ 値段 900円（資料に数値の記載なし） |
| p37-1 | 香川 オリーブ新漬け | 塩 3〜5% ・ 温度 5〜15℃ ・ 値段 1200円 |
| p38-1 | 愛媛 緋のかぶら漬け | 塩 3〜4% ・ 温度 5〜15℃ ・ 値段 600円 |
| p39-1 | 高知 イタドリの塩蔵 | 塩 15〜20% ・ 温度 5〜15℃ ・ 日数 14 ・ 値段 500円（資料に数値の記載なし） |
| p39-2 | 高知 豆腐の梅酢づけ | 塩 3〜3% ・ 温度 5〜15℃ ・ 値段 800円 |
| p40-1 | 福岡 瀬高の高菜漬け（三池高菜） | 温度 10〜20℃ ・ 値段 600円 |
| p41-1 | 佐賀 おこもじ（高菜・しゃくし菜の塩漬け） | 塩 5〜10% ・ 温度 5〜15℃ ・ 日数 7 ・ 値段 500円 |
| p41-2 | 佐賀 相知高菜漬（文化庁の一覧） | 塩 4〜6% ・ 温度 5〜15℃ ・ 日数 14 ・ 値段 700円（資料に数値の記載なし） |
| p42-1 | 長崎 唐人菜漬け | 塩 2〜3% ・ 温度 5〜15℃ ・ 日数 7 ・ 値段 600円（資料に数値の記載なし） |
| p43-1 | 熊本 阿蘇高菜漬け | 塩 6〜10% ・ 温度 10〜20℃ ・ 値段 600円 |
| p43-2 | 熊本 赤ど漬け | 温度 10〜20℃ ・ 値段 700円 |
| p43-3 | 熊本 寒漬け | 温度 5〜15℃ ・ 値段 1000円 |
| p44-1 | 大分 あゆうるか（にがうるか） | 塩 15〜20% ・ 温度 5〜15℃ ・ 値段 2000円 |
| p45-1 | 宮崎 まだか漬け | 塩 2〜3% ・ 温度 5〜15℃ ・ 値段 400円 |
| p46-1 | 鹿児島 山川漬 | 塩 6〜8% ・ 温度 10〜20℃ ・ 値段 1200円 |
| p46-2 | 鹿児島 パパイヤ漬け（奄美） | 温度 10〜20℃ ・ 値段 800円 |
| p46-3 | 鹿児島 にんにく塩漬（奄美） | 塩 3〜5% ・ 温度 5〜15℃ ・ 日数 7 ・ 値段 700円 |
| p47-1 | 沖縄 スクガラス | 温度 10〜20℃ ・ 値段 1500円 |
| p47-2 | 沖縄 島らっきょうの塩漬け（民間記事） | 温度 2〜6℃ ・ 値段 600円 |

合計 541 件
