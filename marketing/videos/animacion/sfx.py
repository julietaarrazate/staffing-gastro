"""Efectos de sonido de los videos, sintetizados (sin samples con licencia).
Sólo biblioteca estándar. Uso: python3 sfx.py <video> → <video>.wav,
48 kHz estéreo, 22.5 s. Cada video es una función con su lista de cues."""
import math, random, struct, sys, wave

SR = 48000
DUR = 22.5
N = int(SR * DUR)
L = [0.0] * N
R = [0.0] * N
random.seed(7)


def add(t0, samples, gain=1.0, pan=0.0):
    i0 = int(t0 * SR)
    gl, gr = gain * (1 - max(0, pan)), gain * (1 + min(0, pan))
    for k, v in enumerate(samples):
        i = i0 + k
        if 0 <= i < N:
            L[i] += v * gl
            R[i] += v * gr


def tone(freq, dur, decay=12.0, freq_end=None, attack=0.004, harm=0.0):
    n = int(dur * SR)
    out, ph = [], 0.0
    for k in range(n):
        t = k / SR
        f = freq if freq_end is None else freq + (freq_end - freq) * (t / dur)
        ph += 2 * math.pi * f / SR
        env = min(1.0, t / attack) * math.exp(-t * decay)
        out.append(env * (math.sin(ph) + harm * math.sin(2 * ph)))
    return out


def whoosh(dur, f0=300, f1=3000, peak=0.6, q=0.7):
    """Ruido filtrado con barrido de frecuencia (filtro de estado variable)."""
    n = int(dur * SR)
    out, low, band = [], 0.0, 0.0
    for k in range(n):
        x = k / n
        fc = f0 * (f1 / f0) ** x
        f = 2 * math.sin(math.pi * min(fc, 8000) / SR)
        env = (x / peak) ** 2 if x < peak else ((1 - x) / (1 - peak)) ** 1.5
        noise = random.uniform(-1, 1)
        high = noise - low - q * band
        band += f * high
        low += f * band
        out.append(band * env * 0.9)
    return out


def click(dur=0.012, bright=0.6):
    n = int(dur * SR)
    out, prev = [], 0.0
    for k in range(n):
        v = random.uniform(-1, 1)
        hp = v - bright * prev
        prev = v
        out.append(hp * math.exp(-k / SR * 450))
    return out


def thud(freq=90, dur=0.35):
    return tone(freq, dur, decay=14, freq_end=freq * 0.6, attack=0.002)


def lanzamiento():
    # 1 · el problema
    add(0.45, tone(880, 0.18, 22, 1320), 0.22)                       # llega el mensaje
    for t in (1.15, 1.28, 1.41, 1.6, 1.73):                         # palabras
        add(t, thud(120, 0.25), 0.13)
    add(2.3, tone(1320, 0.12, 30), 0.08)
    # transición a ámbar + marca
    add(2.95, whoosh(0.75, 200, 4000, 0.8), 0.55)
    add(3.55, thud(70, 0.8), 0.5)
    for f, d in ((523.25, 0), (659.25, 0.04), (783.99, 0.08), (1046.5, 0.12)):
        add(3.6 + d, tone(f, 1.4, 3.2, harm=0.15), 0.07)
    # 3 · publicar
    add(5.2, whoosh(0.6, 3000, 250, 0.4), 0.4)
    add(5.9, whoosh(0.7, 150, 1200, 0.7), 0.3)
    chars = 43
    for k in range(chars):
        add(6.55 + k * 1.45 / chars + random.uniform(-0.006, 0.006), click(0.01, 0.8), 0.12 + random.uniform(0, 0.05), pan=random.uniform(-0.2, 0.2))
    add(8.1, click(0.02, 0.3), 0.3)
    for t, f in ((8.45, 659.25), (8.62, 783.99), (8.79, 987.77)):
        add(t, tone(f, 0.22, 16), 0.12)
        add(t, whoosh(0.18, 2000, 6000, 0.3), 0.08)
    add(9.65, click(0.02, 0.3), 0.3)
    add(9.9, tone(1046.5, 0.5, 7), 0.13)
    add(10.0, tone(1567.98, 0.7, 6), 0.1)
    # 4 · mapa
    add(10.3, whoosh(0.55, 2500, 300, 0.35), 0.35)
    add(11.0, thud(160, 0.3), 0.3)
    t = 11.2
    while t < 14.6:
        add(t, tone(440, 0.9, 4.5), 0.05)
        t += 0.53
    for t, pan in ((11.55, -0.4), (11.75, 0.5), (11.9, 0.3), (12.05, -0.5), (12.15, 0.6)):
        add(t, tone(1200, 0.08, 40, 1600), 0.1, pan)
    for t in (12.4, 12.95, 13.45):                                   # postulaciones
        add(t, tone(987.77, 0.18, 14), 0.11)
        add(t + 0.09, tone(1318.5, 0.3, 10), 0.11)
    add(14.3, click(0.02, 0.3), 0.3)
    # 5 · cubierto
    add(14.5, whoosh(0.75, 200, 5000, 0.8), 0.5)
    secs_prev = -1
    for k in range(int(1.5 * 30)):                                   # reloj
        tt = 15.35 + k / 30
        x = min(1, max(0, (tt - 15.35) / 1.4))
        secs = round((1 - (1 - x) ** 3) * 462)
        if secs // 20 != secs_prev // 20:
            add(tt, click(0.008, 0.9), 0.1)
            secs_prev = secs
    add(16.85, thud(55, 1.2), 0.6)
    for f, d in ((392.0, 0), (493.88, 0.03), (587.33, 0.06), (783.99, 0.09)):
        add(16.9 + d, tone(f, 1.8, 2.4, harm=0.1), 0.06)
    add(17.7, whoosh(2.0, 300, 900, 0.5, q=1.2), 0.08)
    # 6 · cierre
    add(18.85, whoosh(0.7, 4000, 250, 0.35), 0.4)
    add(19.4, thud(80, 0.6), 0.4)
    for f, d in ((523.25, 0), (659.25, 0.05), (783.99, 0.1), (1046.5, 0.15), (1318.5, 0.2)):
        add(19.45 + d, tone(f, 2.5, 1.8, harm=0.12), 0.06)
    add(20.7, tone(1567.98, 0.6, 6), 0.05)

def trabajador():
    # 1 · la noche libre
    for t in (0.45, 0.62, 0.79, 0.96):                          # palabras
        add(t, thud(120, 0.25), 0.13)
    add(1.75, whoosh(0.4, 3000, 800, 0.6), 0.18)                 # baja la notificación
    add(2.05, tone(987.77, 0.2, 14), 0.14)
    add(2.14, tone(1318.5, 0.35, 9), 0.14)
    for k in range(6):                                           # vibra
        add(2.3 + k * 0.075, tone(150, 0.06, 20), 0.22)
    # transición a ámbar + marca
    add(2.85, whoosh(0.75, 200, 4000, 0.8), 0.55)
    add(3.45, thud(70, 0.8), 0.5)
    for f, d in ((523.25, 0), (659.25, 0.04), (783.99, 0.08), (1046.5, 0.12)):
        add(3.5 + d, tone(f, 1.4, 3.2, harm=0.15), 0.07)
    # 3 · el feed
    add(5.1, whoosh(0.6, 3000, 250, 0.4), 0.4)
    add(5.8, whoosh(0.7, 150, 1200, 0.7), 0.3)
    add(6.75, click(0.02, 0.3), 0.3)                             # interruptor
    add(6.8, tone(1174.66, 0.15, 18), 0.1)
    for t in (7.1, 7.3, 7.5):                                    # tarjetas
        add(t, whoosh(0.2, 1500, 5000, 0.3), 0.1)
    add(8.5, tone(783.99, 0.5, 6), 0.06)                         # "paga más"
    add(9.35, click(0.02, 0.3), 0.3)
    add(9.65, tone(1046.5, 0.5, 7), 0.13)
    add(9.75, tone(1567.98, 0.7, 6), 0.1)
    # 4 · te eligen
    add(10.35, whoosh(0.55, 2500, 300, 0.35), 0.35)
    add(10.85, tone(987.77, 0.2, 14), 0.13)
    add(10.94, tone(1318.5, 0.35, 9), 0.13)
    for t, f in ((11.5, 659.25), (11.9, 783.99), (12.55, 987.77)):
        add(t, tone(f, 0.25, 14), 0.12)
    add(12.3, click(0.02, 0.3), 0.3)
    # 5 · en camino y cobrado
    add(14.4, whoosh(0.75, 200, 5000, 0.8), 0.5)
    add(15.3, whoosh(1.8, 300, 1400, 0.6, q=1.1), 0.12)
    add(17.1, tone(1318.5, 0.6, 6), 0.08)
    for k in range(10):                                          # monedas
        add(17.3 + k * 0.08 * (1 + k * 0.08), tone(2093 + k * 40, 0.08, 35), 0.06)
    add(18.15, thud(55, 1.0), 0.45)
    for k, f in enumerate((1046.5, 1174.66, 1318.5, 1567.98, 2093.0)):   # estrellas
        add(18.2 + k * 0.1, tone(f, 0.3, 10), 0.07)
    # 6 · cierre
    add(18.85, whoosh(0.7, 4000, 250, 0.35), 0.4)
    add(19.4, thud(80, 0.6), 0.4)
    for f, d in ((523.25, 0), (659.25, 0.05), (783.99, 0.1), (1046.5, 0.15), (1318.5, 0.2)):
        add(19.45 + d, tone(f, 2.5, 1.8, harm=0.12), 0.06)
    add(20.7, tone(1567.98, 0.6, 6), 0.05)


VIDEOS = {"lanzamiento": lanzamiento, "trabajador": trabajador}
name = sys.argv[1] if len(sys.argv) > 1 else ""
if name not in VIDEOS:
    sys.exit("uso: python3 sfx.py " + "|".join(VIDEOS))
VIDEOS[name]()

peak = max(max(abs(v) for v in L), max(abs(v) for v in R))
g = 0.89 / peak
with wave.open(f"{name}.wav", "wb") as w:
    w.setnchannels(2)
    w.setsampwidth(2)
    w.setframerate(SR)
    fade = int(0.8 * SR)
    frames = bytearray()
    for i in range(N):
        f = min(1.0, (N - i) / fade)
        frames += struct.pack("<hh", int(math.tanh(L[i] * g) * 32767 * f), int(math.tanh(R[i] * g) * 32767 * f))
    w.writeframes(bytes(frames))
print("peak", peak)
