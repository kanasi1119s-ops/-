import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { CAST_BODIES, CAST_IMAGES } from '../assets/cast.js';
import { POSE_ANIMS } from '../assets/animations.js';
import { IMAGES } from '../assets/scene.js';
import { BARON_LINES, TAMA_LINES } from '../data/rivals.js';
import { World } from '../src/world.js';

const pngSize = (f) => { const b = fs.readFileSync(f); return [b.readUInt32BE(16), b.readUInt32BE(20)]; };

test('漬物男爵・タマ殿の絵: 読みこむ絵に入っていて、大きさが姿勢の表と同じ。動きはその絵を指す', () => {
  for (const [body, def] of Object.entries(CAST_BODIES)) {
    for (const p of def.poses) assert.deepEqual(pngSize(`assets/img/${p.img}.png`), [p.w, p.h], p.img);
    for (const [name, a] of Object.entries(POSE_ANIMS[body])) assert.ok(a.frames.every((f) => def.poses[f.pose]), `${body}.${name}`);
  }
  assert.ok(CAST_IMAGES.every((n) => IMAGES.includes(n)));
  for (const k of ['rival', 'battle', 'friend']) assert.ok(BARON_LINES[k].length >= 3);
  for (const k of ['judge', 'nap']) assert.ok(TAMA_LINES[k].length >= 2);
});

test('タマ殿: 対決のあいだは樽の上、終章のあとは屋根の上で寝る。いなくなる', () => {
  const w = new World(() => 0);
  w.syncCast({ tama: 'judge' });
  const t = w.actors.find((a) => a.castId === 'tama');
  assert.equal(t.anim, 'idle');
  w.syncCast({ tama: 'judge' });
  assert.equal(w.actors.filter((a) => a.castId === 'tama').length, 1);
  w.syncCast({ tama: 'nap' });
  assert.equal(w.actors.find((a) => a.castId === 'tama').anim, 'sleep');
  w.syncCast({ tama: null });
  assert.equal(w.actors.some((a) => a.castId === 'tama'), false);
});

test('漬物男爵: 右から来て、言うだけ言って帰る', async () => {
  let t = 0;
  const w = new World(() => t);
  const done = w.baronVisit(['ふはは！']);
  const b = w.actors.find((a) => a.castId === 'baron');
  let said = false;
  for (let i = 0; i < 4000 && w.actors.includes(b); i++) { t += 50; w.update(50); await new Promise((r) => setImmediate(r)); if (b.bubble === 'ふはは！') said = true; }
  await done;
  assert.ok(said);
  assert.equal(w.actors.includes(b), false);
});
