// 【仮置き】の一覧を書き出す: node scripts/placeholders.js > docs/placeholders.md
// src/config.js の行のうち「【仮置き】」とコメントのある行を、どの項目の中にあるか（見出し）と値・理由つきで並べる。
import fs from 'node:fs';
const src = fs.readFileSync(new URL('../src/config.js', import.meta.url), 'utf8').split('\n');
const stack = [];
const out = ['# 仮置きの一覧', '', '`src/config.js` で【仮置き】とコメントした値（出典がなく、遊びの釣り合いで決めたもの）。`node scripts/placeholders.js` で作り直せる。', '', '| 行 | 項目 | 値 | 理由・メモ |', '| --- | --- | --- | --- |'];
let n = 0;
src.forEach((line, i) => {
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
out.push('', `合計 ${n} 件`);
console.log(out.join('\n'));
