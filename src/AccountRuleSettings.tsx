import React, { useMemo, useState } from "react";
import {
  AccountRule, AccountRuleCondition, DEFAULT_ACCOUNT_SUBJECTS,
  RuleField, RuleOperator, loadAccountRules, saveAccountRules
} from "./accountRules";
import { getCategoryBadgeStyle } from "./data/categories";
import {
  Wand2, Plus, Trash2, Pencil, Check, X, Info, ToggleLeft, ToggleRight, Tag
} from "lucide-react";

const FIELD_LABELS: Record<RuleField, string> = {
  store: "店舗名", company: "企業名", description: "摘要",
  item: "商品・明細", paymentMethod: "支払方法"
};
const OP_LABELS: Record<RuleOperator, string> = {
  contains: "を含む", equals: "と一致", startsWith: "で始まる"
};

export default function AccountRuleSettings() {
  const [rules, setRules] = useState<AccountRule[]>(loadAccountRules);
  const [editing, setEditing] = useState<AccountRule | null>(null);

  const sorted = useMemo(() => [...rules].sort((a, b) => b.priority - a.priority), [rules]);
  const persist = (next: AccountRule[]) => { setRules(next); saveAccountRules(next); };

  const startNew = () => {
    const now = new Date().toISOString();
    setEditing({
      id: crypto.randomUUID(), name: "", accountSubject: DEFAULT_ACCOUNT_SUBJECTS[0],
      conditions: [{ field: "store", operator: "contains", value: "" }],
      priority: 10, enabled: true, createdAt: now, updatedAt: now
    });
  };

  const saveEditing = () => {
    if (!editing) return;
    const clean = {
      ...editing,
      name: editing.name.trim() || `${editing.conditions[0]?.value || "新規"}ルール`,
      conditions: editing.conditions.filter(c => c.value.trim()),
      updatedAt: new Date().toISOString()
    };
    if (!clean.conditions.length) { alert("少なくとも1つ条件を入力してください。"); return; }
    persist([...rules.filter(r => r.id !== clean.id), clean]);
    setEditing(null);
  };

  const updateCondition = (i: number, patch: Partial<AccountRuleCondition>) => {
    if (!editing) return;
    setEditing({ ...editing, conditions: editing.conditions.map((c, n) => n === i ? { ...c, ...patch } : c) });
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2.5">
            <span className="w-9 h-9 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center border border-purple-100">
              <Wand2 className="w-5 h-5" />
            </span>
            勘定科目 自動判定ルール
          </h2>
          <p className="text-sm text-slate-600 mt-1">
            店舗名・企業名・商品明細・摘要・支払方法からキーワードで条件を作ると、<strong className="text-purple-700 font-semibold">AIレシート読取</strong>の結果にこのルールが自動で適用され、勘定科目を上書きします。
          </p>
        </div>
        <button
          onClick={startNew}
          className="shrink-0 flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold shadow-xs transition cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          新しいルール
        </button>
      </div>

      {/* Info banner */}
      <div className="p-4 rounded-2xl bg-purple-50/60 border border-purple-100 flex items-start gap-2.5 text-xs text-purple-950">
        <Info className="w-4 h-4 text-purple-600 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p>
            条件は<strong>すべて一致（AND）</strong>した場合に適用されます。複数のルールが一致した場合は、<strong>優先度が高いもの→条件数が多いもの</strong>の順で1件だけ選ばれます。
          </p>
          <p className="text-purple-800/80">
            ルールに一致しない場合は、これまで通りAIが画像から推測した勘定科目がそのまま使われます。
          </p>
        </div>
      </div>

      {/* Editing panel */}
      {editing && (
        <div className="bg-white rounded-2xl border border-purple-200 shadow-xs p-6 space-y-5">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h3 className="text-base font-bold text-slate-900">
              {rules.some(r => r.id === editing.id) ? "ルールの編集" : "新しいルールを作成"}
            </h3>
            <button onClick={() => setEditing(null)} className="text-slate-400 hover:text-slate-700 p-1 rounded-lg">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">ルール名</label>
            <input
              value={editing.name}
              onChange={e => setEditing({ ...editing, name: e.target.value })}
              placeholder="例：Amazonの事務用品"
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>

          <div className="space-y-2">
            <h4 className="text-xs font-bold text-slate-700">条件（すべて一致した場合に適用）</h4>
            {editing.conditions.map((c, i) => (
              <div key={i} className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_2fr_auto] gap-2 items-center">
                <select
                  value={c.field}
                  onChange={e => updateCondition(i, { field: e.target.value as RuleField })}
                  className="px-3 py-2 rounded-xl border border-slate-200 text-xs font-medium bg-white"
                >
                  {Object.entries(FIELD_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
                <select
                  value={c.operator}
                  onChange={e => updateCondition(i, { operator: e.target.value as RuleOperator })}
                  className="px-3 py-2 rounded-xl border border-slate-200 text-xs font-medium bg-white"
                >
                  {Object.entries(OP_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
                <input
                  value={c.value}
                  onChange={e => updateCondition(i, { value: e.target.value })}
                  placeholder="例：Amazon"
                  className="px-3 py-2 rounded-xl border border-slate-200 text-xs font-medium"
                />
                <button
                  onClick={() => setEditing({ ...editing, conditions: editing.conditions.filter((_, n) => n !== i) })}
                  className="p-2 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition justify-self-start sm:justify-self-center"
                  title="この条件を削除"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
            <button
              onClick={() => setEditing({ ...editing, conditions: [...editing.conditions, { field: "store", operator: "contains", value: "" }] })}
              className="text-xs font-bold text-purple-600 hover:text-purple-700 flex items-center gap-1 pt-1"
            >
              <Plus className="w-3.5 h-3.5" />
              条件を追加
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-[1fr_140px] gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1">
                <Tag className="w-3.5 h-3.5 text-slate-400" />
                勘定科目
              </label>
              <select
                value={editing.accountSubject}
                onChange={e => setEditing({ ...editing, accountSubject: e.target.value })}
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-xs font-medium bg-white"
              >
                {DEFAULT_ACCOUNT_SUBJECTS.map(x => <option key={x} value={x}>{x}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">優先度</label>
              <input
                type="number"
                value={editing.priority}
                onChange={e => setEditing({ ...editing, priority: Number(e.target.value) || 0 })}
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-xs font-medium"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <button
              onClick={() => setEditing(null)}
              className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 text-xs font-bold transition"
            >
              キャンセル
            </button>
            <button
              onClick={saveEditing}
              className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold transition flex items-center gap-1 shadow-xs"
            >
              <Check className="w-3.5 h-3.5" />
              ルールを保存
            </button>
          </div>
        </div>
      )}

      {/* Rule list */}
      {sorted.length === 0 && !editing ? (
        <div className="bg-white rounded-2xl p-10 border border-slate-200 text-center shadow-xs">
          <div className="w-16 h-16 rounded-2xl bg-purple-50 text-purple-600 mx-auto flex items-center justify-center mb-4">
            <Wand2 className="w-8 h-8" />
          </div>
          <h3 className="text-lg font-bold text-slate-900 mb-1">ルールはまだありません</h3>
          <p className="text-sm text-slate-500 max-w-md mx-auto mb-6">
            ルールを作成すると、次回以降のAIレシート読取で条件に一致した領収書の勘定科目を自動で割り当てられます。
          </p>
          <button
            onClick={startNew}
            className="px-4 py-2.5 rounded-xl bg-purple-600 text-white text-sm font-semibold shadow-xs hover:bg-purple-700 transition"
          >
            + 最初のルールを作成する
          </button>
        </div>
      ) : (
        <div className="space-y-2.5">
          {sorted.map((r) => {
            const style = getCategoryBadgeStyle(r.accountSubject, 'expense');
            return (
              <div
                key={r.id}
                className={`bg-white rounded-2xl border border-slate-200 shadow-xs p-4 flex items-start justify-between gap-4 transition ${r.enabled ? '' : 'opacity-50'}`}
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <strong className="text-sm font-bold text-slate-900">{r.name}</strong>
                    <span className="text-slate-300">→</span>
                    <span className={`px-2 py-0.5 rounded text-[11px] font-bold border ${style.badgeBg} ${style.badgeText}`}>
                      {r.accountSubject}
                    </span>
                    <span className="text-[11px] text-slate-400 font-medium">優先度 {r.priority}</span>
                  </div>
                  <div className="mt-1.5 text-xs text-slate-500">
                    {r.conditions.map((c, i) => (
                      <span key={i}>
                        {i > 0 && <span className="mx-1 text-slate-300 font-bold">＋</span>}
                        {FIELD_LABELS[c.field]}が「<span className="text-slate-700 font-semibold">{c.value}</span>」{OP_LABELS[c.operator]}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => persist(rules.map(x => x.id === r.id ? { ...x, enabled: !x.enabled } : x))}
                    className={`p-1.5 rounded-lg transition ${r.enabled ? 'text-emerald-600 hover:bg-emerald-50' : 'text-slate-300 hover:bg-slate-50'}`}
                    title={r.enabled ? '無効化する' : '有効化する'}
                  >
                    {r.enabled ? <ToggleRight className="w-5 h-5" /> : <ToggleLeft className="w-5 h-5" />}
                  </button>
                  <button
                    onClick={() => setEditing(r)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition"
                    title="編集"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => { if (confirm(`「${r.name}」を削除しますか？`)) persist(rules.filter(x => x.id !== r.id)); }}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition"
                    title="削除"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
