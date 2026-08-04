# AUDIT_REPORT.md — Auditoría integral de Staffya (v2)

> Segunda auditoría, posterior al cierre de los quick wins de seguridad y de
> Design System de la v1 (ver historial en git). Metodología: lectura de
> pantallas reales en `frontend/app/`, lectura de las 4 capas de cada módulo en
> `backend/app/modules/`, `grep` de acoplamientos entre módulos, y ejecución
> real de los gates de calidad (`pytest -q`, `npx tsc --noEmit`, `npm run
> build`). Todo hallazgo cita `archivo:línea`. Insumo de
> [TECH_DEBT.md](../TECH_DEBT.md). Contexto en [PRODUCT.md](../foundation/PRODUCT.md),
> [DOMAIN.md](../foundation/DOMAIN.md), [ARCHITECTURE.md](../foundation/ARCHITECTURE.md).

## Resumen ejecutivo

Staffya sigue siendo un producto **sano en su núcleo**: el ciclo de vida del
turno funciona de punta a punta, la arquitectura hexagonal se respeta con
disciplina, y los tres gates de calidad están **verdes en este momento**
(`pytest -q` → 82 passed; `tsc --noEmit` → sin errores; `npm run build` →
compila y prerenderiza las 16 rutas). Los quick wins de la v1 (rate limit,
security headers, secret JWT validado, EmptyState unificado, `SKILL_STYLES`
eliminado, helpers de test) están **efectivamente cerrados** — verificado en
código, no sólo en doc.

Lo que queda pendiente es distinto a lo de la v1: ya no es "deuda de
transición del Design System" sino **piezas de negocio a medio construir**
(asignación de un solo trabajador por turno aunque se pida `quantity>1`,
insignias/niveles sin otorgamiento, métricas de reputación que nunca se
actualizan salvo el rating) y **endurecimiento operativo** (tokens en
`localStorage` sin revocación de refresh, DB de Render a 90 días, cero CI,
cero tests de frontend, cero observabilidad). El detalle completo está en
[TECH_DEBT.md](../TECH_DEBT.md).

## 1. Producto

### Metodología

Recorrido de las pantallas reales en `frontend/app/*/page.tsx` para los tres
roles, contando pasos hasta el evento clave: **worker → primera postulación
enviada** y **employer → primera vacante cubierta**.

### Flujo Worker

`app/page.tsx` (landing) → `app/register/page.tsx` → `app/profile/page.tsx`
(perfil) → `app/feed/page.tsx` (swipe) → postularse → `app/my-shifts/page.tsx`
→ check-in/out → `app/chats/[shiftId]/page.tsx` → reseña (`ReviewBox` dentro de
`my-shifts`).

- **Landing → cuenta:** `app/register/page.tsx:50-69` es un selector binario
  worker/employer + 3 campos (nombre, email, password). Al enviar,
  `router.push("/profile")` (`app/register/page.tsx:30`) — fuerza a completar
  perfil antes de ver turnos. Correcto para calidad de matching, pero es un
  paso más antes del "wow moment".
- **Feed (swipe):** `app/feed/page.tsx:145-158` usa `SwipeDeck` +
  `OpportunityCard`; `onDecide` postula con un solo `POST
  /applications/shifts/{id}` (`app/feed/page.tsx:78-90`). El "like" es **un
  gesto** — el mínimo posible. Maneja el 409 de "ya te postulaste"
  explícitamente (línea 84-86).
- **Conteo de pasos hasta la primera postulación:** landing → registro (1
  submit) → perfil (formulario largo, obligatorio para aparecer en el
  matching) → feed → swipe derecha (1 gesto) = **register + perfil + 1 swipe**.
  El perfil es el cuello de botella real: no se puede postular sin
  `WorkerProfile` creado (`DOMAIN.md` — "Perfil requerido").
- **Ciclo de vida post-match:** `app/my-shifts/page.tsx:140-172` expone **6
  transiciones manuales** que el worker dispara con un tap cada una: `confirm`
  → `depart` → `check-in` (geo) → `start-working` → `check-out` (geo), antes de
  poder dejar reseña. Ninguna es automática (no hay geofencing que dispare
  `check-in` solo al llegar — eso es justamente lo que propone
  [MAPS_REDESIGN.md](../reference/MAPS_REDESIGN.md) §4.4, hoy no implementado). Es
  fricción real pero coherente con "prueba de asistencia" que pide el dominio.
- **Mobile:** `BottomNav.tsx:15-21` con 5 tabs (Inicio/Mapa/Matches/Chats/
  Perfil), `fixed inset-x-0 bottom-0` con `pb-[env(safe-area-inset-bottom)]`
  (`BottomNav.tsx:50`) — respeta el safe area de iOS. PWA instalable via
  `app/manifest.ts`.

**Puntuación: 78/100.** El swipe y la postulación son excelentes (fricción
mínima, feedback claro con toasts). Penaliza: perfil obligatorio largo antes
del primer valor percibido, y 6 taps manuales en el ciclo de asistencia sin
ningún automatismo geolocalizado todavía.

### Flujo Employer

`app/shifts/page.tsx` (panel) → `app/shifts/new/page.tsx` (wizard 5 pasos) →
`app/shifts/[id]/candidates/page.tsx` (postulantes/recomendados) → asignar →
`app/chats/[shiftId]` → `mark-paid` → reseña.

- **Wizard de creación:** `app/shifts/new/page.tsx:15` — 5 pasos (Puesto,
  Personas, Cuándo, Pago, Publicar), con `canNext` que valida cada paso antes
  de avanzar (`app/shifts/new/page.tsx:42-47`) y resumen final antes de
  publicar (líneas 251-259). Es un wizard corto y bien secuenciado — el
  patrón correcto para "publicar en segundos" que promete
  [PRODUCT.md](../foundation/PRODUCT.md).
- **Postulantes → asignación:** `app/shifts/[id]/candidates/page.tsx:59-70`
  hace `POST /shifts/{id}/assign` con un solo `worker_profile_id` y redirige a
  `/shifts`. **Un solo tap para asignar.**
- **Hallazgo de fricción oculta (no es de UI, es de dominio):** el paso 1 del
  wizard (`app/shifts/new/page.tsx:151-171`) deja elegir `quantity` de 1 a 100
  personas, pero el backend sólo puede asignar **un** `worker_profile_id` por
  turno (`backend/app/modules/shift/domain/entities.py:92-99`, sin ningún uso
  de `quantity` en `assign()`). Si un comercio pide "5 mozos", el turno pasa a
  `asignado` (deja de aparecer en el feed, ver `OPEN_STATUSES`) tras cubrir a
  **una sola** persona — el resto de las posiciones nunca se cubre y no hay
  señal en la UI de que falten 4. Detalle en
  [TECH_DEBT.md](../TECH_DEBT.md) (ítem P1).
- **Pago:** `mark-paid` es un botón que cambia estado, no cobra
  (`backend/app/modules/shift/api/routes.py:331-337`) — coherente con lo
  documentado en [PAYMENTS.md](../reference/PAYMENTS.md), sin sorpresas para el usuario
  porque la copy de la UI no promete cobro real.

**Puntuación: 70/100.** El wizard y la asignación son fricción mínima
(publicar en < 1 minuto, asignar en 1 tap). Pero el bug de `quantity` es un
problema de **producto**, no sólo de dominio: el comercio cree haber cubierto
un evento de 5 personas y en realidad cubrió 1. Esto pega directo en la
misión de "cubrir en < 10 minutos" — hoy sólo es verdad para `quantity=1`.

### Flujo Admin

`app/admin/page.tsx` — panel de métricas (`PlatformStats`) + lista de
usuarios con acciones (`act(userId, action)`, línea 60-71: suspender/activar).
Sin wizard, sin onboarding — es una herramienta interna, coherente con su
audiencia. Visualmente **no migrado al Design System**: usa colores Tailwind
crudos en vez de tokens (`STATUS_STYLES` en `app/admin/page.tsx:19-23` usa
`bg-green-100 text-green-700` / `bg-red-100 text-red-700` en vez de
`secondary`/`danger` del DS) y una `StatCard` ad-hoc (línea 25-32) en vez de
`components/ui/Card`. Esto confirma lo que
[RECOMMENDATIONS.md](../planning/RECOMMENDATIONS.md) señalaba: "Admin sin migrar".

**Puntuación: 55/100.** Funcional pero visualmente inconsistente con el resto
de la app; no tiene la calidad de pulido de Worker/Employer.

### Simplicidad y mobile-first (transversal)

- Gestos reales: `SwipeDeck` (worker), carrusel horizontal con snap en
  `/map` — coherente con el patrón Tinder/Uber prometido en
  [PRODUCT.md](../foundation/PRODUCT.md).
- **Formularios inconsistentes con el DS:** existe `components/ui/TextField`
  pero sólo se usa en `app/shifts/new/page.tsx` (1 de 5 pantallas con
  formularios de texto: `register`, `login`, `search`, `chats/[shiftId]` y
  `shifts/new` usan `<input>` crudo — verificado por
  `grep -rl "<input" frontend/app`). Los inputs de login/registro tienen su
  propio `inputClass` hardcodeado (`app/register/page.tsx:11-12`) en vez de
  reusar el componente del DS. Es duplicación de estilo no capturada por los
  quick wins de la v1 (que cerraron botones/EmptyState/SKILL_STYLES pero no
  tocaron inputs).
- **Landing sin migrar al DS v2 monocromático:** `app/page.tsx` usa
  gradientes naranja→rojo en casi todos los bloques (`app/page.tsx:99-100`,
  `114`, `120`, `133`, `187`, `217`, `231`) mientras que `Button.tsx` (el
  componente canónico del DS) ya es sólido/monocromático (`bg-primary` plano,
  sin gradiente — `components/ui/Button.tsx:11-12`). La identidad
  "monocromática + acento único #FF6B00" de `CLAUDE.md` está aplicada en el
  producto autenticado pero **no en la landing**, que es la primera pantalla
  que ve cualquier visitante.

## 2. Arquitectura

- **Capas por módulo:** confirmado en los 10 módulos reales
  (`identity/worker/company/shift/application/matching/notification/chat/
  review/admin`), cada uno con `domain/application/infrastructure/api/`.
- **Regla "domain no depende de nadie" — violación menor detectada:**
  `backend/app/modules/shift/domain/entities.py:22` y
  `backend/app/modules/shift/domain/repositories.py:7` importan
  `app.modules.worker.domain.value_objects.WorkerSkill`; lo mismo en
  `backend/app/modules/matching/domain/repositories.py:6` y
  `backend/app/modules/matching/domain/entities.py:11`. Es el **dominio de
  `shift`/`matching` importando el dominio de `worker`** (aunque sólo un
  enum, no una entidad ni un repo). `ARCHITECTURE.md:55-57` dice "domain no
  depende de nadie" sin matizar este caso — es una inconsistencia doc↔código
  menor (el enum `WorkerSkill` es compartido de facto entre 3 dominios). No es
  grave (no hay ciclos, no se importa lógica de negocio ajena, sólo un value
  object), pero conviene documentarlo como excepción reconocida o mover
  `WorkerSkill` a `app/core/` como tipo compartido.
- **Cruces application→application: no detectados.** Ningún `application/`
  importa el `application/` de otro módulo; todos importan **sólo el
  `domain.repositories` (puerto)** de otros módulos — el patrón que documenta
  `ARCHITECTURE.md:58-67` se cumple en el 100% de los casos revisados (ver
  `shift/application/services.py:5-8`, `chat/application/services.py:13-20`,
  `review/application/services.py:5-19`, `application/application/
  services.py:11-16`, `matching/application/services.py:18-19`).
- **No hay módulo `payment` ni `ai`** — confirmado (`find
  backend/app/modules` no los lista); `mark_paid` vive dentro de `shift`
  (`backend/app/modules/shift/domain/entities.py:148-151`), consistente con
  `MODULES.md:39-41`.
- **Reutilización de puertos como superficie de integración:** correcto y
  consistente en todo el backend.

**Puntuación: 88/100.** Arquitectura disciplinada y con una regla de
dependencia mayormente respetada; el único hallazgo es el acoplamiento de
value object entre 3 dominios, de impacto bajo pero real.

## 3. Backend

- **Casos de uso cohesivos:** cada `Service` (p. ej. `ShiftService`,
  `ReviewService`, `IdentityService`) recibe repos por constructor y no
  conoce HTTP/SQL. `ReviewService._authorize` (`review/application/
  services.py:99-107`) centraliza bien la regla "sólo participantes de un
  turno cerrado pueden reseñar".
- **State machine del turno:** transiciones explícitas y validadas
  (`shift/domain/entities.py:84-151`), cada una lanza
  `InvalidShiftTransitionError` si el estado no matchea — buen diseño,
  fácil de testear (y de hecho testeado: `backend/tests/test_attendance.py`,
  `test_shift.py`).
- **No-disclosure real:** `shift/api/routes.py:71-72` — recurso ajeno o
  inexistente devuelve 404 con mensaje genérico, no 403. Patrón repetido en
  los demás módulos (verificado por muestreo).
- **Mapeo de excepciones de dominio → HTTP:** consistente vía helpers
  `_bad_request`/`_not_found` por módulo (no hay un exception handler global
  en `main.py` — cada router arma sus propios `HTTPException`, funciona pero
  es repetitivo entre módulos; podría centralizarse con
  `@app.exception_handler`).
- **Validaciones de negocio incompletas:**
  - `quantity` (1-100, `shift/api/schemas.py:17`) se persiste pero nunca se
    usa para permitir más de una asignación — ver §1 y `TECH_DEBT.md`.
  - Insignias/niveles: `WorkerBadge`/`GamificationLevel` se leen y se
    serializan (`worker/api/schemas.py:56-57`, `worker/infrastructure/
    repositories.py:38-39`) pero **no hay ningún método que los escriba**
    fuera del valor default en creación de perfil
    (`worker/domain/entities.py:43-44`, default `[]`/`BRONCE`). Confirmado
    con `grep` — cero escrituras de `badges`/`level` en todo el backend.
  - Métricas de reputación derivadas (`punctuality_rate`, `events_completed`,
    `cancellations`, `on_time_payment_rate`, `events_published`): se leen en
    matching (`matching/domain/scoring.py:39-51`) y se muestran en perfiles,
    pero **sólo el `rating`** se recalcula al recibir una reseña
    (`review/application/services.py:118-126`, `_update_aggregate_rating`).
    El resto queda fijo en su valor de creación para siempre — confirmado por
    `grep` (ningún `update_*` para esos campos existe).
- **Tests backend: verde real.** `pytest -q` → **82 passed**, 0 failed
  (ejecutado en esta auditoría). Warnings no bloqueantes: `InsecureKeyLength`
  (clave de test de 26 bytes, esperado en entorno de test) y un
  `PytestWarning` por un marcador `@pytest.mark.asyncio` sobrante en
  `tests/test_chat.py:150` (la función no es async — cosmético, no rompe
  nada).

**Puntuación: 80/100.** Buen diseño de casos de uso y máquina de estados;
penaliza la brecha entre "el dato existe en el modelo" y "el dato se
actualiza" en 3 áreas de negocio (cantidad, insignias, métricas derivadas).

## 4. Frontend

- **Design System (`components/ui/`):** 17 componentes (`Avatar, Badge,
  Button, Card, Chip, EmptyState, ErrorBanner, FAB, Modal, Rating,
  SearchInput, SegmentedControl, Sheet, Skeleton, Spinner, TextField, Toast`)
  con barrel `index.ts`. `PageState.tsx` **confirmado eliminado**
  (`find frontend -iname "PageState*"` → sin resultados); `SKILL_STYLES`
  **confirmado eliminado** (`grep -rn "SKILL_STYLES" frontend` → sin
  resultados), sólo queda `SKILL_ACCENT` (`lib/skill-style.tsx`, usado en 6
  archivos). Ambos quick wins de la v1 están cerrados en código, no sólo en
  doc.
- **Pero el DS no está completo:** `TextField` existe y es sólido, pero 4 de
  5 pantallas con inputs de texto no lo usan (ver §1). El `Button` del DS es
  monocromático pero la landing (`app/page.tsx`) no lo usa en absoluto — sus
  CTAs son `<Link>` con clases Tailwind + gradiente inline
  (`app/page.tsx:131-142`, `243-254`), no el componente `Button`.
- **Estado:** un solo contexto, `lib/auth-context.tsx` (usuario, tokens,
  login/registro/logout, refresh). Sin Redux/Zustand — proporcional al tamaño
  de la app. Correcto.
- **Navegación:** `BottomNav.tsx` por rol (`WORKER_TABS`/`EMPLOYER_TABS`/
  `ADMIN_TABS`, líneas 15-33) + `md:hidden` (oculto en desktop) — coherente
  con mobile-first.
- **Responsive:** clases `md:`/`sm:` presentes en casi todas las pantallas;
  `app/feed/page.tsx:95` calcula alturas con `calc(100dvh-4rem-5rem)` para
  convivir con navbar + bottom nav — atención real al viewport móvil con
  teclado/notch.
- **Accesibilidad:**
  - `aria-*` presente en sólo **13 de 56** archivos `.tsx` de `app/` +
    `components/` (`grep -rl "aria-" frontend/app frontend/components`).
    Cobertura parcial: botones icon-only como el toggle de disponibilidad
    (`app/feed/page.tsx:114`, `aria-label="Cambiar disponibilidad"`) y el
    back button del wizard (`app/shifts/new/page.tsx:87`,
    `aria-label="Atrás"`) sí la tienen; pero no está sistematizado (no hay
    lint rule ni checklist).
  - `focus-visible`/`focus:ring` en sólo 7 de 56 archivos — el foco de
    teclado depende sobre todo de los componentes del DS (`Button.tsx:65`
    trae `focus-visible:ring-2` de fábrica), pero las pantallas con controles
    ad-hoc (toggles, botones del wizard) no siempre lo replican.
  - Touch targets: `Button.tsx:23-27` fuerza `min-h-[40/48/56px]` — cumple
    "44px mínimo" que el propio comentario del código menciona
    (`Button.tsx:22`).
  - `<img>` (7 usos) vs `next/image` (0 usos) — igual que en la v1, sin
    cambios; todos con `loading="lazy"` donde aplica.
- **TypeScript:** **cero `any`** en todo `frontend/app`, `frontend/components`,
  `frontend/lib` (`grep -rn ": any\b\|as any\b"` → 0 resultados). Tipado
  consistente vía `lib/types.ts`. `npx tsc --noEmit` → **sin errores**
  (ejecutado en esta auditoría).
- **Build:** `npm run build` → compila y genera las 16 rutas (12 estáticas +
  4 dinámicas) sin errores (ejecutado en esta auditoría).

**Puntuación: 75/100.** DS sólido y sin `any`; penaliza la landing sin migrar,
los formularios con `TextField` subutilizado, y la cobertura desigual de
accesibilidad (funciona en los componentes core, no está garantizada en el
resto).

## 5. APIs

- **Versionado:** todo bajo `/api/v1` (`backend/app/main.py:58` en adelante,
  cada `include_router(..., prefix="/api/v1")`). Consistente.
- **Contratos Pydantic:** schemas separados de entidades de dominio
  (`api/schemas.py` por módulo), con validación declarativa (`Field(default=1,
  ge=1, le=100)` en `shift/api/schemas.py:17`).
- **Errores:** HTTP status coherente con la semántica (400 para inválido, 404
  para no-disclosure, 409 para duplicados — visto en `feed/page.tsx:84`
  manejando un 409 de postulación duplicada del lado frontend). No hay
  `exception_handler` global; cada módulo repite `_bad_request`/`_not_found`
  — funciona pero es un patrón duplicado ~10 veces que podría vivir en
  `app/core/`.
- **Rate limiting en endpoints sensibles:** confirmado activo — `RateLimiter`
  aplicado a `/auth/login` (10/min) y `/auth/register`
  (`identity/api/routes.py:36-47`), configurable con `RATE_LIMIT_ENABLED`. No
  se extiende a otros endpoints de escritura (p. ej. `POST /applications`,
  `POST /shifts`), lo cual es razonable dado que requieren auth (menor
  superficie de abuso anónimo).
- **Falta:** documentación formal de contrato (`API.md` existe pero no se
  generó desde OpenAPI/Swagger explícitamente en el repo — FastAPI expone
  `/docs` automático, que cubre esto en runtime).

**Puntuación: 85/100.** Consistente y predecible; el único menos es la
repetición de mapeo de errores por módulo en vez de un handler central.

## 6. Tiempo real (WebSockets)

- **Dos canales**, confirmados: chat (`WS /api/v1/chats/{shift_id}/ws`) y
  notificaciones (`WS /api/v1/notifications/ws`).
- **Auth:** `get_current_user_ws` + validación de participante en chat
  (`assert_participant`, mencionado en `CHAT.md`) — el token viaja como query
  param porque el WebSocket del navegador no soporta header `Authorization`
  (documentado explícitamente en `frontend/lib/useWebSocket.ts:13-14`).
- **Reconexión con backoff exponencial — confirmada en código, no sólo en
  doc:** `frontend/lib/useWebSocket.ts:43-48` — `delay = min(1000 * 2^attempt,
  15000)`, tope de 15s, reintenta indefinidamente mientras el componente esté
  montado, y limpia el timer en cleanup (`useWebSocket.ts:55-59`). Es una
  implementación correcta y simple (un único hook reutilizado por chat y
  notificaciones).
- **Manejo de frames inválidos:** `try/catch` silencioso alrededor de
  `JSON.parse` (`useWebSocket.ts:36-40`) — no rompe la conexión por un
  mensaje malformado, pero tampoco loggea el error (podría ocultar bugs de
  contrato en producción).
- **Límites de conexión/mensajes por usuario:** no se encontraron (ausencia
  confirmada por `grep` de rate limiting alrededor de los endpoints WS) —
  sigue siendo deuda, igual que en la v1.

**Puntuación: 80/100.** La base (auth + reconexión) es sólida y ya está en
producción, no en propuesta; falta hardening de cuotas.

## 7. Geolocalización

- **Estado actual (Leaflet), confirmado:** `components/worker/ShiftMap.tsx`,
  `components/WorkerSearchMap.tsx`, `components/MiniMap.tsx` — tiles CARTO
  Voyager raster vía `lib/map-tiles.ts`, sin API key. Distancia por Haversine
  **duplicada**: `frontend/app/map/page.tsx` (`haversineKm`) y
  `backend/app/core/geo.py` (usado por matching) — mismo cálculo en dos
  lenguajes, sin helper compartido.
- **Check-in/out geolocalizado:** confirmado en dominio
  (`shift/domain/entities.py:126-142`, captura lat/lng + timestamp en las
  transiciones `check_in`/`check_out`) y en frontend
  (`app/my-shifts/page.tsx:82-94`, `act(id, path, geo=true)` llama
  `getCurrentPosition()` de `lib/geolocation.ts` antes del POST). Es
  **one-shot** (una lectura de posición al tocar el botón), no hay
  `watchPosition` ni geofencing — el worker puede marcar check-in aunque esté
  lejos del turno; el backend no valida proximidad hoy (confirmado: no hay
  cálculo de distancia entre check-in y la ubicación del turno en
  `shift/application/services.py`).
- **Rediseño propuesto:** [MAPS_REDESIGN.md](../reference/MAPS_REDESIGN.md) — documento
  de diseño completo y aprobado como propuesta (Leaflet → MapLibre GL,
  clustering, `watchPosition`, geofencing, rutas OSRM), **estado: PROPUESTA,
  nada implementado todavía** (confirmado: no existe `maplibre-gl` en
  `frontend/package.json`, sólo `leaflet`/`react-leaflet`). El diagnóstico de
  ese documento (raster vs vectorial, pines como HTML string duplicados en 3
  archivos, Haversine duplicado) coincide con lo verificado acá.

**Puntuación: 65/100.** Funciona y cubre el caso de uso base (distancia +
prueba de asistencia con coordenadas), pero es la pieza con el techo de
calidad más bajo del producto hoy — exactamente el diagnóstico que ya motivó
el rediseño en `MAPS_REDESIGN.md`. La nota reconoce tanto lo que funciona como
que la mejora ya está diseñada y sólo falta ejecutarla.

## 8. DevOps

- **`render.yaml`:** un servicio Docker (`dockerfilePath: ./backend/
  Dockerfile`), DB Postgres `plan: free`, `healthCheckPath: /health`,
  `autoDeploy: true`. `JWT_SECRET_KEY: generateValue: true` (Render genera un
  secreto real en producción, mitigando el riesgo del default inseguro).
  **Detalle a revisar:** `SEED_DEMO_DATA: "true"` está seteado en el
  `render.yaml` de producción (`render.yaml`, bloque `envVars`) — siembra
  datos demo (con imágenes de `loremflickr.com`, ver
  `backend/scripts/seed_demo_data.py:61`) directamente en el ambiente
  productivo en cada arranque en frío. Es intencional ("permite probar la app
  sin registrarse", según el comentario en el propio archivo) pero mezcla
  datos demo con datos reales de usuarios en la misma base — sin bandera para
  desactivarlo una vez que haya usuarios reales.
- **`backend/Dockerfile`:** simple y correcto — `python:3.11-slim`, instala
  deps, `CMD` encadena `alembic upgrade head && python -m scripts.startup_seed
  && uvicorn ...`. Sin multi-stage build (imagen más pesada de lo necesario,
  no crítico a esta escala).
- **Frontend/Vercel:** sin `vercel.json` explícito (Vercel autodetecta
  Next.js — válido, pero sin control fino de headers/redirects a nivel
  config-as-code).
- **CI: ausente.** `find . -path "*/.github/workflows/*"` → sin resultados.
  No hay pipeline que corra `pytest`/`tsc`/`build` antes de mergear a `main`
  (que despliega automáticamente a Render/Vercel) — hoy la única red de
  seguridad es que quien commitea corra los gates a mano.
- **Sin staging:** un solo ambiente (`main` → producción directa en ambos
  lados).
- **Backups/rollback:** no documentados. `render.yaml` no define política de
  backup de la DB; el rollback de deploy dependería de las herramientas
  nativas de Render/Vercel (no hay guía en `docs/reference/DEPLOY.md` sobre cómo
  ejecutarlo).
- **DB con expiración:** riesgo ya identificado y con plan documentado
  (`backend/README.md:169-189`, migración a Neon con pasos concretos), pero
  **no ejecutado todavía** (sigue apuntando al Postgres free de Render).

**Puntuación: 45/100.** Es un despliegue funcional de proyecto en etapa
temprana (auto-deploy, healthcheck, secretos por env), pero le faltan los
controles básicos de un pipeline de producción: CI, staging, backups y la
migración de DB pendiente hace tiempo.

## Tabla final de puntuaciones

| Área | Puntuación | Principal razón |
|------|:---:|------|
| Producto — Worker | 78/100 | Swipe/postulación excelente; perfil largo antes del primer valor, 6 taps manuales en asistencia |
| Producto — Employer | 70/100 | Wizard y asignación de fricción mínima; bug real de `quantity` no cubre posiciones múltiples |
| Producto — Admin | 55/100 | Funcional, visualmente no migrado al DS |
| Arquitectura | 88/100 | Capas y puertos respetados; acoplamiento menor de `WorkerSkill` entre 3 dominios |
| Backend | 80/100 | Casos de uso y máquina de estados sólidos; brecha dato-existe vs dato-se-actualiza en 3 áreas |
| Frontend | 75/100 | DS sin `any`, PageState/SKILL_STYLES cerrados; landing e inputs sin migrar, accesibilidad desigual |
| APIs | 85/100 | Versionado, contratos y errores consistentes; mapeo de excepciones repetido por módulo |
| Tiempo real | 80/100 | Auth + reconexión con backoff confirmados en código; sin cuotas por usuario |
| Geolocalización | 65/100 | Funciona (Haversine + check-in geo); techo de calidad raster/one-shot, mejora ya diseñada en MAPS_REDESIGN.md |
| DevOps | 45/100 | Deploy automático funcional; sin CI, sin staging, sin backups, DB de 90 días sin migrar |

## Conclusión

La v1 de esta auditoría decía "sano en el núcleo, en transición en la
presentación" — la transición de presentación **se cerró de verdad** (quick
wins verificados en código). Lo que queda no es cosmético: es completar
lógica de negocio a medias (`quantity`, insignias, métricas de reputación) y
construir la infraestructura operativa que un producto en producción real
necesita (CI, staging, backups, revocación de sesión, migración de DB). Ver
el detalle accionable en [TECH_DEBT.md](../TECH_DEBT.md).
