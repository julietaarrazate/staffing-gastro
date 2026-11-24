# El Inicio de quien trabaja en la compu

**Pedido:** Julieta, 2026-11-24: optimizar todo el sistema para web y mobile (renglón 9 de `docs/planning/ESCRITORIO_PANTALLAS.md`).

**Qué cambió:** en compu (desde 768 px), «Urgentes» pasa de un carril horizontal de tarjetas de 232 px (con media pantalla vacía a la derecha) a una grilla que reparte el ancho: 2 por fila en tablet y 4 en el marco de 1024 px, sin scroll de costado. La grilla de turnos lleva su título «Para vos» con la cuenta («7 turnos») y las tarjetas bajan de 620 a 560 px de alto (había unos 100 px de hueco). Archivos: `frontend/app/feed/page.tsx`, `.urgentes-carril` en `frontend/app/globals.css`. Prueba nueva al final de `frontend/e2e/inicio-urgentes.spec.ts`. El celular (390 px) quedó idéntico píxel a píxel salvo las nubes animadas.

**Por qué así:** se miraron los cuatro estados (turno de hoy, hay turnos, nada, sin zona) a 390/768/1024/1440 en claro y oscuro. El vacío y el cartel de perfil ya estaban bien. En compu el Inicio no usa «recomendado» ni «Cerca tuyo» (son del celular) sino la grilla con Postularme / No gracias directos, que varios tests protegen (`feed-grid-card`, segundo toque, detalle en compu); se la mantuvo y no se la reemplazó.

**Queda abierto:** la grilla muestra un botón ámbar «Postularme» por tarjeta (más el de «Ver mi turno» con turno de hoy), contra la regla de un solo ámbar por pantalla; resolverlo toca `OpportunityCard` (también la usa el mazo) y conviene decidirlo con Julieta.
