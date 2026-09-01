import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Transaction, OcrResult, ExpenseCategory } from '../types';
import { SAMPLE_RECEIPTS, SampleReceipt } from '../data/sampleReceipts';
import { LiveCameraModal } from './LiveCameraModal';
import { PastReceiptsCarousel } from './PastReceiptsCarousel';
import { 
  ALL_EXPENSE_CATEGORIES, 
  EXPENSE_CATEGORIES_INFO, 
  getCategoryBadgeStyle 
} from '../data/categories';
import { classifyAccountSubject } from '../accountRules';
import confetti from 'canvas-confetti';
import { 
  Camera, 
  Upload, 
  Sparkles, 
  CheckCircle2, 
  AlertCircle, 
  ChevronDown, 
  ChevronUp, 
  FileText, 
  Store, 
  Calendar, 
  Tag, 
  RefreshCw, 
  HelpCircle,
  Eye,
  Check,
  Clipboard,
  ArrowRight,
  TrendingDown,
  Percent,
  ReceiptText,
  Info,
  PenTool,
  FileCheck2,
  Receipt,
  Wand2
} from 'lucide-react';

interface ReceiptOcrViewProps {
  transactions?: Transaction[];
  onAddTransaction: (transaction: Omit<Transaction, 'id' | 'createdAt'>) => void;
  onNavigateToLedger: () => void;
}

// Client-side image optimizer to speed up uploads and ensure pristine OCR legibility
function optimizeImage(file: File): Promise<{ base64: string; mimeType: string }> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const src = e.target?.result as string;
      const img = new Image();
      img.onload = () => {
        const maxDim = 1800;
        let width = img.width;
        let height = img.height;

        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          const compressed = canvas.toDataURL('image/jpeg', 0.90);
          resolve({ base64: compressed, mimeType: 'image/jpeg' });
          return;
        }
        resolve({ base64: src, mimeType: file.type || 'image/jpeg' });
      };
      img.onerror = () => {
        resolve({ base64: src, mimeType: file.type || 'image/jpeg' });
      };
      img.src = src;
    };
    reader.readAsDataURL(file);
  });
}

export const ReceiptOcrView: React.FC<ReceiptOcrViewProps> = ({
  transactions = [],
  onAddTransaction,
  onNavigateToLedger,
}) => {
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [ocrResult, setOcrResult] = useState<OcrResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [showRawText, setShowRawText] = useState(false);
  const [selectedSample, setSelectedSample] = useState<SampleReceipt | null>(null);
  const [isCameraModalOpen, setIsCameraModalOpen] = useState(false);

  // Editable fields before confirming
  const [merchant, setMerchant] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [total, setTotal] = useState<number>(0);
  const [taxRate, setTaxRate] = useState<number>(0.10);
  const [category, setCategory] = useState<ExpenseCategory>('消耗品費');
  const [description, setDescription] = useState('');
  const [documentType, setDocumentType] = useState('receipt');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('');
  // Name of the auto-classification rule that overrode the AI-guessed category (if any)
  const [appliedRuleName, setAppliedRuleName] = useState<string | null>(null);

  // Run a receipt through the user's account-classification rules (src/AccountRuleSettings.tsx).
  // Returns the matched category + rule name, or nulls if no rule matched (AI's own guess is kept).
  const runAccountRules = (r: {
    merchant: string;
    description: string;
    paymentMethod?: string;
    items?: { name: string }[];
  }): { category: string | null; ruleName: string | null } => {
    const result = classifyAccountSubject({
      store: r.merchant,
      company: r.merchant,
      description: r.description,
      items: r.items,
      paymentMethod: r.paymentMethod,
    });
    return { category: result.accountSubject, ruleName: result.rule?.name || null };
  };

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  // Run AI OCR
  const executeOcr = useCallback(async (imgBase64: string, mime: string, sampleData?: SampleReceipt) => {
    setIsProcessing(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      if (sampleData) {
        await new Promise((r) => setTimeout(r, 600));
        const data: OcrResult = {
          merchant: sampleData.defaultData.merchant,
          date: sampleData.defaultData.date,
          total: sampleData.defaultData.total,
          amount: sampleData.defaultData.amount,
          tax: sampleData.defaultData.tax,
          taxRate: 0.10,
          documentType: 'receipt',
          category: sampleData.defaultData.category,
          description: sampleData.defaultData.description,
          rawText: sampleData.sampleText,
          confidence: 0.98,
        };
        setOcrResult(data);
        setMerchant(data.merchant);
        setDate(data.date);
        setTotal(data.total);
        setTaxRate(data.taxRate);
        setDescription(data.description);
        setDocumentType(data.documentType || 'receipt');
        setInvoiceNumber(data.invoiceNumber || '');
        setPaymentMethod(data.paymentMethod || '');

        // Auto-classification rules take priority over the AI's own category guess
        const ruleMatch = runAccountRules({
          merchant: data.merchant,
          description: data.description,
          paymentMethod: data.paymentMethod,
        });
        if (ruleMatch.category) {
          setCategory(ruleMatch.category as ExpenseCategory);
          setAppliedRuleName(ruleMatch.ruleName);
        } else {
          setCategory((data.category as ExpenseCategory) || '消耗品費');
          setAppliedRuleName(null);
        }
        return;
      }

      // If user uploaded or captured an image, call the backend Gemini OCR API
      const res = await fetch('/api/receipt-ocr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageBase64: imgBase64,
          mimeType: mime || 'image/jpeg',
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'レシート・請求書の解析に失敗しました。');
      }

      const parsed: OcrResult = json.data;
      setOcrResult(parsed);

      const detectedMerchant = parsed.merchant && parsed.merchant.trim() ? parsed.merchant.trim() : '手書き領収書 / 店舗';
      const detectedTotal = Math.max(0, Number(parsed.total) || 0);
      const detectedDate = parsed.date || new Date().toISOString().slice(0, 10);
      const detectedTaxRate = parsed.taxRate === 0.08 ? 0.08 : 0.10;
      const aiCategory = (parsed.category as ExpenseCategory) || '消耗品費';
      const detectedDesc = parsed.description || `${detectedMerchant} での経費`;

      setMerchant(detectedMerchant);
      setDate(detectedDate);
      setTotal(detectedTotal);
      setTaxRate(detectedTaxRate);
      setDescription(detectedDesc);
      setDocumentType(parsed.documentType || 'receipt');
      setInvoiceNumber(parsed.invoiceNumber || '');
      setPaymentMethod(parsed.paymentMethod || '');

      // Auto-classification rules take priority over the AI's own category guess
      const ruleMatch = runAccountRules({
        merchant: detectedMerchant,
        description: detectedDesc,
        paymentMethod: parsed.paymentMethod,
        items: parsed.items,
      });
      if (ruleMatch.category) {
        setCategory(ruleMatch.category as ExpenseCategory);
        setAppliedRuleName(ruleMatch.ruleName);
      } else {
        setCategory(aiCategory);
        setAppliedRuleName(null);
      }

    } catch (err: any) {
      console.error(err);
      setErrorMessage(err?.message || '自動読取中にエラーが発生しました。手動で数値を補正して登録できます。');
    } finally {
      setIsProcessing(false);
    }
  }, []);

  // Handle file select with client optimization
  const handleFileChange = async (file: File) => {
    setErrorMessage(null);
    setSuccessMessage(null);
    setOcrResult(null);
    setSelectedSample(null);
    setSelectedFile(file);

    try {
      const { base64, mimeType } = await optimizeImage(file);
      setImagePreview(base64);
      executeOcr(base64, mimeType);
    } catch (err) {
      const reader = new FileReader();
      reader.onload = () => {
        const base64 = reader.result as string;
        setImagePreview(base64);
        executeOcr(base64, file.type || 'image/jpeg');
      };
      reader.readAsDataURL(file);
    }
  };

  // Handle live camera capture
  const handleCameraCapture = (dataUrl: string, file: File) => {
    setSelectedSample(null);
    setSelectedFile(file);
    setImagePreview(dataUrl);
    executeOcr(dataUrl, file.type || 'image/jpeg');
  };

  // Listen for clipboard paste anywhere in window
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      if (e.clipboardData && e.clipboardData.files && e.clipboardData.files.length > 0) {
        const file = e.clipboardData.files[0];
        if (file.type.startsWith('image/')) {
          e.preventDefault();
          handleFileChange(file);
        }
      }
    };

    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [executeOcr]);

  // Select a preset sample receipt & generate high-fidelity canvas mockup
  const handleSelectSample = (sample: SampleReceipt) => {
    setSelectedSample(sample);
    setSelectedFile(null);
    setErrorMessage(null);
    setSuccessMessage(null);
    setOcrResult(null);

    const canvas = document.createElement('canvas');
    canvas.width = 440;
    canvas.height = 580;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      if (sample.id === 'sample-handwritten-receipt') {
        // Japanese traditional handwritten receipt style
        ctx.fillStyle = '#fefcf6'; // Warm cream paper
        ctx.fillRect(0, 0, 440, 580);
        
        // Ornamental border
        ctx.strokeStyle = '#78350f';
        ctx.lineWidth = 2;
        ctx.strokeRect(15, 15, 410, 550);
        ctx.strokeStyle = '#b45309';
        ctx.lineWidth = 1;
        ctx.strokeRect(19, 19, 402, 542);

        ctx.fillStyle = '#1e293b';
        ctx.font = 'bold 22px "Noto Sans JP", serif';
        ctx.textAlign = 'center';
        ctx.fillText('領　収　証', 220, 60);

        ctx.font = '12px "Noto Sans JP", sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText(`No. 2026-088`, 35, 90);
        ctx.textAlign = 'right';
        ctx.fillText(`${sample.defaultData.date} 発行`, 405, 90);

        ctx.textAlign = 'left';
        ctx.font = 'bold 15px "Noto Sans JP", sans-serif';
        ctx.fillText('株式会社クラウドデザイン 御中', 35, 125);
        ctx.strokeStyle = '#94a3b8';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(35, 132);
        ctx.lineTo(260, 132);
        ctx.stroke();

        // Big handwritten amount box
        ctx.fillStyle = '#fef3c7';
        ctx.fillRect(35, 150, 370, 65);
        ctx.strokeStyle = '#d97706';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(35, 150, 370, 65);

        ctx.fillStyle = '#b45309';
        ctx.font = 'bold 13px "Noto Sans JP", sans-serif';
        ctx.fillText('金　額', 45, 172);

        ctx.fillStyle = '#0f172a';
        ctx.font = 'bold 26px "Noto Sans JP", monospace';
        ctx.fillText(`¥ 12,800 -  (也)`, 110, 192);

        ctx.fillStyle = '#475569';
        ctx.font = '11px "Noto Sans JP", sans-serif';
        ctx.fillText('(内消費税等 ¥1,163  10%対象)', 220, 208);

        ctx.fillStyle = '#1e293b';
        ctx.font = '13px "Noto Sans JP", sans-serif';
        ctx.fillText('但し　事務所用インテリア備品・消耗品代 として', 35, 250);
        ctx.fillText('上記正に領収いたしました。', 35, 275);

        // Merchant Stamp / Seal (Hanko) in vermilion
        ctx.fillStyle = '#334155';
        ctx.font = '12px "Noto Sans JP", sans-serif';
        ctx.fillText('【発行者】', 35, 340);
        ctx.font = 'bold 14px "Noto Sans JP", sans-serif';
        ctx.fillText(sample.defaultData.merchant, 35, 365);
        ctx.font = '11px "Noto Sans JP", sans-serif';
        ctx.fillText('東京都渋谷区神南1-10-5', 35, 385);
        ctx.fillText('TEL: 03-5400-XXXX', 35, 405);
        ctx.fillText('登録番号: T1234567890123', 35, 425);

        // Draw Hanko stamp circle in red
        ctx.strokeStyle = '#dc2626';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(360, 380, 28, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = '#dc2626';
        ctx.font = 'bold 11px "Noto Sans JP", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('渋谷', 360, 375);
        ctx.fillText('クラフト', 360, 390);

      } else if (sample.id === 'sample-handwritten-invoice') {
        // Japanese invoice slip style
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, 440, 580);
        
        ctx.strokeStyle = '#cbd5e1';
        ctx.lineWidth = 1;
        ctx.strokeRect(15, 15, 410, 550);

        ctx.fillStyle = '#1e293b';
        ctx.font = 'bold 22px "Noto Sans JP", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('御　請　求　書', 220, 60);

        ctx.font = '11px "Noto Sans JP", sans-serif';
        ctx.textAlign = 'right';
        ctx.fillText(`請求日: ${sample.defaultData.date}`, 405, 90);
        ctx.fillText('お支払期日: 2026/09/30', 405, 105);

        ctx.textAlign = 'left';
        ctx.font = 'bold 14px "Noto Sans JP", sans-serif';
        ctx.fillText('クライアント合同会社 御中', 35, 110);

        // Big invoice total box
        ctx.fillStyle = '#eff6ff';
        ctx.fillRect(35, 130, 370, 55);
        ctx.strokeStyle = '#3b82f6';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(35, 130, 370, 55);

        ctx.fillStyle = '#1e40af';
        ctx.font = 'bold 12px "Noto Sans JP", sans-serif';
        ctx.fillText('今回御請求額 (税込)', 45, 152);

        ctx.fillStyle = '#0f172a';
        ctx.font = 'bold 24px "Noto Sans JP", monospace';
        ctx.fillText(`¥ 88,000 -`, 180, 168);

        // Items table
        ctx.fillStyle = '#f8fafc';
        ctx.fillRect(35, 205, 370, 24);
        ctx.fillStyle = '#475569';
        ctx.font = 'bold 11px "Noto Sans JP", sans-serif';
        ctx.fillText('品名・件名', 45, 221);
        ctx.textAlign = 'right';
        ctx.fillText('金額 (円)', 395, 221);

        ctx.textAlign = 'left';
        ctx.font = '11px "Noto Sans JP", sans-serif';
        ctx.fillStyle = '#1e293b';
        ctx.fillText('1. WebアプリUIフロントエンド改修一式', 45, 250);
        ctx.textAlign = 'right';
        ctx.fillText('¥50,000', 395, 250);

        ctx.textAlign = 'left';
        ctx.fillText('2. データベースAPI実装・結合テスト', 45, 280);
        ctx.textAlign = 'right';
        ctx.fillText('¥30,000', 395, 280);

        ctx.strokeStyle = '#e2e8f0';
        ctx.beginPath();
        ctx.moveTo(35, 305);
        ctx.lineTo(405, 305);
        ctx.stroke();

        ctx.fillText('小計 (税抜):  ¥80,000', 395, 330);
        ctx.fillText('消費税 (10%):  ¥8,000', 395, 350);
        ctx.font = 'bold 13px "Noto Sans JP", sans-serif';
        ctx.fillText('合計請求額:  ¥88,000', 395, 375);

        // Issuer & Stamp
        ctx.textAlign = 'left';
        ctx.font = 'bold 13px "Noto Sans JP", sans-serif';
        ctx.fillText('【請求元】', 35, 430);
        ctx.fillText(sample.defaultData.merchant, 35, 452);
        ctx.font = '11px "Noto Sans JP", sans-serif';
        ctx.fillText('代表: 田中 健一', 35, 472);
        ctx.fillText('インボイス登録番号: T9876543210987', 35, 492);

        // Hanko stamp
        ctx.strokeStyle = '#dc2626';
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        ctx.arc(360, 465, 24, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = '#dc2626';
        ctx.font = 'bold 11px "Noto Sans JP", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('田中', 360, 462);
        ctx.fillText('之印', 360, 476);

      } else {
        // Standard POS / Receipt Slip
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, 440, 580);
        ctx.fillStyle = '#1e293b';
        ctx.font = 'bold 16px "Noto Sans JP", monospace';
        ctx.textAlign = 'center';
        ctx.fillText(sample.defaultData.merchant, 220, 45);
        ctx.font = '12px "Noto Sans JP", monospace';
        ctx.fillText(sample.defaultData.date + ' 発行', 220, 70);
        ctx.fillText('領 収 書 (RECEIPT)', 220, 95);

        ctx.textAlign = 'left';
        ctx.font = '11px "Noto Sans JP", monospace';
        ctx.fillText('----------------------------------------------------', 30, 115);
        
        const lines = sample.sampleText.split('\n').slice(4, 11);
        let y = 135;
        lines.forEach((line) => {
          ctx.fillText(line, 35, y);
          y += 24;
        });

        ctx.fillText('----------------------------------------------------', 30, y);
        y += 30;
        ctx.font = 'bold 18px "Noto Sans JP", monospace';
        ctx.fillText(`合計(税込):  ¥${sample.defaultData.total.toLocaleString()}`, 35, y);
        y += 25;
        ctx.font = '11px "Noto Sans JP", monospace';
        ctx.fillText(`(内消費税等 10%:  ¥${sample.defaultData.tax.toLocaleString()})`, 35, y);
        y += 35;
        ctx.fillText('インボイス登録番号: T1234567890123', 35, y);
      }

      const dataUrl = canvas.toDataURL('image/png');
      setImagePreview(dataUrl);
      executeOcr(dataUrl, 'image/png', sample);
    }
  };

  // Register Transaction into Database / State
  const handleSaveTransaction = () => {
    if (total <= 0) {
      setErrorMessage('金額は0円より大きい値を入力してください。');
      return;
    }

    const calculatedTax = Math.round(total - total / (1 + taxRate));
    const calculatedAmount = Math.round(total - calculatedTax);
    const finalMerchant = merchant.trim() || '店舗領収書';

    onAddTransaction({
      type: 'expense',
      amount: calculatedAmount, // 税抜金額
      tax: calculatedTax, // 消費税
      total: total, // 税込合計
      description: description.trim() || `${finalMerchant} での支払い${documentType !== 'receipt' ? `（${documentType === 'invoice' ? '請求書' : documentType === 'statement' ? '明細' : '書類'}）` : ''}`,
      category: category || '消耗品費',
      date: date || new Date().toISOString().slice(0, 10),
      taxRate: taxRate,
      merchant: finalMerchant,
      source: 'ai_ocr',
      receiptImage: imagePreview || undefined,
      documentType: (documentType as any) || 'receipt',
      invoiceNumber: invoiceNumber.trim() || undefined,
      paymentMethod: paymentMethod.trim() || undefined,
      items: ocrResult?.items || [],
    });

    // Trigger celebration balloons / confetti
    confetti({
      particleCount: 100,
      spread: 70,
      origin: { y: 0.6 },
    });

    const categoryNote = appliedRuleName
      ? `経費（${category} ／ ルール「${appliedRuleName}」適用）`
      : `経費（${category}）`;
    setSuccessMessage(
      `✅ 成功！ AIが【${finalMerchant}】の 税込 ¥${Math.round(total).toLocaleString()} (税抜 ¥${calculatedAmount.toLocaleString()}) を読み取り、${categoryNote}として帳簿に自動反映しました！`
    );
  };

  // Handle selection of a past receipt from carousel into current form
  const handleSelectReceiptForForm = (pastTx: Transaction) => {
    setMerchant(pastTx.merchant || '');
    setDate(pastTx.date || new Date().toISOString().slice(0, 10));
    setTotal(pastTx.total || 0);
    setTaxRate(pastTx.taxRate || 0.10);
    setCategory(pastTx.category || '消耗品費');
    setDescription(pastTx.description || '');
    setDocumentType(pastTx.documentType || 'receipt');
    setInvoiceNumber(pastTx.invoiceNumber || '');
    setPaymentMethod(pastTx.paymentMethod || '');
    setAppliedRuleName(null);
    if (pastTx.receiptImage) {
      setImagePreview(pastTx.receiptImage);
    }
    setErrorMessage(null);
    setSuccessMessage(`ℹ️ 過去のレシート（${pastTx.merchant || '領収書'} / ¥${pastTx.total.toLocaleString()}）の内容を入力フォームに読み込みました。必要に応じて編集して登録できます。`);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Reset to read another
  const handleReset = () => {
    setImagePreview(null);
    setSelectedFile(null);
    setOcrResult(null);
    setSelectedSample(null);
    setErrorMessage(null);
    setSuccessMessage(null);
    setMerchant('');
    setTotal(0);
    setDescription('');
    setDocumentType('receipt');
    setInvoiceNumber('');
    setPaymentMethod('');
    setAppliedRuleName(null);
  };

  // Calculated amounts for preview
  const previewTax = Math.round(total - total / (1 + taxRate));
  const previewAmount = Math.round(total - previewTax);

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div>
        <div className="flex flex-wrap items-center gap-2 mb-1">
          <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
            📸 写真でレシート・請求書を自動読取 (AI OCR)
          </h2>
          <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-900 border border-amber-300 flex items-center gap-1">
            <PenTool className="w-3 h-3 text-amber-700" />
            手書き領収書・手書き請求書・POSレシート対応
          </span>
        </div>
        <p className="text-sm text-slate-600">
          スマホ撮影の写真やスキャン画像をアップロードするだけで、AIが<strong>手書き文字・金額・店舗名（発行元）・消費税・勘定科目</strong>を高精度に自動認識し、経費フォームへ瞬時に反映します。
        </p>
      </div>

      {/* Success Notification Banner with Actions */}
      {successMessage && (
        <div className="p-5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 shadow-sm animate-in fade-in">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0 mt-0.5">
              <Check className="w-5 h-5" />
            </div>
            <div className="flex-1">
              <h4 className="font-bold text-emerald-900 text-sm">経費の登録が完了しました！</h4>
              <p className="text-xs text-emerald-700 mt-1 leading-relaxed">{successMessage}</p>
              <div className="mt-4 flex flex-wrap gap-2.5">
                <button
                  onClick={onNavigateToLedger}
                  className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-xs transition flex items-center gap-1.5 cursor-pointer"
                >
                  <FileText className="w-3.5 h-3.5" />
                  取引明細帳で確認する
                </button>
                <button
                  onClick={handleReset}
                  className="px-3.5 py-2 rounded-xl bg-white border border-emerald-300 text-emerald-800 text-xs font-semibold hover:bg-emerald-100/50 transition flex items-center gap-1.5 cursor-pointer"
                >
                  <Camera className="w-3.5 h-3.5" />
                  続けて別のレシート・請求書を読取
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Error Banner */}
      {errorMessage && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Main Grid: Upload Area on Left, AI Output / Confirmation on Right */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Image Upload & Preview */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs space-y-4">
            <h3 className="text-sm font-bold text-slate-800 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <ReceiptText className="w-4 h-4 text-indigo-600" />
                レシート・領収証・請求書写真の入力
              </span>
              {imagePreview && (
                <button
                  onClick={handleReset}
                  className="text-xs text-slate-500 hover:text-slate-800 flex items-center gap-1 font-medium cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  再撮影 / 変更
                </button>
              )}
            </h3>

            {/* Drag & drop or upload container */}
            {!imagePreview ? (
              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                    handleFileChange(e.dataTransfer.files[0]);
                  }
                }}
                className="border-2 border-dashed border-slate-300 hover:border-indigo-500 hover:bg-indigo-50/20 rounded-2xl p-6 sm:p-8 text-center transition-all cursor-pointer group"
                onClick={() => fileInputRef.current?.click()}
              >
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={(e) => e.target.files?.[0] && handleFileChange(e.target.files[0])}
                  accept="image/jpeg,image/png,image/jpg,image/webp,image/heic"
                  className="hidden"
                />
                <input
                  type="file"
                  ref={cameraInputRef}
                  onChange={(e) => e.target.files?.[0] && handleFileChange(e.target.files[0])}
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                />

                <div className="w-16 h-16 rounded-2xl bg-indigo-50 text-indigo-600 mx-auto flex items-center justify-center mb-3 group-hover:scale-110 transition-transform shadow-xs">
                  <Camera className="w-8 h-8" />
                </div>
                <div className="font-bold text-sm text-slate-800">
                  レシート・領収書・請求書を撮影 / 選択
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  クリックして写真選択、またはドラッグ＆ドロップ (JPG / PNG / 手書き対応)
                </p>

                {/* Direct Action Buttons */}
                <div className="mt-5 pt-4 border-t border-slate-100 flex flex-wrap items-center justify-center gap-2.5">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsCameraModalOpen(true);
                    }}
                    className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold shadow-xs hover:scale-102 active:scale-98 transition cursor-pointer"
                  >
                    <Camera className="w-4 h-4" />
                    カメラで撮影する
                  </button>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      fileInputRef.current?.click();
                    }}
                    className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition cursor-pointer"
                  >
                    <Upload className="w-4 h-4" />
                    写真ファイルを選ぶ
                  </button>
                </div>

                <div className="mt-3 text-[11px] text-slate-400 flex items-center justify-center gap-1">
                  <Clipboard className="w-3 h-3" />
                  <span>Ctrl + V でクリップボードの画像貼り付けも可能</span>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="relative rounded-2xl overflow-hidden border border-slate-200 bg-slate-950 max-h-[400px] flex items-center justify-center group shadow-inner">
                  <img
                    src={imagePreview}
                    alt="レシート読み取り画像"
                    className="max-h-[380px] w-auto object-contain mx-auto transition-transform"
                  />

                  {/* Scanning Laser Line Effect while processing */}
                  {isProcessing && (
                    <>
                      <div className="absolute inset-0 bg-indigo-950/75 backdrop-blur-xs flex flex-col items-center justify-center text-white p-4 text-center z-10">
                        <div className="w-12 h-12 border-3 border-amber-400 border-t-transparent rounded-full animate-spin mb-3 shadow-lg shadow-amber-400/30"></div>
                        <div className="font-extrabold text-sm tracking-wide">AIが金額・店舗名・消費税を自動解析中...</div>
                        <div className="text-xs text-indigo-200 mt-1">手書き文字・印鑑・明細をスキャンしています</div>
                      </div>
                      <div className="absolute left-0 right-0 h-1 bg-amber-400 shadow-[0_0_15px_#f59e0b] animate-pulse z-20 top-1/2 -translate-y-1/2"></div>
                    </>
                  )}
                </div>

                {!ocrResult && !isProcessing && (
                  <button
                    id="btn-run-ocr"
                    onClick={() => {
                      if (imagePreview) {
                        executeOcr(imagePreview, selectedFile?.type || 'image/jpeg', selectedSample || undefined);
                      }
                    }}
                    className="w-full py-3.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white font-bold text-sm shadow-sm flex items-center justify-center gap-2 transition cursor-pointer"
                  >
                    <Sparkles className="w-4 h-4" />
                    🚀 AIで再解析する
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Quick Presets for Instant Testing with Handwritten Samples */}
          <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs space-y-2.5">
            <div className="flex items-center justify-between text-xs font-bold text-slate-700">
              <span className="flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                サンプルで即座にお試し（手書き領収証・請求書あり）
              </span>
              <span className="text-[10px] text-slate-400">ワンクリック</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {SAMPLE_RECEIPTS.map((sample) => {
                const isCurrent = selectedSample?.id === sample.id;
                const isHandwritten = sample.typeBadge?.includes('手書き');
                return (
                  <button
                    key={sample.id}
                    type="button"
                    onClick={() => handleSelectSample(sample)}
                    className={`p-2.5 rounded-xl text-left border transition-all cursor-pointer ${
                      isCurrent
                        ? 'bg-amber-50 border-amber-400 ring-2 ring-amber-200'
                        : isHandwritten
                        ? 'bg-amber-50/40 border-amber-200 hover:bg-amber-100/60'
                        : 'bg-slate-50 border-slate-200 hover:bg-slate-100/80 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="font-bold text-xs text-slate-900 truncate">
                        {sample.name}
                      </div>
                      {isHandwritten && (
                        <span className="text-[9px] bg-amber-200 text-amber-900 font-bold px-1.5 py-0.2 rounded shrink-0">
                          手書き
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-amber-800 font-semibold mt-0.5">
                      ¥{sample.defaultData.total.toLocaleString()} ({sample.categoryName})
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right Column: AI Extraction Details & Form Confirmation */}
        <div className="lg:col-span-7 space-y-4">
          <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <span>AI解析結果 ＆ 経費登録フォーム</span>
                  {ocrResult && (
                    <span className="bg-emerald-100 text-emerald-800 text-xs font-bold px-2.5 py-0.5 rounded-full flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      自動読取完了
                    </span>
                  )}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  AIが画像から抽出した金額・店舗名・科目を確認し、ワンクリックで帳簿に反映します。
                </p>
              </div>
            </div>

            {/* Form Fields */}
            <div className="space-y-4">
              {/* Document Type */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">書類種別</label>
                  <select value={documentType} onChange={(e) => setDocumentType(e.target.value)} className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm font-medium bg-white">
                    <option value="receipt">レシート・領収書</option>
                    <option value="invoice">請求書</option>
                    <option value="statement">利用明細・明細書</option>
                    <option value="other">その他</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">請求書番号・登録番号等</label>
                  <input value={invoiceNumber} onChange={(e) => setInvoiceNumber(e.target.value)} placeholder="自動読取" className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm font-medium" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">支払方法</label>
                  <input value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)} placeholder="現金・カード・振込など" className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm font-medium" />
                </div>
              </div>

              {ocrResult?.items && ocrResult.items.length > 0 && (
                <div className="rounded-xl border border-indigo-100 bg-indigo-50/40 p-3">
                  <div className="text-xs font-bold text-indigo-900 mb-2">AIが読み取った明細</div>
                  <div className="space-y-1 max-h-36 overflow-y-auto">
                    {ocrResult.items.map((item, index) => (
                      <div key={`${item.name}-${index}`} className="flex items-center justify-between text-xs bg-white rounded-lg px-2.5 py-1.5">
                        <span className="truncate mr-3">{item.name}{item.quantity && item.quantity > 1 ? ` × ${item.quantity}` : ''}</span>
                        <span className="font-bold whitespace-nowrap">¥{Number(item.price || 0).toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Row 1: Merchant & Date */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-bold text-slate-700 flex items-center gap-1.5">
                      <Store className="w-3.5 h-3.5 text-indigo-500" />
                      支払先・店舗名 / 発行元
                    </label>
                    {ocrResult?.merchant && (
                      <span className="text-[10px] text-emerald-600 font-bold flex items-center gap-0.5">
                        <Check className="w-3 h-3" /> AI抽出
                      </span>
                    )}
                  </div>
                  <div className="relative">
                    <input
                      type="text"
                      value={merchant}
                      onChange={(e) => setMerchant(e.target.value)}
                      placeholder="例: ヨドバシカメラ, セブン-イレブン, アトリエ工房"
                      className={`w-full px-3.5 py-2.5 rounded-xl border text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent ${
                        merchant ? 'bg-indigo-50/20 border-indigo-200 text-slate-900' : 'border-slate-200 bg-white'
                      }`}
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-bold text-slate-700 flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-slate-400" />
                      支払日・発行日
                    </label>
                    {ocrResult?.date && (
                      <span className="text-[10px] text-emerald-600 font-bold flex items-center gap-0.5">
                        <Check className="w-3 h-3" /> AI抽出
                      </span>
                    )}
                  </div>
                  <input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent font-medium"
                  />
                </div>
              </div>

              {/* Row 2: Category Selector */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-bold text-slate-700 flex items-center gap-1.5">
                    <Tag className="w-3.5 h-3.5 text-rose-500" />
                    経費カテゴリー (勘定科目)
                  </label>
                  {appliedRuleName ? (
                    <span className="text-[11px] font-semibold text-purple-700 flex items-center gap-1">
                      <Wand2 className="w-3 h-3 text-purple-600" />
                      ルール「{appliedRuleName}」適用: <strong className="font-extrabold">{category}</strong>
                    </span>
                  ) : ocrResult?.category && (
                    <span className="text-[11px] font-semibold text-indigo-600 flex items-center gap-1">
                      <Sparkles className="w-3 h-3 text-amber-500" />
                      AI自動推定: <strong className="font-extrabold">{ocrResult.category}</strong>
                    </span>
                  )}
                </div>

                {/* Visual Category Pills Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-1.5 max-h-48 overflow-y-auto p-1 bg-slate-50/70 rounded-xl border border-slate-200">
                  {ALL_EXPENSE_CATEGORIES.map((cat) => {
                    const isSelected = category === cat;
                    return (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => { setCategory(cat); setAppliedRuleName(null); }}
                        className={`p-2 rounded-lg text-left text-xs transition-all cursor-pointer flex flex-col justify-between ${
                          isSelected
                            ? 'bg-rose-50 border border-rose-400 text-rose-950 font-bold shadow-xs ring-1 ring-rose-300'
                            : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100/80'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="truncate">{cat}</span>
                          {isSelected && (
                            <span className="w-1.5 h-1.5 rounded-full bg-rose-500 shrink-0"></span>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>

                {/* Selected Category Info Banner */}
                {EXPENSE_CATEGORIES_INFO[category] && (
                  <div className="p-2.5 rounded-xl bg-rose-50/60 border border-rose-100 flex items-start gap-2 text-xs text-rose-950">
                    <Info className="w-3.5 h-3.5 text-rose-600 shrink-0 mt-0.5" />
                    <div>
                      <div className="font-bold text-rose-900">
                        【{category}】: {EXPENSE_CATEGORIES_INFO[category].description}
                      </div>
                      <div className="text-[11px] text-rose-700 mt-0.5">
                        代表例: {EXPENSE_CATEGORIES_INFO[category].examples}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Row 3: Tax Rate */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  適用消費税率
                </label>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setTaxRate(0.10)}
                    className={`flex-1 py-2 rounded-xl text-xs font-bold border transition cursor-pointer ${
                      taxRate === 0.10
                        ? 'bg-indigo-50 border-indigo-300 text-indigo-700'
                        : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    標準税率 (10%)
                  </button>
                  <button
                    type="button"
                    onClick={() => setTaxRate(0.08)}
                    className={`flex-1 py-2 rounded-xl text-xs font-bold border transition cursor-pointer ${
                      taxRate === 0.08
                        ? 'bg-indigo-50 border-indigo-300 text-indigo-700'
                        : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    軽減税率 (8% / 飲食料品等)
                  </button>
                </div>
              </div>

              {/* Row 4: Total Amount & Tax Calculation Box */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-bold text-slate-900">
                    税込支払総額 (円)
                  </label>
                  {ocrResult?.total && (
                    <span className="text-[11px] text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded font-bold border border-emerald-200 flex items-center gap-1">
                      <Sparkles className="w-3 h-3 text-emerald-600" />
                      AI読取: ¥{ocrResult.total.toLocaleString()}
                    </span>
                  )}
                </div>

                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 font-extrabold text-lg">
                    ¥
                  </span>
                  <input
                    type="number"
                    value={total || ''}
                    onChange={(e) => setTotal(Math.max(0, Number(e.target.value)))}
                    placeholder="0"
                    className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-indigo-300 text-xl font-extrabold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white shadow-xs"
                  />
                </div>

                {/* Quick Add Increment Pills */}
                <div className="flex items-center gap-1.5 pt-1 text-[11px]">
                  <span className="text-slate-400 font-medium mr-1">クイック微調整:</span>
                  {[100, 500, 1000, 5000].map((inc) => (
                    <button
                      key={inc}
                      type="button"
                      onClick={() => setTotal((prev) => prev + inc)}
                      className="px-2 py-0.5 rounded-md bg-white border border-slate-200 text-slate-600 hover:bg-slate-100 hover:text-slate-900 font-medium transition cursor-pointer"
                    >
                      +{inc.toLocaleString()}
                    </button>
                  ))}
                  {ocrResult?.total && total !== ocrResult.total && (
                    <button
                      type="button"
                      onClick={() => setTotal(ocrResult.total)}
                      className="px-2 py-0.5 rounded-md bg-emerald-50 border border-emerald-200 text-emerald-700 hover:bg-emerald-100 font-bold transition cursor-pointer ml-auto"
                    >
                      AI読取値に戻す (¥{ocrResult.total.toLocaleString()})
                    </button>
                  )}
                </div>

                {/* Automatic Split Preview */}
                <div className="grid grid-cols-2 gap-3 pt-1 text-xs">
                  <div className="p-2.5 rounded-lg bg-white border border-slate-200">
                    <span className="text-slate-500 font-medium">税抜金額 (経費計上額):</span>
                    <div className="text-sm font-bold text-slate-900 mt-0.5">
                      ¥ {previewAmount.toLocaleString()}
                    </div>
                  </div>
                  <div className="p-2.5 rounded-lg bg-white border border-slate-200">
                    <span className="text-slate-500 font-medium">消費税 ({Math.round(taxRate * 100)}%):</span>
                    <div className="text-sm font-bold text-slate-900 mt-0.5">
                      ¥ {previewTax.toLocaleString()}
                    </div>
                  </div>
                </div>
              </div>

              {/* Row 5: Description */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  摘要・取引内容
                </label>
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="例: 事務所用文房具・事務用品の購入代金"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent font-medium"
                />
              </div>

              {/* Confirm & Save Button */}
              <button
                type="button"
                id="btn-confirm-save-expense"
                onClick={handleSaveTransaction}
                disabled={total <= 0}
                className="w-full py-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-sm shadow-xs transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed hover:scale-[1.01] active:scale-[0.99]"
              >
                <CheckCircle2 className="w-4 h-4" />
                この内容で経理帳簿に反映する
              </button>
            </div>

            {/* Expandable: Raw OCR text */}
            {ocrResult?.rawText && (
              <div className="border-t border-slate-100 pt-3">
                <button
                  type="button"
                  onClick={() => setShowRawText(!showRawText)}
                  className="w-full flex items-center justify-between text-xs font-semibold text-slate-500 hover:text-slate-800 py-1 cursor-pointer"
                >
                  <span className="flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5" />
                    AIが読み取ったレシート・請求書テキスト詳細
                  </span>
                  {showRawText ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>
                {showRawText && (
                  <div className="mt-2 p-3 bg-slate-900 text-slate-200 rounded-xl text-xs font-mono whitespace-pre-wrap max-h-48 overflow-y-auto leading-relaxed">
                    {ocrResult.rawText}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Past AI-Scanned Receipts Carousel Section */}
      <PastReceiptsCarousel
        transactions={transactions}
        onSelectReceiptForForm={handleSelectReceiptForForm}
        onNavigateToLedger={onNavigateToLedger}
      />

      {/* Live Camera Modal Viewfinder */}
      <LiveCameraModal
        isOpen={isCameraModalOpen}
        onClose={() => setIsCameraModalOpen(false)}
        onCapture={handleCameraCapture}
      />
    </div>
  );
};
