# El token del WebSocket ya no queda en los logs

**Pedido:** Julieta, 2026-10-20, como parte de la revisión de seguridad
(ítem «Revisión de seguridad del 2026-10-20» de `../STATUS.md`, prioridad media).

**Qué cambió:** el navegador no puede mandar headers en un WebSocket, así que
el access token viaja en `?token=` (`identity/api/dependencies.py`,
`frontend/lib/useWebSocket.ts`). Uvicorn loguea el path completo del
handshake, y esos logs quedan en Render: quien los leyera obtenía sesiones
válidas por 15 minutos.

- `backend/app/core/observability.py`: `_RedactTokenFilter` en los loggers
  `uvicorn.error` (handshake del WebSocket) y `uvicorn.access` reemplaza el
  valor de `token=`/`access_token=` por `[Filtered]`.
- `backend/tests/test_observability.py`:
  `test_uvicorn_logs_hide_the_websocket_token`.

**Por qué así:** es el arreglo más chico que cierra la fuga a los logs sin
tocar el protocolo del WebSocket ni el frontend. Se descartó por ahora
mandar el token en el primer mensaje o con un ticket de un solo uso: cambia
el backend y el frontend a la vez, y el riesgo que queda (el token pasa por
la URL hacia Cloudflare, que no guarda query strings en este plan) es bajo.

**Queda abierto:** si algún día se quiere sacar el token de la URL del
todo, el camino es un ticket corto de un solo uso (`POST /ws-ticket`).
