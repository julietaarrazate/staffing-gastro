# SCALABILITY_REPORT.md — Auditoría de escalabilidad (Staffya)

> Límites del deploy actual, qué aguanta hoy y camino de escala **sin romper
> la arquitectura** (los `docs/` del repo exigen ADR para infraestructura
> nueva — ver `CLAUDE.md#no-hacer`). Complementa
> [PERFORMANCE_REPORT.md](./PERFORMANCE_REPORT.md) (que mira consultas y
> código); acá el foco es **capacidad del deploy y del modelo operativo**.
> Contexto: [ARCHITECTURE.md](../foundation/ARCHITECTURE.md), [DEPLOY.md](../reference/DEPLOY.md),
> [DATABASE.md](../reference/DATABASE.md), [TECH_DEBT.md](../TECH_DEBT.md).

## Resumen ejecutivo

> **Actualización (2026-08-04, auditoría OÍDO):** la DB ya migró a **Neon**
> (verificado en vivo el 2026-07-23) — el hallazgo S1 de abajo ("expira a los
> 90 días") está **resuelto**, se deja el análisis original para contexto
> histórico con la corrección marcada en su sección. No se recalculó el
> puntaje global (45/100): requeriría revisar también S2-S10, fuera del
> alcance de esta corrección puntual.

Staffya corre hoy en el **plan free de Render** (backend: 1 contenedor, 1
worker uvicorn) más **Vercel free** para el frontend y **Neon** para la DB
(ver actualización arriba). Toda la coordinación en tiempo real (WebSocket) y de
seguridad (rate limiting) vive **en memoria de un solo proceso**, lo cual es
una decisión correcta y documentada para la escala actual, pero es también el
techo: agregar un segundo worker o una segunda instancia **rompe silenciosamente**
el chat, las notificaciones live y el rate limiting, sin que ningún test lo
detecte (son procesos separados en memoria, no hay error, simplemente cada
instancia ve una porción de la realidad).

**Puntuación global de escalabilidad: 45/100** (sin recalcular tras la
migración a Neon, ver actualización arriba) — el diseño interno (DDD/
hexagonal, puertos de repositorio) hace que escalar la lógica sea barato el
día que haga falta, pero el **deploy actual tiene puntos de fallo casi
inmediatos** apenas se toca el dial más obvio de escala (agregar workers).

---

## 1. Límites del deploy actual

### 1.1 Un solo worker uvicorn (Render free)

- **Archivo:** `backend/Dockerfile:17` — `CMD alembic upgrade head && python
  -m scripts.startup_seed && uvicorn app.main:app --host 0.0.0.0 --port
  8000`. Sin `--workers N`: uvicorn corre **un solo proceso**.
  `render.yaml:13` fija `plan: free` para el servicio web.
- **Descripción:** el plan free de Render da recursos compartidos y limitados
  (CPU/RAM bajos, además de "spin down" del servicio tras inactividad, propio
  de los planes free de Render). Con un solo worker, todo el tráfico HTTP y
  WebSocket de la plataforma pasa por un único proceso Python — sin
  paralelismo real de CPU (el `async` de FastAPI da concurrencia de I/O, no
  de cómputo).
- **Impacto:** cualquier operación con costo de CPU no trivial (el scoring de
  matching en Python, `PERFORMANCE_REPORT.md#12-costo-del-matching`) bloquea
  el event loop para **todas** las requests concurrentes mientras corre.
- **Riesgo:** alto si el uso crece sin agregar workers; hoy, bajo (poco
  tráfico).
- **Prioridad:** Alta (es la primera palanca de escala, pero tocarla sin
  resolver 1.2/1.3 primero rompe el producto — ver "camino de escala").
- **Esfuerzo:** bajo para el cambio en sí (`--workers N` o plan pago con más
  CPU); medio-alto para hacerlo *seguro* (requiere resolver WS y rate limit
  primero).
- **Puntuación del punto:** techo de capacidad bajo, pero conocido y
  documentado (`ws_manager.py:1-7`, `rate_limit.py:1-7` lo dicen
  explícitamente en sus docstrings) — no es una sorpresa para quien lea el
  código.

### 1.2 WebSocket en memoria de proceso — rompe con 2+ workers/instancias

- **Archivo:** `backend/app/core/ws_manager.py:1-49`.
- **Descripción:** `ConnectionManager` guarda las conexiones activas de chat
  y notificaciones en diccionarios **en memoria del proceso**
  (`self._chat`, `self._notifications`, líneas 17-18). El propio docstring lo
  advierte: *"Si el proceso corre con más de un worker o instancia, cada uno
  sólo ve sus propias conexiones"* (líneas 4-6). Con balanceo de carga entre
  2+ procesos, un mensaje de chat enviado por el usuario A (conectado al
  worker 1) **nunca llega** al usuario B si su WebSocket está en el worker 2:
  el broadcast (`broadcast_chat`, línea 28-33; `broadcast_notification`,
  línea 43-48) sólo recorre las conexiones locales.
- **Impacto:** el chat y las notificaciones en vivo son features centrales
  del producto (reemplazan el polling anterior, `ARCHITECTURE.md:108`). Con
  más de un worker, dejan de funcionar de forma intermitente y **sin error
  visible** — el mensaje se guarda en DB (eso sí es correcto, va por
  Postgres) pero el push en vivo se pierde para la mitad de los usuarios,
  según a qué proceso los tocó el balanceador.
- **Riesgo:** **crítico** en el momento exacto en que se agregue un segundo
  worker sin resolver esto antes.
- **Prioridad:** **Crítica** (bloqueante para escalar horizontalmente).
- **Esfuerzo:** medio (Redis pub/sub: cada worker publica el evento a un
  canal Redis y todos los workers suscriptos hacen el broadcast local a sus
  propias conexiones — patrón estándar para WebSocket multi-proceso).
- **Dependencias:** **requiere Redis** → infraestructura nueva → **ADR
  obligatorio** por `CLAUDE.md#no-hacer` ("Introducir infraestructura pesada
  ... sin necesidad real y sin ADR"). Es, sin embargo, el caso de "necesidad
  real" que ese punto contempla: no hay forma de tener WS multi-proceso sin
  un canal compartido.
- **Puntuación del punto:** riesgo alto, mitigación conocida y estándar
  (no es un problema de diseño exótico), pero **no implementada**.

### 1.3 Rate limiting en memoria — mismo problema, menor severidad

- **Archivo:** `backend/app/core/rate_limit.py:1-52`.
- **Descripción:** `RateLimiter` guarda los intentos por IP en
  `self._hits: dict[str, list[float]]` (línea 27), también en memoria de
  proceso. El docstring lo documenta igual que `ws_manager`
  (líneas 3-6): *"Es por proceso: con un solo worker ... alcanza; escalar
  horizontalmente requeriría un store compartido (Redis) y un ADR"*. Con 2+
  workers, un atacante que rota de proceso (vía el balanceador) **multiplica
  su cuota efectiva** por la cantidad de workers — el rate limit de
  login/registro (`docs/planning/QUICK_WINS.md:9-14`, 10/min y 5/min) se vuelve, en
  la práctica, `10×N`/min.
- **Impacto:** degrada (no rompe) la protección contra fuerza bruta en login
  — sigue habiendo *algo* de límite, sólo que más laxo de lo pensado.
- **Riesgo:** medio (seguridad, no disponibilidad).
- **Prioridad:** Alta (mismo bloqueante que 1.2, pero de menor severidad
  funcional — el producto sigue "andando", sólo con peor protección).
- **Esfuerzo:** medio (mismo store compartido que 1.2 — Redis con TTL, o
  incluso una tabla Postgres con `UPSERT` si no se quiere sumar Redis sólo
  por esto).
- **Dependencias:** mismo ADR que 1.2 si se resuelve con Redis; podría
  resolverse sin Redis (Postgres) si sólo se necesita esto y no WS pub/sub.

### 1.4 Seed de datos demo en cada arranque

- **Archivo:** `backend/Dockerfile:17` (`python -m scripts.startup_seed`),
  `backend/scripts/startup_seed.py:14-25`.
- **Descripción:** el seed es **idempotente** (omite lo que ya existe, según
  su propio docstring, línea 4) y **nunca bloquea el arranque** (captura
  cualquier excepción y sigue, líneas 18-21) — diseño correcto para no tumbar
  producción. El riesgo no es el seed en sí, sino que corre en **cada** boot
  del contenedor (cada deploy, cada restart de Render), y está gobernado por
  una única env var global `SEED_DEMO_DATA=true` (`render.yaml:30-31`) sin
  distinción de instancia — si un día hay más de un proceso arrancando en
  paralelo (rolling deploy con overlap), ambos podrían intentar sembrar a la
  vez. Con inserciones idempotentes esto es tolerable, pero no está
  probado bajo concurrencia real.
- **Impacto:** bajo hoy (deploy de una sola instancia).
- **Riesgo:** bajo.
- **Prioridad:** Baja.
- **Esfuerzo:** bajo (ya está anotado como riesgo en
  `docs/reference/DEPLOY.md:60-61`: *"apagarlo antes de datos reales de usuarios"*).
- **Solución:** apagar `SEED_DEMO_DATA` antes de tener usuarios reales
  (ya documentado); si se paraleliza el arranque alguna vez, mover el seed a
  un job aparte (release phase) en vez del `CMD` del propio servicio web.

### 1.5 DB free de Render — expira a los 90 días (reloj, no tráfico)

> ✅ **Resuelto (2026-07-23).** La DB ya migró a **Neon** (serverless,
> `aws-us-east-2`), verificado en vivo — ver
> [INCIDENTE_2026-07-23_BACKEND_CAIDO.md](../INCIDENTE_2026-07-23_BACKEND_CAIDO.md).
> `render.yaml` ya no gestiona una DB propia; `DATABASE_URL` apunta a Neon,
> configurado manualmente en el dashboard de Render. Se deja el análisis
> original abajo como contexto histórico de por qué era crítico.

- Documentado ya en `docs/reference/DATABASE.md:61-62`, `docs/TECH_DEBT.md I1` y
  `docs/foundation/ARCHITECTURE.md:148-149`; migración a Neon con pasos concretos en
  `backend/README.md:169-192`. Se reafirma acá porque es, en rigor, el
  **primer** límite de escalabilidad del sistema en términos de tiempo: no
  importa cuánto tráfico soporte el backend si la base de datos **se borra
  sola** a los 90 días de creada. No es un problema de capacidad, es un
  problema de continuidad.
- **Prioridad (histórica):** **Crítica** (no depende de uso, depende del
  calendario; cualquier producción real necesita esto resuelto antes que
  cualquier otro ítem de este documento).
- **Esfuerzo:** bajo — los pasos ya están escritos en `backend/README.md`.
  No requiere ADR (la migración a Neon ya está prevista y documentada en
  `ARCHITECTURE.md:148-149`).

---

## 2. Qué aguanta hoy — estimación honesta

No hay métricas de producción (`docs/reference/OBSERVABILITY.md:14-15`: *"Sin
métricas, tracing distribuido, APM, ni alertas configuradas"*), así que esto
es una **estimación basada en el código**, no una medición real. Tratarla
como orden de magnitud, no como SLA.

| Dimensión | Estimación | Por qué |
|---|---|---|
| **Usuarios concurrentes (HTTP)** | Bajas decenas (~20-50) sin degradación notoria | Un worker async de FastAPI sostiene bien I/O concurrente (requests cortas a Postgres), pero cualquier request que dispare el matching (P4 en `PERFORMANCE_REPORT.md`) o el inbox de chat (P1) bloquea CPU del único proceso mientras corre; con concurrencia real esas requests se encolan detrás. |
| **Conexiones WebSocket simultáneas** | Bajas decenas, **en un solo proceso** | Sin límite explícito por usuario/turno (`docs/TECH_DEBT.md S5`); cada conexión es un `set` en memoria — el límite real es la RAM del plan free de Render, no el diseño. |
| **Turnos abiertos simultáneos** | Cientos sin problema de datos (los índices de `shifts.status/city/position` aguantan bien un filtro), pero cada apertura de `/shifts/feed` sin paginación (`PERFORMANCE_REPORT.md §1.3`) empieza a pesar más en payload/serialización a partir de unos cientos de filas. | Índices ya existen (`0003_create_shifts_table.py:52-56`); el cuello es la falta de límite de filas, no la query en sí. |
| **Candidatos por turno (matching)** | Cómodo hasta unos cientos de trabajadores disponibles en la plataforma; a partir de ahí, cada apertura de turno dispara un full scan + scoring Python (P4) que empieza a agregar latencia perceptible (cientos de ms a segundos, dependiendo del CPU compartido del free tier). | `matching/infrastructure/repositories.py:39-55` no filtra por SQL más allá de `is_available`. |
| **Usuarios totales en DB** | Sin problema de almacenamiento hasta decenas de miles (Postgres lo maneja sin esfuerzo); el problema aparece antes en **UX/CPU** (listas sin paginar, admin `/admin/stats` con full scan — P5) que en la base en sí. | Índices de FK/unique están bien puestos; el límite no es el motor, es el patrón de acceso. |

### Primer cuello de botella real (en orden de aparición)

1. ~~El más inmediato y menos relacionado con tráfico: expiración de la DB
   a los 90 días~~ (sección 1.5) — **resuelto**, migrado a Neon.
2. **El primer cuello ligado a *crecimiento de uso normal* (no de escala
   masiva): el N+1 del inbox de chat** (`PERFORMANCE_REPORT.md` P1) — con
   usuarios que acumulan 15-20 conversaciones activas (nada exótico para un
   trabajador eventual con varios turnos por mes), el inbox ya hace decenas
   de queries secuenciales por carga de pantalla.
3. **El primer cuello ligado a *volumen de oferta/demanda* (el corazón del
   producto): el matching sin filtro SQL** (P4) — en cuanto haya
   cientos de trabajadores disponibles por ciudad, cada apertura de turno se
   siente más lenta, justo en el momento donde el producto promete
   "cubrir en menos de 10 minutos".
4. **El primer cuello ligado a *escalar el servidor en sí*: agregar un
   segundo worker rompe WS y relaja el rate limit** (secciones 1.2/1.3) —
   este no aparece por crecimiento orgánico, aparece el día que alguien gire
   el dial de `--workers` para aguantar más tráfico, y en ese momento
   **empeora** en vez de mejorar la experiencia si no se resuelve antes.

---

## 3. Camino de escala sin romper la arquitectura

Todo lo que sigue respeta el monolito modular DDD/hexagonal (no propone
microservicios) y marca explícitamente dónde hace falta un ADR, según
`CLAUDE.md#no-hacer`.

| Paso | Qué | Requiere ADR | Orden sugerido |
|---|---|---|---|
| 1 | ~~Migrar DB a Neon~~ | No | ✅ Hecho (2026-07-23). |
| 2 | **Paginación** en todos los listados (`PERFORMANCE_REPORT.md §1.3`) | No (cambio interno de repos/API) | Antes de escalar tráfico — barato y de alto impacto. |
| 3 | **Filtrar matching por ciudad/bounding box en SQL** antes del scoring en Python (`PERFORMANCE_REPORT.md` P4) | No, si se resuelve con `WHERE city=...`/rango de lat-lng. Sí, si se adopta PostGIS (ya "previsto" en `DATABASE.md`, requiere ADR formal). | Antes de tener cientos de trabajadores por ciudad. |
| 4 | **Índices adicionales** (`skills`, `is_available`, compuestos — `PERFORMANCE_REPORT.md §2.1`) | No | Junto con el paso 3. |
| 5 | **Redis para WS pub/sub + rate limiting compartido**, recién ahí **2+ workers** | **Sí — ADR obligatorio** (primera infraestructura nueva real: Redis) | Sólo cuando el tráfico lo justifique; es el paso que *habilita* escalar el servidor, no algo a hacer "porque sí". |
| 6 | **CDN de imágenes** (Cloudinary ya transforma; evaluar `next/image` con `remotePatterns` o servir siempre URLs transformadas por Cloudinary) | No | En paralelo, bajo costo. |
| 7 | **Observabilidad mínima** (`docs/reference/OBSERVABILITY.md` ya lo prioriza: logging estructurado, Sentry, métricas de negocio) | Sólo si se suma una herramienta externa con costo/infra relevante (ej. APM) | Antes del paso 5 — sin esto, no hay forma de *saber* cuándo escalar, sólo de intuirlo. |

**Nota de secuencia:** el orden importa. Escalar workers (paso 5) **antes**
de resolver WS/rate-limit en memoria **empeora** el producto (rompe chat/
notificaciones para una fracción de usuarios de forma intermitente e
indetectable sin observabilidad). El error más caro que se puede cometer acá
es optimizar la palanca más obvia (más workers) sin haber leído
`ws_manager.py` y `rate_limit.py` primero — ambos archivos ya avisan del
problema en su propio docstring.

---

## 4. Multi-ciudad / multi-país — qué asume CABA hoy

- **Seed de datos:** `backend/scripts/seed_demo_data.py:1` (docstring:
  *"Carga datos de prueba: comercios y trabajadores repartidos por Buenos
  Aires"*) y línea 63 (*"Comercios ficticios repartidos por distintos
  barrios de CABA"*). Los 12 comercios y 14 trabajadores demo están todos en
  barrios porteños (Palermo, Recoleta, etc. — líneas 69-90 y siguientes).
  Esto es sólo el *seed* (dato de demo), no una limitación de esquema — el
  modelo de datos (`city: str`, `latitude/longitude: float | None`) es
  agnóstico de país.
- **Catálogo de localidades del frontend:** `frontend/lib/locations.ts:4-7`
  hardcodea **los 48 barrios de CABA** como catálogo principal
  (`CABA_BARRIOS`, línea 26 en adelante, con centro de lat/lng por barrio
  para alimentar el matching por distancia cuando el usuario no da
  coordenadas propias) y agrega "Buenos Aires (GBA y provincia)" como
  fallback (línea 84). **No hay catálogo de localidades para otras
  provincias argentinas ni otros países** — expandir a otra ciudad/país hoy
  requiere extender manualmente este archivo (dato estático en el
  frontend), no un cambio de arquitectura.
- **Radio de matching:** `DEFAULT_MAX_RADIUS_KM` (documentado en
  `docs/reference/MATCHING.md:31,42`: 25 km) es un valor único, pensado para la
  densidad de CABA (ciudad compacta). En una ciudad más dispersa o en zonas
  rurales, 25 km puede ser demasiado chico (deja gente fuera del rango
  útil) o, en una megaciudad como Buenos Aires + GBA, demasiado grande
  (25 km en CABA puede cruzar toda la ciudad). No hay radio configurable por
  ciudad/densidad hoy.
- **Barrio como "unidad práctica de cercanía humana":** `docs/reference/LOCATION.md:22-23`
  documenta explícitamente que CABA usa el *barrio* como unidad, mientras
  otras ciudades usarían la *ciudad* entera
  (`frontend/lib/locations.ts:21`: *"Barrio" para CABA, "Ciudad" para el
  resto*) — el modelo ya previó esta diferencia de granularidad, lo cual es
  una buena señal: expandir geográficamente no rompe el esquema, sólo
  requiere poblar el catálogo de localidades y, opcionalmente, ajustar el
  radio por zona.
- **Riesgo de expandir sin ajustar esto:** una ciudad nueva sin entradas en
  `locations.ts` deja al usuario sin selector de barrio/ciudad utilizable en
  el onboarding (no es un error duro, es una degradación de UX: el
  formulario dependería de que el usuario tipee coordenadas o ciudad libre,
  sin autocompletado).
- **Prioridad:** Media (no bloquea nada hoy — CABA es el mercado de
  lanzamiento correcto para un producto en etapa demo) pero **alta** el día
  que haya un plan concreto de expandir a otra ciudad: es trabajo de datos
  (catálogo), no de arquitectura, y conviene planificarlo con tiempo.
- **Esfuerzo:** medio (poblar catálogo de localidades por ciudad/país;
  eventualmente reemplazar por geocodificación real — ya marcado como
  "fuera de alcance hoy" en `docs/reference/LOCATION.md:52-54`, sería integración +
  ADR si cambia el modelo).

---

## Tabla resumen

| # | Hallazgo | Prioridad | Esfuerzo | Requiere ADR |
|---|----------|-----------|----------|--------------|
| S1 | ~~DB free de Render expira a los 90 días~~ | ✅ Resuelto (Neon, 2026-07-23) | Bajo | No |
| S2 | WS en memoria rompe con 2+ workers/instancias | **Crítica** | Medio | Sí (Redis) |
| S3 | Rate limiting en memoria se relaja con 2+ workers | Alta | Medio | Sí (si se resuelve con Redis) |
| S4 | Un solo worker uvicorn — techo de capacidad | Alta | Bajo (cambio)/Medio (seguro) | No en sí mismo |
| S5 | Matching sin filtro SQL — primer cuello de "volumen de oferta" | Alta | Medio | No (salvo PostGIS) |
| S6 | Sin paginación — degradación silenciosa con crecimiento | Alta | Medio | No |
| S7 | Sin observabilidad — no hay forma de saber cuándo escalar | Alta | Bajo-Medio | Sólo si se suma APM externo |
| S8 | Seed en cada arranque, sin aislar de datos reales | Baja | Bajo | No |
| S9 | Multi-ciudad: catálogo de localidades hardcodeado a CABA | Media | Medio | No |
| S10 | Radio de matching fijo (25 km), no ajustado por densidad de ciudad | Media | Bajo | No |

## Puntuación: 45/100

**Justificación:** el diseño interno (monolito modular DDD/hexagonal,
puertos de repositorio, sin acoplamiento entre módulos) es una base sólida
para escalar la *lógica* sin reescrituras — eso pesa a favor. Pero el
**deploy real** tiene dos puntos de fallo casi garantizados apenas se toca
la palanca de escala más obvia (WS y rate limit en memoria, ambos
documentados por el propio código como "no aptos para multi-worker"), un
**reloj corriendo** independiente del tráfico (DB que expira a los 90 días),
y **cero observabilidad** para saber si algo de esto ya está doliendo en
producción. Nada de esto es sorpresa oculta — está bien documentado en el
propio código y en `docs/` — pero "documentado" no es "resuelto": de ahí una
nota por debajo de la media. Es una base honesta para una etapa demo/early
stage, no todavía para una operación con SLA.
