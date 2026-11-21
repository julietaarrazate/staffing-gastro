# La barra de abajo: un velo que esfuma lo que pasa por detrás (#PR)

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
