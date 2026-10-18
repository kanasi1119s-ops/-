# 新しい野菜の樽の中身の絵を、似た野菜の絵の色を変えて作る（仮置き。あとでエディタで描き直せる）
#   かぶ ← 大根（白に少し紫）、にんじん ← たくあん（黄色をオレンジに）、キャベツ ← 白菜（白を薄い黄緑に）、赤かぶ ← 大根（白を赤紫に）、梅 ← なす（黄色がかった橙に）、白瓜 ← きゅうり（薄い緑に）、みょうが ← なす（薄紅に）
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


def akakabu(h, l, s):  # 白い身を赤紫に（赤かぶ）
    if s < 0.25 and l > 0.5:
        return 335 / 360, l * 0.62, 0.55
    return h / 360, l, s


recolor('daikon', 'akakabu', akakabu)


def ume(h, l, s):  # なすの紫 → 漬けた梅の黄色がかった橙
    if l < 0.85 and s > 0.1:
        return (42 if l > 0.3 else 30) / 360, min(0.72, l * 1.6 + 0.1), min(0.75, s * 0.6 + 0.2)
    return h / 360, l, s


def shirouri(h, l, s):  # きゅうりの濃い緑 → 白瓜の薄い緑
    if 60 <= h <= 170:
        return (h + 5) / 360, min(0.9, l * 1.35 + 0.1), s * 0.55
    return h / 360, l, s


def myoga(h, l, s):  # なすの紫 → みょうがの薄紅
    if l < 0.85 and s > 0.1:
        return 345 / 360, min(0.8, l * 1.8 + 0.2), min(0.75, s * 0.8 + 0.15)
    return h / 360, l, s


recolor('nasu', 'ume', ume)
recolor('kyuri', 'shirouri', shirouri)
recolor('nasu', 'myoga', myoga)
print('ok')
