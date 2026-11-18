# Un solo indicador de foco por campo

**Pedido:** Julieta: «hay recuadros donde se ven en verde y ámbar el reborde;
cuando quiero entrar como comercio o trabajador es como que quedo superpuesto».

**Qué cambió:** al enfocar un campo (tap o teclado) se ve un solo contorno, el
de la marca. Antes se veían dos: el anillo propio del campo
(`focus:ring-2 focus:ring-primary/40`, ámbar) y el contorno global
`:focus-visible` (azul/celeste, `--focus-ring`); mezclados daban ese borde
verdoso y ámbar. Medido en /login, /register, /support, /shifts/new y
/encuesta, claro y oscuro: `outline` 2px más `box-shadow` ámbar de 2px.
Se sacaron los anillos propios de 24 archivos de `frontend/app` y
`frontend/components` (TextField, Button, SegmentedControl, Toggle, textareas,
selects, `focus:border-primary` del chat y de EditableName, checkbox de
términos). No encontré ningún borde verde (`success`/`secondary`) en login,
registro ni bienvenida: el «verde» era el ámbar sobre el celeste.
Contenedores con `focus-within` (búsqueda de /admin/personas, monto de
/shifts/new, `MapAddressPicker`): clase `.foco-contenedor` en `globals.css`
dibuja el contorno de marca en el contenedor y el input lleva
`data-foco-contenedor` (`PesosInput` recibe `focoContenedor`). Enlace que cubre
una tarjeta (`OpportunityCard`, filas de /map): `.foco-propio` apaga el global y
su ring interno usa `--focus-ring`.

**Por qué así:** `outline-none` de Tailwind v4 (capa `utilities`) pierde contra
el contorno global, que no está en ninguna capa, así que los campos nunca lo
apagaron. Se eligió el global y no el anillo de cada campo porque ya cubre todo
elemento interactivo y es el que la marca define; no se tocaron colores ni
`--focus-ring`. Regla en `docs/design-system/marca-hoy.md`; test en
`frontend/e2e/un-solo-foco.spec.ts` (falla con el código anterior).

**Queda abierto:** nada.
