# Teaser «El futuro de la gastronomía»

Qué es, dónde quedó guardada cada pieza y cómo se rehace. Si Julieta habla de
«la presentación 3D», «la diapositiva», «el teaser» o «los videos del futuro
de la gastronomía», es esto.

## Qué es

Una **presentación 3D interactiva** (una sola página web, 13 escenas, sonido
generado en el navegador, notas para quien presenta) y los **videos cortos**
que salen de grabarla. Se hizo el 2026-11-26/27 adaptando al rubro un archivo
de referencia que trajo Julieta («The Last Boring Slide», una presentación
sobre «el futuro de la IA»): se conservaron sus escenas, sus transiciones y su
sonido, y se cambiaron los textos por los de Oído. No se dibujó nada nuevo.

Antes hubo dos intentos propios (uno en 2D y uno en 3D). Julieta los descartó:
las personas dibujadas parecían fichas de ajedrez, y pidió mantener lo más
posible los cuadros de la referencia.

## Dónde está cada cosa

| Pieza | Dónde |
|---|---|
| Los cuatro videos (horizontal de 77 s y vertical de 42 s, cada uno liviano y en máxima calidad), la banda de sonido completa (8 min 13 s) y la presentación en un solo archivo | Página privada de Julieta, **«Archivo del teaser Oído»**: <https://claude.ai/artifact/Jxhszk5zyEUonmYp2wtS14> |
| La presentación en vivo | <https://claude.ai/artifact/8HNonM9ka4uDnkCpex9bzi> (privada) |
| Las dos entradas de la receta: `entrada/guion.js` (los textos, original → español) y `entrada/referencia.html` (el archivo original) | La misma página del archivo |
| La receta: los programas, los cortes y las placas finales | [`tools/teaser-futuro-gastronomia/`](../../tools/teaser-futuro-gastronomia/README.md) |
| El primer intento propio en 3D (descartado) | <https://claude.ai/artifact/XwGbrHh2Y7ZHqkzWjzMuYL> |
| Qué falta que Julieta apruebe antes de publicarlo | Sección «Antes de publicarlo» de la página del archivo |

Las páginas de claude.ai son privadas de la cuenta de Julieta: una sesión suya
las lee con la herramienta `Artifact`; nadie más puede abrirlas.

**Por qué el guion y la referencia no están en este repo:** el repo es público
y los dos traen el texto completo de una obra que no es nuestra. Los videos
tampoco: pesan entre 7 y 60 MB. Los cuadros sueltos (3.428 imágenes) no se
guardan en ningún lado: la receta los vuelve a dibujar idénticos.

## Retomar en una sesión nueva

1. Bajar las entradas a la carpeta de trabajo, que git ignora. Con la
   herramienta `Artifact`: `action: "read"`, la `url` del archivo de arriba,
   `paths: ["entrada/guion.js", "entrada/referencia.html"]` y `out_dir` en
   `tools/teaser-futuro-gastronomia/trabajo/`.
2. `cd tools/teaser-futuro-gastronomia && npm ci`. Eso instala solo acorn.
   Playwright, Chromium y ffmpeg no están en el `package.json`: los trae el
   entorno de la sesión de la nube (Playwright se carga con `require`, ver
   [`SESION_CLOUD.md`](./SESION_CLOUD.md)).
3. Seguir los pasos de `./receta.sh` (sin argumentos los lista).

`referencia.html` y `presentacion.html` pesan 5 MB de código en una sola línea:
no los abras con `Read`; se buscan con `grep -o` o con un programa. El guion sí
se lee: `trabajo/entrada/guion.js` exporta `textos` (frase original → frase
nueva, tiene que coincidir entera), `prefijos` (notas largas, se reconocen por
cómo empiezan) y `codigo` (ajustes puntuales del programa, cada uno tiene que
aparecer exactamente una vez).

Lo que cambie hay que **volver a publicarlo en la página del archivo** (el
guion, los videos), pasando su `url` a `Artifact`: si no, se pierde cuando se
cierra la sesión. Cada archivo publicado puede pesar hasta 15 MB, por eso los
videos de máxima calidad están partidos en `maestros/*.pN.mp4`: se parten con
`split -b 14M` y se unen con `cat`, en orden y sin recodificar. Una lectura
trae hasta 64 MB, así que se bajan en dos tandas.

## Cómo funciona la receta

| Paso | Qué hace | Cuánto tarda |
|---|---|---|
| `adaptar` | Aplica el guion a la referencia y deja `trabajo/presentacion.html`. Cambia los textos por su posición exacta en el código (árbol sintáctico, con acorn), no con buscar y reemplazar, y avisa si una clave del guion quedó sin usar | segundos |
| `miniaturas` | Captura una imagen por escena y reemplaza las miniaturas del original | unos minutos |
| `preparar` | Agrega a la presentación un reloj manual y la lectura del estado, y deja `render.html` y `render-audio.html`. No cambia lo que se ve ni lo que suena | segundos |
| `linea` | Deja que la presentación avance sola, sin dibujar, y anota en qué cuadro cambia cada escena. El resultado vigente es `linea.json` (489,77 s a 30 cuadros por segundo) | unos minutos |
| `sonido` | Graba en tiempo real lo que sale del motor de audio de la presentación. Un pitido de 1 kHz un segundo antes del cuadro cero permite recortarlo para que coincida con los cuadros | 9 min |
| `cuadros h` / `cuadros v` | Dibuja cuadro por cuadro solo los tramos de `corte-h.json` o `corte-v.json` (segundo inicial, segundo final y nombre de cada tramo) | 20 a 60 min |
| `armar h` / `armar v` | Une cuadros, sonido y placa final en dos MP4: máxima calidad y liviano para WhatsApp | 2 min |
| `placas` | Vuelve a dibujar `placa-h.png` y `placa-v.png` con la firma fileteada | segundos |

Qué rehacer según el cambio:

- **Una frase:** editar `trabajo/entrada/guion.js` → `adaptar`, `miniaturas`,
  `preparar` → `cuadros` solo del tramo donde aparece, por ejemplo
  `./receta.sh cuadros h 3,4` (los tramos se numeran desde 0, en el orden del
  corte) → `armar`. El sonido no cambia.
- **Qué escenas entran o en qué orden:** editar el `corte-*.json` → `cuadros`
  → `armar`. Si solo cambió el largo de un tramo, alcanza con redibujar ese. Si
  se agregó, se sacó o se movió un tramo, cambia la numeración de los que
  siguen y hay que redibujarlos también.

`cuadros` borra los cuadros viejos de cada tramo antes de dibujarlo y anota en
`tramos.json` con qué corte lo hizo. `armar` se niega a seguir, y dice qué
tramo redibujar, si los cuadros no corresponden al corte.
- **La placa final:** editar `placa.js` → `placas` → `armar`.
- **Otro formato** (cuadrado, 4:5): un `corte` nuevo y `cuadros.js` con ese
  tamaño; la presentación se acomoda sola a pantallas verticales.

Si un cambio de texto mueve los tiempos (`linea` avisa), hay que revisar los
cortes y volver a grabar el sonido.

## Límites conocidos

- La sesión de la nube no tiene placa de video: cada cuadro de 720p tarda entre
  0,3 y 9 segundos. Por eso los videos son cortes de 42 y 77 segundos y no la
  presentación entera (unos 14.700 cuadros). El vertical se dibuja a 720×1280
  y se agranda a 1080×1920 al armar.
- En la grabación del sonido el reloj se atrasa hasta 73 cuadros durante
  algunas transiciones entre escenas. Los cortes vigentes no usan esos
  momentos; un corte nuevo que incluya una transición hay que escucharlo.
- El video de máxima calidad sale idéntico byte a byte cada vez (con ffmpeg
  6.1.1). El liviano no: el tope de peso hace que el codificador no sea
  determinista, y sale equivalente pero no igual.
- Claude no escucha audio: el sonido se controló midiendo el volumen y en qué
  segundo empieza cada golpe, no de oído.
- Los nombres de los modelos de IA del gráfico original siguen en el código de
  la presentación como identificadores internos. No se ven en pantalla; si
  alguna vez se publica fuera de claude.ai, conviene cambiarlos.
