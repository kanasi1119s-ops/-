import test from 'node:test';
import assert from 'node:assert/strict';
import { CONFIG } from '../src/config.js';
import { reactionOf } from '../src/sales.js';
import { simulate } from '../src/model.js';
import { GREAT, AWFUL } from '../data/reactions.js';

const cust = (id) => CONFIG.customers.find((c) => c.id === id);
const t = simulate({ veg: 'hakusai', pickle: 'hakusaizuke', saltPct: 3, tempC: 20, days: 7 }, CONFIG);

test('オーバーリアクション: とても満足したお客は、好みのタイプに合わせて大げさに喜ぶ', () => {
  for (const id of ['light', 'salty', 'sour', 'crunchy', 'gourmet']) {
    for (let v = 0; v < 3; v++) {
      const r = reactionOf(t, 'hakusaizuke', cust(id), 92, 'spring', CONFIG, v);
      assert.equal(r.over, true);
      assert.equal(r.key, 'great');
      assert.ok([...GREAT[id], ...GREAT.generic].includes(r.line), r.line);
    }
  }
  assert.ok(!reactionOf(t, 'hakusaizuke', cust('light'), 70, 'spring', CONFIG, 0).over, 'ふつうに満足なら、ふつうの反応');
});

test('オーバーリアクション: 秘伝の漬物は満足70から、専用の大げさな反応', () => {
  const r = reactionOf(t, 'kumagoroshi', cust('salty'), 75, 'spring', CONFIG, 1);
  assert.equal(r.over, true);
  assert.ok(CONFIG.pickles.kumagoroshi.over.includes(r.line));
});

test('オーバーリアクション: とてもがっかりしたときも、ずれた味ごとに大げさ', () => {
  const sour = { ...t, acid: 100, stage: 'sour', spoilRisk: 0 };
  const r = reactionOf(sour, 'hakusaizuke', cust('light'), 5, 'spring', CONFIG, 0);
  assert.equal(r.over, true);
  assert.ok(Object.values(AWFUL).flat().includes(r.line), r.line);
  const rotten = reactionOf({ ...t, spoilRisk: 90 }, 'hakusaizuke', cust('light'), 5, 'spring', CONFIG, 0);
  assert.ok(!rotten.over, '傷んでいるときは、ふざけない');
});
