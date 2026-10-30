from PIL import Image, ImageDraw, ImageFont
from pathlib import Path
import math,json
ROOT=Path('/Users/260613a/Desktop/work/boba')
SRC=Path('/Users/260613a/.codex/generated_images/01a18a79-43bb-7311-88d0-d63e409d45c5')
OUT=ROOT/'assets/resources/art/sealer-animation-v1'
PRE=ROOT/'output/sealer-animation-v1'
SIZE=(1024,1024)
def blank(): return Image.new('RGBA',SIZE)
def load(name):
 im=Image.open(SRC/name).convert('RGBA'); return im.crop(im.getchannel('A').point(lambda a:255 if a>15 else 0).getbbox())
def put(im,box):
 out=blank(); out.alpha_composite(im.resize((box[2],box[3]),Image.Resampling.LANCZOS),box[:2]); return out
def save(im,name): im.save(OUT/(name+'.png')); return im
def region(im,box):
 out=blank(); out.paste(im.crop(box),box[:2]); return out
body=save(put(load('exec-a42ac8e1-2bbd-44d5-8b04-5828f62fcf8b.png'),(172,60,680,880)),'body')
# Front housing also acts as a mask over the moving piston.
fascia=save(region(body,(172,280,852,554)),'front_housing')
roll=load('exec-d31171cb-f18f-436d-b236-ec6933525abd.png').resize((470,205),Image.Resampling.LANCZOS)
# Move only the cylinder's printed surface, retain the end face, silhouette, and edge shading.
# Make the printed texture periodic before scrolling; blend its boundary once.
tile=roll.crop((90,12,452,193))
tp=tile.load()
for yy in range(32):
 for xx in range(tile.width):
  a=(yy+1)/32; c=tp[xx,149+yy]; d=tp[xx,yy]
  tp[xx,149+yy]=tuple(round(c[z]*(1-a)+d[z]*a) for z in range(4))
tile=tile.crop((0,32,tile.width,181)); tex=tile.load()
rolls=[]; films=[]
for k in range(6):
 im=roll.copy(); src=roll.load(); dst=im.load(); shift=round(k*170/6)
 for y in range(12,193):
  for x in range(90,451):
   sy=(y-12+round(k*149/6))%149
   a=min(1,(x-90)/12,(451-x)/12,(y-12)/10,(193-y)/10)
   old=src[x,y]; new=tex[x-90,sy]
   dst[x,y]=tuple(round(old[c]*(1-a)+new[c]*a) for c in range(3))+(old[3],)
 rolls.append(save(put(im,(275,68,470,205)),f'roll_{k:02d}'))
 # Film is a flat traveling strip. Crop the same printed material, not machine pixels.
 patch=im.crop((110,85,440,160)).resize((390,62),Image.Resampling.LANCZOS)
 films.append(save(put(patch,(337,264,390,62)),f'film_{k:02d}'))
# Restore stationary spindle supports in front of roll edges.
supports=blank()
for box in [(172,60,280,278),(738,60,852,278)]: supports.alpha_composite(region(body,box))
save(supports,'spindle_supports')
original=Image.open(ROOT/'assets/resources/art/machine-bin-parts/machine-idle.png').convert('RGBA')
pads=blank()
pads.alpha_composite(put(original.crop((240,451,273,478)),(364,774,37,25)))
pads.alpha_composite(put(original.crop((463,451,495,478)),(739,774,37,25)))
save(pads,'clamp_supports')
head=save(put(load('exec-ac8c2b86-1e99-4c4a-b4d6-ea9f82f190bb.png'),(395,410,350,280)),'press_head')
ring=put(load('exec-46d93384-a1bf-4a22-8bcd-59b6edf7256b.png'),(395,737,350,120))
# Split at the lateral tips of the ellipse. Rear half is always behind the cup.
back=save(region(ring,(395,737,745,789)),'clamp_back')
front=region(ring,(395,789,745,857))
fronts=[]; rings=[]
for k in range(6):
 f=front.copy(); pix=f.load(); progress=k/5
 for y in range(789,857):
  for x in range(395,745):
   # Telescoping arcs emerge from the side sleeves towards the front center.
   angle=math.atan2(max(0,y-789)/52,abs(x-570)/175)
   if angle > progress*math.pi/2: pix[x,y]=(0,0,0,0)
 fronts.append(save(f,f'clamp_front_{k:02d}'))
 whole=back.copy();whole.alpha_composite(f)
 rings.append(save(whole,f'clamp_full_{k:02d}'))
# Compositing proof: ring rear < sample cup < ring front < head < housing.
font=ImageFont.truetype('/System/Library/Fonts/Helvetica.ttc',22)
def assembled(k,down=0):
 a=body.copy();a.alpha_composite(films[k]);a.alpha_composite(rolls[k]);a.alpha_composite(supports)
 a.alpha_composite(pads);a.alpha_composite(back);a.alpha_composite(fronts[k]);a.alpha_composite(head,(0,down));a.alpha_composite(fascia)
 return a
sheet=Image.new('RGB',(1536,1080),'#E8DDC8')
for k in range(6):
 im=assembled(k,round(90*k/5));im.thumbnail((480,480))
 x=(k%3)*512+16;y=(k//3)*540+20;sheet.paste(im,(x,y),im)
 ImageDraw.Draw(sheet).text((x+120,y+485),f'{k:02d}  clamp {k*20}%',font=font,fill='#513B30')
sheet.save(PRE/'assembly-preview.jpg')
frames=[]
for k in list(range(6))+[5]*5+list(range(5,-1,-1))+[0]*4:
 a=Image.new('RGBA',SIZE,'#E8DDC8');a.alpha_composite(assembled(k,round(90*k/5)));a.thumbnail((512,512));frames.append(a.convert('RGB'))
frames[0].save(PRE/'motion-preview.gif',save_all=True,append_images=frames[1:],duration=90,loop=0)
for p in OUT.glob('*.png'):
 im=Image.open(p);assert im.size==SIZE and im.mode=='RGBA';assert im.getchannel('A').getextrema()[0]==0
print('Saved',len(list(OUT.glob('*.png'))),'transparent aligned sprites')
