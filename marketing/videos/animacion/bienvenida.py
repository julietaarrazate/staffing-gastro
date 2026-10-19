"""Genera bienvenida-comercio.html y bienvenida-trabajador.html: la misma
estructura (intro, 5 pasos de 4,5 s con barra de progreso, cierre) con el
contenido de cada rol. Los dos HTML salen de acá: para cambiar un paso, se
edita este archivo y se vuelve a correr (python3 bienvenida.py), no el HTML.

Cada paso muestra la pantalla de la app en su versión mínima, con los textos
reales de los botones ("Asignar", "Postularme", "Confirmar", "Llegué",
"Me fui", "Cerrar turno", "Marcar como pagado"). Si la app cambia un texto,
cambia acá también. Toma el <style> de anuncio.html."""
import os
os.chdir(os.path.dirname(os.path.abspath(__file__)))

anuncio = open("anuncio.html").read()
STYLE = anuncio[anuncio.index("<style>"):anuncio.index("</style>") + 8]
STYLE = STYLE.replace("</style>", """
@keyframes fromright{from{opacity:0;transform:translateX(60px)}to{opacity:1;transform:none}}
@keyframes cardin{from{opacity:0;transform:translateY(60px) scale(.96)}to{opacity:1;transform:none}}
@keyframes slidein{from{opacity:0;transform:translateX(70px)}to{opacity:1;transform:none}}
@keyframes slideout{to{opacity:0;transform:translateX(-70px)}}
@keyframes fill{from{transform:scaleX(0)}to{transform:scaleX(1)}}
@keyframes stamp{0%{opacity:0;transform:scale(1.6)}60%{opacity:1;transform:scale(.95)}100%{opacity:1;transform:scale(1)}}
@keyframes starin{0%{opacity:.25;transform:scale(1)}50%{opacity:1;transform:scale(1.35)}100%{opacity:1;transform:scale(1)}}
#stage .card{background:#fff;border-radius:22px;box-shadow:0 14px 34px rgba(60,40,10,.10);padding:16px}
#stage .row{display:flex;align-items:center;gap:12px}
#stage .chip{display:inline-flex;align-items:center;gap:6px;border-radius:99px;padding:7px 13px;font-size:14px;font-weight:600}
#stage .btn{border-radius:16px;padding:14px;text-align:center;font-size:16px;font-weight:600}
#stage .mut{font-size:13px;color:#6b6358;font-family:var(--font-dm-mono),monospace}
#stage .av2{width:44px;height:44px;border-radius:99px;display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:700;flex:none}
#stage .pin .av{width:40px;height:40px;border-radius:99px;border:3px solid #fff;box-shadow:0 8px 18px rgba(40,30,10,.22);display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700}
</style>""")

STEP0, STEP = 3.75, 4.5
S = [STEP0 + STEP * k for k in range(5)]
CLOSE = STEP0 + STEP * 5  # 26.25

def a(name, dur, at, extra=""):
    return f"animation-name:{name};animation-duration:{dur}s;animation-delay:{at:.2f}s;{extra}"

CHECK = '<svg class="i" style="width:15px;height:15px;stroke-width:3" viewBox="0 0 24 24"><path d="M20 6 9 17l-5-5"/></svg>'
PIN = '<svg class="i" style="width:15px;height:15px" viewBox="0 0 24 24"><path d="M20 10c0 4.99-5.54 10.19-7.4 11.8a1 1 0 0 1-1.2 0C9.54 20.19 4 14.99 4 10a8 8 0 0 1 16 0"/><circle cx="12" cy="10" r="3"/></svg>'
CLOCK = '<svg class="i" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>'
BAG = '<svg class="i" viewBox="0 0 24 24"><path d="M16 20V4a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/><rect width="20" height="14" x="2" y="6" rx="2"/></svg>'
CASH = '<svg class="i" viewBox="0 0 24 24"><rect width="20" height="12" x="2" y="6" rx="2"/><circle cx="12" cy="12" r="2"/><path d="M6 12h.01M18 12h.01"/></svg>'
SPARK = '<svg class="i" style="width:15px;height:15px" viewBox="0 0 24 24"><path d="M9.94 15.5A2 2 0 0 0 8.5 14.06l-6.14-1.58a.5.5 0 0 1 0-.96L8.5 9.94A2 2 0 0 0 9.94 8.5l1.58-6.14a.5.5 0 0 1 .96 0L14.06 8.5A2 2 0 0 0 15.5 9.94l6.14 1.58a.5.5 0 0 1 0 .96L15.5 14.06a2 2 0 0 0-1.44 1.44l-1.58 6.14a.5.5 0 0 1-.96 0z"/></svg>'
LOGO_TILE = '<div style="width:34px;height:34px;background:#fff;-webkit-mask:url(/logo-figure.svg) center/contain no-repeat;mask:url(/logo-figure.svg) center/contain no-repeat"></div>'

def field(icon_bg, icon_fg, icon, label, value, at, dark=False):
    bg = "background:#1B3A31;color:#fff;" if dark else "background:#fff;border:1px solid #efe9dc;"
    lab = "color:#F1E7A0;opacity:.85" if dark else "color:#8a8175"
    return f'''<div class="A row" style="{bg}border-radius:16px;padding:11px 12px;{a("fromright", .45, at)}">
        <span style="display:flex;width:36px;height:36px;border-radius:12px;background:{icon_bg};color:{icon_fg};align-items:center;justify-content:center">{icon}</span>
        <div><div class="mono" style="font-size:10px;{lab}">{label}</div><div style="font-size:16px;font-weight:600">{value}</div></div></div>'''

def streets(t0, box_w=496, box_h=420):
    return f'''<svg viewBox="0 0 {box_w} {box_h}" width="{box_w}" height="{box_h}" style="position:absolute;inset:0">
        <path d="M400 -10 L520 -30 L520 150 L430 170 Z" fill="#DCE6D2"/>
        <g fill="none" stroke="#fff" stroke-linecap="round">
          <path class="A" pathLength="1" stroke-dasharray="1" stroke-width="14" d="M-20 210 L520 210" style="{a("draw", .8, t0)}"/>
          <path class="A" pathLength="1" stroke-dasharray="1" stroke-width="14" d="M200 -20 L200 440" style="{a("draw", .8, t0 + .05)}"/>
          <path class="A" pathLength="1" stroke-dasharray="1" stroke-width="10" d="M-30 420 L520 20" style="{a("draw", .9, t0 + .1)}"/>
          <path class="A" pathLength="1" stroke-dasharray="1" stroke-width="7" d="M-20 60 L520 60 M-20 130 L520 130 M-20 290 L520 290 M-20 360 L520 360" style="{a("draw", .8, t0 + .1)}"/>
          <path class="A" pathLength="1" stroke-dasharray="1" stroke-width="7" d="M40 -20 L40 440 M120 -20 L120 440 M280 -20 L280 440 M360 -20 L360 440 M440 -20 L440 440" style="{a("draw", .8, t0 + .15)}"/>
        </g></svg>'''

def pin(x, y, ini, bg, fg, at):
    return f'<div class="abs A pin" style="left:{x}px;top:{y}px;{a("pinpop", .45, at)}"><div class="av" style="background:{bg};color:{fg}">{ini}</div></div>'

def local_tile(x, y, at):
    return f'''<div class="abs A" style="left:{x-26}px;top:{y-26}px;width:52px;height:52px;border-radius:17px;background:#D97706;box-shadow:0 10px 24px rgba(217,119,6,.45);display:flex;align-items:center;justify-content:center;{a("pop", .45, at)}">{LOGO_TILE}</div>'''

def rings(x, y, t0, n=2):
    return "".join(f'<div class="abs A" style="left:{x}px;top:{y}px;width:90px;height:90px;border-radius:99px;border:2px solid #D97706;animation:ring 1.5s ease-out {t0 + i * .5:.2f}s infinite both"></div>' for i in range(n))

# ── pasos de cada video ─────────────────────────────────────────────────────
def comercio_steps():
    s1, s2, s3, s4, s5 = S
    return [
        ("c02", "Publicá el turno|en una *frase.*", f'''
      <div class="card" style="padding:18px">
        <div class="row" style="font-size:13px;font-weight:600;color:#55504a;gap:8px"><span style="display:flex;width:26px;height:26px;border-radius:9px;background:#FDEBD0;color:#B45309;align-items:center;justify-content:center">{SPARK}</span>Describí el turno</div>
        <div style="margin-top:10px;background:#FBFAF6;border:1.5px solid #e7e1d4;border-radius:16px;padding:12px 14px;min-height:78px;font-size:17px;line-height:1.4;color:#111"><span id="typed"></span><span id="caret" style="display:inline-block;width:2px;height:20px;background:#D97706;vertical-align:-3px;margin-left:1px"></span></div>
        <div style="display:grid;gap:8px;margin-top:12px">
          {field("#FBEFC4", "#7A5A00", BAG, "Puesto", "Bartender", s1 + 2.35)}
          {field("#DCEAF4", "#1F5B85", CLOCK, "Horario", "Sábado · 20:00 a 02:00", s1 + 2.5)}
          {field("rgba(241,231,160,.16)", "#F1E7A0", CASH, "Pago", '<span style="font-family:var(--font-dm-mono),monospace;font-size:19px"><span style="color:#F59E0B">$</span>50.000</span>', s1 + 2.65, dark=True)}
        </div>
        <div class="A btn" style="margin-top:12px;background:#D97706;color:#fff;animation:up .4s cubic-bezier(.2,.8,.2,1) {s1 + 2.9:.2f}s both, press .3s ease {s1 + 3.4:.2f}s">Publicar turno</div>
      </div>
      <div class="abs A row" style="left:40px;right:40px;top:-18px;background:#1B3A31;color:#fff;border-radius:16px;padding:12px 14px;gap:10px;font-size:15px;font-weight:600;box-shadow:0 12px 30px rgba(0,0,0,.25);{a("pop", .45, s1 + 3.6)}"><span style="display:flex;width:26px;height:26px;border-radius:99px;background:#F1E7A0;color:#1B3A31;align-items:center;justify-content:center">{CHECK}</span>Turno publicado</div>'''),
        ("c03", "Le avisamos a quien|está *cerca.*", f'''
      <div class="A" style="position:relative;height:420px;border-radius:30px;background:#EFEADF;overflow:hidden;{a("pop", .5, s2 + .15)}">
        {streets(s2 + .3)}
        {rings(248, 210, s2 + .8, 3)}
        {local_tile(248, 210, s2 + .5)}
        {pin(90, 110, "LM", "#FBEFC4", "#7A5A00", s2 + 1.4)}
        {pin(400, 300, "DR", "#DCEAF4", "#1F5B85", s2 + 1.7)}
        {pin(360, 90, "CP", "#E3EFE8", "#1B3A31", s2 + 2.0)}
        {pin(70, 330, "JT", "#F6DDD6", "#8A2E1B", s2 + 2.2)}
        <div class="abs A" style="right:14px;top:14px;background:#111;color:#fff;border-radius:99px;padding:8px 14px;font-size:14px;font-weight:600;{a("pop", .4, s2 + 2.5)}"><span id="count">1</span> <span id="countLabel">postulante</span></div>
      </div>'''),
        ("c04", "Elegís a quién, viendo|su *reputación.*", f'''
      <div class="mono A" style="font-size:12px;color:#8a8175;margin:0 0 10px 4px;{a("fade", .4, s3 + .2)}">Candidatos</div>
      <div style="display:grid;gap:10px">
        <div class="card row A" style="position:relative;{a("cardin", .45, s3 + .3)}"><div class="av2" style="background:#FBEFC4;color:#7A5A00">LM</div><div style="flex:1"><div style="font-size:17px;font-weight:600">Lucía M.</div><div class="mut"><span style="color:#D97706">★</span> 4,9 · 1,2 km · 38 turnos</div></div><div class="A btn" style="background:#D97706;color:#fff;padding:9px 14px;font-size:14px;border-radius:12px;{a("press", .3, s3 + 3.0)}">Asignar</div>
          <div class="abs A row" style="inset:0;border-radius:22px;background:#1B3A31;color:#fff;justify-content:center;gap:10px;font-weight:600;{a("stamp", .45, s3 + 3.25)}"><span style="display:flex;width:26px;height:26px;border-radius:99px;background:#F1E7A0;color:#1B3A31;align-items:center;justify-content:center">{CHECK}</span>Asignado · Lucía M.</div></div>
        <div class="card row A" style="{a("cardin", .45, s3 + .5)}"><div class="av2" style="background:#DCEAF4;color:#1F5B85">DR</div><div style="flex:1"><div style="font-size:17px;font-weight:600">Diego R.</div><div class="mut"><span style="color:#D97706">★</span> 4,8 · 2,0 km · 21 turnos</div></div></div>
        <div class="card row A" style="{a("cardin", .45, s3 + .7)}"><div class="av2" style="background:#E3EFE8;color:#1B3A31">CP</div><div style="flex:1"><div style="font-size:17px;font-weight:600">Caro P.</div><div class="mut"><span style="color:#D97706">★</span> 5,0 · 800 m · 12 turnos</div></div></div>
      </div>'''),
        ("c05", "Lo ves llegar|en el *mapa.*", f'''
      <div class="A" style="position:relative;height:330px;border-radius:30px;background:#EFEADF;overflow:hidden;{a("pop", .5, s4 + .15)}">
        {streets(s4 + .25, 496, 330)}
        <svg viewBox="0 0 496 330" width="496" height="330" style="position:absolute;inset:0"><path class="A" d="M40 60 L120 60 L120 210 L360 210" fill="none" stroke="#D97706" stroke-width="6" stroke-linecap="round" stroke-linejoin="round" pathLength="1" stroke-dasharray="1" style="{a("draw", 2.4, s4 + .8, "animation-timing-function:cubic-bezier(.45,0,.3,1)")}"/></svg>
        {local_tile(360, 210, s4 + .45)}
        <div class="abs A" style="left:0;top:0;width:20px;height:20px;margin:-10px 0 0 -10px;border-radius:99px;background:#F59E0B;box-shadow:0 0 0 7px rgba(245,158,11,.3);offset-path:path('M40 60 L120 60 L120 210 L360 210');offset-rotate:0deg;animation:fade .2s ease {s4 + .8:.2f}s both, travel 2.4s cubic-bezier(.45,0,.3,1) {s4 + .8:.2f}s both"></div>
      </div>
      <div class="card row A" style="margin-top:12px;{a("cardin", .45, s4 + .6)}"><div class="av2" style="background:#FBEFC4;color:#7A5A00">LM</div>
        <div style="flex:1;position:relative;height:40px"><div class="abs A" style="left:0;top:0;animation:outfade .25s ease {s4 + 3.2:.2f}s forwards"><div style="font-size:17px;font-weight:600">Lucía va en camino</div><div class="mut">Llega 20:56</div></div>
          <div class="abs A" style="left:0;top:0;{a("up", .4, s4 + 3.3)}"><div style="font-size:17px;font-weight:600">Llegó al local</div><div class="mut">20:55</div></div></div></div>'''),
        ("c06", "Cerrás el turno, lo pagás|y lo *calificás.*", f'''
      <div class="card A" style="padding:18px;{a("cardin", .45, s5 + .2)}">
        <div class="row"><div class="av2" style="background:#FBEFC4;color:#7A5A00">LM</div><div><div style="font-size:17px;font-weight:600">Bartender · Lucía M.</div><div class="mut">Sábado · 20:00 a 02:00</div></div></div>
        <div style="position:relative;height:110px;margin-top:14px">
          <div class="abs A" style="left:0;right:0;top:0;animation:outfade .2s ease {s5 + 1.25:.2f}s forwards"><div style="font-size:15px;color:#55504a">Terminó de trabajar.</div><div class="A btn" style="margin-top:10px;background:#D97706;color:#fff;{a("press", .3, s5 + 1.0)}">Cerrar turno</div></div>
          <div class="abs A" style="left:0;right:0;top:0;animation:up .35s cubic-bezier(.2,.8,.2,1) {s5 + 1.3:.2f}s both, outfade .2s ease {s5 + 2.25:.2f}s forwards"><div style="font-size:15px;color:#55504a">Falta registrar el pago.</div><div class="A btn" style="margin-top:10px;background:#1B3A31;color:#fff;{a("press", .3, s5 + 2.0)}">Marcar como pagado</div></div>
          <div class="abs A" style="left:0;right:0;top:0;{a("up", .35, s5 + 2.3)}"><div style="font-size:15px;color:#1B3A31;font-weight:600">Listo: trabajado y pagado.</div>
            <div class="mono" style="font-size:11px;color:#8a8175;margin-top:12px">Calificar este turno</div>
            <div style="display:flex;gap:6px;margin-top:6px;font-size:30px;color:#D97706">{"".join(f'<span class="A" style="display:inline-block;{a("starin", .35, s5 + 2.6 + i * .12)}">★</span>' for i in range(5))}</div></div>
        </div>
      </div>
      <div class="c mono A" style="margin-top:16px;font-size:11px;color:#8a8175;letter-spacing:.08em;{a("fade", .5, s5 + 1.4)}">En la beta, el pago se arregla fuera de la app</div>'''),
    ]

def trabajador_steps():
    s1, s2, s3, s4, s5 = S
    skills = ["Mozo/a", "Bartender", "Barista", "Runner", "Cocinero/a", "Cajero/a"]
    elegidas = {"Mozo/a": s1 + 2.3, "Bartender": s1 + 2.75}
    chips = ""
    for i, sk in enumerate(skills):
        base = f'<span class="chip A" style="position:relative;background:#fff;color:#55504a;box-shadow:inset 0 0 0 1px #e7e1d4;{a("up", .35, s1 + 1.3 + i * .08)}">{sk}'
        if sk in elegidas:
            base += f'<span class="abs chip A" style="inset:0;justify-content:center;background:#D97706;color:#fff;{a("stamp", .35, elegidas[sk])}">{sk}</span>'
        chips += base + "</span>"
    return [
        ("t02", "Contanos dónde|y qué sabés *hacer.*", f'''
      <div class="card" style="padding:18px">
        <div class="serif" style="font-size:22px">¿Dónde querés trabajar?</div>
        <div class="chip A" style="margin-top:10px;background:#DCEAF4;color:#1F5B85;{a("pop", .4, s1 + .8)}">{PIN}Palermo, CABA</div>
        <div class="serif A" style="font-size:22px;margin-top:22px;{a("fade", .4, s1 + 1.1)}">¿Qué sabés hacer?</div>
        <div style="display:flex;flex-wrap:wrap;gap:8px;margin-top:10px">{chips}</div>
      </div>'''),
        ("t03", "Te llegan turnos cerca,|con el pago a la *vista.*", f'''
      <div class="card A" style="padding:18px;{a("cardin", .5, s2 + .2)}">
        <div class="row" style="justify-content:space-between"><div><div class="mono" style="font-size:11px;color:#8a8175">Bar El Patio · 1,2 km</div><div class="serif" style="font-size:26px;margin-top:4px">Mozo/a</div></div><span class="chip" style="background:#FBEFC4;color:#7A5A00">Hoy</span></div>
        <div class="row" style="margin-top:10px;color:#55504a;font-size:15px;gap:8px">{CLOCK}21:00 a 02:00</div>
        <div class="A" style="margin-top:14px;background:#1B3A31;border-radius:18px;padding:14px 16px;color:#fff;{a("pop", .45, s2 + 1.2)}"><div class="mono" style="font-size:10px;color:#F1E7A0;opacity:.85">Pago</div><div style="font-family:var(--font-dm-mono),monospace;font-size:30px"><span style="color:#F59E0B">$</span>45.000</div></div>
        <div style="position:relative;margin-top:14px"><div class="A btn" style="background:#D97706;color:#fff;{a("press", .3, s2 + 3.0)}">Postularme</div>
          <div class="abs A btn row" style="inset:0;justify-content:center;gap:8px;background:#1B3A31;color:#fff;{a("stamp", .4, s2 + 3.2)}">{CHECK}Te postulaste</div></div>
      </div>'''),
        ("t04", "Si te eligen,|*confirmás.*", f'''
      <div class="A row" style="background:#111;color:#fff;border-radius:18px;padding:12px 14px;gap:10px;box-shadow:0 14px 30px rgba(0,0,0,.25);{a("pop", .5, s3 + .3, "transform-origin:50% 0")}"><div style="width:30px;height:30px;border-radius:9px;background:#D97706;display:flex;align-items:center;justify-content:center"><div style="width:20px;height:20px;background:#fff;-webkit-mask:url(/logo-figure.svg) center/contain no-repeat;mask:url(/logo-figure.svg) center/contain no-repeat"></div></div><div style="font-size:15px;font-weight:600">Bar El Patio te asignó el turno</div></div>
      <div class="card A" style="margin-top:14px;padding:18px;{a("cardin", .45, s3 + .8)}">
        <div class="mono" style="font-size:11px;color:#8a8175">Mozo/a · Hoy 21:00 a 02:00</div>
        <div class="serif" style="font-size:24px;margin-top:4px">Bar El Patio</div>
        <div style="position:relative;display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:14px">
          <div class="A btn" style="background:#D97706;color:#fff;{a("press", .3, s3 + 2.6)}">Confirmar</div><div class="btn" style="background:#F3EFE6;color:#55504a">Rechazar</div>
          <div class="abs A btn row" style="inset:0;justify-content:center;gap:8px;background:#1B3A31;color:#fff;{a("stamp", .4, s3 + 2.85)}">{CHECK}Confirmado</div></div>
      </div>'''),
        ("t05", "Al llegar tocás *Llegué*,|y al irte, *Me* *fui.*", f'''
      <div class="card A" style="padding:18px;{a("cardin", .45, s4 + .2)}">
        <div class="mono" style="font-size:11px;color:#8a8175">Mozo/a · Bar El Patio</div>
        <div class="serif" style="font-size:24px;margin-top:4px">Hoy 21:00 a 02:00</div>
        <div style="position:relative;height:60px;margin-top:14px">
          <div class="abs A btn" style="left:0;right:0;top:0;background:#D97706;color:#fff;animation:press .3s ease {s4 + 1.7:.2f}s, outfade .2s ease {s4 + 1.95:.2f}s forwards">Llegué</div>
          <div class="abs A btn" style="left:0;right:0;top:0;background:#1B3A31;color:#fff;animation:up .35s cubic-bezier(.2,.8,.2,1) {s4 + 2.0:.2f}s both, press .3s ease {s4 + 3.2:.2f}s">Me fui</div>
        </div>
        <div class="btn" style="margin-top:10px;background:#F3EFE6;color:#55504a;font-size:14px;padding:11px">Voy en camino <span style="color:#8a8175;font-weight:400">(opcional)</span></div>
        <div style="display:grid;gap:6px;margin-top:14px;min-height:46px">
          <div class="A mut row" style="gap:8px;{a("up", .35, s4 + 1.95)}"><span style="color:#1B3A31">{CHECK}</span>Llegaste · 20:55</div>
          <div class="A mut row" style="gap:8px;{a("up", .35, s4 + 3.45)}"><span style="color:#1B3A31">{CHECK}</span>Terminaste · 02:03</div>
        </div>
      </div>'''),
        ("t06", "Cobrás y sumás|*reputación.*", f'''
      <div class="card A" style="padding:18px;{a("cardin", .45, s5 + .2)}">
        <div class="row" style="justify-content:space-between"><div><div class="mono" style="font-size:11px;color:#8a8175">Bar El Patio · Mozo/a</div><div style="font-family:var(--font-dm-mono),monospace;font-size:34px;margin-top:6px"><span style="color:#D97706">$</span><span id="monto">0</span></div></div>
          <span class="chip A" style="background:#E3EFE8;color:#1B3A31;{a("stamp", .4, s5 + 1.6)}">{CHECK}Pagado</span></div>
        <div style="height:1px;background:#efe9dc;margin:16px 0"></div>
        <div class="mono" style="font-size:11px;color:#8a8175">Te calificaron</div>
        <div style="display:flex;gap:6px;margin-top:6px;font-size:30px;color:#D97706">{"".join(f'<span class="A" style="display:inline-block;{a("starin", .35, s5 + 2.0 + i * .12)}">★</span>' for i in range(5))}</div>
        <div style="display:flex;gap:8px;margin-top:14px;flex-wrap:wrap"><span class="chip A" style="background:#FBEFC4;color:#7A5A00;{a("pop", .4, s5 + 2.9)}">Puntualidad 100%</span><span class="chip A" style="background:#F3EFE6;color:#55504a;{a("pop", .4, s5 + 3.1)}">+1 turno completado</span></div>
      </div>
      <div class="c mono A" style="margin-top:16px;font-size:11px;color:#8a8175;letter-spacing:.08em;{a("fade", .5, s5 + 1.8)}">En la beta, el pago se arregla con el comercio</div>'''),
    ]

def build(nombre, rol, pre, steps, cta_id, cta_txt, js_note):
    out = [f'''<!-- Bienvenida {rol} (9:16, 30 s): intro, 5 pasos de 4,5 s y cierre.
     Cada paso muestra la pantalla real de la app en su versión mínima, con
     los mismos textos de los botones. Los tiempos siguen a {nombre}.guion.json
     (con voz o sin ella). {js_note} -->
{STYLE}
<div id="stage" style="background:#FBFAF6">

  <!-- intro (0–3,75 s): la marca y el rol -->
  <div class="scene oscuro" id="s0" style="background:#D97706;animation:outfade .01s linear {STEP0 + .3:.2f}s forwards">
    <div class="abs A" style="left:205px;top:230px;width:130px;height:130px;background:#fff;-webkit-mask:url(/logo-figure.svg) center/contain no-repeat;mask:url(/logo-figure.svg) center/contain no-repeat;{a("pop", .6, .1)}"></div>
    <div class="abs c mono A" style="top:392px;font-size:14px;color:#FFF4D6;{a("fade", .5, .35)}">{rol}</div>
    <div class="abs c serif" style="top:424px;font-size:48px;line-height:1.08;color:#fff" data-v="{pre}01">Te damos la|bienvenida a *Oído.*</div>
    <div class="abs c A" style="top:560px;font-size:20px;color:#fff;opacity:.9;{a("up", .5, 2.6)}">Así funciona, en 5 pasos.</div>
  </div>
  <div class="scene A" style="background:#FBFAF6;{a("wipeup", .55, STEP0 - .2, "animation-timing-function:cubic-bezier(.7,0,.3,1)")}"></div>

  <!-- barra de progreso: 5 tramos que se llenan con cada paso -->
  <div class="abs A" style="left:40px;right:40px;top:78px;display:grid;grid-template-columns:repeat(5,1fr);gap:6px;animation:fade .4s ease {STEP0 + .1:.2f}s both, outfade .3s ease {CLOSE - .3:.2f}s forwards">
    {"".join(f'<div style="height:5px;border-radius:9px;background:#E7E1D4;overflow:hidden"><div class="A" style="height:100%;background:#D97706;transform-origin:0 50%;{a("fill", .6, S[k] + .1, "animation-timing-function:cubic-bezier(.4,0,.2,1)")}"></div></div>' for k in range(5))}
  </div>
''']
    for k, (lid, titulo, mock) in enumerate(steps):
        s = S[k]
        e = s + STEP
        out.append(f'''
  <!-- paso {k + 1} ({s:.2f}–{e:.2f} s) -->
  <div class="scene A" id="p{k + 1}" style="animation:slidein .5s cubic-bezier(.2,.8,.2,1) {s:.2f}s both, slideout .35s cubic-bezier(.6,0,.4,1) {e - .3:.2f}s forwards">
    <div class="abs mono" style="left:40px;top:110px;font-size:13px;color:#B45309">Paso {k + 1} de 5</div>
    <div class="abs serif" style="left:40px;right:30px;top:138px;font-size:40px;line-height:1.1;color:#111" data-v="{lid}">{titulo}</div>
    <div class="abs" style="left:22px;right:22px;top:345px">{mock}
    </div>
  </div>''')
    out.append(f'''

  <!-- cierre ({CLOSE:.2f}–30 s): ondas del oído → verde, llamado a la acción -->
  <div class="abs wave" style="--wc:#D97706;left:270px;top:480px;animation-delay:{CLOSE - .35:.2f}s"></div>
  <div class="abs wave" style="--wc:#F59E0B;left:270px;top:480px;animation-delay:{CLOSE - .23:.2f}s"></div>
  <div class="abs wave" style="--wc:#B45309;left:270px;top:480px;animation-delay:{CLOSE - .11:.2f}s"></div>
  <div class="scene A" style="--x:50%;--y:50%;background:#1B3A31;{a("circ", .6, CLOSE - .15, "animation-timing-function:cubic-bezier(.7,0,.3,1)")}"></div>
  <div class="scene oscuro" id="fin" style="animation:fade .01s linear {CLOSE:.2f}s both">
    <img class="abs A" src="/logo-mark.svg" style="left:210px;top:230px;width:120px;height:120px;{a("pop", .6, CLOSE + .15)}">
    <div class="abs c serif" style="top:392px;font-size:44px;line-height:1.1;color:#fff" data-v="{cta_id}">{cta_txt}</div>
    <div class="abs A" style="left:130px;right:130px;top:520px;background:#D97706;color:#fff;border-radius:99px;padding:14px;text-align:center;font-family:var(--font-dm-mono),monospace;font-size:20px;letter-spacing:.04em;{a("up", .5, CLOSE + 2.0)}">oido.com.ar</div>
  </div>

  <!-- tratamiento de color común a todo: viñeta cálida + grano -->
  <div class="scene" style="pointer-events:none;background:radial-gradient(130% 90% at 50% 45%,rgba(0,0,0,0) 60%,rgba(40,22,6,.18) 100%)"></div>
  <svg class="abs" width="540" height="960" style="left:0;top:0;pointer-events:none;opacity:.07;mix-blend-mode:overlay">
    <filter id="grain"><feTurbulence id="grainT" type="fractalNoise" baseFrequency=".9" numOctaves="2" seed="1"/><feColorMatrix type="saturate" values="0"/></filter>
    <rect width="540" height="960" filter="url(#grain)"/>
  </svg>
</div>
''')
    open(f"{nombre}.html", "w").write("".join(out))

build("bienvenida-comercio", "Para comercios", "c", comercio_steps(), "c07", "Publicá tu|*primer* turno.",
      "bienvenida-comercio.js: el tipeo y el contador de postulantes.")
build("bienvenida-trabajador", "Para trabajadores", "t", trabajador_steps(), "t07", "Elegí tu zona|y *empezá.*",
      "bienvenida-trabajador.js: el monto que sube.")
print("bienvenida-comercio.html y bienvenida-trabajador.html:", "pasos en", S, "· cierre en", CLOSE)
