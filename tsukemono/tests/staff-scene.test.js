import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { STAFF_ART } from '../assets/staff.js';
import { BODIES } from '../assets/characters.js';
import { POSE_ANIMS } from '../assets/animations.js';
import { TRACE } from '../assets/trace.js';
import { SCENE } from '../assets/scene.js';
import { STAFF } from '../data/staff.js';
import { World } from '../src/world.js';

const pngSize = (f) => { const b = fs.readFileSync(f); return [b.readUInt32BE(16), b.readUInt32BE(20)]; };

test('従業員の絵: 雇える人ぜんぶに絵と立つ所があり、元の姿勢と同じ大きさ。動きはその絵を指す', () => {
  for (const s of STAFF) {
    const art = STAFF_ART[s.id];
    assert.ok(art && SCENE.staff[s.id], s.id);
    art.poses.forEach((i) => assert.deepEqual(pngSize(`assets/img/staff_${s.id}_${i}.png`), [TRACE.poses[art.base][i].w, TRACE.poses[art.base][i].h]));
    const body = BODIES[`staff_${s.id}`];
    for (const name of ['idle', 'talk', 'work']) assert.ok(POSE_ANIMS[`staff_${s.id}`][name].frames.every((f) => body.poses[f.pose]), `${s.id}.${name}`);
    assert.ok(s.chatter.length >= 3, s.id);
  }
});

test('従業員: 雇うと店先に立ち、ときどき話して、やめると帰る', () => {
  let t = 0;
  const w = new World(() => t);
  w.syncStaff(['baito', 'deshi']);
  assert.equal(w.actors.filter((a) => a.kind === 'staff').length, 2);
  w.syncStaff(['baito', 'deshi']); // 何度呼んでも増えない
  assert.equal(w.actors.filter((a) => a.kind === 'staff').length, 2);
  const b = w.staffOf('baito');
  assert.deepEqual([b.x, b.y], [SCENE.staff.baito.x, SCENE.staff.baito.y]);
  assert.ok(b.hide, '木箱の後ろ');
  t = 60000; w.update(16); // しばらくすると、ひとこと
  assert.ok(b.bubble && b.anim !== 'idle');
  t += 5000; w.update(16);
  assert.equal(b.bubble, null);
  assert.equal(b.anim, 'idle');
  w.syncStaff(['deshi']);
  assert.equal(w.staffOf('baito'), undefined);
});
