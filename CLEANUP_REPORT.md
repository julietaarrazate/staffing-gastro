# CLEANUP_REPORT.md — Limpieza de código

> Alcance: exclusivamente limpieza (dead code confirmado, imports/dependencias
> sin uso, archivos huérfanos, TODO/FIXME viejos, código duplicado). Sin
> cambios de comportamiento, arquitectura ni contratos de API. Cada hallazgo
> se verificó con evidencia (grep/lint/tooling) antes de tocar nada — lo que
> quedó dudoso se documenta como **no tocado**, no se movió a `archive/`
> porque no hizo falta (ver criterio al final).

## 1. Imports sin uso

| Archivo | Qué se sacó | Evidencia |
|---|---|---|
| `backend/alembic/versions/0022_indices_and_check_constraints.py` | `import sqlalchemy as sa` | `ruff check --select F401`; la migración sólo usa `op.*`/`batch_op.*`, ningún `sa.*` |
| `frontend/components/worker/OpportunityCard.tsx` | `WalletIcon` (de `@/components/icons`) | `npm run lint` → `@typescript-eslint/no-unused-vars` |
| `frontend/lib/auth-context.tsx` | comentario `// eslint-disable-next-line react-hooks/exhaustive-deps` (directiva sin efecto) | `npm run lint` → `Unused eslint-disable directive` |

**Íconos exportados sin ningún consumidor** (`frontend/components/icons.tsx`):
`PlayIcon` y `SendIcon` — verificado con grep en todo el repo (`app/`,
`components/`, `lib/`, `e2e/`), cero referencias fuera de su propia
definición. Se sacaron junto con los imports `Play`/`Send` de `lucide-react`
que quedaban sin uso.

## 2. Dependencias sin uso

**Ninguna encontrada**, en ninguno de los dos manifiestos:

- **Backend** (`requirements.txt`): se verificó cada paquete contra imports
  reales. Los que no aparecen como `import X` directo tienen una razón
  legítima: `pywebpush`/`sentry_sdk` se importan de forma diferida (dentro de
  función, no a nivel de módulo — grep con `^import`/`^from` los pasaba por
  alto); `bcrypt` es el backend interno de `passlib`; `aiosqlite` lo usa
  SQLAlchemy vía connection string en tests; `uvicorn` corre desde el
  `CMD` del `Dockerfile`, no se importa en código de la app;
  `python-multipart`/`email-validator` los requiere FastAPI/Pydantic de forma
  implícita (form data, `EmailStr`).
- **Frontend** (`package.json`): mismo resultado. `@sentry/nextjs` se usa vía
  los hooks de instrumentación de Next.js (`instrumentation.ts`,
  `instrumentation-client.ts`), no vía import directo en componentes;
  `maplibre-gl` lo consume `components/map/MapView.tsx`.

## 3. Archivos huérfanos

**Eliminados** (no movidos a `archive/`: la certeza de que no se usan es
completa, verificada dos veces en el tiempo — ver criterio de la sección 6):

| Archivo | Evidencia |
|---|---|
| `frontend/components/ui/SearchInput.tsx` | Ya flagueado sin consumidores en `docs/audits/2026-08-oido/09_CLEANUP.md` (fase de auditoría, sin tocar código por mandato de esa fase). Reverificado ahora: cero referencias fuera de su propia definición y del barrel `ui/index.ts`. |
| `frontend/components/ui/FAB.tsx` | Ídem — mismo hallazgo, misma reverificación. |
| `frontend/components/ui/Chip.tsx` | Ídem — mismo hallazgo, misma reverificación. `StatChip` (un componente *distinto*, privado de `CandidateSignals.tsx`) no se toca: no es lo mismo que este `Chip` exportado. |

Se actualizó `frontend/components/ui/index.ts` sacando los 3 `export`
correspondientes. `git rm` preserva el historial completo por si hiciera
falta recuperarlos — no es una pérdida irreversible.

**Se buscaron huérfanos adicionales y no se encontró ninguno más:** barrido
completo de `components/` (fuera de `ui/`), `lib/` y cada ícono exportado de
`components/icons.tsx` (con la excepción de `PlayIcon`/`SendIcon`, ya
cubiertos en la sección 1) — todos con al menos un consumidor real. También
se corrió `vulture` (detector de dead code para Python) sobre `app/` y
`scripts/`: los únicos hallazgos de confianza ≥80% son falsos positivos
(parámetro `cls` de métodos `@classmethod`/`@field_validator` de Pydantic,
que vulture no reconoce como usado). Con confianza 60% aparecen ~90
hallazgos más, prácticamente todos handlers de FastAPI (invocados por el
router, no por nombre en Python), métodos de `BaseHTTPMiddleware`/
`TypeDecorator` de SQLAlchemy (invocados por el framework) y campos
`model_config`/atributos de schemas Pydantic — ninguno es dead code real.

## 4. TODO/FIXME viejos

**Ninguno encontrado.** Búsqueda de `// TODO`, `// FIXME`, `/* TODO`,
`/* FIXME` en todo `frontend/` y de `# TODO`, `# FIXME` en todo `backend/`:
cero resultados reales (un único falso positivo por la palabra "TODOS" —
español, no el marcador — dentro de un comentario en
`matching/infrastructure/repositories.py`). El repo ya había pasado por una
limpieza de este tipo en una fase anterior; se confirma que sigue así.

## 5. Código duplicado

### 5.1 — `_naive()`: normalización de datetime, duplicada 5 veces

**Antes:** la misma función de una línea (`return dt.replace(tzinfo=None)
if dt.tzinfo is not None else dt`, con variantes del mismo docstring)
estaba copiada, idéntica, en:

- `identity/domain/entities.py`
- `subscription/domain/entities.py`
- `shift/application/services.py`
- `shift/application/scheduler.py`
- `admin/application/services.py`

Cada copia documentaba explícitamente ("mismo fix que...") que sabía de las
otras — repetición consciente, no accidental, probablemente para no cruzar
imports entre módulos de dominio. Pero es una función **pura** (sin ningún
acoplamiento a SQLAlchemy/FastAPI ni a ningún módulo de negocio), y ya existe
precedente de dominio importando utilidades puras desde `app/core`
(`worker/domain/entities.py` importa `app.core.tz.hoy_art`,
`matching/domain/scoring.py` importa `app.core.geo.haversine_km`) — no viola
"no acoplar dominios entre sí" (`CLAUDE.md`), porque `app/core` es
justamente el lugar para esto.

**Ahora:** una sola definición en `backend/app/core/dt.py::naive()`, importada
como `from app.core.dt import naive as _naive` en los 5 archivos (mismo
nombre local `_naive` en cada call site — **cero cambios en las llamadas**,
sólo en el import). Comportamiento idéntico, verificado con la suite
completa (270 passed).

### 5.2 — `_hash_reset_token` / `_hash_verification_token`: mismo hash, dos nombres

**Antes:** dos funciones en `identity/application/services.py`, ambas
`hashlib.sha256(raw_token.encode("utf-8")).hexdigest()` línea por línea
idénticas — una para el token de recuperación de contraseña, otra para el de
verificación de email (agregada en esta misma serie de cambios, sin
notar la duplicación en su momento).

**Ahora:** una sola `_hash_token()`, usada en los 4 call sites (2 por cada
flujo). Mismo comportamiento — es un hash genérico de un token de un solo
uso, no hay nada específico de "reset" o "verification" en la lógica en sí.

### 5.3 — `inputClass` de las pantallas de auth, duplicado literal en 3 archivos

**Antes:** `app/recuperar/page.tsx`, `app/restablecer/page.tsx` y
`app/verificar-email/page.tsx` definían, cada uno por su cuenta, la misma
constante `inputClass` con el mismo string literal de Tailwind
(`"rounded-xl border border-line px-3.5 py-2.5 text-sm outline-none
focus:border-primary focus:ring-2 focus:ring-orange-100"`).

**Ahora:** `AUTH_INPUT_CLASS`, exportada una sola vez desde `lib/cn.ts`
(mismo archivo que ya tenía el helper `cn()` de clases condicionales),
importada en los 3 lugares como `{ AUTH_INPUT_CLASS as inputClass }` para no
tocar el resto de cada componente. Mismo string, mismo resultado visual.

## 6. Revisado y **NO** tocado (incertidumbre real, no se elimina)

- **`UserStatus.DELETED`**, **`SubscriptionStatus.VENCIDA`**,
  **`SubscriptionStatus.CANCELADA`** (enums de dominio): `vulture` los marca
  sin uso (ningún código asigna ni compara contra estos valores hoy), pero a
  diferencia de `SearchInput`/`FAB`/`Chip` no hay ninguna auditoría previa
  que los haya declarado abandonados — leen como modelado de dominio
  deliberado para estados futuros (borrado de cuenta, vencimiento/
  cancelación de suscripción) todavía sin implementar, no como código
  muerto de una feature que se sacó. Costo de mantenerlos: cero (son
  strings de un enum). Se documenta la revisión, no se borra nada.
- **`components/CompanyProfileForm.tsx:78`**: `npm run lint` marca un
  ternario usado como sentencia (`exists ? await api.put(...) : await
  api.post(...)`) con `@typescript-eslint/no-unused-expressions`. Es código
  **vivo y funcional** (ambas ramas se ejecutan correctamente), no dead
  code — es un hallazgo de estilo (debería ser `if/else`), fuera de las
  categorías pedidas para esta limpieza. No se tocó.
- **Warnings de `react-hooks/set-state-in-effect` y `react-hooks/refs`**
  (~20 ocurrencias en `npm run lint`, patrón repetido en varios componentes
  con `useEffect(() => { load(); }, [load])`): son advertencias de un patrón
  de React (no dead code, no duplicación en el sentido de esta tarea) que ya
  formaban parte del baseline conocido de lint antes de esta limpieza
  (`CLAUDE.md`: "`npm run lint` no corre en CI... no lo asumas como gate").
  Tocar esto es un cambio de comportamiento de renderizado, no limpieza —
  fuera de alcance.
- **`components/ImageUpload.tsx`/`WorkerMarker.tsx`/`chats/layout.tsx`/
  `search/page.tsx` sin `cldThumb()`** (ya señalado en
  `NEXT_IMAGE_ANALYSIS.md`): es una inconsistencia de performance, no
  código muerto ni duplicado — no es esta tarea.

## Verificación

- `pytest -q` → **270 passed** (dos corridas completas, antes y después de
  consolidar `_naive`/`_hash_token`).
- `ruff check` sobre todos los archivos backend tocados → limpio (sin
  contar hallazgos de estilo preexistentes no relacionados, `UP017`/`E501`/
  orden de imports ya presente antes de este cambio).
- `npx tsc --noEmit` → sin errores.
- `npm run build` → exitoso, 26 rutas (mismas que antes — ningún archivo
  eliminado era una ruta).
- `npx eslint` sobre cada archivo tocado → sin errores nuevos.
- Cadena de migraciones Alembic (`alembic.script.ScriptDirectory`) → un solo
  head (`0023`), 23 revisiones, intacta tras sacar el import sin uso de la
  migración `0022`.
