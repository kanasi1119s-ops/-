import test from 'node:test';
import assert from 'node:assert/strict';
import { PICKLES, picklesFrom } from '../data/pickles.js';
import { CONFIG } from '../src/config.js';
import { createGame, bookTotal } from '../src/game.js';
import { simulate } from '../src/model.js';

// 定義を1件足しただけの設定
const withDef = (def) => ({ ...CONFIG, ...picklesFrom([...PICKLES, def]) });
const testzuke = {
  id: 'testzuke', name: 'ためし漬け', vegetables: ['nasu', 'kyuri'],
  steps: ['なす・きゅうりを刻む', '赤しそと塩で漬ける'], saltHint: '3〜4%', salt: { lo: 3, hi: 4 }, tempHint: '10〜20℃', temp: { lo: 10, hi: 20 },
  ripeAt: 5, window: { lo: 0.8, hi: 2, sour: 3 }, complexityMax: 70, price: 400, affinity: { akajiso: 'good' },
};

test('漬物はデータの定義から作られる（はじめから知っているのは今までの5種）', () => {
  assert.deepEqual(Object.keys(CONFIG.pickles), PICKLES.map((p) => p.id));
  assert.equal(CONFIG.pickles.hakusaizuke.ripeAt, 7);
  assert.equal(CONFIG.affinity.takuan.zarame, 'good');
  for (const p of Object.values(CONFIG.pickles)) {
    assert.ok(Array.isArray(p.steps) && p.steps.length > 0, `${p.name}: 工程`);
    assert.ok(p.tempHint && p.saltHint, `${p.name}: 目安`);
  }
  const start = Object.entries(CONFIG.pickles).filter(([, p]) => !p.unlock);
  assert.deepEqual(start.map(([id]) => id), ['asazuke', 'hakusaizuke', 'nukazuke', 'takuan', 'nozawanazuke']);
  for (const [, p] of start) assert.equal(p.level, 1);
});

test('定義を1件足すだけで、新しい漬物を仕込めて、味が出て、図鑑の数も増える', () => {
  const cfg = withDef(testzuke);
  const g = createGame({ cfg });
  const r = g.brew(0, { veg: 'nasu', pickle: 'testzuke', saltPct: 3.5, tempC: 18, additives: ['akajiso'] });
  assert.ok(r.ok, r.error);
  const t = simulate({ veg: 'nasu', pickle: 'testzuke', saltPct: 3.5, tempC: 18, days: 5, additives: ['akajiso'] }, cfg);
  assert.ok(t.saltiness > 0 && t.complexity > 0 && t.stage);
  assert.equal(bookTotal(cfg), bookTotal(CONFIG) + 2 * (bookTotal(CONFIG) / Object.values(CONFIG.pickles).reduce((s, p) => s + p.vegetables.length, 0)));
  assert.equal(g.brew(1, { veg: 'daikon', pickle: 'testzuke', saltPct: 3, tempC: 18 }).ok, false); // 定義にない野菜は使えない
});

test('定義のまちがい（必須の項目がない・id がかぶる）はすぐ分かる', () => {
  assert.throws(() => picklesFrom([...PICKLES, { id: 'x', name: 'x' }]), /ripeAt|vegetables/);
  assert.throws(() => picklesFrom([...PICKLES, { ...PICKLES[0] }]), /かぶっている/);
});
