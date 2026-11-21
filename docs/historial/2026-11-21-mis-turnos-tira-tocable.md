# Mis turnos: la tira de días se toca (#722)

**Pedido:** Julieta (2026-11-21, tras ver Mis turnos en su celular): la tira de la semana del cielo no se tocaba y debajo iba la lista entera, con los terminados viejos acumulándose sin fin. Aprobó un prototipo en maqueta (tanda 5); acá se construye de verdad.

**Qué cambió (lo que ve quien trabaja):**
- Tocar un día muestra sólo los turnos de ese día; tocarlo de nuevo vuelve a la semana entera. El día elegido lleva la tecla blanca; hoy, sin elegir, un aro fino. Cada día es un botón de 44 px o más con `aria-pressed` y nombre completo («miércoles 18, 2 turnos»).
- Puntito bajo los días con turnos. Flechas para cambiar de semana con el rótulo («Esta semana · 16 – 22 nov»); la flecha lleva un puntito si hay turnos de ese lado; en otra semana aparece «Volver a esta semana». Cambiar de semana suelta el día elegido.
- Sin día elegido la lista es la de la semana que se ve. Al final, «Más adelante»: los turnos de semanas que vienen en filas de una línea (fecha corta · puesto · estado · pago), tres y «Ver los N que siguen»; tocar una salta a su semana con ese día elegido. Lo pasado no se lista: se llega con «‹».
- Un día sin turnos es una línea («Nada el martes 17»), no un estado vacío grande.
- Un aviso `?turno=<id>` a un turno de otra semana abre esa semana (antes la tarjeta ya no estaría en pantalla).

**Qué cambió (técnico):**
- Piezas compartidas, sin nada de Mis turnos adentro, para reusar en el Panel del comercio: `frontend/components/SemanaTira.tsx` (props: `dias`, `turnosPorDia`, `elegido`, `onElegir`, `onSemana`, `esActual`, `hayAntes`, `hayDespues`, `onVolver`), `frontend/components/MasAdelante.tsx` (`filas`, `onElegir`) y `frontend/lib/semana.ts` (`semanaArgentina(ahora, semanas)`, `semanasHasta`, `rotuloSemana`, `fechaCorta`, `diaEnPalabras`, `turnosPorDia`). Todo con claves "YYYY-MM-DD" del día de Argentina (`claveDiaArgentina`), nunca con el día de la zona del navegador.
- `frontend/app/my-shifts/page.tsx`: estado `semanaOffset` y `diaElegido`; el pedido al backend no cambió (`/shifts/mine`, `/applications/mine`, `/saved-shifts`).
- CSS nuevo en un bloque al final de `globals.css` bajo `.estilo-suave`, con tokens (sin ámbar nuevo; el puntito de la flecha es la tinta del cielo).
- Tests: `lib/semana.test.ts` (semanas que cruzan mes y año, lunes primero, medianoche en Argentina), `components/SemanaTira.test.tsx`, `components/MasAdelante.test.tsx` y `e2e/mis-turnos-tira.spec.ts` (reloj fijo; claro y oscuro sin scroll horizontal a 320 y 390; teclado; letra al 200 %; 1280).

**Por qué así:**
- **La tira filtra las tres pestañas** (Asignados, Postulaciones, Guardados) por la fecha del turno; los contadores de cada pestaña siguen contando todo. Los puntitos, las flechas y «Más adelante» son de la pestaña que se mira, así la tira nunca promete algo que la lista no muestra. Descartado: filtrar sólo Asignados (cambiar de pestaña con un día elegido mostraría todo sin explicación).
- Los puntitos cuentan todos los turnos de la pestaña, terminados y cancelados incluidos (antes sólo los «por hacer»): sin eso, al ir a una semana pasada la tira no mostraría dónde hubo algo.
- «Más adelante» incluye cancelados (se listan igual en «Terminados»), para que el puntito de la flecha y el grupo no se contradigan.
- Un día elegido que ya no está en la semana que se ve (pasó la medianoche del domingo con la pantalla abierta) se da por soltado.
- Las flechas quedan arriba del bloque: al aparecer «Volver a esta semana» no se corren de debajo del dedo. Los anchos de «Más adelante» no son fijos: con la pantalla angosta o la letra al 200 % el estado y el pago bajan a una segunda línea (con 320 px y letra normal, también).
- Teclado: cada día y cada flecha es un botón del orden normal de Tab (Enter y Espacio los accionan); no se hizo un «roving tabindex» con flechas entre días.
- Los specs que abrían Mis turnos con turnos de fecha fija (o relativa al día en que corren) rompían con el filtro por semana: ahora fijan el reloj en la semana de sus fechas (`AHORA_JUEVES` / `isoDesdeJueves` en `e2e/mocks.ts`, o `page.clock.setFixedTime`). Lo que afirman no cambió; en `matches-grupo-h` el turno pagado pasó de -5 a -3 días para caer en la misma semana.

**Queda abierto:** el Panel del comercio reusa `SemanaTira` y `MasAdelante` (pedido ya decidido por Julieta, ver `docs/planning/DIRECCION_SUAVE_PANTALLAS.md`). No se probó en la app con backend local.
