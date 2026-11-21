# Buscar y Mapa en una sola pestaña, y «Matches» pasa a «Turnos» (#PR)

**Pedido:** Julieta, 2026-11-20 ([decisión](./2026-11-20-barra-y-encabezado-decidido.md),
punto 4): la barra de quien trabaja pasa de seis pestañas a cinco, con un
conmutador Lista / Mapa, y «Matches» se llama «Turnos». Quedó aparte del PR de
la barra flotante (#712) porque cambia la navegación.

**Qué cambió (lo que se ve):**

- **Cinco pestañas:** Inicio, Buscar, Turnos, Chats y Perfil. Ya no hay
  pestaña «Mapa».
- **Lista / Mapa:** un conmutador de vidrio sobre el cielo de Buscar y del
  Mapa (maquetas `T-Buscar` y `T-Mapa`). La vista elegida va en azul hondo. En
  el Mapa la pestaña activa es «Buscar».
- **«Turnos»** es el nombre de la pestaña de `/my-shifts`, y la pantalla se
  titula «Mis turnos». «Ver Matches» (cuando un turno compartido ya no está
  disponible) es «Ver mis turnos», y el recorrido guiado del Inicio dice
  «Turnos».
- **La compu** lleva las mismas cinco secciones arriba: Inicio (antes
  «Turnos»), Buscar, Turnos (antes «Matches»), Mensajes y Mi perfil. El
  conmutador está en el cielo de Buscar y arriba del panel del Mapa.
- **El admin** entra al Mapa sólo a mirar: conserva su pestaña «Mapa» y no ve
  el conmutador (la lista es de quien trabaja).

**Lo técnico:**

- `frontend/components/worker/ListaMapa.tsx` (nuevo) y `.conmutador` en
  `globals.css` (`.conmutador-hoja` para el panel blanco de la compu). Son dos
  links con `replace`: `/buscar` y `/map` siguen siendo dos pantallas con su
  dirección (los avisos y «atrás» llevan a la que corresponde), no un estado.
- `components/BottomNav.tsx` y `components/Navbar.tsx`: una pestaña puede
  tener otras pantallas debajo (`tambien: ["/map"]`).
- `app/buscar/page.tsx`, `app/map/page.tsx`, `app/my-shifts/page.tsx`,
  `components/TurnoNoDisponible.tsx`, `app/feed/page.tsx` (texto del recorrido).

**Por qué así:**

- *Dos rutas y no una pantalla con estado:* la maqueta enlaza dos pantallas, y
  cada una ya estaba migrada y probada. Unirlas en una sola con el mapa
  montado detrás de la lista es otra obra (y carga MapLibre a quien sólo
  quiere la lista).
- *Los títulos no se tocaron* («Buscar turnos», «N turnos cerca tuyo»): con el
  conmutador al lado, en el celular el título baja a dos renglones.
- *Los filtros no viajan entre lista y mapa:* cada pantalla tiene los suyos,
  como antes. Compartirlos (y los chips de día de la maqueta) es una función
  nueva.

**Queda abierto:** el filtro compartido entre lista y mapa y los chips de día;
las rutas siguen llamándose `/my-shifts` y `MatchesPage` en el código (no se
ve); los documentos viejos de planificación siguen diciendo «Matches».
