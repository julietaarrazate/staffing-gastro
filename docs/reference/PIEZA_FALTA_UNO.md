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

Se hace por etapas. Primero la escena 3 sola («Una mesa. Otra. Otra. Otra.
Otra.»: la pila de comandas que sube hasta el cielo), puesta al lado de la
torre del teaser. Con el sí de Julieta siguen el resto del guion y los tres
cortes para redes.

## Dónde está cada cosa

| Pieza | Dónde |
|---|---|
| El guion, la vara de calidad y los límites | Documento privado de crecimiento, pestaña «Pieza 3D · guion» |
| Los videos, el avance y la comparación con el teaser | Página privada **«Pieza Falta uno»**: <https://claude.ai/artifact/TobQSft57XY8cMg5m2xRLw> |
| La receta: los programas que dibujan, suenan y arman | [`tools/pieza-falta-uno/`](../../tools/pieza-falta-uno/README.md) |

Los videos no van al repo: el repo es público y pesan decenas de megas. Los
cuadros sueltos tampoco: la receta los vuelve a dibujar idénticos.

## Retomar en una sesión nueva

1. `cd tools/pieza-falta-uno && npm ci` (instala three; Playwright, Chromium y
   ffmpeg los trae el entorno, ver [`SESION_CLOUD.md`](./SESION_CLOUD.md)).
2. Seguir el README de la receta. Un cuadro tarda de 2 a 9 segundos a
   1080 × 1920 según cuántos instantes promedie; la escena 3 entera, unos
   30 minutos con dos procesos.
3. Lo que se rehaga se vuelve a publicar en la página privada, pasando su
   `url` a la herramienta `Artifact`.

## Límites conocidos

- La sesión de la nube no tiene placa de video: se dibuja con SwiftShader.
- Claude no escucha audio: el sonido se controla con el espectrograma, la
  sonoridad (−14 LUFS integrados) y los tiempos de cada golpe.
