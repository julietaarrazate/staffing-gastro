# Neon puede dormirse con Render siempre prendido

**Pedido:** Julieta, 2026-10-13. Dejar listo el backend para pasar Render al
plan pago (siempre prendido) sin que Neon salga del plan free.

**Qué cambió:** nada visible para el usuario. El servidor cierra la conexión
que deja abierta en el pool cuando la app lleva 2 minutos sin uso.

- `backend/app/core/database.py`: `track_pool_use` anota la hora de cada
  préstamo y devolución de una conexión (eventos `checkout`/`checkin` del
  pool). `close_idle_connections` descarta el pool (`engine.dispose()`) si
  pasaron `IDLE_CLOSE_AFTER` (120 s) sin uso y no hay ninguna conexión
  prestada. `start_idle_connection_closer` corre ese chequeo cada 30 s, sólo
  en producción. La tarea no consulta la base: mira el reloj y el pool en
  memoria.
- `backend/app/main.py`: arranca y cancela la tarea en el `lifespan`, junto
  al scheduler.
- `backend/tests/test_database_idle.py`: cierra tras el hueco; no cierra si
  se usó hace poco ni si hay una conexión prestada; después de cerrar sigue
  funcionando y anotando el uso; fuera de producción no arranca.

**Por qué así:**

- La cuenta: hoy Oído gasta ~3 CU-h por mes en Neon porque Render free se
  duerme a los 15 minutos sin tráfico y la conexión se corta con él. Con
  Render pago el servidor no se duerme y `pool_size=1` dejaría una conexión
  abierta las 24 horas. Si Neon cuenta esa conexión como actividad, el
  cómputo no suspende nunca: 0,25 CU × 24 h × 30 días ≈ 180 CU-h, contra las
  100 del plan free (es lo que pasó el 2026-08-26 con 5 conexiones y el
  scheduler cada 5 minutos, ver `core/database.py`).
- Neon documenta que suspende tras 5 minutos "de inactividad", sin aclarar si
  una conexión ociosa cuenta. Cerrarla es un seguro barato: si no cuenta, no
  cuesta nada; si cuenta, es lo que deja dormir a la base. 2 minutos queda
  bien por debajo de los 5 de Neon.
- Se descartó `NullPool` (abrir y cerrar una conexión por request): con
  tráfico, cada request pagaría el TLS contra Neon. Con el cierre por
  inactividad, mientras alguien usa la app se reusa la conexión viva, y sólo
  la primera consulta después de un hueco abre una nueva (lo que
  `pool_pre_ping` ya hacía).
- El resto ya estaba resuelto: el scheduler duerme hasta la próxima deadline
  (techo 6 h), `/health` (el healthcheck de Render) no toca la base, y el
  WebSocket de notificaciones devuelve su conexión apenas autentica.

**Queda abierto:** pasar Render a Starter es decisión de Julieta. Después de
hacerlo, mirar el consumo de Neon (CU-h) la primera semana para confirmar que
la base se duerme de noche.
