# Videos de Oído en Remotion

Los videos verticales para Instagram, TikTok y Facebook (1080 × 1920, 30 fps, H.264), hechos en
[Remotion](https://www.remotion.dev) con pantallas reales de la app. Cada pieza es un componente en
`src/piezas/<pieza>.tsx` y **sus datos van aparte**, en `src/piezas/<pieza>.datos.ts`: textos,
duración, cuenta (`@oidoapp` o `@turnosgastro`), paga, escenas (cuadros) y sonido. Una variante se
saca cambiando sólo los datos (otra `<Composition>` en `src/Root.tsx` con otro objeto en
`defaultProps`).

## Instalar

```bash
cd marketing/remotion
npm ci
npm run preparar     # copia a public/ la marca (docs/design-system/marca), las nubes (frontend/public/cielo) y sonidos/
```

Chromium: si existe el de Playwright de las sesiones en la nube lo usa (`remotion.config.ts`); si
no, Remotion baja el suyo. Se puede forzar con `REMOTION_CHROME=/ruta/al/chrome`. Hace falta
`ffmpeg` en el PATH para la mezcla final.

## Previsualizar

```bash
npm run estudio                                   # Remotion Studio en el navegador
node scripts/cuadros.mjs match 30,150,300         # hoja de cuadros sueltos en out/cuadros/
```

## Renderizar

`npm run render -- <id> [<id> ...]` (sin ids: todas). Por pieza deja dos archivos en `out/`
(o en `SALIDA=/otra/carpeta`): `<id>.mp4`, **sin música** (para Instagram y TikTok, donde se le
pone la del catálogo de la red), y `<id>-con-musica.mp4`. Los dos tienen el murmullo y los efectos,
y están a -14 LUFS.

| Pieza | Dur. | Cuenta | Comando |
|---|---|---|---|
| Qué resuelve Oído | 22 s | @oidoapp | `npm run render -- que-resuelve-oido` |
| Para comercios | 15 s | @oidoapp | `npm run render -- para-comercios` |
| Para quien trabaja | 15 s | @turnosgastro | `npm run render -- para-trabajadores` |
| Cómo funciona para comercios | 29 s | @oidoapp | `npm run render -- como-funciona-comercios` |
| Cómo funciona para quien trabaja | 29 s | @turnosgastro | `npm run render -- como-funciona-trabajadores` |
| Instalá Oído en Android (Chrome) | 20 s | @oidoapp | `npm run render -- instalar-android` |
| Instalá Oído en iPhone (Safari) | 20 s | @oidoapp | `npm run render -- instalar-iphone` |
| Match, reputación y distancia | 15 s | @oidoapp | `npm run render -- match` |
| Va en camino (de noche) | 14 s | @oidoapp | `npm run render -- va-en-camino` |
| Cierre para comercios | 15 s | @oidoapp | `npm run render -- cierre-comercios` |
| Historia · Elegís y ¡oído! | 7 s | @oidoapp | `npm run render -- historia-comercios` |
| Historia · Hay turno a la vuelta | 7 s | @turnosgastro | `npm run render -- historia-trabajadores` |
| Historia · No elijas a ciegas | 7 s | @oidoapp | `npm run render -- historia-match` |
| Historia · Instalar en Android | 10 s | @oidoapp | `npm run render -- historia-instalar-android` |
| Historia · Instalar en iPhone | 10 s | @oidoapp | `npm run render -- historia-instalar-iphone` |
| 1/12 · Cosas que solo entiende quien laburó un sábado | 25 s | @turnosgastro | `npm run render -- t6-05-sabado` |
| 1/12 · Qué es Oído, en 30 segundos | 30 s | @oidoapp | `npm run render -- que-es-oido-30s` |
| 2/12 · El hielo es la mitad del trago | 29 s | @turnosgastro | `npm run render -- t2-09-hielo` |
| 3/12 · Una cebolla en 20 segundos | 28 s | @turnosgastro | `npm run render -- t3-05-cebolla` |
| 4/12 · El orden de servicio que nadie te explicó | 28 s | @turnosgastro | `npm run render -- t1-04-orden-de-servicio` |
| 4/12 · El costo que no ves: el encargado buscando gente | 30 s | @oidoapp | `npm run render -- c2-07-costo-encargado` |

Las seis de diciembre salen de la pestaña Guiones del documento de crecimiento: textos y tiempos en
`src/piezas/diciembre.datos.ts`, dibujos en `src/piezas/diciembre.tsx` (láminas de `src/kit/lamina.tsx`:
una hoja blanca con un dibujo SVG por escena). Las de @oidoapp usan las capturas de la app; las de
@turnosgastro cierran con la cuenta y el «oído» fileteado. Los seis cierres llevan dos fotos (un comercio y
alguien trabajando) y algunas escenas usan una foto en vez de dibujo: son las fotos de la landing
(`frontend/public/landing/`, CC0 o dominio público; fuentes en `docs/historial/2026-10-18-landing-cielo.md`),
que `npm run preparar` copia a `public/fotos/`. Si se reemplazan por fotos de locales porteños con el mismo
nombre (`docs/design-system/fotos-landing.md`), los videos las toman solos al volver a renderizar.

En los datos, `sonido.musicaDesde` (cuadro en que arranca la música) y `sonido.murmulloDb` ajustan la mezcla por pieza.

Sólo el video, sin la mezcla: `npx remotion render src/index.ts <id> out/<id>.mp4`.
Balance de sonido por pista: `bash scripts/niveles.sh <id>`.

Las tres primeras (`que-resuelve-oido`, `para-comercios`, `para-trabajadores`) son animación pura y
renderizan sin nada más. Las demás muestran la app y necesitan las capturas.

## Capturas de la app (no van a git)

Las pantallas son capturas reales de `frontend/` (390 × 844, escala 3) con la API simulada como en
`frontend/e2e/`: todo `/api/v1/**` con `page.route` y respuestas armadas sobre
`frontend/e2e/contrato/respuestas.json`. El reloj de la página es el viernes 27/11/2026 a las
19:00 de Buenos Aires; las personas, los locales y los montos son de ejemplo. El mapa (CARTO) se
baja de internet y queda en `capturar/.cache/`. Las interacciones del mapa se graban cuadro a
cuadro con el reloj de la página en pausa (`page.clock`).

```bash
bash capturar/todo.sh        # npm ci + build de frontend/, next start en :3311, capturas y exportar.py
# o, con la app ya levantada:  APP_URL=http://localhost:3311 bash capturar/todo.sh
```

Deja los PNG en `capturas/` y los que usa el video en `public/cap/`, y reescribe `src/cap.json`
(tamaño y color de arriba de cada captura; ése sí va a git). Necesita Python 3 con Pillow.
`node capturar/medir.js` imprime las cajas de los botones y datos que usan los toques y resaltados.

## Cómo está armado

- `src/kit/`: el cielo y las nubes (`base.tsx`), el teléfono con su cámara, toques, resaltados y
  lupas (`telefono.tsx`), Chrome y Safari dibujados sin logos (`navegador.tsx`), el cierre con el
  «oído» fileteado (`cierre.tsx`), la mezcla (`sonido.tsx`) y los tipos de los datos (`datos.tsx`).
- **Cámara**: cuadros clave `{ f, x, y, z, tx, ty }` (el punto CSS de la pantalla que va a
  `tx, ty` del video, con zoom `z`), con resortes entre clave y clave y desenfoque por velocidad.
- **Zonas seguras**: títulos entre y = 230 y 440; nada que haga falta leer debajo de y ≈ 1520.
- **Marca**: dirección suave de la app (ADR-0028): cielo, hojas blancas, sombras difusas, azul
  hondo y un solo ámbar; el filete «oído» va en el cierre.
- **Sonido**: ver `sonidos/FUENTES.md`.

## Tomas reales y sonido de Mixkit (prueba con T6-05)

`t6-05-sabado-real` es T6-05 con video real de stock en vez de láminas: mismos textos, tiempos y cierre
que `t6-05-sabado`, cada escena con una toma a pantalla completa (`src/kit/toma.tsx`) y el texto en una
hoja blanca arriba. Las tomas son de [Mixkit](https://mixkit.co), **sólo las de «Stock Video Free
License»** (las «Restricted» son de uso personal); lista y cómo verificar una nueva en `tomas/FUENTES.md`.
El sonido suma música y efectos de Mixkit (licencias libres para redes): `sonido.musica`,
`sonido.musicaDb`, `sonido.ambiente` y efectos nuevos en `sonido.cues` (`src/kit/sonido.tsx`). Ni las
tomas ni los archivos de Mixkit van a git:

```bash
bash tomas/bajar-tomas.sh       # → public/tomas/
bash sonidos/bajar-mixkit.sh    # → public/sonidos/mixkit/
npm run render -- t6-05-sabado-real
```
