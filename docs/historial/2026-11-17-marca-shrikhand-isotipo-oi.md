# Marca: el «oído» en Shrikhand y el ícono «oí» (beta, etapa 4)

**Pedido:** Julieta, 2026-11-17 (etapa 4 de la beta, «Identidad, marca e
isotipo»). Antes de rehacer la marca, decidir la letra del «oído» y el acento
viéndolos renderizados en claro y oscuro, sobre la landing y sobre el ícono
chico. Después, llevar la letra al resto de la marca, revisar el ícono en
todos sus tamaños, dejar la lista de fotos de la landing y contestar si la
marca se diferencia lo suficiente de Bachero.

**Qué cambió:**

- **Decisiones de Julieta** (tablero con las opciones aplicadas a la landing y
  la app reales: https://claude.ai/artifact/6y2hB27TdTFS3VL3pnB6QN): la letra
  es **Shrikhand** (antes Sancreek; también se probó Fraunces cursiva) y el
  acento **sigue siendo ámbar** (se probó bordó).
- La palabra «oído» pasa a Shrikhand en todos lados: el fileteado de la
  pantalla de arranque, la comanda y el final de la landing
  (`components/landing/Filete.tsx`), el encabezado de la landing
  (`.landing-marca` en `app/globals.css`) y **el encabezado de la app**, que
  deja el ícono con «oído» en Fraunces y pasa a la palabra sola, plana, en
  azul hondo (celeste en oscuro), igual que la landing
  (`components/Logo.tsx`). También `/historia`, la landing vieja guardada
  para reels, que juntaba el ícono con la palabra en Fraunces. Recorte local
  `app/fonts/shrikhand-oido.woff2` (1,5 KB) en lugar de `sancreek-oido.woff2`;
  utilidad `font-oido`. Fraunces deja de cargarse (no la usa nada más).
- **El ícono es «oí»** en lugar de las manos con la oreja: crema sobre azul
  hondo, fileteado en los tamaños grandes (`public/logo-mark.svg`,
  `logo-maskable.svg`), plano de 48 px para abajo (`logo-mark-chico.svg`:
  favicon, `/bienvenida`) y en silueta (`logo-figure.svg`: badge de Android y
  estados vacíos vía `LogoGlyph`). `scripts/build-icons.mjs` ahora arma el
  `.ico` con la versión plana y genera también `badge-96.png`.
- **Miniatura para compartir:** `assets/og/filete-oido.png` rehecha con
  Shrikhand (misma proporción, 1200 × 609).
- **Vectores para el diseñador** en `docs/design-system/marca/`, con la letra
  convertida a trazos (se abren sin la fuente): `oido-filete`,
  `oido-filete-marca`, `oido-filete-cinta`, `oido-plano`, `oido-plano-blanco`
  y las cuatro versiones de `isotipo-oi`. Los generó un script con fonttools
  y harfbuzz que reproduce las capas de `Filete.tsx`.
- **Manual de marca en PDF** para el diseñador (8 páginas: la palabra, el
  fileteado, el ícono, color, tipografía, en uso y el paquete de archivos):
  `docs/design-system/marca/oido-manual-de-marca.pdf`. Reemplaza al PDF
  violeta. El brand system navegable («Marca Oído»,
  https://claude.ai/artifact/J8s5yUUpW3Ufz2hbWKYYns) se actualizó con los
  vectores, la miniatura y este PDF.
- **Fotos de la landing:** qué va en cada lugar, con tamaño, encuadre y
  permisos, en `docs/design-system/fotos-landing.md`.
- **Bachero** (análisis en https://claude.ai/artifact/KunFKqPLnUuuaZCDNy9WWW):
  en lo que más se ve ya no se parece (cielo y blanco con fotos contra crema y
  azul francia con grabados). Quedaban cuatro cruces: el ícono (una mano
  blanca sobre azul, resuelto con «oí»), la letra (gorda, recta y con remate
  como «BACHERO», resuelto con Shrikhand), la comanda con aire de ticket y el
  par azul y naranja. Las dos últimas quedan como reglas en `marca-hoy.md`.
- Docs: `marca-hoy.md`, `typography.md`, `MAPA_DEL_CODIGO.md`, `STATUS.md` y el
  tablero de la beta.

**Por qué así:** Shrikhand es gorda e inclinada como la letra fantasía de los
carteles fileteados, la inclinación dice «rápido», su «o» sola se lee hasta en
16 px y es otra familia que la de Bachero. Sancreek tenía más «cartel
antiguo» pero se iba al Far West, y su «o» sola parecía un cero. El ámbar es
el opuesto del celeste en el círculo de color (con un solo acento, el que más
salta) y el color del sol y del dorado del filete; el bordó se apagaba sobre
celeste y en oscuro tenía que pasar a rosado. Se descartaron mostaza (con el
azul hondo es Boca), rojo (errores y PedidosYa) y verde (es «Disponible»). El
ícono «oí» reemplaza a las manos porque en chico eran «una mano blanca sobre
azul», como el de Bachero, y porque la marca ya tenía su letra.

El Sol de Mayo del final de la landing queda como estaba hasta que Julieta
confirme con la asesoría legal el uso de símbolos nacionales; no se usó en
ninguna pieza nueva.

**Queda abierto:** el isotipo propio (Julieta, al ver el «oí»: «hay que
hacer uno, no ese genérico»; el «oí» queda como provisorio); llevar la dirección
«con relieve» a la app (prueba en
https://claude.ai/artifact/WNXBXhkNgGrFdBbqFNsQan, Julieta eligió seguir con
ella), pantalla por pantalla; que la comanda deje de parecer un ticket; las
fotos propias. Los SVG viejos (`public/logo.svg`, `logo-badge.svg`,
`oido-isotipo.svg`, `logo-figure-warm.svg`) siguen con las manos: la app no
los usa, pero `logo-figure-warm.svg` aparece en una animación vieja de
`marketing/videos/`, así que no se borraron.
