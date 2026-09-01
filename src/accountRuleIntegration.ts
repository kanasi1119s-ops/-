import { classifyAccountSubject, ReceiptLike } from "./accountRules";

export function applyAccountRuleToReceipt<T extends ReceiptLike>(receipt: T) {
  const result = classifyAccountSubject(receipt);
  if (!result.accountSubject) return receipt;
  return {
    ...receipt,
    accountSubject: result.accountSubject,
    accountRuleId: result.rule?.id,
    accountRuleName: result.rule?.name,
    accountRuleScore: result.score,
  };
}
