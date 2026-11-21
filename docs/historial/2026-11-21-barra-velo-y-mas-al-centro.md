# La barra de abajo: un velo y el «+» de «Publicar turno» al centro (#PR)

**Pedido:** Julieta, 2026-11-21, con capturas de su celular: «quizás lo que
hace que se vea raro sea la barra flotante: pasa por el texto y se
superpone». La píldora flota (ADR-0028) y el contenido de la pantalla se veía
pasar por encima, a los costados y por debajo de ella, con el texto cortado.

**Qué cambió (lo que se ve):** lo que llega a la barra se esfuma en el color
del fondo y de la píldora para abajo no se ve nada de la pantalla. Lo que
descansa al final de cada pantalla (el último turno, el campo del chat con su
foco, «Enviar») queda entero, sin velo.

**Lo técnico:** `frontend/app/globals.css`, `.barra-app::before` (detrás de la
píldora, sin toques, el contenedor tampoco) y `--barra-velo`: `--color-card` en
las pantallas con `.estilo-suave` o `.bajo-barra-hoja` (su `main` va de ese
color) y `--background` en las demás (admin y pantallas viejas). El velo mide
`--chrome-bottom` y el degradé ocupa sólo el hueco entre ese borde y la
píldora (unos 10 px a letra normal; se estira con la letra al 200 %). Tests
en `frontend/e2e/barra-flotante.spec.ts`: el velo existe y no recibe toques,
su color es el del fondo en claro y oscuro, lo que pasa por detrás no se ve
por debajo de la píldora (se lee de la captura) y los toques pasan.

**Por qué así:** la primera versión tenía 32 px de degradé sobre la píldora.
Mirada renderizada, el borde de abajo del último elemento de cada pantalla
quedaba velado hasta un 69 % (el aro de foco del campo del chat salía pálido,
lo mismo la sombra de «Enviar» y el pie de la última tarjeta): el hueco libre
que dejan las pantallas es de 10 px. Con el degradé dentro de ese hueco, nada
que descansa queda tapado y lo que se desplaza se corta suave arriba de la
píldora. Revisado en 390×844 y 320×568, en claro y oscuro, Inicio, Buscar,
Mapa, Mis turnos, Chats (lista y conversación), Perfil, el turno
(`/turno/[id]`, con su acción fija), Panel, Buscar, Candidatos, Publicar,
Perfil y Mi plan del comercio y una pantalla del admin: el color del velo
coincide con el fondo (diferencia ≤ 1 por canal en los píxeles), nada se tapa
ni se deja de tocar. Los avisos, `Sheet`, `Modal` y «¡Oído!» van por encima de
la barra (z-index 50 o más).

**Queda abierto:** la zona segura (`env(safe-area-inset-bottom)`) no se puede
simular en Chromium de escritorio: el velo y la píldora la suman por igual, y
queda por mirar en un iPhone.

## El «+» de «Publicar turno» pasa al centro de la píldora

**Pedido:** Julieta, 2026-11-21, con referencias de barras con el botón
central: «lo prefiero al centro». **Es decisión suya y reemplaza la del
2026-11-20 (#712), que lo dejaba suelto a la derecha de la píldora.**

**Qué cambió (lo que se ve):** la barra del comercio es una sola píldora de
ancho completo (como la de quien trabaja) con Panel y Buscar a la izquierda,
el «+» redondo azul hondo en el centro (56 px, mismo ícono, mismo nombre
«Publicar turno» y mismo destino) y Chats y Perfil a la derecha. El «+»
sobresale 10 px por arriba de la píldora, con su sombra y un aro del color de
la píldora que lo despega; sin muesca recortada y sin ámbar. A 320 px las
cuatro pestañas siguen midiendo 57 px de ancho táctil. Quien trabaja (cinco
pestañas, sin «+») y el admin no cambian; en la compu tampoco.

**Lo técnico:** `frontend/components/BottomNav.tsx`: el «+» ya no es hermano
de la `<nav>`, es un enlace dentro de ella entre la segunda y la tercera
pestaña (el orden de teclado sale solo: Panel, Buscar, +, Chats, Perfil).
`frontend/app/globals.css`, `.barra-app-mas`: ocupa su lugar en la fila (56 px
y 4 de aire por lado), sube 14 px (`translateY`) y lleva `box-shadow` con el
aro de `--barra-fondo`; foco visible con `outline-offset: 6px` (por fuera del
aro). Tests: `BottomNav.test.tsx`, `e2e/barra-de-abajo.spec.ts` (el «+» ya no
va al lado) y `e2e/barra-flotante.spec.ts` (centrado ±1 px, dos pestañas a
cada lado, nada se pisa a 390 y 320 px en claro y oscuro, el velo no lo
lava, orden de teclado y foco, la barra de quien trabaja no cambia).

**Por qué así:** el «+» sobresale justo lo que mide el hueco que las pantallas
dejan libre para la barra (`--chrome-bottom`), así que no pisa lo que
descansa al final ni queda debajo del velo (el velo va detrás de la píldora y
del «+»). Dentro de la `<nav>` y no al lado: una sola píldora, un solo grupo
para el lector de pantalla.
