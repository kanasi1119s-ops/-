// 「次にやること」の案内（画面なし。ゲームの状態を読むだけ）。
import { fermentRate } from './model.js';

/** 今の状態から、次にやると良いことを1行で返す。 */
export function nextStep(g) {
  const cfg = g.cfg;
  const items = g.barrels.map((b, i) => (b ? { i, b, t: g.tasteOf(i) } : null)).filter(Boolean);
  const ready = items.filter((x) => x.t.stage === 'ripe');
  const late = items.filter((x) => x.t.stage === 'over' || x.t.stage === 'sour');
  const soldNow = g.lastSaleTick === g.tick;
  const n = (x) => `樽${x.i + 1}`;
  const cheapest = Math.min(...Object.keys(cfg.vegetables).map((veg) => g.brewCost({ veg, saltPct: 2 })));
  const empty = g.barrels.findIndex((b) => !b);

  if (!g.isOpen() && (ready.length || late.length)) return '夜は閉店。時間を進めて朝にしよう。';
  if (g.isOpen() && !soldNow && late.length) return `${late.map(n).join('・')}は酸っぱくなりかけ。早めに売るか、捨てて仕込み直そう。`;
  if (g.isOpen() && !soldNow && ready.length) return `${ready.map(n).join('・')}が食べ頃。味見して「販売する」。`;
  if (soldNow && (ready.length || late.length)) return '同じ時間帯に店を開けられるのは1回。時間を進めよう。';
  if (empty >= 0 && g.money >= cheapest) return `樽${empty + 1}が空いている。塩分と温度を決めて仕込もう。`;
  if (empty >= 0 && !items.length) return 'お金が足りず仕込めない…「確認用の操作」から最初からやり直せます。';
  if (items.length) {
    const soon = items.map((x) => {
      const pk = cfg.pickles[x.b.pickle];
      const left = (pk.window.lo * pk.ripeAt - x.t.progress) / fermentRate(x.b, cfg);
      return { x, left };
    }).sort((a, b) => a.left - b.left)[0];
    const d = soon.left < 1 ? '1日もかからず' : `あと約${Math.ceil(soon.left)}日で`;
    return `${n(soon.x)}は${d}食べ頃。時間を進めよう。`;
  }
  return '時間を進めよう。';
}
