"""Genera instalar-android.html e instalar-iphone.html: cómo tener Oído en el
celular (sin tienda de apps) y activar los avisos. Misma estructura en los
dos: intro, 4 pasos para instalar, 2 para los avisos, cierre. Los dos HTML
salen de acá: para cambiar un paso se edita este archivo y se vuelve a
correr (python3 instalar.py), no el HTML.

Sin tecnicismos a propósito: nada de "PWA", "navegador" ni "permisos". Los
textos de la app son los reales: la hoja "Activá las notificaciones" con
"Ahora no" / "Activar" (lib/push-prompt-context.tsx), que aparece después de
publicar el primer turno o de la primera postulación, y la fila
"Notificaciones push" de Perfil → Ajustes (components/PushToggle.tsx, en
/profile/settings desde el #396). En iPhone los
avisos sólo funcionan con Oído abierto desde el ícono (en Safari común la app
ni los ofrece: isPushSupported da falso), por eso ahí se insiste en el ícono.

Los menús de Chrome y de Safari se dibujan simplificados, con los nombres de
sus opciones en español ("Instalar app", "Agregar a pantalla de inicio"): si
el sistema los cambia, cambian acá."""
import os

os.chdir(os.path.dirname(os.path.abspath(__file__)))

anuncio = open("anuncio.html").read()
STYLE = anuncio[anuncio.index("<style>"):anuncio.index("</style>") + 8].replace("</style>", """
@keyframes fromright{from{opacity:0;transform:translateX(60px)}to{opacity:1;transform:none}}
@keyframes slidein{from{opacity:0;transform:translateX(70px)}to{opacity:1;transform:none}}
@keyframes slideout{to{opacity:0;transform:translateX(-70px)}}
@keyframes fill{from{transform:scaleX(0)}to{transform:scaleX(1)}}
@keyframes sheetup{from{transform:translateY(105%)}to{transform:none}}
@keyframes drop{from{opacity:0;transform:scale(.85);transform-origin:100% 0}to{opacity:1;transform:none}}
@keyframes tap{0%{opacity:0;transform:translate(-50%,-50%) scale(1.8)}25%{opacity:.9;transform:translate(-50%,-50%) scale(1)}70%{opacity:.9;transform:translate(-50%,-50%) scale(.85)}100%{opacity:0;transform:translate(-50%,-50%) scale(1.2)}}
@keyframes glowrow{0%,100%{background:#fff}50%{background:#FDEBD0}}
#stage .tap{position:absolute;width:44px;height:44px;border-radius:99px;background:rgba(217,119,6,.35);border:3px solid #D97706;animation:tap .75s ease both}
#stage .scr{position:absolute;inset:0}
#stage .ico{width:44px;height:44px;border-radius:12px}
</style>""")

PASOS = [3.0, 6.75, 10.5, 14.25, 18.0, 23.25]   # el 5.º dura 5,25 s: pasa más cosas
CIERRE = 27.0
DUR = 30.0


def a(name, dur, at, extra=""):
    return f"animation-name:{name};animation-duration:{dur}s;animation-delay:{at:.2f}s;{extra}"


def ventana(desde, hasta, extra=""):
    """Capa de pantalla visible entre dos instantes."""
    return f"animation:fade .2s ease {desde:.2f}s both, outfade .2s ease {hasta - .2:.2f}s forwards;{extra}"


def tap(x, y, at):
    return f'<div class="tap" style="left:{x}px;top:{y}px;animation-delay:{at:.2f}s"></div>'


LOGO = "-webkit-mask:url(/logo-figure.svg) center/contain no-repeat;mask:url(/logo-figure.svg) center/contain no-repeat"
CHECK = '<svg class="i" style="width:15px;height:15px;stroke-width:3" viewBox="0 0 24 24"><path d="M20 6 9 17l-5-5"/></svg>'
BELL = '<svg class="i" viewBox="0 0 24 24"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></svg>'
SHARE = '<svg class="i" style="width:22px;height:22px;color:#1a73e8" viewBox="0 0 24 24"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" x2="12" y1="2" y2="15"/></svg>'
PLUSSQ = '<svg class="i" viewBox="0 0 24 24"><rect width="18" height="18" x="3" y="3" rx="2"/><path d="M8 12h8M12 8v8"/></svg>'


def pagina_oido():
    """La portada de oido.com.ar, en chico."""
    return f'''<div style="position:absolute;left:0;right:0;top:92px;text-align:center">
          <div style="margin:0 auto;width:62px;height:62px;border-radius:18px;background:#D97706;display:flex;align-items:center;justify-content:center"><div style="width:42px;height:42px;background:#fff;{LOGO}"></div></div>
          <div class="serif" style="font-size:38px;margin-top:10px">oído</div>
          <div style="font-size:14px;color:#55504a;margin-top:4px">Personal gastronómico, ya.</div>
          <div style="margin:22px 30px 0;background:#D97706;color:#fff;border-radius:14px;padding:12px;font-size:14px;font-weight:600">Entrar</div>
        </div>'''


def inicio(t_icono):
    """Pantalla de inicio del celular: íconos grises y el de Oído que aparece."""
    grises = "".join(f'<div style="display:flex;flex-direction:column;align-items:center;gap:5px"><div class="ico" style="background:{c}"></div><div style="width:34px;height:5px;border-radius:3px;background:rgba(255,255,255,.55)"></div></div>'
                     for c in ["#c9bfae", "#b8c4c9", "#d4c3b5", "#bfc9b8", "#cbbfd0", "#c4cbd4", "#d6ccbd", "#b9c2bb", "#cfc6b8", "#c2bcc9", "#bcc7c4"])
    return f'''<div class="scr" style="background:linear-gradient(160deg,#e9dcc8,#d9c7ae 55%,#c8b394)">
          <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:18px 0;padding:70px 14px 0">{grises}
            <div style="display:flex;flex-direction:column;align-items:center;gap:5px">
              <div class="A" style="width:44px;height:44px;border-radius:12px;background:#D97706;display:flex;align-items:center;justify-content:center;box-shadow:0 6px 14px rgba(120,60,0,.35);{a("pop", .6, t_icono)}"><div style="width:30px;height:30px;background:#fff;{LOGO}"></div></div>
              <div class="A" style="font-size:10px;color:#fff;font-weight:600;text-shadow:0 1px 2px rgba(0,0,0,.3);{a("fade", .3, t_icono + .3)}">Oído</div>
            </div>
          </div>
        </div>'''


def app_con_hoja(desde, hasta, s5, iphone):
    """Oído abierto desde el ícono: la hoja real de la app y el aviso del sistema."""
    dialogo = (
        f'''<div class="abs A" style="left:30px;right:30px;top:190px;background:rgba(245,245,245,.97);border-radius:16px;text-align:center;overflow:hidden;box-shadow:0 12px 40px rgba(0,0,0,.3);{a("pop", .35, s5 + 2.9)}">
            <div style="padding:16px 14px 12px;font-size:14px;font-weight:600;color:#111">“Oído” quiere enviarte notificaciones</div>
            <div style="display:grid;grid-template-columns:1fr 1fr;border-top:1px solid #d8d8d8;font-size:15px;color:#1a73e8"><div style="padding:11px;border-right:1px solid #d8d8d8">No permitir</div><div style="padding:11px;font-weight:600">Permitir</div></div></div>
          {tap(206, 262, s5 + 3.9)}'''
        if iphone else
        f'''<div class="abs A" style="left:22px;right:22px;top:170px;background:#fff;border-radius:22px;padding:18px;box-shadow:0 12px 40px rgba(0,0,0,.3);{a("pop", .35, s5 + 2.9)}">
            <div style="font-size:15px;color:#111;line-height:1.35">¿Permitir que <b>Oído</b> te envíe notificaciones?</div>
            <div style="display:flex;justify-content:flex-end;gap:22px;margin-top:16px;font-size:14px;font-weight:600;color:#1a73e8"><span>No permitir</span><span>Permitir</span></div></div>
          {tap(222, 258, s5 + 3.9)}''')
    return f'''<div class="scr A" style="background:#FBFAF6;{ventana(desde, hasta)}">
          <div style="padding:48px 18px 0"><div class="serif" style="font-size:24px">Hola</div>
            <div style="margin-top:14px;height:84px;border-radius:16px;background:#fff;box-shadow:0 6px 16px rgba(60,40,10,.08)"></div>
            <div style="margin-top:10px;height:84px;border-radius:16px;background:#fff;box-shadow:0 6px 16px rgba(60,40,10,.08)"></div></div>
          <div class="abs" style="inset:0;background:rgba(17,17,17,.35);animation:fade .3s ease {s5 + 1.2:.2f}s both, outfade .3s ease {s5 + 4.3:.2f}s forwards"></div>
          <div class="abs A" style="left:0;right:0;bottom:0;background:#fff;border-radius:24px 24px 0 0;padding:20px 18px 26px;text-align:center;animation:sheetup .45s cubic-bezier(.2,.8,.2,1) {s5 + 1.2:.2f}s both, outfade .3s ease {s5 + 4.3:.2f}s forwards">
            <div style="margin:0 auto;width:44px;height:44px;border-radius:99px;background:#FDEBD0;color:#B45309;display:flex;align-items:center;justify-content:center">{BELL}</div>
            <div style="font-size:16px;font-weight:700;margin-top:10px">Activá las notificaciones</div>
            <div style="font-size:12.5px;color:#6b6358;margin-top:4px;line-height:1.35">Enterate al instante cuando te asignen un turno, te escriban o cambie el estado de tu postulación.</div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:14px;font-size:14px;font-weight:600"><div style="background:#F3EFE6;border-radius:12px;padding:11px;color:#55504a">Ahora no</div><div style="background:#D97706;border-radius:12px;padding:11px;color:#fff">Activar</div></div>
            {tap(212, 156, s5 + 2.6)}
          </div>
          <div class="abs" style="inset:0;animation:fade .01s linear {s5 + 2.9:.2f}s both, outfade .2s ease {s5 + 4.15:.2f}s forwards">{dialogo}</div>
        </div>'''


def perfil(desde, hasta, s6):
    """Perfil → Ajustes → la fila "Notificaciones push" (desde el #396 los
    ajustes viven en /profile/settings, sección "Cuenta")."""
    fila = "padding:14px;border-bottom:1px solid #f0ebe0;font-size:14px"
    return f'''<div class="scr A" style="background:#FBFAF6;{ventana(desde, s6 + 1.1)}">
          <div style="padding:48px 18px 0"><div class="serif" style="font-size:26px">Perfil</div>
            <div style="margin-top:16px;background:#fff;border-radius:16px;box-shadow:0 6px 16px rgba(60,40,10,.08);overflow:hidden">
              <div style="{fila};color:#8a8175">Editar perfil</div>
              <div class="A" style="position:relative;display:flex;justify-content:space-between;padding:14px;font-size:14px;font-weight:500;{a("glowrow", .8, s6 + .3)}">Ajustes <span style="color:#8a8175">›</span>{tap(140, 24, s6 + .55)}</div>
            </div></div>
        </div>
        <div class="scr A" style="background:#FBFAF6;{ventana(s6 + 1.0, hasta)}">
          <div style="padding:48px 18px 0"><div class="serif" style="font-size:26px"><span style="color:#8a8175">‹</span> Ajustes</div>
            <div class="mono" style="font-size:10px;color:#8a8175;margin:16px 0 6px 4px">Apariencia</div>
            <div style="display:grid;grid-template-columns:repeat(3,1fr);background:#fff;border-radius:14px;padding:4px;font-size:12px;text-align:center;box-shadow:0 6px 16px rgba(60,40,10,.06)"><div style="padding:8px;border-radius:10px;background:#F3EFE6;font-weight:600">Sistema</div><div style="padding:8px;color:#8a8175">Claro</div><div style="padding:8px;color:#8a8175">Oscuro</div></div>
            <div class="mono" style="font-size:10px;color:#8a8175;margin:16px 0 6px 4px">Cuenta</div>
            <div style="background:#fff;border-radius:16px;box-shadow:0 6px 16px rgba(60,40,10,.08);overflow:hidden">
              <div class="A" style="position:relative;display:flex;align-items:center;gap:10px;padding:14px;border-bottom:1px solid #f0ebe0;{a("glowrow", 1.0, s6 + 1.5)}">
                <span style="display:flex;width:32px;height:32px;border-radius:10px;background:#DCEAF4;color:#1F5B85;align-items:center;justify-content:center">{BELL}</span>
                <span style="flex:1;font-size:14px;font-weight:500">Notificaciones push</span>
                <span style="position:relative;font-size:11px;font-weight:600"><span class="A" style="display:inline-block;background:#F3EFE6;color:#8a8175;border-radius:99px;padding:3px 9px;animation:outfade .15s ease {s6 + 2.45:.2f}s forwards">Desactivadas</span>
                  <span class="abs A" style="right:0;top:0;background:#E3EFE8;color:#1B3A31;border-radius:99px;padding:3px 9px;white-space:nowrap;{a("pop", .35, s6 + 2.5)}">Activadas</span></span>
                {tap(150, 30, s6 + 2.2)}
              </div>
              <div style="{fila};color:#8a8175">Soporte</div>
              <div style="padding:14px;font-size:14px;color:#8a8175">Cerrar sesión</div>
            </div></div>
        </div>'''


def pantallas(iphone):
    s1, s2, s3, s4, s5, s6 = PASOS
    if iphone:
        navegador = f'''<div class="scr A" style="background:#fff;{ventana(s1, s4 + .1)}">
          {pagina_oido()}
          <div class="abs" style="left:0;right:0;bottom:0;background:rgba(246,246,246,.97);border-top:1px solid #e3e3e3;padding:10px 12px 22px">
            <div style="background:#e9e9ec;border-radius:12px;padding:9px;text-align:center;font-size:14px;color:#111"><span id="url"></span><span id="caret" style="display:inline-block;width:2px;height:16px;background:#1a73e8;vertical-align:-3px"></span></div>
            <div style="display:flex;justify-content:space-around;align-items:center;margin-top:10px;color:#1a73e8;font-size:20px"><span>‹</span><span style="opacity:.4">›</span>{SHARE}<span>□</span><span>⧉</span></div>
          </div>
          {tap(144, 552, s2 + 1.6)}
        </div>'''
        menu = f'''<div class="scr A" style="{ventana(s2 + 1.85, s3 + 1.55)}">
          <div class="abs" style="inset:0;background:rgba(0,0,0,.25)"></div>
          <div class="abs A" style="left:0;right:0;bottom:0;background:#f2f2f7;border-radius:18px 18px 0 0;padding:14px 12px 26px;{a("sheetup", .4, s2 + 1.85)}">
            <div style="display:flex;align-items:center;gap:10px;padding:0 4px 12px"><div style="width:34px;height:34px;border-radius:9px;background:#D97706;display:flex;align-items:center;justify-content:center"><div style="width:22px;height:22px;background:#fff;{LOGO}"></div></div><div><div style="font-size:14px;font-weight:600">Oído</div><div style="font-size:12px;color:#8e8e93">oido.com.ar</div></div></div>
            <div style="background:#fff;border-radius:12px;overflow:hidden;font-size:14px">
              <div style="padding:12px 14px;border-bottom:1px solid #e5e5ea">Copiar</div>
              <div style="padding:12px 14px;border-bottom:1px solid #e5e5ea">Agregar a favoritos</div>
              <div class="A" style="display:flex;justify-content:space-between;align-items:center;padding:12px 14px;font-weight:600;{a("glowrow", 1.2, s3 + .4)}">Agregar a pantalla de inicio {PLUSSQ}</div>
              <div style="padding:12px 14px;border-top:1px solid #e5e5ea">Buscar en la página</div>
            </div>
            {tap(140, 196, s3 + 1.3)}
          </div>
        </div>'''
        confirmar = f'''<div class="scr A" style="background:#f2f2f7;{ventana(s3 + 1.55, s4 + .1)}">
          <div style="display:flex;justify-content:space-between;align-items:center;padding:44px 14px 12px;font-size:14px"><span style="color:#1a73e8">Cancelar</span><span style="font-weight:600">Agregar a inicio</span><span style="color:#1a73e8;font-weight:600">Agregar</span></div>
          <div style="margin:10px 12px;background:#fff;border-radius:12px;padding:12px;display:flex;gap:12px;align-items:center"><div style="width:52px;height:52px;border-radius:13px;background:#D97706;display:flex;align-items:center;justify-content:center"><div style="width:34px;height:34px;background:#fff;{LOGO}"></div></div><div><div style="font-size:15px">Oído</div><div style="font-size:12px;color:#8e8e93">oido.com.ar</div></div></div>
          {tap(252, 58, s3 + 2.6)}
        </div>'''
    else:
        navegador = f'''<div class="scr A" style="background:#fff;{ventana(s1, s4 + .1)}">
          <div style="padding:34px 10px 8px;display:flex;align-items:center;gap:8px;border-bottom:1px solid #eee">
            <div style="flex:1;background:#f1f3f4;border-radius:99px;padding:8px 14px;font-size:14px;color:#111"><span id="url"></span><span id="caret" style="display:inline-block;width:2px;height:16px;background:#1a73e8;vertical-align:-3px"></span></div>
            <div style="font-size:22px;color:#5f6368;line-height:1;padding:0 4px">⋮</div>
          </div>
          {pagina_oido()}
          {tap(262, 52, s2 + 1.6)}
        </div>'''
        menu = f'''<div class="scr A" style="{ventana(s2 + 1.85, s3 + 1.55)}">
          <div class="abs A" style="right:8px;top:40px;width:196px;background:#fff;border-radius:12px;box-shadow:0 10px 30px rgba(0,0,0,.25);padding:6px 0;font-size:14px;color:#202124;{a("drop", .25, s2 + 1.85)}">
            <div style="padding:11px 16px">Nueva pestaña</div>
            <div style="padding:11px 16px">Historial</div>
            <div style="padding:11px 16px">Descargas</div>
            <div class="A" style="padding:11px 16px;font-weight:600;{a("glowrow", 1.2, s3 + .4)}">Instalar app</div>
            <div style="padding:11px 16px">Configuración</div>
          </div>
          {tap(150, 206, s3 + 1.3)}
        </div>'''
        confirmar = f'''<div class="scr A" style="{ventana(s3 + 1.55, s4 + .1)}">
          <div class="abs" style="inset:0;background:rgba(0,0,0,.35)"></div>
          <div class="abs A" style="left:22px;right:22px;top:190px;background:#fff;border-radius:24px;padding:20px;{a("pop", .35, s3 + 1.55)}">
            <div style="font-size:17px;color:#111">¿Instalar app?</div>
            <div style="display:flex;gap:12px;align-items:center;margin-top:14px"><div style="width:40px;height:40px;border-radius:11px;background:#D97706;display:flex;align-items:center;justify-content:center"><div style="width:26px;height:26px;background:#fff;{LOGO}"></div></div><div><div style="font-size:14px;font-weight:600">Oído</div><div style="font-size:12px;color:#5f6368">oido.com.ar</div></div></div>
            <div style="display:flex;justify-content:flex-end;gap:22px;margin-top:18px;font-size:14px;font-weight:600;color:#1a73e8"><span>Cancelar</span><span>Instalar</span></div>
          </div>
          {tap(222, 330, s3 + 2.6)}
        </div>'''
    casa = f'''<div class="scr A" style="{ventana(s4, s5 + .8)}">{inicio(s4 + .6)}
          {tap(240, 212, s5 + .35)}
        </div>'''
    return navegador + menu + confirmar + casa + app_con_hoja(s5 + .6, s6 + .1, s5, iphone) + perfil(s6, CIERRE + .2, s6)


def build(nombre, sistema, pre, titulos, nota5):
    t = ""
    for k, (lid, titulo) in enumerate(titulos):
        s = PASOS[k]
        e = PASOS[k + 1] if k + 1 < len(PASOS) else CIERRE
        etiqueta = f"Paso {k + 1} de 4" if k < 4 else "Los avisos"
        extra = f'<div class="abs mono A" style="left:40px;right:30px;top:205px;font-size:11px;letter-spacing:.06em;color:#8a8175;text-transform:none;{a("fade", .5, s + 2.2)}">{nota5}</div>' if (k == 4 and nota5) else ""
        t += f'''
  <div class="scene A" style="animation:slidein .45s cubic-bezier(.2,.8,.2,1) {s:.2f}s both, slideout .3s cubic-bezier(.6,0,.4,1) {e - .28:.2f}s forwards">
    <div class="abs mono" style="left:40px;top:84px;font-size:13px;color:#B45309">{etiqueta}</div>
    <div class="abs serif" style="left:40px;right:30px;top:108px;font-size:34px;line-height:1.1;color:#111" data-v="{lid}">{titulo}</div>{extra}
  </div>'''
    html = f'''<!-- Instalar Oído en {sistema} y activar los avisos (9:16, 30 s). Generado por
     instalar.py: se edita ahí, no acá. Tiempos de {nombre}.guion.json. -->
{STYLE}
<div id="stage" style="background:#FBFAF6">

  <!-- intro (0–3 s) -->
  <div class="scene oscuro" style="background:#D97706;animation:outfade .01s linear {PASOS[0] + .25:.2f}s forwards">
    <div class="abs A" style="left:210px;top:220px;width:120px;height:120px;background:#fff;{LOGO};{a("pop", .55, .05)}"></div>
    <div class="abs c serif" style="top:370px;font-size:44px;line-height:1.1;color:#fff" data-v="{pre}01">Oído en tu {"iPhone" if sistema == "iPhone" else "celular"},|como una *app* *más.*</div>
    <div class="abs c A" style="top:500px;font-size:18px;color:#fff;opacity:.92;{a("up", .5, 1.9)}">Sin tienda de apps. {"Con Safari." if sistema == "iPhone" else "Con Chrome."}</div>
  </div>
  <div class="scene A" style="background:#FBFAF6;{a("wipeup", .5, PASOS[0] - .2, "animation-timing-function:cubic-bezier(.7,0,.3,1)")}"></div>

  <!-- barra de progreso: 4 pasos para instalar + los avisos -->
  <div class="abs" style="left:40px;right:40px;top:58px;display:grid;grid-template-columns:repeat(6,1fr);gap:6px;animation:fade .4s ease {PASOS[0] + .1:.2f}s both, outfade .3s ease {CIERRE - .3:.2f}s forwards">
    {"".join(f'<div style="height:5px;border-radius:9px;background:#E7E1D4;overflow:hidden"><div class="A" style="height:100%;background:#D97706;transform-origin:0 50%;{a("fill", .5, PASOS[k] + .1)}"></div></div>' for k in range(6))}
  </div>
{t}

  <!-- el celular: una sola pantalla que va cambiando -->
  <div class="abs" style="left:120px;top:262px;width:300px;height:600px;background:#111;border-radius:46px;padding:9px;box-shadow:0 30px 70px rgba(60,40,10,.28);animation:phonein .7s cubic-bezier(.2,.8,.2,1) {PASOS[0] + .1:.2f}s both, outfade .3s ease {CIERRE - .3:.2f}s forwards">
    <div style="position:relative;width:100%;height:100%;border-radius:38px;overflow:hidden;background:#fff">
      {pantallas(sistema == "iPhone")}
      <div class="abs" style="left:50%;top:9px;width:86px;height:24px;border-radius:20px;background:#111;transform:translateX(-50%)"></div>
    </div>
  </div>

  <!-- cierre ({CIERRE:.0f}–{DUR:.0f} s) -->
  <div class="abs wave" style="--wc:#D97706;left:270px;top:480px;animation-delay:{CIERRE - .35:.2f}s"></div>
  <div class="abs wave" style="--wc:#F59E0B;left:270px;top:480px;animation-delay:{CIERRE - .23:.2f}s"></div>
  <div class="scene A" style="--x:50%;--y:50%;background:#1B3A31;{a("circ", .55, CIERRE - .15, "animation-timing-function:cubic-bezier(.7,0,.3,1)")}"></div>
  <div class="scene oscuro" style="animation:fade .01s linear {CIERRE:.2f}s both">
    <img class="abs A" src="/logo-mark.svg" style="left:215px;top:250px;width:110px;height:110px;{a("pop", .55, CIERRE + .1)}">
    <div class="abs c serif" style="top:400px;font-size:40px;line-height:1.12;color:#fff" data-v="{pre}08">Listo: cuando pase algo,|te *avisamos.*</div>
    <div class="abs A" style="left:140px;right:140px;top:530px;background:#D97706;color:#fff;border-radius:99px;padding:13px;text-align:center;font-family:var(--font-dm-mono),monospace;font-size:19px;{a("up", .5, CIERRE + 1.4)}">oido.com.ar</div>
  </div>

  <!-- tratamiento de color común: viñeta cálida + grano -->
  <div class="scene" style="pointer-events:none;background:radial-gradient(130% 90% at 50% 45%,rgba(0,0,0,0) 60%,rgba(40,22,6,.18) 100%)"></div>
  <svg class="abs" width="540" height="960" style="left:0;top:0;pointer-events:none;opacity:.07;mix-blend-mode:overlay">
    <filter id="grain"><feTurbulence id="grainT" type="fractalNoise" baseFrequency=".9" numOctaves="2" seed="1"/><feColorMatrix type="saturate" values="0"/></filter>
    <rect width="540" height="960" filter="url(#grain)"/>
  </svg>
</div>
'''
    open(f"{nombre}.html", "w").write(html)


build("instalar-android", "Android", "d", [
    ("d02", "Abrí oido.com.ar|en *Chrome.*"),
    ("d03", "Tocá los tres puntitos,|arriba a la *derecha.*"),
    ("d04", "Tocá *«Instalar* *app».*"),
    ("d05", "Listo: ya está|en tu *pantalla.*"),
    ("d06", "Abrila desde el ícono|y tocá *«Activar».*"),
    ("d07", "¿Dijiste «Ahora no»?|Activalas en Perfil › *Ajustes.*"),
], "")
build("instalar-iphone", "iPhone", "i", [
    ("i02", "Abrí oido.com.ar|en *Safari.*"),
    ("i03", "Tocá el botón|de *compartir,* abajo."),
    ("i04", "Tocá «Agregar a pantalla|de inicio» y *«Agregar».*"),
    ("i05", "Listo: ya está|en tu *pantalla.*"),
    ("i06", "Abrila desde el ícono|y tocá *«Activar».*"),
    ("i07", "¿Dijiste «Ahora no»?|Activalas en Perfil › *Ajustes.*"),
], "En iPhone, los avisos llegan sólo si abrís Oído desde el ícono")
print("instalar-android.html e instalar-iphone.html · pasos en", PASOS, "· cierre en", CIERRE)
