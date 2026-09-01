import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Transaction, TransactionType } from '../types';
import { exportTransactionsToCsv } from '../data/storage';
import { EditTransactionModal } from './EditTransactionModal';
import { ManualExpenseModal } from './ManualExpenseModal';
import { getCategoryBadgeStyle } from '../data/categories';
import { 
  FileText, 
  Search, 
  Filter, 
  Download, 
  Plus, 
  Trash2, 
  Edit3, 
  RotateCcw, 
  Calendar, 
  Sparkles,
  ArrowUpDown,
  Building2,
  Tag,
  ChevronDown,
  CheckCircle2
} from 'lucide-react';

interface TransactionLedgerViewProps {
  transactions: Transaction[];
  onUpdateTransaction: (updated: Transaction) => void;
  onDeleteTransaction: (id: string) => void;
  onAddTransaction: (tx: Omit<Transaction, 'id' | 'createdAt'>) => void;
  onResetToDefaults: () => void;
}

export const TransactionLedgerView: React.FC<TransactionLedgerViewProps> = ({
  transactions,
  onUpdateTransaction,
  onDeleteTransaction,
  onAddTransaction,
  onResetToDefaults,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'income' | 'expense'>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [monthFilter, setMonthFilter] = useState<string>('all');
  const [sortField, setSortField] = useState<'date' | 'amount' | 'total'>('date');
  const [sortAsc, setSortAsc] = useState(false);

  // Modals & Menu state
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [isManualExpenseOpen, setIsManualExpenseOpen] = useState(false);
  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);
  const [downloadToast, setDownloadToast] = useState<string | null>(null);

  const exportMenuRef = useRef<HTMLDivElement>(null);

  // Close export dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(event.target as Node)) {
        setIsExportMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Available unique months for dropdown
  const availableMonths = useMemo(() => {
    const months = new Set<string>();
    transactions.forEach((t) => {
      if (t.date && t.date.length >= 7) {
        months.add(t.date.slice(0, 7));
      }
    });
    return Array.from(months).sort().reverse();
  }, [transactions]);

  // Available unique categories
  const availableCategories = useMemo(() => {
    const cats = new Set<string>();
    transactions.forEach((t) => {
      if (t.category) {
        cats.add(t.category);
      }
    });
    return Array.from(cats).sort();
  }, [transactions]);

  // Filtered and sorted transactions
  const filteredList = useMemo(() => {
    return transactions
      .filter((t) => {
        // Type filter
        if (typeFilter !== 'all' && t.type !== typeFilter) return false;
        // Month filter
        if (monthFilter !== 'all' && !t.date.startsWith(monthFilter)) return false;
        // Category filter
        if (categoryFilter !== 'all' && t.category !== categoryFilter) return false;
        // Search term
        if (searchTerm.trim()) {
          const term = searchTerm.toLowerCase();
          const matchDesc = (t.description || '').toLowerCase().includes(term);
          const matchMerchant = (t.merchant || '').toLowerCase().includes(term);
          const matchCategory = (t.category || '').toLowerCase().includes(term);
          const matchId = (t.id || '').toLowerCase().includes(term);
          if (!matchDesc && !matchMerchant && !matchCategory && !matchId) return false;
        }
        return true;
      })
      .sort((a, b) => {
        if (sortField === 'date') {
          const cmp = a.date.localeCompare(b.date);
          return sortAsc ? cmp : -cmp;
        }
        if (sortField === 'amount') {
          return sortAsc ? a.amount - b.amount : b.amount - a.amount;
        }
        if (sortField === 'total') {
          return sortAsc ? a.total - b.total : b.total - a.total;
        }
        return 0;
      });
  }, [transactions, typeFilter, monthFilter, categoryFilter, searchTerm, sortField, sortAsc]);

  // Aggregated totals for currently filtered items
  const filteredSales = useMemo(() => {
    return filteredList
      .filter((t) => t.type === 'income')
      .reduce((sum, t) => sum + t.amount, 0);
  }, [filteredList]);

  const filteredExpenses = useMemo(() => {
    return filteredList
      .filter((t) => t.type === 'expense')
      .reduce((sum, t) => sum + t.amount, 0);
  }, [filteredList]);

  const filteredProfit = filteredSales - filteredExpenses;

  const toggleSort = (field: 'date' | 'amount' | 'total') => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(false);
    }
  };

  // CSV download handlers
  const handleDownloadFilteredCsv = () => {
    if (filteredList.length === 0) return;
    const nowStr = new Date().toISOString().slice(0, 10);
    const filterTag = monthFilter !== 'all' ? `_${monthFilter}` : '';
    const typeTag = typeFilter !== 'all' ? `_${typeFilter === 'income' ? '売上' : '経費'}` : '';
    const filename = `取引明細${filterTag}${typeTag}_${filteredList.length}件_${nowStr}.csv`;

    exportTransactionsToCsv(filteredList, filename);
    setIsExportMenuOpen(false);
    showToast(`✅ 表示中の明細 ${filteredList.length} 件を CSV ダウンロードしました`);
  };

  const handleDownloadAllCsv = () => {
    if (transactions.length === 0) return;
    const nowStr = new Date().toISOString().slice(0, 10);
    const filename = `取引明細_全件_${transactions.length}件_${nowStr}.csv`;

    exportTransactionsToCsv(transactions, filename);
    setIsExportMenuOpen(false);
    showToast(`✅ 全取引明細 ${transactions.length} 件を CSV ダウンロードしました`);
  };

  const showToast = (msg: string) => {
    setDownloadToast(msg);
    setTimeout(() => {
      setDownloadToast(null);
    }, 4000);
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Toast Notification */}
      {downloadToast && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white text-xs font-bold px-4 py-3 rounded-2xl shadow-xl border border-slate-700 flex items-center gap-2 animate-in fade-in slide-in-from-bottom-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{downloadToast}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
            📋 取引明細・仕訳帳
          </h2>
          <p className="text-sm text-slate-600 mt-1">
            登録されたすべての売上・経費明細の一覧です。編集・削除・CSV形式でのダウンロードが可能です。
          </p>
        </div>

        {/* Action buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setIsManualExpenseOpen(true)}
            className="px-3.5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition flex items-center gap-1.5 shadow-xs cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            経費を手動追加
          </button>

          {/* Enhanced CSV Download Dropdown */}
          <div className="relative" ref={exportMenuRef}>
            <div className="inline-flex rounded-xl shadow-xs">
              <button
                type="button"
                id="btn-download-csv-primary"
                onClick={handleDownloadFilteredCsv}
                disabled={filteredList.length === 0}
                className="px-3.5 py-2 rounded-l-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                title="表示中の明細をCSV出力"
              >
                <Download className="w-3.5 h-3.5" />
                CSVダウンロード
              </button>
              <button
                type="button"
                id="btn-download-csv-menu"
                onClick={() => setIsExportMenuOpen(!isExportMenuOpen)}
                disabled={transactions.length === 0}
                className="px-2 py-2 rounded-r-xl bg-indigo-700 hover:bg-indigo-800 text-white text-xs font-bold border-l border-indigo-500/40 transition flex items-center justify-center disabled:opacity-50 cursor-pointer"
                title="出力オプション"
              >
                <ChevronDown className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Dropdown Menu */}
            {isExportMenuOpen && (
              <div className="absolute right-0 mt-2 w-64 bg-white rounded-2xl shadow-xl border border-slate-200 py-1.5 z-30 text-xs animate-in fade-in zoom-in-95">
                <div className="px-3 py-1.5 text-[11px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100">
                  CSVエクスポート (UTF-8 BOM付)
                </div>

                <button
                  type="button"
                  onClick={handleDownloadFilteredCsv}
                  disabled={filteredList.length === 0}
                  className="w-full px-3 py-2.5 text-left text-slate-700 hover:bg-indigo-50 hover:text-indigo-700 flex items-center justify-between transition font-medium disabled:opacity-40"
                >
                  <div className="flex items-center gap-2">
                    <Download className="w-3.5 h-3.5 text-indigo-600" />
                    <span>表示中の明細を出力</span>
                  </div>
                  <span className="text-[11px] font-bold bg-slate-100 px-1.5 py-0.5 rounded text-slate-600">
                    {filteredList.length} 件
                  </span>
                </button>

                <button
                  type="button"
                  onClick={handleDownloadAllCsv}
                  disabled={transactions.length === 0}
                  className="w-full px-3 py-2.5 text-left text-slate-700 hover:bg-indigo-50 hover:text-indigo-700 flex items-center justify-between transition font-medium disabled:opacity-40"
                >
                  <div className="flex items-center gap-2">
                    <FileText className="w-3.5 h-3.5 text-slate-500" />
                    <span>全期間・全明細を出力</span>
                  </div>
                  <span className="text-[11px] font-bold bg-slate-100 px-1.5 py-0.5 rounded text-slate-600">
                    {transactions.length} 件
                  </span>
                </button>
                <div className="px-3 py-1.5 text-[10px] text-slate-400 border-t border-slate-100">
                  ※ Excel、Numbers、freee、マネーフォワード等で開けます
                </div>
              </div>
            )}
          </div>

          <button
            onClick={() => {
              if (confirm('初期サンプルデータにリセットしますか？現在のデータは上書きされます。')) {
                onResetToDefaults();
              }
            }}
            className="px-3 py-2 rounded-xl border border-slate-200 text-slate-500 hover:text-slate-800 text-xs font-medium transition cursor-pointer"
            title="サンプルデータ再読み込み"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3">
          {/* Search box */}
          <div className="lg:col-span-4 relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="摘要・店舗名・科目・IDで検索..."
              className="w-full pl-9 pr-4 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
            />
          </div>

          {/* Type Filter */}
          <div className="lg:col-span-3 flex items-center gap-1 bg-slate-100/80 p-1 rounded-xl">
            <button
              onClick={() => setTypeFilter('all')}
              className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                typeFilter === 'all' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
              }`}
            >
              すべて
            </button>
            <button
              onClick={() => setTypeFilter('income')}
              className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                typeFilter === 'income' ? 'bg-white text-emerald-700 shadow-xs' : 'text-slate-600'
              }`}
            >
              🔵 売上
            </button>
            <button
              onClick={() => setTypeFilter('expense')}
              className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                typeFilter === 'expense' ? 'bg-white text-rose-700 shadow-xs' : 'text-slate-600'
              }`}
            >
              🔴 経費
            </button>
          </div>

          {/* Category Filter */}
          <div className="lg:col-span-3">
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-medium bg-white"
            >
              <option value="all">すべての科目・カテゴリー</option>
              {availableCategories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          {/* Month Filter */}
          <div className="lg:col-span-2">
            <select
              value={monthFilter}
              onChange={(e) => setMonthFilter(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-medium bg-white"
            >
              <option value="all">全期間 (すべて)</option>
              {availableMonths.map((m) => (
                <option key={m} value={m}>
                  {m.replace('-', '年')}月
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Filter Summary Banner & Quick CSV Export link */}
        <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-3">
            <span className="text-slate-500 font-medium">
              表示中: <strong>{filteredList.length}</strong> 件 / 全 {transactions.length} 件
            </span>
            <button
              type="button"
              onClick={handleDownloadFilteredCsv}
              disabled={filteredList.length === 0}
              className="text-indigo-600 hover:text-indigo-800 font-bold flex items-center gap-1 hover:underline cursor-pointer disabled:opacity-50"
            >
              <Download className="w-3 h-3" />
              この一覧をCSV保存
            </button>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-emerald-700 font-semibold">
              売上計: ¥{Math.round(filteredSales).toLocaleString()}
            </span>
            <span className="text-rose-700 font-semibold">
              経費計: ¥{Math.round(filteredExpenses).toLocaleString()}
            </span>
            <span className="text-indigo-900 font-bold bg-indigo-50 px-2 py-0.5 rounded-md">
              差引利益: ¥{Math.round(filteredProfit).toLocaleString()}
            </span>
          </div>
        </div>
      </div>

      {/* Main Data Table matching Streamlit dataframe */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        {filteredList.length === 0 ? (
          <div className="p-12 text-center text-slate-400 text-sm">
            該当する取引明細はありません。
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-600 font-bold">
                  <th className="py-3.5 px-4 w-14">ID</th>
                  <th
                    className="py-3.5 px-4 cursor-pointer hover:text-indigo-600 select-none"
                    onClick={() => toggleSort('date')}
                  >
                    <div className="flex items-center gap-1">
                      <span>日付</span>
                      <ArrowUpDown className="w-3 h-3 text-slate-400" />
                    </div>
                  </th>
                  <th className="py-3.5 px-4">種別</th>
                  <th className="py-3.5 px-4">勘定科目</th>
                  <th className="py-3.5 px-4">店舗・取引先</th>
                  <th className="py-3.5 px-4 min-w-[200px]">摘要</th>
                  <th
                    className="py-3.5 px-4 text-right cursor-pointer hover:text-indigo-600 select-none"
                    onClick={() => toggleSort('amount')}
                  >
                    <div className="flex items-center justify-end gap-1">
                      <span>税抜金額</span>
                      <ArrowUpDown className="w-3 h-3 text-slate-400" />
                    </div>
                  </th>
                  <th className="py-3.5 px-4 text-right">消費税</th>
                  <th
                    className="py-3.5 px-4 text-right cursor-pointer hover:text-indigo-600 select-none"
                    onClick={() => toggleSort('total')}
                  >
                    <div className="flex items-center justify-end gap-1">
                      <span>税込合計</span>
                      <ArrowUpDown className="w-3 h-3 text-slate-400" />
                    </div>
                  </th>
                  <th className="py-3.5 px-4 text-center">登録元</th>
                  <th className="py-3.5 px-4 text-center">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredList.map((t) => {
                  const isIncome = t.type === 'income';
                  return (
                    <tr
                      key={t.id}
                      className="hover:bg-slate-50/80 transition-colors group"
                    >
                      {/* ID */}
                      <td className="py-3 px-4 text-slate-400 font-mono text-[11px]">
                        {t.id.replace('tx-', '#')}
                      </td>

                      {/* Date */}
                      <td className="py-3 px-4 font-semibold text-slate-800 whitespace-nowrap">
                        {t.date}
                      </td>

                      {/* Type (matching Streamlit 🔵 売上 / 🔴 経費) */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold ${
                            isIncome
                              ? 'bg-blue-50 text-blue-700 border border-blue-200'
                              : 'bg-rose-50 text-rose-700 border border-rose-200'
                          }`}
                        >
                          {isIncome ? '🔵 売上' : '🔴 経費'}
                        </span>
                      </td>

                      {/* Category */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span className={`px-2 py-0.5 rounded text-[11px] font-bold border ${getCategoryBadgeStyle(t.category, isIncome ? 'income' : 'expense')}`}>
                          {t.category || (isIncome ? '売上高' : '消耗品費')}
                        </span>
                      </td>

                      {/* Merchant */}
                      <td className="py-3 px-4 text-slate-700 font-medium whitespace-nowrap truncate max-w-[140px]">
                        {t.merchant || '-'}
                      </td>

                      {/* Description */}
                      <td className="py-3 px-4 text-slate-800 font-medium">
                        {t.description || '-'}
                      </td>

                      {/* Amount (税抜) */}
                      <td
                        className={`py-3 px-4 text-right font-bold whitespace-nowrap ${
                          isIncome ? 'text-blue-700' : 'text-slate-800'
                        }`}
                      >
                        ¥ {Math.round(t.amount).toLocaleString()}
                      </td>

                      {/* Tax */}
                      <td className="py-3 px-4 text-right text-slate-500 whitespace-nowrap">
                        ¥ {Math.round(t.tax).toLocaleString()}
                      </td>

                      {/* Total (税込) */}
                      <td
                        className={`py-3 px-4 text-right font-extrabold whitespace-nowrap ${
                          isIncome ? 'text-blue-800' : 'text-slate-900'
                        }`}
                      >
                        ¥ {Math.round(t.total).toLocaleString()}
                      </td>

                      {/* Source */}
                      <td className="py-3 px-4 text-center whitespace-nowrap">
                        {t.source === 'ai_ocr' ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded">
                            <Sparkles className="w-2.5 h-2.5" />
                            AI読取
                          </span>
                        ) : (
                          <span className="text-[10px] text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">
                            手動
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-4 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => setEditingTransaction(t)}
                            className="p-1 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition"
                            title="編集"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => {
                              if (confirm(`「${t.description || t.merchant}」を削除しますか？`)) {
                                onDeleteTransaction(t.id);
                              }
                            }}
                            className="p-1 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition"
                            title="削除"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Edit Modal */}
      {editingTransaction && (
        <EditTransactionModal
          transaction={editingTransaction}
          isOpen={true}
          onClose={() => setEditingTransaction(null)}
          onSave={onUpdateTransaction}
          onDelete={onDeleteTransaction}
        />
      )}

      {/* Manual Expense Modal */}
      <ManualExpenseModal
        isOpen={isManualExpenseOpen}
        onClose={() => setIsManualExpenseOpen(false)}
        onAdd={onAddTransaction}
      />
    </div>
  );
};

