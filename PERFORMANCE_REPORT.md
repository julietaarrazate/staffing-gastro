# PERFORMANCE_REPORT.md — Optimizaciones de performance (producción)

> Parte de PRODUCTION_HARDENING.md, Fase 2. Cada cambio documenta **motivo**,
> **impacto esperado** y **riesgo** — ninguno modifica comportamiento
> funcional ni contratos de API. El análisis de `<img>` vs `next/image`
> (encargado en esta misma fase) es un documento aparte, sin cambios de
> código: [NEXT_IMAGE_ANALYSIS.md](./NEXT_IMAGE_ANALYSIS.md).

## 1. `/admin/stats` — conteos de usuarios en SQL

**Antes** (`backend/app/modules/admin/application/services.py`):
`get_stats()` llamaba `self._users.list_all()` — traía **toda** la tabla
`users` a memoria del proceso Python — y contaba workers/employers/admins/
activos/suspendidos/verificados con `sum(1 for u in users if ...)` sobre esa
lista completa, seis veces.

**Ahora:** `UserRepository.count_stats()` (puerto nuevo en
`backend/app/modules/identity/domain/repositories.py`, implementado en
`SqlAlchemyUserRepository` con `func.sum(case(...))`) hace los seis conteos
en **una sola query agregada** en la base de datos.

**Motivo:** N+1-en-Python clásico — el panel de admin escala con el tráfico
del comercio/founder que lo mira, pero el costo de la query escalaba con el
**total de usuarios registrados en la plataforma**, no con el tráfico. Con la
base actual (beta, decenas/cientos de usuarios) el impacto es chico; es
justamente el tipo de query que se vuelve un problema silencioso al crecer,
sin que nadie note el punto en que empezó a doler.

**Impacto esperado:** de O(usuarios totales) transferidos por red +
procesados en Python, a una sola query con `GROUP BY`/`SUM` que Postgres
resuelve con un solo escaneo (o índice, si se agrega en el futuro) — el
trabajo se mueve de "traer todo y contar" a "que cuente la base, que es para
lo que está". Mejora sustancialmente en el momento en que la tabla `users`
tenga miles de filas; hoy es preventivo.

**Riesgo:** ninguno de comportamiento — `PlatformStats` devuelve exactamente
los mismos campos con los mismos valores. Cubierto por los tests existentes
de `test_admin.py` (no se modificaron, siguen pasando).

## 2. Índices compuestos nuevos

**Antes:** `notifications` tenía índices simples en `user_id` y en `read` por
separado (migración `0005`); el filtro real que usa el producto ("no leídas
de este usuario") no tenía un índice que lo cubriera directo. Lo mismo en
`shift_applications`: sólo índice en `shift_id`, sin cubrir el filtro
"postulaciones pendientes de este turno" (`shift_id` + `status`).

**Ahora** (migración `0022_indices_and_check_constraints.py`):
- `ix_notifications_user_id_read` (`user_id`, `read`)
- `ix_shift_applications_shift_id_status` (`shift_id`, `status`)

**Motivo:** son los dos filtros compuestos que el código realmente ejecuta
(ver `docs/reference/DATABASE.md`), y sin el índice compuesto Postgres
necesita combinar dos índices simples (bitmap AND) o escanear de más — más
lento que un solo índice que ya cubre ambas columnas.

**Impacto esperado:** consultas más rápidas en las dos pantallas que más se
refrescan en el uso real del producto — el contador de notificaciones sin
leer (se pide seguido, casi en cada navegación) y el panel de postulantes de
un turno activo. Con volumen bajo el efecto no se nota; es la clase de índice
que evita que una tabla que hoy tiene cientos de filas se vuelva lenta cuando
tenga decenas de miles.

**Riesgo:** bajo. Todo índice tiene un costo pequeño de escritura (cada
INSERT/UPDATE en esas tablas actualiza un índice más) y de espacio en disco;
para el volumen de escrituras de este producto (notificaciones y
postulaciones, no un feed de alta frecuencia) es despreciable frente al
beneficio de lectura.

## 3. CHECK constraints en `shifts`

**Antes:** `quantity > 0`, `pay_amount >= 0` y `end_at > start_at` se
validaban **sólo** en la capa de dominio (`Shift._validate_schedule`) y en los
schemas Pydantic (`Field(ge=...)`). Nada a nivel de base de datos impedía que
una fila inconsistente llegara a existir si algo escribía por fuera del
dominio (un script de datos, una migración manual, un acceso directo durante
un incidente).

**Ahora** (misma migración `0022`): tres `CHECK CONSTRAINT` en la tabla
`shifts` — `ck_shifts_quantity_positive`, `ck_shifts_pay_amount_non_negative`,
`ck_shifts_end_after_start`. Aplicadas también en el modelo SQLAlchemy
(`backend/app/modules/shift/infrastructure/models.py`, `__table_args__`) para
que los tests (que usan `Base.metadata.create_all` sobre SQLite, no Alembic)
las respeten igual.

**Motivo:** esto no es una optimización de velocidad — es una red de
seguridad de **integridad de datos**, puramente aditiva: si el dominio ya
valida todo correctamente (que lo hace), estas constraints nunca se disparan
en operación normal. Existen para el escenario "algo bypasseó el dominio", no
para el camino feliz.

**Impacto esperado:** ninguno en velocidad de queries normales; previene
corrupción de datos silenciosa en el escenario de borde de arriba.

**Riesgo:** ninguno para el código actual — se verificó explícitamente que el
dominio ya garantiza estas tres reglas (`Shift._validate_schedule`,
`quantity`/`pay_amount` con `Field(ge=...)`) antes de agregar las
constraints, así que ninguna fila existente ni ningún flujo actual puede
violarlas. `batch_alter_table` usado por compatibilidad con SQLite (los tests
lo necesitan; en Postgres es un `ALTER TABLE` directo).

## 4. Compresión GZip de respuestas

**Antes:** sin ninguna compresión — cada response HTTP viajaba con su tamaño
completo en JSON, sin importar cuán grande fuera un listado.

**Ahora** (`backend/app/main.py`): `GZipMiddleware(minimum_size=1000)` — sólo
comprime respuestas de más de 1 KB (evita el overhead de comprimir payloads
chicos, donde la compresión en sí puede pesar más que lo que ahorra).

**Motivo:** los listados (turnos, postulantes, notificaciones) son JSON
repetitivo (mismas claves en cada objeto del array) — el caso ideal para
compresión, con ratios típicos de 70-90% de reducción de tamaño.

**Impacto esperado:** menor tiempo de descarga en conexiones móviles (el
contexto real de uso: trabajadores y comercios en la calle, no en oficinas
con fibra) para cualquier endpoint que devuelva una lista. Costo de CPU en el
servidor para comprimir, generalmente mucho más barato que el tiempo ahorrado
en red — trade-off estándar y favorable para APIs JSON.

**Riesgo:** ninguno funcional (`Content-Encoding: gzip` es transparente para
cualquier cliente HTTP moderno, incluido `fetch` del navegador). Sin cambios
en ningún endpoint.

## 5. `next/image` — análisis, no implementación

Encargado explícitamente como **análisis primero, migración después**: ver
[NEXT_IMAGE_ANALYSIS.md](./NEXT_IMAGE_ANALYSIS.md) para el inventario
completo de los 10 usos de `<img>`, su clasificación en 3 buckets (migración
segura / requiere validación visual / mantener como `<img>`) y el plan de
migración priorizado. Ningún componente fue tocado en esta fase.

## Resumen

Todos los cambios de esta fase son **aditivos** (un índice más, un middleware
más, una query más eficiente) — ninguno cambia el resultado de ninguna
operación, sólo su costo. Verificado con la suite completa de tests
(`pytest -q`, 270 passed) después de cada cambio.
