// 画面（DOM）とゲームをつなぐ。計算は model.js / sales.js / game.js、見た目は render.js / world.js、音は audio.js。
// 画面の作り: 上に帳場（日付・お金・評判）、真ん中に店先、下に会話窓とコマンド。操作は「窓」を開いて行う。
import { CONFIG } from './config.js';
import { createGame, bookTotal, SHELF } from './game.js';
import { simulate, daysToRipe, ripeRangeDays, applyCare, affinityOf } from './model.js';
import { SceneRenderer } from './render.js';
import { World } from './world.js';
import { integerScale, loadImages } from './pixel.js';
import { nextStep } from './guide.js';
import { NUKA_CARE, NUKA_WHEN } from '../data/nuka.js';
import { ALMOST, ALMOST_TAIL, MASTERY_NAMES, TOO_EARLY } from '../data/quips.js';
import { nextLevelXp } from './unlock.js';
import { encodeSave, decodeSave } from './save.js';
import { agingFactor, STAFF, AGES } from './business.js';
import { Sound } from './audio.js';
import { SCENE, IMAGES } from '../assets/scene.js';
import { PREFECTURE_PICKLES } from '../data/prefectures.js';
import { NOT_PLAYABLE } from '../data/regional.js';
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
// 段階H: セーブには版番号がある（src/save.js）。壊れていたら別の名前で残して、最初から始める
const SAVE_BROKEN_KEY = 'tsukemono.save.broken';
const savedRaw = (() => { try { return localStorage.getItem(SAVE_KEY); } catch { return null; } })();
let saved = store.get(SAVE_KEY);
let hasSave = !!(saved && game.restore(saved.game));
let brokenSave = false;
if (savedRaw && !hasSave) { try { localStorage.setItem(SAVE_BROKEN_KEY, savedRaw); } catch { /* 残せなくても遊べる */ } store.del(SAVE_KEY); brokenSave = true; saved = null; }
const settings = { bgm: 0.6, se: 0.8, practice: true, speed: 1, timeScale: 1, ...(store.get(SET_KEY) ?? {}) };
sound.setVolumes(settings.bgm, settings.se);

const newToday = () => ({ day: game.day(), revenue: 0, sold: 0, visitors: 0, cost: 0, repStart: game.reputation, joined: 0, found: 0, xpStart: game.xp });
const ui = {
  slot: 0,
  recipe: { pickle: 'asazuke', veg: 'kyuri', saltPct: 2.5, place: 'doma', additives: [], specials: [], count: game.standardCount('asazuke') },
  override: { manual: false, season: 'spring', time: 'morning', weather: 'sunny' },
  busy: false,
  started: false,
  shownMoney: game.money,
  log: hasSave && Array.isArray(saved.log) ? saved.log.slice(0, 12) : [],
  today: hasSave && saved.today?.day === game.day() ? saved.today : newToday(),
  win: null, // 開いている窓 { kind, ... }
  message: '',
  confirm: null, // 二度押しで確かめる操作の名前
  // 時間制: 今の時間帯の進み（0〜1）。窓を開いている間と、場面（仕込みなど）の間は止まる
  clock: { phase: hasSave && Number.isFinite(saved.clock?.phase) ? Math.min(0.999, Math.max(0, saved.clock.phase)) : 0 },
  paused: false,
  display: hasSave && Number.isInteger(saved.display) ? saved.display : null, // 店先に出している樽（店が開いている時間帯に、お客が来るたびに売れる）
  pending: [], // まだ見せていない知らせ（レベル・ひらめき）
  almostN: 0,
};
function save() { store.set(SAVE_KEY, { game: game.snapshot(), log: ui.log, today: ui.today, clock: ui.clock, display: ui.display }); }
function saveSettings() { store.set(SET_KEY, settings); }

// ------------------------------------------------------------ 店先の画面
const canvas = $('screen');
await loadImages(IMAGES);
const renderer = new SceneRenderer(canvas);
renderer.drawBubbles = false; // 吹き出しは下の renderBubbles で、読みやすい文字で重ねる
const world = new World();
world.speed = settings.speed;

function view() {
  const o = ui.override;
  const v = o.manual ? { season: o.season, time: o.time, weather: o.weather } : { season: game.season(), time: game.timeOfDay(), weather: game.weather };
  return {
    ...v,
    barrels: game.barrels.map((b) => ({
      filled: !!b, veg: b ? (C.vegetables[b.veg]?.img ?? b.veg) : undefined, top: b ? C.pickles[b.pickle].top : undefined, // 絵のない食材は、似た野菜の絵（img）で
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
const barrelName = (b) => (C.pickles[b.pickle].name.includes(C.vegetables[b.veg].name) ? C.pickles[b.pickle].name : `${C.vegetables[b.veg].name}の${C.pickles[b.pickle].name}`); // 梅の梅干し → 梅干し
/** 樽か棚の呼び名 */
const vname = (slot) => (slot >= SHELF ? `棚${slot - SHELF + 1}` : `樽${slot + 1}`);
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
    const hint = done && ui.started && !ui.busy ? nextStep(game, { display: ui.display }) : '';
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
    <span class="tw"><b>${TIME_ICON[game.timeOfDay()]}</b><b>${WEATHER_ICON[game.weather]}</b>${game.ambientTemp()}℃<small title="明日の天気（干す日を決めるときに）"> 明日${WEATHER_ICON[game.tomorrow] ?? ''}</small></span>
    <span class="clock" title="この時間帯の進み"><i id="clockFill" style="width:${Math.round(ui.clock.phase * 100)}%"></i></span>
    <button class="pause" data-cmd="pause" aria-label="${ui.paused ? '時間を進める' : '時間を止める'}" title="${ui.paused ? '時間を進める' : '時間を止める'}">${ui.paused ? '▶' : '❚❚'}<span class="lbl">${ui.paused ? '止めている' : '時間が進んでいる'}</span></button>
    <span class="grow"></span>
    ${game.event() ? `<span class="ev" title="${esc(game.event().note)}">${game.event().name}</span>` : ''}
    ${Object.keys(C.upgrades).filter((id) => game.campaignLeft(id) > 0).map((id) => `<span class="ev" title="${esc(C.upgrades[id].note)}">${C.upgrades[id].name.replace(/(を|に).*$/, '')}中</span>`).join('')}
    ${game.orders.board.filter((o) => o.state === 'active').map((o) => `<span class="ev" title="${esc(game.client(o.client).name)}: ${C.pickles[o.pickle].name} ${o.count}個">注文 あと${o.due - game.day()}日</span>`).join('')}
    <span class="lv" title="${esc(game.level().title)}"><span class="k">店</span>Lv.${game.level().level}</span>
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
/** オーバーリアクションの演出: 画面が揺れて、大きな文字が出る */
const OVER_WORDS = { great: ['うまーい！！', 'ズキューン！', 'バーン！', 'ドーン！！', 'うおおお！'], bad: ['ガーン！', 'ズーン…', 'ぎゃー！'] };
function overEffect(v) {
  const good = v.reaction.key === 'great', words = OVER_WORDS[good ? 'great' : 'bad'];
  sound.se(good ? 'found' : 'bad');
  floatText(words[Math.floor(Math.random() * words.length)], SCENE.lane.standX - 150, 70, `over ${good ? 'good' : 'bad'}`); // 吹き出しに隠れないよう、左上に
  if (!matchMedia('(prefers-reduced-motion: reduce)').matches) {
    const st = $('stageWrap'); st.classList.remove('shake'); void st.offsetWidth; st.classList.add('shake');
    setTimeout(() => st.classList.remove('shake'), 600);
  }
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
    cmd('sell', '売る', ui.display != null && game.vessel(ui.display) ? `${vname(ui.display)}を出し中` : '店先に出す', game.orders.board.some((o) => o.state === 'offer') ? '注' : anyRipe && (ui.display == null || !game.vessel(ui.display)) ? '◎' : ''),
    cmd('barrels', '樽', '味見など', anyCare ? '!' : ''),
    cmd('market', '仕入れ', '野菜を買う', game.saleVeg() ? '特' : ''),
    cmd('nuka', 'ぬか床', 'かき混ぜる', nukaTodo ? '!' : ''),
    cmd('shop', '店', '投資・常連'),
    cmd('book', '帳面', '記録・図鑑'),
    cmd('rest', '休む', '日を進める'),
    cmd('settings', '設定', '音・遊び方'),
    `<button class="cmd next" data-cmd="next" ${dis}>とばす ▶<small>${nextT}</small></button>`,
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
  flushEvents();
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

// 仕入れ（段階D）: 今日の相場で野菜を買っておく。古くなると品質が落ち、やがて傷む
WINS.market = () => {
  const sale = game.saleVeg(), ev = game.event(), season = game.season();
  const rows = Object.entries(C.vegetables).map(([id, v]) => {
    if (!game.vegAvailable(id)) return `<div class="item"><span class="grow">${v.name}<br><span class="hint">${v.contract && !game.contracts.includes(id) ? `${v.contract.farmer}と契約すると仕入れられる（「店」で。レベル${v.contract.level}から）` : game.vegLock(id)}</span></span></div>`;
    const base = C.market.priceBySeason[id]?.[season] ?? 1, f = game.marketFactor(id);
    const trend = f < base * 0.95 ? '<span class="pos">↓安い</span>' : f > base * 1.05 ? '<span class="neg">↑高い</span>' : '<span class="hint">ふつう</span>';
    const lots = game.stock[id] ?? [], n = game.stockCount(id);
    const oldest = lots.length ? Math.max(...lots.map((l) => game.stockAge(l))) : 0;
    const stockNote = n ? `在庫 ${n}個分（いちばん古いのは${oldest}日前${oldest > C.stock.freshDays ? '・<span class="warn">鮮度が落ちている</span>' : ''}）` : '在庫なし';
    const buy = [6, 12, 30].map((k) => `<button class="btn" data-stock="${id}:${k}" ${game.stockCost(id, k) > game.money ? 'disabled' : ''}>${k}個分 ${yen(game.stockCost(id, k))}</button>`).join('');
    return `<div class="item"><span class="grow">${sale === id ? '<i class="tag">特売</i> ' : ''}${game.inSeason(id) ? '<span class="ukon">旬</span> ' : ''}<b style="font-weight:400">${v.name}</b>　${yen(game.vegCost(id))}<span class="hint">/6個分</span> ${trend}<br><span class="hint">${stockNote}</span></span><span class="row">${buy}</span></div>`;
  }).join('');
  return {
    title: '仕入れ',
    body: `<div class="hint">${ev ? `<b class="ukon">${ev.name}</b>: ${ev.note}。` : ''}${sale ? `今日は<b class="ukon">${C.vegetables[sale].name}</b>が特売！ ` : ''}相場は毎日変わる。安い日に買っておくと、仕込むときに在庫から使う（足りない分はその日の相場で買う）。${C.stock.freshDays}日を過ぎると品質が落ち、${C.stock.spoilDays}日を過ぎると傷んで捨てる。</div>
      <div class="list">${rows}</div><div class="row end"><span class="hint">所持金 ${yen(game.money)}</span></div>`,
  };
};

// 本編の物語（data/saga.js）。一行ずつ「次へ」で読む。読み返しは全部出す
WINS.saga = (w) => {
  const ch = game.chapter(w.id);
  const all = w.all || w.step >= ch.lines.length - 1;
  const shown = ch.lines.slice(0, all ? ch.lines.length : w.step + 1);
  const q = ch.quest, rw = ch.reward;
  const tail = all ? `${q ? `<div class="panel quest"><div class="ukon">課題: ${q.name}</div><div class="hint">${questText(q)}（${q.days}日以内）</div></div>` : ''}${rw && !w.all ? `<div class="hint" style="text-align:center">${[rw.rep && `評判 +${rw.rep}`, rw.money && `${yen(rw.money)}`, rw.xp && `経験 +${rw.xp}`].filter(Boolean).join(' ・ ')}</div>` : ''}` : '';
  return {
    title: `${ch.no}　${ch.title}`,
    body: `<div class="saga">${shown.map((l) => (l.who ? `<p class="sg-say"><b>${esc(l.who)}</b>「${esc(l.text)}」</p>` : `<p class="sg-narr">${esc(l.text)}</p>`)).join('')}</div>${tail}
      <div class="row end">${all ? '<button class="btn main" data-act="closeWin">閉じる</button>' : '<button class="btn main" data-act="sagaNext">次へ ▼</button>'}</div>`,
  };
};
const questText = (q) => ({ greatGuests: `お客を${q.target}人、満足${q.need.sat}以上でうならせる`, agedSale: `寝かせた漬物（売り値×${q.need.aging}以上の熟成もの）を売る`, variety: `違う漬物${q.target}種を、それぞれ満足${q.need.sat}以上で売る` }[q.kind] ?? '');
function storyTab() {
  const st = game.story, q = st.quest;
  const now = q ? `<div class="panel quest"><div class="ukon">いまの課題: ${q.name}</div><div>${questText(q)} ・ <b>${q.progress} / ${q.target}</b> ・ あと${Math.max(0, q.endDay - game.day())}日</div></div>`
    : st.retry ? `<div class="panel quest"><div class="hint">${st.retry.quest.name}は、${Math.max(0, st.retry.day - game.day())}日後にやり直し。</div></div>` : '';
  const list = st.seen.map((id) => game.chapter(id)).filter(Boolean).map((c) => `<button class="item" data-saga="${c.id}"><span class="grow">${c.no}　<b style="font-weight:400" class="ukon">${c.title}</b></span><span class="hint">読み返す</span></button>`).join('');
  const left = game.sagaChapters.filter((c) => !st.seen.includes(c.id) && !c.repeat && !c.when?.questLost).length;
  return `${now}<div class="list">${list}</div><div class="hint">まだ読んでいない章: ${left}。店のレベル・ひらめき・ぬか床・難癖のお客…いろいろなことで物語が進む。</div>`;
}

// 知恵袋のおばあちゃん（段階G）
WINS.granny = () => ({
  title: '知恵袋のおばあちゃん',
  body: `<div class="idea"><div class="name">${esc(game.grannyDef.name)}</div>
    <p>「あら、新しい漬物屋さんかい。先代には、ずいぶんお世話になってねぇ。…白菜漬け、ひとつもらえるかい」</p>
    <p class="hint">近所の${esc(game.grannyDef.title)}が常連になった。とても満足させるたびに絆が深まり、ぬか床の知恵や作り方を教えてくれる（帳面の「知恵袋」）。</p></div>
    <div class="row end"><button class="btn main" data-act="closeWin">よろしくお願いします</button></div>`,
});
WINS.wisdom = ({ e }) => ({
  title: e.lore ? '梅子さんの伝承' : '梅子さんの知恵',
  body: `<div class="idea">${e.lore ? '<div class="stage-tag raw">伝承（昔から言われていること・効果は確かめられていない）</div>' : ''}<p>「${esc(e.text)}」</p>
    <p class="hint">帳面の「知恵袋」に書きとめた。${e.lore ? 'ぬか床の窓の「伝承」から試せる（遊びには効かない、気分のもの）。' : 'その場面になると、思い出させてくれる。'}</p></div>
    <div class="row end"><button class="btn main" data-act="closeWin">ありがとうございます</button></div>`,
});

// セーブの書き出し・読みこみ（ファイルが使えない所でも、文字のコピーと貼り付けでできる）
WINS.saveText = ({ text }) => ({
  title: text ? 'セーブを書き出す' : 'セーブを読みこむ',
  body: text
    ? `<div class="hint">ファイル（tsukemono-save-○日目.json）に書き出した。ファイルが保存できない所では、下の文字をコピーして取っておく。</div>
      <textarea readonly rows="6" style="width:100%;font-size:12px">${esc(text)}</textarea>
      <div class="row end"><button class="btn" data-act="copySave">文字をコピー</button><button class="btn main" data-act="closeWin">閉じる</button></div>`
    : `<div class="hint">書き出したファイルを選ぶか、セーブの文字を貼り付けて読みこむ。今の店は、読みこんだセーブに置きかわる（読めないセーブなら、今の店はそのまま）。</div>
      <div class="row"><button class="btn" data-act="pickFile">ファイルを選ぶ</button><input type="file" id="importFile" accept=".json,application/json" hidden></div>
      <textarea id="saveInput" rows="6" style="width:100%;font-size:12px" placeholder="ここにセーブの文字を貼り付け"></textarea>
      <div class="row end"><button class="btn main" data-act="pasteSave">貼り付けた文字から読みこむ</button></div>`,
});

// 常連の物語
WINS.story = ({ e }) => ({
  title: `${e.name}の話`,
  body: `<div class="idea"><div class="name">${esc(e.title)}</div><p>${esc(e.text)}</p><div class="hint">（絆が深まった。評判 +${C.bond.storyRep}）</div></div>
    <div class="row end"><button class="btn main" data-act="closeWin">うんうん</button></div>`,
});

// 樽（1つずつ見る）
// 棚に移した漬物の窓
function shelfWin(slot) {
  const b = game.vessel(slot);
  if (!b) return { title: vname(slot), body: '<p>空いています。</p>' };
  const p = C.pickles[b.pickle], t = game.tasteOf(slot), on = ui.display === slot, disc = ui.confirm === `discard${slot}`, tasted = b.tastedTick === game.tick;
  return {
    title: `${vname(slot)}　${barrelName(b)}`,
    body: `<div class="panel"><div><span class="stage-tag ${t.stage}">${t.stageLabel}</span>　残り${b.portions}個${agingFactor(p, t.ratio) > 1 ? ` ・ <span class="ukon">熟成もの（売り値 ×${trim(agingFactor(p, t.ratio), 2)}）</span>` : ''}</div>
      <div class="hint">棚に移して${trim((game.tick - b.shelvedTick) / C.calendar.ticksPerDay, 1)}日。棚では漬かりも傷みもゆっくり進む（${Math.round(1 / C.shelf.slow)}分の1）。</div></div>
      ${b.tastedTaste ? `<div class="panel">${bars(b.tastedTaste)}</div>` : ''}
      <div class="row"><button class="btn" data-act="taste" data-slot="${slot}" ${tasted ? 'disabled' : ''}>${tasted ? '味見した' : '味見'}</button>
      ${on ? `<button class="btn" data-act="hideSlot" data-slot="${slot}">店先から下げる</button>` : `<button class="btn main" data-act="sellSlot" data-slot="${slot}">店先に出す</button>`}
      <button class="btn ghost" data-act="discard" data-slot="${slot}">${disc ? '本当に捨てる' : '捨てる'}</button></div>`,
  };
}

// 重石と工程（樽の窓）
const waterWord = (u) => (u >= 1 ? '上がった' : u >= 0.5 ? '上がりかけ' : 'まだ上がっていない');
const TIMING = { good: 'ちょうど良い日にやった', early: '早すぎた（味が少し浅い）', late: '遅れた（食感が少し落ちた）' };
function handworkBox(slot, b, p, t) {
  if (!p.weight && !p.work.length) return '';
  const cur = game.weightOf(b), heavy = (b.weights?.at(-1)?.w ?? 1) > 1;
  const wRow = p.weight ? `<div>水: <b class="${t.waterUp >= 1 && heavy ? 'warn' : 'ukon'}">${waterWord(t.waterUp ?? 0)}</b>${t.waterUp >= 1 && heavy ? '（重いままだと野菜がつぶれる。軽くする頃）' : t.waterUp < 1 && !heavy ? '（重石が軽いと、水が上がるまで傷みやすい）' : ''}</div>
    <div class="row">${Object.entries(C.weight.levels).map(([k, l]) => `<button class="btn${cur === k ? ' main' : ''}" data-weight="${k}" data-wslot="${slot}" ${cur === k || t.drying ? 'disabled' : ''}>重石: ${l.name}</button>`).join('')}</div>` : '';
  const days = game.fermentDays(b);
  const wk = p.work.map((w) => {
    const st = t.work?.find((x) => x.id === w.id), done = b.work?.[w.id];
    const late = days > w.window[1] + C.workGrace;
    const info = done != null ? `<span class="ukon">済み</span>（${TIMING[st?.timing] ?? ''}）` : late ? '<span class="warn">やらなかった</span>' : st?.state === 'skipped' ? '<span class="warn">目安を過ぎた（まだ間に合う）</span>' : st?.state === 'now' ? '<span class="ukon">今が目安</span>' : `<span class="hint">あと${trim(w.window[0] - days, 1)}日で目安</span>`;
    const whenTxt = w.when ? `・${(w.when.season ?? []).map((x) => C.season[x].name).join('・')}の${(w.when.weather ?? []).map((x) => C.weatherName[x]).join('・')}の日に` : '';
    return `<div class="item"><span class="grow">${w.label}（${w.window[0]}〜${w.window[1]}日目${whenTxt}） ${info}<br><span class="hint">${w.note}</span></span>${done == null && !late ? `<button class="btn" data-work="${w.id}" data-wslot="${slot}" ${t.drying ? 'disabled' : ''}>${w.label}</button>` : ''}</div>`;
  }).join('');
  return `<div class="panel"><div class="ukon">重石と工程</div>${wRow}${wk ? `<div class="list">${wk}</div>` : ''}</div>`;
}

WINS.barrel = ({ slot }) => {
  if (slot >= SHELF) return shelfWin(slot);
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
  const onDisplay = ui.display === slot;
  const sellNote = onDisplay ? (game.isOpen() ? 'いま店先に出している。お客が来るたびに売れる' : '店先に出している。朝になると店が開く') : !game.isOpen() ? '夜は閉店。出しておけば朝に店が開く' : game.lastSaleTick === game.tick ? 'この時間帯のお客はもう来た。出しておけば次の時間帯から売れる' : '';
  const disc = ui.confirm === `discard${slot}`;
  return {
    title: `樽${slot + 1}　${barrelName(b)}`,
    body: `${nav}
    <div class="panel">
      <div><span class="stage-tag ${t.stage}">${t.stageLabel}</span>　${trim(game.barrelAge(b), 1)}日目 ・ 残り${b.portions}個${agingFactor(p, t.ratio) > 1 ? ` ・ <span class="ukon">熟成もの（売り値 ×${trim(agingFactor(p, t.ratio), 2)}）</span>` : p.aging ? ' ・ <span class="hint">寝かせるほど高く売れる</span>' : ''}</div>
      ${t.drying ? `<div class="ukon">${b.smoke ? `${p.smoking.woods[b.smoke.wood].name}の薪で燻している` : `${C.vegetables[b.veg].name}を干している`}（あと${trim(t.drying, 1)}日${b.sunDry ? 'ぶん。晴れの日だけ乾く' : ''}。終わると漬かりはじめる）${b.sunDry && game.weather !== 'sunny' ? `<span class="warn"> 今日は${C.weatherName[game.weather]}で${game.weather === 'rain' ? '乾かない。濡れて質が少し落ちる' : 'あまり乾かない'}</span>` : ''}</div>` : b.smoke ? `<div class="hint">${p.smoking.woods[b.smoke.wood]?.name}の薪で${b.smoke.days}日燻してから漬けた</div>` : b.dry ? `<div class="hint">${b.dry}日干してから漬けた</div>` : ''}
      ${p.region ? `<div class="hint">${p.region}の漬物${p.seasonal ? ` ・ ここまでの平均の温度 ${b.tempC}℃` : ''}${p.place === 'kaon' ? ` ・ ${game.barrelAge(b) < 1 ? '下漬け' : game.barrelAge(b) < 2 ? '本漬け（天秤押し）' : '室入れ'}` : ''}</div>` : ''}
      ${p.umezu ? `<div class="${(b.exposed ?? 0) > C.umezu.safe ? 'warn' : 'hint'}">梅酢: ${(b.exposed ?? 0) > C.umezu.safe ? '梅の頭が梅酢から出ている！ カビやすい' : (b.exposed ?? 0) > 0.1 ? '梅が少し浮いてきた' : '梅はしっかり梅酢に浸かっている'}</div>` : ''}
      ${game.barrelUpgrade(slot) || b.specials?.length ? `<div class="hint">${game.barrelUpgrade(slot) ? '<span class="ukon">杉の木桶</span> ' : ''}${b.specials?.length ? `特別な食材: ${b.specials.map((id) => C.specials[id].name).join('・')}` : ''}</div>` : ''}
      <div class="hint">塩${trim(b.saltPct, 1)}% ・ ${b.place ? C.places[b.place].name : ''} ${b.tempC}℃${adds ? ` ・ ${adds}` : ''}${p.film ? ` ・ 白い膜: <span class="${fv >= C.care.filmVisible ? 'warn' : ''}">${filmWord(fv)}${p.usesNukaBed ? '（ぬか床）' : ''}</span>` : ''}</div>
    </div>
    ${handworkBox(slot, b, p, t)}
    ${tasteBox}
    <div class="row">
      <button class="btn" data-act="taste" data-slot="${slot}" ${tasted ? 'disabled' : ''}>${tasted ? '味見した' : '味見'}</button>
      ${p.umezu ? `<button class="btn" data-act="sink" data-slot="${slot}" ${b.lastSinkTick === game.tick || (b.exposed ?? 0) < 0.05 ? 'disabled' : ''}>重石を直して梅を沈める</button>` : ''}
      ${p.film && !p.usesNukaBed ? `<button class="btn" data-act="care" data-slot="${slot}" ${cared || fv < 0.05 ? 'disabled' : ''}>${cared ? '手入れした' : p.umezu ? '清潔なスプーンでカビを取る' : '手入れ（膜を取る）'}</button>` : ''}
      ${p.usesNukaBed ? '<button class="btn" data-act="openNuka">ぬか床を見る</button>' : ''}
      ${onDisplay ? `<button class="btn" data-act="hideSlot" data-slot="${slot}">店先から下げる</button>` : `<button class="btn main" data-act="sellSlot" data-slot="${slot}">店先に出す</button>`}
      ${t.ratio >= p.window.lo && !t.drying ? `<button class="btn" data-act="shelve" data-slot="${slot}" ${game.shelfFree() < 0 ? 'disabled' : ''}>${game.shelfFree() < 0 ? '棚がいっぱい' : '棚に移す（樽を空ける）'}</button>` : ''}
      ${game.barrelUpgrade(slot) ? '' : `<button class="btn" data-upgrade="sugioke" data-uslot="${slot}" ${game.level().level < C.upgrades.sugioke.level || game.money < C.upgrades.sugioke.cost ? 'disabled' : ''}>杉の木桶に替える（${yen(C.upgrades.sugioke.cost)}）</button>`}
      <button class="btn ghost" data-act="discard" data-slot="${slot}">${disc ? '本当に捨てる' : '捨てる'}</button>
    </div>
    ${sellNote ? `<div class="hint">${sellNote}。</div>` : ''}`,
  };
};

// 樽の一覧
WINS.barrels = () => ({
  title: '樽',
  body: `<div class="list">${game.barrels.map((b, i) => {
    if (!b) return `<button class="item" data-goto="${i}"><span class="grow">樽${i + 1}　<span class="hint">空き樽</span></span><span>＋</span></button>`;
    const t = game.tasteOf(i);
    return `<button class="item${t.stage === 'ripe' ? ' ok' : ''}" data-goto="${i}"><span class="grow">樽${i + 1}${i >= C.barrelsInvest.max ? '（蔵）' : ''}　${barrelName(b)}<br><span class="hint">${trim(game.barrelAge(b), 1)}日目 ・ 残り${b.portions}個${needsCare(b) ? ' ・ <span class="warn">白い膜！</span>' : ''}</span></span><span class="stage-tag ${t.stage}">${t.stageLabel}</span></button>`;
  }).join('')}</div>
  <div class="sec"><h3>棚　<span class="hint">${game.shelf.filter(Boolean).length} / ${game.shelfSlots()} ・ 食べ頃になった樽を移すと、樽が空いて次を仕込める。棚では漬かりも傷みもゆっくり（${Math.round(1 / C.shelf.slow)}分の1）</span></h3>
  <div class="list">${Array.from({ length: game.shelfSlots() }, (_, i) => {
    const b = game.shelf[i];
    if (!b) return `<div class="item"><span class="grow">棚${i + 1}　<span class="hint">空き</span></span></div>`;
    const t = game.tasteOf(SHELF + i);
    return `<button class="item${t.stage === 'ripe' ? ' ok' : ''}" data-goto="${SHELF + i}"><span class="grow">棚${i + 1}　${barrelName(b)}<br><span class="hint">残り${b.portions}個${ui.display === SHELF + i ? ' ・ <span class="ukon">店先に出し中</span>' : ''}</span></span><span class="stage-tag ${t.stage}">${t.stageLabel}</span></button>`;
  }).join('')}</div></div>`,
});

// 仕込み
const kaonT = () => ui.recipe.kaonTemp ?? C.places.kaon?.fixed ?? 40;
const effRecipe = () => {
  const p = C.pickles[ui.recipe.pickle];
  const r = { ...ui.recipe, tempC: C.facilities[ui.recipe.place]?.adjustable ? kaonT() : game.placeTemp(ui.recipe.place) };
  if (p.saltFree) r.saltPct = 0;
  if (p.smoking) r.smoke = { days: ui.recipe.smoke?.days ?? p.smoking.default, wood: ui.recipe.smoke?.wood ?? Object.keys(p.smoking.woods)[0] };
  if (p.weight) r.weights = [{ d: 0, w: C.weight.levels[ui.recipe.weight ?? 'normal'].w }]; // 見立て用
  return p.usesNukaBed ? { ...r, saltPct: game.nuka.salt } : r;
};
const brewCostOf = (r) => game.brewCost({ ...r, saltPct: C.pickles[r.pickle].usesNukaBed || C.pickles[r.pickle].saltFree ? 0 : r.saltPct });
const CAP = () => C.sales.barrelCapacity;
const clampCount = (n) => Math.min(CAP(), Math.max(1, Math.round(Number.isFinite(n) ? n : 1)));
const affKnown = (pickle, id) => Object.keys(game.book).some((k) => { const [pk, , ...ad] = k.split(':'); return pk === pickle && ad.includes(id); });
const affMark = (pickle, id) => (!affKnown(pickle, id) ? '？' : { good: '◎', bad: '✕', neutral: '△' }[affinityOf(pickle, id, C)]);
/** 仕込みの窓の「特別な食材」の札 */
const specialTiles = (r) => {
  const chosen = r.specials ?? [], lvNow = game.level().level, std = game.standardCount(r.pickle);
  return Object.entries(C.specials).filter(([, x]) => !x.pickles || x.pickles.includes(r.pickle)).map(([id, x]) => {
    const on = chosen.includes(id), early = lvNow < x.level;
    const clash = !on && (chosen.length >= C.specialMax || chosen.some((c) => C.specials[c].kind === x.kind));
    return `<button class="tile${on ? ' on' : ''}" data-special="${id}" ${early || clash ? 'disabled' : ''}><b>${x.name}</b><span>${early ? `店のレベル${x.level}から` : `${yen(Math.round((x.cost * r.count) / std / 10) * 10)}・${x.note}`}</span></button>`;
  }).join('');
};
const SALT_DEFAULT = { asazuke: 2.5, takuan: 5, umeboshi: 18 };
/** 漬物を選んだときの塩分（目安の真ん中。全国の漬物は資料の範囲から） */
const saltDefault = (id) => SALT_DEFAULT[id] ?? (C.pickles[id].salt && C.pickles[id].ref ? Math.round(((C.pickles[id].salt.lo + C.pickles[id].salt.hi) / 2) * 2) / 2 : 3);
const SALT_MAX = () => Math.max(15, C.pickles[ui.recipe.pickle]?.salt?.hi ?? 0, ui.recipe.saltPct); // 梅干しは20%まで
WINS.brew = () => {
  const r = effRecipe(), p = C.pickles[r.pickle];
  const empties = game.barrels.map((b, i) => (b ? null : i)).filter((i) => i != null);
  if (!empties.length) return { title: '仕込む', body: '<p>空いている樽がありません。売り切るか、「樽」から捨てると空きます。「店」で樽を増やすこともできます。</p>' };
  if (game.barrels[ui.slot]) ui.slot = empties[0];
  const cost = brewCostOf(r);
  const unknownN = Object.keys(C.pickles).filter((id) => !game.knows(id)).length;
  const pickles = Object.entries(C.pickles).filter(([id]) => game.knows(id)).map(([id, x]) => {
    const can = game.canBrew(id), star = masteryStars(id);
    return `<button class="tile${r.pickle === id ? ' on' : ''}" data-pickle="${id}" ${can.ok ? '' : 'disabled'}>${game.recipeState(id) === 'known' && game.recipes[id].via !== 'start' ? '<i class="tag">新</i>' : ''}<b>${x.hiden ? '<i class="tag">秘伝</i>' : ''}${x.name}${star ? ` <small class="ukon">${star}</small>` : ''}</b>${x.region ? `<span class="ukon">${x.region}</span>` : ''}<span>${can.ok ? `${(x.realDays ?? x.ripeAt) >= 10 ? '長く漬ける' : (x.realDays ?? x.ripeAt) >= 3 ? '数日〜' : '早い'} ・ ${yen(x.price)}${x.portions ? `×${x.portions}` : ''}` : can.error}</span></button>`;
  }).join('') + (unknownN ? `<button class="tile" data-act="openRecipes"><b>？？？</b><span>まだ知らない作り方 ${unknownN}つ（レシピ帳）</span></button>` : '');
  const vegs = p.vegetables.map((id) => { const ok = game.vegAvailable(id), n = game.stockCount(id); return `<button class="tile${r.veg === id ? ' on' : ''}" data-veg="${id}" ${ok ? '' : 'disabled'}>${game.saleVeg() === id ? '<i class="tag">特</i>' : game.inSeason(id) ? '<i class="tag">旬</i>' : ''}<b>${C.vegetables[id].name}</b><span>${ok ? `${yen(game.vegCost(id))}${n ? ` ・ 在庫${n}` : ''}` : esc(game.vegLock(id))}</span></button>`; }).join('');
  const withs = game.withNeeds(r.pickle, r.count ?? game.standardCount(r.pickle)).map(([m, n]) => { const have = game.stockCount(m); return `${C.vegetables[m].name} ${n}個${have >= n ? `<span class="pos">（在庫${have}）</span>` : `<span class="warn">（在庫${have}・「仕入れ」で買う）</span>`}`; });
  const adds = Object.entries(C.additives).map(([id, x]) => { const on = r.additives.includes(id); return `<button class="tile${on ? ' on' : ''}" data-add="${id}" ${!on && r.additives.length >= C.additiveMax ? 'disabled' : ''}><b>${x.name} ${affMark(r.pickle, id)}</b><span>${yen(x.cost)}</span></button>`; }).join('');
  const places = Object.entries(C.places).filter(([id, x]) => x.level <= game.level().level || game.places.includes(id)).map(([id, x]) => { const own = game.places.includes(id); const fixedOut = p.place && p.place !== id; return `<button class="tile${r.place === id ? ' on' : ''}" data-place="${id}" ${own && !fixedOut ? '' : 'disabled'}><b>${x.name}</b><span>${own ? `${x.adjustable ? kaonT() : game.placeTemp(id)}℃` : '未購入（店で買う）'}</span></button>`; }).join('');
  let predict = '';
  if (settings.practice) {
    const dry = p.drying ? (r.dry ?? p.drying.default) : p.smoking ? r.smoke.days : 0; // 干す・燻す日数ぶん後ろにずれる
    const d0 = daysToRipe(r), r0 = ripeRangeDays(r);
    const days = d0 + dry, range = { from: r0.from + dry, to: r0.to + dry, sourFrom: r0.sourFrom + dry };
    let t = simulate({ ...r, dry, quality: game.vegQuality(r.veg), days: d0 });
    if (p.usesNukaBed) t = applyCare(t, { film: game.nuka.film, bed: game.nuka });
    predict = `<div class="panel"><div class="ukon">見立て（練習モード）</div><div>食べ頃まで <b class="ukon">${trim(days, 1)}日</b>${dry ? `<span class="hint">（干す${dry}日を含む）</span>` : ''}（${trim(range.from, 1)}〜${trim(range.to, 1)}日）・ ${trim(range.sourFrom, 1)}日を過ぎると酸っぱすぎ</div>${bars(t, { numbers: true })}</div>`;
  }
  return {
    title: '仕込む',
    body: `
    <div class="sec"><h3>樽</h3><div class="row">${empties.map((i) => `<button class="tile${ui.slot === i ? ' on' : ''}" data-bslot="${i}" style="flex:0 0 auto">樽${i + 1}</button>`).join('')}</div></div>
    <div class="sec"><h3>漬物</h3><div class="tiles">${pickles}</div><div class="hint">作り方: ${p.steps.join(' → ')}　・　温度の目安 ${p.tempHint}</div>${withs.length ? `<div class="hint">いっしょに要る食材: ${withs.join(' ・ ')}</div>` : ''}</div>
    <div class="sec"><h3>野菜　<span class="hint">値段は今日の相場（6個分）。在庫があれば先に使う</span> <button class="btn ghost" data-act="openMarket" style="padding:2px 8px">仕入れ</button></h3><div class="tiles">${vegs}</div><div class="hint">${C.vegetables[r.veg].name}: 水分${Math.round(C.vegetables[r.veg].water * 1000) / 10}% ・ 塩の入り方 ${C.vegetables[r.veg].saltUptake >= 1.1 ? '速い' : C.vegetables[r.veg].saltUptake <= 0.85 ? 'ゆっくり' : 'ふつう'} ・ ${C.vegetables[r.veg].note ?? ''}</div></div>
    <div class="sec"><h3>塩　<span class="hint">目安 ${p.saltHint}</span></h3>
      ${p.saltFree ? `<div class="hint">塩は使わない。前の樽から取り分けた<b class="ukon">種</b>で漬ける（種 ${game.tane[p.starter] ?? 0}）。うまくできた樽から、次の種が取れる。</div>`
        : p.usesNukaBed ? `<div class="hint">ぬか漬けの塩はぬか床の塩分（今 ${trim(game.nuka.salt, 1)}%）。ぬか床の窓で足せる。</div>`
        : `<div class="salt"><button class="stepper" data-salt="-0.5" aria-label="塩を減らす">－</button><input id="salt" type="range" min="1" max="${SALT_MAX()}" step="0.5" value="${r.saltPct}" aria-label="塩分"><button class="stepper" data-salt="0.5" aria-label="塩を増やす">＋</button><output id="saltV">${trim(r.saltPct, 1)}%</output></div>`}</div>
    ${p.smoking ? `<div class="sec"><h3>燻す　<span class="hint">目安 ${p.smoking.ideal[0]}〜${p.smoking.ideal[1]}日。燻すほど香ばしく、燻しすぎるとえぐい（そのあいだ樽はふさがる）</span></h3>
      <div class="tiles">${Object.entries(p.smoking.woods).map(([id, w]) => `<button class="tile${r.smoke.wood === id ? ' on' : ''}" data-wood="${id}"><b>${w.name}</b><span>${w.flavor > 1 ? '香りが強い' : w.flavor < 1 ? '香りはひかえめ' : 'ふつう'}</span></button>`).join('')}</div>
      <div class="count"><button class="stepper" data-smoke="-1" aria-label="1日減らす">－</button><output class="ukon" style="min-width:4em;text-align:center">${r.smoke.days}日</output><button class="stepper" data-smoke="1" aria-label="1日増やす">＋</button></div></div>` : ''}
    ${p.seasonal ? '<div class="hint">季節をまたいで熟成する。温度は置き場所の温度の平均になる（夏の暑さで傷みやすい。塩をケチらないこと）。</div>' : ''}
    ${p.drying ? `<div class="sec"><h3>干す　<span class="hint">目安 ${p.drying.ideal[0]}〜${p.drying.ideal[1]}日。干すほど食感と塩味が締まり、傷みにくい（そのあいだ樽はふさがる）。天日干しは晴れの日だけ乾き、雨で止まる（冬の寒風はよく乾く）。今日は${C.weatherName[game.weather]}・明日は${C.weatherName[game.tomorrow] ?? '？'}</span></h3>
      <div class="count"><button class="stepper" data-dry="-1" aria-label="1日減らす">－</button><output class="ukon" style="min-width:4em;text-align:center">${r.dry ?? p.drying.default}日</output><button class="stepper" data-dry="1" aria-label="1日増やす">＋</button>
      <span class="presets">${[0, 3, 5, 7, 10, 14].filter((n) => n <= p.drying.max).map((n) => `<button class="tile${(r.dry ?? p.drying.default) === n ? ' on' : ''}" data-dryset="${n}">${n}</button>`).join('')}</span></div></div>` : ''}
    ${p.umezu ? '<div class="hint">梅は梅酢に浸かっていればカビにくい。毎日「樽」から重石を直して沈めよう。カビが出たら清潔なスプーンで取る。</div>' : ''}
    <div class="sec"><h3>調味（${C.additiveMax}つまで）　<span class="hint">◎合う △ふつう ✕合わない ？まだわからない</span></h3><div class="tiles">${adds}</div></div>
    <div class="sec"><h3>特別な食材（${C.specialMax}つまで）　<span class="hint">値段は今の個数ぶん。良い材料には、お客も高く払う</span></h3><div class="tiles wide">${specialTiles(r)}</div></div>
    ${p.weight ? `<div class="sec"><h3>重石　<span class="hint">重いほど水が早く上がって傷みにくい。水が上がったあとも重いままだと野菜がつぶれる（樽の窓で替えられる）</span></h3><div class="tiles">${Object.entries(C.weight.levels).map(([k, l]) => `<button class="tile${(r.weight ?? 'normal') === k ? ' on' : ''}" data-wsel="${k}"><b>${l.name}</b><span>野菜の${l.w}倍</span></button>`).join('')}</div></div>` : ''}
    ${p.work.length ? `<div class="sec"><h3>工程</h3><div class="hint">${p.work.map((w) => `${w.label}（${w.window[0]}〜${w.window[1]}日目）: ${w.note}`).join('<br>')}</div></div>` : ''}
    <div class="sec"><h3>置き場所　<span class="hint">外は今 ${game.ambientTemp()}℃${p.place ? ` ・ ${C.places[p.place].name}で漬ける` : ''}</span></h3><div class="tiles">${places}</div>
      ${C.facilities[r.place]?.adjustable ? `<div class="count"><span class="hint">${C.facilities[r.place].name}の温度</span><button class="stepper" data-kaon="-1" aria-label="1℃下げる">－</button><output class="ukon" style="min-width:4em;text-align:center">${kaonT()}℃</output><button class="stepper" data-kaon="1" aria-label="1℃上げる">＋</button>${p.bestTemp ? `<span class="hint">いちばん良いのは${p.bestTemp[0]}〜${p.bestTemp[1]}℃</span>` : ''}</div>` : ''}</div>
    <div class="sec"><h3>個数　<span class="hint">標準 ${game.standardCount(r.pickle)}個 ・ 1樽に最大 ${CAP()}個。多く仕込むほど材料代が増え、売れ残ると酸っぱくなる</span></h3>
      <div class="count"><button class="stepper" data-count="-10" aria-label="10個減らす">−10</button><button class="stepper" data-count="-1" aria-label="1個減らす">－</button><input id="count" type="number" inputmode="numeric" min="1" max="${CAP()}" step="1" value="${r.count}" aria-label="個数"><span class="unit">個</span><button class="stepper" data-count="1" aria-label="1個増やす">＋</button><button class="stepper" data-count="10" aria-label="10個増やす">＋10</button>
      <span class="presets">${[6, 12, 18, 24, 36, 48, 60].filter((n) => n <= CAP()).map((n) => `<button class="tile${r.count === n ? ' on' : ''}" data-countset="${n}">${n}</button>`).join('')}</span></div></div>
    ${predict}
    <div class="row end"><span class="hint">所持金 ${yen(game.money)}</span><button class="btn main" data-act="brew" ${cost > game.money ? 'disabled' : ''}>樽${ui.slot + 1}に${r.count}個仕込む（${yen(cost)}）</button></div>`,
  };
};

// 注文・依頼（売るの窓）
function ordersBox(filled) {
  const board = game.orders.board;
  if (!board.length) return game.day() < C.orders.firstDay ? '' : '<div class="hint">注文はまだ来ていない（ときどき依頼主が頼みに来る）。</div>';
  const rows = board.map((o) => {
    const c = game.client(o.client), p = C.pickles[o.pickle];
    const head = `<b>${esc(c.name)}</b>　${p.name} ${o.count}個 ・ お礼 ${yen(o.reward)} ・ 出来${o.minSat}以上${c.judge ? `（${C.customers.find((x) => x.id === c.judge).name}の舌で）` : ''}`;
    if (o.state === 'offer') {
      const can = game.canBrew(o.pickle);
      return `<div class="item"><span class="grow">${head}<br><span class="hint">${esc(game.orderText(o))}${can.ok ? '' : ` ・ <span class="warn">${esc(can.error)}</span>`}</span></span><span class="row"><button class="btn main" data-order="accept" data-oid="${o.id}">受ける</button><button class="btn ghost" data-order="decline" data-oid="${o.id}">断る</button></span></div>`;
    }
    const left = o.due - game.day();
    const fits = filled.filter((i) => game.vessel(i).pickle === o.pickle).map((i) => {
      const b = game.vessel(i), sat = game.orderSat(o, i);
      return `<button class="btn${sat >= o.minSat && b.portions >= o.count ? ' main' : ''}" data-order="deliver" data-oid="${o.id}" data-slot="${i}">${vname(i)}から納める（出来 ${Math.round(sat)}・${b.portions}個）</button>`;
    }).join('');
    return `<div class="item ok"><span class="grow">${head}<br><span class="${left <= 2 ? 'warn' : 'hint'}">期日まであと${left}日</span>${fits ? '' : `<span class="hint"> ・ ${p.name}を仕込んで、${o.count}個そろえて納める</span>`}</span><span class="row">${fits}</span></div>`;
  }).join('');
  return `<div class="sec"><h3>注文　<span class="hint">受けられるのは${C.orders.maxActive}つまで。期日を過ぎると評判が下がる</span></h3><div class="list">${rows}</div></div>`;
}

// 売る
WINS.sell = () => {
  const filled = [...game.barrels.map((b, i) => (b ? i : null)), ...game.shelf.map((b, i) => (b ? SHELF + i : null))].filter((i) => i != null);
  if (!filled.length) return { title: '売る', body: `${ordersBox(filled)}<p>売れる樽がありません。まず「仕込む」。</p>` };
  const now = !game.isOpen() ? '夜は閉店。出しておけば朝に店が開く。' : game.lastSaleTick === game.tick ? 'この時間帯のお客はもう来た。出しておけば次の時間帯から売れる。' : '出すとすぐ店が開き、この時間帯のお客が順に来る。';
  return {
    title: '店先に出す',
    body: `${ordersBox(filled)}<div class="hint">店先に出した樽は、店が開いている朝・昼・夕に、お客が来るたびに売れる（来る客は天気と評判しだい。時間帯ごとに入れ替わる）。${now}</div>
    <div class="list">${filled.map((i) => {
      const b = game.vessel(i), t = game.tasteOf(i), on = ui.display === i;
      return `<div class="item${t.stage === 'ripe' ? ' ok' : ''}${on ? ' on' : ''}"><span class="grow">${vname(i)}　${barrelName(b)}${on ? ' <span class="ukon">出し中</span>' : ''}<br><span class="hint">${trim(game.barrelAge(b), 1)}日目 ・ 残り${b.portions}個 ・ 定価 ${yen(C.pickles[b.pickle].price)}${agingFactor(C.pickles[b.pickle], t.ratio) > 1 ? ` ・ <span class="ukon">熟成もの ×${trim(agingFactor(C.pickles[b.pickle], t.ratio), 2)}</span>` : ''}</span></span><span class="stage-tag ${t.stage}">${t.stageLabel}</span>${on ? `<button class="btn" data-act="hideSlot" data-slot="${i}">下げる</button>` : `<button class="btn main" data-act="sellSlot" data-slot="${i}">店先に出す</button>`}</div>`;
    }).join('')}</div>`,
  };
};

// ぬか床
WINS.nuka = () => {
  const n = game.nuka;
  const stirred = n.lastStirTick === game.tick, today = n.lastStirDay === game.day();
  const bar = (label, v, col, w) => `<div class="bar"><span>${label}</span><i><s style="width:${Math.min(100, v * 100)}%;background:${col}"></s></i><span>${w}</span></div>`;
  const sute = game.daysSinceSute(), suteLate = sute > C.nuka.suteEveryDays;
  const groups = Object.entries(NUKA_WHEN).map(([when, title]) => {
    const btns = NUKA_CARE.filter((a) => a.when === when && (!a.needsWisdom || game.knowsWisdom(a.needsWisdom))).map((a) => {
      const done = n.cared?.[a.id] === game.tick, full = a.effects.salt > 0 && n.salt >= C.nuka.maxSalt;
      return `<button class="tile${a.lore ? ' lore' : ''}" data-care="${a.id}" title="${a.note}" ${done || full || game.money < a.cost ? 'disabled' : ''}>${a.lore ? '<i class="tag">伝承</i>' : ''}<b>${a.name}</b><span>${done ? 'した' : a.cost ? yen(a.cost) : 'ただ'}・${a.note}</span></button>`;
    }).join('');
    return btns ? `<div class="sec"><h3>${title}</h3><div class="tiles wide">${btns}</div></div>` : '';
  }).join('');
  const wz = game.wisdomFor();
  const granny = wz ? `<div class="panel granny"><span class="ukon">${esc(game.grannyDef.name)}の知恵</span>「${esc(wz.text)}」</div>` : '';
  return {
    title: 'ぬか床',
    body: `${granny}<div class="panel">
      <div>塩分 <b class="ukon">${trim(n.salt, 1)}%</b> ・ 店の中 ${game.ambientTemp()}℃（適温20〜25℃） ・ ${today ? '今日はかき混ぜた' : '<span class="warn">今日はまだかき混ぜていない</span>'} ・ 捨て漬けを替えて${Math.floor(sute)}日${suteLate ? '（<span class="warn">そろそろ替えどき</span>）' : ''}</div>
      <div class="bars">${bar('酸味', n.sour, '#d29a2c', n.sour < 0.25 ? 'ちょうどいい' : n.sour < 0.5 ? 'やや酸っぱい' : n.sour < 0.8 ? '酸っぱい' : 'かなり酸っぱい')}
      ${bar('白い膜', n.film, '#9a8f7c', filmWord(n.film))}
      ${bar('水っぽさ', n.water, '#5a86b0', n.water < 0.25 ? 'しまっている' : n.water < 0.5 ? 'やや水っぽい' : '水っぽい')}
      ${bar('傷み', n.rot, '#8a3a2a', n.rot < 0.1 ? 'なし' : n.rot < 0.3 ? '少しにおう' : n.rot < 0.6 ? '傷みかけ' : '傷んでいる')}
      ${bar('旨味', n.umami, '#c9822d', n.umami < 0.1 ? 'ふつう' : n.umami < 0.4 ? '旨味あり' : 'たっぷり')}
      ${bar('熟成度', n.maturity, '#6b4a7a', n.maturity < 0.3 ? '若い床' : n.maturity < 0.7 ? '育ってきた' : n.maturity < 1 ? 'いい床' : '最高の床')}</div></div>
    <div class="row"><button class="btn main" data-act="stir" ${stirred ? 'disabled' : ''}>${stirred ? 'かき混ぜた' : '毎日かき混ぜる'}</button></div>
    ${groups}
    <div class="hint">毎日かき混ぜると床が育ち、ぬか漬けの風味が深くなる。放っておくと、白い膜 → 酸っぱい → 傷む と進む。26℃以上は特に早い。ぬか漬けを漬けるほど野菜の水で床が水っぽくなる。</div>`,
  };
};

// 店
WINS.shop = () => {
  const rep = Math.round(game.reputation), next = game.nextBarrelCost();
  const lvNow = game.level().level;
  const items = Object.entries(C.facilities).filter(([, x]) => x.cost > 0).map(([id, x]) => {
    const own = game.places.includes(id), early = lvNow < x.level;
    const note = x.fixed != null ? `いつでも${x.fixed}℃で漬けられる` : x.note;
    return `<div class="item${own ? ' ok' : ''}"><span class="grow">${x.name}<br><span class="hint">${early ? `店のレベル${x.level}で買える ・ ` : ''}${note}</span></span>${own ? '<span class="pos">購入済み</span>' : `<button class="btn gold" data-buy="${id}" ${early || game.money < x.cost ? 'disabled' : ''}>${yen(x.cost)}</button>`}</div>`;
  });
  const bmax = game.barrelMax(), bfull = game.barrels.length >= bmax;
  items.push(`<div class="item"><span class="grow">樽を増やす<br><span class="hint">今${game.barrels.length}個（今のレベルで${bmax}個まで・最大${C.barrelsInvest.max}個）</span></span>${next == null ? '<span class="hint">これ以上置けない</span>' : bfull ? '<span class="hint">レベルが上がると置ける</span>' : `<button class="btn gold" data-buy="barrel" ${game.money < next ? 'disabled' : ''}>${yen(next)}</button>`}</div>`);
  const L = game.level(), nx = nextLevelXp(game.xp), prevXp = L.extra ? C.levels.at(-1).xp + L.extra * C.levelAfterLast : L.xp;
  const nextDef = C.levels.find((l) => l.level === L.level + 1);
  const lvBox = `<div class="sec"><h3>店のレベル</h3><div class="row"><b class="lvbig">Lv.${L.level}</b><span class="grow"><b class="ukon">${L.title}${L.extra ? ` ＋${L.extra}` : ''}</b><br><span class="hint">${L.line}</span></span></div>
    <div class="row"><div class="meter"><i style="width:${Math.round(((game.xp - prevXp) / (nx - prevXp)) * 100)}%"></i></div><span class="hint">経験 ${Math.floor(game.xp)} / ${nx}</span></div>
    <div class="hint">売ると経験がたまる（とても満足されると多め）。ひらめき・図鑑・初めての成功でも増える。${nextDef?.opens.length ? `次のレベルで: ${nextDef.opens.join('・')}` : ''}</div></div>`;
  const regs = game.regulars.length ? game.regulars.map((r) => {
    const known = r.visits >= C.bond.prefAfter, c = C.customers.find((x) => x.id === r.type);
    const chapters = game.storiesOf(r).filter((ch) => (r.chapters ?? []).includes(ch.bond));
    const next = game.storiesOf(r).find((ch) => ch.bond > (r.bond ?? 0));
    return `<li><b style="font-weight:400" class="ukon">${esc(r.name ?? game.regularName(r.id))}</b>${r.reformed ? '（元・難癖のお客）' : ''}　<span class="hint">${known ? `${c.name}・${AGES[r.age]?.name ?? ''}` : '好みはまだわからない'} ・ ${r.visits}回目 ・ 絆 ${'♥'.repeat(Math.min(10, r.bond ?? 0)) || 'ー'}${next ? `（あと${next.bond - (r.bond ?? 0)}回とても満足させると話が聞ける）` : ''}</span>
      ${chapters.map((ch) => `<details><summary>${esc(ch.title)}</summary><div class="hint">${esc(ch.text)}</div></details>`).join('')}</li>`;
  }).join('') : '<li class="hint">まだいない。とても満足したお客がときどき常連になる。</li>';
  const staff = STAFF.map((st) => {
    const has = game.staff.includes(st.id), early = lvNow < st.level;
    return `<div class="item${has ? ' ok' : ''}"><span class="grow">${st.name}　<span class="hint">日給 ${yen(st.wage)}</span><br><span class="hint">${early ? `店のレベル${st.level}で雇える ・ ` : ''}${st.note}</span></span>${has ? '<button class="btn ghost" data-fire="' + st.id + '">やめてもらう</button>' : `<button class="btn gold" data-hire="${st.id}" ${early || game.money < st.hire ? 'disabled' : ''}>雇う ${yen(st.hire)}</button>`}</div>`;
  }).join('');
  const farms = Object.entries(C.vegetables).filter(([, v]) => v.contract).map(([id, v]) => {
    const has = game.contracts.includes(id), early = lvNow < v.contract.level;
    return `<div class="item${has ? ' ok' : ''}"><span class="grow">${v.contract.farmer}と契約<br><span class="hint">${early ? `店のレベル${v.contract.level}で契約できる ・ ` : ''}${v.name}が仕入れられるようになる</span></span>${has ? '<span class="pos">契約済み</span>' : `<button class="btn gold" data-contract="${id}" ${early || game.money < v.contract.cost ? 'disabled' : ''}>${yen(v.contract.cost)}</button>`}</div>`;
  }).join('');
  const offer = game.peddlerOffer();
  const peddler = offer ? `<div class="sec"><h3>行商人が来ている（今日だけ）</h3><div class="item"><span class="grow">「${C.pickles[offer.pickle].name}の作り方の巻物、どうだい。ひいひいじいさんの代からの…」<br><span class="hint">買うとすぐ作り方を覚える（挑めるのは店のレベル${C.pickles[offer.pickle].level}から）</span></span><button class="btn gold" data-act="buyRecipe" ${game.money < offer.price ? 'disabled' : ''}>${yen(offer.price)}</button></div></div>` : '';
  return {
    title: '店',
    body: `${lvBox}<div class="sec"><h3>評判</h3><div class="row">${stars(rep)}<div class="meter"><i style="width:${rep}%"></i></div><b>${rep}</b></div>
      <div class="hint">満足したお客が多いほど上がり、評判が高いほど客が来る。傷んだものを出すと大きく下がる。</div></div>
    <div class="sec"><h3>常連（${game.regulars.length}/${C.regulars.max}人）</h3><ul style="margin:0;padding-left:1.2em;display:grid;gap:4px">${regs}</ul><div class="hint">常連を「とても満足」（${C.bond.sat}以上）させるたびに絆が深まり、話を聞かせてくれる（評判も上がる）。${C.bond.prefAfter}回来ると好みがわかる。</div></div>
    ${peddler}
    <div class="sec"><h3>店の格上げ　<span class="hint">順番に。一度すればずっと効く</span></h3><div class="list">${upgradeRows('shop')}</div></div>
    <div class="sec"><h3>宣伝　<span class="hint">しばらくのあいだ効く。何度でもできる</span></h3><div class="list">${upgradeRows('campaign')}</div></div>
    <div class="sec"><h3>従業員　<span class="hint">お給料は毎朝。払えないと辞めてしまう</span></h3><div class="list">${staff}</div></div>
    <div class="sec"><h3>契約農家</h3><div class="list">${farms}</div></div>
    ${game.claimer.visits || game.claimer.reformedTick >= 0 ? `<div class="sec"><h3>難癖のお客</h3><div class="hint">${game.tick < game.claimer.bannedUntil ? `出入り禁止中（${Math.ceil((game.claimer.bannedUntil - game.tick) / C.calendar.ticksPerDay)}日後に戻ってくるかも）` : game.claimer.visits ? `来た回数 ${game.claimer.visits} ・ 言い負かした回数 ${game.claimer.wins} ・ 図太さ ${'●'.repeat(game.claimer.nerve)}${'○'.repeat(C.claimer.maxNerve - game.claimer.nerve)}` : 'いまは静か。'} ・ 来る確率 ${Math.round(game.claimerChance() * 100)}%（時間帯ごと）</div></div>` : ''}
    <div class="sec"><h3>投資　<span class="hint">所持金 ${yen(game.money)}</span></h3><div class="list">${items.join('')}</div></div>`,
  };
};

/** 店の窓の「店の格上げ」「宣伝」の行 */
function upgradeRows(group) {
  const lvNow = game.level().level;
  return Object.entries(C.upgrades).filter(([, u]) => u.group === group).map(([id, u]) => {
    const has = game.upgrades.includes(id), left = game.campaignLeft(id), early = lvNow < u.level, need = u.requires && !game.upgrades.includes(u.requires);
    const status = has ? '<span class="pos">済み</span>' : left > 0 ? `<span class="pos">あと${Math.ceil(left)}日</span>` : `<button class="btn gold" data-upgrade="${id}" ${early || need || game.money < u.cost ? 'disabled' : ''}>${yen(u.cost)}</button>`;
    return `<div class="item${has ? ' ok' : ''}"><span class="grow">${u.name}<br><span class="hint">${early ? `店のレベル${u.level}から ・ ` : need ? `先に「${C.upgrades[u.requires].name}」 ・ ` : ''}${u.note}</span></span>${status}</div>`;
  }).join('');
}

// 帳面（記録・図鑑・お客）
WINS.book = ({ tab = 'log' }) => {
  const tabs = [['story', '物語'], ['recipes', 'レシピ帳'], ['atlas', '全国めぐり'], ['wisdom', '知恵袋'], ['log', '販売の記録'], ['book', '組み合わせ'], ['guests', 'お客の好み']].map(([k, l]) => `<button class="${tab === k ? 'on' : ''}" data-tab="${k}">${l}</button>`).join('');
  let body = '';
  if (tab === 'story') {
    body = storyTab();
  } else if (tab === 'wisdom') {
    const gr = game.granny(), ws = game.wisdomList();
    body = gr ? `<div class="hint">${esc(game.grannyDef.name)}（${esc(game.grannyDef.title)}）をとても満足させるたびに絆が深まり、知恵と作り方を教えてくれる。絆 ${'♥'.repeat(Math.min(10, gr.bond ?? 0)) || 'ー'}</div>
      <div class="list">${ws.map((w) => `<div class="item"><span class="grow">${w.lore ? '<i class="tag">伝承</i> ' : ''}「${esc(w.text)}」${w.lore ? '<br><span class="hint">昔から言われていること。効果は確かめられていない。</span>' : ''}</span></div>`).join('')}</div>
      <div class="hint">まだ教わっていない知恵: ${C.wisdomTotal - ws.length}</div>` : '<p class="hint">まだ知恵袋のおばあちゃんに出会っていない。</p>';
  } else if (tab === 'recipes') {
    body = recipeBook();
  } else if (tab === 'atlas') {
    body = atlasTab();
  } else if (tab === 'log') {
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
    const sh = game.ageShares(), trendNow = Math.max(C.trend.saltMin, C.trend.saltPerYear * (game.year() - 1));
    body = `<div class="hint">お客は名前なしでランダムに来て、次のどれかの好みを持っている。${note}雨・雪の日は客が減る。</div>
      <div class="panel"><div class="ukon">年代（${game.year()}年目）</div><div class="hint">${Object.entries(AGES).map(([k, a]) => `${a.name} ${Math.round(sh[k] * 100)}%（塩味の好み ${a.salt > 0 ? '+' : ''}${a.salt}）`).join(' ・ ')}</div>
      <div class="hint">減塩の流れ: 年がたつほど若いお客が増え、みんなの好む塩味も下がっていく（今 ${trendNow}）。しょっぱい古漬けは、だんだん売れにくくなる。</div></div>
      <div class="list">${C.customers.map((c) => `<div class="item"><span class="grow"><b style="font-weight:400" class="ukon">${c.name}</b><br><span class="hint">${c.hint}</span></span></div>`).join('')}</div>`;
  }
  return { title: '帳面', body: `<div class="tabs">${tabs}</div>${body}` };
};

// レシピ帳（段階C）: 知っている作り方と、まだ知らない作り方の噂
const masteryStars = (id) => { const n = game.recipes[id]?.made ?? 0; return n ? '★'.repeat(Math.min(MASTERY_NAMES.length - 1, Math.ceil(game.mastery(id) * (MASTERY_NAMES.length - 1)))) || '★' : ''; };
const masteryName = (id) => MASTERY_NAMES[Math.min(MASTERY_NAMES.length - 1, Math.ceil(game.mastery(id) * (MASTERY_NAMES.length - 1)))];
const VIA = { start: 'はじめから', condition: 'ひらめき', failure: '失敗から', taught: '教わった', bought: '行商人から', letter: '便りで' };

// 全国めぐり: 資料（data/prefectures.js）の47都道府県の漬物を、地方ごとに並べる。作ると印がつく
const REF_TO_PICKLE = Object.fromEntries(Object.entries(C.pickles).filter(([, p]) => p.ref).map(([id, p]) => [p.ref, id]));
function atlasStatus(d) {
  if (NOT_PLAYABLE[d.id]) return { tag: '伝説', cls: 'raw', note: NOT_PLAYABLE[d.id] };
  const id = REF_TO_PICKLE[d.id];
  if (!id) return { tag: '参考', cls: 'raw', note: '資料に参考として載っているもの（ゲームでは作れない）' };
  const st = game.recipeState(id);
  return st === 'learned' ? { tag: '作った', cls: 'ripe', id } : st === 'known' ? { tag: '知っている', cls: 'over', id } : { tag: '未知', cls: 'raw', id, hidden: true };
}
function atlasTab() {
  const all = PREFECTURE_PICKLES.map((d) => ({ d, s: atlasStatus(d) }));
  const prefs = [...new Set(PREFECTURE_PICKLES.map((d) => d.prefecture))];
  const madePrefs = prefs.filter((pr) => all.some((x) => x.d.prefecture === pr && x.s.tag === '作った')).length;
  const regions = game.regionList().map((r) => {
    const rows = all.filter((x) => x.d.region === r).map(({ d, s }) => {
      const show = !s.hidden || game.regions.includes(r);
      const head = `<b>${esc(d.prefecture)}</b> ${s.hidden && !game.regions.includes(r) ? '<b class="q">？？？</b>' : esc(d.name)} <span class="stage-tag ${s.cls}">${s.tag}</span>`;
      const body = !show ? `<span class="hint">${esc(d.kind)}。地方の枠に「${esc(r)}」を入れると、便りが届くかも</span>`
        : s.hidden ? `<span class="hint">${esc(d.kind)}。${esc(d.game_idea)}（まだ便りが来ていない）</span>`
        : `<span class="hint">${esc(d.kind)} ・ ${esc(d.process)}${d.numbers ? ` ・ 数値: ${esc(d.numbers)}` : ''}${s.note ? `<br>${esc(s.note)}` : ''}<br>出典: ${esc(d.source)}</span>`;
      return `<div class="item recipe${s.tag === '作った' ? ' ok' : ''}"><span class="grow">${head}<br>${body}</span></div>`;
    }).join('');
    const made = all.filter((x) => x.d.region === r && x.s.tag === '作った').length, n = all.filter((x) => x.d.region === r && x.s.id).length;
    return `<div class="panel"><div class="ukon">${r} ${game.regions.includes(r) ? '（枠に入っている）' : ''} ・ 作った ${made} / ${n}</div><div class="list">${rows}</div></div>`;
  }).join('');
  return `<div>作った都道府県 <b class="ukon">${madePrefs}</b> / ${prefs.length}</div>
    <div class="hint">全国の漬物の資料（出典つき）。作り方を覚えて売り、「うまい！」と言わせると「作った」になる。数値の記載がないものは、ゲームでは仮の数値で作れる。</div>${regions}`;
}
function recipeBook() {
  const lv = game.level().level;
  const ids = Object.keys(C.pickles);
  const filled = ids.filter((id) => game.recipeState(id) === 'learned').length;
  const affTotal = ids.length * Object.keys(C.additives).length, affFound = ids.reduce((n, id) => n + Object.keys(C.additives).filter((a) => affKnown(id, a)).length, 0);
  const bestOf = (id) => Math.max(0, ...Object.entries(game.book).filter(([k]) => k.startsWith(`${id}:`)).map(([, e]) => e.best));
  const letters = ids.filter((id) => C.pickles[id].unlock?.via === 'letter' && game.recipeState(id) === 'unknown');
  const cards = ids.filter((id) => !letters.includes(id)).map((id) => {
    const p = C.pickles[id], st = game.recipeState(id), rec = game.recipes[id];
    if (st === 'unknown') {
      const u = p.unlock, heard = lv >= (u.hintLevel ?? 1);
      return `<div class="item recipe unknown"><span class="grow"><b class="q">？？？</b><br><span class="hint">${heard ? `噂: ${esc(u.hint)}` : `まだ噂も聞こえてこない（店のレベル${u.hintLevel}になると…）`}</span></span></div>`;
    }
    const can = game.canBrew(id);
    const head = `${p.hiden ? '<i class="tag">秘伝</i> ' : ''}<b>${p.name}</b> ${st === 'learned' ? `<span class="ukon">${masteryStars(id)} ${masteryName(id)}</span>` : '<span class="stage-tag raw">？ まだ成功していない</span>'}`;
    const info = `<span class="hint">${VIA[rec.via] ?? ''}${rec.via !== 'start' ? `（${rec.day}日目）` : ''} ・ 作り方: ${p.steps.join(' → ')} ・ 塩 ${p.saltHint} ・ ${p.tempHint}</span>`;
    const affs = Object.keys(C.additives).map((a) => (affKnown(id, a) ? `${C.additives[a].name}${{ good: '◎', bad: '✕', neutral: '△' }[affinityOf(id, a, C)]}` : null)).filter(Boolean);
    const affLine = `<br><span class="hint">調味の相性（${affs.length}/${Object.keys(C.additives).length}）: ${affs.length ? affs.join(' ') : 'まだわからない（調味を入れて売るとわかる）'}</span>`;
    const made = affLine + (st === 'learned' ? `<br><span class="hint">うまくいった樽 ${rec.made} ・ いちばん良かった満足 ${Math.round(bestOf(id))}</span>` : '');
    const btn = can.ok ? `<button class="btn" data-act="tryRecipe" data-id="${id}">仕込む</button>` : `<span class="hint">${can.error}</span>`;
    return `<div class="item recipe${st === 'learned' ? ' ok' : ''}"><span class="grow">${head}<br>${info}${made}</span>${btn}</div>`;
  }).join('');
  const slots = game.regionSlots(), regs = game.regionList();
  const regionBox = `<div class="panel"><div class="ukon">地方の枠 ${game.regions.length} / ${slots}</div><div class="hint">${slots ? '' : '店のレベル3から地方の漬物に挑める。'}${regs.map((r) => (game.regions.includes(r) ? `<b class="ukon">${r}</b>` : game.regions.length < slots ? `<button class="btn" data-region="${r}" style="padding:2px 8px">${r}に挑む</button>` : r)).join(' ・ ')}</div>
    <div class="hint">枠に入れた地方からは${C.letterEvery}日ごとに作り方の便りが届き、その地方の食材も取り寄せられる。まだ便りの来ていない全国の漬物 ${letters.length}（「全国めぐり」で見られる）</div></div>`;
  return `${regionBox}<div>埋まった作り方 <b class="ukon">${filled}</b> / ${ids.length} ・ わかった調味の相性 <b class="ukon">${affFound}</b> / ${affTotal}</div>
    <div class="hint">売って「うまい！」と言わせると埋まる。同じ作り方でうまくいくほど腕が上がり、風味と食感が良くなる（${MASTERY_NAMES.join(' → ')}）。「？？？」は、噂を手がかりに材料・季節・温度・日数を組み合わせるとひらめく。</div>
    <div class="list">${cards}</div>`;
}

// 難癖のお客（クレーマー）への対応
WINS.claim = (w) => {
  const k = game.claimer;
  if (w.result) {
    const r = w.result;
    return {
      title: r.win === false ? '言い負かされた…' : r.reformed ? 'まさかの展開' : r.banned ? '出入り禁止' : '難癖のお客、退散',
      body: `<div class="idea"><p>${esc(r.line)}</p>
        <div class="hint">評判 <span class="${r.rep > 0 ? 'pos' : r.rep < 0 ? 'neg' : ''}">${r.rep > 0 ? '+' : ''}${trim(r.rep, 1)}</span>${r.reformed ? '' : ` ・ 相手の図太さ ${'●'.repeat(k.nerve)}${'○'.repeat(C.claimer.maxNerve - k.nerve)}`}</div></div>
        <div class="row end"><button class="btn main" data-act="closeWin">はい</button></div>`,
    };
  }
  const c = game.claim;
  if (!c) return { title: '難癖のお客', body: '<p class="hint">もう帰ったようだ。</p>' };
  const opts = game.claimOptions().map((o) => `<button class="tile" data-claim="${o.id}" ${o.ok ? '' : 'disabled'}><b>${o.name}${o.p != null ? ` <small class="ukon">${Math.round(o.p * 100)}%</small>` : ''}</b><span>${o.ok ? o.note : o.reason}</span></button>`).join('');
  return {
    title: '難癖のお客がきた！',
    body: `<div class="panel claim"><div class="ukon">難癖のお客（${k.visits}回目）</div>${c.lines.map((l) => `<p class="bubble">「${esc(l)}」</p>`).join('')}</div>
      <div class="sec"><h3>どうする？　<span class="hint">閉じると「聞こえないふり」（評判が下がる）</span></h3><div class="tiles wide">${opts}</div></div>
      <div class="hint">図太さ ${'●'.repeat(k.nerve)}${'○'.repeat(C.claimer.maxNerve - k.nerve)}（図太いほどよく来る。言い負かし続けると…？）。「店」で備えの品も買える。</div>`,
  };
};

// 難癖のお客が改心した
WINS.reformed = ({ e }) => ({
  title: 'まさかの展開',
  body: `<div class="idea"><div class="name">難癖のお客が常連になった</div><p>「${esc(e.line)}」</p><div class="hint">（しばらくすると、別の難癖のお客が現れるらしい）</div></div>
    <div class="row end"><button class="btn main" data-act="closeWin">…どうも</button></div>`,
});

// ひらめいた
WINS.idea = ({ e }) => {
  const p = C.pickles[e.pickle];
  const head = { failure: '失敗は発見のもと', taught: '教わった！', bought: '巻物を手に入れた' }[e.via] ?? 'ひらめいた！';
  return {
    title: head,
    body: `<div class="idea"><div class="bulb" aria-hidden="true">${e.via === 'failure' ? '！？' : '💡'}</div><div class="name">${p.name}</div>
      <p>${esc(e.line)}</p>
      <div class="hint">作り方: ${p.steps.join(' → ')} ・ 塩 ${p.saltHint} ・ ${p.tempHint}</div>
      ${e.tooEarly ? `<p class="warn">${TOO_EARLY.replace('{level}', e.tooEarly)}</p>` : '<p class="ukon">レシピ帳に載った。仕込みの窓から選べる。成功させると「？」が埋まる。</p>'}</div>
      <div class="row end"><button class="btn" data-act="openRecipes">レシピ帳を見る</button>${e.tooEarly ? '' : `<button class="btn main" data-act="tryRecipe" data-id="${e.pickle}">さっそく仕込む</button>`}</div>`,
  };
};

// レベルが上がった
WINS.levelup = ({ e }) => ({
  title: `店のレベルが上がった！`,
  body: `<div class="idea"><div class="name">Lv.${e.level}　${e.title}</div><p>${esc(e.line)}</p>
    ${e.opens?.length ? `<div class="panel"><div class="ukon">開いたもの</div><ul style="margin:4px 0 0;padding-left:1.2em">${e.opens.map((o) => `<li>${o}</li>`).join('')}</ul></div>` : ''}</div>
    <div class="row end"><button class="btn main" data-act="closeWin">よし！</button></div>`,
});

/** ゲームからの知らせ（レベル・ひらめき・あと一歩・図鑑が埋まった）を受け取って、順に見せる */
function collectEvents() { ui.pending.push(...game.popEvents()); }
function flushEvents() {
  collectEvents();
  while (ui.pending.length && !ui.win && !ui.busy) {
    const e = ui.pending.shift();
    if (e.type === 'almost') {
      say(`${ALMOST[e.missing] ?? ALMOST.stage}${ALMOST_TAIL[ui.almostN++ % ALMOST_TAIL.length]}`, '店主');
      floatText('…？', 384, 150);
      continue;
    }
    if (e.type === 'saga') { sound.se('regular'); openWin('saga', { id: e.id, step: 0 }); return; }
    if (e.type === 'questStart') { say(`課題「${e.name}」が始まった（${e.days}日以内）。帳面の「物語」で進み具合が見られる。`, '店主'); continue; }
    if (e.type === 'questWon') { sound.se('found'); floatText(`${e.name} 達成！`, 384, 100, 'good'); continue; }
    if (e.type === 'questLost') { sound.se('bad'); say(`課題「${e.name}」は期限までに果たせなかった…。`, '店主'); continue; }
    if (e.type === 'affinity') { if (e.aff === 'good') { sound.se('found'); floatText(`相性◎ ${C.pickles[e.pickle].name}×${C.additives[e.additive].name}`, 384, 130, 'good'); } say(`${C.pickles[e.pickle].name}と${C.additives[e.additive].name}の相性は${{ good: '◎（よく合う）', bad: '✕（合わない）', neutral: '△（ふつう）' }[e.aff]}。レシピ帳に書いておこう。`, '店主'); continue; }
    if (e.type === 'grannyJoin') { sound.se('regular'); openWin('granny'); return; }
    if (e.type === 'wisdom') { sound.se('found'); openWin('wisdom', { e }); return; }
    if (e.type === 'wisdomHint') { say(`「${e.text}」`, game.grannyDef.name); continue; }
    if (e.type === 'tane') { floatText('種を取り分けた', 384, 130, 'good'); say(`${C.pickles[e.pickle].name}の種を取り分けた（種 ${e.n}）。次の樽に使える。`, '店主'); continue; }
    if (e.type === 'orderOffer') { say(`${game.client(e.client).name}: ${e.line}（「売る」の窓で受けられる）`, game.client(e.client).name); continue; }
    if (e.type === 'orderDone') { say(`${game.client(e.client).name}: ${e.line}（お礼 ${yen(e.pay)}）`, game.client(e.client).name); continue; }
    if (e.type === 'orderFailed') { say(`${game.client(e.client).name}: ${e.line}（期日を過ぎた。評判が下がった）`, game.client(e.client).name); continue; }
    if (e.type === 'dried') { say(`樽${e.slot + 1}の${C.vegetables[game.barrels[e.slot]?.veg]?.name ?? '野菜'}が干し上がった。ここから漬かりはじめる。`, '店主'); continue; }
    if (e.type === 'waterUp') { if (e.heavy) say(`樽${e.slot + 1}（${C.pickles[e.pickle].name}）の水が上がった。重石を軽くする頃だ。`, '店主'); continue; }
    if (e.type === 'starterReady') { say(`寝かせておいた${C.pickles[e.pickle].name}の床が、いい香りになった。もう漬けられる。`, '店主'); continue; }
    if (e.type === 'taneArrived') { say(`木曽から小包。「種を絶やしたな？ 今年だけじゃぞ」…${C.pickles[e.pickle].name}の種が届いた。`, '店主'); continue; }
    if (e.type === 'season') { floatText(e.name, 384, 110, 'good'); say(`今日から${e.name}。${e.note}。`, '店主'); continue; }
    if (e.type === 'peddler') { say('行商人が来ている。「店」の窓で、作り方の巻物を売っているらしい。（今日だけ）', '店主'); continue; }
    if (e.type === 'stockSpoiled') { say(`仕入れた野菜が${e.n}個分、傷んでしまった…。（買いすぎ注意）`, '店主'); continue; }
    if (e.type === 'staffQuit') { sound.se('bad'); say(`${e.name}が辞めてしまった。「${e.line}」`, '店主'); continue; }
    if (e.type === 'upkeepShort') { say(`維持費が${yen(e.short)}足りなかった。大家さん「出世払いでいいよ」…ありがたい。`, '店主'); continue; }
    if (e.type === 'story') { sound.se('regular'); openWin('story', { e }); return; }
    if (e.type === 'claimIgnored') { say(`${e.line}（評判 ${trim(e.rep, 1)}）`, '店主'); continue; }
    if (e.type === 'claim' && !game.claim) continue; // もう片付いた
    if (e.type === 'learned') {
      sound.se('found');
      floatText('レシピ帳が埋まった！', 384, 100, 'good');
      say(`お客に「うまい！」と言わせた。${C.pickles[e.pickle].name}がレシピ帳に埋まった。`, '店主');
      continue;
    }
    if (e.type === 'claim') { sound.se('bad'); openWin('claim', { onClose: () => { if (game.claim) { const r = game.respondClaim('ignore'); say(`${r.line}（評判 ${trim(r.rep, 1)}）`, '店主'); } } }); return; }
    sound.se(e.type === 'levelup' || e.type === 'reformed' ? 'regular' : 'found');
    openWin({ levelup: 'levelup', reformed: 'reformed', inspire: 'idea' }[e.type] ?? 'idea', { e });
    return;
  }
}

// 休む（日をとばす）
WINS.rest = () => ({
  title: '休む',
  body: `<p>時間をまとめて進めます。漬物は寝ているあいだも漬かり続けます（店は閉めたまま。膜やぬか床の手入れはできません）。</p>
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
      ${game.lastUpkeep?.day === game.day() ? `<tr><td>今朝の維持費${game.lastUpkeep.wages ? '・お給料' : ''}</td><td class="r neg">−${yen(game.lastUpkeep.upkeep + game.lastUpkeep.wages)}</td></tr>` : ''}
      ${game.event() ? `<tr><td>今日は</td><td class="r ukon">${game.event().name}</td></tr>` : ''}
      <tr><td>評判</td><td class="r ${d > 0 ? 'pos' : d < 0 ? 'neg' : ''}">${Math.round(t.repEnd)}（${d >= 0 ? '+' : ''}${d}）</td></tr>
      ${t.joined ? `<tr><td>新しい常連</td><td class="r pos">${t.joined}人</td></tr>` : ''}
      ${t.found ? `<tr><td>図鑑に載った</td><td class="r pos">${t.found}件</td></tr>` : ''}
      ${game.xp - (t.xpStart ?? game.xp) > 0 ? `<tr><td>店の経験</td><td class="r pos">+${Math.floor(game.xp - t.xpStart)}（Lv.${game.level().level}）</td></tr>` : ''}
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
      <label class="row">時間の速さ <select id="timeScale">${[0.5, 1, 2, 4].map((s) => `<option value="${s}" ${settings.timeScale === s ? 'selected' : ''}>×${s}</option>`).join('')}</select><span class="hint">×1で1日 約${Math.round(Object.values(C.calendar.realSeconds).reduce((a, b) => a + b, 0) / 60 * 10) / 10}分。窓を開いている間は止まる。帳場の ❚❚ でも止められる</span></label>
      <label class="row">お客の歩く速さ <select id="speed">${[1, 2, 4].map((s) => `<option value="${s}" ${settings.speed === s ? 'selected' : ''}>×${s}</option>`).join('')}</select></label>
      <div class="row"><button class="btn" data-act="help">遊び方を見る</button><button class="btn ghost" data-act="toTitle">タイトルへ</button></div></div>
    <div class="sec"><h3>確認用</h3>
      <label class="row"><input type="checkbox" id="manual" ${o.manual ? 'checked' : ''}> 見た目だけ固定する（遊びには影響しない）</label>
      <div class="row">${sel('dSeason', SEASONS, Object.fromEntries(SEASONS.map((s) => [s, C.season[s].name])), o.season)} ${sel('dTime', TIMES, C.timeName, o.time)} ${sel('dWeather', WEATHERS, C.weatherName, o.weather)}</div>
      <div class="row"><button class="btn ghost" data-act="ambient">通りがかりの客を呼ぶ</button>${globalThis.TSUKEMONO_IMAGES ? '' : '<a class="hint" href="explorer.html" target="_blank" rel="noopener">味の確認表</a>'}</div></div>
    <div class="sec"><h3>データ</h3><div class="hint">自動で保存しています（このブラウザの中だけ）。ファイルに書き出しておくと、別の端末や、ブラウザのデータを消したあとでも続きから遊べる。</div>
      <div class="row"><button class="btn" data-act="exportSave">ファイルに書き出す</button><button class="btn" data-act="importSave">ファイルから読みこむ</button></div>
      <div class="row"><button class="btn ghost" data-act="reset">${ui.confirm === 'reset' ? '本当に消して最初から' : '最初からやり直す'}</button></div></div>`,
  };
};

WINS.help = () => ({
  title: '遊び方',
  body: `<ol style="margin:0;padding-left:1.4em;display:grid;gap:8px">
    <li><b class="ukon">仕込む</b>: 樽に、漬物・野菜・塩・調味・置き場所を決めて漬ける。旬の野菜は安くて質が良い。</li>
    <li><b class="ukon">時間</b>: 朝→昼→夕→夜と自動で進み、漬物が漬かる（帳場の帯が時間帯の進み。❚❚ で止まる。「とばす」で次の時間帯へ、「休む」で日をまとめて進める）。店先の樽の札が <b>◎</b> になったら食べ頃。</li>
    <li><b class="ukon">売る</b>: 樽を店先に出しておくと、店が開いている朝・昼・夕にお客が来て、気に入れば買ってくれる。お客は時間帯ごとに入れ替わる。夜は閉店。</li>
    <li><b class="ukon">樽</b>: 味見で今の味がわかる。白い膜（札が <b>!</b>）は「手入れ」で取る。</li>
    <li><b class="ukon">ぬか床</b>: 毎日かき混ぜると育ち、ぬか漬けがおいしくなる。</li>
    <li><b class="ukon">店</b>: お金がたまったら、冷蔵庫・室・樽を買う。評判と常連もここで見る。</li>
    <li><b class="ukon">帳面</b>: レシピ帳（作り方の図鑑）、売った記録、見つけた組み合わせ。調味の相性は、売ってみるとわかる。</li>
    <li><b class="ukon">仕入れ</b>: 野菜の相場は毎日変わり、特売の日もある。安いときに買っておくと仕込みで先に使う（古くなると品質が落ち、7日を過ぎると傷む）。正月・お盆などの行事の日はお客が増える。毎朝、店の維持費がかかる。</li>
    <li><b class="ukon">店の経営</b>: 従業員を雇う（毎朝お給料）、農家と契約して新しい野菜、行商人から作り方の巻物。たくあん・粕漬けなどは寝かせるほど高く売れる。常連の好みに応えると、その人の話が聞ける。</li>
    <li><b class="ukon">買えるもの</b>: 仕込みで「特別な食材」（藻塩・羅臼昆布・有機栽培の野菜・金箔など）を足すと、風味が深くなり高く売れる。「店」で店の格上げ（暖簾→看板→店先→蔵→老舗の札）や宣伝（チラシ・ラジオ）、「樽」で杉の木桶への格上げ。</li>
    <li><b class="ukon">難癖のお客</b>: ときどき、なんにでもケチをつけるお客が来る。平謝り・おまけ・毅然と説明・常連の助け舟・出入り禁止から対応を選ぶ（放っておくと評判が下がる）。品質表示の札・お客様の声ノート・にらみ招き猫で備えられる。言い負かし続けると…？</li>
    <li><b class="ukon">レベルとひらめき</b>: 売ると店の経験がたまり、レベルが上がると設備や樽が増やせる。野菜・調味・季節・温度・日数がある組み合わせになると、新しい作り方を<b>ひらめく</b>（レシピ帳の「？？？」の噂が手がかり）。ひらめいてもレベルが足りなければ、まだ挑めない。</li>
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
        collectEvents();
        return;
      }
    }
    renderHud(); renderChips();
    if (ticks > 1) await world.wait(120);
  }
  ui.busy = false;
  ui.clock.phase = 0;
  const tod = game.timeOfDay();
  say(`${C.season[game.season()].name} ${kanjiNum(game.day())}日目、${C.timeName[tod]}。${{ morning: '朝は仕込みどき。', noon: 'お昼どき、お客が多い。', evening: '夕方。もうひと売り。', night: '夜は閉店。翌朝まで休もう。' }[tod]}`);
  renderAll();
  tryOpenShop();
  flushEvents();
}

// ------------------------------------------------------------ 時間制
// 時間帯は実時間で進む（config.calendar.realSeconds ÷ 設定の速さ）。窓を開いている間・場面の間・一時停止中は止まる。
// 進みきったら「とばす」と同じく次の時間帯へ（夜明けには店じまいの窓）。
const clockRunning = () => ui.started && !ui.paused && !ui.win && !ui.busy;
function tickClock(dtMs) {
  if (!clockRunning()) return;
  const secs = C.calendar.realSeconds[game.timeOfDay()] ?? 90;
  ui.clock.phase += (dtMs / 1000) * settings.timeScale / secs;
  const fill = $('clockFill');
  if (fill) fill.style.width = `${Math.min(100, ui.clock.phase * 100)}%`;
  if (ui.clock.phase >= 1) { ui.clock.phase = 0; advance(1); }
}
/** 店先に出している樽があれば、この時間帯の店を開ける（1つの時間帯に1回。夜は開かない）。 */
function tryOpenShop() {
  const d = ui.display;
  if (d == null) return;
  if (!game.vessel(d)) { ui.display = null; renderCommands(); return; }
  if (!game.isOpen() || game.lastSaleTick === game.tick) return;
  startSale(d);
}

async function doBrew() {
  const slot = ui.slot;
  const r = game.brew(slot, ui.recipe);
  if (!r.ok) { sound.se('error'); say(r.error); return; }
  ui.today.cost += r.cost;
  ui.shownMoney = game.money;
  closeWin();
  sound.se('brew');
  const s = slotPos(slot) ?? { cx: SCENE.w / 2 }; // 蔵の樽は店先の絵に出ない
  floatText(`-${yen(r.cost)}`, s.cx, SCENE.labelY - 60, 'bad');
  say(`樽${slot + 1}${slot >= C.barrelsInvest.max ? '（蔵）' : ''}に${barrelName(game.barrels[slot])}を仕込んだ。`, '店主');
  ui.busy = true; renderAll();
  await world.brewScene(slot);
  ui.busy = false; renderAll();
}

/** 樽を店先に出す。店が開いていてまだこの時間帯の客が来ていなければ、すぐ店を開ける。 */
function doSell(slot) {
  if (!game.vessel(slot)) { sound.se('error'); say('そこは空です。'); return; }
  ui.display = slot;
  closeWin();
  if (game.isOpen() && game.lastSaleTick !== game.tick) { startSale(slot); return; }
  sound.se('select');
  say(game.isOpen() ? `${vname(slot)}を店先に出した。この時間帯のお客はもう来たので、次の時間帯から売れる。` : `${vname(slot)}を店先に出した。朝になったら店が開く。`, '店主');
  renderAll();
}
function hideSlot(slot) {
  if (ui.display !== slot) return;
  ui.display = null;
  sound.se('select');
  say(`${vname(slot)}を店先から下げた。`, '店主');
  renderAll();
}
/** この時間帯の客を引いて、時間帯のあいだに散らして来させる（結果は先に確定。見た目だけ時間をかける）。 */
async function startSale(slot) {
  const res = game.sell(slot);
  if (!res.ok) { sound.se('error'); say(res.error); return; }
  ui.today.visitors += res.visitors.length;
  if (!res.visitors.length) {
    say(game.weather === 'sunny' ? '店を開けたが、この時間帯は誰も来なかった…' : `${C.weatherName[game.weather]}の日は客足が遠のく…誰も来なかった。`);
    renderAll(); return;
  }
  sound.se('open');
  say(`店を開けた。${C.timeName[res.time]}のうちに${res.visitors.length}人来そうだ。`);
  // 客は時間帯の残りに散らして来る（最初の1人は少し早く）。速さの設定で短くなる
  const secs = (C.calendar.realSeconds[game.timeOfDay()] ?? 90) / settings.timeScale;
  const remain = Math.max(8, secs * (1 - ui.clock.phase)) * 1000;
  const span = remain * 0.7, n = res.visitors.length;
  const gaps = res.visitors.map((_, i) => (i === 0 ? 800 + Math.random() * 1500 : Math.max(2600, (span / n) * (0.6 + Math.random() * 0.8))));
  // 記録は先に書く（お客が歩いている間に帳面を開いても見える）
  ui.today.revenue += res.revenue; ui.today.sold += res.sold;
  ui.today.joined += res.visitors.filter((v) => v.regular?.joined).length;
  const repNote = (() => { const d = Math.round(res.reputation.after) - Math.round(res.reputation.before); return d ? ` ・ 評判 ${d > 0 ? '+' : ''}${d}` : ''; })();
  ui.log.unshift({
    day: game.day(), time: C.timeName[res.time], weather: C.weatherName[res.weather], what: (res.spoiled ? '傷んでいた！' : `${res.sold}個売れた`) + repNote,
    rows: res.visitors.map((v) => (v.claimer ? { name: '難癖のお客', line: v.claimer.lines.join(' '), sat: null, price: 0 } : { name: (v.regular ? (v.regular.joined ? '★新しい常連・' : v.regular.left ? '常連（離れた）・' : `常連${v.regular.visits}回目・`) : '') + (v.regular ? (game.regulars.find((x) => x.id === v.regular.id)?.name ?? v.customer.name) : v.customer.name), line: v.reaction.line, sat: v.soldOut || res.spoiled ? null : v.sat, price: v.price })),
    revenue: res.revenue, batch: res.batch.closed ? res.batch : null,
  });
  ui.log.length = Math.min(ui.log.length, 12);
  if (res.discovery?.isNew) ui.today.found++;
  if (res.batch.closed) ui.display = null; // 売り切れ・傷みで空になった
  renderCommands(); save();
  const lane = SCENE.lane;
  await world.saleScene(res.visitors, res.season, (v) => {
    if (res.spoiled) { sound.se('bad'); floatText('傷んでる！', lane.standX, 280, 'bad'); return; }
    if (v.claimer) { sound.se('bad'); floatText('難癖！', lane.standX, 250, 'bad'); setTimeout(() => flushEvents(), 2000 * v.claimer.lines.length + 300); return; } // 言い終わったら対応の窓（窓が開くと時間が止まる）
    if (v.reaction?.over) overEffect(v);
    if (v.price > 0) { ui.shownMoney += v.price; sound.se('coin'); floatText(`${v.qty > 1 ? `${v.qty}個 ` : ''}+${yen(v.price)}`, lane.standX, 280); renderHud(); }
    else if (!v.soldOut) floatText('買わない…', lane.standX, 280, 'bad');
    if (v.regular?.joined) { sound.se('regular'); setTimeout(() => floatText('常連になった！', lane.standX, 240, 'good'), 500); }
  }, gaps);
  ui.shownMoney = game.money;
  let msg = res.spoiled ? '傷んだ樽を出してしまった…樽は空になった。評判が下がった。'
    : `${C.timeName[res.time]}の売上 ${yen(res.revenue)}（${res.sold}個）。${res.batch.closed ? `樽が空になった。この樽の収支 ${res.batch.profit >= 0 ? '+' : ''}${yen(res.batch.profit)}。` : ''}`;
  if (res.discovery?.isNew) {
    msg = `図鑑に新しい組み合わせが載った！ ${msg}`;
    sound.se('found');
    floatText('図鑑に登録！', 384, 120, 'good');
  }
  if (res.spoiled) sound.se('bad');
  if (!ui.win) say(msg, '店主');
  renderAll();
  flushEvents();
}

function doBuy(id) {
  const r = id === 'barrel' ? game.buyBarrel() : game.buyPlace(id);
  if (!r.ok) { sound.se('error'); say(r.error); return; }
  ui.today.cost += r.cost;
  ui.shownMoney = game.money;
  if (id === 'barrel') ui.slot = game.barrels.length - 1; else if (C.places[id]) ui.recipe.place = id;
  sound.se('buy');
  const f = C.facilities[id];
  say(id === 'barrel' ? `樽を増やした（${yen(r.cost)}）。店先の右の樽が使える。` : f.fixed != null ? `${f.name}を買った（${yen(r.cost)}）。いつでも${f.fixed}℃で漬けられる。` : `${f.name}を買った（${yen(r.cost)}）。${f.note}`, '店主');
  renderAll();
}

function clampRecipe() {
  if (!game.canBrew(ui.recipe.pickle).ok) ui.recipe.pickle = 'asazuke';
  const r = ui.recipe, p = C.pickles[r.pickle];
  if (!p.vegetables.includes(r.veg) || !game.vegAvailable(r.veg)) r.veg = p.vegetables.find((v) => game.vegAvailable(v) && game.inSeason(v)) ?? p.vegetables.find((v) => game.vegAvailable(v)) ?? p.vegetables[0];
  if (p.place && game.places.includes(p.place)) r.place = p.place; // すぐき漬けは加温室
  if (!game.places.includes(r.place)) r.place = 'doma';
}

// クリック
document.addEventListener('click', (e) => {
  const t = e.target.closest('button, [data-goto]');
  if (!t) return;
  sound.unlock();
  const d = t.dataset;
  if (d.cmd === 'pause') { ui.paused = !ui.paused; sound.se('click'); renderHud(); return; }
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
  if (d.pickle) { sound.se('select'); ui.recipe.pickle = d.pickle; ui.recipe.dry = undefined; ui.recipe.smoke = undefined; ui.recipe.specials = (ui.recipe.specials ?? []).filter((id) => !C.specials[id].pickles || C.specials[id].pickles.includes(d.pickle)); ui.recipe.saltPct = saltDefault(d.pickle); ui.recipe.count = game.standardCount(d.pickle); clampRecipe(); renderWin(); return; }
  if (d.count) { sound.se('select'); ui.recipe.count = clampCount((ui.recipe.count ?? 1) + +d.count); renderWin(); return; }
  if (d.countset) { sound.se('select'); ui.recipe.count = clampCount(+d.countset); renderWin(); return; }
  if (d.veg) { sound.se('select'); ui.recipe.veg = d.veg; renderWin(); return; }
  if (d.add) { sound.se('select'); const a = ui.recipe.additives; ui.recipe.additives = a.includes(d.add) ? a.filter((x) => x !== d.add) : [...a, d.add].slice(0, C.additiveMax); renderWin(); return; }
  if (d.place) { sound.se('select'); ui.recipe.place = d.place; renderWin(); return; }
  if (d.order) {
    const id = +d.oid;
    const r = d.order === 'accept' ? game.acceptOrder(id) : d.order === 'decline' ? game.declineOrder(id) : game.deliver(id, +d.slot);
    if (!r.ok) { sound.se('error'); say(r.error); return; }
    if (d.order === 'deliver') { if (r.emptied && ui.display === +d.slot) ui.display = null; ui.shownMoney = game.money; sound.se('coin'); floatText(`+${yen(r.pay)}`, SCENE.lane.standX, 280); }
    else sound.se('select');
    if (d.order === 'accept') say('依頼を受けた。期日までに納めよう。', '店主');
    renderAll(); flushEvents(); return;
  }
  if (d.wsel) { sound.se('select'); ui.recipe.weight = d.wsel; renderWin(); return; }
  if (d.weight) { const r = game.setWeight(+d.wslot, d.weight); if (!r.ok) { say(r.error); return; } sound.se('care'); say(`樽${+d.wslot + 1}の重石を${C.weight.levels[d.weight].name}にした。`, '店主'); renderAll(); return; }
  if (d.work) { const r = game.doWork(+d.wslot, d.work); if (!r.ok) { say(r.error); return; } sound.se('care'); const w = C.pickles[game.barrels[+d.wslot].pickle].work.find((x) => x.id === d.work); say(`樽${+d.wslot + 1}: ${w.label}。${TIMING[r.timing]}。`, '店主'); world.careScene(); renderAll(); return; }
  if (d.bslot) { sound.se('select'); ui.slot = +d.bslot; renderWin(); renderChips(); return; }
  if (d.special) { sound.se('select'); const a = ui.recipe.specials ?? []; ui.recipe.specials = a.includes(d.special) ? a.filter((x) => x !== d.special) : [...a, d.special]; if (!game.checkSpecials(ui.recipe.pickle, ui.recipe.specials).ok) ui.recipe.specials = a; renderWin(); return; }
  if (d.upgrade) { const r = game.buyUpgrade(d.upgrade, d.uslot != null ? +d.uslot : null); if (!r.ok) { sound.se('error'); say(r.error); return; } ui.today.cost += r.cost; ui.shownMoney = game.money; sound.se('buy'); say(`${r.upgrade.name}（${yen(r.cost)}）。${r.upgrade.note}。`, '店主'); renderAll(); return; }
  if (d.wood || d.smoke) { const p = C.pickles[ui.recipe.pickle]; if (!p.smoking) return; sound.se('select'); const cur = ui.recipe.smoke ?? { days: p.smoking.default, wood: Object.keys(p.smoking.woods)[0] }; ui.recipe.smoke = { wood: d.wood ?? cur.wood, days: Math.min(p.smoking.max, Math.max(1, cur.days + (d.smoke ? +d.smoke : 0))) }; renderWin(); return; }
  if (d.kaon) { sound.se('select'); const [lo, hi] = C.kaonRange; ui.recipe.kaonTemp = Math.min(hi, Math.max(lo, kaonT() + +d.kaon)); renderWin(); return; }
  if (d.region) { const r = game.openRegion(d.region); if (!r.ok) { sound.se('error'); say(r.error); return; } sound.se('found'); say(`地方の枠に「${d.region}」を入れた。この地方の漬物に挑める。`, '店主'); renderAll(); return; }
  if (d.dry || d.dryset) { const p = C.pickles[ui.recipe.pickle]; if (!p.drying) return; sound.se('select'); ui.recipe.dry = Math.min(p.drying.max, Math.max(0, d.dryset != null ? +d.dryset : (ui.recipe.dry ?? p.drying.default) + +d.dry)); renderWin(); return; }
  if (d.salt) { sound.se('select'); ui.recipe.saltPct = Math.min(SALT_MAX(), Math.max(1, ui.recipe.saltPct + +d.salt)); renderWin(); return; }
  if (d.care) { const r = game.nukaCare(d.care); say(r.ok ? (r.care.line ?? `ぬか床：${r.care.name}。${r.care.note}。`) : r.error, r.ok ? '店主' : undefined); ui.shownMoney = game.money; sound.se(r.ok ? 'care' : 'error'); renderAll(); return; }
  if (d.buy) { doBuy(d.buy); return; }
  if (d.saga) { sound.se('select'); openWin('saga', { id: d.saga, all: true }); return; }
  if (d.stock) { const [veg, n] = d.stock.split(':'); const r = game.buyStock(veg, +n); if (!r.ok) { sound.se('error'); say(r.error); return; } ui.today.cost += r.cost; ui.shownMoney = game.money; sound.se('buy'); say(`${C.vegetables[veg].name}を${n}個分仕入れた（${yen(r.cost)}）。`, '店主'); renderAll(); return; }
  if (d.hire) { const r = game.hire(d.hire); if (!r.ok) { sound.se('error'); say(r.error); return; } ui.today.cost += r.cost; ui.shownMoney = game.money; sound.se('regular'); say(`${game.staffDef(d.hire).name}「${r.line}」`, '店主'); renderAll(); return; }
  if (d.fire) { game.fire(d.fire); sound.se('select'); say(`${game.staffDef(d.fire).name}にやめてもらった。「…お世話になりました」`, '店主'); renderAll(); return; }
  if (d.contract) { const r = game.buyContract(d.contract); if (!r.ok) { sound.se('error'); say(r.error); return; } ui.today.cost += r.cost; ui.shownMoney = game.money; sound.se('buy'); say(`${C.vegetables[d.contract].contract.farmer}と契約した。${C.vegetables[d.contract].name}が仕入れられる。`, '店主'); renderAll(); return; }
  if (d.claim) {
    const r = game.respondClaim(d.claim);
    if (!r.ok) { sound.se('error'); say(r.error); return; }
    sound.se(r.win === false || r.rep < 0 ? 'bad' : 'regular');
    ui.win.result = r; ui.win.onClose = null;
    if (r.reformed) ui.pending.unshift(...game.popEvents());
    say(r.line, '店主');
    renderAll(); return;
  }
  if (d.rest) { const days = +d.rest; closeWin(); const ticks = days === 1 ? ((4 - TIMES.indexOf(game.timeOfDay())) % 4 || 4) : days * 4; advance(ticks, { summary: false }); return; }
  const act = d.act;
  if (!act) return;
  const slot = d.slot != null ? +d.slot : null;
  if (act === 'brew') { doBrew(); return; }
  if (act === 'openBrew') { ui.slot = slot; clampRecipe(); openWin('brew'); return; }
  if (act === 'openNuka') { openWin('nuka'); return; }
  if (act === 'sellSlot') { doSell(slot); return; }
  if (act === 'hideSlot') { hideSlot(slot); return; }
  if (act === 'taste') { const r = game.tasteTest(slot); sound.se('taste'); if (r?.ok === false) say(r.error); renderWin(); renderChips(); return; }
  if (act === 'sink') { const r = game.sink(slot); if (!r.ok) { say(r.error); return; } sound.se('care'); say(`樽${slot + 1}の重石を直した。梅がしっかり梅酢に沈んだ。`, '店主'); world.careScene(); renderAll(); return; }
  if (act === 'care') { const r = game.care(slot); if (!r.ok) { say(r.error); return; } sound.se('care'); say(C.pickles[game.barrels[slot]?.pickle]?.umezu ? `樽${slot + 1}のカビを清潔なスプーンで取った。` : `樽${slot + 1}の白い膜を取った。`, '店主'); world.careScene(); renderAll(); return; }
  if (act === 'discard') {
    if (ui.confirm !== `discard${slot}`) { ui.confirm = `discard${slot}`; renderWin(); return; }
    game.discard(slot); if (ui.display === slot) ui.display = null; sound.se('discard'); say(`${vname(slot)}を空にした。`); ui.confirm = null; if (slot >= SHELF) closeWin(); renderAll(); return;
  }
  if (act === 'shelve') { const r = game.shelve(slot); if (!r.ok) { say(r.error); return; } if (ui.display === slot) ui.display = r.shelf; sound.se('care'); say(`樽${slot + 1}の漬物を${vname(r.shelf)}に移した。樽が空いた。`, '店主'); renderAll(); return; }
  if (act === 'stir') { const r = game.stirNuka(); if (!r.ok) { say(r.error); return; } sound.se('stir'); say('ぬか床をかき混ぜた。いい香りだ。', '店主'); world.careScene(); renderAll(); return; }
  if (act === 'saltNuka') { const r = game.saltNuka(); say(r.ok ? 'ぬか床に塩を足した。酸味が和らいだ。' : r.error); ui.shownMoney = game.money; sound.se(r.ok ? 'care' : 'error'); renderAll(); return; }
  if (act === 'closeWin') { closeWin(); return; }
  if (act === 'dayClose') { closeWin(); say(`${C.season[game.season()].name} ${kanjiNum(game.day())}日目の朝。今日も店を開けよう。`); tryOpenShop(); return; }
  if (act === 'help') { openWin('help'); return; }
  if (act === 'exportSave') {
    const text = encodeSave(game, { log: ui.log, today: ui.today, clock: ui.clock, display: ui.display });
    try {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
      a.download = `tsukemono-save-${game.day()}日目.json`;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    } catch { /* ファイルを保存できない所（埋めこみ表示など）では、下の文字のコピーで書き出す */ }
    window.__lastExport = text; // 動作確認用
    openWin('saveText', { text });
    return;
  }
  if (act === 'copySave') { try { navigator.clipboard?.writeText(ui.win?.text ?? ''); say('セーブの文字をコピーした。メモなどに貼って取っておこう。', '店主'); } catch { say('コピーできなかった。文字を選んでコピーしてください。'); } return; }
  if (act === 'pasteSave') { const t = $('saveInput')?.value ?? ''; if (t.trim()) importSaveText(t); return; }
  if (act === 'importSave') { openWin('saveText', { text: null }); return; }
  if (act === 'pickFile') { $('importFile')?.click(); return; }
  if (act === 'sagaNext') { sound.se('select'); ui.win.step++; renderWin(); return; }
  if (act === 'openMarket') { openWin('market'); return; }
  if (act === 'buyRecipe') { const r = game.buyRecipe(); if (!r.ok) { sound.se('error'); say(r.error); return; } ui.today.cost += r.cost; ui.shownMoney = game.money; closeWin(); return; }
  if (act === 'openRecipes') { openWin('book', { tab: 'recipes' }); return; }
  if (act === 'tryRecipe') { const id = d.id; closeWin(); if (game.canBrew(id).ok) { ui.recipe.pickle = id; ui.recipe.saltPct = saltDefault(id); ui.recipe.count = game.standardCount(id); clampRecipe(); const e2 = game.barrels.findIndex((b) => !b); if (e2 >= 0) { ui.slot = e2; openWin('brew'); } else say('空いている樽がない。売り切るか、樽を空けてから仕込もう。'); } return; }
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
  if (t.id === 'count') { if (t.value === '') return; ui.recipe.count = clampCount(+t.value); renderWin(); const el = $('count'); el?.focus(); el?.select?.(); return; }
  if (t.id === 'timeScale') { settings.timeScale = +t.value; saveSettings(); renderWin(); return; }
  if (t.id === 'vBgm' || t.id === 'vSe') { settings[t.id === 'vBgm' ? 'bgm' : 'se'] = +t.value; sound.setVolumes(settings.bgm, settings.se); t.nextElementSibling.textContent = Math.round(+t.value * 100); saveSettings(); return; }
  if (t.id === 'practice') { settings.practice = t.checked; saveSettings(); return; }
  if (t.id === 'speed') { settings.speed = +t.value; world.speed = settings.speed; saveSettings(); return; }
  const o = ui.override;
  if (t.id === 'manual') o.manual = t.checked;
  else if (t.id === 'dSeason') o.season = t.value;
  else if (t.id === 'dTime') o.time = t.value;
  else if (t.id === 'dWeather') o.weather = t.value;
});
/** セーブのファイルを読みこむ（ためしに別のゲームで読んでから、入れかえる） */
function importSaveText(text) {
  const r = decodeSave(text, (snap) => createGame().restore(snap));
  if (!r.ok) { sound.se('error'); say(r.error); return false; }
  store.set(SAVE_KEY, { game: r.data.game, log: Array.isArray(r.data.log) ? r.data.log : [], today: r.data.today ?? null, clock: r.data.clock ?? { phase: 0 }, display: Number.isInteger(r.data.display) ? r.data.display : null });
  location.reload();
  return true;
}
document.addEventListener('change', (e) => {
  if (e.target.id === 'importFile' && e.target.files?.[0]) { e.target.files[0].text().then(importSaveText); e.target.value = ''; return; } if (e.target.id === 'vSe') sound.se('coin'); });

// 店先の樽を直接押す
canvas.addEventListener('click', (e) => {
  if (!ui.started || ui.busy) return;
  const r = canvas.getBoundingClientRect();
  const x = ((e.clientX - r.left) / r.width) * SCENE.w, y = ((e.clientY - r.top) / r.height) * SCENE.h;
  if (y < 280) return;
  let best = -1, bd = 44;
  game.barrels.forEach((_, i) => { const s = slotPos(i); if (s && Math.abs(s.cx - x) < bd) { bd = Math.abs(s.cx - x); best = i; } });
  if (best >= 0) { sound.unlock(); sound.se('select'); ui.slot = best; openWin('barrel', { slot: best }); }
});

// ------------------------------------------------------------ タイトル
function showTitle() {
  ui.started = false;
  const t = $('title');
  const hasProgress = game.tick > 0 || game.stats.revenue > 0 || game.barrels.some(Boolean);
  t.innerHTML = `<div class="logo"><h1><small>俺の</small>漬物！</h1><span class="hanko" aria-hidden="true">漬</span></div><div class="sub">最強の漬物への道</div>
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
  if (brokenSave) { brokenSave = false; say('前のセーブが壊れていて読めなかったので、最初から始める。（壊れたセーブは別に残してある）'); } else if (k === 'new' || (k !== 'continue' && game.tick === 0)) {
    say('いらっしゃい…じゃなくて、今日からここがあなたの漬物屋。まずは「仕込む」で、樽にきゅうりの浅漬けを漬けてみよう。浅漬けは1日で食べ頃になる。', '先代');
  } else {
    say(`おかえりなさい。${C.season[game.season()].name} ${kanjiNum(game.day())}日目、${C.timeName[game.timeOfDay()]}から。`, '店主');
  }
  tryOpenShop();
  flushEvents(); // 序章など
});

// ------------------------------------------------------------ 大きさと描画ループ
const SIDE_W = 300; // 横並びのときの右の帯（帳場・会話・コマンド）の幅
function fit() {
  const bw = document.body.clientWidth - 32, ih = window.innerHeight;
  // 縦積み（帳場・店先・会話窓・コマンドの順）: 店先の高さは、ほかのぶんを引いた残り
  const stacked = Math.min((bw - 16) / SCENE.w, Math.max(1, (ih - 300) / SCENE.h));
  // 横並び（店先を左に、帳場・会話・コマンドを右の帯に）: 店先は画面いっぱいまで大きくできる
  const wideS = Math.min((bw - 16 - SIDE_W - 16) / SCENE.w, (ih - 52) / SCENE.h);
  // PC では、店先が大きくなる方を選ぶ（同じなら横並び）。整数倍で描く（ぼかさない）。狭いスマホは幅に合わせる
  const wide = bw >= 1000 && Math.floor(wideS) >= Math.max(2, Math.floor(stacked));
  let s = wide ? wideS : stacked;
  s = s >= 1 ? Math.max(1, Math.floor(s)) : (bw - 16) / SCENE.w;
  const w = Math.floor(SCENE.w * s), h = Math.floor(SCENE.h * s);
  canvas.style.width = `${w}px`; canvas.style.height = `${h}px`;
  $('app').classList.toggle('wide', wide);
  $('app').style.width = wide ? `${w + 12 + 16 + SIDE_W}px` : `${w + 12}px`;
  $('stageWrap').style.width = `${w + 12}px`; // 枠（6px×2）込み。container-type のため幅を決めておく
}
window.addEventListener('resize', fit);
void integerScale;

// 吹き出し（お客のひとこと）。店先の画面の上に、大きな文字で重ねる
const bubbleEls = new Map();
function renderBubbles() {
  const layer = $('bubbles');
  const live = new Set();
  for (const a of world.actors) {
    if (!a.bubble) continue;
    live.add(a);
    let el = bubbleEls.get(a);
    if (!el) { el = document.createElement('div'); el.className = 'say'; layer.appendChild(el); bubbleEls.set(a, el); }
    if (el.textContent !== a.bubble) el.textContent = a.bubble;
    el.classList.toggle('over', !!a.over);
    const x = Math.min(SCENE.w - 100, Math.max(100, a.x));
    el.style.left = `${(x / SCENE.w) * 100}%`;
    el.style.top = `${(((a.headTop ?? a.y - 120) - 6) / SCENE.h) * 100}%`;
    el.style.setProperty('--tail', `${50 + ((a.x - x) / 2)}%`);
  }
  for (const [a, el] of bubbleEls) if (!live.has(a)) { el.remove(); bubbleEls.delete(a); }
}

let last = performance.now();
function frame(now) {
  const dt = Math.min(100, now - last); last = now;
  world.update(dt);
  tickClock(dt);
  renderer.draw(view(), now);
  renderBubbles();
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
window.__game = { game, ui, world, renderer, sound, settings, advance, doBrew, doSell, hideSlot, tryOpenShop, renderAll, openWin, closeWin, importSaveText, overEffect }; // 動作確認用（scripts/e2e.js）
