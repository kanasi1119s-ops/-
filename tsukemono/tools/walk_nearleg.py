# 手前の脚（かごの後ろに隠れていた所から作った部品）に入った背景の灰色を、同じコマの奥の脚の同じ所の色に
# 使い方: python3 tools/walk_nearleg.py → nl/ に直した絵と nl_<名前>.png（前後）。設計図は assets/editor/mend/nearleg.design.json
# かごの後ろに隠れていた所から作った手前のもも・すねに、背景の薄い青灰色が入って脚が灰色に見えていた（サッカー少年・水着の子）。
import sys, os; sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from walk_legs import load, cel, paint_part
import numpy as np
from PIL import Image
I=os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'assets', 'img') + '/'
def bgl(c):
    c=c.astype(int); return (c.max(-1)-c.min(-1)<50)&(c[...,2]>=c[...,0])&(c[...,2]-c[...,0]<60)&((c@[0.299,0.587,0.114])>120)
JOBS={'soccer':['もも','すね'],'beach':['もも','すね']}
JOBS['alien'] = ['もも', 'すね']  # 試し: 宇宙人は奥の脚にも同じ明るい緑があり、ほとんど変わらなかったので当てていない
JOBS = {k: JOBS[k] for k in sys.argv[1:]} if sys.argv[1:] else {k: v for k, v in JOBS.items() if k != 'alien'}
PALE = {'alien'}  # 背景の灰色ではなく、白っぽく抜けた明るい色が入っている人（奥の脚のその部品にない色を塗り直す）  # レーサーも試したが、赤黒い点が出て悪くなったので外した
os.makedirs('nl',exist_ok=True)
for ch,parts in JOBS.items():
    p,sym,L=load(ch); ts=[]
    for f in range(16):
        img=np.asarray(Image.open(f'{I}walk_{ch}_{f}.png').convert('RGBA')).copy(); o=img.copy()
        for part in parts:
            nc=cel(p,sym,L.index('手前の'+part),f); nm=nc[...,3]>0
            fc=cel(p,sym,L.index('奥の'+part),f); fm=fc[...,3]>0
            cmap=paint_part(fc,fm,nm,K=5)
            # 画像の上で、手前の部品の色がそのまま見えていて、それが背景の灰色の所だけ
            vis=nm&np.all(img[...,:3]==nc[...,:3],-1)&(img[...,3]==255)
            if ch in PALE:
                f0=cel(p,sym,L.index('奥の'+part),0); fpal={tuple(int(v) for v in c) for c in f0[f0[...,3]>0][:,:3]}
                vis&=np.array([[tuple(int(v) for v in img[y,x,:3]) not in fpal for x in range(img.shape[1])] for y in range(img.shape[0])])
            else:
                vis&=bgl(img[...,:3])
            for y,x in zip(*np.nonzero(vis)):
                c=cmap.get((y,x))
                if c is not None: img[y,x,:3]=c
        Image.fromarray(img).save(f'nl/walk_{ch}_{f}.png')
        if f%2==0:
            H,W=img.shape[:2]
            for s in (o,img):
                c=Image.new('RGBA',(W,H),(150,120,90,255)); c.alpha_composite(Image.fromarray(s)); ts.append(c.crop((0,H//2,W,H)).resize((W*3,(H-H//2)*3),Image.NEAREST))
    out=Image.new('RGBA',(8*(ts[0].width+4),2*(ts[0].height+4)),(30,30,30,255))
    for j in range(8):
        for k in range(2): out.alpha_composite(ts[j*2+k],(j*(ts[0].width+4),k*(ts[0].height+4)))
    out.save(f'nl_{ch}.png')
