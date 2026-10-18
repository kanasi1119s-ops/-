# 従業員の絵の設計図を作る（ドット絵エディタで描く前の下準備）。
#   python3 tools/staff_art.py → assets/editor/staff/staff.design.json
#   そのあと EDITOR_OUT=assets/editor/staff node tools/editor_touch.mjs assets/editor/staff/staff.design.json で、
#   エディタのえんぴつで描いて書き出す（assets/img/staff_<id>_<番号>.png）
# 元にする絵と、描き足すもの:
#   アルバイト（店主の 0 腕組み・1 手を挙げる・2 かがんで取る）: 頭の手ぬぐいを橙のバンダナに、Tシャツを山吹色に、前掛けを緑に。丸い眼鏡
#   看板店員（バレー部の 2・3 話す）: 赤いユニフォームを藍の法被に（背番号は消して、胸に白い丸の紋）。赤いはちまき
#   職人の弟子（空手家の 3 話す・7 差し出す）: 白い道着を藍の作務衣に（はちまきはそのまま）。かご・袋の代わりに、縄でしばった重石
# 色替えは明るさで段階に分ける（元の陰影が残る。エディタの色の表は62色までなので、段階は4〜6）。
import colorsys, json, os
from PIL import Image
ROOT = os.path.join(os.path.dirname(__file__), '..')
lum = lambda c: 0.3 * c[0] + 0.59 * c[1] + 0.11 * c[2]
hexc = lambda c: '#%02x%02x%02x' % tuple(c[:3])
rgb = lambda h: tuple(int(h[i:i + 2], 16) for i in (1, 3, 5))
def hsv(c): return colorsys.rgb_to_hsv(*(v / 255 for v in c[:3]))

RAMP = {  # 暗い → 明るい
    'indigo': ['#1a2036', '#242d4a', '#303c62', '#435482', '#5e72a2', '#8496c4'],
    'green': ['#1b3022', '#2c4a32', '#466c4a', '#5e865e'],
    'orange': ['#8a3a16', '#c45a22', '#ec853a', '#f6aa68'],
    'yellow': ['#8a6a26', '#c49c36', '#e4c45a', '#f2dc8a'],
    'red': ['#7a1a16', '#a8261e', '#d23a2c', '#e8604a'],
}
SKIN = lambda c: 0.02 <= hsv(c)[0] <= 0.11 and hsv(c)[1] > 0.25 and lum(c) > 110

class Art:
    def __init__(self, src):
        self.src = src
        self.im = Image.open(os.path.join(ROOT, 'assets/img', f'{src}.png')).convert('RGBA')
        self.px = self.im.load(); self.W, self.H = self.im.size
        self.out = {}
    def get(self, x, y):
        if (x, y) in self.out: return self.out[(x, y)]
        c = self.px[x, y]
        return c[:3] if c[3] else None
    def put(self, x, y, c):
        if 0 <= x < self.W and 0 <= y < self.H: self.out[(x, y)] = rgb(c) if isinstance(c, str) else c
    def recolor(self, sel, ramp, box=None):
        """sel(x, y, 色) が真のドットを、明るさの順に ramp の色へ（元の陰影を段階に分けて残す）"""
        x0, y0, x1, y1 = box or (0, 0, self.W - 1, self.H - 1)
        pts = [(x, y) for y in range(y0, y1 + 1) for x in range(x0, x1 + 1) if self.px[x, y][3] and sel(x, y, self.px[x, y][:3])]
        if not pts: return 0
        ls = [lum(self.px[x, y]) for x, y in pts]; lo, hi = min(ls), max(ls)
        cols = [rgb(c) for c in RAMP[ramp]]
        for (x, y), l in zip(pts, ls): self.put(x, y, cols[round((l - lo) / max(1, hi - lo) * (len(cols) - 1))])
        return len(pts)
    def stamp(self, rows, x0, y0, pal):
        for j, row in enumerate(rows):
            for i, ch in enumerate(row):
                if ch != '.': self.put(x0 + i, y0 + j, pal[ch])
    def erase(self, sel, box):
        x0, y0, x1, y1 = box
        for y in range(max(0, y0), min(self.H - 1, y1) + 1):
            for x in range(max(0, x0), min(self.W - 1, x1) + 1):
                c = self.get(x, y)
                if c and sel(x, y, c): self.out[(x, y)] = None
    def touch(self):
        res = []
        for (x, y), c in sorted(self.out.items(), key=lambda t: (t[0][1], t[0][0])):
            o = self.px[x, y]
            if c is None:
                if o[3]: res.append({'x': x, 'y': y, 'color': None})
            elif not o[3] or o[:3] != tuple(c): res.append({'x': x, 'y': y, 'color': hexc(c)})
        return {'from': self.src, 'touch': res}

def glasses(a, near, far, bridge_y, temple):
    """丸い眼鏡。near / far = レンズのふちの外側 (x0, y0, x1, y1)。手前のレンズは広く、奥は細い（斜めから見ているので）。
    ふちは角を2段落とした丸。細い金属のふちに見えるよう、黒ではなくこげ茶（下のふちは光を受けて少し明るい）。
    レンズの左上に、肌の色を明るくした光を斜めに2ドット。鼻の上にブリッジ、手前のふちから耳へつる。
    光とふちの明るい色は、元の絵の色の表から近い色を選ぶ（エディタの色の表は62色まで）"""
    pal = {a.px[x, y][:3] for y in range(a.H) for x in range(a.W) if a.px[x, y][3]}
    near_col = lambda t: min(pal, key=lambda c: sum((c[i] - t[i]) ** 2 for i in range(3)))
    frame, rim, glint = '#4a3024', near_col((122, 82, 62)), near_col((252, 226, 204))
    for x0, y0, x1, y1 in (near, far):
        ring = set()
        for x in range(x0 + 2, x1 - 1): ring |= {(x, y0), (x, y1)}
        for y in range(y0 + 2, y1 - 1): ring |= {(x0, y), (x1, y)}
        ring |= {(x0 + 1, y0 + 1), (x1 - 1, y0 + 1), (x0 + 1, y1 - 1), (x1 - 1, y1 - 1)}
        for x, y in ring: a.put(x, y, rim if y == y1 or (y == y1 - 1 and x in (x0 + 1, x1 - 1)) else frame)
        a.put(x0 + 3, y0 + 2, glint); a.put(x0 + 2, y0 + 3, glint)  # 斜めの光
    for x in range(near[2] + 1, far[0]): a.put(x, bridge_y, frame)
    for x in range(temple, near[0]): a.put(x, (near[1] + near[3]) // 2 - 1, frame)

def baito(pose, specs, rows):
    a = Art(f'pose_keeper_{pose}')
    head, shirt0, shirt1 = rows
    light = lambda c: hsv(c)[1] < 0.3 and lum(c) > 85 and not SKIN(c)
    a.recolor(lambda x, y, c: light(c), 'orange', (0, 0, a.W - 1, head))  # 手ぬぐい → バンダナ
    a.recolor(lambda x, y, c: light(c), 'yellow', (0, shirt0, a.W - 1, shirt1))  # Tシャツ
    a.recolor(lambda x, y, c: 0.52 < hsv(c)[0] < 0.72 and hsv(c)[1] > 0.2, 'green', (0, shirt0, a.W - 1, a.H - 1))  # 前掛け
    glasses(a, *specs)
    return a

def kanban(pose, crest, band_y, hands):
    a = Art(f'pose_volley_{pose}')
    strict = lambda c: (hsv(c)[0] < 0.02 or hsv(c)[0] > 0.94) and hsv(c)[1] > 0.5 and lum(c) > 40
    loose = lambda c: (hsv(c)[0] < 0.06 or hsv(c)[0] > 0.9) and hsv(c)[1] > 0.3 and lum(c) > 35
    in_hand = lambda x, y: any(x0 <= x <= x1 and y0 <= y <= y1 for x0, y0, x1, y1 in hands)
    red = lambda x, y, c: strict(c) if in_hand(x, y) else loose(c)  # ユニフォームの赤（手のまわりは、肌の陰を拾わないよう厳しく）
    pink = lambda c: (hsv(c)[0] < 0.03 or hsv(c)[0] > 0.88) and lum(c) >= 105  # 背番号の白っぽい赤
    cx, cy = crest
    num = lambda x, y, c: abs(x - cx) < 8 and abs(y - cy) < 15 and pink(c)
    a.recolor(lambda x, y, c: red(x, y, c) and not num(x, y, c), 'indigo', (0, 36, a.W - 1, 80))
    for y in range(cy - 14, cy + 15):  # 背番号は法被の地の色でぬりつぶす
        for x in range(cx - 7, cx + 8):
            if a.px[x, y][3] and num(x, y, a.px[x, y][:3]): a.put(x, y, RAMP['indigo'][2])
    a.stamp(['..www..', '.w...w.', 'w.....w', 'w..w..w', 'w.....w', '.w...w.', '..www..'], cx - 3, cy - 3, {'w': '#f2ede2'})  # 胸の白い紋
    # はちまき: 額の上を横切る赤い帯（3行。明るい・ふつう・陰）と、頭の後ろ（左）の結び目と垂れ
    x0 = 12
    xs = [x for x in range(x0, a.W) if a.px[x, band_y][3]]
    x1 = max(xs)
    for x in range(x0, x1 + 1):
        for dy, c in enumerate(('#e8604a', '#d23a2c', '#8f2018')):
            if a.px[x, band_y + dy][3]: a.put(x, band_y + dy, c)
    a.stamp(['.rrr', 'rRrr', 'rr.R', '.r..', '.rR.', '..r.'], x0 - 3, band_y - 1, {'r': '#d23a2c', 'R': '#8f2018'})
    return a

# 重石: 上が少し平らな丸い川石。左上から光が当たる5段の陰（ふちは暗い線）、ところどころに斑点。
# わらの縄を十文字にかけて、上で結び、結び目から手へ。縄はよじれて見えるよう、明るい・暗いを1ドットずつ互い違いに
STONE_C = {'K': '#322823', '1': '#45423d', '2': '#5f5b54', '3': '#7c786f', '4': '#9b978d', '5': '#bdb9ae', 's': '#5f5b54',
           'r': '#d8b060', 'R': '#9a7436', 'o': '#45423d'}  # ふちどりは空手家の絵のふちの色。縄の影・斑点は石の色を使う（エディタの色の表は62色まで）

def stone(a, cx, top, w=20, h=17):
    rx, ry, cy = w / 2, h / 2, top + h / 2
    cells = {}
    for y in range(top, top + h):
        for x in range(int(cx - rx) - 1, int(cx + rx) + 2):
            nx, ny = (x + 0.5 - cx) / rx, (y + 0.5 - cy) / ry
            if ny < 0: ny *= 1.12  # 上は少し平ら
            nx2 = nx * (1.08 if nx > 0 else 1)  # 左右で少しちがう（川石のいびつさ）
            if abs(nx2) ** 2.15 + abs(ny) ** 2.15 <= 1:
                nz = max(0.0, 1 - nx * nx - ny * ny) ** 0.5
                cells[(x, y)] = -0.55 * nx - 0.65 * ny + 0.5 * nz  # 左上からの光
    for (x, y), v in cells.items():
        edge = any((x + dx, y + dy) not in cells for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)))
        c = 'K' if edge else '5' if v > 0.75 else '4' if v > 0.45 else '3' if v > 0.15 else '2' if v > -0.2 else '1'
        if c in '12345':  # 石の肌のざらつき（まわりの絵と同じように、ドットごとに少しゆらす）
            r = ((x * 73856093) ^ (y * 19349663)) % 100
            c = '12345'[min(4, '12345'.index(c) + 1)] if r < 15 else '12345'[max(0, '12345'.index(c) - 1)] if r < 30 else c
        if not edge and c in '234' and (x * 7 + y * 13) % 17 == 0: c = 's'  # 斑点
        a.put(x, y, STONE_C[c])
    # 照り返し: 下のふちのすぐ内側を少し明るく（地面からの光）
    for (x, y), v in cells.items():
        if (x, y + 1) not in cells and (x, y - 1) in cells and (x + 1, y) in cells and (x - 1, y) in cells:
            above = (x, y - 1)
            if all((above[0] + dx, above[1]) in cells for dx in (-1, 1)): a.put(x, y - 1, STONE_C['3'])
    # 縄: 1ドットのよじれた縄（明・明・暗のくり返し）を、横に1本（ふくらみに沿って少し下へ曲がる）と、縦に1本
    twist = lambda i: STONE_C['R' if i % 3 == 2 else 'r']
    for i, x in enumerate(range(int(cx - rx) + 1, int(cx + rx))):
        nx = (x + 0.5 - cx) / rx  # 少し上から見ているので、胴まわりの縄は手前（まん中）ほど下がる
        y = round(cy - 2 + 3 * max(0.0, 1 - nx * nx) ** 0.5)
        if (x, y) in cells and (x, y + 1) in cells and (x, y - 1) in cells:
            a.put(x, y, twist(i)); a.put(x, y + 1, STONE_C['o'])  # 縄の下に影
    vx = round(cx)
    for i, y in enumerate(range(top + 1, top + h - 1)):
        if (vx, y) in cells and (vx + 1, y) in cells and (vx - 1, y) in cells:
            a.put(vx, y, twist(i)); a.put(vx + 1, y, STONE_C['o'])
    # 結び目（石のてっぺん）
    for j, row in enumerate(['.r.', 'rRr', '.R.']):
        for i, ch in enumerate(row):
            if ch != '.': a.put(vx - 1 + i, top - 1 + j, STONE_C[ch])

def deshi(pose, bag_box, hand, stone_at, keep):
    a = Art(f'pose_karate_{pose}')
    gi = lambda c: hsv(c)[1] < 0.25 and lum(c) > 105
    wicker = lambda c: 0.1 < hsv(c)[0] < 0.18 and hsv(c)[1] > 0.3
    a.erase(lambda x, y, c: not (SKIN(c) and not wicker(c) and y < hand[1] + 5 and hand[0] - 10 < x < hand[0] + 16) and not (gi(c) and keep(x, y)), bag_box)
    x0, y0, x1, y1 = bag_box  # 消したあとに、ぽつんと残ったドットも消す
    for y in range(max(0, y0), min(a.H - 1, y1) + 1):
        for x in range(max(0, x0), min(a.W - 1, x1) + 1):
            if a.get(x, y) and not any(0 <= x + dx < a.W and 0 <= y + dy < a.H and a.get(x + dx, y + dy) for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))):
                a.out[(x, y)] = None  # かご・袋を消す（手と道着は残す。かごの色は肌に近いので、手の高さより下は消す）
    a.recolor(lambda x, y, c: gi(c) and (x, y) not in a.out, 'indigo', (0, 34, a.W - 1, a.H - 1))  # 道着 → 作務衣
    sx, sy = stone_at
    hx, hy = hand
    for i, y in enumerate(range(hy, sy - 1)):  # 縄（手から結び目へ。1ドットのよじれた縄）
        a.put(hx + 1, y, STONE_C['R' if i % 3 == 2 else 'r'])
    stone(a, hx + 1, sy)
    return a

if __name__ == '__main__':
    d = {}
    # アルバイト: 眼鏡 = (手前のレンズ, 奥のレンズ, ブリッジの行, つるの左端)。レンズはふちの外側 (x0, y0, x1, y1)。目の位置は元の絵で確かめた
    # rows = (頭の下の行, Tシャツの上, Tシャツの下)
    for pose, specs, rows in [(0, ((19, 17, 28, 24), (32, 17, 38, 24), 20, 17), (36, 38, 80)),
                              (1, ((28, 17, 37, 24), (41, 17, 47, 24), 20, 25), (34, 36, 80)),
                              (2, ((35, 20, 44, 27), (48, 20, 54, 27), 23, 33), (28, 30, 74))]:
        d[f'staff_baito_{pose}'] = baito(pose, specs, rows).touch()
    for pose, crest, hands in [(2, (27, 52), [(0, 40, 10, 56), (10, 45, 30, 62), (32, 36, 60, 58)]), (3, (24, 52), [(0, 40, 9, 56), (10, 52, 30, 70), (34, 42, 62, 60)])]:
        d[f'staff_kanban_{pose}'] = kanban(pose, crest, 13, hands).touch()
    # 弟子: 3 はかごを腕に掛けている（取っ手の上に手）、7 は袋を差し出している
    d['staff_deshi_3'] = deshi(3, (39, 58, 68, 94), (52, 58), (52, 68), lambda x, y: x < 41).touch()
    d['staff_deshi_7'] = deshi(7, (63, 60, 87, 90), (68, 58), (70, 68), lambda x, y: False).touch()
    os.makedirs(os.path.join(ROOT, 'assets/editor/staff'), exist_ok=True)
    json.dump(d, open(os.path.join(ROOT, 'assets/editor/staff/staff.design.json'), 'w'), ensure_ascii=False)
    for k, v in d.items(): print(k, v['from'], len(v['touch']))
