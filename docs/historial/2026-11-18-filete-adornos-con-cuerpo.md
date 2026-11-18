# Marca · Los adornos del «oído» fileteado, con cuerpo

**Pedido:** Julieta, beta etapa 4 (marca): los adornos del «oído» fileteado
«quedaron demasiado finos». Mandó tres referencias de un fileteador (un marco
de filete porteño alrededor de «oído» y dos ejemplos suyos) y pidió un punto
medio: ni tan cargado como la referencia ni tan finito como lo que había.
Dibujo propio, no un calco; las referencias no van al repo, que es público.

**Qué cambió:** el final de la landing y la bienvenida muestran el «oído»
entre cuatro volutas celestes con volumen, alas de hojas en las esquinas,
filete dorado por dentro, una flor roja arriba y una rosa abajo. La miniatura
al compartir va un nivel más cargada: suma un ramo de tres flores, una flor a
cada costado, la cinta celeste y blanca y rulos dorados. Antes eran un arco,
dos eses y rulos en línea dorada de 1 a 2 px, que en el celular casi no se
veían.

- `frontend/scripts/build-filete.mjs` (nuevo): el dibujo. Todo son
  pinceladas (una línea central y un ancho que cambia a lo largo); cada una
  lleva cuerpo, franja de sombra, media luz y brillo, con la luz de arriba a
  la izquierda como el relieve de la letra. El relieve duro azul hondo es la
  silueta del dibujo repetida en diagonal, y la sombra proyectada la misma
  silueta desenfocada (el único filtro: Safari dibuja en baja resolución lo
  que pasa por un filtro, así que el dibujo en sí no pasa por ninguno). Escribe
  `components/landing/filete-adornos.ts` (nivel medio), los vectores
  `docs/design-system/marca/oido-filete.svg` y `oido-filete-cargado.svg`, y
  `assets/og/filete-oido.png` (con `sharp`, sin navegador).
- `frontend/components/landing/Filete.tsx`: la `firma` inserta ese dibujo y
  le pone la letra encima; se fueron `Adornos`, `Hoja` y `Rulo`. El viewBox
  pasó de 680 × 345 a 696 × 362.
- `frontend/lib/og-brand.tsx`, `lib/og.ts` (`OG_FILETE`),
  `assets/og/README.md`: la miniatura usa el nivel cargado.
- `frontend/scripts/build-filete.test.ts`: lo commiteado es lo que escribe el
  script, el dibujo insertado sólo trae formas y pintura, y el PNG mide lo
  que dice `lib/og.ts`.

**Por qué así:**

- **Tres cargas en una prueba antes de tocar código**
  (https://claude.ai/artifact/TYzBvehuyCPXNM7pNhrh6R): liviano, medio y
  cargado, cada uno en sus tres usos. Julieta eligió medio para la landing y
  la bienvenida y cargado para la miniatura, y después pidió más profundidad
  («como en la foto del fileteador, se ve más profesional»): de ahí el
  volumen por pincelada y la sombra proyectada.
- **Entran el rojo y el rosa, sólo adentro del filete.** Son las flores, no
  un color de la interfaz: el ámbar sigue siendo el único acento de las
  pantallas. Es la misma regla que ya tenía el crema, que vive sólo adentro
  de la letra.
- **La letra no cambió** (crema con relieve azul hondo). El relieve rojo de la
  referencia se probó: compite con las flores y obliga a rehacer el ícono del
  pinche, la cinta «¡Oído!» y el relieve de la app, que salen del mismo azul.
- **Generado, no dibujado a mano en el componente.** Son unas 120 formas; un
  script las escribe en los cuatro lugares donde hacen falta y un test avisa
  si alguno queda viejo. El nivel medio pesa 55 KB sin comprimir (12 KB con
  gzip) y va en línea para que la bienvenida no espere una imagen.
- **De las referencias se tomó el oficio, no la composición:** lóbulos gordos
  de punta redonda, bolita al final de la espiral, botón azul en las flores.
  El marco doble, el trío de flores y los moños de las referencias no están.

**Queda abierto:** Julieta dijo que «quizás» el filete puede ir también en el
ícono del pinche. No se tocó el ícono en este PR; si lo aprueba, va en uno
aparte (`frontend/scripts/build-isotipo-pinche.py`). El manual en PDF de
`design-system/marca/` sigue con los adornos viejos y con el «oí».
