# Postulación: se decide sobre un estado que ya cambió (VIE-01, CON-04, CON-11) (#671)

**Pedido:** pasada por clase de error del 2026-11-19; tres hallazgos verificados con una sola causa: una decisión sobre un estado que ya no es el de la base.

**Qué cambió:**
- **VIE-01.** El comercio con la lista de candidatos abierta podía asignar a quien ya había retirado su postulación (y a esa persona le llegaba «Te asignaron un turno»). Ahora `ApplicationService.withdraw` le manda al comercio un cuadro de refresco por el socket de avisos (`{"type": "live_refresh"}`, `NotificationRepository.request_live_refresh`): sin aviso guardado, sin campanita, sin push. `NotificationBell` lo reconoce (no tiene `id`) y llama a `emitLiveRefresh()`, así `useLiveRefresh` recarga la lista. Además, la pantalla de candidatos recarga la lista en silencio después de un error al asignar. `/assign` no cambió.
- **CON-04.** `ApplicationService.apply` relee el turno (`get_by_id`) después de guardar la postulación; si ya no está abierto la deshace (`withdraw`, queda `retirada`) y responde igual que a un turno cerrado (404), sin avisar «postulante nuevo» al comercio. También cubre el camino de volver a postularse. `ShiftApplicationRepository.get_by_id` ahora usa `populate_existing`.
- **CON-11.** `ShiftService.confirm_assignment` toma el bloqueo de la agenda de la persona (`WorkerProfileRepository.lock_agenda`: `SELECT id … FOR NO KEY UPDATE` sobre su perfil) antes de leer los turnos comprometidos. Dos confirmaciones a la vez de turnos superpuestos se serializan: la segunda espera, ve al otro ya confirmado y recibe el rechazo por superposición.
- Tests: `backend/tests/test_postulacion_estado_viejo.py`, `frontend/e2e/candidatos-postulacion-retirada.spec.ts`, casos nuevos en `NotificationBell.reconexion.test.tsx`. Docs: «Cuadro de refresco» en `docs/reference/NOTIFICATIONS.md`.

**Por qué así:**
- VIE-01: no se tocó la regla de `/assign` (acepta postulaciones `retirada` a propósito, ADR-0026 punto 5, para asignar desde «Recomendados»). Cerrar el hueco sin refresco exigiría que `/assign` sepa de dónde viene el pedido; eso es una regla del producto y no se hizo. Un cuadro del socket y no un aviso nuevo, para no sumar ruido a la campanita ni al push por un cambio que el comercio sólo necesita ver reflejado.
- CON-04: releer después de guardar es correcto sin bloquear: quien cierra el turno guarda el estado antes de recorrer las pendientes, así que o esa pasada ve la fila nueva, o la relectura ve el turno cerrado. Se descartó el `INSERT … SELECT … WHERE status IN …` (no encaja con el ORM ni con la reactivación).
- CON-11: el bloqueo es `FOR NO KEY UPDATE` para que no choque con el KEY SHARE que los turnos toman sobre el perfil al apuntarle (asignar no espera). Se descartó releer y deshacer después de escribir: confirmar no tiene vuelta atrás en la máquina de estados, y dos que se deshacen a la vez dejan a ambos sin turno. En SQLite no hace nada (escribe de a uno).
- La carrera de CON-11 sólo existe en Postgres: el test real (`test_dos_confirmaciones_a_la_vez_…`) corre con `TEST_POSTGRES_URL=postgresql+asyncpg://…` apuntando a una base vacía y descartable (borra y crea las tablas); sin la variable se saltea. Sin el bloqueo da `[200, 200]`, con él `[200, 400]`. En SQLite queda un test que fija el orden (bloqueo antes de leer los comprometidos).

**Queda abierto:**
- El auto-retiro de postulaciones al confirmar otro turno (U123, `_withdraw_overlapping_applications`) tampoco le avisa al comercio con la lista abierta; mismo hueco que VIE-01, por otro camino.
- Al asignar, el resto de los postulantes pasa a `rechazada` sin aviso (por diseño): su lista queda «pendiente» hasta recargar.
- El candado por persona de CON-11 sólo cubre confirmar contra confirmar: asignar, o confirmar mientras el comercio reasigna directo, no pasan por él (dentro del alcance de CON-11, pero queda escrito).
- La relectura de CON-04 está probada en SQLite con el intercalado forzado; en Postgres la cubre el razonamiento de la revisión (cada escritura confirma antes de leer), no una prueba con dos sesiones reales.

**Lo que agregó la revisión independiente:** si el comercio le asigna el turno a la misma persona (desde «Recomendados») mientras ella se postula, la postulación queda aceptada y no retirada, y al comercio no le llega «postulante nuevo». La campanita ignora un cuadro del socket que no sea un objeto.
