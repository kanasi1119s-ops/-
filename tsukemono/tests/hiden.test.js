import test from 'node:test';
import assert from 'node:assert/strict';
import { CONFIG } from '../src/config.js';
import { createGame } from '../src/game.js';
import { simulate } from '../src/model.js';
import { HIDEN } from '../data/hiden.js';
import { SAGA } from '../data/saga.js';

const DAY = CONFIG.calendar.ticksPerDay;
const lv = (n) => CONFIG.levels.find((l) => l.level === n).xp;
const rich = (n = 7, seed = 1) => { const g = createGame({ seed }); g.money = 1e7; g.addXp(lv(n)); g.popEvents(); return g; };

test('秘伝の漬物: 定義があり、物語で教わるものは章のごほうびに入っている', () => {
  for (const h of HIDEN) {
    assert.ok(CONFIG.pickles[h.id]?.hiden, h.id);
    assert.ok(h.praise.length && h.over.length, h.id);
    if (h.unlock.via === 'taught') assert.ok(SAGA.some((c) => c.reward?.teach === h.id), `${h.id}を教わる章`);
  }
});

test('熊殺し漬け: 唐辛子とからしを両方入れ、塩8%以上で漬けるとひらめく', () => {
  const g = rich(2);
  g.brew(0, { veg: 'daikon', pickle: 'asazuke', saltPct: 9, tempC: 15, additives: ['togarashi', 'karashi'] });
  g.advance(DAY * 2);
  assert.ok(g.knows('kumagoroshi'));
  const ev = g.popEvents().find((e) => e.type === 'inspire' && e.pickle === 'kumagoroshi');
  assert.match(ev.line, /熊/);
});

test('プリン漬け: プリンを浅漬けにするとひらめく（食べるなとは書いてあるが、漬けるなとは書いていない）', () => {
  const g = rich(1);
  assert.equal(g.brew(0, { veg: 'purin', pickle: 'asazuke', saltPct: 2, tempC: 5 }).ok, true);
  g.advance(DAY);
  assert.ok(g.knows('purinzuke'));
  assert.equal(g.brew(1, { veg: 'purin', pickle: 'purinzuke', saltPct: 1.5, tempC: 5 }).ok, true);
});

test('男爵漬け: 宿敵の章で教わる', () => {
  const g = createGame({ seed: 2 }); g.tick = 59 * DAY;
  g.recipes.asazuke.made = 1; g.addXp(lv(3));
  for (let i = 0; i < 5 && !g.story.seen.includes('rival'); i++) g.checkStory();
  assert.ok(g.knows('danshakuzuke'));
  assert.equal(g.recipes.danshakuzuke.via, 'taught');
  assert.ok(g.popEvents().some((e) => e.type === 'inspire' && e.pickle === 'danshakuzuke' && e.line.includes('男爵いも')));
});

test('天下一重石漬け: 重い重石を乗せっぱなしでもつぶれない（ふつうの白菜漬けはつぶれる）', () => {
  const heavy = [{ d: 0, w: 2 }], normal = [{ d: 0, w: 1 }];
  const tx = (pickle, w) => simulate({ veg: 'hakusai', pickle, saltPct: 4, tempC: 10, days: 20, weights: w }, CONFIG).texture;
  assert.ok(tx('omoshizuke', heavy) >= tx('omoshizuke', normal)); // つぶれない（傷みにくいぶん、少し良いくらい）
  assert.ok(tx('hakusaizuke', heavy) < tx('hakusaizuke', normal) * 0.8);
  const sp = (w) => simulate({ veg: 'hakusai', pickle: 'omoshizuke', saltPct: 4, tempC: 10, days: 20, weights: w }, CONFIG).spoilRisk;
  assert.ok(sp(heavy) < sp(normal), '重いほうが傷みにくいので、重いまま乗せっぱなしが正解');
});
