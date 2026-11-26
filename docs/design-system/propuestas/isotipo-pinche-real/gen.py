# Propuesta del ícono (2026-11-24, sin decidir): el pinche de la cocina con varias comandas clavadas
# como vienen (giradas, con puntas que asoman) y la de arriba con «oído». No es la marca vigente:
# la vigente está en docs/design-system/marca/ (ver marca-hoy.md). Uso: python3 gen.py
# Escribe A-pila.svg, B-volumen.svg y C-real-<semilla>.svg en esta carpeta.
import math, os
D=os.path.dirname(os.path.abspath(__file__))
import re
# Las letras de «oído» ya convertidas a trazos salen del ícono vigente (docs/design-system/marca/).
_marca=open(os.path.join(D,"..","..","marca","isotipo-pinche.svg")).read()
LET=re.search(r'<path id="o-letras" d="([^"]+)"',_marca).group(1)
FONDO,REL,SEC="#1C5478","#0F3A5B","#9AC9E7"

def defs():
    return f'''<defs>
<radialGradient id="fondo" cx="70%" cy="18%" r="90%"><stop offset="0" stop-color="#2A6C97"/><stop offset=".55" stop-color="{FONDO}"/><stop offset="1" stop-color="#143F5E"/></radialGradient>
<linearGradient id="papel" x1="0" y1="0" x2=".35" y2="1"><stop offset="0" stop-color="#FFFFFF"/><stop offset=".7" stop-color="#F4F8FB"/><stop offset="1" stop-color="#DDE8F0"/></linearGradient>
<linearGradient id="papelViejo" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#F3EFE6"/><stop offset="1" stop-color="#D9D2C3"/></linearGradient>
<linearGradient id="doblez" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#C9D8E4"/><stop offset=".55" stop-color="#EEF4F8"/><stop offset="1" stop-color="#FFFFFF"/></linearGradient>
<linearGradient id="metal" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#6FA3C6"/><stop offset=".35" stop-color="#E8F4FB"/><stop offset=".6" stop-color="{SEC}"/><stop offset="1" stop-color="#4E86AD"/></linearGradient>
<radialGradient id="base" cx="50%" cy="40%" r="60%"><stop offset="0" stop-color="#B9DAEE"/><stop offset="1" stop-color="#5F95BB"/></radialGradient>
<filter id="sombra" x="-30%" y="-30%" width="160%" height="170%"><feGaussianBlur in="SourceAlpha" stdDeviation="9"/><feOffset dx="6" dy="12"/><feComponentTransfer><feFuncA type="linear" slope=".45"/></feComponentTransfer><feMerge><feMergeNode/><feMergeNode in="SourceGraphic"/></feMerge></filter>
<filter id="sombraChica" x="-30%" y="-30%" width="160%" height="170%"><feGaussianBlur in="SourceAlpha" stdDeviation="4"/><feOffset dx="3" dy="5"/><feComponentTransfer><feFuncA type="linear" slope=".35"/></feComponentTransfer><feMerge><feMergeNode/><feMergeNode in="SourceGraphic"/></feMerge></filter>
<path id="letras" d="{LET}"/>
</defs>'''

def troquel(x0,x1,y,n=14,h=7):
    w=(x1-x0)/n; d=f"M{x0} {y}"
    for i in range(n):
        d+=f" L{x0+w*(i+.5):.1f} {y-h} L{x0+w*(i+1):.1f} {y}"
    return d

def comanda(x,y,w,h,ang,cx,cy,relleno="url(#papel)",lineas=True,doblar=True,sombra="sombra",palabra=False,agujero=True):
    """Papel con borde de arriba troquelado, abajo un poco ondulado, esquina doblada y renglones."""
    x1,y1=x+w,y+h; f=38 if doblar else 0
    top=troquel(x,x1,y)
    d=(top+f" L{x1} {y1-f} L{x1-f} {y1} Q{x+w*.55:.0f} {y1+6} {x+w*.25:.0f} {y1-3} Q{x+w*.1:.0f} {y1-6} {x} {y1} Z")
    g=f'<g transform="rotate({ang} {cx} {cy})" filter="url(#{sombra})">'
    g+=f'<path d="{d}" fill="{relleno}"/>'
    # brillo a la izquierda (papel curvo)
    g+=f'<path d="M{x} {y} L{x+w*.12:.0f} {y} L{x+w*.12:.0f} {y1-2} L{x} {y1} Z" fill="#FFFFFF" opacity=".35"/>'
    if lineas:
        for i in range(4):
            yy=y+38+i*30
            if yy>y1-40: break
            g+=f'<path d="M{x+28} {yy} H{x+28+w*(.55 if i%2 else .75):.0f}" stroke="#9FB7C9" stroke-width="7" stroke-linecap="round" opacity=".7"/>'
    if palabra:
        g+=palabra
    if doblar:
        g+=f'<path d="M{x1} {y1-f} L{x1-f} {y1} L{x1-f+4} {y1-f+4} Z" fill="url(#doblez)"/>'
        g+=f'<path d="M{x1} {y1-f} L{x1-f+4} {y1-f+4}" stroke="#AFC4D4" stroke-width="2"/>'
    if agujero:
        g+=f'<ellipse cx="{cx}" cy="{y+14}" rx="9" ry="5" fill="#0F3A5B" opacity=".55"/>'
    return g+'</g>'

def palabra_oido(dx=0,dy=0,s=1.0):
    # letras originales centradas ~ (257,250); se escalan y llevan al centro de la comanda
    sh="".join(f'<use href="#letras" transform="translate({k} {k})" fill="#14456A" stroke="#14456A" stroke-width="3"/>' for k in [7,5.5,4,2.5])
    core=('<use href="#letras" transform="translate(2 2)" fill="#C98A1A"/>'
          '<use href="#letras" fill="#FFF4CC" stroke="#14456A" stroke-width="5" paint-order="stroke"/>')
    return f'<g transform="translate({dx} {dy}) translate(257 250) scale({s}) translate(-257 -250)">{sh}{core}</g>'

def marco(cuerpo):
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">{defs()}<rect width="512" height="512" rx="112" fill="url(#fondo)"/>{cuerpo}</svg>'

def pinche_base():
    return ('<ellipse cx="256" cy="446" rx="120" ry="28" fill="#0F3A5B" opacity=".55"/>'
            '<ellipse cx="256" cy="436" rx="116" ry="28" fill="url(#base)"/>'
            '<ellipse cx="256" cy="430" rx="98" ry="20" fill="#CFE6F4" opacity=".6"/>'
            '<rect x="247" y="120" width="18" height="316" rx="9" fill="url(#metal)"/>')

def pinche_punta(y0):
    return (f'<path d="M247 {y0} L247 70 L256 36 L265 70 L265 {y0} Z" fill="url(#metal)"/>'
            f'<path d="M253 {y0} L253 72 L256 46" stroke="#FFFFFF" stroke-width="2.5" fill="none" opacity=".8"/>')

def arrugada(cx,cy,ang):
    pts=[(-150,-40),(-90,-52),(-30,-44),(40,-56),(110,-46),(150,-30),(158,20),(120,44),(60,36),(0,50),(-70,40),(-130,48),(-158,10)]
    d="M"+" L".join(f"{cx+x} {cy+y}" for x,y in pts)+" Z"
    g=f'<g transform="rotate({ang} {cx} {cy})" filter="url(#sombra)"><path d="{d}" fill="url(#papelViejo)"/>'
    for (x1,y1,x2,y2) in [(-90,-52,-60,40),(40,-56,20,36),(110,-46,90,44),(-150,-40,-110,30)]:
        g+=f'<path d="M{cx+x1} {cy+y1} L{cx+x2} {cy+y2}" stroke="#B9AE98" stroke-width="3" opacity=".8"/>'
    return g+"</g>"

def variante_pila():
    c=pinche_base()
    # comandas viejas pisadas abajo: giradas, asomando por los costados, una arrugada
    c+=arrugada(250,392,-4)
    c+=comanda(70,330,290,100,-14,256,344,relleno="url(#papelViejo)",doblar=False)
    c+=comanda(150,318,290,104,11,256,332,relleno="url(#papelViejo)",doblar=False)
    c+=comanda(104,300,300,112,-4,256,314,relleno="url(#papel)",doblar=False)
    # la de arriba, con «oído»
    c+=comanda(78,138,356,200,-6,256,152,lineas=False,palabra=palabra_oido(-2,-2,1.0))
    c+=pinche_punta(154)
    return marco(c)

def variante_volumen():
    c=pinche_base()
    # una sola comanda grande con curva: el papel se dobla un poco hacia atrás arriba
    c+=comanda(70,140,372,230,-6,256,154,lineas=False,palabra=palabra_oido(0,10,1.08))
    # sombra del doblez superior (papel que cae hacia adelante)
    c+=pinche_punta(156)
    return marco(c)

for n,f in [("A-pila",variante_pila),("B-volumen",variante_volumen)]:
    open(os.path.join(D,n+".svg"),"w").write(f())
print("ok")

import random
def ticket(cx, cy, w, h, ang, sx=1.0, tono=("#FFFFFF","#E6EEF4"), oscuro=0.0, lineas=True, extra="", pin=(0.0,-0.3), uid="t"):
    """Una comanda clavada: centrada en (cx,cy), girada `ang`, achicada en x por la perspectiva `sx`.
    `pin`: dónde la atraviesa el pinche, relativo al centro (en fracciones de w y h)."""
    x0,y0=-w/2,-h/2; x1,y1=w/2,h/2
    top=troquel(x0,x1,y0,n=max(6,int(w/22)),h=6)
    f=min(26,w*.12)
    d=top+f" L{x1} {y1-f} L{x1-f} {y1} Q{x0+w*.5:.0f} {y1+5} {x0+w*.2:.0f} {y1-2} L{x0} {y1} Z"
    px,py=pin[0]*w,pin[1]*h
    g=(f'<linearGradient id="g{uid}" x1="0" y1="0" x2=".3" y2="1"><stop offset="0" stop-color="{tono[0]}"/><stop offset="1" stop-color="{tono[1]}"/></linearGradient>'
       f'<g transform="translate({cx} {cy}) rotate({ang}) scale({sx} 1) translate({-px} {-py})" filter="url(#sombra)">'
       f'<path d="{d}" fill="url(#g{uid})"/>'
       f'<path d="M{x0} {y0} L{x0+w*.1:.0f} {y0} L{x0+w*.1:.0f} {y1} L{x0} {y1} Z" fill="#FFFFFF" opacity=".3"/>')
    if lineas:
        yy=y0+30
        k=0
        while yy<y1-24:
            g+=f'<path d="M{x0+18} {yy} H{x0+18+(w-36)*(.5+.4*((k*37)%10)/10):.0f}" stroke="#8FA6B8" stroke-width="6" stroke-linecap="round" opacity=".55"/>'
            yy+=24; k+=1
    g+=extra
    g+=f'<path d="M{x1} {y1-f} L{x1-f} {y1} L{x1-f+3} {y1-f+3} Z" fill="url(#doblez)"/>'
    if oscuro>0: g+=f'<path d="{d}" fill="#0B2740" opacity="{oscuro:.2f}"/>'
    g+=f'<ellipse cx="{px}" cy="{py}" rx="8" ry="5" fill="#0F3A5B" opacity=".6"/>'
    return g+'</g>'

def variante_real(seed=7):
    rnd=random.Random(seed)
    c=pinche_base().replace('y="120"','y="96"').replace('height="316"','height="340"')
    tonos=[("#FBF8F1","#E3DCCB"),("#FFFFFF","#E2EAF0"),("#F6F1E6","#DCD3C0"),("#FFFFFF","#DFE8EF"),("#FAF6EE","#E6DECF")]
    capas=[]; n=9; lado=1
    for i in range(n):
        t=i/(n-1)
        cy=384-t*122 + rnd.uniform(-5,5)
        lado=-lado
        ang=lado*rnd.uniform(18,66)
        sx=rnd.choice([1,1,.8,.6])
        w=rnd.uniform(150,190); h=rnd.uniform(130,160)
        capas.append(ticket(256+lado*rnd.uniform(4,16),cy,w,h,ang,sx,tonos[i%len(tonos)],oscuro=.34*(1-t)+.03,pin=(rnd.uniform(-.12,.12),rnd.uniform(-.12,.08)),uid=f"r{i}"))
    c+="".join(capas)
    palabra='<g transform="translate(0 10) scale(.8) translate(-257 -250)">' + palabra_oido().replace('<g transform="translate(0 0) translate(257 250) scale(1.0) translate(-257 -250)">','<g>') + '</g>'
    c+=ticket(256,186,290,168,-8,1,("#FFFFFF","#E8F0F5"),lineas=False,extra=palabra,pin=(0,-.34),uid="top")
    c+=pinche_punta(130)
    return marco(c)

for seed in (3,7,11):
    open(os.path.join(D,f"C-real-{seed}.svg"),"w").write(variante_real(seed))
