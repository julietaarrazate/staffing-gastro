# Comercios a captar: los servidores de Overpass se consultan en paralelo

**Pedido:** en producción "Traer comercios del barrio" nunca terminaba y la
base tenía 0 comercios. Los logs de Render mostraban que se probaban los 4
servidores de Overpass de a uno, con 90 s de lectura cada uno: uno rechaza la
conexión, dos se cuelgan hasta el timeout y `maps.mail.ru` responde 200 en
~55 s o 504. El pedido podía tardar 6 minutos, el frontend corta a los 100 s
y Cloudflare también: no se guardaba nada, y los reintentos de la admin
sumaban pedidos simultáneos contra mail.ru.

**Qué cambió:**
- `OverpassPlaceSource.find_gastronomy`
  (`backend/app/modules/lead/infrastructure/overpass_place_source.py`) manda
  la consulta a todos los servidores a la vez, se queda con la primera
  respuesta válida (2xx con JSON) y cancela el resto. Un servidor que falla
  (no conecta, timeout, 429, 4xx, 5xx, JSON inválido) queda descartado; si
  fallan todos, `PlaceSourceUnavailableError` como antes.
- Plazo total de 80 s (`_TOTAL_TIMEOUT_S`, inyectable por constructor),
  por debajo de los 100 s del frontend y de Cloudflare. La consulta pide
  `[timeout:70]`. Conectar sigue con 10 s.
- Cada falla se loguea con el servidor y el tipo de error dentro del mensaje
  (`lead.overpass_failed servidor=... error=...`), sin datos personales.
- Frontend (`frontend/app/admin/leads/page.tsx`): mientras importa aparece
  "Buscando… puede tardar hasta un minuto y medio. No cierres esta pantalla."
- Tests en `backend/tests/test_lead.py`: adaptados a la semántica paralela y
  nuevos para servidor lento vs. rápido, plazo total agotado y primera
  respuesta válida gana aunque otro dé error.

**Por qué así:** probar en serie sumaba los tiempos muertos; en paralelo el
tiempo es el del servidor más rápido que responde. Esto reemplaza el
respaldo en serie de `2026-10-20-overpass-respaldo.md` (la lista de
servidores es la misma). Desde la sesión en la nube no hay salida a Overpass,
así que los tests simulan los servidores con `httpx.MockTransport`.

**Queda abierto:** confirmar en producción que alguna importación termina en
menos de 80 s. Cada importación pega a los 4 servidores públicos a la vez:
es una carga mayor sobre un servicio comunitario (sigue siendo una consulta
por importación). Si ninguno responde a tiempo, la alternativa es mover la
importación a una tarea en segundo plano con estado consultable, o Google
Places detrás del mismo puerto `PlaceSource`.
