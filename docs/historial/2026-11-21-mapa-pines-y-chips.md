# El mapa de quien trabaja: pines con ícono, nombre del local y chips de filtro (#722)

**Pedido:** Julieta, 2026-11-21, tanda de maquetas 5, punto 5 de
`planning/DIRECCION_SUAVE_PANTALLAS.md`. Se construye de verdad lo aprobado en
la maqueta (el parche de prototipo no se aplicó: se reescribió con tests).

**Qué cambió:** `/map` (la de quien trabaja). El conmutador Lista / Mapa, la
hoja, el panel, las acciones y lo que se pide al backend no cambian; `/buscar`
y `map/MapView.tsx` no se tocaron.

- **El pin lleva el ícono del rubro antes del pago** (los de
  `lib/skill-style.tsx`), en azul hondo sobre la tecla blanca. El elegido sigue
  en azul hondo (ícono blanco); «urgente» (punto rojo) y «paga por encima»
  (flechita verde) siguen igual. El nombre accesible del pin no cambió.
- **El nombre del local al acercar.** Con zoom 15 o más, al lado de cada pin sin
  agrupar sale una pastilla del color de la tecla (blanca de día, `#1d2833` de
  noche), con la misma sombra, una línea y «…» al pasar de 140 px. Contraste de
  la letra: 18,9 de día y 13,4 de noche. Vive dentro del botón del pin y es
  `aria-hidden`: tocarla es tocar el pin y no entra dos veces en el nombre
  accesible. Si no entra a la derecha (borde de la pantalla) se voltea a la
  izquierda; si no entra en ningún lado se achica al lugar que hay (mínimo
  56 px) y, si ni así, no se muestra.
- **Pastillas que se pisan:** queda la del pin elegido y después la de los
  demás en el orden en que llegan (el más cercano primero); la que quedaría
  debajo se oculta. A propósito simple: se usan anchos estimados por cantidad de
  letras (el lado se decide con la estimación, pero el ancho que se le deja es
  el lugar real, así que no se corta de más) y sólo se compara pastilla contra
  pastilla, no contra los otros pines. Se recalcula al terminar de mover el mapa.
- **Chips de vidrio bajo el título, sobre el cielo:** «Hoy», «Mañana», «Fin de
  semana» (uno a la vez; tocar el elegido lo suelta) y «Paga más» (interruptor
  aparte, se combina). `aria-pressed`, botón de 44 px con cara de 36, una fila
  que se desliza de costado si no entra (a 320 px), sin desbordar la página;
  reciben toques aunque el cielo no. En la compu van también bajo el título del
  panel, como chips suaves (el elegido, en azul hondo como los de Buscar).
- **Filtran en el cliente** lo ya cargado: pines, tarjetas de la hoja y panel, y
  el título (que cuenta lo filtrado). Por el día de **inicio** del turno en hora
  de Argentina (`lib/map/filtros-mapa.ts`, sobre `claveDiaArgentina`). «Fin de
  semana» = el sábado y domingo que vienen, o los de ahora si ya es fin de
  semana (el domingo, el sábado de ayer y el domingo de hoy). «Paga más» =
  `pay_band === "por_encima"` (ADR-0012). Cambiar un chip vuelve a la primera
  tarjeta. Sin resultados con un filtro puesto: una tarjeta baja con «Sin turnos
  con estos filtros» y «Quitar filtros» (no el estado vacío grande, que queda
  para cuando de verdad no llegó ningún turno).

**Por qué así:** el filtro no se manda al backend ni se recuerda entre visitas
(decisión de esta tanda): son chips de mirada rápida sobre lo que ya hay, y
recordarlos haría que el mapa abriera «vacío» sin que quien lo abre sepa por qué.
Los chips usan una cara de 36 px dentro de un botón de 44 para que se vean como
en la maqueta y se toquen bien. Sin ámbar nuevo.

**Tests:** unit `lib/map/filtros-mapa.test.ts` (bordes de día en hora de
Argentina, viernes a la noche, domingo, fin de semana ya empezado) y
`lib/map/pastillas.test.ts` (voltear, achicar, pisarse); e2e
`frontend/e2e/mapa-pines-y-chips.spec.ts` (reloj fijo, claro y oscuro, 320 y
390) y ajuste de `mapa-suave.spec.ts` (el velo del cielo se mide también bajo
los chips).

**Queda abierto:** la pastilla de un pin no evita tapar a otro pin vecino; en
pantallas muy bajas (320×640) el pin elegido puede quedar bajo la fila de chips
(pasa igual con el título).
