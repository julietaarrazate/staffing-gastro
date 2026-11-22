# Copia las capturas a remo/public/cap (JPEG salvo las barras, que llevan alfa) y anota tamaño y color de arriba.
import os, json, glob
from PIL import Image
AQUI=os.path.dirname(os.path.abspath(__file__)); SRC=os.path.join(AQUI,'../capturas'); DST=os.path.join(AQUI,'../public/cap'); os.makedirs(DST, exist_ok=True)
meta={}
def hacer(f, rel):
    im=Image.open(f)
    nombre=rel.replace('/','__')
    base=os.path.splitext(nombre)[0]
    if im.mode=='RGBA' and 'barra' in f:
        out=base+'.png'; im.save(os.path.join(DST,out), optimize=False)
    else:
        out=base+'.jpg'; im.convert('RGB').save(os.path.join(DST,out), quality=94, subsampling=0)
    rgb=im.convert('RGB'); px=rgb.getpixel((rgb.width//2,2))
    meta[base]={'f':'cap/'+out,'w':im.width,'h':im.height,'top':'#%02x%02x%02x'%px}
for f in sorted(glob.glob(SRC+'/*.png')): hacer(f, os.path.basename(f))
for d in sorted(glob.glob(SRC+'/rec/*')):
    if not os.path.isdir(d): continue
    n=os.path.basename(d)
    cuadros=json.load(open(d+'/cuadros.json'))
    lista=[]
    for c in cuadros:
        im=Image.open(os.path.join(d,c['f'])).convert('RGB')
        out=f'rec__{n}__{c["f"].replace(".jpg","")}.jpg'
        im.save(os.path.join(DST,out), quality=93, subsampling=0)
        lista.append({'f':'cap/'+out,'t':c['t']})
    meta['rec:'+n]={'cuadros':lista}
# la animación de ¡Oído! (tiempo de animación en el nombre)
anim=sorted(glob.glob(SRC+'/c-oido-anim-*.png'))
meta['seq:c-oido']={'cuadros':[{'f':meta[os.path.splitext(os.path.basename(a))[0]]['f'],'t':int(a.split('-')[-1].split('.')[0])/1000} for a in anim]}
json.dump(meta, open(os.path.join(AQUI,'../src/cap.json'),'w'), indent=0, ensure_ascii=False)
print(len(meta),'entradas')
