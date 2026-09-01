# AIスマート経理 — レシート/領収書/請求書/明細 AI読取版

## 対応
- Windows PCでExpress + Viteサーバーを起動
- PCブラウザ/スマートフォンのカメラで撮影
- レシート、領収書、請求書、利用明細・明細書をAI画像解析
- 店舗名・企業名・日付・税込金額・税額・税率・勘定科目・摘要・請求/登録番号・支払方法・明細を抽出
- 確認後、既存の取引登録処理にそのまま反映

## Windowsで起動
1. Node.jsをインストール
2. `npm install`
3. `.env` を作り `GEMINI_API_KEY=...` を設定
4. `npm run dev`
5. Windows PCで `http://localhost:3000` を開く

## iPhoneから使う場合
同一Wi-FiのPCへアクセスする場合は `http://<Windows-PCのIP>:3000` を利用できます。iPhoneのSafariでカメラを使うにはブラウザのSecure Context制約があるため、実運用ではHTTPS（社内LAN用証明書、Tailscale等のHTTPS経路、または公開HTTPS）を推奨します。HTTPSがない環境でも写真選択/ファイルアップロード方式を利用できます。

## AI OCR
Gemini APIキーが設定されていれば画像を直接解析します。APIキーはブラウザへ公開せず、Windows側の `server.ts` からのみ利用します。
