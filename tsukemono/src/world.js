// 店先の人の動かし方（段取り）。ゲームの結果を受けて、客と店主を動かすだけ。
// 状態は一切書き換えない。止めても遊びは進む（結果は game.js が先に確定している）。
import { SCENE } from '../assets/scene.js';
import { KEEPER_LOOK, randomLook, regularLook, REGULAR_LINES, AMBIENT_LINES, BODIES } from '../assets/characters.js';
import { POSE_ANIMS } from '../assets/animations.js';
import { ANGRY_KEYS } from '../assets/faces.js';
import { STAFF } from '../data/staff.js';
import { TAMA_LINES } from '../data/rivals.js';

const WALK_SPEED = 96; // px/秒 【仮置き】歩くコマ（150ms×2で1歩）と合う速さ

export class World {
  constructor(nowFn = () => performance.now()) {
    this.now = nowFn;
    this.speed = 1;
    this.actors = [];
    this.effects = []; // 画面の上に出す絵（オーバーリアクションの描き文字）{ img, x, y, t0, dur }
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
  /** 描き文字（ドットの絵）を、店先の (x, y) を中心に dur ミリ秒だけ出す */
  burst(img, x, y, dur = 1500) {
    const now = this.now();
    this.effects = this.effects.filter((e) => now - e.t0 < e.dur);
    this.effects.push({ img, x, y, t0: now, dur });
  }
  setAnim(a, name) { if (a.anim !== name) { a.anim = name; a.animT0 = this.now(); } }
  /** その人にその動きがあるか（子どもには驚いた顔がない） */
  hasAnim(a, name) { return BODIES[a.look?.body]?.kind === 'poses' && !!POSE_ANIMS[a.look.body]?.[name]; }

  // ---- 従業員（店先の決まった所に立って、ときどき話したり仕事をしたりする）----
  /** 雇っている人（data/staff.js の id）に合わせて、店先に出したり帰したりする */
  syncStaff(ids) {
    for (const a of this.actors.filter((a) => a.kind === 'staff' && !ids.includes(a.staffId))) this.remove(a);
    for (const id of ids) {
      const spot = SCENE.staff[id];
      if (!spot || this.staffOf(id)) continue;
      const a = this.spawn('staff', { body: `staff_${id}` }, spot.x, spot.y, 'idle');
      Object.assign(a, { staffId: id, dir: spot.dir, hide: spot.hide ?? null, chatter: STAFF.find((s) => s.id === id)?.chatter ?? [] });
      this.startChatter(a);
    }
  }
  staffOf(id) { return this.actors.find((a) => a.kind === 'staff' && a.staffId === id); }
  /** 従業員に一言しゃべらせる（anim: talk / work）。話している最中なら言わない */
  staffSay(id, line, anim = 'talk', ms = 2400) { return this.chat(this.staffOf(id), line, anim, ms); }
  // ---- 店先にいて、ときどきひとこと言う人（従業員・タマ殿）。chatter = [[言葉, 動き], ...]、rest = 黙っているときの動き ----
  startChatter(a) { Object.assign(a, { until: 0, nextAt: this.now() + 4000 + Math.random() * 8000 }); }
  chat(a, line, anim = 'talk', ms = 2400) {
    if (!a || a.until) return false;
    a.bubble = line; this.setAnim(a, anim); a.until = this.now() + ms;
    return true;
  }
  updateChatter() {
    const now = this.now();
    for (const a of this.actors.filter((a) => a.chatter)) {
      if (a.until && now >= a.until) { a.bubble = null; this.setAnim(a, a.rest ?? 'idle'); a.until = 0; a.nextAt = now + 14000 + Math.random() * 16000; continue; }
      if (!a.until && now >= a.nextAt) {
        const [line, anim] = a.chatter[Math.floor(Math.random() * a.chatter.length)] ?? [null, 'work'];
        if (line) this.chat(a, line, anim);
        else { this.setAnim(a, 'work'); a.until = now + 2400; }
      }
    }
  }

  // ---- 物語の人物 ----
  /** タマ殿: mode = 'judge'（対決のあいだ、樽の上で審査）/ 'nap'（終章のあと、屋根で寝る）/ null（いない） */
  syncCast({ tama = null } = {}) {
    let t = this.actors.find((a) => a.kind === 'cast' && a.castId === 'tama');
    if (t && t.mode !== tama) { this.remove(t); t = null; }
    if (!t && tama) {
      const spot = tama === 'judge' ? SCENE.cast.tamaJudge : SCENE.cast.tamaNap, rest = tama === 'judge' ? 'idle' : 'sleep';
      t = this.spawn('cast', { body: 'tama' }, spot.x, spot.y, rest);
      Object.assign(t, { castId: 'tama', mode: tama, rest, chatter: TAMA_LINES[tama].map((l) => [l, rest === 'sleep' ? 'sleep' : 'talk']) });
      this.startChatter(t);
    }
  }
  /** 漬物男爵が右から来て、言うだけ言って帰る（ゲームの状態は変えない）。laugh: 最後に「ふはは」と胸をそらす */
  async baronVisit(lines, { laugh = true } = {}) {
    if (this.actors.some((a) => a.castId === 'baron')) return;
    const b = this.spawn('cast', { body: 'baron' }, SCENE.lane.startX, SCENE.lane.y - 4, 'walk');
    b.castId = 'baron';
    await this.walkTo(b, SCENE.cast.baronX);
    b.dir = -1;
    for (const l of lines) { this.setAnim(b, 'talk'); b.bubble = l; await this.wait(2600); }
    if (laugh) { this.setAnim(b, 'laugh'); await this.wait(900); }
    b.bubble = null;
    this.setAnim(b, 'walk');
    await this.walkTo(b, SCENE.lane.endX);
    this.remove(b);
  }

  /** dt(ms) ぶん進める。 */
  update(dtMs) {
    this.updateChatter();
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
    const who = look ?? (v.claimer ? regularLook(v.claimer.look) : v.regular ? regularLook(v.regular.look, v.customer?.id) : randomLook(Math.random, season, v.customer?.id));
    const c = this.spawn('customer', who, lane.startX, lane.y, 'walk');
    const wel = STAFF.find((s) => s.id === 'kanban')?.welcome;
    if (wel && Math.random() < 0.5) this.staffSay('kanban', wel[Math.floor(Math.random() * wel.length)], 'talk', 1800); // 看板店員の呼びこみ
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
    if (v.claimer) { // 難癖のお客: 買わずに文句を言って、言うだけ言って帰る
      this.setAnim(c, this.hasAnim(c, 'angry') ? 'angry' : 'talk'); // 怒った顔で、ぷるぷる震えながら
      onTalk?.(v);
      for (const l of v.claimer.lines) { c.bubble = l; await this.wait(2000); }
      c.bubble = null;
      release();
      this.setAnim(c, 'walk');
      await this.walkTo(c, lane.endX);
      this.remove(c);
      return;
    }
    if (!v.soldOut) {
      await this.keeperTake();
      await this.keeperGive();
    }
    if (v.bought) { this.setAnim(c, 'buy'); await this.wait(1100); }
    c.over = !!v.reaction?.over; // オーバーリアクション（大きな吹き出しで、長めに。驚いた顔でぴょんと跳ねる）
    // 傷んでいた・しょっぱすぎる・すっぱすぎる…は怒った顔（assets/faces.js の ANGRY_KEYS）
    const mad = ANGRY_KEYS.includes(v.reaction?.key) && (c.over || v.reaction.key === 'rotten') && this.hasAnim(c, 'angry');
    this.setAnim(c, mad ? 'angry' : c.over && this.hasAnim(c, 'surprise') ? 'surprise' : v.bought ? 'talk_basket' : 'talk');
    if (c.over) this.setAnim(this.keeper, 'surprise'); // 店主もびっくり（ほめられても、怒られても）
    c.bubble = line ?? v.reaction.line;
    onTalk?.(v);
    await this.wait(c.over ? 3600 : 1900);
    if (c.over) this.setAnim(this.keeper, 'idle');
    c.over = false;
    if (mad) this.setAnim(c, v.bought ? 'talk_basket' : 'talk');
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
