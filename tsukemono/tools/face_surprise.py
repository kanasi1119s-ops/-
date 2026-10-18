# 驚いた顔の設計図を作る（ドット絵エディタで描く前の下準備）。
#   python3 tools/face_surprise.py → assets/editor/faces/surprise.design.json
#   そのあと node tools/editor_touch.mjs assets/editor/faces/surprise.design.json で、エディタのえんぴつで描いて書き出す（assets/img/surprise_<名前>.png）
# 人ごとの位置は tools/face_points.json（拡大した絵と見比べて決めた）。描くもの:
#   目: 見開いた白目に小さな黒目（上のまぶたを1行上げる）／眼鏡の人はレンズの中に白目と黒目
#   口: 「お」の形に丸く開ける／冷や汗: 顔の横に水色のしずく
import json, os
from PIL import Image
ROOT = os.path.join(os.path.dirname(__file__), '..')
WHITE, MOUTH, SWEAT, SWEAT_HI = (255, 255, 255), (122, 30, 34), (58, 120, 201), (207, 233, 255)

def dark_of(im, box):
    """その人の輪郭の色（顔のあたりでいちばん多い暗い色）"""
    from collections import Counter
    x0, y0, x1, y1 = box; px = im.load(); cnt = Counter()
    for y in range(max(0, y0), min(im.height, y1)):
        for x in range(max(0, x0), min(im.width, x1)):
            c = px[x, y]
            if c[3] and 0.3 * c[0] + 0.59 * c[1] + 0.11 * c[2] < 55: cnt[c[:3]] += 1
    return cnt.most_common(1)[0][0] if cnt else (34, 22, 20)

def design(name, p):
    src = f"pose_{name}_{p['pose']}"
    im = Image.open(os.path.join(ROOT, 'assets/img', f'{src}.png')).convert('RGBA'); px = im.load()
    skin = px[p['skin'][0], p['skin'][1]][:3]
    pts = [b for b in p.get('clear', [])] + [[e[0], e[2], e[1], e[2] + 3] for e in p.get('eyes', [])] + [[l[0], l[2], l[1], l[3]] for l in p.get('lens', [])]
    xs = [b[0] for b in pts] + [b[2] for b in pts]; ys = [b[1] for b in pts] + [b[3] for b in pts]
    K = dark_of(im, (min(xs) - 4, min(ys) - 4, max(xs) + 5, max(ys) + 5))
    out = {}
    def put(x, y, c):
        if 0 <= x < im.width and 0 <= y < im.height: out[(x, y)] = c
    for x0, y0, x1, y1 in p.get('clear', []):  # 元の目と口を肌で消す（透明な所は塗らない）
        for y in range(y0, y1 + 1):
            for x in range(x0, x1 + 1):
                if px[x, y][3]: put(x, y, skin)
    for x0, x1, y0 in p.get('eyes', []):  # 見開いた目
        pc = x0 + (x1 - x0 + 1) // 2
        for x in range(x0 + 1, x1): put(x, y0, K); put(x, y0 + 3, K)
        for y in (y0 + 1, y0 + 2):
            put(x0, y, K); put(x1, y, K)
            for x in range(x0 + 1, x1): put(x, y, WHITE)
        put(pc, y0 + 2, K)
    for x0, x1, y0, y1, ppx, ppy in p.get('lens', []):  # 眼鏡のレンズの中
        for y in range(y0, y1 + 1):
            for x in range(x0, x1 + 1): put(x, y, WHITE)
        put(ppx, ppy, K)
    cx, my, w = p['mouth']  # 「お」の口
    l, r = cx - (w // 2) - (1 if w % 2 == 0 else 1), cx + (w - 1) // 2 + (0 if w % 2 == 0 else 1)
    inner = range(l + 1, r)
    for x in inner: put(x, my, K); put(x, my + 3, K)
    for y in (my + 1, my + 2):
        put(l, y, K); put(r, y, K)
        for x in inner: put(x, y, MOUTH)
    sx, sy = p['sweat']  # 冷や汗
    put(sx + 1, sy, SWEAT)
    for y in (sy + 1, sy + 2): put(sx, y, SWEAT); put(sx + 1, y, SWEAT_HI); put(sx + 2, y, SWEAT)
    put(sx + 1, sy + 3, SWEAT)
    hexc = lambda c: '#%02x%02x%02x' % c
    touch = [{'x': x, 'y': y, 'color': hexc(c)} for (x, y), c in sorted(out.items(), key=lambda t: (t[0][1], t[0][0])) if px[x, y][3] == 0 or px[x, y][:3] != c]
    return src, touch

if __name__ == '__main__':
    pts = json.load(open(os.path.join(ROOT, 'tools/face_points.json')))
    d = {}
    for name, p in pts.items():
        if name.startswith('_'): continue
        src, touch = design(name, p)
        d[f'surprise_{name}'] = {'from': src, 'touch': touch}
        print(name, src, len(touch))
    os.makedirs(os.path.join(ROOT, 'assets/editor/faces'), exist_ok=True)
    json.dump(d, open(os.path.join(ROOT, 'assets/editor/faces/surprise.design.json'), 'w'), ensure_ascii=False)
