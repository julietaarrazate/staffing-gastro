# Buscar del comercio con la dirección suave (#PR)

**Pedido:** Julieta, 2026-11-21, tanda de pantallas en paralelo para seguir la
migración a la dirección suave (ADR-0028). Sin maqueta: `/search` es la gemela
de `/map` (migrado el 2026-11-20, ver
[`2026-11-20-mapa-direccion-suave.md`](./2026-11-20-mapa-direccion-suave.md)) y
responde «¿quién está cerca de mi local?». Sólo la piel.

**Qué cambió:** `/search`. Qué se pide, desde dónde se mide (el local; el admin,
donde está), los filtros, la guarda de rol y qué hace cada toque quedó igual.

- **El mapa es el cielo**, como en `/map`: arriba se funde con el cielo de la
  app y encima va el título en letra normal: «7 personas cerca de tu local»
  (admin: «cerca tuyo»; «1 persona…»). Debajo, «Desde tu local · <dirección>».
  Cargando, sin local y error conservan lo que decían, hechos título. Antes
  era una línea chica («7 trabajadores disponibles en el radio seleccionado»)
  en la hoja. En la compu el título va en el panel.
- **Filtros de vidrio** sobre el cielo: el rubro, el radio en km y la lupa
  (`campo-vidrio`, `boton-vidrio`). Misma función y mismos nombres accesibles;
  a 320 px el rubro se achica y la lupa queda a la vista. Se fue el
  `boton-relieve` ámbar de la lupa. En el panel de la compu (fondo de hoja, no
  cielo) los campos llevan el relleno del campo suave: el vidrio blanco no se
  ve sobre blanco.
- **Pines de personas:** una tecla blanca redonda con aro fino y su pico, con
  la foto o, sin foto, la inicial sobre el celeste; la nota en una pastilla
  blanca; «Disponible ahora» es el punto verde. Antes eran círculos azul hondo
  con borde blanco y la nota en un módulo noche. El origen («estás acá») ya iba
  en el azul de la marca por `.puck-*`.
- **La lista son filas suaves** (`PersonaCerca`), en la hoja (celular) y en el
  panel (compu), como los turnos de `/map`: foto redonda (sin foto, la inicial
  sobre el cielo de `.portada-cielo`), nombre en negrita, nota y distancia,
  «Disponible ahora · hace N» en verde y los rubros como `chip-suave`. Se
  fueron la ficha con filete y relieve para quien está disponible, la
  banda/`heroTile` de color por rubro y el cuadradito.
- **La hoja** (`BottomSheet`) toma el borde y la sombra de `MapSheet`
  (`.mapa-hoja`); alturas y arrastre, los de antes. Ya no lleva encabezado con
  el conteo: el conteo es el título.
- **Sin ámbar:** la pantalla no tiene acción principal (cada fila lleva a la
  ficha). El estado «Tu local no tiene ubicación» lleva «Completar ubicación»
  en azul hondo (antes, ámbar). Los demás estados, con los mismos textos.

Técnico: `frontend/app/search/page.tsx`;
`frontend/components/employer/PersonaCerca.tsx` (nueva: la fila y
`FotoPersona`); `frontend/components/map/WorkerMarker.tsx` (quitó su único
`text-[9px]`: se sacó su excepción de `lib/type-scale.test.ts`);
`frontend/components/BottomSheet.tsx`; un bloque al final de `globals.css`
(`.buscar-*`, `.pin-trabajador`, `.pin-nota`, `.persona-*`), sin tocar reglas
existentes y reusando `.mapa-cielo`, `.mapa-hoja`, `.mapa-panel` y
`.mapa-turno`. `frontend/e2e/buscar-comercio-suave.spec.ts` reemplaza a
`buscar-comercio-relieve.spec.ts`. `landing/story/replicas.tsx` no importa
ninguna de estas piezas (replica el pin por su cuenta): no se tocó.

**Por qué así:**

- **El select de rubro ahora tiene `aria-label="Rubro"`:** no tenía nombre
  accesible. Es lo único que se agregó fuera de la piel.
- **La inicial sobre cielo y no el ícono del rubro** para quien no tiene foto:
  es una persona, no un puesto; el rubro ya está en los chips.
- **0 resultados dice «0 personas cerca de tu local»** (como `/map` con 0
  turnos); el estado vacío de abajo explica qué hacer.
- **Sin encabezado en la hoja:** el conteo estaba duplicado entre la hoja y
  el título.

**Queda abierto:**

- **Con la hoja arrastrada al máximo (78 % del alto) tapa los filtros** en el
  celular: el título y desde dónde se mide quedan a la vista, los filtros no
  (antes eran más bajos y se veían). Para verlos se baja la hoja. Arreglarlo es
  tocar las alturas de `BottomSheet` (el brief las dejó como estaban).
- Con muchas personas los pines que quedan bajo el cielo se ven a través del
  vidrio de los filtros (los pines no se esfuman, sólo el lienzo; igual que en
  `/map`).
- **El mapa real no se vio** (en la sesión no hay salida a los mosaicos): el
  fondo es liso y el filtro de noche no se probó sobre calles (ver el pendiente
  de `/map`).
- El cartel «No pudimos cargar el mapa» (`MapView`, compartido) sigue como
  antes; `EmptyState` conserva su subtítulo en `ink/50`.
