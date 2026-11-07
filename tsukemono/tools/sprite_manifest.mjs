// 人物の絵の一覧（だれの・どの動作で・どの絵を・どこを足もとにして描くか）を JSON で書き出す。
//   node tools/sprite_manifest.mjs > 出力.json
// tools/sprite_audit.py（絵の点検）が読む。ゲームの定義（assets/characters.js・walk.js・animations.js）から作るので、手で書かない。
import { BODIES } from '../assets/characters.js';
import { WALK } from '../assets/walk.js';
import { POSE_ANIMS, PERSON_ANIMS } from '../assets/animations.js';

// 依頼の動作名（歩く／見る／買う／しゃべる／取る／漬ける／渡す／待つ）に合わせた呼び名
const ACTION_JA = {
  walk: '歩く', walk_basket: '歩く（かご）', idle: '待つ', look: '見る', buy: '買う', talk: 'しゃべる', talk_basket: 'しゃべる（かご）',
  take: '取る', salt: '漬ける', give: '渡す', greet: 'あいさつ', surprise: '驚く', angry: '怒る', work: '仕事', laugh: '笑う', sleep: '寝る',
};

const out = { actions_ja: ACTION_JA, chars: {} };
for (const [name, body] of Object.entries(BODIES)) {
  const ch = { kind: body.kind, faces: body.faces, frames: {}, actions: {}, loops: {} };
  if (body.kind === 'poses') {
    body.poses.forEach((p, i) => { ch.frames[p.img] = { w: p.w, h: p.h, ax: p.ax, below: p.below ?? 0, waist: p.waist ?? null, pose: i }; });
    for (const [k, w] of (WALK[name] ?? []).entries()) ch.frames[w.img] = { w: w.w, h: w.h, ax: w.ax, below: w.below ?? 0, waist: w.waist ?? null, walk: k };
    for (const [act, a] of Object.entries(POSE_ANIMS[name] ?? {})) {
      ch.loops[act] = !!a.loop;
      ch.actions[act] = a.frames.map((f) => ({ img: f.walk != null ? WALK[name][f.walk].img : body.poses[f.pose].img, ms: f.ms, up: f.up ?? 0, dy: f.dy ?? 0, props: (f.props ?? []).map((p) => p.s) }));
    }
  } else {
    ch.frames[body.img] = { shift: true, hipY: body.hipY, legX: body.legX, headY: body.headY };
    for (const [act, a] of Object.entries(PERSON_ANIMS)) {
      ch.loops[act] = !!a.loop;
      ch.actions[act] = a.frames.map((f) => ({ img: body.img, ms: f.ms, up: f.up ?? [0, 0], head: f.head ?? [0, 0], legs: f.legs ?? [0, 0], props: (f.props ?? []).map((p) => p.s) }));
    }
  }
  out.chars[name] = ch;
}
console.log(JSON.stringify(out, null, 1));
