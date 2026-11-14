#!/usr/bin/env bash
# stop_all.sh — baja los tres servidores del arnés por PUERTO.
# Nunca `pkill -f "next start"`: mata también la shell que lo corre
# (docs/reference/SESION_CLOUD.md §4). Postgres queda arriba.
#   stop_all.sh            baja los tres
#   stop_all.sh backend    baja sólo uno (simulados | backend | frontend)
BACKEND_PORT="${PORT:-8000}"
only="${1:-todo}"

stop() { # nombre puerto
  if fuser -k "$2/tcp" >/dev/null 2>&1; then echo "  ✓ $1 (puerto $2) detenido"; else echo "  · $1 (puerto $2) no estaba corriendo"; fi
}

case "$only" in
  todo) stop frontend 3100; stop backend "$BACKEND_PORT"; stop simulados 8901 ;;
  frontend) stop frontend 3100 ;;
  backend) stop backend "$BACKEND_PORT" ;;
  simulados | fakes) stop simulados 8901 ;;
  *) echo "uso: stop_all.sh [frontend|backend|simulados]"; exit 2 ;;
esac
