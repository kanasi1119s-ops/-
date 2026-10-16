"""切り抜いた人物のふちに残った、白・白に近い色のドットを取る（参考画像の白い背景がにじんだもの）。

白に近い（RGB の最小が LIGHT 以上）ドットで、ある向きの片側が透明、その反対側がすぐ暗い線
（明るさが DARK 以上低い）のもの = 輪郭線の外にはみ出した背景のにじみ、を透明にする。
白い靴下・白いすそのように、外側が透明でも反対側が白いまま続く所は残す。
足元（下から FEET の割合）は、靴下・足首を消さないようにさわらない。
"""
import numpy as np

LIGHT = 175
DARK = 55
FEET = 0.1


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
