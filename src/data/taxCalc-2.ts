import { Transaction, TaxSettings } from '../types';

// ============================================================
// 累進課税による所得税額の計算（令和5年分〜の速算表ベース）
// これは確定申告の参考シミュレーションであり、実際の税額は
// 各種控除（基礎控除・社会保険料控除・扶養控除等）により変動します。
// ============================================================
const INCOME_TAX_BRACKETS: { upTo: number; rate: number; deduction: number }[] = [
  { upTo: 1_950_000, rate: 0.05, deduction: 0 },
  { upTo: 3_300_000, rate: 0.10, deduction: 97_500 },
  { upTo: 6_950_000, rate: 0.20, deduction: 427_500 },
  { upTo: 9_000_000, rate: 0.23, deduction: 636_000 },
  { upTo: 18_000_000, rate: 0.33, deduction: 1_536_000 },
  { upTo: 40_000_000, rate: 0.40, deduction: 2_796_000 },
  { upTo: Infinity, rate: 0.45, deduction: 4_796_000 },
];

// 基礎控除（令和5年分、所得2,400万円以下の場合）
export const BASIC_DEDUCTION = 480_000;

// 復興特別所得税率 (所得税額の2.1%、2037年まで)
export const RECONSTRUCTION_SURTAX_RATE = 0.021;

export interface ProgressiveTaxResult {
  taxableIncome: number; // 課税所得（1,000円未満切り捨て後）
  bracketRate: number;
  incomeTax: number; // 復興特別税を含まない所得税額
  reconstructionSurtax: number; // 復興特別所得税額
  totalIncomeTax: number; // 合計（100円未満切り捨て）
}

export function calculateProgressiveIncomeTax(taxableIncomeBeforeRounding: number): ProgressiveTaxResult {
  // 課税所得金額は1,000円未満を切り捨てる
  const taxableIncome = Math.max(0, Math.floor(taxableIncomeBeforeRounding / 1000) * 1000);
  const bracket = INCOME_TAX_BRACKETS.find((b) => taxableIncome <= b.upTo) || INCOME_TAX_BRACKETS[INCOME_TAX_BRACKETS.length - 1];
  const incomeTaxRaw = Math.max(0, taxableIncome * bracket.rate - bracket.deduction);
  const reconstructionSurtax = Math.round(incomeTaxRaw * RECONSTRUCTION_SURTAX_RATE);
  const totalRaw = incomeTaxRaw + reconstructionSurtax;
  // 申告納税額は100円未満切り捨て
  const totalIncomeTax = Math.floor(totalRaw / 100) * 100;

  return {
    taxableIncome,
    bracketRate: bracket.rate,
    incomeTax: Math.round(incomeTaxRaw),
    reconstructionSurtax,
    totalIncomeTax,
  };
}

// ============================================================
// インボイス制度（適格請求書等保存方式）関連
// ============================================================

// 登録番号の形式チェック: "T" + 13桁の数字
const INVOICE_NUMBER_PATTERN = /^T\d{13}$/;

export function isLikelyQualifiedInvoiceNumber(raw: string | undefined | null): boolean {
  if (!raw) return false;
  const normalized = raw.trim().toUpperCase().replace(/[‐－ー\-\s]/g, '');
  return INVOICE_NUMBER_PATTERN.test(normalized);
}

export interface InvoiceComplianceSummary {
  totalExpenseAmount: number; // 経費 税抜合計
  qualifiedAmount: number; // 適格請求書（登録事業者）分の税抜合計
  nonQualifiedAmount: number; // 非登録事業者分の税抜合計
  unjudgedAmount: number; // 未判定分の税抜合計
  nonQualifiedCount: number;
  unjudgedCount: number;
}

export function buildInvoiceComplianceSummary(transactions: Transaction[]): InvoiceComplianceSummary {
  const expenses = transactions.filter((t) => t.type === 'expense');
  let qualifiedAmount = 0;
  let nonQualifiedAmount = 0;
  let unjudgedAmount = 0;
  let nonQualifiedCount = 0;
  let unjudgedCount = 0;

  for (const t of expenses) {
    if (t.qualifiedInvoice === true) {
      qualifiedAmount += t.amount;
    } else if (t.qualifiedInvoice === false) {
      nonQualifiedAmount += t.amount;
      nonQualifiedCount += 1;
    } else {
      unjudgedAmount += t.amount;
      unjudgedCount += 1;
    }
  }

  return {
    totalExpenseAmount: expenses.reduce((s, t) => s + t.amount, 0),
    qualifiedAmount,
    nonQualifiedAmount,
    unjudgedAmount,
    nonQualifiedCount,
    unjudgedCount,
  };
}

// ============================================================
// 決算書（青色申告決算書 / 収支内訳書 スタイル）サマリー
// ============================================================

export interface CategoryBreakdownRow {
  category: string;
  amount: number; // 税抜合計
  count: number;
}

export interface ClosingStatement {
  incomeByCategory: CategoryBreakdownRow[];
  expenseByCategory: CategoryBreakdownRow[];
  totalIncome: number; // 収入金額合計（税抜）
  totalExpense: number; // 必要経費合計（税抜）
  grossProfit: number; // 差引金額（収入 - 経費）
  blueReturnDeduction: number; // 青色申告特別控除額（適用時のみ）
  taxableBusinessIncome: number; // 青色申告特別控除後の事業所得
  progressiveTax: ProgressiveTaxResult; // 基礎控除のみを考慮した概算累進課税額
  invoiceCompliance: InvoiceComplianceSummary;
  periodLabel: string;
}

export function buildClosingStatement(
  transactions: Transaction[],
  taxSettings: TaxSettings,
  year: number
): ClosingStatement {
  const inYear = transactions.filter((t) => t.date && t.date.startsWith(String(year)));

  const groupBy = (items: Transaction[]): CategoryBreakdownRow[] => {
    const map = new Map<string, { amount: number; count: number }>();
    for (const t of items) {
      const key = t.category || (t.type === 'income' ? '売上高' : '雑費');
      const prev = map.get(key) || { amount: 0, count: 0 };
      map.set(key, { amount: prev.amount + t.amount, count: prev.count + 1 });
    }
    return Array.from(map.entries())
      .map(([category, v]) => ({ category, amount: v.amount, count: v.count }))
      .sort((a, b) => b.amount - a.amount);
  };

  const incomeItems = inYear.filter((t) => t.type === 'income');
  const expenseItems = inYear.filter((t) => t.type === 'expense');

  const incomeByCategory = groupBy(incomeItems);
  const expenseByCategory = groupBy(expenseItems);

  const totalIncome = incomeByCategory.reduce((s, r) => s + r.amount, 0);
  const totalExpense = expenseByCategory.reduce((s, r) => s + r.amount, 0);
  const grossProfit = totalIncome - totalExpense;

  const blueDeduction = taxSettings.applyBlueReturn ? Math.min(taxSettings.blueReturnDeduction, Math.max(0, grossProfit)) : 0;
  const taxableBusinessIncome = Math.max(0, grossProfit - blueDeduction);

  // 参考: 事業所得のみ・基礎控除のみを引いた概算課税所得で累進課税額を試算
  const referenceTaxableIncome = Math.max(0, taxableBusinessIncome - BASIC_DEDUCTION);
  const progressiveTax = calculateProgressiveIncomeTax(referenceTaxableIncome);

  const invoiceCompliance = buildInvoiceComplianceSummary(inYear);

  return {
    incomeByCategory,
    expenseByCategory,
    totalIncome,
    totalExpense,
    grossProfit,
    blueReturnDeduction: blueDeduction,
    taxableBusinessIncome,
    progressiveTax,
    invoiceCompliance,
    periodLabel: `${year}年 1月1日 〜 12月31日`,
  };
}
