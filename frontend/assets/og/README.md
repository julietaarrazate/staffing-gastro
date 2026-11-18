Archivos para la imagen de vista previa (`lib/og-brand.tsx`). Satori necesita
TTF/OTF/WOFF, no WOFF2, y el build no debería depender de la red.

- `Inter-SemiBold.ttf` — Inter (peso 600), SIL Open Font License 1.1. Bajada
  de Google Fonts el 2026-09-23.
- `filete-oido.png` — la palabra "oído" fileteada en su nivel «cargado»
  (volutas celestes, filete dorado, flores, cinta celeste y blanca), 1200 × 676
  con fondo transparente, en paleta de 256 colores. Va como PNG porque satori
  no dibuja el texto que hay dentro de un SVG. No se edita a mano: la escribe
  `node scripts/build-filete.mjs` desde el mismo dibujo que usa
  `components/landing/Filete.tsx`. Si cambia el alto, cambiarlo también en
  `lib/og.ts` (`OG_FILETE`); `scripts/build-filete.test.ts` avisa.
