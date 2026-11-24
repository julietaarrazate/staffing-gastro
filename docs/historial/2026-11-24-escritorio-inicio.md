# El Inicio de quien trabaja en la compu

**Pedido:** Julieta, 2026-11-24: optimizar todo el sistema para web y mobile (renglón 9 de `docs/planning/ESCRITORIO_PANTALLAS.md`).

**Qué cambió:** en compu (desde 768 px), «Urgentes» pasa de un carril horizontal de tarjetas de 232 px (con media pantalla vacía a la derecha) a una grilla que reparte el ancho: 2 por fila en tablet y 4 en el marco de 1024 px, sin scroll de costado. La grilla de turnos lleva su título «Para vos» con la cuenta («7 turnos») y las tarjetas bajan de 620 a 560 px de alto (había unos 100 px de hueco). Archivos: `frontend/app/feed/page.tsx`, `.urgentes-carril` en `frontend/app/globals.css`. Prueba nueva al final de `frontend/e2e/inicio-urgentes.spec.ts`. El celular (390 px) quedó idéntico píxel a píxel salvo las nubes animadas.

**Por qué así:** se miraron los cuatro estados (turno de hoy, hay turnos, nada, sin zona) a 390/768/1024/1440 en claro y oscuro. El vacío y el cartel de perfil ya estaban bien. En compu el Inicio no usa «recomendado» ni «Cerca tuyo» (son del celular) sino la grilla con Postularme / No gracias directos, que varios tests protegen (`feed-grid-card`, segundo toque, detalle en compu); se la mantuvo y no se la reemplazó.

**Un solo ámbar (segundo paso):** `OpportunityCard` tiene la prop `acento` (por defecto `true`, así el mazo «Descubrir rápido» y la landing no cambian). En la grilla de compu sólo la primera tarjeta lleva «Postularme» en ámbar; las demás van en azul hondo (`.boton-hondo`), como en `/buscar`. Con un cartel de ámbar arriba (turno de hoy con «Ver mi turno», o «Completar mi perfil») ninguna tarjeta lleva ámbar. Prueba: dos casos al final de `frontend/e2e/inicio-urgentes.spec.ts` que cuentan 1 ámbar visible a 1440 con y sin turno de hoy.

**Queda abierto:** nada de este renglón.

**Revisión (tercer paso):** el alto fijo `h-[560px]` de la tarjeta de la grilla recortaba «Postularme» con una vestimenta larga (el backend admite 255 caracteres). Ahora cada celda es `grid min-h-[560px]`: la fila crece con el contenido y las tarjetas de una misma fila igualan su alto. El hero de la tarjeta, que es el 42 % del alto, pasa en la grilla a un alto fijo de 264 px (`data-hero` en `OpportunityCard` y `[&_[data-hero]]:h-[264px]` en `app/feed/page.tsx`), así no se estira con tarjetas altas y entra un título de dos líneas («Ayudante de cocina») sin pisar el ícono del rubro. La vestimenta larga rompe la palabra (`break-words`) y usa `rounded-2xl` en vez de píldora. Prueba nueva: vestimenta de 255 caracteres a 1440 y 768, «Postularme» adentro de la tarjeta.
