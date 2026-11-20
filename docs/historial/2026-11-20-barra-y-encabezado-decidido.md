# La barra de abajo y el encabezado: decidido (#PR)

**Pedido:** Julieta, 2026-11-20: no recordaba las diferencias entre lo que
está en producción y la maqueta del lienzo «Oído · identidad por pantalla»;
las vio lado a lado (hoy contra la maqueta, de quien trabaja y del comercio,
en claro y oscuro) y confirmó todo lo recomendado.

**Qué se decidió** (todavía no hay código; es lo que tiene que hacer la sesión
que migre la barra y el encabezado):

1. **La barra de abajo flota:** una píldora blanca con sombra difusa,
   separada de los bordes; la pestaña activa lleva un óvalo celeste detrás
   del ícono. Reemplaza a la decidida el 2026-11-19 (pegada al borde, con la
   raya azul arriba).
2. **Se va la franja blanca del encabezado:** el cielo de cada pantalla llega
   hasta arriba. «oído» y la campanita van sobre el cielo sólo en el Inicio y
   en el Panel; las demás arrancan con su título.
3. **«Publicar turno» del comercio** es un «+» redondo azul hondo al lado de
   la barra (no ámbar: el ámbar es de la acción de cada pantalla).
4. **Buscar y Mapa en una sola pestaña** (la barra de quien trabaja pasa de
   seis a cinco, con un conmutador Lista / Mapa, y «Matches» se llama
   «Turnos»): va, pero **aparte y después**, porque cambia la navegación y hay
   que construir el conmutador. No es piel.

1, 2 y 3 van juntas, en un PR, solas (tocan todas las pantallas).

**Por qué así:** la franja blanca corta el cielo en todas las pantallas ya
migradas; sin ella y con la barra flotando la app se ve de una sola pieza.

**Queda abierto (para la sesión que lo haga):**

- Sin la franja, la campanita deja de estar a mano fuera del Inicio y del
  Panel: hay que resolver por dónde se llega a los avisos desde las otras
  pantallas.
- La maqueta no dibuja la compu (la barra de arriba con «Turnos, Buscar,
  Mapa…»): hay que decidir cómo queda.
- Con la barra flotando, el lugar reservado abajo (`--chrome-bottom`) y las
  acciones fijas («Postularme» en el turno, la hoja del Mapa) cambian de
  medida: mirarlas todas renderizadas.
- Las pestañas (pista hundida con la elegida como tecla, punto 2 de la lista
  de `direccion-relieve.md`) no entraron en esta decisión.
