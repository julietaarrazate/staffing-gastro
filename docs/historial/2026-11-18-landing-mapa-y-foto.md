# Landing: el mapa de la prueba y la foto de los bartenders (beta, etapa 4)

**Pedido:** Julieta, 2026-11-18, al ver la landing híbrida publicada (#634):
«no están todos los cambios de la landing, sigue el mismo mapa de la anterior,
y abajo no está la foto que pusiste con los bartenders en "Turnos cerca
tuyo"».

**Qué cambió:** dos piezas de la landing que en #634 habían quedado como
antes, y que en la prueba híbrida eran distintas.

- **El mapa de «Alguien libre, a pocas cuadras».** Es más celeste, y las tres
  personas que se postulan son fotos en un círculo, no círculos con
  iniciales; la que va lleva un aro azul hondo y su línea punteada hasta
  «Tu bar». El pie es una ficha con su foto, «Lucía, moza» y «Va en camino a
  Tu bar · a 190 m». Se fueron del pie la estrella con el puntaje y el sello
  «Identidad verificada». La secuencia (la onda, los puntos, los tres que se
  postulan, la que viene) es la misma.
- **«Turnos cerca tuyo».** La oferta lleva la foto de los bartenders en la
  barra, y el puesto dice «Bartender» (antes la bandeja y «Mozo/a»).

Técnico: `frontend/components/landing/MapaCamino.tsx` (`POSTULANTES` con
`foto`, `cara` y `zoom`), `ParaTrabajar.tsx`, y en `globals.css` el tinte del
mapa (`.landing-mapa-calles::before` en modo «color» más un velo) y
`.landing-mapa-cara`. Test de la ficha en `e2e/landing.spec.ts`.

**Por qué así:** en #634 se leyó «el mapa va en celeste, sin reloj» como
«sacarle el reloj al mapa que hay», y la oferta se dejó con su foto. Julieta
comparaba contra la prueba, que es lo que había aprobado. Lección: cuando una
prueba está aprobada, lo que no se lleva tal cual se avisa pieza por pieza
antes de pedir el merge, no después.

Los metros que faltan se quedan: es lo único que la app sabe de verdad de
quien viene. Las fotos son de banco, como las del inicio; qué va en cada
lugar, en `docs/design-system/fotos-landing.md`.

**Queda abierto:** el ejemplo de la comanda sigue siendo «un mozo» y la
oferta dice «Bartender»: son dos ejemplos distintos, como en la prueba.
