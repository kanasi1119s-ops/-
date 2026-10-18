# 人物の絵の手直しの設計図を作る（tools/sprite_audit.py で見つけたものを直す）。
#   python3 tools/sprite_fix.py [名前の頭 ...] → assets/editor/fix/fix.design.json（{ 絵の名前: [{x, y, color}...] }）
#   そのあと EDITOR_OUT=assets/editor/fix node tools/editor_touch.mjs assets/editor/fix/fix.design.json で、エディタで1ドットずつ直す
# 直すこと（順に）:
#   1. 体のふちの明るいドット（白い服などが、ふちどりなしで外の透明に接している所。白いにじみに見える）→ 近くのふちどりの色に
#   2. 体から離れたふちどりの切れはし（暗いドットだけの小さなかたまり。体との間に透明のすき間がある）→ 消す（1. で体にふちができるので）
#   3. 体の中の小さな穴（6ドット以下）→ まわりのドットでいちばん多い色で埋める
#   4. はぐれたドット（体から離れた3ドット以下のかたまり）→ 消す
#   5. 歩くコマの、足の裏と地面の影の間のすき間（6ドット以下。地面がのぞく）→ となりのいちばん暗い色で埋める
import json, os, sys
from collections import Counter, deque
from PIL import Image

ROOT = os.path.join(os.path.dirname(__file__), '..')
IMG = os.path.join(ROOT, 'assets/img')
lum = lambda c: 0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2]
hexc = lambda c: '#%02x%02x%02x' % tuple(c[:3])
N4 = ((1, 0), (-1, 0), (0, 1), (0, -1))
N8 = [(dx, dy) for dx in (-1, 0, 1) for dy in (-1, 0, 1) if dx or dy]

def comps(cells, nb):
    seen, out = set(), []
    for p in cells:
        if p in seen: continue
        comp = []; dq = deque([p]); seen.add(p)
        while dq:
            q = dq.popleft(); comp.append(q)
            for dx, dy in nb:
                r = (q[0] + dx, q[1] + dy)
                if r in cells and r not in seen: seen.add(r); dq.append(r)
        out.append(comp)
    return out

def fix(name):
    im = Image.open(os.path.join(IMG, name + '.png')).convert('RGBA'); W, H = im.size; px = im.load()
    cur = {(x, y): px[x, y] for y in range(H) for x in range(W) if px[x, y][3] == 255}
    soft = {(x, y) for y in range(H) for x in range(W) if 0 < px[x, y][3] < 255}  # 歩くコマの地面の影（半透明）はそのまま
    touch = {}
    def outside():
        out = set(); dq = deque()
        for y in range(H):
            for x in range(W):
                if (x in (0, W - 1) or y in (0, H - 1)) and (x, y) not in cur: out.add((x, y)); dq.append((x, y))
        while dq:
            x, y = dq.popleft()
            for dx, dy in N4:
                q = (x + dx, y + dy)
                if 0 <= q[0] < W and 0 <= q[1] < H and q not in out and q not in cur: out.add(q); dq.append(q)
        return out
    out = outside()
    edge = lambda p: any((p[0] + dx, p[1] + dy) in out or not (0 <= p[0] + dx < W and 0 <= p[1] + dy < H) for dx, dy in N4)
    # その絵のふちどりの色（ふちの暗いドットでいちばん多い色）
    rim = Counter(cur[p][:3] for p in cur if edge(p) and lum(cur[p]) < 80)
    K = rim.most_common(1)[0][0] if rim else (24, 20, 22)
    # 1. ふちの明るいドット → ふちどりの色。色は近く（3ドット以内）のふちの暗いドットから選ぶ
    #    （服なら服のふち、透明な袋なら袋の灰色のふち。近くになければ、その絵のふちどりの色）
    light = [p for p in cur if edge(p) and lum(cur[p]) > 175]
    for p in light:
        near = Counter(cur[q][:3] for dx in range(-3, 4) for dy in range(-3, 4) for q in [(p[0] + dx, p[1] + dy)]
                       if q in cur and q not in light and edge(q) and lum(cur[q]) < 120)
        col = near.most_common(1)[0][0] if near else K
        touch[p] = hexc(col)
    for p in light: cur[p] = tuple(int(touch[p][i:i + 2], 16) for i in (1, 3, 5)) + (255,)
    # 2. ふちどりの切れはし（いちばん大きい体とは別の、暗いドットだけの小さなかたまり）→ 消す
    parts = sorted(comps(set(cur), N8), key=len, reverse=True)
    for c in parts[1:]:
        if len(c) <= 20 and all(lum(cur[p]) < 90 for p in c):
            near = any((p[0] + dx, p[1] + dy) in set(parts[0]) for p in c for dx in range(-3, 4) for dy in range(-3, 4))
            if near:
                for p in c: cur.pop(p); touch[p] = None
    # 3. 小さな穴 → まわりでいちばん多い色
    out = outside()
    holes = [c for c in comps({(x, y) for y in range(H) for x in range(W) if (x, y) not in cur and (x, y) not in out and (x, y) not in soft}, N4) if len(c) <= 6]
    for c in holes:
        ring = Counter(cur[(p[0] + dx, p[1] + dy)][:3] for p in c for dx, dy in N8 if (p[0] + dx, p[1] + dy) in cur)
        if ring:
            col = ring.most_common(1)[0][0]
            for p in c: cur[p] = col + (255,); touch[p] = hexc(col)
    # 4. はぐれたドット（3ドット以下）→ 消す
    parts = sorted(comps(set(cur), N8), key=len, reverse=True)
    for c in parts[1:]:
        if len(c) <= 3:
            for p in c: cur.pop(p); touch[p] = None
    # 5. 足の裏と地面の影の間のすき間（体のドットと影の半透明のドットに囲まれた、6ドット以下の透明）→ となりのいちばん暗い色
    out2 = set(); dq = deque()
    for y in range(H):
        for x in range(W):
            if (x in (0, W - 1) or y in (0, H - 1)) and (x, y) not in cur and (x, y) not in soft: out2.add((x, y)); dq.append((x, y))
    while dq:
        x, y = dq.popleft()
        for dx, dy in N4:
            q = (x + dx, y + dy)
            if 0 <= q[0] < W and 0 <= q[1] < H and q not in out2 and q not in cur and q not in soft: out2.add(q); dq.append(q)
    gaps = [c for c in comps({(x, y) for y in range(H) for x in range(W) if (x, y) not in cur and (x, y) not in soft and (x, y) not in out2}, N4) if len(c) <= 6]
    for c in gaps:
        nb = [cur[(p[0] + dx, p[1] + dy)][:3] for p in c for dx, dy in N4 if (p[0] + dx, p[1] + dy) in cur]
        if nb:
            col = min(nb, key=lum)
            for p in c: cur[p] = col + (255,); touch[p] = hexc(col)
    # 元と同じになったドットは書かない
    res = []
    for (x, y), c in sorted(touch.items(), key=lambda t: (t[0][1], t[0][0])):
        o = px[x, y]
        if c is None and o[3] == 0: continue
        if c is not None and o[3] == 255 and hexc(o) == c: continue
        res.append({'x': x, 'y': y, 'color': c})
    return res

if __name__ == '__main__':
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    names = sorted(f[:-4] for f in os.listdir(IMG) if f.endswith('.png') and any(f.startswith(a) for a in (args or ['pose_', 'walk_', 'surprise_', 'angry_', 'staff_', 'baron_', 'tama_', 'char_kid'])))
    d = {}
    for n in names:
        t = fix(n)
        if t: d[n] = t
    os.makedirs(os.path.join(ROOT, 'assets/editor/fix'), exist_ok=True)
    json.dump(d, open(os.path.join(ROOT, 'assets/editor/fix/fix.design.json'), 'w'), ensure_ascii=False)
    print(f'{len(d)}枚を直す（{sum(len(v) for v in d.values())}ドット）')
