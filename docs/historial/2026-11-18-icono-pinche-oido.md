# El ícono de la app pasa a ser el pinche con «oído» (#631)

**Pedido:** Julieta (2026-11-18), después de ver cinco isotipos: el ícono deja
de ser el «oí» provisorio y pasa a ser el pinche con «oído», sólo como ícono
de la app (no va junto a la palabra en encabezados ni en la landing; el Sol de
Mayo no se usa).

**Qué cambió:** el ícono de la app es la comanda de papel clavada en el pinche
de la cocina, con «oído» fileteado en el papel. Grande, con relieve duro azul
corrido abajo a la derecha: `frontend/public/logo-mark.svg`, `icon-192.png`,
`icon-512.png`, `apple-icon.png`. Con margen para Android
(`logo-maskable.svg`, `icon-maskable-512.png`): el dibujo entero dentro del
círculo central del 80 %, fondo a sangre. De 48 px para abajo, plano y con la
«o» sola (`logo-mark-chico.svg`, `favicon.ico` de 16, 32 y 48). Silueta de un
solo color con la «o» calada (`logo-figure.svg`, `badge-96.png`): la usan el
badge de Android y `LogoGlyph` (estados vacíos, loader, avisos). Vectores
nuevos para el diseñador en `docs/design-system/marca/`: `isotipo-pinche`,
`-chico`, `-maskable` y `-silueta`; los `isotipo-oi*` y el PDF del manual no
se tocaron. Docs al día: `marca-hoy.md` (regla 4), `direccion-relieve.md`,
`STATUS.md`, `BETA_TABLERO.md` y `MAPA_DEL_CODIGO.md`.

Técnicamente: el dibujo (geometría de la prueba aprobada, lienzo de 512) lo
escribe `frontend/scripts/build-isotipo-pinche.py`, y
`frontend/scripts/build-icons.mjs` rasteriza PNG y `.ico` como antes. La letra
va **convertida a trazos**: el script saca los contornos de «o», «í», «d» de
`app/fonts/shrikhand-oido.woff2` (el recorte ya trae los tres glifos) y los
posiciona con HarfBuzz (kerning incluido), así los SVG no dependen de ninguna
fuente. Comparado con la prueba renderizada en Chromium con Shrikhand, la
letra cae en el mismo lugar y tamaño (la única diferencia es el radio de las
esquinas del tile: 112, como el resto de los íconos, en vez de 115,2).

**Por qué así:** la maskable no es la grande con más fondo: el dibujo entero
(con el relieve) medía 211 px de radio y la zona segura es de 205, así que se
achicó a 196 y se centró por círculo mínimo. La silueta usa la geometría
plana de 48 px (más gorda, aguanta el badge de 96 px y los 14 px de los
avisos) y la «o» se cala con un `clipPath` evenodd, no con una máscara, que
anda igual en las máscaras CSS de `LogoGlyph` y en el rasterizado de `sharp`.
El pliegue celeste de la esquina desaparece en la silueta (un solo color).

**Queda abierto:** `design-system/marca/oido-manual-de-marca.pdf` sigue con el
«oí» (no se regeneró). Los SVG viejos de `public/` (`logo.svg`, `logo-badge.svg`,
`logo-figure-warm.svg`, `oido-isotipo.svg`, con la mano sobre la oreja) no
los usa el código y no se tocaron. Falta decidir si se encarga el isotipo a un
fileteador (ver `design-system/marca-hoy.md`, Pendiente).
