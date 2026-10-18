# 人物の絵の点検（ドットの欠け・体のまわりに残った白っぽいドット・はぐれたドット）。
#   python3 tools/sprite_audit.py [名前の頭 ...]   例: python3 tools/sprite_audit.py pose_keeper walk_ surprise_keeper
# 調べること:
#   hole  : 体の中の小さな穴（外とつながらない透明のドット。6ドット以下）→ ドットの欠け
#   light : 体のふち（外の透明に面したドット）なのに明るい色（白に近い）→ 切り抜きの残り。この絵のふちは暗い線なので
#   stray : 体から離れた小さなかたまり（3ドット以下）→ はぐれたドット
#   halo  : 体のふちの外側に、ほとんど透明でない白っぽいドット（半透明のにじみ）
# 結果は名前ごとに数を出し、--show で、見つけた所に印をつけた拡大図を書き出す（scratchpad など、--out の場所へ）
import os, sys
from collections import deque
from PIL import Image, ImageDraw

ROOT = os.path.join(os.path.dirname(__file__), '..')
IMG = os.path.join(ROOT, 'assets/img')
lum = lambda c: 0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2]
N4 = ((1, 0), (-1, 0), (0, 1), (0, -1))

def audit(path):
    im = Image.open(path).convert('RGBA'); W, H = im.size; px = im.load()
    op = lambda x, y: 0 <= x < W and 0 <= y < H and px[x, y][3] > 0
    # 外とつながる透明（ふちの外）
    out = set(); dq = deque()
    for x in range(W):
        for y in (0, H - 1):
            if not op(x, y): out.add((x, y)); dq.append((x, y))
    for y in range(H):
        for x in (0, W - 1):
            if not op(x, y) and (x, y) not in out: out.add((x, y)); dq.append((x, y))
    while dq:
        x, y = dq.popleft()
        for dx, dy in N4:
            q = (x + dx, y + dy)
            if 0 <= q[0] < W and 0 <= q[1] < H and q not in out and not op(*q): out.add(q); dq.append(q)
    # 穴（外とつながらない透明のかたまり）
    holes, seen = [], set()
    for y in range(H):
        for x in range(W):
            if op(x, y) or (x, y) in out or (x, y) in seen: continue
            comp = []; dq = deque([(x, y)]); seen.add((x, y))
            while dq:
                p = dq.popleft(); comp.append(p)
                for dx, dy in N4:
                    q = (p[0] + dx, p[1] + dy)
                    if 0 <= q[0] < W and 0 <= q[1] < H and q not in seen and not op(*q) and q not in out: seen.add(q); dq.append(q)
            if len(comp) <= 6: holes += comp
    # ふちの明るいドット
    light = [(x, y) for y in range(H) for x in range(W) if op(x, y) and any((x + dx, y + dy) in out or not (0 <= x + dx < W and 0 <= y + dy < H) for dx, dy in N4)
             and px[x, y][3] == 255 and lum(px[x, y]) > 175]
    halo = [(x, y) for y in range(H) for x in range(W) if 0 < px[x, y][3] < 255 and lum(px[x, y]) > 150]  # 歩くコマの地面の影（暗い半透明）は数えない
    # はぐれたかたまり
    comps, seen = [], set()
    for y in range(H):
        for x in range(W):
            if not op(x, y) or (x, y) in seen: continue
            comp = []; dq = deque([(x, y)]); seen.add((x, y))
            while dq:
                p = dq.popleft(); comp.append(p)
                for dx in (-1, 0, 1):
                    for dy in (-1, 0, 1):
                        q = (p[0] + dx, p[1] + dy)
                        if q not in seen and op(*q): seen.add(q); dq.append(q)
            comps.append(comp)
    comps.sort(key=len, reverse=True)
    stray = [p for c in comps[1:] if len(c) <= 3 for p in c]
    return im, {'hole': holes, 'light': light, 'stray': stray, 'halo': halo}

def show(im, found, out, Z=6):
    W, H = im.size
    big = Image.new('RGBA', (W * Z, H * Z), (118, 160, 118, 255)); big.alpha_composite(im.resize((W * Z, H * Z), Image.NEAREST))
    d = ImageDraw.Draw(big)
    col = {'hole': (255, 0, 255, 255), 'light': (255, 40, 40, 255), 'stray': (0, 120, 255, 255), 'halo': (255, 200, 0, 255)}
    for k, pts in found.items():
        for x, y in pts: d.rectangle([x * Z, y * Z, x * Z + Z - 1, y * Z + Z - 1], outline=col[k], width=2)
    big.save(out)

if __name__ == '__main__':
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    outdir = next((a.split('=', 1)[1] for a in sys.argv[1:] if a.startswith('--out=')), None)
    names = sorted(f[:-4] for f in os.listdir(IMG) if f.endswith('.png') and (not args or any(f.startswith(a) for a in args)))
    total = {'hole': 0, 'light': 0, 'stray': 0, 'halo': 0}
    for n in names:
        im, f = audit(os.path.join(IMG, n + '.png'))
        c = {k: len(v) for k, v in f.items()}
        for k in total: total[k] += c[k]
        if any(c.values()):
            print(n, c)
            if outdir and '--show' in sys.argv: show(im, f, os.path.join(outdir, f'audit_{n}.png'))
    print('合計', total, f'（{len(names)}枚）')
