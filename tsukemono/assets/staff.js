// 従業員の絵（ドット絵エディタで描いた assets/img/staff_<id>_<番号>.png。tools/staff_art.py → tools/editor_touch.mjs）。
// base = 元にした人、poses = 元の姿勢の番号（絵の大きさと足の位置はその姿勢と同じ）
export const STAFF_ART = {
  baito: { base: 'keeper', poses: [0, 1, 2] }, // 腕組み・手を挙げる・かがんで野菜を取る
  kanban: { base: 'volley', poses: [2, 3] }, // 呼びこみ（手を広げる2枚）
  deshi: { base: 'karate', poses: [3, 7] }, // 重石を提げる・重石を差し出す
};
export const STAFF_IMAGES = Object.entries(STAFF_ART).flatMap(([id, s]) => s.poses.map((i) => `staff_${id}_${i}`));
