# Regenerates OG image, favicon.ico, apple-touch-icon from data. Run: python3 scripts/make_images.py
import json; from PIL import Image, ImageDraw, ImageFont
d=json.load(open('public/data/cities.json'))['summary']
def F(s,b=True):
    for p in [f"/usr/share/fonts/truetype/dejavu/DejaVuSans{'-Bold' if b else ''}.ttf"]:
        try: return ImageFont.truetype(p,s)
        except: pass
    return ImageFont.load_default()
def car(dr,x,y,s):
    dr.polygon([(x,y+28*s),(x+12*s,y+14*s),(x+32*s,y+14*s),(x+44*s,y+28*s),(x+44*s,y+36*s),(x,y+36*s)],fill='#e31937')
    for cx in (x+11*s,x+33*s): dr.ellipse([cx-5*s,y+31*s,cx+5*s,y+41*s],fill='#e5e7eb')
im=Image.new('RGB',(1200,630),'#0b0f17');dr=ImageDraw.Draw(im)
car(dr,70,40,2.2);dr.text((185,70),"CabCount",font=F(52),fill='#e5e7eb')
dr.text((70,170),"Is Robotaxi coming",font=F(78),fill='#ffffff');dr.text((70,262),"to your city?",font=F(78),fill='#e31937')
for i,(v,l) in enumerate([(d['cities_live'],'cities live'),(f"{d['service_sq_mi']:,}",'sq mi service'),(d['cybercabs_registered'],'Cybercabs reg.')]):
    x=70+i*360;dr.rounded_rectangle([x,400,x+330,540],18,fill='#121826',outline='#1f2937',width=2)
    dr.text((x+24,412),str(v),font=F(64),fill='#ffffff');dr.text((x+26,492),l,font=F(28,False),fill='#94a3b8')
dr.text((70,568),f"cabcount.app  ·  updated {d['updated']}  ·  not affiliated with Tesla",font=F(24,False),fill='#64748b')
im.save('public/assets/og.png',optimize=True)
ic=Image.new('RGBA',(180,180),'#0b0f17');car(ImageDraw.Draw(ic),22,20,3.1);ic.save('public/assets/apple-touch-icon.png')
ic.resize((32,32),Image.LANCZOS).save('public/favicon.ico',sizes=[(32,32),(16,16)])
