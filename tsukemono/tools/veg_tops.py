# 新しい野菜の樽の中身の絵を、似た野菜の絵の色を変えて作る（仮置き。あとでエディタで描き直せる）
#   かぶ ← 大根（白に少し紫）、にんじん ← たくあん（黄色をオレンジに）、キャベツ ← 白菜（白を薄い黄緑に）
import os, colorsys
import numpy as np
from PIL import Image
IMG = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'assets', 'img')


def recolor(src, dst, fn):
    for i in range(3):
        a = np.asarray(Image.open(os.path.join(IMG, f'slot{i}_{src}.png')).convert('RGBA')).copy()
        for y in range(a.shape[0]):
            for x in range(a.shape[1]):
                if a[y, x, 3]:
                    h, l, s = colorsys.rgb_to_hls(*(a[y, x, :3] / 255))
                    r, g, b = colorsys.hls_to_rgb(*fn(h * 360, l, s))
                    a[y, x, :3] = np.clip(np.round(np.array([r, g, b]) * 255), 0, 255)
        Image.fromarray(a).save(os.path.join(IMG, f'slot{i}_{dst}.png'))


def kabu(h, l, s):  # 白いところに少し紫をのせる（葉の緑はそのまま）
    if s < 0.25 and l > 0.55:
        return 290 / 360, min(1, l * 1.02), 0.18
    return h / 360, l, s


def ninjin(h, l, s):  # 黄色 → オレンジ
    if 30 <= h <= 70:
        return (h - 26) / 360, l * 0.95, min(1, s * 1.15)
    return h / 360, l, s


def kyabetsu(h, l, s):  # 白 → 薄い黄緑、緑は明るく
    if s < 0.25 and l > 0.55:
        return 75 / 360, l * 0.97, 0.45
    if 70 <= h <= 160:
        return (h - 8) / 360, min(1, l * 1.12), s * 0.85
    return h / 360, l, s


recolor('daikon', 'kabu', kabu)
recolor('takuan', 'ninjin', ninjin)
recolor('hakusai', 'kyabetsu', kyabetsu)
print('ok')
