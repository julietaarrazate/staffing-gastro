# El aviso flotante ya no tapa los botones (hallazgo U009 de la prueba de punta a punta)

**Pedido:** etapa 2 de la salida a beta. En la prueba de punta a punta, al tocar «Completar» con la IA en el asistente de publicar turno, aparecía el aviso «Completamos todo — revisá la zona y publicá» justo sobre el botón «Publicar turno», y un toque enseguida no publicaba.

**Qué cambió:** el aviso (toast) sigue igual en aspecto, posición (`bottom-24`) y duración (3,2 s), pero ya no recibe toques: se toca lo que hay debajo. Se sigue anunciando a los lectores de pantalla (la región `role="status"` / `aria-live="polite"` no se tocó). En `frontend/components/ui/Toast.tsx` el cuerpo del aviso pasó de `pointer-events-auto` a `pointer-events-none`, con `[&_button]:pointer-events-auto` para que, si algún aviso lleva un botón de acción, solo ese botón reciba toques. Tests: `frontend/components/ui/Toast.test.tsx` (contenedor y cuerpo no capturan punteros) y `frontend/e2e/aviso-no-tapa-botones.spec.ts` (a 390 px, con el aviso encima del botón, un toque en las coordenadas reales de «Publicar turno» publica).

**Por qué así:** la alternativa de mover el aviso o acortarlo cambiaba el diseño y no resolvía el caso (el aviso puede caer sobre cualquier cosa de abajo: «Te postulaste», «Turno asignado»). Ningún aviso se cierra tocándolo hoy (no hay `onClick` en el toast), así que dejarlo sin punteros no le saca nada a nadie: se van solos.

**Queda abierto:** el toast no tiene hoy ningún botón de acción, así que la regla del botón quedó preparada pero sin uso ni test de comportamiento. Un aviso que dura 3,2 s sigue pudiendo tapar *a la vista* lo de abajo (no los toques); si se quiere que además no lo tape visualmente, es una decisión de diseño aparte.
