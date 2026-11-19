# _env.sh — variables comunes de los scripts (se usa con `source`).
#   E1_DIR   estado y datos generados, FUERA del repo   (defecto /tmp/oido-e2e)
#   E1_REPO  raíz del repo                              (defecto: tools/e2e-local/../..)
#   E1_PY    intérprete de Python                       (defecto $E1_DIR/venv/bin/python)
#   E1_DB    base local de Postgres                     (defecto oido_e1)
HARNESS="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
export E1_DIR="${E1_DIR:-/tmp/oido-e2e}"
export E1_REPO="${E1_REPO:-$(cd "$HARNESS/../.." && pwd)}"
export E1_PY="${E1_PY:-$E1_DIR/venv/bin/python}"
export E1_DB="${E1_DB:-oido_e1}"
export DATABASE_URL="${DATABASE_URL:-postgresql+asyncpg://oido:oido@localhost:5432/$E1_DB}"
E1="$E1_DIR"
PY="$E1_PY"
REPO="$E1_REPO"
STATE="$E1_DIR/state"
LOGS="$E1_DIR/logs"
