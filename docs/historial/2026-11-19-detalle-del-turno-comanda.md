# El detalle del turno como comanda (beta, etapa 4)

**Pedido:** Julieta, 2026-11-19: el último de los cambios de toda la app de la
dirección «con relieve». En la segunda prueba de la app
(https://claude.ai/artifact/MEN8VhUv43HM2sE9pH6kmF) el detalle es una hoja que
sube desde el Inicio con la comanda entera, y al postularse recibe la cinta
«¡Oído!». Se le preguntó dónde va el pago, que era una banda celeste grande
aparte, y eligió **en la comanda, como último renglón, con el número grande**.

**Qué cambió:** la página de un turno (`/turno/[id]`, la que se comparte por
WhatsApp y la que abre quien toca un turno), para visitantes y con sesión. La
lógica es la misma: qué se muestra sin sesión y con sesión, postularse, lo que
pasa si ya se postuló o dejó el turno.

- **Sigue siendo página**, no hoja: hacerla hoja cambiaría la navegación (y el
  link que se comparte).
- **La foto arriba** (o el tono del rubro si no hay foto), con «volver» y
  «guardar» como antes.
- **El turno es una comanda de papel** montada sobre el borde de la foto, con
  el relieve del filete: las señales arriba («Urgente» como sello rojo,
  «Comercio verificado», «Paga por encima de lo típico»), el puesto en brocha,
  el local y el barrio, y los renglones con filete: cuándo (con la duración),
  dónde, cuántas personas si son más de una y, **último, el pago con el número
  grande** y debajo «+ propinas · ≈ $ por hora» (o la nota del turno
  reofrecido). Antes: el título en serif, los datos en mosaicos con íconos y
  el pago en una banda celeste aparte.
- **Al postularse, la cinta «¡Oído!»** se pega abajo a la derecha del papel,
  con un golpe si la postulación pasó en esa pantalla (quieta con «reducir
  movimiento», y ya pegada si se había postulado antes). El papel deja lugar
  abajo para que la cinta no tape el renglón del pago. El aviso «Ya te
  postulaste» sigue debajo, igual.
- Lo de abajo (qué incluye, sobre el turno, ubicación, compartir, reportar)
  no cambió.

Contraste (el papel es claro en los dos temas): la letra en tinta 18,9 sobre
el papel de día y 16,9 sobre el de noche; lo secundario (`ink-soft`) 7,6 y
6,8; «Paga por encima» (azul hondo) 8,1 y 7,3; «Urgente» 5,6 y 5,0.

Técnico: `components/ShiftDetail.tsx` (`Comanda`, `ComandaFila`,
`textoCartel`, `LETRAS_APP` en el contenedor; se fue `InfoRow`), `.cinta-oido`
en `globals.css` (la cinta es `Filete` de la landing, `tam="cinta"`).
`ShiftDetail.test.tsx` suma la comanda, el orden de los renglones y la cinta
(con y sin golpe). Las capturas de esta página piden una API simulada: se
arma en el servidor (receta en `reference/SESION_CLOUD.md`, sección 4; el id
tiene que ser un UUID, si no la página contesta «no encontrada» sin
preguntar).

**Por qué así:**

- **El pago en la comanda:** un solo objeto con relieve por pantalla, y el dato
  que más pesa para decidir sigue siendo el más grande.
- **Montada sobre la foto también en escritorio**, más adentro que la foto: en
  escritorio la foto es una tarjeta con esquinas y el papel apoya sobre ella.
- **Las señales en el papel:** «Urgente» es un sello (rojo de los sellos);
  «Comercio verificado» es el mismo sello de confianza de las tarjetas.

**Revisión independiente** (otro agente; doce escenarios —visitante, nombre
de comercio larguísimo, sin postular, se postula en la pantalla, ya
postulado, desasignado, retirada, el 409 de quien dejó el turno, el comercio
dueño, reofrecido, pago por hora y varias personas—, a 320, 390 y 1280, claro
y oscuro, con «reducir movimiento» y teclado): aprobada. Midió que ningún
texto del papel baja de 4,5, que la cinta no tapa nada ni sale de la pantalla
a 320, que hay un solo `h1` y ningún scroll de costado. Marcó un caso: con un
monto de siete cifras («$ 1.250.000») a 320 px el número quedaba a 12 px del
rótulo «Pago» y uno de ocho lo habría pisado. Ahora, si no entra al lado del
rótulo, baja entero al renglón de abajo. Anotó, de antes, que el aviso «¡Te
postulaste!» tapa unos segundos «volver» y «guardar» sobre la foto.

**Queda abierto:** con esto terminan las piezas de toda la app. Faltan las
demás pantallas (Buscar de los dos roles, Publicar turno, Chats, Perfil,
Mapa, las fichas, Favoritos, Mi plan, el ingreso y el alta), que siguen con
el diseño anterior; el orden propuesto está en el ítem 0 de `STATUS.md`.
