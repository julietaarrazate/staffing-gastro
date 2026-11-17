# Qué mide la app para los KRs de la beta (revisión, sin código)

**Pedido:** Julieta quiere saber si la app ya registra lo que piden los KRs
del objetivo 1 del trimestre (locales activos, turnos cubiertos, tiempo de
publicar a cubrir, locales que repiten, locales que pagan) y si el admin lo
muestra. Lo que falte se anota, no se programa.

**Qué cambió:** sólo docs. Sección nueva «Antes de abrir: medir la beta» en
[`../planning/BETA_TABLERO.md`](../planning/BETA_TABLERO.md), con siete
ítems (M1-M7), y la etapa 5 del tablero apunta a ella.

**Por qué así:** `/admin/metricas` ya mide turnos cubiertos y el tiempo
hasta cubrir por 7/30 días, pero con tres agujeros que dan números
optimistas: las cuentas de prueba y la invitada entran en las métricas de
turnos; «cubierto» es que el comercio eligió a alguien, no que la persona
confirmó; y el potencial de cobro cuenta a todos los comercios porque, con el
cobro apagado, toda suscripción nace activa. El compromiso de pago y el plan
elegido en la landing no se guardan en ningún lado.

**Queda abierto:** M1-M7 en el tablero. M3 y M4 (qué cuenta como «cubierto»)
esperan la definición de Julieta.
