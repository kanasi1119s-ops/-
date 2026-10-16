"""切り抜いた人物のふちに残った、白・白に近い色のドットを取る（参考画像の白い背景がにじんだもの）。

白に近い（RGB の最小が LIGHT 以上）ドットで、ある向きの片側が透明、その反対側がすぐ暗い線
（明るさが DARK 以上低い）のもの = 輪郭線の外にはみ出した背景のにじみ、を透明にする。
白い靴下・白いすそのように、外側が透明でも反対側が白いまま続く所は残す。
足元（下から FEET の割合）は、靴下・足首を消さないようにさわらない。
頭（あごより上。髪・頭巾・帽子）もさわらない: 白い髪のハイライトや頭巾のふちは輪郭線の外に出ているのが本来の絵なので、にじみと見分けがつかない。
"""
import numpy as np

LIGHT = 175
DARK = 55
FEET = 0.1


def chin_row(rgba):
    """あごの行（上から35%の中で、肌色が3ドット以上ある最後の行）。肌色がない絵（宇宙人など）は高さの25%"""
    a = rgba[..., :3].astype(np.float32) / 255
    mx, mn = a.max(-1), a.min(-1)
    r, g = a[..., 0], a[..., 1]
    sat = np.where(mx > 0, (mx - mn) / np.maximum(mx, 1e-6), 0)
    hue = np.where(mx == r, (g - a[..., 2]) / np.maximum(mx - mn, 1e-6) * 60, 999)  # 赤が最大のときだけ（肌色は 12〜40°）
    skin = (rgba[..., 3] > 0) & (hue > 12) & (hue < 40) & (sat > 0.25) & (mx > 0.55)
    H = rgba.shape[0]
    rows = [y for y in range(int(H * 0.35)) if skin[y].sum() >= 3]
    return max(rows) if rows else int(H * 0.25)


def defringe(rgba, passes=2):
    a = np.array(rgba, copy=True)
    H, W = a.shape[:2]
    lum = a[..., :3].astype(int) @ np.array([299, 587, 114]) // 1000
    removed = np.zeros((H, W), bool)
    for _ in range(passes):
        al = a[..., 3] > 0
        pad = np.pad(al, 1)
        edge = al & ~(pad[:-2, 1:-1] & pad[2:, 1:-1] & pad[1:-1, :-2] & pad[1:-1, 2:])
        light = a[..., :3].min(-1) >= LIGHT
        cand = edge & light
        ys = np.nonzero(al.any(1))[0]
        if len(ys):
            cand[int(ys.max() - (ys.max() - ys.min() + 1) * FEET) + 1:] = False
        cand[:chin_row(a) + 1] = False  # 頭はさわらない
        out = np.zeros_like(cand)
        for y, x in zip(*np.nonzero(cand)):
            for dy, dx in ((-1, 0), (1, 0), (0, -1), (0, 1), (-1, -1), (-1, 1), (1, -1), (1, 1)):
                oy, ox, iy, ix = y + dy, x + dx, y - dy, x - dx  # 外（透明）と、その反対の内側
                outside = not (0 <= oy < H and 0 <= ox < W) or not al[oy, ox]
                if outside and 0 <= iy < H and 0 <= ix < W and al[iy, ix] and lum[y, x] - lum[iy, ix] >= DARK:
                    out[y, x] = True
                    break
        if not out.any():
            break
        a[out, 3] = 0
        removed |= out
    return a, removed
