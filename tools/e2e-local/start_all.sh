#!/usr/bin/env bash
# start_all.sh — levanta el arnés de la etapa 1 de Oído:
#   simulados (8901 http + 8902 https) · backend (8000) · frontend `next start` (3100)
# Idempotente: lo que ya responde no se toca. Cada servidor queda en su propia
# sesión (`exec setsid nohup`, sin subshell colgada que retenga la salida).
# Las variables de entorno que traiga quien lo llama pasan al backend
# (run_backend.py las respeta).
set -u

source "$(dirname "${BASH_SOURCE[0]}")/_env.sh"
BACKEND_PORT="${PORT:-8000}"
mkdir -p "$LOGS/sessions" "$E1/evidence" "$E1/cloud" "$STATE"
[ -x "$PY" ] || { echo "  ✗ no hay intérprete en $PY: corré setup.sh primero"; exit 1; }

up() { curl -fsS -o /dev/null --max-time 3 "$1" 2>/dev/null; }

wait_for() { # nombre url segundos
  local i=0
  until up "$2"; do
    i=$((i + 1))
    if [ "$i" -ge "$3" ]; then
      echo "  ✗ $1 no respondió en $3 s ($2). Mirá el log en $LOGS/"
      return 1
    fi
    sleep 1
  done
  echo "  ✓ $1 arriba ($2)"
}

# Postgres local
if ! pg_isready -q -h localhost -p 5432; then
  echo "Postgres caído: lo levanto"
  pg_ctlcluster 16 main start
  sleep 2
fi
pg_isready -q -h localhost -p 5432 && echo "  ✓ postgres arriba (localhost:5432/$E1_DB)"

# 1. Simulados
if up http://127.0.0.1:8901/health; then
  echo "  ✓ simulados ya estaban arriba"
else
  (cd "$HARNESS" && exec setsid nohup "$PY" fakes.py >>"$LOGS/fakes.log" 2>&1 </dev/null) &
  wait_for "simulados" http://127.0.0.1:8901/health 30 || exit 1
fi

# 2. Backend (la primera vez siembra los datos demo: puede tardar ~1 min)
if up "http://127.0.0.1:$BACKEND_PORT/health"; then
  echo "  ✓ backend ya estaba arriba"
else
  (cd "$HARNESS" && exec setsid nohup "$PY" run_backend.py >>"$LOGS/backend.log" 2>&1 </dev/null) &
  wait_for "backend" "http://127.0.0.1:$BACKEND_PORT/health" 240 || exit 1
fi

# 3. Frontend: `next start` sobre el build ya hecho (las NEXT_PUBLIC_* quedaron
#    dentro del bundle al buildear; se repiten acá por las páginas de servidor).
if up http://127.0.0.1:3100/; then
  echo "  ✓ frontend ya estaba arriba"
else
  if [ ! -f "$REPO/frontend/.next/BUILD_ID" ]; then
    echo "  ✗ no hay build del frontend ($REPO/frontend/.next/BUILD_ID)"
    exit 1
  fi
  (
    cd "$REPO/frontend" &&
      exec env -u HTTPS_PROXY -u https_proxy -u HTTP_PROXY -u http_proxy \
        NEXT_PUBLIC_API_URL=http://localhost:8000/api/v1 \
        NEXT_PUBLIC_GOOGLE_CLIENT_ID=e1-fake.apps.googleusercontent.com \
        NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME=oido-e1 \
        NEXT_TELEMETRY_DISABLED=1 \
        setsid nohup node_modules/.bin/next start -p 3100 >>"$LOGS/frontend.log" 2>&1 </dev/null
  ) &
  wait_for "frontend" http://127.0.0.1:3100/ 90 || exit 1
fi

# 4. Cuentas admin de prueba (idempotente; deja admin.json)
"$PY" "$HARNESS/bootstrap_admins.py" || echo "  ✗ bootstrap_admins.py falló (ver arriba)"

echo "Listo. Estado: $HARNESS/status.sh  ·  datos en $E1_DIR"
