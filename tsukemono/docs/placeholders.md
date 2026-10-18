# 仮置きの一覧

`src/config.js` と `data/` で【仮置き】とコメントした値（出典がなく、遊びの釣り合いで決めたもの）。`node scripts/placeholders.js > docs/placeholders.md` で作り直せる。

## src/config.js

| 行 | 項目 | 値 | 理由・メモ |
| --- | --- | --- | --- |
| 28 | taste.acidHalfProgress | `7` |  |
| 30 | taste.saltAbsorbTauDays | `0.5` | 1日でほぼ（86%）回る |
| 31 | taste.saltFullPct | `6` | 回りきった塩分6%で塩味100（3%なら50） |
| 34 | taste.complexityLowSlope | `0.02` | 18℃から1℃下がるごとに-2% |
| 35 | taste.complexityHighSlope | `0.04` | 22℃から1℃上がるごとに-4%（高温の急速発酵は単調） |
| 36 | taste.complexityMinFactor | `0.15` | 下限 |
| 44 | spoil.basePerDay | `0.01` | 3%・20℃で7日 → 約7% |
| 45 | spoil.saltTable | `[[1, 8], [2, 3], [3, 1], [5, 0.3], [10, 0.05], [20, 0]]` |  |
| 46 | spoil.tempTable | `[[4, 0.1], [10, 0.3], [20, 1], [25, 2.5], [30, 5], [40, 10]]` |  |
| 51 | texture.spoilPenalty | `0.5` | 傷み100%で食感が半分に |
| 61 | vegetables.hakusai.crisp0 | `80, crispTau: 20` |  |
| 62 | vegetables.hakusai.spoilMult | `1.0` |  |
| 63 | vegetables.hakusai.cost | `500` | 1樽分の仕入れ値(円) |
| 67 | vegetables.kyuri.fermentRate | `1.1` |  |
| 68 | vegetables.kyuri.crisp0 | `95, crispTau: 8` | シャキシャキだが早く柔らかくなる |
| 69 | vegetables.kyuri.spoilMult | `1.3` |  |
| 70 | vegetables.kyuri.cost | `300` |  |
| 75 | vegetables.daikon.fermentRate | `0.8` | かたく、ゆっくり漬かる |
| 76 | vegetables.daikon.crisp0 | `90, crispTau: 80` | 長く漬けてもポリポリ（たくあん） |
| 77 | vegetables.daikon.spoilMult | `0.8` |  |
| 78 | vegetables.daikon.cost | `400` |  |
| 82 | vegetables.nozawana.fermentRate | `1.0` |  |
| 83 | vegetables.nozawana.crisp0 | `85, crispTau: 15` |  |
| 84 | vegetables.nozawana.spoilMult | `1.0` |  |
| 85 | vegetables.nozawana.cost | `450` |  |
| 89 | vegetables.nasu.fermentRate | `1.1` |  |
| 90 | vegetables.nasu.crisp0 | `70, crispTau: 10` | やわらかめ |
| 91 | vegetables.nasu.spoilMult | `1.2` |  |
| 92 | vegetables.nasu.cost | `350` |  |
| 96 | vegetables.kabu.fermentRate | `1.1` | やわらかく、早く漬かる |
| 97 | vegetables.kabu.crisp0 | `85, crispTau: 12` |  |
| 98 | vegetables.kabu.spoilMult | `1.1` |  |
| 99 | vegetables.kabu.cost | `300` |  |
| 103 | vegetables.ninjin.fermentRate | `0.8` | かたく、ゆっくり漬かる |
| 104 | vegetables.ninjin.crisp0 | `90, crispTau: 40` | 長くポリポリ |
| 105 | vegetables.ninjin.spoilMult | `0.9` |  |
| 106 | vegetables.ninjin.cost | `250` |  |
| 110 | vegetables.kyabetsu.fermentRate | `1.1` |  |
| 111 | vegetables.kyabetsu.crisp0 | `80, crispTau: 12` |  |
| 112 | vegetables.kyabetsu.spoilMult | `1.1` |  |
| 113 | vegetables.kyabetsu.cost | `300` |  |
| 132 | additives.shoga | `{ name: '生姜', cost: 50, complexity: 10, salt: 0, acid: 0, spoil: 0.9 }` | さっぱり・日持ちを少し良く |
| 133 | additives.akajiso | `{ name: '赤しそ', cost: 70, complexity: 12, salt: 0, acid: 4, spoil: 0…` | 香りと色 |
| 134 | additives.karashi | `{ name: 'からし', cost: 40, complexity: 9, salt: 0, acid: 0, spoil: 0.…` | ぬか床に入れると傷みにくい |
| 135 | additives.sakekasu | `{ name: '酒粕', cost: 90, complexity: 16, salt: -4, acid: -3, spoil: 1 }` | まろやかでコクが出る（粕漬け） |
| 140 | affinityBadPenalty | `15` |  |
| 141 | affinitySatBonus | `6` | 相性の良い調味1つにつき、どのお客の満足度も+6（悪いと−6） |
| 142 | affinityNeutralFactor | `0.5` |  |
| 195 | care.filmPerDay | `[[4, 0.008], [10, 0.05], [20, 0.08], [25, 0.12], [30, 0.15], [40, 0…` | 量は |
| 196 | care.filmVisible | `0.3` | これ以上で「白い膜」が見える（4℃では約37日） |
| 197 | care.filmHarmless | `0.15` | これ未満は味に響かない |
| 198 | care.filmSatPenalty | `0.5` | 膜が一面に張ると満足度×0.5 |
| 199 | care.filmComplexityPenalty | `0.4` | 膜が一面に張ると風味の深さ×0.6 |
| 204 | nuka.startSalt | `7` | ぬか床の塩分% |
| 205 | nuka.minSalt | `4, maxSalt: 12` |  |
| 206 | nuka.saltLossPerBatch | `0.3` | ぬか漬けを1樽漬けるごとに床の塩分が減る |
| 207 | nuka.sourPerDay | `[[4, 0.02], [10, 0.06], [20, 0.1], [25, 0.12], [26, 0.2], [30, 0.3]…` | かき混ぜないと1日に増える酸味（26℃以上で急に増える） |
| 208 | nuka.lowSaltSourBoost | `0.05` | 塩分が1%下がるごとに酸味の増え方+5% |
| 209 | nuka.stirSourDrop | `0.35` | かき混ぜると酸味がこれだけ下がる |
| 210 | nuka.addSaltPct | `1, addSaltCost: 10, addSaltSourDrop: 0.25` | 塩を足す（出典: 塩を足すと酸味が和らぐ） |
| 211 | nuka.sourAcidBoost | `40` | 床の酸味1でぬか漬けの酸味+40 |
| 212 | nuka.matureDays | `14` | 毎日かき混ぜて14日で熟成度が最大 |
| 219 | sales.portionsPerBatch | `6` | 1樽の標準の個数（仕込みで個数を選ばなければこの数。費用はこの数ぶんの仕入れ値） |
| 220 | sales.barrelCapacity | `60` | 1樽に仕込める最大の個数（たくさん仕込んで長く売れる。売れ残ると酸っぱくなる） |
| 221 | sales.satScale | `1.7` | 好みとのズレ(重み付き平均)×この値を100から引く |
| 222 | sales.stageFactor | `{ raw: 1, ripe: 1, over: 0.92, sour: 0.7 }` | 過熟・酸っぱすぎは満足度に掛ける（rawは別途、未熟の式で下げる） |
| 223 | sales.likeBonus | `8` | 好きな種類の漬物なら満足度+8 |
| 224 | sales.unripeMinFactor | `0.5` | 未熟だと満足度に 0.5〜1.0 を掛ける |
| 225 | sales.spoilSatPenalty | `0.8` | 傷みリスク100%で満足度×0.2（期待値） |
| 226 | sales.buyThreshold | `40` | 満足度がこれ未満なら買わない |
| 228 | sales.priceMin | `0.6, priceMax: 1.3` |  |
| 229 | sales.saltCostPerPct | `10` | 塩代: 塩分1%あたり(円) |
| 230 | sales.startMoney | `2000` |  |
| 237 | calendar.ticksPerDay | `4` | 1日=4区切り（朝・昼・夕・夜） |
| 238 | calendar.daysPerSeason | `28` |  |

## data/pickles.js

| 行 | 項目 | 値 | 理由・メモ |
| --- | --- | --- | --- |
| 28 | asazuke.tempHint | `'5〜20℃'` | 冷蔵〜室温の短期 |
| 29 | asazuke.temp | `{ lo: 5, hi: 20 }` |  |
| 31 | asazuke.window | `{ lo: 0.5, hi: 3, sour: 5 }` | 日持ちは数日 |
| 32 | asazuke.complexityMax | `35` | 浅漬けは風味が単純 |
| 33 | asazuke.price | `250` | 1個(円) |
| 44 | hakusaizuke.salt | `{ lo: 2.5, hi: 3.5 }` | 出典は3%のみ |
| 45 | hakusaizuke.tempHint | `'5〜20℃'` |  |
| 46 | hakusaizuke.temp | `{ lo: 5, hi: 20 }` |  |
| 48 | hakusaizuke.window | `{ lo: 0.85, hi: 1.3, sour: 1.8 }` | 6〜9日が食べ頃、約12.6日で酸っぱすぎ |
| 49 | hakusaizuke.complexityMax | `85` | 調味（昆布など）でさらに深くなる余地を残す |
| 50 | hakusaizuke.price | `500` |  |
| 66 | nukazuke.ripeAt | `0.8` | きゅうりを20〜25℃の床で一晩〜1日 |
| 67 | nukazuke.window | `{ lo: 0.5, hi: 2, sour: 3.5 }` |  |
| 68 | nukazuke.saltUptake | `0.4` | 野菜が吸う塩はぬか床の塩分の一部だけ |
| 69 | nukazuke.complexityMax | `80` | 床の熟成度で 40%〜100% になる |
| 70 | nukazuke.price | `300` |  |
| 81 | takuan.saltHint | `'4〜8%（長く置くなら多め）'` | 出典は「干し日数と出荷時期で塩を変える」のみ |
| 82 | takuan.salt | `{ lo: 4, hi: 8 }` |  |
| 83 | takuan.tempHint | `'寒い時期（5〜15℃）'` | 冬の仕込み |
| 84 | takuan.temp | `{ lo: 5, hi: 15 }` |  |
| 85 | takuan.ripeAt | `20` | 出典は「約1か月以上」。大根は漬かりが遅い（×0.8）ので、塩5%・室22℃で約36日 |
| 86 | takuan.window | `{ lo: 0.9, hi: 4, sour: 6 }` | 長く置ける |
| 87 | takuan.acidHalfProgress | `20` | 長く漬けても酸っぱくなりにくい（食べ頃で酸味50） |
| 88 | takuan.complexityMax | `80` | ざらめ・唐辛子・昆布で深まる |
| 89 | takuan.price | `900` | 長く寝かせるぶん高い |
| 90 | takuan.portions | `18` | 大きな樽で一度にたくさん漬ける（ふつうは6個） |
| 104 | nozawanazuke.tempHint | `'寒い所（0〜10℃）'` | 出典は「寒い時期」 |
| 105 | nozawanazuke.temp | `{ lo: 0, hi: 10 }` |  |
| 106 | nozawanazuke.ripeAt | `3` | 出典は「2〜3週間で食べられる」（寒い時期）。冬の屋外（8℃）で約10日、土間（3℃）で約1か月 |
| 107 | nozawanazuke.window | `{ lo: 0.8, hi: 2, sour: 3 }` |  |
| 108 | nozawanazuke.complexityMax | `70` |  |
| 109 | nozawanazuke.price | `450` |  |

合計 107 件
