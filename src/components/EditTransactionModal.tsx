import React, { useState } from 'react';
import { Transaction, ExpenseCategory, IncomeCategory } from '../types';
import { X, Check, Trash2, Calendar, Tag, Store } from 'lucide-react';
import { 
  ALL_EXPENSE_CATEGORIES, 
  ALL_INCOME_CATEGORIES, 
  EXPENSE_CATEGORIES_INFO, 
  INCOME_CATEGORIES_INFO 
} from '../data/categories';

interface EditTransactionModalProps {
  transaction: Transaction;
  isOpen: boolean;
  onClose: () => void;
  onSave: (updated: Transaction) => void;
  onDelete: (id: string) => void;
}

export const EditTransactionModal: React.FC<EditTransactionModalProps> = ({
  transaction,
  isOpen,
  onClose,
  onSave,
  onDelete,
}) => {
  if (!isOpen) return null;

  const [date, setDate] = useState(transaction.date);
  const [type, setType] = useState(transaction.type);
  const [description, setDescription] = useState(transaction.description);
  const [merchant, setMerchant] = useState(transaction.merchant || '');
  const [category, setCategory] = useState(transaction.category || (transaction.type === 'income' ? '売上高' : '消耗品費'));
  const [amount, setAmount] = useState(transaction.amount);
  const [taxRate, setTaxRate] = useState(transaction.taxRate || 0.10);

  const calculatedTax = Math.round(amount * taxRate);
  const calculatedTotal = Math.round(amount + calculatedTax);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      ...transaction,
      date,
      type,
      description,
      merchant,
      category,
      amount,
      tax: calculatedTax,
      total: calculatedTotal,
      taxRate,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
          <h3 className="text-base font-bold text-slate-900">
            取引明細の編集 (ID: {transaction.id})
          </h3>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 p-1 rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Type selector */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">取引種別</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  setType('income');
                  if (!ALL_INCOME_CATEGORIES.includes(category as any)) {
                    setCategory('売上高');
                  }
                }}
                className={`py-2 rounded-xl text-xs font-bold border transition ${
                  type === 'income'
                    ? 'bg-emerald-50 border-emerald-300 text-emerald-700'
                    : 'border-slate-200 text-slate-600'
                }`}
              >
                🔵 売上 (収入)
              </button>
              <button
                type="button"
                onClick={() => {
                  setType('expense');
                  if (!ALL_EXPENSE_CATEGORIES.includes(category as any)) {
                    setCategory('消耗品費');
                  }
                }}
                className={`py-2 rounded-xl text-xs font-bold border transition ${
                  type === 'expense'
                    ? 'bg-rose-50 border-rose-300 text-rose-700'
                    : 'border-slate-200 text-slate-600'
                }`}
              >
                🔴 経費 (支出)
              </button>
            </div>
          </div>

          {/* Date & Merchant */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                取引日
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
                店舗・取引先名
              </label>
              <input
                type="text"
                value={merchant}
                onChange={(e) => setMerchant(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-medium"
              />
            </div>
          </div>

          {/* Category */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1">
              <Tag className="w-3.5 h-3.5 text-slate-400" />
              勘定科目
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-medium bg-white"
            >
              {type === 'income'
                ? ALL_INCOME_CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c} ({INCOME_CATEGORIES_INFO[c]?.examples.split(',')[0]})
                    </option>
                  ))
                : ALL_EXPENSE_CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c} ({EXPENSE_CATEGORIES_INFO[c]?.examples.split(',')[0]})
                    </option>
                  ))}
            </select>
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">摘要・詳細</label>
            <input
              type="text"
              required
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-medium"
            />
          </div>

          {/* Amount & Tax */}
          <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">税抜金額 (円)</label>
              <input
                type="number"
                required
                min={0}
                value={amount}
                onChange={(e) => setAmount(Math.max(0, Number(e.target.value)))}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm font-bold bg-white"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">消費税率</label>
              <select
                value={taxRate}
                onChange={(e) => setTaxRate(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-medium bg-white"
              >
                <option value={0.10}>標準税率 10%</option>
                <option value={0.08}>軽減税率 8%</option>
                <option value={0.0}>非課税 0%</option>
              </select>
            </div>
            <div className="col-span-2 flex justify-between text-xs font-semibold text-slate-600 pt-1">
              <span>消費税: ¥{calculatedTax.toLocaleString()}</span>
              <span className="text-slate-900 font-bold">税込合計: ¥{calculatedTotal.toLocaleString()}</span>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center justify-between pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => {
                if (confirm('この明細を削除してもよろしいですか？')) {
                  onDelete(transaction.id);
                  onClose();
                }
              }}
              className="px-3 py-2 rounded-xl text-rose-600 hover:bg-rose-50 text-xs font-bold flex items-center gap-1 transition"
            >
              <Trash2 className="w-3.5 h-3.5" />
              明細を削除
            </button>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 text-xs font-bold transition"
              >
                キャンセル
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition flex items-center gap-1 shadow-xs"
              >
                <Check className="w-3.5 h-3.5" />
                変更を保存
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
