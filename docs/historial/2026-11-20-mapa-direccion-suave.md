# El Mapa de quien trabaja con la dirección suave (#PR)

**Pedido:** Julieta, 2026-11-20, segunda tanda de tres pantallas en paralelo
(Panel del comercio, Perfil de quien trabaja y Mapa) para seguir la migración
a la dirección suave (ADR-0028). Maqueta: `T-Mapa` del lienzo «Oído ·
identidad por pantalla». Sólo la piel.

**Qué cambió:** `/map`, que es una sola pantalla (la de quien trabaja; el
comercio no la tiene: su mapa es el de `/search`, que no se tocó). Qué turnos
se piden, cuáles se muestran, desde dónde se mide y qué hace cada toque quedó
igual.

- **El mapa es el cielo.** Arriba se funde con el cielo de la app (de noche,
  azul noche) y el título va encima, grande y en letra normal: «5 turnos cerca
  tuyo» (o «cerca de tu zona», o «Turnos en el centro de Buenos Aires»). Antes
  era una pastilla blanca. El cielo no recibe toques: el mapa se mueve también
  por debajo del título. En la compu el título está en el panel y sobre el
  mapa sólo asoma el cielo.
- **El pin es una tecla blanca con el pago y su pico; el elegido va en azul
  hondo**, más grande y con letra blanca. Antes los pines eran negros y el
  elegido, ámbar. Se fue el punto de color por rubro. El punto rojo de
  «urgente» sigue. «Paga por encima de lo habitual» ahora es una flechita
  verde antes del monto (era el monto en color manteca).
- **Sin ámbar en el mapa:** la onda al elegir un pin, el aro de los turnos
  agrupados, el anillo de los 2 km y el punto de «estás acá» van en el azul
  de la marca.
- **De noche el mapa base se apaga** (el de día, invertido y bajado de tono),
  como en la maqueta, para que el cielo de noche no se funda con un mapa
  claro. Los pines no se invierten.
- **Los turnos son filas suaves**, en la hoja que se arrastra (celular) y en
  el panel de la izquierda (compu): la foto del local, el puesto, **el pago en
  grande a la derecha**, el local con la distancia y cuándo es, con «Urgente»
  al final del renglón. Antes eran tarjetas con un riel y un cuadradito de
  color por rubro.
- **Sin foto va el cielo** (`PortadaCielo` en su versión `mini`) con el ícono
  del rubro.
- **Un solo ámbar:** «Postularme» va en ámbar en el turno elegido (el del pin
  en azul hondo) y quieto en los demás. En la compu, la fila elegida lleva
  además un aro azul (antes, borde y fondo ámbar).
- **El detalle que se abre al tocar una tarjeta** (celular): el pago es el
  número más grande, en tinta sobre la hoja. Se fue el módulo negro con el
  ícono ámbar.

Técnico: `frontend/app/map/page.tsx`; `frontend/components/worker/TurnoMapa.tsx`
(nueva: lo que dice un turno en la hoja y en el panel, y `MiniaturaTurno`);
`frontend/components/map/ShiftMarker.tsx` y `RadiusRing.tsx` (sólo los usa
`/map`); `frontend/components/worker/MapSheet.tsx` (el borde y la sombra de la
hoja); un bloque nuevo al final de `frontend/app/globals.css` (`.mapa-*`,
`.pin-*`, `.puck-*`), sin tocar las reglas que ya estaban;
`frontend/e2e/mapa-suave.spec.ts`.

**Pieza compartida con el mapa de Buscar del comercio (`/search`):**
`map/UserPuck.tsx` recibió sólo dos nombres de clase (`puck-halo`,
`puck-punto`); lo suave está dentro de `.estilo-suave`, que `/search` no
lleva, así que ahí se ve igual que antes (verificado renderizado).
`map/ClusterMarker.tsx` (que hoy sólo usa `/map`) se trató igual, con
`pin-grupo`. `map/MapView.tsx` no se tocó: el cielo y el filtro de noche se
aplican por CSS a su lienzo, sólo dentro de `.estilo-suave`.

**Por qué así:**

- **Lo que en la maqueta es una función nueva no se agregó:** el conmutador
  Lista / Mapa (hoy son dos pestañas de la barra), los chips «Hoy», «Mañana»
  y «Fin de semana» (hoy no se filtra por día) y la tarjeta única con «Ver el
  turno» (la maqueta muestra sólo el turno elegido; hoy hay un carrusel con
  todos y «Postularme» en cada uno, y sacarlo cambia lo que se puede hacer
  desde acá).
- **El título sigue diciendo cuántos turnos hay y desde dónde se mide** y no
  «Turnos cerca», como en la maqueta: ese dato ya estaba y avisa cuando no se
  pudo ubicar a la persona.
- **El ámbar en el elegido** y no en todos (serían tantos ámbares como
  turnos): es el mismo turno que el mapa marca en azul hondo. En la compu el
  elegido cambia al pasar el mouse por otra fila, como antes.
- **Se suma «cuándo es» a la fila** (la maqueta lo muestra). El dato ya
  estaba en el detalle; no es información nueva para quien mira.
- **La flechita verde** para «paga por encima de lo habitual»: el color
  manteca no se lee sobre la tecla blanca. La regla es la de siempre
  (`pay_band`, ADR-0012).
- **Los pines miden 36 px de alto** (42 el elegido), como en la maqueta; antes
  medían unos 30.
- **Las alturas de la hoja no se tocaron** (`MapSheet`): con la tarjeta más
  baja queda algo de aire debajo en pantallas altas.

**Revisión independiente** (otro agente, intentando romperlo: de 320 a
1280 px, en claro y oscuro, datos difíciles, 0, 1 y 30 turnos, estados vacío y
error, contraste medido, teclado, letra al 200 %, «reducir movimiento»,
gestos, `/search` renderizado y la lógica comparada con la de `main`). Aprobó
con detalles y se arreglaron: el cielo era un degradé ENCIMA del mapa y lavaba
los pines que quedaban arriba (el elegido bajaba a 2,1:1): ahora el cielo va
detrás y lo que se esfuma es el lienzo, con una máscara; el pin blanco casi no
se despegaba del mapa (lleva un aro fino); y a 320 px un puesto largo junto a
un pago de siete cifras se partía mal (corta con guion). Quedó sin tocar, por
menor: con la letra al 200 % el título y el pago no crecen más que el ancho
(el mismo tope que en Buscar), y el botón quieto no tiene contorno (como
«Elegir» en Candidatos).

**Prueba en la app** (`tools/e2e-local`, backend real y datos sembrados):
cuatro cuentas nuevas de quien trabaja, en celular y compu, en claro y oscuro.
Con 6 turnos reales: arrastró el mapa empezando sobre el título (se movió),
tocó un pin (pasó a azul hondo y su fila se quedó con el ámbar), abrió el
detalle tocando la tarjeta, se postuló desde el detalle y desde una fila (201,
la fila sale; la postulación quedó `pendiente` en la base), cambió el alto de
la hoja con la manija y, en la compu, la fila llevó a `/turno/[id]`. Sin
errores de consola ni de red.

**Queda abierto:**

- Decidir con Julieta lo que quedó afuera (Lista / Mapa, filtro por día, la
  tarjeta única con «Ver el turno») y si el ámbar va en el elegido.
- **Mirar el mapa de noche con el mapa real**: en la sesión no hay salida a
  los mosaicos de CARTO, así que el filtro de noche se vio sólo sobre un fondo
  liso. Si las calles no se leen, se ajusta o se saca una regla de
  `globals.css` (`.estilo-suave .maplibregl-canvas`).
- A 320 × 568 px «Postularme» de la tarjeta queda al ras del borde de la hoja
  (las alturas de la hoja son una fracción de la pantalla y no se tocaron).
- El cartel «No pudimos cargar el mapa» (`MapView`, compartido con `/search`)
  sigue con el aspecto de antes.
- La hoja genérica del detalle (`ui/Sheet`: la manija, el título y la cruz)
  es compartida y no se tocó.
