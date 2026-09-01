# AIスマート経理ソフト：勘定科目自動判定

追加したファイル：
- src/accountRules.ts : ルール型・保存・判定エンジン
- src/AccountRuleSettings.tsx : ルール設定画面
- src/accountRuleIntegration.ts : OCR結果にルールを適用する関数

## OCR結果への適用例
import { applyAccountRuleToReceipt } from "./accountRuleIntegration";

const classified = applyAccountRuleToReceipt({
  store: "Amazon",
  company: "Amazon.co.jp",
  description: "事務用品",
  item: "キーボード",
  items: [{name:"キーボード"}],
  paymentMethod: "クレジットカード",
  amount: 8800
});

// classified.accountSubject を既存の取引登録処理へ渡す

## 画面の追加
import AccountRuleSettings from "./AccountRuleSettings";
<AccountRuleSettings />

条件は AND。複数ルール一致時は、優先度→条件数の順で選択します。
