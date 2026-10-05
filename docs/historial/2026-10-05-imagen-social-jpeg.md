# Imagen social en JPEG y en una URL fija

**Pedido:** Julieta, 2026-10-05, después de #403: la imagen nueva ya salía
bien en WhatsApp, pero en el formato chico (miniatura al costado del
título), no grande como la de TitoFree.

**Qué cambió:** `og:image` ya no sale de la convención
`app/opengraph-image.tsx` (PNG en `/opengraph-image?<hash>`) sino de
`app/og/oido.jpg/route.ts`: el mismo diseño de `lib/og-brand.tsx`, generado
en el build, convertido a JPEG sin canal alfa (~58 KB) y servido en
`/og/oido.jpg`, sin query. El layout y `/turno/[id]` la nombran explícita
(constantes en `lib/og.ts`). `sharp` pasa a dependencia declarada del
frontend (ya venía con Next y lo usa `scripts/build-icons.mjs`). La de X
(`twitter-image.tsx`) no cambia.

**Por qué así:** no se pudo leer qué sirve TitoFree (el proxy de la sesión
no deja salir a su dominio) ni probar WhatsApp desde acá. Las guías
publicadas sólo ponen como condición del formato grande un ancho de 300 px
o más y menos de 600 KB, y la nuestra ya cumplía. Se cambiaron juntas las
tres diferencias razonables con una imagen típica: formato, canal alfa y
query en la URL.

**Queda abierto:** confirmarlo compartiendo un link nuevo (con `?v=3`, por
la caché de WhatsApp). Si sigue chico, lo próximo es probar la imagen
apaisada de 1200×630 en JPEG.
