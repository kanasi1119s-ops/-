// テストプレイ用に、ゲームを1つのHTMLファイルにまとめる。  npm run build
//   dist/tsukemono.html            … Artifact（claude.ai のページ）に載せる用（<html>/<head> なし）
//   dist/tsukemono-standalone.html … そのままブラウザで開ける用
// スクリプトは esbuild でまとめ、絵（assets/img/*.png）は data URL で埋め込む。
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const rd = (p) => fs.readFileSync(path.join(root, p), 'utf8');
let js;
try {
  js = execFileSync('npx', ['--yes', 'esbuild@0.20.2', 'src/main.js', '--bundle', '--format=esm', '--minify', '--target=es2022', '--charset=utf8'], { cwd: root, encoding: 'utf8', maxBuffer: 64 << 20 });
} catch (e) {
  console.error('esbuild を動かせませんでした（ネットにつながっているか確認してください）。', e.message);
  process.exit(1);
}
const imgDir = path.join(root, 'assets/img');
const images = Object.fromEntries(fs.readdirSync(imgDir).filter((f) => f.endsWith('.png')).sort()
  .map((f) => [f.replace(/\.png$/, ''), `data:image/png;base64,${fs.readFileSync(path.join(imgDir, f)).toString('base64')}`]));
const html = rd('index.html');
const markup = html.slice(html.indexOf('<!--GAME-->') + 11, html.indexOf('<!--/GAME-->')).trim();
const css = rd('style.css');
const safe = (s) => s.replace(/<\/script/gi, '<\\/script');
const parts = [
  '<title>俺の漬物！最強の漬物への道</title>',
  '<meta name="claude:viewport-fit-sides" content="cover">',
  '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Yuji+Syuku&family=Zen+Old+Mincho:wght@400;600;700;900&display=swap">',
  `<style>\n${css}</style>`,
  markup,
  `<script>window.TSUKEMONO_IMAGES=${safe(JSON.stringify(images))};</script>`,
  `<script type="module">\n${safe(js)}</script>`,
];
fs.mkdirSync(path.join(root, 'dist'), { recursive: true });
fs.writeFileSync(path.join(root, 'dist/tsukemono.html'), `${parts.join('\n')}\n`);
const standalone = `<!doctype html>\n<html lang="ja">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">\n${parts.slice(0, 4).join('\n')}\n</head>\n<body>\n${parts.slice(4).join('\n')}\n</body>\n</html>\n`;
fs.writeFileSync(path.join(root, 'dist/tsukemono-standalone.html'), standalone);
const kb = (f) => Math.round(fs.statSync(path.join(root, f)).size / 1024);
console.log(`dist/tsukemono.html ${kb('dist/tsukemono.html')}KB / dist/tsukemono-standalone.html ${kb('dist/tsukemono-standalone.html')}KB（絵${Object.keys(images).length}枚）`);
