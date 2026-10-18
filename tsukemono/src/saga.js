// 本編の物語（data/saga.js）を進める。章の条件を調べ、課題（対決など）の進みを数える。画面なし。
import { SAGA } from '../data/saga.js';
import { agingFactor } from './business.js';

export const newStory = () => ({ seen: [], won: [], lostPending: [], quest: null, retry: null });

export function attachSaga(g, { cfg, saga = SAGA }) {
  saga ??= SAGA;
  g.story = newStory();
  g.sagaChapters = saga;

  const met = (w) => {
    if (w.day != null && g.day() < w.day) return false;
    if (w.level != null && g.level().level < w.level) return false;
    if (w.learnedAny && !Object.values(g.recipes).some((r) => r.made > 0)) return false;
    if (w.nukaMaturity != null && g.nuka.maturity < w.nukaMaturity - 1e-9) return false;
    if (w.reformed && !((g.stats.reformed ?? 0) > 0)) return false;
    if (w.letterLearned && !Object.values(g.recipes).some((r) => r.via === 'letter')) return false;
    if (w.ordersDone != null && (g.orders?.done ?? 0) < w.ordersDone) return false;
    if (w.weightSwitched != null && (g.stats.weightSwitch ?? 0) < w.weightSwitched) return false;
    if (w.rainedDrying && !((g.stats.rainedDrying ?? 0) > 0)) return false;
    if (w.questWon && !g.story.won.includes(w.questWon)) return false;
    if (w.questLost && !g.story.lostPending.includes(w.questLost)) return false;
    return true;
  };

  const startQuest = (q, chapter) => {
    g.story.quest = { ...q, chapter, startDay: g.day(), endDay: g.day() + q.days, progress: 0, pickles: [] };
    g.events.push({ type: 'questStart', id: q.id, name: q.name, days: q.days });
  };

  /** 課題の期限切れとやり直し、次の章が始まるかを調べる。始まったら章を返す（1回に1章まで） */
  g.checkStory = () => {
    const st = g.story;
    if (st.quest && g.day() > st.quest.endDay) { // 期限切れ: 負け。少しおいて、やり直し
      const q = st.quest;
      if (saga.some((c) => c.when?.questLost === q.id)) st.lostPending.push(q.id); // 負けの章があれば、それを見てからやり直す
      st.retry = { quest: { id: q.id, name: q.name, days: q.days, kind: q.kind, need: q.need, target: q.target, retryAfter: q.retryAfter }, chapter: q.chapter, day: g.day() + (q.retryAfter ?? 7) };
      st.quest = null;
      g.events.push({ type: 'questLost', id: q.id, name: q.name });
    }
    if (!st.quest && st.retry && g.day() >= st.retry.day && !st.lostPending.includes(st.retry.quest.id)) {
      const r = st.retry;
      st.retry = null;
      startQuest(r.quest, r.chapter);
    }
    for (const ch of saga) {
      if (st.seen.includes(ch.id) && !ch.repeat) continue;
      if (ch.after && !st.seen.includes(ch.after)) continue;
      if (!met(ch.when ?? {})) continue;
      if (!st.seen.includes(ch.id)) st.seen.push(ch.id);
      if (ch.when?.questLost) st.lostPending = st.lostPending.filter((x) => x !== ch.when.questLost);
      const rw = ch.reward ?? {};
      if (rw.rep) g.reputation = Math.min(100, g.reputation + rw.rep);
      if (rw.money) { g.money += rw.money; g.stats.revenue += rw.money; }
      if (rw.xp) g.addXp(rw.xp);
      if (rw.teach) g.learn(rw.teach, 'taught'); // 秘伝の漬物を教わる（data/hiden.js）
      if (ch.quest) startQuest(ch.quest, ch.id);
      g.events.push({ type: 'saga', id: ch.id });
      return ch;
    }
    return null;
  };

  /** 売ったあと: 課題の進みを数える。達成したら true */
  g.questOnSale = (res, b) => {
    const q = g.story.quest;
    if (!q || !res.ok || res.spoiled) return false;
    const buyers = res.visitors.filter((v) => v.bought && !v.claimer);
    if (q.kind === 'greatGuests') q.progress += buyers.filter((v) => v.sat >= q.need.sat).length;
    else if (q.kind === 'agedSale') { if (buyers.length && agingFactor(cfg.pickles[b.pickle], res.taste.ratio) >= q.need.aging) q.progress = 1; }
    else if (q.kind === 'variety') {
      if (buyers.some((v) => v.sat >= q.need.sat) && !q.pickles.includes(b.pickle)) q.pickles.push(b.pickle);
      q.progress = q.pickles.length;
    }
    if (q.progress < q.target) return false;
    g.story.won.push(q.id);
    g.story.quest = null;
    g.events.push({ type: 'questWon', id: q.id, name: q.name });
    return true;
  };

  g.chapter = (id) => saga.find((c) => c.id === id);
}
