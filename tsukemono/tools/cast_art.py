# 物語の人物（漬物男爵・審査員長タマ殿）の絵の設計図を作る（ドット絵エディタで描く前の下準備）。
#   python3 tools/cast_art.py → assets/editor/cast/cast.design.json
#   そのあと EDITOR_OUT=assets/editor/cast node tools/editor_touch.mjs assets/editor/cast/cast.design.json で、
#   エディタのえんぴつで、まっさらなキャンバスに1ドットずつ描いて書き出す（assets/img/baron_<番号>.png・tama_<番号>.png）
# 漬物男爵: 背広の紳士（pose_suit_0〜3）を、シルクハットが入るように上を HAT ドット広げたキャンバスに写し、
#   背中に裏地の赤い黒マント（かごと肩掛けかばんはマントの下）、シルクハット、白いカイゼルひげを描き足す
# タマ殿: まっさらなキャンバスに描く。白に灰色のしま模様、赤い首輪に金の鈴。座る（目を開ける・まばたき）と、丸くなって寝る
import json, os
from PIL import Image
ROOT = os.path.join(os.path.dirname(__file__), '..')
HAT = 22  # 男爵のキャンバスを上に広げる行数（シルクハットの分）
hexc = lambda c: '#%02x%02x%02x' % tuple(c[:3])
rgb = lambda h: tuple(int(h[i:i + 2], 16) for i in (1, 3, 5))

def inside(poly, x, y):
    """多角形の中か（ドットの中心で判定）"""
    px, py, n, ok = x + 0.5, y + 0.5, len(poly), False
    for i in range(n):
        (x0, y0), (x1, y1) = poly[i], poly[(i + 1) % n]
        if (y0 > py) != (y1 > py) and px < x0 + (py - y0) * (x1 - x0) / (y1 - y0): ok = not ok
    return ok

def canvas_touch(px, W, H):
    return [{'x': x, 'y': y, 'color': hexc(px[(x, y)])} for y in range(H) for x in range(W) if (x, y) in px]

# ---------------------------------------------------------------- 漬物男爵
CAPE = {'K': '#0c0a10', 'd': '#16121c', 'm': '#221a2c', 'l': '#30263e', 'r': '#a8202a', 'R': '#d23a3c'}
HATC = {'K': '#0c0a10', 'm': '#1c1a22', 'l': '#3a3644', 'b': '#9a1c22'}
MUSTACHE = ['K...............K', 'WK.............KW', 'WWK..KKK.KKK..KWW', '.WWKKWWWKWWWKKWW.', '..WWWWWW.WWWWWW..', '....KKKK.KKKK....']
MPAL = {'K': '#4a4a52', 'W': '#d4d4dc'}

def baron(pose, cape, head, mouth):
    im = Image.open(os.path.join(ROOT, 'assets/img', f'pose_suit_{pose}.png')).convert('RGBA')
    W, H0 = im.size; H = H0 + HAT
    px = {(x, y + HAT): im.getpixel((x, y))[:3] for y in range(H0) for x in range(W) if im.getpixel((x, y))[3]}
    put = lambda x, y, c: px.__setitem__((x, y), rgb(c)) if 0 <= x < W and 0 <= y < H else None
    # マント: 背中側（左）を多角形でおおう。たたみじわ（縦のすじ）、ふちは黒、内側のふちに赤い裏地
    poly = [(x, y + HAT) for x, y in cape]
    cells = {(x, y) for y in range(H) for x in range(W) if inside(poly, x, y)}
    for x, y in cells:
        edge_out = any((x + dx, y + dy) not in cells and (x + dx, y + dy) not in px for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)))
        inner = (x + 1, y) not in cells or (x + 2, y) not in cells
        if edge_out and not inner: c = CAPE['K']
        elif inner: c = CAPE['R'] if (x + 1, y) not in cells and y % 7 < 4 else CAPE['r']
        elif y >= max(yy for xx, yy in cells if xx == x) - 1: c = CAPE['K']  # すそ
        else: c = CAPE['d'] if x % 6 == 0 else CAPE['l'] if x % 6 == 2 and y % 3 else CAPE['m']
        put(x, y, c)
    hx, hy = head  # 頭のてっぺんの中心（元の絵の座標）
    # シルクハット: つば（2行）・赤い帯（3行）・山（14行）。左に光
    by = hy + 3 + HAT
    for x in range(hx - 15, hx + 16): put(x, by, HATC['K']); put(x, by + 1, HATC['m'] if hx - 15 < x < hx + 15 else HATC['K'])
    for y in range(by - 17, by):
        for x in range(hx - 10, hx + 11):
            edge = x in (hx - 10, hx + 10) or y == by - 17
            c = HATC['K'] if edge else HATC['b'] if y >= by - 3 else HATC['l'] if x in (hx - 8, hx - 7) else HATC['m']
            put(x, y, c)
    # カイゼルひげ（口のすぐ上）
    mx, my = mouth
    for j, row in enumerate(MUSTACHE):
        for i, ch in enumerate(row):
            if ch != '.': put(mx - 8 + i, my - 4 + j + HAT, MPAL[ch])
    return {'size': [W, H], 'touch': canvas_touch(px, W, H)}

# ---------------------------------------------------------------- タマ殿
TAMA = {'K': '#3a3436', 'W': '#f4f0ea', 'w': '#d8d2c8', 'g': '#8a8a92', 'G': '#5e5e66', 'p': '#e8a0a8', 'E': '#9cc24a', 'k': '#1c1a1a',
        'H': '#ffffff', 'r': '#c8302a', 'R': '#8a1e1a', 'y': '#e8c040', 'Y': '#a8802a', 'h': '#6a6468'}

def ellipse(cx, cy, rx, ry):
    return {(x, y) for y in range(int(cy - ry) - 1, int(cy + ry) + 2) for x in range(int(cx - rx) - 1, int(cx + rx) + 2)
            if ((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2 <= 1}

def tri(a, b, c):
    xs = [p[0] for p in (a, b, c)]; ys = [p[1] for p in (a, b, c)]
    return {(x, y) for y in range(min(ys), max(ys) + 1) for x in range(min(xs), max(xs) + 1) if inside([a, b, c], x, y)}

def cat_paint(W, H, parts, shade_of, patch, extras):
    """parts = 形（集合）のリスト。塗り: 白・陰・しま模様、ふちどり、そのあと顔などを足す"""
    shape = set().union(*parts)
    px = {}
    for x, y in shape:
        c = TAMA['w'] if shade_of(x, y) else TAMA['W']
        if patch(x, y): c = TAMA['G'] if (x + y // 2) % 4 == 0 else TAMA['g']
        px[(x, y)] = rgb(c)
    for x, y in shape:  # ふちどり
        if any((x + dx, y + dy) not in shape for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))): px[(x, y)] = rgb(TAMA['K'])
    for (x, y), ch in extras.items():
        if 0 <= x < W and 0 <= y < H: px[(x, y)] = rgb(TAMA[ch])
    return {'size': [W, H], 'touch': canvas_touch(px, W, H)}

def stamp(d, rows, x0, y0):
    for j, row in enumerate(rows):
        for i, ch in enumerate(row):
            if ch != '.': d[(x0 + i, y0 + j)] = ch

def tama_sit(blink):
    W, H = 44, 40
    head = ellipse(20, 14, 11, 9)
    ears = tri((9, 10), (11, 1), (18, 6)) | tri((22, 6), (29, 1), (31, 10))
    body = ellipse(20, 29, 12, 9) | ellipse(20, 34, 14, 5)
    paws = ellipse(15.5, 37.5, 3.5, 2) | ellipse(24.5, 37.5, 3.5, 2)
    tail = set()
    import math
    for k in range(0, 40):  # しっぽは体の右で、地面に沿って丸める（太さ3）
        a = math.pi * 0.5 - k / 39 * math.pi * 0.85
        x, y = 31 + 8 * math.cos(a), 30 + 8 * math.sin(a)
        tail |= {(round(x) + dx, round(y) + dy) for dx in (0, 1) for dy in (0, 1)} | {(round(x), round(y) + 2)}
    parts = [head, ears, body, paws, tail]
    shade = lambda x, y: (y > 30 and x > 24) or (y > 18 and y < 23 and x > 26) or (x, y) in tail and (x + y) % 3 == 0
    patch = lambda x, y: ((x, y) in ears) or (y < 10 and 11 < x < 29) or ((x, y) in body and x < 15 and y < 30) or ((x, y) in tail and y < 27)
    ex = {}
    for x in range(12, 15): ex[(x, 4)] = 'p'; ex[(x - 1, 6)] = 'p'
    for x in range(26, 29): ex[(x, 4)] = 'p'; ex[(x + 1, 6)] = 'p'
    eye = ['KKK', 'EKH', 'EKE'] if not blink else ['...', 'KKK', '...']
    stamp(ex, eye, 14, 12); stamp(ex, eye, 24, 12)
    stamp(ex, ['..pp..', 'K.KK.K', '.K..K.'], 17, 17)  # 鼻と、ωの口
    for i in range(6): ex[(8 - i, 16 - (i > 2))] = 'h'; ex[(8 - i, 18 + (i > 2))] = 'h'; ex[(31 + i, 16 - (i > 2))] = 'h'; ex[(31 + i, 18 + (i > 2))] = 'h'  # ひげ
    for x in range(12, 29): ex[(x, 22)] = 'r'; ex[(x, 23)] = 'R'  # 首輪
    stamp(ex, ['YyY', 'yHy', 'YyY'], 19, 23)  # 金の鈴
    return cat_paint(W, H, parts, shade, patch, ex)

def tama_sleep():
    W, H = 44, 24
    body = ellipse(20, 15, 17, 8)
    head = ellipse(31, 15, 8, 6.5)
    ears = tri((25, 11), (27, 4), (31, 9)) | tri((32, 9), (37, 5), (38, 12))
    tail = set()
    for t in range(0, 26):  # 体の前を回るしっぽ
        x, y = 6 + t, 21 - abs(t - 13) * 0.12
        tail |= {(round(x), round(y) + dy) for dy in (0, 1)}
    parts = [body, head, ears, tail]
    shade = lambda x, y: y > 18 and (x, y) not in tail
    patch = lambda x, y: ((x, y) in ears) or ((x, y) in body and y < 12 and 6 < x < 24) or ((x, y) in tail and x < 11)
    ex = {}
    stamp(ex, ['KKK'], 27, 15); stamp(ex, ['KKK'], 33, 15)  # 閉じた目
    stamp(ex, ['pp'], 30, 18)
    for x in range(26, 37): ex[(x, 21)] = 'r'
    ex[(31, 22)] = 'y'; ex[(32, 22)] = 'Y'
    return cat_paint(W, H, parts, shade, patch, ex)

if __name__ == '__main__':
    d = {}
    # 男爵: マントの多角形（元の絵の座標）・頭のてっぺんの中心・口
    walk_cape = [(26, 36), (16, 40), (8, 60), (3, 90), (0, 126), (36, 124), (36, 90), (30, 70), (32, 44)]
    talk_cape = [(28, 36), (16, 40), (8, 60), (2, 90), (0, 124), (28, 124), (28, 95), (24, 72), (22, 58), (30, 42)]
    for pose, cape, head, mouth in [(0, walk_cape, (40, 2), (44, 31)), (1, walk_cape, (40, 2), (44, 31)),
                                    (2, talk_cape, (40, 2), (39, 30)), (3, talk_cape, (37, 2), (38, 30))]:
        d[f'baron_{pose}'] = baron(pose, cape, head, mouth)
    d['tama_0'] = tama_sit(False)
    d['tama_1'] = tama_sit(True)
    d['tama_2'] = tama_sleep()
    os.makedirs(os.path.join(ROOT, 'assets/editor/cast'), exist_ok=True)
    json.dump(d, open(os.path.join(ROOT, 'assets/editor/cast/cast.design.json'), 'w'), ensure_ascii=False)
    for k, v in d.items(): print(k, v['size'], len(v['touch']), len({t['color'] for t in v['touch']}))
