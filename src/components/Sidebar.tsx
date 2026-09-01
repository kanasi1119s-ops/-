import React, { useEffect, useState } from 'react';
import { ViewTab } from '../types';
import { loadAccountRules } from '../accountRules';
import { 
  LayoutDashboard, 
  Camera, 
  PlusCircle, 
  FileText, 
  SlidersHorizontal,
  Lightbulb,
  Sparkles,
  TrendingUp,
  Receipt,
  Wand2
} from 'lucide-react';

interface SidebarProps {
  currentTab: ViewTab;
  onSelectTab: (tab: ViewTab) => void;
  transactionCount: number;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  onSelectTab,
  transactionCount,
}) => {
  // Track enabled auto-classification rule count for the nav badge
  const [ruleCount, setRuleCount] = useState(0);
  useEffect(() => {
    const refresh = () => setRuleCount(loadAccountRules().filter((r) => r.enabled).length);
    refresh();
    // Rules are edited within this SPA (no full reload), so also refresh on tab focus/visibility
    window.addEventListener('focus', refresh);
    return () => window.removeEventListener('focus', refresh);
  }, []);

  const menuItems: { id: ViewTab; label: string; icon: React.ReactNode; badge?: string }[] = [
    {
      id: 'dashboard',
      label: '📊 ダッシュボード (税金・手取り計算)',
      icon: <LayoutDashboard className="w-5 h-5" />,
    },
    {
      id: 'ocr',
      label: '📸 AIレシート一発読取',
      icon: <Camera className="w-5 h-5 text-amber-500" />,
      badge: 'AI搭載',
    },
    {
      id: 'sales',
      label: '💰 売上登録',
      icon: <PlusCircle className="w-5 h-5 text-emerald-500" />,
    },
    {
      id: 'ledger',
      label: '📋 取引明細帳',
      icon: <FileText className="w-5 h-5 text-indigo-500" />,
      badge: `${transactionCount}件`,
    },
    {
      id: 'rules',
      label: '🪄 勘定科目 自動判定ルール',
      icon: <Wand2 className="w-5 h-5 text-purple-500" />,
      badge: ruleCount > 0 ? `${ruleCount}件有効` : '未設定',
    },
    {
      id: 'settings',
      label: '⚙️ 税金・控除シミュレーション設定',
      icon: <SlidersHorizontal className="w-5 h-5 text-slate-500" />,
    },
  ];

  return (
    <aside className="w-full md:w-72 bg-white border-r border-slate-200 flex flex-col shrink-0">
      {/* App Header / Brand */}
      <div className="p-5 border-b border-slate-100 flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-600 shadow-xs">
          <Lightbulb className="w-6 h-6" />
        </div>
        <div>
          <div className="flex items-center gap-1.5">
            <h1 className="font-bold text-slate-900 text-lg leading-tight tracking-tight">
              AIスマート経理
            </h1>
            <span className="bg-amber-100 text-amber-800 text-[10px] font-semibold px-1.5 py-0.5 rounded-full">
              PRO
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">個人事業主・フリーランス向け</p>
        </div>
      </div>

      {/* Navigation List */}
      <div className="p-3 flex-1 overflow-y-auto">
        <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider px-3 mb-2">
          メニュー
        </div>
        <nav className="space-y-1">
          {menuItems.map((item) => {
            const isActive = currentTab === item.id;
            return (
              <button
                key={item.id}
                id={`nav-tab-${item.id}`}
                onClick={() => onSelectTab(item.id)}
                className={`w-full flex items-center justify-between px-3.5 py-3 rounded-xl text-sm font-medium transition-all text-left ${
                  isActive
                    ? 'bg-indigo-50 text-indigo-700 font-semibold shadow-xs border border-indigo-100'
                    : 'text-slate-700 hover:bg-slate-50 hover:text-slate-900'
                }`}
              >
                <div className="flex items-center gap-3">
                  {item.icon}
                  <span className="truncate">{item.label}</span>
                </div>
                {item.badge && (
                  <span
                    className={`text-[11px] px-2 py-0.5 rounded-full font-semibold shrink-0 ${
                      item.badge === 'AI搭載'
                        ? 'bg-amber-100 text-amber-800'
                        : item.id === 'rules'
                        ? item.badge === '未設定'
                          ? 'bg-slate-100 text-slate-500'
                          : 'bg-purple-100 text-purple-700'
                        : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Pro Tip Box */}
        <div className="mt-6 p-4 rounded-xl bg-gradient-to-br from-indigo-50/80 to-amber-50/60 border border-indigo-100/80">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-indigo-900 mb-1">
            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
            <span>AI一発OCRのコツ</span>
          </div>
          <p className="text-xs text-slate-600 leading-relaxed">
            スマホやデジカメで撮った領収書画像をドラッグ＆ドロップするだけで、合計金額・消費税・勘定科目をAIが自動抽出して即帳簿登録できます。
          </p>
        </div>
      </div>

      {/* Footer Info */}
      <div className="p-4 border-t border-slate-100 text-xs text-slate-400 flex items-center justify-between">
        <span className="flex items-center gap-1">
          <Receipt className="w-3.5 h-3.5" />
          インボイス・青色申告対応
        </span>
        <span className="text-[10px] text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">
          自動保存中
        </span>
      </div>
    </aside>
  );
};
