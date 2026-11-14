#!/usr/bin/env bash
# status.sh — qué está arriba del arnés de la etapa 1.
source "$(dirname "${BASH_SOURCE[0]}")/_env.sh"
BACKEND_PORT="${PORT:-8000}"

check() { # nombre url
  local code
  code="$(curl -s -o /dev/null --max-time 4 -w '%{http_code}' "$2" 2>/dev/null)"
  if [ "$code" = "200" ]; then echo "  ✓ $1  ($2)"; else echo "  ✗ $1  CAÍDO ($2 → ${code:-sin respuesta})"; fi
}

if pg_isready -q -h localhost -p 5432; then echo "  ✓ postgres  (localhost:5432/$E1_DB)"; else echo "  ✗ postgres  CAÍDO (pg_ctlcluster 16 main start)"; fi
check "simulados" http://127.0.0.1:8901/health
check "backend  " "http://127.0.0.1:$BACKEND_PORT/health"
check "frontend " http://127.0.0.1:3100/login

for port in 8901 "$BACKEND_PORT" 3100; do
  pids="$(fuser "$port/tcp" 2>/dev/null | tr -s ' ')"
  echo "  puerto $port → PID${pids:- (nadie escuchando)}"
done
[ -f "$STATE/admin.json" ] && echo "Admins de prueba: $STATE/admin.json" || echo "Falta admin.json (lo crea start_all.sh)"
echo "Logs: $LOGS/{fakes,backend,frontend}.log · mails: $E1_DIR/mailbox.jsonl"
