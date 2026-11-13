# Verificación: mandar el DNI o la constancia dos veces a la vez ya no da error

**Pedido:** salida a beta, etapa 2. Reporte externo (Breken, BK-670B15B8C122):
si la persona manda el formulario de verificación dos veces casi a la vez (dos
pestañas, o doble toque con conexión lenta), el segundo envío salía como error
genérico (500) y no sabía si su documentación había llegado.

**Qué cambió:** lo que ve la persona: los dos envíos terminan bien. Queda un
solo pedido pendiente, con los archivos del último envío. Aplica igual al DNI y
selfie del trabajador y a la constancia del comercio.

Lo técnico:

- `verification/application/services.py`: `submit_identity_document` y
  `submit_business_document` comparten `_submit`. Si el alta choca con
  `uq_identity_claim_user_type`, relee el pedido que ganó y reenvía sobre él por
  el camino normal de un reenvío (los archivos del envío anterior entran a la
  cola de borrado). Un solo reintento; si vuelve a fallar, el error sube.
- `verification/infrastructure/repositories.py`: `add` traduce el choque de
  unicidad a `ClaimAlreadyExistsError` (nuevo, en `domain/exceptions.py`) y hace
  rollback antes de devolver la sesión. Otras violaciones de integridad siguen
  subiendo como estaban.
- `verification/domain/entities.py`: `Claim.submit` no manda a la cola de
  borrado un archivo que las evidencias nuevas siguen usando (filtra por
  `public_id`). Cubre el mismo cuerpo reenviado, solapado o secuencial, y el
  caso de cambiar sólo uno de los archivos: antes los archivos vigentes se
  borraban del storage aunque el pedido pendiente los usara.
- Sin migración.

**Por qué así:** la restricción única ya garantizaba un solo pedido; faltaba que
el perdedor de la carrera se comportara como un reenvío. Ningún archivo queda sin
dueño: los del último envío quedan en el pedido y los del envío anterior en la
cola de borrado. Se descartó un bloqueo previo (más infraestructura para el mismo
resultado).

**Tests:** `backend/tests/test_verification_envio_repetido.py` (repositorio,
servicio con lectura vieja para identidad y comercio, reintento que vuelve a
fallar, API con archivos distintos y con el mismo cuerpo dos veces, otra
violación de integridad que sigue subiendo, y dos sesiones reales). La base de
los tests (SQLite en memoria) comparte una sola conexión, así que los tests
con lectura vieja arman la superposición a mano; el de dos sesiones reales usa
SQLite en archivo (dos conexiones y una barrera para que las dos lean «no hay
pedido» antes de guardar). En `test_borrado_evidencias.py`, los de dominio del
filtro por `public_id`. CI corre `pytest -q` sin servicio de base (SQLite), así
que la concurrencia contra Postgres sólo se probaría a mano.

**Queda abierto:** tres o más envíos simultáneos, o dos reenvíos simultáneos
sobre un pedido que ya existe (dos pestañas después de un rechazo): el pedido
queda con las evidencias de dos envíos (el admin ve dos juegos), sin error ni
archivos sin dueño. Ya pasaba antes de este arreglo. Se resolvería leyendo el
pedido con bloqueo de fila (`with_for_update`) al enviar, en otro PR.
