#!/bin/bash
# Niveles por pista de una pieza (efectos, murmullo, música), para revisar el balance sin escuchar a ciegas.
# Uso: bash scripts/niveles.sh <id>
set -e
cd "$(dirname "$0")/.."
id=$1; mkdir -p out/niveles
for p in efectos murmullo musica todo; do
  npx remotion render src/index.ts "$id" "out/niveles/$id-$p.wav" --codec=wav --props="{\"pista\":\"$p\"}" --log=error
  ffmpeg -hide_banner -i "out/niveles/$id-$p.wav" -af ebur128=peak=true -f null - 2>&1 | awk -v p="$p" '/I:/{i=$2} /Peak:/{k=$2} END{printf "%-9s %6s LUFS  pico %6s dBFS\n", p, i, k}'
done
