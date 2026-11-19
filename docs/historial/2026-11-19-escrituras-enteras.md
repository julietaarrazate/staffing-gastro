# El backend deja de guardar entidades enteras que pisan lo que otro escribió

**Pedido:** hallazgos ESC-01, CON-13 y CON-08 de la pasada por clase de error
del 2026-11-19 (Julieta, beta). Una sola causa: tres repositorios guardaban
la entidad entera desde la copia que el caso de uso leyó al empezar, sin
versión ni condición, y pisaban lo que otro pedido escribió en el medio.

**Qué cambió:**

- **Verificación de identidad (ESC-01).** Si la persona reenviaba el DNI, la
  selfie o la constancia justo cuando la admin decidía, la admin aprobaba la
  evidencia vieja y los archivos nuevos quedaban en Cloudinary sin dueño y
  fuera de la cola de borrado (ADR-0021). Ahora aprobar y rechazar mandan el
  `submitted_at` del envío que la cola mostró; si la persona volvió a mandar
  los documentos, la admin ve «La persona volvió a mandar los documentos.
  Revisalos de nuevo.» y «Reintentar» trae lo nuevo. En el backend,
  `SqlAlchemyClaimRepository.update` hace `UPDATE … WHERE status = <leído>
  AND submitted_at = <leído>` antes de tocar evidencias y cola; si afectó 0
  filas, `ClaimChangedError` (`backend/app/modules/verification/`). El
  reenvío que choca relee y reintenta hasta 3 veces (si pierde las 3, 409
  «No pudimos guardar tu envío porque cambió mientras tanto. Probá de
  nuevo.»); si lo que entró fue una aprobación, responde «ya está
  verificada» y manda a la cola de borrado los archivos de ese envío, que ya
  estaban subidos. Frontend: `frontend/components/admin/IdentityReviewQueue.tsx`.
- **Usuario (CON-13).** Cambiarse el nombre mientras la admin suspendía la
  cuenta la dejaba activa (y una contraseña restablecida durante una
  suspensión volvía a la vieja). `SqlAlchemyUserRepository.update` escribe
  ahora sólo las columnas que el caso de uso cambió desde que leyó
  (`backend/app/modules/identity/infrastructure/repositories.py`).
- **Suscripción (CON-08).** La pasada de vencimiento dejaba «vencida» a quien
  pagaba mientras corría; baja y pago se pisaban; dos publicaciones a la vez
  sumaban una sola al contador del plan (esto pasa hoy, con el cobro
  apagado). `SqlAlchemySubscriptionRepository.update` guarda sólo si la fila
  sigue como se leyó, y cada caso de uso relee y vuelve a aplicar su regla
  (`change_subscription` en `subscription/domain/repositories.py`, hasta 3
  veces; si pierde las 3, 409 «Tu plan cambió mientras tanto…»). La pasada
  de vencimiento saltea la que cambió y la mira en la próxima. El contador
  de turnos publicados suma en la base (`turnos_usados_mes + 1`,
  `register_publication`), sin leer ni reintentar. Un arrepentimiento que
  quedó a medias (reembolsado, plan sin cortar) se termina al reintentar,
  sin reembolsar dos veces.
- La entidad lleva cómo estaba la fila al leerla (`persisted_state`, lo arma
  el repositorio) y los dos modos de guardar están en
  `backend/app/core/row_state.py`.
- Al integrarlo sobre el CV privado (#669), la cola de borrado quedó con una
  sola puerta: `queue_file_deletions(session, files)` sobre `add_pending`
  (`verification/infrastructure/repositories.py`; `file_cleanup_job.py` la
  reexporta para el CV). El pedido que se guarda encola con `add_pending`
  en su commit, y el envío descartado usa la misma puerta y confirma solo.
  El ADR-0021 y `PENDIENTE_OPERATIVO.md` (5c) piden correr
  `privatize_identity_evidence.py` sin pedidos abiertos y volver a correrlo.
- Tests: `test_verificacion_decision_vs_reenvio.py`,
  `test_usuario_escribe_sus_columnas.py`,
  `test_suscripcion_guarda_si_no_cambio.py` (carreras con dos sesiones de
  base) y un e2e en `frontend/e2e/verificacion-privada.spec.ts`.

**Por qué así:** lo más chico que corta la carrera, sin migración. El
usuario va por columnas porque cada caso de uso escribe columnas distintas
(nombre, contraseña, estado, rol, verificado): así quedan los dos cambios,
y una versión los habría hecho chocar sin necesidad. La suscripción y el
pedido de verificación necesitan condición, porque la decisión depende de
columnas que otro cambia (la pasada vence según `paid_until`; el contador
suma sobre el valor leído; la admin decide sobre un envío). En vez de una
columna `version` como el turno (ADR-0016), la condición es la fila leída:
en el pedido, estado y `submitted_at` (cada cambio mueve uno de los dos); en
la suscripción, las ocho columnas que escribe. Descartado: `SELECT … FOR
UPDATE` (SQLite, la base de los tests, lo ignora; mismo motivo que
ADR-0016) y una versión en `users` (habría hecho fallar el cambio de nombre
en vez de guardar los dos). ADR-0021 y ADR-0022 suman una actualización.

**Queda abierto:** los otros hallazgos del cobro (CON-06, CON-07, CON-09)
van aparte. Si el webhook pierde la carrera 3 veces seguidas después de
aprobar el pago responde 500, y el reintento de Mercado Pago contesta
«duplicado»: es un camino nuevo hacia CON-06. Los tests de
`test_verification_envio_repetido.py` (anteriores a este cambio) usan un
`user_id` inventado y fallan en Postgres por la clave foránea; los de este
cambio crean la cuenta.
