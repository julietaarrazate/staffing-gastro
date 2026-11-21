# El Panel del comercio, compacto y con la tira de días (#722)

**Pedido:** Julieta (2026-11-21, tras ver el prototipo del Panel en maqueta, tanda 5): el Panel (`/shifts`) tenía tanto arriba (saludo grande, tres contadores, botones, renglón de pestañas) que el primer turno quedaba debajo del pliegue. Aprobó un cielo bajo, sin pestañas, con la tira de días de Mis turnos; acá se construye de verdad. Decisiones suyas: ver «La tanda siguiente», punto 4, de `docs/planning/DIRECCION_SUAVE_PANTALLAS.md`.

**Qué cambió (lo que ve el comercio):**
- **Se fue el renglón de pestañas** («Todos / Buscando / En marcha / Terminados / Cancelados»). La lista va agrupada por estado, con título y cuántos hay (Buscando personal, En marcha, Terminados, Cancelados; Borradores si los hay). Los grupos vacíos no se muestran (antes una pestaña vacía mostraba un cartel).
- **La tira de días** (la de Mis turnos) en el cielo. Sin día elegido, la lista es la semana que se ve; con un día elegido, lo de ese día («Nada el martes 17» si no hay). Flechas con puntito, «Volver a esta semana» y, al final de la lista, **«Más adelante»** con los turnos de semanas que vienen, **los «Buscando» primero** y después por fecha; tocar una fila salta a su semana con ese día elegido.
- **El cielo, compacto** (a 390×844 el título del primer grupo y el primer turno entero se ven sin bajar):
  - sin los tres contadores (Buscando / En marcha / Terminados);
  - el saludo y el número en una línea, y **el número cuenta los turnos del día**: «Hola, Julieta. Hoy tenés 3 turnos»; con otro día elegido, ese día («El sábado tenés 2 turnos», «Mañana tenés…», «El lunes tuviste…»); al lado, «1 sin cubrir» si alguno busca personal. Si hoy no hay turnos: «Hoy no tenés turnos» y debajo «El próximo es el viernes» (o nada si no hay otro);
  - «Evento» es un chip de vidrio chico en la fila del estado («Marchando»), a la derecha;
  - la acción pendiente («Mozo/a, hoy a las 21:00 · Ya se postularon 4») en una fila: el turno a la izquierda, el ámbar «Elegir a quién va» a la derecha (el único ámbar de la pantalla);
  - **sin acción pendiente no hay «Publicar turno» en el cielo** (queda el «+» de la barra de abajo); **en el Panel vacío (ningún turno) sí**, con su texto de bienvenida.
- **Los enlaces que llevaban a una pestaña** siguen llevando al grupo: `/shifts?tab=<estado>` (el único que existe: lo arma el asistente con «Ver en el panel», `lib/use-ai-assistant.ts`; también se acepta `?familia=`) salta a la semana del turno de ese grupo más cercano (el primero que viene; si no hay, el último que hubo) y baja hasta el grupo. Después saca el parámetro de la URL, como `?turno=` en Mis turnos. Los avisos de la campanita llevan a `/shifts` a secas (no cambió).
- El recorrido guiado del panel cambia su segundo paso: de «Organizado por estado» (apuntaba a las pestañas) a «Tu semana, día por día» (apunta a la tira).

**Qué cambió (técnico):**
- `frontend/lib/panel-comercio.ts`: `resumenPanel(shifts)` ya no calcula el número ni los contadores (sólo `enMarcha`, `marchando`, `elegir`, `nadie`, lo que decide el cielo hondo y la acción pendiente); nuevas `tituloDelDia(shifts, dia, ahora)` (qué frase y qué número, con singular/plural, «sin cubrir» y «el próximo»), `turnosEnLaVista`, `ordenMasAdelante` y `diaParaFamilia`. Todo con el día de Argentina (`claveDiaArgentina`).
- `frontend/components/employer/CieloPanel.tsx`: el cielo compacto (props `titulo`, `vacio`, `tira`).
- `frontend/app/shifts/page.tsx`: usa `SemanaTira` y `MasAdelante` (compartidas, sin cambios), `semanaOffset` y `diaElegido`; ya no hay estado de pestaña. El pedido al backend (`GET /shifts/me`), las acciones de cada turno (`TurnoPanel`, `ShiftActions`), el asistente y los diálogos de confirmación no cambiaron.
- Sin CSS nuevo: el cielo usa clases existentes (`chip-vidrio`, `panel-vidrio`, `boton-relieve`) y la tira ya tenía su bloque en `globals.css`.
- Tests: `lib/panel-comercio.test.ts` (qué número y qué frase en cada caso, orden de «Más adelante», `diaParaFamilia`) y `e2e/panel-tira.spec.ts` (reloj fijo; sin pestañas; grupos; día elegido; día vacío; otra semana y volver; «Más adelante»; con y sin acción pendiente; Panel vacío; el primer turno sin bajar; claro y oscuro a 320 y 390; letra al 200 %; 1280; enlaces `?tab=`).
- Los specs que abrían el Panel con turnos de fecha fija (o contra el día en que corren) rompían con el filtro por semana: ahora fijan el reloj en la semana de sus turnos (`page.clock.setFixedTime`; `AHORA_JUEVES` en `e2e/mocks.ts` donde las fechas son relativas). Lo que afirman no cambió; los que probaban filtrar por pestaña (`shifts-panel-families`, `panel-suave`, `pestanas-relieve`, `guided-tour`, `ai-assistant-fab`) ahora lo prueban por grupo.

**Por qué así:**
- **El número cuenta los turnos de un día, no «los que están en curso».** Con la tira, «cuántos tengo» tiene que responder lo que se mira. Cuentan los turnos del día sin cancelados, no cubiertos ni borradores; un turno de anoche que sigue en marcha pasada la medianoche cuenta como de hoy. La tira, en cambio, marca (puntito) todos los turnos del día, también cancelados: es lo que la lista muestra.
- **Cambiar de semana suelta el día elegido y el número vuelve a ser el de hoy** (como en Mis turnos): sin día elegido siempre es hoy, aunque se mire otra semana.
- **El día elegido no saluda** («El sábado tenés 2 turnos»): con el saludo la frase no entra en una línea a 390 px; con otro día elegido el cielo habla del día, no de quien entra.
- **La acción pendiente y «Todavía nadie cantó «oído»» no dependen del día:** son del turno por empezar más cercano, como siempre. «Nadie se postuló» es un aviso, no una acción: sin botón y sin «Publicar turno» (el prototipo lo ponía; la decisión de Julieta —sin acción pendiente no va— manda).
- **Un enlace a un grupo salta a la semana del turno más cercano de ese grupo** (el primero que viene) y no a una semana fija: «Buscando personal» casi siempre es lo que viene.
- Descartado: dejar un filtro por estado (chips) junto a la tira; Julieta pidió que el control desaparezca.

**Queda abierto:** no se probó en la app con backend local (sólo e2e con la API mockeada). Los turnos de un día muy cargado (más de ~10) siguen en una sola lista larga por grupo. «Más adelante» incluye cancelados y borradores de semanas que vienen (para que el puntito de la flecha y el grupo no se contradigan).
