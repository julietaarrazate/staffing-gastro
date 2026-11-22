#!/bin/bash
# Vuelve a armar los recortes de sonidos/ desde sonidos/originales/ (bajar-sonidos.sh).
# Efectos: pico a -3 dBFS. Murmullo y música: -23 LUFS. Las ganancias de la mezcla viven en src/sonido.ts.
set -e
cd "$(dirname "$0")"
O=originales
pico() { # archivo entrada, inicio, duración, salida, [filtro extra]
  local f="$1" ss="$2" d="$3" out="$4" extra="${5:-anull}"
  local p=$(ffmpeg -hide_banner -ss "$ss" -t "$d" -i "$f" -af "$extra,volumedetect" -f null - 2>&1 | sed -n 's/.*max_volume: \([-0-9.]*\) dB/\1/p')
  ffmpeg -v error -y -ss "$ss" -t "$d" -i "$f" -af "$extra,volume=$(printf "%.2f" $(echo "-3 - ($p)" | bc -l))dB,afade=t=in:d=0.005,afade=t=out:st=$(printf "%.3f" $(echo "$d - 0.06" | bc -l)):d=0.06" -ar 48000 -ac 2 -c:a libmp3lame -q:a 2 "$out"
}
pico $O/toque.mp3      0.32 0.45 toque.mp3
pico $O/campanita.mp3  0    1.99 campanita.mp3
pico $O/vibracion.mp3  1.25 1.30 vibracion.mp3
pico $O/tipeo.mp3      2.33 1.90 tipeo.mp3
# La impresora, corta y sin el chirrido de arriba: un tic-tic de medio segundo.
pico $O/impresora.mp3  0.05 0.55 impresora-corta.mp3 "lowpass=f=4200,highpass=f=180"
# Barra y cocina (piezas de tips): hielo cayendo en el vaso, coctelera, cuchillo sobre tabla y copa apoyada.
pico $O/hielo.mp3      78.45 1.80 hielo.mp3
pico $O/coctelera.mp3  0.20 2.00 coctelera.mp3
pico $O/tabla.mp3      2.15 2.10 tabla.mp3
pico $O/copa.mp3       8.45 0.60 copa.mp3 "highpass=f=120"
# Murmullo de salón: el tramo de 22 a 58 s (el menos hablado de la toma), filtrado como si viniera
# del salón de al lado (pasa bajos y un eco corto) para que no quede habla inteligible.
# Verificado con faster-whisper small: sin segmentos de voz. Se repite con fundido para cubrir 30 s+.
ffmpeg -v error -y -ss 22 -t 36 -i $O/murmullo-salon.mp3 -af "highpass=f=120,lowpass=f=1100,aecho=0.8:0.6:45|90:0.35|0.2,loudnorm=I=-23:TP=-3:LRA=7,afade=t=in:d=0.3,afade=t=out:st=35.4:d=0.6" -ar 48000 -ac 2 -c:a libmp3lame -q:a 5 murmullo.mp3
# Bossa: la toma de 22 s, encadenada consigo misma (fundido de 2 s) para cubrir hasta 42 s, a -23 LUFS.
ffmpeg -v error -y -i $O/bossa-rozenbaum.mp3 -i $O/bossa-rozenbaum.mp3 -filter_complex "[0][1]acrossfade=d=2:c1=tri:c2=tri,loudnorm=I=-23:TP=-3:LRA=9" -ar 48000 -ac 2 -c:a libmp3lame -q:a 4 bossa.mp3
ls -la *.mp3
