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
  después llama a `_notify_shift_cancelled`, que atrapa por separado el fallo
  del aviso al asignado y el de los postulantes.
  `_reject_pending_applicants` ahora devuelve los perfiles que rechazó.
- `backend/app/modules/notification/infrastructure/repositories.py`
  (`_commit_or_reset`): si la base rechaza un aviso, el adaptador deja la
  sesión usable y propaga el error. Antes la sesión del pedido quedaba con la
  transacción rota (`PendingRollbackError`) y lo siguiente que la usaba
  fallaba: aunque el caso de uso atrapara el error, guardar la respuesta de
  idempotencia daba 500 con la acción ya hecha. Lo tenían todos los avisos
  que pasan por el adaptador (el de «turno cerca» al publicar atrapa el error
  igual que éste), así que el arreglo vale para todos. El `rollback` no
  deshace nada de quien llama: cada repositorio confirma su propia escritura.
- `backend/app/modules/notification/domain/value_objects.py` y
  `push_policy.py`: los dos tipos nuevos, su destino y su vigencia (12 h,
  urgencia alta, como los demás cambios sobre un turno propio). **Sin
  migración:** `notifications.type` es `String(30)`, no un enum de la base.
- `frontend/lib/cancelar-turno.ts`: el texto de la confirmación y la cuenta
  de cuándo es tardía (espeja `COMMITTED_STATUSES`). El diálogo sigue en
  `frontend/app/shifts/page.tsx`.
- El texto sale del estado de ahora, no del de la lista: al abrir el diálogo
  se relee ese turno (`askCancel`, `GET /shifts/{id}`) y la tarjeta queda al
  día (`withFreshState`). Con la lista vieja, un turno «asignado» que el
  trabajador acababa de confirmar se cancelaba sin el aviso y sumaba la
  tardía, y uno «confirmado» del que el trabajador se había bajado prometía
  una tardía que no existía. Mientras llega la relectura el texto queda en
  espera y el «Sí» apagado. Si el turno ya no se puede cancelar, el diálogo
  se cierra con «Este turno ya no se puede cancelar.».
- `frontend/components/ShiftActions.tsx`: «No cubierto» ya no ofrece
  «Cancelar turno» (al confirmar salía el error crudo del servidor). La lista
  queda igual a los terminales del dominio; lo único que faltaba era ese
  estado.
- `frontend/components/company/LateCancellations.tsx`, en
  `frontend/app/profile/page.tsx`: lee `GET /companies/me/profile`.
- `frontend/lib/types.ts` y `frontend/lib/notification-link.ts`: registro de
  los tipos nuevos en la campanita.
- Tests: `backend/tests/test_cancel_shift_notifications.py` (por estado, sin
  duplicados, 404, la base rechazando el aviso con `Idempotency-Key` y su
  reintento, un aviso que falla sin arrastrar al otro, push caído),
  `frontend/lib/cancelar-turno.test.ts`,
  `frontend/components/ShiftActions.cancelar.test.tsx` y
  `frontend/e2e/cancelar-turno.spec.ts` (lista vieja en los dos sentidos).

**Por qué así:**

- La cancelación tardía sigue la regla escrita (ADR-0007, `REPUTATION.md`):
  cuenta el estado, no un plazo en horas. No se inventó ninguno.
- Los avisos van al final y envueltos: el turno ya está cancelado, y un 500
  ahí dejaba al comercio reintentando sobre un turno que responde 400.
  **Lo que queda garantizado:** si la base rechaza el aviso (fila inválida,
  usuario borrado) o cae el push, la cancelación responde 200 con todo
  guardado, y el reintento con la misma clave devuelve esa respuesta. **Lo
  que no:** con la base caída del todo tampoco se puede guardar la respuesta
  de idempotencia; el comercio ve un error con el turno ya cancelado y el
  reintento responde 400.
- Si la relectura del diálogo falla (sin red, backend dormido, 5 s de
  espera), se muestra el texto del estado que el panel conoce y decide el
  servidor. No se inventó un «puede sumarte una cancelación tardía».
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
- **Entre la relectura y el «Sí»** el trabajador todavía puede confirmar o
  bajarse: la ventana pasó de minutos a segundos, no a cero. Cerrarla del
  todo pide que el servidor rechace una cancelación cuyo estado cambió.
- **Una lectura por postulante** al armar los avisos
  (`_notify_shift_cancelled` usa `get_by_id`): el puerto de perfiles no tiene
  una lectura por lote que devuelva el usuario de cada perfil, y no se agregó
  un método sólo por esto.
- El segundo toque sobre el diálogo que se cierra y el historial de
  cancelaciones y ausencias del trabajador en su perfil van en otros PRs.
