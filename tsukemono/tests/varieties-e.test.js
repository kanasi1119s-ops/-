import test from 'node:test';
import assert from 'node:assert/strict';
import { CONFIG } from '../src/config.js';
import { VEGETABLES, vegetablesFrom } from '../data/vegetables.js';
import { PICKLES, picklesFrom } from '../data/pickles.js';
import { createGame, bookTotal } from '../src/game.js';
import { simulate, daysToRipe } from '../src/model.js';

const DAY = CONFIG.calendar.ticksPerDay;
const lv = (n) => CONFIG.levels.find((l) => l.level === n).xp;
const taste = (veg, extra = {}, cfg = CONFIG) => simulate({ veg, pickle: 'asazuke', saltPct: 3, tempC: 20, days: 1, ...extra }, cfg);

test('野菜はデータの定義から作られ、水分量・塩の入り方・食感の変わり方を持つ', () => {
  assert.deepEqual(Object.keys(CONFIG.vegetables), VEGETABLES.map((v) => v.id));
  for (const v of Object.values(CONFIG.vegetables)) {
    assert.ok(v.water > 0.5 && v.water < 1, v.name); // 鯖（魚）は約6割
    assert.ok(v.saltUptake > 0 && v.crisp0 > 0 && v.crispTau > 0, v.name);
  }
  assert.throws(() => vegetablesFrom([...VEGETABLES, { id: 'x', name: 'x' }]), /water|saltUptake/);
  assert.throws(() => vegetablesFrom([...VEGETABLES, VEGETABLES[0]]), /かぶっている/);
});

test('塩の入り方: 葉物（野沢菜）は早く、かたい根（大根）は遅い', () => {
  assert.ok(taste('nozawana', { pickle: 'nozawanazuke', days: 0.3 }).saltiness > taste('daikon', { days: 0.3 }).saltiness);
  assert.ok(taste('kyabetsu').saltiness > taste('daikon').saltiness);
});

test('水分量: 水分の多い野菜ほど塩味が薄まる（ほかを同じにして比べる）', () => {
  const cfg = { ...CONFIG, vegetables: { ...CONFIG.vegetables, wet: { ...CONFIG.vegetables.kabu, water: 0.96 }, dry: { ...CONFIG.vegetables.kabu, water: 0.88 } } };
  assert.ok(taste('dry', {}, cfg).saltiness > taste('wet', {}, cfg).saltiness);
});

test('食感の変わり方: 5日漬けると、きゅうりはやわらかく、大根はまだポリポリ', () => {
  assert.ok(taste('daikon', { days: 5 }).texture > taste('kyuri', { days: 5 }).texture + 20);
});

test('データで足せる: 野菜を1件足し、漬物の定義に入れると、仕入れて仕込める', () => {
  const veg = { id: 'gobo', name: 'ごぼう', water: 0.81, saltUptake: 0.7, fermentRate: 0.7, crisp0: 95, crispTau: 90, spoilMult: 0.8, cost: 400, seasons: { spring: 1, summer: 1.2, autumn: 0.8, winter: 0.9 } };
  const pk = PICKLES.map((p) => (p.id === 'asazuke' ? { ...p, vegetables: [...p.vegetables, 'gobo'] } : p));
  const cfg = { ...CONFIG, ...vegetablesFrom([...VEGETABLES, veg]), ...picklesFrom(pk) };
  cfg.market = { ...CONFIG.market, priceBySeason: vegetablesFrom([...VEGETABLES, veg]).priceBySeason };
  const g = createGame({ cfg });
  assert.ok(g.vegCost('gobo') > 0);
  assert.equal(g.buyStock('gobo', 6).ok, true);
  assert.equal(g.brew(0, { veg: 'gobo', pickle: 'asazuke', saltPct: 3, tempC: 20 }).ok, true);
  assert.ok(g.tasteOf(0));
  assert.equal(bookTotal(cfg), bookTotal(CONFIG) + 37);
});

test('干す: たくあんは干した日数だけ樽がふさがり、食感と塩味が締まり、傷みにくくなる', () => {
  const g = createGame({ seed: 1 });
  g.money = 1e5;
  assert.equal(g.brew(0, { veg: 'daikon', pickle: 'takuan', saltPct: 5, tempC: 15, dry: 20 }).ok, false); // 干しすぎ
  g.brew(0, { veg: 'daikon', pickle: 'takuan', saltPct: 5, tempC: 15, dry: 0 });
  g.brew(1, { veg: 'daikon', pickle: 'takuan', saltPct: 5, tempC: 15, dry: 8 });
  g.advance(DAY * 3);
  assert.equal(g.tasteOf(1).stageLabel, '干している');
  assert.equal(g.dryingLeft(g.barrels[1]), 5);
  const plain = simulate({ veg: 'daikon', pickle: 'takuan', saltPct: 5, tempC: 15, days: 30 });
  const dried = simulate({ veg: 'daikon', pickle: 'takuan', saltPct: 5, tempC: 15, days: 30, dry: 8 });
  assert.ok(dried.texture > plain.texture);
  assert.ok(dried.saltiness > plain.saltiness);
  assert.ok(dried.spoilRisk < plain.spoilRisk);
  // 仕込みの窓で日数を選ばないと、定義の default（7日）干す
  g.brew(2, { veg: 'daikon', pickle: 'takuan', saltPct: 5, tempC: 15 });
  assert.equal(g.barrels[2].dry, CONFIG.pickles.takuan.drying.default);
});

test('梅干し: 壺がいる。塩18%で約1か月、ほとんど傷まない', () => {
  const g = createGame({ seed: 2 });
  g.money = 1e5;
  const r = { veg: 'ume', pickle: 'umeboshi', saltPct: 18, tempC: 20 };
  const no = g.brew(0, r);
  assert.equal(no.ok, false);
  assert.match(no.error, /壺/);
  g.addXp(lv(2)); g.buyPlace('tsubo');
  assert.equal(g.brew(0, r).ok, true);
  const d = daysToRipe(r);
  assert.ok(d > 20 && d < 40, `${d}日`);
  const t = simulate({ ...r, days: 60 });
  assert.ok(t.spoilRisk < 5 && t.acid > 70 && t.stage === 'ripe');
});

test('梅酢: 梅が梅酢から出るとカビやすい。重石を直して沈めれば防げ、カビは清潔なスプーンで取れる', () => {
  const mk = () => { const g = createGame({ seed: 3 }); g.money = 1e5; g.addXp(lv(2)); g.buyPlace('tsubo'); g.brew(0, { veg: 'ume', pickle: 'umeboshi', saltPct: 18, tempC: 22 }); return g; };
  const lazy = mk(), careful = mk();
  for (let d = 0; d < 14; d++) {
    careful.sink(0);
    lazy.advance(DAY); careful.advance(DAY);
  }
  assert.ok(lazy.barrels[0].exposed > CONFIG.umezu.safe);
  assert.ok(lazy.barrels[0].film > careful.barrels[0].film * 2, `${lazy.barrels[0].film} > ${careful.barrels[0].film}`);
  assert.equal(lazy.sink(0).ok, true);
  assert.equal(lazy.barrels[0].exposed, 0);
  assert.equal(lazy.care(0).ok, true); // スプーンでカビを取る
  assert.equal(lazy.barrels[0].film, 0);
  assert.equal(lazy.sink(1).ok, false);
});

test('ぬか床: 水分の多い野菜（白瓜）を漬けると、少ない野菜（にんじん）より床が水っぽくなる', () => {
  const a = createGame({ seed: 4 }), b = createGame({ seed: 4 });
  a.brew(0, { veg: 'shirouri', pickle: 'nukazuke', saltPct: 0, tempC: 20 });
  b.brew(0, { veg: 'ninjin', pickle: 'nukazuke', saltPct: 0, tempC: 20 });
  assert.ok(a.nuka.water > b.nuka.water);
});

test('調味の相性: 売って初めてわかり、レシピ帳に載る（知らせが出る）', () => {
  const g = createGame({ seed: 5 });
  g.brew(0, { veg: 'hakusai', pickle: 'hakusaizuke', saltPct: 3, tempC: 20, additives: ['kombu'], count: 60 });
  g.advance(25); g.weather = 'sunny'; g.popEvents();
  const r = g.sell(0);
  const ev = g.popEvents().filter((e) => e.type === 'affinity');
  if (!r.spoiled && r.visitors.some((v) => !v.claimer && !v.soldOut)) {
    assert.deepEqual(ev.map((e) => [e.additive, e.aff]), [['kombu', 'good']]);
    g.advance(1); g.weather = 'sunny';
    g.sell(0);
    assert.equal(g.popEvents().filter((e) => e.type === 'affinity').length, 0); // 2回目は出ない
  }
});
