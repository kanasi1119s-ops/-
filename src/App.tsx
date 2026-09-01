import React, { useState, useEffect } from 'react';
import { Transaction, TaxSettings, ViewTab } from './types';
import { loadTransactions, saveTransactions, loadTaxSettings, saveTaxSettings } from './data/storage';
import { getInitialTransactions } from './data/defaultData';
import { Sidebar } from './components/Sidebar';
import { DashboardView } from './components/DashboardView';
import { ReceiptOcrView } from './components/ReceiptOcrView';
import { SalesEntryView } from './components/SalesEntryView';
import { TransactionLedgerView } from './components/TransactionLedgerView';
import { TaxSettingsView } from './components/TaxSettingsView';
import AccountRuleSettings from './AccountRuleSettings';
import { Lightbulb, Menu, X, Receipt, Sparkles } from 'lucide-react';

export default function App() {
  const [currentTab, setCurrentTab] = useState<ViewTab>('dashboard');
  const [transactions, setTransactions] = useState<Transaction[]>(() => loadTransactions());
  const [taxSettings, setTaxSettings] = useState<TaxSettings>(() => loadTaxSettings());
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [serverLoaded, setServerLoaded] = useState(false);

  // Load the shared Windows-side transaction store. localStorage remains as an offline fallback.
  useEffect(() => {
    let cancelled = false;
    fetch('/api/transactions')
      .then((r) => r.ok ? r.json() : Promise.reject(new Error('server unavailable')))
      .then((data) => {
        if (!cancelled && Array.isArray(data.transactions)) setTransactions(data.transactions);
      })
      .catch(() => { /* offline/local-only mode */ })
      .finally(() => { if (!cancelled) setServerLoaded(true); });
    return () => { cancelled = true; };
  }, []);

  // Keep a local backup and, when the Windows server is available, sync the shared ledger.
  useEffect(() => {
    saveTransactions(transactions);
    if (!serverLoaded) return;
    fetch('/api/transactions', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ transactions }),
    }).catch(() => { /* localStorage fallback */ });
  }, [transactions, serverLoaded]);

  // Sync tax settings
  useEffect(() => {
    saveTaxSettings(taxSettings);
  }, [taxSettings]);

  // Add transaction handler
  const handleAddTransaction = (newTx: Omit<Transaction, 'id' | 'createdAt'>) => {
    const id = `tx-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
    const tx: Transaction = {
      ...newTx,
      id,
      createdAt: new Date().toISOString(),
    };
    setTransactions((prev) => [tx, ...prev]);
  };

  // Update transaction handler
  const handleUpdateTransaction = (updated: Transaction) => {
    setTransactions((prev) =>
      prev.map((t) => (t.id === updated.id ? updated : t))
    );
  };

  // Delete transaction handler
  const handleDeleteTransaction = (id: string) => {
    setTransactions((prev) => prev.filter((t) => t.id !== id));
  };

  // Reset to initial sample data
  const handleResetToDefaults = () => {
    const initial = getInitialTransactions();
    setTransactions(initial);
    saveTransactions(initial);
  };

  const recentSales = transactions.filter((t) => t.type === 'income');

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row text-slate-800 antialiased font-sans">
      {/* Mobile Top Navigation Header */}
      <header className="md:hidden bg-white border-b border-slate-200 px-4 py-3 flex items-center justify-between sticky top-0 z-30 shadow-xs">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-600">
            <Lightbulb className="w-5 h-5" />
          </div>
          <div>
            <h1 className="font-extrabold text-slate-900 text-sm leading-tight">
              AIスマート経理
            </h1>
            <p className="text-[10px] text-slate-400">リアルタイム手取り計算</p>
          </div>
        </div>

        <button
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          className="p-2 rounded-lg text-slate-600 hover:bg-slate-100"
          aria-label="メニューを開く"
        >
          {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </header>

      {/* Mobile Menu Drawer Overlay */}
      {isMobileMenuOpen && (
        <div className="md:hidden fixed inset-0 z-40 bg-slate-900/50 backdrop-blur-xs flex flex-col justify-end">
          <div className="bg-white rounded-t-2xl p-4 max-h-[85vh] overflow-y-auto space-y-2">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <span className="font-bold text-sm text-slate-900">メニュー</span>
              <button
                onClick={() => setIsMobileMenuOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-1 pt-1">
              {[
                { id: 'dashboard' as ViewTab, label: '📊 ダッシュボード (税金・手取り計算)' },
                { id: 'ocr' as ViewTab, label: '📸 AIレシート一発読取' },
                { id: 'sales' as ViewTab, label: '💰 売上登録' },
                { id: 'ledger' as ViewTab, label: `📋 取引明細帳 (${transactions.length}件)` },
                { id: 'rules' as ViewTab, label: '🪄 勘定科目 自動判定ルール' },
                { id: 'settings' as ViewTab, label: '⚙️ 税金・控除設定' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => {
                    setCurrentTab(tab.id);
                    setIsMobileMenuOpen(false);
                  }}
                  className={`w-full text-left px-4 py-3 rounded-xl text-sm font-semibold transition ${
                    currentTab === tab.id
                      ? 'bg-indigo-50 text-indigo-700 font-bold border border-indigo-100'
                      : 'text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Desktop Sidebar Navigation */}
      <div className="hidden md:flex h-screen sticky top-0">
        <Sidebar
          currentTab={currentTab}
          onSelectTab={(tab) => setCurrentTab(tab)}
          transactionCount={transactions.length}
        />
      </div>

      {/* Main Content Area */}
      <main className="flex-1 min-w-0 p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full">
        {currentTab === 'dashboard' && (
          <DashboardView
            transactions={transactions}
            taxSettings={taxSettings}
            onNavigate={(tab) => setCurrentTab(tab)}
          />
        )}

        {currentTab === 'ocr' && (
          <ReceiptOcrView
            transactions={transactions}
            onAddTransaction={handleAddTransaction}
            onNavigateToLedger={() => setCurrentTab('ledger')}
          />
        )}

        {currentTab === 'sales' && (
          <SalesEntryView
            onAddTransaction={handleAddTransaction}
            onNavigateToDashboard={() => setCurrentTab('dashboard')}
            recentSales={recentSales}
          />
        )}

        {currentTab === 'ledger' && (
          <TransactionLedgerView
            transactions={transactions}
            onUpdateTransaction={handleUpdateTransaction}
            onDeleteTransaction={handleDeleteTransaction}
            onAddTransaction={handleAddTransaction}
            onResetToDefaults={handleResetToDefaults}
          />
        )}

        {currentTab === 'rules' && <AccountRuleSettings />}

        {currentTab === 'settings' && (
          <TaxSettingsView
            settings={taxSettings}
            onSaveSettings={(newSettings) => setTaxSettings(newSettings)}
            transactions={transactions}
            onRestoreTransactions={(newTransactions) => setTransactions(newTransactions)}
            onResetToDefaults={handleResetToDefaults}
          />
        )}
      </main>
    </div>
  );
}
