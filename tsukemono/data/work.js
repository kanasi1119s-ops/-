// 工程（重石と工程）。漬けているあいだに、目安の日のうちにやる手仕事。漬物の定義で work: [['工程id', 何日目から, 何日目まで]] と書く。
// 出典: 資料 data/prefectures.js の「game_idea」（下漬けと本漬け・漬け替えで塩分を下げる・汁を捨てる・粕の替え時 など）。
// 効き目の数値は【仮置き】（遊びの釣り合いで決めた値）。
//
// 項目:
//   label : 樽の窓のボタンの文字      note : 説明
//   done  : やったときの効き目（味の値に掛ける。spoil は傷みリスクに掛ける）
//   skip  : やらずに目安を過ぎたときの効き目
//   when  : やれる季節・天気（{ season: [...], weather: [...] }。なければいつでも）
// 早すぎ・遅すぎは src/config.js の work（early・late）が足される。

export const WORK = {
  honzuke: { label: '本漬けに漬け替える', note: '下漬けで水が出たら、新しい漬け床へ。下漬けのままだと塩がきつく、味が浅い', done: {}, skip: { complexity: 0.75, saltiness: 1.2 } }, // 【仮置き】
  tsukekae: { label: '漬け替える（塩を下げる）', note: '塩の多い床から、薄い床へ。替えないとしょっぱいまま', done: { saltiness: 0.75 }, skip: { saltiness: 1.3, complexity: 0.8 } }, // 【仮置き】
  amazu: { label: '甘酢に漬け替える', note: '塩漬けのあと、甘酢へ。替えないと、ただのしょっぱいらっきょう', done: {}, skip: { acid: 0.4, saltiness: 1.4, complexity: 0.7 } }, // 【仮置き】
  nikaeshi: { label: '漬け汁を煮返す', note: '汁を煮立てて、冷まして戻す。傷みにくくなり、味がしみる', done: { spoil: 0.6 }, skip: { spoil: 2, complexity: 0.85 } }, // 【仮置き】
  drain: { label: '汁を捨てる', note: '上がった汁（黒い汁・えぐみ）を捨てる。捨てないとえぐく、酸っぱい', done: {}, skip: { complexity: 0.8, acid: 1.2 } }, // 【仮置き】
  kasu: { label: '粕を替える', note: '古い粕から新しい粕へ。替えるほど、しょっぱさが抜けて深くなる', done: { complexity: 1.05 }, skip: { complexity: 0.8, saltiness: 1.25 } }, // 【仮置き】
  kasane: { label: '魚と野菜を重ねる', note: '下ごしらえした魚と、塩漬けした野菜を、麹と交互に重ねる', done: {}, skip: { complexity: 0.6 } }, // 【仮置き】
  doyoboshi: { label: '土用干しをする', note: '夏の土用の晴れた日に、梅を3日3晩お日さまに当てる。皮がやわらかく、色よく、値打ちが上がる。やらなくても梅漬けとして売れる', when: { season: ['summer'], weather: ['sunny'] }, done: { complexity: 1.15, texture: 1.1, price: 1.2 }, skip: {} }, // 【仮置き】出典: 資料 p14-1「天日干しの天気に左右される」
  hasamu: { label: '魚をかぶで挟む', note: '塩漬けしたかぶに、魚をはさんで麹へ', done: {}, skip: { complexity: 0.6 } }, // 【仮置き】
};

/** 漬物の定義の work（[id, 何日目から, 何日目まで]）を、工程の定義にする */
export function workFrom(list, pickleId = '?') {
  return (list ?? []).map((x) => {
    if (!Array.isArray(x)) return x;
    const [id, lo, hi] = x;
    if (!WORK[id]) throw new Error(`漬物の定義 ${pickleId}: 工程 ${id} がない`);
    if (!(lo >= 0 && hi >= lo)) throw new Error(`漬物の定義 ${pickleId}: 工程 ${id} の日がおかしい`);
    return { id, ...WORK[id], window: [lo, hi] };
  });
}
