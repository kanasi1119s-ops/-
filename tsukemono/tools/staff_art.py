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

def glasses(a, near, far):
    """丸い眼鏡。near/far = (x0, x1, y0, y1)（目のまわりのレンズの内側）"""
    F = '#3a2a22'
    for x0, x1, y0, y1 in (near, far):
        for x in range(x0, x1 + 1): a.put(x, y0 - 1, F); a.put(x, y1 + 1, F)
        for y in range(y0, y1 + 1): a.put(x0 - 1, y, F); a.put(x1 + 1, y, F)
    for x in range(near[1] + 2, far[0] - 1): a.put(x, near[2] + 1, F)  # ブリッジ

def baito(pose, eyes, rows):
    a = Art(f'pose_keeper_{pose}')
    head, shirt0, shirt1 = rows
    light = lambda c: hsv(c)[1] < 0.3 and lum(c) > 85 and not SKIN(c)
    a.recolor(lambda x, y, c: light(c), 'orange', (0, 0, a.W - 1, head))  # 手ぬぐい → バンダナ
    a.recolor(lambda x, y, c: light(c), 'yellow', (0, shirt0, a.W - 1, shirt1))  # Tシャツ
    a.recolor(lambda x, y, c: 0.52 < hsv(c)[0] < 0.72 and hsv(c)[1] > 0.2, 'green', (0, shirt0, a.W - 1, a.H - 1))  # 前掛け
    glasses(a, *eyes)
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

STONE = [  # 重石（K 縁・1〜4 石の明るさ・r 縄・R 縄の陰）
    '.....KKKKKKKK.....',
    '...KK44433322KK...',
    '..K4443333222221K.',
    '.K44433332222211K.',
    'K4rrrrrrrrrrrrrr1K',
    'K3RRRRRRRRRRRRRR1K',
    'K33332222r221111K.',
    'K33322222r221111K.',
    '.K332222rR22111KK.',
    '.K32222rR2211111K.',
    '..KK222r221111KK..',
    '....KKKKKKKKKK....',
]
STONE_PAL = {'K': '#2c2a28', '1': '#4a4844', '2': '#6c6a64', '3': '#8e8c84', '4': '#b4b2aa', 'r': '#cda45a', 'R': '#8a6a32'}

def deshi(pose, bag_box, hand, stone_at, keep):
    a = Art(f'pose_karate_{pose}')
    gi = lambda c: hsv(c)[1] < 0.25 and lum(c) > 105
    a.erase(lambda x, y, c: not (SKIN(c) and y < hand[1] + 5) and not (gi(c) and keep(x, y)), bag_box)  # かご・袋を消す（手と道着は残す。かごの色は肌に近いので、手の高さより下は消す）
    a.recolor(lambda x, y, c: gi(c) and (x, y) not in a.out, 'indigo', (0, 34, a.W - 1, a.H - 1))  # 道着 → 作務衣
    sx, sy = stone_at
    hx, hy = hand
    for y in range(hy, sy + 1): a.put(hx, y, '#cda45a'); a.put(hx + 1, y, '#8a6a32')  # 縄（手から石へ）
    a.stamp(STONE, sx - 9 + (hx - sx), sy, STONE_PAL)
    return a

if __name__ == '__main__':
    d = {}
    # アルバイト: 目のまわり（レンズの内側）は 手前 (x0,x1,y0,y1)・奥。rows = (頭の下の行, Tシャツの上, Tシャツの下)
    for pose, eyes, rows in [(0, ((21, 28, 20, 24), (33, 39, 20, 24)), (36, 38, 80)),
                             (1, ((28, 34, 18, 22), (41, 47, 18, 22)), (34, 36, 80)),
                             (2, ((34, 41, 22, 26), (48, 54, 22, 26)), (28, 30, 74))]:
        d[f'staff_baito_{pose}'] = baito(pose, eyes, rows).touch()
    for pose, crest, hands in [(2, (27, 52), [(0, 40, 10, 56), (10, 45, 30, 62), (32, 36, 60, 58)]), (3, (24, 52), [(0, 40, 9, 56), (10, 52, 30, 70), (34, 42, 62, 60)])]:
        d[f'staff_kanban_{pose}'] = kanban(pose, crest, 13, hands).touch()
    # 弟子: 3 はかごを腕に掛けている（取っ手の上に手）、7 は袋を差し出している
    d['staff_deshi_3'] = deshi(3, (39, 58, 68, 94), (52, 58), (52, 68), lambda x, y: x < 41).touch()
    d['staff_deshi_7'] = deshi(7, (63, 60, 87, 90), (68, 58), (70, 68), lambda x, y: False).touch()
    os.makedirs(os.path.join(ROOT, 'assets/editor/staff'), exist_ok=True)
    json.dump(d, open(os.path.join(ROOT, 'assets/editor/staff/staff.design.json'), 'w'), ensure_ascii=False)
    for k, v in d.items(): print(k, v['from'], len(v['touch']))
