import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame } from '../src/game.js';
import { nextStep } from '../src/guide.js';

const recipe = { veg: 'hakusai', pickle: 'hakusaizuke', saltPct: 3, tempC: 20 };

test('案内: 空き樽→仕込み、熟成中→時間を進める、食べ頃→売る、売った後→時間を進める、夜→朝まで', () => {
  const g = createGame({ seed: 3 });
  assert.match(nextStep(g), /空いている.*仕込もう/);
  g.brew(0, recipe); g.brew(1, recipe); g.brew(2, recipe);
  assert.match(nextStep(g), /あと約6日で食べ頃/); // 食べ頃の入り口（約6日）
  g.advance(25); // 7日目の昼
  assert.match(nextStep(g), /食べ頃。味見して/);
  g.weather = 'sunny';
  g.sell(0);
  assert.match(nextStep(g), /1回。時間を進めよう/);
  g.advance(2); // 夜
  assert.match(nextStep(g), /夜は閉店/);
  g.advance(4 * 8 + 1); // ずっと先の朝
  assert.match(nextStep(g), /酸っぱくなりかけ/);
});
