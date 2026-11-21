# Mi plan con la dirección suave, y un solo botón ámbar (#715)

**Pedido:** Julieta, 2026-11-21: «toda la app pasa a la misma dirección». Mi
plan seguía con la letra y las tarjetas de antes. Vio la propuesta en capturas
y aceptó dejar un solo botón ámbar en la pantalla.

**Qué cambió (lo que se ve):** sin maqueta; con las piezas de Editar perfil y
Ajustes.

- **El cielo corto** con la vuelta al perfil, «Mi plan» y su bajada; debajo la
  hoja con el plan actual, los planes y la baja como tarjetas suaves (sin
  filete, con sombra difusa). En la compu los tres planes van en tres columnas.
- **Un solo ámbar.** Antes iba en ámbar «Mejorá tu plan» de *cada* plan
  superior, además de «Pagar el mes». Ahora:
  1. con el aviso del plan elegido en la landing, el ámbar es el del aviso
     (ya era así);
  2. si la tarjeta del plan actual pide algo (pagar el mes; mejorar al llegar
     al límite o cerca), el ámbar es ése;
  3. si arriba no hay nada, el del plan **siguiente** al actual.
  Los demás planes se siguen pudiendo elegir, con el botón quieto.
- La etiqueta chica de la tarjeta del plan actual dice «Tu plan» (antes «MI
  PLAN», en mayúsculas de máquina).

**No cambió:** los nombres de los planes, los precios, los textos de la beta y
del cobro, los diálogos de confirmación, la baja ni el arrepentimiento. No hay
cambios de backend.

**Lo técnico:** `app/subscription/page.tsx` usa `SubpaginaSuave`
(`components/profile/ProfileParts.tsx`, que suma `bajada` y `ancha`). La regla
del ámbar vive en `lib/subscription.ts`: `accionesDelPlanActual` (qué pide la
tarjeta del plan actual; la usan la tarjeta y la pantalla, para no decidirlo
en dos lugares) y `planDestacado`. `PlanCard`, `SubscriptionStatusCard` y
`PlanElegidoAviso` pasan a `.tarjeta-suave` / `.nota-ayuda`.

**Lo que encontró la revisión independiente (arreglado en el PR):** tres casos
en los que la regla fallaba: con el aviso del plan elegido y además al límite
quedaban dos ámbares (la tarjeta ahora sabe que arriba ya hay uno:
`ambarArriba`); la pantalla y la tarjeta miraban relojes distintos y podían
discrepar justo cuando vencía el mes (ahora comparten la hora: `ahora`); y si
el precio de lista del plan actual había subido, «el siguiente» era el propio
plan y no quedaba ningún ámbar (`planDestacado` lo excluye). De paso, al tocar
«Mejorá tu plan» del aviso, «Planes disponibles» ya no queda tapado por la
barra de arriba en la compu.

**Por qué así:** el ámbar es la acción de la pantalla (regla de la marca), y
con dos o tres botones iguales no decía cuál. El plan siguiente es el paso
natural; quien quiere el más caro lo tiene al lado.

**Queda abierto:** el diálogo de confirmación (`Modal`) y el aviso de vuelta
del pago siguen con su estilo; van con «Las hojas compartidas».
