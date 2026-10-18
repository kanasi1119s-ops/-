// 【仮置き】の一覧を書き出す: node scripts/placeholders.js > docs/placeholders.md
// src/config.js の行のうち「【仮置き】」とコメントのある行を、どの項目の中にあるか（見出し）と値・理由つきで並べる。
import fs from 'node:fs';
const FILES = ['src/config.js', ...fs.readdirSync(new URL('../data/', import.meta.url)).filter((f) => f.endsWith('.js')).map((f) => `data/${f}`)];
const out = ['# 仮置きの一覧', '', '`src/config.js` と `data/` で【仮置き】とコメントした値（出典がなく、遊びの釣り合いで決めたもの）。`node scripts/placeholders.js > docs/placeholders.md` で作り直せる。', ''];
let n = 0;
for (const file of FILES) {
const src = fs.readFileSync(new URL(`../${file}`, import.meta.url), 'utf8').split('\n');
const stack = [];
if (!src.some((l) => l.includes('【仮置き】') && !/^\s*\/\//.test(l))) continue; // 仮置きのない定義はのせない
out.push(`## ${file}`, '', '| 行 | 項目 | 値 | 理由・メモ |', '| --- | --- | --- | --- |');
src.forEach((line, i) => {
  if (/^\s*\/\//.test(line)) return; // コメントだけの行（説明）はとばす
  const idm = line.match(/^\s*id:\s*'([\w]+)'/);
  if (idm) stack.push(idm[1]);
  const code = line.replace(/\/\/.*$/, '');
  const open = code.match(/^\s*([A-Za-z_$][\w$]*)\s*:\s*\{\s*$/);
  if (open) stack.push(open[1]);
  if (line.includes('【仮置き】')) {
    const [c, note = ''] = line.split('//');
    const m = c.trim().replace(/,$/, '');
    const path = [...stack, (m.match(/^([A-Za-z_$][\w$]*)\s*:/) || [])[1]].filter(Boolean).join('.');
    const val = m.replace(/^([A-Za-z_$][\w$]*)\s*:\s*/, '').replace(/\|/g, '\\|');
    out.push(`| ${i + 1} | ${path || '—'} | \`${val.length > 70 ? val.slice(0, 67) + '…' : val}\` | ${note.replace('【仮置き】', '').trim().replace(/\|/g, '\\|')} |`);
    n++;
  }
  const opens = (code.match(/\{/g) || []).length - (open ? 1 : 0), closes = (code.match(/\}/g) || []).length;
  for (let k = 0; k < opens; k++) stack.push('');
  for (let k = 0; k < closes; k++) stack.pop();
});
out.push('');
}
// 全国の漬物（data/regional.js）: 1行に数値がまとめてあるので、資料にない数値を漬物ごとに並べる
const { REGIONAL } = await import('../data/regional.js');
const { PREFECTURE_PICKLES } = await import('../data/prefectures.js');
out.push('## data/regional.js（全国の漬物）', '', '資料の「numbers」にない数値は仮置き。値段・店のレベル・食べ頃の長さ・漬け方ごとの性質（METHODS）はすべて仮置き。', '', '| 資料 | 漬物 | 仮置きの数値 |', '| --- | --- | --- |');
for (const r of REGIONAL) {
  const d = PREFECTURE_PICKLES.find((x) => x.id === r.ref), src = new Set(r.src ?? []);
  const miss = [r.salt && !src.has('salt') ? `塩 ${r.salt.join('〜')}%` : null, !src.has('temp') ? `温度 ${r.temp.join('〜')}℃` : null, !src.has('days') ? `日数 ${r.days}` : null, `値段 ${r.price}円`].filter(Boolean);
  out.push(`| ${r.ref} | ${d.prefecture} ${d.name} | ${miss.join(' ・ ')}${r.unknown ? '（資料に数値の記載なし）' : ''} |`);
  n += miss.length;
}
out.push('');
out.push(`合計 ${n} 件`);
console.log(out.join('\n'));
