# 持ち物（かご・袋など）を、元の絵から形どおりに切り分ける。
# walk_prep.SPEC の keep（だいたいの四角）を手がかりに、色とつながりで「持ち物」と「脚・体」に分ける:
#   ・色ごとに、四角の内側と、持ち物の高さから下の四角から離れた所（脚・すそ）での出やすさ（面積あたり）をくらべ、
#     四角の内側に2倍以上よく出る色を「持ち物の色」、その逆を「脚の色」とする
#   ・四角の内側（2ドット内）の、脚の色でない画素から始めて、となりの「持ち物の色」の画素へ広げる（四角のまわり pad ドットまで）
#   ・四角の中で決まらなかった画素は、まわりの決まった画素の多いほうへ
import numpy as np
from collections import deque


def segment_items(rgba, keep, cut, pad=8):
    """持ち物の画素の印（H×W の bool）を返す。keep は [上, 左, 下, 右] の四角のリスト。"""
    a = rgba
    H, W = a.shape[:2]
    al = a[:, :, 3] > 0
    col = (a[:, :, 0].astype(np.int64) << 16) | (a[:, :, 1].astype(np.int64) << 8) | a[:, :, 2]
    out = np.zeros((H, W), bool)
    for (y0, x0, y1, x1) in keep:
        inner = np.zeros((H, W), bool); inner[y0 + 2:y1 - 1, x0 + 2:x1 - 1] = True
        rect = np.zeros((H, W), bool); rect[y0:y1 + 1, x0:x1 + 1] = True
        roi = np.zeros((H, W), bool); roi[max(0, y0 - 3):y1 + pad + 1, max(0, x0 - pad):x1 + pad + 1] = True  # 上へは広げない（持ち手まで）
        legzone = al & ~roi
        legzone[:max(0, y0 - 2)] = False  # 持ち物の高さから下だけ（上の腕・手の色は持ち物と同じことがある）
        ci, ni = np.unique(col[al & inner], return_counts=True)
        cl, nl = np.unique(col[legzone], return_counts=True)
        pi = {int(c): n / max(1, (al & inner).sum()) for c, n in zip(ci, ni)}
        pl = {int(c): n / max(1, legzone.sum()) for c, n in zip(cl, nl)}
        item_cols = {c for c in pi if pi[c] > 2 * pl.get(c, 0)}
        leg_cols = {c for c in pl if pl[c] > 2 * pi.get(c, 0)}
        lab = np.zeros((H, W), np.int8)  # 1 持ち物 2 ほか
        lab[al & ~roi] = 2
        q = deque()
        for y, x in np.argwhere(al & inner):
            if int(col[y, x]) not in leg_cols:
                lab[y, x] = 1; q.append((y, x))
        while q:
            y, x = q.popleft()
            for dy in (-1, 0, 1):
                for dx in (-1, 0, 1):
                    yy, xx = y + dy, x + dx
                    if 0 <= yy < H and 0 <= xx < W and roi[yy, xx] and al[yy, xx] and lab[yy, xx] == 0 \
                            and int(col[yy, xx]) in item_cols:
                        lab[yy, xx] = 1; q.append((yy, xx))
        # 四角の外で広がらなかった画素は、ほか
        lab[al & roi & ~rect & (lab == 0)] = 2
        for _ in range(40):
            und = np.argwhere(al & rect & (lab == 0))
            if not len(und):
                break
            new = lab.copy()
            for y, x in und:
                n1 = n2 = 0
                for dy in (-1, 0, 1):
                    for dx in (-1, 0, 1):
                        yy, xx = y + dy, x + dx
                        if 0 <= yy < H and 0 <= xx < W:
                            n1 += lab[yy, xx] == 1; n2 += lab[yy, xx] == 2
                if n1 or n2:
                    new[y, x] = 1 if n1 + 1 > n2 else 2
            lab = new
        lab[al & rect & (lab == 0)] = 1
        out |= lab == 1
    return out
