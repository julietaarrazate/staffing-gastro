# Videos promocionales

Clips verticales (1080 × 1920, 9:16) para Reels, TikTok, Stories y estados de
WhatsApp. Para bajarlos desde GitHub: abrir el `.mp4` y tocar **Download raw
file** (el ícono de descarga arriba a la derecha).

| Archivo | Qué es | Duración | Sonido |
|---|---|---|---|
| `oido-lanzamiento.mp4` | Animación "Se te bajó un mozo": el comercio pide el turno en una frase, le avisa a quien está cerca, turno cubierto. Cierra con `oido.com.ar`. | 22 s | Efectos sutiles, sin música |
| `oido-trabajador.mp4` | Grabación de la app: feed del trabajador, detalle del turno, postularse. Datos del seed demo. | 18 s | Sin audio |

Ninguno lleva música a propósito: se suma en Instagram o CapCut, que tienen
temas con licencia. Los nombres y el 07:42 del reloj son ilustrativos.

## Cómo se regenera la animación

Todo el video está en `animacion/stage.html`: una escena HTML/CSS de 540 × 960
cuyas animaciones se congelan y se posicionan cuadro por cuadro, así el
render sale fluido aunque la máquina sea lenta. Textos, colores y tiempos
(`animation-delay`, en segundos del video) se cambian ahí.

1. Levantar el frontend (`npm run build && npx next start`, en `frontend/`).
   La escena se monta arriba de `/terminos` para usar las fuentes de la app
   (Fraunces, Inter, DM Mono) y los SVG del logo.
2. `node render.mjs 30 0 22.5` (en `animacion/`) → `frames/*.jpg` a 1080 × 1920.
   `APP_URL` cambia el puerto (por defecto `http://localhost:3000`) y
   `CHROMIUM_PATH` el Chromium. `node render.mjs 30 0 0 3.5 9.4` saca sólo
   esos instantes a `shots/`, para revisar antes del render completo.
3. `python3 sfx.py` → `sfx.wav`. Los efectos están sintetizados con la
   biblioteca estándar (sin samples de terceros); cada uno se agenda con
   `add(segundo, sonido, volumen)`.
4. Unir:

   ```sh
   ffmpeg -framerate 30 -i frames/%04d.jpg -i sfx.wav -c:v libx264 -pix_fmt yuv420p \
     -crf 18 -preset slow -c:a aac -b:a 192k -shortest -movflags +faststart ../oido-lanzamiento.mp4
   ```

`frames/`, `shots/` y `sfx.wav` son intermedios: no se commitean.
