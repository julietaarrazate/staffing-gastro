# INFRASTRUCTURE_REPORT.md — Infraestructura (producción)

> Parte de PRODUCTION_HARDENING.md, Fase 3. Cambios de infraestructura y
> documentación de configuración — sin tocar código de aplicación salvo un
> `print()` de alerta (sección 2).

## 1. `docker-compose.yml` — sacar servicios sin uso real

**Antes:** `db` usaba la imagen `postgis/postgis:16-3.4` y había un servicio
`redis:7-alpine` completo (puerto expuesto, contenedor propio).

**Verificación hecha antes de tocar nada:** se confirmó por grep en todo el
código (`app/`, `alembic/`) que **no hay una sola referencia** a PostGIS
(extensiones espaciales, tipos `geography`/`geometry`, funciones `ST_*`) ni a
Redis (cliente, `REDIS_URL`, import de `redis`/`aioredis`). El matching por
distancia usa Haversine en Python puro (`app/core/geo.py`); el rate limiting
y el `ConnectionManager` de WebSockets son en memoria del proceso
(`app/core/rate_limit.py`, `app/core/ws_manager.py`) — documentado
explícitamente como la limitación conocida de "por proceso, no distribuido"
en `docs/reference/SECURITY.md`.

**Ahora:**
- `db` pasa a `postgres:16-alpine` (Postgres liso).
- El servicio `redis` se eliminó por completo del compose.

**Motivo:** ambos servicios simulaban en Docker Compose una capacidad
(geoespacial, cache/cola distribuida) que el código nunca llegó a usar — dev
local corría dos contenedores de más sin ningún beneficio, y el `docker
compose up` daba una impresión falsa de la arquitectura real del sistema a
cualquiera que lo levantara para entender el proyecto.

**Impacto esperado:** `docker compose up` más liviano y más rápido en dev
local (dos servicios menos que bajar/inicializar). Cero impacto en producción:
Render/Neon no usan este archivo (es sólo para desarrollo local), y **Neon en
producción sigue siendo Postgres estándar sin PostGIS** — no hubo cambio ahí,
sólo se corrigió la documentación que decía lo contrario (ver punto 3).

**Riesgo:** ninguno — se verificó ausencia total de uso antes de sacar cada
servicio, no se infirió. Si en el futuro se necesita PostGIS o Redis de
verdad, es una decisión de arquitectura con su propio ADR (regla del propio
`CLAUDE.md`: "no introducir infraestructura pesada sin necesidad real y sin
ADR"), no una vuelta atrás de este cambio.

## 2. Advertencia de `SEED_DEMO_DATA` en producción

**Antes:** `backend/scripts/startup_seed.py` sembraba datos demo en cada
arranque en frío si `SEED_DEMO_DATA=true`, sin distinguir entorno. Sigue
activo en Render hoy (`render.yaml`) — apagarlo antes de onboardear comercios
reales es una tarea pendiente de Julieta (ver `CLAUDE.md`, "Pendiente de la
operadora"), **no de código**: requiere decidir el momento exacto del corte
con datos reales ya en la base.

**Ahora:** si `ENVIRONMENT=production` **y** `SEED_DEMO_DATA=true` al mismo
tiempo, el script imprime una alerta explícita en los logs de cada arranque:
cuentas demo con contraseña pública conocida sembrándose en la base real.

**Decisión explícita: no se apagó el seed automáticamente.** Cambiar ese
comportamiento por código sería tomar una decisión de producto/operación que
le corresponde a Julieta (cuándo exactamente cortar los datos demo), no algo
que el código deba decidir solo. Lo que sí es responsabilidad de esta fase es
que **no pase desapercibido** — antes, si alguien se olvidaba de apagar la
variable, no había ninguna señal de que seguía sembrando datos demo sobre
producción.

**Impacto esperado:** visibilidad. El día que se mire un log de arranque en
Render con `ENVIRONMENT=production`, la alerta es imposible de pasar por
alto.

**Riesgo:** ninguno — no cambia si se siembra o no, sólo agrega un `print()`.

## 3. Corrección de documentación desalineada con la infraestructura real

**Antes** (`backend/README.md`): decía que PostGIS era un requisito, que
`docker compose up` levantaba "PostgreSQL (PostGIS), Redis y el backend", y
que la migración a Neon incluía activar la extensión PostGIS (con el
`CREATE EXTENSION` incluido como paso a seguir) porque "lo necesitamos para
matching por distancia" — **ninguna de las tres afirmaciones es cierta hoy**:
el matching es Haversine en Python, no hay Redis en el código, y Neon en
producción nunca tuvo PostGIS activado (el switch a Neon del 23/07 no lo
incluyó, y el código no lo pide).

**Ahora:** las tres secciones quedaron corregidas para reflejar la
arquitectura real (ver diff en `backend/README.md`): "Requisitos" sin
PostGIS, la sección de Docker menciona qué se sacó y por qué, y "Base de
datos en producción: Neon" reescrita para dejar claro que la migración **ya
se hizo y está verificada** (no es un instructivo a futuro) y que PostGIS
"no hace falta" en vez de "lo necesitamos".

**Motivo:** checklist del propio `CLAUDE.md` — "chequear coherencia
doc↔código: si el código contradice la doc, frená e identificá la
inconsistencia antes de seguir". Esto se detectó en el mismo pase que sacó
los servicios de Docker Compose: la doc y el compose contaban la misma
historia falsa, así que se corrigieron juntos.

**Riesgo:** ninguno — es documentación, no código ejecutable.

## Resumen

Cambios puramente de configuración de desarrollo local y documentación — cero
superficie de cambio en el backend/frontend que corre en producción
(Render/Vercel/Neon no leen `docker-compose.yml`). El único `print()` nuevo en
`startup_seed.py` no altera ningún comportamiento, sólo agrega una línea de
log condicional.
