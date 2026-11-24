# Publicar turno y publicar evento en la compu: sin tarjeta repetida y con resumen del evento

**Pedido:** Julieta, 2026-11-24: optimizar todo el sistema para web y mobile (renglón 3 de
`docs/planning/ESCRITORIO_PANTALLAS.md`).

**Qué cambió:** mirado a 1440 px (marco de 1024 px) y en claro y oscuro:

- `/shifts/new`: ya estaba bien armado (formulario de ~575 px a la izquierda, «Vista previa» a la derecha).
  Sólo fallaba el último paso: mostraba la tarjeta «Así lo van a ver» en el formulario y la misma al lado.
  Ahora, desde `lg`, queda sólo la vista previa; en el celular sigue la tarjeta del formulario.
- `/shifts/new-event`: era una columna de ~670 px centrada con aire a los costados. Ahora, desde `lg`,
  el formulario a la izquierda y un «Resumen» fijo a la derecha (nombre, cuándo, zona, cada puesto con su
  cantidad y pago, personas en total y lo que suma la jornada, extras). La pantalla de «¡Evento
  publicado!» ya no estira el botón a 480 px (`lg:max-w-sm`).

En el celular y a 768 px no cambia nada (capturas comparadas píxel a píxel: sólo ruido de antialiasing).
Técnico: `frontend/app/shifts/new/page.tsx` y `frontend/app/shifts/new-event/page.tsx`. Tres pruebas
nuevas en `frontend/e2e/publicar-suave.spec.ts`; en `evento-con-zona.spec.ts`, `publicar-suave.spec.ts` y
`publicar-turno-fecha.spec.ts` unos `getByText` pasaron a `.first()` porque el resumen repite la zona y el día.

**Por qué así:** el evento tiene un solo formulario largo (no pasos), así que la vista previa es un
resumen de texto y no la tarjeta del turno; sirve para ver el total a pagar antes de publicar.

**Queda abierto:** renglones 2 y 4 a 8.
