# 脚のあいだ・腕と胴のあいだに残った背景（参照画像の薄い青灰色）を見つけて消す設計図を作る。
#   python3 tools/sprite_ghost.py find    → 候補を assets/editor/mend/ghost_cands.json に書き、拡大の一覧を docs/ghost/ に出す
#   （一覧を見て、消してよい候補の番号を assets/editor/mend/ghost_picks.json に書く）
#   python3 tools/sprite_ghost.py design  → assets/editor/mend/ghost.design.json（エディタで描く: EDITOR_OUT=assets/editor/mend node tools/editor_touch.mjs ...）
# なぜ残るか: トレース（tools/trace.py）は、輪郭線のすき間を閉じてから内側を埋める（CLOSE_HOLES）。脚のあいだのように
# 細い首でしか外とつながっていない背景も、そのとき体として埋まってしまう。ここでは同じ切り抜きをやり直して
# 「閉じたことで初めて埋まった、背景の色そのままの所」を絵の座標に写し、絵の上で背景に近い色のかたまりを候補にする。
# 白い靴の陰や刀の柄なども候補に入るので、消すものは一覧を見て選ぶ（自動では消さない）。
import ast, json, os, sys
import numpy as np, cv2
from PIL import Image
R = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
src = open(os.path.join(R, 'tools/trace.py')).read()
tree = ast.parse(src)
keep = []
for n in tree.body:
    if isinstance(n, ast.FunctionDef) and n.name in ('drop_ground_shadow', 'bridge_feet'):
        keep.append(n)
    if isinstance(n, ast.Assign) and any(isinstance(t, ast.Name) and t.id in ('SC', 'POSE_ERASE', 'WARM_SHADOW', 'FG_DIFF', 'HOLE_NOT_BG', 'CLOSE_HOLES', 'POSE_HEIGHT') for t in n.targets):
        keep.append(n)
ns = {'np': np, 'cv2': cv2}
exec(compile(ast.Module(body=keep, type_ignores=[]), 'trace_part', 'exec'), ns)
for k in ('drop_ground_shadow', 'bridge_feet', 'POSE_ERASE', 'WARM_SHADOW', 'FG_DIFF', 'HOLE_NOT_BG', 'CLOSE_HOLES', 'POSE_HEIGHT'):
    globals()[k] = ns[k]

MIN_PX = int(os.environ.get('MIN_PX', 8))
def masks(name):
    """ポーズごとに (埋められた割合 filled[h,w], 元の前景の割合 raw[h,w]) をポーズの絵の座標で"""
    a = np.asarray(Image.open(f'{R}/assets/reference/pose_{name}.jpg').convert('RGB')).astype(int)
    h0, w0, _ = a.shape
    bgc = np.median(a[2:10, 2:10].reshape(-1, 3), 0)
    mx, mn = a.max(-1), a.min(-1)
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    gridc = (g > 235) & (b > 235) & (r < 240)
    grid = np.zeros_like(gridc); grid[:, gridc.mean(0) > 0.5] = True; grid[gridc.mean(1) > 0.5, :] = True; grid &= gridc
    fg = ((np.abs(a - bgc).sum(-1) > FG_DIFF.get(name, 40)) & ~grid).astype(np.uint8)
    shadow = ((mx - mn) < 30) & (mx > 105) & (mx < bgc.max() - 8)
    if name in WARM_SHADOW:
        lo, hi, *rest = WARM_SHADOW[name]
        shadow |= ((mx - mn) < (rest[0] if rest else 20)) & (mx > lo) & (mx < hi)
    for x0e, y0e, x1e, y1e in POSE_ERASE.get(name, []):
        fg[y0e:y1e, x0e:x1e] = 0
    fg = cv2.morphologyEx(fg, cv2.MORPH_OPEN, np.ones((3, 3), np.uint8))
    n2, _, st, _ = cv2.connectedComponentsWithStats(fg, 8)
    boxes = [list(st[i, :4]) for i in range(1, n2) if st[i, 4] > 400 and st[i, 0] > 2 and st[i, 1] > 2 and st[i, 0] + st[i, 2] < w0 - 2 and st[i, 1] + st[i, 3] < h0 - 2]
    merged = True
    while merged:
        merged = False
        for i in range(len(boxes)):
            for j in range(i + 1, len(boxes)):
                x1, y1, w1, h1 = boxes[i]; x2, y2, w2, h2 = boxes[j]
                if x1 - 12 < x2 + w2 and x2 - 12 < x1 + w1 and y1 - 12 < y2 + h2 and y2 - 12 < y1 + h1:
                    boxes[i] = [min(x1, x2), min(y1, y2), max(x1 + w1, x2 + w2) - min(x1, x2), max(y1 + h1, y2 + h2) - min(y1, y2)]
                    boxes.pop(j); merged = True; break
            if merged: break
    boxes = [bx for bx in boxes if bx[3] > h0 * 0.2]
    rows = h0 / 2
    boxes.sort(key=lambda bx: (int((bx[1] + bx[3] / 2) // rows), bx[0]))
    scale = POSE_HEIGHT[name] / float(np.median([bx[3] for bx in boxes]))
    out = []
    for i, (x, y, w, h) in enumerate(boxes):
        x0, y0, x1, y1 = max(0, x - 4), max(0, y - 4), min(w0, x + w + 4), min(h0, y + h + 4)
        m = fg[y0:y1, x0:x1].copy()
        sh = shadow[y0:y1, x0:x1].copy()
        sh[:max(0, (y1 - y0) - int(34 * h0 / 572))] = False
        m = drop_ground_shadow(m, sh, a[y0:y1, x0:x1])
        m = bridge_feet(m, a[y0:y1, x0:x1], max(0, (y1 - y0) - int(50 * h0 / 572)), int(30 * h0 / 572), bgc)
        raw = m.copy()
        k = CLOSE_HOLES.get(name)
        pad = (k or 0) + 2
        mp = np.pad(m, pad)
        closed = cv2.morphologyEx(mp, cv2.MORPH_CLOSE, np.ones((k, k), np.uint8)) if k else mp
        inv = (1 - closed).astype(np.uint8)
        cv2.floodFill(inv, np.zeros((inv.shape[0] + 2, inv.shape[1] + 2), np.uint8), (0, 0), 2)
        inv, closed = inv[pad:-pad, pad:-pad], closed[pad:-pad, pad:-pad]
        holes = inv == 1
        if name in HOLE_NOT_BG:
            holes &= np.abs(a[y0:y1, x0:x1] - bgc).sum(-1) > HOLE_NOT_BG[name]
        m[holes] = 1
        byclose = np.zeros_like(holes)
        if k:
            byclose = (closed > 0) & ~sh & (m == 0)  # すき間を閉じて初めて埋まった所（輪郭に囲まれた穴ではない）
            m[(closed > 0) & ~sh] = 1
        m = cv2.morphologyEx(m, cv2.MORPH_OPEN, np.ones((3, 3), np.uint8)).astype(np.float32)
        # 背景の色そのまま（元の絵で背景と差がほとんどない）なのに埋められた所
        bgish = (np.abs(a[y0:y1, x0:x1] - bgc).sum(-1) <= 24)
        filled = ((m > 0) & byclose & bgish).astype(np.float32)
        tw, th = max(1, round((x1 - x0) * scale)), max(1, round((y1 - y0) * scale))
        ms = cv2.resize(m, (tw, th), interpolation=cv2.INTER_AREA)
        alpha = ms > 0.5
        ys, xs = np.nonzero(alpha)
        fs = cv2.resize(filled, (tw, th), interpolation=cv2.INTER_AREA)[ys.min():ys.max() + 1, xs.min():xs.max() + 1]
        fm = (fs > 0.5).astype(np.uint8)  # 縮めた絵の上で、まとまった広さ（MIN_PX ドット以上）のかたまりだけ
        kk, lab, stt, _ = cv2.connectedComponentsWithStats(fm, 8)
        keep = np.zeros(fm.shape, bool)
        for j in range(1, kk):
            if stt[j, 4] >= MIN_PX: keep |= lab == j
        out.append(np.where(keep, fs, 0))
    return out


BG = np.array([196, 205, 214])
MEND = os.path.join(R, 'assets/editor/mend')
CHARS = sorted(CLOSE_HOLES)


def bglike(a, tol=70, sat=40):
    c = a[..., :3].astype(int)
    return (a[..., 3] == 255) & (np.abs(c - BG).sum(-1) < tol) & ((c.max(-1) - c.min(-1)) < sat)


def find():
    from PIL import ImageDraw
    res = []
    for ch in CHARS:
        for i, f in enumerate(masks(ch)):
            p = os.path.join(R, f'assets/img/pose_{ch}_{i}.png')
            if not os.path.exists(p):
                continue
            a = np.asarray(Image.open(p).convert('RGBA'))
            if f.shape != a.shape[:2]:
                continue
            bgl = bglike(a)
            seed = cv2.dilate((f > 0.3).astype(np.uint8), np.ones((3, 3), np.uint8)) > 0
            lim = cv2.dilate(seed.astype(np.uint8), np.ones((5, 5), np.uint8)) > 0
            m = (bgl & seed).astype(np.uint8)
            for _ in range(3):
                m = ((cv2.dilate(m, np.ones((3, 3), np.uint8)) > 0) & bgl & lim).astype(np.uint8)
            k, lab, st, _ = cv2.connectedComponentsWithStats(m, 8)
            for j in range(1, k):
                if st[j, 4] >= 5:
                    ys, xs = np.nonzero(lab == j)
                    res.append({'img': f'pose_{ch}_{i}', 'px': [[int(x), int(y)] for x, y in zip(xs, ys)]})
    json.dump(res, open(os.path.join(MEND, 'ghost_cands.json'), 'w'))
    out = os.path.join(R, 'docs/ghost'); os.makedirs(out, exist_ok=True)
    Z, h, tiles = 5, 14, []
    for idx, r in enumerate(res):
        a = np.asarray(Image.open(os.path.join(R, f"assets/img/{r['img']}.png")).convert('RGBA'))
        xs = [p[0] for p in r['px']]; ys = [p[1] for p in r['px']]
        x0, y0 = max(0, (min(xs) + max(xs)) // 2 - h), max(0, (min(ys) + max(ys)) // 2 - h)
        x1, y1 = min(a.shape[1], x0 + 2 * h), min(a.shape[0], y0 + 2 * h)
        t = Image.new('RGBA', (4 * h * Z + 4, 2 * h * Z + 14), (30, 30, 30, 255))
        for k, mark in enumerate((False, True)):
            c = Image.new('RGBA', (a.shape[1], a.shape[0]), (150, 120, 90, 255)); c.alpha_composite(Image.fromarray(a)); px = np.array(c)
            if mark:
                for x, y in r['px']: px[y, x] = [255, 0, 255, 255]
            t.alpha_composite(Image.fromarray(px[y0:y1, x0:x1]).resize(((x1 - x0) * Z, (y1 - y0) * Z), Image.NEAREST), (k * (2 * h * Z + 4), 14))
        ImageDraw.Draw(t).text((2, 1), f"#{idx} {r['img'][5:]} n{len(r['px'])}", fill=(255, 255, 0, 255)); tiles.append(t)
    for s in range(0, len(tiles), 24):
        chunk = tiles[s:s + 24]; rows = (len(chunk) + 3) // 4
        o = Image.new('RGBA', (4 * (chunk[0].width + 6), rows * (chunk[0].height + 6)), (10, 10, 10, 255))
        for j, t in enumerate(chunk): o.alpha_composite(t, ((j % 4) * (t.width + 6), (j // 4) * (t.height + 6)))
        o.save(os.path.join(out, f'cands_{s // 24}.png'))
    print(len(res), '候補 → docs/ghost/')


def design():
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    from sprite_mend import clean, touches, load
    cands = json.load(open(os.path.join(MEND, 'ghost_cands.json')))
    picks = json.load(open(os.path.join(MEND, 'ghost_picks.json')))['picks']
    by = {}
    for k in picks: by.setdefault(cands[k]['img'], []).append(cands[k])
    fixed = {}
    for n, rs in by.items():
        a = load(n); bgl = bglike(a, 80, 45)
        m = np.zeros(a.shape[:2], np.uint8)
        for r in rs:
            for x, y in r['px']: m[y, x] = 1
        lim = cv2.dilate(m, np.ones((5, 5), np.uint8)) > 0
        for _ in range(2):  # 選んだかたまりのまわりの、同じ背景の色も少しだけ
            m = (((cv2.dilate(m, np.ones((3, 3), np.uint8)) > 0) & bgl & lim) | (m > 0)).astype(np.uint8)
        b = a.copy(); b[m > 0] = 0
        fixed[n] = (a, clean(b, ('halo', 'speck')))
    # 驚いた顔・怒った顔・従業員は、元のポーズの絵から作ったので同じ所に同じ取り残しがある
    faces = open(os.path.join(R, 'assets/faces.js')).read()
    import re
    base = {k: int(v) for k, v in re.findall(r'(\w+): (\d+)', faces[faces.index('SURPRISE_BASE'):faces.index('};', faces.index('SURPRISE_BASE'))])}
    staff = {'staff_kanban': ('volley', [2, 3]), 'staff_deshi': ('karate', [3, 7]), 'staff_baito': ('keeper', [0, 1, 2])}
    derived = []
    for ch, i in base.items():
        for kind in ('surprise', 'angry'): derived.append((f'{kind}_{ch}', f'pose_{ch}_{i}', True))
    for sid, (ch, poses) in staff.items():
        for i in poses: derived.append((f'{sid}_{i}', f'pose_{ch}_{i}', False))
    out = {}
    for n, (a, b) in fixed.items():
        t = touches(a, b)
        if t: out[n] = t
    for n, src, same in derived:
        if src not in fixed or not os.path.exists(os.path.join(R, f'assets/img/{n}.png')):
            continue
        a, b = fixed[src]; d = load(n)
        if d.shape != a.shape:
            continue
        gone = (a[..., 3] > 0) & (b[..., 3] == 0)
        ok = np.all(d == a, -1) if same else bglike(d, 80, 45)  # 顔の絵は元と同じドットだけ、従業員（色を替えた）は背景の色のドットだけ
        e = d.copy(); e[gone & ok & (d[..., 3] > 0)] = 0
        t = touches(d, e)
        if t: out[n] = t
    json.dump(out, open(os.path.join(MEND, 'ghost.design.json'), 'w'))
    print(len(out), '枚', sum(len(v) for v in out.values()), 'ドット')


if __name__ == '__main__':
    import json
    {'find': find, 'design': design}[sys.argv[1]]()
