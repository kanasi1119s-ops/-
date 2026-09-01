import { Transaction, TaxSettings } from '../types';
import { DEFAULT_TAX_SETTINGS, getInitialTransactions } from './defaultData';

const STORAGE_KEY_TRANSACTIONS = 'ai_accounting_transactions_v1';
const STORAGE_KEY_SETTINGS = 'ai_accounting_settings_v1';

export function loadTransactions(): Transaction[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_TRANSACTIONS);
    if (!raw) {
      const initial = getInitialTransactions();
      saveTransactions(initial);
      return initial;
    }
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed;
    }
  } catch (err) {
    console.error('Failed to load transactions from localStorage', err);
  }
  return getInitialTransactions();
}

export function saveTransactions(transactions: Transaction[]): void {
  try {
    localStorage.setItem(STORAGE_KEY_TRANSACTIONS, JSON.stringify(transactions));
  } catch (err) {
    console.error('Failed to save transactions to localStorage', err);
  }
}

export function loadTaxSettings(): TaxSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_SETTINGS);
    if (raw) {
      return { ...DEFAULT_TAX_SETTINGS, ...JSON.parse(raw) };
    }
  } catch (err) {
    console.error('Failed to load tax settings from localStorage', err);
  }
  return { ...DEFAULT_TAX_SETTINGS };
}

export function saveTaxSettings(settings: TaxSettings): void {
  try {
    localStorage.setItem(STORAGE_KEY_SETTINGS, JSON.stringify(settings));
  } catch (err) {
    console.error('Failed to save tax settings to localStorage', err);
  }
}

export function exportTransactionsToCsv(transactions: Transaction[], customFilename?: string): void {
  // UTF-8 BOM for Japanese Excel compatibility
  const BOM = '\uFEFF';
  const headers = [
    'ID',
    '日付',
    '種別',
    '勘定科目',
    '取引先/店舗名',
    '摘要',
    '税抜金額(円)',
    '消費税(円)',
    '税込合計(円)',
    '税率',
    '登録種別',
    '登録日時',
    '書類種別',
    '請求書/登録番号',
    '支払方法',
    '明細',
  ];
  
  const escapeCell = (val: string | undefined | null) => {
    const str = val == null ? '' : String(val);
    return `"${str.replace(/"/g, '""')}"`;
  };

  const rows = transactions.map((t) => [
    escapeCell(t.id),
    escapeCell(t.date),
    escapeCell(t.type === 'income' ? '売上' : '経費'),
    escapeCell(t.category || (t.type === 'income' ? '売上高' : '消耗品費')),
    escapeCell(t.merchant || ''),
    escapeCell(t.description || ''),
    Math.round(t.amount),
    Math.round(t.tax),
    Math.round(t.total),
    escapeCell(`${Math.round(t.taxRate * 100)}%`),
    escapeCell(t.source === 'ai_ocr' ? 'AI読取' : '手動入力'),
    escapeCell(t.createdAt || ''),
    escapeCell(t.documentType || 'receipt'),
    escapeCell(t.invoiceNumber || ''),
    escapeCell(t.paymentMethod || ''),
    escapeCell((t.items || []).map((i) => `${i.name}×${i.quantity || 1} ¥${Math.round(i.price)}`).join(' / ')),
  ]);

  const csvContent = BOM + [headers.join(','), ...rows.map((r) => r.join(','))].join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  const defaultName = `取引明細_${new Date().toISOString().slice(0, 10)}.csv`;
  link.setAttribute('download', customFilename || defaultName);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function exportTransactionsToJson(transactions: Transaction[], customFilename?: string): void {
  const backupData = {
    appName: 'AIスマート経理',
    version: '1.0.0',
    exportedAt: new Date().toISOString(),
    transactionCount: transactions.length,
    transactions,
  };

  const jsonString = JSON.stringify(backupData, null, 2);
  const blob = new Blob([jsonString], { type: 'application/json;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  const dateStr = new Date().toISOString().slice(0, 10);
  const defaultName = `ai_accounting_backup_${dateStr}.json`;
  link.setAttribute('download', customFilename || defaultName);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export interface JsonImportResult {
  success: boolean;
  transactions?: Transaction[];
  exportedAt?: string;
  error?: string;
}

export function validateAndParseTransactionsJson(jsonContent: string): JsonImportResult {
  try {
    const parsed = JSON.parse(jsonContent);

    let rawList: any[] = [];
    let exportedAt: string | undefined;

    if (Array.isArray(parsed)) {
      rawList = parsed;
    } else if (parsed && typeof parsed === 'object' && Array.isArray(parsed.transactions)) {
      rawList = parsed.transactions;
      exportedAt = parsed.exportedAt;
    } else {
      return {
        success: false,
        error: 'JSONファイルの形式が不正です。取引データ配列（transactions）が見つかりませんでした。',
      };
    }

    if (rawList.length === 0) {
      return {
        success: false,
        error: 'JSONファイル内に取引データが含まれていません。',
      };
    }

    // Validate and sanitize each item
    const validTransactions: Transaction[] = [];
    for (let i = 0; i < rawList.length; i++) {
      const item = rawList[i];
      if (!item || typeof item !== 'object') continue;

      const id = typeof item.id === 'string' && item.id ? item.id : `tx-imp-${Date.now()}-${i}`;
      const type = item.type === 'income' ? 'income' : 'expense';
      const amount = typeof item.amount === 'number' && !isNaN(item.amount) ? Math.abs(item.amount) : 0;
      const taxRate = typeof item.taxRate === 'number' && !isNaN(item.taxRate) ? item.taxRate : 0.1;
      const tax = typeof item.tax === 'number' && !isNaN(item.tax) ? item.tax : Math.round(amount * taxRate);
      const total = typeof item.total === 'number' && !isNaN(item.total) ? item.total : amount + tax;
      const date = typeof item.date === 'string' && item.date ? item.date : new Date().toISOString().slice(0, 10);
      const category = typeof item.category === 'string' ? item.category : (type === 'income' ? '売上高' : '消耗品費');
      const merchant = typeof item.merchant === 'string' ? item.merchant : '';
      const description = typeof item.description === 'string' ? item.description : '';
      const source = item.source === 'ai_ocr' ? 'ai_ocr' : 'manual';
      const receiptImage = typeof item.receiptImage === 'string' ? item.receiptImage : undefined;
      const documentType = ['receipt','invoice','statement','other'].includes(item.documentType) ? item.documentType : undefined;
      const invoiceNumber = typeof item.invoiceNumber === 'string' ? item.invoiceNumber : undefined;
      const paymentMethod = typeof item.paymentMethod === 'string' ? item.paymentMethod : undefined;
      const items = Array.isArray(item.items) ? item.items.filter((x: any) => x && typeof x.name === 'string').map((x: any) => ({ name: x.name, price: Number(x.price) || 0, quantity: Number(x.quantity) || 1, taxRate: Number(x.taxRate) || undefined })) : undefined;
      const createdAt = typeof item.createdAt === 'string' ? item.createdAt : new Date().toISOString();

      validTransactions.push({
        id,
        type,
        amount,
        tax,
        total,
        taxRate,
        date,
        category,
        merchant,
        description,
        source,
        receiptImage,
        documentType,
        invoiceNumber,
        paymentMethod,
        items,
        createdAt,
      });
    }

    if (validTransactions.length === 0) {
      return {
        success: false,
        error: '有効な取引レコードを検出できませんでした。',
      };
    }

    return {
      success: true,
      transactions: validTransactions,
      exportedAt,
    };
  } catch (err: any) {
    return {
      success: false,
      error: `JSON解析エラー: ${err?.message || 'ファイルの読み込みに失敗しました'}`,
    };
  }
}

