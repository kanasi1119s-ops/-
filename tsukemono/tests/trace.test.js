import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { IMAGES, SCENE } from '../assets/scene.js';
import { TRACE } from '../assets/trace.js';
import { BODIES, CUSTOMER_LOOKS, RECOLORS } from '../assets/characters.js';
import { PERSON_ANIMS } from '../assets/animations.js';
import { CONFIG } from '../src/config.js';

const pngSize = (name) => { const b = fs.readFileSync(new URL(`../assets/img/${name}.png`, import.meta.url)); return [b.readUInt32BE(16), b.readUInt32BE(20)]; };

test('トレースした画像がそろい、背景の大きさが画面と同じ', () => {
  for (const n of IMAGES) assert.ok(pngSize(n)[0] > 0, n);
  assert.deepEqual(pngSize('bg'), [SCENE.w, SCENE.h]);
  for (const [i, s] of TRACE.slots.entries()) for (const v of ['empty', 'hakusai', 'kyuri']) assert.deepEqual(pngSize(`slot${i}_${v}`), [s.w, s.h]);
});

test('人物の目印が絵の中に収まり、客全員に絵がある', () => {
  for (const [k, b] of Object.entries(BODIES)) {
    const [w, h] = pngSize(b.img.replace(/^/, ''));
    assert.ok(b.headY < b.hipY && b.hipY < h && b.legX > 0 && b.legX < w, k);
  }
  for (const c of CONFIG.customers) {
    const look = CUSTOMER_LOOKS[c.id];
    assert.ok(look && BODIES[look.body], c.id);
    if (look.recolor) assert.ok(RECOLORS[look.recolor], c.id);
  }
  for (const set of Object.values(PERSON_ANIMS)) for (const a of Object.values(set)) assert.ok(a.frames.length >= 2 && a.frames.length <= 4);
});
