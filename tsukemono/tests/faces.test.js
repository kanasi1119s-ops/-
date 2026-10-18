import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { SURPRISE_BASE, ANGRY_BASE } from '../assets/faces.js';
import { BODIES } from '../assets/characters.js';
import { POSE_ANIMS } from '../assets/animations.js';
import { TRACE } from '../assets/trace.js';

const pngSize = (f) => { const b = fs.readFileSync(f); return [b.readUInt32BE(16), b.readUInt32BE(20)]; };

test('驚いた顔・怒った顔: 絵があり、元の姿勢と同じ大きさ。動きはその絵を指す', () => {
  for (const [kind, base] of [['surprise', SURPRISE_BASE], ['angry', ANGRY_BASE]]) {
    for (const [name, i] of Object.entries(base)) {
      const src = TRACE.poses[name][i];
      assert.deepEqual(pngSize(`assets/img/${kind}_${name}.png`), [src.w, src.h], `${kind}_${name}`);
      const poses = BODIES[name].poses;
      const frames = POSE_ANIMS[name][kind].frames;
      assert.ok(frames.every((f) => poses[f.pose].img === `${kind}_${name}`), `${name}.${kind}`);
    }
  }
});
