Archivos para la imagen de vista previa (`lib/og-brand.tsx`). Satori necesita
TTF/OTF/WOFF, no WOFF2, y el build no debería depender de la red.

- `Inter-SemiBold.ttf` — Inter (peso 600), SIL Open Font License 1.1. Bajada
  de Google Fonts el 2026-09-23.
- `filete-oido.png` — la palabra "oído" fileteada de la landing
  (`components/landing/Filete.tsx`, tamaño "firma"), 1200 × 428 con fondo
  transparente, en paleta de 256 colores. Va como PNG porque satori no dibuja
  el texto que hay dentro de un SVG. Para rehacerla: renderizar `Filete` con
  Fraunces SemiBold, capturar sólo el SVG sin fondo, recortar al contenido y
  escalar a 1200 de ancho. Si cambia `Filete.tsx`, rehacerla también.
