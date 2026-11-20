# El mapa chico de los turnos, sin MapLibre: Mis turnos pesa la mitad

**Pedido:** en la pasada de rendimiento quedó un solo punto grande: Mis
turnos bajaba MapLibre entero para el mapa chico de cada turno aceptado.
Julieta pidió ver cómo quedaría antes de aceptar, que siguiera la línea de las
pantallas nuevas y que los toques de marca no le quitaran velocidad. Entre una
versión celeste, una con los colores de un mapa de siempre y dos toques (el
nombre del local, una nota a mano), eligió **los colores de un mapa de
siempre con el nombre del local**.

**Qué cambió:** el mapa chico se ve casi igual que antes (calles, avenidas
amarillas, plazas verdes, el barrio y una avenida con su nombre), con el
local como un cuadradito azul hondo con relieve en lugar del punto naranja, y
su nombre en una etiqueta. «Cómo llegar» y el resto de la tarjeta no
cambian; el mapa nunca se pudo tocar. Va en Mis turnos, en el detalle del
turno y en el perfil público del comercio (ahí sin etiqueta).

Lo técnico: `components/MiniMap.tsx` ya no es un `MapView`. Lee los mosaicos
vectoriales de CARTO y dibuja en SVG (`lib/map/mapa-chico.ts`: cuentas,
lectura con `@mapbox/vector-tile` y `pbf`, ahora declaradas en
`package.json`, rótulos y pedidos con reintento si cambia la versión de los
mosaicos). Colores en los tokens `--mapa-*` de `globals.css`.
`ShiftCard` y `ShiftDetail` le pasan `nombre`. Tests: `lib/map/mapa-chico.test.ts`
(arma un mosaico chico a mano); `e2e/map-interactivity.spec.ts` ahora
comprueba que Mis turnos no monta MapLibre y cuida el error de `reuseMaps`
por el mapa de «va en camino» (se verificó que falla sin el arreglo);
`e2e/segundo-toque-trabajador.spec.ts` cuenta los nombres sin la etiqueta.

**Por qué así:** medido, `main` contra la rama: Mis turnos de 634 a 343 KB de
JS y de ~850 a ~330 ms de TBT, el LCP igual; de CARTO baja 192 KB en vez de
326 KB con tres turnos (ver `reference/RENDIMIENTO.md`). Se descartó mostrar
el mapa al tocar (esconde dónde queda) y una imagen de CARTO (los
mosaicos-imagen ahora piden clave). La nota a mano sumaba 52 KB de letra;
la etiqueta, nada. Queda escrito en ADR-0001 (actualización).

**Queda abierto:** si CARTO también pide clave para los mosaicos vectoriales,
se caen el mapa grande y el chico (plan B en ADR-0001). Anotado en
`STATUS.md` #12.
