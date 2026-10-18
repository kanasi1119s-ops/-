# 驚いた顔の設計図を作る（ドット絵エディタで描く前の下準備）。
#   python3 tools/face_surprise.py [名前...] → assets/editor/faces/surprise.design.json
#   そのあと node tools/editor_touch.mjs assets/editor/faces/surprise.design.json で、エディタのえんぴつで描いて書き出す（assets/img/surprise_<名前>.png）
# 人ごとの位置は tools/face_points.json（拡大した絵と目盛りで見比べて決めた）。描くもの:
#   元の目・口を消す: 平らにぬらず、同じ行のいちばん近い肌のドットを写す（ほおの陰影が残る）
#   眉: 元の眉のドットを2行持ち上げる（驚くと眉が上がる）
#   目: まぶたを上げて、瞳のまわりに白目が見える（瞳の色・ハイライトはその人の目から取る。下まぶたは肌の陰の色）。眼鏡の人はレンズの中に白目と黒目
#   口: 縦長の「お」。唇の陰の色でふちどり、上の歯・口の奥・舌
#   冷や汗: 縁どりとハイライトのついたしずく
# 怒った顔: python3 tools/face_surprise.py --angry → angry.design.json（assets/img/angry_<名前>.png）
#   眉: 元の眉を消して、眉間に向かって下がる斜めの眉と、眉間の縦じわ　目: 上まぶたを下ろしてにらむ（瞳の色・ハイライトはその人の目から、瞳の下に白目）
#   口: 唇の色でふちどって、上の歯・下の歯（陰）・すき間の奥を描き分けた食いしばり　こめかみに怒りマーク
import json, os, sys
from collections import Counter
from PIL import Image
ROOT = os.path.join(os.path.dirname(__file__), '..')
WHITE, IRIS = (255, 255, 255), None
MOUTH, THROAT, TONGUE = (150, 40, 44), (78, 18, 22), (214, 104, 112)
DROP, DROP_L, DROP_W = (47, 111, 184), (140, 200, 255), (232, 246, 255)
lum = lambda c: 0.3 * c[0] + 0.59 * c[1] + 0.11 * c[2]
dist = lambda a, b: sum((a[i] - b[i]) ** 2 for i in range(3)) ** 0.5

# 目（K まぶた・S 白目・I 瞳・P 瞳の中心・H ハイライト・s 下まぶたの陰）。まぶたを上げて、瞳のまわりに白目が見える
EYE_NEAR = ['.KKKK.', 'KSHIS.', '.SIPS.', '.SIIS.', '..ss..']
EYE_FAR = ['.KKK.', 'KHIS.', '.IPS.', '.IIS.', '.ss..']
# 口（l 唇の陰・T 上の歯・D 口の奥・t 舌）。縦長の「お」
MOUTH4 = ['.ll.', 'lTTl', 'lDDl', 'lttl', '.ll.']
MOUTH5 = ['.lll.', 'lTTTl', 'lDDDl', 'lDtDl', '.lll.']
SWEAT = ['.B.', 'BLB', 'BLB', 'BWB', '.B.']
# 怒った顔（--angry）。眉は眉間に向かって下がる（b 眉）。上まぶたを下ろしてにらむ（瞳の上半分がかくれる）
ANGRY_BROW_NEAR = ['bb....', '.bbbb.', '...bbb']  # 手前の目: 眉間は右
ANGRY_BROW_FAR = ['...bb', '.bbb.', 'bb...']     # 奥の目: 眉間は左
# 目: 上まぶたを下ろして瞳の上がかくれ、瞳の下に白目が見える（にらむ目）
ANGRY_EYE_NEAR = ['.KKKKK', 'KSHPIS', '.SIIIS', '..sss.']
ANGRY_EYE_FAR = ['KKKK.', 'SHPIK', '.IIS.', '.ss..']
# 食いしばった口（L 唇・T 上の歯・u 歯の境目・g 歯のすき間の奥・t 下の歯（陰）・c 口の端の陰）
GRIT4 = ['.LLLLL.', 'LTTuTTL', 'cgggggc', 'LtttttL', '.LLLLL.']
GRIT5 = ['.LLLLLL.', 'LTTuTTTL', 'cggggggc', 'LttttttL', '.LLLLLL.']
# 怒りマーク（こめかみの「💢」。r 赤・d 赤の陰）
VEIN = ['..r.r..', '.rd.dr.', 'rd...dr', '.......', 'rd...dr', '.rd.dr.', '..r.r..']

def design(name, p, angry=False):
    src = f"pose_{name}_{p['pose']}"
    im = Image.open(os.path.join(ROOT, 'assets/img', f'{src}.png')).convert('RGBA'); px = im.load(); W, H = im.size
    skin0 = px[p['skin'][0], p['skin'][1]][:3]
    is_skin = lambda c: c[3] and dist(c, skin0) < p.get('skinTol', 70) and lum(c) > lum(skin0) * 0.62
    cur = {(x, y): px[x, y] for y in range(H) for x in range(W)}
    out = {}
    def put(x, y, c):
        if 0 <= x < W and 0 <= y < H: out[(x, y)] = c; cur[(x, y)] = c + (255,) if len(c) == 3 else c
    # 輪郭の色（顔のあたりでいちばん多い暗い色）
    boxes = p.get('clear', [])
    xs = [b[0] for b in boxes] + [b[2] for b in boxes]; ys = [b[1] for b in boxes] + [b[3] for b in boxes]
    cnt = Counter(px[x, y][:3] for y in range(max(0, min(ys) - 4), min(H, max(ys) + 5)) for x in range(max(0, min(xs) - 4), min(W, max(xs) + 5)) if px[x, y][3] and lum(px[x, y]) < 55)
    K = cnt.most_common(1)[0][0] if cnt else (34, 22, 20)
    def inpaint(x0, y0, x1, y1):
        """枠の中の肌でないドットを、同じ行のいちばん近い肌のドットで埋める"""
        for y in range(y0, y1 + 1):
            for x in range(x0, x1 + 1):
                c = px[x, y]
                if not c[3] or is_skin(c): continue
                best = None
                for d in range(1, 12):
                    for xx in (x - d, x + d):
                        if (xx < x0 or xx > x1) and 0 <= xx < W and is_skin(px[xx, y]): best = px[xx, y][:3]; break
                    if best: break
                put(x, y, best or skin0)
    mix = lambda a, b, t: tuple(round(a[i] * (1 - t) + b[i] * t) for i in range(3))
    # 1. 眉を2行持ち上げる（目の上3〜4行にある、肌のとなりの暗いドット）
    browc = {}
    for i, (x0, x1, y0) in enumerate(p.get('eyes', [])):
        if p.get('noBrow'): break
        brow = [(x, y) for y in range(y0 - 4, y0) for x in range(x0 - 1, x1 + 2)
                if 0 <= x < W and 0 <= y < H and px[x, y][3] and lum(px[x, y]) < lum(skin0) * 0.55
                and any(is_skin(px[x, yy]) for yy in (y - 1, y + 1, y + 2) if 0 <= yy < H)]
        for x, y in brow: put(x, y, px[x, y + 1][:3] if is_skin(px[x, y + 1]) else skin0)  # 元の場所は肌に
        if angry:  # 怒り: 元の眉は消して、あとで斜めの眉を描く（色は元の眉から）
            if brow: browc[i] = mix(Counter(px[x, y][:3] for x, y in brow).most_common(1)[0][0], K, 0.3)
            bright = lambda c: c[3] and is_skin(c) and lum(c) >= lum(skin0) * 0.88
            edge, grow = set(), set(brow)
            for _ in range(2):  # 眉のふち（2ドットまで）の、少し暗いドットも消す
                grow = {(x + dx, y + dy) for x, y in grow for dx in (-1, 0, 1) for dy in (-1, 0, 1)
                        if x0 - 2 <= x + dx <= x1 + 2 and y0 - 5 <= y + dy < y0 and (x + dx, y + dy) not in brow and (x + dx, y + dy) not in edge
                        and px[x + dx, y + dy][3] and lum(px[x + dx, y + dy]) < lum(skin0) * 0.88}
                edge |= grow
            for x, y in edge:
                best = next((px[xx, y][:3] for d in range(1, 10) for xx in (x - d, x + d) if 0 <= xx < W and (xx, y) not in edge and bright(px[xx, y])), skin0)
                put(x, y, best)
            continue
        for x, y in brow: put(x, y - 2, px[x, y][:3])
    # 2. 元の目と口を消す
    for b in boxes: inpaint(*b)
    # 3. 見開いた目（色はその人の目から取る）
    def iris_of(x0, x1, y0):
        cand = Counter(px[x, y][:3] for y in range(y0, y0 + 5) for x in range(x0, x1 + 1)
                       if 0 <= x < W and 0 <= y < H and px[x, y][3] and not is_skin(px[x, y]) and 45 < lum(px[x, y]) < 170)
        return cand.most_common(1)[0][0] if cand else mix(K, (120, 80, 60), 0.5)
    SCLERA = (244, 238, 230)
    lid_shadow = mix(skin0, K, 0.35)
    pal = {'K': K, 'W': WHITE, 'P': K, 'B': DROP, 'L': DROP_L}
    def stamp(rows, x0, y0, pal2=None):
        for j, row in enumerate(rows):
            for i, ch in enumerate(row):
                if ch != '.': put(x0 + i, y0 + j, (pal2 or pal)[ch])
    eye_cols = [iris_of(x0, x1, y0) for x0, x1, y0 in p.get('eyes', [])]
    for i, (x0, x1, y0) in enumerate(p.get('eyes', [])):  # 手前の目は6×5、奥の目は5×5（右の端にそろえる）
        iris = eye_cols[i]
        ep = {'K': K, 'S': SCLERA, 'I': iris, 'P': mix(iris, K, 0.7), 'H': WHITE, 's': lid_shadow}
        rows = (ANGRY_EYE_NEAR if i == 0 else ANGRY_EYE_FAR) if angry else EYE_NEAR if i == 0 else EYE_FAR
        ex = x0 + (x1 - x0 + 1 - len(rows[0])) // 2 if i == 0 else x1 - len(rows[0]) + 1
        if angry:
            stamp(rows, ex, y0 + 1, ep)
            brows = ANGRY_BROW_NEAR if i == 0 else ANGRY_BROW_FAR
            stamp(brows, ex, y0 - 3, {'b': browc.get(i, K)})
        else: stamp(rows, ex, y0, ep)
    for x0, x1, y0, y1, ppx, ppy in p.get('lens', []):  # 眼鏡: レンズの中を白目の色にして、2×2の瞳（ハイライトつき）
        iris = mix(K, (110, 72, 50), 0.45)
        for y in range(y0, y1 + 1):
            for x in range(x0, x1 + 1): put(x, y, SCLERA)
        if angry:  # レンズの上の行はまぶた（眉間の側が下がる）、眉はレンズの上に斜めに
            near = x0 < p['mouth'][0]
            for x in range(x0, x1 + 1): put(x, y0, K)
            put(x1 if near else x0, y0 + 1, K)
            for k, x in enumerate(range(x0, x1 + 1) if near else range(x1, x0 - 1, -1)):
                put(x, y0 - 3 + (k * 3) // (x1 - x0 + 1), K)
            put(ppx, ppy + 1, iris); put(ppx + 1, ppy + 1, mix(iris, K, 0.7))
            continue
        put(ppx, ppy, WHITE); put(ppx + 1, ppy, iris); put(ppx, ppy + 1, iris); put(ppx + 1, ppy + 1, mix(iris, K, 0.7))
    for x0, x1, y0, y1, ppx, ppy in p.get('bigEyes', []):  # 大きな黒目（宇宙人）: 形はそのまま、内側だけ白目にして、2×2の小さな黒目
        dark = {(x, y) for y in range(y0, y1 + 1) for x in range(x0, x1 + 1) if px[x, y][3] and not is_skin(px[x, y])}
        if angry:  # 怒り: 黒目の上を、眉間に向かって下がる斜めの線で切る（線より上は肌、線は眉）
            near = x0 < p['mouth'][0]
            top = min(y for _, y in dark)
            for x, y in dark:
                t = (x - x0) / max(1, x1 - x0) if near else (x1 - x) / max(1, x1 - x0)
                cut = top + round(t * (y1 - top) * 0.5)
                if y < cut: put(x, y, skin0)
            for x in range(x0 - 1, x1 + 2):
                t = (x - x0) / max(1, x1 - x0) if near else (x1 - x) / max(1, x1 - x0)
                yb = top - 2 + round(t * (y1 - top) * 0.5)
                put(x, yb, K); put(x, yb + 1, K)
            put(ppx, ppy + 1, (214, 58, 44)); put(ppx + 1, ppy + 1, (214, 58, 44))  # 赤く光る目
            continue
        for x, y in dark:
            if all((x + dx, y + dy) in dark for dx in (-1, 0, 1) for dy in (-1, 0, 1)): put(x, y, WHITE)  # まわり8マスとも黒目の所だけ（縁を1ドット残す）
        for dx in (0, 1):
            for dy in (0, 1): put(ppx + dx, ppy + dy, K)
    # 4. 「お」の口
    cx, my, w = p['mouth']
    lip = mix(mix(skin0, (128, 40, 44), 0.55), K, 0.15)
    if angry:  # 歯をくいしばる「ギリッ」
        rows = GRIT5 if w >= 3 else GRIT4
        stamp(rows, cx - len(rows[0]) // 2, my, {'L': lip, 'c': THROAT, 'T': (242, 236, 224), 'u': (208, 198, 184),
                                                 'g': THROAT, 't': (208, 198, 184)})
        ne, fe = p.get('eyes', [None, None])[:2] if len(p.get('eyes', [])) >= 2 else (None, None)
        if ne and fe:  # 眉間の縦じわ（2本）
            mx = (ne[1] + fe[0]) // 2 + 1
            for x in (mx - 1, mx + 1):
                for y in (ne[2] - 3, ne[2] - 2): put(x, y, lid_shadow)
        sx, sy = p['sweat']  # 怒りマークはこめかみ（冷や汗の少し上）
        vx, vy = sx - 2, sy - 6
        mark = {(vx + i, vy + j) for j, row in enumerate(VEIN) for i, ch in enumerate(row) if ch != '.'}
        for x, y in {(x + dx, y + dy) for x, y in mark for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))} - mark:  # 暗いふちどり（赤い髪や赤い肌の上でも見える）
            if not (vx + 2 <= x <= vx + 4 and vy + 2 <= y <= vy + 4) and px[x, y][3]: put(x, y, THROAT)
        stamp(VEIN, vx, vy, {'r': (214, 58, 44), 'd': (150, 30, 26)})
    else:
        rows = MOUTH5 if w >= 3 else MOUTH4
        stamp(rows, cx - len(rows[0]) // 2, my, {'l': lip, 'T': (246, 240, 232), 'D': THROAT, 't': TONGUE})
        # 5. 冷や汗
        sx, sy = p['sweat']
        stamp(SWEAT, sx, sy, {'B': DROP, 'L': DROP_L, 'W': DROP_W})
    hexc = lambda c: '#%02x%02x%02x' % c[:3]
    touch = [{'x': x, 'y': y, 'color': hexc(c)} for (x, y), c in sorted(out.items(), key=lambda t: (t[0][1], t[0][0])) if px[x, y][3] == 0 or px[x, y][:3] != c[:3]]
    return src, touch

if __name__ == '__main__':
    pts = json.load(open(os.path.join(ROOT, 'tools/face_points.json')))
    angry = '--angry' in sys.argv
    only = [a for a in sys.argv[1:] if not a.startswith('--')]
    kind = 'angry' if angry else 'surprise'
    d = {}
    for name, p in pts.items():
        if name.startswith('_') or (only and name not in only): continue
        src, touch = design(name, p, angry)
        d[f'{kind}_{name}'] = {'from': src, 'touch': touch}
        print(name, src, len(touch))
    json.dump(d, open(os.path.join(ROOT, f'assets/editor/faces/{kind}.design.json'), 'w'), ensure_ascii=False)
