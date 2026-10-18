import test from 'node:test';
import assert from 'node:assert/strict';
import { CONFIG } from '../src/config.js';
import { SAGA } from '../data/saga.js';
import { createGame } from '../src/game.js';

const DAY = CONFIG.calendar.ticksPerDay;
const lv = (n) => CONFIG.levels.find((l) => l.level === n).xp;
const sagaIds = (g) => g.popEvents().filter((e) => e.type === 'saga').map((e) => e.id);
/** 課題の進みを数えるための、売った結果（満足度だけ決めたお客） */
const fakeSale = (sats, ratio = 1) => ({ ok: true, spoiled: false, taste: { ratio }, visitors: sats.map((sat) => ({ bought: true, sat })) });
/** 章の日にちの条件がそろう頃（60日目）から始めるゲーム */
const late = (seed) => { const g = createGame({ seed }); g.tick = 59 * DAY; return g; };
/** 章を一気に進める */
function upTo(g, id) {
  for (let i = 0; i < 50 && !g.story.seen.includes(id); i++) g.checkStory();
}

test('序章: はじめた日に始まる', () => {
  const g = createGame({ seed: 1 });
  assert.deepEqual(g.story.seen, ['prologue']);
  assert.deepEqual(sagaIds(g), ['prologue']);
});

test('順番: 宿敵はレベル2になっても、最初の「うまい」より先には現れない', () => {
  const g = late(2);
  g.addXp(lv(2)); g.checkStory();
  assert.ok(!g.story.seen.includes('rival'));
  g.recipes.asazuke.made = 1;
  g.checkStory(); // 第一章
  g.checkStory(); // 第二章
  assert.deepEqual(g.story.seen.slice(0, 3), ['prologue', 'umai', 'rival']);
});

test('漬物対決: 7日以内に「とても満足」のお客を5人で勝ち、賞品をもらう', () => {
  const g = late(3);
  g.recipes.asazuke.made = 1; g.addXp(lv(3));
  upTo(g, 'challenge');
  assert.equal(g.story.quest.id, 'battle1');
  assert.equal(g.story.quest.endDay, g.day() + 7);
  g.questOnSale(fakeSale([90, 70, 85]), { pickle: 'asazuke' });
  assert.equal(g.story.quest.progress, 2);
  const m = g.money;
  g.questOnSale(fakeSale([81, 95, 99]), { pickle: 'asazuke' });
  assert.equal(g.story.quest, null);
  assert.ok(g.story.won.includes('battle1'));
  g.checkStory();
  assert.ok(g.story.seen.includes('battle1Win'));
  assert.equal(g.money, m + 3000);
});

test('漬物対決: 期限が切れると負けの章、7日後にやり直し', () => {
  const g = late(4);
  g.recipes.asazuke.made = 1; g.addXp(lv(3));
  upTo(g, 'challenge');
  g.popEvents();
  g.advance(DAY * 8);
  const ev = g.popEvents();
  assert.ok(ev.some((e) => e.type === 'questLost'));
  assert.ok(ev.some((e) => e.type === 'saga' && e.id === 'battle1Lose'));
  assert.equal(g.story.quest, null);
  g.advance(DAY * 7);
  assert.equal(g.story.quest?.id, 'battle1');
  assert.ok(!g.story.seen.includes('battle1Win'));
});

test('幕間: ぬか床が熟すと夢を見る。難癖のお客の改心で真実がわかる', () => {
  const g = late(5);
  g.nuka.maturity = 1; g.checkStory();
  assert.ok(g.story.seen.includes('nuka'));
  g.recipes.asazuke.made = 1; g.addXp(lv(2)); upTo(g, 'rival');
  g.stats.reformed = 1; g.checkStory();
  assert.ok(g.story.seen.includes('confession'));
});

test('伝説の重石から終章まで: 寝かせた漬物を売り、三種の漬物で最終決戦に勝つ', () => {
  const g = late(6);
  g.recipes.asazuke.made = 1; g.addXp(lv(3)); upTo(g, 'challenge');
  g.questOnSale(fakeSale([90, 90, 90, 90, 90]), { pickle: 'asazuke' });
  g.addXp(lv(5)); upTo(g, 'stone');
  assert.equal(g.story.quest.kind, 'agedSale');
  g.questOnSale(fakeSale([70], 1.0), { pickle: 'takuan' }); // 寝かせが足りない
  assert.ok(g.story.quest);
  g.questOnSale(fakeSale([70], 3), { pickle: 'takuan' });
  upTo(g, 'stoneDone');
  g.addXp(lv(6)); upTo(g, 'final');
  assert.equal(g.story.quest.kind, 'variety');
  g.questOnSale(fakeSale([90]), { pickle: 'asazuke' });
  g.questOnSale(fakeSale([90]), { pickle: 'asazuke' }); // 同じ漬物は数えない
  g.questOnSale(fakeSale([80]), { pickle: 'takuan' }); // 満足が足りない
  assert.equal(g.story.quest.progress, 1);
  g.questOnSale(fakeSale([86]), { pickle: 'takuan' });
  g.questOnSale(fakeSale([99]), { pickle: 'hakusaizuke' });
  upTo(g, 'ending');
  assert.ok(g.story.seen.includes('ending'));
});

test('データで足せる: 章を1件足すと、その条件で始まる', () => {
  const extra = { id: 'extra', no: '番外', title: 'ためし', after: 'prologue', when: { day: 3 }, lines: [{ text: 'x' }], reward: { rep: 1 } };
  const g = createGame({ seed: 7, cfg: { ...CONFIG, saga: [...SAGA, extra] } });
  g.advance(DAY);
  assert.ok(!g.story.seen.includes('extra'));
  g.advance(DAY);
  assert.ok(g.story.seen.includes('extra'));
});

test('セーブ: 見た章と課題の進みが残る', () => {
  const g = late(8);
  g.recipes.asazuke.made = 1; g.addXp(lv(3)); upTo(g, 'challenge');
  g.questOnSale(fakeSale([90, 90]), { pickle: 'asazuke' });
  const h = createGame();
  assert.equal(h.restore(g.snapshot()), true);
  assert.deepEqual(h.story.seen, g.story.seen);
  assert.equal(h.story.quest.progress, 2);
});

test('物語の章はすべて、語りと条件がそろっている', () => {
  const ids = new Set(SAGA.map((c) => c.id));
  assert.equal(ids.size, SAGA.length);
  for (const c of SAGA) {
    assert.ok(c.lines.length > 0 && c.title && c.no, c.id);
    if (c.after) assert.ok(ids.has(c.after), `${c.id}: after ${c.after}`);
  }
});

test('幕間: 便り・はじめての納品・重石・雨の干しで、笑える幕間が始まる。終章で看板の名前が決まる', () => {
  const g = late(9);
  g.recipes.asazuke.made = 1; g.addXp(lv(7));
  upTo(g, 'rival');
  const seen = () => g.story.seen;
  g.checkStory(); g.checkStory();
  for (const id of ['tegami', 'chumon', 'omoshi', 'ame']) assert.ok(!seen().includes(id), id);
  g.openRegion('関東'); g.learn('bettarazuke', 'letter');
  g.orders.done = 1;
  g.stats.weightSwitch = 3;
  g.stats.rainedDrying = 1;
  for (let i = 0; i < 10; i++) g.checkStory();
  for (const id of ['tegami', 'chumon', 'omoshi', 'ame']) assert.ok(seen().includes(id), id);
  const end = SAGA.find((c) => c.id === 'ending');
  assert.ok(end.lines.some((l) => l.text.includes('俺の漬物！')));
  assert.ok(SAGA.find((c) => c.id === 'prologue').lines.some((l) => l.text.includes('○○')));
});

test('重石を替えた回数と、干している野菜に雨が降ったことを数える', () => {
  const g = createGame({ seed: 1 });
  g.money = 1e6;
  g.brew(0, { veg: 'hakusai', pickle: 'hakusaizuke', saltPct: 3, tempC: 20, weight: 'heavy' });
  g.setWeight(0, 'light');
  assert.equal(g.stats.weightSwitch, 1);
  g.brew(1, { veg: 'daikon', pickle: 'takuan', saltPct: 5, tempC: 15, dry: 5 });
  g.weather = 'rain'; g.advance(1);
  assert.ok(g.stats.rainedDrying > 0);
});
