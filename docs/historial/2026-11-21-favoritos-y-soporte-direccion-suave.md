# Favoritos y Soporte con la dirección suave (#716)

**Pedido:** Julieta, 2026-11-21: «toda la app pasa a la misma dirección».
Favoritos y Soporte seguían con la letra y las tarjetas de antes.

**Qué cambió (lo que se ve):** sin maqueta; con `SubpaginaSuave`, como Editar
perfil, Ajustes y Mi plan.

- **Trabajadores favoritos:** el cielo corto con el título, la bajada y la
  vuelta al perfil; cada persona en su tarjeta suave, con «Quitar» quieto. En
  la compu, dos columnas.
- **Soporte:** el cielo con la vuelta a **Ajustes** (por donde se llega); los
  tickets como teclas. «Nuevo» es el único ámbar y aparece sólo cuando hay
  tickets (con la lista vacía, el ámbar es «Abrir un ticket», como antes).
- **El ticket:** el asunto es el título sobre el cielo, con la vuelta a
  Soporte (para el admin, a su lista de tickets); la conversación, la
  respuesta y «Cerrar ticket» van en la hoja.

**Arreglo de paso:** en Favoritos, con un nombre largo todas las tarjetas se
salían de la pantalla del celular y «Quitar» quedaba cortado: la grilla no
declaraba columnas en el celular y tomaba el ancho del nombre más largo. Ya
pasaba antes; se vio al mirar la pantalla renderizada con un nombre largo.

**Lo técnico:** `app/favorites/page.tsx`, `app/support/page.tsx` y
`app/support/[id]/page.tsx` usan `SubpaginaSuave`
(`components/profile/ProfileParts.tsx`), que suma `volver` (a dónde lleva la
vuelta; por defecto, al perfil). Los formularios dentro de `Modal` (ticket
nuevo, confirmar cierre) no cambian: van con «Las hojas compartidas». Sin
cambios de backend ni de lógica.

**Queda abierto:** las fichas (`/workers/[id]`, `/companies/[id]`) y Buscar del
comercio; el detalle del ticket es compartido con el admin, que lo ve ya con
la piel nueva aunque el resto de Administración no migró.
