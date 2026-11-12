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
- Sin migración.

**Por qué así:** la restricción única ya garantizaba un solo pedido; faltaba que
el perdedor de la carrera se comportara como un reenvío. Ningún archivo queda sin
dueño: los del último envío quedan en el pedido y los del envío anterior en la
cola de borrado. Se descartó un bloqueo previo (más infraestructura para el mismo
resultado).

**Tests:** `backend/tests/test_verification_envio_repetido.py` (repositorio,
servicio con lectura vieja para identidad y comercio, reintento que vuelve a
fallar, y API). La base de los tests (SQLite en memoria) comparte una sola
conexión, así que la superposición se arma a mano y no con tareas paralelas.

**Queda abierto:** nada.
