#!/bin/bash
# Baja las versiones originales (vista previa HQ de Freesound, CC0) a sonidos/originales/.
# No hacen falta para renderizar: los recortes ya están en sonidos/. Sirven para volver a recortarlos (recortar.sh).
set -e
cd "$(dirname "$0")"; mkdir -p originales
bajar() { [ -s "originales/$1" ] || curl -sfL -A "Mozilla/5.0" -o "originales/$1" "$2"; echo "originales/$1"; }
bajar murmullo-salon.mp3   https://cdn.freesound.org/previews/394/394678_1015909-hq.mp3   # soundtracvkradio, 394678
bajar impresora.mp3        https://cdn.freesound.org/previews/345/345057_3784934-hq.mp3   # azumarill, 345057
bajar campanita.mp3        https://cdn.freesound.org/previews/879/879808_19512113-hq.mp3  # Qvantor, 879808
bajar vibracion.mp3        https://cdn.freesound.org/previews/260/260955_257367-hq.mp3    # tompallant, 260955
bajar toque.mp3            https://cdn.freesound.org/previews/469/469297_5875299-hq.mp3   # djf54, 469297
bajar tipeo.mp3            https://cdn.freesound.org/previews/631/631822_6657854-hq.mp3   # ahriik, 631822
bajar bossa-rozenbaum.mp3  https://cdn.freesound.org/previews/400/400698_6035865-hq.mp3   # FullMetalJedi, 400698
bajar hielo.mp3            https://cdn.freesound.org/previews/427/427090_5984825-hq.mp3   # dr19, 427090
bajar coctelera.mp3        https://cdn.freesound.org/previews/319/319995_5440319-hq.mp3   # KenRT, 319995
bajar cuchillo.mp3         https://cdn.freesound.org/previews/795/795433_16786392-hq.mp3  # Ultra-Edward, 795433
bajar copa.mp3             https://cdn.freesound.org/previews/489/489737_9306973-hq.mp3   # ShadowSilhouette, 489737
