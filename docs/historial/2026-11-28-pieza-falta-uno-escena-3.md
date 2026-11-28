# Pieza 3D «Falta uno»: la escena 3 y su receta

**Pedido:** Julieta quiere una pieza 3D para redes con el nivel del teaser «El
futuro de la gastronomía», pero con escenas propias dibujadas por código. Primero
una sola escena terminada (la 3: las comandas que se clavan y la pila que sube
hasta el cielo), vertical y con sonido, al lado de la escena equivalente del
teaser, y esperar su sí antes de seguir.

**Qué cambió:** se agregó la receta en `tools/pieza-falta-uno/`. `pieza.html`
dibuja cualquier cuadro de la escena a cualquier tiempo y `render.js` la recorre
en Chromium sin placa de video. `src/motor.js` hace el render en alto rango, el
desenfoque de movimiento promediando hasta 8 instantes por cuadro, la
profundidad de campo, el bloom y el revelado. `src/escena3.js` lleva la línea de
tiempo, la cámara y la pila. `src/cocina.js` y `src/ciudad.js` arman el pase del
bodegón, la azotea, la ciudad, el cielo y las nubes. `src/sonido.js` sintetiza
la banda, alineada al cuadro, y `armar.js` une todo en MP4. Los videos y el
avance quedan en la página privada «Pieza Falta uno». Qué es y cómo se rehace:
`docs/reference/PIEZA_FALTA_UNO.md`.

**Por qué así:** el código propio del teaser no trae licencia, así que sólo se
estudiaron sus técnicas y three.js (MIT) se instala desde npm. Todo es función
del tiempo, así cualquier tramo se redibuja solo. La mano es sólo su sombra (en
la regla «sin personas de muñeco»). La sombra se proyecta desde arriba de la
pila porque el acero del mostrador no la muestra. El sonido se calcula en un
OfflineAudioContext y no se graba en tiempo real, para que no se atrase como en
el teaser.

**Revisión:** otro agente la comparó dos veces con el teaser. La primera dijo
«no llega» (pila chata, cámara baja y borrosa, torre como una soga marrón). La
segunda dijo «casi» (faltaba el cielo). Después se rehízo el final con nubes
iluminadas desde abajo; ese arreglo no tuvo una tercera revisión.

**La toma entera:** con el sí de Julieta («me gusta cómo va quedando», sin
comparación al lado) se armó la pieza de 68 s en un solo mundo (`src/pieza.js`):
bodegón con salón y fachada, la calle, el edificio de enfrente, la ciudad que se
prende, y el «¡Oído!» fileteado una sola vez con la campanita. Además salieron
los tres cortes. Los textos en pantalla viven en un guion privado, no en el repo.
Julieta pidió además arreglar lo que Claude había marcado en la escena 3: la pila
que suba más a la vista, un cruce del techo más lento y bordes limpios en la torre.

**Queda abierto:** que Julieta vea la pieza entera y los cortes, y los ajustes
que pida.
