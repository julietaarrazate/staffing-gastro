# Mis turnos con la dirección suave (#703)

**Pedido:** Julieta, 2026-11-20 (por la sesión que coordina la tanda): seguir
la migración a la dirección suave (ADR-0028) con Mis turnos, sobre la maqueta
`T-Mis-turnos` de la prueba de identidad por pantalla
(https://claude.ai/artifact/WJn8NkYTpvSsa81RpoR2Jg). «El cielo medio con la
semana; debajo, la hoja; la tarjeta de hoy lleva su propio cielo y los cuatro
pasos; el resto de los turnos como tarjetas o filas suaves. Sin el marrón por
rubro. Las mismas acciones de hoy y un solo ámbar por pantalla.» Sólo la
piel, y sin que cambie el Panel del comercio, que comparte `ShiftCard`.

**Qué cambió:** la pantalla `/my-shifts`. Las tres pestañas, qué turno va en
cuál, las acciones, sus confirmaciones, los avisos y los errores quedaron
igual.

- **Arriba, el cielo con la semana:** el título en letra normal y los siete
  días de esta semana (de lunes a domingo, en el día de Argentina). Hoy va
  en un círculo blanco y cada día con un turno por hacer lleva un punto. No
  se toca: es para mirar.
- **El turno de hoy es una tarjeta con su propio cielo:** «Hoy», el puesto
  grande, el local y el barrio, y el estado, el horario y el pago en chips
  de vidrio. Abajo, los cuatro pasos con su barra (lo hecho y lo actual en
  azul hondo), el mapa, y las acciones. Es «de hoy» el turno que ya está en
  marcha; si no hay ninguno, el próximo asignado o confirmado que empieza hoy
  o al que ya se puede avisar «voy en camino» (uno de la madrugada, visto a
  las 23:30). No lo es uno con la salida ya marcada ni uno que empezó hace
  más de 2 h sin confirmarse o sin llegada.
- **Los demás son filas:** el día en un bloque, el puesto, el horario y el
  local, y a la derecha el estado en palabras (verde lo que salió bien, rojo
  lo cancelado) y el pago. Debajo, los pasos y las mismas acciones de antes.
- **Un solo ámbar:** el de la tarjeta de hoy («Voy en camino» desde 2 h
  antes, «Llegué» desde 30 min antes, «Me fui»). En las filas las mismas
  acciones van quietas (relleno suave, letra azul). «Confirmar» sigue verde.
- **Lo que ya no tiene nada pendiente** (pagado, cancelado, no cubierto)
  queda hundido, sin sombra; la letra no pierde contraste.
- Se fueron la banda azul, el título en brocha, la bajada («Tus turnos
  asignados, postulaciones y guardados»), la comanda de papel y los sellos.

Técnico:

- `frontend/components/worker/TurnoSuave.tsx` (nuevo): el turno de quien
  trabaja, en sus dos formas (`destacado` y la fila). Muestra lo mismo que
  `ShiftCard` del lado de quien trabaja y recibe las acciones como
  `children`. **`ShiftCard` no se tocó**: sigue siendo la tarjeta del Panel.
- `frontend/app/my-shifts/page.tsx`: el cielo, la semana, la hoja, cuál es
  el turno de hoy y quién lleva el ámbar.
- `frontend/lib/semana.ts` (nuevo, con tests): la semana de lunes a domingo y
  el día de un turno, en hora de Argentina.
- `frontend/components/ShiftLifecycleStepper.tsx`: `variante="barras"`. Por
  defecto sigue con los pasos tachados (el Panel no cambia).
- `frontend/components/worker/EnRouteToggle.tsx`: una clase (`caja-en-camino`)
  para que la caja pierda el filete adentro de `.estilo-suave`.
- `frontend/app/globals.css`: reglas nuevas al final (`.dia-cielo*`,
  `.turno-fila`, `.turno-fecha`, `.turno-apagado`, `.pasos-barras`,
  `.caja-en-camino`). No se cambió ni se movió ninguna de las que estaban.
- `frontend/e2e/mis-turnos-suave.spec.ts` reemplaza a
  `mis-turnos-relieve.spec.ts`.

**Por qué así:**

- **Una pieza propia y no un modo más de `ShiftCard`:** el Panel se migra en
  la tanda siguiente y no podía cambiar con este PR. Cuando el Panel migre se
  decide si `ShiftCard` desaparece o queda sólo para el comercio.
- **El cielo de la tarjeta de hoy es siempre el cielo** (no la foto del
  local), como en la maqueta; y las filas llevan el día en un bloque en lugar
  de una miniatura, así que `PortadaCielo` no hizo falta.
- **Los cuatro pasos siguen siendo los del producto** (Postulado, Aceptado,
  En curso, Finalizado). Los de la maqueta (Confirmado, Salí, Llegué,
  Terminé) son otros hitos: «Salí» no es un estado del turno (ADR-0008).
- **El mapa chico queda sólo en la tarjeta de hoy.** En cada fila pesaba más
  que el turno; «Cómo llegar» sigue en todas.
- **«Postularme» en Guardados va quieto:** con uno ámbar por fila la pantalla
  tenía tantos ámbar como turnos guardados.
- Lo hecho en los pasos va en letra azul, sin tilde: a 320 px el tilde caía
  en un renglón aparte.

**Lo que la maqueta tenía y no se hizo (no es piel):**

- **El título «Mis turnos»:** la pantalla se sigue llamando «Matches», como
  en la barra de abajo, el encabezado, el tour y los avisos. Cambiar el
  nombre es de toda la app y va con la barra.
- **Las pestañas «Próximos / Postulaciones / Hechos»** y la pista hundida:
  siguen «Asignados / Postulaciones / Guardados» con la raya. «Hechos» como
  pestaña cambia dónde vive cada turno (hoy los terminados van debajo, en
  «Terminados») y la maqueta no tiene «Guardados»; la pista es de toda la
  app y no está decidida.
- **Los pasos «Confirmado / Salí / Llegué / Terminé»** y **«Ya salí»** como
  acción principal: hoy no existe «salí» (ADR-0008); la acción es «Voy en
  camino» o «Llegué».
- **La dirección del local** («Thames 1840») en la tarjeta: se muestra el
  barrio, como hasta ahora.
- **La barra de abajo flotante:** va al final, sola.

**Revisión independiente** (otro agente, sobre el commit): encontró que un
turno viejo sin cerrar, o uno con la salida ya marcada, se quedaba con la
tarjeta de hoy y dejaba la pantalla sin ámbar. Se corrigió la regla y quedó
cubierta en `mis-turnos-suave.spec.ts`, junto con el contraste de lo quieto.

**Queda abierto:** el Panel del comercio (`ShiftCard`) y `ReviewBox`, que
siguen con la piel anterior (al elegir una estrella, «Enviar calificación»
es un segundo ámbar: `ReviewBox` también está en el Panel y va con él); la pista de pestañas y el nombre de la pantalla,
que hay que decidir para toda la app.
