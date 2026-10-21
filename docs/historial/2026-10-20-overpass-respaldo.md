# Comercios a captar: servidores de respaldo de OpenStreetMap

**Pedido:** Julieta probó "Traer comercios del barrio" en producción y no
funcionó. Sentry mostró `ConnectError: All connection attempts failed` en
`OverpassPlaceSource` (commit del #461).

**Qué cambió:** si el servidor público principal de Overpass
(`overpass-api.de`) no acepta la conexión, tarda en conectar, responde 429
(limitado) o falla con 5xx, ahora se prueban otros servidores públicos de
Overpass en orden, con la misma consulta
(`backend/app/modules/lead/infrastructure/overpass_place_source.py`,
`OVERPASS_URLS`). Conectar tiene un límite de 10 s para pasar rápido al
siguiente. Un error 4xx (consulta mal armada) no se reintenta.

**Por qué así:** algunos servidores públicos de Overpass cortan rangos de
IP de nubes como la de Render. Probar varios es gratis y no cambia nada más.
Desde la sesión en la nube no hay salida a ningún servidor de Overpass, así
que los tests simulan los servidores con `httpx.MockTransport`.

**Queda abierto:** confirmar en producción que alguno de los servidores
responde desde Render. Si todos fallan, la alternativa es la API oficial de
Google Places (con cupo gratis) detrás del mismo puerto `PlaceSource`.
