#!/usr/bin/env bash
# setup.sh — deja el arnés listo desde cero en un contenedor nuevo. Idempotente.
#   setup.sh            lo que falte (venv, Postgres, base, migraciones, build)
#   setup.sh --build    además reconstruye el frontend aunque ya haya build
# Variables: E1_DIR · E1_REPO · E1_PY · E1_DB (ver README.md).
set -eu
source "$(dirname "${BASH_SOURCE[0]}")/_env.sh"

FORCE_BUILD=0
for arg in "$@"; do
  case "$arg" in
    --build) FORCE_BUILD=1 ;;
    *) echo "uso: setup.sh [--build]"; exit 2 ;;
  esac
done

mkdir -p "$E1_DIR" "$STATE" "$LOGS/sessions" "$E1_DIR/evidence" "$E1_DIR/cloud"
echo "Repo: $E1_REPO · datos: $E1_DIR · base: $E1_DB"

# 1. venv de Python con uv (receta de docs/reference/SESION_CLOUD.md §2)
if [ -x "$E1_PY" ] && "$E1_PY" -c "import fastapi, alembic, asyncpg" 2>/dev/null; then
  echo "  ✓ venv ya listo ($E1_PY)"
else
  echo "  … creando venv e instalando backend/requirements.txt"
  [ -x "$E1_PY" ] || uv venv -q -p 3.11 "$(dirname "$(dirname "$E1_PY")")"
  uv pip install -q -p "$E1_PY" -r "$E1_REPO/backend/requirements.txt"
  echo "  ✓ venv listo"
fi

# 2. Postgres local
if ! pg_isready -q -h localhost -p 5432; then
  echo "  … Postgres caído: lo levanto"
  pg_ctlcluster 16 main start
  for _ in $(seq 1 20); do pg_isready -q -h localhost -p 5432 && break; sleep 1; done
fi
pg_isready -q -h localhost -p 5432 || { echo "  ✗ Postgres no levantó"; exit 1; }
echo "  ✓ postgres arriba"

# 3. Rol y base (sólo si no existen)
as_postgres() { if [ "$(id -u)" = "0" ]; then runuser -u postgres -- "$@"; else "$@"; fi; }
psql_admin() { as_postgres psql -X -q -tA -v ON_ERROR_STOP=1 "$@"; }
if [ "$(psql_admin -c "select 1 from pg_roles where rolname='oido'")" != "1" ]; then
  psql_admin -c "create role oido login password 'oido' createdb"
  echo "  ✓ rol oido creado"
else
  echo "  ✓ rol oido ya existía"
fi
if [ "$(psql_admin -c "select 1 from pg_database where datname='$E1_DB'")" != "1" ]; then
  psql_admin -c "create database \"$E1_DB\" owner oido"
  echo "  ✓ base $E1_DB creada"
else
  echo "  ✓ base $E1_DB ya existía"
fi

# 4. Migraciones (alembic upgrade head; idempotente)
(cd "$E1_REPO/backend" && "$E1_PY" -m alembic upgrade head) >"$LOGS/alembic.log" 2>&1 \
  || { echo "  ✗ alembic falló (ver $LOGS/alembic.log)"; tail -n 15 "$LOGS/alembic.log"; exit 1; }
echo "  ✓ migraciones al día (head)"

# 5. Frontend: build sólo si no hay o si se pidió --build.
#    (BUILD_ID se mira con un test de shell: las herramientas de lectura no
#    pueden abrir frontend/.next.)
FRONT="$E1_REPO/frontend"
if [ "$FORCE_BUILD" = "1" ] || [ ! -f "$FRONT/.next/BUILD_ID" ]; then
  [ -d "$FRONT/node_modules" ] || { echo "  … npm ci"; (cd "$FRONT" && npm ci --no-audit --no-fund >"$LOGS/npm-ci.log" 2>&1); }
  echo "  … npm run build (puede tardar unos minutos)"
  (cd "$FRONT" && \
    NEXT_PUBLIC_API_URL=http://localhost:8000/api/v1 \
    NEXT_PUBLIC_GOOGLE_CLIENT_ID=e1-fake.apps.googleusercontent.com \
    NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME=oido-e1 \
    NEXT_TELEMETRY_DISABLED=1 \
    npm run build >"$LOGS/frontend-build.log" 2>&1) \
    || { echo "  ✗ el build falló (ver $LOGS/frontend-build.log; si es por Google Fonts mirá SESION_CLOUD.md §3)"; exit 1; }
  echo "  ✓ build del frontend hecho"
else
  echo "  ✓ build del frontend ya existe (--build para rehacerlo)"
fi

echo "Listo. Siguiente: $HARNESS/start_all.sh"
