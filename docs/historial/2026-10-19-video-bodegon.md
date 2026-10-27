# Video «Viernes, salón lleno», versión bodegón con la marca nueva

**Pedido:** Julieta vio un reel de Roomix (historia animada en 3D + la app en
motion graphics + logo) y quería una versión gastronómica para Oído, sin
pagar Midjourney ni Seedance, con la estética celeste y blanco y más tipo
bodegón.

**Qué cambió:** video nuevo `marketing/videos/oido-bodegon.mp4` (9:16,
25,5 s, efectos sintetizados, sin voz ni música), para comercios. En siete
escenas: el salón un viernes (pizarra, sifón, mantel a cuadros celeste,
piso damero, ventana con la noche azul) y llega «Perdón, hoy no llego»; el
pase con la riel de comandas que se llena y la campanita; «Pedilo como lo
dirías» en el celular; la comanda impresa con la cinta «¡Oído!»; el mapa
«va en camino»; la riel que se vacía («Y el viernes sale»); y el «oído»
fileteado completo con «Empezá gratis».
Técnico: `marketing/videos/animacion/bodegon.html` y `bodegon.js`, cues en
`sfx.py` (que ahora acepta una duración por video, `DURACION`), y
`render.mjs` inserta las piezas de `docs/design-system/marca/` con
`src="marca/<archivo>.svg"`, así el filete sale del vector oficial.

**Por qué así:** con código sale gratis, con derechos completos y fiel a la
marca (el filete real, la comanda y el mapa de la landing). Sin personajes:
la historia la cuentan los objetos del bodegón, porque los personajes están
descartados en la marca. Un solo ámbar por escena (el botón, la guarda y
las volutas de la cinta). Se descartó la IA de video gratis (marca de agua
o sin uso comercial en los planes gratis) y los modelos abiertos (sin GPU
en la sesión).

**Queda abierto:** música (se suma en Instagram/CapCut), una versión espejo
para trabajadores y, si se quiere, voz en off.
