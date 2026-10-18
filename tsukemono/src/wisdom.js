// おばあちゃんの知恵袋（段階G）。梅子さんとの絆で知恵と作り方を教わり、場面に合った知恵を思い出させてくれる。画面なし。
import { GRANNY, WISDOM, TEACH } from '../data/wisdom.js';

export function attachWisdom(g, { cfg, wisdom = WISDOM, teach = TEACH, granny = GRANNY }) {
  g.wisdom = { joined: false, known: [], told: {} }; // known = 教わった知恵の id、told = 場面ごとに最後に思い出させた日
  g.grannyDef = granny;
  g.granny = () => g.regulars.find((r) => r.granny) ?? null;
  g.knowsWisdom = (id) => g.wisdom.known.includes(id);
  g.wisdomList = () => wisdom.filter((w) => g.knowsWisdom(w.id));

  /** 梅子さんが常連になる（はじめの数日のうちに。常連がいっぱいでも来る） */
  g.grannyJoin = () => {
    if (g.wisdom.joined || g.day() < granny.joinDay) return false;
    g.wisdom.joined = true;
    const id = g.nextRegularId++;
    g.regulars.push({ id, type: granny.type, look: granny.look, visits: 1, misses: 0, since: g.day(), name: granny.name, age: granny.age, bond: 0, chapters: [], granny: true });
    learnUpTo(0);
    g.events.push({ type: 'grannyJoin', name: granny.name });
    return true;
  };

  /** 絆 bond までの知恵と作り方を教わる。新しく教わったものを返す */
  const learnUpTo = (bond) => {
    const got = [];
    for (const w of wisdom) if (w.bond <= bond && !g.knowsWisdom(w.id)) { g.wisdom.known.push(w.id); got.push(w); g.events.push({ type: 'wisdom', id: w.id, text: w.text, lore: !!w.lore }); }
    for (const t of teach) if (t.bond <= bond && g.learn(t.pickle, 'taught', t.line)) got.push(t);
    return got;
  };
  /** 梅子さんをとても満足させたとき（business.js の deepenBond から呼ぶ） */
  g.grannyBond = (r) => learnUpTo(r.bond);

  /** いまの場面（知恵が役に立つところ） */
  g.wisdomScenes = () => {
    const n = g.nuka, sc = [];
    const bed = g.barrels.some((b) => b && cfg.pickles[b.pickle].usesNukaBed) || n.maturity > 0;
    if (bed && n.sour >= 0.5) sc.push('nukaSour');
    if (bed && (n.water ?? 0) >= 0.5) sc.push('nukaWater');
    if (bed && ((n.rot ?? 0) >= 0.2 || g.daysSinceSute() > cfg.nuka.suteEveryDays)) sc.push('nukaRot');
    if (bed && n.maturity >= 0.5 && (n.umami ?? 0) < 0.05) sc.push('nukaUmami');
    if (g.barrels.some((b) => b && cfg.pickles[b.pickle].umezu && (b.exposed ?? 0) > cfg.umezu.safe)) sc.push('umeMold');
    if (g.barrels.some((b) => b && cfg.pickles[b.pickle].film && !cfg.pickles[b.pickle].usesNukaBed && (b.film ?? 0) >= cfg.care.filmVisible)) sc.push('film');
    if (bed && n.lastStirDay !== g.day() && g.day() > 1) sc.push('nukaStir'); // 困りごとが先、毎日のことは最後
    return sc;
  };
  /** 場面に合った、教わった知恵（なければ null） */
  g.wisdomFor = (scenes = g.wisdomScenes()) => {
    for (const s of scenes) { const w = wisdom.find((x) => x.scene === s && g.knowsWisdom(x.id)); if (w) return w; }
    return null;
  };
  /** 朝: 場面に合った知恵を、1日1回だけ思い出させてくれる */
  g.wisdomMorning = () => {
    g.grannyJoin();
    const w = g.wisdomFor();
    if (w && g.wisdom.told[w.scene] !== g.day()) { g.wisdom.told[w.scene] = g.day(); g.events.push({ type: 'wisdomHint', id: w.id, text: w.text }); }
  };
}
