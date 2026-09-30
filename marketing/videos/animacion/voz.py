"""Voz guía del video "historia", con TTS libre y local. Una toma por línea
del guion (historia.guion.json) → voz/<id>.wav, sin silencio al principio ni
al final: las pausas las pone mezcla.py según el `at` de cada línea.

Es una VOZ GUÍA. La versión para publicar conviene grabarla con una persona
(ver historia-de-marca.md, "Grabar la voz"): mismo nombre de archivo en
voz-grabada/, y mezcla.py la usa en lugar de ésta.

Dos motores, los dos gratis y locales:
- piper (por defecto si está el modelo): es_AR-daniela-high, voz femenina
  ARGENTINA. Modelo en piper/es_AR-daniela-high.onnx (+ .onnx.json), de
  huggingface.co/rhasspy/piper-voices (es/es_AR/daniela/high). Piper tiene
  una sola voz argentina, así que las líneas con voz masculina en el guion
  (el "¡Oído!" del trabajador) siguen saliendo de Kokoro.
- kokoro: voces en español neutro (ef_dora, em_alex). Modelo en kokoro/
  (kokoro-v1.0.onnx y voices-v1.0.bin, del release model-files-v1.0 de
  github.com/thewh1teagle/kokoro-onnx).

Requiere: pip install piper-tts kokoro-onnx soundfile numpy
Uso: python3 voz.py [id...]      (sin ids, todas; MOTOR=kokoro fuerza Kokoro)"""
import json, os, sys, wave
import numpy as np
import soundfile as sf

PIPER_MODELO = os.path.join(os.environ.get("PIPER_DIR", "piper"), "es_AR-daniela-high.onnx")
MOTOR = os.environ.get("MOTOR") or ("piper" if os.path.exists(PIPER_MODELO) else "kokoro")
SPEED = 0.9  # un poco más lenta que la de fábrica: se entiende y no apura

_kokoro = _piper = None


def kokoro(texto, voz):
    global _kokoro
    if _kokoro is None:
        from kokoro_onnx import Kokoro
        d = os.environ.get("KOKORO_DIR", "kokoro")
        _kokoro = Kokoro(os.path.join(d, "kokoro-v1.0.onnx"), os.path.join(d, "voices-v1.0.bin"))
    return _kokoro.create(texto, voice=voz, speed=SPEED, lang="es")


def piper(texto):
    global _piper
    from piper import PiperVoice, SynthesisConfig
    if _piper is None:
        _piper = PiperVoice.load(PIPER_MODELO)
    tmp = "voz/.piper.wav"
    with wave.open(tmp, "wb") as w:
        _piper.synthesize_wav(texto, w, syn_config=SynthesisConfig(length_scale=1 / SPEED))
    a, sr = sf.read(tmp)
    os.remove(tmp)
    return a, sr


guion = json.load(open("historia.guion.json"))
os.makedirs("voz", exist_ok=True)
solo = set(sys.argv[1:])
print(f"motor: {MOTOR}")
for ln in guion["lineas"]:
    if solo and ln["id"] not in solo:
        continue
    femenina = ln["voz"].startswith("ef_")
    a, sr = piper(ln["texto"]) if MOTOR == "piper" and femenina else kokoro(ln["texto"], ln["voz"])
    idx = np.where(np.abs(a) > 0.01)[0]
    a = a[max(0, idx[0] - int(0.01 * sr)): idx[-1] + int(0.1 * sr)]
    sf.write(f"voz/{ln['id']}.wav", a, sr)
    fin = ln["at"] + len(a) / sr
    aviso = "  ← pasa su dur: ajustar el guion" if len(a) / sr > ln["dur"] + 0.35 else ""
    print(f"{ln['id']}  {ln['at']:5.1f} → {fin:5.1f}  ({len(a) / sr:.2f} s / dur {ln['dur']})  {ln['texto']}{aviso}")
