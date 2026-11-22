#!/bin/bash
# normalizar.sh entrada.wav salida.wav → -14 LUFS integrado, pico real por debajo de -1 dBTP.
set -e
med() { ffmpeg -hide_banner -i "$1" -af ebur128=peak=true -f null - 2>&1 | awk '/I:/{i=$2} /Peak:/{p=$2} END{print i, p}'; }
read I P < <(med "$1")
G=$(awk -v i="$I" 'BEGIN{print -14 - i}')
for n in 1 2 3 4 5; do
  ffmpeg -v error -y -i "$1" -af "volume=${G}dB,alimiter=limit=0.78:level=false:attack=2:release=50" -ar 48000 "$2"
  read I2 P2 < <(med "$2")
  ok=$(awk -v i="$I2" 'BEGIN{print (i > -14.3 && i < -13.7) ? 1 : 0}')
  [ "$ok" = 1 ] && break
  G=$(awk -v g="$G" -v i="$I2" 'BEGIN{print g + (-14 - i)}')
done
echo "$(basename "$2"): $I2 LUFS, pico $P2 dBTP"
