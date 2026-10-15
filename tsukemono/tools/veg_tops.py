# 樽の中身の絵（大根・野沢菜・なす）を、トレースした白菜・きゅうりの絵の色を置き換えて作る。
#   python3 tools/veg_tops.py   （tools/trace.py のあとに実行）
# 形（模様）はそのまま、色相・明るさだけ変える。ぼかしや拡大はしない。
import colorsys
import os
from PIL import Image

OUT = os.path.join(os.path.dirname(__file__), '..', 'assets', 'img')
# 作る絵: 元の絵, (色相 0〜1, 彩度の倍率, 明るさの倍率)
DERIVED = {
    'daikon': ('hakusai', (0.13, 0.35, 1.0)),   # 大根: 白に近い薄いクリーム色
    'nozawana': ('kyuri', (0.30, 1.0, 0.75)),   # 野沢菜: 濃い緑
    'nasu': ('kyuri', (0.78, 0.9, 0.55)),       # なす: 紫紺
    'takuan': ('hakusai', (0.14, 2.6, 0.95)),   # たくあん（漬物の色）: 黄色
}
for i in range(3):
    for name, (src, (hue, sat, light)) in DERIVED.items():
        im = Image.open(os.path.join(OUT, f'slot{i}_{src}.png')).convert('RGBA')
        px = im.load()
        for y in range(im.height):
            for x in range(im.width):
                r, g, b, a = px[x, y]
                if not a:
                    continue
                h, l, s = colorsys.rgb_to_hls(r / 255, g / 255, b / 255)
                r2, g2, b2 = colorsys.hls_to_rgb(hue, min(1, l * light), min(1, s * sat if src == 'kyuri' else max(s, 0.25) * sat + 0.1))
                px[x, y] = (round(r2 * 255), round(g2 * 255), round(b2 * 255), a)
        im.save(os.path.join(OUT, f'slot{i}_{name}.png'))
print('ok')
