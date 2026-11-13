# Cancelar un turno le avisa a quien corresponde y dice lo que cuesta (T3e)

**Pedido:** la revisión de la beta (U076, U077, U078). Cancelar un turno con
postulantes no le avisaba a nadie; cancelar uno asignado sin confirmar decía
«se le avisa» y al trabajador no le llegaba nada; y el comercio no sabía que
cancelar un turno confirmado le suma una cancelación tardía.

**Qué cambió:** al cancelar, le llega un aviso (campanita y push) al asignado,
haya confirmado o no, y a cada persona con la postulación pendiente. La
confirmación del panel dice a quién se le avisa y, sólo con el trabajador ya
confirmado, «Te suma una cancelación tardía. La ves en tu perfil.». El
comercio ve la cuenta en su `/profile`.

A quién se avisa, por estado desde el que se cancela:

| Estado al cancelar | Antes | Después |
|---|---|---|
| Borrador | nadie | nadie |
| Publicado / buscando personal, sin postulantes | nadie | nadie |
| Publicado / buscando personal, con postulantes | nadie (las postulaciones pasaban a `rechazada` en silencio) | cada postulación pendiente: `applied_shift_cancelled` (y pasa a `rechazada`, como antes) |
| Asignado sin confirmar | nadie (el panel decía «se le avisa») | el asignado: `shift_cancelled` |
| Confirmado / en camino | el asignado: `shift_cancelled_late`; suma `late_cancellations` | igual |
| Con llegada marcada (`check_in`, `trabajando`) | el asignado: `shift_cancelled_late`; suma `late_cancellations` | igual |
| Trabajador ya terminó (`check_out`) | igual que la fila anterior | sin tocar: espera decisión de producto |

No reciben aviso: quien retiró su postulación, quien había quedado afuera al
asignarse el turno (postulación ya `rechazada`: la regla de no avisarle al que
no quedó sigue igual), quien sólo recibió «turno cerca» y el comercio.

Textos (el nombre es el título del turno o, sin título, el puesto):

- `shift_cancelled` → «El comercio canceló el turno» · «"…" se canceló antes
  de que confirmaras. Ya no tenés que responder.» Abre `/my-shifts`, donde el
  turno sigue en «Asignados» marcado como cancelado.
- `applied_shift_cancelled` → «Se canceló un turno al que te postulaste» ·
  «El comercio canceló "…". Tu postulación quedó sin efecto: mirá otros
  turnos cerca.» Abre `/feed`.
- `shift_cancelled_late` no cambia.

Técnico:

- `backend/app/modules/shift/application/services.py`: `cancel_shift` guarda
  primero todo lo que cambia (turno, postulaciones, contador del comercio) y
  después llama a `_notify_shift_cancelled`, que nunca propaga un error.
  `_reject_pending_applicants` ahora devuelve los perfiles que rechazó.
- `backend/app/modules/notification/domain/value_objects.py` y
  `push_policy.py`: los dos tipos nuevos, su destino y su vigencia (12 h,
  urgencia alta, como los demás cambios sobre un turno propio). **Sin
  migración:** `notifications.type` es `String(30)`, no un enum de la base.
- `frontend/lib/cancelar-turno.ts`: el texto de la confirmación y la cuenta
  de cuándo es tardía (espeja `COMMITTED_STATUSES`). El diálogo sigue en
  `frontend/app/shifts/page.tsx`.
- `frontend/components/company/LateCancellations.tsx`, en
  `frontend/app/profile/page.tsx`: lee `GET /companies/me/profile`.
- `frontend/lib/types.ts` y `frontend/lib/notification-link.ts`: registro de
  los tipos nuevos en la campanita.
- Tests: `backend/tests/test_cancel_shift_notifications.py` (por estado, sin
  duplicados, 404, fallo de avisos y de push),
  `frontend/lib/cancelar-turno.test.ts` y `frontend/e2e/cancelar-turno.spec.ts`.

**Por qué así:**

- La cancelación tardía sigue la regla escrita (ADR-0007, `REPUTATION.md`):
  cuenta el estado, no un plazo en horas. No se inventó ninguno.
- Los avisos van al final y envueltos: el turno ya está cancelado, y un 500
  ahí dejaba al comercio reintentando sobre un turno que responde 400.
- El aviso al postulante lleva a `/feed` y no a `/my-shifts`: la postulación
  rechazada ya no figura en ninguna lista suya y la pestaña que abre por
  defecto («Asignados») puede quedarle vacía.
- Las cancelaciones tardías se muestran en `/profile` del comercio. Sus
  números hoy no se ven en ninguna pantalla propia: están en el perfil
  público (`/companies/[id]`), que miran los trabajadores y al que el
  comercio no tiene link. Mostrarlo ahí cambiaba quién ve qué, así que no se
  tocó. En cero no dibuja nada, igual que el resto del perfil.
- Corrige lo que estaba mal escrito: `NOTIFICATIONS.md` no listaba
  `shift_cancelled_late`, y `API.md` decía sólo «Cancelar».

**Queda abierto:**

- **Cancelar con el trabajador ya terminado (`check_out`):** hoy se puede y
  cuenta como tardía. Espera decisión de producto.
- **¿Los trabajadores ven las cancelaciones tardías de un comercio?** La API
  pública (`GET /companies/{id}`) ya manda `late_cancellations`, pero ninguna
  pantalla se lo muestra. Es una regla de producto sin escribir.
- **¿Avisarle a quien había quedado afuera al asignarse el turno?** Hoy no se
  entera ni de que no quedó ni de que el turno se canceló.
- **Eventos:** no existe cancelar varios turnos a la vez; cada turno se
  cancela por separado y quien se postuló a tres recibe tres avisos. Juntarlos
  pide un «cancelar evento» que hoy no está.
- **La postulación `aceptada` del asignado** queda `aceptada` en un turno
  cancelado. No se ve en ninguna pantalla.
- **«No cubierto»** todavía ofrece «Cancelar turno» en el panel
  (`CANCELLABLE_EXCLUDED` de `ShiftActions.tsx`) y el backend lo rechaza con
  400. No se tocó: ese archivo lo cambia otra rama.
- El segundo toque sobre el diálogo que se cierra y el historial de
  cancelaciones y ausencias del trabajador en su perfil van en otros PRs.
