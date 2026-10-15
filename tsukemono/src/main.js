// 画面（DOM）とゲームをつなぐ。計算は model.js / sales.js / game.js、見た目は render.js / world.js、音は audio.js。
// 画面の作り: 上に帳場（日付・お金・評判）、真ん中に店先、下に会話窓とコマンド。操作は「窓」を開いて行う。
import { CONFIG } from './config.js';
import { createGame, bookTotal } from './game.js';
import { simulate, daysToRipe, ripeRangeDays, applyCare, affinityOf } from './model.js';
import { SceneRenderer } from './render.js';
import { World } from './world.js';
import { integerScale, loadImages } from './pixel.js';
import { nextStep } from './guide.js';
import { Sound } from './audio.js';
import { SCENE, IMAGES } from '../assets/scene.js';
import { SEASONS, TIMES, WEATHERS } from '../assets/themes.js';

const $ = (id) => document.getElementById(id);
const yen = (n) => `${Math.round(n).toLocaleString('ja-JP')}円`;
const trim = (n, d = 2) => String(+n.toFixed(d));
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const C = CONFIG;

const game = createGame({ seed: (Date.now() & 0xffffffff) >>> 0 });
const sound = new Sound();

// ------------------------------------------------------------ セーブ（このブラウザの中だけ。使えなくても遊べる）
const SAVE_KEY = 'tsukemono.save.v1';
const SET_KEY = 'tsukemono.settings.v1';
const store = {
  get(k) { try { return JSON.parse(localStorage.getItem(k) ?? 'null'); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* 保存できなくても遊べる */ } },
  del(k) { try { localStorage.removeItem(k); } catch { /* 同上 */ } },
};
const saved = store.get(SAVE_KEY);
const hasSave = !!(saved && game.restore(saved.game));
const settings = { bgm: 0.6, se: 0.8, practice: true, speed: 1, ...(store.get(SET_KEY) ?? {}) };
sound.setVolumes(settings.bgm, settings.se);

const newToday = () => ({ day: game.day(), revenue: 0, sold: 0, visitors: 0, cost: 0, repStart: game.reputation, joined: 0, found: 0 });
const ui = {
  slot: 0,
  recipe: { pickle: 'asazuke', veg: 'kyuri', saltPct: 2.5, place: 'doma', additives: [] },
  override: { manual: false, season: 'spring', time: 'morning', weather: 'sunny' },
  busy: false,
  started: false,
  shownMoney: game.money,
  log: hasSave && Array.isArray(saved.log) ? saved.log.slice(0, 12) : [],
  today: hasSave && saved.today?.day === game.day() ? saved.today : newToday(),
  win: null, // 開いている窓 { kind, ... }
  message: '',
  confirm: null, // 二度押しで確かめる操作の名前
};
function save() { store.set(SAVE_KEY, { game: game.snapshot(), log: ui.log, today: ui.today }); }
function saveSettings() { store.set(SET_KEY, settings); }

// ------------------------------------------------------------ 店先の画面
const canvas = $('screen');
await loadImages(IMAGES);
const renderer = new SceneRenderer(canvas);
const world = new World();
world.speed = settings.speed;

function view() {
  const o = ui.override;
  const v = o.manual ? { season: o.season, time: o.time, weather: o.weather } : { season: game.season(), time: game.timeOfDay(), weather: game.weather };
  return {
    ...v,
    barrels: game.barrels.map((b) => ({
      filled: !!b, veg: b?.veg, top: b ? C.pickles[b.pickle].top : undefined,
      film: b ? (C.pickles[b.pickle].usesNukaBed ? Math.max(b.film ?? 0, game.nuka.film) : (b.film ?? 0)) : 0,
      selected: false, label: null, // 札は画面の上に重ねて出す（下の renderChips）
    })),
    actors: world.actors,
  };
}
const slotPos = (i) => SCENE.slots[i] ?? SCENE.extraSlots[i - SCENE.slots.length];

// ------------------------------------------------------------ 言葉と小物
const WORDS = {
  acid: [[20, 'ほぼ無し'], [40, '控えめ'], [60, 'ほどよい'], [75, '強め'], [101, '酸っぱい']],
  salt: [[25, '薄い'], [45, '控えめ'], [65, 'ほどよい'], [85, '濃いめ'], [999, 'しょっぱい']],
  texture: [[35, 'くたくた'], [55, 'やわらか'], [75, 'しっかり'], [101, 'シャキシャキ']],
  complexity: [[25, '単調'], [50, '素朴'], [75, '奥行きあり'], [101, '深い']],
  spoil: [[10, '安全'], [30, 'やや不安'], [60, '危ない'], [101, '傷んでる?']],
};
const word = (k, v) => WORDS[k].find(([lim]) => v < lim)[1];
function bars(t, { numbers = false } = {}) {
  const row = (label, k, v, col) => `<div class="bar"><span>${label}</span><i><s style="width:${Math.min(100, Math.max(0, v))}%;background:${col}"></s></i><span>${numbers ? Math.round(v) + ' ' : ''}${word(k, v)}</span></div>`;
  return `<div class="bars">${row('酸味', 'acid', t.acid, '#d29a2c')}${row('塩味', 'salt', t.saltiness, '#2f4f7f')}${row('食感', 'texture', t.texture, '#4f7f3c')}${row('風味の深さ', 'complexity', t.complexity, '#6b4a7a')}${row('傷みリスク', 'spoil', t.spoilRisk, '#b5381f')}</div>`;
}
const filmWord = (f) => (f < 0.15 ? 'なし' : f < C.care.filmVisible ? 'うっすら' : f < 0.7 ? '出ている' : '一面');
const stars = (rep) => { const n = Math.round(rep / 20); return `<span class="stars" title="評判 ${Math.round(rep)}">${'●'.repeat(n)}<s>${'●'.repeat(5 - n)}</s></span>`; };
const WEATHER_ICON = { sunny: '晴', rain: '雨', snow: '雪' };
const TIME_ICON = { morning: '朝', noon: '昼', evening: '夕', night: '夜' };
/** 漢数字（日付に使う）。 */
function kanjiNum(n) {
  const D = '〇一二三四五六七八九';
  if (n < 10) return D[n];
  let s = '';
  for (const [v, k] of [[1000, '千'], [100, '百'], [10, '十']]) {
    const q = Math.floor(n / v);
    if (q) { s += (q > 1 ? D[q] : '') + k; n %= v; }
  }
  return s + (n ? D[n] : '');
}
const barrelName = (b) => `${C.vegetables[b.veg].name}の${C.pickles[b.pickle].name}`;
const stageOfSlot = (i) => (game.barrels[i] ? game.tasteOf(i).stage : null);
const canSellNow = () => game.isOpen() && game.lastSaleTick !== game.tick;
const filmOf = (b) => (C.pickles[b.pickle].usesNukaBed ? game.nuka.film : (b.film ?? 0));
const needsCare = (b) => C.pickles[b.pickle].film && !C.pickles[b.pickle].usesNukaBed && filmOf(b) >= C.care.filmVisible;

// ------------------------------------------------------------ 会話窓
// 文字は少しずつ出る（押すと全部出る）。下の行に「次にやること」の案内
let typer = null, finishTyping = () => {};
function say(text, who = null) {
  ui.message = text;
  clearInterval(typer);
  const el = $('msgText');
  const head = who ? `<span class="who">${esc(who)}</span>` : '';
  const full = [...text];
  let n = 0;
  const draw = () => {
    const done = n >= full.length;
    const hint = done && ui.started && !ui.busy ? nextStep(game) : '';
    el.innerHTML = `${head}${esc(full.slice(0, n).join(''))}${hint ? `<br><span class="hint">▶ ${esc(hint)}</span>` : ''}`;
  };
  finishTyping = () => { clearInterval(typer); n = full.length; draw(); };
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) { finishTyping(); return; }
  typer = setInterval(() => { n += 1; if (n >= full.length) finishTyping(); else draw(); }, 30);
  draw();
}
$('message').addEventListener('click', () => finishTyping());

// ------------------------------------------------------------ 帳場（上）
function renderHud() {
  const s = C.season[game.season()];
  $('hud').innerHTML = `
    <span class="day"><span class="season">${s.name}</span>　${kanjiNum(game.day())}日目</span>
    <span class="tw"><b>${TIME_ICON[game.timeOfDay()]}</b><b>${WEATHER_ICON[game.weather]}</b>${game.ambientTemp()}℃</span>
    <span class="grow"></span>
    <span><span class="k">評判</span>${stars(game.reputation)}</span>
    <span class="money">${Math.round(ui.shownMoney).toLocaleString('ja-JP')}<small>円</small></span>`;
}

// ------------------------------------------------------------ 樽の札（店先の画面の上）
function renderChips() {
  $('chips').innerHTML = game.barrels.map((b, i) => {
    const s = slotPos(i);
    if (!s) return '';
    const pos = `left:${(s.cx / SCENE.w) * 100}%;top:${(SCENE.labelY / SCENE.h) * 100}%`;
    const sel = i === ui.slot ? ' sel' : '';
    if (!b) return `<button class="chip empty${sel}" style="${pos}" data-chip="${i}" aria-label="樽${i + 1}（空）">＋<span class="long"> 空き樽</span></button>`;
    const st = stageOfSlot(i);
    const cls = needsCare(b) ? ' warn' : st === 'ripe' ? ' ripe' : '';
    const mark = needsCare(b) ? '!' : { raw: `${Math.floor(game.barrelAge(b))}日`, ripe: '◎', over: '△', sour: '✕' }[st];
    return `<button class="chip${cls}${sel}" style="${pos}" data-chip="${i}" aria-label="樽${i + 1} ${esc(barrelName(b))}">${mark}<span class="long"> ${C.pickles[b.pickle].name}</span></button>`;
  }).join('');
}
function floatText(text, x, y, cls = '') {
  const el = document.createElement('div');
  el.className = `float ${cls}`;
  el.textContent = text;
  el.style.left = `${(x / SCENE.w) * 100}%`; el.style.top = `${(y / SCENE.h) * 100}%`;
  $('floats').appendChild(el);
  setTimeout(() => el.remove(), 1500);
}

// ------------------------------------------------------------ コマンド（下）
function renderCommands() {
  const anyRipe = game.barrels.some((b, i) => b && ['ripe', 'over'].includes(stageOfSlot(i)));
  const anyCare = game.barrels.some((b) => b && needsCare(b));
  const bedUsed = game.barrels.some((b) => b && C.pickles[b.pickle].usesNukaBed) || game.nuka.maturity > 0;
  const nukaTodo = bedUsed && game.nuka.lastStirDay !== game.day();
  const empty = game.barrels.some((b) => !b);
  const nextT = { morning: '昼へ', noon: '夕方へ', evening: '夜へ', night: '翌朝へ' }[game.timeOfDay()];
  const dis = ui.busy ? 'disabled' : '';
  const cmd = (id, label, sub, dot = '') => `<button class="cmd" data-cmd="${id}" ${dis}>${label}${sub ? `<small>${sub}</small>` : ''}${dot ? `<span class="dot">${dot}</span>` : ''}</button>`;
  $('commands').innerHTML = [
    cmd('brew', '仕込む', '樽に漬ける', empty ? '空' : ''),
    cmd('sell', '売る', game.isOpen() ? (game.lastSaleTick === game.tick ? '今は済み' : '店を開ける') : '夜は閉店', anyRipe && canSellNow() ? '◎' : ''),
    cmd('barrels', '樽', '味見など', anyCare ? '!' : ''),
    cmd('nuka', 'ぬか床', 'かき混ぜる', nukaTodo ? '!' : ''),
    cmd('shop', '店', '投資・常連'),
    cmd('book', '帳面', '記録・図鑑'),
    cmd('rest', '休む', '日を進める'),
    cmd('settings', '設定', '音・遊び方'),
    `<button class="cmd next" data-cmd="next" ${dis}>次へ ▶<small>${nextT}</small></button>`,
  ].join('');
}

// ------------------------------------------------------------ 窓
function openWin(kind, opts = {}) { ui.win = { kind, ...opts }; ui.confirm = null; sound.se('open'); renderWin(); $('modal').hidden = false; }
function closeWin() {
  if (!ui.win) return;
  const after = ui.win.onClose;
  ui.win = null; $('modal').hidden = true; sound.se('close');
  after?.();
  renderAll();
}
$('winClose').addEventListener('click', closeWin);
$('modal').addEventListener('click', (e) => { if (e.target === $('modal') && ui.win?.kind !== 'dayend') closeWin(); });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && ui.win && ui.win.kind !== 'dayend') closeWin(); });

const WINS = {};
function renderWin() {
  if (!ui.win) return;
  const w = WINS[ui.win.kind];
  const { title, body } = w(ui.win);
  $('winTitle').textContent = title;
  const scroll = $('winBody').scrollTop;
  $('winBody').innerHTML = body;
  $('winBody').scrollTop = scroll;
}

// 樽（1つずつ見る）
WINS.barrel = ({ slot }) => {
  const b = game.barrels[slot];
  const nav = game.barrels.length > 1 ? `<div class="row">${game.barrels.map((x, i) => `<button class="tile${i === slot ? ' on' : ''}" style="flex:1;text-align:center" data-goto="${i}">樽${i + 1}${x ? '' : '（空）'}</button>`).join('')}</div>` : '';
  if (!b) {
    return { title: `樽${slot + 1}（空き樽）`, body: `${nav}<p>この樽は空いています。</p><div class="row"><button class="btn main" data-act="openBrew" data-slot="${slot}">ここに仕込む</button></div>` };
  }
  const p = C.pickles[b.pickle];
  const t = game.tasteOf(slot);
  const tasted = b.tastedTick === game.tick;
  const cared = b.lastCareTick === game.tick;
  const fv = filmOf(b);
  const adds = (b.additives ?? []).map((a) => C.additives[a].name).join('・');
  const tasteBox = b.tastedTaste
    ? `<div class="panel"><div>味見の結果 <span class="stage-tag ${b.tastedTaste.stage}">${b.tastedTaste.stageLabel}</span> <span class="hint">${tasted ? '（今）' : `（${trim((game.tick - b.tastedTick) / C.calendar.ticksPerDay, 1)}日前）`}</span></div>${bars(b.tastedTaste)}${b.tastedTaste.filmVisible ? '<div class="warn">白い膜のにおいがする。手入れすると良くなる。</div>' : ''}</div>`
    : '<div class="hint">「味見」で今の味がわかります（同じ樽は時間が進むまで1回）。</div>';
  const sellNote = !game.isOpen() ? '夜は閉店' : game.lastSaleTick === game.tick ? 'この時間はもう店を開けた' : '';
  const disc = ui.confirm === `discard${slot}`;
  return {
    title: `樽${slot + 1}　${barrelName(b)}`,
    body: `${nav}
    <div class="panel">
      <div><span class="stage-tag ${t.stage}">${t.stageLabel}</span>　${trim(game.barrelAge(b), 1)}日目 ・ 残り${b.portions}個</div>
      <div class="hint">塩${trim(b.saltPct, 1)}% ・ ${b.place ? C.places[b.place].name : ''} ${b.tempC}℃${adds ? ` ・ ${adds}` : ''}${p.film ? ` ・ 白い膜: <span class="${fv >= C.care.filmVisible ? 'warn' : ''}">${filmWord(fv)}${p.usesNukaBed ? '（ぬか床）' : ''}</span>` : ''}</div>
    </div>
    ${tasteBox}
    <div class="row">
      <button class="btn" data-act="taste" data-slot="${slot}" ${tasted ? 'disabled' : ''}>${tasted ? '味見した' : '味見'}</button>
      ${p.film && !p.usesNukaBed ? `<button class="btn" data-act="care" data-slot="${slot}" ${cared || fv < 0.05 ? 'disabled' : ''}>${cared ? '手入れした' : '手入れ（膜を取る）'}</button>` : ''}
      ${p.usesNukaBed ? '<button class="btn" data-act="openNuka">ぬか床を見る</button>' : ''}
      <button class="btn main" data-act="sellSlot" data-slot="${slot}" ${sellNote ? 'disabled' : ''}>店を開けて売る</button>
      <button class="btn ghost" data-act="discard" data-slot="${slot}">${disc ? '本当に捨てる' : '捨てる'}</button>
    </div>
    ${sellNote ? `<div class="hint">${sellNote}。「次へ」で時間を進めよう。</div>` : ''}`,
  };
};

// 樽の一覧
WINS.barrels = () => ({
  title: '樽',
  body: `<div class="list">${game.barrels.map((b, i) => {
    if (!b) return `<button class="item" data-goto="${i}"><span class="grow">樽${i + 1}　<span class="hint">空き樽</span></span><span>＋</span></button>`;
    const t = game.tasteOf(i);
    return `<button class="item${t.stage === 'ripe' ? ' ok' : ''}" data-goto="${i}"><span class="grow">樽${i + 1}　${barrelName(b)}<br><span class="hint">${trim(game.barrelAge(b), 1)}日目 ・ 残り${b.portions}個${needsCare(b) ? ' ・ <span class="warn">白い膜！</span>' : ''}</span></span><span class="stage-tag ${t.stage}">${t.stageLabel}</span></button>`;
  }).join('')}</div>`,
});

// 仕込み
const effRecipe = () => {
  const r = { ...ui.recipe, tempC: game.placeTemp(ui.recipe.place) };
  return C.pickles[r.pickle].usesNukaBed ? { ...r, saltPct: game.nuka.salt } : r;
};
const brewCostOf = (r) => game.brewCost({ ...r, saltPct: C.pickles[r.pickle].usesNukaBed ? 0 : r.saltPct });
const affKnown = (pickle, id) => Object.keys(game.book).some((k) => { const [pk, , ...ad] = k.split(':'); return pk === pickle && ad.includes(id); });
const affMark = (pickle, id) => (!affKnown(pickle, id) ? '？' : { good: '◎', bad: '✕', neutral: '△' }[affinityOf(pickle, id, C)]);
const SALT_DEFAULT = { asazuke: 2.5, takuan: 5 };
WINS.brew = () => {
  const r = effRecipe(), p = C.pickles[r.pickle];
  const empties = game.barrels.map((b, i) => (b ? null : i)).filter((i) => i != null);
  if (!empties.length) return { title: '仕込む', body: '<p>空いている樽がありません。売り切るか、「樽」から捨てると空きます。「店」で樽を増やすこともできます。</p>' };
  if (game.barrels[ui.slot]) ui.slot = empties[0];
  const cost = brewCostOf(r);
  const pickles = Object.entries(C.pickles).map(([id, x]) => `<button class="tile${r.pickle === id ? ' on' : ''}" data-pickle="${id}"><b>${x.name}</b><span>${x.ripeAt >= 10 ? '長く漬ける' : x.ripeAt >= 3 ? '数日〜' : '早い'} ・ ${yen(x.price)}${x.portions ? `×${x.portions}` : ''}</span></button>`).join('');
  const vegs = p.vegetables.map((id) => `<button class="tile${r.veg === id ? ' on' : ''}" data-veg="${id}">${game.inSeason(id) ? '<i class="tag">旬</i>' : ''}<b>${C.vegetables[id].name}</b><span>${yen(game.vegCost(id))}</span></button>`).join('');
  const adds = Object.entries(C.additives).map(([id, x]) => { const on = r.additives.includes(id); return `<button class="tile${on ? ' on' : ''}" data-add="${id}" ${!on && r.additives.length >= C.additiveMax ? 'disabled' : ''}><b>${x.name} ${affMark(r.pickle, id)}</b><span>${yen(x.cost)}</span></button>`; }).join('');
  const places = Object.entries(C.places).map(([id, x]) => { const own = game.places.includes(id); return `<button class="tile${r.place === id ? ' on' : ''}" data-place="${id}" ${own ? '' : 'disabled'}><b>${x.name}</b><span>${own ? `${game.placeTemp(id)}℃` : '未購入（店で買う）'}</span></button>`; }).join('');
  let predict = '';
  if (settings.practice) {
    const days = daysToRipe(r), range = ripeRangeDays(r);
    let t = simulate({ ...r, quality: game.vegQuality(r.veg), days });
    if (p.usesNukaBed) t = applyCare(t, { film: game.nuka.film, bed: { sour: game.nuka.sour, maturity: game.nuka.maturity } });
    predict = `<div class="panel"><div class="ukon">見立て（練習モード）</div><div>食べ頃まで <b class="ukon">${trim(days, 1)}日</b>（${trim(range.from, 1)}〜${trim(range.to, 1)}日）・ ${trim(range.sourFrom, 1)}日を過ぎると酸っぱすぎ</div>${bars(t, { numbers: true })}</div>`;
  }
  return {
    title: '仕込む',
    body: `
    <div class="sec"><h3>樽</h3><div class="row">${empties.map((i) => `<button class="tile${ui.slot === i ? ' on' : ''}" data-bslot="${i}" style="flex:0 0 auto">樽${i + 1}</button>`).join('')}</div></div>
    <div class="sec"><h3>漬物</h3><div class="tiles">${pickles}</div></div>
    <div class="sec"><h3>野菜</h3><div class="tiles">${vegs}</div></div>
    <div class="sec"><h3>塩　<span class="hint">目安 ${p.saltHint}</span></h3>
      ${p.usesNukaBed ? `<div class="hint">ぬか漬けの塩はぬか床の塩分（今 ${trim(game.nuka.salt, 1)}%）。ぬか床の窓で足せる。</div>`
        : `<div class="salt"><button class="stepper" data-salt="-0.5" aria-label="塩を減らす">－</button><input id="salt" type="range" min="1" max="15" step="0.5" value="${r.saltPct}" aria-label="塩分"><button class="stepper" data-salt="0.5" aria-label="塩を増やす">＋</button><output id="saltV">${trim(r.saltPct, 1)}%</output></div>`}</div>
    <div class="sec"><h3>調味（${C.additiveMax}つまで）　<span class="hint">◎合う △ふつう ✕合わない ？まだわからない</span></h3><div class="tiles">${adds}</div></div>
    <div class="sec"><h3>置き場所　<span class="hint">外は今 ${game.ambientTemp()}℃</span></h3><div class="tiles">${places}</div></div>
    ${predict}
    <div class="row end"><span class="hint">所持金 ${yen(game.money)}</span><button class="btn main" data-act="brew" ${cost > game.money ? 'disabled' : ''}>樽${ui.slot + 1}に仕込む（${yen(cost)}）</button></div>`,
  };
};

// 売る
WINS.sell = () => {
  if (!game.isOpen()) return { title: '売る', body: '<p>夜は閉店です。「次へ」で朝にしよう。</p>' };
  if (game.lastSaleTick === game.tick) return { title: '売る', body: '<p>この時間帯はもう店を開けました。「次へ」で時間を進めよう。</p>' };
  const filled = game.barrels.map((b, i) => (b ? i : null)).filter((i) => i != null);
  if (!filled.length) return { title: '売る', body: '<p>売れる樽がありません。まず「仕込む」。</p>' };
  return {
    title: '店を開ける',
    body: `<div class="hint">どの樽を店先に出す？（1つの時間帯に1回。来る客は天気と評判しだい）</div>
    <div class="list">${filled.map((i) => {
      const b = game.barrels[i], t = game.tasteOf(i);
      return `<button class="item${t.stage === 'ripe' ? ' ok' : ''}" data-act="sellSlot" data-slot="${i}"><span class="grow">樽${i + 1}　${barrelName(b)}<br><span class="hint">${trim(game.barrelAge(b), 1)}日目 ・ 残り${b.portions}個 ・ 定価 ${yen(C.pickles[b.pickle].price)}</span></span><span class="stage-tag ${t.stage}">${t.stageLabel}</span></button>`;
    }).join('')}</div>`,
  };
};

// ぬか床
WINS.nuka = () => {
  const n = game.nuka, c = C.nuka;
  const stirred = n.lastStirTick === game.tick, today = n.lastStirDay === game.day();
  const bar = (label, v, col, w) => `<div class="bar"><span>${label}</span><i><s style="width:${Math.min(100, v * 100)}%;background:${col}"></s></i><span>${w}</span></div>`;
  return {
    title: 'ぬか床',
    body: `<div class="panel">
      <div>塩分 <b class="ukon">${trim(n.salt, 1)}%</b> ・ 店の中 ${game.ambientTemp()}℃ ・ ${today ? '今日はかき混ぜた' : '<span class="warn">今日はまだかき混ぜていない</span>'}</div>
      <div class="bars">${bar('酸味', n.sour, '#d29a2c', n.sour < 0.25 ? 'ちょうどいい' : n.sour < 0.5 ? 'やや酸っぱい' : n.sour < 0.8 ? '酸っぱい' : 'かなり酸っぱい')}
      ${bar('白い膜', n.film, '#9a8f7c', filmWord(n.film))}
      ${bar('熟成度', n.maturity, '#6b4a7a', n.maturity < 0.3 ? '若い床' : n.maturity < 0.7 ? '育ってきた' : n.maturity < 1 ? 'いい床' : '最高の床')}</div></div>
    <div class="row"><button class="btn main" data-act="stir" ${stirred ? 'disabled' : ''}>${stirred ? 'かき混ぜた' : 'かき混ぜる'}</button>
      <button class="btn" data-act="saltNuka" ${n.salt >= c.maxSalt || game.money < c.addSaltCost ? 'disabled' : ''}>塩を足す（${yen(c.addSaltCost)}）</button></div>
    <div class="hint">毎日かき混ぜると床が育ち、ぬか漬けの風味が深くなる。放っておくと酸っぱくなり、白い膜が張る。26℃以上は特に早い。</div>`,
  };
};

// 店
WINS.shop = () => {
  const rep = Math.round(game.reputation), next = game.nextBarrelCost();
  const items = Object.entries(C.places).filter(([, x]) => x.cost > 0).map(([id, x]) => {
    const own = game.places.includes(id);
    return `<div class="item${own ? ' ok' : ''}"><span class="grow">${x.name}<br><span class="hint">いつでも${x.fixed}℃で漬けられる</span></span>${own ? '<span class="pos">購入済み</span>' : `<button class="btn gold" data-buy="${id}" ${game.money < x.cost ? 'disabled' : ''}>${yen(x.cost)}</button>`}</div>`;
  });
  items.push(`<div class="item"><span class="grow">樽を増やす<br><span class="hint">今${game.barrels.length}個（最大${C.barrelsInvest.max}個）</span></span>${next == null ? '<span class="hint">これ以上置けない</span>' : `<button class="btn gold" data-buy="barrel" ${game.money < next ? 'disabled' : ''}>${yen(next)}</button>`}</div>`);
  const regs = game.regulars.length ? game.regulars.map((r) => `<li>${C.customers.find((c) => c.id === r.type).name}のお客　<span class="hint">${r.visits}回目 ・ ${r.since}日目から</span></li>`).join('') : '<li class="hint">まだいない。とても満足したお客がときどき常連になる。</li>';
  return {
    title: '店',
    body: `<div class="sec"><h3>評判</h3><div class="row">${stars(rep)}<div class="meter"><i style="width:${rep}%"></i></div><b>${rep}</b></div>
      <div class="hint">満足したお客が多いほど上がり、評判が高いほど客が来る。傷んだものを出すと大きく下がる。</div></div>
    <div class="sec"><h3>常連（${game.regulars.length}/${C.regulars.max}人）</h3><ul style="margin:0;padding-left:1.2em">${regs}</ul></div>
    <div class="sec"><h3>投資　<span class="hint">所持金 ${yen(game.money)}</span></h3><div class="list">${items.join('')}</div></div>`,
  };
};

// 帳面（記録・図鑑・お客）
WINS.book = ({ tab = 'log' }) => {
  const tabs = [['log', '販売の記録'], ['book', '図鑑'], ['guests', 'お客の好み']].map(([k, l]) => `<button class="${tab === k ? 'on' : ''}" data-tab="${k}">${l}</button>`).join('');
  let body = '';
  if (tab === 'log') {
    const st = game.stats;
    body = `<div class="hint">これまで: 売上 ${yen(st.revenue)} ・ 経費 ${yen(st.cost)} ・ <span class="${st.revenue - st.cost >= 0 ? 'pos' : 'neg'}">差し引き ${yen(st.revenue - st.cost)}</span> ・ 売れた数 ${st.sold}個</div>`
      + (ui.log.length ? ui.log.map((s) => `<div class="panel"><div><span class="ukon">${s.day}日目 ${s.time}</span> ・ ${s.weather} ・ ${esc(s.what)}</div>
      <div class="tbl"><table><tr><th>お客</th><th>ひとこと</th><th class="r">満足</th><th class="r">支払</th></tr>
      ${s.rows.map((r) => `<tr><td>${esc(r.name)}</td><td>${esc(r.line)}</td><td class="r">${r.sat == null ? '-' : Math.round(r.sat)}</td><td class="r">${r.price ? yen(r.price) : '—'}</td></tr>`).join('')}</table></div>
      <div>売上 <span class="pos">${yen(s.revenue)}</span>${s.batch ? ` ・ この樽の収支 <span class="${s.batch.profit >= 0 ? 'pos' : 'neg'}">${s.batch.profit >= 0 ? '+' : ''}${yen(s.batch.profit)}</span>` : ''}</div></div>`).join('') : '<p class="hint">まだ売っていません。</p>');
  } else if (tab === 'book') {
    const entries = Object.entries(game.book).sort((a, b) => b[1].best - a[1].best);
    const nameOf = (k) => { const [pk, veg, ...ad] = k.split(':'); return `${C.vegetables[veg].name}の${C.pickles[pk].name}${ad.length ? `＋${ad.map((a) => C.additives[a].name).join('・')}` : ''}`; };
    body = `<div>見つけた組み合わせ <b class="ukon">${entries.length}</b> / ${bookTotal(C)}</div><div class="hint">漬物・野菜・調味の組み合わせを売ると載る。数字はお客の満足度（いちばん良かった回）。</div>`
      + (entries.length ? `<div class="tbl"><table><tr><th>組み合わせ</th><th class="r">満足</th><th class="r">売った回数</th></tr>${entries.map(([k, e]) => `<tr><td>${nameOf(k)}</td><td class="r">${Math.round(e.best)}</td><td class="r">${e.n}</td></tr>`).join('')}</table></div>` : '');
  } else {
    const shift = C.season[game.season()].prefShift;
    const note = shift.salt < 0 ? '夏はみんなあっさり寄り。' : shift.salt > 0 ? '冬はみんなしょっぱめ寄り。' : '';
    body = `<div class="hint">お客は名前なしでランダムに来て、次のどれかの好みを持っている。${note}雨・雪の日は客が減る。</div>
      <div class="list">${C.customers.map((c) => `<div class="item"><span class="grow"><b style="font-weight:400" class="ukon">${c.name}</b><br><span class="hint">${c.hint}</span></span></div>`).join('')}</div>`;
  }
  return { title: '帳面', body: `<div class="tabs">${tabs}</div>${body}` };
};

// 休む（日をとばす）
WINS.rest = () => ({
  title: '休む',
  body: `<p>時間をまとめて進めます。漬物は寝ているあいだも漬かり続けます（膜やぬか床の手入れはできません）。</p>
  <div class="row"><button class="btn" data-rest="1">翌朝まで</button><button class="btn" data-rest="3">3日</button><button class="btn" data-rest="7">7日</button><button class="btn" data-rest="14">14日</button></div>`,
});

// 一日の終わり
WINS.dayend = ({ t }) => {
  const d = Math.round(t.repEnd) - Math.round(t.repStart);
  return {
    title: `${kanjiNum(t.day)}日目　店じまい`,
    body: `<div class="tbl"><table>
      <tr><td>お客</td><td class="r">${t.visitors}人</td></tr>
      <tr><td>売れた数</td><td class="r">${t.sold}個</td></tr>
      <tr><td>売上</td><td class="r pos">${yen(t.revenue)}</td></tr>
      <tr><td>仕入れ・投資</td><td class="r">${yen(t.cost)}</td></tr>
      <tr><td>評判</td><td class="r ${d > 0 ? 'pos' : d < 0 ? 'neg' : ''}">${Math.round(t.repEnd)}（${d >= 0 ? '+' : ''}${d}）</td></tr>
      ${t.joined ? `<tr><td>新しい常連</td><td class="r pos">${t.joined}人</td></tr>` : ''}
      ${t.found ? `<tr><td>図鑑に載った</td><td class="r pos">${t.found}件</td></tr>` : ''}
    </table></div>
    <div class="row end"><button class="btn main" data-act="dayClose">次の日へ</button></div>`,
  };
};

// 設定
WINS.settings = () => {
  const o = ui.override;
  const sel = (id, list, names, v) => `<select id="${id}">${list.map((k) => `<option value="${k}" ${k === v ? 'selected' : ''}>${names[k]}</option>`).join('')}</select>`;
  return {
    title: '設定',
    body: `<div class="sec"><h3>音</h3>
      <label class="bar" style="grid-template-columns:5em 1fr 3em">BGM<input id="vBgm" type="range" min="0" max="1" step="0.05" value="${settings.bgm}"><span>${Math.round(settings.bgm * 100)}</span></label>
      <label class="bar" style="grid-template-columns:5em 1fr 3em">効果音<input id="vSe" type="range" min="0" max="1" step="0.05" value="${settings.se}"><span>${Math.round(settings.se * 100)}</span></label></div>
    <div class="sec"><h3>遊び方</h3>
      <label class="row"><input type="checkbox" id="practice" ${settings.practice ? 'checked' : ''}> 練習モード（仕込む前に食べ頃と味の見立てを出す）</label>
      <label class="row">お客の歩く速さ <select id="speed">${[1, 2, 4].map((s) => `<option value="${s}" ${settings.speed === s ? 'selected' : ''}>×${s}</option>`).join('')}</select></label>
      <div class="row"><button class="btn" data-act="help">遊び方を見る</button><button class="btn ghost" data-act="toTitle">タイトルへ</button></div></div>
    <div class="sec"><h3>確認用</h3>
      <label class="row"><input type="checkbox" id="manual" ${o.manual ? 'checked' : ''}> 見た目だけ固定する（遊びには影響しない）</label>
      <div class="row">${sel('dSeason', SEASONS, Object.fromEntries(SEASONS.map((s) => [s, C.season[s].name])), o.season)} ${sel('dTime', TIMES, C.timeName, o.time)} ${sel('dWeather', WEATHERS, C.weatherName, o.weather)}</div>
      <div class="row"><button class="btn ghost" data-act="ambient">通りがかりの客を呼ぶ</button>${globalThis.TSUKEMONO_IMAGES ? '' : '<a class="hint" href="explorer.html" target="_blank" rel="noopener">味の確認表</a>'}</div></div>
    <div class="sec"><h3>データ</h3><div class="hint">自動で保存しています（このブラウザの中だけ）。</div>
      <div class="row"><button class="btn ghost" data-act="reset">${ui.confirm === 'reset' ? '本当に消して最初から' : '最初からやり直す'}</button></div></div>`,
  };
};

WINS.help = () => ({
  title: '遊び方',
  body: `<ol style="margin:0;padding-left:1.4em;display:grid;gap:8px">
    <li><b class="ukon">仕込む</b>: 樽に、漬物・野菜・塩・調味・置き場所を決めて漬ける。旬の野菜は安くて質が良い。</li>
    <li><b class="ukon">次へ</b>: 朝→昼→夕→夜と時間が進み、漬物が漬かる。店先の樽の札が <b>◎</b> になったら食べ頃。</li>
    <li><b class="ukon">売る</b>: 店を開けると、お客が来て、気に入れば買ってくれる。1つの時間帯に1回。夜は閉店。</li>
    <li><b class="ukon">樽</b>: 味見で今の味がわかる。白い膜（札が <b>!</b>）は「手入れ」で取る。</li>
    <li><b class="ukon">ぬか床</b>: 毎日かき混ぜると育ち、ぬか漬けがおいしくなる。</li>
    <li><b class="ukon">店</b>: お金がたまったら、冷蔵庫・室・樽を買う。評判と常連もここで見る。</li>
    <li><b class="ukon">帳面</b>: 売った記録と、見つけた組み合わせ（図鑑）。調味の相性は、売ってみるとわかる。</li>
  </ol>
  <p class="hint">お客の好みは「あっさり・しょっぱめ・酸っぱい・食感・通」の5つ。季節で少し変わる。傷んだものを出すと評判が下がる。</p>`,
});

// ------------------------------------------------------------ 操作
function renderAll() {
  renderHud(); renderChips(); renderCommands();
  if (ui.win) renderWin();
  if (ui.started) {
    const t = game.timeOfDay();
    sound.play(t === 'night' ? 'night' : t === 'evening' ? 'evening' : 'day');
    sound.setRain(game.weather !== 'sunny');
  }
  save();
}

async function advance(ticks, { summary = true } = {}) {
  if (ui.busy) return;
  ui.busy = true; renderCommands();
  sound.se('next');
  for (let i = 0; i < ticks; i++) {
    const wasNight = game.timeOfDay() === 'night';
    game.advance(1);
    if (wasNight) { // 夜が明けた: 前の日のまとめ
      const t = { ...ui.today, repEnd: game.reputation };
      ui.today = newToday();
      if (summary && ticks === 1) {
        ui.busy = false; renderAll();
        sound.se('dayEnd');
        openWin('dayend', { t });
        say(`${kanjiNum(t.day)}日目が終わった。`);
        return;
      }
    }
    renderHud(); renderChips();
    if (ticks > 1) await world.wait(120);
  }
  ui.busy = false;
  const tod = game.timeOfDay();
  say(`${C.season[game.season()].name} ${kanjiNum(game.day())}日目、${C.timeName[tod]}。${{ morning: '朝は仕込みどき。', noon: 'お昼どき、お客が多い。', evening: '夕方。もうひと売り。', night: '夜は閉店。翌朝まで休もう。' }[tod]}`);
  renderAll();
}

async function doBrew() {
  const slot = ui.slot;
  const r = game.brew(slot, ui.recipe);
  if (!r.ok) { sound.se('error'); say(r.error); return; }
  ui.today.cost += r.cost;
  ui.shownMoney = game.money;
  closeWin();
  sound.se('brew');
  const s = slotPos(slot);
  floatText(`-${yen(r.cost)}`, s.cx, SCENE.labelY - 30, 'bad');
  say(`樽${slot + 1}に${barrelName(game.barrels[slot])}を仕込んだ。`, '店主');
  ui.busy = true; renderAll();
  await world.brewScene(slot);
  ui.busy = false; renderAll();
}

async function doSell(slot) {
  const res = game.sell(slot);
  if (!res.ok) { sound.se('error'); say(res.error); return; }
  closeWin();
  ui.busy = true; renderAll();
  ui.today.visitors += res.visitors.length;
  if (!res.visitors.length) {
    say(game.weather === 'sunny' ? '店を開けたが、誰も来なかった…' : `${C.weatherName[game.weather]}の日は客足が遠のく…誰も来なかった。`);
    ui.busy = false; renderAll(); return;
  }
  say(`店を開けた。${res.visitors.length}人のお客が来た。`);
  const lane = SCENE.lane;
  await world.saleScene(res.visitors, res.season, (v) => {
    if (res.spoiled) { sound.se('bad'); floatText('傷んでる！', lane.standX, 140, 'bad'); return; }
    if (v.price > 0) { ui.shownMoney += v.price; sound.se('coin'); floatText(`+${yen(v.price)}`, lane.standX, 140); renderHud(); }
    else if (!v.soldOut) floatText('買わない…', lane.standX, 140, 'bad');
    if (v.regular?.joined) { sound.se('regular'); setTimeout(() => floatText('常連になった！', lane.standX, 120, 'good'), 500); }
  });
  ui.shownMoney = game.money;
  ui.today.revenue += res.revenue; ui.today.sold += res.sold;
  ui.today.joined += res.visitors.filter((v) => v.regular?.joined).length;
  const repNote = (() => { const d = Math.round(res.reputation.after) - Math.round(res.reputation.before); return d ? ` ・ 評判 ${d > 0 ? '+' : ''}${d}` : ''; })();
  ui.log.unshift({
    day: game.day(), time: C.timeName[res.time], weather: C.weatherName[res.weather], what: (res.spoiled ? '傷んでいた！' : `${res.sold}個売れた`) + repNote,
    rows: res.visitors.map((v) => ({ name: (v.regular ? (v.regular.joined ? '★新しい常連・' : v.regular.left ? '常連（離れた）・' : `常連${v.regular.visits}回目・`) : '') + v.customer.name, line: v.reaction.line, sat: v.soldOut || res.spoiled ? null : v.sat, price: v.price })),
    revenue: res.revenue, batch: res.batch.closed ? res.batch : null,
  });
  ui.log.length = Math.min(ui.log.length, 12);
  ui.busy = false;
  let msg = res.spoiled ? '傷んだ樽を出してしまった…樽は空になった。評判が下がった。'
    : `売上 ${yen(res.revenue)}（${res.sold}個）。${res.batch.closed ? `樽が空になった。この樽の収支 ${res.batch.profit >= 0 ? '+' : ''}${yen(res.batch.profit)}。` : ''}`;
  if (res.discovery?.isNew) {
    ui.today.found++;
    msg = `図鑑に新しい組み合わせが載った！ ${msg}`;
    sound.se('found');
    floatText('図鑑に登録！', 192, 60, 'good');
  }
  if (res.spoiled) sound.se('bad');
  say(msg, '店主');
  renderAll();
}

function doBuy(id) {
  const r = id === 'barrel' ? game.buyBarrel() : game.buyPlace(id);
  if (!r.ok) { sound.se('error'); say(r.error); return; }
  ui.today.cost += r.cost;
  ui.shownMoney = game.money;
  if (id === 'barrel') ui.slot = game.barrels.length - 1; else ui.recipe.place = id;
  sound.se('buy');
  say(id === 'barrel' ? `樽を増やした（${yen(r.cost)}）。店先の右の樽が使える。` : `${C.places[id].name}を買った（${yen(r.cost)}）。いつでも${C.places[id].fixed}℃で漬けられる。`, '店主');
  renderAll();
}

function clampRecipe() {
  const r = ui.recipe, p = C.pickles[r.pickle];
  if (!p.vegetables.includes(r.veg)) r.veg = p.vegetables.find((v) => game.inSeason(v)) ?? p.vegetables[0];
  if (!game.places.includes(r.place)) r.place = 'doma';
}

// クリック
document.addEventListener('click', (e) => {
  const t = e.target.closest('button, [data-goto]');
  if (!t) return;
  sound.unlock();
  const d = t.dataset;
  if (d.cmd) {
    sound.se('click');
    if (ui.busy) return;
    if (d.cmd === 'next') { advance(1); return; }
    if (d.cmd === 'brew') { const e2 = game.barrels.findIndex((b) => !b); if (e2 >= 0 && game.barrels[ui.slot]) ui.slot = e2; clampRecipe(); openWin('brew'); return; }
    if (d.cmd === 'sell') { openWin('sell'); return; }
    if (d.cmd === 'barrels') { openWin('barrels'); return; }
    openWin(d.cmd);
    return;
  }
  if (d.chip != null) { sound.se('select'); ui.slot = +d.chip; openWin('barrel', { slot: +d.chip }); return; }
  if (d.goto != null) { sound.se('select'); ui.slot = +d.goto; ui.win = { kind: 'barrel', slot: +d.goto }; ui.confirm = null; renderWin(); $('modal').hidden = false; renderChips(); return; }
  if (d.tab) { sound.se('select'); ui.win.tab = d.tab; renderWin(); return; }
  if (d.pickle) { sound.se('select'); ui.recipe.pickle = d.pickle; ui.recipe.saltPct = SALT_DEFAULT[d.pickle] ?? 3; clampRecipe(); renderWin(); return; }
  if (d.veg) { sound.se('select'); ui.recipe.veg = d.veg; renderWin(); return; }
  if (d.add) { sound.se('select'); const a = ui.recipe.additives; ui.recipe.additives = a.includes(d.add) ? a.filter((x) => x !== d.add) : [...a, d.add].slice(0, C.additiveMax); renderWin(); return; }
  if (d.place) { sound.se('select'); ui.recipe.place = d.place; renderWin(); return; }
  if (d.bslot) { sound.se('select'); ui.slot = +d.bslot; renderWin(); renderChips(); return; }
  if (d.salt) { sound.se('select'); ui.recipe.saltPct = Math.min(15, Math.max(1, ui.recipe.saltPct + +d.salt)); renderWin(); return; }
  if (d.buy) { doBuy(d.buy); return; }
  if (d.rest) { const days = +d.rest; closeWin(); const ticks = days === 1 ? ((4 - TIMES.indexOf(game.timeOfDay())) % 4 || 4) : days * 4; advance(ticks, { summary: false }); return; }
  const act = d.act;
  if (!act) return;
  const slot = d.slot != null ? +d.slot : null;
  if (act === 'brew') { doBrew(); return; }
  if (act === 'openBrew') { ui.slot = slot; clampRecipe(); openWin('brew'); return; }
  if (act === 'openNuka') { openWin('nuka'); return; }
  if (act === 'sellSlot') { doSell(slot); return; }
  if (act === 'taste') { const r = game.tasteTest(slot); sound.se('taste'); if (r?.ok === false) say(r.error); renderWin(); renderChips(); return; }
  if (act === 'care') { const r = game.care(slot); if (!r.ok) { say(r.error); return; } sound.se('care'); say(`樽${slot + 1}の白い膜を取った。`, '店主'); world.careScene(); renderAll(); return; }
  if (act === 'discard') {
    if (ui.confirm !== `discard${slot}`) { ui.confirm = `discard${slot}`; renderWin(); return; }
    game.discard(slot); sound.se('discard'); say(`樽${slot + 1}を空にした。`); ui.confirm = null; renderAll(); return;
  }
  if (act === 'stir') { const r = game.stirNuka(); if (!r.ok) { say(r.error); return; } sound.se('stir'); say('ぬか床をかき混ぜた。いい香りだ。', '店主'); world.careScene(); renderAll(); return; }
  if (act === 'saltNuka') { const r = game.saltNuka(); say(r.ok ? 'ぬか床に塩を足した。酸味が和らいだ。' : r.error); ui.shownMoney = game.money; sound.se(r.ok ? 'care' : 'error'); renderAll(); return; }
  if (act === 'dayClose') { closeWin(); say(`${C.season[game.season()].name} ${kanjiNum(game.day())}日目の朝。今日も店を開けよう。`); return; }
  if (act === 'help') { openWin('help'); return; }
  if (act === 'ambient') { closeWin(); if (!world.busy) world.ambientVisit(view().season); return; }
  if (act === 'toTitle') { closeWin(); showTitle(); return; }
  if (act === 'reset') {
    if (ui.confirm !== 'reset') { ui.confirm = 'reset'; renderWin(); return; }
    store.del(SAVE_KEY); location.reload(); return;
  }
});

document.addEventListener('input', (e) => {
  const t = e.target;
  if (t.id === 'salt') { ui.recipe.saltPct = +t.value; renderWin(); $('salt')?.focus(); return; }
  if (t.id === 'vBgm' || t.id === 'vSe') { settings[t.id === 'vBgm' ? 'bgm' : 'se'] = +t.value; sound.setVolumes(settings.bgm, settings.se); t.nextElementSibling.textContent = Math.round(+t.value * 100); saveSettings(); return; }
  if (t.id === 'practice') { settings.practice = t.checked; saveSettings(); return; }
  if (t.id === 'speed') { settings.speed = +t.value; world.speed = settings.speed; saveSettings(); return; }
  const o = ui.override;
  if (t.id === 'manual') o.manual = t.checked;
  else if (t.id === 'dSeason') o.season = t.value;
  else if (t.id === 'dTime') o.time = t.value;
  else if (t.id === 'dWeather') o.weather = t.value;
});
document.addEventListener('change', (e) => { if (e.target.id === 'vSe') sound.se('coin'); });

// 店先の樽を直接押す
canvas.addEventListener('click', (e) => {
  if (!ui.started || ui.busy) return;
  const r = canvas.getBoundingClientRect();
  const x = ((e.clientX - r.left) / r.width) * SCENE.w, y = ((e.clientY - r.top) / r.height) * SCENE.h;
  if (y < 140) return;
  let best = -1, bd = 22;
  game.barrels.forEach((_, i) => { const s = slotPos(i); if (s && Math.abs(s.cx - x) < bd) { bd = Math.abs(s.cx - x); best = i; } });
  if (best >= 0) { sound.unlock(); sound.se('select'); ui.slot = best; openWin('barrel', { slot: best }); }
});

// ------------------------------------------------------------ タイトル
function showTitle() {
  ui.started = false;
  const t = $('title');
  const hasProgress = game.tick > 0 || game.stats.revenue > 0 || game.barrels.some(Boolean);
  t.innerHTML = `<div class="logo"><h1>漬物！</h1><span class="hanko" aria-hidden="true">漬</span></div><div class="sub">最強の漬物への道</div>
    <div class="menu">
      ${hasProgress ? '<button class="btn main" data-title="continue">つづきから</button>' : ''}
      <button class="btn${hasProgress ? '' : ' main'}" data-title="new">${hasProgress ? (ui.confirm === 'new' ? '本当に最初から？' : 'はじめから') : 'はじめる'}</button>
      <button class="btn ghost" data-title="help">遊び方</button>
    </div>
    <div class="note">音が出ます（設定で変えられます）</div>`;
  t.hidden = false;
  $('app').classList.add('titling');
  renderCommands();
  sound.play('title');
}
$('title').addEventListener('click', (e) => {
  const b = e.target.closest('[data-title]');
  if (!b) return;
  sound.unlock();
  sound.se('click');
  const k = b.dataset.title;
  if (k === 'help') { openWin('help'); return; }
  if (k === 'new' && (game.tick > 0 || game.barrels.some(Boolean))) {
    if (ui.confirm !== 'new') { ui.confirm = 'new'; showTitle(); return; }
    store.del(SAVE_KEY); location.reload(); return;
  }
  $('title').hidden = true;
  $('app').classList.remove('titling');
  ui.started = true;
  ui.confirm = null;
  renderAll();
  if (k === 'new' || (k !== 'continue' && game.tick === 0)) {
    say('いらっしゃい…じゃなくて、今日からここがあなたの漬物屋。まずは「仕込む」で、樽にきゅうりの浅漬けを漬けてみよう。浅漬けは1日で食べ頃になる。', '先代');
  } else {
    say(`おかえりなさい。${C.season[game.season()].name} ${kanjiNum(game.day())}日目、${C.timeName[game.timeOfDay()]}から。`, '店主');
  }
});

// ------------------------------------------------------------ 大きさと描画ループ
function fit() {
  const availW = document.body.clientWidth - 32 - 16; // 左右の余白と枠
  const availH = window.innerHeight - 300; // 帳場・会話窓・コマンドのぶん
  let s = Math.min(availW / SCENE.w, Math.max(1, availH / SCENE.h));
  s = s >= 1 ? Math.max(1, Math.floor(s)) : availW / SCENE.w; // ふだんは整数倍（ぼかさない）。狭いスマホは幅に合わせる
  const w = Math.floor(SCENE.w * s), h = Math.floor(SCENE.h * s);
  canvas.style.width = `${w}px`; canvas.style.height = `${h}px`;
  $('app').style.width = `${w + 12}px`;
  $('stageWrap').style.width = `${w + 12}px`; // 枠（6px×2）込み。container-type のため幅を決めておく
}
window.addEventListener('resize', fit);
void integerScale;

let last = performance.now();
function frame(now) {
  const dt = Math.min(100, now - last); last = now;
  world.update(dt);
  renderer.draw(view(), now);
  requestAnimationFrame(frame);
}
// 店を開いていると、ときどき通りがかりの人が買っていく（見た目だけ。ゲームの状態は変えない）
setTimeout(function loop() {
  if (ui.started && !world.busy && !ui.busy && view().time !== 'night') world.ambientVisit(view().season);
  setTimeout(loop, 16000);
}, 4000);

fit();
renderAll();
showTitle();
say('');
requestAnimationFrame(frame);
window.__game = { game, ui, world, renderer, sound, settings, advance, doBrew, doSell, renderAll, openWin, closeWin }; // 動作確認用（scripts/e2e.js）
