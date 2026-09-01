import React, { useState } from 'react';
import { Transaction, IncomeCategory } from '../types';
import { 
  PlusCircle, 
  CheckCircle2, 
  Calendar, 
  Building2, 
  Tag, 
  Coins, 
  TrendingUp, 
  Sparkles,
  ArrowRight,
  Info,
  Layers
} from 'lucide-react';
import { 
  ALL_INCOME_CATEGORIES, 
  INCOME_CATEGORIES_INFO, 
  getCategoryBadgeStyle 
} from '../data/categories';

interface SalesEntryViewProps {
  onAddTransaction: (transaction: Omit<Transaction, 'id' | 'createdAt'>) => void;
  onNavigateToDashboard: () => void;
  recentSales: Transaction[];
}

const SALES_PRESETS = [
  { label: 'Web開発・受託プログラミング', category: '業務委託報酬' as IncomeCategory, desc: 'Webアプリケーション受託開発・システム納品', amount: 350000 },
  { label: 'UI/UXデザイン・Webサイト制作', category: '制作費' as IncomeCategory, desc: 'コーポレートサイト制作・デザイン設計費', amount: 220000 },
  { label: '月次技術顧問・アドバイザリー', category: 'コンサルティング' as IncomeCategory, desc: '開発体制立ち上げ支援・月次顧問報酬', amount: 150000 },
  { label: '技術連載記事執筆・寄稿', category: '原稿料・監修料' as IncomeCategory, desc: '技術専門メディア連載記事執筆料', amount: 60000 },
  { label: 'デジタル商材・オンライン販売', category: '商品販売' as IncomeCategory, desc: '自社開発テンプレート・UIキット販売', amount: 45000 },
];

export const SalesEntryView: React.FC<SalesEntryViewProps> = ({
  onAddTransaction,
  onNavigateToDashboard,
  recentSales,
}) => {
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [merchant, setMerchant] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<IncomeCategory>('売上高');
  const [amount, setAmount] = useState<number>(0);
  const [taxRate, setTaxRate] = useState<number>(0.10);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Quick Amount adders
  const handleAddAmount = (add: number) => {
    setAmount((prev) => prev + add);
  };

  const handleApplyPreset = (preset: typeof SALES_PRESETS[0]) => {
    setCategory(preset.category);
    setDescription(preset.desc);
    setAmount(preset.amount);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (amount <= 0) {
      alert('売上金額は0円より大きい値を入力してください。');
      return;
    }

    const calculatedTax = Math.round(amount * taxRate);
    const calculatedTotal = Math.round(amount + calculatedTax);

    onAddTransaction({
      type: 'income',
      amount: amount, // 税抜金額
      tax: calculatedTax, // 消費税
      total: calculatedTotal, // 税込合計
      description: description || `${category} - ${merchant || '取引先'}`,
      category: category || '売上高',
      date: date || new Date().toISOString().slice(0, 10),
      taxRate: taxRate,
      merchant: merchant || '取引先',
      source: 'manual',
    });

    const formattedDate = date.replace(/-/g, '/');
    setSuccessMessage(
      `✅ ${formattedDate} の売上（${category} / 税抜 ¥${Math.round(amount).toLocaleString()} / 税込 ¥${calculatedTotal.toLocaleString()}）を記録しました！`
    );

    // Reset fields for next entry
    setMerchant('');
    setDescription('');
    setAmount(0);
  };

  const taxAmount = Math.round(amount * taxRate);
  const totalAmount = Math.round(amount + taxAmount);
  const currentCategoryInfo = INCOME_CATEGORIES_INFO[category];

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
          💰 売上の手動入力
        </h2>
        <p className="text-sm text-slate-600 mt-1">
          案件報酬・商品売上・コンサルティング料などの勘定科目（カテゴリー）を選択して記録します。税抜・税込計算および手取りシミュレーションに即時反映されます。
        </p>
      </div>

      {/* Success Notification */}
      {successMessage && (
        <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 shadow-xs flex items-center justify-between gap-4 animate-in fade-in">
          <div className="flex items-center gap-2.5 text-xs font-semibold">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <span>{successMessage}</span>
          </div>
          <button
            onClick={onNavigateToDashboard}
            className="shrink-0 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition flex items-center gap-1 cursor-pointer"
          >
            ダッシュボードで見る <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Main Grid: Form on Left, Presets & Recent Sales on Right */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Form */}
        <div className="lg:col-span-7">
          <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs space-y-5">
            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Row 1: Date & Merchant */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Date */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-slate-400" />
                    売上日
                  </label>
                  <input
                    type="date"
                    required
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium"
                  />
                </div>

                {/* Merchant / Client */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1.5">
                    <Building2 className="w-3.5 h-3.5 text-slate-400" />
                    取引先・クライアント名
                  </label>
                  <input
                    type="text"
                    value={merchant}
                    onChange={(e) => setMerchant(e.target.value)}
                    placeholder="例: 株式会社テックソリューションズ"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium"
                  />
                </div>
              </div>

              {/* Category Selector Section */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-bold text-slate-700 flex items-center gap-1.5">
                    <Tag className="w-3.5 h-3.5 text-emerald-600" />
                    売上カテゴリー (勘定科目)
                  </label>
                  <span className="text-[11px] text-slate-400">青色・白色申告対応</span>
                </div>

                {/* Visual Category Pills Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {ALL_INCOME_CATEGORIES.map((cat) => {
                    const info = INCOME_CATEGORIES_INFO[cat];
                    const isSelected = category === cat;
                    return (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => setCategory(cat)}
                        className={`p-2.5 rounded-xl text-left border transition-all cursor-pointer flex flex-col justify-between ${
                          isSelected
                            ? 'bg-emerald-50 border-emerald-500 ring-2 ring-emerald-300/60 shadow-xs'
                            : 'bg-slate-50/80 border-slate-200 hover:bg-slate-100 hover:border-slate-300'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className={`text-xs font-bold ${isSelected ? 'text-emerald-950 font-extrabold' : 'text-slate-700'}`}>
                            {cat}
                          </span>
                          {isSelected && (
                            <span className="w-2 h-2 rounded-full bg-emerald-600 animate-pulse"></span>
                          )}
                        </div>
                        <span className="text-[10px] text-slate-500 mt-1 line-clamp-1">
                          {info.examples.split(',')[0]}
                        </span>
                      </button>
                    );
                  })}
                </div>

                {/* Selected Category Info Banner */}
                {currentCategoryInfo && (
                  <div className="p-3 rounded-xl bg-emerald-50/60 border border-emerald-100 flex items-start gap-2.5 text-xs text-emerald-950">
                    <Info className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    <div>
                      <div className="font-bold text-emerald-900">
                        【{category}】: {currentCategoryInfo.description}
                      </div>
                      <div className="text-[11px] text-emerald-700 mt-0.5">
                        代表例: {currentCategoryInfo.examples}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Tax Rate & Description */}
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-4">
                <div className="sm:col-span-8">
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    売上内容・摘要 (案件名や品名)
                  </label>
                  <input
                    type="text"
                    required
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="例: Webサイトリニューアル案件制作費（2月分）"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium"
                  />
                </div>

                <div className="sm:col-span-4">
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    適用消費税率
                  </label>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setTaxRate(0.10)}
                      className={`flex-1 py-2.5 rounded-xl text-xs font-bold border transition cursor-pointer ${
                        taxRate === 0.10
                          ? 'bg-emerald-100 border-emerald-400 text-emerald-900 shadow-xs'
                          : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      標準 10%
                    </button>
                    <button
                      type="button"
                      onClick={() => setTaxRate(0.08)}
                      className={`flex-1 py-2.5 rounded-xl text-xs font-bold border transition cursor-pointer ${
                        taxRate === 0.08
                          ? 'bg-emerald-100 border-emerald-400 text-emerald-900 shadow-xs'
                          : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      軽減 8%
                    </button>
                  </div>
                </div>
              </div>

              {/* Amount Input */}
              <div className="bg-emerald-50/50 p-4 rounded-2xl border border-emerald-100 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-bold text-slate-900">
                    売上金額 (税抜・円)
                  </label>
                  <span className="text-xs font-semibold text-emerald-800">
                    選択カテゴリー: <span className="font-extrabold">{category}</span>
                  </span>
                </div>

                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-lg">
                    ¥
                  </span>
                  <input
                    type="number"
                    required
                    min={0}
                    step={1000}
                    value={amount || ''}
                    onChange={(e) => setAmount(Math.max(0, Number(e.target.value)))}
                    placeholder="0"
                    className="w-full pl-8 pr-4 py-2.5 rounded-xl border border-emerald-200 text-xl font-extrabold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
                  />
                </div>

                {/* Quick Add Buttons */}
                <div className="flex flex-wrap gap-1.5 pt-1">
                  <button
                    type="button"
                    onClick={() => handleAddAmount(10000)}
                    className="px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-[11px] font-semibold text-slate-700 hover:bg-slate-50 transition cursor-pointer"
                  >
                    +1万円
                  </button>
                  <button
                    type="button"
                    onClick={() => handleAddAmount(50000)}
                    className="px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-[11px] font-semibold text-slate-700 hover:bg-slate-50 transition cursor-pointer"
                  >
                    +5万円
                  </button>
                  <button
                    type="button"
                    onClick={() => handleAddAmount(100000)}
                    className="px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-[11px] font-semibold text-slate-700 hover:bg-slate-50 transition cursor-pointer"
                  >
                    +10万円
                  </button>
                  <button
                    type="button"
                    onClick={() => handleAddAmount(500000)}
                    className="px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-[11px] font-semibold text-slate-700 hover:bg-slate-50 transition cursor-pointer"
                  >
                    +50万円
                  </button>
                  <button
                    type="button"
                    onClick={() => setAmount(0)}
                    className="px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-[11px] font-semibold text-rose-600 hover:bg-rose-50 transition ml-auto cursor-pointer"
                  >
                    クリア
                  </button>
                </div>

                {/* Split breakdown */}
                <div className="grid grid-cols-2 gap-3 pt-2 text-xs border-t border-emerald-100">
                  <div className="flex items-center justify-between text-slate-600">
                    <span>消費税 ({Math.round(taxRate * 100)}%):</span>
                    <strong className="text-slate-900">¥ {taxAmount.toLocaleString()}</strong>
                  </div>
                  <div className="flex items-center justify-between text-emerald-800">
                    <span className="font-semibold">税込請求合計:</span>
                    <strong className="text-sm font-extrabold text-emerald-700">¥ {totalAmount.toLocaleString()}</strong>
                  </div>
                </div>
              </div>

              {/* Submit button */}
              <button
                type="submit"
                id="btn-submit-sales"
                className="w-full py-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-sm shadow-xs transition flex items-center justify-center gap-2 cursor-pointer active:scale-98"
              >
                <PlusCircle className="w-4 h-4" />
                売上（{category}）を記録する
              </button>
            </form>
          </div>
        </div>

        {/* Right Column: Presets & Recent Sales History */}
        <div className="lg:col-span-5 space-y-4">
          {/* Preset templates */}
          <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              定番の売上パターン（ワンクリック入力）
            </h3>
            <div className="space-y-2">
              {SALES_PRESETS.map((preset, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleApplyPreset(preset)}
                  className="w-full p-3 rounded-xl bg-slate-50 hover:bg-emerald-50/70 border border-slate-200 hover:border-emerald-200 text-left transition group cursor-pointer"
                >
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-slate-800 group-hover:text-emerald-900">
                      {preset.label}
                    </span>
                    <span className="font-extrabold text-emerald-700">
                      ¥ {preset.amount.toLocaleString()}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-slate-500 mt-1">
                    <span className="truncate pr-2">{preset.desc}</span>
                    <span className="text-[10px] font-semibold px-2 py-0.5 bg-white rounded-md border border-slate-200 text-slate-600 shrink-0">
                      {preset.category}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Recent Sales List */}
          <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
              <TrendingUp className="w-3.5 h-3.5 text-emerald-500" />
              最近登録された売上
            </h3>
            {recentSales.length === 0 ? (
              <p className="text-xs text-slate-400 py-4 text-center">売上データはまだありません</p>
            ) : (
              <div className="space-y-2">
                {recentSales.slice(0, 5).map((sale) => {
                  const style = getCategoryBadgeStyle(sale.category, 'income');
                  return (
                    <div
                      key={sale.id}
                      className="p-2.5 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-between text-xs"
                    >
                      <div className="truncate pr-2">
                        <div className="font-bold text-slate-800 truncate">
                          {sale.description || sale.merchant}
                        </div>
                        <div className="flex items-center gap-1.5 text-[10px] text-slate-400 mt-0.5">
                          <span>{sale.date}</span>
                          <span>·</span>
                          <span className={`px-1.5 py-0.2 rounded border font-semibold ${style.badgeBg} ${style.badgeText}`}>
                            {sale.category}
                          </span>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="font-bold text-emerald-700">
                          +¥ {Math.round(sale.amount).toLocaleString()}
                        </div>
                        <div className="text-[10px] text-slate-400">
                          (税込 ¥{Math.round(sale.total).toLocaleString()})
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

