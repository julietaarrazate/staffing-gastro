# Mis turnos en la compu: dos columnas, nunca tres

**Pedido:** Julieta, 2026-11-24: optimizar todo el sistema para web y mobile (escritorio, renglones 5 y 11).

**Qué cambió:** `/my-shifts` es sólo de quien trabaja (el comercio es redirigido a `/shifts`), así que el
renglón 5 no tiene pantalla propia: es el Panel (renglón 1), que ya comparte la tira de días y «Más adelante».
Para quien trabaja, a 1440 px la tarjeta de hoy quedaba sola en la primera fila y los demás turnos iban de a
tres desde `xl` (~300 px cada uno, con huecos y alturas desparejas). Ahora, desde `md`:

- Con tarjeta de hoy: dos columnas explícitas, hoy a la izquierda y los demás activos a la derecha en orden
  cronológico (la de hoy es mucho más alta; con filas de grilla dejaba un hueco al lado). Sin tarjeta de hoy:
  grilla de dos por fila. Una primera versión con `columns-2` se descartó en la revisión: leía el orden mal
  (hoy, sáb, mié, sáb) y los turnos saltaban de columna cuando una tarjeta cambiaba de alto.
- Terminados, Postulaciones y Guardados van de a dos como mucho.

No se hizo un panel de detalle aparte: cada turno ya trae todo (mapa, pasos, acciones) adentro, y duplicarlo
al costado habría repetido la lógica. El celular no cambia (390 px comparado píxel a píxel). Los otros activos se ordenan por inicio (`porInicio`). Técnico:
`frontend/app/my-shifts/page.tsx`; prueba nueva en `frontend/e2e/mis-turnos-suave.spec.ts` (orden cronológico y nadie cambia de columna al crecer una tarjeta +300 px).

**Queda abierto:** si se quiere lista + detalle real (turno elegido al lado) es un cambio de diseño mayor.
