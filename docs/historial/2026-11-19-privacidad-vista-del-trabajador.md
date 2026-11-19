# Privacidad: la vista de un turno para el trabajador, sin datos de otra persona

**Pedido:** Julieta, pasada por clase de error de la beta (etapa 2, punto 1
del 2026-11-19). La clase «privacidad entre roles» encontró dos casos en que
un trabajador recibía datos de otra persona dentro de un turno; los dos
quedaron verificados por un segundo agente, con un test que fallaba.

**Qué cambió:**

- **PRI-01.** Quien toma un turno reofrecido (U080) ya no recibe quién faltó
  antes ni cuándo (`last_no_show_worker_profile_id`, `no_show_at`). Antes los
  heredaba como «parte» del turno en el detalle, en `/shifts/mine`, en «Mis
  postulaciones», en «Guardados» y en las respuestas de sus propias acciones
  (confirmar, llegar, salir…), y con el id llegaba al perfil de la persona
  que faltó. El comercio dueño y admin lo siguen viendo (el paso «asignado»
  del panel lo usa).
- **PRI-05.** `paid_at` pasa a `WORKER_DATA_FIELDS`: quien se postuló o
  guardó un turno que tomó otra persona ya no ve cuándo el comercio le pagó.
- Técnico: `for_worker` en `backend/app/modules/shift/api/schemas.py` arma la
  vista de un turno para un trabajador (la de no-parte si no lo tiene
  asignado; si lo tiene, sin `NO_SHOW_FIELDS` ajenos). La usan el detalle
  (`get_shift`, cuando la parte es el trabajador), `/shifts/mine`, todas las
  transiciones del trabajador en `shift/api/routes.py`,
  `_shift_for_applicant` (`application/api/routes.py`) y los guardados
  (`saved_shift/api/routes.py`). Test:
  `backend/tests/test_privacidad_ausencia_y_pago.py`.

**Por qué así:** un solo helper para toda respuesta que embebe un turno para
un trabajador, como ya pasaba con `without_worker_data` para quien no es
parte: el error venía de que cada ruta decidía por su cuenta. Si la ausencia
registrada es de la misma persona que tiene el turno, no se recorta: es su
propio dato.

**Queda abierto:** el resto de la pasada, grupo por grupo, en
[`planning/BETA_TABLERO.md`](../planning/BETA_TABLERO.md), «Pasada por clase
de error (2026-11-19)». Este PR además saca de `STATUS.md` (ítem 11) cinco
puntos de la revisión de seguridad del 2026-10-20 que la pasada encontró ya
resueltos en el código.
