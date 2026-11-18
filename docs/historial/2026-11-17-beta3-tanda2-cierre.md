# Etapa 3 de la beta: cierre de la tanda 2 (grupos D, L, M)

**Pedido:** Julieta pidió la tanda 2 del triaje de la etapa 3 (grupos D, L y
M), con las reglas de la tanda 1: un PR por grupo, revisión independiente,
suite e2e completa antes de cada push con un puerto de Playwright propio, sin
literales con forma de UUID o token en los tests, y merge con CI y Security en
verde.

**Qué cambió:** entraron #604 (L), #606 (D) y #605 (M); el detalle de cada
uno está en su entrada `2026-11-17-beta-e3-grupo-<g>-*.md`. Este PR pasa esas
filas a ✅ en `docs/planning/BETA_TABLERO.md`, anota lo que quedó abierto y
actualiza la etapa en `docs/STATUS.md` (seguía diciendo «etapa 2»).

**Por qué así:** como en la tanda 1, los PRs no tocaron el tablero ni
`STATUS.md` y el estado se escribe en un solo PR al final. Lo que encontraron
las revisiones y se arregló antes del merge:

- L: el recordatorio de salida ya no sube la versión del turno, pero eso
  dejaba de cortar la carrera con el scheduler (aviso a quien ya salió, tras
  una cancelación, o dos veces). El UPDATE ahora marca sólo si el turno sigue
  asignado o confirmado a la misma persona, sin marca previa y sin «Va en
  camino», y sólo entonces avisa.
- D: la renovación de sesión sin red usaba otro texto, y un fallback que
  terminaba en «…» quedaba «Cargando…: …».
- M (tres vueltas): la ficha acusaba «No se presentó» a quien quedó asignado
  sin confirmar en un turno que venció (ahora «No cubierto»); al recargar en
  «Ver como» las pantallas cargaban un instante con el token de la admin; la
  marca de suplantación podía pasar a otra admin, no validaba el id y estiraba
  la sesión sin límite; el aviso «Mostrando 200 de N» podía salir sin corte; y
  después, un cargador que podía quedar girando si se cerraba sesión en otra
  pestaña durante la reconexión. El cartel dejó `text-white` por `on-brand`.

**Queda abierto:** en el tablero, etapa 3, «Lo que dejó abierto la tanda 2»:
recortar los avisos largos en un solo lugar, unificar los textos de «sin
conexión», y los límites conocidos de la ficha y de «Turnos en vivo».
