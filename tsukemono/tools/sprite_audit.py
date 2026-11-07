# 人物の絵（ドットキャラ）の点検: コマの間の色のずれ・輪郭・大きさと足もとと中心・半透明やゴミ・動き。
#   node tools/sprite_manifest.mjs > m.json
#   python3 tools/sprite_audit.py m.json 出力先        → 出力先/report.md・summary.json・sheet_<キャラ>.png（4倍）・overview.png（2倍）
# 絵は書きかえない（読むだけ）。直す前と直した後で同じ点検をかけて、件数を比べる。
#
# 基準のコマ: キャラごとに「待つ（idle）」の1コマ目。色・輪郭・大きさ・中心は、このコマとの差で見る。
# 足もと: コマの下から below 行上が足の裏（ゲームはここを地面にそろえて描く）。中心: ax（ゲームはここを立ち位置にそろえる）。
import json, os, sys
from collections import Counter
import numpy as np
import cv2
from PIL import Image, ImageDraw

ROOT = os.path.join(os.path.dirname(__file__), '..')
IMG = os.path.join(ROOT, 'assets/img')

# 基準との差を「問題」とみなす境目
T = dict(
    foreign_frac=0.02,   # 基準のコマにない色（ΔE>6）の画素が、このコマの画素のこの割合より多い
    foreign_de=6.0,
    torso_de=20.0,       # 胴の主な色が基準とこれ以上ちがう（服の色が別物）
    hair_de=20.0,        # 頭の上（髪・帽子）の主な色が基準とこれ以上ちがう
    skin_de=15.0,        # 顔の肌の色が基準とこれ以上ちがう
    outline_de=10.0,     # 輪郭の色が基準とこれ以上ちがう
    height_px=3,         # 頭のてっぺんから足の裏までの高さが基準とこれ以上ちがう
    head_dx=4,           # 頭の中心（立ち位置からの横のずれ）が基準とこれ以上ちがう
    gap_px=5,            # ふちにあるのに暗くない（輪郭が途切れた）画素がこれ以上
    swap_frac=0.35,      # となりのコマとの差（変わった画素）がこれより多い = 絵が丸ごと入れかわる
    head_jump=3,         # となりのコマで頭がこれ以上とぶ（縦か横）
    walk_swap_frac=0.45, # 歩くコマは脚が動くので、となりとの差がこれより多いとき

)

SHADOW = np.array([31, 22, 16, 82])  # エディタで描いた足もとの影（わざと半透明）

def load(name):
    return np.asarray(Image.open(os.path.join(IMG, name + '.png')).convert('RGBA'))

def lab(rgb):
    a = np.asarray(rgb, np.float32).reshape(-1, 1, 3) / 255.0
    return cv2.cvtColor(a, cv2.COLOR_RGB2LAB).reshape(-1, 3)

def de(c1, c2):
    return float(np.linalg.norm(lab([c1])[0] - lab([c2])[0]))

def skinlike(c):
    """肌の色らしい（だいだい寄りの、明るく中くらいの彩度）"""
    hsv = cv2.cvtColor(np.uint8([[c[:3]]]), cv2.COLOR_RGB2HSV)[0, 0]
    return 4 <= hsv[0] <= 22 and 50 <= hsv[1] <= 170 and hsv[2] >= 150

def lum(c): return (0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2]) / 255.0

def frame_stats(a, f):
    """1コマの数え上げ。f は manifest のコマの情報（w,h,ax,below）"""
    h, w = a.shape[:2]
    al = a[..., 3]
    below = f.get('below', 0) or 0
    body_rows = np.arange(h) < h - below          # 影の行（足の裏より下）を除いた所
    solid = al == 255
    semi = (al > 0) & (al < 255)
    is_shadow = semi & (np.abs(a[..., :3].astype(int) - SHADOW[:3]).sum(2) <= 6) & (np.abs(al.astype(int) - SHADOW[3]) <= 4)
    semi_body = int((semi & ~is_shadow).sum())
    shadow = int(is_shadow.sum())
    ys = np.nonzero(solid.any(1))[0]
    top, foot = int(ys[0]), int(ys[-1])
    foot_off = foot - (h - below - 1)
    H = foot - top + 1
    hb = max(4, int(H * 0.15))                    # 頭の高さ（上から15%）
    hx = np.nonzero(solid[top:top + hb].any(0))[0]
    head = (int(hx[0]), int(hx[-1]))
    head_cx = (hx[0] + hx[-1]) / 2
    ax = f.get('ax', w // 2)
    cols = Counter(map(tuple, a[solid][:, :3].tolist()))
    # ふち（4近傍に透明がある不透明の画素）
    pad = np.pad(solid, 1)
    edge = solid & (~pad[:-2, 1:-1] | ~pad[2:, 1:-1] | ~pad[1:-1, :-2] | ~pad[1:-1, 2:])
    edge &= body_rows[:, None]
    ec = a[edge][:, :3]
    el = (0.299 * ec[:, 0] + 0.587 * ec[:, 1] + 0.114 * ec[:, 2]) / 255.0 if len(ec) else np.zeros(0)
    dark = [tuple(c) for c, l in zip(ec.tolist(), el) if l < 0.3]
    outline = Counter(dark).most_common(1)[0][0] if dark else None
    gaps = int((el > 0.55).sum())
    # 浮いたドット（まわり8マスに不透明がない）と、3マス以下の小さなかたまり
    n, lab_, st, _ = cv2.connectedComponentsWithStats((al > 0).astype(np.uint8), connectivity=8)
    tiny = [i for i in range(1, n) if st[i, cv2.CC_STAT_AREA] <= 3]
    tiny_px = int(sum(st[i, cv2.CC_STAT_AREA] for i in tiny))
    # 胴の主な色（高さの35〜55%の帯、立ち位置のまわり。輪郭の暗い色は除く）
    y0, y1 = top + int(H * 0.35), top + int(H * 0.55)
    x0, x1 = max(0, int(ax - w * 0.22)), min(w, int(ax + w * 0.22) + 1)
    tb = a[y0:y1, x0:x1]
    tc = [tuple(c[:3]) for c in tb.reshape(-1, 4).tolist() if c[3] == 255 and lum(c) >= 0.18 and not skinlike(c)]
    torso = Counter(tc).most_common(1)[0][0] if tc else None
    # 髪（頭の上8%の帯の主な色。輪郭と肌を除く）と肌（顔の帯の肌色らしい主な色）
    hc = [tuple(c[:3]) for c in a[top:top + max(3, int(H * 0.08))].reshape(-1, 4).tolist() if c[3] == 255 and lum(c) >= 0.12 and not skinlike(c)]
    hair = Counter(hc).most_common(1)[0][0] if hc else None
    sc = [tuple(c[:3]) for c in a[top + int(H * 0.06):top + int(H * 0.2)].reshape(-1, 4).tolist() if c[3] == 255 and skinlike(c)]
    skin = Counter(sc).most_common(1)[0][0] if sc else None
    return dict(hair=hair, skin=skin, w=w, h=h, ax=ax, below=below, top=top, foot=foot, foot_off=int(foot_off), height=int(H), head=head,
                head_dx=float(head_cx - ax), n_colors=len(cols), colors=cols, semi_body=semi_body, shadow=shadow,
                outline=outline, gaps=gaps, tiny=len(tiny), tiny_px=tiny_px, torso=torso, hb=hb)

def foreign(cols, base_lab, thr):
    """基準の色（Lab）のどれからも thr より遠い色の画素数と色数"""
    if not cols: return 0, 0
    cs = list(cols.keys()); L = lab(cs)
    d = np.sqrt(((L[:, None, :] - base_lab[None, :, :]) ** 2).sum(2)).min(1)
    far = [c for c, x in zip(cs, d) if x > thr]
    return int(sum(cols[c] for c in far)), len(far)

def families(st, order, k=10, seed=0):
    """キャラの全コマの色（輪郭の暗い色を除く）を、画素数の重みつきで k 個の色の系統にまとめる。
    返り値: 系統の代表色（RGB）と、コマごとの系統の割合"""
    cols = Counter()
    for n in order: cols.update(st[n]['colors'])
    cs = [c for c in cols if lum(c) >= 0.12]
    X = lab(cs); w = np.array([cols[c] for c in cs], np.float64)
    k = min(k, len(cs))
    rng = np.random.default_rng(seed)
    C = [X[int(np.argmax(w))]]
    for _ in range(1, k):  # 重みつき k-means++ の初期値
        d = np.min(((X[:, None, :] - np.array(C)[None]) ** 2).sum(2), 1) * w
        C.append(X[int(rng.choice(len(X), p=d / d.sum()))] if d.sum() else X[0])
    C = np.array(C)
    for _ in range(20):
        lab_ = np.argmin(((X[:, None, :] - C[None]) ** 2).sum(2), 1)
        for j in range(k):
            m = lab_ == j
            if m.any(): C[j] = (X[m] * w[m, None]).sum(0) / w[m].sum()
    idx = {c: int(l) for c, l in zip(cs, lab_)}
    rep = [max((c for c in cs if idx[c] == j), key=lambda c: cols[c], default=(0, 0, 0)) for j in range(k)]
    share = {}
    for n in order:
        v = np.zeros(k); tot = 0
        for c, cnt in st[n]['colors'].items():
            if c in idx: v[idx[c]] += cnt; tot += cnt
        share[n] = v / max(1, tot)
    return rep, share

def majority(order, cols, thr=15.0):
    """コマごとの色（髪・肌・胴・輪郭）を、ΔE が thr 以内のものどうしでまとめ、いちばん多くのコマが使う色と、それとちがうコマを返す"""
    groups = []
    for n in order:
        c = cols[n]
        if c is None: continue
        for g in groups:
            if de(c, g['c']) <= thr: g['n'].append(n); break
        else: groups.append(dict(c=c, n=[n]))
    if not groups: return None
    groups.sort(key=lambda g: -len(g['n']))
    top = groups[0]
    return dict(color='#%02x%02x%02x' % top['c'], frames=len(top['n']), groups=len(groups),
                others=[dict(color='#%02x%02x%02x' % g['c'], frames=g['n']) for g in groups[1:]])

def place(a, f, step, H, W, X0, Y0):
    """ゲームと同じ置き方で、1コマを大きな板の上に描く（立ち位置 ax・足の裏をそろえ、腰から上を up だけずらす）"""
    out = np.zeros((H, W, 4), np.uint8)
    h, w = a.shape[:2]
    x = X0 - f['ax']; y = Y0 - (h - f['below']) + step.get('dy', 0)
    up = step.get('up', 0) if isinstance(step.get('up', 0), (int, float)) else 0
    waist = f.get('waist') or round(h * 0.58)
    def blit(src, yy):
        sh, sw = src.shape[:2]
        ys0, xs0 = max(0, yy), max(0, x)
        ys1, xs1 = min(H, yy + sh), min(W, x + sw)
        if ys1 <= ys0 or xs1 <= xs0: return
        s = src[ys0 - yy:ys1 - yy, xs0 - x:xs1 - x]
        m = s[..., 3] > 0
        out[ys0:ys1, xs0:xs1][m] = s[m]
    if not up:
        blit(a, y)
    else:
        blit(a[waist:], y + waist)
        if up < 0: blit(np.repeat(a[waist - 1:waist], -up, 0), y + waist + up)
        blit(a[:waist], y + up)
    return out

def motion(ch, frames, imgs):
    """動作ごとに、となりのコマとの差: 変わった画素の割合・頭のとび・頭の所の変化"""
    res = {}
    if ch['kind'] != 'poses': return res
    W = max(f['w'] for f in frames.values()) * 3; H = max(f['h'] for f in frames.values()) + 40
    X0, Y0 = W // 2, H - 20
    for act, steps in ch['actions'].items():
        # わざとの跳ね（驚いたときなどの dy）は動きの差に数えない: dy を除いて置く
        comps = [place(imgs[s['img']], frames[s['img']], {**s, 'dy': 0}, H, W, X0, Y0) for s in steps]
        loop = ch.get('loops', {}).get(act, True)
        uniq = len(dict.fromkeys(s['img'] for s in steps))
        rows = []
        for i in range(len(comps)):
            j = (i + 1) % len(comps)
            if j == 0 and (len(comps) <= 1 or not loop): break
            A0, B0 = comps[i], comps[j]
            def head(m):
                ys = np.nonzero(m.any(1))[0]
                if not len(ys): return None
                t = ys[0]; hb = max(4, int((ys[-1] - t) * 0.15))
                xs = np.nonzero(m[t:t + hb].any(0))[0]
                return t, (xs[0] + xs[-1]) / 2, hb
            ha, hbb = head(A0[..., 3] > 0), head(B0[..., 3] > 0)
            jump = (abs(int(ha[0]) - int(hbb[0])), abs(ha[1] - hbb[1])) if ha and hbb else (0, 0)
            t, hb = ha[0], ha[2]
            best, best_head = 1.0, 1.0
            for dy in range(-2, 3):
                for dx in range(-1, 2):
                    B1 = np.roll(np.roll(B0, dy, 0), dx, 1)
                    A, B = A0[..., 3] > 0, B1[..., 3] > 0
                    diff = (A != B) | (A & B & (np.abs(A0[..., :3].astype(int) - B1[..., :3].astype(int)).sum(2) > 24))
                    best = min(best, float(diff.sum() / max(1, (A | B).sum())))
                    best_head = min(best_head, float(diff[t:t + hb].sum() / max(1, (A | B)[t:t + hb].sum())))
            head_diff_frac = best_head
            rows.append(dict(i=i, j=j, changed=round(best, 3), head_dy=jump[0], head_dx=round(jump[1], 1), head_changed=round(head_diff_frac, 3)))
            if not ch['actions'][act] or (j == 0 and len(comps) == 2): pass
        tops = []
        for c in comps:
            ys = np.nonzero((c[..., 3] > 0).any(1))[0]
            tops.append(int(ys[0]) if len(ys) else 0)
        res[act] = dict(frames=len(steps), unique=uniq, steps=rows, bob=(max(tops) - min(tops)) if tops else 0)
    return res

def sheet_row(name, order, frames, imgs, scale, label=True):
    """1キャラ分の行。どのコマも、立ち位置（ax）と足の裏をそろえて同じ大きさの枠に置く（ずれが見える）"""
    L = max(frames[n]['ax'] for n in order); R = max(frames[n]['w'] - frames[n]['ax'] for n in order)
    U = max(frames[n]['h'] - frames[n]['below'] for n in order); D = max(frames[n]['below'] for n in order)
    cw, chh = L + R + 6, U + D + 16
    img = Image.new('RGBA', (cw * len(order), chh), (196, 186, 160, 255))
    d = ImageDraw.Draw(img)
    for k, n in enumerate(order):
        f = frames[n]; x0 = k * cw
        d.line([(x0 + 3 + L, 12), (x0 + 3 + L, chh)], fill=(150, 140, 120, 255))          # 立ち位置
        d.line([(x0, 12 + U), (x0 + cw - 2, 12 + U)], fill=(150, 140, 120, 255))          # 足の裏の線
        d.line([(x0 + cw - 1, 0), (x0 + cw - 1, chh)], fill=(120, 110, 95, 255))
        im = Image.fromarray(imgs[n])
        img.alpha_composite(im, (x0 + 3 + L - f['ax'], 12 + U - (f['h'] - f['below'])))
    img = img.resize((img.width * scale, img.height * scale), Image.NEAREST)
    d = ImageDraw.Draw(img)
    if label:
        for k, n in enumerate(order):
            d.text((k * cw * scale + 3, 2), n.replace('pose_', 'p').replace('walk_', 'w').replace('surprise_', '驚').replace('angry_', '怒'), fill=(40, 20, 10, 255))
    return img

def main(manifest, outdir):
    m = json.load(open(manifest))
    os.makedirs(outdir, exist_ok=True)
    summary = {}
    rows_overview = []
    for name, ch in m['chars'].items():
        frames = ch['frames']
        if ch['kind'] != 'poses':
            for n in frames: frames[n].update(ax=load(n).shape[1] // 2, below=0, w=load(n).shape[1], h=load(n).shape[0])
        imgs = {n: load(n) for n in frames}
        # 並べる順: ポーズ集（0〜）→ 驚き・怒り → 歩くコマ（0〜15）
        order = sorted(frames, key=lambda n: (1 if 'walk' in frames[n] else 0, frames[n].get('pose', 0), frames[n].get('walk', 0)))
        base = ch['actions'].get('idle', [{'img': order[0]}])[0]['img']
        st = {n: frame_stats(imgs[n], frames[n]) for n in order}
        b = st[base]
        base_lab = lab(list(b['colors'].keys()))
        all_cols = Counter()
        for n in order: all_cols.update(st[n]['colors'])
        rep, share = families(st, order)
        fr = {}
        for n in order:
            s = st[n]
            gone = [j for j in range(len(rep)) if share[base][j] >= 0.08 and share[n][j] < 0.02]
            new_ = [j for j in range(len(rep)) if share[n][j] >= 0.08 and share[base][j] < 0.02]
            fp, fc = foreign(s['colors'], base_lab, T['foreign_de'])
            npx = sum(s['colors'].values())
            torso_de = de(s['torso'], b['torso']) if s['torso'] and b['torso'] else 0.0
            out_de = de(s['outline'], b['outline']) if s['outline'] and b['outline'] else 0.0
            issues = []
            if fp / max(1, npx) > T['foreign_frac']: issues.append('基準にない色')
            if torso_de > T['torso_de']: issues.append('胴の色が別')
            if gone or new_: issues.append('主な色が入れかわる')
            hair_de = de(s['hair'], b['hair']) if s['hair'] and b['hair'] else 0.0
            skin_de = de(s['skin'], b['skin']) if s['skin'] and b['skin'] else 0.0
            if hair_de > T['hair_de']: issues.append('髪（頭）の色が別')
            if skin_de > T['skin_de']: issues.append('肌の色が別')
            if out_de > T['outline_de']: issues.append('輪郭の色が別')
            if s['foot_off'] != 0: issues.append('足もとがずれる')
            if abs(s['height'] - b['height']) >= T['height_px']: issues.append('高さがちがう')
            if abs(s['head_dx'] - b['head_dx']) >= T['head_dx']: issues.append('中心がずれる')
            if s['semi_body']: issues.append('半透明')
            if s['tiny']: issues.append('浮いたゴミ')
            if s['gaps'] >= T['gap_px']: issues.append('輪郭が途切れる')
            fr[n] = dict(w=s['w'], h=s['h'], n_colors=s['n_colors'], foreign_px=fp, foreign_colors=fc, foreign_frac=round(fp / max(1, npx), 3),
                         torso='#%02x%02x%02x' % s['torso'] if s['torso'] else None, torso_de=round(torso_de, 1),
                         outline='#%02x%02x%02x' % s['outline'] if s['outline'] else None, outline_de=round(out_de, 1),
                         foot_off=s['foot_off'], height=s['height'], d_height=s['height'] - b['height'], head_dx=round(s['head_dx'], 1), d_head_dx=round(s['head_dx'] - b['head_dx'], 1),
                         hair='#%02x%02x%02x' % s['hair'] if s['hair'] else None, hair_de=round(hair_de, 1), skin='#%02x%02x%02x' % s['skin'] if s['skin'] else None, skin_de=round(skin_de, 1),
                         fam_gone=['#%02x%02x%02x' % rep[j] for j in gone], fam_new=['#%02x%02x%02x' % rep[j] for j in new_],
                         semi_body=s['semi_body'], shadow=s['shadow'], tiny=s['tiny'], tiny_px=s['tiny_px'], gaps=s['gaps'], issues=issues)
        mo = motion(ch, frames, imgs)
        for act, r in mo.items():
            iss = []
            lim = T['walk_swap_frac'] if act.startswith('walk') else T['swap_frac']
            if any(x['changed'] > lim for x in r['steps']): iss.append('絵が丸ごと入れかわる')
            if act.startswith('walk') and r['frames'] > 2 and not (1 <= r['bob'] <= 2): iss.append(f"上下のゆれが{r['bob']}ドット")
            if any(max(x['head_dy'], x['head_dx']) >= T['head_jump'] for x in r['steps']): iss.append('頭がとぶ')
            if act in ('idle', 'buy', 'give', 'take', 'salt') and any(x['head_changed'] > 0.15 for x in r['steps']): iss.append('動かない所（頭）が変わる')
            if r['unique'] == 1 and r['frames'] > 1 and act in ('talk', 'talk_basket', 'look', 'buy', 'give', 'take', 'salt', 'greet', 'work', 'laugh'): iss.append('同じ絵のくり返し（ずらしだけ）')
            r['issues'] = iss
        summary[name] = dict(base=base, colors_total=len(all_cols), frames=fr, motion=mo,
                             base_torso='#%02x%02x%02x' % b['torso'] if b['torso'] else None, base_outline='#%02x%02x%02x' % b['outline'] if b['outline'] else None)
        sheet_row(name, order, frames, imgs, 4).save(os.path.join(outdir, f'sheet_{name}.png'))
        rows_overview.append((name, sheet_row(name, order, frames, imgs, 1, label=False)))
        summary[name]['majority'] = {part: majority(order, {n: st[n][part] for n in order}) for part in ('hair', 'skin', 'torso', 'outline')}
        print(name, len(all_cols), sum(len(v['issues']) for v in fr.values()), file=sys.stderr)
    # 全キャラを1枚に（1倍。左にキャラの名前。4倍はキャラごとの sheet_<名前>.png）
    W = max(r.width for _, r in rows_overview) + 120; H = sum(r.height for _, r in rows_overview)
    ov = Image.new('RGBA', (W, H), (60, 50, 40, 255)); d = ImageDraw.Draw(ov); y = 0
    for name, r in rows_overview:
        ov.alpha_composite(r, (120, y)); d.text((6, y + r.height // 2), name, fill=(255, 240, 200, 255)); y += r.height
    ov = ov.resize((ov.width * 2, ov.height * 2), Image.NEAREST) if ov.width * ov.height * 4 < 80_000_000 else ov
    ov.save(os.path.join(outdir, 'overview.png'))
    json.dump(dict(thresholds=T, chars=summary), open(os.path.join(outdir, 'summary.json'), 'w'), ensure_ascii=False, indent=1)
    write_report(m, summary, outdir)

def write_report(m, summary, outdir):
    ja = m['actions_ja']
    L = ['# 人物の絵の点検（`tools/sprite_audit.py`）', '',
         '基準のコマ = 各キャラの「待つ」の1コマ目。色・輪郭・高さ・中心は基準との差。しきい値は summary.json の thresholds。', '',
         '## キャラ別（コマの問題の数）', '',
         '| キャラ | 基準 | 色数（全コマ） | コマ数 | 基準にない色 | 胴の色が別 | 髪（頭）の色が別 | 肌の色が別 | 主な色が入れかわる | 輪郭の色が別 | 足もと | 高さ | 中心 | 半透明 | ゴミ | 輪郭切れ |',
         '|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|']
    keys = ['基準にない色', '胴の色が別', '髪（頭）の色が別', '肌の色が別', '主な色が入れかわる', '輪郭の色が別', '足もとがずれる', '高さがちがう', '中心がずれる', '半透明', '浮いたゴミ', '輪郭が途切れる']
    tot = Counter()
    for name, s in summary.items():
        c = Counter(i for f in s['frames'].values() for i in f['issues']); tot.update(c)
        L.append(f"| {name} | {s['base']} | {s['colors_total']} | {len(s['frames'])} | " + ' | '.join(str(c[k]) for k in keys) + ' |')
    L.append('| **計** | | | | ' + ' | '.join(f'**{tot[k]}**' for k in keys) + ' |')
    L += ['', '## 同じパーツの色が、コマごとに何通りあるか（ΔE 15 以内を同じ色とみなす）', '',
          '多くのコマが使う色（多数派）と、それとちがう色を使うコマ。基準のコマが少数派のこともある。', '',
          '| キャラ | 髪（頭の上） | 肌 | 胴（服） | 輪郭 |', '|---|---|---|---|---|']
    def cell(mj):
        if not mj: return '－'
        return f"{mj['groups']}通り（多数派 {mj['color']} {mj['frames']}コマ）"
    for name, s in summary.items():
        mj = s.get('majority', {})
        L.append(f"| {name} | {cell(mj.get('hair'))} | {cell(mj.get('skin'))} | {cell(mj.get('torso'))} | {cell(mj.get('outline'))} |")
    L += ['', '<details><summary>少数派の色を使うコマ（キャラ・パーツごと）</summary>', '']
    for name, s in summary.items():
        for part, ja_ in (('hair', '髪'), ('skin', '肌'), ('torso', '胴'), ('outline', '輪郭')):
            mj = s.get('majority', {}).get(part)
            if mj and mj['others']:
                L.append(f"- {name} {ja_}: " + '／'.join(f"{o['color']}: {', '.join(x.split('_', 1)[1] for x in o['frames'])}" for o in mj['others']))
    L += ['', '</details>', '', '## 動作別（となりのコマとの差）', '',
          '| キャラ | 動作 | コマ | 絵の数 | 変わった画素（最大） | 頭のとび（最大 縦/横） | 上下のゆれ | 問題 |', '|---|---|---|---|---|---|---|---|']
    mt = Counter()
    for name, s in summary.items():
        for act, r in s['motion'].items():
            mx = max((x['changed'] for x in r['steps']), default=0)
            hy = max((x['head_dy'] for x in r['steps']), default=0); hx = max((x['head_dx'] for x in r['steps']), default=0)
            mt.update((ja.get(act, act), i) for i in r['issues'])
            L.append(f"| {name} | {ja.get(act, act)} | {r['frames']} | {r['unique']} | {mx:.0%} | {hy}/{hx} | {r['bob']} | {'・'.join(r['issues'])} |")
    L += ['', '## 動作別の問題の数（全キャラ）', '', '| 動作 | 問題 | キャラ数 |', '|---|---|---|']
    for (act, iss), n in sorted(mt.items()): L.append(f'| {act} | {iss} | {n} |')
    open(os.path.join(outdir, 'report.md'), 'w').write('\n'.join(L) + '\n')

if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2])
