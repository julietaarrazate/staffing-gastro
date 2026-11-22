#!/bin/bash
# Regenera las capturas de la app: build de frontend/, next start y Playwright con la API mockeada.
# Uso (desde marketing/remotion): bash capturar/todo.sh     (APP_URL para usar una app ya levantada)
set -e
cd "$(dirname "$0")"
FRONT=../../../frontend
if [ -z "$APP_URL" ]; then
  (cd $FRONT && npm ci && npm run build)
  (cd $FRONT && npx next start -p 3311 > /tmp/oido-next.log 2>&1 &)
  export APP_URL=http://localhost:3311
  until curl -sf $APP_URL > /dev/null; do sleep 1; done
fi
node comercio.js todo
node trabajador.js todo light
node landing.js
python3 exportar.py          # → public/cap/ y src/cap.json
echo "capturas listas"
