import { ALL_EXPENSE_CATEGORIES } from "./data/categories";

export type RuleField =
  | "store"
  | "company"
  | "description"
  | "item"
  | "paymentMethod";

export type RuleOperator = "contains" | "equals" | "startsWith";

export interface AccountRuleCondition {
  field: RuleField;
  operator: RuleOperator;
  value: string;
}

export interface AccountRule {
  id: string;
  name: string;
  conditions: AccountRuleCondition[];
  accountSubject: string;
  priority: number;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ReceiptLike {
  store?: string;
  company?: string;
  description?: string;
  item?: string;
  items?: Array<{ name?: string }>;
  paymentMethod?: string;
  amount?: number;
}

const STORAGE_KEY = "ai-smart-accounting-account-rules-v1";

// Sourced directly from ALL_EXPENSE_CATEGORIES (src/data/categories.ts) so that a rule's
// accountSubject is always a valid ExpenseCategory the rest of the app understands.
// (Previously this list used different labels than the app's actual expense categories
// — e.g. "事務用品費" / "外注費" / "租税公課" — so a matched rule could set a category
// that no other screen recognized, silently falling back to "消耗品費" everywhere else.)
export const DEFAULT_ACCOUNT_SUBJECTS: string[] = ALL_EXPENSE_CATEGORIES;

export function loadAccountRules(): AccountRule[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveAccountRules(rules: AccountRule[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(rules));
}

function getFieldText(receipt: ReceiptLike, field: RuleField): string {
  switch (field) {
    case "store": return receipt.store ?? "";
    case "company": return receipt.company ?? "";
    case "description": return receipt.description ?? "";
    case "item":
      return [receipt.item ?? "", ...(receipt.items ?? []).map(x => x.name ?? "")].join(" ");
    case "paymentMethod": return receipt.paymentMethod ?? "";
  }
}

function matches(condition: AccountRuleCondition, receipt: ReceiptLike): boolean {
  const actual = getFieldText(receipt, condition.field).trim().toLowerCase();
  const expected = condition.value.trim().toLowerCase();
  if (!expected) return false;
  if (condition.operator === "equals") return actual === expected;
  if (condition.operator === "startsWith") return actual.startsWith(expected);
  return actual.includes(expected);
}

export function classifyAccountSubject(
  receipt: ReceiptLike,
  rules: AccountRule[] = loadAccountRules()
): { accountSubject: string | null; rule: AccountRule | null; score: number } {
  const candidates = rules
    .filter(r => r.enabled && r.conditions.length > 0)
    .filter(r => r.conditions.every(c => matches(c, receipt)))
    .sort((a, b) => b.priority - a.priority || b.conditions.length - a.conditions.length);

  const winner = candidates[0];
  if (!winner) return { accountSubject: null, rule: null, score: 0 };

  const score = Math.min(99, 60 + winner.conditions.length * 10 + Math.min(20, Math.max(0, winner.priority)));
  return { accountSubject: winner.accountSubject, rule: winner, score };
}
