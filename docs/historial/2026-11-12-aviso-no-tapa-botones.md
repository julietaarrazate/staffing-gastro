# El aviso flotante ya no tapa los botones: va arriba en el celular (hallazgo U009 de la prueba de punta a punta)

**Pedido:** etapa 2 de la salida a beta. En la prueba de punta a punta, al tocar «Completar» con la IA en el asistente de publicar turno, aparecía el aviso «Completamos todo — revisá la zona y publicá» justo sobre el botón «Publicar turno» (390×844) y un toque enseguida no publicaba. Segunda pasada: aun sin interceptar toques, el aviso seguía tapando el botón a la vista ~3 s, y quien tocaba el cartel creyendo cerrarlo publicaba el turno sin querer (un turno publicado avisa a la gente cercana).

**Qué cambió** (`frontend/components/ui/Toast.tsx`):
- Por debajo de `md` el aviso aparece **arriba**, debajo del encabezado (`top-[calc(var(--chrome-top)+0.5rem)]`, el mismo alto del encabezado más 0,5 rem), centrado y con el mismo aspecto; desde `md` queda abajo (`md:top-auto md:bottom-24`) como antes. Los botones de acción del celular están abajo, así que ya no se cruzan.
- La entrada es sólo opacidad y escala (se quitó el desplazamiento de 20 px hacia arriba, que no tenía sentido arriba); reduced motion igual que antes.
- Sigue sin recibir toques (contenedor y cuerpo `pointer-events-none`; sólo un `<button>` dentro del aviso recibiría punteros), así que la flecha de volver y la barra de progreso que quedan debajo se tocan. `z-[60]` queda por encima del encabezado (z-40) y de los sheets; se verificó en el asistente de publicar y al postularse como trabajador (en claro y oscuro).
- Tests: `Toast.test.tsx` (clases de posición angosto/md, entrada sin `y`, el aviso no captura punteros) y `e2e/aviso-no-tapa-botones.spec.ts` (a 390 px, con el aviso visible, sus cajas no se cruzan con «Publicar turno», queda bajo el encabezado, `elementFromPoint` sobre el aviso no devuelve el aviso, y un toque en el botón publica). Doc: `docs/design-system/color-system.md` (dónde va el aviso).

**Por qué así:** se descartó dejarlo abajo sin punteros (decisión anterior): tapaba el botón a la vista y tocar el cartel publicaba sin querer. Mostrarlo dentro del paso cambiaba el diseño de todos los avisos de la app.

**Queda abierto:**
- Arriba, el aviso cubre ~3 s la franja del título del paso y la barra de progreso (se pueden tocar a través de él, pero no se ven).
- El toast no tiene hoy ningún botón de acción: la regla `[&_button]:pointer-events-auto` quedó preparada pero sin uso ni test de comportamiento (el unitario sólo compara clases, jsdom no calcula CSS). Un enlace `<a>` dentro del aviso quedaría sin punteros: la acción futura debe ser un `<button>` o sumar la regla para enlaces.
- En `md` o más ancho el aviso sigue abajo: desde `md` no hay barra inferior y `bottom-24` lo deja ~21 px sobre «Publicar turno» (medido a 768×1024, sin cruce; a 1024×768 y 844×390 tampoco). Al estar anclado abajo, avisos largos o apilados crecen hacia arriba.
- Como el aviso no recibe toques, un toque sobre su punta izquierda (sobre el tilde) cae en el botón redondo de la esquina del asistente. En el último paso de `/shifts/new` es «Atrás» (inofensivo), pero en el paso 0 (aviso «Completamos lo que pudimos…») y en `/shifts/new-event` con el pase de la IA ese botón es «Cerrar» y saca del asistente perdiendo lo cargado (no hay borrador). Pendiente de decisión: que el cuerpo del aviso reciba el toque y se cierre, o no disparar el aviso en el paso 0.
- En el inicio del trabajador (390 px), «Te marcaste como no disponible» tapa ~3 s el saludo y parte del interruptor que lo disparó; un toque en su punta derecha vuelve a cambiar la disponibilidad (misma causa que el punto anterior).
- Con un Modal abierto el aviso queda debajo del velo (los dos son `z-[60]`, el Modal se monta después): ya pasaba antes. Con «Viendo como…» (admin) el banner baja el encabezado y el aviso fijo a `--chrome-top + 0.5rem` caería sobre él (leído, no corrido).
- Un error largo de la API (3 renglones) mide ~84 px arriba y tapa la mitad del título del paso.
