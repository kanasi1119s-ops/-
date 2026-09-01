export interface SampleReceipt {
  id: string;
  name: string;
  categoryName: string;
  description: string;
  typeBadge?: string; // '手書き領収証' | '手書き請求書' | 'POSレシート'
  sampleText: string;
  previewUrl?: string;
  defaultData: {
    merchant: string;
    date: string;
    total: number;
    amount: number;
    tax: number;
    category: string;
    description: string;
  };
}

export const SAMPLE_RECEIPTS: SampleReceipt[] = [
  {
    id: 'sample-handwritten-receipt',
    name: '✍️ 手書き領収書 (コクヨ複写式)',
    categoryName: '消耗品費',
    typeBadge: '手書き領収証',
    description: '手書き「金 壱萬弐千八百円也 (¥12,800-)」、ゴム印・社判押印の複写式領収証',
    sampleText: `領 収 証
No. 2026-088

株式会社クラウドデザイン 御中
2026年 8月 26日

金 12,800 円 也
(内消費税等 ¥1,163 10%対象)

但し　事務所用インテリア備品・消耗品 代として
上記正に領収いたしました

【発行者・受取人】
渋谷 インテリアクラフト工房
東京都渋谷区神南1-10-5
TEL: 03-5400-XXXX
代表: 渋谷 太郎 [角印]
登録番号: T1234567890123`,
    defaultData: {
      merchant: '渋谷 インテリアクラフト工房',
      date: new Date().toISOString().slice(0, 10),
      total: 12800,
      amount: 11637,
      tax: 1163,
      category: '消耗品費',
      description: '事務所用インテリア備品・消耗品代',
    },
  },
  {
    id: 'sample-handwritten-invoice',
    name: '📝 手書き請求書 (業務委託・開発)',
    categoryName: '外注工賃・支払手数料',
    typeBadge: '手書き請求書',
    description: '手書き「今回御請求額 ¥88,000-」、件名: Webシステム開発委託費',
    sampleText: `御 請 求 書
請求番号: INV-2026-08

クライアント合同会社 御中
ご請求日: 2026年 8月 28日
お支払期日: 2026年 9月末日

今回御請求額 (税込): ¥88,000 -
(税抜金額: ¥80,000 / 消費税10%: ¥8,000)

【請求明細】
1. Webアプリケーションフロントエンド改修一式: ¥50,000
2. データベース接続API実装および結合テスト: ¥30,000
------------------------------------------------
小計: ¥80,000
消費税(10%): ¥8,000
合計請求金額: ¥88,000

【お振込先 / 請求元】
アトリエ・ウェブクリエイティブ
代表: 田中 健一 [認印]
登録番号: T9876543210987`,
    defaultData: {
      merchant: 'アトリエ・ウェブクリエイティブ',
      date: new Date().toISOString().slice(0, 10),
      total: 88000,
      amount: 80000,
      tax: 8000,
      category: '外注工賃',
      description: 'Webアプリケーション改修・API実装業務委託費',
    },
  },
  {
    id: 'sample-1',
    name: '☕ カフェ・打ち合わせ領収書',
    categoryName: '会議費・交際費',
    typeBadge: 'POSレシート',
    description: 'スターバックスコーヒーでのクライアント打ち合わせ費用',
    sampleText: `STARBUCKS COFFEE
新宿サザンテラス店
2026/08/25 14:32

領収書 (Receipt)
-------------------------------
ドリップコーヒー (Tall)      ¥420
カフェモカ (Grande)          ¥580
クッキーサンド               ¥380
-------------------------------
小計                       ¥1,380
消費税(10%)                  ¥138
合計 (税込)                ¥1,518
お預かり                   ¥2,000
お釣り                       ¥482
登録番号: T1234567890123`,
    defaultData: {
      merchant: 'スターバックス 新宿サザンテラス店',
      date: new Date().toISOString().slice(0, 10),
      total: 1518,
      amount: 1380,
      tax: 138,
      category: '会議費',
      description: 'クライアントとの案件進行打ち合わせ飲食代',
    },
  },
  {
    id: 'sample-2',
    name: '🛒 文房具・事務用品レシート',
    categoryName: '消耗品費',
    typeBadge: 'POSレシート',
    description: 'オフィス文具・コピー用紙・USBケーブル等の購入',
    sampleText: `ヨドバシカメラ Akiba
2026/08/20 18:15

レシート 兼 領収証
-------------------------------
コクヨ キャンパスノート 5冊組  ¥650
Type-C急速充電ケーブル 1.5m    ¥1,680
A4 コピー用紙 500枚           ¥590
-------------------------------
税抜小計                   ¥2,920
外税(10%)                    ¥292
税込合計                   ¥3,212
クレジット支払             ¥3,212
インボイス登録番号: T9876543210987`,
    defaultData: {
      merchant: 'ヨドバシカメラ Akiba',
      date: new Date().toISOString().slice(0, 10),
      total: 3212,
      amount: 2920,
      tax: 292,
      category: '消耗品費',
      description: '事務用文具・充電ケーブル・コピー用紙購入',
    },
  },
  {
    id: 'sample-3',
    name: '🚕 タクシー移動交通費領収書',
    categoryName: '旅費交通費',
    typeBadge: '感熱紙領収書',
    description: '客先訪問および荷物運搬に伴うタクシー移動費',
    sampleText: `日本交通株式会社
タクシー領収書
乗車日: 2026/08/22 21:40
車両番号: 練馬 500 あ 1234

運賃 (税込)                ¥4,300
(内消費税等 10%              ¥390)
-------------------------------
合計金額                   ¥4,300
電子マネー(Suica)決済
毎度ご乗車ありがとうございます`,
    defaultData: {
      merchant: '日本交通株式会社',
      date: new Date().toISOString().slice(0, 10),
      total: 4300,
      amount: 3910,
      tax: 390,
      category: '旅費交通費',
      description: 'クライアントオフィス訪問・荷物搬送タクシー代',
    },
  },
  {
    id: 'sample-4',
    name: '🍽️ クライアント会食領収書',
    categoryName: '接待交際費',
    typeBadge: '手書き・飲食領収書',
    description: 'プロジェクトキックオフ懇親会・会食費用',
    sampleText: `銀座 旬彩 割烹 和光
2026/08/18 20:30

領収書
株式会社テックソリューションズ 様
但し、お食事代として上記正に領収いたしました

金額: ¥18,700- (税込)
内訳:
税抜金額                   ¥17,000
消費税額 (10%)              ¥1,700
-------------------------------
登録番号: T5678901234567`,
    defaultData: {
      merchant: '銀座 旬彩 割烹 和光',
      date: new Date().toISOString().slice(0, 10),
      total: 18700,
      amount: 17000,
      tax: 1700,
      category: '接待交際費',
      description: '案件キックオフミーティング会食代',
    },
  },
];
