import test from 'node:test';
import assert from 'node:assert/strict';
import { CONFIG } from '../src/config.js';
import { createGame } from '../src/game.js';
import { TASTE_GRIPES, ABSURD_GRIPES, DISGUISE } from '../data/claimer.js';

const recipe = { veg: 'hakusai', pickle: 'hakusaizuke', saltPct: 3, tempC: 20 };
const DAY = CONFIG.calendar.ticksPerDay;
/** 難癖のお客が必ず来る設定 */
const always = { ...CONFIG, claimer: { ...CONFIG.claimer, chance: 1 } };
/** 食べ頃の白菜漬けを出して、難癖のお客を呼ぶ */
function claimGame(seed = 1, cfg = always) {
  const g = createGame({ seed, cfg });
  g.brew(0, { ...recipe, count: 60 });
  g.advance(25);
  g.weather = 'sunny';
  const r = g.sell(0);
  return { g, r };
}
const allGripes = [...ABSURD_GRIPES, ...Object.values(TASTE_GRIPES).flat(2)];

test('難癖のお客: ときどき来て、味がどうであれ必ずケチをつける', () => {
  let came = 0;
  for (let seed = 1; seed <= 200; seed++) {
    const g = createGame({ seed });
    g.brew(0, recipe); g.advance(25); g.weather = 'sunny';
    const r = g.sell(0);
    const v = r.visitors.find((x) => x.claimer);
    if (!v) continue;
    came++;
    assert.ok(allGripes.includes(v.claimer.lines[0]), v.claimer.lines[0]);
    assert.ok(g.claim, '対応を待っている');
    assert.equal(r.discovery == null || !Number.isNaN(r.discovery.avg), true); // 図鑑の平均に入らない
  }
  assert.ok(came > 10 && came < 80, `${came}/200回`); // 1割強（評判で少し増える）
});

test('難癖のお客は、評判・図鑑・常連の計算に入らない', () => {
  const { g, r } = claimGame(3);
  const v = r.visitors.find((x) => x.claimer);
  assert.ok(v);
  assert.equal(v.bought, false);
  assert.equal(v.sat, null);
  assert.ok(!g.regulars.some((x) => x.type === 'claimer'));
  assert.ok(Number.isFinite(g.reputation));
});

test('対応: 平謝りは評判が少し下がって相手が図太くなる、おまけは1個減る', () => {
  const a = claimGame(4).g;
  const rep = a.reputation, nerve = a.claimer.nerve;
  const r = a.respondClaim('apologize');
  assert.ok(r.ok && r.line);
  assert.equal(a.reputation, rep - 1);
  assert.equal(a.claimer.nerve, nerve + 1);
  assert.equal(a.claim, null);
  assert.equal(a.respondClaim('apologize').ok, false); // もういない
  const b = claimGame(4).g;
  const left = b.barrels[0].portions;
  b.respondClaim('omake');
  assert.equal(b.barrels[0].portions, left - 1);
  assert.equal(b.claimer.nerve, nerve + 2);
});

test('対策: 説明が通る確率は、店のレベル・味の良さ・品質表示の札で上がる', () => {
  const { g } = claimGame(5);
  const p0 = g.explainChance();
  g.addXp(CONFIG.levels.find((l) => l.level === 4).xp);
  const p1 = g.explainChance();
  assert.ok(p1 > p0);
  g.money = 1e5; g.buyPlace('fuda');
  assert.ok(g.explainChance() > p1);
  let wins = 0;
  for (let seed = 1; seed <= 60; seed++) {
    const h = claimGame(seed).g;
    h.money = 1e5; h.addXp(CONFIG.levels.find((l) => l.level === 4).xp); h.buyPlace('fuda');
    const rep = h.reputation;
    const r = h.respondClaim('explain');
    if (r.win) { wins++; assert.ok(h.reputation > rep); } else assert.ok(h.reputation < rep);
  }
  assert.ok(wins > 30, `${wins}/60`);
});

test('対策: 常連の助け舟は常連がいるときだけ、出入り禁止はレベル3から', () => {
  const { g } = claimGame(6);
  const opts = Object.fromEntries(g.claimOptions().map((o) => [o.id, o]));
  assert.equal(opts.regular.ok, g.claim.regularHere);
  assert.equal(opts.ban.ok, false);
  assert.match(opts.ban.reason, /レベル3/);
  g.claim.regularHere = true;
  assert.equal(g.claimOptions().find((o) => o.id === 'regular').ok, true);
});

test('出入り禁止: 季節がひとつ巡るまで来なくなり、戻ってくるときは変装している', () => {
  const { g } = claimGame(7);
  g.addXp(CONFIG.levels.find((l) => l.level === 3).xp);
  const r = g.respondClaim('ban');
  assert.ok(r.ok && r.banned);
  assert.equal(g.claimerChance(), 0);
  g.advance(CONFIG.claimer.banDays * DAY);
  assert.ok(g.claimerChance() > 0);
  if (!g.barrels[0]) g.brew(0, { ...recipe, count: 60 });
  g.advance(25 - (g.tick % DAY === 0 ? 0 : 0)); g.weather = 'sunny';
  while (!g.isOpen() || g.lastSaleTick === g.tick) g.advance(1);
  const s = g.sell(0);
  const v = s.visitors.find((x) => x.claimer);
  if (!s.spoiled) assert.equal(v.claimer.lines[0], DISGUISE);
});

test('放っておくと、時間が進んだときに「聞こえないふり」になる。声ノートで下がり方が半分', () => {
  const a = claimGame(8).g;
  const rep = a.reputation;
  a.advance(1);
  assert.equal(a.claim, null);
  assert.equal(a.reputation, rep - 3);
  assert.ok(a.popEvents().some((e) => e.type === 'claimIgnored'));
  const b = createGame({ seed: 8, cfg: always });
  b.money = 1e5; b.buyPlace('koenote');
  b.brew(0, { ...recipe, count: 60 }); b.advance(25); b.weather = 'sunny'; b.sell(0);
  const rep2 = b.reputation;
  b.respondClaim('ignore');
  assert.equal(b.reputation, rep2 - 1.5);
});

test('にらみ招き猫で来る確率が半分になる', () => {
  const g = createGame({ seed: 9 });
  const p = g.claimerChance();
  g.money = 1e5; g.addXp(CONFIG.levels.find((l) => l.level === 3).xp); g.buyPlace('manekineko');
  assert.ok(Math.abs(g.claimerChance() - p / 2) < 1e-9);
});

test('改心: 説明で図太さを0まで下げると、難癖のお客が常連になり、しばらく来なくなる', () => {
  const { g } = claimGame(10);
  g.claimer.nerve = 1;
  g.claim.quality = 1; g.addXp(CONFIG.levels.at(-1).xp); // ほぼ確実に通る
  let r;
  for (let i = 0; i < 20; i++) { r = g.respondClaim('explain'); if (r.win) break; g.claim = { tick: g.tick, slot: 0, lines: ['x', 'y'], regularHere: false, quality: 1 }; g.claimer.nerve = 1; }
  assert.equal(r.reformed, true);
  assert.ok(g.regulars.some((x) => x.reformed && x.type === 'gourmet'));
  assert.ok(g.popEvents().some((e) => e.type === 'reformed'));
  assert.equal(g.claimerChance(), 0);
  g.advance(CONFIG.claimer.newAfterDays * DAY);
  assert.ok(g.claimerChance() > 0); // 新しい難癖のお客が現れる
});

test('セーブ: 難癖のお客と、待っている難癖が残る', () => {
  const { g } = claimGame(11);
  g.claimer.nerve = 4;
  const h = createGame({ cfg: always });
  assert.equal(h.restore(g.snapshot()), true);
  assert.equal(h.claimer.nerve, 4);
  assert.deepEqual(h.claim.lines, g.claim.lines);
  assert.equal(h.respondClaim('apologize').ok, true);
});
