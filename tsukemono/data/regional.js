// 全国の漬物を、遊べる漬物の定義にする（資料: data/prefectures.js）。
// 1行 = 1つの漬物。資料の id（ref）から、名前・都道府県・地方・工程・噂の文を取ってくる。
// 数値は、資料の「numbers」にあるものは【出典】（src: true の項目）、ないものは【仮置き】。
// 解放: その地方を「地方の枠」に入れると、ときどき便りで作り方が届く（unlock.via = 'letter'）。行商人も売りに来る。
//
// 行の項目:
//   ref    : 資料の id     key : 漬物の id（セーブのキー）    method : 漬け方（下の METHODS）
//   veg    : 使う食材（data/vegetables.js の id）。最初のものを食べ頃の計算に使う
//   with   : いっしょに要る食材 { id: 個数あたりの割合 }（「仕入れ」で在庫にそろえておく）
//   salt   : [下, 上]（%）    temp : [下, 上]（℃）    days : 食べ頃までの日数（塩・温度の真ん中、最初の食材で）
//   win    : 食べ頃の長さ（short 短い / normal / long 長く置ける / forever ほぼいつまでも）
//   price  : 1個の値段    level : 挑める店のレベル    portions : 標準の個数
//   src    : salt / days / temp のうち資料に数値があるもの（【出典】の印に使う）
//   unknown: 資料に工程・数値の記載がない（数値はすべて仮置き）
//   そのほか data/pickles.js と同じ項目（dry・umezu・needs・aging・place・bestTemp・film・usesNukaBed・labor・starter など）
//
// 日数のものさし: 1年 = 112日（季節4つ × 28日）。2か月までは実際の日数のまま、それより長いものは縮める（REAL_TO_GAME）。

/** 実際の日数 → ゲームの日数（2か月までそのまま、それより長いものは1年が112日になるよう縮める） */
export const REAL_TO_GAME = (d) => (d <= 60 ? d : Math.round(60 + (d - 60) * (52 / 305)));

/** 漬け方ごとの性質【仮置き】 */
export const METHODS = {
  shio: { label: '塩漬け', complexityMax: 70, affinity: { kombu: 'good', togarashi: 'good', zarame: 'bad' } },
  nyusan: { label: '乳酸発酵', complexityMax: 80, acidHalfProgress: 4, affinity: { togarashi: 'good', kombu: 'good', zarame: 'bad' } },
  su: { label: '酢漬け', complexityMax: 55, acidBase: 45, acidHalfProgress: 40, affinity: { kombu: 'good', yuzu: 'good', zarame: 'good', sakekasu: 'bad' } },
  amazu: { label: '甘酢漬け', complexityMax: 55, acidBase: 35, acidHalfProgress: 40, saltUptake: 0.8, affinity: { togarashi: 'good', zarame: 'good', sakekasu: 'bad' } },
  shoyu: { label: '醤油漬け', complexityMax: 72, saltUptake: 0.8, acidHalfProgress: 25, affinity: { kombu: 'good', togarashi: 'good', shoga: 'good', yuzu: 'bad' } },
  koji: { label: '麹漬け', complexityMax: 85, saltUptake: 0.6, acidHalfProgress: 14, affinity: { zarame: 'good', yuzu: 'good', shoga: 'good', karashi: 'bad' } },
  kasu: { label: 'かす漬け', complexityMax: 90, saltUptake: 0.6, acidHalfProgress: 25, affinity: { sakekasu: 'good', zarame: 'good', yuzu: 'bad' } },
  miso: { label: '味噌漬け', complexityMax: 85, saltUptake: 0.7, acidHalfProgress: 25, affinity: { kombu: 'good', togarashi: 'good', yuzu: 'bad' } },
  nuka: { label: 'ぬか漬け', complexityMax: 80, saltUptake: 0.7, affinity: { kombu: 'good', togarashi: 'good', zarame: 'good', yuzu: 'bad' } },
  fish: { label: '魚の漬物', complexityMax: 90, acidHalfProgress: 10, saltUptake: 0.3, affinity: { togarashi: 'good', sakekasu: 'good', zarame: 'bad' } },
};

const SALT_EATEN = 3.5; // 【仮置き】
const MIN_DAYS = 1; // 【仮置き】
const WIN = { short: { lo: 0.6, hi: 2, sour: 3.5 }, normal: { lo: 0.8, hi: 2.5, sour: 4 }, long: { lo: 0.8, hi: 6, sour: 12 }, forever: { lo: 0.8, hi: 20, sour: 40 } };
const COLD = [0, 10], COOL = [5, 15], ROOM = [10, 20], FRIDGE = [2, 6];

export const REGIONAL = [
  // ---- 北海道・東北 ----
  { ref: 'p01-1', key: 'nishinzuke', method: 'koji', veg: ['daikon', 'kyabetsu'], with: { nishin: 0.3 }, salt: [3, 5], temp: COLD, days: 30, src: ['days'], win: 'normal', price: 1200, level: 3, work: [['kasane', 1, 3]] },
  { ref: 'p01-2', key: 'gyojazuke', method: 'shoyu', veg: ['gyoja'], salt: [2, 4], temp: COOL, days: 1, src: ['days'], win: 'long', price: 900, level: 3 },
  { ref: 'p02-1', key: 'aomorisenmai', method: 'su', veg: ['akakabu'], salt: [3, 3], temp: COLD, days: 14, src: ['salt', 'days'], win: 'normal', price: 600, level: 3, weight: true, work: [['honzuke', 2, 4]] },
  { ref: 'p02-2', key: 'kyabetsumasu', method: 'shio', veg: ['kyabetsu'], with: { masu: 0.3 }, salt: [2, 2], temp: COOL, days: 5, src: ['salt', 'days'], win: 'short', price: 800, level: 3, weight: true },
  { ref: 'p03-1', key: 'kinkonzuke', method: 'miso', veg: ['shirouri'], salt: [4, 6], temp: COOL, days: 30, win: 'long', price: 1200, level: 4, labor: 300, aging: { from: 1, full: 5, max: 0.6 } },
  { ref: 'p04-1', key: 'sendaihakusai', method: 'shio', veg: ['hakusai'], salt: [4, 5], temp: COOL, days: 14, src: ['salt', 'days'], win: 'normal', price: 550, level: 3, weight: true },
  { ref: 'p06-1', key: 'seisaizuke', method: 'shoyu', veg: ['seisai'], salt: [3, 4], temp: COOL, days: 10, src: ['days'], win: 'normal', price: 600, level: 3, drying: { max: 3, ideal: [1, 3], default: 2 }, weight: true },
  { ref: 'p06-2', key: 'oyamakasu', method: 'kasu', veg: ['kyuri', 'nasu', 'shirouri'], salt: [3, 6], temp: COOL, days: 40, win: 'long', price: 1300, level: 4, labor: 400, aging: { from: 1, full: 4, max: 0.5 }, work: [['tsukekae', 10, 20]] },
  { ref: 'p07-1', key: 'sangohachi', method: 'koji', veg: ['kyuri', 'nasu'], salt: [2, 3], temp: ROOM, days: 1, src: ['days'], win: 'short', price: 450, level: 3, starter: 'sangohachi', starterAfter: 30 },
  { ref: 'p07-2', key: 'nishinsansho', method: 'su', veg: ['nishin'], salt: [3, 5], temp: COOL, days: 2.5, src: ['days'], win: 'normal', price: 900, level: 3 },
  // ---- 関東 ----
  { ref: 'p08-1', key: 'gosaizuke', method: 'fish', veg: ['daikon', 'ninjin'], with: { sanma: 0.3 }, salt: [5, 8], temp: COLD, days: 35, src: ['days'], win: 'long', price: 1100, level: 4 },
  { ref: 'p08-2', key: 'rakkyo_ibaraki', method: 'amazu', veg: ['rakkyo'], salt: [8, 10], temp: COOL, days: 20, src: ['days'], win: 'long', price: 700, level: 3, work: [['amazu', 7, 14]] },
  { ref: 'p09-1', key: 'yuzumaki_tochigi', method: 'amazu', veg: ['daikon'], salt: [3, 3], temp: COOL, days: 2.5, src: ['salt', 'days'], win: 'normal', price: 500, level: 3, labor: 200 },
  { ref: 'p09-2', key: 'nikkotogarashi', method: 'shio', veg: ['aotogarashi'], salt: [15, 20], temp: COOL, days: REAL_TO_GAME(365), src: ['days'], win: 'forever', price: 1500, level: 5, aging: { from: 1, full: 3, max: 0.5 } },
  { ref: 'p10-1', key: 'yuzumaki_gunma', method: 'amazu', veg: ['daikon'], salt: [2, 3], temp: FRIDGE, days: 7, src: ['days', 'temp'], win: 'normal', price: 500, level: 3, labor: 200, drying: { max: 2, ideal: [1, 1], default: 1 } },
  { ref: 'p11-1', key: 'shakushinazuke', method: 'nyusan', veg: ['shakushina'], salt: [2, 3], temp: COLD, days: 14, win: 'long', price: 500, level: 3, unknown: true, weight: true },
  { ref: 'p12-1', key: 'teppozuke', method: 'shoyu', veg: ['shirouri'], salt: [4, 6], temp: COOL, days: 7, src: ['days'], win: 'normal', price: 800, level: 3, labor: 300, work: [['nikaeshi', 2, 4]] },
  { ref: 'p12-2', key: 'segurogoma', method: 'su', veg: ['iwashi'], salt: [8, 10], temp: COOL, days: 2.5, src: ['days'], win: 'short', price: 700, level: 3 },
  { ref: 'p13-1', key: 'bettarazuke', method: 'koji', veg: ['daikon'], salt: [3, 5], temp: COOL, days: 8, src: ['days'], win: 'normal', price: 800, level: 3 },
  { ref: 'p13-2', key: 'fukujinzuke', method: 'shoyu', veg: ['daikon'], with: { nasu: 0.15, shirouri: 0.15, kabu: 0.15 }, salt: [3, 5], temp: COOL, days: 3, src: ['days'], win: 'long', price: 700, level: 3, labor: 200 },
  { ref: 'p14-1', key: 'odawaraume', method: 'shio', veg: ['ume'], salt: [18, 20], temp: ROOM, days: 30, win: 'forever', price: 200, portions: 24, level: 4, needs: ['tsubo'], umezu: true, film: true, acidHalfProgress: 0.3, saltUptake: 0.4, aging: { from: 1, full: 25, max: 1.5 }, work: [['doyoboshi', 20, 200]] },
  { ref: 'p14-2', key: 'wariboshi', method: 'shoyu', veg: ['daikon'], salt: [3, 4], temp: COOL, days: 5, src: ['days'], win: 'normal', price: 700, level: 3, acidBase: 25, drying: { max: 20, ideal: [10, 14], default: 14 } },
  // ---- 北陸・甲信・岐阜 ----
  { ref: 'p15-1', key: 'namagusakouko', method: 'fish', veg: ['daikon'], with: { iwashi: 0.3 }, salt: [8, 10], temp: COLD, days: 30, src: ['days'], win: 'long', price: 900, level: 4 },
  { ref: 'p15-2', key: 'hoshidaikonzuke', method: 'shoyu', veg: ['daikon'], salt: [3, 4], temp: COOL, days: 2, win: 'normal', price: 800, level: 3, drying: { max: 14, ideal: [5, 10], default: 7 } },
  { ref: 'p16-1', key: 'kaburazushi_toyama', method: 'koji', veg: ['kabu'], with: { buri: 0.3 }, salt: [3, 4], temp: COLD, days: 14, src: ['days'], win: 'normal', price: 1800, level: 5, work: [['hasamu', 2, 4]] },
  { ref: 'p17-1', key: 'kaburazushi_ishikawa', method: 'koji', veg: ['kabu', 'daikon'], with: { buri: 0.3 }, salt: [2.5, 2.5], temp: [48, 52], days: 8, src: ['salt', 'days', 'temp'], win: 'normal', price: 1800, level: 5, place: 'kaon', needs: ['kaon'], bestTemp: [48, 52], spoilMult: 0.03, work: [['hasamu', 1, 2]] },
  { ref: 'p18-2', key: 'sannengo', method: 'amazu', veg: ['rakkyo'], salt: [8, 10], temp: COOL, days: 37, src: ['days'], win: 'long', price: 1000, level: 4, acidHalfProgress: 6, work: [['amazu', 14, 24]] },
  { ref: 'p18-3', key: 'akakabura_su', method: 'su', veg: ['akakabu'], salt: [4, 4], temp: COOL, days: 7, src: ['salt', 'days'], win: 'long', price: 600, level: 3, film: true },
  { ref: 'p19-1', key: 'narusawanazuke', method: 'shoyu', veg: ['narusawana'], salt: [2, 3], temp: COOL, days: 7, src: ['days'], win: 'normal', price: 500, level: 3, weight: true },
  { ref: 'p19-2', key: 'koshukoume', method: 'shio', veg: ['koume'], salt: [10, 15], temp: ROOM, days: 30, src: ['days'], win: 'forever', price: 120, portions: 24, level: 3, needs: ['tsubo'], umezu: true, film: true, acidHalfProgress: 0.3, saltUptake: 0.45, acidBase: 15, work: [['doyoboshi', 20, 200]] },
  { ref: 'p21-1', key: 'hidaakakabu', method: 'nyusan', veg: ['akakabu'], salt: [4, 4], temp: ROOM, days: 60, src: ['salt', 'days'], win: 'long', price: 700, level: 3, film: true },
  // ---- 東海・近畿 ----
  { ref: 'p22-1', key: 'wasabizuke', method: 'kasu', veg: ['wasabi'], salt: [2, 2], temp: COOL, days: 2.5, src: ['salt', 'days'], win: 'short', price: 1500, level: 3 },
  { ref: 'p22-2', key: 'mizukakenazuke', method: 'shio', veg: ['mizukakena'], salt: [3, 4], temp: COOL, days: 3.5, src: ['salt', 'days'], win: 'short', price: 500, level: 3, weight: true },
  { ref: 'p23-1', key: 'moriguchizuke', method: 'kasu', veg: ['moriguchi'], salt: [4, 8], temp: COOL, days: REAL_TO_GAME(730), src: ['days'], win: 'forever', price: 3000, level: 6, labor: 800, aging: { from: 1, full: 2, max: 0.6 }, work: [['kasu', 40, 90]] },
  { ref: 'p23-2', key: 'karimori', method: 'kasu', veg: ['shirouri'], salt: [20, 20], temp: FRIDGE, days: 21, src: ['salt', 'days', 'temp'], win: 'forever', price: 1200, level: 4, saltUptake: 0.25, aging: { from: 1, full: 5, max: 1.0 }, work: [['kasu', 7, 14]] },
  { ref: 'p24-1', key: 'igateppo', method: 'miso', veg: ['shirouri'], salt: [4, 6], temp: COOL, days: 14, src: ['days'], win: 'forever', price: 1200, level: 4, labor: 300, drying: { max: 3, ideal: [1, 2], default: 1 }, aging: { from: 1, full: 10, max: 1.2 } },
  { ref: 'p24-2', key: 'yatsugashirazuke', method: 'shio', veg: ['yatsugashira'], salt: [5, 5], temp: FRIDGE, days: 4.5, src: ['salt', 'days'], win: 'short', price: 600, level: 3, film: true },
  { ref: 'p25-1', key: 'hinonazuke', method: 'nuka', veg: ['hinona'], salt: [4, 4], temp: COOL, days: 30, src: ['salt', 'days'], win: 'long', price: 700, level: 3, drying: { max: 3, ideal: [1, 2], default: 2 } },
  { ref: 'p25-2', key: 'tatamizuke', method: 'shio', veg: ['hakusai'], salt: [3, 3], temp: COOL, days: 7, src: ['salt', 'days'], win: 'normal', price: 500, level: 3, weight: true },
  { ref: 'p26-1', key: 'senmaizuke', method: 'amazu', veg: ['shogoin'], salt: [2, 2], temp: COOL, days: 2, src: ['salt', 'days'], win: 'normal', price: 1000, level: 3 },
  { ref: 'p27-1', key: 'mizunasu_nuka', method: 'nuka', veg: ['mizunasu'], salt: null, temp: [20, 25], days: 1.5, src: ['days'], win: 'short', price: 700, level: 3, usesNukaBed: true, saltUptake: 0.4 },
  { ref: 'p27-2', key: 'osakazuke', method: 'shio', veg: ['daikon'], salt: [1, 2], temp: FRIDGE, days: 0.12, src: ['days'], win: 'short', price: 300, level: 3 },
  { ref: 'p28-1', key: 'yatarazuke', method: 'shoyu', veg: ['daikon'], with: { nasu: 0.2, kyuri: 0.2, shirouri: 0.2 }, salt: [3, 5], temp: COOL, days: 4, src: ['days'], win: 'long', price: 900, level: 4, labor: 300 },
  { ref: 'p29-1', key: 'harumanazuke', method: 'shio', veg: ['harumana'], salt: [3, 4], temp: COOL, days: 3, win: 'normal', price: 800, level: 3, unknown: true, weight: true },
  { ref: 'p29-2', key: 'narazuke', method: 'kasu', veg: ['shirouri'], salt: [3, 5], temp: COOL, days: 30, win: 'forever', price: 1300, level: 4, labor: 400, aging: { from: 1, full: 6, max: 0.8 }, unknown: true, work: [['kasu', 10, 20]] },
  // ---- 中国・四国 ----
  { ref: 'p31-1', key: 'rakkyo_tottori', method: 'amazu', veg: ['rakkyo'], salt: [8, 10], temp: COOL, days: 24, src: ['days'], win: 'long', price: 700, level: 3, work: [['amazu', 8, 16]] },
  { ref: 'p32-1', key: 'tsudakabuzuke', method: 'nuka', veg: ['tsudakabu'], salt: [4, 5], temp: COLD, days: 7, src: ['days'], win: 'normal', price: 700, level: 3, drying: { max: 10, ideal: [5, 8], default: 7 } },
  { ref: 'p33-1', key: 'mamakari_su', method: 'su', veg: ['mamakari'], salt: [3, 5], temp: COOL, days: 0.5, win: 'short', price: 800, level: 3 },
  { ref: 'p34-1', key: 'hiroshimanazuke', method: 'koji', veg: ['hiroshimana'], salt: [3, 4], temp: COOL, days: 3.5, src: ['days'], win: 'long', price: 600, level: 3, aging: { from: 2, full: 12, max: 0.4 }, weight: true },
  { ref: 'p35-1', key: 'kanzuke_yamaguchi', method: 'shoyu', veg: ['daikon'], salt: [5, 8], temp: COLD, days: 30, src: ['days', 'temp'], win: 'forever', price: 1500, level: 5, labor: 400, drying: { max: 50, ideal: [30, 45], default: 40 } },
  { ref: 'p35-2', key: 'wakameshoyu', method: 'shoyu', veg: ['wakame'], salt: [2, 4], temp: COOL, days: 0.3, win: 'short', price: 500, level: 3 },
  { ref: 'p36-1', key: 'chorogi_umezu', method: 'su', veg: ['chorogi'], salt: [3, 5], temp: COOL, days: 7, win: 'long', price: 900, level: 3, unknown: true },
  { ref: 'p36-2', key: 'awatakuan', method: 'nuka', veg: ['daikon'], salt: [4, 8], temp: COOL, days: 36, win: 'long', price: 900, level: 3, drying: { max: 14, ideal: [5, 10], default: 7 }, unknown: true, top: 'takuan' },
  { ref: 'p37-1', key: 'olive_shinzuke', method: 'shio', veg: ['olive'], salt: [3, 5], temp: COOL, days: 7, src: ['days'], win: 'normal', price: 1200, level: 4, labor: 300, acidHalfProgress: 60 },
  { ref: 'p38-1', key: 'hinokabura', method: 'su', veg: ['hikabura'], salt: [3, 4], temp: COOL, days: 5, src: ['days'], win: 'normal', price: 600, level: 3 },
  { ref: 'p39-1', key: 'itadori_enzo', method: 'shio', veg: ['itadori'], salt: [15, 20], temp: COOL, days: 14, win: 'forever', price: 500, level: 3, unknown: true },
  { ref: 'p39-2', key: 'tofu_umezu', method: 'su', veg: ['tofu'], salt: [3, 3], temp: COOL, days: 8.5, src: ['days'], win: 'normal', price: 800, level: 3, labor: 150 },
  // ---- 九州・沖縄 ----
  { ref: 'p40-1', key: 'setakatakana', method: 'nyusan', veg: ['takana'], salt: [14, 14], temp: ROOM, days: 7, src: ['salt', 'days'], win: 'forever', price: 600, level: 3, drying: { max: 3, ideal: [1, 2], default: 1 }, aging: { from: 1.5, full: 15, max: 0.6 }, weight: true, work: [['drain', 3, 5]] },
  { ref: 'p41-1', key: 'okomoji', method: 'shio', veg: ['takana'], salt: [5, 10], temp: COOL, days: 7, win: 'forever', price: 500, level: 3, weight: true },
  { ref: 'p41-2', key: 'ouchitakana', method: 'nyusan', veg: ['takana'], salt: [4, 6], temp: COOL, days: 14, win: 'long', price: 700, level: 3, unknown: true, weight: true },
  { ref: 'p42-1', key: 'tojinnazuke', method: 'nyusan', veg: ['tojinna'], salt: [2, 3], temp: COOL, days: 7, win: 'long', price: 600, level: 3, unknown: true, weight: true },
  { ref: 'p43-1', key: 'asotakana', method: 'nyusan', veg: ['takana'], salt: [6, 10], temp: ROOM, days: 7, src: ['days'], win: 'forever', price: 600, level: 3, film: true, aging: { from: 1.5, full: 15, max: 0.5 }, weight: true },
  { ref: 'p43-2', key: 'akadozuke', method: 'nyusan', veg: ['akado'], salt: [3, 4], temp: ROOM, days: 10, src: ['salt', 'days'], win: 'normal', price: 700, level: 3, acidBase: 20 },
  { ref: 'p43-3', key: 'kanzuke_kumamoto', method: 'shoyu', veg: ['daikon'], salt: [5, 6], temp: COOL, days: 2.5, src: ['salt', 'days'], win: 'long', price: 1000, level: 4, labor: 300, acidBase: 25, drying: { max: 20, ideal: [10, 14], default: 14 } },
  { ref: 'p44-1', key: 'ayuuruka', method: 'fish', veg: ['ayu'], salt: [15, 20], temp: COOL, days: 7, src: ['days'], win: 'long', price: 2000, level: 4 },
  { ref: 'p45-1', key: 'madakazuke', method: 'shoyu', veg: ['daikon'], salt: [2, 3], temp: COOL, days: 0.05, src: ['days'], win: 'short', price: 400, level: 3, acidBase: 25 },
  { ref: 'p46-1', key: 'yamakawazuke', method: 'nuka', veg: ['daikon'], salt: [6, 8], temp: ROOM, days: REAL_TO_GAME(120), src: ['days'], win: 'forever', price: 1200, level: 4, needs: ['tsubo'], top: 'takuan', aging: { from: 1, full: 3, max: 0.4 } },
  { ref: 'p46-2', key: 'papayazuke', method: 'miso', veg: ['papaya'], salt: [5, 5], temp: ROOM, days: 10, src: ['salt', 'days'], win: 'long', price: 800, level: 3, drying: { max: 2, ideal: [1, 1], default: 1 } },
  { ref: 'p46-3', key: 'ninnikushiozuke', method: 'amazu', veg: ['ninniku'], salt: [3, 5], temp: COOL, days: 7, win: 'forever', price: 700, level: 3 },
  { ref: 'p47-1', key: 'sukugarasu', method: 'fish', veg: ['suku'], salt: [30, 30], temp: ROOM, days: 30, src: ['salt', 'days'], win: 'forever', price: 1500, portions: 12, level: 5, saltUptake: 0.12, aging: { from: 1, full: 6, max: 0.8 } },
  { ref: 'p47-2', key: 'shimarakkyozuke', method: 'shio', veg: ['shimarakkyo'], salt: [7, 8], temp: FRIDGE, days: 0.5, src: ['salt', 'days'], win: 'short', price: 600, level: 3 },
];

/** 資料にある、ゲームでは作れないもの（理由つき） */
export const NOT_PLAYABLE = {
  'p17-2': '現実には許可を受けた業者しか作れないため、ゲームでは図鑑の「伝説」として載せるだけ（作れない）',
};

const interp = (table, x) => {
  if (x <= table[0][0]) return table[0][1];
  for (let i = 1; i < table.length; i++) if (x <= table[i][0]) { const [x0, y0] = table[i - 1], [x1, y1] = table[i]; return y0 + ((y1 - y0) * (x - x0)) / (x1 - x0); }
  return table.at(-1)[1];
};

/**
 * 行と資料から、漬物の定義（data/pickles.js と同じ形）を作る。
 * ferment = CONFIG.ferment、vegetables = 野菜の設定（食べ頃の計算に使う）、dataset = 資料の一覧
 */
export function regionalPickles(rows, { ferment, vegetables, dataset }) {
  const byRef = Object.fromEntries(dataset.map((d) => [d.id, d]));
  const names = {};
  for (const r of rows) { const n = clean(byRef[r.ref].name); names[n] = (names[n] ?? 0) + 1; }
  return rows.map((r) => {
    const d = byRef[r.ref];
    if (!d) throw new Error(`全国の漬物: 資料に ${r.ref} がない`);
    const m = METHODS[r.method];
    if (!m) throw new Error(`全国の漬物 ${r.key}: 漬け方 ${r.method} がない`);
    for (const v of [...r.veg, ...Object.keys(r.with ?? {})]) if (!vegetables[v]) throw new Error(`全国の漬物 ${r.key}: 食材 ${v} がない`);
    const sMid = r.salt ? (r.salt[0] + r.salt[1]) / 2 : 7, tMid = (r.temp[0] + r.temp[1]) / 2;
    const rate = ferment.baseProgressPerDay * vegetables[r.veg[0]].fermentRate * interp(ferment.tempCoef, tMid) * interp(ferment.saltCoef, sMid);
    // 塩の多い漬物（塩蔵・梅など）は、食べるときは塩抜きする・漬け汁ごとは食べない。口に入る塩は真ん中の塩分で約3.5%まで【仮置き】
    const uptake = r.saltUptake ?? (r.salt && sMid * (m.saltUptake ?? 1) > SALT_EATEN ? SALT_EATEN / sMid : m.saltUptake);
    // ゲームの時間は1日きざみ。1日より早く漬かるもの（数時間の浅漬けなど）も、食べ頃は1日目から【仮置き】
    const gameDays = Math.max(MIN_DAYS, r.days);
    const name0 = clean(d.name);
    const src = new Set(r.src ?? []);
    const { ref, key, method, veg, salt, temp, days, src: _s, win, with: withs, unknown, saltUptake: _u, ...rest } = r;
    return {
      id: key,
      name: names[name0] > 1 ? `${name0}（${d.prefecture}）` : name0,
      region: d.region, prefecture: d.prefecture, ref,
      vegetables: veg,
      with: withs,
      steps: d.process.split(/[。]/).filter(Boolean).flatMap((x) => x.split('、')).filter((x) => x.length > 1).slice(0, 5),
      saltHint: salt ? `${salt[0] === salt[1] ? salt[0] : `${salt[0]}〜${salt[1]}`}%${src.has('salt') ? '' : '（資料に記載なし・仮置き）'}` : 'ぬか床の塩分',
      salt: salt ? { lo: salt[0], hi: salt[1] } : null,
      tempHint: `${temp[0]}〜${temp[1]}℃${src.has('temp') ? '' : '（仮置き）'}`,
      temp: { lo: temp[0], hi: temp[1] },
      ripeAt: rate * gameDays,
      realDays: r.days,
      window: WIN[win],
      complexityMax: m.complexityMax,
      acidHalfProgress: m.acidHalfProgress,
      acidBase: m.acidBase,
      saltUptake: uptake,
      level: 3,
      unlock: {
        via: 'letter',
        hint: `${d.prefecture}の${d.kind}。${d.game_idea}`,
        line: `${d.prefecture}から便りが届いた。「${d.process}」${unknown ? '（数値の記載はなく、ためしてみるしかない）' : ''}`,
      },
      affinity: m.affinity,
      method: m.label,
      kind: d.kind,
      numbers: d.numbers,
      source: d.source,
      unknown: !!unknown,
      ...rest,
    };
  });
}

/** 資料の名前から（参考）などの注記を取る */
function clean(name) { return name.replace(/（(参考|事業者サイトの記載|民間記事|文化庁の一覧)）/g, ''); }
