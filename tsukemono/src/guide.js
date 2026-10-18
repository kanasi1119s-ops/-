// 「次にやること」の案内（画面なし。ゲームの状態を読むだけ）。
import { fermentRate } from './model.js';

/** 今の状態から、次にやると良いことを1行で返す。ui.display = 店先に出している樽（画面の状態。なければ null）。 */
export function nextStep(g, ui = {}) {
  const cfg = g.cfg;
  const items = g.barrels.map((b, i) => (b ? { i, b, t: g.tasteOf(i) } : null)).filter(Boolean);
  const ready = items.filter((x) => x.t.stage === 'ripe');
  const late = items.filter((x) => x.t.stage === 'over' || x.t.stage === 'sour');
  const soldNow = g.lastSaleTick === g.tick;
  const n = (x) => `樽${x.i + 1}`;
  const cheapest = Math.min(...Object.keys(cfg.vegetables).map((veg) => g.brewCost({ veg, saltPct: 2 })));
  const empty = g.barrels.findIndex((b) => !b);

  const shown = ui.display != null && g.barrels[ui.display];
  if (!g.isOpen() && (ready.length || late.length)) return shown ? '夜は閉店。朝になれば店先の樽で店が開く（「とばす」で朝へ）。' : '夜は閉店。食べ頃の樽を「店先に出す」と、朝から売れる。';
  if (g.isOpen() && !soldNow && late.length) return `${late.map(n).join('・')}は酸っぱくなりかけ。早めに店先に出すか、捨てて仕込み直そう。`;
  if (g.isOpen() && !soldNow && ready.length) return `${ready.map(n).join('・')}が食べ頃。味見して「店先に出す」。`;
  if (soldNow && (ready.length || late.length)) return shown ? 'この時間帯のお客はもう来た。次の時間帯を待とう（「とばす」で先へ）。' : '食べ頃の樽を「店先に出す」と、次の時間帯からお客に売れる。';
  const filmy = items.filter((x) => !cfg.pickles[x.b.pickle].usesNukaBed && x.t.filmVisible && x.b.lastCareTick !== g.tick);
  if (filmy.length) return `${filmy.map(n).join('・')}に白い膜が出ている。「手入れ」で取ろう。`;
  const crush = items.filter((x) => cfg.pickles[x.b.pickle].weight && x.t.waterUp >= 1 && (x.b.weights?.at(-1)?.w ?? 1) > 1);
  if (crush.length) return `${crush.map(n).join('・')}の水が上がった。重石を軽くしないと野菜がつぶれる（「樽」から）。`;
  const work = items.filter((x) => x.t.work?.some((w) => w.state === 'now' || (w.state === 'skipped' && x.b.work?.[w.id] == null && g.fermentDays(x.b) <= cfg.pickles[x.b.pickle].work.find((y) => y.id === w.id).window[1] + cfg.workGrace)));
  if (work.length) { const x = work[0], w = cfg.pickles[x.b.pickle].work.find((y) => x.t.work.find((z) => z.id === y.id && z.state !== 'done' && z.state !== 'wait')); return `${n(x)}は「${w.label}」の頃。「樽」からやろう。`; }
  const usesBed = items.some((x) => cfg.pickles[x.b.pickle].usesNukaBed) || g.nuka.maturity > 0;
  if (usesBed && g.nuka.lastStirDay !== g.day()) return 'ぬか床を今日はまだかき混ぜていない。「かき混ぜる」で床が育つ。';
  if (usesBed && (g.nuka.rot ?? 0) >= 0.3) return 'ぬか床が傷みかけている。捨て漬けを替えて、ぬかと塩を足そう。';
  const ume = g.barrels.findIndex((b) => b && cfg.pickles[b.pickle].umezu && (b.exposed ?? 0) > cfg.umezu.safe);
  if (ume >= 0) return `樽${ume + 1}の梅が梅酢から出ている。「樽」から重石を直して沈めないとカビやすい。`;
  if (usesBed && g.nuka.sour >= 0.5) return 'ぬか床が酸っぱくなっている。塩・からし・卵の殻で和らぐ。';
  if (usesBed && (g.nuka.water ?? 0) >= 0.5) return 'ぬか床が水っぽい。ぬかと塩を足すと床がしまる。';
  if (usesBed && g.daysSinceSute() > cfg.nuka.suteEveryDays) return '捨て漬けを替えてから日がたった。キャベツの芯やにんじんの皮に替えると床が傷みにくい。';
  if (g.claim) return '難癖のお客が待っている…。どう対応するか決めよう（時間が進むと、聞こえないふりをしたことになる）。';
  const q = g.story?.quest;
  if (q && q.endDay - g.day() <= 3) return `課題「${q.name}」の期限まであと${Math.max(0, q.endDay - g.day())}日（${q.progress} / ${q.target}）。`;
  const fresh = Object.entries(g.recipes ?? {}).find(([id, r]) => r.via !== 'start' && r.made === 0 && g.canBrew(id).ok && !g.barrels.some((x) => x?.pickle === id));
  if (empty >= 0 && fresh && g.money >= cheapest) return `ひらめいた「${cfg.pickles[fresh[0]].name}」をまだ試していない。樽${empty + 1}で仕込んでみよう。`;
  if (empty >= 0 && g.money >= cheapest) return `樽${empty + 1}が空いている。塩分と置き場所を決めて仕込もう。`;
  if (empty >= 0 && !items.length) return 'お金が足りず仕込めない…「確認用の操作」から最初からやり直せます。';
  // 手元に余裕があれば投資をすすめる（仕込み代を残しておく）
  const buffer = cheapest * g.barrels.length * 2;
  const offers = [];
  const nb = g.nextBarrelCost();
  if (nb != null && g.barrels.length < g.barrelMax()) offers.push({ cost: nb, text: '樽を増やす' });
  for (const [id, pl] of Object.entries(cfg.facilities)) if (pl.cost > 0 && pl.level <= g.level().level && !g.places.includes(id) && !pl.claimer) offers.push({ cost: pl.cost, text: `${pl.name}を買う` });
  // 難癖のお客が何度も来ているなら、備えをすすめる
  if ((g.claimer?.visits ?? 0) >= 2) {
    const d = Object.entries(cfg.facilities).find(([id, pl]) => pl.claimer && pl.level <= g.level().level && !g.places.includes(id) && g.money - pl.cost >= buffer);
    if (d) return `難癖のお客がよく来る。「店」の欄で${d[1].name}を買うと備えになる。`;
  }
  const afford = offers.filter((o) => g.money - o.cost >= buffer).sort((a, b) => a.cost - b.cost)[0];
  if (afford) return `お金に余裕がある。「店」の欄で${afford.text}と、売り上げや季節の幅が広がる。`;
  if (items.length) {
    const soon = items.map((x) => {
      const pk = cfg.pickles[x.b.pickle];
      const left = (pk.window.lo * pk.ripeAt - x.t.progress) / fermentRate(x.b, cfg);
      return { x, left };
    }).sort((a, b) => a.left - b.left)[0];
    const d = soon.left < 1 ? '1日もかからず' : `あと約${Math.ceil(soon.left)}日で`;
    return `${n(soon.x)}は${d}食べ頃。待とう（急ぐなら「休む」）。`;
  }
  return '時間が進むのを待とう（「とばす」で先へ）。';
}
