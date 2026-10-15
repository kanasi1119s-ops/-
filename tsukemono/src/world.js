// 店先の人の動かし方（段取り）。ゲームの結果を受けて、客と店主を動かすだけ。
// 状態は一切書き換えない。止めても遊びは進む（結果は game.js が先に確定している）。
import { SCENE } from '../assets/scene.js';
import { TRACE } from '../assets/trace.js';
import { CUSTOMER_LOOKS, KEEPER_LOOK, randomLook, AMBIENT_LINES } from '../assets/characters.js';

const WALK_SPEED = 70; // px/秒 【仮置き】

export class World {
  constructor(nowFn = () => performance.now()) {
    this.now = nowFn;
    this.speed = 1;
    this.actors = [];
    this.waits = [];
    this.moves = [];
    this.busy = 0; // 実行中の場面の数
    this.standFree = Promise.resolve();
    // 店主は、絵に描かれていた場所（入口）に立つ。座標は足元の中心
    const [kx, ky, kw, kh] = TRACE.chars.keeper;
    this.keeper = this.spawn('keeper', KEEPER_LOOK, kx + kw / 2, ky + kh, 'idle');
  }

  spawn(kind, look, x, y, anim) {
    const a = { kind, look, x, y, flip: false, anim, animT0: this.now(), bubble: null };
    this.actors.push(a);
    return a;
  }
  remove(a) { this.actors = this.actors.filter((x) => x !== a); }
  setAnim(a, name) { if (a.anim !== name) { a.anim = name; a.animT0 = this.now(); } }

  /** dt(ms) ぶん進める。 */
  update(dtMs) {
    const dt = (dtMs / 1000) * this.speed;
    for (const m of this.moves) {
      const d = m.x - m.actor.x, step = m.speed * dt;
      if (Math.abs(d) <= step) { m.actor.x = m.x; m.done = true; } else m.actor.x += Math.sign(d) * step;
    }
    for (const m of this.moves.filter((m) => m.done)) m.resolve();
    this.moves = this.moves.filter((m) => !m.done);
    for (const w of this.waits) w.left -= dt * 1000;
    for (const w of this.waits.filter((w) => w.left <= 0)) w.resolve();
    this.waits = this.waits.filter((w) => w.left > 0);
  }

  wait(ms) { return new Promise((resolve) => this.waits.push({ left: ms, resolve })); }
  walkTo(actor, x, speed = WALK_SPEED) {
    actor.flip = x > actor.x; // 絵は左向き。右へ歩くときは反転
    return new Promise((resolve) => this.moves.push({ actor, x, speed, resolve }));
  }

  // ---- 店主（入口から動かず、コマ送りで動く）----
  async keeperSalt() {
    this.setAnim(this.keeper, 'salt');
    await this.wait(1800);
    this.setAnim(this.keeper, 'idle');
  }
  async keeperTake() {
    this.setAnim(this.keeper, 'take');
    await this.wait(1000);
  }
  async keeperGive() {
    this.setAnim(this.keeper, 'give');
    await this.wait(900);
    this.setAnim(this.keeper, 'idle');
  }

  // ---- 客 ----
  /** 客1人の来店〜退店。v = { customer, bought, soldOut, reaction }。 */
  async serve(v, { look, line, onTalk } = {}) {
    const lane = SCENE.lane;
    const c = this.spawn('customer', look ?? CUSTOMER_LOOKS[v.customer.id], lane.startX, lane.y, 'walk');
    const prevFree = this.standFree;
    let release;
    this.standFree = new Promise((r) => { release = r; });
    await this.walkTo(c, lane.queueX);
    this.setAnim(c, 'idle');
    await prevFree;
    this.setAnim(c, 'walk');
    await this.walkTo(c, lane.standX);
    this.setAnim(c, 'look');
    await this.wait(700);
    if (!v.soldOut) {
      await this.keeperTake();
      await this.keeperGive();
    }
    if (v.bought) { this.setAnim(c, 'buy'); await this.wait(1100); }
    this.setAnim(c, v.bought ? 'talk_basket' : 'talk');
    c.bubble = line ?? v.reaction.line;
    onTalk?.(v);
    await this.wait(1900);
    c.bubble = null;
    release();
    this.setAnim(c, v.bought ? 'walk_basket' : 'walk');
    await this.walkTo(c, lane.endX);
    this.remove(c);
  }

  /** 販売の結果を順に見せる。 */
  async saleScene(visitors, _slot, onTalk) {
    this.busy++;
    try {
      const jobs = [];
      for (const v of visitors) {
        jobs.push(this.serve(v, { onTalk }));
        await this.wait(2600); // 次の客は少し遅れて来る
      }
      await Promise.all(jobs);
    } finally { this.busy--; }
  }

  async brewScene() {
    this.busy++;
    try { await this.keeperSalt(); } finally { this.busy--; }
  }

  /** デモ用: 通りがかりの人が1つ買って帰る（ゲームの状態は変えない）。 */
  async ambientVisit() {
    this.busy++;
    try {
      const line = AMBIENT_LINES[Math.floor(Math.random() * AMBIENT_LINES.length)];
      await this.serve({ customer: { id: 'ambient' }, bought: true, reaction: { line } }, { look: randomLook(), line });
    } finally { this.busy--; }
  }
}
