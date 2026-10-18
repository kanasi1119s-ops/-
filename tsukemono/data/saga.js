// 本編の物語「最強の漬物への道」。馬鹿らしいことを、どこまでも真剣に語る。
// 章は条件（when）がそろうと、順に始まる。章を足せば物語が伸びる。【仮置き】条件・課題・ごほうびの数値
//
// 項目:
//   id     : 見出し（セーブのキー）
//   no     : 章の番号（表示）  title : 題
//   after  : この章を見たあとでないと始まらない（物語の順番）
//   when   : 始まる条件。day（何日目から）/ level（店のレベル）/ learnedAny（作り方をひとつ成功させた）
//            / nukaMaturity（ぬか床の熟成度）/ reformed（難癖のお客が改心した）/ questWon / questLost（課題の勝ち負け）
//   lines  : 語り。{ who, text } の who がなければ地の文
//   quest  : この章で始まる課題。{ id, name, days, kind, need, target, retryAfter }
//            kind: greatGuests = 満足 need.sat 以上のお客を target 人 / agedSale = 寝かせ値打ち need.aging 以上で売る
//                  variety = 違う漬物 target 種を、それぞれ満足 need.sat 以上で売る
//   reward : { rep, money, xp }
//   repeat : 負けた章は、課題をやり直すたびに何度でも見る

export const SAGA = [
  {
    id: 'prologue', no: '序章', title: '遺言', when: { day: 1 },
    lines: [
      { text: '先代は、店を譲るその日に言った。' },
      { who: '先代', text: 'この店には、代々受け継がれてきた使命がある。' },
      { who: '先代', text: '――最強の漬物を作れ。' },
      { text: '「最強って、何ですか」と聞いた。先代は遠い目をして答えた。' },
      { who: '先代', text: 'それを探すのが、おまえの道じゃ。' },
      { text: 'そう言い残すと、先代は温泉旅行に出かけた。帰りの日付は、書いていなかった。' },
      { text: '置き手紙には、こうあった。「ぬか床は毎日かき混ぜること。冷蔵庫のプリンは食べないこと」' },
      { text: '最強の漬物への道が、いま始まる。' },
    ],
  },
  {
    id: 'umai', no: '第一章', title: '三文字', after: 'prologue', when: { learnedAny: true },
    lines: [
      { text: 'お客が、言った。' },
      { who: 'お客', text: 'うまい。' },
      { text: 'たった三文字。だが人は、この三文字のために塩を量り、樽を洗い、重石を持ち上げるのだ。' },
      { text: 'その夜、店主は樽に向かって小さく頭を下げた。' },
      { text: '樽は何も言わなかった。樽だからである。' },
    ],
    reward: { xp: 10 },
  },
  {
    id: 'rival', no: '第二章', title: '宿敵', after: 'umai', when: { level: 2, day: 4 },
    lines: [
      { text: 'その朝、町に激震が走った。' },
      { text: '向かいの空き地に、金色の看板が立ったのである。――「漬物帝国」。' },
      { text: '店先には、マントをはためかせた人物がいた。' },
      { who: '漬物男爵', text: '我が名は漬物男爵。この町の漬物は、すべて我が帝国がいただく。' },
      { who: '町内会長', text: '…まあ、漬物屋が二軒あるのは良いことじゃないかね。' },
      { who: '漬物男爵', text: '…それは、良いことかもしれない。' },
      { text: '宿敵は、思ったより話のわかる相手だった。だが、戦いの予感だけは確かにあった。' },
    ],
  },
  {
    id: 'nuka', no: '幕間', title: 'ぬか床は語る', after: 'prologue', when: { nukaMaturity: 1 },
    lines: [
      { text: '毎日かき混ぜ続けて、ついにぬか床が熟した夜。夢を見た。' },
      { who: 'ぬか床', text: '……ありがとう。' },
      { text: '「しゃべった！」' },
      { who: 'ぬか床', text: 'しゃべってはいない。夢だから。' },
      { who: 'ぬか床', text: '最強の漬物とは、塩でも、樽でも、重石でもない。それは――' },
      { text: 'そこで目が覚めた。店主は生まれて初めて、目覚まし時計を本気で恨んだ。' },
    ],
    reward: { rep: 2 },
  },
  {
    id: 'challenge', no: '第三章', title: '矢文', after: 'rival', when: { level: 3, day: 10 },
    lines: [
      { text: '店の戸に、矢文が刺さっていた。（危ないので、矢文はやめてほしい）' },
      { who: '漬物男爵', text: '七日後、町内会館にて漬物対決を申し込む。審査員長は、町内会長の猫・タマ殿である。' },
      { text: '猫が、審査員長。正気か。' },
      { text: 'だが、勝負は勝負である。店主は静かに、重石を持ち上げた。特に意味はない。気合いである。' },
    ],
    quest: { id: 'battle1', name: '漬物対決（タマ殿の審査）', days: 7, kind: 'greatGuests', need: { sat: 80 }, target: 5, retryAfter: 7 },
  },
  {
    id: 'battle1Win', no: '第三章', title: '猫は見ていた', after: 'challenge', when: { questWon: 'battle1' },
    lines: [
      { text: '町内会館。張りつめた空気の中、二つの皿が並べられた。' },
      { text: 'タマ殿は、男爵の皿の匂いをかぎ、こちらの皿の匂いをかぎ――こちらの皿の横で、丸くなった。' },
      { text: '勝敗の基準は、誰にもわからない。だが、勝ちは勝ちである。' },
      { who: '漬物男爵', text: '……次は、負けぬ。' },
      { text: '賞品は、町内会の商品券だった。' },
    ],
    reward: { rep: 5, money: 3000, xp: 30 },
  },
  {
    id: 'battle1Lose', no: '第三章', title: '猫は寝ていた', after: 'challenge', when: { questLost: 'battle1' }, repeat: true,
    lines: [
      { text: 'タマ殿は、両方の皿を無視して、窓辺で寝た。' },
      { who: '漬物男爵', text: 'ふはは！ 勝負あったな！' },
      { who: '町内会長', text: '…いや、どっちも負けじゃないかね。' },
      { text: '男爵は、少し泣いた。七日後、もう一度勝負することになった。' },
    ],
  },
  {
    id: 'confession', no: '幕間', title: '雇われ難癖', after: 'rival', when: { reformed: true },
    lines: [
      { text: '改心した元・難癖のお客が、ある日ぽつりと言った。' },
      { who: '元・難癖のお客', text: '…実はな。あの難癖、漬物男爵に頼まれていたんだ。' },
      { text: '衝撃の真実である。' },
      { who: '元・難癖のお客', text: '日給は、漬物三切れだった。' },
      { text: 'なお、その漬物はおいしかったらしい。それがまた、悔しかったらしい。' },
    ],
    reward: { rep: 3 },
  },
  {
    id: 'stone', no: '第四章', title: '伝説の重石', after: 'battle1Win', when: { level: 5, day: 28 },
    lines: [
      { who: '町内会長', text: '裏山の頂に、「天下一の重石」が祀られておる。それに認められた者だけが、最強の漬物にたどり着けるという。' },
      { text: '店主は山に登った。三時間かかった。祠の中にあったのは、ただの石だった。' },
      { text: '「ただの石じゃないか」' },
      { text: '石には、こう刻まれていた。「重石とは、待つ心の重さなり」' },
      { text: 'その下には、小さく貼り紙。「この石は持ち帰らないでください　町役場」' },
      { text: '待つ心。――店主は山を下りた。寝かせた漬物で、答えを出すために。' },
    ],
    quest: { id: 'aged', name: '待つ心（寝かせた漬物を売る）', days: 90, kind: 'agedSale', need: { aging: 1.15 }, target: 1, retryAfter: 3 },
  },
  {
    id: 'stoneLose', no: '第四章', title: '石は黙して', after: 'stone', when: { questLost: 'aged' }, repeat: true,
    lines: [
      { text: '季節がめぐった。だが、寝かせた漬物は、まだ店先に並んでいない。' },
      { text: '裏山の石は、何も言わなかった。石だからである。' },
      { text: '待つ心は、待っているだけでは身につかないらしい。店主は、もう一度樽に向かった。' },
    ],
  },
  {
    id: 'stoneDone', no: '第四章', title: '待つ心', after: 'stone', when: { questWon: 'aged' },
    lines: [
      { text: '寝かせに寝かせた漬物を、お客がひと口かじった。' },
      { text: '何も言わなかった。ただ、静かにご飯をおかわりした。' },
      { text: 'その夜、裏山のほうから「ゴトッ」と音がしたという。重石が、認めたのかもしれない。たぶん、風である。' },
    ],
    reward: { rep: 5, xp: 50 },
  },
  {
    id: 'final', no: '第五章', title: '最終決戦', after: 'stoneDone', when: { level: 6, day: 45 },
    lines: [
      { who: '漬物男爵', text: 'これが最後の勝負だ。十四日以内に、三種の漬物で審査員をうならせてみせよ。' },
      { text: '審査員長はタマ殿。副審査員長は、タマ殿の子のミケ殿。審査員は増えていた。' },
      { text: 'そして決戦の会場には、もうひとつの影があった。' },
      { who: '？？？', text: '…ふぉっふぉっ。' },
      { text: 'その笑い声には、温泉の香りがした。' },
    ],
    quest: { id: 'battle2', name: '最終決戦（三種の漬物）', days: 14, kind: 'variety', need: { sat: 82 }, target: 3, retryAfter: 7 },
  },
  {
    id: 'finalLose', no: '第五章', title: 'まだ早い', after: 'final', when: { questLost: 'battle2' }, repeat: true,
    lines: [
      { who: '？？？', text: 'まだ早い。…ふぉっふぉっ。' },
      { text: '影は、温泉まんじゅうを置いて去っていった。七日後、もう一度。' },
    ],
  },
  {
    id: 'ending', no: '終章', title: '最強の漬物', after: 'final', when: { questWon: 'battle2' },
    lines: [
      { text: '決戦の席に現れた影。それは、温泉から帰ってきた先代だった。肌がつやつやしていた。' },
      { text: 'そして漬物男爵が、マントを脱いだ。' },
      { who: '漬物男爵', text: '…すまない。先代に頼まれて、宿敵を演じていた。' },
      { who: '先代', text: '温泉仲間じゃ。おまえを鍛えるには、宿敵が要ると思ってのう。' },
      { who: '漬物男爵', text: 'マント代は、自腹だった。' },
      { text: '「では先代。最強の漬物とは、いったい何なんですか」' },
      { text: '先代は、こちらの漬物をひと口食べた。そして黙って、ご飯をおかわりした。' },
      { text: 'それが、答えだった。' },
      { text: '最強の漬物とは、明日もまた食べたくなる漬物のことである。――たぶん。' },
      { text: '（そして店は続く。最強の漬物への道に、終わりはない）' },
    ],
    reward: { rep: 10, money: 10000, xp: 100 },
  },
];
