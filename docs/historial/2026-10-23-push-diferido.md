# El push de un aviso sale después de responder: postularse y el chat ya no esperan al proveedor

**Pedido:** Julieta aprobó lo que quedó abierto en
[`2026-10-23-mail-asignacion-diferido.md`](./2026-10-23-mail-asignacion-diferido.md).
Al crear un aviso para una persona (postularse, asignar, mensaje de chat,
reseña, verificación), `SqlAlchemyNotificationRepository.add` esperaba los
POST de Web Push dentro del request. Si el servicio de push (FCM, Mozilla,
Apple) tardaba, quien tocó el botón esperaba lo mismo, hasta 10 s por envío.

**Qué cambió:** postularse, mandar un mensaje y las demás acciones que
avisan a otro responden enseguida. El aviso dentro de la app y el de
WebSocket llegan igual que antes. La notificación push al teléfono sale unos
milisegundos después de la respuesta.

- `backend/app/modules/notification/infrastructure/repositories.py`: `add`
  y `add_many` siguen guardando el aviso, haciendo commit y mandándolo por
  WebSocket dentro del request. `_schedule_pushes` busca las suscripciones
  push también dentro del request (una consulta, con la sesión del request)
  y le pasa los envíos a una tarea de fondo. `_deliver_pushes` manda en
  paralelo, deja en el log cada envío que falla y purga las suscripciones
  que el proveedor dio de baja (404/410) con **una sesión propia y corta**,
  porque la del request ya se cerró. Esa sesión sale del mismo engine que
  la del request: en producción, el de `AsyncSessionLocal`; en los tests, el
  SQLite del test. Reemplaza a `_send_push_best_effort` y
  `_send_push_many_best_effort`.
- `backend/app/modules/notification/infrastructure/push_tasks.py` (nuevo):
  `spawn_push_task` guarda cada tarea en un `set` del módulo hasta que
  termina, porque `asyncio` sólo guarda una referencia débil y una tarea
  suelta puede recolectarse a mitad de camino. `drain_pending_pushes(timeout)`
  espera las que están en curso. `shutdown_pending_pushes` la llama el
  lifespan de `backend/app/main.py` al apagar: espera hasta 10 s, lo mismo
  que el timeout de un envío, y si queda alguna la cancela y lo deja en el
  log (`Apagado: N envío(s) de push sin terminar…`).
- Tests (`backend/tests/test_push.py`): los que miran qué push salió esperan
  antes con `drain_pending_pushes()`. Hay tres nuevos: `add` vuelve aunque
  el proveedor todavía no contestó; una suscripción dada de baja se purga
  con la sesión del request ya cerrada; y al apagar, un envío trabado se
  cancela y queda en el log. El test de "falla el envío" también comprueba
  el log. `tests/conftest.py` espera los push pendientes antes de cerrar la
  base de cada test.
- `docs/reference/ACCESO_MODERNO.md` describe el hook nuevo.

**Medición (antes → después).** Script `perf/bench_push.py` del scratchpad
de la sesión, contra un uvicorn real en un socket TCP. El comercio tiene un
dispositivo suscripto y el `PushSender` falso tarda 300 ms por envío. Se
miden 5 postulaciones (`POST /applications/shifts/{id}`, que avisan al
comercio) y 5 mensajes de chat del trabajador (`POST /chats/{id}/messages`).
3 corridas de cada lado:

| | Antes (main) | Después |
|---|---|---|
| Postularse, mediana | 339 – 371 ms | 32 – 40 ms |
| Postularse, peor | 381 – 418 ms | 66 – 95 ms |
| Mensaje de chat, mediana | 331 – 350 ms | 23 – 28 ms |
| Mensaje de chat, peor | 340 – 382 ms | 30 – 35 ms |
| Push enviados | 10 de 10 | 10 de 10 |

Con un proveedor de push lento o caído, lo que se ahorra llega hasta el
timeout de 10 s por envío. Las consultas SQL por request no cambian: la
búsqueda de suscripciones sigue en el request, y la purga de las dadas de
baja, que es rara, sale del request.

**Por qué así:** una tarea de `asyncio` y no `BackgroundTasks` de FastAPI
como en el email de asignación. El hook está en el repositorio, que también
usan el scheduler y rutas que no reciben `BackgroundTasks`. Pasárselo por
todos los módulos que avisan (shift, chat, application, review,
verification) iba en contra de tener el push en un solo lugar
(`ACCESO_MODERNO.md`). Lo que se pierde es que, con ASGITransport, los tests
ya no ven el envío terminado al volver la respuesta: por eso existe
`drain_pending_pushes`. Las suscripciones se buscan dentro del request porque
usan su sesión, y la consulta es barata.

**Queda abierto:** si el proceso muere de golpe (sin pasar por el lifespan),
un push en vuelo se pierde. El aviso dentro de la app ya está guardado y es
lo que manda. No hay reintentos: igual que antes, un envío que falla queda
en el log.
