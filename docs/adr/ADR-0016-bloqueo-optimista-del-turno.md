# ADR-0016 — Bloqueo optimista del turno: la segunda acción simultánea no se guarda

**Estado:** aceptado · **Fecha:** 2026-10-10

## Contexto

La auditoría del 2026-10-10 reprodujo con tests que dos acciones simultáneas
sobre el mismo turno se pisaban. Cada caso de uso de `ShiftService` lee el
turno, aplica la transición del dominio y `SqlAlchemyShiftRepository.update`
reescribe la fila entera. No había `SELECT … FOR UPDATE` ni control de
versión en ningún lado: ganaba el último en escribir.

Casos concretos:

- El comercio cancela un turno ASIGNADO mientras el trabajador lo confirma
  con una lectura previa: queda **CONFIRMADO**, un estado terminal reabierto,
  y el trabajador va a un turno cancelado.
- Dos asignaciones simultáneas (doble toque desde dos dispositivos, sin la
  misma `Idempotency-Key`): el turno queda con uno solo.
- El scheduler contra el usuario: usa una sesión por pasada y
  `session.get` devolvía la copia del identity map, así que decidía (no-show,
  no cubierto) sobre un estado que el usuario ya había cambiado.

## Decisión

**Bloqueo optimista con una columna `version` en `shifts`** (migración 0036):

- `ShiftModel.version` con `version_id_col` de SQLAlchemy: cada UPDATE lleva
  `WHERE version = n` y la incrementa. Si afecta 0 filas, `StaleDataError`.
- La entidad `Shift` transporta la `version` con la que se leyó.
  `update()` relee la fila (`populate_existing`) y la compara con la de la
  entidad antes de escribir: así cubre la ventana entera entre la lectura
  del caso de uso y el guardado, no sólo la del commit.
- Si perdió: `ShiftConcurrentModificationError`, nada se guarda, la API
  responde **409** "El turno cambió mientras tanto" (handler global en
  `app/main.py`).
- `get_by_id` siempre lee la base (`populate_existing`), y el scheduler
  saltea el turno que perdió en vez de cortar la pasada (`scheduler._act`).

## Alternativas descartadas

- **`SELECT … FOR UPDATE` (bloqueo pesimista).** Correcto en Postgres, pero
  SQLite —la base de los tests— lo ignora: el arreglo no se podría probar.
  Además obliga a separar "leer para mostrar" de "leer para modificar" en
  los 19 caminos que hoy usan `get_by_id`, y mantiene la fila bloqueada
  mientras el caso de uso manda notificaciones.
- **UPDATE condicional por estado (`WHERE status = esperado`).** Atrapa los
  cambios de estado pero no los de otros campos (asignar a otra persona sin
  cambiar de estado, reportes de ubicación).
- **Unit of work transaccional para todo el caso de uso.** Es la solución de
  fondo para la atomicidad (hoy cada repositorio commitea por su cuenta), pero
  toca todos los módulos. Queda como deuda; no hace falta para cortar las
  carreras.

## Consecuencias

- Una carrera real ahora termina en un 409 para el segundo, que vuelve a leer
  y decide sobre el estado nuevo. Es lo correcto: el segundo actuaba sobre
  información vieja.
- `get_by_id` hace siempre un SELECT, incluso si la fila ya estaba en la
  sesión. El costo es despreciable al volumen actual.
- Los efectos secundarios de un caso de uso (notificaciones, cambios de
  postulaciones) ya se hacían **después** de guardar el turno, así que el que
  pierde la carrera no los dispara.
- Escrituras al turno que no pasen por `update()` (UPDATE masivos) no suben
  la versión: no generan conflictos falsos, pero tampoco se detectan.
  Hoy no hay ninguna.
