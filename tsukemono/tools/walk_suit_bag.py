# 背広の人の歩くコマ: 元の絵でカバンが脚に重なっていた所のカバンの色（灰・赤茶）が、脚の部品に四角やすじで残っている → まわりのズボンの色で埋める。
#   python3 tools/walk_suit_bag.py（作業用。scratch の lp/ に書き出す）。設計図は assets/editor/mend/suitbag.design.json
# 背広の人の手前のもも: 元の絵でカバンが重なっていた所の灰色（カバンの色）が、ももの部品に入って四角く残っている → ズボンの色で埋める
import os, sys; sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from walk_legs import load, cel
import numpy as np
from collections import Counter
from PIL import Image
I=os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'assets', 'img') + '/'
OUT=os.environ.get('OUT', 'lp'); os.makedirs(OUT, exist_ok=True)
p,sym,L=load('suit'); GR={(63,25,42),(57,57,59),(87,78,79),(110,44,46),(79,47,16),(74,30,34),(42,18,22),(143,68,64),(138,100,32)}
N8=[(-1,-1),(-1,0),(-1,1),(0,-1),(0,1),(1,-1),(1,0),(1,1)]
ts=[]
for f in range(16):
    img=np.asarray(Image.open(f'{I}walk_suit_{f}.png').convert('RGBA')).copy(); H,W=img.shape[:2]
    m=np.zeros((H,W),bool)
    for n in ('手前のもも','手前のすね','奥のもも','奥のすね'): m|=cel(p,sym,L.index(n),f)[...,3]>0
    for n in ('胴','カバン','手前の腕','かご'): m&=~(cel(p,sym,L.index(n),f)[...,3]>0)
    bad={(y,x) for y,x in zip(*np.nonzero(m)) if tuple(img[y,x,:3]) in GR}
    n0=len(bad)
    for _ in range(30):
        if not bad: break
        done=[]
        for y,x in bad:
            nb=[tuple(img[y+dy,x+dx,:3]) for dy,dx in N8 if 0<=y+dy<H and 0<=x+dx<W and m[y+dy,x+dx] and (y+dy,x+dx) not in bad and img[y+dy,x+dx,3]==255]
            nb=[c for c in nb if sum(int(v) for v in c)>60]  # 輪郭の黒は広げない
            if len(nb)>=2: done.append(((y,x),Counter(nb).most_common(1)[0][0]))
        if not done:
            for y,x in bad:  # 残り（輪郭の黒にだけ接している所）は暗いズボンの色
                img[y,x,:3]=(35,41,71)
            bad=set(); break
        for (y,x),c in done: img[y,x,:3]=c; bad.discard((y,x))
    Image.fromarray(img).save(f'{OUT}/walk_suit_{f}.png'); print(f,n0,len(bad))
    if f%2==0:
        o=np.asarray(Image.open(f'{I}walk_suit_{f}.png').convert('RGBA'))
        for s in (o,img):
            c=Image.new('RGBA',(W,H),(150,120,90,255)); c.alpha_composite(Image.fromarray(s)); ts.append(c.crop((0,H//2,W,H)).resize((W*3,(H-H//2)*3),Image.NEAREST))
o=Image.new('RGBA',(8*(ts[0].width+4),2*(ts[0].height+4)),(30,30,30,255))
for j in range(8):
    for k in range(2): o.alpha_composite(ts[j*2+k],(j*(ts[0].width+4),k*(ts[0].height+4)))
o.save(f'{OUT}/suitfix.png')
