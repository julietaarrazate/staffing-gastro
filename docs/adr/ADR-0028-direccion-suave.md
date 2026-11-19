# ADR-0028 — La dirección suave: la hoja sobre el cielo

**Estado:** aceptado; en la app entra pantalla por pantalla (la primera,
«Publicar turno» y «Publicar evento») · **Fecha:** 2026-11-19 · **Decisión
de Julieta:** 2026-11-19 · **Reemplaza en la app a:** ADR-0027 (el relieve
del filete como profundidad), a medida que se migra cada pantalla. En la
landing, ADR-0027 sigue vigente.

## Contexto

Con «Publicar turno» se probaron, sobre la pantalla real, varias versiones de
la dirección «con relieve» (ADR-0027): sin cielo, con cielo, la comanda
colgada del riel, fichas con filete azul y relieve chico, casillas rectas.
Julieta las rechazó con tres motivos que se repetían:

- «Sigue pareciendo un formulario sin gracia: está todo plano, del mismo tono
  o de un tono apenas distinto, termina mareando y pareciendo una sola cosa.»
- La brocha «es un exceso para lo que no es título».
- Con un filete azul y una sombra dura en cada control: «muy duro».

Mandó cuatro referencias (una app de citas y una de fitness sobre un cielo
celeste, teclas en 3D sobre azul y una agenda con la cabecera azul y una hoja
blanca encima). Todas comparten lo mismo: **el color atrás y las superficies
claras adelante**, profundidad con **sombras difusas** (no bordes en cada
cosa), esquinas redondeadas, números y títulos grandes en una sans negrita.

Con esa base se armó un prototipo sobre «Publicar turno» y se ablandó hasta
que Julieta dijo «dale, seguí así», con el título en letra normal grande.

## Decisión

1. **El cielo arriba y la hoja encima.** La pantalla abre con el cielo
   (`.app-cielo`): la vuelta (un botón redondo de vidrio, `.boton-vidrio`),
   los pasos y el título. Debajo sube una hoja blanca (`.hoja`, 28 px de radio
   arriba; todo el contorno en la compu) con el contenido.
2. **El título de la pantalla en letra normal**, grande y negrita
   (`.titulo-pantalla`: 32 px, 800, −0,02 em), en la tinta del cielo. La
   **brocha queda para momentos de marca** (la cinta «¡Oído!», la portada), no
   para el título de cada pantalla ni para el puesto.
3. **Una forma por función**, para que nada se pierda contra el fondo:
   - lo que se toca (`.tecla`): blanco, 18 px de radio, sombra difusa, sin
     borde; al apretarlo se achica apenas y lo elegido se llena de azul hondo
     en degradé (la letra blanca da 5,2);
   - el sí/no (`Toggle`): la fila es una tecla y el estado una casilla redonda
     que al marcarse se llena de azul hondo con el tilde (`.casilla`; adiós
     al interruptor redondeado en verde);
   - donde se escribe (`.campo`): relleno suave sin borde, 14 px de radio;
     en foco pasa a blanco con el contorno de foco de siempre (uno solo);
   - la ayuda opcional (`.nota-ayuda`): un celeste en degradé, sin borde;
   - el botón principal: ámbar en degradé con sombra de su color, 18 px de
     radio, sin borde ni canto (sigue siendo **el único ámbar** de la
     pantalla).
4. **El turno que se publica, como tarjeta** (`PedidoTarjeta`): el cielo con
   el puesto y los datos en chips de vidrio, y abajo el pago bien grande y
   los extras en chips. Es la misma tarjeta en el último paso y en la vista
   previa de la compu.
5. **Se migra de a una pantalla, sin mezclar dentro de una pantalla.** La
   pantalla migrada lleva `.estilo-suave` en su raíz; los componentes
   compartidos tienen ganchos (`boton`, `tecla`, `campo`, `casilla`,
   `interruptor`) que sólo se ven suaves adentro. Las demás pantallas quedan
   como están hasta su PR. La barra de abajo, el encabezado y las hojas
   compartidas (como «¡Turno publicado!») se migran en su propio PR.
6. **Cuando estén todas**, las reglas de `.estilo-suave` pasan a `:root`, se
   borran los ganchos y lo que quede de «con relieve» en la app, y se
   actualizan `marca-hoy.md`, `color-system.md` y `typography.md`.

## Consecuencias

- Se ablanda la regla «un objeto con relieve por pantalla» de ADR-0027: en
  las pantallas migradas la profundidad es suave y está en cada control que
  se toca, y lo que agrupa es la hoja sobre el cielo.
- Mientras dure la migración conviven las dos direcciones **entre**
  pantallas (no dentro de una). El orden de la migración está en
  [`direccion-relieve.md`](../design-system/direccion-relieve.md).
- Siguen las reglas de marca que no dependen del estilo: un solo ámbar por
  pantalla (la acción), links y lo actual en azul hondo, fondos por tokens,
  tema explícito, letra sobre la marca con `on-brand`.
- Los tokens de la dirección suave viven en `globals.css` junto a sus clases
  (`--suave-campo`, `--suave-tecla`, `--suave-sombra`,
  `--suave-sombra-alta`, `--suave-elegido`, `--suave-casilla-borde`,
  `--suave-ayuda`, `--radio-suave`), con sus valores de noche.
