#!/bin/bash
# Baja la música y los efectos de Mixkit que usan las piezas a public/sonidos/mixkit/ (no van a git).
# Licencias: «Stock Music Free License» y «Sound Effects Free License» de Mixkit (uso comercial en redes,
# sin atribución). La lista con nombres y fuentes está en sonidos/FUENTES.md («De Mixkit»).
set -e
cd "$(dirname "$0")/.."; mkdir -p public/sonidos/mixkit
grep -E '^\| `mixkit/[a-z0-9-]+\.mp3` \|' sonidos/FUENTES.md | while IFS='|' read -r _ nombre url _resto; do
  nombre=$(echo "$nombre" | tr -d ' `'); url=$(echo "$url" | grep -oE 'https://assets\.mixkit\.co/[^)]+\.mp3' | head -1)
  [ -s "public/sonidos/$nombre" ] || { curl -sfL -A "Mozilla/5.0" -o "public/sonidos/$nombre" "$url"; }
  echo "public/sonidos/$nombre"
done
