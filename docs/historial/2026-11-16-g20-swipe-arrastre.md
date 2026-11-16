# Deslizar en «Descubrir rápido» ya no abre el detalle (G20, U069)

**Pedido:** salida a beta, hallazgo U069: en «Descubrir rápido», deslizar la tarjeta abría el detalle del turno en vez de pasar a la siguiente.

**Qué cambió:** el toque abre el detalle sólo si no hubo arrastre. Un arrastre que no llega al umbral de swipe devuelve la tarjeta a su lugar sin abrir nada; uno que lo supera pasa a la siguiente (o la anterior) como antes. Para teclado y lector de pantalla hay un botón «Ver el detalle del turno», invisible hasta recibir foco (ahí aparece arriba de la tarjeta), ya que la tarjeta es un gesto y no era alcanzable sin puntero.
- `frontend/components/worker/SwipeDeck.tsx`: se guarda dónde se apoyó el puntero (`onPointerDownCapture`) y si la tarjeta llegó a arrastrarse (`onDragStart`); `onTap` ignora el toque si hubo arrastre o si el movimiento superó `TAP_SLOP_PX` (8 px, `huboArrastre`). Botón accesible de «Ver el detalle del turno».
- Pruebas: `frontend/components/worker/SwipeDeck.test.tsx` (regla `huboArrastre` y botón accesible; jsdom no maneja los pointer events de motion, así que el gesto real no se puede probar ahí) y `frontend/e2e/descubrir-arrastre.spec.ts` (Chromium real: deslizar pasa a la siguiente sin navegar, arrastre corto no abre nada, toque quieto abre, teclado abre). Sobre el código anterior fallan el deslizar, el arrastre corto y el teclado.

**Por qué así:** se prefirió un umbral propio sobre confiar sólo en el `onTap` de motion, que no alcanzó en la práctica. El botón para teclado se agregó en vez de volver focuseable la tarjeta: la tarjeta contiene botones («Cómo llegar», compartir) y anidarlos en un rol de botón sería peor para lectores de pantalla.

**Queda abierto:** al recibir foco, el botón se dibuja sobre el chip del comercio (transitorio, sólo con teclado). Capturas en claro y oscuro: `scratchpad/g20/deck-foco-teclado_390_{light,dark}.png` de la sesión.
