# PERFORMANCE_REPORT.md — Auditoría de performance (Staffya)

> Auditoría técnica basada en lectura directa del código (backend
> `backend/app/`, frontend `frontend/`). Cada hallazgo cita `archivo:línea`.
> No incluye cambios de código — es insumo para priorizar trabajo futuro junto
> con [TECH_DEBT.md](./TECH_DEBT.md) y [SCALABILITY_REPORT.md](./SCALABILITY_REPORT.md).
> Contexto de arquitectura en [ARCHITECTURE.md](./ARCHITECTURE.md) y
> [DATABASE.md](./DATABASE.md).

## Resumen ejecutivo

Con el volumen de datos actual (seed demo: 12 comercios, 14 trabajadores, 14
turnos — `backend/scripts/seed_demo_data.py:66,215,445`) **nada de esto se
siente**. El riesgo es estructural: casi ningún listado del backend pagina, el
motor de matching escanea todos los trabajadores disponibles en Python, y hay
varios patrones N+1 reales (no potenciales) en los endpoints de mensajería y
postulaciones. Son baratos de arreglar hoy y caros de diagnosticar después,
cuando ya duelan en producción.

**Puntuación global de performance: 58/100** — arquitectura limpia y consultas
individualmente bien escritas (índices correctos, `func.avg` en vez de Python
donde importa), pero sin ningún límite de tamaño en las rutas de lectura ni
capa de caché, y con un N+1 severo en el inbox de chat.

---

## 1. Backend

### 1.1 Consultas N+1 reales

#### P1 — Inbox de chat: hasta ~6 queries por conversación, secuenciales

- **Archivo:** `backend/app/modules/chat/application/services.py:89-121`
  (`list_conversations`), con sus helpers `_participants` (138-146),
  `_worker_display` (148-155), `_company_display` (157-161) y
  `_shifts_for_user` (163-171).
- **Descripción:** por cada turno del usuario, `list_conversations` hace, **en
  serie** (`await` dentro de un `for`): 1 query de `last_message` (línea 93),
  2 queries en `_participants` (`companies.get_by_id` + `workers.get_by_id`,
  líneas 142-143), 1-2 queries más en `_worker_display`/`_company_display`
  (que **repiten** la consulta de `worker`/`company` ya resuelta en
  `_participants`, líneas 151-152 y 158) y 1 query de `count_unread` (línea
  116). Para un usuario con 20 conversaciones activas son **~120 queries
  secuenciales** para pintar el inbox.
- **Impacto:** el endpoint `GET /chats` (`backend/app/modules/chat/api/routes.py:42-43`)
  se vuelve lineal en el número de turnos del usuario, con latencia de red
  añadida por cada `await` (no hay `asyncio.gather`).
  Es, además, el único canal de mensajería del producto — se usa en cada
  sesión activa.
- **Riesgo:** alto a mediano plazo (crece con el uso normal de la app, no con
  un caso raro).
- **Prioridad:** **Alta**.
- **Esfuerzo:** medio (agregar métodos de repo por-lote —
  `get_many_by_ids`— y eliminar la doble consulta de `worker`/`company` que ya
  resuelve `_participants`; reutilizar ese resultado en `_worker_display`/`_company_display`
  en vez de volver a pedirlo).
- **Dependencias:** ninguna (cambio interno al módulo `chat`).
- **Solución:** batchear `worker`/`company`/`user` por lista de IDs con
  `WHERE id IN (...)`, y pasar los objetos ya resueltos a los helpers en vez
  de volver a pedirlos. Considerar una única query con `JOIN`/subquery para
  `last_message` + `unread_count` por turno.

#### P2 — Postulantes de un turno: 2N+1 queries

- **Archivo:** `backend/app/modules/application/api/routes.py:84-99`
  (`shift_applicants`).
- **Descripción:** por cada `ShiftApplication` del turno, hace
  `workers.get_by_id(...)` (línea 85) y luego `users.get_by_id(...)` (línea
  88) **en un loop secuencial**. Con 30 postulantes en un turno urgente
  (escenario típico de "cubrir en 10 minutos"), son 61 queries para una sola
  pantalla.
- **Impacto:** el comercio ve esta pantalla en el momento más sensible del
  producto (elegir quién cubre el turno **ya**); es contraproducente que sea
  la vista más lenta.
- **Riesgo:** alto — escala con la popularidad del turno, justo el caso que
  el producto quiere fomentar.
- **Prioridad:** **Alta**.
- **Esfuerzo:** bajo (agregar `list_by_ids` a `WorkerProfileRepository` y
  `UserRepository`, o un `JOIN` directo en el repo de `application`).
- **Dependencias:** ninguna.
- **Solución:** una query con `worker_profile_id IN (...)` + `user_id IN
  (...)` (o un `JOIN` de tres tablas en el propio repositorio de
  `shift_applications`), en vez de instanciar `SqlAlchemyWorkerProfileRepository`/
  `SqlAlchemyUserRepository` ad-hoc dentro de la ruta (nótese que hoy la ruta
  construye repos "a mano" con la sesión, `application/api/routes.py:81-82`,
  fuera del patrón de DI del resto del módulo).

#### P3 — Feed/mis-turnos: N queries de comercio (mitigado por caché local, no por batch)

- **Archivo:** `backend/app/modules/shift/api/routes.py:48-64`
  (`_with_company_info`).
- **Descripción:** por cada turno se resuelve `company_id` con un `dict`
  como caché **dentro del propio request** (línea 53-58) — evita repetir la
  misma empresa dos veces, pero **no** batchea: si el feed trae 40 turnos de
  40 comercios distintos (mapa realista con multi-comercio), son 40 queries
  secuenciales de todos modos. Se usa en `/shifts/feed` (línea 104) y
  `/shifts/mine` (línea 125).
- **Impacto:** medio hoy (12 comercios en el seed ⇒ como máximo 12 queries);
  crece linealmente con la cantidad de comercios activos, no con la de
  turnos.
- **Riesgo:** medio.
- **Prioridad:** Media.
- **Esfuerzo:** bajo (una query `company_id IN (...)` antes del loop).
- **Dependencias:** ninguna.
- **Solución:** `CompanyProfileRepository.list_by_ids(ids)` con un solo
  `SELECT ... WHERE id IN (...)`, y armar el `dict` de una vez.

### 1.2 Costo del matching (`app/modules/matching`)

#### P4 — El motor de recomendación carga y filtra en Python, sin acotar por SQL

- **Archivos:**
  `backend/app/modules/matching/infrastructure/repositories.py:39-55`
  (`list_available`) y
  `backend/app/modules/matching/application/services.py:52,65`
  (`get_top_candidates`, `search_workers`).
- **Descripción:** `list_available` trae de la DB **todos** los
  `worker_profiles` con `is_available = True` (join simple con `users` para
  el nombre), sin filtrar por ciudad, distancia ni bounding box (líneas
  42-47). El filtro por `skill` se hace **en Python**, recorriendo la lista
  completa (líneas 49-54, comentario explícito: *"El filtro por habilidad se
  hace en Python: `skills` es JSON..."*). Después, `rank_candidates`
  (`domain/scoring.py`) calcula Haversine para cada candidato en Python
  (`get_top_candidates`, línea 53) y `search_workers` hace lo mismo para la
  búsqueda por mapa (líneas 66-85). No hay bounding box previo por
  lat/lng ni límite de filas: **es un full scan de `worker_profiles`
  disponibles en cada llamado**, tanto para "candidatos recomendados" (se
  llama cada vez que el comercio abre un turno) como para "buscar
  trabajadores por mapa".
- **Impacto:** hoy 14 workers ⇒ imperceptible. Con miles de trabajadores
  disponibles en una ciudad, cada apertura de turno o cada movimiento del
  mapa de búsqueda dispara un full scan + scoring en Python sobre toda la
  tabla.
- **Riesgo:** alto a mediano/largo plazo — es el corazón del producto
  ("Tinder para turnos"); si se degrada, se degrada la propuesta de valor
  (< 10 minutos para cubrir).
- **Prioridad:** **Alta** (no urgente hoy, pero es el techo de escala más
  bajo de todo el backend — ver también `SCALABILITY_REPORT.md`).
- **Esfuerzo:** medio (filtrar por ciudad/bounding box en SQL antes de traer
  filas; el filtro de `skill` sobre JSON puede resolverse con
  `?|`/`@>` de Postgres —perdiendo portabilidad con SQLite en tests— o
  desnormalizando a una tabla `worker_skills`).
- **Dependencias:** decisión de portabilidad SQLite-en-tests vs. operadores
  JSON de Postgres; potencialmente PostGIS (ya "previsto", requiere ADR según
  [DATABASE.md](./DATABASE.md#inconsistencias--pendientes)).
- **Solución (incremental, sin romper arquitectura):** 1) filtrar por
  `city`/bounding box de lat-lng en el `WHERE` antes de traer filas; 2)
  mover el filtro de `skill` a SQL (aunque sea con `LIKE`/`ILIKE` sobre el
  JSON serializado, o una tabla puente); 3) recién ahí, scoring en Python
  sobre un subconjunto acotado (cientos, no miles, de filas).

### 1.3 Listados sin límite ni paginación

- **Hallazgo transversal:** ningún endpoint de listado del backend acepta
  `limit`/`offset` ni los aplica por defecto. Confirmado por búsqueda de
  `.limit(`/`.offset(` en `app/modules/**`: el único uso es
  `backend/app/modules/chat/infrastructure/repositories.py:55` (`.limit(1)`
  para `last_message`, no paginación real).
- **Endpoints afectados (todos devuelven la tabla completa que aplica):**
  - `GET /shifts/feed` — `backend/app/modules/shift/api/routes.py:90-104` →
    `ShiftRepository.list_open` (`shift/infrastructure/repositories.py:127-146`):
    trae **todos** los turnos abiertos de la plataforma, sin límite.
  - `GET /shifts/me`, `GET /shifts/mine` — `list_by_company`/`list_by_worker`
    (`shift/infrastructure/repositories.py:109-125`): historial completo.
  - `GET /applications/mine`, `GET /applications/shifts/{id}` —
    `list_by_worker`/`list_by_shift`
    (`application/infrastructure/repositories.py:60-76`).
  - `GET /notifications` — `list_by_user`
    (`notification/infrastructure/repositories.py:60-67`): historial
    completo de notificaciones, sin `read`/`unread` ni límite.
  - `GET /reviews/received` — `list_received_by_user`
    (`review/infrastructure/repositories.py:59-66`).
  - `GET /admin/users` — `UserRepository.list_all` (usado en
    `admin/application/services.py:25-27` y en `get_stats`, ver P5): **toda**
    la tabla `users`.
- **Impacto:** cada uno de estos hoy devuelve ≤14 filas. El día que la
  plataforma tenga cientos/miles de turnos o usuarios, estas respuestas
  crecen sin límite: más payload JSON, más tiempo de serialización Pydantic,
  más memoria por request, más tiempo de render en el cliente (sección 3).
- **Riesgo:** alto — es el patrón que más "explota silenciosamente": no
  falla, se degrada gradualmente y sin alarma (no hay métricas, ver
  [OBSERVABILITY.md](./OBSERVABILITY.md)).
- **Prioridad:** **Alta**.
- **Esfuerzo:** medio (agregar `limit`/`offset` o cursor a cada firma de
  repo + parámetros de query en cada ruta; para `/shifts/feed` en particular,
  conviene además acotar por ciudad/fecha por defecto, no sólo paginar).
- **Dependencias:** cambio de contrato de API (versionar respuesta o
  documentar en `API.md`); el frontend deberá adoptar paginación/scroll
  infinito (ver sección 3.3).
- **Solución:** paginación estándar (`limit`/`offset` o keyset por
  `created_at`) en los puertos de repositorio, con un tope por defecto (p.ej.
  50) aplicado aunque el cliente no lo pida.

### 1.4 Full scan + agregación en Python (panel de admin)

#### P5 — `/admin/stats` trae toda la tabla `users` y cuenta en Python

- **Archivo:** `backend/app/modules/admin/application/services.py:29-40`
  (`get_stats`).
- **Descripción:** `await self._users.list_all()` trae **todas** las filas
  de `users` y calcula `total_users`, `workers`, `employers`, `admins`,
  `active`, `suspended`, `verified` con `sum(1 for u in users if ...)` en
  Python — siete pasadas sobre la misma lista en memoria, además de la
  llamada duplicada en `list_users` (línea 25-27) si la UI pide ambas cosas
  (ve el `Promise.all` en `frontend/app/admin/page.tsx:44-45`).
- **Contraste positivo:** el propio repo de `review` sí usa agregación en
  SQL correctamente — `average_rating`
  (`review/infrastructure/repositories.py:68-74`) usa `func.avg(...)` en la
  base, no Python. Vale la pena replicar ese patrón en `admin`.
- **Impacto:** bajo hoy (panel sólo-admin, tráfico bajo); crece linealmente
  con la base de usuarios total de la plataforma, no con el uso.
- **Riesgo:** bajo-medio.
- **Prioridad:** Media (fácil de resolver y evita que `/admin/stats` se
  vuelva la página más lenta del panel a medida que crece la base de
  usuarios).
- **Esfuerzo:** bajo.
- **Dependencias:** ninguna.
- **Solución:** `SELECT role, status, is_verified, COUNT(*) ... GROUP BY` (o
  varias queries `func.count()` filtradas) en vez de traer y contar en
  Python.

### 1.5 Transacciones: commit por operación de repositorio, no por caso de uso

- **Archivos representativos:** cada método `add`/`update` de los
  repositorios (p.ej. `shift/infrastructure/repositories.py:88-103`,
  `notification/infrastructure/repositories.py` — `add`) llama
  `await self._session.commit()` **dentro del propio repo**.
- **Descripción:** casos de uso que escriben en más de un agregado no son
  atómicos. Ejemplo concreto: `ShiftService.assign_worker`
  (`shift/application/services.py:93-104`) hace `await self._shifts.update(shift)`
  (commit #1) y luego `await self._notify_worker(...)` → `notifications.add(...)`
  (commit #2). Si el segundo commit falla (conexión caída, restricción
  violada), el turno **queda asignado sin que exista la notificación** que
  ARCHITECTURE.md describe como el mecanismo de "evento" del dominio
  (`docs/ARCHITECTURE.md:112-119`). El mismo patrón se repite en
  `confirm_assignment`, `reject_assignment`, `check_out`, `mark_paid`
  (`shift/application/services.py`) y en `ChatService.send_message`
  (`chat/application/services.py:65-83`, que además dispara el WebSocket
  **después** del segundo commit).
- **Impacto:** hoy, con SQLite en memoria en tests y Postgres estable en
  producción, la probabilidad de fallo entre ambos commits es baja — pero es
  un problema de **diseño**, no de probabilidad: la sesión
  (`get_session`, `app/core/database.py:39-46`) sólo hace rollback ante
  excepción **antes** del primer commit; una vez que un repo comitea, ya no
  hay vuelta atrás si el segundo paso falla.
- **Riesgo:** medio (inconsistencia silenciosa de datos, no un crash visible).
- **Prioridad:** Media.
- **Esfuerzo:** medio-alto (cambiar el patrón "cada repo comitea" por "una
  sesión, un commit al final del caso de uso" toca los ~9 módulos; es un
  cambio transversal, mejor como iniciativa propia que como parche puntual).
- **Dependencias:** afecta a todos los repositorios; conviene una ronda
  única bien probada (suite de tests ya cubre casos de uso, ver
  [TESTING.md](./TESTING.md)) en vez de tocarlo módulo por módulo.
- **Solución:** mover el `commit()` a la capa `api/` (al final de la
  dependencia que arma el servicio) o a un `Unit of Work` explícito por
  request, dejando que los repos sólo hagan `flush()`.

### 1.6 Pool de conexiones (`app/core/database.py`)

- **Archivo:** `backend/app/core/database.py:25-29`.
- **Descripción:** `create_async_engine(settings.database_url, echo=settings.debug,
  pool_pre_ping=True)` — sin `pool_size` ni `max_overflow` explícitos, por lo
  que SQLAlchemy usa los defaults de `AsyncAdaptedQueuePool` (`pool_size=5`,
  `max_overflow=10` ⇒ máx. 15 conexiones concurrentes por proceso). Con **un
  solo worker uvicorn** (ver `backend/Dockerfile:17`, sin `--workers`), hoy
  eso alcanza de sobra.
- **Impacto:** ninguno mientras el deploy sea de un worker. Es el primer
  parámetro a revisar si se agregan workers (ver
  [SCALABILITY_REPORT.md](./SCALABILITY_REPORT.md)): `N workers × 15
  conexiones` puede chocar contra el límite de conexiones del plan de DB
  (free tier, tanto Render como Neon lo limitan).
- **Riesgo:** bajo hoy, medio si se escala horizontalmente sin revisar esto.
- **Prioridad:** Baja (documentar el valor por defecto; no tocar hasta que
  haya más de un worker).
- **Esfuerzo:** bajo.
- **Dependencias:** ligado a la decisión de escalar workers (ver
  `SCALABILITY_REPORT.md`).
- **Solución:** cuando se agreguen workers, fijar `pool_size`/`max_overflow`
  explícitos y sumarlos contra el límite de conexiones del plan de DB.

---

## 2. Base de datos

### 2.1 Índices — mejor de lo que dice `DATABASE.md` (inconsistencia doc↔código)

- **Hallazgo:** `docs/DATABASE.md:63-64` dice *"Sin índices documentados para
  las búsquedas frecuentes (feed por estado, candidatos por
  skill/disponibilidad): revisar al escalar"*. Al revisar las migraciones,
  **eso ya no es cierto para `shifts`**:
  `backend/alembic/versions/0003_create_shifts_table.py:52-56` crea índices
  en `company_id`, `position`, `city`, `urgent` y **`status`**
  explícitamente. También hay índices en las FK de
  `shift_applications` (`0009_create_shift_applications_table.py:49-56`),
  `chat_messages` (`0007_create_chat_messages_table.py:47-51`), `reviews`
  (`0008_create_reviews_table.py:57-59`) y `notifications`
  (`0005_create_notifications_table.py:43-44`).
- **Corrección sugerida a la doc:** actualizar `docs/DATABASE.md` para
  reflejar el estado real (índices sí existen en las columnas de filtro más
  comunes de `shifts`); dejar como pendiente real sólo lo que sigue faltando
  (abajo). Por la regla de "chequear coherencia doc↔código" de
  `CLAUDE.md`, esto se marca explícitamente para corregir la documentación,
  no el código.
- **Lo que sí falta:**
  - `worker_profiles.skills` es una columna `JSON` sin índice (ni GIN) — no
    puede indexarse igual que un campo escalar; es la raíz de P4 (filtro en
    Python). No hay índice en `worker_profiles.is_available` ni en
    `(latitude, longitude)` — cualquier filtro geográfico o de
    disponibilidad hoy es un scan completo.
  - `notifications` tiene índices separados en `user_id` (línea 43) y `read`
    (línea 44), pero **no uno compuesto** `(user_id, read)`, que es el
    filtro real de "notificaciones no leídas de este usuario" — Postgres
    puede combinar los dos índices simples con un bitmap scan, pero un
    índice compuesto sería más directo si el volumen crece.
  - `shift_applications` no tiene índice en `status` — filtrar postulaciones
    `pendiente` de un turno específico (caso de uso frecuente) hoy usa sólo
    el índice de `shift_id`.
- **Prioridad:** Media (doc) / Baja (índices adicionales — no duelen aún).
- **Esfuerzo:** bajo.
- **Solución:** corregir `DATABASE.md`; agregar índice compuesto
  `(shift_id, status)` en `shift_applications` cuando el volumen de
  postulaciones por turno crezca; evaluar GIN sobre `skills` si se mantiene
  JSON, o desnormalizar a tabla puente (ver P4).

### 2.2 Constraints

- **Presentes y correctos:**
  - `users.email` único (`0001_create_users_table.py:46`).
  - `worker_profiles.user_id` / `company_profiles.user_id` únicos (1—1 con
    `users`, `0002_create_profile_tables.py:53,56-57,84,87-88`).
  - `shift_applications (shift_id, worker_profile_id)` único —
    `0009_create_shift_applications_table.py:45-47` (`uq_shift_applications_shift_worker`):
    impide postularse dos veces al mismo turno a nivel de base, no sólo de
    aplicación. **Bien.**
  - `reviews (shift_id, reviewer_user_id)` único —
    `0008_create_reviews_table.py:53-55` (`uq_reviews_shift_reviewer`): una
    sola reseña por reviewer y turno.
  - `CHECK (rating >= 1 AND rating <= 5)` en `reviews`
    (`0008_create_reviews_table.py:52`, `ck_reviews_rating_range`). Es el
    **único** check constraint del esquema.
  - FKs con `ON DELETE CASCADE` (perfiles, turnos, mensajes, reviews) o `SET
    NULL` (`shifts.worker_profile_id`,
    `0004_add_shift_worker_assignment.py:30-37`) consistentes con el ciclo de
    vida documentado en `DATABASE.md`.
- **Faltantes (validación hoy sólo en Python/dominio):**
  - `shifts.quantity` no tiene `CHECK (quantity > 0)`.
  - `shifts.pay_amount` no tiene `CHECK (pay_amount >= 0)`.
  - No hay `CHECK (end_at > start_at)` en `shifts` — la validación vive en
    `Shift._validate_schedule()` (dominio), pero un `INSERT`/`UPDATE` directo
    a la tabla (migración de datos, script, admin de DB) podría violar la
    regla sin que la base lo impida.
- **Impacto:** bajo mientras todo el acceso a datos pase por el dominio
  (así es hoy). Es una red de seguridad barata para cuando eso deje de ser
  cierto (scripts de datos, migraciones, acceso directo en incidentes).
- **Riesgo:** bajo.
- **Prioridad:** Baja.
- **Esfuerzo:** bajo (una migración Alembic agregando los `CHECK`).
- **Solución:** sumar los tres `CHECK` faltantes en una migración; no
  requiere cambio de código de aplicación.

---

## 3. Frontend

### 3.1 Bundle

- Mapas (`Leaflet`/`react-leaflet`) ya cargan vía `next/dynamic` con
  `ssr: false` en los tres lugares que los usan:
  `frontend/app/search/page.tsx:15`, `frontend/app/map/page.tsx:14` y
  `frontend/components/ShiftCard.tsx:9`. **Bien**, coincide con lo pedido en
  el enunciado.
- Dependencias de runtime (`frontend/package.json`): `leaflet`,
  `lucide-react`, `motion`, `next`, `react`, `react-dom`, `react-leaflet` —
  set acotado, sin librerías de UI pesadas (no hay Material UI, Ant Design,
  etc.) ni librerías de gráficos. `lucide-react` se importa vía barrel
  (`docs/AUDIT_REPORT.md:84`), lo que en general es tree-shakeable con
  Next/Turbopack, pero no se verificó el tamaño real del chunk generado (no
  hay `next build` con análisis de bundle en este repo/CI, ver
  [TECH_DEBT.md T3](./TECH_DEBT.md)). `motion` (framer-motion) es la
  dependencia más pesada del set y se usa para los gestos de swipe
  (`SwipeDeck`) — no está lazy-cargada, va en el bundle inicial de `/feed`.
- **Prioridad:** Baja (no hay evidencia de un bundle problemático, sólo
  ausencia de medición). **Esfuerzo:** bajo (agregar
  `@next/bundle-analyzer` o Lighthouse a CI, ya listado como pendiente en
  `TECH_DEBT.md T3`).

### 3.2 Imágenes

- **7 usos de `<img>`, 0 de `next/image`** (confirmado por búsqueda de
  `<img` en `frontend/app|components`): `app/companies/[id]/page.tsx`,
  `app/chats/page.tsx`, `app/search/page.tsx`, `app/workers/[id]/page.tsx`,
  `components/ui/Avatar.tsx`, `components/worker/OpportunityCard.tsx`,
  `components/ImageUpload.tsx`. Ya documentado como deuda en
  `TECH_DEBT.md F4`; se reafirma acá desde el ángulo de performance: sin
  `next/image` no hay resize automático, `srcset` responsivo ni
  lazy-loading nativo más allá del `loading="lazy"` manual ya aplicado.
- **Imágenes externas sin optimizar:** las fotos demo vienen de
  `https://loremflickr.com/600/400/{keyword}` (comercios,
  `backend/scripts/seed_demo_data.py:61`) y `https://i.pravatar.cc/300?img=...`
  (trabajadores, línea 429) — servidas tal cual por `<img>`, sin
  redimensionar para mobile ni cachear vía CDN propio. `next.config.ts` no
  declara `images.remotePatterns`, así que ni siquiera está habilitada la
  opción de usar `next/image` con estos dominios sin tocar la config.
- **Impacto:** bajo con datos demo (pocas imágenes, tamaños moderados);
  cada foto de perfil/logo real subida por usuarios (vía Cloudinary, según
  `ARCHITECTURE.md`) tampoco se sirve redimensionada del lado del cliente.
- **Riesgo:** medio — feeds con muchas tarjetas (`OpportunityCard`, avatares
  de chat) son el patrón de mayor tráfico de imágenes de la app.
- **Prioridad:** Media.
- **Esfuerzo:** medio (migrar los 7 usos a `next/image`, declarar
  `remotePatterns` para Cloudinary/loremflickr/pravatar, o —alternativa más
  simple— apoyarse en las transformaciones de Cloudinary del lado del
  backend/URL, que ya está en el stack).
- **Dependencias:** ninguna arquitectónica.

### 3.3 Listas largas sin virtualización

- **Hallazgo:** ningún listado del frontend usa virtualización
  (`react-window`, `react-virtual`, etc. — no están en `package.json`).
  Coincide con la ausencia de paginación del backend (sección 1.3): hoy
  `.map()` renderiza listas completas en `frontend/app/admin/page.tsx:112`
  (todos los usuarios), `frontend/app/search/page.tsx:122` (todos los
  trabajadores encontrados) y el feed de turnos (`SwipeDeck`/`OpportunityCard`).
- **Impacto:** nulo hoy (≤14-40 elementos). Es exactamente el mismo cuello
  de botella que P de paginación del backend, visto desde el cliente: sin
  límite de servidor, no hay nada que virtualizar razonablemente porque ya
  se recibió todo de una.
- **Riesgo:** medio, acoplado 1:1 a la paginación del backend.
- **Prioridad:** Media (resolver junto con 1.3, no antes).
- **Esfuerzo:** medio.
- **Solución:** una vez el backend pagine, adoptar scroll infinito o
  paginación con virtualización sólo si las listas superan unos cientos de
  ítems; no antes (evitar complejidad prematura, coherente con
  `PRINCIPLES.md`).

### 3.4 Re-renders / fetching

- `frontend/app/feed/page.tsx:24-31` usa `Promise.all` para pedir feed,
  perfil y postulaciones en paralelo — **buen patrón**, evita cascada de
  requests.
- No hay biblioteca de data-fetching con caché/dedupe (no hay `swr` ni
  `@tanstack/react-query` en `package.json`; `frontend/lib/api.ts:14-36` es
  un wrapper delgado de `fetch` sin caché ni deduplicación de requests en
  vuelo). Cada navegación entre pantallas repite el fetch desde cero, y no
  hay revalidación en foco/reconexión. No es un problema de re-renders de
  React en sí, pero sí de tráfico de red redundante — ver sección 4
  (caché).
- **Prioridad:** Baja-Media. **Esfuerzo:** medio si se adopta SWR/React
  Query (cambio transversal a todas las pantallas).

### 3.5 PWA / Service Worker

- `frontend/app/manifest.ts` define un manifest instalable (íconos, `display:
  standalone`, colores) pero **no hay `service-worker`/`sw.js`** en el
  repo (búsqueda de `service-worker`/`sw.js` sin resultados fuera de
  `manifest.ts`). La "PWA" hoy es **instalable** (look nativo, ver
  `ARCHITECTURE.md:121-129`) pero **no cachea nada offline** ni acelera
  cargas repetidas vía Cache API — cada carga es 100% red.
- **Impacto:** ninguno funcional (la app no promete modo offline); es una
  oportunidad de performance percibida (repeat visits) no explotada.
- **Riesgo:** bajo.
- **Prioridad:** Baja.
- **Esfuerzo:** medio (Workbox/`next-pwa` o service worker manual para
  cachear estáticos/shell).

---

## 4. Caché

- **No existe ninguna capa de caché**, en ningún nivel:
  - Backend: no hay Redis (coherente con `CLAUDE.md` — "no debería haber
    Redis" hoy — y con `docs/TECH_DEBT.md I2`, que marca Redis como
    "previsto, no usado"). No hay caché in-process (`functools.lru_cache`
    sólo se usa para `Settings`, `app/core/config.py:88`, no para datos).
  - HTTP: ninguna ruta setea `Cache-Control`/`ETag` (`app/core/middleware.py`
    sólo agrega headers de seguridad, no de caché). Todas las respuestas son
    siempre-fresh, incluso datos que cambian poco (perfil de comercio,
    catálogo de skills).
  - Frontend: sin SWR/React Query (sección 3.4), sin service worker
    (sección 3.5).
- **Impacto:** cada pantalla es siempre un round-trip completo al backend +
  DB. Es coherente con el tamaño actual del equipo/producto (menos infra que
  mantener), pero es el primer lugar a mirar si la latencia percibida se
  vuelve un problema antes de escalar DB u horizontal.
- **Riesgo:** bajo hoy, medio a futuro.
- **Prioridad:** Baja (no agregar Redis sin necesidad real y sin ADR, por
  `CLAUDE.md`). Antes de caché de servidor, hay más ganancia en cachear en
  el cliente (SWR) y en `Cache-Control` para catálogos estáticos
  (skills, categorías) que casi no cambian.
- **Esfuerzo:** bajo para `Cache-Control` en catálogos; medio para
  SWR/React Query.
- **Solución:** 1) `Cache-Control` corto (segundos/minutos) en endpoints de
  catálogo/lectura poco volátil; 2) SWR/React Query en el cliente para
  dedupe + revalidación; **recién después**, si el volumen lo justifica,
  evaluar Redis para el resultado del matching (P4) — eso sí ameritaría ADR.

---

## Tabla resumen

| # | Hallazgo | Área | Prioridad | Esfuerzo |
|---|----------|------|-----------|----------|
| P1 | N+1 en inbox de chat (`chat/application/services.py:89-121`) | Backend | Alta | Medio |
| P2 | N+1 en postulantes de turno (`application/api/routes.py:84-99`) | Backend | Alta | Bajo |
| P3 | N queries de comercio en feed/mis-turnos (`shift/api/routes.py:48-64`) | Backend | Media | Bajo |
| P4 | Matching: full scan + scoring en Python (`matching/infrastructure/repositories.py:39-55`) | Backend | Alta | Medio |
| — | Listados sin paginación (todo `app/modules/*`) | Backend | Alta | Medio |
| P5 | `/admin/stats` full scan + Python (`admin/application/services.py:29-40`) | Backend | Media | Bajo |
| — | Commit por repo, no por caso de uso (`shift/application/services.py`, `chat/application/services.py`) | Backend | Media | Medio-Alto |
| — | Pool de conexiones sin tunear (`core/database.py:25-29`) | Backend | Baja | Bajo |
| — | Doc `DATABASE.md` desactualizada sobre índices | DB / Doc | Media | Bajo |
| — | Índices faltantes: `skills`, `is_available`, `(user_id, read)`, `(shift_id, status)` | DB | Baja | Bajo |
| — | `CHECK` faltantes (`quantity`, `pay_amount`, `end_at > start_at`) | DB | Baja | Bajo |
| — | `<img>` sin `next/image` (7 usos) + imágenes externas sin optimizar | Frontend | Media | Medio |
| — | Listas sin virtualización (acoplado a paginación backend) | Frontend | Media | Medio |
| — | Sin SWR/React Query (fetch sin caché/dedupe) | Frontend | Baja-Media | Medio |
| — | PWA sin service worker (sólo instalable) | Frontend | Baja | Medio |
| — | Sin ninguna capa de caché (servidor ni cliente) | Caché | Baja | Bajo-Medio |

## Puntuación: 58/100

**Justificación:** arquitectura y consultas individuales bien escritas
(índices correctos donde importa, agregación SQL correcta en `reviews`,
constraints de integridad sólidos, mapas ya lazy) — eso evita que hoy sea un
problema. Pero el patrón sistemático de **cero paginación** en todos los
listados, el **N+1 real** en el flujo de mensajería (el canal más usado del
producto) y postulaciones, y el **motor de matching sin acotar por SQL**
(el corazón del producto) son deuda estructural que hoy no se paga porque el
dataset es de juguete (12-14 filas por tabla). Ninguno de estos hallazgos es
grave *hoy*; todos son baratos de arreglar *hoy* y caros de diagnosticar
*después*. De ahí una nota media-baja: buena base, sin red de seguridad de
performance para cuando el producto crezca.
