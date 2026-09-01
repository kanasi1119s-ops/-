import { ExpenseCategory, IncomeCategory } from '../types';

export interface CategoryInfo {
  id: string;
  name: string;
  type: 'expense' | 'income';
  description: string;
  examples: string;
  color: string;
  badgeBg: string;
  badgeText: string;
}

export const EXPENSE_CATEGORIES_INFO: Record<ExpenseCategory, CategoryInfo> = {
  '消耗品費': {
    id: 'supplies',
    name: '消耗品費',
    type: 'expense',
    description: '取得価額10万円未満（青色申告特例は30万円未満）の備品・消耗品',
    examples: 'PC周辺機器, 文房具, コピー用紙, 事務机・椅子, ソフトウェアライセンス',
    color: '#3b82f6',
    badgeBg: 'bg-blue-50 border-blue-200',
    badgeText: 'text-blue-700',
  },
  '通信費': {
    id: 'communication',
    name: '通信費',
    type: 'expense',
    description: '業務上の通信・情報伝達・インターネット関連費用',
    examples: 'スマートフォン・携帯料金, プロバイダ・光回線, クラウドサーバー(AWS/GCP), 郵送料・切手代',
    color: '#06b6d4',
    badgeBg: 'bg-cyan-50 border-cyan-200',
    badgeText: 'text-cyan-700',
  },
  '広告宣伝費': {
    id: 'advertising',
    name: '広告宣伝費',
    type: 'expense',
    description: '商品・サービスや事業のPR・宣伝・集客に関わる費用',
    examples: 'Google/Meta/Twitter等のWeb広告費, 名刺・パンフレット印刷, チラシ・看板作成, PR代行',
    color: '#8b5cf6',
    badgeBg: 'bg-purple-50 border-purple-200',
    badgeText: 'text-purple-700',
  },
  '接待交際費': {
    id: 'entertainment',
    name: '接待交際費',
    type: 'expense',
    description: '取引先・クライアント・事業関係者との円滑な関係維持のための飲食・贈答',
    examples: '取引先との会食・接待ディナー, お中元・お歳暮, 手土産, 慶弔見舞金',
    color: '#ec4899',
    badgeBg: 'bg-pink-50 border-pink-200',
    badgeText: 'text-pink-700',
  },
  '旅費交通費': {
    id: 'travel',
    name: '旅費交通費',
    type: 'expense',
    description: '業務遂行・商談・取材等のための移動・交通・出張宿泊費用',
    examples: '電車・地下鉄・新幹線運賃, タクシー代, 飛行機代, 出張宿泊費, コインパーキング代',
    color: '#10b981',
    badgeBg: 'bg-emerald-50 border-emerald-200',
    badgeText: 'text-emerald-700',
  },
  '会議費': {
    id: 'meeting',
    name: '会議費',
    type: 'expense',
    description: '業務上の打ち合わせや商談時のカフェ代・軽食・会議室利用料',
    examples: 'カフェでの商談・打ち合わせ飲食代, 貸会議室利用料, コワーキングスペース一時利用料',
    color: '#f59e0b',
    badgeBg: 'bg-amber-50 border-amber-200',
    badgeText: 'text-amber-700',
  },
  '新聞図書費': {
    id: 'books',
    name: '新聞図書費',
    type: 'expense',
    description: '業務知識の習得や市場調査のための書籍・雑誌・専門メディア購読料',
    examples: '技術書, ビジネス専門書, 日経新聞・業界紙, 有料メルマガ・note記事, 電子書籍',
    color: '#6366f1',
    badgeBg: 'bg-indigo-50 border-indigo-200',
    badgeText: 'text-indigo-700',
  },
  '支払手数料': {
    id: 'fees',
    name: '支払手数料',
    type: 'expense',
    description: '銀行や決済代行、各種サービス利用に伴う手数料・報酬',
    examples: '銀行振込手数料, Stripe/PayPal決済手数料, クラウドソーシング利用手数料, 税理士報酬',
    color: '#64748b',
    badgeBg: 'bg-slate-100 border-slate-200',
    badgeText: 'text-slate-700',
  },
  '地代家賃': {
    id: 'rent',
    name: '地代家賃',
    type: 'expense',
    description: '事務所・店舗・作業スペース等の賃料（自宅兼事務所の場合は家事按分）',
    examples: '事務所家賃, レンタルオフィス月額費, バーチャルオフィス利用料, 月極駐車場代',
    color: '#14b8a6',
    badgeBg: 'bg-teal-50 border-teal-200',
    badgeText: 'text-teal-700',
  },
  '水道光熱費': {
    id: 'utilities',
    name: '水道光熱費',
    type: 'expense',
    description: '事務所・作業場で使用する電気・ガス・水道料金（家事按分対象）',
    examples: '電気料金, ガス料金, 水道料金',
    color: '#f97316',
    badgeBg: 'bg-orange-50 border-orange-200',
    badgeText: 'text-orange-700',
  },
  '外注工賃': {
    id: 'outsourcing',
    name: '外注工賃',
    type: 'expense',
    description: '業務の一部を外部の個人・法人に委託した際の報酬（源泉徴収に注意）',
    examples: '外部エンジニアへの開発委託費, デザイナーへの外注費, 翻訳・文字起こし外注費',
    color: '#84cc16',
    badgeBg: 'bg-lime-50 border-lime-200',
    badgeText: 'text-lime-800',
  },
  '車両費': {
    id: 'vehicle',
    name: '車両費',
    type: 'expense',
    description: '事業用自動車・バイクの維持管理費用（ガソリン代・保険・車検等）',
    examples: 'ガソリン代, 高速道路ETC料金, 自動車保険料, 車検・修理費用',
    color: '#78716c',
    badgeBg: 'bg-stone-100 border-stone-200',
    badgeText: 'text-stone-700',
  },
  '研修費': {
    id: 'training',
    name: '研修費',
    type: 'expense',
    description: 'スキルアップや事業に必要な研修・セミナー・勉強会等の参加費用',
    examples: '有料セミナー受講料, 資格取得講座, カンファレンス参加チケット, オンラインスクール代',
    color: '#a855f7',
    badgeBg: 'bg-purple-50 border-purple-200',
    badgeText: 'text-purple-700',
  },
  '雑費': {
    id: 'miscellaneous',
    name: '雑費',
    type: 'expense',
    description: '他のどの勘定科目にも当てはまらない一時的・少額な諸経費',
    examples: '粗大ごみ処理券, 各種証明書発行手数料, 安全衛生用品',
    color: '#94a3b8',
    badgeBg: 'bg-slate-100 border-slate-200',
    badgeText: 'text-slate-600',
  },
};

export const INCOME_CATEGORIES_INFO: Record<IncomeCategory, CategoryInfo> = {
  '売上高': {
    id: 'sales_revenue',
    name: '売上高',
    type: 'income',
    description: '事業の主たる活動から得られる基本的な営業収益',
    examples: '通常の受注案件売上, 定期契約料, サービス利用料',
    color: '#10b981',
    badgeBg: 'bg-emerald-50 border-emerald-200',
    badgeText: 'text-emerald-800',
  },
  '業務委託報酬': {
    id: 'contract_fee',
    name: '業務委託報酬',
    type: 'income',
    description: 'システム開発・制作・業務支援などの受託業務で得た報酬',
    examples: 'Web・アプリ受託開発費, デザイン制作料, マーケティング支援報酬',
    color: '#3b82f6',
    badgeBg: 'bg-blue-50 border-blue-200',
    badgeText: 'text-blue-800',
  },
  '制作費': {
    id: 'production_fee',
    name: '制作費',
    type: 'income',
    description: '成果物（Webサイト、グラフィック、映像、音源等）の納品対価',
    examples: 'Webサイト構築費, LP制作費, ロゴデザイン制作, 動画編集案件',
    color: '#8b5cf6',
    badgeBg: 'bg-purple-50 border-purple-200',
    badgeText: 'text-purple-800',
  },
  '商品販売': {
    id: 'product_sales',
    name: '商品販売',
    type: 'income',
    description: '物販、ECサイト、デジタルコンテンツ等の直接販売収益',
    examples: 'オンラインショップ売上, 電子書籍・テンプレート販売, 自社プロダクト売上',
    color: '#f59e0b',
    badgeBg: 'bg-amber-50 border-amber-200',
    badgeText: 'text-amber-800',
  },
  'コンサルティング': {
    id: 'consulting',
    name: 'コンサルティング',
    type: 'income',
    description: '専門知識やノウハウ提供に伴うアドバイザリー・月次顧問料',
    examples: '技術顧問料, 経営・DXコンサルティング料, スポット相談料',
    color: '#06b6d4',
    badgeBg: 'bg-cyan-50 border-cyan-200',
    badgeText: 'text-cyan-800',
  },
  '原稿料・監修料': {
    id: 'manuscript_fee',
    name: '原稿料・監修料',
    type: 'income',
    description: '記事執筆・連載・専門書籍の執筆および専門監修・登壇費用',
    examples: '雑誌・Webメディア寄稿原稿料, 技術書執筆印税, セミナー登壇謝金',
    color: '#ec4899',
    badgeBg: 'bg-pink-50 border-pink-200',
    badgeText: 'text-pink-800',
  },
  '雑収入': {
    id: 'misc_income',
    name: '雑収入',
    type: 'income',
    description: '本業以外の付随的な収入・キャッシュバック等',
    examples: '事業用ポイント還元, キャッシュバック, 預金利息, 補助金・助成金',
    color: '#64748b',
    badgeBg: 'bg-slate-100 border-slate-200',
    badgeText: 'text-slate-700',
  },
};

export const ALL_EXPENSE_CATEGORIES: ExpenseCategory[] = Object.keys(EXPENSE_CATEGORIES_INFO) as ExpenseCategory[];
export const ALL_INCOME_CATEGORIES: IncomeCategory[] = Object.keys(INCOME_CATEGORIES_INFO) as IncomeCategory[];

export function getCategoryBadgeStyle(categoryName: string, type: 'income' | 'expense'): { badgeBg: string; badgeText: string } {
  if (type === 'income') {
    const info = INCOME_CATEGORIES_INFO[categoryName as IncomeCategory];
    if (info) return { badgeBg: info.badgeBg, badgeText: info.badgeText };
    return { badgeBg: 'bg-emerald-50 border-emerald-200', badgeText: 'text-emerald-800' };
  } else {
    const info = EXPENSE_CATEGORIES_INFO[categoryName as ExpenseCategory];
    if (info) return { badgeBg: info.badgeBg, badgeText: info.badgeText };
    return { badgeBg: 'bg-rose-50 border-rose-200', badgeText: 'text-rose-800' };
  }
}
