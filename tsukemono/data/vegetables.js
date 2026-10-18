// 野菜の定義（段階E）。1件足すだけで、仕入れ・仕込みの窓・図鑑に新しい野菜が出る（樽の中身の絵は assets/img/slot{0..2}_{id}.png）。
// 【出典】= 根拠のある値 / 【仮置き】= 遊びの釣り合いで決めた値（node scripts/placeholders.js で一覧）。
//
// 項目:
//   id, name   : 見出しと表示名
//   water      : 水分量（0〜1）。【出典: 日本食品標準成分表の生の値の目安】多いほど、ぬか床を水っぽくし、塩味が薄まる。干すと減る
//   saltUptake : 塩の入り方（1 = 白菜と同じ）。葉物は早く、かたい根や皮の厚い実は遅い。塩味の回る速さと量に掛ける
//   fermentRate: 漬かる速さ（1 = 白菜と同じ）
//   crisp0, crispTau : 食感の変わり方。漬けはじめの歯ごたえと、やわらかくなるまでの長さ（大きいほど長くポリポリ）
//   spoilMult  : 傷みやすさ
//   cost       : 6個分の仕入れ値（円）
//   seasons    : 季節ごとの値段の倍率（1未満が旬）
//   contract   : 農家と契約しないと仕入れられない { cost, level, farmer }
//   region     : 地方の食材。その地方を「地方の枠」に入れると取り寄せられる（全国の漬物。data/regional.js）
//   only       : この季節にしか出回らない（それ以外は仕入れられない）
//   img        : 樽の中身の絵（専用の絵がなければ、似た野菜の絵を使う）
//   fish       : 魚（とても傷みやすい）
//   note       : 説明

export const VEGETABLES = [
  { id: 'hakusai', name: '白菜', water: 0.952, saltUptake: 1.0, fermentRate: 1.0, crisp0: 80, crispTau: 20, spoilMult: 1.0, cost: 500, seasons: { spring: 1.1, summer: 1.3, autumn: 0.9, winter: 0.7 }, note: '葉が重なり、塩がよく回る' }, // fermentRate は【出典】基準、ほかは【仮置き】
  { id: 'kyuri', name: 'きゅうり', water: 0.954, saltUptake: 1.0, fermentRate: 1.1, crisp0: 95, crispTau: 8, spoilMult: 1.3, cost: 300, seasons: { spring: 1.0, summer: 0.7, autumn: 1.1, winter: 1.4 }, note: 'シャキシャキだが早くやわらかくなる' }, // 【仮置き】
  { id: 'daikon', name: '大根', water: 0.946, saltUptake: 0.8, fermentRate: 0.8, crisp0: 90, crispTau: 80, spoilMult: 0.8, cost: 400, seasons: { spring: 1.1, summer: 1.4, autumn: 0.9, winter: 0.7 }, note: 'かたく、ゆっくり漬かる。長く漬けてもポリポリ（冬が旬、たくあんの仕込み時期）' }, // 【仮置き】
  { id: 'nozawana', name: '野沢菜', water: 0.94, saltUptake: 1.15, fermentRate: 1.0, crisp0: 85, crispTau: 15, spoilMult: 1.0, cost: 450, seasons: { spring: 1.2, summer: 1.5, autumn: 0.9, winter: 0.7 }, note: '葉物で塩の入りが早い（晩秋〜冬）' }, // 【仮置き】
  { id: 'nasu', name: 'なす', water: 0.932, saltUptake: 0.9, fermentRate: 1.1, crisp0: 70, crispTau: 10, spoilMult: 1.2, cost: 350, seasons: { spring: 1.2, summer: 0.7, autumn: 0.9, winter: 1.5 }, note: '皮があって塩の入りは少し遅い。やわらかめ（夏〜秋）' }, // 【仮置き】
  { id: 'kabu', name: 'かぶ', water: 0.939, saltUptake: 1.05, fermentRate: 1.1, crisp0: 85, crispTau: 12, spoilMult: 1.1, cost: 300, seasons: { spring: 1.0, summer: 1.3, autumn: 0.8, winter: 0.8 }, note: 'やわらかく、早く漬かる（秋〜冬）' }, // 【仮置き】
  { id: 'akakabu', name: '赤かぶ', water: 0.92, saltUptake: 1.0, fermentRate: 1.1, crisp0: 88, crispTau: 14, spoilMult: 1.1, cost: 400, seasons: { spring: 1.1, summer: 1.4, autumn: 0.8, winter: 0.8 }, contract: { cost: 3000, level: 2, farmer: '山あいの赤かぶ農家' }, note: '色が鮮やか。契約農家から（秋〜冬）' }, // 【仮置き】
  { id: 'ninjin', name: 'にんじん', water: 0.891, saltUptake: 0.8, fermentRate: 0.8, crisp0: 90, crispTau: 40, spoilMult: 0.9, cost: 250, seasons: { spring: 1.0, summer: 1.2, autumn: 0.8, winter: 0.9 }, note: '水分が少なめで、かたく、ゆっくり漬かる（秋〜冬）' }, // 【仮置き】
  { id: 'kyabetsu', name: 'キャベツ', water: 0.927, saltUptake: 1.1, fermentRate: 1.1, crisp0: 80, crispTau: 12, spoilMult: 1.1, cost: 300, seasons: { spring: 0.7, summer: 1.0, autumn: 1.1, winter: 1.0 }, note: '葉物で塩の入りが早い（春キャベツ）' }, // 【仮置き】
  // ---- 段階Eで追加 ----
  { id: 'ume', name: '梅', water: 0.904, saltUptake: 0.6, fermentRate: 0.6, crisp0: 60, crispTau: 30, spoilMult: 1.0, cost: 600, seasons: { spring: 1.3, summer: 0.6, autumn: 2.0, winter: 2.0 }, note: '皮がかたく、塩はゆっくり入る。6月ごろの青梅が旬' }, // 【仮置き】
  { id: 'shirouri', name: '白瓜', water: 0.953, saltUptake: 1.0, fermentRate: 1.0, crisp0: 88, crispTau: 18, spoilMult: 1.2, cost: 350, seasons: { spring: 1.3, summer: 0.7, autumn: 1.1, winter: 1.6 }, note: '水分が多い。粕漬け（奈良漬け）の定番（夏）' }, // 【仮置き】
  { id: 'myoga', name: 'みょうが', water: 0.956, saltUptake: 1.2, fermentRate: 1.2, crisp0: 82, crispTau: 10, spoilMult: 1.2, cost: 500, seasons: { spring: 1.4, summer: 0.8, autumn: 0.9, winter: 1.6 }, note: '薄く重なっていて塩がすぐ入る。香りが良い（夏〜秋）' }, // 【仮置き】
  // ---- 段階Fで追加（地方の漬物の材料） ----
  { id: 'suguki', name: 'すぐき菜', water: 0.93, saltUptake: 1.0, fermentRate: 1.0, crisp0: 80, crispTau: 25, spoilMult: 1.0, cost: 600, seasons: { spring: 1.5, summer: 2.0, autumn: 1.0, winter: 0.8 }, contract: { cost: 6000, level: 4, farmer: '上賀茂の農家' }, note: 'かぶの仲間。京都・上賀茂の冬の野菜' }, // 【仮置き】
  { id: 'saba', name: '鯖', water: 0.62, saltUptake: 1.2, fermentRate: 0.5, crisp0: 40, crispTau: 200, spoilMult: 6, cost: 1200, seasons: { spring: 1.1, summer: 1.3, autumn: 0.8, winter: 0.9 }, contract: { cost: 5000, level: 3, farmer: '若狭の漁師' }, fish: true, note: '魚。とても傷みやすいので、たっぷりの塩が要る（水分は約6割）' }, // water は【出典: 食品成分表の目安】、ほかは【仮置き】
  // ---- 全国の漬物の食材（data/prefectures.js の資料より）。地方の枠に入れると取り寄せられる。数値はすべて【仮置き】（水分は成分表の目安） ----
  { id: 'nishin', name: '身欠きニシン', region: '北海道・東北', img: 'saba', fish: true, water: 0.6, saltUptake: 1.1, fermentRate: 0.5, crisp0: 40, crispTau: 200, spoilMult: 3, cost: 1400, seasons: { spring: 1.0, summer: 1.2, autumn: 1.0, winter: 0.8 }, note: '干したニシン。アク抜きしてから漬ける' }, // 【仮置き】
  { id: 'gyoja', name: '行者にんにく', region: '北海道・東北', img: 'nozawana', only: ['spring', 'summer'], water: 0.88, saltUptake: 1.1, fermentRate: 1.0, crisp0: 80, crispTau: 15, spoilMult: 1.0, cost: 1200, seasons: { spring: 0.8, summer: 1.1, autumn: 2, winter: 2 }, note: '山菜。春〜夏しか採れない' }, // 【仮置き】
  { id: 'masu', name: 'マス', region: '北海道・東北', img: 'saba', fish: true, water: 0.72, saltUptake: 1.1, fermentRate: 0.6, crisp0: 40, crispTau: 200, spoilMult: 5, cost: 1300, seasons: { spring: 1.0, summer: 0.9, autumn: 0.9, winter: 1.2 }, note: '酢と酒で生ぐさみを取る' }, // 【仮置き】
  { id: 'seisai', name: '山形青菜', region: '北海道・東北', img: 'nozawana', water: 0.92, saltUptake: 1.15, fermentRate: 1.0, crisp0: 85, crispTau: 15, spoilMult: 1.0, cost: 450, seasons: { spring: 1.4, summer: 1.8, autumn: 0.8, winter: 0.9 }, note: '大きな葉の高菜の仲間。天日で干してから漬ける' }, // 【仮置き】
  { id: 'sanma', name: 'サンマ', region: '関東', img: 'saba', fish: true, water: 0.56, saltUptake: 1.1, fermentRate: 0.6, crisp0: 40, crispTau: 200, spoilMult: 6, cost: 900, seasons: { spring: 1.6, summer: 1.3, autumn: 0.6, winter: 1.0 }, note: '秋の魚。丸のまま塩漬けして発酵させる' }, // 【仮置き】
  { id: 'aotogarashi', name: '日光唐辛子', region: '関東', img: 'ninjin', only: ['summer', 'autumn'], water: 0.86, saltUptake: 0.8, fermentRate: 0.7, crisp0: 75, crispTau: 60, spoilMult: 0.8, cost: 700, seasons: { spring: 2, summer: 0.8, autumn: 1.0, winter: 2 }, note: '細長い唐辛子。夏、青いうちに収穫する' }, // 【仮置き】
  { id: 'shakushina', name: 'しゃくし菜', region: '関東', img: 'nozawana', water: 0.94, saltUptake: 1.1, fermentRate: 1.0, crisp0: 85, crispTau: 18, spoilMult: 1.0, cost: 400, seasons: { spring: 1.4, summer: 1.8, autumn: 0.8, winter: 0.9 }, note: '秩父の菜。しゃもじのような形の葉' }, // 【仮置き】
  { id: 'buri', name: 'ブリ', region: '北陸・甲信・岐阜', img: 'saba', fish: true, water: 0.6, saltUptake: 1.0, fermentRate: 0.5, crisp0: 40, crispTau: 200, spoilMult: 5, cost: 2000, seasons: { spring: 1.3, summer: 1.6, autumn: 1.0, winter: 0.7 }, note: '寒ブリ。強めの塩で漬けてから、かぶで挟む' }, // 【仮置き】
  { id: 'narusawana', name: '鳴沢菜', region: '北陸・甲信・岐阜', img: 'nozawana', water: 0.93, saltUptake: 1.1, fermentRate: 1.0, crisp0: 85, crispTau: 15, spoilMult: 1.0, cost: 400, seasons: { spring: 1.4, summer: 1.8, autumn: 0.8, winter: 0.9 }, note: '富士山のふもとの菜' }, // 【仮置き】
  { id: 'koume', name: '甲州小梅', region: '北陸・甲信・岐阜', img: 'ume', only: ['spring', 'summer'], water: 0.9, saltUptake: 0.65, fermentRate: 0.6, crisp0: 80, crispTau: 40, spoilMult: 1.0, cost: 700, seasons: { spring: 0.9, summer: 0.7, autumn: 2, winter: 2 }, note: 'カリカリの小さな梅' }, // 【仮置き】
  { id: 'wasabi', name: 'わさび', region: '東海・近畿', img: 'nozawana', water: 0.74, saltUptake: 1.0, fermentRate: 0.8, crisp0: 70, crispTau: 30, spoilMult: 1.0, cost: 1800, seasons: { spring: 0.9, summer: 1.1, autumn: 1.0, winter: 1.0 }, note: '茎と根を刻む。密封すると辛くなる' }, // 【仮置き】
  { id: 'mizukakena', name: '水かけ菜', region: '東海・近畿', img: 'nozawana', only: ['winter', 'spring'], water: 0.93, saltUptake: 1.15, fermentRate: 1.1, crisp0: 82, crispTau: 12, spoilMult: 1.1, cost: 450, seasons: { spring: 0.8, summer: 2, autumn: 2, winter: 0.9 }, note: '冬に湧き水をかけて育てる菜' }, // 【仮置き】
  { id: 'moriguchi', name: '守口大根', region: '東海・近畿', img: 'daikon', water: 0.9, saltUptake: 0.7, fermentRate: 0.6, crisp0: 92, crispTau: 120, spoilMult: 0.7, cost: 900, seasons: { spring: 1.3, summer: 1.6, autumn: 0.9, winter: 0.8 }, note: '長さ1mを超える細い大根' }, // 【仮置き】
  { id: 'yatsugashira', name: '八つ頭の茎', region: '東海・近畿', img: 'akakabu', only: ['summer', 'autumn'], water: 0.94, saltUptake: 1.1, fermentRate: 1.1, crisp0: 75, crispTau: 12, spoilMult: 1.3, cost: 450, seasons: { spring: 2, summer: 1.0, autumn: 0.8, winter: 2 }, note: '里芋の仲間の茎（ずいき）' }, // 【仮置き】
  { id: 'hinona', name: '日野菜', region: '東海・近畿', img: 'akakabu', water: 0.92, saltUptake: 1.0, fermentRate: 1.0, crisp0: 88, crispTau: 25, spoilMult: 1.0, cost: 500, seasons: { spring: 1.3, summer: 1.8, autumn: 0.9, winter: 0.8 }, note: '根の上が紅い細長いかぶ' }, // 【仮置き】
  { id: 'shogoin', name: '聖護院かぶ', region: '東海・近畿', img: 'kabu', only: ['autumn', 'winter'], water: 0.94, saltUptake: 1.05, fermentRate: 1.1, crisp0: 85, crispTau: 12, spoilMult: 1.1, cost: 600, seasons: { spring: 2, summer: 2, autumn: 1.0, winter: 0.8 }, note: '大きなかぶ。千枚漬けの冬の主役' }, // 【仮置き】
  { id: 'mizunasu', name: '泉州水なす', region: '東海・近畿', img: 'nasu', only: ['spring', 'summer', 'autumn'], water: 0.95, saltUptake: 0.95, fermentRate: 1.2, crisp0: 75, crispTau: 8, spoilMult: 1.3, cost: 900, seasons: { spring: 1.2, summer: 0.8, autumn: 1.0, winter: 2 }, note: '絞ると水がしたたる、甘いなす' }, // 【仮置き】
  { id: 'harumana', name: '下北春まな', region: '東海・近畿', img: 'nozawana', only: ['spring'], water: 0.93, saltUptake: 1.1, fermentRate: 1.0, crisp0: 82, crispTau: 15, spoilMult: 1.0, cost: 800, seasons: { spring: 1.0, summer: 2, autumn: 2, winter: 2 }, note: '下北山村だけの菜。収穫は約2か月だけ' }, // 【仮置き】
  { id: 'tsudakabu', name: '津田かぶ', region: '中国・四国', img: 'akakabu', only: ['autumn', 'winter'], water: 0.93, saltUptake: 1.0, fermentRate: 1.0, crisp0: 86, crispTau: 20, spoilMult: 1.0, cost: 500, seasons: { spring: 2, summer: 2, autumn: 1.0, winter: 0.8 }, note: '勾玉の形をした紅いかぶ' }, // 【仮置き】
  { id: 'mamakari', name: 'ママカリ', region: '中国・四国', img: 'saba', fish: true, water: 0.68, saltUptake: 1.2, fermentRate: 0.8, crisp0: 40, crispTau: 200, spoilMult: 5, cost: 900, seasons: { spring: 1.2, summer: 1.0, autumn: 0.8, winter: 1.2 }, note: '小さな魚。ご飯を借りに行くほどうまい' }, // 【仮置き】
  { id: 'hiroshimana', name: '広島菜', region: '中国・四国', img: 'nozawana', only: ['autumn', 'winter'], water: 0.93, saltUptake: 1.1, fermentRate: 1.0, crisp0: 85, crispTau: 18, spoilMult: 1.0, cost: 450, seasons: { spring: 2, summer: 2, autumn: 0.9, winter: 0.8 }, note: '大きく広がる冬の菜' }, // 【仮置き】
  { id: 'wakame', name: 'わかめ', region: '中国・四国', img: 'nozawana', only: ['winter', 'spring'], water: 0.9, saltUptake: 1.2, fermentRate: 0.8, crisp0: 60, crispTau: 30, spoilMult: 1.2, cost: 500, seasons: { spring: 0.8, summer: 2, autumn: 2, winter: 1.0 }, note: '海藻。野菜とはちがう系統' }, // 【仮置き】
  { id: 'chorogi', name: 'チョロギ', region: '中国・四国', img: 'ume', only: ['autumn', 'winter'], water: 0.8, saltUptake: 0.9, fermentRate: 0.8, crisp0: 85, crispTau: 40, spoilMult: 0.9, cost: 900, seasons: { spring: 2, summer: 2, autumn: 1.0, winter: 0.9 }, note: '巻き貝のような根。おせちの赤い縁起物' }, // 【仮置き】
  { id: 'olive', name: 'オリーブの実', region: '中国・四国', img: 'ume', only: ['autumn'], water: 0.75, saltUptake: 0.7, fermentRate: 0.5, crisp0: 70, crispTau: 60, spoilMult: 0.8, cost: 1500, seasons: { spring: 2, summer: 2, autumn: 1.0, winter: 2 }, note: '緑の実。渋を抜いてから塩水へ' }, // 【仮置き】
  { id: 'hikabura', name: '緋のかぶら', region: '中国・四国', img: 'akakabu', only: ['autumn', 'winter'], water: 0.92, saltUptake: 1.0, fermentRate: 1.0, crisp0: 86, crispTau: 18, spoilMult: 1.0, cost: 500, seasons: { spring: 2, summer: 2, autumn: 0.9, winter: 0.8 }, note: '皮も中も緋色のかぶ' }, // 【仮置き】
  { id: 'itadori', name: 'イタドリ', region: '中国・四国', img: 'akakabu', only: ['spring'], water: 0.95, saltUptake: 1.1, fermentRate: 1.0, crisp0: 80, crispTau: 20, spoilMult: 1.0, cost: 400, seasons: { spring: 0.8, summer: 2, autumn: 2, winter: 2 }, note: '春の山菜。すっぱい茎' }, // 【仮置き】
  { id: 'takana', name: '高菜', region: '九州・沖縄', img: 'nozawana', only: ['winter', 'spring'], water: 0.92, saltUptake: 1.1, fermentRate: 1.0, crisp0: 85, crispTau: 20, spoilMult: 1.0, cost: 400, seasons: { spring: 0.8, summer: 2, autumn: 2, winter: 1.0 }, note: '春の高菜。古漬けにすると酸味が育つ' }, // 【仮置き】
  { id: 'tojinna', name: '唐人菜', region: '九州・沖縄', img: 'hakusai', only: ['autumn', 'winter'], water: 0.95, saltUptake: 1.1, fermentRate: 1.0, crisp0: 80, crispTau: 18, spoilMult: 1.0, cost: 450, seasons: { spring: 2, summer: 2, autumn: 1.0, winter: 0.8 }, note: '長崎の白菜の仲間' }, // 【仮置き】
  { id: 'akado', name: '赤ど芋の茎', region: '九州・沖縄', img: 'akakabu', only: ['autumn'], water: 0.94, saltUptake: 1.1, fermentRate: 1.1, crisp0: 75, crispTau: 12, spoilMult: 1.2, cost: 450, seasons: { spring: 2, summer: 2, autumn: 1.0, winter: 2 }, note: '赤い芋の茎。漬けると汁が赤くなる' }, // 【仮置き】
  { id: 'ayu', name: 'アユ', region: '九州・沖縄', img: 'saba', fish: true, only: ['summer', 'autumn'], water: 0.77, saltUptake: 1.2, fermentRate: 0.8, crisp0: 40, crispTau: 200, spoilMult: 5, cost: 1500, seasons: { spring: 2, summer: 0.9, autumn: 1.0, winter: 2 }, note: '川の魚。内臓は苦くてうまい' }, // 【仮置き】
  { id: 'papaya', name: '青パパイヤ', region: '九州・沖縄', img: 'shirouri', only: ['summer', 'autumn'], water: 0.89, saltUptake: 0.9, fermentRate: 0.9, crisp0: 85, crispTau: 40, spoilMult: 1.0, cost: 600, seasons: { spring: 2, summer: 0.9, autumn: 1.0, winter: 2 }, note: '南の島の、熟す前の実' }, // 【仮置き】
  { id: 'suku', name: 'スク（アイゴの稚魚）', region: '九州・沖縄', img: 'saba', fish: true, only: ['summer'], water: 0.75, saltUptake: 1.3, fermentRate: 0.6, crisp0: 40, crispTau: 200, spoilMult: 6, cost: 1600, seasons: { spring: 2, summer: 1.0, autumn: 2, winter: 2 }, note: '夏の初めに群れで来る小さな魚' }, // 【仮置き】
  { id: 'shimarakkyo', name: '島らっきょう', region: '九州・沖縄', img: 'daikon', only: ['winter', 'spring'], water: 0.83, saltUptake: 1.0, fermentRate: 1.0, crisp0: 85, crispTau: 30, spoilMult: 0.9, cost: 700, seasons: { spring: 0.9, summer: 2, autumn: 2, winter: 1.0 }, note: '細くて辛みの強いらっきょう' }, // 【仮置き】
  // 地方を問わない食材
  { id: 'rakkyo', name: 'らっきょう', img: 'daikon', only: ['spring', 'summer'], water: 0.68, saltUptake: 0.9, fermentRate: 0.9, crisp0: 90, crispTau: 50, spoilMult: 0.9, cost: 600, seasons: { spring: 0.8, summer: 1.0, autumn: 2, winter: 2 }, note: '5〜6月が収穫。シャキシャキ' }, // 【仮置き】
  { id: 'iwashi', name: 'イワシ', img: 'saba', fish: true, water: 0.69, saltUptake: 1.2, fermentRate: 0.7, crisp0: 40, crispTau: 200, spoilMult: 6, cost: 600, seasons: { spring: 0.9, summer: 1.0, autumn: 0.9, winter: 1.1 }, note: '大漁の魚。すぐ保存しないと傷む' }, // 【仮置き】
  { id: 'ninniku', name: 'にんにく', img: 'daikon', water: 0.64, saltUptake: 0.8, fermentRate: 0.7, crisp0: 80, crispTau: 60, spoilMult: 0.7, cost: 700, seasons: { spring: 1.0, summer: 0.9, autumn: 1.1, winter: 1.2 }, note: '皮をむいて塩をまぶす' }, // 【仮置き】
  { id: 'tofu', name: '木綿豆腐', img: 'daikon', water: 0.86, saltUptake: 1.0, fermentRate: 0.8, crisp0: 30, crispTau: 100, spoilMult: 1.5, cost: 300, seasons: { spring: 1, summer: 1, autumn: 1, winter: 1 }, note: '水切りして、炭火で焼いてから' }, // 【仮置き】
];

/** 定義の一覧から { vegetables, priceBySeason } を作る。id がかぶったり、必須の項目が抜けていればエラー。 */
export function vegetablesFrom(defs) {
  const vegetables = {}, priceBySeason = {};
  for (const d of defs) {
    for (const k of ['id', 'name', 'water', 'saltUptake', 'fermentRate', 'crisp0', 'crispTau', 'spoilMult', 'cost']) if (d[k] == null) throw new Error(`野菜の定義 ${d.id ?? '?'}: ${k} がない`);
    if (vegetables[d.id]) throw new Error(`野菜の定義 ${d.id}: id がかぶっている`);
    const { id, seasons, ...rest } = d;
    vegetables[id] = rest;
    if (seasons) priceBySeason[id] = { ...seasons };
  }
  return { vegetables, priceBySeason };
}
