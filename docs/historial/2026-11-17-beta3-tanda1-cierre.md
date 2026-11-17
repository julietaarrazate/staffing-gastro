# Etapa 3 de la beta: cierre de la tanda 1 (grupos A, B, C, F, G, I, K)

**Pedido:** Julieta pidió hacer la tanda 1 del triaje de la etapa 3: un PR
por grupo, revisión independiente de cada uno, suite e2e completa antes de
cada push y merge con CI y Security en verde.

**Qué cambió:** entraron #594 (B), #595 (F, sin U110), #596 (A), #597 (C),
#598 (G), #599 (I) y #600 (K); el detalle de cada uno está en su entrada
`2026-11-17-beta3-grupo-<g>.md`. Este PR pasa esas filas a ✅ en
`docs/planning/BETA_TABLERO.md`, anota lo que quedó abierto y suma a
`docs/reference/SESION_CLOUD.md` la trampa de gitleaks.

**Por qué así:** los siete PRs no editaron el tablero ni `STATUS.md` para no
chocar entre sí (sus filas son contiguas); el estado se escribe acá, en un
solo PR al final. Cada PR lo arregló un agente y lo revisó otro que intentó
romperlo; los menores reales de cada revisión se arreglaron en el mismo PR
antes del merge. Tras cada merge, las ramas que seguían trajeron `main` y
esperaron su CI otra vez. En el camino salió y se arregló un test que fallaba entre las 23:40 y las 00:00 de Argentina (#601).

**Queda abierto:** U110, el contraste del token `danger-text` en claro, las
zonas viejas «Mi ubicación actual», la Garantía en turnos cerrados y probar
los inputs de 16 px en un iPhone real (todo en el tablero, etapa 3).
