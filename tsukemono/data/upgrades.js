// 店の格上げ（買えるもの）。店そのものを良くする投資と、樽ごとの木桶、期間ものの宣伝。1件足せば店の窓に並ぶ。
// 【仮置き】値段と効き目はすべて遊びの釣り合いで決めた値
//
// 項目:
//   group    : shop（店の格上げ。一度買えばずっと）/ barrel（樽ごと）/ campaign（期間もの。何度でも買える）
//   cost     : 値段（円）
//   level    : 買える店のレベル
//   requires : 先に買っておくもの（順番に格上げしていく）
//   days     : campaign の続く日数
//   effects  : visitors（お客×）/ price（売り値×）/ sat（満足度に足す）/ aging（寝かせた値打ちの上乗せ×）
//              / explain（難癖のお客に説明が通る確率に足す）/ shelf（棚の数に足す）/ barrels（蔵に置ける樽の数に足す）/ complexity（その樽の風味の深さ×）/ film（その樽の膜の増え方×）
//   note     : 説明

export const UPGRADES = [
  // ---- 店の格上げ（順番に） ----
  { id: 'noren', group: 'shop', name: '暖簾を新調する', cost: 8000, level: 2, effects: { visitors: 1.05 }, note: '色あせた暖簾を、藍染めの新品に。通りの人がふり返る' }, // 【仮置き】
  { id: 'kanban', group: 'shop', name: '看板を書き直す', cost: 20000, level: 3, requires: 'noren', effects: { visitors: 1.05, price: 1.03 }, note: '書道の先生に頼んだ。「○○」のところは、まだ決まっていない' }, // 【仮置き】
  { id: 'shishoku', group: 'shop', name: '試食コーナーを作る', cost: 12000, level: 3, effects: { sat: 3, explain: 0.1 }, note: '食べてもらえば、わかってもらえる。難癖のお客にも食べさせる' }, // 【仮置き】
  { id: 'tana', group: 'shop', name: '棚を作り足す', cost: 6000, level: 2, effects: { shelf: 3 }, note: 'できた漬物を樽から移しておける棚。樽が空いて、次が仕込める' }, // 【仮置き】
  { id: 'urakura', group: 'shop', name: '裏の物置を蔵にする', cost: 30000, level: 4, effects: { barrels: 2, shelf: 2 }, note: '店の裏に樽を2つ置ける（店先には出ない）。物置にいた猫は、そのまま住んでいる' }, // 【仮置き】
  { id: 'misesaki', group: 'shop', name: '店先を改装する', cost: 50000, level: 5, requires: 'kanban', effects: { visitors: 1.1, price: 1.05 }, note: '縁台と、日よけと、ちょっといい照明' }, // 【仮置き】
  { id: 'kura', group: 'shop', name: '漬物蔵を建てる', cost: 120000, level: 6, requires: 'misesaki', effects: { aging: 1.3, price: 1.05, barrels: 2, shelf: 3 }, note: '寝かせる専用の蔵。樽がさらに2つ置ける。寝かせた漬物の値打ちが上がる（店主もたまに寝る）' }, // 【仮置き】
  { id: 'shinise', group: 'shop', name: '「老舗」の札をかける', cost: 300000, level: 7, requires: 'kura', effects: { visitors: 1.1, price: 1.1, sat: 2 }, note: '創業の年は、ちょっとだけ盛った' }, // 【仮置き】
  // ---- 樽ごと ----
  { id: 'sugioke', group: 'barrel', name: '杉の木桶に替える', cost: 6000, level: 2, effects: { complexity: 1.08, film: 0.8 }, note: '木の香りが移り、膜も張りにくい（その樽だけ。中身を入れかえても残る）' }, // 【仮置き】
  // ---- 期間もの ----
  { id: 'chirashi', group: 'campaign', name: 'チラシを配る', cost: 3000, level: 1, days: 3, effects: { visitors: 1.3 }, note: '3日間、お客が増える。半分は猫が持っていった' }, // 【仮置き】
  { id: 'radio', group: 'campaign', name: '地元のラジオに出る', cost: 15000, level: 4, days: 7, effects: { visitors: 1.4, price: 1.05 }, note: '7日間、お客がぐっと増える。緊張して「漬物」を3回噛んだ' }, // 【仮置き】
];
