# Los avisos al celular salen con margen de espera (vigencia y urgencia por tipo)

**Pedido:** salida a beta, etapa 2 (arreglar lo que encontró la prueba de
punta a punta). Hallazgo grave: los avisos push salían con vigencia 0 y sin
urgencia.

**Qué cambió:** lo que ve la persona: si el celular no tiene señal justo
cuando sale el aviso (subte, ahorro de batería, sin datos), ahora el aviso
espera en el servicio push y llega cuando el celular se reconecta. Antes se
descartaba y la persona se enteraba recién al abrir la app. Los avisos y sus
textos no cambian; solo cuánto tiempo se guardan:

- Turno nuevo cerca y turno urgente cerca: 30 minutos, urgencia alta. Pasado
  ese tiempo lo más probable es que el turno ya esté cubierto: no llega un
  aviso viejo.
- Lo que pide actuar sobre un turno o avisa un cambio en un turno propio
  (postulación nueva, asignación, confirmación, rechazo, cancelación tardía,
  no presentado, salida, turno reabierto, turno sin cubrir, chat): 12 horas,
  urgencia alta.
- Lo que solo vale en el momento (recordatorios de llegada y de salida, «va
  en camino»): 30 minutos, urgencia alta. Dicen una hora sin fecha o una
  distancia al salir; llegar horas tarde afirmaría algo que ya no es cierto.
- Pagos, reseñas, verificación, soporte y plan (y cualquier tipo sin regla):
  24 horas, urgencia normal.

Lo técnico:

- `backend/app/modules/notification/domain/push_policy.py` (nuevo):
  `PushPolicy(ttl_seconds, urgency)`, `PushUrgency` (valores de la cabecera
  `Urgency`, RFC 8030) y `push_policy_for(tipo)`. Es la única tabla tipo ->
  política; dominio puro, no conoce la librería.
  `DEFAULT_POLICY_TYPES` lista a propósito los tipos que usan el default.
- `domain/push_sender.py`: `send(..., policy=DEFAULT_PUSH_POLICY)`.
- `infrastructure/webpush_sender.py`: `webpush(..., ttl=policy.ttl_seconds,
  headers={"Urgency": ...})`. `pywebpush` 2.5.0 usa `ttl=0` si no se le pasa.
- `infrastructure/repositories.py::_deliver_pushes`: pasa
  `push_policy_for(notification.type)`.
- `infrastructure/fake_push_sender.py`: registra la política recibida.
- `infrastructure/null_push_sender.py`: acepta `policy` (la ignora) para
  cumplir el puerto.
- Tests: `backend/tests/test_push_policy.py` (la política por tipo; el test
  recorre `NotificationType`, así un tipo nuevo obliga a decidir; el sender
  real llama a `pywebpush.webpush` con el TTL y la cabecera que tocan) y un
  caso en `backend/tests/test_push.py` (el envío de fondo manda la política
  del tipo).
- Docs: `docs/reference/ACCESO_MODERNO.md` (sección de Web Push).

**Por qué así:** una sola tabla en el dominio y no valores sueltos en el
adaptador, para que decidir cuánto vale un aviso se haga en un lugar y se
pueda revisar entero. El default es 24 h normal y no 0: un tipo olvidado no
vuelve a perder avisos.

**Queda abierto:**

- El efecto en un celular real **lo tiene que probar una persona**: poner el
  celular en modo avión un minuto, asignarle un turno y ver que el aviso
  llega al volver la señal. Acá solo se verificó, con la librería simulada,
  que se manda el TTL y la cabecera que corresponden.
- Los 30 minutos del grupo «solo vale en el momento» y los 12 h del grupo de
  acción son un criterio de esta entrega: producto puede ajustarlos.
- `SHIFT_NOT_COVERED` (12 h) y `SHIFT_PAID` (24 h, normal) se repartieron por
  criterio propio; confirmar con producto.
- No existe aviso de llegada: marcar la llegada no le avisa a nadie (solo hay
  recordatorio de llegada y «va en camino»). Si se quiere, es otro cambio.
- Los servicios push pueden acotar el TTL por su cuenta (p. ej. el tope de
  FCM es de 4 semanas; no afecta a estos valores).
