#!/bin/bash
# Baja las tomas de stock que usan las piezas a public/tomas/<nombre>.mp4 (no van a git).
# Todas son de Mixkit con la «Stock Video Free License» (uso comercial sin atribución), verificada clip por
# clip en su página: las de «Restricted License» son sólo para uso personal y NO se usan. Ver tomas/FUENTES.md.
set -e
cd "$(dirname "$0")/.."; mkdir -p public/tomas
grep -E '^\| `[a-z0-9-]+` \|' tomas/FUENTES.md | while IFS='|' read -r _ nombre id _resto; do
  nombre=$(echo "$nombre" | tr -d ' `'); id=$(echo "$id" | grep -oE '[0-9]+' | head -1)
  [ -s "public/tomas/$nombre.mp4" ] || curl -sfL -A "Mozilla/5.0" -o "public/tomas/$nombre.mp4" "https://assets.mixkit.co/videos/$id/$id-1080.mp4"
  echo "public/tomas/$nombre.mp4"
done
