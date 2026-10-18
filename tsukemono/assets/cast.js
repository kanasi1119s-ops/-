// 物語の人物の絵（ドット絵エディタで描いた assets/img/baron_<番号>.png・tama_<番号>.png。tools/cast_art.py → tools/editor_touch.mjs）。
import { TRACE } from './trace.js';

export const BARON_HAT = 22; // 男爵の絵は、背広の紳士の絵（pose_suit_*）の上を、シルクハットの分だけ広げてある（足の位置は同じ）
export const CAST_BODIES = {
  // 漬物男爵: 0・1 歩く、2・3 話す（手を挙げる）
  baron: { kind: 'poses', faces: 'right', poses: [0, 1, 2, 3].map((i) => ({ ...TRACE.poses.suit[i], h: TRACE.poses.suit[i].h + BARON_HAT, img: `baron_${i}` })) },
  // 審査員長タマ殿（白黒のハチワレ。いただいた参考の絵 assets/reference/tama_reference.webp から）: 0 座る、1 まばたき、2 丸くなって寝る、3 しっぽの先を上げる
  tama: { kind: 'poses', faces: 'front', poses: [{ w: 36, h: 52, ax: 17, img: 'tama_0' }, { w: 36, h: 52, ax: 17, img: 'tama_1' }, { w: 44, h: 24, ax: 22, img: 'tama_2' }, { w: 36, h: 52, ax: 17, img: 'tama_3' }] },
};
export const CAST_IMAGES = Object.values(CAST_BODIES).flatMap((b) => b.poses.map((p) => p.img));
