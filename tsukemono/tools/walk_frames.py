# 歩くコマを作る（脚をドット絵で描き直す）。  python3 tools/walk_frames.py [--boxes 確認用.png]
# トレースした「歩く」ポーズ（各ポーズ集の0番）の、すねから下を消して、同じ色で脚を描き直す。
# 4コマ: 0 右足が前 → 1 足がそろう（左足を上げる） → 2 左足が前 → 3 足がそろう（右足を上げる）
# 色は元の絵から取る（脚の色・靴の色・ふちの色）。足先は進む向き（右）を向く。
import json
import os
import sys
from collections import Counter
import numpy as np
from PIL import Image, ImageDraw

HERE = os.path.dirname(os.path.abspath(__file__))
IMG = os.path.join(HERE, '..', 'assets', 'img')
trace = open(os.path.join(HERE, '..', 'assets', 'trace.js'), encoding='utf8').read()
TRACE = json.loads(trace[trace.index('{'):trace.rindex('}') + 1])
SKIP = {'keeper', 'centaur'}  # 店主は歩かない。ケンタウロスは脚が4本なので元の絵のまま
# 人ごとの手直し（自動の見積もりを上書き）: top=描き直す一番上の行, x0〜x1=脚の横の範囲（かご・袋を外す）
TUNE = {}


def runs(row):
    out, x, n = [], 0, len(row)
    while x < n:
        if row[x]:
            s = x
            while x < n and row[x]:
                x += 1
            out.append((s, x - 1))
        else:
            x += 1
    return out


def drop_specks(a):
    """3ドット未満の小さな塊（影の名残）を消す。"""
    h, w = a.shape[:2]
    seen = np.zeros((h, w), bool)
    for y in range(h):
        for x in range(w):
            if a[y, x, 3] and not seen[y, x]:
                stack, comp = [(y, x)], []
                seen[y, x] = True
                while stack:
                    cy, cx = stack.pop()
                    comp.append((cy, cx))
                    for ny, nx in ((cy + 1, cx), (cy - 1, cx), (cy, cx + 1), (cy, cx - 1)):
                        if 0 <= ny < h and 0 <= nx < w and a[ny, nx, 3] and not seen[ny, nx]:
                            seen[ny, nx] = True
                            stack.append((ny, nx))
                if len(comp) < 3:
                    for cy, cx in comp:
                        a[cy, cx] = 0
    return a


def analyse(a):
    """脚の範囲と色を調べる。"""
    alpha = a[:, :, 3] > 0
    h, w = alpha.shape
    bottom = max(y for y in range(h) if alpha[y].any())
    ref = None
    for y in range(bottom, max(0, bottom - 8), -1):
        big = [r for r in runs(alpha[y]) if r[1] - r[0] >= 2]
        if len(big) >= 2:
            L, R = sorted(sorted(big, key=lambda r: r[1] - r[0], reverse=True)[:2])
            ref = (y, L, R)
            break
    if not ref:
        return None
    yr, L, R = ref
    x0, x1 = max(0, L[0]), min(w - 1, R[1] + 1)
    # 2本の脚のあいだにすき間がある行を、上へたどる（すねが見えている範囲）
    top = yr
    cl, cr = (L[0] + L[1]) / 2, (R[0] + R[1]) / 2
    limit = bottom - int(h * 0.19)  # すねまで（ひざから上は元の絵のまま）
    for y in range(yr - 1, limit - 1, -1):
        rr = [r for r in runs(alpha[y]) if r[1] >= x0 and r[0] <= x1]
        two = [r for r in rr if r[1] - r[0] >= 1]
        if len(two) < 2:
            break
        lft = [r for r in two if (r[0] + r[1]) / 2 < (cl + cr) / 2]
        rgt = [r for r in two if (r[0] + r[1]) / 2 >= (cl + cr) / 2]
        if not lft or not rgt:
            break
        cl, cr = (lft[-1][0] + lft[-1][1]) / 2, (rgt[0][0] + rgt[0][1]) / 2
        top = y
    top = min(top, bottom - 4)  # 少なくとも足首から下は描き直す
    return {'bottom': bottom, 'top': top, 'x0': x0, 'x1': x1, 'L': L, 'R': R, 'yr': yr}


def mode_color(pixels, avoid_dark=False):
    cs = [tuple(int(v) for v in p[:3]) for p in pixels if p[3]]
    if avoid_dark and cs:  # いちばん暗いふちの色は除く（黒い服でも服の色を取る）
        dmin = min(sum(c) for c in cs)
        cs = [c for c in cs if sum(c) > dmin + 40] or cs
    return Counter(cs).most_common(1)[0][0] if cs else (60, 50, 40)


def colors(a, info):
    top, bottom, x0, x1 = info['top'], info['bottom'], info['x0'], info['x1']
    mid = (info['L'][1] + info['R'][0]) / 2
    def region(y0, y1, side):
        out = []
        for y in range(y0, y1 + 1):
            for x in range(x0, x1 + 1):
                if (x < mid) == (side == 'L'):
                    out.append(a[y, x])
        return out
    shin_end = max(top, bottom - 3)
    legL = mode_color(region(top, shin_end, 'L'), True)
    legR = mode_color(region(top, shin_end, 'R'), True)
    shoe = mode_color(region(bottom - 1, bottom, 'L') + region(bottom - 1, bottom, 'R'))
    allp = [tuple(int(v) for v in p[:3]) for p in region(top, bottom, 'L') + region(top, bottom, 'R') if p[3]]
    outline = min(allp, key=sum) if allp else (30, 24, 20)
    return legL, legR, shoe, outline


def draw_frames(a, info):
    h, w = a.shape[:2]
    top, bottom = info['top'], info['bottom']
    L, R = info['L'], info['R']
    legL, legR, shoe, outline = colors(a, info)
    # 元の脚（top から下、x0〜x1 のうち脚の塊）を消す
    base = a.copy()
    alpha = a[:, :, 3] > 0
    for y in range(top, h):
        for (r0, r1) in runs(alpha[y]):
            if r1 >= info['x0'] and r0 <= info['x1']:
                base[y, max(r0, info['x0']):min(r1, info['x1']) + 1] = 0
        base[y, info['x1'] + 1:] = 0  # 前の足より前にあるもの（影の名残）
    # 脚の付け根（top の行のすぐ上の、左右の脚の中心）
    rr = [r for r in runs(alpha[top]) if r[1] >= info['x0'] and r[0] <= info['x1']]
    hipL = (rr[0][0] + rr[0][1]) / 2 if rr else (L[0] + L[1]) / 2
    hipR = (rr[-1][0] + rr[-1][1]) / 2 if rr else (R[0] + R[1]) / 2
    mid = (hipL + hipR) / 2
    q = min(1.5, (hipR - hipL) / 4)
    hipL, hipR = mid - q, mid + q  # 横から見た脚は、ほぼ同じ腰から前後に開く
    stride = max(3, ((R[0] + R[1]) - (L[0] + L[1])) / 2 * 0.85)
    lw = max(2, min(5, int(round(((L[1] - L[0]) + (R[1] - R[0])) / 2 * 0.9))))
    # 4コマの足の位置（x: 足の中心, lift: 上げる高さ）
    poses = [
        {'L': (mid - stride / 2, 0), 'R': (mid + stride / 2, 0)},  # 右足が前
        {'L': (mid - 0.5, 2), 'R': (mid + 0.5, 0)},  # 足がそろう（左足を上げる）
        {'L': (mid + stride / 2, 0), 'R': (mid - stride / 2, 0)},  # 左足が前
        {'L': (mid - 0.5, 0), 'R': (mid + 0.5, 2)},  # 足がそろう（右足を上げる）
    ]
    frames = []
    for ps in poses:
        im = Image.fromarray(base.copy())
        d = ImageDraw.Draw(im)
        # 後ろにある脚（前に出ていないほう）から描く
        order = sorted(['L', 'R'], key=lambda k: ps[k][0])
        for k in order:
            fx, lift = ps[k]
            hx = hipL if k == 'L' else hipR
            col = legL if k == 'L' else legR
            fy = bottom - lift  # 足の裏の行
            ky = fy - 2  # 足首
            # すね: 付け根から足首まで、幅 lw の帯（両側にふち）
            n = max(1, ky - top)
            for i in range(n + 1):
                y = top + i
                cx = hx + (fx - hx) * (i / n)
                xa = int(round(cx - lw / 2))
                for x in range(xa - 1, xa + lw + 1):
                    if 0 <= x < w:
                        im.putpixel((x, y), (*outline, 255) if x in (xa - 1, xa + lw) else (*col, 255))
            # 靴（右向き）: 幅 lw+2、高さ2（下の行はふち）
            sx = int(round(fx - lw / 2))
            for y in (fy - 1, fy):
                for x in range(sx - 1, sx + lw + 2):
                    if 0 <= x < w and 0 <= y < h:
                        edge = y == fy or x == sx - 1 or x == sx + lw + 1
                        im.putpixel((x, y), (*outline, 255) if edge else (*shoe, 255))
        frames.append(im)
    return frames


def main():
    boxes_out = sys.argv[sys.argv.index('--boxes') + 1] if '--boxes' in sys.argv else None
    meta, sheet = {}, []
    for name, poses in TRACE['poses'].items():
        if name in SKIP:
            continue
        a = drop_specks(np.array(Image.open(os.path.join(IMG, f'pose_{name}_0.png')).convert('RGBA')))
        info = analyse(a)
        if not info:
            print('脚が見つからない:', name)
            continue
        info.update(TUNE.get(name, {}))
        frames = draw_frames(a, info)
        for i, f in enumerate(frames):
            f.save(os.path.join(IMG, f'walk_{name}_{i}.png'))
        p0 = poses[0]
        meta[name] = [{'img': f'walk_{name}_{i}', 'w': p0['w'], 'h': p0['h'], 'ax': p0['ax']} for i in range(4)]
        sheet.append((name, Image.fromarray(a), info, frames))
    with open(os.path.join(HERE, '..', 'assets', 'walk.js'), 'w', encoding='utf8') as f:
        f.write('// tools/walk_frames.py が作る（手で書きかえない）。歩くコマ: 0 右足が前 1 そろう 2 左足が前 3 そろう\n')
        f.write(f'export const WALK = {json.dumps(meta, ensure_ascii=False)};\n')
    if boxes_out:
        cw = max(s[1].width for s in sheet) + 6
        ch = max(s[1].height for s in sheet) + 6
        per = 3
        cols = (len(sheet) + per - 1) // per
        out = Image.new('RGBA', (cw * 5 * per, ch * cols), (205, 196, 168, 255))
        for k, (name, src, info, frames) in enumerate(sheet):
            ox, oy = (k % per) * cw * 5, (k // per) * ch
            box = src.copy()
            d = ImageDraw.Draw(box)
            d.rectangle([info['x0'], info['top'], info['x1'], info['bottom']], outline=(255, 0, 0, 255))
            out.paste(box, (ox, oy + ch - src.height - 3), box)
            for i, fr in enumerate(frames):
                out.paste(fr, (ox + cw * (i + 1), oy + ch - src.height - 3 - (1 if i % 2 else 0)), fr)
        out.resize((out.width * 3, out.height * 3), Image.NEAREST).save(boxes_out)
    print(len(meta), '人')


main()
