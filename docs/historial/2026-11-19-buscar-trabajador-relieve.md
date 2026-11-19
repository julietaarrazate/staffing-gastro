# Buscar del trabajador con la dirección «con relieve» (beta, etapa 4)

**Pedido:** Julieta, 2026-11-19, con las seis piezas de toda la app ya
mergeadas: «las otras pantallas, Buscar por ejemplo, tanto trabajador como
comercio, siguen igual» y «todas las pantallas, cada una del sistema, tiene
que tener la misma estética que venimos trabajando, no puede quedar a medias.
Arranquemos por Buscar del trabajador». Se le mostraron dos opciones puestas
sobre la pantalla real (a 390 y 1280 px): cada turno como **comanda**, o una
**lista con filete** como «Cerca tuyo» del Inicio. Eligió **las comandas**.

**Qué cambió:** `/buscar`. La lógica es la misma: qué turnos se piden, el
filtro por rubro, «Urgentes», «Mejores pagos», postularse, pasar, compartir,
cómo llegar y guardar.

- **Arriba, el cielo** con «Buscar turnos» en brocha y la bajada (antes,
  título en serif sobre el lienzo).
- **Los rubros son las pestañas de la app**, con la raya azul hondo, y
  scrollean de costado como en el Panel. Antes eran píldoras con «Todos» en
  ámbar: el ámbar es sólo la acción.
- **«Urgentes» y «Mejores pagos» son rectos**, blancos con filete; prendidos,
  llenos en azul hondo, como lo actual de un indicador (`marca-hoy.md`, regla
  2). Antes, píldoras en tinte.
- **Cada turno es una comanda** (`OportunidadComanda`): foto chica del local
  (o el rubro), el puesto en brocha, el local, el barrio y la distancia,
  «Comercio verificado» y el sello «Urgente», los renglones con filete (cuándo,
  con la duración, y el pago con «+ propinas») y las acciones de siempre:
  «Cómo llegar», «Compartir», «No, gracias» y «Postularme». La comanda entera
  lleva al detalle; los botones no navegan. Mide unos 300 px de alto: la
  tarjeta con foto grande de antes medía de 560 a 620.

Contraste, medido renderizado: lo más bajo del papel es el sello «Urgente»
(5,6 de día y 5,0 de noche); «Postularme» 5,9; el resto del papel, 6,8 o
más. La cabecera: la tinta del cielo sobre el cielo da de 5,0 a 7,9 de día y
13,5 de noche. Los filtros prendidos: 8,1 de día y 9,6 de noche; apagados,
la tinta sobre la tarjeta.

Técnico: `app/buscar/page.tsx` (`LETRAS_APP`, `.app-cielo`, `SegmentedControl`
para los rubros dentro del contenedor que scrollea, `filterChipClass` recto) y
`components/worker/OportunidadComanda.tsx`, nuevo: `Comanda` con el link al
detalle por encima (`data-testid="opportunity-card-link"`, el mismo contrato
que la tarjeta de antes) y las acciones con `BOTON_LISO` y `Button`.
`OpportunityCard` no se tocó: la siguen usando el mazo y la grilla del Inicio.
Spec nuevo: `e2e/buscar-relieve.spec.ts`; el unitario de la página simula la
comanda nueva.

**Por qué así:**

- **La comanda y no la lista:** el turno es el mismo objeto en todas las
  pantallas, y se puede postular sin entrar al detalle, como antes.
- **A 320 px la foto baja a 48 px:** «Recepcionista» en brocha mide 181 px y
  no entraba al lado de una de 56 (se partía la palabra).

**Queda abierto:** las demás pantallas, en el orden del ítem 0 de `STATUS.md`
(sigue Buscar del comercio).
