import React, { useState, useRef } from 'react';
import { TaxSettings, Transaction } from '../types';
import { 
  SlidersHorizontal, 
  Check, 
  RotateCcw, 
  ShieldCheck, 
  Download, 
  Upload, 
  Database, 
  FileJson, 
  AlertCircle, 
  CheckCircle2, 
  X,
  FileSpreadsheet,
  HardDriveDownload,
  FolderSync
} from 'lucide-react';
import { DEFAULT_TAX_SETTINGS } from '../data/defaultData';
import { exportTransactionsToJson, validateAndParseTransactionsJson, exportTransactionsToCsv } from '../data/storage';

interface TaxSettingsViewProps {
  settings: TaxSettings;
  onSaveSettings: (newSettings: TaxSettings) => void;
  transactions?: Transaction[];
  onRestoreTransactions?: (newTransactions: Transaction[]) => void;
  onResetToDefaults?: () => void;
}

export const TaxSettingsView: React.FC<TaxSettingsViewProps> = ({
  settings,
  onSaveSettings,
  transactions = [],
  onRestoreTransactions,
  onResetToDefaults,
}) => {
  const [incomeTaxRate, setIncomeTaxRate] = useState(settings.estimatedIncomeTaxRate * 100);
  const [residentTaxRate, setResidentTaxRate] = useState(settings.estimatedResidentTaxRate * 100);
  const [healthInsRate, setHealthInsRate] = useState(settings.estimatedHealthInsRate * 100);
  const [applyBlueReturn, setApplyBlueReturn] = useState(settings.applyBlueReturn);
  const [blueReturnDeduction, setBlueReturnDeduction] = useState(settings.blueReturnDeduction);
  
  // Feedback states
  const [savedToast, setSavedToast] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  
  // Import Modal State
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importPendingData, setImportPendingData] = useState<{
    transactions: Transaction[];
    fileName: string;
    exportedAt?: string;
  } | null>(null);
  const [importMode, setImportMode] = useState<'replace' | 'merge'>('replace');

  // Stats calculation
  const totalSales = transactions
    .filter((t) => t.type === 'income')
    .reduce((acc, t) => acc + t.amount, 0);
  const totalExpenses = transactions
    .filter((t) => t.type === 'expense')
    .reduce((acc, t) => acc + t.amount, 0);

  const showToast = (msg: string) => {
    setSavedToast(msg);
    setTimeout(() => setSavedToast(null), 3500);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    onSaveSettings({
      ...settings,
      estimatedIncomeTaxRate: incomeTaxRate / 100,
      estimatedResidentTaxRate: residentTaxRate / 100,
      estimatedHealthInsRate: healthInsRate / 100,
      applyBlueReturn,
      blueReturnDeduction,
    });
    showToast('税金・控除シミュレーション設定を保存しました。');
  };

  const handleReset = () => {
    setIncomeTaxRate(DEFAULT_TAX_SETTINGS.estimatedIncomeTaxRate * 100);
    setResidentTaxRate(DEFAULT_TAX_SETTINGS.estimatedResidentTaxRate * 100);
    setHealthInsRate(DEFAULT_TAX_SETTINGS.estimatedHealthInsRate * 100);
    setApplyBlueReturn(DEFAULT_TAX_SETTINGS.applyBlueReturn);
    setBlueReturnDeduction(DEFAULT_TAX_SETTINGS.blueReturnDeduction);
    onSaveSettings(DEFAULT_TAX_SETTINGS);
    showToast('税金設定を初期値 (各10% / 計30%) に戻しました。');
  };

  // Trigger JSON Backup Download
  const handleBackupData = () => {
    try {
      exportTransactionsToJson(transactions);
      showToast(`現在登録されている取引データ ${transactions.length} 件をJSONファイルとしてバックアップ保存しました。`);
    } catch (err: any) {
      setErrorMessage(`バックアップ作成に失敗しました: ${err?.message || '不明なエラー'}`);
      setTimeout(() => setErrorMessage(null), 4000);
    }
  };

  // Handle File Selected for Import
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (!content) {
        setErrorMessage('ファイルの読み込みに失敗しました。');
        setTimeout(() => setErrorMessage(null), 4000);
        return;
      }

      const result = validateAndParseTransactionsJson(content);
      if (!result.success || !result.transactions) {
        setErrorMessage(result.error || 'JSONファイルの検証に失敗しました。');
        setTimeout(() => setErrorMessage(null), 5000);
        return;
      }

      // Open inspection modal
      setImportPendingData({
        transactions: result.transactions,
        fileName: file.name,
        exportedAt: result.exportedAt,
      });
      // Reset input value so same file can be selected again if needed
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    };
    reader.onerror = () => {
      setErrorMessage('ファイルの読み込み中にエラーが発生しました。');
      setTimeout(() => setErrorMessage(null), 4000);
    };
    reader.readAsText(file);
  };

  // Confirm and apply restoration
  const handleConfirmImport = () => {
    if (!importPendingData) return;

    let finalTransactions: Transaction[] = [];

    if (importMode === 'replace') {
      finalTransactions = importPendingData.transactions;
    } else {
      // Merge mode: keep existing, append non-existing by ID
      const existingMap = new Map(transactions.map((t) => [t.id, t]));
      importPendingData.transactions.forEach((t) => {
        if (!existingMap.has(t.id)) {
          existingMap.set(t.id, t);
        } else {
          // If ID collision, assign unique ID
          const newId = `tx-merged-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
          existingMap.set(newId, { ...t, id: newId });
        }
      });
      finalTransactions = Array.from(existingMap.values()).sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
      );
    }

    if (onRestoreTransactions) {
      onRestoreTransactions(finalTransactions);
    }
    const count = importPendingData.transactions.length;
    setImportPendingData(null);
    showToast(
      importMode === 'replace'
        ? `バックアップから全 ${count} 件の取引データを上書き復元しました。`
        : `バックアップから ${count} 件の取引データを既存帳簿に追加・統合しました。`
    );
  };

  const totalDeductionPct = incomeTaxRate + residentTaxRate + healthInsRate;

  return (
    <div className="space-y-8 pb-16 max-w-4xl">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
          ⚙️ システム設定 & データ管理
        </h2>
        <p className="text-sm text-slate-600 mt-1">
          手取りシミュレーションの税率設定や、取引帳簿データのJSONバックアップ・復元管理を行えます。
        </p>
      </div>

      {/* Success Notification */}
      {savedToast && (
        <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs font-semibold flex items-center justify-between gap-2 shadow-xs animate-in fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <span>{savedToast}</span>
          </div>
          <button onClick={() => setSavedToast(null)} className="p-1 hover:bg-emerald-100 rounded-lg text-emerald-700 cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Error Notification */}
      {errorMessage && (
        <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-900 text-xs font-semibold flex items-center justify-between gap-2 shadow-xs animate-in fade-in">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
            <span>{errorMessage}</span>
          </div>
          <button onClick={() => setErrorMessage(null)} className="p-1 hover:bg-rose-100 rounded-lg text-rose-700 cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* 💾 SECTION 1: Data Backup & Restore (JSON) */}
      <section className="bg-white rounded-3xl p-6 sm:p-7 border border-slate-200 shadow-xs space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
                <Database className="w-4 h-4" />
              </div>
              <h3 className="text-lg font-bold text-slate-900">
                データバックアップと復元 (Backup & Restore)
              </h3>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              登録済みのすべての仕訳・売上・経費データをJSON形式で安全にエクスポート／インポート（復元）できます。
            </p>
          </div>

          <span className="text-xs font-bold px-3 py-1 bg-indigo-50 text-indigo-700 rounded-full self-start sm:self-auto border border-indigo-100">
            現在 {transactions.length} 件の取引を保存中
          </span>
        </div>

        {/* Current State Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80">
            <div className="text-xs font-semibold text-slate-500">取引件数</div>
            <div className="text-xl font-extrabold text-slate-900 mt-1">
              {transactions.length} <span className="text-xs font-normal text-slate-500">件</span>
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5">売上・経費・レシート</div>
          </div>

          <div className="p-4 rounded-2xl bg-emerald-50/50 border border-emerald-100">
            <div className="text-xs font-semibold text-emerald-800">累計売上高</div>
            <div className="text-xl font-extrabold text-emerald-700 mt-1">
              ¥ {totalSales.toLocaleString()}
            </div>
            <div className="text-[11px] text-emerald-600/80 mt-0.5">事業所得の原資</div>
          </div>

          <div className="p-4 rounded-2xl bg-rose-50/50 border border-rose-100">
            <div className="text-xs font-semibold text-rose-800">累計必要経費</div>
            <div className="text-xl font-extrabold text-rose-700 mt-1">
              ¥ {totalExpenses.toLocaleString()}
            </div>
            <div className="text-[11px] text-rose-600/80 mt-0.5">控除対象経費計</div>
          </div>
        </div>

        {/* Action Buttons: Backup & Import */}
        <div className="p-5 rounded-2xl bg-slate-50/70 border border-slate-200/80 space-y-4">
          <div className="text-xs font-bold text-slate-700">データ操作メニュー</div>
          
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            {/* Backup Data Button */}
            <button
              type="button"
              id="backup-data-btn"
              onClick={handleBackupData}
              className="flex-1 px-5 py-3.5 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm shadow-xs hover:shadow-md transition flex items-center justify-center gap-2.5 active:scale-98 cursor-pointer"
            >
              <HardDriveDownload className="w-5 h-5" />
              <span>データをバックアップ (Backup Data)</span>
            </button>

            {/* Import Button */}
            <button
              type="button"
              id="import-data-btn"
              onClick={() => fileInputRef.current?.click()}
              className="flex-1 px-5 py-3.5 rounded-2xl bg-white hover:bg-slate-100 border-2 border-indigo-200 hover:border-indigo-400 text-indigo-700 font-bold text-sm shadow-xs transition flex items-center justify-center gap-2.5 active:scale-98 cursor-pointer"
            >
              <Upload className="w-5 h-5 text-indigo-600" />
              <span>バックアップから復元 (Import)</span>
            </button>

            {/* Hidden Native File Input */}
            <input
              ref={fileInputRef}
              type="file"
              accept=".json,application/json"
              onChange={handleFileChange}
              className="hidden"
            />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 pt-2 text-[11px] text-slate-500 border-t border-slate-200/60">
            <span className="flex items-center gap-1.5">
              <FileJson className="w-3.5 h-3.5 text-indigo-500" />
              バックアップ形式: 標準JSON（他の環境や次回起動時にも完全復元可能）
            </span>
            <button
              type="button"
              onClick={() => exportTransactionsToCsv(transactions)}
              className="text-indigo-600 hover:underline font-semibold flex items-center gap-1 cursor-pointer"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              Excel用CSV形式で書き出す
            </button>
          </div>
        </div>
      </section>

      {/* ⚙️ SECTION 2: Tax Simulation Settings Form */}
      <form onSubmit={handleSave} className="space-y-6">
        {/* Basic Tax & Insurance Rates Card */}
        <div className="bg-white rounded-3xl p-6 sm:p-7 border border-slate-200 shadow-xs space-y-5">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <SlidersHorizontal className="w-4 h-4 text-indigo-600" />
                概算控除率（デフォルト計30%）
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                ダッシュボードの手取り計算に使用する所得税・住民税・社会保険料の割合を設定します。
              </p>
            </div>
            <span className="text-xs font-bold px-2.5 py-1 bg-indigo-50 text-indigo-700 rounded-full border border-indigo-100">
              合計控除率: {totalDeductionPct.toFixed(1)}%
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {/* Income Tax */}
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
              <div className="flex items-center justify-between text-xs font-bold text-slate-800">
                <span>所得税率 (概算)</span>
                <span className="text-indigo-600">{incomeTaxRate}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="30"
                step="1"
                value={incomeTaxRate}
                onChange={(e) => setIncomeTaxRate(Number(e.target.value))}
                className="w-full accent-indigo-600 cursor-pointer"
              />
              <p className="text-[11px] text-slate-500">
                所得税累進課税の簡易概算（事業所得195万〜330万なら実効約10%）
              </p>
            </div>

            {/* Resident Tax */}
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
              <div className="flex items-center justify-between text-xs font-bold text-slate-800">
                <span>住民税率 (一律)</span>
                <span className="text-indigo-600">{residentTaxRate}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="20"
                step="1"
                value={residentTaxRate}
                onChange={(e) => setResidentTaxRate(Number(e.target.value))}
                className="w-full accent-indigo-600 cursor-pointer"
              />
              <p className="text-[11px] text-slate-500">
                地方税（都道府県民税・市区町村民税）の一律標準税率10%
              </p>
            </div>

            {/* Health Insurance */}
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
              <div className="flex items-center justify-between text-xs font-bold text-slate-800">
                <span>国民健康保険料率</span>
                <span className="text-indigo-600">{healthInsRate}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="20"
                step="1"
                value={healthInsRate}
                onChange={(e) => setHealthInsRate(Number(e.target.value))}
                className="w-full accent-indigo-600 cursor-pointer"
              />
              <p className="text-[11px] text-slate-500">
                自治体所得割の平均的な概算割合（約9〜11%）
              </p>
            </div>
          </div>
        </div>

        {/* Blue Return Special Deduction Simulation */}
        <div className="bg-white rounded-3xl p-6 sm:p-7 border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                青色申告特別控除シミュレーション
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                青色申告による最大65万円控除を適用した場合の課税ベース圧縮効果をシミュレーションします。
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={applyBlueReturn}
                onChange={(e) => setApplyBlueReturn(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
            </label>
          </div>

          {applyBlueReturn && (
            <div className="p-4 rounded-2xl bg-emerald-50/60 border border-emerald-200 space-y-3 animate-in fade-in">
              <div className="text-xs font-bold text-emerald-900">控除額の選択:</div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setBlueReturnDeduction(650000)}
                  className={`py-2 px-3 rounded-xl text-xs font-bold border text-left transition cursor-pointer ${
                    blueReturnDeduction === 650000
                      ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                      : 'bg-white text-slate-700 border-emerald-200 hover:bg-emerald-50'
                  }`}
                >
                  65万円控除 (e-Tax提出)
                </button>
                <button
                  type="button"
                  onClick={() => setBlueReturnDeduction(550000)}
                  className={`py-2 px-3 rounded-xl text-xs font-bold border text-left transition cursor-pointer ${
                    blueReturnDeduction === 550000
                      ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                      : 'bg-white text-slate-700 border-emerald-200 hover:bg-emerald-50'
                  }`}
                >
                  55万円控除 (書面提出)
                </button>
                <button
                  type="button"
                  onClick={() => setBlueReturnDeduction(100000)}
                  className={`py-2 px-3 rounded-xl text-xs font-bold border text-left transition cursor-pointer ${
                    blueReturnDeduction === 100000
                      ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                      : 'bg-white text-slate-700 border-emerald-200 hover:bg-emerald-50'
                  }`}
                >
                  10万円控除 (簡易簿記)
                </button>
              </div>
              <p className="text-[11px] text-emerald-800">
                💡 65万円控除により、年間約19.5万円（30%相当）の節税・手取り増額が見込めます。
              </p>
            </div>
          )}
        </div>

        {/* Form Action Buttons */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
          <button
            type="button"
            onClick={handleReset}
            className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            税金設定を初期値 (計30%) に戻す
          </button>

          <div className="flex items-center gap-3">
            {onResetToDefaults && (
              <button
                type="button"
                onClick={() => {
                  if (confirm('初期サンプルデータにリセットしますか？現在の登録内容は初期データで上書きされます。')) {
                    onResetToDefaults();
                    showToast('取引データを初期サンプルデータにリセットしました。');
                  }
                }}
                className="px-4 py-2.5 rounded-xl border border-rose-200 text-rose-600 hover:bg-rose-50 text-xs font-bold transition cursor-pointer"
              >
                初期サンプルデータに戻す
              </button>
            )}

            <button
              type="submit"
              className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition flex items-center gap-1.5 shadow-xs cursor-pointer"
            >
              <Check className="w-4 h-4" />
              税金設定を保存して適用
            </button>
          </div>
        </div>
      </form>

      {/* 📥 Modal: Confirm JSON Import */}
      {importPendingData && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-lg w-full overflow-hidden border border-slate-200 shadow-2xl space-y-0">
            {/* Modal Header */}
            <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center">
                  <FolderSync className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-bold text-base text-slate-900">
                    バックアップデータの復元確認
                  </h4>
                  <p className="text-xs text-slate-500">
                    ファイル: {importPendingData.fileName}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setImportPendingData(null)}
                className="p-2 rounded-xl hover:bg-slate-200/60 text-slate-400 hover:text-slate-700 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-5">
              {/* File Info Card */}
              <div className="p-4 rounded-2xl bg-indigo-50/60 border border-indigo-100 space-y-2">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-indigo-900 font-semibold">検出された取引件数:</span>
                  <span className="font-extrabold text-indigo-700 text-sm">
                    {importPendingData.transactions.length} 件
                  </span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-indigo-900 font-semibold">売上件数 / 経費件数:</span>
                  <span className="font-bold text-slate-700">
                    売上 {importPendingData.transactions.filter(t => t.type === 'income').length} 件 / 
                    経費 {importPendingData.transactions.filter(t => t.type === 'expense').length} 件
                  </span>
                </div>
                {importPendingData.exportedAt && (
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-indigo-900 font-semibold">バックアップ作成日時:</span>
                    <span className="font-mono text-slate-600 text-[11px]">
                      {new Date(importPendingData.exportedAt).toLocaleString('ja-JP')}
                    </span>
                  </div>
                )}
              </div>

              {/* Restore Mode Selection */}
              <div className="space-y-2.5">
                <label className="text-xs font-bold text-slate-900 block">
                  復元方法を選択してください:
                </label>

                <div className="space-y-2">
                  <label
                    className={`flex items-start gap-3 p-3.5 rounded-2xl border cursor-pointer transition ${
                      importMode === 'replace'
                        ? 'bg-indigo-50/70 border-indigo-500 shadow-xs'
                        : 'bg-white border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <input
                      type="radio"
                      name="importMode"
                      value="replace"
                      checked={importMode === 'replace'}
                      onChange={() => setImportMode('replace')}
                      className="mt-1 text-indigo-600 focus:ring-indigo-500"
                    />
                    <div>
                      <div className="text-xs font-bold text-slate-900">
                        全データを上書きして復元（推奨）
                      </div>
                      <div className="text-[11px] text-slate-500 mt-0.5">
                        現在の取引帳簿をクリアし、バックアップファイルの内容をそのまま復元します。
                      </div>
                    </div>
                  </label>

                  <label
                    className={`flex items-start gap-3 p-3.5 rounded-2xl border cursor-pointer transition ${
                      importMode === 'merge'
                        ? 'bg-indigo-50/70 border-indigo-500 shadow-xs'
                        : 'bg-white border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <input
                      type="radio"
                      name="importMode"
                      value="merge"
                      checked={importMode === 'merge'}
                      onChange={() => setImportMode('merge')}
                      className="mt-1 text-indigo-600 focus:ring-indigo-500"
                    />
                    <div>
                      <div className="text-xs font-bold text-slate-900">
                        現在のデータに追加・統合（マージ）
                      </div>
                      <div className="text-[11px] text-slate-500 mt-0.5">
                        既存の取引データを残したまま、バックアップ内のデータを帳簿に追加します。
                      </div>
                    </div>
                  </label>
                </div>
              </div>
            </div>

            {/* Modal Footer Actions */}
            <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setImportPendingData(null)}
                className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-white text-xs font-bold transition cursor-pointer"
              >
                キャンセル
              </button>

              <button
                type="button"
                id="confirm-import-execute-btn"
                onClick={handleConfirmImport}
                className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-xs transition flex items-center gap-1.5 cursor-pointer"
              >
                <Check className="w-4 h-4" />
                復元を実行する
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

