# El recorrido guiado en la compu y los filtros de Buscar (#PR)

**Pedido:** Julieta mandó capturas de producción (2026-11-26): al entrar por
primera vez en la compu, un globo del recorrido quedaba en la esquina de
arriba a la izquierda sin señalar nada; y «Buscar turnos» en la compu «parece
un celu».

**Qué cambió:**
- El recorrido: los pasos «Buscar» y «Turnos» sólo tenían ancla en la barra
  de abajo, que en la compu no se muestra. Ahora los destinos de la barra de
  arriba llevan la misma ancla (`components/Navbar.tsx`), y un paso cuyo
  destino no se ve se saltea en vez de dibujarse en el origen
  (`components/GuidedTour.tsx`, `anclaVisible`). El foco inicial cae en
  «Siguiente» y no en la cruz, que quedaba con su marco a la vista.
- Buscar en la compu (desde `lg`): los filtros van en una franja a todo el
  ancho, arriba de la lista y del mapa; los rubros son chips en un renglón
  (ícono al lado del nombre) y «Urgentes» y «Mejores pagos» siguen en el
  mismo renglón. Antes eran dos filas de teclas altas apretadas en media
  pantalla. En el celular no cambia nada (`app/buscar/page.tsx`,
  `.buscar-filtros` en `app/globals.css`).

**Por qué así:** el ancho de la página no se tocó: es el mismo de toda la
app en la compu, alineado con la barra de arriba.

**Queda abierto:** nada.
