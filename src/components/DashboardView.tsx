import React, { useState, useMemo } from 'react';
import { Transaction, TaxSettings, ViewTab } from '../types';
import { CashflowTrendChart } from './CashflowTrendChart';
import { 
  TrendingUp, 
  TrendingDown, 
  Wallet, 
  Receipt, 
  PiggyBank, 
  ShieldAlert, 
  ArrowRight, 
  Sparkles, 
  PlusCircle, 
  Calendar,
  Layers,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';

interface DashboardViewProps {
  transactions: Transaction[];
  taxSettings: TaxSettings;
  onNavigate: (tab: ViewTab) => void;
}

type PeriodMode = 'today' | 'this_month' | 'all';

export const DashboardView: React.FC<DashboardViewProps> = ({
  transactions,
  taxSettings,
  onNavigate,
}) => {
  const [periodMode, setPeriodMode] = useState<PeriodMode>('this_month');

  const today = useMemo(() => new Date(), []);
  const todayStr = useMemo(() => today.toISOString().slice(0, 10), [today]);
  const currentMonthStr = useMemo(() => todayStr.slice(0, 7), [todayStr]);

  // Filter transactions based on view period
  const { filteredTransactions, periodLabel } = useMemo(() => {
    if (transactions.length === 0) {
      return { filteredTransactions: [], periodLabel: '全期間' };
    }

    if (periodMode === 'today') {
      const filtered = transactions.filter((t) => t.date === todayStr);
      const formattedDate = `${today.getFullYear()}/${String(today.getMonth() + 1).padStart(2, '0')}/${String(today.getDate()).padStart(2, '0')}`;
      return {
        filteredTransactions: filtered,
        periodLabel: `本日 (${formattedDate})`,
      };
    }

    if (periodMode === 'this_month') {
      const filtered = transactions.filter((t) => t.date.startsWith(currentMonthStr));
      const formattedMonth = `${today.getFullYear()}年${today.getMonth() + 1}月`;
      return {
        filteredTransactions: filtered,
        periodLabel: `今月 (${formattedMonth})`,
      };
    }

    return {
      filteredTransactions: transactions,
      periodLabel: '全期間 (累計)',
    };
  }, [transactions, periodMode, today, todayStr, currentMonthStr]);

  // Financial Calculations matching Streamlit Python code
  const sales = useMemo(() => {
    return filteredTransactions
      .filter((t) => t.type === 'income')
      .reduce((sum, t) => sum + t.amount, 0);
  }, [filteredTransactions]);

  const expenses = useMemo(() => {
    return filteredTransactions
      .filter((t) => t.type === 'expense')
      .reduce((sum, t) => sum + t.amount, 0);
  }, [filteredTransactions]);

  // Actual tax-inclusive sales total, summed from each transaction's own `total`
  // (which reflects its own tax rate — 10% standard or 8% reduced) rather than
  // approximated by applying one flat rate to the tax-exclusive sum.
  const salesTotalWithTax = useMemo(() => {
    return filteredTransactions
      .filter((t) => t.type === 'income')
      .reduce((sum, t) => sum + t.total, 0);
  }, [filteredTransactions]);

  // Operating Profit (事業利益) = 売上 - 経費
  const operatingProfit = sales - expenses;

  // Tax and Deductions Simulation
  const { incomeTax, residentTax, healthIns, totalDeductions, takeHomePay } = useMemo(() => {
    if (operatingProfit > 0) {
      let taxableBase = operatingProfit;
      
      // Optional Blue Return Deduction simulation if enabled in settings
      if (taxSettings.applyBlueReturn && taxSettings.blueReturnDeduction > 0) {
        taxableBase = Math.max(0, taxableBase - taxSettings.blueReturnDeduction);
      }

      const iTax = Math.round(taxableBase * taxSettings.estimatedIncomeTaxRate);
      const rTax = Math.round(taxableBase * taxSettings.estimatedResidentTaxRate);
      const hIns = Math.round(taxableBase * taxSettings.estimatedHealthInsRate);
      const deductions = iTax + rTax + hIns;
      const net = operatingProfit - deductions;

      return {
        incomeTax: iTax,
        residentTax: rTax,
        healthIns: hIns,
        totalDeductions: deductions,
        takeHomePay: net,
      };
    } else {
      return {
        incomeTax: 0,
        residentTax: 0,
        healthIns: 0,
        totalDeductions: 0,
        takeHomePay: operatingProfit,
      };
    }
  }, [operatingProfit, taxSettings]);

  // Expenses Category breakdown
  const categoryBreakdown = useMemo(() => {
    const map: { [key: string]: number } = {};
    filteredTransactions
      .filter((t) => t.type === 'expense')
      .forEach((t) => {
        const cat = t.category || '未分類';
        map[cat] = (map[cat] || 0) + t.amount;
      });
    return Object.entries(map)
      .map(([name, amount]) => ({ name, amount }))
      .sort((a, b) => b.amount - a.amount);
  }, [filteredTransactions]);

  const hasData = transactions.length > 0;
  const isProfitable = operatingProfit > 0;

  return (
    <div className="space-y-6 pb-12">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2.5">
            ダッシュボード ＆ リアルタイム手取り計算
          </h2>
          <p className="text-sm text-slate-600 mt-1">
            売上と経費から、税金・保険料を自動計算し、最終的なあなたの<strong className="text-indigo-700 font-semibold">手取り（純利益）</strong>を算出します。
          </p>
        </div>

        {/* Quick action buttons */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            id="quick-add-ocr"
            onClick={() => onNavigate('ocr')}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-semibold shadow-xs transition-colors"
          >
            <Sparkles className="w-4 h-4" />
            AIレシート読取
          </button>
          <button
            id="quick-add-sales"
            onClick={() => onNavigate('sales')}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-xs transition-colors"
          >
            <PlusCircle className="w-4 h-4" />
            売上登録
          </button>
        </div>
      </div>

      {!hasData ? (
        <div className="bg-white rounded-2xl p-10 border border-slate-200 text-center shadow-xs">
          <div className="w-16 h-16 rounded-2xl bg-indigo-50 text-indigo-600 mx-auto flex items-center justify-center mb-4">
            <Receipt className="w-8 h-8" />
          </div>
          <h3 className="text-lg font-bold text-slate-900 mb-1">取引データがありません</h3>
          <p className="text-sm text-slate-500 max-w-md mx-auto mb-6">
            売上またはレシート（経費）を登録すると、リアルタイムで税金・保険料・手取り額が自動算出されます。
          </p>
          <div className="flex justify-center gap-3">
            <button
              onClick={() => onNavigate('ocr')}
              className="px-4 py-2.5 rounded-xl bg-amber-500 text-white text-sm font-semibold shadow-xs hover:bg-amber-600 transition"
            >
              📸 AIレシートを読み取る
            </button>
            <button
              onClick={() => onNavigate('sales')}
              className="px-4 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-semibold shadow-xs hover:bg-indigo-700 transition"
            >
              💰 売上を手動登録する
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* Period Selector Tabs matching Streamlit radio */}
          <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
              <Calendar className="w-4 h-4 text-slate-400" />
              <span>表示期間:</span>
            </div>
            <div className="flex items-center gap-1.5 p-1 bg-slate-100/80 rounded-xl">
              <button
                id="period-today"
                onClick={() => setPeriodMode('today')}
                className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  periodMode === 'today'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                本日のサマリー
              </button>
              <button
                id="period-month"
                onClick={() => setPeriodMode('this_month')}
                className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  periodMode === 'this_month'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                今月のサマリー
              </button>
              <button
                id="period-all"
                onClick={() => setPeriodMode('all')}
                className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  periodMode === 'all'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                全期間
              </button>
            </div>
          </div>

          {/* Section: 経営状況と手取り額 */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-sm bg-indigo-600 inline-block"></span>
                ■ {periodLabel} の経営状況と手取り額
              </h3>
              <span className="text-xs text-slate-500 font-medium">
                対象明細: {filteredTransactions.length} 件
              </span>
            </div>

            {/* Top Row: Sales, Expenses, Operating Profit */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Sales Card */}
              <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs relative overflow-hidden">
                <div className="flex items-center justify-between text-slate-500 mb-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    総売上 (税抜)
                  </span>
                  <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                    <TrendingUp className="w-4 h-4" />
                  </div>
                </div>
                <div className="text-2xl lg:text-3xl font-extrabold text-slate-900 tracking-tight">
                  ¥ {Math.round(sales).toLocaleString()}
                </div>
                <div className="mt-2 text-[11px] text-slate-500 flex items-center gap-1">
                  <span>税込合計: ¥ {Math.round(salesTotalWithTax).toLocaleString()}</span>
                </div>
              </div>

              {/* Expenses Card */}
              <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs relative overflow-hidden">
                <div className="flex items-center justify-between text-slate-500 mb-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    総経費 (税抜)
                  </span>
                  <div className="w-8 h-8 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center">
                    <TrendingDown className="w-4 h-4" />
                  </div>
                </div>
                <div className="text-2xl lg:text-3xl font-extrabold text-slate-900 tracking-tight">
                  ¥ {Math.round(expenses).toLocaleString()}
                </div>
                <div className="mt-2 text-[11px] text-slate-500 flex items-center gap-1">
                  <span>経費率: {sales > 0 ? `${Math.round((expenses / sales) * 100)}%` : '0%'}</span>
                </div>
              </div>

              {/* Operating Profit Card */}
              <div className={`bg-white rounded-2xl p-5 border shadow-xs relative overflow-hidden ${
                isProfitable ? 'border-indigo-200 bg-gradient-to-br from-white to-indigo-50/30' : 'border-amber-200 bg-gradient-to-br from-white to-amber-50/30'
              }`}>
                <div className="flex items-center justify-between text-slate-500 mb-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-700">
                    事業利益 (売上 - 経費)
                  </span>
                  <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                    isProfitable ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                  }`}>
                    {isProfitable ? '▲ 黒字' : '▼ 赤字'}
                  </span>
                </div>
                <div className={`text-2xl lg:text-3xl font-extrabold tracking-tight ${
                  isProfitable ? 'text-indigo-700' : 'text-rose-600'
                }`}>
                  ¥ {Math.round(operatingProfit).toLocaleString()}
                </div>
                <div className="mt-2 text-[11px] text-slate-500">
                  利益率: {sales > 0 ? `${Math.round((operatingProfit / sales) * 100)}%` : '0%'}
                </div>
              </div>
            </div>

            {/* Divider */}
            <div className="relative py-2">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-200"></div>
              </div>
              <div className="relative flex justify-center">
                <span className="bg-slate-50 px-3 text-xs font-semibold text-slate-400">
                  シミュレーション内訳
                </span>
              </div>
            </div>

            {/* Middle Section: 引かれるお金 (税金・保険料の自動シミュレーション) */}
            <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <ShieldAlert className="w-4 h-4 text-amber-500" />
                    ⚠️ 引かれるお金（税金・保険料の自動シミュレーション）
                  </h4>
                  <p className="text-xs text-slate-500 mt-0.5">
                    事業所得（利益）に応じて発生する税金・社会保険料の概算シミュレーションです（設定で税率変更可能）。
                  </p>
                </div>
                <button
                  onClick={() => onNavigate('settings')}
                  className="text-xs text-indigo-600 hover:text-indigo-700 font-semibold hover:underline"
                >
                  税率を変更する →
                </button>
              </div>

              {/* 4 Deduction metric columns matching Streamlit */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 pt-2">
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-100">
                  <div className="text-xs font-semibold text-slate-500">
                    所得税 (概算{Math.round(taxSettings.estimatedIncomeTaxRate * 100)}%)
                  </div>
                  <div className="text-lg font-bold text-rose-600 mt-1">
                    - ¥ {incomeTax.toLocaleString()}
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-slate-50 border border-slate-100">
                  <div className="text-xs font-semibold text-slate-500">
                    住民税 (概算{Math.round(taxSettings.estimatedResidentTaxRate * 100)}%)
                  </div>
                  <div className="text-lg font-bold text-rose-600 mt-1">
                    - ¥ {residentTax.toLocaleString()}
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-slate-50 border border-slate-100">
                  <div className="text-xs font-semibold text-slate-500">
                    国民健康保険 (概算{Math.round(taxSettings.estimatedHealthInsRate * 100)}%)
                  </div>
                  <div className="text-lg font-bold text-rose-600 mt-1">
                    - ¥ {healthIns.toLocaleString()}
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-rose-50/70 border border-rose-100">
                  <div className="text-xs font-bold text-rose-800">
                    控除合計 (概算計{Math.round((taxSettings.estimatedIncomeTaxRate + taxSettings.estimatedResidentTaxRate + taxSettings.estimatedHealthInsRate) * 100)}%)
                  </div>
                  <div className="text-lg font-extrabold text-rose-700 mt-1">
                    - ¥ {totalDeductions.toLocaleString()}
                  </div>
                </div>
              </div>
            </div>

            {/* Bottom Highlight: 最終手取り額（あなたが自由に使えるお金） */}
            <div className="bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 rounded-2xl p-6 md:p-8 text-white shadow-md relative overflow-hidden">
              <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
                <div>
                  <div className="flex items-center gap-2 text-indigo-200 text-xs font-bold tracking-wider uppercase mb-1">
                    <Wallet className="w-4 h-4" />
                    <span>リアルタイム手取り確定額</span>
                  </div>
                  <h3 className="text-xl md:text-2xl lg:text-3xl font-extrabold tracking-tight text-white flex items-baseline gap-2 flex-wrap">
                    <span>💸 最終手取り額:</span>
                    <span className="text-3xl md:text-4xl lg:text-5xl font-black text-amber-300">
                      ¥ {Math.round(takeHomePay).toLocaleString()}
                    </span>
                  </h3>
                  <p className="text-xs text-indigo-200/90 mt-2 max-w-xl">
                    総売上から経費・概算税金・社会保険料（計30%）を差し引いた、<strong>「あなたが今月・本日自由に使える純利益」</strong>です。
                  </p>
                </div>

                <div className="shrink-0 bg-white/10 backdrop-blur-xs p-4 rounded-xl border border-white/15 text-center min-w-[140px]">
                  <div className="text-[11px] text-indigo-200 font-medium">手取り率</div>
                  <div className="text-2xl font-extrabold text-white mt-0.5">
                    {sales > 0 ? `${Math.max(0, Math.round((takeHomePay / sales) * 100))}%` : '0%'}
                  </div>
                  <div className="text-[10px] text-indigo-300 mt-0.5">売上対比</div>
                </div>
              </div>
            </div>

            {/* Visual Cashflow Breakdown Bar */}
            {sales > 0 && (
              <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs space-y-3">
                <div className="flex items-center justify-between text-xs font-bold text-slate-700">
                  <span className="flex items-center gap-1.5">
                    <Layers className="w-4 h-4 text-indigo-600" />
                    売上の内訳フロー (100% 構成比)
                  </span>
                  <span className="text-slate-400 font-normal">
                    総売上: ¥{Math.round(sales).toLocaleString()}
                  </span>
                </div>

                {/* Multi-segment progress bar */}
                <div className="h-4 w-full bg-slate-100 rounded-full overflow-hidden flex shadow-inner">
                  <div
                    title={`経費: ¥${Math.round(expenses).toLocaleString()} (${Math.round((expenses / sales) * 100)}%)`}
                    style={{ width: `${Math.min(100, Math.max(0, (expenses / sales) * 100))}%` }}
                    className="bg-rose-500 transition-all duration-500"
                  />
                  <div
                    title={`税金・保険料: ¥${Math.round(totalDeductions).toLocaleString()} (${Math.round((totalDeductions / sales) * 100)}%)`}
                    style={{ width: `${Math.min(100, Math.max(0, (totalDeductions / sales) * 100))}%` }}
                    className="bg-amber-400 transition-all duration-500"
                  />
                  <div
                    title={`最終手取り: ¥${Math.round(takeHomePay).toLocaleString()} (${Math.round((takeHomePay / sales) * 100)}%)`}
                    style={{ width: `${Math.min(100, Math.max(0, (takeHomePay / sales) * 100))}%` }}
                    className="bg-emerald-500 transition-all duration-500"
                  />
                </div>

                {/* Legend */}
                <div className="flex flex-wrap items-center justify-between gap-3 text-xs pt-1">
                  <div className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded-full bg-rose-500"></span>
                    <span className="text-slate-600">経費:</span>
                    <strong className="text-slate-900">
                      ¥{Math.round(expenses).toLocaleString()} ({Math.round((expenses / sales) * 100)}%)
                    </strong>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded-full bg-amber-400"></span>
                    <span className="text-slate-600">税金・社会保険:</span>
                    <strong className="text-slate-900">
                      ¥{Math.round(totalDeductions).toLocaleString()} ({Math.round((totalDeductions / sales) * 100)}%)
                    </strong>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded-full bg-emerald-500"></span>
                    <span className="text-slate-600">手取り（純利益）:</span>
                    <strong className="text-emerald-700 font-bold">
                      ¥{Math.round(takeHomePay).toLocaleString()} ({Math.round((takeHomePay / sales) * 100)}%)
                    </strong>
                  </div>
                </div>
              </div>
            )}

            {/* 30-Day Sales & Expense Cashflow Trend Line Chart */}
            <CashflowTrendChart transactions={transactions} />

            {/* Category Breakdown & Recent Transactions for Period */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 pt-2">
              {/* Expense Category Breakdown */}
              <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs space-y-3">
                <h4 className="text-sm font-bold text-slate-900 flex items-center justify-between">
                  <span>経費科目別内訳</span>
                  <span className="text-xs text-slate-400 font-normal">計 {categoryBreakdown.length} 区分</span>
                </h4>
                {categoryBreakdown.length === 0 ? (
                  <p className="text-xs text-slate-400 py-6 text-center">経費データはありません</p>
                ) : (
                  <div className="space-y-2.5">
                    {categoryBreakdown.slice(0, 5).map((cat) => {
                      const pct = expenses > 0 ? Math.round((cat.amount / expenses) * 100) : 0;
                      return (
                        <div key={cat.name} className="space-y-1">
                          <div className="flex justify-between text-xs font-medium">
                            <span className="text-slate-700">{cat.name}</span>
                            <span className="text-slate-900 font-bold">
                              ¥ {Math.round(cat.amount).toLocaleString()}{' '}
                              <span className="text-slate-400 text-[11px] font-normal">({pct}%)</span>
                            </span>
                          </div>
                          <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                            <div
                              style={{ width: `${pct}%` }}
                              className="h-full bg-indigo-500 rounded-full"
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Recent Activity */}
              <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs space-y-3 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-sm font-bold text-slate-900">最近の登録明細</h4>
                    <button
                      onClick={() => onNavigate('ledger')}
                      className="text-xs text-indigo-600 hover:text-indigo-700 font-semibold flex items-center gap-1"
                    >
                      仕訳帳を開く <ArrowRight className="w-3 h-3" />
                    </button>
                  </div>
                  <div className="space-y-2">
                    {filteredTransactions.slice(0, 4).map((t) => (
                      <div
                        key={t.id}
                        className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-100 text-xs"
                      >
                        <div className="flex items-center gap-2 truncate pr-2">
                          <span
                            className={`w-2 h-2 rounded-full shrink-0 ${
                              t.type === 'income' ? 'bg-emerald-500' : 'bg-rose-500'
                            }`}
                          />
                          <div className="truncate">
                            <div className="font-semibold text-slate-800 truncate">
                              {t.description || t.merchant || '摘要なし'}
                            </div>
                            <div className="text-[10px] text-slate-400">
                              {t.date} · {t.category}
                            </div>
                          </div>
                        </div>
                        <div
                          className={`font-bold shrink-0 ${
                            t.type === 'income' ? 'text-emerald-700' : 'text-slate-800'
                          }`}
                        >
                          {t.type === 'income' ? '+' : '-'}¥ {Math.round(t.amount).toLocaleString()}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                  <span>AI読取件数: {transactions.filter((t) => t.source === 'ai_ocr').length}件</span>
                  <span>手動登録: {transactions.filter((t) => t.source === 'manual').length}件</span>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
