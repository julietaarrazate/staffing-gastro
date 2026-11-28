# Pieza 3D «Falta uno»

Qué es, dónde está cada pieza y cómo se rehace. Si Julieta habla de «la pieza
3D», «Falta uno» o «las comandas que suben al cielo», es esto.

## Qué es

Una toma vertical para las redes de Oído que cuenta un viernes en un bodegón:
falta uno, la noche se cae, alguien canta el pedido y el barrio contesta
«¡oído!». A diferencia del teaser «El futuro de la gastronomía»
([`TEASER_FUTURO_GASTRONOMIA.md`](./TEASER_FUTURO_GASTRONOMIA.md)), que adapta
una obra ajena, acá **todas las escenas son propias y están dibujadas por
código**. Del teaser se estudiaron la luz, la cámara, las transiciones y el
sonido. Su código no trae licencia y no se reusó.

Primero se hizo la escena 3 sola (la pila de comandas que sube hasta el cielo),
puesta al lado de la torre del teaser. Con el sí de Julieta (28/11) se hizo la
toma entera de 68 s y los tres cortes para redes: dos para @oidoapp y uno para
@turnosgastro, que lleva el pinche chico en una esquina.

Después Julieta pidió una **versión 2** más porteña y cotidiana: sin rascacielos
ni futuro, un bodegón de barrio lleno, la fila en la vereda, el servicio que se
tranca por falta de personal y alguien que llega por Oído para que todo
vuelva a fluir. Las personas, sin gastar créditos: siluetas a contraluz dentro
del mundo 3D. Usa el mismo mundo y las mismas piezas (`src/pieza2.js`, 56,5 s)
y sus textos van en otro archivo privado, `entrada/guion2.json`.

## Dónde está cada cosa

| Pieza | Dónde |
|---|---|
| El guion, la vara de calidad y los límites | Documento privado de crecimiento, pestaña «Pieza 3D · guion» |
| Los textos en pantalla, los tiempos y los tramos de cada corte (`entrada/guion.json`) y el plan de cada escena (`entrada/plan.md`) | Página privada, abajo; se bajan a `tools/pieza-falta-uno/trabajo/entrada/` |
| Los videos, el avance y la comparación con el teaser | Página privada **«Pieza Falta uno»**: <https://claude.ai/artifact/TobQSft57XY8cMg5m2xRLw> |
| La receta: los programas que dibujan, suenan y arman | [`tools/pieza-falta-uno/`](../../tools/pieza-falta-uno/README.md) |

Los videos no van al repo: el repo es público y pesan decenas de megas. Los
cuadros sueltos tampoco: la receta los vuelve a dibujar idénticos.

## Retomar en una sesión nueva

1. `cd tools/pieza-falta-uno && npm ci` (instala three; Playwright, Chromium y
   ffmpeg los trae el entorno, ver [`SESION_CLOUD.md`](./SESION_CLOUD.md)).
2. Bajar `entrada/guion.json`, `entrada/guion2.json` y `entrada/plan.md` de la página privada a
   `trabajo/entrada/` (con `Artifact`, `action: "read"`, `paths` y `out_dir`).
3. Seguir el README de la receta. Un cuadro tarda de 1 a 9 segundos a
   1080 × 1920; la toma entera, unos 45 minutos con cuatro procesos. Cada cuadro se dibuja solo, así que un cambio
   se arregla redibujando sólo su tramo (por ejemplo, `node render.js 3 8.24 10 …`).
4. Lo que se rehaga se vuelve a publicar en la página privada, pasando su
   `url` a la herramienta `Artifact`. La versión de máxima calidad va partida
   en `maestros/*.pN.mp4` (`split -b 14M`; se une con `cat`, en orden), porque
   cada archivo publicado puede pesar hasta 15 MB.

## Límites conocidos

- La sesión de la nube no tiene placa de video: se dibuja con SwiftShader.
- Claude no escucha audio: el sonido se controla con el espectrograma, la
  sonoridad (−16 LUFS integrados, pico de −1,2 dB) y los tiempos de cada golpe.
