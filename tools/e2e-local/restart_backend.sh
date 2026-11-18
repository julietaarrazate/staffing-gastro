#!/usr/bin/env bash
# restart_backend.sh — relanza SÓLO el backend con otra configuración.
# Las variables que se pasen por delante pisan los valores por defecto de
# run_backend.py (el resto queda igual; no se vuelve a sembrar). Ejemplo, la
# segunda corrida con límites y planes prendidos:
#
#   RATE_LIMIT_ENABLED=true SUBSCRIPTIONS_ENFORCED=true ./restart_backend.sh
#
# Para volver a la config de base: ./restart_backend.sh (sin variables).
# Ojo: corta las conexiones abiertas (WebSocket, pedidos en curso) de todos
# los agentes; las sesiones siguen valiendo (mismos secretos, misma base).
set -u
source "$(dirname "${BASH_SOURCE[0]}")/_env.sh"
BACKEND_PORT="${PORT:-8000}"

fuser -k "$BACKEND_PORT/tcp" >/dev/null 2>&1 && echo "  ✓ backend anterior detenido" && sleep 1
{
  echo
  echo "===== relanzado $(date -u +%FT%TZ) · RATE_LIMIT_ENABLED=${RATE_LIMIT_ENABLED:-false} SUBSCRIPTIONS_ENFORCED=${SUBSCRIPTIONS_ENFORCED:-false} ====="
} >>"$LOGS/backend.log"
(cd "$HARNESS" && exec setsid nohup "$PY" run_backend.py >>"$LOGS/backend.log" 2>&1 </dev/null) &
for _ in $(seq 1 120); do
  if curl -fsS -o /dev/null --max-time 3 "http://127.0.0.1:$BACKEND_PORT/health" 2>/dev/null; then
    echo "  ✓ backend arriba en http://localhost:$BACKEND_PORT"
    grep -a "\[e1\] backend en" "$LOGS/backend.log" | tail -1
    exit 0
  fi
  sleep 1
done
echo "  ✗ el backend no respondió; mirá $LOGS/backend.log"
exit 1
