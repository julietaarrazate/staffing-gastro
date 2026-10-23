# El email "Te aceptaron" sale después de responder: asignar ya no espera al proveedor (#PR)

**Pedido:** Julieta aprobó el plan de rendimiento del backend (medición del
2026-10-22). `POST /shifts/{id}/assign` esperaba el envío del email de
aceptación (Resend, timeout de 10 s) antes de contestarle al comercio. Si el
proveedor tardaba, el comercio veía el spinner de "Asignar" todo ese tiempo.

**Qué cambió:** para el comercio, asignar responde enseguida. El trabajador
recibe el mismo email; solo sale unos milisegundos después de la respuesta.

- `backend/app/modules/shift/application/services.py`: `ShiftService` recibe
  `run_after_response` (opcional). `_send_acceptance_email` sigue leyendo
  perfil, usuario y comercio dentro del request, porque usa la sesión de la
  base, y le pasa el envío (`_deliver_acceptance_email`, que atrapa y loguea
  cualquier error) a `run_after_response`. Sin él (scheduler, tests de
  servicio) envía en el momento, como antes.
- `backend/app/modules/shift/api/dependencies.py`: `get_shift_service` cablea
  `run_after_response=background_tasks.add_task` (FastAPI `BackgroundTasks`).
- Tests: `backend/tests/test_email_aceptacion_diferido.py`. Comprueba que con
  `run_after_response` el envío queda para después, que sin él sale en el
  momento y que un fallo en el envío diferido no explota. Los tests de ruta
  existentes (`test_shift.py`, que miran `FakeEmailSender.sent` después del
  request) no cambian: con httpx + ASGITransport las background tasks
  terminan antes de que vuelva la respuesta.

**Medición (antes → después).** Script `perf/bench_assign.py` del scratchpad
de la sesión. Hace 5 asignaciones contra un uvicorn real en un socket TCP,
porque con ASGITransport no se ve la diferencia, con un `EmailSender` falso
que tarda 300 ms. 3 corridas de cada lado:

| | Antes (main) | Después |
|---|---|---|
| `POST /assign`, mediana | 338 – 351 ms | 26 – 55 ms |
| `POST /assign`, peor | 352 – 356 ms | 42 – 89 ms |
| Emails de aceptación enviados | 5 de 5 | 5 de 5 |

Con Resend lento o caído, lo que se ahorra llega hasta los 10 s del timeout.
Las sentencias SQL por request no cambian: 19 en el bench de consultas, porque
las lecturas para armar el email siguen en el request.

**Por qué así:** `BackgroundTasks` de FastAPI y no un `asyncio.create_task`
suelto. El trabajo queda atado al request, corre después de enviar la
respuesta y los tests con ASGITransport lo ven terminado, así que no se
vuelven intermitentes. La capa de aplicación no importa FastAPI: recibe un
callable. Las lecturas de base quedan en el request porque la sesión se cierra
con él.

**Queda abierto:** el push de las notificaciones de un solo destinatario
(postularse, asignar, chat) todavía se espera dentro del request
(`SqlAlchemyNotificationRepository.add`). Es el mismo patrón y queda para otro
PR.
