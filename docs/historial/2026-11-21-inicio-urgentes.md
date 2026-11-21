# «Urgentes» con cuenta regresiva en el Inicio de quien trabaja (#722)

**Pedido:** Julieta, 2026-11-21, tras ver la maqueta de la tanda 5 (punto 1 de
«La tanda siguiente» en `docs/planning/DIRECCION_SUAVE_PANTALLAS.md`): una
fila arriba del Inicio con lo que empieza pronto y cuánto falta.

**Qué cambió (lo que se ve):** arriba de la hoja del Inicio (`/feed`), una
sección **«Urgentes»**: una fila horizontal (con `scroll-snap`) de tarjetas
compactas con los turnos que **empiezan en las próximas 6 horas**, el que
empieza antes primero y hasta 8. Cada tarjeta: chip rojo «Empieza en 1 h 40»
(`danger-tint` / `danger-text`, nunca ámbar), el pago en grande, el ícono del
rubro, el puesto, el local y la distancia; toca y abre `/turno/[id]`. La
cuenta baja sola cada minuto; cuando un turno empieza sale de la fila sin
recargar, y sin ninguno la sección no existe (ni título ni hueco). Se ve
también en la compu (arriba de la grilla). El resto del Inicio no cambia y
los turnos urgentes siguen en «Para vos».

**Qué cambió (técnico):**
- `frontend/lib/urgentes.ts` (+ test): `urgentesDe` (ventana, orden, tope),
  `faltaEn` / `empiezaEn` (formato). Puras.
- `frontend/components/worker/UrgentesRow.tsx` (+ test con reloj falso).
- `frontend/lib/use-ahora.ts`: ahora **se pausa con la pestaña oculta** y
  retoma (con la hora de ese momento) al volver; lo usa también el título del
  Inicio.
- `frontend/app/feed/page.tsx`: la fila va una sola vez, antes de la rama
  celular y la de compu.
- `frontend/app/globals.css`: bloque nuevo al final, bajo `.estilo-suave`
  (`.urgentes*`, `.urgente-*`, `.chip-urgencia`).
- `frontend/e2e/inicio-urgentes.spec.ts` (12 casos, con `page.clock`).

**Por qué así (decisiones):**
- **«Urgente» = cercanía del horario (< 6 h)**, independiente de la marca
  `urgent` del comercio, que se sigue viendo donde ya se ve.
- **La fuente son los turnos que el Inicio ya carga** (`visibleShifts`): no
  hay pedido nuevo ni cambia el backend, no se traen turnos fuera del radio
  y, como el Inicio ya descarta los que la persona postuló o descartó, acá
  tampoco entran. Con una búsqueda del asistente, la fila sale de ese mismo
  resultado.
- **Ventana (0, 6 h]:** justo 6 h entra; empezar ahora o ya haber empezado,
  no. Minutos redondeados para arriba (a 59 s todavía «1 min»).
- **Sin depender de la zona del navegador:** todo es diferencia de instantes
  sobre `start_at` (ISO con zona), no hay horas de pared.
- **Un solo temporizador** (`useAhora`, 60 s) para toda la fila, limpiado al
  desmontar. El tick no se alinea al borde del minuto: la cuenta puede ir
  hasta ~59 s atrasada entre ticks (aceptable para «Empieza en N min»).
- **Sin salto de layout al cargar:** mientras carga el Inicio se ve el
  esqueleto de siempre y la fila aparece junto con el resto del contenido; no
  reserva lugar. Si un refresco en vivo trae o saca el último urgente, el
  contenido de abajo se corre (lo mismo que ya pasa con «Para vos»).
- **Accesibilidad:** región «Urgentes», lista con `role="list"` (Safari),
  cada tarjeta es un enlace con nombre completo («Urgente, Bartender, Local,
  empieza en 45 min, $25.000, a 1,2 km»), sin `aria-live` (el cambio de
  minuto no se anuncia). El ancho de la tarjeta es `min(14.5rem, 80vw)`: crece
  con la letra y nunca se sale de la pantalla. Sin animaciones nuevas.

**Queda abierto:** nada de esto. La cuenta no está alineada al reloj de
pared; si molesta, se alinea el primer tick al próximo minuto.
