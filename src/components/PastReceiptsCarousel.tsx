import React, { useRef, useState } from 'react';
import { Transaction } from '../types';
import { 
  ChevronLeft, 
  ChevronRight, 
  Receipt, 
  Store, 
  Calendar, 
  Tag, 
  Sparkles, 
  Eye, 
  Copy, 
  X, 
  ExternalLink,
  CheckCircle2,
  FileText,
  Clock
} from 'lucide-react';

interface PastReceiptsCarouselProps {
  transactions: Transaction[];
  onSelectReceiptForForm: (transaction: Transaction) => void;
  onNavigateToLedger: () => void;
}

export const PastReceiptsCarousel: React.FC<PastReceiptsCarouselProps> = ({
  transactions,
  onSelectReceiptForForm,
  onNavigateToLedger,
}) => {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [selectedReceiptModal, setSelectedReceiptModal] = useState<Transaction | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Filter transactions that were scanned by AI OCR or have receipt images, sorted newest first
  const aiReceipts = transactions
    .filter((t) => t.type === 'expense' && (t.source === 'ai_ocr' || t.receiptImage))
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  // Fallback: If no AI OCR receipts yet, show recent expenses as virtual receipts
  const displayReceipts = aiReceipts.length > 0 
    ? aiReceipts 
    : transactions.filter(t => t.type === 'expense').slice(0, 5);

  const handleScroll = (direction: 'left' | 'right') => {
    if (scrollContainerRef.current) {
      const scrollAmount = 320;
      scrollContainerRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth',
      });
    }
  };

  const handleCopyData = (t: Transaction) => {
    onSelectReceiptForForm(t);
    setCopiedId(t.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  if (displayReceipts.length === 0) {
    return (
      <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs">
        <div className="flex items-center gap-2 text-slate-800 font-bold text-base mb-2">
          <Receipt className="w-5 h-5 text-indigo-600" />
          <span>過去にAI読取したレシート履歴 (カルーセル)</span>
        </div>
        <p className="text-xs text-slate-500">
          レシートを撮影またはアップロードして登録すると、ここに過去のレシート履歴がカルーセル形式でストックされます。
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-200 shadow-xs space-y-4">
      {/* Carousel Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3.5">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-amber-500/10 text-amber-600 flex items-center justify-center font-bold">
              <Receipt className="w-4 h-4" />
            </div>
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              過去のAI読取レシート履歴
              <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 font-bold">
                {displayReceipts.length} 件
              </span>
            </h3>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            これまでにAI解析・登録したレシート画像の一覧です。カードをクリックして詳細確認やフォームへの再利用が可能です。
          </p>
        </div>

        {/* Carousel Navigation Buttons */}
        <div className="flex items-center gap-2 self-end sm:self-auto">
          <button
            type="button"
            onClick={() => handleScroll('left')}
            className="p-2 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-600 hover:text-slate-900 transition active:scale-95 cursor-pointer"
            aria-label="前へスクロール"
            title="前へ"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => handleScroll('right')}
            className="p-2 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-600 hover:text-slate-900 transition active:scale-95 cursor-pointer"
            aria-label="次へスクロール"
            title="次へ"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Carousel Scroll Container */}
      <div
        ref={scrollContainerRef}
        className="flex gap-4 overflow-x-auto pb-3 pt-1 scroll-smooth snap-x snap-mandatory no-scrollbar"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {displayReceipts.map((tx) => {
          const hasImage = !!tx.receiptImage;
          const isCopied = copiedId === tx.id;

          return (
            <div
              key={tx.id}
              className="w-[280px] sm:w-[300px] shrink-0 snap-start bg-slate-50 hover:bg-slate-100/80 rounded-2xl border border-slate-200 overflow-hidden shadow-xs hover:shadow-md transition-all duration-200 flex flex-col group"
            >
              {/* Receipt Image / Ticket Thumbnail */}
              <div 
                className="relative h-44 bg-slate-900 flex items-center justify-center overflow-hidden cursor-pointer"
                onClick={() => setSelectedReceiptModal(tx)}
              >
                {hasImage ? (
                  <img
                    src={tx.receiptImage}
                    alt={tx.merchant || 'レシート'}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300 opacity-90 group-hover:opacity-100"
                  />
                ) : (
                  /* Simulated Paper Receipt graphic if no image */
                  <div className="w-48 bg-white p-3.5 rounded-lg shadow-sm font-mono text-[11px] text-slate-800 space-y-1.5 transform group-hover:-translate-y-1 transition-transform">
                    <div className="text-center font-bold border-b border-dashed border-slate-300 pb-1 text-slate-900">
                      {tx.merchant || '店舗領収書'}
                    </div>
                    <div className="flex justify-between text-[10px] text-slate-500">
                      <span>{tx.date}</span>
                      <span>10%対象</span>
                    </div>
                    <div className="border-t border-dashed border-slate-300 pt-1 flex justify-between font-bold text-xs text-indigo-700">
                      <span>合計(税込)</span>
                      <span>¥{Math.round(tx.total).toLocaleString()}</span>
                    </div>
                    <div className="text-[9px] text-slate-400 text-center">AI OCR SCAN ARCHIVE</div>
                  </div>
                )}

                {/* AI Badge Overlay */}
                <div className="absolute top-2.5 left-2.5 bg-slate-900/80 backdrop-blur-xs text-amber-300 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 border border-amber-400/30">
                  <Sparkles className="w-3 h-3 text-amber-400" />
                  AI読取済
                </div>

                {/* View Details Hover Overlay */}
                <div className="absolute inset-0 bg-indigo-950/50 backdrop-blur-[2px] opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                  <span className="bg-white text-slate-900 text-xs font-bold px-3 py-1.5 rounded-xl shadow-md flex items-center gap-1.5 transform scale-95 group-hover:scale-100 transition-transform">
                    <Eye className="w-3.5 h-3.5 text-indigo-600" />
                    拡大プレビュー
                  </span>
                </div>
              </div>

              {/* Receipt Info Body */}
              <div className="p-3.5 flex-1 flex flex-col justify-between space-y-2.5">
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-slate-900 truncate" title={tx.merchant || '領収書'}>
                      {tx.merchant || '店舗領収書'}
                    </span>
                    <span className="text-[11px] font-semibold text-slate-500 shrink-0">
                      {tx.date}
                    </span>
                  </div>

                  <div className="mt-1 flex items-center justify-between">
                    <span className="text-[11px] px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 font-semibold border border-indigo-100">
                      {tx.category || '消耗品費'}
                    </span>
                    <div className="text-right">
                      <span className="text-sm font-extrabold text-slate-900">
                        ¥{Math.round(tx.total).toLocaleString()}
                      </span>
                    </div>
                  </div>

                  {tx.description && (
                    <p className="text-[11px] text-slate-500 truncate mt-1" title={tx.description}>
                      {tx.description}
                    </p>
                  )}
                </div>

                {/* Action Buttons */}
                <div className="pt-2 border-t border-slate-200/60 flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => handleCopyData(tx)}
                    className="flex-1 py-1.5 px-2 rounded-lg bg-white border border-slate-200 hover:bg-indigo-50 hover:border-indigo-300 text-slate-700 hover:text-indigo-700 text-[11px] font-bold transition flex items-center justify-center gap-1 cursor-pointer"
                    title="このレシートの内容を現在の入力フォームに適用"
                  >
                    {isCopied ? (
                      <>
                        <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                        <span className="text-emerald-700">フォームへ読込完了</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3 h-3 text-slate-400" />
                        <span>フォームに再読込</span>
                      </>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedReceiptModal(tx)}
                    className="p-1.5 rounded-lg bg-white border border-slate-200 hover:bg-slate-100 text-slate-600 transition cursor-pointer"
                    title="プレビュー詳細"
                  >
                    <Eye className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Modal: Full Receipt Preview & Inspection */}
      {selectedReceiptModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-xl w-full overflow-hidden border border-slate-200 shadow-2xl flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center">
                  <Receipt className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="font-bold text-sm text-slate-900">
                    {selectedReceiptModal.merchant || '領収書プレビュー'}
                  </h4>
                  <p className="text-[11px] text-slate-500">
                    AI読取日: {selectedReceiptModal.date} | ID: {selectedReceiptModal.id}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedReceiptModal(null)}
                className="p-1.5 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body: Image & Financial Breakdown */}
            <div className="p-5 overflow-y-auto space-y-4">
              {/* Image View */}
              {selectedReceiptModal.receiptImage ? (
                <div className="rounded-2xl overflow-hidden bg-slate-950 flex items-center justify-center border border-slate-200 max-h-[340px]">
                  <img
                    src={selectedReceiptModal.receiptImage}
                    alt={selectedReceiptModal.merchant || 'レシート'}
                    className="max-h-[320px] w-auto object-contain mx-auto"
                  />
                </div>
              ) : (
                <div className="p-6 rounded-2xl bg-slate-50 border border-slate-200 text-center space-y-2">
                  <Receipt className="w-10 h-10 text-slate-400 mx-auto" />
                  <div className="text-xs font-bold text-slate-700">レシート原本データ</div>
                  <p className="text-[11px] text-slate-500">
                    AI OCR解析済みの仕訳データです。
                  </p>
                </div>
              )}

              {/* Financial Summary Details */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                  <span className="text-slate-500 font-medium block">税込総額</span>
                  <span className="text-base font-extrabold text-slate-900">
                    ¥{Math.round(selectedReceiptModal.total).toLocaleString()}
                  </span>
                </div>
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                  <span className="text-slate-500 font-medium block">税抜経費</span>
                  <span className="text-base font-bold text-indigo-700">
                    ¥{Math.round(selectedReceiptModal.amount).toLocaleString()}
                  </span>
                </div>
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 col-span-2 sm:col-span-1">
                  <span className="text-slate-500 font-medium block">消費税 ({Math.round(selectedReceiptModal.taxRate * 100)}%)</span>
                  <span className="text-base font-bold text-slate-700">
                    ¥{Math.round(selectedReceiptModal.tax).toLocaleString()}
                  </span>
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100 space-y-1.5 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-500 font-medium">勘定科目:</span>
                  <span className="font-bold text-slate-800">{selectedReceiptModal.category}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 font-medium">支払先:</span>
                  <span className="font-bold text-slate-800">{selectedReceiptModal.merchant || '未設定'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 font-medium">摘要:</span>
                  <span className="font-bold text-slate-800">{selectedReceiptModal.description || '-'}</span>
                </div>
              </div>
            </div>

            {/* Modal Footer Actions */}
            <div className="p-4 bg-slate-50 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => {
                  onSelectReceiptForForm(selectedReceiptModal);
                  setSelectedReceiptModal(null);
                }}
                className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-xs transition cursor-pointer"
              >
                <Copy className="w-3.5 h-3.5" />
                このレシートを入力フォームに反映
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedReceiptModal(null);
                    onNavigateToLedger();
                  }}
                  className="px-3.5 py-2.5 rounded-xl bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
                >
                  <FileText className="w-3.5 h-3.5" />
                  取引明細帳で確認
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedReceiptModal(null)}
                  className="px-3.5 py-2.5 rounded-xl text-slate-500 hover:text-slate-800 text-xs font-semibold"
                >
                  閉じる
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
