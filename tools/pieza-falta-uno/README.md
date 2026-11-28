# Receta de la pieza 3D «Falta uno»

La pieza para redes de Oído («Falta uno»), dibujada entera por código: escenas
propias en three.js (licencia MIT), cuadro por cuadro en Chromium sin placa de
video, con la banda de sonido sintetizada y calculada al cuadro. Nada cuesta
plata y nada sale de un banco de imágenes o de sonidos.

El guion está en el documento privado de crecimiento (pestaña «Pieza 3D ·
guion»). Los videos y el avance, en la página privada «Pieza Falta uno»
(<https://claude.ai/artifact/TobQSft57XY8cMg5m2xRLw>). Acá queda sólo la receta.

```bash
npm ci                                                        # instala three (0.171.0)
# el guion es privado: bajar entrada/guion.json de la página privada a trabajo/entrada/
for i in 0 1 2 3; do SALTEAR=1 node render.js pieza 0 68 trabajo/cuadros 1080 1920 30 1 auto $i/4 & done; wait   # la toma entera (unos 45 min)
for i in 0 1 2 3; do node render.js pieza 70 73.6 trabajo/cuadros-extra 1080 1920 30 1 auto $i/4 & done; wait     # el plano extra del corte «Voy»
node banda.js trabajo/sonido-pieza.wav 74                     # el sonido (menos de un minuto)
node armar.js video trabajo/cuadros trabajo/sonido-pieza.wav trabajo/salida/falta-uno-entera.mp4
node armar.js corte trabajo/cuadros trabajo/cuadros-extra trabajo/sonido-pieza.wav trabajo/entrada/guion.json otra trabajo/salida/corte-otra.mp4
node marca.js ../../docs/design-system/marca/isotipo-pinche-silueta.svg trabajo/marca-pinche.png 84   # el pinche chico de @turnosgastro
node armar.js corte … voy trabajo/salida/corte-voy.mp4 trabajo/marca-pinche.png

# la versión 2 (porteña y cotidiana, 56,5 s): mismo mundo, otra línea de tiempo (src/pieza2.js) y su guion privado entrada/guion2.json
for i in 0 1 2 3; do SALTEAR=1 node render.js pieza2 0 56.5 trabajo/cuadros2 1080 1920 30 1 auto $i/4 & done; wait   # (unos 70 min)
node banda.js trabajo/sonido-pieza2.wav 56.5 pieza2
node armar.js video trabajo/cuadros2 trabajo/sonido-pieza2.wav trabajo/salida/falta-uno-v2.mp4
```

`render.js` acepta un trabajador (`0/4` … `3/4`) para repartir los cuadros
entre procesos (la nube tiene cuatro núcleos), `SALTEAR=1` para no redibujar los cuadros que ya están, `cada` para dibujar uno de cada N cuadros y `sub` para fijar
cuántos instantes promedia cada cuadro (sin `sub`, lo decide la escena).
Playwright, Chromium y ffmpeg los trae el entorno de la sesión de la nube.

| Archivo | Qué es |
|---|---|
| `pieza.html`, `render.js` | La página que dibuja un cuadro a cualquier tiempo y el programa que la recorre (`pieza` es la primera versión; `pieza2`, la segunda) |
| `src/pieza2.js` | La versión 2: un bodegón de barrio, sin torre ni rascacielos (el pinche rebalsa, el barrio de casas bajas, la gente que entra y sale); reusa todas las piezas de la primera |
| `sonido.html`, `banda.js` | La página que calcula la banda de sonido y el programa que la guarda en WAV |
| `armar.js`, `marca.js` | Une cuadros y sonido en MP4; arma los tres cortes con fundidos cortos (los tramos están en el guion privado) y la comparación con el teaser; dibuja el pinche de la esquina |
| `src/motor.js` | Render en alto rango, desenfoque de movimiento por subcuadros, profundidad de campo, bloom y revelado |
| `src/pieza.js` | La toma entera: la cámara de cada escena, las luces que se prenden, el cielo de la tarde a la noche, el foco y el revelado |
| `src/pila.js` | La pila de comandas: se clava golpe a golpe, sube al cielo y se desarma en papel picado |
| `src/salon.js`, `src/objetos.js` | El salón, la fachada, la calle y el celular; el edificio de enfrente, el talonario, la hoja que vuela, el sello, el papel picado, las flechas, la bici y las copas |
| `src/cocina.js`, `src/ciudad.js` | El pase de la cocina, el techo, la azotea; la ciudad, el cielo y las nubes |
| `src/comandas.js`, `src/texturas.js` | El papel escrito a mano y las texturas dibujadas por código |
| `src/sonido.js` | La síntesis, escena por escena: papel, aguja, mostrador, murmullo, vibración, llamadas, birome, notas, puerta, pasos, bici, la campanita, platos, copas, viento y música |
| `fuentes/inter.woff2` | Inter (SIL Open Font 1.1), para el celular y la dirección del cierre |
| `fuentes/mansalva.woff2` | La letra de las comandas (Mansalva, licencia SIL Open Font 1.1). Las palabras usan Young Serif, de `../teaser-futuro-gastronomia/fuentes/` |

Todo lo que se genera va a `trabajo/`, que git ignora.

## Reglas de la pieza

- Escenas propias. El teaser «El futuro de la gastronomía» se estudió como
  referencia de luz, cámara, transiciones y sonido; su código no trae licencia
  propia y no se reusó.
- Sin personas de muñeco: manos (su sombra), espaldas fuera de foco y luces.
- El «¡Oído!» fileteado aparece una sola vez, al final, con la campanita del pase.
- Todo es función del tiempo: cualquier cuadro se dibuja solo, así un cambio
  obliga a redibujar sólo el tramo que toca.
