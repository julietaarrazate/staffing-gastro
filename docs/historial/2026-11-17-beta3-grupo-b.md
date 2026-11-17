# Beta etapa 3 · Grupo B: dirección, zona y mapa

**Pedido:** hallazgos U037, U040, U048, U049 y U107 del triaje de la etapa 3.

**Qué cambió:**
- U037: `shortAddress` arma «Calle 1234, Barrio» con `address.road`/`house_number`/`suburb`/ciudad; sin calle estructurada cae a los primeros segmentos de `display_name`.
- U040: `MapView` pasa a MapLibre los carteles de `cooperativeGestures` en español (`MAP_LOCALE_ES`).
- U048: el buscador de dirección tenía dos anillos (el del contenedor y el `outline` global, que gana a `outline-none` por estar fuera de layer). Queda uno solo, el del contenedor, en `primary` pleno; `input[data-foco-contenedor]` en `globals.css` apaga el segundo.
- U049: `LocationPicker` recibe `initialCity` y los selectores muestran la zona guardada. «Mi ubicación actual» ya no se guarda como zona: se usa el barrio elegido o el más cercano al GPS (hasta 50 km); si no hay, pide elegir.
- U107: el Mapa sin GPS mide desde `originFor(ubicación guardada, perfil)`, igual que Inicio y Buscar. El Obelisco queda sólo sin ninguna de las dos.

**Por qué así:** reutilizar `originFor` evita una tercera regla de «desde dónde se mide». Nombrar la zona por cercanía evita cambiar el esquema (la zona sigue siendo texto «Localidad, Provincia»).

**Queda abierto:** zonas guardadas antes con «Mi ubicación actual» siguen sin selector precargado hasta que la persona elige una. El copy «cerca de tu zona» del Mapa es nuevo.
