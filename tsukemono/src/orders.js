// 注文・依頼（ゲームの仕組みの向上 3）。依頼主と言葉は data/orders.js。
import { CLIENTS } from '../data/orders.js';
import { hash01 } from './business.js';
import { satisfaction } from './sales.js';
import { daysToRipe } from './model.js';

export const newOrders = () => ({ board: [], nextId: 1, done: 0, failed: 0 });

export function attachOrders(g, { cfg }) {
  const O = cfg.orders;
  g.orders = newOrders();
  const clients = Object.fromEntries(CLIENTS.map((c) => [c.id, c]));
  g.client = (id) => clients[id];

  /** 依頼主が頼める漬物（今の店で作れるもの） */
  const candidates = (c) => {
    const ids = Object.keys(cfg.pickles).filter((id) => g.knows(id) && g.level().level >= cfg.pickles[id].level && (!cfg.pickles[id].region || g.regions.includes(cfg.pickles[id].region)) && cfg.pickles[id].needs.every((f) => g.places.includes(f)) && cfg.pickles[id].vegetables.some((v) => g.vegAvailable(v) || cfg.vegetables[v].only));
    const days = (id) => cfg.pickles[id].realDays ?? cfg.pickles[id].ripeAt;
    if (c.pick === 'quick') return ids.filter((id) => days(id) <= 4);
    if (c.pick === 'long') return ids.filter((id) => cfg.pickles[id].aging);
    if (c.pick === 'region') return ids.filter((id) => cfg.pickles[id].region);
    if (c.pick === 'new') { const fresh = ids.filter((id) => !(g.recipes[id]?.made > 0)); return fresh.length ? fresh : ids; }
    return ids;
  };
  const pickOf = (arr, ...k) => arr[Math.floor(hash01(g.seed, g.day(), ...k) * arr.length)];
  const range = ([lo, hi], ...k) => lo + Math.floor(hash01(g.seed, g.day(), ...k) * (hi - lo + 1));

  /** 新しい依頼を作る（受けるかどうかは店主が決める）。作れなければ null */
  g.makeOrder = () => {
    const ok = CLIENTS.filter((c) => c.level <= g.level().level && !g.orders.board.some((o) => o.client === c.id) && candidates(c).length);
    if (!ok.length) return null;
    const c = pickOf(ok, 'client');
    const pickle = pickOf(candidates(c), 'pickle');
    const count = Math.min(cfg.sales.barrelCapacity, Math.max(6, Math.round(range(c.count, 'count') / 6) * 6));
    const p = cfg.pickles[pickle];
    // 期日は、ふつうに漬けて食べ頃になるまでの日数より、ゆとりをもたせる（干す日数も足す）
    const veg = p.vegetables.find((v) => g.vegAvailable(v)) ?? p.vegetables[0];
    const est = daysToRipe({ veg, pickle, saltPct: p.salt ? p.salt.lo : 3, tempC: p.temp.hi }, cfg) + (p.drying?.default ?? 0) + (p.smoking?.default ?? 0);
    const days = Math.min(O.maxDays, Math.max(range(c.days, 'days'), Math.ceil(est * O.slack) + 2));
    const o = { id: g.orders.nextId++, client: c.id, pickle, count, days, minSat: c.minSat, reward: Math.round((p.price * count * c.mult) / 100) * 100, rep: c.rep, state: 'offer', offerUntil: g.day() + O.offerDays, due: null };
    g.orders.board.push(o);
    g.events.push({ type: 'orderOffer', id: o.id, client: c.id, line: fill(c.ask, o, p) });
    return o;
  };
  const fill = (text, o, p) => text.replace('{pickle}', p.name).replace('{count}', o.count).replace('{days}', o.days);
  g.orderText = (o) => fill(clients[o.client].ask, o, cfg.pickles[o.pickle]);

  g.acceptOrder = (id) => {
    const o = g.orders.board.find((x) => x.id === id && x.state === 'offer');
    if (!o) return { ok: false, error: 'その依頼はありません' };
    if (g.orders.board.filter((x) => x.state === 'active').length >= O.maxActive) return { ok: false, error: `受けられる依頼は${O.maxActive}つまでです` };
    o.state = 'active'; o.due = g.day() + o.days;
    return { ok: true };
  };
  g.declineOrder = (id) => {
    const i = g.orders.board.findIndex((x) => x.id === id && x.state === 'offer');
    if (i < 0) return { ok: false, error: 'その依頼はありません' };
    g.orders.board.splice(i, 1);
    return { ok: true };
  };
  /** 出来の見立て（依頼主の好み、なければみんなの好みの平均） */
  g.orderSat = (o, slot) => {
    const b = g.vessel(slot);
    if (!b || b.pickle !== o.pickle) return null;
    const t = g.tasteOf(slot), c = clients[o.client];
    const judges = c.judge ? cfg.customers.filter((x) => x.id === c.judge) : cfg.customers;
    return judges.reduce((s, j) => s + satisfaction(t, o.pickle, { ...j, likes: [] }, g.season(), cfg), 0) / judges.length;
  };
  /** 樽か棚から納める */
  g.deliver = (id, slot) => {
    const o = g.orders.board.find((x) => x.id === id && x.state === 'active');
    if (!o) return { ok: false, error: '受けている依頼ではありません' };
    const b = g.vessel(slot);
    if (!b || b.pickle !== o.pickle) return { ok: false, error: `${cfg.pickles[o.pickle].name}ではありません` };
    if (g.dryingLeft(b) > 0) return { ok: false, error: 'まだ干しています' };
    if (b.portions < o.count) return { ok: false, error: `${o.count}個いります（あと${o.count - b.portions}個）` };
    const t = g.tasteOf(slot);
    if (t.spoilRisk >= O.spoilMax) return { ok: false, error: '傷みかけています。これは納められない' };
    const sat = g.orderSat(o, slot);
    if (sat < o.minSat) return { ok: false, error: `出来が足りない（${Math.round(sat)} / ${o.minSat}）。${t.stage === 'raw' ? 'まだ漬かりが浅い' : t.stage === 'ripe' ? '味を見直そう' : '漬かりすぎている'}`, sat };
    const pay = Math.round((o.reward * (1 + Math.max(0, sat - o.minSat) * O.bonusPerSat)) / 10) * 10; // 出来が良いほど、お礼に色がつく
    b.portions -= o.count;
    if (b.portions <= 0) g.setVessel(slot, null);
    g.money += pay; g.stats.revenue += pay; g.stats.sold += o.count;
    g.reputation = Math.min(100, g.reputation + o.rep);
    g.addXp(O.xp);
    g.orders.board = g.orders.board.filter((x) => x !== o);
    g.orders.done++;
    g.events.push({ type: 'orderDone', client: o.client, pickle: o.pickle, pay, line: clients[o.client].thanks });
    return { ok: true, pay, sat, emptied: !g.vessel(slot) };
  };
  /** 朝: 期日の過ぎた依頼と、受けなかった依頼を片づけ、ときどき新しい依頼が来る */
  g.ordersMorning = () => {
    for (const o of [...g.orders.board]) {
      if (o.state === 'offer' && g.day() > o.offerUntil) g.orders.board = g.orders.board.filter((x) => x !== o);
      if (o.state === 'active' && g.day() > o.due) {
        g.orders.board = g.orders.board.filter((x) => x !== o);
        g.orders.failed++;
        g.reputation = Math.max(0, g.reputation - o.rep * O.failRepMult);
        g.events.push({ type: 'orderFailed', client: o.client, pickle: o.pickle, line: clients[o.client].fail });
      }
    }
    if (g.day() >= O.firstDay && g.day() % O.every === 0 && g.orders.board.length < O.max) g.makeOrder();
  };
}
