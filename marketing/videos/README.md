# Videos promocionales

Clips verticales (1080 × 1920, 9:16) para Reels, TikTok, Stories y estados de
WhatsApp. Para bajarlos desde GitHub: abrir el `.mp4` y tocar **Download raw
file** (el ícono de descarga arriba a la derecha).

| Archivo | Qué es | Duración | Sonido |
|---|---|---|---|
| `oido-lanzamiento.mp4` | Animación "Se te bajó un mozo": el comercio pide el turno en una frase, le avisa a quien está cerca, turno cubierto. Cierra con `oido.com.ar`. | 22 s | Efectos sutiles, sin música |
| `oido-trabajador-animado.mp4` | Animación "¿Querés trabajar esta noche?": llega el aviso de un turno, elegís en el feed, te aceptan, avisás que vas en camino y cobrás. Cierra con `oido.com.ar`. | 22 s | Efectos sutiles, sin música |
| `oido-trabajador.mp4` | Grabación de la app: feed del trabajador, detalle del turno, postularse. Datos del seed demo. | 18 s | Sin audio |
| `oido-historia.mp4` | Historia de marca en 5 actos: el mensaje "hoy no llego", quiénes somos, por qué existimos (mapa de Buenos Aires), cómo funciona, la misión y Palermo. Guion, decisiones y cómo grabar la voz en [`historia-de-marca.md`](./historia-de-marca.md). | 48 s | Voz **guía** (TTS libre), música y efectos sintetizados. La voz para publicar se graba (ver el doc). |
| `oido-anuncio-15s.mp4` | Corte de 15 s para anuncios a comercios: el mensaje "hoy no llego", la marca, pedirlo en una frase, el aviso a quien está cerca, "Empezá gratis". Ver [`historia-de-marca.md`](./historia-de-marca.md). | 15 s | Música y efectos sintetizados, **sin voz** (el guion ya la tiene prevista) |

Los tres primeros no llevan música a propósito: se suma en Instagram o CapCut, que tienen
temas con licencia. Los nombres de personas y comercios, y el 07:42 del reloj,
son ilustrativos (los comercios son inventados a propósito: no nombrar uno
real sin su permiso).

## Cómo se regenera una animación

Cada animación es un par en `animacion/`: `<video>.html`, una escena HTML/CSS
de 540 × 960, y `<video>.js`, lo poco que no es CSS (un texto que se tipea,
un contador). Los videos son `lanzamiento`, `trabajador`, `historia` y
`anuncio` (estos dos tienen guion, `<video>.guion.json`: ver
`historia-de-marca.md`). Las animaciones se
congelan y se posicionan cuadro por cuadro, así el render sale fluido aunque
la máquina sea lenta. Textos, colores y tiempos (`animation-delay`, en
segundos del video) se cambian ahí.

1. Levantar el frontend (`npm run build && npx next start`, en `frontend/`).
   La escena se monta arriba de `/terminos` para usar las fuentes de la app
   (Fraunces, Inter, DM Mono) y los SVG del logo.
2. `node render.mjs <video>` (en `animacion/`) → `frames/<video>/*.jpg` a 1080 × 1920.
   `APP_URL` cambia el puerto (por defecto `http://localhost:3000`) y
   `CHROMIUM_PATH` el Chromium. `node render.mjs <video> 30 0 0 3.5 9.4` saca
   sólo esos instantes a `shots/<video>/`, para revisar antes del render
   completo, y `node render.mjs <video> 30 34 36` rehace sólo ese tramo
   (los cuadros se numeran por su instante, no desde el primero que se saca).
3. `python3 sfx.py <video>` → `<video>.wav`. Los efectos están sintetizados con la
   biblioteca estándar (sin samples de terceros); cada uno se agenda con
   `add(segundo, sonido, volumen)`.
4. Unir:

   ```sh
   ffmpeg -framerate 30 -i frames/lanzamiento/%04d.jpg -i lanzamiento.wav -c:v libx264 -pix_fmt yuv420p \
     -crf 18 -preset slow -c:a aac -b:a 192k -shortest -movflags +faststart ../oido-lanzamiento.mp4
   ```

`frames/`, `shots/` y los `.wav` son intermedios: no se commitean.

**Al escribir una escena nueva:** todas las escenas están montadas desde el
cuadro 0, una encima de la otra. Un elemento sin animación (un fondo, un SVG
fijo) o con una animación que arranca visible se ve **desde el principio del
video**, encima de las escenas anteriores. En `historia` cada escena arranca
oculta (`animation: fade .01s linear <segundo en que empieza>s both`), y en
las otras dos cada elemento visible tiene su animación de entrada. Una
animación que se repite y arranca con retraso (`ring`, `wave`) tiene que
empezar en opacidad 0, o se ve quieta hasta que le toca. Revisá
con `shots/` un instante de cada escena *anterior* a la nueva, no sólo los
de la nueva.
