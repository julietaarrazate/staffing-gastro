"""Banda de sonido de los videos con guion: música + efectos + voz, mezclados.
Todo sintetizado acá (sin samples ni pistas con licencia) salvo la voz, que
sale de voz-grabada/<id>.wav si existe (una persona real, ver README.md) o
de voz/<id>.wav (la voz guía de voz.py), o va sin voz si no hay ninguna. Cada toma se pone en el `at` de su
línea del guion: las pausas son del guion, no de quien lee.

La música baja sola cuando hay voz (ducking con la envolvente real de la
voz, no con los tiempos del guion) y vuelve a subir en los silencios.

Requiere numpy y soundfile. Uso: python3 mezcla.py <video> → <video>.wav (48 kHz).
Cada video es una función con su música y sus efectos."""
import json, os, sys
import numpy as np
import soundfile as sf

SR = 48000
NOMBRE = sys.argv[1] if len(sys.argv) > 1 else ""
if not os.path.exists(f"{NOMBRE}.guion.json"):
    sys.exit("uso: python3 mezcla.py <video con guion> (historia, anuncio, bienvenida-*, instalar-*)")
guion = json.load(open(f"{NOMBRE}.guion.json"))
DUR = guion["duracion"]
N = int(SR * DUR)
BEAT = 60 / guion["bpm"]            # a 80 BPM, 0,75 s: los cortes grandes caen sobre esta grilla
rng = np.random.default_rng(7)

musica = np.zeros((N, 2))
sfx = np.zeros((N, 2))
voz = np.zeros(N)


def put(buf, t0, x, gain=1.0, pan=0.0):
    i0 = int(t0 * SR)
    x = np.asarray(x) * gain
    i1 = min(N, i0 + len(x))
    if i1 <= i0:
        return
    x = x[: i1 - i0]
    if buf.ndim == 1:
        buf[i0:i1] += x
    else:
        buf[i0:i1, 0] += x * (1 - max(0, pan))
        buf[i0:i1, 1] += x * (1 + min(0, pan))


def hz(midi):
    return 440 * 2 ** ((midi - 69) / 12)


def tt(dur):
    return np.arange(int(dur * SR)) / SR


# ── instrumentos ────────────────────────────────────────────────────────────
def keys(f, dur=2.4, vel=1.0):
    """Piano apagado (felt): fundamental + armónicos que se apagan antes."""
    t = tt(dur)
    env = np.minimum(1, t / 0.006) * np.exp(-t * 2.2)
    x = np.sin(2 * np.pi * f * t) + 0.35 * np.sin(4 * np.pi * f * t) * np.exp(-t * 5) + 0.12 * np.sin(6 * np.pi * f * t) * np.exp(-t * 9)
    return x * env * 0.22 * vel


def pad(notas, dur, att=1.4, rel=1.6):
    t = tt(dur)
    env = np.minimum(1, t / att) * np.minimum(1, np.maximum(0, (dur - t) / rel))
    x = np.zeros_like(t)
    for m in notas:
        f = hz(m)
        for det in (-0.12, 0, 0.12):   # tres osciladores un poco desafinados: calidez
            ff = f * 2 ** (det / 12)
            x += np.sin(2 * np.pi * ff * t + rng.uniform(0, 6)) + 0.18 * np.sin(4 * np.pi * ff * t)
    trem = 1 + 0.08 * np.sin(2 * np.pi * 0.3 * t)
    return x * env * trem * 0.035 / max(1, len(notas) / 4)


def bass(f, dur):
    t = tt(dur)
    env = np.minimum(1, t / 0.01) * np.exp(-t * 1.6) * np.minimum(1, np.maximum(0, (dur - t) / 0.08))
    return (np.sin(2 * np.pi * f * t) + 0.25 * np.sin(4 * np.pi * f * t)) * env * 0.32


def kick(gain=1.0):
    t = tt(0.4)
    f = 45 + 75 * np.exp(-t * 28)
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 9) * 0.55 * gain


def noise(dur):
    return rng.uniform(-1, 1, int(dur * SR))


def hat(gain=1.0):
    n = noise(0.06)
    n = np.diff(n, prepend=0)                   # pasa-altos barato
    return n * np.exp(-tt(0.06) * 70) * 0.07 * gain


def rim(gain=1.0):
    t = tt(0.12)
    return (np.sin(2 * np.pi * 1700 * t) * 0.3 + noise(0.12) * 0.5) * np.exp(-t * 45) * 0.12 * gain


def whoosh(dur, f0=300, f1=3000, peak=0.6, q=0.7):
    """Ruido con filtro pasa-banda que barre de f0 a f1."""
    n = int(dur * SR)
    out = np.empty(n)
    low = band = 0.0
    wn = rng.uniform(-1, 1, n)
    x = np.arange(n) / n
    fc = np.minimum(f0 * (f1 / f0) ** x, 8000)
    fk = 2 * np.sin(np.pi * fc / SR)
    for k in range(n):
        high = wn[k] - low - q * band
        band += fk[k] * high
        low += fk[k] * band
        out[k] = band
    env = np.where(x < peak, (x / peak) ** 2, ((1 - x) / (1 - peak)) ** 1.5)
    return out * env * 0.9


def tone(f, dur, decay=12.0, f_end=None):
    t = tt(dur)
    fr = f if f_end is None else f + (f_end - f) * t / dur
    return np.sin(2 * np.pi * np.cumsum(np.full_like(t, 1.0) * fr) / SR) * np.minimum(1, t / 0.004) * np.exp(-t * decay)


def click(dur=0.012):
    n = noise(dur)
    return np.diff(n, prepend=0) * np.exp(-tt(dur) * 450)


def thud(f=80, dur=0.5):
    return tone(f, dur, 12, f * 0.6)


# ── acordes (MIDI) ─────────────────────────────────────────────────────────
Am9, Fmaj9, C69, Dm9 = [45, 52, 55, 59, 60], [41, 48, 52, 55, 57], [48, 55, 57, 62, 64], [50, 53, 57, 60, 64]
Am7, Fmaj7, C, G6 = [45, 52, 55, 60, 64], [41, 48, 53, 57, 64], [48, 52, 55, 60, 67], [43, 50, 52, 59, 62]


def historia():
    """48 s. Tiempos de historia.html / historia.guion.json."""

    # A · 0–11: sólo colchón y un piano que deja espacio. Se calla con el mensaje.
    put(musica, 0.0, pad(Am9, 11.6, att=2.5), 1.0)
    for t, m in ((0.75, 64), (2.25, 60), (3.0, 59), (3.75, 57), (7.5, 64), (8.25, 62), (9.0, 60), (9.75, 59)):
        put(musica, t, keys(hz(m), 2.6, 0.8), 1.0, pan=0.15)
    put(musica, 10.0, whoosh(1.0, 200, 3500, 0.92), 0.10)          # sube hacia la marca

    # B · 11–16,3: la marca. Acorde abierto, arpegio suave.
    put(musica, 11.0, pad(Fmaj9, 2.5, att=0.05), 1.3)
    put(musica, 13.25, pad(C69, 3.3, rel=1.0), 1.2)
    for k in range(14):
        t = 11.0 + k * BEAT / 2
        ch = Fmaj9 if t < 13.25 else C69
        put(musica, t, keys(hz(ch[1 + k % 4] + 12), 1.4, 0.45 + 0.1 * (k % 2 == 0)), 1.0, pan=(-0.25, 0.25)[k % 2])
    for t, m in ((11.0, 41), (13.25, 48)):
        put(musica, t, bass(hz(m), 2.2), 1.0)
    put(musica, 11.0, kick(1.1), 1.0)
    put(musica, 14.0, kick(0.7), 1.0)

    # C · 16,3–21: el giro. Casi nada: una nota que queda sonando.
    put(musica, 16.4, pad([50, 57], 4.8, att=0.8, rel=2.0), 0.8)
    put(musica, 16.5, keys(hz(76), 4.0, 0.7), 1.0)
    put(musica, 20.1, whoosh(0.95, 250, 2200, 0.9), 0.07)

    # D/E · 21–42,7: el groove. Bombo en 1 y 3, platillo a contratiempo, aro en 2 y 4.
    compases = [(21, Am7), (24, Fmaj7), (27, C), (30, G6), (33, Am7), (36, Fmaj7), (39, C), (40.5, G6)]
    for i, (t0, ch) in enumerate(compases):
        largo = (compases[i + 1][0] if i + 1 < len(compases) else 42.75) - t0
        put(musica, t0, pad(ch, largo + 0.6, att=0.3, rel=0.8), 1.0)
        put(musica, t0, bass(hz(ch[0]), min(largo, 1.4)), 1.0)
        if largo > 2:
            put(musica, t0 + 1.5, bass(hz(ch[0]), min(largo - 1.5, 1.2)), 0.8)
        for k in range(int(largo / (BEAT / 2))):
            put(musica, t0 + k * BEAT / 2, keys(hz(ch[1 + (k * 3) % 4] + 12), 1.2, 0.35 + 0.15 * (k % 4 == 0)), 1.0, pan=(-0.3, 0.3)[k % 2])
    b = 21.0
    while b < 42.7:
        parada = 36.0 <= b < 37.5                    # "Y alguien contesta:" … silencio … "¡Oído!"
        fase = (b - 21.0) / BEAT % 4
        if not parada:
            if fase in (0, 2):
                put(musica, b, kick(0.9 if b >= 24 else 0.6), 1.0)
            if b >= 24 and fase in (1, 3):
                put(musica, b, rim(0.9), 1.0, pan=0.1)
            if b >= 22.5:
                put(musica, b + BEAT / 2, hat(1.0), 1.0, pan=-0.2)
        b += BEAT
    put(musica, 36.9, kick(1.2), 1.0)                  # el "¡Oído!" vuelve a arrancar todo
    put(musica, 36.9, pad([53, 57, 60, 64, 69], 1.2, att=0.01, rel=0.9), 1.4)

    # F · 42,7–48: cierre. Golpe, acorde que se abre y queda sonando.
    put(musica, 42.75, kick(1.2), 1.0)
    put(musica, 42.75, pad(Fmaj9, 1.2, att=0.02, rel=0.6), 1.2)
    put(musica, 43.5, pad([48, 55, 59, 62, 64, 71], 4.5, att=0.4, rel=3.0), 1.2)
    put(musica, 43.5, bass(hz(36), 3.5), 1.0)
    for k, m in enumerate((72, 76, 79, 83, 84)):
        put(musica, 44.4 + k * BEAT / 2, keys(hz(m), 3.0, 0.5), 1.0, pan=(-0.3, 0.3)[k % 2])

    # efectos (siguen a historia.html)
    put(sfx, 5.65, tone(880, 0.18, 22, 1320), 0.2)                      # llega el mensaje
    put(sfx, 5.74, tone(1320, 0.3, 14), 0.1)
    for k in range(5):
        put(sfx, 5.9 + k * 0.08, tone(150, 0.06, 20), 0.2)               # vibra el teléfono
    put(sfx, 10.7, whoosh(0.4, 400, 5000, 0.8), 0.25)                     # ondas del oído
    put(sfx, 11.0, thud(70, 0.8), 0.45)
    put(sfx, 16.3, whoosh(0.55, 3000, 300, 0.35), 0.25)                   # cortina
    put(sfx, 20.9, whoosh(1.6, 180, 900, 0.5, q=1.2), 0.08)               # se dibuja el mapa
    put(sfx, 22.5, whoosh(2.0, 250, 2500, 0.75), 0.12)                    # zoom
    put(sfx, 23.9, tone(987.77, 0.2, 14), 0.1)                            # pin
    put(sfx, 24.0, tone(1318.5, 0.35, 9), 0.08)
    put(sfx, 24.55, whoosh(0.5, 1500, 5000, 0.3), 0.08)
    put(sfx, 28.6, whoosh(0.55, 3000, 300, 0.35), 0.22)
    put(sfx, 29.25, whoosh(0.7, 150, 1200, 0.7), 0.2)
    for k in range(43):                                                   # tipeo
        put(sfx, 29.9 + k * 1.5 / 43 + rng.uniform(-0.006, 0.006), click(0.01), 0.1 + rng.uniform(0, 0.05), pan=rng.uniform(-0.2, 0.2))
    put(sfx, 31.6, click(0.02), 0.28)
    put(sfx, 31.85, tone(1046.5, 0.5, 7), 0.12)
    put(sfx, 31.95, tone(1567.98, 0.7, 6), 0.09)
    put(sfx, 32.1, whoosh(0.55, 2500, 300, 0.35), 0.25)
    put(sfx, 32.7, thud(160, 0.3), 0.25)
    for t, pan in ((33.5, -0.4), (33.75, 0.4), (33.95, 0.5), (34.15, -0.5), (34.3, 0.5)):
        put(sfx, t, tone(1200, 0.08, 40, 1600), 0.08, pan)
    put(sfx, 36.85, tone(659.25, 0.25, 12), 0.12)                          # ¡Oído!
    put(sfx, 36.93, tone(987.77, 0.4, 9), 0.12)
    put(sfx, 37.4, whoosh(2.2, 300, 1400, 0.6, q=1.1), 0.07)              # va en camino
    put(sfx, 37.95, whoosh(0.5, 1500, 5000, 0.3), 0.07)
    put(sfx, 41.7, tone(1174.66, 0.3, 12), 0.08)
    put(sfx, 42.45, whoosh(0.45, 400, 5000, 0.8), 0.25)
    put(sfx, 43.1, thud(80, 0.6), 0.35)


def anuncio():
    """15 s, cinco compases de 3 s. Tiempos de anuncio.html / anuncio.guion.json."""
    # 0–3 · el gancho: el mensaje llega en el primer cuarto de segundo
    put(musica, 0.0, pad(Am9, 3.4, att=0.6, rel=0.5), 1.0)
    for t, m in ((0.75, 64), (1.5, 60), (2.25, 59)):
        put(musica, t, keys(hz(m), 1.8, 0.8), 1.0, pan=0.15)
    put(musica, 2.1, whoosh(0.9, 200, 3500, 0.92), 0.10)             # sube hacia la marca
    # 3–12 · el groove arranca con la marca
    compases = [(3, Fmaj7), (6, C), (9, Am7), (10.5, G6)]
    for i, (t0, ch) in enumerate(compases):
        largo = (compases[i + 1][0] if i + 1 < len(compases) else 12.0) - t0
        put(musica, t0, pad(ch, largo + 0.5, att=0.2 if t0 > 3 else 0.02, rel=0.7), 1.2 if t0 == 3 else 1.0)
        put(musica, t0, bass(hz(ch[0]), min(largo, 1.4)), 1.0)
        if largo > 2:
            put(musica, t0 + 1.5, bass(hz(ch[0]), 1.2), 0.8)
        for k in range(int(largo / (BEAT / 2))):
            put(musica, t0 + k * BEAT / 2, keys(hz(ch[1 + (k * 3) % 4] + 12), 1.2, 0.35 + 0.15 * (k % 4 == 0)), 1.0, pan=(-0.3, 0.3)[k % 2])
    b = 3.0
    while b < 12.0:
        parada = 10.5 <= b < 11.25                     # silencio antes del "¡Oído!"
        fase = (b - 3.0) / BEAT % 4
        if not parada:
            if fase in (0, 2):
                put(musica, b, kick(1.0 if b > 3 else 1.2), 1.0)
            if b >= 6 and fase in (1, 3):
                put(musica, b, rim(0.9), 1.0, pan=0.1)
            if b >= 4.5:
                put(musica, b + BEAT / 2, hat(1.0), 1.0, pan=-0.2)
        b += BEAT
    put(musica, 11.25, kick(1.2), 1.0)
    put(musica, 11.25, pad([53, 57, 60, 64, 69], 1.0, att=0.01, rel=0.8), 1.4)
    # 12–15 · cierre: golpe y acorde que queda sonando
    put(musica, 12.0, kick(1.2), 1.0)
    put(musica, 12.0, pad([48, 55, 59, 62, 64, 71], 3.0, att=0.2, rel=2.2), 1.3)
    put(musica, 12.0, bass(hz(36), 2.8), 1.0)
    for k, m in enumerate((72, 76, 79, 83)):
        put(musica, 12.4 + k * BEAT / 2, keys(hz(m), 2.4, 0.5), 1.0, pan=(-0.3, 0.3)[k % 2])

    # efectos (siguen a anuncio.html)
    put(sfx, 0.05, tone(880, 0.18, 22, 1320), 0.2)                   # llega el mensaje
    put(sfx, 0.14, tone(1320, 0.3, 14), 0.1)
    for k in range(5):
        put(sfx, 0.3 + k * 0.08, tone(150, 0.06, 20), 0.2)             # vibra
    put(sfx, 2.65, whoosh(0.4, 400, 5000, 0.8), 0.25)                   # ondas del oído
    put(sfx, 3.0, thud(70, 0.8), 0.45)
    put(sfx, 5.8, whoosh(0.5, 3000, 300, 0.35), 0.22)                   # cortina
    put(sfx, 6.15, whoosh(0.7, 150, 1200, 0.7), 0.2)                    # entra el teléfono
    for k in range(30):                                                 # tipeo
        put(sfx, 6.8 + k * 1.2 / 30 + rng.uniform(-0.006, 0.006), click(0.01), 0.1 + rng.uniform(0, 0.05), pan=rng.uniform(-0.2, 0.2))
    put(sfx, 8.25, click(0.02), 0.28)
    put(sfx, 8.45, tone(1046.5, 0.5, 7), 0.12)
    put(sfx, 8.55, tone(1567.98, 0.7, 6), 0.09)
    put(sfx, 8.8, whoosh(0.5, 2500, 300, 0.35), 0.22)                   # al mapa
    put(sfx, 9.3, thud(160, 0.3), 0.25)
    for t, pan in ((9.7, -0.4), (9.85, 0.4), (10.0, 0.5), (10.15, -0.5)):
        put(sfx, t, tone(1200, 0.08, 40, 1600), 0.08, pan)
    put(sfx, 11.2, tone(659.25, 0.25, 12), 0.12)                        # ¡Oído!
    put(sfx, 11.28, tone(987.77, 0.4, 9), 0.12)
    put(sfx, 11.45, whoosh(0.8, 300, 1400, 0.6, q=1.1), 0.07)           # va en camino
    put(sfx, 11.85, whoosh(0.45, 400, 5000, 0.8), 0.25)                 # ondas → cierre
    put(sfx, 12.3, thud(80, 0.6), 0.35)
    put(sfx, 13.6, tone(1174.66, 0.3, 12), 0.07)                        # la dirección


def bienvenida():
    """30 s: intro, 5 pasos de 4,5 s (6 golpes), cierre. Más tranquila que el
    anuncio: sin aro, el bombo sólo en 1 y 3. Tiempos de bienvenida-*.html."""
    pasos = [3.75 + 4.5 * k for k in range(5)]
    cierre = 26.25
    # intro: acorde abierto y un motivo de piano con la marca
    put(musica, 0.0, pad(Fmaj9, 4.2, att=0.8, rel=0.8), 1.0)
    for t, m in ((0.1, 72), (0.3, 76), (0.5, 79), (1.5, 81), (2.25, 79), (3.0, 76)):
        put(musica, t, keys(hz(m), 2.2, 0.6), 1.0, pan=0.15)
    put(musica, 3.0, whoosh(0.8, 200, 3000, 0.9), 0.07)
    # pasos: un acorde por paso, groove liviano
    for t0, ch in zip(pasos, (Fmaj7, C, Am7, G6, Fmaj7)):
        put(musica, t0, pad(ch, 5.0, att=0.3, rel=0.8), 1.0)
        put(musica, t0, bass(hz(ch[0]), 1.4), 1.0)
        put(musica, t0 + 2.25, bass(hz(ch[0]), 1.4), 0.8)
        for k in range(12):
            put(musica, t0 + k * BEAT / 2, keys(hz(ch[1 + (k * 3) % 4] + 12), 1.2, 0.3 + 0.15 * (k % 4 == 0)), 1.0, pan=(-0.3, 0.3)[k % 2])
    b = pasos[0]
    while b < cierre:
        fase = round((b - pasos[0]) / BEAT) % 4
        if fase in (0, 2):
            put(musica, b, kick(0.8), 1.0)
        put(musica, b + BEAT / 2, hat(0.8), 1.0, pan=-0.2)
        b += BEAT
    # cierre
    put(musica, cierre, kick(1.2), 1.0)
    put(musica, cierre, pad([48, 55, 59, 62, 64, 71], 3.8, att=0.2, rel=2.6), 1.3)
    put(musica, cierre, bass(hz(36), 3.4), 1.0)
    for k, m in enumerate((72, 76, 79, 83, 84)):
        put(musica, cierre + 0.4 + k * BEAT / 2, keys(hz(m), 2.6, 0.5), 1.0, pan=(-0.3, 0.3)[k % 2])

    # efectos comunes: cortina entre pasos, ondas del cierre
    put(sfx, 0.1, thud(90, 0.5), 0.3)
    for t0 in pasos:
        put(sfx, t0 - 0.2, whoosh(0.5, 2500, 400, 0.4), 0.14)
    put(sfx, cierre - 0.35, whoosh(0.45, 400, 5000, 0.8), 0.25)
    put(sfx, cierre, thud(80, 0.6), 0.35)

    def boton(t, ding=True):                        # un toque y, si sale bien, su confirmación
        put(sfx, t, click(0.02), 0.28)
        if ding:
            put(sfx, t + 0.2, tone(1046.5, 0.45, 8), 0.1)
            put(sfx, t + 0.28, tone(1567.98, 0.6, 7), 0.07)

    def pop(t, f=987.77, g=0.08):
        put(sfx, t, tone(f, 0.18, 16), g)

    s1, s2, s3, s4, s5 = pasos
    if NOMBRE == "bienvenida-comercio":
        for k in range(40):                                               # tipeo
            put(sfx, s1 + 0.9 + k * 1.3 / 40 + rng.uniform(-0.006, 0.006), click(0.01), 0.1 + rng.uniform(0, 0.05), pan=rng.uniform(-0.2, 0.2))
        for k in range(3):
            pop(s1 + 2.35 + k * 0.15, 659.25 + k * 120, 0.06)
        boton(s1 + 3.4)
        pop(s2 + 0.5, 523.25, 0.1)
        for k in range(4):
            put(sfx, s2 + 1.4 + k * 0.27, tone(1200, 0.08, 40, 1600), 0.07, pan=(-0.4, 0.4)[k % 2])
        pop(s2 + 2.5)
        pop(s2 + 2.8)
        pop(s2 + 3.1)
        boton(s3 + 3.0)
        put(sfx, s4 + 0.8, whoosh(2.4, 300, 1400, 0.6, q=1.1), 0.06)
        pop(s4 + 3.3, 1318.5, 0.09)
        boton(s5 + 1.0, ding=False)
        boton(s5 + 2.0)
        for i in range(5):
            pop(s5 + 2.6 + i * 0.12, 1046.5 + i * 130, 0.06)
    else:
        pop(s1 + 0.8, 880, 0.08)
        pop(s1 + 2.3, 1046.5, 0.08)
        pop(s1 + 2.75, 1174.66, 0.08)
        pop(s2 + 1.2, 659.25, 0.08)
        boton(s2 + 3.0)
        put(sfx, s3 + 0.3, tone(880, 0.18, 22, 1320), 0.16)                  # llega el aviso
        put(sfx, s3 + 0.39, tone(1320, 0.3, 14), 0.08)
        boton(s3 + 2.6)
        boton(s4 + 1.7)
        boton(s4 + 3.2)
        for k in range(10):                                                  # sube el monto
            put(sfx, s5 + 0.6 + k * 0.09, tone(2093 + k * 40, 0.08, 35), 0.05)
        pop(s5 + 1.6, 1318.5, 0.09)
        for i in range(5):
            pop(s5 + 2.0 + i * 0.12, 1046.5 + i * 130, 0.06)


def instalar():
    """30 s: intro, 4 pasos para instalar, 2 para los avisos, cierre. Tiempos
    de instalar.py (iguales en Android y en iPhone)."""
    pasos = [3.0, 6.75, 10.5, 14.25, 18.0, 23.25]
    cierre = 27.0
    put(musica, 0.0, pad(Fmaj9, 3.4, att=0.5, rel=0.8), 1.0)
    for t, m in ((0.05, 72), (0.25, 76), (0.45, 79), (1.5, 81), (2.25, 79)):
        put(musica, t, keys(hz(m), 2.2, 0.6), 1.0, pan=0.15)
    for t0, t1, ch in zip(pasos, pasos[1:] + [cierre], (Fmaj7, C, Am7, G6, Fmaj7, C)):
        largo = t1 - t0
        put(musica, t0, pad(ch, largo + 0.5, att=0.3, rel=0.8), 1.0)
        put(musica, t0, bass(hz(ch[0]), 1.4), 1.0)
        put(musica, t0 + 2.25, bass(hz(ch[0]), 1.2), 0.8)
        for k in range(int(round(largo / (BEAT / 2)))):
            put(musica, t0 + k * BEAT / 2, keys(hz(ch[1 + (k * 3) % 4] + 12), 1.2, 0.3 + 0.15 * (k % 4 == 0)), 1.0, pan=(-0.3, 0.3)[k % 2])
    b = pasos[0]
    while b < cierre:
        if round((b - pasos[0]) / BEAT) % 4 in (0, 2):
            put(musica, b, kick(0.75), 1.0)
        put(musica, b + BEAT / 2, hat(0.7), 1.0, pan=-0.2)
        b += BEAT
    put(musica, cierre, kick(1.2), 1.0)
    put(musica, cierre, pad([48, 55, 59, 62, 64, 71], 3.0, att=0.2, rel=2.2), 1.3)
    put(musica, cierre, bass(hz(36), 2.8), 1.0)
    for k, m in enumerate((72, 76, 79, 83)):
        put(musica, cierre + 0.4 + k * BEAT / 2, keys(hz(m), 2.4, 0.5), 1.0, pan=(-0.3, 0.3)[k % 2])

    s1, s2, s3, s4, s5, s6 = pasos

    def toque(t, g=0.26):                       # el dedo que toca la pantalla
        put(sfx, t + 0.18, click(0.02), g)

    put(sfx, 0.05, thud(90, 0.5), 0.3)
    for t0 in pasos:
        put(sfx, t0 - 0.2, whoosh(0.5, 2500, 400, 0.4), 0.13)
    for k in range(11):                                                     # se tipea la dirección
        put(sfx, s1 + 0.6 + k * 1.0 / 11 + rng.uniform(-0.006, 0.006), click(0.01), 0.1 + rng.uniform(0, 0.05))
    toque(s2 + 1.6)
    put(sfx, s2 + 1.85, whoosh(0.3, 1500, 4000, 0.3), 0.06)                 # se abre el menú
    toque(s3 + 1.3)
    toque(s3 + 2.6)
    put(sfx, s4 + 0.6, tone(1046.5, 0.45, 8), 0.1)                          # aparece el ícono
    put(sfx, s4 + 0.68, tone(1567.98, 0.6, 7), 0.07)
    toque(s5 + 0.35)
    put(sfx, s5 + 1.2, whoosh(0.4, 600, 2500, 0.4), 0.06)                   # sube la hoja
    toque(s5 + 2.6)
    toque(s5 + 3.9)
    put(sfx, s5 + 4.1, tone(880, 0.18, 22, 1320), 0.14)                     # el primer aviso
    put(sfx, s5 + 4.19, tone(1320, 0.3, 14), 0.07)
    toque(s6 + 0.55)                                                        # Perfil → Ajustes
    toque(s6 + 2.2)
    put(sfx, s6 + 2.5, tone(1174.66, 0.3, 12), 0.08)
    put(sfx, cierre - 0.35, whoosh(0.45, 400, 5000, 0.8), 0.25)
    put(sfx, cierre, thud(80, 0.6), 0.35)


VIDEOS = {"historia": historia, "anuncio": anuncio, "bienvenida-comercio": bienvenida, "bienvenida-trabajador": bienvenida,
          "instalar-android": instalar, "instalar-iphone": instalar}
VIDEOS[NOMBRE]()

# ── voz ────────────────────────────────────────────────────────────────────
def resample(x, sr):
    if sr == SR:
        return x
    n = int(round(len(x) * SR / sr))
    X = np.fft.rfft(x)
    Y = np.zeros(n // 2 + 1, dtype=complex)
    m = min(len(X), len(Y))
    Y[:m] = X[:m]
    return np.fft.irfft(Y, n) * n / len(x)

for ln in guion["lineas"]:
    grabada = f"voz-grabada/{ln['id']}.wav"
    path = grabada if os.path.exists(grabada) else f"voz/{ln['id']}.wav"
    if not os.path.exists(path):
        continue
    x, sr = sf.read(path, always_2d=True)
    x = resample(x.mean(axis=1), sr)
    x = x / (np.abs(x).max() + 1e-9) * 0.9
    sonido = np.where(np.abs(x) > 0.02)[0]              # una grabación trae aire antes y después
    x = x[max(0, sonido[0] - int(0.03 * SR)): sonido[-1] + int(0.12 * SR)]
    largo = len(x) / SR
    if largo > ln["dur"] + 0.35:
        print(f"ojo: {path} dura {largo:.2f} s y el guion le da {ln['dur']} — ajustá 'dur' (y 'at' de las siguientes)")
    put(voz, ln["at"], x)
# un poco de sala: la voz seca de un TTS suena a locutor de GPS
sala = voz.copy()
for ms, g in ((11, 0.16), (19, 0.11), (29, 0.08), (43, 0.05)):
    d = int(ms * SR / 1000)
    sala[d:] += voz[:-d] * g

# ── ducking y mezcla ───────────────────────────────────────────────────────
env = np.abs(voz)
v = np.convolve(env, np.ones(int(0.03 * SR)) / int(0.03 * SR), mode="same")
hablando = (v > 0.02).astype(float)
g = np.empty(N)
att, rel, acc = 1 / (0.12 * SR), 1 / (0.45 * SR), 0.0     # baja en 120 ms, vuelve en 450 ms
for i in range(0, N, 48):                                  # cada 1 ms alcanza
    obj = hablando[i]
    acc += (obj - acc) * (att if obj > acc else rel) * 48
    acc = min(1, max(0, acc))
    g[i:i + 48] = acc
duck = 1 - 0.68 * g                                         # ≈ −10 dB mientras habla

mix = musica * duck[:, None] * 0.55 + sfx + np.stack([sala, sala], axis=1) * 0.75
fade_in, fade_out = int(0.5 * SR), int(1.5 * SR)
mix[:fade_in] *= np.linspace(0, 1, fade_in)[:, None]
mix[-fade_out:] *= np.linspace(1, 0, fade_out)[:, None]
mix = np.tanh(mix / np.abs(mix).max() * 1.1) * 0.89
sf.write(f"{NOMBRE}.wav", mix.astype(np.float32), SR, subtype="PCM_16")
grabadas = sum(os.path.exists(f"voz-grabada/{l['id']}.wav") for l in guion["lineas"])
guia = sum(not os.path.exists(f"voz-grabada/{l['id']}.wav") and os.path.exists(f"voz/{l['id']}.wav") for l in guion["lineas"])
print(f"{NOMBRE}.wav: {DUR} s · voz: {grabadas} tomas grabadas, {guia} de la voz guía, {len(guion['lineas']) - grabadas - guia} sin voz")
