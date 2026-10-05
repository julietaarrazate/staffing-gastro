# Imagen social que WhatsApp muestra grande

**Pedido:** Julieta, 2026-10-05: al compartir `oido.com.ar` por WhatsApp la
vista previa salía como una miniatura chica y rara ("un pedazo recortado del
ticket"); quería que se viera como la de TitoFree, con el logo grande.

**Qué cambió:** la imagen de vista previa ahora es la marca sola y centrada
(isotipo grande, wordmark "oído", tagline) y en `og:image` va **cuadrada**
(1200×1200), que WhatsApp muestra grande. Para X sigue una versión apaisada
(1200×630) con el mismo diseño. El diseño vive en un solo lugar,
`frontend/lib/og-brand.tsx` (colores y textos arriba de todo, logo desde
`public/logo-mark.svg`), y lo usan `app/opengraph-image.tsx` y
`app/twitter-image.tsx`. Los links de turnos (`app/turno/[id]/page.tsx`)
siguen la misma regla: con foto del local, la foto recortada cuadrada para
`og:image` y apaisada para X (`cldOgImage` ahora recibe el tamaño); sin foto,
la imagen de marca. `SITE_HOST` pasó a `www.oido.com.ar` y el layout declara
`og:url`.

**Por qué así:** dos causas. (1) La imagen anterior era apaisada, con el logo
a la izquierda y una tarjeta de turno a la derecha; WhatsApp la mostraba como
miniatura cuadrada recortando el centro, que caía entre las dos mitades: ni
logo ni tarjeta entera. (2) `og:image` apuntaba a `oido.com.ar`, que en
Vercel redirige (308) a `www.oido.com.ar`; la imagen se pedía a través de
un salto que no todos los lectores de links siguen igual. Que WhatsApp
muestre grande una imagen cuadrada se tomó de la captura de TitoFree; es
comportamiento de WhatsApp, no documentado, así que se verifica compartiendo
un link real después del deploy.

**Queda abierto:** WhatsApp cachea la vista previa por URL; un link ya
compartido puede seguir mostrando la vieja. Si la identidad nueva (hilo
"Identidad de marca de Oído") cambia el logo, se cambia en `og-brand.tsx`.
