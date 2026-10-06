"""Extract centerline graphs from OFL-licensed Liu Jian Mao Cao glyphs.
Pillow is used only to rasterize type; no external artwork is edited.
Graph traversal is a writing approximation, not historical stroke-order data.
"""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
import json, math
root=Path(__file__).resolve().parent
font=ImageFont.truetype(str(root/'assets/LiuJianMaoCao-Regular.ttf'),250)
text='風起雲湧山河入夢墨走風雷萬象生意水月清心'
map_chars=dict(zip('風雲湧夢萬','风云涌梦万'))
result={}
dirs=[(0,-1),(1,-1),(1,0),(1,1),(0,1),(-1,1),(-1,0),(-1,-1)]
for char in dict.fromkeys(text):
    source=map_chars.get(char,char)
    bbox=font.getbbox(source)
    w,h=bbox[2]-bbox[0]+32,bbox[3]-bbox[1]+32
    im=Image.new('L',(w,h));ImageDraw.Draw(im).text((16-bbox[0],16-bbox[1]),source,font=font,fill=255)
    data=im.load();pixels={(x,y) for y in range(h) for x in range(w) if data[x,y]>90}
    if not pixels: raise ValueError('Missing glyph '+char)
    left=min(x for x,y in pixels);right=max(x for x,y in pixels);top=min(y for x,y in pixels);bottom=max(y for x,y in pixels);height=bottom-top+1
    dist=[[0.0]*w for _ in range(h)]
    for x,y in pixels:dist[y][x]=1e6
    for y in range(1,h-1):
        for x in range(1,w-1):
            if dist[y][x]:dist[y][x]=min(dist[y][x],dist[y-1][x]+1,dist[y][x-1]+1,dist[y-1][x-1]+1.4142,dist[y-1][x+1]+1.4142)
    for y in range(h-2,0,-1):
        for x in range(w-2,0,-1):
            if dist[y][x]:dist[y][x]=min(dist[y][x],dist[y+1][x]+1,dist[y][x+1]+1,dist[y+1][x+1]+1.4142,dist[y+1][x-1]+1.4142)
    skeleton=set(pixels)
    for iteration in range(100):
        removed=0
        for sub in (0,1):
            drop=[]
            for x,y in skeleton:
                n=[(x+dx,y+dy) in skeleton for dx,dy in dirs];count=sum(n)
                if count<2 or count>6:continue
                if sum((not n[i]) and n[(i+1)%8] for i in range(8))!=1:continue
                if sub==0:
                    if n[0] and n[2] and n[4]:continue
                    if n[2] and n[4] and n[6]:continue
                else:
                    if n[0] and n[2] and n[6]:continue
                    if n[0] and n[4] and n[6]:continue
                drop.append((x,y))
            skeleton.difference_update(drop);removed+=len(drop)
        if not removed:break
    graph={p:[] for p in skeleton}
    for x,y in skeleton:
        for dx,dy in dirs:
            q=(x+dx,y+dy)
            if q not in skeleton:continue
            # Suppress diagonal shortcuts where an orthogonal neighbor already connects.
            if dx and dy and ((x+dx,y) in skeleton or (x,y+dy) in skeleton):continue
            graph[(x,y)].append(q)
    visited=set();paths=[]
    starts=sorted(skeleton,key=lambda p:(len(graph[p])!=1,p[1],p[0]))
    edge=lambda a,b:tuple(sorted((a,b)))
    for start in starts:
        for nxt in graph[start]:
            if edge(start,nxt) in visited:continue
            chain=[start,nxt];visited.add(edge(start,nxt))
            while True:
                a,b=chain[-2:];choices=[c for c in graph[b] if edge(b,c) not in visited]
                if not choices:break
                dx,dy=b[0]-a[0],b[1]-a[1]
                q=max(choices,key=lambda c:((c[0]-b[0])*dx+(c[1]-b[1])*dy)/math.hypot(c[0]-b[0],c[1]-b[1]))
                visited.add(edge(b,q));chain.append(q)
                if len(chain)>3000:break
            if len(chain)<5:continue
            if chain[-1][1]<chain[0][1]-20:chain.reverse()
            paths.append(chain)
    max_radius=max(dist[y][x] for chain in paths for x,y in chain)
    paths.sort(key=lambda chain:(min(y for x,y in chain)//30,min(x for x,y in chain)))
    normalized=[]
    for chain in paths:
        sampled=chain[::3]
        if sampled[-1]!=chain[-1]:sampled.append(chain[-1])
        normalized.append([[round((x-(left+right)/2)/height,4),round((y-top)/height,4),round(max(.04,dist[y][x]/max_radius),4)] for x,y in sampled])
    result[char]={'paths':normalized,'width':round(max_radius/height,5),'aspect':round((right-left+1)/height,4),'height':round(height/250,4)}
    print(char,source,'paths',len(paths))
(root/'assets/glyphs.js').write_text('window.cursiveGlyphs='+json.dumps(result,ensure_ascii=False,separators=(',',':'))+';\n',encoding='utf-8')
