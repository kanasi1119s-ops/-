import { Transaction, TaxSettings } from '../types';

export const DEFAULT_TAX_SETTINGS: TaxSettings = {
  estimatedIncomeTaxRate: 0.10, // 10%
  estimatedResidentTaxRate: 0.10, // 10%
  estimatedHealthInsRate: 0.10, // 10%
  standardTaxRate: 0.10, // 10%
  reducedTaxRate: 0.08, // 8%
  blueReturnDeduction: 650000,
  applyBlueReturn: false, // Default matches Streamlit formula (30% total deductions on profit)
};

// Generate realistic default transactions for current date/month
export function getInitialTransactions(): Transaction[] {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');

  const todayStr = `${year}-${month}-${day}`;
  
  // Create past dates in the current month
  const d1 = `${year}-${month}-02`;
  const d2 = `${year}-${month}-05`;
  const d3 = `${year}-${month}-10`;
  const d4 = `${year}-${month}-15`;
  const d5 = `${year}-${month}-20`;
  const dToday = todayStr;

  return [
    {
      id: 'tx-1',
      type: 'income',
      amount: 450000,
      tax: 45000,
      total: 495000,
      description: 'Webアプリケーション開発案件（2月納品分）',
      category: '売上高',
      date: d1,
      taxRate: 0.10,
      merchant: '株式会社テックソリューションズ',
      source: 'manual',
      createdAt: new Date(Date.now() - 86400000 * 20).toISOString(),
    },
    {
      id: 'tx-2',
      type: 'expense',
      amount: 3200,
      tax: 320,
      total: 3520,
      description: '事務用品・ノート・USBメモリ購入',
      category: '消耗品費',
      date: d2,
      taxRate: 0.10,
      merchant: 'ヨドバシカメラ Akiba',
      source: 'ai_ocr',
      createdAt: new Date(Date.now() - 86400000 * 18).toISOString(),
    },
    {
      id: 'tx-3',
      type: 'expense',
      amount: 12000,
      tax: 1200,
      total: 13200,
      description: 'クラウドアカウントサーバー利用料 (GCP/AWS)',
      category: '通信費',
      date: d3,
      taxRate: 0.10,
      merchant: 'Google Cloud Platform',
      source: 'manual',
      createdAt: new Date(Date.now() - 86400000 * 15).toISOString(),
    },
    {
      id: 'tx-4',
      type: 'income',
      amount: 220000,
      tax: 22000,
      total: 242000,
      description: 'UI/UXデザイン設計・コンサルティング報酬',
      category: '業務委託報酬',
      date: d4,
      taxRate: 0.10,
      merchant: '合同会社ネクストデザイン',
      source: 'manual',
      createdAt: new Date(Date.now() - 86400000 * 10).toISOString(),
    },
    {
      id: 'tx-5',
      type: 'expense',
      amount: 8500,
      tax: 850,
      total: 9350,
      description: 'クライアントとのプロジェクト打ち合わせ飲食費',
      category: '接待交際費',
      date: d5,
      taxRate: 0.10,
      merchant: 'トラットリア銀座',
      source: 'ai_ocr',
      createdAt: new Date(Date.now() - 86400000 * 5).toISOString(),
    },
    {
      id: 'tx-6',
      type: 'expense',
      amount: 1800,
      tax: 180,
      total: 1980,
      description: '外出先での作業用カフェ利用料',
      category: '会議費',
      date: dToday,
      taxRate: 0.10,
      merchant: 'スターバックスコーヒー 新宿店',
      source: 'ai_ocr',
      createdAt: new Date().toISOString(),
    },
    {
      id: 'tx-7',
      type: 'income',
      amount: 80000,
      tax: 8000,
      total: 88000,
      description: '技術記事執筆・連載稿料',
      category: '原稿料・監修料',
      date: dToday,
      taxRate: 0.10,
      merchant: '株式会社メディアパブリッシング',
      source: 'manual',
      createdAt: new Date().toISOString(),
    },
  ];
}
