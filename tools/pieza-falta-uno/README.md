# Receta de la pieza 3D «Falta uno»

La pieza para redes de Oído («Falta uno»), dibujada entera por código: escenas
propias en three.js (licencia MIT), cuadro por cuadro en Chromium sin placa de
video, con la banda de sonido sintetizada y calculada al cuadro. Nada cuesta
plata y nada sale de un banco de imágenes o de sonidos.

El guion está en el documento privado de crecimiento (pestaña «Pieza 3D ·
guion»). Los videos y el avance, en la página privada «Pieza Falta uno»
(<https://claude.ai/artifact/TobQSft57XY8cMg5m2xRLw>). Acá queda sólo la receta.

```bash
npm ci                                                       # instala three (0.171.0)
node render.js 3 0 10 trabajo/cuadros 1080 1920              # dibuja la escena 3 (de 15 a 20 min con dos procesos)
node banda.js trabajo/sonido.wav 10                          # calcula el sonido (segundos)
node armar.js video trabajo/cuadros trabajo/sonido.wav trabajo/escena3.mp4
```

`render.js` acepta un trabajador (`0/2`, `1/2`) para repartir los cuadros
entre dos procesos, `cada` para dibujar uno de cada N cuadros y `sub` para fijar
cuántos instantes promedia cada cuadro (sin `sub`, lo decide la escena).
Playwright, Chromium y ffmpeg los trae el entorno de la sesión de la nube.

| Archivo | Qué es |
|---|---|
| `pieza.html`, `render.js` | La página que dibuja un cuadro a cualquier tiempo y el programa que la recorre |
| `sonido.html`, `banda.js` | La página que calcula la banda de sonido y el programa que la guarda en WAV |
| `armar.js` | Une cuadros y sonido en MP4; arma la comparación lado a lado con el teaser |
| `src/motor.js` | Render en alto rango, desenfoque de movimiento por subcuadros, profundidad de campo, bloom y revelado |
| `src/escena3.js` | La escena 3: línea de tiempo, cámara, la pila de comandas, la sombra de la mano y las palabras |
| `src/cocina.js`, `src/ciudad.js` | El pase de la cocina, el techo, la azotea; la ciudad, el cielo y las nubes |
| `src/comandas.js`, `src/texturas.js` | El papel escrito a mano y las texturas dibujadas por código |
| `src/sonido.js` | La síntesis: papel, aguja, mostrador, murmullo, viento, ciudad y música |
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
