import test from 'node:test';
import assert from 'node:assert/strict';
import { validateSprites, SPRITES } from '../assets/sprites.js';

test('スプライトの行幅がそろい、使う色が定義されている', () => {
  assert.deepEqual(validateSprites(), []);
  assert.ok(SPRITES.umbrella && SPRITES.plate);
});
