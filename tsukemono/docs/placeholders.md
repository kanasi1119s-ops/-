# 仮置きの一覧

`src/config.js` と `data/` で【仮置き】とコメントした値（出典がなく、遊びの釣り合いで決めたもの）。`node scripts/placeholders.js > docs/placeholders.md` で作り直せる。

## src/config.js

| 行 | 項目 | 値 | 理由・メモ |
| --- | --- | --- | --- |
| 31 | taste.acidHalfProgress | `7` |  |
| 33 | taste.saltAbsorbTauDays | `0.5` | 1日でほぼ（86%）回る |
| 34 | taste.saltFullPct | `6` | 回りきった塩分6%で塩味100（3%なら50） |
| 37 | taste.complexityLowSlope | `0.02` | 18℃から1℃下がるごとに-2% |
| 38 | taste.complexityHighSlope | `0.04` | 22℃から1℃上がるごとに-4%（高温の急速発酵は単調） |
| 39 | taste.complexityMinFactor | `0.15` | 下限 |
| 47 | spoil.basePerDay | `0.01` | 3%・20℃で7日 → 約7% |
| 48 | spoil.saltTable | `[[1, 8], [2, 3], [3, 1], [5, 0.3], [10, 0.05], [20, 0]]` |  |
| 49 | spoil.tempTable | `[[4, 0.1], [10, 0.3], [20, 1], [25, 2.5], [30, 5], [40, 10]]` |  |
| 54 | texture.spoilPenalty | `0.5` | 傷み100%で食感が半分に |
| 64 | vegetables.hakusai.crisp0 | `80, crispTau: 20` |  |
| 65 | vegetables.hakusai.spoilMult | `1.0` |  |
| 66 | vegetables.hakusai.cost | `500` | 1樽分の仕入れ値(円) |
| 70 | vegetables.kyuri.fermentRate | `1.1` |  |
| 71 | vegetables.kyuri.crisp0 | `95, crispTau: 8` | シャキシャキだが早く柔らかくなる |
| 72 | vegetables.kyuri.spoilMult | `1.3` |  |
| 73 | vegetables.kyuri.cost | `300` |  |
| 78 | vegetables.daikon.fermentRate | `0.8` | かたく、ゆっくり漬かる |
| 79 | vegetables.daikon.crisp0 | `90, crispTau: 80` | 長く漬けてもポリポリ（たくあん） |
| 80 | vegetables.daikon.spoilMult | `0.8` |  |
| 81 | vegetables.daikon.cost | `400` |  |
| 85 | vegetables.nozawana.fermentRate | `1.0` |  |
| 86 | vegetables.nozawana.crisp0 | `85, crispTau: 15` |  |
| 87 | vegetables.nozawana.spoilMult | `1.0` |  |
| 88 | vegetables.nozawana.cost | `450` |  |
| 92 | vegetables.nasu.fermentRate | `1.1` |  |
| 93 | vegetables.nasu.crisp0 | `70, crispTau: 10` | やわらかめ |
| 94 | vegetables.nasu.spoilMult | `1.2` |  |
| 95 | vegetables.nasu.cost | `350` |  |
| 99 | vegetables.kabu.fermentRate | `1.1` | やわらかく、早く漬かる |
| 100 | vegetables.kabu.crisp0 | `85, crispTau: 12` |  |
| 101 | vegetables.kabu.spoilMult | `1.1` |  |
| 102 | vegetables.kabu.cost | `300` |  |
| 106 | vegetables.ninjin.fermentRate | `0.8` | かたく、ゆっくり漬かる |
| 107 | vegetables.ninjin.crisp0 | `90, crispTau: 40` | 長くポリポリ |
| 108 | vegetables.ninjin.spoilMult | `0.9` |  |
| 109 | vegetables.ninjin.cost | `250` |  |
| 113 | vegetables.kyabetsu.fermentRate | `1.1` |  |
| 114 | vegetables.kyabetsu.crisp0 | `80, crispTau: 12` |  |
| 115 | vegetables.kyabetsu.spoilMult | `1.1` |  |
| 116 | vegetables.kyabetsu.cost | `300` |  |
| 135 | additives.shoga | `{ name: '生姜', cost: 50, complexity: 10, salt: 0, acid: 0, spoil: 0.9 }` | さっぱり・日持ちを少し良く |
| 136 | additives.akajiso | `{ name: '赤しそ', cost: 70, complexity: 12, salt: 0, acid: 4, spoil: 0…` | 香りと色 |
| 137 | additives.karashi | `{ name: 'からし', cost: 40, complexity: 9, salt: 0, acid: 0, spoil: 0.…` | ぬか床に入れると傷みにくい |
| 138 | additives.sakekasu | `{ name: '酒粕', cost: 90, complexity: 16, salt: -4, acid: -3, spoil: 1 }` | まろやかでコクが出る（粕漬け） |
| 143 | affinityBadPenalty | `15` |  |
| 144 | affinitySatBonus | `6` | 相性の良い調味1つにつき、どのお客の満足度も+6（悪いと−6） |
| 145 | affinityNeutralFactor | `0.5` |  |
| 190 | progress.xpPerPiece | `1` | 1個売るごとの経験 |
| 191 | progress.xpGreatSat | `70` | この満足度以上で買われた分は |
| 192 | progress.xpGreatMult | `2` | 経験×2 |
| 193 | progress.xpNewBook | `5` | 図鑑に新しい組み合わせが載ったとき |
| 194 | progress.xpInspire | `20` | ひらめいたとき |
| 195 | progress.xpFirstSuccess | `30` | 作り方を初めて成功させたとき（図鑑が埋まる） |
| 196 | progress.successSat | `60` | 1つの樽で、買ったお客の誰か1人でもこの満足度以上なら「成功」（うまいと言わせた） |
| 197 | progress.masterAfter | `10` | 成功10樽で腕前が最大 |
| 198 | progress.masterComplexity | `0.15` | 腕前が最大なら風味の深さ×1.15（作り方を磨くと品質が上がる） |
| 199 | progress.masterTexture | `0.05` | 腕前が最大なら食感×1.05（扱いが上手になる） |
| 219 | care.filmPerDay | `[[4, 0.008], [10, 0.05], [20, 0.08], [25, 0.12], [30, 0.15], [40, 0…` | 量は |
| 220 | care.filmVisible | `0.3` | これ以上で「白い膜」が見える（4℃では約37日） |
| 221 | care.filmHarmless | `0.15` | これ未満は味に響かない |
| 222 | care.filmSatPenalty | `0.5` | 膜が一面に張ると満足度×0.5 |
| 223 | care.filmComplexityPenalty | `0.4` | 膜が一面に張ると風味の深さ×0.6 |
| 228 | nuka.startSalt | `7` | ぬか床の塩分% |
| 229 | nuka.minSalt | `4, maxSalt: 12` |  |
| 230 | nuka.saltLossPerBatch | `0.3` | ぬか漬けを1樽漬けるごとに床の塩分が減る |
| 231 | nuka.sourPerDay | `[[4, 0.02], [10, 0.06], [20, 0.1], [25, 0.12], [26, 0.2], [30, 0.3]…` | かき混ぜないと1日に増える酸味（26℃以上で急に増える） |
| 232 | nuka.lowSaltSourBoost | `0.05` | 塩分が1%下がるごとに酸味の増え方+5% |
| 233 | nuka.stirSourDrop | `0.35` | かき混ぜると酸味がこれだけ下がる |
| 234 | nuka.sourAcidBoost | `40` | 床の酸味1でぬか漬けの酸味+40 |
| 235 | nuka.matureDays | `14` | 毎日かき混ぜて14日で熟成度が最大 |
| 237 | nuka.waterPerBatch | `0.08` | ぬか漬けを標準の個数ぶん漬けるごとに、野菜から出る水で床が水っぽくなる（個数に比例） |
| 238 | nuka.waterPerDay | `0.01` | 何もしなくても少しずつ水が出る |
| 239 | nuka.waterSourBoost | `0.6` | 水っぽさ1で酸味の増え方×1.6（水分過多は酸っぱくなる原因） |
| 240 | nuka.waterSaltLoss | `0.3` | 水っぽさ1でぬか漬けの塩味×0.7（薄まる） |
| 242 | nuka.rotFilmStart | `0.5, rotPerFilm: 0.35` | 膜が半分を超えると、超えたぶん×0.35/日 |
| 243 | nuka.rotSourStart | `0.6, rotPerSour: 0.35` | 酸味が0.6を超えると、超えたぶん×0.35/日 |
| 244 | nuka.suteEveryDays | `4, rotPerSuteDay: 0.02` | 捨て漬けを4日より長く替えないと、1日ごとに+0.02/日 |
| 245 | nuka.rotStirDrop | `0.05` | かき混ぜると傷みが少し戻る（空気を入れて悪い菌をおさえる） |
| 246 | nuka.rotSpoilBoost | `100` | 傷み1でぬか漬けの傷みリスク+100% |
| 247 | nuka.rotComplexityLoss | `0.5` | 傷み1で風味の深さ×0.5 |
| 248 | nuka.umamiPerDay | `0.02` | 足した旨味は1日に0.02ずつ抜けていく |
| 249 | nuka.umamiComplexityBoost | `0.3` | 旨味1でぬか漬けの風味の深さ×1.3 |
| 256 | sales.portionsPerBatch | `6` | 1樽の標準の個数（仕込みで個数を選ばなければこの数。費用はこの数ぶんの仕入れ値） |
| 257 | sales.barrelCapacity | `60` | 1樽に仕込める最大の個数（たくさん仕込んで長く売れる。売れ残ると酸っぱくなる） |
| 258 | sales.satScale | `1.7` | 好みとのズレ(重み付き平均)×この値を100から引く |
| 259 | sales.stageFactor | `{ raw: 1, ripe: 1, over: 0.92, sour: 0.7 }` | 過熟・酸っぱすぎは満足度に掛ける（rawは別途、未熟の式で下げる） |
| 260 | sales.likeBonus | `8` | 好きな種類の漬物なら満足度+8 |
| 261 | sales.unripeMinFactor | `0.5` | 未熟だと満足度に 0.5〜1.0 を掛ける |
| 262 | sales.spoilSatPenalty | `0.8` | 傷みリスク100%で満足度×0.2（期待値） |
| 263 | sales.buyThreshold | `40` | 満足度がこれ未満なら買わない |
| 265 | sales.priceMin | `0.6, priceMax: 1.3` |  |
| 266 | sales.saltCostPerPct | `10` | 塩代: 塩分1%あたり(円) |
| 267 | sales.startMoney | `10000` | はじめから樽いっぱい（60個）仕込める額 |
| 268 | sales.maxBuy | `4` | 1人が買う数の上限。満足度が buyThreshold から buyStep 上がるごとに1個ずつ増える |
| 269 | sales.buyStep | `15` |  |
| 276 | calendar.ticksPerDay | `4` | 1日=4区切り（朝・昼・夕・夜） |
| 277 | calendar.daysPerSeason | `28` |  |
| 305 | visit.slots | `10` | 1つの時間帯に来るお客の上限（1日5分で、1時間帯に十人ほど） |

## data/claimer.js

| 行 | 項目 | 値 | 理由・メモ |
| --- | --- | --- | --- |
| 52 | — | `{ id: 'apologize', name: '平謝りする', note: 'その場はおさまる。でも相手は調子に乗る', rep:…` |  |
| 53 | — | `{ id: 'omake', name: 'おまけで黙らせる', note: '1個タダで渡す。味をしめてまた来る', piece: …` |  |
| 56 | explain.success | `{ base: 0.2, perLevel: 0.06, perQuality: 0.25, win: { rep: 2, nerve…` |  |
| 59 | — | `{ id: 'regular', name: '常連さんに助け舟を出してもらう', note: 'この時間帯に常連が来ていたら頼める'…` |  |
| 60 | — | `{ id: 'ban', name: '出入り禁止にする', note: '季節がひとつ巡るまで来なくなる。ただし角が立って評判が少し…` |  |
| 64 | — | `export const IGNORE = { id: 'ignore', name: '聞こえないふり', rep: -3, ner…` |  |

## data/facilities.js

| 行 | 項目 | 値 | 理由・メモ |
| --- | --- | --- | --- |
| 15 | — | `{ id: 'outdoor', name: '屋外', cost: 0, level: 1, offset: 3, note: '外…` |  |
| 16 | — | `{ id: 'doma', name: '土間', cost: 0, level: 1, offset: -2, note: '外気温…` |  |
| 17 | — | `{ id: 'fridge', name: '冷蔵庫', cost: 3000, level: 1, fixed: 4, note: …` | 値段は |
| 18 | — | `{ id: 'muro', name: '室（むろ）', cost: 4000, level: 1, fixed: 22, note:…` | 【出典】ザワークラウト18〜22℃。値段は |
| 19 | — | `{ id: 'tsubo', name: '壺', cost: 2000, level: 2, note: '小さな仕込み用の陶器の壺…` |  |
| 20 | — | `{ id: 'kaon', name: '加温室', cost: 12000, level: 4, fixed: 40, note: …` | 【出典】すぐきの室は約40℃。値段は |
| 21 | — | `{ id: 'fuda', name: '品質表示の札', cost: 1500, level: 1, claimer: { expl…` |  |
| 22 | — | `{ id: 'koenote', name: 'お客様の声ノート', cost: 800, level: 1, claimer: { …` |  |
| 23 | — | `{ id: 'manekineko', name: 'にらみ招き猫', cost: 5000, level: 3, claimer: …` |  |
| 24 | — | `{ id: 'kunsei', name: '燻製小屋', cost: 15000, level: 5, note: '薪で燻す小屋（…` |  |

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
| 14 | — | `{ id: 'salt', name: '塩を足す', when: 'sour', cost: 10, effects: { salt…` | 効き目 |
| 15 | — | `{ id: 'karashi', name: 'からしを入れる（大さじ1）', when: 'sour', cost: 40, eff…` |  |
| 16 | — | `{ id: 'egg', name: '卵の殻を入れる', when: 'sour', cost: 0, effects: { sou…` |  |
| 18 | — | `{ id: 'nuka', name: 'ぬかと塩を足す（ぬか1カップに塩小さじ1〜大さじ½）', when: 'water', co…` |  |
| 20 | — | `{ id: 'sute', name: '捨て漬けを替える（キャベツの芯・にんじんの皮）', when: 'rot', cost: 0…` | 効き目 |
| 22 | — | `{ id: 'kombu', name: '昆布', when: 'umami', cost: 60, effects: { umam…` |  |
| 23 | — | `{ id: 'akatogarashi', name: '赤唐辛子', when: 'umami', cost: 30, effect…` |  |
| 24 | — | `{ id: 'niboshi', name: '煮干し', when: 'umami', cost: 50, effects: { u…` |  |
| 25 | — | `{ id: 'sansho', name: '実山椒', when: 'umami', cost: 70, effects: { um…` |  |
| 26 | — | `{ id: 'yuzu', name: 'ゆずの皮', when: 'umami', cost: 80, effects: { uma…` |  |

## data/pickles.js

| 行 | 項目 | 値 | 理由・メモ |
| --- | --- | --- | --- |
| 37 | asazuke.tempHint | `'5〜20℃'` | 冷蔵〜室温の短期 |
| 38 | asazuke.temp | `{ lo: 5, hi: 20 }` |  |
| 40 | asazuke.window | `{ lo: 0.5, hi: 3, sour: 5 }` | 日持ちは数日 |
| 41 | asazuke.complexityMax | `35` | 浅漬けは風味が単純 |
| 42 | asazuke.price | `250` | 1個(円) |
| 53 | hakusaizuke.salt | `{ lo: 2.5, hi: 3.5 }` | 出典は3%のみ |
| 54 | hakusaizuke.tempHint | `'5〜20℃'` |  |
| 55 | hakusaizuke.temp | `{ lo: 5, hi: 20 }` |  |
| 57 | hakusaizuke.window | `{ lo: 0.85, hi: 1.3, sour: 1.8 }` | 6〜9日が食べ頃、約12.6日で酸っぱすぎ |
| 58 | hakusaizuke.complexityMax | `85` | 調味（昆布など）でさらに深くなる余地を残す |
| 59 | hakusaizuke.price | `500` |  |
| 75 | nukazuke.ripeAt | `0.8` | きゅうりを20〜25℃の床で一晩〜1日 |
| 76 | nukazuke.window | `{ lo: 0.5, hi: 2, sour: 3.5 }` |  |
| 77 | nukazuke.saltUptake | `0.4` | 野菜が吸う塩はぬか床の塩分の一部だけ |
| 78 | nukazuke.complexityMax | `80` | 床の熟成度で 40%〜100% になる |
| 79 | nukazuke.price | `300` |  |
| 90 | takuan.saltHint | `'4〜8%（長く置くなら多め）'` | 出典は「干し日数と出荷時期で塩を変える」のみ |
| 91 | takuan.salt | `{ lo: 4, hi: 8 }` |  |
| 92 | takuan.tempHint | `'寒い時期（5〜15℃）'` | 冬の仕込み |
| 93 | takuan.temp | `{ lo: 5, hi: 15 }` |  |
| 94 | takuan.ripeAt | `20` | 出典は「約1か月以上」。大根は漬かりが遅い（×0.8）ので、塩5%・室22℃で約36日 |
| 95 | takuan.window | `{ lo: 0.9, hi: 4, sour: 6 }` | 長く置ける |
| 96 | takuan.acidHalfProgress | `20` | 長く漬けても酸っぱくなりにくい（食べ頃で酸味50） |
| 97 | takuan.complexityMax | `80` | ざらめ・唐辛子・昆布で深まる |
| 98 | takuan.price | `900` | 長く寝かせるぶん高い |
| 99 | takuan.portions | `18` | 大きな樽で一度にたくさん漬ける（ふつうは6個） |
| 113 | nozawanazuke.tempHint | `'寒い所（0〜10℃）'` | 出典は「寒い時期」 |
| 114 | nozawanazuke.temp | `{ lo: 0, hi: 10 }` |  |
| 115 | nozawanazuke.ripeAt | `3` | 出典は「2〜3週間で食べられる」（寒い時期）。冬の屋外（8℃）で約10日、土間（3℃）で約1か月 |
| 116 | nozawanazuke.window | `{ lo: 0.8, hi: 2, sour: 3 }` |  |
| 117 | nozawanazuke.complexityMax | `70` |  |
| 118 | nozawanazuke.price | `450` |  |
| 131 | karashizuke.saltHint | `'2〜4%'` |  |
| 132 | karashizuke.salt | `{ lo: 2, hi: 4 }` |  |
| 133 | karashizuke.tempHint | `'5〜20℃'` |  |
| 134 | karashizuke.temp | `{ lo: 5, hi: 20 }` |  |
| 135 | karashizuke.ripeAt | `2` | 数日 |
| 136 | karashizuke.window | `{ lo: 0.7, hi: 2.5, sour: 4 }` |  |
| 137 | karashizuke.complexityMax | `60` |  |
| 138 | karashizuke.price | `400` |  |
| 154 | shibazuke.saltHint | `'3〜5%'` |  |
| 155 | shibazuke.salt | `{ lo: 3, hi: 5 }` |  |
| 156 | shibazuke.tempHint | `'15〜25℃（夏）'` | 夏の仕込み |
| 157 | shibazuke.temp | `{ lo: 15, hi: 25 }` |  |
| 158 | shibazuke.ripeAt | `6` | 乳酸発酵で1週間ほど |
| 159 | shibazuke.window | `{ lo: 0.8, hi: 2.5, sour: 4 }` |  |
| 160 | shibazuke.complexityMax | `75` |  |
| 161 | shibazuke.price | `550` |  |
| 177 | furuzuke.saltHint | `'4〜7%'` |  |
| 178 | furuzuke.salt | `{ lo: 4, hi: 7 }` |  |
| 179 | furuzuke.tempHint | `'0〜15℃'` |  |
| 180 | furuzuke.temp | `{ lo: 0, hi: 15 }` |  |
| 181 | furuzuke.ripeAt | `10` |  |
| 182 | furuzuke.window | `{ lo: 0.8, hi: 5, sour: 8 }` | 酸っぱいのが持ち味なので長く置ける |
| 183 | furuzuke.acidHalfProgress | `3` | 早く酸っぱくなる（食べ頃で酸味が強い） |
| 184 | furuzuke.complexityMax | `70` |  |
| 185 | furuzuke.price | `350` |  |
| 201 | kasuzuke.saltHint | `'3〜6%（下漬け）'` |  |
| 202 | kasuzuke.salt | `{ lo: 3, hi: 6 }` |  |
| 203 | kasuzuke.tempHint | `'涼しい所（5〜15℃）'` |  |
| 204 | kasuzuke.temp | `{ lo: 5, hi: 15 }` |  |
| 205 | kasuzuke.ripeAt | `14` |  |
| 206 | kasuzuke.window | `{ lo: 0.9, hi: 4, sour: 6 }` |  |
| 207 | kasuzuke.acidHalfProgress | `20` | 酸っぱくなりにくい |
| 208 | kasuzuke.complexityMax | `90` |  |
| 209 | kasuzuke.price | `800` |  |

合計 198 件
