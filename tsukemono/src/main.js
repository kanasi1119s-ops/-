// 画面（DOM）とゲームをつなぐ。計算は model.js / sales.js / game.js、見た目は render.js / world.js。
import { CONFIG } from './config.js';
import { createGame, bookTotal } from './game.js';
import { simulate, daysToRipe, ripeRangeDays, applyCare, affinityOf } from './model.js';
import { SceneRenderer } from './render.js';
import { World } from './world.js';
import { integerScale, loadImages } from './pixel.js';
import { nextStep } from './guide.js';
import { SCENE, IMAGES } from '../assets/scene.js';
import { SEASONS, TIMES, WEATHERS } from '../assets/themes.js';

const $ = (id) => document.getElementById(id);
const yen = (n) => `¥${Math.round(n).toLocaleString('ja-JP')}`;
const trim = (n, d = 2) => String(+n.toFixed(d));
const C = CONFIG;

const game = createGame({ seed: (Date.now() & 0xffffffff) >>> 0 });

// ---- セーブ（ブラウザに自動保存。使えない環境では保存しないだけで遊べる）
const SAVE_KEY = 'tsukemono.save.v1';
function loadSave() {
  try {
    const s = JSON.parse(localStorage.getItem(SAVE_KEY) ?? 'null');
    if (s && game.restore(s.game)) return Array.isArray(s.log) ? s.log.slice(0, 8) : [];
  } catch { /* 読めなければ最初から */ }
  return null;
}
function save() {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify({ game: game.snapshot(), log: ui.log })); } catch { /* 保存できなくても遊べる */ }
}
const savedLog = loadSave();
const canvas = $('screen');
await loadImages(IMAGES);
const renderer = new SceneRenderer(canvas);
const world = new World();

const ui = {
  slot: 0,
  recipe: { pickle: 'hakusaizuke', veg: 'hakusai', saltPct: 3, place: 'doma', additives: [] },
  practice: true, // 練習モードは既定でON（切ると自分で探る遊びになる）
  override: { manual: false, season: 'spring', time: 'morning', weather: 'sunny' },
  frozen: false,
  busy: false, // 時間経過・販売の最中
  shownMoney: game.money,
  log: savedLog ?? [],
  lastTaste: null,
  message: savedLog ? '前回の続きから。' : '樽を選んで、塩分と置き場所を決めて仕込もう。',
};

// ------------------------------------------------------------ 表示用の状態
function view() {
  const o = ui.override;
  const v = o.manual
    ? { season: o.season, time: o.time, weather: o.weather }
    : { season: game.season(), time: game.timeOfDay(), weather: game.weather };
  return {
    ...v,
    barrels: game.barrels.map((b, i) => ({
      filled: !!b, veg: b?.veg, top: b ? C.pickles[b.pickle].top : undefined, film: b ? (C.pickles[b.pickle].usesNukaBed ? Math.max(b.film ?? 0, game.nuka.film) : (b.film ?? 0)) : 0, selected: i === ui.slot,
      label: b ? `${trim(game.barrelAge(b), 1)}日` : null,
    })),
    actors: world.actors,
  };
}

// ------------------------------------------------------------ 画面の作り直し
function setMessage(t) { ui.message = t; $('message').textContent = t; }
function renderGuide() { $('guide').textContent = ui.busy ? '' : `次にやること: ${nextStep(game)}`; }

function renderHud() {
  const st = game.stats;
  $('hud').innerHTML = `
    <span><span class="k">日</span><b>${game.day()}日目</b></span>
    <span><span class="k">季節</span><b>${C.season[game.season()].name}</b></span>
    <span><span class="k">時間</span><b>${C.timeName[game.timeOfDay()]}</b></span>
    <span><span class="k">天気</span><b>${C.weatherName[game.weather]}</b></span>
    <span><span class="k">外気温</span><b>${game.ambientTemp()}℃</b></span>
    <span><span class="k">評判</span><b>${Math.round(game.reputation)}</b></span>
    <span><span class="k">所持金</span><b>${yen(ui.shownMoney)}</b></span>
    <span><span class="k">累計利益</span><b class="${st.revenue - st.cost >= 0 ? 'pos' : 'neg'}">${yen(st.revenue - st.cost)}</b></span>`;
  $('clock').innerHTML = [
    ['+1区切り', 1, '朝→昼→夕→夜'], ['+半日', 2, ''], ['+1日', 4, ''], ['+3日', 12, ''],
  ].map(([l, n, t]) => `<button class="sub" data-adv="${n}" ${ui.busy ? 'disabled' : ''} title="${t}">${l}</button>`).join('')
    + `<span class="hint" style="align-self:center">← 時間を進めて熟成させる（朝=仕込み／昼=熟成／夕=販売／夜=閉店）</span>`;
}

function renderBarrels() {
  $('barrels').innerHTML = game.barrels.map((b, i) => {
    const sel = i === ui.slot ? 'sel' : '';
    if (!b) return `<div class="barrel ${sel}" data-slot="${i}"><div class="t">樽${i + 1}：空</div><div class="m">仕込みができます</div></div>`;
    const p = C.pickles[b.pickle], v = C.vegetables[b.veg];
    const filmV = p.usesNukaBed ? game.nuka.film : (b.film ?? 0);
    const film = p.film ? filmWord(filmV) : '';
    const cared = b.lastCareTick === game.tick;
    return `<div class="barrel ${sel}" data-slot="${i}">
      <div class="t">樽${i + 1}：${v.name}の${p.name}</div>
      <div class="m">塩${trim(b.saltPct, 1)}% ・ ${b.tempC}℃ ・ ${trim(game.barrelAge(b))}日経過 ・ 残り${b.portions}個${film ? ` ・ <span class="${filmV >= C.care.filmVisible ? 'warn' : ''}">白い膜${p.usesNukaBed ? '（ぬか床）' : ''}: ${film}</span>` : ''}</div>
      <div class="btns">${p.film && !p.usesNukaBed ? `
        <button class="sub" data-act="care" data-slot="${i}" ${ui.busy || cared ? 'disabled' : ''} title="白い膜を取る">${cared ? '手入れ済み' : '手入れ'}</button>` : ''}
        <button class="sub" data-act="taste" data-slot="${i}" ${b.tastedTick === game.tick ? 'disabled' : ''}>${b.tastedTick === game.tick ? '味見済み' : '味見'}</button>
        <button data-act="sell" data-slot="${i}" ${ui.busy || !game.isOpen() || game.lastSaleTick === game.tick ? 'disabled' : ''} title="${!game.isOpen() ? '夜は閉店' : game.lastSaleTick === game.tick ? 'この時間帯はもう売りました' : ''}">販売する</button>
        <button class="danger" data-act="discard" data-slot="${i}" ${ui.busy ? 'disabled' : ''}>捨てる</button>
      </div></div>`;
  }).join('');
}

const WORDS = {
  acid: [[20, 'ほぼ無し'], [40, '控えめ'], [60, 'ほどよい'], [75, '強め'], [101, '酸っぱい']],
  salt: [[25, '薄い'], [45, '控えめ'], [65, 'ほどよい'], [85, '濃いめ'], [999, 'しょっぱい']],
  texture: [[35, 'くたくた'], [55, 'やわらか'], [75, 'しっかり'], [101, 'シャキシャキ']],
  complexity: [[25, '単調'], [50, '素朴'], [75, '奥行きあり'], [101, '深い']],
  spoil: [[10, '安全'], [30, 'やや不安'], [60, '危ない'], [101, '傷んでる?']],
};
const word = (k, v) => WORDS[k].find(([lim]) => v < lim)[1];
function bars(t, { numbers = false } = {}) {
  const row = (label, k, v, col) => `<div class="bar"><span>${label}</span><i><s style="width:${Math.min(100, v)}%;background:${col}"></s></i><span>${numbers ? Math.round(v) + ' ' : ''}${word(k, v)}</span></div>`;
  return row('酸味', 'acid', t.acid, '#c9962a') + row('塩味', 'salt', t.saltiness, '#2d4b7c')
    + row('食感', 'texture', t.texture, '#4f8a3a') + row('風味の深さ', 'complexity', t.complexity, '#8a4b9a')
    + row('傷みリスク', 'spoil', t.spoilRisk, '#c63d2f');
}
const filmWord = (f) => (f < 0.15 ? 'なし' : f < C.care.filmVisible ? 'うっすら' : f < 0.7 ? '出ている' : '一面');
function renderNuka() {
  const n = game.nuka, c = C.nuka;
  const stirred = n.lastStirTick === game.tick, today = n.lastStirDay === game.day();
  const bar = (label, v, col, word) => `<div class="bar"><span>${label}</span><i><s style="width:${Math.min(100, v * 100)}%;background:${col}"></s></i><span>${word}</span></div>`;
  $('nuka').innerHTML = `
    <div class="m">塩分 <b>${trim(n.salt, 1)}%</b> ・ 店の中（${game.ambientTemp()}℃）${today ? ' ・ 今日はかき混ぜた' : ' ・ <span class="warn">今日はまだかき混ぜていない</span>'}</div>
    ${bar('酸味', n.sour, '#c9962a', n.sour < 0.25 ? 'ちょうどいい' : n.sour < 0.5 ? 'やや酸っぱい' : n.sour < 0.8 ? '酸っぱい' : 'かなり酸っぱい')}
    ${bar('白い膜', n.film, '#9aa', filmWord(n.film))}
    ${bar('熟成度', n.maturity, '#8a4b9a', n.maturity < 0.3 ? '若い床' : n.maturity < 0.7 ? '育ってきた' : n.maturity < 1 ? 'いい床' : '最高の床')}
    <div class="btns" style="margin-top:6px">
      <button class="sub" id="stir" ${ui.busy || stirred ? 'disabled' : ''}>${stirred ? 'かき混ぜた' : 'かき混ぜる'}</button>
      <button class="sub" id="saltNuka" ${ui.busy || n.salt >= c.maxSalt || game.money < c.addSaltCost ? 'disabled' : ''}>塩を足す（${yen(c.addSaltCost)}）</button>
    </div>
    <div class="hint">毎日かき混ぜると床が育ち、ぬか漬けの風味が深くなる。放っておくと酸っぱくなり、白い膜が張る。26℃以上は特に早い。</div>`;
}
function renderTaste() {
  const el = $('taste');
  const slot = ui.lastTaste;
  if (slot == null || !game.barrels[slot]?.tastedTaste) { el.innerHTML = '<div class="hint">「味見」を押すと、その樽の今の味がわかります（同じ樽の同じ時点では1回まで）。</div>'; return; }
  const b = game.barrels[slot], t = b.tastedTaste;
  const when = b.tastedTick === game.tick ? '（今の時点は味見済み。時間が進むとまた味見できます）' : `（${trim((game.tick - b.tastedTick) / C.calendar.ticksPerDay)}日前の味見）`;
  el.innerHTML = `<div><b>樽${slot + 1}の味見</b> <span class="stage-tag ${t.stage}">${t.stageLabel}</span> <span class="hint">${when}</span></div>${bars(t)}${t.filmVisible ? '<div class="hint warn">白い膜のにおいがする。手入れすると良くなる。</div>' : ''}`;
}

/** 仕込みに使う条件（ぬか漬けはぬか床の塩分）。 */
const effRecipe = () => {
  const r = { ...ui.recipe, tempC: game.placeTemp(ui.recipe.place) };
  return C.pickles[r.pickle].usesNukaBed ? { ...r, saltPct: game.nuka.salt } : r;
};
const brewCostOf = (r) => game.brewCost({ ...r, saltPct: C.pickles[r.pickle].usesNukaBed ? 0 : r.saltPct });
/** 調味の相性は、その漬物にその調味を入れて売ったことがあるときだけ見せる。 */
const affKnown = (pickle, id) => Object.keys(game.book).some((k) => { const [pk, , ...ad] = k.split(':'); return pk === pickle && ad.includes(id); });
const affMark = (pickle, id) => {
  if (!affKnown(pickle, id)) return '<em class="aff">?</em>';
  const a = affinityOf(pickle, id, C);
  return `<em class="aff ${a}">${a === 'good' ? '◎' : a === 'bad' ? '✕' : '△'}</em>`;
};
const affHint = (pickle, id) => (affKnown(pickle, id) ? '' : 'まだ相性がわからない');
function renderBrew() {
  const r = effRecipe(), p = C.pickles[r.pickle];
  const vegs = Object.entries(C.vegetables);
  const cost = brewCostOf(r);
  const free = game.barrels[ui.slot] == null;
  let practice = '';
  if (ui.practice) {
    const days = daysToRipe(r), range = ripeRangeDays(r);
    let t = simulate({ ...r, quality: game.vegQuality(r.veg), days });
    if (p.usesNukaBed) t = applyCare(t, { film: game.nuka.film, bed: { sour: game.nuka.sour, maturity: game.nuka.maturity } });
    practice = `<div style="margin-top:8px;padding:8px;background:#f6f0df;border-radius:4px">
      <div><b>練習モード（予測）</b> 食べ頃は <b>${trim(days, 1)}日</b> 後（${trim(range.from, 1)}〜${trim(range.to, 1)}日）、${trim(range.sourFrom, 1)}日を過ぎると酸っぱすぎ</div>
      ${bars(t, { numbers: true })}</div>`;
  }
  $('brew').innerHTML = `
    <div class="row"><label class="n">漬物</label><div class="seg">${Object.entries(C.pickles).map(([id, x]) => `<label><input type="radio" name="pickle" value="${id}" ${r.pickle === id ? 'checked' : ''}><span>${x.name}</span></label>`).join('')}</div></div>
    <div class="row"><label class="n">野菜</label><div class="seg">${vegs.filter(([id]) => p.vegetables.includes(id)).map(([id, x]) => `<label><input type="radio" name="veg" value="${id}" ${r.veg === id ? 'checked' : ''}><span>${x.name}${game.inSeason(id) ? '<em class="shun">旬</em>' : ''} ${yen(game.vegCost(id))}</span></label>`).join('')}</div></div>
    <div class="row"><label class="n">塩分</label><input id="salt" type="range" min="1" max="15" step="0.5" value="${r.saltPct}" ${p.usesNukaBed ? 'disabled' : ''}><output id="saltV">${trim(r.saltPct, 1)}%</output></div>${p.usesNukaBed ? '<div class="hint">ぬか漬けの塩分はぬか床の塩分で決まる（下の「ぬか床」で塩を足せる）。</div>' : ''}
    <div class="row"><label class="n">調味</label><div class="seg">${Object.entries(C.additives).map(([id, x]) => `<label title="${affHint(r.pickle, id)}"><input type="checkbox" name="additive" value="${id}" ${r.additives.includes(id) ? 'checked' : ''} ${!r.additives.includes(id) && r.additives.length >= C.additiveMax ? 'disabled' : ''}><span>${x.name}${affMark(r.pickle, id)} ${yen(x.cost)}</span></label>`).join('')}</div></div>
    <div class="hint">調味は${C.additiveMax}つまで。漬物との相性は、売ってみるとわかる（◎合う・△ふつう・✕合わない）。</div>
    <div class="row"><label class="n">置き場所</label><div class="seg">${Object.entries(C.places).map(([id, x]) => { const own = game.places.includes(id); return `<label title="${own ? '' : '「店」の欄で買うと使える'}"><input type="radio" name="place" value="${id}" ${ui.recipe.place === id ? 'checked' : ''} ${own ? '' : 'disabled'}><span>${x.name} ${own ? `${game.placeTemp(id)}℃` : '未購入'}</span></label>`; }).join('')}</div></div>
    <div class="hint">${p.name}の目安：塩${p.saltHint}。外気温は今 ${game.ambientTemp()}℃（屋外は外気温+${C.places.outdoor.offset}℃、土間は${C.places.doma.offset}℃）。旬の野菜は安くて質が良い。</div>
    <div class="row" style="margin-top:10px"><button class="big" id="brewBtn" ${ui.busy || !free ? 'disabled' : ''}>樽${ui.slot + 1}に仕込む（${yen(cost)}）</button>
      <span class="hint">${free ? '' : 'この樽は使用中です'}</span></div>
    <label class="hint"><input type="checkbox" id="practice" ${ui.practice ? 'checked' : ''}> 練習モード：仕込む前に予測を表示する</label>${practice}`;
}

function renderShop() {
  const rep = Math.round(game.reputation), next = game.nextBarrelCost();
  const buys = Object.entries(C.places).filter(([, x]) => x.cost > 0).map(([id, x]) => game.places.includes(id)
    ? `<span class="hint">${x.name}（${x.fixed}℃）：購入済み</span>`
    : `<button class="sub" data-buy="${id}" ${ui.busy || game.money < x.cost ? 'disabled' : ''}>${x.name}を買う（${yen(x.cost)}・いつでも${x.fixed}℃）</button>`);
  buys.push(next == null ? `<span class="hint">樽はこれ以上置けない（${game.barrels.length}個）</span>`
    : `<button class="sub" data-buy="barrel" ${ui.busy || game.money < next ? 'disabled' : ''}>樽を増やす（${yen(next)}・今${game.barrels.length}個）</button>`);
  $('shop').innerHTML = `
    <div class="row"><label class="n">評判</label><div class="repbar"><i style="width:${rep}%"></i></div><b style="margin-left:6px">${rep}</b></div>
    <div class="hint">満足したお客が多いほど評判が上がり、評判が高いほど客が来る。傷んだものを出すと大きく下がる。</div>
    <div class="row" style="margin-top:6px"><label class="n">常連</label><span>${game.regulars.length ? game.regulars.map((r) => `${C.customers.find((c) => c.id === r.type).name}（${r.visits}回）`).join('・') : '<span class="hint">まだいない</span>'}</span></div>
    <div class="hint">とても満足したお客はときどき常連になり、評判に関係なくまた来て少し多く払う。がっかりさせ続けると離れる。</div>
    <div class="row" style="flex-wrap:wrap;gap:6px;margin-top:6px">${buys.join('')}</div>`;
}

function renderBook() {
  const entries = Object.entries(game.book).sort((a, b) => b[1].best - a[1].best);
  const nameOf = (k) => { const [pk, veg, ...ad] = k.split(':'); return `${C.vegetables[veg].name}の${C.pickles[pk].name}${ad.length ? `＋${ad.map((a) => C.additives[a].name).join('・')}` : ''}`; };
  $('book').innerHTML = `<div>見つけた組み合わせ <b>${entries.length}</b> / ${bookTotal(C)}</div>
    <div class="hint">漬物・野菜・調味の組み合わせを売ると載る。数字はその組み合わせのお客の満足度（いちばん良かった回）。</div>
    ${entries.length ? `<table>${entries.slice(0, 12).map(([k, e]) => `<tr><td>${nameOf(k)}</td><td class="r">${Math.round(e.best)}</td></tr>`).join('')}</table>${entries.length > 12 ? `<div class="hint">ほか${entries.length - 12}件</div>` : ''}` : ''}`;
}

function renderCustomers() {
  const s = game.season(), shift = C.season[s].prefShift;
  const note = shift.salt < 0 ? '夏はみんなあっさり寄り' : shift.salt > 0 ? '冬はみんなしょっぱめ寄り' : '';
  $('customers').innerHTML = '<div class="hint" style="margin-bottom:4px">お客はランダムに来て、それぞれ次のどれかの好みを持っています。</div>'
    + C.customers.map((c) => `<div class="cust"><b>${c.name}</b><span class="hint">${c.hint}</span></div>`).join('')
    + `<div class="hint" style="margin-top:6px">${note}${note ? '。' : ''}雨・雪の日は客が減ります。</div>`;
}

function renderLog() {
  if (!ui.log.length) return;
  $('log').innerHTML = ui.log.map((s) => `
    <div style="margin-bottom:10px"><b>${s.day}日目 ${s.time}</b> ・ ${s.weather} ・ ${s.what}
    <table><tr><th>お客の好み</th><th>一言</th><th class="r">満足度</th><th class="r">支払</th></tr>
    ${s.rows.map((r) => `<tr><td>${r.name}</td><td>${r.line}</td><td class="r">${r.sat == null ? '-' : Math.round(r.sat)}</td><td class="r">${r.price ? yen(r.price) : '—'}</td></tr>`).join('')}
    </table>
    <div>売上 <b class="pos">${yen(s.revenue)}</b> ${s.batch ? `／ この樽の収支 <b class="${s.batch.profit >= 0 ? 'pos' : 'neg'}">${s.batch.profit >= 0 ? '+' : ''}${yen(s.batch.profit)}</b>（仕入れ ${yen(s.batch.cost)}）` : ''}</div></div>`).join('');
}

function renderDebug() {
  const o = ui.override;
  const sel = (id, list, names, v) => `<select id="${id}">${list.map((k) => `<option value="${k}" ${k === v ? 'selected' : ''}>${names[k]}</option>`).join('')}</select>`;
  $('debug').innerHTML = `
    <div class="row"><label><input type="checkbox" id="manual" ${o.manual ? 'checked' : ''}> 見た目を手動で固定する</label></div>
    <div class="row">季節 ${sel('dSeason', SEASONS, Object.fromEntries(SEASONS.map((s) => [s, C.season[s].name])), o.season)}
      時間 ${sel('dTime', TIMES, C.timeName, o.time)} 天気 ${sel('dWeather', WEATHERS, C.weatherName, o.weather)}</div>
    <div class="row"><button class="sub" id="ambientVisit">通りがかりの客を呼ぶ</button>
      速度 <select id="speed"><option value="1">×1</option><option value="2">×2</option><option value="4">×4</option></select>
      <label><input type="checkbox" id="freeze" ${ui.frozen ? 'checked' : ''}> 動きを止める</label></div>
    <div class="row"><button class="danger" id="reset">最初からやり直す</button><span class="hint">自動で保存しています（このブラウザの中だけ）</span></div>
    <div class="hint">見た目の固定は遊びに影響しません（天気・季節の数値は実際の進行どおり）。</div>`;
}

function renderAll() { renderGuide(); renderHud(); renderBarrels(); renderNuka(); renderTaste(); renderBrew(); renderShop(); renderBook(); renderCustomers(); renderLog(); setMessage(ui.message); save(); }

// ------------------------------------------------------------ 操作
const clampSlotRecipe = () => { // 漬物に合わない野菜なら入れ替える
  const p = C.pickles[ui.recipe.pickle];
  if (!p.vegetables.includes(ui.recipe.veg)) ui.recipe.veg = p.vegetables[0];
};

async function advance(ticks) {
  ui.busy = true; renderHud(); renderBarrels(); renderBrew();
  for (let i = 0; i < ticks; i++) {
    game.advance(1);
    renderHud();
    await world.wait(ticks > 1 ? 160 : 0);
  }
  ui.busy = false;
  setMessage(`${game.day()}日目 ${C.timeName[game.timeOfDay()]}。${game.isOpen() ? '' : '夜は閉店です。'}`);
  renderAll();
}

async function brew() {
  const slot = ui.slot;
  const r = game.brew(slot, ui.recipe);
  if (!r.ok) { setMessage(r.error); return; }
  ui.shownMoney = game.money;
  setMessage(`樽${slot + 1}に仕込んだ（${yen(r.cost)}）`);
  ui.busy = true; renderAll();
  await world.brewScene(slot);
  ui.busy = false; renderAll();
}

async function care(slot) {
  const r = game.care(slot);
  if (!r.ok) { setMessage(r.error); return; }
  setMessage(`樽${slot + 1}の白い膜を取って手入れした。`);
  ui.busy = true; renderAll();
  await world.careScene();
  ui.busy = false; renderAll();
}
async function stir() {
  const r = game.stirNuka();
  if (!r.ok) { setMessage(r.error); return; }
  setMessage(game.nuka.maturity >= 1 ? 'ぬか床をかき混ぜた。最高の床だ。' : 'ぬか床をかき混ぜた。');
  ui.busy = true; renderAll();
  await world.careScene();
  ui.busy = false; renderAll();
}

const repNote = (r) => { const d = Math.round(r.after) - Math.round(r.before); return d ? ` ・ 評判 ${d > 0 ? '+' : ''}${d}` : ''; };
async function sell(slot) {
  const res = game.sell(slot);
  if (!res.ok) { setMessage(res.error); return; }
  ui.busy = true; renderAll();
  if (!res.visitors.length) {
    setMessage(game.weather === 'sunny' ? '今日は誰も来なかった…' : `${C.weatherName[game.weather]}の日は客足が遠のく…誰も来なかった。`);
    ui.busy = false; renderAll(); return;
  }
  setMessage(`${res.visitors.length}人のお客が来た。`);
  await world.saleScene(res.visitors, res.season, () => {});
  ui.shownMoney = game.money;
  ui.log.unshift({
    day: game.day(), time: C.timeName[res.time], weather: C.weatherName[res.weather], what: (res.spoiled ? '傷んでいた！' : `${res.sold}個売れた`) + repNote(res.reputation),
    rows: res.visitors.map((v) => ({ name: (v.regular ? (v.regular.joined ? '★新しい常連・' : v.regular.left ? '常連（離れた）・' : `常連${v.regular.visits}回目・`) : '') + v.customer.name, line: v.reaction.line, sat: v.soldOut || res.spoiled ? null : v.sat, price: v.price })),
    revenue: res.revenue, batch: res.batch.closed ? res.batch : null,
  });
  ui.log.length = Math.min(ui.log.length, 8);
  ui.busy = false;
  const found = res.discovery?.isNew ? `図鑑に「${C.pickles[res.batch.pickle].name}」の新しい組み合わせが載った！ ` : '';
  setMessage(found + (res.spoiled ? '傷んだ樽を出してしまった…樽は空になった。'
    : res.batch.closed ? `樽が空になった。この樽の収支：${res.batch.profit >= 0 ? '+' : ''}${yen(res.batch.profit)}`
      : `売上 ${yen(res.revenue)}。`));
  renderAll();
}

document.addEventListener('click', (e) => {
  const t = e.target.closest('button, .barrel');
  if (!t) return;
  if (t.dataset.adv) { if (!ui.busy) advance(+t.dataset.adv); return; }
  if (t.id === 'brewBtn') { brew(); return; }
  if (t.dataset.buy && !ui.busy) {
    const id = t.dataset.buy, r = id === 'barrel' ? game.buyBarrel() : game.buyPlace(id);
    if (r.ok) { ui.shownMoney = game.money; if (id === 'barrel') ui.slot = game.barrels.length - 1; else ui.recipe.place = id; }
    setMessage(r.ok ? (id === 'barrel' ? `樽を増やした（${yen(r.cost)}）。` : `${C.places[id].name}を買った（${yen(r.cost)}）。`) : r.error);
    renderAll(); return;
  }
  if (t.id === 'stir' && !ui.busy) { stir(); return; }
  if (t.id === 'saltNuka' && !ui.busy) { const r = game.saltNuka(); setMessage(r.ok ? 'ぬか床に塩を足した。酸味が和らいだ。' : r.error); ui.shownMoney = game.money; renderAll(); return; }
  if (t.id === 'reset') {
    if (!ui.busy && confirm('最初からやり直しますか？（今の店の状態は消えます）')) {
      try { localStorage.removeItem(SAVE_KEY); } catch { /* 消せなくても読み直す */ }
      location.reload();
    }
    return;
  }
  if (t.id === 'ambientVisit') { if (!world.busy) world.ambientVisit(view().season); return; }
  const act = t.dataset.act;
  if (act) {
    const slot = +t.dataset.slot;
    if (act === 'taste') { game.tasteTest(slot); ui.lastTaste = slot; ui.slot = slot; renderBarrels(); renderTaste(); renderBrew(); }
    if (act === 'sell' && !ui.busy) sell(slot);
    if (act === 'care' && !ui.busy) care(slot);
    if (act === 'discard') { game.discard(slot); setMessage(`樽${slot + 1}を空にした。`); renderAll(); }
    return;
  }
  if (t.dataset.slot != null) { ui.slot = +t.dataset.slot; renderBarrels(); renderBrew(); }
});

document.addEventListener('input', (e) => {
  const t = e.target, r = ui.recipe;
  if (t.name === 'pickle') {
    r.pickle = t.value; clampSlotRecipe();
    r.saltPct = { asazuke: 2.5, takuan: 5 }[r.pickle] ?? 3;
    renderBrew();
  } else if (t.name === 'veg') { r.veg = t.value; renderBrew(); }
  else if (t.id === 'salt') { r.saltPct = +t.value; $('saltV').textContent = `${trim(r.saltPct, 1)}%`; if (ui.practice) renderBrewKeepFocus('salt'); else $('brewBtn').textContent = `樽${ui.slot + 1}に仕込む（${yen(brewCostOf(effRecipe()))}）`; }
  else if (t.name === 'place') { r.place = t.value; renderBrew(); }
  else if (t.name === 'additive') { r.additives = t.checked ? [...new Set([...r.additives, t.value])].slice(0, C.additiveMax) : r.additives.filter((a) => a !== t.value); renderBrew(); }
  else if (t.id === 'practice') { ui.practice = t.checked; renderBrew(); }
  else if (t.id === 'manual') { ui.override.manual = t.checked; }
  else if (t.id === 'dSeason') ui.override.season = t.value;
  else if (t.id === 'dTime') ui.override.time = t.value;
  else if (t.id === 'dWeather') ui.override.weather = t.value;
  else if (t.id === 'speed') world.speed = +t.value;
  else if (t.id === 'freeze') ui.frozen = t.checked;
});
function renderBrewKeepFocus(id) { renderBrew(); const el = $(id); el.focus(); }

// ------------------------------------------------------------ 描画ループ
function fit() {
  const w = $('stageWrap').clientWidth - 6;
  // ふだんは整数倍（ドットの大きさがそろう）。画面より狭いスマホでは幅に合わせて縮める（ぼかさない）
  const s = w >= SCENE.w ? integerScale(w, 99999, SCENE.w, SCENE.h) : w / SCENE.w;
  canvas.style.width = `${Math.floor(SCENE.w * s)}px`; canvas.style.height = `${Math.floor(SCENE.h * s)}px`;
}
window.addEventListener('resize', fit);

let last = performance.now(), frozenAt = 0, frozenTotal = 0;
function frame(now) {
  const dt = Math.min(100, now - last); last = now;
  world.update(dt);
  if (ui.frozen && !frozenAt) frozenAt = now;
  if (!ui.frozen && frozenAt) { frozenTotal += now - frozenAt; frozenAt = 0; }
  renderer.draw(view(), (ui.frozen ? frozenAt : now) - frozenTotal);
  requestAnimationFrame(frame);
}

// 画面を開いて少し経つと、通りがかりの客が買っていく（デモ。ゲームの状態は変えない）
setTimeout(function loop() {
  if (!world.busy && !ui.busy && !ui.frozen && view().time !== 'night') world.ambientVisit(view().season);
  setTimeout(loop, 14000);
}, 2500);

renderDebug(); renderAll(); fit();
requestAnimationFrame(frame);
window.__game = { game, ui, world, renderer, advance, brew, sell, renderAll }; // 動作確認用（scripts/e2e.js）
