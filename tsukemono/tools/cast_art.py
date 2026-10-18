# 物語の人物（漬物男爵・審査員長タマ殿）の絵の設計図を作る（ドット絵エディタで描く前の下準備）。
#   python3 tools/cast_art.py → assets/editor/cast/cast.design.json
#   そのあと EDITOR_OUT=assets/editor/cast node tools/editor_touch.mjs assets/editor/cast/cast.design.json で、
#   エディタのえんぴつで、まっさらなキャンバスに1ドットずつ描いて書き出す（assets/img/baron_<番号>.png・tama_<番号>.png）
# 漬物男爵: 背広の紳士（pose_suit_0〜3）を、シルクハットが入るように上を HAT ドット広げたキャンバスに写し、
#   背中に裏地の赤い黒マント（かごと肩掛けかばんはマントの下）、シルクハット、白いカイゼルひげを描き足す
# タマ殿: まっさらなキャンバスに描く。形は、オープンソースのゲーム用タイル集（Cataclysm: DDA の UltimateCataclysm・MShockXotto+）の写実的な座った猫を1ドットずつ見て学んだ（絵は使わない）。灰色のさばとらに白い胸と足先、赤い首輪に金の鈴。座る（目を開ける・まばたき・しっぽの先を動かす）と、丸くなって寝る
import json, math, os
from PIL import Image
ROOT = os.path.join(os.path.dirname(__file__), '..')
HAT = 22  # 男爵のキャンバスを上に広げる行数（シルクハットの分）
hexc = lambda c: '#%02x%02x%02x' % tuple(c[:3])
rgb = lambda h: tuple(int(h[i:i + 2], 16) for i in (1, 3, 5))

def grain(x, y, seed=0):
    """ドットごとの決まった乱数（0〜99）。元の人物の絵は、となり合うドットの半分以上が少しずつ違う色（絵の具のような手ざわり）。
    描き足すところも、塗りの中のドットをこれで1段明るく・暗くゆらして、まわりの絵になじませる"""
    return ((x * 73856093) ^ (y * 19349663) ^ (seed * 83492791)) % 100

def jitter(ramp, c, x, y, rate, seed=0):
    """ramp（暗い→明るい）の中の色 c を、rate% の確率で1段上か下へ"""
    if c not in ramp: return c
    r, i = grain(x, y, seed), ramp.index(c)
    if r < rate / 2: i = min(len(ramp) - 1, i + 1)
    elif r < rate: i = max(0, i - 1)
    return ramp[i]

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
DARK = ['#0a080e', '#14121a', '#1e1b26', '#2c2836', '#45404f', '#6e6878']  # マントとシルクハットで共通の黒（暗い → つや）
CAPE = {'K': DARK[0], 'r': '#a8202a', 'R': '#d23a3c'}
MUSTACHE = ['....wWWWWWw....', 'W..wWWWWWWWw..W', 'WwWWWWWkWWWWWwW', '.wWWWw...wWWWw.', '..ww.......ww..']  # カイゼルひげ: 鼻の下で厚く（まん中に分け目）、外へ細くなり、先はくるりと上へ
MPAL = {'W': '#e4e4ea', 'w': '#a6a6b0', 'k': '#7a6a66'}  # カイゼルひげ（明・中・下の影）

def baron(pose, cape, mouth):
    im = Image.open(os.path.join(ROOT, 'assets/img', f'pose_suit_{pose}.png')).convert('RGBA')
    W, H0 = im.size; H = H0 + HAT
    # 頭のてっぺんの中心: 元の絵の髪の、上から5〜8行目の左右のはしの真ん中（ポーズで頭の位置が違うので、絵から測る）
    hy = min(y for y in range(H0) for x in range(W) if im.getpixel((x, y))[3])
    spans = [[x for x in range(W) if im.getpixel((x, y))[3]] for y in range(hy + 5, hy + 9)]
    hx = round(sum((min(r) + max(r)) / 2 for r in spans) / len(spans))
    head = (hx, hy)
    # その絵のふちどりでいちばん多い暗い色（描き足すふちどりにもまぜて、なじませる）
    from collections import Counter
    rim = Counter(im.getpixel((x, y))[:3] for y in range(H0) for x in range(W) if im.getpixel((x, y))[3]
                  and any(not (0 <= x + dx < W and 0 <= y + dy < H0) or not im.getpixel((x + dx, y + dy))[3] for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))))
    suit_k = hexc(rim.most_common(1)[0][0])
    px = {(x, y + HAT): im.getpixel((x, y))[:3] for y in range(H0) for x in range(W) if im.getpixel((x, y))[3]}
    put = lambda x, y, c: px.__setitem__((x, y), rgb(c)) if 0 <= x < W and 0 <= y < H else None
    # マント: 背中側（左）を多角形でおおう。肩から下へ広がるひだ（ひとつずつ、光の当たる左の面と影の右の面）、
    # ひだの山にうっすら紫のつや。すそはひだの谷で少し上がって波打ち、ひだの山のすそに赤い裏地がのぞく。前のふちは赤い裏地
    import math
    poly = [(x, y + HAT) for x, y in cape]
    cells = {(x, y) for y in range(H) for x in range(W) if inside(poly, x, y)}
    ys = [y for _, y in cells]; ytop, ybot = min(ys), max(ys)
    rows = {y: sorted(x for x, yy in cells if yy == y) for y in range(ytop, ybot + 1)}
    phase = {}
    for (x, y) in cells:
        r = rows[y]; t = (y - ytop) / max(1, ybot - ytop)
        folds = 2 + 2.2 * t  # 下へいくほどひだが増える（広がる）
        phase[(x, y)] = (x - r[0]) / max(1, r[-1] - r[0] + 1) * folds
    # すその波: ひだの谷（phase の小数部が 0.5 のあたり）でもち上がる
    for x in {x for x, _ in cells}:
        col = [y for xx, y in cells if xx == x]
        yb = max(col); ph = phase[(x, yb)] % 1
        lift = round(2 * max(0.0, 1 - abs(ph - 0.5) * 4))
        for k in range(lift): cells.discard((x, yb - k))
    shade = DARK  # 暗い → つや
    for (x, y) in cells:
        ph = phase[(x, y)] % 1
        face = math.cos(ph * 2 * math.pi)  # 1 = ひだの山（左向きの面が明るい）、-1 = 谷
        lit = math.sin(ph * 2 * math.pi + 0.6)  # 左の面に光
        t = (y - ytop) / max(1, ybot - ytop)
        v = 2.2 + 1.3 * lit + 0.6 * face - 0.8 * t + (0.6 if y - ytop < 6 else 0)  # 肩のあたりは光を受ける
        c = jitter(shade, shade[max(0, min(5, round(v)))], x, y, 34, 1)  # 布の手ざわり
        out = [(dx, dy) for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)) if (x + dx, y + dy) not in cells]
        inner = (x + 1, y) not in cells
        if inner: c = CAPE['R'] if (y // 3) % 3 == 0 else CAPE['r']  # 前のふち（赤い裏地）
        elif (x + 2, y) not in cells: c = CAPE['r']
        elif out and any(dy == 1 for _, dy in out):  # すそ: ひだの山では裏地がのぞく
            c = CAPE['r'] if math.cos(ph * 2 * math.pi) > 0.5 else CAPE['K']
        elif out and (x - 1, y) not in cells and (x - 1, y) not in px: c = CAPE['K'] if grain(x, y, 2) < 50 else suit_k  # ふちどりは元の絵の紺の黒もまぜる
        put(x, y, c)
    # 首もとの金の留め金
    hx0, hy0 = head
    put(hx0 - 4, hy0 + 35 + HAT, '#e8c040'); put(hx0 - 3, hy0 + 35 + HAT, '#a8802a')  # 留め金
    hx, hy = head  # 頭のてっぺんの中心（元の絵の座標）
    # シルクハット（絹）: 山は上と下が少し広く、まん中がわずかにくびれる。左に細く強いつや、右寄りにうすいつや、右のふちは暗い。
    # てっぺんのふちは光を受けて明るい。赤い帯（明・中・暗の3段）と横の蝶結び。つばは両はしが反り上がり、手前のまん中が下がる。
    # つばの下の髪と額に影を落とす（影の色は元の絵の色から選ぶ）
    HK, H1, H2, H3, H4, H5 = DARK
    RB = (CAPE['R'], CAPE['r'], '#5c1018')
    by = hy + 6 + HAT  # つばは額の上（頭のてっぺんは山の中に入る）
    pal0 = set(px.values())
    near = lambda t: min(pal0, key=lambda c: sum((c[i] - t[i]) ** 2 for i in range(3)))
    for x in range(hx - 13, hx + 14):  # つばの影（つばのすぐ下、2行）
        for y in (by + 2, by + 3):
            if (x, y) in px and (y == by + 2 or abs(x - hx) < 10):
                o = px[(x, y)]; px[(x, y)] = near(tuple(round(v * 0.62) for v in o))
    for j in range(17):
        y = by - 17 + j
        hw = 10 + round(0.9 * ((j - 8) / 8) ** 2)
        for x in range(hx - hw, hx + hw + 1):
            u = (x - (hx - hw)) / (2 * hw)
            if x in (hx - hw, hx + hw): c = HK
            elif j == 0: c = H4 if u < 0.6 else H3  # てっぺんのふち
            elif 13 <= j <= 15: c = RB[j - 13] if not (j == 13 and u > 0.7) else RB[1]  # 帯
            elif abs(u - 0.2) < 0.03: c = H5  # 強いつや
            elif abs(u - 0.2) < 0.09: c = H4
            elif abs(u - 0.62) < 0.05: c = H3  # うすいつや
            elif u > 0.85: c = HK
            elif u < 0.12: c = H3
            else: c = jitter(DARK[:4], H2 if u < 0.5 else H1, x, y, 16, 3)  # 絹は布より手ざわりを弱く
            if c == HK and x in (hx - hw, hx + hw) and grain(x, y, 4) < 40: c = suit_k
            put(x, y, c)
    for i, row in enumerate(['RrR', 'rRr', '.R.']):  # 蝶結び（左の横）
        for k, ch in enumerate(row):
            if ch != '.': put(hx - 10 + k, by - 4 + i, RB[0] if ch == 'r' else RB[2])
    for x in range(hx - 15, hx + 16):  # つば
        d = abs(x - hx)
        top = by - (1 if d >= 13 else 0)  # 両はしは反り上がる
        bot = by + (1 if d <= 6 else 0) + (0 if d < 13 else -1) + 1  # 手前のまん中は下がる
        for y in range(top, bot + 1):
            c = HK if y == bot else (H4 if y == top and x < hx - 4 else H3 if y == top else H2)
            put(x, y, c)
    # カイゼルひげ（口のすぐ上）
    mx, my = mouth
    for j, row in enumerate(MUSTACHE):
        for i, ch in enumerate(row):
            if ch != '.': put(mx - 7 + i, my - 5 + j + HAT, MPAL[ch])
    return {'size': [W, H], 'touch': canvas_touch(px, W, H)}

# ---------------------------------------------------------------- タマ殿
# 猫のドット絵の描き方（調べたこと）に合わせて描く:
#   形（シルエット）から。耳は頭に合った大きさのとがった三角で、少し外向き（小さく丸いと熊、長いと狐に見える）
#   目は絵の中でいちばん鮮やかな色（灰色の毛に琥珀色）。アーモンド形に縦長の瞳、光は1ドット
#   しま模様は3つ目の暗い色で、つながった線ではなく短く途切れた線に
#   光は左上から。影は右下のふちのすぐ内側。影は青寄り、明るい所は黄寄り（色相をずらす）
#   ふちどりは場所で色を変える（光の当たる左上は明るい線、影の右下は暗い線。ぜんぶ黒にしない）
#   毛は、まずなめらかに陰をつけてから、ほおと胸の白い毛だけ小さなふさ（ぎざぎざ）を刻む。点を散らかさない
#   じっとしている絵は、しっぽの先を動かすと生きて見える
# 姿: 体を右に向けて座り、顔はこちら。腰のふくらみ、まっすぐな前足、しっぽは前足のまわりに巻く。白い胸と足先、灰色のさばとら
TAMA = {
    'K': '#2a1f1c', 'L': '#5e504a',  # ふちどり（影側・光側）。ほかの人物の絵と同じ、こげ茶の黒
    '1': '#4a4654', '2': '#6c6872', '3': '#8e898c', '4': '#b1aaa4', '5': '#d0c7ba',  # 灰色の毛（影は青寄り、光は黄寄り）
    's': '#3d3946',  # しま
    'W': '#f3ede3', 'w': '#d6cdc6', 'v': '#b2a9ab',  # 白い毛（明・陰・深い陰）
    'p': '#e09aa0', 'P': '#b06a74',  # 鼻と耳の内側
    'E': '#e0a838', 'e': '#a8701c', 'k': '#16121a', 'H': '#fffbea',  # 目（琥珀・ふち・瞳・光）
    'm': '#4a3c42',  # 口の線
    'r': '#c8302a', 'R': '#8a1e1a', 'y': '#ecc44a', 'Y': '#a8802a', 'h': '#e8e2da',  # 首輪・鈴・ひげ
}
LIGHT = (-0.55, -0.65, 0.52)

def ellipse(cx, cy, rx, ry):
    return {(x, y) for y in range(int(cy - ry) - 1, int(cy + ry) + 2) for x in range(int(cx - rx) - 1, int(cx + rx) + 2)
            if ((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2 <= 1}

def tri(a, b, c):
    xs = [p[0] for p in (a, b, c)]; ys = [p[1] for p in (a, b, c)]
    return {(x, y) for y in range(min(ys), max(ys) + 1) for x in range(min(xs), max(xs) + 1) if inside([a, b, c], x, y)}

class Cat:
    """部品（形と、陰をつけるためのふくらみの中心）を奥から順に重ねる"""
    def __init__(self, W, H):
        self.W, self.H, self.part, self.shade = W, H, {}, {}
    def add(self, name, cells, center, radius, flat=1.0):
        for x, y in cells:
            if 0 <= x < self.W and 0 <= y < self.H:
                nx, ny = (x + 0.5 - center[0]) / radius[0], (y + 0.5 - center[1]) / radius[1]
                nz = max(0.0, 1 - nx * nx - ny * ny) ** 0.5 * flat
                l = (nx * LIGHT[0] + ny * LIGHT[1] + nz * LIGHT[2]) / max(0.3, (nx * nx + ny * ny + nz * nz) ** 0.5)
                self.part[(x, y)] = name; self.shade[(x, y)] = l
    def paint(self, white, stripes, tufts, details, lines=None, gain=1.0):
        px = {}
        tone = lambda l: '5' if l > 0.62 else '4' if l > 0.3 else '3' if l > 0.0 else '2' if l > -0.35 else '1'
        wtone = lambda l: 'W' if l > 0.05 else 'w' if l > -0.4 else 'v'
        for (x, y), l in self.shade.items():
            l *= gain
            c = wtone(l) if white(x, y) else ('s' if stripes(x, y) and l < 0.62 else tone(l))
            c = jitter('12345', c, x, y, 36, 5) if c in '12345' else jitter('vwW', c, x, y, 22, 6) if c in 'vwW' else c  # 毛の手ざわり
            px[(x, y)] = c
        # 部品の境目（手前の部品が奥の部品に重なる所）に、1段暗い線を入れる
        order = list(dict.fromkeys(self.part.values()))
        for (x, y), name in self.part.items():
            for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                q = (x + dx, y + dy)
                if q in self.part and order.index(self.part[q]) < order.index(name) and self.part[q] not in ('ear',) and (lines is None or name in lines):
                    c = px[q]
                    px[q] = {'5': '3', '4': '2', '3': '2', '2': '1', '1': '1', 's': '1', 'W': 'w', 'w': 'v', 'v': 'v'}[c]
        # ふちどり: 外に面したドット。光の当たる側（左上）は明るい線、ほかは暗い線
        shape = set(self.part)
        for (x, y) in shape:
            out = [(dx, dy) for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)) if (x + dx, y + dy) not in shape]
            if out:
                lit = all(dx <= 0 and dy <= 0 for dx, dy in out) and self.shade[(x, y)] > -0.1
                px[(x, y)] = 'L' if lit else 'K'
        for (x, y) in tufts: px.pop((x, y), None)  # 白い毛のふさ（ふちを刻む）
        px.update(details)
        return {'size': [self.W, self.H], 'touch': [{'x': x, 'y': y, 'color': TAMA[c]} for (x, y), c in sorted(px.items(), key=lambda t: (t[0][1], t[0][0])) if 0 <= x < self.W and 0 <= y < self.H]}

def stamp(d, rows, x0, y0):
    for j, row in enumerate(rows):
        for i, ch in enumerate(row):
            if ch != '.': d[(x0 + i, y0 + j)] = ch

def tail_curve(points, thick):
    cells = set()
    for (x0, y0), (x1, y1) in zip(points, points[1:]):
        n = int(max(abs(x1 - x0), abs(y1 - y0)) * 3) + 1
        for k in range(n + 1):
            t = k / n; x, y = x0 + (x1 - x0) * t, y0 + (y1 - y0) * t
            cells |= {(round(x + dx), round(y + dy)) for dx in range(-thick // 2, thick - thick // 2) for dy in range(-thick // 2, thick - thick // 2)}
    return cells

# ---- タマ殿の座り姿は、いただいた参考の絵（assets/reference/tama_reference.webp。白黒の猫のドット絵）から ----
# 1. 参考の絵は 1024×1024 で、1ドット = 10.24 画素（100×100 ドット）。各マスの中心の色を読んで、元のドット絵に戻す
# 2. 外の明るい地（透明の市松模様）とつながった明るいドットを背景として抜き、猫だけを切り抜く（47×70 ドット）
# 3. 店先の人物と並ぶ大きさ（高さ 52 ドット）へ、多数決で縮める（ふちの黒は 2.4 倍に数えて、細い線を残す）
# 4. 縮めると目がつぶれるので、参考の目のつくり（黄色い輪・黒い瞳・左上に白い光）で 4×4 に描き直す。
#    首の細い線は、タマ殿の赤い首輪と金の鈴に。まばたき（目は黒い毛の中なので、灰色の弧）としっぽの先を上げる絵も作る
REF = os.path.join(ROOT, 'assets/reference/tama_reference.webp')
TAMA_H = 52
TC = {'a': '#010101', 'b': '#2f2f2f', 'c': '#bcb9b1', 'd': '#87817c', 'e': '#555352', 'f': '#ececec', 'g': '#ebca6d', 'h': '#fefefe',
      'i': '#1a1a1a', 'j': '#eda9a6', 'k': '#d6d2cd', 'r': '#c8302a', 'R': '#8a1e1a', 'y': '#ecc44a', 'Y': '#a8802a'}

def tama_trace():
    """参考の絵 → 高さ TAMA_H の猫（{(x, y): 色の記号}）と大きさ"""
    import numpy as np, cv2
    from collections import Counter, deque
    im = Image.open(REF).convert('RGB'); px = im.load(); N, cs = 100, im.width / 100
    pal = [rgb(TC[k]) for k in 'abcdefghij']
    near = lambda c: min(range(len(pal)), key=lambda i: sum((c[j] - pal[i][j]) ** 2 for j in range(3)))
    lab = [[near(Counter(px[min(im.width - 1, int(gx * cs + dx)), min(im.height - 1, int(gy * cs + dy))] for dx in (3, 5, 7) for dy in (3, 5, 7)).most_common(1)[0][0])
            for gx in range(N)] for gy in range(N)]
    lum = [0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2] for c in pal]
    bg = [[False] * N for _ in range(N)]; dq = deque([(0, 0)]); bg[0][0] = True
    while dq:
        y, x = dq.popleft()
        for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            yy, xx = y + dy, x + dx
            if 0 <= yy < N and 0 <= xx < N and not bg[yy][xx] and lum[lab[yy][xx]] > 200: bg[yy][xx] = True; dq.append((yy, xx))
    cells = [(x, y) for y in range(N) for x in range(N) if not bg[y][x]]
    x0, y0 = min(x for x, _ in cells), min(y for _, y in cells)
    x1, y1 = max(x for x, _ in cells) + 1, max(y for _, y in cells) + 1
    L = np.full((y1 - y0, x1 - x0), -1)
    for x, y in cells: L[y - y0, x - x0] = lab[y][x]
    th = TAMA_H; tw = round((x1 - x0) * th / (y1 - y0)); up = 8
    U = np.kron(L, np.ones((up, up), int))
    cov = np.stack([cv2.resize((U == k).astype(np.float32), (tw, th), interpolation=cv2.INTER_AREA) * (1.15 if k < 0 else 2.4 if lum[k] < 60 else 1.0)
                    for k in range(-1, len(pal))])
    idx = cov.argmax(0) - 1
    return {(x, y): 'abcdefghij'[idx[y, x]] for y in range(th) for x in range(tw) if idx[y, x] >= 0}, (tw, th)

def tama_sit(blink=False, flick=False):
    d, (W, H) = tama_trace()
    W += 1  # しっぽの先を上げる絵のための余白
    eye_l, eye_r = (4, 11), (12, 12)  # 4×4 の目の左上（縮めた絵で、参考の目の場所）
    EYE = ['.aa.', 'gHag', 'gaag', '.gg.'] if not blink else ['....', '....', 'eeee', '.ee.']
    for (ex, ey), rows in ((eye_l, EYE), (eye_r, EYE)):
        for j, row in enumerate(rows):
            for i, ch in enumerate(row):
                if ch != '.': d[(ex + i, ey + j)] = 'h' if ch == 'H' else ch
                elif not blink: d[(ex + i, ey + j)] = 'b'
    for x in range(6, 18):  # 赤い首輪（首の細い線のところ）と金の鈴
        if (x, 21) in d: d[(x, 21)] = 'r'
    d[(17, 20)] = 'r'; d[(18, 20)] = 'R'
    for (x, y), ch in {(11, 22): 'y', (12, 22): 'Y', (11, 23): 'Y', (12, 23): 'Y'}.items(): d[(x, y)] = ch
    for p, ch in list(d.items()):  # 縮めたときの、まわりと違うはぐれた色
        if ch not in TC: d[p] = 'f'
    if flick:  # しっぽの先（右下）を2ドット持ち上げる
        tip = {p: ch for p, ch in d.items() if p[0] >= 29 and p[1] >= 42}
        for p in tip: d.pop(p)
        for (x, y), ch in tip.items(): d[(x, y - 2)] = ch
        for (x, y), ch in tip.items():
            if (x, y) not in d and y >= 48 and x < 31: d[(x, y)] = 'a'
    return {'size': [W, H], 'touch': [{'x': x, 'y': y, 'color': TC[ch]} for (x, y), ch in sorted(d.items(), key=lambda t: (t[0][1], t[0][0])) if 0 <= x < W and 0 <= y < H]}

def tama_sleep():
    """丸くなって寝る（座り姿と同じ描き方: 黒いふちどり、黒い毛は1色＋背中のふちに灰色の光、白い毛は下に灰色の陰）。
    白黒の柄も座り姿にそろえる: 背中・頭の上・しっぽは黒、顔の下半分・胸・前足は白。頭は前足にのせて、目は閉じた灰色の弧"""
    W, H = 44, 24
    body = ellipse(19, 14.5, 15.5, 7.5)
    head = ellipse(33, 15.5, 6.5, 5.2) | ellipse(33, 17, 7, 3.2)
    ears = tri((27, 12), (28, 6), (32, 10)) | tri((34, 10), (37, 6), (39, 12))
    paws = ellipse(30, 20.6, 3.2, 1.6) | ellipse(35.5, 20.8, 2.8, 1.5)
    tail = tail_curve([(5, 18), (9, 20.6), (16, 21.6), (23, 21.6), (27, 21.2)], 3)
    shape = body | head | ears | paws | tail
    d = {}
    for (x, y) in shape:
        white = ((x, y) in head and (y >= 16 or abs(x - 33.5) <= (y - 11) * 0.45)) or (x, y) in paws  # 顔のまん中の白い筋（ハチワレ）と口もと、前足
        d[(x, y)] = ('c' if (x, y + 2) not in shape else 'f') if white else 'b'
    for (x, y) in shape:  # ふちどり（外に面したドット）
        if any((x + dx, y + dy) not in shape for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))): d[(x, y)] = 'a'
    # 中の境目の線: 頭と体、前足と頭・体、しっぽと体（手前の部品のふち）
    for front, back in ((head | ears, body), (paws, body | head), (tail, body)):
        for (x, y) in front:
            if any((x + dx, y + dy) in back and (x + dx, y + dy) not in front for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))): d[(x, y)] = 'a'
    for (x, y) in shape:  # 背中と頭のてっぺんのふちのすぐ内側に、灰色の光
        if d[(x, y)] == 'b' and (x, y - 1) in d and d[(x, y - 1)] == 'a' and (x, y - 2) not in shape and y < 13: d[(x, y)] = 'e'
    for p in [(29, 9), (36, 9)]: d[p] = 'c'  # 耳の中
    for (x, y) in list(paws):  # 前足と体・しっぽの境目の線
        if (x, y - 1) in d and (x, y - 1) not in paws and (x, y) in shape and d[(x, y)] != 'a': d[(x, y - 1)] = 'a' if (x, y - 1) not in head else d[(x, y - 1)]
    for p in [(29, 14), (30, 15), (31, 14), (35, 14), (36, 15), (37, 14)]: d[p] = 'e'  # 閉じた目
    d[(33, 17)] = 'j'; d[(34, 17)] = 'j'; d[(33, 18)] = 'a'  # 鼻と口
    for x in range(27, 39):  # 首輪（あごの下）
        if (x, 20) in head and d.get((x, 20)) not in ('a',): d[(x, 20)] = 'r'
    return {'size': [W, H], 'touch': [{'x': x, 'y': y, 'color': TC[ch]} for (x, y), ch in sorted(d.items(), key=lambda t: (t[0][1], t[0][0])) if 0 <= x < W and 0 <= y < H]}

if __name__ == '__main__':
    d = {}
    # 男爵: マントの多角形（元の絵の座標）・口（頭の位置は絵から測る）
    walk_cape = [(26, 36), (16, 40), (8, 60), (3, 90), (0, 126), (36, 124), (36, 90), (30, 70), (32, 44)]
    talk_cape = [(28, 36), (16, 40), (8, 60), (2, 90), (0, 124), (28, 124), (28, 95), (24, 72), (22, 58), (30, 42)]
    for pose, cape, mouth in [(0, walk_cape, (44, 31)), (1, walk_cape, (44, 31)), (2, talk_cape, (39, 30)), (3, talk_cape, (38, 30))]:
        d[f'baron_{pose}'] = baron(pose, cape, mouth)
    d['tama_0'] = tama_sit()
    d['tama_1'] = tama_sit(blink=True)
    d['tama_2'] = tama_sleep()
    d['tama_3'] = tama_sit(flick=True)  # しっぽの先をぴくっと
    os.makedirs(os.path.join(ROOT, 'assets/editor/cast'), exist_ok=True)
    json.dump(d, open(os.path.join(ROOT, 'assets/editor/cast/cast.design.json'), 'w'), ensure_ascii=False)
    for k, v in d.items(): print(k, v['size'], len(v['touch']), len({t['color'] for t in v['touch']}))
