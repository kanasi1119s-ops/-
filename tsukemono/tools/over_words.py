# オーバーリアクションの描き文字（ドットの文字と、ギザギザの爆発吹き出し）の設計図を作る。
#   python3 tools/over_words.py → assets/editor/faces/over_words.design.json
#   そのあと node tools/editor_touch.mjs assets/editor/faces/over_words.design.json で、エディタのえんぴつで描いて書き出す（assets/img/over_<名前>.png）
# 文字は 16ドットのビットマップフォント（Unifont JP）を太らせ、1文字ずつ上下にはずませて、黒い縁どりをつける。
# 吹き出しはギザギザの星形を白でぬり、黒い縁と、右下に2ドットの影。
import json, math, os
from PIL import Image, ImageDraw, ImageFont
ROOT = os.path.join(os.path.dirname(__file__), '..')
FONT = '/usr/share/fonts/opentype/unifont/unifont_jp.otf'
K, SHADOW = (29, 20, 18), (58, 40, 34)
WORDS = {
    'umai': ('うまーい！！', 'good'), 'zukyun': ('ズキューン！', 'good'), 'ban': ('バーン！', 'good'),
    'don': ('ドーン！！', 'good'), 'uooo': ('うおおお！', 'good'),
    'gan': ('ガーン！', 'bad'), 'zun': ('ズーン…', 'bad'), 'gya': ('ぎゃー！', 'bad'),
}
STYLE = {
    'good': {'top': (255, 128, 64), 'mid': (227, 52, 31), 'low': (168, 28, 18), 'burst': (255, 254, 246), 'inner': (241, 232, 210)},
    'bad': {'top': (106, 146, 214), 'mid': (52, 92, 170), 'low': (32, 58, 120), 'burst': (226, 236, 249), 'inner': (200, 214, 236)},
}
BOUNCE = [0, -2, 1, -1, 2, -2, 0]

def glyphs(text):
    font = ImageFont.truetype(FONT, 16)
    cells = []
    for ch in text:
        im = Image.new('1', (18, 18), 0); d = ImageDraw.Draw(im); d.fontmode = '1'
        d.text((1, 0), ch, font=font, fill=1)
        bold = Image.new('1', (18, 18), 0); px, bp = im.load(), bold.load()
        for y in range(18):
            for x in range(18):
                if px[x, y] or (x > 0 and px[x - 1, y]): bp[x, y] = 1  # 1ドット太らせる
        bb = bold.getbbox() or (0, 0, 1, 1)
        cells.append(bold.crop((bb[0], 0, bb[2], 18)))
    return cells

def word(name, text, kind):
    st = STYLE[kind]
    cells = glyphs(text)
    gap = 2
    tw = sum(c.width for c in cells) + gap * (len(cells) - 1)
    th = 18 + 4
    pad_x, pad_y = 12, 10
    W, H = tw + pad_x * 2 + 4, th + pad_y * 2 + 4
    # 爆発吹き出し（ギザギザの星形）
    cx, cy, rx, ry = (W - 3) / 2, (H - 3) / 2, (W - 5) / 2, (H - 5) / 2
    n = 14
    pts = []
    for i in range(n * 2):
        a = -math.pi / 2 + i * math.pi / n
        f = 1.0 if i % 2 == 0 else (0.72 if i % 4 == 1 else 0.78)
        pts.append((cx + rx * f * math.cos(a), cy + ry * f * math.sin(a)))
    mask = Image.new('1', (W, H), 0); ImageDraw.Draw(mask).polygon(pts, fill=1)
    m = mask.load()
    inside = lambda x, y: 0 <= x < W and 0 <= y < H and m[x, y]
    out = {}
    for y in range(H):  # 影（右下に2ドット）
        for x in range(W):
            if not inside(x, y) and (inside(x - 2, y - 2) or inside(x - 1, y - 2) or inside(x - 2, y - 1)): out[(x, y)] = SHADOW
    for y in range(H):
        for x in range(W):
            if not inside(x, y): continue
            edge = any(not inside(x + dx, y + dy) for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)))
            out[(x, y)] = K if edge else st['burst']
            if not edge and any(not inside(x + dx, y + dy) for dx, dy in ((2, 0), (0, 2), (2, 2))): out[(x, y)] = st['inner']  # 右下の内側に薄い陰
    # 文字
    x0 = pad_x + 2; base = pad_y + 2
    lay = {}
    for i, c in enumerate(cells):
        cp = c.load(); oy = base + BOUNCE[i % len(BOUNCE)]
        for y in range(c.height):
            for x in range(c.width):
                if cp[x, y]: lay[(x0 + x, oy + y)] = y
        x0 += c.width + gap
    for (x, y) in list(lay):  # 縁どり
        for dx in (-1, 0, 1):
            for dy in (-1, 0, 1):
                q = (x + dx, y + dy)
                if q not in lay and inside(*q): out[q] = K
    for (x, y), gy in lay.items():
        out[(x, y)] = st['top'] if gy < 6 else st['mid'] if gy < 13 else st['low']
    touch = [{'x': x, 'y': y, 'color': '#%02x%02x%02x' % c} for (x, y), c in sorted(out.items(), key=lambda t: (t[0][1], t[0][0]))]
    return {'size': [W, H], 'touch': touch}

if __name__ == '__main__':
    d = {f'over_{k}': word(k, t, kind) for k, (t, kind) in WORDS.items()}
    os.makedirs(os.path.join(ROOT, 'assets/editor/faces'), exist_ok=True)
    json.dump(d, open(os.path.join(ROOT, 'assets/editor/faces/over_words.design.json'), 'w'), ensure_ascii=False)
    for k, v in d.items(): print(k, v['size'], len(v['touch']))
