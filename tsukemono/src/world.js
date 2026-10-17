// 店先の人の動かし方（段取り）。ゲームの結果を受けて、客と店主を動かすだけ。
// 状態は一切書き換えない。止めても遊びは進む（結果は game.js が先に確定している）。
import { SCENE } from '../assets/scene.js';
import { KEEPER_LOOK, randomLook, regularLook, REGULAR_LINES, AMBIENT_LINES } from '../assets/characters.js';

const WALK_SPEED = 96; // px/秒 【仮置き】歩くコマ（150ms×2で1歩）と合う速さ

export class World {
  constructor(nowFn = () => performance.now()) {
    this.now = nowFn;
    this.speed = 1;
    this.actors = [];
    this.waits = [];
    this.moves = [];
    this.busy = 0; // 実行中の場面の数
    this.standFree = Promise.resolve();
    this.queue = []; // 並んで待っている客（先頭が次に買う）
    // 店主は、のれんの下の入口に立つ。座標は足元の中心。客のいる右を向く
    this.keeper = this.spawn('keeper', KEEPER_LOOK, SCENE.keeperFeet.x, SCENE.keeperFeet.y, 'idle');
    this.keeper.dir = 1;
  }

  spawn(kind, look, x, y, anim) {
    const a = { kind, look, x, y, dir: -1, anim, animT0: this.now(), bubble: null };
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
    if (x !== actor.x) actor.dir = x > actor.x ? 1 : -1; // 進む向き（絵の向きと逆なら描くときに反転）
    // 歩いている途中で行き先が変わったら、前の歩きは打ち切る
    for (const m of this.moves.filter((m) => m.actor === actor)) m.resolve();
    this.moves = this.moves.filter((m) => m.actor !== actor);
    return new Promise((resolve) => this.moves.push({ actor, x, speed, resolve }));
  }

  /** 列の位置（先頭から順に右へ並ぶ）。 */
  queueX(i) { return SCENE.lane.queueX + i * SCENE.lane.queueGap; }
  /** 列が進んだら、後ろの客を詰めさせる。 */
  stepQueue() {
    this.queue.forEach((c, i) => {
      if (c.x === this.queueX(i)) return;
      this.setAnim(c, 'walk');
      this.walkTo(c, this.queueX(i)).then(() => { if (c.x === this.queueX(this.queue.indexOf(c))) { c.dir = -1; this.setAnim(c, 'idle'); } });
    });
  }

  // ---- 店主（入口から動かず、コマ送りで動く）----
  async keeperSalt() {
    this.setAnim(this.keeper, 'salt');
    await this.wait(1800);
    this.setAnim(this.keeper, 'idle');
  }
  async keeperGreet() {
    this.setAnim(this.keeper, 'greet');
    await this.wait(750);
  }
  async keeperTake() {
    this.setAnim(this.keeper, 'take');
    await this.wait(1000);
  }
  async keeperGive() {
    this.setAnim(this.keeper, 'give');
    await this.wait(1350);
    this.setAnim(this.keeper, 'idle');
  }

  // ---- 客 ----
  /** 客1人の来店〜退店。v = { customer, bought, soldOut, reaction }。見た目は look（なければランダム）。 */
  async serve(v, { look, line, onTalk, season = null } = {}) {
    const lane = SCENE.lane;
    const who = look ?? (v.regular ? regularLook(v.regular.look, v.customer?.id) : randomLook(Math.random, season, v.customer?.id));
    const c = this.spawn('customer', who, lane.startX, lane.y, 'walk');
    const prevFree = this.standFree;
    let release;
    this.standFree = new Promise((r) => { release = r; });
    this.queue.push(c);
    await this.walkTo(c, this.queueX(this.queue.indexOf(c)));
    if (this.queue.includes(c)) { c.dir = -1; this.setAnim(c, 'idle'); }
    await prevFree;
    this.queue.splice(this.queue.indexOf(c), 1);
    this.stepQueue();
    this.setAnim(c, 'walk');
    await this.walkTo(c, lane.standX);
    c.dir = -1; // 店のほうを向く
    this.setAnim(c, 'look');
    if (v.regular && !v.regular.joined) { // 常連はあいさつしてくる
      c.bubble = REGULAR_LINES.hello[Math.floor(Math.random() * REGULAR_LINES.hello.length)];
      await this.wait(1000);
      c.bubble = null;
    }
    await this.keeperGreet();
    if (!v.soldOut) {
      await this.keeperTake();
      await this.keeperGive();
    }
    if (v.bought) { this.setAnim(c, 'buy'); await this.wait(1100); }
    this.setAnim(c, v.bought ? 'talk_basket' : 'talk');
    c.bubble = line ?? v.reaction.line;
    onTalk?.(v);
    await this.wait(1900);
    const after = v.regular?.joined ? REGULAR_LINES.joined : v.regular?.left ? REGULAR_LINES.left : null;
    if (after) { c.bubble = after; await this.wait(1200); }
    c.bubble = null;
    release();
    this.setAnim(c, v.bought ? 'walk_basket' : 'walk');
    await this.walkTo(c, lane.endX);
    this.remove(c);
  }

  /** 販売の結果を順に見せる。gaps = 客ごとの、前の客からの間（ms）。なければ 2.6 秒おき */
  async saleScene(visitors, season, onTalk, gaps = null) {
    this.busy++;
    try {
      const jobs = [];
      for (const [i, v] of visitors.entries()) {
        if (i > 0) await this.wait(gaps?.[i] ?? 2600); // 次の客は少し遅れて来る
        jobs.push(this.serve(v, { onTalk, season }));
      }
      await Promise.all(jobs);
    } finally { this.busy--; }
  }

  /** 手入れ（膜を取る・ぬか床をかき混ぜる）。 */
  async careScene() {
    this.busy++;
    try {
      this.setAnim(this.keeper, 'take');
      await this.wait(900);
      this.setAnim(this.keeper, 'idle');
    } finally { this.busy--; }
  }

  async brewScene() {
    this.busy++;
    try { await this.keeperSalt(); } finally { this.busy--; }
  }

  /** デモ用: 通りがかりの人が1つ買って帰る（ゲームの状態は変えない）。 */
  async ambientVisit(season = null) {
    this.busy++;
    try {
      const line = AMBIENT_LINES[Math.floor(Math.random() * AMBIENT_LINES.length)];
      await this.serve({ customer: { id: 'ambient' }, bought: true, reaction: { line } }, { look: randomLook(Math.random, season), line });
    } finally { this.busy--; }
  }
}
