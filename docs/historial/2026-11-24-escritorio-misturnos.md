# Mis turnos en la compu: dos columnas, nunca tres

**Pedido:** Julieta, 2026-11-24: optimizar todo el sistema para web y mobile (escritorio, renglones 5 y 11).

**Qué cambió:** `/my-shifts` es sólo de quien trabaja (el comercio es redirigido a `/shifts`), así que el
renglón 5 no tiene pantalla propia: es el Panel (renglón 1), que ya comparte la tira de días y «Más adelante».
Para quien trabaja, a 1440 px la tarjeta de hoy quedaba sola en la primera fila y los demás turnos iban de a
tres desde `xl` (~300 px cada uno, con huecos y alturas desparejas). Ahora, desde `md`:

- La tarjeta de hoy y los demás turnos activos fluyen en dos columnas (la de hoy es mucho más alta; con filas
  de grilla dejaba un hueco al lado).
- Terminados, Postulaciones y Guardados van de a dos como mucho.

No se hizo un panel de detalle aparte: cada turno ya trae todo (mapa, pasos, acciones) adentro, y duplicarlo
al costado habría repetido la lógica. El celular no cambia (390 px comparado píxel a píxel). Técnico:
`frontend/app/my-shifts/page.tsx`; prueba nueva en `frontend/e2e/mis-turnos-suave.spec.ts`.

**Queda abierto:** si se quiere lista + detalle real (turno elegido al lado) es un cambio de diseño mayor.
