# Un turno en curso que cruzó la medianoche del domingo ya no desaparece (#723)

**Pedido:** lo encontró la revisión independiente de #722, ya publicado: el
lunes entre las 00:00 y las ~05:00, un turno nocturno que empezó el domingo
(por ejemplo, de 21 a 3) no aparecía ni en Mis turnos («Nada en esta semana»,
con la pestaña Asignados contando 1) ni en el Panel («Hoy no tenés turnos»
con el cielo en «Marchando», y sin la fila). Es justo el turno que se está
trabajando: el de la llegada, la salida y marcar pagado.

**Qué cambió:** un turno que está en curso ahora (empezó y no terminó) se
muestra **hoy** en la tira de días; los demás, el día en que empiezan.
Vale para la lista, el día elegido, los puntitos, las flechas y el salto de
un aviso (`?turno=`) en Mis turnos, y para la lista, los puntitos y el
enlace del asistente (`?tab=`) en el Panel. La regla vive en un solo lugar,
`claveDeVista` en `frontend/lib/semana.ts`; la usan
`frontend/app/my-shifts/page.tsx`, `frontend/app/shifts/page.tsx` y
`turnosEnLaVista`/`diaParaFamilia` en `frontend/lib/panel-comercio.ts`. El
número del cielo del Panel ya contaba el turno de anoche como de hoy
(`tituloDelDia`); ahora la lista coincide con el número.

**Por qué así:** la causa era que la tira ubicaba cada turno por el día de
inicio y, al pasar la medianoche del domingo, la semana que se ve ya es otra.
Se descartó «mostrar siempre arriba los turnos en curso, fuera de la tira»:
sumaba un lugar más donde buscar y el número del cielo ya los trataba como
de hoy. El criterio es por horario (inicio ≤ ahora < fin), no por estado:
igual que la tira, no depende de que alguien haya marcado la llegada.

**Pruebas:** `claveDeVista` (en curso cruzando la medianoche, antes de
empezar, justo al terminar, sin fin), `turnosEnLaVista` con el turno de
anoche, y un e2e en Mis turnos y otro en el Panel con el reloj en el lunes a
la 1. Sin la regla nueva, los dos e2e fallan (comprobado). Se ajustó el
armado del turno de prueba de `lib/panel-comercio.test.ts`: el fin quedaba
fijo en hoy aunque se moviera el inicio, lo que lo volvía un turno «en
curso» de semanas.

**Queda abierto:** nada de este error. La revisión de #722 sigue con el
resto (pedidos al servidor, la app real y las capturas).
