# 関節（股・膝・足首・肩）で動かす歩きの試作。 python3 tools/walk_joints.py <名前> <出力.gif> tools/walk_joints.json
import sys, json, math, numpy as np
from PIL import Image
n=sys.argv[1]; OUTG=sys.argv[2]; CFG=json.load(open(sys.argv[3]))[n]
p=json.load(open(f'assets/editor/{n}.plan.json')); o=json.load(open(f'assets/editor/{n}.orig.json'))
sym={s['sym']:tuple(int(s['color'][i:i+2],16) for i in (1,3,5)) for s in o['symbols']}
H,W=p['h'],p['w']; PADX=12; PADY=4
img=np.zeros((H,W,4),np.uint8)
for y,r in enumerate(o['cels'][0][0]):
    for x,c in enumerate(r):
        if c!='.': img[y,x]=(*sym[c],255)
al=img[:,:,3]>0
item=np.zeros((H,W),bool)
for y,a,b in p['keepRuns']: item[y,a:b+1]=True
item[CFG.get('itemMaxRow',H)+1:]=False  # かごの底より下は脚
# かごの行で、かごより左に残ったドット（ふちの灰色など）もかご（脚に入れると消えてかごが欠ける）
for y in range(H):
    xs=np.nonzero(item[y])[0]
    if len(xs):
        for x in range(0,xs.min()):
            if img[y,x,3]: item[y,x]=True
def rows_mask(rows):
    m=np.zeros((H,W),bool)
    for y0,y1,x0,x1 in rows: m[y0:y1+1,x0:x1+1]=True
    return m
farA=rows_mask(CFG['farArm'])&al&~item; nearA=rows_mask(CFG['nearArm'])&al&~item
cut=CFG['cut']
legzone=al&~item&~farA&~nearA; legzone[:cut]=False
J=CFG['joints']  # 脚ごと: hip, knee, ankle, toe（[y, x]）
def seg_dist(P,A,B):
    A=np.array(A,float);B=np.array(B,float);P=np.array(P,float)
    d=B-A; t=max(0,min(1,np.dot(P-A,d)/max(1e-9,np.dot(d,d)))); return np.linalg.norm(P-(A+t*d)), t
# 脚のドットを、いちばん近い骨（もも・すね・足）に割り当てる
parts={(l,s):np.zeros((H,W),bool) for l in ('near','far') for s in ('thigh','shin','foot')}
for y,x in np.argwhere(legzone):
    best=None
    for l in ('near','far'):
        j=J[l]
        for s,(a,b) in (('thigh',('hip','knee')),('shin',('knee','ankle')),('foot',('ankle','toe'))):
            d,_=seg_dist((y,x),j[a],j[b])
            if best is None or d<best[0]: best=(d,l,s)
    parts[(best[1],best[2])][y,x]=True
torso=np.where((al&~item&~farA&~nearA&~legzone)[...,None],img,0).astype(np.uint8)
# 手直し: 腕の下に隠れていた胴を、胴のふちの色で2ドットうめる（腕を振っても胴が欠けない）
def fill_under(arm, direction):
    for y in range(H):
        xs=np.nonzero(arm[y])[0]
        if not len(xs): continue
        t=np.nonzero(torso[y,:,3])[0]
        if not len(t): continue
        if direction<0:  # 腕が胴の左（手前の腕）: 胴の左のふちから左へ
            e=t.min(); src=torso[y,e].copy()
            for x in range(e-1,max(e-3,xs.min()-1),-1):
                if arm[y,x]: torso[y,x]=src
        else:
            e=t.max(); src=torso[y,e].copy()
            for x in range(e+1,min(e+3,xs.max()+1)):
                if arm[y,x]: torso[y,x]=src
fill_under(nearA,-1); fill_under(farA,+1)
def ang(A,B): return math.degrees(math.atan2(B[1]-A[1],B[0]-A[0]))  # 0=真下、+は前（右）
def length(A,B): return math.hypot(B[0]-A[0],B[1]-A[1])
def rot_paste(dst, src_mask, pivot_src, pivot_dst, dang, order_mask=None):
    """src_mask のドットを pivot_src を軸に dang 度回し、pivot_dst に置いて dst に描く（近いドットを取る）"""
    ys,xs=np.nonzero(src_mask)
    if not len(ys): return
    th=math.radians(dang); c,s=math.cos(th),math.sin(th)
    # 行き先の範囲
    pts=np.stack([ys-pivot_src[0], xs-pivot_src[1]],1).astype(float)
    # 回転（y下向き、x右向き。角度は 真下から右へ）: 下向きベクトル(1,0)→(cos,sin)
    ry=pts[:,0]*c - pts[:,1]*s; rx=pts[:,0]*s + pts[:,1]*c
    y0=int(math.floor(ry.min()+pivot_dst[0]))-1; y1=int(math.ceil(ry.max()+pivot_dst[0]))+1
    x0=int(math.floor(rx.min()+pivot_dst[1]))-1; x1=int(math.ceil(rx.max()+pivot_dst[1]))+1
    # 1ドットを 3×3 の点で調べ、部品に入る点が5つ以上ならドットを置く。色は いちばん多く当たった元のドット
    # （回したときに ふちに1ドットの飛び出し・欠けが出にくい）
    offs=[(-1/3,-1/3),(-1/3,0),(-1/3,1/3),(0,-1/3),(0,0),(0,1/3),(1/3,-1/3),(1/3,0),(1/3,1/3)]
    for ty in range(y0,y1+1):
        for tx in range(x0,x1+1):
            if not (0<=ty<dst.shape[0] and 0<=tx<dst.shape[1]): continue
            hits={}
            for oy_,ox_ in offs:
                dy=ty+oy_-pivot_dst[0]; dx=tx+ox_-pivot_dst[1]
                sy= dy*c + dx*s; sx= -dy*s + dx*c
                iy=int(round(sy+pivot_src[0])); ix=int(round(sx+pivot_src[1]))
                if 0<=iy<H and 0<=ix<W and src_mask[iy,ix]:
                    hits[(iy,ix)]=hits.get((iy,ix),0)+1
            if sum(hits.values())>=5:
                iy,ix=max(hits,key=hits.get); dst[ty,tx]=img[iy,ix]
def fk(hip, a_th, a_sh, L1, L2):
    k=(hip[0]+L1*math.cos(math.radians(a_th)), hip[1]+L1*math.sin(math.radians(a_th)))
    a=(k[0]+L2*math.cos(math.radians(a_sh)), k[1]+L2*math.sin(math.radians(a_sh)))
    return k,a
def curve(keys,t):
    t%=1.0
    for i in range(len(keys)-1):
        t0,v0=keys[i]; t1,v1=keys[i+1]
        if t0<=t<=t1:
            u=(t-t0)/(t1-t0); u=(1-math.cos(math.pi*u))/2; return v0+(v1-v0)*u
    return keys[-1][1]
TH=CFG['thighKeys']; KN=CFG['kneeKeys']; FT=CFG['footKeys']
N=16; frames=[]; ITEMPOS=[]
measured={}
for l in ('near','far'):
    j=J[l]; measured[l]=dict(th=ang(j['hip'],j['knee']), sh=ang(j['knee'],j['ankle']), ft=ang(j['ankle'],j['toe']),
        L1=length(j['hip'],j['knee']), L2=length(j['knee'],j['ankle']))
# 足の裏の傾き（元の絵）: 足のドットの各列のいちばん下を直線で結んだ角度（＋はつま先が上）
SOLE={}
for l in ('near','far'):
    ys,xs=np.nonzero(parts[(l,'foot')])
    cols=sorted(set(xs)); pts=[(x, ys[xs==x].max()) for x in cols]
    k_=np.polyfit([q[0] for q in pts],[q[1] for q in pts],1)[0] if len(pts)>2 else 0
    SOLE[l]=math.degrees(math.atan(-k_))
print('足の裏の傾き', {k:round(v,1) for k,v in SOLE.items()})
sole=CFG['ground']
for f in range(N):
    tf=f/N; tn=tf+0.5   # 奥の脚 t=0 で前に着く（元の絵）、手前の脚は半周ずれ
    pose={}; FOOT={}
    def a_ft_abs(l):
        # 足の向き: 写すもとの脚の元の絵の時点の向きからの変化
        # footKeys は「靴底が平ら＝0、＋はつま先が上」。写すもとの足は元の絵で SOLE だけ傾いているので、そのぶん戻す
        src=CFG.get('legFrom',{}).get(l, l)
        return FOOT[l]-SOLE[src]
    for l,t in (('near',tn),('far',tf)):
        m=measured[l]; L1=m['L1']; L2=m['L2']
        # 元の絵の時点（奥 t=0、手前 t=0.5）からの角度の変化を足す（最初のコマは元の絵のまま）
        # 角度は歩きの関節の動き（股・膝・足首）そのもの。左右の脚で同じ動き（半周ずれ）
        t0=0.5 if l=='near' else 0.0
        a_th=curve(TH,t)
        a_sh=curve(TH,t)-curve(KN,t)
        a_ft=curve(FT,t)-curve(FT,t0)
        pose[l]=(a_th,a_sh,a_ft,L1,L2); FOOT[l]=curve(FT,t)
    def draw_leg(canvas, l, bob):
        a_th,a_sh,a_ft,L1,L2=pose[l]; j=J[l]; m=measured[l]
        dh=CFG.get('drawHip',{}).get(l, j['hip'])  # 描くときの腰の位置（左右の脚の列を近づける）
        hip=(dh[0]+bob+PADY, dh[1]+PADX)
        k,a=fk(hip,a_th,a_sh,L1,L2)
        # かごの裏に隠れていた脚は、もう片方の脚の部品で まるごと描く（legFrom）
        # すね・足を先に、もも を上に（膝の外側のすき間を、もも がふさぐ）
        src=CFG.get('legFrom',{}).get(l, l); ms=measured[src]; js=J[src]
        rot_paste(canvas, parts[(src,'foot')], js['ankle'], a, a_ft_abs(l))
        rot_paste(canvas, parts[(src,'shin')], js['knee'], k, a_sh-ms['sh'])
        rot_paste(canvas, parts[(src,'thigh')], js['hip'], hip, a_th-ms['th'])
    # 足の裏を地面に: いったん脚だけ描いて、いちばん下のドットが地面の行に来るように体ごと上下させる
    # 地面に着いている脚（1歩の 0〜0.55）だけで高さを決める
    TT={'near':tn%1.0,'far':tf%1.0}
    stance=[l for l in ('near','far') if TT[l]<0.55]
    def lowest(l, bob):
        tmp=np.zeros((H+PADY*2,W+PADX*2,4),np.uint8); draw_leg(tmp,l,bob)
        # 回したときに1ドットだけ飛び出たつま先・かかとは数えない（2ドット以上ある行を足の裏とする）
        cnt=(tmp[:,:,3]>0).sum(1)
        rows=np.nonzero(cnt>=2)[0]
        return (rows.max() if len(rows) else np.nonzero(cnt)[0].max())-PADY
    bob=sole-max(lowest(l,0) for l in stance)
    # 浮いている脚が地面に食い込むなら、膝をもっと曲げる
    for l in ('near','far'):
        if l in stance: continue
        for _ in range(12):
            if lowest(l,bob)<=sole-1: break
            a_th,a_sh,a_ft,L1,L2=pose[l]; pose[l]=(a_th,a_sh-4,a_ft,L1,L2)
    canvas=np.zeros((H+PADY*2,W+PADX*2,4),np.uint8)
    def draw_arm(mask, sh, a):
        rot_paste(canvas, mask, sh, (sh[0]+bob+PADY, sh[1]+PADX), a)
    near_th=pose['near'][0]; far_th=pose['far'][0]
    armK=CFG.get('armGain',0.6)
    draw_arm(farA, CFG['farShoulder'], -armK*(far_th-measured['far']['th']))
    draw_leg(canvas,'far',bob)
    for y,x in zip(*np.nonzero(torso[:,:,3])): canvas[y+bob+PADY, x+PADX]=torso[y,x]
    draw_leg(canvas,'near',bob)
    na=-armK*(near_th-measured['near']['th'])
    draw_arm(nearA, CFG['nearShoulder'], na)
    # かごは手と一緒に（肩を軸に手の位置が動いたぶん）
    sh=CFG['nearShoulder']; hand=CFG['nearHand']
    th=math.radians(na); dy=hand[0]-sh[0]; dx=hand[1]-sh[1]
    ny=dy*math.cos(th)-dx*math.sin(th); nx=dy*math.sin(th)+dx*math.cos(th)
    ox=round(nx-dx); oy=round(ny-dy)
    ys,xs=np.nonzero(item)
    for y,x in zip(ys,xs): canvas[y+oy+bob+PADY, x+ox+PADX]=img[y,x]
    ITEMPOS.append((oy+bob, ox))
    canvas[sole+PADY+1:]=0  # 地面より下にはみ出たドットは消す
    # 手直し: 動かしてできた すき間（左右か上下を囲まれた透明なドット）を、となりの色でうめる
    a_=canvas
    for _ in range(2):
        m_=a_[:,:,3]>0; fix=[]
        for y in range(1,a_.shape[0]-1):
            for x in range(1,a_.shape[1]-1):
                if m_[y,x]: continue
                if m_[y,x-1] and m_[y,x+1]: fix.append((y,x,a_[y,x-1].copy()))
                elif m_[y-1,x] and m_[y+1,x]: fix.append((y,x,a_[y-1,x].copy()))
        for y,x,c in fix: a_[y,x]=c
    frames.append(Image.fromarray(canvas))
bgc=(222,214,190,255); sc=4
gif=[]
for im in frames:
    b=Image.new('RGBA',im.size,bgc); b.alpha_composite(im); gif.append(b.resize((im.width*sc,im.height*sc),Image.NEAREST).convert('P',palette=Image.ADAPTIVE))
gif[0].save(OUTG,save_all=True,append_images=gif[1:],duration=75,loop=0)
w,h=frames[0].size
sheet=Image.new('RGBA',((w)*8,(h+2)*2),bgc)
for k,im in enumerate(frames): sheet.alpha_composite(im,((k%8)*w,(k//8)*(h+2)))
sheet.resize((sheet.width*4,sheet.height*4),Image.NEAREST).save(OUTG.replace('.gif','.png'))
# 骨の割り当ての確認
dbg=np.zeros((H,W,4),np.uint8)
colors={('near','thigh'):(80,120,255),('near','shin'):(40,60,200),('near','foot'):(20,20,120),('far','thigh'):(255,120,80),('far','shin'):(200,60,40),('far','foot'):(120,20,20)}
for k,m in parts.items(): dbg[m]=(*colors[k],255)
dbg[farA]=(120,200,120,255); dbg[nearA]=(60,160,60,255); dbg[item]=(220,200,80,255)
dbg[(torso[:,:,3]>0)]=(170,170,170,255)
Image.fromarray(dbg).resize((W*8,H*8),Image.NEAREST).save(OUTG.replace('.gif','_parts.png'))

# かごが欠けていないかの確認
bad=[]
for k,(im,(oy,ox)) in enumerate(zip(frames,ITEMPOS)):
    a=np.array(im); miss=0
    for y,x in zip(*np.nonzero(item)):
        if tuple(a[y+oy+PADY,x+ox+PADX,:3])!=tuple(img[y,x,:3]): miss+=1
    bad.append(miss)
print('かごの欠け', bad)
