# El mapa de «va en camino» del comercio encuadra siempre al local y al trabajador (G22, U071)

**Pedido:** hallazgo U071: el mapa de «va en camino» del comercio no seguía al
trabajador, el punto quedaba cortado y a más de ~3 km no se veía nada.

**Qué cambió:** el recuadro de `EnRouteMap` vuelve a encuadrar el local y al
trabajador en cada posición nueva, con margen para que ningún marcador ni su
halo queden contra el borde, y con zoom máximo 16 para que no se acerque de más
cuando están juntos. No cambia qué datos se piden ni se muestran (modelo de
privacidad de «Va en camino» intacto), solo el encuadre.
- `frontend/lib/map/geo.ts`: `boundsOf(puntos)` (caja `[[oeste, sur], [este, norte]]`, con test en `geo.test.ts`).
- `frontend/lib/map/camera.ts`: `fitPoints(map, puntos, { padding, maxZoom, duration })`, sobre `fitBounds`; respeta `prefers-reduced-motion`.
- `frontend/components/employer/EnRouteMap.tsx`: guarda el `MapRef` del `onLoad` y llama a `fitPoints` en un efecto que depende de las dos coordenadas. Se sacó la tabla de zoom por distancia, que sólo servía de arranque y era la causa de que a ~3 km o más el punto quedara fuera.
- `frontend/e2e/en-camino-encuadre.spec.ts`: a 6 km y luego a 12 km (cambio de posición en el refresco del panel) los dos marcadores quedan enteros dentro del recuadro. Falla sin el arreglo.
- `MapView.tsx` no se tocó: el `center`/`zoom` que ya recibe sirven de arranque hasta el `load`.

**Por qué así:** el mapa es de 144 px y no interactivo (`interactive={false}`),
así que nadie lo mueve a mano y «seguir siempre» no le pelea a nadie; un botón
«Centrar» no aplica. Antes `center`/`zoom` sólo se aplicaban en el `load`, por
lo que las posiciones siguientes del trabajador no movían la cámara.

**Queda abierto:** nada de este hallazgo. Si el mapa del comercio pasa a ser
interactivo, habrá que dejar de seguir tras un gesto manual y ofrecer «Centrar».
