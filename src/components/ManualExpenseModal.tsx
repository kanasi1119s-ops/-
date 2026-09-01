import React, { useState } from 'react';
import { Transaction, ExpenseCategory } from '../types';
import { X, Plus, Calendar, Tag, Store, Info } from 'lucide-react';
import { ALL_EXPENSE_CATEGORIES, EXPENSE_CATEGORIES_INFO } from '../data/categories';

interface ManualExpenseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (tx: Omit<Transaction, 'id' | 'createdAt'>) => void;
}

export const ManualExpenseModal: React.FC<ManualExpenseModalProps> = ({
  isOpen,
  onClose,
  onAdd,
}) => {
  if (!isOpen) return null;

  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [merchant, setMerchant] = useState('');
  const [category, setCategory] = useState<ExpenseCategory>('消耗品費');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState<number>(0);
  const [taxRate, setTaxRate] = useState<number>(0.10);

  const calculatedTax = Math.round(amount * taxRate);
  const calculatedTotal = Math.round(amount + calculatedTax);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (amount <= 0) {
      alert('経費金額を入力してください。');
      return;
    }

    onAdd({
      type: 'expense',
      amount,
      tax: calculatedTax,
      total: calculatedTotal,
      description: description || `${merchant ? merchant + 'での' : ''}${category}`,
      category,
      date,
      taxRate,
      merchant: merchant || '店舗・支払先',
      source: 'manual',
    });
    onClose();
  };

  const currentInfo = EXPENSE_CATEGORIES_INFO[category];

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
          <h3 className="text-base font-bold text-slate-900">経費の手動追加</h3>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 p-1 rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                支払日
              </label>
              <input
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-medium"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1">
                <Store className="w-3.5 h-3.5 text-slate-400" />
                支払先・店舗
              </label>
              <input
                type="text"
                value={merchant}
                onChange={(e) => setMerchant(e.target.value)}
                placeholder="例: 文具店, カフェ"
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-medium"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1">
              <Tag className="w-3.5 h-3.5 text-slate-400" />
              勘定科目
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as ExpenseCategory)}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-medium bg-white"
            >
              {ALL_EXPENSE_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c} ({EXPENSE_CATEGORIES_INFO[c]?.examples.split(',')[0]})
                </option>
              ))}
            </select>
            {currentInfo && (
              <p className="text-[10px] text-slate-500 mt-1">
                {currentInfo.description} (例: {currentInfo.examples})
              </p>
            )}
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">摘要・用途</label>
            <input
              type="text"
              required
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="例: ノート・ペン・ファイル等の事務消耗品代"
              className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-medium"
            />
          </div>

          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  税抜金額 (円)
                </label>
                <input
                  type="number"
                  required
                  min={0}
                  value={amount || ''}
                  onChange={(e) => setAmount(Math.max(0, Number(e.target.value)))}
                  placeholder="0"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm font-bold bg-white"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">税率</label>
                <select
                  value={taxRate}
                  onChange={(e) => setTaxRate(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-medium bg-white"
                >
                  <option value={0.10}>標準税率 10%</option>
                  <option value={0.08}>軽減税率 8%</option>
                </select>
              </div>
            </div>
            <div className="flex justify-between text-xs font-semibold text-slate-600 pt-1">
              <span>消費税: ¥{calculatedTax.toLocaleString()}</span>
              <span className="text-slate-900 font-bold">税込合計: ¥{calculatedTotal.toLocaleString()}</span>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 text-xs font-bold transition"
            >
              キャンセル
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition flex items-center gap-1 shadow-xs"
            >
              <Plus className="w-3.5 h-3.5" />
              経費を追加
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
