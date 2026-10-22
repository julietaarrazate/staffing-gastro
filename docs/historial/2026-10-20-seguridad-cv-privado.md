# El CV del trabajador sólo lo ve quien tiene un vínculo con él

**Pedido:** Julieta, 2026-10-20, como parte de la revisión de seguridad
(ítem «Revisión de seguridad del 2026-10-20» de `../STATUS.md`, prioridad media).

**Qué cambió:** `GET /workers/{profile_id}` devolvía `cv_url` a cualquier
sesión. El mapa del comercio entrega los `profile_id`, así que cualquier
cuenta de comercio (incluida una demo) podía juntar los CV de todos, y un CV
suele traer teléfono, email y domicilio.

- `backend/app/modules/worker/api/routes.py`: `cv_url` se oculta salvo para
  el dueño, admin, o un comercio con un turno asignado o una postulación de
  esa persona (`_CONTACT_PROFILE_FIELDS`).
- `backend/app/modules/worker/api/dependencies.py`:
  `EmployerWorkerRelation` responde ese "¿hay vínculo?" leyendo company,
  shift y application. Vive en `api/` porque cruza tres módulos sólo para
  leer, igual que las otras dependencias de este archivo.
- `backend/tests/test_privacidad_datos_trabajador.py`:
  `test_cv_only_for_employers_linked_to_the_worker`.

**Por qué así:** el comercio que recibe una postulación necesita el CV para
decidir; uno que sólo ve el mapa, no. Mira hasta 200 turnos y postulaciones
del trabajador; si algún día no alcanza, pasa a una consulta SQL con JOIN.
El frontend (`app/workers/[id]/page.tsx`) ya manejaba `cv_url` vacío.

**Queda abierto:** nada de este tema. El resto sigue en el ítem «Revisión de seguridad
del 2026-10-20» de `../STATUS.md`.

**Revisión del 2026-10-21:** el vínculo se podía fabricar. `EmployerWorkerRelation`
contaba cualquier turno con `worker_profile_id`, y la asignación directa
(`POST /shifts/{id}/assign`) la hace el comercio solo, sin postulación ni
consentimiento: publicar un turno, asignarlo al `profile_id` del mapa y pedir
`GET /workers/{id}` alcanzaba para llevarse el CV (una URL permanente), aunque
la persona rechazara después. Ahora cuenta sólo lo que hizo el trabajador: una
postulación suya a un turno del comercio, o un turno del comercio que confirmó
o siguió de ahí en el ciclo (`_LINKED_SHIFT_STATUSES`: CONFIRMADO, EN_CAMINO,
CHECK_IN, TRABAJANDO, CHECK_OUT, FINALIZADO, PAGADO). ASIGNADO no cuenta;
CANCELADO y NO_CUBIERTO tampoco, porque se llega a ellos también desde ASIGNADO
sin confirmar. Tests nuevos en `test_privacidad_datos_trabajador.py`: asignación
directa sin confirmar (y después rechazada) → `cv_url` null; confirmada → lo ve;
postulación del trabajador → lo ve (y un comercio ajeno, no).
