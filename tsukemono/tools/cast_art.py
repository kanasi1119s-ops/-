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

def tama_sit(blink=False, flick=False):
    """実際の猫のドット絵（ゲームの写実的な猫の絵）を1ドットずつ見て学んだ形で描く:
    座った猫は三角形。小さな頭が上の前、背中は後ろへななめに下がって、後ろ下の大きな腰へ。胸は前でまっすぐ、底は平ら。
    首は見えず、頭は体に直接のる。耳は小さくて近い。目は前を向いた小さな色の点。前足は胸の前の1本の柱、
    後ろ足は腰の明るい弧（ももの線）だけで見せる。しっぽは底にそって前へ。毛は4〜5段の色をドットごとに散らし、
    なめらかなぼかしは使わない。体の中に線は引かず、ふちは毛のいちばん暗い色＋外側に1ドットのこげ茶のふちどり"""
    # 形は手本の座った猫（14×15ドット）の輪郭を、行ごとに読んで約2.8倍にしたもの:
    #   頭は幅の43%・高さの3分の1で右上。頭の後ろからそのまま背中になり（首は見えない）、背中は1行に1ドットずつ（45度）下がる。
    #   胸の前はほぼまっすぐで、その下に前足。底は平ら。毛はほとんど中くらいから暗めの色で、明るい色は少し
    W, H = 44, 44
    c = Cat(W, H)
    # 背中は外へふくらむ弧（まっすぐな斜めにすると、くさびに見える）。腰は丸く、底の角も丸める
    back = [(28, 10), (24, 11.5), (20, 13.5), (16, 16.5), (12.5, 20.5), (9.5, 25), (7.5, 30), (6.5, 35), (7, 39.5), (9.5, 43), (36, 43), (37, 36), (38, 28), (39, 20), (40, 13)]
    body = {(x, y) for y in range(H) for x in range(W) if inside(back, x, y)} | ellipse(14, 36, 8.5, 7)
    c.add('body', body, (18, 26), (17, 17))
    c.add('head', ellipse(33, 9.5, 7.6, 6) | ellipse(33, 11.5, 8, 3.6), (31.5, 8), (8.5, 7))
    c.add('ear', tri((27, 6), (28, 0), (31, 4)) | tri((35, 4), (38, 0), (39, 7)), (33, 4), (7, 5))
    c.add('legfar', {(x, y) for x in range(28, 32) for y in range(31, 43)}, (29, 34), (3, 12), 0.5)
    c.add('leg', {(x, y) for x in range(33, 38) for y in range(28, 43)} | ellipse(35.5, 42.6, 3, 1.3), (34, 32), (4, 12), 0.6)
    tip = [(30, 41), (32, 38.5)] if flick else [(30, 42), (32, 41.5)]
    c.add('tail', tail_curve([(8, 41.8), (13, 42.5), (19, 42.6), (26, 42.6)] + tip, 3), (16, 41), (14, 4))
    thigh = {(round(14 + 8 * math.cos(math.pi * (1.05 + t / 20))), round(38 + 7 * math.sin(math.pi * (1.05 + t / 20)))) for t in range(0, 19)}
    white = lambda x, y: (c.part.get((x, y)) == 'body' and x >= 34 and 14 <= y <= 34) or (c.part.get((x, y)) in ('leg', 'legfar') and (y >= 39 or x >= 34)) \
        or (c.part.get((x, y)) == 'head' and y >= 11 and abs(x - 33) <= (y - 10) * 1.1)
    def stripes(x, y):
        p = c.part.get((x, y))
        if p == 'head': return 3 <= y <= 6 and x in (31, 33, 35) and not (x == 33 and y == 6)  # 額の「M」
        if (x, y) in thigh: return False
        if p == 'body': return x < 33 and (x + 0.35 * y) % 5 < 1.2 and grain(x, y, 9) > 25  # たての縞（ところどころ切れる）
        if p == 'tail': return x % 4 == 0 or x < 8
        if p == 'legfar': return y % 3 == 0 and y < 39
        return False
    d = {}
    for p in thigh:  # ももの明るい弧
        if c.part.get(p) == 'body': d[p] = '4' if grain(*p, 11) < 75 else '5'
    stamp(d, ['P'], 29, 3); stamp(d, ['P'], 37, 3)  # 耳の中
    if blink: stamp(d, ['mm'], 29, 9); stamp(d, ['mm'], 35, 9)
    else: stamp(d, ['Ek', 'Ek'], 29, 8); stamp(d, ['kE', 'kE'], 35, 8)  # 前を向いた琥珀の目（瞳は内側）
    stamp(d, ['pp'], 32, 11); stamp(d, ['mm'], 32, 12)  # 鼻と口
    for i in range(2): d[(25 - i, 11)] = 'h'  # ひげ: 奥のほうは短く、手前は顔の外へ長く
    for i in range(3): d[(41 + i, 11 + (i > 1))] = 'h'
    for x in range(30, 40):  # 首輪（あごの下、首の前だけ。両はしは1段上がる）
        y = 15 if x in (30, 39) else 16
        if c.part.get((x, y)) == 'body': d[(x, y)] = 'r'
    stamp(d, ['y', 'Y'], 34, 17)
    for y in range(34, 42): d[(32, y)] = 'v'  # 前足の間
    return c.paint(white, stripes, set(), d, lines={'leg', 'legfar', 'tail'}, gain=0.8)

def tama_sleep():
    """丸くなって寝る: 体は長いだ円、頭は前足にのせて少し下を向き、しっぽは体の前を回って鼻先へ"""
    W, H = 44, 24
    c = Cat(W, H)
    c.add('body', ellipse(19, 14.5, 15.5, 7.5), (16, 11.5), (16, 8.5))
    c.add('head', ellipse(32.5, 15.5, 6.5, 5) | ellipse(32.5, 17, 7, 3.2), (31, 14), (7, 6))
    c.add('ear', tri((27, 12), (28, 6), (32, 10)) | tri((33, 10), (36, 6), (39, 12)), (33, 10), (7, 5))
    c.add('paw', ellipse(30, 20.6, 3, 1.5) | ellipse(35, 20.8, 2.6, 1.4), (30, 20), (4, 2), 0.6)
    c.add('tail', tail_curve([(5, 18), (9, 20.6), (16, 21.6), (23, 21.6), (28, 21.2)], 3), (16, 20), (13, 4))
    white = lambda x, y: (c.part.get((x, y)) == 'head' and y >= 16 and abs(x - 32.5) <= (y - 15) * 1.5) or c.part.get((x, y)) == 'paw'
    def stripes(x, y):
        p = c.part.get((x, y))
        if p == 'body': return y < 18 and ((x - 19) + (y - 10) ** 2 * 0.1) % 4.5 < 1 and (x * 5 + y * 3) % 9 != 0
        if p == 'tail': return x % 4 == 1 or x > 25
        if p == 'head': return y <= 12 and x in (31, 33)
        return False
    d = {}
    stamp(d, ['p', 'P'], 29, 9); stamp(d, ['p', 'P'], 36, 9)
    stamp(d, ['m.m', '.m.'], 28, 15); stamp(d, ['m.m', '.m.'], 34, 15)  # 閉じた目（下向きの弧）
    stamp(d, ['pp', '.m'], 32, 17)
    return c.paint(white, stripes, set(), d)

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
