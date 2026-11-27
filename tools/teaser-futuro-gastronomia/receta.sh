#!/usr/bin/env bash
# Receta del teaser «El futuro de la gastronomía». Qué es y dónde está cada pieza:
# docs/reference/TEASER_FUTURO_GASTRONOMIA.md
#
# Uso: ./receta.sh <paso> [h|v] [tramos]
#   adaptar               referencia + guion -> trabajo/presentacion.html (la presentación en español)
#   miniaturas            captura las 13 miniaturas y las mete en la presentación
#   preparar              presentación -> trabajo/render.html y render-audio.html (para grabar)
#   linea                 vuelve a medir en qué cuadro cambia cada escena (compara con linea.json)
#   sonido                graba la banda de sonido completa (9 min, en tiempo real) -> trabajo/sonido.wav
#   cuadros h|v [tramos]  dibuja los cuadros del corte horizontal o vertical (20 a 60 min sin placa de video);
#                         con tramos, solo esos: ./receta.sh cuadros h 3,4 (se numeran desde 0, en el orden del corte)
#   armar h|v             une cuadros + sonido + placa -> trabajo/salida/*.mp4
#   placas                vuelve a dibujar placa-h.png y placa-v.png
#
# Las dos entradas privadas (no están en el repo) van en trabajo/entrada/: referencia.html y guion.js
set -euo pipefail
AQUI="$(cd "$(dirname "$0")" && pwd)"
RAIZ="$(cd "$AQUI/../.." && pwd)"
paso="${1:-}"; forma="${2:-h}"; tramos="${3:-}"
ayuda() { sed -n '2,16p' "$0"; }

case "$paso" in
  adaptar|miniaturas|preparar|linea|sonido|cuadros|armar|placas) ;;
  "") ayuda; exit 0 ;;
  *) echo "paso desconocido: $paso"; echo; ayuda; exit 1 ;;
esac

T="${TRABAJO:-$AQUI/trabajo}"; mkdir -p "$T"; T="$(cd "$T" && pwd)"
cd "$AQUI"

if [ "$paso" = cuadros ] || [ "$paso" = armar ]; then
  case "$forma" in
    h) ANCHO=1280; ALTO=720;  SAL_ANCHO=1280; SAL_ALTO=720;  NOMBRE=horizontal; LIV_ANCHO=1280; LIV_ALTO=720;  LIV_KBPS=1450 ;;
    v) ANCHO=720;  ALTO=1280; SAL_ANCHO=1080; SAL_ALTO=1920; NOMBRE=vertical;   LIV_ANCHO=720;  LIV_ALTO=1280; LIV_KBPS=2200 ;;
    *) echo "$paso necesita la forma: h (horizontal) o v (vertical)"; exit 1 ;;
  esac
fi
falta() { [ -f "$1" ] || { echo "Falta $1"; echo "$2"; exit 1; }; }

case "$paso" in
  adaptar)
    for f in referencia.html guion.js; do
      falta "$T/entrada/$f" "Las entradas privadas se bajan de la página del archivo: docs/reference/TEASER_FUTURO_GASTRONOMIA.md"
    done
    node adaptar.js "$T/entrada/referencia.html" "$T/entrada/guion.js" "$T/presentacion.html" ;;
  miniaturas)
    falta "$T/presentacion.html" "Corré antes: ./receta.sh adaptar"
    rm -rf "$T/miniaturas"; mkdir -p "$T/miniaturas"
    node capturar.js "$T/presentacion.html" "$T/miniaturas" \
      "aim:1:6,boat:2:7,calendar:2:7,dominoes:1:14,futures:0:6,lamp:2:12,loop:3:11,office:2:12.3,pile:1:8,questions:2:6,selectall:2:13,swarm:3:9,tower:2:8" 1 800 450
    node miniaturas.js "$T/presentacion.html" "$T/miniaturas" ;;
  preparar)
    falta "$T/presentacion.html" "Corré antes: ./receta.sh adaptar"
    node preparar.js "$T/presentacion.html" "$T/render.html" "$T/render-audio.html" ;;
  linea)
    falta "$T/render.html" "Corré antes: ./receta.sh preparar"
    node linea.js "$T/render.html" "$T/linea.json"
    cmp -s "$T/linea.json" linea.json && echo "la línea de tiempo no cambió" \
      || echo "OJO: la línea de tiempo cambió. Revisá corte-h.json y corte-v.json, volvé a grabar el sonido y, si sirve, copiá trabajo/linea.json acá." ;;
  sonido)
    falta "$T/render-audio.html" "Corré antes: ./receta.sh preparar"
    node sonido.js "$T/render-audio.html" "$T/sonido.webm"
    node recortar-sonido.js "$T/sonido.webm" "$T/sonido.wav" ;;
  cuadros)
    falta "$T/render.html" "Corré antes: ./receta.sh preparar"
    node cuadros.js "$T/render.html" "$T/cuadros-$forma" "$ANCHO" "$ALTO" "corte-$forma.json" 30 1 "$tramos" ;;
  armar)
    falta "$T/sonido.wav" "Corré antes: ./receta.sh sonido (o bajá la banda de sonido de la página del archivo y convertila a wav)"
    mkdir -p "$T/salida"
    node armar.js "$T/cuadros-$forma" "corte-$forma.json" "$T/sonido.wav" "placa-$forma.png" "$T/salida/oido-teaser-$NOMBRE.mp4" "$SAL_ANCHO" "$SAL_ALTO"
    node armar.js "$T/cuadros-$forma" "corte-$forma.json" "$T/sonido.wav" "placa-$forma.png" "$T/salida/oido-teaser-$NOMBRE-whatsapp.mp4" "$LIV_ANCHO" "$LIV_ALTO" "$LIV_KBPS" ;;
  placas)
    FILETE="$RAIZ/docs/design-system/marca/oido-filete.svg"; MONO="$RAIZ/marketing/remotion/public/fonts/dmmono-500.woff2"
    node placa.js "$FILETE" fuentes/young-serif.woff2 "$MONO" placa-h.png 1280 720
    node placa.js "$FILETE" fuentes/young-serif.woff2 "$MONO" placa-v.png 1080 1920 ;;
esac
