# Candidatos y el «¡Oído!» al elegir, con la dirección suave

**Pedido:** Julieta, 2026-11-20: seguir la migración a la dirección suave
(ADR-0028) con Candidatos del comercio y el «¡Oído!» al elegir, sobre las
maquetas `C-Candidatos`, `C-Candidatos-sin-fotos` y `C-Oido` de la prueba de
identidad por pantalla (https://claude.ai/artifact/WJn8NkYTpvSsa81RpoR2Jg).
«En Candidatos, cielo corto con el título; la recomendada como tarjeta con la
foto y el nombre encima (sin foto: tarjeta de cielo hondo con iniciales y sus
datos); «Elegir a <nombre>» como único ámbar; el resto en filas. Al elegir,
la pantalla «¡Oído!»: cielo entero con banco de nubes, la cinta dibujada por
Filete.tsx y las dos fotos que llegan de los costados (se apaga con «reducir
movimiento»).»

**Qué cambió:** la pantalla `/shifts/[id]/candidates` y lo que pasa al
elegir. El orden de la lista, quién va primero, las dos pestañas, cuándo se
puede asignar, los errores y la asignación en sí quedaron igual.

- **Arriba, un cielo corto:** la vuelta al panel (un botón redondo de
  vidrio), el turno en un renglón («Cocinero/a · Hoy, 21:00 – 01:00») y el
  título, que dice cuántos levantaron la mano: «Se postularon 4», «Se
  postuló 1» o, sin nadie, «Candidatos». Se fueron la brocha, la bajada y la
  comanda del turno.
- **La primera de cada pestaña es una tarjeta.** Con foto, la foto es la
  tarjeta, con el nombre grande encima y sus datos en chips (nota, turnos,
  distancia, puntualidad, «Identidad verificada»). Sin foto, una tarjeta con
  el cielo hondo, sus iniciales y hasta tres datos en grande.
- **«Elegir a Julia» es el único ámbar.** Antes decía «Asignar», y cuando
  nadie tenía turnos hechos había un «Asignar» ámbar por persona.
- **Los demás van en filas:** foto o inicial, nombre, sus datos en un
  renglón y «Elegir» en azul sobre gris. La fila lleva al perfil. Quien tuvo
  el turno y lo dejó sigue al final, con su marca, y se le puede volver a
  elegir.
- **Al elegir, «¡Oído!»** a pantalla completa: el cielo con el banco de
  nubes abajo, la foto del local y la de la persona que llegan de los
  costados, el tilde, la cinta que cae como un sello, «Elegiste a Julia» y
  «Cocinero/a, hoy a las 21:00. Ya le avisamos: falta que confirme.». Dos
  salidas: «Escribirle a Julia» (el chat del turno) y «Volver al panel».
  Antes la tarjeta subía con «Asignado», salía un aviso y a los 1,1 segundos
  la pantalla volvía sola al panel.
- Con «reducir movimiento» no se mueve nada (ni las fotos, ni la cinta, ni
  las nubes).

Técnico: `frontend/app/shifts/[id]/candidates/page.tsx`; piezas nuevas en
`frontend/components/candidate/`: `CandidatoDestacado.tsx`,
`CandidatoFila.tsx`, `OidoElegido.tsx` y `datosCandidato` en
`CandidateSignals.tsx`. En `globals.css`: `.cielo-hondo`, `.titulo-seccion`,
`.foto-destacada`, `.tarjeta-destacada`, `.boton-quieto` y las `.oido-*`.
`CandidateCard.tsx` perdió la variante `relieve` (ahora sólo lo usa la
landing vieja de `/historia`). Specs: `candidatos-relieve.spec.ts` pasó a
`candidatos-suave.spec.ts`; se adaptaron los que buscaban «Asignar», «Mejor
valorado» o el sello de identidad de la fila.

**Por qué así:**

- **El texto de «¡Oído!» no promete lo que no pasó.** La maqueta decía
  «Julia toma el turno», pero en el producto la persona elegida todavía
  tiene que confirmar. Dice que se le avisó y que falta que confirme.
- **Sólo datos que llegan.** «Ya trabajó 3 veces con vos» y «de 38 reseñas»
  no vienen en la respuesta: la tarjeta sin foto muestra nota, turnos hechos
  y distancia o puntualidad.
- **Rótulos sin género:** «Mejor calificación» (antes «Mejor valorado») y
  «Recomendación de Oído» (antes «el que te recomendamos»). Con la foto
  grande al lado, el masculino genérico chocaba.
- **La primera va en tarjeta aunque no tenga turnos hechos**, pero sin
  rótulo: no se inventa un motivo (`standoutApplicant` sigue decidiendo
  cuándo se dice «Mejor calificación»). Así la pantalla tiene siempre una
  acción principal y nunca más de una.
- **Las filas llevan al perfil y además se elige desde ahí:** en la maqueta
  eran sólo un link, y eso sacaba la posibilidad de elegir a otra persona.
- **«¡Oído!» es un diálogo sobre la pantalla, no una ruta:** tapa el
  encabezado y la barra, atrapa el foco, Escape vuelve al panel, y no hay
  una dirección que se pueda recargar sin datos.
- **Las pestañas quedaron** con la raya de siempre (la pista hundida de la
  prueba es de toda la app y no está decidida).

**Revisión independiente** (otro agente, intentando romperlo: unos 140
casos de 320 a 1280 px, en claro y oscuro, letra al 200 %, nombres largos,
vacíos y con emojis, fotos rotas, todos los estados del turno, errores 400,
409 y 500 al elegir, doble toque, foco y Escape en «¡Oído!», «reducir
movimiento» y pantallas bajas). Aprobó con detalles, y se arreglaron: con
la letra al 200 % a 320 px el nombre quedaba en una columna de una letra
(ahora «Elegir» baja a su renglón y el nombre de la tarjeta baja debajo de
las iniciales); sobre una foto muy clara el primer renglón de un nombre de
tres no llegaba a contraste (el velo empieza antes y el nombre ocupa a lo
sumo dos renglones); «Elegir» medía 40 px de alto (ahora 44); sin nombre del
local, «¡Oído!» escribía «EL» (ahora el cielo hondo solo); y «Nuevo en Oído»
se perdía en la tarjeta sin foto cuando había otro dato.

**Queda abierto:**

- **Se fueron de esta pantalla el pago y la duración del turno** (estaban en
  la comanda): quedan en el panel y en el detalle. Si hacen falta al elegir,
  vuelven como un chip en el cielo.
- En la fila ya no se ven el nivel ni las insignias ni, entera, la leyenda
  «Identidad verificada» (queda el escudo): están en el perfil.
- La «Garantía Oído» y las pestañas siguen con el estilo de antes.
- `Flechita` quedó sin uso; se va con la limpieza final del ADR-0028.
- No se probó en un celular táctil real, ni con fotos reales de Cloudinary,
  ni el «atrás» del navegador desde «¡Oído!» con historial real.
- Lo que la revisión vio y es de toda la app: «Inicio» y la campanita del
  encabezado miden menos de 44 px, y la barra de abajo con la letra al 200 %.
