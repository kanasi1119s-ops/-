import test from 'node:test';
import assert from 'node:assert/strict';
import { parseMML } from '../src/audio.js';

test('MML: 音の高さと長さ', () => {
  const { notes, beats } = parseMML('o4 l8 c d4 r e-. >c');
  assert.deepEqual(notes.map((n) => n.midi), [60, 62, null, 63, 72]);
  assert.equal(beats, 0.5 + 1 + 0.5 + 0.75 + 0.5);
});

import { SONGS } from '../src/audio.js';
test('BGM: どの曲もパートの長さがそろっている（くり返しでずれない）', () => {
  for (const [name, s] of Object.entries(SONGS)) {
    const lens = s.tracks.map((t) => parseMML(t.mml).beats);
    assert.ok(lens.every((l) => l === lens[0]), `${name}: ${lens}`);
  }
});
