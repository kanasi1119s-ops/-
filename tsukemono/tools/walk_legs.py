# 歩くコマの脚を、部品ごとに描き直す設計図を作る。  python3 tools/walk_legs.py <名前...> → assets/editor/mend/legs.design.json
#   そのあと EDITOR_OUT=assets/editor/mend node tools/editor_touch.mjs assets/editor/mend/legs.design.json でエディタで描く。
# 関節で回したもも・すねは、回すときの多数決でふちがぎざぎざに欠け、輪郭の黒が脚の中にちぎれて残ることがある（おじいさん・男の子）。
# エディタの作品（assets/editor/<名前>.json）の部品レイヤーから、各コマのもも・すねの形を取り、
#   1. 形を「軸にそってまっすぐ、太さがなめらかに変わる帯」に当てはめ直す
#   2. 色は1コマ目の同じ部品から、付け根からの位置と幅の中の位置で写す（部品の色を4色にしぼって、近い7つの多数決。輪郭・背景の取り残しは写さない）
#   3. 点をならし、外まわりに輪郭を引く（色は1コマ目の輪郭の色）
# 胴・すそ・腕・かごに隠れる所と、奥の脚の上に重なる手前の脚・足はさわらない。
# 鎧や模様のある脚（騎士など）は描き込みが消えるので使わない。前後を見比べて、良くなった人だけに当てる。
import json, os, sys
import numpy as np, cv2
P=os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'assets', 'editor') + '/'
def load(ch):
    p=json.load(open(P+ch+'.json')); sym={s['sym']:s['color'] for s in p['symbols']}
    return p, sym, [l['name'] for l in p['layers']]
def cel(p,sym,li,f):
    W,H=p['width'],p['height']; a=np.zeros((H,W,4),np.uint8); rows=p['cels'][li][f]
    if not rows: return a
    for y,r in enumerate(rows):
        for x,ch in enumerate(r):
            if ch!='.': c=sym[ch]; a[y,x]=[int(c[1:3],16),int(c[3:5],16),int(c[5:7],16),255]
    return a
# 歩くコマの脚を、部品ごとに描き直す: 1コマ目の同じ部品の色を「付け根からの位置 t・幅の中の位置 d」で写し、点をならし、外まわりに輪郭
from collections import Counter
from PIL import Image
N4=[(-1,0),(1,0),(0,-1),(0,1)]; N8=N4+[(-1,-1),(-1,1),(1,-1),(1,1)]
LW=np.array([0.299,0.587,0.114])
PARTS={'far':['奥のもも','奥のすね'],'near':['手前のもも','手前のすね']}
ABOVE=['胴','すそ','すそ後','すそ前','カバン','手前の腕','かご']
def lum(c): return float(np.dot(np.asarray(c[:3],float),LW))
def frame_coords(mask, hipward=None):
    ys,xs=np.nonzero(mask)
    if len(ys)<6: return None
    P=np.stack([xs,ys],1).astype(float); c=P.mean(0)
    cov=np.cov((P-c).T); w,v=np.linalg.eigh(cov); u=v[:,1]
    if u[1]<0: u=-u  # 下向き（付け根→足首）
    n=np.array([-u[1],u[0]])  # 右手側
    tt=(P-c)@u; dd=(P-c)@n
    t=(tt-tt.min())/max(1e-6,tt.max()-tt.min())
    # 幅は t ごとに
    d=np.zeros_like(dd)
    bins=np.clip((t*10).astype(int),0,9)
    for b in range(10):
        s=bins==b
        if s.sum()==0: continue
        lo,hi=dd[s].min(),dd[s].max()
        d[s]=(dd[s]-lo)/max(1e-6,hi-lo)*2-1
    return ys,xs,t,d
def palette_of(cols, k=4):
    """部品の色を k 色に（実在の色から選ぶ）"""
    u=np.unique(cols,axis=0)
    if len(u)<=k: return u
    Z=cols.astype(np.float32)
    _,lab,cent=cv2.kmeans(Z,k,None,(cv2.TERM_CRITERIA_EPS+cv2.TERM_CRITERIA_MAX_ITER,40,0.5),4,cv2.KMEANS_PP_CENTERS)
    out=[]
    for c in cent: out.append(cols[np.abs(Z-c).sum(1).argmin()])
    return np.array(out)
def paint_part(src_img, src_mask, dst_mask, K=7):
    """dst_mask の各ドットに、src の同じ (t,d) あたりの色（部品の色を4色にしぼって、近い7つの多数決）"""
    s=frame_coords(src_mask); dd=frame_coords(dst_mask)
    if s is None or dd is None: return {}
    sy,sx,st,sd=s; cols=src_img[sy,sx,:3]
    L_=np.array([lum(c) for c in cols]); ok=L_>=min(70,np.percentile(L_,15))  # 輪郭（その部品でいちばん暗い1.5割、ただし明るさ70まで）は写さない
    # 背景の取り残し（薄い青灰色）は写さない。白は部品の中で多いとき（靴下など）だけ
    BGc=np.array([196,205,214])
    bgl=np.array([np.abs(c.astype(int)-BGc).sum()<70 and int(c.max())-int(c.min())<40 for c in cols])
    white=np.array([lum(c)>200 for c in cols])
    ok&=~bgl
    if white.mean()<0.15: ok&=~white
    if ok.sum()<4: ok[:]=True
    sy,sx,st,sd,cols=sy[ok],sx[ok],st[ok],sd[ok],cols[ok]
    pal=palette_of(cols, PAL_K)
    lab=np.abs(cols[:,None,:].astype(int)-pal[None].astype(int)).sum(-1).argmin(1)
    S=np.stack([st*2.0,sd*0.6],1)
    out={}
    for y,x,t,d in zip(*dd):
        q=np.array([t*2.0,d*0.6]); idx=np.argsort(((S-q)**2).sum(1))[:K]
        out[(y,x)]=tuple(pal[Counter(lab[i] for i in idx).most_common(1)[0][0]])
    return out
PAL_K=4
CAPSULE=True
def capsule(mask):
    """部品の形を、軸にそってまっすぐで太さがなめらかに変わる帯に当てはめ直す"""
    ys,xs=np.nonzero(mask)
    if len(ys)<12: return mask
    P=np.stack([xs,ys],1).astype(float); c=P.mean(0)
    w,v=np.linalg.eigh(np.cov((P-c).T)); u=v[:,1]
    if u[1]<0: u=-u
    n=np.array([-u[1],u[0]])
    tt=(P-c)@u; dd=(P-c)@n
    lo,hi=np.percentile(tt,1),np.percentile(tt,99)
    bins=np.linspace(lo,hi,8); T=[];L=[];R=[]
    for a,b in zip(bins[:-1],bins[1:]):
        s_=(tt>=a)&(tt<=b)
        if s_.sum()<3: continue
        T.append((a+b)/2); L.append(np.percentile(dd[s_],8)); R.append(np.percentile(dd[s_],92))
    if len(T)<2: return mask
    pl=np.polyfit(T,L,1); pr=np.polyfit(T,R,1)
    H,W=mask.shape; yy,xx=np.mgrid[0:H,0:W]
    Q=np.stack([xx-c[0],yy-c[1]],-1); qt=Q@u; qd=Q@n
    inside=(qt>=tt.min()-0.5)&(qt<=tt.max()+0.5)&(qd>=np.polyval(pl,qt)-0.5)&(qd<=np.polyval(pr,qt)+0.5)
    return inside
def outline_of(img, mask):
    H,W=mask.shape; cnt=Counter()
    ring=cv2.dilate(mask.astype(np.uint8),np.ones((3,3),np.uint8))>0
    for y,x in zip(*np.nonzero(ring)):
        if img[y,x,3]==255 and lum(img[y,x])<55: cnt[tuple(img[y,x,:3])]+=1
    return cnt.most_common(1)[0][0] if cnt else (30,24,20)
def run(ch, frames, I):
    p,sym,L=load(ch); H,W=p['height'],p['width']
    def cm(n,f): return cel(p,sym,L.index(n),f)[...,3]>0 if n in L else np.zeros((H,W),bool)
    src=np.asarray(Image.open(f'{I}walk_{ch}_0.png').convert('RGBA'))
    srcc={n:cel(p,sym,L.index(n),0) for side in PARTS.values() for n in side if n in L}
    outc={side:outline_of(src, cm(PARTS[side][0],0)|cm(PARTS[side][1],0)) for side in PARTS}
    res={}
    for f in frames:
        img=np.asarray(Image.open(f'{I}walk_{ch}_{f}.png').convert('RGBA')).copy()
        above=np.zeros((H,W),bool)
        for n in ABOVE: above|=cm(n,f)
        nearleg=cm('手前のもも',f)|cm('手前のすね',f); nearfoot=cm('手前の足',f)
        for side in ('far','near'):
            sil=np.zeros((H,W),bool)
            for n in PARTS[side]:
                if n not in L: continue
                dm=cm(n,f)
                # 部品の割れ目を閉じる
                dm=capsule(dm) if CAPSULE else dm
                colmap=paint_part(srcc[n], cm(n,0), dm)
                for (y,x),c in colmap.items():
                    if above[y,x]: continue
                    if side=='far' and (nearleg[y,x] or nearfoot[y,x]): continue
                    if cm(FEET:=('奥の足' if side=='far' else '手前の足'),f)[y,x]: continue
                    img[y,x,:3]=c; img[y,x,3]=255
                sil|=dm
            # 点をならす（3x3 で同じ部品の中の多数決。5つ以上そろえば）
            vis=sil&~above
            if side=='far': vis&=~nearleg&~nearfoot
            for _ in range(2):
                new=img.copy()
                for y,x in zip(*np.nonzero(vis)):
                    nb=[tuple(img[y+dy,x+dx,:3]) for dy,dx in N8 if 0<=y+dy<H and 0<=x+dx<W and vis[y+dy,x+dx]]
                    if len(nb)>=6:
                        c,k=Counter(nb).most_common(1)[0]
                        if k>=5: new[y,x,:3]=c
                img=new
            # 外まわりに輪郭（脚の外が透明、または奥の脚の上に手前の脚が重なる所）
            for y,x in zip(*np.nonzero(vis)):
                edge=False
                for dy,dx in N4:
                    yy,xx=y+dy,x+dx
                    if not(0<=yy<H and 0<=xx<W) or img[yy,xx,3]==0: edge=True
                    elif side=='near' and not sil[yy,xx] and (cm('奥のもも',f)[yy,xx] or cm('奥のすね',f)[yy,xx]): edge=True
                if edge and lum(img[y,x])<215: img[y,x,:3]=outc[side]
        res[f]=img
    return res

if __name__ == '__main__':
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    from sprite_mend import touches, load as load_img, snap
    I = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'assets', 'img') + '/'
    out = {}
    for ch in sys.argv[1:]:
        r = run(ch, list(range(16)), I)
        for f in range(16):
            n = f'walk_{ch}_{f}'; a = load_img(n); t = touches(a, snap(a, r[f]))
            if t: out[n] = t
    path = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'assets', 'editor', 'mend', 'legs.design.json')
    json.dump(out, open(path, 'w'))
    print(len(out), '枚', sum(len(v) for v in out.values()), 'ドット →', path)
