#!/bin/bash
# Renderiza piezas: el video (mudo) una vez y el sonido dos veces (con y sin música), a -14 LUFS.
# Uso: bash scripts/renderizar.sh [id ...]   (sin ids: todas)   ·   SALIDA=/otra/carpeta para cambiar out/
set -e
cd "$(dirname "$0")/.."
SALIDA=${SALIDA:-out}
mkdir -p "$SALIDA/tmp"
TODAS="que-resuelve-oido para-comercios para-trabajadores como-funciona-comercios como-funciona-trabajadores instalar-android instalar-iphone match va-en-camino cierre-comercios historia-comercios historia-trabajadores historia-match historia-instalar-android historia-instalar-iphone t6-05-sabado que-es-oido-30s t2-09-hielo t3-05-cebolla t1-04-orden-de-servicio c2-07-costo-encargado t6-05-sabado-real"
for id in ${@:-$TODAS}; do
  npx remotion render src/index.ts "$id" "$SALIDA/tmp/$id-video.mp4" --muted --codec=h264 --crf=17 --x264-preset=slow --concurrency=4 --log=error
  for v in con sin; do
    musica=$([ $v = con ] && echo true || echo false)
    npx remotion render src/index.ts "$id" "$SALIDA/tmp/$id-$v.wav" --codec=wav --props="{\"musica\":$musica}" --log=error
    bash scripts/normalizar.sh "$SALIDA/tmp/$id-$v.wav" "$SALIDA/tmp/$id-$v-14.wav"
    nombre=$([ $v = con ] && echo "$id-con-musica" || echo "$id")
    ffmpeg -v error -y -i "$SALIDA/tmp/$id-video.mp4" -i "$SALIDA/tmp/$id-$v-14.wav" -map 0:v -map 1:a -c:v copy -c:a aac -b:a 192k -shortest -movflags +faststart "$SALIDA/$nombre.mp4"
  done
done
echo "listo en $SALIDA/"
