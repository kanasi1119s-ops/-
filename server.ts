import express from 'express';
import path from 'path';
import fs from 'fs';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, Type } from '@google/genai';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT || 3000);
const DATA_DIR = path.join(process.cwd(), 'data');
const TRANSACTIONS_FILE = path.join(DATA_DIR, 'transactions.json');

function readTransactionsFile(): any[] {
  try {
    if (!fs.existsSync(TRANSACTIONS_FILE)) return [];
    const raw = fs.readFileSync(TRANSACTIONS_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeTransactionsFile(transactions: any[]): void {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const tmp = `${TRANSACTIONS_FILE}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(transactions, null, 2), 'utf8');
  fs.renameSync(tmp, TRANSACTIONS_FILE);
}

// Body parser for JSON with support for Base64 receipt images (up to 25MB)
app.use(express.json({ limit: '25mb' }));

// Lazy Google Gen AI helper
let aiClient: GoogleGenAI | null = null;
function getGenAI(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return null;
  }
  if (!aiClient) {
    aiClient = new GoogleGenAI({
      apiKey: apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }
  return aiClient;
}

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    hasApiKey: !!process.env.GEMINI_API_KEY,
    timestamp: new Date().toISOString(),
  });
});

// Shared Windows-side transaction store. This makes the same accounting data available
// from the Windows PC and an iPhone connected to this server.
app.get('/api/transactions', (_req, res) => {
  res.json({ success: true, transactions: readTransactionsFile() });
});

app.put('/api/transactions', (req, res) => {
  if (!Array.isArray(req.body?.transactions)) {
    return res.status(400).json({ success: false, error: 'transactions配列が必要です。' });
  }
  writeTransactionsFile(req.body.transactions);
  return res.json({ success: true, count: req.body.transactions.length });
});

// AI Receipt OCR Endpoint (Handles printed receipts, handwritten receipts, handwritten invoices)
app.post('/api/receipt-ocr', async (req, res) => {
  try {
    const { imageBase64, mimeType = 'image/jpeg', ocrTextHint } = req.body;

    if (!imageBase64 && !ocrTextHint) {
      return res.status(400).json({ success: false, error: '画像またはテキストデータが必要です。' });
    }

    const ai = getGenAI();
    if (!ai || !imageBase64) {
      const text = String(ocrTextHint || '');
      const amountMatch = text.match(/(?:合計|税込合計|総額|請求金額|お支払|金額|金)[:\s]*[¥￥]?\s*([0-9,]+)/i);
      const total = amountMatch ? Number(amountMatch[1].replace(/,/g, '')) : 0;
      const taxRate = 0.10;
      const tax = total ? Math.round(total - total / (1 + taxRate)) : 0;
      return res.json({
        success: true,
        source: 'fallback_parser',
        data: {
          documentType: 'other', merchant: '書類発行元（要確認）', date: new Date().toISOString().slice(0, 10),
          total, amount: Math.max(0, total - tax), tax, taxRate, category: '消耗品費',
          description: 'OCRデータ（要確認）', invoiceNumber: '', paymentMethod: '', items: [], rawText: text,
          confidence: 0.2,
        },
      });
    }

    const cleanBase64 = String(imageBase64).replace(/^data:[^;]+;base64,/, '').trim();
    const mimeMatch = String(imageBase64).match(/^data:([^;]+);base64,/);
    let detectedMime = mimeMatch?.[1] || mimeType || 'image/jpeg';
    if (!['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'].includes(detectedMime)) detectedMime = 'image/jpeg';

    const currentYear = new Date().getFullYear();
    const prompt = `あなたは日本の経理入力専用AIです。画像を読み取り、レシート、領収書、請求書、利用明細・明細書、その他の経理書類を正確に構造化してください。

【絶対条件】
- 画像に書いてある情報だけを根拠にしてください。読めない項目は空文字または0にし、「推測」で店舗名や金額を作らないでください。
- merchant は支払先・店舗名・請求元・発行元の企業名/屋号/店舗名。宛名（「○○様」「上様」）はmerchantにしない。
- total は実際の支払総額/請求総額。預り金・釣銭・小計と混同しない。
- date は取引日・支払日・発行日。YYYY-MM-DD。和暦は西暦化。年省略時は ${currentYear} 年として処理。
- tax と amount は明記値を優先。税額が明記されない場合のみ税率から計算。
- taxRate は標準10%、軽減税率対象は8%。不明なら0.10。
- documentType は receipt / invoice / statement / other のいずれか。
- invoiceNumber は請求書番号、インボイス登録番号(Tから始まる番号)、取引番号など、明確な番号があれば抽出。
- paymentMethod は現金、クレジットカード、電子マネー、振込等が読める場合のみ。
- items は明細が読める場合に商品名・金額・数量・税率を抽出。
- category は「消耗品費, 通信費, 広告宣伝費, 接待交際費, 旅費交通費, 会議費, 新聞図書費, 支払手数料, 地代家賃, 水道光熱費, 外注工賃, 車両費, 研修費, 雑費」から最も妥当なもの。ただし画像だけでは判断できない場合は消耗品費。
- rawText は主要な読み取り文字を要約。
- confidence は0〜1。金額・店舗名・日付が明瞭なら高く、手書きや不鮮明なら低くする。
`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.7-flash',
      contents: { parts: [{ inlineData: { mimeType: detectedMime, data: cleanBase64 } }, { text: prompt }] },
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            documentType: { type: Type.STRING }, merchant: { type: Type.STRING }, date: { type: Type.STRING },
            total: { type: Type.NUMBER }, tax: { type: Type.NUMBER }, amount: { type: Type.NUMBER }, taxRate: { type: Type.NUMBER },
            category: { type: Type.STRING }, description: { type: Type.STRING }, invoiceNumber: { type: Type.STRING }, paymentMethod: { type: Type.STRING },
            confidence: { type: Type.NUMBER }, rawText: { type: Type.STRING },
            items: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { name: { type: Type.STRING }, price: { type: Type.NUMBER }, quantity: { type: Type.NUMBER }, taxRate: { type: Type.NUMBER } }, required: ['name', 'price'] } },
          },
          required: ['documentType', 'merchant', 'date', 'total', 'tax', 'amount', 'taxRate', 'category', 'description'],
        },
      },
    });

    const parsed = JSON.parse(response.text || '{}');
    const safeTotal = Math.max(0, Number(parsed.total) || 0);
    const safeTaxRate = Number(parsed.taxRate) === 0.08 ? 0.08 : 0.10;
    const safeTax = Number.isFinite(Number(parsed.tax)) && Number(parsed.tax) >= 0
      ? Math.round(Number(parsed.tax))
      : Math.round(safeTotal - safeTotal / (1 + safeTaxRate));
    // `total` is the figure printed most prominently on a receipt and is what the AI
    // reads most reliably; `amount` (税抜) is a derived breakdown that's easy for the
    // model to get slightly wrong on handwritten documents. Rather than trust a
    // model-reported `amount` outright — which could silently make amount + tax ≠ total
    // in the saved transaction — only accept it when it actually reconciles with
    // total - tax (allowing ±1 yen for rounding); otherwise derive it ourselves.
    const parsedAmount = Number(parsed.amount);
    const reconciledAmount = Math.max(0, safeTotal - safeTax);
    const safeAmount = Number.isFinite(parsedAmount) && parsedAmount >= 0 && Math.abs(parsedAmount - reconciledAmount) <= 1
      ? Math.round(parsedAmount)
      : reconciledAmount;

    return res.json({
      success: true,
      source: 'gemini_vision',
      data: {
        ...parsed,
        documentType: ['receipt', 'invoice', 'statement', 'other'].includes(parsed.documentType) ? parsed.documentType : 'other',
        merchant: typeof parsed.merchant === 'string' ? parsed.merchant.trim() : '',
        date: typeof parsed.date === 'string' ? parsed.date : new Date().toISOString().slice(0, 10),
        total: safeTotal, tax: safeTax, amount: safeAmount, taxRate: safeTaxRate,
        category: typeof parsed.category === 'string' && parsed.category ? parsed.category : '消耗品費',
        description: typeof parsed.description === 'string' ? parsed.description : '',
        invoiceNumber: typeof parsed.invoiceNumber === 'string' ? parsed.invoiceNumber : '',
        paymentMethod: typeof parsed.paymentMethod === 'string' ? parsed.paymentMethod : '',
        confidence: Math.min(1, Math.max(0, Number(parsed.confidence) || 0)),
        items: Array.isArray(parsed.items) ? parsed.items : [],
      },
    });
  } catch (error: any) {
    console.error('OCR Processing Error:', error);
    return res.status(500).json({ success: false, error: 'レシート・領収書・請求書の解析中にエラーが発生しました。', details: error?.message || String(error) });
  }
});

async function startServer() {
  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`AI Accounting Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
