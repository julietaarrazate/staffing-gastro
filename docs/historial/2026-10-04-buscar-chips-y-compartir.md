# Buscar: chips que entran bien y "Compartir" en la tarjeta

**Pedido:** Julieta, con dos capturas del celu (2026-10-04): las filas de
chips de Buscar (rubros arriba, "Urgentes" y "Mejores pagos" abajo) se veían
como si no entraran, y la tarjeta del turno tenía un hueco grande entre los
datos y "Cómo llegar". Propuso un botón para compartir el turno por WhatsApp.

**Qué cambió:**

- Las dos filas de chips (`frontend/app/buscar/page.tsx`) sangran hasta el
  borde de la pantalla (`-mx-4 px-4`) con aire vertical (`py-1`) y sin barra
  de scroll. Antes el scroll cortaba en seco contra el margen de 16px ("Ba|"
  partido) y, como `overflow-x-auto` también recorta en vertical, se comía el
  borde (`ring-1`) del primer chip de cada fila. Los chips de las dos filas
  tienen ahora el mismo alto (`h-9`) y cuerpo de letra (`text-sm`): los de
  abajo eran más chicos y, con la letra agrandada del celular, las filas se
  veían desparejas.
- `OpportunityCard` suma el prop `shareable`: un botón "Compartir" al lado de
  "Cómo llegar", con el mismo `shareShift` del panel del comercio (Web Share
  nativo en el celu, `wa.me` de respaldo; el texto lleva el link a
  `/turno/[id]`). Lo usan las grillas: `/buscar` y el feed de escritorio.
- La tarjeta de `/buscar` mide 560px en el celu y 620px desde `sm`, donde la
  grilla necesita el alto parejo.
- E2E nuevo en `frontend/e2e/buscar-filtros.spec.ts`: el botón abre WhatsApp
  con el resumen del turno y su link.

**Por qué así:** "Compartir" va al lado de "Cómo llegar" y no en una fila
propia. Las dos son acciones secundarias (sirven antes de decidir y no
comprometen nada) y juntas no suman alto: el "Compartir por WhatsApp" que se
sacó de esta tarjeta el 2026-08-16 empujaba "Cómo llegar" fuera de vista. Se
rotula "Compartir" y no "por WhatsApp" porque en el celu abre la hoja nativa
(WhatsApp es una opción más) y porque a media fila el texto largo no entra.
Sólo el botón no llenaba el hueco, por eso también baja el alto en el celu.
En el mazo de "Descubrir rápido" no se agrega: ahí cada píxel del cuerpo
compite con "Cómo llegar".

**Capturas:** `/mnt/project-files/capturas/buscar-chips-y-compartir/`
(antes y después a 390px en claro y oscuro, más una a 412px con la letra al
112,5% para simular la del celular de Julieta).

**Queda abierto:** nada.
