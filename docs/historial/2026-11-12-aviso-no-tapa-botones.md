# El aviso flotante ya no tapa los botones: va arriba en el celular (hallazgo U009 de la prueba de punta a punta)

**Pedido:** etapa 2 de la salida a beta. En la prueba de punta a punta, al tocar «Completar» con la IA en el asistente de publicar turno, aparecía el aviso «Completamos todo — revisá la zona y publicá» justo sobre el botón «Publicar turno» (390×844) y un toque enseguida no publicaba. Segunda pasada: aun sin interceptar toques, el aviso seguía tapando el botón a la vista ~3 s, y quien tocaba el cartel creyendo cerrarlo publicaba el turno sin querer (un turno publicado avisa a la gente cercana).

**Qué cambió** (`frontend/components/ui/Toast.tsx`):
- Por debajo de `md` el aviso aparece **arriba**, debajo del encabezado (`top-[calc(env(safe-area-inset-top)+4.5rem)]`), centrado y con el mismo aspecto; desde `md` queda abajo (`md:top-auto md:bottom-24`) como antes. Los botones de acción del celular están abajo, así que ya no se cruzan.
- La entrada es sólo opacidad y escala (se quitó el desplazamiento de 20 px hacia arriba, que no tenía sentido arriba); reduced motion igual que antes.
- Sigue sin recibir toques (contenedor y cuerpo `pointer-events-none`; sólo un `<button>` dentro del aviso recibiría punteros), así que la flecha de volver y la barra de progreso que quedan debajo se tocan. `z-[60]` queda por encima del encabezado (z-40) y de los sheets; se verificó en el asistente de publicar y al postularse como trabajador (en claro y oscuro).
- Tests: `Toast.test.tsx` (clases de posición angosto/md, entrada sin `y`, el aviso no captura punteros) y `e2e/aviso-no-tapa-botones.spec.ts` (a 390 px, con el aviso visible, sus cajas no se cruzan con «Publicar turno», queda bajo el encabezado, `elementFromPoint` sobre el aviso no devuelve el aviso, y un toque en el botón publica). Doc: `docs/design-system/color-system.md` (dónde va el aviso).

**Por qué así:** se descartó dejarlo abajo sin punteros (decisión anterior): tapaba el botón a la vista y tocar el cartel publicaba sin querer. Mostrarlo dentro del paso cambiaba el diseño de todos los avisos de la app.

**Queda abierto:**
- Arriba, el aviso cubre ~3 s la franja del título del paso y la barra de progreso (se pueden tocar a través de él, pero no se ven).
- El toast no tiene hoy ningún botón de acción: la regla `[&_button]:pointer-events-auto` quedó preparada pero sin uso ni test de comportamiento (el unitario sólo compara clases, jsdom no calcula CSS). Un enlace `<a>` dentro del aviso quedaría sin punteros: la acción futura debe ser un `<button>` o sumar la regla para enlaces.
- En `md` o más ancho el aviso sigue abajo; ahí «Publicar turno» no está pegado al borde de abajo (escritorio, 1280×800), no se detectó superposición.
