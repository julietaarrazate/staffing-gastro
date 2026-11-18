# U072: «va en camino» se apaga al instante también para el comercio (#PRU072)

**Pedido:** Julieta, salida a beta, etapa 2 (decisiones 3 y 1 del tablero):
«"va en camino" se apaga al instante también para el comercio, que vuelve a
ver "Confirmado"», y `/privacidad` suma que el identificador del dispositivo
se borra también al cerrar sesión en ese dispositivo.

**Qué cambió:**

- Cuando la persona toca «Dejar de compartir», su última posición se borra en
  el momento: el comercio deja de ver el mapa y vuelve a ver «Confirmado» (en
  su panel, en el próximo refresco, hasta 30 segundos). Antes la seguía
  viendo hasta la llegada.
- Si salió de la pantalla sin apagar, al volver la tarjeta dice que el
  comercio todavía ve su última ubicación y ofrece «Borrar mi última
  ubicación». Si el borrado no sale por falta de red, se reintenta y se
  avisa.
- Apagar y volver a prender no le manda otro «salió para tu local» al
  comercio.
- `/privacidad`: tres frases (ubicación, plazo de «va en camino» y
  notificaciones). Versión `2026-11-18-1` en backend y frontend.
- Técnico: `Shift.stop_en_route` y `en_route_announced_at`
  (`backend/app/modules/shift/domain/entities.py`), `ShiftService.stop_en_route`,
  `DELETE /shifts/{id}/en-route`, migración `0052`;
  `frontend/lib/use-en-route-sharing.ts` (`stop`, `clearLast`) y
  `components/worker/EnRouteToggle.tsx`.

**Por qué así:** [ADR-0014](../adr/ADR-0014-ubicacion-en-tiempo-real.md),
actualización 2026-11-18. Salir de la pantalla no borra (el comercio perdería
de vista a quien abrió el chat); lo que se agrega es decirlo y dejar
borrarla.

**Revisión independiente:** rechazó la primera versión, con razón. Dos casos
verificados en los que la posición quedaba guardada mientras la app decía que
se había borrado: un reporte periódico que ya había salido llegaba después
del borrado y la volvía a guardar, y cualquier error del servidor (409, 429,
5xx) se tomaba como «ya está borrada». También: el recordatorio de salida le
llegaba a quien ya había salido y apagado, y un error en un envío cortaba el
viaje sin ofrecer borrar. Todo corregido con su test antes de abrir el PR; el
botón «Borrar mi última ubicación» pasó a ser un botón de tamaño normal con
estado de carga.

**Queda abierto:** la baja del dispositivo al cerrar sesión es un solo
intento y no corre cuando la sesión vence sola (lo marcó la misma revisión;
`frontend/lib/push.ts`). El texto de `/privacidad` dice «al cerrar sesión en
ese dispositivo», que es cierto en el caso normal: va anotado para Julieta.
