# El Mapa sin turnos: la tarjeta ya no tapa el mapa (#PR)

**Pedido:** Julieta, 2026-11-20, mirando `/map` en su celular después del
#707: «esa tarjeta gigante lo tapa».

**Qué cambió:** en el celular, cuando no hay turnos cerca, el aviso es una
tarjeta baja al pie (título, una línea de texto y los dos botones en un
renglón; a 320 px, uno debajo del otro). Antes era el estado vacío genérico,
con la ilustración grande y los botones apilados: medía unos 370 px, la mitad
de la pantalla. Los textos y lo que hace cada botón son los mismos
(«Actualizar» o «Reintentar», y «Ver todos en Buscar»). En la compu no cambia:
ahí el vacío va en el panel.

Técnico: `frontend/app/map/page.tsx` (el vacío del celular deja de usar
`ui/EmptyState`, que no se tocó); un test más en
`frontend/e2e/mapa-suave.spec.ts`.

**Por qué así:** en el Mapa lo que se mira es el mapa; el aviso acompaña. El
único ámbar sigue siendo la acción principal; «Ver todos en Buscar» va quieto.

**Queda abierto:** con cero turnos el título dice «0 turnos cerca tuyo» y la
tarjeta «No hay turnos cerca»: dicen lo mismo dos veces. Cambiar el título es
texto del producto; a decidir con Julieta.
