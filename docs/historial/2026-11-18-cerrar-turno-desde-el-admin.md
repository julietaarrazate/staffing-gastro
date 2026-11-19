# «Cerrar turno» desde el admin para una cuenta suspendida (decisión 21)

**Pedido:** Julieta, decisión 21 del tablero de la beta. Un turno ya empezado
de una cuenta suspendida no se toca al suspender (ADR-0024, punto 3), pero la
parte suspendida ya no puede entrar: si es el trabajador, nadie marca la
salida; si es el comercio, nadie cierra el turno. Pidió una acción de la admin
que lo haga en nombre de la parte suspendida, con registro.

**Qué cambió:** en la ficha de una cuenta suspendida (`/admin/personas/[id]`),
cada turno donde aplica (los recientes y, aunque no estén entre ellos, los
empezados) muestra por qué («No puede entrar a marcar
la salida.») y el botón «Cerrar turno». El diálogo dice qué va a pasar (marca
la salida a las HH:MM, cierra el turno, a quién se avisa, que no se marca
pagado y que queda registrado) y, al confirmar, el resultado.

- Trabajador suspendido con la llegada marcada: se marca la salida sin
  ubicación y con la hora de ahora; aviso al comercio «Marcamos la salida de
  un turno», que después cierra como siempre.
- Comercio suspendido con la salida marcada: se cierra con los efectos del
  cierre del comercio (reputación con la puntualidad registrada y «Cerró tu
  turno» al trabajador).
- Las dos suspendidas: las dos cosas en una sola acción; nadie recibe avisos
  en el celular.
- Cualquier otro caso, 409 con el motivo para la admin; turno inexistente, 404.

Técnico: dominio en `Shift.admin_close_plan`, `admin_check_out` y
`close_for_suspended_account` (`backend/app/modules/shift/domain/entities.py`),
`AdminClosePlan` en `value_objects.py`, textos en `mensajes.py`; registro en
`shifts.closed_by_admin_at` y `closed_by_admin_user_id` (migración
`0058_turno_cerrado_por_la_admin.py`, sobre 0057). Caso de uso
`ShiftService.close_for_suspended_account` y `admin_close_plans`, por el
puerto `SuspendedAccountShiftCloser` (`shift/domain/suspension.py`); el
cierre comparte `_save_finished` con `finish`. API `POST
/api/v1/admin/shifts/{id}/close` (`admin/api/routes.py`, log `admin
close_shift`) y `admin_close` por turno en la ficha (`AdminService.get_user_detail`).
Frontend: `components/admin/CerrarTurnoDialog.tsx`, textos en
`components/admin/people.ts`. De paso, el estado del turno en la ficha ya no
se parte en dos renglones a 390 px. Tests: `backend/tests/test_cerrar_turno_admin.py`,
`components/admin/CerrarTurnoDialog.test.tsx`, `people.test.ts` y
`e2e/admin-personas.spec.ts`. Docs: ADR-0024 (sección de la decisión 21),
DOMAIN, NOTIFICATIONS, MAPA_DEL_CODIGO, QUE_EXISTE_HOY y el tablero.

**Por qué así:** la regla vive una sola vez en el dominio y la usan el botón de
la ficha y el caso de uso, así la ficha no ofrece algo que después da 409. La
admin cruza al módulo de turnos por puerto, como con los efectos de la
suspensión. El aviso al comercio dice que Oído marcó la salida «porque no
pudo marcarla», sin decir que la cuenta está suspendida (como el resto de los
avisos; la primera versión lo decía y se cambió en la coordinación). Descartado: cerrar solo al suspender (la salida tiene que ser la
hora real) y marcar pagado (es del comercio).

**Revisión independiente (mismo día):** el pedido manda lo que la admin
confirmó (`check_out`, `finish`) y si ahora se haría otra cosa responde 409
«El turno cambió: volvé a abrir la ficha.» y la ficha se recarga; la ficha
trae aparte, sin límite, los turnos empezados de la persona y calcula la
acción sólo donde es parte (no en un turno del historial que ya tiene otra
persona); el aviso al comercio dice la hora sola (se puede leer otro día);
a una cuenta suspendida no se le corta el aviso guardado en la app, sólo el
push, como al resto de los avisos (#636; la primera versión de este arreglo lo
cortaba y se volvió a la regla general en la coordinación); «Sí, cerrar turno», «Entendido» y «Sí, hacer admin» pasan de `dark`
(1,1:1 contra el diálogo en oscuro) a la acción principal (3,19:1 en claro,
5,33:1 en oscuro).

**Queda abierto:** nada de esta decisión.
