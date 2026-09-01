export type TransactionType = 'income' | 'expense';

export type ExpenseCategory =
  | '消耗品費'
  | '通信費'
  | '広告宣伝費'
  | '接待交際費'
  | '旅費交通費'
  | '会議費'
  | '新聞図書費'
  | '支払手数料'
  | '地代家賃'
  | '水道光熱費'
  | '外注工賃'
  | '車両費'
  | '研修費'
  | '雑費';

export type IncomeCategory =
  | '売上高'
  | '業務委託報酬'
  | '制作費'
  | '商品販売'
  | 'コンサルティング'
  | '原稿料・監修料'
  | '雑収入';

export interface Transaction {
  id: string;
  type: TransactionType;
  amount: number; // 税抜金額
  tax: number; // 消費税
  total: number; // 税込合計
  description: string; // 摘要
  category: string; // 勘定科目
  date: string; // YYYY-MM-DD
  taxRate: number; // 0.10 or 0.08
  merchant?: string; // 店舗名・取引先
  source: 'manual' | 'ai_ocr';
  receiptImage?: string; // Base64 or URL
  documentType?: DocumentType;
  invoiceNumber?: string;
  paymentMethod?: string;
  items?: OcrParsedItem[];
  createdAt: string;
}

export interface TaxSettings {
  estimatedIncomeTaxRate: number; // 所得税率 (default: 0.10)
  estimatedResidentTaxRate: number; // 住民税率 (default: 0.10)
  estimatedHealthInsRate: number; // 国民健康保険率 (default: 0.10)
  standardTaxRate: number; // 0.10
  reducedTaxRate: number; // 0.08
  blueReturnDeduction: number; // 650000 or 100000 or 0
  applyBlueReturn: boolean;
}

export type DocumentType = 'receipt' | 'invoice' | 'statement' | 'other';

export interface OcrParsedItem {
  name: string;
  price: number;
  quantity?: number;
  taxRate?: number;
}

export interface OcrResult {
  documentType?: DocumentType;
  merchant: string;
  date: string;
  total: number;
  amount: number;
  tax: number;
  taxRate: number;
  category: string;
  description: string;
  invoiceNumber?: string;
  paymentMethod?: string;
  items?: OcrParsedItem[];
  rawText?: string;
  confidence?: number;
}

export type ViewTab = 'dashboard' | 'ocr' | 'sales' | 'ledger' | 'rules' | 'settings';
