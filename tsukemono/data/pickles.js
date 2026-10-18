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
//   level       : 挑むのに必要な店のレベル（1 = はじめから）。ひらめいても、レベルが足りなければ仕込めない（二重の鍵）
//   unlock      : 解放の条件（null = はじめから知っている）。段階C:
//                   via   : 'condition'（条件の組み合わせでひらめく）/ 'failure'（失敗から気づく）/ 'taught'（人から教わる。中身は段階G）
//                   hint  : 噂（答えは言わず、ほのめかす）。図鑑の「？？？」の欄に出る
//                   hintLevel: 噂が聞こえてくる店のレベル（省略で1）
//                   when  : 条件（src/unlock.js）。樽の中身がこの組み合わせになると、ひらめく
//                           pickle / veg / additives（全部入っている）/ salt {min,max} / facility（持っている）/ place
//                           season / temp {min,max} / days {min,max} / stage（'raw' 'ripe' 'over' 'sour' 'spoiled'）
//                   line  : ひらめいたときの一言
//   needs       : 仕込むのに要る設備（data/facilities.js の id の配列）
//   praise      : お客のほめ言葉（なくてもよい。満足したお客がときどき言う）
//   drying      : 干してから漬ける（段階E）。{ max, ideal: [lo, hi], default }: 干す日数（そのあいだ樽はふさがる）。干すと食感・塩味が締まり、傷みにくい
//   umezu       : 梅酢に浸す漬物（梅干し。段階E）。梅が梅酢から出るとカビやすい。重石を直して沈め、カビは清潔なスプーンで取る
//   region      : 地方の漬物（段階F）。店のレベルで開く「地方の枠」にその地方（資料の6地方）を入れると挑める。prefecture = 都道府県、ref = 資料 data/prefectures.js の id
//   saltFree    : 塩を使わない（すんき）。starter = 種にする漬物の id（前の樽から種を取り分け、次の樽に使う）
//   smoking     : 燻してから漬ける（いぶりがっこ）。{ woods: { id: { name, flavor } }, max, ideal: [lo, hi], default }
//   place       : 決まった置き場所で漬ける（すぐき漬けは加温室）。bestTemp: 風味がいちばん深くなる温度 [lo, hi]
//   seasonal    : 季節をまたいで熟成する（へしこ）。温度は置き場所の温度の、それまでの平均になる
//   spoilMult   : 漬物ごとの傷みやすさ（種や乳酸菌が傷みをおさえる）
//   aging       : 寝かせると値打ちが上がる（段階D）。{ from, full, max }: 進み/ripeAt が from から full まで寝かせると、売り値が最大 ×(1+max)
//   affinity    : 調味との相性（good / bad。書いてなければふつう）
//   そのほか    : portions（標準の個数）、usesNukaBed（ぬか床を使う）、saltUptake、acidHalfProgress、film（白い膜が出る）、top（樽の中身の絵）

import { workFrom } from './work.js';

export const PICKLES = [
  {
    id: 'asazuke',
    name: '浅漬け',
    vegetables: ['hakusai', 'kyuri', 'nasu', 'daikon', 'kabu', 'kyabetsu', 'ninjin', 'akakabu', 'shirouri', 'myoga', 'suguki'],
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
    weight: true, // 重石を選ぶ（重石と工程）。水が上がったら軽くするのが良い
    level: 1,
    unlock: null,
    affinity: { kombu: 'good', togarashi: 'good', yuzu: 'good', shoga: 'good', sakekasu: 'bad' },
  },
  {
    id: 'nukazuke',
    name: 'ぬか漬け',
    vegetables: ['kyuri', 'hakusai', 'nasu', 'daikon', 'kabu', 'ninjin', 'akakabu', 'shirouri', 'myoga'],
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
    weight: true, // 大根はかたいので、重いままでもつぶれにくい
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
    drying: { max: 14, ideal: [5, 10], default: 7 }, // 【仮置き】出典は「干してから塩漬け」。干す日数（1〜2週間ほど、の字に曲がるまで）
    aging: { from: 1.3, full: 3, max: 0.5 }, // 【仮置き】寝かせるほど高く売れる
    affinity: { zarame: 'good', togarashi: 'good', kombu: 'good', yuzu: 'bad', sakekasu: 'good', akajiso: 'bad' },
  },
  {
    id: 'nozawanazuke',
    ref: 'p20-1', // 資料の長野の野沢菜漬（はじめから作れる）
    name: '野沢菜漬',
    vegetables: ['nozawana'],
    steps: ['野沢菜を洗う', '塩と唐辛子で漬ける', '重石をして寒い所で2〜3週間'],
    weight: true, // 【出典】資料 p20-1「重石の付け替えと水上がりの判断」
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

  {
    id: 'umeboshi',
    ref: 'p30-1', // 資料の和歌山の梅干し
    name: '梅干し',
    vegetables: ['ume'],
    steps: ['青梅を洗い、へたを取る', '塩をまぶして壺に漬ける（梅酢が上がる）', '梅が梅酢に浸かるよう重石を直す', '約1か月（表面にカビが出たら清潔なスプーンで取る）', '夏の土用の晴れた日に3日干す（土用干し）'],
    work: [['doyoboshi', 20, 200]], // 土用干し（夏の晴れた日に。やらなくてもよい）
    saltHint: '15〜20%（減塩なら10%ほど。傷みやすくなる）', // 【出典】伝統的な梅干しは18〜20%前後
    salt: { lo: 15, hi: 20 }, // 【仮置き】
    tempHint: '冷暗所（15〜25℃）', // 【仮置き】
    temp: { lo: 15, hi: 25 }, // 【仮置き】
    ripeAt: 1.6, // 【仮置き】塩18%・20℃で約1か月
    window: { lo: 0.8, hi: 30, sour: 60 }, // 【仮置き】ほぼ傷まず、いつまでも置ける
    acidHalfProgress: 0.3, // 【仮置き】梅はもともと酸っぱい
    saltUptake: 0.4, // 【仮置き】塩分は高いが、感じる塩味は果肉の酸味でやわらぐ（梅の塩の入り方0.6と合わせて、18%で塩味75ほど）
    complexityMax: 75, // 【仮置き】
    price: 150, // 【仮置き】1粒より少し多めの1包み
    portions: 24, // 【仮置き】壺いっぱいに漬ける
    needs: ['tsubo'], // 壺がいる（店のレベル2で買える）
    umezu: true,
    film: true, // 梅酢から出るとカビ（白い膜と同じ扱いで、清潔なスプーンで取る）
    top: 'ume',
    level: 1,
    unlock: null,
    aging: { from: 1, full: 12, max: 1.0 }, // 【仮置き】古い梅干しほど値打ちがある
    praise: ['すっぱーい！ …でも、ご飯がすすむ', 'これぞ梅干し。おばあちゃん家の味', '一粒で白いご飯が二杯いける'],
    affinity: { akajiso: 'good', kombu: 'good', zarame: 'good', karashi: 'bad', sakekasu: 'bad', togarashi: 'bad' },
  },
  // ---- ここから下は、はじめは知らない作り方（段階C）。図鑑に「？？？」で載り、条件が合うとひらめく ----
  {
    id: 'karashizuke',
    name: 'からし漬け',
    vegetables: ['nasu', 'kyuri', 'kabu'],
    steps: ['小なすを塩で下漬けする', 'からし・砂糖・酒を合わせた床に漬ける', '数日でツンとくる'],
    saltHint: '2〜4%', // 【仮置き】
    salt: { lo: 2, hi: 4 }, // 【仮置き】
    tempHint: '5〜20℃', // 【仮置き】
    temp: { lo: 5, hi: 20 }, // 【仮置き】
    ripeAt: 2, // 【仮置き】数日
    window: { lo: 0.7, hi: 2.5, sour: 4 }, // 【仮置き】
    complexityMax: 60, // 【仮置き】
    price: 400, // 【仮置き】
    level: 2,
    unlock: {
      via: 'condition',
      hint: '「ツンとくる黄色いのと、なすを合わせた漬物があるらしい。鼻にくるけど飯が止まらんとか」— 常連のおじいさん（なぜか涙目）',
      when: { veg: ['nasu'], additives: ['karashi'], days: { min: 1 } },
      line: 'ツーン！…鼻に抜けるこの辛さ。なすとからし、これは合う！（涙が止まらない）',
    },
    praise: ['ツーン！…でも、もうひと口！', '鼻にきた！ 目にもきた！ うまい！', 'ご飯が足りなくなるやつだ'],
    affinity: { karashi: 'good', zarame: 'good', sakekasu: 'good', yuzu: 'bad', akajiso: 'bad' },
  },
  {
    id: 'shibazuke',
    ref: 'p26-2', // 資料の京都のしば漬け
    name: '柴漬け',
    vegetables: ['nasu', 'kyuri', 'myoga'],
    steps: ['なすときゅうりを刻む', '赤しそと塩で漬ける', '重石をして乳酸発酵させる', '黒い汁を捨てる'],
    work: [['drain', 2, 4]], // 【出典】資料 p26-2「黒い汁を捨てる判断」。日は【仮置き】
    saltHint: '3〜5%', // 【仮置き】
    salt: { lo: 3, hi: 5 }, // 【仮置き】
    tempHint: '15〜25℃（夏）', // 【仮置き】夏の仕込み
    temp: { lo: 15, hi: 25 }, // 【仮置き】
    ripeAt: 6, // 【仮置き】乳酸発酵で1週間ほど
    window: { lo: 0.8, hi: 2.5, sour: 4 }, // 【仮置き】
    complexityMax: 75, // 【仮置き】
    price: 550, // 【仮置き】
    level: 2,
    unlock: {
      via: 'condition',
      hint: '「山里では、夏のなすが赤い葉っぱと一緒に寝ると、紫に染まって酸っぱくなるそうだ」— 八百屋のおやじ（その山里には行ったことがない）',
      when: { veg: ['nasu'], additives: ['akajiso'], season: ['summer'], days: { min: 2 } },
      line: 'なすが赤しそで紫に染まっていく…。この色、この香り。ひらめいた！',
    },
    praise: ['わあ、きれいな紫色！', 'このすっぱさ、夏って感じ', 'お茶漬けにのせたい'],
    affinity: { akajiso: 'good', shoga: 'good', zarame: 'bad', sakekasu: 'bad' },
  },
  {
    id: 'furuzuke',
    name: '古漬け',
    vegetables: ['hakusai', 'nozawana', 'daikon', 'kyuri'],
    steps: ['しっかり塩で漬ける', '酸っぱくなるまで長く置く', '刻んで生姜と和える（かくや）'],
    saltHint: '4〜7%', // 【仮置き】
    salt: { lo: 4, hi: 7 }, // 【仮置き】
    tempHint: '0〜15℃', // 【仮置き】
    temp: { lo: 0, hi: 15 }, // 【仮置き】
    ripeAt: 10, // 【仮置き】
    window: { lo: 0.8, hi: 5, sour: 8 }, // 【仮置き】酸っぱいのが持ち味なので長く置ける
    acidHalfProgress: 3, // 【仮置き】早く酸っぱくなる（食べ頃で酸味が強い）
    complexityMax: 70, // 【仮置き】
    price: 350, // 【仮置き】
    level: 2,
    unlock: {
      via: 'failure',
      hint: '「酸っぱくなった漬物を捨てるうちは、まだ半人前」— 知らないおばあさん（言うだけ言って帰った）',
      when: { stage: ['sour'] },
      line: '酸っぱくなりすぎた…。捨てようとしたら、どこからか「刻んで生姜と和えなされ」という声が。…うまい！',
    },
    praise: ['この酸っぱさ、ばあちゃんの味だ…', '刻んで生姜で…わかってるねぇ', '捨てなくてよかったねぇ'],
    aging: { from: 1.5, full: 4, max: 0.3 }, // 【仮置き】寝かせるほど高く売れる
    affinity: { shoga: 'good', togarashi: 'good', kombu: 'good', zarame: 'bad', yuzu: 'bad' },
  },
  {
    id: 'kasuzuke',
    name: '粕漬け',
    vegetables: ['kyuri', 'daikon', 'ninjin', 'kabu', 'shirouri'],
    steps: ['野菜を塩で下漬けして水を抜く', '酒粕に漬け替える', '涼しい所でじっくり数週間'],
    saltHint: '3〜6%（下漬け）', // 【仮置き】
    salt: { lo: 3, hi: 6 }, // 【仮置き】
    tempHint: '涼しい所（5〜15℃）', // 【仮置き】
    temp: { lo: 5, hi: 15 }, // 【仮置き】
    ripeAt: 14, // 【仮置き】
    window: { lo: 0.9, hi: 4, sour: 6 }, // 【仮置き】
    acidHalfProgress: 20, // 【仮置き】酸っぱくなりにくい
    complexityMax: 90, // 【仮置き】
    price: 800, // 【仮置き】
    level: 3,
    unlock: {
      via: 'condition',
      hint: '「酒蔵の残り物に野菜を涼しい所で長〜く寝かせると、大人の味になるんだって」— 酒屋の奥さん（ほんのり赤い顔）',
      when: { additives: ['sakekasu'], temp: { max: 15 }, days: { min: 10 } },
      line: '樽を開けたら、ふわっと酒の香り…（ちょっと酔った）。これは大人の漬物だ！',
    },
    praise: ['これは晩酌が進んじゃう', 'ふわっと酒の香り…（運転はしません）', '大人の味だねぇ'],
    aging: { from: 1.2, full: 3, max: 0.6 }, // 【仮置き】寝かせるほど高く売れる
    affinity: { sakekasu: 'good', zarame: 'good', kombu: 'good', yuzu: 'bad', akajiso: 'bad' },
  },

  // ---- 地方の漬物（段階F）。特殊なルールを持つ。解放は段階Cの仕組み（ひらめき＋店のレベル＋地方の枠） ----
  {
    id: 'sunki',
    name: 'すんき',
    region: '北陸・甲信・岐阜', prefecture: '長野', ref: 'p20-2', // 資料 data/prefectures.js の id
    vegetables: ['akakabu'],
    steps: ['赤かぶの茎と葉を湯通しする', '前の年のすんき（種）と交互に樽に詰める', '重石をして、寒い所で約1か月', '塩は使わない'],
    saltFree: true, // 塩を使わない（乳酸発酵だけで漬ける）
    starter: 'sunki', // 前の樽のすんきを種にする
    saltHint: '塩は使わない（種で漬ける）', // 【出典】
    salt: { lo: 0, hi: 0 },
    tempHint: '寒い所（0〜10℃）', // 【出典】は「低温」。数値は【仮置き】
    temp: { lo: 0, hi: 10 }, // 【仮置き】
    ripeAt: 6, // 【仮置き】5℃で約1か月
    window: { lo: 0.8, hi: 2.5, sour: 4 }, // 【仮置き】
    acidHalfProgress: 3, // 【仮置き】乳酸でしっかり酸っぱい
    spoilMult: 0.05, // 【仮置き】種の乳酸菌が、塩のかわりに傷みをおさえる
    complexityMax: 80, // 【仮置き】
    price: 700, // 【仮置き】
    level: 3,
    unlock: {
      via: 'condition',
      hint: '「塩を使わないで漬ける山の保存食があるらしい。秋から冬、塩を控えた赤い葉っぱが、山奥でだけ酸っぱくなるとか」— 富山の薬売り（本業は薬）',
      when: { veg: ['akakabu'], salt: { max: 1 }, season: ['autumn', 'winter'], days: { min: 3 } },
      line: '塩を控えた赤かぶを見つめていると、小包が届いた。差出人は「木曽のおばあさん」。中には去年のすんきと、達筆な手紙。「種じゃ。絶やすでないぞ」',
    },
    praise: ['塩がないのに、この酸っぱさ…！', '体にしみる味だ', 'そばにのせたい（すんきそば）'],
    affinity: { kombu: 'good', togarashi: 'good', zarame: 'bad', sakekasu: 'bad', yuzu: 'bad' },
  },
  {
    id: 'iburigakko',
    name: 'いぶりがっこ',
    region: '北海道・東北', prefecture: '秋田', ref: 'p05-1',
    vegetables: ['daikon'],
    steps: ['大根を囲炉裏の上で薪で燻して干す（4〜5日）', '米ぬか・塩・ざらめで漬ける', '冬の冷気で2か月以上'],
    smoking: { woods: { nara: { name: 'ナラ', flavor: 1.0 }, sakura: { name: 'サクラ', flavor: 1.15 }, kunugi: { name: 'クヌギ', flavor: 0.9 } }, max: 8, ideal: [4, 5], default: 4 }, // 日数は【出典】4〜5日、香りの差は【仮置き】
    needs: ['kunsei'],
    saltHint: '5〜8%（米ぬか・ざらめと）', // 【仮置き】
    salt: { lo: 5, hi: 8 }, // 【仮置き】
    tempHint: '冬の冷気（0〜10℃）', // 【出典】は「冬の冷気」。数値は【仮置き】
    temp: { lo: 0, hi: 10 }, // 【仮置き】
    ripeAt: 3.8, // 【仮置き】塩6%・5℃で約2か月
    window: { lo: 0.9, hi: 3, sour: 5 }, // 【仮置き】
    acidHalfProgress: 15, // 【仮置き】
    complexityMax: 70, // 【仮置き】燻すと最大 ×1.5
    price: 1100, // 【仮置き】
    portions: 12, // 【仮置き】
    top: 'takuan',
    level: 5,
    unlock: {
      via: 'condition',
      hint: '「北の国では、大根を煙でいぶしてから漬けるそうな。冬の囲炉裏は、ただの暖房ではないらしい」— 旅の写真家（写真は全部ぶれている）',
      when: { veg: ['daikon'], facility: 'kunsei', season: ['autumn', 'winter'], days: { min: 1 } },
      line: '燻製小屋の前で大根を漬けていたら、煙が大根にまとわりついて離れない。…大根が「いぶして」と言っている。言っていない。でも、そう聞こえた。',
    },
    aging: { from: 1.2, full: 3, max: 0.4 }, // 【仮置き】
    praise: ['このスモーキーさ…クリームチーズと合わせたい', 'ポリポリで香ばしい！', '酒が止まらなくなるやつだ'],
    affinity: { zarame: 'good', kombu: 'good', togarashi: 'good', yuzu: 'bad', akajiso: 'bad' },
  },
  {
    id: 'sugukizuke',
    name: 'すぐき漬け',
    region: '東海・近畿', prefecture: '京都', ref: 'p26-3',
    vegetables: ['suguki'],
    steps: ['下漬け（塩をまぶして一晩）', '本漬け（天秤押しで重石をかける）', '室入れ（加温室で約40℃、1週間ほど発酵）', '半月ほどで食べられる'],
    place: 'kaon', // 加温室で漬ける（温度を選べる）
    needs: ['kaon'],
    bestTemp: [38, 42], // 【出典】は「約40℃」。幅は【仮置き】
    saltHint: '3〜4%', // 【仮置き】
    salt: { lo: 3, hi: 4 }, // 【仮置き】
    tempHint: '加温室で約40℃（温度管理が主役）', // 【出典】
    temp: { lo: 38, hi: 42 },
    ripeAt: 40, // 【仮置き】塩3.5%・40℃で約15日
    window: { lo: 0.85, hi: 1.3, sour: 1.8 }, // 【仮置き】食べ頃は短い
    spoilMult: 0.06, // 【仮置き】高温を好む乳酸菌が、ほかの菌をおさえる
    complexityMax: 85, // 【仮置き】
    price: 1000, // 【仮置き】
    level: 4,
    unlock: {
      via: 'condition',
      hint: '「都の北では、菜っ葉を40℃の部屋で寝かせて酸っぱくするらしい。お風呂より少しぬるいくらい」— 京都帰りの近所の人（お土産は八つ橋）',
      when: { veg: ['suguki'], place: ['kaon'], days: { min: 2 } },
      line: '加温室の扉を開けた瞬間、むわっと酸っぱい香り。すぐき菜が、ほんのり黄金色に染まっていた。…これが、都の味か。',
    },
    praise: ['この酸味、上品だねぇ', 'ご飯にのせて、お茶漬けに…', '京都に行った気分になれる'],
    affinity: { yuzu: 'good', kombu: 'good', togarashi: 'good', zarame: 'bad', sakekasu: 'bad' },
  },
  {
    id: 'heshiko',
    name: 'へしこ',
    region: '北陸・甲信・岐阜', prefecture: '福井', ref: 'p18-1',
    vegetables: ['saba'],
    steps: ['鯖をたっぷりの塩で下漬け（約1週間）', '米ぬかに漬け替える（本漬け）', '季節をまたいで約1年熟成'],
    seasonal: true, // 季節をまたいで熟成。夏の暑さで傷みやすい
    saltHint: '10〜20%（魚なので多め。少ないと傷む）', // 【仮置き】
    salt: { lo: 10, hi: 20 }, // 【仮置き】
    tempHint: '置き場所の温度で（夏の暑さに注意）', // 【仮置き】
    temp: { lo: 0, hi: 20 }, // 【仮置き】
    ripeAt: 5, // 【仮置き】塩15%・土間で約1年（1年 = 112日）
    window: { lo: 0.8, hi: 3, sour: 5 }, // 【仮置き】
    acidHalfProgress: 10, // 【仮置き】
    saltUptake: 0.18, // 【仮置き】感じる塩味（ぬかでやわらぐ。塩15%で塩味80ほど）
    complexityMax: 95, // 【仮置き】長い熟成で旨味が深い
    price: 1500, // 【仮置き】
    portions: 12, // 【仮置き】
    level: 3,
    unlock: {
      via: 'condition',
      hint: '「港町では、魚をぬかに一年漬けるという。待つのが仕事、という人たちがいるのだ」— 若狭の漁師（ぬか床を見て目を細めた）',
      when: { pickle: ['nukazuke'], contract: 'saba', days: { min: 2 } },
      line: 'ぬか床をかき混ぜていたら、若狭の漁師の言葉がよみがえった。「ぬかは、魚も待てる」。…この床に、鯖を一年。正気か。正気である。',
    },
    aging: { from: 1, full: 2.5, max: 0.6 }, // 【仮置き】
    praise: ['少しあぶって、お茶漬けに…最高', '酒の肴の王様だ', '一年待った味がする'],
    affinity: { togarashi: 'good', sakekasu: 'good', kombu: 'good', yuzu: 'bad', zarame: 'bad' },
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
    const u = d.unlock;
    if (u) {
      if (!['condition', 'failure', 'taught', 'letter'].includes(u.via)) throw new Error(`漬物の定義 ${d.id}: unlock.via は condition / failure / taught / letter`);
      if (!['taught', 'letter'].includes(u.via) && !u.when) throw new Error(`漬物の定義 ${d.id}: unlock.when がない`);
      if (!u.hint) throw new Error(`漬物の定義 ${d.id}: unlock.hint がない`);
    }
    const { id, affinity: aff = {}, ...rest } = d;
    pickles[id] = { level: 1, unlock: null, steps: [], needs: [], ...rest, work: workFrom(rest.work, id) };
    affinity[id] = { ...aff };
  }
  return { pickles, affinity };
}
