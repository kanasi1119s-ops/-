# 顔のあたりのドットを文字の地図にする（驚いた顔の設計用）。 python3 tools/face_map.py <絵の名前> <x0> <y0> <x1> <y1>
# K=暗い（輪郭・目） W=白っぽい S=肌 s=肌の影 R=赤（口） H=髪・そのほか .=透明
import sys, os, colorsys
from PIL import Image
ROOT = os.path.join(os.path.dirname(__file__), '..')
def cls(c):
    if c[3] == 0: return '.'
    r, g, b = c[:3]; lum = 0.3 * r + 0.59 * g + 0.11 * b
    h, l, s = colorsys.rgb_to_hls(r / 255, g / 255, b / 255)
    if lum < 70: return 'K'
    if lum > 215 and s < 0.35: return 'W'
    if (h < 0.03 or h > 0.95) and s > 0.35 and r > 110 and g < 90: return 'R'
    if 0.02 < h < 0.13 and s > 0.25 and r > 150: return 'S' if l > 0.6 else 's'
    return 'H'
if __name__ == '__main__':
    name, x0, y0, x1, y1 = sys.argv[1], *map(int, sys.argv[2:6])
    im = Image.open(os.path.join(ROOT, 'assets/img', f'{name}.png')).convert('RGBA'); px = im.load()
    print('    ' + ''.join(str(x % 10) for x in range(x0, x1 + 1)))
    for y in range(y0, y1 + 1):
        print(f'{y:3d} ' + ''.join(cls(px[x, y]) if x < im.width and y < im.height else ' ' for x in range(x0, x1 + 1)))
