# Pedidos repetidos: reintentos y toques dobles sin errores técnicos

**Pedido:** Julieta, a partir de la pasada por clase de error del 2026-11-19
(CON-01, CON-05, CON-12, CON-14): que reintentar una acción cuya respuesta se
perdió, o mandar lo mismo desde dos pantallas, no termine en un error en
jerga ni en un 500.

**Qué cambió:** lo que ve la persona: reintentar «Llegué», «Terminé»,
«Rechazar», «Cancelar mi asignación», «Cerrar turno» o «Marcar pagado» tras
perder la respuesta devuelve la confirmación en vez de «Esta Idempotency-Key
ya se usó con un pedido distinto» o «Turno no encontrado»; postularse o
calificar dos veces a la vez da «Ya te postulaste» / «ya calificaste» (409) y
no «Error del servidor»; un «Confirmar» nuevo ya no repite una respuesta vieja.
- CON-14: `reject`, `worker-cancel`, `start-working`, `finish` y `mark-paid`
  (`backend/app/modules/shift/api/routes.py`) tienen `RecorderDep` y guardan la
  respuesta, como `confirm`, `check-in` y `check-out`. `depart` queda sin
  clave (ruta legada, el cliente no la usa).
- CON-01: `frontend/app/my-shifts/page.tsx` guarda con la key la posición del
  primer intento (`recordar`/`recordado`) y la reusa en el reintento.
- CON-12: `frontend/lib/idempotency.ts`: la key vence a los 5 minutos
  (`VENTANA_REINTENTO_MS`) y se suelta ante un error definitivo
  (`clearSiTermino`: 4xx salvo 408 y 409), en Mis turnos y en el panel del
  comercio. El almacenamiento con `persistKey` ahora guarda `{k, t, p}` y lee
  el formato viejo.
- CON-05: los repositorios de postulaciones y de reseñas atrapan el
  `IntegrityError` del insert (la sesión queda usable tras el `rollback`) y, si
  es la fila única (turno y trabajador, turno y calificador), lanzan
  `AlreadyAppliedError` / `DuplicateReviewError`; otra violación se propaga.

**Por qué así:** CON-12 se podía arreglar sólo «al terminar», pero el caso
real es una respuesta perdida (error de red: no se sabe si terminó), así que
se sumó el vencimiento. En el servidor no se cambió la repetición de la
respuesta guardada: es correcta para el mismo intento. CON-05 se resuelve en
el repositorio (capa de infraestructura, el caso de uso no conoce SQLAlchemy)
y reconoce la restricción por su nombre (Postgres) o por sus columnas
(SQLite). Una primera versión releía la fila para confirmar; se descartó
porque la lectura de más rompía `test_postulacion_desasignada` (que cuenta las
lecturas de `_mark_unassigned`), y lo encontró la suite completa.

**Queda abierto:** las demás pantallas (Inicio, Mapa, Buscar) no usan
`clearSiTermino`; ahí la key es por turno y se suelta al éxito o al error
definitivo ya manejado. Tests: `backend/tests/test_pedidos_repetidos.py`,
`frontend/lib/idempotency.test.ts`.
