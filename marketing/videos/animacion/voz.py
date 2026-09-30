"""Voz guía del video "historia", con TTS libre y local (Kokoro, Apache 2.0).
Una toma por línea del guion (historia.guion.json) → voz/<id>.wav, sin
silencio al principio ni al final: las pausas las pone mezcla.py según el
`at` de cada línea, no la voz.

Es una VOZ GUÍA. La versión para publicar conviene grabarla con una persona
(ver README.md, "Grabar la voz"): mismo nombre de archivo, y mezcla.py la usa
en lugar de ésta.

Requiere: pip install kokoro-onnx soundfile numpy, y los dos archivos del
modelo (kokoro-v1.0.onnx y voices-v1.0.bin, del release model-files-v1.0 de
github.com/thewh1teagle/kokoro-onnx) en KOKORO_DIR (por defecto, ./kokoro/).
Uso: python3 voz.py [id...]   (sin ids, genera todas)"""
import json, os, sys
import numpy as np
import soundfile as sf
from kokoro_onnx import Kokoro

SPEED = 0.9  # un poco más lenta que la de fábrica: se entiende y no apura
d = os.environ.get("KOKORO_DIR", "kokoro")
k = Kokoro(os.path.join(d, "kokoro-v1.0.onnx"), os.path.join(d, "voices-v1.0.bin"))
guion = json.load(open("historia.guion.json"))
os.makedirs("voz", exist_ok=True)
solo = set(sys.argv[1:])
for ln in guion["lineas"]:
    if solo and ln["id"] not in solo:
        continue
    a, sr = k.create(ln["texto"], voice=ln["voz"], speed=SPEED, lang="es")
    idx = np.where(np.abs(a) > 0.01)[0]
    a = a[max(0, idx[0] - int(0.01 * sr)): idx[-1] + int(0.1 * sr)]
    sf.write(f"voz/{ln['id']}.wav", a, sr)
    fin = ln["at"] + len(a) / sr
    print(f"{ln['id']}  {ln['at']:5.1f} → {fin:5.1f}  ({len(a) / sr:.2f} s)  {ln['texto']}")
