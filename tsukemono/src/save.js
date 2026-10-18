// セーブとロード（段階H）。セーブには版番号を付け、古い版は順に新しい版へ直してから読む。
// 端末内のファイルに書き出し・読みこみできる形（JSON文字列）を作る。画面やブラウザの機能には頼らない。

/** いまのセーブの版。定義を足しても、古いセーブは MIGRATIONS で直してから読む */
export const SAVE_VERSION = 2;
export const SAVE_FORMAT = 'tsukemono-save';

/**
 * 版ごとの直し方。v → v+1。
 * 1 → 2: 段階C〜Gで足した項目（経験・作り方・在庫・物語・地方の枠・知恵袋など）は、無ければ game.restore が初期値で補う。
 *        ここでは版番号だけ上げる（古いセーブの図鑑から、成功した作り方を補うのは restore 側）。
 */
export const MIGRATIONS = {
  1: (s) => ({ ...s, v: 2 }),
};

/** ゲームの状態（snapshot）を、いまの版まで直す。直せなければ null */
export function migrateSnapshot(s) {
  if (!s || typeof s !== 'object' || !Number.isInteger(s.v)) return null;
  if (s.v > SAVE_VERSION) return null; // 新しい版のゲームで作ったセーブは読めない
  let cur = s;
  while (cur.v < SAVE_VERSION) {
    const step = MIGRATIONS[cur.v];
    if (!step) return null;
    cur = step(cur);
  }
  return cur;
}

/** ファイルに書く文字列 */
export function encodeSave(game, extra = {}) {
  return JSON.stringify({ format: SAVE_FORMAT, v: SAVE_VERSION, savedAt: new Date().toISOString(), game: game.snapshot(), ...extra }, null, 1);
}

/**
 * ファイルの文字列を読む。壊れていたら { ok: false, error }。読めたら { ok: true, data }（まだゲームには入れない）。
 * check = (snapshot) => boolean で、ためしに読みこめるか確かめる（別のゲームで restore してみる）。
 */
export function decodeSave(text, check = null) {
  let data;
  try { data = JSON.parse(text); } catch { return { ok: false, error: 'セーブのファイルが壊れています（読めない文字があります）' }; }
  if (!data || typeof data !== 'object') return { ok: false, error: 'セーブのファイルではありません' };
  if (data.format !== SAVE_FORMAT && !data.game) return { ok: false, error: 'この漬物屋のセーブではありません' };
  const g = data.game;
  if (!g || !Number.isInteger(g.v)) return { ok: false, error: 'セーブの中身が足りません' };
  if (g.v > SAVE_VERSION) return { ok: false, error: `新しい版（${g.v}）のセーブです。ゲームを新しくしてから読みこんでください` };
  const m = migrateSnapshot(g);
  if (!m) return { ok: false, error: '古すぎる、または形のおかしいセーブです' };
  if (check && !check(m)) return { ok: false, error: 'セーブの中身がおかしいので読みこめませんでした（今の店はそのままです）' };
  return { ok: true, data: { ...data, v: SAVE_VERSION, game: m }, migrated: g.v !== SAVE_VERSION };
}
