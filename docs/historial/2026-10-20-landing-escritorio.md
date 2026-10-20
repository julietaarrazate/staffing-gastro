# Landing en computadora: rueda que se funde, títulos y tarjetas a escala, precios sin espacios

**Pedido:** Julieta: la landing «se ve bastante mejor que al comienzo, pero en
la web se ve rara» (en computadora; en el celular estaba bien).

**Qué cambió:** revisada renderizada en 1280, 1440 y 1920 px (y 390 px):
- La rueda de fotos del inicio ya no se corta en seco contra el borde de
  abajo: se funde hacia el blanco (`.landing-rueda-marco`, máscara en
  `globals.css`, envuelve la rueda en `components/landing/HeroRueda.tsx`).
- Secciones de dos columnas (`.landing-sec-dos`): columnas iguales y título
  de hasta 14ch. «Turnos de gastronomía cerca tuyo, cuando quieras» pasa de
  5 renglones a 4. Las tarjetas de `Confianza.tsx` y `ParaTrabajar.tsx`
  crecen en pantallas anchas (460 y 420 px).
- Precios de `Precios.tsx` y `ParaTrabajar.tsx`: sin `tabular-nums`. En
  Schibsted Grotesk las cifras tabulares le dan al punto el ancho de un
  número y se leía «$20 . 000» (también en el celular).

**Por qué así:** cambios chicos de CSS sobre lo que ya existe; la rueda y el
orden de la página no cambian.

**Queda abierto:** las fotos de la rueda son de banco y chicas (480 × 600);
en pantallas grandes se notan. Siguen pendientes las fotos propias.
