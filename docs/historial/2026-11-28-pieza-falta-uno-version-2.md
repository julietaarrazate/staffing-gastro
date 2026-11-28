# Pieza 3D «Falta uno»: la versión 2, porteña y cotidiana

**Pedido:** a Julieta le gustó la versión 1, pero la quiso más porteña y de todos
los días: sin rascacielos ni futuro, un bodegón de barrio lleno, la fila en la
vereda, el servicio que se tranca por falta de personal y alguien que llega por
Oído para que todo empiece a fluir. Las personas, sin gastar créditos.

**Qué cambió:** `src/pieza2.js` es la versión 2 (56,5 s) con el mismo mundo y
las mismas piezas que la primera, que sigue intacta. El pinche ya no crece hasta
el cielo: rebalsa y las comandas se caen al mostrador (`crearPila` con
`sinTorre`), y al final salen en orden (`tSale`). La ciudad tiene una opción de
casas bajas (`crearCiudad` con `bajo`). La gente son siluetas a contraluz que
pueden caminar (`crearGente` con `ruta`): una mesa que se va y la fila que entra
al final. Se agregó un reloj de pared (`crearReloj`). El sonido comparte sus
piezas entre las dos versiones (`kit` en `src/sonido.js`) y suma `bandaPieza2`;
la banda de la primera quedó igual (la diferencia, recalculada, es ruido de
cálculo de −104 dB). `pieza.html?escena=pieza2` dibuja la nueva y `banda.js`
acepta `pieza2`. Los textos de la versión 2 viven en un guion privado aparte
(`entrada/guion2.json`), no en el repo.

**La fachada y el tango:** Julieta pidió después una fachada «más argentina, tipo
europea francesa porteña», la vereda con mesas y gente sentada, y un tango sonando
bajo, debajo del murmullo. `src/fachada.js` arma el edificio de piedra París sobre el
bodegón: dos pisos de ventanas francesas con persianas, balcón corrido y balconcitos
de hierro forjado, frontones, cornisa con dentículos y mansarda de pizarra con
buhardillas; en la vereda, mesitas de mármol con sillas de madera curvada
(`crearSalon` con `frances`). El tango es sintético como todo lo demás
(`musicaTango` en `src/sonido.js`): bandoneón de dos lengüetas, marcato en cuatro
con arrastre, contrabajo y la síncopa 3-3-2; en re menor mientras el servicio se
tranca y como milonga en re mayor desde «Voy», para no chocar con el acorde que
resuelve. Se mezcla unos 4 o 5 dB por debajo del resto (medido con y sin tango). El
final sube con una grúa por la fachada hasta el cielo de noche, sin las nubes de la
primera (vistas desde abajo se veían naranjas).

**Por qué así:** reusar el mundo de la primera da la misma calidad sin rehacerla,
y cada versión se redibuja sola. Las personas como siluetas oscuras con un filo de
luz cálida respetan la regla «manos, sombras, espaldas y luces» y no cuestan
nada; quien llega por Oído es sólo su sombra en la vereda, como en la primera.
