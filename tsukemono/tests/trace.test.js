import { WALK } from '../assets/walk.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { IMAGES, SCENE } from '../assets/scene.js';
import { TRACE } from '../assets/trace.js';
import { BODIES, RECOLORS, PASSERS, randomLook } from '../assets/characters.js';
import { PERSON_ANIMS, POSE_ANIMS } from '../assets/animations.js';

const pngSize = (name) => { const b = fs.readFileSync(new URL(`../assets/img/${name}.png`, import.meta.url)); return [b.readUInt32BE(16), b.readUInt32BE(20)]; };

test('トレースした画像がそろい、背景の大きさが画面と同じ', () => {
  for (const n of IMAGES) assert.ok(pngSize(n)[0] > 0, n);
  assert.deepEqual(pngSize('bg'), [SCENE.w, SCENE.h]);
  for (const [i, s] of TRACE.slots.entries()) for (const v of ['empty', 'hakusai', 'kyuri', 'daikon', 'nozawana', 'nasu', 'takuan']) assert.deepEqual(pngSize(`slot${i}_${v}`), [s.w, s.h + 2 + 4]); // 口の下2行・盛り上がり4行（tools/barrel_tops.py）
});

test('人物の目印が絵の中に収まり、来る人全員に絵がある', () => {
  for (const [k, b] of Object.entries(BODIES)) {
    if (b.kind === 'poses') {
      for (const p of b.poses) assert.deepEqual(pngSize(p.img), [p.w, p.h], p.img);
      for (const a of Object.values(POSE_ANIMS[k])) {
        for (const f of a.frames) {
          if (f.walk != null) { const w = WALK[k][f.walk]; assert.deepEqual(pngSize(w.img), [w.w, w.h], w.img); } // 描き直した歩くコマ
          else assert.ok(b.poses[f.pose], `${k} pose ${f.pose}`);
        }
      }
      continue;
    }
    const [w, h] = pngSize(b.img);
    assert.ok(b.headY < b.hipY && b.hipY < h && b.legX > 0 && b.legX < w, k);
  }
  for (const look of PASSERS) {
    assert.ok(BODIES[look.body], look.body);
    if (look.recolor) assert.ok(RECOLORS[look.recolor], look.recolor);
  }
  for (const set of [PERSON_ANIMS, ...Object.values(POSE_ANIMS)]) for (const a of Object.values(set)) assert.ok(a.frames.length >= 2 && a.frames.length <= 8);
});

test('通りがかりの人: 季節限定の人は、その季節にだけ来る', () => {
  for (const p of PASSERS) assert.ok(BODIES[p.body], p.body);
  const seen = (season) => new Set(Array.from({ length: 400 }, (_, i) => randomLook(() => (i % 100) / 100, season).body));
  assert.ok(seen('summer').has('beach'));
  assert.ok(!seen('winter').has('beach'));
});

test('通りがかりの人: 来やすさ（weight）が低い人はめったに来ない', () => {
  let alien = 0, n = 2000;
  for (let i = 0; i < n; i++) if (randomLook(() => i / n, 'spring').body === 'alien') alien++;
  const others = PASSERS.filter((p) => !p.seasons || p.seasons.includes('spring')).length - 1;
  assert.ok(alien > 0 && alien < n / others, `alien ${alien}`);
});

test('見た目は好みのタイプに合う人が選ばれやすい（おばあちゃんは、あっさり好きのとき多め）', () => {
  const count = (type) => Array.from({ length: 1000 }, (_, i) => randomLook(() => i / 1000, 'spring', type)).filter((p) => p.body.startsWith('granny')).length;
  assert.ok(count('light') > count('salty') * 2, `${count('light')} vs ${count('salty')}`);
  for (const p of PASSERS) for (const t of p.likes ?? []) assert.ok(['light', 'salty', 'sour', 'crunchy', 'gourmet'].includes(t), t);
});
